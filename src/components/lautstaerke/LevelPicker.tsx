import {HStack} from '@chakra-ui/react';
import {
  NativeSelectField,
  NativeSelectRoot,
} from '../chakra-snippets/native-select';
import {type Weighting} from './noise';
import {WEIGHTING_OPTIONS, metricOptions, type LevelMetric} from './level';

// The project header's two dropdowns: what every pin and every row on the page is
// showing. Two controls rather than one combined list, because the choices are
// independent — a single list would be eight labels to read through to change the
// weighting.
//
// Native selects rather than segmented controls: this sits in a header that already
// carries the live switch and the view switcher, and eight options' worth of
// segments would not fit beside them on a phone.
export function LevelPicker({
  live,
  weighting,
  metric,
  onWeighting,
  onMetric,
}: {
  // Only to label and to disable: the finest window is 1 s live and 1 min stored,
  // and there is no range Leq to show for an instant.
  live: boolean;
  weighting: Weighting;
  metric: LevelMetric;
  onWeighting: (weighting: Weighting) => void;
  onMetric: (metric: LevelMetric) => void;
}) {
  return (
    <HStack gap="2">
      <NativeSelectRoot size="xs" w="auto">
        <NativeSelectField
          aria-label="Frequenzbewertung"
          fontFamily="mono"
          value={weighting}
          onChange={(e) => onWeighting(e.target.value as Weighting)}
          items={WEIGHTING_OPTIONS}
        />
      </NativeSelectRoot>
      <NativeSelectRoot size="xs" w="auto">
        <NativeSelectField
          aria-label="Angezeigter Wert"
          fontFamily="mono"
          value={metric}
          onChange={(e) => onMetric(e.target.value as LevelMetric)}
          items={metricOptions(live)}
        />
      </NativeSelectRoot>
    </HStack>
  );
}
