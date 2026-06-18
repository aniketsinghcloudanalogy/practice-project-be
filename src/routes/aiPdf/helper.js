const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const crypto = require('crypto');

// ─── Selects (unchanged) ─────────────────────────────────────────────────────

const TABLE_SELECT = {
  id: true, pdfUploadId: true, userId: true, title: true,
  columns: true, lineItemColumnMapping: true,
  isDeleted: true, createdAt: true, updatedAt: true,
};

const ROW_SELECT = {
  id: true, pdfTableId: true, rowData: true, rowIndex: true,
  isDeleted: true, createdAt: true, updatedAt: true,
};

// LINE_ITEM_FIELD_OPTIONS + LINE_ITEM_FIELD_KEYS removed — live on the frontend now.
// If you ever need them server-side (e.g. for a CSV export), import from a shared package.

// ─── processUploadedPdf (unchanged — already optimal) ────────────────────────

const processUploadedPdf = async ({ userId, fileName, extractedData }) => {
  const tables = Array.isArray(extractedData?.tables) ? extractedData.tables : [];
  if (tables.length === 0) throw new ApiError(422, 'No tables found in PDF');

  return prisma.$transaction(async (tx) => {
    const pdfUpload = await tx.pdfUpload.create({
      data: { userId, fileName },
      select: { id: true },
    });

    const results = await Promise.all(
      tables.map(async (table) => {
        const pdfTable = await tx.pdfTable.create({
          data: {
            pdfUploadId: pdfUpload.id, userId,
            title: table.title || null,
            columns: table.columns || [],
            lineItemColumnMapping: null,
          },
          select: { id: true },
        });

        const rows = Array.isArray(table.rows) ? table.rows : [];
        if (rows.length > 0) {
          await tx.pdfTableRow.createMany({
            data: rows.map((row, rowIndex) => ({
              pdfTableId: pdfTable.id, rowData: row, rowIndex,
            })),
          });
        }
        return { tableId: pdfTable.id, rowCount: rows.length };
      })
    );

    return { uploadId: pdfUpload.id, tableCount: tables.length, tables: results };
  });
};

// ─── getUserUploads (unchanged) ───────────────────────────────────────────────

const getUserUploads = async (userId) =>
  prisma.pdfUpload.findMany({
    where: { userId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, fileName: true, createdAt: true, updatedAt: true,
      _count: { select: { tables: { where: { isDeleted: false } } } },
    },
  });

// ─── getUploadWithTables (unchanged) ─────────────────────────────────────────

const getUploadWithTables = async (uploadId, userId) =>
  prisma.pdfUpload.findFirst({
    where: { id: uploadId, userId, isDeleted: false },
    select: {
      id: true, fileName: true, userId: true, createdAt: true, updatedAt: true,
      tables: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'asc' },
        select: {
          ...TABLE_SELECT,
          rows: {
            where: { isDeleted: false },
            orderBy: { rowIndex: 'asc' },
            select: ROW_SELECT,
          },
        },
      },
    },
  });

const hashMapping = (mapping) =>
  crypto
    .createHash('md5')
    .update(JSON.stringify(mapping ?? {}))
    .digest('hex');

// ─── buildLineItemRecords — OPTIMIZED ────────────────────────────────────────
// Removed the normalizeLineItemMapping call here.
// Caller (syncUploadTables) already passes a clean mapping, or the frontend does.

const buildLineItemRecords = ({ rows, mapping, userId, tableId, tableTitle }) => {
  const mappingEntries = Object.entries(mapping);
  if (mappingEntries.length === 0) return [];

  return rows.map((row, rowIndex) => {
    const lineItem = {
      userId,
      pdfTableId:      tableId,
      sourceTableTitle: tableTitle || null,
      rowSourceId:     row.id || null,
      rowIndex:        row.rowIndex ?? rowIndex,
    };
    for (const [sourceColumn, targetField] of mappingEntries) {
      lineItem[targetField] = row.rowData?.[sourceColumn] ?? null;
    }
    return lineItem;
  });
};

