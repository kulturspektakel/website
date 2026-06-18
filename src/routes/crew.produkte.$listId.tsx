import {createFileRoute, Link, notFound, useBlocker} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {getCookie} from '@tanstack/react-start/server';
import {
  Badge,
  Box,
  Button,
  Combobox,
  Heading,
  HStack,
  IconButton,
  Input,
  Portal,
  Span,
  Stack,
  TagsInput,
  Text,
  useCombobox,
  useFilter,
  useListCollection,
  useTagsInput,
} from '@chakra-ui/react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Form, Formik, useField} from 'formik';
import {toFormikValidate} from 'zod-formik-adapter';
import {z} from 'zod';
import {useEffect, useId, useMemo, useRef, useState} from 'react';
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
import {FaChevronLeft} from 'react-icons/fa6';
import {LuPencil} from 'react-icons/lu';
import {prismaClient} from '../server/prismaClient.server';
import {verifyDirectusSession} from '../server/directusAuth.server';
import {seo} from '../utils/seo';
import {formatCents, parseEuroToCents} from '../utils/currency';
import {listAdditives} from './crew.produkte';
import {ConnectedField} from '../components/forms/ConnectedField';
import {ConnectedCheckbox} from '../components/forms/ConnectedCheckbox';
import {Field} from '../components/chakra-snippets/field';
import {InputGroup} from '../components/chakra-snippets/input-group';
import {BudeDialog} from '../components/produkte/BudeDialog';
import {
  NativeSelectField,
  NativeSelectRoot,
} from '../components/chakra-snippets/native-select';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../components/chakra-snippets/dialog';

// ---------------------------------------------------------------------------
// Enums & labels
// ---------------------------------------------------------------------------

const DIET_VALUES = ['VEGETARIAN', 'VEGAN'] as const;
const AGE_VALUES = ['NONE', 'AGE_16', 'AGE_18'] as const;
// Sentinel for the "nein" segment; maps to `diet: null`. A non-empty value is
// required because SegmentGroup won't select an empty-string item.
const DIET_NONE = 'NONE';

const DIET_LABELS: Record<(typeof DIET_VALUES)[number], string> = {
  VEGETARIAN: 'Vegetarisch',
  VEGAN: 'Vegan',
};
const DIET_COLORS: Record<(typeof DIET_VALUES)[number], string> = {
  VEGETARIAN: 'green',
  VEGAN: 'teal',
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
    const lastUpdatedBy =
      verifyDirectusSession(getCookie('directus_session_token'))?.id ?? null;
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
      // Adding/editing/deleting/reordering products counts as editing the bude.
      prismaClient.productList.update({
        where: {id: data.productListId},
        data: {updatedAt: new Date(), lastUpdatedBy},
      }),
    ]);
  });

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/crew/produkte/$listId')({
  component: ProductListEditor,
  loader: async ({params}) => await getProductList({data: params.listId}),
  head: ({loaderData}) =>
    seo({
      title: loaderData
        ? `${loaderData.emoji ? `${loaderData.emoji} ` : ''}${loaderData.name}`
        : 'Produkte',
    }),
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

  const invalidate = async () => {
    await queryClient.invalidateQueries({queryKey: ['productList', listId]});
    // The bude's updatedAt/editor changed too, so refresh the overview list.
    // refetchType 'all' is needed because the overview query is inactive while
    // we're on the detail page, and refetchOnMount is disabled globally.
    await queryClient.invalidateQueries({
      queryKey: ['productLists'],
      refetchType: 'all',
    });
  };

  return <Products key={list.id} list={list} onSaved={invalidate} />;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/**
 * Client-side working copy of a product. `id` is `null` for products that have
 * been added but not yet saved; `key` is a stable identifier for React/dnd-kit
 * that survives reorders (and exists for unsaved products that have no `id`).
 */
type DraftValues = {
  name: string;
  price: number;
  requiresDeposit: boolean;
  diet: (typeof DIET_VALUES)[number] | null;
  minimumAge: (typeof AGE_VALUES)[number];
  additiveIds: string[];
};

