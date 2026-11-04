CREATE TABLE "WalletPassRegistration" (
	"deviceLibraryIdentifier" text NOT NULL,
	"crewCardId" "bytea" NOT NULL,
	"pushToken" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
	CONSTRAINT "WalletPassRegistration_pkey" PRIMARY KEY("deviceLibraryIdentifier","crewCardId")
);
--> statement-breakpoint
ALTER TABLE "CrewCard" ADD COLUMN "walletAuthToken" text;--> statement-breakpoint
ALTER TABLE "CrewCard" ADD COLUMN "passUpdatedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "WalletPassRegistration" ADD CONSTRAINT "WalletPassRegistration_crewCardId_fkey" FOREIGN KEY ("crewCardId") REFERENCES "public"."CrewCard"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "WalletPassRegistration_crewCardId_idx" ON "WalletPassRegistration" USING btree ("crewCardId");