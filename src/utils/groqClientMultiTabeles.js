const axios = require('axios')
const config = require('../config')

const MAX_REQUEST_TOKENS = 11000
const TARGET_EXTRACTION_TOKENS = 5500
const MIN_EXTRACTION_TOKENS = 2000

const getGroqErrorMessage = (error) => {
  const apiMessage =
    error.response?.data?.error?.message ||
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.message

  return typeof apiMessage === 'string' ? apiMessage : 'Failed to extract data using Groq'
}

const groqClient = axios.create({
  baseURL: 'https://api.groq.com/openai/v1',
  headers: {
    Authorization: `Bearer ${config.GROQ_API_KEY}`,
    'Content-Type': 'application/json',
  },
})

const cleanJsonResponse = (content) => {
  const cleanedContent = content
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim()

  const objectStart = cleanedContent.indexOf('{')
  const objectEnd = cleanedContent.lastIndexOf('}')

  if (objectStart === -1 || objectEnd === -1 || objectEnd < objectStart) {
    throw new Error('Groq returned incomplete JSON')
  }

  return cleanedContent.slice(objectStart, objectEnd + 1)
}

const parseGroqResponse = (content, finishReason) => {
  if (finishReason === 'length') {
    throw new Error('Groq output was truncated before extraction completed')
  }

  const cleanedContent = cleanJsonResponse(content)

  try {
    return JSON.parse(cleanedContent)
  } catch (error) {
    console.error('Groq JSON Parse Error:', {
      message: error.message,
      finishReason,
      responseLength: content.length,
    })

    throw new Error('Groq returned invalid extracted data JSON')
  }
}

const getCompletionTokenBudget = (messages) => {
  const promptCharacters = messages.reduce(
    (total, message) => total + message.content.length,
    0
  )
  const estimatedPromptTokens = Math.ceil(promptCharacters / 3) + 500
  const availableTokens = MAX_REQUEST_TOKENS - estimatedPromptTokens

  if (availableTokens < MIN_EXTRACTION_TOKENS) {
    throw new Error('PDF text is too large to extract in a single Groq request')
  }

  return Math.min(
    Math.max(config.GROQ_MAX_TOKENS, TARGET_EXTRACTION_TOKENS),
    availableTokens
  )
}

