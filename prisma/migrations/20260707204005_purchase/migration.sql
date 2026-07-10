-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "daily_usage" INTEGER,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "reposted_at" TIMESTAMP(3),
ADD COLUMN     "requested_quantity" INTEGER DEFAULT 0,
ADD COLUMN     "supplier_delivery_days" INTEGER,
ADD COLUMN     "supplier_id" TEXT;

-- AlterTable
ALTER TABLE "stock_counts" ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "delivery_days" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
