-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CEO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "tallyName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "fyStart" TIMESTAMP(3) NOT NULL,
    "fyEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tallyGuid" TEXT NOT NULL,
    "voucherType" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "partyName" TEXT,
    "narration" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherItem" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "stockItemName" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "gstRate" DECIMAL(5,2),
    "hsnCode" TEXT,

    CONSTRAINT "VoucherItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherLedgerEntry" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "ledgerName" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "isDebit" BOOLEAN NOT NULL,

    CONSTRAINT "VoucherLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ledger" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentGroup" TEXT NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isDebit" BOOLEAN NOT NULL DEFAULT true,
    "gstin" TEXT,
    "state" TEXT,

    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "hsnCode" TEXT,
    "gstRate" DECIMAL(5,2),
    "closingQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "closingValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avgCost" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outstanding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "billRef" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "pendingAmount" DECIMAL(18,2) NOT NULL,
    "overdueDays" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Outstanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "todaySales" DECIMAL(18,2) NOT NULL,
    "todayPurchase" DECIMAL(18,2) NOT NULL,
    "todayGrossProfit" DECIMAL(18,2) NOT NULL,
    "todayNetProfit" DECIMAL(18,2) NOT NULL,
    "collectionsToday" DECIMAL(18,2) NOT NULL,
    "outstandingReceivables" DECIMAL(18,2) NOT NULL,
    "outstandingPayables" DECIMAL(18,2) NOT NULL,
    "cashInHand" DECIMAL(18,2) NOT NULL,
    "bankBalance" DECIMAL(18,2) NOT NULL,
    "inventoryValue" DECIMAL(18,2) NOT NULL,
    "gstPayable" DECIMAL(18,2) NOT NULL,
    "mtdSales" DECIMAL(18,2) NOT NULL,
    "mtdPurchase" DECIMAL(18,2) NOT NULL,
    "ordersBilledToday" INTEGER NOT NULL DEFAULT 0,
    "newCustomersToday" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsSynced" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncTrigger" (
    "id" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),
    "syncType" TEXT NOT NULL DEFAULT 'manual',

    CONSTRAINT "SyncTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_tallyName_key" ON "Company"("tallyName");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_tallyGuid_key" ON "Voucher"("tallyGuid");

-- CreateIndex
CREATE INDEX "Voucher_companyId_date_idx" ON "Voucher"("companyId", "date");

-- CreateIndex
CREATE INDEX "Voucher_voucherType_date_idx" ON "Voucher"("voucherType", "date");

-- CreateIndex
CREATE INDEX "Voucher_partyName_idx" ON "Voucher"("partyName");

-- CreateIndex
CREATE INDEX "VoucherItem_stockItemName_idx" ON "VoucherItem"("stockItemName");

-- CreateIndex
CREATE INDEX "VoucherLedgerEntry_ledgerName_idx" ON "VoucherLedgerEntry"("ledgerName");

-- CreateIndex
CREATE INDEX "Ledger_parentGroup_idx" ON "Ledger"("parentGroup");

-- CreateIndex
CREATE UNIQUE INDEX "Ledger_companyId_name_key" ON "Ledger"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_companyId_name_key" ON "StockItem"("companyId", "name");

-- CreateIndex
CREATE INDEX "Outstanding_companyId_type_idx" ON "Outstanding"("companyId", "type");

-- CreateIndex
CREATE INDEX "Outstanding_partyName_idx" ON "Outstanding"("partyName");

-- CreateIndex
CREATE INDEX "KpiSnapshot_snapshotDate_idx" ON "KpiSnapshot"("snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "KpiSnapshot_companyId_snapshotDate_key" ON "KpiSnapshot"("companyId", "snapshotDate");

-- CreateIndex
CREATE INDEX "SyncLog_startedAt_idx" ON "SyncLog"("startedAt");

-- CreateIndex
CREATE INDEX "SyncTrigger_consumedAt_idx" ON "SyncTrigger"("consumedAt");

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherItem" ADD CONSTRAINT "VoucherItem_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherLedgerEntry" ADD CONSTRAINT "VoucherLedgerEntry_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outstanding" ADD CONSTRAINT "Outstanding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiSnapshot" ADD CONSTRAINT "KpiSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
