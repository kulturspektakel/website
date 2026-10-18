ALTER TABLE "BandApplication" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "BandApplicationComment" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "BandApplicationTag" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "DeviceConfigVersion" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "DeviceLog" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "Donation" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "News" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "NoiseLocation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;--> statement-breakpoint
ALTER TABLE "NoiseLocationAssignment" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;--> statement-breakpoint
ALTER TABLE "NoiseLocationLimit" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;--> statement-breakpoint
ALTER TABLE "NoiseLog" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;--> statement-breakpoint
ALTER TABLE "NoiseProject" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;--> statement-breakpoint
ALTER TABLE "NoiseTag" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;--> statement-breakpoint
ALTER TABLE "NoiseTag" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "Order" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "Viewer" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;--> statement-breakpoint
ALTER TABLE "Viewer" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE "ViewerLocation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;--> statement-breakpoint
-- `Viewer.updatedAt` was set by the ORM, so Directus's Slack login upsert
-- never bumped it.
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW."updatedAt" := CURRENT_TIMESTAMP(3);
  RETURN NEW;
END;
$function$;--> statement-breakpoint
CREATE TRIGGER viewer_set_updated_at BEFORE UPDATE ON "Viewer"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
