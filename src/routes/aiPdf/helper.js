const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');

const TABLE_SELECT = {
  id: true,
  pdfUploadId: true,
  userId: true,
  title: true,
  columns: true,
  lineItemColumnMapping: true,
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

const LINE_ITEM_SELECT = {
  id: true,
  userId: true,
  pdfUploadId: true,
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
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

const LINE_ITEM_FIELD_OPTIONS = [
  { key: 'lineNumber', label: 'Line Number' },
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

const LINE_ITEM_FIELD_KEYS = new Set(LINE_ITEM_FIELD_OPTIONS.map((field) => field.key));

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
            lineItemColumnMapping: null,
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


// GET /pdf — all uploads for user with table count
const getUserUploads = async (userId) => {
  return prisma.pdfUpload.findMany({
    where: { userId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fileName: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          tables: { where: { isDeleted: false } },
        },
      },
    },
  });
};
// GET /pdf/:uploadId — full detail with all tables + rows
const getUploadWithTables = async (uploadId, userId) => {
  return prisma.pdfUpload.findFirst({
    where: { id: uploadId, userId, isDeleted: false },
    select: {
      id: true,
      fileName: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      tables: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'asc' },
        select: {
          ...TABLE_SELECT,
          lineItemColumnMapping: true,
          rows: {          
            where: { isDeleted: false },
            orderBy: { rowIndex: 'asc' },
            select: ROW_SELECT,
          },
        },
      },
    },
  });
};

const normalizeColumns = (columns) => (Array.isArray(columns) ? columns : []);

const normalizeLineItemMapping = (mapping) => {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    return {};
  }

  return Object.entries(mapping).reduce((result, [sourceKey, targetField]) => {
    if (
      typeof sourceKey === 'string' &&
      sourceKey.trim().length > 0 &&
      typeof targetField === 'string' &&
      LINE_ITEM_FIELD_KEYS.has(targetField)
    ) {
      result[sourceKey] = targetField;
    }

    return result;
  }, {});
};

const normalizeRows = (rows) => {
  if (!Array.isArray(rows)) return [];

  return rows.map((row, index) => ({
    id: row.id,
    rowData: row.rowData && typeof row.rowData === 'object' ? row.rowData : {},
    rowIndex: Number.isInteger(row.rowIndex) ? row.rowIndex : index,
    lineItemMapping: normalizeLineItemMapping(row.lineItemMapping),
  }));
};

const buildLineItemRecords = ({ rows, mapping, userId, uploadId, tableId, tableTitle }) => {
  const normalizedMapping = normalizeLineItemMapping(mapping);

  if (Object.keys(normalizedMapping).length === 0) {
    return [];
  }

  return rows.map((row, rowIndex) => {
    const lineItem = {
      userId,
      pdfUploadId: uploadId,
      pdfTableId: tableId,
      sourceTableTitle: tableTitle || null,
      rowSourceId: row.id || null,
      rowIndex: row.rowIndex ?? rowIndex,
    };

    Object.entries(normalizedMapping).forEach(([sourceColumn, targetField]) => {
      lineItem[targetField] = row.rowData?.[sourceColumn] ?? null;
    });

    return lineItem;
  });
};

const getLineItemFields = () => LINE_ITEM_FIELD_OPTIONS;

const getLineItemsByUpload = async (uploadId, userId) => {
  const upload = await prisma.pdfUpload.findFirst({
    where: { id: uploadId, userId, isDeleted: false },
    select: { id: true },
  });

  if (!upload) {
    throw new ApiError(404, 'Upload not found');
  }

  return prisma.lineItems.findMany({
    where: { pdfUploadId: uploadId, userId, isDeleted: false },
    orderBy: [{ sourceTableTitle: 'asc' }, { rowIndex: 'asc' }, { createdAt: 'asc' }],
    select: LINE_ITEM_SELECT,
  });
};

