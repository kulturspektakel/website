// A monitor's discharge curve, measured on the bench: the cell was run flat at the load the
// firmware actually draws and its voltage sampled at every percent of the way. The index
// *is* the percentage — BATTERY_CURVE_MV[0] is empty, [100] is full — which is what makes
// the lookup below an array index rather than a fit.
//
// The one thing to know before extending this: these are the *pre-divider* millivolts, the
// same number the device reports as `batteryMv`, measured through the 2:1 divider and so
// half the real cell voltage. `batteryPercent` takes `batteryMv` unchanged; anything that
// wanted the cell's own volts would have to double it. 1500 here is a cell at 3.00 V and
// 2085 one at 4.17 V, which is the whole of a LiPo's range.
const BATTERY_CURVE_MV: readonly number[] = [
  1500, 1517, 1532, 1546, 1558, 1569, 1580, 1589, 1599, 1608, 1618, 1630, 1642,
  1654, 1666, 1678, 1689, 1700, 1711, 1719, 1727, 1733, 1739, 1744, 1749, 1754,
  1759, 1764, 1771, 1778, 1785, 1791, 1798, 1804, 1809, 1815, 1820, 1826, 1831,
  1836, 1841, 1846, 1851, 1855, 1860, 1864, 1868, 1872, 1876, 1880, 1884, 1888,
  1892, 1896, 1899, 1903, 1906, 1910, 1913, 1916, 1920, 1923, 1926, 1930, 1934,
  1938, 1942, 1947, 1952, 1958, 1964, 1970, 1976, 1982, 1988, 1994, 2000, 2006,
  2011, 2016, 2020, 2023, 2027, 2030, 2032, 2035, 2037, 2039, 2041, 2044, 2046,
  2048, 2051, 2053, 2055, 2059, 2062, 2066, 2071, 2077, 2085,
];

// What a full cell lasts, from the same run. The measurement also gave an hours-left figure
// per percent, but it was that column divided by 100 at every single step — so the constant
// is the column, and keeping the numbers themselves would only be a second thing to keep in
// agreement with the first.
const BATTERY_FULL_HOURS = 37.92;

// Where a reading falls on the curve, 0…100 and fractional. The table climbs the whole way,
// so the first entry at or above the reading is the bracket it sits in and the percent is
// how far between that entry and the one before it — a monitor should not report the same
// charge for six millivolts running, which is what the nearest index alone would do.
//
// Off either end it clamps: below the empty sample the cell is done, and above the full one
// it is on the charger, and a curve extended past the points it was measured at is a guess
// dressed as a reading.
export function batteryPercent(mv: number): number {
  const i = BATTERY_CURVE_MV.findIndex((sample) => sample >= mv);
  // The two clamps, and they are two different answers rather than one edge case: nothing
  // in the table reaches the reading, so it is above the full sample; or the very first
  // entry does, so it is at or below the empty one. Folded into a single `i <= 0` they read
  // as one guard that then has to be taken apart again.
  if (i === -1) return 100;
  if (i === 0) return 0;
  const low = BATTERY_CURVE_MV[i - 1]!;
  const high = BATTERY_CURVE_MV[i]!;
  return i - 1 + (mv - low) / (high - low);
}

// The charge as time rather than as a fraction, which is the form the question is usually
// asked in ("does it last the night?"). Linear in the percent by construction — see
// BATTERY_FULL_HOURS.
export const batteryHoursLeft = (mv: number): number =>
  (BATTERY_FULL_HOURS * batteryPercent(mv)) / 100;

// The headline number, and the only one that goes in a chip: whole percent, because the
// curve is a bench measurement of one cell and a decimal place would claim a precision the
// monitors do not have between them.
export const formatBatteryPercent = (mv: number): string =>
  `${Math.round(batteryPercent(mv))} %`;

// The charge said the other way, for the tooltip behind the percentage — and only that, so
// that hovering a chip answers a question rather than repeating the one the chip already
// answered. Never the voltage either: that is a number about the cell, where everything
// here is a number about the evening. Approximate and says so, because the hours assume the
// load of the bench run; under one they stop being a figure worth rounding.
export function formatBatteryHoursLeft(mv: number): string {
  const hours = batteryHoursLeft(mv);
  return hours < 1 ? 'noch <1 h' : `noch ~${Math.round(hours)} h`;
}
