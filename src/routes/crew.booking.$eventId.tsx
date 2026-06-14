import {useEffect, useMemo, useRef, useState} from 'react';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Image,
  Span,
  Spinner,
  Text,
} from '@chakra-ui/react';
import {FaFacebook, FaFire, FaInstagram, FaSpotify} from 'react-icons/fa6';
import {LuChevronDown, LuChevronUp, LuFilter} from 'react-icons/lu';
import {
  type Column,
  type ColumnFiltersState,
  type ColumnMeta,
  type SortingState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {useVirtualizer} from '@tanstack/react-virtual';
import {GenreCategory} from '../generated/prisma/browser';
import {
  BAND_GENRE_CATEGORY_OPTIONS,
  GENRE_CATEGORY_ICONS,
} from '../utils/genreCategories';
import {prismaClient} from '../server/prismaClient.server';
import {Tooltip} from '../components/chakra-snippets/tooltip';
import {Avatar} from '../components/chakra-snippets/avatar';
import {Tag} from '../components/chakra-snippets/tag';
import {
  MenuCheckboxItem,
  MenuContent,
  MenuRoot,
  MenuTrigger,
} from '../components/chakra-snippets/menu';
import {seo} from '../utils/seo';

const normalizeBandName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

// Event ids look like `kult2026`; the previous year's event is `kult2025`.
// Returns null when the id has no trailing year to decrement.
const previousEventId = (eventId: string) => {
  const match = eventId.match(/^(.*?)(\d{4})$/);
  return match ? `${match[1]}${Number(match[2]) - 1}` : null;
};

const loadBandApplications = createServerFn()
  .inputValidator((eventId: string) => eventId)
  .handler(async ({data: eventId}) => {
    const prevId = previousEventId(eventId);
    const lastYearBands = prevId
      ? await prismaClient.bandPlaying.findMany({
          where: {eventId: prevId},
          select: {name: true},
        })
      : [];
    const playedLastYear = new Set(
      lastYearBands.map((b) => normalizeBandName(b.name)),
    );

    const applications = await prismaClient.bandApplication.findMany({
      // DJs are handled through a separate flow and never shown here.
      where: {eventId, genreCategory: {not: GenreCategory.DJ}},
      select: {
        id: true,
        bandname: true,
        genre: true,
        genreCategory: true,
        imageUrl: true,
        city: true,
        distance: true,
        numberOfNonMaleArtists: true,
        instagramFollower: true,
        facebookLikes: true,
        spotifyMonthlyListeners: true,
        contactedByViewerId: true,
        _count: {select: {bandApplicationComment: true}},
        bandApplicationRating: {
          select: {
            rating: true,
            viewer: {
              select: {id: true, displayName: true, profilePicture: true},
            },
          },
        },
        BandApplicationTag: {select: {tag: true}},
      },
      orderBy: {bandname: 'asc'},
    });

    if (applications.length === 0) {
      const event = await prismaClient.event.findUnique({
        where: {id: eventId},
        select: {id: true},
      });
      if (!event) {
        throw notFound();
      }
    }

    return applications.map((a) => {
      const ratings = a.bandApplicationRating;
      const averageRating =
        ratings.length === 0
          ? null
          : ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      return {
        id: a.id,
        bandname: a.bandname,
        genre: a.genre,
        genreCategory: a.genreCategory,
        imageUrl: a.imageUrl,
        city: a.city,
        distance: a.distance,
        numberOfNonMaleArtists: a.numberOfNonMaleArtists ?? 0,
        instagramFollower: a.instagramFollower ?? 0,
        facebookLikes: a.facebookLikes ?? 0,
        spotifyMonthlyListeners: a.spotifyMonthlyListeners ?? 0,
        averageRating,
        raters: ratings.map((r) => ({
          id: r.viewer.id,
          displayName: r.viewer.displayName,
          profilePicture: r.viewer.profilePicture,
          rating: r.rating,
        })),
        tags: a.BandApplicationTag.map((t) => t.tag),
        playedLastYear: playedLastYear.has(normalizeBandName(a.bandname)),
        hasComments: a._count.bandApplicationComment > 0,
        wasContacted: a.contactedByViewerId != null,
      };
    });
  });

export type BandApplicationRow = Awaited<
  ReturnType<typeof loadBandApplications>
>[number];

type ComputedTag = {label: string; colorPalette: string};

type Row = BandApplicationRow & {
  popularityScore: number;
  computedTags: ComputedTag[];
  // Computed + manual tag labels, combined once for faceting and filtering.
  tagLabels: string[];
};

// Tags derived from the application data (as opposed to the manually assigned
// BandApplicationTags). Add new entries here to introduce more computed tags.
const COMPUTED_TAGS: (ComputedTag & {applies: (r: BandApplicationRow) => boolean})[] =
  [
    {
      label: 'FLINTA*',
      colorPalette: 'pink',
      applies: (r) => r.numberOfNonMaleArtists > 0,
    },
    {
      label: 'letztes Jahr',
      colorPalette: 'orange',
      applies: (r) => r.playedLastYear,
    },
    {
      label: 'kommentiert',
      colorPalette: 'blue',
      applies: (r) => r.hasComments,
    },
    {
      label: 'kontaktiert',
      colorPalette: 'green',
      applies: (r) => r.wasContacted,
    },
  ];

function computedTagsFor(r: BandApplicationRow): ComputedTag[] {
  return COMPUTED_TAGS.filter((t) => t.applies(r)).map(
    ({label, colorPalette}) => ({label, colorPalette}),
  );
}

export const Route = createFileRoute('/crew/booking/$eventId')({
  component: BookingPage,
  loader: ({params}) => loadBandApplications({data: params.eventId}),
  head: () => seo({title: 'Bandbewerbungen'}),
});

// Multi-select filter rendered inside a column header. A column with no active
// selection shows a muted filter icon; once values are picked the icon turns
// blue. Pass `iconOnly` when the header also sorts — the trigger then shrinks to
// just the icon and stops click propagation so opening the menu never toggles
// the column's sort.
function FilterMenu({
  column,
  options,
  title,
  iconOnly,
}: {
  column: Column<Row, unknown>;
  options: {value: string; label: string}[];
  title?: string;
  iconOnly?: boolean;
}) {
  const selected = (column.getFilterValue() as string[] | undefined) ?? [];
  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    column.setFilterValue(next.length ? next : undefined);
  };
  return (
    <MenuRoot closeOnSelect={false} positioning={{placement: 'bottom-end'}}>
      <MenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          px="1"
          minW="auto"
          w={iconOnly ? 'auto' : 'full'}
          color="inherit"
          fontWeight="inherit"
          fontSize="inherit"
          onClick={(e) => e.stopPropagation()}
        >
          {title}
          <Icon
            as={LuFilter}
            boxSize="3.5"
            ml={iconOnly ? undefined : 'auto'}
            color={selected.length ? 'blue.solid' : 'fg.subtle'}
            _groupHover={selected.length ? undefined : {color: 'fg.muted'}}
          />
        </Button>
      </MenuTrigger>
      <MenuContent maxH="xs" overflowY="auto">
        {options.map((o) => (
          <MenuCheckboxItem
            key={o.value}
            value={o.value}
            checked={selected.includes(o.value)}
            onCheckedChange={() => toggle(o.value)}
          >
            {o.label}
          </MenuCheckboxItem>
        ))}
      </MenuContent>
    </MenuRoot>
  );
}

