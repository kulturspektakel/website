import {gql} from '@apollo/client';
import type {LoaderFunctionArgs} from '@remix-run/node';
import {$path} from 'remix-routes';
import {redirect} from 'remix-typedjson';
import type {LineupIndexQuery} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import type {SitemapFunction} from 'remix-sitemap';

export async function loader(args: LoaderFunctionArgs) {
  const {data} = await apolloClient.query<LineupIndexQuery>({
    query: gql`
      query LineupIndex {
        eventsConnection(
          first: 1
          hasBandsPlaying: true
          type: Kulturspektakel
        ) {
          edges {
            node {
              start
            }
          }
        }
      }
    `,
  });
  throw redirect(
    $path('/lineup/:year', {
      year: data.eventsConnection.edges[0]?.node.start.getFullYear(),
    }),
  );
}

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});
