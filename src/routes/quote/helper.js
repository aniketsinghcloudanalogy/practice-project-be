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

  const lineItemRowsForDb = [];
  const seenTableColumnKeys = new Set();

  for (const table of storedTables) {
    const columns = Array.isArray(table.columns) ? table.columns : [];
    const tableNames = [];
    const tableSeen = new Set();

    for (const column of columns) {
      const normalized = normalizeColumnNameForCounting(column);
      if (!normalized || isExcludedColumnNameForCounting(normalized)) continue;
      const identity = normalized.toLowerCase();
      if (tableSeen.has(identity)) continue;
      tableSeen.add(identity);
      tableNames.push(normalized);
    }

    if (tableNames.length === 0) {
      for (const row of table.rows ?? []) {
        const rowData = row?.rowData;
        if (!rowData || typeof rowData !== 'object' || Array.isArray(rowData)) continue;

        for (const key of Object.keys(rowData)) {
          const normalized = key.trim();
          if (!normalized || isExcludedColumnNameForCounting(normalized)) continue;
          const identity = normalized.toLowerCase();
          if (tableSeen.has(identity)) continue;
          tableSeen.add(identity);
          tableNames.push(normalized);
        }
      }
    }

    for (const name of tableNames) {
      const compositeKey = `${table.id}:${name.toLowerCase()}`;
      if (seenTableColumnKeys.has(compositeKey)) continue;
      seenTableColumnKeys.add(compositeKey);

      lineItemRowsForDb.push({
        userId,
        quote_id: quoteId,
        quote_file_id: createdQuoteFile.id,
        pdfTableId: table.id,
        sourceTableTitle: table.title ?? null,
        lineNumber: String(lineItemRowsForDb.length + 1),
        description: name,
        rowIndex: lineItemRowsForDb.length,
      });
    }
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
          take: 1,
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

  const columnCountByUploadId = Object.fromEntries(
    Object.entries(tablesByUploadId).map(([uploadId, tables]) => [uploadId, countUniqueColumns(tables)])
  );

  return quotes.map((quote) => ({
    id: quote.id,
    quoteIndex: quote.quote_number,
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
      name: quote.name, pdfUrl: quote.pdf_url, status: quote.status,
      createdAt: quote.created_at, updatedAt: quote.updated_at,
    },
    files: quote.quote_files.map((file) => {
      const fileTables = tablesByUploadId[file.pdf_upload_id] ?? [];
      const lineItemCount = countUniqueColumns(fileTables);
      totalExtractedRows += lineItemCount;

      return {
        ...file,
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
module.exports = {
  createQuoteWithUploads,
  addFilesToExistingQuote,
  getQuotesByUserId,
  getQuoteDetailById,
  getQuoteTablesByQuoteId,
  verifyQuoteFileById,  
};