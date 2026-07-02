const fs = require('fs');

const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const { extractPdfText } = require('../../utils/pdfExtractor');
const { extractWithGroq, mergeExtractedTables } = require('../../utils/groqClientMultiTabeles');
const { processUploadedPdf } = require('../aiPdf/helper');


const QUOTE_SELECT = {
  id: true,
  userId: true,
  quote_number: true,
  name: true,
  pdf_url: true,
  status: true,
  created_at: true,
  updated_at: true,
};

const QUOTE_FILE_SELECT = {
  id: true,
  quote_id: true,
  pdf_upload_id: true,
  file_name: true,
  is_Verifed: true,
  created_at: true,
};

const removeLocalFile = (filePath) => {
  if (filePath) fs.unlink(filePath, () => { });
};

const EXCLUDED_LINE_ITEM_COLUMN_KEYS = new Set([
  'createdat',
  'updatedat',
  'created_at',
  'updated_at',
]);

const normalizeColumnNameForCounting = (column) => {
  if (typeof column === 'string') {
    const trimmed = column.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!column || typeof column !== 'object') return null;

  const candidates = [column.key, column.label, column.title, column.name, column.header, column.field];
  const match = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return match ? match.trim() : null;
};

const isExcludedColumnNameForCounting = (name) => {
  if (typeof name !== 'string') return false;
  return EXCLUDED_LINE_ITEM_COLUMN_KEYS.has(name.trim().toLowerCase());
};

// NOTE: countUniqueColumns is now ONLY used as a historical/legacy helper.
// It no longer drives LineItem creation. It's kept here in case other
// callers (badges, etc.) still reference it, but see the recommendation
// at the bottom of this file about replacing it with a row-count helper.
const countUniqueColumns = (tables = []) => {
  const seen = new Set();

  for (const table of tables) {
    const columns = Array.isArray(table.columns) ? table.columns : [];

    for (const column of columns) {
      const name = normalizeColumnNameForCounting(column);
      if (!name || isExcludedColumnNameForCounting(name)) continue;
      seen.add(`${table.id}:${name.toLowerCase()}`);
    }

    if (columns.length > 0) continue;

    const rows = Array.isArray(table.rows) ? table.rows : [];
    for (const row of rows) {
      const rowData = row?.rowData;
      if (!rowData || typeof rowData !== 'object' || Array.isArray(rowData)) continue;

      for (const key of Object.keys(rowData)) {
        const trimmed = key.trim();
        if (!trimmed || isExcludedColumnNameForCounting(trimmed)) continue;
        seen.add(`${table.id}:${trimmed.toLowerCase()}`);
      }
    }
  }

  return seen.size;
};

// ── NEW: counts actual extracted rows (real line items), not column names ───
const countExtractedRows = (tables = []) =>
  tables.reduce((sum, table) => sum + (Array.isArray(table.rows) ? table.rows.length : 0), 0);

// ── NEW: known LineItem DB fields we can auto-map PDF columns onto ──────────
const LINE_ITEM_FIELD_OPTIONS = [
  { key: 'lineNumber', label: 'Line No' },
  { key: 'itemCode', label: 'Item Code' },
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'employeeName', label: 'Employee Name' },
  { key: 'description', label: 'Description' },
  { key: 'department', label: 'Department' },
  { key: 'category', label: 'Category' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'salary', label: 'Salary' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'amount', label: 'Amount' },
  { key: 'currency', label: 'Currency' },
  { key: 'status', label: 'Status' },
  { key: 'referenceNo', label: 'Reference No' },
  { key: 'location', label: 'Location' },
  { key: 'notes', label: 'Notes' },
];

// Short-form / common header aliases that won't match key/label directly
const FIELD_ALIASES = {
  qty: 'quantity',
  price: 'unitPrice',
  unitprice: 'unitPrice',
  empid: 'employeeId',
  employeeid: 'employeeId',
  name: 'employeeName',
  employeename: 'employeeName',
  dept: 'department',
  code: 'itemCode',
  itemcode: 'itemCode',
  total: 'amount',
  ref: 'referenceNo',
  refno: 'referenceNo',
  line: 'lineNumber',
  lineno: 'lineNumber',
  desc: 'description',
  part: 'description',
  unit: 'unitPrice',
};

