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
  handledBy?: 'Belum Ditangani' | 'Wali Kelas' | 'Guru BK' | 'Wali Kelas & Guru BK';
  handlingProgress?: string; // Penanganan sejauh apa
  proofPhotoUrl?: string;
  proofPhotoName?: string;
}

export type BKServiceType =
  | 'Layanan Orientasi'
  | 'Layanan Informasi'
  | 'Layanan Penempatan dan Penyaluran'
  | 'Layanan Penguasaan Konten'
  | 'Layanan Konseling Perorangan (Individual)'
  | 'Layanan Bimbingan Kelompok'
  | 'Layanan Konseling Kelompok'
  | 'Layanan Konsultasi'
  | 'Layanan Mediasi';

export interface CounselingService {
  id: string;
  serviceType: BKServiceType;
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
  targetType?: 'Individu' | 'Kelompok' | 'Klasikal';
  proofPhotoUrl?: string;
  proofPhotoName?: string;
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

export interface Counselor {
  id: string;
  name: string;
  role: string;
  nip: string;
  avatar: string;
  allowedClasses: string[];
}

export interface BKJournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  activityType: 'Bimbingan Klasikal' | 'Konsultasi Orang Tua' | 'Rapat Koordinasi' | 'Administrasi BK' | 'Kasus Mendesak' | 'Lain-lain';
  title: string;
  description: string;
  target: string;
  status: 'Selesai' | 'Perlu Tindak Lanjut' | 'Dalam Proses';
  counselorId: string;
  createdAt: string;
  proofPhotoUrl?: string;
  proofPhotoName?: string;
}

export interface ParentSummon {
  id: string;
  letterNumber: string;
  date: string; // YYYY-MM-DD (tanggal surat dibuat)
  studentId: string;
  studentName: string;
  studentClass: string;
  studentNis: string;
  parentName: string;
  summonDate: string; // YYYY-MM-DD (tanggal kehadiran orang tua)
  summonTime: string; // HH:MM
  summonPlace: string;
  agenda: string;
  counselorId: string;
  status: 'Terkirim' | 'Hadir' | 'Batal' | 'Penjadwalan Ulang';
  createdAt: string;
}

export interface HomeVisitRecord {
  id: string;
  reportNumber: string; // e.g., "HV-2026-104"
  date: string; // YYYY-MM-DD
  studentId: string;
  studentName: string;
  studentClass: string;
  studentNis: string;
  parentNameMet: string;
  address: string;
  purpose: string;
  result: string;
  agreement: string;
  photoUrl?: string; // Base64 or Unsplash fallback or loaded image
  photoName?: string;
  parentSignature?: string; // Base64 signature image
  counselorSignature?: string; // Base64 signature image
  counselorName: string;
  counselorId: string;
  createdAt: string;
}


