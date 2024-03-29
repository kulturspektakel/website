import {Box, Heading, SimpleGrid} from '@chakra-ui/react';
import type {PageContentFragment} from '~/types/graphql';
import MarkdownText from './MarkdownText';
import {gql} from '@apollo/client';

gql`
  fragment PageContent on Page {
    title
    content {
      ...MarkdownText
      plainText
    }
    left {
      ...MarkdownText
    }
    right {
      ...MarkdownText
    }
    bottom {
      ...MarkdownText
    }
  }
`;

export default function Page(
  props: PageContentFragment & {centered?: boolean; headingLevel?: 1 | 2 | 3},
) {
  const {title, left, right, content, bottom, headingLevel = 1} = props;
  return (
    <Box as="article" mb="10" w="100%">
      <Heading
        mb={5}
        as={`h${headingLevel}`}
        textAlign={props.centered ? 'center' : undefined}
      >
        {title}
      </Heading>
      {content && (
        <Box mt="3" textAlign={props.centered ? 'center' : undefined}>
          <MarkdownText markdown={content} />
        </Box>
      )}
      {left && right && (
        <SimpleGrid columns={[1, 2]} spacing="5" mt="3">
          <Box>
            <MarkdownText markdown={left} />
          </Box>
          <Box>
            <MarkdownText markdown={right} />
          </Box>
        </SimpleGrid>
      )}
      {bottom && (
        <Box mt="3" textAlign={props.centered ? 'center' : undefined}>
          <MarkdownText markdown={bottom} />
        </Box>
      )}
    </Box>
  );
}
