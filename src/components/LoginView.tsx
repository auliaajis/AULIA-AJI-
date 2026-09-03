import React, { useState, useEffect, useMemo } from 'react';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  User, 
  CheckCircle2, 
  ShieldAlert, 
  ArrowRight, 
  UserPlus, 
  Users, 
  Search, 
  Check, 
  Sparkles, 
  HelpCircle,
  KeyRound,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Building2,
  GraduationCap,
  Plus,
  RefreshCw,
  X
} from 'lucide-react';
import { Counselor } from '../types';
import SchoolLogo from './SchoolLogo';
import KabupatenLogo from './KabupatenLogo';
import { 
  saveBulkToFirestore, 
  fetchCloudRegisteredSchools,
  fetchCloudCounselors,
  searchCloudCounselor,
  registerSchoolToCloud,
  saveAccountRequestToCloud,
  listenToAccountRequests,
  getSchoolDocRef,
  db
} from '../utils/firestoreSync';
import { 
  getSchoolConfig, 
  getRegisteredSchools, 
  switchSchoolWorkspace, 
  getActiveSchoolId, 
  loadSchoolData,
  saveSchoolData,
  saveSchoolConfig,
  sanitizeSchoolId,
  SchoolConfig 
} from '../utils/schoolConfig';
import { setDoc } from 'firebase/firestore';

interface LoginViewProps {
  allCounselors: (Counselor & { username?: string; password?: string })[];
  onLoginSuccess: (counselor: Counselor) => void;
  onCreateNewCounselor?: (newCounselor: Counselor, makeActive?: boolean) => void;
}

