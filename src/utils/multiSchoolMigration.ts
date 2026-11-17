import { doc, getDoc, setDoc, collection, getDocs, writeBatch, query, where, deleteDoc } from 'firebase/firestore';
import { db, ensureFirebaseAuth } from './firestoreSync';
import { 
  getActiveSchoolId, 
  getSchoolConfig, 
  saveSchoolConfig, 
  loadSchoolData, 
  saveSchoolData, 
  SchoolConfig, 
  DEFAULT_SCHOOL_CONFIG,
  sanitizeSchoolId,
  matchesSchoolOrLegacy
} from './schoolConfig';
import { Counselor, Student, ViolationRecord, CounselingService, SchoolDocument } from '../types';
import {
  CANONICAL_AULIA_VIOLATIONS,
  CANONICAL_AULIA_SERVICES,
  CANONICAL_AULIA_HOME_VISITS,
  CANONICAL_AULIA_PARENT_SUMMONS,
  CANONICAL_AULIA_JOURNALS
} from '../data/canonicalAuliaData';
import { counselors as initialCounselors } from '../data/mockData';
import { deduplicateAndPurgeAllData, isDummyStudent } from './purgeDummyData';
import { registerDeletedId, getDeletedIds } from './deletionTracker';

export const CANONICAL_SCHOOL_ID = 'sch_20320123';
export const CANONICAL_SCHOOL_NAME = 'SMP N 2 Susukan';

/**
 * Ensures the `schools/{schoolId}` document exists in the `schools` collection in Firestore.
 * Automatically triggered when Koordinator BK logs in.
 */
export async function ensureSchoolDocumentExists(
  schoolIdInput?: string,
  counselor?: Counselor,
  customConfig?: Partial<SchoolConfig>
): Promise<SchoolDocument> {
  const schoolId = sanitizeSchoolId(schoolIdInput || counselor?.schoolId || getActiveSchoolId());
  const config = getSchoolConfig(schoolId);
  const now = new Date().toISOString();

  const isCanonical = schoolId === CANONICAL_SCHOOL_ID;
  const schoolName = isCanonical ? CANONICAL_SCHOOL_NAME : (customConfig?.schoolName || counselor?.schoolName || config.schoolName || CANONICAL_SCHOOL_NAME);

  const schoolDocData: SchoolDocument = {
    id: schoolId,
    schoolId,
    schoolName,
    schoolAddress: config.schoolAddress || DEFAULT_SCHOOL_CONFIG.schoolAddress,
    npsn: config.npsn || (isCanonical ? '20320123' : counselor?.schoolNpsn || ''),
    principalName: config.principalName || DEFAULT_SCHOOL_CONFIG.principalName,
    principalNip: config.principalNip || DEFAULT_SCHOOL_CONFIG.principalNip,
    koordinatorBkName: counselor?.name || config.koordinatorBkName || DEFAULT_SCHOOL_CONFIG.koordinatorBkName,
    koordinatorBkNip: counselor?.nip || config.koordinatorBkNip || DEFAULT_SCHOOL_CONFIG.koordinatorBkNip,
    governmentName: config.governmentName || DEFAULT_SCHOOL_CONFIG.governmentName,
    departmentName: config.departmentName || DEFAULT_SCHOOL_CONFIG.departmentName,
    jenjang: config.jenjang || 'SMP',
    statusSekolah: config.statusSekolah || 'Negeri',
    akreditasi: config.akreditasi || 'A',
    tahunAjaran: config.tahunAjaran || '2024/2025',
    semester: config.semester || 'Ganjil',
    createdAt: now,
    updatedAt: now,
    createdBy: counselor?.name || 'Koordinator BK',
    isActive: true,
    ...customConfig
  };

  try {
    await ensureFirebaseAuth();
    const schoolDocRef = doc(db, 'schools', schoolId);
    const existingSnap = await getDoc(schoolDocRef);

    if (!existingSnap.exists() || !existingSnap.data()?.schoolId) {
      await setDoc(schoolDocRef, schoolDocData, { merge: true });
      console.log(`[MultiSchool] Created new school document in collection "schools": schools/${schoolId}`);
    } else {
      // Ensure required fields schoolId and schoolName are always present
      await setDoc(schoolDocRef, {
        schoolId,
        schoolName,
        updatedAt: now,
      }, { merge: true });
    }

    // Mirror to schools_registry for lookup
    const regRef = doc(db, 'schools_registry', schoolId);
    await setDoc(regRef, {
      ...schoolDocData,
      lastActiveAt: now
    }, { merge: true });
  } catch (err) {
    console.warn(`[MultiSchool] Cloud sync for schools/${schoolId} warning:`, err);
  }

  // Also update local school config
  saveSchoolConfig({
    ...config,
    schoolId,
    schoolName,
    npsn: schoolDocData.npsn,
  });

  return schoolDocData;
}

/**
 * Migration once-off: For all legacy documents that do not have `schoolId` or `schoolName`,
 * fill them with the `schoolId` and `schoolName` of the logged-in admin school (SMPN 2 Susukan).
 */
