import {Button, Dialog, List} from '@chakra-ui/react';
import {useEffect, useState} from 'react';
import {CREW_CARD_INFO, CREW_CARD_INFO_TITLE} from '../../utils/crewCardInfo';

export function CrewCardInfo({
  autoOpenFor,
}: {
  /**
   * The current event's id: the dialog opens on its own once per event on
   * this device, so the info comes again each festival. Unset: only the
   * button opens it (e.g. over the Wallet pass sheet).
   */
  autoOpenFor?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!autoOpenFor) {
      return;
    }
    const key = `crewCardInfoSeen:${autoOpenFor}`;
    if (localStorage.getItem(key)) {
      return;
    }
    localStorage.setItem(key, '1');
    setOpen(true);
    // Once, for the page as opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
