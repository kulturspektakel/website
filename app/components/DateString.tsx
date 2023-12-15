import {
  timeZone,
  locale,
  isSameDay,
  isSameMonth,
  isSameYear,
} from '~/utils/dateUtils';

type Props = {
  date: string | Date;
  to?: string | Date;
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
  const dateD = new Date(date);
  const toD = to ? new Date(to) : undefined;

  let dateString = timeOnly
    ? dateD.toLocaleTimeString(locale, options)
    : dateD.toLocaleDateString(locale, options);
  if (toD == null || isSameDay(dateD, toD)) {
    // same day
    return {date: dateString};
  }

  const toString = toD.toLocaleDateString(locale, options);
  let connector = ` ${until} `;
  if (isSameDay(new Date(dateD.getTime() + 24 * 60 * 60 * 1000), toD)) {
    connector = ' und ';
  }

  if (isSameMonth(dateD, toD)) {
    // same month
    return {
      date:
        dateD.toLocaleDateString(locale, {
          timeZone,
          day: options.day,
          weekday: options.weekday,
        }) + (options.weekday ? '' : '.'),
      connector,
      to: toString,
    };
  } else if (isSameYear(dateD, toD)) {
    // different month
    return {
      date: dateD.toLocaleDateString(locale, {
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
      <time dateTime={new Date(date).toISOString()}>{dateString}</time>
      {connector != null ? connector : ''}
      {to && toString != null ? (
        <time dateTime={new Date(to).toISOString()}>{toString}</time>
      ) : (
        ''
      )}
    </>
  );
}
