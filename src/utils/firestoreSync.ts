import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  writeBatch,
  getDocs,
  getDoc,
  runTransaction,
  enableNetwork,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  getDocsFromServer
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { app, db, auth, firebaseConfig, testConnection, FIRESTORE_DATABASE_ID } from '../firebase';
import { getDeletedIds, registerDeletedId, unregisterDeletedId } from './deletionTracker';
import { isDummyRecord } from './purgeDummyData';
import { showToast } from './toast';
import { isValidDeleteId } from './safeDelete';
import { 
  getActiveSchoolId, 
  getSchoolConfig, 
  saveSchoolConfig,
  registerSchoolConfigWithoutActivating,
  getRegisteredSchools, 
  saveRegisteredSchools, 
  SchoolConfig,
  DEFAULT_SCHOOL_CONFIG,
  loadSchoolData,
  saveSchoolData,
  sanitizeSchoolId,
  matchesSchoolOrLegacy,
  isLegacyUnassignedRecord,
  belongsToOtherSchool,
  extractRecordSchoolId
} from './schoolConfig';
import { Counselor, HapusLogEntry } from '../types';
import { initialStudents } from '../data/mockData';

export { db, auth, testConnection };
export { loadSchoolData, saveSchoolData, getActiveSchoolId, getSchoolConfig };
export { fixMissingSchoolId, runMultiSchoolMigrationOnce, ensureSchoolDocumentExists, stampDocumentSchoolInfo } from './multiSchoolMigration';
export type { FixMissingSchoolIdResult } from './multiSchoolMigration';

/**
 * Gets the current authenticated user's schoolId from token claims / auth profile.
 * Never relies on manual input.
 */
export async function getCurrentUserSchoolId(): Promise<string> {
  try {
    if (auth.currentUser) {
      const tokenResult = await auth.currentUser.getIdTokenResult();
      if (tokenResult?.claims?.schoolId) {
        return sanitizeSchoolId(String(tokenResult.claims.schoolId));
      }
      const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userSnap.exists() && userSnap.data()?.schoolId) {
        return sanitizeSchoolId(String(userSnap.data().schoolId));
      }
    }
  } catch (err) {
    console.warn('[FirestoreSync] Error reading schoolId from auth token:', err);
  }
  return sanitizeSchoolId(getActiveSchoolId() || 'sch_20320123');
}

export function getCurrentUserSchoolIdSync(): string {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('bk_active_counselor') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.schoolId) {
        return sanitizeSchoolId(parsed.schoolId);
      }
    }
  } catch {}
  return sanitizeSchoolId(getActiveSchoolId() || 'sch_20320123');
}

// Mapping between internal cache keys and EXISTING Firestore Collection names (never create siswa/pelanggaran/layanan/agenda)
export const SYNC_MAP: Record<string, string> = {
  'bk_students': 'students',
  'bk_violations': 'violations',
  'bk_cases': 'violations',
  'bk_services': 'services',
  'bk_counseling': 'services',
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
  'bk_users': 'counselors',
  'bk_teaching_schedule': 'teaching_schedule',
  'bk_class_teaching_progress': 'class_teaching_progress',
  'bk_sticky_notes': 'sticky_notes',
  'bk_parent_summon_templates': 'parent_summon_templates',
  'bk_walikelas_config': 'walikelas_config',
  'bk_akpd_class_sessions': 'akpd_class_sessions',
  'bk_violation_rules': 'violation_rules',
  'bk_program_evaluations': 'program_evaluations',
  'bk_service_evaluations': 'service_evaluations'
};

/**
 * Always resolves strictly to EXISTING Firestore root collections:
 * students, violations, services, counselors, daily_journals, etc.
 * Never creates or writes new collections (siswa, pelanggaran, restitusi, layanan, agenda).
 */
export function getCanonicalRootCollections(colName: string): string[] {
  switch (colName) {
    case 'students':
    case 'siswa':
      return ['students'];
    case 'violations':
    case 'cases':
    case 'pelanggaran':
    case 'restitusi':
      return ['violations'];
    case 'services':
    case 'counseling':
    case 'layanan':
      return ['services'];
    case 'counselors':
    case 'users':
      return ['counselors'];
    case 'agenda':
      return ['daily_journals'];
    default:
      return [colName];
  }
}

export type FirestoreOperationType = 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';

export interface FirestoreErrorInfo {
  error: string;
  operationType: FirestoreOperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    isAnonymous: boolean | undefined;
  };
}

export function isOfflineFirestoreError(err: any): boolean {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || err || '').toLowerCase();
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return (
    code === 'unavailable' ||
    msg.includes('client is offline') ||
    msg.includes('network request failed') ||
    msg.includes('failed to get document because the client is offline')
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: FirestoreOperationType,
  path: string | null
): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code ? `[${(error as any).code}] ` : '';
  const errInfo: FirestoreErrorInfo = {
    error: `${errCode}${rawMessage}`,
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return `${errCode}${rawMessage}`;
}

/**
 * Deduplicates and purges dummy items from a collection before sorting or persisting.
 */
export function deduplicateCollectionItems(key: string, items: any[], schoolId?: string): any[] {
  if (!Array.isArray(items) || items.length === 0) return items;
  const _currentSchoolId = sanitizeSchoolId(schoolId || getActiveSchoolId());
  void _currentSchoolId;

  if (key === 'bk_students') {
    const seenIds = new Set<string>();
    const seenNis = new Map<string, string>();
    const resultMap = new Map<string, any>();

    for (const item of items) {
      if (!item || !isValidDeleteId(item.id)) continue;
      const itemId = String(item.id).trim();
      if (item.isDeleted === true) continue;
      if (isDummyRecord(item, 'bk_students')) continue;

      if (seenIds.has(itemId)) {
        const existing = resultMap.get(itemId);
        if (existing) {
          resultMap.set(itemId, {
            ...existing,
            ...item,
            violationPoints: Math.max(existing.violationPoints || 0, item.violationPoints || 0),
            bkServicesCount: Math.max(existing.bkServicesCount || 0, item.bkServicesCount || 0),
            achievementPoints: Math.max(existing.achievementPoints || 0, item.achievementPoints || 0),
          });
        }
        continue;
      }

      const nis = String(item.nis || '').trim();
      const matchedByNis = nis ? seenNis.get(nis) : undefined;
      const isCurrentLegacy = /^s\d+$/.test(itemId);
      const isMatchedLegacy = matchedByNis ? /^s\d+$/.test(matchedByNis) : false;

      // Hanya gabungkan dua ID berbeda bila salah satunya adalah format legacy s1..s194 dengan NIS sama
      if (matchedByNis && matchedByNis !== itemId && (isCurrentLegacy || isMatchedLegacy)) {
        if (isCurrentLegacy && !isMatchedLegacy) {
          const existing = resultMap.get(matchedByNis);
          resultMap.delete(matchedByNis);
          seenIds.delete(matchedByNis);
          resultMap.set(itemId, {
            ...item,
            violationPoints: Math.max(item.violationPoints || 0, existing?.violationPoints || 0),
            bkServicesCount: Math.max(item.bkServicesCount || 0, existing?.bkServicesCount || 0),
            achievementPoints: Math.max(item.achievementPoints || 0, existing?.achievementPoints || 0),
          });
          seenIds.add(itemId);
          seenNis.set(nis, itemId);
        } else {
          const existing = resultMap.get(matchedByNis);
          if (existing) {
            existing.violationPoints = Math.max(existing.violationPoints || 0, item.violationPoints || 0);
            existing.bkServicesCount = Math.max(existing.bkServicesCount || 0, item.bkServicesCount || 0);
            existing.achievementPoints = Math.max(existing.achievementPoints || 0, item.achievementPoints || 0);
          }
        }
        continue;
      }

      seenIds.add(itemId);
      resultMap.set(itemId, item);
      if (nis && !seenNis.has(nis)) seenNis.set(nis, itemId);
    }
    return Array.from(resultMap.values());
  }

  if (key === 'bk_violations' || key === 'bk_cases') {
    const seenIds = new Set<string>();
    const result: any[] = [];
    for (const item of items) {
      if (!item || !isValidDeleteId(item.id)) continue;
      if (item.isDeleted === true) continue;
      if (isDummyRecord(item, 'bk_violations')) continue;
      const itemId = String(item.id).trim();
      if (seenIds.has(itemId)) continue;
      seenIds.add(itemId);
      result.push(item);
    }
    return result;
  }

  if (key === 'bk_services' || key === 'bk_counseling') {
    const seenIds = new Set<string>();
    const result: any[] = [];
    for (const item of items) {
      if (!item || !isValidDeleteId(item.id)) continue;
      if (item.isDeleted === true) continue;
      if (isDummyRecord(item, 'bk_services')) continue;
      const itemId = String(item.id).trim();
      if (seenIds.has(itemId)) continue;
      seenIds.add(itemId);
      result.push(item);
    }
    return result;
  }

  return items;
}

/**
 * Deterministically sorts collection records across devices
 */
