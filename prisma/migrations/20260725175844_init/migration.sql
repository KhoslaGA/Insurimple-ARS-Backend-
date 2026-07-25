-- CreateTable
CREATE TABLE "tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "primary_contact" JSONB NOT NULL,

    CONSTRAINT "household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "policy_number" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "expires_on" TIMESTAMP(3) NOT NULL,
    "risk" JSONB NOT NULL,

    CONSTRAINT "policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_shop" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "policy_ref" TEXT,
    "purpose" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "risk_ref" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_result" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "carrier_id" TEXT NOT NULL,
    "carrier_name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "premium_cents" INTEGER,
    "coverage_variant" TEXT,
    "decline_reason" TEXT,
    "responded_at" TIMESTAMP(3) NOT NULL,
    "presented_to_client" BOOLEAN NOT NULL DEFAULT false,
    "simulated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "quote_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renewal_transaction" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "policy_ref" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "expiring_premium_cents" INTEGER NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "shop_id" TEXT,
    "outcome" JSONB,

    CONSTRAINT "renewal_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "household_tenant_id_idx" ON "household"("tenant_id");

-- CreateIndex
CREATE INDEX "policy_tenant_id_idx" ON "policy"("tenant_id");

-- CreateIndex
CREATE INDEX "policy_household_id_idx" ON "policy"("household_id");

-- CreateIndex
CREATE INDEX "quote_shop_tenant_id_idx" ON "quote_shop"("tenant_id");

-- CreateIndex
CREATE INDEX "quote_result_tenant_id_idx" ON "quote_result"("tenant_id");

-- CreateIndex
CREATE INDEX "quote_result_shop_id_idx" ON "quote_result"("shop_id");

-- CreateIndex
CREATE INDEX "renewal_transaction_tenant_id_idx" ON "renewal_transaction"("tenant_id");

-- AddForeignKey
ALTER TABLE "household" ADD CONSTRAINT "household_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy" ADD CONSTRAINT "policy_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy" ADD CONSTRAINT "policy_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_shop" ADD CONSTRAINT "quote_shop_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_result" ADD CONSTRAINT "quote_result_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_result" ADD CONSTRAINT "quote_result_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "quote_shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_transaction" ADD CONSTRAINT "renewal_transaction_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
