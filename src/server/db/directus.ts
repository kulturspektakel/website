import {integer, pgSchema, uuid, varchar} from 'drizzle-orm/pg-core';

// The Directus tables the app reads. They live in the `directus` schema of the
// same database and belong to Directus: this file is deliberately outside
// drizzle.config.ts's `schema`, so drizzle-kit never generates migrations for
// them. Only the columns the app uses are declared.
const directus = pgSchema('directus');

export const directusUsers = directus.table('directus_users', {
  id: uuid().primaryKey(),
  // The Slack user id for accounts created via Slack SSO (== `Viewer.id`).
  external_identifier: varchar(),
  email: varchar(),
  first_name: varchar(),
  last_name: varchar(),
});

export const directusFiles = directus.table('directus_files', {
  id: uuid().primaryKey(),
  width: integer(),
  height: integer(),
  copyright: varchar(),
  title: varchar(),
});
