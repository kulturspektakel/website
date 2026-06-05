import {useNavigate} from '@tanstack/react-router';
import {
  NativeSelectField,
  NativeSelectRoot,
} from '../chakra-snippets/native-select';
import {locale} from '../../utils/dateUtils';

// yyyy-mm-dd → "Mo., 01.06.2026" (noon avoids any TZ date shift).
const dayLabelFmt = new Intl.DateTimeFormat(locale, {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const fmtDay = (date: string) =>
  dayLabelFmt.format(new Date(`${date}T12:00:00`));

// Single navigation control for a device's noise views: a "Live" entry followed
// by the recent days that have data. `value` is 'live' on the live page or the
// yyyy-mm-dd on a historical page.
export function DayPicker({
  device,
  days,
  value,
}: {
  device: string;
  days: string[];
  value: string;
}) {
  const navigate = useNavigate();
  // Keep the viewed day selectable even if it dropped off the recent-10 list
  // (e.g. reached directly by URL).
  const dayOptions =
    value !== 'live' && !days.includes(value) ? [value, ...days] : days;

  return (
    <NativeSelectRoot size="sm" w={{base: '80px', md: 'auto'}} flexShrink="0">
      <NativeSelectField
        value={value}
        aria-label="Ansicht auswählen"
        width="full"
        overflow="hidden"
        textOverflow="ellipsis"
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (v === 'live') {
            navigate({to: '/crew/lautstaerke/$device', params: {device}});
          } else {
            navigate({
              to: '/crew/lautstaerke/$device/$date',
              params: {device, date: v},
            });
          }
        }}
      >
        <option value="live">Live</option>
        {dayOptions.map((d) => (
          <option key={d} value={d}>
            {fmtDay(d)}
          </option>
        ))}
      </NativeSelectField>
    </NativeSelectRoot>
  );
}
