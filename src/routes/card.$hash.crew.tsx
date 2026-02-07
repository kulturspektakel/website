import {
  Avatar,
  Box,
  Text,
  defineStyle,
  Flex,
  Heading,
  VStack,
} from '@chakra-ui/react';
import {createFileRoute} from '@tanstack/react-router';
import {seo} from '../utils/seo';
import {useBadges} from '../utils/useBadges';
import {CardDetails} from '../components/kultcard/CardDetails';
import {loader} from '../server/routes/card.$hash.crew';

export const Route = createFileRoute('/card/$hash/crew')({
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

function CrewCard() {
  const {
    crewCard,
    totals,
    cardActivities,
    event,
    cardId,
    validUntil,
    highscores,
  } = Route.useLoaderData();
  const name = crewCard.viewer?.displayName ?? crewCard.nickname;
  const {awardedBadges} = useBadges(cardActivities, event, true);
  totals.Badges = awardedBadges.length;

  return (
    <CardDetails
      infoText={
        'Es kann etwas dauern, bis alle Buchungen vollständig in der Liste dargestellt werden.'
      }
      cardActivities={cardActivities}
      cardId={cardId}
      highscores={highscores}
      cardType="crew"
    >
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
        pb="3"
        maxW="290px"
        w="full"
        mx="auto"
        overflow="hidden"
        mb="8"
      >
        <Box
          w="15%"
          aspectRatio={6}
          bg="offwhite.100"
          borderRadius="full"
          boxShadow="inset"
        />
        <Box w="50%" aspectRatio={1}>
          <Avatar.Root css={ringCss} size="full" background="blue.500">
            <Avatar.Fallback
              name={name ?? '?'}
              fontFamily="Shrimp"
              fontSize="7xl"
              color="white"
            />
            {crewCard.viewer?.profilePicture && (
              <Avatar.Image
                width="auto"
                aspectRatio={1}
                objectFit="cover"
                src={crewCard.viewer.profilePicture}
              />
            )}
          </Avatar.Root>
        </Box>
        <Box textAlign="center">
          <Heading fontSize="3xl">{name ?? 'Unbekannt'}</Heading>
          <Text fontSize="lg" mt="1" opacity="0.5">
            {crewCard.privileged ? 'Bonbude' : 'Kulturspektakel Crew'}
          </Text>
        </Box>
        {(crewCard.suspended || validUntil < new Date()) && (
          <Box
            background="brand.500"
            color="white"
            position="absolute"
            fontWeight="bold"
            textTransform="uppercase"
            transformOrigin="top center"
            transform="translateX(50%) rotate(45deg)"
            top="10"
            right="10"
            fontSize="xl"
            px="20"
          >
            ungültig
          </Box>
        )}
        <VStack gap="2" w="full">
          <Flex direction="row" w="full" mb="3">
            {Object.keys(totals).map((t) => (
              <Flex
                key={t}
                gap="3"
                flexDirection="column"
                textAlign="center"
                flexGrow="1"
                flexBasis="0"
              >
                <Box
                  textTransform="uppercase"
                  opacity="0.5"
                  fontSize="xs"
                  fontWeight="bold"
                >
                  {t}
                </Box>
                <Text mt="-5" fontSize="4xl">
                  {totals[t] ?? 0}
                </Text>
              </Flex>
            ))}
          </Flex>
          <Text fontSize="sm" textAlign="center" opacity="0.5">
            {cardId.match(/.{1,2}/g)?.join(':')}
          </Text>
        </VStack>
      </Flex>
    </CardDetails>
  );
}