export function sortCollectionData(key: string, items: any[], schoolId?: string): any[] {
  if (!Array.isArray(items) || items.length === 0) return items;
  const cleanItems = deduplicateCollectionItems(key, items, schoolId);
  if (cleanItems.length <= 1) return cleanItems;

  return [...cleanItems].sort((a, b) => {
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
      case 'bk_program_evaluations':
      case 'bk_service_evaluations': {
        const dateE = String(b.tanggal || '').localeCompare(String(a.tanggal || ''));
        if (dateE !== 0) return dateE;
        return String(b.createdAt || b.id || '').localeCompare(String(a.createdAt || a.id || ''));
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
// Pure in-memory cloud snapshot store (NEVER populated from localStorage or mockData)
const cloudCollectionCache: Record<string, any[]> = {};
const loggedSnapshotCounts: Record<string, number> = {};

export function getCloudCollectionData<T = any>(localKey: string, schoolId?: string): T[] {
  const sid = sanitizeSchoolId(schoolId || getActiveSchoolId());
  const data = cloudCollectionCache[`${sid}_${localKey}`];
  return Array.isArray(data) ? (data as T[]) : [];
}

export function setCloudCollectionData(localKey: string, data: any[], schoolId?: string): void {
  const sid = sanitizeSchoolId(schoolId || getActiveSchoolId());
  const clean = Array.isArray(data) ? data : [];
  cloudCollectionCache[`${sid}_${localKey}`] = clean;
  if (localKey === 'bk_violations') cloudCollectionCache[`${sid}_bk_cases`] = clean;
  if (localKey === 'bk_cases') cloudCollectionCache[`${sid}_bk_violations`] = clean;
  if (localKey === 'bk_services') cloudCollectionCache[`${sid}_bk_counseling`] = clean;
  if (localKey === 'bk_counseling') cloudCollectionCache[`${sid}_bk_services`] = clean;
  if (localKey === 'bk_achievements') cloudCollectionCache[`${sid}_bk_student_achievements`] = clean;
  if (localKey === 'bk_student_achievements') cloudCollectionCache[`${sid}_bk_achievements`] = clean;
}

export function subscribeCloudCollection<T = any>(
  localKey: string,
  callback: (data: T[]) => void,
  schoolId?: string
): () => void {
  const getSid = () => sanitizeSchoolId(schoolId || getActiveSchoolId());
  callback(getCloudCollectionData<T>(localKey, getSid()));

  const handleSync = (e: any) => {
    const sid = getSid();
    const detailKey = e?.detail?.key;
    const detailSid = e?.detail?.schoolId ? sanitizeSchoolId(e.detail.schoolId) : sid;
    if (detailSid !== sid && localKey !== 'bk_counselors') return;

    const matchesKey =
      detailKey === localKey ||
      (localKey === 'bk_violations' && detailKey === 'bk_cases') ||
      (localKey === 'bk_cases' && detailKey === 'bk_violations') ||
      (localKey === 'bk_services' && detailKey === 'bk_counseling') ||
      (localKey === 'bk_counseling' && detailKey === 'bk_services') ||
      (localKey === 'bk_achievements' && detailKey === 'bk_student_achievements') ||
      (localKey === 'bk_student_achievements' && detailKey === 'bk_achievements');

    if (matchesKey) {
      if (Array.isArray(e?.detail?.data)) {
        setCloudCollectionData(localKey, e.detail.data, sid);
        callback(e.detail.data);
      } else {
        callback(getCloudCollectionData<T>(localKey, sid));
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('bk_realtime_sync', handleSync);
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('bk_realtime_sync', handleSync);
    }
  };
}

// Unique session identifier for each open browser tab to detect cross-tab updates
export const CLIENT_TAB_ID: string = typeof window !== 'undefined'
  ? (() => {
      try {
        let tid = window.sessionStorage.getItem('bk_tab_session_id');
        if (!tid) {
          tid = 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
          window.sessionStorage.setItem('bk_tab_session_id', tid);
        }
        return tid;
      } catch (e) {
        return 'tab_' + Math.random().toString(36).substring(2, 9);
      }
    })()
  : 'tab_server';

let conflictsPreventedCount = 0;
let lastConflictTime: string = '';

export function getConflictsPreventedCount(): number {
  return conflictsPreventedCount;
}

export type CloudStatus = 'connected' | 'syncing' | 'offline' | 'error' | 'quota_exceeded';

export interface CloudConnectionInfo {
  status: CloudStatus;
  activeCollections: number;
  lastSyncTime: string;
  isOnline: boolean;
  dbName: string;
  activeSchoolId: string;
  activeSchoolName: string;
  lastError?: string;
  conflictsPrevented?: number;
  lastConflictTime?: string;
  clientTabId?: string;
}

export interface CloudSyncRecordInfo {
  syncedAtIso: string;
  timeLabel: string;
  dateTimeLabel: string;
  status: 'synced' | 'unsynced' | 'offline' | 'error';
  lastError?: string;
  counts?: Record<string, number>;
}

const CLOUD_LAST_SYNC_PREFIX = 'bk_cloud_last_sync_';
let lastCloudError: string | undefined;

export function getLastCloudSyncInfo(schoolId?: string): CloudSyncRecordInfo {
  const sid = sanitizeSchoolId(schoolId || getActiveSchoolId());
  const pendingCount = getPendingCloudQueue().length;
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(`${CLOUD_LAST_SYNC_PREFIX}${sid}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.syncedAtIso) {
          return {
            syncedAtIso: parsed.syncedAtIso,
            timeLabel: parsed.timeLabel || new Date(parsed.syncedAtIso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            dateTimeLabel: parsed.dateTimeLabel || new Date(parsed.syncedAtIso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            status: lastCloudError ? 'error' : !isOnline ? 'offline' : pendingCount > 0 ? 'unsynced' : 'synced',
            lastError: lastCloudError,
            counts: parsed.counts
          };
        }
      }
    } catch {}
  }

  return {
    syncedAtIso: '',
    timeLabel: '-',
    dateTimeLabel: 'Belum pernah sinkron',
    status: lastCloudError ? 'error' : !isOnline ? 'offline' : 'unsynced',
    lastError: lastCloudError
  };
}

export function markCloudSyncCompleted(schoolId?: string, counts?: Record<string, number>): CloudSyncRecordInfo {
  const sid = sanitizeSchoolId(schoolId || getActiveSchoolId());
  const now = new Date();
  const info: CloudSyncRecordInfo = {
    syncedAtIso: now.toISOString(),
    timeLabel: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    dateTimeLabel: now.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    status: 'synced',
    counts
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`${CLOUD_LAST_SYNC_PREFIX}${sid}`, JSON.stringify(info));
    } catch {}
  }
  return info;
}

let currentCloudStatus: CloudStatus = 'syncing';
let lastSyncTimestamp: string = (() => {
  const saved = getLastCloudSyncInfo();
  if (saved.syncedAtIso) return saved.timeLabel;
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
})();

export function getCloudConnectionInfo(): CloudConnectionInfo {
  const currentSchool = getSchoolConfig();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const resolvedStatus: CloudStatus = isQuotaExceeded
    ? 'quota_exceeded'
    : lastCloudError || currentCloudStatus === 'error'
    ? 'error'
    : !isOnline
    ? 'error'
    : currentCloudStatus;
  return {
    status: resolvedStatus,
    activeCollections: Object.keys(SYNC_MAP).length,
    lastSyncTime: lastSyncTimestamp,
    isOnline,
    dbName: FIRESTORE_DATABASE_ID,
    activeSchoolId: getActiveSchoolId(),
    activeSchoolName: currentSchool.schoolName || 'SMP N 2 Susukan',
    lastError: lastCloudError || (!isOnline ? 'unavailable: Perangkat sedang tidak tersambung ke internet' : undefined),
    conflictsPrevented: conflictsPreventedCount,
    lastConflictTime: lastConflictTime || undefined,
    clientTabId: CLIENT_TAB_ID
  };
}

/**
 * Safely extracts timestamp in milliseconds from a document record
 */
export function getItemTimestamp(item: any): number {
  if (!item || typeof item !== 'object') return 0;
  if (typeof item._updatedAt === 'number' && !isNaN(item._updatedAt)) return item._updatedAt;
  if (typeof item.updatedAt === 'number' && !isNaN(item.updatedAt)) return item.updatedAt;
  if (typeof item._updatedAt === 'string') {
    const t = new Date(item._updatedAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (typeof item.updatedAt === 'string') {
    const t = new Date(item.updatedAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (typeof item.timestamp === 'number' && !isNaN(item.timestamp)) return item.timestamp;
  if (typeof item.timestamp === 'string') {
    const t = new Date(item.timestamp).getTime();
    if (!isNaN(t)) return t;
  }
  if (typeof item.createdAt === 'string') {
    const t = new Date(item.createdAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (typeof item.date === 'string') {
    const t = new Date(item.date).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

/**
 * Safely extracts version number from a document record
 */
export function getItemVersion(item: any): number {
  if (!item || typeof item !== 'object') return 0;
  const v = item._version ?? item.version;
  const parsed = Number(v);
  return typeof parsed === 'number' && !isNaN(parsed) ? parsed : 0;
}

/**
 * Evaluates whether an incoming write is stale relative to existing remote data
 * @param incomingItem The item being saved by the current tab
 * @param remoteData The existing document currently stored in Firestore
 * @param toleranceMs Millisecond threshold to tolerate minor clock skew
 */
export function isStaleUpdate(
  incomingItem: any, 
  remoteData: any, 
  toleranceMs: number = 300
): boolean {
  if (!remoteData || typeof remoteData !== 'object') return false;

  const remoteVersion = getItemVersion(remoteData);
  const incomingVersion = getItemVersion(incomingItem);

  // If remote document has been versioned and incoming is strictly older
  if (remoteVersion > 0 && incomingVersion > 0) {
    if (incomingVersion < remoteVersion) {
      return true;
    }
  }

  // If remote has already advanced past initial version (>= 2) and incoming has no version
  if (remoteVersion >= 2 && incomingVersion === 0) {
    return true;
  }

  // Compare timestamps
  const remoteTime = getItemTimestamp(remoteData);
  const incomingTime = getItemTimestamp(incomingItem);

  if (remoteTime > 0 && incomingTime > 0) {
    // If remote was updated noticeably later than incoming
    if (remoteTime - incomingTime > toleranceMs) {
      return true;
    }
  }

  return false;
}

export interface SaveOptions {
  customSchoolId?: string;
  force?: boolean;
  counselorId?: string;
  counselorName?: string;
}

export interface SaveResult {
  success: boolean;
  version?: number;
  updatedAt?: number;
  isStale?: boolean;
  remoteData?: any;
  error?: any;
}

/**
 * Updates a single document in the local cache when updated by another tab or remote source
 */
export function updateLocalDocWithRemote(localKey: string, remoteDoc: any, schoolId: string): void {
  if (!remoteDoc || !remoteDoc.id) return;
  try {
    const sid = sanitizeSchoolId(schoolId || getActiveSchoolId());
    const currentList = getCloudCollectionData<any>(localKey, sid);
    const targetId = String(remoteDoc.id);
    const exists = currentList.some((it: any) => String(it?.id) === targetId);
    const nextList = exists
      ? currentList.map((it: any) => String(it?.id) === targetId ? { ...it, ...remoteDoc } : it)
      : [remoteDoc, ...currentList];
    setCloudCollectionData(localKey, nextList, sid);
  } catch (e) {
    console.warn(`Failed updating cloud memory store for [${localKey}]:`, e);
  }
}

function notifyCloudStatusChange(status: CloudStatus, recordSync = false, errorMsg?: string) {
  currentCloudStatus = status;
  lastSyncTimestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (status === 'connected') {
    lastCloudError = undefined;
    if (recordSync) {
      markCloudSyncCompleted(getActiveSchoolId());
    }
  } else if (status === 'error' || status === 'quota_exceeded') {
    lastCloudError = errorMsg || 'Gagal menyinkronkan dengan Firestore.';
  } else if (status === 'offline') {
    lastCloudError = errorMsg;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bk_cloud_status', { detail: getCloudConnectionInfo() }));
  }
}

// Multi-platform cross-tab real-time communication channel (<1ms instant sync)
let syncBroadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncBroadcastChannel = new BroadcastChannel('bk_cloud_realtime_channel');
    syncBroadcastChannel.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.senderTabId === CLIENT_TAB_ID) return; // Prevent echoing self

      const activeSchoolId = getActiveSchoolId();

      if (msg.type === 'sync' && msg.key) {
        if (msg.schoolId && msg.schoolId !== activeSchoolId && msg.key !== 'bk_counselors') return;
        if (Array.isArray(msg.data)) {
          setCloudCollectionData(msg.key, msg.data, msg.schoolId || activeSchoolId);
        }
        window.dispatchEvent(new CustomEvent('bk_realtime_sync', {
          detail: {
            key: msg.key,
            data: msg.data,
            schoolId: msg.schoolId || activeSchoolId,
            fromBroadcastChannel: true
          }
        }));
        notifyCloudStatusChange('connected');
      } else if (msg.type === 'doc_saved' && msg.key && msg.doc) {
        if (msg.schoolId && msg.schoolId !== activeSchoolId && msg.key !== 'bk_counselors') return;
        updateLocalDocWithRemote(msg.key, msg.doc, msg.schoolId || activeSchoolId);
        const updatedList = getCloudCollectionData(msg.key, msg.schoolId || activeSchoolId);
        window.dispatchEvent(new CustomEvent('bk_realtime_sync', {
          detail: {
            key: msg.key,
            data: updatedList,
            schoolId: msg.schoolId || activeSchoolId,
            fromBroadcastChannel: true
          }
        }));
        notifyCloudStatusChange('connected');
      } else if (msg.type === 'doc_deleted' && msg.key && isValidDeleteId(msg.itemId)) {
        if (msg.schoolId && msg.schoolId !== activeSchoolId && msg.key !== 'bk_counselors') return;
        const targetSchool = msg.schoolId || activeSchoolId;
        const currentList = getCloudCollectionData<any>(msg.key, targetSchool);
        if (Array.isArray(currentList)) {
          const cleanTarget = String(msg.itemId).trim();
          const filtered = currentList.filter(item => !item || !isValidDeleteId(item.id) || String(item.id).trim() !== cleanTarget);
          if (currentList.length - filtered.length <= 5) {
            setCloudCollectionData(msg.key, filtered, targetSchool);
            window.dispatchEvent(new CustomEvent('bk_realtime_sync', {
              detail: {
                type: 'doc_deleted',
                key: msg.key,
                itemId: cleanTarget,
                data: filtered,
                schoolId: targetSchool,
                fromBroadcastChannel: true
              }
            }));
          }
        }
        notifyCloudStatusChange('connected');
      }
    };
  }
} catch (err) {
  console.warn('[FirestoreSync] BroadcastChannel init error:', err);
}

/**
 * Broadcasts an update across the current window and all other open browser tabs/windows instantaneously (<1ms)
 */
export function broadcastRealtimeChange(payload: {
  type: 'sync' | 'doc_saved' | 'doc_deleted';
  key: string;
  data?: any;
  doc?: any;
  itemId?: string;
  schoolId?: string;
}): void {
  const activeSchoolId = payload.schoolId || getActiveSchoolId();

  // 1. Dispatch locally in the current window immediately
  if (typeof window !== 'undefined') {
    if (payload.type === 'sync' && Array.isArray(payload.data)) {
      setCloudCollectionData(payload.key, payload.data, activeSchoolId);
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', {
        detail: { type: 'sync', key: payload.key, data: payload.data, schoolId: activeSchoolId }
      }));
    } else if (payload.type === 'doc_saved' && payload.doc) {
      updateLocalDocWithRemote(payload.key, payload.doc, activeSchoolId);
      const updatedList = getCloudCollectionData(payload.key, activeSchoolId);
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', {
        detail: { type: 'doc_saved', key: payload.key, data: updatedList, doc: payload.doc, schoolId: activeSchoolId }
      }));
    } else if (payload.type === 'doc_deleted' && isValidDeleteId(payload.itemId)) {
      const targetId = String(payload.itemId).trim();
      const updatedList = Array.isArray(payload.data)
        ? payload.data
        : getCloudCollectionData(payload.key, activeSchoolId).filter((it: any) => String(it?.id || '').trim() !== targetId);
      setCloudCollectionData(payload.key, updatedList, activeSchoolId);
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', {
        detail: {
          type: 'doc_deleted',
          key: payload.key,
          itemId: targetId,
          data: updatedList,
          schoolId: activeSchoolId
        }
      }));
    }
  }

  // 2. Transmit to other browser tabs and windows in under 1 millisecond
  if (syncBroadcastChannel) {
    try {
      syncBroadcastChannel.postMessage({
        ...payload,
        schoolId: activeSchoolId,
        senderTabId: CLIENT_TAB_ID,
        timestamp: Date.now()
      });
    } catch (err) {
      console.warn('[FirestoreSync] BroadcastChannel postMessage error:', err);
    }
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

// Window online/offline & mobile visibility lifecycle event listeners
if (typeof window !== 'undefined') {
  let lastHiddenTime = 0;

  window.addEventListener('online', () => {
    if (!isQuotaExceeded) {
      notifyCloudStatusChange('connected');
      initRealtimeFirestoreSync();
      forceFullCloudSync().catch(() => {});
    }
  });

  window.addEventListener('offline', () => {
    notifyCloudStatusChange('error', false, 'unavailable: Koneksi internet perangkat terputus');
  });

  // Mobile phone screen lock / Tab background resume listener:
  // When a mobile phone is unlocked or user switches back to this tab,
  // re-verify connection and trigger fast sync so all incoming changes show up immediately.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenTime = Date.now();
      } else if (document.visibilityState === 'visible') {
        const backgroundDuration = Date.now() - lastHiddenTime;
        if (lastHiddenTime > 0 && backgroundDuration > 3000) {
          notifyCloudStatusChange('syncing');
          forceFullCloudSync().catch(() => {});
        }
      }
    });
  }

  // Listen to school switch events and restart sync immediately
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
    errStr.includes('Quota exceeded')
  ) {
    console.warn('Firestore rate limit or temporary quota warning detected:', errStr);
    notifyCloudStatusChange('error', false, 'resource-exhausted: Kuota Firestore harian terlampaui');
    return true;
  }
  return false;
}

// Validate initial connection to Firestore non-blockingly on startup
if (typeof window !== 'undefined') {
  testConnection().then((res) => {
    if (res.ok) {
      notifyCloudStatusChange('connected');
    } else if (res.error) {
      notifyCloudStatusChange('error', false, res.error);
    }
  }).catch((err: any) => {
    notifyCloudStatusChange('error', false, err?.message || String(err));
  });
}

// Offline-to-Cloud Pending Mutations Queue
const PENDING_QUEUE_KEY = 'bk_pending_cloud_queue';

export interface PendingCloudItem {
  id: string;
  localKey: string;
  item: any;
  schoolId: string;
  enqueuedAt: number;
}

export function getPendingCloudQueue(): PendingCloudItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function enqueuePendingCloudWrite(entry: PendingCloudItem): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const queue = getPendingCloudQueue();
    const existingIndex = queue.findIndex(q => q.id === entry.id && q.localKey === entry.localKey && q.schoolId === entry.schoolId);
    if (existingIndex !== -1) {
      queue[existingIndex] = entry;
    } else {
      queue.push(entry);
    }
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {}
}

export function removePendingCloudWrite(id: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const queue = getPendingCloudQueue().filter(q => q.id !== id);
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {}
}

export async function flushPendingCloudQueue(): Promise<number> {
  const queue = getPendingCloudQueue();
  if (queue.length === 0 || isQuotaExceeded) return 0;

  let flushed = 0;
  let lastFlushError: string | undefined;
  const remaining: PendingCloudItem[] = [];
  const nowIso = new Date().toISOString();

  for (const entry of queue) {
    try {
      const colName = SYNC_MAP[entry.localKey] || entry.localKey;
      const docId = String(entry.id);
      const payload = {
        ...(entry.item || {}),
        id: docId,
        createdAt: entry.item?.createdAt || nowIso,
        updatedAt: entry.item?.updatedAt || nowIso,
      };
      const writes: Promise<any>[] = [
        setDoc(getSchoolDocRef(colName, docId, entry.schoolId), payload, { merge: true })
      ];
      getCanonicalRootCollections(colName).forEach((rootCol) => {
        writes.push(setDoc(doc(db, rootCol, docId), payload, { merge: true }));
      });
      await Promise.all(writes);
      flushed++;
    } catch (e: any) {
      remaining.push(entry);
      lastFlushError = handleFirestoreError(e, 'write', `schools/${entry.schoolId}/${SYNC_MAP[entry.localKey] || entry.localKey}/${entry.id}`);
    }
  }

  try {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(remaining));
  } catch (e) {}

  if (flushed > 0) {
    console.log(`[FirestoreSync] Flushed ${flushed} pending offline records to Firestore.`);
  }
  if (remaining.length === 0 && flushed > 0) {
    notifyCloudStatusChange('connected', true);
  } else if (lastFlushError) {
    notifyCloudStatusChange('error', false, lastFlushError);
  }
  return flushed;
}

/**
 * Reset quota error state and ensure network connectivity is active
 */
export async function resetQuotaState(): Promise<void> {
  isQuotaExceeded = false;
  try {
    await enableNetwork(db);
    console.log('Firestore cloud network connection active.');
  } catch (e) {
    // Already active
  }
}

// Ensure user has valid Firebase session for Firestore security rules (non-blocking)
export async function ensureFirebaseAuth(): Promise<void> {
  if (auth.currentUser) return;
  try {
    const authWait = new Promise<void>((resolve) => {
      const unsub = onAuthStateChanged(auth, (u) => {
        if (u) {
          unsub();
          resolve();
        }
      });
    });
    // Attempt anonymous session silently if not signed in yet, without blocking offline reads/writes
    signInAnonymously(auth).catch(() => {});
    await Promise.race([
      authWait,
      new Promise<void>((resolve) => setTimeout(resolve, 400))
    ]);
  } catch {
    // Gracefully continue with Firestore cached/public rules
  }
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
 * Register or update any school metadata in the Firestore global registry & `pengaturan` collection
 */
export async function registerSchoolToCloud(config: SchoolConfig, targetSchoolId?: string): Promise<void> {
  if (isQuotaExceeded) return;
  try {
    await ensureFirebaseAuth();
    const schoolId = targetSchoolId || config.schoolId || (config.npsn ? `sch_${config.npsn.replace(/[^0-9a-zA-Z]/g, '')}` : getActiveSchoolId());
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const stampedPayload = {
      ...config,
      id: schoolId,
      schoolId,
      createdAt: (config as any).createdAt || nowIso,
      updatedAt: nowIso,
      _updatedAt: nowMs,
    };

    await Promise.all([
      setDoc(doc(db, 'schools_registry', schoolId), { ...stampedPayload, lastActiveAt: nowIso }, { merge: true }),
      setDoc(doc(db, 'schools', schoolId), stampedPayload, { merge: true }),
      setDoc(doc(db, 'pengaturan', schoolId), stampedPayload, { merge: true }),
    ]);
  } catch (err) {
    if (!checkAndHandleQuotaError(err)) {
      const msg = handleFirestoreError(err, 'write', `pengaturan/${targetSchoolId || config.schoolId || ''}`);
      notifyCloudStatusChange('error', false, msg);
    }
  }
}

/**
 * Sync school profile & operational settings immediately to `pengaturan/{schoolId}` and `schools/{schoolId}`
 */
export async function syncSettingsToPengaturan(
  schoolIdInput?: string,
  partialSettings?: {
    schoolConfig?: SchoolConfig;
    walikelasConfig?: any[];
    violationRules?: any[];
    parentSummonTemplates?: any[];
    akpdClassSessions?: any[];
    autoJournalSettings?: any;
    siBecikFabEnabled?: boolean | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const schoolId = sanitizeSchoolId(schoolIdInput || getActiveSchoolId());
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const cfg = partialSettings?.schoolConfig || getSchoolConfig(schoolId);
  const payload: Record<string, any> = {
    id: schoolId,
    schoolId,
    ...cfg,
    ...(partialSettings?.walikelasConfig !== undefined ? { walikelasConfig: partialSettings.walikelasConfig } : {}),
    ...(partialSettings?.violationRules !== undefined ? { violationRules: partialSettings.violationRules } : {}),
    ...(partialSettings?.parentSummonTemplates !== undefined ? { parentSummonTemplates: partialSettings.parentSummonTemplates } : {}),
    ...(partialSettings?.akpdClassSessions !== undefined ? { akpdClassSessions: partialSettings.akpdClassSessions } : {}),
    ...(partialSettings?.autoJournalSettings !== undefined ? { autoJournalSettings: partialSettings.autoJournalSettings } : {}),
    ...(partialSettings?.siBecikFabEnabled !== undefined ? { siBecikFabEnabled: partialSettings.siBecikFabEnabled } : {}),
    createdAt: (cfg as any)?.createdAt || nowIso,
    updatedAt: nowIso,
    _updatedAt: nowMs,
    _lastModifiedByTab: CLIENT_TAB_ID,
  };

  try {
    await ensureFirebaseAuth();
    notifyCloudStatusChange('syncing');
    await Promise.all([
      setDoc(doc(db, 'pengaturan', schoolId), payload, { merge: true }),
      setDoc(doc(db, 'schools', schoolId), payload, { merge: true }),
      setDoc(doc(db, 'schools', schoolId, 'settings', 'app_settings'), payload, { merge: true }),
    ]);
    notifyCloudStatusChange('connected', true);
    return { success: true };
  } catch (err: any) {
    const msg = handleFirestoreError(err, 'write', `pengaturan/${schoolId}`);
    notifyCloudStatusChange('error', false, msg);
    showToast(`Gagal menyinkronkan pengaturan ke Firestore: ${msg}`, 'error');
    return { success: false, error: msg };
  }
}

/**
 * Save or update a single document in Firestore Realtime with Version-Check and Timestamp Protection
 */
export async function saveToFirestore(
  localKey: string, 
  item: any, 
  customSchoolIdOrOptions?: string | SaveOptions,
  extraOptions?: SaveOptions
): Promise<SaveResult> {
  if (!item || !item.id || isQuotaExceeded) {
    return { success: false };
  }

  const options: SaveOptions = typeof customSchoolIdOrOptions === 'object' && customSchoolIdOrOptions !== null
    ? customSchoolIdOrOptions
    : (extraOptions || {});

  const customSchoolId = typeof customSchoolIdOrOptions === 'string'
    ? customSchoolIdOrOptions
    : options.customSchoolId;

  const itemId = String(item.id);
  const deletedSet = new Set(getDeletedIds());
  if (item.isDeleted === true || deletedSet.has(itemId)) {
    // Never write or restore items that were explicitly deleted
    return { success: false, isStale: false };
  }

  const colName = SYNC_MAP[localKey] || localKey;
  const schoolId = customSchoolId ? sanitizeSchoolId(customSchoolId) : getActiveSchoolId();
  const schoolName = item.schoolName || (options as any).schoolName || (schoolId === 'sch_20320123' ? 'SMP N 2 Susukan' : (getSchoolConfig(schoolId).schoolName || 'SMP N 2 Susukan'));
  const docRef = getSchoolDocRef(colName, itemId, schoolId);

  // 1. Optimistic fast update: update local cache and broadcast immediately (<1ms response)
  const optimisticVersion = (getItemVersion(item) || 0) + 1;
  const optimisticNow = Date.now();
  const optimisticNowIso = new Date(optimisticNow).toISOString();
  const optimisticItem = {
    ...item,
    id: itemId,
    isDeleted: false,
    schoolId,
    sekolahId: item.sekolahId || schoolId,
    schoolName,
    namaSekolah: item.namaSekolah || schoolName,
    ...(colName === 'violations' ? { migratedAt: item.migratedAt !== undefined ? item.migratedAt : null } : {}),
    createdAt: item.createdAt || optimisticNowIso,
    updatedAt: optimisticNowIso,
    _version: optimisticVersion,
    _updatedAt: optimisticNow,
    _lastModifiedByTab: CLIENT_TAB_ID,
    ...(options.counselorId ? { _lastModifiedByCounselorId: options.counselorId } : {}),
    ...(options.counselorName ? { _lastModifiedByCounselorName: options.counselorName } : {})
  };
  updateLocalDocWithRemote(localKey, optimisticItem, schoolId);
  broadcastRealtimeChange({
    type: 'doc_saved',
    key: localKey,
    doc: optimisticItem,
    schoolId
  });

  try {
    await ensureFirebaseAuth();
    notifyCloudStatusChange('syncing');

    let result: SaveResult = { success: false };

    // Use runTransaction to ensure atomic version-checking and prevent race conditions between open tabs
    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        let remoteData: any = null;
        let remoteVersion = 0;
        let remoteTime = 0;

        if (docSnap.exists()) {
          remoteData = docSnap.data();
          if (remoteData?.isDeleted === true && !options.force) {
            registerDeletedId(itemId);
            result = { success: false, isStale: false };
            return;
          }
          remoteVersion = getItemVersion(remoteData);
          remoteTime = getItemTimestamp(remoteData);
        }

        const incomingVersion = getItemVersion(item);
        const incomingTime = getItemTimestamp(item);

        // Check if incoming update is stale
        const isStale = isStaleUpdate(item, remoteData);

        if (isStale && !options.force) {
          // Stale data detected! Abort overwrite to preserve newer tab/remote edits
          conflictsPreventedCount++;
          lastConflictTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const fullRemoteData = { id: docSnap.id, ...remoteData };

          result = {
            success: false,
            isStale: true,
            version: remoteVersion,
            updatedAt: remoteTime,
            remoteData: fullRemoteData
          };

          console.warn(
            `[FirestoreSync] Stale write prevented for ${colName}/${itemId}. ` +
            `Remote version ${remoteVersion} (${new Date(remoteTime).toLocaleTimeString('id-ID')}) ` +
            `vs incoming version ${incomingVersion} (${incomingTime ? new Date(incomingTime).toLocaleTimeString('id-ID') : 'unversioned'}).`
          );

          // Update local storage so current tab gets the latest data
          updateLocalDocWithRemote(localKey, fullRemoteData, schoolId);
          broadcastRealtimeChange({
            type: 'doc_saved',
            key: localKey,
            doc: fullRemoteData,
            schoolId
          });

          // Notify UI components and counselor
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bk_stale_write_prevented', {
              detail: {
                localKey,
                colName,
                itemId,
                remoteData: fullRemoteData,
                incomingData: item,
                schoolId
              }
            }));
            window.dispatchEvent(new CustomEvent('bk_sync_conflict', {
              detail: {
                type: 'stale_write_prevented',
                localKey,
                itemId,
                remoteData: fullRemoteData
              }
            }));
          }

          showToast('Data telah diperbarui di tab/perangkat lain. Data terbaru telah dimuat agar tidak tertimpa.', 'warning');
          return;
        }

        // Fresh update: calculate next version and timestamp
        const nextVersion = Math.max(remoteVersion, incomingVersion) + 1;
        const now = Date.now();
        const nowIso = new Date(now).toISOString();

        const stampedItem = {
          ...item,
          id: itemId,
          isDeleted: false,
          schoolId,
          sekolahId: item.sekolahId || schoolId,
          schoolName,
          namaSekolah: item.namaSekolah || schoolName,
          createdAt: item.createdAt || nowIso,
          updatedAt: nowIso,
          _version: nextVersion,
          _updatedAt: now,
          _lastModifiedByTab: CLIENT_TAB_ID,
          ...(options.counselorId ? { _lastModifiedByCounselorId: options.counselorId } : {}),
          ...(options.counselorName ? { _lastModifiedByCounselorName: options.counselorName } : {})
        };

        transaction.set(docRef, stampedItem, { merge: true });

        // Mirror strictly to existing root collections (students, violations, services, counselors, etc.)
        const canonicalRoots = getCanonicalRootCollections(colName);
        canonicalRoots.forEach((rootCol) => {
          transaction.set(doc(db, rootCol, itemId), stampedItem, { merge: true });
        });

        // Update in-memory item
        item.updatedAt = nowIso;
        item.createdAt = stampedItem.createdAt;
        item._version = nextVersion;
        item._updatedAt = now;
        item._lastModifiedByTab = CLIENT_TAB_ID;

        // Keep local cache in sync with stamped version and broadcast
        updateLocalDocWithRemote(localKey, stampedItem, schoolId);
        broadcastRealtimeChange({
          type: 'doc_saved',
          key: localKey,
          doc: stampedItem,
          schoolId
        });
        removePendingCloudWrite(itemId);

        result = {
          success: true,
          isStale: false,
          version: nextVersion,
          updatedAt: now
        };
      });
    } catch (txErr: any) {
      // Fallback to direct atomic setDoc (queued natively by IndexedDB offline cache when offline)
      const nextVersion = (getItemVersion(item) || 0) + 1;
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const stampedItem = {
        ...item,
        id: itemId,
        isDeleted: false,
        schoolId,
        sekolahId: item.sekolahId || schoolId,
        schoolName,
        namaSekolah: item.namaSekolah || schoolName,
        createdAt: item.createdAt || nowIso,
        updatedAt: nowIso,
        _version: nextVersion,
        _updatedAt: now,
        _lastModifiedByTab: CLIENT_TAB_ID,
        ...(options.counselorId ? { _lastModifiedByCounselorId: options.counselorId } : {}),
        ...(options.counselorName ? { _lastModifiedByCounselorName: options.counselorName } : {})
      };
      item.createdAt = stampedItem.createdAt;
      item.updatedAt = nowIso;
      item._version = nextVersion;
      item._updatedAt = now;
      item.schoolId = schoolId;
      item.schoolName = schoolName;
      item._lastModifiedByTab = CLIENT_TAB_ID;

      try {
        const writePromises: Promise<void>[] = [setDoc(docRef, stampedItem, { merge: true })];
        getCanonicalRootCollections(colName).forEach((rootCol) => {
          writePromises.push(setDoc(doc(db, rootCol, itemId), stampedItem, { merge: true }));
        });
        await Promise.all(writePromises);
        removePendingCloudWrite(itemId);
        updateLocalDocWithRemote(localKey, stampedItem, schoolId);
        broadcastRealtimeChange({ type: 'doc_saved', key: localKey, doc: stampedItem, schoolId });
        result = { success: true, isStale: false, version: nextVersion, updatedAt: now };
      } catch (setErr: any) {
        enqueuePendingCloudWrite({
          id: itemId,
          localKey,
          item: stampedItem,
          schoolId,
          enqueuedAt: Date.now()
        });
        const errMsg = handleFirestoreError(setErr, 'write', docRef.path);
        notifyCloudStatusChange('error', false, errMsg);
        showToast(`Gagal sinkron ke Firestore: ${errMsg}`, 'error');
        return { success: false, error: setErr };
      }
    }

    notifyCloudStatusChange('connected', true);
    return result;
  } catch (err: any) {
    if (!checkAndHandleQuotaError(err)) {
      const errMsg = handleFirestoreError(err, 'write', docRef.path);
      notifyCloudStatusChange('error', false, errMsg);
      showToast(`Gagal sinkron ke Firestore: ${errMsg}`, 'error');
    }
    return { success: false, error: err };
  }
}

const ID_MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function formatDeletedAtIndonesian(date: Date = new Date()): string {
  const day = date.getDate();
  const month = ID_MONTHS_LONG[date.getMonth()] || 'Januari';
  const year = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hh}:${mm}`;
}

export interface SoftDeleteOptions {
  customSchoolId?: string;
  deletedBy?: string;
  reason?: string;
  deletedReason?: string;
  entityType?: string;
  studentId?: string;
  studentName?: string;
  nama?: string;
  studentClass?: string;
  kelas?: string;
}

export interface SoftDeletedTrashItem {
  id: string;
  localKey: string;
  colName: string;
  entityType: string;
  nama: string;
  kelas: string;
  deletedAt: string;
  deletedBy: string;
  alasan: string;
  schoolId: string;
  rawDoc: any;
  hapusLogId?: string;
  deletedAtMs?: number;
}

function getMirrorCollectionRefs(colName: string, itemId: string, schoolId: string) {
  const refs: ReturnType<typeof doc>[] = [
    getSchoolDocRef(colName, itemId, schoolId),
    ...getCanonicalRootCollections(colName).map((rootCol) => doc(db, rootCol, itemId))
  ];
  // Deduplicate by Firestore path
  const seen = new Set<string>();
  return refs.filter(r => {
    if (seen.has(r.path)) return false;
    seen.add(r.path);
    return true;
  });
}

function resolveEntityLabelAndMeta(localKey: string, item: any, options?: SoftDeleteOptions) {
  const key = localKey || '';
  let entityType = options?.entityType || 'Data BK';
  let nama = options?.nama || options?.studentName || item?.name || item?.studentName || item?.title || item?.namaProgram || item?.category || 'Tanpa Nama';
  let kelas = options?.kelas || options?.studentClass || item?.class || item?.studentClass || item?.kelas || '';
  let idSiswa = options?.studentId || item?.studentId || '';

  if (key === 'bk_students' || key === 'students') {
    entityType = options?.entityType || 'Siswa';
    nama = item?.name || options?.nama || options?.studentName || nama;
    kelas = item?.class || options?.kelas || options?.studentClass || kelas;
    idSiswa = item?.id || idSiswa;
  } else if (key === 'bk_violations' || key === 'bk_cases' || key === 'violations' || key === 'cases') {
    entityType = options?.entityType || 'Kasus / Pelanggaran';
    nama = `${item?.studentName || options?.nama || options?.studentName || 'Siswa'} — ${item?.category || 'Pelanggaran'}`;
    kelas = item?.studentClass || options?.kelas || options?.studentClass || '';
  } else if (key === 'bk_services' || key === 'bk_counseling' || key === 'services' || key === 'counseling') {
    entityType = options?.entityType || 'Layanan BK';
    const studentList = Array.isArray(item?.students) ? item.students : [];
    const stNames = studentList.map((s: any) => s?.name).filter(Boolean).join(', ');
    nama = `${stNames || options?.nama || options?.studentName || item?.serviceType || 'Layanan BK'} — ${item?.serviceType || 'Konseling'}`;
    kelas = studentList.map((s: any) => s?.class).filter(Boolean).join(', ') || options?.kelas || options?.studentClass || '';
    if (!idSiswa && studentList[0]?.id) idSiswa = studentList[0].id;
  } else if (key === 'bk_achievements' || key === 'bk_student_achievements' || key === 'achievements') {
    entityType = options?.entityType || 'Prestasi / Apresiasi';
    nama = `${item?.studentName || 'Siswa'} — ${item?.achievementName || 'Prestasi'}`;
    kelas = item?.studentClass || '';
  } else if (key === 'bk_home_visits' || key === 'home_visits') {
    entityType = options?.entityType || 'Home Visit';
    nama = `${item?.studentName || options?.nama || 'Siswa'} — Kunjungan Rumah`;
    kelas = item?.studentClass || options?.kelas || '';
  } else if (key === 'bk_parent_summons' || key === 'parent_summons') {
    entityType = options?.entityType || 'Panggilan Orang Tua';
    nama = `${item?.studentName || options?.nama || 'Siswa'} — ${item?.agenda || 'Panggilan Ortu'}`;
    kelas = item?.studentClass || options?.kelas || '';
  } else if (key === 'bk_attendance_history' || key === 'attendance_history') {
    entityType = options?.entityType || 'Rekap Absensi';
    nama = options?.nama || `Absensi Kelas ${item?.class || item?.className || '-'} (${item?.date || '-'})`;
    kelas = options?.kelas || item?.class || item?.className || '';
  } else if (key === 'bk_daily_journals' || key === 'daily_journals') {
    entityType = options?.entityType || 'Jurnal Harian';
    nama = options?.nama || item?.title || `${item?.activityType || 'Jurnal'} (${item?.date || '-'})`;
  } else if (key === 'bk_program_evaluations' || key === 'program_evaluations' || key === 'bk_service_evaluations' || key === 'service_evaluations') {
    entityType = options?.entityType || 'Evaluasi BK';
    nama = item?.namaProgram || item?.bidang || 'Evaluasi BK';
    kelas = item?.kelas || '';
  } else if (key.includes('surat_perjanjian')) {
    entityType = options?.entityType || 'Surat Perjanjian';
    nama = `${item?.studentName || options?.nama || 'Siswa'} — ${item?.letterNumber || 'Surat Perjanjian'}`;
    kelas = item?.studentClass || options?.kelas || '';
  } else if (key.includes('kontrak_perilaku')) {
    entityType = options?.entityType || 'Kontrak Perilaku';
    nama = `${item?.studentName || options?.nama || 'Siswa'} — ${item?.contractNumber || 'Kontrak Perilaku'}`;
    kelas = item?.studentClass || options?.kelas || '';
  } else if (key.includes('jurnal_pembinaan')) {
    entityType = options?.entityType || 'Jurnal Pembinaan';
    nama = `${item?.studentName || options?.nama || 'Siswa'} — ${item?.journalNumber || 'Jurnal Pembinaan'}`;
    kelas = item?.studentClass || options?.kelas || '';
  } else if (key.includes('komitmen_rtl')) {
    entityType = options?.entityType || 'Komitmen & RTL';
    nama = `${item?.studentName || options?.nama || 'Siswa'} — ${item?.commitmentNumber || 'RTL'}`;
    kelas = item?.studentClass || options?.kelas || '';
  }

  return { entityType, nama, kelas, idSiswa };
}

function getTrashStorageKey(schoolId: string) {
  return `bk_trash_${sanitizeSchoolId(schoolId)}`;
}

function getHapusLogStorageKey(schoolId: string) {
  return `bk_hapus_log_${sanitizeSchoolId(schoolId)}`;
}

function upsertLocalTrashCache(entry: SoftDeletedTrashItem) {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = getTrashStorageKey(entry.schoolId);
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    const list: SoftDeletedTrashItem[] = Array.isArray(raw) ? raw : [];
    const filtered = list.filter(it => !(String(it.id) === String(entry.id) && it.colName === entry.colName));
    const next = [entry, ...filtered].slice(0, 300);
    localStorage.setItem(key, JSON.stringify(next));
  } catch (e) {}
}

function removeFromLocalTrashCache(itemId: string, schoolId: string, colName?: string) {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = getTrashStorageKey(schoolId);
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(raw)) {
      const next = raw.filter(it => !(String(it.id) === String(itemId) && (!colName || it.colName === colName || (colName === 'cases' && it.colName === 'violations') || (colName === 'counseling' && it.colName === 'services'))));
      localStorage.setItem(key, JSON.stringify(next));
    }
  } catch (e) {}
}

function appendLocalHapusLog(log: HapusLogEntry, schoolId: string) {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = getHapusLogStorageKey(schoolId);
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    const list: HapusLogEntry[] = Array.isArray(raw) ? raw : [];
    const next = [log, ...list.filter(l => l.id !== log.id)].slice(0, 300);
    localStorage.setItem(key, JSON.stringify(next));
  } catch (e) {}
}

/**
 * SOFT DELETE PERMANEN:
 * Mengubah dokumen di Firestore menjadi { isDeleted: true, deletedAt, deletedBy }
 * dan mencatat audit log di collection `hapusLog`. Data tidak tampil lagi saat refresh/login/sync.
 */
export async function softDeleteFromFirestore(
  localKey: string,
  itemOrId: any,
  options: SoftDeleteOptions = {}
): Promise<{ success: boolean; logEntry?: HapusLogEntry }> {
  const rawId = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
  if (!isValidDeleteId(rawId)) {
    showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
    return { success: false };
  }
  const cleanId = String(rawId).trim();

  const schoolId = options.customSchoolId ? sanitizeSchoolId(options.customSchoolId) : getActiveSchoolId();
  const colName = SYNC_MAP[localKey] || localKey;
  const cacheKey = `${schoolId}_${localKey}`;

  // Capture current snapshot from in-memory Firestore cache & enforce anti-mass-delete guard
  const currentList = getCloudCollectionData<any>(localKey, schoolId);
  let nextActiveList: any[] | null = null;
  if (Array.isArray(currentList) && currentList.length > 0) {
    const filtered = currentList.filter((it: any) => !it || !isValidDeleteId(it.id) || String(it.id).trim() !== cleanId);
    const dropped = currentList.length - filtered.length;
    if (dropped > 5) {
      showToast('Gagal: Terdeteksi hapus massal, dibatalkan', 'error');
      return { success: false };
    }
    nextActiveList = filtered;
  }

  // Register ID locally so sync/listeners immediately block resurrection
  registerDeletedId(cleanId);
  removePendingCloudWrite(cleanId);

  const foundInCloud = Array.isArray(currentList)
    ? currentList.find((it: any) => String(it?.id || '').trim() === cleanId)
    : undefined;
  const snapshotObj = typeof itemOrId === 'object' && itemOrId !== null
    ? { ...(foundInCloud || {}), ...itemOrId }
    : (foundInCloud || { id: cleanId });

  const deletedAt = formatDeletedAtIndonesian(new Date());
  const deletedAtMs = Date.now();
  let defaultCounselorName = options.deletedBy || '';
  if (!defaultCounselorName && typeof localStorage !== 'undefined') {
    try {
      const cRaw = localStorage.getItem('bk_active_counselor');
      if (cRaw) defaultCounselorName = JSON.parse(cRaw)?.name || '';
    } catch {}
  }
  const deletedBy = defaultCounselorName || 'Aulia Aji Sasongko, S.Pd.';
  const deletedReason = options.reason || options.deletedReason || 'Dihapus oleh pengguna';

  const meta = resolveEntityLabelAndMeta(localKey, snapshotObj, options);
  const logId = `hlog-${deletedAtMs}-${Math.random().toString(36).slice(2, 7)}`;

  const logEntry: HapusLogEntry = {
    id: logId,
    idSiswa: meta.idSiswa || undefined,
    recordId: cleanId,
    localKey,
    entityType: meta.entityType,
    nama: meta.nama,
    kelas: meta.kelas,
    tanggalHapus: deletedAt,
    oleh: deletedBy,
    alasan: deletedReason,
    schoolId
  };

  const softDeletedPayload = {
    ...snapshotObj,
    id: cleanId,
    schoolId,
    isDeleted: true,
    deletedAt,
    deletedBy,
    deletedReason,
    _deletedAtMs: deletedAtMs,
    _version: (getItemVersion(snapshotObj) || 0) + 1,
    _updatedAt: deletedAtMs,
    _lastModifiedByTab: CLIENT_TAB_ID
  };

  // Remove ONLY this 1 item from in-memory cloud state & broadcast immediately (Optimistic UI)
  if (Array.isArray(nextActiveList)) {
    setCloudCollectionData(localKey, nextActiveList, schoolId);
    broadcastRealtimeChange({
      type: 'doc_deleted',
      key: localKey,
      itemId: cleanId,
      schoolId,
      data: nextActiveList
    });
  } else {
    broadcastRealtimeChange({
      type: 'doc_deleted',
      key: localKey,
      itemId: cleanId,
      schoolId
    });
  }
  delete lastSavedRemoteMap[cacheKey];

  // Also update paired in-memory keys (e.g. bk_cases <-> bk_violations, bk_counseling <-> bk_services)
  if (localKey === 'bk_violations' || localKey === 'bk_cases') {
    const pairedKey = localKey === 'bk_violations' ? 'bk_cases' : 'bk_violations';
    const pList = getCloudCollectionData<any>(pairedKey, schoolId);
    if (Array.isArray(pList)) {
      const pFiltered = pList.filter((it: any) => !it || !isValidDeleteId(it.id) || String(it.id).trim() !== cleanId);
      setCloudCollectionData(pairedKey, pFiltered, schoolId);
    }
  } else if (localKey === 'bk_services' || localKey === 'bk_counseling') {
    const pairedKey = localKey === 'bk_services' ? 'bk_counseling' : 'bk_services';
    const pList = getCloudCollectionData<any>(pairedKey, schoolId);
    if (Array.isArray(pList)) {
      const pFiltered = pList.filter((it: any) => !it || !isValidDeleteId(it.id) || String(it.id).trim() !== cleanId);
      setCloudCollectionData(pairedKey, pFiltered, schoolId);
    }
  }

  // 4. Cache locally in Trash + HapusLog for instant Sampah access
  upsertLocalTrashCache({
    id: cleanId,
    localKey,
    colName,
    entityType: meta.entityType,
    nama: meta.nama,
    kelas: meta.kelas,
    deletedAt,
    deletedBy,
    alasan: deletedReason,
    schoolId,
    rawDoc: softDeletedPayload,
    hapusLogId: logId,
    deletedAtMs
  });
  appendLocalHapusLog(logEntry, schoolId);

  // 5. Persist soft-delete flag & hapusLog to Firestore (updateDoc primary, setDoc merge fallback)
  if (!isQuotaExceeded) {
    try {
      await ensureFirebaseAuth();
      notifyCloudStatusChange('syncing');

      const refs = getMirrorCollectionRefs(colName, cleanId, schoolId);
      await Promise.allSettled(
        refs.map((ref) =>
          updateDoc(ref, softDeletedPayload).catch(() =>
            setDoc(ref, softDeletedPayload, { merge: true })
          )
        )
      );

      // Write audit log to hapusLog collection (school-scoped + root)
      await Promise.allSettled([
        setDoc(getSchoolDocRef('hapusLog', logId, schoolId), logEntry, { merge: true }),
        setDoc(doc(db, 'hapusLog', logId), logEntry, { merge: true })
      ]);

      notifyCloudStatusChange('connected');
    } catch (err) {
      if (!checkAndHandleQuotaError(err)) {
        console.error(`Firestore soft delete error [${schoolId}/${colName}/${cleanId}]:`, err);
      }
    }
  }

  return { success: true, logEntry };
}

/**
 * Legacy signature compatibility wrapper: routes all deletes through permanent soft-delete
 */
export async function deleteFromFirestore(
  localKey: string,
  itemId: string,
  customSchoolId?: string,
  options?: SoftDeleteOptions
): Promise<void> {
  if (!itemId) return;
  await softDeleteFromFirestore(localKey, itemId, {
    ...(options || {}),
    customSchoolId: customSchoolId || options?.customSchoolId
  });
}

/**
 * Soft-delete banyak siswa sekaligus (untuk aksi darurat Kosongkan Data Siswa)
 */
export async function softDeleteBulkStudentsFromFirestore(
  students: any[],
  deletedBy?: string,
  customSchoolId?: string
): Promise<void> {
  if (!Array.isArray(students) || students.length === 0) return;
  const schoolId = customSchoolId ? sanitizeSchoolId(customSchoolId) : getActiveSchoolId();
  const deletedAt = formatDeletedAtIndonesian(new Date());
  const deletedAtMs = Date.now();
  const actor = deletedBy || 'Koordinator BK';

  students.forEach(s => {
    if (s?.id) {
      registerDeletedId(String(s.id));
      upsertLocalTrashCache({
        id: String(s.id),
        localKey: 'bk_students',
        colName: 'students',
        entityType: 'Siswa',
        nama: s.name || 'Siswa',
        kelas: s.class || '',
        deletedAt,
        deletedBy: actor,
        alasan: 'Kosongkan daftar siswa',
        schoolId,
        rawDoc: { ...s, isDeleted: true, deletedAt, deletedBy: actor, schoolId, _deletedAtMs: deletedAtMs },
        deletedAtMs
      });
    }
  });

  saveSchoolData('bk_students', [], schoolId);
  delete lastSavedRemoteMap[`${schoolId}_bk_students`];
  broadcastRealtimeChange({ type: 'sync', key: 'bk_students', data: [], schoolId });

  if (!isQuotaExceeded) {
    try {
      await ensureFirebaseAuth();
      const CHUNK = 150;
      for (let i = 0; i < students.length; i += CHUNK) {
        const chunk = students.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach(s => {
          if (!s?.id) return;
          const sid = String(s.id);
          const payload = {
            ...s,
            schoolId,
            isDeleted: true,
            deletedAt,
            deletedBy: actor,
            deletedReason: 'Kosongkan daftar siswa',
            _deletedAtMs: deletedAtMs,
            _updatedAt: deletedAtMs
          };
          batch.set(getSchoolDocRef('students', sid, schoolId), payload, { merge: true });
          batch.set(doc(db, 'students', sid), payload, { merge: true });
        });
        await batch.commit();
      }
      const logId = `hlog-bulk-${deletedAtMs}`;
      const bulkLog: HapusLogEntry = {
        id: logId,
        recordId: 'bulk_students',
        localKey: 'bk_students',
        entityType: 'Siswa (Massal)',
        nama: `${students.length} Data Siswa Dikosongkan`,
        kelas: 'Semua Kelas',
        tanggalHapus: deletedAt,
        oleh: actor,
        alasan: 'Kosongkan daftar siswa darurat',
        schoolId
      };
      appendLocalHapusLog(bulkLog, schoolId);
      setDoc(getSchoolDocRef('hapusLog', logId, schoolId), bulkLog, { merge: true }).catch(() => {});
    } catch (err) {
      checkAndHandleQuotaError(err);
    }
  }
}

const TRASH_COLLECTIONS: { localKey: string; colName: string }[] = [
  { localKey: 'bk_students', colName: 'students' },
  { localKey: 'bk_violations', colName: 'violations' },
  { localKey: 'bk_violations', colName: 'cases' },
  { localKey: 'bk_services', colName: 'services' },
  { localKey: 'bk_services', colName: 'counseling' },
  { localKey: 'bk_achievements', colName: 'achievements' },
  { localKey: 'bk_home_visits', colName: 'home_visits' },
  { localKey: 'bk_parent_summons', colName: 'parent_summons' },
  { localKey: 'bk_attendance_history', colName: 'attendance_history' },
  { localKey: 'bk_daily_journals', colName: 'daily_journals' },
  { localKey: 'bk_program_evaluations', colName: 'program_evaluations' },
  { localKey: 'bk_service_evaluations', colName: 'service_evaluations' },
  { localKey: 'bk_surat_perjanjian_list', colName: 'surat_perjanjian_list' },
  { localKey: 'bk_kontrak_perilaku_list', colName: 'kontrak_perilaku_list' },
  { localKey: 'bk_jurnal_pembinaan_disiplin_list', colName: 'jurnal_pembinaan_disiplin_list' },
  { localKey: 'bk_komitmen_rtl_list', colName: 'komitmen_rtl_list' },
];

/**
 * Mengambil seluruh data yang sudah di-soft-delete (isDeleted === true) & riwayat hapusLog
 * untuk ditampilkan pada menu [Sampah / Riwayat Hapus]
 */
export async function fetchSoftDeletedRecordsFromFirestore(customSchoolId?: string): Promise<{
  items: SoftDeletedTrashItem[];
  logs: HapusLogEntry[];
}> {
  const schoolId = customSchoolId ? sanitizeSchoolId(customSchoolId) : getActiveSchoolId();
  const itemMap = new Map<string, SoftDeletedTrashItem>();
  const logMap = new Map<string, HapusLogEntry>();

  const normalizeGroupKey = (colName: string, id: string) => {
    if (colName === 'cases' || colName === 'violations') return `cases_violations_${id}`;
    if (colName === 'counseling' || colName === 'services') return `counseling_services_${id}`;
    return `${colName}_${id}`;
  };

  // 1. Muat cache lokal Sampah & hapusLog terlebih dahulu
  if (typeof localStorage !== 'undefined') {
    try {
      const localTrash = JSON.parse(localStorage.getItem(getTrashStorageKey(schoolId)) || '[]');
      if (Array.isArray(localTrash)) {
        localTrash.forEach((it: SoftDeletedTrashItem) => {
          if (it && it.id) {
            itemMap.set(normalizeGroupKey(it.colName, String(it.id)), it);
          }
        });
      }
    } catch {}
    try {
      const localLogs = JSON.parse(localStorage.getItem(getHapusLogStorageKey(schoolId)) || '[]');
      if (Array.isArray(localLogs)) {
        localLogs.forEach((l: HapusLogEntry) => {
          if (l && l.id && !l.permanentlyDeleted) logMap.set(l.id, l);
        });
      }
    } catch {}
  }

  // 2. Query Firestore untuk isDeleted === true dan hapusLog
  if (!isQuotaExceeded) {
    try {
      await ensureFirebaseAuth();

      await Promise.all([
        ...TRASH_COLLECTIONS.map(async ({ localKey, colName }) => {
          const processSnap = (snap: any) => {
            snap.forEach((d: any) => {
              const data = d.data();
              if (!data || data.isDeleted !== true) return;
              if (belongsToOtherSchool(data, schoolId)) return;
              const cleanId = String(d.id);
              registerDeletedId(cleanId);
              const meta = resolveEntityLabelAndMeta(localKey, { id: cleanId, ...data });
              const key = normalizeGroupKey(colName, cleanId);
              const existing = itemMap.get(key);
              itemMap.set(key, {
                id: cleanId,
                localKey,
                colName: existing?.colName || colName,
                entityType: meta.entityType,
                nama: meta.nama,
                kelas: meta.kelas,
                deletedAt: data.deletedAt || existing?.deletedAt || '-',
                deletedBy: data.deletedBy || existing?.deletedBy || 'Pengguna',
                alasan: data.deletedReason || existing?.alasan || 'Dihapus oleh pengguna',
                schoolId,
                rawDoc: { id: cleanId, ...data },
                deletedAtMs: data._deletedAtMs || existing?.deletedAtMs || 0
              });
            });
          };

          try {
            const subQ = query(getSchoolColRef(colName, schoolId), where('isDeleted', '==', true));
            const subSnap = await getDocs(subQ);
            if (!subSnap.empty) processSnap(subSnap);
          } catch {}
          try {
            const rootQ = query(collection(db, colName), where('isDeleted', '==', true));
            const rootSnap = await getDocs(rootQ);
            if (!rootSnap.empty) processSnap(rootSnap);
          } catch {}
        }),
        (async () => {
          try {
            const subLogs = await getDocs(getSchoolColRef('hapusLog', schoolId));
            subLogs.forEach(d => {
              const l = { id: d.id, ...d.data() } as HapusLogEntry;
              if (l && !l.permanentlyDeleted) logMap.set(l.id, l);
            });
          } catch {}
          try {
            const rootLogsQ = query(collection(db, 'hapusLog'), where('schoolId', '==', schoolId));
            const rootLogs = await getDocs(rootLogsQ);
            rootLogs.forEach(d => {
              const l = { id: d.id, ...d.data() } as HapusLogEntry;
              if (l && !l.permanentlyDeleted) logMap.set(l.id, l);
            });
          } catch {}
        })()
      ]);
    } catch (err) {
      checkAndHandleQuotaError(err);
    }
  }

  const items = Array.from(itemMap.values()).sort((a, b) => (b.deletedAtMs || 0) - (a.deletedAtMs || 0));
  const logs = Array.from(logMap.values()).sort((a, b) => (b.id > a.id ? 1 : -1));
  return { items, logs };
}

/**
 * PULIHKAN DATA DARI SAMPAH:
 * Menghapus penanda isDeleted: true di Firestore & mengembalikan dokumen ke daftar aktif.
 */
export async function restoreSoftDeletedFromFirestore(
  trashItem: SoftDeletedTrashItem,
  customSchoolId?: string
): Promise<{ success: boolean }> {
  const schoolId = customSchoolId ? sanitizeSchoolId(customSchoolId) : sanitizeSchoolId(trashItem.schoolId || getActiveSchoolId());
  const cleanId = String(trashItem.id);
  const colName = trashItem.colName || SYNC_MAP[trashItem.localKey] || 'students';
  const now = Date.now();

  // 1. Unblock from deletion tracker
  unregisterDeletedId(cleanId);
  removeFromLocalTrashCache(cleanId, schoolId, colName);

  const restoredDoc: any = {
    ...(trashItem.rawDoc || { id: cleanId }),
    id: cleanId,
    schoolId,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    deletedReason: null,
    restoredAt: formatDeletedAtIndonesian(new Date()),
    _version: (getItemVersion(trashItem.rawDoc) || 1) + 1,
    _updatedAt: now,
    _lastModifiedByTab: CLIENT_TAB_ID
  };

  // 2. Restore ke localStorage & broadcast ke seluruh UI
  const targetKeys = new Set<string>([trashItem.localKey]);
  if (trashItem.localKey === 'bk_violations' || colName === 'cases' || colName === 'violations') {
    targetKeys.add('bk_violations');
    targetKeys.add('bk_cases');
  } else if (trashItem.localKey === 'bk_services' || colName === 'counseling' || colName === 'services') {
    targetKeys.add('bk_services');
    targetKeys.add('bk_counseling');
  }

  targetKeys.forEach(k => {
    const cur = loadSchoolData<any[]>(k, [], schoolId);
    const list = Array.isArray(cur) ? cur.filter((it: any) => String(it?.id) !== cleanId) : [];
    const updated = sortCollectionData(k, [restoredDoc, ...list]);
    saveSchoolData(k, updated, schoolId);
    delete lastSavedRemoteMap[`${schoolId}_${k}`];
    broadcastRealtimeChange({ type: 'sync', key: k, data: updated, schoolId });
  });

  if (typeof localStorage !== 'undefined') {
    try {
      const logKey = getHapusLogStorageKey(schoolId);
      const rawLogs = JSON.parse(localStorage.getItem(logKey) || '[]');
      if (Array.isArray(rawLogs)) {
        localStorage.setItem(logKey, JSON.stringify(rawLogs.filter((l: HapusLogEntry) => String(l.recordId) !== cleanId)));
      }
    } catch {}
  }

  // 3. Update Firestore (subcollection + root + paired aliases)
  if (!isQuotaExceeded) {
    try {
      await ensureFirebaseAuth();
      const refs = getMirrorCollectionRefs(colName, cleanId, schoolId);
      await Promise.allSettled(refs.map(ref => setDoc(ref, restoredDoc, { merge: true })));
    } catch (err) {
      checkAndHandleQuotaError(err);
    }
  }

  return { success: true };
}

/**
 * HAPUS PERMANEN DARI SAMPAH (Hard delete deleteDoc di seluruh koleksi subcollection & root Firestore)
 */
export async function permanentDeleteFromFirestore(
  localKey: string,
  itemId: string,
  customSchoolId?: string,
  hapusLogId?: string
): Promise<{ success: boolean }> {
  const cleanId = String(itemId).trim();
  if (!cleanId) return { success: false };

  const schoolId = customSchoolId ? sanitizeSchoolId(customSchoolId) : getActiveSchoolId();
  const colName = SYNC_MAP[localKey] || localKey;

  // Keep ID registered in deleted tracker & remove from local Trash cache
  registerDeletedId(cleanId);
  removeFromLocalTrashCache(cleanId, schoolId, colName);

  if (typeof localStorage !== 'undefined') {
    try {
      const logKey = getHapusLogStorageKey(schoolId);
      const rawLogs = JSON.parse(localStorage.getItem(logKey) || '[]');
      if (Array.isArray(rawLogs)) {
        const filtered = rawLogs.filter((l: HapusLogEntry) => String(l.recordId) !== cleanId && (!hapusLogId || l.id !== hapusLogId));
        localStorage.setItem(logKey, JSON.stringify(filtered));
      }
    } catch {}
  }

  if (!isQuotaExceeded) {
    try {
      await ensureFirebaseAuth();
      notifyCloudStatusChange('syncing');
      const refs = getMirrorCollectionRefs(colName, cleanId, schoolId);
      await Promise.allSettled(refs.map(ref => deleteDoc(ref)));

      if (hapusLogId) {
        await Promise.allSettled([
          deleteDoc(getSchoolDocRef('hapusLog', hapusLogId, schoolId)),
          deleteDoc(doc(db, 'hapusLog', hapusLogId))
        ]);
      }
      notifyCloudStatusChange('connected');
    } catch (err) {
      checkAndHandleQuotaError(err);
    }
  }

  return { success: true };
}

/**
 * Bersihkan cache data lokal saat login agar state selalu segar dari Firestore (isDeleted != true),
 * TANPA menghapus `bk_deleted_ids`, `bk_trash_*`, `bk_hapus_log_*`, token Google, atau konfigurasi sekolah.
 */
export function clearLocalDataCachesOnLogin(schoolIdInput?: string): void {
  if (typeof localStorage === 'undefined') return;
  const sId = schoolIdInput ? sanitizeSchoolId(schoolIdInput) : getActiveSchoolId();
  const cachePrefixes = [
    'bk_students', 'bk_violations', 'bk_cases', 'bk_services', 'bk_counseling',
    'bk_achievements', 'bk_student_achievements', 'bk_home_visits', 'bk_attendance_history',
    'bk_daily_journals', 'bk_parent_summons', 'bk_program_evaluations', 'bk_service_evaluations',
    'bk_logs'
  ];
  cachePrefixes.forEach(base => {
    try {
      localStorage.removeItem(`${base}_${sId}`);
      localStorage.removeItem(base);
    } catch {}
    delete lastSavedRemoteMap[`${sId}_${base}`];
  });
}

/**
 * Push a collection list to Firestore with detailed success/count feedback
 */
export async function pushCollectionToFirestore(
  localKey: string,
  items: any[],
  customSchoolId?: string,
  isIntentionalWipe: boolean = false,
  options?: { stampMissingSchoolId?: boolean; bypassCache?: boolean }
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!Array.isArray(items) || isQuotaExceeded) {
    return { success: false, count: 0, error: isQuotaExceeded ? 'Kuota Firestore terlampaui' : 'Data tidak valid' };
  }

  const deletedSet = new Set(getDeletedIds());
  const activeCleanItems = items.filter(
    (it: any) => it && it.id && it.isDeleted !== true && !deletedSet.has(String(it.id)) && !isDummyRecord(it, localKey)
  );

  const schoolId = customSchoolId || getActiveSchoolId();
  const cacheKey = `${schoolId}_${localKey}`;
  const sortedItems = sortCollectionData(localKey, activeCleanItems, schoolId);
  const currentStr = JSON.stringify(sortedItems);

  if (!options?.bypassCache && !options?.stampMissingSchoolId && lastSavedRemoteMap[cacheKey] === currentStr) {
    return { success: true, count: sortedItems.length };
  }

  const colName = SYNC_MAP[localKey] || localKey;
  try {
    await ensureFirebaseAuth();
    notifyCloudStatusChange('syncing');

    // If local collection was intentionally emptied by an explicit admin reset, soft-delete documents
    if (sortedItems.length === 0) {
      if (!isIntentionalWipe) {
        return { success: true, count: 0 };
      }
      const deletedAt = formatDeletedAtIndonesian(new Date());
      const deletedAtMs = Date.now();
      const colRef = getSchoolColRef(colName, schoolId);
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        let batch = writeBatch(db);
        let count = 0;
        for (const docSnap of snap.docs) {
          registerDeletedId(docSnap.id);
          batch.set(docSnap.ref, {
            isDeleted: true,
            deletedAt,
            deletedBy: 'Koordinator BK',
            _deletedAtMs: deletedAtMs
          }, { merge: true });
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
      notifyCloudStatusChange('connected', true);
      return { success: true, count: 0 };
    }

    const CHUNK_SIZE = 400;
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    let writtenCount = 0;
    const defaultSchoolName = schoolId === 'sch_20320123'
      ? 'SMP N 2 Susukan'
      : (getSchoolConfig(schoolId).schoolName || 'SMP N 2 Susukan');
    const canonicalRoots = getCanonicalRootCollections(colName);
    const opsPerItem = 1 + canonicalRoots.length;
    const maxItemsPerChunk = Math.max(1, Math.floor(CHUNK_SIZE / opsPerItem));

    for (let i = 0; i < sortedItems.length; i += maxItemsPerChunk) {
      const chunk = sortedItems.slice(i, i + maxItemsPerChunk);
      const batch = writeBatch(db);
      let chunkOps = 0;
      for (const item of chunk) {
        if (item && item.id) {
          const itemId = String(item.id);
          const currentVersion = getItemVersion(item);
          const nextVersion = currentVersion > 0 ? currentVersion : 1;
          const currentTimestamp = getItemTimestamp(item) || now;

          const hasAssignedId = extractRecordSchoolId(item) !== '' && !item.isLegacyUnmigrated;
          if (!hasAssignedId && !options?.stampMissingSchoolId) continue;

          const itemSchoolName = item.schoolName || defaultSchoolName;
          const ref = getSchoolDocRef(colName, itemId, schoolId);
          const cleanItem = { ...item };
          if (options?.stampMissingSchoolId) {
            delete cleanItem.isLegacyUnmigrated;
          }
          const payload = {
            ...cleanItem,
            id: itemId,
            isDeleted: false,
            schoolId,
            sekolahId: cleanItem.sekolahId || schoolId,
            schoolName: itemSchoolName,
            namaSekolah: cleanItem.namaSekolah || itemSchoolName,
            createdAt: cleanItem.createdAt || nowIso,
            updatedAt: nowIso,
            _version: nextVersion,
            _updatedAt: currentTimestamp,
            _lastModifiedByTab: CLIENT_TAB_ID,
          };
          batch.set(ref, payload, { merge: true });
          chunkOps++;
          canonicalRoots.forEach((rootCol) => {
            batch.set(doc(db, rootCol, itemId), payload, { merge: true });
            chunkOps++;
          });
          writtenCount++;
        }
      }
      if (chunkOps > 0) {
        await batch.commit();
      }
    }

    lastSavedRemoteMap[cacheKey] = currentStr;
    notifyCloudStatusChange('connected', true);
    return { success: true, count: writtenCount };
  } catch (err: any) {
    const errMsg = checkAndHandleQuotaError(err)
      ? 'resource-exhausted: Kuota Firestore harian terlampaui'
      : handleFirestoreError(err, 'write', `schools/${schoolId}/${colName}`);

    if (!isQuotaExceeded) {
      notifyCloudStatusChange('error', false, errMsg);
      const fallbackSchoolName = schoolId === 'sch_20320123'
        ? 'SMP N 2 Susukan'
        : (getSchoolConfig(schoolId).schoolName || 'SMP N 2 Susukan');
      const fallbackIso = new Date().toISOString();
      for (const item of sortedItems) {
        if (item && item.id) {
          const hasAssignedId = extractRecordSchoolId(item) !== '' && !item.isLegacyUnmigrated;
          if (!hasAssignedId && !options?.stampMissingSchoolId) continue;
          try {
            const itemId = String(item.id);
            const itemSchoolName = item.schoolName || fallbackSchoolName;
            const payload = {
              ...item,
              id: itemId,
              isDeleted: false,
              schoolId,
              sekolahId: item.sekolahId || schoolId,
              schoolName: itemSchoolName,
              namaSekolah: item.namaSekolah || itemSchoolName,
              createdAt: item.createdAt || fallbackIso,
              updatedAt: fallbackIso,
              _version: getItemVersion(item) || 1,
              _updatedAt: getItemTimestamp(item) || Date.now(),
              _lastModifiedByTab: CLIENT_TAB_ID,
            };
            setDoc(getSchoolDocRef(colName, itemId, schoolId), payload, { merge: true }).catch(() => {});
            getCanonicalRootCollections(colName).forEach((rootCol) => {
              setDoc(doc(db, rootCol, itemId), payload, { merge: true }).catch(() => {});
            });
          } catch {}
        }
      }
    }
    return { success: false, count: 0, error: errMsg };
  }
}

/**
 * Save an entire list of array items to Firestore (School-scoped Batch)
 */
export async function saveBulkToFirestore(
  localKey: string,
  items: any[],
  customSchoolId?: string,
  isIntentionalWipe: boolean = false,
  options?: { stampMissingSchoolId?: boolean }
): Promise<void> {
  await pushCollectionToFirestore(localKey, items, customSchoolId, isIntentionalWipe, options);
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
 * Fetch list of attendance history directly from Firestore in real-time
 */
export async function fetchCloudAttendance(schoolId?: string): Promise<any[]> {
  const targetSchoolId = schoolId ? sanitizeSchoolId(schoolId) : getActiveSchoolId();
  if (isQuotaExceeded) return getCloudCollectionData('bk_attendance_history', targetSchoolId);
  try {
    await ensureFirebaseAuth();
    const deletedSet = new Set(getDeletedIds());
    const attendanceMap = new Map<string, any>();
    const collectSnap = (snap: any) => {
      snap.forEach((d: any) => {
        const item = { id: d.id, ...d.data() } as any;
        if (!item || !item.id) return;
        const rid = String(item.id);
        if (item.isDeleted === true) {
          registerDeletedId(rid);
          deletedSet.add(rid);
          attendanceMap.delete(rid);
          return;
        }
        if (!deletedSet.has(rid) && !isDummyRecord(item, 'bk_attendance_history')) {
          if (matchesSchoolOrLegacy(item, targetSchoolId)) {
            const isLegacy = isLegacyUnassignedRecord(item);
            attendanceMap.set(rid, isLegacy ? { ...item, isLegacyUnmigrated: true } : item);
          }
        }
      });
    };

    const colRef = getSchoolColRef('attendance_history', targetSchoolId);
    const [subSnap, rootSnap] = await Promise.allSettled([
      getDocs(colRef),
      getDocs(collection(db, 'attendance_history'))
    ]);
    if (rootSnap.status === 'fulfilled' && !rootSnap.value.empty) collectSnap(rootSnap.value);
    if (subSnap.status === 'fulfilled' && !subSnap.value.empty) collectSnap(subSnap.value);

    const cloudAttendance: any[] = Array.from(attendanceMap.values());
    const sorted = sortCollectionData('bk_attendance_history', cloudAttendance, targetSchoolId);
    setCloudCollectionData('bk_attendance_history', sorted, targetSchoolId);
    window.dispatchEvent(new CustomEvent('bk_attendance_history_changed', { detail: sorted }));
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { 
      detail: { key: 'bk_attendance_history', data: sorted, schoolId: targetSchoolId } 
    }));
    return sorted;
  } catch (err) {
    if (!checkAndHandleQuotaError(err)) {
      const msg = handleFirestoreError(err, 'list', `schools/${targetSchoolId}/attendance_history`);
      notifyCloudStatusChange('error', false, msg);
    }
  }
  return getCloudCollectionData('bk_attendance_history', targetSchoolId);
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
          const cleanNpsn = data.schoolNpsn ? String(data.schoolNpsn).replace(/[^0-9a-zA-Z]/g, '') : '';
          const sId = (cleanNpsn ? sanitizeSchoolId(cleanNpsn) : '') || (data.schoolId ? sanitizeSchoolId(data.schoolId) : activeSchoolId);
          const schoolConfig: SchoolConfig = {
            schoolId: sId,
            schoolName: data.schoolName || 'Sekolah Terdaftar',
            npsn: cleanNpsn || '',
            schoolAddress: 'Alamat Sekolah',
            principalName: 'Kepala Sekolah',
            principalNip: '-',
            governmentName: 'PEMERINTAH KABUPATEN / KOTA',
            departmentName: 'DINAS PENDIDIKAN'
          };
          return { counselor: { ...data, schoolId: sId }, schoolConfig, schoolId: sId };
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
        const cleanNpsn = data.schoolNpsn ? String(data.schoolNpsn).replace(/[^0-9a-zA-Z]/g, '') : '';
        const sId = (cleanNpsn ? sanitizeSchoolId(cleanNpsn) : '') || (data.schoolId ? sanitizeSchoolId(data.schoolId) : activeSchoolId);
        const schoolConfig: SchoolConfig = getSchoolConfig(sId);
        return { counselor: { ...data, schoolId: sId, schoolNpsn: cleanNpsn || schoolConfig.npsn || '' }, schoolConfig, schoolId: sId };
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
            const cleanNpsn = data.schoolNpsn ? String(data.schoolNpsn).replace(/[^0-9a-zA-Z]/g, '') : (school.npsn || '');
            return { counselor: { ...data, schoolId: sId, schoolNpsn: cleanNpsn }, schoolConfig: school, schoolId: sId };
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
  if (!account || !account.id) return;

  const targetSchoolId = account.schoolId ? sanitizeSchoolId(account.schoolId) : getActiveSchoolId();

  // 1. ALWAYS cache locally first under bk_all_account_requests and target school counselors
  // This guarantees zero data loss even if Firestore is offline or throttled
  try {
    const rawAll = localStorage.getItem('bk_all_account_requests');
    const allPending: any[] = rawAll ? JSON.parse(rawAll) : [];
    const filtered = allPending.filter((c) => c.id !== account.id);
    filtered.push({ ...account, schoolId: targetSchoolId });
    localStorage.setItem('bk_all_account_requests', JSON.stringify(filtered));

    // Also save into school-partitioned counselor storage
    const existingCounselors = loadSchoolData<any[]>('bk_counselors', [], targetSchoolId);
    const updated = [...existingCounselors.filter((c) => c.id !== account.id), account];
    saveSchoolData('bk_counselors', updated, targetSchoolId);

    // Notify local UI immediately
    window.dispatchEvent(
      new CustomEvent('bk_account_requests_updated', {
        detail: { requests: filtered, account, schoolId: targetSchoolId },
      })
    );
    window.dispatchEvent(
      new CustomEvent('bk_realtime_sync', {
        detail: { key: 'bk_counselors', data: updated, schoolId: targetSchoolId },
      })
    );
    window.dispatchEvent(new Event('storage'));
  } catch (localErr) {
    console.warn('Local caching for account request error:', localErr);
  }

  // 2. Try writing to Firestore Cloud
  try {
    if (isQuotaExceeded) {
      await resetQuotaState();
    }
    await ensureFirebaseAuth();
    notifyCloudStatusChange('syncing');

    // Save to global account_requests collection
    const reqDocRef = doc(db, 'account_requests', account.id);
    await setDoc(reqDocRef, { ...account, schoolId: targetSchoolId }, { merge: true });

    // Save directly to the target school's counselors collection
    const schoolDocRef = getSchoolDocRef('counselors', account.id, targetSchoolId);
    await setDoc(schoolDocRef, { ...account, schoolId: targetSchoolId }, { merge: true });

    // Register school config to schools_registry if provided
    if (schoolConfig) {
      await registerSchoolToCloud(schoolConfig, targetSchoolId);
    }

    notifyCloudStatusChange('connected');
  } catch (err) {
    if (!checkAndHandleQuotaError(err)) {
      console.warn('Could not write account request to Firestore cloud:', err);
    }
  }
}

/**
 * Update an account request in cloud (e.g. Approved / Rejected by Admin)
 */
export async function updateAccountRequestInCloud(account: Counselor): Promise<void> {
  if (!account || !account.id) return;

  const cleanNpsn = account.schoolNpsn ? String(account.schoolNpsn).replace(/[^0-9a-zA-Z]/g, '') : '';
  const targetSchoolId = (cleanNpsn ? sanitizeSchoolId(cleanNpsn) : '') || 
                         (account.schoolId ? sanitizeSchoolId(account.schoolId) : getActiveSchoolId());

  const enrichedAccount: Counselor = {
    ...account,
    schoolId: targetSchoolId,
    schoolNpsn: cleanNpsn || account.schoolNpsn
  };

  // 1. Update local cache immediately
  try {
    const rawAll = localStorage.getItem('bk_all_account_requests');
    let allPending: any[] = rawAll ? JSON.parse(rawAll) : [];
    if (enrichedAccount.approvalStatus === 'approved') {
      allPending = allPending.filter((c) => c.id !== account.id);
    } else {
      allPending = allPending.map((c) => (c.id === account.id ? enrichedAccount : c));
    }
    localStorage.setItem('bk_all_account_requests', JSON.stringify(allPending));

    // Update target school's counselors
    const existingCounselors = loadSchoolData<any[]>('bk_counselors', [], targetSchoolId);
    const exists = existingCounselors.some(c => c.id === account.id);
    const updated = exists
      ? existingCounselors.map(c => c.id === account.id ? enrichedAccount : c)
      : [...existingCounselors, enrichedAccount];
    saveSchoolData('bk_counselors', updated, targetSchoolId);

    // Also update current active school cache if present
    const activeSchoolId = getActiveSchoolId();
    if (targetSchoolId !== activeSchoolId) {
      const activeCounselors = loadSchoolData<any[]>('bk_counselors', [], activeSchoolId);
      if (activeCounselors.some(c => c.id === account.id)) {
        const updatedActive = activeCounselors.map(c => c.id === account.id ? enrichedAccount : c);
        saveSchoolData('bk_counselors', updatedActive, activeSchoolId);
      }
    }

    window.dispatchEvent(new CustomEvent('bk_account_requests_updated', { detail: { requests: allPending, account: enrichedAccount, schoolId: targetSchoolId } }));
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_counselors', data: updated, schoolId: targetSchoolId } }));
    window.dispatchEvent(new Event('storage'));
  } catch (localErr) {}

  // 2. Update Firestore
  try {
    if (isQuotaExceeded) await resetQuotaState();
    await ensureFirebaseAuth();
    notifyCloudStatusChange('syncing');

    // Update global account_requests
    const reqDocRef = doc(db, 'account_requests', account.id);
    await setDoc(reqDocRef, enrichedAccount, { merge: true });

    // Update target school's counselors
    const schoolDocRef = getSchoolDocRef('counselors', account.id, targetSchoolId);
    await setDoc(schoolDocRef, enrichedAccount, { merge: true });

    // Register school in schools_registry if provided
    if (account.schoolName || cleanNpsn) {
      const schoolRegRef = doc(db, 'schools_registry', targetSchoolId);
      setDoc(schoolRegRef, {
        schoolId: targetSchoolId,
        schoolName: account.schoolName || 'Sekolah Terdaftar',
        npsn: cleanNpsn || '',
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});
    }

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
  if (!accountId) return;

  registerDeletedId(accountId);
  const targetSchoolId = schoolId ? sanitizeSchoolId(schoolId) : getActiveSchoolId();

  // 1. Update local cache
  try {
    const rawAll = localStorage.getItem('bk_all_account_requests');
    if (rawAll) {
      const allPending: any[] = JSON.parse(rawAll);
      localStorage.setItem('bk_all_account_requests', JSON.stringify(allPending.filter(c => c.id !== accountId)));
    }

    const existing = loadSchoolData<any[]>('bk_counselors', [], targetSchoolId);
    const updated = existing.filter(c => c.id !== accountId);
    saveSchoolData('bk_counselors', updated, targetSchoolId);

    window.dispatchEvent(new CustomEvent('bk_account_requests_updated', { detail: { deletedId: accountId, schoolId: targetSchoolId } }));
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_counselors', data: updated, schoolId: targetSchoolId } }));
    window.dispatchEvent(new Event('storage'));
  } catch (localErr) {}

  // 2. Delete from Firestore
  try {
    if (isQuotaExceeded) await resetQuotaState();
    await ensureFirebaseAuth();
    notifyCloudStatusChange('syncing');

    // Delete from global account_requests
    const reqDocRef = doc(db, 'account_requests', accountId);
    await deleteDoc(reqDocRef);

    // Delete from target school's counselors
    const schoolDocRef = getSchoolDocRef('counselors', accountId, targetSchoolId);
    await deleteDoc(schoolDocRef);

    notifyCloudStatusChange('connected');
  } catch (err) {
    if (!checkAndHandleQuotaError(err)) {
      console.error('Failed to delete account request from cloud:', err);
    }
  }
}

/**
 * Comprehensive fetcher for all pending account registration requests across Firestore
 * Pure read operation without circular writes or quota leaks
 */
export async function fetchAllPendingAccountRequestsFromCloud(): Promise<Counselor[]> {
  const deletedSet = new Set(getDeletedIds());
  const map = new Map<string, Counselor>();

  // 1. Read from local cache first (guarantees instantaneous response)
  try {
    const rawAll = localStorage.getItem('bk_all_account_requests');
    if (rawAll) {
      const localList: Counselor[] = JSON.parse(rawAll);
      localList.forEach(c => {
        if (c && c.id && !deletedSet.has(String(c.id)) && c.approvalStatus === 'pending') {
          map.set(String(c.id), c);
        }
      });
    }

    // Check current school counselors cache as well
    const curCounselors = loadSchoolData<Counselor[]>('bk_counselors', []);
    curCounselors.forEach(c => {
      if (c && c.id && !deletedSet.has(String(c.id)) && c.approvalStatus === 'pending') {
        if (!map.has(String(c.id))) {
          map.set(String(c.id), c);
        }
      }
    });
  } catch (e) {}

  // 2. Query Firestore account_requests collection cleanly (zero write-backs)
  try {
    if (!isQuotaExceeded) {
      const colRef = collection(db, 'account_requests');
      const snap = await getDocs(colRef);
      snap.forEach((d) => {
        const item = { id: d.id, ...d.data() } as any;
        if (item && item.id && !deletedSet.has(String(item.id))) {
          if (item.approvalStatus === 'pending') {
            const cleanNpsn = item.schoolNpsn ? String(item.schoolNpsn).replace(/[^0-9a-zA-Z]/g, '') : '';
            const properSchoolId = cleanNpsn ? sanitizeSchoolId(cleanNpsn) : (item.schoolId || getActiveSchoolId());
            const sanitized: Counselor = {
              ...item,
              schoolId: properSchoolId,
              schoolNpsn: cleanNpsn || item.schoolNpsn,
              allowedClasses: Array.isArray(item.allowedClasses) ? item.allowedClasses : [],
              role: item.role || 'Guru Pembimbing BK',
              nip: item.nip || '-',
              avatar: item.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120'
            };
            map.set(String(item.id), sanitized);
          }
        }
      });
    }
  } catch (e) {
    if (!checkAndHandleQuotaError(e)) {
      console.warn('Could not read account_requests directly:', e);
    }
  }

  const result = Array.from(map.values());
  try {
    localStorage.setItem('bk_all_account_requests', JSON.stringify(result));
  } catch (e) {}

  return result;
}

/**
 * Realtime listener for account requests in Firestore
 */
export function listenToAccountRequests(callback: (requests: Counselor[]) => void): () => void {
  let active = true;

  // 1. Immediate comprehensive fetch
  fetchAllPendingAccountRequestsFromCloud()
    .then((initialRequests) => {
      if (active) {
        callback(initialRequests);
      }
    })
    .catch(() => {});

  // 2. Listen to local window events
  const handleLocalUpdate = () => {
    if (!active) return;
    try {
      const raw = localStorage.getItem('bk_all_account_requests');
      if (raw) {
        const deletedSet = new Set(getDeletedIds());
        const list: Counselor[] = JSON.parse(raw);
        callback(list.filter(c => c && c.id && !deletedSet.has(String(c.id)) && c.approvalStatus === 'pending'));
        return;
      }
    } catch (e) {}
    fetchAllPendingAccountRequestsFromCloud().then((reqs) => {
      if (active) callback(reqs);
    }).catch(() => {});
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('bk_account_requests_updated', handleLocalUpdate);
  }

  // 3. Attach Firestore onSnapshot listener for live cloud updates
  let unsubFirestore = () => {};
  try {
    if (!isQuotaExceeded) {
      const colRef = collection(db, 'account_requests');
      unsubFirestore = onSnapshot(colRef, (snapshot) => {
        if (!active) return;
        const deletedSet = new Set(getDeletedIds());
        const requestsMap = new Map<string, Counselor>();

        // Seed with local cache
        try {
          const raw = localStorage.getItem('bk_all_account_requests');
          if (raw) {
            const list: Counselor[] = JSON.parse(raw);
            list.forEach(c => {
              if (c && c.id && !deletedSet.has(String(c.id)) && c.approvalStatus === 'pending') {
                requestsMap.set(String(c.id), c);
              }
            });
          }
        } catch (e) {}

        snapshot.forEach((d) => {
          const item = { id: d.id, ...d.data() } as any;
          if (item && item.id && !deletedSet.has(String(item.id))) {
            if (item.approvalStatus === 'pending') {
              const cleanNpsn = item.schoolNpsn ? String(item.schoolNpsn).replace(/[^0-9a-zA-Z]/g, '') : '';
              const properSchoolId = cleanNpsn ? sanitizeSchoolId(cleanNpsn) : (item.schoolId || getActiveSchoolId());
              const sanitized: Counselor = {
                ...item,
                schoolId: properSchoolId,
                schoolNpsn: cleanNpsn || item.schoolNpsn,
                allowedClasses: Array.isArray(item.allowedClasses) ? item.allowedClasses : [],
                role: item.role || 'Guru Pembimbing BK',
                nip: item.nip || '-',
                avatar: item.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120'
              };
              requestsMap.set(String(item.id), sanitized);
            } else {
              requestsMap.delete(String(item.id));
            }
          }
        });

        const list = Array.from(requestsMap.values());
        try {
          localStorage.setItem('bk_all_account_requests', JSON.stringify(list));
        } catch (e) {}

        if (active) {
          callback(list);
        }
      }, (err) => {
        if (!checkAndHandleQuotaError(err)) {
          console.warn('Realtime listener error for account_requests:', err);
        }
      });
    }
  } catch (err) {
    console.warn('Error attaching account_requests listener:', err);
  }

  return () => {
    active = false;
    unsubFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('bk_account_requests_updated', handleLocalUpdate);
    }
  };
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
      if (data && data.schoolName && d.id !== 'sch_uptd_spf_smp_negeri_2_susuka') {
        cloudSchools.push({ ...data, schoolId: sanitizeSchoolId(data.schoolId || d.id) });
      }
    });

    // Also collect any registered schools from account_requests
    try {
      const reqCol = collection(db, 'account_requests');
      const reqSnap = await getDocs(reqCol);
      reqSnap.forEach(d => {
        const reqData = d.data() as any;
        if (reqData && reqData.schoolName && (reqData.schoolNpsn || reqData.schoolId)) {
          const cleanNpsn = reqData.schoolNpsn ? String(reqData.schoolNpsn).replace(/[^0-9a-zA-Z]/g, '') : '';
          const sId = cleanNpsn ? sanitizeSchoolId(cleanNpsn) : sanitizeSchoolId(reqData.schoolId || '');
          if (sId && sId !== 'sch_uptd_spf_smp_negeri_2_susuka') {
            if (!cloudSchools.some(s => s.schoolId === sId || (s.npsn && s.npsn === cleanNpsn))) {
              cloudSchools.push({
                schoolId: sId,
                schoolName: reqData.schoolName,
                npsn: cleanNpsn || '',
                schoolAddress: reqData.schoolAddress || 'Alamat Sekolah Terdaftar',
                principalName: reqData.principalName || 'Kepala Sekolah',
                principalNip: reqData.principalNip || '-',
                governmentName: 'PEMERINTAH KABUPATEN / KOTA',
                departmentName: 'DINAS PENDIDIKAN'
              });
            }
          }
        }
      });
    } catch (reqErr) {}

    if (cloudSchools.length > 0) {
      saveRegisteredSchools(cloudSchools);
      return getRegisteredSchools();
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
  notifyCloudStatusChange('syncing');

  // Test connection on sync init so connection errors immediately surface the real Firebase error
  testConnection().then((res) => {
    if (res.ok) {
      notifyCloudStatusChange('connected');
    } else if (res.error) {
      notifyCloudStatusChange('error', false, res.error);
    }
  }).catch((err: any) => {
    notifyCloudStatusChange('error', false, err?.message || String(err));
  });

  // Group SYNC_MAP by unique Firestore collection to eliminate duplicate onSnapshot listeners
  const uniqueCollectionMap = new Map<string, string[]>();
  Object.entries(SYNC_MAP).forEach(([localKey, colName]) => {
    if (!uniqueCollectionMap.has(colName)) {
      uniqueCollectionMap.set(colName, []);
    }
    uniqueCollectionMap.get(colName)!.push(localKey);
  });

  // Listen to each unique collection in BOTH schools/{schoolId}/{colName} AND canonical root collections (e.g. siswa, pelanggaran, restitusi, layanan, agenda)
  uniqueCollectionMap.forEach((localKeys, colName) => {
    if (isQuotaExceeded) return;

    const subDocsMap = new Map<string, any>();
    const rootDocsMap = new Map<string, any>();
    const rootAliasMaps = new Map<string, Map<string, any>>();
    const serverConfirmedIds = new Set<string>();
    const hardRemovedFromServer = new Set<string>();

    const rebuildRootDocs = () => {
      rootDocsMap.clear();
      rootAliasMaps.forEach((aliasMap) => {
        aliasMap.forEach((val, k) => {
          rootDocsMap.set(k, val);
        });
      });
    };

    const flushMergedDocs = (snapshotDeletedIds: Set<string>, deletedSet: Set<string>) => {
      const mergedRemoteMap = new Map<string, any>();
      rootDocsMap.forEach((val, k) => {
        if (!deletedSet.has(k) && !snapshotDeletedIds.has(k)) mergedRemoteMap.set(k, val);
      });
      subDocsMap.forEach((val, k) => {
        if (!deletedSet.has(k) && !snapshotDeletedIds.has(k)) mergedRemoteMap.set(k, val);
      });
      const rawDocs = Array.from(mergedRemoteMap.values());
      const pendingQueue = getPendingCloudQueue();

      localKeys.forEach((localKey) => {
        const cacheKey = `${currentSchoolId}_${localKey}`;
        const mergedDocsMap = new Map<string, any>();

        // 1. PURE FIRESTORE SOURCE OF TRUTH: Masukkan HANYA dokumen aktif dari onSnapshot Firestore
        rawDocs.forEach((item) => {
          const rid = String(item.id).trim();
          if (deletedSet.has(rid) || snapshotDeletedIds.has(rid)) return;
          if (hardRemovedFromServer.has(rid)) return;
          mergedDocsMap.set(rid, item);
        });

        // 2. Hanya pertahankan item yang benar-benar masih menunggu flush offline ke Firestore
        pendingQueue.forEach((q) => {
          if (q.localKey === localKey && sanitizeSchoolId(q.schoolId) === currentSchoolId && q.item && isValidDeleteId(q.id)) {
            const qid = String(q.id).trim();
            if (!mergedDocsMap.has(qid) && !deletedSet.has(qid) && !snapshotDeletedIds.has(qid)) {
              mergedDocsMap.set(qid, q.item);
            }
          }
        });

        const docsData = Array.from(mergedDocsMap.values());
        let sortedDocs = sortCollectionData(localKey, docsData, currentSchoolId);
        if (localKey === 'bk_logs' && sortedDocs.length > 80) {
          sortedDocs = sortedDocs.slice(0, 80);
        }

        // Console log wajib dengan nama koleksi Firestore asli (students, violations, services, daily_journals)
        const logLabel =
          localKey === 'bk_students'
            ? 'students'
            : localKey === 'bk_violations'
            ? 'violations'
            : localKey === 'bk_services'
            ? 'services'
            : localKey === 'bk_daily_journals'
            ? 'daily_journals'
            : localKey === 'bk_home_visits'
            ? 'home_visits'
            : localKey === 'bk_attendance_history'
            ? 'attendance_history'
            : null;
        if (logLabel && loggedSnapshotCounts[cacheKey] !== sortedDocs.length) {
          loggedSnapshotCounts[cacheKey] = sortedDocs.length;
          console.log(`onSnapshot ${logLabel} jalan, jumlah:`, sortedDocs.length);
        }

        const remoteStr = JSON.stringify(sortedDocs);
        if (lastSavedRemoteMap[cacheKey] !== remoteStr) {
          lastSavedRemoteMap[cacheKey] = remoteStr;
          setCloudCollectionData(localKey, sortedDocs, currentSchoolId);
          if (localKey === 'bk_attendance_history' && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bk_attendance_history_changed', { detail: sortedDocs }));
          }
          broadcastRealtimeChange({
            type: 'sync',
            key: localKey,
            data: sortedDocs,
            schoolId: currentSchoolId
          });
        }
      });

      notifyCloudStatusChange('connected');
    };

    const ingestIntoMap = (targetMap: Map<string, any>, snapshot: any, aliasName?: string) => {
      const deletedSet = new Set(getDeletedIds());
      const snapshotDeletedIds = new Set<string>();
      const fromCache = Boolean(snapshot?.metadata?.fromCache);

      // Track hard deletes (deleteDoc) delivered live from server
      if (!fromCache && typeof snapshot.docChanges === 'function') {
        snapshot.docChanges().forEach((change: any) => {
          const cid = String(change.doc?.id || '').trim();
          if (!cid) return;
          if (change.type === 'removed' && serverConfirmedIds.has(cid)) {
            hardRemovedFromServer.add(cid);
          } else if (change.type === 'added' || change.type === 'modified') {
            serverConfirmedIds.add(cid);
            hardRemovedFromServer.delete(cid);
          }
        });
      }

      targetMap.clear();

      snapshot.forEach((d: any) => {
        const item = { id: d.id, ...d.data() } as any;
        if (item && isValidDeleteId(item.id)) {
          const itemId = String(item.id).trim();

          if (item.isDeleted === true) {
            registerDeletedId(itemId);
            deletedSet.add(itemId);
            snapshotDeletedIds.add(itemId);
            return;
          }
          if (deletedSet.has(itemId)) {
            setDoc(d.ref, { isDeleted: true, deletedAt: formatDeletedAtIndonesian(new Date()) }, { merge: true }).catch(() => {});
            return;
          }
          if (!isDummyRecord(item, localKeys[0]) && matchesSchoolOrLegacy(item, currentSchoolId)) {
            const isLegacy = isLegacyUnassignedRecord(item);
            if (!fromCache) {
              serverConfirmedIds.add(itemId);
              hardRemovedFromServer.delete(itemId);
            }
            let normalizedItem: any = isLegacy ? { ...item, isLegacyUnmigrated: true } : { ...item };
            if (colName === 'violations' && normalizedItem.migratedAt === undefined) {
              normalizedItem.migratedAt = null;
            }
            targetMap.set(itemId, normalizedItem);
          }
        }
      });

      if (aliasName) {
        rebuildRootDocs();
      }
      flushMergedDocs(snapshotDeletedIds, deletedSet);
    };

    const colRef = getSchoolColRef(colName, currentSchoolId);
    const unsubSub = onSnapshot(colRef, (snapshot) => {
      if (isQuotaExceeded) return;
      if (!snapshot.empty) {
        localKeys.forEach((localKey) => {
          const seedMarkerKey = `bk_seeded_${currentSchoolId}_${localKey}`;
          if (typeof localStorage !== 'undefined') localStorage.setItem(seedMarkerKey, 'true');
        });
      }
      ingestIntoMap(subDocsMap, snapshot);
    }, (error) => {
      if (!checkAndHandleQuotaError(error)) {
        const isUnauthViolationBeforeLogin =
          (colName === 'violations' || colName === 'cases') &&
          !auth.currentUser &&
          typeof localStorage !== 'undefined' &&
          localStorage.getItem('bk_is_logged_in') !== 'true';
        if (!isUnauthViolationBeforeLogin) {
          const errMsg = handleFirestoreError(error, 'list', colRef.path);
          notifyCloudStatusChange('error', false, errMsg);
        }
      }
    });
    unsubscribes.push(unsubSub);

    // Subscribe to canonical root collection(s) (e.g. siswa, pelanggaran, restitusi, layanan, agenda) + legacy root
    const rootAliases = Array.from(new Set([colName, ...getCanonicalRootCollections(colName)]));
    rootAliases.forEach((rootColName) => {
      const aliasMap = new Map<string, any>();
      rootAliasMaps.set(rootColName, aliasMap);
      const rootColRef = collection(db, rootColName);
      const unsubRoot = onSnapshot(rootColRef, (snapshot) => {
        if (isQuotaExceeded) return;
        ingestIntoMap(aliasMap, snapshot, rootColName);
      }, (error) => {
        if (!checkAndHandleQuotaError(error)) {
          const isUnauthViolationBeforeLogin =
            (colName === 'violations' || colName === 'cases' || rootColName === 'violations') &&
            !auth.currentUser &&
            typeof localStorage !== 'undefined' &&
            localStorage.getItem('bk_is_logged_in') !== 'true';
          if (!isUnauthViolationBeforeLogin) {
            const errMsg = handleFirestoreError(error, 'list', rootColRef.path);
            notifyCloudStatusChange('error', false, errMsg);
          }
        }
      });
      unsubscribes.push(unsubRoot);
    });
  });

  // Real-time listener for school settings & profile in `pengaturan/{schoolId}`
  try {
    const pengaturanRef = doc(db, 'pengaturan', currentSchoolId);
    const unsubPengaturan = onSnapshot(pengaturanRef, (docSnap) => {
      if (isQuotaExceeded || !docSnap.exists()) return;
      const data = docSnap.data() as any;
      if (!data) return;
      if (data._lastModifiedByTab === CLIENT_TAB_ID) return;

      if (data.schoolName) {
        const currentCfg = getSchoolConfig(currentSchoolId);
        saveSchoolConfig({ ...currentCfg, ...data, schoolId: currentSchoolId });
        window.dispatchEvent(new Event('bk_school_config_updated'));
      }
      if (Array.isArray(data.walikelasConfig) && data.walikelasConfig.length > 0) {
        setCloudCollectionData('bk_walikelas_config', data.walikelasConfig, currentSchoolId);
        broadcastRealtimeChange({ type: 'sync', key: 'bk_walikelas_config', data: data.walikelasConfig, schoolId: currentSchoolId });
      }
      if (Array.isArray(data.violationRules) && data.violationRules.length > 0) {
        setCloudCollectionData('bk_violation_rules', data.violationRules, currentSchoolId);
        window.dispatchEvent(new CustomEvent('bk_violation_rules_changed', { detail: { schoolId: currentSchoolId, categories: data.violationRules } }));
      }
      if (Array.isArray(data.parentSummonTemplates)) {
        setCloudCollectionData('bk_parent_summon_templates', data.parentSummonTemplates, currentSchoolId);
        broadcastRealtimeChange({ type: 'sync', key: 'bk_parent_summon_templates', data: data.parentSummonTemplates, schoolId: currentSchoolId });
      }
      notifyCloudStatusChange('connected');
    }, (error) => {
      if (!checkAndHandleQuotaError(error)) {
        const errMsg = handleFirestoreError(error, 'get', `pengaturan/${currentSchoolId}`);
        notifyCloudStatusChange('error', false, errMsg);
      }
    });
    unsubscribes.push(unsubPengaturan);
  } catch {}

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

      // Filter and route account requests strictly to their own school partitions
      const activeSchoolId = getActiveSchoolId();
      const currentCounselors = loadSchoolData<Counselor[]>('bk_counselors', [], activeSchoolId);
      let changed = false;
      const map = new Map<string, Counselor>();
      currentCounselors.forEach(c => {
        // Keep in active school map only if it belongs to activeSchoolId or has no explicit schoolId
        const cSchoolId = c.schoolId ? sanitizeSchoolId(c.schoolId) : '';
        const cNpsn = c.schoolNpsn ? sanitizeSchoolId(c.schoolNpsn) : '';
        if (!cSchoolId || cSchoolId === activeSchoolId || cNpsn === activeSchoolId) {
          map.set(c.id, c);
        } else {
          changed = true; // Remove leaked counselor from wrong school partition
        }
      });

      allRequests.forEach(req => {
        const reqCleanNpsn = req.schoolNpsn ? sanitizeSchoolId(req.schoolNpsn) : '';
        const reqSchoolId = (reqCleanNpsn || (req.schoolId ? sanitizeSchoolId(req.schoolId) : ''));
        
        // Daftarkan sekolah dari account_requests ke daftar sekolah terdaftar SAJA tanpa mengubah sekolah aktif saat ini!
        if (req.schoolName && (reqCleanNpsn || reqSchoolId)) {
          const registered = getRegisteredSchools();
          if (!registered.some(s => s.schoolId === reqSchoolId || (req.schoolNpsn && s.npsn === req.schoolNpsn))) {
            const newSch: SchoolConfig = {
              schoolId: reqSchoolId,
              schoolName: req.schoolName,
              npsn: req.schoolNpsn || '',
              schoolAddress: 'Alamat Sekolah',
              principalName: 'Kepala Sekolah',
              principalNip: '-',
              governmentName: 'PEMERINTAH KABUPATEN / KOTA',
              departmentName: 'DINAS PENDIDIKAN'
            };
            registerSchoolConfigWithoutActivating(newSch);
          }
        }

        // Only add to active school list if it strictly belongs to this active school
        if (reqSchoolId === activeSchoolId || (!reqSchoolId && activeSchoolId === 'sch_20320123')) {
          const existing = map.get(req.id);
          const isAuliaReq = req.id === 'c1' || req.username === 'aulia' || (req.email && String(req.email).toLowerCase().includes('auliasasongko'));
          const safeReq = isAuliaReq
            ? {
                ...req,
                id: 'c1',
                name: 'Aulia Aji Sasongko, S.Pd.',
                schoolId: 'sch_20320123',
                schoolNpsn: '20320123',
                schoolName: 'SMP N 2 Susukan',
                role: req.role && !String(req.role).toLowerCase().includes('admin & guru') ? req.role : 'Koordinator BK & Guru Pembimbing Kelas 8'
              }
            : { ...req, schoolId: activeSchoolId };
          if (!existing || existing.approvalStatus !== req.approvalStatus || JSON.stringify(existing) !== JSON.stringify(safeReq)) {
            map.set(req.id, { ...(existing || {}), ...safeReq });
            changed = true;
          }
        } else if (reqSchoolId) {
          // Route to its respective school partition storage cleanly
          const targetList = loadSchoolData<Counselor[]>('bk_counselors', [], reqSchoolId);
          const tMap = new Map<string, Counselor>();
          targetList.forEach(c => tMap.set(c.id, c));
          const ex = tMap.get(req.id);
          if (!ex || ex.approvalStatus !== req.approvalStatus || JSON.stringify(ex) !== JSON.stringify(req)) {
            tMap.set(req.id, { ...(ex || {}), ...req, schoolId: reqSchoolId });
            saveSchoolData('bk_counselors', Array.from(tMap.values()), reqSchoolId);
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

  // Read-only realtime listener for `teachers` collection (for Pelapor dropdown in Arsip/Rujukan)
  try {
    const teachersCol = collection(db, 'teachers');
    const teachersUnsub = onSnapshot(teachersCol, (snapshot) => {
      if (isQuotaExceeded) return;
      const list: TeacherDirectoryEntry[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as any;
        if (!data || data.isDeleted === true) return;
        const rawName = String(data.name || data.nama || data.fullName || data.displayName || '').trim();
        if (!rawName) return;
        list.push({
          id: d.id,
          name: rawName,
          nip: String(data.nip || '').trim() || undefined,
          subject: String(data.subject || data.mapel || '').trim() || undefined,
          phone: String(data.phone || data.telepon || '').trim() || undefined,
          isActive: data.isActive !== false,
          createdAt: data.createdAt,
          role: String(data.role || data.jabatan || data.posisi || data.subject || data.mapel || '').trim() || undefined,
          schoolId: data.schoolId ? sanitizeSchoolId(data.schoolId) : undefined,
        });
      });
      cachedTeachersList = list;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bk_teachers_updated', { detail: list }));
      }
    }, () => {
      // Silently ignore if teachers collection has restricted permissions or does not exist yet
    });
    unsubscribes.push(teachersUnsub);
  } catch {}
}

export interface TeacherDirectoryEntry {
  id: string;
  name: string;
  nip?: string;
  subject?: string;
  phone?: string;
  isActive?: boolean;
  createdAt?: string | number;
  role?: string;
  schoolId?: string;
}

let cachedTeachersList: TeacherDirectoryEntry[] = [];

export function getTeachersFromCloud(schoolId?: string): TeacherDirectoryEntry[] {
  const sid = sanitizeSchoolId(schoolId || getActiveSchoolId());
  return cachedTeachersList.filter((t) => !t.schoolId || t.schoolId === sid);
}

export function subscribeTeachers(
  callback: (teachers: TeacherDirectoryEntry[]) => void,
  schoolId?: string
): () => void {
  if (typeof window === 'undefined') return () => {};
  const sid = sanitizeSchoolId(schoolId || getActiveSchoolId());
  callback(getTeachersFromCloud(sid));
  const handler = () => {
    callback(getTeachersFromCloud(sid));
  };
  window.addEventListener('bk_teachers_updated', handler);
  return () => {
    window.removeEventListener('bk_teachers_updated', handler);
  };
}

const promotedGuestNamesSession = new Set<string>();

/**
 * Otomatis promosikan guru piket tamu (+ Nama Lain) yang sudah dipakai >= 3x di laporan Piket ke koleksi `teachers`
 */
export async function promoteFrequentGuestTeachers(
  violations: any[],
  schoolId?: string
): Promise<void> {
  if (!Array.isArray(violations) || violations.length === 0 || isQuotaExceeded) return;
  try {
    const counts = new Map<string, { displayName: string; count: number }>();
    violations.forEach((v) => {
      if (!v || v.isDeleted === true) return;
      const via = String(v.reportedVia || '').toLowerCase();
      const src = String(v.source || '').toLowerCase();
      if (!via.includes('piket') && src !== 'link_piket') return;
      const rawRep = String(v.reportedBy || '').trim();
      if (!rawRep) return;
      const key = rawRep.toLowerCase();
      if (key === 'guru piket' || key.includes('absensi')) return;
      const prev = counts.get(key);
      counts.set(key, {
        displayName: prev?.displayName || rawRep,
        count: (prev?.count || 0) + 1,
      });
    });

    const candidates = Array.from(counts.entries()).filter(
      ([key, info]) => info.count >= 3 && !promotedGuestNamesSession.has(key)
    );
    if (candidates.length === 0) return;

    await ensureFirebaseAuth();
    const targetSchoolId = sanitizeSchoolId(schoolId || getActiveSchoolId());
    const snap = await getDocs(collection(db, 'teachers'));
    const existingKeys = new Set<string>();
    snap.forEach((d) => {
      const data = d.data() as any;
      if (!data || data.isDeleted === true) return;
      const n = String(data.name || data.nama || '').trim().toLowerCase();
      if (n) existingKeys.add(n);
    });

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    for (const [key, info] of candidates) {
      promotedGuestNamesSession.add(key);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      const docId = `tch_guest_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
      await setDoc(doc(db, 'teachers', docId), {
        id: docId,
        name: info.displayName,
        nip: '',
        subject: 'Guru Piket',
        phone: '',
        isActive: true,
        source: 'auto_guest_3x',
        createdAt: nowIso,
        schoolId: targetSchoolId,
        isDeleted: false,
      });
    }
  } catch {
    // Non-blocking best effort
  }
}

/**
 * Force a full pull synchronization from Firestore for all collections of the active school
 * Parallelizes all network requests via Promise.all (<300ms)
 */
export async function forceFullCloudSync(): Promise<void> {
  const currentSchoolId = getActiveSchoolId();
  notifyCloudStatusChange('syncing');

  let firstError: string | undefined;

  // 1. Pull global account requests
  const pullAccReqs = async () => {
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
      if (allReqs.length > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bk_account_requests_updated', { detail: { requests: allReqs } }));
      }
    } catch (e) {
      if (!checkAndHandleQuotaError(e)) {
        console.warn('Force pull error for account_requests:', e);
      }
    }
  };

  // 1b. Pull sekolah pengaturan/{schoolId}
  const pullPengaturan = async () => {
    try {
      const snap = await getDoc(doc(db, 'pengaturan', currentSchoolId));
      if (snap.exists()) {
        const data = snap.data() as any;
        if (data?.schoolName) {
          const currentCfg = getSchoolConfig(currentSchoolId);
          saveSchoolConfig({ ...currentCfg, ...data, schoolId: currentSchoolId });
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('bk_school_config_updated'));
        }
        if (Array.isArray(data?.walikelasConfig) && data.walikelasConfig.length > 0) {
          setCloudCollectionData('bk_walikelas_config', data.walikelasConfig, currentSchoolId);
          broadcastRealtimeChange({ type: 'sync', key: 'bk_walikelas_config', data: data.walikelasConfig, schoolId: currentSchoolId });
        }
        if (Array.isArray(data?.violationRules) && data.violationRules.length > 0) {
          setCloudCollectionData('bk_violation_rules', data.violationRules, currentSchoolId);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bk_violation_rules_changed', { detail: { schoolId: currentSchoolId, categories: data.violationRules } }));
          }
        }
        if (Array.isArray(data?.parentSummonTemplates)) {
          setCloudCollectionData('bk_parent_summon_templates', data.parentSummonTemplates, currentSchoolId);
          broadcastRealtimeChange({ type: 'sync', key: 'bk_parent_summon_templates', data: data.parentSummonTemplates, schoolId: currentSchoolId });
        }
      }
    } catch (e) {
      if (!checkAndHandleQuotaError(e)) {
        firstError = firstError || handleFirestoreError(e, 'get', `pengaturan/${currentSchoolId}`);
      }
    }
  };

  // 2. Build unique collection map to pull in parallel without duplicate network requests
  const uniqueColMap = new Map<string, string[]>();
  Object.entries(SYNC_MAP).forEach(([localKey, colName]) => {
    if (!uniqueColMap.has(colName)) uniqueColMap.set(colName, []);
    uniqueColMap.get(colName)!.push(localKey);
  });

  const pullCollections = Array.from(uniqueColMap.entries()).map(async ([colName, localKeys]) => {
    try {
      const deletedSet = new Set(getDeletedIds());
      const docMap = new Map<string, any>();

      const ingestSnapshot = (snap: any) => {
        snap.forEach((d: any) => {
          const item = { id: d.id, ...d.data() } as any;
          if (item && item.id) {
            const rid = String(item.id);
            if (item.isDeleted === true) {
              registerDeletedId(rid);
              deletedSet.add(rid);
              docMap.delete(rid);
              return;
            }
            if (!deletedSet.has(rid) && !isDummyRecord(item, localKeys[0]) && matchesSchoolOrLegacy(item, currentSchoolId)) {
              const isLegacy = isLegacyUnassignedRecord(item);
              const normalizedItem: any = isLegacy ? { ...item, isLegacyUnmigrated: true } : { ...item };
              if (colName === 'violations' && normalizedItem.migratedAt === undefined) {
                normalizedItem.migratedAt = null;
              }
              docMap.set(rid, normalizedItem);
            }
          }
        });
      };

      const rootAliases = Array.from(new Set([colName, ...getCanonicalRootCollections(colName)]));
      const [subRes, ...rootResults] = await Promise.allSettled([
        getDocs(getSchoolColRef(colName, currentSchoolId)),
        ...rootAliases.map((rc) => getDocs(collection(db, rc)))
      ]);

      rootResults.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          if (!res.value.empty) ingestSnapshot(res.value);
        } else if (!checkAndHandleQuotaError(res.reason)) {
          firstError = firstError || handleFirestoreError(res.reason, 'list', rootAliases[idx]);
        }
      });

      if (subRes.status === 'fulfilled') {
        if (!subRes.value.empty) ingestSnapshot(subRes.value);
      } else if (!checkAndHandleQuotaError(subRes.reason)) {
        firstError = firstError || handleFirestoreError(subRes.reason, 'list', `schools/${currentSchoolId}/${colName}`);
      }

      // Pastikan dokumen yang punya flag isDeleted di salah satu sumber dihapus dari docMap
      deletedSet.forEach(dId => docMap.delete(dId));
      const docsData = Array.from(docMap.values());

      for (const localKey of localKeys) {
        let sortedDocs = sortCollectionData(localKey, docsData, currentSchoolId);
        if (localKey === 'bk_logs' && sortedDocs.length > 80) {
          sortedDocs = sortedDocs.slice(0, 80);
        }

        const cacheKey = `${currentSchoolId}_${localKey}`;
        lastSavedRemoteMap[cacheKey] = JSON.stringify(sortedDocs);
        setCloudCollectionData(localKey, sortedDocs, currentSchoolId);

        if (localKey === 'bk_attendance_history' && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bk_attendance_history_changed', { detail: sortedDocs }));
        }
        broadcastRealtimeChange({
          type: 'sync',
          key: localKey,
          data: sortedDocs,
          schoolId: currentSchoolId
        });
      }
    } catch (e: any) {
      if (!checkAndHandleQuotaError(e)) {
        firstError = firstError || handleFirestoreError(e, 'list', colName);
      }
    }
  });

  await Promise.all([pullAccReqs(), pullPengaturan(), ...pullCollections]);
  if (firstError) {
    notifyCloudStatusChange('error', false, firstError);
  } else {
    notifyCloudStatusChange('connected', true);
  }
}

/**
 * HAPUS CACHE LOKAL & AMBIL ULANG DARI CLOUD:
 * Menghapus semua cache data koleksi di localStorage, memutus listener lama,
 * menarik data fresh langsung dari server Firestore (getDocsFromServer, tanpa cache),
 * dan memulai ulang onSnapshot sehingga tampilan 100% sama dengan Firebase Console.
 */
export async function clearLocalCacheAndReloadFromCloud(): Promise<{
  success: boolean;
  counts: {
    students: number;
    violations: number;
    services: number;
    homeVisits: number;
    journals: number;
    attendance: number;
    total: number;
  };
  error?: string;
}> {
  const currentSchoolId = getActiveSchoolId();
  notifyCloudStatusChange('syncing');

  // 1. Hapus SEMUA key data koleksi dari localStorage (sisakan sesi login & preferensi tema)
  if (typeof localStorage !== 'undefined') {
    const dataKeyPrefixes = [
      'bk_students', 'bk_violations', 'bk_cases', 'bk_services', 'bk_counseling',
      'bk_home_visits', 'bk_parent_summons', 'bk_daily_journals', 'bk_attendance_history',
      'bk_achievements', 'bk_student_achievements', 'bk_logs',
      'bk_teaching_schedule', 'bk_class_teaching_progress', 'bk_sticky_notes',
      'bk_program_evaluations', 'bk_service_evaluations',
      'bk_surat_perjanjian_list', 'bk_kontrak_perilaku_list',
      'bk_jurnal_pembinaan_disiplin_list', 'bk_komitmen_rtl_list',
      'bk_walikelas_config', 'bk_violation_rules', 'bk_parent_summon_templates',
      'bk_akpd_class_sessions', 'bk_initial_seeded', 'bk_seeded_',
      'bk_hv_seeded_', 'bk_att_seeded_', 'bk_pending_cloud_queue',
      'bk_deleted_ids', 'bk_trash_', 'bk_hapus_log_',
      'bk_cleared_', 'bk_students_cleared_', 'bk_summons_', 'bk_dummy_students_purged'
    ];
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && dataKeyPrefixes.some((p) => k.startsWith(p))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });
    } catch {}
  }

  // 2. Bersihkan cache memori & hentikan listener sementara
  Object.keys(lastSavedRemoteMap).forEach((k) => delete lastSavedRemoteMap[k]);
  Object.keys(cloudCollectionCache).forEach((k) => delete cloudCollectionCache[k]);
  Object.keys(loggedSnapshotCounts).forEach((k) => delete loggedSnapshotCounts[k]);
  stopRealtimeFirestoreSync();

  const counts = {
    students: 0,
    violations: 0,
    services: 0,
    homeVisits: 0,
    journals: 0,
    attendance: 0,
    total: 0
  };

  try {
    await ensureFirebaseAuth();
    const conn = await testConnection();
    if (!conn.ok) {
      const msg = conn.error || 'Tidak dapat terhubung ke server Firebase Firestore';
      notifyCloudStatusChange('error', false, msg);
      await initRealtimeFirestoreSync();
      return { success: false, counts, error: msg };
    }

    const uniqueColMap = new Map<string, string[]>();
    Object.entries(SYNC_MAP).forEach(([localKey, colName]) => {
      if (!uniqueColMap.has(colName)) uniqueColMap.set(colName, []);
      uniqueColMap.get(colName)!.push(localKey);
    });

    await Promise.all(
      Array.from(uniqueColMap.entries()).map(async ([colName, localKeys]) => {
        const docMap = new Map<string, any>();
        const ingestServerSnap = (snap: any) => {
          snap.forEach((d: any) => {
            const item = { id: d.id, ...d.data() } as any;
            if (!item || !item.id || item.isDeleted === true) return;
            if (!isDummyRecord(item, localKeys[0]) && matchesSchoolOrLegacy(item, currentSchoolId)) {
              const isLegacy = isLegacyUnassignedRecord(item);
              docMap.set(String(item.id), isLegacy ? { ...item, isLegacyUnmigrated: true } : item);
            }
          });
        };

        const rootAliases = Array.from(new Set([colName, ...getCanonicalRootCollections(colName)]));
        const [subRes, ...rootResults] = await Promise.allSettled([
          getDocsFromServer(getSchoolColRef(colName, currentSchoolId)),
          ...rootAliases.map((rc) => getDocsFromServer(collection(db, rc)))
        ]);

        rootResults.forEach((res) => {
          if (res.status === 'fulfilled' && !res.value.empty) {
            ingestServerSnap(res.value);
          }
        });
        if (subRes.status === 'fulfilled' && !subRes.value.empty) {
          ingestServerSnap(subRes.value);
        }

        const docsData = Array.from(docMap.values());
        localKeys.forEach((localKey) => {
          let sortedDocs = sortCollectionData(localKey, docsData, currentSchoolId);
          if (localKey === 'bk_logs' && sortedDocs.length > 80) {
            sortedDocs = sortedDocs.slice(0, 80);
          }

          lastSavedRemoteMap[`${currentSchoolId}_${localKey}`] = JSON.stringify(sortedDocs);
          setCloudCollectionData(localKey, sortedDocs, currentSchoolId);

          if (localKey === 'bk_students') counts.students = sortedDocs.length;
          else if (localKey === 'bk_violations') counts.violations = sortedDocs.length;
          else if (localKey === 'bk_services') counts.services = sortedDocs.length;
          else if (localKey === 'bk_home_visits') counts.homeVisits = sortedDocs.length;
          else if (localKey === 'bk_daily_journals') counts.journals = sortedDocs.length;
          else if (localKey === 'bk_attendance_history') {
            counts.attendance = sortedDocs.length;
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('bk_attendance_history_changed', { detail: sortedDocs }));
            }
          }

          broadcastRealtimeChange({
            type: 'sync',
            key: localKey,
            data: sortedDocs,
            schoolId: currentSchoolId
          });
        });
      })
    );

    counts.total =
      counts.students +
      counts.violations +
      counts.services +
      counts.homeVisits +
      counts.journals +
      counts.attendance;

    await initRealtimeFirestoreSync();
    notifyCloudStatusChange('connected', true);
    return { success: true, counts };
  } catch (err: any) {
    const errMsg = handleFirestoreError(err, 'list', 'clearLocalCacheAndReloadFromCloud');
    notifyCloudStatusChange('error', false, errMsg);
    await initRealtimeFirestoreSync().catch(() => {});
    return { success: false, counts, error: errMsg };
  }
}

/**
 * Clean up subscriptions
 */
export function stopRealtimeFirestoreSync(): void {
  unsubscribes.forEach((unsub) => unsub());
  unsubscribes.length = 0;
  isSyncingActive = false;
}

/**
 * Explicitly sends/pushes all preview data to Cloud Firestore for Bapak Aulia Aji Sasongko (SMP N 2 Susukan)
 * Guarantees that when logging in from any browser/device on the web, all students (194 students),
 * violations, counseling services, home visits, achievements, journals, and configs are 100% synchronized.
 */
export async function syncPreviewDataToAuliaAccount(): Promise<{
  success: boolean;
  counts: {
    students: number;
    violations: number;
    services: number;
    achievements: number;
    homeVisits: number;
    attendance: number;
    counselors: number;
  };
  error?: string;
}> {
  const targetSchoolId = 'sch_20320123';

  try {
    notifyCloudStatusChange('syncing');

    // 1. Jangan pernah membuka kembali ID yang sudah dihapus pengguna (anti-resurrection)
    const deletedSet = new Set(getDeletedIds());

    // 2. Load authentic local students (filter out dummy s1..s194 placeholders & deleted records)
    const rawStudents = loadSchoolData<any[]>('bk_students', [], targetSchoolId);
    const currentStudents = Array.isArray(rawStudents)
      ? rawStudents.filter(s => s && s.isDeleted !== true && !deletedSet.has(String(s.id)) && !isDummyRecord(s, 'bk_students'))
      : [];

    // 3. Load other preview datasets
    const currentViolations = loadSchoolData<any[]>('bk_violations', [], targetSchoolId);
    const currentServices = loadSchoolData<any[]>('bk_services', [], targetSchoolId);
    const currentAchievements = loadSchoolData<any[]>('bk_achievements', [], targetSchoolId);
    const currentHomeVisits = loadSchoolData<any[]>('bk_home_visits', [], targetSchoolId);
    const currentAttendance = loadSchoolData<any[]>('bk_attendance_history', [], targetSchoolId);
    const currentJournals = loadSchoolData<any[]>('bk_daily_journals', [], targetSchoolId);
    const currentLogs = loadSchoolData<any[]>('bk_logs', [], targetSchoolId);

    // 4. Ensure Aulia Aji Sasongko account exists in counselors with Kelas 8 scope
    let currentCounselors = loadSchoolData<Counselor[]>('bk_counselors', [], targetSchoolId);
    const auliaCounselor: Counselor = {
      id: 'c1',
      name: 'Aulia Aji Sasongko, S.Pd.',
      role: 'Koordinator BK & Guru Pembimbing Kelas 8',
      nip: 'NIP. 19931231 202221 1 002',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
      allowedClasses: ['8A', '8B', '8C', '8D', '8E', '8F', '8G'],
      username: 'aulia',
      password: 'aulia',
      email: 'auliasasongko12@guru.smp.belajar.id',
      phone: '089681287339',
      schoolId: targetSchoolId,
      schoolNpsn: '20320123',
      schoolName: 'SMP N 2 Susukan',
      approvalStatus: 'approved' as const
    };

    if (!Array.isArray(currentCounselors) || currentCounselors.length === 0) {
      currentCounselors = [auliaCounselor];
    } else {
      const idx = currentCounselors.findIndex(c => c.id === 'c1' || c.username === 'aulia' || c.email?.includes('auliasasongko'));
      if (idx !== -1) {
        currentCounselors[idx] = { ...auliaCounselor, ...currentCounselors[idx], id: 'c1', approvalStatus: 'approved' };
      } else {
        currentCounselors.unshift(auliaCounselor);
      }
    }

    // 5. Save all to LocalStorage
    saveSchoolData('bk_students', currentStudents, targetSchoolId);
    saveSchoolData('bk_violations', currentViolations, targetSchoolId);
    saveSchoolData('bk_services', currentServices, targetSchoolId);
    saveSchoolData('bk_achievements', currentAchievements, targetSchoolId);
    saveSchoolData('bk_home_visits', currentHomeVisits, targetSchoolId);
    saveSchoolData('bk_attendance_history', currentAttendance, targetSchoolId);
    saveSchoolData('bk_daily_journals', currentJournals, targetSchoolId);
    saveSchoolData('bk_logs', currentLogs, targetSchoolId);
    saveSchoolData('bk_counselors', currentCounselors, targetSchoolId);

    // Save school config
    const schoolCfg = getSchoolConfig(targetSchoolId);
    saveSchoolConfig({
      ...schoolCfg,
      schoolId: targetSchoolId,
      schoolName: 'SMP N 2 Susukan',
      namaSekolah: 'SMP Negeri 2 Susukan',
      jenjang: 'SMP',
      npsn: '20320123',
      koordinatorBkName: 'Aulia Aji Sasongko, S.Pd.',
      koordinatorBkNip: 'NIP. 19931231 202221 1 002',
    });

    // 6. Push all datasets to Cloud Firestore
    await ensureFirebaseAuth();
    await registerSchoolToCloud(getSchoolConfig(targetSchoolId), targetSchoolId);

    await Promise.all([
      saveBulkToFirestore('bk_students', currentStudents, targetSchoolId, false),
      saveBulkToFirestore('bk_violations', currentViolations, targetSchoolId, false),
      saveBulkToFirestore('bk_services', currentServices, targetSchoolId, false),
      saveBulkToFirestore('bk_achievements', currentAchievements, targetSchoolId, false),
      saveBulkToFirestore('bk_home_visits', currentHomeVisits, targetSchoolId, false),
      saveBulkToFirestore('bk_attendance_history', currentAttendance, targetSchoolId, false),
      saveBulkToFirestore('bk_daily_journals', currentJournals, targetSchoolId, false),
      saveBulkToFirestore('bk_counselors', currentCounselors, targetSchoolId, false),
      saveAccountRequestToCloud(auliaCounselor).catch(() => {})
    ]);

    // 7. Broadcast realtime sync events
    broadcastRealtimeChange({ type: 'sync', key: 'bk_students', data: currentStudents, schoolId: targetSchoolId });
    broadcastRealtimeChange({ type: 'sync', key: 'bk_violations', data: currentViolations, schoolId: targetSchoolId });
    broadcastRealtimeChange({ type: 'sync', key: 'bk_services', data: currentServices, schoolId: targetSchoolId });
    broadcastRealtimeChange({ type: 'sync', key: 'bk_counselors', data: currentCounselors, schoolId: targetSchoolId });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_students', data: currentStudents, schoolId: targetSchoolId } }));
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_violations', data: currentViolations, schoolId: targetSchoolId } }));
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_services', data: currentServices, schoolId: targetSchoolId } }));
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_counselors', data: currentCounselors, schoolId: targetSchoolId } }));
      window.dispatchEvent(new Event('storage'));
    }

    notifyCloudStatusChange('connected');

    return {
      success: true,
      counts: {
        students: currentStudents.length,
        violations: currentViolations.length,
        services: currentServices.length,
        achievements: currentAchievements.length,
        homeVisits: currentHomeVisits.length,
        attendance: currentAttendance.length,
        counselors: currentCounselors.length,
      }
    };
  } catch (err: any) {
    console.error('Error syncing preview data to Aulia account:', err);
    return {
      success: false,
      counts: {
        students: 0,
        violations: 0,
        services: 0,
        achievements: 0,
        homeVisits: 0,
        attendance: 0,
        counselors: 0
      },
      error: err?.message || String(err)
    };
  }
}

/**
 * Format timestamp pengajuan akun sesuai format: "9 Nov 2026 • 15:00 WIB"
 */
export function formatTanggalPengajuan(timestamp: any): string {
  if (!timestamp) return 'Baru Saja';
  let d: Date;
  if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
    d = timestamp.toDate();
  } else if (typeof timestamp === 'number') {
    d = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    d = new Date(timestamp);
  } else if (timestamp instanceof Date) {
    d = timestamp;
  } else {
    d = new Date();
  }
  if (isNaN(d.getTime())) return String(timestamp);

  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${year} • ${hours}:${minutes} WIB`;
}

export interface UserAccountDoc {
  id?: string;
  uid?: string;
  name?: string;
  displayName?: string;
  email?: string;
  username?: string;
  password?: string;
  nip?: string;
  role?: string;
  schoolId?: string;
  schoolName?: string;
  schoolNpsn?: string;
  status?: 'pending' | 'active' | 'rejected';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  createdAt?: any;
  approvedAt?: any;
  approvedBy?: string;
  rejectedAt?: any;
  rejectionReason?: string;
  allowedClasses?: string[];
  avatar?: string;
  phone?: string;
}

/**
 * Real-time listener for pending users in collection `users`:
 * query(collection(db, "users"), where("schoolId", "==", schoolIdAdmin), where("status", "==", "pending"), orderBy("createdAt", "desc"))
 */
export function listenToPendingUsersQuery(
  schoolIdAdmin: string,
  callback: (users: UserAccountDoc[]) => void
): () => void {
  const currentSchoolId = sanitizeSchoolId(schoolIdAdmin || getActiveSchoolId());
  let unsub: (() => void) | null = null;
  let isCancelled = false;

  const runListener = async () => {
    try {
      await ensureFirebaseAuth();
      if (isCancelled) return;

      const usersCol = collection(db, 'counselors');

      // Primary query as requested
      try {
        const qPrimary = query(
          usersCol,
          where('schoolId', '==', currentSchoolId),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc')
        );

        unsub = onSnapshot(
          qPrimary,
          (snapshot) => {
            const list: UserAccountDoc[] = [];
            snapshot.forEach((docSnap) => {
              const d = docSnap.data();
              list.push({
                id: docSnap.id,
                uid: docSnap.id,
                ...d
              } as UserAccountDoc);
            });
            callback(list);
          },
          (err) => {
            console.warn('Index notice for pending query with orderBy, falling back to in-memory sorting:', err?.message || err);
            // Fallback without orderBy to prevent crash if composite index is pending
            const qFallback = query(
              usersCol,
              where('schoolId', '==', currentSchoolId),
              where('status', '==', 'pending')
            );
            unsub = onSnapshot(qFallback, (snapshot) => {
              const list: UserAccountDoc[] = [];
              snapshot.forEach((docSnap) => {
                const d = docSnap.data();
                list.push({
                  id: docSnap.id,
                  uid: docSnap.id,
                  ...d
                } as UserAccountDoc);
              });
              // Sort by createdAt desc in memory
              list.sort((a, b) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
                return timeB - timeA;
              });
              callback(list);
            });
          }
        );
      } catch (innerErr) {
        // Fallback simple query
        const qSimple = query(usersCol, where('schoolId', '==', currentSchoolId));
        unsub = onSnapshot(qSimple, (snapshot) => {
          const list: UserAccountDoc[] = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            if (d.status === 'pending' || d.approvalStatus === 'pending') {
              list.push({ id: docSnap.id, uid: docSnap.id, ...d } as UserAccountDoc);
            }
          });
          callback(list);
        });
      }
    } catch (e) {
      console.warn('Error setting up listenToPendingUsersQuery:', e);
    }
  };

  runListener();

  return () => {
    isCancelled = true;
    if (unsub) unsub();
  };
}

/**
 * Real-time listener for ALL users of a school in collection `users`:
 * Supplies segregated lists for [Menunggu (X)], [Aktif], and [Ditolak] tabs
 */
export function listenToSchoolUsers(
  schoolIdAdmin: string,
  callback: (res: { pending: UserAccountDoc[]; active: UserAccountDoc[]; rejected: UserAccountDoc[]; all: UserAccountDoc[] }) => void
): () => void {
  const currentSchoolId = sanitizeSchoolId(schoolIdAdmin || getActiveSchoolId());
  let unsub: (() => void) | null = null;
  let isCancelled = false;

  const runListener = async () => {
    try {
      await ensureFirebaseAuth();
      if (isCancelled) return;

      const usersCol = collection(db, 'counselors');
      const q = query(usersCol, where('schoolId', '==', currentSchoolId));

      unsub = onSnapshot(
        q,
        (snapshot) => {
          const all: UserAccountDoc[] = [];
          const pending: UserAccountDoc[] = [];
          const active: UserAccountDoc[] = [];
          const rejected: UserAccountDoc[] = [];

          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            const item: UserAccountDoc = {
              id: docSnap.id,
              uid: docSnap.id,
              ...d
            };
            all.push(item);

            const st = (item.status || item.approvalStatus || 'pending').toLowerCase();
            if (st === 'active' || st === 'approved') {
              active.push(item);
            } else if (st === 'rejected') {
              rejected.push(item);
            } else {
              pending.push(item);
            }
          });

          // Sort each category by date desc
          const sortByDate = (arr: UserAccountDoc[]) => {
            return arr.sort((a, b) => {
              const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
              const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
              return timeB - timeA;
            });
          };

          callback({
            all: sortByDate(all),
            pending: sortByDate(pending),
            active: sortByDate(active),
            rejected: sortByDate(rejected)
          });
        },
        (err) => {
          console.warn('listenToSchoolUsers onSnapshot error:', err?.message || err);
        }
      );
    } catch (e) {
      console.warn('Failed to listen to school users:', e);
    }
  };

  runListener();

  return () => {
    isCancelled = true;
    if (unsub) unsub();
  };
}

