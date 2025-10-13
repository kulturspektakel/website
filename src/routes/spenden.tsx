import {createFileRoute, Link} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../utils/prismaClient';
import {seo} from '../utils/seo';
import {
  Flex,
  Text,
  Heading,
  SimpleGrid,
  Button,
  VStack,
  Image,
} from '@chakra-ui/react';
import DateString from '../components/DateString';
import Page, {pageSelect} from '../components/Page';
import {imageIDsFromMarkdown, markdownText} from '../utils/markdownText';
import {directusImages} from '../utils/directusImage';
import {useMemo, useState} from 'react';
import {Stripe} from 'stripe';
import {z} from 'zod';
import ConfettiClient from '../components/booking/Confetti.client';
import Mark from '../components/Mark';
import {SpendenBox} from '../components/spenden/box';
import {EuroSign} from '../components/spenden/EuroSign';
import {Membership} from '../types/graphql';

const SearchSchema = z
  .object({
    checkout: z.string().optional(),
  })
  .optional();

const loader = createServerFn()
  .inputValidator(SearchSchema)
  .handler(async ({data: input}) => {
    console.log(input);
    const checkoutId = input?.checkout;

    const data = await prismaClient.donation.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        name: true,
        amount: true,
        message: true,
        createdAt: true,
        source: true,
      },
      where: {
        id: {
          not: checkoutId,
        },
      },
    });

    let checkout: Stripe.Checkout.Session | null = null;
    if (checkoutId) {
      const stripe = new Stripe(process.env.STRIPE_API_KEY);
      checkout = await stripe.checkout.sessions
        .retrieve(checkoutId)
        .catch(() => null);
    }
    if (checkout) {
      data.splice(0, 0, {
        amount: checkout.amount_total ?? 0,
        message:
          checkout.custom_fields.find((field) => field.key === 'nachricht')
            ?.text?.value ?? null,
        name:
          checkout.custom_fields.find((field) => field.key === 'name')?.text
            ?.value ?? null,
        createdAt: new Date(checkout.created * 1000),
        source: 'Stripe',
      });
    }

    const page = await prismaClient.page.findUniqueOrThrow({
      where: {
        slug: 'spenden',
      },
      select: pageSelect,
    });

    const {left, right, bottom, content, ...pageData} = page;
    const imageMap = await directusImages(
      imageIDsFromMarkdown(left, right, bottom, content),
    );

    const [contentMd, leftMd, rightMd, bottomMd] = await Promise.all([
      content ? markdownText(content, imageMap) : undefined,
      left ? markdownText(left, imageMap) : undefined,
      right ? markdownText(right, imageMap) : undefined,
      bottom ? markdownText(bottom, imageMap) : undefined,
    ]);

    return {
      page: {
        ...pageData,
        left: leftMd,
        right: rightMd,
        bottom: bottomMd,
        content: contentMd,
      },
      donations: data.filter((s) => s.source !== 'Other'),
      totalAmount: data.reduce((acc, item) => acc + item.amount, 0),
      hasDonation: checkout != null,
    };
  });

export const Route = createFileRoute('/spenden')({
  loaderDeps: ({search}) => ({search}),
  loader: async ({deps}) => await loader({data: deps.search}),
  validateSearch: SearchSchema,
  head: () =>
    seo({
      title: 'Spenden',
      description: 'Das Kulturspektakel braucht deine Unterstützung',
    }),

  component: RouteComponent,
});

function RouteComponent() {
  const {
    donations,
    page: {title, content, ...page},
    hasDonation,
    totalAmount,
  } = Route.useLoaderData();
  const [showAll, setShowAll] = useState(false);

  const currency = useMemo(() => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

  const previewLength = 6;

  return (
    <VStack gap="12" alignItems="stretch">
      {hasDonation && (
        <VStack gap="4" textAlign="center" mb="10">
          <ConfettiClient />
          <Image src="/genre/metal.svg" width="16" />
          <Heading textAlign="center" size="3xl">
            Vielen Dank für deine Unterstützung!
          </Heading>
          <Text>
            Wir wissen es sehr zu schätzen, dass du das Kulturspektakel
            unterstützt, wir hoffen dich auch 2026 wieder bei uns zu sehen!
          </Text>
        </VStack>
      )}

      <Page title={title} content={content} />

      <SpendenBox
        total={totalAmount}
        donors={donations.length}
        secondaryButton={
          <Link
            to="/mitgliedsantrag"
            search={{
              membership: Membership.Foerderverein,
            }}
          >
            <Button variant="subtle" borderRadius="full" px={['4', '10']}>
              Fördermitglied werden
            </Button>
          </Link>
        }
      />

      <SimpleGrid columns={[1, 2, 3]} gap="5" mt="8">
        {(showAll ? donations : donations.slice(0, previewLength)).map(
          (item, index) => (
            <Flex flexDirection="column" textAlign="center" key={index}>
              <Heading mb="1" size="xl">
                <Mark>
                  {currency.format(item.amount / 100)}
                  <EuroSign />
                </Mark>
              </Heading>
              {item.name && <Text fontWeight="bold">{item.name}</Text>}
              <Text fontSize="sm" hyphens="auto" lang="de">
                {item.message}
              </Text>

              <Text color="gray.500" fontSize="sm">
                <DateString
                  options={{day: 'numeric', month: 'long', year: 'numeric'}}
                  date={item.createdAt}
                />
              </Text>
            </Flex>
          ),
        )}
      </SimpleGrid>
      {!showAll && donations.length > previewLength && (
        <Flex justify="center">
          <Button variant="ghost" onClick={() => setShowAll(true)}>
            alle Spenden anzeigen
          </Button>
        </Flex>
      )}
      <Page {...page} />
    </VStack>
  );
}
