import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Student, 
  CounselingService, 
  BKServiceType, 
  BKComponentType, 
  PresetServiceData, 
  ViolationRecord,
  BidangBimbinganType,
  HomeVisitRecord,
  ServiceHomeVisitDetails,
  ServiceIndividualDetails,
  ServiceKelompokParticipant,
  ServiceMediasiDetails,
  ServiceKlasikalDetails,
  ServiceObservasiWawancaraReferalDetails
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
  ExternalLink,
  Camera,
  Upload,
  Phone,
  UserCheck,
  Plus,
  Trash2,
  Info
} from 'lucide-react';
import { showToast } from '../utils/toast';
import { generateServicePDF, downloadHomeVisitPDF } from '../utils/pdfGenerator';
import { formatCardDateTime, formatCardDate, formatCardTime, formatTanggalIndonesia } from '../utils/dateFormatter';
import {
  StandardBlokAIdentitas,
  StandardBlokBKonteks,
  StandardBlokDTindakLanjut,
  StandardizedBlokBState,
  StandardizedBlokDState,
  StandardizedServiceFormKind,
  getDefaultBlokDState,
  buildLocalContextAwareRecommendation,
  requestContextualServiceFormAi,
} from './ServiceFormSharedBlocks';
import { BIDANG_HEX_COLORS, mapJenisMasalahToBidang } from '../utils/evaluationHelpers';

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
  {
    type: 'Observasi & Wawancara',
    label: 'Observasi / Wawancara',
    group: 'Layanan Responsif',
    pilarId: 'Layanan Responsif',
    bidangDefault: 'Pribadi',
    desc: 'Asesmen perilaku langsung (observasi) atau penggalian data (wawancara siswa/guru/ortu)',
    defaultMode: 'Individu',
    icon: Eye,
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
  const [indivProsesPendekatan, setIndivProsesPendekatan] = useState<string>(
    'Solution-Focused Brief Counseling (SFBC) & Active Listening'
  );
  const [indivResponSiswa, setIndivResponSiswa] = useState<string>('');

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

  // 4. Konseling Kelompok Specific (Terstandar Blok A-D)
  const [konsKelPeranSiswa, setKonsKelPeranSiswa] = useState('');
  const [konsKelRawSummary, setKonsKelRawSummary] = useState('');
  const [konsKelAiSummary, setKonsKelAiSummary] = useState('');
  const [konsKelUseAi, setKonsKelUseAi] = useState(false);

  // Standardized Blok A / B / D shared across 4 revised forms (Kelompok, Mediasi, Klasikal, Observasi/Wawancara+Referal)
  const [stdTempat, setStdTempat] = useState<string>('Ruang BK');
  const [stdPertemuanKe, setStdPertemuanKe] = useState<number>(1);
  const [stdSifatLayanan, setStdSifatLayanan] = useState<'Baru' | 'Lanjutan'>('Baru');
  const [stdBlokB, setStdBlokB] = useState<StandardizedBlokBState>({
    jenisMasalah: 'Motivasi Belajar Rendah',
    alasanMasalahLainnya: '',
    tujuanLayanan: 'Mengubah Perilaku',
    teknik: 'Konseling Kelompok',
    baseline: {
      keparahan: 3,
      frekuensi: 3,
      motivasiAwal: 3,
      baselineDariIngatan: true,
    },
  });
  const [stdBlokD, setStdBlokD] = useState<StandardizedBlokDState>(() =>
    getDefaultBlokDState(activeCounselorInfo.name)
  );
  const [stdAiCustomRec, setStdAiCustomRec] = useState<string>('');
  const [isGeneratingStdAi, setIsGeneratingStdAi] = useState<boolean>(false);
  const [isPolishingBlokC, setIsPolishingBlokC] = useState<boolean>(false);

  // Blok C1: Konseling Kelompok Peserta
  const [kelompokParticipants, setKelompokParticipants] = useState<ServiceKelompokParticipant[]>([]);
  const [kelompokKomitmenBersama, setKelompokKomitmenBersama] = useState<string>('');
  const [kelompokAddStudentId, setKelompokAddStudentId] = useState<string>('');

  // Blok C2: Mediasi
  const [mediasiData, setMediasiData] = useState<ServiceMediasiDetails>({
    pihak1Nama: '',
    pihak2Nama: '',
    versiPihak1: '',
    versiPihak2: '',
    titikKonflikUtama: '',
    statusMediasi: 'Sepakat',
    kesepakatanBersama: '',
    alasanTidakSepakat: '',
    rencanaBerikutnya: '',
  });

  // Blok C3: Bimbingan Klasikal tambahan
  const [klasikalTotalSiswa, setKlasikalTotalSiswa] = useState<number>(32);
  const [klasikalDinamikaKelas, setKlasikalDinamikaKelas] = useState<'Aktif' | 'Pasif' | 'Gaduh' | 'Campuran'>('Aktif');
  const [klasikalResponSiswa, setKlasikalResponSiswa] = useState<string>('');

  // Blok C4: Observasi / Wawancara + Referal
  const [obsWawRefData, setObsWawRefData] = useState<ServiceObservasiWawancaraReferalDetails>({
    subJenis: 'Observasi',
    yangDiamati: '',
    tempat: 'Ruang Kelas',
    durasi: '20 menit',
    hasilPengamatan: '',
    diwawancarai: 'Siswa',
    pertanyaanKunci: '',
    ringkasanJawaban: '',
    alasanDirujuk: '',
    dirujukKe: 'Psikolog',
    statusRujukan: 'Menunggu',
  });

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

  // Sync mode & standardized Blok B defaults when selected service changes
  const handleSelectService = (srv: ServiceDefinition) => {
    setSelectedService(srv);
    setMode(srv.defaultMode);
    setStdAiCustomRec('');
    if (srv.type === 'Layanan Konseling Perorangan (Individual)') {
      setStdTempat('Ruang BK');
      setStdBlokB((prev) => ({
        ...prev,
        jenisMasalah: 'Motivasi Belajar Rendah',
        tujuanLayanan: 'Mengubah Perilaku',
        teknik: 'Konseling Individual',
      }));
    } else if (srv.type === 'Kunjungan Rumah (Home Visit)') {
      setStdTempat('Rumah Siswa');
      setStdBlokB((prev) => ({
        ...prev,
        jenisMasalah: 'Bolos',
        tujuanLayanan: 'Memberi Dukungan',
        teknik: 'Home Visit',
      }));
    } else if (srv.type === 'Layanan Konseling Kelompok') {
      setStdTempat('Ruang BK');
      setStdBlokB((prev) => ({
        ...prev,
        jenisMasalah: 'Motivasi Belajar Rendah',
        tujuanLayanan: 'Mengubah Perilaku',
        teknik: 'Konseling Kelompok',
      }));
    } else if (srv.type === 'Layanan Mediasi') {
      setStdTempat('Ruang BK');
      setStdBlokB((prev) => ({
        ...prev,
        jenisMasalah: 'Konflik Teman',
        tujuanLayanan: 'Menyelesaikan Konflik',
        teknik: 'Mediasi',
      }));
    } else if (srv.type === 'Bimbingan Klasikal') {
      setStdBlokB((prev) => ({
        ...prev,
        jenisMasalah: 'Motivasi Belajar Rendah',
        tujuanLayanan: 'Memahami Masalah',
        teknik: 'Bimbingan Klasikal',
      }));
    } else if (srv.type === 'Alih Tangan Kasus (Referral)') {
      setObsWawRefData((prev) => ({ ...prev, subJenis: 'Referal' }));
      setStdBlokB((prev) => ({
        ...prev,
        jenisMasalah: 'Kecemasan',
        tujuanLayanan: 'Memberi Dukungan',
        teknik: 'Referal',
      }));
    } else if (srv.type === 'Observasi & Wawancara') {
      setObsWawRefData((prev) => ({ ...prev, subJenis: 'Observasi' }));
      setStdBlokB((prev) => ({
        ...prev,
        jenisMasalah: 'Disiplin',
        tujuanLayanan: 'Memahami Masalah',
        teknik: 'Observasi',
      }));
    }
  };

  // Seed Konseling Kelompok participants & Mediasi parties whenever selectedStudents changes
  useEffect(() => {
    if (selectedService.type === 'Layanan Konseling Kelompok' && selectedStudents.length > 0) {
      setKelompokParticipants((prev) => {
        const existingMap = new Map(prev.map((p) => [p.studentId || p.nama, p]));
        return selectedStudents.map((st, idx) => {
          const hit = existingMap.get(st.id) || existingMap.get(st.name);
          return (
            hit || {
              id: `kp-${st.id}-${idx}`,
              studentId: st.id,
              nama: st.name,
              kelas: st.class,
              peran: 'Aktif',
              keterbukaan: 3,
              kesepakatanSiswa: '',
            }
          );
        });
      });
    }
    if (selectedService.type === 'Layanan Mediasi' && selectedStudents.length > 0) {
      setMediasiData((prev) => ({
        ...prev,
        pihak1Nama: prev.pihak1Nama || selectedStudents[0]?.name || '',
        pihak2Nama: prev.pihak2Nama || selectedStudents[1]?.name || '',
      }));
    }
  }, [selectedStudents, selectedService.type]);

  // Sync Klasikal total count when class changes
  useEffect(() => {
    if (selectedService.type === 'Bimbingan Klasikal' && selectedStudents.length > 0) {
      setKlasikalTotalSiswa(selectedStudents.length);
      setKlasikalHadir(selectedStudents.length);
    }
  }, [selectedStudents.length, selectedService.type]);

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
  const isFormCatatKasus = serviceLabelLower.includes('catat kasus') || (serviceTypeLower.includes('kasus') && !serviceLabelLower.includes('konferensi') && !serviceTypeLower.includes('alih tangan'));
  const isFormKonselingIndividual = selectedService.type === 'Layanan Konseling Perorangan (Individual)';
  const isBimbinganKlasikalOnly = selectedService.type === 'Bimbingan Klasikal';
  const isFormBimbinganKlasikal = isBimbinganKlasikalOnly || selectedService.type === 'Layanan Informasi' || selectedService.type === 'Layanan Orientasi' || selectedService.type === 'Papan Bimbingan & Media BK';
  const isFormBimbinganKelompok = selectedService.type === 'Bimbingan Kelompok' || selectedService.type === 'Layanan Penguasaan Konten';
  const isFormKonselingKelompok = selectedService.type === 'Layanan Konseling Kelompok';
  const isFormMediasi = selectedService.type === 'Layanan Mediasi';
  const isHomeVisitOnly = selectedService.type === 'Kunjungan Rumah (Home Visit)' || serviceLabelLower.includes('home visit') || serviceTypeLower.includes('kunjungan rumah');
  const isFormHomeVisit = isHomeVisitOnly;
  const isFormKonsultasi = selectedService.type === 'Layanan Konsultasi' || selectedService.type === 'Kolaborasi Guru & Wali Kelas' || selectedService.type === 'Kemitraan (Puskesmas/Psikolog/Mitra)';
  const isFormKonferensiKasus = selectedService.type === 'Konferensi Kasus (Case Conference)';
  const isFormObservasiWawancaraReferal = selectedService.type === 'Observasi & Wawancara' || selectedService.type === 'Alih Tangan Kasus (Referral)';
  const isFormAlihTangan = isFormObservasiWawancaraReferal;

  const activeRevisedFormKind: StandardizedServiceFormKind | null =
    isFormKonselingIndividual
      ? 'individual'
      : isHomeVisitOnly
        ? 'home-visit'
        : isFormKonselingKelompok
          ? 'kelompok'
          : isFormMediasi
            ? 'mediasi'
            : isBimbinganKlasikalOnly
              ? 'klasikal'
              : isFormObservasiWawancaraReferal
                ? 'observasi-wawancara-referal'
                : null;

  const indivBlokCPayload: ServiceIndividualDetails = useMemo(
    () => ({
      uraianMasalah:
        counselingUseAiStory && counselingAiPolishedStory
          ? counselingAiPolishedStory
          : counselingRawStory,
      prosesPendekatan: indivProsesPendekatan,
      responSiswa: indivResponSiswa || counselingDinamika,
      hasilKategori: counselingHasilKategori,
      jaminanKerahasiaan: counselingAgreedConfidentiality,
    }),
    [
      counselingUseAiStory,
      counselingAiPolishedStory,
      counselingRawStory,
      indivProsesPendekatan,
      indivResponSiswa,
      counselingDinamika,
      counselingHasilKategori,
      counselingAgreedConfidentiality,
    ]
  );

  const hvBlokCPayload: ServiceHomeVisitDetails = useMemo(
    () => ({
      yangDitemui: homeVisitYangDitemui,
      yangDitemuiLainnya:
        homeVisitYangDitemui === 'Lainnya' && homeVisitYangDitemuiLainnya.trim()
          ? homeVisitYangDitemuiLainnya.trim()
          : undefined,
      alamat: homeVisitAlamat,
      namaOrtu: homeVisitNamaOrtu,
      noHpOrtu: homeVisitNoHpOrtu,
      kondisiRumahSingkat: homeVisitKondisiRumah,
      hasilPembicaraan:
        homeVisitUseAi && homeVisitAiHasil ? homeVisitAiHasil : homeVisitRawHasil,
      kesepakatanOrtu: homeVisitKesepakatanOrtu,
      statusKunjungan: homeVisitStatus,
      fotoBuktiUrl: homeVisitFotoBukti || undefined,
    }),
    [
      homeVisitYangDitemui,
      homeVisitYangDitemuiLainnya,
      homeVisitAlamat,
      homeVisitNamaOrtu,
      homeVisitNoHpOrtu,
      homeVisitKondisiRumah,
      homeVisitUseAi,
      homeVisitAiHasil,
      homeVisitRawHasil,
      homeVisitKesepakatanOrtu,
      homeVisitStatus,
      homeVisitFotoBukti,
    ]
  );

  const currentContextualAiText = useMemo(() => {
    if (!activeRevisedFormKind) return '';
    if (stdAiCustomRec) return stdAiCustomRec;
    return buildLocalContextAwareRecommendation({
      formKind: activeRevisedFormKind,
      mode: 'recommendation',
      blokB: stdBlokB,
      blokC: {
        individual: indivBlokCPayload,
        homeVisit: hvBlokCPayload,
        kelompokParticipants,
        mediasi: mediasiData,
        klasikal: {
          kelas: selectedClass || '8A',
          jumlahHadir: klasikalHadir,
          totalSiswa: klasikalTotalSiswa,
          topikKlasikal: klasikalTopik,
          dinamikaKelas: klasikalDinamikaKelas,
          responSiswa: klasikalResponSiswa,
        },
        observasiWawancaraReferal: obsWawRefData,
      },
      blokD: {
        apa: stdBlokD.tindakLanjutApa,
        tanggal: stdBlokD.tindakLanjutTanggal,
        penanggungJawab: stdBlokD.penanggungJawab,
      },
      layananKeBerapa: stdPertemuanKe,
      sasaranLabel: studentDisplayText,
    });
  }, [
    activeRevisedFormKind,
    stdAiCustomRec,
    stdBlokB,
    indivBlokCPayload,
    hvBlokCPayload,
    kelompokParticipants,
    mediasiData,
    selectedClass,
    klasikalHadir,
    klasikalTotalSiswa,
    klasikalTopik,
    klasikalDinamikaKelas,
    klasikalResponSiswa,
    obsWawRefData,
    stdBlokD,
    stdPertemuanKe,
    studentDisplayText,
  ]);

  const handleRefreshContextualAi = async () => {
    if (!activeRevisedFormKind) return;
    setIsGeneratingStdAi(true);
    try {
      const res = await requestContextualServiceFormAi({
        formKind: activeRevisedFormKind,
        mode: 'recommendation',
        blokB: stdBlokB,
        blokC: {
          individual: indivBlokCPayload,
          homeVisit: hvBlokCPayload,
          kelompokParticipants,
          mediasi: mediasiData,
          klasikal: {
            kelas: selectedClass || '8A',
            jumlahHadir: klasikalHadir,
            totalSiswa: klasikalTotalSiswa,
            topikKlasikal: klasikalTopik,
            dinamikaKelas: klasikalDinamikaKelas,
            responSiswa: klasikalResponSiswa,
          },
          observasiWawancaraReferal: obsWawRefData,
        },
        blokD: {
          apa: stdBlokD.tindakLanjutApa,
          tanggal: stdBlokD.tindakLanjutTanggal,
          penanggungJawab: stdBlokD.penanggungJawab,
        },
        layananKeBerapa: stdPertemuanKe,
        sasaranLabel: studentDisplayText,
      });
      setStdAiCustomRec(res.text);
      showToast('✨ Rekomendasi AI kontekstual diperbarui!', 'success');
    } finally {
      setIsGeneratingStdAi(false);
    }
  };

  const handlePolishBlokCText = async (
    formKind: StandardizedServiceFormKind,
    draft: string,
    onApply: (text: string) => void
  ) => {
    setIsPolishingBlokC(true);
    try {
      const res = await requestContextualServiceFormAi({
        formKind,
        mode: 'polish',
        draftText: draft,
        blokB: stdBlokB,
        blokC: {
          individual: indivBlokCPayload,
          homeVisit: hvBlokCPayload,
          kelompokParticipants,
          mediasi: mediasiData,
          klasikal: {
            kelas: selectedClass || '8A',
            jumlahHadir: klasikalHadir,
            totalSiswa: klasikalTotalSiswa,
            topikKlasikal: klasikalTopik,
            dinamikaKelas: klasikalDinamikaKelas,
            responSiswa: klasikalResponSiswa,
          },
          observasiWawancaraReferal: obsWawRefData,
        },
        blokD: {
          apa: stdBlokD.tindakLanjutApa,
          tanggal: stdBlokD.tindakLanjutTanggal,
          penanggungJawab: stdBlokD.penanggungJawab,
        },
        layananKeBerapa: stdPertemuanKe,
        sasaranLabel: studentDisplayText,
      });
      onApply(res.text);
      showToast('✨ Teks berhasil dirapikan sesuai konteks layanan!', 'success');
    } finally {
      setIsPolishingBlokC(false);
    }
  };

  // Meta AI Live Recommendation for non-revised legacy forms
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

  // Helper build complete official BK Counseling Record for Konseling Individual (Blok A-D Terstandar)
  const buildKonselingIndividualRecord = (): CounselingService => {
    const finalStory = counselingUseAiStory && counselingAiPolishedStory
      ? counselingAiPolishedStory
      : (counselingRawStory || `Siswa berkonsultasi mengenai ${stdBlokB.jenisMasalah}.`);

    const indDetails: ServiceIndividualDetails = {
      uraianMasalah: finalStory,
      prosesPendekatan: indivProsesPendekatan,
      responSiswa: indivResponSiswa || counselingDinamika || 'Siswa kooperatif mengikuti sesi.',
      hasilKategori: counselingHasilKategori,
      jaminanKerahasiaan: counselingAgreedConfidentiality,
    };

    const descParts = [
      `[IDENTITAS] Layanan Ke-${stdPertemuanKe} (${stdSifatLayanan}) di ${stdTempat || counselingTempat} • ${formatTanggalIndonesia(date)}. Konselor: ${activeCounselorInfo.name}.`,
      `[BLOK B - KONTEKS] Masalah: ${stdBlokB.jenisMasalah}${stdBlokB.alasanMasalahLainnya ? ` (${stdBlokB.alasanMasalahLainnya})` : ''} | Tujuan: ${stdBlokB.tujuanLayanan} | Teknik: ${stdBlokB.teknik}.`,
      `[BLOK C - PROSES & HASIL] Uraian: ${finalStory} | Pendekatan: ${indDetails.prosesPendekatan} | Respon: ${indDetails.responSiswa}`,
    ].filter(Boolean).join('\n\n');

    const outputParts = [
      `[HASIL KONSELING] Kategori: ${counselingHasilKategori}.`,
      stdBlokD.kesepakatan ? `Kesepakatan: ${stdBlokD.kesepakatan}` : '',
    ].filter(Boolean).join(' ');

    const followUpParts = [
      stdBlokD.tindakLanjutApa || 'Review komitmen konseling individual',
      stdBlokD.tindakLanjutTanggal ? `(${formatTanggalIndonesia(stdBlokD.tindakLanjutTanggal)} - PJ: ${stdBlokD.penanggungJawab})` : '',
    ].filter(Boolean).join(' ');

    const startH = time.split(':')[0] || '08';
    const startM = time.split(':')[1] || '00';
    const endH = String((parseInt(startH, 10) + 1) % 24).padStart(2, '0');
    const endTimeStr = `${endH}:${startM}`;

    return {
      id: `srv-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      serviceType: selectedService.type,
      bkComponent: mapJenisMasalahToBidang(stdBlokB.jenisMasalah) as BKComponentType,
      bidangBimbingan: selectedService.bidangDefault,
      students: selectedStudents.map((s) => ({
        id: s.id,
        name: s.name,
        class: s.class,
        nis: s.nis || '-',
      })),
      problem: `Konseling Individual: ${stdBlokB.jenisMasalah}${stdBlokB.alasanMasalahLainnya ? ` (${stdBlokB.alasanMasalahLainnya})` : ''}`,
      description: descParts,
      output: outputParts || `Siswa telah menyelesaikan konseling individual dengan capaian ${counselingHasilKategori}.`,
      followUp: followUpParts || 'Pantau 14 hari',
      status: (counselingStatusAkhir === 'Dirujuk' ? 'Selesai' : counselingStatusAkhir) as any,
      date,
      startTime: time,
      endTime: endTimeStr,
      attachments: [],
      targetType: mode,
      counselorName: activeCounselorInfo.name,
      specificDetails: {
        akarMasalah: `${stdBlokB.jenisMasalah}${stdBlokB.alasanMasalahLainnya ? ` (${stdBlokB.alasanMasalahLainnya})` : ''}`,
        pendekatanKonseling: indDetails.prosesPendekatan,
        komitmenKonseli: stdBlokD.kesepakatan || counselingKomitmenSiswa,
        evaluasiProses: indDetails.responSiswa,
        evaluasiHasil: outputParts,
        rencanaAksiSiswa: stdBlokD.kesepakatan,
        blokA: {
          tanggal: date,
          jam: time,
          tempat: stdTempat || counselingTempat,
          pertemuanKe: stdPertemuanKe,
          sifatLayanan: stdSifatLayanan,
        },
        blokB: stdBlokB,
        blokC: {
          individual: indDetails,
        },
        individual: indDetails,
        tindakLanjutPlan: stdBlokD,
        aiContextualRecommendation: currentContextualAiText,
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

  // Helper build complete official BK Klasikal & RPL Record (Blok A-D Terstandar)
  const buildKlasikalRecord = (): CounselingService => {
    const startH = time.split(':')[0] || '08';
    const startM = time.split(':')[1] || '00';
    const endH = String((parseInt(startH, 10) + 1) % 24).padStart(2, '0');
    const endTimeStr = `${endH}:${startM}`;
    const totalSiswaVal = Math.max(klasikalTotalSiswa, klasikalHadir);

    const klasikalDetails: ServiceKlasikalDetails = {
      kelas: selectedClass || '8A',
      jumlahHadir: klasikalHadir,
      totalSiswa: totalSiswaVal,
      topikKlasikal: klasikalTopik,
      dinamikaKelas: klasikalDinamikaKelas,
      responSiswa: klasikalResponSiswa,
    };

    const descParts = [
      `[LAYANAN KLASIKAL - DINAMIKA KELAS] Kelas: ${klasikalDetails.kelas} | Hadir: ${klasikalHadir}/${totalSiswaVal} siswa | Tempat: ${stdTempat || klasikalTempat} (${formatTanggalIndonesia(date)}).`,
      `[BLOK B - KONTEKS] Masalah: ${stdBlokB.jenisMasalah}${stdBlokB.alasanMasalahLainnya ? ` (${stdBlokB.alasanMasalahLainnya})` : ''} | Tujuan: ${stdBlokB.tujuanLayanan} | Teknik: ${stdBlokB.teknik}.`,
      `[BLOK C - DINAMIKA KELAS] Topik Klasikal: ${klasikalTopik} | Dinamika Kelas: ${klasikalDinamikaKelas} | Contoh Respon Siswa: ${klasikalResponSiswa || '-'}`,
      klasikalTujuan ? `[TUJUAN RPL]\n${klasikalTujuan}` : '',
      klasikalMateriUraian ? `[MATERI]\n${klasikalMateriUraian}` : '',
    ].filter(Boolean).join('\n\n');

    const outputParts = [
      stdBlokD.kesepakatan ? `Kesepakatan Kelas: ${stdBlokD.kesepakatan}.` : '',
      `Dinamika kelas teramati ${klasikalDinamikaKelas} (${klasikalHadir}/${totalSiswaVal} hadir).`,
      klasikalResponSiswa ? `Respon siswa: ${klasikalResponSiswa}.` : '',
    ].filter(Boolean).join(' ');

    const followUpParts = [
      stdBlokD.tindakLanjutApa ? `Tindak Lanjut: ${stdBlokD.tindakLanjutApa}` : klasikalRencanaBerikutnya,
      stdBlokD.tindakLanjutTanggal ? `Jadwal: ${formatTanggalIndonesia(stdBlokD.tindakLanjutTanggal)}` : '',
      stdBlokD.penanggungJawab ? `PJ: ${stdBlokD.penanggungJawab}` : '',
    ].filter(Boolean).join(' | ');

    return {
      id: `srv-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      serviceType: 'Bimbingan Klasikal',
      bkComponent: mapJenisMasalahToBidang(stdBlokB.jenisMasalah) as BKComponentType,
      bidangBimbingan: klasikalBidang,
      students: selectedStudents.map((s) => ({
        id: s.id,
        name: s.name,
        class: s.class,
        nis: s.nis || '-',
      })),
      problem: `Bimbingan Klasikal (${klasikalDetails.kelas}): ${klasikalTopik}`,
      description: descParts,
      output: outputParts,
      followUp: followUpParts || 'Evaluasi dinamika kelas',
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
        evaluasiProses: `Dinamika ${klasikalDinamikaKelas}: ${klasikalResponSiswa || klasikalLaiseg}`,
        evaluasiHasil: outputParts,
        rencanaAksiSiswa: stdBlokD.kesepakatan || klasikalTujuan,
        blokA: {
          tanggal: date,
          jam: time,
          tempat: stdTempat || klasikalTempat,
          pertemuanKe: stdPertemuanKe,
          sifatLayanan: stdSifatLayanan,
        },
        blokB: stdBlokB,
        blokC: {
          klasikal: klasikalDetails,
        },
        klasikal: klasikalDetails,
        tindakLanjutPlan: stdBlokD,
        aiContextualRecommendation: currentContextualAiText,
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

  // Builder for Home Visit Record (Blok A-D Terstandar)
  const buildHomeVisitRecord = () => {
    const st = selectedStudents[0] || {
      id: 'unknown',
      name: 'Siswa',
      class: '8A',
      nis: '-'
    };
    const effectivePerson = homeVisitYangDitemui === 'Lainnya' && homeVisitYangDitemuiLainnya.trim()
      ? homeVisitYangDitemuiLainnya.trim()
      : homeVisitYangDitemui;
    const effectiveResult = homeVisitUseAi && homeVisitAiHasil
      ? homeVisitAiHasil
      : (homeVisitRawHasil || `Kunjungan rumah terlaksana dengan status ${homeVisitStatus}. Ditemui ${effectivePerson}.`);
    const effectiveKesepakatanOrtu = homeVisitKesepakatanOrtu || stdBlokD.kesepakatan || '-';
    const hvDetails: ServiceHomeVisitDetails = {
      yangDitemui: homeVisitYangDitemui,
      yangDitemuiLainnya:
        homeVisitYangDitemui === 'Lainnya' && homeVisitYangDitemuiLainnya.trim()
          ? homeVisitYangDitemuiLainnya.trim()
          : undefined,
      alamat: homeVisitAlamat || `Kediaman siswa ${st.name}`,
      namaOrtu: homeVisitNamaOrtu,
      noHpOrtu: homeVisitNoHpOrtu,
      kondisiRumahSingkat: homeVisitKondisiRumah,
      hasilPembicaraan: effectiveResult,
      kesepakatanOrtu: effectiveKesepakatanOrtu,
      statusKunjungan: homeVisitStatus,
      fotoBuktiUrl: homeVisitFotoBukti || undefined,
    };

    const repNum = `HV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const hvRecord: HomeVisitRecord = {
      id: `hv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      reportNumber: repNum,
      date: date,
      studentId: st.id,
      studentName: st.name,
      studentClass: st.class,
      studentNis: String(st.nis || '-'),
      parentNameMet: homeVisitNamaOrtu || effectivePerson,
      address: hvDetails.alamat,
      bidangBimbingan: 'Sosial',
      purpose: `${stdBlokB.jenisMasalah} — ${stdBlokB.tujuanLayanan}`,
      result: effectiveResult,
      agreement: effectiveKesepakatanOrtu,
      photoUrl: homeVisitFotoBukti || undefined,
      photoName: homeVisitFotoName || undefined,
      counselorName: activeCounselorInfo.name,
      counselorId: 'counselor-active',
      createdAt: new Date().toISOString()
    };

    const followUpLine = `${stdBlokD.tindakLanjutApa || 'Koordinasi perkembangan dengan orang tua & wali kelas'} (${formatTanggalIndonesia(stdBlokD.tindakLanjutTanggal)} - PJ: ${stdBlokD.penanggungJawab})`;

    const serviceRecord: CounselingService = {
      id: `srv-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      serviceType: 'Kunjungan Rumah (Home Visit)',
      bkComponent: mapJenisMasalahToBidang(stdBlokB.jenisMasalah) as BKComponentType,
      bidangBimbingan: 'Sosial',
      students: [{
        id: st.id,
        name: st.name,
        class: st.class,
        nis: st.nis || '-'
      }],
      problem: `Home Visit: ${st.name} (${st.class}) - ${stdBlokB.jenisMasalah}`,
      description: `[IDENTITAS] Layanan Ke-${stdPertemuanKe} (${stdSifatLayanan}) di ${hvDetails.alamat} (${formatTanggalIndonesia(date)}).\n[BLOK B] Masalah: ${stdBlokB.jenisMasalah}${stdBlokB.alasanMasalahLainnya ? ` (${stdBlokB.alasanMasalahLainnya})` : ''} | Tujuan: ${stdBlokB.tujuanLayanan}.\n[BLOK C - HOME VISIT] Ditemui: ${effectivePerson} (${homeVisitNamaOrtu || '-'}, HP: ${homeVisitNoHpOrtu || '-'})\nKondisi Rumah: ${homeVisitKondisiRumah || '-'}\nHasil Pembicaraan: ${effectiveResult}`,
      output: `Status Kunjungan: ${homeVisitStatus}. Kesepakatan Orang Tua: ${effectiveKesepakatanOrtu}`,
      followUp: followUpLine,
      status: 'Selesai',
      date: date,
      startTime: time,
      endTime: time,
      attachments: homeVisitFotoName ? [{ name: homeVisitFotoName, size: 'Foto Bukti' }] : [],
      targetType: 'Individu',
      counselorName: activeCounselorInfo.name,
      specificDetails: {
        bidangBimbingan: 'Sosial',
        aspekSkkpd: stdBlokB.jenisMasalah,
        evaluasiProses: homeVisitKondisiRumah,
        evaluasiHasil: effectiveResult,
        rencanaAksiSiswa: effectiveKesepakatanOrtu,
        blokA: {
          tanggal: date,
          jam: time,
          tempat: stdTempat || hvDetails.alamat,
          pertemuanKe: stdPertemuanKe,
          sifatLayanan: stdSifatLayanan,
        },
        blokB: {
          ...stdBlokB,
          teknik: 'Home Visit',
        },
        blokC: {
          homeVisit: hvDetails,
        },
        homeVisit: hvDetails,
        tindakLanjutPlan: stdBlokD,
        aiContextualRecommendation: currentContextualAiText,
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

  // Builder 1: Konseling Kelompok (Blok A-D Terstandar)
  const buildKonselingKelompokRecord = (): CounselingService => {
    const startH = time.split(':')[0] || '08';
    const startM = time.split(':')[1] || '00';
    const endH = String((parseInt(startH, 10) + 1) % 24).padStart(2, '0');
    const prosesSummary = konsKelUseAi && konsKelAiSummary ? konsKelAiSummary : konsKelRawSummary;
    const participantSummary = kelompokParticipants
      .map((p) => `- ${p.nama} (${p.kelas || '-'}) | Peran: ${p.peran} | Keterbukaan: ${p.keterbukaan}/5 | Kesepakatan: ${p.kesepakatanSiswa || '-'}`)
      .join('\n');

    return {
      id: `srv-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      serviceType: 'Layanan Konseling Kelompok',
      bkComponent: mapJenisMasalahToBidang(stdBlokB.jenisMasalah) as BKComponentType,
      bidangBimbingan: 'Sosial',
      students: selectedStudents.map((s) => ({
        id: s.id,
        name: s.name,
        class: s.class,
        nis: s.nis || '-',
      })),
      problem: `Konseling Kelompok: ${stdBlokB.jenisMasalah}${stdBlokB.alasanMasalahLainnya ? ` (${stdBlokB.alasanMasalahLainnya})` : ''}`,
      description: `[BLOK B - KONTEKS] Masalah: ${stdBlokB.jenisMasalah} | Tujuan: ${stdBlokB.tujuanLayanan} | Teknik: ${stdBlokB.teknik}\n\n[BLOK C - PESERTA KELOMPOK]\n${participantSummary || '-'}\n\n[PROSES KELOMPOK]\n${prosesSummary || '-'}`,
      output: kelompokKomitmenBersama || stdBlokD.kesepakatan || 'Peserta kelompok menyepakati komitmen perubahan bersama.',
      followUp: `${stdBlokD.tindakLanjutApa || 'Review komitmen kelompok'} (${formatTanggalIndonesia(stdBlokD.tindakLanjutTanggal)} - PJ: ${stdBlokD.penanggungJawab})`,
      status,
      date,
      startTime: time,
      endTime: `${endH}:${startM}`,
      attachments: [],
      targetType: 'Kelompok',
      counselorName: activeCounselorInfo.name,
      specificDetails: {
        bidangBimbingan: 'Sosial',
        aspekSkkpd: stdBlokB.jenisMasalah,
        evaluasiProses: prosesSummary,
        evaluasiHasil: kelompokKomitmenBersama || stdBlokD.kesepakatan,
        rencanaAksiSiswa: stdBlokD.kesepakatan,
        blokA: {
          tanggal: date,
          jam: time,
          tempat: stdTempat,
          pertemuanKe: stdPertemuanKe,
          sifatLayanan: stdSifatLayanan,
        },
        blokB: stdBlokB,
        blokC: {
          kelompokParticipants,
          kelompokRingkasanProses: prosesSummary,
          kelompokKomitmenBersama,
        },
        kelompokParticipants,
        tindakLanjutPlan: stdBlokD,
        aiContextualRecommendation: currentContextualAiText,
      },
      linkedViolationId: presetServiceData?.linkedViolationId,
      linkedTicketId: presetServiceData?.linkedTicketId,
    };
  };

  // Builder 2: Mediasi (Blok A-D Terstandar)
  const buildMediasiRecord = (): CounselingService => {
    const startH = time.split(':')[0] || '08';
    const startM = time.split(':')[1] || '00';
    const endH = String((parseInt(startH, 10) + 1) % 24).padStart(2, '0');
    const kesepakatanText =
      mediasiData.statusMediasi === 'Sepakat'
        ? mediasiData.kesepakatanBersama
        : `Tidak Sepakat (${mediasiData.alasanTidakSepakat}). Rencana Berikutnya: ${mediasiData.rencanaBerikutnya}`;

    return {
      id: `srv-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      serviceType: 'Layanan Mediasi',
      bkComponent: 'Layanan Responsif',
      bidangBimbingan: 'Sosial',
      students: selectedStudents.map((s) => ({
        id: s.id,
        name: s.name,
        class: s.class,
        nis: s.nis || '-',
      })),
      problem: `Mediasi: ${mediasiData.pihak1Nama || 'Pihak 1'} vs ${mediasiData.pihak2Nama || 'Pihak 2'} (${stdBlokB.jenisMasalah})`,
      description: `[BLOK B] Masalah: ${stdBlokB.jenisMasalah} | Tujuan: ${stdBlokB.tujuanLayanan}\n\n[BLOK C - MEDIASI]\nPihak 1 (${mediasiData.pihak1Nama}): ${mediasiData.versiPihak1 || '-'}\nPihak 2 (${mediasiData.pihak2Nama}): ${mediasiData.versiPihak2 || '-'}\nTitik Konflik Utama: ${mediasiData.titikKonflikUtama}\nStatus: ${mediasiData.statusMediasi}`,
      output: kesepakatanText,
      followUp: `${stdBlokD.tindakLanjutApa || (mediasiData.statusMediasi === 'Tidak Sepakat' ? mediasiData.rencanaBerikutnya : 'Cek kepatuhan kesepakatan dua pihak')} (${formatTanggalIndonesia(stdBlokD.tindakLanjutTanggal)} - PJ: ${stdBlokD.penanggungJawab})`,
      status,
      date,
      startTime: time,
      endTime: `${endH}:${startM}`,
      attachments: [],
      targetType: 'Kelompok',
      counselorName: activeCounselorInfo.name,
      specificDetails: {
        bidangBimbingan: 'Sosial',
        aspekSkkpd: mediasiData.titikKonflikUtama,
        evaluasiProses: `Versi P1: ${mediasiData.versiPihak1} | Versi P2: ${mediasiData.versiPihak2}`,
        evaluasiHasil: kesepakatanText,
        rencanaAksiSiswa: stdBlokD.kesepakatan || mediasiData.kesepakatanBersama || mediasiData.rencanaBerikutnya,
        blokA: {
          tanggal: date,
          jam: time,
          tempat: stdTempat,
          pertemuanKe: stdPertemuanKe,
          sifatLayanan: stdSifatLayanan,
        },
        blokB: stdBlokB,
        blokC: {
          mediasi: mediasiData,
        },
        mediasi: mediasiData,
        tindakLanjutPlan: stdBlokD,
        aiContextualRecommendation: currentContextualAiText,
      },
      linkedViolationId: presetServiceData?.linkedViolationId,
      linkedTicketId: presetServiceData?.linkedTicketId,
    };
  };

  // Builder 3: Observasi / Wawancara + Referal (Blok A-D Terstandar)
  const buildObservasiWawancaraReferalRecord = (): CounselingService => {
    const startH = time.split(':')[0] || '08';
    const startM = time.split(':')[1] || '00';
    const endH = String((parseInt(startH, 10) + 1) % 24).padStart(2, '0');
    const isRef = obsWawRefData.subJenis === 'Referal';
    const isWaw = obsWawRefData.subJenis === 'Wawancara';
    const finalServiceType: BKServiceType = isRef ? 'Alih Tangan Kasus (Referral)' : 'Observasi & Wawancara';
    const detailText = isRef
      ? `Dirujuk Ke: ${obsWawRefData.dirujukKe} | Status: ${obsWawRefData.statusRujukan} | Alasan: ${obsWawRefData.alasanDirujuk}`
      : isWaw
        ? `Narasumber: ${obsWawRefData.diwawancarai} | Pertanyaan Kunci: ${obsWawRefData.pertanyaanKunci || '-'} | Ringkasan Jawaban: ${obsWawRefData.ringkasanJawaban}`
        : `Yang Diamati: ${obsWawRefData.yangDiamati || '-'} | Tempat: ${obsWawRefData.tempat || '-'} | Durasi: ${obsWawRefData.durasi || '-'} | Hasil Pengamatan: ${obsWawRefData.hasilPengamatan}`;

    return {
      id: `srv-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      serviceType: finalServiceType,
      bkComponent: 'Layanan Responsif',
      bidangBimbingan: 'Pribadi',
      students: selectedStudents.map((s) => ({
        id: s.id,
        name: s.name,
        class: s.class,
        nis: s.nis || '-',
      })),
      problem: isRef
        ? `Referal ke ${obsWawRefData.dirujukKe}: ${stdBlokB.jenisMasalah}`
        : `${obsWawRefData.subJenis}: ${stdBlokB.jenisMasalah} (${selectedStudents[0]?.name || 'Siswa'})`,
      description: `[BLOK B] Masalah: ${stdBlokB.jenisMasalah}${stdBlokB.alasanMasalahLainnya ? ` (${stdBlokB.alasanMasalahLainnya})` : ''} | Tujuan: ${stdBlokB.tujuanLayanan} | Teknik: ${obsWawRefData.subJenis}\n\n[BLOK C - ${obsWawRefData.subJenis.toUpperCase()}]\n${detailText}`,
      output: stdBlokD.kesepakatan || (isRef ? `Rujukan profesional ke ${obsWawRefData.dirujukKe} (${obsWawRefData.statusRujukan}).` : detailText),
      followUp: `${stdBlokD.tindakLanjutApa || (isRef ? 'Koordinasi hasil rujukan' : 'Tinjau kebutuhan konseling lanjutan')} (${formatTanggalIndonesia(stdBlokD.tindakLanjutTanggal)} - PJ: ${stdBlokD.penanggungJawab})`,
      status,
      date,
      startTime: time,
      endTime: `${endH}:${startM}`,
      attachments: [],
      targetType: mode,
      counselorName: activeCounselorInfo.name,
      specificDetails: {
        bidangBimbingan: 'Pribadi',
        aspekSkkpd: stdBlokB.jenisMasalah,
        evaluasiProses: detailText,
        evaluasiHasil: stdBlokD.kesepakatan || detailText,
        rencanaAksiSiswa: stdBlokD.tindakLanjutApa,
        blokA: {
          tanggal: date,
          jam: time,
          tempat: stdTempat,
          pertemuanKe: stdPertemuanKe,
          sifatLayanan: stdSifatLayanan,
        },
        blokB: {
          ...stdBlokB,
          teknik: obsWawRefData.subJenis,
        },
        blokC: {
          observasiWawancaraReferal: obsWawRefData,
        },
        observasiWawancaraReferal: obsWawRefData,
        tindakLanjutPlan: stdBlokD,
        aiContextualRecommendation: currentContextualAiText,
      },
      linkedViolationId: presetServiceData?.linkedViolationId,
      linkedTicketId: presetServiceData?.linkedTicketId,
    };
  };

  // Handler for Final Save
  const handleFinalSubmit = () => {
    if (selectedStudents.length === 0 && !isFormMediasi) {
      showToast('⚠️ Silakan pilih minimal 1 siswa / kelas di Langkah 2.', 'warning');
      setCurrentStep(2);
      return;
    }

    if (activeRevisedFormKind && stdBlokB.jenisMasalah === 'Lainnya' && !stdBlokB.alasanMasalahLainnya.trim()) {
      showToast('⚠️ Wajib isi 1 kalimat alasan saat memilih Jenis Masalah "Lainnya".', 'warning');
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

    if (isFormKonselingKelompok) {
      if (kelompokParticipants.length === 0) {
        showToast('⚠️ Tambahkan minimal 1 peserta di Daftar Peserta Kelompok.', 'warning');
        return;
      }
      const record = buildKonselingKelompokRecord();
      onSaveService(record);
      setSavedSuccessService(record);
      showToast(`✅ Laporan Konseling Kelompok berhasil disimpan!`, 'success');
      return;
    }

    if (isFormMediasi) {
      if (!mediasiData.pihak1Nama.trim() || !mediasiData.pihak2Nama.trim() || !mediasiData.titikKonflikUtama.trim()) {
        showToast('⚠️ Lengkapi Pihak 1, Pihak 2, dan Titik Konflik Utama.', 'warning');
        return;
      }
      if (mediasiData.statusMediasi === 'Sepakat' && !mediasiData.kesepakatanBersama?.trim()) {
        showToast('⚠️ Status Sepakat mewajibkan pengisian Kesepakatan Bersama.', 'warning');
        return;
      }
      if (
        mediasiData.statusMediasi === 'Tidak Sepakat' &&
        (!mediasiData.alasanTidakSepakat?.trim() || !mediasiData.rencanaBerikutnya?.trim())
      ) {
        showToast('⚠️ Status Tidak Sepakat mewajibkan Alasan & Rencana Berikutnya.', 'warning');
        return;
      }
      const record = buildMediasiRecord();
      onSaveService(record);
      setSavedSuccessService(record);
      showToast(`✅ Laporan Layanan Mediasi berhasil disimpan!`, 'success');
      return;
    }

    if (isFormObservasiWawancaraReferal) {
      if (obsWawRefData.subJenis === 'Referal' && !obsWawRefData.alasanDirujuk?.trim()) {
        showToast('⚠️ Alasan Dirujuk wajib diisi untuk layanan Referal.', 'warning');
        return;
      }
      if (obsWawRefData.subJenis === 'Observasi' && !obsWawRefData.hasilPengamatan?.trim()) {
        showToast('⚠️ Hasil Pengamatan wajib diisi untuk layanan Observasi.', 'warning');
        return;
      }
      if (obsWawRefData.subJenis === 'Wawancara' && !obsWawRefData.ringkasanJawaban?.trim()) {
        showToast('⚠️ Ringkasan Jawaban wajib diisi untuk layanan Wawancara.', 'warning');
        return;
      }
      const record = buildObservasiWawancaraReferalRecord();
      onSaveService(record);
      setSavedSuccessService(record);
      showToast(`✅ Laporan ${obsWawRefData.subJenis} berhasil disimpan!`, 'success');
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
              <span className="font-bold text-gray-700 text-right">{formatCardDateTime(savedSuccessService.date, savedSuccessService.startTime)}</span>
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

            {/* 2. Tombol Lihat PDF di Drive jika ada */}
            {savedSuccessService.pdfUrl && (
              <a
                href={savedSuccessService.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-2 border-emerald-300 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-sm transition-all cursor-pointer active:scale-98"
              >
                <ExternalLink className="w-4 h-4 text-emerald-700" />
                <span>Lihat PDF di Drive</span>
              </a>
            )}

            {/* 3. Tombol [Generate Layanan] / [Download Ulang PDF] */}
            <button
              type="button"
              onClick={async () => {
                const res = await generateServicePDF(savedSuccessService);
                if (res?.success && res.pdfUrl) {
                  setSavedSuccessService((prev) => (prev ? { ...prev, pdfUrl: res.pdfUrl } : null));
                }
              }}
              className="w-full py-3.5 px-5 bg-white hover:bg-gray-50 text-[#00685f] border-2 border-[#00685f]/40 hover:border-[#00685f] rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-sm transition-all cursor-pointer active:scale-98"
            >
              <FileText className="w-4 h-4 text-[#00685f]" />
              <span>{savedSuccessService.pdfUrl ? 'Download Ulang PDF Layanan' : 'Generate Layanan (Auto-Save ke Drive)'}</span>
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
            const groupHex = BIDANG_HEX_COLORS[groupName];

            return (
              <div key={groupName} className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: groupHex }}
                    />
                    <h2 className="text-xs sm:text-sm font-black text-[#0b1c30] uppercase tracking-wider">
                      {groupName} ({groupServices.length})
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 min-[1200px]:grid-cols-4 gap-2.5 sm:gap-3">
                  {groupServices.map((srv) => {
                    const isSelected = selectedService.type === srv.type;
                    const Icon = srv.icon;

                    return (
                      <button
                        key={srv.type}
                        type="button"
                        onClick={() => handleSelectService(srv)}
                        style={{
                          backgroundColor: isSelected ? groupHex : `${groupHex}10`,
                          borderColor: isSelected ? groupHex : `${groupHex}40`,
                          color: isSelected ? '#ffffff' : '#0b1c30',
                        }}
                        className={`p-3 sm:p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative active:scale-98 ${
                          isSelected ? 'shadow-md' : 'hover:shadow-2xs'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div
                              className="p-2 rounded-xl shrink-0"
                              style={{
                                backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : '#ffffff',
                                color: isSelected ? '#ffffff' : groupHex,
                              }}
                            >
                              <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>

                            {isSelected ? (
                              <div
                                className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-2xs shrink-0"
                                style={{ color: groupHex }}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            ) : (
                              <span
                                className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white/90 border shrink-0"
                                style={{ borderColor: `${groupHex}40`, color: groupHex }}
                              >
                                {srv.defaultMode}
                              </span>
                            )}
                          </div>

                          <h3
                            className={`text-xs sm:text-sm font-black mt-2.5 leading-snug line-clamp-2 ${
                              isSelected ? 'text-white' : 'text-[#0b1c30]'
                            }`}
                          >
                            {srv.label}
                          </h3>
                        </div>

                        <div
                          className="pt-2 border-t flex items-center justify-between text-[10px] sm:text-[11px] font-bold"
                          style={{
                            borderColor: isSelected ? 'rgba(255,255,255,0.25)' : `${groupHex}22`,
                          }}
                        >
                          <span style={{ color: isSelected ? 'rgba(255,255,255,0.88)' : '#3d4947' }}>
                            {srv.defaultMode}
                          </span>
                          <span
                            className="font-extrabold"
                            style={{ color: isSelected ? '#ffffff' : groupHex }}
                          >
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
                        Batal Pilih Semua
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
                if (selectedStudents.length === 0 && !isFormMediasi) {
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
          {/* 1. FORM KONSELING INDIVIDUAL (BLOK A-D TERSTANDAR)        */}
          {/* ========================================================= */}
          {isFormKonselingIndividual && (
            <div className="space-y-4">
              <StandardBlokAIdentitas
                sasaranLabel={studentDisplayText}
                sasaranSubLabel="Layanan Konseling Individual • Standar Kode Etik Kerahasiaan ABKIN"
                counselorName={activeCounselorInfo.name}
                counselorNip={activeCounselorInfo.nip}
                date={date}
                onDateChange={setDate}
                time={time}
                onTimeChange={setTime}
                tempat={stdTempat || counselingTempat}
                onTempatChange={(v) => {
                  setStdTempat(v);
                  setCounselingTempat(v);
                }}
                pertemuanKe={stdPertemuanKe}
                onPertemuanKeChange={(n) => {
                  setStdPertemuanKe(n);
                  setCounselingPertemuanKe(n);
                }}
                sifatLayanan={stdSifatLayanan}
                onSifatLayananChange={(sf) => {
                  setStdSifatLayanan(sf);
                  setCounselingSifat(sf === 'Baru' ? 'Sukarela' : 'Rujukan');
                }}
                extraBadge="Konseling Individual"
              />

              <StandardBlokBKonteks value={stdBlokB} onChange={setStdBlokB} />

              {/* BLOK C: ISI KHAS KONSELING INDIVIDUAL */}
              <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-[#f8faf9]/70">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-teal-100 text-[#00685f] font-black flex items-center justify-center text-sm shadow-2xs">
                      C
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                        Blok C - Isi Khas Konseling Individual
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Uraian masalah, proses pendekatan, respon konseli, dan kategori capaian sesi.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                        Uraian Masalah / Cerita Konseli:
                      </label>
                      <button
                        type="button"
                        disabled={isPolishingBlokC}
                        onClick={() =>
                          handlePolishBlokCText(
                            'individual',
                            counselingUseAiStory && counselingAiPolishedStory
                              ? counselingAiPolishedStory
                              : counselingRawStory,
                            (text) => {
                              setCounselingAiPolishedStory(text);
                              setCounselingUseAiStory(true);
                            }
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-extrabold cursor-pointer disabled:opacity-60"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Rapikan dengan Meta AI</span>
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={
                        counselingUseAiStory && counselingAiPolishedStory
                          ? counselingAiPolishedStory
                          : counselingRawStory
                      }
                      onChange={(e) => {
                        if (counselingUseAiStory) setCounselingAiPolishedStory(e.target.value);
                        else setCounselingRawStory(e.target.value);
                      }}
                      placeholder="Tuliskan inti cerita/keluhan konseli (contoh: sering begadang main game, mengantuk di kelas)..."
                      className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
                        Proses &amp; Pendekatan Konseling:
                      </label>
                      <input
                        type="text"
                        value={indivProsesPendekatan}
                        onChange={(e) => setIndivProsesPendekatan(e.target.value)}
                        placeholder="Contoh: SFBC, Active Listening, Behavior Contract"
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
                        Respon Konseli Saat Sesi:
                      </label>
                      <input
                        type="text"
                        value={indivResponSiswa || counselingDinamika}
                        onChange={(e) => {
                          setIndivResponSiswa(e.target.value);
                          setCounselingDinamika(e.target.value);
                        }}
                        placeholder="Contoh: Awalnya malu lalu terbuka dan bersedia berubah"
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                      Pencapaian Hasil Konseling:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {(
                        [
                          'Paham Masalah',
                          'Temukan Solusi',
                          'Komitmen Perubahan',
                          'Perlu Lanjut',
                          'Dirujuk',
                        ] as const
                      ).map((res) => {
                        const selected = counselingHasilKategori === res;
                        return (
                          <button
                            key={res}
                            type="button"
                            onClick={() => setCounselingHasilKategori(res)}
                            className={`p-2.5 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                              selected
                                ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                                : 'bg-gray-50 text-[#0b1c30] border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {res === 'Komitmen Perubahan' ? 'Komitmen' : res}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    onClick={() => setCounselingAgreedConfidentiality(!counselingAgreedConfidentiality)}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs ${
                      counselingAgreedConfidentiality
                        ? 'bg-teal-50/70 border-teal-300 text-teal-950'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-[#00685f] shrink-0" />
                    <span className="font-bold">
                      Asas Kerahasiaan ABKIN: Data sesi ini dijaga kerahasiaannya oleh {activeCounselorInfo.name}.
                    </span>
                  </div>
                </div>
              </div>

              <StandardBlokDTindakLanjut
                value={stdBlokD}
                onChange={setStdBlokD}
                aiRecommendation={currentContextualAiText}
                isGeneratingAi={isGeneratingStdAi}
                onGenerateAiRecommendation={handleRefreshContextualAi}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  className="w-full py-3.5 px-5 bg-gradient-to-r from-teal-700 to-[#00685f] hover:from-teal-800 hover:to-[#005049] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2.5 shadow-md transition-all cursor-pointer active:scale-98"
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

          {/* ========================================================= */}
          {/* 2. FORM BIMBINGAN KLASIKAL STANDAR RPL & PELAKSANAAN BK   */}
          {/* ========================================================= */}
          {isBimbinganKlasikalOnly && (
            <div className="space-y-4">
              {/* Peringatan Khas Klasikal (Wajib Jelas di Atas) */}
              <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 shadow-2xs">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs sm:text-sm font-black text-amber-950">
                    Ini layanan klasikal, interpretasi untuk dinamika kelas, bukan 1 siswa.
                  </p>
                  <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                    Evaluasi Bimbingan Klasikal menilai ketercapaian tujuan kelas, partisipasi kelas, kesesuaian metode, dan kesiapan tindak lanjut (tanpa skor keterbukaan/perilaku individual).
                  </p>
                </div>
              </div>

              {/* BLOK A: IDENTITAS */}
              <StandardBlokAIdentitas
                sasaranLabel={`Kelas ${selectedClass || '8A'} (${klasikalHadir}/${klasikalTotalSiswa} Siswa)`}
                sasaranSubLabel="Layanan Bimbingan Klasikal • Dinamika Rombongan Belajar"
                counselorName={activeCounselorInfo.name}
                counselorNip={activeCounselorInfo.nip}
                date={date}
                onDateChange={setDate}
                time={time}
                onTimeChange={setTime}
                tempat={stdTempat || klasikalTempat}
                onTempatChange={(v) => {
                  setStdTempat(v);
                  setKlasikalTempat(v);
                }}
                pertemuanKe={stdPertemuanKe}
                onPertemuanKeChange={setStdPertemuanKe}
                sifatLayanan={stdSifatLayanan}
                onSifatLayananChange={setStdSifatLayanan}
                extraBadge="Bimbingan Klasikal"
              />

              {/* BLOK B: KONTEKS TERSTANDAR */}
              <StandardBlokBKonteks value={stdBlokB} onChange={setStdBlokB} />

              {/* BLOK C: ISI KHAS BIMBINGAN KLASIKAL */}
              <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-[#f8faf9]/70">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 font-black flex items-center justify-center text-sm">
                      C
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                        Blok C - Isi Khas Bimbingan Klasikal (Dinamika Kelas)
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Kelas, kehadiran rombel, topik klasikal, dinamika kelas, dan contoh respon siswa di kelas.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
                        Kelas Sasaran:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {availableClasses.slice(0, 8).map((cls) => (
                          <button
                            key={cls}
                            type="button"
                            onClick={() => handleSelectKlasikalClass(cls)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                              selectedClass === cls
                                ? 'bg-[#00685f] text-white border-[#00685f]'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {cls}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
                        Jumlah Siswa Hadir:
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={klasikalHadir}
                        onChange={(e) => setKlasikalHadir(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-black text-[#0b1c30]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
                        Total Siswa Rombel:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={klasikalTotalSiswa}
                        onChange={(e) => setKlasikalTotalSiswa(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-black text-[#0b1c30]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                        Topik Klasikal:
                      </label>
                      <button
                        type="button"
                        onClick={handleBuatkanTujuanDariTopik}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-extrabold cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Buatkan Tujuan RPL</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {MATERI_KLASIKAL_OPTIONS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setKlasikalTopik(m);
                            setKlasikalMateri(m);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                            klasikalTopik === m
                              ? 'bg-teal-50 border-[#00685f] text-[#00685f]'
                              : 'bg-gray-50 border-gray-200 text-gray-600'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={klasikalTopik}
                      onChange={(e) => {
                        setKlasikalTopik(e.target.value);
                        setKlasikalMateri(e.target.value);
                      }}
                      placeholder="Tulis topik bimbingan klasikal..."
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                      Dinamika Kelas:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Aktif', 'Pasif', 'Gaduh'] as const).map((din) => (
                        <button
                          key={din}
                          type="button"
                          onClick={() => setKlasikalDinamikaKelas(din)}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                            klasikalDinamikaKelas === din
                              ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {din}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                        Contoh Respon Siswa di Kelas (1 kalimat):
                      </label>
                      <button
                        type="button"
                        disabled={isPolishingBlokC}
                        onClick={() =>
                          handlePolishBlokCText('klasikal', klasikalResponSiswa, setKlasikalResponSiswa)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-extrabold cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Rapikan dengan Meta AI</span>
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={klasikalResponSiswa}
                      onChange={(e) => setKlasikalResponSiswa(e.target.value)}
                      placeholder="Contoh: Mayoritas siswa antusias berdiskusi studi kasus, namun 2 barisan belakang masih pasif."
                      className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
                    />
                  </div>
                </div>
              </div>

              {/* BLOK D: KESEPAKATAN & TINDAK LANJUT */}
              <StandardBlokDTindakLanjut
                value={stdBlokD}
                onChange={setStdBlokD}
                aiRecommendation={currentContextualAiText}
                isGeneratingAi={isGeneratingStdAi}
                onGenerateAiRecommendation={handleRefreshContextualAi}
              />

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleDownloadKlasikalPdf}
                  className="w-full sm:w-auto py-3 px-5 bg-white hover:bg-teal-50 text-[#00685f] border-2 border-[#00685f] rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#00685f]" />
                  <span>Simpan & Download PDF RPL</span>
                </button>
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
          {/* 4A. FORM KONSELING KELOMPOK (BLOK A-D TERSTANDAR)         */}
          {/* ========================================================= */}
          {isFormKonselingKelompok && (
            <div className="space-y-4">
              <StandardBlokAIdentitas
                sasaranLabel={
                  kelompokParticipants.length > 0
                    ? `${kelompokParticipants.map((p) => p.nama).slice(0, 3).join(', ')}${kelompokParticipants.length > 3 ? ` +${kelompokParticipants.length - 3}` : ''} (${kelompokParticipants.length} Peserta)`
                    : studentDisplayText
                }
                sasaranSubLabel="Layanan Konseling Kelompok • Format Terstandar"
                counselorName={activeCounselorInfo.name}
                counselorNip={activeCounselorInfo.nip}
                date={date}
                onDateChange={setDate}
                time={time}
                onTimeChange={setTime}
                tempat={stdTempat}
                onTempatChange={setStdTempat}
                pertemuanKe={stdPertemuanKe}
                onPertemuanKeChange={setStdPertemuanKe}
                sifatLayanan={stdSifatLayanan}
                onSifatLayananChange={setStdSifatLayanan}
                extraBadge="Konseling Kelompok"
              />

              <StandardBlokBKonteks value={stdBlokB} onChange={setStdBlokB} />

              {/* BLOK C KHAS KONSELING KELOMPOK */}
              <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-[#f8faf9]/70">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 font-black flex items-center justify-center text-sm">
                      C
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                        Blok C - Daftar Peserta & Ringkasan Kelompok
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Catat peran, keterbukaan (1-5), dan kesepakatan tiap siswa dalam kelompok.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={kelompokAddStudentId}
                      onChange={(e) => setKelompokAddStudentId(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-[#0b1c30]"
                    >
                      <option value="">-- Pilih siswa untuk ditambah --</option>
                      {students.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.class})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const found = students.find((s) => s.id === kelompokAddStudentId);
                        const newParticipant: ServiceKelompokParticipant = found
                          ? {
                              id: `kp-${found.id}-${Date.now()}`,
                              studentId: found.id,
                              nama: found.name,
                              kelas: found.class,
                              peran: 'Aktif',
                              keterbukaan: 3,
                              kesepakatanSiswa: '',
                            }
                          : {
                              id: `kp-${Date.now()}`,
                              nama: `Peserta ${kelompokParticipants.length + 1}`,
                              kelas: selectedClass || '-',
                              peran: 'Aktif',
                              keterbukaan: 3,
                              kesepakatanSiswa: '',
                            };
                        setKelompokParticipants((prev) => [...prev, newParticipant]);
                        if (found && !selectedStudents.some((s) => s.id === found.id)) {
                          setSelectedStudents((prev) => [...prev, found]);
                        }
                        setKelompokAddStudentId('');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-black cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tambah Siswa</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {kelompokParticipants.map((p, idx) => (
                      <div key={p.id} className="p-3.5 bg-[#f8faf9] rounded-xl border border-gray-200 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={p.nama}
                            onChange={(e) => {
                              const val = e.target.value;
                              setKelompokParticipants((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, nama: val } : item))
                              );
                            }}
                            placeholder="Nama Siswa"
                            className="flex-1 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black text-[#0b1c30]"
                          />
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-white border border-gray-200 rounded text-gray-600">
                            {p.kelas || '-'}
                          </span>
                          {kelompokParticipants.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setKelompokParticipants((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Hapus peserta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                            Peran Siswa:
                          </span>
                          <div className="grid grid-cols-4 gap-1">
                            {(['Dominan', 'Aktif', 'Pendiam', 'Pasif'] as const).map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() =>
                                  setKelompokParticipants((prev) =>
                                    prev.map((item, i) => (i === idx ? { ...item, peran: role } : item))
                                  )
                                }
                                className={`py-1 px-1.5 rounded-lg text-[11px] font-black border cursor-pointer ${
                                  p.peran === role
                                    ? 'bg-[#00685f] text-white border-[#00685f]'
                                    : 'bg-white text-gray-700 border-gray-200'
                                }`}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] uppercase font-bold text-gray-500">
                              Keterbukaan Siswa:
                            </span>
                            <span className="text-[11px] font-black text-[#00685f]">{p.keterbukaan}/5</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1">
                            {[1, 2, 3, 4, 5].map((sc) => (
                              <button
                                key={sc}
                                type="button"
                                onClick={() =>
                                  setKelompokParticipants((prev) =>
                                    prev.map((item, i) => (i === idx ? { ...item, keterbukaan: sc } : item))
                                  )
                                }
                                className={`py-1 rounded-lg text-xs font-black border cursor-pointer ${
                                  p.keterbukaan === sc
                                    ? 'bg-[#00685f] text-white border-[#00685f]'
                                    : 'bg-white text-gray-700 border-gray-200'
                                }`}
                              >
                                {sc}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                            Kesepakatan yang Disetujui Siswa Ini (1 kalimat):
                          </span>
                          <input
                            type="text"
                            value={p.kesepakatanSiswa}
                            onChange={(e) => {
                              const val = e.target.value;
                              setKelompokParticipants((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, kesepakatanSiswa: val } : item
                                )
                              );
                            }}
                            placeholder="Contoh: Berkomitmen mematikan game pukul 21.00 WIB."
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-[#0b1c30]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Ringkasan Kelompok (Proses + Komitmen Bersama) */}
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                        Ringkasan Proses Kelompok:
                      </label>
                      <button
                        type="button"
                        disabled={isPolishingBlokC}
                        onClick={() =>
                          handlePolishBlokCText(
                            'kelompok',
                            konsKelUseAi && konsKelAiSummary ? konsKelAiSummary : konsKelRawSummary,
                            (text) => {
                              setKonsKelAiSummary(text);
                              setKonsKelUseAi(true);
                            }
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-extrabold cursor-pointer"
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
                      placeholder="Tuliskan alur proses dinamika konseling kelompok..."
                      className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                      Kesepakatan Komitmen Bersama Kelompok:
                    </label>
                    <input
                      type="text"
                      value={kelompokKomitmenBersama}
                      onChange={(e) => setKelompokKomitmenBersama(e.target.value)}
                      placeholder="Contoh: Saling mengingatkan di kelas dan menjaga kerahasiaan kelompok."
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
                    />
                  </div>
                </div>
              </div>

              <StandardBlokDTindakLanjut
                value={stdBlokD}
                onChange={setStdBlokD}
                aiRecommendation={currentContextualAiText}
                isGeneratingAi={isGeneratingStdAi}
                onGenerateAiRecommendation={handleRefreshContextualAi}
              />
            </div>
          )}

          {/* ========================================================= */}
          {/* 4B. FORM LAYANAN MEDIASI (BLOK A-D TERSTANDAR)            */}
          {/* ========================================================= */}
          {isFormMediasi && (
            <div className="space-y-4">
              <StandardBlokAIdentitas
                sasaranLabel={`${mediasiData.pihak1Nama || 'Pihak 1'} vs ${mediasiData.pihak2Nama || 'Pihak 2'}`}
                sasaranSubLabel="Layanan Mediasi Konflik • Pemulihan Relasi Kedua Pihak"
                counselorName={activeCounselorInfo.name}
                counselorNip={activeCounselorInfo.nip}
                date={date}
                onDateChange={setDate}
                time={time}
                onTimeChange={setTime}
                tempat={stdTempat}
                onTempatChange={setStdTempat}
                pertemuanKe={stdPertemuanKe}
                onPertemuanKeChange={setStdPertemuanKe}
                sifatLayanan={stdSifatLayanan}
                onSifatLayananChange={setStdSifatLayanan}
                extraBadge="Mediasi"
              />

              <StandardBlokBKonteks value={stdBlokB} onChange={setStdBlokB} />

              {/* BLOK C KHAS MEDIASI */}
              <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-[#f8faf9]/70">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 font-black flex items-center justify-center text-sm">
                      C
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                        Blok C - Isi Khas Mediasi (Berimbang Dua Pihak)
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Catat identitas, versi masing-masing pihak, titik konflik, dan status kesepakatan.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-[#f8faf9] rounded-xl border border-gray-200 space-y-2">
                      <label className="text-xs font-black text-[#0b1c30] block">Pihak 1 (Nama):</label>
                      <input
                        type="text"
                        value={mediasiData.pihak1Nama}
                        onChange={(e) => setMediasiData({ ...mediasiData, pihak1Nama: e.target.value })}
                        placeholder="Ketik nama Pihak 1"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-[#0b1c30]"
                      />
                      <label className="text-[11px] font-bold text-gray-600 block">Versi Pihak 1 (1 kalimat):</label>
                      <textarea
                        rows={2}
                        value={mediasiData.versiPihak1}
                        onChange={(e) => setMediasiData({ ...mediasiData, versiPihak1: e.target.value })}
                        placeholder="Ringkasan sudut pandang Pihak 1..."
                        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-[#0b1c30]"
                      />
                    </div>

                    <div className="p-3.5 bg-[#f8faf9] rounded-xl border border-gray-200 space-y-2">
                      <label className="text-xs font-black text-[#0b1c30] block">Pihak 2 (Nama):</label>
                      <input
                        type="text"
                        value={mediasiData.pihak2Nama}
                        onChange={(e) => setMediasiData({ ...mediasiData, pihak2Nama: e.target.value })}
                        placeholder="Ketik nama Pihak 2"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-[#0b1c30]"
                      />
                      <label className="text-[11px] font-bold text-gray-600 block">Versi Pihak 2 (1 kalimat):</label>
                      <textarea
                        rows={2}
                        value={mediasiData.versiPihak2}
                        onChange={(e) => setMediasiData({ ...mediasiData, versiPihak2: e.target.value })}
                        placeholder="Ringkasan sudut pandang Pihak 2..."
                        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-[#0b1c30]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                        Titik Konflik Utama (1 kalimat):
                      </label>
                      <button
                        type="button"
                        disabled={isPolishingBlokC}
                        onClick={() =>
                          handlePolishBlokCText('mediasi', mediasiData.titikKonflikUtama, (txt) =>
                            setMediasiData({ ...mediasiData, titikKonflikUtama: txt })
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-extrabold cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Rapikan dengan Meta AI</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={mediasiData.titikKonflikUtama}
                      onChange={(e) => setMediasiData({ ...mediasiData, titikKonflikUtama: e.target.value })}
                      placeholder="Contoh: Salah paham komentar di grup kelas yang memicu saling ejek."
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                      Status Mediasi:
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {(['Sepakat', 'Tidak Sepakat'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setMediasiData({ ...mediasiData, statusMediasi: st })}
                          className={`py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-black cursor-pointer transition-all ${
                            mediasiData.statusMediasi === st
                              ? st === 'Sepakat'
                                ? 'bg-[#00685f] text-white border-[#00685f]'
                                : 'bg-rose-600 text-white border-rose-600'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {mediasiData.statusMediasi === 'Sepakat' ? (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                      <label className="text-xs font-black text-emerald-950 block">
                        Kesepakatan Bersama (WAJIB — apa yang disepakati & siapa melakukan apa):
                      </label>
                      <textarea
                        rows={2}
                        value={mediasiData.kesepakatanBersama || ''}
                        onChange={(e) => setMediasiData({ ...mediasiData, kesepakatanBersama: e.target.value })}
                        placeholder="Contoh: Pihak 1 menghapus unggahan & meminta maaf; Pihak 2 tidak membalas komentar negatif dan keduanya berinteraksi normal."
                        className="w-full p-2.5 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-[#0b1c30]"
                      />
                    </div>
                  ) : (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2.5">
                      <div>
                        <label className="text-xs font-black text-rose-950 block mb-1">
                          Alasan Tidak Sepakat (WAJIB):
                        </label>
                        <input
                          type="text"
                          value={mediasiData.alasanTidakSepakat || ''}
                          onChange={(e) => setMediasiData({ ...mediasiData, alasanTidakSepakat: e.target.value })}
                          placeholder="Contoh: Pihak 1 belum bersedia mengakui kesalahan dan emosi masih tinggi."
                          className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs font-semibold text-[#0b1c30]"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-black text-rose-950 block mb-1">
                          Rencana Berikutnya (WAJIB — misal panggil wali kelas / mediasi ulang):
                        </label>
                        <input
                          type="text"
                          value={mediasiData.rencanaBerikutnya || ''}
                          onChange={(e) => setMediasiData({ ...mediasiData, rencanaBerikutnya: e.target.value })}
                          placeholder="Contoh: Libatkan Wali Kelas 8A untuk mediasi ulang 3 hari lagi."
                          className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs font-semibold text-[#0b1c30]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <StandardBlokDTindakLanjut
                value={stdBlokD}
                onChange={setStdBlokD}
                aiRecommendation={currentContextualAiText}
                isGeneratingAi={isGeneratingStdAi}
                onGenerateAiRecommendation={handleRefreshContextualAi}
              />
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. FORM HOME VISIT (BLOK A-D TERSTANDAR)                   */}
          {/* ========================================================= */}
          {isHomeVisitOnly && (
            <div className="space-y-4">
              <StandardBlokAIdentitas
                sasaranLabel={studentDisplayText}
                sasaranSubLabel={`Kunjungan Rumah (Home Visit) • ${homeVisitAlamat || 'Alamat Siswa'}`}
                counselorName={activeCounselorInfo.name}
                counselorNip={activeCounselorInfo.nip}
                date={date}
                onDateChange={(v) => {
                  setDate(v);
                  setHomeVisitTanggal(v);
                }}
                time={time}
                onTimeChange={setTime}
                tempat={stdTempat || homeVisitAlamat || 'Rumah Siswa'}
                onTempatChange={(v) => {
                  setStdTempat(v);
                  setHomeVisitAlamat(v);
                }}
                pertemuanKe={stdPertemuanKe}
                onPertemuanKeChange={setStdPertemuanKe}
                sifatLayanan={stdSifatLayanan}
                onSifatLayananChange={setStdSifatLayanan}
                extraBadge="Home Visit"
              />

              <StandardBlokBKonteks value={stdBlokB} onChange={setStdBlokB} />

              {/* BLOK C: ISI KHAS HOME VISIT */}
              <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-[#f8faf9]/70">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-teal-100 text-[#00685f] font-black flex items-center justify-center text-sm shadow-2xs">
                      C
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                        Blok C - Isi Khas Kunjungan Rumah (Home Visit)
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Pihak yang ditemui, alamat, kontak orang tua, kondisi rumah, hasil pembicaraan, status kunjungan, &amp; dokumentasi.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
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
                            className={`p-2.5 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                                : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                    {homeVisitYangDitemui === 'Lainnya' && (
                      <input
                        type="text"
                        value={homeVisitYangDitemuiLainnya}
                        onChange={(e) => setHomeVisitYangDitemuiLainnya(e.target.value)}
                        placeholder="Ketik hubungan keluarga (contoh: Kakek, Paman, Kakak Kandung)..."
                        className="mt-2 w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold focus:outline-none focus:border-[#00685f]"
                      />
                    )}
                  </div>

                  {/* Alamat, Nama Ortu, No HP */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                        Alamat Rumah:
                      </label>
                      <input
                        type="text"
                        value={homeVisitAlamat}
                        onChange={(e) => {
                          setHomeVisitAlamat(e.target.value);
                          setStdTempat(e.target.value);
                        }}
                        placeholder="Alamat kunjungan..."
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                        Nama Orang Tua / Wali:
                      </label>
                      <input
                        type="text"
                        value={homeVisitNamaOrtu}
                        onChange={(e) => {
                          setHomeVisitNamaOrtu(e.target.value);
                          setHomeVisitTtdOrtu(e.target.value);
                        }}
                        placeholder="Nama orang tua..."
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                        No. HP Orang Tua:
                      </label>
                      <input
                        type="text"
                        value={homeVisitNoHpOrtu}
                        onChange={(e) => setHomeVisitNoHpOrtu(e.target.value)}
                        placeholder="08xx-xxxx-xxxx"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
                      />
                    </div>
                  </div>

                  {/* Kondisi Rumah Singkat */}
                  <div>
                    <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1">
                      Kondisi Rumah &amp; Lingkungan Singkat (1 kalimat):
                    </label>
                    <input
                      type="text"
                      value={homeVisitKondisiRumah}
                      onChange={(e) => setHomeVisitKondisiRumah(e.target.value)}
                      placeholder="Contoh: Rumah layak huni, suasana tenang, siswa tinggal bersama nenek saat orang tua bekerja."
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
                    />
                  </div>

                  {/* Hasil Pembicaraan + AI Polish */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                        Hasil Pembicaraan:
                      </label>
                      <button
                        type="button"
                        disabled={isPolishingBlokC}
                        onClick={() =>
                          handlePolishBlokCText(
                            'home-visit',
                            homeVisitUseAi && homeVisitAiHasil ? homeVisitAiHasil : homeVisitRawHasil,
                            (text) => {
                              setHomeVisitAiHasil(text);
                              setHomeVisitUseAi(true);
                            }
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-extrabold cursor-pointer disabled:opacity-60"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Rapikan dengan Meta AI</span>
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={homeVisitUseAi && homeVisitAiHasil ? homeVisitAiHasil : homeVisitRawHasil}
                      onChange={(e) => {
                        if (homeVisitUseAi) setHomeVisitAiHasil(e.target.value);
                        else setHomeVisitRawHasil(e.target.value);
                      }}
                      placeholder="Tuliskan pokok dialog dengan orang tua/wali dan faktor penyebab dari lingkungan keluarga..."
                      className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
                    />
                  </div>

                  {/* Kesepakatan Orang Tua & Status Kunjungan */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
                        Kesepakatan dengan Orang Tua:
                      </label>
                      <input
                        type="text"
                        value={homeVisitKesepakatanOrtu}
                        onChange={(e) => setHomeVisitKesepakatanOrtu(e.target.value)}
                        placeholder="Contoh: Orang tua mengawasi jam tidur & mengantar anak tepat waktu."
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-[#0b1c30] focus:bg-white focus:outline-none focus:border-[#00685f]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
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
                              className={`py-2 px-2 rounded-xl border-2 text-center text-[11px] font-black transition-all cursor-pointer ${
                                isSelected
                                  ? st === 'Berhasil Ditemui'
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : st === 'Rumah Kosong'
                                      ? 'bg-amber-600 text-white border-amber-600'
                                      : 'bg-rose-600 text-white border-rose-600'
                                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                              }`}
                            >
                              {st}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Upload Foto Bukti (Opsional) */}
                  <div>
                    <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-1.5">
                      Foto Bukti Kunjungan (Opsional):
                    </label>
                    {homeVisitFotoBukti ? (
                      <div className="p-3 bg-gray-50 border border-teal-200 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={homeVisitFotoBukti}
                            alt="Dokumentasi Home Visit"
                            className="w-14 h-14 object-cover rounded-lg border border-gray-200"
                          />
                          <div>
                            <p className="text-xs font-black text-[#0b1c30]">{homeVisitFotoName || 'foto_kunjungan.jpg'}</p>
                            <p className="text-[10px] text-teal-700 font-bold">✓ Foto siap dilampirkan</p>
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
                          Hapus
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-gray-300 hover:border-[#00685f] rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer bg-gray-50/70 hover:bg-teal-50/30 transition-all text-xs font-bold text-gray-700">
                        <Camera className="w-4 h-4 text-[#00685f]" />
                        <span>Ambil / Upload Foto Bukti Kunjungan (Maks. 5 MB)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleHomeVisitPhotoUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <StandardBlokDTindakLanjut
                value={stdBlokD}
                onChange={setStdBlokD}
                aiRecommendation={currentContextualAiText}
                isGeneratingAi={isGeneratingStdAi}
                onGenerateAiRecommendation={handleRefreshContextualAi}
              />

              <div className="flex flex-col sm:flex-row items-center gap-3">
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
          {/* ========================================================= */}
          {/* 8. FORM OBSERVASI / WAWANCARA + REFERAL (BLOK A-D STANDAR)*/}
          {/* ========================================================= */}
          {isFormObservasiWawancaraReferal && (
            <div className="space-y-4">
              <StandardBlokAIdentitas
                sasaranLabel={studentDisplayText}
                sasaranSubLabel={`Layanan ${obsWawRefData.subJenis} • Asesmen & Rujukan Terstandar`}
                counselorName={activeCounselorInfo.name}
                counselorNip={activeCounselorInfo.nip}
                date={date}
                onDateChange={setDate}
                time={time}
                onTimeChange={setTime}
                tempat={stdTempat}
                onTempatChange={setStdTempat}
                pertemuanKe={stdPertemuanKe}
                onPertemuanKeChange={setStdPertemuanKe}
                sifatLayanan={stdSifatLayanan}
                onSifatLayananChange={setStdSifatLayanan}
                extraBadge={obsWawRefData.subJenis}
              />

              <StandardBlokBKonteks value={stdBlokB} onChange={setStdBlokB} />

              {/* BLOK C KHAS OBSERVASI / WAWANCARA / REFERAL */}
              <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-[#f8faf9]/70">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 font-black flex items-center justify-center text-sm">
                      C
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-[#0b1c30]">
                        Blok C - Isi Khas Observasi / Wawancara / Referal
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Pilih sub-jenis tindakan agar bidang pengumpulan data atau rujukan sesuai konteks.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                  {/* Segmented Sub-Jenis Tabs */}
                  <div className="grid grid-cols-3 gap-2 p-1.5 bg-gray-100 rounded-2xl">
                    {(['Observasi', 'Wawancara', 'Referal'] as const).map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setObsWawRefData({ ...obsWawRefData, subJenis: sub });
                          setStdBlokB((prev) => ({ ...prev, teknik: sub }));
                        }}
                        className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                          obsWawRefData.subJenis === sub
                            ? 'bg-[#00685f] text-white shadow-xs'
                            : 'text-[#3d4947] hover:bg-gray-200/70'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>

                  {/* SUB-MODE 1: OBSERVASI */}
                  {obsWawRefData.subJenis === 'Observasi' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-black text-[#0b1c30] block mb-1">Yang Diamati:</label>
                          <input
                            type="text"
                            value={obsWawRefData.yangDiamati || ''}
                            onChange={(e) => setObsWawRefData({ ...obsWawRefData, yangDiamati: e.target.value })}
                            placeholder="Contoh: Fokus belajar & interaksi dengan teman sebangku"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-[#0b1c30]"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-black text-[#0b1c30] block mb-1">Tempat Observasi:</label>
                          <input
                            type="text"
                            value={obsWawRefData.tempat || ''}
                            onChange={(e) => setObsWawRefData({ ...obsWawRefData, tempat: e.target.value })}
                            placeholder="Contoh: Ruang Kelas 8A / Lapangan"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-[#0b1c30]"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-black text-[#0b1c30] block mb-1">Durasi:</label>
                          <input
                            type="text"
                            value={obsWawRefData.durasi || ''}
                            onChange={(e) => setObsWawRefData({ ...obsWawRefData, durasi: e.target.value })}
                            placeholder="Contoh: 25 menit"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-[#0b1c30]"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                            Hasil Pengamatan (1-2 kalimat):
                          </label>
                          <button
                            type="button"
                            disabled={isPolishingBlokC}
                            onClick={() =>
                              handlePolishBlokCText('observasi-wawancara-referal', obsWawRefData.hasilPengamatan || '', (txt) =>
                                setObsWawRefData({ ...obsWawRefData, hasilPengamatan: txt })
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-extrabold cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Rapikan dengan Meta AI</span>
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={obsWawRefData.hasilPengamatan || ''}
                          onChange={(e) => setObsWawRefData({ ...obsWawRefData, hasilPengamatan: e.target.value })}
                          placeholder="Tuliskan fakta perilaku objektif yang teramati selama durasi pengamatan..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30]"
                        />
                      </div>
                    </div>
                  )}

                  {/* SUB-MODE 2: WAWANCARA */}
                  {obsWawRefData.subJenis === 'Wawancara' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                          Siapa yang Diwawancarai:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['Siswa', 'Guru', 'Orang Tua'] as const).map((target) => (
                            <button
                              key={target}
                              type="button"
                              onClick={() => setObsWawRefData({ ...obsWawRefData, diwawancarai: target })}
                              className={`py-2 px-3 rounded-xl border text-xs font-black cursor-pointer ${
                                obsWawRefData.diwawancarai === target
                                  ? 'bg-[#00685f] text-white border-[#00685f]'
                                  : 'bg-gray-50 text-gray-700 border-gray-200'
                              }`}
                            >
                              {target}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-black text-[#0b1c30] block mb-1">Pertanyaan Kunci:</label>
                        <input
                          type="text"
                          value={obsWawRefData.pertanyaanKunci || ''}
                          onChange={(e) => setObsWawRefData({ ...obsWawRefData, pertanyaanKunci: e.target.value })}
                          placeholder="Contoh: Apa pemicu utama siswa sering absen di jam pelajaran pertama?"
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-[#0b1c30]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                            Ringkasan Jawaban:
                          </label>
                          <button
                            type="button"
                            disabled={isPolishingBlokC}
                            onClick={() =>
                              handlePolishBlokCText('observasi-wawancara-referal', obsWawRefData.ringkasanJawaban || '', (txt) =>
                                setObsWawRefData({ ...obsWawRefData, ringkasanJawaban: txt })
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-extrabold cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Rapikan dengan Meta AI</span>
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={obsWawRefData.ringkasanJawaban || ''}
                          onChange={(e) => setObsWawRefData({ ...obsWawRefData, ringkasanJawaban: e.target.value })}
                          placeholder="Tuliskan inti jawaban narasumber secara objektif..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30]"
                        />
                      </div>
                    </div>
                  )}

                  {/* SUB-MODE 3: REFERAL */}
                  {obsWawRefData.subJenis === 'Referal' && (
                    <div className="space-y-3">
                      <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center gap-2 text-xs font-black text-teal-900">
                        <Info className="w-4 h-4 text-[#00685f] shrink-0" />
                        <span>Rujukan ini adalah tindakan profesional, bukan kegagalan.</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                            Dirujuk ke:
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['Psikolog', 'Puskesmas', 'Pihak Luar'] as const).map((tujuan) => (
                              <button
                                key={tujuan}
                                type="button"
                                onClick={() => setObsWawRefData({ ...obsWawRefData, dirujukKe: tujuan })}
                                className={`py-2 px-2 rounded-xl border text-xs font-black cursor-pointer ${
                                  obsWawRefData.dirujukKe === tujuan
                                    ? 'bg-[#00685f] text-white border-[#00685f]'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                                }`}
                              >
                                {tujuan}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
                            Status Rujukan:
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['Menunggu', 'Sudah Ditemui', 'Selesai'] as const).map((stRef) => (
                              <button
                                key={stRef}
                                type="button"
                                onClick={() => setObsWawRefData({ ...obsWawRefData, statusRujukan: stRef })}
                                className={`py-2 px-2 rounded-xl border text-xs font-black cursor-pointer ${
                                  obsWawRefData.statusRujukan === stRef
                                    ? 'bg-[#00685f] text-white border-[#00685f]'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                                }`}
                              >
                                {stRef}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                            Alasan Dirujuk (WAJIB):
                          </label>
                          <button
                            type="button"
                            disabled={isPolishingBlokC}
                            onClick={() =>
                              handlePolishBlokCText('observasi-wawancara-referal', obsWawRefData.alasanDirujuk || '', (txt) =>
                                setObsWawRefData({ ...obsWawRefData, alasanDirujuk: txt })
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-extrabold cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Rapikan dengan Meta AI</span>
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={obsWawRefData.alasanDirujuk || ''}
                          onChange={(e) => setObsWawRefData({ ...obsWawRefData, alasanDirujuk: e.target.value })}
                          placeholder="Tuliskan alasan klinis/objektif perlunya penanganan ahli eksternal..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <StandardBlokDTindakLanjut
                value={stdBlokD}
                onChange={setStdBlokD}
                aiRecommendation={currentContextualAiText}
                isGeneratingAi={isGeneratingStdAi}
                onGenerateAiRecommendation={handleRefreshContextualAi}
              />
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
          {!isFormAbsen &&
            !isFormKonselingIndividual &&
            !isBimbinganKlasikalOnly &&
            !isHomeVisitOnly &&
            !isFormKonselingKelompok &&
            !isFormMediasi &&
            !isFormObservasiWawancaraReferal && (
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
