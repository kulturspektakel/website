import {useEffect, useState} from 'react';
import {useRouter} from '@tanstack/react-router';
import {Box, HStack, RatingGroup, Text} from '@chakra-ui/react';
import {rateBandApplication} from '../../server/rateBandApplication';
import {Avatar} from '../chakra-snippets/avatar';
import {Tooltip} from '../chakra-snippets/tooltip';

// Per-star tooltip labels for the 1–4 rating.
export const RATING_LABELS = [
  'auf keinen Fall',
  'eher nicht',
  'eher schon',
  'auf jeden Fall',
];

type Rater = {
  id: string;
  displayName: string;
  profilePicture: string | null;
  rating: number;
};

// Interactive 1–4 star rating for a band application, shared by the booking
// table and the detail modal. Shows the viewer's own rating and, once they have
// rated, the aggregate average + rater avatars beside it (blind-rating pattern).
// Persists clicks via `rateBandApplication` and re-runs the active loaders.
export function BandApplicationRating({
  applicationId,
  myRating,
  averageRating,
  raters,
  size = 'md',
}: {
  applicationId: string;
  myRating: number;
  averageRating: number | null;
  raters: Rater[];
  size?: RatingGroup.RootProps['size'];
}) {
  const router = useRouter();
  // Optimistic local value; re-synced when the loader-driven prop changes.
  const [value, setValue] = useState(myRating);
  useEffect(() => setValue(myRating), [myRating]);

  const onValueChange = async (next: number) => {
    setValue(next);
    await rateBandApplication({data: {applicationId, rating: next}});
    await router.invalidate();
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
              reserved so the avatars never shift when it appears. */}
          <Box minW="7" textAlign="end">
            {value > 0 && averageRating != null && (
              <Text
                fontSize="lg"
                fontWeight="bold"
                lineHeight="1"
                color="blue.solid"
              >
                {averageRating.toFixed(1)}
              </Text>
            )}
          </Box>
          <HStack gap="0">
            {raters.map((r, i) => (
              <Tooltip
                key={r.id}
                content={`${r.displayName}: ${'★'.repeat(r.rating)}${'☆'.repeat(
                  Math.max(0, 4 - r.rating),
                )}`}
                positioning={{placement: 'top'}}
              >
                <Box as="span" display="inline-flex" ml={i === 0 ? '0' : '-1.5'}>
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
        </>
      )}
    </HStack>
  );
}
