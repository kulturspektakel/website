import {beforeEach, describe, expect, test, vi} from 'vitest';
import Stripe from 'stripe';

const {enqueueGcpTask} = vi.hoisted(() => ({enqueueGcpTask: vi.fn()}));
const {slackApiRequest} = vi.hoisted(() => ({slackApiRequest: vi.fn()}));
const {findFirst, create} = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../../utils/enqueueGcpTask.server', () => ({enqueueGcpTask}));
vi.mock('../../utils/slack.server', () => ({slackApiRequest}));
vi.mock('../../utils/prismaClient.server', () => ({
  prismaClient: {donation: {findFirst, create}},
}));

const SECRET = 'whsec_test_secret';
process.env.STRIPE_SIGNING_SECRET = SECRET;

const {handleStripeWebhook} = await import('./stripe');

// Match the handler's formatter exactly — de-DE inserts a non-breaking space
// before the € sign, so a hand-typed literal wouldn't compare equal.
const eur = (cents: number) =>
  new Intl.NumberFormat('de-DE', {style: 'currency', currency: 'EUR'}).format(
    cents / 100,
  );

// 2025-01-01T00:00:00Z
const created = 1_735_689_600;

function checkoutCompleted(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        created,
        amount_total: 5000,
        customer_email: 'donor@example.test',
        customer_details: null,
        custom_fields: [{key: 'name', text: {value: 'Erika Musterfrau'}}],
        ...overrides,
      },
    },
  };
}

/** Build a Request with a valid Stripe signature for the given event. */
function signedRequest(event: object) {
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: SECRET,
  });
  return new Request('https://example.test/api/stripe/webhook', {
    method: 'POST',
    body: payload,
    headers: {'stripe-signature': signature},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  enqueueGcpTask.mockResolvedValue(undefined);
  slackApiRequest.mockResolvedValue({ok: true});
  findFirst.mockResolvedValue(null);
  create.mockResolvedValue({id: 'donation-1'});
});

describe('handleStripeWebhook', () => {
  test('records the donation, announces it, and emails the receipt link', async () => {
    const res = await handleStripeWebhook(signedRequest(checkoutCompleted()));
    expect(res.status).toBe(200);

    expect(create).toHaveBeenCalledWith({
      data: {
        reference: 'cs_test_123',
        createdAt: new Date(created * 1000),
        email: 'donor@example.test',
        amount: 5000,
        name: 'Erika Musterfrau',
        source: 'Stripe',
      },
    });

    expect(slackApiRequest).toHaveBeenCalledWith('chat.postMessage', {
      channel: 'C030FV86XKR',
      text: `💰 ${eur(5000)} Spende von *Erika Musterfrau*`,
    });

    expect(enqueueGcpTask).toHaveBeenCalledWith('send-email', {
      from: 'Kulturspektakel Gauting Kasse <kasse@kulturspektakel.de>',
      to: 'donor@example.test',
      template: 'donation',
      variables: {
        link: 'https://www.kulturspektakel.de/spenden/quittung/donation-1',
      },
    });
  });

  test('falls back to customer_details email and "Unbekannt" when no name', async () => {
    await handleStripeWebhook(
      signedRequest(
        checkoutCompleted({
          customer_email: null,
          customer_details: {email: 'fallback@example.test'},
          custom_fields: [],
        }),
      ),
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'fallback@example.test',
          name: undefined,
        }),
      }),
    );
    expect(slackApiRequest).toHaveBeenCalledWith('chat.postMessage', {
      channel: 'C030FV86XKR',
      text: `💰 ${eur(5000)} Spende von *Unbekannt*`,
    });
  });

  test('skips the email when Stripe collected no address', async () => {
    await handleStripeWebhook(
      signedRequest(
        checkoutCompleted({customer_email: null, customer_details: null}),
      ),
    );
    expect(create).toHaveBeenCalled();
    expect(enqueueGcpTask).not.toHaveBeenCalled();
  });

  test('is idempotent: a replayed checkout is ignored', async () => {
    findFirst.mockResolvedValue({id: 'donation-1'});
    const res = await handleStripeWebhook(signedRequest(checkoutCompleted()));
    expect(res.status).toBe(200);
    expect(create).not.toHaveBeenCalled();
    expect(slackApiRequest).not.toHaveBeenCalled();
    expect(enqueueGcpTask).not.toHaveBeenCalled();
  });

  // The handler throws ApiError(400); apiErrorBoundary turns that into a 400
  // response in the real route.
  test('rejects a missing signature header with 400', async () => {
    await expect(
      handleStripeWebhook(
        new Request('https://example.test/api/stripe/webhook', {
          method: 'POST',
          body: JSON.stringify(checkoutCompleted()),
        }),
      ),
    ).rejects.toMatchObject({code: 400});
    expect(create).not.toHaveBeenCalled();
  });

  test('rejects an invalid signature with 400', async () => {
    await expect(
      handleStripeWebhook(
        new Request('https://example.test/api/stripe/webhook', {
          method: 'POST',
          body: JSON.stringify(checkoutCompleted()),
          headers: {'stripe-signature': 't=1,v1=deadbeef'},
        }),
      ),
    ).rejects.toMatchObject({code: 400});
    expect(create).not.toHaveBeenCalled();
  });

  test('ignores unrelated event types', async () => {
    const res = await handleStripeWebhook(
      signedRequest({
        id: 'evt_2',
        type: 'payment_intent.succeeded',
        data: {object: {id: 'pi_1'}},
      }),
    );
    expect(res.status).toBe(200);
    expect(create).not.toHaveBeenCalled();
  });
});
