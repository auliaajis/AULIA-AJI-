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
  schoolName?: string;
  counselorId?: string;
  isLegacyUnmigrated?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
}

export interface SchoolDocument {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolAddress: string;
  npsn?: string;
  principalName?: string;
  principalNip?: string;
  koordinatorBkName?: string;
  koordinatorBkNip?: string;
  governmentName?: string;
  departmentName?: string;
  jenjang?: string;
  statusSekolah?: string;
  akreditasi?: string;
  tahunAjaran?: string;
  semester?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  isActive?: boolean;
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
  restitutionStatus?: RestitutionStatusType;
  restitutionAgreement?: string; // Isi Kesepakatan
  restitutionDeadline?: string; // Deadline
  restitutionSupervisor?: string; // Nama Pemantau
  restitutionCompletedDate?: string; // Tanggal Selesai
  proofPhotoUrl?: string;
  proofPhotoName?: string;
  pdfUrl?: string;
  driveFileId?: string;
  pdfFileName?: string;
  pdfGeneratedAt?: any;
  schoolId?: string;
  schoolName?: string;
  counselorId?: string;
  nis?: string;
  reportedVia?: string;
  source?: string;
  reporterRole?: string;
  specificBehaviors?: string[] | string;
  perilakuSpesifik?: string[] | string;
  behaviorChips?: string[] | string;
  selectedBehaviors?: string[] | string;
  behaviors?: string[] | string;
  piketNotes?: string;
  pembinaanDate?: string;
  pembinaanKronologi?: string;
  pembinaanResult?: string;
  pembinaanFollowUpPlan?: string;
  pembinaanStatus?: 'Proses' | 'Selesai';
  pembinaanCounselor?: string;
  migratedAt?: string | null;
  createdAt?: string | number;
  updatedAt?: string | number;
  isLegacyUnmigrated?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
}

// Aliases for multi-school collection mappings
export type CaseRecord = ViolationRecord;

export type RestitutionStatusType = 'Baru Dicatat' | 'Sudah Konseling' | 'Proses Restitusi' | 'Selesai / Dipantau';

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
  | 'Observasi & Wawancara'
  // Pilar 4: Layanan Dukungan Sistem
  | 'Kolaborasi Guru & Wali Kelas'
  | 'Kemitraan (Puskesmas/Psikolog/Mitra)'
  | 'Manajemen & Administrasi BK'
  | 'Pengembangan Keprofesian (MGBK/PKB)'
  | 'Evaluasi & Supervisi Program';

export type BidangBimbinganType = 'Pribadi' | 'Sosial' | 'Belajar' | 'Karier' | 'Karir' | 'Lintas Bidang' | 'Non-Bidang (Dukungan Sistem)';

export interface ServiceKelompokParticipant {
  id: string;
  studentId?: string;
  nama: string;
  kelas?: string;
  peran: 'Dominan' | 'Aktif' | 'Pendiam' | 'Pasif';
  keterbukaan: number; // 1-5
  kesepakatanSiswa: string;
}

export interface ServiceMediasiDetails {
  pihak1Nama: string;
  pihak2Nama: string;
  versiPihak1: string;
  versiPihak2: string;
  titikKonflikUtama: string;
  statusMediasi: 'Sepakat' | 'Tidak Sepakat';
  kesepakatanBersama?: string;
  alasanTidakSepakat?: string;
  rencanaBerikutnya?: string;
}

export interface ServiceKlasikalDetails {
  kelas: string;
  jumlahHadir: number;
  totalSiswa: number;
  topikKlasikal: string;
  dinamikaKelas: 'Aktif' | 'Pasif' | 'Gaduh' | 'Campuran';
  responSiswa: string;
}

export interface ServiceObservasiWawancaraReferalDetails {
  subJenis: 'Observasi' | 'Wawancara' | 'Referal';
  yangDiamati?: string;
  tempat?: string;
  durasi?: string;
  hasilPengamatan?: string;
  diwawancarai?: 'Siswa' | 'Guru' | 'Orang Tua';
  pertanyaanKunci?: string;
  ringkasanJawaban?: string;
  alasanDirujuk?: string;
  dirujukKe?: 'Psikolog' | 'Puskesmas' | 'Pihak Luar';
  statusRujukan?: 'Menunggu' | 'Sudah Ditemui' | 'Selesai';
}

export interface ServiceStandardBlokA {
  tanggal?: string;
  jam?: string;
  tempat?: string;
  pertemuanKe?: number;
  sifatLayanan?: 'Baru' | 'Lanjutan' | 'Sukarela' | 'Rujukan';
}

