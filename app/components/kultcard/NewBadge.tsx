import {Box, Button, Dialog, Text} from '@chakra-ui/react';
import {useState} from 'react';
import {Badge} from './Badges';
import ConfettiClient from '../booking/Confetti.client';
import {badgeConfig} from '../../utils/badgeConfig';
import {useSearch} from '@tanstack/react-router';

export function useNewlyAwardedBadge(
  cardId: string,
  awarded: Array<{badgeKey: keyof typeof badgeConfig}>,
) {
  const search = useSearch({
    strict: false,
  });
  if (typeof window === 'undefined') {
    return;
  }
  const key = `badges:${cardId}`;
  const oldData = localStorage.getItem(key) || '[]';
  localStorage.setItem(key, JSON.stringify(awarded.map((b) => b.badgeKey)));

  if (search?.badge && awarded.find((a) => a.badgeKey === search.badge)) {
    return search.badge;
  }

  try {
    const badgesData = JSON.parse(oldData) as {
      awarded: Array<keyof typeof badgeConfig>;
    };
    return awarded.find(({badgeKey}) => !badgesData.awarded.includes(badgeKey))
      ?.badgeKey;
  } catch (e) {
    console.error(e);
  }
}

export function NewBadge({type}: {type: keyof typeof badgeConfig}) {
  const badge = badgeConfig[type];
  const [open, setOpen] = useState(true);

  return (
    <>
      <Dialog.Root
        size="xs"
        open={open}
        onOpenChange={(d) => setOpen(d.open)}
        placement="center"
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content textAlign="center">
            <Box mt="-20" w="40%" mx="auto">
              <Badge type={type} />
            </Box>
            <Dialog.CloseTrigger />
            <Dialog.Header pb="0">
              <Dialog.Title w="full" fontSize="2xl">
                <Text fontSize="lg" mb="2">
                  Neuer Badge:
                </Text>
                {badge.name}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body fontSize="md">
              <Text>{badge.description}</Text>
              <Text mt="3">
                Durch deine Käufe an unseren Buden kannst du virtuelle Badges
                sammeln. Wie viele hast du schon?
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={() => setOpen(false)}>OK</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
      {open && (
        <Box zIndex={2000}>
          <ConfettiClient />
        </Box>
      )}
    </>
  );
}
