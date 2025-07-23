    // frontend/src/utils/indexedDb.js

    const DB_NAME = 'production_app_db'; // Main database name
    const DB_VERSION = 2; // Increment version if you change object stores
    const STORE_NAME_SYNC_QUEUE = 'production_sync_queue'; // Store for offline changes
    const STORE_NAME_CACHE = 'production_records'; // Store for cached production data

    let db; // Variable to hold the database instance

    /**
     * Opens the IndexedDB database and creates object stores if they don't exist.
     * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
     */
    function openDatabase() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const dbInstance = event.target.result;
          console.log('IndexedDB: Upgrade needed for version', event.oldVersion, 'to', event.newVersion);

          // Create or upgrade the sync queue store
          if (!dbInstance.objectStoreNames.contains(STORE_NAME_SYNC_QUEUE)) {
            dbInstance.createObjectStore(STORE_NAME_SYNC_QUEUE, { keyPath: 'id' });
            console.log(`IndexedDB: Object store '${STORE_NAME_SYNC_QUEUE}' created.`);
          }

          // Create or upgrade the main cache store
          if (!dbInstance.objectStoreNames.contains(STORE_NAME_CACHE)) {
            dbInstance.createObjectStore(STORE_NAME_CACHE, { keyPath: 'id' });
            console.log(`IndexedDB: Object store '${STORE_NAME_CACHE}' created.`);
          }
        };

        request.onsuccess = (event) => {
          db = event.target.result;
          console.log('IndexedDB: Database opened successfully.');
          resolve(db);
        };

        request.onerror = (event) => {
          console.error('IndexedDB: Database error:', event.target.error);
          reject(event.target.error);
        };
      });
    }

    /**
     * Gets the database instance, opening it if it's not already open.
     * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
     */
    async function getDb() {
      if (!db) {
        db = await openDatabase();
      }
      return db;
    }

    // --- Sync Queue Operations (for offline changes) ---

    /**
     * Adds a record to the synchronization queue.
     * @param {object} record - The record data to store.
     * @returns {Promise<object>} A promise that resolves with the added record (including its ID).
     */
    export async function addRecordToSyncQueue(record) {
      const database = await getDb();
      const tx = database.transaction(STORE_NAME_SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_NAME_SYNC_QUEUE);

      // Ensure a unique client-side ID for new records
      const recordWithId = { ...record };
      if (!recordWithId.id) {
        recordWithId.id = `offline-${crypto.randomUUID()}`;
      }
      // Add a timestamp for ordering/tracking
      recordWithId.timestamp = Date.now();

      return new Promise((resolve, reject) => {
        const request = store.put(recordWithId); // Use put to overwrite if ID exists (e.g., re-queue)
        request.onsuccess = () => {
          console.log('IndexedDB: Record added to sync queue:', recordWithId);
          resolve(recordWithId);
        };
        request.onerror = (event) => {
          console.error('IndexedDB: Error adding record to sync queue:', event.target.error);
          reject(event.target.error);
        };
      });
    }

    /**
     * Retrieves all records from the synchronization queue.
     * @returns {Promise<Array<object>>} A promise that resolves with an array of records.
     */
    export async function getRecordsFromSyncQueue() {
      const database = await getDb();
      const tx = database.transaction(STORE_NAME_SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORE_NAME_SYNC_QUEUE);
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          console.log('IndexedDB: Retrieved records from sync queue.');
          resolve(request.result);
        };
        request.onerror = (event) => {
          console.error('IndexedDB: Error retrieving records from sync queue:', event.target.error);
          reject(event.target.error);
        };
      });
    }

    /**
     * Deletes a record from the synchronization queue by its ID.
     * @param {string} id - The ID of the record to delete.
     * @returns {Promise<void>} A promise that resolves when the record is deleted.
     */
    export async function deleteRecordFromSyncQueue(id) {
      const database = await getDb();
      const tx = database.transaction(STORE_NAME_SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_NAME_SYNC_QUEUE);
      return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => {
          console.log('IndexedDB: Record deleted from sync queue:', id);
          resolve();
        };
        request.onerror = (event) => {
          console.error('IndexedDB: Error deleting record from sync queue:', event.target.error);
          reject(event.target.error);
        };
      });
    }

    // --- Main Data Cache Operations (for general production data) ---

    /**
     * Puts (adds or updates) multiple records into the main production records cache.
     * This typically replaces the entire cached dataset with fresh data from the network.
     * @param {Array<object>} records - An array of records to store.
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     */
    export async function putRecords(records) {
      const database = await getDb();
      const tx = database.transaction(STORE_NAME_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_NAME_CACHE);

      // Clear existing records before adding new ones to ensure cache is fresh
      await new Promise((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
          console.log('IndexedDB: Main cache cleared.');
          resolve();
        };
        clearRequest.onerror = (event) => {
          console.error('IndexedDB: Error clearing main cache:', event.target.error);
          reject(event.target.error);
        };
      });

      // Add new records
      const addPromises = records.map(record => {
        return new Promise((resolve, reject) => {
          const request = store.put(record);
          request.onsuccess = () => resolve();
          request.onerror = (event) => {
            console.error('IndexedDB: Error putting record into main cache:', event.target.error);
            reject(event.target.error);
          };
        });
      });

      return Promise.all(addPromises).then(() => {
        console.log(`IndexedDB: ${records.length} records put successfully into main cache.`);
      }).catch(error => {
        console.error('IndexedDB: One or more records failed to put into main cache:', error);
        throw error;
      });
    }

    /**
     * Retrieves all records from the main production records cache.
     * @returns {Promise<Array<object>>} A promise that resolves with an array of records.
     */
    export async function getRecords() {
      const database = await getDb();
      const tx = database.transaction(STORE_NAME_CACHE, 'readonly');
      const store = tx.objectStore(STORE_NAME_CACHE);
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          console.log('IndexedDB: Retrieved records from main cache.');
          resolve(request.result);
        };
        request.onerror = (event) => {
          console.error('IndexedDB: Error retrieving records from main cache:', event.target.error);
          reject(event.target.error);
        };
      });
    }

    /**
     * Clears all records from the main production records cache.
     * @returns {Promise<void>} A promise that resolves when the cache is cleared.
     */
    export async function clearRecords() {
      const database = await getDb();
      const tx = database.transaction(STORE_NAME_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_NAME_CACHE);
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => {
          console.log('IndexedDB: Main cache cleared successfully.');
          resolve();
        };
        request.onerror = (event) => {
          console.error('IndexedDB: Error clearing main cache:', event.target.error);
          reject(event.target.error);
        };
      });
    }
    