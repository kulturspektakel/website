import type {BoxProps} from '@chakra-ui/react';
import {Box} from '@chakra-ui/react';
import MarkDownWithOverrides from '../MarkdownText';
import DateString from '../DateString';
import Headline from '../Headline';
import {DirectusImage} from '../../utils/directusImage';

export default function Article({
  data,
  ...props
}: {
  data: {
    slug: string;
    title: string;
    createdAt: Date;
    content: {
      markdown: string;
      images: Array<DirectusImage>;
    };
  };
} & BoxProps) {
  return (
    <Box as="article" {...props}>
      <Headline
        href={`/news/${data.slug}`}
        mark={
          <DateString
            options={{
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }}
            date={data.createdAt}
          />
        }
      >
        {data.title}
      </Headline>
      <Box mt="3">
        <MarkDownWithOverrides
          markdown={data.content.markdown}
          images={data.content.images}
        />
      </Box>
    </Box>
  );
}
