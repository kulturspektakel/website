import {createRealtime, rawSql} from '@neon/realtime/server';
import type {
  BookingApplication,
  BookingComment,
  BookingRating,
  BookingTag,
} from '../components/booking/bookingCollections';

// Created on first use rather than at import: `createRealtime` throws without a
// secret, and this module is part of the server bundle every request loads.
let realtime: ReturnType<typeof createRealtime> | undefined;
function getRealtime() {
  const secret = process.env.NEON_REALTIME_SECRET;
  if (!secret) {
    throw new Error('NEON_REALTIME_SECRET is not set');
  }
  // The database name is embedded in every sealed query; take it from
  // DATABASE_URL so the two can't drift apart.
  realtime ??= createRealtime({
    secret,
    db: new URL(process.env.DATABASE_URL).pathname.slice(1),
  });
  return realtime;
}

// The applications shown on the booking page: one event, no DJs (they're
// handled through a separate flow). Shared by every query below, on the
// `BandApplication` alias `a`.
const IN_EVENT = `a."eventId" = $1 AND a."genreCategory" <> 'DJ'`;

// Every live query of the booking page, sealed for one event. The browser can
// subscribe to these but can't read or change them. Rules for the SQL:
// - Select columns explicitly; never `Viewer.*` (it has `slackToken`).
// - Realtime matches columns to row fields by name. The columns are already
//   camelCase, so they need no alias.
// - No ORDER BY (unsupported; the client sorts).
// - Extension types like citext can't be output; cast them to text.
// Pass `debugMode: true` to `createRealtime` (dev only) to see the database's
// reason when Realtime rejects a query.
export async function sealBookingQueries(eventId: string) {
  const url = process.env.NEON_REALTIME_URL;
  if (!url) {
    throw new Error('NEON_REALTIME_URL is not set');
  }
  const seal = <Row>(sql: string) =>
    getRealtime().seal({query: rawSql<Row>(sql, [eventId])});

  const [applications, ratings, tags, comments] = await Promise.all([
    seal<BookingApplication>(
      `SELECT a.id,
              a."createdAt",
              a.bandname,
              a.genre,
              a."genreCategory",
              a."imageUrl",
              a.city,
              a.distance,
              a."numberOfNonMaleArtists",
              a."instagramFollower",
              a."facebookLikes",
              a."spotifyMonthlyListeners",
              a."contactedByViewerId",
              a."stageRow",
              a."stageColumn"
         FROM "BandApplication" a
        WHERE ${IN_EVENT}`,
    ),
    // The rater's name and avatar are joined in, so they arrive together with
    // the rating.
    seal<BookingRating>(
      `SELECT r."viewerId",
              r."bandApplicationId",
              r.rating,
              v."displayName",
              v."profilePicture"
         FROM "BandApplicationRating" r
         JOIN "BandApplication" a ON a.id = r."bandApplicationId"
         JOIN "Viewer" v ON v.id = r."viewerId"
        WHERE ${IN_EVENT}`,
    ),
    // The client still compares tags case-insensitively (see `normalizeTag`).
    seal<BookingTag>(
      `SELECT t."bandApplicationId", t.tag::text AS tag
         FROM "BandApplicationTag" t
         JOIN "BandApplication" a ON a.id = t."bandApplicationId"
        WHERE ${IN_EVENT}`,
    ),
    seal<BookingComment>(
      `SELECT c.id,
              c."createdAt",
              c."viewerId",
              c."bandApplicationId",
              c.comment,
              v."displayName",
              v."profilePicture"
         FROM "BandApplicationComment" c
         JOIN "BandApplication" a ON a.id = c."bandApplicationId"
         JOIN "Viewer" v ON v.id = c."viewerId"
        WHERE ${IN_EVENT}`,
    ),
  ]);
  return {url, applications, ratings, tags, comments};
}
