import {useEffect, useId, useRef, useState} from 'react';
import {
  createFileRoute,
  notFound,
  Outlet,
  useLoaderData,
  useRouter,
} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {crewAuth} from '../server/crewAuth';
import {postBandApplicationComment} from '../server/postBandApplicationComment';
import {useQuery, useQueryClient} from '@tanstack/react-query';
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
  Spinner,
  Stack,
  TagsInput,
  Text,
  Textarea,
  useCombobox,
  useFilter,
  useListCollection,
  useTagsInput,
} from '@chakra-ui/react';
import {
  FaFacebook,
  FaGlobe,
  FaInstagram,
  FaSpotify,
  FaPaperPlane,
  FaStar,
  FaMusic,
} from 'react-icons/fa6';
import {
  BandRepertoire,
  DemoEmbedType,
  PreviouslyPlayed,
} from '../generated/prisma/browser';
import {prismaClient} from '../server/prismaClient.server';
import {Avatar} from '../components/chakra-snippets/avatar';
import {BandName} from '../components/booking/BandName';
import {BandApplicationRating} from '../components/booking/BandApplicationRating';
import {Tag} from '../components/chakra-snippets/tag';
import {Tooltip} from '../components/chakra-snippets/tooltip';
import DateString from '../components/DateString';
import {
  DialogBody,
  DialogHeader,
  DialogTitle,
} from '../components/chakra-snippets/dialog';
import {
  TimelineConnector,
  TimelineContent,
  TimelineDescription,
  TimelineItem,
  TimelineRoot,
  TimelineTitle,
} from '../components/chakra-snippets/timeline';
import GoogleMaps from '../components/GoogleMaps';
import {CopyToClipboard} from '../components/CopyToClipboard';
import {StageMatrix} from '../components/booking/StageMatrix';
import {toStageValue, type StageValue} from '../components/booking/stageMatrixShared';
import {setBandApplicationStage} from '../server/setBandApplicationStage';
import {meanRating} from '../utils/meanRating';
import {normalizeBandName} from '../utils/normalizeBandName';
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
        stageRow: true,
        stageColumn: true,
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
          orderBy: {createdAt: 'asc'},
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

    // Build the band's history timeline. A band has no stable id — it's matched
    // across events by its normalized name (same approach as the booking
    // table's `playedLastYear`). Fetch all applications + performances with a
    // lean select and filter in JS so the exact normalization is reused.
    const norm = normalizeBandName(a.bandname);
    const [allApplications, allPerformances] = await Promise.all([
      prismaClient.bandApplication.findMany({
        select: {
          id: true,
          bandname: true,
          createdAt: true,
          lastContactedAt: true,
          event: {select: {name: true}},
          contactedByViewer: {select: {displayName: true}},
          bandApplicationRating: {select: {rating: true}},
        },
      }),
      prismaClient.bandPlaying.findMany({
        select: {
          name: true,
          startTime: true,
          endTime: true,
          area: {select: {displayName: true}},
          event: {select: {name: true}},
        },
      }),
    ]);

    const timeline: TimelineEntry[] = [];
    for (const x of allApplications) {
      if (normalizeBandName(x.bandname) !== norm) {
        continue;
      }
      // The current application is already the subject of the dialog — only
      // show applications from other events in the history.
      if (x.id !== id) {
        const ratings = x.bandApplicationRating.map((r) => r.rating);
        timeline.push({
          kind: 'application',
          date: x.createdAt,
          eventName: x.event.name,
          ratingAvg: ratings.length ? meanRating(x.bandApplicationRating) : null,
          ratingCount: ratings.length,
        });
      }
      // Mark as contacted when the contacting person is known (same signal as
      // the "contacted" tag: `contactedByViewerId != null`). Older rows have no
      // `lastContactedAt` timestamp, so fall back to the application date for
      // ordering and hide the date in the UI when it's missing.
      if (x.contactedByViewer) {
        timeline.push({
          kind: 'contact',
          date: x.lastContactedAt ?? x.createdAt,
          contactedAt: x.lastContactedAt,
          eventName: x.event.name,
          contactedBy: x.contactedByViewer.displayName,
        });
      }
    }
    for (const x of allPerformances) {
      if (normalizeBandName(x.name) !== norm) {
        continue;
      }
      timeline.push({
        kind: 'performance',
        date: x.startTime,
        endTime: x.endTime,
        eventName: x.event.name,
        stage: x.area.displayName,
      });
    }
    // Newest first.
    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

    const myViewerId = context.viewer?.id ?? null;
    return {
      ...a,
      myRating:
        a.bandApplicationRating.find((r) => r.viewer.id === myViewerId)
          ?.rating ?? 0,
      timeline,
      apiKey: process.env.GOOGLE_MAPS_API_KEY,
    };
  });

