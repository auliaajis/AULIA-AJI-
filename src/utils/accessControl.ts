import { Student, ViolationRecord, CounselingService, ActivityLog, Counselor, StudentAchievement } from '../types';
import { sanitizeSchoolId, getActiveSchoolId, isSmpSchool } from './schoolConfig';

/**
 * Extracts and normalizes the list of allowed classes for a counselor.
 * If allowedClasses is set explicitly, it is parsed and normalized.
 * If empty or 'ALL'/'SEMUA', returns [] representing full school access.
 * If not set, infers classes from the counselor's assigned role.
 */
export function getAllowedClassesList(counselor?: Counselor): string[] {
  if (!counselor) return [];

  // 1. Explicitly configured allowedClasses
  if (counselor.allowedClasses) {
    const classesArr = Array.isArray(counselor.allowedClasses)
      ? counselor.allowedClasses
      : typeof counselor.allowedClasses === 'string'
        ? (counselor.allowedClasses as string).split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)
        : [];
        
    if (classesArr.length > 0) {
      const isSmp = isSmpSchool(counselor.schoolId);
      const normalized = classesArr
        .map(c => c.replace(/kelas\s*/i, '').trim().toUpperCase())
        .filter(c => !isSmp || !/^(10|11|12|X|XI|XII)/i.test(c));
        
      // If user specified 'ALL' or 'SEMUA', return empty array representing full school access
      if (normalized.includes('ALL') || normalized.includes('SEMUA')) {
        return [];
      }
      return normalized;
    }
  }

  // 2. If Administrator / Koordinator BK with no specific allowedClasses, empty array represents full school access
  if (isAdministrator(counselor)) {
    return [];
  }

  // 3. Infer from role if specific grade is specified (e.g. "Guru Pembimbing Kelas 8")
  const role = (counselor.role || '').toLowerCase();
  if (role.includes('kelas 8') || role.includes('kelas viii') || role.includes('tingkat 8')) {
    return ['8A', '8B', '8C', '8D', '8E', '8F', '8G', '8H', '8I'];
  }
  if (role.includes('kelas 7') || role.includes('kelas vii') || role.includes('tingkat 7')) {
    return ['7A', '7B', '7C', '7D', '7E', '7F', '7G', '7H', '7I'];
  }
  if (role.includes('kelas 9') || role.includes('kelas ix') || role.includes('tingkat 9')) {
    return ['9A', '9B', '9C', '9D', '9E', '9F', '9G', '9H', '9I'];
  }

  // Match specific single class pattern like "Wali Kelas 8B" or "8C"
  const singleClassMatch = role.match(/([789][a-zA-Z])/i);
  if (singleClassMatch) {
    return [singleClassMatch[1].toUpperCase()];
  }

  return [];
}

/**
 * Checks if a specific class is allowed under the counselor's permissions.
 * Empty allowedClasses array means NO class restriction (allows all SMP classes).
 */
export function isClassAllowed(studentClass: string, allowedClasses: string[] | string | undefined | null): boolean {
  if (!studentClass) return false;
  
  const classesArr = Array.isArray(allowedClasses)
    ? allowedClasses
    : typeof allowedClasses === 'string'
      ? (allowedClasses as string).split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)
      : [];

  // Empty allowedClasses array indicates full unrestricted access to all school classes
  if (classesArr.length === 0) return true;

  const cleanClass = studentClass.replace(/kelas\s*/i, '').replace(/\s+/g, '').toUpperCase();

  // Strict check: Kelas 10, 11, 12 / SMA classes are only forbidden if this is an SMP school
  if (isSmpSchool() && /^(10|11|12|X|XI|XII)/i.test(cleanClass)) {
    return false;
  }

  return classesArr.some(allowed => {
    const cleanAllowed = String(allowed).replace(/kelas\s*/i, '').replace(/\s+/g, '').toUpperCase();
    if (cleanAllowed === 'ALL' || cleanAllowed === 'SEMUA') return true;
    if (cleanClass === cleanAllowed) return true;
    // If allowed is a single digit grade e.g. "8", match classes like "8A", "8B", but NEVER "10" for SMP
    if (/^[789]$/.test(cleanAllowed)) {
      return cleanClass.startsWith(cleanAllowed) && !cleanClass.startsWith('10') && !cleanClass.startsWith('1');
    }
    // High school support: e.g. "10", "11", "12", "X", "XI", "XII"
    if (/^(10|11|12|X|XI|XII)$/i.test(cleanAllowed)) {
      return cleanClass.startsWith(cleanAllowed);
    }
    return false;
  });
}

