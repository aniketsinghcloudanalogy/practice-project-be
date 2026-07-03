const fs = require('fs')
const { PDFParse } = require('pdf-parse')

const formatTableAsDelimitedText = (tables) => {
  return tables
    .map((table) => {
      const lines = table.map((row) =>
        row.map((cell) => (cell ?? '').toString().trim()).join(' | ')
      )
      return lines.join('\n')
    })
    .join('\n\n')
}

const extractPdfText = async (filePath) => {
  let parser

  try {
    const pdfBuffer = fs.readFileSync(filePath)
    parser = new PDFParse({ data: pdfBuffer })

    let combinedText = ''

    try {
      const tableResult = await parser.getTable()
      const allTables = (tableResult.pages || []).flatMap((page) => page.tables || [])

      if (allTables.length > 0) {
        combinedText = formatTableAsDelimitedText(allTables)
      }
    } catch (tableError) {
      console.error('Table extraction failed, falling back to plain text:', tableError.message)
    }

    if (!combinedText.trim()) {
      const pdfData = await parser.getText()
      combinedText = pdfData.text || ''
    }

    if (!combinedText.trim()) {
      throw new Error('No text found in PDF')
    }

    return combinedText.trim()
  } catch (error) {
    console.error('PDF Extraction Error:', error.message)
    throw new Error('Failed to extract text from PDF')
  } finally {
    if (parser) {
      await parser.destroy()
    }
  }
}

module.exports = {
  extractPdfText,
}