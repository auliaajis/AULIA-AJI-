import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Counselor, BKJournalEntry, CounselingService, ViolationRecord, Student } from '../types';
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
  Settings,
  Camera,
  ImageIcon,
  X,
  RefreshCw,
  History,
  Search,
  Filter,
  Eye,
  Download,
  ChevronDown,
  SlidersHorizontal as Sliders
} from 'lucide-react';
import { downloadJournalPDF, downloadJournalRangePDF, formatIndonesianDate } from '../utils/pdfGenerator';
import { triggerBackgroundAutoSync } from '../utils/googleSync';
import { registerDeletedId } from '../utils/deletionTracker';
import { saveBulkToFirestore, saveSchoolData, loadSchoolData, deleteFromFirestore, saveToFirestore } from '../utils/firestoreSync';
import PageHeaderBanner from './PageHeaderBanner';

interface JurnalHarianViewProps {
  activeCounselor: Counselor;
  services: CounselingService[];
  violations: ViolationRecord[];
  students?: Student[];
  onAddActivityLog?: (log: any) => void;
  presetJournalData?: {
    className?: string;
    topic?: string;
    subject?: string;
    startTime?: string;
    endTime?: string;
    period?: string;
  } | null;
  onClearPresetJournalData?: () => void;
}

// Normalization helper for robust class name and date comparisons
const normalizeClassStr = (str: string = ''): string => {
  return String(str || '')
    .toLowerCase()
    .replace(/^kelas\s+/i, '')
    .replace(/^kls\s+/i, '')
    .replace(/^siswa\s+/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

const normalizeDateStr = (dateStr: string = ''): string => {
  if (!dateStr) return '';
  return String(dateStr).trim().slice(0, 10);
};

export default function JurnalHarianView({
  activeCounselor,
  services,
  violations,
  students,
  onAddActivityLog,
  presetJournalData,
  onClearPresetJournalData
}: JurnalHarianViewProps) {
  const isInitialMountJournal = useRef(true);

  // View Mode: 'daily' (Tanggal Terpilih) vs 'history' (Riwayat Semua Jurnal)
  const [viewMode, setViewMode] = useState<'daily' | 'history'>('daily');

  // History Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyActivityType, setHistoryActivityType] = useState('Semua');
  const [historySelectedMonth, setHistorySelectedMonth] = useState('Semua');
  const [selectedJournalDetail, setSelectedJournalDetail] = useState<any | null>(null);

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

    const savedHomeVisits = localStorage.getItem('bk_home_visits');
    const homeVisits: any[] = savedHomeVisits ? JSON.parse(savedHomeVisits) : [];
    const rangeHomeVisits = homeVisits.filter(hv => hv.date >= start && hv.date <= end);

    const savedSummons = localStorage.getItem('bk_parent_summons');
    const summons: any[] = savedSummons ? JSON.parse(savedSummons) : [];
    const rangeSummons = summons.filter(sm => (sm.summonDate || sm.date) >= start && (sm.summonDate || sm.date) <= end);

    const savedAch = localStorage.getItem('bk_student_achievements');
    const achievements: any[] = savedAch ? JSON.parse(savedAch) : [];
    const rangeAch = achievements.filter(a => a.date >= start && a.date <= end);

    const savedAtt = localStorage.getItem('bk_attendance_history');
    const attendanceHistory: any[] = savedAtt ? JSON.parse(savedAtt) : [];
    const rangeAtt = attendanceHistory.filter(att => {
      const d = normalizeDateStr(att.date);
      return d >= start && d <= end;
    });

    return [
      ...rangeServices.map(s => ({
        id: `auto-s-${s.id}`,
        date: s.date,
        time: `${s.startTime} - ${s.endTime}`,
        type: 'Layanan BK Konseling',
        title: `${s.serviceType}: ${s.problem}`,
        target: s.students.map(st => `${st.name} (${st.class})`).join(', '),
        notes: `Sesi ${s.status}. Deskripsi: ${s.description}. Rekomendasi Tindak Lanjut: ${s.followUp}`,
        status: s.status === 'Selesai' ? 'Selesai' : s.status === 'Terjadwal' ? 'Dalam Proses' : 'Perlu Tindak Lanjut',
        absentStudents: undefined
      })),
      ...rangeViolations.map(v => ({
        id: `auto-v-${v.id}`,
        date: v.date,
        time: v.time || '10:00',
        type: 'Pembinaan Karakter',
        title: `Dukungan Karakter: ${v.category}`,
        target: `${v.studentName} (${v.studentClass})`,
        notes: `Bobot Pendampingan: +${v.pointsAdded}. Kejadian di: ${v.location || 'Sekolah'}. Keterangan: ${v.notes || '-'}`,
        status: v.handledBy && v.handledBy !== 'Belum Ditangani' ? 'Selesai' : 'Perlu Tindak Lanjut',
        absentStudents: undefined
      })),
      ...rangeHomeVisits.map(hv => ({
        id: `auto-hv-${hv.id}`,
        date: hv.date,
        time: '09:00 - 10:30',
        type: 'Home Visit (Kunjungan Rumah)',
        title: `Home Visit No: ${hv.reportNumber}`,
        target: `Siswa ${hv.studentName} (${hv.studentClass}) & Ortu/Wali (${hv.parentNameMet})`,
        notes: `Alamat: ${hv.address}. Tujuan: ${hv.purpose}. Hasil: ${hv.result}. Kesepakatan: ${hv.agreement}`,
        status: 'Selesai',
        absentStudents: undefined
      })),
      ...rangeSummons.map(sm => ({
        id: `auto-sm-${sm.id}`,
        date: sm.summonDate || sm.date,
        time: sm.summonTime || '09:00',
        type: 'Pemanggilan Orang Tua',
        title: `Pemanggilan Orang Tua - No: ${sm.letterNumber}`,
        target: `Siswa ${sm.studentName} (${sm.studentClass}) & Ortu (${sm.parentName})`,
        notes: `Tempat: ${sm.summonPlace}. Agenda: ${sm.agenda}. Status Kehadiran: ${sm.status}`,
        status: sm.status === 'Hadir' ? 'Selesai' : 'Dalam Proses',
        absentStudents: undefined
      })),
      ...rangeAch.map(a => ({
        id: `auto-ach-${a.id}`,
        date: a.date,
        time: a.time || '08:00',
        type: 'Apresiasi & Prestasi',
        title: `Prestasi: ${a.achievementName}`,
        target: `${a.studentName} (${a.studentClass})`,
        notes: `Kategori: ${a.category}. Poin Reward: +${a.pointsReward}. Catatan: ${a.notes || '-'}`,
        status: 'Selesai',
        absentStudents: undefined
      })),
      ...rangeAtt.map(att => {
        const recs = att.records || [];
        const hCount = recs.filter((r: any) => r.status === 'H').length;
        const sCount = recs.filter((r: any) => r.status === 'S').length;
        const iCount = recs.filter((r: any) => r.status === 'I').length;
        const aCount = recs.filter((r: any) => r.status === 'A').length;
        const absentRecs = recs.filter((r: any) => r.status !== 'H');
        const absentStr = absentRecs.length > 0
          ? absentRecs.map((r: any) => `${r.studentName} (${r.status === 'S' ? 'Sakit' : r.status === 'I' ? 'Izin' : 'Alpa'}${r.notes ? ` - ${r.notes}` : ''})`).join(', ')
          : 'Nihil (Semua siswa hadir)';

        return {
          id: `auto-att-${att.id || att.class}-${att.date}`,
          date: normalizeDateStr(att.date),
          time: '07:15 - 07:45',
          type: 'Presensi / Absensi Harian',
          title: `Presensi Siswa: ${att.class}`,
          target: att.class,
          notes: `Tingkat Kehadiran: ${recs.length > 0 ? Math.round((hCount / recs.length) * 100) : 100}% (${hCount} Hadir, ${sCount} Sakit, ${iCount} Izin, ${aCount} Alpa). Diinput oleh: ${att.submittedBy || 'Guru BK'}.`,
          status: 'Selesai',
          absentStudents: absentStr
        };
      })
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
    return [];
  });

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BKJournalEntry | null>(null);
  const [includeAutoInPrint, setIncludeAutoInPrint] = useState(true);

  // List of classes for quick selection helper
  const classList = React.useMemo(() => {
    if (students && students.length > 0) {
      return Array.from(new Set(students.map(s => s.class))).filter(Boolean).sort();
    }
    return [
      'Kelas 7A', 'Kelas 7B', 'Kelas 7C', 'Kelas 7D', 'Kelas 7E', 'Kelas 7F',
      'Kelas 8A', 'Kelas 8B', 'Kelas 8C', 'Kelas 8D', 'Kelas 8E', 'Kelas 8F', 'Kelas 8G',
      'Kelas 9A', 'Kelas 9B', 'Kelas 9C', 'Kelas 9D', 'Kelas 9E', 'Kelas 9F', 'Kelas 9G'
    ];
  }, [students]);

  // AI Jurnal Analyzer States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    summary?: string;
    highlights?: string[];
    suggestions?: string[];
    teacherWellbeing?: string;
  } | string | null>(null);
  const [offlineAnalysisObj, setOfflineAnalysisObj] = useState<any | null>(null);

  // Preset filter & AI Narasi generation state
  const [presetCategoryFilter, setPresetCategoryFilter] = useState<'semua' | 'mapel' | 'bk' | 'wali'>('semua');
  const [isGeneratingNarasi, setIsGeneratingNarasi] = useState(false);

  // Form Field States
  const [startTime, setStartTime] = useState('07:30');
  const [endTime, setEndTime] = useState('08:15');
  const [activityType, setActivityType] = useState<BKJournalEntry['activityType']>('Bimbingan Klasikal');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState<BKJournalEntry['status']>('Selesai');
  const [absentStudents, setAbsentStudents] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  // Helper to find selected class from target text or classList
  const findSelectedClass = (): string | null => {
    if (!target) return null;
    const targetNorm = normalizeClassStr(target);
    if (!targetNorm) return null;

    for (const cls of classList) {
      const clsNorm = normalizeClassStr(cls);
      if (clsNorm && (targetNorm.includes(clsNorm) || clsNorm.includes(targetNorm))) {
        return cls;
      }
    }

    // Regex check for 7A, 8B, 9C, VII-A, VIII B etc.
    const match = target.match(/(?:kelas|kls|siswa)?\s*([789]|vii|viii|ix)\s*[-_ ]?\s*([a-i])/i);
    if (match) {
      const grade = match[1].toUpperCase();
      const sec = match[2].toUpperCase();
      const synthesized = `Kelas ${grade}${sec}`;
      const found = classList.find(c => normalizeClassStr(c) === normalizeClassStr(synthesized));
      return found || synthesized;
    }
    return null;
  };

  const detectedClass = findSelectedClass();
  const classProgressInfo = useMemo(() => {
    if (!detectedClass) return null;
    try {
      const saved = localStorage.getItem('bk_class_teaching_progress');
      if (!saved) return null;
      const map = JSON.parse(saved);
      return map[detectedClass] || null;
    } catch {
      return null;
    }
  }, [target, classList]);

  // Handle incoming journal preset navigation from Jadwal Mengajar Widget
  useEffect(() => {
    if (presetJournalData) {
      setIsFormOpen(true);
      setActivityType('Bimbingan Klasikal');
      if (presetJournalData.className) {
        setTarget(presetJournalData.className);
      }
      if (presetJournalData.startTime) {
        setStartTime(presetJournalData.startTime);
      }
      if (presetJournalData.endTime) {
        setEndTime(presetJournalData.endTime);
      }
      const titleVal = presetJournalData.subject || (presetJournalData.className ? `Bimbingan Klasikal - ${presetJournalData.className}` : 'Bimbingan Klasikal');
      setTitle(titleVal);

      const periodText = presetJournalData.period ? ` (${presetJournalData.period})` : '';
      const timeText = (presetJournalData.startTime && presetJournalData.endTime) ? ` jam ${presetJournalData.startTime} - ${presetJournalData.endTime} WIB` : '';
      if (presetJournalData.topic) {
        setDescription(`Pelaksanaan Bimbingan Klasikal${periodText}${timeText} di ${presetJournalData.className || 'kelas'}.\nCatatan Materi / Topik: ${presetJournalData.topic}`);
      } else {
        setDescription(`Pelaksanaan Bimbingan Klasikal tatap muka${periodText}${timeText} di ${presetJournalData.className || 'kelas'}.`);
      }
      if (onClearPresetJournalData) {
        onClearPresetJournalData();
      }
    }
  }, [presetJournalData]);

  // Helper to compute day name in Indonesian for selectedDate
  const selectedDayName = useMemo(() => {
    if (!selectedDate) return 'Senin';
    const dayMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const d = new Date(selectedDate);
    return dayMap[d.getDay()] || 'Senin';
  }, [selectedDate]);

  // Read teaching schedule for selected day from localStorage
  const daySchedules = useMemo(() => {
    try {
      const saved = localStorage.getItem('bk_teaching_schedule');
      if (!saved) return [];
      const list = JSON.parse(saved);
      if (!Array.isArray(list)) return [];
      return list.filter((s: any) => s.day === selectedDayName);
    } catch {
      return [];
    }
  }, [selectedDayName, isFormOpen]);

  // Fast apply scheduled class to journal form
  const handleApplyScheduleItem = (sch: any) => {
    let sTime = '07:30';
    let eTime = '08:50';
    if (sch.timeRange) {
      const parts = sch.timeRange.split('-').map((p: string) => p.trim());
      if (parts.length === 2 && parts[0] && parts[1]) {
        sTime = parts[0];
        eTime = parts[1];
      }
    }
    setStartTime(sTime);
    setEndTime(eTime);
    setActivityType('Bimbingan Klasikal');
    setTarget(sch.className || '');
    setTitle(sch.subject || `Bimbingan Klasikal - ${sch.className}`);

    let lastProgText = '';
    try {
      const progSaved = localStorage.getItem('bk_class_teaching_progress');
      if (progSaved) {
        const pObj = JSON.parse(progSaved);
        if (pObj[sch.className]?.lastTopic) {
          lastProgText = `\nProgress Catatan Sebelumnya: ${pObj[sch.className].lastTopic}`;
        }
      }
    } catch {}

    setDescription(`Pelaksanaan KBM / Bimbingan Klasikal (${sch.period || 'Jam KBM'}) pukul ${sTime} - ${eTime} WIB di ${sch.className}.\nMateri / Topik: ${sch.subject || 'Bimbingan Klasikal'}.${lastProgText}`);
  };


  // Automatically load absent students from attendance logs
  const handleAutoLoadAbsensi = (customClassTarget?: string) => {
    let detected = customClassTarget || findSelectedClass();
    
    const saved = localStorage.getItem('bk_attendance_history');
    const attendanceHistory: any[] = saved ? JSON.parse(saved) : [];
    const dateNorm = normalizeDateStr(selectedDate);

    // If still not detected, and there is attendance on this date, check if there's only 1 record or suggest
    if (!detected && attendanceHistory.length > 0) {
      const dateRecords = attendanceHistory.filter(r => normalizeDateStr(r.date) === dateNorm);
      if (dateRecords.length === 1) {
        detected = dateRecords[0].class;
        setTarget(detected);
      }
    }

    if (!detected) {
      alert('Sistem tidak dapat mendeteksi nama kelas dari kolom "Sasaran / Peserta". Mohon pilih kelas dari tombol "Pilih Kelas Cepat" atau sebutkan nama kelas di kolom Sasaran (misal: Kelas 8A).');
      return;
    }

    const targetNorm = normalizeClassStr(detected);

    // Find record by normalized class and date
    let record = attendanceHistory.find((r: any) => {
      const rClassNorm = normalizeClassStr(r.class || r.className || r.kelas || '');
      const rDateNorm = normalizeDateStr(r.date);
      return rClassNorm === targetNorm && rDateNorm === dateNorm;
    });

    // Fallback: search most recent record for this class if current date isn't found
    if (!record) {
      const classRecords = attendanceHistory.filter((r: any) => {
        const rClassNorm = normalizeClassStr(r.class || r.className || r.kelas || '');
        return rClassNorm === targetNorm;
      }).sort((a: any, b: any) => normalizeDateStr(b.date).localeCompare(normalizeDateStr(a.date)));

      if (classRecords.length > 0) {
        record = classRecords[0];
      }
    }

    if (!record) {
      alert(`Data absensi belum ditemukan untuk ${detected} pada tanggal ${formatIndonesianDate(selectedDate)}.\n\nTips: Anda dapat mengisi absensi kelas terlebih dahulu di menu "Absensi Kelas" atau pilih tanggal yang sesuai.`);
      return;
    }

    const recDate = normalizeDateStr(record.date) || selectedDate;
    const records = record.records || [];
    const absentList = records.filter((r: any) => r.status && r.status !== 'H');
    const hadirCount = records.filter((r: any) => r.status === 'H').length;

    if (absentList.length === 0) {
      const hadirText = `Nihil (Semua ${hadirCount > 0 ? `${hadirCount} ` : ''}siswa hadir)`;
      setAbsentStudents(hadirText);
      alert(`✅ Berhasil! Semua siswa ${detected} tercatat Hadir pada tanggal ${formatIndonesianDate(recDate)}.`);
      return;
    }

    const statusLabels: Record<string, string> = {
      'S': 'Sakit',
      'I': 'Izin',
      'A': 'Alpa'
    };

    const formattedAbsent = absentList
      .map((r: any) => {
        const sLabel = statusLabels[r.status] || r.status;
        const note = r.notes ? ` - ${r.notes}` : '';
        return `${r.studentName || 'Siswa'} (${sLabel}${note})`;
      })
      .join(', ');

    setAbsentStudents(formattedAbsent);
    setShowOptionalFields(true);
    alert(`✅ Berhasil memuat ${absentList.length} siswa tidak hadir dari absensi ${detected} (Tanggal ${formatIndonesianDate(recDate)}):\n\n${formattedAbsent}`);
  };

  // Verification Proof Photo states & camera setup
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string | undefined>(undefined);
  const [proofPhotoName, setProofPhotoName] = useState<string | undefined>(undefined);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Auto clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async () => {
    setShowCamera(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Gagal mengakses kamera. Pastikan izin kamera diberikan.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setProofPhotoUrl(dataUrl);
        setProofPhotoName(`Kamera_Jurnal_${new Date().toISOString().slice(0,10)}_${Math.floor(Math.random() * 1000)}.jpg`);
        stopCamera();
      }
    } catch (err) {
      console.error('Capture error:', err);
      setCameraError('Gagal mengambil gambar dari kamera.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setProofPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setProofPhotoUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Sync to local cache
  useEffect(() => {
    localStorage.setItem('bk_daily_journals', JSON.stringify(journalEntries));
    if (isInitialMountJournal.current) {
      isInitialMountJournal.current = false;
      return;
    }
    triggerBackgroundAutoSync();
  }, [journalEntries]);

  // Realtime subscriber for remote changes
  useEffect(() => {
    const handleRealtimeUpdate = (e: any) => {
      if (e.detail?.key === 'bk_daily_journals') {
        if (Array.isArray(e.detail.data)) {
          setJournalEntries(e.detail.data);
        } else {
          const saved = localStorage.getItem('bk_daily_journals');
          if (saved) setJournalEntries(JSON.parse(saved));
        }
      }
    };

    window.addEventListener('bk_realtime_sync', handleRealtimeUpdate);
    window.addEventListener('storage', (e) => {
      if (e.key === 'bk_daily_journals') {
        handleRealtimeUpdate({ detail: { key: e.key } });
      }
    });

    return () => {
      window.removeEventListener('bk_realtime_sync', handleRealtimeUpdate);
    };
  }, []);

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
      setProofPhotoUrl(editingEntry.proofPhotoUrl);
      setProofPhotoName(editingEntry.proofPhotoName);
      setAbsentStudents(editingEntry.absentStudents || '');
      setShowOptionalFields(Boolean(editingEntry.absentStudents || editingEntry.proofPhotoUrl));
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
    setProofPhotoUrl(undefined);
    setProofPhotoName(undefined);
    setAbsentStudents('');
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
      const updatedEntry: BKJournalEntry = {
        ...editingEntry,
        startTime,
        endTime,
        activityType,
        title,
        description,
        target,
        status,
        date: selectedDate, // update to currently viewed date
        proofPhotoUrl,
        proofPhotoName,
        absentStudents: absentStudents.trim() || undefined,
      };
      setJournalEntries(prev => prev.map(item => item.id === editingEntry.id ? updatedEntry : item));
      saveToFirestore('bk_daily_journals', updatedEntry);
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
        createdAt: new Date().toISOString(),
        proofPhotoUrl,
        proofPhotoName,
        absentStudents: absentStudents.trim() || undefined,
      };
      setJournalEntries(prev => [newEntry, ...prev]);
      saveToFirestore('bk_daily_journals', newEntry);

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

    // Auto-linkage: Update Class Teaching Progress in LocalStorage
    if (detectedClass) {
      try {
        const currentProgressRaw = localStorage.getItem('bk_class_teaching_progress');
        const progressMap = currentProgressRaw ? JSON.parse(currentProgressRaw) : {};
        progressMap[detectedClass] = {
          className: detectedClass,
          lastDate: selectedDate,
          lastTopic: title.trim(),
          notes: description.trim(),
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem('bk_class_teaching_progress', JSON.stringify(progressMap));
      } catch (err) {
        console.warn('Failed to auto-update class teaching progress:', err);
      }
    }

    handleResetForm();
  };

  const handleDeleteEntry = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus catatan jurnal ini?')) {
      registerDeletedId(id);
      deleteFromFirestore('bk_daily_journals', id);
      setJournalEntries(prev => prev.filter(item => item.id !== id));
    }
  };

  // Scan current day automatic activities
  const currentDayServices = services.filter(s => s.date === selectedDate);
  const currentDayViolations = violations.filter(v => v.date === selectedDate);
  const currentSchoolId = activeCounselor?.schoolId;

  const homeVisits: any[] = loadSchoolData('bk_home_visits', [], currentSchoolId);
  const currentDayHomeVisits = homeVisits.filter(hv => hv.date === selectedDate);

  const summons: any[] = loadSchoolData('bk_parent_summons', [], currentSchoolId);
  const currentDaySummons = summons.filter(sm => (sm.summonDate || sm.date) === selectedDate);

  const achievements: any[] = loadSchoolData('bk_achievements', [], currentSchoolId);
  const currentDayAchievements = achievements.filter(a => a.date === selectedDate);

  const attendanceHistory: any[] = loadSchoolData('bk_attendance_history', [], currentSchoolId);
  const currentDayAttendance = attendanceHistory.filter(att => normalizeDateStr(att.date) === normalizeDateStr(selectedDate));

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
      absentStudents: undefined as string | undefined,
      raw: s
    })),
    ...currentDayViolations.map(v => ({
      id: `auto-v-${v.id}`,
      time: v.time || '10:00',
      type: 'Pembinaan Karakter',
      title: `Dukungan Karakter: ${v.category}`,
      target: `${v.studentName} (${v.studentClass})`,
      notes: `Bobot Pendampingan: +${v.pointsAdded}. Kejadian di: ${v.location || 'Sekolah'}. Keterangan: ${v.notes || '-'}`,
      status: v.handledBy && v.handledBy !== 'Belum Ditangani' ? 'Selesai' : 'Perlu Tindak Lanjut',
      absentStudents: undefined as string | undefined,
      raw: v
    })),
    ...currentDayHomeVisits.map(hv => ({
      id: `auto-hv-${hv.id}`,
      time: '09:00 - 10:30',
      type: 'Home Visit (Kunjungan Rumah)',
      title: `Home Visit No: ${hv.reportNumber}`,
      target: `Siswa ${hv.studentName} (${hv.studentClass}) & Ortu/Wali (${hv.parentNameMet})`,
      notes: `Alamat: ${hv.address}. Tujuan: ${hv.purpose}. Hasil: ${hv.result}. Kesepakatan: ${hv.agreement}`,
      status: 'Selesai',
      absentStudents: undefined as string | undefined,
      raw: hv
    })),
    ...currentDaySummons.map(sm => ({
      id: `auto-sm-${sm.id}`,
      time: sm.summonTime || '09:00',
      type: 'Pemanggilan Orang Tua',
      title: `Pemanggilan Orang Tua - No: ${sm.letterNumber}`,
      target: `Siswa ${sm.studentName} (${sm.studentClass}) & Ortu (${sm.parentName})`,
      notes: `Tempat: ${sm.summonPlace}. Agenda: ${sm.agenda}. Status Kehadiran: ${sm.status}`,
      status: sm.status === 'Hadir' ? 'Selesai' : 'Dalam Proses',
      absentStudents: undefined as string | undefined,
      raw: sm
    })),
    ...currentDayAchievements.map(a => ({
      id: `auto-ach-${a.id}`,
      time: a.time || '08:00',
      type: 'Apresiasi & Prestasi',
      title: `Prestasi: ${a.achievementName}`,
      target: `${a.studentName} (${a.studentClass})`,
      notes: `Kategori: ${a.category}. Poin Reward: +${a.pointsReward}. Catatan: ${a.notes || '-'}`,
      status: 'Selesai',
      absentStudents: undefined as string | undefined,
      raw: a
    })),
    ...currentDayAttendance.map(att => {
      const recs = att.records || [];
      const hCount = recs.filter((r: any) => r.status === 'H').length;
      const sCount = recs.filter((r: any) => r.status === 'S').length;
      const iCount = recs.filter((r: any) => r.status === 'I').length;
      const aCount = recs.filter((r: any) => r.status === 'A').length;
      const absentRecs = recs.filter((r: any) => r.status !== 'H');
      const absentStr = absentRecs.length > 0
        ? absentRecs.map((r: any) => `${r.studentName} (${r.status === 'S' ? 'Sakit' : r.status === 'I' ? 'Izin' : 'Alpa'}${r.notes ? ` - ${r.notes}` : ''})`).join(', ')
        : 'Nihil (Semua siswa hadir)';

      return {
        id: `auto-att-${att.id || att.class}-${att.date}`,
        time: '07:15 - 07:45',
        type: 'Presensi / Absensi Harian',
        title: `Presensi Siswa: ${att.class}`,
        target: att.class,
        notes: `Tingkat Kehadiran: ${recs.length > 0 ? Math.round((hCount / recs.length) * 100) : 100}% (${hCount} Hadir, ${sCount} Sakit, ${iCount} Izin, ${aCount} Alpa dari ${recs.length} siswa). Diinput oleh: ${att.submittedBy || 'Guru BK'}.`,
        status: 'Selesai',
        absentStudents: absentStr,
        raw: att
      };
    })
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
    } else if (auto.type.includes('Disiplin') || auto.type.includes('Pembinaan')) {
      manualActType = 'Kasus Mendesak';
    } else if (auto.type.includes('Presensi') || auto.type.includes('Absensi')) {
      manualActType = 'Bimbingan Klasikal';
    }

    // Populate form and open it
    setStartTime(sTime);
    setEndTime(eTime);
    setActivityType(manualActType);
    setTitle(auto.title);
    setDescription(auto.notes);
    setTarget(auto.target);
    if (auto.absentStudents) {
      setAbsentStudents(auto.absentStudents);
    }
    setStatus(auto.status as BKJournalEntry['status']);
    setIsFormOpen(true);
    
    // Scroll to form smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Batch import all auto activities for selected date into manual journal
  const handleImportAllTodayAutoToManual = () => {
    if (mappedAutoActivities.length === 0) {
      alert('Tidak ada aktivitas otomatis (Sesi Layanan / Pembinaan Karakter / Absensi) untuk tanggal ini.');
      return;
    }

    const newEntries: BKJournalEntry[] = mappedAutoActivities.map((auto, idx) => {
      const times = auto.time.split(' - ');
      const sTime = times[0] || '08:00';
      const eTime = times[1] || '08:45';

      let manualActType: BKJournalEntry['activityType'] = 'Lain-lain';
      if (auto.type.includes('Layanan')) {
        manualActType = 'Bimbingan Klasikal';
      } else if (auto.type.includes('Pembinaan')) {
        manualActType = 'Kasus Mendesak';
      } else if (auto.type.includes('Presensi') || auto.type.includes('Absensi')) {
        manualActType = 'Bimbingan Klasikal';
      }

      return {
        id: `j-auto-batch-${Date.now()}-${idx}`,
        date: selectedDate,
        startTime: sTime,
        endTime: eTime,
        activityType: manualActType,
        title: auto.title,
        description: auto.notes,
        target: auto.target,
        absentStudents: auto.absentStudents || undefined,
        status: (auto.status === 'Selesai' ? 'Selesai' : 'Perlu Tindak Lanjut') as BKJournalEntry['status'],
        counselorId: activeCounselor.id,
        createdAt: new Date().toISOString()
      };
    });

    setJournalEntries(prev => [...newEntries, ...prev]);
    newEntries.forEach(ne => saveToFirestore('bk_daily_journals', ne));
    alert(`Berhasil mengimpor ${mappedAutoActivities.length} kegiatan otomatis ke Jurnal Harian permanen!`);
  };

  // Multi-Role RPL & Journal Presets (Guru Mapel, Guru BK, Wali Kelas)
  const quickJournalPresets = [
    // --- GURU MATA PELAJARAN (MAPEL) ---
    {
      category: 'mapel' as const,
      label: '📚 KBM Mapel & Diskusi Interaktif',
      actType: 'Kegiatan Mengajar Mata Pelajaran' as const,
      sTime: '07:30',
      eTime: '09:00',
      presetTitle: 'Pembelajaran Interaktif & Diskusi Kelompok Mata Pelajaran',
      presetTarget: 'Siswa Kelas VIII-B',
      presetDesc: 'Pelaksanaan Kegiatan Belajar Mengajar (KBM) mata pelajaran. Penyampaian materi apersepsi, diskusi kelompok memecahkan soal studi kasus, presentasi hasil karya siswa, serta refleksi dan kuis singkat pemahaman materi.'
    },
    {
      category: 'mapel' as const,
      label: '🔬 Praktikum / Proyek Belajar (PBL/P5)',
      actType: 'Kegiatan Mengajar Mata Pelajaran' as const,
      sTime: '09:15',
      eTime: '10:45',
      presetTitle: 'Praktikum Laboratorium / Pembelajaran Berbasis Proyek (PBL)',
      presetTarget: 'Siswa Kelas IX-A',
      presetDesc: 'Pendampingan siswa dalam praktikum dan pengerjaan proyek kelompok. Guru memberikan arahan prosedur K3 laboratorium, membimbing pengamatan eksperimen, serta mengevaluasi laporan kerja praktikum.'
    },
    {
      category: 'mapel' as const,
      label: '📝 Asesmen / Ujian Formatif-Sumatif',
      actType: 'Kegiatan Mengajar Mata Pelajaran' as const,
      sTime: '11:00',
      eTime: '12:15',
      presetTitle: 'Pelaksanaan Asesmen / Kuis Harian Evaluasi Pembelajaran',
      presetTarget: 'Siswa Kelas VII-C',
      presetDesc: 'Mengawasi dan memfasilitasi pelaksanaan asesmen formatif/sumatif mata pelajaran. Pengumpulan hasil lembar jawaban, pemberian umpan balik (feedback) langsung, serta pengolahan nilai Kriteria Ketercapaian Tujuan Pembelajaran (KKTP).'
    },
    {
      category: 'mapel' as const,
      label: '🔄 Remedial & Pengayaan Akademik',
      actType: 'Kegiatan Mengajar Mata Pelajaran' as const,
      sTime: '13:00',
      eTime: '14:00',
      presetTitle: 'Bimbingan Remedial & Pengayaan Ketercapaian Belajar',
      presetTarget: 'Kelompok Siswa Perlu Pendampingan',
      presetDesc: 'Sesi bimbingan remedial bagi siswa yang belum mencapai KKTP serta pemberian materi pengayaan/soal HOTS bagi siswa yang telah tuntas. Dilanjutkan dengan evaluasi ulangan perbaikan.'
    },

    // --- GURU BK / KONSELOR ---
    {
      category: 'bk' as const,
      label: '🏫 Bimbingan Klasikal (Pengembangan Diri)',
      actType: 'Bimbingan Klasikal' as const,
      sTime: '08:00',
      eTime: '09:30',
      presetTitle: 'Bimbingan Klasikal: Motivasi Belajar & Pemetaan Cita-Cita',
      presetTarget: 'Siswa Kelas VIII-A',
      presetDesc: 'Pelaksanaan bimbingan klasikal bertema pengembangan potensi dan motivasi belajar. Guru BK memberikan ceramah interaktif, pemutaran video inspiratif, diskusi kelompok, serta pengisian lembar komitmen belajar mandiri.'
    },
    {
      category: 'bk' as const,
      label: '👥 Bimbingan Kelompok (Keterampilan Sosial)',
      actType: 'Bimbingan Klasikal' as const,
      sTime: '10:00',
      eTime: '11:00',
      presetTitle: 'Bimbingan Kelompok: Manajemen Stres & Pembagian Waktu',
      presetTarget: 'Kelompok Siswa Kelas 9',
      presetDesc: 'Diskusi kelompok terarah membahas strategi menghadapi kecemasan ujian, manajemen penggunaan gawai, serta penyusunan jadwal harian efektif dengan teknik Pomodoro.'
    },
    {
      category: 'bk' as const,
      label: '🤝 Konseling Individual (Pendampingan)',
      actType: 'Kasus Mendesak' as const,
      sTime: '11:15',
      eTime: '12:00',
      presetTitle: 'Konseling Individual: Pendampingan Potensi & Solusi Hambatan Belajar',
      presetTarget: 'Siswa Ybs & Guru BK',
      presetDesc: 'Sesi konseling individual empatik untuk membantu siswa mengenali hambatan emosional/akademik, membangun kesadaran diri, serta merumuskan kontrak perilaku positif secara mandiri.'
    },
    {
      category: 'bk' as const,
      label: '📞 Konsultasi Wali Murid',
      actType: 'Konsultasi Orang Tua' as const,
      sTime: '13:00',
      eTime: '14:00',
      presetTitle: 'Konsultasi Wali Murid: Sinergi Pendampingan Karakter & Belajar',
      presetTarget: 'Orang Tua / Wali Siswa',
      presetDesc: 'Pertemuan konsultasi dengan orang tua murid untuk mengomunikasikan perkembangan positif dan karakter siswa di sekolah serta merumuskan kesepakatan pemantauan kegiatan di rumah.'
    },
    {
      category: 'bk' as const,
      label: '📋 Administrasi BK & RPL',
      actType: 'Administrasi BK' as const,
      sTime: '14:00',
      eTime: '15:30',
      presetTitle: 'Penyusunan RPL & Instrumen Asesmen Kebutuhan Siswa',
      presetTarget: 'Dokumen Administrasi BK',
      presetDesc: 'Penyusunan modul Rencana Pelaksanaan Layanan (RPL) bimbingan klasikal, rekapitulasi instrumen kebutuhan siswa (AKPD), serta pembaruan riwayat layanan bimbingan konseling.'
    },

    // --- WALI KELAS & TUGAS TAMBAHAN ---
    {
      category: 'wali' as const,
      label: '🏫 Pembinaan Wali Kelas & Presensi',
      actType: 'Rapat Koordinasi' as const,
      sTime: '07:00',
      eTime: '07:30',
      presetTitle: 'Pembinaan Karakter Kelas & Pengelolaan Kebersihan Lingkungan',
      presetTarget: 'Siswa Kelas Binaan (Wali Kelas)',
      presetDesc: 'Pengarahan rutin wali kelas mengenai kerapian seragam, kebersihan ruang kelas, rekapitulasi kehadiran siswa, serta penguatan kedisiplinan dan kebersamaan kelas.'
    },
    {
      category: 'wali' as const,
      label: '🤝 Rapat Koordinasi Dewan Guru',
      actType: 'Rapat Koordinasi' as const,
      sTime: '13:30',
      eTime: '15:00',
      presetTitle: 'Rapat Evaluasi Pembelajaran & Penanganan Siswa Antar Guru',
      presetTarget: 'Dewan Guru & Kepala Sekolah',
      presetDesc: 'Mengikuti rapat koordinasi evaluasi kurikulum, penyelarasan program P5, serta pemetaan strategi penanganan siswa berkesulitan belajar bersama dewan guru.'
    }
  ];

  const handleApplyPreset = (preset: typeof quickJournalPresets[0]) => {
    setActivityType(preset.actType);
    setStartTime(preset.sTime);
    setEndTime(preset.eTime);
    setTitle(preset.presetTitle);
    setTarget(preset.presetTarget);
    setDescription(preset.presetDesc);
  };

  // Smart AI Narasi Generator (Supports both Guru Mapel & Guru BK)
  const handleSmartGenerateNarasi = async () => {
    if (!title.trim() && !activityType) {
      alert('Mohon isi terlebih dahulu nama kegiatan / topik atau jenis kegiatan.');
      return;
    }

    setIsGeneratingNarasi(true);

    try {
      const response = await fetch('/api/gemini/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'journal_narration',
          title,
          activityType,
          target
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.narration) {
          const finalNarration = typeof data.narration === 'string' ? data.narration : (data.narration?.narration || String(data.narration));
          setDescription(finalNarration);
          setIsGeneratingNarasi(false);
          return;
        }
      }
    } catch (e) {
      console.warn('API call failed or server offline. Using fallback narrator.');
    }

    // Dynamic non-monotonous fallback narrator
    const tText = target.trim() ? `sasaran ${target.trim()}` : 'peserta didik';
    let fallbackNarrative = '';

    if (activityType.includes('Mengajar') || activityType.includes('Mata Pelajaran')) {
      fallbackNarrative = `Pelaksanaan Kegiatan Belajar Mengajar (KBM) mata pelajaran dengan topik "${title || 'Materi Pembelajaran'}" untuk ${tText}. Guru memberikan apersepsi, memfasilitasi diskusi interaktif dan latihan soal mandiri/kelompok, serta menutup kegiatan dengan refleksi dan evaluasi pemahaman siswa. Suasana kelas berlangsung tertib dan kondusif.`;
    } else if (activityType === 'Bimbingan Klasikal') {
      fallbackNarrative = `Pelaksanaan bimbingan klasikal tatap muka bertema "${title || 'Pengembangan Diri'}" untuk ${tText}. Guru membimbing pemahaman materi, memfasilitasi diskusi interaktif, serta memberikan lembar refleksi pribadi. Peserta didik antusias dan aktif merumuskan komitmen bersama.`;
    } else if (activityType === 'Konsultasi Orang Tua') {
      fallbackNarrative = `Pelaksanaan konsultasi tatap muka bersama ${target || 'orang tua / wali murid'} membahas topik "${title || 'Sinergi Pendampingan Belajar'}". Mendiskusikan perkembangan positif siswa serta menyepakati pola pemantauan bersama di sekolah dan rumah.`;
    } else if (activityType === 'Rapat Koordinasi') {
      fallbackNarrative = `Pelaksanaan rapat koordinasi profesional bertema "${title || 'Koordinasi Pembelajaran & Kurikulum'}" bersama ${target || 'dewan guru'}. Menghasilkan kesepakatan langkah kerja, pembagian peran, dan rencana tindak lanjut yang terukur.`;
    } else if (activityType === 'Administrasi BK') {
      fallbackNarrative = `Kegiatan administrasi dan pengarsipan perangkat layanan: "${title || 'Penyusunan Perangkat & Admin BK'}". Meliputi penyusunan RPL/Modul, rekapitulasi data instrumen siswa, serta penataan arsip harian secara rapi dan sistematis.`;
    } else if (activityType === 'Kasus Mendesak') {
      fallbackNarrative = `Penanganan responsif terhadap kebutuhan pendampingan "${title || 'Krisis Perilaku & Mediasi'}" untuk ${tText}. Dilakukan pengumpulan informasi, penenangan emosi, perumusan kesepakatan solusi (restitusi), serta penjadwalan evaluasi tindak lanjut.`;
    } else {
      fallbackNarrative = `Pelaksanaan kegiatan profesional pendidik: "${title || 'Kegiatan Sekolah'}" untuk ${tText}. Seluruh alur kegiatan terlaksana dengan baik, lancar, dan terdokumentasi sesuai rencana.`;
    }

    setDescription(fallbackNarrative);
    setIsGeneratingNarasi(false);
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

  // Reset analysis when date shifts
  useEffect(() => {
    setAnalysisResult(null);
    setOfflineAnalysisObj(null);
  }, [selectedDate]);

  const handleAnalyzeDay = async () => {
    const activities = [
      ...filteredManualEntries.map(e => ({
        type: `Manual: ${e.activityType}`,
        title: e.title,
        target: e.target,
        notes: e.description,
        status: e.status
      })),
      ...mappedAutoActivities.map(a => ({
        type: `Otomatis: ${a.type}`,
        title: a.title,
        target: a.target,
        notes: a.notes,
        status: a.status
      }))
    ];

    if (activities.length === 0) {
      alert('Tidak ada kegiatan (manual maupun otomatis) yang tercatat pada tanggal ini untuk dianalisis.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setOfflineAnalysisObj(null);

    // Try server API first
    try {
      const response = await fetch('/api/gemini/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'daily_journal',
          date: selectedDate,
          activities
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.recommendation) {
          setAnalysisResult(data.recommendation);
          setIsAnalyzing(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Daily analysis API failed or server-side key missing. Falling back to offline rule-based playbook.');
    }

    // Offline fallback analyzer (Dynamic, non-monotonous, non-repetitive!)
    setTimeout(() => {
      const allText = activities.map(a => `${a.title} ${a.notes} ${a.type}`).join(' ').toLowerCase();

      const isMapelHeavy = activities.some(a =>
        a.type.toLowerCase().includes('mengajar') ||
        a.title.toLowerCase().includes('mapel') ||
        a.title.toLowerCase().includes('kbm') ||
        a.title.toLowerCase().includes('pembelajaran') ||
        a.title.toLowerCase().includes('praktikum') ||
        a.title.toLowerCase().includes('asesmen')
      );

      let detectedFocus: string[] = [];
      if (allText.includes('mengajar') || allText.includes('kbm') || allText.includes('mapel')) detectedFocus.push('Kegiatan Belajar Mengajar (KBM Mapel)');
      if (allText.includes('praktikum') || allText.includes('proyek') || allText.includes('p5')) detectedFocus.push('Praktikum & Pembelajaran Berbasis Proyek');
      if (allText.includes('asesmen') || allText.includes('ujian') || allText.includes('kuis') || allText.includes('nilai')) detectedFocus.push('Asesmen & Evaluasi Pembelajaran');
      if (allText.includes('klasikal') || allText.includes('bimbingan')) detectedFocus.push('Layanan Bimbingan Klasikal/Kelompok');
      if (allText.includes('konseling') || allText.includes('mediasi')) detectedFocus.push('Konseling & Pendampingan Siswa');
      if (allText.includes('orang tua') || allText.includes('wali murid')) detectedFocus.push('Konsultasi & Sinergi Orang Tua');
      if (allText.includes('rapat') || allText.includes('koordinasi')) detectedFocus.push('Rapat & Pembinaan Sekolah');

      if (detectedFocus.length === 0) {
        detectedFocus.push(isMapelHeavy ? 'Pengelolaan Pembelajaran Kelas & Pendampingan' : 'Pengembangan Iklim Belajar & Pembinaan Pendidik');
      }

      setOfflineAnalysisObj({
        tren: `Aktivitas harian hari ini berfokus pada: ${detectedFocus.join(', ')}. Suasana pelaksanaan agenda belajar mengajar dan pembinaan siswa terpantau berjalan lancar dan produktif.`,
        prioritas: activities.length > 0 ? activities[0].target : 'Peserta didik & Kelas sasaran hari ini.',
        rekomendasi: [
          isMapelHeavy
            ? 'Gunakan metode pembelajaran variatif (diskusi interaktif/PBL/praktikum) untuk meningkatkan keterlibatan siswa di kelas.'
            : 'Pertahankan komunikasi empatik dan sinergi bersama wali kelas untuk memantau perkembangan siswa secara berkala.',
          'Sediakan waktu 5-10 menit di akhir kegiatan untuk memberikan umpan balik (feedback) apresiatif kepada peserta didik.',
          'Pastikan catatan jurnal dan instrumen penilaian/bimbingan terdokumentasi dengan rapi sebagai bahan evaluasi mingguan.'
        ],
        wellbeing: 'Apresiasi yang tinggi untuk dedikasi tulus Anda hari ini. Luangkan waktu sejenak untuk memejamkan mata, mengatur napas rileks, dan nikmati waktu istirahat yang berkualitas bersama keluarga.'
      });
      setIsAnalyzing(false);
    }, 1200);
  };

  // Quick navigation dates
  const handleSetRelativeDate = (daysOffset: number) => {
    const today = new Date();
    const targetDate = new Date(today.setDate(today.getDate() + daysOffset));
    const offset = targetDate.getTimezoneOffset();
    const localDate = new Date(targetDate.getTime() - (offset * 60 * 1000));
    setSelectedDate(localDate.toISOString().split('T')[0]);
  };

  // All historical entries combined (manual + auto)
  const allHistoryEntries = useMemo(() => {
    const manual = journalEntries
      .filter(e => activeCounselor.id === 'admin' || e.counselorId === activeCounselor.id)
      .map(e => ({
        id: e.id,
        date: e.date,
        time: `${e.startTime} - ${e.endTime}`,
        activityType: e.activityType,
        title: e.title,
        description: e.description,
        target: e.target,
        status: e.status,
        absentStudents: e.absentStudents,
        proofPhotoUrl: e.proofPhotoUrl,
        proofPhotoName: e.proofPhotoName,
        counselorId: e.counselorId,
        isAuto: false,
        rawEntry: e
      }));

    const auto = getRangeAutoActivities('2000-01-01', '2099-12-31').map(a => ({
      id: a.id,
      date: a.date,
      time: a.time,
      activityType: a.type,
      title: a.title,
      description: a.notes,
      target: a.target,
      status: a.status,
      absentStudents: a.absentStudents || undefined,
      proofPhotoUrl: undefined,
      proofPhotoName: undefined,
      counselorId: 'system',
      isAuto: true,
      rawEntry: null
    }));

    const list: any[] = [...manual];
    if (includeAutoInPrint) {
      list.push(...auto);
    }

    return list.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  }, [journalEntries, services, violations, activeCounselor, includeAutoInPrint]);

  const filteredHistoryEntries = useMemo(() => {
    const q = historySearch.toLowerCase().trim();
    return allHistoryEntries.filter(entry => {
      const matchQuery = !q ||
        entry.title.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.target.toLowerCase().includes(q) ||
        entry.activityType.toLowerCase().includes(q) ||
        entry.date.includes(q);

      const matchType = historyActivityType === 'Semua' || entry.activityType === historyActivityType;
      
      let matchMonth = true;
      if (historySelectedMonth !== 'Semua') {
        matchMonth = entry.date.startsWith(historySelectedMonth);
      }

      return matchQuery && matchType && matchMonth;
    });
  }, [allHistoryEntries, historySearch, historyActivityType, historySelectedMonth]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <PageHeaderBanner
        category="Beranda & Jurnal"
        title="Jurnal Harian Kegiatan Guru BK"
        description="Catatan formal harian pelaksanaan bimbingan klasikal, konseling individual, mediasi kasus, rapat dinas, serta arsip cetak format dinas."
        icon={<ClipboardList className="w-5 h-5" />}
        badge={formatIndonesianDate(selectedDate)}
        workflowHint="1. Pilih Tanggal Jurnal › 2. Tambah Aktivitas Manual atau Impor Otomatis › 3. Klik Cetak PDF untuk format rekap resmi"
        stats={[
          { label: 'Tanggal', value: selectedDate },
          { label: 'Catatan Manual', value: filteredManualEntries.length },
          { label: 'Aktivitas Otomatis', value: mappedAutoActivities.length },
          { label: 'Total Hari Ini', value: totalItemsCount, color: 'text-[#00685f]' }
        ]}
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={includeAutoInPrint}
                onChange={(e) => setIncludeAutoInPrint(e.target.checked)}
                className="w-4 h-4 rounded text-[#00685f] focus:ring-[#00685f] cursor-pointer"
              />
              <span>Sertakan Layanan Otomatis di PDF</span>
            </label>

            <button
              onClick={handlePrintPDF}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-md cursor-pointer active:scale-97"
              title="Cetak/Unduh Jurnal Hari Ini (PDF)"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak PDF</span>
            </button>
          </div>
        }
      />

      {/* Mode Switcher Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#bcc9c6]/30 pb-2 overflow-x-auto">
        <button
          onClick={() => setViewMode('daily')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
            viewMode === 'daily'
              ? 'bg-[#00685f] text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Catat & Lihat Jurnal Tanggal Terpilih</span>
        </button>

        <button
          onClick={() => setViewMode('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
            viewMode === 'history'
              ? 'bg-[#00685f] text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <History className="w-4 h-4 text-amber-300" />
          <span>Lihat Riwayat Semua Jurnal BK ({allHistoryEntries.length})</span>
        </button>
      </div>

      {viewMode === 'history' ? (
        /* HISTORY MODE VIEW */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* History Search & Filters Bar */}
          <div className="bg-white p-5 rounded-2xl border border-[#bcc9c6]/30 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Cari judul kegiatan, deskripsi, sasaran, atau tanggal..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                />
                {historySearch && (
                  <button
                    onClick={() => setHistorySearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={historyActivityType}
                  onChange={(e) => setHistoryActivityType(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                >
                  <option value="Semua">Semua Jenis Kegiatan</option>
                  <option value="Bimbingan Klasikal">Bimbingan Klasikal</option>
                  <option value="Bimbingan Kelompok">Bimbingan Kelompok</option>
                  <option value="Konseling Individual">Konseling Individual</option>
                  <option value="Konsultasi Guru & Ortu">Konsultasi Guru & Ortu</option>
                  <option value="Mediasi & Konferensi Kasus">Mediasi & Konferensi Kasus</option>
                  <option value="Home Visit (Kunjungan Rumah)">Home Visit</option>
                  <option value="Administrasi & Pengembangan BK">Administrasi & Pengembangan BK</option>
                  <option value="Layanan BK Konseling">Layanan BK Konseling (Auto)</option>
                  <option value="Pembinaan Karakter">Pembinaan Karakter (Auto)</option>
                </select>

                <select
                  value={historySelectedMonth}
                  onChange={(e) => setHistorySelectedMonth(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                >
                  <option value="Semua">Semua Bulan / Tahun</option>
                  <option value="2026-07">Juli 2026</option>
                  <option value="2026-08">Agustus 2026</option>
                  <option value="2026-09">September 2026</option>
                  <option value="2026-10">Oktober 2026</option>
                  <option value="2026-11">November 2026</option>
                  <option value="2026-12">Desember 2026</option>
                  <option value="2026-01">Januari 2026</option>
                </select>

                <button
                  onClick={handleDownloadRangePDF}
                  className="px-3.5 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Cetak PDF Rentang</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100 text-xs">
              <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100">
                <span className="text-gray-500 text-[10px] font-bold block uppercase">Total Jurnal Tampil</span>
                <span className="text-base font-black text-[#00685f]">{filteredHistoryEntries.length} Sesi</span>
              </div>
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="text-gray-500 text-[10px] font-bold block uppercase">Bimbingan Klasikal</span>
                <span className="text-base font-black text-blue-700">
                  {filteredHistoryEntries.filter(e => e.activityType === 'Bimbingan Klasikal').length} Sesi
                </span>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                <span className="text-gray-500 text-[10px] font-bold block uppercase">Konseling & Mediasi</span>
                <span className="text-base font-black text-amber-700">
                  {filteredHistoryEntries.filter(e => e.activityType.includes('Konseling') || e.activityType.includes('Mediasi')).length} Sesi
                </span>
              </div>
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                <span className="text-gray-500 text-[10px] font-bold block uppercase">Jurnal Manual Guru</span>
                <span className="text-base font-black text-purple-700">
                  {filteredHistoryEntries.filter(e => !e.isAuto).length} Catatan
                </span>
              </div>
            </div>
          </div>

          {/* Entries Cards List */}
          {filteredHistoryEntries.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 space-y-3">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto" />
              <h4 className="text-base font-bold text-gray-700">Tidak Ada Riwayat Jurnal Ditemukan</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Coba ubah kata kunci pencarian atau filter kategori/bulan di atas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistoryEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-xs hover:border-[#00685f]/50 transition-all space-y-3 relative group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 bg-[#00685f] text-white rounded-lg text-[11px] font-black tracking-wide flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatIndonesianDate(entry.date)}</span>
                      </span>

                      <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-[11px] font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span>{entry.time}</span>
                      </span>

                      <span className="px-2.5 py-1 bg-teal-50 text-[#00685f] border border-teal-200 rounded-lg text-[11px] font-bold">
                        {entry.activityType}
                      </span>

                      {entry.isAuto && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-extrabold uppercase">
                          Rekam Otomatis
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        onClick={() => setSelectedJournalDetail(entry)}
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Lihat Detail Lengkap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detail</span>
                      </button>

                      {!entry.isAuto && entry.rawEntry && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedDate(entry.date);
                              setEditingEntry(entry.rawEntry);
                              setViewMode('daily');
                            }}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Ubah Jurnal Ini"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Ubah</span>
                          </button>

                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Hapus Catatan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Title & Target */}
                  <div>
                    <h4 className="text-base font-extrabold text-[#0b1c30] leading-snug">
                      {entry.title}
                    </h4>
                    <p className="text-xs font-bold text-[#00685f] mt-1 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>Sasaran / Peserta: {entry.target}</span>
                    </p>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                    {entry.description}
                  </p>

                  {/* Additional details */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-gray-500 font-medium">
                    {entry.absentStudents && (
                      <div className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        <strong>Ketidakhadiran:</strong> {entry.absentStudents}
                      </div>
                    )}

                    {entry.proofPhotoUrl && (
                      <div className="flex items-center gap-2">
                        <img
                          src={entry.proofPhotoUrl}
                          alt="Bukti Foto"
                          className="w-10 h-10 object-cover rounded-lg border border-gray-300"
                        />
                        <span className="text-[10px] text-gray-500 font-semibold">{entry.proofPhotoName || 'Lampiran Foto Kegiatan'}</span>
                      </div>
                    )}

                    <span className="ml-auto px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded text-[10px] uppercase">
                      Status: {entry.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Journal Detail Modal */}
          {selectedJournalDetail && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2 text-[#00685f]">
                    <ClipboardList className="w-5 h-5" />
                    <h3 className="text-base font-extrabold text-[#0b1c30]">
                      Detail Jurnal BK ({formatIndonesianDate(selectedJournalDetail.date)})
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedJournalDetail(null)}
                    className="text-gray-400 hover:text-gray-600 font-black text-sm"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[10px]">Waktu Pelaksanaan:</span>
                      <p className="font-extrabold text-gray-800 text-sm mt-0.5">{selectedJournalDetail.time}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[10px]">Jenis Kegiatan:</span>
                      <p className="font-extrabold text-[#00685f] text-sm mt-0.5">{selectedJournalDetail.activityType}</p>
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[10px]">Topik / Judul Kegiatan:</span>
                    <h4 className="text-base font-black text-[#0b1c30] mt-0.5">{selectedJournalDetail.title}</h4>
                  </div>

                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[10px]">Sasaran / Peserta Didik:</span>
                    <p className="font-bold text-gray-800 bg-teal-50/60 p-2.5 rounded-xl border border-teal-100 mt-1">
                      {selectedJournalDetail.target}
                    </p>
                  </div>

                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[10px]">Uraian Pelaksanaan & Evaluasi:</span>
                    <p className="text-gray-700 leading-relaxed bg-gray-50 p-3.5 rounded-xl border border-gray-200 whitespace-pre-line mt-1">
                      {selectedJournalDetail.description}
                    </p>
                  </div>

                  {selectedJournalDetail.absentStudents && (
                    <div>
                      <span className="text-amber-800 font-bold uppercase text-[10px]">Catatan Ketidakhadiran Siswa:</span>
                      <p className="text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-200 mt-1 font-semibold">
                        {selectedJournalDetail.absentStudents}
                      </p>
                    </div>
                  )}

                  {selectedJournalDetail.proofPhotoUrl && (
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[10px] block mb-1">Lampiran Foto Dokumentasi:</span>
                      <img
                        src={selectedJournalDetail.proofPhotoUrl}
                        alt="Foto Dokumentasi"
                        className="w-full max-h-64 object-cover rounded-2xl border border-gray-200"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => setSelectedJournalDetail(null)}
                    className="px-5 py-2 bg-[#00685f] text-white rounded-xl text-xs font-bold hover:bg-[#005049]"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* DAILY MODE VIEW (Current View) */
        <>
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
          
          {/* Batch Import Today's Activities Banner */}
          {mappedAutoActivities.length > 0 && (
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-[#00685f] text-white rounded-xl shrink-0">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-xs font-black text-[#0b1c30]">
                    Terdeteksi {mappedAutoActivities.length} Rekam Sesi Layanan & Pembinaan Hari Ini
                  </h4>
                  <p className="text-[11px] text-gray-600 font-semibold mt-0.5">
                    Impor otomatis seluruh sesi konseling dan pembinaan karakter menjadi catatan jurnal permanen.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleImportAllTodayAutoToManual}
                className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer flex items-center justify-center gap-1.5 active:scale-97"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Impor Semua (1-Klik)</span>
              </button>
            </div>
          )}

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

              {/* Automatic Schedule Reminder & Sync Panel */}
              {daySchedules.length > 0 && (
                <div className="bg-emerald-50/90 border border-emerald-200/90 p-3.5 rounded-2xl space-y-2 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                      </span>
                      <span className="text-xs font-extrabold text-[#00685f] flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#00685f]" />
                        <span>Pengingat Jadwal Mapel Hari {selectedDayName} ({daySchedules.length} Sesi Terjadwal):</span>
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200/80 w-fit shadow-2xs">
                      ⚡ Klik Sesi untuk Sinkron Jam & Kelas Otomatis
                    </span>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {daySchedules.map((sch: any, sIdx: number) => (
                      <button
                        key={sch.id || sIdx}
                        type="button"
                        onClick={() => handleApplyScheduleItem(sch)}
                        className="px-3 py-2 bg-white hover:bg-emerald-100/80 border border-emerald-300/80 text-[#0b1c30] rounded-xl text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer flex items-center gap-2.5 group active:scale-97"
                        title="Klik untuk mengisi jam, kelas & materi jadwal ini ke form jurnal"
                      >
                        <div className="p-1.5 bg-[#00685f]/10 rounded-lg text-[#00685f] group-hover:bg-[#00685f] group-hover:text-white transition-colors">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-[#00685f]">{sch.className}</span>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              {sch.period || 'Jam KBM'} ({sch.timeRange || '07:30 - 08:50'})
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-600 font-medium truncate max-w-[200px]">
                            {sch.subject || 'Bimbingan Klasikal'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Express RPL & Journal Presets Bar */}
              <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-200/80 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0b1c30]">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                    <span>Template Jurnal Instan (Guru Mapel & Guru BK):</span>
                  </div>

                  {/* Category Filter Tabs */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPresetCategoryFilter('semua')}
                      className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                        presetCategoryFilter === 'semua' ? 'bg-[#00685f] text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetCategoryFilter('mapel')}
                      className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                        presetCategoryFilter === 'mapel' ? 'bg-[#00685f] text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      📚 Guru Mapel
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetCategoryFilter('bk')}
                      className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                        presetCategoryFilter === 'bk' ? 'bg-[#00685f] text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      🧘 Guru BK
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetCategoryFilter('wali')}
                      className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                        presetCategoryFilter === 'wali' ? 'bg-[#00685f] text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      🏫 Wali Kelas
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {quickJournalPresets
                    .filter(preset => presetCategoryFilter === 'semua' || preset.category === presetCategoryFilter)
                    .map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className="px-3 py-1.5 bg-white hover:bg-teal-50 border border-gray-200 hover:border-teal-300 text-gray-700 hover:text-[#00685f] rounded-xl text-[11px] font-bold transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-1 active:scale-97"
                      >
                        <span>{preset.label}</span>
                      </button>
                    ))}
                </div>
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
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Jenis Kegiatan Jurnal</label>
                    <select
                      value={activityType}
                      onChange={(e) => setActivityType(e.target.value as BKJournalEntry['activityType'])}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] font-semibold text-gray-700"
                    >
                      <option value="Kegiatan Mengajar Mata Pelajaran">📚 Kegiatan Mengajar Mata Pelajaran (KBM)</option>
                      <option value="Bimbingan Klasikal">🏫 Bimbingan Klasikal BK (Kelas)</option>
                      <option value="Konsultasi Orang Tua">📞 Konsultasi Wali Murid / Orang Tua</option>
                      <option value="Rapat Koordinasi">🤝 Rapat Koordinasi / Wali Kelas / Guru</option>
                      <option value="Administrasi BK">📋 Administrasi BK / Modul Ajar</option>
                      <option value="Kasus Mendesak">🚨 Penanganan Kasus Mendesak / Konseling</option>
                      <option value="Lain-lain">🎒 Lain-lain / Kegiatan P5 & Ekstrakurikuler</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Sasaran / Peserta (Wajib)</label>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            setTarget(`Siswa ${e.target.value}`);
                          }
                        }}
                        className="text-[10px] bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-md px-1.5 py-0.5 font-extrabold cursor-pointer transition-colors"
                      >
                        <option value="">-- Pilih Kelas Cepat --</option>
                        {classList.map(cls => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      required
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="Contoh: Siswa Kelas VIII-C / Peserta Mapel IPA / Wali Murid"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] font-semibold"
                    />

                    {/* 💡 Smart Reminder: Pertemuan Terakhir Kelas */}
                    {classProgressInfo && (
                      <div className="p-3 bg-amber-50/90 border border-amber-200/80 rounded-xl space-y-1.5 text-xs mt-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-amber-900 flex items-center gap-1">
                            📌 Progress Pertemuan Terakhir ({classProgressInfo.lastDate}):
                          </span>
                          <span className="text-[10px] bg-amber-200/80 text-amber-900 font-extrabold px-2 py-0.5 rounded-md">
                            {classProgressInfo.className}
                          </span>
                        </div>
                        <p className="text-amber-950 font-medium leading-relaxed">
                          {classProgressInfo.lastTopic}
                        </p>
                        {classProgressInfo.nextTopicPlan && (
                          <p className="text-[11px] text-emerald-800 font-semibold pt-0.5">
                            💡 Rencana Pertemuan Berikutnya: {classProgressInfo.nextTopicPlan}
                          </p>
                        )}
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setTitle(`Bimbingan Klasikal - ${classProgressInfo.className}`);
                              setDescription(
                                `Melanjutkan pembelajaran Bimbingan Klasikal.\nTopik Terakhir: ${classProgressInfo.lastTopic}${
                                  classProgressInfo.nextTopicPlan ? `\nRencana Materi: ${classProgressInfo.nextTopicPlan}` : ''
                                }`
                              );
                            }}
                            className="text-[11px] font-bold text-[#00685f] hover:text-[#005049] bg-white border border-[#00685f]/30 px-2.5 py-1 rounded-lg hover:bg-emerald-50 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#00685f]" />
                            Gunakan Topik & Rencana Ini ke Form
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Nama Kegiatan / Topik Pembelajaran (Wajib)</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: KBM Bab 2 Fotosintesis, Praktikum Kimia, atau Bimbingan Motivasional"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] font-bold text-[#0b1c30]"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Rincian Deskripsi Kegiatan & Hasil (Wajib)</label>
                    <button
                      type="button"
                      disabled={isGeneratingNarasi}
                      onClick={handleSmartGenerateNarasi}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-800 border border-amber-300 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                      title="Otomatis susun narasi jurnal harian profesional berdasarkan topik dan jenis kegiatan"
                    >
                      <Sparkles className={`w-3 h-3 text-amber-600 ${isGeneratingNarasi ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingNarasi ? 'Menyusun Narasi...' : 'Auto-Generate Narasi (AI)'}</span>
                    </button>
                  </div>
                  <textarea
                    required
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tulis alur pelaksanaan kegiatan, metode/instrumen yang digunakan, keterlibatan siswa, serta hasil atau rencana tindak lanjut."
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

                {/* Progressive Disclosure: Opsi Tambahan (Presensi & Bukti Foto) */}
                <div className="border border-gray-200/70 rounded-xl overflow-hidden bg-gray-50/50 transition-all">
                  <button
                    type="button"
                    onClick={() => setShowOptionalFields(!showOptionalFields)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-[#00685f]" />
                      <span className="text-xs font-bold text-[#0b1c30]">
                        Opsi Tambahan: Siswa Tidak Hadir & Foto Bukti
                      </span>
                      {(absentStudents || proofPhotoUrl) && (
                        <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-[#00685f]/15 text-[#00685f]">
                          Terisi
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                        showOptionalFields ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {showOptionalFields && (
                    <div className="p-4 pt-1 space-y-4 border-t border-gray-200/50 bg-white animate-in fade-in duration-200">
                      {/* Siswa Tidak Hadir (Optional) */}
                      <div className="space-y-1.5 pt-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                            Siswa Tidak Berangkat / Hadir (Opsional)
                          </label>
                          <button
                            type="button"
                            onClick={() => handleAutoLoadAbsensi()}
                            className="text-[10px] bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg px-2.5 py-1 font-extrabold flex items-center gap-1 cursor-pointer transition-colors w-fit"
                            title="Ambil data siswa tidak berangkat dari absensi kelas ini pada tanggal jurnal"
                          >
                            <RefreshCw className="w-3 h-3 text-teal-700" />
                            <span>Ambil Otomatis dari Absensi</span>
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={absentStudents}
                          onChange={(e) => setAbsentStudents(e.target.value)}
                          placeholder="Contoh: Rudi (Alpa), Siska (Sakit), Susi (Izin) atau klik tombol di atas untuk memuat otomatis dari absensi kelas."
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] leading-relaxed font-semibold text-gray-600"
                        />
                      </div>

                      {/* Foto Bukti Layanan / Jurnal (Kamera HP / Upload File) */}
                      <div className="space-y-2 border-t border-gray-100 pt-3">
                        <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-[#00685f]" />
                          <span>Lampirkan Foto Bukti Kegiatan (Opsional)</span>
                        </label>
                        <p className="text-[11px] text-gray-500 leading-normal font-semibold">
                          Ambil foto langsung sebagai bukti valid menggunakan kamera HP/laptop Anda atau unggah file foto dari penyimpanan.
                        </p>

                        {proofPhotoUrl ? (
                          <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 p-3 max-w-sm text-center">
                            <img
                              src={proofPhotoUrl}
                              alt="Bukti Foto Jurnal"
                              className="max-h-48 mx-auto object-contain rounded-lg"
                              referrerPolicy="no-referrer"
                            />
                            <p className="text-[10px] text-gray-500 truncate mt-2 font-bold">
                              {proofPhotoName}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setProofPhotoUrl(undefined);
                                setProofPhotoName(undefined);
                              }}
                              className="absolute top-2.5 right-2.5 bg-red-600 text-white hover:bg-red-700 p-1.5 rounded-full shadow-md cursor-pointer transition-colors"
                              title="Hapus Foto"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="max-w-md">
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
                                      className="w-full h-56 object-cover"
                                    />
                                    <div className="absolute bottom-3 inset-x-0 flex justify-center gap-2 px-4">
                                      <button
                                        type="button"
                                        onClick={capturePhoto}
                                        className="bg-[#00685f] hover:bg-[#005049] text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                                      >
                                        <Camera className="w-4 h-4" /> Ambil Foto
                                      </button>
                                      <button
                                        type="button"
                                        onClick={stopCamera}
                                        className="bg-gray-800/80 hover:bg-gray-900 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-md cursor-pointer"
                                      >
                                        Batal
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-3">
                                <button
                                  type="button"
                                  onClick={startCamera}
                                  className="flex flex-col items-center justify-center p-4 border border-dashed border-[#bcc9c6]/60 bg-gray-50 rounded-xl hover:bg-gray-100/50 hover:border-[#00685f]/80 transition-all cursor-pointer text-center"
                                >
                                  <Camera className="w-5 h-5 text-[#00685f] mb-1" />
                                  <span className="text-[11px] font-bold text-[#0b1c30]">Gunakan Kamera</span>
                                </button>

                                <label className="flex flex-col items-center justify-center p-4 border border-dashed border-[#bcc9c6]/60 bg-gray-50 rounded-xl hover:bg-gray-100/50 hover:border-[#00685f]/80 transition-all cursor-pointer text-center">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleProofFileChange}
                                    className="sr-only"
                                  />
                                  <ImageIcon className="w-5 h-5 text-[#6b38d4] mb-1" />
                                  <span className="text-[11px] font-bold text-[#0b1c30]">Unggah Foto</span>
                                </label>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
                  else if (entry.activityType === 'Kegiatan Mengajar Mata Pelajaran') categoryColor = 'bg-indigo-50 text-indigo-700';
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

                        {/* Siswa Tidak Hadir */}
                        {entry.absentStudents && (
                          <div className="mt-2.5 bg-rose-50 border border-rose-100 p-3 rounded-xl">
                            <span className="text-[10px] font-extrabold text-rose-800 uppercase tracking-wider block mb-1">
                              Siswa Tidak Berangkat / Hadir:
                            </span>
                            <span className="text-xs text-rose-950 font-bold leading-normal whitespace-pre-wrap">
                              {entry.absentStudents}
                            </span>
                          </div>
                        )}

                        {/* Proof Photo thumbnail */}
                        {entry.proofPhotoUrl && (
                          <div className="mt-3 p-2 bg-gray-50 border border-gray-100 rounded-xl max-w-xs">
                            <p className="text-[9px] text-[#00685f] font-bold mb-1 uppercase tracking-wider flex items-center gap-1">
                              <Camera className="w-3 h-3" />
                              <span>Foto Bukti Valid</span>
                            </p>
                            <img
                              src={entry.proofPhotoUrl}
                              alt="Bukti Jurnal"
                              className="rounded-lg max-h-32 object-cover border border-gray-200"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
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

          {/* DYNAMIC SMART DAILY JOURNAL ANALYZER (Attractive, professional & stable) */}
          <div className="bg-gradient-to-br from-[#6b38d4]/10 via-white to-[#00685f]/5 rounded-2xl p-5 border border-[#6b38d4]/20 shadow-xs space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-extrabold text-[#0b1c30] text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4.5 h-4.5 text-[#6b38d4]" />
                  <span>Analisis Solusi Strategis Hari Ini</span>
                </h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                  Evaluasi otomatis kasus-kasus hari ini dan rekomendasi tindak lanjut bagi Guru BK.
                </p>
              </div>
            </div>

            {isAnalyzing ? (
              <div className="py-6 text-center space-y-2">
                <RefreshCw className="w-6 h-6 text-[#6b38d4] animate-spin mx-auto" />
                <p className="text-[10px] font-extrabold text-[#6b38d4] animate-pulse">
                  Menganalisis seluruh catatan manual & log otomatis hari ini...
                </p>
              </div>
            ) : analysisResult ? (
              <div className="space-y-3.5">
                {typeof analysisResult === 'string' ? (
                  <div className="text-xs text-gray-700 font-semibold leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar select-text pr-1.5">
                    {analysisResult}
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-72 overflow-y-auto custom-scrollbar pr-1.5">
                    {analysisResult.summary && (
                      <div className="bg-[#eff4ff]/70 border border-blue-100 p-3 rounded-xl">
                        <h4 className="text-[10px] font-black uppercase text-[#00685f] tracking-wider mb-1">
                          Ringkasan Dinamika Hari Ini
                        </h4>
                        <p className="text-xs font-bold text-[#0b1c30] leading-relaxed">
                          {analysisResult.summary}
                        </p>
                      </div>
                    )}

                    {analysisResult.highlights && analysisResult.highlights.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                          Poin Kunci & Capaian
                        </h4>
                        <ul className="space-y-1 text-[11px] font-semibold text-gray-700 list-disc pl-4 leading-normal">
                          {analysisResult.highlights.map((h: string, i: number) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysisResult.suggestions && analysisResult.suggestions.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-[10px] font-black uppercase text-[#6b38d4] tracking-wider">
                          Rekomendasi Tindak Lanjut Prioritas
                        </h4>
                        <ul className="space-y-1 text-[11px] font-semibold text-[#0b1c30] list-disc pl-4 leading-normal">
                          {analysisResult.suggestions.map((s: string, i: number) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysisResult.teacherWellbeing && (
                      <div className="p-3 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-100/60">
                        <h4 className="text-[9px] font-black uppercase text-teal-800 tracking-widest mb-1">
                          Well-being Support Guru ❤️
                        </h4>
                        <p className="text-[11px] font-bold text-teal-900 leading-normal italic">
                          {analysisResult.teacherWellbeing}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[9px] text-[#6b38d4] font-bold">
                  <span>Hasil Analisis Gemini AI Terkini</span>
                  <button
                    onClick={handleAnalyzeDay}
                    className="hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Segarkan
                  </button>
                </div>
              </div>
            ) : offlineAnalysisObj ? (
              <div className="space-y-3.5">
                <div className="bg-[#eff4ff]/60 border border-blue-100 p-3 rounded-xl">
                  <h4 className="text-[10px] font-black uppercase text-[#00685f] tracking-wider mb-1.5">
                    Tren Utama Kasus Hari Ini
                  </h4>
                  <p className="text-[11px] font-bold text-[#0b1c30] leading-relaxed">
                    {offlineAnalysisObj.tren}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                    Rencana Intervensi Prioritas Besok
                  </h4>
                  <ul className="space-y-1.5 text-[11px] font-semibold text-gray-700 list-disc pl-4 leading-normal">
                    {offlineAnalysisObj.rekomendasi.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-100/50">
                  <h4 className="text-[9px] font-black uppercase text-teal-800 tracking-widest mb-1">
                    Well-being Support Guru BK ❤️
                  </h4>
                  <p className="text-[11px] font-bold text-teal-900 leading-normal italic">
                    {offlineAnalysisObj.wellbeing}
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-[9px] text-gray-400 font-bold">
                  <span>Selesai dianalisis secara offline</span>
                  <button
                    onClick={handleAnalyzeDay}
                    className="hover:underline text-[#00685f] flex items-center gap-0.5 cursor-pointer"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Ulangi Analisis
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 border border-dashed border-gray-200 text-center space-y-2">
                <p className="text-[10px] text-gray-500 font-bold">
                  Butuh asisten cepat merangkum agenda dan strategi tindak lanjut hari ini?
                </p>
                <button
                  type="button"
                  onClick={handleAnalyzeDay}
                  className="mx-auto flex items-center gap-1.5 px-4 py-2 bg-[#6b38d4] hover:bg-[#6b38d4]/90 text-white rounded-xl text-xs font-black tracking-wider shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analisis Jurnal Hari Ini</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#bcc9c6]/30 shadow-xs space-y-4">
            <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-[#0b1c30] text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4.5 h-4.5 text-[#00685f]" />
                  <span>Sesi Otomatis Hari Ini</span>
                </h3>
                <p className="text-[10px] text-[#3d4947]/70 font-semibold mt-0.5">
                  Layanan & pembinaan perilaku yang diinput pada tab lain di tanggal ini.
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
                  Silakan tambahkan layanan konseling, bimbingan kelompok, atau catatan pembinaan perilaku murid untuk memunculkan aktivitas otomatis.
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
    </>
  )}

</div>
  );
}