/**
 * Determines whether a counselor has full Administrator / Koordinator privileges.
 */
export function isAdministrator(counselor?: Counselor): boolean {
  if (!counselor) return false;
  
  const nameLower = (counselor.name || '').toLowerCase();
  const usernameLower = (counselor.username || '').toLowerCase();
  const emailLower = (counselor.email || '').toLowerCase();

  // Bapak Aulia Aji Sasongko is the Creator & Koordinator BK / Administrator Utama
  if (
    counselor.id === 'c1' || 
    counselor.id === 'admin' ||
    usernameLower === 'aulia' || 
    usernameLower === 'admin' ||
    nameLower.includes('aulia') || 
    emailLower.includes('auliasasongko')
  ) {
    return true;
  }

  const role = (counselor.role || '').toLowerCase();
  if (role.includes('admin') || role.includes('administrator') || role.includes('koordinator')) return true;
  return false;
}

/**
 * Filters the students array based on the counselor's allowed classes and account.
 * Respects explicit class selections so user can filter which classes appear in the database view.
 */
export function filterStudents(students: Student[], counselor: Counselor): Student[] {
  if (!Array.isArray(students)) return [];
  if (!counselor) return [];

  const counselorSchoolId = counselor.schoolId ? sanitizeSchoolId(counselor.schoolId) : getActiveSchoolId();
  const isSmp = isSmpSchool(counselorSchoolId);

  // Strict School Partition Check
  const schoolMatched = students.filter(s => {
    if (!s) return false;
    if (s.schoolId && sanitizeSchoolId(s.schoolId) !== counselorSchoolId) {
      return false;
    }
    const cleanCls = String(s.class || '').replace(/kelas\s*/i, '').replace(/\s+/g, '').toUpperCase();
    if (isSmp && /^(10|11|12|X|XI|XII)/i.test(cleanCls)) {
      return false;
    }
    return true;
  });

  // Full Administrator & Koordinator BK (Bapak Aulia Aji Sasongko) has unrestricted access to all classes
  if (isAdministrator(counselor)) {
    return schoolMatched;
  }

  const allowed = getAllowedClassesList(counselor);

  // If counselor explicitly selected specific classes to filter in profile, respect that selection
  if (allowed.length > 0 && !allowed.includes('ALL') && !allowed.includes('SEMUA')) {
    return schoolMatched.filter(s => isClassAllowed(s.class, allowed));
  }

  return schoolMatched;
}

/**
 * Filters the violations list.
 * Respects explicit class selections, but always shows records authored/handled by this counselor.
 */
