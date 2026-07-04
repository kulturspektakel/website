import {Flex, HStack, Image, Text} from '@chakra-ui/react';
import {GenreCategory} from '../../generated/prisma/browser';
import {GENRE_CATEGORY_ICONS} from '../../utils/genreCategories';
import {Avatar} from '../chakra-snippets/avatar';
import {CopyToClipboard} from '../CopyToClipboard';

// Band identity (image + name + genre) shown in the crew booking table's name
// column and reused as the detail modal's header so both stay in sync. The
// avatar falls back to the genre-category icon when the band has no image.
export function BandName({
  bandname,
  genre,
  genreCategory,
  imageUrl,
  size = 'sm',
  copyableName = false,
}: {
  bandname: string;
  genre: string | null;
  genreCategory: GenreCategory;
  imageUrl: string | null;
  size?: 'sm' | 'md';
  copyableName?: boolean;
}) {
  const name = (
    <Text
      fontWeight="bold"
      truncate
      fontSize={size === 'md' ? 'lg' : 'md'}
      lineHeight="1.2"
    >
      {bandname}
    </Text>
  );
  return (
    <HStack gap="2" minW="0" align="center">
      <Avatar
        src={imageUrl ?? undefined}
        fallback={
          <Flex align="center" justify="center" boxSize="full">
            <Image
              src={GENRE_CATEGORY_ICONS.get(genreCategory)}
              alt=""
              boxSize="70%"
            />
          </Flex>
        }
        bg="bg.emphasized"
        size={size}
        shape="rounded"
        flexShrink="0"
      />
      <Flex direction="column" minW="0" gap="0.5">
        {copyableName ? (
          <CopyToClipboard text={bandname} maxW="full">
            {name}
          </CopyToClipboard>
        ) : (
          name
        )}
        {genre && (
          <Text
            fontSize="sm"
            color="fg.muted"
            fontWeight="normal"
            truncate
            lineHeight="1.2"
          >
            {genre}
          </Text>
        )}
      </Flex>
    </HStack>
  );
}
