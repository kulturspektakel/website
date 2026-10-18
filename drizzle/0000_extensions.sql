-- Extensions the schema relies on (citext columns, gen_random_uuid(),
-- unaccent for the slug and search functions, trigram indexes).
CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA "public";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "public";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "public";
