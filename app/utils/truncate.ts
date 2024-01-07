export default function truncate(
  str: string | null | undefined,
  length: number,
) {
  if (!str) {
    return null;
  }
  if (str.length < length) {
    return str;
  }
  let excerpt = '';

  for (let word of str.split(' ')) {
    if ((excerpt + word).length > length - 2) {
      break;
    }
    excerpt += (excerpt === '' ? '' : ' ') + word;
  }
  if (excerpt.length > length - 1) {
    excerpt = excerpt.slice(0, length - 1);
  }

  return excerpt + '…';
}
