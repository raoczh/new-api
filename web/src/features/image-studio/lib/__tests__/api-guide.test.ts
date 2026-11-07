import { createInstance } from 'i18next'
import { expect, test } from 'vitest'

import { buildImageApiEndpoints, buildImageApiSample } from '../api-guide'

const t = createInstance().t
const endpoints = buildImageApiEndpoints(t)
const [gemini, chat, edits] = endpoints

test('a multipart cURL sample uploads @files and sends URL values as literal strings', () => {
  const [fileExample, urlExample] = edits.examples
  expect([gemini.id, chat.id, edits.id]).toEqual(['gemini', 'chat', 'edits'])
  expect([fileExample.id, urlExample.id]).toEqual(['basic', 'url'])

  const urlSample = buildImageApiSample(
    edits,
    urlExample,
    'curl',
    'https://api.example.com/'
  )
  const fileSample = buildImageApiSample(
    edits,
    fileExample,
    'curl',
    'https://api.example.com'
  )

  expect(urlSample).toContain('"https://api.example.com/v1/images/edits"')
  expect(urlSample).toContain(
    "--form-string 'image=https://media.example.com/reference.png'"
  )
  expect(fileSample).toContain("-F 'image=@reference.png'")
  expect(fileSample).not.toContain('Content-Type: application/json')
})

test('a Python JSON sample uses Python literals and the Gemini path model', () => {
  const chatSample = buildImageApiSample(
    chat,
    chat.examples[0],
    'python',
    'https://api.example.com'
  )
  const geminiSample = buildImageApiSample(
    gemini,
    gemini.examples[0],
    'curl',
    'https://api.example.com'
  )

  expect(chatSample).toContain('"stream": False')
  expect(chatSample).not.toContain('false')
  expect(geminiSample).toContain(
    '/v1beta/models/gemini-3-pro-image-preview:generateContent'
  )
})
