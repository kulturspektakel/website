import {Button, Dialog, Text} from '@chakra-ui/react';
import {useEffect, useState} from 'react';

const STORAGE_KEY = 'crewCardInfoSeen';

export function CrewCardInfo() {
  const [open, setOpen] = useState(false);

  // Auto-open the first time a CrewCard is scanned on this device.
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) {
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
                Wichtige Info
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body fontSize="md">
              <Text>
                Egal ob du etwas für dich, deine Helfer:inenn, Bands oder andere
                Orgas holst, alles was du holst <strong>muss</strong> auf deine
                CrewCard gebucht werden!
              </Text>
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
