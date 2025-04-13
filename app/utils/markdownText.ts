import {directusImages, imageUrl} from './directusImage';

export type Markdown = ReturnType<typeof markdownText>;
export async function markdownText(text: string) {
  const imageBaseUrl = imageUrl();
  const markdown = text.replaceAll(
    'https://crew.kulturspektakel.de/assets/',
    imageBaseUrl,
  );

  // Escape special regex characters in imagebaseUrl
  const escapedBaseUrl = imageBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Use the escaped base URL in the regex
  const imgRegex = new RegExp(
    `!\\[.*?\\]\\((${escapedBaseUrl}([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}))\\)`,
    'g',
  );

  const matches = markdown.match(imgRegex) || [];
  const imageIDs = matches.map((match) => match.replace(imgRegex, '$2'));

  return {
    images: await directusImages(imageIDs),
    markdown,
  };
}
