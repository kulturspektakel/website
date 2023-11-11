import {
  timeZone,
  locale,
  isSameDay,
  isSameMonth,
  isSameYear,
} from '~/utils/dateUtils';

export default function DateString({
  date,
  to,
  options = {
    timeZone,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  },
  timeOnly = false,
  until = 'bis',
}: {
  date: Date;
  to?: Date;
  options?: Intl.DateTimeFormatOptions;
  until?: string;
  timeOnly?: boolean;
}) {
  // always force to Berlin timezone
  options = {...options, timeZone};

  const dateString = timeOnly
    ? date.toLocaleTimeString(locale, options)
    : date.toLocaleDateString(locale, options);
  const dateElement = <time dateTime={date.toISOString()}>{dateString}</time>;
  if (to == null || isSameDay(date, to)) {
    // same day
    return dateElement;
  }

  const toString = to.toLocaleDateString(locale, options);
  const toElement = <time dateTime={date.toISOString()}>{toString}</time>;
  let connectingElement = <> {until} </>;
  if (isSameDay(new Date(date.getTime() + 24 * 60 * 60 * 1000), to)) {
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
