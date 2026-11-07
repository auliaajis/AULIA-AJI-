import { registerDeletedId } from './deletionTracker';
import { deleteFromFirestore, saveSchoolData, loadSchoolData, saveBulkToFirestore, broadcastRealtimeChange } from './firestoreSync';
import { getActiveSchoolId } from './schoolConfig';
import { CANONICAL_AULIA_STUDENTS } from '../data/canonicalStudents';
import { Student } from '../types';

// Known dummy violation / service IDs from ancient mock templates
const DUMMY_VIOLATION_IDS = new Set(['v-dummy-test-1', 'v-dummy-test-2']);
const DUMMY_SERVICE_IDS = new Set(['srv-dummy-test-1']);

/**
 * Checks if a student record is identified as a dummy/sample student.
 * NOTE: CANONICAL_AULIA_STUDENTS (194 Siswa SMP Negeri 2 Susukan) are REAL genuine student records!
 * They are NEVER dummy data.
 */
export function isDummyStudent(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  if (item.__isExplicitPurgeableDummy === true) return true;
  
  const name = String(item.name || '').toLowerCase().trim();
  if (name.includes('dummy') || name.includes('uji coba data') || name === 'test student') {
    return true;
  }
  
  // Non-SMP classes in SMP Negeri 2 Susukan (e.g. leftover 10A, 11B from old SMA templates)
  const cls = String(item.class || '').replace(/kelas\s*/i, '').trim().toUpperCase();
  if (/^(10|11|12|X|XI|XII)/i.test(cls)) {
    return true;
  }

  return false;
}

/**
 * Checks if a record is identified as dummy data.
 */
export function isDummyRecord(item: any, collectionKey: string): boolean {
  if (!item || typeof item !== 'object') return false;
  if (item.__isExplicitPurgeableDummy === true) return true;

  if (collectionKey === 'bk_students' || collectionKey === 'students') {
    return isDummyStudent(item);
  }
  if (collectionKey === 'bk_violations' || collectionKey === 'violations') {
    const id = String(item.id || '').trim();
    if (DUMMY_VIOLATION_IDS.has(id)) return true;
    const cat = String(item.category || '').toLowerCase();
    if (cat.includes('dummy')) return true;
  }
  if (collectionKey === 'bk_services' || collectionKey === 'services') {
    const id = String(item.id || '').trim();
    if (DUMMY_SERVICE_IDS.has(id)) return true;
  }
  return false;
}

/**
 * Purges all dummy student records from LocalStorage and Firestore.
 * Preserves genuine students (non-dummy).
 */
export async function purgeDummyStudents(targetSchoolId?: string): Promise<{ totalPurged: number; remainingCount: number }> {
  const schoolId = targetSchoolId || getActiveSchoolId();
  const currentStudents = loadSchoolData<Student[]>('bk_students', [], schoolId);

  // Collect only real dummy students
  const dummyStudents = Array.isArray(currentStudents) ? currentStudents.filter(isDummyStudent) : [];
  const realStudents = Array.isArray(currentStudents) ? currentStudents.filter(s => !isDummyStudent(s)) : [];

  // Register only actual dummy IDs in deletion tracker and delete from Firestore
  for (const st of dummyStudents) {
    registerDeletedId(st.id);
    deleteFromFirestore('bk_students', st.id, schoolId).catch(() => {});
  }

  // Persist the real students
  saveSchoolData('bk_students', realStudents, schoolId);

  if (realStudents.length > 0) {
    saveBulkToFirestore('bk_students', realStudents, schoolId).catch(() => {});
  }

  // Broadcast change
  broadcastRealtimeChange({
    type: 'sync',
    key: 'bk_students',
    data: realStudents,
    schoolId
  });
  window.dispatchEvent(new CustomEvent('bk_realtime_sync', {
    detail: { key: 'bk_students', data: realStudents, schoolId }
  }));
  window.dispatchEvent(new Event('storage'));

  return {
    totalPurged: dummyStudents.length,
    remainingCount: realStudents.length
  };
}

/**
 * Scans LocalStorage and Firestore, purges all dummy records, and returns stats.
 */
export async function purgeDummyData(targetSchoolId?: string): Promise<{ totalPurged: number; details: Record<string, number> }> {
  const schoolId = targetSchoolId || getActiveSchoolId();
  const studentResult = await purgeDummyStudents(schoolId);

  // Also clean dummy violations that reference dummy students
  const currentViolations = loadSchoolData<any[]>('bk_violations', [], schoolId);
  let purgedViolations = 0;
  if (Array.isArray(currentViolations)) {
    const realViolations = currentViolations.filter(v => {
      const isDummy = isDummyRecord(v, 'bk_violations');
      if (isDummy) {
        registerDeletedId(v.id);
        deleteFromFirestore('bk_violations', v.id, schoolId).catch(() => {});
        purgedViolations++;
        return false;
      }
      return true;
    });
    if (purgedViolations > 0) {
      saveSchoolData('bk_violations', realViolations, schoolId);
      saveBulkToFirestore('bk_violations', realViolations, schoolId).catch(() => {});
      broadcastRealtimeChange({
        type: 'sync',
        key: 'bk_violations',
        data: realViolations,
        schoolId
      });
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', {
        detail: { key: 'bk_violations', data: realViolations, schoolId }
      }));
    }
  }

  const totalPurged = studentResult.totalPurged + purgedViolations;

  return {
    totalPurged,
    details: {
      students: studentResult.totalPurged,
      violations: purgedViolations
    }
  };
}
