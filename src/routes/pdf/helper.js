const crypto = require('crypto');
const { Prisma } = require('@prisma/client');

const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');

const EXTRACTED_TABLE_SELECT = {
  id: true,
  userId: true,
  sourceFileName: true,
  contentHash: true,
  title: true,
  tableHash: true,
  schemaHash: true,
  columns: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

const EXTRACTED_ROW_SELECT = {
  id: true,
  extractedTableId: true,
  rowHash: true,
  rowData: true,
  rowIndex: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const sortObjectKeys = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = sortObjectKeys(value[key]);
      return result;
    }, {});
};

const stableStringify = (value) => JSON.stringify(sortObjectKeys(value));

const hashValue = (value) => crypto.createHash('sha256').update(stableStringify(value)).digest('hex');

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : value);

const normalizeColumn = (column = {}) => ({
  title: normalizeString(column.title || ''),
  key: normalizeString(column.key || ''),
  dataType: normalizeString(column.dataType || 'string'),
});

const normalizeRow = (row = {}) => sortObjectKeys(row);

const normalizeColumns = (columns = []) => {
  return columns
    .map((column) => normalizeColumn(column))
    .sort((left, right) => {
      return (
        left.key.localeCompare(right.key) ||
        left.title.localeCompare(right.title) ||
        left.dataType.localeCompare(right.dataType)
      );
    });
};

const normalizeTableForHash = (table = {}) => {
  const columns = normalizeColumns(Array.isArray(table.columns) ? table.columns : []);
  const rows = Array.isArray(table.rows)
    ? table.rows.map((row) => normalizeRow(row)).sort((left, right) => {
        return stableStringify(left).localeCompare(stableStringify(right));
      })
    : [];

  return {
    title: normalizeString(table.title || ''),
    columns,
    rows,
  };
};

const normalizeExtractionForHash = (extractedData = {}) => {
  const tables = Array.isArray(extractedData.tables)
    ? extractedData.tables.map((table) => normalizeTableForHash(table)).sort((left, right) => {
        return (
          stableStringify(left.columns).localeCompare(stableStringify(right.columns)) ||
          stableStringify(left.rows).localeCompare(stableStringify(right.rows)) ||
          left.title.localeCompare(right.title)
        );
      })
    : [];

  return { tables };
};

const getExtractionContentHash = (extractedData) => hashValue(normalizeExtractionForHash(extractedData));

const getTableSchemaHash = (table) => {
  const normalizedColumns = normalizeColumns(Array.isArray(table?.columns) ? table.columns : []);
  return hashValue({ columns: normalizedColumns });
};

const getTableHash = (table) => hashValue(normalizeTableForHash(table));

const getRowHash = (schemaHash, row) => hashValue({ schemaHash, row: normalizeRow(row) });

const getExtractedTableByHash = (client, userId, tableHash) => {
  return client.extractedTable.findFirst({
    where: { userId, tableHash, isDeleted: false },
    select: EXTRACTED_TABLE_SELECT,
  });
};

const getExtractedTableBySchemaHash = (client, userId, schemaHash) => {
  return client.extractedTable.findFirst({
    where: { userId, schemaHash, isDeleted: false },
    orderBy: [{ createdAt: 'asc' }, { updatedAt: 'asc' }],
    select: EXTRACTED_TABLE_SELECT,
  });
};

const getExtractedTableById = (client, tableId, userId = null) => {
  return client.extractedTable.findFirst({
    where: {
      id: tableId,
      isDeleted: false,
      ...(userId ? { userId } : {}),
    },
    select: {
      ...EXTRACTED_TABLE_SELECT,
      extractedRows: {
        where: { isDeleted: false },
        orderBy: [{ rowIndex: 'asc' }, { createdAt: 'asc' }],
        select: EXTRACTED_ROW_SELECT,
      },
    },
  });
};

const getExtractedTableOwner = (client, tableId) => {
  return client.extractedTable.findFirst({
    where: { id: tableId, isDeleted: false },
    select: EXTRACTED_TABLE_SELECT,
  });
};

const getOwnedExtractedTable = async (client, tableId, userId) => {
  if (!tableId || !userId) {
    return null;
  }

  return getExtractedTableById(client, tableId, userId);
};

const getExtractedTablesByUserId = (client, userId) => {
  return client.extractedTable.findMany({
    where: { userId, isDeleted: false },
    orderBy: [{ createdAt: 'asc' }, { updatedAt: 'asc' }],
    select: {
      ...EXTRACTED_TABLE_SELECT,
      extractedRows: {
        where: { isDeleted: false },
        orderBy: [{ rowIndex: 'asc' }, { createdAt: 'asc' }],
        select: EXTRACTED_ROW_SELECT,
      },
    },
  });
};

