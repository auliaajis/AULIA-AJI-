import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Award,
  Sparkles,
  Target,
  ShieldAlert,
  Users,
  HeartHandshake,
  Download,
  Printer,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  HelpCircle,
  Brain,
  Compass,
  Building2,
  ExternalLink,
  Layers,
  Scale,
  Smile,
  FileText,
  Check,
  AlertTriangle,
  RefreshCw,
  X,
  Share2
} from 'lucide-react';
import {
  RIASEC_MINAT_QUESTIONS,
  RIASEC_KETERAMPILAN_ITEMS,
  RIASEC_INTERPRETATIONS,
  EPSTEIN_PARENT_PARTNERSHIP_MODELS,
  PPKSP_2023_SOP,
  TIGA_DOSA_BESAR_SOP,
  SEGITIGA_RESTITUSI_STEPS,
  LIMA_POSISI_KONTROL,
  BSKAP_LAMPIRAN_1_SEBAB_AKIBAT,
  BSKAP_LAMPIRAN_2_RENCANA_AKSI,
  BSKAP_LAMPIRAN_3_GLASSER,
  BSKAP_LAMPIRAN_6_TRIASE,
  BSKAP_4_KOMPONEN_LAYANAN,
  BSKAP_6_PERAN_GURU_BK
} from '../data/juknisBskap2022';
import { getSchoolConfig } from '../utils/schoolConfig';
import { showToast } from '../utils/toast';
import { applyLatestBkGuideConfig } from '../utils/violationRulesConfig';
import { finalizeAndSavePdf } from '../utils/pdfGenerator';
import jsPDF from 'jspdf';

interface PanduanBskap2022ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PanduanBskap2022Modal({ isOpen, onClose }: PanduanBskap2022ModalProps) {
  const [activeTab, setActiveTab] = useState<'filosofi' | 'riasec' | 'analisis_responsif' | 'restitusi' | 'triase_situasi' | 'ppksp' | 'kemitraan_keluarga'>('filosofi');
  const [isApplyingPreset, setIsApplyingPreset] = useState(false);

  const handleApplyConfig = () => {
    setIsApplyingPreset(true);
    try {
      const res = applyLatestBkGuideConfig();
      showToast(`Berhasil menerapkan Standar Panduan BK & PPKSP Terbaru (${res.count} kategori aktif)`, 'success');
    } catch (e) {
      showToast('Gagal menerapkan konfigurasi panduan BK', 'error');
    } finally {
      setTimeout(() => setIsApplyingPreset(false), 500);
    }
  };

  // RIASEC Test State
  const [riasecStudentName, setRiasecStudentName] = useState('Ananda Siswa');
  const [riasecClass, setRiasecClass] = useState('Kelas IX');
  const [minatAnswers, setMinatAnswers] = useState<Record<number, boolean>>({});
  const [skillAnswers, setSkillAnswers] = useState<Record<string, boolean>>({});
  const [riasecSubTab, setRiasecSubTab] = useState<'instrumen1' | 'instrumen2' | 'hasil'>('instrumen1');

  // Bagan Analisis Situasi (Lampiran 7) State
  const [analisisData, setAnalisisData] = useState({
    namaSiswa: '',
    kelas: '',
    tanggal: new Date().toISOString().split('T')[0],
    faktorInternal: 'Kondisi emosi mudah labil saat lelah, motivasi belajar fluktuatif',
    faktorEksternalRumah: 'Pengkondisian belajar di rumah belum konsisten, orang tua sering dinas luar',
    faktorEksternalSekolah: 'Teman sebaya sering mengajak mengobrol saat jam pelajaran',
    perilakuPositif: 'Kreatif, energik, senang membantu saat kegiatan praktikum (+)',
    perilakuNegatif: 'Fokus mudah teralih (-), sering lupa mencatat tugas (-)',
    dampak: 'Pemahaman materi pelajaran tidak utuh dan mengganggu konsentrasi teman sebangku',
    dugaanPenyebab: 'Butuh apresiasi dan pengakuan eksistensi diri di kelas',
    harapanJangkaPendek: 'Mampu fokus minimal 30 menit penuh di kelas dalam 1 bulan',
    harapanJangkaPanjang: 'Konsisten menyelesaikan tugas akademik mandiri selama 1 semester',
    strategiSekolah: 'Guru memberikan peran ketua kelompok kecil & refleksi berkala',
    strategiRumah: 'Orang tua meluangkan waktu dialog hangat 15 menit setiap malam',
    strategiKolaborasi: 'Buku komunikasi mingguan antara wali kelas, Guru BK, dan orang tua'
  });

  // Calculate RIASEC Scores
  const riasecScores = useMemo(() => {
    const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

    // From Minat (Instrumen 1)
    RIASEC_MINAT_QUESTIONS.forEach((q) => {
      if (minatAnswers[q.id]) {
        scores[q.type] += 1;
      }
    });

    // From Skills (Instrumen 2)
    Object.keys(skillAnswers).forEach((id) => {
      if (skillAnswers[id]) {
        const item = RIASEC_KETERAMPILAN_ITEMS.find((k) => k.id === id);
        if (item) {
          scores[item.type] += 2; // Bobot keterampilan
        }
      }
    });

    const sortedTypes = (Object.keys(scores) as ('R' | 'I' | 'A' | 'S' | 'E' | 'C')[]).sort(
      (a, b) => scores[b] - scores[a]
    );

    const hollandCode = sortedTypes.slice(0, 3).join('');
    return { scores, sortedTypes, hollandCode };
  }, [minatAnswers, skillAnswers]);

  if (!isOpen) return null;

