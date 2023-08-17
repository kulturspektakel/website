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

function isSameMonth(from: Date, to: Date) {
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

function isSameYear(from: Date, to: Date) {
  const format: Intl.DateTimeFormatOptions = {
    timeZone,
    year: 'numeric',
  };
  return (
    from.toLocaleDateString(locale, format) ===
    to.toLocaleDateString(locale, format)
  );
}

export default function DateString({
  date,
  to,
  options = {
    timeZone,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  },
  until = 'bis',
}: {
  date: Date;
  to?: Date;
  options?: Intl.DateTimeFormatOptions;
  until?: string;
}) {
  // always force to Berlin timezone
  options = {...options, timeZone};

  const dateString = date.toLocaleDateString(locale, options);
  const dateElement = <time dateTime={date.toISOString()}>{dateString}</time>;
  if (to == null || isSameDay(date, to)) {
    // same day
    return dateElement;
  }

  const toString = to.toLocaleDateString(locale, options);
  const toElement = <time dateTime={date.toISOString()}>{toString}</time>;
  let connectingElement = <> {until} </>;
  if (isSameDay(new Date(date.getDate() + 1), to)) {
    connectingElement = <> und </>;
  }

  if (isSameMonth(date, to)) {
    // same month
    return (
      <>
        <time dateTime={date.toISOString()}>
          {date.toLocaleDateString(locale, {
            timeZone,
            day: options.day,
          })}
          .
        </time>
        {connectingElement}
        {toElement}
      </>
    );
  } else if (isSameYear(date, to)) {
    // different month
    return (
      <>
        <time dateTime={date.toISOString()}>
          {date.toLocaleDateString(locale, {
            timeZone,
            day: options.day,
            month: options.month,
          })}
        </time>
        {connectingElement}
        {toElement}
      </>
    );
  } else {
    // different year
    return (
      <>
        <time dateTime={date.toISOString()}>{dateString}</time>
        {connectingElement}
        {toElement}
      </>
    );
  }
}
