import {ClientOnly} from '@chakra-ui/react';
import useBeforeUnload from 'react-use/lib/useBeforeUnload';

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
