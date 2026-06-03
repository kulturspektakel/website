declare module 'bandcamp-scraper' {
  export interface AlbumInfo {
    artist: string;
    title: string;
    url: string;
    imageUrl?: string;
    tracks: Track[];
    tags?: Tag[];
    raw: {[k: string]: unknown};
  }
  export interface Track {
    name: string;
    url?: string;
    duration?: string;
  }
  export interface Tag {
    name: string;
  }
  export interface ArtistInfo {
    name?: string;
    location?: string;
    coverImage?: string;
    description?: string;
    albums?: Album[];
    shows?: Show[];
    bandLinks?: BandLink[];
  }
  export interface Album {
    url?: string;
    title?: string;
    coverImage?: string;
  }
  export interface Show {
    date?: string;
    venue?: string;
    venueUrl?: string;
    location?: string;
  }
  export interface BandLink {
    name?: string;
    url?: string;
  }
  export interface TrackInfo {
    artist?: string;
    title: string;
    url: string;
    imageUrl?: string;
    trackId: number;
    raw: {[k: string]: unknown};
  }
  export interface SearchResult {}

  type Params = {query: string; page?: number};
  function search(params: Params): void;
  function getAlbumInfo(
    albumUrl: string,
    cb: (err?: Error, data?: AlbumInfo) => void,
  ): void;
  function getArtistInfo(
    artistUrl: string,
    cb: (err?: Error, data?: ArtistInfo) => void,
  ): void;
  function getTrackInfo(
    trackUrl: string,
    cb: (err?: Error, data?: TrackInfo) => void,
  ): void;
}
