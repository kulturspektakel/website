import Stripe from 'stripe';
import {prismaClient} from '../../utils/prismaClient.server';
import {DonationSource} from '../../generated/prisma/client';
import {ApiError} from '../../utils/apiError.server';
import {enqueueGcpTask} from '../../utils/enqueueGcpTask.server';
import {slackApiRequest} from '../../utils/slack.server';
import {SlackChannel} from '../../utils/slackChannels';

const currencyFormat = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

/**
 * Migrated from `~/api.kulturspektakel.de/src/routes/stripe.ts`.
 *
 * Stripe webhook endpoint. Verifies the signature against
 * `STRIPE_SIGNING_SECRET`, then on `checkout.session.completed` records the
 * donation, announces it in #zuschuesse, and — if Stripe collected an email —
 * sends a receipt-download link via the `send-email` Cloud Task so it retries
 * independently.
 *
 * Authenticated by the Stripe signature alone (no gcpAuth/deviceAuth), which
 * is why the route mounts only `apiErrorBoundary`.
 */
export async function handleStripeWebhook(request: Request): Promise<Response> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    throw new ApiError(400, 'No stripe-signature header');
  }

  const secret = process.env.STRIPE_SIGNING_SECRET;
  if (!secret) {
    throw new ApiError(500, 'STRIPE_SIGNING_SECRET is not set');
  }

  // Stripe verifies the signature against the exact raw bytes, so read the
  // body as-is before anything parses it.
  const rawBody = Buffer.from(await request.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = await Stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      secret,
    );
  } catch (e) {
    throw new ApiError(400, 'Invalid stripe signature', e as Error);
  }

  if (event.type === 'checkout.session.completed') {
    await checkoutSessionCompleted(event.data.object);
  }

  return new Response(null, {status: 200});
}

async function checkoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (!session.amount_total) {
    throw new ApiError(400, 'Amount is missing');
  }

  // Stripe retries webhooks until it gets a 2xx, so guard against recording
  // the same checkout twice (the legacy handler could double-insert).
  const existing = await prismaClient.donation.findFirst({
    where: {reference: session.id},
    select: {id: true},
  });
  if (existing) {
    return;
  }

  const email =
    session.customer_email ?? session.customer_details?.email ?? undefined;
  // The donor's own "Name" custom field — what they want shown publicly. It's
  // optional, so this may be undefined. `||` (not `??`) so a blank/empty value
  // collapses to undefined too.
  const name =
    session.custom_fields.find((field) => field.key === 'name')?.text?.value ||
    undefined;
  // The receipt (Spendenquittung) needs the donor's legal name, so prefer the
  // billing name Stripe collected (`customer_details.name`) and only fall back
  // to the custom field. Pre-filled here as a default the donor confirms/edits
  // on the receipt form; the receipt isn't issued until `spendenQuittungAt`.
  const billingName = session.customer_details?.name || undefined;
  const address = session.customer_details?.address;
  // German receipt layout: "Straße und Hausnummer" then "PLZ und Ort".
  const quittungStreet =
    [address?.line1, address?.line2].filter(Boolean).join(', ') || undefined;
  const quittungCity =
    [address?.postal_code, address?.city].filter(Boolean).join(' ') ||
    undefined;

  const donation = await prismaClient.donation.create({
    data: {
      reference: session.id,
      createdAt: new Date(session.created * 1000),
      email,
      amount: session.amount_total,
      name,
      quittungName: billingName ?? name,
      quittungStreet,
      quittungCity,
      source: DonationSource.Stripe,
    },
  });

  const formattedAmount = currencyFormat.format(session.amount_total / 100);

  await slackApiRequest('chat.postMessage', {
    channel: SlackChannel.zuschuesse,
    text: `💰 ${formattedAmount} Spende von *${name ?? billingName ?? 'Unbekannt'}*`,
  });

  if (email) {
    await enqueueGcpTask('send-email', {
      from: 'Kulturspektakel Gauting Kasse <kasse@kulturspektakel.de>',
      to: email,
      template: 'donation',
      variables: {
        link: `https://www.kulturspektakel.de/spenden/quittung/${donation.id}`,
      },
    });
  }
}
