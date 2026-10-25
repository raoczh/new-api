/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/**
 * Generated pages run in an opaque-origin sandbox (no allow-same-origin), and
 * this policy additionally blocks every network request so a page cannot load
 * remote resources or send data anywhere.
 */
export const IQ_PREVIEW_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:"

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${IQ_PREVIEW_CSP}">`

/**
 * Builds the srcdoc for a generated page. The CSP meta must be the first
 * element of <head> to apply before any generated script or style runs.
 */
export function buildSandboxedDocument(html: string): string {
  const headMatch = /<head(\s[^>]*)?>/i.exec(html)
  if (headMatch) {
    const end = headMatch.index + headMatch[0].length
    return html.slice(0, end) + CSP_META + html.slice(end)
  }
  const htmlMatch = /<html(\s[^>]*)?>/i.exec(html)
  if (htmlMatch) {
    const end = htmlMatch.index + htmlMatch[0].length
    return `${html.slice(0, end)}<head>${CSP_META}</head>${html.slice(end)}`
  }
  return `<!DOCTYPE html><html><head>${CSP_META}<meta charset="utf-8"><style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:#fff}svg{max-width:100%;max-height:100%}</style></head><body>${html}</body></html>`
}

export function parseVerdictReasons(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}
