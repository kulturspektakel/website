import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';
import {imageIDsFromMarkdown, markdownCDNUrls} from '../../utils/markdownText';
import {directusImages} from '../../utils/directusImage.server';
import {markdownText} from '../../utils/markdownText.server';
import {pageSelect} from '../../components/Page';

export const pageLoader = createServerFn()
  .inputValidator((slug: string) => slug)
  .handler(async ({data: slug}) => {
    const data = await prismaClient.page.findUnique({
      where: {
        slug,
      },
      select: pageSelect,
    });

    if (!data) {
      return null;
    }

    const {left, right, bottom, content, ...page} = data;
    const imageMap = await directusImages(
      imageIDsFromMarkdown(left, right, bottom, content),
    );

    const [contentMd, leftMd, rightMd, bottomMd] = await Promise.all([
      content ? markdownText(content, imageMap) : undefined,
      left ? markdownText(left, imageMap) : undefined,
      right ? markdownText(right, imageMap) : undefined,
      bottom ? markdownText(bottom, imageMap) : undefined,
    ]);

    return {
      ...page,
      left: leftMd,
      right: rightMd,
      bottom: bottomMd,
      content: contentMd,
    };
  });
