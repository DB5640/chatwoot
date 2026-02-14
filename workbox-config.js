module.exports = {
  globDirectory: 'public/',
  globPatterns: [
    '**/*.{png,ico,jpg,jpeg,svg,webp}',
    '**/*.{js,css,html}',
    'manifest.json',
  ],
  swDest: 'public/sw.js',
  // Configuración para mantener conexión en segundo plano
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año
        },
      },
    },
    {
      urlPattern: /\.(?:js|css)$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-resources',
      },
    },
    {
      urlPattern: /^\/api\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 5 * 60, // 5 minutos
        },
      },
    },
  ],
  // Mantener el service worker activo
  skipWaiting: true,
  clientsClaim: true,
};
