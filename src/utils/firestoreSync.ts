import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  writeBatch,
  getDocs,
  setLogLevel,
  disableNetwork
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { getDeletedIds, registerDeletedId } from './deletionTracker';
import { isDummyRecord } from './purgeDummyData';
import { 
  getActiveSchoolId, 
  getSchoolConfig, 
  getRegisteredSchools, 
  saveRegisteredSchools, 
  SchoolConfig,
  loadSchoolData,
  saveSchoolData,
  sanitizeSchoolId
} from './schoolConfig';
import { Counselor } from '../types';

export { loadSchoolData, saveSchoolData, getActiveSchoolId, getSchoolConfig };

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

// Silence noisy internal SDK warnings/debug logs when free tier quota limits are reached
try {
  setLogLevel('silent');
} catch (e) {}

// Mapping between LocalStorage keys and Firestore Collection names
export const SYNC_MAP: Record<string, string> = {
  'bk_students': 'students',
  'bk_violations': 'violations',
  'bk_services': 'services',
  'bk_daily_journals': 'daily_journals',
  'bk_home_visits': 'home_visits',
  'bk_parent_summons': 'parent_summons',
  'bk_attendance_history': 'attendance_history',
  'bk_student_achievements': 'achievements',
  'bk_achievements': 'achievements',
  'bk_surat_perjanjian_list': 'surat_perjanjian_list',
  'bk_kontrak_perilaku_list': 'kontrak_perilaku_list',
  'bk_jurnal_pembinaan_disiplin_list': 'jurnal_pembinaan_disiplin_list',
  'bk_komitmen_rtl_list': 'komitmen_rtl_list',
  'bk_logs': 'activity_logs',
  'bk_counselors': 'counselors',
  'bk_teaching_schedule': 'teaching_schedule',
  'bk_class_teaching_progress': 'class_teaching_progress',
  'bk_sticky_notes': 'sticky_notes',
  'bk_parent_summon_templates': 'parent_summon_templates',
  'bk_walikelas_config': 'walikelas_config',
  'bk_akpd_class_sessions': 'akpd_class_sessions'
};

/**
 * Deterministically sorts collection records across devices
 */
export function sortCollectionData(key: string, items: any[]): any[] {
  if (!Array.isArray(items) || items.length <= 1) return items;

  return [...items].sort((a, b) => {
    switch (key) {
      case 'bk_students': {
        const classComp = String(a.class || '').localeCompare(String(b.class || ''));
        if (classComp !== 0) return classComp;
        return String(a.name || '').localeCompare(String(b.name || ''));
      }
      case 'bk_violations': {
        const dateV = String(b.date || '').localeCompare(String(a.date || ''));
        if (dateV !== 0) return dateV;
        const timeV = String(b.time || '').localeCompare(String(a.time || ''));
        if (timeV !== 0) return timeV;
        return String(b.id || '').localeCompare(String(a.id || ''));
      }
      case 'bk_services': {
        const dateS = String(b.date || '').localeCompare(String(a.date || ''));
        if (dateS !== 0) return dateS;
        const timeS = String(b.startTime || '').localeCompare(String(a.startTime || ''));
        if (timeS !== 0) return timeS;
        return String(b.id || '').localeCompare(String(a.id || ''));
      }
      case 'bk_logs': {
        const timeLogA = new Date(a.timestamp || 0).getTime();
        const timeLogB = new Date(b.timestamp || 0).getTime();
        return timeLogB - timeLogA;
      }
      case 'bk_attendance_history': {
        return String(b.date || '').localeCompare(String(a.date || ''));
      }
      case 'bk_daily_journals': {
        const dateJ = String(b.date || '').localeCompare(String(a.date || ''));
        if (dateJ !== 0) return dateJ;
        return String(b.startTime || '').localeCompare(String(a.startTime || ''));
      }
      case 'bk_home_visits': {
        return String(b.visitDate || b.date || '').localeCompare(String(a.visitDate || a.date || ''));
      }
      case 'bk_parent_summons': {
        return String(b.summonDate || b.date || '').localeCompare(String(a.summonDate || a.date || ''));
      }
      case 'bk_achievements':
      case 'bk_student_achievements': {
        return String(b.date || '').localeCompare(String(a.date || ''));
      }
      case 'bk_counselors': {
        return String(a.name || '').localeCompare(String(b.name || ''));
      }
      default:
        return String(b.id || '').localeCompare(String(a.id || ''));
    }
  });
}

