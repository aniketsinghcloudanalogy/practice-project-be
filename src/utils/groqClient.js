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
You are a PDF data extraction engine.

Your task is to identify and extract structured tabular data from the provided PDF text.

Rules:
1. Return ONLY valid JSON.
2. Do not return markdown.
3. Do not return explanations.
4. Do not wrap the response in code blocks.
5. Preserve all rows and columns found in the data.
6. Generate meaningful camelCase keys from detected column names.
7. Use null for missing values.
8. Keep numeric values as numbers whenever possible.
9. Keep dates as strings.
10. Ensure every row contains the same set of keys for its own table.
11. If multiple tables exist, return each table separately inside the tables array.
12. Do not merge different tables.
13. If no tabular data exists, return { "tables": [] }.
14. Return compact JSON without indentation or unnecessary whitespace.

Return JSON in exactly this format:

{
  "tables": [
    {
      "title": "Table 1",
      "columns": [
        {
          "title": "Column Name",
          "key": "columnName",
          "dataType": "string"
        }
      ],
      "rows": [
        {
          "columnName": "value"
        }
      ]
    }
  ]
}
          `,
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

module.exports = {
  extractWithGroq,
}