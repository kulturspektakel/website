import useBeforeUnload from 'react-use/lib/useBeforeUnload';

export default function ReloadWarning({dirty}: {dirty: boolean}) {
  useBeforeUnload(dirty, 'Bist du sicher, dass du die Seite verlassen willst?');
  return null;
}
