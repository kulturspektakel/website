import {ButtonGroup, Button, Select} from '@chakra-ui/react';

export default function Selector({
  value,
  onChange,
  options,
}: {
  value: string | null;
  onChange: (value: string | null, index: number) => void;
  options: Array<{
    id: string;
    name: string;
  }>;
}) {
  return (
    <>
      <ButtonGroup isAttached mt="5" display={['none', 'flex']}>
        <Button
          onClick={() => onChange(null, -1)}
          variant={value === null ? 'primary' : undefined}
          aria-pressed={value == null}
          flexGrow="1"
        >
          Alle
        </Button>
        {options.map((o, i) => (
          <Button
            flexGrow="1"
            key={o.id}
            aria-pressed={o.id === value}
            onClick={() => onChange(o.id, i)}
            variant={o.id === value ? 'primary' : undefined}
          >
            {o.name}
          </Button>
        ))}
      </ButtonGroup>
      <Select
        mt="2"
        display={['flex', 'none']}
        bg="white"
        onChange={(e) =>
          onChange(e.target.value === 'all' ? null : e.target.value, -1)
        }
        fontWeight="bold"
        value={value ?? 'all'}
      >
        <option value={'all'}>Alle</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
    </>
  );
}
