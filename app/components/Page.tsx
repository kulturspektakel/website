import {Box, Heading, SimpleGrid} from '@chakra-ui/react';
import type {PageQuery} from '~/types/graphql';
import MarkDownWithOverrides from './MarkdownText';

type PageType = Extract<PageQuery['node'], {__typename?: 'Page'}>;

export default function Page(props: PageType) {
  const {title, left, right, content, bottom} = props;
  return (
    <Box as="article" mb="10" mt="10">
      <Heading mb={5}>{title}</Heading>
      {content && (
        <Box mt="3">
          <MarkDownWithOverrides>{content}</MarkDownWithOverrides>
        </Box>
      )}
      {left && right && (
        <SimpleGrid columns={[1, 2]} spacing="5" mt="3">
          <Box>
            <MarkDownWithOverrides>{left}</MarkDownWithOverrides>
          </Box>
          <Box>
            <MarkDownWithOverrides>{right}</MarkDownWithOverrides>
          </Box>
        </SimpleGrid>
      )}
      {bottom && (
        <Box mt="3">
          <MarkDownWithOverrides>{bottom}</MarkDownWithOverrides>
        </Box>
      )}
    </Box>
  );
}
