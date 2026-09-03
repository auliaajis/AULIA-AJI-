export interface Student {
  id: string;
  nis: string;
  nisn?: string;
  name: string;
  class: string;
  gender: 'L' | 'P';
  violationPoints: number;
  bkServicesCount: number;
  achievementPoints?: number; // Bobot penghargaan / apresiasi yang diperoleh siswa
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

export interface PresetServiceData {
  studentIds?: string[];
  serviceType?: BKServiceType;
  targetType?: 'Individu' | 'Kelompok' | 'Klasikal';
  problem?: string;
  description?: string;
  output?: string;
  followUp?: string;
  status?: 'Terjadwal' | 'Selesai' | 'Dibatalkan';
  scheduleDate?: string;
  startTime?: string;
  endTime?: string;
  violationContext?: {
    category: string;
    pointsAdded: number;
    date: string;
    notes?: string;
    ticketId?: string;
  };
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
  email?: string;
  phone?: string;
  username?: string;
  password?: string;
  isBlocked?: boolean;
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  registeredAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  schoolId?: string;
  schoolNpsn?: string;
  schoolName?: string;
}

export interface BKJournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  activityType: 'Bimbingan Klasikal' | 'Kegiatan Mengajar Mata Pelajaran' | 'Konsultasi Orang Tua' | 'Rapat Koordinasi' | 'Administrasi BK' | 'Kasus Mendesak' | 'Lain-lain';
  title: string;
  description: string;
  target: string;
  status: 'Selesai' | 'Perlu Tindak Lanjut' | 'Dalam Proses';
  counselorId: string;
  createdAt: string;
  proofPhotoUrl?: string;
  proofPhotoName?: string;
  absentStudents?: string;
}

export interface ParentAttendanceDetails {
  actualDate: string;
  actualTime: string;
  attendeeName: string;
  attendeeRelation: string; // e.g. Ibu Kandung, Ayah Kandung, Wali
  phone?: string;
  counselorName: string;
  issuesDiscussed: string;
  agreements: string;
  parentCommitment: string;
  studentCommitment: string;
  followUpPlan: string;
  notes?: string;
  parentSignatureBase64?: string;
  counselorSignatureBase64?: string;
  documentedAt: string;
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
  attendanceDetails?: ParentAttendanceDetails;
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

export interface StudentAchievement {
  id: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  achievementName: string;
  pointsReward: number;
  date: string;
  time: string;
  notes: string;
  category: string;
  recordedBy: string;
  extraNotes?: string;
}

export interface SuratPerjanjianRecord {
  id: string;
  type: 'perjanjian';
  letterNumber: string;
  date: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  studentNis: string;
  parentName: string;
  parentJob?: string;
  parentPhone?: string;
  violationSummary: string;
  agreementPoints: string[];
  consequences: string;
  status: 'Aktif' | 'Selesai' | 'Terlanggar';
  studentSignatureBase64?: string;
  parentSignatureBase64?: string;
  counselorSignatureBase64?: string;
  witnessHomeroomTeacher?: string;
  counselorName: string;
  createdAt: string;
}

export interface KontrakPerilakuRecord {
  id: string;
  type: 'kontrak';
  contractNumber: string;
  startDate: string;
  endDate: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  studentNis: string;
  targetBehavior: string;
  agreedPositiveBehaviors: string[];
  rewards: string;
  sanctions: string;
  reviewPeriod: string;
  evaluator: string;
  status: 'Aktif' | 'Berhasil' | 'Perlu Evaluasi';
  studentSignatureBase64?: string;
  counselorSignatureBase64?: string;
  witnessHomeroomTeacher?: string;
  counselorName: string;
  createdAt: string;
}

export interface JurnalPembinaanDisiplinRecord {
  id: string;
  journalNumber: string;
  date: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  studentNis: string;
  location?: string;
  counselingType?: string;
  problemDescription: string;
  counselingApproach: string;
  restitutionAgreement: string;
  evaluationPlan: string;
  counselorName: string;
  status: 'Proses Pembinaan' | 'Selesai / Teratasi';
  createdAt: string;
}

export interface KomitmenRtlRecord {
  id: string;
  commitmentNumber: string;
  date: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  studentNis: string;
  personalCommitment: string;
  actionSteps: string[];
  successIndicators: string;
  supportNeeded: string;
  reviewDate?: string;
  counselorName: string;
  createdAt: string;
}

export interface StickyNote {
  id: string;
  title?: string;
  content: string;
  color: 'yellow' | 'teal' | 'purple' | 'amber' | 'blue';
  isPinned?: boolean;
  isCompleted?: boolean;
  dateStr?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TeachingScheduleItem {
  id: string;
  day: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';
  period: string; // e.g. "Jam ke 1-2"
  timeRange: string; // e.g. "07:30 - 08:50"
  className: string; // e.g. "Kelas 7A"
  subject: string; // e.g. "Bimbingan Klasikal / Layanan BK"
  room?: string;
}

export interface ClassTeachingProgress {
  className: string;
  lastDate: string; // YYYY-MM-DD
  lastTopic: string; // e.g. "Bab 2: Etika Menggunakan Media Sosial (s.d Hal 24)"
  nextTopicPlan?: string; // Plan for next session
  notes?: string;
  updatedAt: string;
}

export interface ParentSummonTemplate {
  id: string;
  title: string;
  category: 'Kedisiplinan' | 'Akademik' | 'Sosial & Perilaku' | 'Karir / Masa Depan' | 'Keluarga & Kehadiran' | 'Lainnya';
  agenda: string;
  place: string;
  waMessageTemplate: string;
  suggestedAgreements?: string;
  isCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
}





