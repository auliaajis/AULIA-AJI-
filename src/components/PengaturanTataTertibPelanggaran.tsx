import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ViolationCategory,
  ViolationOption,
  getSchoolViolationCategories,
  saveSchoolViolationCategories,
  resetSchoolViolationCategoriesToPreset,
  exportViolationRulesJSON,
  importViolationRulesJSON,
  PRESET_MAP,
  DEFAULT_VIOLATION_CATEGORIES
} from '../utils/violationRulesConfig';
import { getSchoolConfig, getActiveSchoolId } from '../utils/schoolConfig';
import {
  Gavel,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  Download,
  Upload,
  Search,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Sliders,
  BookOpen,
  Info,
  Check,
  X,
  FileCode,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface PengaturanTataTertibPelanggaranProps {
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function PengaturanTataTertibPelanggaran({
  onShowToast
}: PengaturanTataTertibPelanggaranProps) {
  const activeSchoolId = getActiveSchoolId();
  const schoolConfig = getSchoolConfig();

  const [categories, setCategories] = useState<ViolationCategory[]>(() => {
    return getSchoolViolationCategories(activeSchoolId);
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('smp_mts');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Modals
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id?: string; name: string; description: string; color: string } | null>(null);

  const [showOptionModal, setShowOptionModal] = useState(false);
  const [editingOption, setEditingOption] = useState<{ categoryId: string; optionId?: string; label: string; points: number; description: string } | null>(null);

  const [showPresetConfirmModal, setShowPresetConfirmModal] = useState(false);
  const [pendingPresetKey, setPendingPresetKey] = useState<string>('smp_mts');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with school switch
  useEffect(() => {
    const loaded = getSchoolViolationCategories(activeSchoolId);
    setCategories(loaded);
    setHasUnsavedChanges(false);
  }, [activeSchoolId]);

  // Expand all categories by default
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    categories.forEach((c) => {
      initial[c.id] = true;
    });
    setExpandedCategories((prev) => ({ ...initial, ...prev }));
  }, [categories]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalCategories = categories.length;
    let totalOptions = 0;
    let minPoints = 999;
    let maxPoints = 0;
    let totalPointsSum = 0;

    categories.forEach((cat) => {
      totalOptions += cat.options.length;
      cat.options.forEach((opt) => {
        if (opt.points < minPoints) minPoints = opt.points;
        if (opt.points > maxPoints) maxPoints = opt.points;
        totalPointsSum += opt.points;
      });
    });

    return {
      totalCategories,
      totalOptions,
      minPoints: minPoints === 999 ? 0 : minPoints,
      maxPoints,
      avgPoints: totalOptions > 0 ? Math.round(totalPointsSum / totalOptions) : 0
    };
  }, [categories]);

  // Filtered categories & options
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return categories;

    return categories
      .map((cat) => {
        const catMatch = cat.name.toLowerCase().includes(q) || (cat.description && cat.description.toLowerCase().includes(q));
        const matchedOptions = cat.options.filter(
          (opt) => opt.label.toLowerCase().includes(q) || (opt.description && opt.description.toLowerCase().includes(q))
        );

        if (catMatch) {
          return cat;
        }
        if (matchedOptions.length > 0) {
          return {
            ...cat,
            options: matchedOptions
          };
        }
        return null;
      })
      .filter(Boolean) as ViolationCategory[];
  }, [categories, searchQuery]);

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const handleSaveAll = () => {
    setIsSaving(true);
    saveSchoolViolationCategories(categories, activeSchoolId);
    setHasUnsavedChanges(false);
    setTimeout(() => {
      setIsSaving(false);
      onShowToast?.('Standar bobot & tata tertib pelanggaran berhasil disimpan dan disinkronkan ke seluruh guru/konselor sekolah!', 'success');
    }, 400);
  };

  const handlePointChange = (categoryId: string, optionId: string, newPoints: number) => {
    const safePoints = Math.max(1, Math.min(200, isNaN(newPoints) ? 1 : newPoints));
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== categoryId) return cat;
        return {
          ...cat,
          options: cat.options.map((opt) => (opt.id === optionId ? { ...opt, points: safePoints } : opt))
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleApplyPreset = (presetKey: string) => {
    setPendingPresetKey(presetKey);
    setShowPresetConfirmModal(true);
  };

  const confirmApplyPreset = () => {
    const loaded = resetSchoolViolationCategoriesToPreset(pendingPresetKey, activeSchoolId);
    setCategories(loaded);
    setSelectedPreset(pendingPresetKey);
    setShowPresetConfirmModal(false);
    setHasUnsavedChanges(false);
    onShowToast?.(`Template tata tertib berhasil diterapkan: ${PRESET_MAP[pendingPresetKey]?.label}`, 'success');
  };

  // Export JSON
  const handleExportJSON = () => {
    const jsonStr = exportViolationRulesJSON(categories, schoolConfig.schoolName);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanSchoolName = (schoolConfig.schoolName || 'sekolah').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    a.download = `tata_tertib_pelanggaran_${cleanSchoolName}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast?.('Buku tata tertib & bobot pelanggaran berhasil diekspor (JSON)', 'success');
  };

  // Import JSON
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = importViolationRulesJSON(content);
      if (parsed) {
        setCategories(parsed);
        saveSchoolViolationCategories(parsed, activeSchoolId);
        setHasUnsavedChanges(false);
        onShowToast?.(`Berhasil mengimpor ${parsed.length} kategori tata tertib dari berkas!`, 'success');
      } else {
        onShowToast?.('Gagal mengimpor berkas. Format JSON tidak sesuai struktur tata tertib.', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Delete Category
  const handleDeleteCategory = (catId: string, catName: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus kategori "${catName}" beserta seluruh butir pelanggarannya?`)) {
      setCategories((prev) => prev.filter((c) => c.id !== catId));
      setHasUnsavedChanges(true);
      onShowToast?.(`Kategori "${catName}" telah dihapus`, 'info');
    }
  };

  // Delete Option
  const handleDeleteOption = (catId: string, optId: string, optLabel: string) => {
    if (window.confirm(`Hapus butir pelanggaran: "${optLabel}"?`)) {
      setCategories((prev) =>
        prev.map((cat) => {
          if (cat.id !== catId) return cat;
          return {
            ...cat,
            options: cat.options.filter((o) => o.id !== optId)
          };
        })
      );
      setHasUnsavedChanges(true);
      onShowToast?.(`Butir pelanggaran "${optLabel}" dihapus`, 'info');
    }
  };

  // Save Category Modal
  const handleSaveCategoryModal = () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      onShowToast?.('Nama kategori tidak boleh kosong', 'error');
      return;
    }

    if (editingCategory.id) {
      // Edit existing
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingCategory.id
            ? {
                ...c,
                name: editingCategory.name.trim(),
                description: editingCategory.description.trim(),
                color: editingCategory.color
              }
            : c
        )
      );
    } else {
      // Create new
      const newId = `kat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      setCategories((prev) => [
        ...prev,
        {
          id: newId,
          name: editingCategory.name.trim(),
          description: editingCategory.description.trim(),
          color: editingCategory.color,
          options: []
        }
      ]);
      setExpandedCategories((prev) => ({ ...prev, [newId]: true }));
    }

    setShowCategoryModal(false);
    setEditingCategory(null);
    setHasUnsavedChanges(true);
    onShowToast?.('Kategori tata tertib berhasil diperbarui', 'success');
  };

  // Save Option Modal
  const handleSaveOptionModal = () => {
    if (!editingOption || !editingOption.label.trim()) {
      onShowToast?.('Nama jenis pelanggaran tidak boleh kosong', 'error');
      return;
    }

    const safePoints = Math.max(1, Math.min(200, Number(editingOption.points) || 5));

    if (editingOption.optionId) {
      // Edit existing option
      setCategories((prev) =>
        prev.map((cat) => {
          if (cat.id !== editingOption.categoryId) return cat;
          return {
            ...cat,
            options: cat.options.map((opt) =>
              opt.id === editingOption.optionId
                ? {
                    ...opt,
                    label: editingOption.label.trim(),
                    points: safePoints,
                    description: editingOption.description.trim() || undefined
                  }
                : opt
            )
          };
        })
      );
    } else {
      // Add new option to category
      const newOptId = `opt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      setCategories((prev) =>
        prev.map((cat) => {
          if (cat.id !== editingOption.categoryId) return cat;
          return {
            ...cat,
            options: [
              ...cat.options,
              {
                id: newOptId,
                label: editingOption.label.trim(),
                points: safePoints,
                description: editingOption.description.trim() || undefined
              }
            ]
          };
        })
      );
    }

    setShowOptionModal(false);
    setEditingOption(null);
    setHasUnsavedChanges(true);
    onShowToast?.('Butir pelanggaran berhasil disimpan', 'success');
  };

  // Point badge color styling
  const getPointBadgeStyle = (points: number) => {
    if (points <= 10) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (points <= 30) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (points <= 50) {
      return 'bg-orange-50 text-orange-700 border-orange-200';
    } else {
      return 'bg-red-50 text-red-700 border-red-200 font-bold';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hidden File Input for JSON import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/40 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-[#00685f] rounded-full text-xs font-semibold border border-emerald-200">
              <Gavel className="w-3.5 h-3.5" />
              <span>Tata Tertib & Bobot Pelanggaran Fleksibel</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-[#0b1c30]">
              Standar Regulasi Pelanggaran Sekolah
            </h2>
            <p className="text-sm text-[#3d4947] max-w-2xl leading-relaxed">
              Sesuaikan bobot poin, kategori, dan jenis pelanggaran sesuai dengan ketentuan Buku Pedoman Tata Tertib di sekolah Anda (<strong>{schoolConfig.schoolName}</strong>). Setiap sekolah memiliki standar independen yang tidak saling mengganggu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportJSON}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 text-[#0b1c30] rounded-xl text-xs font-semibold border border-gray-200 transition-all shadow-2xs cursor-pointer"
              title="Ekspor buku aturan ke berkas JSON"
            >
              <Download className="w-4 h-4 text-gray-600" />
              <span>Ekspor JSON</span>
            </button>
            <button
              onClick={handleImportClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 text-[#0b1c30] rounded-xl text-xs font-semibold border border-gray-200 transition-all shadow-2xs cursor-pointer"
              title="Impor aturan dari berkas JSON sekolah lain"
            >
              <Upload className="w-4 h-4 text-gray-600" />
              <span>Impor JSON</span>
            </button>
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-[#00685f] hover:bg-[#005049] ring-2 ring-[#00685f]/30 ring-offset-1 animate-pulse'
                  : 'bg-[#00685f] hover:bg-[#005049]'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : hasUnsavedChanges ? 'Simpan Perubahan' : 'Tersimpan Otomatis'}</span>
            </button>
          </div>
        </div>

        {/* Statistical Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-gray-100">
          <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
            <div className="text-xs text-gray-500 font-medium">Total Kategori</div>
            <div className="text-lg font-bold text-[#0b1c30] mt-0.5">{stats.totalCategories} Kategori</div>
          </div>
          <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
            <div className="text-xs text-gray-500 font-medium">Total Butir Pelanggaran</div>
            <div className="text-lg font-bold text-[#00685f] mt-0.5">{stats.totalOptions} Jenis Kasus</div>
          </div>
          <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
            <div className="text-xs text-gray-500 font-medium">Rentang Bobot Poin</div>
            <div className="text-lg font-bold text-amber-700 mt-0.5">{stats.minPoints} s.d. {stats.maxPoints} Poin</div>
          </div>
          <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
            <div className="text-xs text-gray-500 font-medium">Rata-Rata Bobot</div>
            <div className="text-lg font-bold text-blue-700 mt-0.5">{stats.avgPoints} Poin / Kasus</div>
          </div>
        </div>
      </div>

      {/* Preset Selector Banner */}
      <div className="bg-gradient-to-r from-teal-900/5 via-emerald-800/5 to-transparent rounded-2xl p-5 border border-[#00685f]/20 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-[#00685f]">
              <Sparkles className="w-4 h-4" />
              <span>Ganti Standar Cepat (1-Klik Preset)</span>
            </div>
            <p className="text-xs text-[#3d4947]">
              Pilih dari standar nasional yang sudah disusun rapi untuk jenjang sekolah Anda:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(PRESET_MAP).map(([key, item]) => {
              const isRecommended = key === 'kurikulum_merdeka_ppksp';
              return (
                <button
                  key={key}
                  onClick={() => handleApplyPreset(key)}
                  className={`px-3 py-2 rounded-xl text-xs transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 ${
                    isRecommended
                      ? 'bg-[#e6f4f1] text-[#00685f] border-2 border-[#00685f] font-extrabold hover:bg-[#00685f] hover:text-white'
                      : 'bg-white hover:bg-emerald-50 hover:border-[#00685f] text-[#0b1c30] font-semibold border border-gray-200'
                  }`}
                  title={item.description}
                >
                  {isRecommended && <Sparkles className="w-3.5 h-3.5 shrink-0" />}
                  <span>{item.label.split('(')[0].trim()}</span>
                  {isRecommended && (
                    <span className="text-[10px] bg-[#00685f] text-white px-1.5 py-0.2 rounded font-black">
                      Terbaru
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Toolbar & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari jenis pelanggaran atau kategori..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#bcc9c6]/40 rounded-xl text-xs text-[#0b1c30] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00685f]/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setEditingCategory({ name: '', description: '', color: 'emerald' });
              setShowCategoryModal(true);
            }}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kategori Baru</span>
          </button>
        </div>
      </div>

      {/* Categories & Options List */}
      <div className="space-y-4">
        {filteredCategories.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-gray-300">
            <ShieldAlert className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-[#0b1c30]">Tidak ada pelanggaran yang sesuai</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              Kata kunci "{searchQuery}" tidak ditemukan pada kategori maupun butir pelanggaran.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 rounded-xl transition-all"
            >
              Reset Pencarian
            </button>
          </div>
        ) : (
          filteredCategories.map((category, catIndex) => {
            const isExpanded = expandedCategories[category.id] ?? true;

            return (
              <div
                key={category.id}
                className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-xs overflow-hidden transition-all"
              >
                {/* Category Header */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-gray-50/90 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100">
                  <div
                    onClick={() => toggleCategoryExpand(category.id)}
                    className="flex items-center gap-3 cursor-pointer select-none flex-1"
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-[#00685f] flex items-center justify-center font-bold text-xs shrink-0">
                      {catIndex + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-[#0b1c30]">{category.name}</h3>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[11px] font-semibold border border-gray-200">
                          {category.options.length} butir
                        </span>
                      </div>
                      {category.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{category.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <button
                      onClick={() => {
                        setEditingOption({
                          categoryId: category.id,
                          label: '',
                          points: 10,
                          description: ''
                        });
                        setShowOptionModal(true);
                      }}
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#00685f] rounded-lg text-xs font-semibold border border-emerald-200 transition-all flex items-center gap-1 cursor-pointer"
                      title="Tambah butir pelanggaran ke kategori ini"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Tambah Butir</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingCategory({
                          id: category.id,
                          name: category.name,
                          description: category.description || '',
                          color: category.color || 'emerald'
                        });
                        setShowCategoryModal(true);
                      }}
                      className="p-1.5 text-gray-500 hover:text-[#00685f] hover:bg-gray-100 rounded-lg transition-all"
                      title="Edit Nama Kategori"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id, category.name)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Hapus Kategori"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleCategoryExpand(category.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Options Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    {category.options.length === 0 ? (
                      <div className="p-6 text-center text-xs text-gray-400">
                        Belum ada butir pelanggaran di kategori ini. Klik "Tambah Butir" untuk menambahkan.
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50/50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                            <th className="py-2.5 px-4 w-12 text-center">No</th>
                            <th className="py-2.5 px-4">Jenis / Perilaku Pelanggaran</th>
                            <th className="py-2.5 px-4 w-44 text-center">Bobot Poin</th>
                            <th className="py-2.5 px-4 w-28 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                          {category.options.map((option, optIdx) => (
                            <tr key={option.id} className="hover:bg-gray-50/80 transition-colors">
                              <td className="py-3 px-4 text-center text-gray-400 font-medium">{optIdx + 1}</td>
                              <td className="py-3 px-4">
                                <div className="font-medium text-[#0b1c30]">{option.label}</div>
                                {option.description && (
                                  <div className="text-[11px] text-gray-500 mt-0.5">{option.description}</div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handlePointChange(category.id, option.id, option.points - 5)}
                                    className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold transition-all cursor-pointer select-none"
                                    title="-5 poin"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    max="200"
                                    value={option.points}
                                    onChange={(e) =>
                                      handlePointChange(category.id, option.id, parseInt(e.target.value) || 1)
                                    }
                                    className={`w-16 py-1 px-2 text-center rounded-lg text-xs font-bold border transition-all ${getPointBadgeStyle(
                                      option.points
                                    )}`}
                                  />
                                  <button
                                    onClick={() => handlePointChange(category.id, option.id, option.points + 5)}
                                    className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold transition-all cursor-pointer select-none"
                                    title="+5 poin"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingOption({
                                        categoryId: category.id,
                                        optionId: option.id,
                                        label: option.label,
                                        points: option.points,
                                        description: option.description || ''
                                      });
                                      setShowOptionModal(true);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-[#00685f] hover:bg-gray-100 rounded-lg transition-all"
                                    title="Edit Butir"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteOption(category.id, option.id, option.label)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    title="Hapus Butir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Category Modal (Add / Edit) */}
      {showCategoryModal && editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden border border-gray-200 shadow-xl space-y-4 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-[#0b1c30]">
                {editingCategory.id ? 'Edit Kategori Tata Tertib' : 'Tambah Kategori Tata Tertib'}
              </h3>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">Nama Kategori</label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  placeholder="Contoh: Kedisiplinan & Ketertiban, Kerapian, Adab Ibadah..."
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00685f]/30"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">Deskripsi / Ruang Lingkup</label>
                <textarea
                  rows={3}
                  value={editingCategory.description}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  placeholder="Penjelasan singkat ruang lingkup pelanggaran di kategori ini..."
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00685f]/30 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveCategoryModal}
                className="px-5 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Simpan Kategori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Option Modal (Add / Edit) */}
      {showOptionModal && editingOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden border border-gray-200 shadow-xl space-y-4 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-[#0b1c30]">
                {editingOption.optionId ? 'Edit Butir Pelanggaran' : 'Tambah Butir Pelanggaran Baru'}
              </h3>
              <button
                onClick={() => {
                  setShowOptionModal(false);
                  setEditingOption(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">Kategori Induk</label>
                <select
                  value={editingOption.categoryId}
                  onChange={(e) => setEditingOption({ ...editingOption, categoryId: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00685f]/30 bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">Nama Jenis Pelanggaran</label>
                <input
                  type="text"
                  value={editingOption.label}
                  onChange={(e) => setEditingOption({ ...editingOption, label: e.target.value })}
                  placeholder="Contoh: Terlambat hadir di sekolah >15 menit..."
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00685f]/30"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">
                  Bobot Poin Pembinaan (1 - 200 Poin)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={editingOption.points}
                    onChange={(e) => setEditingOption({ ...editingOption, points: parseInt(e.target.value) || 1 })}
                    className="w-28 px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold text-center text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f]/30"
                  />
                  <div className="flex items-center gap-1.5">
                    {[5, 10, 15, 20, 25, 50, 75, 100].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEditingOption({ ...editingOption, points: p })}
                        className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          editingOption.points === p
                            ? 'bg-[#00685f] text-white border-[#00685f]'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'
                        }`}
                      >
                        +{p}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Saran: Ringan (1-10 poin), Sedang (15-35 poin), Berat (40-100 poin).
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">
                  Catatan Sanksi / Konsekuensi Rekomendasi (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={editingOption.description}
                  onChange={(e) => setEditingOption({ ...editingOption, description: e.target.value })}
                  placeholder="Misal: Teguran lisan, pembersihan area piket, atau panggilan orang tua..."
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00685f]/30 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowOptionModal(false);
                  setEditingOption(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveOptionModal}
                className="px-5 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Simpan Butir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preset Confirmation Modal */}
      {showPresetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden border border-gray-200 shadow-xl space-y-4 p-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-[#0b1c30]">Terapkan Standar Template Ini?</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Anda akan menerapkan template <strong>{PRESET_MAP[pendingPresetKey]?.label}</strong>. Seluruh daftar kategori dan butir pelanggaran saat ini untuk <strong>{schoolConfig.schoolName}</strong> akan digantikan dengan struktur standar template ini.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowPresetConfirmModal(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmApplyPreset}
                className="px-5 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Ya, Terapkan Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
