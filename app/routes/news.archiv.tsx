import {Box, Heading, SimpleGrid, Image, Center} from '@chakra-ui/react';
import {createFileRoute} from '@tanstack/react-router';
import React, {useMemo} from 'react';
import Card from '../components/Card';
import {Button} from '../components/chakra-snippets/button';
import DateString from '../components/DateString';
import Mark from '../components/Mark';
import {createServerFn, useServerFn} from '@tanstack/react-start';
import {prismaClient} from '../utils/prismaClient';
import {markdownPages} from '../utils/markdownText';
import {imageUrl} from '../utils/directusImage';
import {useInfiniteQuery} from '@tanstack/react-query';
import Markdown from 'markdown-to-jsx';

const PAGE_SIZE = 30;

export const Route = createFileRoute('/news/archiv')({
  component: NewsArchive,
  loader: async () => await loader(),
  head: () => ({
    meta: [
      {
        title: 'Newsarchiv',
      },
    ],
  }),
});

const loader = createServerFn()
  .validator((cursor: string | undefined) => cursor)
  .handler(async ({data: cursor}) => {
    const data = await prismaClient.news.findMany({
      select: {
        title: true,
        content: true,
        slug: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: PAGE_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? {slug: cursor} : undefined,
    });

    return await markdownPages(data);
  });

export default function NewsArchive() {
  const initialData = Route.useLoaderData();
  const queryFn = useServerFn(loader);
  const {data, isFetchingNextPage, fetchNextPage} = useInfiniteQuery({
    queryKey: ['news'],
    queryFn: ({pageParam}) => queryFn({data: pageParam}),
    getNextPageParam: (lastPage) =>
      lastPage.length ? lastPage[lastPage.length - 1].slug : undefined,
    initialPageParam: undefined,
    initialData: {
      pages: [initialData],
      pageParams: [undefined],
    },
  });

  const hasNextPage = data?.pages[data.pages.length - 1].length === PAGE_SIZE;

  const news = useMemo(() => {
    const flatData = data?.pages.flat() ?? [];
    const years =
      // group data by year
      flatData.reduce((acc, d) => {
        const year = d.createdAt.getFullYear();
        if (acc.has(year)) {
          acc.get(year)?.push(d);
        } else {
          acc.set(year, [d]);
        }
        return acc;
      }, new Map<number, typeof flatData>()) ?? [];

    return Array.from(years.entries()).sort(([a], [b]) => b - a);
  }, [data]);

  return (
    <>
      {news.map(([year, news]) => (
        <React.Fragment key={year}>
          <Heading size="3xl" textAlign="center" mb="10">
            {year}
          </Heading>
          <SimpleGrid columns={[2, 2, 3]} gap={4} key={year} mb="10">
            {news.map((node) => (
              <Card
                key={node.slug}
                href={`/news/${node.slug}`}
                aspectRatio={1}
                bgSize="cover"
                bgPosition="center"
              >
                <Box
                  position="absolute"
                  top="0"
                  left="0"
                  right="0"
                  bottom="0"
                  p="4"
                  bgImage={
                    node.content?.images.length
                      ? 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.3))'
                      : undefined
                  }
                  zIndex={2}
                >
                  <Mark ml="0.5">
                    <DateString date={node.createdAt} />
                  </Mark>
                  <Heading
                    size={['lg', '2xl', '2xl']}
                    hyphens="auto"
                    color={node.content?.images.length ? 'white' : undefined}
                    mt="1"
                    lineClamp={5}
                  >
                    {node.title}
                  </Heading>
                </Box>
                <Image
                  position="absolute"
                  width="100%"
                  height="100%"
                  src={
                    imageUrl(node.content?.images[0]?.id, {width: 200}) ??
                    '/fallback.svg'
                  }
                  loading="lazy"
                  objectFit="cover"
                />
              </Card>
            ))}
          </SimpleGrid>
        </React.Fragment>
      ))}
      {hasNextPage && (
        <Center p="10">
          <Button onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
            ältere Artikel
          </Button>
        </Center>
      )}
    </>
  );
}
