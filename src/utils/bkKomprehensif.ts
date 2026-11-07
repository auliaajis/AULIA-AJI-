import {
  Compass,
  Users,
  BookOpen,
  Target,
  Briefcase,
  GraduationCap,
  Sparkles,
  ShieldAlert,
  HeartHandshake,
  MessageSquare,
  HelpCircle,
  Home,
  Network,
  Settings,
  Scale,
  Building2,
  FileCheck,
  Award,
  Layers,
  CheckCircle2,
  UserCheck,
  UserPlus,
  LucideIcon
} from 'lucide-react';
import { BKComponentType, BKServiceType } from '../types';

export interface BKComponentDefinition {
  id: BKComponentType;
  pilarNumber: number;
  name: string;
  category: 'LAYANAN UNTUK PENGEMBANGAN POTENSI' | 'PENANGANAN ISU DAN PENGUATAN SISTEM';
  definition: string;
  badgeLabel: string;
  color: {
    primary: string;
    lightBg: string;
    border: string;
    text: string;
    accent: string;
    ring: string;
  };
  services: {
    type: BKServiceType;
    label: string;
    shortDesc: string;
    icon: LucideIcon;
    defaultTarget: 'Individu' | 'Kelompok' | 'Klasikal';
  }[];
}

export const BK_COMPONENTS_DATA: BKComponentDefinition[] = [
  // PILAR 1: LAYANAN DASAR
  {
    id: 'Layanan Dasar',
    pilarNumber: 1,
    name: 'Layanan Dasar',
    category: 'LAYANAN UNTUK PENGEMBANGAN POTENSI',
    definition: 'Layanan preventif bagi semua siswa untuk mengembangkan pemahaman diri dan keterampilan sosial-emosional.',
    badgeLabel: 'Pilar 1 • Preventif',
    color: {
      primary: '#00685f',
      lightBg: 'bg-[#e6f4f1]',
      border: 'border-[#00685f]/30',
      text: 'text-[#00685f]',
      accent: 'bg-teal-500',
      ring: 'ring-[#00685f]/30',
    },
    services: [
      {
        type: 'Bimbingan Klasikal',
        label: 'Bimbingan Klasikal',
        shortDesc: 'Layanan terencana tatap muka di kelas untuk seluruh peserta didik',
        icon: Users,
        defaultTarget: 'Klasikal',
      },
      {
        type: 'Bimbingan Kelompok',
        label: 'Bimbingan Kelompok',
        shortDesc: 'Dinamika kelompok kecil untuk mengembangkan potensi & empati',
        icon: Users,
        defaultTarget: 'Kelompok',
      },
      {
        type: 'Papan Bimbingan & Media BK',
        label: 'Papan Bimbingan & Media',
        shortDesc: 'Publikasi infografis, modul, dan media bimbingan interaktif',
        icon: BookOpen,
        defaultTarget: 'Klasikal',
      },
      {
        type: 'Layanan Orientasi',
        label: 'Layanan Orientasi',
        shortDesc: 'Pengenalan lingkungan sekolah & adaptasi budaya belajar',
        icon: Compass,
        defaultTarget: 'Klasikal',
      },
      {
        type: 'Layanan Informasi',
        label: 'Layanan Informasi',
        shortDesc: 'Pemberian informasi pendidikan, sosial, dan wawasan diri',
        icon: Sparkles,
        defaultTarget: 'Klasikal',
      },
      {
        type: 'Layanan Penguasaan Konten',
        label: 'Penguasaan Konten Belajar',
        shortDesc: 'Pengembangan metode belajar efektif, literasi, & manajemen waktu',
        icon: BookOpen,
        defaultTarget: 'Kelompok',
      },
      {
        type: 'Asesmen Kebutuhan (Need Assessment)',
        label: 'Asesmen Kebutuhan',
        shortDesc: 'Pemetaan AKPD, sosiometri, dan profil diagnostik awal siswa',
        icon: FileCheck,
        defaultTarget: 'Klasikal',
      },
    ],
  },

  // PILAR 2: PEMINATAN & PERENCANAAN INDIVIDUAL
  {
    id: 'Peminatan & Perencanaan Individual',
    pilarNumber: 2,
    name: 'Peminatan & Perencanaan Individual',
    category: 'LAYANAN UNTUK PENGEMBANGAN POTENSI',
    definition: 'Membantu siswa mengenali minat, bakat, serta merencanakan kelanjutan studi dan karir masa depan.',
    badgeLabel: 'Pilar 2 • Masa Depan',
    color: {
      primary: '#1d4ed8',
      lightBg: 'bg-blue-50',
      border: 'border-blue-300',
      text: 'text-blue-700',
      accent: 'bg-blue-600',
      ring: 'ring-blue-300',
    },
    services: [
      {
        type: 'Layanan Penempatan dan Penyaluran',
        label: 'Penempatan & Penyaluran',
        shortDesc: 'Penyaluran peminatan ekskul, peminatan mata pelajaran & potensi',
        icon: Briefcase,
        defaultTarget: 'Individu',
      },
      {
        type: 'Peminatan Studi & Ekstrakurikuler',
        label: 'Peminatan & Ekstrakurikuler',
        shortDesc: 'Pendampingan pemilihan jurusan, bakat khusus, dan klub minat',
        icon: Target,
        defaultTarget: 'Individu',
      },
      {
        type: 'Perencanaan Karir & Studi Lanjut',
        label: 'Perencanaan Karir & Studi Lanjut',
        shortDesc: 'Eksplorasi cita-cita, profil profesi, dan sekolah lanjutan',
        icon: GraduationCap,
        defaultTarget: 'Individu',
      },
      {
        type: 'Konseling Perencanaan Individual',
        label: 'Konseling Perencanaan Individual',
        shortDesc: 'Sesi tatap muka khusus pemetaan cita-cita dan rencana karir',
        icon: UserCheck,
        defaultTarget: 'Individu',
      },
      {
        type: 'Eksplorasi Bakat & Potensi',
        label: 'Eksplorasi Bakat & Potensi',
        shortDesc: 'Identifikasi kecerdasan majemuk dan keunikan pribadi',
        icon: Sparkles,
        defaultTarget: 'Individu',
      },
      {
        type: 'Portofolio & Rekam Jejak Siswa',
        label: 'Portofolio Rekam Jejak',
        shortDesc: 'Penyusunan portofolio prestasi dan peta kemajuan belajar',
        icon: Award,
        defaultTarget: 'Individu',
      },
    ],
  },

  // PILAR 3: KONSELING & RESPONSIF
  {
    id: 'Layanan Responsif',
    pilarNumber: 3,
    name: 'Konseling',
    category: 'PENANGANAN ISU DAN PENGUATAN SISTEM',
    definition: 'Pemberian bantuan segera dan konseling tatap muka untuk masalah mendesak seperti konflik, perundungan, atau kesulitan siswa.',
    badgeLabel: 'Konseling • Bantuan Segera',
    color: {
      primary: '#d97706',
      lightBg: 'bg-amber-50',
      border: 'border-amber-300',
      text: 'text-amber-800',
      accent: 'bg-amber-500',
      ring: 'ring-amber-300',
    },
    services: [
      {
        type: 'Layanan Konseling Perorangan (Individual)',
        label: 'Konseling Individual',
        shortDesc: 'Sesi tatap muka personal pengentasan masalah emosional & perilaku',
        icon: HeartHandshake,
        defaultTarget: 'Individu',
      },
      {
        type: 'Layanan Konseling Kelompok',
        label: 'Konseling Kelompok',
        shortDesc: 'Pengentasan masalah bersama melalui dinamika terapeutik kelompok',
        icon: MessageSquare,
        defaultTarget: 'Kelompok',
      },
      {
        type: 'Konferensi Kasus (Case Conference)',
        label: 'Rapat Kasus (Konferensi Kasus)',
        shortDesc: 'Pertemuan khusus bersama wali kelas, orang tua, & kepala sekolah',
        icon: Scale,
        defaultTarget: 'Individu',
      },
      {
        type: 'Kunjungan Rumah (Home Visit)',
        label: 'Kunjungan Rumah (Home Visit)',
        shortDesc: 'Kunjungan langsung ke keluarga siswa untuk klarifikasi & dukungan',
        icon: Home,
        defaultTarget: 'Individu',
      },
      {
        type: 'Layanan Mediasi',
        label: 'Mediasi & Advokasi Konflik',
        shortDesc: 'Penyelesaian perselisihan, peredaan konflik dan pemulihan relasi',
        icon: ShieldAlert,
        defaultTarget: 'Kelompok',
      },
      {
        type: 'Layanan Konsultasi',
        label: 'Konsultasi Guru & Orang Tua',
        shortDesc: 'Diskusi pemecahan masalah siswa bersama orang tua / wali kelas',
        icon: HelpCircle,
        defaultTarget: 'Individu',
      },
      {
        type: 'Alih Tangan Kasus (Referral)',
        label: 'Alih Tangan Kasus (Referral)',
        shortDesc: 'Rujukan ke psikolog, puskesmas, psikiater, atau ahli hukum',
        icon: UserPlus,
        defaultTarget: 'Individu',
      },
    ],
  },

  // PILAR 4: LAYANAN DUKUNGAN SISTEM
  {
    id: 'Layanan Dukungan Sistem',
    pilarNumber: 4,
    name: 'Layanan Dukungan Sistem',
    category: 'PENANGANAN ISU DAN PENGUATAN SISTEM',
    definition: 'Manajemen infrastruktur, pengembangan profesional guru, dan kolaborasi untuk mendukung efektivitas layanan BK.',
    badgeLabel: 'Pilar 4 • Sistem & Manajemen',
    color: {
      primary: '#7c3aed',
      lightBg: 'bg-purple-50',
      border: 'border-purple-300',
      text: 'text-purple-800',
      accent: 'bg-purple-600',
      ring: 'ring-purple-300',
    },
    services: [
      {
        type: 'Kolaborasi Guru & Wali Kelas',
        label: 'Kolaborasi Dewan Guru & Wali',
        shortDesc: 'Rapat koordinasi dan sinkronisasi penanganan perkembangan siswa',
        icon: Network,
        defaultTarget: 'Klasikal',
      },
      {
        type: 'Kemitraan (Puskesmas/Psikolog/Mitra)',
        label: 'Kemitraan & Strategi Mitra',
        shortDesc: 'Kerjasama dengan puskesmas, kepolisian, psikolog, dan DUDI',
        icon: Building2,
        defaultTarget: 'Klasikal',
      },
      {
        type: 'Manajemen & Administrasi BK',
        label: 'Manajemen & Administrasi BK',
        shortDesc: 'Penyusunan program tahunan, RPL, rekap data & arsip layanan',
        icon: Settings,
        defaultTarget: 'Klasikal',
      },
      {
        type: 'Pengembangan Keprofesian (MGBK/PKB)',
        label: 'Pengembangan Profesi (MGBK)',
        shortDesc: 'Keikutsertaan dalam pelatihan, MGBK, riset tindakan BK',
        icon: Layers,
        defaultTarget: 'Individu',
      },
      {
        type: 'Evaluasi & Supervisi Program',
        label: 'Evaluasi & Akuntabilitas',
        shortDesc: 'Evaluasi proses & hasil, supervisi kepala sekolah, dan refleksi',
        icon: CheckCircle2,
        defaultTarget: 'Klasikal',
      },
    ],
  },
];