type TimelineEntry =
  | {
      kind: 'application';
      date: Date;
      eventName: string;
      ratingAvg: number | null;
      ratingCount: number;
    }
  | {
      kind: 'contact';
      date: Date;
      contactedAt: Date | null;
      eventName: string;
      contactedBy: string;
    }
  | {
      kind: 'performance';
      date: Date;
      endTime: Date;
      eventName: string;
      stage: string;
    };

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

// Add a tag to an application (idempotent — the [bandApplicationId, tag] pair is
// unique, and `tag` is citext so case-insensitive). Attributed to the crew
// member via context.viewer.
const addBandApplicationTag = createServerFn()
  .middleware([crewAuth])
  .inputValidator(
    z.object({applicationId: z.string(), tag: z.string().trim().min(1)}),
  )
  .handler(async ({data, context}) => {
    const viewerId = context.viewer?.id;
    if (!viewerId) {
      throw new Error('Unauthorized');
    }
    await prismaClient.bandApplicationTag.upsert({
      where: {
        bandApplicationId_tag: {
          bandApplicationId: data.applicationId,
          tag: data.tag,
        },
      },
      create: {
        bandApplicationId: data.applicationId,
        tag: data.tag,
        createdByViewerId: viewerId,
      },
      update: {},
    });
  });

const removeBandApplicationTag = createServerFn()
  .middleware([crewAuth])
  .inputValidator(z.object({applicationId: z.string(), tag: z.string()}))
  .handler(async ({data, context}) => {
    if (!context.viewer?.id) {
      throw new Error('Unauthorized');
    }
    // deleteMany doesn't throw when the tag is already gone.
    await prismaClient.bandApplicationTag.deleteMany({
      where: {bandApplicationId: data.applicationId, tag: data.tag},
    });
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
  pendingComponent: BandApplicationDetailPending,
  // Pop the modal open (almost) immediately with a spinner rather than blocking
  // navigation until the detail query resolves.
  pendingMs: 100,
  loader: ({params}) => loadBandApplicationDetail({data: params.applicationId}),
});

// Loading state: rendered into the parent route's persistent dialog, so the
// shell is already on screen — just a centered spinner filling the dialog's max
// height while the detail loader is pending.
function BandApplicationDetailPending() {
  return (
    <>
      <DialogHeader>
        <DialogTitle />
      </DialogHeader>
      <DialogBody>
        <Flex justify="center" align="center" h="calc(100vh - 120px)">
          <Spinner size="xl" />
        </Flex>
      </DialogBody>
    </>
  );
}

// ---------------------------------------------------------------------------
// Loaded view — renders bare DialogHeader/DialogBody into the DialogContent the
// parent route ($eventId) keeps mounted; it has no dialog shell of its own.
// ---------------------------------------------------------------------------

