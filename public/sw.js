/* eslint-disable no-restricted-globals, no-console */
/* globals clients */

// Mantener el service worker activo
self.addEventListener('install', () => {
  console.log('Service Worker instalado');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker activado');
  event.waitUntil(clients.claim());
});

// Manejo de notificaciones push
self.addEventListener('push', event => {
  let notification = event.data && event.data.json();

  event.waitUntil(
    self.registration.showNotification(notification.title, {
      tag: notification.tag,
      body: notification.body || '',
      icon: notification.icon || '/android-icon-192x192.png',
      badge: notification.badge || '/android-icon-96x96.png',
      data: {
        url: notification.url,
      },
      requireInteraction: false,
      silent: false,
    })
  );
});

self.addEventListener('notificationclick', event => {
  let notification = event.notification;
  notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        let matchingWindowClients = windowClients.filter(
          client => client.url === notification.data.url
        );

        if (matchingWindowClients.length) {
          let firstWindow = matchingWindowClients[0];
          if (firstWindow && 'focus' in firstWindow) {
            return firstWindow.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(notification.data.url);
        }
        return null;
      })
  );
});

// Mantener conexión activa - responder a mensajes desde la página
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'KEEP_ALIVE') {
    // Responder para mantener el SW activo
    event.ports[0].postMessage({ type: 'ALIVE' });
  }
});

// Funciones auxiliares para sync
async function syncNotifications() {
  try {
    // Intentar reconectar o sincronizar notificaciones pendientes
    console.log('Sincronizando notificaciones...');
  } catch (error) {
    console.error('Error al sincronizar:', error);
  }
}

async function checkForNewNotifications() {
  try {
    // Verificar nuevas notificaciones periódicamente
    console.log('Verificando notificaciones en segundo plano...');
  } catch (error) {
    console.error('Error en periodic sync:', error);
  }
}

// Background Sync para notificaciones offline
self.addEventListener('sync', event => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

// Periodic Background Sync (si está disponible) - mantiene la app conectada
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkForNewNotifications());
  }
});

// Estrategia de caché selectiva para mantener la app funcionando offline
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo cachear requests GET
  if (request.method !== 'GET') return;

  // NO interceptar peticiones a:
  // - APIs externas de push/notificaciones
  // - chrome-extension://
  // - Requests que no sean del mismo origen (evita loop)
  if (
    url.protocol === 'chrome-extension:' ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    request.cache === 'only-if-cached' ||
    request.url.includes('/cable') || // ActionCable WebSockets
    (request.url.includes('/api/v1/accounts/') &&
      request.url.includes('/notification_subscriptions'))
  ) {
    return;
  }

  // Solo cachear recursos estáticos del mismo origen
  const isStaticAsset =
    /\.(js|css|png|jpg|jpeg|svg|ico|webp|woff|woff2|ttf|eot)$/i.test(
      url.pathname
    );

  if (!isStaticAsset) {
    // Para contenido dinámico (HTML, API), no usar caché
    return;
  }

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      // Si está en caché, devolverlo
      if (cachedResponse) {
        return cachedResponse;
      }

      // Si no está en caché, hacer fetch y cachear solo recursos estáticos
      return fetch(request)
        .then(response => {
          // Solo cachear respuestas válidas
          if (
            !response ||
            response.status !== 200 ||
            response.type !== 'basic'
          ) {
            return response;
          }

          // Cachear la respuesta
          const responseToCache = response.clone();
          caches.open('chatwoot-static-v1').then(cache => {
            cache.put(request, responseToCache);
          });

          return response;
        })
        .catch(error => {
          console.error('Fetch failed:', error);
          throw error;
        });
    })
  );
});
