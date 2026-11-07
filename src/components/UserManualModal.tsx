import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Download,
  X,
  CheckCircle2,
  Sparkles,
  FileText,
  Users,
  ShieldAlert,
  HeartHandshake,
  Award,
  Calendar,
  ClipboardList,
  FileBarChart,
  Cloud,
  ChevronRight,
  Printer
} from 'lucide-react';
import { generateUserManualPDF } from '../utils/userManualPdfGenerator';
import { getSchoolConfig } from '../utils/schoolConfig';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserManualModal({ isOpen, onClose }: UserManualModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const config = getSchoolConfig();

  if (!isOpen) return null;

  const handleDownload = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        generateUserManualPDF();
      } catch (err) {
        console.error('Error generating PDF:', err);
      } finally {
        setIsGenerating(false);
      }
    }, 200);
  };

  const manualChapters = [
    {
      num: '01',
      title: 'Pengenalan & Konsep Dasar BK Digital',
      desc: 'Tujuan, filosofi disiplin positif, prinsip restitusi, dan arsitektur data tanpa kertas.',
      icon: BookOpen,
    },
    {
      num: '02',
      title: 'Persiapan Awal, Akun & Multi-Sekolah',
      desc: 'Konfigurasi identitas sekolah (NPSN), logo dinas, dan hak akses kelas (RBAC).',
      icon: Users,
    },
    {
      num: '03',
      title: 'Dashboard & Early Warning System',
      desc: 'Indikator KPI, grafik tren, notifikasi siswa berisiko tinggi (≥30 poin), dan sticky notes.',
      icon: Sparkles,
    },
    {
      num: '04',
      title: 'Manajemen Data Siswa & Profil 360°',
      desc: 'Pencarian instan, impor Excel Dapodik, portofolio rekam jejak, dan cetak PDF profil.',
      icon: Users,
    },
    {
      num: '05',
      title: 'Absensi Kelas & Deteksi Bolos',
      desc: 'Presensi harian rombel, rekapitulasi kehadiran, dan otomatisasi penanganan kasus alfa.',
      icon: Calendar,
    },
    {
      num: '06',
      title: 'Pencatatan Pelanggaran & Restitusi Positif',
      desc: 'Bobot poin tertib (Ringan s/d Sangat Berat), nomor tiket kasus, dan alur pemulihan.',
      icon: ShieldAlert,
    },
    {
      num: '07',
      title: 'Apresiasi & Prestasi Siswa',
      desc: 'Pencatatan kejuaraan akademik, bakat seni/olahraga, akhlak terpuji, dan kompensasi poin.',
      icon: Award,
    },
    {
      num: '08',
      title: 'Layanan Bimbingan & Konseling',
      desc: 'Konseling Individu, Kelompok, Bimbingan Klasikal, alih tangan kasus, dan berita acara.',
      icon: HeartHandshake,
    },
    {
      num: '09',
      title: 'Administrasi Panggilan Orang Tua',
      desc: 'Surat panggilan resmi (ke-1, ke-2, ke-3), kop dinas otomatis, QR code, dan lembar tanda terima.',
      icon: FileText,
    },
    {
      num: '10',
      title: 'Layanan Kunjungan Rumah (Home Visit)',
      desc: 'Surat tugas kepala sekolah, instrumen wawancara keluarga, komitmen orang tua, & foto.',
      icon: FileText,
    },
    {
      num: '11',
      title: 'Pembinaan & Pendisiplinan Khusus',
      desc: 'Surat perjanjian siswa, kontrak perilaku terukur, evaluasi mingguan, dan RTL.',
      icon: ShieldAlert,
    },
    {
      num: '12',
      title: 'Asesmen AKPD & Diagnostik Siswa',
      desc: 'Angket kebutuhan 4 bidang (Pribadi, Sosial, Belajar, Karir) dan pemetaan gaya belajar.',
      icon: ClipboardList,
    },
    {
      num: '13',
      title: 'Jurnal Harian Guru BK',
      desc: 'Pencatatan jam kerja harian terintegrasi otomatis untuk laporan kinerja SKP / PMM.',
      icon: ClipboardList,
    },
    {
      num: '14',
      title: 'Rekapitulasi Laporan Dinas & Ekspor',
      desc: 'Laporan bulanan, semesteran, dan tahunan siap cetak dalam format PDF resmi & Excel.',
      icon: FileBarChart,
    },
    {
      num: '15',
      title: 'Asisten Cerdas Gemini AI',
      desc: 'Analisis psikopedagogis otomatis untuk diagnosa akar masalah dan rekomendasi intervensi.',
      icon: Sparkles,
    },
    {
      num: '16',
      title: 'Cloud Sync, Google Sheets & PWA',
      desc: 'Sinkronisasi instan <1 ms, backup Google Sheets, operasi offline, dan instalasi aplikasi.',
      icon: Cloud,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0b1c30]/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-[#bcc9c6]/40 overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#00685f] text-white p-5 sm:p-6 flex items-start justify-between relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/15 text-white text-[11px] font-extrabold uppercase tracking-wider mb-2.5 backdrop-blur-xs">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Dokumentasi Resmi Aplikasi</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
              Buku Panduan Operasional SIKAP-BK (PDF)
            </h2>
            <p className="text-teal-50 text-xs sm:text-sm font-medium mt-1">
              Petunjuk operasional lengkap Sistem Informasi Karakter, Apresiasi & Pelayanan Bimbingan Konseling. Siap diunduh dalam format PDF profesional.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0 ml-3"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Subtle Decorative Background Wave */}
          <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 w-48 h-48 bg-white/5 rounded-full pointer-events-none blur-2xl" />
        </div>

        {/* Action Bar / Download Banner */}
        <div className="bg-[#e6f4f1] border-b border-[#00685f]/20 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase text-[#00685f] tracking-wider block">
              Sekolah Terkonfigurasi:
            </span>
            <p className="text-sm font-extrabold text-[#0b1c30]">
              {config.schoolName}
            </p>
            <p className="text-xs text-[#3d4947] font-medium">
              Kop surat, logo, nomor halaman, dan pedoman bab otomatis disesuaikan secara dinamis.
            </p>
          </div>

          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex items-center justify-center gap-2.5 px-6 py-3 bg-[#00685f] hover:bg-[#005049] active:scale-97 text-white rounded-xl text-sm font-black transition-all shadow-md cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Membuat PDF Panduan...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Unduh Buku Panduan (PDF)</span>
              </>
            )}
          </button>
        </div>

        {/* Modal Body - Chapters Matrix */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar bg-[#f8faf9]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
              Daftar Bab & Cakupan Materi dalam Buku Panduan:
            </h3>
            <span className="text-[11px] font-bold text-[#00685f] bg-[#00685f]/10 px-2.5 py-0.5 rounded-full">
              18 Bab Lengkap
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {manualChapters.map((chap) => {
              const IconComp = chap.icon;
              return (
                <div
                  key={chap.num}
                  className="p-3.5 bg-white rounded-xl border border-[#bcc9c6]/30 hover:border-[#00685f]/50 hover:shadow-xs transition-all flex items-start gap-3 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#e6f4f1] group-hover:bg-[#00685f] text-[#00685f] group-hover:text-white flex items-center justify-center shrink-0 font-black text-xs transition-colors">
                    <IconComp className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-[#00685f] uppercase tracking-wider">
                        Bab {chap.num}
                      </span>
                    </div>
                    <h4 className="text-xs font-extrabold text-[#0b1c30] group-hover:text-[#00685f] transition-colors leading-snug">
                      {chap.title}
                    </h4>
                    <p className="text-[11px] text-[#3d4947]/80 font-medium leading-relaxed mt-0.5">
                      {chap.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Notice Card */}
          <div className="p-4 bg-white rounded-xl border border-teal-200/80 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#00685f] shrink-0 mt-0.5" />
            <div className="text-xs text-[#3d4947] leading-relaxed">
              <span className="font-bold text-[#0b1c30] block">Format Berstandar Dinas & Siap Dibagikan:</span>
              Dokumen PDF yang dihasilkan telah diformat dalam ukuran A4 rapi, lengkap dengan kop surat resmi sekolah, nomor halaman otomatis, tabel komparasi, dan pedoman langkah demi langkah (Step-by-Step) sehingga dapat langsung dicetak atau dibagikan ke seluruh tim guru BK dan kepala sekolah.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#bcc9c6]/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500 font-semibold text-center sm:text-left">
            Disusun untuk Koordinator BK, Guru Pembimbing, dan Wali Kelas.
          </p>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#3d4947] rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-[#00685f] hover:bg-[#005049] active:scale-97 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isGenerating ? 'Membuat PDF...' : 'Unduh PDF Sekarang'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
