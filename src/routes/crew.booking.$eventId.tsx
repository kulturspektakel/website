import {
  forwardRef,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  createFileRoute,
  notFound,
  Outlet,
  useParams,
} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {crewAuth} from '../server/crewAuth';
import {
  Box,
  Button,
  type ButtonProps,
  Flex,
  HStack,
  Icon,
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
  type Row as TableRow,
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
import {BAND_GENRE_CATEGORY_OPTIONS} from '../utils/genreCategories';
import {prismaClient} from '../server/prismaClient.server';
import {Tooltip} from '../components/chakra-snippets/tooltip';
import {BandName} from '../components/booking/BandName';
import {BandApplicationRating} from '../components/booking/BandApplicationRating';
import {StageMatrixReadonly} from '../components/booking/StageMatrixReadonly';
import {StageMatrix} from '../components/booking/StageMatrix';
import {
  ALL_STAGE_CELLS,
  toStageValue,
  type StageCell,
} from '../components/booking/stageMatrixShared';
import {
  PopoverBody,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from '../components/chakra-snippets/popover';
import {Tag} from '../components/chakra-snippets/tag';
import {
  MenuCheckboxItem,
  MenuContent,
  MenuRoot,
  MenuTrigger,
} from '../components/chakra-snippets/menu';
import {seo} from '../utils/seo';
import {normalizeBandName} from '../utils/normalizeBandName';
import {meanRating} from '../utils/meanRating';
import {BandSearch} from '../components/booking/BandSearch';
import {
  DialogCloseTrigger,
  DialogContent,
  DialogRoot,
} from '../components/chakra-snippets/dialog';

// Event ids look like `kult2026`; the previous year's event is `kult2025`.
// Returns null when the id has no trailing year to decrement.
const previousEventId = (eventId: string) => {
  const match = eventId.match(/^(.*?)(\d{4})$/);
  return match ? `${match[1]}${Number(match[2]) - 1}` : null;
};

const loadBandApplications = createServerFn()
  .middleware([crewAuth])
  .inputValidator((eventId: string) => eventId)
  .handler(async ({data: eventId, context}) => {
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
        stageRow: true,
        stageColumn: true,
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

    const myViewerId = context.viewer?.id ?? null;

    return applications.map((a) => {
      const ratings = a.bandApplicationRating;
      const averageRating = meanRating(ratings);
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
        myRating:
          ratings.find((r) => r.viewer.id === myViewerId)?.rating ?? 0,
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
        stageRow: a.stageRow,
        stageColumn: a.stageColumn,
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
const COMPUTED_TAGS: (ComputedTag & {
  applies: (r: BandApplicationRow) => boolean;
})[] = [
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
    label: 'angefragt',
    colorPalette: 'green',
    applies: (r) => r.wasContacted,
  },
];

export function computedTagsFor(r: BandApplicationRow): ComputedTag[] {
  return COMPUTED_TAGS.filter((t) => t.applies(r)).map(
    ({label, colorPalette}) => ({label, colorPalette}),
  );
}

export const Route = createFileRoute('/crew/booking/$eventId')({
  component: BookingPage,
  loader: ({params}) => loadBandApplications({data: params.eventId}),
  head: () => seo({title: 'Bandbewerbungen'}),
});

// The trigger shared by every column filter (checkbox menus and the stage
// popover): a filter icon that turns blue when active, muted otherwise. `iconOnly`
// shrinks it to just the icon for headers that also sort. Stops click
// propagation so opening the filter never toggles the column's sort, then runs
// the open handler that MenuTrigger/PopoverTrigger inject via `asChild`.
const FilterTriggerButton = forwardRef<
  HTMLButtonElement,
  ButtonProps & {title?: string; active: boolean; iconOnly?: boolean}
>(function FilterTriggerButton({title, active, iconOnly, onClick, ...rest}, ref) {
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="xs"
      px="1"
      minW="auto"
      w={iconOnly ? 'auto' : 'full'}
      color="inherit"
      fontWeight="inherit"
      fontSize="inherit"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      {...rest}
    >
      {title}
      <Icon
        as={LuFilter}
        boxSize="3.5"
        ml={iconOnly ? undefined : 'auto'}
        color={active ? 'blue.solid' : 'fg.subtle'}
        _groupHover={active ? undefined : {color: 'fg.muted'}}
      />
    </Button>
  );
});

// Shared filter state for every column filter. Mirrors the committed value in
// local state so the control (checkbox / matrix dot / active icon) updates
// instantly, and commits the actual column filter — whose recompute re-filters
// and re-facets all rows — inside a transition so it never blocks the click. One
// place, so all filters stay responsive on large lists.
function useColumnFilter<T>(column: Column<Row, unknown>) {
  const [value, setValue] = useState<T | undefined>(
    () => column.getFilterValue() as T | undefined,
  );
  const [, startTransition] = useTransition();
  const setFilter = (next: T | undefined) => {
    setValue(next);
    startTransition(() => column.setFilterValue(next));
  };
  return [value, setFilter] as const;
}

// Multi-select filter rendered inside a column header. A column with no active
// selection shows a muted filter icon; once values are picked the icon turns
// blue. Pass `iconOnly` when the header also sorts — the trigger then shrinks to
// just the icon.
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
  const [value, setFilter] = useColumnFilter<string[]>(column);
  const selected = value ?? [];
  const toggle = (v: string) => {
    const next = selected.includes(v)
      ? selected.filter((x) => x !== v)
      : [...selected, v];
    setFilter(next.length ? next : undefined);
  };
  return (
    <MenuRoot closeOnSelect={false} positioning={{placement: 'bottom-end'}}>
      <MenuTrigger asChild>
        <FilterTriggerButton
          title={title}
          active={selected.length > 0}
          iconOnly={iconOnly}
        />
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

// "Bühne" header + filter. Unlike the other filters (checkbox menus), the stage
// filter is a cell picker: it opens a Popover (not a Menu — the matrix owns arrow
// keys) holding the multi-select StageMatrix bound to the column's filter value
// (an array of {row, col} cells).
function StageFilterHeader({column}: {column: Column<Row, unknown>}) {
  const [value, setFilter] = useColumnFilter<StageCell[]>(column);
  const selected = value ?? [];
  const onChange = (cells: StageCell[]) =>
    setFilter(cells.length ? cells : undefined);

  return (
    <PopoverRoot positioning={{placement: 'bottom-end'}}>
      <PopoverTrigger asChild>
        <FilterTriggerButton title="Bühne" active={selected.length > 0} />
      </PopoverTrigger>
      <PopoverContent w="auto">
        <PopoverBody>
          <StageMatrix multiple value={selected} onChange={onChange} />
          <HStack gap="2" mt="3">
            <Button
              flex="1"
              size="xs"
              variant="outline"
              onClick={() => onChange(ALL_STAGE_CELLS)}
            >
              Alle
            </Button>
            <Button
              flex="1"
              size="xs"
              variant="outline"
              onClick={() => onChange([])}
            >
              Keine
            </Button>
          </HStack>
        </PopoverBody>
      </PopoverContent>
    </PopoverRoot>
  );
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

// Rows are a fixed height so the virtualizer can position them by pure math
// (estimateSize is exact — no per-row measurement/ResizeObserver). Both the
// virtualizer estimate and the row's `h` read this constant, so the DOM row
// (box-sizing: border-box) is exactly ROW_HEIGHT — keep it that way (don't add
// margins or a taller border). Every cell's content must fit; the tags cell
// clips to a single row (see below).
const ROW_HEIGHT = 56;

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
      <BandName
        bandname={row.original.bandname}
        genre={row.original.genre}
        genreCategory={row.original.genreCategory}
        imageUrl={row.original.imageUrl}
      />
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
    cell: ({row}) => (
      <BandApplicationRating
        applicationId={row.original.id}
        myRating={row.original.myRating}
        averageRating={row.original.averageRating}
        raters={row.original.raters}
        size="md"
      />
    ),
    meta: {width: '260px'},
  }),
  col.display({
    id: 'stage',
    header: ({column}) => <StageFilterHeader column={column} />,
    enableSorting: false,
    // Exact-cell match: a row matches if its assigned (row, col) is among the
    // picked cells. Unassigned rows (null) match nothing, so they drop out when a
    // filter is active; "between" cells are their own selectable cells.
    filterFn: (row, _columnId, filterValue: StageCell[]) =>
      !filterValue?.length ||
      filterValue.some(
        (c) =>
          c.row === row.original.stageRow &&
          c.col === row.original.stageColumn,
      ),
    cell: ({row}) => (
      <StageMatrixReadonly
        value={toStageValue(row.original.stageRow, row.original.stageColumn)}
      />
    ),
    meta: {width: '90px', align: 'center'},
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
      <HStack gap="1" overflow="hidden">
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

// A row's cells are expensive to render (avatars, several tooltips per rating).
// `row` identity is stable across scroll frames (TanStack memoizes the row
// model), so memoizing here skips re-rendering rows that stay in view while
// scrolling — only newly-entering rows do real work.
const RowCells = memo(function RowCells({row}: {row: TableRow<Row>}) {
  return (
    <>
      {row.getVisibleCells().map((cell) => (
        <Box
          key={cell.id}
          {...cellLayout(cell.column.columnDef.meta)}
          px="2"
          py="1"
          minW="0"
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </Box>
      ))}
    </>
  );
});

function BookingPage() {
  const loaderData = Route.useLoaderData();
  const data = useMemo(() => decorateRows(loaderData), [loaderData]);
  const {eventId} = Route.useParams();
  const navigate = Route.useNavigate();

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
    // Rows are fixed height, so this is exact — the virtualizer never needs to
    // measure a rendered row (no ResizeObserver / offsetHeight reads).
    estimateSize: () => ROW_HEIGHT,
    // Render a generous buffer above/below the viewport so fast scrolling
    // doesn't outrun row rendering and flash empty rows. Rows are expensive
    // (several tooltips + avatars each), so this only softens the gap on a hard
    // fling rather than eliminating it.
    overscan: 40,
  });

  // When a detail modal is open (incl. deep-links and search selections),
  // scroll the table to the corresponding row — but only if it isn't already
  // visible (`align: 'auto'` is a no-op for in-view rows). `strict: false`
  // reads the optional child-route param.
  const {applicationId} = useParams({strict: false});
  useEffect(() => {
    if (!mounted || !applicationId) return;
    const index = rows.findIndex((r) => r.original.id === applicationId);
    if (index >= 0) {
      virtualizer.scrollToIndex(index, {align: 'auto'});
    }
  }, [applicationId, mounted, rows, virtualizer]);

  // `rows` gets a fresh identity on every render/filter; read it through a ref
  // so the keydown listener below subscribes once per open modal, not on every
  // row change.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // While a detail modal is open, Arrow Up/Down step to the previous/next row in
  // the current (filtered + sorted) order. Skip when a nested control already
  // handled the key (stage grid, combobox — they call preventDefault) or when
  // the user is typing/moving a caret in a text field.
  useEffect(() => {
    if (!applicationId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      const current = rowsRef.current.findIndex(
        (r) => r.original.id === applicationId,
      );
      if (current < 0) return;
      const next = current + (e.key === 'ArrowDown' ? 1 : -1);
      if (next < 0 || next >= rowsRef.current.length) return;
      e.preventDefault();
      navigate({
        to: '/crew/booking/$eventId/$applicationId',
        params: {eventId, applicationId: rowsRef.current[next].original.id},
      });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [applicationId, navigate, eventId]);

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
              const active = row.original.id === applicationId;
              return (
                <Flex
                  key={row.id}
                  position="absolute"
                  top="0"
                  left="0"
                  w="full"
                  transform={`translateY(${vItem.start}px)`}
                  borderBottomWidth="1px"
                  align="center"
                  h={`${ROW_HEIGHT}px`}
                  overflow="hidden"
                  fontSize="sm"
                  cursor="pointer"
                  bg={active ? 'bg.emphasized' : undefined}
                  _hover={active ? undefined : {bg: 'bg.muted'}}
                  onClick={() =>
                    navigate({
                      to: '/crew/booking/$eventId/$applicationId',
                      params: {eventId, applicationId: row.original.id},
                    })
                  }
                >
                  <RowCells row={row} />
                </Flex>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Persistent detail dialog: the shell stays mounted across
          $applicationId changes so navigating between bands (and the loading
          spinner in between) swaps only the body — no open/close animation.
          The enter/exit animation plays only when opening from / closing to the
          table. */}
      <DialogRoot
        open={!!applicationId}
        onOpenChange={(e) => {
          if (!e.open) {
            navigate({to: '/crew/booking/$eventId', params: {eventId}});
          }
        }}
        placement="center"
        size="xl"
        scrollBehavior="inside"
      >
        <DialogContent>
          <DialogCloseTrigger />
          <Outlet />
        </DialogContent>
      </DialogRoot>

      <BandSearch bands={data} eventId={eventId} navigate={navigate} />
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