// Tags are free-form, so derive the option list from the column's faceted unique
// values (TanStack faceting). This also narrows the list to tags still present
// under any active genre filter.
function TagFilterHeader({column}: {column: Column<Row, unknown>}) {
  const facetedValues = column.getFacetedUniqueValues() as Map<string, number>;
  const options = useMemo(
    () =>
      Array.from(facetedValues.keys())
        .sort((a, b) => a.localeCompare(b))
        .map((t) => ({value: t, label: t})),
    [facetedValues],
  );
  return <FilterMenu title="Tags" column={column} options={options} />;
}

// Header for a column that both sorts and filters: a truncating label plus the
// compact filter icon. The table wraps this with the sort arrows.
function SortableFilterHeader({
  title,
  column,
  options,
}: {
  title: string;
  column: Column<Row, unknown>;
  options: {value: string; label: string}[];
}) {
  return (
    <HStack gap="1" w="full" justify="space-between" minW="0">
      <Span truncate>{title}</Span>
      <FilterMenu column={column} options={options} iconOnly />
    </HStack>
  );
}

// The Bewertung filter is a single on/off option modelled as a one-entry
// FilterMenu so it shares the standard filter icon and styling.
const HIDE_REJECTED = 'hideRejected';
const RATING_FILTER_OPTIONS = [
  {value: HIDE_REJECTED, label: '1,0-Bewertungen ausblenden'},
];

