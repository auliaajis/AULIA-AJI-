import React, { useState, useEffect, useMemo } from 'react';
import { Student, CounselingService, BKServiceType } from '../types';
import {
  User,
  Users,
  Compass,
  Briefcase,
  BookOpen,
  MessageSquare,
  HelpCircle,
  HeartHandshake,
  Info,
  X,
  Calendar,
  Clock,
  Upload,
  FileText,
  Lightbulb,
  Plus,
  Trash2,
  Check
} from 'lucide-react';

interface TambahLayananFormProps {
  students: Student[];
  preSelectedStudentId?: string;
  onSaveService: (service: Omit<CounselingService, 'id'>) => void;
  onCancel: () => void;
}

export default function TambahLayananForm({
  students,
  preSelectedStudentId,
  onSaveService,
  onCancel,
}: TambahLayananFormProps) {
  // Service configuration state
  const [serviceType, setServiceType] = useState<BKServiceType>('Layanan Orientasi');
  const [selectedParticipants, setSelectedParticipants] = useState<Student[]>([]);

  // Participants helper popover state
  const [showAddStudentPopover, setShowAddStudentPopover] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form core states
  const [problem, setProblem] = useState('');
  const [description, setDescription] = useState('');
  const [output, setOutput] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [status, setStatus] = useState<'Terjadwal' | 'Selesai' | 'Dibatalkan'>('Terjadwal');

  // Schedule states
  const [scheduleDate, setScheduleDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Attachment states (Usability Guideline: File upload supports drag & drop and manual click)
  const [attachments, setAttachments] = useState<{ name: string; size: string }[]>([
    { name: 'surat_panggilan_001.pdf', size: '1.2 MB' },
  ]);
  const [isDragging, setIsDragging] = useState(false);

  // Initialize values
  useEffect(() => {
    const today = new Date();
    setScheduleDate(today.toISOString().substring(0, 10));

    const hr = today.getHours();
    setStartTime(`${String(hr).padStart(2, '0')}:00`);
    setEndTime(`${String(hr + 1).padStart(2, '0')}:00`);

    if (preSelectedStudentId) {
      const found = students.find((s) => s.id === preSelectedStudentId);
      if (found) {
        setSelectedParticipants([found]);
      }
    }
  }, [preSelectedStudentId, students]);

  // Autocomplete matching list for participant selection
  const autocompleteList = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return students.filter(
      (s) =>
        (s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.nis.includes(searchQuery)) &&
        !selectedParticipants.some((p) => p.id === s.id)
    );
  }, [searchQuery, students, selectedParticipants]);

  const handleAddParticipant = (student: Student) => {
    setSelectedParticipants([...selectedParticipants, student]);
    setSearchQuery('');
    setShowAddStudentPopover(false);
  };

  const handleRemoveParticipant = (id: string) => {
    setSelectedParticipants(selectedParticipants.filter((p) => p.id !== id));
  };

  // Drag and Drop simulation handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      setAttachments([...attachments, { name: file.name, size: sizeStr }]);
    }
  };

  const handleManualFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      setAttachments([...attachments, { name: file.name, size: sizeStr }]);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedParticipants.length === 0) {
      alert('Tambahkan minimal 1 siswa peserta layanan!');
      return;
    }
    if (!problem.trim()) {
      alert('Harap isi masalah atau permintaan layanan!');
      return;
    }

    onSaveService({
      serviceType,
      students: selectedParticipants.map((p) => ({
        id: p.id,
        name: p.name,
        class: p.class,
        nis: p.nis,
      })),
      problem,
      description,
      output,
      followUp,
      status,
      date: scheduleDate,
      startTime,
      endTime,
      attachments,
    });

    alert('Catatan rekam layanan BK berhasil didokumentasikan.');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top action header bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#bcc9c6]/20 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b1c30] tracking-tight">
            Tambah Rekam Layanan
          </h2>
          <p className="text-sm text-[#3d4947]/70 font-semibold mt-1">
            Dokumentasikan sesi bimbingan dan konseling siswa secara akurat dan rapi.
          </p>
        </div>
        <div className="flex gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 border border-[#bcc9c6] text-[#3d4947] bg-white hover:bg-gray-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleFormSubmit}
            className="px-6 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-97 cursor-pointer"
          >
            Simpan Catatan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Core Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Service Type Radio-Card Selector */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#bcc9c6]/30">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#0b1c30] mb-4 flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#00685f] rounded-full"></span>
              Jenis Layanan Bimbingan Konseling (BK)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { type: 'Layanan Orientasi', label: 'Orientasi', icon: Compass, desc: 'Pengenalan lingkungan sekolah' },
                { type: 'Layanan Informasi', label: 'Informasi', icon: Info, desc: 'Pemahaman akademik/karir' },
                { type: 'Layanan Penempatan dan Penyaluran', label: 'Penempatan & Penyaluran', icon: Briefcase, desc: 'Penyaluran bakat/minat siswa' },
                { type: 'Layanan Penguasaan Konten', label: 'Penguasaan Konten', icon: BookOpen, desc: 'Kemampuan belajar siswa' },
                { type: 'Layanan Konseling Perorangan (Individual)', label: 'Konseling Perorangan', icon: User, desc: 'Sesi penyelesaian masalah individu' },
                { type: 'Layanan Bimbingan Kelompok', label: 'Bimbingan Kelompok', icon: Users, desc: 'Bimbingan kelompok topik umum' },
                { type: 'Layanan Konseling Kelompok', label: 'Konseling Kelompok', icon: MessageSquare, desc: 'Sesi solusi masalah kelompok' },
                { type: 'Layanan Konsultasi', label: 'Konsultasi', icon: HelpCircle, desc: 'Penyelesaian kendala siswa' },
                { type: 'Layanan Mediasi', label: 'Mediasi', icon: HeartHandshake, desc: 'Penyelesaian konflik siswa' }
              ].map((item) => {
                const IconComponent = item.icon;
                const isSelected = serviceType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setServiceType(item.type as BKServiceType)}
                    className={`flex flex-col items-center justify-center p-3 border rounded-xl transition-all h-28 text-center hover:bg-[#f4fffc]/40 cursor-pointer ${
                      isSelected
                        ? 'border-[#00685f] bg-[#f4fffc] ring-2 ring-[#00685f]/25 shadow-sm'
                        : 'border-[#bcc9c6]/30 bg-white'
                    }`}
                  >
                    <IconComponent
                      className={`w-6 h-6 mb-1.5 transition-transform ${
                        isSelected ? 'text-[#00685f] scale-110' : 'text-gray-400'
                      }`}
                    />
                    <span className="text-xs font-bold text-[#0b1c30] leading-snug line-clamp-2">
                      {item.label}
                    </span>
                    <span className="text-[9px] text-[#3d4947]/70 font-semibold leading-tight line-clamp-1 mt-0.5">
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Participant Selector component */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#bcc9c6]/30">
            <div className="flex justify-between items-center mb-4 border-b border-[#bcc9c6]/10 pb-3">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#0b1c30] flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-[#00685f] rounded-full"></span>
                Peserta Layanan
              </h3>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAddStudentPopover(!showAddStudentPopover)}
                  className="text-[#00685f] hover:text-[#005049] text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Siswa</span>
                </button>

                {/* Popover autocomplete search dialog */}
                {showAddStudentPopover && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-[#bcc9c6]/40 rounded-xl shadow-xl z-50 p-3">
                    <div className="flex items-center gap-2 border border-[#bcc9c6]/40 rounded-lg px-2.5 py-1.5 bg-[#f8f9ff]">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Ketik nama atau NISN..."
                        className="text-xs focus:outline-none bg-transparent w-full"
                      />
                    </div>
                    {searchQuery && (
                      <div className="mt-2 max-h-36 overflow-y-auto custom-scrollbar divide-y divide-[#bcc9c6]/10">
                        {autocompleteList.length > 0 ? (
                          autocompleteList.map((s) => (
                            <div
                              key={s.id}
                              onClick={() => handleAddParticipant(s)}
                              className="py-1.5 px-1 hover:bg-[#eff4ff] cursor-pointer text-xs font-medium flex justify-between items-center"
                            >
                              <div>
                                <p className="font-bold text-[#0b1c30]">{s.name}</p>
                                <p className="text-[10px] text-gray-500">{s.class}</p>
                              </div>
                              <span className="text-[10px] text-gray-400">NISN: {s.nis}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-center text-gray-500 py-2">
                            Tidak ditemukan murid lain
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Selected List binder */}
            <div className="space-y-3">
              {selectedParticipants.length > 0 ? (
                selectedParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-3 bg-[#f8f9ff] border border-[#bcc9c6]/30 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#eff4ff] flex items-center justify-center text-xs font-bold text-[#00685f] overflow-hidden flex-shrink-0">
                        {participant.avatarUrl ? (
                          <img
                            src={participant.avatarUrl}
                            alt={participant.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span>{participant.initials}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0b1c30]">{participant.name}</p>
                        <p className="text-[10px] text-[#3d4947] opacity-75 font-semibold">
                          {participant.class} • NISN: {participant.nis}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(participant.id)}
                      className="text-[#3d4947] hover:text-[#ba1a1a] p-1 hover:bg-[#ffdad6]/40 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 border-2 border-dashed border-[#bcc9c6]/30 rounded-xl text-xs text-gray-400 font-semibold">
                  Belum ada peserta yang dimasukkan. Gunakan tombol + Tambah Siswa.
                </div>
              )}
            </div>
          </section>

          {/* Form fields: issues, chronology notes, output, next steps */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#bcc9c6]/30 space-y-5">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#0b1c30] mb-2 flex items-center gap-2 border-b border-[#bcc9c6]/10 pb-3">
              <span className="w-1.5 h-3.5 bg-[#00685f] rounded-full"></span>
              Konten Rekam Layanan
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0b1c30]">
                Masalah / Permintaan Layanan
              </label>
              <input
                type="text"
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="Contoh: Kesulitan belajar di mata pelajaran Matematika atau konflik teman sebaya..."
                required
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0b1c30]">Deskripsi Kegiatan</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan proses konseling atau bimbingan secara mendalam dan kronologis..."
                required
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 resize-none shadow-sm"
              ></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30]">
                  Hasil / Output Layanan
                </label>
                <textarea
                  rows={3}
                  value={output}
                  onChange={(e) => setOutput(e.target.value)}
                  placeholder="Apa hasil akhir yang dicapai dalam sesi bimbingan ini?"
                  required
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 resize-none shadow-sm"
                ></textarea>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0b1c30]">
                  Rencana Tindak Lanjut
                </label>
                <textarea
                  rows={3}
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  placeholder="Langkah strategis penanganan selanjutnya..."
                  required
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 resize-none shadow-sm"
                ></textarea>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Status & Schedule Sidepanel */}
        <div className="space-y-6">
          {/* Status Selection list */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#bcc9c6]/30">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-[#3d4947] mb-4">
              Status Layanan
            </h3>
            <div className="flex flex-col gap-3">
              {(['Terjadwal', 'Selesai', 'Dibatalkan'] as const).map((st) => {
                let dotBg = 'bg-[#00685f]';
                if (st === 'Selesai') dotBg = 'bg-[#6b38d4]';
                else if (st === 'Dibatalkan') dotBg = 'bg-[#ba1a1a]';

                return (
                  <label key={st} className="cursor-pointer">
                    <input
                      type="radio"
                      name="service_status"
                      checked={status === st}
                      onChange={() => setStatus(st)}
                      className="sr-only"
                    />
                    <span
                      className={`flex items-center gap-3 px-4 py-3 border rounded-xl text-xs font-bold transition-all ${
                        status === st
                          ? 'border-[#00685f] bg-[#f4fffc] text-[#00685f] ring-1 ring-[#00685f]/30'
                          : 'border-[#bcc9c6]/40 bg-[#f8f9ff] text-[#3d4947] hover:bg-gray-100'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full ${dotBg}`}></span>
                      {st}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Schedule metadata time blocks */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#bcc9c6]/30 space-y-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-[#3d4947] mb-2">
              Waktu Pelaksanaan
            </h3>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#3d4947] uppercase tracking-wider">
                Tanggal
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0b1c30] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#3d4947] uppercase tracking-wider">
                  Mulai
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0b1c30] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#3d4947] uppercase tracking-wider">
                  Selesai
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0b1c30] focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Attachments optional file-uploader card (Satisfies usability criteria for Drag & drop + click select) */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#bcc9c6]/30">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-[#3d4947] mb-4">
              Lampiran (Opsional)
            </h3>

            {/* Hidden file selector trigger */}
            <input
              type="file"
              id="fileSelector"
              onChange={handleManualFileSelect}
              className="hidden"
            />

            {/* Drag & drop active panel */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('fileSelector')?.click()}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-[#00685f] bg-[#f4fffc]'
                  : 'border-[#bcc9c6]/50 hover:border-[#00685f]/80 bg-[#f8f9ff]'
              }`}
            >
              <Upload className="w-8 h-8 text-[#3d4947] opacity-60 mb-2" />
              <p className="text-xs font-bold text-[#0b1c30]">Klik atau seret file ke sini</p>
              <p className="text-[10px] text-gray-500 mt-1 font-medium">
                PDF, JPG, atau PNG (Maks. 5MB)
              </p>
            </div>

            {/* Attached files list display */}
            {attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                {attachments.map((att, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 p-2 bg-[#00685f]/5 border border-[#00685f]/15 rounded-lg text-xs"
                  >
                    <FileText className="w-4 h-4 text-[#00685f]" />
                    <span className="flex-1 truncate text-[11px] font-semibold text-[#0b1c30]">
                      {att.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(i)}
                      className="p-1 hover:bg-gray-200 rounded text-[#ba1a1a]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Tips educational guidance box */}
          <div className="bg-[#6b38d4]/10 border border-[#6b38d4]/20 text-[#6b38d4] p-6 rounded-2xl relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <h4 className="font-bold text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <Lightbulb className="w-4.5 h-4.5" />
                Tips Konseling
              </h4>
              <p className="text-xs leading-relaxed opacity-90 italic">
                "Gunakan pendekatan empatik dalam konseling kelompok untuk menciptakan ruang aman bagi siswa berbagi pengalaman tanpa rasa takut dihakimi."
              </p>
            </div>
            {/* Visual element placeholder background */}
            <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
              <Users className="w-24 h-24" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
