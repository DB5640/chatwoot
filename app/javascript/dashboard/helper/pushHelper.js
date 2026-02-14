/* eslint-disable no-console */
import NotificationSubscriptions from '../api/notificationSubscription';
import auth from '../api/auth';
import { useAlert } from 'dashboard/composables';

export const verifyServiceWorkerExistence = (callback = () => {}) => {
  if (!('serviceWorker' in navigator)) {
    // Service Worker isn't supported on this browser, disable or hide UI.
    return;
  }

  if (!('PushManager' in window)) {
    // Push isn't supported on this browser, disable or hide UI.
    return;
  }

  navigator.serviceWorker
    .register('/sw.js')
    .then(registration => {
      callback(registration);

      // Configurar periodic background sync para mantener conexión activa en móvil
      if ('periodicSync' in registration) {
        registration.periodicSync
          .register('check-notifications', {
            minInterval: 24 * 60 * 60 * 1000, // 24 horas
          })
          .catch(err => {
            console.log('Periodic sync no disponible:', err);
          });
      }

      // Enviar mensaje keep-alive cada 30 segundos para mantener SW activo
      setInterval(() => {
        if (navigator.serviceWorker.controller) {
          const messageChannel = new MessageChannel();
          messageChannel.port1.onmessage = event => {
            if (event.data.type === 'ALIVE') {
              // Service worker está activo
              console.log('Service worker está activo');
            }
          };
          navigator.serviceWorker.controller.postMessage(
            { type: 'KEEP_ALIVE' },
            [messageChannel.port2]
          );
        }
      }, 30000);
    })
    .catch(registrationError => {
      // eslint-disable-next-line
      console.log('SW registration failed: ', registrationError);
    });
};

export const hasPushPermissions = () => {
  if ('Notification' in window) {
    return Notification.permission === 'granted';
  }
  return false;
};

const generateKeys = str =>
  btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

export const getPushSubscriptionPayload = subscription => ({
  subscription_type: 'browser_push',
  subscription_attributes: {
    endpoint: subscription.endpoint,
    p256dh: generateKeys(subscription.getKey('p256dh')),
    auth: generateKeys(subscription.getKey('auth')),
  },
});

export const sendRegistrationToServer = subscription => {
  if (auth.hasAuthCookie()) {
    return NotificationSubscriptions.create(
      getPushSubscriptionPayload(subscription)
    );
  }
  return null;
};

export const registerSubscription = (onSuccess = () => {}) => {
  if (!window.chatwootConfig.vapidPublicKey) {
    return;
  }
  navigator.serviceWorker.ready
    .then(serviceWorkerRegistration =>
      serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: window.chatwootConfig.vapidPublicKey,
      })
    )
    .then(sendRegistrationToServer)
    .then(() => {
      onSuccess();
    })
    .catch(error => {
      // eslint-disable-next-line no-console
      console.error('Push subscription registration failed:', error);
      useAlert('This browser does not support desktop notification');
    });
};

export const requestPushPermissions = ({ onSuccess }) => {
  if (!('Notification' in window)) {
    // eslint-disable-next-line no-console
    console.warn('Notification is not supported');
    useAlert('This browser does not support desktop notification');
  } else if (Notification.permission === 'granted') {
    registerSubscription(onSuccess);
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission(permission => {
      if (permission === 'granted') {
        registerSubscription(onSuccess);
      }
    });
  }
};
