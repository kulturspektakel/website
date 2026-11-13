// Turns a free-text link from a form (band application website/demo/…) into an
// absolute http(s) URL, or null if it isn't one. Without this, a value like
// "Bisher noch nicht online" renders as a relative href under the current
// route, and "javascript:…" would be executable.
export function externalUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return null;
  }
  // Bare domains ("www.band.de", "band.de/music") are common in the form.
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      !url.hostname.includes('.')
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}
