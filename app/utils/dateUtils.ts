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
