import {Box, Center, Separator, Button} from '@chakra-ui/react';
import React from 'react';
import Article from '../components/news/Article';
import LinkButton from '../components/LinkButton';
import {createFileRoute, Link} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../utils/prismaClient';
import {markdownPages} from '../utils/markdownText';
import {SpendenBox} from '../components/spenden/box';

export const Route = createFileRoute('/')({
  component: Index,
  loader: async () => await newsLoader(),
});

const newsLoader = createServerFn().handler(async () => {
  const [sum, count, news] = await Promise.all([
    prismaClient.donation.aggregate({
      _sum: {
        amount: true,
      },
    }),
    prismaClient.donation.aggregate({
      _count: {
        id: true,
      },
      where: {
        source: {
          not: 'Other',
        },
      },
    }),
    prismaClient.news.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        title: true,
        slug: true,
        createdAt: true,
        content: true,
      },
    }),
  ]);

  return {
    news: await markdownPages(news),
    total: sum._sum.amount ?? 0,
    count: count._count.id ?? 0,
  };
});

export function Index() {
  const {news, total, count} = Route.useLoaderData();

  return (
    <>
      <Box mb="12" mt="-32">
        <SpendenBox
          donors={count}
          total={total}
          secondaryButton={
            <Link to="/spenden">
              <Button variant="subtle" borderRadius="full" px={['4', '10']}>
                Mehr erfahren
              </Button>
            </Link>
          }
        />
      </Box>
      {news.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Separator width="60%" m="auto" mb="16" />}
          <Article key={item.slug} data={item} mb="12" />
        </React.Fragment>
      ))}
      <Center>
        <LinkButton
          linkOptions={{
            to: '/news/archiv',
          }}
        >
          Ältere Beträge
        </LinkButton>
      </Center>
    </>
  );
}
