import {Box, Heading, SimpleGrid} from '@chakra-ui/react';
import type {PageContentFragment} from '~/types/graphql';
import MarkDownWithOverrides from './MarkdownText';
import {gql} from '@apollo/client';

gql`
  fragment PageContent on Page {
    title
    content
    left
    right
    bottom
  }
`;

export default function Page(
  props: PageContentFragment & {centered?: boolean},
) {
  const {title, left, right, content, bottom} = props;
  return (
    <Box as="article" mb="10" mt="10">
      <Heading mb={5} textAlign={props.centered ? 'center' : undefined}>
        {title}
      </Heading>
      {content && (
        <Box mt="3" textAlign={props.centered ? 'center' : undefined}>
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
        <Box mt="3" textAlign={props.centered ? 'center' : undefined}>
          <MarkDownWithOverrides>{bottom}</MarkDownWithOverrides>
        </Box>
      )}
    </Box>
  );
}
