import {Box, Heading, Image} from '@chakra-ui/react';
import {useLocation} from '@remix-run/react';
import Logo from '../../public/logo.svg';
import DateString from './DateString';
import {gql} from '@apollo/client';
import type {LoaderArgs} from '@remix-run/node';
import apolloClient from '~/utils/apolloClient';
import {EVENT_ID} from '~/routes/booking._index';
import {HeaderDocument} from '~/types/graphql';
import type {HeaderQuery} from '~/types/graphql';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';

export default function Header() {
  const data = useTypedLoaderData<typeof loader>();
  console.log('hee', data);
  const isHome = useLocation().pathname === '/';
  return (
    <Box as="header" bgColor="teal.600" h={isHome ? '32' : '12'}>
      <Image src={Logo} width={22} />
      <Heading as="h1">Kulturspektakel Gauting</Heading>
      <DateString date={new Date()} />
    </Box>
  );
}
