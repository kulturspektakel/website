import https from 'node:https';
import {prismaClient} from '../../server/prismaClient.server';
import {readJsonPayload} from '../../server/readJsonPayload.server';

export type InstagramFollowerPayload = {id: string};

/** Instagram handles are `[A-Za-z0-9._]`, max 30 chars. */
const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/**
 * An account we know exists and is public, used to tell "this handle is gone"
 * apart from "Instagram is stonewalling us" — see `handleInstagramFollower`.
 */
const CONTROL_HANDLE = 'kulturspektakel';

/**
 * Reads the follower count from the public Instagram profile page and stores it
 * on the BandApplication.
 *
 * The old `api/v1/users/web_profile_info` endpoint this used to call is now
 * login-gated: it answers `401 {"require_login": true}` to any request without
 * a session cookie, which surfaced here as a thrown error and a 500, and so as
 * 25 futile Cloud Tasks retries per application. The follower count is still
 * public in the profile page's `og:description` meta tag, which is what we
 * parse instead. No credentials involved.
 */
export async function handleInstagramFollower(
  request: Request,
): Promise<Response> {
  const {id} = await readJsonPayload<InstagramFollowerPayload>(request);

  const application = await prismaClient.bandApplication.findUnique({
    where: {id},
  });
  const handle = application?.instagram;
  if (!handle) {
    return new Response(null, {status: 204});
  }
  // Older rows predate the form's handle normalisation and may hold anything;
  // a junk value isn't scrapable, so don't burn retries on it.
  if (!HANDLE.test(handle)) {
    console.error(`Instagram handle ${JSON.stringify(handle)} is not a handle`);
    return new Response(null, {status: 204});
  }

  const count = await instagramFollowerCount(handle);
  if (count != null) {
    await prismaClient.bandApplication.update({
      where: {id},
      data: {instagramFollower: count},
    });
    return new Response(null, {status: 204});
  }

  // No `og:description`. Instagram serves a byte-identical error page whether
  // the handle doesn't exist or we're being blocked, so the status code can't
  // tell us which. Ask about an account we know is there: if that works too,
  // this handle really is gone (give up quietly); if it doesn't, we're blocked
  // and should throw so Cloud Tasks retries once the block lifts.
  if ((await instagramFollowerCount(CONTROL_HANDLE)) != null) {
    console.error(`Instagram user ${handle} not found`);
    return new Response(null, {status: 204});
  }
  throw new Error(
    `Instagram returned no og:description for ${handle} or for the control ` +
      `handle ${CONTROL_HANDLE} — we are most likely being blocked.`,
  );
}

/**
 * Follower count for `handle`, or `null` if the page carried no
 * `og:description` (handle gone, or we're blocked — the caller disambiguates).
 * Throws on a non-200, which Cloud Tasks retries.
 */
async function instagramFollowerCount(handle: string): Promise<number | null> {
  const og = await fetchOgDescription(`https://www.instagram.com/${handle}/`);
  return og == null ? null : parseFollowerCount(og);
}

/**
 * `"2,570 Followers, 139 Following, 284 Posts - …"` → `2570`.
 *
 * Instagram only spells the number out below 10,000; above that it abbreviates
 * to two or three significant figures (`17K`, `149K`, `2M`), so counts over
 * 10,000 are necessarily approximate. Returns `null` if the tag doesn't lead
 * with a follower count.
 */
export function parseFollowerCount(ogDescription: string): number | null {
  const match = ogDescription.match(/^([\d.,]+)([KMB])?\s+Followers/);
  if (!match) {
    return null;
  }
  // en-US formatting (we send `Accept-Language: en-US`): `,` groups thousands,
  // `.` is the decimal point in abbreviations like `1.5K`.
  const value = parseFloat(match[1].replace(/,/g, ''));
  if (!isFinite(value)) {
    return null;
  }
  const scale = {K: 1e3, M: 1e6, B: 1e9}[match[2] ?? ''] ?? 1;
  return Math.round(value * scale);
}

/**
 * Fetch `url` and return its `og:description` content, or `null` if there
 * isn't one.
 *
 * Two non-obvious requirements, both about looking like a link-preview
 * crawler rather than a browser:
 *
 * - The User-Agent decides what we get. A crawler UA gets the real profile
 *   page (~940 KB, og tags present); a browser UA gets a login wall with no
 *   og tags; no UA at all gets a 302.
 * - Plain `node:https` rather than `fetch`, because Instagram's edge rejects
 *   browser fetch-metadata headers with `400 SecFetch Policy violation.` and
 *   Node's `fetch` (undici) unconditionally appends `Sec-Fetch-Mode` and
 *   `Sec-Fetch-Site`. Those are forbidden header names, so `fetch` can't
 *   remove them; `node:https` sends only what we hand it.
 *
 * The og tags sit in the first ~10 KB, so we stop reading at `</head>` rather
 * than pulling the whole ~940 KB document.
 */
function fetchOgDescription(url: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          // Include the redirect target: Instagram answers some requests with
          // a 302 rather than the page, and where it sends us (login wall,
          // consent interstitial, canonical URL) is the whole diagnosis.
          const where = res.headers.location
            ? ` -> ${res.headers.location}`
            : '';
          reject(
            new Error(
              `Instagram responded ${res.statusCode}${where} for ${url}`,
            ),
          );
          return;
        }
        res.setEncoding('utf8');
        let head = '';
        let settled = false;
        const settle = (value: string | null) => {
          settled = true;
          res.destroy();
          resolve(value);
        };
        res.on('data', (chunk) => {
          if (settled) {
            return;
          }
          head += chunk;
          const og = head.match(
            /<meta property="og:description" content="([^"]*)"/,
          );
          if (og) {
            settle(decodeEntities(og[1]));
          } else if (head.includes('</head>')) {
            settle(null);
          }
        });
        res.on('end', () => {
          if (!settled) {
            resolve(null);
          }
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.setTimeout(15_000, () => {
      req.destroy(new Error(`Instagram timed out for ${url}`));
    });
  });
}

/** Instagram HTML-escapes the tag content; we only need the numeric prefix. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([\da-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}