let isSyncingActive = false;
export let isQuotaExceeded = false;
const unsubscribes: (() => void)[] = [];
const lastSavedRemoteMap: Record<string, string> = {};

export type CloudStatus = 'connected' | 'syncing' | 'offline' | 'quota_exceeded';

export interface CloudConnectionInfo {
  status: CloudStatus;
  activeCollections: number;
  lastSyncTime: string;
  isOnline: boolean;
  dbName: string;
  activeSchoolId: string;
  activeSchoolName: string;
}

let currentCloudStatus: CloudStatus = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connected';
let lastSyncTimestamp: string = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function getCloudConnectionInfo(): CloudConnectionInfo {
  const currentSchool = getSchoolConfig();
  return {
    status: isQuotaExceeded ? 'quota_exceeded' : (typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : currentCloudStatus),
    activeCollections: Object.keys(SYNC_MAP).length,
    lastSyncTime: lastSyncTimestamp,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    dbName: firebaseConfig.firestoreDatabaseId || 'ai-studio-sistemadministra',
    activeSchoolId: getActiveSchoolId(),
    activeSchoolName: currentSchool.schoolName || 'SMP N 2 Susukan'
  };
}

function notifyCloudStatusChange(status: CloudStatus) {
  currentCloudStatus = status;
  lastSyncTimestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bk_cloud_status', { detail: getCloudConnectionInfo() }));
  }
}

// Helper to get school-partitioned collection reference
export function getSchoolColRef(colName: string, customSchoolId?: string) {
  const schoolId = customSchoolId || getActiveSchoolId();
  return collection(db, 'schools', schoolId, colName);
}

// Helper to get school-partitioned document reference
export function getSchoolDocRef(colName: string, docId: string, customSchoolId?: string) {
  const schoolId = customSchoolId || getActiveSchoolId();
  return doc(db, 'schools', schoolId, colName, String(docId));
}

// Window online/offline event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (!isQuotaExceeded) {
      notifyCloudStatusChange('connected');
      initRealtimeFirestoreSync();
    }
  });
  window.addEventListener('offline', () => {
    notifyCloudStatusChange('offline');
  });

  // Listen to school switch events and restart sync
  window.addEventListener('bk_school_changed', () => {
    stopRealtimeFirestoreSync();
    initRealtimeFirestoreSync();
  });
}

function checkAndHandleQuotaError(err: any): boolean {
  const errStr = String(err?.message || err?.code || err || '') + ' ' + String(err?.cause || '');
  if (
    err?.code === 'resource-exhausted' ||
    errStr.includes('resource-exhausted') ||
    errStr.includes('Quota limit exceeded') ||
    errStr.includes('Quota exceeded') ||
    errStr.includes('free tier database') ||
    errStr.includes('quota metric')
  ) {
    if (!isQuotaExceeded) {
      isQuotaExceeded = true;
      console.warn('Firestore Quota Limit Exceeded. Stopping listener loops & switching to LocalStorage fallback mode.');
      stopRealtimeFirestoreSync();
      disableNetwork(db).catch(() => {});
      window.dispatchEvent(new CustomEvent('bk_firestore_quota_exceeded'));
    }
    return true;
  }
  return false;
}

// Ensure user has valid Firebase session for Firestore security rules
export function ensureFirebaseAuth(): Promise<void> {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        resolve();
      } else {
        signInAnonymously(auth)
          .then(() => resolve())
          .catch((err) => {
            console.error('Firebase Auth Anonymous Error:', err);
            resolve();
          });
      }
    });
  });
}

/**
 * Sync active school metadata to global schools registry in Firestore
 */
export async function syncSchoolMetadataToCloud(): Promise<void> {
  if (isQuotaExceeded) return;
  try {
    const config = getSchoolConfig();
    const schoolId = getActiveSchoolId();
    await registerSchoolToCloud(config, schoolId);
  } catch (err) {
    if (!checkAndHandleQuotaError(err)) {
      console.error('Failed to sync school metadata:', err);
    }
  }
}

