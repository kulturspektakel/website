import {GenreCategory} from '../generated/prisma/browser';

// Single source of truth for the German genre-category labels and icons, shared
// by the booking form (Step1) and the crew booking table. Ordered for display
// in selects/filters; `DJ` is last (the band form omits it — DJs apply through
// a separate flow).
const ENTRIES: [GenreCategory, {label: string; icon: string}][] = [
  [GenreCategory.Pop, {label: 'Pop', icon: '/genre/pop.svg'}],
  [GenreCategory.Rock, {label: 'Rock', icon: '/genre/rock.svg'}],
  [GenreCategory.Indie, {label: 'Indie', icon: '/genre/indie.svg'}],
  [
    GenreCategory.Hardrock_Metal_Punk,
    {label: 'Hardrock / Metal / Punk', icon: '/genre/metal.svg'},
  ],
  [
    GenreCategory.Folk_SingerSongwriter_Country,
    {label: 'Folk / Singer/Songwriter / Country', icon: '/genre/country.svg'},
  ],
  [
    GenreCategory.Elektro_HipHop,
    {label: 'Elektro / Hip-Hop', icon: '/genre/hip_hop.svg'},
  ],
  [
    GenreCategory.Blues_Funk_Jazz_Soul,
    {label: 'Blues / Funk / Jazz / Soul', icon: '/genre/jazz.svg'},
  ],
  [GenreCategory.Reggae_Ska, {label: 'Reggae / Ska', icon: '/genre/reggae.svg'}],
  [GenreCategory.Other, {label: 'andere Musikrichtung', icon: '/genre/hippie.svg'}],
  [GenreCategory.DJ, {label: 'DJ', icon: '/genre/disco.svg'}],
];

export const GENRE_CATEGORY_ICONS = new Map<GenreCategory, string>(
  ENTRIES.map(([value, {icon}]) => [value, icon]),
);

// Genre options excluding DJ (the band booking form and the crew booking table
// both deal with bands only — DJs apply/are handled through a separate flow).
export const BAND_GENRE_CATEGORY_OPTIONS = ENTRIES.filter(
  ([value]) => value !== GenreCategory.DJ,
).map(([value, {label}]) => ({value, label}));
