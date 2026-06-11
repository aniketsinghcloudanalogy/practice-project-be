const pdfModel = require('./helper');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { extractPdfText } = require('../../utils/pdfExtractor');
const { extractWithGroq } = require('../../utils/groqClient');

const uploadPdf = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return next(new ApiError(400, 'PDF file is required'));
    }

    let extractedText;
    let extractedData;

    try {
      extractedText = await extractPdfText(file.path);
    } catch (error) {
      removeLocalFile(file.path);
      return next(new ApiError(422, 'PDF parsing failed'));
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

      return next(new ApiError(502, message));
    }

    const result = await pdfModel.processUploadedPdf({
      userId,
      fileName: file.originalname,
      filePath: file.path,
      extractedText,
      extractedData,
    });

    return res.status(201).json(
      new ApiResponse(
        201,
        'PDF extracted successfully',
        {
          tableCount: result.tableCount,
          insertedTables: result.insertedTables,
          duplicateTables: result.duplicateTables,
          insertedRows: result.insertedRows,
          duplicateRows: result.duplicateRows,
        }
      )
    );
  } catch (error) {
    next(error);
  }
};

const getMergedExtractedData = async (req, res, next) => {
  try {
    const mergedData = await pdfModel.getMergedExtractedDataByUser(req.user.id);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Merged extracted data fetched successfully',
        mergedData
      )
    );
  } catch (error) {
    next(error);
  }
};

const getPdfTables = async (req, res, next) => {
  try {
    const pdfDocument = await pdfModel.getPdfDocumentById(req.params.id);

    if (!pdfDocument) {
      return next(new ApiError(404, 'PDF not found'));
    }

    if (pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    const tables = await pdfModel.getPdfTablesByPdfDocumentIdForUser(pdfDocument.id);

    return res.status(200).json(
      new ApiResponse(
        200,
        'PDF tables fetched successfully',
        tables
      )
    );
  } catch (error) {
    next(error);
  }
};

const createPdfTable = async (req, res, next) => {
  try {
    const pdfDocument = await pdfModel.getPdfDocumentById(req.params.id);

    if (!pdfDocument) {
      return next(new ApiError(404, 'PDF not found'));
    }

    if (pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    const { title, columns = [], rows = [] } = req.body;

    const createdTable = await pdfModel.createExtractedTableForPdfDocumentForUser({
      userId: req.user.id,
      pdfDocumentId: pdfDocument.id,
      title,
      columns,
      rows,
    });

    return res.status(201).json(
      new ApiResponse(
        201,
        'Table created successfully',
        createdTable
      )
    );
  } catch (error) {
    next(error);
  }
};

const updatePdfTable = async (req, res, next) => {
  try {
    const table = await pdfModel.getExtractedTableByIdForUser(req.params.tableId);

    if (!table) {
      return next(new ApiError(404, 'Table not found'));
    }

    if (table.pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    const updatedTable = await pdfModel.updateExtractedTableByIdForUser(req.params.tableId, req.body);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Table updated successfully',
        updatedTable
      )
    );
  } catch (error) {
    next(error);
  }
};

const replacePdfTable = async (req, res, next) => {
  try {
    const table = await pdfModel.getExtractedTableByIdForUser(req.params.tableId);

    if (!table) {
      return next(new ApiError(404, 'Table not found'));
    }

    if (table.pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    const replacedTable = await pdfModel.replaceExtractedTableBulkForUser(req.params.tableId, req.body);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Table replaced successfully',
        replacedTable
      )
    );
  } catch (error) {
    next(error);
  }
};

const deletePdfTable = async (req, res, next) => {
  try {
    const table = await pdfModel.getExtractedTableByIdForUser(req.params.tableId);

    if (!table) {
      return next(new ApiError(404, 'Table not found'));
    }

    if (table.pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    const deletedTable = await pdfModel.deleteExtractedTableByIdForUser(req.params.tableId);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Table deleted successfully',
        deletedTable
      )
    );
  } catch (error) {
    next(error);
  }
};

