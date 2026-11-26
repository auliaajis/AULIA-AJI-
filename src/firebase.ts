import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
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
export const FIRESTORE_DATABASE_ID = 'ai-studio-sistemadministra-39ee735c';

console.log('Firebase Project:', firebaseConfig.projectId, 'Database:', FIRESTORE_DATABASE_ID);

// Canonical singleton Firebase App (shared identically across AI Studio Preview & Vercel)
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db: Firestore = getFirestore(app, FIRESTORE_DATABASE_ID);
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
    await getDocFromServer(doc(db, 'students', '__ping__'));
    return { ok: true };
  } catch (error: any) {
    const code = error?.code ? String(error.code) : '';
    const msg = error?.message || String(error);
    return {
      ok: false,
      error: code && !msg.includes(code) ? `${code}: ${msg}` : msg,
    };
  }
}
