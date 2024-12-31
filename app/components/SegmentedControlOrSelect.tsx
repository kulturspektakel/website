import {
  NativeSelectField,
  NativeSelectRoot,
} from './chakra-snippets/native-select';
import {
  SegmentedControl,
  SegmentedControlProps,
} from './chakra-snippets/segmented-control';

export function SegmentedControlOrSelect({
  items,
  onValueChange,
  value,
  ...props
}: SegmentedControlProps & {
  value: string;
  onValueChange: (args: {value: string}) => void;
}) {
  return (
    <>
      <NativeSelectRoot hideFrom="md" {...props}>
        <NativeSelectField
          onChange={(e) => onValueChange({value: String(e.target.value)})}
          value={value}
        >
          {items.map((item) => (
            <option
              key={typeof item === 'string' ? item : item.value}
              value={typeof item === 'string' ? item : item.value}
            >
              {typeof item === 'string' ? item : item.label}
            </option>
          ))}
        </NativeSelectField>
      </NativeSelectRoot>
      <SegmentedControl hideBelow="md" items={items} {...props} />
    </>
  );
}
