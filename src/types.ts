export interface Student {
  id: string;
  nis: string;
  name: string;
  class: string;
  gender: 'L' | 'P';
  violationPoints: number;
  bkServicesCount: number;
  avatarUrl?: string;
  initials: string;
}

export interface ViolationCategory {
  id: string;
  name: string;
  points: number;
}

export interface ViolationRecord {
  id: string;
  ticketId: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  category: string;
  pointsAdded: number;
  date: string;
  time: string;
  location: string;
  reportedBy: string;
  notes: string;
}

export interface CounselingService {
  id: string;
  serviceType: 'Konseling Individu' | 'Konseling Kelompok' | 'Home Visit' | 'Layanan Informasi';
  students: { id: string; name: string; class: string; nis: string }[];
  problem: string;
  description: string;
  output: string;
  followUp: string;
  status: 'Terjadwal' | 'Selesai' | 'Dibatalkan';
  date: string;
  startTime: string;
  endTime: string;
  attachments: { name: string; size: string }[];
}

export interface ActivityLog {
  id: string;
  timeLabel: string; // e.g., "HARI INI, 09:45"
  type: 'counseling' | 'violation' | 'homevisit' | 'attendance';
  title: string;
  description: string;
  studentName: string;
  studentClass: string;
  timestamp: Date;
}

export interface StudentAttendance {
  studentId: string;
  studentName: string;
  nis: string;
  status: 'H' | 'S' | 'I' | 'A';
  notes: string;
}

export interface ClassAttendanceRecord {
  id: string; // e.g., "att-{class}-{date}"
  class: string;
  date: string; // "YYYY-MM-DD"
  records: StudentAttendance[];
  updatedAt: string;
  submittedBy: string; // Counselor name
}