const normalizeFieldKey = (value) =>
  String(value ?? '').trim().replace(/[_\s-]+/g, '').toLowerCase();

/**
 * Auto-detects a lineItemColumnMapping ({ sourceColumnKey: targetField })
 * from a table's column titles, matching against known LineItem fields.
 * Returns {} if nothing matches — that's fine, callers must still build
 * LineItems for every row regardless (see buildLineItemRecordsWithFallback).
 */
const buildAutoColumnMapping = (columns = []) => {
  const mapping = {};
  const usedFields = new Set();
  const unmatchedColumns = [];

  // Pass 1 — exact key/label matches only (highest confidence, always wins)
  for (const column of columns) {
    const title = normalizeColumnNameForCounting(column);
    if (!title) continue;
    const normalizedTitle = normalizeFieldKey(title);

    const directMatch = LINE_ITEM_FIELD_OPTIONS.find(
      (f) => !usedFields.has(f.key) &&
        (normalizeFieldKey(f.key) === normalizedTitle || normalizeFieldKey(f.label) === normalizedTitle)
    );

    if (directMatch) {
      const columnKey = typeof column === 'string' ? column : column.key;
      if (columnKey) {
        mapping[columnKey] = directMatch.key;
        usedFields.add(directMatch.key);
      }
    } else {
      unmatchedColumns.push({ column, normalizedTitle });
    }
  }

  // Pass 2 — only now fall back to aliases, for whatever direct matches missed
  for (const { column, normalizedTitle } of unmatchedColumns) {
    const aliasKey = FIELD_ALIASES[normalizedTitle];
    if (!aliasKey || usedFields.has(aliasKey)) continue;

    const columnKey = typeof column === 'string' ? column : column.key;
    if (columnKey) {
      mapping[columnKey] = aliasKey;
      usedFields.add(aliasKey);
    }
  }

  return mapping;
};

