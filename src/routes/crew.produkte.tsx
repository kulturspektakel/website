import {createFileRoute, Outlet, useNavigate} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Stack,
} from '@chakra-ui/react';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {Form, Formik} from 'formik';
import {toFormikValidate} from 'zod-formik-adapter';
import {z} from 'zod';
import {useState} from 'react';
import {prismaClient} from '../server/prismaClient.server';
import {seo} from '../utils/seo';
import {ConnectedField} from '../components/forms/ConnectedField';
import {
  NativeSelectField,
  NativeSelectRoot,
} from '../components/chakra-snippets/native-select';
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../components/chakra-snippets/dialog';

export const listProductLists = createServerFn().handler(async () => {
  return prismaClient.productList.findMany({
    orderBy: {name: 'asc'},
    select: {id: true, name: true, emoji: true, active: true},
  });
});

export const listAdditives = createServerFn().handler(async () => {
  return prismaClient.productAdditives.findMany({
    orderBy: {displayName: 'asc'},
    select: {id: true, displayName: true},
  });
});

const productListInput = z.object({
  name: z.string().trim().min(1, 'Name erforderlich').max(20),
  emoji: z
    .string()
    .trim()
    .max(8)
    .optional()
    .transform((v) => (v ? v : null)),
});

const createProductList = createServerFn()
  .inputValidator(productListInput)
  .handler(async ({data}) => {
    const created = await prismaClient.productList.create({
      data: {name: data.name, emoji: data.emoji},
      select: {id: true},
    });
    return created;
  });

export const Route = createFileRoute('/crew/produkte')({
  component: ProdukteLayout,
  loader: async () => await listProductLists(),
  head: () => seo({title: 'Produkte'}),
});

function ProdukteLayout() {
  const initialLists = Route.useLoaderData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = Route.useParams() as {listId?: string};
  const [createOpen, setCreateOpen] = useState(false);

  const {data: lists} = useQuery({
    queryKey: ['productLists'],
    queryFn: () => listProductLists(),
    initialData: initialLists,
  });

  const createMutation = useMutation({
    mutationFn: (data: z.input<typeof productListInput>) =>
      createProductList({data}),
    onSuccess: async ({id}) => {
      await queryClient.invalidateQueries({queryKey: ['productLists']});
      setCreateOpen(false);
      navigate({to: '/crew/produkte/$listId', params: {listId: String(id)}});
    },
  });

  return (
    <Container maxW="2xl" py="6">
      <Heading size="2xl" mb="4">
        Produkte
      </Heading>
      <HStack mb="6" gap="3">
        <NativeSelectRoot flex="1">
          <NativeSelectField
            placeholder="Liste auswählen…"
            value={params.listId ?? ''}
            onChange={(e) => {
              const value = e.currentTarget.value;
              if (value) {
                navigate({
                  to: '/crew/produkte/$listId',
                  params: {listId: value},
                });
              }
            }}
          >
            {lists.map((list) => (
              <option key={list.id} value={String(list.id)}>
                {list.emoji ? `${list.emoji} ` : ''}
                {list.name}
                {list.active ? '' : ' (inaktiv)'}
              </option>
            ))}
          </NativeSelectField>
        </NativeSelectRoot>
        <Button onClick={() => setCreateOpen(true)}>Neue Liste</Button>
      </HStack>

      <Box>
        <Outlet />
      </Box>

      <DialogRoot
        open={createOpen}
        onOpenChange={(e) => setCreateOpen(e.open)}
        placement="center"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Produktliste</DialogTitle>
          </DialogHeader>
          <Formik
            initialValues={{name: '', emoji: ''}}
            validate={toFormikValidate(productListInput)}
            onSubmit={(values) => createMutation.mutate(values)}
          >
            <Form>
              <DialogBody>
                <Stack gap="4">
                  <ConnectedField name="name" label="Name" required />
                  <ConnectedField
                    name="emoji"
                    label="Emoji"
                    optionalText="optional"
                  />
                </Stack>
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  type="button"
                >
                  Abbrechen
                </Button>
                <Button type="submit" loading={createMutation.isPending}>
                  Erstellen
                </Button>
              </DialogFooter>
            </Form>
          </Formik>
        </DialogContent>
      </DialogRoot>
    </Container>
  );
}
