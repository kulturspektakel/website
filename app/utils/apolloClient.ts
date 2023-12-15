import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
} from '@apollo/client';

const apolloClient = new ApolloClient({
  cache: new InMemoryCache().restore(
    typeof window !== 'undefined' ? window.__APOLLO_STATE__ : undefined,
  ),
  link: ApolloLink.from([
    new HttpLink({
      uri: 'https://api.kulturspektakel.de/graphql',
      headers: {
        'x-environment': process.env.NODE_ENV,
      },
    }),
  ]),
});

export default apolloClient;
