import {createFileRoute, Link} from '@tanstack/react-router';
import {Box, Heading, HStack, IconButton, Span, Stack, Text} from '@chakra-ui/react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {formatDistanceToNow} from 'date-fns';
import {de} from 'date-fns/locale';
import {FaChevronRight, FaPlus} from 'react-icons/fa6';
import {listProductLists} from './crew.produkte';
import {BudeDialog} from '../components/produkte/BudeDialog';

type ProductListItem = Awaited<ReturnType<typeof listProductLists>>[number];

export const Route = createFileRoute('/crew/produkte/')({
  loader: async () => await listProductLists(),
  component: ProductListsManager,
});

function ProductListsManager() {
  const initial = Route.useLoaderData();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const {data: lists} = useQuery({
    queryKey: ['productLists'],
    queryFn: () => listProductLists(),
    initialData: initial,
  });

  const active = lists.filter((l) => l.active);
  const inactive = lists.filter((l) => !l.active);

  return (
    <Box>
      <HStack justify="space-between" mb="6">
        <Heading size="2xl">Buden</Heading>
        <IconButton
          aria-label="Neue Bude"
          borderRadius="full"
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          <FaPlus />
        </IconButton>
      </HStack>

      <Stack gap="2">
        {active.map((list) => (
          <ListRow key={list.id} list={list} />
        ))}
      </Stack>

      {inactive.length > 0 && (
        <>
          <Heading size="md" color="fg.muted" mt="8" mb="3">
            Inaktiv
          </Heading>
          <Stack gap="2">
            {inactive.map((list) => (
              <ListRow key={list.id} list={list} />
            ))}
          </Stack>
        </>
      )}

      <BudeDialog
        open={createOpen}
        list={null}
        onClose={() => setCreateOpen(false)}
        onSaved={async () => {
          await queryClient.invalidateQueries({queryKey: ['productLists']});
          setCreateOpen(false);
        }}
      />
    </Box>
  );
}

function ListRow({list}: {list: ProductListItem}) {
  return (
    <HStack
      asChild
      borderWidth="1px"
      borderRadius="md"
      p="3"
      gap="3"
      cursor="pointer"
      _hover={{bg: 'bg.muted'}}
    >
      <Link to="/crew/produkte/$listId" params={{listId: String(list.id)}}>
        <HStack flex="1" gap="3" opacity={list.active ? undefined : 0.5}>
          {list.emoji && <Span fontSize="2xl">{list.emoji}</Span>}
          <Box>
            <Text fontWeight="medium">{list.name}</Text>
            {list.updatedAt && (
              <Text fontSize="sm" color="fg.muted" suppressHydrationWarning>
                Bearbeitet{' '}
                {formatDistanceToNow(new Date(list.updatedAt), {
                  addSuffix: true,
                  locale: de,
                })}
                {list.updatedByName && ` von ${list.updatedByName}`}
              </Text>
            )}
          </Box>
        </HStack>
        <Span color="fg.muted">
          <FaChevronRight />
        </Span>
      </Link>
    </HStack>
  );
}
