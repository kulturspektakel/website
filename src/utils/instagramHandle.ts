/** Instagram handles are `[A-Za-z0-9._]`, max 30 chars. */
const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

// First path segments of instagram.com URLs that aren't profiles. Applicants
// paste whatever link they have open, and taking the first segment blindly
// stored `stories` for an `instagram.com/stories/<user>/<id>` link — which
// Apify can never resolve to a follower count. Instagram publishes no list of
// these; `p`, `stories`, `tv`, `accounts` and `direct` have each turned up as
// stored handles in real applications, `accounts`/`direct` are also in its
// robots.txt, and `reel(s)`/`explore` are the same kind of share link.
const RESERVED = new Set([
  'accounts',
  'direct',
  'explore',
  'p',
  'reel',
  'reels',
  'stories',
  'tv',
]);

/**
 * Turns what an applicant typed into the Instagram field (`@band`, `band`, or
 * any instagram.com link) into a bare handle. Story links yield the story's
 * owner. Returns `undefined` for empty input and `null` when the input can't
 * be a profile (a post/reel link, or junk).
 */
export function parseInstagramHandle(input: string): string | null | undefined {
  let val = input.trim();
  if (!val) {
    return undefined;
  }
  const url = val.match(/instagram\.com\/([^?#]*)/i);
  if (url) {
    const [first, second] = url[1].split('/');
    val = first === 'stories' && second ? second : first;
  }
  val = val.replace(/\s|@|\//g, '');
  return isInstagramHandle(val) ? val : null;
}

export function isInstagramHandle(handle: string) {
  return HANDLE.test(handle) && !RESERVED.has(handle.toLowerCase());
}
