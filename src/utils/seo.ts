import {imageUrl} from './directusImage';
import truncate from './truncate';

export function seo({
  title = undefined,
  description = undefined,
  imageId = undefined,
}: {
  title?: string;
  description?: string;
  imageId?: string;
}) {
  description = description ? truncate(description, 150) : undefined;
  return {
    meta: [
      {title},
      {name: 'description', content: description},
      {name: 'og:locale', content: 'de_DE'},
      {name: 'og:title', content: title},
      {name: 'og:description', content: description},
      ...(imageId
        ? [{name: 'og:image', content: imageUrl(imageId, {width: 960})}]
        : []),
    ],
  };
}