  // Print PDF for RIASEC Career Report
  const exportRiasecPdf = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const cfg = getSchoolConfig();

      doc.setFillColor(0, 104, 95);
      doc.rect(0, 0, 210, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('LAPORAN ASESMEN PEMETAAN MINAT, BAKAT & KARIR (METODE RIASEC)', 15, 12);
      doc.setFontSize(8);
      doc.text(`Standar BSKAP Kemendikbudristek 2022 • ${cfg.schoolName}`, 15, 17);

      let currentY = 28;
      doc.setTextColor(11, 28, 48);
      doc.setFontSize(10);
      doc.text(`Nama Peserta Didik : ${riasecStudentName || 'Siswa'}`, 15, currentY);
      doc.text(`Kelas : ${riasecClass || '-'}`, 120, currentY);
      currentY += 6;
      doc.text(`Tanggal Asesmen   : ${new Date().toLocaleDateString('id-ID')}`, 15, currentY);
      doc.text(`Kode Holland Utama : ${riasecScores.hollandCode}`, 120, currentY);

      currentY += 10;
      doc.setFillColor(240, 248, 246);
      doc.rect(15, currentY, 180, 8, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.text('SKOR PROFIL DIMENSI RIASEC (JOHN HOLLAND)', 20, currentY + 5.5);

      currentY += 12;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      const cols = [
        { code: 'R', label: 'Realistic', score: riasecScores.scores.R },
        { code: 'I', label: 'Investigative', score: riasecScores.scores.I },
        { code: 'A', label: 'Artistic', score: riasecScores.scores.A },
        { code: 'S', label: 'Social', score: riasecScores.scores.S },
        { code: 'E', label: 'Enterprising', score: riasecScores.scores.E },
        { code: 'C', label: 'Conventional', score: riasecScores.scores.C },
      ];
      cols.forEach((c, idx) => {
        const xPos = 15 + idx * 30;
        doc.setFont('Helvetica', 'bold');
        doc.text(`${c.code} (${c.score})`, xPos + 5, currentY);
        doc.setFont('Helvetica', 'normal');
        doc.text(c.label, xPos + 5, currentY + 4);
      });

      currentY += 12;
      doc.setFillColor(240, 248, 246);
      doc.rect(15, currentY, 180, 8, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.text('3 TIPE DOMINAN & REKOMENDASI JALUR KARIR / STUDI LANJUT', 20, currentY + 5.5);

      currentY += 12;
      riasecScores.sortedTypes.slice(0, 3).forEach((code, idx) => {
        const interp = RIASEC_INTERPRETATIONS[code];
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 104, 95);
        doc.text(`${idx + 1}. [${code}] ${interp.title}`, 15, currentY);
        currentY += 5;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(50, 50, 50);
        doc.text(`Karakteristik: ${interp.tagline}`, 15, currentY, { maxWidth: 180 });
        currentY += 5;
        doc.text(`Profesi Pendukung: ${interp.profesiPendukung.slice(0, 4).join(', ')}`, 15, currentY, { maxWidth: 180 });
        currentY += 5;
        doc.text(`Mata Pelajaran Pilihan / Studi Lanjut: ${interp.mapelPilihanRekomendasi.join(', ')}`, 15, currentY, { maxWidth: 180 });
        currentY += 8;
      });

      // Tanda Tangan
      currentY += 10;
      doc.setFontSize(9);
      doc.setTextColor(11, 28, 48);
      doc.text(`Mengetahui,`, 15, currentY);
      doc.text(`${cfg.schoolAddress?.split(',')[1]?.trim() || 'Semarang'}, ${new Date().toLocaleDateString('id-ID')}`, 130, currentY);
      currentY += 5;
      doc.text(`Guru Bimbingan dan Konseling`, 15, currentY);
      doc.text(`Peserta Didik`, 130, currentY);
      currentY += 20;
      doc.setFont('Helvetica', 'bold');
      doc.text(`( Guru Pembimbing BK )`, 15, currentY);
      doc.text(`( ${riasecStudentName || '....................'} )`, 130, currentY);

      const pdfFileName = `Laporan_RIASEC_${riasecStudentName.replace(/\s+/g, '_') || 'Siswa'}.pdf`;
      finalizeAndSavePdf(doc, pdfFileName, {
        category: 'layanan',
        studentName: riasecStudentName,
        successToastMessage: 'Laporan RIASEC berhasil diunduh & tersimpan otomatis di Google Drive!',
      });
    } catch (e) {
      showToast('Gagal mencetak PDF RIASEC', 'error');
    }
  };

  // Print PDF for Bagan Analisis Situasi (Lampiran 7)
  const exportAnalisisPdf = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const cfg = getSchoolConfig();

