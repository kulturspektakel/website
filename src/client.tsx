// Sentry must initialize before anything else on the client.
import './instrument.client';

import {StartClient} from '@tanstack/react-start/client';
import {StrictMode, startTransition} from 'react';
import {hydrateRoot} from 'react-dom/client';

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
