import React, { useState, useEffect, useMemo } from 'react';
import { Student, CounselingService, BKServiceType, BKComponentType, ServiceSpecificDetails, BidangBimbinganType } from '../types';
import { addToGoogleCalendar } from '../utils/calendarSync';
import GoogleDrivePhotoUploader from './GoogleDrivePhotoUploader';
import ServiceSpecificFields from './ServiceSpecificFields';
import {
  BK_COMPONENTS_DATA,
  FOKUS_ISU_LIST,
  BIDANG_BIMBINGAN_OPTIONS,
  isBidangBimbinganApplicable,
  getBKComponentForService,
  getComponentColorConfig,
  getServiceFormConfig
} from '../utils/bkKomprehensif';
import { TemplatePicker } from './TemplatePicker';
import {
  DEFAULT_PROBLEM_TEMPLATES,
  DEFAULT_FOLLOWUP_TEMPLATES,
  getCustomProblemTemplates,
  saveCustomProblemTemplate,
  deleteCustomProblemTemplate,
  getCustomFollowUpTemplates,
  saveCustomFollowUpTemplate,
  deleteCustomFollowUpTemplate,
  LayananTemplateItem
} from '../utils/layananTemplates';
import { showToast } from '../utils/toast';
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
  SlidersHorizontal as Sliders,
  Layers,
  Check
} from 'lucide-react';