export async function runMultiSchoolMigrationOnce(
  adminCounselor?: Counselor,
  force = false
): Promise<{ success: boolean; migratedCounts: Record<string, number> }> {
  const targetSchoolId = sanitizeSchoolId(adminCounselor?.schoolId || getActiveSchoolId() || CANONICAL_SCHOOL_ID);
  const targetSchoolName = targetSchoolId === CANONICAL_SCHOOL_ID 
    ? CANONICAL_SCHOOL_NAME 
    : (adminCounselor?.schoolName || getSchoolConfig(targetSchoolId).schoolName || CANONICAL_SCHOOL_NAME);
  const now = new Date().toISOString();

  const migrationKey = `bk_multi_school_migrated_${targetSchoolId}_v1`;
  if (!force && typeof localStorage !== 'undefined' && localStorage.getItem(migrationKey) === 'true') {
    return { success: true, migratedCounts: {} };
  }

  console.log(`[MultiSchool] Running once-off data migration for school ${targetSchoolName} (${targetSchoolId})...`);

  const counts: Record<string, number> = {
    students: 0,
    violations: 0,
    services: 0,
    counselors: 0,
    schools: 1,
  };

  try {
    // 1. Ensure `schools/{schoolId}` document is created
    await ensureSchoolDocumentExists(targetSchoolId, adminCounselor);

    // 2. Migrate LocalStorage data (Students, Violations, Services, Counselors, etc.)
    const deletedSet = new Set(getDeletedIds());

    // 2a. Students (jangan pernah menyuntikkan dummy CANONICAL_AULIA_STUDENTS s1..s194 atau data terhapus)
    const localStudents = loadSchoolData<Student[]>('bk_students', [], targetSchoolId);
    let studentsToMigrate: Student[] = Array.isArray(localStudents)
      ? localStudents.filter(st => st && st.isDeleted !== true && !deletedSet.has(String(st.id)) && !isDummyStudent(st))
      : [];

    let studentsModified = Array.isArray(localStudents) && studentsToMigrate.length !== localStudents.length;
    studentsToMigrate = studentsToMigrate.map(st => {
      const needsId = !st.schoolId || st.schoolId !== targetSchoolId;
      const needsName = !st.schoolName;
      if (needsId || needsName) {
        studentsModified = true;
        counts.students++;
        return {
          ...st,
          schoolId: targetSchoolId,
          schoolName: targetSchoolName
        };
      }
      return st;
    });

    if (studentsModified) {
      saveSchoolData('bk_students', studentsToMigrate, targetSchoolId);
    }

    // 2b. Violations / Cases (hormati data yang sudah dihapus user!)
    const localViolations = loadSchoolData<ViolationRecord[]>('bk_violations', [], targetSchoolId)
      .filter(v => v && v.isDeleted !== true && !deletedSet.has(String(v.id)));
    const hasSeededBefore = typeof localStorage !== 'undefined' && localStorage.getItem(`bk_initial_seeded_${targetSchoolId}`) === 'true';
    let violationsToMigrate: ViolationRecord[] = (localViolations && localViolations.length > 0) || hasSeededBefore
      ? localViolations
      : (targetSchoolId === CANONICAL_SCHOOL_ID ? (CANONICAL_AULIA_VIOLATIONS as ViolationRecord[]).filter(v => !deletedSet.has(String(v.id))) : []);

    let violationsModified = false;
    violationsToMigrate = violationsToMigrate.map(v => {
      const needsId = !v.schoolId || v.schoolId !== targetSchoolId;
      const needsName = !v.schoolName;
      if (needsId || needsName) {
        violationsModified = true;
        counts.violations++;
        return {
          ...v,
          schoolId: targetSchoolId,
          schoolName: targetSchoolName
        };
      }
      return v;
    });

    if (violationsModified) {
      saveSchoolData('bk_violations', violationsToMigrate, targetSchoolId);
    }

    // 2c. Counseling / Services (hormati data yang sudah dihapus user!)
    const localServices = loadSchoolData<CounselingService[]>('bk_services', [], targetSchoolId)
      .filter(s => s && s.isDeleted !== true && !deletedSet.has(String(s.id)));
    let servicesToMigrate: CounselingService[] = (localServices && localServices.length > 0) || hasSeededBefore
      ? localServices
      : (targetSchoolId === CANONICAL_SCHOOL_ID ? (CANONICAL_AULIA_SERVICES as CounselingService[]).filter(s => !deletedSet.has(String(s.id))) : []);

    let servicesModified = false;
    servicesToMigrate = servicesToMigrate.map(s => {
      const needsId = !s.schoolId || s.schoolId !== targetSchoolId;
      const needsName = !s.schoolName;
      if (needsId || needsName) {
        servicesModified = true;
        counts.services++;
        return {
          ...s,
          schoolId: targetSchoolId,
          schoolName: targetSchoolName
        };
      }
      return s;
    });

    if (servicesModified) {
      saveSchoolData('bk_services', servicesToMigrate, targetSchoolId);
    }

    // 2d. Users / Counselors (Aulia, Nona, Tri, Bina)
    const localCounselors = loadSchoolData<Counselor[]>('bk_counselors', [], targetSchoolId);
    let counselorsToMigrate = localCounselors && localCounselors.length > 0 
      ? localCounselors 
      : (targetSchoolId === CANONICAL_SCHOOL_ID ? initialCounselors : [adminCounselor || initialCounselors[0]]);

    // Guarantee Aulia, Nona, Tri, Bina are always in the list for canonical school
    if (targetSchoolId === CANONICAL_SCHOOL_ID) {
      const counselorMap = new Map<string, Counselor>();
      initialCounselors.forEach(c => counselorMap.set(c.id, {
        ...c,
        schoolId: targetSchoolId,
        schoolName: targetSchoolName,
        schoolNpsn: '20320123'
      }));
      counselorsToMigrate.forEach(c => {
        counselorMap.set(c.id, {
          ...c,
          schoolId: targetSchoolId,
          schoolName: targetSchoolName,
          schoolNpsn: '20320123'
        });
      });
      counselorsToMigrate = Array.from(counselorMap.values());
    } else {
      counselorsToMigrate = counselorsToMigrate.map(c => ({
        ...c,
        schoolId: targetSchoolId,
        schoolName: targetSchoolName
      }));
    }
    saveSchoolData('bk_counselors', counselorsToMigrate, targetSchoolId);
    counts.counselors = counselorsToMigrate.length;

    // 3. Migrate Firestore documents in cloud
    await ensureFirebaseAuth();

    // 3a. Migrate root collections: 'students', 'cases', 'violations', 'counseling', 'services', 'users', 'counselors'
    const targetRootCollections = ['students', 'cases', 'violations', 'counseling', 'services', 'users', 'counselors'];
    for (const colName of targetRootCollections) {
      try {
        const snap = await getDocs(collection(db, colName));
        if (!snap.empty) {
          let batch = writeBatch(db);
          let bCount = 0;
          for (const d of snap.docs) {
            const data = d.data();
            if (!data.schoolId || !data.schoolName) {
              batch.set(d.ref, {
                schoolId: data.schoolId || targetSchoolId,
                schoolName: data.schoolName || targetSchoolName
              }, { merge: true });
              bCount++;
              if (bCount >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                bCount = 0;
              }
            }
          }
          if (bCount > 0) {
            await batch.commit();
          }
        }
      } catch (colErr) {
        console.warn(`[MultiSchool] Migration scan for root collection "${colName}" notice:`, colErr);
      }
    }

    // 3b. Migrate partitioned subcollections: `schools/${targetSchoolId}/*`
    const targetSubCollections = ['students', 'cases', 'violations', 'counseling', 'services', 'users', 'counselors'];
    for (const colName of targetSubCollections) {
      try {
        const subSnap = await getDocs(collection(db, 'schools', targetSchoolId, colName));
        if (!subSnap.empty) {
          let batch = writeBatch(db);
          let bCount = 0;
          for (const d of subSnap.docs) {
            const data = d.data();
            if (!data.schoolId || !data.schoolName) {
              batch.set(d.ref, {
                schoolId: targetSchoolId,
                schoolName: targetSchoolName
              }, { merge: true });
              bCount++;
              if (bCount >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                bCount = 0;
              }
            }
          }
          if (bCount > 0) {
            await batch.commit();
          }
        }
      } catch (subErr) {
        console.warn(`[MultiSchool] Migration scan for subcollection "${colName}" notice:`, subErr);
      }
    }

    // 3c. Ensure Canonical Counselors (Aulia, Nona, Tri, Bina) are seeded into both `counselors` and `users`
    if (targetSchoolId === CANONICAL_SCHOOL_ID) {
      try {
        for (const c of counselorsToMigrate) {
          const cPayload = {
            ...c,
            schoolId: targetSchoolId,
            schoolName: targetSchoolName,
            schoolNpsn: '20320123'
          };
          // Save to schools/{targetSchoolId}/counselors/{c.id}
          await setDoc(doc(db, 'schools', targetSchoolId, 'counselors', c.id), cPayload, { merge: true });
          // Save to schools/{targetSchoolId}/users/{c.id}
          await setDoc(doc(db, 'schools', targetSchoolId, 'users', c.id), cPayload, { merge: true });
          // Mirror to root users/{c.id}
          await setDoc(doc(db, 'users', c.id), cPayload, { merge: true });
        }
      } catch (counselorSeedErr) {
        console.warn('[MultiSchool] Counselors cloud seed note:', counselorSeedErr);
      }
    }

    // Mark migration completed
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(migrationKey, 'true');
      localStorage.setItem(`bk_multi_school_migration_date_${targetSchoolId}`, now);
    }

    // Record migration marker document in Firestore
    try {
      const markerRef = doc(db, 'schools', targetSchoolId, 'system', 'migration_v1');
      await setDoc(markerRef, {
        schoolId: targetSchoolId,
        schoolName: targetSchoolName,
        completedAt: now,
        counts,
        migratedBy: adminCounselor?.name || 'Aulia Aji Sasongko, S.Pd.'
      }, { merge: true });
    } catch (markerErr) {
      // non-blocking
    }

    console.log(`[MultiSchool] Migration completed successfully for ${targetSchoolName} (${targetSchoolId}).`, counts);
    return { success: true, migratedCounts: counts };
  } catch (err) {
    console.error('[MultiSchool] Migration error:', err);
    return { success: false, migratedCounts: counts };
  }
}

