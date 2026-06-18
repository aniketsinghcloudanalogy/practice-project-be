const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const crypto = require('crypto');

const TABLE_SELECT = {
  id: true, pdfUploadId: true, userId: true, title: true,
  columns: true, lineItemColumnMapping: true,
  isDeleted: true, createdAt: true, updatedAt: true,
};

const ROW_SELECT = {
  id: true, pdfTableId: true, rowData: true, rowIndex: true,
  isDeleted: true, createdAt: true, updatedAt: true,
};


// ─── processUploadedPdf (optimal) ────────────────────────

const processUploadedPdf = async ({ userId, fileName, extractedData }) => {
  const tables = Array.isArray(extractedData?.tables) ? extractedData.tables : [];
  if (tables.length === 0) throw new ApiError(422, 'No tables found in PDF');//validate table exist

  return prisma.$transaction(async (tx) => {
    const pdfUpload = await tx.pdfUpload.create({  // create upload record
      data: { userId, fileName },
      select: { id: true },
    });

    const results = await Promise.all(
      tables.map(async (table) => {  //loop through tables, create table record + rows for each
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

// ─── getUserUploads  ───────────────────────────────────────────────

const getUserUploads = async (userId) =>
  prisma.pdfUpload.findMany({
    where: { userId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, fileName: true, createdAt: true, updatedAt: true,
      _count: { select: { tables: { where: { isDeleted: false } } } },
    },
  });

// ─── getUploadWithTables  ─────────────────────────────────────────

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

const hashMapping = (mapping) =>  // simple hash function to compare mappings without deep equality checks
  crypto
    .createHash('md5')
    .update(JSON.stringify(mapping ?? {}))
    .digest('hex');

// ─── buildLineItemRecords — OPTIMIZED ────────────────────────────────────────

const buildLineItemRecords = ({ rows, mapping, userId, tableId, tableTitle }) => { // mapping is { sourceColumn: targetField }
  const mappingEntries = Object.entries(mapping);  // if mapping is empty, no line items to create — skip the loop entirely
  if (mappingEntries.length === 0) return [];  

  return rows.map((row, rowIndex) => {  // for each row, build a line item based on the mapping
    const lineItem = {                     // base fields for every line item
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
//  batch all reads up-front, then process tables with minimal queries

const syncUploadTables = async ({ uploadId, userId, tables }) => {

  return prisma.$transaction(async (tx) => {

    // ── Batch read 1: all existing tables ────────────────────────────────────
    const existingTables = await tx.pdfTable.findMany({                           // single query to get all tables for the upload
      where: { pdfUploadId: uploadId, userId, isDeleted: false },
      select: { id: true, lineItemColumnMapping: true },
    });


    const existingTableIds = new Set(existingTables.map((t) => t.id));          // also create a Set for quick existence checks during processing
    const existingTableMappingsById = new Map(
      existingTables.map((t) => [t.id, t.lineItemColumnMapping ?? {}])
    );
    const incomingTableIds = new Set(
      tables.filter(t => typeof t?.id === 'string' && t.id.length > 0).map(t => t.id)     // also track incoming table IDs to identify deletions
    );

    const tableIdsToDelete = [...existingTableIds].filter(id => !incomingTableIds.has(id));  // tables that exist in DB but not in incoming data should be deleted
    const activeExistingTableIds = [...existingTableIds].filter(id => incomingTableIds.has(id));    // tables that exist in both DB and incoming data are "active" — we need to read their rows for further processing

   
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