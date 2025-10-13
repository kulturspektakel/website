import type {BoxProps} from '@chakra-ui/react';
import {Box, Input, Text} from '@chakra-ui/react';
import {useTypeahead} from 'tomo-typeahead/react';
import {FaMagnifyingGlass} from 'react-icons/fa6';
import {useRef} from 'react';
import {useCombobox} from 'downshift';
import DropdownMenu from '../DropdownMenu';
import {InputGroup} from '../chakra-snippets/input-group';
import {createServerFn, useServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient';
import {useNavigate} from '@tanstack/react-router';

const serverFn = createServerFn()
  .inputValidator((query: string) => query)
  .handler(({data: query}) => {
    let q = query
      // sanitize tsquery: Only Letters, spaces, dash
      .replace(/[^\p{L}0-9- ]/gu, ' ')
      // remove spaces in front and beginning
      .trim()
      // sanitize tsquery: Only Letters, spaces, dash
      .replace(/\s\s*/g, '<->');
    // prefix matching
    q += ':*';

    return prismaClient.bandPlaying.findMany({
      where: {
        name: {
          search: q,
        },
      },
      orderBy: {
        startTime: 'desc',
      },
      take: 10,
    });
  });

export default function Search(props: BoxProps) {
  const queryBands = useServerFn(serverFn);
  const {loading, data, setQuery} = useTypeahead({
    fetcher: async (query) => queryBands({data: query}),
    keyExtractor: (item) => item.id,
    matchStringExtractor: (item) => item.name,
  });

  const navigate = useNavigate();
  const ref = useRef<HTMLInputElement>(null);

  const {isOpen, highlightedIndex, getInputProps, getItemProps, getMenuProps} =
    useCombobox({
      items: data,
      itemToString: (band) => band?.name ?? '',
      stateReducer: (_state, {type, changes}) => {
        if (
          type === useCombobox.stateChangeTypes.ItemClick ||
          type === useCombobox.stateChangeTypes.InputKeyDownEnter
        ) {
          changes.inputValue = '';
        }
        return changes;
      },
      onInputValueChange: (e) => setQuery(e.inputValue ?? ''),
      onSelectedItemChange: ({selectedItem}) => {
        if (selectedItem) {
          navigate({
            to: '/lineup/$year/$slug',
            params: {
              year: String(selectedItem.startTime.getFullYear()),
              slug: selectedItem.slug,
            },
          });
          ref.current?.blur();
        }
      },
    });

  return (
    <Box position="relative" {...props}>
      <InputGroup startElement={<FaMagnifyingGlass />} w={['full', undefined]}>
        <Input
          borderRadius="full"
          placeholder="Bands suchen..."
          type="search"
          {...getInputProps({ref})}
        />
      </InputGroup>
      <DropdownMenu
        getMenuProps={getMenuProps}
        getItemProps={getItemProps}
        isOpen={isOpen}
        loading={loading}
        data={data}
        highlightedIndex={highlightedIndex}
        itemRenderer={(band) => (
          <Text lineClamp={1}>
            {band.name} ({band.startTime.getFullYear()})
          </Text>
        )}
        keyExtractor={(band) => band.id}
      />
    </Box>
  );
}
