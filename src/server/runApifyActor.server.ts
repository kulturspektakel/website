/**
 * Runs an Apify actor synchronously and returns its dataset items.
 *
 * `run-sync-get-dataset-items` blocks until the run finishes, which for a
 * single page is a handful of seconds. `timeoutSecs` bounds that wait: it has
 * to sit well inside the calling function's `maxDuration` (60s), otherwise
 * Vercel kills the request first and Cloud Tasks only sees a bare 504. If
 * Apify is slow or wedged we'd rather fail and let the scrapers queue retry
 * later than sit on an open request.
 *
 * The fetch is aborted a little after the actor's own timeout, as a backstop
 * in case Apify doesn't answer once the run is over.
 */
export async function runApifyActor<T>(
  actor: string,
  input: unknown,
  timeoutSecs: number,
): Promise<T[]> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=${timeoutSecs}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.APIFY_TOKEN}`,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout((timeoutSecs + 5) * 1000),
    },
  );

  if (!res.ok) {
    throw new Error(`Apify HTTP${res.status}: ${await res.text()}`);
  }

  return (await res.json()) as T[];
}
