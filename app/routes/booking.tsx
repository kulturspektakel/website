import {Outlet} from '@remix-run/react';
import MetaPixel from '~/components/MetaPixel.client';
import {ClientOnly} from 'remix-utils/client-only';

export default function Booking() {
  return (
    <>
      <Outlet />
      <ClientOnly>{() => <MetaPixel />}</ClientOnly>
    </>
  );
}
