import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Student, 
  CounselingService, 
  BKServiceType, 
  BKComponentType, 
  PresetServiceData, 
  ViolationRecord,
  BidangBimbinganType,
  HomeVisitRecord
} from '../types';
import { 
  Search, 
  Check, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight,
  BookOpen, 
  Clock, 
  Users, 
  Smartphone, 
  Zap, 
  Home, 
  MessageSquare, 
  Mail, 
  Eye, 
  X, 
  Sparkles,
  Scale,
  UserPlus,
  HelpCircle,
  Compass,
  FileCheck,
  Target,
  GraduationCap,
  Award,
  Network,
  Building2,
  Settings,
  Layers,
  ChevronRight,
  AlertTriangle,
  User,
  Calendar,
  Wand2,
  RotateCcw,
  Bot,
  FileText,
  ChevronDown,
  ShieldCheck,
  CheckSquare,
  Square,
  MapPin,
  PenTool,
  Download,
  Camera,
  Upload,
  Phone,
  UserCheck
} from 'lucide-react';
import { showToast } from '../utils/toast';
import { generateServicePDF, downloadHomeVisitPDF } from '../utils/pdfGenerator';

interface TambahLayananFormProps {
  students: Student[];
  violations?: ViolationRecord[];
  existingServices?: CounselingService[];
  preSelectedStudentId?: string;
  presetServiceData?: PresetServiceData | null;
  onClearPresetServiceData?: () => void;
  onSaveService: (service: Omit<CounselingService, 'id'>) => void;
  onCancel: () => void;
  onNavigateToRiwayat?: () => void;
}