/**
 * Register or update any school metadata in the Firestore global registry
 */
export async function registerSchoolToCloud(config: SchoolConfig, targetSchoolId?: string): Promise<void> {
  if (isQuotaExceeded) return;
  try {
    await ensureFirebaseAuth();
    const schoolId = targetSchoolId || config.schoolId || (config.npsn ? `sch_${config.npsn.replace(/[^0-9a-zA-Z]/g, '')}` : getActiveSchoolId());
    const metaDoc = doc(db, 'schools_registry', schoolId);
    await setDoc(metaDoc, {
      ...config,
      schoolId,
      lastActiveAt: new Date().toISOString()
    }, { merge: true });

    // Also sync config inside school document
    const schoolDoc = doc(db, 'schools', schoolId);
    await setDoc(schoolDoc, {
      ...config,
      schoolId,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    if (!checkAndHandleQuotaError(err)) {
      console.error('Failed to register school to cloud:', err);
    }
  }
}

/**
 * Save or update a single document in Firestore Realtime (School-scoped)
 */
export async function saveToFirestore(localKey: string, item: any, customSchoolId?: string): Promise<void> {
  if (!item || !item.id || isQuotaExceeded) return;
  const itemId = String(item.id);
  const deletedSet = new Set(getDeletedIds());
  if (deletedSet.has(itemId)) {
    // Never write or restore items that were deleted by the app
    return;
  }

  const colName = SYNC_MAP[localKey] || localKey;
  const schoolId = customSchoolId ? sanitizeSchoolId(customSchoolId) : getActiveSchoolId();

  try {
    await ensureFirebaseAuth();
    notifyCloudStatusChange('syncing');
    const docRef = getSchoolDocRef(colName, itemId, schoolId);
    await setDoc(docRef, { ...item, schoolId }, { merge: true });
    notifyCloudStatusChange('connected');
  } catch (err) {
    if (!checkAndHandleQuotaError(err)) {
      console.error(`Firestore save error [${schoolId}/${colName}]:`, err);
    }
  }
}

/**
 * Delete a single document from Firestore Realtime (School-scoped)
 */
export async function deleteFromFirestore(localKey: string, itemId: string, customSchoolId?: string): Promise<void> {
  if (!itemId || isQuotaExceeded) return;
  const cleanId = String(itemId);
  registerDeletedId(cleanId);
  const colName = SYNC_MAP[localKey] || localKey;
  const schoolId = customSchoolId ? sanitizeSchoolId(customSchoolId) : getActiveSchoolId();
  const cacheKey = `${schoolId}_${localKey}`;

  try {
    await ensureFirebaseAuth();
    notifyCloudStatusChange('syncing');
    const docRef = getSchoolDocRef(colName, cleanId, schoolId);
    await deleteDoc(docRef);
    delete lastSavedRemoteMap[cacheKey];
    notifyCloudStatusChange('connected');
  } catch (err) {
    if (!checkAndHandleQuotaError(err)) {
      console.error(`Firestore delete error [${schoolId}/${colName}/${cleanId}]:`, err);
    }
  }
}

/**
 * Save an entire list of array items to Firestore (School-scoped Batch)
 */
export async function saveBulkToFirestore(localKey: string, items: any[], customSchoolId?: string): Promise<void> {
  if (!Array.isArray(items) || isQuotaExceeded) return;

  const deletedSet = new Set(getDeletedIds());
  const activeCleanItems = items.filter(
    (it: any) => it && it.id && !deletedSet.has(String(it.id)) && !isDummyRecord(it, localKey)
  );

  const schoolId = customSchoolId || getActiveSchoolId();
  const cacheKey = `${schoolId}_${localKey}`;
  const sortedItems = sortCollectionData(localKey, activeCleanItems);
  const currentStr = JSON.stringify(sortedItems);

  if (lastSavedRemoteMap[cacheKey] === currentStr) {
    // Already in sync with remote, skip unnecessary network roundtrip
    return;
  }

  const colName = SYNC_MAP[localKey] || localKey;
  try {
    await ensureFirebaseAuth();
    notifyCloudStatusChange('syncing');

    // If local collection was intentionally emptied, remove all remote documents for this school
    if (sortedItems.length === 0) {
      const colRef = getSchoolColRef(colName, schoolId);
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        let batch = writeBatch(db);
        let count = 0;
        for (const docSnap of snap.docs) {
          batch.delete(docSnap.ref);
          count++;
          if (count >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      }
      lastSavedRemoteMap[cacheKey] = currentStr;
      notifyCloudStatusChange('connected');
      return;
    }

    // Chunk batch writes to avoid Firestore's 500-doc limit
    const CHUNK_SIZE = 400;
    for (let i = 0; i < sortedItems.length; i += CHUNK_SIZE) {
      const chunk = sortedItems.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const item of chunk) {
        if (item && item.id) {
          const ref = getSchoolDocRef(colName, String(item.id), schoolId);
          batch.set(ref, { ...item, schoolId }, { merge: true });
        }
      }
      await batch.commit();
    }

    lastSavedRemoteMap[cacheKey] = currentStr;
    notifyCloudStatusChange('connected');
  } catch (err) {
    if (!checkAndHandleQuotaError(err)) {
      console.error(`Firestore bulk save error [${schoolId}/${colName}]:`, err);
    }
  }
}

/**
 * Fetch list of all counselors directly from Firestore for a given school
 */
export async function fetchCloudCounselors(schoolId?: string): Promise<any[]> {
  if (isQuotaExceeded) return [];
  try {
    await ensureFirebaseAuth();
    const targetSchoolId = schoolId || getActiveSchoolId();
    const colRef = getSchoolColRef('counselors', targetSchoolId);
    const snap = await getDocs(colRef);
    const cloudCounselors: any[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data && data.name) {
        cloudCounselors.push({ id: d.id, ...data });
      }
    });
    if (cloudCounselors.length > 0) {
      saveSchoolData('bk_counselors', cloudCounselors, targetSchoolId);
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', { 
        detail: { key: 'bk_counselors', data: cloudCounselors, schoolId: targetSchoolId } 
      }));
    }
    return cloudCounselors;
  } catch (err) {
    if (!checkAndHandleQuotaError(err)) {
      console.warn('Could not fetch cloud counselors:', err);
    }
    return [];
  }
}

