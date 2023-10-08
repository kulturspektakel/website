import {gql} from '@apollo/client';
import {ButtonGroup, Button, Select} from '@chakra-ui/react';
import type {StageSelectorFragment} from '~/types/graphql';

gql`
  fragment StageSelector on Query {
    areas {
      id
      displayName
    }
  }
`;

export default function StageSelector({
  value,
  onChange,
  areas,
}: {
  areas: StageSelectorFragment['areas'];
  value: string | null;
  onChange: (stage: string | null) => void;
}) {
  return (
    <>
      <ButtonGroup isAttached mt="5" display={['none', 'flex']}>
        <Button
          onClick={() => onChange(null)}
          variant={value === null ? 'primary' : undefined}
          aria-pressed={value == null}
          flexGrow="1"
        >
          Alle
        </Button>
        {areas.map((area) => (
          <Button
            flexGrow="1"
            key={area.id}
            aria-pressed={area.id === value}
            onClick={() => onChange(area.id)}
            variant={area.id === value ? 'primary' : undefined}
          >
            {area.displayName}
          </Button>
        ))}
      </ButtonGroup>
      <Select
        mt="2"
        display={['flex', 'none']}
        bg="white"
        onChange={(e) =>
          onChange(e.target.value === 'all' ? null : e.target.value)
        }
        fontWeight="bold"
        value={value ?? 'all'}
      >
        <option value={'all'}>Alle Bühnen</option>
        {areas.map((area) => (
          <option key={area.id} value={area.id}>
            {area.displayName}
          </option>
        ))}
      </Select>
    </>
  );
}
