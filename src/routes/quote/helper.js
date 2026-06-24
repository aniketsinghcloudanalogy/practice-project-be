const fs = require('fs');

const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const { extractPdfText } = require('../../utils/pdfExtractor');
const { extractWithGroq } = require('../../utils/groqClientMultiTabeles');
const { processUploadedPdf, syncUploadTables } = require('../aiPdf/helper');


const LINE_ITEM_ALLOWED_FIELDS = new Set([
  'lineNumber', 'itemCode', 'employeeId', 'employeeName', 'description',
  'department', 'category', 'email', 'phone', 'salary', 'quantity',
  'unitPrice', 'amount', 'currency', 'status', 'referenceNo', 'location', 'notes',
]);

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
  created_at: true,
};

const removeLocalFile = (filePath) => {
  if (filePath) fs.unlink(filePath, () => { });
};

const formatQuoteNumber = (n) => `QUO-${String(n).padStart(6, '0')}`;

const buildLineItemMapping = (columns = []) =>
  columns.reduce((mapping, column) => {
    const key = typeof column?.key === 'string' ? column.key.trim() : '';
    if (key && LINE_ITEM_ALLOWED_FIELDS.has(key)) mapping[key] = key;
    return mapping;
  }, {});


const buildSyncTablesPayload = (createdTables, extractedTables) =>
  createdTables.map((createdTable, index) => {
    const { title = null, columns = [], rows = [] } = extractedTables[index] ?? {};
    return {
      id: createdTable.tableId,
      title,
      columns,
      lineItemMapping: buildLineItemMapping(columns),
      rows: rows.map((rowData, rowIndex) => ({ rowData, rowIndex })),
    };
  });

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

  const extractedTables = Array.isArray(extractedData?.tables) ? extractedData.tables : [];

  await syncUploadTables({
    uploadId: processResult.uploadId,
    userId,
    tables: buildSyncTablesPayload(processResult.tables, extractedTables),
  });

  const createdQuoteFile = await prisma.quoteFile.create({
    data: { quote_id: quoteId, pdf_upload_id: processResult.uploadId, file_name: file.originalname },
    select: QUOTE_FILE_SELECT,
  });

  const { count } = await prisma.lineItem.updateMany({
    where: { userId, pdfTableId: { in: processResult.tables.map((t) => t.tableId) }, isDeleted: false },
    data: { quote_id: quoteId, quote_file_id: createdQuoteFile.id },
  });

  return {
    quoteFile: createdQuoteFile,
    lineItemCount: count,
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
      files: results.map((r) => r.quoteFile),
      lineItemCount: results.reduce((sum, r) => sum + r.lineItemCount, 0),
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
      createdQuoteFileIds.push(result.quoteFile.id);
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
      files: results.map((r) => r.quoteFile),
      lineItemCount: results.reduce((sum, r) => sum + r.lineItemCount, 0),
    };
  } catch (error) {
    if (createdQuoteFileIds.length > 0) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.lineItem.updateMany({
            where: { userId, quote_file_id: { in: createdQuoteFileIds } },
            data: { quote_id: null, quote_file_id: null },
          });

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
        select: { id: true },
      },
      _count: { select: { quote_files: { where: { is_deleted: false } } } },
    },
  });

  const quoteIds = quotes.map((q) => q.id);

  const lineItemCounts = quoteIds.length
    ? await prisma.lineItem.groupBy({
      by: ['quote_id'],
      where: { quote_id: { in: quoteIds }, isDeleted: false },
      _count: true,
    })
    : [];

  const countByQuoteId = lineItemCounts.reduce((acc, { quote_id, _count }) => {
    if (quote_id) acc[quote_id] = _count;
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
    lineItemCount: countByQuoteId[quote.id] ?? 0,
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
          file_name: true, created_at: true, updated_at: true,
        },
      },
      _count: { select: { quote_files: { where: { is_deleted: false } } } },
    },
  });

  if (!quote) throw new ApiError(404, 'Quote not found');

  const allLineItems = await prisma.lineItem.findMany({
    where: { quote_id: quote.id, isDeleted: false },
    orderBy: { rowIndex: 'asc' },
  });

  const lineItemsByFileId = allLineItems.reduce((acc, item) => {
    if (!item.quote_file_id) return acc;
    (acc[item.quote_file_id] ??= []).push(item);
    return acc;
  }, {});

  return {
    quote: {
      id: quote.id, userId: quote.userId,
      quoteIndex: quote.quote_number,
      formattedQuoteNumber: formatQuoteNumber(quote.quote_number),
      name: quote.name, pdfUrl: quote.pdf_url, status: quote.status,
      createdAt: quote.created_at, updatedAt: quote.updated_at,
    },
    files: quote.quote_files.map((file) => ({
      ...file,
      lineItems: lineItemsByFileId[file.id] ?? [],
    })),
    counts: {
      fileCount: quote._count.quote_files,
      lineItemCount: allLineItems.length,
    },
  };
};


const getQuoteTablesByQuoteId = async (quoteId) =>
  prisma.pdfTable.findMany({
    where: { pdfUpload: { quoteFiles: { some: { quote_id: quoteId } } } },
    include: {
      pdfTableRows: {
        where:
          { is_deleted: false },
        orderBy: {
          row_index: 'asc'
        }
      },
    },
  });

module.exports = {
  createQuoteWithUploads,
  addFilesToExistingQuote,
  getQuotesByUserId,
  getQuoteDetailById,
  getQuoteTablesByQuoteId,
};