const extractWithGroq = async (pdfText) => {
  try {
    if (!config.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured')
    }

    const messages = [
      {
        role: 'system',
        content: `
You are an AI PDF table extraction engine.

Your task is to identify and extract ALL tabular data from the provided PDF text.

Rules:

1. Return ONLY valid JSON.
2. Do not return markdown.
3. Do not return explanations.
4. Do not wrap the response in code blocks.
5. Extract every table found in the document.
6. Preserve all rows and columns.
7. Do not merge tables.
8. Keep each detected table as a separate object in the tables array.
9. Generate clean camelCase keys from column headers.
10. Preserve original column titles in the title field.
11. Ensure every row in a table contains the exact same set of keys.
12. If a value is missing, use null.
13. Keep numbers as numbers whenever possible.
14. Keep dates as strings.
15. Trim unnecessary whitespace.
16. Ignore page headers, footers, page numbers, and decorative text unless they belong to a table.
17. Do not invent rows or columns.
18. Do not summarize data.
19. If a table has no title, generate:
    - Table 1
    - Table 2
    - Table 3
20. Preserve table order exactly as it appears in the PDF.
21. Determine dataType for each column using:
    - string
    - number
    - boolean
    - date
22. Return compact JSON only.
23. If no tables are found return:
24. Column keys must be unique within a table.
25. If duplicate column names exist, generate unique camelCase keys.
26. CRITICAL — column count validation: the number of columns in a table MUST exactly equal the number of distinct values in each data row. If a header line and a data line both contain multiple space-separated words, do NOT assume header words map 1:1 to "natural" column boundaries. Instead, infer column boundaries by counting how many discrete values exist in the data rows, then split the header into that same number of segments.
27. Example: header text "Part Description Qty Unit Amount" with a data row "SSD 1TB NVMe SSD 15 85 1275" has 4 numeric/short trailing values (15, 85, 1275 are 3 values, plus the leading text segment) — there are 4 columns total: a part identifier, a description, a quantity, a unit price, and an amount. Count tokens in EVERY data row for a table before finalizing how many columns that table has, and never produce a table where any row's value count doesn't match the column count.
28. Do not silently fuse two header words into one column key unless every row in that table has a single combined value occupying that position.
{
  "tables": []
}

Return JSON in exactly this format:

{
  "tables": [
    {
      "title": "Employees",
      "columns": [
        {
          "title": "Employee ID",
          "key": "employeeId",
          "dataType": "string"
        },
        {
          "title": "Name",
          "key": "name",
          "dataType": "string"
        },
        {
          "title": "Age",
          "key": "age",
          "dataType": "number"
        }
      ],
      "rows": [
        {
          "employeeId": "E001",
          "name": "John",
          "age": 25
        }
      ]
    }
  ]
}
`
      },
      {
        role: 'user',
        content: `
Extract structured table data from this PDF text:

${pdfText}
          `,
      },
    ]

    const response = await groqClient.post('/chat/completions', {
      model: config.GROQ_MODEL,
      messages,
      temperature: 0,
      response_format: {
        type: 'json_object',
      },
      max_tokens: getCompletionTokenBudget(messages),
    })

    const choice = response.data?.choices?.[0]
    const content = choice?.message?.content

    if (!content) {
      throw new Error('Empty response from Groq')
    }

    const parsedResponse = parseGroqResponse(content, choice.finish_reason)

    if (
      !parsedResponse ||
      !Array.isArray(parsedResponse.tables)
    ) {
      throw new Error('Invalid response structure from Groq')
    }

    return parsedResponse
  } catch (error) {
    const groqStatus = error.response?.status
    const groqMessage = getGroqErrorMessage(error)

    console.error('Groq API Error:', {
      status: groqStatus,
      message: groqMessage,
    })

    const groqError = new Error(groqMessage)
    groqError.statusCode = groqStatus
    throw groqError
  }
}

const normalizeColumnDef = (col) => {
  if (typeof col === 'string') {
    const trimmed = col.trim();
    return { title: trimmed, key: trimmed, dataType: 'string' };
  }
  const key = col?.key || col?.title || col?.name;
  if (!key) return null;
  return {
    title: col.title || key,
    key: String(key).trim(),
    dataType: col.dataType || 'string',
  };
};

const mergeExtractedTables = (tables = []) => {
  if (!Array.isArray(tables) || tables.length === 0) {
    return { title: 'Merged Table', columns: [], rows: [] };
  }
  if (tables.length === 1) return tables[0];

  const columnsByIdentity = new Map();

  for (const table of tables) {
    for (const rawCol of table.columns || []) {
      const col = normalizeColumnDef(rawCol);
      if (!col) continue;
      const identity = col.key.toLowerCase();
      if (!columnsByIdentity.has(identity)) {
        columnsByIdentity.set(identity, col);
      }
    }
  }

  const mergedColumns = Array.from(columnsByIdentity.values());

  const mergedRows = [];
  for (const table of tables) {
    for (const row of table.rows || []) {
      const mergedRow = {};
      for (const col of mergedColumns) {
        const matchKey = Object.keys(row).find((k) => k.toLowerCase() === col.key.toLowerCase());
        mergedRow[col.key] = matchKey !== undefined ? row[matchKey] : null;
      }
      mergedRows.push(mergedRow);
    }
  }

  return {
    title: tables.map((t) => t.title).filter(Boolean).join(' + ') || 'Merged Table',
    columns: mergedColumns,
    rows: mergedRows,
  };
};

module.exports = { extractWithGroq, mergeExtractedTables };