const buildTableShapeFromRecord = (tableRecord) => ({
  title: tableRecord.title || null,
  columns: tableRecord.columns,
  rows: Array.isArray(tableRecord.extractedRows)
    ? tableRecord.extractedRows.map((row) => row.rowData)
    : Array.isArray(tableRecord.rows)
      ? tableRecord.rows.map((row) => (row && typeof row === 'object' && 'rowData' in row ? row.rowData : row))
      : [],
});

const refreshExtractedTableHashes = async (client, tableId, tableRecord = null) => {
  const record = tableRecord || (await getExtractedTableById(client, tableId));

  if (!record) {
    return null;
  }

  const tableShape = buildTableShapeFromRecord(record);

  return client.extractedTable.update({
    where: { id: tableId },
    data: {
      title: record.title || null,
      columns: record.columns,
      schemaHash: getTableSchemaHash(tableShape),
      tableHash: getTableHash(tableShape),
    },
    select: EXTRACTED_TABLE_SELECT,
  });
};

const reindexExtractedRows = async (client, tableId) => {
  await client.$executeRaw`
    WITH ordered_rows AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          ORDER BY "rowIndex" ASC NULLS LAST, "createdAt" ASC, id ASC
        ) - 1 AS new_row_index
      FROM "ExtractedRow"
      WHERE "extractedTableId" = ${tableId} AND "isDeleted" = false
    )
    UPDATE "ExtractedRow" AS extracted_row
    SET "rowIndex" = ordered_rows.new_row_index
    FROM ordered_rows
    WHERE extracted_row.id = ordered_rows.id
      AND extracted_row."rowIndex" IS DISTINCT FROM ordered_rows.new_row_index
  `;
};

const createManyExtractedRows = (tx, rows) => {
  if (!rows.length) {
    return Promise.resolve({ count: 0 });
  }

  return tx.extractedRow.createMany({ data: rows, skipDuplicates: true });
};

const createExtractedTable = async (client, data) => {
  const { userId, title, columns = [], rows = [], sourceFileName = null, contentHash = null } = data;
  const normalizedColumns = normalizeColumns(columns);
  const normalizedRows = Array.isArray(rows) ? rows.map((row) => normalizeRow(row)) : [];
  const tableShape = { title: title || null, columns: normalizedColumns, rows: normalizedRows };

  const createdTable = await client.extractedTable.create({
    data: {
      userId,
      sourceFileName,
      contentHash,
      title: title || null,
      tableHash: getTableHash(tableShape),
      schemaHash: getTableSchemaHash(tableShape),
      columns: normalizedColumns,
    },
    select: EXTRACTED_TABLE_SELECT,
  });

  if (normalizedRows.length > 0) {
    await client.extractedRow.createMany({
      data: normalizedRows.map((row, rowIndex) => ({
        extractedTableId: createdTable.id,
        rowIndex,
        rowHash: getRowHash(createdTable.schemaHash, row),
        rowData: row,
      })),
      skipDuplicates: true,
    });
  }

  return getExtractedTableById(client, createdTable.id);
};

const updateExtractedTableById = async (client, tableId, data, currentTable = null) => {
  const tableRecord = currentTable || (await getExtractedTableById(client, tableId));

  if (!tableRecord) {
    return null;
  }

  const nextTitle = Object.prototype.hasOwnProperty.call(data, 'title') ? data.title : tableRecord.title;
  const nextColumns = Array.isArray(data.columns) ? normalizeColumns(data.columns) : tableRecord.columns;
  const nextRows = Array.isArray(data.rows) ? data.rows.map((row) => normalizeRow(row)) : null;

  return client.$transaction(async (tx) => {
    await tx.extractedTable.update({
      where: { id: tableId },
      data: {
        title: nextTitle || null,
        columns: nextColumns,
      },
      select: EXTRACTED_TABLE_SELECT,
    });

    if (Array.isArray(data.rows)) {
      await tx.extractedRow.updateMany({
        where: { extractedTableId: tableId, isDeleted: false },
        data: { isDeleted: true },
      });

      if (nextRows.length > 0) {
        const schemaHash = getTableSchemaHash({ columns: nextColumns });

        await tx.extractedRow.createMany({
          data: nextRows.map((row, rowIndex) => ({
            extractedTableId: tableId,
            rowIndex,
            rowHash: getRowHash(schemaHash, row),
            rowData: row,
          })),
          skipDuplicates: true,
        });
      }
    }

    await refreshExtractedTableHashes(
      tx,
      tableId,
      {
        title: nextTitle || null,
        columns: nextColumns,
        rows: nextRows || tableRecord.extractedRows.map((row) => row.rowData),
      },
    );

    return getExtractedTableById(tx, tableId);
  });
};

