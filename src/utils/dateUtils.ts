// The festival's timezone and locale, defined here and nowhere else.
//
// Everything is *stored* in UTC — Postgres timestamps, the ISO instants in URL
// search params, epoch milliseconds over the wire. This is purely a display
// concern: it's the zone whose wall-clock a date is rendered in, and the zone a
// wall-clock typed by a human (a datetime field, a device that doesn't report
// UTC) is interpreted as. Both directions are the same zone, so both use this.
//
// Every date shown to a human must pass it in, because the default is neither
// UTC nor Berlin — it's whatever zone the machine happens to be in, which on
// Vercel is UTC and on a laptop is anyone's guess. That means `{timeZone}` for
// Intl/toLocale* and `{in: tz(timeZone)}` for date-fns. dateUtils.test.ts fails
// the build if the literal reappears anywhere else.
export const timeZone = 'Europe/Berlin';
export const locale = 'de-DE';

export function isSameDay(from: Date, to: Date) {
  const format: Intl.DateTimeFormatOptions = {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  };

  return (
    from.toLocaleDateString(locale, format) ===
    to.toLocaleDateString(locale, format)
  );
}

export function isSameMonth(from: Date, to: Date) {
  const format: Intl.DateTimeFormatOptions = {
    timeZone,
    year: 'numeric',
    month: 'numeric',
  };

  return (
    from.toLocaleDateString(locale, format) ===
    to.toLocaleDateString(locale, format)
  );
}

export function isSameYear(from: Date, to: Date) {
  const format: Intl.DateTimeFormatOptions = {
    timeZone,
    year: 'numeric',
  };
  return (
    from.toLocaleDateString(locale, format) ===
    to.toLocaleDateString(locale, format)
  );
}
