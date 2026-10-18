import {useMemo} from 'react';
import {useLoaderData, useParams} from '@tanstack/react-router';
import {Box, HStack, RatingGroup, Text} from '@chakra-ui/react';
import {Avatar} from '../chakra-snippets/avatar';
import {Tooltip} from '../chakra-snippets/tooltip';
import {
  type BookingRating,
  bookingCollections,
  ratingKey,
  toastOnFailure,
} from './bookingCollections';

// Per-star tooltip labels for the 1–4 rating.
export const RATING_LABELS = [
  'auf keinen Fall',
  'eher nicht',
  'eher schon',
  'auf jeden Fall',
];

// Avatar slots in the rater strip; beyond this the last slot becomes a "+N"
// chip listing the remaining names on hover.
const MAX_AVATARS = 4;

// Interactive 1–4 star rating for a band application, shared by the booking
// table and the detail modal. Shows the viewer's own rating and, once they have
// rated, the aggregate average + rater avatars beside it (blind-rating pattern).
// `raters` and `averageRating` come from the booking row; a click writes to the
// live ratings collection, which shows it optimistically everywhere (table and
// modal) and persists it via `rateBandApplication`.
export function BandApplicationRating({
  applicationId,
  raters,
  averageRating,
  size = 'md',
}: {
  applicationId: string;
  raters: BookingRating[];
  averageRating: number | null;
  size?: RatingGroup.RootProps['size'];
}) {
  const {eventId} = useParams({from: '/crew/booking/$eventId'});
  // null in dev (cookie never reaches localhost) or for a Directus account with
  // no Slack-keyed Viewer. Ratings are keyed on it, so such a viewer only sees
  // the stars read-only.
  const myViewer = useLoaderData({from: '/crew'});
  const value = raters.find((r) => r.viewerId === myViewer?.id)?.rating ?? 0;

  // Keep the avatar strip to at most MAX_AVATARS slots: show every rater when
  // they fit, otherwise trade the last slot for a "+N" chip that names the rest
  // on hover.
  const {shownRaters, hiddenRaters} = useMemo(
    () =>
      raters.length > MAX_AVATARS
        ? {
            shownRaters: raters.slice(0, MAX_AVATARS - 1),
            hiddenRaters: raters.slice(MAX_AVATARS - 1),
          }
        : {shownRaters: raters, hiddenRaters: []},
    [raters],
  );

  const onValueChange = (next: number) => {
    if (!myViewer) {
      return;
    }
    const {ratings} = bookingCollections(eventId);
    const key = ratingKey(myViewer.id, applicationId);
    let tx;
    if (ratings.has(key)) {
      tx =
        next === 0
          ? ratings.delete(key)
          : ratings.update(key, (draft) => {
              draft.rating = next;
            });
    } else if (next > 0) {
      tx = ratings.insert({
        viewerId: myViewer.id,
        bandApplicationId: applicationId,
        rating: next,
        displayName: myViewer.displayName,
        profilePicture: myViewer.profilePicture,
      });
    } else {
      return;
    }
    toastOnFailure(tx, 'Bewertung konnte nicht gespeichert werden');
  };

  return (
    // Stars, average, and avatars are three siblings with one uniform gap.
    <HStack align="center" gap="3">
      {/* Only the stars stop click propagation, so rating from a table row
          doesn't also open the detail modal; clicking the average/avatars still
          opens it. */}
      <RatingGroup.Root
        count={4}
        size={size}
        colorPalette="blue"
        value={value}
        readOnly={!myViewer}
        onValueChange={(e) => onValueChange(e.value)}
        onClick={(e) => e.stopPropagation()}
      >
        <RatingGroup.HiddenInput />
        <RatingGroup.Control>
          {RATING_LABELS.map((label, i) => (
            <Tooltip key={i} content={label} positioning={{placement: 'top'}}>
              <RatingGroup.Item index={i + 1}>
                <RatingGroup.ItemIndicator />
              </RatingGroup.Item>
            </Tooltip>
          ))}
        </RatingGroup.Control>
      </RatingGroup.Root>

      {(value > 0 || raters.length > 0) && (
        <>
          {/* Fixed-width slot for the average. The number is revealed only once
              the viewer has cast their own rating, but the slot is always
              reserved so the avatars never shift when it appears. Never shrunk
              or wrapped: squeezed, "4.0" would break at the dot. */}
          <Box minW="7" textAlign="end" flexShrink="0">
            {value > 0 && averageRating != null && (
              <Tooltip
                positioning={{placement: 'top'}}
                content={
                  <Box>
                    {raters.map((r) => (
                      <Text key={r.viewerId} whiteSpace="nowrap">
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
                  whiteSpace="nowrap"
                >
                  {averageRating.toFixed(1)}
                </Text>
              </Tooltip>
            )}
          </Box>
          <HStack gap="0">
            {shownRaters.map((r, i) => (
              <Tooltip
                key={r.viewerId}
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
            {hiddenRaters.length > 0 && (
              <Tooltip
                positioning={{placement: 'top'}}
                content={
                  <Box>
                    {hiddenRaters.map((r) => (
                      <Text key={r.viewerId} whiteSpace="nowrap">
                        {r.displayName}
                      </Text>
                    ))}
                  </Box>
                }
              >
                <Box
                  as="span"
                  display="inline-flex"
                  alignItems="center"
                  justifyContent="center"
                  ml="-1.5"
                  boxSize="6"
                  borderRadius="full"
                  borderWidth="2px"
                  borderColor="bg"
                  bg="bg.emphasized"
                  color="fg.muted"
                  fontSize="9px"
                  fontWeight="bold"
                  lineHeight="1"
                >
                  +{hiddenRaters.length}
                </Box>
              </Tooltip>
            )}
          </HStack>
        </>
      )}
    </HStack>
  );
}