const deleteExtractedTableById = async (client, tableId, currentTable = null) => {
  const tableRecord = currentTable || (await getExtractedTableById(client, tableId));

  if (!tableRecord) {
    return null;
  }

  return client.$transaction(async (tx) => {
    const deletedTable = await tx.extractedTable.update({
      where: { id: tableId },
      data: { isDeleted: true },
      select: EXTRACTED_TABLE_SELECT,
    });

    await tx.extractedRow.updateMany({
      where: { extractedTableId: tableId },
      data: { isDeleted: true },
    });

    return deletedTable;
  });
};

const createExtractedRowByTableId = async (client, tableId, rowData, currentTable = null) => {
  const tableRecord = currentTable || (await getExtractedTableById(client, tableId));

  if (!tableRecord) {
    return null;
  }

  const schemaHash = getTableSchemaHash({ columns: tableRecord.columns });
  const normalizedRow = normalizeRow(rowData);
  const rowHash = getRowHash(schemaHash, normalizedRow);

  return client.$transaction(async (tx) => {
    const existingRow = tableRecord.extractedRows.find((row) => row.rowHash === rowHash) || null;

    if (existingRow) {
      return existingRow;
    }

    const createdRow = await tx.extractedRow.create({
      data: {
        extractedTableId: tableId,
        rowIndex: tableRecord.extractedRows.length,
        rowHash,
        rowData: normalizedRow,
      },
      select: EXTRACTED_ROW_SELECT,
    });

    const updatedTable = await getExtractedTableById(tx, tableId);
    await refreshExtractedTableHashes(tx, tableId, updatedTable);

    return createdRow;
  });
};

const updateExtractedRowById = async (client, tableId, rowId, rowData, currentTable = null) => {
  const tableRecord = currentTable || (await getExtractedTableById(client, tableId));

  if (!tableRecord) {
    return null;
  }

  const currentRow = tableRecord.extractedRows.find((row) => row.id === rowId);

  if (!currentRow) {
    return null;
  }

  const schemaHash = getTableSchemaHash({ columns: tableRecord.columns });
  const normalizedRow = normalizeRow(rowData);
  const rowHash = getRowHash(schemaHash, normalizedRow);

  return client.$transaction(async (tx) => {
    const existingRow = tableRecord.extractedRows.find((row) => row.id !== rowId && row.rowHash === rowHash) || null;

    if (existingRow) {
      return existingRow;
    }

    const updatedRow = await tx.extractedRow.update({
      where: { id: rowId },
      data: {
        rowHash,
        rowData: normalizedRow,
      },
      select: EXTRACTED_ROW_SELECT,
    });

    const updatedTable = await getExtractedTableById(tx, tableId);
    await refreshExtractedTableHashes(tx, tableId, updatedTable);

    return updatedRow;
  });
};

