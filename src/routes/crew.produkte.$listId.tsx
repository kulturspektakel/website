import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  IconButton,
  Span,
  Stack,
  Text,
} from '@chakra-ui/react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Form, Formik, useField} from 'formik';
import {toFormikValidate} from 'zod-formik-adapter';
import {z} from 'zod';
import {useEffect, useState} from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {FaGripVertical, FaPen, FaTrash} from 'react-icons/fa6';
import {prismaClient} from '../server/prismaClient.server';
import {formatCents, parseEuroToCents} from '../utils/currency';
import {listAdditives} from './crew.produkte';
import {ConnectedField} from '../components/forms/ConnectedField';
import {ConnectedCheckbox} from '../components/forms/ConnectedCheckbox';
import {Field} from '../components/chakra-snippets/field';
import {Checkbox} from '../components/chakra-snippets/checkbox';
import {Switch} from '../components/chakra-snippets/switch';
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

// ---------------------------------------------------------------------------
// Enums & labels
// ---------------------------------------------------------------------------

const DIET_VALUES = ['OMNIVORE', 'VEGETARIAN', 'VEGAN'] as const;
const AGE_VALUES = ['NONE', 'AGE_16', 'AGE_18'] as const;

const DIET_LABELS: Record<(typeof DIET_VALUES)[number], string> = {
  OMNIVORE: 'Omnivor',
  VEGETARIAN: 'Vegetarisch',
  VEGAN: 'Vegan',
};
const AGE_LABELS: Record<(typeof AGE_VALUES)[number], string> = {
  NONE: 'keine',
  AGE_16: 'ab 16',
  AGE_18: 'ab 18',
};

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

const getProductList = createServerFn()
  .inputValidator((listId: string) => listId)
  .handler(async ({data: listId}) => {
    const id = Number(listId);
    if (!Number.isInteger(id)) {
      throw notFound();
    }
    const list = await prismaClient.productList.findUnique({
      where: {id},
      select: {
        id: true,
        name: true,
        emoji: true,
        active: true,
        product: {
          orderBy: {order: 'asc'},
          select: {
            id: true,
            name: true,
            price: true,
            order: true,
            requiresDeposit: true,
            diet: true,
            minimumAge: true,
            additives: {select: {id: true, displayName: true}},
          },
        },
      },
    });
    if (!list) {
      throw notFound();
    }
    return list;
  });

const productListInput = z.object({
  id: z.number().int(),
  name: z.string().trim().min(1).max(20),
  emoji: z
    .string()
    .trim()
    .max(8)
    .nullable()
    .transform((v) => (v ? v : null)),
  active: z.boolean(),
});

const updateProductList = createServerFn()
  .inputValidator(productListInput)
  .handler(async ({data}) => {
    await prismaClient.productList.update({
      where: {id: data.id},
      data: {
        name: data.name,
        emoji: data.emoji,
        active: data.active,
        updatedAt: new Date(),
      },
    });
  });

const productFields = z.object({
  name: z.string().trim().min(1).max(30),
  price: z.number().int().min(0),
  requiresDeposit: z.boolean(),
  diet: z.enum(DIET_VALUES).nullable(),
  minimumAge: z.enum(AGE_VALUES),
  additiveIds: z.array(z.string()),
});

const createProduct = createServerFn()
  .inputValidator(productFields.extend({productListId: z.number().int()}))
  .handler(async ({data}) => {
    const max = await prismaClient.product.aggregate({
      where: {productListId: data.productListId},
      _max: {order: true},
    });
    await prismaClient.product.create({
      data: {
        productListId: data.productListId,
        name: data.name,
        price: data.price,
        order: (max._max.order ?? -1) + 1,
        requiresDeposit: data.requiresDeposit,
        diet: data.diet,
        minimumAge: data.minimumAge,
        additives: {connect: data.additiveIds.map((id) => ({id}))},
      },
    });
  });

const updateProduct = createServerFn()
  .inputValidator(productFields.extend({id: z.number().int()}))
  .handler(async ({data}) => {
    await prismaClient.product.update({
      where: {id: data.id},
      data: {
        name: data.name,
        price: data.price,
        requiresDeposit: data.requiresDeposit,
        diet: data.diet,
        minimumAge: data.minimumAge,
        additives: {set: data.additiveIds.map((id) => ({id}))},
      },
    });
  });

const deleteProduct = createServerFn()
  .inputValidator((id: number) => id)
  .handler(async ({data: id}) => {
    await prismaClient.product.delete({where: {id}});
  });

const reorderProducts = createServerFn()
  .inputValidator(
    z.object({
      productListId: z.number().int(),
      orderedIds: z.array(z.number().int()),
    }),
  )
  .handler(async ({data}) => {
    await prismaClient.$transaction(
      data.orderedIds.map((id, index) =>
        prismaClient.product.update({
          where: {id},
          data: {order: index},
        }),
      ),
    );
  });

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/crew/produkte/$listId')({
  component: ProductListEditor,
  loader: async ({params}) => await getProductList({data: params.listId}),
});

