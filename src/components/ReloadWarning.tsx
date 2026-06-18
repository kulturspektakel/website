import {ClientOnly} from '@chakra-ui/react';
import {useCallback, useEffect} from 'react';

function useBeforeUnload(enabled: boolean, message?: string) {
  const handler = useCallback(
    (event: BeforeUnloadEvent) => {
      if (!enabled) {
        return;
      }
      event.preventDefault();
      if (message) {
        event.returnValue = message;
      }
      return message;
    },
    [enabled, message],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled, handler]);
}

function ClientWarning({dirty}: {dirty: boolean}) {
  useBeforeUnload(dirty, 'Bist du sicher, dass du die Seite verlassen willst?');
  return null;
}

export default function ReloadWarning({dirty}: {dirty: boolean}) {
  return (
    <ClientOnly>
      <ClientWarning dirty={dirty} />
    </ClientOnly>
  );
}
