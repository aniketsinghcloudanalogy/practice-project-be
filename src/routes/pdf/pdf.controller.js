const pdfModel = require('./helper');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const fs = require('fs');
const { extractPdfText } = require('../../utils/pdfExtractor');
const { extractWithGroq } = require('../../utils/groqClient');

const removeLocalFile = (filePath) => {
  if (!filePath) return;
  fs.unlink(filePath, () => {});
};

const getOwnedTable = async (tableId, userId) => {
  const table = await pdfModel.getOwnedExtractedTable(tableId, userId);
  if (!table) {
    throw new ApiError(404, 'Table not found');
  }
  return table;
};

const uploadPdf = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      throw new ApiError(400, 'PDF file is required');
    }

    let extractedText;
    let extractedData;

    try {
      extractedText = await extractPdfText(file.path);
    } catch (error) {
      removeLocalFile(file.path);
      throw new ApiError(422, 'PDF parsing failed');
    }

    try {
      extractedData = await extractWithGroq(extractedText);
    } catch (error) {
      removeLocalFile(file.path);
      const statusCode = error.statusCode || 502;
      const message =
        statusCode === 401 || statusCode === 403
          ? 'Groq API authentication failed'
          : statusCode === 429
            ? 'Groq API rate limit exceeded'
            : error.message || 'Groq API failure';
      throw new ApiError(502, message);
    }

    const result = await pdfModel.processUploadedPdf({
      userId,
      fileName: file.originalname,
      filePath: file.path,
      extractedText,
      extractedData,
    });

    return res.status(201).json(
      new ApiResponse(201, 'PDF extracted successfully', {
        tableCount: result.tableCount,
        insertedTables: result.insertedTables,
        duplicateTables: result.duplicateTables,
        insertedRows: result.insertedRows,
        duplicateRows: result.duplicateRows,
      })
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getMergedExtractedData = async (req, res) => {
  try {
    const mergedData = await pdfModel.getMergedExtractedDataByUser(req.user.id);

    return res.status(200).json(
      new ApiResponse(200, 'Merged extracted data fetched successfully', mergedData)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getPdfTables = async (req, res) => {
  try {
    const tables = await pdfModel.getExtractedTablesByUserId(req.user.id);

    return res.status(200).json(
      new ApiResponse(200, 'PDF tables fetched successfully', tables)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const createPdfTable = async (req, res) => {
  try {
    const { title, columns = [], rows = [] } = req.body;

    const createdTable = await pdfModel.createExtractedTable({
      userId: req.user.id,
      sourceFileName: null,
      contentHash: null,
      title,
      columns,
      rows,
    });

    return res.status(201).json(
      new ApiResponse(201, 'Table created successfully', createdTable)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const updatePdfTable = async (req, res) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id);

    const updatedTable = await pdfModel.updateExtractedTableById(req.params.tableId, req.body, table);

    return res.status(200).json(
      new ApiResponse(200, 'Table updated successfully', updatedTable)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const replacePdfTable = async (req, res) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id);

    const replacedTable = await pdfModel.replaceExtractedTableBulk(req.params.tableId, req.body, table);

    return res.status(200).json(
      new ApiResponse(200, 'Table replaced successfully', replacedTable)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const deletePdfTable = async (req, res) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id);

    const deletedTable = await pdfModel.deleteExtractedTableById(req.params.tableId);

    return res.status(200).json(
      new ApiResponse(200, 'Table deleted successfully', deletedTable)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const createPdfTableRow = async (req, res) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id);

    const createdRow = await pdfModel.createExtractedRowByTableId(req.params.tableId, req.body.rowData, table);

    return res.status(201).json(
      new ApiResponse(201, 'Row created successfully', createdRow)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const updatePdfTableRow = async (req, res) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id);

    const updatedRow = await pdfModel.updateExtractedRowById(req.params.tableId, req.params.rowId, req.body.rowData, table);

    return res.status(200).json(
      new ApiResponse(200, 'Row updated successfully', updatedRow)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const bulkUpdatePdfTableRows = async (req, res) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id);

    let result;
    if (Array.isArray(req.body.rowIds) && req.body.rowIds.length > 0 && req.body.data && typeof req.body.data === 'object') {
      result = await pdfModel.bulkUpdateExtractedRowsSimple(req.params.tableId, req.body.rowIds, req.body.data, table);
    } else {
      result = await pdfModel.bulkUpdateExtractedRows(req.params.tableId, req.body.updates, table);
    }

    return res.status(200).json(
      new ApiResponse(200, 'Rows updated successfully', result)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const bulkDeletePdfTableRows = async (req, res) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id);

    const result = await pdfModel.deleteExtractedRowsByIds(req.params.tableId, req.body.rowIds, table);

    return res.status(200).json(
      new ApiResponse(200, 'Rows deleted successfully', result)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const deletePdfTableRow = async (req, res) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id);

    const deletedRow = await pdfModel.deleteExtractedRowById(req.params.tableId, req.params.rowId, table);

    if (!deletedRow) {
      throw new ApiError(404, 'Row not found');
    }

    return res.status(200).json(
      new ApiResponse(200, 'Row deleted successfully', deletedRow)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const clearPdfTableRows = async (req, res) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id);

    const cleared = await pdfModel.clearExtractedRowsByTableId(req.params.tableId, table);

    return res.status(200).json(
      new ApiResponse(200, 'Table rows cleared successfully', cleared)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getUserPdfs = async (req, res) => {
  try {
    const tables = await pdfModel.getExtractedTablesByUserId(req.user.id);

    return res.status(200).json(
      new ApiResponse(200, 'PDFs fetched successfully', tables)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getPdf = async (req, res) => {
  try {
    const tableId = req.params.tableId || req.params.id;
    const table = await pdfModel.getOwnedExtractedTable(tableId, req.user.id);

    if (!table) {
      throw new ApiError(404, 'PDF not found');
    }

    return res.status(200).json(
      new ApiResponse(200, 'PDF fetched successfully', table)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const deletePdf = async (req, res) => {
  try {
    const tableId = req.params.tableId || req.params.id;
    const table = await pdfModel.getOwnedExtractedTable(tableId, req.user.id);

    if (!table) {
      throw new ApiError(404, 'PDF not found');
    }

    const deletedPdf = await pdfModel.deleteExtractedTableById(tableId);

    return res.status(200).json(
      new ApiResponse(200, 'PDF deleted successfully', deletedPdf)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

module.exports = {
  uploadPdf,
  getUserPdfs,
  getMergedExtractedData,
  getPdfTables,
  createPdfTable,
  updatePdfTable,
  replacePdfTable,
  deletePdfTable,
  createPdfTableRow,
  updatePdfTableRow,
  bulkUpdatePdfTableRows,
  bulkDeletePdfTableRows,
  deletePdfTableRow,
  clearPdfTableRows,
  getPdf,
  deletePdf,
};
