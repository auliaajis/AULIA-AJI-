import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getDocFromServer,
  doc,
  Firestore,
  setLogLevel,
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

export { firebaseConfig };

export const firebaseConfigObj = firebaseConfig;

console.log('Firebase Project:', firebaseConfig.projectId, '(Default Gemini Project)');

// Canonical singleton Firebase App (shared identically across AI Studio Preview & Vercel)
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const firestoreDatabaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';

// Initialize Firestore with multi-tab IndexedDB persistent cache for offline support & auto-sync
function createFirestoreInstance(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firestoreDatabaseId
    );
  } catch (err) {
    // Already initialized (e.g., module reload) -> reuse existing instance cleanly
    return getFirestore(app, firestoreDatabaseId);
  }
}

export const db: Firestore = createFirestoreInstance();
export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);

// Only log real Firestore errors (never swallow permission/write errors silently)
try {
  setLogLevel('error');
} catch {
  // Ignore if unsupported in current environment
}

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getDocFromServer(doc(db, '_connection_check', 'ping'));
    return { ok: true };
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (msg.includes('the client is offline') || error?.code === 'unavailable') {
      return { ok: false, error: 'Klien sedang offline (tidak dapat menjangkau server Firestore)' };
    }
    return { ok: false, error: msg };
  }
}
