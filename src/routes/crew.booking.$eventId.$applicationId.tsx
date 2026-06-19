import {useEffect, useId, useRef, useState} from 'react';
import {
  createFileRoute,
  notFound,
  Outlet,
  useLoaderData,
  useRouter,
} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {crewAuth} from '../server/crewAuth';
import {postBandApplicationComment} from '../server/postBandApplicationComment';
import {useQuery} from '@tanstack/react-query';
import {
  Box,
  Button,
  Combobox,
  Flex,
  Grid,
  Heading,
  HStack,
  IconButton,
  Link,
  Portal,
  SimpleGrid,
  Span,
  Stack,
  TagsInput,
  Text,
  Textarea,
  useCombobox,
  useFilter,
  useListCollection,
  useTagsInput,
} from '@chakra-ui/react';
import {FaFacebook, FaGlobe, FaInstagram, FaSpotify, FaPaperPlane} from 'react-icons/fa6';
import {
  BandRepertoire,
  DemoEmbedType,
  PreviouslyPlayed,
} from '../generated/prisma/browser';
import {prismaClient} from '../server/prismaClient.server';
import {Avatar} from '../components/chakra-snippets/avatar';
import {BandName} from '../components/booking/BandName';
import {BandApplicationRating} from '../components/booking/BandApplicationRating';
import {Checkbox} from '../components/chakra-snippets/checkbox';
import {Tag} from '../components/chakra-snippets/tag';
import {Tooltip} from '../components/chakra-snippets/tooltip';
import DateString from '../components/DateString';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../components/chakra-snippets/dialog';
import GoogleMaps from '../components/GoogleMaps';
import {computedTagsFor} from './crew.booking.$eventId';

// Kulturspektakel venue — second marker on the band-location map, so the map
// always frames the distance the band travels to the festival.
const KULT = {latitude: 48.078143, longitude: 11.375518};

// ---------------------------------------------------------------------------
// Server function — lazy detail loader (runs only when the child route opens)
// ---------------------------------------------------------------------------

const loadBandApplicationDetail = createServerFn()
  .middleware([crewAuth])
  .inputValidator((applicationId: string) => applicationId)
  .handler(async ({data: id, context}) => {
    const a = await prismaClient.bandApplication.findUnique({
      where: {id},
      select: {
        id: true,
        bandname: true,
        genre: true,
        genreCategory: true,
        city: true,
        distance: true,
        latitude: true,
        longitude: true,
        email: true,
        contactName: true,
        contactPhone: true,
        facebook: true,
        facebookLikes: true,
        website: true,
        instagram: true,
        instagramFollower: true,
        spotifyArtist: true,
        spotifyMonthlyListeners: true,
        demo: true,
        demoEmbed: true,
        demoEmbedType: true,
        description: true,
        knowsKultFrom: true,
        numberOfArtists: true,
        numberOfNonMaleArtists: true,
        hasPreviouslyPlayed: true,
        repertoire: true,
        imageUrl: true,
        contactedByViewerId: true,
        bandApplicationRating: {
          select: {
            rating: true,
            viewer: {
              select: {id: true, displayName: true, profilePicture: true},
            },
          },
        },
        bandApplicationComment: {
          orderBy: {createdAt: 'desc'},
          select: {
            id: true,
            comment: true,
            createdAt: true,
            viewer: {
              select: {id: true, displayName: true, profilePicture: true},
            },
          },
        },
        BandApplicationTag: {select: {tag: true}},
      },
    });
    if (!a) {
      throw notFound();
    }
    const myViewerId = context.viewer?.id ?? null;
    return {
      ...a,
      myRating:
        a.bandApplicationRating.find((r) => r.viewer.id === myViewerId)
          ?.rating ?? 0,
      apiKey: process.env.GOOGLE_MAPS_API_KEY,
    };
  });

type DetailData = Awaited<ReturnType<typeof loadBandApplicationDetail>>;

