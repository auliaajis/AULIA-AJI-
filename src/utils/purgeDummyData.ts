import { registerDeletedId } from './deletionTracker';
import { deleteFromFirestore } from './firestoreSync';

// List of known dummy student IDs, NIS, and Names
const DUMMY_STUDENT_IDS = new Set([
  's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12'
]);

const DUMMY_STUDENT_NIS = new Set([
  '21221001', '21221042', '21221088', '21221015', '21221024', '21221057',
  '21221063', '21221033', '21221094', '21221040', '21221102', '21221145'
]);

const DUMMY_STUDENT_NAMES = new Set([
  'Aditya Saputra', 'Bela Mahendra', 'Raka Kurniawan', 'Aditya Pratama',
  'Siti Aminah', 'Rizky Ramadhan', 'Rangga Wijaya', 'Bagas Saputra',
  'Lina Marlina', 'Siti Nurhaliza', 'Bagus Nugroho', 'Dimas Setiawan'
]);

const DUMMY_VIOLATION_IDS = new Set(['v1', 'v2', 'v3']);
const DUMMY_VIOLATION_TICKETS = new Set(['PLG-2023-089', 'PLG-2023-090', 'PLG-2023-087']);

const DUMMY_SERVICE_IDS = new Set(['srv1']);
const DUMMY_JOURNAL_IDS = new Set(['j-mock-1', 'j-mock-2', 'j-mock-3']);
const DUMMY_SUMMON_IDS = new Set(['ps-demo-1', 'ps-demo-2']);
const DUMMY_LOG_IDS = new Set(['log1', 'log2', 'log3', 'log4', 'log5']);
const DUMMY_NOTE_IDS = new Set(['note-1', 'note-2']);
const DUMMY_SCHEDULE_IDS = new Set(['sch-1', 'sch-2', 'sch-3', 'sch-4', 'sch-5']);

/**
 * Checks if a record is identified as dummy data
 */
export function isDummyRecord(item: any, collectionKey: string): boolean {
  if (!item || typeof item !== 'object') return false;

  const id = String(item.id || '');

  switch (collectionKey) {
    case 'bk_students':
      // Only purge exact initial mock student IDs (s1..s12)
      return DUMMY_STUDENT_IDS.has(id);

    case 'bk_violations':
      return DUMMY_VIOLATION_IDS.has(id) ||
        DUMMY_VIOLATION_TICKETS.has(String(item.ticketId || '')) ||
        DUMMY_STUDENT_IDS.has(String(item.studentId || ''));

    case 'bk_services':
      if (DUMMY_SERVICE_IDS.has(id) || id.startsWith('srv-mock')) return true;
      if (Array.isArray(item.students)) {
        return item.students.some((s: any) => DUMMY_STUDENT_IDS.has(String(s.id || '')));
      }
      return false;

    case 'bk_daily_journals':
      return DUMMY_JOURNAL_IDS.has(id) || id.startsWith('j-mock-');

    case 'bk_parent_summons':
      return DUMMY_SUMMON_IDS.has(id) || id.startsWith('ps-demo-');

    case 'bk_attendance_history':
      if (id.startsWith('att-kelas-7a-') || id.startsWith('att-kelas-8a-') || id.startsWith('att-kelas-7b-')) {
        return true;
      }
      if (Array.isArray(item.records)) {
        return item.records.some((r: any) => DUMMY_STUDENT_IDS.has(String(r.studentId || '')));
      }
      return false;

    case 'bk_logs':
      return DUMMY_LOG_IDS.has(id) || id.startsWith('log-mock');

    case 'bk_sticky_notes':
      return DUMMY_NOTE_IDS.has(id);

    case 'bk_teaching_schedule':
    case 'bk_jadwal_mengajar':
      return DUMMY_SCHEDULE_IDS.has(id);

    default:
      return false;
  }
}

/**
 * Scans LocalStorage and Firestore, purges all dummy records, and returns stats.
 */
export async function purgeDummyData(): Promise<{ totalPurged: number; details: Record<string, number> }> {
  const collectionsToScan = [
    'bk_students',
    'bk_violations',
    'bk_services',
    'bk_daily_journals',
    'bk_parent_summons',
    'bk_attendance_history',
    'bk_logs',
    'bk_sticky_notes',
    'bk_teaching_schedule',
    'bk_jadwal_mengajar'
  ];

  let totalPurged = 0;
  const details: Record<string, number> = {};

  for (const key of collectionsToScan) {
    let countForKey = 0;
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) continue;

      const validItems: any[] = [];
      for (const item of items) {
        if (isDummyRecord(item, key)) {
          countForKey++;
          const itemId = String(item.id || '');
          if (itemId) {
            registerDeletedId(itemId);
            // Delete from Firestore Realtime Database
            deleteFromFirestore(key, itemId).catch(() => {});
          }
        } else {
          validItems.push(item);
        }
      }

      if (countForKey > 0) {
        localStorage.setItem(key, JSON.stringify(validItems));
        details[key] = countForKey;
        totalPurged += countForKey;
      }
    } catch (err) {
      console.error(`Error purging dummy data for ${key}:`, err);
    }
  }

  // Handle bk_akpd_class_sessions if present
  try {
    const rawAkpd = localStorage.getItem('bk_akpd_class_sessions');
    if (rawAkpd) {
      const parsed = JSON.parse(rawAkpd);
      if (parsed && typeof parsed === 'object') {
        if (parsed['7A'] && parsed['7A'].submissions) {
          const subs = parsed['7A'].submissions;
          if (Array.isArray(subs) && subs.some((s: any) => DUMMY_STUDENT_IDS.has(String(s.studentId || '')))) {
            delete parsed['7A'];
            localStorage.setItem('bk_akpd_class_sessions', JSON.stringify(parsed));
            totalPurged += 1;
            details['bk_akpd_class_sessions'] = 1;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error purging dummy AKPD data:', err);
  }

  if (totalPurged > 0) {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'all' } }));
  }

  return { totalPurged, details };
}
