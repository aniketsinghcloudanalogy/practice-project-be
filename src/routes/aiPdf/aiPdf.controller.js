const { TABLE_SELECT,
  ROW_SELECT,
  processUploadedPdf,
  getUserUploads,
  getUploadWithTables,
  syncUploadTables,
  softDeleteUploadById } = require('./helper');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const fs = require('fs');
const { extractPdfText } = require('../../utils/pdfExtractor');
const { extractWithGroq } = require('../../utils/groqClientMultiTabeles');

const extract = async (req, res, next) => {
  const filePath = req.file?.path;

  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) return next(new ApiError(400, 'PDF file is required'));

    let extractedText;
    try {
      extractedText = await extractPdfText(file.path);
    } catch (error) {
      return next(new ApiError(422, 'PDF parsing failed'));
    }

    let extractedData;
    try {
      extractedData = await extractWithGroq(extractedText);
    } catch (error) {
      const statusCode = error.statusCode || 502;
      const message =
        statusCode === 401 || statusCode === 403
          ? 'Groq API authentication failed'
          : statusCode === 429
            ? 'Groq API rate limit exceeded'
            : error.message || 'Groq API failure';

      return next(new ApiError(502, message));
    }

    const result = await processUploadedPdf({
      userId,
      fileName: file.originalname,
      extractedData,
    });

    return res.status(201).json(
      new ApiResponse(201, 'PDF uploaded and tables extracted successfully', {
        uploadId: result.uploadId,
        tableCount: result.tableCount,
        tables: result.tables,
      })
    );
  } catch (error) {
    next(error);
  } finally {
    if (filePath) {
      fs.unlink(filePath, () => { });
    }
  }
};

// GET /pdf
const getUploads = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const uploads = await getUserUploads(userId);

    return res
      .status(200)
      .json(new ApiResponse(200, 'Uploads fetched successfully', { uploads }));
  } catch (error) {
    next(error);
  }
};

// GET /pdf/:uploadId
const getUploadDetail = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { uploadId } = req.params;

    const upload = await getUploadWithTables(uploadId, userId);

    if (!upload) {
      return next(new ApiError(404, 'Upload not found'));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, 'Upload detail fetched successfully', { upload }));
  } catch (error) {
    next(error);
  }
};

// PUT /aipdf/:uploadId/sync
const syncUpload = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { uploadId } = req.params;
    const { tables } = req.body;

    const result = await syncUploadTables({
      uploadId,
      userId,
      tables,
    });

    return res
      .status(200)
      .json(new ApiResponse(200, 'Upload tables synced successfully', result));
  } catch (error) {
    next(error);
  }
};

// DELETE /aipdf/:uploadId
const deleteUpload = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { uploadId } = req.params;

    const result = await softDeleteUploadById(uploadId, userId);

    return res
      .status(200)
      .json(new ApiResponse(200, 'Upload deleted successfully', result));
  } catch (error) {
    next(error);
  }
};


module.exports = {
  extract,
  getUploads,
  getUploadDetail,
  syncUpload,
  deleteUpload,
};

