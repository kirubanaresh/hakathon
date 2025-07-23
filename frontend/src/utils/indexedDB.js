// frontend/src/utils/indexedDB.js

const DB_NAME = 'production_app_db';
const DB_VERSION = 1;
const OBJECT_STORE_NAME = 'production_records';

/**
 * Opens the IndexedDB database.
 * Creates the object store if it doesn't exist.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
 */
export const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
        db.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'id' });
        console.log(`IndexedDB: Object store '${OBJECT_STORE_NAME}' created.`);
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      console.log('IndexedDB: Database opened successfully.');
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('IndexedDB: Database error:', event.target.error);
      reject(event.target.error);
    };
  });
};

/**
 * Adds or updates a record in the IndexedDB object store.
 * @param {Array<Object>} records - An array of records to store. Each record must have an 'id' property.
 * @returns {Promise<void>} A promise that resolves when the records are stored.
 */
export const putRecords = async (records) => { // Ensure 'export' keyword is present
  const db = await openDB();
  const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(OBJECT_STORE_NAME);

  return new Promise((resolve, reject) => {
    let putCount = 0;
    // Check if records is an array, if not, make it one for consistency
    const recordsArray = Array.isArray(records) ? records : [records];

    if (recordsArray.length === 0) {
      resolve(); // Nothing to put
      return;
    }

    recordsArray.forEach(record => {
      const request = store.put(record); // put() adds or updates
      request.onsuccess = () => {
        putCount++;
        if (putCount === recordsArray.length) {
          console.log(`IndexedDB: ${recordsArray.length} records put successfully.`);
          resolve();
        }
      };
      request.onerror = (event) => {
        console.error('IndexedDB: Error putting record:', event.target.error);
        reject(event.target.error);
      };
    });

    // Handle transaction completion (important for ensuring all ops are done)
    transaction.oncomplete = () => {
      console.log('IndexedDB: Transaction completed.');
      // Resolve here if all individual puts are successful and transaction completes
      // This resolve might be redundant if the loop's resolve is hit first,
      // but it's good for robustness, especially for empty arrays or single puts.
      resolve();
    };
    transaction.onerror = (event) => {
      console.error('IndexedDB: Transaction error:', event.target.error);
      reject(event.target.error);
    };
  });
};

/**
 * Retrieves all records from the IndexedDB object store.
 * @returns {Promise<Array<Object>>} A promise that resolves with an array of all records.
 */
export const getRecords = async () => { // Ensure 'export' keyword is present
  const db = await openDB();
  const transaction = db.transaction(OBJECT_STORE_NAME, 'readonly');
  const store = transaction.objectStore(OBJECT_STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.getAll();

    request.onsuccess = (event) => {
      const records = event.target.result;
      console.log(`IndexedDB: Retrieved ${records.length} records.`);
      resolve(records);
    };

    request.onerror = (event) => {
      console.error('IndexedDB: Error getting records:', event.target.error);
      reject(event.target.error);
    };
  });
};

/**
 * Clears all records from the IndexedDB object store.
 * @returns {Promise<void>} A promise that resolves when the store is cleared.
 */
export const clearRecords = async () => { // Ensure 'export' keyword is present
  const db = await openDB();
  const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(OBJECT_STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.clear();

    request.onsuccess = () => {
      console.log('IndexedDB: Object store cleared.');
      resolve();
    };

    request.onerror = (event) => {
      console.error('IndexedDB: Error clearing object store:', event.target.error);
      reject(event.target.error);
    };
  });
};