const buildLineItemRecordsWithFallback = ({ rows, columns, mapping, userId, tableId, tableTitle }) => {
  const columnTitleByKey = new Map(
    (columns || []).map((col) => [
      typeof col === 'string' ? col : col.key,
      typeof col === 'string' ? col : (col.title || col.key),
    ])
  );

  const mappedSourceKeys = new Set(Object.keys(mapping));

  return (rows || []).map((row, rowIndex) => {
    const lineItem = {
      userId,
      pdfTableId: tableId,
      sourceTableTitle: tableTitle || null,
      rowSourceId: row.id || null,
      rowIndex: row.rowIndex ?? rowIndex,
    };

    // 1) Fill every recognized field from the mapping
    for (const [sourceColumn, targetField] of Object.entries(mapping)) {
      const value = row.rowData?.[sourceColumn];
      lineItem[targetField] = value === null || value === undefined ? null : String(value);
    }

    // 2) Collect anything that didn't map to a known field, keyed by column title
    //    (stored as JSON so the frontend can render each as its own column)
    const leftovers = {};
    for (const [key, value] of Object.entries(row.rowData || {})) {
      if (mappedSourceKeys.has(key)) continue;
      if (value === null || value === undefined || value === '') continue;

      const label = columnTitleByKey.get(key) || key;
      leftovers[label] = value;
    }

    // 3) Persist leftovers in their own column. `notes` stays reserved for
    //    a genuine "Notes" PDF column mapped by the user.
    if (Object.keys(leftovers).length > 0) {
      lineItem.extraFields = leftovers;
    }

    // 4) Absolute fallback: nothing matched at all for this table
    if (Object.keys(mapping).length === 0 && !lineItem.description) {
      lineItem.description = Object.entries(leftovers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ') || null;
    }

    return lineItem;
  });
};

const createQuoteForUser = async (userId, name, pdfUrl = null) => {
  return prisma.$transaction(async (tx) => {
    const { _max } = await tx.quote.aggregate({
      where: { userId },
      _max: { quote_number: true },
    });

    return tx.quote.create({
      data: { userId, name, pdf_url: pdfUrl, quote_number: (_max.quote_number ?? 0) + 1 },
      select: QUOTE_SELECT,
    });
  });
};




const processSingleFile = async ({ file, userId, quoteId }) => {
  let extractedText;
  let extractedData;

  try {
    extractedText = await extractPdfText(file.path);
  } catch {
    throw new ApiError(422, 'PDF parsing failed');
  }

  try {
    extractedData = await extractWithGroq(extractedText);
  } catch (error) {
    const statusCode = error.statusCode || 502;
    const message =
      statusCode === 401 || statusCode === 403 ? 'Groq API authentication failed'
        : statusCode === 429 ? 'Groq API rate limit exceeded'
          : error.message || 'Groq API failure';
    const mappedStatusCode = statusCode === 429 ? 429 : 502;
    throw new ApiError(mappedStatusCode, message);
  }

  if (!Array.isArray(extractedData?.tables) || extractedData.tables.length === 0) {
    throw new ApiError(422, 'No tables found in PDF');
  }

  // const mergedExtractedData = {
  //   tables: [mergeExtractedTables(extractedData.tables)],
  // };

  const processResult = await processUploadedPdf({
    userId,
    fileName: file.originalname,
    extractedData: extractedData,
  });

  const createdQuoteFile = await prisma.quoteFile.create({
    data: { quote_id: quoteId, pdf_upload_id: processResult.uploadId, file_name: file.originalname },
    select: QUOTE_FILE_SELECT,
  });

  const createdTableIds = processResult.tables.map((table) => table.tableId);

  const storedTables = createdTableIds.length > 0
    ? await prisma.pdfTable.findMany({
      where: {
        id: { in: createdTableIds },
        isDeleted: false,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        columns: true,
        rows: {
          where: { isDeleted: false },
          orderBy: { rowIndex: 'asc' },
          select: {
            id: true,
            rowData: true,
            rowIndex: true,
          },
        },
      },
    })
    : [];

  // ── Build one LineItem PER ROW, always ────────────────────────────────────
  // For each table: auto-detect a column->field mapping, persist it onto the
  // table (so "Update Columns" opens pre-filled), then build LineItems for
  // every row regardless of how much/little of the mapping matched.
  const lineItemRowsForDb = [];
  const tableMappingUpdates = [];

  for (const table of storedTables) {
    const columns = Array.isArray(table.columns) ? table.columns : [];
    const mapping = buildAutoColumnMapping(columns);

    tableMappingUpdates.push(
      prisma.pdfTable.update({
        where: { id: table.id },
        data: { lineItemColumnMapping: mapping },
      })
    );

    const records = buildLineItemRecordsWithFallback({
      rows: table.rows,
      columns,
      mapping,
      userId,
      tableId: table.id,
      tableTitle: table.title,
    });

    records.forEach((item, i) => {
      lineItemRowsForDb.push({
        ...item,
        quote_id: quoteId,
        quote_file_id: createdQuoteFile.id,
        lineNumber: item.lineNumber ?? String(lineItemRowsForDb.length + 1),
      });
    });
  }

  if (tableMappingUpdates.length > 0) {
    await Promise.all(tableMappingUpdates);
  }

  if (lineItemRowsForDb.length > 0) {
    await prisma.lineItem.createMany({
      data: lineItemRowsForDb,
      skipDuplicates: true,
    });
  }

  const tables = storedTables.map((table) => ({
    id: table.id,
    title: table.title,
    columns: table.columns,
    rows: table.rows.map((row) => ({
      id: row.id,
      rowIndex: row.rowIndex ?? null,
      rowData: row.rowData,
    })),
  }));

  return {
    file: {
      ...createdQuoteFile,
      tables,
    },
    extractedRowCount: lineItemRowsForDb.length,
  };
};


const createQuoteWithUploads = async ({ userId, name, files }) => {
  const quote = await createQuoteForUser(userId, name, files[0]?.path ?? null);

  try {
    const results = await Promise.all(
      files.map((file) => processSingleFile({ file, userId, quoteId: quote.id }))
    );

    return {
      quote: {
        ...quote,
        quoteIndex: quote.quote_number,
        pdfUrl: quote.pdf_url,
      },
      files: results.map((r) => r.file),
      lineItemCount: results.reduce((sum, r) => sum + r.extractedRowCount, 0),
    };
  } catch (error) {
    try {
      await prisma.quote.delete({ where: { id: quote.id } });
    } catch (rollbackError) {
      console.error('Failed to rollback quote after create failure', {
        quoteId: quote.id,
        message: rollbackError?.message,
      });
    }

    throw error;
  } finally {

    files.forEach((file) => removeLocalFile(file.path));
  }
};

const addFilesToExistingQuote = async ({ quoteId, userId, files }) => {
  const quoteById = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: {
      ...QUOTE_SELECT,
      is_deleted: true,
    },
  });

  if (!quoteById) throw new ApiError(404, 'Quote not found');
  if (quoteById.userId !== userId) throw new ApiError(403, 'You are not allowed to modify this quote');
  if (quoteById.is_deleted) throw new ApiError(400, 'Quote is deleted');

  const createdQuoteFileIds = [];

  try {
    const settledResults = await Promise.allSettled(
      files.map((file) => processSingleFile({ file, userId, quoteId: quoteById.id }))
    );

    const rejectedResult = settledResults.find((result) => result.status === 'rejected');
    if (rejectedResult) {
      throw rejectedResult.reason;
    }

    const results = settledResults.map((result) => result.value);
    createdQuoteFileIds.push(...results.map((result) => result.file.id));

    return {
      quote: {
        id: quoteById.id,
        userId: quoteById.userId,
        quote_number: quoteById.quote_number,
        name: quoteById.name,
        pdf_url: quoteById.pdf_url,
        status: quoteById.status,
        created_at: quoteById.created_at,
        updated_at: quoteById.updated_at,
        quoteIndex: quoteById.quote_number,
        pdfUrl: quoteById.pdf_url,
      },
      files: results.map((r) => r.file),
      lineItemCount: results.reduce((sum, r) => sum + r.extractedRowCount, 0),
    };
  } catch (error) {
    if (createdQuoteFileIds.length > 0) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.quoteFile.deleteMany({
            where: { id: { in: createdQuoteFileIds }, quote_id: quoteById.id },
          });
        });
      } catch (rollbackError) {
        console.error('Failed to rollback quote files after add failure', {
          quoteId: quoteById.id,
          message: rollbackError?.message,
        });
      }
    }

    throw error;
  } finally {
    files.forEach((file) => removeLocalFile(file.path));
  }
};

