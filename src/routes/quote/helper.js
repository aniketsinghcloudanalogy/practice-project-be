const fs = require('fs');

const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const { extractPdfText } = require('../../utils/pdfExtractor');
const { extractWithGroq } = require('../../utils/groqClientMultiTabeles');
const { processUploadedPdf, syncUploadTables } = require('../aiPdf/helper');
const { DUMMY_QUOTE_SEED } = require('./dummyData');


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

const LINE_ITEM_SELECT = {
  id: true,
  userId: true,
  quote_id: true,
  quote_file_id: true,
  pdfTableId: true,
  rowIndex: true,
  lineNumber: true,
  description: true,
  quantity: true,
  unitPrice: true,
  amount: true,
  currency: true,
  status: true,
  department: true,
  createdAt: true,
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

const createDummyLineItemData = ({ userId, pdfTableId, rowIndex, lineItem = {} }) => ({
  userId,
  pdfTableId,
  rowIndex: Number.isInteger(lineItem.rowIndex) ? lineItem.rowIndex : rowIndex,
  lineNumber: lineItem.lineNumber ?? String(rowIndex + 1),
  description: lineItem.description ?? `Dummy item ${rowIndex + 1}`,
  quantity: lineItem.quantity ?? '1',
  unitPrice: lineItem.unitPrice ?? '100',
  amount: lineItem.amount ?? '100',
  currency: lineItem.currency ?? 'USD',
  status: lineItem.status ?? 'PENDING',
  department: lineItem.department ?? 'General',
  itemCode: lineItem.itemCode ?? null,
  employeeId: lineItem.employeeId ?? null,
  employeeName: lineItem.employeeName ?? null,
  category: lineItem.category ?? null,
  email: lineItem.email ?? null,
  phone: lineItem.phone ?? null,
  salary: lineItem.salary ?? null,
  referenceNo: lineItem.referenceNo ?? null,
  location: lineItem.location ?? null,
  notes: lineItem.notes ?? null,
});

const seedDummyQuoteData = async ({ userId }) => {
  const seedQuotes = Array.isArray(DUMMY_QUOTE_SEED.quotes) ? DUMMY_QUOTE_SEED.quotes : [];

  if (seedQuotes.length === 0) {
    throw new ApiError(400, 'No dummy quote data found in local seed file');
  }

  const { _max } = await prisma.quote.aggregate({
    where: { userId },
    _max: { quote_number: true },
  });

  let nextQuoteNumber = (_max.quote_number ?? 0) + 1;
  const createdQuotes = [];
  let totalFiles = 0;
  let totalLineItems = 0;

    for (let quoteIndex = 0; quoteIndex < seedQuotes.length; quoteIndex += 1) {
      const quoteTemplate = seedQuotes[quoteIndex] || {};
      const templateFiles = Array.isArray(quoteTemplate.files) ? quoteTemplate.files : [];

      const createdQuote = await prisma.quote.create({
        data: {
          userId,
          name: quoteTemplate.name || `Dummy Quote ${nextQuoteNumber}`,
          quote_number: nextQuoteNumber,
          pdf_url: quoteTemplate.pdfUrl || `dummy://quote/${nextQuoteNumber}`,
        },
        select: QUOTE_SELECT,
      });

      const createdFiles = [];

      for (let fileIndex = 0; fileIndex < templateFiles.length; fileIndex += 1) {
        const fileTemplate = templateFiles[fileIndex] || {};
        const templateLineItems = Array.isArray(fileTemplate.lineItems) ? fileTemplate.lineItems : [];

        const upload = await prisma.pdfUpload.create({
          data: {
            userId,
            fileName: fileTemplate.fileName || `dummy-quote-${nextQuoteNumber}-file-${fileIndex + 1}.pdf`,
          },
          select: { id: true, fileName: true },
        });

        const table = await prisma.pdfTable.create({
          data: {
            userId,
            pdfUploadId: upload.id,
            title: fileTemplate.tableTitle || `Dummy Table ${fileIndex + 1}`,
            columns: Array.isArray(fileTemplate.columns) && fileTemplate.columns.length > 0 ? fileTemplate.columns : [
              { key: 'lineNumber', label: 'Line Number' },
              { key: 'description', label: 'Description' },
              { key: 'quantity', label: 'Quantity' },
              { key: 'unitPrice', label: 'Unit Price' },
              { key: 'amount', label: 'Amount' },
            ],
            lineItemColumnMapping: {
              lineNumber: 'lineNumber',
              description: 'description',
              quantity: 'quantity',
              unitPrice: 'unitPrice',
              amount: 'amount',
            },
          },
          select: { id: true },
        });

        const quoteFile = await prisma.quoteFile.create({
          data: {
            quote_id: createdQuote.id,
            pdf_upload_id: upload.id,
            file_name: upload.fileName,
          },
          select: QUOTE_FILE_SELECT,
        });

        const lineItemsSource = templateLineItems.length > 0
          ? templateLineItems
          : [{ description: 'Fallback dummy item', quantity: '1', unitPrice: '100', amount: '100' }];

        const lineItemsData = lineItemsSource.map((lineItem, rowIndex) =>
          createDummyLineItemData({
            userId,
            pdfTableId: table.id,
            rowIndex,
            lineItem,
          })
        );

        await prisma.lineItem.createMany({ data: lineItemsData });

        const insertedLineItems = await prisma.lineItem.findMany({
          where: {
            userId,
            pdfTableId: table.id,
            isDeleted: false,
          },
          orderBy: { rowIndex: 'asc' },
          select: LINE_ITEM_SELECT,
        });

        createdFiles.push({
          quoteFile,
          pdfTableId: table.id,
          insertedLineItems,
          linkedLineItems: 0,
          pendingLineItems: insertedLineItems.length,
        });

        totalFiles += 1;
        totalLineItems += insertedLineItems.length;
      }

      const linkedFiles = [];
      let linkedLineItemsForQuote = 0;

      for (const createdFile of createdFiles) {
        const quoteFileAfterLink = await prisma.quoteFile.update({
          where: { id: createdFile.quoteFile.id },
          data: { quote_id: createdQuote.id },
          select: QUOTE_FILE_SELECT,
        });

        const lineItemLinkResult = await prisma.lineItem.updateMany({
          where: {
            userId,
            isDeleted: false,
            pdfTableId: createdFile.pdfTableId,
          },
          data: {
            quote_id: createdQuote.id,
            quote_file_id: createdFile.quoteFile.id,
          },
        });

        const linkedLineItems = await prisma.lineItem.findMany({
          where: {
            userId,
            isDeleted: false,
            pdfTableId: createdFile.pdfTableId,
          },
          orderBy: { rowIndex: 'asc' },
          select: LINE_ITEM_SELECT,
        });

        linkedLineItemsForQuote += lineItemLinkResult.count;

        linkedFiles.push({
          quoteFile: quoteFileAfterLink,
          pdfTableId: createdFile.pdfTableId,
          insertedLineItems: linkedLineItems,
          linkedLineItems: lineItemLinkResult.count,
          pendingLineItems: 0,
        });
      }

      createdQuotes.push({
        id: createdQuote.id,
        quoteIndex: createdQuote.quote_number,
        formattedQuoteNumber: formatQuoteNumber(createdQuote.quote_number),
        name: createdQuote.name,
        files: linkedFiles,
        linkedLineItems: linkedLineItemsForQuote,
      });

      nextQuoteNumber += 1;
    }

  return {
    summary: {
      quoteCount: seedQuotes.length,
      fileCount: totalFiles,
      lineItemCount: totalLineItems,
      note: 'Quote, quote_file, and line_item links are created in a single API hit.',
    },
    quotes: createdQuotes,
  };
};

const upsertDummyQuoteLinks = async ({ userId, quoteId, quoteFileIds = [] }) => {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, userId, is_deleted: false },
    select: {
      id: true,
      quote_number: true,
      quote_files: {
        where: { is_deleted: false },
        select: { id: true, pdf_upload_id: true },
      },
    },
  });

  if (!quote) throw new ApiError(404, 'Quote not found');

  const availableFileIds = new Set(quote.quote_files.map((file) => file.id));

  const selectedQuoteFiles = (quoteFileIds.length > 0
    ? quote.quote_files.filter((file) => quoteFileIds.includes(file.id))
    : quote.quote_files);

  if (quoteFileIds.length > 0 && selectedQuoteFiles.length !== quoteFileIds.length) {
    throw new ApiError(400, 'One or more quoteFileIds are invalid for this quote');
  }

  if (selectedQuoteFiles.length === 0) {
    throw new ApiError(400, 'No quote files found for upsert');
  }

  const selectedIds = selectedQuoteFiles.map((file) => file.id).filter((id) => availableFileIds.has(id));

  const tables = await prisma.pdfTable.findMany({
    where: {
      userId,
      isDeleted: false,
      pdfUploadId: { in: selectedQuoteFiles.map((file) => file.pdf_upload_id) },
    },
    select: { id: true, pdfUploadId: true },
  });

  const tableIdsByUploadId = tables.reduce((acc, table) => {
    (acc[table.pdfUploadId] ??= []).push(table.id);
    return acc;
  }, {});

  const upsertResult = await prisma.$transaction(async (tx) => {
    const quoteFileUpdate = await tx.quoteFile.updateMany({
      where: { id: { in: selectedIds }, is_deleted: false },
      data: { quote_id: quote.id },
    });

    let updatedLineItems = 0;

    for (const quoteFile of selectedQuoteFiles) {
      const tableIds = tableIdsByUploadId[quoteFile.pdf_upload_id] ?? [];
      if (tableIds.length === 0) continue;

      const updateResult = await tx.lineItem.updateMany({
        where: {
          userId,
          isDeleted: false,
          pdfTableId: { in: tableIds },
        },
        data: {
          quote_id: quote.id,
          quote_file_id: quoteFile.id,
        },
      });

      updatedLineItems += updateResult.count;
    }

    return {
      updatedQuoteFiles: quoteFileUpdate.count,
      updatedLineItems,
    };
  });

  return {
    quote: {
      id: quote.id,
      quoteIndex: quote.quote_number,
      formattedQuoteNumber: formatQuoteNumber(quote.quote_number),
    },
    updatedQuoteFiles: upsertResult.updatedQuoteFiles,
    updatedLineItems: upsertResult.updatedLineItems,
    processedQuoteFileIds: selectedIds,
  };
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
  seedDummyQuoteData,
  upsertDummyQuoteLinks,
  getQuotesByUserId,
  getQuoteDetailById,
  getQuoteTablesByQuoteId,
};