// Normalise instagram/facebook/spotify reach against the dataset maxima, then take
// the 6th root to get a 0..1 popularity score (mirrors the old GraphQL booking page).
function decorateRows(rows: BandApplicationRow[]): Row[] {
  const {maxIg, maxFb, maxSp} = rows.reduce(
    (m, r) => ({
      maxIg: Math.max(m.maxIg, r.instagramFollower),
      maxFb: Math.max(m.maxFb, r.facebookLikes),
      maxSp: Math.max(m.maxSp, r.spotifyMonthlyListeners),
    }),
    {maxIg: 1, maxFb: 1, maxSp: 1},
  );
  return rows.map((r) => {
    const present = [
      r.instagramFollower && r.instagramFollower / maxIg,
      r.facebookLikes && r.facebookLikes / maxFb,
      r.spotifyMonthlyListeners && r.spotifyMonthlyListeners / maxSp,
    ].filter((v): v is number => typeof v === 'number' && v > 0);
    const avg = present.length
      ? present.reduce((s, v) => s + v, 0) / present.length
      : 0;
    const computedTags = computedTagsFor(r);
    return {
      ...r,
      popularityScore: Math.pow(avg, 1 / 6),
      computedTags,
      tagLabels: [...computedTags.map((t) => t.label), ...r.tags],
    };
  });
}

const col = createColumnHelper<Row>();

