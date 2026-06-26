const fs = require('fs');

const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const { extractPdfText } = require('../../utils/pdfExtractor');
const { extractWithGroq } = require('../../utils/groqClientMultiTabeles');
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

const formatQuoteNumber = (n) => `QUO-${String(n).padStart(6, '0')}`;

const enrichQuoteFileVerificationState = (file) => ({
  ...file,
  isVerified: Boolean(file?.is_Verifed),
});

const EXCLUDED_LINE_ITEM_COLUMN_KEYS = new Set([
  'createdat',
  'updatedat',
  'created_at',
  'updated_at',
]);

const normalizeRowData = (rowData) => {
  if (rowData && typeof rowData === 'object' && !Array.isArray(rowData)) {
    return rowData;
  }

  return { value: rowData ?? null };
};

const normalizeColumnName = (column) => {
  if (typeof column === 'string') {
    const trimmed = column.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!column || typeof column !== 'object') return null;

  const candidates = [column.key, column.label, column.title, column.name, column.header, column.field];
  const match = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);

  return match ? match.trim() : null;
};

const isExcludedLineItemColumnName = (name) => {
  if (typeof name !== 'string') return false;
  return EXCLUDED_LINE_ITEM_COLUMN_KEYS.has(name.trim().toLowerCase());
};

const normalizeRowDataForTable = (rowData, columns = []) => {
  if (rowData && typeof rowData === 'object' && !Array.isArray(rowData)) {
    return rowData;
  }

  if (Array.isArray(rowData)) {
    const columnNames = columns
      .map((column, index) => normalizeColumnName(column) || `column_${index + 1}`);

    return rowData.reduce((acc, value, index) => {
      acc[columnNames[index] || `column_${index + 1}`] = value;
      return acc;
    }, {});
  }

  return { value: rowData ?? null };
};

const collectUniqueColumnNamesFromTable = (table) => {
  const names = [];
  const seen = new Set();

  const columns = Array.isArray(table.columns) ? table.columns : [];

  for (const column of columns) {
    const normalized = normalizeColumnName(column);
    if (!normalized) continue;
    if (isExcludedLineItemColumnName(normalized)) continue;
    const identity = normalized.toLowerCase();
    if (seen.has(identity)) continue;
    seen.add(identity);
    names.push(normalized);
  }

  if (names.length > 0) return names;

  const rows = Array.isArray(table.rows) ? table.rows : [];
  for (const row of rows) {
    const rowData = normalizeRowDataForTable(row.rowData, columns);
    for (const key of Object.keys(rowData)) {
      const normalized = key.trim();
      if (!normalized) continue;
      if (isExcludedLineItemColumnName(normalized)) continue;
      const identity = normalized.toLowerCase();
      if (seen.has(identity)) continue;
      seen.add(identity);
      names.push(normalized);
    }
  }

  return names;
};

const buildExtractedLineItemsFromTables = (tables = []) => {
  const lineItems = [];
  const globalSeen = new Set(); // tracks tableId:columnIdentity to prevent true duplicates

  for (const table of tables) {
    const uniqueColumnNames = collectUniqueColumnNamesFromTable(table);

    for (const columnName of uniqueColumnNames) {
      const identity = columnName.toLowerCase();
      const compositeKey = `${table.id}:${identity}`; // scope by table
      if (globalSeen.has(compositeKey)) continue;
      globalSeen.add(compositeKey);

      lineItems.push({
        id: compositeKey,
        lineNumber: String(lineItems.length + 1),
        description: columnName,
        columnName,
        pdfTableId: table.id,
        sourceTableTitle: table.title ?? null,
        rowIndex: lineItems.length,
      });
    }
  }

  return lineItems;
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

  const processResult = await processUploadedPdf({
    userId,
    fileName: file.originalname,
    extractedData,
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

  const lineItems = buildExtractedLineItemsFromTables(storedTables);



 
  if (lineItems.length > 0) {
    await prisma.lineItem.createMany({
      data: lineItems.map((item) => ({
        userId,
        quote_id: quoteId,
        quote_file_id: createdQuoteFile.id,
        pdfTableId: item.pdfTableId,
        sourceTableTitle: item.sourceTableTitle,
        lineNumber: item.lineNumber,
        description: item.columnName,   // columnName → description field
        rowIndex: item.rowIndex,
      })),
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
      rowData: normalizeRowDataForTable(row.rowData, Array.isArray(table.columns) ? table.columns : []),
    })),
  }));

  return {
    file: {
      ...createdQuoteFile,
      tables,
      lineItems,
    },
    extractedRowCount: lineItems.length,
  };
};


