-- CrewCards move from "one row per chip with holder fields" to holders +
-- issuances (docs/crew-card-holders-plan.md):
--   CrewCardHolder      a person (viewerId or nickname), privileged
--   CrewCard            one issuance of a serial to a holder (the history)
--   CrewCardEnrollment  enrolled physical chips without a holder (anonymous)
-- Order.crewCardId becomes the plain serial Order.crewCardSerial, and
-- WalletPassRegistration points at the new uuid ids.

CREATE TYPE "public"."CrewCardSuspendedReason" AS ENUM('lost', 'replaced', 'reassigned');--> statement-breakpoint

-- The old table steps aside; its constraints are renamed so the new table can
-- use the names, and the foreign keys pointing at it are dropped.
ALTER TABLE "CrewCard" RENAME TO "CrewCardLegacy";--> statement-breakpoint
ALTER TABLE "CrewCardLegacy" RENAME CONSTRAINT "CrewCard_pkey" TO "CrewCardLegacy_pkey";--> statement-breakpoint
ALTER TABLE "CrewCardLegacy" DROP CONSTRAINT "CrewCard_viewerId_fkey";--> statement-breakpoint
ALTER TABLE "Order" DROP CONSTRAINT "Order_crewCardId_fkey";--> statement-breakpoint
ALTER TABLE "WalletPassRegistration" DROP CONSTRAINT "WalletPassRegistration_crewCardId_fkey";--> statement-breakpoint

