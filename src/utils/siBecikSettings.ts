import { doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { ProgramEvaluation } from '../types';
import { isEvaluationDueFor14DayFollowUp } from './evaluationHelpers';
import { db, getSchoolColRef } from './firestoreSync';
import { getActiveSchoolId, sanitizeSchoolId } from './schoolConfig';

const FAB_ENABLED_KEY = 'siBecikFabEnabled';
const FAB_UPDATED_AT_KEY = 'siBecikFabUpdatedAt';
const UNREAD_KEY = 'siBecikUnread';
const SEEN_OVERDUE_KEY = 'siBecikSeenOverdueIds';

/**
 * Reads persisted FAB ON/OFF preference synchronously from localStorage.
 * Default is true ONLY when user has not explicitly turned it off.
 */
export function getLocalSiBecikFabEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    const raw = localStorage.getItem(FAB_ENABLED_KEY);
    if (raw === 'false') return false;
    if (raw === 'true') return true;
    return true;
  } catch {
    return true;
  }
}

export function saveLocalSiBecikFabEnabled(enabled: boolean): string {
  const nowIso = new Date().toISOString();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FAB_ENABLED_KEY, String(enabled));
      localStorage.setItem(FAB_UPDATED_AT_KEY, nowIso);
    }
  } catch {}
  return nowIso;
}

/**
 * Saves FAB ON/OFF setting both to localStorage (instant, survives refresh)
 * and Firestore userSettings (cross-session sync).
 */
export async function saveSiBecikFabSettings(
  enabled: boolean,
  counselorId?: string,
  schoolId?: string
): Promise<void> {
  const updatedAt = saveLocalSiBecikFabEnabled(enabled);

  try {
    const cleanSchool = sanitizeSchoolId(schoolId || getActiveSchoolId() || 'sch_20320123');
    const cleanCounselor = String(counselorId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
    const docKey = `${cleanSchool}_${cleanCounselor}`;

    await Promise.allSettled([
      setDoc(
        doc(db, 'userSettings', docKey),
        {
          siBecikFabEnabled: enabled,
          counselorId: cleanCounselor,
          schoolId: cleanSchool,
          updatedAt,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, 'schools', cleanSchool),
        {
          userSettings: {
            [cleanCounselor]: {
              siBecikFabEnabled: enabled,
              updatedAt,
            },
          },
        },
        { merge: true }
      ),
    ]);
  } catch {
    // LocalStorage remains source of truth when offline
  }
}

/**
 * Loads userSettings.siBecikFabEnabled from Firestore.
 * Respects newer local changes so toggling OFF never reverts back to ON after refresh.
 */
export async function loadSiBecikFabSettingsFromFirestore(
  counselorId?: string,
  schoolId?: string
): Promise<boolean | null> {
  try {
    const cleanSchool = sanitizeSchoolId(schoolId || getActiveSchoolId() || 'sch_20320123');
    const cleanCounselor = String(counselorId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
    const docKey = `${cleanSchool}_${cleanCounselor}`;

    let remoteVal: boolean | null = null;
    let remoteUpdatedAt = '';

    try {
      const snap = await getDoc(doc(db, 'userSettings', docKey));
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data?.siBecikFabEnabled === 'boolean') {
          remoteVal = data.siBecikFabEnabled;
          remoteUpdatedAt = String(data.updatedAt || '');
        }
      }
    } catch {}

    if (remoteVal === null) {
      try {
        const schoolSnap = await getDoc(doc(db, 'schools', cleanSchool));
        if (schoolSnap.exists()) {
          const nested = schoolSnap.data()?.userSettings?.[cleanCounselor];
          if (typeof nested?.siBecikFabEnabled === 'boolean') {
            remoteVal = nested.siBecikFabEnabled;
            remoteUpdatedAt = String(nested.updatedAt || '');
          }
        }
      } catch {}
    }

    if (remoteVal === null) return null;

    const localRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(FAB_ENABLED_KEY) : null;
    const localUpdatedAt =
      (typeof localStorage !== 'undefined' ? localStorage.getItem(FAB_UPDATED_AT_KEY) : null) || '';

    // If user already has an explicit local preference that is newer or equal, keep local preference
    if (localRaw !== null && localUpdatedAt && (!remoteUpdatedAt || localUpdatedAt >= remoteUpdatedAt)) {
      return localRaw !== 'false';
    }

    saveLocalSiBecikFabEnabled(remoteVal);
    return remoteVal;
  } catch {
    return null;
  }
}

/**
 * Unread state from Si Becik (default false, never hardcoded to 1).
 */
export function getSiBecikUnread(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(UNREAD_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSiBecikUnread(unread: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(UNREAD_KEY, String(unread));
    }
  } catch {}
}

export function getSeenOverdueIds(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(SEEN_OVERDUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function markOverdueIdsSeen(ids: string[]): string[] {
  const existing = getSeenOverdueIds();
  const merged = Array.from(new Set([...existing, ...ids.map(String)]));
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SEEN_OVERDUE_KEY, JSON.stringify(merged));
    }
  } catch {}
  return merged;
}

/**
 * Computes IDs of service evaluations whose 14-day follow-up is overdue
 * directly from Firestore service_evaluations combined with in-memory evaluations.
 */
export async function fetchOverdueFollowUpIdsFromFirestore(
  schoolId: string,
  localEvaluations: ProgramEvaluation[] = []
): Promise<string[]> {
  const map = new Map<string, ProgramEvaluation>();
  (localEvaluations || []).forEach((ev) => {
    if (ev && ev.id) {
      map.set(ev.id, ev);
    }
  });

  try {
    const colRef = getSchoolColRef('service_evaluations', schoolId);
    const snap = await getDocs(colRef);
    snap.forEach((docSnap) => {
      const data = docSnap.data() as ProgramEvaluation;
      if (data) {
        const id = data.id || docSnap.id;
        map.set(id, { ...data, id });
      }
    });
  } catch {
    // Fallback gracefully to in-memory Firestore-synced evaluations
  }

  const overdueIds: string[] = [];
  map.forEach((ev, id) => {
    if (isEvaluationDueFor14DayFollowUp(ev)) {
      overdueIds.push(ev.serviceId ? String(ev.serviceId) : String(id));
    }
  });

  return Array.from(new Set(overdueIds));
}
