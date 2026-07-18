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
  Check,
  Camera,
  AlertCircle,
  Image as ImageIcon
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

  // New Target Type and Photo proof states
  const [targetType, setTargetType] = useState<'Individu' | 'Kelompok' | 'Klasikal'>('Individu');
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string | undefined>(undefined);
  const [proofPhotoName, setProofPhotoName] = useState<string | undefined>(undefined);
  
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const startCamera = async () => {
    setCameraError(null);
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        'Gagal mengakses kamera. Pastikan izin kamera telah diberikan dan kamera tidak sedang digunakan oleh aplikasi lain.'
      );
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setProofPhotoUrl(dataUrl);
        setProofPhotoName(`kamera_capture_${Date.now()}.jpg`);
        stopCamera();
      }
    }
  };

  const processProofFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Hanya diperbolehkan melampirkan berkas gambar/foto.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setProofPhotoUrl(base64);
      setProofPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processProofFile(e.target.files[0]);
    }
  };

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
    if (targetType === 'Individu' && selectedParticipants.length === 0) {
      alert('Tambahkan minimal 1 siswa peserta layanan untuk bimbingan perorangan/individu!');
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
      targetType,
      proofPhotoUrl,
      proofPhotoName,
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

          {/* Sasaran Layanan Section (Conditionally displayed/enhanced when not individual counseling) */}
          {serviceType !== 'Layanan Konseling Perorangan (Individual)' && (
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#bcc9c6]/30 animate-in fade-in slide-in-from-top-3 duration-200">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#0b1c30] mb-3 flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-[#00685f] rounded-full"></span>
                Sasaran Layanan
              </h3>
              <p className="text-xs text-[#3d4947]/70 font-semibold mb-4">
                Pilih lingkup sasaran untuk layanan {serviceType}. Sesi selain konseling perorangan dapat dilaksanakan secara berkelompok maupun klasikal.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { value: 'Individu', label: 'Individu (Perorangan)', desc: 'Satu siswa secara khusus' },
                  { value: 'Kelompok', label: 'Kelompok', desc: 'Beberapa siswa terpilih' },
                  { value: 'Klasikal', label: 'Klasikal', desc: 'Satu kelas secara umum' }
                ].map((option) => {
                  const isSelected = targetType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTargetType(option.value as any)}
                      className={`flex flex-col p-3 border rounded-xl text-left hover:bg-[#f4fffc]/40 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#00685f] bg-[#f4fffc] ring-2 ring-[#00685f]/25'
                          : 'border-[#bcc9c6]/30 bg-white'
                      }`}
                    >
                      <span className="text-xs font-bold text-[#0b1c30] flex items-center justify-between">
                        {option.label}
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#00685f]" />}
                      </span>
                      <span className="text-[10px] text-[#3d4947]/70 mt-1 leading-normal font-semibold">
                        {option.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Participant Selector component */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#bcc9c6]/30">
            <div className="flex justify-between items-center mb-4 border-b border-[#bcc9c6]/10 pb-3">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#0b1c30] flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-[#00685f] rounded-full"></span>
                Peserta Layanan
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  targetType === 'Individu'
                    ? 'bg-red-50 text-red-600 border border-red-100'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                }`}>
                  {targetType === 'Individu' ? 'Wajib Diisi' : 'Opsional'}
                </span>
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
                <div className="text-center py-6 border-2 border-dashed border-[#bcc9c6]/30 rounded-xl text-xs text-gray-400 font-semibold px-4">
                  {targetType === 'Individu'
                    ? 'Belum ada peserta yang dimasukkan. Gunakan tombol "+ Tambah Siswa" di atas (Wajib Diisi).'
                    : 'Belum ada peserta khusus yang dimasukkan. Anda bisa membiarkannya kosong untuk sasaran Kelompok/Klasikal, atau tetap menambahkan peserta jika diperlukan.'}
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

          {/* Foto Bukti Layanan BK (Kamera Langsung / Upload File) */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#bcc9c6]/30 space-y-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-[#3d4947] flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#00685f]" />
              Bukti Foto Sesi (Opsional)
            </h3>
            <p className="text-[10px] text-gray-500 font-semibold leading-normal">
              Ambil foto langsung melalui kamera HP/laptop Anda atau pilih file foto dari penyimpanan sebagai bukti valid.
            </p>

            {proofPhotoUrl ? (
              <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 p-2 text-center">
                <img
                  src={proofPhotoUrl}
                  alt="Bukti Sesi Layanan"
                  className="max-h-40 mx-auto object-contain rounded-lg"
                  referrerPolicy="no-referrer"
                />
                <p className="text-[10px] text-gray-500 truncate mt-1.5 font-bold">
                  {proofPhotoName}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setProofPhotoUrl(undefined);
                    setProofPhotoName(undefined);
                  }}
                  className="absolute top-2 right-2 bg-red-600 text-white hover:bg-red-700 p-1.5 rounded-full shadow-md cursor-pointer transition-colors"
                  title="Hapus Foto"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {showCamera ? (
                  <div className="relative bg-black rounded-xl overflow-hidden border border-gray-300">
                    {cameraError ? (
                      <div className="p-4 text-center text-xs text-red-600 font-semibold">
                        <AlertCircle className="w-6 h-6 mx-auto text-red-600 mb-1" />
                        <p>{cameraError}</p>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="mt-2 px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-[10px] cursor-pointer"
                        >
                          Tutup Kamera
                        </button>
                      </div>
                    ) : (
                      <>
                        <video
                          ref={videoRef}
                          playsInline
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute bottom-2 inset-x-0 flex justify-center gap-2 px-4">
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="bg-[#00685f] hover:bg-[#005049] text-white px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-md cursor-pointer flex items-center gap-1"
                          >
                            <Camera className="w-3.5 h-3.5" /> Ambil Foto
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="bg-gray-800/80 hover:bg-gray-900 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-md cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex flex-col items-center justify-center p-4 border border-dashed border-[#bcc9c6]/60 bg-[#f8f9ff] rounded-xl hover:bg-gray-50 hover:border-[#00685f]/80 transition-all cursor-pointer text-center"
                    >
                      <Camera className="w-5 h-5 text-[#00685f] mb-1" />
                      <span className="text-[10px] font-bold text-[#0b1c30]">Kamera HP</span>
                    </button>

                    <label className="flex flex-col items-center justify-center p-4 border border-dashed border-[#bcc9c6]/60 bg-[#f8f9ff] rounded-xl hover:bg-gray-50 hover:border-[#00685f]/80 transition-all cursor-pointer text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProofFileChange}
                        className="sr-only"
                      />
                      <ImageIcon className="w-5 h-5 text-[#6b38d4] mb-1" />
                      <span className="text-[10px] font-bold text-[#0b1c30]">Pilih File</span>
                    </label>
                  </div>
                )}
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
