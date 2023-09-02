import {Box, Heading, Image} from '@chakra-ui/react';
import {useLocation} from '@remix-run/react';
// import Logo from '../../public/logo.svg';
import DateString from './DateString';
import {gql} from '@apollo/client';
import type {LoaderArgs} from '@remix-run/node';
import apolloClient from '~/utils/apolloClient';
import {EVENT_ID} from '~/routes/booking._index';
import {HeaderDocument} from '~/types/graphql';
import type {HeaderQuery} from '~/types/graphql';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import Logo from './Header.webp';

export default function Header(props: {start: Date; end: Date}) {
  const data = useTypedLoaderData<typeof loader>();
  console.log('hee', data);
  const isHome = useLocation().pathname === '/';
  return (
    <Box as="header" bgColor="#100A28" h={isHome ? '400' : '90'} bgImage={Logo}>
      <Heading as="h1">Kulturspektakel Gauting</Heading>
      <DateString date={new Date('2022-01-01')} />
      Angebot
    </Box>
  );
}
