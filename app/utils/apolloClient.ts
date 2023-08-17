import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
} from '@apollo/client';
import {GraphQLDateTime, GraphQLDate} from 'graphql-scalars';
import type {IntrospectionQuery} from 'graphql';
import {buildClientSchema} from 'graphql';
import introspectionResult from '../types/graphql.schema.json';
import {withScalars} from 'apollo-link-scalars';

const scalarLink = withScalars({
  schema: buildClientSchema(
    introspectionResult as unknown as IntrospectionQuery,
  ),
  typesMap: {
    DateTime: GraphQLDateTime,
    Date: GraphQLDate,
  },
});

const apolloClient = new ApolloClient({
  cache: new InMemoryCache(),
  link: ApolloLink.from([
    scalarLink,
    new HttpLink({uri: 'https://api.kulturspektakel.de/graphql'}),
  ]),
});

export default apolloClient;
