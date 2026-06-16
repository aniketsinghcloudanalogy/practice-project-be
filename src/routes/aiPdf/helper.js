const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');

const TABLE_SELECT = {
  id: true,
  pdfUploadId: true,
  userId: true,
  title: true,
  columns: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

const ROW_SELECT = {
  id: true,
  pdfTableId: true,
  rowData: true,
  rowIndex: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

const processUploadedPdf = async ({ userId, fileName, extractedData }) => {
  const tables = Array.isArray(extractedData?.tables) ? extractedData.tables : [];

  // Validate that at least one table exists
  if (tables.length === 0) {
    throw new ApiError(422, 'No tables found in PDF');
  }

  return prisma.$transaction(async (tx) => {
    // Create PdfUpload record
    const pdfUpload = await tx.pdfUpload.create({
      data: {
        userId,
        fileName,
      },
      select: { id: true },
    });

    // Create PdfTable and PdfTableRow records for each table
    const results = await Promise.all(
      tables.map(async (table) => {
        // Create PdfTable
        const pdfTable = await tx.pdfTable.create({
          data: {
            pdfUploadId: pdfUpload.id,
            userId,
            title: table.title || null,
            columns: table.columns || [],
          },
          select: TABLE_SELECT,
        });

        // Create PdfTableRow records
        const rows = Array.isArray(table.rows) ? table.rows : [];
        let rowCount = 0;
        if (rows.length > 0) {
          const rowData = rows.map((row, rowIndex) => ({
            pdfTableId: pdfTable.id,
            rowData: row,
            rowIndex,
          }));

          await tx.pdfTableRow.createMany({
            data: rowData,
          });
          rowCount = rows.length;
        }

        return {
          tableId: pdfTable.id,
          rowCount,
        };
      })
    );

    return {
      uploadId: pdfUpload.id,
      tableCount: tables.length,
      tables: results,
    };
  });
};

module.exports = {
  TABLE_SELECT,
  ROW_SELECT,
  processUploadedPdf,
};
