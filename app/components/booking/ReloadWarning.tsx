import {useEffect} from 'react';

export default function ReloadWarning({
  dirty,
  onUnload,
}: {
  dirty: boolean;
  onUnload: any;
}) {
  useEffect(() => {
    if (dirty) {
      window.addEventListener('beforeunload', onUnload);
      return () => window.removeEventListener('beforeunload', onUnload);
    }
  }, [onUnload, dirty]);

  return null;
}