type DraftProduct = DraftValues & {key: string; id: number | null};

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
  list,
  onSaved,
}: {
  list: ListData;
  onSaved: () => Promise<void> | void;
}) {
  const listId = list.id;
  const products = list.product;
  const [draft, setDraft] = useState<DraftProduct[]>(() =>
    products.map(toDraft),
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [budeEditOpen, setBudeEditOpen] = useState(false);
  const tempSeq = useRef(0);
  const justDragged = useRef(false);

  useEffect(() => {
    setDraft(products.map(toDraft));
  }, [products]);

  const saved = useMemo(() => fingerprint(products.map(toDraft)), [products]);
  const dirty = useMemo(() => fingerprint(draft), [draft]) !== saved;

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
      <HStack gap="2" align="center" mb="6">
        <IconButton asChild aria-label="Zurück" variant="ghost" size="sm">
          <Link to="/crew/produkte">
            <FaChevronLeft />
          </Link>
        </IconButton>
        <Heading size="2xl" flex="1">
          {list.emoji ? `${list.emoji} ` : ''}
          {list.name}
        </Heading>
        <IconButton
          aria-label="Bude bearbeiten"
          borderRadius="full"
          size="sm"
          onClick={() => setBudeEditOpen(true)}
        >
          <LuPencil />
        </IconButton>
      </HStack>

      {dirty && (
        <HStack
          justify="space-between"
          colorPalette="orange"
          bg="colorPalette.subtle"
          color="colorPalette.fg"
          borderWidth="1px"
          borderColor="colorPalette.muted"
          borderRadius="md"
          p="3"
          mb="4"
        >
          <Text fontWeight="medium">Ungespeicherte Änderungen</Text>
          <Button
            size="sm"
            colorPalette="orange"
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
          >
            Speichern
          </Button>
        </HStack>
      )}

      {draft.length > 0 && (
        <DndContext
          id={`produkte-products-${listId}`}
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

      <ProductDialog
        open={dialogOpen}
        product={editing}
        onCancel={() => setDialogOpen(false)}
        onSave={applyDialog}
        onDelete={editing ? deleteDialog : undefined}
      />

      <BudeDialog
        open={budeEditOpen}
        list={list}
        onClose={() => setBudeEditOpen(false)}
        onSaved={async () => {
          await onSaved();
          setBudeEditOpen(false);
        }}
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
      minH="16"
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
        <HStack gap="2" mt="1" _empty={{display: 'none'}}>
          {product.requiresDeposit && <Badge colorPalette="orange">Pfand</Badge>}
          {product.diet && (
            <Badge colorPalette={DIET_COLORS[product.diet]}>
              {DIET_LABELS[product.diet]}
            </Badge>
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
        <DialogCloseTrigger />
        {open && (
        <Formik
          initialValues={{
            name: product?.name ?? '',
            price: product
              ? (product.price / 100).toFixed(2).replace('.', ',')
              : '',
            requiresDeposit: product?.requiresDeposit ?? false,
            diet: product?.diet ?? DIET_NONE,
            minimumAge: product?.minimumAge ?? 'NONE',
            additiveIds: product?.additiveIds ?? [],
          }}
          validate={toFormikValidate(productFormSchema)}
          onSubmit={(values) =>
            onSave({
              name: values.name.trim(),
              price: parseEuroToCents(values.price)!,
              requiresDeposit: values.requiresDeposit,
              diet:
                values.diet === DIET_NONE
                  ? null
                  : (values.diet as (typeof DIET_VALUES)[number]),
              minimumAge: values.minimumAge,
              additiveIds: values.additiveIds,
            })
          }
        >
          <Form>
            <DialogBody>
              <Stack gap="4">
                <HStack gap="4" align="flex-start">
                  <Box flex="1">
                    <ConnectedField name="name" label="Name" required />
                  </Box>
                  <Box w="28">
                    <PriceField />
                  </Box>
                </HStack>
                <ConnectedCheckbox
                  name="requiresDeposit"
                  label="Pfandpflichtig"
                />
                <FormSelect
                  name="diet"
                  label="vegetarisch/vegan"
                  items={[
                    {value: DIET_NONE, label: 'nein'},
                    ...DIET_VALUES.map((v) => ({value: v, label: DIET_LABELS[v]})),
                  ]}
                />
                <FormSelect
                  name="minimumAge"
                  label="Altersbeschränkung"
                  items={AGE_VALUES.map((v) => ({
                    value: v,
                    label: AGE_LABELS[v],
                  }))}
                />
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
  items,
}: {
  name: string;
  label: string;
  items: Array<{value: string; label: string}>;
}) {
  const [field, , helpers] = useField<string>(name);
  return (
    <Field label={label}>
      <NativeSelectRoot>
        <NativeSelectField
          items={items}
          value={field.value}
          onChange={(e) => helpers.setValue(e.currentTarget.value)}
        />
      </NativeSelectRoot>
    </Field>
  );
}

function PriceField() {
  const [field, meta, helpers] = useField<string>('price');
  const showError = meta.touched && Boolean(meta.error);
  return (
    <Field
      label="Preis"
      required
      invalid={showError}
      errorText={showError ? meta.error : undefined}
    >
      <InputGroup w="full" endElement="€">
        <Input
          inputMode="decimal"
          value={field.value}
          onChange={(e) => helpers.setValue(e.target.value)}
          onBlur={() => {
            helpers.setTouched(true);
            const cents = parseEuroToCents(field.value);
            if (cents != null) {
              helpers.setValue((cents / 100).toFixed(2).replace('.', ','));
            }
          }}
        />
      </InputGroup>
    </Field>
  );
}

function AdditivesField({
  additives,
}: {
  additives: Array<{id: string; displayName: string}>;
}) {
  const [field, , helpers] = useField<string[]>('additiveIds');
  const {contains} = useFilter({sensitivity: 'base'});
  const {collection, filter, set} = useListCollection({
    initialItems: additives.map((a) => ({label: a.displayName, value: a.id})),
    filter: contains,
  });

  // Keep the collection in sync once the additives query resolves.
  useEffect(() => {
    set(additives.map((a) => ({label: a.displayName, value: a.id})));
  }, [additives, set]);

  const labelFor = (id: string) =>
    additives.find((a) => a.id === id)?.displayName ?? id;

  const uid = useId();
  const tags = useTagsInput({
    ids: {input: `additive-input-${uid}`, control: `additive-control-${uid}`},
    value: field.value,
    onValueChange: (e) => helpers.setValue(e.value),
    editable: false,
    // Only existing additives, no duplicates.
    validate: (e) =>
      additives.some((a) => a.id === e.inputValue) &&
      !e.value.includes(e.inputValue),
  });

  const combobox = useCombobox({
    ids: {input: `additive-input-${uid}`, control: `additive-control-${uid}`},
    collection,
    value: [],
    selectionBehavior: 'clear',
    onInputValueChange: (e) => filter(e.inputValue),
    onValueChange: (e) => tags.addValue(e.value[0]),
  });

  return (
    <Combobox.RootProvider value={combobox}>
      <TagsInput.RootProvider value={tags}>
        <TagsInput.Label>Zusatzstoffe/Allergene</TagsInput.Label>
        <TagsInput.Control>
          {tags.value.map((tag, index) => (
            <TagsInput.Item key={tag} index={index} value={tag}>
              <TagsInput.ItemPreview>
                <TagsInput.ItemText>{labelFor(tag)}</TagsInput.ItemText>
                <TagsInput.ItemDeleteTrigger />
              </TagsInput.ItemPreview>
            </TagsInput.Item>
          ))}
          <Combobox.Input unstyled asChild>
            <TagsInput.Input placeholder="hinzufügen…" />
          </Combobox.Input>
        </TagsInput.Control>
        <Portal>
          <Combobox.Positioner>
            <Combobox.Content>
              <Combobox.Empty>Keine Treffer</Combobox.Empty>
              {collection.items.map((item) => (
                <Combobox.Item item={item} key={item.value}>
                  <Combobox.ItemText>{item.label}</Combobox.ItemText>
                  <Combobox.ItemIndicator />
                </Combobox.Item>
              ))}
            </Combobox.Content>
          </Combobox.Positioner>
        </Portal>
      </TagsInput.RootProvider>
    </Combobox.RootProvider>
  );
}