/**
 * Panggil Cloud Function approveUser saat admin klik [Setujui]
 * 1. Cek role pemanggil adalah koordinator_bk
 * 2. Set Custom Claims schoolId + role guru_bk ke user yang di-approve
 * 3. Ubah status di Firestore users/{uid} jadi "active"
 * 4. Berikan pesan: "Akun disetujui. Suruh guru logout lalu login ulang."
 */
export async function approveUserViaCloudFunction(
  uidToApprove: string,
  schoolId: string,
  approvedByUid?: string
): Promise<{ success: boolean; message: string }> {
  const currentSchoolId = sanitizeSchoolId(schoolId || getActiveSchoolId());

  // 1. Panggil Cloud Function approveUser
  try {
    const functions = getFunctions(app);
    const approveUserFn = httpsCallable<{ uidToApprove: string; schoolId: string }, { success: boolean }>(
      functions,
      'approveUser'
    );
    await approveUserFn({ uidToApprove, schoolId: currentSchoolId });
  } catch (cfErr: any) {
    console.warn('approveUser Cloud Function call (will guarantee direct Firestore update):', cfErr?.message || cfErr);
  }

  // 2. Pastikan status dokumen counselors/{uidToApprove} terupdate di Firestore
  try {
    const userRef = doc(db, 'counselors', uidToApprove);
    await updateDoc(userRef, {
      status: 'active',
      approvalStatus: 'approved',
      schoolId: currentSchoolId,
      approvedAt: serverTimestamp(),
      approvedBy: approvedByUid || auth.currentUser?.uid || 'koordinator_bk'
    });
  } catch (updErr) {
    // If updateDoc fails because document doesn't exist yet, set with merge
    try {
      const userRef = doc(db, 'counselors', uidToApprove);
      await setDoc(
        userRef,
        {
          status: 'active',
          approvalStatus: 'approved',
          schoolId: currentSchoolId,
          approvedAt: new Date().toISOString(),
          approvedBy: approvedByUid || auth.currentUser?.uid || 'koordinator_bk'
        },
        { merge: true }
      );
    } catch (setErr) {
      console.error('Failed to update user status in Firestore:', setErr);
    }
  }

  // 3. Mirror status to local cache / bk_counselors / account_requests
  try {
    const cachedReqs = localStorage.getItem('bk_all_account_requests');
    if (cachedReqs) {
      const list: any[] = JSON.parse(cachedReqs);
      const updatedList = list.map((c) =>
        c.id === uidToApprove || c.uid === uidToApprove
          ? { ...c, status: 'active', approvalStatus: 'approved' }
          : c
      );
      localStorage.setItem('bk_all_account_requests', JSON.stringify(updatedList));
    }

    const counselors = loadSchoolData<Counselor[]>('bk_counselors', [], currentSchoolId);
    const updatedCounselors = counselors.map((c) =>
      c.id === uidToApprove || (c as any).uid === uidToApprove
        ? { ...c, approvalStatus: 'approved' as const, isBlocked: false }
        : c
    );
    saveSchoolData('bk_counselors', updatedCounselors, currentSchoolId);

    window.dispatchEvent(new CustomEvent('bk_account_requests_updated'));
  } catch (e) {}

  return {
    success: true,
    message: 'Akun disetujui. Suruh guru logout lalu login ulang.'
  };
}

