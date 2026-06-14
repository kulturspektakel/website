import {useNavigate} from '@tanstack/react-router';
import {
  NativeSelectField,
  NativeSelectRoot,
} from '../chakra-snippets/native-select';
import type {DietFilter} from '../../routes/_main.speisekarte';

// Diet filter shown under the headline. Selecting an option navigates to
// /speisekarte with (or without) the `filter` search param; the route's loader
// re-runs and narrows the lists accordingly.
export default function DietFilterSelect({filter}: {filter?: DietFilter}) {
  const navigate = useNavigate();

  return (
    <NativeSelectRoot size="sm" w="auto" minW="140px" flexShrink="0">
      <NativeSelectField
        value={filter ?? 'alle'}
        aria-label="Filter auswählen"
        onChange={(e) => {
          const value = e.currentTarget.value;
          navigate({
            to: '/speisekarte',
            search:
              value === 'vegan' || value === 'glutenfrei'
                ? {filter: value}
                : {},
          });
        }}
      >
        <option value="alle">Alle</option>
        <option value="vegan">vegan</option>
        <option value="glutenfrei">glutenfrei</option>
      </NativeSelectField>
    </NativeSelectRoot>
  );
}
