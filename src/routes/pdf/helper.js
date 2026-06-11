const crypto = require('crypto');

const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');

const PDF_DOCUMENT_SELECT = {
  id: true,
  userId: true,
  fileName: true,
  filePath: true,
  contentHash: true,
  extractedText: true,
  extractedData: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

const EXTRACTED_TABLE_SELECT = {
  id: true,
  userId: true,
  pdfDocumentId: true,
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
  userId: true,
  extractedTableId: true,
  rowHash: true,
  rowData: true,
  rowIndex: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

const isPlainObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

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

const stableStringify = (value) => {
  return JSON.stringify(sortObjectKeys(value));
};

const hashValue = (value) => {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
};

const normalizeString = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

const normalizeColumn = (column = {}) => {
  return {
    title: normalizeString(column.title || ''),
    key: normalizeString(column.key || ''),
    dataType: normalizeString(column.dataType || 'string'),
  };
};

const normalizeRow = (row = {}) => {
  return sortObjectKeys(row);
};

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

const getColumnFieldNames = (columns = []) => {
  return normalizeColumns(Array.isArray(columns) ? columns : []).reduce((fieldNames, column) => {
    if (column.key) {
      fieldNames.add(column.key);
    }

    if (column.title) {
      fieldNames.add(column.title);
    }

    return fieldNames;
  }, new Set());
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

const getExtractionContentHash = (extractedData) => {
  return hashValue(normalizeExtractionForHash(extractedData));
};

const getTableSchemaHash = (table) => {
  const normalizedColumns = normalizeColumns(Array.isArray(table?.columns) ? table.columns : []);
  return hashValue({ columns: normalizedColumns });
};

const getTableHash = (table) => {
  return hashValue(normalizeTableForHash(table));
};

const getRowHash = (schemaHash, row) => {
  return hashValue({ schemaHash, row: normalizeRow(row) });
};

const createPdfDocument = (client, data) => {
  return client.pdfDocument.create({
    data,
    select: PDF_DOCUMENT_SELECT,
  });
};

const getUserPdfDocuments = (userId) => {
  return prisma.pdfDocument.findMany({
    where: { userId, isDeleted: false },
    orderBy: {
      createdAt: 'desc',
    },
    select: PDF_DOCUMENT_SELECT,
  });
};

const getPdfDocumentById = (id) => {
  return prisma.pdfDocument.findFirst({
    where: { id, isDeleted: false },
    select: PDF_DOCUMENT_SELECT,
  });
};

const getPdfDocumentByContentHash = (userId, contentHash) => {
  return prisma.pdfDocument.findFirst({
    where: {
      userId,
      contentHash,
      isDeleted: false,
    },
    select: PDF_DOCUMENT_SELECT,
  });
};

const updatePdfDocument = (id, data) => {
  const allowedData = {};

  if (Object.prototype.hasOwnProperty.call(data, 'extractedData')) {
    allowedData.extractedData = data.extractedData;
  }

  return prisma.pdfDocument.update({
    where: { id },
    data: allowedData,
    select: PDF_DOCUMENT_SELECT,
  });
};

const deletePdfDocument = (id) => {
  return prisma.pdfDocument.update({
    where: { id },
    data: { isDeleted: true },
    select: PDF_DOCUMENT_SELECT,
  });
};

const getExtractedTableByHash = (client, userId, tableHash) => {
  return client.extractedTable.findFirst({
    where: {
      userId,
      tableHash,
      isDeleted: false,
    },
    select: EXTRACTED_TABLE_SELECT,
  });
};

const getExtractedTableBySchemaHash = (client, userId, schemaHash) => {
  return client.extractedTable.findFirst({
    where: {
      userId,
      schemaHash,
      isDeleted: false,
    },
    orderBy: [
      { createdAt: 'asc' },
      { updatedAt: 'asc' },
    ],
    select: EXTRACTED_TABLE_SELECT,
  });
};

const getExtractedTableById = (client, tableId) => {
  return client.extractedTable.findFirst({
    where: {
      id: tableId,
      isDeleted: false,
      pdfDocument: {
        is: {
          isDeleted: false,
        },
      },
    },
    select: {
      ...EXTRACTED_TABLE_SELECT,
      pdfDocument: {
        select: {
          id: true,
          userId: true,
          isDeleted: true,
        },
      },
      extractedRows: {
        where: { isDeleted: false },
        orderBy: [
          { rowIndex: 'asc' },
          { createdAt: 'asc' },
        ],
        select: EXTRACTED_ROW_SELECT,
      },
    },
  });
};

const getExtractedTablesByPdfDocumentId = (client, pdfDocumentId) => {
  return client.extractedTable.findMany({
    where: {
      pdfDocumentId,
      isDeleted: false,
      pdfDocument: {
        is: {
          isDeleted: false,
        },
      },
    },
    orderBy: [
      { createdAt: 'asc' },
      { updatedAt: 'asc' },
    ],
    select: {
      ...EXTRACTED_TABLE_SELECT,
      extractedRows: {
        where: { isDeleted: false },
        orderBy: [
          { rowIndex: 'asc' },
          { createdAt: 'asc' },
        ],
        select: EXTRACTED_ROW_SELECT,
      },
    },
  });
};

const buildTableShapeFromRecord = (tableRecord) => ({
  title: tableRecord.title || null,
  columns: tableRecord.columns,
  rows: tableRecord.extractedRows.map((row) => row.rowData),
});

const rebuildExtractedDataForPdfDocument = async (client, pdfDocumentId) => {
  const tables = await getExtractedTablesByPdfDocumentId(client, pdfDocumentId);

  return {
    tables: tables.map((table) => ({
      title: table.title || null,
      columns: table.columns,
      rows: table.extractedRows.map((row) => row.rowData),
    })),
  };
};

const syncPdfDocumentExtractedData = async (client, pdfDocumentId) => {
  const extractedData = await rebuildExtractedDataForPdfDocument(client, pdfDocumentId);

  return client.pdfDocument.update({
    where: { id: pdfDocumentId },
    data: {
      extractedData,
    },
    select: PDF_DOCUMENT_SELECT,
  });
};

const refreshExtractedTableHashes = async (client, tableId) => {
  const tableRecord = await getExtractedTableById(client, tableId);

  if (!tableRecord) {
    return null;
  }

  const tableShape = buildTableShapeFromRecord(tableRecord);

  return client.extractedTable.update({
    where: { id: tableId },
    data: {
      title: tableRecord.title || null,
      columns: tableRecord.columns,
      schemaHash: getTableSchemaHash(tableShape),
      tableHash: getTableHash(tableShape),
    },
    select: EXTRACTED_TABLE_SELECT,
  });
};

const getPdfTablesByPdfDocumentId = async (client, pdfDocumentId) => {
  const tables = await getExtractedTablesByPdfDocumentId(client, pdfDocumentId);

  return tables.map((table) => ({
    id: table.id,
    pdfDocumentId: table.pdfDocumentId,
    title: table.title,
    schemaHash: table.schemaHash,
    tableHash: table.tableHash,
    isDeleted: table.isDeleted,
    columns: table.columns,
    rows: table.extractedRows.map((row) => ({
      id: row.id,
      rowIndex: row.rowIndex,
      rowHash: row.rowHash,
      isDeleted: row.isDeleted,
      ...row.rowData,
    })),
  }));
};

const createExtractedTableForPdfDocument = async (client, data) => {
  const { userId, pdfDocumentId, title, columns = [], rows = [] } = data;
  const normalizedColumns = normalizeColumns(columns);
  const tableShape = {
    title: title || null,
    columns: normalizedColumns,
    rows,
  };

  const createdTable = await client.extractedTable.create({
    data: {
      userId,
      pdfDocumentId,
      title: title || null,
      tableHash: getTableHash(tableShape),
      schemaHash: getTableSchemaHash(tableShape),
      columns: normalizedColumns,
    },
    select: EXTRACTED_TABLE_SELECT,
  });

  if (rows.length > 0) {
    await client.extractedRow.createMany({
      data: rows.map((row, rowIndex) => ({
        userId,
        extractedTableId: createdTable.id,
        rowIndex,
        rowHash: getRowHash(createdTable.schemaHash, row),
        rowData: row,
      })),
      skipDuplicates: true,
    });
  }

  await refreshExtractedTableHashes(client, createdTable.id);
  await syncPdfDocumentExtractedData(client, pdfDocumentId);

  return getExtractedTableById(client, createdTable.id);
};

const updateExtractedTableById = async (client, tableId, data) => {
  const currentTable = await getExtractedTableById(client, tableId);

  if (!currentTable) {
    return null;
  }

  const nextTitle = Object.prototype.hasOwnProperty.call(data, 'title') ? data.title : currentTable.title;
  const nextColumns = Array.isArray(data.columns) ? normalizeColumns(data.columns) : currentTable.columns;
  const nextRows = Array.isArray(data.rows)
    ? data.rows
    : currentTable.extractedRows.map((row) => row.rowData);

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
            userId: currentTable.userId,
            extractedTableId: tableId,
            rowIndex,
            rowHash: getRowHash(schemaHash, row),
            rowData: row,
          })),
          skipDuplicates: true,
        });
      }
    }

    await refreshExtractedTableHashes(tx, tableId);
    await syncPdfDocumentExtractedData(tx, currentTable.pdfDocumentId);

    return getExtractedTableById(tx, tableId);
  });
};

