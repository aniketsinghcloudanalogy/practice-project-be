-- AlterTable
ALTER TABLE "LineItem" ADD COLUMN     "Discount_Class__c" TEXT,
ADD COLUMN     "Discount_Subclass__c" TEXT,
ADD COLUMN     "adjusted_price" TEXT,
ADD COLUMN     "adjusted_quantity" TEXT,
ADD COLUMN     "appId" INTEGER,
ADD COLUMN     "attemptNumber" DOUBLE PRECISION,
ADD COLUMN     "availability" TEXT,
ADD COLUMN     "bundle_cost" TEXT,
ADD COLUMN     "bundle_ext_price" TEXT,
ADD COLUMN     "bundle_gp" TEXT,
ADD COLUMN     "bundle_gp_percentage" TEXT,
ADD COLUMN     "bundle_id" INTEGER,
ADD COLUMN     "bundle_msrp" TEXT,
ADD COLUMN     "bundle_name" TEXT,
ADD COLUMN     "bundle_rebate" TEXT,
ADD COLUMN     "bundle_rebate_amount" TEXT,
ADD COLUMN     "bundle_unit_price" TEXT,
ADD COLUMN     "changeFlag" TEXT,
ADD COLUMN     "changeSource" TEXT,
ADD COLUMN     "clin" TEXT,
ADD COLUMN     "contract_fee_amount" TEXT,
ADD COLUMN     "contract_fee_percentage" TEXT,
ADD COLUMN     "country_of_origin" TEXT,
ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "discount_percentage" TEXT,
ADD COLUMN     "display_mpn" TEXT,
ADD COLUMN     "distributor_product_code" TEXT,
ADD COLUMN     "end_date" TEXT,
ADD COLUMN     "energy_star_flag" TEXT,
ADD COLUMN     "eol_date" TEXT,
ADD COLUMN     "epeat_flag" TEXT,
ADD COLUMN     "equivalent_clin" TEXT,
ADD COLUMN     "esi_price" TEXT,
ADD COLUMN     "eventId" INTEGER,
ADD COLUMN     "excel_bundle_name" TEXT,
ADD COLUMN     "extended_list" TEXT,
ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "gross_profit" DOUBLE PRECISION,
ADD COLUMN     "gross_profit_percentage" DOUBLE PRECISION,
ADD COLUMN     "gsa_price" TEXT,
ADD COLUMN     "item_category_code" TEXT,
ADD COLUMN     "lead_time" TEXT,
ADD COLUMN     "line_amount" TEXT,
ADD COLUMN     "list_price" TEXT,
ADD COLUMN     "ma_flag" TEXT,
ADD COLUMN     "manufacturer_product_code" TEXT,
ADD COLUMN     "model_id" TEXT,
ADD COLUMN     "months" TEXT,
ADD COLUMN     "mpn" TEXT,
ADD COLUMN     "msrp" TEXT,
ADD COLUMN     "ndr_cost" TEXT,
ADD COLUMN     "objectId" DOUBLE PRECISION,
ADD COLUMN     "occurredAt" DOUBLE PRECISION,
ADD COLUMN     "oem" TEXT,
ADD COLUMN     "oem_name" TEXT,
ADD COLUMN     "optional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "organization" TEXT,
ADD COLUMN     "partner_fee_amount" TEXT,
ADD COLUMN     "partner_fee_percentage" TEXT,
ADD COLUMN     "pdf_url" TEXT,
ADD COLUMN     "portalId" DOUBLE PRECISION,
ADD COLUMN     "pricing_method" TEXT,
ADD COLUMN     "product_id" INTEGER,
ADD COLUMN     "product_name" TEXT,
ADD COLUMN     "quote_config_id" INTEGER,
ADD COLUMN     "serial_" TEXT,
ADD COLUMN     "serial_number" TEXT,
ADD COLUMN     "service_duration" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "ss_part" TEXT,
ADD COLUMN     "start_date" TEXT,
ADD COLUMN     "sub_total" TEXT,
ADD COLUMN     "subscriptionId" DOUBLE PRECISION,
ADD COLUMN     "subscriptionType" TEXT,
ADD COLUMN     "subscription_term" TEXT,
ADD COLUMN     "taa_flag" TEXT,
ADD COLUMN     "td_number" TEXT,
ADD COLUMN     "term_months" TEXT,
ADD COLUMN     "term_unit_calc" TEXT,
ADD COLUMN     "term_years" TEXT,
ADD COLUMN     "total_cost" TEXT,
ADD COLUMN     "total_cost_to_use" TEXT,
ADD COLUMN     "unit_price" TEXT,
ADD COLUMN     "unspsc" TEXT,
ADD COLUMN     "use_line_amount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vendor_disti" TEXT,
ADD COLUMN     "vendor_disti_name" TEXT,
ADD COLUMN     "vendor_line_number" TEXT,
ADD COLUMN     "vendor_product_code" TEXT,
ADD COLUMN     "vendor_quote_line_item" TEXT,
ADD COLUMN     "vendor_quote_number" TEXT;