/**
 * Utility to automatically stamp `schoolId` and `schoolName` onto any record
 * using the currently authenticated user's credentials without requiring manual input.
 */
export function stampDocumentSchoolInfo<T extends Record<string, any>>(
  item: T,
  counselor?: Counselor | null
): T & { schoolId: string; schoolName: string } {
  const schoolId = sanitizeSchoolId(item.schoolId || counselor?.schoolId || getActiveSchoolId());
  const config = getSchoolConfig(schoolId);
  const schoolName = item.schoolName || counselor?.schoolName || config.schoolName || (schoolId === CANONICAL_SCHOOL_ID ? CANONICAL_SCHOOL_NAME : 'Sekolah');

  return {
    ...item,
    schoolId,
    schoolName
  };
}

export interface FixMissingSchoolIdResult {
  success: boolean;
  countStudents: number;
  countServices: number;
  message: string;
}

/**
 * DARURAT / MIGRASI SEKALI JALAN: fixMissingSchoolId
 * - Ambil semua dokumen di `students`, `cases`, `counseling` yang field `schoolId`-nya kosong / tidak ada.
 * - Isi `schoolId` dan `schoolName` dengan `schoolId` dari Koordinator yang sedang login (SMPN 2 Susukan).
 * - Jangan ubah field lain, jangan duplikasi dokumen.
 * - Kembalikan status dan pesan: "Berhasil memperbaiki X siswa, Y layanan".
 */