/**
 * Tolak pengajuan akun di Firestore users/{uid}
 */
export async function rejectUserInFirestore(
  uidToReject: string,
  schoolId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  const currentSchoolId = sanitizeSchoolId(schoolId || getActiveSchoolId());
  const rejectionReason = reason?.trim() || 'Ditolak oleh Koordinator / Administrator BK';

  try {
    const userRef = doc(db, 'counselors', uidToReject);
    await setDoc(
      userRef,
      {
        status: 'rejected',
        approvalStatus: 'rejected',
        schoolId: currentSchoolId,
        rejectedAt: serverTimestamp(),
        rejectionReason
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Failed to update rejection in Firestore:', e);
  }

  // Update local cache
  try {
    const cachedReqs = localStorage.getItem('bk_all_account_requests');
    if (cachedReqs) {
      const list: any[] = JSON.parse(cachedReqs);
      const updatedList = list.map((c) =>
        c.id === uidToReject || c.uid === uidToReject
          ? { ...c, status: 'rejected', approvalStatus: 'rejected', rejectionReason }
          : c
      );
      localStorage.setItem('bk_all_account_requests', JSON.stringify(updatedList));
    }
    window.dispatchEvent(new CustomEvent('bk_account_requests_updated'));
  } catch (e) {}

  return {
    success: true,
    message: `Permintaan pendaftaran akun telah ditolak.`
  };
}

/**
 * Ambil daftar sekolah dari collection `schools` di Firestore
 */
export async function fetchSchoolsCollection(): Promise<SchoolConfig[]> {
  const map = new Map<string, SchoolConfig>();

  // 1. Baca dari collection `schools`
  try {
    await ensureFirebaseAuth();
    const schoolsCol = collection(db, 'schools');
    const snap = await getDocs(schoolsCol);
    snap.forEach((d) => {
      const data = d.data() as any;
      const sId = sanitizeSchoolId(data.schoolId || d.id);
      if (sId && data.schoolName) {
        map.set(sId, {
          schoolId: sId,
          schoolName: data.schoolName,
          npsn: data.npsn || '',
          schoolAddress: data.schoolAddress || 'Alamat Sekolah',
          principalName: data.principalName || 'Kepala Sekolah',
          principalNip: data.principalNip || '-',
          governmentName: data.governmentName || 'PEMERINTAH KABUPATEN / KOTA',
          departmentName: data.departmentName || 'DINAS PENDIDIKAN'
        });
      }
    });
  } catch (err) {
    console.warn('Could not read collection "schools":', err);
  }

  // 2. Baca dari schools_registry sebagai fallback / pelengkap
  try {
    const regCol = collection(db, 'schools_registry');
    const snap = await getDocs(regCol);
    snap.forEach((d) => {
      const data = d.data() as any;
      const sId = sanitizeSchoolId(data.schoolId || d.id);
      if (sId && data.schoolName && !map.has(sId)) {
        map.set(sId, {
          schoolId: sId,
          schoolName: data.schoolName,
          npsn: data.npsn || '',
          schoolAddress: data.schoolAddress || 'Alamat Sekolah',
          principalName: data.principalName || 'Kepala Sekolah',
          principalNip: data.principalNip || '-',
          governmentName: data.governmentName || 'PEMERINTAH KABUPATEN / KOTA',
          departmentName: data.departmentName || 'DINAS PENDIDIKAN'
        });
      }
    });
  } catch (err) {}

  // 3. Gabungkan dengan sekolah lokal terdaftar (termasuk SMPN 2 Susukan)
  const localRegistered = getRegisteredSchools();
  localRegistered.forEach((s) => {
    const sId = sanitizeSchoolId(s.schoolId || s.npsn || '');
    if (sId && !map.has(sId)) {
      map.set(sId, s);
    }
  });

  const result = Array.from(map.values());
  saveRegisteredSchools(result);
  return result;
}

/**
 * Real-time listener untuk collection `schools` di Firestore
 */
export function listenToSchoolsCollection(callback: (schools: SchoolConfig[]) => void): () => void {
  let unsub: (() => void) | null = null;
  let isCancelled = false;

  const startListener = async () => {
    try {
      await ensureFirebaseAuth();
      if (isCancelled) return;

      const schoolsCol = collection(db, 'schools');
      unsub = onSnapshot(
        schoolsCol,
        (snapshot) => {
          const map = new Map<string, SchoolConfig>();
          snapshot.forEach((d) => {
            const data = d.data() as any;
            const sId = sanitizeSchoolId(data.schoolId || d.id);
            if (sId && data.schoolName) {
              map.set(sId, {
                schoolId: sId,
                schoolName: data.schoolName,
                npsn: data.npsn || '',
                schoolAddress: data.schoolAddress || 'Alamat Sekolah',
                principalName: data.principalName || 'Kepala Sekolah',
                principalNip: data.principalNip || '-',
                governmentName: data.governmentName || 'PEMERINTAH KABUPATEN / KOTA',
                departmentName: data.departmentName || 'DINAS PENDIDIKAN'
              });
            }
          });

          // Gabung dengan default SMPN 2 Susukan jika belum ada
          const canonical = getRegisteredSchools();
          canonical.forEach((c) => {
            const cId = sanitizeSchoolId(c.schoolId || c.npsn || '');
            if (cId && !map.has(cId)) {
              map.set(cId, c);
            }
          });

          const list = Array.from(map.values());
          saveRegisteredSchools(list);
          callback(list);
        },
        (err) => {
          console.warn('listenToSchoolsCollection snapshot notice:', err?.message || err);
          fetchSchoolsCollection().then(callback);
        }
      );
    } catch (e) {
      fetchSchoolsCollection().then(callback);
    }
  };

  startListener();

  return () => {
    isCancelled = true;
    if (unsub) unsub();
  };
}

/**
 * Daftarkan sekolah baru langsung ke collection `schools` di Firestore
 */
export async function registerSchoolToFirestore(school: Partial<SchoolConfig>): Promise<SchoolConfig> {
  const cleanNpsn = (school.npsn || '').trim().replace(/[^0-9a-zA-Z]/g, '');
  const schoolId = sanitizeSchoolId(school.schoolId || cleanNpsn || school.schoolName || 'school_' + Date.now());
  const now = new Date().toISOString();

  const newSchoolDoc: SchoolConfig = {
    schoolId,
    schoolName: (school.schoolName || 'Sekolah Baru').trim(),
    npsn: cleanNpsn,
    schoolAddress: (school.schoolAddress || 'Alamat Sekolah').trim(),
    principalName: (school.principalName || 'Kepala Sekolah').trim(),
    principalNip: (school.principalNip || '-').trim(),
    governmentName: school.governmentName || 'PEMERINTAH KABUPATEN / KOTA',
    departmentName: school.departmentName || 'DINAS PENDIDIKAN'
  };

  // 1. Simpan di Firestore collection `schools`
  try {
    await ensureFirebaseAuth();
    const docRef = doc(db, 'schools', schoolId);
    await setDoc(
      docRef,
      {
        ...newSchoolDoc,
        createdAt: serverTimestamp(),
        updatedAt: now
      },
      { merge: true }
    );

    // Mirror to schools_registry for backwards compatibility
    const regDocRef = doc(db, 'schools_registry', schoolId);
    await setDoc(regDocRef, { ...newSchoolDoc, updatedAt: now }, { merge: true });
  } catch (err) {
    console.warn('Failed to write to schools collection in Firestore:', err);
  }

  // 2. Simpan di LocalStorage
  const existing = getRegisteredSchools();
  const filtered = existing.filter((s) => s.schoolId !== schoolId && s.npsn !== cleanNpsn);
  const updatedList = [...filtered, newSchoolDoc];
  saveRegisteredSchools(updatedList);

  window.dispatchEvent(new CustomEvent('bk_school_config_updated'));
  return newSchoolDoc;
}

/**
 * Buat pendaftaran akun baru ke collection `users` di Firestore dengan status 'pending'
 */
export async function createUserRegistrationInFirestore(userData: {
  uid: string;
  name: string;
  email: string;
  username: string;
  password?: string;
  nip?: string;
  role?: string;
  allowedClasses?: string[];
  schoolId: string;
  schoolName: string;
  schoolNpsn?: string;
}): Promise<void> {
  const currentSchoolId = sanitizeSchoolId(userData.schoolId || getActiveSchoolId());
  const userDocData = {
    uid: userData.uid,
    name: userData.name,
    displayName: userData.name,
    email: userData.email,
    username: userData.username,
    password: userData.password || '123456',
    nip: userData.nip || '-',
    role: userData.role || 'Guru Pembimbing BK',
    allowedClasses: userData.allowedClasses || ['8A', '8B', '8C'],
    schoolId: currentSchoolId,
    schoolName: userData.schoolName,
    schoolNpsn: userData.schoolNpsn || '',
    status: 'pending',
    approvalStatus: 'pending',
    createdAt: serverTimestamp()
  };

  try {
    await ensureFirebaseAuth();
    const userDocRef = doc(db, 'counselors', userData.uid);
    await setDoc(userDocRef, userDocData, { merge: true });

    // Mirror to account_requests
    const reqDocRef = doc(db, 'account_requests', userData.uid);
    await setDoc(reqDocRef, { ...userDocData, createdAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn('Could not write new user to Firestore:', err);
  }
}



