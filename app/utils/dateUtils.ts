export const timeZone = 'Europe/Berlin';
export const locale = 'de-DE';

export function isSameDay(from: Date | string, to: Date | string) {
  const format: Intl.DateTimeFormatOptions = {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  };

  return (
    new Date(from).toLocaleDateString(locale, format) ===
    new Date(to).toLocaleDateString(locale, format)
  );
}

export function isSameMonth(from: Date | string, to: Date | string) {
  const format: Intl.DateTimeFormatOptions = {
    timeZone,
    year: 'numeric',
    month: 'numeric',
  };

  return (
    new Date(from).toLocaleDateString(locale, format) ===
    new Date(to).toLocaleDateString(locale, format)
  );
}

export function isSameYear(from: Date | string, to: Date | string) {
  const format: Intl.DateTimeFormatOptions = {
    timeZone,
    year: 'numeric',
  };
  return (
    new Date(from).toLocaleDateString(locale, format) ===
    new Date(to).toLocaleDateString(locale, format)
  );
}
