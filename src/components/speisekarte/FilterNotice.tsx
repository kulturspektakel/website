import LinkButton from '../LinkButton';
import {Alert} from '../chakra-snippets/alert';
import type {DietFilter} from '../../routes/_main.speisekarte';

const LABELS: Record<DietFilter, string> = {
  vegan: 'Es werden nur vegane Produkte angezeigt.',
  glutenfrei: 'Es werden nur glutenfreie Produkte angezeigt.',
};

// Shown under the headline while a diet filter is active, with a "Alle anzeigen"
// action that clears the filter (navigates to /speisekarte without a param).
export default function FilterNotice({filter}: {filter: DietFilter}) {
  return (
    <Alert
      mb="10"
      alignItems="center"
      status="info"
      variant="surface"
      title={LABELS[filter]}
      endElement={
        <LinkButton
          linkOptions={{to: '/speisekarte', search: {}}}
          size="sm"
          flexShrink={0}
        >
          Alle anzeigen
        </LinkButton>
      }
    />
  );
}
