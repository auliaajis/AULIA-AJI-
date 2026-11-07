import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StickyNote, Counselor } from '../types';
import { saveBulkToFirestore, loadSchoolData, saveSchoolData } from '../utils/firestoreSync';
import { getActiveSchoolId } from '../utils/schoolConfig';
import { Pin, Plus, Trash2, CheckCircle2, Circle, Edit3, X, StickyNote as StickyNoteIcon, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

const COLOR_MAP = {
  yellow: {
    bg: 'bg-amber-50/90 hover:bg-amber-50',
    border: 'border-amber-200/80',
    text: 'text-amber-950',
    accent: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-800',
  },
  teal: {
    bg: 'bg-emerald-50/90 hover:bg-emerald-50',
    border: 'border-emerald-200/80',
    text: 'text-emerald-950',
    accent: 'bg-[#00685f]',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  purple: {
    bg: 'bg-purple-50/90 hover:bg-purple-50',
    border: 'border-purple-200/80',
    text: 'text-purple-950',
    accent: 'bg-purple-500',
    badge: 'bg-purple-100 text-purple-800',
  },
  amber: {
    bg: 'bg-orange-50/90 hover:bg-orange-50',
    border: 'border-orange-200/80',
    text: 'text-orange-950',
    accent: 'bg-orange-500',
    badge: 'bg-orange-100 text-orange-800',
  },
  blue: {
    bg: 'bg-sky-50/90 hover:bg-sky-50',
    border: 'border-sky-200/80',
    text: 'text-sky-950',
    accent: 'bg-sky-500',
    badge: 'bg-sky-100 text-sky-800',
  },
};

interface StickyNotesWidgetProps {
  activeCounselor?: Counselor;
}

export const StickyNotesWidget: React.FC<StickyNotesWidgetProps> = ({ activeCounselor }) => {
  const counselorId = activeCounselor?.id || 'default';
  const schoolId = getActiveSchoolId();
  const storageKey = `bk_sticky_notes_${counselorId}`;

  const loadNotes = (): StickyNote[] => {
    const raw = loadSchoolData<StickyNote[]>(storageKey, [], schoolId);
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter((n: any) => n.id !== 'note-1' && n.id !== 'note-2');
    }
    // Fallback check for default/legacy notes
    const legacy = localStorage.getItem('bk_sticky_notes');
    if (legacy && counselorId === 'default' || counselorId === 'c1' || counselorId === 'admin') {
      try {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) return parsed.filter((n: any) => n.id !== 'note-1' && n.id !== 'note-2');
      } catch (e) {}
    }
    return [];
  };

  const [notes, setNotes] = useState<StickyNote[]>(() => loadNotes());

  // Reload notes when counselor changes
  useEffect(() => {
    setNotes(loadNotes());
  }, [counselorId, schoolId]);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('bk_sticky_notes_collapsed') === 'true';
  });

  const [isAdding, setIsAdding] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Form State
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [colorInput, setColorInput] = useState<StickyNote['color']>('teal');
  const [isPinnedInput, setIsPinnedInput] = useState(false);

  useEffect(() => {
    saveSchoolData(storageKey, notes, schoolId);
    saveBulkToFirestore(storageKey, notes, schoolId);
  }, [notes, storageKey, schoolId]);

  useEffect(() => {
    const handleSync = (e: any) => {
      const key = e.detail?.key;
      if (!key || key === storageKey || key === 'bk_sticky_notes' || key === 'all') {
        const updated = loadNotes();
        setNotes(updated);
      }
    };

    window.addEventListener('bk_realtime_sync', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('bk_school_changed', handleSync);
    return () => {
      window.removeEventListener('bk_realtime_sync', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('bk_school_changed', handleSync);
    };
  }, [storageKey, counselorId, schoolId]);

  useEffect(() => {
    localStorage.setItem('bk_sticky_notes_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const handleOpenAdd = () => {
    setTitleInput('');
    setContentInput('');
    setColorInput('teal');
    setIsPinnedInput(false);
    setEditingNoteId(null);
    setIsAdding(true);
    if (isCollapsed) setIsCollapsed(false);
  };

  const handleOpenEdit = (note: StickyNote) => {
    setTitleInput(note.title || '');
    setContentInput(note.content);
    setColorInput(note.color);
    setIsPinnedInput(!!note.isPinned);
    setEditingNoteId(note.id);
    setIsAdding(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentInput.trim()) return;

    if (editingNoteId) {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === editingNoteId
            ? {
                ...n,
                title: titleInput.trim() || undefined,
                content: contentInput.trim(),
                color: colorInput,
                isPinned: isPinnedInput,
                updatedAt: new Date().toISOString(),
              }
            : n
        )
      );
    } else {
      const newNote: StickyNote = {
        id: `note-${Date.now()}`,
        title: titleInput.trim() || undefined,
        content: contentInput.trim(),
        color: colorInput,
        isPinned: isPinnedInput,
        isCompleted: false,
        createdAt: new Date().toISOString(),
      };
      setNotes((prev) => [newNote, ...prev]);
    }

    setIsAdding(false);
    setEditingNoteId(null);
  };

  const handleTogglePin = (id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n))
    );
  };

  const handleToggleComplete = (id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isCompleted: !n.isCompleted } : n))
    );
  };

  const handleDelete = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // Sort notes: pinned first, uncompleted before completed
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const activeCount = notes.filter((n) => !n.isCompleted).length;

  return (
    <div className="bg-white border border-[#bcc9c6]/40 rounded-2xl p-4 shadow-xs space-y-3 transition-all">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
            <StickyNoteIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm leading-snug flex items-center gap-1.5">
              Catatan Cepat BK
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 font-extrabold">
                {activeCount} Memo
              </span>
            </h3>
            {!isCollapsed && (
              <p className="text-[11px] text-gray-500">Pengingat harian & memo kerja Guru BK</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpenAdd}
            className="bg-[#00685f] hover:bg-[#005049] text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
            title="Tambah Memo Cepat"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </motion.button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
            title={isCollapsed ? 'Buka Catatan Cepat' : 'Ciutkan Catatan Cepat'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsed Summary view */}
      {isCollapsed ? (
        <div
          onClick={() => setIsCollapsed(false)}
          className="p-2.5 bg-amber-50/60 border border-amber-200/60 rounded-xl flex items-center justify-between cursor-pointer hover:bg-amber-50 transition-colors text-xs text-amber-900"
        >
          <span className="font-semibold flex items-center gap-1.5">
            <Pin className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
            {activeCount > 0
              ? `${activeCount} catatan aktif tersimpan.`
              : 'Belum ada catatan cepat.'}
          </span>
          <span className="text-[11px] font-bold text-[#00685f] hover:underline">Tampilkan Memo →</span>
        </div>
      ) : (
        /* Expanded Compact Grid / List */
        <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
          {sortedNotes.length === 0 ? (
            <div className="text-center py-5 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 space-y-1">
              <Sparkles className="w-6 h-6 text-amber-400 mx-auto" />
              <p className="text-xs font-medium text-gray-600">Belum ada catatan cepat.</p>
              <button
                onClick={handleOpenAdd}
                className="text-[11px] font-bold text-[#00685f] hover:underline cursor-pointer"
              >
                + Buat Catatan Pertama
              </button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {sortedNotes.map((note) => {
                const theme = COLOR_MAP[note.color] || COLOR_MAP.teal;
                return (
                  <motion.div
                    key={note.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className={`p-3 rounded-xl border ${theme.bg} ${theme.border} space-y-1.5 shadow-2xs group relative`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <button
                          onClick={() => handleToggleComplete(note.id)}
                          className="text-gray-400 hover:text-emerald-700 transition-colors cursor-pointer shrink-0"
                        >
                          {note.isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-gray-400" />
                          )}
                        </button>

                        {note.title && (
                          <h4
                            className={`font-bold text-xs truncate ${
                              note.isCompleted ? 'line-through text-gray-400' : theme.text
                            }`}
                          >
                            {note.title}
                          </h4>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => handleTogglePin(note.id)}
                          className={`p-0.5 rounded transition-colors cursor-pointer ${
                            note.isPinned
                              ? 'text-amber-600'
                              : 'text-gray-400 hover:text-amber-600'
                          }`}
                          title={note.isPinned ? 'Unpin' : 'Pin'}
                        >
                          <Pin className="w-3 h-3 fill-current" />
                        </button>

                        <button
                          onClick={() => handleOpenEdit(note)}
                          className="p-0.5 rounded text-gray-400 hover:text-gray-700 cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>

                        <button
                          onClick={() => handleDelete(note.id)}
                          className="p-0.5 rounded text-gray-400 hover:text-rose-600 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p
                      className={`text-[11px] leading-snug whitespace-pre-wrap ${
                        note.isCompleted ? 'line-through text-gray-400' : theme.text
                      }`}
                    >
                      {note.content}
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Add / Edit Sticky Note Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                    <StickyNoteIcon className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {editingNoteId ? 'Edit Catatan Cepat' : 'Tambah Catatan Cepat'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsAdding(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Judul Singkat (Opsional)
                  </label>
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder="Contoh: Diskusi Dengan Wali Kelas"
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00685f]/30 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Isi Memo / Catatan <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={contentInput}
                    onChange={(e) => setContentInput(e.target.value)}
                    placeholder="Tuliskan catatan pengingat harian..."
                    required
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00685f]/30 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Warna Kartu
                  </label>
                  <div className="flex items-center gap-2">
                    {(['teal', 'yellow', 'purple', 'amber', 'blue'] as const).map((clr) => (
                      <button
                        key={clr}
                        type="button"
                        onClick={() => setColorInput(clr)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                          COLOR_MAP[clr].accent
                        } ${
                          colorInput === clr
                            ? 'ring-2 ring-offset-2 ring-[#00685f] scale-110 border-white'
                            : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="pinNoteCheckCompact"
                    checked={isPinnedInput}
                    onChange={(e) => setIsPinnedInput(e.target.checked)}
                    className="w-4 h-4 text-[#00685f] rounded border-gray-300 focus:ring-[#00685f]"
                  />
                  <label htmlFor="pinNoteCheckCompact" className="text-xs text-gray-700 font-medium cursor-pointer flex items-center gap-1">
                    <Pin className="w-3.5 h-3.5 text-amber-600" /> Sematkan di posisi teratas (Pin)
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-[#00685f] hover:bg-[#005049] rounded-xl shadow-xs cursor-pointer"
                  >
                    {editingNoteId ? 'Simpan' : 'Tambah'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StickyNotesWidget;