const getQuotesByUserId = async (userId) => {
  const quotes = await prisma.quote.findMany({
    where: { userId, is_deleted: false },
    orderBy: { created_at: 'desc' },
    select: {
      id: true, quote_number: true, name: true, pdf_url: true,
      status: true, created_at: true,
      _count: { select: { quote_files: { where: { is_deleted: false } } } },
    },
  });

  const quoteIds = quotes.map((q) => q.id);

  const lineItemCounts = quoteIds.length
    ? await prisma.lineItem.groupBy({
      by: ['quote_id'],
      where: { quote_id: { in: quoteIds }, isDeleted: false },
      _count: { _all: true },
    })
    : [];

  const lineItemCountByQuoteId = Object.fromEntries(
    lineItemCounts.map((row) => [row.quote_id, row._count._all])
  );

  return quotes.map((quote) => ({
    id: quote.id,
    quoteIndex: quote.quote_number,
    name: quote.name,
    pdfUrl: quote.pdf_url,
    status: quote.status,
    fileCount: quote._count.quote_files,
    lineItemCount: lineItemCountByQuoteId[quote.id] ?? 0,
    createdAt: quote.created_at,
  }));
};

const getQuoteDetailById = async (quoteId, userId) => {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, userId, is_deleted: false },
    select: {
      id: true, userId: true, quote_number: true, name: true,
      pdf_url: true, status: true, created_at: true, updated_at: true,
      quote_files: {
        where: { is_deleted: false },
        orderBy: { created_at: 'asc' },
        select: {
          id: true, quote_id: true, pdf_upload_id: true,
          file_name: true, is_Verifed: true, created_at: true, updated_at: true,
        },
      },
      _count: { select: { quote_files: { where: { is_deleted: false } } } },
    },
  });

  if (!quote) throw new ApiError(404, 'Quote not found');
  const uploadIds = quote.quote_files.map((file) => file.pdf_upload_id);

  const tables = uploadIds.length > 0
    ? await prisma.pdfTable.findMany({
      where: {
        isDeleted: false,
        pdfUploadId: { in: uploadIds },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        pdfUploadId: true,
        title: true,
        columns: true,
        rows: {
          where: { isDeleted: false },
          orderBy: { rowIndex: 'asc' },
          select: {
            id: true,
            rowData: true,
            rowIndex: true,
          },
        },
      },
    })
    : [];

  const tablesByUploadId = tables.reduce((acc, table) => {
    (acc[table.pdfUploadId] ??= []).push(table);
    return acc;
  }, {});

  // ── real LineItem counts, grouped per file ──────────────────────────────
  const lineItemGroups = quote.quote_files.length
    ? await prisma.lineItem.groupBy({
      by: ['quote_file_id'],
      where: { quote_id: quoteId, isDeleted: false },
      _count: { _all: true },
    })
    : [];

  const lineItemCountByFileId = Object.fromEntries(
    lineItemGroups.map((row) => [row.quote_file_id, row._count._all])
  );

  return {
    quote: {
      id: quote.id, userId: quote.userId,
      quoteIndex: quote.quote_number,
      name: quote.name, pdfUrl: quote.pdf_url, status: quote.status,
      createdAt: quote.created_at, updatedAt: quote.updated_at,
    },
    files: quote.quote_files.map((file) => {
      const fileTables = tablesByUploadId[file.pdf_upload_id] ?? [];

      return {
        ...file,
        lineItemCount: lineItemCountByFileId[file.id] ?? 0,
        tables: fileTables.map((table) => ({
          id: table.id,
          title: table.title,
          columns: table.columns,
          rows: table.rows.map((row) => ({
            id: row.id,
            rowIndex: row.rowIndex ?? null,
            rowData: row.rowData,
          })),
        })),
      };
    }),
    counts: {
      fileCount: quote._count.quote_files,
      lineItemCount: Object.values(lineItemCountByFileId).reduce((a, b) => a + b, 0),
    },
  };
};

