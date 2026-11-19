import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { Counselor } from '../types';
import { db, ensureFirebaseAuth, broadcastRealtimeChange, sortCollectionData } from './firestoreSync';
import { ensureSchoolDocumentExists } from './multiSchoolMigration';
import {
  extractRecordSchoolId,
  getActiveSchoolId,
  getRegisteredSchools,
  getSchoolConfig,
  getValidatedSchoolIdentity,
  isLegacyUnassignedRecord,
  loadSchoolData,
  sanitizeSchoolId,
  saveSchoolData
} from './schoolConfig';
import { getDeletedIds } from './deletionTracker';
import { isDummyRecord } from './purgeDummyData';
import { formatIndonesianDate } from './pdfGenerator';

export type IdentityAuditCategory =
  | 'Siswa'
  | 'Home Visit'
  | 'Konseling'
  | 'Bimbingan'
  | 'Pelanggaran'
  | 'Kasus'
  | 'Absensi'
  | 'Lainnya';

export interface UnassignedLegacyItem {
  id: string;
  category: IdentityAuditCategory;
  entityType: string;
  label: string;
  sublabel: string;
  date: string;
  colNames: string[];
  localKeys: string[];
  raw: any;
}

export interface OtherSchoolAuditItem {
  id: string;
  category: IdentityAuditCategory;
  entityType: string;
  label: string;
  sublabel: string;
  date: string;
  currentSchoolId: string;
  currentSchoolLabel: string;
  sourcePathType: 'root' | 'sub';
  colNames: string[];
  localKeys: string[];
  raw: any;
}

export interface SchoolIdentityAuditResult {
  schoolId: string;
  schoolName: string;
  total: number;
  ownedByCurrentSchool: number;
  unassignedLegacy: number;
  ownedByOtherSchool: number;
  deletedCount: number;
  totalStudents: number;
  studentBreakdown: {
    currentSchool: number;
    otherSchool: number;
    unassignedLegacy: number;
    total: number;
  };
  otherSchoolLabels: string[];
  unassignedByCategory: {
    students: number;
    homeVisits: number;
    counseling: number;
    bimbingan: number;
    violations: number;
    cases: number;
    attendance: number;
    others: number;
  };
  unassignedItems: UnassignedLegacyItem[];
  otherSchoolItems: OtherSchoolAuditItem[];
}

export interface MigrationSummaryResult {
  success: boolean;
  message: string;
  migratedStudents: number;
  totalStudents: number;
  migratedHomeVisits: number;
  migratedCounseling: number;
  migratedBimbingan: number;
  migratedServicesTotal: number;
  migratedViolations: number;
  migratedCases: number;
  migratedOthers: number;
  totalMigrated: number;
}

interface ManagedDatasetDef {
  colNames: string[];
  localKeys: string[];
  logicalGroup: 'students' | 'homeVisits' | 'services' | 'violations' | 'cases' | 'attendance' | 'others';
}

const MANAGED_DATASETS: ManagedDatasetDef[] = [
  { colNames: ['students'], localKeys: ['bk_students'], logicalGroup: 'students' },
  { colNames: ['home_visits'], localKeys: ['bk_home_visits'], logicalGroup: 'homeVisits' },
  { colNames: ['services', 'counseling'], localKeys: ['bk_services', 'bk_counseling'], logicalGroup: 'services' },
  { colNames: ['violations'], localKeys: ['bk_violations'], logicalGroup: 'violations' },
  { colNames: ['cases'], localKeys: ['bk_cases'], logicalGroup: 'cases' },
  { colNames: ['attendance_history'], localKeys: ['bk_attendance_history'], logicalGroup: 'attendance' },
  { colNames: ['daily_journals'], localKeys: ['bk_daily_journals'], logicalGroup: 'others' },
  { colNames: ['parent_summons'], localKeys: ['bk_parent_summons'], logicalGroup: 'others' },
  { colNames: ['achievements'], localKeys: ['bk_achievements', 'bk_student_achievements'], logicalGroup: 'others' },
  { colNames: ['program_evaluations'], localKeys: ['bk_program_evaluations'], logicalGroup: 'others' },
  { colNames: ['service_evaluations'], localKeys: ['bk_service_evaluations'], logicalGroup: 'others' },
];

