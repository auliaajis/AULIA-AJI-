import { getActiveSchoolId, sanitizeSchoolId, loadSchoolData, saveSchoolData, getSchoolConfig } from './schoolConfig';
import { isDummyRecord } from './purgeDummyData';
import { initialStudents } from '../data/mockData';

export interface PrivacyVerificationReport {
  isSecure: boolean;
  activeSchoolId: string;
  violationsCount: number;
  purgedForeignViolations: number;
  purgedForeignStudents: number;
  details: string[];
}

/**
 * Validates and enforces cross-tenant security and student privacy.
 * Cleanses any foreign or contaminated records from the active school partition.
 */
export function verifyAndEnforceAccountPrivacy(schoolId?: string, counselorId?: string): PrivacyVerificationReport {
  const currentSchoolId = schoolId ? sanitizeSchoolId(schoolId) : getActiveSchoolId();
  const details: string[] = [];
  let purgedForeignViolations = 0;
  let purgedForeignStudents = 0;

  if (typeof localStorage === 'undefined') {
    return {
      isSecure: true,
      activeSchoolId: currentSchoolId,
      violationsCount: 0,
      purgedForeignViolations: 0,
      purgedForeignStudents: 0,
      details: ['Environment has no localStorage']
    };
  }

  const schoolCfg = getSchoolConfig();
  const isSmpSchool = currentSchoolId === 'sch_20320123' ||
    (schoolCfg.schoolName || '').toLowerCase().includes('smp') ||
    (schoolCfg.schoolName || '').toLowerCase().includes('mts') ||
    ((schoolCfg as any).jenjangPendidikan || '').toLowerCase() === 'smp';

  // 1. Ensure unpartitioned baseKeys are safely migrated to the active school partition so no data is ever lost
  const baseKeysToCleanse = ['bk_violations', 'bk_students', 'bk_services', 'bk_logs', 'bk_achievements', 'bk_home_visits'];
  baseKeysToCleanse.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const targetKey = `${key}_${currentSchoolId}`;
          const currentPartitioned = localStorage.getItem(targetKey);
          if (!currentPartitioned || currentPartitioned === '[]') {
            localStorage.setItem(targetKey, raw);
            details.push(`Migrated legacy ${key} to ${targetKey}`);
          }
        }
      } catch (e) {}
    }
  });

  // 2. Sanitize partitioned violations for the active school
  const currentViolations = loadSchoolData<any[]>('bk_violations', [], currentSchoolId);
  if (Array.isArray(currentViolations) && currentViolations.length > 0) {
    let modified = false;
    const cleanViolations = currentViolations.filter((v: any) => {
      if (!v || typeof v !== 'object') return false;

      // Foreign school violation leak detected
      if (v.schoolId && sanitizeSchoolId(v.schoolId) !== currentSchoolId) {
        purgedForeignViolations++;
        modified = true;
        return false;
      }

      // In non-demo school partitions, reject demo mock items or items without verified schoolId
      if (currentSchoolId !== 'sch_20320123') {
        if (isDummyRecord(v, 'bk_violations') || ['v1', 'v2', 'v3'].includes(String(v.id)) || ['PLG-2023-089', 'PLG-2023-090', 'PLG-2023-087'].includes(String(v.ticketId))) {
          purgedForeignViolations++;
          modified = true;
          return false;
        }
      }

      // Purge accidental SMA/Kelas 10 records from SMP school database
      if (isSmpSchool && v.studentClass) {
        const cleanCls = String(v.studentClass).toLowerCase().replace(/kelas\s*/i, '').trim();
        const isSmaClass = cleanCls.startsWith('10') || cleanCls.startsWith('11') || cleanCls.startsWith('12') ||
                           /^x($|[^i])/i.test(cleanCls) || /^xi/i.test(cleanCls) || /^xii/i.test(cleanCls);
        if (isSmaClass) {
          purgedForeignViolations++;
          modified = true;
          return false;
        }
      }

      return true;
    }).map((v: any) => {
      // Ensure records in active partition are strictly stamped with active schoolId
      if (!v.schoolId) {
        modified = true;
        return { ...v, schoolId: currentSchoolId };
      }
      return v;
    });

    if (modified || cleanViolations.length !== currentViolations.length) {
      saveSchoolData('bk_violations', cleanViolations, currentSchoolId);
      details.push(`Sanitized violations: purged ${purgedForeignViolations} foreign/dummy records in ${currentSchoolId}.`);
    }
  }

  // 3. Sanitize partitioned students for the active school
  const currentStudents = loadSchoolData<any[]>('bk_students', [], currentSchoolId);
  if (Array.isArray(currentStudents) && currentStudents.length > 0) {
    let modified = false;
    const cleanStudents = currentStudents.filter((s: any) => {
      if (!s || typeof s !== 'object') return false;

      // Foreign school student leak detected
      if (s.schoolId && sanitizeSchoolId(s.schoolId) !== currentSchoolId) {
        purgedForeignStudents++;
        modified = true;
        return false;
      }

      // Demo student in non-demo school partition detected
      if (currentSchoolId !== 'sch_20320123' && isDummyRecord(s, 'bk_students')) {
        purgedForeignStudents++;
        modified = true;
        return false;
      }

      // Purge accidental SMA/Kelas 10 records from SMP school database
      if (isSmpSchool && s.class) {
        const cleanCls = String(s.class).toLowerCase().replace(/kelas\s*/i, '').trim();
        const isSmaClass = cleanCls.startsWith('10') || cleanCls.startsWith('11') || cleanCls.startsWith('12') ||
                           /^x($|[^i])/i.test(cleanCls) || /^xi/i.test(cleanCls) || /^xii/i.test(cleanCls);
        if (isSmaClass) {
          purgedForeignStudents++;
          modified = true;
          return false;
        }
      }

      return true;
    }).map((s: any) => {
      if (!s.schoolId) {
        modified = true;
        return { ...s, schoolId: currentSchoolId };
      }
      return s;
    });

    if (modified || cleanStudents.length !== currentStudents.length) {
      const isCleared = typeof localStorage !== 'undefined' && localStorage.getItem(`bk_cleared_${currentSchoolId}`) === 'true';
      if (cleanStudents.length === 0 && currentSchoolId === 'sch_20320123' && !isCleared) {
        saveSchoolData('bk_students', initialStudents, currentSchoolId);
        details.push(`Auto-restored 194 canonical students for ${currentSchoolId}.`);
      } else {
        saveSchoolData('bk_students', cleanStudents, currentSchoolId);
        details.push(`Sanitized students: purged ${purgedForeignStudents} foreign/dummy records in ${currentSchoolId}.`);
      }
    }
  } else if (currentSchoolId === 'sch_20320123') {
    const isCleared = typeof localStorage !== 'undefined' && localStorage.getItem('bk_cleared_sch_20320123') === 'true';
    const isBooted = typeof localStorage !== 'undefined' && localStorage.getItem('bk_booted_sch_20320123') === 'true';
    if (!isCleared && !isBooted) {
      localStorage.setItem('bk_booted_sch_20320123', 'true');
      saveSchoolData('bk_students', initialStudents, 'sch_20320123');
      details.push('Seeded initial students for SMP N 2 Susukan.');
    }
  }

  // 4. Sanitize partitioned attendance history for the active school
  const currentAttendance = loadSchoolData<any[]>('bk_attendance_history', [], currentSchoolId);
  if (Array.isArray(currentAttendance) && currentAttendance.length > 0 && isSmpSchool) {
    const cleanAttendance = currentAttendance.filter((rec: any) => {
      if (!rec || typeof rec !== 'object') return false;
      const cls = String(rec.class || rec.className || '').toLowerCase().replace(/kelas\s*/i, '').trim();
      const isSmaClass = cls.startsWith('10') || cls.startsWith('11') || cls.startsWith('12') ||
                         /^x($|[^i])/i.test(cls) || /^xi/i.test(cls) || /^xii/i.test(cls);
      return !isSmaClass;
    });
    if (cleanAttendance.length !== currentAttendance.length) {
      saveSchoolData('bk_attendance_history', cleanAttendance, currentSchoolId);
      details.push(`Sanitized attendance history: purged ${currentAttendance.length - cleanAttendance.length} foreign/SMA records.`);
    }
  }

  // 5. Ensure Aulia Aji Sasongko profile is always intact as Koordinator BK & Administrator
  let currentCounselors = loadSchoolData<any[]>('bk_counselors', [], currentSchoolId);
  if (!Array.isArray(currentCounselors) || currentCounselors.length === 0) {
    saveSchoolData('bk_counselors', [
      {
        id: 'c1',
        name: 'Aulia Aji Sasongko, S.Pd.',
        role: 'Koordinator BK & Administrator Sekolah',
        nip: 'NIP. 19931231 202221 1 002',
        username: 'aulia',
        password: 'aulia',
        email: 'auliasasongko12@guru.smp.belajar.id',
        phone: '089681287339',
        allowedClasses: [],
        schoolId: currentSchoolId,
        schoolNpsn: '20320123',
        schoolName: 'SMP N 2 Susukan'
      }
    ], currentSchoolId);
    currentCounselors = loadSchoolData<any[]>('bk_counselors', [], currentSchoolId);
  }

  if (Array.isArray(currentCounselors) && currentCounselors.length > 0) {
    let counselorModified = false;
    let hasAulia = false;

    const cleanCounselors = currentCounselors.map((c: any) => {
      if (!c) return c;
      const isAulia = c.id === 'c1' || c.username === 'aulia' || (c.name && String(c.name).toLowerCase().includes('aulia')) || (c.email && String(c.email).includes('auliasasongko'));
      if (isAulia) {
        hasAulia = true;
        counselorModified = true;
        return {
          ...c,
          id: 'c1',
          name: 'Aulia Aji Sasongko, S.Pd.',
          role: c.role || 'Koordinator BK & Administrator Sekolah',
          nip: c.nip && c.nip !== '-' ? c.nip : 'NIP. 19931231 202221 1 002',
          username: 'aulia',
          email: 'auliasasongko12@guru.smp.belajar.id',
          phone: c.phone || '089681287339',
          allowedClasses: Array.isArray(c.allowedClasses) ? c.allowedClasses : []
        };
      }
      return c;
    });

    if (!hasAulia) {
      cleanCounselors.unshift({
        id: 'c1',
        name: 'Aulia Aji Sasongko, S.Pd.',
        role: 'Koordinator BK & Administrator Sekolah',
        nip: 'NIP. 19931231 202221 1 002',
        username: 'aulia',
        password: 'aulia',
        email: 'auliasasongko12@guru.smp.belajar.id',
        phone: '089681287339',
        allowedClasses: [],
        schoolId: currentSchoolId,
        schoolNpsn: '20320123',
        schoolName: 'SMP N 2 Susukan'
      });
      counselorModified = true;
    }

    if (counselorModified) {
      saveSchoolData('bk_counselors', cleanCounselors, currentSchoolId);
    }
  }

  const finalViolations = loadSchoolData<any[]>('bk_violations', [], currentSchoolId);

  return {
    isSecure: true,
    activeSchoolId: currentSchoolId,
    violationsCount: Array.isArray(finalViolations) ? finalViolations.length : 0,
    purgedForeignViolations,
    purgedForeignStudents,
    details
  };
}
