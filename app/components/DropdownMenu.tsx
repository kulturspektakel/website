import {List, ListItem, Center, Spinner} from '@chakra-ui/react';
import type {UseComboboxPropGetters} from 'downshift';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from './chakra-snippets/menu';

export default function DropdownMenu<T>({
  getMenuProps,
  getItemProps,
  isOpen,
  loading,
  data,
  highlightedIndex,
  itemRenderer,
  keyExtractor,
}: {
  getItemProps: UseComboboxPropGetters<T>['getItemProps'];
  getMenuProps: UseComboboxPropGetters<T>['getMenuProps'];
  itemRenderer: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  isOpen: boolean;
  loading: boolean;
  data: T[];
  highlightedIndex: number;
}) {
  return (
    <MenuRoot>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent>
        {data.map((band, index) => (
          <MenuItem value={index}>{itemRenderer(band, index)}</MenuItem>
        ))}
        {loading && (
          <Center p="6">
            <Spinner size="sm" />
          </Center>
        )}
      </MenuContent>
    </MenuRoot>
  );
}
