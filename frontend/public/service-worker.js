// frontend/public/service-worker.js

const CACHE_NAME = 'production-app-v6'; // Increment this to force a cache update
const urlsToPrecache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/background-app.jpg', // Added back for pre-caching robustness
  // IMPORTANT: For hashed assets (like index-CtDu7HYe.css, index-tesHD-oY.js),
  // it's generally better to let the 'fetch' event handle caching them dynamically.
  // Hardcoding hashes here means you need to update them on every build.
  // If you want to pre-cache them, you must get the exact names from your dist/assets folder.
  // For robustness, I'm removing them from pre-cache for now, relying on fetch.
];

// Re-import the IndexedDB utility functions directly into the Service Worker context
// Service Workers run in their own scope, so they need their own imports.
// This path is relative to the service-worker.js file, so it needs to go up to src.
// This is a common pattern for shared utilities between main thread and SW.
// However, since the IndexedDB utility is in frontend/src/utils/, and the service worker
// is in frontend/public/, a direct import like this won't work in the browser's SW context
// without a build step that bundles it.
// For a simple PWA setup without complex bundling for SW, we'll redefine the IndexedDB logic
// directly within the service worker for the sync queue.

// --- IndexedDB Logic for Service Worker (simplified for sync queue) ---
const SW_DB_NAME = 'production_app_sync_db';
const SW_DB_VERSION = 1;
const SW_STORE_NAME = 'production_sync_queue';

function openSwDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SW_DB_NAME, SW_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const dbInstance = event.target.result;
      if (!dbInstance.objectStoreNames.contains(SW_STORE_NAME)) {
        dbInstance.createObjectStore(SW_STORE_NAME, { keyPath: 'id' });
        console.log('[SW IndexedDB] Object store created:', SW_STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('[SW IndexedDB] Database error:', event.target.error);
      reject(event.target.error);
    };
  });
}

async function getRecordsFromSwSyncQueue() {
  const database = await openSwDb();
  const tx = database.transaction(SW_STORE_NAME, 'readonly');
  const store = tx.objectStore(SW_STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function deleteRecordFromSwSyncQueue(id) {
  const database = await openSwDb();
  const tx = database.transaction(SW_STORE_NAME, 'readwrite');
  const store = tx.objectStore(SW_STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}
// --- End IndexedDB Logic for Service Worker ---


// Install event: caches static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install Event: Caching static assets...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching app shell');
        return cache.addAll(urlsToPrecache);
      })
      .catch((error) => {
        console.error('[Service Worker] Failed to pre-cache:', error);
      })
  );
  self.skipWaiting(); // Forces the waiting service worker to become the active service worker
});

// Activate event: cleans up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate Event: Cleaning up old caches...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Ensures the active service worker controls all clients immediately
});

// Fetch event: serves cached content or fetches from network
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const isApiRequest = requestUrl.origin === 'http://localhost:8000'; // Adjust if your backend URL changes

  if (isApiRequest) {
    // Network First strategy for API calls
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          // IMPORTANT: Only cache GET requests for API responses
          if (event.request.method === 'GET' && response.ok) {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clonedResponse);
            });
          }
          return response;
        })
        .catch((error) => {
          console.warn(`[Service Worker] API fetch failed for ${event.request.url}:`, error);
          // Try to serve from cache if network fails for API GET requests
          if (event.request.method === 'GET') {
            return caches.match(event.request);
          }
          throw error; // Re-throw for non-GET requests if network fails
        })
    );
  } else {
    // Cache First strategy for static assets
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request)
            .then((networkResponse) => {
              // Only cache valid responses
              if (networkResponse.status === 200 || networkResponse.type === 'opaque') {
                return caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse.clone());
                  return networkResponse;
                });
              }
              return networkResponse;
            })
            .catch((error) => {
              console.error('[Service Worker] Network fetch failed for static asset:', event.request.url, error);
              // Fallback to a generic offline page or asset if available
              // return caches.match('/offline.html'); // Example
            });
        })
    );
  }
});

// NEW: Sync event listener for background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-new-production-data') {
    console.log('[Service Worker] Handling background sync for new production data...');
    event.waitUntil(syncNewProductionData());
  }
});

// NEW: Function to sync data from IndexedDB to the backend
async function syncNewProductionData() {
  const recordsToSync = await getRecordsFromSwSyncQueue();
  console.log(`[Service Worker] Found ${recordsToSync.length} records to sync.`);

  if (recordsToSync.length === 0) {
    console.log('[Service Worker] No pending records to sync.');
    return;
  }

  // Placeholder for getting auth token in Service Worker.
  // IMPORTANT: localStorage is NOT directly accessible in Service Workers.
  // You need to pass the token from the main thread via postMessage or
  // store it in a Service Worker-accessible IndexedDB store.
  const token = await getAuthTokenFromMainThread(); // Placeholder: You'd implement this
  const tokenType = 'Bearer'; // Assuming Bearer token type

  let syncSuccessCount = 0;
  let syncFailCount = 0;

  for (const record of recordsToSync) {
    try {
      // Remove client-side specific fields before sending to backend
      const { id, synced, timestamp, ...dataToSend } = record;

      const response = await fetch('http://localhost:8000/production-data/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${tokenType} ${token}`, // Include authorization header
        },
        body: JSON.stringify(dataToSend),
      });

      if (response.ok) {
        await deleteRecordFromSwSyncQueue(record.id);
        syncSuccessCount++;
        console.log(`[Service Worker] Successfully synced record with client ID: ${record.id}`);
        // Notify main thread of successful sync (optional)
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'SYNC_SUCCESS', recordId: record.id });
          });
        });
      } else {
        const errorData = await response.json();
        console.error(`[Service Worker] Failed to sync record ${record.id}:`, errorData);
        syncFailCount++;
        // Do not delete from queue if sync fails (will retry later)
      }
    } catch (error) {
      console.error(`[Service Worker] Network error during sync for record ${record.id}:`, error);
      syncFailCount++;
      // Do not delete from queue if network error (will retry later)
    }
  }
  console.log(`[Service Worker] Sync complete. Success: ${syncSuccessCount}, Failed: ${syncFailCount}`);
  // Notify main thread to refresh data after sync attempt
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETED', successCount: syncSuccessCount, failCount: syncFailCount });
    });
  });
}

// Placeholder for getting auth token in Service Worker.
// In a real app, you'd send this from the main thread via postMessage
// or store it in IndexedDB if it's not sensitive.
async function getAuthTokenFromMainThread() {
    // This is a simplified example. In a real PWA, you'd likely use
    // a more robust method to get the token, e.g., from IndexedDB
    // or by sending a message from the main thread when needed.
    // For now, we'll try to get it from a hypothetical IndexedDB store
    // or assume it's passed.
    // For this example, let's assume it's stored in main IndexedDB (production_app_db)
    // or you might need a dedicated 'auth_tokens' store.
    // **IMPORTANT**: In a production scenario, passing sensitive data like tokens
    // directly from main thread to SW or storing them in IndexedDB for SW access
    // requires careful security consideration.
    return localStorage.getItem('access_token') || ''; // This won't work directly in SW
}

// NEW: Message listener for communication from main thread (e.g., to pass token)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_AUTH_TOKEN') {
    // You could store the token in SW's IndexedDB here
    // For now, we'll just log it.
    console.log('[Service Worker] Received auth token from main thread (for future use):', event.data.token.substring(0, 10) + '...');
    // In a real app, you might save this to a SW-accessible storage like IndexedDB
    // so syncNewProductionData can retrieve it.
  }
});