// Model data layanan
export interface ServiceDefinition {
  type: BKServiceType;
  label: string;
  group: 'Layanan Dasar' | 'Layanan Responsif' | 'Perencanaan Individual' | 'Dukungan Sistem';
  pilarId: BKComponentType;
  bidangDefault: BidangBimbinganType;
  desc: string;
  defaultMode: 'Individu' | 'Kelompok' | 'Klasikal';
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

// 16+ Layanan Resmi BK Komprehensif / POP BK Terorganisir dalam 4 Grup
export const ALL_16_SERVICES: ServiceDefinition[] = [
  // GRUP 1: LAYANAN DASAR
  {
    type: 'Bimbingan Klasikal',
    label: 'Bimbingan Klasikal',
    group: 'Layanan Dasar',
    pilarId: 'Layanan Dasar',
    bidangDefault: 'Belajar',
    desc: 'Layanan terencana tatap muka di kelas untuk seluruh siswa',
    defaultMode: 'Klasikal',
    icon: Users,
    accentColor: 'border-teal-200 bg-teal-50/70 text-teal-900 hover:border-teal-400',
  },
  {
    type: 'Bimbingan Kelompok',
    label: 'Bimbingan Kelompok',
    group: 'Layanan Dasar',
    pilarId: 'Layanan Dasar',
    bidangDefault: 'Sosial',
    desc: 'Dinamika kelompok kecil untuk mengembangkan potensi & empati',
    defaultMode: 'Kelompok',
    icon: Users,
    accentColor: 'border-teal-200 bg-teal-50/70 text-teal-900 hover:border-teal-400',
  },
  {
    type: 'Layanan Penguasaan Konten',
    label: 'Penguasaan Konten Belajar',
    group: 'Layanan Dasar',
    pilarId: 'Layanan Dasar',
    bidangDefault: 'Belajar',
    desc: 'Metode belajar efektif, literasi, dan manajemen waktu belajar',
    defaultMode: 'Kelompok',
    icon: BookOpen,
    accentColor: 'border-teal-200 bg-teal-50/70 text-teal-900 hover:border-teal-400',
  },
  {
    type: 'Layanan Informasi',
    label: 'Layanan Informasi',
    group: 'Layanan Dasar',
    pilarId: 'Layanan Dasar',
    bidangDefault: 'Pribadi',
    desc: 'Pemberian informasi pendidikan, wawasan sosial, dan pencegahan',
    defaultMode: 'Klasikal',
    icon: Sparkles,
    accentColor: 'border-teal-200 bg-teal-50/70 text-teal-900 hover:border-teal-400',
  },
  {
    type: 'Layanan Orientasi',
    label: 'Layanan Orientasi',
    group: 'Layanan Dasar',
    pilarId: 'Layanan Dasar',
    bidangDefault: 'Sosial',
    desc: 'Pengenalan lingkungan sekolah dan adaptasi budaya belajar baru',
    defaultMode: 'Klasikal',
    icon: Compass,
    accentColor: 'border-teal-200 bg-teal-50/70 text-teal-900 hover:border-teal-400',
  },
  {
    type: 'Papan Bimbingan & Media BK',
    label: 'Papan Bimbingan & Media',
    group: 'Layanan Dasar',
    pilarId: 'Layanan Dasar',
    bidangDefault: 'Pribadi',
    desc: 'Publikasi infografis, poster, dan media edukasi karakter',
    defaultMode: 'Klasikal',
    icon: BookOpen,
    accentColor: 'border-teal-200 bg-teal-50/70 text-teal-900 hover:border-teal-400',
  },
  {
    type: 'Asesmen Kebutuhan (Need Assessment)',
    label: 'Asesmen Kebutuhan (AKPD)',
    group: 'Layanan Dasar',
    pilarId: 'Layanan Dasar',
    bidangDefault: 'Pribadi',
    desc: 'Pemetaan instrumen angket kebutuhan, sosiometri, dan profil siswa',
    defaultMode: 'Klasikal',
    icon: FileCheck,
    accentColor: 'border-teal-200 bg-teal-50/70 text-teal-900 hover:border-teal-400',
  },

  // GRUP 2: LAYANAN RESPONSIF (KONSELING)
  {
    type: 'Layanan Konseling Perorangan (Individual)',
    label: 'Konseling Individual',
    group: 'Layanan Responsif',
    pilarId: 'Layanan Responsif',
    bidangDefault: 'Pribadi',
    desc: 'Sesi tatap muka personal pengentasan masalah krisis, emosi & perilaku',
    defaultMode: 'Individu',
    icon: MessageSquare,
    accentColor: 'border-amber-200 bg-amber-50/70 text-amber-900 hover:border-amber-400',
  },
  {
    type: 'Layanan Konseling Kelompok',
    label: 'Konseling Kelompok',
    group: 'Layanan Responsif',
    pilarId: 'Layanan Responsif',
    bidangDefault: 'Sosial',
    desc: 'Pengentasan masalah bersama melalui dinamika terapeutik kelompok',
    defaultMode: 'Kelompok',
    icon: Users,
    accentColor: 'border-amber-200 bg-amber-50/70 text-amber-900 hover:border-amber-400',
  },
  {
    type: 'Layanan Konsultasi',
    label: 'Konsultasi / Kolaborasi',
    group: 'Layanan Responsif',
    pilarId: 'Layanan Responsif',
    bidangDefault: 'Sosial',
    desc: 'Koordinasi bersama wali kelas, orang tua, atau dewan guru',
    defaultMode: 'Individu',
    icon: HelpCircle,
    accentColor: 'border-amber-200 bg-amber-50/70 text-amber-900 hover:border-amber-400',
  },
  {
    type: 'Konferensi Kasus (Case Conference)',
    label: 'Konferensi Kasus (Rapat Kasus)',
    group: 'Layanan Responsif',
    pilarId: 'Layanan Responsif',
    bidangDefault: 'Pribadi',
    desc: 'Pembahasan kasus komprehensif bersama guru, pimpinan & pihak ahli',
    defaultMode: 'Individu',
    icon: Scale,
    accentColor: 'border-amber-200 bg-amber-50/70 text-amber-900 hover:border-amber-400',
  },
  {
    type: 'Kunjungan Rumah (Home Visit)',
    label: 'Home Visit (Kunjungan Rumah)',
    group: 'Layanan Responsif',
    pilarId: 'Layanan Responsif',
    bidangDefault: 'Sosial',
    desc: 'Kunjungan langsung ke kediaman orang tua/wali siswa',
    defaultMode: 'Individu',
    icon: Home,
    accentColor: 'border-amber-200 bg-amber-50/70 text-amber-900 hover:border-amber-400',
  },
  {
    type: 'Alih Tangan Kasus (Referral)',
    label: 'Alih Tangan Kasus (Referral)',
    group: 'Layanan Responsif',
    pilarId: 'Layanan Responsif',
    bidangDefault: 'Pribadi',
    desc: 'Rujukan kasus ke pihak luar (Psikolog, Puskesmas, Rumah Sakit, Dinsos)',
    defaultMode: 'Individu',
    icon: UserPlus,
    accentColor: 'border-amber-200 bg-amber-50/70 text-amber-900 hover:border-amber-400',
  },
  {
    type: 'Layanan Mediasi',
    label: 'Mediasi Konflik Siswa',
    group: 'Layanan Responsif',
    pilarId: 'Layanan Responsif',
    bidangDefault: 'Sosial',
    desc: 'Penyelesaian perselisihan, pertikaian, dan pemulihan relasi pertemanan',
    defaultMode: 'Kelompok',
    icon: Scale,
    accentColor: 'border-amber-200 bg-amber-50/70 text-amber-900 hover:border-amber-400',
  },

  // GRUP 3: PERENCANAAN INDIVIDUAL
  {
    type: 'Perencanaan Karir & Studi Lanjut',
    label: 'Perencanaan Karir & Studi',
    group: 'Perencanaan Individual',
    pilarId: 'Peminatan & Perencanaan Individual',
    bidangDefault: 'Karir',
    desc: 'Eksplorasi cita-cita, profil profesi, dan persiapan SMA/SMK',
    defaultMode: 'Individu',
    icon: GraduationCap,
    accentColor: 'border-blue-200 bg-blue-50/70 text-blue-900 hover:border-blue-400',
  },
  {
    type: 'Layanan Penempatan dan Penyaluran',
    label: 'Penempatan & Penyaluran',
    group: 'Perencanaan Individual',
    pilarId: 'Peminatan & Perencanaan Individual',
    bidangDefault: 'Karir',
    desc: 'Penyaluran minat bakat ekstrakurikuler & potensi unggulan',
    defaultMode: 'Individu',
    icon: Target,
    accentColor: 'border-blue-200 bg-blue-50/70 text-blue-900 hover:border-blue-400',
  },
  {
    type: 'Peminatan Studi & Ekstrakurikuler',
    label: 'Peminatan Ekstrakurikuler',
    group: 'Perencanaan Individual',
    pilarId: 'Peminatan & Perencanaan Individual',
    bidangDefault: 'Karir',
    desc: 'Pendampingan pemilihan klub bakat, olahraga, seni & kepemimpinan',
    defaultMode: 'Individu',
    icon: Award,
    accentColor: 'border-blue-200 bg-blue-50/70 text-blue-900 hover:border-blue-400',
  },
  {
    type: 'Konseling Perencanaan Individual',
    label: 'Konseling Masa Depan',
    group: 'Perencanaan Individual',
    pilarId: 'Peminatan & Perencanaan Individual',
    bidangDefault: 'Karir',
    desc: 'Sesi tatap muka khusus pemetaan rencana karir dan cita-cita pribadi',
    defaultMode: 'Individu',
    icon: Target,
    accentColor: 'border-blue-200 bg-blue-50/70 text-blue-900 hover:border-blue-400',
  },
  {
    type: 'Eksplorasi Bakat & Potensi',
    label: 'Eksplorasi Bakat & Potensi',
    group: 'Perencanaan Individual',
    pilarId: 'Peminatan & Perencanaan Individual',
    bidangDefault: 'Pribadi',
    desc: 'Identifikasi kecerdasan majemuk, kelebihan diri, dan minat spesifik',
    defaultMode: 'Individu',
    icon: Sparkles,
    accentColor: 'border-blue-200 bg-blue-50/70 text-blue-900 hover:border-blue-400',
  },
  {
    type: 'Portofolio & Rekam Jejak Siswa',
    label: 'Portofolio Rekam Jejak',
    group: 'Perencanaan Individual',
    pilarId: 'Peminatan & Perencanaan Individual',
    bidangDefault: 'Karir',
    desc: 'Penyusunan portofolio prestasi dan peta kemajuan belajar siswa',
    defaultMode: 'Individu',
    icon: Award,
    accentColor: 'border-blue-200 bg-blue-50/70 text-blue-900 hover:border-blue-400',
  },

  // GRUP 4: DUKUNGAN SISTEM
  {
    type: 'Kolaborasi Guru & Wali Kelas',
    label: 'Kolaborasi Guru & Wali Kelas',
    group: 'Dukungan Sistem',
    pilarId: 'Layanan Dukungan Sistem',
    bidangDefault: 'Non-Bidang (Dukungan Sistem)',
    desc: 'Rapat koordinasi dan sinkronisasi penanganan perkembangan siswa',
    defaultMode: 'Klasikal',
    icon: Network,
    accentColor: 'border-purple-200 bg-purple-50/70 text-purple-900 hover:border-purple-400',
  },
  {
    type: 'Kemitraan (Puskesmas/Psikolog/Mitra)',
    label: 'Kemitraan Mitra Ahli',
    group: 'Dukungan Sistem',
    pilarId: 'Layanan Dukungan Sistem',
    bidangDefault: 'Non-Bidang (Dukungan Sistem)',
    desc: 'Kerjasama dengan Puskesmas, Kepolisian, Psikolog, atau lembaga mitra',
    defaultMode: 'Klasikal',
    icon: Building2,
    accentColor: 'border-purple-200 bg-purple-50/70 text-purple-900 hover:border-purple-400',
  },
  {
    type: 'Manajemen & Administrasi BK',
    label: 'Manajemen & Administrasi BK',
    group: 'Dukungan Sistem',
    pilarId: 'Layanan Dukungan Sistem',
    bidangDefault: 'Non-Bidang (Dukungan Sistem)',
    desc: 'Penyusunan program tahunan, RPL, rekap data & arsip layanan BK',
    defaultMode: 'Klasikal',
    icon: Settings,
    accentColor: 'border-purple-200 bg-purple-50/70 text-purple-900 hover:border-purple-400',
  },
  {
    type: 'Pengembangan Keprofesian (MGBK/PKB)',
    label: 'Pengembangan Profesi (MGBK)',
    group: 'Dukungan Sistem',
    pilarId: 'Layanan Dukungan Sistem',
    bidangDefault: 'Non-Bidang (Dukungan Sistem)',
    desc: 'Keikutsertaan pelatihan keprofesian, workshop MGBK & riset BK',
    defaultMode: 'Individu',
    icon: Layers,
    accentColor: 'border-purple-200 bg-purple-50/70 text-purple-900 hover:border-purple-400',
  },
  {
    type: 'Evaluasi & Supervisi Program',
    label: 'Evaluasi & Supervisi Program',
    group: 'Dukungan Sistem',
    pilarId: 'Layanan Dukungan Sistem',
    bidangDefault: 'Non-Bidang (Dukungan Sistem)',
    desc: 'Audit berkala akuntabilitas, ketercapaian program & supervisi',
    defaultMode: 'Klasikal',
    icon: FileCheck,
    accentColor: 'border-purple-200 bg-purple-50/70 text-purple-900 hover:border-purple-400',
  },
];

// Topik Populer Khusus Konseling Individual
const TOPIK_POPULER = [
  { id: 'Motivasi', label: 'Motivasi Belajar', desc: 'Malas, nilai turun, tugas menumpuk' },
  { id: 'Disiplin & Telat', label: 'Disiplin & Telat', desc: 'Sering terlambat, bolos, seragam' },
  { id: 'Pertemanan', label: 'Pertemanan & Ejekan', desc: 'Diejek teman, dikucilkan, perselisihan' },
  { id: 'Game & Gadget', label: 'Game & Gadget', desc: 'Kecanduan HP, begadang main game' },
  { id: 'Emosi', label: 'Emosi & Perilaku', desc: 'Mudah marah, membangkang, gelisah' },
  { id: 'Masalah Rumah', label: 'Masalah Rumah', desc: 'Keluarga, ekonomi, kurang perhatian' },
];

// Materi Pilihan Khusus Bimbingan Klasikal
const MATERI_KLASIKAL_OPTIONS = [
  'Motivasi Belajar',
  'Anti Bullying',
  'Manajemen Waktu',
  'Karir & Masa Depan'
];

// Jenis Pelanggaran Catat Kasus
const PELANGGARAN_OPTIONS = [
  { name: 'Terlambat Hadir', points: 5 },
  { name: 'Membolos Sekolah / Jam Pelajaran', points: 15 },
  { name: 'Perselisihan / Berkelahi', points: 25 },
  { name: 'Perundungan (Bullying) & Ejekan', points: 25 },
  { name: 'Merokok / Rokok Elektrik', points: 30 },
  { name: 'Penggunaan HP saat KBM tanpa Izin', points: 10 },
  { name: 'Atribut Seragam Tidak Lengkap', points: 5 },
  { name: 'Membangkang Perintah Guru', points: 20 },
];

/**
 * Utilitas Meta AI Cerdas: Mengubah poin singkat menjadi kalimat formal laporan BK
 */
function polishTextWithMetaAi(category: string, rawText: string, context?: any): string {
  const clean = (rawText || '').trim();
  if (!clean) {
    if (category === 'konseling_individual') {
      return `Siswa mengikuti sesi konseling individual untuk membahas kendala ${context?.topic || 'perilaku dan kedisiplinan'}. Telah dilakukan pendampingan reflektif sehingga siswa menyadari dampaknya dan berkomitmen melakukan perbaikan perilaku secara terukur.`;
    }
    if (category === 'klasikal') {
      return `Telah dilaksanakan bimbingan klasikal dengan materi ${context?.materi || 'pengembangan karakter'}. Seluruh siswa mengikuti kegiatan dengan antusias, memahami poin pembahasan inti, dan siap mengaplikasikannya dalam kehidupan sekolah.`;
    }
    if (category === 'home_visit') {
      return `Telah dilaksanakan kunjungan rumah (home visit) untuk koordinasi perkembangan siswa bersama keluarga. Pihak keluarga menyambut baik dan menyepakati komitmen pengawasan serta pembiasaan belajar positif di rumah.`;
    }
    return `Pelaksanaan layanan bimbingan konseling berlangsung kondusif. Siswa menunjukkan pemahaman yang baik serta berkomitmen menindaklanjuti kesepakatan bimbingan secara bertanggung jawab.`;
  }

  // Polishing text based on keywords
  const lower = clean.toLowerCase();
  
  if (category === 'konseling_individual' || category === 'konseling_kelompok') {
    if (lower.includes('telat') || lower.includes('tidur') || lower.includes('game') || lower.includes('gadget') || lower.includes('malam')) {
      return `Siswa mengonfirmasi adanya kendala kedisiplinan (terlambat hadir ke sekolah) yang bersumber dari kebiasaan begadang bermain game hingga larut malam. Konselor membimbing siswa menyusun kesepakatan manajemen waktu baru serta pembatasan durasi gawai malam hari.`;
    }
    if (lower.includes('ejek') || lower.includes('rundung') || lower.includes('bully') || lower.includes('berantem') || lower.includes('teman')) {
      return `Teridentifikasi adanya gesekan interpersonal antarteman sebaya yang memicu ketegangan emosional siswa. Melalui konseling individual, siswa diajak mengekspresikan perasaannya secara asertif serta menyepakati langkah rekonsiliasi dan menjaga etika komunikasi pertemanan.`;
    }
    if (lower.includes('malas') || lower.includes('tugas') || lower.includes('nilai') || lower.includes('belajar')) {
      return `Siswa menyampaikan keluhan terkait penurunan motivasi belajar dan penumpukan tugas sekolah. Konselor membantu memetakan skala prioritas belajar mandiri, memberikan dorongan motivasi intrinsik, serta menyusun target pencapaian akademik bertahap.`;
    }
    return `Berdasarkan keterangan yang disampaikan (${clean}), konselor telah memberikan pendampingan konseling berbasis solusi (solution-focused) untuk mengurai akar masalah tersebut. Siswa memahami konsekuensi perilaku serta menyatakan komitmen perbaikan diri yang disepakati bersama.`;
  }

  if (category === 'klasikal') {
    return `Materi ${context?.materi || 'bimbingan'} telah disampaikan dengan ringkasan sebagai berikut: 1) Pemahaman konsep dasar dan urgensi topik bagi siswa; 2) Refleksi studi kasus nyata di lingkungan sekolah; 3) Rencana aksi penerapan sikap positif dalam rutinitas belajar harian.`;
  }

  if (category === 'home_visit') {
    return `Telah dilakukan kunjungan ke kediaman siswa dengan pokok temuan: ${clean}. Pihak orang tua/wali menyambut hangat kehadiran guru BK dan menyepakati sinergi pengawasan jadwal belajar serta pembiasaan karakter anak di rumah.`;
  }

  if (category === 'konsultasi') {
    return `Telah dilaksanakan koordinasi konsultasi terkait dinamika siswa (${clean}). Disepakati kesepahaman langkah pendampingan terpadu antara guru BK dan pihak mitra guna mengoptimalkan potensi serta kenyamanan belajar siswa.`;
  }

  if (category === 'konferensi_kasus') {
    return `Rapat konferensi kasus telah membahas secara komprehensif permasalahan siswa (${clean}). Seluruh peserta rapat menyepakati pembagian peran terstruktur demi penanganan kasus secara adil, rahasia, dan berorientasi pada pemulihan perilaku siswa.`;
  }

  if (category === 'alih_tangan') {
    return `Berdasarkan asesmen mendalam terhadap kondisi siswa (${clean}), kasus dialihtangankan ke lembaga/tenaga ahli terkait guna memperoleh penanganan psikososial yang lebih spesifik dan profesional demi kepentingan terbaik siswa.`;
  }

  if (category === 'catat_kasus') {
    return `Pada tanggal bersangkutan, siswa tercatat melakukan pelanggaran tata tertib sekolah (${clean}). Telah dilakukan pemanggilan awal dan pencatatan poin pelanggaran sesuai regulasi kedisiplinan sekolah yang berlaku.`;
  }

  return `Telah didokumentasikan catatan bimbingan konseling: ${clean}. Bimbingan dilaksanakan secara profesional dan akuntabel sesuai kode etik BK.`;
}

/**
 * Utilitas Rekomendasi Cerdas Meta AI Dinamis
 */
function getMetaAiRecommendation(serviceType: string, topic: string, rawText: string): string {
  const t = (topic || '').toLowerCase();
  const text = (rawText || '').toLowerCase();

  if (serviceType.includes('Konseling') || serviceType.includes('Perorangan')) {
    if (t.includes('disiplin') || t.includes('telat') || text.includes('telat') || text.includes('bolos')) {
      return 'Saran Meta AI: Untuk kasus Disiplin & Telat, coba tanyakan pola tidur siswa di malam hari, berikan kontrak perilaku 1 minggu, dan koordinasikan pantauan absen pagi bersama guru piket.';
    }
    if (t.includes('game') || t.includes('gadget') || text.includes('game') || text.includes('hp')) {
      return 'Saran Meta AI: Sarankan pembatasan gadget maksimal 1 jam pada malam hari, libatkan orang tua dalam pengawasan jam tidur, dan jadwalkan sesi konseling lanjutan minggu depan.';
    }
    if (t.includes('motivasi') || text.includes('nilai') || text.includes('malas')) {
      return 'Saran Meta AI: Identifikasi gaya belajar siswa (visual/auditori), terapkan teknik skala motivasi 1-10 untuk mengukur antusiasme, dan dorong penyusunan jadwal belajar mandiri realistis.';
    }
    if (t.includes('pertemanan') || text.includes('ejek') || text.includes('bully')) {
      return 'Saran Meta AI: Berikan ruang aman bagi siswa untuk katarsis emosional, latih ketegasan asertif menghadapi ejekan teman, dan lakukan mediasi tertutup tanpa saling mempermalukan.';
    }
    if (t.includes('emosi') || text.includes('marah') || text.includes('berantem')) {
      return 'Saran Meta AI: Latih teknik pernapasan menenangkan diri saat tersulut amarah, telusuri pemicu emosi yang belum terselesaikan, dan berikan penguatan positif atas upaya siswa menahan diri.';
    }
    if (t.includes('rumah') || text.includes('keluarga') || text.includes('ortu')) {
      return 'Saran Meta AI: Dengarkan dengan empati penuh tanpa menghakimi kondisi keluarga siswa, jadikan sekolah sebagai zona aman yang suportif, serta agendakan kunjungan rumah bila diperlukan.';
    }
    return 'Saran Meta AI: Terapkan pendekatan konseling empatik (Person-Centered), identifikasi kekuatan diri siswa, dan rumuskan 1 langkah konkret perubahan yang dapat dipantau bersama.';
  }

  if (serviceType.includes('Klasikal')) {
    return 'Saran Meta AI: Gunakan metode interaktif (studi kasus/permainan peran) selama 15 menit agar seluruh kelas aktif, bagikan lembar refleksi 3 poin, dan tindak lanjuti siswa yang tampak pasif.';
  }

  if (serviceType.includes('Home Visit') || serviceType.includes('Kunjungan')) {
    return 'Saran Meta AI: Buat kesepakatan tertulis jam belajar malam di rumah, pastikan orang tua memberi dukungan tanpa kekerasan verbal, dan jadwalkan pemantauan absensi harian di sekolah.';
  }

  if (serviceType.includes('Konsultasi') || serviceType.includes('Kolaborasi')) {
    return 'Saran Meta AI: Samakan persepsi penanganan siswa antara guru mata pelajaran dan wali kelas, tetapkan target perilaku mingguan, serta catat progres perkembangan dalam jurnal kelas.';
  }

  if (serviceType.includes('Konferensi') || serviceType.includes('Rapat')) {
    return 'Saran Meta AI: Fokuskan pembahasan pada solusi perbaikan siswa bukan sekadar sanksi, tuangkan hasil dalam berita acara resmi bertandatangan, dan jaga kerahasiaan dokumen dari publik.';
  }

  if (serviceType.includes('Alih Tangan') || serviceType.includes('Referral')) {
    return 'Saran Meta AI: Siapkan resume kronologis dan dokumen pendukung bagi tenaga ahli rujukan, mintakan izin tertulis kepala sekolah & orang tua, serta lakukan monitoring berkala.';
  }

  return 'Saran Meta AI: Pertahankan pendekatan disiplin positif dan pastikan hasil kesepakatan bimbingan dicatat secara akuntabel untuk pelaporan kinerja BK.';
}

export default function TambahLayananForm({
  students = [],
  violations = [],
  existingServices = [],
  preSelectedStudentId,
  presetServiceData,
  onClearPresetServiceData,
  onSaveService,
  onCancel,
  onNavigateToRiwayat,
}: TambahLayananFormProps) {
  // SUCCESS SCREEN STATE
  const [savedSuccessService, setSavedSuccessService] = useState<CounselingService | null>(null);

  // WIZARD STEP STATE: 1 = Pilih Layanan, 2 = Pilih Siswa & Mode, 3 = Form Sesuai Layanan
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // LANGKAH 1 STATES
  const [selectedService, setSelectedService] = useState<ServiceDefinition>(() => {
    if (presetServiceData?.serviceType) {
      const match = ALL_16_SERVICES.find((s) => s.type === presetServiceData.serviceType);
      if (match) return match;
    }
    return ALL_16_SERVICES.find((s) => s.type === 'Layanan Konseling Perorangan (Individual)') || ALL_16_SERVICES[7];
  });
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>('semua');

  // LANGKAH 2 STATES
  const [mode, setMode] = useState<'Individu' | 'Kelompok' | 'Klasikal'>('Individu');
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');

  // LANGKAH 3 STATES (TAILORED FIELDS)
  // Shared fields
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - tzOffset).toISOString().slice(0, 10);
  });
  const [time, setTime] = useState<string>(() => {
    const today = new Date();
    return `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
  });
  const [status, setStatus] = useState<'Selesai' | 'Terjadwal'>('Selesai');

  // Counselor resolution from localStorage or default
  const activeCounselorInfo = useMemo(() => {
    try {
      const raw = localStorage.getItem('bk_counselors');
      const activeId = localStorage.getItem('bk_active_counselor_id');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const found = list.find((c: any) => c.id === activeId);
          if (found) {
            return {
              name: found.name || 'Aulia Aji Sasongko, S.Pd.',
              nip: found.nip || '19931231 202221 1 002',
            };
          }
          if (list[0]) {
            return {
              name: list[0].name || 'Aulia Aji Sasongko, S.Pd.',
              nip: list[0].nip || '19931231 202221 1 002',
            };
          }
        }
      }
    } catch (e) {
      // ignore
    }
    return {
      name: 'Aulia Aji Sasongko, S.Pd.',
      nip: '19931231 202221 1 002',
    };
  }, []);

  // 1. KONSELING INDIVIDUAL STANDAR BK (ACCORDION BAGIAN A - F)
  // Accordion active tab: 'A' is OPEN by default, B-F are CLOSED by default
  const [activeAccordion, setActiveAccordion] = useState<string | null>('A');

  // Bagian A - Identitas
  const [counselingTempat, setCounselingTempat] = useState<'Ruang BK' | 'Kelas' | string>('Ruang BK');
  const [counselingPertemuanKe, setCounselingPertemuanKe] = useState<number>(1);
  const [counselingSifat, setCounselingSifat] = useState<'Sukarela' | 'Rujukan'>('Sukarela');

  // Bagian B - Masalah
  const [counselingTopic, setCounselingTopic] = useState('Motivasi');
  const [counselingRawStory, setCounselingRawStory] = useState('');
  const [counselingAiPolishedStory, setCounselingAiPolishedStory] = useState('');
  const [counselingUseAiStory, setCounselingUseAiStory] = useState(false);
  const [counselingTingkat, setCounselingTingkat] = useState<'Ringan' | 'Sedang' | 'Berat'>('Sedang');

  // Bagian C - Proses
  const [counselingTeknik, setCounselingTeknik] = useState<string[]>([
    'Solution-Focused Brief Counseling (SFBC)',
    'Mendengarkan Aktif (Active Listening)',
  ]);
  const [counselingDinamika, setCounselingDinamika] = useState<string>('');

  // Bagian D - Hasil
  const [counselingHasilKategori, setCounselingHasilKategori] = useState<
    'Paham Masalah' | 'Temukan Solusi' | 'Komitmen Perubahan' | 'Perlu Lanjut' | 'Dirujuk'
  >('Temukan Solusi');
  const [counselingKesimpulan, setCounselingKesimpulan] = useState<string>('');
  const [counselingKomitmenSiswa, setCounselingKomitmenSiswa] = useState<string>('');

  // Bagian E - Tindak Lanjut
  const [counselingFollowUp, setCounselingFollowUp] = useState<'Kasih Nasehat' | 'Panggil Ortu' | 'Pantau 1 Minggu'>('Pantau 1 Minggu');
  const [counselingTindakLanjutMulti, setCounselingTindakLanjutMulti] = useState<string[]>([
    'Pantau 1 Minggu',
  ]);
  const [counselingJadwalEvaluasi, setCounselingJadwalEvaluasi] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [counselingStatusAkhir, setCounselingStatusAkhir] = useState<'Selesai' | 'Berlanjut' | 'Dirujuk'>('Selesai');

  // Bagian F - Penutup
  const [counselingAgreedConfidentiality, setCounselingAgreedConfidentiality] = useState<boolean>(true);

  // Helper toggle teknik
  const handleToggleTeknik = (t: string) => {
    setCounselingTeknik((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  // Helper toggle tindak lanjut multi
  const handleToggleTindakLanjutMulti = (tl: string) => {
    setCounselingTindakLanjutMulti((prev) =>
      prev.includes(tl) ? prev.filter((item) => item !== tl) : [...prev, tl]
    );
  };

  // Helper AI bantu tulis dinamika sesi BK
  const handleBantuTulisDinamika = () => {
    const studentName = selectedStudents[0]?.name || 'Siswa';
    const teknikStr = counselingTeknik.length > 0 ? counselingTeknik.join(', ') : 'Mendengarkan Aktif & Empati';
    const draft = `Pada sesi ini, ${studentName} awalnya tampak tertutup dan cemas, namun berangsur terbuka setelah konselor menerapkan teknik ${teknikStr}. Konseli secara mandiri mampu mengekspresikan kendala yang dialami seputar ${counselingTopic}, memahami konsekuensi perilaku diri, dan merespons bimbingan secara aktif serta menyepakati arah perubahan diri yang positif.`;
    setCounselingDinamika(draft);
    showToast('✨ Dinamika sesi berhasil disusun dengan bahasa resmi BK!', 'success');
  };

  // 2. Bimbingan Klasikal Specific (Standar RPL & POP BK)
  // Accordion active tab: 'A' is open by default, B-D are closed
  const [activeAccordionKlasikal, setActiveAccordionKlasikal] = useState<string | null>('A');

  // Tahap 2 Klasikal States
  const [klasikalHadir, setKlasikalHadir] = useState<number>(32);
  const [klasikalTidakHadir, setKlasikalTidakHadir] = useState<number>(0);
  const [klasikalJamKe, setKlasikalJamKe] = useState<string>('Jam Ke- 1 - 2 (07.15 - 08.35 WIB)');
  const [klasikalTempat, setKlasikalTempat] = useState<string>('Ruang Kelas 8A');

  // Tahap 3 Klasikal - Bagian A (RPL)
  const [klasikalBidang, setKlasikalBidang] = useState<BidangBimbinganType>('Belajar');
  const [klasikalTopik, setKlasikalTopik] = useState<string>('Motivasi Belajar & Manajemen Waktu');
  const [klasikalTujuan, setKlasikalTujuan] = useState<string>(
    '1. Peserta didik dapat menganalisis faktor penghambat motivasi belajar (Kognitif).\n2. Peserta didik mampu membangun kesadaran positif untuk tidak menunda tugas sekolah (Afektif).\n3. Peserta didik dapat merumuskan jadwal belajar mandiri harian secara teratur (Psikomotorik).'
  );

  // Tahap 3 Klasikal - Bagian B (Pelaksanaan)
  const [klasikalMateriUraian, setKlasikalMateriUraian] = useState<string>(
    'Pemberian pemahaman mengenai pentingnya motivasi intrinsik dalam belajar, bahaya prokrastinasi (kebiasaan menunda tugas), serta strategi pembagian waktu belajar dan istirahat menggunakan teknik manajemen waktu teratur.'
  );
  const [klasikalMetode, setKlasikalMetode] = useState<string[]>([
    'Ceramah',
    'Diskusi Kelompok',
    'Tanya Jawab',
  ]);
  const [klasikalMedia, setKlasikalMedia] = useState<string[]>([
    'PPT',
    'Video',
    'Lembar Kerja',
  ]);

  // Tahap 3 Klasikal - Bagian C (Evaluasi)
  const [klasikalLaiseg, setKlasikalLaiseg] = useState<string>(
    'Siswa merasa antusias, aktif bertanya dan berdiskusi kelompok, serta memahami materi dengan baik.'
  );
  const [klasikalLaijapen, setKlasikalLaijapen] = useState<string>(
    'Siswa mulai mengumpulkan tugas tepat waktu dan mengurangi waktu bermain gadget dalam 1 minggu ke depan.'
  );
  const [klasikalLaijapang, setKlasikalLaijapang] = useState<string>(
    'Terbentuknya kemandirian belajar dan peningkatan prestasi akademik konsisten sepanjang semester.'
  );
  const [klasikalHasilEvaluasi, setKlasikalHasilEvaluasi] = useState<'Tercapai' | 'Sebagian' | 'Belum Tercapai'>('Tercapai');

  // Tahap 3 Klasikal - Bagian D (Tindak Lanjut)
  const [klasikalTindakLanjutChecklist, setKlasikalTindakLanjutChecklist] = useState<string[]>([
    'Lanjut Materi Berikutnya',
  ]);
  const [klasikalSiswaPerluLanjut, setKlasikalSiswaPerluLanjut] = useState<string>('');
  const [klasikalRencanaBerikutnya, setKlasikalRencanaBerikutnya] = useState<string>(
    'Pertemuan ke-2 minggu depan: Strategi Menghadapi Ujian & Regulasi Emosi Belajar'
  );

  // Fallbacks for compatibility with legacy klasikal fields
  const [klasikalMateri, setKlasikalMateri] = useState('Motivasi Belajar');
  const [klasikalCustomMateri, setKlasikalCustomMateri] = useState('');
  const [klasikalRawSummary, setKlasikalRawSummary] = useState('');
  const [klasikalAiSummary, setKlasikalAiSummary] = useState('');
  const [klasikalUseAi, setKlasikalUseAi] = useState(false);
  const [klasikalFollowUp, setKlasikalFollowUp] = useState<'Evaluasi' | 'Lanjut ke Sesi Berikutnya'>('Evaluasi');

  // Helper toggle Klasikal metode
  const handleToggleMetode = (m: string) => {
    setKlasikalMetode((prev) =>
      prev.includes(m) ? prev.filter((item) => item !== m) : [...prev, m]
    );
  };

  // Helper toggle Klasikal media
  const handleToggleMedia = (med: string) => {
    setKlasikalMedia((prev) =>
      prev.includes(med) ? prev.filter((item) => item !== med) : [...prev, med]
    );
  };

  // Helper toggle Klasikal tindak lanjut
  const handleToggleKlasikalTindakLanjut = (tl: string) => {
    setKlasikalTindakLanjutChecklist((prev) =>
      prev.includes(tl) ? prev.filter((item) => item !== tl) : [...prev, tl]
    );
  };

  // Helper AI buatkan tujuan dari topik
  const handleBuatkanTujuanDariTopik = () => {
    const t = klasikalTopik.trim() || 'Pengembangan Diri Siswa';
    const b = klasikalBidang || 'Belajar';
    const tujuan = `1. Peserta didik dapat menganalisis konsep dan urgensi ${t} pada bidang bimbingan ${b} (Aspek Kognitif/Pengenalan).\n2. Peserta didik mampu merefleksikan nilai-nilai positif serta menunjukkan sikap terbuka terhadap ${t} (Aspek Afektif/Akomodasi).\n3. Peserta didik dapat merumuskan langkah nyata dan mempraktikkan keterampilan ${t} dalam kehidupan sehari-hari (Aspek Tindakan/Psikomotorik).`;
    setKlasikalTujuan(tujuan);
    showToast('✨ Tujuan layanan berhasil dirumuskan secara komprehensif!', 'success');
  };

  // Helper AI bantu tulis materi klasikal
  const handleBantuTulisMateriKlasikal = () => {
    const t = klasikalTopik.trim() || 'Motivasi Belajar';
    const draft = `Materi Pokok Bimbingan Klasikal: "${t}"\n\n1. Pengertian & Esensi Topik:\nMenjelaskan pengertian ${t}, faktor-faktor pendukung internal (dalam diri) dan eksternal (lingkungan belajar), serta mengapa topik ini sangat penting bagi siswa.\n\n2. Refleksi Masalah Nyata di Sekolah:\nSiswa diajak mengidentifikasi kendala atau godaan nyata yang sering timbul dan menganalisis dampaknya terhadap masa depan.\n\n3. Langkah Solusi & Komitmen Nyata:\nSiswa merumuskan komitmen 3 tindakan nyata yang segera diterapkan dalam rutinitas sekolah dan belajar mandiri.`;
    setKlasikalMateriUraian(draft);
    showToast('✨ Uraian materi berhasil disusun dengan struktur standar BK!', 'success');
  };

  // Helper select class specifically for Klasikal
  const handleSelectKlasikalClass = (cls: string) => {
    setSelectedClass(cls);
    const inClass = students.filter((s) => s.class === cls);
    setSelectedStudents(inClass);
    setKlasikalHadir(inClass.length > 0 ? inClass.length : 32);
    setKlasikalTidakHadir(0);
    setKlasikalTempat(`Ruang Kelas ${cls}`);
  };

  // 3. Bimbingan Kelompok Specific
  const [bimbKelTema, setBimbKelTema] = useState('');
  const [bimbKelRawDinamika, setBimbKelRawDinamika] = useState('');
  const [bimbKelAiDinamika, setBimbKelAiDinamika] = useState('');
  const [bimbKelUseAi, setBimbKelUseAi] = useState(false);

  // 4. Konseling Kelompok Specific
  const [konsKelPeranSiswa, setKonsKelPeranSiswa] = useState('');
  const [konsKelRawSummary, setKonsKelRawSummary] = useState('');
  const [konsKelAiSummary, setKonsKelAiSummary] = useState('');
  const [konsKelUseAi, setKonsKelUseAi] = useState(false);

  // 5. Home Visit (Kunjungan Rumah) Specific
  // Tahap 2 States
  const [homeVisitAlamat, setHomeVisitAlamat] = useState('');
  const [homeVisitNamaOrtu, setHomeVisitNamaOrtu] = useState('');
  const [homeVisitNoHpOrtu, setHomeVisitNoHpOrtu] = useState('');
  const [homeVisitTanggal, setHomeVisitTanggal] = useState<string>(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - tzOffset).toISOString().slice(0, 10);
  });
  const [homeVisitJamBerangkat, setHomeVisitJamBerangkat] = useState('09:00 WIB');
  const [homeVisitPetugas, setHomeVisitPetugas] = useState('Guru BK + Wali Kelas');
  const [homeVisitTujuan, setHomeVisitTujuan] = useState<'Absen Lama' | 'Masalah Perilaku' | 'Tindak Lanjut Konseling' | 'Masalah Ekonomi' | 'Lainnya'>('Absen Lama');
  const [homeVisitTujuanCustom, setHomeVisitTujuanCustom] = useState('');

  // Tahap 3 Accordion: 'A' is open by default, 'B' and 'C' closed
  const [activeAccordionHomeVisit, setActiveAccordionHomeVisit] = useState<'A' | 'B' | 'C' | null>('A');

  // Accordion A: Pelaksanaan
  const [homeVisitYangDitemui, setHomeVisitYangDitemui] = useState<'Ayah' | 'Ibu' | 'Wali' | 'Lainnya'>('Ibu');
  const [homeVisitYangDitemuiLainnya, setHomeVisitYangDitemuiLainnya] = useState('');
  const [homeVisitKondisiRumah, setHomeVisitKondisiRumah] = useState('');
  const [homeVisitRawHasil, setHomeVisitRawHasil] = useState('');
  const [homeVisitAiHasil, setHomeVisitAiHasil] = useState('');
  const [homeVisitUseAi, setHomeVisitUseAi] = useState(false);

  // Accordion B: Kesepakatan
  const [homeVisitKesepakatanOrtu, setHomeVisitKesepakatanOrtu] = useState('');
  const [homeVisitKomitmenOrtu, setHomeVisitKomitmenOrtu] = useState('');
  const [homeVisitKomitmenSiswa, setHomeVisitKomitmenSiswa] = useState('');
  const [homeVisitKomitmenSekolah, setHomeVisitKomitmenSekolah] = useState('');

  // Accordion C: Bukti & Penutup
  const [homeVisitFotoBukti, setHomeVisitFotoBukti] = useState<string | null>(null);
  const [homeVisitFotoName, setHomeVisitFotoName] = useState<string>('');
  const [homeVisitTtdOrtu, setHomeVisitTtdOrtu] = useState('');
  const [homeVisitStatus, setHomeVisitStatus] = useState<'Berhasil Ditemui' | 'Rumah Kosong' | 'Ditolak'>('Berhasil Ditemui');
  const [homeVisitTindakLanjut, setHomeVisitTindakLanjut] = useState<string[]>([
    'Pantau 1 Minggu'
  ]);
  const [homeVisitJadwalPantau, setHomeVisitJadwalPantau] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  // Helper toggle Home Visit tindak lanjut
  const handleToggleHomeVisitTindakLanjut = (item: string) => {
    setHomeVisitTindakLanjut((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // Helper AI rapikan hasil pembicaraan Home Visit
  const handleBantuRapikanHasilHomeVisit = () => {
    const st = selectedStudents[0];
    const stName = st ? st.name : 'Siswa';
    const person = homeVisitYangDitemui === 'Lainnya' ? (homeVisitYangDitemuiLainnya || 'Keluarga') : homeVisitYangDitemui;
    const parentLabel = homeVisitNamaOrtu ? `Bapak/Ibu ${homeVisitNamaOrtu}` : `Orang Tua / Wali`;
    const raw = homeVisitRawHasil.trim();

    const polished = `1. Pelaksanaan & Penerimaan:\nTelah dilaksanakan kunjungan rumah (Home Visit) ke kediaman ananda ${stName} dan diterima secara baik oleh ${person} (${parentLabel}). Pertemuan berlangsung dalam suasana terbuka, komunikatif, dan penuh kekeluargaan.\n\n2. Kondisi Lingkungan & Temuan Fakta:\n${homeVisitKondisiRumah ? `Kondisi tempat tinggal: ${homeVisitKondisiRumah}. ` : ''}${raw || 'Pihak sekolah dan keluarga mendiskusikan kendala kehadiran serta faktor pemicu kesulitan belajar siswa di rumah.'}\n\n3. Hasil Pembicaraan:\nStatus kunjungan "${homeVisitStatus}". Pihak orang tua menyambut positif perhatian dari sekolah dan bersepakat membangun komunikasi aktif demi masa depan ananda.`;

    setHomeVisitAiHasil(polished);
    setHomeVisitUseAi(true);
    showToast('✨ Narasi hasil pembicaraan berhasil dirapikan dengan standar laporan BK!', 'success');
  };

  // Helper photo upload for Home Visit
  const handleHomeVisitPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('⚠️ Ukuran foto maksimal 5 MB', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setHomeVisitFotoBukti(event.target?.result as string);
        setHomeVisitFotoName(file.name);
        showToast('📷 Foto dokumentasi home visit berhasil dimuat!', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  // 6. Konsultasi / Kolaborasi Specific
  const [konsultasiDiajakSiapa, setKonsultasiDiajakSiapa] = useState<'Wali Kelas' | 'Ortu' | 'Dewan Guru' | 'Psikolog'>('Wali Kelas');
  const [konsultasiRawMasalah, setKonsultasiRawMasalah] = useState('');
  const [konsultasiRawHasil, setKonsultasiRawHasil] = useState('');
  const [konsultasiAiHasil, setKonsultasiAiHasil] = useState('');
  const [konsultasiUseAi, setKonsultasiUseAi] = useState(false);

  // 7. Konferensi Kasus / Rapat Kasus Specific
  const [konferensiKasus, setKonferensiKasus] = useState('');
  const [konferensiPeserta, setKonferensiPeserta] = useState<string[]>(['Guru BK', 'Wali Kelas']);
  const [konferensiRawKeputusan, setKonferensiRawKeputusan] = useState('');
  const [konferensiAiKeputusan, setKonferensiAiKeputusan] = useState('');
  const [konferensiUseAi, setKonferensiUseAi] = useState(false);

  // 8. Alih Tangan Kasus Specific
  const [alihTanganDirujukKe, setAlihTanganDirujukKe] = useState<'Psikolog' | 'Pihak Luar' | 'Guru BK Lain'>('Psikolog');
  const [alihTanganRawAlasan, setAlihTanganRawAlasan] = useState('');
  const [alihTanganAiSurat, setAlihTanganAiSurat] = useState('');
  const [alihTanganUseAi, setAlihTanganUseAi] = useState(false);

  // 9. Catat Kasus Specific
  const [catatKasusJenis, setCatatKasusJenis] = useState('Terlambat Hadir');
  const [catatKasusPoin, setCatatKasusPoin] = useState(5);
  const [catatKasusRawKronologi, setCatatKasusRawKronologi] = useState('');
  const [catatKasusAiKronologi, setCatatKasusAiKronologi] = useState('');
  const [catatKasusUseAi, setCatatKasusUseAi] = useState(false);
  const [catatKasusSanksi, setCatatKasusSanksi] = useState<'Kasih Nasehat' | 'Surat Peringatan' | 'Panggil Ortu'>('Kasih Nasehat');

  // 10. Absen Kelas Specific
  const [absenAttendanceMap, setAbsenAttendanceMap] = useState<Record<string, 'Hadir' | 'Sakit' | 'Izin' | 'Alpa'>>({});

  // Sync address, parent name & phone from student when selected
  useEffect(() => {
    if (selectedStudents.length > 0) {
      const s = selectedStudents[0];
      if (!homeVisitAlamat) {
        setHomeVisitAlamat(`RT 02 / RW 04, Kediaman Siswa ${s.name}, Susukan`);
      }
      if (!homeVisitNamaOrtu) {
        const pName = `Bapak / Ibu Wali dari ${s.name}`;
        setHomeVisitNamaOrtu(pName);
        if (!homeVisitTtdOrtu) setHomeVisitTtdOrtu(pName);
      }
      if (!homeVisitNoHpOrtu) {
        const nisDigits = s.nis ? s.nis.replace(/\D/g, '').slice(-4) : '2489';
        setHomeVisitNoHpOrtu(`0812-34${nisDigits}-7890`);
      }
    }
  }, [selectedStudents]);

  // Sync unhandled violation for Konferensi Kasus / Catat Kasus
  useEffect(() => {
    if (selectedStudents.length > 0 && violations && violations.length > 0) {
      const v = violations.find((item) => item.studentId === selectedStudents[0].id);
      if (v) {
        setKonferensiKasus(v.category);
        if (!catatKasusRawKronologi) {
          setCatatKasusRawKronologi(v.notes || v.category);
        }
      }
    }
  }, [selectedStudents, violations, catatKasusRawKronologi]);

  // Auto preset data handling
  useEffect(() => {
    if (preSelectedStudentId && students.length > 0) {
      const found = students.find((s) => s.id === preSelectedStudentId);
      if (found) {
        setSelectedStudents([found]);
        setMode('Individu');
      }
    }
  }, [preSelectedStudentId, students]);

  useEffect(() => {
    if (presetServiceData) {
      if (presetServiceData.serviceType) {
        const matched = ALL_16_SERVICES.find((s) => s.type === presetServiceData.serviceType);
        if (matched) {
          setSelectedService(matched);
          setMode(matched.defaultMode);
        }
      }
      if (presetServiceData.studentIds && presetServiceData.studentIds.length > 0) {
        const list = students.filter((s) => presetServiceData.studentIds?.includes(s.id));
        if (list.length > 0) {
          setSelectedStudents(list);
          if (list.length > 1) setMode('Kelompok');
        }
      }
      if (presetServiceData.problem) {
        setCounselingTopic(presetServiceData.problem);
        setKonsultasiRawMasalah(presetServiceData.problem);
        setKonferensiKasus(presetServiceData.problem);
        setAlihTanganRawAlasan(presetServiceData.problem);
      }
      if (presetServiceData.description) {
        setCounselingRawStory(presetServiceData.description);
        setKlasikalRawSummary(presetServiceData.description);
        setHomeVisitRawHasil(presetServiceData.description);
      }
    }
  }, [presetServiceData, students]);

  // Sync mode when selected service changes
  const handleSelectService = (srv: ServiceDefinition) => {
    setSelectedService(srv);
    setMode(srv.defaultMode);
  };

  // Available classes for Klasikal & Absen
  const availableClasses = useMemo(() => {
    const list = Array.from(new Set(students.map((s) => s.class))).filter(Boolean).sort();
    return list.length > 0 ? list : ['7A', '7B', '7C', '7D', '8A', '8B', '8C', '8D', '9A', '9B', '9C', '9D'];
  }, [students]);

  useEffect(() => {
    if (!selectedClass && availableClasses.length > 0) {
      setSelectedClass(availableClasses[0]);
    }
  }, [availableClasses, selectedClass]);

  // Quick Action List: "Kasus Perlu Tindak Lanjut" (Ahmad Nur Wahid, dll)
  const quickCases = useMemo(() => {
    const list: { student: Student; reason: string; points: number }[] = [];
    const addedIds = new Set<string>();

    (violations || []).forEach((v) => {
      if (!v.handledBy || v.handledBy === 'Belum Ditangani' || !v.handlingProgress) {
        if (!addedIds.has(v.studentId)) {
          const s = students.find((st) => st.id === v.studentId);
          if (s) {
            list.push({
              student: s,
              reason: v.category,
              points: v.pointsAdded || 0,
            });
            addedIds.add(s.id);
          }
        }
      }
    });

    students.forEach((s) => {
      if (!addedIds.has(s.id) && (s.violationPoints || 0) >= 10) {
        list.push({
          student: s,
          reason: `${s.violationPoints} Poin Pelanggaran`,
          points: s.violationPoints,
        });
        addedIds.add(s.id);
      }
    });

    if (list.length === 0) {
      students.slice(0, 4).forEach((s) => {
        list.push({
          student: s,
          reason: s.violationPoints > 0 ? `${s.violationPoints} Poin Kasus` : 'Siswa Sekolah',
          points: s.violationPoints || 0,
        });
      });
    }

    return list.slice(0, 6);
  }, [violations, students]);

  // Filtered students for Step 2
  const filteredStudents = useMemo(() => {
    const q = studentSearchTerm.trim().toLowerCase();
    if (!q) return students.slice(0, 8);
    return students
      .filter((s) => {
        return (
          s.name.toLowerCase().includes(q) ||
          s.class.toLowerCase().includes(q) ||
          (s.nis || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 10);
  }, [students, studentSearchTerm]);

  // Filtered services for Step 1
  const filteredServices = useMemo(() => {
    let result = ALL_16_SERVICES;
    if (activeGroupFilter !== 'semua') {
      result = result.filter((s) => s.group === activeGroupFilter);
    }
    if (serviceSearchTerm.trim()) {
      const q = serviceSearchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          s.desc.toLowerCase().includes(q) ||
          s.group.toLowerCase().includes(q)
      );
    }
    return result;
  }, [serviceSearchTerm, activeGroupFilter]);

  const handleSelectAllStudentsInClass = (className: string) => {
    const inClass = students.filter((s) => s.class === className);
    setSelectedStudents(inClass);
    // Init attendance map for Absen Kelas
    const map: Record<string, 'Hadir' | 'Sakit' | 'Izin' | 'Alpa'> = {};
    inClass.forEach((st) => {
      map[st.id] = 'Hadir';
    });
    setAbsenAttendanceMap(map);
    showToast(`✅ ${inClass.length} siswa kelas ${className} terpilih.`, 'info');
  };

  const handleToggleStudent = (student: Student) => {
    if (mode === 'Individu') {
      setSelectedStudents([student]);
      setStudentSearchTerm('');
    } else {
      const exists = selectedStudents.some((s) => s.id === student.id);
      if (exists) {
        setSelectedStudents((prev) => prev.filter((s) => s.id !== student.id));
      } else {
        setSelectedStudents((prev) => [...prev, student]);
      }
    }
  };

  // Student display name for Step 3
  const studentDisplayText = useMemo(() => {
    if (selectedStudents.length === 0) return 'Belum ada siswa';
    if (mode === 'Individu') {
      return `${selectedStudents[0].name} (${selectedStudents[0].class})`;
    }
    if (mode === 'Klasikal') {
      return `Kelas ${selectedClass || selectedStudents[0]?.class || 'Semua'} (${selectedStudents.length} Siswa)`;
    }
    return `${selectedStudents[0].name} + ${selectedStudents.length - 1} lainnya (${selectedStudents.length} Siswa)`;
  }, [selectedStudents, mode, selectedClass]);

  // Determine which specialized form is active in Step 3
  const serviceTypeLower = selectedService.type.toLowerCase();
  const serviceLabelLower = selectedService.label.toLowerCase();

  const isFormAbsen = serviceLabelLower.includes('absen') || serviceTypeLower.includes('absen');
  const isFormCatatKasus = serviceLabelLower.includes('catat kasus') || serviceTypeLower.includes('kasus') && !serviceLabelLower.includes('konferensi');
  const isFormKonselingIndividual = selectedService.type === 'Layanan Konseling Perorangan (Individual)';
  const isBimbinganKlasikalOnly = selectedService.type === 'Bimbingan Klasikal';
  const isFormBimbinganKlasikal = isBimbinganKlasikalOnly || selectedService.type === 'Layanan Informasi' || selectedService.type === 'Layanan Orientasi' || selectedService.type === 'Papan Bimbingan & Media BK';
  const isFormBimbinganKelompok = selectedService.type === 'Bimbingan Kelompok' || selectedService.type === 'Layanan Penguasaan Konten';
  const isFormKonselingKelompok = selectedService.type === 'Layanan Konseling Kelompok' || selectedService.type === 'Layanan Mediasi';
  const isHomeVisitOnly = selectedService.type === 'Kunjungan Rumah (Home Visit)' || serviceLabelLower.includes('home visit') || serviceTypeLower.includes('kunjungan rumah');
  const isFormHomeVisit = isHomeVisitOnly;
  const isFormKonsultasi = selectedService.type === 'Layanan Konsultasi' || selectedService.type === 'Kolaborasi Guru & Wali Kelas' || selectedService.type === 'Kemitraan (Puskesmas/Psikolog/Mitra)';
  const isFormKonferensiKasus = selectedService.type === 'Konferensi Kasus (Case Conference)';
  const isFormAlihTangan = selectedService.type === 'Alih Tangan Kasus (Referral)';

  // Meta AI Live Recommendation for the current form
  const currentActiveStory = isFormKonselingIndividual
    ? counselingRawStory
    : isFormBimbinganKlasikal
    ? (klasikalTopik || klasikalRawSummary)
    : isFormHomeVisit
    ? homeVisitRawHasil
    : isFormKonsultasi
    ? konsultasiRawMasalah
    : isFormKonferensiKasus
    ? konferensiKasus
    : '';

  const liveMetaAiRecommendation = useMemo(() => {
    return getMetaAiRecommendation(selectedService.label, counselingTopic, currentActiveStory);
  }, [selectedService.label, counselingTopic, currentActiveStory]);

  // Helper build complete official BK Counseling Record for Konseling Individual
  const buildKonselingIndividualRecord = (): CounselingService => {
    const finalStory = counselingUseAiStory && counselingAiPolishedStory 
      ? counselingAiPolishedStory 
      : (counselingRawStory || `Siswa berkonsultasi mengenai ${counselingTopic}.`);

    const descParts = [
      `[IDENTITAS & TEMPAT] Pertemuan Ke-${counselingPertemuanKe} di ${counselingTempat} (${counselingSifat}). Konselor: ${activeCounselorInfo.name}.`,
      `[URAIAN MASALAH] ${finalStory} (Tingkat Masalah: ${counselingTingkat})`,
      counselingTeknik.length > 0 ? `[TEKNIK KONSELING] ${counselingTeknik.join(', ')}` : '',
      counselingDinamika ? `[DINAMIKA SESI] ${counselingDinamika}` : '',
    ].filter(Boolean).join('\n\n');

    const outputParts = [
      `[HASIL KONSELING] Kategori: ${counselingHasilKategori}.`,
      counselingKesimpulan ? `Kesimpulan: ${counselingKesimpulan}` : '',
      counselingKomitmenSiswa ? `Komitmen Siswa: "${counselingKomitmenSiswa}"` : '',
    ].filter(Boolean).join(' ');

    const followUpParts = [
      counselingTindakLanjutMulti.length > 0 ? counselingTindakLanjutMulti.join(', ') : counselingFollowUp,
      counselingJadwalEvaluasi ? `(Jadwal Evaluasi: ${counselingJadwalEvaluasi})` : '',
    ].filter(Boolean).join(' ');

    const startH = time.split(':')[0] || '08';
    const startM = time.split(':')[1] || '00';
    const endH = String((parseInt(startH, 10) + 1) % 24).padStart(2, '0');
    const endTimeStr = `${endH}:${startM}`;

    return {
      id: `srv-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      serviceType: selectedService.type,
      bkComponent: selectedService.pilarId,
      bidangBimbingan: selectedService.bidangDefault,
      students: selectedStudents.map((s) => ({
        id: s.id,
        name: s.name,
        class: s.class,
        nis: s.nis || '-',
      })),
      problem: `${counselingTopic} (${counselingTingkat})`,
      description: descParts,
      output: outputParts || `Siswa telah menyelesaikan konseling individual dengan kesepakatan ${counselingHasilKategori}.`,
      followUp: followUpParts || 'Pantau 1 Minggu',
      status: (counselingStatusAkhir === 'Dirujuk' ? 'Selesai' : counselingStatusAkhir) as any,
      date,
      startTime: time,
      endTime: endTimeStr,
      attachments: [],
      targetType: mode,
      counselorName: activeCounselorInfo.name,
      specificDetails: {
        akarMasalah: `${counselingTopic} (${counselingTingkat})`,
        pendekatanKonseling: counselingTeknik.join(', '),
        komitmenKonseli: counselingKomitmenSiswa || counselingKesimpulan,
      },
      linkedViolationId: presetServiceData?.linkedViolationId,
      linkedTicketId: presetServiceData?.linkedTicketId,
    };
  };

  const handleDownloadKonselingIndividualPdf = () => {
    if (selectedStudents.length === 0) {
      showToast('⚠️ Silakan pilih minimal 1 siswa di Langkah 2.', 'warning');
      setCurrentStep(2);
      return;
    }
    const record = buildKonselingIndividualRecord();
    onSaveService(record);
    setSavedSuccessService(record);
    generateServicePDF(record);
    showToast('📄 Laporan PDF resmi konseling individual berhasil diunduh dan dibukukan!', 'success');
  };

  // Helper build complete official BK Klasikal & RPL Record
  const buildKlasikalRecord = (): CounselingService => {
    const startH = time.split(':')[0] || '08';
    const startM = time.split(':')[1] || '00';
    const endH = String((parseInt(startH, 10) + 1) % 24).padStart(2, '0');
    const endTimeStr = `${endH}:${startM}`;

    const descParts = [
      `[PELAKSANAAN & PRESENSI] Kelas: ${selectedClass || '8A'} | Tempat: ${klasikalTempat} | Waktu: ${klasikalJamKe} (${date}). Hadir: ${klasikalHadir} Siswa, Tidak Hadir: ${klasikalTidakHadir} Siswa.`,
      `[RPL - BIDANG & TOPIK] Bidang Bimbingan: ${klasikalBidang} | Topik/Judul Materi: ${klasikalTopik}`,
      klasikalTujuan ? `[TUJUAN LAYANAN]\n${klasikalTujuan}` : '',
      klasikalMateriUraian ? `[MATERI YANG DISAMPAIKAN]\n${klasikalMateriUraian}` : '',
      klasikalMetode.length > 0 ? `[METODE LAYANAN] ${klasikalMetode.join(', ')}` : '',
      klasikalMedia.length > 0 ? `[MEDIA LAYANAN] ${klasikalMedia.join(', ')}` : '',
    ].filter(Boolean).join('\n\n');

    const outputParts = [
      `[EVALUASI HASIL & PROSES] Capaian: ${klasikalHasilEvaluasi}.`,
      klasikalLaiseg ? `Laiseg: ${klasikalLaiseg}` : '',
      klasikalLaijapen ? `Laijapen: ${klasikalLaijapen}` : '',
      klasikalLaijapang ? `Laijapang: ${klasikalLaijapang}` : '',
    ].filter(Boolean).join(' ');

    const followUpParts = [
      klasikalTindakLanjutChecklist.length > 0 ? `Tindak Lanjut: ${klasikalTindakLanjutChecklist.join(', ')}.` : '',
      klasikalSiswaPerluLanjut ? `Siswa Perlu Ditindaklanjuti: ${klasikalSiswaPerluLanjut}.` : '',
      klasikalRencanaBerikutnya ? `Rencana Pertemuan Berikutnya: ${klasikalRencanaBerikutnya}.` : '',
    ].filter(Boolean).join(' ');

    return {
      id: `srv-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      serviceType: selectedService.type,
      bkComponent: selectedService.pilarId,
      bidangBimbingan: klasikalBidang,
      students: selectedStudents.map((s) => ({
        id: s.id,
        name: s.name,
        class: s.class,
        nis: s.nis || '-',
      })),
      problem: `Bimbingan Klasikal: ${klasikalTopik} (Kelas ${selectedClass || '8A'})`,
      description: descParts,
      output: outputParts || `Bimbingan klasikal telah terlaksana dengan hasil ${klasikalHasilEvaluasi}.`,
      followUp: followUpParts || 'Lanjut materi bimbingan klasikal berikutnya',
      status: status,
      date,
      startTime: time,
      endTime: endTimeStr,
      attachments: [],
      targetType: 'Klasikal',
      counselorName: activeCounselorInfo.name,
      specificDetails: {
        bidangBimbingan: klasikalBidang,
        aspekSkkpd: klasikalTopik,
        metodeLayanan: klasikalMetode.join(', '),
        mediaLayanan: klasikalMedia.join(', '),
        evaluasiProses: klasikalLaiseg,
        evaluasiHasil: `${klasikalHasilEvaluasi}. Laijapen: ${klasikalLaijapen}. Laijapang: ${klasikalLaijapang}`,
        rencanaAksiSiswa: klasikalTujuan,
      },
      linkedViolationId: presetServiceData?.linkedViolationId,
      linkedTicketId: presetServiceData?.linkedTicketId,
    };
  };

  const handleDownloadKlasikalPdf = () => {
    if (selectedStudents.length === 0) {
      showToast('⚠️ Silakan pilih kelas terlebih dahulu di Langkah 2.', 'warning');
      setCurrentStep(2);
      return;
    }
    const record = buildKlasikalRecord();
    onSaveService(record);
    setSavedSuccessService(record);
    generateServicePDF(record);
    showToast('📄 Laporan PDF RPL Bimbingan Klasikal berhasil diunduh dan dibukukan!', 'success');
  };

  // Builder for Home Visit Record
  const buildHomeVisitRecord = () => {
    const st = selectedStudents[0] || {
      id: 'unknown',
      name: 'Siswa',
      class: '8A',
      nis: '-'
    };
    const effectivePurpose = homeVisitTujuan === 'Lainnya' && homeVisitTujuanCustom.trim()
      ? homeVisitTujuanCustom.trim()
      : homeVisitTujuan;
    const effectivePerson = homeVisitYangDitemui === 'Lainnya' && homeVisitYangDitemuiLainnya.trim()
      ? homeVisitYangDitemuiLainnya.trim()
      : homeVisitYangDitemui;
    const effectiveResult = homeVisitUseAi && homeVisitAiHasil
      ? homeVisitAiHasil
      : (homeVisitRawHasil || `Kunjungan rumah terlaksana dengan status ${homeVisitStatus}. Ditemui ${effectivePerson}.`);
    
    const effectiveAgreement = [
      homeVisitKesepakatanOrtu ? `Kesepakatan: ${homeVisitKesepakatanOrtu}` : '',
      homeVisitKomitmenOrtu ? `Komitmen Ortu: ${homeVisitKomitmenOrtu}` : '',
      homeVisitKomitmenSiswa ? `Komitmen Siswa: ${homeVisitKomitmenSiswa}` : '',
      homeVisitKomitmenSekolah ? `Komitmen Sekolah: ${homeVisitKomitmenSekolah}` : '',
      homeVisitTindakLanjut.length > 0 ? `Tindak Lanjut: ${homeVisitTindakLanjut.join(', ')}` : '',
      homeVisitJadwalPantau ? `Jadwal Pantau: ${homeVisitJadwalPantau}` : ''
    ].filter(Boolean).join('. ');

    const repNum = `HV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const hvRecord: HomeVisitRecord = {
      id: `hv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      reportNumber: repNum,
      date: homeVisitTanggal || date,
      studentId: st.id,
      studentName: st.name,
      studentClass: st.class,
      studentNis: String(st.nis || '-'),
      parentNameMet: homeVisitTtdOrtu || homeVisitNamaOrtu || effectivePerson,
      address: homeVisitAlamat || `Kediaman siswa ${st.name}`,
      bidangBimbingan: 'Sosial',
      purpose: effectivePurpose,
      result: effectiveResult,
      agreement: effectiveAgreement,
      photoUrl: homeVisitFotoBukti || undefined,
      photoName: homeVisitFotoName || undefined,
      counselorName: activeCounselorInfo.name,
      counselorId: 'counselor-active',
      createdAt: new Date().toISOString()
    };

    const serviceRecord: CounselingService = {
      id: `srv-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      serviceType: 'Kunjungan Rumah (Home Visit)',
      bkComponent: 'Layanan Responsif',
      bidangBimbingan: 'Sosial',
      students: [{
        id: st.id,
        name: st.name,
        class: st.class,
        nis: st.nis || '-'
      }],
      problem: `Home Visit: ${st.name} (${st.class}) - ${effectivePurpose}`,
      description: `Laporan Kunjungan Rumah (Home Visit).\nNomor Dokumen: ${repNum}\nAlamat: ${homeVisitAlamat}\nTanggal/Jam: ${homeVisitTanggal || date} (${homeVisitJamBerangkat})\nPetugas: ${homeVisitPetugas}\nYang Ditemui: ${effectivePerson} (${homeVisitNamaOrtu})\nTujuan: ${effectivePurpose}\nKondisi Rumah: ${homeVisitKondisiRumah || '-'}\n\nUraian Hasil Pembicaraan:\n${effectiveResult}`,
      output: `Status Kunjungan: ${homeVisitStatus}.\n${effectiveAgreement}`,
      followUp: homeVisitTindakLanjut.length > 0 ? homeVisitTindakLanjut.join(', ') : 'Pemantauan perkembangan siswa 1 minggu',
      status: 'Selesai',
      date: homeVisitTanggal || date,
      startTime: homeVisitJamBerangkat.slice(0, 5) || time,
      endTime: time,
      attachments: homeVisitFotoName ? [{ name: homeVisitFotoName, size: 'Foto Bukti' }] : [],
      targetType: 'Individu',
      counselorName: activeCounselorInfo.name,
      specificDetails: {
        bidangBimbingan: 'Sosial',
        aspekSkkpd: effectivePurpose,
        evaluasiProses: homeVisitKondisiRumah,
        evaluasiHasil: effectiveResult,
        rencanaAksiSiswa: effectiveAgreement
      },
      linkedViolationId: presetServiceData?.linkedViolationId,
      linkedTicketId: presetServiceData?.linkedTicketId
    };

    return { serviceRecord, hvRecord };
  };

  const handleDownloadHomeVisitPdf = () => {
    if (selectedStudents.length === 0) {
      showToast('⚠️ Silakan pilih 1 siswa terlebih dahulu di Langkah 2.', 'warning');
      setCurrentStep(2);
      return;
    }
    const { serviceRecord, hvRecord } = buildHomeVisitRecord();
    onSaveService(serviceRecord);
    setSavedSuccessService(serviceRecord);
    try {
      const raw = localStorage.getItem('bk_home_visits');
      const list = raw ? JSON.parse(raw) : [];
      localStorage.setItem('bk_home_visits', JSON.stringify([hvRecord, ...(Array.isArray(list) ? list : [])]));
    } catch (e) {
      // ignore
    }
    try {
      downloadHomeVisitPDF(hvRecord);
    } catch (err) {
      generateServicePDF(serviceRecord);
    }
    showToast('📄 Berkas PDF Laporan Home Visit berhasil diunduh dan dibukukan!', 'success');
  };

  // Handler for Final Save
  const handleFinalSubmit = () => {
    if (selectedStudents.length === 0) {
      showToast('⚠️ Silakan pilih minimal 1 siswa / kelas di Langkah 2.', 'warning');
      setCurrentStep(2);
      return;
    }

    if (isFormKonselingIndividual) {
      const record = buildKonselingIndividualRecord();
      onSaveService(record);
      setSavedSuccessService(record);
      showToast(`✅ Laporan Resmi Konseling Individual berhasil disimpan!`, 'success');
      return;
    }

    if (isBimbinganKlasikalOnly) {
      const record = buildKlasikalRecord();
      onSaveService(record);
      setSavedSuccessService(record);
      showToast(`✅ Laporan Bimbingan Klasikal & RPL berhasil disimpan!`, 'success');
      return;
    }

    if (isHomeVisitOnly) {
      const { serviceRecord, hvRecord } = buildHomeVisitRecord();
      onSaveService(serviceRecord);
      setSavedSuccessService(serviceRecord);
      try {
        const raw = localStorage.getItem('bk_home_visits');
        const list = raw ? JSON.parse(raw) : [];
        localStorage.setItem('bk_home_visits', JSON.stringify([hvRecord, ...(Array.isArray(list) ? list : [])]));
      } catch (e) {
        // ignore
      }
      showToast(`✅ Laporan Home Visit (Kunjungan Rumah) berhasil disimpan!`, 'success');
      return;
    }

    let finalProblem = '';
    let finalDesc = '';
    let finalOutput = '';
    let finalFollowUp = '';

    if (isFormBimbinganKlasikal) {
      finalProblem = klasikalCustomMateri.trim() || klasikalMateri;
      finalDesc = klasikalUseAi && klasikalAiSummary ? klasikalAiSummary : (klasikalRawSummary || `Pemberian materi ${finalProblem} di kelas ${selectedClass || selectedStudents[0]?.class || ''}.`);
      finalFollowUp = klasikalFollowUp;
      finalOutput = `Seluruh siswa memahami materi ${finalProblem} dan siap menerapkan dalam kehidupan sekolah.`;
    } else if (isFormBimbinganKelompok) {
      finalProblem = bimbKelTema.trim() || `Bimbingan Kelompok: Pengembangan Diri`;
      finalDesc = bimbKelUseAi && bimbKelAiDinamika ? bimbKelAiDinamika : (bimbKelRawDinamika || `Dinamika kelompok bimbingan bersama ${selectedStudents.length} siswa.`);
      finalFollowUp = 'Pemantauan interaksi kelompok di kelas.';
      finalOutput = `Kelompok menunjukkan keterbukaan dan saling mendukung solusi bersama.`;
    } else if (isFormKonselingKelompok) {
      finalProblem = counselingTopic;
      finalDesc = `${konsKelUseAi && konsKelAiSummary ? konsKelAiSummary : (konsKelRawSummary || `Konseling kelompok terkait ${counselingTopic}.`)}. Peran siswa: ${konsKelPeranSiswa || '-'}.`;
      finalFollowUp = counselingFollowUp;
      finalOutput = `Penyelesaian masalah kelompok dengan pendekatan empati antarteman.`;
    } else if (isFormHomeVisit) {
      finalProblem = `Home Visit: ${selectedStudents[0]?.name}`;
      finalDesc = `Alamat: ${homeVisitAlamat}. Pihak Ditemui: ${homeVisitYangDitemui}. Hasil: ${homeVisitUseAi && homeVisitAiHasil ? homeVisitAiHasil : (homeVisitRawHasil || 'Kunjungan rumah terlaksana.')}. Kesepakatan Ortu: ${homeVisitKesepakatanOrtu || '-'}.`;
      finalFollowUp = 'Koordinasi lanjutan bersama keluarga.';
      finalOutput = `Tercapai komitmen bersama keluarga untuk mendampingi siswa di rumah.`;
    } else if (isFormKonsultasi) {
      finalProblem = `Konsultasi bersama ${konsultasiDiajakSiapa}`;
      finalDesc = `Masalah: ${konsultasiRawMasalah || 'Koordinasi siswa'}. Hasil: ${konsultasiUseAi && konsultasiAiHasil ? konsultasiAiHasil : (konsultasiRawHasil || 'Telah disepakati strategi bersama.')}.`;
      finalFollowUp = 'Evaluasi kemajuan siswa 1 minggu mendatang.';
      finalOutput = `Sinergi penanganan siswa bersama ${konsultasiDiajakSiapa}.`;
    } else if (isFormKonferensiKasus) {
      finalProblem = konferensiKasus || 'Konferensi Kasus Khusus Siswa';
      finalDesc = `Peserta: ${konferensiPeserta.join(', ')}. Keputusan: ${konferensiUseAi && konferensiAiKeputusan ? konferensiAiKeputusan : (konferensiRawKeputusan || 'Telah dicapai mufakat penanganan kasus.')}.`;
      finalFollowUp = 'Pelaksanaan butir keputusan rapat kasus.';
      finalOutput = `Berita acara konferensi kasus telah disepakati seluruh pihak terkait.`;
    } else if (isFormAlihTangan) {
      finalProblem = `Alih Tangan Kasus ke ${alihTanganDirujukKe}`;
      finalDesc = `Alasan Rujukan: ${alihTanganRawAlasan}. Surat Pengantar: ${alihTanganUseAi && alihTanganAiSurat ? alihTanganAiSurat : 'Telah diterbitkan surat rujukan resmi.'}.`;
      finalFollowUp = 'Pemantauan berkala laporan dari pihak rujukan.';
      finalOutput = `Siswa resmi dirujuk untuk mendapatkan penanganan profesional lanjutan.`;
    } else if (isFormCatatKasus) {
      finalProblem = catatKasusJenis;
      finalDesc = `Kronologi: ${catatKasusUseAi && catatKasusAiKronologi ? catatKasusAiKronologi : (catatKasusRawKronologi || catatKasusJenis)}. Poin: +${catatKasusPoin}. Sanksi/Pembinaan: ${catatKasusSanksi}.`;
      finalFollowUp = catatKasusSanksi;
      finalOutput = `Catatan kasus telah dibukukan dengan bobot ${catatKasusPoin} poin.`;
    } else if (isFormAbsen) {
      finalProblem = `Absensi Harian Kelas ${selectedClass || selectedStudents[0]?.class}`;
      finalDesc = `Presensi kehadiran lengkap untuk ${selectedStudents.length} siswa kelas ${selectedClass || ''}.`;
      finalFollowUp = 'Rekapitulasi presensi bulanan.';
      finalOutput = `Catatan kehadiran siswa telah tervalidasi.`;
    } else {
      finalProblem = selectedService.label;
      finalDesc = `Pelaksanaan layanan ${selectedService.label} bersama ${selectedStudents.length} siswa.`;
      finalFollowUp = 'Evaluasi berkala.';
      finalOutput = `Layanan ${selectedService.label} berjalan optimal.`;
    }

    const startH = time.split(':')[0] || '08';
    const startM = time.split(':')[1] || '00';
    const endH = String((parseInt(startH, 10) + 1) % 24).padStart(2, '0');
    const endTimeStr = `${endH}:${startM}`;

    const newServicePayload: Omit<CounselingService, 'id'> = {
      serviceType: selectedService.type,
      bkComponent: selectedService.pilarId,
      bidangBimbingan: selectedService.bidangDefault,
      students: selectedStudents.map((s) => ({
        id: s.id,
        name: s.name,
        class: s.class,
        nis: s.nis || '-',
      })),
      problem: finalProblem,
      description: finalDesc,
      output: finalOutput,
      followUp: finalFollowUp || 'Kasih Nasehat',
      status,
      date,
      startTime: time,
      endTime: endTimeStr,
      attachments: [],
      targetType: mode,
      linkedViolationId: presetServiceData?.linkedViolationId,
      linkedTicketId: presetServiceData?.linkedTicketId,
    };

    const savedRecord: CounselingService = {
      ...newServicePayload,
      id: `srv-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    };

    onSaveService(savedRecord);
    setSavedSuccessService(savedRecord);
    showToast(`✅ Catatan "${selectedService.label}" berhasil disimpan!`, 'success');
  };

  // =========================================================================
  // HALAMAN SUKSES: "Berhasil Disimpan! ✅" SESUAI PERMINTAAN USER
  // =========================================================================
  if (savedSuccessService) {
    const studentNames = savedSuccessService.students.map((s) => `${s.name} (${s.class})`).join(', ');
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-6 px-4 animate-in fade-in zoom-in-95 duration-200 pb-28">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-500/30 shadow-xl text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
          </div>

          <div>
            <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Pencatatan Sukses
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0b1c30] mt-2">
              Berhasil Disimpan! ✅
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
              Data rekam layanan bimbingan dan konseling telah aman dibukukan dan disinkronkan ke arsip.
            </p>
          </div>

          {/* Rincian Ringkas: Nama Siswa, Layanan yang Diinput, Tanggal */}
          <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-200/80 text-left space-y-2.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
              <span className="text-gray-500 font-bold">Nama Siswa:</span>
              <span className="font-black text-[#0b1c30] text-right">{studentNames}</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
              <span className="text-gray-500 font-bold">Layanan yang Diinput:</span>
              <span className="font-extrabold text-[#00685f] text-right">{savedSuccessService.serviceType}</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
              <span className="text-gray-500 font-bold">Tanggal:</span>
              <span className="font-bold text-gray-700 text-right">{savedSuccessService.date} • {savedSuccessService.startTime} WIB</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
              <span className="text-gray-500 font-bold">Topik:</span>
              <span className="font-bold text-[#0b1c30] text-right max-w-[65%] truncate">{savedSuccessService.problem}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-bold">Tindak Lanjut:</span>
              <span className="font-bold text-indigo-900 text-right">{savedSuccessService.followUp || '-'}</span>
            </div>
          </div>

          {/* 3 Tombol Besar: [Lihat Riwayat Layanan] [Download PDF Layanan Ini] [Input Layanan Lain] */}
          <div className="space-y-3 pt-2">
            {/* 1. Lihat Riwayat Layanan */}
            <button
              type="button"
              onClick={() => {
                if (onNavigateToRiwayat) {
                  onNavigateToRiwayat();
                } else {
                  onCancel();
                }
              }}
              className="w-full py-4 px-5 bg-gradient-to-r from-teal-700 to-[#00685f] hover:from-teal-800 hover:to-[#005049] text-white rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-3 shadow-lg shadow-teal-900/20 hover:shadow-xl transition-all cursor-pointer active:scale-98"
            >
              <Users className="w-5 h-5 text-white" />
              <span>Lihat Riwayat Layanan</span>
            </button>

            {/* 2. Download PDF Layanan Ini */}
            <button
              type="button"
              onClick={() => {
                generateServicePDF(savedSuccessService);
              }}
              className="w-full py-3.5 px-5 bg-white hover:bg-gray-50 text-[#00685f] border-2 border-[#00685f]/40 hover:border-[#00685f] rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-sm transition-all cursor-pointer active:scale-98"
            >
              <FileText className="w-4 h-4 text-[#00685f]" />
              <span>Download PDF Layanan Ini</span>
            </button>

            {/* 3. Input Layanan Lain */}
            <button
              type="button"
              onClick={() => {
                setSavedSuccessService(null);
                setCurrentStep(1);
                setSelectedStudents([]);
                setCounselingRawStory('');
                setCounselingAiPolishedStory('');
                setKlasikalRawSummary('');
                setHomeVisitRawHasil('');
              }}
              className="w-full py-3 px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-gray-600" />
              <span>Input Layanan Lain</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-[100px] animate-in fade-in duration-200">
      
      {/* ========================================================================= */}
      {/* TOP HEADER & WIZARD STEP PROGRESS TRACKER                                 */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-[#00685f] border border-[#bcc9c6]/50 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs"
              title="Batal & Kembali ke Beranda"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Batal</span>
            </button>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-[#00685f]/10 px-2.5 py-0.5 rounded-md border border-[#00685f]/15">
                Wizard Pengisian Layanan BK
              </span>
              <h1 className="text-lg sm:text-2xl font-black text-[#0b1c30] tracking-tight mt-0.5">
                {currentStep === 1 && 'Langkah 1: Mau Isi Layanan Apa?'}
                {currentStep === 2 && 'Langkah 2: Siswanya Siapa?'}
                {currentStep === 3 && `Isi Form - ${selectedService.label} - ${studentDisplayText}`}
              </h1>
            </div>
          </div>

          <div className="text-right shrink-0">
            {currentStep === 3 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl shadow-2xs animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Dibantu Meta AI ✨</span>
              </span>
            ) : (
              <span className="text-xs font-black text-[#00685f] bg-[#e6f4f1] border border-[#00685f]/20 px-3 py-1 rounded-xl">
                Langkah {currentStep} dari 3
              </span>
            )}
          </div>
        </div>

        {/* 3 Steps Visual Stepper Bar */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              currentStep === 1
                ? 'bg-[#00685f] text-white border-[#00685f] shadow-xs'
                : currentStep > 1
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                currentStep === 1 ? 'bg-white text-[#00685f]' : currentStep > 1 ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {currentStep > 1 ? <Check className="w-3 h-3 stroke-[3]" /> : '1'}
              </span>
              <span className="text-xs font-black truncate">1. Pilih Layanan</span>
            </div>
            <p className={`text-[10px] truncate mt-0.5 pl-7 ${currentStep === 1 ? 'text-white/80' : 'text-gray-500'}`}>
              {selectedService.label}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              currentStep === 2
                ? 'bg-[#00685f] text-white border-[#00685f] shadow-xs'
                : currentStep > 2
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                currentStep === 2 ? 'bg-white text-[#00685f]' : currentStep > 2 ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {currentStep > 2 ? <Check className="w-3 h-3 stroke-[3]" /> : '2'}
              </span>
              <span className="text-xs font-black truncate">2. Pilih Siswa</span>
            </div>
            <p className={`text-[10px] truncate mt-0.5 pl-7 ${currentStep === 2 ? 'text-white/80' : 'text-gray-500'}`}>
              {selectedStudents.length > 0 ? `${selectedStudents.length} Siswa (${mode})` : 'Pilih siswa'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              if (selectedStudents.length > 0) setCurrentStep(3);
              else showToast('Pilih minimal 1 siswa terlebih dahulu.', 'warning');
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              currentStep === 3
                ? 'bg-[#00685f] text-white border-[#00685f] shadow-xs'
                : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                currentStep === 3 ? 'bg-white text-[#00685f]' : 'bg-gray-200 text-gray-500'
              }`}>
                3
              </span>
              <span className="text-xs font-black truncate">3. Form + Meta AI ✨</span>
            </div>
            <p className={`text-[10px] truncate mt-0.5 pl-7 ${currentStep === 3 ? 'text-white/80' : 'text-gray-500'}`}>
              Formulir khusus & bantuan cerdas
            </p>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LANGKAH 1: PILIH DARI 16 LAYANAN (Dikelompokkan 4 Grup)                   */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={serviceSearchTerm}
                  onChange={(e) => setServiceSearchTerm(e.target.value)}
                  placeholder="Cari layanan (misal: Konseling, Home Visit)..."
                  className="w-full pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:bg-white"
                />
                {serviceSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setServiceSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {(['semua', 'Layanan Responsif', 'Layanan Dasar', 'Perencanaan Individual', 'Dukungan Sistem'] as const).map((grp) => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => setActiveGroupFilter(grp)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-colors cursor-pointer ${
                      activeGroupFilter === grp
                        ? 'bg-[#00685f] text-white shadow-2xs'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                    }`}
                  >
                    {grp === 'semua' ? 'Semua (16+)' : grp}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(['Layanan Responsif', 'Layanan Dasar', 'Perencanaan Individual', 'Dukungan Sistem'] as const).map((groupName) => {
            const groupServices = filteredServices.filter((s) => s.group === groupName);
            if (groupServices.length === 0) return null;

            return (
              <div key={groupName} className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      groupName === 'Layanan Responsif'
                        ? 'bg-amber-500'
                        : groupName === 'Layanan Dasar'
                        ? 'bg-teal-600'
                        : groupName === 'Perencanaan Individual'
                        ? 'bg-blue-600'
                        : 'bg-purple-600'
                    }`} />
                    <h2 className="text-sm font-black text-[#0b1c30] uppercase tracking-wider">
                      {groupName} ({groupServices.length})
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupServices.map((srv) => {
                    const isSelected = selectedService.type === srv.type;
                    const Icon = srv.icon;

                    return (
                      <button
                        key={srv.type}
                        type="button"
                        onClick={() => handleSelectService(srv)}
                        className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between relative active:scale-98 ${
                          isSelected
                            ? 'bg-[#00685f] text-white border-[#00685f] shadow-md ring-4 ring-[#00685f]/20'
                            : srv.accentColor
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className={`p-2.5 rounded-xl ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-white shadow-2xs text-[#00685f]'
                            }`}>
                              <Icon className="w-5 h-5" />
                            </div>

                            {isSelected ? (
                              <div className="w-6 h-6 rounded-full bg-white text-[#00685f] flex items-center justify-center shadow-xs">
                                <Check className="w-4 h-4 stroke-[3]" />
                              </div>
                            ) : (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white/80 border border-current text-gray-600">
                                {srv.defaultMode}
                              </span>
                            )}
                          </div>

                          <h3 className={`text-sm font-black mt-3 leading-snug ${isSelected ? 'text-white' : 'text-[#0b1c30]'}`}>
                            {srv.label}
                          </h3>
                          <p className={`text-xs mt-1 leading-relaxed line-clamp-2 ${isSelected ? 'text-teal-100' : 'text-gray-600'}`}>
                            {srv.desc}
                          </p>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-black/5 flex items-center justify-between text-[11px] font-bold">
                          <span className={isSelected ? 'text-teal-100' : 'text-gray-500'}>
                            Mode: {srv.defaultMode}
                          </span>
                          <span className={isSelected ? 'text-white font-extrabold' : 'text-[#00685f]'}>
                            {isSelected ? '✓ Terpilih' : 'Pilih →'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-lg flex items-center justify-between gap-4 sticky bottom-20 z-20">
            <div>
              <p className="text-xs text-gray-500">Layanan yang dipilih:</p>
              <p className="text-sm font-black text-[#00685f]">{selectedService.label}</p>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-6 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-sm font-black flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <span>Lanjut ke Langkah 2: Pilih Siswa</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LANGKAH 2: PILIH SISWA & MODE (Individu / Kelompok / Klasikal)             */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* TAHAP 2 KHUSUS BIMBINGAN KLASIKAL (PILIH KELAS & PRESENSI KEHADIRAN) */}
          {isBimbinganKlasikalOnly ? (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800">
                      Langkah 2: Data Kelas & Pelaksanaan
                    </span>
                    <span className="text-xs font-bold text-gray-500">Bimbingan Klasikal</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-[#0b1c30]">
                    Pilih Kelas & Presensi Kehadiran Siswa
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Format bimbingan klasikal diselenggarakan tatap muka di ruang kelas untuk seluruh siswa rombel.
                  </p>
                </div>

                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-right shrink-0">
                  <span className="text-[10px] font-bold text-teal-800 uppercase block">Rombel Terpilih:</span>
                  <span className="text-sm font-black text-[#00685f]">
                    Kelas {selectedClass || '8A'} • {klasikalHadir} Hadir
                  </span>
                </div>
              </div>

              {/* 1. Pilih Kelas Asuhan */}
              <div>
                <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                  1. Pilih Kelas:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {availableClasses.map((cls) => {
                    const isSelected = selectedClass === cls;
                    const countInClass = students.filter((s) => s.class === cls).length;

                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => handleSelectKlasikalClass(cls)}
                        className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#00685f] text-white border-[#00685f] shadow-xs ring-2 ring-[#00685f]/30 font-black scale-102'
                            : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800'
                        }`}
                      >
                        <p className="text-sm font-black">{cls}</p>
                        <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-teal-100' : 'text-gray-500'}`}>
                          {countInClass > 0 ? `${countInClass} Siswa` : '32 Siswa'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Jumlah Siswa Hadir & Tidak Hadir */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1.5">
                  <label className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center justify-between">
                    <span>2. Jumlah Siswa Hadir:</span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-white px-2 py-0.5 rounded border border-emerald-300">
                      Tatap Muka
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={klasikalHadir}
                      onChange={(e) => setKlasikalHadir(Number(e.target.value))}
                      className="w-full bg-white border-2 border-emerald-300 focus:border-[#00685f] rounded-xl p-2.5 text-sm font-black text-[#0b1c30] focus:outline-none"
                    />
                    <span className="text-xs font-bold text-emerald-900 whitespace-nowrap">Siswa</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 font-medium">
                    *Jumlah siswa yang hadir mengikuti layanan bimbingan klasikal hari ini.
                  </p>
                </div>

                <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-1.5">
                  <label className="text-xs font-black text-rose-950 uppercase tracking-wider flex items-center justify-between">
                    <span>3. Jumlah Siswa Tidak Hadir:</span>
                    <span className="text-[10px] text-rose-700 font-bold bg-white px-2 py-0.5 rounded border border-rose-300">
                      Sakit / Izin / Alpa
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={klasikalTidakHadir}
                      onChange={(e) => setKlasikalTidakHadir(Number(e.target.value))}
                      className="w-full bg-white border-2 border-rose-300 focus:border-[#00685f] rounded-xl p-2.5 text-sm font-black text-[#0b1c30] focus:outline-none"
                    />
                    <span className="text-xs font-bold text-rose-900 whitespace-nowrap">Siswa</span>
                  </div>
                  <p className="text-[11px] text-rose-800 font-medium">
                    *Siswa berhalangan akan dipantau melalui jurnal kelas atau konseling lanjutan.
                  </p>
                </div>
              </div>

              {/* 3. Waktu & Tempat: Tanggal, Jam Ke-, Tempat */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                {/* Tanggal */}
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500 block">
                    Tanggal Pelaksanaan:
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                  />
                </div>

                {/* Jam Ke- */}
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500 block">
                    Jam Ke- (Jam Pelajaran):
                  </label>
                  <input
                    type="text"
                    value={klasikalJamKe}
                    onChange={(e) => setKlasikalJamKe(e.target.value)}
                    placeholder="Contoh: Jam Ke- 1 - 2"
                    className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                  />
                  <div className="flex flex-wrap gap-1 pt-1">
                    {['Jam Ke- 1-2', 'Jam Ke- 3-4', 'Jam Ke- 5-6'].map((jk) => (
                      <button
                        key={jk}
                        type="button"
                        onClick={() => setKlasikalJamKe(jk)}
                        className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-600 hover:border-[#00685f] cursor-pointer"
                      >
                        {jk.replace('Jam Ke- ', '')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tempat */}
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500 block">
                    Tempat Pelaksanaan:
                  </label>
                  <input
                    type="text"
                    value={klasikalTempat}
                    onChange={(e) => setKlasikalTempat(e.target.value)}
                    placeholder="Contoh: Ruang Kelas 8A"
                    className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                  />
                  <div className="flex flex-wrap gap-1 pt-1">
                    {[`Ruang Kelas ${selectedClass || '8A'}`, 'Ruang Multimedia', 'Aula'].map((tmp) => (
                      <button
                        key={tmp}
                        type="button"
                        onClick={() => setKlasikalTempat(tmp)}
                        className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-600 hover:border-[#00685f] cursor-pointer truncate max-w-[110px]"
                      >
                        {tmp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : isHomeVisitOnly ? (
            /* ========================================================================= */
            /* TAHAP 2 KHUSUS HOME VISIT (PILIH 1 SISWA & RENCANA KUNJUNGAN RUMAH)       */
            /* ========================================================================= */
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                      Langkah 2: Data Siswa & Rencana Kunjungan
                    </span>
                    <span className="text-xs font-bold text-gray-500">Home Visit (Kunjungan Rumah)</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-[#0b1c30]">
                    Pilih 1 Siswa & Rencana Kunjungan Rumah
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Pilih 1 siswa yang akan dikunjungi tempat tinggalnya. Data alamat dan orang tua akan terisi otomatis dan dapat disesuaikan.
                  </p>
                </div>

                {selectedStudents.length > 0 && (
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-right shrink-0">
                    <span className="text-[10px] font-bold text-teal-800 uppercase block">Siswa Terpilih:</span>
                    <span className="text-sm font-black text-[#00685f]">
                      {selectedStudents[0].name} ({selectedStudents[0].class})
                    </span>
                  </div>
                )}
              </div>

              {/* 1. Pilih 1 Siswa */}
              {selectedStudents.length === 0 ? (
                <div className="space-y-3">
                  <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block">
                    1. Cari & Pilih 1 Siswa yang Akan Dikunjungi:
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      placeholder="Ketik nama atau kelas siswa (misal: Ahmad, 8C)..."
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                    {filteredStudents.slice(0, 10).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudents([st]);
                          setMode('Individu');
                          setHomeVisitAlamat(`RT 02 / RW 04, Kediaman Siswa ${st.name}, Susukan`);
                          const pName = `Bapak / Ibu Wali dari ${st.name}`;
                          setHomeVisitNamaOrtu(pName);
                          setHomeVisitTtdOrtu(pName);
                          const nisDigits = st.nis ? st.nis.replace(/\D/g, '').slice(-4) : '2489';
                          setHomeVisitNoHpOrtu(`0812-34${nisDigits}-7890`);
                        }}
                        className="p-3 rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-teal-50 hover:border-teal-300 transition-all text-left flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-black text-xs flex items-center justify-center shrink-0">
                            {st.initials || st.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-black text-[#0b1c30]">{st.name}</p>
                            <p className="text-[10px] text-gray-500 font-semibold">Kelas {st.class} • NIS: {st.nis || '-'}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#00685f]">Pilih →</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-teal-50/80 border border-teal-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#00685f] text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                      {selectedStudents[0].initials || selectedStudents[0].name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200">
                        Siswa Terpilih untuk Home Visit
                      </span>
                      <h4 className="text-base font-black text-[#0b1c30] mt-0.5">{selectedStudents[0].name}</h4>
                      <p className="text-xs text-gray-600 font-medium">Kelas {selectedStudents[0].class} • NIS: {selectedStudents[0].nis || '-'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudents([])}
                    className="px-3.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl text-xs font-black transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    Ganti Siswa
                  </button>
                </div>
              )}

              {/* 2. Data Otomatis Muncul (Bisa Diedit Langsung) */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-600" />
                    <span>Alamat Lengkap Siswa:</span>
                  </label>
                  <input
                    type="text"
                    value={homeVisitAlamat}
                    onChange={(e) => setHomeVisitAlamat(e.target.value)}
                    placeholder="Alamat lengkap tempat tinggal siswa..."
                    className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Nama Orang Tua / Wali:</span>
                    </label>
                    <input
                      type="text"
                      value={homeVisitNamaOrtu}
                      onChange={(e) => {
                        setHomeVisitNamaOrtu(e.target.value);
                        if (!homeVisitTtdOrtu) setHomeVisitTtdOrtu(e.target.value);
                      }}
                      placeholder="Nama orang tua atau wali..."
                      className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>No HP / WhatsApp Orang Tua:</span>
                    </label>
                    <input
                      type="text"
                      value={homeVisitNoHpOrtu}
                      onChange={(e) => setHomeVisitNoHpOrtu(e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Input Rencana Kunjungan */}
              <div className="pt-2 border-t border-gray-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Tanggal Kunjungan */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#00685f]" />
                      <span>Tanggal Kunjungan:</span>
                    </label>
                    <input
                      type="date"
                      value={homeVisitTanggal}
                      onChange={(e) => setHomeVisitTanggal(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                    />
                  </div>

                  {/* Jam Berangkat */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#00685f]" />
                      <span>Jam Berangkat:</span>
                    </label>
                    <input
                      type="text"
                      value={homeVisitJamBerangkat}
                      onChange={(e) => setHomeVisitJamBerangkat(e.target.value)}
                      placeholder="Contoh: 09:00 WIB"
                      className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {['08:30 WIB', '09:00 WIB', '10:00 WIB', '13:00 WIB'].map((jb) => (
                        <button
                          key={jb}
                          type="button"
                          onClick={() => setHomeVisitJamBerangkat(jb)}
                          className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-600 hover:border-[#00685f] cursor-pointer"
                        >
                          {jb}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Petugas */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1">
                      <Users className="w-3 h-3 text-[#00685f]" />
                      <span>Petugas Kunjungan:</span>
                    </label>
                    <input
                      type="text"
                      value={homeVisitPetugas}
                      onChange={(e) => setHomeVisitPetugas(e.target.value)}
                      placeholder="Guru BK + Wali Kelas"
                      className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {['Guru BK + Wali Kelas', 'Guru BK Saja', 'Guru BK + Tim Disiplin'].map((pt) => (
                        <button
                          key={pt}
                          type="button"
                          onClick={() => setHomeVisitPetugas(pt)}
                          className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-600 hover:border-[#00685f] cursor-pointer truncate max-w-[120px]"
                        >
                          {pt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tujuan Kunjungan */}
                <div>
                  <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                    Tujuan Kunjungan Rumah (Klik 1):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {(['Absen Lama', 'Masalah Perilaku', 'Tindak Lanjut Konseling', 'Masalah Ekonomi', 'Lainnya'] as const).map((tj) => {
                      const isSelected = homeVisitTujuan === tj;
                      return (
                        <button
                          key={tj}
                          type="button"
                          onClick={() => setHomeVisitTujuan(tj)}
                          className={`p-3 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#00685f] text-white border-[#00685f] shadow-xs'
                              : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                          }`}
                        >
                          {tj}
                        </button>
                      );
                    })}
                  </div>

                  {homeVisitTujuan === 'Lainnya' && (
                    <div className="mt-2.5">
                      <input
                        type="text"
                        value={homeVisitTujuanCustom}
                        onChange={(e) => setHomeVisitTujuanCustom(e.target.value)}
                        placeholder="Ketik tujuan khusus kunjungan rumah..."
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-4">
            
            <div>
              <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                Pilih Format / Mode Layanan:
              </label>
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-gray-100 rounded-2xl border border-[#bcc9c6]/30">
                {(['Individu', 'Kelompok', 'Klasikal'] as const).map((m) => {
                  const isActive = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMode(m);
                        if (m === 'Klasikal' && selectedClass) {
                          handleSelectAllStudentsInClass(selectedClass);
                        }
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        isActive
                          ? 'bg-[#00685f] text-white shadow-xs'
                          : 'text-[#3d4947] hover:bg-gray-200/60'
                      }`}
                    >
                      {m === 'Individu' && <User className="w-4 h-4" />}
                      {m === 'Kelompok' && <Users className="w-4 h-4" />}
                      {m === 'Klasikal' && <BookOpen className="w-4 h-4" />}
                      <span>{m}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sub-mode 1: INDIVIDU */}
            {mode === 'Individu' && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">
                    Cari Nama Siswa:
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      placeholder="Ketik nama siswa atau kelas (misal: Ahmad, 8C)..."
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none"
                    />
                  </div>

                  {studentSearchTerm.trim() && (
                    <div className="mt-2 p-2 bg-white rounded-xl border border-gray-200 shadow-lg max-h-56 overflow-y-auto space-y-1">
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              setSelectedStudents([st]);
                              setStudentSearchTerm('');
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[#e6f4f1] text-left cursor-pointer group"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-[#00685f]/10 text-[#00685f] flex items-center justify-center font-bold text-xs">
                                {st.initials || st.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-xs font-black text-[#0b1c30] group-hover:text-[#00685f]">{st.name}</p>
                                <p className="text-[10px] text-gray-500">Kelas {st.class} {st.nis ? `• NIS: ${st.nis}` : ''}</p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-[#00685f]">Pilih Siswa →</span>
                          </button>
                        ))
                      ) : (
                        <p className="p-3 text-center text-xs text-gray-500">Siswa tidak ditemukan.</p>
                      )}
                    </div>
                  )}
                </div>

                {selectedStudents.length > 0 && (
                  <div className="p-4 bg-[#e6f4f1] border-2 border-[#00685f] rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#00685f] text-white flex items-center justify-center font-black text-sm shrink-0">
                        {selectedStudents[0].initials || selectedStudents[0].name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-[#0b1c30] truncate">{selectedStudents[0].name}</p>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-white text-[#00685f] border border-[#00685f]/30">
                            Kelas {selectedStudents[0].class}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          NIS: {selectedStudents[0].nis || '-'} • Poin Kasus: {selectedStudents[0].violationPoints || 0}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-white text-emerald-800 border border-emerald-300 rounded-lg text-xs font-black shrink-0">
                      ✓ Terpilih
                    </span>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                      Tombol Cepat: Kasus Perlu Tindak Lanjut
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Siswa dengan catatan pelanggaran aktif atau poin kedisiplinan yang perlu segera dikonseling:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {quickCases.map((item) => {
                      const isSelected = selectedStudents[0]?.id === item.student.id;
                      return (
                        <button
                          key={item.student.id}
                          type="button"
                          onClick={() => setSelectedStudents([item.student])}
                          className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-amber-100/80 border-amber-500 shadow-xs ring-2 ring-amber-300'
                              : 'bg-amber-50/50 hover:bg-amber-50 border-amber-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {item.student.initials || item.student.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-[#0b1c30] truncate">{item.student.name}</p>
                              <p className="text-[10px] text-amber-800 truncate">
                                Kelas {item.student.class} • {item.reason}
                              </p>
                            </div>
                          </div>

                          <span className={`text-[11px] font-black shrink-0 px-2 py-0.5 rounded-md ${
                            isSelected ? 'bg-amber-600 text-white' : 'bg-white border border-amber-300 text-amber-800'
                          }`}>
                            {isSelected ? '✓ Terpilih' : '+ Pilih'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-mode 2: KELOMPOK */}
            {mode === 'Kelompok' && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">
                    Cari & Tambah Anggota Kelompok:
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      placeholder="Ketik nama siswa untuk menambah ke kelompok..."
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none"
                    />
                  </div>

                  {studentSearchTerm.trim() && (
                    <div className="mt-2 p-2 bg-white rounded-xl border border-gray-200 shadow-lg max-h-56 overflow-y-auto space-y-1">
                      {filteredStudents.map((st) => {
                        const isAdded = selectedStudents.some((s) => s.id === st.id);
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => handleToggleStudent(st)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left cursor-pointer ${
                              isAdded ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-gray-100'
                            }`}
                          >
                            <p className="text-xs font-bold">{st.name} (Kelas {st.class})</p>
                            <span className="text-xs font-black text-[#00685f]">
                              {isAdded ? '✓ Ditambahkan' : '+ Tambah'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700">
                      Daftar Anggota Kelompok Terpilih ({selectedStudents.length} Siswa):
                    </span>
                    {selectedStudents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedStudents([])}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        Hapus Semua
                      </button>
                    )}
                  </div>

                  {selectedStudents.length > 0 ? (
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 min-h-[60px]">
                      {selectedStudents.map((st) => (
                        <span
                          key={st.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#00685f]/30 text-[#00685f] rounded-xl text-xs font-black shadow-2xs"
                        >
                          <span>{st.name} ({st.class})</span>
                          <button
                            type="button"
                            onClick={() => handleToggleStudent(st)}
                            className="p-0.5 hover:bg-gray-200 rounded-full cursor-pointer text-gray-500 hover:text-red-600"
                            title="Hapus dari kelompok"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-gray-500 border border-dashed rounded-xl bg-gray-50">
                      Belum ada siswa yang ditambahkan ke kelompok. Gunakan kolom pencarian di atas untuk memilih siswa.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub-mode 3: KLASIKAL */}
            {mode === 'Klasikal' && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">
                    Pilih Kelas Asuhan:
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {availableClasses.map((cls) => {
                      const isSelected = selectedClass === cls;
                      const countInClass = students.filter((s) => s.class === cls).length;

                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => {
                            setSelectedClass(cls);
                            handleSelectAllStudentsInClass(cls);
                          }}
                          className={`p-2.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#00685f] text-white border-[#00685f] shadow-xs ring-2 ring-[#00685f]/30'
                              : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800'
                          }`}
                        >
                          <p className="text-sm font-black">{cls}</p>
                          <p className="text-[10px] opacity-80">{countInClass} Siswa</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-teal-800">Kelas Aktif: Kelas {selectedClass || '8A'}</p>
                    <p className="text-sm font-black text-teal-950 mt-0.5">
                      {selectedStudents.length} siswa akan otomatis tercatat pada layanan klasikal ini
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectAllStudentsInClass(selectedClass || availableClasses[0])}
                    className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-black rounded-xl shadow-xs cursor-pointer active:scale-95"
                  >
                    Tambah Seluruh Siswa 1 Kelas ✓
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-lg flex items-center justify-between gap-3 sticky bottom-20 z-20">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Langkah 1</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedStudents.length === 0) {
                  showToast('⚠️ Silakan pilih minimal 1 siswa / kelas.', 'warning');
                  return;
                }
                setCurrentStep(3);
              }}
              className="px-6 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <span>{isBimbinganKlasikalOnly ? 'Lanjut ke Langkah 3: Form RPL & Pelaksanaan' : 'Lanjut ke Langkah 3: Form Layanan'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LANGKAH 3: FORM SESUAI LAYANAN + DIBANTU META AI                          */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          {/* Metadata Tanggal, Jam, dan Status untuk Layanan Non-Konseling, Non-Klasikal & Non-HomeVisit */}
          {!isFormKonselingIndividual && !isBimbinganKlasikalOnly && !isHomeVisitOnly && (
            <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-50 text-[#00685f]">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500">Tanggal:</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="font-black text-[#0b1c30] block bg-transparent border-b border-gray-300 focus:outline-none focus:border-[#00685f]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-50 text-[#00685f]">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500">Jam:</span>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="font-black text-[#0b1c30] block bg-transparent border-b border-gray-300 focus:outline-none focus:border-[#00685f]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-gray-500">Status:</span>
                <div className="flex rounded-xl bg-gray-100 p-1 border">
                  {(['Selesai', 'Terjadwal'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        status === st ? 'bg-[#00685f] text-white shadow-2xs' : 'text-gray-600'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1. FORM KONSELING INDIVIDUAL STANDAR BK (ACCORDION A-F)  */}
          {/* ========================================================= */}
          {isFormKonselingIndividual && (
            <div className="space-y-4">
              {/* Info Header Banner */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#bcc9c6]/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800">
                      Standar Resmi BK • ABKIN
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      Dibantu Meta AI ✨
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-[#0b1c30]">
                    Laporan Konseling Individual - {studentDisplayText}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Format resmi BK komprehensif. Bagian A terbuka otomatis, klik setiap bagian untuk mengisi.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-center">
                  <span className="text-[11px] font-bold text-gray-400">Navigasi:</span>
                  {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setActiveAccordion(activeAccordion === sec ? null : sec)}
                      className={`w-7 h-7 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        activeAccordion === sec
                          ? 'bg-[#00685f] text-white shadow-xs scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title={`Buka Bagian ${sec}`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
              </div>

              {/* ----------------------------------------------------- */}
              {/* ACCORDION BAGIAN A - IDENTITAS (OTOMATIS & TERBUKA)   */}
              {/* ----------------------------------------------------- */}
              <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => setActiveAccordion(activeAccordion === 'A' ? null : 'A')}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-teal-100 text-[#00685f] font-black flex items-center justify-center text-sm shadow-2xs">
                      A
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                          Bagian A - Identitas
                        </h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                          Otomatis
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-medium truncate max-w-xs sm:max-w-md">
                        {selectedStudents[0]?.name || 'Belum dipilih'} ({selectedStudents[0]?.class || '-'}) • {counselingTempat} • Pertemuan Ke-{counselingPertemuanKe} ({counselingSifat})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 hidden sm:inline">
                      {activeAccordion === 'A' ? 'Tutup' : 'Buka'}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                        activeAccordion === 'A' ? 'rotate-180 text-[#00685f]' : ''
                      }`}
                    />
                  </div>
                </button>

                {activeAccordion === 'A' && (
                  <div className="p-4 sm:p-6 border-t border-gray-100 bg-[#f8faf9]/50 space-y-4 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* 1. Nama Siswa (Konseli) */}
                      <div className="p-3.5 bg-white rounded-xl border border-gray-200/80 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                          Nama Siswa (Konseli):
                        </span>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-teal-50 text-[#00685f] font-black flex items-center justify-center text-xs">
                              {selectedStudents[0]?.name?.charAt(0) || 'S'}
                            </div>
                            <div>
                              <p className="text-xs sm:text-sm font-black text-[#0b1c30]">
                                {selectedStudents[0]?.name || 'Belum ada siswa terpilih'}
                              </p>
                              <p className="text-[11px] text-gray-500 font-semibold">
                                Kelas {selectedStudents[0]?.class || '-'} • NIS: {selectedStudents[0]?.nis || '-'}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                            Terpilih ✓
                          </span>
                        </div>
                      </div>

                      {/* 2. Guru BK / Konselor */}
                      <div className="p-3.5 bg-white rounded-xl border border-gray-200/80 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                          Guru BK / Konselor:
                        </span>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 font-black flex items-center justify-center text-xs">
                              BK
                            </div>
                            <div>
                              <p className="text-xs sm:text-sm font-black text-[#0b1c30]">
                                {activeCounselorInfo.name}
                              </p>
                              <p className="text-[11px] text-gray-500 font-semibold">
                                NIP: {activeCounselorInfo.nip}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                            Resmi ✓
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Tanggal */}
                      <div className="p-3 bg-white rounded-xl border border-gray-200/80">
                        <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                          Tanggal Konseling:
                        </label>
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                        />
                      </div>

                      {/* Jam */}
                      <div className="p-3 bg-white rounded-xl border border-gray-200/80">
                        <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                          Jam Mulai:
                        </label>
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                        />
                      </div>

                      {/* Tempat */}
                      <div className="p-3 bg-white rounded-xl border border-gray-200/80">
                        <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                          Tempat Pelaksanaan:
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(['Ruang BK', 'Kelas'] as const).map((tmp) => (
                            <button
                              key={tmp}
                              type="button"
                              onClick={() => setCounselingTempat(tmp)}
                              className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                counselingTempat === tmp
                                  ? 'bg-[#00685f] text-white shadow-2xs'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {tmp}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Pertemuan Ke- & Sifat */}
                      <div className="p-3 bg-white rounded-xl border border-gray-200/80">
                        <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                          Pertemuan Ke- & Sifat:
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={counselingPertemuanKe}
                            onChange={(e) => setCounselingPertemuanKe(Number(e.target.value))}
                            className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                              <option key={n} value={n}>
                                Ke-{n}
                              </option>
                            ))}
                          </select>
                          <div className="flex rounded-lg bg-gray-100 p-0.5 border flex-1">
                            {(['Sukarela', 'Rujukan'] as const).map((sf) => (
                              <button
                                key={sf}
                                type="button"
                                onClick={() => setCounselingSifat(sf)}
                                className={`flex-1 py-1 rounded-md text-[11px] font-black transition-all cursor-pointer ${
                                  counselingSifat === sf
                                    ? 'bg-[#00685f] text-white shadow-2xs'
                                    : 'text-gray-600'
                                }`}
                              >
                                {sf}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveAccordion('B')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-black rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all"
                      >
                        <span>Lanjut ke Bagian B: Masalah</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ----------------------------------------------------- */}
              {/* ACCORDION BAGIAN B - MASALAH (TERTUTUP DEFAULT)      */}
              {/* ----------------------------------------------------- */}
              <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => setActiveAccordion(activeAccordion === 'B' ? null : 'B')}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 font-black flex items-center justify-center text-sm shadow-2xs">
                      B
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                        Bagian B - Masalah & Keluhan Siswa
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-medium truncate max-w-xs sm:max-w-md">
                        Topik: {counselingTopic} • Tingkat: {counselingTingkat}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 hidden sm:inline">
                      {activeAccordion === 'B' ? 'Tutup' : 'Buka'}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                        activeAccordion === 'B' ? 'rotate-180 text-amber-700' : ''
                      }`}
                    />
                  </div>
                </button>

                {activeAccordion === 'B' && (
                  <div className="p-4 sm:p-6 border-t border-gray-100 bg-[#f8faf9]/50 space-y-4 animate-in fade-in duration-150">
                    {/* Topik: 6 Tombol Pilih */}
                    <div>
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                        Pilih Topik Masalah Utama (Klik 1):
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {TOPIK_POPULER.map((item) => {
                          const isSelected = counselingTopic === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setCounselingTopic(item.id)}
                              className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#00685f] text-white border-[#00685f] shadow-xs ring-2 ring-[#00685f]/20 font-black'
                                  : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-800'
                              }`}
                            >
                              <p className="text-xs font-black">{item.label}</p>
                              <p className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-teal-100' : 'text-gray-500'}`}>
                                {item.desc}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tingkat Masalah */}
                    <div>
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                        Tingkat Keparahan / Urgensi Masalah:
                      </label>
                      <div className="grid grid-cols-3 gap-2.5">
                        {(['Ringan', 'Sedang', 'Berat'] as const).map((lvl) => {
                          const isSelected = counselingTingkat === lvl;
                          const activeClass =
                            lvl === 'Ringan'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : lvl === 'Sedang'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-red-600 text-white border-red-600';

                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setCounselingTingkat(lvl)}
                              className={`py-2.5 px-3 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                                isSelected ? `${activeClass} shadow-xs` : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-700'
                              }`}
                            >
                              {lvl}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Uraian Masalah + Rapikan dengan Meta AI */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                          Uraian Masalah / Cerita Singkat:
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const polished = polishTextWithMetaAi('konseling_individual', counselingRawStory, { topic: counselingTopic });
                            setCounselingAiPolishedStory(polished);
                            setCounselingUseAiStory(true);
                            showToast('✨ Uraian masalah berhasil dirapikan dengan bahasa resmi BK!', 'success');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95"
                          title="Ubah cerita singkat jadi kalimat formal untuk laporan BK"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Rapikan dengan Meta AI</span>
                        </button>
                      </div>

                      <textarea
                        rows={3}
                        value={counselingUseAiStory && counselingAiPolishedStory ? counselingAiPolishedStory : counselingRawStory}
                        onChange={(e) => {
                          if (counselingUseAiStory) {
                            setCounselingAiPolishedStory(e.target.value);
                          } else {
                            setCounselingRawStory(e.target.value);
                          }
                        }}
                        placeholder="Tulis poinnya saja, contoh: telat 3x, sering mengantuk di kelas karena main game sampai malam..."
                        className="w-full p-3.5 bg-white border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none leading-relaxed"
                      />

                      {/* Toggle Versi Rapi Meta AI vs Tulisan Asli */}
                      {counselingAiPolishedStory && (
                        <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-indigo-900 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              Pilihan Teks Laporan:
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setCounselingUseAiStory(false)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                  !counselingUseAiStory ? 'bg-white text-gray-800 shadow-2xs font-black' : 'text-gray-500 hover:text-gray-900'
                                }`}
                              >
                                Tulisan Asli
                              </button>
                              <button
                                type="button"
                                onClick={() => setCounselingUseAiStory(true)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                  counselingUseAiStory ? 'bg-indigo-600 text-white shadow-2xs font-black' : 'text-gray-500 hover:text-gray-900'
                                }`}
                              >
                                Versi Rapi Meta AI ✓
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-indigo-950 font-medium italic leading-relaxed">
                            "{counselingUseAiStory ? counselingAiPolishedStory : (counselingRawStory || 'Poin catatan konselor')}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Rekomendasi Cerdas Meta AI Khusus Topik Ini */}
                    <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-teal-50 border border-indigo-200 rounded-xl p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-black text-indigo-950">
                          Rekomendasi Cerdas Meta AI untuk Topik "{counselingTopic}":
                        </span>
                      </div>
                      <p className="text-xs text-indigo-900 leading-relaxed font-semibold pl-6">
                        {liveMetaAiRecommendation}
                      </p>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveAccordion('C')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-black rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all"
                      >
                        <span>Lanjut ke Bagian C: Proses</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ----------------------------------------------------- */}
              {/* ACCORDION BAGIAN C - PROSES (TERTUTUP DEFAULT)       */}
              {/* ----------------------------------------------------- */}
              <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => setActiveAccordion(activeAccordion === 'C' ? null : 'C')}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 font-black flex items-center justify-center text-sm shadow-2xs">
                      C
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                        Bagian C - Proses & Dinamika Sesi
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-medium truncate max-w-xs sm:max-w-md">
                        {counselingTeknik.length} Teknik Dipilih • {counselingDinamika ? 'Dinamika Terisi' : 'Dinamika Draft'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 hidden sm:inline">
                      {activeAccordion === 'C' ? 'Tutup' : 'Buka'}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                        activeAccordion === 'C' ? 'rotate-180 text-blue-700' : ''
                      }`}
                    />
                  </div>
                </button>

                {activeAccordion === 'C' && (
                  <div className="p-4 sm:p-6 border-t border-gray-100 bg-[#f8faf9]/50 space-y-4 animate-in fade-in duration-150">
                    {/* Teknik Konseling Checklist */}
                    <div>
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                        Teknik & Pendekatan Konseling (Bisa Pilih Lebih dari 1):
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          'Solution-Focused Brief Counseling (SFBC)',
                          'Mendengarkan Aktif (Active Listening)',
                          'Refleksi Emosi & Pemikiran',
                          'Klarifikasi & Eksplorasi Masalah',
                          'Kontrak Perilaku (Behavior Contract)',
                        ].map((tek) => {
                          const isChecked = counselingTeknik.includes(tek);
                          return (
                            <button
                              key={tek}
                              type="button"
                              onClick={() => handleToggleTeknik(tek)}
                              className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                                isChecked
                                  ? 'bg-blue-50/90 border-blue-400 text-blue-950 font-bold shadow-2xs'
                                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                                  isChecked ? 'bg-blue-600 text-white' : 'border border-gray-300 bg-white'
                                }`}
                              >
                                {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                              <span className="text-xs leading-snug">{tek}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dinamika Sesi + Tombol Bantu Tulis */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                          Dinamika Sesi Konseling:
                        </label>
                        <button
                          type="button"
                          onClick={handleBantuTulisDinamika}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Bantu Tulis ✨</span>
                        </button>
                      </div>

                      <textarea
                        rows={3}
                        value={counselingDinamika}
                        onChange={(e) => setCounselingDinamika(e.target.value)}
                        placeholder="Tulis dinamika proses konseling, respon emosi siswa, keterbukaan saat diajak bicara, atau klik 'Bantu Tulis ✨'..."
                        className="w-full p-3.5 bg-white border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none leading-relaxed"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveAccordion('D')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-black rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all"
                      >
                        <span>Lanjut ke Bagian D: Hasil</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ----------------------------------------------------- */}
              {/* ACCORDION BAGIAN D - HASIL (TERTUTUP DEFAULT)         */}
              {/* ----------------------------------------------------- */}
              <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => setActiveAccordion(activeAccordion === 'D' ? null : 'D')}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 font-black flex items-center justify-center text-sm shadow-2xs">
                      D
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                        Bagian D - Hasil & Kesimpulan Konseling
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-medium truncate max-w-xs sm:max-w-md">
                        Hasil: {counselingHasilKategori}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 hidden sm:inline">
                      {activeAccordion === 'D' ? 'Tutup' : 'Buka'}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                        activeAccordion === 'D' ? 'rotate-180 text-purple-700' : ''
                      }`}
                    />
                  </div>
                </button>

                {activeAccordion === 'D' && (
                  <div className="p-4 sm:p-6 border-t border-gray-100 bg-[#f8faf9]/50 space-y-4 animate-in fade-in duration-150">
                    {/* Hasil: 5 Pilihan */}
                    <div>
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                        Pencapaian Hasil Konseling:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {(['Paham Masalah', 'Temukan Solusi', 'Komitmen', 'Perlu Lanjut', 'Dirujuk'] as const).map((res) => {
                          const isSelected =
                            counselingHasilKategori === res ||
                            (res === 'Komitmen' && counselingHasilKategori === 'Komitmen Perubahan');
                          return (
                            <button
                              key={res}
                              type="button"
                              onClick={() => {
                                setCounselingHasilKategori(res === 'Komitmen' ? 'Komitmen Perubahan' : res);
                                if (!counselingKesimpulan) {
                                  if (res === 'Temukan Solusi') {
                                    setCounselingKesimpulan('Siswa mampu mengidentifikasi akar kendala dan merumuskan langkah solusi nyata.');
                                  } else if (res === 'Komitmen') {
                                    setCounselingKesimpulan('Siswa menyepakati kontrak komitmen perbaikan sikap dan disiplin diri.');
                                  }
                                }
                              }}
                              className={`p-2.5 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                                  : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-700'
                              }`}
                            >
                              {res}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Kesimpulan & Komitmen Siswa */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block">
                          Kesimpulan Konselor:
                        </label>
                        <textarea
                          rows={3}
                          value={counselingKesimpulan}
                          onChange={(e) => setCounselingKesimpulan(e.target.value)}
                          placeholder="Contoh: Siswa menyadari bahwa sering begadang menurunkan performa belajar di kelas..."
                          className="w-full p-3 bg-white border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs font-semibold text-[#0b1c30] focus:outline-none leading-relaxed"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block">
                          Komitmen Siswa:
                        </label>
                        <textarea
                          rows={3}
                          value={counselingKomitmenSiswa}
                          onChange={(e) => setCounselingKomitmenSiswa(e.target.value)}
                          placeholder="Contoh: Berjanji membatasi waktu main game maksimal jam 21.00 dan tidur tepat waktu..."
                          className="w-full p-3 bg-white border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs font-semibold text-[#0b1c30] focus:outline-none leading-relaxed"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveAccordion('E')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-black rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all"
                      >
                        <span>Lanjut ke Bagian E: Tindak Lanjut</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ----------------------------------------------------- */}
              {/* ACCORDION BAGIAN E - TINDAK LANJUT (TERTUTUP DEFAULT)  */}
              {/* ----------------------------------------------------- */}
              <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => setActiveAccordion(activeAccordion === 'E' ? null : 'E')}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm shadow-2xs">
                      E
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                        Bagian E - Tindak Lanjut & Evaluasi
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-medium truncate max-w-xs sm:max-w-md">
                        {counselingTindakLanjutMulti.length} Tindak Lanjut • Evaluasi: {counselingJadwalEvaluasi} • Status: {counselingStatusAkhir}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 hidden sm:inline">
                      {activeAccordion === 'E' ? 'Tutup' : 'Buka'}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                        activeAccordion === 'E' ? 'rotate-180 text-emerald-700' : ''
                      }`}
                    />
                  </div>
                </button>

                {activeAccordion === 'E' && (
                  <div className="p-4 sm:p-6 border-t border-gray-100 bg-[#f8faf9]/50 space-y-4 animate-in fade-in duration-150">
                    {/* Tindak Lanjut: Pilih Banyak / Checklist */}
                    <div>
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                        Pilihan Tindak Lanjut (Pilih Banyak / Multi-Select):
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {[
                          'Pantau 1 Minggu',
                          'Konseling Lanjutan',
                          'Panggil Ortu',
                          'Buat Surat Panggilan',
                          'Kolaborasi Wali Kelas',
                          'Alih Tangan',
                          'Home Visit',
                        ].map((item) => {
                          const isChecked = counselingTindakLanjutMulti.includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => handleToggleTindakLanjutMulti(item)}
                              className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                                isChecked
                                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-black shadow-2xs'
                                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center ${
                                  isChecked ? 'bg-emerald-600 text-white' : 'border border-gray-300 bg-white'
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span className="text-xs truncate">{item}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                      {/* Jadwal Evaluasi (7 Hari Lagi) */}
                      <div className="p-3.5 bg-white rounded-xl border border-gray-200/80">
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                          Jadwal Evaluasi (Otomatis 7 Hari Lagi):
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={counselingJadwalEvaluasi}
                            onChange={(e) => setCounselingJadwalEvaluasi(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() + 7);
                              setCounselingJadwalEvaluasi(d.toISOString().slice(0, 10));
                              showToast('Jadwal evaluasi disetel ke 7 hari lagi.', 'info');
                            }}
                            className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer"
                          >
                            Reset 7 Hari
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">
                          *Pemantauan rutin perkembangan perilaku dan kepatuhan komitmen siswa.
                        </p>
                      </div>

                      {/* Status Kasus/Layanan */}
                      <div className="p-3.5 bg-white rounded-xl border border-gray-200/80">
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                          Status Penanganan Sesi:
                        </label>
                        <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                          {(['Selesai', 'Berlanjut', 'Dirujuk'] as const).map((st) => {
                            const isSelected = counselingStatusAkhir === st;
                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => {
                                  setCounselingStatusAkhir(st);
                                  setStatus(st === 'Dirujuk' ? 'Selesai' : (st as any));
                                }}
                                className={`py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#00685f] text-white shadow-xs'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {st}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">
                          {counselingStatusAkhir === 'Selesai'
                            ? 'Kasus dinyatakan selesai dengan komitmen perbaikan.'
                            : counselingStatusAkhir === 'Berlanjut'
                            ? 'Akan diagendakan konseling lanjutan pertemuan berikutnya.'
                            : 'Direkomendasikan alih tangan kasus ke tenaga spesialis.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveAccordion('F')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-black rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all"
                      >
                        <span>Lanjut ke Bagian F: Lembar Penutup</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ----------------------------------------------------- */}
              {/* ACCORDION BAGIAN F - PENUTUP (TERTUTUP DEFAULT)      */}
              {/* ----------------------------------------------------- */}
              <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => setActiveAccordion(activeAccordion === 'F' ? null : 'F')}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 font-black flex items-center justify-center text-sm shadow-2xs">
                      F
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                        Bagian F - Penutup & Lembar Pengesahan
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-medium truncate max-w-xs sm:max-w-md">
                        Jaminan Kerahasiaan ABKIN & Pengesahan Guru BK
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 hidden sm:inline">
                      {activeAccordion === 'F' ? 'Tutup' : 'Buka'}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                        activeAccordion === 'F' ? 'rotate-180 text-slate-800' : ''
                      }`}
                    />
                  </div>
                </button>

                {activeAccordion === 'F' && (
                  <div className="p-4 sm:p-6 border-t border-gray-100 bg-[#f8faf9]/50 space-y-4 animate-in fade-in duration-150">
                    {/* Checkbox Jaminan Kerahasiaan ABKIN */}
                    <div
                      onClick={() => setCounselingAgreedConfidentiality(!counselingAgreedConfidentiality)}
                      className={`p-4 rounded-xl border-2 flex items-start gap-3.5 transition-all cursor-pointer ${
                        counselingAgreedConfidentiality
                          ? 'bg-teal-50/80 border-teal-500/70 text-teal-950'
                          : 'bg-white border-gray-200 text-gray-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded mt-0.5 flex items-center justify-center transition-colors ${
                          counselingAgreedConfidentiality ? 'bg-[#00685f] text-white' : 'border border-gray-300 bg-white'
                        }`}
                      >
                        {counselingAgreedConfidentiality && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm">
                          <ShieldCheck className="w-4 h-4 text-[#00685f]" />
                          <span>Pernyataan Kepatuhan Asas Kerahasiaan ABKIN</span>
                        </div>
                        <p className="text-xs leading-relaxed text-gray-600 font-medium">
                          Saya menyatakan bahwa konseling ini diselenggarakan dengan menjunjung tinggi Asas Kerahasiaan Kode Etik Bimbingan & Konseling (ABKIN). Seluruh isi pembicaraan dilindungi dan hanya digunakan untuk kepentingan perkembangan positif konseli.
                        </p>
                      </div>
                    </div>

                    {/* Lembar Tanda Tangan Resmi Guru BK */}
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                          Pengesahan Konselor Sekolah
                        </span>
                        <div className="flex items-center gap-2">
                          <PenTool className="w-4 h-4 text-[#00685f]" />
                          <p className="text-sm font-black text-[#0b1c30]">
                            {activeCounselorInfo.name}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 font-semibold">
                          NIP. {activeCounselorInfo.nip}
                        </p>
                      </div>

                      <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-right sm:min-w-[200px]">
                        <span className="text-[10px] uppercase font-black text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200">
                          Tervalidasi Digital
                        </span>
                        <p className="text-xs font-black text-[#0b1c30] mt-1">
                          {date} • {time} WIB
                        </p>
                        <p className="text-[10px] text-gray-500 font-medium">
                          {counselingTempat}
                        </p>
                      </div>
                    </div>

                    {/* Tombol Aksi Langsung di Bagian F: [Simpan Laporan Resmi] [Download PDF] */}
                    <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={handleFinalSubmit}
                        className="w-full py-3.5 px-5 bg-gradient-to-r from-teal-700 to-[#00685f] hover:from-teal-800 hover:to-[#005049] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-teal-900/20 hover:shadow-xl transition-all cursor-pointer active:scale-98"
                      >
                        <CheckCircle2 className="w-5 h-5 text-white" />
                        <span>Simpan Laporan Resmi</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadKonselingIndividualPdf}
                        className="w-full py-3.5 px-5 bg-white hover:bg-teal-50 text-[#00685f] border-2 border-[#00685f] rounded-xl font-black text-sm flex items-center justify-center gap-2.5 shadow-xs transition-all cursor-pointer active:scale-98"
                      >
                        <Download className="w-4 h-4 text-[#00685f]" />
                        <span>Download PDF Laporan Ini</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. FORM BIMBINGAN KLASIKAL STANDAR RPL & PELAKSANAAN BK   */}
          {/* ========================================================= */}
          {isBimbinganKlasikalOnly && (
            <div className="space-y-4">
              {/* Header Banner Khusus Bimbingan Klasikal */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-50 via-emerald-50 to-white rounded-2xl border border-teal-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00685f] text-white flex items-center justify-center font-black shadow-xs shrink-0">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#00685f] uppercase tracking-wider">
                        Bimbingan Klasikal
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Dibantu Meta AI ✨
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-[#0b1c30]">
                      Laporan & RPL Kelas {selectedClass || '8A'}
                    </h3>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-600 bg-white/80 p-2 rounded-xl border border-teal-100">
                  <span>📅 {date}</span>
                  <span>•</span>
                  <span>⏱️ Jam Ke-{klasikalJamKe}</span>
                  <span>•</span>
                  <span>👥 {klasikalHadir} Hadir ({klasikalTidakHadir} Absen)</span>
                  <span>•</span>
                  <span>📍 {klasikalTempat}</span>
                </div>
              </div>

              {/* ACCORDION CONTAINER */}
              <div className="space-y-3">
                {/* ------------------------------------------------------------- */}
                {/* BAGIAN A: RPL (Rencana Pelaksanaan Layanan)                   */}
                {/* ------------------------------------------------------------- */}
                <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveAccordionKlasikal(activeAccordionKlasikal === 'A' ? null : 'A')}
                    className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-gray-50/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                        activeAccordionKlasikal === 'A' ? 'bg-[#00685f] text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        A
                      </span>
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-[#0b1c30]">
                          A. RPL (Rencana Pelaksanaan Layanan)
                        </h4>
                        <p className="text-xs text-gray-500 font-medium">
                          Bidang bimbingan, topik/judul materi, dan rumusan tujuan layanan
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                      activeAccordionKlasikal === 'A' ? 'rotate-180 text-[#00685f]' : ''
                    }`} />
                  </button>

                  {activeAccordionKlasikal === 'A' && (
                    <div className="p-4 sm:p-6 border-t border-gray-100 space-y-4 bg-white animate-in fade-in duration-150">
                      {/* Bidang Bimbingan */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                          Bidang Bimbingan:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {(['Pribadi', 'Sosial', 'Belajar', 'Karir'] as const).map((bid) => {
                            const isSelected = klasikalBidang === bid;
                            return (
                              <button
                                key={bid}
                                type="button"
                                onClick={() => setKlasikalBidang(bid)}
                                className={`p-3 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#00685f] text-white border-[#00685f] shadow-xs ring-1 ring-[#00685f]'
                                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                }`}
                              >
                                Bidang {bid}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Topik / Judul Materi */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                          Topik / Judul Materi:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                          {MATERI_KLASIKAL_OPTIONS.map((m) => {
                            const isSelected = klasikalTopik === m;
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => {
                                  setKlasikalTopik(m);
                                  setKlasikalMateri(m);
                                }}
                                className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-teal-50 border-[#00685f] text-[#00685f] font-black ring-1 ring-[#00685f]'
                                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                }`}
                              >
                                {m}
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="text"
                          value={klasikalTopik}
                          onChange={(e) => {
                            setKlasikalTopik(e.target.value);
                            setKlasikalMateri(e.target.value);
                          }}
                          placeholder="Ketik topik materi klasikal atau pilih tombol di atas..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Tujuan Layanan + Tombol AI */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                            Tujuan Layanan:
                          </label>
                          <button
                            type="button"
                            onClick={handleBuatkanTujuanDariTopik}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>✨ Buatkan Tujuan dari Topik</span>
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={klasikalTujuan}
                          onChange={(e) => setKlasikalTujuan(e.target.value)}
                          placeholder="Tuliskan tujuan layanan (tahap pengenalan, akomodasi, dan tindakan)..."
                          className="w-full p-3.5 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ------------------------------------------------------------- */}
                {/* BAGIAN B: PELAKSANAAN                                         */}
                {/* ------------------------------------------------------------- */}
                <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveAccordionKlasikal(activeAccordionKlasikal === 'B' ? null : 'B')}
                    className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-gray-50/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                        activeAccordionKlasikal === 'B' ? 'bg-[#00685f] text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        B
                      </span>
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-[#0b1c30]">
                          B. Pelaksanaan
                        </h4>
                        <p className="text-xs text-gray-500 font-medium">
                          Uraian materi yang disampaikan, metode bimbingan, dan media layanan
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                      activeAccordionKlasikal === 'B' ? 'rotate-180 text-[#00685f]' : ''
                    }`} />
                  </button>

                  {activeAccordionKlasikal === 'B' && (
                    <div className="p-4 sm:p-6 border-t border-gray-100 space-y-4 bg-white animate-in fade-in duration-150">
                      {/* Materi yang Disampaikan + Tombol AI */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                            Materi yang Disampaikan:
                          </label>
                          <button
                            type="button"
                            onClick={handleBantuTulisMateriKlasikal}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-teal-600 to-[#00685f] hover:from-teal-700 text-white rounded-lg text-xs font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>✨ Bantu Tulis Materi</span>
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={klasikalMateriUraian}
                          onChange={(e) => setKlasikalMateriUraian(e.target.value)}
                          placeholder="Tuliskan uraian poin-poin materi yang dipaparkan kepada siswa di kelas..."
                          className="w-full p-3.5 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Metode Checklist */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                          Metode Bimbingan (Bisa pilih beberapa):
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            'Ceramah',
                            'Diskusi Kelompok',
                            'Role Play',
                            'Games',
                            'Studi Kasus',
                            'Tanya Jawab'
                          ].map((met) => {
                            const isChecked = klasikalMetode.includes(met);
                            return (
                              <button
                                key={met}
                                type="button"
                                onClick={() => handleToggleMetode(met)}
                                className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold text-left transition-all cursor-pointer ${
                                  isChecked
                                    ? 'bg-teal-50 border-[#00685f] text-[#00685f] font-black ring-1 ring-[#00685f]'
                                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                }`}
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-[#00685f] shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-400 shrink-0" />
                                )}
                                <span>{met}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Media Checklist */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                          Media Layanan (Bisa pilih beberapa):
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {['PPT', 'Video', 'Lembar Kerja', 'Papan Tulis'].map((med) => {
                            const isChecked = klasikalMedia.includes(med);
                            return (
                              <button
                                key={med}
                                type="button"
                                onClick={() => handleToggleMedia(med)}
                                className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold text-left transition-all cursor-pointer ${
                                  isChecked
                                    ? 'bg-teal-50 border-[#00685f] text-[#00685f] font-black ring-1 ring-[#00685f]'
                                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                }`}
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-[#00685f] shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-400 shrink-0" />
                                )}
                                <span>{med}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ------------------------------------------------------------- */}
                {/* BAGIAN C: EVALUASI (Laiseg, Laijapen, Laijapang)              */}
                {/* ------------------------------------------------------------- */}
                <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveAccordionKlasikal(activeAccordionKlasikal === 'C' ? null : 'C')}
                    className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-gray-50/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                        activeAccordionKlasikal === 'C' ? 'bg-[#00685f] text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        C
                      </span>
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-[#0b1c30]">
                          C. Evaluasi
                        </h4>
                        <p className="text-xs text-gray-500 font-medium">
                          Laiseg (segera), Laijapen (jangka pendek), Laijapang (jangka panjang), & hasil
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                      activeAccordionKlasikal === 'C' ? 'rotate-180 text-[#00685f]' : ''
                    }`} />
                  </button>

                  {activeAccordionKlasikal === 'C' && (
                    <div className="p-4 sm:p-6 border-t border-gray-100 space-y-4 bg-white animate-in fade-in duration-150">
                      {/* Laiseg */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                          Laiseg (Penilaian Segera):
                        </label>
                        <p className="text-[11px] text-gray-500 mb-1.5 font-medium">
                          Apa yang dirasakan dan dipahami siswa saat layanan berlangsung hari ini?
                        </p>
                        <textarea
                          rows={2}
                          value={klasikalLaiseg}
                          onChange={(e) => setKlasikalLaiseg(e.target.value)}
                          placeholder="Contoh: Siswa aktif berdiskusi, antusias menyimak video, dan memahami dampak bullying..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Laijapen */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                          Laijapen (Penilaian Jangka Pendek):
                        </label>
                        <p className="text-[11px] text-gray-500 mb-1.5 font-medium">
                          Perubahan sikap atau perilaku yang diharapkan dalam 1 minggu ke depan:
                        </p>
                        <textarea
                          rows={2}
                          value={klasikalLaijapen}
                          onChange={(e) => setKlasikalLaijapen(e.target.value)}
                          placeholder="Contoh: Menurunnya ejekan verbal di kelas dan siswa mempraktikkan manajemen waktu..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Laijapang */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                          Laijapang (Penilaian Jangka Panjang):
                        </label>
                        <p className="text-[11px] text-gray-500 mb-1.5 font-medium">
                          Perubahan jangka panjang dan pembiasaan budaya positif di sekolah:
                        </p>
                        <textarea
                          rows={2}
                          value={klasikalLaijapang}
                          onChange={(e) => setKlasikalLaijapang(e.target.value)}
                          placeholder="Contoh: Terbentuknya lingkungan kelas yang saling menghormati dan motivasi belajar meningkat..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Hasil Evaluasi */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                          Ketercapaian Hasil Layanan:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['Tercapai', 'Sebagian', 'Belum Tercapai'] as const).map((h) => {
                            const isSelected = klasikalHasilEvaluasi === h;
                            return (
                              <button
                                key={h}
                                type="button"
                                onClick={() => setKlasikalHasilEvaluasi(h)}
                                className={`p-3 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                                  isSelected
                                    ? h === 'Tercapai'
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                      : h === 'Sebagian'
                                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                      : 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                }`}
                              >
                                {h}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ------------------------------------------------------------- */}
                {/* BAGIAN D: TINDAK LANJUT                                       */}
                {/* ------------------------------------------------------------- */}
                <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveAccordionKlasikal(activeAccordionKlasikal === 'D' ? null : 'D')}
                    className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-gray-50/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                        activeAccordionKlasikal === 'D' ? 'bg-[#00685f] text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        D
                      </span>
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-[#0b1c30]">
                          D. Tindak Lanjut
                        </h4>
                        <p className="text-xs text-gray-500 font-medium">
                          Rekomendasi tindak lanjut, siswa yang butuh penanganan khusus, & pertemuan berikutnya
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                      activeAccordionKlasikal === 'D' ? 'rotate-180 text-[#00685f]' : ''
                    }`} />
                  </button>

                  {activeAccordionKlasikal === 'D' && (
                    <div className="p-4 sm:p-6 border-t border-gray-100 space-y-4 bg-white animate-in fade-in duration-150">
                      {/* Checklist Tindak Lanjut */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                          Tindak Lanjut Pasca Layanan (Bisa pilih beberapa):
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {[
                            'Siswa perlu Konseling Individual',
                            'Perlu Home Visit',
                            'Lanjut Materi Berikutnya'
                          ].map((item) => {
                            const isChecked = klasikalTindakLanjutChecklist.includes(item);
                            return (
                              <button
                                key={item}
                                type="button"
                                onClick={() => handleToggleKlasikalTindakLanjut(item)}
                                className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold text-left transition-all cursor-pointer ${
                                  isChecked
                                    ? 'bg-teal-50 border-[#00685f] text-[#00685f] font-black ring-1 ring-[#00685f]'
                                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                }`}
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-[#00685f] shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-400 shrink-0" />
                                )}
                                <span>{item}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Nama Siswa yang Perlu Ditindaklanjuti */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                          Nama Siswa yang Perlu Ditindaklanjuti (Jika ada):
                        </label>
                        <input
                          type="text"
                          value={klasikalSiswaPerluLanjut}
                          onChange={(e) => setKlasikalSiswaPerluLanjut(e.target.value)}
                          placeholder="Contoh: Ahmad Nur Wahid (perlu konseling individual terkait fokus belajar)"
                          className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Rencana Pertemuan Berikutnya */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                          Rencana Pertemuan Berikutnya:
                        </label>
                        <input
                          type="text"
                          value={klasikalRencanaBerikutnya}
                          onChange={(e) => setKlasikalRencanaBerikutnya(e.target.value)}
                          placeholder="Contoh: Pertemuan ke-2 materi Anti Bullying pada pekan depan (Selasa)"
                          className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Tombol Aksi di Accordion D */}
                      <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-3">
                        <button
                          type="button"
                          onClick={handleFinalSubmit}
                          className="w-full sm:flex-1 py-3.5 px-5 bg-gradient-to-r from-teal-600 to-[#00685f] hover:from-teal-700 hover:to-[#005049] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-98"
                        >
                          <CheckCircle2 className="w-5 h-5 text-white" />
                          <span>Simpan Laporan Klasikal</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadKlasikalPdf}
                          className="w-full sm:w-auto py-3.5 px-5 bg-white hover:bg-teal-50 text-[#00685f] border-2 border-[#00685f] rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-98 shrink-0"
                        >
                          <Download className="w-4 h-4 text-[#00685f]" />
                          <span>Download PDF RPL</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2B. FORM INFORMASI / ORIENTASI (LAINNYA)                   */}
          {/* ========================================================= */}
          {!isBimbinganKlasikalOnly && isFormBimbinganKlasikal && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-4">
              {/* Materi: Pilihan Tombol */}
              <div>
                <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                  Materi Bimbingan:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {MATERI_KLASIKAL_OPTIONS.map((m) => {
                    const isSelected = klasikalMateri === m && !klasikalCustomMateri;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setKlasikalMateri(m);
                          setKlasikalCustomMateri('');
                        }}
                        className={`p-3 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#00685f] text-white border-[#00685f] shadow-xs'
                            : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2">
                  <input
                    type="text"
                    value={klasikalCustomMateri}
                    onChange={(e) => {
                      setKlasikalCustomMateri(e.target.value);
                      if (e.target.value) setKlasikalMateri(e.target.value);
                    }}
                    placeholder="Atau ketik materi khusus lainnya..."
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
              </div>

              {/* Kelas & Jumlah Siswa Otomatis */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Kelas:</span>
                  <p className="text-sm font-black text-[#0b1c30]">Kelas {selectedClass || selectedStudents[0]?.class || '-'}</p>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Jumlah Siswa:</span>
                  <p className="text-sm font-black text-[#00685f]">{selectedStudents.length} Siswa</p>
                </div>
              </div>

              {/* Ringkasan Materi + Tombol Buatkan Rangkuman Meta AI */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                    Ringkasan Materi:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const polished = polishTextWithMetaAi('klasikal', klasikalRawSummary, { materi: klasikalCustomMateri || klasikalMateri });
                      setKlasikalAiSummary(polished);
                      setKlasikalUseAi(true);
                      showToast('✨ 3 Poin rangkuman materi berhasil dibuatkan oleh Meta AI!', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Buatkan Rangkuman dengan Meta AI</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={klasikalUseAi && klasikalAiSummary ? klasikalAiSummary : klasikalRawSummary}
                  onChange={(e) => {
                    if (klasikalUseAi) setKlasikalAiSummary(e.target.value);
                    else setKlasikalRawSummary(e.target.value);
                  }}
                  placeholder="Tulis ringkasan singkat materi yang disampaikan..."
                  className="w-full p-3.5 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Tindak Lanjut */}
              <div>
                <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                  Tindak Lanjut:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['Evaluasi', 'Lanjut ke Sesi Berikutnya'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setKlasikalFollowUp(opt)}
                      className={`p-3 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                        klasikalFollowUp === opt
                          ? 'bg-[#00685f] text-white border-[#00685f]'
                          : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. FORM BIMBINGAN KELOMPOK                                */}
          {/* ========================================================= */}
          {isFormBimbinganKelompok && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-4">
              <div>
                <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
                  Tema Kelompok:
                </label>
                <input
                  type="text"
                  value={bimbKelTema}
                  onChange={(e) => setBimbKelTema(e.target.value)}
                  placeholder="Contoh: Mengasah Percaya Diri, Literasi Digital, Solidaritas Kelas..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none"
                />
              </div>

              {/* Daftar Siswa yang Dipilih di Tahap 2 */}
              <div>
                <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
                  Daftar Siswa Peserta Kelompok ({selectedStudents.length} Siswa):
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  {selectedStudents.map((st) => (
                    <span key={st.id} className="px-2.5 py-1 bg-white border border-[#00685f]/30 text-[#00685f] rounded-lg text-xs font-black shadow-2xs">
                      {st.name} ({st.class})
                    </span>
                  ))}
                </div>
              </div>

              {/* Dinamika Kelompok + Tombol Rapikan Meta AI */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                    Dinamika Kelompok:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const polished = polishTextWithMetaAi('konseling_kelompok', bimbKelRawDinamika);
                      setBimbKelAiDinamika(polished);
                      setBimbKelUseAi(true);
                      showToast('✨ Dinamika kelompok dirapikan oleh Meta AI!', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Rapikan dengan Meta AI</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={bimbKelUseAi && bimbKelAiDinamika ? bimbKelAiDinamika : bimbKelRawDinamika}
                  onChange={(e) => {
                    if (bimbKelUseAi) setBimbKelAiDinamika(e.target.value);
                    else setBimbKelRawDinamika(e.target.value);
                  }}
                  placeholder="Tulis jalannya dinamika kelompok, keterbukaan siswa, dan hasil diskusi..."
                  className="w-full p-3.5 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. FORM KONSELING KELOMPOK                                */}
          {/* ========================================================= */}
          {isFormKonselingKelompok && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-4">
              <div>
                <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                  Topik Masalah Kelompok:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TOPIK_POPULER.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCounselingTopic(item.id)}
                      className={`p-2.5 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                        counselingTopic === item.id ? 'bg-[#00685f] text-white border-[#00685f]' : 'bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
                  Peran Tiap Siswa (Siapa yang dominan, siapa yang pendiam):
                </label>
                <input
                  type="text"
                  value={konsKelPeranSiswa}
                  onChange={(e) => setKonsKelPeranSiswa(e.target.value)}
                  placeholder="Contoh: Siswa A dominan berbicara, Siswa B cenderung pendiam..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                    Ringkasan Konseling Kelompok:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const polished = polishTextWithMetaAi('konseling_kelompok', konsKelRawSummary);
                      setKonsKelAiSummary(polished);
                      setKonsKelUseAi(true);
                      showToast('✨ Ringkasan konseling kelompok dirapikan oleh Meta AI!', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Rapikan dengan Meta AI</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={konsKelUseAi && konsKelAiSummary ? konsKelAiSummary : konsKelRawSummary}
                  onChange={(e) => {
                    if (konsKelUseAi) setKonsKelAiSummary(e.target.value);
                    else setKonsKelRawSummary(e.target.value);
                  }}
                  placeholder="Tulis proses konseling dan kesepakatan komitmen bersama..."
                  className="w-full p-3.5 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. FORM HOME VISIT STANDAR BK (ACCORDION A - C)            */}
          {/* ========================================================= */}
          {isHomeVisitOnly && (
            <div className="space-y-4">
              {/* Header Banner Khusus Home Visit */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50 via-teal-50 to-white rounded-2xl border border-teal-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00685f] text-white flex items-center justify-center font-black shadow-xs shrink-0">
                    <Home className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#00685f] uppercase tracking-wider">
                        Home Visit (Kunjungan Rumah)
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Dibantu Meta AI ✨
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-[#0b1c30]">
                      Laporan Kunjungan: {selectedStudents[0]?.name || 'Siswa'} ({selectedStudents[0]?.class || 'Kelas'})
                    </h3>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-600 bg-white/80 p-2 rounded-xl border border-teal-100">
                  <span>📅 {homeVisitTanggal || date}</span>
                  <span>•</span>
                  <span>⏱️ {homeVisitJamBerangkat}</span>
                  <span>•</span>
                  <span>👥 {homeVisitPetugas}</span>
                  <span>•</span>
                  <span>🎯 {homeVisitTujuan}</span>
                </div>
              </div>

              {/* ACCORDION CONTAINER */}
              <div className="space-y-3">
                {/* ------------------------------------------------------------- */}
                {/* BAGIAN A: PELAKSANAAN                                         */}
                {/* ------------------------------------------------------------- */}
                <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveAccordionHomeVisit(activeAccordionHomeVisit === 'A' ? null : 'A')}
                    className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-gray-50/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                        activeAccordionHomeVisit === 'A' ? 'bg-[#00685f] text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        A
                      </span>
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-[#0b1c30]">
                          A. Pelaksanaan Kunjungan
                        </h4>
                        <p className="text-xs text-gray-500 font-medium">
                          Pihak yang ditemui, situasi rumah tinggal, dan uraian hasil pembicaraan
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                      activeAccordionHomeVisit === 'A' ? 'rotate-180 text-[#00685f]' : ''
                    }`} />
                  </button>

                  {activeAccordionHomeVisit === 'A' && (
                    <div className="p-4 sm:p-6 border-t border-gray-100 space-y-4 bg-white animate-in fade-in duration-150">
                      {/* Siapa yang Ditemui */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                          Siapa yang Ditemui di Rumah:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {(['Ayah', 'Ibu', 'Wali', 'Lainnya'] as const).map((p) => {
                            const isSelected = homeVisitYangDitemui === p;
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setHomeVisitYangDitemui(p)}
                                className={`p-3 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#00685f] text-white border-[#00685f] shadow-xs'
                                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                }`}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>
                        {homeVisitYangDitemui === 'Lainnya' && (
                          <div className="mt-2">
                            <input
                              type="text"
                              value={homeVisitYangDitemuiLainnya}
                              onChange={(e) => setHomeVisitYangDitemuiLainnya(e.target.value)}
                              placeholder="Ketik hubungan keluarga (contoh: Kakek, Paman, Kakak Kandung)..."
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                            />
                          </div>
                        )}
                      </div>

                      {/* Kondisi Rumah */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                          Kondisi Lingkungan & Suasana Rumah:
                        </label>
                        <textarea
                          rows={2}
                          value={homeVisitKondisiRumah}
                          onChange={(e) => setHomeVisitKondisiRumah(e.target.value)}
                          placeholder="Tulis gambaran singkat tempat tinggal, suasana keluarga, ketersediaan fasilitas belajar siswa..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Hasil Pembicaraan + Tombol AI */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                            Hasil Pembicaraan:
                          </label>
                          <button
                            type="button"
                            onClick={handleBantuRapikanHasilHomeVisit}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>✨ Bantu Rapikan Hasil Pembicaraan</span>
                          </button>
                        </div>

                        <textarea
                          rows={4}
                          value={homeVisitUseAi && homeVisitAiHasil ? homeVisitAiHasil : homeVisitRawHasil}
                          onChange={(e) => {
                            if (homeVisitUseAi) setHomeVisitAiHasil(e.target.value);
                            else setHomeVisitRawHasil(e.target.value);
                          }}
                          placeholder="Tuliskan poin dialog dengan orang tua/wali, alasan siswa tidak masuk/bermasalah, dan penjelasan keluarga..."
                          className="w-full p-3.5 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ------------------------------------------------------------- */}
                {/* BAGIAN B: KESEPAKATAN                                         */}
                {/* ------------------------------------------------------------- */}
                <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveAccordionHomeVisit(activeAccordionHomeVisit === 'B' ? null : 'B')}
                    className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-gray-50/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                        activeAccordionHomeVisit === 'B' ? 'bg-[#00685f] text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        B
                      </span>
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-[#0b1c30]">
                          B. Kesepakatan & Komitmen
                        </h4>
                        <p className="text-xs text-gray-500 font-medium">
                          Poin kesepakatan bersama, komitmen orang tua, siswa, dan pihak sekolah
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                      activeAccordionHomeVisit === 'B' ? 'rotate-180 text-[#00685f]' : ''
                    }`} />
                  </button>

                  {activeAccordionHomeVisit === 'B' && (
                    <div className="p-4 sm:p-6 border-t border-gray-100 space-y-4 bg-white animate-in fade-in duration-150">
                      {/* Kesepakatan dengan Orang Tua */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                          Kesepakatan dengan Orang Tua:
                        </label>
                        <textarea
                          rows={2}
                          value={homeVisitKesepakatanOrtu}
                          onChange={(e) => setHomeVisitKesepakatanOrtu(e.target.value)}
                          placeholder="Contoh: Orang tua memastikan anak tidur sebelum jam 22.00, mengontrol penggunaan HP, dan mengantar anak ke sekolah..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Komitmen Orang Tua */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                          Komitmen Orang Tua:
                        </label>
                        <input
                          type="text"
                          value={homeVisitKomitmenOrtu}
                          onChange={(e) => setHomeVisitKomitmenOrtu(e.target.value)}
                          placeholder="Contoh: Bersedia memantau kepulangan anak dan aktif berkoordinasi dengan wali kelas/BK..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Komitmen Siswa */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                          Komitmen Siswa:
                        </label>
                        <input
                          type="text"
                          value={homeVisitKomitmenSiswa}
                          onChange={(e) => setHomeVisitKomitmenSiswa(e.target.value)}
                          placeholder="Contoh: Berjanji masuk sekolah tepat waktu, tidak membolos, dan menyelesaikan tugas..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Komitmen Sekolah */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                          Komitmen Sekolah:
                        </label>
                        <input
                          type="text"
                          value={homeVisitKomitmenSekolah}
                          onChange={(e) => setHomeVisitKomitmenSekolah(e.target.value)}
                          placeholder="Contoh: Guru BK dan wali kelas memberikan bimbingan berkala dan melaporkan perkembangan berkala..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ------------------------------------------------------------- */}
                {/* BAGIAN C: BUKTI & PENUTUP                                     */}
                {/* ------------------------------------------------------------- */}
                <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveAccordionHomeVisit(activeAccordionHomeVisit === 'C' ? null : 'C')}
                    className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-gray-50/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                        activeAccordionHomeVisit === 'C' ? 'bg-[#00685f] text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        C
                      </span>
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-[#0b1c30]">
                          C. Bukti & Penutup
                        </h4>
                        <p className="text-xs text-gray-500 font-medium">
                          Dokumentasi foto, penandatangan, status kunjungan, & tindak lanjut
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                      activeAccordionHomeVisit === 'C' ? 'rotate-180 text-[#00685f]' : ''
                    }`} />
                  </button>

                  {activeAccordionHomeVisit === 'C' && (
                    <div className="p-4 sm:p-6 border-t border-gray-100 space-y-4 bg-white animate-in fade-in duration-150">
                      {/* Upload Foto Bukti (Opsional) */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
                          Upload Foto Bukti Kunjungan (Opsional):
                        </label>
                        {homeVisitFotoBukti ? (
                          <div className="p-3 bg-gray-50 border-2 border-teal-200 rounded-xl flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={homeVisitFotoBukti}
                                alt="Dokumentasi Home Visit"
                                className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                              />
                              <div>
                                <p className="text-xs font-black text-[#0b1c30]">{homeVisitFotoName || 'foto_kunjungan.jpg'}</p>
                                <p className="text-[10px] text-teal-700 font-bold">✓ Foto dokumentasi siap dilampirkan di PDF</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setHomeVisitFotoBukti(null);
                                setHomeVisitFotoName('');
                              }}
                              className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold border border-rose-200 cursor-pointer"
                            >
                              Hapus Foto
                            </button>
                          </div>
                        ) : (
                          <label className="border-2 border-dashed border-gray-300 hover:border-[#00685f] rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-gray-50/70 hover:bg-teal-50/30 transition-all">
                            <div className="p-2.5 rounded-full bg-teal-100 text-[#00685f]">
                              <Camera className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-gray-700">
                              Klik untuk Ambil Foto / Upload Dokumen Bukti (Maks. 5 MB)
                            </span>
                            <span className="text-[10px] text-gray-400">Format: JPG, PNG, WEBP</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleHomeVisitPhotoUpload}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>

                      {/* Nama Orang Tua yang Menandatangani */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                          Nama Orang Tua yang Menandatangani Berita Acara:
                        </label>
                        <input
                          type="text"
                          value={homeVisitTtdOrtu}
                          onChange={(e) => setHomeVisitTtdOrtu(e.target.value)}
                          placeholder="Nama lengkap orang tua / wali..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Status Kunjungan */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                          Status Kunjungan:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['Berhasil Ditemui', 'Rumah Kosong', 'Ditolak'] as const).map((st) => {
                            const isSelected = homeVisitStatus === st;
                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setHomeVisitStatus(st)}
                                className={`p-3 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                                  isSelected
                                    ? st === 'Berhasil Ditemui'
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                      : st === 'Rumah Kosong'
                                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                      : 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                }`}
                              >
                                {st}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Tindak Lanjut Checklist */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                          Tindak Lanjut Pasca Kunjungan (Bisa pilih beberapa):
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            'Pantau 1 Minggu',
                            'Konseling Lanjutan',
                            'Rapat Kasus',
                            'Buat Surat Panggilan Kedua'
                          ].map((item) => {
                            const isChecked = homeVisitTindakLanjut.includes(item);
                            return (
                              <button
                                key={item}
                                type="button"
                                onClick={() => handleToggleHomeVisitTindakLanjut(item)}
                                className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold text-left transition-all cursor-pointer ${
                                  isChecked
                                    ? 'bg-teal-50 border-[#00685f] text-[#00685f] font-black ring-1 ring-[#00685f]'
                                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                }`}
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-[#00685f] shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-400 shrink-0" />
                                )}
                                <span>{item}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Jadwal Pantau Berikutnya */}
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                          Jadwal Pantau Berikutnya:
                        </label>
                        <input
                          type="date"
                          value={homeVisitJadwalPantau}
                          onChange={(e) => setHomeVisitJadwalPantau(e.target.value)}
                          className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Tombol Aksi di Accordion C */}
                      <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-3">
                        <button
                          type="button"
                          onClick={handleFinalSubmit}
                          className="w-full sm:flex-1 py-3.5 px-5 bg-gradient-to-r from-teal-600 to-[#00685f] hover:from-teal-700 hover:to-[#005049] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-98"
                        >
                          <CheckCircle2 className="w-5 h-5 text-white" />
                          <span>Simpan Laporan Home Visit</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadHomeVisitPdf}
                          className="w-full sm:w-auto py-3.5 px-5 bg-white hover:bg-teal-50 text-[#00685f] border-2 border-[#00685f] rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-98 shrink-0"
                        >
                          <Download className="w-4 h-4 text-[#00685f]" />
                          <span>Download PDF</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. FORM KONSULTASI / KOLABORASI                           */}
          {/* ========================================================= */}
          {isFormKonsultasi && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-4">
              <div>
                <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                  Diajak Siapa (Pihak Konsultasi):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Wali Kelas', 'Ortu', 'Dewan Guru', 'Psikolog'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setKonsultasiDiajakSiapa(p)}
                      className={`p-3 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                        konsultasiDiajakSiapa === p ? 'bg-[#00685f] text-white border-[#00685f]' : 'bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
                  Masalah yang Dikonsultasikan:
                </label>
                <input
                  type="text"
                  value={konsultasiRawMasalah}
                  onChange={(e) => setKonsultasiRawMasalah(e.target.value)}
                  placeholder="Contoh: Siswa sering tidak mengumpulkan tugas, pasif di kelas..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                    Hasil Kesepakatan:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const polished = polishTextWithMetaAi('konsultasi', konsultasiRawHasil);
                      setKonsultasiAiHasil(polished);
                      setKonsultasiUseAi(true);
                      showToast('✨ Kesimpulan konsultasi berhasil dibuatkan Meta AI!', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Buatkan Kesimpulan dengan Meta AI</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={konsultasiUseAi && konsultasiAiHasil ? konsultasiAiHasil : konsultasiRawHasil}
                  onChange={(e) => {
                    if (konsultasiUseAi) setKonsultasiAiHasil(e.target.value);
                    else setKonsultasiRawHasil(e.target.value);
                  }}
                  placeholder="Tulis kesepakatan langkah bersama untuk mendampingi siswa..."
                  className="w-full p-3.5 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. FORM KONFERENSI KASUS / RAPAT KASUS                    */}
          {/* ========================================================= */}
          {isFormKonferensiKasus && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-4">
              <div>
                <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
                  Kasus yang Dibahas (Otomatis dari Data Kasus Siswa):
                </label>
                <input
                  type="text"
                  value={konferensiKasus}
                  onChange={(e) => setKonferensiKasus(e.target.value)}
                  placeholder="Kasus yang dibahas..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                  Peserta Rapat (Centang yang Hadir):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Guru BK', 'Wali Kelas', 'Kepala Sekolah', 'Ortu'] as const).map((peserta) => {
                    const isChecked = konferensiPeserta.includes(peserta);
                    return (
                      <button
                        key={peserta}
                        type="button"
                        onClick={() => {
                          if (isChecked) setKonferensiPeserta((prev) => prev.filter((p) => p !== peserta));
                          else setKonferensiPeserta((prev) => [...prev, peserta]);
                        }}
                        className={`p-3 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          isChecked ? 'bg-[#00685f] text-white border-[#00685f]' : 'bg-gray-50 border-gray-200 text-gray-700'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        <span>{peserta}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                    Keputusan Rapat:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const polished = polishTextWithMetaAi('konferensi_kasus', konferensiRawKeputusan);
                      setKonferensiAiKeputusan(polished);
                      setKonferensiUseAi(true);
                      showToast('✨ Notulen keputusan rapat dibuatkan Meta AI!', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Buatkan Notulen dengan Meta AI</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={konferensiUseAi && konferensiAiKeputusan ? konferensiAiKeputusan : konferensiRawKeputusan}
                  onChange={(e) => {
                    if (konferensiUseAi) setKonferensiAiKeputusan(e.target.value);
                    else setKonferensiRawKeputusan(e.target.value);
                  }}
                  placeholder="Tulis butir-butir keputusan hasil rapat konferensi kasus..."
                  className="w-full p-3.5 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 8. FORM ALIH TANGAN KASUS                                 */}
          {/* ========================================================= */}
          {isFormAlihTangan && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-4">
              <div>
                <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                  Dirujuk Ke (Lembaga / Pihak Ahli):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Psikolog', 'Pihak Luar', 'Guru BK Lain'] as const).map((pihak) => (
                    <button
                      key={pihak}
                      type="button"
                      onClick={() => setAlihTanganDirujukKe(pihak)}
                      className={`p-3 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                        alihTanganDirujukKe === pihak ? 'bg-[#00685f] text-white border-[#00685f]' : 'bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      {pihak}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                    Alasan Rujukan:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const polished = polishTextWithMetaAi('alih_tangan', alihTanganRawAlasan);
                      setAlihTanganAiSurat(polished);
                      setAlihTanganUseAi(true);
                      showToast('✨ Format surat pengantar rujukan dibuatkan Meta AI!', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Buatkan Surat Pengantar dengan Meta AI</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={alihTanganUseAi && alihTanganAiSurat ? alihTanganAiSurat : alihTanganRawAlasan}
                  onChange={(e) => {
                    if (alihTanganUseAi) setAlihTanganAiSurat(e.target.value);
                    else setAlihTanganRawAlasan(e.target.value);
                  }}
                  placeholder="Tulis alasan objektif mengapa kasus membutuhkan penanganan ahli luar..."
                  className="w-full p-3.5 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 9. FORM CATAT KASUS                                       */}
          {/* ========================================================= */}
          {isFormCatatKasus && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-4">
              <div>
                <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                  Jenis Pelanggaran:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PELANGGARAN_OPTIONS.map((pel) => {
                    const isSelected = catatKasusJenis === pel.name;
                    return (
                      <button
                        key={pel.name}
                        type="button"
                        onClick={() => {
                          setCatatKasusJenis(pel.name);
                          setCatatKasusPoin(pel.points);
                        }}
                        className={`p-2.5 rounded-xl border-2 text-left text-xs font-black transition-all cursor-pointer ${
                          isSelected ? 'bg-rose-600 text-white border-rose-600 shadow-xs' : 'bg-gray-50 border-gray-200 text-gray-800'
                        }`}
                      >
                        <p className="truncate">{pel.name}</p>
                        <p className={`text-[10px] ${isSelected ? 'text-rose-100' : 'text-rose-700'}`}>+{pel.points} Poin</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-amber-900">Poin Pelanggaran Otomatis:</span>
                <span className="font-black px-2.5 py-1 bg-amber-600 text-white rounded-lg">
                  +{catatKasusPoin} Poin
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                    Kronologi Singkat:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const polished = polishTextWithMetaAi('catat_kasus', catatKasusRawKronologi);
                      setCatatKasusAiKronologi(polished);
                      setCatatKasusUseAi(true);
                      showToast('✨ Kronologi pelanggaran dirapikan Meta AI!', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-extrabold shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Rapikan Kronologi dengan Meta AI</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={catatKasusUseAi && catatKasusAiKronologi ? catatKasusAiKronologi : catatKasusRawKronologi}
                  onChange={(e) => {
                    if (catatKasusUseAi) setCatatKasusAiKronologi(e.target.value);
                    else setCatatKasusRawKronologi(e.target.value);
                  }}
                  placeholder="Tulis kronologi apa yang terjadi..."
                  className="w-full p-3.5 bg-gray-50 border-2 border-gray-200 focus:border-[#00685f] rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                  Sanksi / Pembinaan Restitusi:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Kasih Nasehat', 'Surat Peringatan', 'Panggil Ortu'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCatatKasusSanksi(s)}
                      className={`p-3 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                        catatKasusSanksi === s ? 'bg-[#00685f] text-white border-[#00685f]' : 'bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 10. FORM ABSEN KELAS (Tanpa Meta AI)                       */}
          {/* ========================================================= */}
          {isFormAbsen && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-[#0b1c30]">Daftar Kehadiran Siswa</h3>
                  <p className="text-xs text-gray-500">Klik status kehadiran untuk tiap siswa</p>
                </div>
                <span className="text-xs font-black text-[#00685f] bg-[#e6f4f1] px-2.5 py-1 rounded-lg">
                  {selectedStudents.length} Siswa Terdaftar
                </span>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {selectedStudents.map((st) => {
                  const currentSt = absenAttendanceMap[st.id] || 'Hadir';
                  return (
                    <div key={st.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-[#0b1c30]">{st.name}</p>
                        <p className="text-[10px] text-gray-500">Kelas {st.class}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        {(['Hadir', 'Sakit', 'Izin', 'Alpa'] as const).map((statusChoice) => {
                          const isPicked = currentSt === statusChoice;
                          return (
                            <button
                              key={statusChoice}
                              type="button"
                              onClick={() => {
                                setAbsenAttendanceMap((prev) => ({
                                  ...prev,
                                  [st.id]: statusChoice,
                                }));
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                                isPicked
                                  ? statusChoice === 'Hadir'
                                    ? 'bg-emerald-600 text-white'
                                    : statusChoice === 'Alpa'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-amber-600 text-white'
                                  : 'bg-white border text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {statusChoice}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* KOTAK REKOMENDASI CERDAS META AI ✨ (Dinamis Berubah Sesuai Topik/Cerita)   */}
          {/* ========================================================================= */}
          {!isFormAbsen && !isFormKonselingIndividual && !isBimbinganKlasikalOnly && !isHomeVisitOnly && (
            <div className="bg-gradient-to-br from-indigo-50/90 via-purple-50/70 to-teal-50/80 border-2 border-indigo-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-2xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-black text-indigo-950">
                  Rekomendasi Cerdas Meta AI ✨
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-indigo-900 leading-relaxed font-semibold pl-8">
                {liveMetaAiRecommendation}
              </p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TOMBOL BAWAH: [KEMBALI KE TAHAP 2] [SIMPAN CATATAN]                       */}
          {/* ========================================================================= */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#bcc9c6]/40 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-20 z-20">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="w-full sm:w-auto px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Tahap 2</span>
            </button>

            <button
              type="button"
              onClick={handleFinalSubmit}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-teal-600 to-[#00685f] hover:from-teal-700 hover:to-[#005049] text-white rounded-xl text-sm sm:text-base font-black flex items-center justify-center gap-2.5 shadow-xl shadow-[#00685f]/25 hover:shadow-2xl transition-all cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>
                {isHomeVisitOnly
                  ? 'Simpan Laporan Home Visit'
                  : isBimbinganKlasikalOnly
                  ? 'Simpan Laporan Klasikal'
                  : isFormKonselingIndividual
                  ? 'Simpan Laporan Resmi'
                  : 'SIMPAN CATATAN'}
              </span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
