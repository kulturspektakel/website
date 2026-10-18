-- Prisma's implicit many-to-many join table, renamed after what it holds.
-- Renames only: rows, keys and cascades are unchanged.
ALTER TABLE "_ProductToProductAdditives" RENAME TO "ProductAdditiveLink";--> statement-breakpoint
ALTER TABLE "ProductAdditiveLink" RENAME COLUMN "A" TO "productId";--> statement-breakpoint
ALTER TABLE "ProductAdditiveLink" RENAME COLUMN "B" TO "productAdditiveId";--> statement-breakpoint
ALTER TABLE "ProductAdditiveLink" RENAME CONSTRAINT "_ProductToProductAdditives_AB_pkey" TO "ProductAdditiveLink_pkey";--> statement-breakpoint
ALTER TABLE "ProductAdditiveLink" RENAME CONSTRAINT "_ProductToProductAdditives_A_fkey" TO "ProductAdditiveLink_productId_fkey";--> statement-breakpoint
ALTER TABLE "ProductAdditiveLink" RENAME CONSTRAINT "_ProductToProductAdditives_B_fkey" TO "ProductAdditiveLink_productAdditiveId_fkey";--> statement-breakpoint
ALTER INDEX "_ProductToProductAdditives_B_index" RENAME TO "ProductAdditiveLink_productAdditiveId_idx";