/**
 * Live search and authentication helper across Firestore collections
 */
export async function searchCloudCounselor(
  inputUser: string, 
  inputPass: string
): Promise<{ counselor: any; schoolConfig?: SchoolConfig; schoolId: string } | null> {
  const rawUser = inputUser.trim().toLowerCase();
  const rawDigits = rawUser.replace(/[^0-9]/g, '');
  const cleanPass = inputPass.trim();

  const isMatch = (c: any) => {
    if (!c) return false;
    const uMatch = c.username?.trim().toLowerCase() === rawUser;
    const eMatch = c.email?.trim().toLowerCase() === rawUser;
    const nameMatch = c.name?.trim().toLowerCase() === rawUser;
    const cNipDigits = (c.nip || '').replace(/[^0-9]/g, '');
    const nipMatch = rawDigits.length >= 4 && cNipDigits.includes(rawDigits);

    if (!(uMatch || eMatch || nameMatch || nipMatch)) return false;

    const storedPass = (c.password || '').trim();
    if (!storedPass) {
      return cleanPass === '123456' || cleanPass === 'password' || cleanPass === (c.username || '').toLowerCase() || cleanPass === 'admin';
    }
    return storedPass === cleanPass || storedPass.toLowerCase() === cleanPass.toLowerCase();
  };

  try {
    await ensureFirebaseAuth();
    const activeSchoolId = getActiveSchoolId();

    // 0. Check in global account_requests collection first for immediate real-time recognition
    try {
      const accReqCol = collection(db, 'account_requests');
      const accSnap = await getDocs(accReqCol);
      for (const d of accSnap.docs) {
        const data = { id: d.id, ...d.data() } as any;
        if (isMatch(data)) {
          return { counselor: data, schoolId: data.schoolId || activeSchoolId };
        }
      }
    } catch (e) {
      console.warn('Error checking account_requests:', e);
    }

    // 1. Check in active school first
    const activeCol = getSchoolColRef('counselors', activeSchoolId);
    const snap = await getDocs(activeCol);
    for (const d of snap.docs) {
      const data = { id: d.id, ...d.data() } as any;
      if (isMatch(data)) {
        return { counselor: data, schoolId: activeSchoolId };
      }
    }

    // 2. Check across all registered schools in cloud
    const schools = await fetchCloudRegisteredSchools();
    for (const school of schools) {
      const sId = (school as any).schoolId || (school.npsn ? `sch_${school.npsn.replace(/[^0-9a-zA-Z]/g, '')}` : null);
      if (sId && sId !== activeSchoolId) {
        const colRef = getSchoolColRef('counselors', sId);
        const colSnap = await getDocs(colRef);
        for (const d of colSnap.docs) {
          const data = { id: d.id, ...d.data() } as any;
          if (isMatch(data)) {
            return { counselor: data, schoolConfig: school, schoolId: sId };
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error during cloud counselor search:', err);
  }

  return null;
}

/**
 * Submit or save a new account registration (pengajuan akun baru) to cloud in real-time
 */
export async function saveAccountRequestToCloud(
  account: Counselor & { username?: string; password?: string },
  schoolConfig?: SchoolConfig
): Promise<void> {
  if (!account || !account.id || isQuotaExceeded) return;

  const targetSchoolId = account.schoolId ? sanitizeSchoolId(account.schoolId) : getActiveSchoolId();

  try {
    await ensureFirebaseAuth();
    notifyCloudStatusChange('syncing');

    // 1. Save to global account_requests collection
    const reqDocRef = doc(db, 'account_requests', account.id);
    await setDoc(reqDocRef, { ...account, schoolId: targetSchoolId }, { merge: true });

    // 2. Save directly to the target school's counselors collection
    const schoolDocRef = getSchoolDocRef('counselors', account.id, targetSchoolId);
    await setDoc(schoolDocRef, { ...account, schoolId: targetSchoolId }, { merge: true });

    // 3. Register school config to schools_registry if provided
    if (schoolConfig) {
      await registerSchoolToCloud(schoolConfig, targetSchoolId);
    }

    // 4. Update local cache for target school
    const existingCounselors = loadSchoolData<any[]>('bk_counselors', [], targetSchoolId);
    const updated = [...existingCounselors.filter(c => c.id !== account.id), account];
    saveSchoolData('bk_counselors', updated, targetSchoolId);

    // 5. Notify local listeners immediately
    window.dispatchEvent(new CustomEvent('bk_account_requests_updated', { detail: { requests: [account], account, schoolId: targetSchoolId } }));
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_counselors', data: updated, schoolId: targetSchoolId } }));
    window.dispatchEvent(new Event('storage'));

    notifyCloudStatusChange('connected');
  } catch (err) {
    if (!checkAndHandleQuotaError(err)) {
      console.error('Failed to save account request to cloud:', err);
    }
    throw err;
  }
}

/**
 * Update an account request in cloud (e.g. Approved / Rejected by Admin)
 */
export async function updateAccountRequestInCloud(account: Counselor): Promise<void> {
  if (!account || !account.id || isQuotaExceeded) return;

  const targetSchoolId = account.schoolId ? sanitizeSchoolId(account.schoolId) : getActiveSchoolId();

  try {
    await ensureFirebaseAuth();
    notifyCloudStatusChange('syncing');

    // 1. Update global account_requests
    const reqDocRef = doc(db, 'account_requests', account.id);
    await setDoc(reqDocRef, { ...account, schoolId: targetSchoolId }, { merge: true });

    // 2. Update target school's counselors
    const schoolDocRef = getSchoolDocRef('counselors', account.id, targetSchoolId);
    await setDoc(schoolDocRef, { ...account, schoolId: targetSchoolId }, { merge: true });

    // 3. Update local cache
    const existingCounselors = loadSchoolData<any[]>('bk_counselors', [], targetSchoolId);
    const updated = existingCounselors.map(c => c.id === account.id ? { ...c, ...account } : c);
    saveSchoolData('bk_counselors', updated, targetSchoolId);

    // 4. Dispatch events
    window.dispatchEvent(new CustomEvent('bk_account_requests_updated', { detail: { requests: [account], account, schoolId: targetSchoolId } }));
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_counselors', data: updated, schoolId: targetSchoolId } }));
    window.dispatchEvent(new Event('storage'));

    notifyCloudStatusChange('connected');
  } catch (err) {
    if (!checkAndHandleQuotaError(err)) {
      console.error('Failed to update account request in cloud:', err);
    }
  }
}

/**
 * Delete an account request from cloud
 */
export async function deleteAccountRequestFromCloud(accountId: string, schoolId?: string): Promise<void> {
  if (!accountId || isQuotaExceeded) return;

  const targetSchoolId = schoolId ? sanitizeSchoolId(schoolId) : getActiveSchoolId();

  try {
    await ensureFirebaseAuth();
    notifyCloudStatusChange('syncing');

    // 1. Delete from global account_requests
    const reqDocRef = doc(db, 'account_requests', accountId);
    await deleteDoc(reqDocRef);

    // 2. Delete from target school's counselors
    const schoolDocRef = getSchoolDocRef('counselors', accountId, targetSchoolId);
    await deleteDoc(schoolDocRef);

    // 3. Update local cache
    const existing = loadSchoolData<any[]>('bk_counselors', [], targetSchoolId);
    const updated = existing.filter(c => c.id !== accountId);
    saveSchoolData('bk_counselors', updated, targetSchoolId);

    // 4. Dispatch events
    window.dispatchEvent(new CustomEvent('bk_account_requests_updated', { detail: { deletedId: accountId, schoolId: targetSchoolId } }));
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_counselors', data: updated, schoolId: targetSchoolId } }));
    window.dispatchEvent(new Event('storage'));

    notifyCloudStatusChange('connected');
  } catch (err) {
    if (!checkAndHandleQuotaError(err)) {
      console.error('Failed to delete account request from cloud:', err);
    }
  }
}

/**
 * Realtime listener for account requests in Firestore
 */
export function listenToAccountRequests(callback: (requests: Counselor[]) => void): () => void {
  if (isQuotaExceeded) return () => {};

  try {
    const colRef = collection(db, 'account_requests');
    const unsub = onSnapshot(colRef, (snapshot) => {
      const deletedSet = new Set(getDeletedIds());
      const requests: Counselor[] = [];
      snapshot.forEach((d) => {
        const item = { id: d.id, ...d.data() } as any;
        if (item && item.id && !deletedSet.has(String(item.id))) {
          requests.push(item);
        }
      });
      callback(requests);
    }, (err) => {
      if (!checkAndHandleQuotaError(err)) {
        console.warn('Realtime listener error for account_requests:', err);
      }
    });

    return unsub;
  } catch (err) {
    console.warn('Error attaching account_requests listener:', err);
    return () => {};
  }
}

/**
 * Fetch list of all registered schools from cloud registry
 */
export async function fetchCloudRegisteredSchools(): Promise<SchoolConfig[]> {
  if (isQuotaExceeded) return getRegisteredSchools();
  try {
    const regCol = collection(db, 'schools_registry');
    const snap = await getDocs(regCol);
    const cloudSchools: SchoolConfig[] = [];
    snap.forEach(d => {
      const data = d.data() as SchoolConfig;
      if (data && data.schoolName) {
        cloudSchools.push(data);
      }
    });
    if (cloudSchools.length > 0) {
      saveRegisteredSchools(cloudSchools);
      return cloudSchools;
    }
  } catch (err) {
    console.warn('Could not fetch cloud schools registry:', err);
  }
  return getRegisteredSchools();
}

/**
 * Initialize Realtime onSnapshot Listeners for all school-partitioned collections
 */
export async function initRealtimeFirestoreSync(): Promise<void> {
  if (isSyncingActive || isQuotaExceeded) return;
  isSyncingActive = true;

  try {
    await ensureFirebaseAuth();
  } catch (err) {
    if (checkAndHandleQuotaError(err)) return;
  }

  if (isQuotaExceeded) return;

  const currentSchoolId = getActiveSchoolId();
  notifyCloudStatusChange('connected');

  // Push school profile to cloud registry
  syncSchoolMetadataToCloud().catch(() => {});

  // Listen to each mapped collection in Firestore in real-time under schools/{schoolId}/{colName}
  Object.entries(SYNC_MAP).forEach(([localKey, colName]) => {
    if (isQuotaExceeded) return;

    const colRef = getSchoolColRef(colName, currentSchoolId);
    const cacheKey = `${currentSchoolId}_${localKey}`;

    const unsub = onSnapshot(colRef, (snapshot) => {
      if (isQuotaExceeded) return;

      // If school collection is currently empty
      if (snapshot.empty) {
        const seedMarkerKey = `bk_seeded_${currentSchoolId}_${localKey}`;
        const hasBeenSeeded = typeof localStorage !== 'undefined' && localStorage.getItem(seedMarkerKey) === 'true';

        // Check if there is initial local data that needs a one-time upload
        const savedLocal = loadSchoolData(localKey, null, currentSchoolId);
        if (!hasBeenSeeded && savedLocal && Array.isArray(savedLocal) && savedLocal.length > 0) {
          const cleanItems = savedLocal.filter((item: any) => !isDummyRecord(item, localKey));
          if (cleanItems.length > 0) {
            if (typeof localStorage !== 'undefined') localStorage.setItem(seedMarkerKey, 'true');
            saveBulkToFirestore(localKey, cleanItems, currentSchoolId);
            return;
          }
        }

        // Remote collection is genuinely empty! Clear local data so deletions sync across all devices
        if (typeof localStorage !== 'undefined') localStorage.setItem(seedMarkerKey, 'true');
        const currentLocal = loadSchoolData(localKey, [], currentSchoolId);
        if (Array.isArray(currentLocal) && currentLocal.length > 0) {
          lastSavedRemoteMap[cacheKey] = '[]';
          saveSchoolData(localKey, [], currentSchoolId);
          window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: localKey, data: [], schoolId: currentSchoolId } }));
          window.dispatchEvent(new Event('storage'));
          notifyCloudStatusChange('connected');
        }
        return;
      }

      // Mark this collection as initialized/seeded in cloud
      const seedMarkerKey = `bk_seeded_${currentSchoolId}_${localKey}`;
      if (typeof localStorage !== 'undefined') localStorage.setItem(seedMarkerKey, 'true');

      const deletedSet = new Set(getDeletedIds());
      const docsData: any[] = [];
      snapshot.forEach((d) => {
        const item = { id: d.id, ...d.data() } as any;
        if (item && item.id) {
          const itemId = String(item.id);
          if (deletedSet.has(itemId)) {
            // Document was deleted via the app - ensure Firestore follows app command
            deleteFromFirestore(localKey, itemId);
          } else if (!isDummyRecord(item, localKey)) {
            docsData.push(item);
          }
        }
      });

      // Sort deterministically so all devices display and compare identical order
      const sortedDocs = sortCollectionData(localKey, docsData);
      const remoteStr = JSON.stringify(sortedDocs);
      const currentLocal = JSON.stringify(loadSchoolData(localKey, [], currentSchoolId));

      if (currentLocal !== remoteStr) {
        lastSavedRemoteMap[cacheKey] = remoteStr;
        saveSchoolData(localKey, sortedDocs, currentSchoolId);
        // Broadcast instant realtime sync event to active components
        window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: localKey, data: sortedDocs, schoolId: currentSchoolId } }));
        window.dispatchEvent(new Event('storage'));
        notifyCloudStatusChange('connected');
      }
    }, (error) => {
      if (!checkAndHandleQuotaError(error)) {
        console.error(`Realtime onSnapshot listener error [${currentSchoolId}/${colName}]:`, error);
        notifyCloudStatusChange('offline');
      }
    });

    unsubscribes.push(unsub);
  });

  // Dedicated real-time listener for global account registrations (pengajuan akun baru)
  try {
    const accReqCol = collection(db, 'account_requests');
    const accUnsub = onSnapshot(accReqCol, (snapshot) => {
      if (isQuotaExceeded) return;
      const deletedSet = new Set(getDeletedIds());
      const allRequests: Counselor[] = [];
      snapshot.forEach((d) => {
        const item = { id: d.id, ...d.data() } as any;
        if (item && item.id && !deletedSet.has(String(item.id))) {
          allRequests.push(item);
        }
      });

      // Dispatch event for UI components (Header, Sidebar, PengaturanView, LoginView)
      window.dispatchEvent(new CustomEvent('bk_account_requests_updated', { detail: { requests: allRequests } }));

      // Merge into active school counselors if matching current school OR if pending approval
      const activeSchoolId = getActiveSchoolId();
      const currentCounselors = loadSchoolData<Counselor[]>('bk_counselors', [], activeSchoolId);
      let changed = false;
      const map = new Map<string, Counselor>();
      currentCounselors.forEach(c => map.set(c.id, c));

      allRequests.forEach(req => {
        // If matches active school OR is pending (so Admin can inspect and ACC any pending teacher)
        if (!req.schoolId || req.schoolId === activeSchoolId || req.approvalStatus === 'pending') {
          const existing = map.get(req.id);
          if (!existing || existing.approvalStatus !== req.approvalStatus || JSON.stringify(existing) !== JSON.stringify(req)) {
            map.set(req.id, { ...(existing || {}), ...req });
            changed = true;
          }
        }
      });

      if (changed) {
        const mergedList = Array.from(map.values());
        saveSchoolData('bk_counselors', mergedList, activeSchoolId);
        window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_counselors', data: mergedList, schoolId: activeSchoolId } }));
        window.dispatchEvent(new Event('storage'));
      }
    }, (err) => {
      if (!checkAndHandleQuotaError(err)) {
        console.warn('Realtime onSnapshot listener error for account_requests:', err);
      }
    });

    unsubscribes.push(accUnsub);
  } catch (err) {
    console.warn('Failed to attach account_requests realtime listener:', err);
  }
}