const createPdfTableRow = async (req, res, next) => {
  try {
    const table = await pdfModel.getExtractedTableByIdForUser(req.params.tableId);

    if (!table) {
      return next(new ApiError(404, 'Table not found'));
    }

    if (table.pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    const createdRow = await pdfModel.createExtractedRowByTableIdForUser(req.params.tableId, req.body.rowData);

    return res.status(201).json(
      new ApiResponse(
        201,
        'Row created successfully',
        createdRow
      )
    );
  } catch (error) {
    next(error);
  }
};

const updatePdfTableRow = async (req, res, next) => {
  try {
    const table = await pdfModel.getExtractedTableByIdForUser(req.params.tableId);

    if (!table) {
      return next(new ApiError(404, 'Table not found'));
    }

    if (table.pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    const updatedRow = await pdfModel.updateExtractedRowByIdForUser(req.params.tableId, req.params.rowId, req.body.rowData);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Row updated successfully',
        updatedRow
      )
    );
  } catch (error) {
    next(error);
  }
};

const bulkUpdatePdfTableRows = async (req, res, next) => {
  try {
    const table = await pdfModel.getExtractedTableByIdForUser(req.params.tableId);

    if (!table) {
      return next(new ApiError(404, 'Table not found'));
    }

    if (table.pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    const result = await pdfModel.bulkUpdateExtractedRowsForUser(req.params.tableId, req.body.updates);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Rows updated successfully',
        result
      )
    );
  } catch (error) {
    next(error);
  }
};

const bulkDeletePdfTableRows = async (req, res, next) => {
  try {
    const table = await pdfModel.getExtractedTableByIdForUser(req.params.tableId);

    if (!table) {
      return next(new ApiError(404, 'Table not found'));
    }

    if (table.pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    const result = await pdfModel.deleteExtractedRowsByIdsForUser(req.params.tableId, req.body.rowIds);

    if (!result || result.count === 0) {
      return next(new ApiError(404, 'Rows not found'));
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        'Rows deleted successfully',
        result
      )
    );
  } catch (error) {
    next(error);
  }
};

const deletePdfTableRow = async (req, res, next) => {
  try {
    const table = await pdfModel.getExtractedTableByIdForUser(req.params.tableId);

    if (!table) {
      return next(new ApiError(404, 'Table not found'));
    }

    if (table.pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    const deletedRow = await pdfModel.deleteExtractedRowByIdForUser(req.params.tableId, req.params.rowId);

    if (!deletedRow) {
      return next(new ApiError(404, 'Row not found'));
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        'Row deleted successfully',
        deletedRow
      )
    );
  } catch (error) {
    next(error);
  }
};

const clearPdfTableRows = async (req, res, next) => {
  try {
    const table = await pdfModel.getExtractedTableByIdForUser(req.params.tableId);

    if (!table) {
      return next(new ApiError(404, 'Table not found'));
    }

    if (table.pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    const cleared = await pdfModel.clearExtractedRowsByTableIdForUser(req.params.tableId);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Table rows cleared successfully',
        cleared
      )
    );
  } catch (error) {
    next(error);
  }
};

const getUserPdfs = async (req, res, next) => {
  try {
    const pdfDocuments = await pdfModel.getUserPdfDocuments(req.user.id);

    return res.status(200).json(
      new ApiResponse(
        200,
        'PDFs fetched successfully',
        pdfDocuments
      )
    );
  } catch (error) {
    next(error);
  }
};

const getPdf = async (req, res, next) => {
  try {
    const pdfDocument = await pdfModel.getPdfDocumentById(req.params.id);

    if (!pdfDocument) {
      return next(new ApiError(404, 'PDF not found'));
    }

    if (pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        'PDF fetched successfully',
        pdfDocument
      )
    );
  } catch (error) {
    next(error);
  }
};

const deletePdf = async (req, res, next) => {
  try {
    const pdfDocument = await pdfModel.getPdfDocumentById(req.params.id);

    if (!pdfDocument) {
      return next(new ApiError(404, 'PDF not found'));
    }

    if (pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    const deletedPdf = await pdfModel.deletePdfDocument(req.params.id);

    return res.status(200).json(
      new ApiResponse(
        200,
        'PDF deleted successfully',
        deletedPdf
      )
    );
  } catch (error) {
    next(error);
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
