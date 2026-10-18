-- Functions and triggers that live in the database but can't be expressed in
-- the Drizzle schema. Recorded here so a fresh database (tests, a new branch)
-- gets them too.
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
  SELECT public.unaccent('public.unaccent', $1)
$function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.set_slug_from_title()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
    BEGIN
      NEW.slug := slugify(NEW.title);
    RETURN NEW;
  END
$function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.slugify(value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE STRICT
AS $function$
  -- removes accents (diacritic signs) from a given string --
  WITH "unaccented" AS (
    SELECT unaccent("value") AS "value"
  ),
  -- lowercases the string
  "lowercase" AS (
    SELECT lower("value") AS "value"
    FROM "unaccented"
  ),
  -- replaces anything that's not a letter, number or hyphen('-') with a hyphen('-')
  "hyphenated" AS (
    SELECT regexp_replace("value", '[^a-z0-9\-]+', '-', 'gi') AS "value"
    FROM "lowercase"
  ),
  -- trims hyphens('-') if they exist on the head or tail of the string
  "trimmed" AS (
    SELECT regexp_replace(regexp_replace("value", '\-+$', ''), '^\-+', '') AS "value"
    FROM "hyphenated"
  )
  SELECT "value" FROM "trimmed";
$function$;
--> statement-breakpoint
CREATE TRIGGER news_generate_slug BEFORE INSERT ON public."News" FOR EACH ROW WHEN (((new.title IS NOT NULL) AND (new.slug IS NULL))) EXECUTE FUNCTION set_slug_from_title();
