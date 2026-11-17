import { registerDeletedId } from './deletionTracker';
import { deleteFromFirestore, saveSchoolData, loadSchoolData, saveBulkToFirestore, broadcastRealtimeChange, db } from './firestoreSync';
import { getActiveSchoolId, sanitizeSchoolId } from './schoolConfig';
import { CANONICAL_AULIA_STUDENTS } from '../data/canonicalStudents';
import { Student, Counselor, ViolationRecord, CounselingService } from '../types';
import { doc, deleteDoc } from 'firebase/firestore';

// Known dummy violation / service IDs from ancient mock templates
const DUMMY_VIOLATION_IDS = new Set(['v-dummy-test-1', 'v-dummy-test-2']);
const DUMMY_SERVICE_IDS = new Set(['srv-dummy-test-1']);

// Lookup maps built from CANONICAL_AULIA_STUDENTS (s1..s194 legacy template placeholders)
const MOCK_TEMPLATE_BY_ID = new Map<string, { name: string; nis: string; classNorm: string }>();
const MOCK_TEMPLATE_SIG_SET = new Set<string>();
(CANONICAL_AULIA_STUDENTS || []).forEach((s) => {
  const normName = String(s.name || '').toLowerCase().trim();
  const normClass = String(s.class || '').replace(/kelas\s*/i, '').trim().toUpperCase();
  const nis = String(s.nis || '').trim();
  MOCK_TEMPLATE_BY_ID.set(String(s.id), { name: normName, nis, classNorm: normClass });
  if (normName && normClass) {
    MOCK_TEMPLATE_SIG_SET.add(`${normName}|${normClass}|${nis}`);
  }
});

/**
 * Checks whether a student record is one of the 194 legacy mock template students
 * (s1..s194 e.g. Ahmad Fauzi, Adinda Putri, Jessica Mila with NIS 21221001..21221194).
 */
export function isLegacyMockTemplateStudent(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  const id = String(item.id || '').trim();
  const name = String(item.name || '').toLowerCase().trim();
  const nis = String(item.nis || '').trim();
  const classNorm = String(item.class || '').replace(/kelas\s*/i, '').trim().toUpperCase();

  // Never flag authentic timestamped IDs (s-...) as mock templates
  if (id.startsWith('s-')) return false;

  const byId = MOCK_TEMPLATE_BY_ID.get(id);
  if (byId && (byId.name === name || (nis && byId.nis === nis))) {
    return true;
  }

  if (/^21221\d{3}$/.test(nis) && MOCK_TEMPLATE_SIG_SET.has(`${name}|${classNorm}|${nis}`)) {
    return true;
  }

  return false;
}

/**
 * Checks if a student record is identified as a dummy/sample/template student.
 */
