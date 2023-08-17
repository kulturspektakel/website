import React, {useEffect} from 'react';
import {HStack, Heading, Spacer, Divider, Box} from '@chakra-ui/react';

export default function BookingPage({children}: {children: React.ReactNode}) {
  // useEffect(() => {
  //   const source = query['utm_source'];
  //   if (
  //     typeof window !== 'undefined' &&
  //     !window.sessionStorage.getItem('utm_source') &&
  //     source
  //   ) {
  //     window.sessionStorage.setItem('utm_source', String(source));
  //   }
  // }, []);

  return (
    <>
      <HStack mb="5">
        <Heading size="lg">Bewerbungen</Heading>
        <Spacer />
      </HStack>
      <Divider mb="5" />
      {children}
    </>
  );
}