export interface ServiceStandardBlokB {
  jenisMasalah: EvaluationJenisMasalah;
  alasanMasalahLainnya?: string;
  tujuanLayanan: EvaluationTujuanType;
  teknik: EvaluationTeknikType;
  baseline: ServiceEvaluationBaseline;
  layananKeBerapa?: number;
}

export interface ServiceStandardBlokD {
  kesepakatan: string;
  tindakLanjutApa: string;
  tindakLanjutTanggal: string;
  penanggungJawab: string;
  statusTindakLanjut: EvaluationFollowUpStatus;
}

export interface ServiceIndividualDetails {
  uraianMasalah: string;
  prosesPendekatan: string;
  responSiswa: string;
  teknikPendekatan?: string[];
  hasilKategori?: 'Paham Masalah' | 'Temukan Solusi' | 'Komitmen Perubahan' | 'Perlu Lanjut' | 'Dirujuk';
  jaminanKerahasiaan?: boolean;
}

export interface ServiceHomeVisitDetails {
  yangDitemui: 'Ayah' | 'Ibu' | 'Wali' | 'Lainnya';
  yangDitemuiLainnya?: string;
  namaOrtu?: string;
  noHpOrtu?: string;
  alamat?: string;
  kondisiRumahSingkat: string;
  hasilPembicaraan: string;
  kesepakatanOrtu: string;
  statusKunjungan?: 'Berhasil Ditemui' | 'Rumah Kosong' | 'Ditolak';
  fotoBukti?: string;
  fotoBuktiUrl?: string;
  fotoName?: string;
}

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

  // Template Standar Blok A/B/C/D (Semua 7 Layanan Terstandar)
  blokA?: ServiceStandardBlokA;
  blokB?: ServiceStandardBlokB;
  blokC?: {
    individual?: ServiceIndividualDetails;
    homeVisit?: ServiceHomeVisitDetails;
    kelompokParticipants?: ServiceKelompokParticipant[];
    kelompokRingkasanProses?: string;
    kelompokKomitmenBersama?: string;
    mediasi?: ServiceMediasiDetails;
    klasikal?: ServiceKlasikalDetails;
    observasiWawancaraReferal?: ServiceObservasiWawancaraReferalDetails;
  };
  individual?: ServiceIndividualDetails;
  homeVisit?: ServiceHomeVisitDetails;
  kelompokParticipants?: ServiceKelompokParticipant[];
  kelompokRingkasanProses?: string;
  kelompokKomitmenBersama?: string;
  mediasi?: ServiceMediasiDetails;
  klasikal?: ServiceKlasikalDetails;
  observasiWawancaraReferal?: ServiceObservasiWawancaraReferalDetails;
  tindakLanjutPlan?: ServiceStandardBlokD;
  aiContextualRecommendation?: string;
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
  pdfUrl?: string;
  pdfFileName?: string;
  pdfGeneratedAt?: any;
  counselorId?: string;
  counselorName?: string;
  schoolId?: string;
  schoolName?: string;
  linkedViolationId?: string;
  linkedTicketId?: string;
  isLegacyUnmigrated?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
}

export type CounselingRecord = CounselingService;

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
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
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
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
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

export type UserRecord = Counselor;

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
  schoolId?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
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
  schoolId?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
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
  schoolId?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
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
  schoolId?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
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
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
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
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
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
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
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
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
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

export type EvaluationBidangType =
  | 'Layanan Dasar'
  | 'Layanan Responsif'
  | 'Perencanaan Individual'
  | 'Dukungan Sistem'
  | string;

export type EvaluationFollowUpStatus =
  | 'Belum Dikerjakan'
  | 'Sedang Berjalan'
  | 'Selesai'
  | 'Tidak Berhasil'
  | 'Sudah Ditindaklanjuti'
  | 'Masih Berjalan'
  | 'Perlu Rujukan';

export type EvaluationJenisMasalah =
  | 'Terlambat'
  | 'Bolos'
  | 'Konflik Teman'
  | 'Motivasi Belajar Rendah'
  | 'Kecemasan'
  | 'Keluarga'
  | 'Disiplin'
  | 'Perencanaan Karir'
  | 'Lainnya'
  | string;

export type EvaluationTeknikType =
  | 'Konseling Individual'
  | 'Konseling Kelompok'
  | 'Bimbingan Klasikal'
  | 'Mediasi'
  | 'Observasi'
  | 'Wawancara'
  | 'Home Visit'
  | 'Referal'
  | string;

export type EvaluationTujuanType =
  | 'Memahami Masalah'
  | 'Mengubah Perilaku'
  | 'Memberi Dukungan'
  | 'Merencanakan Masa Depan'
  | 'Menyelesaikan Konflik'
  | string;

export interface EvaluationEvidenceFile {
  name: string;
  dataUrl: string;
  type?: string;
  sizeLabel?: string;
}