const columns = [
  col.display({
    id: 'index',
    header: '#',
    cell: ({row}) => (
      <Span color="fg.muted" whiteSpace="nowrap">
        {row.index + 1}
      </Span>
    ),
    meta: {width: '40px', align: 'right'},
  }),
  col.accessor('bandname', {
    header: ({column}) => (
      <SortableFilterHeader
        title="Name"
        column={column}
        options={BAND_GENRE_CATEGORY_OPTIONS}
      />
    ),
    // Sorts by name; filters by genre category (moved here from the old genre
    // column). The filter reads `genreCategory` off the row, not this column's
    // accessor value.
    filterFn: (row, _columnId, filterValue: string[]) =>
      !filterValue?.length || filterValue.includes(row.original.genreCategory),
    cell: ({row}) => (
      <HStack gap="2" minW="0">
        <Avatar
          src={row.original.imageUrl ?? undefined}
          fallback={
            <Flex align="center" justify="center" boxSize="full">
              <Image
                src={GENRE_CATEGORY_ICONS.get(row.original.genreCategory)}
                alt=""
                boxSize="70%"
              />
            </Flex>
          }
          bg="bg.emphasized"
          size="sm"
          shape="rounded"
          flexShrink="0"
        />
        <Box minW="0">
          <Text fontWeight="bold" truncate>
            {row.original.bandname}
          </Text>
          {row.original.genre && (
            <Text fontSize="sm" color="fg.muted" truncate>
              {row.original.genre}
            </Text>
          )}
        </Box>
      </HStack>
    ),
    meta: {flex: '1 1 0'},
  }),
  col.accessor('distance', {
    header: 'Ort',
    sortingFn: 'basic',
    sortUndefined: 'last',
    cell: ({row}) => (
      <Box>
        <Text truncate>{row.original.city}</Text>
        {row.original.distance != null && (
          <Text fontSize="sm" color="fg.muted">
            {Math.round(row.original.distance)} km
          </Text>
        )}
      </Box>
    ),
    meta: {width: '140px'},
  }),
  col.accessor('popularityScore', {
    header: 'Popularität',
    sortingFn: 'basic',
    cell: ({row}) => {
      const s = row.original.popularityScore;
      const stats = [
        {icon: FaInstagram, value: row.original.instagramFollower},
        {icon: FaFacebook, value: row.original.facebookLikes},
        {icon: FaSpotify, value: row.original.spotifyMonthlyListeners},
      ].filter(({value}) => value > 0);
      return (
        <Tooltip
          disabled={stats.length === 0}
          positioning={{placement: 'top'}}
          content={
            <Box>
              {stats.map(({icon, value}, i) => (
                <HStack key={i} gap="3" justify="space-between">
                  <Icon as={icon} />
                  <Text>{value.toLocaleString('de-DE')}</Text>
                </HStack>
              ))}
            </Box>
          }
        >
          <Flex justify="center" align="center" h="full">
            <FaFire
              color={`hsl(${220 + s * 120}, 100%, 50%)`}
              size={12 + s * 16}
            />
          </Flex>
        </Tooltip>
      );
    },
    meta: {width: '90px'},
  }),
  col.accessor('averageRating', {
    header: ({column}) => (
      <SortableFilterHeader
        title="Bewertung"
        column={column}
        options={RATING_FILTER_OPTIONS}
      />
    ),
    sortingFn: 'basic',
    sortUndefined: 'last',
    // When the filter is active (default), hide effectively-rejected bands: an
    // average of exactly 1.0 with at least two raters.
    filterFn: (row, _columnId, filterValue: string[]) =>
      !filterValue?.includes(HIDE_REJECTED) ||
      !(row.original.averageRating === 1 && row.original.raters.length >= 2),
    cell: ({row}) => {
      const v = row.original.averageRating;
      if (v == null) {
        return <Span color="fg.muted">–</Span>;
      }
      return (
        <HStack gap="2">
          <Tooltip
            positioning={{placement: 'top'}}
            content={
              <Box>
                {row.original.raters.map((r) => (
                  <Text key={r.id} whiteSpace="nowrap">
                    {'★'.repeat(r.rating)}
                    {'☆'.repeat(Math.max(0, 4 - r.rating))} {r.displayName}
                  </Text>
                ))}
              </Box>
            }
          >
            <Text
              fontSize="lg"
              fontWeight="bold"
              lineHeight="1"
              color="blue.solid"
            >
              {v.toFixed(1)}
            </Text>
          </Tooltip>
          <HStack gap="0">
            {row.original.raters.map((r, i) => (
              <Tooltip
                key={r.id}
                content={r.displayName}
                positioning={{placement: 'top'}}
              >
                <Box
                  as="span"
                  display="inline-flex"
                  ml={i === 0 ? '0' : '-1.5'}
                >
                  <Avatar
                    name={r.displayName}
                    src={r.profilePicture ?? undefined}
                    size="2xs"
                    borderWidth="2px"
                    borderColor="bg"
                  />
                </Box>
              </Tooltip>
            ))}
          </HStack>
        </HStack>
      );
    },
    meta: {width: '180px'},
  }),
  col.accessor('tags', {
    header: ({column}) => <TagFilterHeader column={column} />,
    enableSorting: false,
    // Both the computed tags (FLINTA*, "letztes Jahr", …) and the manually
    // assigned tags are filterable; faceting and the filter share the same
    // combined label list.
    filterFn: (row, _columnId, filterValue: string[]) =>
      !filterValue?.length ||
      filterValue.some((f) => row.original.tagLabels.includes(f)),
    getUniqueValues: (row) => row.tagLabels,
    cell: ({row}) => (
      <HStack gap="1" wrap="wrap">
        {row.original.computedTags.map((t) => (
          <Tag key={t.label} colorPalette={t.colorPalette} size="sm">
            {t.label}
          </Tag>
        ))}
        {row.original.tags.map((t) => (
          <Tag key={t} colorPalette="gray" size="sm">
            {t}
          </Tag>
        ))}
      </HStack>
    ),
    meta: {flex: '1 1 0', width: '160px'},
  }),
];