/**
 * Force a full pull synchronization from Firestore for all collections of the active school
 */
export async function forceFullCloudSync(): Promise<void> {
  const currentSchoolId = getActiveSchoolId();
  notifyCloudStatusChange('syncing');

  // Pull global account requests
  try {
    const accReqCol = collection(db, 'account_requests');
    const accSnap = await getDocs(accReqCol);
    const deletedSet = new Set(getDeletedIds());
    const allReqs: Counselor[] = [];
    accSnap.forEach(d => {
      const item = { id: d.id, ...d.data() } as any;
      if (item && item.id && !deletedSet.has(String(item.id))) {
        allReqs.push(item);
      }
    });
    if (allReqs.length > 0) {
      window.dispatchEvent(new CustomEvent('bk_account_requests_updated', { detail: { requests: allReqs } }));
    }
  } catch (e) {
    console.warn('Force pull error for account_requests:', e);
  }

  for (const [localKey, colName] of Object.entries(SYNC_MAP)) {
    try {
      const colRef = getSchoolColRef(colName, currentSchoolId);
      const snap = await getDocs(colRef);
      const deletedSet = new Set(getDeletedIds());
      const docsData: any[] = [];

      snap.forEach((d) => {
        const item = { id: d.id, ...d.data() } as any;
        if (item && item.id && !deletedSet.has(String(item.id)) && !isDummyRecord(item, localKey)) {
          docsData.push(item);
        }
      });

      const sortedDocs = sortCollectionData(localKey, docsData);
      saveSchoolData(localKey, sortedDocs, currentSchoolId);
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', {
        detail: { key: localKey, data: sortedDocs, schoolId: currentSchoolId }
      }));
    } catch (e) {
      console.warn(`Force sync pull error for ${localKey}:`, e);
    }
  }

  notifyCloudStatusChange('connected');
  window.dispatchEvent(new Event('storage'));
}

let hasRegisteredSchoolListener = false;

/**
 * Clean up subscriptions
 */
export function stopRealtimeFirestoreSync(): void {
  unsubscribes.forEach((unsub) => unsub());
  unsubscribes.length = 0;
  isSyncingActive = false;
}

if (typeof window !== 'undefined' && !hasRegisteredSchoolListener) {
  hasRegisteredSchoolListener = true;
  window.addEventListener('bk_school_changed', () => {
    stopRealtimeFirestoreSync();
    setTimeout(() => {
      initRealtimeFirestoreSync();
    }, 100);
  });
}