export default function LoginView({ 
  allCounselors: initialCounselors, 
  onLoginSuccess,
  onCreateNewCounselor 
}: LoginViewProps) {
  const [currentSchool, setCurrentSchool] = useState<SchoolConfig>(() => getSchoolConfig());
  const [registeredSchools, setRegisteredSchools] = useState<SchoolConfig[]>(() => getRegisteredSchools());
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');

  // New School Form States
  const [isRegisteringSchool, setIsRegisteringSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolNpsn, setNewSchoolNpsn] = useState('');
  const [newSchoolAddress, setNewSchoolAddress] = useState('');
  const [newPrincipalName, setNewPrincipalName] = useState('');
  const [newPrincipalNip, setNewPrincipalNip] = useState('');

  const [counselorsList, setCounselorsList] = useState<any[]>(() => {
    const fromStorage = loadSchoolData('bk_counselors', null, getActiveSchoolId());
    if (fromStorage && Array.isArray(fromStorage) && fromStorage.length > 0) {
      return fromStorage;
    }
    return initialCounselors || [];
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Quick Account Picker & Modal States
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // New Account & School NPSN Registration Form States
  const [regSchoolNpsn, setRegSchoolNpsn] = useState<string>(() => currentSchool.npsn || '20320123');
  const [regSchoolName, setRegSchoolName] = useState<string>(() => currentSchool.schoolName || 'SMP N 2 Susukan');
  const [regSchoolAddress, setRegSchoolAddress] = useState<string>(() => currentSchool.schoolAddress || '');
  const [isNewSchoolDetected, setIsNewSchoolDetected] = useState<boolean>(false);

  const [regName, setRegName] = useState('');
  const [regNip, setRegNip] = useState('');
  const [regRole, setRegRole] = useState('Guru Pembimbing BK');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('123456');
  const [regClasses, setRegClasses] = useState('7A, 7B, 7C, 7D');
  const [regAvatar, setRegAvatar] = useState('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120');
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const [trackedSubmissionId, setTrackedSubmissionId] = useState<string>(() => sessionStorage.getItem('bk_tracked_reg_id') || '');
  const [liveSubmissionStatus, setLiveSubmissionStatus] = useState<Counselor | null>(null);

  // Keep school config updated and fetch cloud registries on mount
  useEffect(() => {
    const handleSchoolUpdated = () => {
      const cfg = getSchoolConfig();
      setCurrentSchool(cfg);
      setRegisteredSchools(getRegisteredSchools());
    };
    window.addEventListener('bk_school_config_updated', handleSchoolUpdated);
    window.addEventListener('bk_school_changed', handleSchoolUpdated);

    // Fetch cloud registry schools on mount
    fetchCloudRegisteredSchools().then((schools) => {
      if (schools && schools.length > 0) {
        setRegisteredSchools(schools);
      }
    });

    // Fetch cloud counselors on mount
    fetchCloudCounselors().then((cloudCounselors) => {
      if (cloudCounselors && cloudCounselors.length > 0) {
        setCounselorsList(cloudCounselors);
      }
    });

    // Dedicated real-time listener for account registrations in cloud
    const unsubAccountRequests = listenToAccountRequests((requests) => {
      // Check if the user has a pending or recently submitted registration
      const currentTrackedId = sessionStorage.getItem('bk_tracked_reg_id');
      if (currentTrackedId) {
        const found = requests.find(r => r.id === currentTrackedId);
        if (found) {
          setLiveSubmissionStatus(found);
          if (found.approvalStatus === 'approved') {
            setSuccessNotice(`🎉 Selamat! Akun "${found.name}" telah disetujui (ACC) oleh Administrator BK! Anda dapat langsung masuk sekarang.`);
            if (found.username) setUsername(found.username);
            setError(null);
          } else if (found.approvalStatus === 'rejected') {
            setError(`Permintaan pendaftaran akun untuk "${found.name}" telah ditolak oleh Administrator BK.`);
          }
        }
      }

      // Update counselors list with any updates
      const activeSchoolId = getActiveSchoolId();
      const schoolRequests = requests.filter(r => !r.schoolId || r.schoolId === activeSchoolId);
      if (schoolRequests.length > 0) {
        setCounselorsList(prev => {
          const map = new Map<string, any>();
          prev.forEach(c => map.set(c.id, c));
          schoolRequests.forEach(r => {
            const ex = map.get(r.id);
            map.set(r.id, { ...(ex || {}), ...r });
          });
          return Array.from(map.values());
        });
      }
    });

    return () => {
      window.removeEventListener('bk_school_config_updated', handleSchoolUpdated);
      window.removeEventListener('bk_school_changed', handleSchoolUpdated);
      unsubAccountRequests();
    };
  }, []);

  // When opening register modal, sync default school details
  useEffect(() => {
    if (showRegisterModal) {
      setRegSchoolNpsn(currentSchool.npsn || '20320123');
      setRegSchoolName(currentSchool.schoolName || 'SMP N 2 Susukan');
      setRegSchoolAddress(currentSchool.schoolAddress || '');
      setIsNewSchoolDetected(false);
    }
  }, [showRegisterModal, currentSchool]);

  // Keep counselors synchronized with props and storage / firestore events
  useEffect(() => {
    if (initialCounselors && initialCounselors.length > 0) {
      setCounselorsList(prev => {
        // Merge without losing newly registered items
        const map = new Map();
        prev.forEach(c => map.set(c.id, c));
        initialCounselors.forEach(c => map.set(c.id, c));
        return Array.from(map.values());
      });
    }
  }, [initialCounselors]);

  useEffect(() => {
    const handleStorageOrSync = (e?: any) => {
      const activeSchoolId = getActiveSchoolId();
      const saved = loadSchoolData('bk_counselors', null, activeSchoolId);
      if (saved && Array.isArray(saved) && saved.length > 0) {
        setCounselorsList(saved);
      }
    };

    window.addEventListener('bk_realtime_sync', handleStorageOrSync);
    window.addEventListener('storage', handleStorageOrSync);
    return () => {
      window.removeEventListener('bk_realtime_sync', handleStorageOrSync);
      window.removeEventListener('storage', handleStorageOrSync);
    };
  }, []);

  // Handle switching to another school workspace
  const handleSelectSchool = (school: SchoolConfig) => {
    const switched = switchSchoolWorkspace(school);
    setCurrentSchool(switched);
    setShowSchoolModal(false);
    setError(null);
    setSuccessNotice(`Berhasil beralih ke pangkalan data ${switched.schoolName} (NPSN: ${switched.npsn || '-'}). Database online realtime aktif.`);
  };

  // Handle creating & registering a brand new school
  const handleSaveNewSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim() || !newSchoolNpsn.trim()) {
      alert('Nama Sekolah dan NPSN wajib diisi.');
      return;
    }

    const cleanNpsn = newSchoolNpsn.trim().replace(/[^0-9a-zA-Z]/g, '');
    const newSchool: SchoolConfig = {
      schoolName: newSchoolName.trim(),
      npsn: cleanNpsn,
      schoolAddress: newSchoolAddress.trim() || 'Alamat Belum Diatur',
      principalName: newPrincipalName.trim() || 'Kepala Sekolah',
      principalNip: newPrincipalNip.trim() || '-',
      governmentName: 'PEMERINTAH KABUPATEN / KOTA',
      departmentName: 'DINAS PENDIDIKAN'
    };

    const switched = switchSchoolWorkspace(newSchool);
    setCurrentSchool(switched);
    setRegisteredSchools(getRegisteredSchools());
    setIsRegisteringSchool(false);
    setShowSchoolModal(false);
    
    // Reset fields
    setNewSchoolName('');
    setNewSchoolNpsn('');
    setNewSchoolAddress('');
    setNewPrincipalName('');
    setNewPrincipalNip('');

    setSuccessNotice(`Pangkalan data baru untuk "${switched.schoolName}" berhasil dibuat dan siap digunakan! Data siswa dan layanan akan terisolasi khusus untuk sekolah ini.`);
  };

  // Handle NPSN change in registration form with auto-detection of existing schools
  const handleNpsnChange = (val: string) => {
    const cleanDigits = val.replace(/[^0-9a-zA-Z]/g, '');
    setRegSchoolNpsn(cleanDigits);

    if (cleanDigits.length >= 4) {
      const found = registeredSchools.find(
        s => (s.npsn && s.npsn.replace(/[^0-9a-zA-Z]/g, '') === cleanDigits) ||
             s.schoolId === `sch_${cleanDigits}`
      );
      if (found) {
        setRegSchoolName(found.schoolName);
        if (found.schoolAddress) setRegSchoolAddress(found.schoolAddress);
        setIsNewSchoolDetected(false);
      } else {
        setIsNewSchoolDetected(true);
      }
    } else {
      setIsNewSchoolDetected(false);
    }
  };

  // Select school from registered list in registration form
  const handleSelectSchoolForReg = (sch: SchoolConfig) => {
    setRegSchoolNpsn(sch.npsn || '');
    setRegSchoolName(sch.schoolName);
    setRegSchoolAddress(sch.schoolAddress || '');
    setIsNewSchoolDetected(false);
  };

  // Quick presets for new counselor creation
  const handleApplyPreset = (type: 'kelas7' | 'kelas8' | 'kelas9' | 'admin' | 'walikelas') => {
    if (type === 'kelas7') {
      setRegRole('Guru Pembimbing BK Kelas 7');
      setRegClasses('7A, 7B, 7C, 7D, 7E, 7F');
    } else if (type === 'kelas8') {
      setRegRole('Guru Pembimbing BK Kelas 8');
      setRegClasses('8A, 8B, 8C, 8D, 8E, 8F, 8G');
    } else if (type === 'kelas9') {
      setRegRole('Guru Pembimbing BK Kelas 9');
      setRegClasses('9A, 9B, 9C, 9D, 9E, 9F, 9G');
    } else if (type === 'admin') {
      setRegRole('Koordinator BK & Admin Utama');
      setRegClasses(''); // All classes
    } else if (type === 'walikelas') {
      setRegRole('Wali Kelas / Guru Piket');
      setRegClasses('7A, 8A, 9A');
    }
  };

  // Auto-generate username & email when name changes if empty
  const handleNameChange = (val: string) => {
    setRegName(val);
    if (!regUsername || regUsername.trim() === '') {
      const clean = val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
      if (clean) setRegUsername(clean);
    }
    if (!regEmail || regEmail.trim() === '') {
      const clean = val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
      if (clean) setRegEmail(`${clean}@guru.smp.belajar.id`);
    }
  };

  // Robust, multi-field credentials matcher
  const findMatchingCounselor = (inputUser: string, inputPass: string) => {
    const rawUser = inputUser.trim().toLowerCase();
    const rawDigits = rawUser.replace(/[^0-9]/g, '');
    const cleanPass = inputPass.trim();

    return counselorsList.find((c) => {
      // 1. Check identity match (Username, Email, NIP, or Full Name)
      const uMatch = c.username?.trim().toLowerCase() === rawUser;
      const eMatch = c.email?.trim().toLowerCase() === rawUser;
      const nameMatch = c.name?.trim().toLowerCase() === rawUser;
      
      const cNipDigits = (c.nip || '').replace(/[^0-9]/g, '');
      const nipMatch = rawDigits.length >= 4 && cNipDigits.includes(rawDigits);

      const isIdentityMatched = uMatch || eMatch || nameMatch || nipMatch;
      if (!isIdentityMatched) return false;

      // 2. Check Password match
      const storedPass = (c.password || '').trim();
      
      // If no password was configured on the account, allow common default passwords
      if (!storedPass) {
        return cleanPass === '123456' || cleanPass === 'password' || cleanPass === (c.username || '').toLowerCase() || cleanPass === 'admin';
      }

      // Exact match or case-insensitive fallback
      return storedPass === cleanPass || storedPass.toLowerCase() === cleanPass.toLowerCase();
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    if (!username.trim() || !password.trim()) {
      setError('Username/Email/NIP dan Kata Sandi wajib diisi.');
      return;
    }

    setLoading(true);

    // 1. Check local in-memory/storage list first
    let matched = findMatchingCounselor(username, password);

    // 2. If not found locally, query live from Firestore across schools
    if (!matched) {
      try {
        const cloudResult = await searchCloudCounselor(username, password);
        if (cloudResult && cloudResult.counselor) {
          matched = cloudResult.counselor;
          // If the account was registered under a different school workspace, switch automatically
          if (cloudResult.schoolConfig) {
            switchSchoolWorkspace(cloudResult.schoolConfig);
            setCurrentSchool(cloudResult.schoolConfig);
          }
          // Update local counselors list
          const currentSchoolId = cloudResult.schoolId || getActiveSchoolId();
          const currentList = loadSchoolData('bk_counselors', [], currentSchoolId);
          const merged = [...currentList.filter((c: any) => c.id !== matched.id), matched];
          saveSchoolData('bk_counselors', merged, currentSchoolId);
          setCounselorsList(merged);
        }
      } catch (err) {
        console.warn('Live cloud counselor lookup error:', err);
      }
    }

    setLoading(false);

    if (matched) {
      if (matched.approvalStatus === 'pending') {
        setError(
          `Akun "${matched.name}" saat ini masih berstatus MENUNGGU PERSETUJUAN (ACC) dari Administrator BK. Silakan hubungi Koordinator BK / Administrator sekolah untuk menyetujui pendaftaran Anda.`
        );
        return;
      }

      if (matched.approvalStatus === 'rejected') {
        setError(
          `Permintaan pendaftaran akun "${matched.name}" telah DITOLAK oleh Administrator BK.${matched.rejectionReason ? ' Alasan: ' + matched.rejectionReason : ''} Silakan hubungi Administrator BK jika ada kekeliruan.`
        );
        return;
      }

      if (matched.isBlocked) {
        setError('Akun Anda dinonaktifkan oleh administrator. Silakan hubungi Administrator BK.');
        return;
      }

      // If counselor has specific school associated, ensure workspace is synced
      if (matched.schoolId && matched.schoolId !== getActiveSchoolId()) {
        const targetSchool = registeredSchools.find(s => s.schoolId === matched.schoolId || s.npsn === matched.schoolNpsn) || {
          schoolId: matched.schoolId,
          schoolName: matched.schoolName || 'Sekolah Terdaftar',
          npsn: matched.schoolNpsn || '',
          schoolAddress: 'Alamat Belum Diatur',
          principalName: 'Kepala Sekolah',
          principalNip: '-',
          governmentName: 'PEMERINTAH KABUPATEN / KOTA',
          departmentName: 'DINAS PENDIDIKAN'
        };
        switchSchoolWorkspace(targetSchool);
        setCurrentSchool(targetSchool);
      }

      onLoginSuccess(matched);
    } else {
      setError(
        'Akun tidak ditemukan atau kata sandi tidak cocok. Pastikan username/NIP dan kata sandi sudah benar, atau hubungi Administrator BK.'
      );
    }
  };

  const handleSelectAccount = (c: Counselor & { username?: string; password?: string }) => {
    if (c.approvalStatus === 'pending') {
      setError(`Akun "${c.name}" saat ini masih menunggu persetujuan (ACC) dari Administrator BK.`);
      return;
    }
    if (c.approvalStatus === 'rejected') {
      setError(`Akun "${c.name}" telah ditolak oleh Administrator BK.`);
      return;
    }
    setUsername(c.username || c.email || c.name);
    setPassword(c.password || '123456');
    setShowAccountPicker(false);
    setError(null);
    setSuccessNotice(`Akun ${c.name} dipilih. Tekan tombol "Masuk Aplikasi" untuk melanjutkan.`);
  };

  const handleQuickDirectLogin = (c: Counselor & { username?: string; password?: string }) => {
    if (c.approvalStatus === 'pending') {
      setError(`Akun "${c.name}" belum disetujui (Menunggu ACC Administrator BK). Silakan minta Administrator untuk menyetujui akun Anda di menu Pengaturan.`);
      return;
    }
    if (c.approvalStatus === 'rejected') {
      setError(`Akun "${c.name}" ditolak oleh Administrator BK.`);
      return;
    }
    if (c.isBlocked) {
      setError('Akun ini dinonaktifkan oleh administrator.');
      return;
    }

    if (c.schoolId && c.schoolId !== getActiveSchoolId()) {
      const targetSchool = registeredSchools.find(s => s.schoolId === c.schoolId || s.npsn === c.schoolNpsn) || {
        schoolId: c.schoolId,
        schoolName: c.schoolName || 'Sekolah Terdaftar',
        npsn: c.schoolNpsn || '',
        schoolAddress: 'Alamat Belum Diatur',
        principalName: 'Kepala Sekolah',
        principalNip: '-',
        governmentName: 'PEMERINTAH KABUPATEN / KOTA',
        departmentName: 'DINAS PENDIDIKAN'
      };
      switchSchoolWorkspace(targetSchool);
      setCurrentSchool(targetSchool);
    }

    onLoginSuccess(c);
  };

  const handleSaveNewAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regUsername.trim()) {
      alert('Nama Lengkap dan Username wajib diisi.');
      return;
    }

    const cleanNpsn = regSchoolNpsn.trim().replace(/[^0-9a-zA-Z]/g, '');
    if (!cleanNpsn) {
      alert('NPSN Sekolah wajib diisi untuk menentukan partisi database sekolah Anda.');
      return;
    }

    if (!regSchoolName.trim()) {
      alert('Nama Sekolah wajib diisi.');
      return;
    }

    const cleanUsername = regUsername.trim().toLowerCase();
    const targetSchoolId = sanitizeSchoolId(cleanNpsn);

    // Check if username already exists in this target school
    const existingInSchool = loadSchoolData<any[]>('bk_counselors', [], targetSchoolId);
    const usernameTaken = existingInSchool.some(c => c.username?.toLowerCase() === cleanUsername);
    if (usernameTaken) {
      alert(`Username "${cleanUsername}" sudah digunakan oleh akun lain di ${regSchoolName}. Silakan gunakan username lain.`);
      return;
    }

    const parsedClasses = regClasses
      .split(',')
      .map(cl => cl.trim().toUpperCase())
      .filter(cl => cl.length > 0);

    setIsSubmittingReg(true);
    try {
      // 1. Prepare and persist SchoolConfig for this school
      const existingSchoolConfig = registeredSchools.find(s => s.schoolId === targetSchoolId || s.npsn === cleanNpsn);
      const targetSchoolConfig: SchoolConfig = {
        schoolId: targetSchoolId,
        schoolName: regSchoolName.trim(),
        npsn: cleanNpsn,
        schoolAddress: regSchoolAddress.trim() || existingSchoolConfig?.schoolAddress || 'Alamat Belum Diatur',
        principalName: existingSchoolConfig?.principalName || 'Kepala Sekolah',
        principalNip: existingSchoolConfig?.principalNip || '-',
        governmentName: existingSchoolConfig?.governmentName || 'PEMERINTAH KABUPATEN / KOTA',
        departmentName: existingSchoolConfig?.departmentName || 'DINAS PENDIDIKAN',
        updatedAt: new Date().toISOString()
      };

      saveSchoolConfig(targetSchoolConfig);
      setRegisteredSchools(getRegisteredSchools());

      // 2. Build new counselor account linked to this school & NPSN
      const newAccount: Counselor & { username?: string; password?: string } = {
        id: `c-${Date.now()}`,
        name: regName.trim(),
        nip: regNip.trim() || '-',
        role: regRole.trim() || 'Guru Pembimbing BK',
        email: regEmail.trim() || `${cleanUsername}@guru.smp.belajar.id`,
        avatar: regAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
        allowedClasses: parsedClasses,
        username: cleanUsername,
        password: regPassword.trim() || '123456',
        isBlocked: false,
        approvalStatus: 'pending',
        registeredAt: new Date().toISOString(),
        schoolId: targetSchoolId,
        schoolNpsn: cleanNpsn,
        schoolName: regSchoolName.trim()
      };

      // 3. Save to cloud with real-time sync across both account_requests and school collections
      await saveAccountRequestToCloud(newAccount, targetSchoolConfig);

      // Track this submission in current session for live status badge & automatic detection
      setTrackedSubmissionId(newAccount.id);
      setLiveSubmissionStatus(newAccount);
      sessionStorage.setItem('bk_tracked_reg_id', newAccount.id);

      // 4. Automatically switch active workspace to this school
      const switchedSchool = switchSchoolWorkspace(targetSchoolConfig);
      setCurrentSchool(switchedSchool);
      
      const updatedSchoolCounselors = [...existingInSchool.filter(c => c.id !== newAccount.id), newAccount];
      setCounselorsList(updatedSchoolCounselors);
      window.dispatchEvent(new Event('storage'));

      if (onCreateNewCounselor) {
        onCreateNewCounselor(newAccount, false);
      }

      // 5. Auto-fill login credentials for convenience
      setUsername(newAccount.username || '');
      setPassword(newAccount.password || '123456');
      setShowRegisterModal(false);
      setSuccessNotice(
        `Pengajuan akun untuk "${newAccount.name}" di "${targetSchoolConfig.schoolName}" (NPSN: ${cleanNpsn}) berhasil dikirim secara realtime ke Cloud! Status akun: Menunggu persetujuan Admin BK.`
      );

      // Reset form
      setRegName('');
      setRegNip('');
      setRegUsername('');
      setRegPassword('123456');
      setRegEmail('');
    } catch (err: any) {
      alert('Gagal mengirim pendaftaran ke cloud: ' + (err?.message || 'Terjadi kesalahan'));
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const filteredCounselors = useMemo(() => {
    if (!accountSearch.trim()) return counselorsList;
    const q = accountSearch.toLowerCase();
    return counselorsList.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        (c.username && c.username.toLowerCase().includes(q)) ||
        (c.role && c.role.toLowerCase().includes(q)) ||
        (c.nip && c.nip.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [counselorsList, accountSearch]);

  const filteredSchools = useMemo(() => {
    if (!schoolSearch.trim()) return registeredSchools;
    const q = schoolSearch.toLowerCase();
    return registeredSchools.filter(
      s => s.schoolName.toLowerCase().includes(q) || (s.npsn && s.npsn.includes(q))
    );
  }, [registeredSchools, schoolSearch]);

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans" id="login-view-container">
      {/* School Header Identity & Switcher */}
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center">
        <div className="flex justify-center items-center gap-3.5 mb-3">
          <KabupatenLogo size={52} className="shadow-xs border border-amber-600/10 bg-white" />
          <SchoolLogo size={52} className="shadow-xs border border-teal-600/10" />
        </div>
        
        <h2 className="text-2xl font-extrabold text-[#0b1c30] tracking-tight">
          Sistem Informasi BK & E-Rapor
        </h2>
        
        {/* Active School Workspace Tag with Quick Switcher */}
        <div className="mt-2.5 inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-[#bcc9c6]/60 rounded-full shadow-2xs">
          <Building2 className="w-3.5 h-3.5 text-[#00685f]" />
          <span className="text-xs font-bold text-[#0b1c30]">
            {currentSchool.schoolName}
          </span>
          <span className="text-[10px] text-gray-400 font-mono">
            {currentSchool.npsn ? `(NPSN: ${currentSchool.npsn})` : ''}
          </span>
          <button
            type="button"
            onClick={() => setShowSchoolModal(true)}
            className="ml-1 text-[11px] font-bold text-[#00685f] hover:underline hover:text-[#005049] cursor-pointer flex items-center gap-1"
          >
            <span>Ganti Sekolah</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        
        <p className="mt-1.5 text-xs text-[#3d4947] font-semibold">
          Multi-Sekolah Cloud Persistence • Isolasi Data per NPSN
        </p>
      </div>

      {/* Main Container */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg space-y-4">
        {/* Login Card */}
        <div className="bg-white py-7 px-6 sm:px-8 shadow-md rounded-2xl border border-[#bcc9c6]/40">
          <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-gray-100">
            <h3 className="text-base font-extrabold text-[#0b1c30] flex items-center gap-2">
              <div className="p-1.5 bg-[#00685f]/10 text-[#00685f] rounded-lg">
                <Lock className="w-4 h-4" />
              </div>
              <span>Masuk ke Akun Anda</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowRegisterModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-[#00685f] text-xs font-bold rounded-xl transition-all border border-[#00685f]/20 cursor-pointer active:scale-97"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Daftar Akun Baru</span>
            </button>
          </div>

          <form className="space-y-4.5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold flex gap-2.5 animate-in fade-in slide-in-from-top-1">
                <ShieldAlert className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p>{error}</p>
                </div>
              </div>
            )}

            {successNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex gap-2 items-center animate-in fade-in slide-in-from-top-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            {/* Live Realtime Status for Pending Account Submission */}
            {liveSubmissionStatus && liveSubmissionStatus.approvalStatus === 'pending' && (
              <div className="p-3.5 bg-amber-50/90 border-2 border-amber-300 rounded-xl text-xs text-amber-900 space-y-2 animate-in fade-in slide-in-from-top-1 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold flex items-center gap-2 text-amber-950">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    Pengajuan Terkirim: Menunggu ACC Admin BK
                  </span>
                  <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-black rounded-md border border-amber-300 shrink-0">
                    Realtime Cloud
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Pengajuan akun untuk <strong>{liveSubmissionStatus.name}</strong> ({liveSubmissionStatus.username}) sudah masuk ke Cloud Server. Halaman ini akan <strong>otomatis terupdate seketika</strong> begitu Administrator menyetujui akun Anda.
                </p>
              </div>
            )}

            {/* Username / Email / NIP / Nama */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="username" className="block text-[11px] font-bold text-[#3d4947] uppercase tracking-wider">
                  Username / Email / NIP / Nama
                </label>
                <span className="text-[10px] text-gray-500 font-medium">Bebas & Fleksibel</span>
              </div>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-[#3d4947]/50" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-[#bcc9c6]/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] transition-all bg-[#f8faf9]"
                  placeholder="Contoh: aulia, nona, tri, atau NIP"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password" className="block text-[11px] font-bold text-[#3d4947] uppercase tracking-wider">
                  Kata Sandi (Password)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountPicker(true);
                  }}
                  className="text-[10px] text-[#00685f] hover:underline font-bold"
                >
                  Lupa kata sandi?
                </button>
              </div>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-[#3d4947]/50" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 border border-[#bcc9c6]/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] transition-all bg-[#f8faf9]"
                  placeholder="Masukkan kata sandi (default: 123456 / username)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl shadow-xs text-sm font-bold text-white bg-[#00685f] hover:bg-[#005049] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00685f] transition-all cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Masuk ke Dashboard ({currentSchool.schoolName})</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Account Picker Accordion / Toggle */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowAccountPicker(!showAccountPicker)}
              className="w-full flex items-center justify-between text-xs font-bold text-[#00685f] hover:text-[#005049] p-2 rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00685f]" />
                <span>Pilih Akun Guru ({currentSchool.schoolName})</span>
              </div>
              {showAccountPicker ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAccountPicker && (
              <div className="mt-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Search account bar */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Cari nama, NIP, atau username guru..."
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00685f]"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-gray-100">
                  {filteredCounselors.map((c) => {
                    const isPending = c.approvalStatus === 'pending';
                    const isRejected = c.approvalStatus === 'rejected';

                    return (
                      <div
                        key={c.id}
                        className={`pt-2 first:pt-0 flex items-center justify-between gap-2 p-2 rounded-xl transition-all border ${
                          isPending 
                            ? 'bg-amber-50/50 border-amber-200/80 hover:bg-amber-50' 
                            : isRejected
                              ? 'bg-rose-50/40 border-rose-200/80 hover:bg-rose-50'
                              : 'hover:bg-slate-50 border-transparent hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={c.avatar}
                            alt={c.name}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-[#0b1c30] truncate">{c.name}</p>
                              {isPending && (
                                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[8px] font-black rounded border border-amber-300 uppercase">
                                  Menunggu ACC
                                </span>
                              )}
                              {isRejected && (
                                <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[8px] font-black rounded border border-rose-300 uppercase">
                                  Ditolak
                                </span>
                              )}
                              {c.isBlocked && (
                                <span className="px-1.5 py-0.2 bg-red-100 text-red-800 text-[8px] font-black rounded border border-red-300 uppercase">
                                  Nonaktif
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-500 truncate">
                              {c.role} • User: <span className="font-mono text-[#00685f] font-bold">{c.username || '-'}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isPending ? (
                            <span className="text-[9px] text-amber-700 font-bold px-2 py-1 bg-amber-100/60 rounded-lg">
                              Perlu ACC Admin
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSelectAccount(c)}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold rounded-lg transition-all"
                                title="Isikan ke formulir login"
                              >
                                Pilih
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickDirectLogin(c)}
                                className="px-2.5 py-1 bg-[#00685f] hover:bg-[#005049] text-white text-[10px] font-bold rounded-lg transition-all shadow-2xs"
                                title="Langsung masuk tanpa mengetik"
                              >
                                Masuk
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredCounselors.length === 0 && (
                    <div className="py-4 text-center text-xs text-gray-400 font-semibold">
                      Tidak ditemukan akun dengan kata kunci tersebut.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-gray-500 font-medium">
          Sinkronisasi cloud aktif • Data terisolasi otomatis per pangkalan data sekolah di Firebase Firestore
        </div>
      </div>

      {/* Modal Switch / Daftarkan Sekolah (Multi-Tenancy) */}
      {showSchoolModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#bcc9c6]/40 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-50 text-[#00685f] rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#0b1c30]">Pilih / Daftarkan Sekolah</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Setiap sekolah memiliki database siswa dan layanan terpisah</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSchoolModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isRegisteringSchool ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Daftar Sekolah Tersedia</span>
                  <button
                    type="button"
                    onClick={() => setIsRegisteringSchool(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#00685f] hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Daftarkan Sekolah Baru</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari nama sekolah atau NPSN..."
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-gray-100">
                  {filteredSchools.map((s) => {
                    const isCurrent = (s.schoolId || s.npsn) === (currentSchool.schoolId || currentSchool.npsn);
                    return (
                      <div
                        key={s.schoolId || s.npsn || s.schoolName}
                        className={`pt-2 first:pt-0 p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isCurrent ? 'bg-teal-50/50 border-teal-200 ring-1 ring-[#00685f]/20' : 'hover:bg-gray-50 border-gray-100'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-[#0b1c30] truncate">{s.schoolName}</p>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 bg-[#00685f] text-white text-[9px] font-bold rounded-md">
                                Aktif
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-500 truncate">
                            NPSN: {s.npsn || '-'} • {s.principalName || 'Kepala Sekolah'}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectSchool(s)}
                          disabled={isCurrent}
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                            isCurrent
                              ? 'bg-teal-100 text-[#00685f] cursor-default'
                              : 'bg-[#00685f] hover:bg-[#005049] text-white shadow-2xs cursor-pointer'
                          }`}
                        >
                          {isCurrent ? 'Sedang Digunakan' : 'Gunakan Sekolah Ini'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveNewSchool} className="space-y-3">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium">
                  🏫 <strong>Pangkalan Data Terisolasi</strong>: Mendaftarkan sekolah baru akan membuat partisi cloud khusus di Firestore. Data siswa, kelas 9, catatan bimbingan, dan akun konselor akan terpisah penuh dan tidak bercampur dengan sekolah lain.
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                    Nama Sekolah <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    placeholder="Contoh: SMP Negeri 1 Bawang"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                    NPSN (Nomor Pokok Sekolah Nasional) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newSchoolNpsn}
                    onChange={(e) => setNewSchoolNpsn(e.target.value)}
                    placeholder="Contoh: 20320456 (8 digit angka)"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                    Alamat Lengkap Sekolah
                  </label>
                  <input
                    type="text"
                    value={newSchoolAddress}
                    onChange={(e) => setNewSchoolAddress(e.target.value)}
                    placeholder="Jl. Raya Utama No. 12, Kec. Bawang"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                      Nama Kepala Sekolah
                    </label>
                    <input
                      type="text"
                      value={newPrincipalName}
                      onChange={(e) => setNewPrincipalName(e.target.value)}
                      placeholder="Drs. H. Ahmad, M.Pd."
                      className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                      NIP Kepala Sekolah
                    </label>
                    <input
                      type="text"
                      value={newPrincipalNip}
                      onChange={(e) => setNewPrincipalNip(e.target.value)}
                      placeholder="19700101 199503 1 002"
                      className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsRegisteringSchool(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Daftarkan & Masuk Database Sekolah
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Buat / Daftarkan Akun Baru */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#bcc9c6]/40 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-50 text-[#00685f] rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#0b1c30]">Daftarkan Akun Guru / Konselor Baru</h3>
                  <p className="text-[11px] text-gray-500 font-medium">
                    Untuk pangkalan data: <span className="font-bold text-[#00685f]">{currentSchool.schoolName}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template Cepat */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider block">
                Pilihan Template Cepat
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('kelas7')}
                  className="px-2.5 py-1 bg-gray-50 hover:bg-teal-50 hover:text-[#00685f] border border-gray-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                >
                  🏫 Guru BK Kelas 7
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('kelas8')}
                  className="px-2.5 py-1 bg-gray-50 hover:bg-teal-50 hover:text-[#00685f] border border-gray-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                >
                  🏫 Guru BK Kelas 8
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('kelas9')}
                  className="px-2.5 py-1 bg-gray-50 hover:bg-teal-50 hover:text-[#00685f] border border-gray-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                >
                  🏫 Guru BK Kelas 9
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('admin')}
                  className="px-2.5 py-1 bg-gray-50 hover:bg-teal-50 hover:text-[#00685f] border border-gray-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                >
                  ⭐ Koordinator / Admin
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveNewAccount} className="space-y-4">
              {/* SECTION: Konfigurasi NPSN & Pangkalan Data Sekolah */}
              <div className="bg-[#f8faf9] rounded-xl p-3.5 border border-[#bcc9c6]/50 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-teal-100 text-[#00685f] rounded-lg">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-[#0b1c30]">Partisi Database & NPSN Sekolah</h4>
                    <p className="text-[10px] text-gray-500">
                      Tentukan nomor NPSN sekolah agar data siswa & bimbingan terpisah secara otomatis.
                    </p>
                  </div>
                </div>

                {/* Quick selector of already registered schools */}
                {registeredSchools.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-600 block">Pilih dari Sekolah Terdaftar:</span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {registeredSchools.map((sch) => {
                        const isSelected = regSchoolNpsn === sch.npsn || (sch.npsn && regSchoolNpsn.includes(sch.npsn));
                        return (
                          <button
                            key={sch.schoolId || sch.npsn || sch.schoolName}
                            type="button"
                            onClick={() => handleSelectSchoolForReg(sch)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                              isSelected
                                ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-teal-50 hover:border-teal-300'
                            }`}
                          >
                            {sch.schoolName} <span className="opacity-80 font-mono">({sch.npsn || 'NPSN'})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                      NPSN Sekolah <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={regSchoolNpsn}
                      onChange={(e) => handleNpsnChange(e.target.value)}
                      placeholder="Contoh: 20320123"
                      className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] font-mono font-bold text-[#00685f] bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                      Nama Sekolah <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={regSchoolName}
                      onChange={(e) => setRegSchoolName(e.target.value)}
                      placeholder="Contoh: SMP Negeri 2 Susukan"
                      className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] bg-white font-medium"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                      Alamat Sekolah (Opsional)
                    </label>
                    <input
                      type="text"
                      value={regSchoolAddress}
                      onChange={(e) => setRegSchoolAddress(e.target.value)}
                      placeholder="Contoh: Jl. Ki Ageng Selo No. 12, Banjarnegara"
                      className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] bg-white"
                    />
                  </div>
                </div>

                {/* Feedback badge on NPSN */}
                {regSchoolNpsn.trim().length >= 4 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-teal-900 bg-teal-50 px-2.5 py-1.5 rounded-lg border border-teal-200">
                    <Sparkles className="w-3.5 h-3.5 text-[#00685f] shrink-0" />
                    <span>
                      Pangkalan data Firestore yang digunakan: <strong className="font-mono text-[#00685f]">schools/sch_{regSchoolNpsn.trim()}</strong>. Data siswa terisolasi khusus untuk {regSchoolName || 'sekolah ini'}.
                    </span>
                  </div>
                )}
              </div>

              {/* SECTION: Identitas Pengguna & Login */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                    Nama Lengkap & Gelar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Contoh: Dra. Siti Rahayu, M.Pd."
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                    NIP (Nomor Induk Pegawai)
                  </label>
                  <input
                    type="text"
                    value={regNip}
                    onChange={(e) => setRegNip(e.target.value)}
                    placeholder="Contoh: 19850101 201001 2 001"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                    Jabatan / Role
                  </label>
                  <input
                    type="text"
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    placeholder="Contoh: Guru Pembimbing BK"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                    Username Login <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="Username masuk"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] font-mono font-bold text-[#00685f]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                    Kata Sandi (Password / PIN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Password akun"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] font-mono font-bold"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                    Email (Google / Belajar.id)
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Contoh: siti.rahayu@guru.smp.belajar.id"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                    Hak Akses Kelas Bimbingan
                  </label>
                  <input
                    type="text"
                    value={regClasses}
                    onChange={(e) => setRegClasses(e.target.value)}
                    placeholder="Contoh: 7A, 7B, 7C (Kosongkan jika Administrator)"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]"
                  />
                  <p className="text-[10px] text-gray-500">Pisahkan dengan koma. Kosongkan untuk akses semua kelas.</p>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  disabled={isSubmittingReg}
                  className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReg}
                  className="px-5 py-2 bg-[#00685f] hover:bg-[#005049] disabled:bg-gray-400 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingReg ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengirim Realtime ke Cloud...</span>
                    </>
                  ) : (
                    <span>Ajukan Akun & Pisahkan Database Sekolah</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