interface EditLayananModalProps {
  service: CounselingService | null;
  students: Student[];
  onSave: (updatedService: CounselingService) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export default function EditLayananModal({
  service,
  students,
  onSave,
  onDelete,
  onClose,
}: EditLayananModalProps) {
  if (!service) return null;

  const initialComponent = service.bkComponent || getBKComponentForService(service.serviceType);
  const [bkComponent, setBkComponent] = useState<BKComponentType>(initialComponent);
  const [serviceType, setServiceType] = useState<BKServiceType>(service.serviceType);
  const [bidangBimbingan, setBidangBimbingan] = useState<BidangBimbinganType>(
    service.bidangBimbingan || (service.specificDetails?.bidangBimbingan as any) || 'Pribadi'
  );
  const [focusIssue, setFocusIssue] = useState<string>(service.focusIssue || '');
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
  const [specificDetails, setSpecificDetails] = useState<ServiceSpecificDetails>(service.specificDetails || {});
  const [showOptionalFields, setShowOptionalFields] = useState(
    Boolean(service.output || service.followUp || service.proofPhotoUrl)
  );

  const formConfig = useMemo(() => {
    return getServiceFormConfig(serviceType, bkComponent);
  }, [serviceType, bkComponent]);

  const [proofPhotoUrl, setProofPhotoUrl] = useState<string>(service.proofPhotoUrl || '');
  const [proofPhotoName, setProofPhotoName] = useState<string>(service.proofPhotoName || '');
  const [driveFileId, setDriveFileId] = useState<string | undefined>(service.driveFileId);
  const [driveViewUrl, setDriveViewUrl] = useState<string | undefined>(service.driveViewUrl);

  // Student search/selection popover state
  const [showAddStudentPopover, setShowAddStudentPopover] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Quick Problem & Follow-Up Templates State
  const [customProblemTemplates, setCustomProblemTemplates] = useState<LayananTemplateItem[]>(() => getCustomProblemTemplates());
  const [customFollowUpTemplates, setCustomFollowUpTemplates] = useState<LayananTemplateItem[]>(() => getCustomFollowUpTemplates());

  const handleSaveCustomProblem = (name: string, text: string) => {
    const updated = saveCustomProblemTemplate(name, text);
    setCustomProblemTemplates(updated);
    showToast('Template masalah berhasil disimpan', 'success');
  };

  const handleDeleteCustomProblem = (id: string) => {
    const updated = deleteCustomProblemTemplate(id);
    setCustomProblemTemplates(updated);
    showToast('Template masalah telah dihapus', 'info');
  };

  const handleSaveCustomFollowUp = (name: string, text: string) => {
    const updated = saveCustomFollowUpTemplate(name, text);
    setCustomFollowUpTemplates(updated);
    showToast('Template tindak lanjut berhasil disimpan', 'success');
  };

  const handleDeleteCustomFollowUp = (id: string) => {
    const updated = deleteCustomFollowUpTemplate(id);
    setCustomFollowUpTemplates(updated);
    showToast('Template tindak lanjut telah dihapus', 'info');
  };

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
      st &&
      !selectedStudents.some((s) => s.id === st.id) &&
      (String(st.name || '').toLowerCase().includes(studentSearchQuery.toLowerCase().trim()) ||
        String(st.class || '').toLowerCase().includes(studentSearchQuery.toLowerCase().trim()) ||
        String(st.nis ?? '').toLowerCase().includes(studentSearchQuery.toLowerCase().trim()) ||
        String(st.nisn ?? '').toLowerCase().includes(studentSearchQuery.toLowerCase().trim()))
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
      bkComponent,
      serviceType,
      bidangBimbingan: isBidangBimbinganApplicable(bkComponent) ? bidangBimbingan : 'Non-Bidang (Dukungan Sistem)',
      focusIssue: focusIssue.trim() || undefined,
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
      specificDetails: {
        ...specificDetails,
        bidangBimbingan: isBidangBimbinganApplicable(bkComponent) ? bidangBimbingan : 'Non-Bidang (Dukungan Sistem)',
      },
      proofPhotoUrl: proofPhotoUrl || undefined,
      proofPhotoName: proofPhotoName || undefined,
      driveFileId: driveFileId || undefined,
      driveViewUrl: driveViewUrl || undefined,
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
                Perbarui status, pilar bimbingan, fokus isu, waktu, pembahasan, atau peserta sesi.
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

          {/* 4 Pillars & Service Type Selection */}
          <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-200 space-y-3">
            <label className="text-xs font-bold text-[#0b1c30] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#00685f]" />
                Komponen Pilar BK Komprehensif
              </span>
              <span className="text-[10px] font-black text-[#00685f] bg-[#00685f]/10 px-2 py-0.5 rounded-full">
                {bkComponent}
              </span>
            </label>

            {/* Pillar Selector Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {BK_COMPONENTS_DATA.map((comp) => {
                const isActive = bkComponent === comp.id;
                return (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => {
                      setBkComponent(comp.id);
                      if (!comp.services.some(s => s.type === serviceType)) {
                        setServiceType(comp.services[0].type);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold text-left border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-[9px] opacity-80 font-bold">Pilar {comp.pilarNumber}</div>
                    <div className="truncate">{comp.name}</div>
                  </button>
                );
              })}
            </div>

            {/* Service & Format Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-600 block">
                  Jenis Layanan Spesifik
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => {
                    const newType = e.target.value as BKServiceType;
                    setServiceType(newType);
                    const comp = getBKComponentForService(newType);
                    setBkComponent(comp);
                  }}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] cursor-pointer"
                >
                  {BK_COMPONENTS_DATA.map((comp) => (
                    <optgroup key={comp.id} label={`Pilar ${comp.pilarNumber}: ${comp.name}`}>
                      {comp.services.map((s) => (
                        <option key={s.type} value={s.type}>
                          {s.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-600 block">
                  Format Sasaran
                </label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as any)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] cursor-pointer"
                >
                  <option value="Individu">Individu (Perorangan)</option>
                  <option value="Kelompok">Kelompok (Beberapa Siswa)</option>
                  <option value="Klasikal">Klasikal (Satu Kelas)</option>
                </select>
              </div>
            </div>

            {/* Fokus Isu Selection */}
            <div className="pt-2 border-t border-gray-200/60">
              <label className="text-[11px] font-bold text-gray-600 block mb-1.5">
                Fokus Isu / Tema Bimbingan
              </label>
              <div className="flex flex-wrap gap-1 mb-2">
                {FOKUS_ISU_LIST.map((isu) => {
                  const isPicked = focusIssue === isu.id;
                  return (
                    <button
                      key={isu.id}
                      type="button"
                      onClick={() => setFocusIssue(isPicked ? '' : isu.id)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer border ${
                        isPicked
                          ? 'bg-[#00685f] text-white border-[#00685f]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#00685f]/40'
                      }`}
                    >
                      {isu.label}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={focusIssue}
                onChange={(e) => setFocusIssue(e.target.value)}
                placeholder="Fokus isu (contoh: Anti-Bullying, Hambatan Belajar)..."
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-medium text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
              />
            </div>

            {/* Bidang Bimbingan Standar Isi (Pribadi, Sosial, Belajar, Karier, Lintas Bidang) */}
            {isBidangBimbinganApplicable(bkComponent) ? (
              <div className="pt-2 border-t border-gray-200/60">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-gray-700 block">
                    Bidang Bimbingan Konseling <span className="text-[#00685f]">(Standar Isi BK)</span>
                  </label>
                  <span className="text-[10px] text-gray-400 font-semibold">4 Bidang Utama + Lintas Bidang</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {BIDANG_BIMBINGAN_OPTIONS.map((bid) => {
                    const isSelected = bidangBimbingan === bid.id || (bid.id === 'Karier' && (bidangBimbingan as string) === 'Karir');
                    return (
                      <button
                        key={bid.id}
                        type="button"
                        onClick={() => setBidangBimbingan(bid.id as BidangBimbinganType)}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-[#00685f] bg-[#f4fffc] ring-2 ring-[#00685f]/25 shadow-2xs'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-extrabold ${isSelected ? 'text-[#00685f]' : 'text-[#0b1c30]'}`}>
                            {bid.label}
                          </span>
                          {isSelected && <Check className="w-3 h-3 text-[#00685f]" />}
                        </div>
                        <span className="text-[9px] text-gray-500 font-medium line-clamp-1 mt-0.5">
                          {bid.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-gray-200/60">
                <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl text-[11px] font-medium text-purple-900">
                  <span className="font-extrabold">Kategori Non-Bidang Siswa:</span> Layanan Dukungan Sistem berfokus pada manajerial, keprofesian (MGBK), kemitraan, dan supervisi.
                </div>
              </div>
            )}
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

          {/* Problem / Topic with contextual label */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#64748b] block">
              {formConfig.problemLabel} <span className="text-red-500">*</span>
            </label>

            {/* Template Cepat Masalah */}
            <TemplatePicker
              label="Masalah"
              defaultTemplates={DEFAULT_PROBLEM_TEMPLATES}
              customTemplates={customProblemTemplates}
              currentValue={problem}
              onSelect={(templateText) => {
                setProblem(templateText);
                showToast('Template masalah diterapkan', 'info');
              }}
              onSaveCustom={handleSaveCustomProblem}
              onDeleteCustom={handleDeleteCustomProblem}
            />

            <input
              type="text"
              required
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder={formConfig.problemPlaceholder}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
            />
          </div>

          {/* Contextual Specific Fields according to Pillar & Service */}
          <ServiceSpecificFields
            serviceType={serviceType}
            bkComponent={bkComponent}
            details={specificDetails}
            onChange={setSpecificDetails}
          />

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#64748b] block">
              {formConfig.descriptionLabel}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={formConfig.descriptionPlaceholder}
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
                    {formConfig.outputLabel}
                  </label>
                  <textarea
                    rows={2}
                    value={output}
                    onChange={(e) => setOutput(e.target.value)}
                    placeholder={formConfig.outputPlaceholder}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs font-medium text-[#3d4947] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] leading-relaxed"
                  />
                </div>

                {/* Follow Up Plan */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#00685f] block">
                    {formConfig.followUpLabel}
                  </label>

                  {/* Template Cepat Tindak Lanjut */}
                  <TemplatePicker
                    label="Tindak Lanjut"
                    defaultTemplates={DEFAULT_FOLLOWUP_TEMPLATES}
                    customTemplates={customFollowUpTemplates}
                    currentValue={followUp}
                    onSelect={(templateText) => {
                      setFollowUp(templateText);
                      showToast('Template tindak lanjut diterapkan', 'info');
                    }}
                    onSaveCustom={handleSaveCustomFollowUp}
                    onDeleteCustom={handleDeleteCustomFollowUp}
                  />

                  <textarea
                    rows={2}
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    placeholder={formConfig.followUpPlaceholder}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs font-medium text-[#3d4947] focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] leading-relaxed"
                  />
                </div>

                {/* Proof Photo Upload via Google Drive */}
                <div className="border-t border-gray-100 pt-3">
                  <GoogleDrivePhotoUploader
                    photoUrl={proofPhotoUrl}
                    photoName={proofPhotoName}
                    driveFileId={driveFileId}
                    driveViewUrl={driveViewUrl}
                    category="sesi"
                    studentName={selectedStudents.map(s => s.name).join(', ')}
                    date={date}
                    label="Bukti Foto Sesi (Google Drive)"
                    onPhotoChange={({ photoUrl, photoName, driveFileId, driveViewUrl }) => {
                      setProofPhotoUrl(photoUrl || '');
                      setProofPhotoName(photoName || '');
                      setDriveFileId(driveFileId);
                      setDriveViewUrl(driveViewUrl);
                    }}
                  />
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
