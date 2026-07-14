import React, { useState, useEffect } from 'react';
import { Counselor, BKJournalEntry, CounselingService, ViolationRecord } from '../types';
import { 
  Calendar, 
  Clock, 
  Plus, 
  BookOpen, 
  FileText, 
  Printer, 
  Trash2, 
  Edit3, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle, 
  HelpCircle, 
  Sparkles, 
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  User,
  Users,
  Settings
} from 'lucide-react';
import { downloadJournalPDF, downloadJournalRangePDF, formatIndonesianDate } from '../utils/pdfGenerator';

interface JurnalHarianViewProps {
  activeCounselor: Counselor;
  services: CounselingService[];
  violations: ViolationRecord[];
  onAddActivityLog?: (log: any) => void;
}

export default function JurnalHarianView({
  activeCounselor,
  services,
  violations,
  onAddActivityLog
}: JurnalHarianViewProps) {
  // Date State - default to today in local time format YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  });

  // Range Date State
  const [rangeStartDate, setRangeStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // Default to 1st of current month
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  });
  const [rangeEndDate, setRangeEndDate] = useState<string>(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  });

  const getRangeAutoActivities = (start: string, end: string) => {
    const rangeServices = services.filter(s => s.date >= start && s.date <= end);
    const rangeViolations = violations.filter(v => v.date >= start && v.date <= end);

    return [
      ...rangeServices.map(s => ({
        id: `auto-s-${s.id}`,
        date: s.date,
        time: `${s.startTime} - ${s.endTime}`,
        type: 'Layanan BK Konseling',
        title: `${s.serviceType}: ${s.problem}`,
        target: s.students.map(st => `${st.name} (${st.class})`).join(', '),
        notes: `Sesi ${s.status}. Deskripsi: ${s.description}. Rekomendasi Tindak Lanjut: ${s.followUp}`,
        status: s.status === 'Selesai' ? 'Selesai' : s.status === 'Terjadwal' ? 'Dalam Proses' : 'Perlu Tindak Lanjut'
      })),
      ...rangeViolations.map(v => ({
        id: `auto-v-${v.id}`,
        date: v.date,
        time: v.time || '10:00',
        type: 'Pencatatan Disiplin',
        title: `Pelanggaran: ${v.category}`,
        target: `${v.studentName} (${v.studentClass})`,
        notes: `Poin Ditambah: +${v.pointsAdded} Poin. Kejadian di: ${v.location || 'Sekolah'}. Keterangan: ${v.notes || '-'}`,
        status: v.handledBy && v.handledBy !== 'Belum Ditangani' ? 'Selesai' : 'Perlu Tindak Lanjut'
      }))
    ];
  };

  const handleDownloadRangePDF = () => {
    if (rangeStartDate > rangeEndDate) {
      alert('Tanggal mulai tidak boleh melebihi tanggal selesai.');
      return;
    }

    const filteredRangeManual = journalEntries.filter(
      entry => entry.date >= rangeStartDate && entry.date <= rangeEndDate && (activeCounselor.id === 'admin' || entry.counselorId === activeCounselor.id)
    );

    const rangeAuto = getRangeAutoActivities(rangeStartDate, rangeEndDate);

    downloadJournalRangePDF(
      rangeStartDate,
      rangeEndDate,
      activeCounselor,
      filteredRangeManual,
      includeAutoInPrint,
      rangeAuto
    );
  };

  // Main Journal entries state
  const [journalEntries, setJournalEntries] = useState<BKJournalEntry[]>(() => {
    const saved = localStorage.getItem('bk_daily_journals');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    
    // Default mock daily journal entries for classroom bimbingan and admin tasks
    const d = new Date();
    const todayStr = d.toISOString().split('T')[0];
    
    return [
      {
        id: 'j-mock-1',
        date: todayStr,
        startTime: '08:00',
        endTime: '09:30',
        activityType: 'Bimbingan Klasikal',
        title: 'Layanan Bimbingan Klasikal Kelas VIII-A: Pencegahan Bullying',
        description: 'Menyampaikan materi tentang bentuk-bentuk bullying, dampak psikologis bagi korban, serta komitmen anti-bullying kelas. Siswa sangat antusias dan menandatangani deklarasi damai kelas.',
        target: 'Siswa Kelas VIII-A',
        status: 'Selesai',
        counselorId: 'c1',
        createdAt: new Date().toISOString()
      },
      {
        id: 'j-mock-2',
        date: todayStr,
        startTime: '10:00',
        endTime: '11:00',
        activityType: 'Administrasi BK',
        title: 'Penyusunan Rencana Pelaksanaan Layanan (RPL) Mingguan',
        description: 'Menyusun materi, instrumen, dan skenario layanan bimbingan kelompok untuk minggu depan dengan topik "Membangun Motivasi Belajar Menjelang Ujian".',
        target: 'Dokumen Administrasi BK',
        status: 'Selesai',
        counselorId: 'c1',
        createdAt: new Date().toISOString()
      },
      {
        id: 'j-mock-3',
        date: todayStr,
        startTime: '11:30',
        endTime: '12:30',
        activityType: 'Rapat Koordinasi',
        title: 'Koordinasi Penanganan Siswa Sering Terlambat dengan Wali Kelas 8C',
        description: 'Membahas perkembangan perilaku siswa Raka Kurniawan dan menyepakati langkah pemanggilan orang tua bersama guna merumuskan solusi.',
        target: 'Wali Kelas 8C & Guru BK',
        status: 'Selesai',
        counselorId: 'c1',
        createdAt: new Date().toISOString()
      }
    ];
  });

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BKJournalEntry | null>(null);
  const [includeAutoInPrint, setIncludeAutoInPrint] = useState(true);

  // Form Field States
  const [startTime, setStartTime] = useState('07:30');
  const [endTime, setEndTime] = useState('08:15');
  const [activityType, setActivityType] = useState<BKJournalEntry['activityType']>('Bimbingan Klasikal');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState<BKJournalEntry['status']>('Selesai');

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('bk_daily_journals', JSON.stringify(journalEntries));
  }, [journalEntries]);

  // Load editing values
  useEffect(() => {
    if (editingEntry) {
      setStartTime(editingEntry.startTime);
      setEndTime(editingEntry.endTime);
      setActivityType(editingEntry.activityType);
      setTitle(editingEntry.title);
      setDescription(editingEntry.description);
      setTarget(editingEntry.target);
      setStatus(editingEntry.status);
      setIsFormOpen(true);
    }
  }, [editingEntry]);

  const handleResetForm = () => {
    setStartTime('07:30');
    setEndTime('08:15');
    setActivityType('Bimbingan Klasikal');
    setTitle('');
    setDescription('');
    setTarget('');
    setStatus('Selesai');
    setEditingEntry(null);
    setIsFormOpen(false);
  };

  // Save manual journal entry
  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !target.trim()) {
      alert('Mohon lengkapi semua field yang wajib diisi.');
      return;
    }

    if (editingEntry) {
      // Edit
      setJournalEntries(prev => prev.map(item => {
        if (item.id === editingEntry.id) {
          return {
            ...item,
            startTime,
            endTime,
            activityType,
            title,
            description,
            target,
            status,
            date: selectedDate, // update to currently viewed date
          };
        }
        return item;
      }));
    } else {
      // Add New
      const newEntry: BKJournalEntry = {
        id: `j-${Date.now()}`,
        date: selectedDate,
        startTime,
        endTime,
        activityType,
        title,
        description,
        target,
        status,
        counselorId: activeCounselor.id,
        createdAt: new Date().toISOString()
      };
      setJournalEntries(prev => [newEntry, ...prev]);

      // Add to global Activity Log if handler is provided
      if (onAddActivityLog) {
        onAddActivityLog({
          type: 'attendance', // standard category
          title: `Log Jurnal: ${activityType}`,
          description: `${title} (${target})`,
          studentName: '-',
          studentClass: '-'
        });
      }
    }

    handleResetForm();
  };

  const handleDeleteEntry = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus catatan jurnal ini?')) {
      setJournalEntries(prev => prev.filter(item => item.id !== id));
    }
  };

  // Scan current day automatic activities
  const currentDayServices = services.filter(s => s.date === selectedDate);
  const currentDayViolations = violations.filter(v => v.date === selectedDate);

  // Map services & violations to standard structures
  const mappedAutoActivities = [
    ...currentDayServices.map(s => ({
      id: `auto-s-${s.id}`,
      time: `${s.startTime} - ${s.endTime}`,
      type: 'Layanan BK Konseling',
      title: `${s.serviceType}: ${s.problem}`,
      target: s.students.map(st => `${st.name} (${st.class})`).join(', '),
      notes: `Sesi ${s.status}. Deskripsi: ${s.description}. Rekomendasi Tindak Lanjut: ${s.followUp}`,
      status: s.status === 'Selesai' ? 'Selesai' : s.status === 'Terjadwal' ? 'Dalam Proses' : 'Perlu Tindak Lanjut',
      raw: s
    })),
    ...currentDayViolations.map(v => ({
      id: `auto-v-${v.id}`,
      time: v.time || '10:00',
      type: 'Pencatatan Disiplin',
      title: `Pelanggaran: ${v.category}`,
      target: `${v.studentName} (${v.studentClass})`,
      notes: `Poin Ditambah: +${v.pointsAdded} Poin. Kejadian di: ${v.location || 'Sekolah'}. Keterangan: ${v.notes || '-'}`,
      status: v.handledBy && v.handledBy !== 'Belum Ditangani' ? 'Selesai' : 'Perlu Tindak Lanjut',
      raw: v
    }))
  ];

  // Fast quick-add from auto activities to formal manual list
  const handleImportAutoToManual = (auto: typeof mappedAutoActivities[0]) => {
    // Generate times
    const times = auto.time.split(' - ');
    const sTime = times[0] || '08:00';
    const eTime = times[1] || '08:45';

    // Map auto type to manual activityType
    let manualActType: BKJournalEntry['activityType'] = 'Lain-lain';
    if (auto.type.includes('Layanan')) {
      manualActType = 'Bimbingan Klasikal'; // or close
      if (auto.title.includes('Konseling')) {
        manualActType = 'Lain-lain';
      }
    } else if (auto.type.includes('Disiplin')) {
      manualActType = 'Kasus Mendesak';
    }

    // Populate form and open it
    setStartTime(sTime);
    setEndTime(eTime);
    setActivityType(manualActType);
    setTitle(auto.title);
    setDescription(auto.notes);
    setTarget(auto.target);
    setStatus(auto.status as BKJournalEntry['status']);
    setIsFormOpen(true);
    
    // Scroll to form smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter journal manual entries for selected date
  const filteredManualEntries = journalEntries.filter(
    entry => entry.date === selectedDate && (activeCounselor.id === 'admin' || entry.counselorId === activeCounselor.id)
  );

  // Total events on this day
  const totalItemsCount = filteredManualEntries.length + (includeAutoInPrint ? mappedAutoActivities.length : 0);

  // Handle formal PDF print export
  const handlePrintPDF = () => {
    downloadJournalPDF(
      selectedDate,
      activeCounselor,
      filteredManualEntries,
      includeAutoInPrint,
      mappedAutoActivities
    );
  };

  // Quick navigation dates
  const handleSetRelativeDate = (daysOffset: number) => {
    const today = new Date();
    const targetDate = new Date(today.setDate(today.getDate() + daysOffset));
    const offset = targetDate.getTimezoneOffset();
    const localDate = new Date(targetDate.getTime() - (offset * 60 * 1000));
    setSelectedDate(localDate.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#00685f]/10 rounded-lg text-[#00685f]">
              <ClipboardList className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-extrabold text-[#0b1c30]">Jurnal Harian Kegiatan Guru BK</h2>
          </div>
          <p className="text-sm text-[#3d4947]/70 font-semibold mt-1">
            Catatan harian formal pelaksanaan bimbingan, konseling, mediasi, rapat koordinasi, serta administrasi sekolah.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 cursor-pointer select-none">
            <input 
              type="checkbox"
              checked={includeAutoInPrint}
              onChange={(e) => setIncludeAutoInPrint(e.target.checked)}
              className="w-4 h-4 rounded text-[#00685f] focus:ring-[#00685f] cursor-pointer"
            />
            <span>Sertakan Rekam Layanan Otomatis di PDF</span>
          </label>

          <button
            onClick={handlePrintPDF}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0b1c30] hover:bg-[#0b1c30]/90 text-white rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer active:scale-97"
            title="Cetak/Unduh Jurnal Hari Ini (PDF)"
          >
            <Printer className="w-4.5 h-4.5" />
            <span>Cetak PDF</span>
          </button>
        </div>
      </div>

      {/* Date Control Bar */}
      <div className="bg-white rounded-2xl p-4 border border-[#bcc9c6]/30 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Quick buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => handleSetRelativeDate(-1)}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-all"
          >
            Kemarin
          </button>
          <button
            onClick={() => handleSetRelativeDate(0)}
            className="px-3.5 py-2 bg-[#00685f]/10 hover:bg-[#00685f]/20 text-[#00685f] rounded-xl text-xs font-bold transition-all"
          >
            Hari Ini
          </button>
        </div>

        {/* Formal picker */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal Jurnal:</span>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Calendar className="w-4 h-4" />
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Form and Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns - Manual Logger Form & List */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Collapse/Expand Form Trigger */}
          {!isFormOpen ? (
            <button
              onClick={() => setIsFormOpen(true)}
              className="w-full flex items-center justify-center gap-2.5 py-4 px-6 bg-[#00685f]/5 border-2 border-dashed border-[#00685f]/30 hover:bg-[#00685f]/10 rounded-2xl text-[#00685f] font-bold transition-all hover:border-[#00685f]/60 active:scale-99 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>Input Catat Kegiatan Baru (Manual)</span>
            </button>
          ) : (
            <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="font-extrabold text-[#0b1c30] text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#00685f]" />
                  <span>{editingEntry ? 'Ubah Catatan Kegiatan' : 'Catat Kegiatan Jurnal Baru'}</span>
                </h3>
                <button
                  onClick={handleResetForm}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  Batal
                </button>
              </div>

              <form onSubmit={handleSaveEntry} className="space-y-4">
                {/* Time row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Waktu Mulai</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="time"
                        required
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Waktu Selesai</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="time"
                        required
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                      />
                    </div>
                  </div>
                </div>

                {/* Type & Target */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Jenis Kegiatan BK</label>
                    <select
                      value={activityType}
                      onChange={(e) => setActivityType(e.target.value as BKJournalEntry['activityType'])}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] font-semibold text-gray-700"
                    >
                      <option value="Bimbingan Klasikal">Bimbingan Klasikal (Kelas)</option>
                      <option value="Konsultasi Orang Tua">Konsultasi Wali Murid / Orang Tua</option>
                      <option value="Rapat Koordinasi">Rapat Koordinasi Wali Kelas / Guru</option>
                      <option value="Administrasi BK">Administrasi BK / Penyusunan RPL</option>
                      <option value="Kasus Mendesak">Penanganan Kasus Mendesak / Krisis</option>
                      <option value="Lain-lain">Lain-lain / Kegiatan Sekolah</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Sasaran / Peserta (Wajib)</label>
                    <input
                      type="text"
                      required
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="Contoh: Siswa Kelas VIII-C / Ibu Sri (Orang Tua)"
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] font-semibold"
                    />
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Nama Kegiatan / Topik (Wajib)</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Sosialisasi tata krama pergaulan atau Penyelesaian pertikaian siswa"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] font-bold text-[#0b1c30]"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Rincian Deskripsi Kegiatan & Hasil (Wajib)</label>
                  <textarea
                    required
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tulis kronologi kegiatan, poin utama bimbingan, instrumen yang digunakan, serta tindak lanjut hasil kegiatan."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] leading-relaxed font-semibold text-gray-600"
                  />
                </div>

                {/* Status Dropdown */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Status Pelaksanaan</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as BKJournalEntry['status'])}
                    className="w-full sm:w-48 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] font-bold text-gray-700"
                  >
                    <option value="Selesai">Selesai (Tuntas)</option>
                    <option value="Perlu Tindak Lanjut">Perlu Tindak Lanjut</option>
                    <option value="Dalam Proses">Dalam Proses (On Going)</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-md cursor-pointer active:scale-97"
                  >
                    {editingEntry ? 'Simpan Perubahan' : 'Tambahkan Ke Jurnal'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of Manual entries for selected date */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-[#0b1c30] text-base flex items-center justify-between">
              <span>Kegiatan Manual Terjadwal ({filteredManualEntries.length})</span>
              <span className="text-xs text-gray-500 font-bold bg-gray-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                {formatIndonesianDate(selectedDate)}
              </span>
            </h3>

            {filteredManualEntries.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-[#bcc9c6]/20 shadow-xs text-center space-y-3">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-400">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0b1c30]">Belum ada kegiatan manual untuk tanggal ini.</p>
                  <p className="text-xs text-gray-500 font-semibold max-w-sm mx-auto mt-1 leading-relaxed">
                    Catat aktivitas Anda secara manual atau gunakan log otomatis di panel kanan untuk mengisi jurnal harian dengan cepat.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredManualEntries.map(entry => {
                  let badgeColor = 'bg-[#00685f]/10 text-[#00685f]';
                  if (entry.status === 'Perlu Tindak Lanjut') badgeColor = 'bg-[#ba1a1a]/10 text-[#ba1a1a]';
                  else if (entry.status === 'Dalam Proses') badgeColor = 'bg-[#6b38d4]/10 text-[#6b38d4]';

                  let categoryColor = 'bg-blue-50 text-blue-700';
                  if (entry.activityType === 'Bimbingan Klasikal') categoryColor = 'bg-emerald-50 text-emerald-700';
                  else if (entry.activityType === 'Konsultasi Orang Tua') categoryColor = 'bg-amber-50 text-amber-700';
                  else if (entry.activityType === 'Kasus Mendesak') categoryColor = 'bg-rose-50 text-rose-700';

                  return (
                    <div 
                      key={entry.id} 
                      className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        {/* Meta Category Row */}
                        <div className="flex justify-between items-start flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg ${categoryColor}`}>
                              {entry.activityType}
                            </span>
                            <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gray-400" />
                              <span>{entry.startTime} - {entry.endTime}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeColor}`}>
                              {entry.status}
                            </span>
                          </div>
                        </div>

                        {/* Title & Target */}
                        <div>
                          <h4 className="font-extrabold text-[#0b1c30] text-sm leading-snug">
                            {entry.title}
                          </h4>
                          <p className="text-[10px] text-[#00685f] font-bold mt-1 uppercase tracking-wider">
                            Sasaran: {entry.target}
                          </p>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-gray-600 leading-relaxed font-semibold whitespace-pre-wrap">
                          {entry.description}
                        </p>
                      </div>

                      {/* Card Actions Bottom footer */}
                      <div className="flex justify-end items-center gap-1.5 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => setEditingEntry(entry)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Ubah</span>
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-100 text-[#ba1a1a] rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

        {/* Right Column - Auto activities and logs */}
        <div className="space-y-6">
          
          {/* Unduh Rekap Jurnal Rentang Tanggal Card */}
          <div className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-xs space-y-4">
            <div>
              <h3 className="font-extrabold text-[#0b1c30] text-sm flex items-center gap-1.5">
                <Calendar className="w-4.5 h-4.5 text-[#00685f]" />
                <span>Rekap Jurnal (Rentang Tanggal)</span>
              </h3>
              <p className="text-[10px] text-[#3d4947]/70 font-semibold mt-0.5">
                Unduh rekapitulasi semua kegiatan Anda dalam rentang tanggal tertentu ke file PDF.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Mulai</label>
                  <input
                    type="date"
                    value={rangeStartDate}
                    onChange={(e) => setRangeStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Selesai</label>
                  <input
                    type="date"
                    value={rangeEndDate}
                    onChange={(e) => setRangeEndDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>
              </div>

              <button
                onClick={handleDownloadRangePDF}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-sm cursor-pointer active:scale-97"
              >
                <Printer className="w-4 h-4" />
                <span>Unduh Rekap Jurnal</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-xs space-y-4">
            <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-[#0b1c30] text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4.5 h-4.5 text-[#00685f]" />
                  <span>Sesi Otomatis Hari Ini</span>
                </h3>
                <p className="text-[10px] text-[#3d4947]/70 font-semibold mt-0.5">
                  Layanan & pelanggaran yang diinput pada tab lain di tanggal ini.
                </p>
              </div>
              <span className="bg-[#00685f]/10 text-[#00685f] text-xs font-black px-2.5 py-1 rounded-full">
                {mappedAutoActivities.length}
              </span>
            </div>

            {mappedAutoActivities.length === 0 ? (
              <div className="py-6 text-center text-gray-400 space-y-1.5">
                <AlertCircle className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-xs font-bold text-[#0b1c30]">Tidak ada rekam otomatis.</p>
                <p className="text-[10px] text-gray-500 font-semibold leading-relaxed max-w-[200px] mx-auto">
                  Silakan tambahkan layanan konseling, bimbingan kelompok, atau catatan pelanggaran murid untuk memunculkan aktivitas otomatis.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5 overflow-y-auto max-h-[480px] pr-1">
                {mappedAutoActivities.map(act => (
                  <div 
                    key={act.id} 
                    className="p-3.5 bg-[#f8fafa] rounded-xl border border-gray-200 hover:border-[#bcc9c6] transition-all space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-[9px] bg-[#00685f]/10 text-[#00685f] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          {act.type}
                        </span>
                        <span className="text-[9px] text-gray-400 font-bold">{act.time}</span>
                      </div>
                      
                      <h5 className="font-extrabold text-[#0b1c30] text-xs leading-snug">
                        {act.title}
                      </h5>
                      <p className="text-[9px] text-gray-500 font-semibold">
                        <strong className="text-[#0b1c30]">Sasaran:</strong> {act.target}
                      </p>
                      <p className="text-[10px] text-gray-600 line-clamp-3 leading-relaxed">
                        {act.notes}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-dashed border-gray-200 mt-2 flex justify-between items-center">
                      <span className="text-[8px] bg-gray-200/50 text-gray-600 px-1.5 py-0.5 rounded uppercase tracking-wider font-extrabold">
                        {act.status}
                      </span>

                      <button
                        onClick={() => handleImportAutoToManual(act)}
                        className="flex items-center gap-1 text-[9px] font-extrabold text-[#00685f] hover:text-[#005049] transition-colors cursor-pointer"
                      >
                        <span>Salin ke Jurnal</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Guidance Box */}
          <div className="bg-[#6b38d4]/5 rounded-2xl p-5 border border-[#6b38d4]/15 shadow-xs space-y-2">
            <h4 className="font-extrabold text-[#6b38d4] text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4" />
              <span>Petunjuk Jurnal BK</span>
            </h4>
            <p className="text-xs text-gray-600 font-semibold leading-relaxed">
              Jurnal ini dirancang sesuai format resmi pengawasan BK sekolah. Anda dapat menggabungkan laporan manual (seperti bimbingan klasikal, administrasi, sosiometri) dengan laporan konseling individual & kelompok yang telah diisi sebelumnya.
            </p>
            <p className="text-[10px] text-gray-500 font-bold">
              Tip: Aktifkan "Sertakan Rekam Layanan Otomatis" untuk cetakan laporan gabungan instan.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