export interface ServiceEvaluationBaseline {
  keparahan: number; // 1-5
  frekuensi: number; // 1-5
  motivasiAwal: number; // 1-5
  baselineDariIngatan: true;
  skorKondisiAwal?: number; // 1-5 normalized positive composite
}

export interface ServiceEvaluation6Scores {
  ketercapaianTujuan: number; // 1-5
  perubahanPerilaku: number; // 1-5
  keterlibatanSiswa: number; // 1-5
  keterbukaanSiswa: number; // 1-5
  kesesuaianTeknik: number; // 1-5
  kesiapanTindakLanjut: number; // 1-5
  totalSkor: number; // 6-30
  rataRata: number; // 1.0 - 5.0
  kategori: string;
}

export interface ServiceEvaluationAiAnalysis {
  interpretasiKontekstual: string;
  kekuatanSpesifik: string;
  areaPerbaikanSpesifik: string;
  rekomendasiTindakLanjut: {
    apa: string;
    kapan: string;
    siapa: string;
    teknik: string;
    ringkasan: string;
  };
  generatedAt?: string;
}

export interface ServiceEvaluationFollowUpCheck {
  skorPerubahanSekarang: number; // 1-5
  masalahBerulang: boolean;
  delta: number; // Follow-up - Baseline
  checkedAt: string;
  catatan?: string;
}

export interface ProgramBidangEvaluationItem {
  bidang: EvaluationBidangType;
  totalServices: number;
  evaluatedCount?: number;
  unevaluatedCount?: number;
  totalStudentsUnique: number;
  inPeriodCount: number;
  outsidePeriodCount: number;
  target: number | null;
  realisasi: number;
  nilai: number;
  rata6Skor?: number;
  kondisiAwal: string;
  kondisiSetelah: string;
  activityTitles: string[];
}

export interface ProgramProblemMetricItem {
  jenisMasalah: string;
  totalEvaluasi: number;
  rataRataSkor: number;
  rataRataBaseline: number;
  rataRataDelta: number | null;
  persenSelesai: number;
  teknikDominan: string;
}

export interface ProgramTechniqueMetricItem {
  teknik: string;
  totalEvaluasi: number;
  rataRataSkor: number;
  persenSelesai: number;
}

export interface ProgramAiPerProblemItem {
  jenisMasalah: string;
  ringkasanEvaluasi: string;
  rekomendasiStrategis: string;
}

export type CaseFinalStatus =
  | 'Tuntas'
  | 'Masih Berproses'
  | 'Dirujuk ke Psikolog / Pihak Luar'
  | 'Tidak Tertangani';

export type CaseUnresolvedReason =
  | 'Siswa Pindah'
  | 'Orang Tua Menolak'
  | 'Di Luar Kewenangan BK'
  | string;

export type NeedDeterminationMethod =
  | 'Angket Siswa'
  | 'Observasi Wali Kelas'
  | 'Data Tahun Lalu'
  | 'Perkiraan Guru BK'
  | string;

export type FokusUtamaTahunan =
  | 'Mengurangi Bolos'
  | 'Menangani Konflik Teman'
  | 'Meningkatkan Motivasi Belajar'
  | 'Mengurangi Kecemasan';

export interface RencanaTahunanData {
  tahunAjaran: string;
  jamPerMinggu: number;
  jumlahKelas: number;
  fokusUtama: FokusUtamaTahunan;
  mingguEfektif: number; // 36 (52 - 14 libur/ujian)
  pertemuanPerKelas: number; // jam * 36
  totalKlasikal: number; // pertemuan * jumlahKelas
  perSemester: number; // floor(totalKlasikal / 2)
  targetRealistis90: number; // floor(totalKlasikal * 0.9)
  targetLayananDasar: number;
  targetLayananResponsif: number;
  targetPerencanaanIndividual: number;
  targetDukunganSistem: number;
  totalTarget: number;
  isOverloaded: boolean;
  aiNote: string;
  updatedAt?: string;
}

export interface InitialProgramNeedPlan {
  kebutuhanUtama: string[]; // 1-2 items
  caraMenentukan: NeedDeterminationMethod;
  catatanAwal?: string;
  updatedAt?: string;
}

export interface ProgramStakeholderVoices {
  suaraSiswa?: string;
  suaraWaliKelas?: string;
  suaraKepsekOrtu?: string;
}

export interface CounselorSemesterReflection {
  teknikBerhasil?: string;
  teknikGagalDiubah?: string;
  kendalaTerbesar?:
    | 'Waktu'
    | 'Beban Mengajar'
    | 'Dukungan Wali Kelas'
    | 'Ruang Konseling'
    | 'Jadwal Bentrok'
    | 'Banyak Layanan Belum Dievaluasi'
    | 'Lainnya'
    | string;
  kendalaPenjelas?: string;
}

