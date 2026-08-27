// Spotify artist ids reach us from the public band-application form, where the
// field is a plain string the client controls — the value it submits isn't
// necessarily one we handed it from the search endpoint. Every consumer
// interpolates the id into a URL, and `../` in a path segment silently
// retargets the request (`../../v1/me` resolves to /v1/artists's sibling), so
// the id is validated before it's used rather than trusted at the write site.
//
// Deliberately charset-only: real ids are 22 base-62 characters today, but
// pinning that length would start rejecting genuine applications if Spotify
// ever changes the format, which is worse than the thing being prevented.
export function isValidSpotifyArtistId(id: string) {
  return /^[A-Za-z0-9]+$/.test(id);
}

// Public artist page. Returns null for an id we wouldn't trust in a URL.
export function spotifyArtistUrl(id: string) {
  return isValidSpotifyArtistId(id)
    ? `https://open.spotify.com/artist/${encodeURIComponent(id)}`
    : null;
}
