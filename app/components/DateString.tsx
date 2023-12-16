import {
  timeZone,
  locale,
  isSameDay,
  isSameMonth,
  isSameYear,
} from '~/utils/dateUtils';

type Props = {
  date: Date;
  to?: Date;
  options?: Intl.DateTimeFormatOptions;
  until?: string;
  timeOnly?: boolean;
};

export function dateStringComponents({
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
}: Props): {
  date: string;
  connector?: string;
  to?: string;
} {
  // always force to Berlin timezone
  options = {...options, timeZone};

  let dateString = timeOnly
    ? date.toLocaleTimeString(locale, options)
    : date.toLocaleDateString(locale, options);
  if (to == null || isSameDay(date, to)) {
    // same day
    return {date: dateString};
  }

  const toString = to.toLocaleDateString(locale, options);
  let connector = ` ${until} `;
  if (isSameDay(new Date(date.getTime() + 24 * 60 * 60 * 1000), to)) {
    connector = ' und ';
  }

  if (isSameMonth(date, to)) {
    // same month
    return {
      date:
        date.toLocaleDateString(locale, {
          timeZone,
          day: options.day,
          weekday: options.weekday,
        }) + (options.weekday ? '' : '.'),
      connector,
      to: toString,
    };
  } else if (isSameYear(date, to)) {
    // different month
    return {
      date: date.toLocaleDateString(locale, {
        timeZone,
        day: options.day,
        weekday: options.weekday,
        month: options.month,
      }),
      connector,
      to: toString,
    };
  } else {
    // different year
    return {date: dateString, connector, to: toString};
  }
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
  timeOnly = false,
  until = 'bis',
}: Props) {
  const {
    date: dateString,
    connector,
    to: toString,
  } = dateStringComponents({
    date,
    to,
    options,
    until,
    timeOnly,
  });

  return (
    <>
      <time dateTime={date.toISOString()}>{dateString}</time>
      {connector != null ? connector : ''}
      {to && toString != null ? (
        <time dateTime={to.toISOString()}>{toString}</time>
      ) : (
        ''
      )}
    </>
  );
}