const bulkUpdateExtractedRows = async (client, tableId, updates = [], currentTable = null) => {
  const tableRecord = currentTable || (await getExtractedTableById(client, tableId));

  if (!tableRecord) {
    return null;
  }

  const safeUpdates = Array.isArray(updates) ? updates : [];

  const normalizedUpdates = safeUpdates.filter(
    (update) => update && typeof update.rowId === 'string' && update.rowId.trim() !== '',
  );

  if (normalizedUpdates.length === 0) {
    const table = await getExtractedTableById(client, tableId);

    return {
      success: true,
      updatedCount: 0,
      table,
    };
  }

  const updateByRowId = new Map();

  for (const update of normalizedUpdates) {
    if (updateByRowId.has(update.rowId)) {
      throw new ApiError(400, `Duplicate update for row ${update.rowId}`);
    }

    updateByRowId.set(update.rowId, update.rowData);
  }

  const schemaHash = getTableSchemaHash({ columns: tableRecord.columns });
  const rowsById = new Map(tableRecord.extractedRows.map((row) => [row.id, row]));

  for (const rowId of updateByRowId.keys()) {
    if (!rowsById.has(rowId)) {
      throw new ApiError(404, `Row ${rowId} not found`);
    }
  }

  const nextRows = tableRecord.extractedRows.map((row) => {
    const rowUpdate = updateByRowId.get(row.id);
    const nextRowData = rowUpdate ? { ...row.rowData, ...rowUpdate } : row.rowData;

    return {
      ...row,
      nextRowData,
      nextRowHash: getRowHash(schemaHash, nextRowData),
    };
  });

  const rowIdByHash = new Map();

  for (const row of nextRows) {
    const duplicateRowId = rowIdByHash.get(row.nextRowHash);

    if (duplicateRowId && duplicateRowId !== row.id) {
      throw new ApiError(409, 'Bulk update would create duplicate rows in this table');
    }

    rowIdByHash.set(row.nextRowHash, row.id);
  }

  const changedRows = nextRows.filter((row) => {
    return updateByRowId.has(row.id) && stableStringify(row.rowData) !== stableStringify(row.nextRowData);
  });

  return client.$transaction(async (tx) => {
    if (changedRows.length > 0) {
      for (const row of changedRows) {
        await tx.extractedRow.update({
          where: { id: row.id },
          data: {
            rowHash: row.nextRowHash,
            rowData: row.nextRowData,
          },
          select: EXTRACTED_ROW_SELECT,
        });
      }
    }

    await refreshExtractedTableHashes(tx, tableId, {
      title: tableRecord.title || null,
      columns: tableRecord.columns,
      rows: nextRows.map((row) => (updateByRowId.has(row.id) ? row.nextRowData : row.rowData)),
    });

    const table = await getExtractedTableById(tx, tableId);

    return {
      success: true,
      updatedCount: changedRows.length,
      table,
    };
  });
};

const deleteExtractedRowById = async (client, tableId, rowId, currentTable = null) => {
  const tableRecord = currentTable || (await getExtractedTableById(client, tableId));

  if (!tableRecord) {
    return null;
  }

  return client.$transaction(async (tx) => {
    const targetRow = tableRecord.extractedRows.find((row) => row.id === rowId);

    if (!targetRow) {
      return null;
    }

    const deletedRow = await tx.extractedRow.update({
      where: { id: rowId },
      data: { isDeleted: true },
      select: EXTRACTED_ROW_SELECT,
    });

    await reindexExtractedRows(tx, tableId);
    await refreshExtractedTableHashes(tx, tableId, {
      title: tableRecord.title || null,
      columns: tableRecord.columns,
      rows: tableRecord.extractedRows.filter((row) => row.id !== rowId).map((row) => row.rowData),
    });

    return deletedRow;
  });
};

const deleteExtractedRowsByIds = async (client, tableId, rowIds = [], currentTable = null) => {
  const tableRecord = currentTable || (await getExtractedTableById(client, tableId));

  if (!tableRecord) {
    return null;
  }

  const safeRowIds = Array.isArray(rowIds) ? rowIds : [];
  const uniqueRowIds = [...new Set(safeRowIds.filter((rowId) => typeof rowId === 'string' && rowId.trim() !== ''))];

  if (uniqueRowIds.length === 0) {
    return {
      count: 0,
      table: await getExtractedTableById(client, tableId),
    };
  }

  return client.$transaction(async (tx) => {
    const targetRows = tableRecord.extractedRows.filter((row) => uniqueRowIds.includes(row.id));

    if (targetRows.length === 0) {
      return {
        count: 0,
        table: await getExtractedTableById(tx, tableId),
      };
    }

    const deleted = await tx.extractedRow.updateMany({
      where: {
        id: { in: uniqueRowIds },
        extractedTableId: tableId,
        isDeleted: false,
      },
      data: { isDeleted: true },
    });

    await reindexExtractedRows(tx, tableId);
    await refreshExtractedTableHashes(tx, tableId, {
      title: tableRecord.title || null,
      columns: tableRecord.columns,
      rows: tableRecord.extractedRows.filter((row) => !uniqueRowIds.includes(row.id)).map((row) => row.rowData),
    });

    return {
      count: deleted.count,
      table: await getExtractedTableById(tx, tableId),
    };
  });
};

const clearExtractedRowsByTableId = async (client, tableId, currentTable = null) => {
  const tableRecord = currentTable || (await getExtractedTableById(client, tableId));

  if (!tableRecord) {
    return null;
  }

  return client.$transaction(async (tx) => {
    const deleted = await tx.extractedRow.updateMany({
      where: { extractedTableId: tableId, isDeleted: false },
      data: { isDeleted: true },
    });

    const updatedTable = await getExtractedTableById(tx, tableId);
    await refreshExtractedTableHashes(tx, tableId, updatedTable);

    return deleted;
  });
};

