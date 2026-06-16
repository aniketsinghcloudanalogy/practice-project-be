const aiPdfModel = require('./helper');
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

    const result = await aiPdfModel.processUploadedPdf({
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
      fs.unlink(filePath, () => {});
    }
  }
};

module.exports = {
  extract,
};