const deleteExtractedTableById = async (client, tableId) => {
  const currentTable = await getExtractedTableById(client, tableId);

  if (!currentTable) {
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

    await syncPdfDocumentExtractedData(tx, currentTable.pdfDocumentId);

    return deletedTable;
  });
};

const createExtractedRowByTableId = async (client, tableId, rowData) => {
  const currentTable = await getExtractedTableById(client, tableId);

  if (!currentTable) {
    return null;
  }

  const schemaHash = getTableSchemaHash({ columns: currentTable.columns });
  const rowHash = getRowHash(schemaHash, rowData);

  return client.$transaction(async (tx) => {
    const existingRow = await tx.extractedRow.findFirst({
      where: {
        extractedTableId: tableId,
        rowHash,
        isDeleted: false,
      },
      select: EXTRACTED_ROW_SELECT,
    });

    if (existingRow) {
      return existingRow;
    }

    const rowCount = await tx.extractedRow.count({
      where: { extractedTableId: tableId, isDeleted: false },
    });

    const createdRow = await tx.extractedRow.create({
      data: {
        userId: currentTable.userId,
        extractedTableId: tableId,
        rowIndex: rowCount,
        rowHash,
        rowData,
      },
      select: EXTRACTED_ROW_SELECT,
    });

    await refreshExtractedTableHashes(tx, tableId);
    await syncPdfDocumentExtractedData(tx, currentTable.pdfDocumentId);

    return createdRow;
  });
};