// All distinct tags ever assigned, for the tags combobox suggestions.
const listBandApplicationTags = createServerFn()
  .middleware([crewAuth])
  .handler(async () => {
    const rows = await prismaClient.bandApplicationTag.findMany({
      distinct: ['tag'],
      select: {tag: true},
      orderBy: {tag: 'asc'},
    });
    return rows.map((r) => r.tag);
  });

// ---------------------------------------------------------------------------
// Enum labels (German, copied from the legacy Ant-Design modal)
// ---------------------------------------------------------------------------

const PREVIOUSLY_PLAYED_LABELS: Record<PreviouslyPlayed, string> = {
  [PreviouslyPlayed.Yes]: 'Ja',
  [PreviouslyPlayed.OtherFormation]: 'In einer anderen Band',
  [PreviouslyPlayed.No]: 'Nein',
};

const REPERTOIRE_LABELS: Record<BandRepertoire, string> = {
  [BandRepertoire.ExclusivelyOwnSongs]: 'Nur eigene Songs',
  [BandRepertoire.MostlyOwnSongs]: 'Hauptsächlich eigene Songs',
  [BandRepertoire.MostlyCoverSongs]: 'Hauptsächlich Coversongs',
  [BandRepertoire.ExclusivelyCoverSongs]: 'Nur Coversongs',
};

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/crew/booking/$eventId/$applicationId')({
  component: BandApplicationDetailRoute,
  loader: ({params}) => loadBandApplicationDetail({data: params.applicationId}),
});

// ---------------------------------------------------------------------------
// Dialog shell (shared by the loaded view and the pending skeleton)
// ---------------------------------------------------------------------------