function classifyServiceItem(item: any): { category: IdentityAuditCategory; entityType: string } {
  const sType = String(item?.serviceType || item?.category || item?.type || '').toLowerCase();
  if (sType.includes('home visit') || sType.includes('kunjungan rumah')) {
    return { category: 'Home Visit', entityType: 'Layanan Home Visit' };
  }
  if (sType.includes('konseling')) {
    return { category: 'Konseling', entityType: 'Layanan Konseling' };
  }
  return { category: 'Bimbingan', entityType: 'Layanan Bimbingan' };
}

function classifyDatasetItem(group: ManagedDatasetDef['logicalGroup'], item: any): {
  category: IdentityAuditCategory;
  entityType: string;
  label: string;
  sublabel: string;
  date: string;
} {
  const date = String(item?.date || item?.visitDate || item?.summonDate || item?.tanggal || item?.createdAt || '').slice(0, 10);

  if (group === 'students') {
    return {
      category: 'Siswa',
      entityType: 'Data Siswa',
      label: String(item?.name || 'Siswa Tanpa Nama'),
      sublabel: `Kelas ${item?.class || '-'}${item?.nis ? ` • NIS ${item.nis}` : ''}`,
      date
    };
  }
  if (group === 'homeVisits') {
    return {
      category: 'Home Visit',
      entityType: 'Home Visit',
      label: String(item?.studentName || item?.parentNameMet || 'Kunjungan Rumah'),
      sublabel: `${item?.studentClass ? `Kelas ${item.studentClass} • ` : ''}${item?.purpose || item?.address || 'Kunjungan Rumah'}`,
      date
    };
  }
  if (group === 'services') {
    const cls = classifyServiceItem(item);
    const studentList = Array.isArray(item?.students)
      ? item.students.map((st: any) => st?.name).filter(Boolean).join(', ')
      : '';
    return {
      category: cls.category,
      entityType: cls.entityType,
      label: `${item?.serviceType || cls.entityType}${studentList ? ` - ${studentList}` : ''}`,
      sublabel: String(item?.problem || item?.description || item?.bkComponent || 'Layanan BK').slice(0, 90),
      date
    };
  }
  if (group === 'violations') {
    return {
      category: 'Pelanggaran',
      entityType: 'Pelanggaran',
      label: `${item?.studentName || 'Siswa'} (${item?.studentClass || '-'})`,
      sublabel: String(item?.category || item?.notes || 'Catatan Pelanggaran'),
      date
    };
  }
  if (group === 'cases') {
    return {
      category: 'Kasus',
      entityType: 'Kasus Siswa',
      label: `${item?.studentName || 'Siswa'} (${item?.studentClass || '-'})`,
      sublabel: String(item?.category || item?.handlingProgress || item?.notes || 'Catatan Kasus'),
      date
    };
  }
  if (group === 'attendance') {
    return {
      category: 'Absensi',
      entityType: 'Absensi Kelas',
      label: `Absensi Kelas ${item?.class || item?.className || '-'}`,
      sublabel: `${Array.isArray(item?.records) ? `${item.records.length} siswa` : 'Rekap kehadiran'}`,
      date
    };
  }
  return {
    category: 'Lainnya',
    entityType: String(item?.activityType || item?.achievementName || 'Arsip BK'),
    label: String(item?.title || item?.studentName || item?.achievementName || item?.namaProgram || 'Dokumen BK'),
    sublabel: String(item?.description || item?.notes || item?.bidang || 'Dokumen Administrasi BK').slice(0, 90),
    date
  };
}

/**
 * Memindai identitas sekolah pada seluruh data Firestore + cache lokal (kecuali data di Sampah / isDeleted === true).
 */
