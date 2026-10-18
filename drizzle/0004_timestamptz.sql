-- The timestamps were stored as UTC wall-clock time. Converting
-- timestamp -> timestamptz reads them in the session time zone; with UTC (and
-- no precision on the new type) Postgres only changes the column type: no
-- table rewrite, values unchanged.
SET TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "AreaOpeningHour" ALTER COLUMN "startTime" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "AreaOpeningHour" ALTER COLUMN "endTime" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "BandApplication" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "BandApplication" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "BandApplication" ALTER COLUMN "lastContactedAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "BandApplicationComment" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "BandApplicationComment" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "BandApplicationTag" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "BandApplicationTag" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "BandPlaying" ALTER COLUMN "startTime" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "BandPlaying" ALTER COLUMN "endTime" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "CrewCard" ALTER COLUMN "validUntil" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "CrewCard" ALTER COLUMN "enrolledAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Device" ALTER COLUMN "lastSeen" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "DeviceConfigVersion" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "DeviceConfigVersion" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "DeviceLocation" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "DeviceLog" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "DeviceLog" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "DeviceLog" ALTER COLUMN "deviceTime" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Donation" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Donation" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "Donation" ALTER COLUMN "sentConfirmationAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Donation" ALTER COLUMN "spendenQuittungAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Event" ALTER COLUMN "start" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Event" ALTER COLUMN "end" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Event" ALTER COLUMN "bandApplicationStart" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Event" ALTER COLUMN "bandApplicationEnd" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Event" ALTER COLUMN "djApplicationEnd" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Event" ALTER COLUMN "djApplicationStart" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Event" ALTER COLUMN "lineupAnnouncementTime" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ItemLocation" ALTER COLUMN "timeStamp" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "News" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "News" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "NoiseLocationAssignment" ALTER COLUMN "start" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "NoiseLocationAssignment" ALTER COLUMN "end" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "NoiseLocationLimit" ALTER COLUMN "start" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "NoiseLocationLimit" ALTER COLUMN "end" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "NoiseLog" ALTER COLUMN "measuredAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "NoiseProject" ALTER COLUMN "start" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "NoiseProject" ALTER COLUMN "end" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "NoiseTag" ALTER COLUMN "start" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "NoiseTag" ALTER COLUMN "end" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "NoiseTag" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "NoiseTag" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "Nonce" ALTER COLUMN "expiresAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "NonceRequest" ALTER COLUMN "expiresAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Order" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Order" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "ProductList" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Viewer" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Viewer" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "ViewerLocation" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;