function DialogShell({
  title,
  children,
  onClose,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <DialogRoot
      open
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
      size="xl"
      scrollBehavior="inside"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>{children}</DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}

function useClose() {
  const {eventId} = Route.useParams();
  const navigate = Route.useNavigate();
  return () => navigate({to: '/crew/booking/$eventId', params: {eventId}});
}

function BandApplicationDetailRoute() {
  const data = Route.useLoaderData();
  const {eventId, applicationId} = Route.useParams();
  const navigate = Route.useNavigate();
  const onClose = useClose();

  return (
    <>
      <DialogShell
        onClose={onClose}
        title={
          <BandName
            bandname={data.bandname}
            genre={data.genre}
            genreCategory={data.genreCategory}
            imageUrl={data.imageUrl}
            size="md"
          />
        }
      >
        <SimpleGrid columns={{base: 1, md: 2}} gap="6">
          <LeftColumn
            data={data}
            onContact={() =>
              navigate({
                to: '/crew/booking/$eventId/$applicationId/contact',
                params: {eventId, applicationId},
              })
            }
          />
          <RightColumn data={data} />
        </SimpleGrid>
      </DialogShell>

      {/* Stacked contact dialog (child route); portalled, so placement here is
          irrelevant. */}
      <Outlet />
    </>
  );
}

// ---------------------------------------------------------------------------
// Left column — demo, facts, location, contact
// ---------------------------------------------------------------------------

function LeftColumn({
  data,
  onContact,
}: {
  data: DetailData;
  onContact: () => void;
}) {
  const malePercent =
    data.numberOfArtists != null &&
    data.numberOfNonMaleArtists != null &&
    data.numberOfArtists > 0
      ? (data.numberOfArtists - data.numberOfNonMaleArtists) /
        data.numberOfArtists
      : null;

  return (
    <Stack gap="4">
      {(data.demoEmbed || data.demo) && (
        <Demo
          demo={data.demo}
          demoEmbed={data.demoEmbed}
          demoEmbedType={data.demoEmbedType}
        />
      )}

      {data.hasPreviouslyPlayed && (
        <Fact label="Schonmal gespielt">
          {PREVIOUSLY_PLAYED_LABELS[data.hasPreviouslyPlayed]}
        </Fact>
      )}
      {data.repertoire && (
        <Fact label="Repertoire">{REPERTOIRE_LABELS[data.repertoire]}</Fact>
      )}
      {malePercent != null && (
        <Fact label="Bandgröße">
          {data.numberOfArtists} Personen (
          {malePercent.toLocaleString('de-DE', {
            style: 'percent',
            maximumFractionDigits: 1,
          })}{' '}
          männlich)
        </Fact>
      )}

      {data.knowsKultFrom && (
        <Section title="Woher kennt ihr das Kult?">
          <ExpandableText>{data.knowsKultFrom}</ExpandableText>
        </Section>
      )}
      {data.description && (
        <Section title="Bandbeschreibung">
          <ExpandableText>{data.description}</ExpandableText>
        </Section>
      )}

      <Fact label="Anreise">
        {data.city}
        {data.distance != null && ` (${data.distance.toFixed()} km)`}
      </Fact>
      {data.latitude != null && data.longitude != null && data.apiKey && (
        <Box h="56" borderRadius="md" overflow="hidden">
          <GoogleMaps
            latitude={data.latitude}
            longitude={data.longitude}
            apiKey={data.apiKey}
            zoom={12}
            secondaryMarker={KULT}
          />
        </Box>
      )}

      <Section title="Kontakt">
        <Text>{data.contactName}</Text>
        {data.contactPhone && (
          <Link href={`tel:${data.contactPhone}`}>{data.contactPhone}</Link>
        )}
        <Link href={`mailto:${data.email}`}>{data.email}</Link>
        <Box mt="3">
          <Button size="sm" variant="outline" onClick={onContact}>
            Per E-Mail kontaktieren
          </Button>
        </Box>
        {/* Mutation stubbed: marking as contacted is not wired up yet. */}
        <Checkbox mt="2" checked={data.contactedByViewerId != null} disabled>
          Kontaktiert
        </Checkbox>
      </Section>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Right column — social stats, rating, tags, comments
// ---------------------------------------------------------------------------

function RightColumn({data}: {data: DetailData}) {
  const ratings = data.bandApplicationRating;
  const averageRating =
    ratings.length === 0
      ? null
      : ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

  const hasSocial =
    data.website || data.facebook || data.instagram || data.spotifyArtist;

  // Computed (non-editable) tags: reuse the booking table's single computation,
  // run against the row the parent route already loaded (no recompute here).
  const rows = useLoaderData({from: '/crew/booking/$eventId'});
  const row = rows.find((r) => r.id === data.id);
  const dynamicTags = row ? computedTagsFor(row) : [];

  return (
    <Stack gap="5">
      {hasSocial && (
        <HStack gap="2" w="full" align="stretch">
          {data.website && (
            <SocialStat
              href={data.website}
              icon={<FaGlobe />}
              label="Webseite"
            />
          )}
          {data.facebook && (
            <SocialStat
              href={data.facebook}
              icon={<FaFacebook />}
              label="Facebook"
              value={data.facebookLikes}
            />
          )}
          {data.instagram && (
            <SocialStat
              href={`https://instagram.com/${data.instagram}`}
              icon={<FaInstagram />}
              label="Instagram"
              value={data.instagramFollower}
            />
          )}
          {data.spotifyArtist && (
            <SocialStat
              href={`https://open.spotify.com/artist/${data.spotifyArtist}`}
              icon={<FaSpotify />}
              label="Spotify"
              value={data.spotifyMonthlyListeners}
            />
          )}
        </HStack>
      )}

      <Section title="Bewertung">
        <BandApplicationRating
          applicationId={data.id}
          myRating={data.myRating}
          averageRating={averageRating}
          raters={ratings.map((r) => ({
            id: r.viewer.id,
            displayName: r.viewer.displayName,
            profilePicture: r.viewer.profilePicture,
            rating: r.rating,
          }))}
          size="lg"
        />
      </Section>

      <Section title="Tags">
        <BandTags
          initialTags={data.BandApplicationTag.map((t) => t.tag)}
          dynamicTags={dynamicTags}
        />
      </Section>

      <Section title="Bühne">
        <StageMatrix />
      </Section>

      <Section title="Kommentare">
        <CommentForm applicationId={data.id} />
        {data.bandApplicationComment.length > 0 && (
          <Stack gap="3" mt="4">
            {data.bandApplicationComment.map((c) => (
              <HStack key={c.id} gap="2" align="flex-start">
                <Avatar
                  name={c.viewer.displayName}
                  src={c.viewer.profilePicture ?? undefined}
                  size="xs"
                  mt="0.5"
                />
                <Box>
                  <HStack gap="2">
                    <Text fontWeight="medium" fontSize="sm">
                      {c.viewer.displayName}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      <DateString 
                        date={c.createdAt}
                        options={{
                          timeZone: 'Europe/Berlin',
                          day: 'numeric',
                          month: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }}
                      />
                    </Text>
                  </HStack>
                  <Text fontSize="sm" whiteSpace="pre-wrap">
                    {c.comment}
                  </Text>
                </Box>
              </HStack>
            ))}
          </Stack>
        )}
      </Section>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

// Tags combobox (Chakra TagsInput + Combobox). Suggests from the full set of
// existing tags loaded from the backend; allows adding new ones too. Computed
// `dynamicTags` are shown as non-deletable chips. Local state only for now —
// not wired to a mutation.
function BandTags({
  initialTags,
  dynamicTags,
}: {
  initialTags: string[];
  dynamicTags: {label: string; colorPalette: string}[];
}) {
  const {data: options = []} = useQuery({
    queryKey: ['bandApplicationTags'],
    queryFn: () => listBandApplicationTags(),
  });
  const [value, setValue] = useState<string[]>(initialTags);

  const {contains} = useFilter({sensitivity: 'base'});
  const {collection, filter, set} = useListCollection<{
    label: string;
    value: string;
  }>({
    initialItems: [],
    filter: contains,
  });

  // Keep the suggestion list in sync once the tags query resolves.
  useEffect(() => {
    set(options.map((t) => ({label: t, value: t})));
  }, [options, set]);

  const uid = useId();
  const ids = {input: `tags-input-${uid}`, control: `tags-control-${uid}`};

  const tags = useTagsInput({
    ids,
    value,
    onValueChange: (e) => setValue(e.value),
    // Free-form: allow new tags, just no duplicates.
    validate: (e) => !e.value.includes(e.inputValue.trim()),
  });

  const combobox = useCombobox({
    ids,
    collection,
    value: [],
    selectionBehavior: 'clear',
    onInputValueChange: (e) => filter(e.inputValue),
    onValueChange: (e) => tags.addValue(e.value[0]),
  });

  return (
    <Combobox.RootProvider value={combobox}>
      <TagsInput.RootProvider value={tags}>
        <TagsInput.Control>
          {/* Computed tags: shown as chips with no delete trigger. */}
          {dynamicTags.map((t) => (
            <Tag key={t.label} colorPalette={t.colorPalette} size="md">
              {t.label}
            </Tag>
          ))}
          {tags.value.map((tag, index) => (
            <TagsInput.Item key={tag} index={index} value={tag}>
              <TagsInput.ItemPreview>
                <TagsInput.ItemText>{tag}</TagsInput.ItemText>
                <TagsInput.ItemDeleteTrigger />
              </TagsInput.ItemPreview>
            </TagsInput.Item>
          ))}
          <Combobox.Input unstyled asChild>
            <TagsInput.Input placeholder="Tag hinzufügen…" />
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

function Fact({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <Text fontWeight="bold">
      {label}:{' '}
      <Span fontWeight="normal" color="fg.muted">
        {children}
      </Span>
    </Text>
  );
}

function CommentForm({applicationId}: {applicationId: string}) {
  const router = useRouter();
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!comment.trim()) return;
    try {
      setIsSubmitting(true);
      await postBandApplicationComment({
        data: {applicationId, comment: comment.trim()},
      });
      setComment('');
      await router.invalidate();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Box mb="3" position="relative">
      <Textarea
        placeholder="Kommentar hinzufügen..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSubmitting}
        rows={3}
        pr="12"
      />
      <Box position="absolute" bottom="3" right="3">
        <IconButton
          aria-label="Kommentar posten"
          icon={<FaPaperPlane fontSize="16px" />}
          onClick={handleSubmit}
          disabled={!comment.trim() || isSubmitting}
          loading={isSubmitting}
          bg="blue.solid"
          color="white"
          rounded="full"
          size="sm"
          _hover={{bg: 'blue.600'}}
          _disabled={{bg: 'gray.300', cursor: 'not-allowed'}}
        />
      </Box>
    </Box>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Heading size="sm" mb="1">
        {title}
      </Heading>
      {children}
    </Box>
  );
}

// Stage-assignment grid: rows are time slots (early/mid/late-headliner), columns
// are the three stages with an "either of the two" column between each pair.
// Single-select; clicking the selected cell clears it. State is local-only for
// now (no mutation wired up yet). Implemented as an ARIA grid: cells use
// aria-selected, focus rove with arrow keys, Enter/Space toggles.
// Only the first/last slots are labelled; the middle one is left blank. `aria`
// keeps an accessible name for every row regardless of the visible label.
const STAGE_ROWS = [
  {label: 'früh', aria: 'Früh'},
  {label: '', aria: 'Mitte'},
  {label: 'spät', aria: 'Spät (Headliner)'},
];
// '' columns sit between two stages and mean "either of the neighbours".
// Soft hyphens (­) let the long names break across two lines in the narrow
// column headers.
const STAGE_COLS = ['Große Bühne', '', 'Kult­bühne', '', 'Wald­bühne'];

// Accessible label for a column, spelling out the "between" columns.
function colLabel(ci: number): string {
  return STAGE_COLS[ci] || `${STAGE_COLS[ci - 1]} oder ${STAGE_COLS[ci + 1]}`;
}

const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));

// Square cell size: equal column width and row height makes the dot-to-dot
// pitch identical horizontally and vertically.
const STAGE_CELL = '2.75rem';

function StageMatrix() {
  const [selected, setSelected] = useState<string | null>(null);
  // Roving-tabindex focus position: only this cell is in the tab order.
  const [focus, setFocus] = useState({r: 0, c: 0});
  const gridRef = useRef<HTMLDivElement>(null);

  // Arrow keys move the selection directly (and the focus with it).
  const moveSelect = (r: number, c: number) => {
    const next = {
      r: clamp(r, STAGE_ROWS.length - 1),
      c: clamp(c, STAGE_COLS.length - 1),
    };
    setFocus(next);
    setSelected(`${next.r}:${next.c}`);
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-pos="${next.r}:${next.c}"]`)
      ?.focus();
  };

  const toggle = (r: number, c: number) => {
    const key = `${r}:${c}`;
    setSelected((s) => (s === key ? null : key));
    setFocus({r, c});
  };

  const onCellKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        moveSelect(r, c + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        moveSelect(r, c - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveSelect(r + 1, c);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveSelect(r - 1, c);
        break;
      // Space/Enter toggles the current cell (clears it when already selected).
      case 'Enter':
      case ' ':
        e.preventDefault();
        toggle(r, c);
        break;
    }
  };

  return (
    // Outer 2×2 layout: (0,0) empty · (0,1) column legend · (1,0) row legend ·
    // (1,1) the dot grid. Legends live here (flex) instead of inside the grid.
    <Grid templateColumns="auto auto" w="fit-content" columnGap="2" rowGap="1">
      {/* (0,0) empty corner */}
      <Box />

      {/* (0,1) column legend — one slot per grid column (empty slots sit over
          the "between" columns). Confining each label to a single column width
          lets the soft hyphens wrap Kult/Waldbühne automatically. Pinned to the
          grid's width so the labels can't widen the shared column. */}
      <Flex aria-hidden w={`calc(${STAGE_CELL} * 5)`}>
        {STAGE_COLS.map((label, i) => (
          <Text
            key={i}
            flex="1"
            minW="0"
            textAlign="center"
            fontSize="xs"
            fontWeight="medium"
            color="fg.muted"
            lineHeight="1.2"
          >
            {label}
          </Text>
        ))}
      </Flex>

      {/* (1,0) row legend — right-aligned against the grid. */}
      <Flex direction="column" align="stretch" aria-hidden>
        {STAGE_ROWS.map((row, ri) => (
          <Flex key={ri} h={STAGE_CELL} align="center" pr="2">
            <Text
              w="full"
              textAlign="right"
              fontSize="xs"
              color="fg.muted"
              whiteSpace="nowrap"
            >
              {row.label}
            </Text>
          </Flex>
        ))}
      </Flex>

      {/* (1,1) the dot grid */}
      <Grid
        ref={gridRef}
        role="grid"
        aria-label="Bühne und Slot"
        templateColumns={`repeat(5, ${STAGE_CELL})`}
        gap="0"
        borderRadius="md"
        _focusWithin={{
          outline: '2px solid',
          outlineColor: 'blue.solid',
          outlineOffset: '-1px',
        }}
      >
        {STAGE_ROWS.map((row, ri) => (
          <Box key={ri} role="row" display="contents">
            {STAGE_COLS.map((_, ci) => {
              const isSelected = selected === `${ri}:${ci}`;
              // Boundary edges form a single border around the whole cell block.
              const firstRow = ri === 0;
              const lastRow = ri === STAGE_ROWS.length - 1;
              const firstCol = ci === 0;
              const lastCol = ci === STAGE_COLS.length - 1;
              return (
                <Flex
                  key={ci}
                  className="group"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={`${row.aria}, ${colLabel(ci)}`}
                  data-pos={`${ri}:${ci}`}
                  tabIndex={focus.r === ri && focus.c === ci ? 0 : -1}
                  justify="center"
                  align="center"
                  boxSize={STAGE_CELL}
                  cursor="pointer"
                  borderColor="border"
                  borderTopWidth={firstRow ? '1px' : undefined}
                  borderBottomWidth={lastRow ? '1px' : undefined}
                  borderLeftWidth={firstCol ? '1px' : undefined}
                  borderRightWidth={lastCol ? '1px' : undefined}
                  borderTopLeftRadius={firstRow && firstCol ? 'md' : undefined}
                  borderTopRightRadius={firstRow && lastCol ? 'md' : undefined}
                  borderBottomLeftRadius={
                    lastRow && firstCol ? 'md' : undefined
                  }
                  borderBottomRightRadius={
                    lastRow && lastCol ? 'md' : undefined
                  }
                  outline="none"
                  onClick={() => toggle(ri, ci)}
                  onKeyDown={(e) => onCellKeyDown(e, ri, ci)}
                >
                  <Box
                    boxSize={isSelected ? '3' : '1'}
                    borderRadius="full"
                    bg={isSelected ? 'blue.solid' : 'gray.300'}
                    outline={isSelected ? '2px solid' : undefined}
                    outlineColor="blue.solid"
                    outlineOffset="2px"
                    _groupHover={
                      isSelected
                        ? undefined
                        : {
                            boxSize: '2',
                            bg: 'gray.400',
                            // Fast grow on hover-in…
                            transition:
                              'width 0.15s ease, height 0.15s ease, background 0.15s ease',
                          }
                    }
                    // Fast when selecting; slow shrink back on hover-out.
                    transition={
                      isSelected
                        ? 'width 0.15s ease, height 0.15s ease, background 0.15s ease, outline-color 0.15s ease'
                        : 'width 0.8s ease, height 0.8s ease, background 0.8s ease'
                    }
                  />
                </Flex>
              );
            })}
          </Box>
        ))}
      </Grid>
    </Grid>
  );
}

// Long free-text (band description) clamped to a few lines with a "mehr"/
// "weniger" toggle. The toggle only appears when the text actually overflows,
// measured once the clamped paragraph has laid out.
function ExpandableText({
  children,
  lines = 5,
}: {
  children: string;
  lines?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    }
  }, [children, lines]);

  return (
    <Box>
      <Text
        ref={ref}
        whiteSpace="pre-wrap"
        lineClamp={expanded ? undefined : lines}
      >
        {children}
      </Text>
      {(overflows || expanded) && (
        <Button
          variant="plain"
          size="sm"
          px="0"
          h="auto"
          color="blue.solid"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'weniger' : 'mehr'}
        </Button>
      )}
    </Box>
  );
}

function SocialStat({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value?: number | null;
}) {
  return (
    <Link href={href} target="_blank" rel="noreferrer" flex="1" minW="0">
      <Flex direction="column" align="center" gap="1" w="full">
        <Box fontSize="2xl">{icon}</Box>
        <Text fontSize="md" fontWeight="bold" truncate maxW="full">
          {value != null ? value.toLocaleString('de-DE') : label}
        </Text>
      </Flex>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Demo embed (YouTube / Spotify / Bandcamp / Soundcloud), ported from legacy
// ---------------------------------------------------------------------------

// Per-provider embed config: how to build the iframe src from `demoEmbed` and
// how the iframe is sized (16:9 video vs fixed-height audio player).
const DEMO_EMBEDS: Partial<
  Record<
    DemoEmbedType,
    {src: (id: string) => string; aspectRatio?: number; height?: string}
  >
> = {
  [DemoEmbedType.YouTubeVideo]: {
    aspectRatio: 16 / 9,
    src: (id) =>
      `https://www.youtube.com/embed/${id}?autoplay=0&fs=0&iv_load_policy=3&showinfo=0&rel=0&cc_load_policy=0`,
  },
  [DemoEmbedType.YouTubePlaylist]: {
    aspectRatio: 16 / 9,
    src: (id) => `https://www.youtube.com/embed/videoseries?list=${id}`,
  },
  [DemoEmbedType.SpotifyAlbum]: {
    height: '352px',
    src: (id) => `https://open.spotify.com/embed/album/${id}`,
  },
  [DemoEmbedType.SpotifyTrack]: {
    height: '352px',
    src: (id) => `https://open.spotify.com/embed/track/${id}`,
  },
  [DemoEmbedType.SpotifyArtist]: {
    height: '352px',
    src: (id) => `https://open.spotify.com/embed/artist/${id}`,
  },
  [DemoEmbedType.BandcampAlbum]: {
    height: '120px',
    src: (id) =>
      `https://bandcamp.com/EmbeddedPlayer/album=${id}/size=large/bgcol=ffffff/linkcol=0687f5/artwork=small/transparent=true/`,
  },
  [DemoEmbedType.BandcampTrack]: {
    height: '120px',
    src: (id) =>
      `https://bandcamp.com/EmbeddedPlayer/track=${id}/size=large/bgcol=ffffff/linkcol=0687f5/artwork=small/transparent=true/`,
  },
  [DemoEmbedType.SoundcloudUrl]: {
    height: '166px',
    src: (id) =>
      `https://w.soundcloud.com/player/?url=${encodeURIComponent(
        id,
      )}&auto_play=false`,
  },
};

function Demo({
  demo,
  demoEmbed,
  demoEmbedType,
}: {
  demo: string | null;
  demoEmbed: string | null;
  demoEmbedType: DemoEmbedType | null;
}) {
  const config = demoEmbedType ? DEMO_EMBEDS[demoEmbedType] : undefined;
  const embed = config ? config.src(demoEmbed ?? '') : undefined;
  const {aspectRatio, height} = config ?? {};

  return (
    <Stack gap="2">
      {embed && (
        <Box
          asChild
          w="full"
          aspectRatio={aspectRatio}
          h={height}
          borderRadius={aspectRatio ? 'md' : undefined}
          overflow="hidden"
        >
          <iframe
            src={embed}
            allow="autoplay; encrypted-media"
            style={{border: 0}}
          />
        </Box>
      )}
      {demo && (
        <Link href={demo} target="_blank" rel="noreferrer" truncate>
          {demo}
        </Link>
      )}
    </Stack>
  );
}