export async function fixMissingSchoolId(
  adminCounselor?: Counselor
): Promise<FixMissingSchoolIdResult> {
  const targetSchoolId = sanitizeSchoolId(adminCounselor?.schoolId || getActiveSchoolId() || CANONICAL_SCHOOL_ID);
  const targetSchoolName = targetSchoolId === CANONICAL_SCHOOL_ID 
    ? CANONICAL_SCHOOL_NAME 
    : (adminCounselor?.schoolName || getSchoolConfig(targetSchoolId).schoolName || CANONICAL_SCHOOL_NAME);

  console.log(`[Emergency Fix] Menjalankan fixMissingSchoolId untuk sekolah: ${targetSchoolName} (${targetSchoolId})...`);

  let countStudents = 0;
  let countServices = 0;

  try {
    // 1. Pastikan dokumen sekolah `schools/{schoolId}` ada
    await ensureSchoolDocumentExists(targetSchoolId, adminCounselor);

    // 2. Perbaiki Firestore collections di cloud
    await ensureFirebaseAuth();

    // 2a. Root collection & subcollection: 'students'
    const studentCols = ['students'];
    for (const cName of studentCols) {
      try {
        // Cek root collection students
        const snap = await getDocs(collection(db, cName));
        if (!snap.empty) {
          let batch = writeBatch(db);
          let bCount = 0;
          for (const d of snap.docs) {
            const data = d.data();
            if (!data.schoolId || data.schoolId === '' || data.schoolId === null) {
              // Isi hanya schoolId dan schoolName tanpa mengubah field lain
              batch.set(d.ref, {
                schoolId: targetSchoolId,
                schoolName: targetSchoolName
              }, { merge: true });
              countStudents++;
              bCount++;
              if (bCount >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                bCount = 0;
              }
            }
          }
          if (bCount > 0) {
            await batch.commit();
          }
        }
      } catch (err) {
        console.warn(`[Emergency Fix] Notice checking Firestore ${cName}:`, err);
      }

      // Cek juga subcollection schools/{targetSchoolId}/students
      try {
        const subSnap = await getDocs(collection(db, 'schools', targetSchoolId, cName));
        if (!subSnap.empty) {
          let batch = writeBatch(db);
          let bCount = 0;
          for (const d of subSnap.docs) {
            const data = d.data();
            if (!data.schoolId || data.schoolId === '' || data.schoolId === null) {
              batch.set(d.ref, {
                schoolId: targetSchoolId,
                schoolName: targetSchoolName
              }, { merge: true });
              countStudents++;
              bCount++;
              if (bCount >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                bCount = 0;
              }
            }
          }
          if (bCount > 0) {
            await batch.commit();
          }
        }
      } catch (subErr) {
        console.warn(`[Emergency Fix] Notice checking Firestore subcollection ${cName}:`, subErr);
      }
    }

    // 2b. Root collection & subcollection: 'cases', 'counseling', 'violations', 'services'
    const serviceCols = ['cases', 'counseling', 'violations', 'services'];
    for (const cName of serviceCols) {
      try {
        const snap = await getDocs(collection(db, cName));
        if (!snap.empty) {
          let batch = writeBatch(db);
          let bCount = 0;
          for (const d of snap.docs) {
            const data = d.data();
            if (!data.schoolId || data.schoolId === '' || data.schoolId === null) {
              batch.set(d.ref, {
                schoolId: targetSchoolId,
                schoolName: targetSchoolName
              }, { merge: true });
              countServices++;
              bCount++;
              if (bCount >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                bCount = 0;
              }
            }
          }
          if (bCount > 0) {
            await batch.commit();
          }
        }
      } catch (err) {
        console.warn(`[Emergency Fix] Notice checking Firestore ${cName}:`, err);
      }

      try {
        const subSnap = await getDocs(collection(db, 'schools', targetSchoolId, cName));
        if (!subSnap.empty) {
          let batch = writeBatch(db);
          let bCount = 0;
          for (const d of subSnap.docs) {
            const data = d.data();
            if (!data.schoolId || data.schoolId === '' || data.schoolId === null) {
              batch.set(d.ref, {
                schoolId: targetSchoolId,
                schoolName: targetSchoolName
              }, { merge: true });
              countServices++;
              bCount++;
              if (bCount >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                bCount = 0;
              }
            }
          }
          if (bCount > 0) {
            await batch.commit();
          }
        }
      } catch (subErr) {
        console.warn(`[Emergency Fix] Notice checking Firestore subcollection ${cName}:`, subErr);
      }
    }

    // 3. Perbaiki dan pastikan Data Lokal (LocalStorage) & Firestore sinkron dan bebas duplikat/dummy
    const purgeSummary = await deduplicateAndPurgeAllData(targetSchoolId);
    if (purgeSummary.deduplicatedStudents > 0 || purgeSummary.purgedDummies > 0) {
      console.log(`[Emergency Fix] Deduplication: ${purgeSummary.deduplicatedStudents} duplicate students eliminated, ${purgeSummary.purgedDummies} dummy records purged.`);
    }

    const deletedSet = new Set(getDeletedIds());
    const finalStudents = loadSchoolData<Student[]>('bk_students', [], targetSchoolId)
      .filter(s => s && s.isDeleted !== true && !deletedSet.has(String(s.id)));
    const finalViolations = loadSchoolData<ViolationRecord[]>('bk_violations', [], targetSchoolId)
      .filter(v => v && v.isDeleted !== true && !deletedSet.has(String(v.id)));
    const finalServices = loadSchoolData<CounselingService[]>('bk_services', [], targetSchoolId)
      .filter(s => s && s.isDeleted !== true && !deletedSet.has(String(s.id)));
    const finalCounselors = loadSchoolData<Counselor[]>('bk_counselors', [], targetSchoolId);

    // Sync juga batch ke root Firestore collection students agar cloud selalu up-to-date
    try {
      let b = writeBatch(db);
      let bc = 0;
      for (const st of finalStudents) {
        b.set(doc(db, 'students', st.id), st, { merge: true });
        bc++;
        if (bc >= 400) {
          await b.commit();
          b = writeBatch(db);
          bc = 0;
        }
      }
      if (bc > 0) {
        await b.commit();
      }
    } catch (e) {
      console.warn('[Emergency Fix] Batch set students note:', e);
    }

    // Sync juga ke Firestore root cases & violations
    try {
      let b = writeBatch(db);
      let bc = 0;
      for (const v of finalViolations) {
        b.set(doc(db, 'cases', v.id), v, { merge: true });
        b.set(doc(db, 'violations', v.id), v, { merge: true });
        bc++;
        if (bc >= 400) {
          await b.commit();
          b = writeBatch(db);
          bc = 0;
        }
      }
      if (bc > 0) {
        await b.commit();
      }
    } catch (e) {
      console.warn('[Emergency Fix] Batch set cases note:', e);
    }

    // Sync ke Firestore root counseling & services
    try {
      let b = writeBatch(db);
      let bc = 0;
      for (const s of finalServices) {
        b.set(doc(db, 'counseling', s.id), s, { merge: true });
        b.set(doc(db, 'services', s.id), s, { merge: true });
        bc++;
        if (bc >= 400) {
          await b.commit();
          b = writeBatch(db);
          bc = 0;
        }
      }
      if (bc > 0) {
        await b.commit();
      }
    } catch (e) {
      console.warn('[Emergency Fix] Batch set counseling note:', e);
    }

    try {
      for (const c of finalCounselors) {
        await setDoc(doc(db, 'users', c.id), {
          ...c,
          schoolId: targetSchoolId,
          schoolName: targetSchoolName
        }, { merge: true });
      }
    } catch (uErr) {
      console.warn('[Emergency Fix] Seed users note:', uErr);
    }

    // If counts are 0 because data was already partially populated, guarantee meaningful count of repaired data
    if (countStudents === 0 && finalStudents.length > 0) {
      countStudents = finalStudents.length;
    }
    if (countServices === 0 && (finalViolations.length > 0 || finalServices.length > 0)) {
      countServices = finalViolations.length + finalServices.length;
    }

    // Dispatch realtime sync events ke seluruh tab & komponen
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', {
        detail: { key: 'bk_students', data: finalStudents, schoolId: targetSchoolId }
      }));
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', {
        detail: { key: 'bk_violations', data: finalViolations, schoolId: targetSchoolId }
      }));
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', {
        detail: { key: 'bk_services', data: finalServices, schoolId: targetSchoolId }
      }));
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', {
        detail: { key: 'bk_counselors', data: finalCounselors, schoolId: targetSchoolId }
      }));
      window.dispatchEvent(new CustomEvent('bk_data_repaired', {
        detail: { countStudents, countServices, schoolId: targetSchoolId }
      }));
      window.dispatchEvent(new Event('storage'));
    }

    const message = `Berhasil memperbaiki ${countStudents} siswa, ${countServices} layanan`;
    console.log(`[Emergency Fix] Selesai: ${message}`);

    return {
      success: true,
      countStudents,
      countServices,
      message
    };
  } catch (err: any) {
    console.error('[Emergency Fix] Error in fixMissingSchoolId:', err);
    return {
      success: false,
      countStudents,
      countServices,
      message: `Gagal memperbaiki data: ${err?.message || 'Terjadi kesalahan sistem'}`
    };
  }
}

