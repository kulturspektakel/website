import {Box, Heading, SimpleGrid} from '@chakra-ui/react';
import type {PageContentFragment} from '~/types/graphql';
import MarkdownText from './MarkdownText';
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
    <Box as="article" mb="10" w="100%">
      <Heading mb={5} textAlign={props.centered ? 'center' : undefined}>
        {title}
      </Heading>
      {content && (
        <Box mt="3" textAlign={props.centered ? 'center' : undefined}>
          <MarkdownText>{content}</MarkdownText>
        </Box>
      )}
      {left && right && (
        <SimpleGrid columns={[1, 2]} spacing="5" mt="3">
          <Box>
            <MarkdownText>{left}</MarkdownText>
          </Box>
          <Box>
            <MarkdownText>{right}</MarkdownText>
          </Box>
        </SimpleGrid>
      )}
      {bottom && (
        <Box mt="3" textAlign={props.centered ? 'center' : undefined}>
          <MarkdownText>{bottom}</MarkdownText>
        </Box>
      )}
    </Box>
  );
}