const getQuoteTablesByQuoteId = async (quoteId) =>
  prisma.pdfTable.findMany({
    where: { pdfUpload: { quoteFiles: { some: { quote_id: quoteId } } } },
    include: {
      rows: {
        where: { isDeleted: false },
        orderBy: { rowIndex: 'asc' },
      },
    },
  });

const verifyQuoteFileById = async ({ quoteId, quoteFileId, userId }) => {
  const quoteFile = await prisma.quoteFile.findFirst({
    where: {
      id: quoteFileId,
      quote_id: quoteId,
      is_deleted: false,                          // ← add this
      quote: { userId, is_deleted: false },       // ← add is_deleted: false here too
    },
    select: {
      id: true,
      quote_id: true,
      pdf_upload_id: true,
      file_name: true,
      is_Verifed: true,
      created_at: true,
      updated_at: true,
    },
  });

  if (!quoteFile) throw new ApiError(404, 'Quote file not found');

  if (quoteFile.is_Verifed) return { file: quoteFile };

  // 2. Fetch existing LineItems for this file
  const existingLineItems = await prisma.lineItem.findMany({
    where: {
      userId,
      quote_id: quoteId,
      quote_file_id: quoteFileId,
      isDeleted: false,
    },
    select: {
      pdfTableId: true,
      sourceTableTitle: true,
      rowSourceId: true,
      rowIndex: true,
      lineNumber: true,
      itemCode: true,
      employeeId: true,
      employeeName: true,
      description: true,
      department: true,
      category: true,
      email: true,
      phone: true,
      salary: true,
      quantity: true,
      unitPrice: true,
      amount: true,
      currency: true,
      status: true,
      referenceNo: true,
      location: true,
      notes: true,
      extraFields: true,
    },
  });

  // 3. Find which ones are already in profitability table (by pdfTableId + description as identity)
  const existingProfitability = await prisma.profitabilty_line_items.findMany({
    where: {
      userId,
      quote_id: quoteId,
      quote_file_id: quoteFileId,
      isDeleted: false,
    },
    select: { pdfTableId: true, description: true },
  });

  const alreadySynced = new Set(
    existingProfitability.map((p) => `${p.pdfTableId}:${p.description ?? ''}`),
  );

  const toInsert = existingLineItems
    .filter((item) => !alreadySynced.has(`${item.pdfTableId}:${item.description ?? ''}`))
    .map((item) => ({
      ...item,              // ← spread first
      userId,
      quote_id: quoteId,
      quote_file_id: quoteFileId,
      is_Verifed: true,     // ← always last, guaranteed true
    }));

  // 4. Run everything in a transaction
  const updatedQuoteFile = await prisma.$transaction(async (tx) => {
    const syncedQuoteFile = quoteFile.is_Verifed
      ? quoteFile
      : await tx.quoteFile.update({
        where: { id: quoteFile.id },
        data: { is_Verifed: true },
        select: {
          id: true,
          quote_id: true,
          pdf_upload_id: true,
          file_name: true,
          is_Verifed: true,
          created_at: true,
          updated_at: true,
        },
      });

    // 4b. Insert missing LineItems into Profitabilty_line_items (already verified)
    if (toInsert.length > 0) {
      await tx.profitabilty_line_items.createMany({
        data: toInsert,
        skipDuplicates: true,
      });
    }

    // 4c. Mark any pre-existing profitability line items as verified too
    await tx.profitabilty_line_items.updateMany({
      where: {
        userId,
        quote_id: quoteId,
        quote_file_id: quoteFile.id,
        isDeleted: false,
        is_Verifed: false,
      },
      data: { is_Verifed: true },
    });

    return syncedQuoteFile;
  });

  return { file: updatedQuoteFile };
};