      doc.setFillColor(0, 104, 95);
      doc.rect(0, 0, 210, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('BAGAN ANALISIS SITUASI LAYANAN RESPONSIF (SATU HALAMAN)', 15, 12);
      doc.setFontSize(8);
      doc.text(`Lampiran 7 Juknis BK BSKAP Kemendikbudristek 2022 • ${cfg.schoolName}`, 15, 17);

      let currentY = 28;
      doc.setTextColor(11, 28, 48);
      doc.setFontSize(9.5);
      doc.text(`Nama Peserta Didik : ${analisisData.namaSiswa || 'Siswa'}`, 15, currentY);
      doc.text(`Kelas : ${analisisData.kelas || '-'}`, 120, currentY);
      currentY += 6;
      doc.text(`Tanggal Penyusunan: ${analisisData.tanggal}`, 15, currentY);
      doc.text(`Wali Kelas & Guru BK: ${cfg.principalName || 'Tim BK'}`, 120, currentY);

      const renderSectionBox = (title: string, content: string, yPos: number, height: number = 18) => {
        doc.setFillColor(248, 250, 249);
        doc.setDrawColor(188, 201, 198);
        doc.roundedRect(15, yPos, 180, height, 2, 2, 'FD');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 104, 95);
        doc.text(title, 18, yPos + 5);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 30, 30);
        doc.text(content || '-', 18, yPos + 10, { maxWidth: 174 });
      };

      currentY += 6;
      renderSectionBox('1. FAKTOR PENYEBAB INTERNAL (Fisik, Karakter, Regulasi Emosi)', analisisData.faktorInternal, currentY, 18);
      currentY += 21;
      renderSectionBox('2. FAKTOR PENYEBAB EKSTERNAL (Situasi Rumah & Pengkondisian Sekolah)', `Rumah: ${analisisData.faktorEksternalRumah} | Sekolah: ${analisisData.faktorEksternalSekolah}`, currentY, 20);
      currentY += 23;
      renderSectionBox('3. POLA PERILAKU TERAMATI (+ Kekuatan / - Pokok Masalah)', `Kekuatan: ${analisisData.perilakuPositif}\nPokok Masalah: ${analisisData.perilakuNegatif}`, currentY, 20);
      currentY += 23;
      renderSectionBox('4. DAMPAK PERILAKU & DUGAAN PENYEBAB SEMENTARA', `Dampak: ${analisisData.dampak}\nDugaan: ${analisisData.dugaanPenyebab}`, currentY, 18);
      currentY += 21;
      renderSectionBox('5. HARAPAN & TARGET PERBAIKAN SITUASI', `Jangka Pendek (< 1 Smt): ${analisisData.harapanJangkaPendek}\nJangka Panjang (> 6 Bulan): ${analisisData.harapanJangkaPanjang}`, currentY, 20);
      currentY += 23;
      renderSectionBox('6. STRATEGI KOLABORATIF (Sekolah, Rumah, & Kerjasama Terpadu)', `Sekolah: ${analisisData.strategiSekolah}\nRumah: ${analisisData.strategiRumah}\nSinergi: ${analisisData.strategiKolaborasi}`, currentY, 24);

      currentY += 28;
      doc.setFontSize(9);
      doc.setTextColor(11, 28, 48);
      doc.text(`Wali Kelas,`, 20, currentY);
      doc.text(`Guru Bimbingan dan Konseling,`, 120, currentY);
      currentY += 18;
      doc.setFont('Helvetica', 'bold');
      doc.text(`( ..................................... )`, 20, currentY);
      doc.text(`( Guru Pembimbing BK )`, 120, currentY);

      const pdfFileName = `Bagan_Analisis_Situasi_${analisisData.namaSiswa.replace(/\s+/g, '_') || 'Siswa'}.pdf`;
      finalizeAndSavePdf(doc, pdfFileName, {
        category: 'layanan',
        studentName: analisisData.namaSiswa,
        successToastMessage: 'Bagan Analisis Situasi berhasil diunduh & tersimpan otomatis di Google Drive!',
      });
    } catch (e) {
      showToast('Gagal mencetak PDF Analisis', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="bg-[#00685f] p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-white/10 rounded-2xl border border-white/20">
              <BookOpen className="w-6 h-6 text-teal-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black tracking-tight">
                  Panduan BK Kurikulum Merdeka & PPKSP Terbaru
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-800 text-teal-100 border border-teal-600">
                  BSKAP & Permendikbudristek 46/2023
                </span>
              </div>
              <p className="text-xs text-teal-100/90 font-medium mt-0.5">
                Standar Penyelenggaraan Bimbingan dan Konseling Komprehensif, Disiplin Positif, dan Alur TPPK
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={handleApplyConfig}
              disabled={isApplyingPreset}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 hover:bg-teal-400 active:scale-97 text-white rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Terapkan Preset Tata Tertib & Bobot Kurikulum Merdeka ke sekolah ini"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isApplyingPreset ? 'Menerapkan...' : 'Terapkan Standar ke Sekolah'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex items-center gap-1.5 p-2 bg-gray-100 border-b border-gray-200 overflow-x-auto text-xs font-bold shrink-0">
          {[
            { id: 'filosofi', label: '1. Filosofi & 4 Pilar', icon: Compass },
            { id: 'riasec', label: '2. Tes RIASEC (Minat Karir)', icon: Brain },
            { id: 'restitusi', label: '3. Segitiga Restitusi & Posisi Kontrol', icon: Sparkles },
            { id: 'analisis_responsif', label: '4. Bagan Analisis Kasus (Lampiran 7)', icon: FileText },
            { id: 'triase_situasi', label: '5. Triase Masalah (Hijau/Kuning/Merah)', icon: Target },
            { id: 'ppksp', label: '6. PPKSP (Permendikbud 46/2023) & TPPK', icon: ShieldAlert },
            { id: 'kemitraan_keluarga', label: '7. Tri Sentra & Model Epstein', icon: HeartHandshake },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#00685f] text-white shadow-2xs'
                    : 'text-gray-600 hover:text-[#00685f] hover:bg-white/70'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: FILOSOFI & 4 PILAR */}
          {activeTab === 'filosofi' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-[#f8faf9] border border-[#00685f]/20 rounded-2xl p-5">
                <h3 className="text-base font-black text-[#0b1c30] mb-2 flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#00685f]" />
                  Filosofi Ki Hadjar Dewantara & Transformasi Kurikulum Merdeka
                </h3>
                <p className="text-xs text-[#3d4947] leading-relaxed font-medium">
                  Bimbingan dan Konseling dalam Kurikulum Merdeka berpusat pada minat, bakat, dan kemampuan peserta didik untuk mencapai kemandirian utuh (cipta, rasa, dan karsa). Guru BK berperan sebagai teladan (<em>ing ngarsa sung tuladha</em>), sahabat pembangun karsa (<em>ing madya mangun karsa</em>), serta penyambung suara dan pendorong daya anak (<em>tut wuri handayani</em>).
                </p>
              </div>

              {/* 6 Peran Guru BK Texas Model */}
              <div>
                <h4 className="text-sm font-black text-[#0b1c30] mb-3">
                  6 Peran Guru BK (The Texas Model for Comprehensive School Counseling):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { no: 1, title: 'Pengelola Program', desc: 'Merencanakan, melaksanakan, dan mengevaluasi program BK kolaboratif terintegrasi Profil Pelajar Pancasila.' },
                    { no: 2, title: 'Pembimbing', desc: 'Membimbing murid mengenal diri, memfasilitasi perkembangan, dan eksplorasi minat potensi secara optimal.' },
                    { no: 3, title: 'Penilai', desc: 'Menggunakan instrumen formal/informal (AKPD, RIASEC, dll) dan bermitra dengan psikolog untuk rencana murid.' },
                    { no: 4, title: 'Konselor', desc: 'Membuka akses konseling individual, kelompok, dan krisis untuk penyelesaian masalah & kesehatan mental.' },
                    { no: 5, title: 'Konsultasi', desc: 'Memberikan informasi perkembangan potensi dan kebutuhan anak kepada wali kelas dan orang tua/wali.' },
                    { no: 6, title: 'Koordinasi', desc: 'Membangun sinergi Tri Sentra bersama bidang akademik sekolah, keluarga murid, dan stakeholder masyarakat.' }
                  ].map((p) => (
                    <div key={p.no} className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-2xs hover:border-[#00685f]/40 transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-[#00685f] text-white text-[10px] font-black flex items-center justify-center">
                          {p.no}
                        </span>
                        <h5 className="text-xs font-extrabold text-[#0b1c30]">{p.title}</h5>
                      </div>
                      <p className="text-[11px] text-gray-600 font-medium leading-relaxed">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5 Tahap Siklus Layanan BK */}
              <div className="bg-teal-50/50 border border-teal-200 rounded-2xl p-4">
                <h4 className="text-xs font-black text-[#00685f] uppercase tracking-wider mb-2">
                  Siklus Manajemen Layanan BK Standar BSKAP:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs">
                  {[
                    '1. Pemetaan Kebutuhan (Asesmen Diagnostik/AKPD)',
                    '2. Analisis Kebutuhan (Prioritas Isu & Fase)',
                    '3. Perencanaan Layanan (RPL & Program Tahunan)',
                    '4. Pelaksanaan Program (Klasikal, Konseling, Media)',
                    '5. Evaluasi & Refleksi (Laiseg, Laijapen, Supervisi)'
                  ].map((s, idx) => (
                    <div key={idx} className="p-2 bg-white rounded-xl border border-teal-300 font-bold text-teal-900 shadow-2xs">
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              {/* 4 Komponen Besar Layanan BK */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <h4 className="text-sm font-black text-[#0b1c30]">
                  4 Komponen Besar Layanan Bimbingan & Konseling (BSKAP):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BSKAP_4_KOMPONEN_LAYANAN.map((k) => (
                    <div key={k.id} className="p-4 bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-black text-[#00685f]">{k.nama}</h5>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {k.alokasi}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#3d4947] font-semibold">{k.sifat}</p>
                      <p className="text-[11px] text-gray-600 leading-relaxed">{k.deskripsi}</p>
                      <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-1">
                        {k.fokusMateri.map((f, i) => (
                          <span key={i} className="text-[9px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RIASEC CAREER ASSESSMENT */}
          {activeTab === 'riasec' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#f8faf9] p-4 rounded-2xl border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#00685f]/10 text-[#00685f] rounded-xl">
                    <Brain className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#0b1c30]">
                      Pemetaan Minat, Bakat, & Karir RIASEC (John Holland)
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">
                      Lampiran 10 Juknis BSKAP 2022 • Penentuan Mata Pelajaran Pilihan & Studi Lanjut
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportRiasecPdf}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#00685f] text-white rounded-xl text-xs font-bold shadow-2xs hover:bg-[#005049] transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak Laporan RIASEC (PDF)</span>
                  </button>
                </div>
              </div>

              {/* Data Siswa Pengisi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1">Nama Siswa:</label>
                  <input
                    type="text"
                    value={riasecStudentName}
                    onChange={(e) => setRiasecStudentName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#f8faf9] border border-gray-200 rounded-lg outline-none font-bold text-[#0b1c30]"
                    placeholder="Nama peserta didik..."
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1">Kelas / Fase:</label>
                  <input
                    type="text"
                    value={riasecClass}
                    onChange={(e) => setRiasecClass(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#f8faf9] border border-gray-200 rounded-lg outline-none font-bold text-[#0b1c30]"
                    placeholder="Contoh: Kelas 9A / Fase D"
                  />
                </div>
              </div>

              {/* Subtabs RIASEC */}
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                <button
                  onClick={() => setRiasecSubTab('instrumen1')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    riasecSubTab === 'instrumen1' ? 'bg-[#00685f] text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Instrumen 1: 42 Butir Minat ({Object.values(minatAnswers).filter(Boolean).length} dipilih)
                </button>
                <button
                  onClick={() => setRiasecSubTab('instrumen2')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    riasecSubTab === 'instrumen2' ? 'bg-[#00685f] text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Instrumen 2: 24 Keterampilan Unggulan ({Object.values(skillAnswers).filter(Boolean).length} dipilih)
                </button>
                <button
                  onClick={() => setRiasecSubTab('hasil')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    riasecSubTab === 'hasil' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  Hasil Kode Holland: {riasecScores.hollandCode}
                </button>
              </div>

              {/* Form Instrumen 1 */}
              {riasecSubTab === 'instrumen1' && (
                <div className="space-y-3">
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 font-medium">
                    Beri tanda centang pada pernyataan yang <strong>KAMU SUKA</strong> (bukan yang hanya bisa kamu lakukan).
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto p-1">
                    {RIASEC_MINAT_QUESTIONS.map((q) => {
                      const checked = Boolean(minatAnswers[q.id]);
                      return (
                        <label
                          key={q.id}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                            checked
                              ? 'bg-[#f4fffc] border-[#00685f] shadow-2xs'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setMinatAnswers((prev) => ({ ...prev, [q.id]: e.target.checked }))
                            }
                            className="mt-0.5 rounded text-[#00685f] focus:ring-[#00685f]"
                          />
                          <span className="text-xs text-[#0b1c30] font-semibold leading-snug">
                            {q.id}. {q.text}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Form Instrumen 2 */}
              {riasecSubTab === 'instrumen2' && (
                <div className="space-y-3">
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 font-medium">
                    Pilih 8 hal dari daftar berikut yang kamu rasa <strong>PALING BISA DILAKUKAN</strong> tanpa kesulitan.
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {RIASEC_KETERAMPILAN_ITEMS.map((k) => {
                      const checked = Boolean(skillAnswers[k.id]);
                      return (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() =>
                            setSkillAnswers((prev) => ({ ...prev, [k.id]: !prev[k.id] }))
                          }
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            checked
                              ? 'bg-purple-700 text-white border-purple-700 shadow-2xs'
                              : 'bg-white border-gray-200 hover:bg-purple-50/50 text-gray-700'
                          }`}
                        >
                          <span className="text-xs font-bold leading-tight">{k.label}</span>
                          <span className={`text-[10px] mt-1 font-bold ${checked ? 'text-purple-200' : 'text-gray-400'}`}>
                            [{k.type}] {k.category}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Hasil Skor & Rekomendasi Karir */}
              {riasecSubTab === 'hasil' && (
                <div className="space-y-5">
                  {/* Hexagon Scores Summary */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[
                      { code: 'R', label: 'Realistic', color: 'bg-rose-500' },
                      { code: 'I', label: 'Investigative', color: 'bg-blue-500' },
                      { code: 'A', label: 'Artistic', color: 'bg-amber-500' },
                      { code: 'S', label: 'Social', color: 'bg-emerald-500' },
                      { code: 'E', label: 'Enterprising', color: 'bg-purple-500' },
                      { code: 'C', label: 'Conventional', color: 'bg-slate-600' },
                    ].map((item) => {
                      const score = riasecScores.scores[item.code as 'R'];
                      return (
                        <div key={item.code} className="p-3 bg-white border border-gray-200 rounded-xl text-center shadow-2xs">
                          <div className={`w-8 h-8 rounded-full ${item.color} text-white font-black mx-auto flex items-center justify-center text-xs mb-1`}>
                            {item.code}
                          </div>
                          <div className="text-base font-black text-[#0b1c30]">{score} Poin</div>
                          <div className="text-[10px] text-gray-500 font-bold">{item.label}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 3 Dominant Interpretations */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#0b1c30]">
                      3 Dimensi Minat Terbesar & Rekomendasi Masa Depan:
                    </h4>
                    {riasecScores.sortedTypes.slice(0, 3).map((code, idx) => {
                      const interp = RIASEC_INTERPRETATIONS[code];
                      return (
                        <div key={code} className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-black text-[#00685f]">
                              {idx + 1}. [{code}] {interp.title}
                            </h5>
                            <span className="text-xs font-bold text-gray-400">
                              Skor: {riasecScores.scores[code]} Poin
                            </span>
                          </div>
                          <p className="text-xs text-gray-700 font-medium">{interp.tagline}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100">
                            <div>
                              <strong className="text-gray-900 block mb-0.5">Rekomendasi Profesi:</strong>
                              <p className="text-gray-600">{interp.profesiPendukung.join(', ')}</p>
                            </div>
                            <div>
                              <strong className="text-gray-900 block mb-0.5">Mapel Pilihan / Jurusan:</strong>
                              <p className="text-teal-700 font-semibold">{interp.mapelPilihanRekomendasi.join(', ')}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SEGITIGA RESTITUSI & 5 POSISI KONTROL */}
          {activeTab === 'restitusi' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Intro Banner */}
              <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-[#00685f] text-white rounded-xl shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#0b1c30]">
                      Disiplin Positif & Segitiga Restitusi (Kurikulum Merdeka)
                    </h3>
                    <p className="text-xs text-[#3d4947] mt-1 leading-relaxed font-medium">
                      Dalam panduan BK terbaru, penanganan perilaku bukan lagi berfokus pada penghakiman, hukuman fisik, atau sekadar pemotongan poin. Pendekatan <strong>Segitiga Restitusi</strong> (Diana Gossen & William Glasser) membimbing murid mengenali keyakinan kelas, memvalidasi kebutuhan dasar, dan menciptakan solusi pemulihan bertanggung jawab.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3 Langkah Segitiga Restitusi */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#00685f]">
                  3 Tahapan Segitiga Restitusi (Restitution Triangle):
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {SEGITIGA_RESTITUSI_STEPS.map((s, idx) => (
                    <div key={idx} className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-full bg-[#00685f] text-white text-xs font-black flex items-center justify-center shrink-0">
                            {s.step}
                          </span>
                          <h5 className="text-xs font-black text-[#0b1c30]">{s.title}</h5>
                        </div>
                        <p className="text-[11px] text-gray-600 font-medium leading-relaxed mb-3">
                          {s.tujuan}
                        </p>
                      </div>
                      <div className="bg-teal-50/60 p-3 rounded-xl border border-teal-100 text-[11px] space-y-1">
                        <strong className="text-[#00685f] block text-[10px] uppercase tracking-wider">
                          Contoh Tuturan Guru BK / Konselor:
                        </strong>
                        {s.contohKalimat.map((k, i) => (
                          <p key={i} className="text-gray-700 italic">• "{k}"</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5 Posisi Kontrol Guru Glasser */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-purple-900">
                    5 Posisi Kontrol Guru Pembimbing (Control Theory - Dr. William Glasser):
                  </h4>
                  <span className="text-[11px] font-bold text-[#00685f] bg-[#e6f4f1] px-2.5 py-1 rounded-full">
                    Target Utama Guru BK: Manajer
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  {LIMA_POSISI_KONTROL.map((pk, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        pk.posisi === 'Manajer (Posisi Ideal Guru BK)'
                          ? 'bg-teal-50 border-[#00685f] ring-2 ring-[#00685f]/20 shadow-xs'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400">Posisi {idx + 1}</span>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                            pk.kategori.includes('Sangat')
                              ? 'bg-[#00685f] text-white'
                              : pk.kategori.includes('Baik')
                              ? 'bg-emerald-100 text-emerald-800'
                              : pk.kategori.includes('Transisi')
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {pk.kategori}
                        </span>
                      </div>
                      <h5 className="font-extrabold text-[#0b1c30] text-xs">{pk.posisi}</h5>
                      <p className="text-[11px] text-gray-600 leading-relaxed font-medium">{pk.ciri}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lampiran 1 BSKAP: Alur Refleksi Sebab-Akibat & Konseling Humanistik */}
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4">
                  <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider mb-1">
                    Lampiran 1 BSKAP: {BSKAP_LAMPIRAN_1_SEBAB_AKIBAT.judul}
                  </h4>
                  <p className="text-[11px] text-amber-900 mb-3">
                    Bagan alur reflektif saat murid melanggar aturan dan panduan dialog konseling berbasis humanistik:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs mb-3">
                    {BSKAP_LAMPIRAN_1_SEBAB_AKIBAT.tahapanAlur.map((al) => (
                      <div key={al.step} className="p-2.5 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                        <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-black text-[10px] flex items-center justify-center">
                          {al.step}
                        </span>
                        <p className="text-[10px] font-bold text-gray-800 leading-tight">{al.text}</p>
                      </div>
                    ))}
                  </div>

                  {/* 6 Pertanyaan Kunci Pemetaan Sebab Akibat */}
                  <div className="bg-white p-3.5 rounded-xl border border-amber-200">
                    <h5 className="text-[11px] font-black text-amber-900 uppercase tracking-wider mb-2">
                      Pertanyaan Panduan Pemetaan Sebab - Akibat:
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {BSKAP_LAMPIRAN_1_SEBAB_AKIBAT.pertanyaanKunci.map((pk, idx) => (
                        <div key={idx} className="p-2 bg-amber-50/40 rounded-lg border border-amber-100 text-[11px]">
                          <span className="font-extrabold text-[#00685f] block text-[10px] uppercase">{pk.label}</span>
                          <span className="text-gray-700 italic">"{pk.pertanyaan}"</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lampiran 3 BSKAP: 7 Tahap Konseling Reality Therapy Glasser (1965) */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#00685f]">
                  Lampiran 3 BSKAP: 7 Tahap Refleksi Konseling Reality Therapy (Glasser, 1965):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  {BSKAP_LAMPIRAN_3_GLASSER.map((g) => (
                    <div key={g.tahap} className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#00685f] text-white text-[10px] font-black flex items-center justify-center">
                          {g.tahap}
                        </span>
                        <h5 className="text-xs font-bold text-[#0b1c30]">{g.nama}</h5>
                      </div>
                      <p className="text-[10px] text-gray-600 leading-relaxed font-medium">{g.penjelasan}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lampiran 2 BSKAP: Lembar Rencana Aksi */}
              <div className="p-4 bg-teal-50/40 border border-teal-200 rounded-2xl space-y-2">
                <h4 className="text-xs font-black text-[#00685f] uppercase tracking-wider">
                  Lampiran 2 BSKAP: {BSKAP_LAMPIRAN_2_RENCANA_AKSI.judul}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-gray-700">Langkah Penggunaan:</p>
                    {BSKAP_LAMPIRAN_2_RENCANA_AKSI.instruksi.map((ins, i) => (
                      <p key={i} className="text-[10px] text-gray-600 leading-tight">• {ins}</p>
                    ))}
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-teal-200 space-y-1">
                    <p className="text-[11px] font-bold text-[#00685f]">4 Pertanyaan Kunci Rencana Aksi:</p>
                    {BSKAP_LAMPIRAN_2_RENCANA_AKSI.pertanyaanAksi.map((pa, i) => (
                      <p key={i} className="text-[10px] font-medium text-gray-700">✓ {pa}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BAGAN ANALISIS SITUASI (LAMPIRAN 7) */}
          {activeTab === 'analisis_responsif' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-50/50 p-4 rounded-2xl border border-purple-200">
                <div>
                  <h3 className="text-sm font-black text-purple-950">
                    Bagan Analisis Situasi Layanan Responsif (Satu Halaman)
                  </h3>
                  <p className="text-xs text-purple-800 font-medium">
                    Lampiran 7 Juknis BSKAP 2022 • Koordinasi Terpadu Guru BK, Wali Kelas, dan Orang Tua
                  </p>
                </div>
                <button
                  onClick={exportAnalisisPdf}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-700 text-white rounded-xl text-xs font-bold shadow-2xs hover:bg-purple-800 transition-all cursor-pointer shrink-0"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Bagan Analisis (PDF)</span>
                </button>
              </div>

              {/* Form Isian Bagan Analisis Situasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#00685f]">
                    1. Identitas & Faktor Internal/Eksternal
                  </h4>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Nama Peserta Didik & Kelas:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={analisisData.namaSiswa}
                        onChange={(e) => setAnalisisData({ ...analisisData, namaSiswa: e.target.value })}
                        placeholder="Nama siswa..."
                        className="flex-1 px-3 py-1.5 text-xs bg-[#f8faf9] border border-gray-200 rounded-lg outline-none font-bold"
                      />
                      <input
                        type="text"
                        value={analisisData.kelas}
                        onChange={(e) => setAnalisisData({ ...analisisData, kelas: e.target.value })}
                        placeholder="Kelas..."
                        className="w-24 px-3 py-1.5 text-xs bg-[#f8faf9] border border-gray-200 rounded-lg outline-none font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Faktor Internal (Fisik, Emosi, Kognitif):</label>
                    <textarea
                      rows={2}
                      value={analisisData.faktorInternal}
                      onChange={(e) => setAnalisisData({ ...analisisData, faktorInternal: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-[#f8faf9] border border-gray-200 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Faktor Eksternal Rumah & Keluarga:</label>
                    <textarea
                      rows={2}
                      value={analisisData.faktorEksternalRumah}
                      onChange={(e) => setAnalisisData({ ...analisisData, faktorEksternalRumah: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-[#f8faf9] border border-gray-200 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Faktor Eksternal Sekolah & Teman Sebaya:</label>
                    <textarea
                      rows={2}
                      value={analisisData.faktorEksternalSekolah}
                      onChange={(e) => setAnalisisData({ ...analisisData, faktorEksternalSekolah: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-[#f8faf9] border border-gray-200 rounded-lg outline-none"
                    />
                  </div>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-purple-700">
                    2. Pola Perilaku, Dampak & Harapan Target
                  </h4>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Perilaku Positif / Kekuatan (+):</label>
                    <input
                      type="text"
                      value={analisisData.perilakuPositif}
                      onChange={(e) => setAnalisisData({ ...analisisData, perilakuPositif: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-[#f8faf9] border border-gray-200 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Pokok Permasalahan / Perilaku Kerap Muncul (-):</label>
                    <input
                      type="text"
                      value={analisisData.perilakuNegatif}
                      onChange={(e) => setAnalisisData({ ...analisisData, perilakuNegatif: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-[#f8faf9] border border-gray-200 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Dampak Perilaku & Dugaan Penyebab:</label>
                    <textarea
                      rows={2}
                      value={analisisData.dampak}
                      onChange={(e) => setAnalisisData({ ...analisisData, dampak: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-[#f8faf9] border border-gray-200 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Harapan / Target Perbaikan:</label>
                    <input
                      type="text"
                      value={analisisData.harapanJangkaPendek}
                      onChange={(e) => setAnalisisData({ ...analisisData, harapanJangkaPendek: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-[#f8faf9] border border-gray-200 rounded-lg outline-none"
                      placeholder="Jangka pendek..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TRIASE PEMETAAN MASALAH (LAMPIRAN 6) */}
          {activeTab === 'triase_situasi' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-[#f8faf9] border border-gray-200 rounded-2xl p-4">
                <h3 className="text-sm font-black text-[#0b1c30] mb-1">
                  Kriteria Status Situasi Khusus Murid (Sistem Triase Warna BK)
                </h3>
                <p className="text-xs text-gray-600 font-medium">
                  Lampiran 6 Juknis BSKAP 2022 • Bertujuan memfokuskan alokasi waktu dan intensitas pendampingan, <em>bukan melabeli murid</em>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* ZONA HIJAU */}
                <div className="p-4 bg-emerald-50/60 border border-emerald-300 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-600"></span>
                    <h4 className="text-sm font-black text-emerald-950">ZONA HIJAU (Insidental)</h4>
                  </div>
                  <ul className="text-xs text-emerald-900 space-y-1.5 font-medium">
                    <li>• <strong>Peserta Didik:</strong> Perkembangan secara umum baik, hanya 1 aspek ringan terhambat dan cepat ditangani.</li>
                    <li>• <strong>Dinamika Kelas:</strong> Tidak banyak terpengaruh.</li>
                    <li>• <strong>Penanganan:</strong> Ditangani melalui program kelas rutin & obrolan ringan guru mapel/wali kelas.</li>
                    <li>• <strong>Pendamping:</strong> Wali kelas / Guru lain berkonsultasi santai dengan Guru BK.</li>
                  </ul>
                </div>

                {/* ZONA KUNING */}
                <div className="p-4 bg-amber-50/60 border border-amber-300 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-amber-600"></span>
                    <h4 className="text-sm font-black text-amber-950">ZONA KUNING (Sering Muncul)</h4>
                  </div>
                  <ul className="text-xs text-amber-900 space-y-1.5 font-medium">
                    <li>• <strong>Peserta Didik:</strong> Aspek mendasar mulai mempengaruhi aspek lain, perubahan belum konsisten.</li>
                    <li>• <strong>Dinamika Kelas:</strong> Perlu pengkondisian & kesepakatan aturan khusus.</li>
                    <li>• <strong>Penanganan:</strong> Perlu konseling individual / kelompok terencana secara khusus.</li>
                    <li>• <strong>Pendamping:</strong> Pegangan khusus & pemantauan berkala Guru BK.</li>
                  </ul>
                </div>

                {/* ZONA MERAH */}
                <div className="p-4 bg-rose-50/60 border border-rose-300 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-rose-600"></span>
                    <h4 className="text-sm font-black text-rose-950">ZONA MERAH (Konsisten/Berat)</h4>
                  </div>
                  <ul className="text-xs text-rose-900 space-y-1.5 font-medium">
                    <li>• <strong>Peserta Didik:</strong> Aspek mendasar sangat terhambat, perkembangan lambat atau bahkan mundur drastis.</li>
                    <li>• <strong>Dinamika Kelas:</strong> Sangat mengganggu atau berisiko membahayakan iklim kelas.</li>
                    <li>• <strong>Penanganan:</strong> Perhatian intensif darurat & konferensi kasus.</li>
                    <li>• <strong>Pendamping:</strong> Ajuan referal / alih tangan kasus ke psikolog klinis / dokter / dinas terkait.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: PPKSP PERMENDIKBUDRISTEK 46/2023 & ALUR TPPK */}
          {activeTab === 'ppksp' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-black text-rose-950">
                      Pencegahan & Penanganan Kekerasan di Lingkungan Satuan Pendidikan (PPKSP)
                    </h3>
                    <p className="text-xs text-rose-900/90 font-medium mt-0.5">
                      Berdasarkan {PPKSP_2023_SOP.regulasi}
                    </p>
                  </div>
                </div>
                <div className="bg-white/90 px-3 py-1.5 rounded-xl border border-rose-300 text-xs text-rose-900 font-bold self-start sm:self-auto shrink-0">
                  Hotline SAPA 129: <span className="font-black text-rose-700">{PPKSP_2023_SOP.hotlineSapa129}</span>
                </div>
              </div>

              {/* 6 Bentuk Kekerasan */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">
                  6 Bentuk Kekerasan Menurut Permendikbudristek No. 46/2023:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {PPKSP_2023_SOP.enamBentukKekerasan.map((bk) => (
                    <div key={bk.id} className="p-3.5 bg-white rounded-xl border border-rose-100 shadow-2xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-black text-[10px] flex items-center justify-center">
                          {bk.id}
                        </span>
                        <h5 className="text-xs font-extrabold text-[#0b1c30]">{bk.nama}</h5>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed font-medium">{bk.definisi}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alur Standar SOP TPPK */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#00685f]">
                  5 Tahap Penanganan Kasus oleh Tim TPPK Satuan Pendidikan:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                  {PPKSP_2023_SOP.alurPenangananTppk.map((item) => (
                    <div key={item.step} className="p-3 bg-white rounded-xl border border-teal-200 shadow-2xs space-y-1">
                      <span className="w-5 h-5 rounded-full bg-[#00685f] text-white font-black text-[10px] flex items-center justify-center mb-1">
                        {item.step}
                      </span>
                      <h5 className="text-xs font-extrabold text-[#0b1c30]">{item.title}</h5>
                      <p className="text-[10px] text-gray-600 leading-relaxed font-medium">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tautan Portal Resmi Kemdikbudristek */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold text-gray-700">
                  Layanan Pengaduan & Kanal Resmi Pencegahan Kekerasan:
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={PPKSP_2023_SOP.portalPpkspUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-all"
                  >
                    <span>Portal PPKSP Kemdikbud</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={PPKSP_2023_SOP.portalLaporUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-black transition-all"
                  >
                    <span>Lapor Kemdikbud</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={PPKSP_2023_SOP.portalPuspekaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00685f] text-white rounded-lg text-xs font-bold hover:bg-[#005049] transition-all"
                  >
                    <span>Puspeka Cerdas Berkarakter</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: KEMITRAAN KELUARGA & EPSTEIN */}
          {activeTab === 'kemitraan_keluarga' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-[#f8faf9] border border-gray-200 rounded-2xl p-4">
                <h3 className="text-sm font-black text-[#0b1c30] mb-1">
                  6 Model Pelibatan Orang Tua & Tri Sentra Pendidikan (Joyce Epstein 2009)
                </h3>
                <p className="text-xs text-gray-600 font-medium">
                  Sinergi 3 Wadah Pendidikan: Alam Keluarga, Alam Sekolah, dan Alam Masyarakat.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {EPSTEIN_PARENT_PARTNERSHIP_MODELS.map((m) => (
                  <div key={m.id} className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-2">
                    <h4 className="text-xs font-black text-[#00685f]">{m.title}</h4>
                    <p className="text-[11px] text-gray-600 leading-relaxed font-medium">{m.desc}</p>
                    <div className="pt-2 border-t border-gray-100">
                      <strong className="text-[10px] text-gray-800 uppercase tracking-wider block mb-1">
                        Contoh Aksi Nyata:
                      </strong>
                      <ul className="text-[10px] text-gray-500 space-y-1">
                        {m.activities.map((act, i) => (
                          <li key={i}>• {act}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0 text-xs">
          <span className="text-gray-500 font-medium">
            Rujukan: Buku Panduan Implementasi BK Jenjang Dikdasmen (Kemendikbudristek BSKAP 2022)
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