export async function auditSchoolIdentity(counselor?: Counselor | null): Promise<SchoolIdentityAuditResult> {
  const targetSchoolId = sanitizeSchoolId(counselor?.schoolId || getActiveSchoolId());
  const validation = getValidatedSchoolIdentity(counselor);
  const targetSchoolName = validation.ok ? validation.schoolName : 'Belum Diatur';
  const deletedSet = new Set(getDeletedIds());

  try {
    await ensureFirebaseAuth();
  } catch {}

  // Gather registered other school IDs & readable names so we can audit cross-school contamination accurately
  const registeredSchools = getRegisteredSchools();
  const otherSchoolMap = new Map<string, string>();
  registeredSchools.forEach((s) => {
    const sId = sanitizeSchoolId(s.schoolId || s.npsn || s.schoolName || '');
    if (sId && sId !== targetSchoolId) {
      otherSchoolMap.set(sId, s.schoolName || sId);
    }
  });
  try {
    const schoolsSnap = await getDocs(collection(db, 'schools'));
    schoolsSnap.forEach((d) => {
      const data = d.data() as any;
      const sId = sanitizeSchoolId(data?.schoolId || d.id);
      if (sId && sId !== targetSchoolId && !otherSchoolMap.has(sId)) {
        otherSchoolMap.set(sId, data?.schoolName || sId);
      }
    });
  } catch {}

  // Track unique records per logical dataset group + id
  const seenLogicalIds = new Set<string>();
  const seenDeletedIds = new Set<string>();
  let total = 0;
  let ownedByCurrentSchool = 0;
  let unassignedLegacy = 0;
  let ownedByOtherSchool = 0;
  let totalStudents = 0;
  const studentBreakdown = {
    currentSchool: 0,
    otherSchool: 0,
    unassignedLegacy: 0,
    total: 0,
  };
  const detectedOtherSchoolLabels = new Set<string>();

  const unassignedByCategory = {
    students: 0,
    homeVisits: 0,
    counseling: 0,
    bimbingan: 0,
    violations: 0,
    cases: 0,
    attendance: 0,
    others: 0,
  };

  const unassignedItems: UnassignedLegacyItem[] = [];
  const otherSchoolItems: OtherSchoolAuditItem[] = [];

  for (const ds of MANAGED_DATASETS) {
    const recordMap = new Map<string, { item: any; matchedCols: Set<string>; refPaths: { isSub: boolean; schoolPartitionId?: string; colName: string; id: string }[] }>();

    // 1. Scan LocalStorage (partitioned for target & other registered schools + unpartitioned)
    for (const localKey of ds.localKeys) {
      try {
        const rawList = loadSchoolData<any[]>(localKey, [], targetSchoolId);
        if (Array.isArray(rawList)) {
          rawList.forEach((it: any) => {
            if (!it || !it.id) return;
            const rid = String(it.id).trim();
            if (it.isDeleted === true || deletedSet.has(rid)) {
              seenDeletedIds.add(`${ds.logicalGroup}:${rid}`);
              return;
            }
            if (isDummyRecord(it, localKey)) return;
            if (!recordMap.has(rid)) {
              recordMap.set(rid, { item: it, matchedCols: new Set(ds.colNames), refPaths: [] });
            }
          });
        }
      } catch {}

      if (typeof localStorage !== 'undefined') {
        try {
          const unpartRaw = localStorage.getItem(localKey);
          if (unpartRaw) {
            const parsed = JSON.parse(unpartRaw);
            if (Array.isArray(parsed)) {
              parsed.forEach((it: any) => {
                if (!it || !it.id) return;
                const rid = String(it.id).trim();
                if (it.isDeleted === true || deletedSet.has(rid) || isDummyRecord(it, localKey)) return;
                if (!recordMap.has(rid)) {
                  recordMap.set(rid, { item: it, matchedCols: new Set(ds.colNames), refPaths: [] });
                }
              });
            }
          }
        } catch {}
      }
    }

    // 2. Scan Firestore root & target school subcollections + other registered school subcollections in parallel
    const otherSchoolIdsList = Array.from(otherSchoolMap.keys()).slice(0, 8);
    await Promise.all(
      ds.colNames.map(async (colName) => {
        const ingestSnap = (snap: any, isSub: boolean, partitionId?: string) => {
          snap.forEach((d: any) => {
            const data = d.data();
            const rid = String(d.id).trim();
            if (!data || data.isDeleted === true || deletedSet.has(rid)) {
              if (data?.isDeleted === true || deletedSet.has(rid)) {
                seenDeletedIds.add(`${ds.logicalGroup}:${rid}`);
              }
              recordMap.delete(rid);
              return;
            }
            const obj = { id: rid, ...data };
            if (!extractRecordSchoolId(obj) && partitionId && partitionId !== targetSchoolId) {
              obj.schoolId = partitionId;
              obj.schoolName = otherSchoolMap.get(partitionId) || partitionId;
            }
            if (isDummyRecord(obj, ds.localKeys[0])) return;

            const prev = recordMap.get(rid);
            if (!prev) {
              recordMap.set(rid, {
                item: obj,
                matchedCols: new Set([colName]),
                refPaths: [{ isSub, schoolPartitionId: partitionId, colName, id: rid }]
              });
            } else {
              prev.matchedCols.add(colName);
              prev.refPaths.push({ isSub, schoolPartitionId: partitionId, colName, id: rid });
              const prevHasId = extractRecordSchoolId(prev.item) !== '' && !prev.item.isLegacyUnmigrated;
              const currHasId = extractRecordSchoolId(obj) !== '';
              if (!prevHasId && currHasId) {
                prev.item = obj;
              } else if (currHasId === prevHasId && isSub) {
                prev.item = { ...prev.item, ...obj };
              }
            }
          });
        };

        try {
          const queries = [
            getDocs(collection(db, colName)),
            getDocs(collection(db, 'schools', targetSchoolId, colName)),
            ...otherSchoolIdsList.map((oId) => getDocs(collection(db, 'schools', oId, colName)))
          ];
          const results = await Promise.allSettled(queries);
          if (results[0].status === 'fulfilled' && !results[0].value.empty) ingestSnap(results[0].value, false, undefined);
          if (results[1].status === 'fulfilled' && !results[1].value.empty) ingestSnap(results[1].value, true, targetSchoolId);
          for (let i = 0; i < otherSchoolIdsList.length; i++) {
            const res = results[2 + i];
            if (res.status === 'fulfilled' && !res.value.empty) {
              ingestSnap(res.value, true, otherSchoolIdsList[i]);
            }
          }
        } catch {}
      })
    );

    // 3. Evaluate distinct records in this dataset
    recordMap.forEach((entry, rid) => {
      const dedupeKey =
        ds.logicalGroup === 'cases'
          ? `cases:${rid}`
          : ds.logicalGroup === 'violations'
          ? `violations:${rid}`
          : `${ds.logicalGroup}:${rid}`;

      if (seenLogicalIds.has(dedupeKey)) return;
      seenLogicalIds.add(dedupeKey);

      const item = entry.item;
      const rawSchoolId = extractRecordSchoolId(item);
      const isUnassigned = rawSchoolId === '' || item.isLegacyUnmigrated === true;
      const cleanRecordSchoolId = rawSchoolId ? sanitizeSchoolId(rawSchoolId) : '';

      total++;
      if (ds.logicalGroup === 'students') {
        totalStudents++;
        studentBreakdown.total++;
      }

      if (isUnassigned) {
        unassignedLegacy++;
        if (ds.logicalGroup === 'students') studentBreakdown.unassignedLegacy++;
        const meta = classifyDatasetItem(ds.logicalGroup, item);

        if (meta.category === 'Siswa') unassignedByCategory.students++;
        else if (meta.category === 'Home Visit') unassignedByCategory.homeVisits++;
        else if (meta.category === 'Konseling') unassignedByCategory.counseling++;
        else if (meta.category === 'Bimbingan') unassignedByCategory.bimbingan++;
        else if (meta.category === 'Pelanggaran') unassignedByCategory.violations++;
        else if (meta.category === 'Kasus') unassignedByCategory.cases++;
        else if (meta.category === 'Absensi') unassignedByCategory.attendance++;
        else unassignedByCategory.others++;

        unassignedItems.push({
          id: rid,
          category: meta.category,
          entityType: meta.entityType,
          label: meta.label,
          sublabel: meta.sublabel,
          date: meta.date,
          colNames: Array.from(entry.matchedCols),
          localKeys: ds.localKeys,
          raw: item
        });
      } else if (cleanRecordSchoolId === targetSchoolId) {
        ownedByCurrentSchool++;
        if (ds.logicalGroup === 'students') studentBreakdown.currentSchool++;
      } else {
        ownedByOtherSchool++;
        if (ds.logicalGroup === 'students') studentBreakdown.otherSchool++;

        const meta = classifyDatasetItem(ds.logicalGroup, item);
        const rawSchoolLabel = String(
          item?.schoolName ||
          item?.namaSekolah ||
          otherSchoolMap.get(cleanRecordSchoolId) ||
          getSchoolConfig(cleanRecordSchoolId)?.schoolName ||
          rawSchoolId
        ).trim();
        if (rawSchoolLabel) {
          detectedOtherSchoolLabels.add(rawSchoolLabel);
        }

        otherSchoolItems.push({
          id: rid,
          category: meta.category,
          entityType: meta.entityType,
          label: meta.label,
          sublabel: meta.sublabel,
          date: meta.date,
          currentSchoolId: cleanRecordSchoolId || rawSchoolId,
          currentSchoolLabel: rawSchoolLabel || cleanRecordSchoolId,
          sourcePathType: entry.refPaths.some((p) => p.isSub && p.schoolPartitionId !== targetSchoolId) ? 'sub' : 'root',
          colNames: Array.from(entry.matchedCols),
          localKeys: ds.localKeys,
          raw: item
        });
      }
    });
  }

  return {
    schoolId: targetSchoolId,
    schoolName: targetSchoolName,
    total,
    ownedByCurrentSchool,
    unassignedLegacy,
    ownedByOtherSchool,
    deletedCount: seenDeletedIds.size,
    totalStudents,
    studentBreakdown,
    otherSchoolLabels: Array.from(detectedOtherSchoolLabels),
    unassignedByCategory,
    unassignedItems,
    otherSchoolItems
  };
}