const LINE_ITEM_SELECT = {
  id: true,
  lineNumber: true,
  itemCode: true,
  employeeId: true,
  employeeName: true,
  description: true,
  department: true,
  category: true,
  email: true,
  phone: true,
  salary: true,
  quantity: true,
  unitPrice: true,
  amount: true,
  currency: true,
  status: true,
  referenceNo: true,
  location: true,
  notes: true,
  extraFields: true,
  pdfTableId: true,
  sourceTableTitle: true,
  rowIndex: true,
  createdAt: true,
  updatedAt: true,
};

const LINE_ITEM_UPDATABLE_FIELDS = new Set([
  'lineNumber', 'itemCode', 'employeeId', 'employeeName', 'description',
  'department', 'category', 'email', 'phone', 'salary', 'quantity',
  'unitPrice', 'amount', 'currency', 'status', 'referenceNo', 'location', 'notes',
]);

const assertQuoteFileAccess = async (quoteFileId, quoteId, userId) => {
  const quoteFile = await prisma.quoteFile.findFirst({
    where: {
      id: quoteFileId,
      quote_id: quoteId,
      is_deleted: false,
      quote: { userId, is_deleted: false },
    },
    select: {
      id: true,
      pdf_upload_id: true,
    },
  });

  if (!quoteFile) throw new ApiError(404, 'Quote file not found');
  return quoteFile;
};
const createLineItem = async ({ quoteId, quoteFileId, userId, data = {} }) => {
  const quoteFile = await assertQuoteFileAccess(quoteFileId, quoteId, userId);

  const requestedPdfTableId = typeof data.pdfTableId === 'string' && data.pdfTableId.trim().length > 0
    ? data.pdfTableId.trim()
    : null;

  let pdfTableId = requestedPdfTableId;
  let sourceTableTitle = null;

  if (pdfTableId) {
    const table = await prisma.pdfTable.findFirst({
      where: {
        id: pdfTableId,
        pdfUploadId: quoteFile.pdf_upload_id,
        userId,
        isDeleted: false,
      },
      select: { id: true, title: true },
    });

    if (!table) {
      throw new ApiError(400, 'Invalid table reference for this quote file');
    }

    pdfTableId = table.id;
    sourceTableTitle = table.title ?? null;
  }

  if (!pdfTableId) {
    const latestLineItem = await prisma.lineItem.findFirst({
      where: {
        userId,
        quote_id: quoteId,
        quote_file_id: quoteFileId,
        isDeleted: false,
      },
      orderBy: [{ rowIndex: 'desc' }, { createdAt: 'desc' }],
      select: {
        pdfTableId: true,
        sourceTableTitle: true,
      },
    });

    if (latestLineItem?.pdfTableId) {
      pdfTableId = latestLineItem.pdfTableId;
      sourceTableTitle = latestLineItem.sourceTableTitle ?? null;
    }
  }

  if (!pdfTableId) {
    const firstUploadTable = await prisma.pdfTable.findFirst({
      where: {
        pdfUploadId: quoteFile.pdf_upload_id,
        userId,
        isDeleted: false,
      },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true, title: true },
    });

    if (firstUploadTable?.id) {
      pdfTableId = firstUploadTable.id;
      sourceTableTitle = firstUploadTable.title ?? null;
    }
  }

  if (!pdfTableId) {
    throw new ApiError(400, 'No table available to attach the new line item');
  }

  const nextRowIndex = typeof data.rowIndex === 'number'
    ? data.rowIndex
    : await prisma.lineItem.count({
      where: {
        userId,
        quote_id: quoteId,
        quote_file_id: quoteFileId,
        isDeleted: false,
      },
    });

  const createData = {
    userId,
    quote_id: quoteId,
    quote_file_id: quoteFileId,
    pdfTableId,
    sourceTableTitle,
    rowIndex: nextRowIndex,
  };

  for (const [key, value] of Object.entries(data)) {
    if (LINE_ITEM_UPDATABLE_FIELDS.has(key)) {
      createData[key] = value ?? null;
    }
  }

  const created = await prisma.lineItem.create({
    data: createData,
    select: LINE_ITEM_SELECT,
  });

  return { lineItem: created };
};