const replaceExtractedTableBulk = async (client, tableId, data, currentTable = null) => {
  const tableRecord = currentTable || (await getExtractedTableById(client, tableId));

  if (!tableRecord) {
    return null;
  }

  const nextTitle = Object.prototype.hasOwnProperty.call(data, 'title') ? data.title : tableRecord.title;
  const nextColumns = Array.isArray(data.columns) ? normalizeColumns(data.columns) : tableRecord.columns;
  const nextRows = Array.isArray(data.rows) ? data.rows.map((row) => normalizeRow(row)) : [];

  return client.$transaction(async (tx) => {
    await tx.extractedTable.update({
      where: { id: tableId },
      data: {
        title: nextTitle || null,
        columns: nextColumns,
      },
      select: EXTRACTED_TABLE_SELECT,
    });

    await tx.extractedRow.updateMany({
      where: { extractedTableId: tableId, isDeleted: false },
      data: { isDeleted: true },
    });

    if (nextRows.length > 0) {
      const schemaHash = getTableSchemaHash({ columns: nextColumns });

      await tx.extractedRow.createMany({
        data: nextRows.map((row, rowIndex) => ({
          extractedTableId: tableId,
          rowIndex,
          rowHash: getRowHash(schemaHash, row),
          rowData: row,
        })),
        skipDuplicates: true,
      });
    }

    await refreshExtractedTableHashes(tx, tableId, {
      title: nextTitle || null,
      columns: nextColumns,
      rows: nextRows,
    });

    return getExtractedTableById(tx, tableId);
  });
};

const processUploadedPdf = async ({ userId, fileName, filePath, extractedText, extractedData }) => {
  return prisma.$transaction(async (tx) => {
    const contentHash = getExtractionContentHash(extractedData);
    const tables = Array.isArray(extractedData?.tables) ? extractedData.tables : [];
    let insertedTables = 0;
    let duplicateTables = 0;
    let insertedRows = 0;
    let duplicateRows = 0;

    for (const table of tables) {
      const normalizedColumns = normalizeColumns(Array.isArray(table.columns) ? table.columns : []);
      const normalizedRows = Array.isArray(table.rows) ? table.rows.map((row) => normalizeRow(row)) : [];
      const schemaHash = getTableSchemaHash({ columns: normalizedColumns });
      const tableShape = {
        title: table.title || null,
        columns: normalizedColumns,
        rows: normalizedRows,
      };

      const existingTable = await getExtractedTableBySchemaHash(tx, userId, schemaHash);
      let targetTable = existingTable;

      if (!targetTable) {
        targetTable = await tx.extractedTable.create({
          data: {
            userId,
            sourceFileName: fileName,
            contentHash,
            title: table.title || null,
            tableHash: getTableHash(tableShape),
            schemaHash,
            columns: normalizedColumns,
          },
          select: EXTRACTED_TABLE_SELECT,
        });

        insertedTables += 1;
      } else {
        duplicateTables += 1;
      }

      const rowCount = await tx.extractedRow.count({
        where: { extractedTableId: targetTable.id, isDeleted: false },
      });

      const rows = normalizedRows.map((row, rowIndex) => ({
        extractedTableId: targetTable.id,
        rowHash: getRowHash(schemaHash, row),
        rowData: row,
        rowIndex: rowCount + rowIndex,
      }));

      const createdRows = await createManyExtractedRows(tx, rows);
      insertedRows += createdRows.count;
      duplicateRows += Math.max(rows.length - createdRows.count, 0);
    }

    return {
      tableCount: tables.length,
      insertedTables,
      duplicateTables,
      insertedRows,
      duplicateRows,
    };
  });
};

