-- Every existing CrewCard is a physical card: backfill via a temporary default,
-- then drop it so new rows have to set the type explicitly.
CREATE TYPE "public"."CrewCardType" AS ENUM('PHYSICAL', 'APPLE_WALLET');--> statement-breakpoint
ALTER TABLE "CrewCard" ADD COLUMN "cardType" "CrewCardType" NOT NULL DEFAULT 'PHYSICAL';--> statement-breakpoint
ALTER TABLE "CrewCard" ALTER COLUMN "cardType" DROP DEFAULT;
