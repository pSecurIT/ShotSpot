/* eslint-disable no-restricted-globals */
// ShotSpot Service Worker for Offline Support
// This service worker enables the app to work offline by caching assets and API responses

/* eslint-env serviceworker */
/* global self, caches, fetch */

const CACHE_NAME = 'shotspot-static-v1';
const API_CACHE_NAME = 'shotspot-api-v1';
const NAVIGATION_CACHE_NAME = 'shotspot-navigation-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html'
];

// API endpoints that should be cached
const CACHEABLE_API_PREFIXES = [
  '/api/teams',
  '/api/players',
  '/api/games',
  '/api/timer',
  '/api/auth/me',
  '/api/reports',
  '/api/competitions',
  '/api/series'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME && cacheName !== NAVIGATION_CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - network-first strategy with fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(handleStaticAsset(request));
});

/**
 * Handle API requests with network-first strategy
 * Falls back to cache if offline or backend unavailable
 */
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const canCache = shouldCacheApiEndpoint(url.pathname);
  const cache = await caches.open(API_CACHE_NAME);

  if (canCache) {
    const cachedResponse = await cache.match(request);
    const networkPromise = fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      })
      .catch(() => null);

    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await networkPromise;
    if (networkResponse) {
      return networkResponse;
    }
  }
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses for GET requests
    if (networkResponse.ok && canCache) {
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    // If backend returns 503, CORS error, or 500+ error, try cache
    if (networkResponse.status >= 500 || networkResponse.status === 0) {
      console.log('[Service Worker] Backend unavailable (status: ' + networkResponse.status + '), trying cache:', url.pathname);
      const cachedResponse = await caches.match(request);
      
      if (cachedResponse) {
        console.log('[Service Worker] Serving from cache due to backend error:', url.pathname);
        return cachedResponse;
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network request failed, trying cache:', url.pathname);
    
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[Service Worker] Serving from cache:', url.pathname);
      return cachedResponse;
    }
    
    // If no cache, return offline response
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'No network connection and no cached data available',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function handleNavigationRequest(request) {
  const cache = await caches.open(NAVIGATION_CACHE_NAME);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      cache.put('/index.html', networkResponse.clone());
    }

    return networkResponse;
  } catch {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const shellResponse = await cache.match('/index.html');
    if (shellResponse) {
      return shellResponse;
    }

    return new Response('Offline - Navigation shell not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Handle static assets with cache-first strategy
 * Falls back to network if not in cache
 */
async function handleStaticAsset(request) {
  // Try cache first
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // If not in cache, fetch from network and cache
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok && shouldCacheStaticRequest(new URL(request.url).pathname)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Failed to fetch asset:', request.url);
    
    // Return offline page or error response
    return new Response('Offline - Asset not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Check if an API endpoint should be cached
 */
function shouldCacheApiEndpoint(pathname) {
  return CACHEABLE_API_PREFIXES.some(endpoint => pathname.startsWith(endpoint));
}

function shouldCacheStaticRequest(pathname) {
  if (pathname.startsWith('/assets/')) {
    return true;
  }

  return /\.(css|js|png|jpg|jpeg|webp|gif|svg)$/i.test(pathname);
}

// Listen for messages from the client
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

// Background sync for queued actions
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

/**
 * Sync offline actions when connection is restored
 */
async function syncOfflineActions() {
  console.log('[Service Worker] Syncing offline actions...');
  
  try {
    // Notify all clients that sync is starting
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_START'
      });
    });
    
    // The actual sync will be handled by the client-side code
    // This just triggers the sync process
    
    return Promise.resolve();
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
    return Promise.reject(error);
  }
}

console.log('[Service Worker] Loaded');
