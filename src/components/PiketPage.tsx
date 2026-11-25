import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { PRESET_KURIKULUM_MERDEKA_PPKSP, ViolationCategory } from '../utils/violationRulesConfig';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  MapPin,
  Plus,
  Search,
  Send,
  ShieldAlert,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { showToast } from '../utils/toast';

interface PiketTeacherOption {
  id: string;
  name: string;
  role?: string;
}

const GUEST_USES_STORAGE_KEY = 'piket_guest_teacher_uses_v1';

function readGuestTeacherUses(): Record<string, { name: string; count: number }> {
  try {
    const raw = localStorage.getItem(GUEST_USES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function recordGuestTeacherUse(name: string): { name: string; count: number } {
  const clean = name.trim();
  const key = clean.toLowerCase();
  const map = readGuestTeacherUses();
  const prev = map[key];
  const next = {
    name: prev?.name || clean,
    count: (prev?.count || 0) + 1,
  };
  map[key] = next;
  try {
    localStorage.setItem(GUEST_USES_STORAGE_KEY, JSON.stringify(map));
  } catch {}
  return next;
}

interface PiketStudentSearchItem {
  id: string;
  name: string;
  className: string;
  nisSearch: string;
  avatarUrl?: string;
  initials: string;
  schoolId: string;
  schoolName: string;
  isManual?: boolean;
}

const CLASS_OPTIONS = [
  '7A', '7B', '7C', '7D', '7E', '7F', '7G',
  '8A', '8B', '8C', '8D', '8E', '8F', '8G',
  '9A', '9B', '9C', '9D', '9E', '9F', '9G',
] as const;

const LOCATION_OPTIONS = [
  'Kelas',
  'Kantin',
  'Lapangan',
  'Koridor',
  'Gerbang',
  'Lainnya',
] as const;

const CATEGORY_SHORT_LABEL_MAP: Record<string, string> = {
  ppksp_perundungan: 'Perundungan',
  ppksp_fisik: 'Kekerasan Fisik',
  ppksp_seksual: 'Kekerasan Seksual',
  ppksp_diskriminasi: 'Diskriminasi',
  disiplin_positif_kelas: 'Kedisiplinan',
  integritas_karakter: 'Integritas Akademik',
};

const CATEGORY_STYLE_MAP: Record<string, { border: string; activeBg: string; badge: string }> = {
  ppksp_perundungan: {
    border: 'border-rose-200 hover:border-rose-400',
    activeBg: 'bg-rose-600 text-white border-rose-600 shadow-xs',
    badge: 'bg-rose-50 text-rose-700',
  },
  ppksp_fisik: {
    border: 'border-red-200 hover:border-red-400',
    activeBg: 'bg-red-600 text-white border-red-600 shadow-xs',
    badge: 'bg-red-50 text-red-700',
  },
  ppksp_seksual: {
    border: 'border-purple-200 hover:border-purple-400',
    activeBg: 'bg-purple-700 text-white border-purple-700 shadow-xs',
    badge: 'bg-purple-50 text-purple-700',
  },
  ppksp_diskriminasi: {
    border: 'border-amber-200 hover:border-amber-400',
    activeBg: 'bg-amber-600 text-white border-amber-600 shadow-xs',
    badge: 'bg-amber-50 text-amber-800',
  },
  disiplin_positif_kelas: {
    border: 'border-emerald-200 hover:border-emerald-400',
    activeBg: 'bg-[#00685f] text-white border-[#00685f] shadow-xs',
    badge: 'bg-[#e6f4f1] text-[#00685f]',
  },
  integritas_karakter: {
    border: 'border-sky-200 hover:border-sky-400',
    activeBg: 'bg-sky-600 text-white border-sky-600 shadow-xs',
    badge: 'bg-sky-50 text-sky-700',
  },
};

function getInitials(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'S';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getCurrentTimeHHMM(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getTodayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatIndonesianFullDate(date: Date = new Date()): string {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file foto'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format foto tidak valid'));
      img.onload = () => {
        const maxDim = 900;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.72);
        resolve(compressed);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export default function PiketPage() {
  // Daftar guru piket dari koleksi `teachers` (tanpa auth)
  const [teachers, setTeachers] = useState<PiketTeacherOption[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(true);
  const [teachersError, setTeachersError] = useState<string | null>(null);
  const [teachersRetryKey, setTeachersRetryKey] = useState(0);
  const [selectedTeacherName, setSelectedTeacherName] = useState('');
  const [teacherDropdownOpen, setTeacherDropdownOpen] = useState(false);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [useCustomTeacher, setUseCustomTeacher] = useState(false);
  const [customTeacherName, setCustomTeacherName] = useState('');
  const [guestUsesVersion, setGuestUsesVersion] = useState(0);

  // Direktori pencarian siswa (disimpan di memori hanya untuk pencarian >= 2 karakter, tidak pernah ditampilkan utuh)
  const [searchableStudents, setSearchableStudents] = useState<PiketStudentSearchItem[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState(false);
  const [studentsRetryKey, setStudentsRetryKey] = useState(0);
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<PiketStudentSearchItem[]>([]);
  const [showManualStudentForm, setShowManualStudentForm] = useState(false);
  const [manualStudentName, setManualStudentName] = useState('');
  const [manualStudentClass, setManualStudentClass] = useState<string>('7A');

  // Form 2 Tingkat (6 Kategori PPKSP & Perilaku Spesifik)
  const categories: ViolationCategory[] = PRESET_KURIKULUM_MERDEKA_PPKSP;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedBehaviors, setSelectedBehaviors] = useState<string[]>([]);
  const [urgentSexualConfirmed, setUrgentSexualConfirmed] = useState(false);

  // Lokasi, waktu otomatis, catatan, foto (tertutup default)
  const [locationChoice, setLocationChoice] = useState<string>('Kelas');
  const [customLocation, setCustomLocation] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>(() => getCurrentTimeHHMM());
  const [notes, setNotes] = useState('');
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [photoName, setPhotoName] = useState<string>('');
  const [photoCompressing, setPhotoCompressing] = useState(false);

  // Status submit & sukses
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedSummary, setSubmittedSummary] = useState<{
    reporterName: string;
    studentNames: string[];
    categoryLabel: string;
  } | null>(null);

  const todayDisplay = useMemo(() => formatIndonesianFullDate(new Date()), []);

  // Update waktu otomatis setiap 30 detik agar selalu jam sekarang
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentTimeHHMM());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Ambil daftar guru piket secara real-time dari Firestore koleksi `teachers` (batas waktu 5 detik)
  useEffect(() => {
    let active = true;
    let settled = false;
    setTeachersLoading(true);
    setTeachersError(null);

    const timeoutId = setTimeout(() => {
      if (!active || settled) return;
      settled = true;
      setTeachersLoading(false);
      setTeachersError('Gagal memuat daftar guru. Cek koneksi / Firestore Rules.');
    }, 5000);

    const teachersCol = collection(db, 'teachers');
    const parseTeachersSnapshot = (snapshot: any) => {
      const list: PiketTeacherOption[] = [];
      const seen = new Set<string>();
      snapshot.forEach((d: any) => {
        const data = d.data() as any;
        if (!data || data.isDeleted === true || data.isActive === false) return;
        const rawName = String(
          data.name || data.nama || data.fullName || data.displayName || ''
        ).trim();
        if (!rawName) return;
        const key = rawName.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        list.push({
          id: d.id,
          name: rawName,
          role: String(data.subject || data.mapel || data.role || data.jabatan || data.posisi || '').trim() || undefined,
        });
      });
      list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      return list;
    };

    const unsub = onSnapshot(
      teachersCol,
      (snapshot) => {
        if (!active) return;
        const list = parseTeachersSnapshot(snapshot);
        // Abaikan snapshot cache kosong kalau server belum merespon; kalau ada isi atau metadata !fromCache langsung selesai
        if (list.length > 0 || !snapshot.metadata?.fromCache) {
          settled = true;
          clearTimeout(timeoutId);
          setTeachers(list);
          setTeachersLoading(false);
          setTeachersError(
            list.length === 0 && !snapshot.metadata?.fromCache
              ? null
              : null
          );
        }
      },
      (err) => {
        if (!active) return;
        settled = true;
        clearTimeout(timeoutId);
        console.warn('[PiketPage] Gagal memuat koleksi teachers:', err?.message || err);
        setTeachersLoading(false);
        setTeachersError('Gagal memuat daftar guru. Cek koneksi / Firestore Rules.');
      }
    );

    // Fallback getDocs paralel agar cepat muncul jika snapshot tertahan
    getDocs(teachersCol)
      .then((snap) => {
        if (!active) return;
        const list = parseTeachersSnapshot(snap);
        if (list.length > 0 || !settled) {
          settled = true;
          clearTimeout(timeoutId);
          setTeachers(list);
          setTeachersLoading(false);
          setTeachersError(null);
        }
      })
      .catch((err) => {
        if (!active || settled) return;
        settled = true;
        clearTimeout(timeoutId);
        console.warn('[PiketPage] getDocs teachers error:', err?.message || err);
        setTeachersLoading(false);
        setTeachersError('Gagal memuat daftar guru. Cek koneksi / Firestore Rules.');
      });

    return () => {
      active = false;
      clearTimeout(timeoutId);
      unsub();
    };
  }, [teachersRetryKey]);

  // Muat indeks pencarian minimal dari `students` (hanya id, name, class, avatarUrl, initials; batas waktu 5 detik)
  useEffect(() => {
    let active = true;
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (!active || settled) return;
      settled = true;
      setStudentsLoading(false);
      setStudentsError(true);
    }, 5000);

    const loadSearchDirectory = async () => {
      setStudentsLoading(true);
      setStudentsError(false);
      try {
        const map = new Map<string, PiketStudentSearchItem>();
        const ingestSnapshot = (snap: any) => {
          snap.forEach((d: any) => {
            const data = d.data() as any;
            if (!data || data.isDeleted === true) return;
            const rawName = String(data.name || data.nama || '').trim();
            if (!rawName) return;
            const lowName = rawName.toLowerCase();
            if (lowName.startsWith('siswa demo') || lowName.startsWith('dummy ')) return;
            const className = String(data.class || data.kelas || '-').trim();
            const nisSearch = String(data.nis || data.nisn || '').trim();
            const avatarUrl =
              typeof data.avatarUrl === 'string' && data.avatarUrl.trim()
                ? data.avatarUrl.trim()
                : undefined;
            const schoolId = String(data.schoolId || 'sch_20320123').trim() || 'sch_20320123';
            const schoolName = String(data.schoolName || 'SMP N 2 Susukan').trim() || 'SMP N 2 Susukan';
            map.set(d.id, {
              id: d.id,
              name: rawName,
              className,
              nisSearch,
              avatarUrl,
              initials: String(data.initials || getInitials(rawName)).slice(0, 3),
              schoolId,
              schoolName,
            });
          });
        };

        const rootSnap = await getDocs(collection(db, 'students'));
        ingestSnapshot(rootSnap);

        if (active) {
          settled = true;
          clearTimeout(timeoutId);
          setSearchableStudents(
            Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'))
          );
          setStudentsLoading(false);
          setStudentsError(false);
        }
      } catch (err: any) {
        console.warn('[PiketPage] Pencarian siswa cloud belum termuat:', err?.message || err);
        if (active) {
          settled = true;
          clearTimeout(timeoutId);
          setStudentsLoading(false);
          setStudentsError(true);
        }
      }
    };

    void loadSearchDirectory();
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [studentsRetryKey]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

  const isSexualCategory = selectedCategory?.id === 'ppksp_seksual';

  const activeReporterName = useMemo(() => {
    if (useCustomTeacher) return customTeacherName.trim();
    return selectedTeacherName.trim();
  }, [useCustomTeacher, customTeacherName, selectedTeacherName]);

  // Gabungkan daftar guru aktif A-Z + guru tamu yang sudah dipakai >= 3x
  const dropdownTeachers = useMemo(() => {
    const merged = [...teachers];
    const seen = new Set(teachers.map((t) => t.name.trim().toLowerCase()));
    const guestUses = readGuestTeacherUses();
    Object.entries(guestUses).forEach(([key, entry]) => {
      if (entry && entry.count >= 3 && entry.name && !seen.has(key)) {
        seen.add(key);
        merged.push({
          id: `guest_${key}`,
          name: entry.name,
          role: 'Guru Tamu',
        });
      }
    });
    return merged.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [teachers, guestUsesVersion]);

  const filteredDropdownTeachers = useMemo(() => {
    const q = teacherSearchQuery.trim().toLowerCase();
    if (!q) return dropdownTeachers;
    return dropdownTeachers.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.role || '').toLowerCase().includes(q)
    );
  }, [dropdownTeachers, teacherSearchQuery]);

  // Hasil pencarian siswa: HANYA tampil jika query >= 2 karakter, maksimal 10 hasil
  const filteredStudentResults = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const selectedIds = new Set(selectedStudents.map((s) => s.id));
    return searchableStudents
      .filter((s) => {
        if (selectedIds.has(s.id)) return false;
        return (
          s.name.toLowerCase().includes(q) ||
          s.nisSearch.toLowerCase().includes(q)
        );
      })
      .slice(0, 10);
  }, [studentQuery, searchableStudents, selectedStudents]);

  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    setSelectedBehaviors([]);
    setUrgentSexualConfirmed(false);
    setSubmitError(null);
  };

  const handleToggleBehavior = (label: string) => {
    setSelectedBehaviors((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
    setSubmitError(null);
  };

  const handleAddStudent = (student: PiketStudentSearchItem) => {
    setSelectedStudents((prev) =>
      prev.some((s) => s.id === student.id) ? prev : [...prev, student]
    );
    setStudentQuery('');
    setSubmitError(null);
  };

  const handleRemoveStudent = (studentId: string) => {
    setSelectedStudents((prev) => prev.filter((s) => s.id !== studentId));
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Pilih file gambar (JPG/PNG).', 'error');
      return;
    }
    setPhotoCompressing(true);
    try {
      const compressed = await compressImageToDataUrl(file);
      if (compressed.length > 480000) {
        showToast('Ukuran foto terlalu besar, silakan pilih foto yang lebih ringan.', 'error');
        return;
      }
      setPhotoDataUrl(compressed);
      setPhotoName(file.name.slice(0, 120));
    } catch (err: any) {
      showToast(err?.message || 'Gagal memproses foto.', 'error');
    } finally {
      setPhotoCompressing(false);
    }
  };

  const submitReport = async (forceUrgentSexual: boolean = false) => {
    setSubmitError(null);

    if (!activeReporterName) {
      setSubmitError('Pilih nama Guru Piket yang bertugas terlebih dahulu.');
      showToast('Pilih nama Guru Piket yang bertugas.', 'warning');
      return;
    }

    if (!selectedCategory) {
      setSubmitError('Pilih 1 kategori perilaku pada Tingkat 1.');
      showToast('Pilih kategori perilaku terlebih dahulu.', 'warning');
      return;
    }

    const behaviorsToSubmit = isSexualCategory
      ? ['Laporan Segera ke BK (PPKSP - Penanganan Khusus)']
      : selectedBehaviors;

    if (!isSexualCategory && behaviorsToSubmit.length === 0) {
      setSubmitError('Pilih minimal 1 perilaku spesifik pada Tingkat 2.');
      showToast('Pilih minimal 1 perilaku spesifik.', 'warning');
      return;
    }

    if (selectedStudents.length === 0) {
      setSubmitError('Cari dan pilih minimal 1 siswa yang perlu dibina.');
      showToast('Pilih minimal 1 siswa terlebih dahulu.', 'warning');
      return;
    }

    if (isSexualCategory && !forceUrgentSexual && !urgentSexualConfirmed) {
      setUrgentSexualConfirmed(true);
    }

    const finalLocation =
      locationChoice === 'Lainnya' && customLocation.trim()
        ? `Lainnya: ${customLocation.trim()}`
        : locationChoice;

    const reportDate = getTodayISODate();
    const reportTime = getCurrentTimeHHMM();
    setCurrentTime(reportTime);

    const categoryShort =
      CATEGORY_SHORT_LABEL_MAP[selectedCategory.id] || selectedCategory.name;

    // Hitung poin referensi tanpa membebani UI piket
    const pointsSum = isSexualCategory
      ? 100
      : behaviorsToSubmit.reduce((acc, label) => {
          const matched = selectedCategory.options.find((o) => o.label === label);
          return acc + (matched?.points || 10);
        }, 0);
    const boundedPoints = Math.min(Math.max(pointsSum, 0), 100);

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const trimmedNotes = notes.trim().slice(0, 1000);

    setIsSubmitting(true);
    try {
      await Promise.all(
        selectedStudents.map((stu, idx) => {
          const rand = Math.random().toString(36).slice(2, 7);
          const docId = `pkt_${nowMs}_${idx}_${rand}`;
          const ticketId = `PKT-${String(nowMs).slice(-6)}-${idx + 1}`;
          const payload: Record<string, any> = {
            id: docId,
            ticketId,
            studentId: stu.isManual ? 'manual' : stu.id,
            studentName: stu.name,
            studentClass: stu.className,
            category: categoryShort,
            specificBehaviors: behaviorsToSubmit,
            reportedBy: activeReporterName,
            date: reportDate,
            time: reportTime,
            location: finalLocation,
            notes: trimmedNotes,
            piketNotes: trimmedNotes,
            reportedVia: 'Link Piket',
            source: 'link_piket',
            reporterRole: 'Guru Piket',
            handledBy: 'Belum Ditangani',
            restitutionStatus: 'Baru Dicatat',
            pointsAdded: boundedPoints,
            schoolId: stu.schoolId || 'sch_20320123',
            schoolName: stu.schoolName || 'SMP N 2 Susukan',
            migratedAt: null,
            isDeleted: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          if (photoDataUrl) {
            payload.proofPhotoUrl = photoDataUrl;
            payload.proofPhotoName = photoName || 'foto-piket.jpg';
          }
          return setDoc(doc(db, 'violations', docId), payload);
        })
      );

      // Jika nama berasal dari guru tamu (+ Nama Lain) dan belum ada di daftar teachers, hitung pemakaian
      const existsInTeachers = teachers.some(
        (t) => t.name.trim().toLowerCase() === activeReporterName.toLowerCase()
      );
      if (!existsInTeachers) {
        const guestEntry = recordGuestTeacherUse(activeReporterName);
        setGuestUsesVersion((v) => v + 1);
        if (guestEntry.count >= 3 && auth.currentUser) {
          const guestDocId = `tch_guest_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
          setDoc(doc(db, 'teachers', guestDocId), {
            id: guestDocId,
            name: guestEntry.name,
            nip: '',
            subject: 'Guru Piket',
            phone: '',
            isActive: true,
            source: 'auto_guest_3x',
            createdAt: nowIso,
            schoolId: 'sch_20320123',
            isDeleted: false,
          }).catch(() => {});
        }
      }

      setSubmittedSummary({
        reporterName: activeReporterName,
        studentNames: selectedStudents.map((s) => `${s.name} (${s.className})`),
        categoryLabel: categoryShort,
      });
      showToast('Laporan berhasil diteruskan ke Guru BK.', 'success');
    } catch (err: any) {
      const msg = err?.message || String(err);
      setSubmitError(`Gagal mengirim laporan ke cloud: ${msg}`);
      showToast('Gagal mengirim laporan. Periksa koneksi internet.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUrgentSexualClick = () => {
    setUrgentSexualConfirmed(true);
    if (activeReporterName && selectedStudents.length > 0) {
      void submitReport(true);
    } else {
      setSubmitError(
        'Mode Laporan Segera aktif. Pastikan Guru Piket & Siswa sudah dipilih, lalu klik tombol kirim.'
      );
      showToast('Lengkapi nama Guru Piket & Siswa untuk mengirim laporan segera.', 'info');
    }
  };

  const handleCatatLagi = () => {
    setSubmittedSummary(null);
    setSelectedCategoryId('');
    setSelectedBehaviors([]);
    setUrgentSexualConfirmed(false);
    setSelectedStudents([]);
    setStudentQuery('');
    setLocationChoice('Kelas');
    setCustomLocation('');
    setNotes('');
    setPhotoDataUrl('');
    setPhotoName('');
    setIsPhotoOpen(false);
    setCurrentTime(getCurrentTimeHHMM());
    setSubmitError(null);
  };

  const handleCatatSiswaLain = () => {
    setSubmittedSummary(null);
    setSelectedStudents([]);
    setStudentQuery('');
    setCurrentTime(getCurrentTimeHHMM());
    setSubmitError(null);
  };

  return (
    <div className="min-h-screen bg-[#f8faf9] text-[#0b1c30] py-5 px-3.5 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header Publik Piket */}
        <header className="bg-white border border-[#bcc9c6]/50 rounded-2xl p-5 shadow-2xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/20 text-[11px] font-extrabold uppercase tracking-wider">
                Formulir Rujukan Piket
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#0b1c30] tracking-tight">
                Laporan Piket - SMP N 2 Susukan
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-[#3d4947]">
                {todayDisplay}
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/60 text-xs font-extrabold text-[#00685f]">
              <Clock className="w-3.5 h-3.5" />
              <span>{currentTime} WIB</span>
            </div>
          </div>
        </header>

        {/* Layar Sukses Setelah Kirim */}
        {submittedSummary ? (
          <section className="bg-white border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-black text-[#0b1c30]">
                Terima kasih {submittedSummary.reporterName}, laporan sudah diteruskan ke Guru BK.
              </h2>
              <p className="text-xs sm:text-sm text-[#3d4947]">
                Kategori: <span className="font-bold text-[#0b1c30]">{submittedSummary.categoryLabel}</span>
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                {submittedSummary.studentNames.map((nameLabel, i) => (
                  <span
                    key={`${nameLabel}-${i}`}
                    className="px-2.5 py-1 rounded-xl bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/20 text-xs font-bold"
                  >
                    {nameLabel}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleCatatLagi}
                className="w-full py-3.5 px-4 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white font-extrabold text-sm transition-all cursor-pointer"
              >
                Catat Lagi
              </button>
              <button
                type="button"
                onClick={handleCatatSiswaLain}
                className="w-full py-3.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-sm transition-all cursor-pointer"
              >
                Catat Siswa Lain
              </button>
            </div>
          </section>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitReport(false);
            }}
            className="space-y-4"
          >
            {/* 1. Bertugas: Pilih Nama Guru Piket dari koleksi `teachers` + [+ Nama Lain] */}
            <section className="bg-white border border-[#bcc9c6]/50 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-extrabold text-[#0b1c30] flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#00685f]" />
                  <span>Bertugas:</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setUseCustomTeacher((prev) => !prev);
                    setSubmitError(null);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold border border-[#00685f]/30 bg-[#e6f4f1] text-[#00685f] hover:bg-[#00685f] hover:text-white transition-colors cursor-pointer"
                >
                  {useCustomTeacher ? (
                    <span>Pilih dari Daftar Guru</span>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nama Lain</span>
                    </>
                  )}
                </button>
              </div>

              {!useCustomTeacher ? (
                <div className="space-y-2 relative">
                  <button
                    type="button"
                    onClick={() => setTeacherDropdownOpen((prev) => !prev)}
                    className="w-full bg-[#f8faf9] border border-[#bcc9c6]/70 focus:border-[#00685f] hover:border-[#00685f] rounded-xl px-3.5 py-3 text-sm font-bold text-[#0b1c30] flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                  >
                    <span className={selectedTeacherName ? 'text-[#0b1c30] truncate' : 'text-[#3d4947] truncate'}>
                      {selectedTeacherName
                        ? selectedTeacherName
                        : teachersLoading
                        ? 'Memuat daftar guru piket...'
                        : 'Pilih Nama Guru Piket'}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#00685f] shrink-0 transition-transform ${
                        teacherDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {teacherDropdownOpen && (
                    <div className="border border-[#bcc9c6]/80 rounded-2xl bg-white shadow-lg overflow-hidden z-30">
                      {/* Kolom pencarian di dalam dropdown */}
                      <div className="p-2.5 border-b border-slate-100 bg-[#f8faf9] flex items-center gap-2">
                        <Search className="w-4 h-4 text-[#00685f] shrink-0" />
                        <input
                          type="text"
                          autoFocus
                          value={teacherSearchQuery}
                          onChange={(e) => setTeacherSearchQuery(e.target.value)}
                          placeholder="Cari nama guru (misal: Bud)..."
                          className="w-full bg-transparent text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none"
                        />
                        {teacherSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setTeacherSearchQuery('')}
                            className="p-0.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                        {teachersLoading && dropdownTeachers.length === 0 ? (
                          <div className="p-3 text-xs text-[#3d4947] font-medium">
                            Memuat daftar guru piket...
                          </div>
                        ) : filteredDropdownTeachers.length > 0 ? (
                          filteredDropdownTeachers.map((t) => {
                            const active = selectedTeacherName === t.name;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  setSelectedTeacherName(t.name);
                                  setTeacherDropdownOpen(false);
                                  setTeacherSearchQuery('');
                                  setSubmitError(null);
                                }}
                                className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left text-xs sm:text-sm transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[#e6f4f1] text-[#00685f] font-extrabold'
                                    : 'hover:bg-[#f8faf9] text-[#0b1c30] font-bold'
                                }`}
                              >
                                <span className="truncate">
                                  {t.name}
                                  {t.role ? (
                                    <span className="text-[11px] font-medium text-[#3d4947] ml-1.5">
                                      ({t.role})
                                    </span>
                                  ) : null}
                                </span>
                                {active && <Check className="w-4 h-4 text-[#00685f] shrink-0" />}
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-3 text-xs text-[#3d4947] font-medium">
                            Nama guru "{teacherSearchQuery}" tidak ditemukan di daftar.
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setUseCustomTeacher(true);
                            setCustomTeacherName(teacherSearchQuery.trim());
                            setSelectedTeacherName('');
                            setTeacherDropdownOpen(false);
                            setTeacherSearchQuery('');
                            setSubmitError(null);
                          }}
                          className="w-full px-3.5 py-2.5 flex items-center gap-1.5 text-left text-xs font-extrabold text-[#00685f] bg-[#f8faf9] hover:bg-[#e6f4f1] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Nama Lain (Guru Tamu)...</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {teachersError && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
                      <span className="font-bold">{teachersError}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTeachersRetryKey((k) => k + 1)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 font-extrabold text-amber-900 hover:bg-amber-100 cursor-pointer"
                        >
                          Coba Lagi
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUseCustomTeacher(true);
                            setSubmitError(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#00685f] text-white font-extrabold hover:bg-[#005049] cursor-pointer"
                        >
                          + Nama Lain
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={customTeacherName}
                  onChange={(e) => {
                    setCustomTeacherName(e.target.value);
                    setSubmitError(null);
                  }}
                  placeholder="Ketik nama Guru Piket tamu yang bertugas..."
                  className="w-full bg-[#f8faf9] border border-[#bcc9c6]/70 focus:border-[#00685f] focus:bg-white rounded-xl px-3.5 py-3 text-sm font-bold text-[#0b1c30] focus:outline-none"
                />
              )}
            </section>

            {/* 2. Form 2 Tingkat: Kategori (6) & Chip Perilaku Spesifik */}
            <section className="bg-white border border-[#bcc9c6]/50 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="space-y-2">
                <h2 className="text-sm font-extrabold text-[#0b1c30]">
                  Tingkat 1 — Pilih Kategori Perilaku
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categories.map((cat) => {
                    const active = selectedCategoryId === cat.id;
                    const shortLabel = CATEGORY_SHORT_LABEL_MAP[cat.id] || cat.name;
                    const style = CATEGORY_STYLE_MAP[cat.id] || {
                      border: 'border-gray-200',
                      activeBg: 'bg-[#00685f] text-white border-[#00685f]',
                      badge: 'bg-gray-100 text-gray-700',
                    };
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategory(cat.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          active
                            ? style.activeBg
                            : `bg-[#f8faf9] text-[#0b1c30] ${style.border}`
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-extrabold leading-snug">
                          {shortLabel}
                        </span>
                        {active && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tingkat 2 */}
              {selectedCategory && (
                <div className="pt-2 border-t border-gray-100 space-y-2.5">
                  {isSexualCategory ? (
                    <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <ShieldAlert className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm font-extrabold text-purple-900">
                            Penanganan Khusus & Rahasia (PPKSP)
                          </p>
                          <p className="text-xs text-purple-800 leading-relaxed">
                            Demi kerahasiaan dan perlindungan peserta didik, detail perilaku tidak ditampilkan di formulir umum. Segera teruskan langsung ke Guru BK / Tim TPPK.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleUrgentSexualClick}
                        className={`w-full py-3 px-4 rounded-xl font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          urgentSexualConfirmed
                            ? 'bg-purple-800 text-white ring-2 ring-purple-300'
                            : 'bg-purple-700 hover:bg-purple-800 text-white'
                        }`}
                      >
                        <ShieldAlert className="w-4 h-4" />
                        <span>
                          {urgentSexualConfirmed
                            ? 'Laporkan ke BK Segera (Siap Dikirim)'
                            : 'Laporkan ke BK Segera'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-sm font-extrabold text-[#0b1c30]">
                        Tingkat 2 — Pilih Perilaku Spesifik (boleh lebih dari 1)
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedCategory.options.map((opt) => {
                          const selected = selectedBehaviors.includes(opt.label);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleToggleBehavior(opt.label)}
                              className={`px-3 py-2 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer flex items-center gap-1.5 ${
                                selected
                                  ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                                  : 'bg-[#f8faf9] text-[#0b1c30] border-[#bcc9c6]/70 hover:border-[#00685f]'
                              }`}
                            >
                              {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* 3. Pilih Siswa (Cari Nama / NIS, bisa banyak; hanya tampilkan Nama + Kelas + Foto kecil dari hasil pencarian) */}
            <section className="bg-white border border-[#bcc9c6]/50 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-extrabold text-[#0b1c30] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#00685f]" />
                  <span>Pilih Siswa (bisa lebih dari 1)</span>
                </label>
                {selectedStudents.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#e6f4f1] text-[#00685f] text-[11px] font-extrabold">
                    {selectedStudents.length} dipilih
                  </span>
                )}
              </div>

              {/* Siswa terpilih */}
              {selectedStudents.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedStudents.map((stu) => (
                    <div
                      key={stu.id}
                      className="inline-flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl bg-[#e6f4f1] border border-[#00685f]/25 text-[#0b1c30]"
                    >
                      {stu.avatarUrl ? (
                        <img
                          src={stu.avatarUrl}
                          alt={stu.name}
                          className="w-6 h-6 rounded-full object-cover shrink-0 border border-white"
                        />
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-[#00685f] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                          {stu.initials}
                        </span>
                      )}
                      <span className="text-xs font-extrabold">{stu.name}</span>
                      <span className="text-[11px] font-bold text-[#00685f]">
                        {stu.className}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStudent(stu.id)}
                        className="p-0.5 rounded-lg hover:bg-red-100 text-gray-500 hover:text-red-700 cursor-pointer"
                        aria-label={`Hapus ${stu.name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Kotak pencarian siswa */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#00685f] absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="Cari Nama / NIS siswa (ketik minimal 2 huruf)..."
                  className="w-full bg-[#f8faf9] border border-[#bcc9c6]/70 focus:border-[#00685f] focus:bg-white rounded-xl pl-10 pr-10 py-3 text-sm font-semibold text-[#0b1c30] focus:outline-none"
                />
                {studentQuery && (
                  <button
                    type="button"
                    onClick={() => setStudentQuery('')}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Hasil pencarian: HANYA Nama + Kelas + Foto kecil (tidak tampilkan daftar semua siswa) */}
              {studentQuery.trim().length >= 2 && (
                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden bg-white max-h-64 overflow-y-auto">
                  {studentsLoading ? (
                    <div className="p-3 text-xs text-[#3d4947] font-medium">
                      Mencari data siswa...
                    </div>
                  ) : filteredStudentResults.length > 0 ? (
                    filteredStudentResults.map((stu) => (
                      <button
                        key={stu.id}
                        type="button"
                        onClick={() => handleAddStudent(stu)}
                        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-[#e6f4f1]/60 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {stu.avatarUrl ? (
                            <img
                              src={stu.avatarUrl}
                              alt={stu.name}
                              className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200"
                            />
                          ) : (
                            <span className="w-8 h-8 rounded-full bg-[#e6f4f1] text-[#00685f] text-xs font-black flex items-center justify-center shrink-0">
                              {stu.initials}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#0b1c30] truncate">
                              {stu.name}
                            </p>
                            <p className="text-xs font-semibold text-[#00685f]">
                              Kelas {stu.className}
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-[#f8faf9] border border-[#bcc9c6]/60 text-[11px] font-extrabold text-[#00685f] shrink-0">
                          + Pilih
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="p-3.5 text-xs text-[#3d4947] space-y-2">
                      <p className="font-semibold">
                        Tidak ditemukan / Gagal memuat. Coba ketik NIS atau pakai tombol [Tambah Siswa Manual].
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {studentsError && (
                          <button
                            type="button"
                            onClick={() => setStudentsRetryKey((k) => k + 1)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#f8faf9] border border-[#bcc9c6]/70 text-[#0b1c30] font-extrabold hover:bg-gray-100 cursor-pointer"
                          >
                            Coba Muat Ulang
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setShowManualStudentForm(true);
                            if (studentQuery.trim() && !manualStudentName.trim()) {
                              setManualStudentName(studentQuery.trim());
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#00685f] text-white font-extrabold hover:bg-[#005049] cursor-pointer"
                        >
                          Tambah Siswa Manual
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tombol darurat di bawah pencarian siswa: [Input Siswa Manual - Ketik Nama + Kelas] */}
              <div className="pt-1 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setShowManualStudentForm((prev) => !prev)}
                  className="w-full py-2.5 px-3.5 rounded-xl border border-dashed border-[#00685f]/50 bg-[#f8faf9] hover:bg-[#e6f4f1] text-[#00685f] text-xs font-extrabold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Input Siswa Manual - Ketik Nama + Kelas</span>
                </button>

                {showManualStudentForm && (
                  <div className="bg-[#f8faf9] border border-[#bcc9c6]/60 rounded-xl p-3.5 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={manualStudentName}
                        onChange={(e) => setManualStudentName(e.target.value)}
                        placeholder="Ketik nama lengkap siswa..."
                        className="sm:col-span-2 bg-white border border-[#bcc9c6]/70 focus:border-[#00685f] rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-[#0b1c30] focus:outline-none"
                      />
                      <select
                        value={manualStudentClass}
                        onChange={(e) => setManualStudentClass(e.target.value)}
                        className="bg-white border border-[#bcc9c6]/70 focus:border-[#00685f] rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-[#0b1c30] focus:outline-none"
                      >
                        {CLASS_OPTIONS.map((cls) => (
                          <option key={cls} value={cls}>
                            Kelas {cls}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowManualStudentForm(false)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-[#3d4947] cursor-pointer"
                      >
                        Tutup
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const cleanName = manualStudentName.trim();
                          if (!cleanName) {
                            showToast('Ketik nama siswa terlebih dahulu.', 'warning');
                            return;
                          }
                          handleAddStudent({
                            id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                            name: cleanName,
                            className: manualStudentClass || '7A',
                            nisSearch: '',
                            initials: getInitials(cleanName),
                            schoolId: 'sch_20320123',
                            schoolName: 'SMP N 2 Susukan',
                            isManual: true,
                          });
                          setManualStudentName('');
                          setShowManualStudentForm(false);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-[#00685f] hover:bg-[#005049] text-white text-xs font-extrabold cursor-pointer"
                      >
                        + Tambah Siswa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 4. Lokasi & Waktu + Catatan & Foto Opsional */}
            <section className="bg-white border border-[#bcc9c6]/50 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0b1c30] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#00685f]" />
                    <span>Lokasi Kejadian</span>
                  </label>
                  <select
                    value={locationChoice}
                    onChange={(e) => setLocationChoice(e.target.value)}
                    className="w-full bg-[#f8faf9] border border-[#bcc9c6]/70 focus:border-[#00685f] focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-bold text-[#0b1c30] focus:outline-none"
                  >
                    {LOCATION_OPTIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                  {locationChoice === 'Lainnya' && (
                    <input
                      type="text"
                      value={customLocation}
                      onChange={(e) => setCustomLocation(e.target.value)}
                      placeholder="Sebutkan lokasi (opsional)..."
                      className="w-full mt-1.5 bg-[#f8faf9] border border-[#bcc9c6]/70 focus:border-[#00685f] rounded-xl px-3 py-2 text-xs font-semibold text-[#0b1c30] focus:outline-none"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0b1c30] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#00685f]" />
                    <span>Waktu Kejadian (Otomatis)</span>
                  </label>
                  <div className="w-full bg-[#f8faf9] border border-[#bcc9c6]/70 rounded-xl px-3.5 py-2.5 text-sm font-extrabold text-[#00685f] flex items-center justify-between">
                    <span>{currentTime} WIB</span>
                    <span className="text-[11px] font-semibold text-[#3d4947]">
                      Jam Sekarang
                    </span>
                  </div>
                </div>
              </div>

              {/* Catatan Singkat (Opsional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#0b1c30] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#00685f]" />
                  <span>Catatan Singkat (Opsional)</span>
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tuliskan keterangan singkat kejadian jika diperlukan..."
                  className="w-full bg-[#f8faf9] border border-[#bcc9c6]/70 focus:border-[#00685f] focus:bg-white rounded-xl px-3.5 py-2.5 text-sm text-[#0b1c30] focus:outline-none resize-none"
                />
              </div>

              {/* Foto (Opsional, tertutup default) */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsPhotoOpen((prev) => !prev)}
                  className="w-full px-3.5 py-2.5 bg-[#f8faf9] hover:bg-gray-100 flex items-center justify-between text-xs font-extrabold text-[#3d4947] cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#00685f]" />
                    <span>
                      Foto Bukti (Opsional){photoDataUrl ? ' — 1 Foto Terlampir' : ''}
                    </span>
                  </span>
                  {isPhotoOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {isPhotoOpen && (
                  <div className="p-3.5 bg-white space-y-2.5 border-t border-gray-200">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="block w-full text-xs text-[#3d4947] file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-[#e6f4f1] file:text-[#00685f] hover:file:bg-[#00685f] hover:file:text-white cursor-pointer"
                    />
                    {photoCompressing && (
                      <p className="text-xs text-[#00685f] font-semibold">
                        Mengompres foto...
                      </p>
                    )}
                    {photoDataUrl && (
                      <div className="relative inline-block">
                        <img
                          src={photoDataUrl}
                          alt="Pratinjau foto piket"
                          className="max-h-40 rounded-xl border border-gray-200 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoDataUrl('');
                            setPhotoName('');
                          }}
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Hapus Foto</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Tombol Besar Full Lebar Oranye [Kirim ke Guru BK] */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-5 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-black text-base shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <Send className="w-5 h-5" />
              <span>
                {isSubmitting ? 'Mengirim ke Guru BK...' : 'Kirim ke Guru BK'}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