type ListData = Awaited<ReturnType<typeof getProductList>>;
type ProductData = ListData['product'][number];

function ProductListEditor() {
  const {listId} = Route.useParams();
  const initial = Route.useLoaderData();
  const queryClient = useQueryClient();

  const {data: list} = useQuery({
    queryKey: ['productList', listId],
    queryFn: () => getProductList({data: listId}),
    initialData: initial,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({queryKey: ['productList', listId]});

  return (
    <Stack gap="8">
      <ListSettings
        key={list.id}
        list={list}
        onSaved={async () => {
          await invalidate();
          await queryClient.invalidateQueries({queryKey: ['productLists']});
        }}
      />
      <Products listId={list.id} products={list.product} onChanged={invalidate} />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// List settings
// ---------------------------------------------------------------------------

function ListSettings({
  list,
  onSaved,
}: {
  list: ListData;
  onSaved: () => Promise<void> | void;
}) {
  const mutation = useMutation({
    mutationFn: (data: z.input<typeof productListInput>) =>
      updateProductList({data}),
    onSuccess: () => onSaved(),
  });

  return (
    <Box>
      <Heading size="md" mb="3">
        Listeneinstellungen
      </Heading>
      <Formik
        initialValues={{
          id: list.id,
          name: list.name,
          emoji: list.emoji ?? '',
          active: list.active,
        }}
        validate={toFormikValidate(productListInput)}
        onSubmit={(values) => mutation.mutate(values)}
      >
        {({values, setFieldValue}) => (
          <Form>
            <Stack gap="4">
              <HStack gap="4" align="flex-end">
                <Box flex="1">
                  <ConnectedField name="name" label="Name" required />
                </Box>
                <Box w="32">
                  <ConnectedField
                    name="emoji"
                    label="Emoji"
                    optionalText="optional"
                  />
                </Box>
              </HStack>
              <Switch
                checked={values.active}
                onCheckedChange={(e) => setFieldValue('active', e.checked)}
              >
                Liste aktiv
              </Switch>
              <Box>
                <Button type="submit" loading={mutation.isPending}>
                  Speichern
                </Button>
              </Box>
            </Stack>
          </Form>
        )}
      </Formik>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

function Products({
  listId,
  products,
  onChanged,
}: {
  listId: number;
  products: ProductData[];
  onChanged: () => Promise<void> | void;
}) {
  const [ordered, setOrdered] = useState(products);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogProduct, setDialogProduct] = useState<ProductData | null>(null);

  useEffect(() => {
    setOrdered(products);
  }, [products]);

  const sensors = useSensors(useSensor(PointerSensor));

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) =>
      reorderProducts({data: {productListId: listId, orderedIds}}),
    onSuccess: () => onChanged(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProduct({data: id}),
    onSuccess: () => onChanged(),
  });

  const onDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((p) => p.id === Number(active.id));
    const newIndex = ordered.findIndex((p) => p.id === Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next);
    reorderMutation.mutate(next.map((p) => p.id));
  };

  return (
    <Box>
      <HStack justify="space-between" mb="3">
        <Heading size="md">Produkte</Heading>
        <Button
          size="sm"
          onClick={() => {
            setDialogProduct(null);
            setDialogOpen(true);
          }}
        >
          Produkt hinzufügen
        </Button>
      </HStack>

      {ordered.length === 0 ? (
        <Text color="fg.muted">Noch keine Produkte.</Text>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={ordered.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <Stack gap="2">
              {ordered.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  onEdit={() => {
                    setDialogProduct(product);
                    setDialogOpen(true);
                  }}
                  onDelete={() => {
                    if (
                      window.confirm(`„${product.name}" wirklich löschen?`)
                    ) {
                      deleteMutation.mutate(product.id);
                    }
                  }}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}

      <ProductDialog
        open={dialogOpen}
        listId={listId}
        product={dialogProduct}
        onClose={() => setDialogOpen(false)}
        onSaved={async () => {
          await onChanged();
          setDialogOpen(false);
        }}
      />
    </Box>
  );
}

function ProductRow({
  product,
  onEdit,
  onDelete,
}: {
  product: ProductData;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({id: product.id});

  return (
    <HStack
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      borderWidth="1px"
      borderRadius="md"
      p="2"
      gap="3"
      bg="bg"
    >
      <IconButton
        aria-label="Verschieben"
        variant="ghost"
        size="sm"
        cursor="grab"
        {...attributes}
        {...listeners}
      >
        <FaGripVertical />
      </IconButton>
      <Box flex="1">
        <Text fontWeight="medium">{product.name}</Text>
        <HStack gap="2" mt="1">
          {product.requiresDeposit && <Badge colorPalette="orange">Pfand</Badge>}
          {product.diet && (
            <Badge colorPalette="green">{DIET_LABELS[product.diet]}</Badge>
          )}
          {product.minimumAge !== 'NONE' && (
            <Badge colorPalette="red">{AGE_LABELS[product.minimumAge]}</Badge>
          )}
          {product.additives.length > 0 && (
            <Badge variant="surface">
              {product.additives.length} Zusatzstoffe
            </Badge>
          )}
        </HStack>
      </Box>
      <Span fontWeight="medium">{formatCents(product.price)}</Span>
      <IconButton
        aria-label="Bearbeiten"
        variant="ghost"
        size="sm"
        onClick={onEdit}
      >
        <FaPen />
      </IconButton>
      <IconButton
        aria-label="Löschen"
        variant="ghost"
        size="sm"
        colorPalette="red"
        onClick={onDelete}
      >
        <FaTrash />
      </IconButton>
    </HStack>
  );
}

// ---------------------------------------------------------------------------
// Product create/edit dialog
// ---------------------------------------------------------------------------

const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Name erforderlich').max(30),
  price: z
    .string()
    .refine((v) => parseEuroToCents(v) !== null, 'Ungültiger Preis'),
  requiresDeposit: z.boolean(),
  diet: z.string(),
  minimumAge: z.enum(AGE_VALUES),
  additiveIds: z.array(z.string()),
});

function ProductDialog({
  open,
  listId,
  product,
  onClose,
  onSaved,
}: {
  open: boolean;
  listId: number;
  product: ProductData | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const {data: additives} = useQuery({
    queryKey: ['additives'],
    queryFn: () => listAdditives(),
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof productFormSchema>) => {
      const payload = {
        name: values.name,
        price: parseEuroToCents(values.price)!,
        requiresDeposit: values.requiresDeposit,
        diet: (values.diet || null) as
          | (typeof DIET_VALUES)[number]
          | null,
        minimumAge: values.minimumAge,
        additiveIds: values.additiveIds,
      };
      return product
        ? updateProduct({data: {...payload, id: product.id}})
        : createProduct({data: {...payload, productListId: listId}});
    },
    onSuccess: () => onSaved(),
  });

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
      size="lg"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {product ? 'Produkt bearbeiten' : 'Neues Produkt'}
          </DialogTitle>
        </DialogHeader>
        {open && (
        <Formik
          initialValues={{
            name: product?.name ?? '',
            price: product ? (product.price / 100).toFixed(2) : '',
            requiresDeposit: product?.requiresDeposit ?? false,
            diet: product?.diet ?? '',
            minimumAge: product?.minimumAge ?? 'NONE',
            additiveIds: product?.additives.map((a) => a.id) ?? [],
          }}
          validate={toFormikValidate(productFormSchema)}
          onSubmit={(values) => mutation.mutate(values)}
        >
          <Form>
            <DialogBody>
              <Stack gap="4">
                <ConnectedField name="name" label="Name" required />
                <ConnectedField
                  name="price"
                  label="Preis (€)"
                  inputMode="decimal"
                  required
                />
                <ConnectedCheckbox
                  name="requiresDeposit"
                  label="Pfandpflichtig"
                />
                <FormSelect name="diet" label="Ernährung">
                  <option value="">keine Angabe</option>
                  {DIET_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {DIET_LABELS[v]}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect name="minimumAge" label="Altersbeschränkung">
                  {AGE_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {AGE_LABELS[v]}
                    </option>
                  ))}
                </FormSelect>
                <AdditivesField additives={additives ?? []} />
              </Stack>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>
                Abbrechen
              </Button>
              <Button type="submit" loading={mutation.isPending}>
                Speichern
              </Button>
            </DialogFooter>
          </Form>
        </Formik>
        )}
      </DialogContent>
    </DialogRoot>
  );
}

function FormSelect({
  name,
  label,
  children,
}: {
  name: string;
  label: string;
  children: React.ReactNode;
}) {
  const [field] = useField(name);
  return (
    <Field label={label}>
      <NativeSelectRoot>
        <NativeSelectField {...field}>{children}</NativeSelectField>
      </NativeSelectRoot>
    </Field>
  );
}

function AdditivesField({
  additives,
}: {
  additives: Array<{id: string; displayName: string}>;
}) {
  const [field, , helpers] = useField<string[]>('additiveIds');
  const selected = new Set(field.value);

  return (
    <Field label="Zusatzstoffe">
      <Stack gap="1" maxH="48" overflowY="auto" w="full">
        {additives.map((additive) => (
          <Checkbox
            key={additive.id}
            checked={selected.has(additive.id)}
            onCheckedChange={(e) => {
              const next = new Set(field.value);
              if (e.checked) {
                next.add(additive.id);
              } else {
                next.delete(additive.id);
              }
              helpers.setValue([...next]);
            }}
          >
            {additive.displayName}
          </Checkbox>
        ))}
      </Stack>
    </Field>
  );
}