export const FOKUS_ISU_LIST = [
  // Tiga Dosa Besar Pendidikan
  { group: 'Tiga Dosa Besar Pendidikan', id: 'Anti-Perundungan (Bullying)', label: '🚫 Pencegahan Perundungan (Bullying)', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { group: 'Tiga Dosa Besar Pendidikan', id: 'Pencegahan Kekerasan Seksual', label: '🛡️ Pencegahan Kekerasan Seksual', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { group: 'Tiga Dosa Besar Pendidikan', id: 'Pencegahan Intoleransi', label: '⚖️ Pencegahan Intoleransi & Diskriminasi', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  
  // Area Masalah Siswa
  { group: 'Area Masalah Siswa', id: 'Hambatan Akademik & Belajar', label: '📚 Hambatan Akademik & Belajar', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { group: 'Area Masalah Siswa', id: 'Adaptasi Sosial & Pertemanan', label: '👥 Adaptasi Sosial & Pertemanan', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { group: 'Area Masalah Siswa', id: 'Regulasi Diri & Emosi', label: '🧠 Regulasi Diri & Emosi', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { group: 'Area Masalah Siswa', id: 'Kecemasan Pribadi & Stres', label: '😟 Kecemasan Pribadi & Stres', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { group: 'Area Masalah Siswa', id: 'Disiplin & Tata Tertib', label: '⏱️ Disiplin & Tata Tertib', color: 'bg-red-50 text-red-700 border-red-200' },

  // Strategi Mitra & Masa Depan
  { group: 'Strategi Mitra & Masa Depan', id: 'Kolaborasi Orang Tua & Wali', label: '👨‍👩‍👧 Kolaborasi Orang Tua & Wali', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { group: 'Strategi Mitra & Masa Depan', id: 'Mitra Puskesmas & Psikolog', label: '🏥 Mitra Puskesmas & Psikolog', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { group: 'Strategi Mitra & Masa Depan', id: 'Eksplorasi Karir & Dunia Kerja', label: '🏭 Karir & Dunia Usaha/Industri', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
];

export const SIKLUS_LAYANAN_TERPADU = [
  { step: 1, title: 'Pemetaan Kebutuhan', desc: 'Need Assessment (AKPD / AUM / Sosiometri) untuk mengetahui profil kebutuhan belajar & psikologis siswa.' },
  { step: 2, title: 'Perencanaan', desc: 'Penyusunan Program Tahunan/Semester, RPL BK, matriks 4 pilar, serta pemetaan jadwal terpadu.' },
  { step: 3, title: 'Pelaksanaan', desc: 'Implementasi 4 Pilar Layanan BK (Dasar, Peminatan, Responsif, Dukungan Sistem) terintegrasi.' },
  { step: 4, title: 'Evaluasi & Refleksi', desc: 'Evaluasi proses dan evaluasi hasil secara berkala untuk akuntabilitas dan tindak lanjut berkelanjutan.' },
];

/**
 * 11 Aspek Standar Kompetensi Kemandirian Peserta Didik (SKKPD) Standar Dinas BK / POP BK
 */
export const SKKPD_ASPEK_LIST = [
  { id: 'religius', label: 'Landasan Hidup Religius', desc: 'Nilai keimanan, ketaqwaan, dan akhlak mulia dalam kehidupan sehari-hari' },
  { id: 'etis', label: 'Landasan Perilaku Etis', desc: 'Penalaran moral, norma kesopanan, dan integritas pribadi' },
  { id: 'emosi', label: 'Kematangan Emosi', desc: 'Regulasi emosi diri, ketahanan mental, dan ekspresi perasaan yang adaptif' },
  { id: 'intelektual', label: 'Kematangan Intelektual', desc: 'Berpikir kritis, pemecahan masalah, dan pengambilan keputusan rasional' },
  { id: 'sosial', label: 'Kesadaran Tanggung Jawab Sosial', desc: 'Kepedulian sesama, empati, dan gotong royong dalam masyarakat' },
  { id: 'gender', label: 'Kesadaran Gender', desc: 'Penghargaan atas peran dan kesetaraan gender yang harmonis' },
  { id: 'pribadi', label: 'Pengembangan Pribadi', desc: 'Konsep diri positif, keunikan potensi, dan kemandirian diri' },
  { id: 'ekonomi', label: 'Kemandirian Perilaku Ekonomis / Kewirausahaan', desc: 'Perilaku hemat, manajemen sumber daya, dan etos kerja produktif' },
  { id: 'karir', label: 'Wawasan & Kesiapan Karir', desc: 'Eksplorasi profesi, peminatan studi lanjut, dan kesiapan dunia kerja' },
  { id: 'sebaya', label: 'Kematangan Hubungan Teman Sebaya', desc: 'Komunikasi asertif, pertemanan sehat, dan toleransi sosial' },
  { id: 'keluarga', label: 'Kesiapan Diri Berkeluarga', desc: 'Pemahaman norma kehidupan keluarga yang harmonis' },
];

/**
 * Standar Bidang Bimbingan Konseling (Layanan Dasar, Peminatan, & Responsif) Standar Dinas Pendidikan
 * 4 Bidang Utama: Pribadi, Sosial, Belajar, Karier (+ Lintas Bidang)
 */
export const BIDANG_BIMBINGAN_OPTIONS = [
  {
    id: 'Pribadi',
    value: 'Pribadi',
    label: 'Pribadi',
    desc: 'Pemahaman diri, emosi, karakter, nilai hidup & konsep diri',
    description: 'Pemahaman diri, emosi, karakter, nilai hidup & konsep diri',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  {
    id: 'Sosial',
    value: 'Sosial',
    label: 'Sosial',
    desc: 'Relasi teman sebaya, empati, anti-bullying & komunikasi asertif',
    description: 'Relasi teman sebaya, empati, anti-bullying & komunikasi asertif',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  {
    id: 'Belajar',
    value: 'Belajar',
    label: 'Belajar',
    desc: 'Gaya belajar, motivasi akademik, manajemen waktu & prestasi',
    description: 'Gaya belajar, motivasi akademik, manajemen waktu & prestasi',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  {
    id: 'Karier',
    value: 'Karier',
    label: 'Karier',
    desc: 'Bakat minat, peminatan studi lanjut SMA/SMK/PT & profesi',
    description: 'Bakat minat, peminatan studi lanjut SMA/SMK/PT & profesi',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200'
  },
  {
    id: 'Lintas Bidang',
    value: 'Lintas Bidang',
    label: 'Lintas Bidang',
    desc: 'Penanganan komprehensif kombinasi pribadi, sosial, belajar & karier',
    description: 'Penanganan komprehensif kombinasi pribadi, sosial, belajar & karier',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
  }
];

/**
 * Sub-Aktivitas Layanan Dukungan Sistem Standar Dinas (Non-Bidang Siswa)
 */
export const SUB_AKTIVITAS_DUKUNGAN_SISTEM = [
  {
    id: 'Manajemen & Administrasi Program BK',
    label: 'Manajemen & Administrasi Program BK',
    desc: 'Penyusunan Program Tahunan/Semester, RPL BK, instrumentasi, dan pemetaan sarpras'
  },
  {
    id: 'Pengembangan Keprofesian Berkelanjutan (MGBK / PKB)',
    label: 'Pengembangan Keprofesian (MGBK / PKB)',
    desc: 'Partisipasi aktif forum MGBK, workshop kurikulum, dan peningkatan kompetensi konselor'
  },
  {
    id: 'Kolaborasi Dewan Guru & Wali Kelas',
    label: 'Kolaborasi Guru & Wali Kelas',
    desc: 'Rapat koordinasi berkala penanganan perkembangan siswa dan keselarasan kurikulum'
  },
  {
    id: 'Kemitraan Lembaga Eksternal (Puskesmas / Instansi / DUDI)',
    label: 'Kemitraan Lembaga Eksternal',
    desc: 'Kerjasama dengan instansi kesehatan, kepolisian, psikolog, dan dunia usaha/industri'
  },
  {
    id: 'Evaluasi, Akuntabilitas & Supervisi BK',
    label: 'Evaluasi, Akuntabilitas & Supervisi',
    desc: 'Laporan akuntabilitas kinerja BK, supervisi kepala sekolah, dan tindak lanjut program'
  }
];

/**
 * Validasi apakah suatu pilar atau jenis layanan menggunakan Bidang Bimbingan Siswa (Pribadi, Sosial, Belajar, Karir).
 * Berdasarkan Standar Isi BK (Permendikbud 111/2014 & POP BK), Dukungan Sistem tidak menggunakan bidang bimbingan siswa.
 */
export function isBidangBimbinganApplicable(componentOrService?: BKComponentType | string): boolean {
  if (!componentOrService) return true;
  const pillar = getBKComponentForService(componentOrService);
  return pillar !== 'Layanan Dukungan Sistem';
}

/**
 * Intelligent helper to resolve the BK Component from any service type string
 */
export function getBKComponentForService(serviceType: string): BKComponentType {
  const normalized = (serviceType || '').toLowerCase();

  // Pilar 1: Layanan Dasar
  if (
    normalized.includes('klasikal') ||
    normalized.includes('orientasi') ||
    normalized.includes('informasi') ||
    normalized.includes('penguasaan konten') ||
    normalized.includes('papan bimbingan') ||
    normalized.includes('media bk') ||
    normalized.includes('asesmen kebutuhan') ||
    normalized.includes('need assessment') ||
    (normalized.includes('bimbingan kelompok') && !normalized.includes('konseling'))
  ) {
    return 'Layanan Dasar';
  }

  // Pilar 2: Peminatan & Perencanaan Individual
  if (
    normalized.includes('penempatan') ||
    normalized.includes('penyaluran') ||
    normalized.includes('peminatan') ||
    normalized.includes('karir') ||
    normalized.includes('studi lanjut') ||
    normalized.includes('perencanaan individual') ||
    normalized.includes('eksplorasi bakat') ||
    normalized.includes('portofolio')
  ) {
    return 'Peminatan & Perencanaan Individual';
  }

  // Pilar 4: Layanan Dukungan Sistem
  if (
    normalized.includes('dukungan sistem') ||
    normalized.includes('kolaborasi dewan guru') ||
    normalized.includes('kolaborasi guru') ||
    normalized.includes('kemitraan') ||
    normalized.includes('administrasi bk') ||
    normalized.includes('manajemen') ||
    normalized.includes('mgbk') ||
    normalized.includes('pengembangan profesi') ||
    normalized.includes('evaluasi & supervisi') ||
    normalized.includes('akuntabilitas')
  ) {
    return 'Layanan Dukungan Sistem';
  }

  // Default Pilar 3: Layanan Responsif (Konseling individual, konseling kelompok, mediasi, konsultasi, home visit, dll.)
  return 'Layanan Responsif';
}

/**
 * Helper to get styling badges for a component
 */
export function getComponentColorConfig(componentName?: BKComponentType | string) {
  const component = componentName ? getBKComponentForService(componentName) : 'Layanan Responsif';
  const found = BK_COMPONENTS_DATA.find((c) => c.id === component);
  return found?.color || {
    primary: '#00685f',
    lightBg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-800',
    accent: 'bg-teal-600',
    ring: 'ring-teal-200',
  };
}

/**
 * Get pillar short badge
 */
export function getPilarBadge(componentName?: BKComponentType | string) {
  const component = componentName ? getBKComponentForService(componentName) : 'Layanan Responsif';
  switch (component) {
    case 'Layanan Dasar':
      return { pilar: 'Pilar 1', name: 'Layanan Dasar', badgeClass: 'bg-teal-50 text-[#00685f] border-teal-200' };
    case 'Peminatan & Perencanaan Individual':
      return { pilar: 'Pilar 2', name: 'Peminatan & Karir', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'Layanan Responsif':
      return { pilar: 'Pilar 3', name: 'Layanan Responsif', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'Layanan Dukungan Sistem':
      return { pilar: 'Pilar 4', name: 'Dukungan Sistem', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' };
    default:
      return { pilar: 'Pilar 1', name: 'Layanan Dasar', badgeClass: 'bg-teal-50 text-[#00685f] border-teal-200' };
  }
}

export type ServiceFormCategory =
  | 'klasikal_dasar'
  | 'peminatan_karir'
  | 'konseling_responsif'
  | 'mediasi_konflik'
  | 'home_visit'
  | 'konferensi_kasus'
  | 'referral'
  | 'konsultasi'
  | 'dukungan_sistem';

export interface ServiceFormConfig {
  pillar: BKComponentType;
  pilarNumber: number;
  formCategory: ServiceFormCategory;
  categoryTitle: string;
  
  // Custom Labels & Placeholders
  problemLabel: string;
  problemPlaceholder: string;
  problemHelpText: string;

  descriptionLabel: string;
  descriptionPlaceholder: string;

  outputLabel: string;
  outputPlaceholder: string;

  followUpLabel: string;
  followUpPlaceholder: string;

  // Participant Guidance
  participantLabel: string;
  participantRequired: boolean;
  participantHelpText: string;
}

/**
 * Returns contextual form layout configuration based on the specific service type and pillar
 */
export function getServiceFormConfig(serviceType: string, customComponent?: BKComponentType): ServiceFormConfig {
  const pillar = customComponent || getBKComponentForService(serviceType);
  const normalized = (serviceType || '').toLowerCase();

  // PILAR 1: LAYANAN DASAR
  if (pillar === 'Layanan Dasar') {
    return {
      pillar: 'Layanan Dasar',
      pilarNumber: 1,
      formCategory: 'klasikal_dasar',
      categoryTitle: 'Form Bimbingan Dasar & Klasikal (Preventif)',
      problemLabel: 'Materi Pokok / Topik Bahasan Bimbingan',
      problemPlaceholder: 'Contoh: Manajemen Waktu & Kebiasaan Belajar Efektif, Menumbuhkan Sikap Asertif, Pencegahan Perundungan...',
      problemHelpText: 'Tentukan materi utama, topik RPL, atau kompetensi dasar yang disampaikan pada peserta didik.',
      descriptionLabel: 'Uraian Pelaksanaan Bimbingan (Tahap Awal, Inti, Penutup)',
      descriptionPlaceholder: 'Jelaskan dinamika proses layanan bimbingan, antusiasme kelas/kelompok, serta respon dan partisipasi peserta didik...',
      outputLabel: 'Hasil Evaluasi Proses & Pemahaman Siswa (Laiseg)',
      outputPlaceholder: 'Pemahaman baru yang diperoleh siswa, refleksi perasaan, keaktifan kelas, atau evaluasi lembar kerja...',
      followUpLabel: 'Rencana Pendampingan / Evaluasi Lanjutan',
      followUpPlaceholder: 'Pemantauan berkala di kelas, penugasan portofolio refleksi, atau koordinasi lanjutan bersama wali kelas...',
      participantLabel: 'Sasaran Peserta (Kelas / Kelompok)',
      participantRequired: false,
      participantHelpText: 'Pilih rombongan belajar (kelas) atau daftar siswa penerima materi bimbingan ini.'
    };
  }

  // PILAR 2: PEMINATAN & PERENCANAAN INDIVIDUAL
  if (pillar === 'Peminatan & Perencanaan Individual') {
    return {
      pillar: 'Peminatan & Perencanaan Individual',
      pilarNumber: 2,
      formCategory: 'peminatan_karir',
      categoryTitle: 'Form Perencanaan Karir, Minat & Studi Lanjut',
      problemLabel: 'Tujuan Perencanaan / Bidang Peminatan',
      problemPlaceholder: 'Contoh: Pemilihan Jurusan SMA/SMK, Eksplorasi Minat Kedokteran/Teknik, Seleksi Ekstrakurikuler Unggulan...',
      problemHelpText: 'Fokus peminatan akademik, pilihan karir masa depan, atau bakat yang sedang direncanakan.',
      descriptionLabel: 'Uraian Proses Eksplorasi & Pemetaan Potensi',
      descriptionPlaceholder: 'Jelaskan dialog pemetaan minat bakat siswa, analisis data nilai/asesmen, serta diskusi opsi masa depan...',
      outputLabel: 'Keputusan Pilihan / Action Plan Siswa',
      outputPlaceholder: 'Target pilihan sekolah/jurusan yang disepakati, komitmen aksi pengembangan bakat, atau portofolio yang tersusun...',
      followUpLabel: 'Tindak Lanjut & Verifikasi Orang Tua',
      followUpPlaceholder: 'Koordinasi bersama orang tua siswa, monitoring persiapan akademik/syarat masuk, evaluasi kemajuan berkala...',
      participantLabel: 'Siswa Peserta Perencanaan',
      participantRequired: true,
      participantHelpText: 'Pilih peserta didik yang sedang menyusun rencana studi/karir individual.'
    };
  }

  // PILAR 4: DUKUNGAN SISTEM
  if (pillar === 'Layanan Dukungan Sistem') {
    return {
      pillar: 'Layanan Dukungan Sistem',
      pilarNumber: 4,
      formCategory: 'dukungan_sistem',
      categoryTitle: 'Form Manajemen, Kemitraan & Penguatan Sistem BK',
      problemLabel: 'Nama Program / Agenda Kegiatan Sistem BK',
      problemPlaceholder: 'Contoh: Rapat Koordinasi Penanganan Siswa Semester Ganjil, Workshop MGBK Asesmen Diagnostik, Penyusunan RPL BK...',
      problemHelpText: 'Nama kegiatan manajemen, koordinasi guru/wali, kemitraan lembaga, atau kegiatan profesi MGBK.',
      descriptionLabel: 'Uraian Pelaksanaan & Jalannya Kegiatan Sistem',
      descriptionPlaceholder: 'Jelaskan jalannya rapat koordinasi, poin-poin pembahasan, strategi bersama dewan guru, atau materi pelatihan MGBK...',
      outputLabel: 'Hasil Kesepahaman / Capaian Output Kegiatan',
      outputPlaceholder: 'Notulen rapat koordinasi, naskah kesepakatan (MoU), dokumen program tahunan BK, laporan akuntabilitas...',
      followUpLabel: 'Rencana Implementasi & Evaluasi Sistem',
      followUpPlaceholder: 'Penerapan kesepakatan dalam layanan siswa, sosialisasi ke dewan guru, pelaporan berkala ke kepala sekolah...',
      participantLabel: 'Siswa Terkait (Opsional)',
      participantRequired: false,
      participantHelpText: 'Dukungan sistem berfokus pada guru, staf, atau mitra. Memasukkan siswa bersifat opsional.'
    };
  }

  // PILAR 3: LAYANAN RESPONSIF (Differentiated by specific responsive service)
  if (normalized.includes('mediasi')) {
    return {
      pillar: 'Layanan Responsif',
      pilarNumber: 3,
      formCategory: 'mediasi_konflik',
      categoryTitle: 'Form Mediasi & Advokasi Penyelesaian Konflik',
      problemLabel: 'Pokok Perselisihan / Kasus yang Dimediasi',
      problemPlaceholder: 'Contoh: Kesalahpahaman antarteman sekelas terkait media sosial yang memicu perselisihan fisik/verbal...',
      problemHelpText: 'Uraikan pokok masalah atau kesalahpahaman yang terjadi antarpihak yang bersengketa.',
      descriptionLabel: 'Uraian Proses Mediasi & Dialog Klarifikasi',
      descriptionPlaceholder: 'Jelaskan jalannya mediasi: mendengarkan keterangan kedua belah pihak secara objektif, meredakan ketegangan emosi, dan merumuskan titik temu...',
      outputLabel: 'Titik Temu & Butir Kesepakatan Damai',
      outputPlaceholder: 'Poin komitmen damai yang disepakati bersama, saling memaafkan, dan kesanggupan menjaga hubungan baik...',
      followUpLabel: 'Pemantauan Kerukunan Pasca Mediasi',
      followUpPlaceholder: 'Monitoring relasi siswa di kelas selama 2 pekan ke depan bersama wali kelas dan peer counselor...',
      participantLabel: 'Pihak yang Terlibat Perselisihan',
      participantRequired: true,
      participantHelpText: 'Pilih semua siswa yang terlibat dalam perselisihan ini.'
    };
  }

  if (normalized.includes('home visit') || normalized.includes('kunjungan rumah')) {
    return {
      pillar: 'Layanan Responsif',
      pilarNumber: 3,
      formCategory: 'home_visit',
      categoryTitle: 'Form Kunjungan Rumah (Home Visit)',
      problemLabel: 'Latar Belakang / Urgensi Kunjungan Rumah',
      problemPlaceholder: 'Contoh: Siswa tidak hadir tanpa keterangan selama 5 hari berturut-turut, klarifikasi kendala lingkungan keluarga...',
      problemHelpText: 'Alasan dan urgensi pelaksanaan kunjungan langsung ke tempat tinggal siswa.',
      descriptionLabel: 'Uraian Pelaksanaan Kunjungan & Wawancara Keluarga',
      descriptionPlaceholder: 'Jelaskan situasi tempat tinggal, suasana pertemuan bersama orang tua/wali, dan klarifikasi penyebab kendala siswa...',
      outputLabel: 'Hasil Temuan Observasi & Komitmen Keluarga',
      outputPlaceholder: 'Akar masalah siswa di rumah teridentifikasi, orang tua berkomitmen mendampingi jam belajar dan kehadiran anak...',
      followUpLabel: 'Rencana Pendampingan Siswa di Sekolah',
      followUpPlaceholder: 'Penyambutan siswa kembali bersekolah, pemantauan kehadiran harian, dan sesi bimbingan lanjutan...',
      participantLabel: 'Siswa yang Dikunjungi',
      participantRequired: true,
      participantHelpText: 'Pilih siswa yang dikunjungi rumahnya.'
    };
  }

  if (normalized.includes('konferensi kasus') || normalized.includes('case conference')) {
    return {
      pillar: 'Layanan Responsif',
      pilarNumber: 3,
      formCategory: 'konferensi_kasus',
      categoryTitle: 'Form Konferensi Kasus Terpadu (Case Conference)',
      problemLabel: 'Kasus yang Dibahas dalam Konferensi',
      problemPlaceholder: 'Contoh: Pembahasan komprehensif penanganan siswa dengan hambatan perilaku berat dan absensi kronis...',
      problemHelpText: 'Kasus khusus yang memerlukan musyawarah penanganan bersama pimpinan sekolah dan dewan guru.',
      descriptionLabel: 'Jalannya Musyawarah Konferensi Kasus',
      descriptionPlaceholder: 'Jelaskan pemaparan data guru BK, masukan dari wali kelas dan guru mata pelajaran, serta tanggapan pimpinan sekolah...',
      outputLabel: 'Keputusan Resmi & Rekomendasi Bersama',
      outputPlaceholder: 'Keputusan sidang konferensi kasus, pembagian peran pendampingan, serta sanksi/bimbingan edukatif yang disepakati...',
      followUpLabel: 'Pembagian Tugas Penanganan & Jadwal Evaluasi',
      followUpPlaceholder: 'Evaluasi berkala perkembangan siswa setiap 2 minggu bersama wali kelas dan tim kesiswaan...',
      participantLabel: 'Siswa Subjek Kasus',
      participantRequired: true,
      participantHelpText: 'Pilih siswa yang menjadi subjek pembahasan konferensi kasus.'
    };
  }

  if (normalized.includes('referral') || normalized.includes('alih tangan')) {
    return {
      pillar: 'Layanan Responsif',
      pilarNumber: 3,
      formCategory: 'referral',
      categoryTitle: 'Form Alih Tangan Kasus (Referral / Rujukan Ahli)',
      problemLabel: 'Indikasi Masalah & Alasan Rujukan Kasus',
      problemPlaceholder: 'Contoh: Indikasi gangguan depresi klinis / trauma berat yang membutuhkan intervensi psikolog klinis / psikiater...',
      problemHelpText: 'Kondisi siswa yang berada di luar kewenangan profesional guru BK dan memerlukan rujukan ahli.',
      descriptionLabel: 'Uraian Kronologis & Catatan Khusus Rujukan',
      descriptionPlaceholder: 'Jelaskan riwayat penanganan awal oleh guru BK, gejala yang teramati, serta persetujuan yang telah dibuat bersama orang tua...',
      outputLabel: 'Dokumen Rekomendasi & Lembar Rujukan Resmi',
      outputPlaceholder: 'Surat pengantar rujukan resmi telah diserahkan kepada pihak keluarga dan lembaga mitra rujukan...',
      followUpLabel: 'Koordinasi Berkala dengan Ahli Rujukan & Ortu',
      followUpPlaceholder: 'Memantau perkembangan intervensi dari psikolog/ahli terkait dan menyelaraskan pendampingan saat siswa di sekolah...',
      participantLabel: 'Siswa yang Dirujuk',
      participantRequired: true,
      participantHelpText: 'Pilih siswa yang dialihtangankan ke lembaga rujukan.'
    };
  }

  if (normalized.includes('konsultasi')) {
    return {
      pillar: 'Layanan Responsif',
      pilarNumber: 3,
      formCategory: 'konsultasi',
      categoryTitle: 'Form Layanan Konsultasi Guru & Orang Tua',
      problemLabel: 'Isu Konsultasi Perkembangan / Hambatan Siswa',
      problemPlaceholder: 'Contoh: Wali kelas berkonsultasi mengenai penurunan motivasi belajar drastis dan perubahan sikap siswa di kelas...',
      problemHelpText: 'Permasalahan atau pertanyaan dari pihak konsulti (guru/wali/ortu) terkait penanganan peserta didik.',
      descriptionLabel: 'Uraian Diskusi Konsultasi & Analisis Bersama',
      descriptionPlaceholder: 'Jelaskan analisis bersama mengenai pola perilaku siswa di kelas/rumah dan tukar pikiran solusi praktis...',
      outputLabel: 'Saran Konseling & Kesepakatan Strategi Bersama',
      outputPlaceholder: 'Rekomendasi pendekatan ramah anak yang disepakati oleh konsulti untuk diterapkan di ruang kelas/rumah...',
      followUpLabel: 'Rencana Evaluasi Efektivitas Strategi Baru',
      followUpPlaceholder: 'Follow-up dalam 1 minggu ke depan untuk meninjau efektivitas respon siswa terhadap pendekatan baru...',
      participantLabel: 'Siswa yang Dikonsultasikan',
      participantRequired: true,
      participantHelpText: 'Pilih siswa yang sedang dikonsultasikan perkembangannya.'
    };
  }

  // Default Pilar 3: Konseling Individual / Konseling Kelompok
  return {
    pillar: 'Layanan Responsif',
    pilarNumber: 3,
    formCategory: 'konseling_responsif',
    categoryTitle: 'Form Konseling Responsif (Pengentasan Masalah)',
    problemLabel: 'Masalah / Keluhan Konseli',
    problemPlaceholder: 'Contoh: Mengalami kecemasan berlebihan menghadapi ujian, beban emosi akibat masalah pertemanan, penurunan motivasi...',
    problemHelpText: 'Keluhan, hambatan emosional, atau masalah perilaku yang ingin dientaskan dalam sesi konseling.',
    descriptionLabel: 'Uraian Proses Konseling & Dinamika Sesi',
    descriptionPlaceholder: 'Jelaskan tahapan konseling: eksplorasi perasaan, identifikasi pikiran negatif, teknik intervensi yang digunakan, dan dinamika konseli...',
    outputLabel: 'Hasil Pengentasan Masalah & Komitmen Konseli',
    outputPlaceholder: 'Kelegaan emosional konseli, wawasan baru (insight), serta komitmen langkah perbaikan diri yang disanggupi...',
    followUpLabel: 'Rencana Tindak Lanjut & Monitoring Mandiri',
    followUpPlaceholder: 'Pemantauan berkala lembar komitmen diri siswa, sesi tindak lanjut minggu depan jika diperlukan...',
    participantLabel: 'Konseli (Siswa Peserta)',
    participantRequired: true,
    participantHelpText: 'Pilih konseli yang mengikuti sesi konseling ini.'
  };
}

export interface BKQuickTemplate {
  id: string;
  title: string;
  badge: string;
  pillar: BKComponentType;
  pilarNumber: number;
  serviceType: BKServiceType;
  bidangBimbingan: 'Pribadi' | 'Sosial' | 'Belajar' | 'Karir';
  focusIssue: string;
  targetType: 'Individu' | 'Kelompok' | 'Klasikal';
  problem: string;
  description: string;
  output: string;
  followUp: string;
  specificDetails: {
    metodeLayanan?: string;
    mediaLayanan?: string;
    evaluasiProses?: string;
    bidangPeminatan?: string;
    dasarAsesmen?: string;
    potensiKekuatan?: string;
    rencanaAksiSiswa?: string;
    akarMasalah?: string;
    pendekatanKonseling?: string;
    komitmenKonseli?: string;
    pihakBersengketa?: string;
    kesepakatanDamai?: string;
    pesertaKonferensi?: string;
    alamatKunjungan?: string;
    pihakDitemui?: string;
    hasilObservasiKeluarga?: string;
    lembagaRujukan?: string;
    alasanRujukan?: string;
    pihakKonsulti?: string;
    rekomendasiKonsultasi?: string;
    bentukKegiatan?: string;
    mitraTerlibat?: string;
    dokumenOutput?: string;
  };
}

export const BK_QUICK_TEMPLATES: BKQuickTemplate[] = [
  // 1. Klasikal: Stop Bullying
  {
    id: 'tpl-klasikal-bullying',
    title: 'Pencegahan Bullying & Budaya Saling Menghargai',
    badge: 'Layanan Dasar • Klasikal',
    pillar: 'Layanan Dasar',
    pilarNumber: 1,
    serviceType: 'Bimbingan Klasikal',
    bidangBimbingan: 'Sosial',
    focusIssue: 'Anti-Perundungan (Bullying)',
    targetType: 'Klasikal',
    problem: 'Membangun Iklim Kelas Bebas Perundungan & Peningkatan Empati Sosial',
    description: 'Penyampaian materi interaktif mengenai jenis-jenis perundungan (verbal, fisik, sosial, dan cyberbullying), pemutaran video studi kasus, diskusi refleksi kelompok, dan deklarasi kelas ramah anak.',
    output: 'Peserta didik memahami dampak buruk perundungan, berkomitmen menjadi upstander (pembela korban), dan menandatangani deklarasi komitmen kelas damai.',
    followUp: 'Pemantauan iklim sosial kelas bersama wali kelas dan pembentukan duta anti-bullying kelas.',
    specificDetails: {
      metodeLayanan: 'Ceramah Interaktif, Pemutaran Video Edukatif, Diskusi Kelompok, & Refleksi Diri',
      mediaLayanan: 'LCD Proyektor, Slide Presentasi, Video Studi Kasus, & Lembar Komitmen Kelas',
      evaluasiProses: 'Antusiasme siswa tinggi, 95% siswa aktif berpendapat dan menyepakati norma kelas tanpa celaan.'
    }
  },
  // 2. Klasikal: Manajemen Waktu Belajar
  {
    id: 'tpl-klasikal-waktu',
    title: 'Manajemen Waktu & Strategi Belajar Efektif',
    badge: 'Layanan Dasar • Klasikal',
    pillar: 'Layanan Dasar',
    pilarNumber: 1,
    serviceType: 'Bimbingan Klasikal',
    bidangBimbingan: 'Belajar',
    focusIssue: 'Hambatan Akademik & Belajar',
    targetType: 'Klasikal',
    problem: 'Optimalisasi Waktu Belajar Mandiri & Pengurangan Prokrastinasi Akademik',
    description: 'Bimbingan pemahaman Matriks Eisenhower (Penting vs Mendesak), teknik Pomodoro untuk konsentrasi, penyusunan jadwal harian seimbang antara belajar, istirahat, dan penggunaan gadget.',
    output: 'Setiap siswa menyusun jadwal harian realistis (Time Management Sheet) dan memahami prioritas tugas sekolah.',
    followUp: 'Pengecekan keterlaksanaan jadwal belajar 1 pekan mendatang melalui jurnal belajar mandiri.',
    specificDetails: {
      metodeLayanan: 'Problem Based Learning, Workshop Penyusunan Jadwal, & Tanya Jawab',
      mediaLayanan: 'LKPD Manajemen Waktu, Template Matriks Prioritas, PPT Materi',
      evaluasiProses: 'Siswa antusias mengisi lembar perencana harian dan menyadari kebocoran waktu bermain HP.'
    }
  },
  // 3. Konseling Individu: Prokrastinasi & Motivasi
  {
    id: 'tpl-konseling-cbt-prokrastinasi',
    title: 'Konseling CBT: Penurunan Motivasi & Penundaan Tugas',
    badge: 'Layanan Responsif • Konseling Individu',
    pillar: 'Layanan Responsif',
    pilarNumber: 3,
    serviceType: 'Layanan Konseling Perorangan (Individual)',
    bidangBimbingan: 'Belajar',
    focusIssue: 'Hambatan Akademik & Belajar',
    targetType: 'Individu',
    problem: 'Sering menunda pengerjaan tugas sekolah dan merasa terbebani materi pelajaran',
    description: 'Sesi konseling mendalam dengan pendekatan Cognitive Behavioral Therapy (CBT). Mengidentifikasi distorsi kognitif "tugas harus langsung sempurna", merestrukturisasi pikiran negatif, dan membagi tugas besar menjadi langkah-langkah mikro (chunking).',
    output: 'Konseli menyadari pola berpikir yang menghambat dan menyepakati target harian menyelesaikan 1 sub-tugas sebelum bermain game.',
    followUp: 'Konseli mengisi kartu monitoring target harian (Self-Monitoring Sheet) dan sesi evaluasi progres 5 hari ke depan.',
    specificDetails: {
      akarMasalah: 'Perfeksionisme negatif disertai distorsi gadget reward yang tidak teratur.',
      pendekatanKonseling: 'Cognitive Behavioral Therapy (CBT) & Teknik Behavioral Contracting',
      komitmenKonseli: 'Menyelesaikan tugas sekolah 30 menit setiap pulang sekolah sebelum menyalakan HP.'
    }
  },
  // 4. Konseling Individu: Regulasi Emosi / Stres
  {
    id: 'tpl-konseling-sfbt-emosi',
    title: 'Konseling SFBT: Regulasi Emosi & Pengendalian Marah',
    badge: 'Layanan Responsif • Konseling Individu',
    pillar: 'Layanan Responsif',
    pilarNumber: 3,
    serviceType: 'Layanan Konseling Perorangan (Individual)',
    bidangBimbingan: 'Pribadi',
    focusIssue: 'Regulasi Diri & Emosi',
    targetType: 'Individu',
    problem: 'Mudah tersulut emosi dan reaktif saat berinteraksi dengan teman sebaya di kelas',
    description: 'Sesi konseling Solution-Focused Brief Therapy (SFBT). Mengeksplorasi kondisi pengecualian (saat konseli berhasil tetap tenang), teknik Miracle Question, dan latihan teknik pernapasan Stop-Think-Act saat merasakan dorongan marah.',
    output: 'Konseli menemukan strategi koping mandiri dan mampu mengenali sinyal tubuh awal sebelum emosi meledak.',
    followUp: 'Konseli mempraktikkan jeda 5 hitungan ketika merasa kesal dan melapor pada guru BK saat berhasil mengendalikan diri.',
    specificDetails: {
      akarMasalah: 'Sensitivitas tinggi terhadap komentar teman dan belum terbiasa ventilasi emosi yang sehat.',
      pendekatanKonseling: 'Solution-Focused Brief Therapy (SFBT) & Mindfulness Relaxation',
      komitmenKonseli: 'Mengambil jeda 5 detik dan minum air putih ketika mulai merasa emosi sebelum merespon.'
    }
  },
  // 5. Mediasi Konflik Teman Sebaya
  {
    id: 'tpl-mediasi-konflik',
    title: 'Mediasi Rekonsiliasi & Resolusi Damai Konflik Teman',
    badge: 'Layanan Responsif • Mediasi',
    pillar: 'Layanan Responsif',
    pilarNumber: 3,
    serviceType: 'Layanan Mediasi',
    bidangBimbingan: 'Sosial',
    focusIssue: 'Adaptasi Sosial & Pertemanan',
    targetType: 'Kelompok',
    problem: 'Perselisihan paham dan saling sindir di media sosial antara dua kelompok pertemanan',
    description: 'Proses mediasi netral oleh guru BK. Memberikan ruang bagi kedua pihak menyampaikan perspektif secara bergantian tanpa menyela, mengklarifikasi miskomunikasi, dan membangun empati atas perasaan masing-masing pihak.',
    output: 'Kedua belah pihak saling meminta maaf, menghapus unggahan sindiran, dan menyepakati batas komunikasi yang sehat dan saling menghormati.',
    followUp: 'Wali kelas memantau interaksi kedua kelompok di ruang kelas dan memastikan tidak ada aksi provokasi susulan.',
    specificDetails: {
      pihakBersengketa: 'Siswa bersangkutan dan rekan sebaya terkait.',
      akarMasalah: 'Salah paham atas pesan teks di grup chat kelas yang bernada sarkas.',
      kesepakatanDamai: 'Saling berjabat tangan damai, menghapus pesan bernada provokatif, dan berjanji mengklarifikasi langsung jika ada unek-unek.'
    }
  },
  // 6. Konferensi Kasus (Case Conference)
  {
    id: 'tpl-konferensi-kasus',
    title: 'Konferensi Kasus Terpadu: Penanganan Absensi Kronis',
    badge: 'Layanan Responsif • Konferensi Kasus',
    pillar: 'Layanan Responsif',
    pilarNumber: 3,
    serviceType: 'Konferensi Kasus (Case Conference)',
    bidangBimbingan: 'Pribadi',
    focusIssue: 'Disiplin & Tata Tertib',
    targetType: 'Individu',
    problem: 'Siswa mengalami absensi tanpa keterangan berulang dan penurunan capaian akademik signifikan',
    description: 'Sidang koordinasi khusus dihadiri Kepala Sekolah, Guru BK, Wali Kelas, Guru Mapel Utama, dan Orang Tua/Wali. Pemaparan data kehadiran, riwayat konseling sebelumnya, kendala ekonomi/keluarga, dan perumusan solusi integratif.',
    output: 'Tercapai kesepakatan bersama mengenai pendampingan belajar khusus, dispensasi kendala teknis, serta surat kontrak pembinaan terpadu.',
    followUp: 'Evaluasi mingguan laporan presensi dan pendampingan terpadu wali kelas bersama guru BK.',
    specificDetails: {
      pesertaKonferensi: 'Kepala Sekolah, Guru Pembimbing BK, Wali Kelas, Guru Mata Pelajaran, dan Orang Tua Siswa.',
      akarMasalah: 'Tantangan transportasi dan beban merawat adik di rumah saat orang tua bekerja.',
      komitmenKonseli: 'Orang tua berkomitmen mengatur shift dan memastikan anak berangkat sekolah tepat waktu.'
    }
  },
  // 7. Kunjungan Rumah (Home Visit)
  {
    id: 'tpl-home-visit',
    title: 'Kunjungan Rumah (Home Visit): Validasi Kendala Keluarga',
    badge: 'Layanan Responsif • Home Visit',
    pillar: 'Layanan Responsif',
    pilarNumber: 3,
    serviceType: 'Kunjungan Rumah (Home Visit)',
    bidangBimbingan: 'Sosial',
    focusIssue: 'Kolaborasi Orang Tua & Wali',
    targetType: 'Individu',
    problem: 'Kunjungan langsung ke kediaman siswa setelah 4 hari berturut-turut tidak hadir tanpa kabar',
    description: 'Guru BK dan Wali Kelas bertamu ke rumah keluarga siswa untuk silaturahmi, memvalidasi kondisi kesehatan dan lingkungan rumah, mendengarkan kendala orang tua, serta memberikan dukungan moril.',
    output: 'Orang tua menyambut baik perhatian sekolah, mengklarifikasi kondisi siswa yang sedang pemulihan sakit dan kendala komunikasi pulsa.',
    followUp: 'Siswa kembali bersekolah besok pagi dengan pendampingan materi susulan dari guru mata pelajaran.',
    specificDetails: {
      alamatKunjungan: 'Kediaman keluarga siswa.',
      pihakDitemui: 'Orang Tua / Wali Siswa.',
      hasilObservasiKeluarga: 'Kondisi lingkungan rumah kondusif, orang tua sangat kooperatif dan mengapresiasi kehadiran guru BK.',
      komitmenKonseli: 'Orang tua akan langsung mengabari wali kelas jika anak terkendala hadir.'
    }
  },
  // 8. Peminatan & Karir
  {
    id: 'tpl-karir-peminatan',
    title: 'Eksplorasi Peminatan Studi Lanjut (SMA/SMK/MA) & Karir',
    badge: 'Perencanaan Individual • Karir',
    pillar: 'Peminatan & Perencanaan Individual',
    pilarNumber: 2,
    serviceType: 'Perencanaan Karir & Studi Lanjut',
    bidangBimbingan: 'Karir',
    focusIssue: 'Eksplorasi Karir & Dunia Kerja',
    targetType: 'Individu',
    problem: 'Kebingungan menentukan pilihan sekolah lanjutan dan keselarasan dengan bakat minat masa depan',
    description: 'Analisis hasil tes diagnostik minat bakat dan nilai rapor, eksplorasi spektrum program keahlian SMK vs jurusan SMA, serta diskusi prospek profesi impian siswa.',
    output: 'Siswa memiliki peta rencana studi lanjut yang jelas (pilihan prioritas 1 dan 2) lengkap dengan syarat akademiknya.',
    followUp: 'Konsultasi bersama orang tua pada sesi penerimaan rapor semester terkait dukungan pilihan jurusan anak.',
    specificDetails: {
      bidangPeminatan: 'Studi Lanjut SMA / SMK Kejuruan & Eksplorasi Profesi Teknologi/Sains.',
      dasarAsesmen: 'Rapor Semester 1-5, Asesmen Minat Bakat Holland (RIASEC), dan Angket Karir.',
      potensiKekuatan: 'Kemampuan analisis logis kuat, minat investigatif dan artistik tinggi.',
      rencanaAksiSiswa: 'Meningkatkan nilai rata-rata mata pelajaran IPA dan Matematika di atas 85.'
    }
  },
  // 9. Bimbingan Kelompok: Peningkatan Kepercayaan Diri
  {
    id: 'tpl-bimbingan-kelompok-pede',
    title: 'Bimbingan Kelompok: Mengembangkan Kepercayaan Diri (Assertiveness)',
    badge: 'Layanan Dasar • Kelompok',
    pillar: 'Layanan Dasar',
    pilarNumber: 1,
    serviceType: 'Bimbingan Kelompok',
    bidangBimbingan: 'Pribadi',
    focusIssue: 'Adaptasi Sosial & Pertemanan',
    targetType: 'Kelompok',
    problem: 'Siswa merasa cemas saat presentasi di depan kelas dan ragu menyuarakan pendapat',
    description: 'Dinamika kelompok 6-8 siswa dengan teknik Assertive Training dan Role Playing simulasi berbicara di depan umum dalam suasana aman dan saling menguatkan.',
    output: 'Anggota kelompok mengalami peningkatan kepercayaan diri, memahami hak asertif diri, dan berani mengemukakan ide.',
    followUp: 'Latihan mandiri saat sesi pembelajaran di kelas dan saling memberikan umpan balik positif antar anggota kelompok.',
    specificDetails: {
      metodeLayanan: 'Dinamika Kelompok, Role Playing Asertif, & Umpan Balik Positif',
      mediaLayanan: 'Kartu Situasi Sosial & Lembar Evaluasi Diri Asertif',
      evaluasiProses: 'Seluruh peserta aktif berpartisipasi dan merasa lebih percaya diri setelah simulasi.'
    }
  },
  // 10. Alih Tangan Kasus (Referral)
  {
    id: 'tpl-referral-psikolog',
    title: 'Alih Tangan Kasus (Referral): Rujukan Asesmen Psikolog Klinis',
    badge: 'Layanan Responsif • Referral',
    pillar: 'Layanan Responsif',
    pilarNumber: 3,
    serviceType: 'Alih Tangan Kasus (Referral)',
    bidangBimbingan: 'Pribadi',
    focusIssue: 'Kecemasan Pribadi & Stres',
    targetType: 'Individu',
    problem: 'Indikasi gangguan kecemasan mendalam (panic attacks) yang memerlukan diagnosa psikologis klinis',
    description: 'Penyusunan berkas rekam observasi awal, koordinasi bersama orang tua mengenai rekomendasi rujukan, dan pembuatan Surat Pengantar Alih Tangan Kasus resmi ke fasilitas layanan psikologi profesional.',
    output: 'Surat rujukan dan berkas asesmen awal telah diterima oleh keluarga dan pihak psikolog mitra.',
    followUp: 'Guru BK menjadwalkan kontak berkala dengan psikolog dan orang tua untuk menyelaraskan perlakuan di lingkungan sekolah.',
    specificDetails: {
      lembagaRujukan: 'Layanan Psikologi Klinis Puskesmas / RSUD / Psikolog Terdaftar HIMPSI.',
      alasanRujukan: 'Kondisi kecemasan psikosomatis berulang yang berada di luar batas kewenangan guru BK sekolah.',
      komitmenKonseli: 'Keluarga menyetujui jadwal konsultasi profesional dan berkolaborasi penuh dengan pihak sekolah.'
    }
  }
];
