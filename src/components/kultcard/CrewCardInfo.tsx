import {Button, Dialog, List} from '@chakra-ui/react';
import {useEffect, useState} from 'react';
import {CREW_CARD_INFO, CREW_CARD_INFO_TITLE} from '../../utils/crewCardInfo';

const STORAGE_KEY = 'crewCardInfoSeen';

export function CrewCardInfo({
  autoOpen = true,
}: {
  /**
   * Whether to open on the first visit on this device. Off while something
   * else takes the screen (the Wallet pass sheet); it then opens next time.
   */
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Auto-open the first time a CrewCard is scanned on this device.
  useEffect(() => {
    if (!autoOpen || localStorage.getItem(STORAGE_KEY)) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(true);
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        alignSelf="center"
        onClick={() => setOpen(true)}
      >
        CrewCard Infos
      </Button>
      <Dialog.Root
        size="xs"
        open={open}
        onOpenChange={(d) => setOpen(d.open)}
        placement="center"
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content textAlign="center">
            <Dialog.CloseTrigger />
            <Dialog.Header>
              <Dialog.Title w="full" fontSize="2xl" mb="-2" mt="3">
                {CREW_CARD_INFO_TITLE}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body fontSize="md">
              <List.Root gap="2" textAlign="left" ps="4">
                {CREW_CARD_INFO.map((parts, i) => (
                  <List.Item key={i}>
                    {parts.map(({text, strong}, j) =>
                      strong ? <strong key={j}>{text}</strong> : text,
                    )}
                  </List.Item>
                ))}
              </List.Root>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={() => setOpen(false)}>Verstanden</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
}
