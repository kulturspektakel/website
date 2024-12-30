import {NativeSelectRoot} from '@chakra-ui/react/native-select';
import {NativeSelectField} from './chakra-snippets/native-select';
import {
  SegmentedControl,
  SegmentedControlProps,
} from './chakra-snippets/segmented-control';

export function SegmentedControlOrSelect({
  items,
  ...props
}: SegmentedControlProps) {
  return (
    <>
      <NativeSelectRoot
        size="sm"
        width="240px"
        hideFrom="md"
        {...props}
        w="full"
      >
        <NativeSelectField>
          {items.map((item) => (
            <option value={typeof item === 'string' ? item : item.value}>
              {typeof item === 'string' ? item : item.label}
            </option>
          ))}
        </NativeSelectField>
      </NativeSelectRoot>
      <SegmentedControl hideBelow="lg" {...props} items={items} />
    </>
  );
}
