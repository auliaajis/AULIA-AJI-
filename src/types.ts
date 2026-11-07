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
  schoolId?: string;
  counselorId?: string;
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
  schoolId?: string;
  counselorId?: string;
}

export type BKComponentType =
  | 'Layanan Dasar'
  | 'Peminatan & Perencanaan Individual'
  | 'Layanan Responsif'
  | 'Layanan Dukungan Sistem';

export type BKServiceType =
  // Pilar 1: Layanan Dasar
  | 'Bimbingan Klasikal'
  | 'Bimbingan Kelompok'
  | 'Papan Bimbingan & Media BK'
  | 'Layanan Orientasi'
  | 'Layanan Informasi'
  | 'Layanan Penguasaan Konten'
  | 'Asesmen Kebutuhan (Need Assessment)'
  // Pilar 2: Peminatan & Perencanaan Individual
  | 'Layanan Penempatan dan Penyaluran'
  | 'Peminatan Studi & Ekstrakurikuler'
  | 'Perencanaan Karir & Studi Lanjut'
  | 'Konseling Perencanaan Individual'
  | 'Eksplorasi Bakat & Potensi'
  | 'Portofolio & Rekam Jejak Siswa'
  // Pilar 3: Layanan Responsif
  | 'Layanan Konseling Perorangan (Individual)'
  | 'Layanan Konseling Kelompok'
  | 'Konferensi Kasus (Case Conference)'
  | 'Kunjungan Rumah (Home Visit)'
  | 'Layanan Mediasi'
  | 'Layanan Konsultasi'
  | 'Alih Tangan Kasus (Referral)'
  // Pilar 4: Layanan Dukungan Sistem
  | 'Kolaborasi Guru & Wali Kelas'
  | 'Kemitraan (Puskesmas/Psikolog/Mitra)'
  | 'Manajemen & Administrasi BK'
  | 'Pengembangan Keprofesian (MGBK/PKB)'
  | 'Evaluasi & Supervisi Program';

export type BidangBimbinganType = 'Pribadi' | 'Sosial' | 'Belajar' | 'Karier' | 'Karir' | 'Lintas Bidang' | 'Non-Bidang (Dukungan Sistem)';

export interface ServiceSpecificDetails {
  // Pilar 1: Layanan Dasar
  bidangBimbingan?: BidangBimbinganType;
  aspekSkkpd?: string; // Standar Kompetensi Kemandirian Peserta Didik (11 Aspek)
  tahapCapaian?: 'Pengenalan' | 'Akomodasi' | 'Tindakan' | string; // Tahap Internalization Kemandirian
  metodeLayanan?: string; // e.g., Diskusi, Ceramah Interaktif, Role Playing, dsb.
  mediaLayanan?: string; // e.g., LCD Proyektor, PPT, LKS/LKPD, Video
  evaluasiProses?: string; // Keaktifan & dinamika peserta didik
  evaluasiHasil?: string; // Understanding, Comfort, Action (Laiseg)

  // Pilar 2: Peminatan & Perencanaan Individual
  bidangPeminatan?: string; // e.g., Studi Lanjut SMA/SMK, Jurusan, Profesi
  dasarAsesmen?: string; // Nilai Rapor, Hasil Tes Minat Bakat, Angket AKPD
  potensiKekuatan?: string; // Potensi dominan siswa
  rencanaAksiSiswa?: string; // Langkah konkret / action plan siswa

  // Pilar 3: Layanan Responsif
  akarMasalah?: string; // Faktor pemicu internal/eksternal
  pendekatanKonseling?: string; // CBT, Realitas (WDEP), SFBC, dsb.
  komitmenKonseli?: string; // Komitmen tindakan perubahan diri
  pihakBersengketa?: string; // Untuk Mediasi
  kesepakatanDamai?: string; // Untuk Mediasi
  pesertaKonferensi?: string; // Untuk Konferensi Kasus
  alamatKunjungan?: string; // Untuk Home Visit
  pihakDitemui?: string; // Untuk Home Visit
  hasilObservasiKeluarga?: string; // Untuk Home Visit
  lembagaRujukan?: string; // Untuk Referral
  alasanRujukan?: string; // Untuk Referral
  pihakKonsulti?: string; // Untuk Konsultasi
  rekomendasiKonsultasi?: string; // Untuk Konsultasi

  // Pilar 4: Dukungan Sistem (Kegiatan Manajerial, Keprofesian & Kemitraan Non-Bidang Siswa)
  subAktivitasSistem?: string; // Manajemen Program, PKB/MGBK, Kolaborasi Guru, Kemitraan, Supervisi
  bentukKegiatan?: string; // Rapat Koordinasi, Workshop MGBK, dsb.
  mitraTerlibat?: string; // Pihak/Mitra yang terlibat
  dokumenOutput?: string; // Notulen, MoU, RPL, Laporan
}

export interface CounselingService {
  id: string;
  serviceType: BKServiceType;
  bkComponent?: BKComponentType;
  bidangBimbingan?: BidangBimbinganType;
  focusIssue?: string;
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
  specificDetails?: ServiceSpecificDetails;
  proofPhotoUrl?: string;
  proofPhotoName?: string;
  driveFileId?: string;
  driveViewUrl?: string;
  driveThumbnailUrl?: string;
  counselorId?: string;
  counselorName?: string;
  schoolId?: string;
  linkedViolationId?: string;
  linkedTicketId?: string;
}

export interface PresetServiceData {
  studentIds?: string[];
  serviceType?: BKServiceType;
  bkComponent?: BKComponentType;
  bidangBimbingan?: BidangBimbinganType;
  focusIssue?: string;
  targetType?: 'Individu' | 'Kelompok' | 'Klasikal';
  specificDetails?: ServiceSpecificDetails;
  problem?: string;
  description?: string;
  output?: string;
  followUp?: string;
  status?: 'Terjadwal' | 'Selesai' | 'Dibatalkan';
  scheduleDate?: string;
  startTime?: string;
  endTime?: string;
  linkedViolationId?: string;
  linkedTicketId?: string;
  violationContext?: {
    category: string;
    pointsAdded: number;
    date: string;
    notes?: string;
    ticketId?: string;
    violationId?: string;
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
  schoolId?: string;
  counselorId?: string;
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
  schoolId?: string;
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
  meetingPlace?: string;
  documentNumber?: string;
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
  bidangBimbingan?: BidangBimbinganType;
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
  bidangBimbingan?: BidangBimbinganType;
  purpose: string;
  result: string;
  agreement: string;
  photoUrl?: string; // Base64 or Drive URL or loaded image
  photoName?: string;
  driveFileId?: string;
  driveViewUrl?: string;
  driveThumbnailUrl?: string;
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