export function filterViolations(violations: ViolationRecord[], counselor: Counselor): ViolationRecord[] {
  if (!Array.isArray(violations)) return [];
  if (!counselor) return [];

  const counselorSchoolId = counselor.schoolId ? sanitizeSchoolId(counselor.schoolId) : getActiveSchoolId();

  // 1. Strict School Boundary Isolation
  const schoolIsolated = violations.filter(v => {
    if (!v) return false;
    if (v.schoolId && sanitizeSchoolId(v.schoolId) !== counselorSchoolId) {
      return false;
    }
    return true;
  });

  // Full Administrator & Koordinator BK has unrestricted access to all school records
  if (isAdministrator(counselor)) {
    return schoolIsolated;
  }

  const allowed = getAllowedClassesList(counselor);

  // If counselor explicitly selected specific classes, filter strictly by selected classes or authored/handled
  if (allowed.length > 0 && !allowed.includes('ALL') && !allowed.includes('SEMUA')) {
    const counselorNameLower = (counselor.name || '').toLowerCase().trim();
    const counselorUsernameLower = (counselor.username || '').toLowerCase().trim();

    const isSmp = isSmpSchool(counselorSchoolId);

    return schoolIsolated.filter(v => {
      const cleanCls = String(v.studentClass || '').replace(/kelas\s*/i, '').replace(/\s+/g, '').toUpperCase();
      if (isSmp && /^(10|11|12|X|XI|XII)/i.test(cleanCls)) {
        return false;
      }

      const isAssignedClass = isClassAllowed(v.studentClass, allowed);
      const isAuthorOrHandler = Boolean(
        (v.counselorId && v.counselorId === counselor.id) ||
        (counselorNameLower && (
          (v.reportedBy && v.reportedBy.toLowerCase().includes(counselorNameLower)) ||
          (v.handledBy && v.handledBy.toLowerCase().includes(counselorNameLower))
        )) ||
        (counselorUsernameLower && v.reportedBy && v.reportedBy.toLowerCase().includes(counselorUsernameLower))
      );

      return isAssignedClass || isAuthorOrHandler;
    });
  }

  return schoolIsolated;
}

/**
 * Filters the counseling services. Shows services for selected classes or conducted by this counselor.
 */
export function filterServices(services: CounselingService[], counselor: Counselor): CounselingService[] {
  if (!Array.isArray(services)) return [];
  if (!counselor) return [];

  const counselorSchoolId = counselor.schoolId ? sanitizeSchoolId(counselor.schoolId) : getActiveSchoolId();

  const schoolIsolated = services.filter(srv => {
    if (!srv) return false;
    const srvAny = srv as any;
    if (srvAny.schoolId && sanitizeSchoolId(srvAny.schoolId) !== counselorSchoolId) {
      return false;
    }
    return true;
  });

  if (isAdministrator(counselor)) {
    return schoolIsolated;
  }

  const allowed = getAllowedClassesList(counselor);

  // If counselor explicitly selected specific classes, filter strictly
  if (allowed.length > 0 && !allowed.includes('ALL') && !allowed.includes('SEMUA')) {
    const counselorNameLower = (counselor.name || '').toLowerCase().trim();
    const isSmp = isSmpSchool(counselorSchoolId);
    return schoolIsolated.filter(srv => {
      if (isSmp && Array.isArray(srv.students) && srv.students.some(st => /^(10|11|12|X|XI|XII)/i.test(String(st.class || '').replace(/kelas\s*/i, '').trim()))) {
        return false;
      }
      const studentMatch = Array.isArray(srv.students) && srv.students.some(st => isClassAllowed(st.class, allowed));
      const counselorMatch = Boolean(
        (srv as any).counselorId === counselor.id ||
        (counselorNameLower && (
          ((srv as any).counselorName && (srv as any).counselorName.toLowerCase().includes(counselorNameLower)) ||
          ((srv as any).recordedBy && (srv as any).recordedBy.toLowerCase().includes(counselorNameLower))
        ))
      );
      return studentMatch || counselorMatch;
    });
  }

  return schoolIsolated;
}

/**
 * Filters student achievements based on the counselor's selected classes.
 */
export function filterAchievements(achievements: StudentAchievement[], counselor: Counselor): StudentAchievement[] {
  if (!Array.isArray(achievements)) return [];
  if (!counselor) return [];

  const counselorSchoolId = counselor.schoolId ? sanitizeSchoolId(counselor.schoolId) : getActiveSchoolId();

  const schoolIsolated = achievements.filter(a => {
    if (!a) return false;
    const aAny = a as any;
    if (aAny.schoolId && sanitizeSchoolId(aAny.schoolId) !== counselorSchoolId) {
      return false;
    }
    return true;
  });

  if (isAdministrator(counselor)) {
    return schoolIsolated;
  }

  const allowed = getAllowedClassesList(counselor);

  if (allowed.length > 0 && !allowed.includes('ALL') && !allowed.includes('SEMUA')) {
    return schoolIsolated.filter(a => isClassAllowed(a.studentClass, allowed));
  }

  return schoolIsolated;
}

