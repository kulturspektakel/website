import type {BoxProps} from '@chakra-ui/react';
import {Box, Input, Text} from '@chakra-ui/react';
import {useTypeahead} from 'tomo-typeahead/react';
import {FaMagnifyingGlass} from 'react-icons/fa6';
import {useRef} from 'react';
import {useCombobox} from 'downshift';
import DropdownMenu from '../DropdownMenu';
import {InputGroup} from '../chakra-snippets/input-group';
import {createServerFn, useServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../server/prismaClient.server';
import {useNavigate} from '@tanstack/react-router';

const serverFn = createServerFn()
  .inputValidator((query: string) => query)
  .handler(({data: query}) => {
    let q = query
      .replace(/[^\p{L}0-9- ]/gu, ' ')
      .trim()
      .replace(/\s\s*/g, '<->');
    if (!q) return [];
    q += ':*';

    // The DB runs under a C locale, so the `simple` text-search config only
    // lowercases ASCII — umlauts in band names keep their case and never match
    // what the user types. Normalise both sides with unaccent(lower(...)) so
    // "über"/"uber"/"Übertreibhaus" all find "Übertreibhaus".
    return prismaClient.$queryRaw<
      Array<{id: string; name: string; slug: string; startTime: Date}>
    >`
      SELECT id, name, slug, "startTime"
      FROM "BandPlaying"
      WHERE to_tsvector('simple', unaccent(lower(name)))
            @@ to_tsquery('simple', unaccent(lower(${q})))
      ORDER BY "startTime" DESC
      LIMIT 10
    `;
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