// Shared sizing/alignment props for a header or body cell, derived from the
// column's `meta`. Keeps header and body columns in lockstep.
function cellLayout(meta: ColumnMeta<Row, unknown> | undefined) {
  return {
    flex: meta?.flex ?? '0 0 auto',
    w: meta?.width,
    flexShrink: meta?.flex ? undefined : 0,
    textAlign: meta?.align,
  } as const;
}

// Up/down chevrons that are always visible on sortable columns. Both are light
// (and darken on header hover); the active sort direction is shown in full dark.
function SortArrows({sorted}: {sorted: false | 'asc' | 'desc'}) {
  const arrow = (active: boolean) => ({
    boxSize: '3',
    color: active ? 'blue.solid' : 'fg.subtle',
    _groupHover: active ? undefined : {color: 'fg.muted'},
  });
  return (
    <Flex direction="column" lineHeight="0" flexShrink="0">
      <Icon as={LuChevronUp} mb="-1" {...arrow(sorted === 'asc')} />
      <Icon as={LuChevronDown} {...arrow(sorted === 'desc')} />
    </Flex>
  );
}

function BookingPage() {
  const loaderData = Route.useLoaderData();
  const data = useMemo(() => decorateRows(loaderData), [loaderData]);

  const [sorting, setSorting] = useState<SortingState>([]);
  // The rating filter starts on, hiding effectively-rejected bands (see the
  // averageRating column's filterFn). The header toggle removes it.
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
    {id: 'averageRating', value: [HIDE_REJECTED]},
  ]);

  const table = useReactTable({
    data,
    columns,
    state: {sorting, columnFilters},
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    enableSortingRemoval: true,
  });

  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  return (
    <Box h="100dvh" display="flex" flexDirection="column">
      {/* Header */}
      <Flex
        bg="bg.muted"
        borderBottomWidth="1px"
        fontWeight="bold"
        fontSize="sm"
        userSelect="none"
        flexShrink="0"
        align="center"
      >
        {table.getHeaderGroups()[0].headers.map((header) => {
          const sorted = header.column.getIsSorted();
          const active = sorted !== false || header.column.getIsFiltered();
          return (
            <Box
              key={header.id}
              {...cellLayout(header.column.columnDef.meta)}
              className="group"
              px="2"
              py="2"
              whiteSpace="nowrap"
              color={active ? 'blue.solid' : undefined}
              cursor={header.column.getCanSort() ? 'pointer' : 'default'}
              onClick={header.column.getToggleSortingHandler()}
            >
              {header.column.getCanSort() ? (
                <Flex align="center" gap="1">
                  <Box minW="0" flex="1" truncate>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </Box>
                  <SortArrows sorted={sorted} />
                </Flex>
              ) : (
                flexRender(header.column.columnDef.header, header.getContext())
              )}
            </Box>
          );
        })}
      </Flex>

      {/* Body */}
      <Box ref={scrollRef} flex="1" minH="0" overflowY="auto">
        {!mounted ? (
          <Flex justify="center" py="10">
            <Spinner />
          </Flex>
        ) : (
          <Box position="relative" h={`${virtualizer.getTotalSize()}px`}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const row = rows[vItem.index];
              return (
                <Flex
                  key={row.id}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  position="absolute"
                  top="0"
                  left="0"
                  w="full"
                  transform={`translateY(${vItem.start}px)`}
                  borderBottomWidth="1px"
                  align="center"
                  minH="14"
                  fontSize="sm"
                  _hover={{bg: 'bg.muted'}}
                >
                  {row.getVisibleCells().map((cell) => (
                    <Box
                      key={cell.id}
                      {...cellLayout(cell.column.columnDef.meta)}
                      px="2"
                      py="1"
                      minW="0"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </Box>
                  ))}
                </Flex>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    flex?: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
  }
}
