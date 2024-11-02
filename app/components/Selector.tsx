import {
  Group,
  Button,
  SelectContent,
  SelectItem,
  SelectRoot,
} from '@chakra-ui/react';
import {useCallback, useRef} from 'react';

export default function Selector({
  value,
  onChange,
  allLabelSmall,
  options,
}: {
  value: string | null;
  onChange: (value: string | null, index: number) => void;
  allLabelSmall?: string;
  options: Array<{
    id: string;
    name: string;
  }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      (
        document.activeElement?.nextElementSibling as HTMLElement | null
      )?.focus();
    } else if (e.key === 'ArrowLeft') {
      (
        document.activeElement?.previousElementSibling as HTMLElement | null
      )?.focus();
    }
  }, []);

  const onFocus = useCallback(() => {
    ref.current?.addEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  const onBlur = useCallback(() => {
    ref.current?.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  return (
    <>
      <Group
        attached
        mt="5"
        display={['none', 'flex']}
        role="toolbar"
        onFocus={onFocus}
        onBlur={onBlur}
        ref={ref}
      >
        <Button
          onClick={() => onChange(null, -1)}
          variant={value === null ? 'primary' : undefined}
          aria-pressed={value == null}
          flexGrow="1"
          tabIndex={value == null ? 0 : -1}
        >
          Alle
        </Button>
        {options.map((o, i) => (
          <Button
            tabIndex={value === o.id ? 0 : -1}
            flexGrow="1"
            key={o.id}
            aria-pressed={o.id === value}
            onClick={() => onChange(o.id, i)}
            variant={o.id === value ? 'primary' : undefined}
          >
            {o.name}
          </Button>
        ))}
      </Group>
      <SelectRoot
        mt="2"
        display={['flex', 'none']}
        bg="white"
        onValueChange={(value) => onChange(value === 'all' ? null : value, -1)}
        fontWeight="bold"
        value={[value ?? 'all']}
      >
        <SelectContent>
          <SelectItem item={'all'}>{allLabelSmall ?? 'Alle'}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} item={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </>
  );
}
