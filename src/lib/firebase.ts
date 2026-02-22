import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let messaging: Messaging | null = null;

// Only initialize if config is provided
if (firebaseConfig.apiKey) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

    // FCM is only supported in browsers that support service workers
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        try {
            messaging = getMessaging(app);
        } catch (err) {
            console.warn('FCM initialization failed:', err);
        }
    }
}

/**
 * Request permission and get the FCM registration token.
 * Returns null if FCM is not configured or permission is denied.
 */
export async function requestFcmToken(): Promise<string | null> {
    if (!messaging) return null;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;
    if (!vapidKey) {
        console.warn('VITE_FIREBASE_VAPID_KEY is not set. Push notifications disabled.');
        return null;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return null;

        const token = await getToken(messaging, { vapidKey });
        return token;
    } catch (err) {
        console.error('Failed to get FCM token:', err);
        return null;
    }
}

/**
 * Subscribe to foreground FCM messages.
 */
export function onForegroundMessage(callback: (payload: unknown) => void) {
    if (!messaging) return () => { };
    return onMessage(messaging, callback);
}