export interface NextSemesterImprovementPlan {
  lanjutkan: string;
  hentikan: string;
  ubah: string;
  butuhDukungan: string;
}

export interface CaseStatusSummary {
  totalKasus: number;
  tuntas: number;
  masihBerproses: number;
  dirujuk: number;
  tidakTertangani: number;
}

export interface ProgramEvaluation {
  id: string;
  serviceId: string;
  bidang: EvaluationBidangType;
  namaProgram: string;
  kelas: string;
  target: number | null;
  realisasi: number;
  kondisiAwal: string;
  kondisiSetelah: string;
  hasil: string;
  kendala: string;
  tindakLanjut: string;
  tanggalTindakLanjut: string;
  penanggungJawabTindakLanjut?: string;
  statusTindakLanjut: EvaluationFollowUpStatus;
  nilai: number;
  feedbackSiswaNilai: number;
  feedbackSiswaKomentar: string;
  feedbackWaliNama: string;
  feedbackWaliKomentar: string;
  buktiFoto: (EvaluationEvidenceFile | string)[];
  tanggal: string;
  createdBy: string;
  evaluationScope?: 'program' | 'layanan' | 'kebutuhan-awal' | 'rencana-tahunan';

  // Evaluasi Layanan structured context + baseline + 6 scores + 14-day follow-up + AI
  jenisMasalah?: EvaluationJenisMasalah;
  alasanMasalahLainnya?: string;
  teknikDipakai?: EvaluationTeknikType;
  tujuanLayanan?: EvaluationTujuanType;
  baseline?: ServiceEvaluationBaseline;
  baselineDariIngatan?: boolean;
  scores6?: ServiceEvaluation6Scores;
  isKlasikalEvaluation?: boolean;
  layananKeBerapa?: number;
  aiAnalysis?: ServiceEvaluationAiAnalysis;
  followUpCheck?: ServiceEvaluationFollowUpCheck;

  // Lapisan 3: Status Akhir Kasus pada Evaluasi Layanan (dapat diubah kapan saja)
  statusAkhirKasus?: CaseFinalStatus;
  alasanTidakTertangani?: CaseUnresolvedReason;

  // Rencana Program Tahunan (Kalkulasi AI, Tanpa Asesmen Awal) + Lapisan Evaluasi
  rencanaTahunan?: RencanaTahunanData;
  kebutuhanAwal?: InitialProgramNeedPlan;
  suaraStakeholder?: ProgramStakeholderVoices;
  refleksiKonselor?: CounselorSemesterReflection;
  rencanaPerbaikan?: NextSemesterImprovementPlan;

  // Evaluasi Program aggregated strictly from Evaluasi Layanan
  bidangList?: ProgramBidangEvaluationItem[];
  programMetrics?: {
    totalServicesInPeriod: number;
    servicesTerlaksana?: number;
    servicesDibatalkan?: number;
    servicesTerjadwal?: number;
    evaluatedServicesCount: number;
    unevaluatedServicesCount: number;
    rataRataDeltaFollowUp: number | null;
    followUpCheckedCount: number;
    pendingFollowUpCount: number;
    persenTindakLanjutSelesai: number;
    byJenisMasalah: ProgramProblemMetricItem[];
    byTeknik: ProgramTechniqueMetricItem[];
    caseSummary?: CaseStatusSummary;
  };
  aiProgramPerMasalah?: ProgramAiPerProblemItem[];
  aiCompletenessNotice?: string;
  aiPerbandinganKebutuhan?: string;
  aiEvaluasiStakeholder?: string;
  aiInterpretasiKasus?: string;
  aiEvaluasiRefleksi?: string;

  aggregatedSummary?: {
    totalServices: number;
    totalStudentsServed: number;
    totalServicesRead?: number;
    inPeriodCount?: number;
    outsidePeriodCount?: number;
    unclassifiedCount?: number;
    syncedAt?: string;
    activityTitles: string[];
  };
  jenisLayanan?: string;
  guruBk?: string;
  semester?: 'Ganjil' | 'Genap';
  tahunAjaran?: string;
  schoolId?: string;
  schoolName?: string;
  counselorId?: string;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
}

export type ServiceEvaluation = ProgramEvaluation;

export interface HapusLogEntry {
  id: string;
  idSiswa?: string;
  recordId: string;
  localKey: string;
  entityType: string;
  nama: string;
  kelas?: string;
  tanggalHapus: string;
  oleh: string;
  alasan: string;
  schoolId?: string;
  restoredAt?: string;
  permanentlyDeleted?: boolean;
}








