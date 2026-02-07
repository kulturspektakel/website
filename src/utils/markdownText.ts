import {DirectusImage} from './directusImage';
import {BASE_URL} from './directusImage';

export type Markdown = {
  images: Array<DirectusImage>;
  markdown: string;
};

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

export function markdownCDNUrls(markdown: string) {
  return markdown.replaceAll(
    'https://crew.kulturspektakel.de/assets/',
    BASE_URL,
  );
}