const getMergedExtractedDataByUser = async (userId) => {
  const tables = await prisma.extractedTable.findMany({
    where: { userId, isDeleted: false },
    orderBy: [{ createdAt: 'asc' }, { updatedAt: 'asc' }],
    select: {
      id: true,
      title: true,
      sourceFileName: true,
      schemaHash: true,
      columns: true,
      extractedRows: {
        where: { isDeleted: false },
        orderBy: [{ rowIndex: 'asc' }, { createdAt: 'asc' }],
        select: EXTRACTED_ROW_SELECT,
      },
    },
  });

  const mergedTables = new Map();

  for (const table of tables) {
    let mergedTable = mergedTables.get(table.schemaHash);

    if (!mergedTable) {
      mergedTable = {
        title: table.title,
        schemaHash: table.schemaHash,
        columns: table.columns,
        rows: [],
        sourceFileNamesSet: new Set(),
        sourceTableIdsSet: new Set(),
      };

      mergedTables.set(table.schemaHash, mergedTable);
    }

    mergedTable.sourceTableIdsSet.add(table.id);

    if (table.sourceFileName) {
      mergedTable.sourceFileNamesSet.add(table.sourceFileName);
    }

    if (!mergedTable.title && table.title) {
      mergedTable.title = table.title;
    }

    mergedTable.rows.push(...table.extractedRows.map((row) => row.rowData));
  }

  return {
    tables: Array.from(mergedTables.values()).map(({ sourceFileNamesSet, sourceTableIdsSet, ...table }) => ({
      ...table,
      sourceFileNames: Array.from(sourceFileNamesSet),
      sourceTableIds: Array.from(sourceTableIdsSet),
    })),
  };
};

const createExtractedTableForUser = async (data) => createExtractedTable(prisma, data);
const getExtractedTableByIdForUser = async (tableId, userId) => getExtractedTableById(prisma, tableId, userId);
const getExtractedTableOwnerForUser = async (tableId) => getExtractedTableOwner(prisma, tableId);
const getOwnedExtractedTableForUser = async (tableId, userId) => getOwnedExtractedTable(prisma, tableId, userId);
const getExtractedTablesByUserIdForUser = async (userId) => getExtractedTablesByUserId(prisma, userId);
const updateExtractedTableByIdForUser = async (tableId, userId, data, currentTable) => updateExtractedTableById(prisma, tableId, data, currentTable);
const replaceExtractedTableBulkForUser = async (tableId, userId, data, currentTable) => replaceExtractedTableBulk(prisma, tableId, data, currentTable);
const deleteExtractedTableByIdForUser = async (tableId, userId, currentTable) => deleteExtractedTableById(prisma, tableId, currentTable);
const createExtractedRowByTableIdForUser = async (tableId, userId, rowData, currentTable) => createExtractedRowByTableId(prisma, tableId, rowData, currentTable);
const updateExtractedRowByIdForUser = async (tableId, userId, rowId, rowData, currentTable) => updateExtractedRowById(prisma, tableId, rowId, rowData, currentTable);
const bulkUpdateExtractedRowsForUser = async (tableId, userId, updates, currentTable) => bulkUpdateExtractedRows(prisma, tableId, updates, currentTable);
const deleteExtractedRowByIdForUser = async (tableId, userId, rowId, currentTable) => deleteExtractedRowById(prisma, tableId, rowId, currentTable);
const deleteExtractedRowsByIdsForUser = async (tableId, userId, rowIds, currentTable) => deleteExtractedRowsByIds(prisma, tableId, rowIds, currentTable);
const clearExtractedRowsByTableIdForUser = async (tableId, userId, currentTable) => clearExtractedRowsByTableId(prisma, tableId, currentTable);

module.exports = {
  EXTRACTED_TABLE_SELECT,
  EXTRACTED_ROW_SELECT,
  getExtractedTableById,
  getExtractedTablesByUserId,
  getExtractionContentHash,
  getTableSchemaHash,
  getTableHash,
  getRowHash,
  createManyExtractedRows,
  processUploadedPdf,
  getMergedExtractedDataByUser,
  createExtractedTable,
  createExtractedTableForUser,
  updateExtractedTableById,
  updateExtractedTableByIdForUser,
  deleteExtractedTableById,
  deleteExtractedTableByIdForUser,
  createExtractedRowByTableId,
  createExtractedRowByTableIdForUser,
  updateExtractedRowById,
  updateExtractedRowByIdForUser,
  bulkUpdateExtractedRows,
  bulkUpdateExtractedRowsForUser,
  deleteExtractedRowById,
  deleteExtractedRowByIdForUser,
  deleteExtractedRowsByIds,
  deleteExtractedRowsByIdsForUser,
  clearExtractedRowsByTableId,
  clearExtractedRowsByTableIdForUser,
  replaceExtractedTableBulk,
  replaceExtractedTableBulkForUser,
  refreshExtractedTableHashes,
  getExtractedTableByIdForUser,
  getOwnedExtractedTableForUser,
  getExtractedTableOwnerForUser,
  getExtractedTablesByUserIdForUser,
  getExtractedTableBySchemaHash,
};