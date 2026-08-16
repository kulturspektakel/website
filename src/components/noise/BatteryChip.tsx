import {Tooltip} from '../chakra-snippets/tooltip';
import {formatBatteryHoursLeft, formatBatteryPercent} from './batteryCurve';
import {Chip} from './Chip';

// A monitor's charge as a chip of its own — the toolbar, where it sits beside the stage it
// is standing at and has to look like its sibling. A percentage and not the voltage it was
// read from: 1.9 V is a number you have to know the cell to read, and the question being
// asked is whether the monitor lasts the night. The tooltip answers that question in its
// own terms — the hours, and nothing else, the percentage being what you were already
// looking at. Inside a device badge the two are one line instead (see DeviceBadge), because
// there the chip is not there to have said the first half.
export function BatteryChip({mv}: {mv: number}) {
  return (
    <Tooltip content={formatBatteryHoursLeft(mv)} showArrow>
      <Chip whiteSpace="nowrap">{formatBatteryPercent(mv)}</Chip>
    </Tooltip>
  );
}