const updateExtractedRowById = async (client, tableId, rowId, rowData) => {
  const currentTable = await getExtractedTableById(client, tableId);

  if (!currentTable) {
    return null;
  }

  const currentRow = await client.extractedRow.findFirst({
    where: {
      id: rowId,
      extractedTableId: tableId,
      isDeleted: false,
    },
    select: EXTRACTED_ROW_SELECT,
  });

  if (!currentRow) {
    return null;
  }

  const schemaHash = getTableSchemaHash({ columns: currentTable.columns });
  const rowHash = getRowHash(schemaHash, rowData);

  return client.$transaction(async (tx) => {
    const existingRow = await tx.extractedRow.findFirst({
      where: {
        extractedTableId: tableId,
        rowHash,
        isDeleted: false,
        NOT: { id: rowId },
      },
      select: EXTRACTED_ROW_SELECT,
    });

    if (existingRow) {
      return existingRow;
    }

    const updatedRow = await tx.extractedRow.update({
      where: { id: rowId },
      data: {
        rowHash,
        rowData,
      },
      select: EXTRACTED_ROW_SELECT,
    });

    await refreshExtractedTableHashes(tx, tableId);
    await syncPdfDocumentExtractedData(tx, currentTable.pdfDocumentId);

    return updatedRow;
  });
};