const createQuoteWithUploads = async ({ userId, name, files }) => {
  const quote = await createQuoteForUser(userId, name, files[0]?.path ?? null);

  try {
    const results = [];

    for (const file of files) {
      const result = await processSingleFile({ file, userId, quoteId: quote.id });
      results.push(result);
    }

    return {
      quote: {
        ...quote,
        quoteIndex: quote.quote_number,
        pdfUrl: quote.pdf_url,
        formattedQuoteNumber: formatQuoteNumber(quote.quote_number),
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
    const results = [];

    for (const file of files) {
      const result = await processSingleFile({ file, userId, quoteId: quoteById.id });
      results.push(result);
      createdQuoteFileIds.push(result.file.id);
    }

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
        formattedQuoteNumber: formatQuoteNumber(quoteById.quote_number),
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
      quote_files: {
        where: { is_deleted: false },
        select: { id: true, pdf_upload_id: true },
      },
      _count: { select: { quote_files: { where: { is_deleted: false } } } },
    },
  });

  const uploadIds = [...new Set(
    quotes.flatMap((quote) => quote.quote_files.map((file) => file.pdf_upload_id))
  )];

  const tableColumnsByUpload = uploadIds.length
    ? await prisma.pdfTable.findMany({
      where: {
        pdfUploadId: { in: uploadIds },
        isDeleted: false,
      },
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

  const tablesByUploadId = tableColumnsByUpload.reduce((acc, table) => {
    (acc[table.pdfUploadId] ??= []).push(table);
    return acc;
  }, {});

  const columnCountByUploadId = Object.entries(tablesByUploadId).reduce((acc, [uploadId, tables]) => {
    acc[uploadId] = buildExtractedLineItemsFromTables(tables).length;
    return acc;
  }, {});

  return quotes.map((quote) => ({
    id: quote.id,
    quoteIndex: quote.quote_number,
    formattedQuoteNumber: formatQuoteNumber(quote.quote_number),
    name: quote.name,
    pdfUrl: quote.pdf_url,
    status: quote.status,
    fileCount: quote._count.quote_files,
    lineItemCount: quote.quote_files.reduce(
      (sum, file) => sum + (columnCountByUploadId[file.pdf_upload_id] ?? 0),
      0
    ),
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

  let totalExtractedRows = 0;

  return {
    quote: {
      id: quote.id, userId: quote.userId,
      quoteIndex: quote.quote_number,
      formattedQuoteNumber: formatQuoteNumber(quote.quote_number),
      name: quote.name, pdfUrl: quote.pdf_url, status: quote.status,
      createdAt: quote.created_at, updatedAt: quote.updated_at,
    },
    files: quote.quote_files.map((file) => {
      const fileTables = tablesByUploadId[file.pdf_upload_id] ?? [];
      const lineItems = buildExtractedLineItemsFromTables(fileTables);
      totalExtractedRows += lineItems.length;

      return {
        ...enrichQuoteFileVerificationState(file),
        lineItems,
        tables: fileTables.map((table) => ({
          id: table.id,
          title: table.title,
          columns: table.columns,
          rows: table.rows.map((row) => ({
            id: row.id,
            rowIndex: row.rowIndex ?? null,
            rowData: normalizeRowDataForTable(row.rowData, Array.isArray(table.columns) ? table.columns : []),
          })),
        })),
      };
    }),
    counts: {
      fileCount: quote._count.quote_files,
      lineItemCount: totalExtractedRows,
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
      quote: { userId },
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

  if (!quoteFile) {
    throw new ApiError(404, 'Quote file not found');
  }

  if (quoteFile.is_Verifed) {
    return { file: enrichQuoteFileVerificationState(quoteFile) };
  }

  const updatedQuoteFile = await prisma.quoteFile.update({
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

  return { file: enrichQuoteFileVerificationState(updatedQuoteFile) };
};
module.exports = {
  createQuoteWithUploads,
  addFilesToExistingQuote,
  getQuotesByUserId,
  getQuoteDetailById,
  getQuoteTablesByQuoteId,
  verifyQuoteFileById,
};