// ─── syncUploadTables — OPTIMIZED ────────────────────────────────────────────
// Before: for…of with sequential awaits inside = one round-trip per table
// After:  batch all reads up-front, then process tables with minimal queries

const syncUploadTables = async ({ uploadId, userId, tables }) => {
  // Payload arrives pre-normalized from the frontend.
  // No need to call normalizeColumns/normalizeRows/normalizeLineItemMapping here.

  return prisma.$transaction(async (tx) => {
    const upload = await tx.pdfUpload.findFirst({
      where: { id: uploadId, userId, isDeleted: false },
      select: { id: true },
    });
    if (!upload) throw new ApiError(404, 'Upload not found');

    // ── Batch read 1: all existing tables ────────────────────────────────────
    const existingTables = await tx.pdfTable.findMany({
      where: { pdfUploadId: uploadId, userId, isDeleted: false },
      select: { id: true, lineItemColumnMapping: true },
    });

    const existingTableIds = new Set(existingTables.map((t) => t.id));
    const existingTableMappingsById = new Map(
      existingTables.map((t) => [t.id, t.lineItemColumnMapping ?? {}])
    );
    const incomingTableIds = new Set(
      tables.filter(t => typeof t?.id === 'string' && t.id.length > 0).map(t => t.id)
    );

    const tableIdsToDelete = [...existingTableIds].filter(id => !incomingTableIds.has(id));
    const activeExistingTableIds = [...existingTableIds].filter(id => incomingTableIds.has(id));

    // ── Batch read 2: all rows for active tables in ONE query ─────────────────
    // Before: one findMany per table inside the loop
    // After: single query, grouped into a Map
    const existingRowsByTableId = new Map();

    if (activeExistingTableIds.length > 0) {
      const allRows = await tx.pdfTableRow.findMany({
        where: { pdfTableId: { in: activeExistingTableIds }, isDeleted: false },
        select: { id: true, pdfTableId: true },
      });
      for (const row of allRows) {
        const bucket = existingRowsByTableId.get(row.pdfTableId);
        bucket ? bucket.push(row.id) : existingRowsByTableId.set(row.pdfTableId, [row.id]);
      }
    }

    // ── Batch delete stale tables ─────────────────────────────────────────────
    if (tableIdsToDelete.length > 0) {
      await Promise.all([
        tx.pdfTable.updateMany({
          where: { id: { in: tableIdsToDelete }, pdfUploadId: uploadId, userId },
          data: { isDeleted: true },
        }),
        tx.pdfTableRow.updateMany({
          where: { pdfTableId: { in: tableIdsToDelete } },
          data: { isDeleted: true },
        }),
        tx.lineItem.updateMany({
          where: { pdfTableId: { in: tableIdsToDelete }, userId, isDeleted: false },
          data: { isDeleted: true },
        }),
      ]);
    }

    // ── Process each incoming table ───────────────────────────────────────────
    // Rows to create are collected across all tables, then flushed in ONE createMany.
    const allRowsToCreate = [];
    const tableLineItems  = [];  // { tableId, items[] }
    const changedTableIds = new Set();

    for (const incomingTable of tables) {
      // Frontend sends clean data — no normalization needed here.
      const tableColumns   = Array.isArray(incomingTable.columns) ? incomingTable.columns : [];
      const tableRows      = Array.isArray(incomingTable.rows)    ? incomingTable.rows    : [];
      const lineItemMapping = incomingTable.lineItemMapping ?? {};

      let tableId = incomingTable.id;
      const isExistingTable = Boolean(tableId && existingTableIds.has(tableId));
      const existingMapping = isExistingTable
        ? existingTableMappingsById.get(tableId) ?? {}
        : null;
      const hasMappingChanged = !isExistingTable || hashMapping(existingMapping) !== hashMapping(lineItemMapping);

      if (isExistingTable) {
        await tx.pdfTable.update({
          where: { id: tableId },
          data: {
            title:                incomingTable.title || null,
            columns:              tableColumns,
            lineItemColumnMapping: lineItemMapping,
            isDeleted:            false,
          },
        });
      } else {
        const created = await tx.pdfTable.create({
          data: {
            pdfUploadId: uploadId, userId,
            title:   incomingTable.title || null,
            columns: tableColumns,
            lineItemColumnMapping: lineItemMapping,
          },
          select: { id: true },
        });
        tableId = created.id;
      }

      const existingRowIds = new Set(existingRowsByTableId.get(tableId) ?? []);
      const incomingRowIds = new Set(
        tableRows.filter(r => typeof r.id === 'string' && r.id.length > 0).map(r => r.id)
      );

      const rowIdsToDelete = [...existingRowIds].filter(id => !incomingRowIds.has(id));
      if (rowIdsToDelete.length > 0) {
        await tx.pdfTableRow.updateMany({
          where: { id: { in: rowIdsToDelete }, pdfTableId: tableId },
          data: { isDeleted: true },
        });
      }

      for (const row of tableRows) {
        if (row.id && existingRowIds.has(row.id)) {
          await tx.pdfTableRow.update({
            where: { id: row.id },
            data: { rowData: row.rowData, rowIndex: row.rowIndex, isDeleted: false },
          });
        } else {
          allRowsToCreate.push({
            pdfTableId: tableId,
            rowData:    row.rowData,
            rowIndex:   row.rowIndex,
          });
        }
      }

      // Collect line items — flush after the loop
      if (hasMappingChanged) {
        const items = buildLineItemRecords({
          rows: tableRows,
          mapping: lineItemMapping,
          userId,
          tableId,
          tableTitle: incomingTable.title || null,
        });

        changedTableIds.add(tableId);
        if (items.length > 0) tableLineItems.push({ tableId, items });
      }
    }

    // ── Batch create new rows (one createMany for all tables) ─────────────────
    if (allRowsToCreate.length > 0) {
      await tx.pdfTableRow.createMany({ data: allRowsToCreate });
    }

    // ── Batch wipe + recreate line items ──────────────────────────────────────
    const changedTableIdList = [...changedTableIds];
    if (changedTableIdList.length > 0) {
      await tx.lineItem.updateMany({
        where: { pdfTableId: { in: changedTableIdList }, userId, isDeleted: false },
        data: { isDeleted: true },
      });
    }

    const allLineItems = tableLineItems.flatMap(t => t.items);
    if (allLineItems.length > 0) {
      await tx.lineItem.createMany({ data: allLineItems });
    }

    return { uploadId };
  });
};

