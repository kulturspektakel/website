CREATE TYPE "public"."BandRepertoire" AS ENUM('ExclusivelyOwnSongs', 'MostlyOwnSongs', 'MostlyCoverSongs', 'ExclusivelyCoverSongs');--> statement-breakpoint
CREATE TYPE "public"."CardTransactionType" AS ENUM('TopUp', 'Charge', 'Cashout', 'Repair', 'Donation');--> statement-breakpoint
CREATE TYPE "public"."DemoEmbedType" AS ENUM('Unresolvable', 'YouTubeVideo', 'YouTubePlaylist', 'BandcampAlbum', 'BandcampTrack', 'SoundcloudUrl', 'SpotifyTrack', 'SpotifyArtist', 'SpotifyAlbum');--> statement-breakpoint
CREATE TYPE "public"."DeviceType" AS ENUM('CONTACTLESS_TERMINAL', 'IPAD', 'NOISE_MONITOR');--> statement-breakpoint
CREATE TYPE "public"."DietType" AS ENUM('VEGETARIAN', 'VEGAN');--> statement-breakpoint
CREATE TYPE "public"."DonationSource" AS ENUM('Stripe', 'Manual', 'Membership', 'Other');--> statement-breakpoint
CREATE TYPE "public"."EventType" AS ENUM('Kulturspektakel', 'Other', 'Locker');--> statement-breakpoint
CREATE TYPE "public"."GenreCategory" AS ENUM('Rock', 'Pop', 'Indie', 'Reggae_Ska', 'Blues_Funk_Jazz_Soul', 'Folk_SingerSongwriter_Country', 'Elektro_HipHop', 'Hardrock_Metal_Punk', 'Other', 'DJ');--> statement-breakpoint
CREATE TYPE "public"."HeardAboutBookingFrom" AS ENUM('BYon', 'Newspaper', 'Friends', 'Website', 'Facebook', 'Instagram');--> statement-breakpoint
CREATE TYPE "public"."MinimumAge" AS ENUM('NONE', 'AGE_16', 'AGE_18');--> statement-breakpoint
CREATE TYPE "public"."NoiseTagType" AS ENUM('IGNORE', 'COMMENT');--> statement-breakpoint
CREATE TYPE "public"."NonceRequestStatus" AS ENUM('Pending', 'Approved', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."OrderPayment" AS ENUM('CASH', 'BON', 'SUM_UP', 'VOUCHER', 'FREE_CREW', 'FREE_BAND', 'KULT_CARD');--> statement-breakpoint
CREATE TYPE "public"."PreviouslyPlayed" AS ENUM('Yes', 'OtherFormation', 'No');--> statement-breakpoint
CREATE TABLE "Area" (
	"id" text PRIMARY KEY NOT NULL,
	"displayName" text NOT NULL,
	"order" integer NOT NULL,
	"themeColor" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AreaOpeningHour" (
	"id" serial PRIMARY KEY NOT NULL,
	"startTime" timestamp (3) NOT NULL,
	"endTime" timestamp (3) NOT NULL,
	"areaId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BandApplication" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"email" text NOT NULL,
	"bandname" text NOT NULL,
	"genre" text,
	"city" text NOT NULL,
	"facebook" text,
	"demo" text,
	"description" text,
	"numberOfArtists" integer,
	"numberOfNonMaleArtists" integer,
	"contactName" text NOT NULL,
	"contactPhone" text NOT NULL,
	"knowsKultFrom" text,
	"distance" double precision,
	"facebookLikes" integer,
	"website" text,
	"genreCategory" "GenreCategory" NOT NULL,
	"heardAboutBookingFrom" "HeardAboutBookingFrom",
	"contactedByViewerId" text,
	"instagram" text,
	"instagramFollower" integer,
	"eventId" text NOT NULL,
	"hasPreviouslyPlayed" "PreviouslyPlayed",
	"lastContactedAt" timestamp (3),
	"latitude" double precision,
	"longitude" double precision,
	"demoEmbedUrl" text,
	"demoEmbed" text,
	"demoEmbedType" "DemoEmbedType",
	"repertoire" "BandRepertoire",
	"spotifyArtist" text,
	"spotifyMonthlyListeners" integer,
	"imageUrl" text,
	"stageColumn" integer,
	"stageRow" integer
);
--> statement-breakpoint
CREATE TABLE "BandApplicationComment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"viewerId" text NOT NULL,
	"comment" text NOT NULL,
	"bandApplicationId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BandApplicationRating" (
	"viewerId" text NOT NULL,
	"rating" integer NOT NULL,
	"bandApplicationId" uuid NOT NULL,
	CONSTRAINT "BandApplicationRating_pkey" PRIMARY KEY("viewerId","bandApplicationId")
);
--> statement-breakpoint
CREATE TABLE "BandApplicationTag" (
	"bandApplicationId" uuid NOT NULL,
	"tag" "citext" NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"createdByViewerId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BandPlaying" (
	"name" text NOT NULL,
	"startTime" timestamp (3) NOT NULL,
	"endTime" timestamp (3) NOT NULL,
	"description" text,
	"shortDescription" text,
	"genre" text,
	"instagram" text,
	"spotify" text,
	"facebook" text,
	"website" text,
	"youtube" text,
	"soundcloud" text,
	"areaId" text NOT NULL,
	"eventId" text NOT NULL,
	"slug" text NOT NULL,
	"photo" uuid,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spotifyPreviewUrl" text
);
--> statement-breakpoint
CREATE TABLE "CardTransaction" (
	"clientId" text PRIMARY KEY NOT NULL,
	"cardId" text NOT NULL,
	"depositBefore" integer NOT NULL,
	"depositAfter" integer NOT NULL,
	"balanceBefore" integer NOT NULL,
	"balanceAfter" integer NOT NULL,
	"transactionType" "CardTransactionType" NOT NULL,
	"counter" integer,
	"orderId" integer
);
--> statement-breakpoint
CREATE TABLE "CrewCard" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"nickname" text,
	"suspended" boolean DEFAULT false NOT NULL,
	"privileged" boolean DEFAULT false NOT NULL,
	"viewerId" text,
	"validUntil" timestamp (3) NOT NULL,
	"enrolledAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Device" (
	"id" text PRIMARY KEY NOT NULL,
	"lastSeen" timestamp (3),
	"productListId" integer,
	"softwareVersion" text,
	"type" "DeviceType" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DeviceConfigVersion" (
	"crc32" integer NOT NULL,
	"version" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DeviceLocation" (
	"id" text PRIMARY KEY NOT NULL,
	"deviceId" text NOT NULL,
	"createdAt" timestamp (3) NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"locationName" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DeviceLog" (
	"clientId" text PRIMARY KEY NOT NULL,
	"batteryVoltage" integer,
	"usbVoltage" integer,
	"deviceId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deviceTime" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Donation" (
	"amount" integer NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"email" text,
	"name" text,
	"reference" text,
	"source" "DonationSource" NOT NULL,
	"message" text,
	"sentConfirmationAt" timestamp (3),
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spendenQuittungAt" timestamp (3),
	"quittungCity" text,
	"quittungName" text,
	"quittungStreet" text,
	"amountPins" integer
);
--> statement-breakpoint
CREATE TABLE "Event" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start" timestamp (3) NOT NULL,
	"end" timestamp (3) NOT NULL,
	"eventType" "EventType" NOT NULL,
	"bandApplicationStart" timestamp (3),
	"bandApplicationEnd" timestamp (3),
	"djApplicationEnd" timestamp (3),
	"poster" uuid,
	"description" text,
	"djApplicationStart" timestamp (3),
	"latitude" double precision,
	"location" text,
	"longitude" double precision,
	"lineupAnnouncementTime" timestamp (3),
	"immichAlbumShareUrl" text
);
--> statement-breakpoint
CREATE TABLE "GmailReminders" (
	"messageId" text PRIMARY KEY NOT NULL,
	"account" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ItemLocation" (
	"timeStamp" timestamp (3) PRIMARY KEY NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "News" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "NoiseLocation" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"locationName" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "NoiseLocationAssignment" (
	"id" text PRIMARY KEY NOT NULL,
	"locationId" text NOT NULL,
	"deviceId" text NOT NULL,
	"start" timestamp (3),
	"end" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "NoiseLocationLimit" (
	"id" text PRIMARY KEY NOT NULL,
	"locationId" text NOT NULL,
	"decibels" double precision NOT NULL,
	"start" timestamp (3),
	"end" timestamp (3),
	"series" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "NoiseLog" (
	"id" text PRIMARY KEY NOT NULL,
	"deviceId" text NOT NULL,
	"measuredAt" timestamp (3) NOT NULL,
	"bands" "bytea" NOT NULL,
	"laeq" smallint NOT NULL,
	"lafmax" smallint NOT NULL,
	"lceq" smallint NOT NULL,
	"lcfmax" smallint NOT NULL,
	"lcpeak" smallint NOT NULL,
	"laeq30m" smallint,
	"laeq5m" smallint,
	"lceq30m" smallint,
	"lceq5m" smallint
);
--> statement-breakpoint
CREATE TABLE "NoiseProject" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start" timestamp (3) NOT NULL,
	"end" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "NoiseTag" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"locationId" text,
	"deviceId" text,
	"type" "NoiseTagType" NOT NULL,
	"start" timestamp (3) NOT NULL,
	"end" timestamp (3),
	"text" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"createdByViewerId" text NOT NULL,
	"dedupeKey" text
);
--> statement-breakpoint
CREATE TABLE "Nonce" (
	"nonce" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"createdForId" text
);
--> statement-breakpoint
CREATE TABLE "NonceRequest" (
	"expiresAt" timestamp (3) NOT NULL,
	"createdForId" text,
	"status" "NonceRequestStatus" DEFAULT 'Pending' NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdForEmail" text
);
--> statement-breakpoint
CREATE TABLE "Order" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"payment" "OrderPayment" NOT NULL,
	"deposit" integer DEFAULT 0 NOT NULL,
	"deviceId" text,
	"crewCardId" "bytea",
	"notForMe" boolean
);
--> statement-breakpoint
CREATE TABLE "OrderItem" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"name" text NOT NULL,
	"perUnitPrice" integer NOT NULL,
	"productListId" integer
);
--> statement-breakpoint
CREATE TABLE "Page" (
	"slug" text PRIMARY KEY NOT NULL,
	"content" text,
	"left" text,
	"right" text,
	"bottom" text,
	"title" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Product" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(30) NOT NULL,
	"price" integer NOT NULL,
	"order" integer NOT NULL,
	"productListId" integer NOT NULL,
	"requiresDeposit" boolean DEFAULT false NOT NULL,
	"diet" "DietType",
	"minimumAge" "MinimumAge" DEFAULT 'NONE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProductAdditives" (
	"id" text PRIMARY KEY NOT NULL,
	"displayName" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProductList" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(20) NOT NULL,
	"emoji" text,
	"active" boolean DEFAULT true NOT NULL,
	"updatedAt" timestamp (3),
	"description" text,
	"lastUpdatedBy" text
);
--> statement-breakpoint
CREATE TABLE "_ProductToProductAdditives" (
	"A" integer NOT NULL,
	"B" text NOT NULL,
	CONSTRAINT "_ProductToProductAdditives_AB_pkey" PRIMARY KEY("A","B")
);
--> statement-breakpoint
CREATE TABLE "ShortDomainRedirect" (
	"slug" text PRIMARY KEY NOT NULL,
	"targetUrl" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TwoFactor" (
	"account" text NOT NULL,
	"service" text NOT NULL,
	"secret" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Viewer" (
	"id" text PRIMARY KEY NOT NULL,
	"displayName" text NOT NULL,
	"email" text NOT NULL,
	"profilePicture" text,
	"slackToken" text,
	"slackScopes" text[],
	"updatedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ViewerLocation" (
	"id" text PRIMARY KEY NOT NULL,
	"viewerId" text NOT NULL,
	"createdAt" timestamp (3) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AreaOpeningHour" ADD CONSTRAINT "AreaOpeningHour_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "public"."Area"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BandApplication" ADD CONSTRAINT "BandApplication_contactedByViewerId_fkey" FOREIGN KEY ("contactedByViewerId") REFERENCES "public"."Viewer"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BandApplication" ADD CONSTRAINT "BandApplication_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BandApplicationComment" ADD CONSTRAINT "BandApplicationComment_bandApplicationId_fkey" FOREIGN KEY ("bandApplicationId") REFERENCES "public"."BandApplication"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BandApplicationComment" ADD CONSTRAINT "BandApplicationComment_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "public"."Viewer"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BandApplicationRating" ADD CONSTRAINT "BandApplicationRating_bandApplicationId_fkey" FOREIGN KEY ("bandApplicationId") REFERENCES "public"."BandApplication"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BandApplicationRating" ADD CONSTRAINT "BandApplicationRating_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "public"."Viewer"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BandApplicationTag" ADD CONSTRAINT "BandApplicationTag_bandApplicationId_fkey" FOREIGN KEY ("bandApplicationId") REFERENCES "public"."BandApplication"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BandApplicationTag" ADD CONSTRAINT "BandApplicationTag_createdByViewerId_fkey" FOREIGN KEY ("createdByViewerId") REFERENCES "public"."Viewer"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BandPlaying" ADD CONSTRAINT "BandPlaying_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "public"."Area"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BandPlaying" ADD CONSTRAINT "BandPlaying_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CardTransaction" ADD CONSTRAINT "CardTransaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."DeviceLog"("clientId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CardTransaction" ADD CONSTRAINT "CardTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CrewCard" ADD CONSTRAINT "CrewCard_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "public"."Viewer"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Device" ADD CONSTRAINT "Device_productListId_fkey" FOREIGN KEY ("productListId") REFERENCES "public"."ProductList"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "DeviceLocation" ADD CONSTRAINT "DeviceLocation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "DeviceLog" ADD CONSTRAINT "DeviceLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "NoiseLocation" ADD CONSTRAINT "NoiseLocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."NoiseProject"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "NoiseLocationAssignment" ADD CONSTRAINT "NoiseLocationAssignment_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "NoiseLocationAssignment" ADD CONSTRAINT "NoiseLocationAssignment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."NoiseLocation"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "NoiseLocationLimit" ADD CONSTRAINT "NoiseLocationLimit_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."NoiseLocation"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "NoiseLog" ADD CONSTRAINT "NoiseLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "NoiseTag" ADD CONSTRAINT "NoiseTag_createdByViewerId_fkey" FOREIGN KEY ("createdByViewerId") REFERENCES "public"."Viewer"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "NoiseTag" ADD CONSTRAINT "NoiseTag_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "NoiseTag" ADD CONSTRAINT "NoiseTag_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."NoiseLocation"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "NoiseTag" ADD CONSTRAINT "NoiseTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."NoiseProject"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Nonce" ADD CONSTRAINT "Nonce_createdForId_fkey" FOREIGN KEY ("createdForId") REFERENCES "public"."Viewer"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "NonceRequest" ADD CONSTRAINT "NonceRequest_createdForId_fkey" FOREIGN KEY ("createdForId") REFERENCES "public"."Viewer"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_crewCardId_fkey" FOREIGN KEY ("crewCardId") REFERENCES "public"."CrewCard"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productListId_fkey" FOREIGN KEY ("productListId") REFERENCES "public"."ProductList"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Product" ADD CONSTRAINT "Product_productListId_fkey" FOREIGN KEY ("productListId") REFERENCES "public"."ProductList"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ProductList" ADD CONSTRAINT "ProductList_lastUpdatedBy_fkey" FOREIGN KEY ("lastUpdatedBy") REFERENCES "public"."Viewer"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_ProductToProductAdditives" ADD CONSTRAINT "_ProductToProductAdditives_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_ProductToProductAdditives" ADD CONSTRAINT "_ProductToProductAdditives_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."ProductAdditives"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ViewerLocation" ADD CONSTRAINT "ViewerLocation_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "public"."Viewer"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "BandApplicationRating_bandApplicationId_idx" ON "BandApplicationRating" USING btree ("bandApplicationId");--> statement-breakpoint
CREATE UNIQUE INDEX "BandApplicationTag_bandApplicationId_tag_key" ON "BandApplicationTag" USING btree ("bandApplicationId","tag");--> statement-breakpoint
CREATE UNIQUE INDEX "BandPlaying_areaId_startTime_key" ON "BandPlaying" USING btree ("areaId","startTime");--> statement-breakpoint
CREATE UNIQUE INDEX "BandPlaying_eventId_slug_key" ON "BandPlaying" USING btree ("eventId","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "DeviceConfigVersion_crc32_key" ON "DeviceConfigVersion" USING btree ("crc32");--> statement-breakpoint
CREATE INDEX "Donation_reference_idx" ON "Donation" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "NoiseLocationAssignment_deviceId_start_idx" ON "NoiseLocationAssignment" USING btree ("deviceId","start");--> statement-breakpoint
CREATE INDEX "NoiseLocationAssignment_locationId_start_idx" ON "NoiseLocationAssignment" USING btree ("locationId","start");--> statement-breakpoint
CREATE INDEX "NoiseLocationLimit_locationId_start_idx" ON "NoiseLocationLimit" USING btree ("locationId","start");--> statement-breakpoint
CREATE UNIQUE INDEX "NoiseLog_deviceId_measuredAt_key" ON "NoiseLog" USING btree ("deviceId","measuredAt");--> statement-breakpoint
CREATE UNIQUE INDEX "NoiseTag_dedupeKey_key" ON "NoiseTag" USING btree ("dedupeKey");--> statement-breakpoint
CREATE INDEX "NoiseTag_projectId_start_idx" ON "NoiseTag" USING btree ("projectId","start");--> statement-breakpoint
CREATE INDEX "_ProductToProductAdditives_B_index" ON "_ProductToProductAdditives" USING btree ("B");--> statement-breakpoint
CREATE UNIQUE INDEX "TwoFactor_account_service_key" ON "TwoFactor" USING btree ("account","service");--> statement-breakpoint
CREATE INDEX "ViewerLocation_viewerId_createdAt_idx" ON "ViewerLocation" USING btree ("viewerId","createdAt");