const bulkUpdateExtractedRows = async (client, tableId, updates = []) => {
  const currentTable = await getExtractedTableById(client, tableId);

  if (!currentTable) {
    return null;
  }

  const validFields = getColumnFieldNames(currentTable.columns);

  if (validFields.size === 0) {
    throw new ApiError(400, 'Table has no editable columns');
  }

  const updateByRowId = new Map();

  for (const update of updates) {
    if (updateByRowId.has(update.rowId)) {
      throw new ApiError(400, `Duplicate update for row ${update.rowId}`);
    }

    const rowFields = Object.keys(update.rowData);

    if (rowFields.length === 0) {
      throw new ApiError(400, `rowData for row ${update.rowId} must include at least one field`);
    }

    const invalidField = rowFields.find((field) => !validFields.has(field));

    if (invalidField) {
      throw new ApiError(400, `${invalidField} is not a valid column for this table`);
    }

    updateByRowId.set(update.rowId, update.rowData);
  }

  const schemaHash = getTableSchemaHash({ columns: currentTable.columns });
  const rowsById = new Map(currentTable.extractedRows.map((row) => [row.id, row]));

  for (const rowId of updateByRowId.keys()) {
    if (!rowsById.has(rowId)) {
      throw new ApiError(404, `Row ${rowId} not found`);
    }
  }

  const nextRows = currentTable.extractedRows.map((row) => {
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
    await Promise.all(
      changedRows.map((row) =>
        tx.extractedRow.update({
          where: { id: row.id },
          data: {
            rowHash: `bulk-update:${row.id}:${crypto.randomUUID()}`,
          },
          select: EXTRACTED_ROW_SELECT,
        }),
      ),
    );

    await Promise.all(
      changedRows.map((row) =>
        tx.extractedRow.update({
          where: { id: row.id },
          data: {
            rowHash: row.nextRowHash,
            rowData: row.nextRowData,
          },
          select: EXTRACTED_ROW_SELECT,
        }),
      ),
    );

    await refreshExtractedTableHashes(tx, tableId);
    await syncPdfDocumentExtractedData(tx, currentTable.pdfDocumentId);

    const table = await getExtractedTableById(tx, tableId);

    return {
      success: true,
      updatedCount: changedRows.length,
      table,
    };
  });
};

const deleteExtractedRowById = async (client, tableId, rowId) => {
  const currentTable = await getExtractedTableById(client, tableId);

  if (!currentTable) {
    return null;
  }

  return client.$transaction(async (tx) => {
    const targetRow = await tx.extractedRow.findFirst({
      where: {
        id: rowId,
        extractedTableId: tableId,
        isDeleted: false,
      },
      select: EXTRACTED_ROW_SELECT,
    });

    if (!targetRow) {
      return null;
    }

    const deletedRow = await tx.extractedRow.update({
      where: { id: rowId },
      data: { isDeleted: true },
      select: EXTRACTED_ROW_SELECT,
    });

    const remainingRows = await tx.extractedRow.findMany({
      where: { extractedTableId: tableId, isDeleted: false },
      orderBy: [
        { rowIndex: 'asc' },
        { createdAt: 'asc' },
      ],
      select: EXTRACTED_ROW_SELECT,
    });

    await Promise.all(
      remainingRows.map((row, rowIndex) =>
        tx.extractedRow.update({
          where: { id: row.id },
          data: { rowIndex },
          select: EXTRACTED_ROW_SELECT,
        }),
      ),
    );

    await refreshExtractedTableHashes(tx, tableId);
    await syncPdfDocumentExtractedData(tx, currentTable.pdfDocumentId);

    return deletedRow;
  });
};

