import {createFileRoute, notFound, useBlocker} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Span,
  Stack,
  Text,
} from '@chakra-ui/react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Form, Formik, useField} from 'formik';
import {toFormikValidate} from 'zod-formik-adapter';
import {z} from 'zod';
import {useEffect, useMemo, useRef, useState} from 'react';
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

/**
 * Persist the whole desired product list in one transaction: products with an
 * `id` are updated, those without are created, and any existing product missing
 * from the payload is deleted. `order` is taken from the array position, so a
 * reorder is just a different array order. This mirrors the deferred-edit UI,
 * where add/edit/delete/reorder are staged client-side and committed at once.
 */
const saveProducts = createServerFn()
  .inputValidator(
    z.object({
      productListId: z.number().int(),
      products: z.array(productFields.extend({id: z.number().int().nullable()})),
    }),
  )
  .handler(async ({data}) => {
    const existing = await prismaClient.product.findMany({
      where: {productListId: data.productListId},
      select: {id: true},
    });
    const keep = new Set(
      data.products.flatMap((p) => (p.id == null ? [] : [p.id])),
    );
    const toDelete = existing
      .filter((e) => !keep.has(e.id))
      .map((e) => e.id);

    await prismaClient.$transaction([
      ...(toDelete.length
        ? [prismaClient.product.deleteMany({where: {id: {in: toDelete}}})]
        : []),
      ...data.products.map((p, index) =>
        p.id == null
          ? prismaClient.product.create({
              data: {
                productListId: data.productListId,
                name: p.name,
                price: p.price,
                order: index,
                requiresDeposit: p.requiresDeposit,
                diet: p.diet,
                minimumAge: p.minimumAge,
                additives: {connect: p.additiveIds.map((id) => ({id}))},
              },
            })
          : prismaClient.product.update({
              where: {id: p.id},
              data: {
                name: p.name,
                price: p.price,
                order: index,
                requiresDeposit: p.requiresDeposit,
                diet: p.diet,
                minimumAge: p.minimumAge,
                additives: {set: p.additiveIds.map((id) => ({id}))},
              },
            }),
      ),
    ]);
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
      <Products
        key={list.id}
        listId={list.id}
        products={list.product}
        onSaved={invalidate}
      />
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

/**
 * Client-side working copy of a product. `id` is `null` for products that have
 * been added but not yet saved; `key` is a stable identifier for React/dnd-kit
 * that survives reorders (and exists for unsaved products that have no `id`).
 */
type DraftProduct = {
  key: string;
  id: number | null;
  name: string;
  price: number;
  requiresDeposit: boolean;
  diet: (typeof DIET_VALUES)[number] | null;
  minimumAge: (typeof AGE_VALUES)[number];
  additiveIds: string[];
};

type DraftValues = Omit<DraftProduct, 'key' | 'id'>;

function toDraft(p: ProductData): DraftProduct {
  return {
    key: `p${p.id}`,
    id: p.id,
    name: p.name,
    price: p.price,
    requiresDeposit: p.requiresDeposit,
    diet: p.diet,
    minimumAge: p.minimumAge,
    additiveIds: p.additives.map((a) => a.id),
  };
}

// Order-sensitive fingerprint used to detect unsaved changes.
function fingerprint(draft: DraftProduct[]): string {
  return JSON.stringify(
    draft.map((d) => ({
      id: d.id,
      name: d.name,
      price: d.price,
      requiresDeposit: d.requiresDeposit,
      diet: d.diet,
      minimumAge: d.minimumAge,
      additiveIds: [...d.additiveIds].sort(),
    })),
  );
}

function Products({
  listId,
  products,
  onSaved,
}: {
  listId: number;
  products: ProductData[];
  onSaved: () => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<DraftProduct[]>(() =>
    products.map(toDraft),
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const tempSeq = useRef(0);
  const justDragged = useRef(false);

  useEffect(() => {
    setDraft(products.map(toDraft));
  }, [products]);

  const saved = useMemo(() => fingerprint(products.map(toDraft)), [products]);
  const dirty = fingerprint(draft) !== saved;

  // Warn before navigating away (incl. switching lists) or unloading with
  // unsaved changes.
  useBlocker({
    disabled: !dirty,
    enableBeforeUnload: () => dirty,
    shouldBlockFn: () =>
      !window.confirm('Es gibt ungespeicherte Änderungen. Verwerfen?'),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      saveProducts({
        data: {
          productListId: listId,
          products: draft.map((d) => ({
            id: d.id,
            name: d.name,
            price: d.price,
            requiresDeposit: d.requiresDeposit,
            diet: d.diet,
            minimumAge: d.minimumAge,
            additiveIds: d.additiveIds,
          })),
        },
      }),
    onSuccess: () => onSaved(),
  });

  const onDragEnd = (event: DragEndEvent) => {
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
    }, 50);
    const {active, over} = event;
    if (!over || active.id === over.id) return;
    setDraft((cur) => {
      const oldIndex = cur.findIndex((p) => p.key === active.id);
      const newIndex = cur.findIndex((p) => p.key === over.id);
      if (oldIndex < 0 || newIndex < 0) return cur;
      return arrayMove(cur, oldIndex, newIndex);
    });
  };

  const editing = draft.find((d) => d.key === editingKey) ?? null;

  const applyDialog = (values: DraftValues) => {
    setDraft((cur) =>
      editingKey == null
        ? [...cur, {key: `new${tempSeq.current++}`, id: null, ...values}]
        : cur.map((d) => (d.key === editingKey ? {...d, ...values} : d)),
    );
    setDialogOpen(false);
  };

  const deleteDialog = () => {
    setDraft((cur) => cur.filter((d) => d.key !== editingKey));
    setDialogOpen(false);
  };

  return (
    <Box>
      <Heading size="md" mb="3">
        Produkte
      </Heading>

      {draft.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={draft.map((p) => p.key)}
            strategy={verticalListSortingStrategy}
          >
            <Stack gap="2" mb="3">
              {draft.map((product, index) => (
                <ProductRow
                  key={product.key}
                  product={product}
                  position={index + 1}
                  onEdit={() => {
                    if (justDragged.current) return;
                    setEditingKey(product.key);
                    setDialogOpen(true);
                  }}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}

      <Button
        variant="outline"
        w="full"
        mb="6"
        onClick={() => {
          setEditingKey(null);
          setDialogOpen(true);
        }}
      >
        Produkt hinzufügen
      </Button>

      <Button
        onClick={() => saveMutation.mutate()}
        loading={saveMutation.isPending}
        disabled={!dirty}
      >
        Speichern
      </Button>

      <ProductDialog
        open={dialogOpen}
        product={editing}
        onCancel={() => setDialogOpen(false)}
        onSave={applyDialog}
        onDelete={editing ? deleteDialog : undefined}
      />
    </Box>
  );
}

function ProductRow({
  product,
  position,
  onEdit,
}: {
  product: DraftProduct;
  position: number;
  onEdit: () => void;
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({id: product.key});

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
      cursor="grab"
      _hover={{bg: 'bg.muted'}}
      onClick={onEdit}
      {...attributes}
      {...listeners}
    >
      <Span minW="6" textAlign="center" fontWeight="bold" color="fg.muted">
        {position}
      </Span>
      <Box flex="1">
        <Text fontWeight="medium">{product.name}</Text>
        <HStack gap="2" mt="1">
          {product.requiresDeposit && <Badge colorPalette="orange">Pfand</Badge>}
          {product.diet && product.diet !== 'OMNIVORE' && (
            <Badge colorPalette="green">{DIET_LABELS[product.diet]}</Badge>
          )}
          {product.minimumAge !== 'NONE' && (
            <Badge colorPalette="red">{AGE_LABELS[product.minimumAge]}</Badge>
          )}
          {product.additiveIds.length > 0 && (
            <Badge variant="surface">
              {product.additiveIds.length} Zusatzstoffe
            </Badge>
          )}
        </HStack>
      </Box>
      <Span fontWeight="medium">{formatCents(product.price)}</Span>
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
  product,
  onCancel,
  onSave,
  onDelete,
}: {
  open: boolean;
  product: DraftProduct | null;
  onCancel: () => void;
  onSave: (values: DraftValues) => void;
  onDelete?: () => void;
}) {
  const {data: additives} = useQuery({
    queryKey: ['additives'],
    queryFn: () => listAdditives(),
  });

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onCancel()}
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
            additiveIds: product?.additiveIds ?? [],
          }}
          validate={toFormikValidate(productFormSchema)}
          onSubmit={(values) =>
            onSave({
              name: values.name.trim(),
              price: parseEuroToCents(values.price)!,
              requiresDeposit: values.requiresDeposit,
              diet: (values.diet || null) as
                | (typeof DIET_VALUES)[number]
                | null,
              minimumAge: values.minimumAge,
              additiveIds: values.additiveIds,
            })
          }
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
              {onDelete && (
                <Button
                  colorPalette="red"
                  variant="outline"
                  type="button"
                  mr="auto"
                  onClick={onDelete}
                >
                  Löschen
                </Button>
              )}
              <Button variant="outline" type="button" onClick={onCancel}>
                Abbrechen
              </Button>
              <Button type="submit">Übernehmen</Button>
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
