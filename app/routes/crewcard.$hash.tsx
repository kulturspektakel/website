import {
  Avatar,
  Box,
  Text,
  defineStyle,
  Flex,
  Heading,
  VStack,
  Image,
  Button,
  BoxProps,
  ListRoot,
  SimpleGrid,
} from '@chakra-ui/react';
import InfoText from '../components/kultcard/InfoText';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {seo} from '../utils/seo';
import {CardActivities, Cell} from '../components/kultcard/CardActivities';
import {prismaClient} from '../utils/prismaClient';
import {Badge, badgeConfig} from './badges';
import {SegmentedControl} from '../components/chakra-snippets/segmented-control';
import {useRef, useState} from 'react';

function decodePayload(hash: string) {
  const binary = atob(hash);
  const bytes = new Uint8Array([...binary].map((char) => char.charCodeAt(0)));
  const payload = [...bytes]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return {
    cardId: payload.substring(0, 14),
  };
}

const highscore = createServerFn()
  .validator((data: {start: Date; end: Date}) => data)
  .handler(async ({data: {start, end}}) => {
    const highscores = await prismaClient.productList.aggregate({
      where: {
        active: true,
        OrderItem: {
          // Order: {
          //   crewCardId: {not: null},
          //   createdAt: {
          //     gt: start,
          //     lt: end,
          //   },
          // },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  });

const loader = createServerFn()
  .validator((data: {hash: string; event: {start: Date; end: Date}}) => data)
  .handler(async () => {
    const res = await prismaClient.crewCard.findUnique({
      where: {
        id: new Uint8Array(
          '53BD92EA300001'.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
        ),
      },
      select: {
        validUntil: true,
        privileged: true,
        suspended: true,
        nickname: true,
        Viewer: {
          select: {
            displayName: true,
            profilePicture: true,
          },
        },
        Order: {
          select: {
            createdAt: true,
            OrderItem: {
              select: {
                name: true,
                amount: true,
                ProductList: {
                  select: {
                    id: true,
                    name: true,
                    emoji: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!res) {
      throw notFound();
    }

    const productLists = await prismaClient.productList.findMany({
      where: {active: true},
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        emoji: true,
      },
    });

    return {productLists, res};
  });

export const Route = createFileRoute('/crewcard/$hash')({
  component: CrewCard,
  loader: async ({params, context}) =>
    await loader({data: {event: context.event, hash: params.hash}}),
  head: () =>
    seo({
      title: 'CrewCard',
    }),
});

const ringCss = defineStyle({
  outlineWidth: '3px',
  outlineColor: 'blue.500',
  outlineOffset: '2px',
  outlineStyle: 'solid',
});

const TABS = ['Konsum', 'Badges', 'Highscores'];

function CrewCard() {
  const {res: data, productLists} = Route.useLoaderData();
  const {hash} = Route.useParams();
  const cardId = decodePayload(hash).cardId.toUpperCase();
  const ref = useRef<HTMLDivElement | null>(null);

  const [active, setActive] = useState(TABS[0]);
  const name = data.Viewer?.displayName ?? data.nickname;

  const awardedBadges = ['lokalpatriot', 'dauercamper', 'earlybird'];

  const totals = {
    Konsum: data.Order.reduce(
      (acc, cv) => acc + cv.OrderItem.reduce((acc, cv) => acc + cv.amount, 0),
      0,
    ),
  };

  return (
    <VStack gap="5" align="stretch">
      <Flex
        direction="column"
        shadow="2xl"
        bg="white"
        borderRadius="2xl"
        aspectRatio={0.63}
        alignItems="center"
        position="relative"
        justifyContent="space-between"
        p="5"
        maxW="320px"
        mx="auto"
      >
        <Box
          w="15%"
          aspectRatio={6}
          bg="offwhite.100"
          borderRadius="full"
          boxShadow="inset"
        />
        <Box w="50%" aspectRatio={1}>
          <Avatar.Root
            css={ringCss}
            size="full"
            background="linear-gradient(141deg,rgba(131, 58, 180, 1) 0%, rgba(253, 29, 29, 1) 50%, rgba(252, 176, 69, 1) 100%)"
          >
            <Avatar.Fallback
              name={name ?? '?'}
              fontFamily="Shrimp"
              fontSize="7xl"
              color="white"
            />
            {data.Viewer?.profilePicture && (
              <Avatar.Image
                width="auto"
                aspectRatio={1}
                objectFit="cover"
                src={data.Viewer.profilePicture}
              />
            )}
          </Avatar.Root>
        </Box>
        <Box textAlign="center">
          <Heading fontSize="3xl">{name}</Heading>
          <Text fontSize="lg" mt="1" opacity="0.5">
            Kulturspektakel Crew
          </Text>
        </Box>

        <Flex direction="column" w="full">
          <Info label="Gültig bis">
            {data.suspended || data.validUntil < new Date() ? (
              <Text color="brand.500">ungültig</Text>
            ) : (
              data.validUntil.toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                timeZone: '-06:00',
              })
            )}
          </Info>
          <Info label="Bonbude">{data.privileged ? 'ja' : 'nein'}</Info>
          <Info label="Chip-ID">{cardId.match(/.{1,2}/g)?.join(':')}</Info>
        </Flex>

        <Flex direction="row" w="full" mb="3">
          {TABS.map((t) => (
            <Button
              display="flex"
              background="transparent"
              color="black"
              flexDirection="column"
              textAlign="center"
              flexGrow="1"
              flexBasis="0"
              onClick={() => {
                ref.current?.scrollIntoView({
                  block: 'start',
                  behavior: 'smooth',
                });
                setActive(t);
              }}
            >
              <Label>{t}</Label>
              <Text fontSize="4xl">{totals[t] ?? 0}</Text>
            </Button>
          ))}
        </Flex>
      </Flex>

      <SegmentedControl
        mt="10"
        value={active}
        onValueChange={({value}) => setActive(value!)}
        items={TABS.map((t) => ({value: t, label: t}))}
        ref={ref}
      />
      {active === 'Konsum' && (
        <CardActivities
          data={data?.Order.map((o) => ({
            type: 'order',
            productList: o.OrderItem[0].ProductList?.name!,
            emoji: o.OrderItem[0].ProductList?.emoji ?? null,
            items: o.OrderItem,
            time: o.createdAt,
          }))}
        />
      )}
      {active === 'Badges' && (
        <>
          <SimpleGrid columns={[2, 2, 3]} gap="3">
            {Object.keys(badgeConfig)
              .filter((b) => awardedBadges.includes(b))
              .map((k) => (
                <VStack alignItems="center" w="100%">
                  <Badge type={k} width="50%" />
                  <Heading mt="5">{badgeConfig[k].name}</Heading>
                  <Text textAlign="center" fontSize="sm" color="offwhite.500">
                    {badgeConfig[k].description}
                  </Text>
                </VStack>
              ))}
          </SimpleGrid>
          <ListRoot
            as="ol"
            m="0"
            borderTopColor="offwhite.200"
            borderTopStyle="solid"
            borderTopWidth={1}
            pt="4"
          >
            {Object.keys(badgeConfig)
              .filter((b) => !awardedBadges.includes(b))
              .map((k) => (
                <Cell
                  key={k}
                  accessoryStart={<Badge enabled={false} type={k} />}
                  title={badgeConfig[k].name}
                  description={badgeConfig[k].description}
                />
              ))}
          </ListRoot>
        </>
      )}
      {active === 'Highscores' && (
        <>
          {productLists.map((p) => (
            <>
              <Heading textAlign="center" mt="3">
                {p.emoji} {p.name}
              </Heading>
              <ListRoot as="ol" m="0">
                <Cell
                  accessoryStart="🥇"
                  subtitle="Daniel Büchele"
                  description="3 Produkte"
                />
                <Cell
                  accessoryStart="🥈"
                  subtitle="Daniel Büchele"
                  description="3 Produkte"
                />
                <Cell
                  accessoryStart="🥉"
                  subtitle="Daniel Büchele"
                  description="3 Produkte"
                />
              </ListRoot>
            </>
          ))}
        </>
      )}
      <InfoText textAlign="center">
        Es kann etwas dauern, bis alle Buchungen vollständig in der Liste
        dargestellt werden.
      </InfoText>
    </VStack>
  );
}

function Info(props: {children: React.ReactNode; label: React.ReactNode}) {
  return (
    <Flex alignItems="center">
      <Label w="80px" textAlign="right" mr="1">
        {props.label}
      </Label>
      <Box ml="1" fontFamily="mono">
        {props.children}
      </Box>
    </Flex>
  );
}

function Label(props: BoxProps) {
  return (
    <Box
      textTransform="uppercase"
      opacity="0.5"
      fontSize="sm"
      fontWeight="bold"
      {...props}
    />
  );
}