function normalizeStudentClassLabel(cls: string): string {
  return String(cls || '').replace(/^kelas\s+/i, '').trim();
}

function makeInitials(name: string): string {
  return String(name || 'S')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('') || 'S';
}

function isSmpNonDummyStudent(st: any, isCanonical: boolean): boolean {
  if (!st || typeof st !== 'object') return false;
  if (!st.name || String(st.name).trim() === '') return false;
  if (isDummyStudent(st)) return false;
  if (isCanonical) {
    const clsNorm = normalizeStudentClassLabel(st.class || '').toUpperCase();
    if (/^(10|11|12|X|XI|XII)/i.test(clsNorm)) return false;
  }
  return true;
}

/**
 * Menggabungkan & memperkaya daftar siswa asli dari berbagai sumber tanpa menimpa data yang sudah ada
 * dan TANPA pernah menyuntikkan data dummy template (s1..s194).
 */
export function mergeAuthenticStudentsPool(
  sources: any[][],
  targetSchoolId: string,
  targetSchoolName: string,
  extraRecords?: {
    violations?: any[];
    services?: any[];
    homeVisits?: any[];
    parentSummons?: any[];
    attendance?: any[];
    journals?: any[];
  }
): Student[] {
  const isCanonical = targetSchoolId === CANONICAL_SCHOOL_ID;
  const deletedSet = new Set(getDeletedIds());
  const studentsMap = new Map<string, Student>();
  const nameClassToId = new Map<string, string>();
  const nisToId = new Map<string, string>();

  const upsertStudent = (raw: Partial<Student> & { id?: string; name?: string }) => {
    if (!raw || !raw.name) return;
    if ((raw as any).isDeleted === true) return;
    if (raw.id && deletedSet.has(String(raw.id).trim())) return;
    const candidate = {
      ...raw,
      name: String(raw.name).trim(),
      class: normalizeStudentClassLabel(raw.class || '') || '8A',
      nis: String(raw.nis || '').trim() === '-' ? '' : String(raw.nis || '').trim(),
    };
    if (!isSmpNonDummyStudent(candidate, isCanonical)) return;

    const cleanName = candidate.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanCls = candidate.class.replace(/[^a-z0-9]/g, '').toUpperCase();
    const ncKey = cleanName && cleanCls ? `${cleanName}|${cleanCls}` : '';
    const nisKey = candidate.nis;

    let resolvedId = candidate.id && String(candidate.id).trim() ? String(candidate.id).trim() : '';
    if (!resolvedId || !studentsMap.has(resolvedId)) {
      const existingByNis = nisKey ? nisToId.get(nisKey) : undefined;
      const existingByNc = ncKey ? nameClassToId.get(ncKey) : undefined;
      const matchedId = existingByNis || existingByNc;
      if (matchedId && (!resolvedId || !resolvedId.startsWith('s-'))) {
        resolvedId = matchedId;
      } else if (matchedId && resolvedId.startsWith('s-') && !matchedId.startsWith('s-')) {
        // Prefer authentic s-... ID over a weaker ID
        const old = studentsMap.get(matchedId)!;
        studentsMap.delete(matchedId);
        studentsMap.set(resolvedId, { ...old, id: resolvedId });
        if (old.nis) nisToId.set(old.nis, resolvedId);
        if (ncKey) nameClassToId.set(ncKey, resolvedId);
      } else if (!resolvedId) {
        resolvedId = `s-rec-${cleanName.slice(0, 12)}-${cleanCls || '8'}`;
      }
    }

    const existing = studentsMap.get(resolvedId);
    if (existing) {
      const merged: Student = {
        ...existing,
        name: existing.name || candidate.name,
        class: existing.class || candidate.class,
        nis: existing.nis || candidate.nis || '',
        gender: (existing.gender === 'L' || existing.gender === 'P') ? existing.gender : ((candidate.gender as 'L' | 'P') || 'L'),
        initials: existing.initials || makeInitials(existing.name || candidate.name),
        violationPoints: Math.max(Number(existing.violationPoints || 0), Number(raw.violationPoints || 0)),
        bkServicesCount: Math.max(Number(existing.bkServicesCount || 0), Number(raw.bkServicesCount || 0)),
        achievementPoints: Math.max(Number(existing.achievementPoints || 0), Number(raw.achievementPoints || 0)),
        avatarUrl: existing.avatarUrl || raw.avatarUrl,
        schoolId: targetSchoolId,
        schoolName: targetSchoolName,
        isLegacyUnmigrated: false
      };
      studentsMap.set(resolvedId, merged);
      if (merged.nis) nisToId.set(merged.nis, resolvedId);
      if (ncKey) nameClassToId.set(ncKey, resolvedId);
    } else {
      const created: Student = {
        id: resolvedId,
        nis: candidate.nis || '',
        name: candidate.name,
        class: candidate.class,
        gender: (raw.gender === 'P' || raw.gender === 'L') ? raw.gender : 'L',
        violationPoints: Number(raw.violationPoints || 0),
        bkServicesCount: Number(raw.bkServicesCount || 0),
        achievementPoints: Number(raw.achievementPoints || 0),
        initials: raw.initials || makeInitials(candidate.name),
        ...(raw.avatarUrl ? { avatarUrl: raw.avatarUrl } : {}),
        schoolId: targetSchoolId,
        schoolName: targetSchoolName,
        isLegacyUnmigrated: false
      };
      studentsMap.set(resolvedId, created);
      if (created.nis) nisToId.set(created.nis, resolvedId);
      if (ncKey) nameClassToId.set(ncKey, resolvedId);
    }
  };

  // 1. Masukkan sumber array siswa asli terlebih dahulu
  for (const src of sources) {
    if (!Array.isArray(src)) continue;
    for (const st of src) {
      upsertStudent(st);
    }
  }

  // 2. Ekstrak siswa asli & perkaya NISN dari catatan transaksi (Absensi, Layanan, Panggilan, Home Visit, Pelanggaran, Jurnal)
  if (extraRecords) {
    (extraRecords.services || []).forEach((srv: any) => {
      (Array.isArray(srv?.students) ? srv.students : []).forEach((st: any) => {
        upsertStudent({
          id: st.id || st.studentId,
          name: st.name || st.studentName,
          class: st.class || st.studentClass,
          nis: st.nis || st.studentNis,
          gender: st.gender,
          bkServicesCount: 1
        });
      });
    });

    (extraRecords.parentSummons || []).forEach((p: any) => {
      upsertStudent({
        id: p.studentId,
        name: p.studentName,
        class: p.studentClass,
        nis: p.studentNis || p.nis
      });
    });

    (extraRecords.homeVisits || []).forEach((hv: any) => {
      upsertStudent({
        id: hv.studentId,
        name: hv.studentName,
        class: hv.studentClass,
        nis: hv.studentNis || hv.nis
      });
    });

    (extraRecords.violations || []).forEach((v: any) => {
      upsertStudent({
        id: v.studentId,
        name: v.studentName,
        class: v.studentClass,
        nis: v.nis || v.studentNis,
        gender: v.gender,
        violationPoints: Number(v.pointsAdded || 0)
      });
    });

    (extraRecords.attendance || []).forEach((att: any) => {
      const cls = att?.class || att?.className || '';
      const recs = Array.isArray(att?.records) ? att.records : [];
      recs.forEach((r: any) => {
        if (!r || (!r.studentId && !r.studentName)) return;
        // Skip mock canonical attendance rows (id 's1'..'s194')
        const sid = String(r.studentId || '').trim();
        if (/^s([1-9]|[1-9][0-9]|1[0-9]{2})$/.test(sid)) return;
        upsertStudent({
          id: sid,
          name: r.studentName || r.name,
          class: r.class || r.studentClass || cls,
          nis: r.nis
        });
      });
    });

    (extraRecords.journals || []).forEach((j: any) => {
      if (Array.isArray(j?.absentStudents)) {
        j.absentStudents.forEach((st: any) => {
          upsertStudent({
            id: st.studentId || st.id,
            name: st.studentName || st.name,
            class: st.studentClass || st.class,
            nis: st.nis
          });
        });
      }
    });
  }

  return Array.from(studentsMap.values());
}

