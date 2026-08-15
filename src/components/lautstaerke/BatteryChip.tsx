import {Chip} from './Chip';
import {formatBatteryVolts} from './noise';

// A monitor's cell voltage as a chip of its own — the toolbar, where it sits beside the
// stage it is standing at and has to look like its sibling. Inside a device badge the
// voltage is a word in a line rather than a box (see DeviceBadge); both read the same
// number through formatBatteryVolts.
export function BatteryChip({mv}: {mv: number}) {
  return <Chip whiteSpace="nowrap">{formatBatteryVolts(mv)}</Chip>;
}
