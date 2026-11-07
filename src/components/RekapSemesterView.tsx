import React, { useState, useMemo } from 'react';
import { 
  FileBarChart, 
  Calendar, 
  Download, 
  Users, 
  Clock, 
  CheckCircle2, 
  ArrowLeft, 
  BookOpen, 
  HeartHandshake, 
  Home, 
  AlertTriangle,
  FileText,
  Building2,
  Sparkles,
  Layers,
  ChevronRight
} from 'lucide-react';
import { CounselingService, Counselor, Student } from '../types';
import { downloadRekapSemesterPDF } from '../utils/pdfGenerator';
import { getSchoolConfig } from '../utils/schoolConfig';
import { showToast } from '../utils/toast';

interface RekapSemesterViewProps {
  services: CounselingService[];
  activeCounselor: Counselor;
  students: Student[];
  onBack?: () => void;
}

export default function RekapSemesterView({
  services,
  activeCounselor,
  students,
  onBack,
}: RekapSemesterViewProps) {
  // Current month detection: July-Dec is Ganjil, Jan-June is Genap
  const currentMonth = new Date().getMonth() + 1;
  const defaultSemester: 'Ganjil' | 'Genap' = currentMonth >= 7 ? 'Ganjil' : 'Genap';

  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>(defaultSemester);
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState<string>('2026/2027');
  const [hasGenerated, setHasGenerated] = useState<boolean>(true);

  // Available school year options
  const tahunAjaranOptions = ['2026/2027', '2025/2026', '2024/2025'];

  // Filter ONLY current active counselor's services within the selected semester date range
  const semesterData = useMemo(() => {
    const parts = selectedTahunAjaran.split('/');
    const startYear = parseInt(parts[0], 10) || 2026;
    const endYear = parseInt(parts[1], 10) || 2027;

    const startDate = selectedSemester === 'Ganjil' 
      ? `${startYear}-07-01` 
      : `${endYear}-01-01`;
    const endDate = selectedSemester === 'Ganjil' 
      ? `${startYear}-12-31` 
      : `${endYear}-06-30`;

    // Strictly filter to active logged-in counselor only
    const myServices = services.filter((s) => {
      // Date filter
      if (!s.date || s.date < startDate || s.date > endDate) return false;

      // Counselor ownership check (MUST be current logged-in counselor)
      if (s.counselorName && activeCounselor?.name) {
        const sName = s.counselorName.trim().toLowerCase();
        const aName = activeCounselor.name.trim().toLowerCase();
        if (sName !== aName && !sName.includes(aName.split(' ')[0]) && !aName.includes(sName.split(' ')[0])) {
          return false;
        }
      }
      return true;
    });

    // 1. Total Layanan per Jenis
    let klasikal = 0;
    let bimbinganKelompok = 0;
    let konselingIndividual = 0;
    let konselingKelompok = 0;
    let homeVisit = 0;
    let konferensiKasus = 0;
    let lainnya = 0;

    myServices.forEach((s) => {
      const typeLower = (s.serviceType || '').toLowerCase();
      const probLower = (s.problem || '').toLowerCase();

      if (typeLower.includes('klasikal') || s.targetType === 'Klasikal') {
        klasikal++;
      } else if (typeLower.includes('bimbingan kelompok')) {
        bimbinganKelompok++;
      } else if (typeLower.includes('individual') || typeLower.includes('perorangan') || (s.targetType === 'Individu' && !typeLower.includes('kunjungan') && !typeLower.includes('home visit'))) {
        konselingIndividual++;
      } else if (typeLower.includes('konseling kelompok') || typeLower.includes('mediasi')) {
        konselingKelompok++;
      } else if (typeLower.includes('kunjungan') || typeLower.includes('home visit') || probLower.includes('home visit')) {
        homeVisit++;
      } else if (typeLower.includes('konferensi') || typeLower.includes('rapat') || probLower.includes('konferensi')) {
        konferensiKasus++;
      } else {
        lainnya++;
      }
    });

    // 2. Jumlah Siswa yang Dilayani (Total Unik)
    const uniqueStudentsMap = new Map<string, { id: string; name: string; class: string }>();
    myServices.forEach((s) => {
      if (Array.isArray(s.students)) {
        s.students.forEach((st) => {
          if (st.id) {
            uniqueStudentsMap.set(st.id, {
              id: st.id,
              name: st.name,
              class: st.class
            });
          }
        });
      }
    });

    // 3. Daftar 10 Siswa Paling Sering Ditangani
    const studentFrequency: Record<string, { student: { id: string; name: string; class: string }; count: number; types: Set<string> }> = {};
    myServices.forEach((s) => {
      if (Array.isArray(s.students)) {
        s.students.forEach((st) => {
          if (!st.id) return;
          if (!studentFrequency[st.id]) {
            studentFrequency[st.id] = {
              student: st,
              count: 0,
              types: new Set<string>()
            };
          }
          studentFrequency[st.id].count += 1;
          const shortType = s.serviceType.replace('Layanan ', '').replace(' (Individual)', '').replace(' (Home Visit)', '');
          studentFrequency[st.id].types.add(shortType);
        });
      }
    });

    const topStudents = Object.values(studentFrequency)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item) => ({
        name: item.student.name,
        class: item.student.class,
        count: item.count,
        types: Array.from(item.types).slice(0, 2).join(', ')
      }));

    // 4. Daftar Tindak Lanjut yang Belum Selesai
    const pendingFollowUps = myServices
      .filter((s) => {
        const hasFollowUpText = s.followUp && s.followUp.trim() !== '' && s.followUp.trim() !== '-';
        const isNotDone = s.status !== 'Selesai' || (s.followUp && !s.followUp.toLowerCase().includes('tuntas') && !s.followUp.toLowerCase().includes('selesai'));
        return hasFollowUpText && isNotDone;
      })
      .map((s) => ({
        studentName: s.students.map((st) => st.name).join(', ') || 'Siswa',
        studentClass: s.students[0]?.class || '-',
        serviceType: s.serviceType,
        date: s.date,
        followUp: s.followUp,
        status: s.status
      }));

    return {
      startDate,
      endDate,
      totalServices: myServices.length,
      serviceCounts: {
        klasikal,
        bimbinganKelompok,
        konselingIndividual,
        konselingKelompok,
        homeVisit,
        konferensiKasus,
        lainnya,
        total: myServices.length
      },
      totalUniqueStudents: uniqueStudentsMap.size,
      topStudents,
      pendingFollowUps
    };
  }, [services, activeCounselor, selectedSemester, selectedTahunAjaran]);

  // Handler for PDF Download
  const handleDownloadPDF = () => {
    downloadRekapSemesterPDF({
      semester: selectedSemester,
      tahunAjaran: selectedTahunAjaran,
      activeCounselor,
      serviceCounts: semesterData.serviceCounts,
      totalUniqueStudents: semesterData.totalUniqueStudents,
      topStudents: semesterData.topStudents,
      pendingFollowUps: semesterData.pendingFollowUps
    });
  };

  const schoolConfig = getSchoolConfig();

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-16">
      {/* Top Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors cursor-pointer"
              title="Kembali ke Laporan Utama"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800">
                Fitur Resmi Laporan
              </span>
              <span className="text-xs font-bold text-gray-500">Rekapitulasi Semesteran</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0b1c30] tracking-tight">
              Rekap Otomatis Per Semester
            </h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Khusus data layanan milik <strong>{activeCounselor.name}</strong> (Semester {selectedSemester} TA {selectedTahunAjaran})
            </p>
          </div>
        </div>

        {/* Action Button: Download PDF Rekap Semester */}
        <button
          type="button"
          onClick={handleDownloadPDF}
          className="px-5 py-3.5 bg-gradient-to-r from-teal-600 to-[#00685f] hover:from-teal-700 hover:to-[#005049] text-white rounded-xl text-sm font-black flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <Download className="w-4 h-4 text-white" />
          <span>Download PDF Rekap Semester</span>
        </button>
      </div>

      {/* FILTER CONTROLS: Pilih Semester, Pilih Tahun Ajaran, Tombol [Buat Rekap] */}
      <div className="bg-white p-5 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <Calendar className="w-4 h-4 text-[#00685f]" />
          <h2 className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
            Parameter Rekapitulasi Semester
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          {/* 1. Pilih Semester */}
          <div>
            <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
              Pilih Semester:
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl border border-gray-200">
              {(['Ganjil', 'Genap'] as const).map((sem) => {
                const isSelected = selectedSemester === sem;
                return (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => {
                      setSelectedSemester(sem);
                      setHasGenerated(true);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#00685f] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Semester {sem}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Pilih Tahun Ajaran */}
          <div>
            <label className="text-xs font-black text-[#0b1c30] uppercase tracking-wider block mb-2">
              Pilih Tahun Ajaran:
            </label>
            <select
              value={selectedTahunAjaran}
              onChange={(e) => {
                setSelectedTahunAjaran(e.target.value);
                setHasGenerated(true);
              }}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-black text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
            >
              {tahunAjaranOptions.map((ta) => (
                <option key={ta} value={ta}>
                  Tahun Ajaran {ta}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Tombol [Buat Rekap] */}
          <div>
            <button
              type="button"
              onClick={() => {
                setHasGenerated(true);
                showToast(`✨ Rekapitulasi Semester ${selectedSemester} TA ${selectedTahunAjaran} berhasil disusun!`, 'success');
              }}
              className="w-full py-2.5 px-4 bg-[#0b1c30] hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-teal-300" />
              <span>Buat Rekap</span>
            </button>
          </div>
        </div>

        {/* Info Note: Kepemilikan Data Guru */}
        <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl flex items-center justify-between text-xs font-semibold text-teal-900">
          <span>
            🔒 <strong>Filter Aktif:</strong> Hanya menyajikan data riwayat layanan milik <strong>{activeCounselor.name}</strong>. Data guru lain disaring secara otomatis.
          </span>
          <span className="text-[11px] font-bold text-[#00685f] shrink-0 ml-2">
            Periode: {semesterData.startDate} s.d. {semesterData.endDate}
          </span>
        </div>
      </div>

      {/* HASIL REKAPITULASI */}
      {hasGenerated && (
        <div className="space-y-6">
          {/* STATS BANNER: 1. Total Layanan & 2. Jumlah Siswa Unik */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-teal-100 text-[#00685f] flex items-center justify-center font-black shrink-0">
                <FileBarChart className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Pelaksanaan Layanan</span>
                <p className="text-xl font-black text-[#0b1c30]">{semesterData.serviceCounts.total} Sesi</p>
                <p className="text-[10px] text-teal-700 font-semibold">Tercatat di sistem</p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Jumlah Siswa Dilayani</span>
                <p className="text-xl font-black text-indigo-950">{semesterData.totalUniqueStudents} Siswa</p>
                <p className="text-[10px] text-indigo-600 font-semibold">Total siswa unik</p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black shrink-0">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Konseling Tatap Muka</span>
                <p className="text-xl font-black text-emerald-950">
                  {semesterData.serviceCounts.konselingIndividual + semesterData.serviceCounts.konselingKelompok} Sesi
                </p>
                <p className="text-[10px] text-emerald-600 font-semibold">Individu & Kelompok</p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Tindak Lanjut Pantau</span>
                <p className="text-xl font-black text-amber-950">{semesterData.pendingFollowUps.length} Kasus</p>
                <p className="text-[10px] text-amber-700 font-semibold">Perlu evaluasi berkala</p>
              </div>
            </div>
          </div>

          {/* 1. TOTAL LAYANAN PER JENIS */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-[#00685f]" />
                <h3 className="text-sm sm:text-base font-black text-[#0b1c30]">
                  1. Total Layanan per Jenis (Semester {selectedSemester})
                </h3>
              </div>
              <span className="text-xs font-black text-[#00685f] bg-[#e6f4f1] px-3 py-1 rounded-lg">
                Total: {semesterData.serviceCounts.total} Sesi
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Bimbingan Klasikal */}
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase text-gray-500 block">Klasikal</span>
                <p className="text-2xl font-black text-[#00685f]">{semesterData.serviceCounts.klasikal}</p>
                <p className="text-[10px] text-gray-400 font-medium">Tatap Muka Kelas</p>
              </div>

              {/* Bimbingan Kelompok */}
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase text-gray-500 block">Bimb. Kelompok</span>
                <p className="text-2xl font-black text-[#00685f]">{semesterData.serviceCounts.bimbinganKelompok}</p>
                <p className="text-[10px] text-gray-400 font-medium">Dinamika Kelompok</p>
              </div>

              {/* Konseling Individual */}
              <div className="p-3.5 bg-teal-50/70 rounded-xl border border-teal-200 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase text-teal-800 block">Konseling Individu</span>
                <p className="text-2xl font-black text-[#00685f]">{semesterData.serviceCounts.konselingIndividual}</p>
                <p className="text-[10px] text-teal-600 font-medium">Perorangan Siswa</p>
              </div>

              {/* Konseling Kelompok */}
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase text-gray-500 block">Kons. Kelompok</span>
                <p className="text-2xl font-black text-[#00685f]">{semesterData.serviceCounts.konselingKelompok}</p>
                <p className="text-[10px] text-gray-400 font-medium">Masalah Serupa</p>
              </div>

              {/* Home Visit */}
              <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase text-amber-800 block">Home Visit</span>
                <p className="text-2xl font-black text-amber-700">{semesterData.serviceCounts.homeVisit}</p>
                <p className="text-[10px] text-amber-600 font-medium">Kunjungan Rumah</p>
              </div>

              {/* Rapat Kasus */}
              <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-200 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase text-purple-800 block">Rapat Kasus</span>
                <p className="text-2xl font-black text-purple-700">{semesterData.serviceCounts.konferensiKasus}</p>
                <p className="text-[10px] text-purple-600 font-medium">Konferensi Kasus</p>
              </div>
            </div>
          </div>

          {/* 3. DAFTAR 10 SISWA PALING SERING DITANGANI */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm sm:text-base font-black text-[#0b1c30]">
                    3. Daftar 10 Siswa Paling Sering Ditangani
                  </h3>
                  <p className="text-xs text-gray-500">
                    Siswa dengan intensitas bimbingan/konseling tertinggi pada semester ini
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-gray-500">
                Peringkat 1 - 10
              </span>
            </div>

            {semesterData.topStudents.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-xs font-bold text-gray-500">
                  Belum ada data layanan siswa pada periode semester terpilih.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-[10px] uppercase font-black text-gray-500 bg-gray-50/70">
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      <th className="py-2.5 px-3">Kelas</th>
                      <th className="py-2.5 px-3 text-center">Jumlah Layanan</th>
                      <th className="py-2.5 px-3">Layanan Dominan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-semibold text-[#0b1c30]">
                    {semesterData.topStudents.map((st, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-3 font-black text-gray-400">#{idx + 1}</td>
                        <td className="py-3 px-3 font-black text-[#0b1c30]">{st.name}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-bold">
                            {st.class}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-1 rounded-full bg-teal-50 text-[#00685f] font-black border border-teal-200">
                            {st.count} Sesi
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-600">{st.types}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 4. DAFTAR TINDAK LANJUT YANG BELUM SELESAI */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#bcc9c6]/40 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-sm sm:text-base font-black text-[#0b1c30]">
                    4. Daftar Tindak Lanjut yang Belum Selesai ({semesterData.pendingFollowUps.length})
                  </h3>
                  <p className="text-xs text-gray-500">
                    Kasus dalam masa pemantauan perilaku atau memerlukan sesi lanjutan
                  </p>
                </div>
              </div>
            </div>

            {semesterData.pendingFollowUps.length === 0 ? (
              <div className="p-6 text-center bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800">
                <p className="text-xs font-black">
                  ✓ Luar biasa! Seluruh tindak lanjut layanan semester ini telah tuntas diselesaikan.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {semesterData.pendingFollowUps.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-gray-50 hover:bg-gray-100/70 border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-black text-[#0b1c30]">{item.studentName}</span>
                        <span className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] font-bold text-gray-600">
                          {item.studentClass}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">• {item.serviceType}</span>
                      </div>
                      <p className="text-xs font-semibold text-amber-800">
                        📌 Tindak Lanjut: {item.followUp}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <span className="text-[10px] font-bold text-gray-500">
                        Tanggal: {item.date}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                        Dalam Pantauan
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom PDF Action Banner */}
          <div className="bg-gradient-to-r from-teal-900 to-[#00685f] text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-black flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-300" />
                <span>Dokumen PDF Resmi Berstandar Dinas</span>
              </h4>
              <p className="text-xs text-teal-100 mt-1 max-w-xl">
                Laporan ini otomatis menyertakan Kop Resmi Sekolah <strong>{schoolConfig.schoolName}</strong>, stempel, serta tanda tangan resmi Guru BK dan Kepala Sekolah ({schoolConfig.principalName}).
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadPDF}
              className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-teal-50 text-[#00685f] rounded-xl text-sm font-black flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <Download className="w-4 h-4 text-[#00685f]" />
              <span>Download PDF Rekap Semester</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