export function isDummyStudent(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  if (item.__isExplicitPurgeableDummy === true) return true;
  if (isLegacyMockTemplateStudent(item)) return true;

  const id = String(item.id || '').trim();
  const name = String(item.name || '').toLowerCase().trim();
  // Jangan pernah menganggap data buatan pengguna (ID berawalan s-) sebagai dummy template hanya karena nama
  if (
    !id.startsWith('s-') &&
    (name.includes('uji coba') ||
      name === 'test student' ||
      name.includes('contoh siswa') ||
      name.includes('sample student') ||
      name === 'nama siswa')
  ) {
    return true;
  }

  // Non-SMP classes in SMP Negeri 2 Susukan (e.g. leftover 10A, 11B from old SMA templates)
  const cls = String(item.class || '').replace(/kelas\s*/i, '').trim().toUpperCase();
  if (!id.startsWith('s-') && /^(10|11|12|X|XI|XII)/i.test(cls)) {
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

export interface DeduplicationSummary {
  success: boolean;
  purgedDummies: number;
  deduplicatedStudents: number;
  deduplicatedViolations: number;
  deduplicatedServices: number;
  remainingStudents: number;
  message: string;
}

/**
 * Pembersihan Menyeluruh: Mengeliminasi data ganda/dobel (deduplikasi berdasarkan NIS dan Nama + Kelas),
 * menghapus data dummy yang bukan siswa resmi, dan memastikan profil Koordinator BK mengampu Kelas 8 (8A-8G).
 */
export async function deduplicateAndPurgeAllData(targetSchoolId?: string): Promise<DeduplicationSummary> {
  const schoolId = sanitizeSchoolId(targetSchoolId || getActiveSchoolId() || 'sch_20320123');
  const isCanonical = schoolId === 'sch_20320123';

  let purgedDummies = 0;
  let deduplicatedStudents = 0;
  let deduplicatedViolations = 0;
  let deduplicatedServices = 0;

  // 1. DEDUPLIKASI & PEMBERSIHAN SISWA (STUDENTS)
  // Jangan pernah menyuntikkan ulang data dummy template (CANONICAL_AULIA_STUDENTS s1..s194)
  const currentStudents = loadSchoolData<Student[]>('bk_students', [], schoolId);
  const cleanStudentMap = new Map<string, Student>(); // canonicalId -> Student
  const seenNis = new Map<string, string>(); // nis -> canonicalId
  const seenNameClass = new Map<string, string>(); // name|class -> canonicalId
  const duplicateIdsToDelete = new Set<string>();

  // Periksa seluruh data siswa di cache / storage (utamakan record asli s-... atau yang memiliki NIS lengkap)
  if (Array.isArray(currentStudents)) {
    const sortedInput = [...currentStudents].sort((a, b) => {
      const aAuth = String(a?.id || '').startsWith('s-') ? 1 : 0;
      const bAuth = String(b?.id || '').startsWith('s-') ? 1 : 0;
      if (aAuth !== bAuth) return bAuth - aAuth;
      const aNis = String(a?.nis || '').trim() ? 1 : 0;
      const bNis = String(b?.nis || '').trim() ? 1 : 0;
      return bNis - aNis;
    });

    for (const st of sortedInput) {
      if (!st || !st.id) continue;

      // Cek apakah data dummy (termasuk mock template s1..s194)
      if (isDummyStudent(st)) {
        purgedDummies++;
        duplicateIdsToDelete.add(st.id);
        registerDeletedId(st.id);
        continue;
      }

      const stNis = String(st.nis || '').trim();
      const cleanName = String(st.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanClass = String(st.class || '').replace(/kelas\s*/i, '').replace(/[^a-z0-9]/g, '').toUpperCase();
      const nameClassKey = `${cleanName}|${cleanClass}`;

      // Cari apakah sudah ada data siswa yang sama (berdasarkan NIS atau Nama + Kelas)
      const matchedCanonicalId = (stNis && seenNis.get(stNis)) || (cleanName ? seenNameClass.get(nameClassKey) : undefined);

      if (matchedCanonicalId) {
        if (matchedCanonicalId !== st.id) {
          // GANDA / DOBEL TERDETEKSI!
          deduplicatedStudents++;
          duplicateIdsToDelete.add(st.id);
          registerDeletedId(st.id);

          // Salin riwayat poin, NIS, atau catatan jika ada
          const existing = cleanStudentMap.get(matchedCanonicalId);
          if (existing) {
            if (!existing.nis && stNis) existing.nis = stNis;
            if (!existing.gender && st.gender) existing.gender = st.gender;
            existing.violationPoints = Math.max(existing.violationPoints || 0, st.violationPoints || 0);
            existing.bkServicesCount = Math.max(existing.bkServicesCount || 0, st.bkServicesCount || 0);
            existing.achievementPoints = Math.max(existing.achievementPoints || 0, st.achievementPoints || 0);
          }
        }
      } else {
        // Siswa valid (bukan dummy dan bukan duplikat)
        cleanStudentMap.set(st.id, {
          ...st,
          schoolId,
          schoolName: st.schoolName || (isCanonical ? 'SMP N 2 Susukan' : 'Sekolah'),
          isLegacyUnmigrated: false
        });
        if (stNis) seenNis.set(stNis, st.id);
        if (cleanName) seenNameClass.set(nameClassKey, st.id);
      }
    }
  }

  // Hapus dokumen duplikat & dummy dari Firestore
  for (const dupId of duplicateIdsToDelete) {
    try {
      deleteFromFirestore('bk_students', dupId, schoolId).catch(() => {});
      deleteDoc(doc(db, 'students', dupId)).catch(() => {});
      deleteDoc(doc(db, 'schools', schoolId, 'students', dupId)).catch(() => {});
    } catch (e) {}
  }

  // Simpan hasil siswa bersih bebas ganda
  const finalCleanStudents = Array.from(cleanStudentMap.values());
  saveSchoolData('bk_students', finalCleanStudents, schoolId);
  saveBulkToFirestore('bk_students', finalCleanStudents, schoolId).catch(() => {});

  // 2. DEDUPLIKASI KASUS / PELANGGARAN (VIOLATIONS)
  const currentViolations = loadSchoolData<ViolationRecord[]>('bk_violations', [], schoolId);
  const cleanViolationMap = new Map<string, ViolationRecord>();
  const seenViolationKeys = new Set<string>();
  const duplicateViolationIds = new Set<string>();

  if (Array.isArray(currentViolations)) {
    for (const v of currentViolations) {
      if (!v || !v.id) continue;
      if (isDummyRecord(v, 'bk_violations')) {
        continue;
      }

      // Kunci unik pelanggaran: ticketId atau (studentId + date + category)
      const vKey = v.ticketId ? `ticket_${v.ticketId}` : `${v.studentId}_${v.date}_${v.category}`;
      if (seenViolationKeys.has(vKey)) {
        deduplicatedViolations++;
        duplicateViolationIds.add(v.id);
        registerDeletedId(v.id);
      } else {
        seenViolationKeys.add(vKey);
        cleanViolationMap.set(v.id, { ...v, schoolId, isLegacyUnmigrated: false });
      }
    }
  }

  for (const vId of duplicateViolationIds) {
    deleteFromFirestore('bk_violations', vId, schoolId).catch(() => {});
    deleteDoc(doc(db, 'cases', vId)).catch(() => {});
    deleteDoc(doc(db, 'violations', vId)).catch(() => {});
  }

  const finalCleanViolations = Array.from(cleanViolationMap.values());
  saveSchoolData('bk_violations', finalCleanViolations, schoolId);
  saveSchoolData('bk_cases', finalCleanViolations, schoolId);

  // 3. DEDUPLIKASI LAYANAN KONSELING (SERVICES)
  const currentServices = loadSchoolData<CounselingService[]>('bk_services', [], schoolId);
  const cleanServiceMap = new Map<string, CounselingService>();
  const seenServiceKeys = new Set<string>();
  const duplicateServiceIds = new Set<string>();

  if (Array.isArray(currentServices)) {
    for (const s of currentServices) {
      if (!s || !s.id) continue;
      const srvAny = s as any;
      if (isDummyRecord(s, 'bk_services')) {
        duplicateServiceIds.add(s.id);
        registerDeletedId(s.id);
        continue;
      }

      // Kunci unik layanan
      const sKey = `${srvAny.studentId || (s.students && s.students[0]?.id) || 'no_st'}_${s.date}_${s.serviceType}_${s.startTime}`;
      if (seenServiceKeys.has(sKey)) {
        deduplicatedServices++;
        duplicateServiceIds.add(s.id);
        registerDeletedId(s.id);
      } else {
        seenServiceKeys.add(sKey);
        cleanServiceMap.set(s.id, { ...s, schoolId, isLegacyUnmigrated: false });
      }
    }
  }

  for (const sId of duplicateServiceIds) {
    deleteFromFirestore('bk_services', sId, schoolId).catch(() => {});
    deleteDoc(doc(db, 'counseling', sId)).catch(() => {});
    deleteDoc(doc(db, 'services', sId)).catch(() => {});
  }

  const finalCleanServices = Array.from(cleanServiceMap.values());
  saveSchoolData('bk_services', finalCleanServices, schoolId);
  saveSchoolData('bk_counseling', finalCleanServices, schoolId);

  // 4. Pastikan Akun Bapak Aulia Aji Sasongko diatur khusus KELAS 8 (8A-8G)
  if (isCanonical) {
    const localCounselors = loadSchoolData<Counselor[]>('bk_counselors', [], schoolId);
    if (Array.isArray(localCounselors)) {
      const updatedCounselors = localCounselors.map(c => {
        const isAulia = c.id === 'c1' || c.username === 'aulia' || (c.name && c.name.toLowerCase().includes('aulia')) || (c.email && c.email.includes('auliasasongko'));
        if (isAulia) {
          return {
            ...c,
            role: 'Koordinator BK & Guru Pembimbing Kelas 8',
            allowedClasses: ['8A', '8B', '8C', '8D', '8E', '8F', '8G'],
            schoolId,
            schoolName: 'SMP N 2 Susukan'
          };
        }
        return c;
      });
      saveSchoolData('bk_counselors', updatedCounselors, schoolId);
    }
  }

  // 5. Broadcast perubahan ke seluruh tab dan komponen aktif
  broadcastRealtimeChange({
    type: 'sync',
    key: 'bk_students',
    data: finalCleanStudents,
    schoolId
  });
  broadcastRealtimeChange({
    type: 'sync',
    key: 'bk_violations',
    data: finalCleanViolations,
    schoolId
  });
  broadcastRealtimeChange({
    type: 'sync',
    key: 'bk_services',
    data: finalCleanServices,
    schoolId
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_students', data: finalCleanStudents, schoolId } }));
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_violations', data: finalCleanViolations, schoolId } }));
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_services', data: finalCleanServices, schoolId } }));
    window.dispatchEvent(new Event('storage'));
  }

  const message = `Pembersihan berhasil: ${deduplicatedStudents} data ganda dieliminasi, ${purgedDummies} data dummy dihapus. Tersisa ${finalCleanStudents.length} siswa resmi Kelas 8.`;
  console.log(`[Deduplicate & Purge] ${message}`);

  return {
    success: true,
    purgedDummies,
    deduplicatedStudents,
    deduplicatedViolations,
    deduplicatedServices,
    remainingStudents: finalCleanStudents.length,
    message
  };
}

/**
 * Checks whether a display name or record flag represents dummy/placeholder data
 * (e.g. isDummy === true, "Siswa 1", "Siswa 2", or legacy mock template students).
 */
export function isDummyNameOrFlag(item: any, fallbackName?: string): boolean {
  if (!item || typeof item !== 'object') return false;
  if (item.isDummy === true || item.__isExplicitPurgeableDummy === true) return true;
  const rawId = String(item.id || '').trim();
  const isUserTimestamped = rawId.startsWith('s-') || rawId.startsWith('v-') || rawId.startsWith('srv-');
  const rawName = String(fallbackName ?? item.studentName ?? item.name ?? '').trim();
  if (!rawName) return false;
  const lower = rawName.toLowerCase();
  if (!isUserTimestamped && /^siswa\s*\d+$/i.test(lower)) return true;
  if (
    !isUserTimestamped &&
    (lower.includes('uji coba') ||
      lower === 'test student' ||
      lower.includes('contoh siswa') ||
      lower.includes('sample student'))
  ) {
    return true;
  }
  return false;
}

export function isRealNonDummyViolation(v: ViolationRecord | null | undefined): boolean {
  if (!v) return false;
  if (isDummyRecord(v, 'bk_violations')) return false;
  if (isDummyNameOrFlag(v, v.studentName)) return false;
  if (
    isLegacyMockTemplateStudent({
      id: v.studentId,
      name: v.studentName,
      class: v.studentClass,
    })
  ) {
    return false;
  }
  return true;
}

export function isRealNonDummyService(s: CounselingService | null | undefined): boolean {
  if (!s) return false;
  if (isDummyRecord(s, 'bk_services')) return false;
  if (isDummyNameOrFlag(s)) return false;
  if (Array.isArray(s.students) && s.students.length > 0) {
    const allDummy = s.students.every(
      (st) =>
        isDummyNameOrFlag(st, st?.name) ||
        isDummyStudent(st)
    );
    if (allDummy) return false;
  }
  return true;
}