-- AlterTable
ALTER TABLE "Profitabilty_line_items" ADD COLUMN     "Discount_Class__c" TEXT,
ADD COLUMN     "Discount_Subclass__c" TEXT,
ADD COLUMN     "adjusted_price" TEXT,
ADD COLUMN     "adjusted_quantity" TEXT,
ADD COLUMN     "appId" INTEGER,
ADD COLUMN     "attemptNumber" DOUBLE PRECISION,
ADD COLUMN     "availability" TEXT,
ADD COLUMN     "bundle_cost" TEXT,
ADD COLUMN     "bundle_ext_price" TEXT,
ADD COLUMN     "bundle_gp" TEXT,
ADD COLUMN     "bundle_gp_percentage" TEXT,
ADD COLUMN     "bundle_id" INTEGER,
ADD COLUMN     "bundle_msrp" TEXT,
ADD COLUMN     "bundle_name" TEXT,
ADD COLUMN     "bundle_rebate" TEXT,
ADD COLUMN     "bundle_rebate_amount" TEXT,
ADD COLUMN     "bundle_unit_price" TEXT,
ADD COLUMN     "changeFlag" TEXT,
ADD COLUMN     "changeSource" TEXT,
ADD COLUMN     "clin" TEXT,
ADD COLUMN     "contract_fee_amount" TEXT,
ADD COLUMN     "contract_fee_percentage" TEXT,
ADD COLUMN     "country_of_origin" TEXT,
ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "discount_percentage" TEXT,
ADD COLUMN     "display_mpn" TEXT,
ADD COLUMN     "distributor_product_code" TEXT,
ADD COLUMN     "end_date" TEXT,
ADD COLUMN     "energy_star_flag" TEXT,
ADD COLUMN     "eol_date" TEXT,
ADD COLUMN     "epeat_flag" TEXT,
ADD COLUMN     "equivalent_clin" TEXT,
ADD COLUMN     "esi_price" TEXT,
ADD COLUMN     "eventId" INTEGER,
ADD COLUMN     "excel_bundle_name" TEXT,
ADD COLUMN     "extended_list" TEXT,
ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "gross_profit" DOUBLE PRECISION,
ADD COLUMN     "gross_profit_percentage" DOUBLE PRECISION,
ADD COLUMN     "gsa_price" TEXT,
ADD COLUMN     "item_category_code" TEXT,
ADD COLUMN     "lead_time" TEXT,
ADD COLUMN     "line_amount" TEXT,
ADD COLUMN     "list_price" TEXT,
ADD COLUMN     "ma_flag" TEXT,
ADD COLUMN     "manufacturer_product_code" TEXT,
ADD COLUMN     "model_id" TEXT,
ADD COLUMN     "months" TEXT,
ADD COLUMN     "mpn" TEXT,
ADD COLUMN     "msrp" TEXT,
ADD COLUMN     "ndr_cost" TEXT,
ADD COLUMN     "objectId" DOUBLE PRECISION,
ADD COLUMN     "occurredAt" DOUBLE PRECISION,
ADD COLUMN     "oem" TEXT,
ADD COLUMN     "oem_name" TEXT,
ADD COLUMN     "optional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "organization" TEXT,
ADD COLUMN     "partner_fee_amount" TEXT,
ADD COLUMN     "partner_fee_percentage" TEXT,
ADD COLUMN     "pdf_url" TEXT,
ADD COLUMN     "portalId" DOUBLE PRECISION,
ADD COLUMN     "pricing_method" TEXT,
ADD COLUMN     "product_id" INTEGER,
ADD COLUMN     "product_name" TEXT,
ADD COLUMN     "quote_config_id" INTEGER,
ADD COLUMN     "serial_" TEXT,
ADD COLUMN     "serial_number" TEXT,
ADD COLUMN     "service_duration" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "ss_part" TEXT,
ADD COLUMN     "start_date" TEXT,
ADD COLUMN     "sub_total" TEXT,
ADD COLUMN     "subscriptionId" DOUBLE PRECISION,
ADD COLUMN     "subscriptionType" TEXT,
ADD COLUMN     "subscription_term" TEXT,
ADD COLUMN     "taa_flag" TEXT,
ADD COLUMN     "td_number" TEXT,
ADD COLUMN     "term_months" TEXT,
ADD COLUMN     "term_unit_calc" TEXT,
ADD COLUMN     "term_years" TEXT,
ADD COLUMN     "total_cost" TEXT,
ADD COLUMN     "total_cost_to_use" TEXT,
ADD COLUMN     "unit_price" TEXT,
ADD COLUMN     "unspsc" TEXT,
ADD COLUMN     "use_line_amount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vendor_disti" TEXT,
ADD COLUMN     "vendor_disti_name" TEXT,
ADD COLUMN     "vendor_line_number" TEXT,
ADD COLUMN     "vendor_product_code" TEXT,
ADD COLUMN     "vendor_quote_line_item" TEXT,
ADD COLUMN     "vendor_quote_number" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "opportunity_id" TEXT;

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteConfigurationModel" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "config" JSONB,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteConfigurationModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_isDeleted_idx" ON "Product"("isDeleted");