function BandApplicationDetailRoute() {
  const data = Route.useLoaderData();
  const {eventId, applicationId} = Route.useParams();
  const navigate = Route.useNavigate();

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          <BandName
            bandname={data.bandname}
            genre={data.genre}
            genreCategory={data.genreCategory}
            imageUrl={data.imageUrl}
            size="md"
            copyableName
          />
        </DialogTitle>
      </DialogHeader>
      <DialogBody>
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
      </DialogBody>

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
        {data.contactPhone && <Text>{data.contactPhone}</Text>}
        <CopyToClipboard
          text={data.email}
          display="block"
          color="blue.solid"
          _hover={{textDecoration: 'underline'}}
        >
          {data.email}
        </CopyToClipboard>
        <Box mt="3">
          <Button size="sm" variant="outline" onClick={onContact}>
            Anfragen
          </Button>
        </Box>
      </Section>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Right column — social stats, rating, tags, comments
// ---------------------------------------------------------------------------

function RightColumn({data}: {data: DetailData}) {
  const router = useRouter();
  const myViewer = useLoaderData({from: '/crew'});
  const ratings = data.bandApplicationRating;
  const averageRating = meanRating(ratings);

  // Optimistic stage selection, seeded from the loader and re-synced when the
  // band changes (the modal shell is reused across bands, so this component can
  // stay mounted while `data` swaps).
  const [stage, setStage] = useState<StageValue>(() =>
    toStageValue(data.stageRow, data.stageColumn),
  );
  useEffect(() => {
    setStage(toStageValue(data.stageRow, data.stageColumn));
  }, [data.stageRow, data.stageColumn]);

  const onStageChange = (next: StageValue) => {
    setStage(next);
    setBandApplicationStage({
      data: {
        applicationId: data.id,
        row: next?.row ?? null,
        col: next?.col ?? null,
      },
    }).then(() => router.invalidate());
  };

  const hasSocial =
    data.website || data.facebook || data.instagram || data.spotifyArtist;

  // Computed (non-editable) tags: reuse the booking table's single computation,
  // run against the row the parent route already loaded (no recompute here).
  const rows = useLoaderData({from: '/crew/booking/$eventId'});
  const row = rows.find((r) => r.id === data.id);
  const dynamicTags = row ? computedTagsFor(row) : [];

  // Optimistic comments awaiting the loader refetch. Each carries its
  // applicationId: the modal shell is reused across bands, so this component can
  // stay mounted while `data.id` changes — scoping to the current band keeps a
  // pending comment from bleeding onto another. Merged after the loaded ones and
  // de-duped against them (same author + text) so the temporary entry never
  // briefly doubles up with the real one the refetch brings in.
  const loadedComments = data.bandApplicationComment;
  const [pendingComments, setPendingComments] = useState<
    ((typeof loadedComments)[number] & {applicationId: string})[]
  >([]);
  const comments = [
    ...loadedComments,
    ...pendingComments.filter(
      (p) =>
        p.applicationId === data.id &&
        !loadedComments.some(
          (c) => c.viewer.id === p.viewer.id && c.comment === p.comment,
        ),
    ),
  ];

  const postComment = async (comment: string) => {
    // Author an optimistic entry when we know the viewer (null in dev / for a
    // non-Slack account — then we just post and let the refetch reveal it).
    const optimistic = myViewer
      ? {
          id: `optimistic-${Date.now()}`,
          applicationId: data.id,
          comment,
          createdAt: new Date(),
          viewer: myViewer,
        }
      : null;
    if (optimistic) setPendingComments((p) => [...p, optimistic]);
    try {
      await postBandApplicationComment({data: {applicationId: data.id, comment}});
      await router.invalidate();
    } finally {
      if (optimistic) {
        setPendingComments((p) => p.filter((c) => c.id !== optimistic.id));
      }
    }
  };

  return (
    <Stack gap="5">
      {hasSocial && (
        <HStack gap="6" justify="flex-start" align="flex-start">
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
          myViewer={myViewer}
        />
      </Section>

      <Section title="Tags">
        <BandTags
          applicationId={data.id}
          initialTags={data.BandApplicationTag.map((t) => t.tag)}
          dynamicTags={dynamicTags}
        />
      </Section>

      <Section title="Bühne">
        <StageMatrix value={stage} onChange={onStageChange} />
      </Section>

      <Section title="Kommentare">
        {comments.length > 0 && (
          <Stack gap="3" mb="4">
            {comments.map((c) => (
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
        <CommentForm onPost={postComment} />
      </Section>

      {data.timeline.length > 0 && (
        <Section title="Verlauf">
          <BandTimeline timeline={data.timeline} />
        </Section>
      )}
    </Stack>
  );
}

// The band's history across all events (applications with rating, contacts, and
// performances), newest first. Assembled server-side in the detail loader.
function BandTimeline({timeline}: {timeline: TimelineEntry[]}) {
  return (
    <TimelineRoot size="lg" variant="solid">
      {timeline.map((e, i) => (
        <TimelineItem
          key={i}
          colorPalette={
            e.kind === 'application'
              ? 'blue'
              : e.kind === 'contact'
                ? 'green'
                : 'red'
          }
        >
          <TimelineConnector outline="none">
            {e.kind === 'application' ? (
              <FaStar />
            ) : e.kind === 'contact' ? (
              <FaPaperPlane />
            ) : (
              <FaMusic />
            )}
          </TimelineConnector>
          <TimelineContent gap="0">
            <TimelineTitle>
              {e.kind === 'application'
                ? `Bewerbung: ${e.eventName}`
                : e.kind === 'contact'
                  ? `Anfrage: ${e.eventName}`
                  : `Auftritt: ${e.eventName}`}
            </TimelineTitle>
            <TimelineDescription>
              {e.kind === 'application' && (
                <>
                  {e.ratingAvg != null
                    ? `${'★'.repeat(Math.round(e.ratingAvg))}${'☆'.repeat(
                        Math.max(0, 4 - Math.round(e.ratingAvg)),
                      )} (${e.ratingCount})`
                    : 'keine Bewertung'}{' '}
                  · <DateString date={e.date} />
                </>
              )}
              {e.kind === 'contact' && (
                <>
                  von {e.contactedBy}
                  {e.contactedAt ? (
                    <>
                      {' '}
                      · <DateString date={e.contactedAt} />
                    </>
                  ) : (
                    ''
                  )}
                </>
              )}
              {e.kind === 'performance' && (
                <>
                  {e.stage} ·{' '}
                  <DateString
                    date={e.date}
                    options={{
                      day: 'numeric',
                      month: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }}
                  />
                </>
              )}
            </TimelineDescription>
          </TimelineContent>
        </TimelineItem>
      ))}
    </TimelineRoot>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

// Tags combobox (Chakra TagsInput + Combobox). Suggests from the full set of
// existing tags loaded from the backend; allows adding new ones too. Computed
// `dynamicTags` are shown as non-deletable chips. Edits are persisted by
// diffing each change against the previous value and calling the add/remove
// server fns.
function BandTags({
  applicationId,
  initialTags,
  dynamicTags,
}: {
  applicationId: string;
  initialTags: string[];
  dynamicTags: {label: string; colorPalette: string}[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {data: options = []} = useQuery({
    queryKey: ['bandApplicationTags'],
    queryFn: () => listBandApplicationTags(),
  });
  const [value, setValue] = useState<string[]>(initialTags);

  // Persist a single add/remove, then refresh the suggestion list (a brand-new
  // tag should become suggestable) and the route (the booking table shows tags).
  const persist = (next: string[]) => {
    const added = next.filter((t) => !value.includes(t));
    const removed = value.filter((t) => !next.includes(t));
    setValue(next);
    Promise.all([
      ...added.map((tag) =>
        addBandApplicationTag({data: {applicationId, tag}}),
      ),
      ...removed.map((tag) =>
        removeBandApplicationTag({data: {applicationId, tag}}),
      ),
    ]).then(() => {
      queryClient.invalidateQueries({queryKey: ['bandApplicationTags']});
      router.invalidate();
    });
  };

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
    onValueChange: (e) => persist(e.value),
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

function CommentForm({onPost}: {onPost: (comment: string) => void}) {
  const [comment, setComment] = useState('');

  // Clear the textarea immediately — the comment shows up optimistically in the
  // list — and hand the post off to the parent (fire-and-forget).
  const handleSubmit = () => {
    const trimmed = comment.trim();
    if (!trimmed) return;
    setComment('');
    onPost(trimmed);
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
        rows={3}
        pr="12"
      />
      {comment.trim() && (
        <Box position="absolute" bottom="3" right="3">
          <IconButton
            aria-label="Kommentar posten"
            onClick={handleSubmit}
            bg="blue.solid"
            color="white"
            rounded="full"
            size="sm"
            _hover={{bg: 'blue.600'}}
          >
            <FaPaperPlane />
          </IconButton>
        </Box>
      )}
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
    <Link href={href} target="_blank" rel="noreferrer" w="20">
      <Flex direction="column" align="center" gap="1" w="full">
        <Box fontSize="2xl">{icon}</Box>
        <Text fontWeight="bold" whiteSpace="nowrap">
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
