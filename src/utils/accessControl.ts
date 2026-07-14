import { Student, ViolationRecord, CounselingService, ActivityLog, Counselor } from '../types';

/**
 * Checks if a specific class is allowed under the counselor's permissions.
 * Empty allowedClasses array means full admin access.
 */
export function isClassAllowed(studentClass: string, allowedClasses: string[]): boolean {
  if (!allowedClasses || allowedClasses.length === 0) return true; // Admin full access
  if (!studentClass) return false;

  // Clean and normalize class names to handle different spacing/casing
  // e.g., "Kelas 8A" -> "8A", "kelas 8a" -> "8A", "8a" -> "8A"
  const cleanClass = studentClass.replace(/kelas\s+/i, '').replace(/\s+/g, '').toUpperCase();

  return allowedClasses.some(allowed => {
    const cleanAllowed = allowed.replace(/kelas\s+/i, '').replace(/\s+/g, '').toUpperCase();
    return cleanClass === cleanAllowed;
  });
}

/**
 * Filters the students array based on the counselor's allowed classes.
 */
export function filterStudents(students: Student[], counselor: Counselor): Student[] {
  if (!counselor || !counselor.allowedClasses || counselor.allowedClasses.length === 0) {
    return students;
  }
  return students.filter(s => isClassAllowed(s.class, counselor.allowedClasses));
}

/**
 * Filters the violations list. Shows violations for allowed students/classes.
 */
export function filterViolations(violations: ViolationRecord[], counselor: Counselor): ViolationRecord[] {
  if (!counselor || !counselor.allowedClasses || counselor.allowedClasses.length === 0) {
    return violations;
  }
  return violations.filter(v => isClassAllowed(v.studentClass, counselor.allowedClasses));
}

/**
 * Filters the counseling services. Shows services for allowed students/classes.
 */
export function filterServices(services: CounselingService[], counselor: Counselor): CounselingService[] {
  if (!counselor || !counselor.allowedClasses || counselor.allowedClasses.length === 0) {
    return services;
  }
  return services.filter(srv => {
    // Show if there is at least one student in the service who is in the counselor's classes
    return srv.students.some(st => isClassAllowed(st.class, counselor.allowedClasses));
  });
}

/**
 * Filters the activity feed/logs. Shows logs for allowed students/classes.
 */
export function filterLogs(logs: ActivityLog[], counselor: Counselor): ActivityLog[] {
  if (!counselor || !counselor.allowedClasses || counselor.allowedClasses.length === 0) {
    return logs;
  }
  return logs.filter(log => isClassAllowed(log.studentClass, counselor.allowedClasses));
}