-- CreateIndex
CREATE INDEX "Bundle_isDeleted_idx" ON "Bundle"("isDeleted");

-- CreateIndex
CREATE INDEX "QuoteConfigurationModel_isDeleted_idx" ON "QuoteConfigurationModel"("isDeleted");

-- CreateIndex
CREATE INDEX "LineItem_customer_id_idx" ON "LineItem"("customer_id");

-- CreateIndex
CREATE INDEX "LineItem_product_id_idx" ON "LineItem"("product_id");

-- CreateIndex
CREATE INDEX "LineItem_bundle_id_idx" ON "LineItem"("bundle_id");

-- CreateIndex
CREATE INDEX "Profitabilty_line_items_customer_id_idx" ON "Profitabilty_line_items"("customer_id");

-- CreateIndex
CREATE INDEX "Profitabilty_line_items_product_id_idx" ON "Profitabilty_line_items"("product_id");

-- CreateIndex
CREATE INDEX "Profitabilty_line_items_bundle_id_idx" ON "Profitabilty_line_items"("bundle_id");

-- CreateIndex
CREATE INDEX "Quote_customer_id_idx" ON "Quote"("customer_id");

-- CreateIndex
CREATE INDEX "Quote_opportunity_id_idx" ON "Quote"("opportunity_id");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "Bundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_quote_config_id_fkey" FOREIGN KEY ("quote_config_id") REFERENCES "QuoteConfigurationModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profitabilty_line_items" ADD CONSTRAINT "Profitabilty_line_items_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profitabilty_line_items" ADD CONSTRAINT "Profitabilty_line_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profitabilty_line_items" ADD CONSTRAINT "Profitabilty_line_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "Bundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profitabilty_line_items" ADD CONSTRAINT "Profitabilty_line_items_quote_config_id_fkey" FOREIGN KEY ("quote_config_id") REFERENCES "QuoteConfigurationModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