/**
 * MIGRASI DATA LAMA MANUAL:
 * Hanya boleh dipanggil oleh klik manual user pada tombol [Migrasi Data Lama] atau [Tandai Sebagai Milik Sekolah Saya].
 * - Mengisi schoolId, sekolahId, schoolName, namaSekolah, npsn, migratedAt pada data yang BELUM memiliki schoolId.
 * - DILARANG menimpa data yang sudah punya schoolId (baik milik sekolah ini maupun sekolah lain).
 */
export async function migrateLegacyUnassignedData(
  counselor?: Counselor | null,
  onlyIds?: string[]
): Promise<MigrationSummaryResult> {
  const schoolIdentity = getValidatedSchoolIdentity(counselor);
  if (!schoolIdentity.ok) {
    return {
      success: false,
      message: 'Gagal: Sekolah belum diatur',
      migratedStudents: 0,
      totalStudents: 0,
      migratedHomeVisits: 0,
      migratedCounseling: 0,
      migratedBimbingan: 0,
      migratedServicesTotal: 0,
      migratedViolations: 0,
      migratedCases: 0,
      migratedOthers: 0,
      totalMigrated: 0
    };
  }

  const { schoolId: targetSchoolId, schoolName: targetSchoolName, npsn } = schoolIdentity;
  const todayISO = new Date().toISOString().slice(0, 10);
  const migratedAtLabel = formatIndonesianDate(todayISO);
  const onlySet = Array.isArray(onlyIds) && onlyIds.length > 0 ? new Set(onlyIds.map(String)) : null;
  const deletedSet = new Set(getDeletedIds());

  await ensureFirebaseAuth();
  await ensureSchoolDocumentExists(targetSchoolId, counselor || undefined);

  const stampFields: Record<string, any> = {
    schoolId: targetSchoolId,
    sekolahId: targetSchoolId,
    schoolName: targetSchoolName,
    namaSekolah: targetSchoolName,
    migratedAt: migratedAtLabel,
    isLegacyUnmigrated: false
  };
  if (npsn) stampFields.npsn = npsn;

  let migratedStudents = 0;
  let totalStudents = 0;
  let migratedHomeVisits = 0;
  let migratedCounseling = 0;
  let migratedBimbingan = 0;
  let migratedViolations = 0;
  let migratedCases = 0;
  let migratedOthers = 0;

  const countedMigratedIds = new Set<string>();
  let batch = writeBatch(db);
  let batchCount = 0;

  const commitIfNeeded = async (force = false) => {
    if (batchCount >= 380 || (force && batchCount > 0)) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  };

  for (const ds of MANAGED_DATASETS) {
    const activePool = new Map<string, any>();

    // Collect local items
    for (const localKey of ds.localKeys) {
      const localList = loadSchoolData<any[]>(localKey, [], targetSchoolId);
      if (Array.isArray(localList)) {
        localList.forEach((it) => {
          if (it && it.id && it.isDeleted !== true && !deletedSet.has(String(it.id)) && !isDummyRecord(it, localKey)) {
            activePool.set(String(it.id), it);
          }
        });
      }
    }

    // Collect & migrate Firestore root + subcollection docs (strictly skip docs that ALREADY have schoolId/sekolahId!)
    for (const colName of ds.colNames) {
      const processCloudSnap = async (snap: any, isSub: boolean) => {
        for (const d of snap.docs) {
          const rid = String(d.id);
          const data = d.data();
          if (!data || data.isDeleted === true || deletedSet.has(rid)) continue;
          const fullObj = { id: rid, ...data };
          if (isDummyRecord(fullObj, ds.localKeys[0])) continue;

          const existingSchoolId = extractRecordSchoolId(data);
          // GUARD KETAT: Jika dokumen SUDAH punya schoolId / sekolahId, JANGAN TIMPA!
          if (existingSchoolId !== '') {
            if (sanitizeSchoolId(existingSchoolId) === targetSchoolId) {
              activePool.set(rid, fullObj);
            }
            continue;
          }

          if (onlySet && !onlySet.has(rid)) {
            activePool.set(rid, { ...fullObj, isLegacyUnmigrated: true });
            continue;
          }

          // Tandai dokumen tanpa identitas sekolah di Firestore (root & subcollection target sekolah)
          batch.set(d.ref, stampFields, { merge: true });
          batchCount++;
          if (!isSub) {
            batch.set(doc(db, 'schools', targetSchoolId, colName, rid), { ...fullObj, ...stampFields }, { merge: true });
            batchCount++;
          }
          await commitIfNeeded(false);

          const updatedObj = { ...fullObj, ...stampFields };
          activePool.set(rid, updatedObj);

          const metricKey = `${ds.logicalGroup}:${rid}`;
          if (!countedMigratedIds.has(metricKey)) {
            countedMigratedIds.add(metricKey);
            if (ds.logicalGroup === 'students') migratedStudents++;
            else if (ds.logicalGroup === 'homeVisits') migratedHomeVisits++;
            else if (ds.logicalGroup === 'violations') migratedViolations++;
            else if (ds.logicalGroup === 'cases') migratedCases++;
            else if (ds.logicalGroup === 'services') {
              const cls = classifyServiceItem(fullObj);
              if (cls.category === 'Home Visit') migratedHomeVisits++;
              else if (cls.category === 'Konseling') migratedCounseling++;
              else migratedBimbingan++;
            } else {
              migratedOthers++;
            }
          }
        }
      };

      try {
        const [rootSnap, subSnap] = await Promise.all([
          getDocs(collection(db, colName)),
          getDocs(collection(db, 'schools', targetSchoolId, colName))
        ]);
        if (!rootSnap.empty) await processCloudSnap(rootSnap, false);
        if (!subSnap.empty) await processCloudSnap(subSnap, true);
      } catch (err) {
        console.warn(`[Migration] Firestore scan warning for ${colName}:`, err);
      }
    }

    // Check any local-only unassigned records that weren't in Firestore yet
    for (const [rid, item] of Array.from(activePool.entries())) {
      const existingSchoolId = extractRecordSchoolId(item);
      if (existingSchoolId === '' || item.isLegacyUnmigrated === true) {
        if (onlySet && !onlySet.has(rid)) continue;
        // Skip if remote already had a DIFFERENT schoolId
        if (existingSchoolId !== '' && sanitizeSchoolId(existingSchoolId) !== targetSchoolId) continue;

        const updatedObj = { ...item, ...stampFields };
        activePool.set(rid, updatedObj);

        const primaryCol = ds.colNames[0];
        batch.set(doc(db, 'schools', targetSchoolId, primaryCol, rid), updatedObj, { merge: true });
        batch.set(doc(db, primaryCol, rid), updatedObj, { merge: true });
        batchCount += 2;
        await commitIfNeeded(false);

        const metricKey = `${ds.logicalGroup}:${rid}`;
        if (!countedMigratedIds.has(metricKey)) {
          countedMigratedIds.add(metricKey);
          if (ds.logicalGroup === 'students') migratedStudents++;
          else if (ds.logicalGroup === 'homeVisits') migratedHomeVisits++;
          else if (ds.logicalGroup === 'violations') migratedViolations++;
          else if (ds.logicalGroup === 'cases') migratedCases++;
          else if (ds.logicalGroup === 'services') {
            const cls = classifyServiceItem(item);
            if (cls.category === 'Home Visit') migratedHomeVisits++;
            else if (cls.category === 'Konseling') migratedCounseling++;
            else migratedBimbingan++;
          } else {
            migratedOthers++;
          }
        }
      }
    }

    if (ds.logicalGroup === 'students') {
      totalStudents = activePool.size;
    }

    // Update LocalStorage & broadcast immediately to React state
    const mergedList = Array.from(activePool.values());
    for (const localKey of ds.localKeys) {
      const sorted = sortCollectionData(localKey, mergedList, targetSchoolId);
      saveSchoolData(localKey, sorted, targetSchoolId);
      if (localKey === 'bk_attendance_history' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bk_attendance_history_changed', { detail: sorted }));
      }
      broadcastRealtimeChange({
        type: 'sync',
        key: localKey,
        data: sorted,
        schoolId: targetSchoolId
      });
    }
  }

  await commitIfNeeded(true);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('storage'));
  }

  const migratedServicesTotal = migratedHomeVisits + migratedCounseling + migratedBimbingan;
  const totalMigrated =
    migratedStudents + migratedServicesTotal + migratedViolations + migratedCases + migratedOthers;

  const message = `Berhasil migrasi: Siswa ${migratedStudents} (dari ${totalStudents}), Layanan ${migratedServicesTotal} (Home Visit ${migratedHomeVisits}, Konseling ${migratedCounseling}, Bimbingan ${migratedBimbingan}), Pelanggaran ${migratedViolations}, Kasus ${migratedCases}. Data yang sudah punya sekolahId tidak diubah.`;

  return {
    success: true,
    message,
    migratedStudents,
    totalStudents,
    migratedHomeVisits,
    migratedCounseling,
    migratedBimbingan,
    migratedServicesTotal,
    migratedViolations,
    migratedCases,
    migratedOthers,
    totalMigrated
  };
}

