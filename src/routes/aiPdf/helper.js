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


const hashMapping = (mapping) =>  // simple hash function to compare mappings without deep equality checks
  crypto
    .createHash('md5')
    .update(JSON.stringify(mapping ?? {}))
    .digest('hex');


const buildLineItemRecords = ({ rows, mapping, userId, tableId, tableTitle }) => { // mapping is { sourceColumn: targetField }
  const mappingEntries = Object.entries(mapping);  // if mapping is empty, no line items to create — skip the loop entirely
  if (mappingEntries.length === 0) return [];

  return rows.map((row, rowIndex) => {  // for each row, build a line item based on the mapping
    const lineItem = {                     // base fields for every line item
      userId,
      pdfTableId: tableId,
      sourceTableTitle: tableTitle || null,
      rowSourceId: row.id || null,
      rowIndex: row.rowIndex ?? rowIndex,
    };
    for (const [sourceColumn, targetField] of mappingEntries) {
      const value = row.rowData?.[sourceColumn];
      lineItem[targetField] = value === null || value === undefined ? null : String(value);
    }
    return lineItem;
  });
};


// ─── DB operations ────────────────────────────────────────────────────────────


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
        tx.profitabilty_line_items.updateMany({
          where: { pdfTableId: { in: tableIdsToDelete }, userId, isDeleted: false },
          data: { isDeleted: true },
        }),
      ]);
    }


    const allRowsToCreate = [];
    const tableLineItems = [];
    const changedTableIds = new Set();
    const existingTableOps = [];
    const newTableOps = [];


    for (const incomingTable of tables) {
      const tableColumns = Array.isArray(incomingTable.columns) ? incomingTable.columns : [];
      const tableRows = Array.isArray(incomingTable.rows) ? incomingTable.rows : [];
      const lineItemMapping = incomingTable.lineItemMapping ?? {};

      const tableId = incomingTable.id;
      const isExistingTable = Boolean(tableId && existingTableIds.has(tableId));
      const existingMapping = isExistingTable ? existingTableMappingsById.get(tableId) ?? {} : null;
      const hasMappingChanged = !isExistingTable || hashMapping(existingMapping) !== hashMapping(lineItemMapping);

      if (isExistingTable) {
        existingTableOps.push({
          updatePromise: tx.pdfTable.update({
            where: { id: tableId },
            data: {
              title: incomingTable.title || null,
              columns: tableColumns,
              lineItemColumnMapping: lineItemMapping,
              isDeleted: false,
            },
          }),
          tableId, incomingTable, tableColumns, tableRows, lineItemMapping, hasMappingChanged,
        });
      } else {
        newTableOps.push({
          createData: {
            pdfUploadId: uploadId, userId,
            title: incomingTable.title || null,
            columns: tableColumns,
            lineItemColumnMapping: lineItemMapping,
          },
          incomingTable, tableRows, lineItemMapping, hasMappingChanged,
        });
      }
    }

    // Pass 2 — batch fire
    await Promise.all(existingTableOps.map(op => op.updatePromise));

    const createdTables = await Promise.all(
      newTableOps.map(op =>
        tx.pdfTable.create({ data: op.createData, select: { id: true } })
      )
    );

    const resolvedNewTableOps = newTableOps.map((op, i) => ({
      ...op,
      tableId: createdTables[i].id,
    }));

    const allTableOps = [
      ...existingTableOps,
      ...resolvedNewTableOps,
    ];

    // Pass 3 — row operations (parallel per table)
    const rowDeletePromises = [];
    const rowUpdatePromises = [];

    for (const op of allTableOps) {
      const { tableId, tableRows, lineItemMapping, hasMappingChanged, incomingTable } = op;

      const existingRowIds = new Set(existingRowsByTableId.get(tableId) ?? []);
      const incomingRowIds = new Set(
        tableRows.filter(r => typeof r.id === 'string' && r.id.length > 0).map(r => r.id)
      );

      const rowIdsToDelete = [...existingRowIds].filter(id => !incomingRowIds.has(id));
      if (rowIdsToDelete.length > 0) {
        rowDeletePromises.push(
          tx.pdfTableRow.updateMany({
            where: { id: { in: rowIdsToDelete }, pdfTableId: tableId },
            data: { isDeleted: true },
          })
        );
      }

      for (const row of tableRows) {
        if (row.id && existingRowIds.has(row.id)) {
          rowUpdatePromises.push(
            tx.pdfTableRow.update({
              where: { id: row.id },
              data: { rowData: row.rowData, rowIndex: row.rowIndex, isDeleted: false },
            })
          );
        } else {
          allRowsToCreate.push({
            pdfTableId: tableId,
            rowData: row.rowData,
            rowIndex: row.rowIndex,
          });
        }
      }

      // Line item collection
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

    await Promise.all([...rowDeletePromises, ...rowUpdatePromises]);

    // ── Batch create new rows (one createMany for all tables) ─────────────────
    if (allRowsToCreate.length > 0) {
      await tx.pdfTableRow.createMany({ data: allRowsToCreate });
    }

    // ── Batch wipe + recreate line items ──────────────────────────────────────
    const changedTableIdList = [...changedTableIds];

    if (changedTableIdList.length > 0) {
      // ── Read existing LineItem quote context BEFORE wiping ──────────────────
      // LineItems created by processSingleFile carry quote_id + quote_file_id.
      // We must re-attach those after recreating, otherwise verifyQuoteFileById
      // can't find them by quote_file_id.
      const existingQuoteContext = await tx.lineItem.findMany({
        where: {
          pdfTableId: { in: changedTableIdList },
          userId,
          isDeleted: false,
          quote_id: { not: null },
        },
        select: {
          pdfTableId: true,
          quote_id: true,
          quote_file_id: true,
        },
        distinct: ['pdfTableId', 'quote_id', 'quote_file_id'],
      });

      // Build map: pdfTableId -> [{ quote_id, quote_file_id }]
      const quoteContextByTableId = existingQuoteContext.reduce((acc, row) => {
        (acc[row.pdfTableId] ??= []).push({
          quote_id: row.quote_id,
          quote_file_id: row.quote_file_id,
        });
        return acc;
      }, {});

      // Wipe old line items and profitability items for changed tables
      await Promise.all([
        tx.lineItem.updateMany({
          where: { pdfTableId: { in: changedTableIdList }, userId, isDeleted: false },
          data: { isDeleted: true },
        }),
        tx.profitabilty_line_items.updateMany({
          where: {
            pdfTableId: { in: changedTableIdList },
            userId,
            isDeleted: false,
            is_Verifed: false,
          },
          data: { isDeleted: true },
        }),
      ]);

      // Recreate LineItems — one set per quote context per table
      const allLineItemsToCreate = [];

      for (const { tableId, items } of tableLineItems) {
        const quoteContexts = quoteContextByTableId[tableId] ?? [];

        if (quoteContexts.length === 0) {
          // No quote context — plain aiPdf LineItems
          allLineItemsToCreate.push(...items);
        } else {
          // Re-attach each quote context
          for (const { quote_id, quote_file_id } of quoteContexts) {
            for (const item of items) {
              allLineItemsToCreate.push({
                ...item,
                quote_id,
                quote_file_id,
              });
            }
          }
        }
      }

      if (allLineItemsToCreate.length > 0) {
        await tx.lineItem.createMany({ data: allLineItemsToCreate });
      }
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
        tx.profitabilty_line_items.updateMany({
          where: { pdfTableId: { in: tableIds }, userId, isDeleted: false },
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
