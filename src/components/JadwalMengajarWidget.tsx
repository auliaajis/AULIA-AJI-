import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TeachingScheduleItem, ClassTeachingProgress, Counselor } from '../types';
import { saveBulkToFirestore, loadSchoolData, saveSchoolData } from '../utils/firestoreSync';
import { getActiveSchoolId } from '../utils/schoolConfig';
import {
  Calendar,
  Clock,
  BookOpen,
  ArrowRight,
  Edit3,
  Plus,
  Trash2,
  Check,
  X,
  History,
  Sparkles,
  ChevronRight,
  BookmarkCheck,
} from 'lucide-react';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

interface JadwalMengajarWidgetProps {
  onFillJournalForClass: (
    className: string,
    lastTopicProgress?: string,
    subject?: string,
    startTime?: string,
    endTime?: string,
    period?: string
  ) => void;
  classList?: string[];
  activeCounselor?: Counselor;
}

const parseTimeRange = (timeRange?: string) => {
  if (!timeRange) return { startTime: '07:30', endTime: '08:50' };
  const parts = timeRange.split('-').map((s) => s.trim());
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { startTime: parts[0], endTime: parts[1] };
  }
  return { startTime: '07:30', endTime: '08:50' };
};

export const JadwalMengajarWidget: React.FC<JadwalMengajarWidgetProps> = ({
  onFillJournalForClass,
  classList = [],
  activeCounselor,
}) => {
  const counselorId = activeCounselor?.id || 'default';
  const schoolId = getActiveSchoolId();
  const scheduleStorageKey = `bk_teaching_schedule_${counselorId}`;
  const progressStorageKey = `bk_class_teaching_progress_${counselorId}`;

  // Get current day in Indonesian name
  const getCurrentDayName = (): (typeof DAYS)[number] => {
    const dayIdx = new Date().getDay(); // 0 is Sunday, 1 is Monday...
    const mapDays: Record<number, (typeof DAYS)[number]> = {
      1: 'Senin',
      2: 'Selasa',
      3: 'Rabu',
      4: 'Kamis',
      5: 'Jumat',
      6: 'Sabtu',
      0: 'Senin', // fallback Sunday to Monday
    };
    return mapDays[dayIdx] || 'Senin';
  };

  const [selectedDay, setSelectedDay] = useState<(typeof DAYS)[number]>(getCurrentDayName());

  const loadSchedule = (): TeachingScheduleItem[] => {
    const raw = loadSchoolData<TeachingScheduleItem[]>(scheduleStorageKey, [], schoolId);
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter((s: any) => !String(s.id).startsWith('sch-'));
    }
    const legacy = localStorage.getItem('bk_teaching_schedule');
    if (legacy && (counselorId === 'default' || counselorId === 'c1' || counselorId === 'admin')) {
      try {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) return parsed.filter((s: any) => !String(s.id).startsWith('sch-'));
      } catch (e) {}
    }
    return [];
  };

  const loadProgress = (): Record<string, ClassTeachingProgress> => {
    const raw = loadSchoolData<Record<string, ClassTeachingProgress>>(progressStorageKey, {}, schoolId);
    if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
      return raw;
    }
    const legacy = localStorage.getItem('bk_class_teaching_progress');
    if (legacy && (counselorId === 'default' || counselorId === 'c1' || counselorId === 'admin')) {
      try {
        return JSON.parse(legacy);
      } catch (e) {}
    }
    return {};
  };

  // Schedule state
  const [schedule, setSchedule] = useState<TeachingScheduleItem[]>(() => loadSchedule());

  // Class Progress state
  const [progressMap, setProgressMap] = useState<Record<string, ClassTeachingProgress>>(() => loadProgress());

  // Reload when counselor or school changes
  useEffect(() => {
    setSchedule(loadSchedule());
    setProgressMap(loadProgress());
  }, [counselorId, schoolId]);

  // Modal States
  const [isManagingSchedule, setIsManagingSchedule] = useState(false);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState<string | null>(null); // className

  // Progress Edit Form
  const [editLastTopic, setEditLastTopic] = useState('');
  const [editNextTopic, setEditNextTopic] = useState('');

  // Schedule Item Add/Edit Form
  const [schDay, setSchDay] = useState<(typeof DAYS)[number]>('Senin');
  const [schPeriod, setSchPeriod] = useState('Jam ke 1-2');
  const [schTime, setSchTime] = useState('07:30 - 08:50');
  const [schClass, setSchClass] = useState('Kelas 7A');
  const [schSubject, setSchSubject] = useState('Bimbingan Klasikal / KBM');

  useEffect(() => {
    saveSchoolData(scheduleStorageKey, schedule, schoolId);
    saveBulkToFirestore(scheduleStorageKey, schedule, schoolId);
  }, [schedule, scheduleStorageKey, schoolId]);

  useEffect(() => {
    saveSchoolData(progressStorageKey, progressMap, schoolId);
    const progressList = Object.values(progressMap).map((p: ClassTeachingProgress) => ({
      ...p,
      id: p.className || `prog-${Math.random()}`
    }));
    saveBulkToFirestore(progressStorageKey, progressList, schoolId);
  }, [progressMap, progressStorageKey, schoolId]);

  // Realtime Cloud Firestore Listener across devices
  useEffect(() => {
    const handleSync = (e: any) => {
      const key = e.detail?.key;
      if (!key || key === scheduleStorageKey || key === 'bk_teaching_schedule' || key === 'all') {
        setSchedule(loadSchedule());
      }
      if (!key || key === progressStorageKey || key === 'bk_class_teaching_progress' || key === 'all') {
        setProgressMap(loadProgress());
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
  }, [scheduleStorageKey, progressStorageKey, counselorId, schoolId]);

  // Scheduled items for selected day
  const currentDaySchedule = schedule.filter((s) => s.day === selectedDay);
  const isTodaySelected = selectedDay === getCurrentDayName();

  const handleOpenProgressModal = (className: string) => {
    const cur = progressMap[className];
    setEditLastTopic(cur?.lastTopic || '');
    setEditNextTopic(cur?.nextTopicPlan || '');
    setIsUpdatingProgress(className);
  };

  const handleSaveProgress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUpdatingProgress) return;

    const updatedObj: ClassTeachingProgress = {
      className: isUpdatingProgress,
      lastDate: new Date().toISOString().split('T')[0],
      lastTopic: editLastTopic.trim() || 'Belum dicatat',
      nextTopicPlan: editNextTopic.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    setProgressMap((prev) => ({
      ...prev,
      [isUpdatingProgress]: updatedObj,
    }));

    setIsUpdatingProgress(null);
  };

  const handleAddScheduleItem = (e: React.FormEvent) => {
    e.preventDefault();
    const newItem: TeachingScheduleItem = {
      id: `sch-${Date.now()}`,
      day: schDay,
      period: schPeriod,
      timeRange: schTime,
      className: schClass,
      subject: schSubject,
    };
    setSchedule((prev) => [...prev, newItem]);
  };

  const handleDeleteScheduleItem = (id: string) => {
    setSchedule((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="bg-white border border-[#bcc9c6]/40 rounded-2xl p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-100 text-[#00685f] rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base leading-snug flex items-center gap-2">
              Jadwal Mengajar BK & Progress KBM
              {isTodaySelected && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-[#00685f] font-bold">
                  Hari Ini
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500">
              Pengingat pertemuan terakhir & pemateri KBM Terintegrasi Jurnal Harian
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsManagingSchedule(true)}
          className="text-xs font-semibold text-[#00685f] hover:bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60 flex items-center gap-1.5 cursor-pointer transition-colors self-start sm:self-auto"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Kelola Jadwal KBM</span>
        </button>
      </div>

      {/* Day Picker Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {DAYS.map((d) => {
          const isCurrent = d === getCurrentDayName();
          const isSelected = d === selectedDay;
          const count = schedule.filter((s) => s.day === d).length;

          return (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-[#00685f] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80'
              }`}
            >
              <span>{d}</span>
              {isCurrent && !isSelected && (
                <span className="w-2 h-2 rounded-full bg-[#00685f]" />
              )}
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Schedule Items List */}
      {currentDaySchedule.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50 space-y-1">
          <Calendar className="w-7 h-7 text-gray-300 mx-auto" />
          <p className="text-xs font-medium text-gray-600">
            Tidak ada jadwal mengajar BK pada hari <span className="font-bold">{selectedDay}</span>.
          </p>
          <button
            onClick={() => setIsManagingSchedule(true)}
            className="text-xs font-bold text-[#00685f] hover:underline cursor-pointer"
          >
            + Tambah Jadwal Mengajar Hari {selectedDay}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {currentDaySchedule.map((item) => {
            const prog = progressMap[item.className];

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50/70 transition-all space-y-3"
              >
                {/* Header item */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-[#00685f] text-white font-bold text-xs">
                      {item.className}
                    </span>
                    <span className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#00685f]" />
                      {item.period} ({item.timeRange})
                    </span>
                  </div>

                  <span className="text-xs text-gray-600 font-medium italic">
                    {item.subject}
                  </span>
                </div>

                {/* Progress Terakhir Info Card */}
                <div className="p-3 bg-white rounded-xl border border-gray-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <BookmarkCheck className="w-3 h-3 text-amber-600" />
                      Pertemuan Terakhir {prog?.lastDate ? `(${prog.lastDate})` : ''}
                    </span>

                    <button
                      onClick={() => handleOpenProgressModal(item.className)}
                      className="text-[11px] font-bold text-[#00685f] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Update Bab / Progress
                    </button>
                  </div>

                  <p className="text-xs text-gray-800 font-medium leading-relaxed">
                    {prog?.lastTopic || 'Belum ada riwayat catatan bab terakhir untuk kelas ini.'}
                  </p>

                  {prog?.nextTopicPlan && (
                    <p className="text-[11px] text-emerald-800 font-medium bg-emerald-50/80 p-2 rounded-lg border border-emerald-100">
                      💡 <span className="font-bold">Rencana Pembelajaran Berikutnya:</span>{' '}
                      {prog.nextTopicPlan}
                    </p>
                  )}
                </div>

                {/* Action button linking to Jurnal Harian */}
                <div className="flex justify-end pt-0.5">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      const { startTime, endTime } = parseTimeRange(item.timeRange);
                      onFillJournalForClass(
                        item.className,
                        prog?.lastTopic ? `Melanjutkan: ${prog.lastTopic}` : undefined,
                        item.subject || `Bimbingan Klasikal - ${item.className}`,
                        startTime,
                        endTime,
                        item.period
                      );
                    }}
                    className="bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-xs cursor-pointer transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Isi Jurnal Pembelajaran Hari Ini</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal: Kelola Jadwal KBM */}
      <AnimatePresence>
        {isManagingSchedule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 space-y-4 my-8"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 text-[#00685f] rounded-lg">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Kelola Jadwal Mengajar BK Mingguan
                  </h3>
                </div>
                <button
                  onClick={() => setIsManagingSchedule(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Add Schedule Item */}
              <form
                onSubmit={handleAddScheduleItem}
                className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-3"
              >
                <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-[#00685f]" /> Tambah Jam Mengajar
                </h4>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Hari
                    </label>
                    <select
                      value={schDay}
                      onChange={(e) => setSchDay(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white"
                    >
                      {DAYS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Kelas
                    </label>
                    <input
                      type="text"
                      value={schClass}
                      onChange={(e) => setSchClass(e.target.value)}
                      placeholder="misal: Kelas 7A"
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Jam ke-
                    </label>
                    <input
                      type="text"
                      value={schPeriod}
                      onChange={(e) => setSchPeriod(e.target.value)}
                      placeholder="Jam ke 1-2"
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Waktu
                    </label>
                    <input
                      type="text"
                      value={schTime}
                      onChange={(e) => setSchTime(e.target.value)}
                      placeholder="07:30 - 08:50"
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Materi / Subjek layanan
                  </label>
                  <input
                    type="text"
                    value={schSubject}
                    onChange={(e) => setSchSubject(e.target.value)}
                    placeholder="Bimbingan Klasikal / KBM"
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-1.5 bg-[#00685f] text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-[#005049]"
                >
                  + Tambahkan ke Jadwal
                </button>
              </form>

              {/* Existing Schedule Items List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                <h4 className="text-xs font-bold text-gray-700">
                  Daftar Jadwal Mengajar Terdaftar ({schedule.length})
                </h4>
                {schedule.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-xl text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#00685f] mr-2">[{item.day}]</span>
                      <span className="font-semibold text-gray-900 mr-2">{item.className}</span>
                      <span className="text-gray-500">
                        ({item.period} - {item.timeRange})
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteScheduleItem(item.id)}
                      className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setIsManagingSchedule(false)}
                  className="px-4 py-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-800 cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Update Progress Bab Terakhir Kelas */}
      <AnimatePresence>
        {isUpdatingProgress && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                    <BookmarkCheck className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Update Progress Materi - {isUpdatingProgress}
                  </h3>
                </div>
                <button
                  onClick={() => setIsUpdatingProgress(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProgress} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Capaian Materi / Pertemuan Terakhir
                  </label>
                  <textarea
                    rows={2}
                    value={editLastTopic}
                    onChange={(e) => setEditLastTopic(e.target.value)}
                    placeholder="misal: Bab 2: Etika Bermedia Sosial (sampai Hal 24)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00685f]/30 focus:border-[#00685f] outline-none resize-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Rencana Pembelajaran Pertemuan Berikutnya (Opsional)
                  </label>
                  <input
                    type="text"
                    value={editNextTopic}
                    onChange={(e) => setEditNextTopic(e.target.value)}
                    placeholder="misal: Diskusi Kasus Cyberbullying & Roleplay"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00685f]/30 focus:border-[#00685f] outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsUpdatingProgress(null)}
                    className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-[#00685f] hover:bg-[#005049] rounded-xl shadow-xs cursor-pointer"
                  >
                    Simpan Progress
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

export default JadwalMengajarWidget;