const getLineItemsByQuoteFileId = async ({ quoteId, quoteFileId, userId }) => {
  await assertQuoteFileAccess(quoteFileId, quoteId, userId);

  const lineItems = await prisma.lineItem.findMany({
    where: {
      userId,
      quote_id: quoteId,
      quote_file_id: quoteFileId,
      isDeleted: false,
    },
    orderBy: { rowIndex: 'asc' },
    select: LINE_ITEM_SELECT,
  });

  return { lineItems };
};

const updateLineItem = async ({ lineItemId, quoteId, quoteFileId, userId, data }) => {
  const lineItem = await prisma.lineItem.findFirst({
    where: {
      id: lineItemId,
      userId,
      quote_id: quoteId,
      quote_file_id: quoteFileId,
      isDeleted: false,
    },
    select: { id: true, extraFields: true },
  });

  if (!lineItem) throw new ApiError(404, 'Line item not found');

  const updateData = {};
  for (const [key, value] of Object.entries(data)) {
    if (LINE_ITEM_UPDATABLE_FIELDS.has(key)) {
      updateData[key] = value ?? null;
    }
  }

  if (data.extraFieldKey) {
    const currentExtra = (lineItem.extraFields && typeof lineItem.extraFields === 'object' && !Array.isArray(lineItem.extraFields))
      ? { ...lineItem.extraFields }
      : {};

    currentExtra[data.extraFieldKey] = data.extraFieldValue ?? null;
    updateData.extraFields = currentExtra;
  }

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }

  const updated = await prisma.lineItem.update({
    where: { id: lineItemId },
    data: updateData,
    select: LINE_ITEM_SELECT,
  });

  return { lineItem: updated };
};

const deleteLineItem = async ({ lineItemId, quoteId, quoteFileId, userId }) => {
  const lineItem = await prisma.lineItem.findFirst({
    where: {
      id: lineItemId,
      userId,
      quote_id: quoteId,
      quote_file_id: quoteFileId,
      isDeleted: false,
    },
    select: { id: true },
  });

  if (!lineItem) throw new ApiError(404, 'Line item not found');

  await prisma.lineItem.update({
    where: { id: lineItemId },
    data: { isDeleted: true },
  });

  return { id: lineItemId };
};

module.exports = {
  createQuoteWithUploads,
  addFilesToExistingQuote,
  getQuotesByUserId,
  getQuoteDetailById,
  getQuoteTablesByQuoteId,
  verifyQuoteFileById,
  getLineItemsByQuoteFileId,
  createLineItem,
  updateLineItem,
  deleteLineItem,
};