// ─── softDeleteUploadById — OPTIMIZED ────────────────────────────────────────
// Removed the unreachable else branch (tables is always populated if upload exists).

const softDeleteUploadById = async (uploadId, userId) => {
  return prisma.$transaction(async (tx) => {
    const upload = await tx.pdfUpload.findFirst({
      where: { id: uploadId, userId, isDeleted: false },
      select: {
        id: true,
        tables: { where: { isDeleted: false }, select: { id: true } },
      },
    });
    if (!upload) throw new ApiError(404, 'Upload not found');

    const tableIds = upload.tables.map(t => t.id);

    // Always run in parallel — no else branch needed
    await Promise.all([
      tx.pdfUpload.update({
        where: { id: uploadId },
        data: { isDeleted: true },
      }),
      ...(tableIds.length > 0 ? [
        tx.pdfTable.updateMany({
          where: { id: { in: tableIds }, pdfUploadId: uploadId, userId },
          data: { isDeleted: true },
        }),
        tx.pdfTableRow.updateMany({
          where: { pdfTableId: { in: tableIds } },
          data: { isDeleted: true },
        }),
        tx.lineItem.updateMany({
          where: { pdfTableId: { in: tableIds }, userId },
          data: { isDeleted: true },
        }),
      ] : []),
    ]);

    return { uploadId, deletedTables: tableIds.length };
  });
};

module.exports = {
  TABLE_SELECT,
  ROW_SELECT,
  processUploadedPdf,
  getUserUploads,
  getUploadWithTables,
  syncUploadTables,
  softDeleteUploadById,
};