const deleteExtractedRowsByIds = async (client, tableId, rowIds = []) => {
  const currentTable = await getExtractedTableById(client, tableId);

  if (!currentTable) {
    return null;
  }

  const uniqueRowIds = [...new Set(rowIds.filter((rowId) => typeof rowId === 'string' && rowId.trim() !== ''))];

  if (uniqueRowIds.length === 0) {
    return null;
  }

  return client.$transaction(async (tx) => {
    const targetRows = await tx.extractedRow.findMany({
      where: {
        id: {
          in: uniqueRowIds,
        },
        extractedTableId: tableId,
        isDeleted: false,
      },
      select: EXTRACTED_ROW_SELECT,
      orderBy: [
        { rowIndex: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    if (targetRows.length === 0) {
      return null;
    }

    const deleted = await tx.extractedRow.updateMany({
      where: {
        id: {
          in: uniqueRowIds,
        },
        extractedTableId: tableId,
        isDeleted: false,
      },
      data: { isDeleted: true },
    });

    const remainingRows = await tx.extractedRow.findMany({
      where: { extractedTableId: tableId, isDeleted: false },
      orderBy: [
        { rowIndex: 'asc' },
        { createdAt: 'asc' },
      ],
      select: EXTRACTED_ROW_SELECT,
    });

    await Promise.all(
      remainingRows.map((row, rowIndex) =>
        tx.extractedRow.update({
          where: { id: row.id },
          data: { rowIndex },
          select: EXTRACTED_ROW_SELECT,
        }),
      ),
    );

    await refreshExtractedTableHashes(tx, tableId);
    await syncPdfDocumentExtractedData(tx, currentTable.pdfDocumentId);

    return {
      count: deleted.count,
      table: await getExtractedTableById(tx, tableId),
    };
  });
};

const clearExtractedRowsByTableId = async (client, tableId) => {
  const currentTable = await getExtractedTableById(client, tableId);

  if (!currentTable) {
    return null;
  }

  return client.$transaction(async (tx) => {
    const deleted = await tx.extractedRow.updateMany({
      where: { extractedTableId: tableId, isDeleted: false },
      data: { isDeleted: true },
    });

    await refreshExtractedTableHashes(tx, tableId);
    await syncPdfDocumentExtractedData(tx, currentTable.pdfDocumentId);

    return deleted;
  });
};

const getPdfTablesByPdfDocumentIdForUser = async (pdfDocumentId) => {
  return getPdfTablesByPdfDocumentId(prisma, pdfDocumentId);
};

const createExtractedTableForPdfDocumentForUser = async (data) => {
  return createExtractedTableForPdfDocument(prisma, data);
};

const getExtractedTableByIdForUser = async (tableId) => {
  return getExtractedTableById(prisma, tableId);
};

const updateExtractedTableByIdForUser = async (tableId, data) => {
  return updateExtractedTableById(prisma, tableId, data);
};

const replaceExtractedTableBulkForUser = async (tableId, data) => {
  return replaceExtractedTableBulk(prisma, tableId, data);
};

const deleteExtractedTableByIdForUser = async (tableId) => {
  return deleteExtractedTableById(prisma, tableId);
};

const createExtractedRowByTableIdForUser = async (tableId, rowData) => {
  return createExtractedRowByTableId(prisma, tableId, rowData);
};

const updateExtractedRowByIdForUser = async (tableId, rowId, rowData) => {
  return updateExtractedRowById(prisma, tableId, rowId, rowData);
};

const bulkUpdateExtractedRowsForUser = async (tableId, updates) => {
  return bulkUpdateExtractedRows(prisma, tableId, updates);
};

const deleteExtractedRowByIdForUser = async (tableId, rowId) => {
  return deleteExtractedRowById(prisma, tableId, rowId);
};

const deleteExtractedRowsByIdsForUser = async (tableId, rowIds) => {
  return deleteExtractedRowsByIds(prisma, tableId, rowIds);
};

const clearExtractedRowsByTableIdForUser = async (tableId) => {
  return clearExtractedRowsByTableId(prisma, tableId);
};

const replaceExtractedTableBulk = async (client, tableId, data) => {
  const currentTable = await getExtractedTableById(client, tableId);

  if (!currentTable) {
    return null;
  }

  const nextTitle = Object.prototype.hasOwnProperty.call(data, 'title') ? data.title : currentTable.title;
  const nextColumns = Array.isArray(data.columns) ? normalizeColumns(data.columns) : currentTable.columns;
  const nextRows = Array.isArray(data.rows) ? data.rows : [];

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
          userId: currentTable.userId,
          extractedTableId: tableId,
          rowIndex,
          rowHash: getRowHash(schemaHash, row),
          rowData: row,
        })),
        skipDuplicates: true,
      });
    }

    await refreshExtractedTableHashes(tx, tableId);
    await syncPdfDocumentExtractedData(tx, currentTable.pdfDocumentId);

    return getExtractedTableById(tx, tableId);
  });
};

const createManyExtractedRows = (tx, rows) => {
  if (!rows.length) {
    return Promise.resolve({ count: 0 });
  }

  return tx.extractedRow.createMany({
    data: rows,
    skipDuplicates: true,
  });
};

