import {useEffect, useId, useMemo, useRef, useState} from 'react';
import {
  createFileRoute,
  notFound,
  Outlet,
  useLoaderData,
} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {crewAuth} from '../server/crewAuth';
import {
  Box,
  Button,
  Combobox,
  Flex,
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
import {LuChevronDown} from 'react-icons/lu';
import {
  FaFacebook,
  FaGlobe,
  FaInstagram,
  FaSpotify,
  FaPaperPlane,
  FaStar,
  FaMusic,
  FaRegTrashCan,
} from 'react-icons/fa6';
import {BandRepertoire, DemoEmbedType, GenreCategory, PreviouslyPlayed} from '../utils/enums';
import {and, eq, ne} from 'drizzle-orm';
import {db} from '../server/db.server';
import {bandApplication, bandPlaying} from '../server/db/schema';
import {Avatar} from '../components/chakra-snippets/avatar';
import {BandName} from '../components/booking/BandName';
import {BandApplicationRating} from '../components/booking/BandApplicationRating';
import {
  bookingCollections,
  hasTag,
  normalizeTag,
  tagKey,
  toastOnFailure,
  useLiveRows,
} from '../components/booking/bookingCollections';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from '../components/chakra-snippets/menu';
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
import {
  toStageValue,
  type StageValue,
} from '../components/booking/stageMatrixShared';
import {KULT_LOCATION} from '../utils/kultLocation';
import {meanRating} from '../utils/meanRating';
import {normalizeBandName} from '../utils/normalizeBandName';
import {spotifyArtistUrl} from '../utils/spotifyArtistId';
import {type BookingRow, useBookingRow} from './crew.booking.$eventId';

// ---------------------------------------------------------------------------
// Server function — lazy detail loader (runs only when the child route opens)
// ---------------------------------------------------------------------------

const loadBandApplicationDetail = createServerFn()
  .middleware([crewAuth])
  .validator(z.object({eventId: z.string(), applicationId: z.string()}))
  .handler(async ({data: {eventId, applicationId: id}}) => {
    // Only applications the booking table lists (this event, no DJs), so the
    // modal always has a live row to show.
    const a = await db.query.bandApplication.findFirst({
      where: and(
        eq(bandApplication.id, id),
        eq(bandApplication.eventId, eventId),
        ne(bandApplication.genreCategory, GenreCategory.DJ),
      ),
      columns: {
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
        // Rating, tags, stage and comments aren't loaded here: they come
        // live from the booking page's collections.
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
      db.query.bandApplication
        .findMany({
          columns: {
            id: true,
            bandname: true,
            createdAt: true,
            lastContactedAt: true,
          },
          with: {
            event: {columns: {name: true}},
            viewer: {columns: {displayName: true}},
            bandApplicationRatings: {columns: {rating: true}},
          },
        })
        .then((rows) =>
          rows.map(({viewer, bandApplicationRatings, ...x}) => ({
            ...x,
            contactedByViewer: viewer,
            bandApplicationRating: bandApplicationRatings,
          })),
        ),
      db.query.bandPlaying.findMany({
        columns: {name: true, startTime: true, endTime: true},
        with: {
          area: {columns: {displayName: true}},
          event: {columns: {name: true}},
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
          ratingAvg: ratings.length
            ? meanRating(x.bandApplicationRating)
            : null,
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
    // Newest first. Contacts without `lastContactedAt` share their application's
    // date, so break ties by lifecycle order (Bewerbung → Anfrage → Auftritt):
    // otherwise the stable sort keeps insertion order and the Anfrage lands
    // below — i.e. before — its own Bewerbung.
    const KIND_ORDER = {application: 0, contact: 1, performance: 2};
    timeline.sort(
      (a, b) =>
        b.date.getTime() - a.date.getTime() ||
        KIND_ORDER[b.kind] - KIND_ORDER[a.kind],
    );

    return {
      ...a,
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
  loader: ({params}) => loadBandApplicationDetail({data: params}),
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
  // The live row from the table, so a rename, rating, tag or stage change shows
  // up here as it happens. The loader only accepts applications the table
  // lists, so it's missing when the application was deleted or moved out of
  // the table (e.g. to DJ) while open — or, for a moment, when it's so new
  // that its row hasn't arrived over Realtime yet.
  const row = useBookingRow(applicationId);
  if (!row) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Bewerbung nicht gefunden</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text color="fg.muted">
            Diese Bewerbung gibt es in dieser Liste nicht (mehr).
          </Text>
        </DialogBody>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          <BandName
            bandname={row.bandname}
            genre={row.genre}
            genreCategory={row.genreCategory}
            imageUrl={row.imageUrl}
            size="md"
            copyableName
          />
        </DialogTitle>
      </DialogHeader>
      <DialogBody>
        <SimpleGrid columns={{base: 1, md: 2}} gap="6">
          <LeftColumn
            data={data}
            tags={row.tags}
            onContact={() =>
              navigate({
                to: '/crew/booking/$eventId/$applicationId/contact',
                params: {eventId, applicationId},
              })
            }
          />
          <RightColumn data={data} row={row} />
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
  tags,
  onContact,
}: {
  data: DetailData;
  tags: string[];
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
          {/* KULT_LOCATION as the second marker, so the map always frames the
              distance the band travels to the festival. */}
          <GoogleMaps
            latitude={data.latitude}
            longitude={data.longitude}
            apiKey={data.apiKey}
            zoom={12}
            secondaryMarker={KULT_LOCATION}
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
          <ContactMenu
            applicationId={data.id}
            tags={tags}
            onContact={onContact}
          />
        </Box>
      </Section>
    </Stack>
  );
}

// The band's answer to our offer, recorded as an ordinary tag: it then shows up
// in the tags field below, in the booking table's tag column and in its filters,
// without needing a column of its own.
const RESPONSE_TAGS = [
  {tag: 'abgesagt', label: 'als abgesagt markieren'},
  {tag: 'zugesagt', label: 'als zugesagt markieren'},
];

// Shows up at once in the tags field, the table and for everyone else.
function addTag(eventId: string, applicationId: string, tag: string) {
  toastOnFailure(
    bookingCollections(eventId).tags.insert({
      bandApplicationId: applicationId,
      tag,
    }),
    'Tag konnte nicht gespeichert werden',
  );
}

// Everything you can do about the offer, behind one button in the Kontakt
// section: write the mail, or record the answer that came back.
function ContactMenu({
  applicationId,
  tags,
  onContact,
}: {
  applicationId: string;
  tags: string[];
  onContact: () => void;
}) {
  const {eventId} = Route.useParams();

  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <Button size="sm" variant="outline">
          Anfrage
          <LuChevronDown />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem value="send" onClick={onContact}>
          Anfrage senden
        </MenuItem>
        {RESPONSE_TAGS.map(({tag, label}) => (
          <MenuItem
            key={tag}
            value={tag}
            // Already recorded — remove the chip in the tags field below if it
            // was a mistake. `tag` is citext, so stored casing may differ.
            disabled={hasTag(tags, tag)}
            onClick={() => addTag(eventId, applicationId, tag)}
          >
            {label}
          </MenuItem>
        ))}
      </MenuContent>
    </MenuRoot>
  );
}

// ---------------------------------------------------------------------------
// Right column — social stats, rating, tags, comments
// ---------------------------------------------------------------------------

function RightColumn({data, row}: {data: DetailData; row: BookingRow}) {
  const {eventId} = Route.useParams();
  const myViewer = useLoaderData({from: '/crew'});
  const live = bookingCollections(eventId);

  const onStageChange = (next: StageValue) =>
    toastOnFailure(
      live.applications.update(data.id, (draft) => {
        draft.stageRow = next?.row ?? null;
        draft.stageColumn = next?.col ?? null;
      }),
      'Bühne konnte nicht gespeichert werden',
    );

  const hasSocial =
    data.website || data.facebook || data.instagram || data.spotifyArtist;

  // Live, so other crew members' comments show up while the modal is open.
  const {comments} = row;

  const postComment = (comment: string) => {
    // null in dev / for a non-Slack account, which can't comment (the form is
    // disabled then).
    if (!myViewer) {
      return;
    }
    toastOnFailure(
      live.comments.insert({
        // Picked here so the optimistic comment and the synced one share a key.
        id: crypto.randomUUID(),
        createdAt: new Date(),
        viewerId: myViewer.id,
        displayName: myViewer.displayName,
        profilePicture: myViewer.profilePicture,
        bandApplicationId: data.id,
        comment,
      }),
      'Kommentar konnte nicht gespeichert werden',
    );
  };

  const deleteComment = (commentId: string) => {
    if (!window.confirm('Kommentar wirklich löschen?')) {
      return;
    }
    toastOnFailure(
      live.comments.delete(commentId),
      'Kommentar konnte nicht gelöscht werden',
    );
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
          {data.spotifyArtist && spotifyArtistUrl(data.spotifyArtist) && (
            <SocialStat
              href={spotifyArtistUrl(data.spotifyArtist)!}
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
          raters={row.raters}
          averageRating={row.averageRating}
          size="lg"
        />
      </Section>

      <Section title="Tags">
        <BandTags
          eventId={eventId}
          applicationId={data.id}
          tags={row.tags}
          dynamicTags={row.computedTags}
        />
      </Section>

      <Section title="Bühne">
        <StageMatrix
          value={toStageValue(row.stageRow, row.stageColumn)}
          onChange={onStageChange}
        />
      </Section>

      <Section title="Kommentare">
        {comments.length > 0 && (
          <Stack gap="3" mb="4">
            {comments.map((c) => (
              <HStack key={c.id} gap="2" align="flex-start">
                <Avatar
                  name={c.displayName}
                  src={c.profilePicture ?? undefined}
                  size="xs"
                  mt="0.5"
                />
                <Box>
                  <HStack gap="2">
                    <Text fontWeight="medium" fontSize="sm">
                      {c.displayName}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      <DateString
                        date={c.createdAt}
                        options={{
                          day: 'numeric',
                          month: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }}
                      />
                    </Text>
                    {/* Not while it's still being saved: the delete could
                        reach the server before the comment does. */}
                    {c.viewerId === myViewer?.id && c.$synced && (
                      <Tooltip
                        content="Kommentar löschen"
                        positioning={{placement: 'top'}}
                      >
                        <IconButton
                          aria-label="Kommentar löschen"
                          size="2xs"
                          variant="ghost"
                          color="fg.muted"
                          minW="4"
                          h="4"
                          _icon={{width: '3', height: '3'}}
                          onClick={() => deleteComment(c.id)}
                        >
                          <FaRegTrashCan />
                        </IconButton>
                      </Tooltip>
                    )}
                  </HStack>
                  <Text fontSize="sm" whiteSpace="pre-wrap">
                    <Linkified text={c.comment} />
                  </Text>
                </Box>
              </HStack>
            ))}
          </Stack>
        )}
        <CommentForm onPost={postComment} disabled={!myViewer} />
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
                      weekday: 'short',
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

// Tags combobox (Chakra TagsInput + Combobox). Suggests every tag already used
// in this event; allows adding new ones too. Computed `dynamicTags` are shown
// as non-deletable chips. `tags` is live, and an edit is diffed against it and
// written to the tags collection, which shows it at once everywhere.
function BandTags({
  eventId,
  applicationId,
  tags: value,
  dynamicTags,
}: {
  eventId: string;
  applicationId: string;
  tags: string[];
  dynamicTags: {label: string; colorPalette: string}[];
}) {
  const live = bookingCollections(eventId);
  // The event's tag vocabulary, so a booking round only proposes the tags the
  // crew actually settled on this year. `tag` is citext: one entry per tag,
  // whatever its casing.
  const eventTags = useLiveRows(live.tags);
  const options = useMemo(() => {
    const byKey = new Map(eventTags.map((t) => [normalizeTag(t.tag), t.tag]));
    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
  }, [eventTags]);

  const persist = (next: string[]) => {
    for (const tag of next.filter((t) => !hasTag(value, t))) {
      addTag(eventId, applicationId, tag);
    }
    for (const tag of value.filter((t) => !hasTag(next, t))) {
      toastOnFailure(
        live.tags.delete(tagKey(applicationId, tag)),
        'Tag konnte nicht entfernt werden',
      );
    }
  };

  const {contains} = useFilter({sensitivity: 'base'});
  const {collection, filter, set} = useListCollection<{
    label: string;
    value: string;
  }>({
    initialItems: [],
    filter: contains,
  });

  // Keep the suggestion list in sync with the event's live tag vocabulary.
  useEffect(() => {
    set(options.map((t) => ({label: t, value: t})));
  }, [options, set]);

  const uid = useId();
  const ids = {input: `tags-input-${uid}`, control: `tags-control-${uid}`};

  const tags = useTagsInput({
    ids,
    value,
    onValueChange: (e) => persist(e.value),
    // Free-form: allow new tags, just no duplicates (in any casing — `tag` is
    // citext).
    validate: (e) => !hasTag(e.value, e.inputValue),
  });

  const combobox = useCombobox({
    ids,
    collection,
    value: [],
    selectionBehavior: 'clear',
    // Show every suggestion as soon as the input is focused/clicked, before
    // anything is typed.
    openOnClick: true,
    // Tags stay free-form: the typed text needn't exist in the collection.
    // Without this the combobox swallows Enter on an unknown value (it
    // preventDefaults it as "rejected"), which would stop the tags-input
    // machine from turning it into a new tag.
    allowCustomValue: true,
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
              {/* Render the chip identical to the computed-tag chips above.
                  `unstyled` drops the tags-input preview recipe (its own
                  radius/height) so only the Tag styling applies; the close
                  button removes via the machine. */}
              <TagsInput.ItemPreview asChild unstyled>
                <Tag
                  colorPalette="gray"
                  size="md"
                  onClose={() =>
                    tags.setValue(tags.value.filter((v) => v !== tag))
                  }
                >
                  {tag}
                </Tag>
              </TagsInput.ItemPreview>
            </TagsInput.Item>
          ))}
          <Combobox.Input
            unstyled
            asChild
            onFocus={() => combobox.setOpen(true)}
          >
            <TagsInput.Input placeholder="Tag hinzufügen…" />
          </Combobox.Input>
        </TagsInput.Control>
        {/* No matches means no popover at all — the input stays free-form and
            Enter just creates the tag. */}
        {collection.size > 0 && (
          <Portal>
            <Combobox.Positioner>
              <Combobox.Content>
                {collection.items.map((item) => (
                  <Combobox.Item item={item} key={item.value}>
                    <Combobox.ItemText>{item.label}</Combobox.ItemText>
                    <Combobox.ItemIndicator />
                  </Combobox.Item>
                ))}
              </Combobox.Content>
            </Combobox.Positioner>
          </Portal>
        )}
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

function CommentForm({
  onPost,
  disabled,
}: {
  onPost: (comment: string) => void;
  // For a viewer without a Slack-linked account: comments are keyed on it.
  disabled: boolean;
}) {
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
        placeholder={
          disabled
            ? 'Kommentieren geht nur mit einem Slack-verknüpften Account'
            : 'Kommentar hinzufügen...'
        }
        disabled={disabled}
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

// Bare URLs pasted into a comment, rendered clickable. Only http(s) and
// `www.`-prefixed hosts qualify, so ordinary prose can't accidentally turn into
// a link.
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>]+/gi;

function Linkified({text}: {text: string}) {
  const nodes: React.ReactNode[] = [];
  let index = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    let url = match[0];
    // A URL at the end of a sentence shouldn't swallow the punctuation after
    // it — nor a closing paren it never opened ("(siehe https://x.com/a)").
    while (/[.,;:!?]$/.test(url) || (url.endsWith(')') && !url.includes('('))) {
      url = url.slice(0, -1);
    }
    if (!url) continue;

    if (match.index > index) nodes.push(text.slice(index, match.index));
    nodes.push(
      <Link
        key={match.index}
        href={url.startsWith('www.') ? `https://${url}` : url}
        target="_blank"
        rel="noreferrer"
      >
        {url}
      </Link>,
    );
    index = match.index + url.length;
  }
  nodes.push(text.slice(index));

  return <>{nodes}</>;
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
