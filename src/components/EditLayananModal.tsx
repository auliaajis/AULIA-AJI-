import React, { useState, useEffect } from 'react';
import { Student, CounselingService, BKServiceType } from '../types';
import { addToGoogleCalendar } from '../utils/calendarSync';
import {
  X,
  HeartHandshake,
  Calendar,
  Clock,
  UserCheck,
  Plus,
  Trash2,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Search,
  Sparkles,
  ChevronDown,
  SlidersHorizontal as Sliders
} from 'lucide-react';

interface EditLayananModalProps {
  service: CounselingService | null;
  students: Student[];
  onSave: (updatedService: CounselingService) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const ALL_SERVICE_TYPES: BKServiceType[] = [
  'Layanan Orientasi',
  'Layanan Informasi',
  'Layanan Penempatan dan Penyaluran',
  'Layanan Penguasaan Konten',
  'Layanan Konseling Perorangan (Individual)',
  'Layanan Bimbingan Kelompok',
  'Layanan Konseling Kelompok',
  'Layanan Konsultasi',
  'Layanan Mediasi'
];

export default function EditLayananModal({
  service,
  students,
  onSave,
  onDelete,
  onClose,
}: EditLayananModalProps) {
  if (!service) return null;

  const [serviceType, setServiceType] = useState<BKServiceType>(service.serviceType);
  const [targetType, setTargetType] = useState<'Individu' | 'Kelompok' | 'Klasikal'>(
    service.targetType || 'Individu'
  );
  const [selectedStudents, setSelectedStudents] = useState<
    { id: string; name: string; class: string; nis: string }[]
  >(service.students || []);

  const [date, setDate] = useState(service.date || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(service.startTime || '08:00');
  const [endTime, setEndTime] = useState(service.endTime || '08:45');

  const [status, setStatus] = useState<'Terjadwal' | 'Selesai' | 'Dibatalkan'>(
    service.status || 'Terjadwal'
  );
  const [problem, setProblem] = useState(service.problem || '');
  const [description, setDescription] = useState(service.description || '');
  const [output, setOutput] = useState(service.output || '');
  const [followUp, setFollowUp] = useState(service.followUp || '');
  const [showOptionalFields, setShowOptionalFields] = useState(
    Boolean(service.output || service.followUp || service.proofPhotoUrl)
  );

  const [proofPhotoUrl, setProofPhotoUrl] = useState<string>(service.proofPhotoUrl || '');
  const [proofPhotoName, setProofPhotoName] = useState<string>(service.proofPhotoName || '');

  // Student search/selection popover state
  const [showAddStudentPopover, setShowAddStudentPopover] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Handle photo upload (converts image file to base64)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran foto terlalu besar. Maksimal 5 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofPhotoUrl(reader.result as string);
        setProofPhotoName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  // Add student to list
  const handleAddStudent = (st: Student) => {
    if (selectedStudents.some((s) => s.id === st.id)) {
      alert('Siswa sudah ada dalam daftar peserta.');
      return;
    }
    setSelectedStudents([
      ...selectedStudents,
      { id: st.id, name: st.name, class: st.class, nis: st.nis }
    ]);
  };

  // Remove student from list
  const handleRemoveStudent = (stId: string) => {
    if (selectedStudents.length <= 1) {
      alert('Sesi layanan minimal harus memiliki 1 siswa peserta.');
      return;
    }
    setSelectedStudents(selectedStudents.filter((s) => s.id !== stId));
  };

  const filteredAvailableStudents = students.filter(
    (st) =>
      !selectedStudents.some((s) => s.id === st.id) &&
      (st.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
        st.class.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
        st.nis.includes(studentSearchQuery))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedStudents.length === 0) {
      alert('Harap pilih minimal 1 siswa peserta konseling.');
      return;
    }

    if (!problem.trim()) {
      alert('Harap isi pokok masalah/topik pembahasan.');
      return;
    }

    if (status === 'Selesai' && !followUp.trim()) {
      // Gentle reminder if marking complete without follow up
      if (!confirm('Rencana tindak lanjut masih kosong. Apakah Anda yakin ingin menyimpan status Selesai?')) {
        return;
      }
    }

    const updated: CounselingService = {
      ...service,
      serviceType,
      targetType,
      students: selectedStudents,
      date,
      startTime,
      endTime,
      status,
      problem,
      description,
      output,
      followUp,
      proofPhotoUrl: proofPhotoUrl || undefined,
      proofPhotoName: proofPhotoName || undefined
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden border border-[#bcc9c6]/30 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#bcc9c6]/20 bg-[#f8fafa] flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00685f]/10 text-[#00685f] rounded-2xl">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-[#0b1c30] text-lg leading-tight">
                Edit & Kelola Layanan BK
              </h3>
              <p className="text-xs text-[#3d4947]/70 font-semibold mt-0.5">
                Perbarui status, waktu, pembahasan, atau peserta sesi bimbingan.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200/60 rounded-full transition-colors cursor-pointer text-gray-500"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Status Quick Selection Bar */}
          <div className="bg-[#eff4ff]/60 border border-[#bcc9c6]/30 rounded-2xl p-3.5 space-y-2">
            <label className="text-[10px] font-extrabold text-[#00685f] uppercase tracking-wider block">
              Status Sesi Layanan
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('Terjadwal')}
                className={`py-2 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                  status === 'Terjadwal'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-amber-50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Terjadwal</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('Selesai')}
                className={`py-2 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                  status === 'Selesai'
                    ? 'bg-[#00685f] text-white border-[#005049] shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-[#00685f]/10'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Selesai</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('Dibatalkan')}
                className={`py-2 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                  status === 'Dibatalkan'
                    ? 'bg-[#ba1a1a] text-white border-red-700 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-red-50'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Dibatalkan</span>
              </button>
            </div>
          </div>

          {/* Service Type & Target Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#64748b] block">
                Jenis Layanan BK
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as BKServiceType)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] cursor-pointer"
              >
                {ALL_SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#64748b] block">
                Format Sasaran
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as any)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] cursor-pointer"
              >
                <option value="Individu">Individu (Perorangan)</option>
                <option value="Kelompok">Kelompok (Beberapa Siswa)</option>
                <option value="Klasikal">Klasikal (Satu Kelas)</option>
              </select>
            </div>
          </div>

          {/* Date and Time Schedule */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <label className="text-xs font-bold text-[#64748b] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#00685f]" />
                Tanggal
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#64748b] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#00685f]" />
                Jam Mulai
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#64748b] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#00685f]" />
                Jam Selesai
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
              />
            </div>
          </div>

          {/* Student Participants Section */}
          <div className="space-y-2 border-t border-b border-gray-100 py-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-[#00685f]" />
                Siswa Peserta ({selectedStudents.length})
              </label>
              <button
                type="button"
                onClick={() => setShowAddStudentPopover(!showAddStudentPopover)}
                className="text-xs text-[#00685f] hover:underline font-extrabold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Siswa</span>
              </button>
            </div>

            {/* Selected Student Chips */}
            <div className="flex flex-wrap gap-2">
              {selectedStudents.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center gap-1.5 bg-[#f4fffc] border border-[#00685f]/30 text-[#00685f] px-2.5 py-1 rounded-xl font-bold text-xs shadow-2xs"
                >
                  <span>
                    {st.name} ({st.class})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStudent(st.id)}
                    className="hover:text-red-600 transition-colors cursor-pointer"
                    title="Hapus peserta"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Student Popover Panel */}
            {showAddStudentPopover && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center bg-white border border-gray-200 rounded-xl px-2.5 py-1.5">
                  <Search className="w-4 h-4 text-gray-400 mr-2" />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder="Cari nama murid, NISN, atau kelas..."
                    className="bg-transparent border-none focus:outline-none text-xs w-full"
                  />
                  {studentSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setStudentSearchQuery('')}
                      className="text-gray-400 hover:text-gray-600 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {filteredAvailableStudents.length === 0 ? (
                    <p className="text-[11px] text-gray-400 font-semibold p-2 text-center">
                      Tidak ada siswa lain yang ditemukan.
                    </p>
                  ) : (
                    filteredAvailableStudents.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => {
                          handleAddStudent(st);
                          setShowAddStudentPopover(false);
                          setStudentSearchQuery('');
                        }}
                        className="flex justify-between items-center p-2 rounded-xl hover:bg-[#00685f]/10 text-gray-700 cursor-pointer font-semibold transition-colors"
                      >
                        <span>
                          {st.name} ({st.class})
                        </span>
                        <span className="text-[10px] bg-white text-[#00685f] px-2 py-0.5 rounded-md font-bold border border-gray-200">
                          + Pilih
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Problem / Topic */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#64748b] block">
              Pokok Masalah / Topik Pembahasan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Contoh: Kesulitan Konsentrasi Belajar & Manajemen Waktu Game"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#64748b] block">
              Deskripsi Kasus & Catatan Pembahasan
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail percakapan konseling, amatan perilaku, atau dinamika emosi siswa..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs font-medium text-[#3d4947] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] leading-relaxed"
            />
          </div>

          {/* Progressive Disclosure: Collapsible Section for Optional Fields */}
          <div className="border border-[#bcc9c6]/30 rounded-2xl overflow-hidden bg-white shadow-2xs">
            <button
              type="button"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="w-full px-4 py-3 flex items-center justify-between bg-[#f8faf9] hover:bg-gray-100/70 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-[#00685f]" />
                <div>
                  <h4 className="text-[11px] font-black text-[#0b1c30] uppercase tracking-wider">
                    Hasil, Tindak Lanjut & Bukti Foto (Opsional)
                  </h4>
                  <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                    {showOptionalFields
                      ? 'Klik untuk menyembunyikan kolom pendukung'
                      : 'Output konseling, tindak lanjut, dan foto bukti sesi'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(output || followUp || proofPhotoUrl) && (
                  <span className="text-[10px] bg-[#00685f]/10 text-[#00685f] font-bold px-2 py-0.5 rounded-full">
                    Terisi
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                    showOptionalFields ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {showOptionalFields && (
              <div className="p-4 space-y-3.5 border-t border-[#bcc9c6]/20 bg-white animate-in slide-in-from-top-2 duration-200">
                {/* Output / Solution */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#64748b] block">
                    Hasil / Rekomendasi Konseling (Output)
                  </label>
                  <textarea
                    rows={2}
                    value={output}
                    onChange={(e) => setOutput(e.target.value)}
                    placeholder="Contoh: Siswa menyadari pentingnya disiplin belajar dan berkomitmen membatasi penggunaan HP."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs font-medium text-[#3d4947] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] leading-relaxed"
                  />
                </div>

                {/* Follow Up Plan */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#00685f] block">
                    Rencana Tindak Lanjut
                  </label>
                  <textarea
                    rows={2}
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    placeholder="Contoh: Evaluasi perkembangan belajar 1 minggu mendatang bersama wali kelas."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs font-medium text-[#3d4947] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] leading-relaxed"
                  />
                </div>

                {/* Proof Photo Upload */}
                <div className="space-y-1.5 border-t border-gray-100 pt-3">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-[#00685f]" />
                    Foto Bukti Sesi (Opsional)
                  </label>

                  {proofPhotoUrl ? (
                    <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 p-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={proofPhotoUrl}
                          alt="Bukti Sesi"
                          className="w-14 h-14 object-cover rounded-xl border"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="font-bold text-gray-800 text-xs line-clamp-1">
                            {proofPhotoName || 'Foto Sesi Layanan'}
                          </p>
                          <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Foto Bukti Terlampir
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setProofPhotoUrl('');
                          setProofPhotoName('');
                        }}
                        className="px-2.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        Hapus Foto
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 hover:border-[#00685f] rounded-2xl bg-gray-50/50 hover:bg-[#00685f]/5 transition-all cursor-pointer">
                      <Upload className="w-5 h-5 text-gray-400 mb-1" />
                      <span className="text-xs font-bold text-[#00685f]">
                        Unggah Foto Sesi Bimbingan
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5">
                        Format JPG, PNG (Maks 5 MB)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Submit & Delete Actions */}
          <div className="pt-4 border-t border-[#bcc9c6]/30 flex items-center justify-between gap-3">
            {onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Apakah Anda yakin ingin menghapus rekam layanan BK ini secara permanen?')) {
                    onDelete(service.id);
                    onClose();
                  }
                }}
                className="py-2.5 px-3.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-extrabold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Layanan</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {service && (
                <button
                  type="button"
                  onClick={() => addToGoogleCalendar({
                    ...service,
                    serviceType,
                    status,
                    date,
                    startTime,
                    endTime,
                    problem,
                    description,
                    students: selectedStudents,
                    targetType
                  })}
                  className="py-2.5 px-3.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 font-extrabold rounded-xl transition-all shadow-xs cursor-pointer text-xs flex items-center gap-1.5"
                  title="Tambah ke Google Calendar"
                >
                  <Calendar className="w-4 h-4 text-teal-700" />
                  <span>+ Google Calendar</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-xl transition-colors cursor-pointer text-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                className="py-2.5 px-5 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold rounded-xl transition-all shadow-md active:scale-97 cursor-pointer text-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
