import React, { useState, useMemo } from 'react';
import { Student } from '../types';
import {
  UserPlus,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  PlusCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  BookOpen,
  User,
  HeartHandshake
} from 'lucide-react';

interface DataSiswaViewProps {
  students: Student[];
  onAddStudent: (student: Omit<Student, 'id' | 'initials'>) => void;
  onDeleteStudent: (id: string) => void;
  onNavigateToForm: (form: string, selectStudentId: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function DataSiswaView({
  students,
  onAddStudent,
  onDeleteStudent,
  onNavigateToForm,
  searchQuery,
  setSearchQuery,
}: DataSiswaViewProps) {
  // Filters state
  const [filterClass, setFilterClass] = useState('Semua Kelas');
  const [filterGender, setFilterGender] = useState<'Semua' | 'L' | 'P'>('Semua');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState<Student | null>(null);

  // Add student form state
  const [newNis, setNewNis] = useState('');
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState('XI - MIPA 1');
  const [newGender, setNewGender] = useState<'L' | 'P'>('L');

  // Dynamic lists of unique classes represented in current student database
  const classesList = useMemo(() => {
    const set = new Set(students.map((s) => s.class));
    return ['Semua Kelas', ...Array.from(set)].sort();
  }, [students]);

  // Filter & Search Logic
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchSearch =
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.nis.includes(searchQuery);
      const matchClass = filterClass === 'Semua Kelas' || student.class === filterClass;
      const matchGender = filterGender === 'Semua' || student.gender === filterGender;
      return matchSearch && matchClass && matchGender;
    });
  }, [students, searchQuery, filterClass, filterGender]);

  // Pagination bounds
  const totalItems = filteredStudents.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStudents, currentPage]);

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNis || !newName) {
      alert('Nis dan Nama Siswa harus diisi!');
      return;
    }
    // Perform trigger
    onAddStudent({
      nis: newNis,
      name: newName,
      class: newClass,
      gender: newGender,
      violationPoints: 0,
      bkServicesCount: 0,
    });
    // Reset state
    setNewNis('');
    setNewName('');
    setNewClass('XI - MIPA 1');
    setNewGender('L');
    setShowAddModal(false);
    alert('Siswa berhasil ditambahkan ke database!');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Dossier Student detail view modal overlay */}
      {showDossierModal && (
        <div className="fixed inset-0 bg-[#0b1c30]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative border border-[#bcc9c6]/40 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowDossierModal(null)}
              className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            <div className="flex items-center gap-4 border-b border-[#bcc9c6]/20 pb-4 mb-5">
              <div className="w-16 h-16 rounded-full bg-[#eff4ff] border border-[#00685f]/20 flex items-center justify-center font-extrabold text-2xl text-[#00685f] overflow-hidden flex-shrink-0 shadow-sm">
                {showDossierModal.avatarUrl ? (
                  <img
                    src={showDossierModal.avatarUrl}
                    alt={showDossierModal.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{showDossierModal.initials}</span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0b1c30]">
                  {showDossierModal.name}
                </h3>
                <p className="text-xs text-[#3d4947] font-semibold opacity-75">
                  NISN: {showDossierModal.nis} | Kelas: {showDossierModal.class}
                </p>
                <p className="text-[10px] bg-[#eff4ff] text-[#00685f] font-bold px-2 py-0.5 rounded-full inline-block mt-1">
                  Gender: {showDossierModal.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                </p>
              </div>
            </div>

            {/* Student Score Overview */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#ffdad6]/20 border border-[#ba1a1a]/20 p-4 rounded-xl">
                <p className="text-[10px] uppercase font-bold text-[#ba1a1a]/80 tracking-wider">
                  Akumulasi Pelanggaran
                </p>
                <p className="text-2xl font-extrabold text-[#ba1a1a] mt-1">
                  {showDossierModal.violationPoints} Poin
                </p>
                <p className="text-[10px] text-gray-500 mt-1 font-medium">
                  Batas skorsing: 100 poin
                </p>
              </div>
              <div className="bg-[#f4fffc] border border-[#00685f]/20 p-4 rounded-xl">
                <p className="text-[10px] uppercase font-bold text-[#00685f]/80 tracking-wider">
                  Keterlibatan Konseling
                </p>
                <p className="text-2xl font-extrabold text-[#00685f] mt-1">
                  {showDossierModal.bkServicesCount} Sesi
                </p>
                <p className="text-[10px] text-gray-500 mt-1 font-medium">
                  Bimbingan &amp; Konseling
                </p>
              </div>
            </div>

            {/* Inner actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  onNavigateToForm('pelanggaran', showDossierModal.id);
                  setShowDossierModal(null);
                }}
                className="flex-grow flex items-center justify-center gap-2 py-2.5 px-4 bg-[#ba1a1a] hover:bg-[#ba1a1a]/90 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-97 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                Catat Pelanggaran
              </button>
              <button
                onClick={() => {
                  onNavigateToForm('tambah-layanan', showDossierModal.id);
                  setShowDossierModal(null);
                }}
                className="flex-grow flex items-center justify-center gap-2 py-2.5 px-4 bg-[#6b38d4] hover:bg-[#6b38d4]/90 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-97 cursor-pointer"
              >
                <HeartHandshake className="w-4 h-4" />
                Bimbingan Layanan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add student Modal overlay */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#0b1c30]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleAddSubmit}
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative border border-[#bcc9c6]/40 animate-in zoom-in-95 duration-200 space-y-4"
          >
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            <div className="border-b border-[#bcc9c6]/20 pb-3">
              <h3 className="text-lg font-bold text-[#0b1c30]">
                Tambah Data Siswa Baru
              </h3>
              <p className="text-xs text-[#3d4947] opacity-75">
                Silakan isi data diri siswa di bawah dengan benar.
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0b1c30]">NISN Siswa</label>
              <input
                type="text"
                value={newNis}
                onChange={(e) => setNewNis(e.target.value.replace(/\D/g, ''))}
                placeholder="Misal: 21221005"
                maxLength={10}
                required
                className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0b1c30]">Nama Lengkap</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nama lengkap siswa"
                required
                className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0b1c30]">Kelas</label>
                <select
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50"
                >
                  <option value="Kelas 7A">Kelas 7A</option>
                  <option value="Kelas 7E">Kelas 7E</option>
                  <option value="Kelas 8A">Kelas 8A</option>
                  <option value="Kelas 8C">Kelas 8C</option>
                  <option value="Kelas 9B">Kelas 9B</option>
                  <option value="Kelas 9C">Kelas 9C</option>
                  <option value="X - MIPA 4">X - MIPA 4</option>
                  <option value="XI - MIPA 1">XI - MIPA 1</option>
                  <option value="XI - IPS 2">XI - IPS 2</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0b1c30]">Gender</label>
                <div className="flex bg-[#eff4ff] p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setNewGender('L')}
                    className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                      newGender === 'L'
                        ? 'bg-white text-[#00685f] shadow-sm'
                        : 'text-[#3d4947] hover:text-[#00685f]'
                    }`}
                  >
                    Laki-laki
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewGender('P')}
                    className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                      newGender === 'P'
                        ? 'bg-white text-[#00685f] shadow-sm'
                        : 'text-[#3d4947] hover:text-[#00685f]'
                    }`}
                  >
                    Perempuan
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3 border-t border-[#bcc9c6]/20">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-97 cursor-pointer"
              >
                Simpan Siswa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b1c30] tracking-tight">
            Data Siswa
          </h2>
          <p className="text-sm text-[#3d4947]/70 font-semibold mt-0.5">
            Manajemen data profil, pelaporan insiden, dan rekam jejak bimbingan siswa.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-97 self-start cursor-pointer"
        >
          <UserPlus className="w-4.5 h-4.5" />
          <span>Tambah Siswa</span>
        </button>
      </div>

      {/* Filters & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Panel */}
        <div className="lg:col-span-3 bg-white p-4 rounded-2xl shadow-sm border border-[#bcc9c6]/30 flex flex-wrap items-center gap-4">
          {/* Class Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#3d4947] uppercase tracking-wider">
              Kelas:
            </span>
            <select
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl text-xs font-semibold py-2 px-3 text-[#0b1c30] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#00685f]/50"
            >
              {classesList.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#3d4947] uppercase tracking-wider">
              Gender:
            </span>
            <div className="flex bg-[#f8f9ff] border border-[#bcc9c6]/30 rounded-xl p-1">
              {(['Semua', 'L', 'P'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    setFilterGender(g);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    filterGender === g
                      ? 'bg-white text-[#00685f] shadow-sm'
                      : 'text-[#3d4947] hover:text-[#00685f]'
                  }`}
                >
                  {g === 'Semua' ? 'Semua' : g === 'L' ? 'Laki-laki' : 'Perempuan'}
                </button>
              ))}
            </div>
          </div>

          {/* Reset Filters Shortcut */}
          {(filterClass !== 'Semua Kelas' || filterGender !== 'Semua' || searchQuery) && (
            <button
              onClick={() => {
                setFilterClass('Semua Kelas');
                setFilterGender('Semua');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="ml-auto text-xs font-bold text-[#ba1a1a] hover:underline"
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Quick count box */}
        <div className="bg-[#008378] text-[#f4fffc] p-4 rounded-2xl shadow-sm border border-[#00685f]/20 flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
            Total Siswa Terfilter
          </p>
          <h3 className="text-2xl font-extrabold mt-1">{totalItems} Siswa</h3>
        </div>
      </div>

      {/* Grid List Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#bcc9c6]/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[#f8f9ff] border-b border-[#bcc9c6]/30">
              <tr>
                <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-xs">No</th>
                <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-xs">NISN</th>
                <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-xs">Nama Siswa</th>
                <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-xs">Kelas</th>
                <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-xs">Gender</th>
                <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-xs">Poin Pelanggaran</th>
                <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-xs text-center">Layanan BK</th>
                <th className="px-6 py-4 font-bold text-[#3d4947] uppercase text-xs text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bcc9c6]/20">
              {paginatedStudents.length > 0 ? (
                paginatedStudents.map((student, index) => {
                  const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                  const points = student.violationPoints;

                  // Render badge depending on values
                  let pointBadge = 'bg-[#00685f]/10 text-[#00685f]';
                  if (points >= 100) {
                    pointBadge = 'bg-[#ba1a1a]/10 text-[#ba1a1a]';
                  } else if (points >= 50) {
                    pointBadge = 'bg-[#825100]/10 text-[#825100]';
                  } else if (points > 0) {
                    pointBadge = 'bg-yellow-500/10 text-[#825100]';
                  }

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-[#eff4ff]/25 transition-colors group"
                    >
                      <td className="px-6 py-4.5 text-gray-500 font-semibold">
                        {globalIndex}
                      </td>
                      <td className="px-6 py-4.5 font-bold text-gray-700">
                        {student.nis}
                      </td>
                      <td className="px-6 py-4.5 font-bold text-[#0b1c30]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#eff4ff] flex items-center justify-center font-bold text-[#00685f] text-xs overflow-hidden flex-shrink-0">
                            {student.avatarUrl ? (
                              <img
                                src={student.avatarUrl}
                                alt={student.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span>{student.initials}</span>
                            )}
                          </div>
                          <span className="truncate max-w-[160px]">
                            {student.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4.5 font-semibold text-gray-600">
                        {student.class}
                      </td>
                      <td className="px-6 py-4.5 font-semibold text-gray-500">
                        {student.gender}
                      </td>
                      <td className="px-6 py-4.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${pointBadge}`}
                        >
                          {points} Poin
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-center font-bold text-gray-700">
                        {student.bkServicesCount}
                      </td>
                      <td className="px-6 py-4.5">
                        <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {/* Profile Dossier Shortcut */}
                          <button
                            onClick={() => setShowDossierModal(student)}
                            className="p-1.5 text-[#00685f] hover:bg-[#00685f]/10 rounded-lg transition-colors cursor-pointer"
                            title="Lihat Profil Lengkap"
                          >
                            <Eye className="w-4.5 h-4.5" />
                          </button>

                          {/* Quick Violation Record Shortcut */}
                          <button
                            onClick={() => onNavigateToForm('pelanggaran', student.id)}
                            className="p-1.5 text-[#ba1a1a] hover:bg-[#ba1a1a]/10 rounded-lg transition-colors cursor-pointer"
                            title="Laporkan Pelanggaran"
                          >
                            <AlertTriangle className="w-4.5 h-4.5" />
                          </button>

                          {/* Quick Counseling Service Shortcut */}
                          <button
                            onClick={() => onNavigateToForm('tambah-layanan', student.id)}
                            className="p-1.5 text-[#6b38d4] hover:bg-[#6b38d4]/10 rounded-lg transition-colors cursor-pointer"
                            title="Buka Sesi Konseling"
                          >
                            <PlusCircle className="w-4.5 h-4.5" />
                          </button>

                          {/* Delete Entry */}
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Apakah Anda yakin ingin menghapus data siswa ${student.name}? Semua riwayat pelanggaran dan konseling akan dihapus.`
                                )
                              ) {
                                onDeleteStudent(student.id);
                                alert('Data siswa berhasil terhapus.');
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-[#ba1a1a] hover:bg-[#ba1a1a]/10 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Siswa"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                /* Empty state */
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-xs mx-auto space-y-3">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <Search className="w-8 h-8 text-gray-400" />
                      </div>
                      <h4 className="font-bold text-[#0b1c30] text-base">
                        Data Tidak Ditemukan
                      </h4>
                      <p className="text-xs text-[#3d4947]/70 font-semibold leading-relaxed">
                        Kami tidak dapat menemukan data siswa dengan kata kunci atau filter tersebut. Coba reset pencarian Anda.
                      </p>
                      <button
                        onClick={() => {
                          setFilterClass('Semua Kelas');
                          setFilterGender('Semua');
                          setSearchQuery('');
                          setCurrentPage(1);
                        }}
                        className="px-4 py-2 border border-[#00685f] text-[#00685f] rounded-xl text-xs font-bold hover:bg-[#00685f]/5 transition-colors cursor-pointer"
                      >
                        Reset Semua Filter
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pager Bar */}
        {totalPages > 1 && (
          <div className="p-4.5 bg-[#f8f9ff] border-t border-[#bcc9c6]/30 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#3d4947]/80">
              Menampilkan {paginatedStudents.length} dari {totalItems} siswa
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#bcc9c6]/35 text-[#3d4947] hover:bg-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                    currentPage === p
                      ? 'bg-[#00685f] text-white shadow-sm'
                      : 'border border-[#bcc9c6]/20 text-[#3d4947] hover:bg-white'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#bcc9c6]/35 text-[#3d4947] hover:bg-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