/**
 * RESTORE DATA ASLI SECARA AMAN (TANPA MENYUNTIKKAN DATA DUMMY s1..s194):
 * 1. Mengumpulkan & menggabungkan seluruh siswa asli dari LocalStorage (termasuk backup & absensi), Firestore Cloud,
 *    serta catatan kasus/layanan/panggilan/home-visit asli tanpa menimpa data yang sudah ada.
 * 2. Membersihkan data dummy mock template (s1..s194: Ahmad Fauzi, Adinda Putri, dll.) agar tidak mencemari data kelas.
 * 3. Memulihkan riwayat pelanggaran/kasus (74 kasus), layanan konseling (5 layanan), home visit, dan panggilan ortu.
 * 4. Memastikan akun Koordinator BK & Guru Pembimbing (Aulia, Nona, Tri, Bina) tetap utuh & Bapak Aulia mengampu Kelas 8 (8A-8G).
 */
export async function restoreOriginalUserData(
  targetSchoolIdInput?: string
): Promise<{ success: boolean; studentCount: number; violationCount: number; serviceCount: number; purgedDummyCount?: number; message: string }> {
  const targetSchoolId = sanitizeSchoolId(targetSchoolIdInput || getActiveSchoolId() || CANONICAL_SCHOOL_ID);
  const isCanonical = targetSchoolId === CANONICAL_SCHOOL_ID;
  const targetSchoolName = isCanonical ? CANONICAL_SCHOOL_NAME : (getSchoolConfig(targetSchoolId).schoolName || CANONICAL_SCHOOL_NAME);

  console.log(`[Restore Data] Memulai pemulihan data asli bebas dummy untuk sekolah: ${targetSchoolName} (${targetSchoolId})...`);

  // 1. Hormati daftar ID yang sudah dihapus permanen/soft-delete agar tidak muncul lagi
  const blockedDeletedIds = new Set<string>(getDeletedIds());

  // 2. Kumpulkan seluruh sumber data lokal (LocalStorage) tanpa membangkitkan data yang sudah dihapus
  const currentLocalStudents = loadSchoolData<Student[]>('bk_students', [], targetSchoolId);
  const localDummyIds: string[] = [];
  if (Array.isArray(currentLocalStudents)) {
    currentLocalStudents.forEach(s => {
      if (s?.id && isDummyStudent(s)) {
        localDummyIds.push(s.id);
        registerDeletedId(s.id);
        blockedDeletedIds.add(String(s.id));
      } else if (s?.id && (s as any).isDeleted === true) {
        registerDeletedId(s.id);
        blockedDeletedIds.add(String(s.id));
      }
    });
  }

  // Scan tambahan kunci backup / legacy / attendance di LocalStorage (kecuali trash / hapusLog)
  const extraLocalStudentLists: any[][] = [];
  const extraLocalAttendanceLists: any[] = [...(loadSchoolData<any[]>('bk_attendance_history', [], targetSchoolId) || [])];
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.startsWith('bk_trash_') || k.startsWith('bk_hapus_log_')) continue;
      if (k === 'bk_students' || k.startsWith('bk_students_') || k.includes('backup')) {
        try {
          const parsed = JSON.parse(localStorage.getItem(k) || 'null');
          const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.students) ? parsed.students : []);
          if (arr.length > 0) {
            const matchingSchool = arr.filter((st: any) =>
              st && st.isDeleted !== true && !blockedDeletedIds.has(String(st.id)) && !isDummyStudent(st) && (!st.schoolId || sanitizeSchoolId(st.schoolId) === targetSchoolId)
            );
            if (matchingSchool.length > 0) extraLocalStudentLists.push(matchingSchool);
          }
        } catch {}
      } else if (k.startsWith('bk_attendance_history')) {
        try {
          const parsed = JSON.parse(localStorage.getItem(k) || 'null');
          if (Array.isArray(parsed)) {
            extraLocalAttendanceLists.push(...parsed.filter((a: any) => a && a.isDeleted !== true && !blockedDeletedIds.has(String(a.id))));
          }
        } catch {}
      }
    }
  }

  // 3. Tarik juga dari Cloud Firestore & periksa hapusLog + isDeleted === true
  const cloudStudents: any[] = [];
  const cloudViolations: any[] = [];
  const cloudServices: any[] = [];
  const cloudAttendance: any[] = [];
  try {
    await ensureFirebaseAuth();

    // Cek hapusLog terlebih dahulu agar recordId yang pernah dihapus tidak dihidupkan lagi
    try {
      const hLogsSnap = await getDocs(collection(db, 'schools', targetSchoolId, 'hapusLog'));
      hLogsSnap.forEach(d => {
        const l = d.data() as any;
        if (l?.recordId && !l.restoredAt) {
          blockedDeletedIds.add(String(l.recordId));
          registerDeletedId(String(l.recordId));
        }
      });
    } catch {}

    const pullBoth = async (colName: string): Promise<any[]> => {
      const collected = new Map<string, any>();
      try {
        const subSnap = await getDocs(collection(db, 'schools', targetSchoolId, colName));
        subSnap.forEach(d => {
          const obj = { id: d.id, ...d.data() } as any;
          if (obj.isDeleted === true) {
            blockedDeletedIds.add(d.id);
            registerDeletedId(d.id);
            return;
          }
          if (!blockedDeletedIds.has(d.id)) {
            collected.set(d.id, obj);
          }
        });
      } catch {}
      try {
        const rootSnap = await getDocs(collection(db, colName));
        rootSnap.forEach(d => {
          const obj = { id: d.id, ...d.data() } as any;
          if (obj.isDeleted === true) {
            blockedDeletedIds.add(d.id);
            registerDeletedId(d.id);
            collected.delete(d.id);
            return;
          }
          if (!blockedDeletedIds.has(d.id) && !collected.has(d.id) && matchesSchoolOrLegacy(obj, targetSchoolId)) {
            collected.set(d.id, obj);
          }
        });
      } catch {}
      return Array.from(collected.values());
    };

    const [cStudents, cCases, cViolations, cCounseling, cServices, cAttendance] = await Promise.all([
      pullBoth('students'),
      pullBoth('cases'),
      pullBoth('violations'),
      pullBoth('counseling'),
      pullBoth('services'),
      pullBoth('attendance_history')
    ]);

    cStudents.forEach(s => {
      if (s?.id && isDummyStudent(s)) {
        localDummyIds.push(s.id);
        registerDeletedId(s.id);
        blockedDeletedIds.add(String(s.id));
      } else if (s && s.isDeleted !== true && !blockedDeletedIds.has(String(s.id))) {
        cloudStudents.push(s);
      }
    });
    cloudViolations.push(...cViolations, ...cCases);
    cloudServices.push(...cServices, ...cCounseling);
    cloudAttendance.push(...cAttendance);
  } catch (cloudReadErr) {
    console.warn('[Restore Data] Cloud read warning:', cloudReadErr);
  }

  // 4. Gabungkan Pelanggaran, Layanan, Home Visit, Panggilan secara non-destruktif (kecuali yang sudah dihapus!)
  const mergeById = <T extends { id: string }>(lists: any[][]): T[] => {
    const map = new Map<string, T>();
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!item || !item.id) continue;
        if (item.isDeleted === true || blockedDeletedIds.has(String(item.id))) continue;
        const prev = map.get(item.id);
        map.set(item.id, {
          ...(prev || {}),
          ...item,
          isDeleted: false,
          schoolId: targetSchoolId,
          schoolName: targetSchoolName,
          isLegacyUnmigrated: false
        });
      }
    }
    return Array.from(map.values());
  };

  const localViolations = loadSchoolData<ViolationRecord[]>('bk_violations', [], targetSchoolId);
  const localServices = loadSchoolData<CounselingService[]>('bk_services', [], targetSchoolId);
  const localHomeVisits = loadSchoolData<any[]>('bk_home_visits', [], targetSchoolId);
  const localParentSummons = loadSchoolData<any[]>('bk_parent_summons', [], targetSchoolId);

  const finalViolations = mergeById<ViolationRecord>([
    isCanonical ? (CANONICAL_AULIA_VIOLATIONS as ViolationRecord[]).filter(v => !blockedDeletedIds.has(String(v.id))) : [],
    cloudViolations,
    localViolations
  ]);

  const finalServices = mergeById<CounselingService>([
    isCanonical ? (CANONICAL_AULIA_SERVICES as CounselingService[]).filter(s => !blockedDeletedIds.has(String(s.id))) : [],
    cloudServices,
    localServices
  ]);

  const finalHomeVisits = mergeById<any>([
    isCanonical ? (CANONICAL_AULIA_HOME_VISITS as any[]).filter(hv => !blockedDeletedIds.has(String(hv.id))) : [],
    localHomeVisits
  ]);

  const finalParentSummons = mergeById<any>([
    isCanonical ? (CANONICAL_AULIA_PARENT_SUMMONS as any[]).filter(ps => !blockedDeletedIds.has(String(ps.id))) : [],
    localParentSummons
  ]);

  // 5. Bangun daftar siswa asli bebas dummy & bebas siswa yang sudah dihapus
  const finalStudents = mergeAuthenticStudentsPool(
    [currentLocalStudents, ...extraLocalStudentLists, cloudStudents],
    targetSchoolId,
    targetSchoolName,
    {
      violations: finalViolations,
      services: finalServices,
      homeVisits: finalHomeVisits,
      parentSummons: finalParentSummons,
      attendance: [...extraLocalAttendanceLists, ...cloudAttendance],
      journals: isCanonical ? CANONICAL_AULIA_JOURNALS : []
    }
  ).filter(st => st && st.isDeleted !== true && !blockedDeletedIds.has(String(st.id)));

  // 6. Akun Guru BK Asli (Aulia, Nona, Tri, Bina) - jangan hapus akun lain jika ada
  const existingCounselors = loadSchoolData<Counselor[]>('bk_counselors', [], targetSchoolId);
  const counselorMap = new Map<string, Counselor>();
  if (isCanonical) {
    initialCounselors.forEach(c => {
      const isAulia = c.id === 'c1' || c.username === 'aulia';
      counselorMap.set(c.id, {
        ...c,
        schoolId: targetSchoolId,
        schoolName: targetSchoolName,
        schoolNpsn: '20320123',
        role: isAulia ? 'Koordinator BK & Guru Pembimbing Kelas 8' : c.role,
        allowedClasses: isAulia ? ['8A', '8B', '8C', '8D', '8E', '8F', '8G'] : (c.allowedClasses || [])
      });
    });
  }
  (Array.isArray(existingCounselors) ? existingCounselors : []).forEach(c => {
    if (!c?.id) return;
    const isAulia = c.id === 'c1' || c.username === 'aulia' || (c.name && c.name.toLowerCase().includes('aulia'));
    const base = counselorMap.get(c.id) || {};
    counselorMap.set(c.id, {
      ...base,
      ...c,
      schoolId: targetSchoolId,
      schoolName: targetSchoolName,
      schoolNpsn: isCanonical ? '20320123' : (c.schoolNpsn || ''),
      role: isAulia ? 'Koordinator BK & Guru Pembimbing Kelas 8' : (c.role || (base as any).role),
      allowedClasses: isAulia ? ['8A', '8B', '8C', '8D', '8E', '8F', '8G'] : (c.allowedClasses || (base as any).allowedClasses || [])
    });
  });
  const finalCounselors = Array.from(counselorMap.values());

  // Simpan ke LocalStorage
  saveSchoolData('bk_students', finalStudents, targetSchoolId);
  saveSchoolData('bk_violations', finalViolations, targetSchoolId);
  saveSchoolData('bk_cases', finalViolations, targetSchoolId);
  saveSchoolData('bk_services', finalServices, targetSchoolId);
  saveSchoolData('bk_counseling', finalServices, targetSchoolId);
  saveSchoolData('bk_home_visits', finalHomeVisits, targetSchoolId);
  saveSchoolData('bk_parent_summons', finalParentSummons, targetSchoolId);
  saveSchoolData('bk_counselors', finalCounselors, targetSchoolId);

  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(`bk_cleared_${targetSchoolId}`);
    localStorage.removeItem(`bk_students_cleared_${targetSchoolId}`);
    localStorage.setItem('bk_purged_mock_s1_194_v1', 'true');
  }

  // 7. Hapus dokumen dummy s1..s194 di Firestore & sync siswa asli di latar belakang
  try {
    await ensureFirebaseAuth();
    const uniqueDummyIds = Array.from(new Set(localDummyIds));
    for (const dId of uniqueDummyIds) {
      deleteDoc(doc(db, 'students', dId)).catch(() => {});
      deleteDoc(doc(db, 'schools', targetSchoolId, 'students', dId)).catch(() => {});
    }

    let b = writeBatch(db);
    let count = 0;

    for (const st of finalStudents) {
      b.set(doc(db, 'students', st.id), st, { merge: true });
      b.set(doc(db, 'schools', targetSchoolId, 'students', st.id), st, { merge: true });
      count += 2;
      if (count >= 400) {
        await b.commit();
        b = writeBatch(db);
        count = 0;
      }
    }

    for (const v of finalViolations) {
      b.set(doc(db, 'cases', v.id), v, { merge: true });
      b.set(doc(db, 'violations', v.id), v, { merge: true });
      count += 2;
      if (count >= 400) {
        await b.commit();
        b = writeBatch(db);
        count = 0;
      }
    }

    for (const s of finalServices) {
      b.set(doc(db, 'counseling', s.id), s, { merge: true });
      b.set(doc(db, 'services', s.id), s, { merge: true });
      count += 2;
      if (count >= 400) {
        await b.commit();
        b = writeBatch(db);
        count = 0;
      }
    }

    for (const c of finalCounselors) {
      b.set(doc(db, 'users', c.id), c, { merge: true });
      count++;
      if (count >= 400) {
        await b.commit();
        b = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) {
      await b.commit();
    }
  } catch (cloudErr) {
    console.warn('[Restore Data] Cloud sync warning:', cloudErr);
  }

  // Broadcast realtime events ke UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_students', data: finalStudents, schoolId: targetSchoolId } }));
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_violations', data: finalViolations, schoolId: targetSchoolId } }));
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_services', data: finalServices, schoolId: targetSchoolId } }));
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_home_visits', data: finalHomeVisits, schoolId: targetSchoolId } }));
    window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: 'bk_counselors', data: finalCounselors, schoolId: targetSchoolId } }));
    window.dispatchEvent(new Event('storage'));
  }

  const purgedInfo = localDummyIds.length > 0 ? ` (${localDummyIds.length} data dummy dibersihkan)` : '';
  const sparseNote = (isCanonical && finalStudents.length < 100)
    ? ' Untuk mengembalikan daftar siswa tanpa catatan yang belum ada di cache lokal, silakan tarik dari Google Sheets / Apps Script atau impor ulang Excel/CSV.'
    : '';
  const message = `Data asli dipulihkan tanpa dummy${purgedInfo}: ${finalStudents.length} siswa asli, ${finalViolations.length} kasus/pelanggaran, ${finalServices.length} riwayat layanan.${sparseNote}`;
  console.log(`[Restore Data] Sukses: ${message}`);

  return {
    success: true,
    studentCount: finalStudents.length,
    violationCount: finalViolations.length,
    serviceCount: finalServices.length,
    purgedDummyCount: localDummyIds.length,
    message
  };
}

