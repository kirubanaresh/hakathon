// frontend/src/utils/offlineAdditions.js
import { openDB } from 'idb';

// Open (or create) IndexedDB database for offline additions
async function getDB() {
  return openDB('ProductionDB', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('offline_additions')) {
        db.createObjectStore('offline_additions', { keyPath: 'local_id', autoIncrement: true });
      }
    },
  });
}

// Add a record to offline queue
export async function putOfflineAddition(record) {
  const db = await getDB();
  await db.add('offline_additions', { ...record, synced: false, created_at: new Date().toISOString() });
}

// Get all unsynced records
export async function getOfflineAdditions() {
  const db = await getDB();
  return await db.getAll('offline_additions');
}

// Remove a record after sync
export async function removeOfflineAddition(localId) {
  const db = await getDB();
  await db.delete('offline_additions', localId);
}
