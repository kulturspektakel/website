import {
  Avatar,
  Box,
  Text,
  defineStyle,
  Flex,
  Heading,
  VStack,
  Image,
} from '@chakra-ui/react';
import InfoText from '../components/kultcard/InfoText';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {seo} from '../utils/seo';
import {CardActivities} from '../components/kultcard/CardActivities';
import {prismaClient} from '../utils/prismaClient';
import {Badge} from './badges';

const loader = createServerFn()
  .validator((data: {hash: string}) => data)
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

    return res;
  });

export const Route = createFileRoute('/crewcard/$hash')({
  component: CrewCard,
  loader: async ({params}) => await loader({data: params}),
  head: () =>
    seo({
      title: 'CrewCard',
    }),
});

const ringCss = defineStyle({
  outlineWidth: '2px',
  outlineColor: 'colorPalette.500',
  outlineOffset: '2px',
  outlineStyle: 'solid',
});

function CrewCard() {
  const data = Route.useLoaderData();

  const name = data.Viewer?.displayName ?? data.nickname;

  return (
    <VStack maxW="450px" mr="auto" ml="auto" gap="7">
      <VStack gap="5" align="stretch">
        <Flex
          direction="column"
          shadow="2xl"
          bg="white"
          borderRadius="2xl"
          aspectRatio={0.63}
          alignItems="center"
          position="relative"
        >
          <Image
            position="absolute"
            w="10%"
            bottom="2%"
            right="2%"
            src="/logos/logo.svg"
          />
          <Box
            w="15%"
            mt="5%"
            aspectRatio={6}
            bg="offwhite.100"
            borderRadius="full"
            boxShadow="inset"
          />
          <Box w="50%" mt="5%" aspectRatio={1}>
            <Avatar.Root css={ringCss} size="full">
              <Avatar.Fallback name={name ?? '?'} />
              {data.Viewer?.profilePicture && (
                <Avatar.Image
                  width="auto"
                  aspectRatio={1}
                  objectFit="cover"
                  src={data.Viewer.profilePicture}
                />
              )}
            </Avatar.Root>
            <Heading>{name}</Heading>
            <Text>Kulturspektakel Crew</Text>
          </Box>
        </Flex>
        <CardActivities
          data={data?.Order.map((o) => ({
            type: 'order',
            productList: o.OrderItem[0].ProductList?.name!,
            emoji: o.OrderItem[0].ProductList?.emoji ?? null,
            items: o.OrderItem,
            time: o.createdAt,
          }))}
        />
        <InfoText textAlign="center">
          Es kann etwas dauern, bis alle Buchungen vollständig in der Liste
          dargestellt werden.
        </InfoText>
      </VStack>
    </VStack>
  );
}
