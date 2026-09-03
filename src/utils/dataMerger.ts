import { Student, ViolationRecord, CounselingService, ClassAttendanceRecord, BKJournalEntry, HomeVisitRecord, StudentAchievement } from '../types';
import { getDeletedIds, getSyncedIds } from './deletionTracker';

/**
 * Generic function to merge two arrays of objects by a key field (e.g. 'id')
 */
export function mergeLists<T extends Record<string, any>>(
  localList: T[],
  remoteList: T[],
  keyField: keyof T = 'id',
  customMerge?: (local: T, remote: T) => T
): T[] {
  const mergedMap = new Map<any, T>();
  const deletedIds = getDeletedIds();
  const syncedIds = getSyncedIds();

  // Add all remote items first, filtering out any that were deleted in the app
  remoteList.forEach(item => {
    const key = item[keyField];
    if (key !== undefined && key !== null) {
      if (deletedIds.includes(String(key))) {
        return; // Filter out app-deleted items
      }
      mergedMap.set(key, item);
    }
  });

  // Merge local items
  localList.forEach(localItem => {
    if (!localItem) return;
    const key = localItem[keyField];
    if (key === undefined || key === null || key === '') return;

    const stringKey = String(key);
    if (deletedIds.includes(stringKey)) {
      return; // Filter out app-deleted items
    }

    if (!mergedMap.has(key)) {
      // Exists only locally -> Keep it safely
      mergedMap.set(key, localItem);
    } else {
      // Exists in both, resolve conflict
      const remoteItem = mergedMap.get(key)!;
      if (customMerge) {
        mergedMap.set(key, customMerge(localItem, remoteItem));
      } else {
        mergedMap.set(key, resolveDefaultConflict(localItem, remoteItem));
      }
    }
  });

  return Array.from(mergedMap.values());
}

/**
 * Default conflict resolver based on timestamps, status, or field richness
 */
function resolveDefaultConflict<T extends Record<string, any>>(local: T, remote: T): T {
  // 1. Compare updatedAt if available
  if ('updatedAt' in local && 'updatedAt' in remote) {
    const localTime = new Date(local.updatedAt).getTime();
    const remoteTime = new Date(remote.updatedAt).getTime();
    if (!isNaN(localTime) && !isNaN(remoteTime)) {
      return localTime >= remoteTime ? local : remote;
    }
  }

  // 2. Compare createdAt if available
  if ('createdAt' in local && 'createdAt' in remote) {
    const localTime = new Date(local.createdAt).getTime();
    const remoteTime = new Date(remote.createdAt).getTime();
    if (!isNaN(localTime) && !isNaN(remoteTime)) {
      return localTime >= remoteTime ? local : remote;
    }
  }

  // 3. Compare status completion (e.g. 'Selesai' is preferred over 'Terjadwal' / 'Dalam Proses')
  if ('status' in local && 'status' in remote) {
    const finishedStates = ['Selesai', 'Hadir'];
    const localFinished = finishedStates.includes(local.status);
    const remoteFinished = finishedStates.includes(remote.status);
    if (localFinished && !remoteFinished) return local;
    if (!localFinished && remoteFinished) return remote;
  }

  // 4. Density comparison: Choose the object that has more non-empty keys or longer text
  const localDensity = countFilledFields(local);
  const remoteDensity = countFilledFields(remote);

  if (localDensity !== remoteDensity) {
    return localDensity > remoteDensity ? local : remote;
  }

  // Fallback to local
  return local;
}

/**
 * Counts the number of filled (non-falsy) fields in an object
 */
function countFilledFields(obj: Record<string, any>): number {
  let count = 0;
  Object.entries(obj).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      count++;
      // If it's a string, add some weight for longer descriptions/notes
      if (typeof val === 'string') {
        count += Math.min(val.length / 50, 5); // caps weight at 5
      }
    }
  });
  return count;
}

/**
 * Smart merge ecosystem for all BK application tables.
 * Recalculates student stats (points, bk count) to maintain absolute consistency.
 */
export function mergeFullDatabase(
  local: {
    students: Student[];
    violations: ViolationRecord[];
    services: CounselingService[];
    attendance: ClassAttendanceRecord[];
    journals: BKJournalEntry[];
    homeVisits: HomeVisitRecord[];
    achievements?: StudentAchievement[];
  },
  remote: {
    students: Student[];
    violations: ViolationRecord[];
    services: CounselingService[];
    attendance: ClassAttendanceRecord[];
    journals: BKJournalEntry[];
    homeVisits: HomeVisitRecord[];
    achievements?: StudentAchievement[];
  }
): {
  students: Student[];
  violations: ViolationRecord[];
  services: CounselingService[];
  attendance: ClassAttendanceRecord[];
  journals: BKJournalEntry[];
  homeVisits: HomeVisitRecord[];
  achievements: StudentAchievement[];
} {
  // Merge transactions first (where actual logs are entered)
  const mergedViolations = mergeLists(local.violations || [], remote.violations || [], 'id');
  const mergedServices = mergeLists(local.services || [], remote.services || [], 'id');
  const mergedAttendance = mergeLists(local.attendance || [], remote.attendance || [], 'id');
  const mergedJournals = mergeLists(local.journals || [], remote.journals || [], 'id');
  const mergedHomeVisits = mergeLists(local.homeVisits || [], remote.homeVisits || [], 'id');
  const mergedAchievements = mergeLists(local.achievements || [], remote.achievements || [], 'id');

  // Merge students list
  const rawMergedStudents = mergeLists(local.students || [], remote.students || [], 'id');

  // Recalculate student violation points, achievement points, and counseling count dynamically to guarantee perfect accuracy
  const recalibratedStudents = rawMergedStudents.map(student => {
    // 1. Calculate violation points
    const studentViolations = mergedViolations.filter(v => v.studentId === student.id);
    const violationPoints = studentViolations.reduce((sum, v) => sum + (v.pointsAdded || 0), 0);

    // 2. Calculate achievement points
    const studentAchievements = mergedAchievements.filter(a => a.studentId === student.id);
    const achievementPoints = studentAchievements.reduce((sum, a) => sum + (a.pointsReward || 0), 0);

    // 3. Calculate counseling services count
    const studentServices = mergedServices.filter(s => 
      s.students && s.students.some(sub => sub.id === student.id)
    );
    const bkServicesCount = studentServices.length;

    return {
      ...student,
      violationPoints,
      achievementPoints,
      bkServicesCount
    };
  });

  return {
    students: recalibratedStudents,
    violations: mergedViolations,
    services: mergedServices,
    attendance: mergedAttendance,
    journals: mergedJournals,
    homeVisits: mergedHomeVisits,
    achievements: mergedAchievements
  };
}
