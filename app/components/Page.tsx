import {Box, Heading, SimpleGrid} from '@chakra-ui/react';
import MarkdownText from './MarkdownText';
import {Markdown} from '../utils/markdownText';
import {Prisma} from '@prisma/client';

export const pageSelect: Prisma.PageSelect = {
  slug: true,
  title: true,
  content: true,
  left: true,
  right: true,
  bottom: true,
};

export default function Page(
  props: {
    title: string;
    left?: Markdown;
    right?: Markdown;
    content?: Markdown;
    bottom?: Markdown;
  } & {centered?: boolean; headingLevel?: 1 | 2 | 3},
) {
  const {title, left, right, content, bottom, headingLevel = 1} = props;
  return (
    <Box as="article" mb="10" w="100%">
      <Heading
        mb={5}
        size="3xl"
        as={`h${headingLevel}`}
        textAlign={props.centered ? 'center' : undefined}
      >
        {title}
      </Heading>
      {content && (
        <Box mt="3" textAlign={props.centered ? 'center' : undefined}>
          <MarkdownText {...content} />
        </Box>
      )}
      {left && right && (
        <SimpleGrid columns={[1, 2]} gap="5" mt="3">
          <Box>
            <MarkdownText {...left} />
          </Box>
          <Box>
            <MarkdownText {...right} />
          </Box>
        </SimpleGrid>
      )}
      {bottom && (
        <Box mt="3" textAlign={props.centered ? 'center' : undefined}>
          <MarkdownText {...bottom} />
        </Box>
      )}
    </Box>
  );
}
