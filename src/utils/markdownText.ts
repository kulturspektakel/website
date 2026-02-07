import {Ref} from 'react';
import {pageSelect} from '../components/Page';
import {BASE_URL, DirectusImage, directusImages} from './directusImage';
import {prismaClient} from './prismaClient';

export function imageIDsFromMarkdown(
  ...args: Array<string | null | undefined>
): string[] {
  const markdown = markdownCDNUrls(args.join(' '));

  const imgRegex = new RegExp(
    `!\\[.*?\\]\\((${BASE_URL}([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}))\\)`,
    'g',
  );

  const matches = markdown.match(imgRegex) || [];
  const imageIDs = matches.map((match: string) =>
    match.replace(imgRegex, '$2'),
  );

  return imageIDs;
}

function markdownCDNUrls(markdown: string) {
  return markdown.replaceAll(
    'https://crew.kulturspektakel.de/assets/',
    BASE_URL,
  );
}

export type Markdown = Awaited<ReturnType<typeof markdownText>>;
export async function markdownText(
  text: string,
  imageMap?: Record<string, DirectusImage>,
) {
  const markdown = markdownCDNUrls(text);
  const imageIDs = imageIDsFromMarkdown(markdown);
  let images: Array<DirectusImage> = [];
  if (imageMap) {
    for (const id of imageIDs) {
      if (id in imageMap) {
        images.push(imageMap[id]);
      } else {
        console.warn(`Image with ID ${id} not found in imageMap`);
        const i = Object.values(await directusImages([id]));
        images.push(...i);
      }
    }
  } else {
    images = Object.values(await directusImages(imageIDs));
  }

  return {
    images,
    markdown,
  };
}

export async function markdownPages<
  T extends {
    content: string | null;
    left?: string | null;
    right?: string | null;
    bottom?: string | null;
  },
>(
  pages: Array<T>,
): Promise<
  Array<
    Omit<T, 'content' | 'left' | 'right' | 'bottom'> & {
      content?: Markdown;
    } & ('left' extends keyof T ? {left?: Markdown} : {}) &
      ('right' extends keyof T ? {right?: Markdown} : {}) &
      ('bottom' extends keyof T ? {bottom?: Markdown} : {})
  >
> {
  const imageMap = await directusImages(
    imageIDsFromMarkdown(
      ...pages.flatMap((n) => [n.content, n.left, n.right, n.bottom]),
    ),
  );

  return Promise.all(
    pages.map(async ({content, left, right, bottom, ...page}, i) => {
      const result: any = {
        ...page,
        content: content ? await markdownText(content, imageMap) : undefined,
      };

      if ('left' in pages[i] && left != null) {
        result.left = await markdownText(left, imageMap);
      }

      if ('right' in pages[i] && right != null) {
        result.right = await markdownText(right, imageMap);
      }

      if ('bottom' in pages[i] && bottom != null) {
        result.bottom = await markdownText(bottom, imageMap);
      }

      return result;
    }),
  );
}

export async function multiPage<T extends string>(pages: T[]) {
  const data = await prismaClient.page.findMany({
    where: {
      slug: {
        in: pages,
      },
    },
    select: pageSelect,
  });

  const mdPages = await markdownPages(data);

  return mdPages.reduce(
    (acc, page) => {
      acc[page.slug] = page;
      return acc;
    },
    {} as Record<T, (typeof mdPages)[number]>,
  );
}