/**
 * PEMINDAHAN MANUAL DATA SALAH SEKOLAH (contoh: data yang sempat tercatat ke sekolah lain):
 * Hanya dipanggil secara manual oleh klik tombol & konfirmasi user.
 * Memindahkan / menandai ulang `schoolId` dokumen yang dipilih ke sekolah aktif saat ini.
 */
export async function relocateOtherSchoolDataToCurrentSchool(
  counselor?: Counselor | null,
  onlyIds?: string[]
): Promise<MigrationSummaryResult> {
  const schoolIdentity = getValidatedSchoolIdentity(counselor);
  if (!schoolIdentity.ok) {
    return {
      success: false,
      message: 'Gagal: Sekolah belum diatur',
      migratedStudents: 0,
      totalStudents: 0,
      migratedHomeVisits: 0,
      migratedCounseling: 0,
      migratedBimbingan: 0,
      migratedServicesTotal: 0,
      migratedViolations: 0,
      migratedCases: 0,
      migratedOthers: 0,
      totalMigrated: 0
    };
  }

  const { schoolId: targetSchoolId, schoolName: targetSchoolName, npsn } = schoolIdentity;
  const audit = await auditSchoolIdentity(counselor);
  const onlySet = Array.isArray(onlyIds) && onlyIds.length > 0 ? new Set(onlyIds.map(String)) : null;

  const candidates = audit.otherSchoolItems.filter((it) => !onlySet || onlySet.has(it.id));
  if (candidates.length === 0) {
    return {
      success: true,
      message: 'Tidak ada data sekolah lain yang perlu dipindahkan.',
      migratedStudents: 0,
      totalStudents: audit.studentBreakdown.currentSchool,
      migratedHomeVisits: 0,
      migratedCounseling: 0,
      migratedBimbingan: 0,
      migratedServicesTotal: 0,
      migratedViolations: 0,
      migratedCases: 0,
      migratedOthers: 0,
      totalMigrated: 0
    };
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const migratedAtLabel = formatIndonesianDate(todayISO);

  await ensureFirebaseAuth();
  await ensureSchoolDocumentExists(targetSchoolId, counselor || undefined);

  const stampFields: Record<string, any> = {
    schoolId: targetSchoolId,
    sekolahId: targetSchoolId,
    schoolName: targetSchoolName,
    namaSekolah: targetSchoolName,
    migratedAt: migratedAtLabel,
    isLegacyUnmigrated: false
  };
  if (npsn) stampFields.npsn = npsn;

  let migratedStudents = 0;
  let migratedHomeVisits = 0;
  let migratedCounseling = 0;
  let migratedBimbingan = 0;
  let migratedViolations = 0;
  let migratedCases = 0;
  let migratedOthers = 0;

  let batch = writeBatch(db);
  let batchCount = 0;

  const commitIfNeeded = async (force = false) => {
    if (batchCount >= 350 || (force && batchCount > 0)) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  };

  const localUpdatesByKey = new Map<string, any[]>();
  const seenKeyId = new Set<string>();

  for (const item of candidates) {
    const updatedObj = { ...item.raw, ...stampFields, id: item.id };
    for (const colName of item.colNames) {
      batch.set(doc(db, 'schools', targetSchoolId, colName, item.id), updatedObj, { merge: true });
      batch.set(doc(db, colName, item.id), updatedObj, { merge: true });
      batchCount += 2;
      await commitIfNeeded(false);
    }

    for (const lKey of item.localKeys) {
      if (!localUpdatesByKey.has(lKey)) {
        const existing = loadSchoolData<any[]>(lKey, [], targetSchoolId);
        localUpdatesByKey.set(lKey, Array.isArray(existing) ? [...existing] : []);
      }
      const list = localUpdatesByKey.get(lKey)!;
      const idx = list.findIndex((x) => String(x?.id) === item.id);
      if (idx !== -1) list[idx] = updatedObj;
      else list.push(updatedObj);
    }

    const metricKey = `${item.category}:${item.id}`;
    if (!seenKeyId.has(metricKey)) {
      seenKeyId.add(metricKey);
      if (item.category === 'Siswa') migratedStudents++;
      else if (item.category === 'Home Visit') migratedHomeVisits++;
      else if (item.category === 'Konseling') migratedCounseling++;
      else if (item.category === 'Bimbingan') migratedBimbingan++;
      else if (item.category === 'Pelanggaran') migratedViolations++;
      else if (item.category === 'Kasus') migratedCases++;
      else migratedOthers++;
    }
  }

  await commitIfNeeded(true);

  localUpdatesByKey.forEach((list, localKey) => {
    const sorted = sortCollectionData(localKey, list, targetSchoolId);
    saveSchoolData(localKey, sorted, targetSchoolId);
    if (localKey === 'bk_attendance_history' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bk_attendance_history_changed', { detail: sorted }));
    }
    broadcastRealtimeChange({
      type: 'sync',
      key: localKey,
      data: sorted,
      schoolId: targetSchoolId
    });
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('storage'));
  }

  const migratedServicesTotal = migratedHomeVisits + migratedCounseling + migratedBimbingan;
  const totalMigrated = migratedStudents + migratedServicesTotal + migratedViolations + migratedCases + migratedOthers;

  return {
    success: true,
    message: `Berhasil memindahkan ${totalMigrated} data ke ${targetSchoolName} (Siswa: ${migratedStudents}, Layanan: ${migratedServicesTotal}, Pelanggaran: ${migratedViolations}, Kasus: ${migratedCases}).`,
    migratedStudents,
    totalStudents: audit.studentBreakdown.currentSchool + migratedStudents,
    migratedHomeVisits,
    migratedCounseling,
    migratedBimbingan,
    migratedServicesTotal,
    migratedViolations,
    migratedCases,
    migratedOthers,
    totalMigrated
  };
}

