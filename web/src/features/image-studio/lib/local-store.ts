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
import type { ImageStudioTask, LocalImageStudioRecord } from '../types'

const DB_NAME = 'new-api-image-studio'
const DB_VERSION = 1
const STORE = 'records'
const INDEX_OWNER = 'owner'
const RECORD_VERSION = 1

/**
 * Records the workbench reads back when the server cannot answer. Everything
 * here is best effort: a missing IndexedDB (private mode, desktop shell) or a
 * quota failure must never break generation, so every call resolves quietly.
 */
function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (db.objectStoreNames.contains(STORE)) return
      const store = db.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex(INDEX_OWNER, 'owner', { unique: false })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

function collect<T>(request: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

export async function saveLocalRecords(
  owner: string,
  tasks: ImageStudioTask[]
): Promise<void> {
  if (!owner || tasks.length === 0) return
  const db = await openDatabase()
  if (!db) return
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const savedAt = Date.now()
    for (const task of tasks) {
      const record: LocalImageStudioRecord = {
        id: task.id,
        owner,
        saved_at: savedAt,
        version: RECORD_VERSION,
        task,
      }
      store.put(record)
    }
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    })
  } finally {
    db.close()
  }
}

/**
 * Newest first. Rows with a different shape version, an expired retention
 * window or a foreign owner are dropped instead of being handed to the UI.
 */
export async function readLocalRecords(
  owner: string,
  retentionDays: number
): Promise<ImageStudioTask[]> {
  if (!owner) return []
  const db = await openDatabase()
  if (!db) return []
  try {
    const tx = db.transaction(STORE, 'readonly')
    const rows = await collect<LocalImageStudioRecord[]>(
      tx.objectStore(STORE).index(INDEX_OWNER).getAll(owner)
    )
    if (!rows) return []
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
    return rows
      .filter((row) => {
        if (row.version !== RECORD_VERSION || !row.task) return false
        if (row.task.status === 'expired') return false
        return row.task.created_at >= cutoff
      })
      .sort((a, b) => b.task.created_at - a.task.created_at)
      .map((row) => row.task)
  } finally {
    db.close()
  }
}

export async function removeLocalRecords(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await openDatabase()
  if (!db) return
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const id of ids) store.delete(id)
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    })
  } finally {
    db.close()
  }
}
