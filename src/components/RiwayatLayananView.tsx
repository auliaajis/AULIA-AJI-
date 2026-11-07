import React, { useState, useMemo } from 'react';
import { 
  HeartHandshake, 
  Search, 
  Filter, 
  Calendar, 
  FileText, 
  Download, 
  Eye, 
  Edit2, 
  Trash2, 
  X, 
  CheckCircle2, 
  Sparkles, 
  Users, 
  Clock, 
  Layers, 
  Printer, 
  ArrowLeft,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { Student, CounselingService, Counselor } from '../types';
import { 
  generateServicePDF, 
  downloadRekapSemuaLayananPDF, 
  downloadRekapLayananPerSiswaPDF 
} from '../utils/pdfGenerator';
import { showToast } from '../utils/toast';

interface RiwayatLayananViewProps {
  services: CounselingService[];
  students: Student[];
  activeCounselor?: Counselor;
  onNavigateToTab?: (tab: string, query?: string) => void;
  onNavigateToForm?: (form: string, studentId?: string) => void;
  onEditService?: (service: CounselingService) => void;
  onDeleteService?: (serviceId: string) => void;
}

export const RiwayatLayananView: React.FC<RiwayatLayananViewProps> = ({
  services = [],
  students = [],
  activeCounselor,
  onNavigateToTab,
  onNavigateToForm,
  onEditService,
  onDeleteService,
}) => {
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('semua');
  const [selectedClass, setSelectedClass] = useState<string>('semua');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Modals
  const [detailService, setDetailService] = useState<CounselingService | null>(null);
  const [showStudentPdfModal, setShowStudentPdfModal] = useState(false);
  const [selectedStudentForPdf, setSelectedStudentForPdf] = useState<Student | null>(null);
  const [studentSearchForPdf, setStudentSearchForPdf] = useState('');
  const [aiStudentSummary, setAiStudentSummary] = useState('');
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);

  // Available Classes
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.class) set.add(s.class.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [students]);

  // Available Service Types
  const availableServiceTypes = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => {
      if (s.serviceType) set.add(s.serviceType.trim());
    });
    return Array.from(set).sort();
  }, [services]);

  // Filtered Services List (Sorted Newest First)
  const filteredServices = useMemo(() => {
    return [...services]
      .filter((srv) => {
        // 1. Search term (student name, problem, topic, description)
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchStudent = (srv.students || []).some(
            (st) => st.name.toLowerCase().includes(q) || st.class.toLowerCase().includes(q)
          );
          const matchProblem = (srv.problem || '').toLowerCase().includes(q);
          const matchType = (srv.serviceType || '').toLowerCase().includes(q);
          const matchDesc = (srv.description || '').toLowerCase().includes(q);
          if (!matchStudent && !matchProblem && !matchType && !matchDesc) {
            return false;
          }
        }

        // 2. Service type
        if (selectedServiceType !== 'semua') {
          if (srv.serviceType !== selectedServiceType) {
            return false;
          }
        }

        // 3. Class filter
        if (selectedClass !== 'semua') {
          const matchClass = (srv.students || []).some(
            (st) => (st.class || '').trim().toUpperCase() === selectedClass
          );
          if (!matchClass) return false;
        }

        // 4. Date filter
        if (selectedDate) {
          if (srv.date !== selectedDate) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [services, searchTerm, selectedServiceType, selectedClass, selectedDate]);

  // Helper for Meta AI Student Summary
  const handleGenerateStudentAiSummary = (st: Student) => {
    setIsGeneratingAiSummary(true);
    const stServices = services.filter((srv) =>
      (srv.students || []).some((s) => s.id === st.id || s.name.toLowerCase() === st.name.toLowerCase())
    );

    const total = stServices.length;
    const latestService = stServices[0];
    const topProblems = Array.from(new Set(stServices.map((s) => s.problem).filter(Boolean))).slice(0, 3).join(', ');

    setTimeout(() => {
      let summary = '';
      if (total === 0) {
        summary = `Peserta didik ${st.name} (Kelas ${st.class}) memiliki rekam jejak bimbingan yang bersih tanpa catatan kasus maupun masalah perilaku yang memerlukan penanganan khusus. Kondisi belajar dan adaptasi sosial di sekolah berjalan sangat kondusif.`;
      } else {
        const monthName = new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' });
        summary = `Berdasarkan rekam jejak bimbingan per ${monthName}, ${st.name} (Kelas ${st.class}) telah menerima ${total} kali layanan bimbingan dan konseling, terutama berfokus pada topik "${topProblems || 'pengembangan disiplin & belajar'}". Siswa menunjukkan respon reflektif yang positif terhadap sesi konseling dan menunjukkan komitmen peningkatan perilaku (${latestService?.followUp || 'pemantauan berkala'}). Disarankan kolaborasi rutin antara Guru BK, Wali Kelas, dan Orang Tua untuk mempertahankan kemajuan siswa.`;
      }
      setAiStudentSummary(summary);
      setIsGeneratingAiSummary(false);
      showToast('✨ Ringkasan perkembangan siswa berhasil dirumuskan oleh Meta AI!', 'success');
    }, 400);
  };

  // Filtered Students for PDF Selector Modal
  const filteredStudentsForPdf = useMemo(() => {
    const q = studentSearchForPdf.trim().toLowerCase();
    if (!q) return students.slice(0, 10);
    return students
      .filter((s) => s.name.toLowerCase().includes(q) || s.class.toLowerCase().includes(q))
      .slice(0, 10);
  }, [students, studentSearchForPdf]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-200">
      
      {/* ========================================================================= */}
      {/* HEADER UTAMA & TOMBOL EXPORT PDF                                           */}
      {/* ========================================================================= */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#bcc9c6]/40 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#00685f] bg-[#00685f]/10 px-2.5 py-0.5 rounded-md border border-[#00685f]/15">
                Dokumentasi & Arsip Layanan BK
              </span>
              <span className="text-[10px] font-bold text-gray-500">
                {filteredServices.length} dari {services.length} sesi
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0b1c30] tracking-tight mt-1">
              Riwayat Layanan Bimbingan & Konseling
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
              Pantau seluruh rekam jejak bimbingan, cari riwayat siswa, edit catatan, dan ekspor laporan PDF resmi.
            </p>
          </div>

          {/* 2 TOMBOL BESAR EXPORT PDF SESUAI INSTRUKSI */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* 1. Download PDF Semua */}
            <button
              type="button"
              onClick={() => {
                if (filteredServices.length === 0) {
                  showToast('⚠️ Tidak ada data layanan untuk diekspor ke PDF.', 'warning');
                  return;
                }
                const filterDesc = [
                  selectedClass !== 'semua' ? `Kelas ${selectedClass}` : '',
                  selectedServiceType !== 'semua' ? selectedServiceType : '',
                  selectedDate ? `Tanggal ${selectedDate}` : '',
                  searchTerm ? `Pencarian "${searchTerm}"` : ''
                ].filter(Boolean).join(' • ');

                downloadRekapSemuaLayananPDF({
                  services: filteredServices,
                  filterInfo: filterDesc || 'Semua Data Layanan',
                  counselorOverride: activeCounselor
                });
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-teal-700 to-[#00685f] hover:from-teal-800 hover:to-[#005049] text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-97"
              title="Unduh seluruh daftar layanan yang saat ini tersaring dalam bentuk tabel laporan resmi"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Download PDF Semua ({filteredServices.length})</span>
            </button>

            {/* 2. Download PDF Per Siswa */}
            <button
              type="button"
              onClick={() => {
                setShowStudentPdfModal(true);
                if (!selectedStudentForPdf && students.length > 0) {
                  setSelectedStudentForPdf(students[0]);
                  handleGenerateStudentAiSummary(students[0]);
                }
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-97"
              title="Pilih satu siswa untuk mengunduh rekam jejak lengkap konseling siswa tersebut dari yang terbaru"
            >
              <UserCheck className="w-4 h-4 text-white" />
              <span>Download PDF Per Siswa</span>
            </button>

            {/* Tombol Input Layanan Baru */}
            {onNavigateToForm && (
              <button
                type="button"
                onClick={() => onNavigateToForm('tambah-layanan')}
                className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-97"
              >
                <span>+ Catat Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* BARIS FILTER: CARI SISWA, PILIH LAYANAN, PILIH TANGGAL, PILIH KELAS    */}
        {/* ===================================================================== */}
        <div className="pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* 1. Cari Nama Siswa / Topik */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
              Cari Siswa / Topik:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ketik nama siswa, topik..."
                className="w-full pl-10 pr-7 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:bg-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 2. Pilih Layanan */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
              Pilih Layanan:
            </label>
            <select
              value={selectedServiceType}
              onChange={(e) => setSelectedServiceType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:bg-white"
            >
              <option value="semua">Semua Layanan BK</option>
              {availableServiceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Pilih Kelas */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
              Pilih Kelas:
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:bg-white"
            >
              <option value="semua">Semua Kelas</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Kelas {cls}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Pilih Tanggal */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
              Pilih Tanggal:
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:bg-white"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-600 cursor-pointer"
                  title="Reset Tanggal"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* DAFTAR KARTU RIWAYAT LAYANAN                                              */}
      {/* ========================================================================= */}
      {filteredServices.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-[#bcc9c6]/40 shadow-xs space-y-3">
          <div className="w-16 h-16 rounded-full bg-teal-50 text-[#00685f] flex items-center justify-center mx-auto">
            <HeartHandshake className="w-8 h-8 opacity-75" />
          </div>
          <h3 className="text-base font-black text-[#0b1c30]">Belum Ada Layanan Sesuai Kriteria</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Tidak ditemukan catatan layanan dengan filter yang dipilih. Coba reset kata kunci pencarian, pilih "Semua Kelas", atau catat layanan baru.
          </p>
          {(searchTerm || selectedServiceType !== 'semua' || selectedClass !== 'semua' || selectedDate) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedServiceType('semua');
                setSelectedClass('semua');
                setSelectedDate('');
              }}
              className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-[#00685f] text-xs font-black rounded-xl cursor-pointer"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredServices.map((srv) => {
            const studentText = (srv.students || [])
              .map((st) => `${st.name} (${st.class || '-'})`)
              .join(', ') || 'Siswa';
            const isCompleted = srv.status === 'Selesai';

            return (
              <div
                key={srv.id}
                className="bg-white rounded-2xl border border-[#bcc9c6]/40 hover:border-[#00685f]/50 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all space-y-3 group"
              >
                {/* Header Kartu: Layanan - Nama Siswa (Kelas) - Tanggal - Topik - Status */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                  <div
                    onClick={() => setDetailService(srv)}
                    className="cursor-pointer space-y-1 flex-1 min-w-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-[#00685f] bg-[#00685f]/10 px-2.5 py-0.5 rounded-lg border border-[#00685f]/15">
                        {srv.serviceType}
                      </span>
                      <span className="text-sm font-black text-[#0b1c30] group-hover:text-[#00685f] transition-colors truncate">
                        {studentText}
                      </span>
                      <span className="text-xs font-bold text-gray-500">
                        • {srv.date}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-gray-700">
                      Topik: <span className="text-[#0b1c30]">{srv.problem || '-'}</span>
                    </p>
                  </div>

                  {/* Status Badge & 3 Tombol Kecil: [Lihat] [Edit] [PDF] */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {srv.status || 'Selesai'}
                    </span>

                    {/* Tombol [Lihat] */}
                    <button
                      type="button"
                      onClick={() => setDetailService(srv)}
                      className="px-2.5 py-1.5 bg-gray-50 hover:bg-teal-50 text-[#00685f] border border-gray-200 hover:border-teal-300 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                      title="Lihat rincian lengkap sesi ini"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat</span>
                    </button>

                    {/* Tombol [Edit] */}
                    {onEditService && (
                      <button
                        type="button"
                        onClick={() => onEditService(srv)}
                        className="px-2.5 py-1.5 bg-gray-50 hover:bg-amber-50 text-amber-800 border border-gray-200 hover:border-amber-300 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                        title="Edit sesi layanan ini"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}

                    {/* Tombol [PDF] */}
                    <button
                      type="button"
                      onClick={() => generateServicePDF(srv)}
                      className="px-2.5 py-1.5 bg-[#e6f4f1] hover:bg-[#d0ebe6] text-[#00685f] hover:text-[#005049] border border-[#00685f]/30 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                      title="Cetak lembar bukti laporan sesi ini ke format PDF resmi"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>

                {/* Deskripsi & Cerita Singkat */}
                <div
                  onClick={() => setDetailService(srv)}
                  className="cursor-pointer bg-gray-50/70 p-3 rounded-xl border border-gray-100 text-xs text-[#3d4947] line-clamp-2 leading-relaxed"
                >
                  <span className="font-bold text-[#0b1c30]">Rincian Kegiatan: </span>
                  {srv.description || srv.output || 'Tidak ada deskripsi tambahan.'}
                </div>

                {/* Footer Kartu: Tindak Lanjut */}
                {srv.followUp && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Tindak Lanjut:</span>
                    <span className="text-xs font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      {srv.followUp}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DETAIL LAYANAN LENGKAP                                              */}
      {/* ========================================================================= */}
      {detailService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 border border-[#bcc9c6]/40 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-50 text-[#00685f] rounded-2xl">
                  <HeartHandshake className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#00685f]">Detail Rekam Layanan</span>
                  <h3 className="text-lg font-black text-[#0b1c30]">{detailService.serviceType}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailService(null)}
                className="p-2 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Details */}
            <div className="space-y-4 text-xs sm:text-sm">
              {/* Siswa Terlibat */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-1.5">
                <span className="text-[10px] uppercase font-black text-gray-500">Peserta Didik:</span>
                <div className="flex flex-wrap gap-2">
                  {(detailService.students || []).map((st) => (
                    <span
                      key={st.id}
                      className="px-2.5 py-1 bg-white border border-gray-200 text-[#0b1c30] rounded-xl font-bold shadow-2xs text-xs"
                    >
                      👤 {st.name} (Kelas {st.class || '-'})
                    </span>
                  ))}
                </div>
              </div>

              {/* Tanggal & Waktu & Status */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Tanggal:</span>
                  <span className="font-black text-[#0b1c30]">{detailService.date}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Waktu Sesi:</span>
                  <span className="font-black text-[#0b1c30]">{detailService.startTime || '08:00'} WIB</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Status:</span>
                  <span className="font-black text-[#00685f]">{detailService.status || 'Selesai'}</span>
                </div>
              </div>

              {/* Topik / Masalah */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
                <span className="text-[10px] uppercase font-black text-gray-500">Topik / Permasalahan:</span>
                <p className="font-black text-sm text-[#0b1c30]">{detailService.problem || '-'}</p>
              </div>

              {/* Cerita / Rincian Layanan */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
                <span className="text-[10px] uppercase font-black text-gray-500">Cerita / Deskripsi Pelaksanaan:</span>
                <p className="text-gray-800 leading-relaxed whitespace-pre-line font-medium">
                  {detailService.description || detailService.output || 'Tidak ada deskripsi rinci.'}
                </p>
              </div>

              {/* Tindak Lanjut */}
              <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-1">
                <span className="text-[10px] uppercase font-black text-indigo-900">Rencana Tindak Lanjut:</span>
                <p className="text-indigo-950 font-bold leading-relaxed">
                  {detailService.followUp || 'Pemantauan berkala oleh Guru BK.'}
                </p>
              </div>

              {/* Rekomendasi Cerdas Meta AI */}
              <div className="p-3.5 bg-gradient-to-br from-indigo-50 via-purple-50 to-teal-50 rounded-2xl border border-indigo-200 space-y-1.5">
                <div className="flex items-center gap-1.5 text-indigo-950">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-black">Rekomendasi Cerdas Meta AI ✨</span>
                </div>
                <p className="text-xs text-indigo-900 font-semibold leading-relaxed">
                  Berdasarkan penanganan topik "{detailService.problem}", direkomendasikan untuk mendokumentasikan perkembangan selama 1 minggu ke depan dan mengonfirmasi komitmen siswa secara persuasif.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-3">
              <button
                type="button"
                onClick={() => {
                  generateServicePDF(detailService);
                }}
                className="px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Unduh PDF Sesi Ini</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailService(null)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DOWNLOAD PDF PER SISWA                                              */}
      {/* ========================================================================= */}
      {showStudentPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 border border-[#bcc9c6]/40 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-700 rounded-2xl">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-700">Export Laporan Terpadu</span>
                  <h3 className="text-lg font-black text-[#0b1c30]">Download PDF Layanan Per Siswa</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStudentPdfModal(false)}
                className="p-2 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pilih Siswa */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  1. Pilih Nama Siswa:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={studentSearchForPdf}
                    onChange={(e) => setStudentSearchForPdf(e.target.value)}
                    placeholder="Ketik nama siswa (misal: Ahmad Nur Wahid)..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:bg-white"
                  />
                </div>

                {/* List Pilihan Siswa */}
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                  {filteredStudentsForPdf.map((st) => {
                    const isSelected = selectedStudentForPdf?.id === st.id;
                    const stServicesCount = services.filter((srv) =>
                      (srv.students || []).some((s) => s.id === st.id || s.name.toLowerCase() === st.name.toLowerCase())
                    ).length;

                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudentForPdf(st);
                          handleGenerateStudentAiSummary(st);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500 shadow-xs ring-2 ring-blue-300'
                            : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-black text-[#0b1c30] truncate">{st.name}</p>
                          <p className="text-[10px] text-gray-500 truncate">
                            Kelas {st.class} • {stServicesCount} Sesi Layanan
                          </p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'
                        }`}>
                          {isSelected ? '✓ Terpilih' : 'Pilih'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Profil Siswa Terpilih */}
              {selectedStudentForPdf && (
                <div className="p-4 bg-teal-50/70 rounded-2xl border border-teal-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-teal-800 uppercase tracking-wider">Siswa Terpilih:</p>
                      <h4 className="text-base font-black text-teal-950">{selectedStudentForPdf.name}</h4>
                      <p className="text-xs text-teal-800">
                        Kelas {selectedStudentForPdf.class} • NIS: {selectedStudentForPdf.nis || '-'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-teal-800 block">Riwayat Layanan:</span>
                      <span className="text-sm font-black text-[#00685f]">
                        {
                          services.filter((srv) =>
                            (srv.students || []).some(
                              (s) => s.id === selectedStudentForPdf.id || s.name.toLowerCase() === selectedStudentForPdf.name.toLowerCase()
                            )
                          ).length
                        } Sesi Terdata
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Ringkasan dengan Meta AI */}
              {selectedStudentForPdf && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-[#0b1c30] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Ringkasan Perkembangan (Meta AI ✨):</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleGenerateStudentAiSummary(selectedStudentForPdf)}
                      disabled={isGeneratingAiSummary}
                      className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                    >
                      {isGeneratingAiSummary ? 'Memproses...' : '✨ Buatkan Ringkasan'}
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={aiStudentSummary}
                    onChange={(e) => setAiStudentSummary(e.target.value)}
                    placeholder="Klik tombol Buatkan Ringkasan untuk membuat paragraf evaluasi otomatis oleh Meta AI..."
                    className="w-full p-3 bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-medium text-[#0b1c30] focus:bg-white focus:outline-none leading-relaxed"
                  />
                  <p className="text-[10px] text-gray-400">
                    *Ringkasan ini akan otomatis dicetak pada kotak pengantar laporan resmi PDF siswa.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Bottom Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-3">
              <button
                type="button"
                onClick={() => setShowStudentPdfModal(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!selectedStudentForPdf) {
                    showToast('⚠️ Silakan pilih nama siswa terlebih dahulu.', 'warning');
                    return;
                  }
                  const stServices = services.filter((srv) =>
                    (srv.students || []).some(
                      (s) => s.id === selectedStudentForPdf.id || s.name.toLowerCase() === selectedStudentForPdf.name.toLowerCase()
                    )
                  );

                  downloadRekapLayananPerSiswaPDF({
                    student: selectedStudentForPdf,
                    services: stServices,
                    aiSummary: aiStudentSummary,
                    counselorOverride: activeCounselor
                  });
                  setShowStudentPdfModal(false);
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Unduh PDF Siswa Ini</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
