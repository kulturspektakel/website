import {List, ListItem, Center, Spinner} from '@chakra-ui/react';
import type {UseComboboxPropGetters} from 'downshift';

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
    <List
      shadow="md"
      bg="white"
      borderRadius="lg"
      overflow="hidden"
      position="absolute"
      zIndex="2"
      mt="1"
      w="100%"
      visibility={isOpen ? 'visible' : 'hidden'}
      {...getMenuProps()}
    >
      {data.map((band, index) => (
        <ListItem
          key={keyExtractor(band)}
          {...getItemProps({item: band, index})}
          py="1.5"
          px="3"
          cursor="pointer"
          bg={index === highlightedIndex ? 'blue.500' : undefined}
          color={index === highlightedIndex ? 'white' : undefined}
        >
          {itemRenderer(band, index)}
        </ListItem>
      ))}
      {loading && (
        <Center p="6">
          <Spinner size="sm" />
        </Center>
      )}
    </List>
  );
}
