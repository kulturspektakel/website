import {MetaDescriptor, Outlet} from '@remix-run/react';
import MetaPixel from '~/components/MetaPixel.client';
import {ClientOnly} from 'remix-utils/client-only';
import {gql} from '@apollo/client';
import {LoaderFunctionArgs} from '@remix-run/node';
import {typedjson} from 'remix-typedjson';
import {dateStringComponents} from '~/components/DateString';
import {BookingQuery, BookingDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import mergeMeta from '~/utils/mergeMeta';

gql`
  query Booking {
    eventsConnection(first: 1, type: Kulturspektakel) {
      edges {
        node {
          id
          name
          start
          end
          bandApplicationStart
          bandApplicationEnd
          djApplicationStart
          djApplicationEnd
        }
      }
    }
  }
`;

export const meta = mergeMeta<typeof loader>(({data}) => {
  const result: MetaDescriptor[] = [
    {
      title: 'Band- und DJ-Bewerbungen',
    },
  ];

  if (data && data?.bandApplicationEnd) {
    result.push({
      name: 'description',
      content: `Die Bewerbungspahse für das ${data.name} läuft bis zum ${
        dateStringComponents({date: new Date(data.bandApplicationEnd)}).date
      }`,
    });
  }
  return result;
});

export async function loader(args: LoaderFunctionArgs) {
  const {data} = await apolloClient.query<BookingQuery>({
    query: BookingDocument,
  });

  const event = data.eventsConnection.edges.at(0)?.node;
  if (!event) {
    throw new Error('No Event found');
  }

  return typedjson(event);
}

export default function Booking() {
  return (
    <>
      <Outlet />
      <ClientOnly>{() => <MetaPixel />}</ClientOnly>
    </>
  );
}
