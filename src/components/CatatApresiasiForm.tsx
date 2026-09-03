import React, { useState, useMemo } from 'react';
import { Student, StudentAchievement, Counselor } from '../types';
import { 
  Award, 
  Search, 
  PlusCircle, 
  CheckCircle, 
  Trash2, 
  Edit3, 
  Calendar, 
  Clock, 
  UserCheck, 
  Star, 
  Sparkles, 
  Filter, 
  X, 
  Save, 
  FileText,
  Trophy,
  Users
} from 'lucide-react';
import { APPRECIATION_TEMPLATES } from '../data/appreciationTemplates';

interface CatatApresiasiFormProps {
  students: Student[];
  achievements: StudentAchievement[];
  activeCounselor: Counselor;
  preSelectedStudentId?: string;
  onSaveAchievement: (achievement: Omit<StudentAchievement, 'id'>) => void;
  onDeleteAchievement?: (id: string) => void;
  onUpdateAchievement?: (achievement: StudentAchievement) => void;
  onUpdateStudent?: (student: Student) => void;
  onDeleteStudent?: (id: string) => void;
  onCancel: () => void;
}

export default function CatatApresiasiForm({
  students,
  achievements,
  activeCounselor,
  preSelectedStudentId,
  onSaveAchievement,
  onDeleteAchievement,
  onUpdateAchievement,
  onUpdateStudent,
  onDeleteStudent,
  onCancel,
}: CatatApresiasiFormProps) {
  // Navigation Tabs: 'input' | 'arsip'
  const [activeTab, setActiveTab] = useState<'input' | 'arsip'>('input');

  // Search & Filters in Archive Tab
  const [archiveSearch, setArchiveSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Student Edit Modal
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentClass, setEditStudentClass] = useState('');
  const [editStudentNis, setEditStudentNis] = useState('');

  // Selected Students for New Appreciation
  const [studentQuery, setStudentQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>(() => {
    if (preSelectedStudentId) {
      const found = students.find((s) => s.id === preSelectedStudentId);
      return found ? [found] : [];
    }
    return [];
  });

  // Category & Option Selection
  const [selectedCategory, setSelectedCategory] = useState<string>('Akademik');
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [customAchievementName, setCustomAchievementName] = useState<string>('');
  const [pointsAdded, setPointsAdded] = useState<number>(15);

  // Date, Time & Context
  const [incidentDate, setIncidentDate] = useState<string>(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - tzOffset).toISOString().slice(0, 10);
  });
  const [incidentTime, setIncidentTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [location, setLocation] = useState<string>('Lingkungan Sekolah');
  const [notes, setNotes] = useState<string>('');

  // Modal State for Editing Achievement in Archive
  const [editingAchievement, setEditingAchievement] = useState<StudentAchievement | null>(null);

  // Student search filtered results
  const searchResults = useMemo(() => {
    if (!Array.isArray(students)) return [];
    if (!studentQuery.trim()) return [];
    const q = studentQuery.toLowerCase().trim();
    return students
      .filter((s) => s && (String(s.name || '').toLowerCase().includes(q) || String(s.nis || '').toLowerCase().includes(q) || String(s.class || '').toLowerCase().includes(q)))
      .filter((s) => !selectedStudents.some((selected) => selected.id === s.id))
      .slice(0, 8);
  }, [students, studentQuery, selectedStudents]);

  // Current options list based on category
  const currentCategoryObj = useMemo(() => {
    return APPRECIATION_TEMPLATES.find((cat) => cat.id === selectedCategory || cat.name === selectedCategory);
  }, [selectedCategory]);

  const currentOptions = useMemo(() => {
    return currentCategoryObj?.options || [];
  }, [currentCategoryObj]);

  // Handle Option selection
  const handleSelectOption = (optionId: string) => {
    setSelectedOptionId(optionId);
    if (optionId === 'custom') {
      setCustomAchievementName('');
      setPointsAdded(10);
    } else {
      const opt = currentOptions.find((o) => o.id === optionId);
      if (opt) {
        setCustomAchievementName(opt.label);
        setPointsAdded(opt.points);
      }
    }
  };

  // Add Student to Selection
  const handleAddStudentToSelection = (student: Student) => {
    setSelectedStudents((prev) => [...prev, student]);
    setStudentQuery('');
    setShowDropdown(false);
  };

  // Remove Student from Selection
  const handleRemoveStudentFromSelection = (studentId: string) => {
    setSelectedStudents((prev) => prev.filter((s) => s.id !== studentId));
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudents.length === 0) {
      alert('Pilih minimal satu siswa penerima apresiasi!');
      return;
    }

    const achievementTitle = selectedOptionId === 'custom' ? customAchievementName.trim() : customAchievementName;
    if (!achievementTitle) {
      alert('Tuliskan atau pilih nama/deskripsi bentuk apresiasi!');
      return;
    }

    selectedStudents.forEach((student) => {
      onSaveAchievement({
        studentId: student.id,
        studentName: student.name,
        studentClass: student.class,
        achievementName: achievementTitle,
        category: currentCategoryObj?.name || selectedCategory,
        pointsReward: Number(pointsAdded) || 10,
        date: incidentDate,
        time: incidentTime,
        recordedBy: activeCounselor.name,
        notes: notes.trim() || `Diapresiasi di ${location}`,
        extraNotes: `Diapresiasi pada ${incidentDate} oleh ${activeCounselor.name}`,
      });
    });

    alert(`🎉 Berhasil mencatat Bobot Apresiasi (+${pointsAdded} bobot) untuk ${selectedStudents.length} siswa!`);
    
    // Reset form
    setSelectedStudents([]);
    setSelectedOptionId('');
    setCustomAchievementName('');
    setNotes('');
    setActiveTab('arsip');
  };

  // Filtered Archive List
  const filteredAchievements = useMemo(() => {
    if (!Array.isArray(achievements)) return [];
    const q = archiveSearch.toLowerCase().trim();
    return achievements.filter((ach) => {
      if (!ach) return false;
      const matchesSearch =
        !q ||
        String(ach.studentName || '').toLowerCase().includes(q) ||
        String(ach.studentClass || '').toLowerCase().includes(q) ||
        String(ach.achievementName || '').toLowerCase().includes(q) ||
        String(ach.category || '').toLowerCase().includes(q);

      const matchesCategory = categoryFilter === 'ALL' || String(ach.category || '').toLowerCase() === categoryFilter.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [achievements, archiveSearch, categoryFilter]);

  // Statistics for Archive
  const stats = useMemo(() => {
    const totalCount = achievements.length;
    const totalPoints = achievements.reduce((sum, a) => sum + (a.pointsReward || 0), 0);
    const uniqueStudents = new Set(achievements.map((a) => a.studentId)).size;
    return { totalCount, totalPoints, uniqueStudents };
  }, [achievements]);

  // Update Achievement Handler
  const handleSaveEditModal = () => {
    if (!editingAchievement) return;
    if (onUpdateAchievement) {
      onUpdateAchievement(editingAchievement);
      alert('✅ Data apresiasi siswa berhasil diperbarui!');
    }
    setEditingAchievement(null);
  };

  return (
    <div className="space-[#bcc9c6]/30 space-y-6 animate-in fade-in duration-300">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#bcc9c6]/30 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-emerald-200">
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              Modul Apresiasi & Prestasi Siswa
            </span>
            <span className="text-[10px] text-gray-400 font-semibold">BK SMP N 2 Susukan</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0b1c30]">
            Input & Log Apresiasi Karakter
          </h2>
          <p className="text-xs text-[#3d4947]/80 font-medium mt-0.5">
            Pencatatan apresiasi khusus, penguatan karakter positif, dan kredit penghargaan siswa secara terpisah dan terorganisir.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-[#f0f4f3] p-1.5 rounded-xl border border-[#bcc9c6]/30 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('input')}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'input'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-[#0b1c30] hover:bg-white/60'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Form Input Apresiasi</span>
          </button>
          <button
            onClick={() => setActiveTab('arsip')}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'arsip'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-[#0b1c30] hover:bg-white/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Arsip Log Apresiasi ({achievements.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'input' ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-xs space-y-6">
            <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-[#0b1c30] text-sm sm:text-base">
                  Beri Apresiasi / Kredit Karakter Positif
                </h3>
              </div>
              <span className="text-xs font-bold text-gray-500">
                Pencatat: <strong className="text-emerald-700">{activeCounselor.name}</strong>
              </span>
            </div>

            {/* Step 1: Student Selection */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                <Search className="w-4 h-4 text-emerald-600" />
                <span>Pilih Siswa Penerima Apresiasi (Dapat Pilih Lebih Dari Satu)</span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik NISN, nama lengkap, atau kelas siswa..."
                  value={studentQuery}
                  onChange={(e) => {
                    setStudentQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-2xs font-medium"
                />
                <Search className="w-4.5 h-4.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />

                {/* Autocomplete Suggestions */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#bcc9c6]/40 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-gray-100">
                    {searchResults.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleAddStudentToSelection(st)}
                        className="w-full text-left p-3 hover:bg-emerald-50/80 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <p className="text-xs font-bold text-[#0b1c30]">{st.name}</p>
                          <p className="text-[10px] text-gray-500">
                            NISN: {st.nis} • Kelas: {st.class}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          + Pilih
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Students Chips */}
              {selectedStudents.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedStudents.map((st) => (
                    <span
                      key={st.id}
                      className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      {st.name} ({st.class})
                      <button
                        type="button"
                        onClick={() => handleRemoveStudentFromSelection(st.id)}
                        className="ml-1 text-emerald-700 hover:text-red-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Category & Preset Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#0b1c30] block">Kategori Apresiasi / Prestasi</label>
                <div className="grid grid-cols-1 gap-2">
                  {APPRECIATION_TEMPLATES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSelectedOptionId('');
                        setCustomAchievementName('');
                      }}
                      className={`p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                        selectedCategory === cat.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>{cat.name}</span>
                      {selectedCategory === cat.id && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Options for selected category */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#0b1c30] block">Pilih Bentuk Apresiasi / Prestasi</label>
                <select
                  value={selectedOptionId}
                  onChange={(e) => handleSelectOption(e.target.value)}
                  className="w-full text-xs bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-3 font-semibold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                >
                  <option value="">-- Pilih Templat Apresiasi --</option>
                  {currentOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label} (+{opt.points} Bobot)
                    </option>
                  ))}
                  <option value="custom">✏️ Apresiasi Kustom (Tulis Manual & Tentukan Bobot)</option>
                </select>

                {/* Custom Achievement Name Input if custom or edited */}
                {(selectedOptionId === 'custom' || selectedOptionId) && (
                  <div className="space-y-2 pt-2">
                    <label className="text-[11px] font-bold text-gray-700 block">Nama / Deskripsi Apresiasi</label>
                    <input
                      type="text"
                      value={customAchievementName}
                      onChange={(e) => setCustomAchievementName(e.target.value)}
                      placeholder="Contoh: Meraih Juara 1 Lomba Pidato Bahasa Inggris..."
                      className="w-full text-xs bg-white border border-[#bcc9c6]/40 rounded-xl p-3 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />

                    <label className="text-[11px] font-bold text-gray-700 block pt-2">
                      Bobot Apresiasi (+ Kredit Positif)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={pointsAdded}
                        onChange={(e) => setPointsAdded(Number(e.target.value))}
                        className="w-24 text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex items-center gap-1">
                        {[5, 10, 15, 20, 25, 30].map((pt) => (
                          <button
                            key={pt}
                            type="button"
                            onClick={() => setPointsAdded(pt)}
                            className={`px-2 py-1 text-[10px] font-bold rounded-lg border cursor-pointer ${
                              pointsAdded === pt
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                            }`}
                          >
                            +{pt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Date, Time & Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-100 pt-4">
              <div>
                <label className="text-xs font-bold text-[#0b1c30] block mb-1">Tanggal Pemberian</label>
                <input
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full text-xs bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-2.5 font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0b1c30] block mb-1">Jam Pemberian</label>
                <input
                  type="time"
                  value={incidentTime}
                  onChange={(e) => setIncidentTime(e.target.value)}
                  className="w-full text-xs bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-2.5 font-bold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0b1c30] block mb-1">Lokasi / Konteks Kegiatan</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Misal: Lapangan Upacara, Ruang BK..."
                  className="w-full text-xs bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-2.5 font-medium text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#0b1c30] block mb-1">
                Catatan / Keterangan Kebaikan (Opsional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tuliskan catatan apresiasi tambahan atau apresiasi lisan dari sekolah..."
                className="w-full text-xs bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl p-3 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Buttons Bar */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={selectedStudents.length === 0 || !customAchievementName.trim()}
                className={`px-6 py-3 rounded-xl text-xs font-extrabold text-white flex items-center gap-2 shadow-md transition-all cursor-pointer ${
                  selectedStudents.length === 0 || !customAchievementName.trim()
                    ? 'bg-gray-300 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-97'
                }`}
              >
                <Award className="w-4 h-4 text-emerald-200" />
                <span>Simpan & Berikan Bobot Apresiasi</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* ARCHIVE TAB */
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/30 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-200">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Total Log Apresiasi</p>
                <h4 className="text-xl font-black text-[#0b1c30]">{stats.totalCount} Catatan</h4>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/30 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600 border border-amber-200">
                <Star className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Akumulasi Bobot Kredit</p>
                <h4 className="text-xl font-black text-emerald-600">+{stats.totalPoints} Bobot</h4>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/30 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600 border border-blue-200">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Siswa Penerima</p>
                <h4 className="text-xl font-black text-[#0b1c30]">{stats.uniqueStudents} Siswa</h4>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/30 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari nama, kelas, atau nama prestasi..."
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 font-extrabold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="ALL">Semua Kategori</option>
                {APPRECIATION_TEMPLATES.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Achievement List Table */}
          <div className="bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-xs overflow-hidden">
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {filteredAchievements.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Award className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-bold">Belum Ada Log Apresiasi / Prestasi Tercatat</p>
                  <p className="text-xs mt-1">Gunakan tab Form Input Apresiasi untuk memberikan penghargaan pertama.</p>
                </div>
              ) : (
                filteredAchievements.map((ach) => (
                  <div
                    key={ach.id}
                    className="p-4 sm:px-6 hover:bg-emerald-50/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                        +{ach.pointsReward}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const st = students.find(s => s.id === ach.studentId || s.name === ach.studentName);
                              if (st) {
                                setSelectedStudentForEdit(st);
                                setEditStudentName(st.name);
                                setEditStudentClass(st.class);
                                setEditStudentNis(st.nis);
                              } else {
                                alert(`Siswa: ${ach.studentName} (${ach.studentClass})`);
                              }
                            }}
                            className="text-xs font-black text-[#0b1c30] hover:text-emerald-700 hover:underline cursor-pointer text-left"
                            title="Klik untuk melihat / edit profil siswa"
                          >
                            {ach.studentName}
                          </button>
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {ach.studentClass}
                          </span>
                          <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                            {ach.category}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-emerald-950 mt-1">{ach.achievementName}</p>
                        {ach.notes && (
                          <p className="text-[11px] text-gray-600 font-medium mt-0.5 italic">"{ach.notes}"</p>
                        )}
                        <p className="text-[10px] text-gray-400 font-medium mt-1">
                          Pencatat: {ach.recordedBy || 'Guru BK'} • Tanggal: {ach.date} {ach.time ? `(${ach.time})` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingAchievement(ach)}
                        className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      {onDeleteAchievement && (
                        <button
                          type="button"
                          onClick={() => onDeleteAchievement(ach.id)}
                          className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingAchievement && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-sm text-[#0b1c30]">Edit Bobot Apresiasi Siswa</h3>
              <button
                type="button"
                onClick={() => setEditingAchievement(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block">Siswa</label>
                <p className="text-xs font-bold text-[#0b1c30]">
                  {editingAchievement.studentName} ({editingAchievement.studentClass})
                </p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block">Nama Apresiasi / Prestasi</label>
                <input
                  type="text"
                  value={editingAchievement.achievementName}
                  onChange={(e) =>
                    setEditingAchievement({ ...editingAchievement, achievementName: e.target.value })
                  }
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block">Bobot Kredit Apresiasi</label>
                <input
                  type="number"
                  value={editingAchievement.pointsReward}
                  onChange={(e) =>
                    setEditingAchievement({ ...editingAchievement, pointsReward: Number(e.target.value) })
                  }
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block">Catatan</label>
                <textarea
                  rows={2}
                  value={editingAchievement.notes}
                  onChange={(e) => setEditingAchievement({ ...editingAchievement, notes: e.target.value })}
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setEditingAchievement(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEditModal}
                className="px-4 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK STUDENT EDIT MODAL */}
      {selectedStudentForEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-[#0b1c30]">Profil & Edit Data Siswa</h3>
                <p className="text-[11px] text-gray-500">
                  Ubah data atau hapus siswa langsung dari arsip apresiasi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForEdit(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Kelas</label>
                  <input
                    type="text"
                    value={editStudentClass}
                    onChange={(e) => setEditStudentClass(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">NIS / NISN</label>
                  <input
                    type="text"
                    value={editStudentNis}
                    onChange={(e) => setEditStudentNis(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs space-y-1">
                <p className="font-bold text-gray-700">Ringkasan Bobot Karakter Siswa:</p>
                <p className="text-red-600 font-extrabold">Total Bobot Pelanggaran: {selectedStudentForEdit.violationPoints} Bobot</p>
                <p className="text-emerald-600 font-extrabold">Total Bobot Apresiasi: +{selectedStudentForEdit.achievementPoints || 0} Bobot</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              {onDeleteStudent && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Apakah Anda yakin ingin menghapus data siswa ${selectedStudentForEdit.name} dari sistem?`)) {
                      onDeleteStudent(selectedStudentForEdit.id);
                      setSelectedStudentForEdit(null);
                    }
                  }}
                  className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Siswa</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setSelectedStudentForEdit(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
                >
                  Tutup
                </button>
                {onUpdateStudent && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateStudent({
                        ...selectedStudentForEdit,
                        name: editStudentName,
                        class: editStudentClass,
                        nis: editStudentNis,
                      });
                      setSelectedStudentForEdit(null);
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer shadow-sm"
                  >
                    Simpan Perubahan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
