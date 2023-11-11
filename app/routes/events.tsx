import {gql} from '@apollo/client';
import {
  Heading,
  ListItem,
  OrderedList,
  Box,
  Link as ChakraLink,
  Stack,
  Divider,
  SimpleGrid,
  Wrap,
} from '@chakra-ui/react';
import type {LoaderArgs} from '@remix-run/node';
import {Link} from '@remix-run/react';
import {$path} from 'remix-routes';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import DateString from '~/components/DateString';
import Mark from '~/components/Mark';
import type {EventsQuery} from '~/types/graphql';
import {EventsDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import {Gallery, Item} from 'react-photoswipe-gallery';
import Image from '~/components/Image';

gql`
  query Events {
    events(limit: 10) {
      id
      name
      description
      start
      end
      poster {
        thumbnail: scaledUri(width: 200)
        large: scaledUri(width: 1200)
        width
        height
        copyright
      }
      bandsPlaying {
        totalCount
        edges {
          node {
            name
          }
        }
      }
      media(first: 20) {
        edges {
          node {
            id
            ... on PixelImage {
              thumbnail: scaledUri(width: 140)
              large: scaledUri(width: 1200)
            }
          }
        }
      }
    }
  }
`;

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<EventsQuery>({
    query: EventsDocument,
  });
  return typedjson({data});
}

export default function Events() {
  const {data} = useTypedLoaderData<typeof loader>();
  return (
    <>
      <Heading as="h1" textAlign="center">
        Veranstaltungen
      </Heading>
      <OrderedList listStyleType="none" m="0" mt="20">
        <Gallery withCaption>
          {data.events
            // only show past events
            .filter((e) => e.start.getTime() < new Date().getTime())
            .map((e, i) => (
              <ListItem key={e.id}>
                {i > 0 && <Divider m="16" />}
                <Box textAlign="center">
                  <Heading size="lg" mb="1">
                    {e.name}
                  </Heading>
                  <Mark>
                    <DateString date={e.start} to={e.end} />
                  </Mark>
                </Box>
                <Stack
                  direction={['column', 'row']}
                  spacing="5"
                  mt="5"
                  align={['center', 'flex-start']}
                >
                  {e.poster && (
                    <Item
                      original={e.poster.large}
                      thumbnail={e.poster.thumbnail}
                      width={e.poster.width}
                      height={e.poster.height}
                      caption={e.poster.copyright ?? undefined}
                      key={e.id}
                    >
                      {({ref, open}) => (
                        <Image
                          onClick={open}
                          w="200px"
                          ref={ref as React.MutableRefObject<HTMLImageElement>}
                          src={e.poster!.thumbnail}
                          role="link"
                          tabIndex={0}
                          alt={`Poster von ${e.name}`}
                          onKeyDown={(e) => e?.key === 'Enter' && open(e)}
                        />
                      )}
                    </Item>
                  )}
                  <Box>
                    {e.description && <Box>{e.description}</Box>}
                    {e.bandsPlaying.totalCount > 0 && (
                      <>
                        <Heading as="h3" size="md" mb="2">
                          Lineup
                        </Heading>
                        <Box>
                          {e.bandsPlaying.edges
                            .map((b) => b.node.name)
                            .join(', ')}
                          <ChakraLink
                            color="brand.500"
                            as={Link}
                            to={$path('/lineup/:year', {
                              year: e.start.getFullYear(),
                            })}
                          >
                            Lineup
                          </ChakraLink>
                        </Box>
                      </>
                    )}
                    {e.media.edges.length > 0 && (
                      <>
                        <Heading as="h3" size="md" mt="4" mb="2">
                          Fotos
                        </Heading>
                        <Wrap role="grid">
                          <Gallery>
                            {e.media.edges
                              .map((m) => m.node)
                              .map((m) => (
                                <Item
                                  key={m.id}
                                  original={m.large}
                                  thumbnail={m.thumbnail}
                                >
                                  {({ref, open}) => (
                                    <Image
                                      src={m.thumbnail}
                                      onClick={open}
                                      ref={ref}
                                      aspectRatio={1}
                                      objectFit="cover"
                                      width="70"
                                      height="70"
                                      borderRadius="md"
                                    />
                                  )}
                                </Item>
                              ))}
                          </Gallery>
                        </Wrap>
                      </>
                    )}
                  </Box>
                </Stack>
              </ListItem>
            ))}
        </Gallery>
      </OrderedList>
    </>
  );
}