/**
 * Filters home visits based on the counselor's selected classes or authored by this counselor.
 */
export function filterHomeVisits(homeVisits: any[], counselor: Counselor): any[] {
  if (!Array.isArray(homeVisits)) return [];
  if (!counselor) return [];

  const counselorSchoolId = counselor.schoolId ? sanitizeSchoolId(counselor.schoolId) : getActiveSchoolId();

  const schoolIsolated = homeVisits.filter(hv => {
    if (!hv) return false;
    if (hv.schoolId && sanitizeSchoolId(hv.schoolId) !== counselorSchoolId) {
      return false;
    }
    return true;
  });

  if (isAdministrator(counselor)) {
    return schoolIsolated;
  }

  const allowed = getAllowedClassesList(counselor);

  if (allowed.length > 0 && !allowed.includes('ALL') && !allowed.includes('SEMUA')) {
    const counselorNameLower = (counselor.name || '').toLowerCase().trim();
    return schoolIsolated.filter(hv => {
      const cls = hv.studentClass || hv.className || hv.kelas || '';
      const classMatch = isClassAllowed(cls, allowed);
      const counselorMatch = Boolean(
        (hv.counselorId && hv.counselorId === counselor.id) ||
        (counselorNameLower && (
          (hv.counselorName && hv.counselorName.toLowerCase().includes(counselorNameLower)) ||
          (hv.reportedBy && hv.reportedBy.toLowerCase().includes(counselorNameLower))
        ))
      );
      return classMatch || counselorMatch;
    });
  }

  return schoolIsolated;
}

/**
 * Filters class attendance history records according to the counselor's selected classes.
 */
export function filterAttendanceHistory(history: any[], counselor: Counselor): any[] {
  if (!Array.isArray(history)) return [];
  if (!counselor) return [];

  const counselorSchoolId = counselor.schoolId ? sanitizeSchoolId(counselor.schoolId) : getActiveSchoolId();

  const schoolIsolated = history.filter(item => {
    if (!item) return false;
    if (item.schoolId && sanitizeSchoolId(item.schoolId) !== counselorSchoolId) {
      return false;
    }
    return true;
  });

  if (isAdministrator(counselor)) {
    return schoolIsolated;
  }

  const allowed = getAllowedClassesList(counselor);

  if (allowed.length > 0 && !allowed.includes('ALL') && !allowed.includes('SEMUA')) {
    return schoolIsolated.filter(item => {
      const cls = item.class || item.className || item.kelas || '';
      return isClassAllowed(cls, allowed);
    });
  }

  return schoolIsolated;
}

/**
 * Filters the activity feed/logs. Shows logs for selected classes or relevant to this counselor.
 */
export function filterLogs(logs: ActivityLog[], counselor: Counselor): ActivityLog[] {
  if (!Array.isArray(logs)) return [];
  if (!counselor) return [];

  const counselorSchoolId = counselor.schoolId ? sanitizeSchoolId(counselor.schoolId) : getActiveSchoolId();

  const schoolIsolated = logs.filter(log => {
    if (!log) return false;
    if (log.schoolId && sanitizeSchoolId(log.schoolId) !== counselorSchoolId) {
      return false;
    }
    return true;
  });

  if (isAdministrator(counselor)) {
    return schoolIsolated;
  }

  const allowed = getAllowedClassesList(counselor);

  if (allowed.length > 0 && !allowed.includes('ALL') && !allowed.includes('SEMUA')) {
    const counselorNameLower = (counselor.name || '').toLowerCase().trim();
    return schoolIsolated.filter(log => {
      const classMatch = isClassAllowed(log.studentClass, allowed);
      const counselorMatch = Boolean(
        (log.counselorId && log.counselorId === counselor.id) ||
        (counselorNameLower && (
          (log.studentName && log.studentName.toLowerCase().includes(counselorNameLower)) ||
          (log.description && log.description.toLowerCase().includes(counselorNameLower))
        ))
      );
      return classMatch || counselorMatch;
    });
  }

  return schoolIsolated;
}