const processUploadedPdf = async ({ userId, fileName, filePath, extractedText, extractedData }) => {
  return prisma.$transaction(async (tx) => {
    const savedPdf = await createPdfDocument(tx, {
      userId,
      fileName,
      filePath,
      extractedText,
      extractedData,
    });

    const tables = Array.isArray(extractedData?.tables) ? extractedData.tables : [];
    let insertedTables = 0;
    let duplicateTables = 0;
    let insertedRows = 0;
    let duplicateRows = 0;

    for (const table of tables) {
      const schemaHash = getTableSchemaHash(table);
      const normalizedColumns = normalizeColumns(Array.isArray(table.columns) ? table.columns : []);
      const normalizedRows = Array.isArray(table.rows) ? table.rows.map((row) => normalizeRow(row)) : [];

      const existingTable = await getExtractedTableBySchemaHash(tx, userId, schemaHash);
      let targetTable = existingTable;

      if (!targetTable) {
        const createdTable = await tx.extractedTable.create({
          data: {
            userId,
            pdfDocumentId: savedPdf.id,
            title: table.title || null,
            tableHash: getTableHash({ title: table.title || null, columns: normalizedColumns, rows: normalizedRows }),
            schemaHash,
            columns: normalizedColumns,
          },
          select: EXTRACTED_TABLE_SELECT,
        });

        targetTable = createdTable;
        insertedTables += 1;
      } else {
        duplicateTables += 1;
      }

      const rowCount = await tx.extractedRow.count({
        where: { extractedTableId: targetTable.id, isDeleted: false },
      });

      const rows = normalizedRows.map((row, rowIndex) => ({
        userId,
        extractedTableId: targetTable.id,
        rowHash: getRowHash(schemaHash, row),
        rowData: row,
        rowIndex: rowCount + rowIndex,
      }));

      const createdRows = await createManyExtractedRows(tx, rows);
      insertedRows += createdRows.count;
      duplicateRows += Math.max(rows.length - createdRows.count, 0);

      await refreshExtractedTableHashes(tx, targetTable.id);
      await syncPdfDocumentExtractedData(tx, targetTable.pdfDocumentId);
    }

    return {
      pdfDocument: savedPdf,
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
    where: {
      userId,
      isDeleted: false,
      pdfDocument: {
        is: {
          isDeleted: false,
        },
      },
    },
    orderBy: [
      { createdAt: 'asc' },
      { updatedAt: 'asc' },
    ],
    select: {
      id: true,
      pdfDocumentId: true,
      title: true,
      schemaHash: true,
      columns: true,
      createdAt: true,
      extractedRows: {
        where: { isDeleted: false },
        orderBy: [
          { rowIndex: 'asc' },
          { createdAt: 'asc' },
        ],
        select: EXTRACTED_ROW_SELECT,
      },
    },
  });

  const mergedTables = new Map();

  for (const table of tables) {
    const key = table.schemaHash;

    if (!mergedTables.has(key)) {
      mergedTables.set(key, {
        title: table.title,
        schemaHash: table.schemaHash,
        columns: table.columns,
        rows: [],
        sourcePdfDocumentIds: [],
        sourceTableIds: [],
      });
    }

    const mergedTable = mergedTables.get(key);

    if (!mergedTable.sourceTableIds.includes(table.id)) {
      mergedTable.sourceTableIds.push(table.id);
    }

    if (!mergedTable.sourcePdfDocumentIds.includes(table.pdfDocumentId)) {
      mergedTable.sourcePdfDocumentIds.push(table.pdfDocumentId);
    }

    if (!mergedTable.title && table.title) {
      mergedTable.title = table.title;
    }

    mergedTable.rows.push(...table.extractedRows.map((row) => row.rowData));
  }

  return {
    tables: Array.from(mergedTables.values()),
  };
};

module.exports = {
  PDF_DOCUMENT_SELECT,
  EXTRACTED_TABLE_SELECT,
  EXTRACTED_ROW_SELECT,
  createPdfDocument,
  getUserPdfDocuments,
  getPdfDocumentById,
  getPdfDocumentByContentHash,
  getExtractedTableById,
  getExtractedTablesByPdfDocumentId,
  getPdfTablesByPdfDocumentId,
  getPdfTablesByPdfDocumentIdForUser,
  updatePdfDocument,
  deletePdfDocument,
  getExtractionContentHash,
  getTableSchemaHash,
  getTableHash,
  getRowHash,
  createManyExtractedRows,
  processUploadedPdf,
  getMergedExtractedDataByUser,
  createExtractedTableForPdfDocument,
  createExtractedTableForPdfDocumentForUser,
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
  syncPdfDocumentExtractedData,
  getExtractedTableByIdForUser,
  getExtractedTableBySchemaHash,
};