const syncUploadTables = async ({ uploadId, userId, tables }) => {
  return prisma.$transaction(async (tx) => {
    const upload = await tx.pdfUpload.findFirst({
      where: { id: uploadId, userId, isDeleted: false },
      select: { id: true },
    });

    if (!upload) {
      throw new ApiError(404, 'Upload not found');
    }

    const existingTables = await tx.pdfTable.findMany({
      where: { pdfUploadId: uploadId, userId, isDeleted: false },
      select: { id: true },
    });

    const existingTableIds = new Set(existingTables.map((table) => table.id));
    const incomingTableIds = new Set(
      tables
        .map((table) => table.id)
        .filter((id) => typeof id === 'string' && id.length > 0)
    );

    // Soft-delete tables missing from incoming payload.
    const tableIdsToDelete = [...existingTableIds].filter((id) => !incomingTableIds.has(id));

    if (tableIdsToDelete.length > 0) {
      await Promise.all([
        tx.pdfTable.updateMany({
          where: { id: { in: tableIdsToDelete }, pdfUploadId: uploadId, userId },
          data: { isDeleted: true },
        }),
        tx.pdfTableRow.updateMany({
          where: { pdfTableId: { in: tableIdsToDelete } },
          data: { isDeleted: true },
        }),
        tx.lineItems.updateMany({
          where: { pdfUploadId: uploadId, pdfTableId: { in: tableIdsToDelete }, userId, isDeleted: false },
          data: { isDeleted: true },
        }),
      ]);
    }

    let createdTables = 0;
    let updatedTables = 0;
    let deletedTables = tableIdsToDelete.length;
    let createdRows = 0;
    let updatedRows = 0;
    let deletedRows = 0;

    for (const incomingTable of tables) {
      const tableColumns = normalizeColumns(incomingTable.columns);
      const tableRows = normalizeRows(incomingTable.rows);
      const lineItemMapping = normalizeLineItemMapping(incomingTable.lineItemMapping);

      let tableId = incomingTable.id;

      if (tableId && existingTableIds.has(tableId)) {
        await tx.pdfTable.update({
          where: { id: tableId },
          data: {
            title: incomingTable.title || null,
            columns: tableColumns,
            lineItemColumnMapping: lineItemMapping,
            isDeleted: false,
          },
        });
        updatedTables += 1;
      } else {
        const created = await tx.pdfTable.create({
          data: {
            pdfUploadId: uploadId,
            userId,
            title: incomingTable.title || null,
            columns: tableColumns,
            lineItemColumnMapping: lineItemMapping,
          },
          select: { id: true },
        });
        tableId = created.id;
        createdTables += 1;
      }

      const existingRows = await tx.pdfTableRow.findMany({
        where: { pdfTableId: tableId, isDeleted: false },
        select: { id: true },
      });

      const existingRowIds = new Set(existingRows.map((row) => row.id));
      const incomingRowIds = new Set(
        tableRows
          .map((row) => row.id)
          .filter((id) => typeof id === 'string' && id.length > 0)
      );

      const rowIdsToDelete = [...existingRowIds].filter((id) => !incomingRowIds.has(id));

      if (rowIdsToDelete.length > 0) {
        const deleted = await tx.pdfTableRow.updateMany({
          where: { id: { in: rowIdsToDelete }, pdfTableId: tableId },
          data: { isDeleted: true },
        });
        deletedRows += deleted.count;
      }

      for (const incomingRow of tableRows) {
        if (incomingRow.id && existingRowIds.has(incomingRow.id)) {
          await tx.pdfTableRow.update({
            where: { id: incomingRow.id },
            data: {
              rowData: incomingRow.rowData,
              rowIndex: incomingRow.rowIndex,
              isDeleted: false,
            },
          });
          updatedRows += 1;
        } else {
          await tx.pdfTableRow.create({
            data: {
              pdfTableId: tableId,
              rowData: incomingRow.rowData,
              rowIndex: incomingRow.rowIndex,
            },
          });
          createdRows += 1;
        }
      }

      const createdLineItems = buildLineItemRecords({
        rows: tableRows,
        mapping: lineItemMapping,
        userId,
        uploadId,
        tableId,
        tableTitle: incomingTable.title || null,
      });

      await tx.lineItems.updateMany({
        where: { pdfUploadId: uploadId, pdfTableId: tableId, userId, isDeleted: false },
        data: { isDeleted: true },
      });

      if (createdLineItems.length > 0) {
        await tx.lineItems.createMany({
          data: createdLineItems,
        });
      }
    }

    return {
      uploadId,
      summary: {
        createdTables,
        updatedTables,
        deletedTables,
        createdRows,
        updatedRows,
        deletedRows,
      },
    };
  });
};

const softDeleteUploadById = async (uploadId, userId) => {
  return prisma.$transaction(async (tx) => {
    const upload = await tx.pdfUpload.findFirst({
      where: { id: uploadId, userId, isDeleted: false },
      select: {
        id: true,
        tables: {
          where: { isDeleted: false },
          select: { id: true },
        },
      },
    });

    if (!upload) {
      throw new ApiError(404, 'Upload not found');
    }

    const tableIds = upload.tables.map((table) => table.id);

    await tx.pdfUpload.update({
      where: { id: uploadId },
      data: { isDeleted: true },
    });

    if (tableIds.length > 0) {
      await Promise.all([
        tx.pdfTable.updateMany({
          where: { id: { in: tableIds }, pdfUploadId: uploadId, userId },
          data: { isDeleted: true },
        }),
        tx.pdfTableRow.updateMany({
          where: { pdfTableId: { in: tableIds } },
          data: { isDeleted: true },
        }),
        tx.lineItems.updateMany({
          where: { pdfUploadId: uploadId, userId },
          data: { isDeleted: true },
        }),
      ]);
    } else {
      await tx.lineItems.updateMany({
        where: { pdfUploadId: uploadId, userId },
        data: { isDeleted: true },
      });
    }

    return {
      uploadId,
      deletedTables: tableIds.length,
    };
  });
};


module.exports = {
  TABLE_SELECT,
  ROW_SELECT,
  LINE_ITEM_SELECT,
  processUploadedPdf,
  getUserUploads,
  getUploadWithTables,
  getLineItemFields,
  getLineItemsByUpload,
  syncUploadTables,
  softDeleteUploadById,
};