CREATE TABLE "CrewCardHolder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"viewerId" text,
	"nickname" "citext",
	"privileged" boolean DEFAULT false NOT NULL,
	"pageToken" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
	CONSTRAINT "CrewCardHolder_identity_check" CHECK (num_nonnulls("CrewCardHolder"."viewerId", "CrewCardHolder"."nickname") = 1)
);
--> statement-breakpoint
CREATE TABLE "CrewCard" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"serial" "bytea" NOT NULL,
	"cardType" "CrewCardType" NOT NULL,
	"holderId" uuid NOT NULL,
	"validUntil" timestamp with time zone NOT NULL,
	"enrolledAt" timestamp with time zone NOT NULL,
	"reenrolledAt" timestamp with time zone,
	"issuedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
	"suspendedAt" timestamp with time zone,
	"suspendedReason" "CrewCardSuspendedReason",
	"walletAuthToken" text,
	"passUpdatedAt" timestamp with time zone,
	"walletPass" jsonb,
	CONSTRAINT "CrewCard_suspended_check" CHECK (("CrewCard"."suspendedAt" IS NULL) = ("CrewCard"."suspendedReason" IS NULL)),
	CONSTRAINT "CrewCard_walletAuthToken_check" CHECK ("CrewCard"."cardType" = 'PHYSICAL' OR "CrewCard"."walletAuthToken" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "CrewCardEnrollment" (
	"serial" "bytea" PRIMARY KEY NOT NULL,
	"validUntil" timestamp with time zone NOT NULL,
	"enrolledAt" timestamp with time zone NOT NULL,
	"deviceId" text
);
--> statement-breakpoint

-- Holders: one per viewer and one per nickname (citext: case-insensitive).
-- Privileged if any of their current cards was.
INSERT INTO "CrewCardHolder" ("viewerId", "nickname", "privileged", "pageToken")
SELECT
	"viewerId",
	CASE WHEN "viewerId" IS NULL THEN "nickname"::citext END,
	bool_or("privileged" AND NOT "suspended" AND "validUntil" > now()),
	translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_')
FROM "CrewCardLegacy"
WHERE "viewerId" IS NOT NULL OR "nickname" IS NOT NULL
GROUP BY "viewerId", CASE WHEN "viewerId" IS NULL THEN "nickname"::citext END;--> statement-breakpoint

-- Every card with a holder becomes an issuance. Old wallet cards from before
-- the web service have no auth token; they're all suspended, but the check
-- wants one.
INSERT INTO "CrewCard" (
	"serial", "cardType", "holderId", "validUntil", "enrolledAt", "issuedAt",
	"suspendedAt", "suspendedReason", "walletAuthToken", "passUpdatedAt", "walletPass"
)
SELECT
	l."id", l."cardType", h."id", l."validUntil", l."enrolledAt", l."enrolledAt",
	CASE WHEN l."suspended" THEN now() END,
	CASE WHEN l."suspended" THEN 'replaced'::"CrewCardSuspendedReason" END,
	CASE WHEN l."cardType" = 'APPLE_WALLET'
		THEN coalesce(l."walletAuthToken", translate(encode(gen_random_bytes(24), 'base64'), '+/', '-_'))
		ELSE l."walletAuthToken" END,
	l."passUpdatedAt", l."walletPass"
FROM "CrewCardLegacy" l
JOIN "CrewCardHolder" h ON
	(l."viewerId" IS NOT NULL AND h."viewerId" = l."viewerId")
	OR (l."viewerId" IS NULL AND h."nickname" = l."nickname"::citext);--> statement-breakpoint

-- One live card per holder and type (and per serial): the newest stays, older
-- ones were replaced (they were left unsuspended once they expired).
UPDATE "CrewCard" SET "suspendedAt" = now(), "suspendedReason" = 'replaced'
WHERE "id" IN (
	SELECT "id" FROM (
		SELECT "id", row_number() OVER (PARTITION BY "holderId", "cardType" ORDER BY "enrolledAt" DESC) AS n
		FROM "CrewCard" WHERE "suspendedAt" IS NULL
	) ranked WHERE n > 1
);--> statement-breakpoint
UPDATE "CrewCard" SET "suspendedAt" = now(), "suspendedReason" = 'replaced'
WHERE "id" IN (
	SELECT "id" FROM (
		SELECT "id", row_number() OVER (PARTITION BY "serial" ORDER BY "enrolledAt" DESC) AS n
		FROM "CrewCard" WHERE "suspendedAt" IS NULL
	) ranked WHERE n > 1
);--> statement-breakpoint

-- Chips without a holder that still work become enrollments. (Placeholder rows
-- for orders of unknown chips have `validUntil` = their insert time.)
INSERT INTO "CrewCardEnrollment" ("serial", "validUntil", "enrolledAt")
SELECT "id", "validUntil", "enrolledAt"
FROM "CrewCardLegacy"
WHERE "viewerId" IS NULL AND "nickname" IS NULL
	AND NOT "suspended" AND "validUntil" > now();--> statement-breakpoint

-- Orders keep the serial they were paid with.
ALTER TABLE "Order" RENAME COLUMN "crewCardId" TO "crewCardSerial";--> statement-breakpoint

-- The old model kept one row per chip and moved `enrolledAt` forward on each
-- re-enrollment, while showing the holder every order of the chip. Keep that:
-- a migrated physical card's window starts at the chip's first order. (Each
-- serial has exactly one migrated card.)
UPDATE "CrewCard" c SET "enrolledAt" = o.first
FROM (
	SELECT "crewCardSerial" AS serial, min("createdAt") AS first
	FROM "Order" WHERE "crewCardSerial" IS NOT NULL GROUP BY 1
) o
WHERE o.serial = c."serial" AND c."cardType" = 'PHYSICAL' AND o.first < c."enrolledAt";--> statement-breakpoint

-- Wallet registrations point at the uuid of the (unique) wallet card.
ALTER TABLE "WalletPassRegistration" DROP CONSTRAINT "WalletPassRegistration_pkey";--> statement-breakpoint
DROP INDEX "WalletPassRegistration_crewCardId_idx";--> statement-breakpoint
ALTER TABLE "WalletPassRegistration" RENAME COLUMN "crewCardId" TO "crewCardSerial";--> statement-breakpoint
ALTER TABLE "WalletPassRegistration" ADD COLUMN "crewCardId" uuid;--> statement-breakpoint
UPDATE "WalletPassRegistration" r SET "crewCardId" = c."id"
FROM "CrewCard" c
WHERE c."serial" = r."crewCardSerial" AND c."cardType" = 'APPLE_WALLET';--> statement-breakpoint
DELETE FROM "WalletPassRegistration" WHERE "crewCardId" IS NULL;--> statement-breakpoint
ALTER TABLE "WalletPassRegistration" DROP COLUMN "crewCardSerial";--> statement-breakpoint
ALTER TABLE "WalletPassRegistration" ALTER COLUMN "crewCardId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "WalletPassRegistration" ADD CONSTRAINT "WalletPassRegistration_pkey" PRIMARY KEY("deviceLibraryIdentifier","crewCardId");--> statement-breakpoint

DROP TABLE "CrewCardLegacy";--> statement-breakpoint

ALTER TABLE "CrewCard" ADD CONSTRAINT "CrewCard_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "public"."CrewCardHolder"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CrewCardEnrollment" ADD CONSTRAINT "CrewCardEnrollment_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CrewCardHolder" ADD CONSTRAINT "CrewCardHolder_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "public"."Viewer"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "WalletPassRegistration" ADD CONSTRAINT "WalletPassRegistration_crewCardId_fkey" FOREIGN KEY ("crewCardId") REFERENCES "public"."CrewCard"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "CrewCard_holderId_cardType_live_key" ON "CrewCard" USING btree ("holderId","cardType") WHERE "CrewCard"."suspendedAt" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "CrewCard_serial_live_key" ON "CrewCard" USING btree ("serial") WHERE "CrewCard"."suspendedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "CrewCard_serial_issuedAt_idx" ON "CrewCard" USING btree ("serial","issuedAt");--> statement-breakpoint
CREATE INDEX "CrewCard_holderId_idx" ON "CrewCard" USING btree ("holderId");--> statement-breakpoint
CREATE UNIQUE INDEX "CrewCardHolder_viewerId_key" ON "CrewCardHolder" USING btree ("viewerId");--> statement-breakpoint
CREATE UNIQUE INDEX "CrewCardHolder_nickname_key" ON "CrewCardHolder" USING btree ("nickname");--> statement-breakpoint
CREATE UNIQUE INDEX "CrewCardHolder_pageToken_key" ON "CrewCardHolder" USING btree ("pageToken");--> statement-breakpoint
CREATE INDEX "Order_crewCardSerial_createdAt_idx" ON "Order" USING btree ("crewCardSerial","createdAt");--> statement-breakpoint
CREATE INDEX "WalletPassRegistration_crewCardId_idx" ON "WalletPassRegistration" USING btree ("crewCardId");
