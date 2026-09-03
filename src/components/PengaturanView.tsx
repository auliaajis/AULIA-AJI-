import React, { useState, useEffect } from 'react';
import { Counselor } from '../types';
import { 
  getSchoolConfig, 
  saveSchoolConfig, 
  resetSchoolConfigToDefault, 
  getActiveSchoolId 
} from '../utils/schoolConfig';
import SchoolLogo from './SchoolLogo';
import KabupatenLogo from './KabupatenLogo';
import { getAutoJournalSettings, saveAutoJournalSettings, AutoJournalSettings } from '../utils/journalAutoLink';
import { purgeDummyData } from '../utils/purgeDummyData';
import { isAdministrator } from '../utils/accessControl';
import { updateAccountRequestInCloud, listenToAccountRequests } from '../utils/firestoreSync';
import { 
  Save, 
  RotateCcw, 
  Building, 
  MapPin, 
  User, 
  ShieldAlert, 
  Upload, 
  Download,
  Trash2, 
  Image as ImageIcon, 
  Sparkles,
  CheckCircle2,
  Mail,
  Plus,
  Search,
  Users,
  Settings,
  Check,
  X,
  Info,
  Pencil,
  Database,
  Lock,
  Laptop,
  Layers,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  UserX,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  Phone,
  Copy,
  CopyCheck,
  CheckCheck,
  Building2
} from 'lucide-react';

export interface WaliKelasConfig {
  class: string;
  name: string;
  email: string;
  phone?: string;
}

interface SchoolConfig {
  schoolName: string;
  schoolAddress: string;
  principalName: string;
  principalNip: string;
  governmentName: string;
  departmentName: string;
}

interface PengaturanViewProps {
  activeCounselor?: Counselor;
  allCounselors?: Counselor[];
  onUpdateCounselor?: (counselor: Counselor) => void;
  onChangeCounselor?: (counselor: Counselor) => void;
  onCreateCounselor?: (counselor: Counselor) => void;
  onDeleteCounselor?: (id: string) => void;
}

export default function PengaturanView({
  activeCounselor,
  allCounselors = [],
  onUpdateCounselor,
  onChangeCounselor,
  onCreateCounselor,
  onDeleteCounselor
}: PengaturanViewProps) {
  const isUserAdmin = isAdministrator(activeCounselor);

  const [config, setConfig] = useState<SchoolConfig>({
    schoolName: 'SMP N 2 Susukan',
    schoolAddress: 'Desa Koripan, Kec. Susukan, Kab. Semarang, Jawa Tengah 50777',
    principalName: 'Agus Setiawan, S.Pd. Fis',
    principalNip: '19680831 199103 1 007',
    governmentName: 'PEMERINTAH KABUPATEN SEMARANG',
    departmentName: 'DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA',
  });

  const [activeTab, setActiveTab] = useState<'identitas' | 'walikelas' | 'database' | 'akses' | 'otomatisasi' | 'profil' | 'database-personal'>(
    isUserAdmin ? 'identitas' : 'profil'
  );

  // Visible passwords map for admin user table
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Personal Profile Edit Form states
  const [profileName, setProfileName] = useState(activeCounselor?.name || '');
  const [profileNip, setProfileNip] = useState(activeCounselor?.nip || '');
  const [profileRole, setProfileRole] = useState(activeCounselor?.role || '');
  const [profileEmail, setProfileEmail] = useState(activeCounselor?.email || '');
  const [profilePhone, setProfilePhone] = useState(activeCounselor?.phone || '');
  const [profilePassword, setProfilePassword] = useState(activeCounselor?.password || '');
  const [showMyPassword, setShowMyPassword] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    if (activeCounselor) {
      setProfileName(activeCounselor.name);
      setProfileNip(activeCounselor.nip);
      setProfileRole(activeCounselor.role);
      setProfileEmail(activeCounselor.email || '');
      setProfilePhone(activeCounselor.phone || '');
      setProfilePassword(activeCounselor.password || '');
    }
  }, [activeCounselor]);

  // Real-time listener for incoming account registration requests from cloud
  const [realtimePendingRequests, setRealtimePendingRequests] = useState<Counselor[]>([]);

  useEffect(() => {
    const unsub = listenToAccountRequests((requests) => {
      const pending = requests.filter(r => r.approvalStatus === 'pending');
      setRealtimePendingRequests(pending);
    });
    return () => unsub();
  }, []);

  const allPendingCounselors = React.useMemo(() => {
    const map = new Map<string, Counselor>();
    (allCounselors || []).filter(c => c.approvalStatus === 'pending').forEach(c => map.set(c.id, c));
    (realtimePendingRequests || []).forEach(c => map.set(c.id, c));
    return Array.from(map.values());
  }, [allCounselors, realtimePendingRequests]);

  const handleSavePersonalProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      alert('Nama tidak boleh kosong.');
      return;
    }
    if (activeCounselor && onUpdateCounselor) {
      onUpdateCounselor({
        ...activeCounselor,
        name: profileName.trim(),
        nip: profileNip.trim(),
        role: isUserAdmin ? profileRole.trim() : activeCounselor.role,
        email: profileEmail.trim(),
        phone: profilePhone.trim(),
        password: profilePassword.trim() || activeCounselor.password
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    }
  };
  const [autoJournalSettings, setAutoJournalSettings] = useState<AutoJournalSettings>(() => {
    return getAutoJournalSettings();
  });

  const handleToggleAutoJournal = (key: keyof AutoJournalSettings, val: boolean) => {
    const updated = { ...autoJournalSettings, [key]: val };
    setAutoJournalSettings(updated);
    saveAutoJournalSettings(updated);
  };
  const [dbMode, setDbMode] = useState<'shared' | 'isolated'>(() => {
    return (localStorage.getItem('bk_database_mode') as 'shared' | 'isolated') || 'shared';
  });
  const [threshold, setThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('bk_email_threshold');
    return saved ? parseInt(saved) || 20 : 20;
  });

  const [importingData, setImportingData] = useState<any | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Security Access Control settings states
  const [requireLogin, setRequireLogin] = useState<boolean>(() => {
    return localStorage.getItem('bk_require_login') !== 'false';
  });
  const [hideSimulations, setHideSimulations] = useState<boolean>(() => {
    return localStorage.getItem('bk_hide_simulation_helpers') === 'true';
  });

  const handleToggleRequireLogin = (val: boolean) => {
    if (!isUserAdmin) {
      alert('Akses Ditolak: Hanya Bapak Aulia Aji Sasongko atau Administrator Utama yang berhak mengubah pengaturan keamanan global ini.');
      return;
    }
    setRequireLogin(val);
    localStorage.setItem('bk_require_login', val ? 'true' : 'false');
    window.dispatchEvent(new Event('storage'));
  };

  const handleToggleHideSimulations = (val: boolean) => {
    if (!isUserAdmin) {
      alert('Akses Ditolak: Hanya Bapak Aulia Aji Sasongko atau Administrator Utama yang berhak mengubah pengaturan pintasan ini.');
      return;
    }
    setHideSimulations(val);
    localStorage.setItem('bk_hide_simulation_helpers', val ? 'true' : 'false');
    window.dispatchEvent(new Event('storage'));
  };

  // Counselor Account Manager states
  const [editingCounselorId, setEditingCounselorId] = useState<string | null>(null);
  const [editCName, setEditCName] = useState('');
  const [editCNip, setEditCNip] = useState('');
  const [editCRole, setEditCRole] = useState('');
  const [editCEmail, setEditCEmail] = useState('');
  const [editCUsername, setEditCUsername] = useState('');
  const [editCPassword, setEditCPassword] = useState('');
  const [editCClasses, setEditCClasses] = useState('');

  const [isAddingC, setIsAddingC] = useState(false);
  const [newCName, setNewCName] = useState('');
  const [newCNip, setNewCNip] = useState('');
  const [newCRole, setNewCRole] = useState('');
  const [newCEmail, setNewCEmail] = useState('');
  const [newCUsername, setNewCUsername] = useState('');
  const [newCPassword, setNewCPassword] = useState('123456');
  const [newCClasses, setNewCClasses] = useState('');
  const [copiedCounselorId, setCopiedCounselorId] = useState<string | null>(null);

  const handleApplyAddPreset = (type: 'kelas7' | 'kelas8' | 'kelas9' | 'admin' | 'walikelas') => {
    if (type === 'kelas7') {
      setNewCRole('Guru Pembimbing BK Kelas 7');
      setNewCClasses('7A, 7B, 7C, 7D, 7E, 7F');
    } else if (type === 'kelas8') {
      setNewCRole('Guru Pembimbing BK Kelas 8');
      setNewCClasses('8A, 8B, 8C, 8D, 8E, 8F, 8G');
    } else if (type === 'kelas9') {
      setNewCRole('Guru Pembimbing BK Kelas 9');
      setNewCClasses('9A, 9B, 9C, 9D, 9E, 9F, 9G');
    } else if (type === 'admin') {
      setNewCRole('Koordinator BK & Administrator');
      setNewCClasses('');
    } else if (type === 'walikelas') {
      setNewCRole('Wali Kelas / Guru Piket');
      setNewCClasses('7A, 8A, 9A');
    }
  };

  const handleCopyCredentials = (c: Counselor) => {
    const text = `Kredensial Login BK SMPN 2 Susukan:\nNama: ${c.name}\nUsername: ${c.username || '-'}\nPassword: ${c.password || '123456'}\nRole: ${c.role}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopiedCounselorId(c.id);
    setTimeout(() => setCopiedCounselorId(null), 3000);
  };

  const handleSaveCounselorEdit = () => {
    if (!editCName.trim() || !editCUsername.trim() || !editCPassword.trim()) {
      alert('Nama, Username, dan Password tidak boleh kosong.');
      return;
    }
    if (!isUserAdmin && editingCounselorId !== activeCounselor?.id) {
      alert('Akses Ditolak: Hanya Bapak Aulia Aji Sasongko atau Administrator Utama yang berhak mengedit data akun lain.');
      return;
    }
    const usernameTaken = allCounselors.some(
      c => c.id !== editingCounselorId && c.username?.toLowerCase() === editCUsername.trim().toLowerCase()
    );
    if (usernameTaken) {
      alert('Username ini sudah digunakan oleh akun lain. Silakan pilih username lain.');
      return;
    }

    const parsedClasses = editCClasses
      .split(',')
      .map(cl => cl.trim().toUpperCase())
      .filter(cl => cl.length > 0);

    const target = allCounselors.find(c => c.id === editingCounselorId);
    if (target && onUpdateCounselor) {
      onUpdateCounselor({
        ...target,
        name: editCName.trim(),
        nip: editCNip.trim(),
        role: editCRole.trim(),
        email: editCEmail.trim() || target.email,
        username: editCUsername.trim(),
        password: editCPassword.trim(),
        allowedClasses: parsedClasses
      });
      setEditingCounselorId(null);
      alert('Data akun konselor berhasil diperbarui!');
    }
  };

  const handleToggleBlockUser = (c: Counselor) => {
    if (!isUserAdmin) {
      alert('Akses Ditolak: Hanya Bapak Aulia Aji Sasongko atau Administrator Utama yang dapat menonaktifkan akun.');
      return;
    }
    if (c.id === activeCounselor?.id) {
      alert('Anda tidak dapat menonaktifkan akun Anda sendiri yang sedang digunakan saat ini.');
      return;
    }
    if (onUpdateCounselor) {
      const isBlocked = !c.isBlocked;
      onUpdateCounselor({
        ...c,
        isBlocked
      });
      alert(`Akun "${c.name}" berhasil ${isBlocked ? 'dinonaktifkan' : 'diaktifkan kembali'}.`);
    }
  };

  const handleDeleteUser = (c: Counselor) => {
    if (!isUserAdmin) {
      alert('Akses Ditolak: Hanya Bapak Aulia Aji Sasongko atau Administrator Utama yang dapat menghapus akun.');
      return;
    }
    if (c.id === activeCounselor?.id) {
      alert('Anda tidak dapat menghapus akun Anda sendiri yang sedang digunakan saat ini.');
      return;
    }
    if (allCounselors.length <= 1) {
      alert('Sistem wajib menyisakan minimal 1 akun konselor aktif.');
      return;
    }
    if (confirm(`Apakah Anda yakin ingin menghapus akun "${c.name}"?`)) {
      if (onDeleteCounselor) {
        onDeleteCounselor(c.id);
        alert(`Akun "${c.name}" berhasil dihapus.`);
      }
    }
  };

  const handleApproveCounselor = (c: Counselor) => {
    if (!isUserAdmin) {
      alert('Akses Ditolak: Hanya Administrator BK (Bapak Aulia Aji Sasongko) yang berhak menyetujui (ACC) pendaftaran akun.');
      return;
    }
    const updated: Counselor = {
      ...c,
      approvalStatus: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: activeCounselor?.name || 'Administrator BK',
      isBlocked: false
    };
    if (onUpdateCounselor) {
      onUpdateCounselor(updated);
    }
    updateAccountRequestInCloud(updated).catch(console.warn);
    setRealtimePendingRequests(prev => prev.filter(req => req.id !== c.id));
    alert(`Pendaftaran akun "${c.name}" BERHASIL DISETUJUI (ACC)!\n\nAkun dengan username "${c.username}" sekarang sudah dapat login dan mengakses sistem BK secara realtime.`);
  };

  const handleRejectCounselor = (c: Counselor) => {
    if (!isUserAdmin) {
      alert('Akses Ditolak: Hanya Administrator BK yang berhak menolak pendaftaran akun.');
      return;
    }
    const reason = prompt(`Masukkan alasan penolakan pendaftaran akun untuk "${c.name}" (opsional):`, 'Data pendaftaran belum lengkap / belum diverifikasi');
    if (reason === null) return; // Batal ditekan

    const updated: Counselor = {
      ...c,
      approvalStatus: 'rejected',
      rejectionReason: reason.trim() || 'Ditolak oleh Administrator BK',
      isBlocked: true
    };
    if (onUpdateCounselor) {
      onUpdateCounselor(updated);
    }
    updateAccountRequestInCloud(updated).catch(console.warn);
    setRealtimePendingRequests(prev => prev.filter(req => req.id !== c.id));
    alert(`Permintaan pendaftaran akun "${c.name}" telah ditolak.`);
  };

  const handleApproveAllPending = () => {
    if (!isUserAdmin) return;
    if (allPendingCounselors.length === 0) return;

    if (confirm(`Apakah Anda yakin ingin MENYETUJUI (ACC) sekaligus ${allPendingCounselors.length} permintaan pendaftaran akun guru baru?`)) {
      allPendingCounselors.forEach(c => {
        const updated: Counselor = {
          ...c,
          approvalStatus: 'approved',
          approvedAt: new Date().toISOString(),
          approvedBy: activeCounselor?.name || 'Administrator BK',
          isBlocked: false
        };
        if (onUpdateCounselor) {
          onUpdateCounselor(updated);
        }
        updateAccountRequestInCloud(updated).catch(console.warn);
      });
      setRealtimePendingRequests([]);
      alert(`Berhasil menyetujui (ACC) ${allPendingCounselors.length} akun guru baru! Seluruh guru tersebut sekarang sudah dapat langsung login secara realtime.`);
    }
  };

  const handleSaveNewUser = () => {
    if (!newCName.trim()) {
      alert('Nama Lengkap wajib diisi.');
      return;
    }
    const cleanUser = (newCUsername.trim() || newCName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)).toLowerCase();
    const cleanPass = newCPassword.trim() || '123456';

    const usernameTaken = allCounselors.some(
      c => c.username?.toLowerCase() === cleanUser
    );
    if (usernameTaken) {
      alert(`Username "${cleanUser}" sudah digunakan oleh akun lain. Silakan gunakan username yang berbeda.`);
      return;
    }

    const parsedClasses = newCClasses
      .split(',')
      .map(cl => cl.trim().toUpperCase())
      .filter(cl => cl.length > 0);

    if (onCreateCounselor) {
      const newAcc: Counselor = {
        id: `c-${Date.now()}`,
        name: newCName.trim(),
        nip: newCNip.trim() || '-',
        role: newCRole.trim() || 'Guru Pembimbing BK',
        email: newCEmail.trim() || `${cleanUser}@guru.smp.belajar.id`,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
        allowedClasses: parsedClasses,
        username: cleanUser,
        password: cleanPass,
        isBlocked: false,
        approvalStatus: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: activeCounselor?.name || 'Administrator BK'
      };

      onCreateCounselor(newAcc);
      setIsAddingC(false);
      setNewCName('');
      setNewCNip('');
      setNewCRole('');
      setNewCEmail('');
      setNewCUsername('');
      setNewCPassword('123456');
      setNewCClasses('');
      alert(`Akun baru untuk "${newAcc.name}" berhasil dibuat dan disetujui (ACC)!\n\nUsername: ${newAcc.username}\nPassword: ${newAcc.password}\n\nAkun ini sudah dapat langsung digunakan untuk login.`);
    }
  };

  const handleToggleDbMode = (mode: 'shared' | 'isolated') => {
    if (mode === dbMode) return;
    
    const message = mode === 'isolated' 
      ? "⚠️ AKTIFKAN ISOLASI DATABASE (DATABASE MANDIRI PER AKUN)?\n\n" +
        "Setelah diaktifkan, data siswa, pelanggaran, layanan, jurnal, absensi, dan integrasi Google Sheets akan terpisah secara mandiri untuk masing-masing Akun Konselor.\n\n" +
        "Akun Anda tidak akan saling menimpa atau mencampuri data rekan sejawat lainnya, meskipun menggunakan browser/perangkat yang sama.\n\n" +
        "Sistem akan memuat ulang halaman untuk menerapkan ruang penyimpanan terisolasi yang baru. Lanjutkan?"
      : "⚠️ NONAKTIFKAN ISOLASI DATABASE (KEMBALI KE DATABASE BERSAMA)?\n\n" +
        "Sistem akan kembali menggunakan satu database lokal global yang sama (dibagikan untuk seluruh akun konselor di browser ini).\n\n" +
        "Sistem akan memuat ulang halaman untuk menerapkan ruang penyimpanan bersama yang baru. Lanjutkan?";
        
    if (confirm(message)) {
      localStorage.setItem('bk_database_mode', mode);
      setDbMode(mode);
      window.dispatchEvent(new Event('storage'));
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  };

  const [isPurging, setIsPurging] = useState(false);

  const handlePurgeDummyData = async () => {
    if (!confirm('Apakah Anda yakin ingin membersihkan dan menghapus SEMUA data bawaan/dummy dari LocalStorage & Cloud Database Firestore? Data asli buatan Anda akan tetap aman.')) {
      return;
    }
    setIsPurging(true);
    try {
      const { totalPurged } = await purgeDummyData();
      if (totalPurged > 0) {
        alert(`SUKSES! Berhasil membersihkan ${totalPurged} catatan data dummy/bawaan dari database lokal & Firestore cloud.`);
      } else {
        alert('Database Anda sudah bersih dari data dummy.');
      }
      window.location.reload();
    } catch (err) {
      alert('Gagal membersihkan data dummy: ' + err);
    } finally {
      setIsPurging(false);
    }
  };

  const handleExportDatabase = () => {
    try {
      const keysToExport = [
        'bk_students',
        'bk_violations',
        'bk_services',
        'bk_logs',
        'bk_database_mode',
        'bk_walikelas_config',
        'bk_school_config',
        'bk_email_threshold',
        'bk_attendance_history',
        'bk_parent_summons',
        'bk_daily_journals',
        'bk_home_visits'
      ];
      
      const backupData: Record<string, string | null> = {};
      const activeCounselorId = localStorage.getItem('bk_active_counselor_id') || 'admin';
      const isIsolated = localStorage.getItem('bk_database_mode') === 'isolated';

      keysToExport.forEach(key => {
        if (isIsolated && [
          'bk_students', 'bk_violations', 'bk_services', 'bk_logs', 
          'bk_attendance_history', 'bk_parent_summons', 'bk_daily_journals', 'bk_home_visits'
        ].includes(key)) {
          const isolatedKey = `${key}_${activeCounselorId}`;
          backupData[isolatedKey] = localStorage.getItem(isolatedKey);
        } else {
          backupData[key] = localStorage.getItem(key);
        }
      });

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Backup_Database_BK_${activeCounselorId}_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (error) {
      alert('Gagal mengekspor database: ' + error);
    }
  };

  const handleImportDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Format berkas backup tidak valid.');
        }
        setImportingData(parsed);
        setShowImportModal(true);
      } catch (err) {
        alert('Gagal memproses berkas backup. Pastikan berkas berformat JSON cadangan yang benar. Error: ' + err);
      }
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = '';
  };

  const handleApplyMergeImport = () => {
    if (!importingData) return;

    try {
      const arrayKeys = [
        'bk_students',
        'bk_violations',
        'bk_services',
        'bk_logs',
        'bk_attendance_history',
        'bk_parent_summons',
        'bk_daily_journals',
        'bk_home_visits'
      ];

      Object.entries(importingData).forEach(([key, value]) => {
        if (value === null || typeof value !== 'string') return;

        // Determine if this key should be handled as isolated
        const baseKey = arrayKeys.find(ak => key === ak || key.startsWith(`${ak}_`));

        if (baseKey) {
          // It is a JSON array that we can merge safely
          try {
            const currentLocalRaw = localStorage.getItem(key) || '[]';
            const currentLocalArr = JSON.parse(currentLocalRaw);
            const importedArr = JSON.parse(value);

            if (Array.isArray(currentLocalArr) && Array.isArray(importedArr)) {
              // Merge based on 'id' key
              const mergedMap = new Map();
              currentLocalArr.forEach(item => {
                if (item && item.id) mergedMap.set(item.id, item);
              });

              importedArr.forEach(item => {
                if (item && item.id) {
                  // If it already exists, merge fields to prevent data loss, otherwise append
                  const existing = mergedMap.get(item.id);
                  if (existing) {
                    mergedMap.set(item.id, { ...existing, ...item });
                  } else {
                    mergedMap.set(item.id, item);
                  }
                }
              });

              const mergedResult = Array.from(mergedMap.values());
              localStorage.setItem(key, JSON.stringify(mergedResult));
            } else {
              // Fallback to direct overwrite if not standard array
              localStorage.setItem(key, value);
            }
          } catch (e) {
            // Fallback to direct overwrite on parse failure
            localStorage.setItem(key, value);
          }
        } else {
          // Configuration or scalar keys: we overwrite to keep synchronized
          localStorage.setItem(key, value);
        }
      });

      alert('🎉 SUKSES GABUNGKAN DATA Cadangan!\n\nSemua data dari berkas cadangan telah sukses digabungkan dengan database lokal Anda saat ini secara aman tanpa menghapus catatan awal.');
      setShowImportModal(false);
      setImportingData(null);
      window.location.reload();
    } catch (err) {
      alert('Gagal menggabungkan database: ' + err);
    }
  };

  const handleApplyOverwriteImport = () => {
    if (!importingData) return;

    try {
      Object.entries(importingData).forEach(([key, value]) => {
        if (value !== null && typeof value === 'string') {
          localStorage.setItem(key, value);
        }
      });

      alert('🎉 SUKSES TULIS ULANG DATABASE!\n\nSeluruh database saat ini telah ditimpa penuh dengan isi berkas cadangan.');
      setShowImportModal(false);
      setImportingData(null);
      window.location.reload();
    } catch (err) {
      alert('Gagal memulihkan database: ' + err);
    }
  };

  const defaultWaliKelasList: WaliKelasConfig[] = [
    { class: 'Kelas 7A', name: 'Ibu Nona Marlina, S.Pd.', email: 'wali.kelas.7a@smpn2susukan.sch.id', phone: '081234567801' },
    { class: 'Kelas 7B', name: 'Bapak Budi Santoso, S.Pd.', email: 'wali.kelas.7b@smpn2susukan.sch.id', phone: '081234567802' },
    { class: 'Kelas 7C', name: 'Ibu Citra Lestari, S.Pd.', email: 'wali.kelas.7c@smpn2susukan.sch.id', phone: '081234567803' },
    { class: 'Kelas 7D', name: 'Ibu Dewi Setyowati, S.Pd.', email: 'wali.kelas.7d@smpn2susukan.sch.id', phone: '081234567804' },
    { class: 'Kelas 7E', name: 'Bapak Eko Prasetyo, S.Pd.', email: 'wali.kelas.7e@smpn2susukan.sch.id', phone: '081234567805' },
    { class: 'Kelas 7F', name: 'Ibu Farida Asri, S.Pd.', email: 'wali.kelas.7f@smpn2susukan.sch.id', phone: '081234567806' },
    { class: 'Kelas 8A', name: 'Ibu Aulia Aji Sasongko, S.Pd.', email: 'wali.kelas.8a@smpn2susukan.sch.id', phone: '081234567807' },
    { class: 'Kelas 8B', name: 'Bapak Heri Wibowo, S.Pd.', email: 'wali.kelas.8b@smpn2susukan.sch.id', phone: '081234567808' },
    { class: 'Kelas 8C', name: 'Ibu Indah Permata, S.Pd.', email: 'wali.kelas.8c@smpn2susukan.sch.id', phone: '081234567809' },
    { class: 'Kelas 8D', name: 'Ibu Joko Susilo, S.Pd.', email: 'wali.kelas.8d@smpn2susukan.sch.id', phone: '081234567810' },
    { class: 'Kelas 8E', name: 'Bapak Kusuma Wijaya, S.Pd.', email: 'wali.kelas.8e@smpn2susukan.sch.id', phone: '081234567811' },
    { class: 'Kelas 8F', name: 'Ibu Lilis Handayani, S.Pd.', email: 'wali.kelas.8f@smpn2susukan.sch.id', phone: '081234567812' },
    { class: 'Kelas 8G', name: 'Bapak Mujiyono, S.Pd.', email: 'wali.kelas.8g@smpn2susukan.sch.id', phone: '081234567813' },
    { class: 'Kelas 9A', name: 'Ibu Tri Handayani, S.Pd.', email: 'wali.kelas.9a@smpn2susukan.sch.id', phone: '081234567814' },
    { class: 'Kelas 9B', name: 'Bapak Nurdin, S.Pd.', email: 'wali.kelas.9b@smpn2susukan.sch.id', phone: '081234567815' },
    { class: 'Kelas 9C', name: 'Ibu Oki Rahmawati, S.Pd.', email: 'wali.kelas.9c@smpn2susukan.sch.id', phone: '081234567816' },
    { class: 'Kelas 9D', name: 'Bapak Purwanto, S.Pd.', email: 'wali.kelas.9d@smpn2susukan.sch.id', phone: '081234567817' },
    { class: 'Kelas 9E', name: 'Ibu Qori Lestari, S.Pd.', email: 'wali.kelas.9e@smpn2susukan.sch.id', phone: '081234567818' },
    { class: 'Kelas 9F', name: 'Bapak Roni Wijaya, S.Pd.', email: 'wali.kelas.9f@smpn2susukan.sch.id', phone: '081234567819' },
    { class: 'Kelas 9G', name: 'Ibu Siti Aminah, S.Pd.', email: 'wali.kelas.9g@smpn2susukan.sch.id', phone: '081234567820' },
  ];

  const [waliKelasList, setWaliKelasList] = useState<WaliKelasConfig[]>(() => {
    const saved = localStorage.getItem('bk_walikelas_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return defaultWaliKelasList;
      }
    }
    return defaultWaliKelasList;
  });

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editClass, setEditClass] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const [isAdding, setIsAdding] = useState(false);
  const [newClass, setNewClass] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  const handleSaveThreshold = (newVal: number) => {
    setThreshold(newVal);
    localStorage.setItem('bk_email_threshold', newVal.toString());
  };

  const handleSaveWaliKelasList = (newList: WaliKelasConfig[]) => {
    setWaliKelasList(newList);
    localStorage.setItem('bk_walikelas_config', JSON.stringify(newList));
    window.dispatchEvent(new Event('storage'));
  };

  const handleEdit = (index: number) => {
    const item = waliKelasList[index];
    setEditingIndex(index);
    setEditClass(item.class);
    setEditName(item.name);
    setEditEmail(item.email);
    setEditPhone(item.phone || '');
  };

  const handleSaveEdit = (index: number) => {
    if (!editClass.trim() || !editName.trim() || !editEmail.trim()) {
      alert('Semua data wajib diisi!');
      return;
    }
    const updated = [...waliKelasList];
    updated[index] = {
      class: editClass.trim(),
      name: editName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim()
    };
    handleSaveWaliKelasList(updated);
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data wali kelas untuk ${waliKelasList[index].class}?`)) {
      const updated = waliKelasList.filter((_, i) => i !== index);
      handleSaveWaliKelasList(updated);
    }
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.trim() || !newName.trim() || !newEmail.trim()) {
      alert('Semua data wajib diisi!');
      return;
    }
    const exists = waliKelasList.some(item => item.class.toLowerCase() === newClass.trim().toLowerCase());
    if (exists) {
      alert(`Wali kelas untuk ${newClass} sudah terdaftar!`);
      return;
    }
    const updated = [
      ...waliKelasList,
      {
        class: newClass.trim(),
        name: newName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim()
      }
    ].sort((a, b) => a.class.localeCompare(b.class));

    handleSaveWaliKelasList(updated);
    setIsAdding(false);
    setNewClass('');
    setNewName('');
    setNewEmail('');
    setNewPhone('');
  };

  const handleResetWaliKelas = () => {
    if (confirm('Apakah Anda yakin ingin menyetel ulang seluruh data Wali Kelas dan email ke pengaturan bawaan SMP N 2 Susukan?')) {
      handleSaveWaliKelasList(defaultWaliKelasList);
      handleSaveThreshold(20);
    }
  };

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [hasCustomSchoolLogo, setHasCustomSchoolLogo] = useState(false);
  const [hasCustomKabupatenLogo, setHasCustomKabupatenLogo] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  // Load existing config
  useEffect(() => {
    const current = getSchoolConfig();
    setConfig(current);

    const checkCustomLogos = () => {
      setHasCustomSchoolLogo(!!localStorage.getItem('bk_custom_school_logo'));
      setHasCustomKabupatenLogo(!!localStorage.getItem('bk_custom_kabupaten_logo'));
    };

    checkCustomLogos();
    window.addEventListener('logo-update', checkCustomLogos);
    window.addEventListener('bk_school_config_updated', () => {
      setConfig(getSchoolConfig());
    });
    return () => {
      window.removeEventListener('logo-update', checkCustomLogos);
    };
  }, []);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    key: 'bk_custom_school_logo' | 'bk_custom_kabupaten_logo',
    label: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match('image/jpeg') && !file.type.match('image/png') && !file.type.match('image/jpg')) {
      alert('Format file tidak didukung. Silakan unggah file gambar berformat JPG, JPEG, atau PNG.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Optimize logo sizes to max 250px to protect localStorage quota & guarantee PDF compilation speed
        const maxDim = 250;
        let width = img.width;
        let height = img.height;

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
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const isPng = file.type.toLowerCase().includes('png');
          const base64 = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : 0.85);
          localStorage.setItem(key, base64);
          
          // Dispatch notifications for other components
          window.dispatchEvent(new Event('logo-update'));
          window.dispatchEvent(new Event('storage'));

          setUploadFeedback(`Berhasil mengunggah ${label}!`);
          setTimeout(() => setUploadFeedback(null), 3000);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleClearLogo = (key: 'bk_custom_school_logo' | 'bk_custom_kabupaten_logo', label: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus custom ${label} dan kembali menggunakan logo default?`)) {
      localStorage.removeItem(key);
      window.dispatchEvent(new Event('logo-update'));
      window.dispatchEvent(new Event('storage'));
      
      setUploadFeedback(`${label} dikembalikan ke bawaan sistem.`);
      setTimeout(() => setUploadFeedback(null), 3000);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSchoolConfig(config);
    
    // Dispatch events so sidebar, headers, and pdf generators know config updated
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('bk_school_config_updated'));
    window.dispatchEvent(new Event('logo-update'));
    
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 3000);
  };

  const handleReset = () => {
    if (confirm('Apakah Anda yakin ingin mengembalikan pengaturan ke default sekolah SMP N 2 Susukan?')) {
      resetSchoolConfigToDefault();
      const defaultConfig = getSchoolConfig('sch_20320123');
      setConfig(defaultConfig);
      
      window.dispatchEvent(new Event('logo-update'));
      window.dispatchEvent(new Event('storage'));
      
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
      }, 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300" id="pengaturan-view-container">
      <div>
        <h2 className="text-2xl font-extrabold text-[#0b1c30]">Pengaturan Sistem & Wali Kelas</h2>
        <p className="text-sm text-[#3d4947]/70 font-semibold mt-0.5">
          Atur identitas sekolah, unggah logo kop surat, serta kelola nama dan alamat email Wali Kelas untuk otomatisasi notifikasi pelanggaran.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto pb-0.5" id="tabs-container">
        {/* Profil Tab for everyone */}
        <button
          type="button"
          onClick={() => setActiveTab('profil')}
          className={`pb-3 px-4 text-xs sm:text-sm font-extrabold transition-all border-b-2 cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === 'profil'
              ? 'border-[#00685f] text-[#00685f]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <User className="w-4 h-4" />
          <span>{isUserAdmin ? 'Profil Saya' : 'Profil & Akun Saya'}</span>
        </button>

        {isUserAdmin ? (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('akses')}
              className={`pb-3 px-4 text-xs sm:text-sm font-extrabold transition-all border-b-2 cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeTab === 'akses'
                  ? 'border-[#00685f] text-[#00685f]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Hak Akses & Pengguna ({allCounselors.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('identitas')}
              className={`pb-3 px-4 text-xs sm:text-sm font-extrabold transition-all border-b-2 cursor-pointer shrink-0 ${
                activeTab === 'identitas'
                  ? 'border-[#00685f] text-[#00685f]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Identitas & Logo Sekolah
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('walikelas')}
              className={`pb-3 px-4 text-xs sm:text-sm font-extrabold transition-all border-b-2 cursor-pointer shrink-0 ${
                activeTab === 'walikelas'
                  ? 'border-[#00685f] text-[#00685f]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Wali Kelas & Email ({waliKelasList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('database')}
              className={`pb-3 px-4 text-xs sm:text-sm font-extrabold transition-all border-b-2 cursor-pointer shrink-0 ${
                activeTab === 'database'
                  ? 'border-[#00685f] text-[#00685f]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Opsi Multi-Akun & Database
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('otomatisasi')}
              className={`pb-3 px-4 text-xs sm:text-sm font-extrabold transition-all border-b-2 cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeTab === 'otomatisasi'
                  ? 'border-[#00685f] text-[#00685f]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#00685f]" />
              <span>Otomatisasi Jurnal</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('otomatisasi')}
              className={`pb-3 px-4 text-xs sm:text-sm font-extrabold transition-all border-b-2 cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeTab === 'otomatisasi'
                  ? 'border-[#00685f] text-[#00685f]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#00685f]" />
              <span>Otomatisasi Jurnal BK</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('database-personal')}
              className={`pb-3 px-4 text-xs sm:text-sm font-extrabold transition-all border-b-2 cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeTab === 'database-personal'
                  ? 'border-[#00685f] text-[#00685f]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Database className="w-4 h-4 text-teal-600" />
              <span>Ekspor & Cadangan Data Saya</span>
            </button>
          </>
        )}
      </div>

      {/* Access Denied Guard for Non-Admins attempting to access Admin-Only Tabs */}
      {!isUserAdmin && ['identitas', 'walikelas', 'database', 'akses'].includes(activeTab) && (
        <div className="bg-white rounded-2xl p-8 border border-amber-200/80 shadow-sm text-center space-y-4 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-[#0b1c30]">Hak Akses Konfigurasi Terbatas</h3>
            <p className="text-xs text-[#3d4947] max-w-md mx-auto leading-relaxed">
              Pengaturan sistem sekolah dan hak akses akun dikelola langsung oleh <strong>Administrator Utama (Bapak Aulia Aji Sasongko)</strong>. Akun Anda (<strong>{activeCounselor?.name}</strong>) memiliki wewenang operasional untuk mendampingi siswa kelas: <span className="font-bold text-[#00685f]">{activeCounselor?.allowedClasses.join(', ') || 'Semua Kelas'}</span>.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('profil')}
              className="px-5 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
            >
              Buka Profil & Akun Saya
            </button>
          </div>
        </div>
      )}

      {/* TAB: Profil Saya (Available to all users) */}
      {activeTab === 'profil' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2">
                  <User className="w-5 h-5 text-[#00685f]" />
                  <span>Profil & Kredensial Akun Saya</span>
                </h3>
                <p className="text-xs text-[#3d4947] mt-0.5">
                  Kelola data pribadi, kontak, dan perbarui kata sandi akun Anda untuk masuk ke sistem BK.
                </p>
              </div>

              {isUserAdmin ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black bg-purple-100 text-purple-800 px-3 py-1 rounded-full uppercase border border-purple-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Administrator (Akses Penuh)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black bg-teal-100 text-teal-800 px-3 py-1 rounded-full uppercase border border-teal-200">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Guru Pembimbing Kelas</span>
                </span>
              )}
            </div>

            {profileSaved && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Profil dan kredensial akun Anda berhasil disimpan!</span>
              </div>
            )}

            <form onSubmit={handleSavePersonalProfile} className="space-y-5">
              {/* Profile Card Summary */}
              <div className="p-4 bg-slate-50 border border-gray-200/80 rounded-2xl flex flex-wrap items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#00685f]/30 bg-gray-100 flex items-center justify-center shrink-0">
                  {activeCounselor?.avatar ? (
                    <img referrerPolicy="no-referrer" src={activeCounselor.avatar} alt={profileName} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div className="space-y-0.5 flex-1 min-w-[200px]">
                  <p className="font-extrabold text-sm text-[#0b1c30]">{profileName || 'Nama Belum Diisi'}</p>
                  <p className="text-xs text-gray-600 font-semibold">{profileRole || 'Guru Pembimbing BK'}</p>
                  <p className="text-[11px] text-gray-500 font-medium">NIP: {profileNip || '-'}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-200 shrink-0 text-right min-w-[160px]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Hak Akses Kelas</p>
                  <p className="text-xs font-bold text-[#00685f] mt-0.5">
                    {isUserAdmin ? 'Semua Kelas (7, 8, 9)' : (activeCounselor?.allowedClasses.join(', ') || 'Semua Kelas')}
                  </p>
                </div>
              </div>

              {/* Form Input Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Nama Lengkap & Gelar
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f] focus:border-[#00685f] bg-white font-semibold"
                    placeholder="Masukkan nama lengkap & gelar"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Nomor Induk Pegawai (NIP)
                  </label>
                  <input
                    type="text"
                    value={profileNip}
                    onChange={(e) => setProfileNip(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f] focus:border-[#00685f] bg-white font-semibold"
                    placeholder="Contoh: NIP. 1993..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Jabatan / Peran BK
                  </label>
                  <input
                    type="text"
                    value={profileRole}
                    onChange={(e) => setProfileRole(e.target.value)}
                    disabled={!isUserAdmin}
                    className={`w-full text-xs p-2.5 border border-gray-300 rounded-xl bg-white font-semibold ${
                      !isUserAdmin ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:ring-2 focus:ring-[#00685f]'
                    }`}
                  />
                  {!isUserAdmin && (
                    <p className="text-[10px] text-gray-400 mt-1">Jabatan diatur oleh Administrator Utama.</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Email Akun (Google / Belajar.id)
                  </label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f] focus:border-[#00685f] bg-white font-semibold"
                    placeholder="email@guru.smp.belajar.id"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Nomor WhatsApp / Telepon
                  </label>
                  <input
                    type="text"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f] focus:border-[#00685f] bg-white font-semibold"
                    placeholder="08123456789"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Kata Sandi / PIN Masuk Akun
                  </label>
                  <div className="relative">
                    <input
                      type={showMyPassword ? 'text' : 'password'}
                      value={profilePassword}
                      onChange={(e) => setProfilePassword(e.target.value)}
                      className="w-full text-xs p-2.5 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00685f] focus:border-[#00685f] bg-white font-semibold font-mono"
                      placeholder="Masukkan kata sandi baru"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMyPassword(!showMyPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showMyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Gunakan kata sandi yang mudah Anda ingat saat login.</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan Profil</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB: Personal Data Backup (For Non-Admin) */}
      {activeTab === 'database-personal' && !isUserAdmin && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-6">
            <div className="pb-3 border-b border-gray-100">
              <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2">
                <Database className="w-4.5 h-4.5 text-[#00685f]" />
                <span>Pencadangan & Ekspor Data Saya</span>
              </h3>
              <p className="text-xs text-[#3d4947] mt-1">
                Unduh salinan cadangan data aktivitas bimbingan dan jurnal Anda untuk arsip pribadi.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-200/60 space-y-3">
                <h4 className="font-extrabold text-xs text-[#0b1c30] flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#00685f]" />
                  <span>Cadangkan Catatan Konseling & Jurnal</span>
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed font-medium">
                  Unduh seluruh riwayat layanan BK dan rekap jurnal harian yang telah Anda input ke komputer dalam format berkas JSON terenkripsi.
                </p>
                <button
                  type="button"
                  onClick={handleExportDatabase}
                  className="w-full py-2.5 px-3 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh File Cadangan JSON</span>
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200/80 space-y-3">
                <h4 className="font-extrabold text-xs text-[#0b1c30] flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#00685f]" />
                  <span>Status Sinkronisasi Cloud</span>
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed font-medium">
                  Aplikasi BK SMP N 2 Susukan tersinkronisasi secara realtime dengan database Firestore dan penyimpanan lokal peramban Anda.
                </p>
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-[11px] font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Database Online Tersinkronisasi Aktif</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Tab: Identitas */}
      {isUserAdmin && activeTab === 'identitas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          {/* Left Side: Logo Preview & Upload Section (4 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-6">
              <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2 pb-2 border-b border-gray-100">
                <ImageIcon className="w-4.5 h-4.5 text-[#00685f]" />
                <span>Daftar Logo Kop Surat</span>
              </h3>

              {/* Notification Feedback */}
              {uploadFeedback && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{uploadFeedback}</span>
                </div>
              )}

              {/* Logo 1: Logo Kabupaten */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/60 space-y-3.5">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-xs text-gray-700">1. Logo Kabupaten (Kop Kiri)</h4>
                    <p className="text-[10px] text-gray-500 font-medium">Format JPG/PNG • Maks 5MB (Kompres otomatis)</p>
                  </div>
                  {hasCustomKabupatenLogo ? (
                    <span className="text-[9px] font-extrabold bg-[#00685f]/10 text-[#00685f] px-2 py-0.5 rounded-full uppercase">Kustom</span>
                  ) : (
                    <span className="text-[9px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full uppercase">Bawaan</span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <KabupatenLogo size={70} className="shrink-0 border shadow-sm bg-white" />
                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-97">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah JPG</span>
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/jpg" 
                        onChange={(e) => handleImageUpload(e, 'bk_custom_kabupaten_logo', 'Logo Kabupaten')} 
                        className="hidden" 
                      />
                    </label>
                    
                    {hasCustomKabupatenLogo && (
                      <button
                        type="button"
                        onClick={() => handleClearLogo('bk_custom_kabupaten_logo', 'Logo Kabupaten')}
                        className="ml-2 inline-flex items-center gap-1 px-2.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-colors"
                        title="Kembalikan ke Default"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Logo 2: Logo Sekolah */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/60 space-y-3.5">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-xs text-gray-700">2. Logo Sekolah (Kop Kanan)</h4>
                    <p className="text-[10px] text-gray-500 font-medium">Format JPG/PNG • Maks 5MB (Kompres otomatis)</p>
                  </div>
                  {hasCustomSchoolLogo ? (
                    <span className="text-[9px] font-extrabold bg-[#00685f]/10 text-[#00685f] px-2 py-0.5 rounded-full uppercase">Kustom</span>
                  ) : (
                    <span className="text-[9px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full uppercase">Bawaan</span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <SchoolLogo size={70} className="shrink-0 border shadow-sm" />
                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-97">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah JPG</span>
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/jpg" 
                        onChange={(e) => handleImageUpload(e, 'bk_custom_school_logo', 'Logo Sekolah')} 
                        className="hidden" 
                      />
                    </label>

                    {hasCustomSchoolLogo && (
                      <button
                        type="button"
                        onClick={() => handleClearLogo('bk_custom_school_logo', 'Logo Sekolah')}
                        className="ml-2 inline-flex items-center gap-1 px-2.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-colors"
                        title="Kembalikan ke Default"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Note alert */}
              <div className="pt-2 text-[11px] leading-relaxed text-amber-800 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/40 font-semibold space-y-1">
                <div className="flex gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Catatan Desain:</strong> Logo yang Anda unggah akan secara otomatis disinkronkan di sidebar, header, serta disematkan pada kop surat berkas PDF (Siswa, Layanan, Absensi) demi dokumen yang seragam dan profesional.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Identity Form Card (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-5">
            {/* Guidance Banner for Multi-School Customization */}
            <div className="p-4 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-[#00685f] font-black text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Fleksibilitas Lintas Sekolah (Multi-Sekolah)</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed font-medium">
                Aplikasi ini bersifat fleksibel dan dapat digunakan oleh <strong>Guru BK dari sekolah lain mana pun</strong> (SMP/MTs, SMA/MA, SMK, SD). Isikan nama sekolah, dinas, alamat, nama kepala sekolah, dan NIP Anda di bawah ini, lalu klik <strong>Simpan Pengaturan</strong>. Semua kop surat, surat panggilan, home visit, cetakan PDF, dan sidebar akan otomatis menyesuaikan identitas sekolah Anda!
              </p>

              {/* Quick Template Switcher */}
              <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-teal-200/60">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Isi Cepat Contoh Sekolah:</span>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      governmentName: 'PEMERINTAH PROVINSI JAWA TENGAH',
                      departmentName: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
                      schoolName: 'SMA NEGERI 1 KOTA SEMARANG',
                      schoolAddress: 'Jl. Menteri Supeno No. 1, Mugassari, Kec. Semarang Selatan, Kota Semarang 50249',
                      principalName: 'Dra. Endang Sulastri, M.Pd.',
                      principalNip: '19670515 199203 2 004',
                    })
                  }
                  className="px-2.5 py-1 bg-white hover:bg-teal-100 text-[#00685f] border border-teal-300 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer"
                >
                  🏫 Contoh SMA
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      governmentName: 'PEMERINTAH PROVINSI JAWA TENGAH',
                      departmentName: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
                      schoolName: 'SMK NEGERI 2 SURAKARTA',
                      schoolAddress: 'Jl. PU. Mangkubumen, Banjarsari, Kota Surakarta, Jawa Tengah 57139',
                      principalName: 'Drs. Bambang Haryono, S.T., M.T.',
                      principalNip: '19710812 199802 1 003',
                    })
                  }
                  className="px-2.5 py-1 bg-white hover:bg-teal-100 text-[#00685f] border border-teal-300 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer"
                >
                  🏫 Contoh SMK
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      governmentName: 'KEMENTERIAN AGAMA REPUBLIK INDONESIA',
                      departmentName: 'KANTOR KEMENTERIAN AGAMA KABUPATEN SEMARANG',
                      schoolName: 'MTs NEGERI 1 SEMARANG',
                      schoolAddress: 'Jl. Raya Suruh-Karanggede Km. 1, Suruh, Kab. Semarang',
                      principalName: 'H. Muhammad Ridwan, S.Ag., M.Pd.I.',
                      principalNip: '19750310 200112 1 002',
                    })
                  }
                  className="px-2.5 py-1 bg-white hover:bg-teal-100 text-[#00685f] border border-teal-300 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer"
                >
                  🕌 Contoh MTs / MA
                </button>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-4">
                {/* Government Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    Instansi Pemerintah / Pemerintah Daerah (Kop Baris 1)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <Building className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={config.governmentName}
                      onChange={(e) => setConfig({ ...config, governmentName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all font-semibold"
                      placeholder="Contoh: PEMERINTAH KABUPATEN SEMARANG"
                    />
                  </div>
                </div>

                {/* Department Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    Dinas Terkait (Kop Baris 2)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <Building className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={config.departmentName}
                      onChange={(e) => setConfig({ ...config, departmentName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all font-semibold"
                      placeholder="Contoh: DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA"
                    />
                  </div>
                </div>

                {/* School Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    Nama Sekolah (Kop Baris 3)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <Building className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={config.schoolName}
                      onChange={(e) => setConfig({ ...config, schoolName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all font-bold"
                      placeholder="Contoh: SMP N 2 Susukan"
                    />
                  </div>
                </div>

                {/* School Address Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    Alamat Lengkap Sekolah
                  </label>
                  <div className="relative">
                    <span className="absolute top-3 left-0 pl-3 flex items-start text-gray-400">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <textarea
                      required
                      rows={3}
                      value={config.schoolAddress}
                      onChange={(e) => setConfig({ ...config, schoolAddress: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all"
                      placeholder="Tuliskan jalan, kecamatan, kabupaten, dan kode pos"
                    />
                  </div>
                </div>

                {/* Principal Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    Nama Kepala Sekolah
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={config.principalName}
                      onChange={(e) => setConfig({ ...config, principalName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all"
                      placeholder="Contoh: Drs. H. Suhardi, M.Pd."
                    />
                  </div>
                </div>

                {/* Principal NIP Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    NIP Kepala Sekolah
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={config.principalNip}
                      onChange={(e) => setConfig({ ...config, principalNip: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all"
                      placeholder="Contoh: 19680320 199403 1 005"
                    />
                  </div>
                </div>
              </div>

              {savedSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold animate-in fade-in slide-in-from-top-1">
                  Berhasil menyimpan pengaturan identitas sekolah! Data cetak PDF kini diperbarui secara real-time.
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-sm font-bold transition-all shadow-md cursor-pointer active:scale-97"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
                
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold transition-all cursor-pointer"
                  title="Reset ke Default"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">Reset Default</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isUserAdmin && activeTab === 'walikelas' && (
        <div className="space-y-6 animate-in fade-in duration-200" id="walikelas-tab-container">
          {/* Email Notification Settings Banner/Card */}
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-8 space-y-2">
              <h3 className="font-extrabold text-[#0b1c30] flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#00685f]" />
                <span>Atur Ambang Batas Eskalasi Dukungan Karakter</span>
              </h3>
              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                Tentukan jumlah akumulasi bobot pembinaan perilaku minimal yang akan memicu pengiriman draft email pendampingan kesiswaan otomatis ke Wali Kelas yang bersangkutan.
              </p>
            </div>
            <div className="md:col-span-4 flex items-center gap-3 justify-end">
              <label className="text-xs font-bold text-gray-700 uppercase shrink-0">Minimal Bobot:</label>
              <input
                type="number"
                min={1}
                max={250}
                value={threshold}
                onChange={(e) => handleSaveThreshold(parseInt(e.target.value) || 20)}
                className="w-24 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-center font-bold text-sm text-[#00685f] focus:outline-none focus:ring-2 focus:ring-[#00685f]"
              />
              <span className="text-xs text-gray-500 font-semibold">Bobot</span>
            </div>
          </div>

          {/* Wali Kelas Management Section */}
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2">
                  <Users className="w-4.5 h-4.5 text-[#00685f]" />
                  <span>Daftar Wali Kelas SMP N 2 Susukan</span>
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">Hubungkan nama kelas dengan nama wali kelas serta alamat email aktif.</p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleResetWaliKelas}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  title="Kembalikan semua wali kelas ke default SMP N 2 Susukan"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Bawaan</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setIsAdding(!isAdding)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  {isAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{isAdding ? 'Batal' : 'Tambah Wali Kelas'}</span>
                </button>
              </div>
            </div>

            {/* Add New Wali Kelas Form Panel */}
            {isAdding && (
              <form onSubmit={handleAddNew} className="bg-gray-50 rounded-xl p-5 border border-gray-200/80 grid grid-cols-1 md:grid-cols-12 gap-4 animate-in slide-in-from-top-2 duration-200">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-700 block uppercase tracking-wider">Nama Kelas</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kelas 7A"
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00685f] font-semibold"
                  />
                </div>
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-700 block uppercase tracking-wider">Nama Wali Kelas & Gelar</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ibu Nona Marlina, S.Pd."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-700 block uppercase tracking-wider">Alamat Email Wali Kelas</label>
                  <input
                    type="email"
                    required
                    placeholder="Contoh: wali.kelas.7a@smpn2susukan.sch.id"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-700 block uppercase tracking-wider">No. HP / WA</label>
                  <input
                    type="text"
                    placeholder="Contoh: 081234567801"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00685f]"
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Simpan Baru
                  </button>
                </div>
              </form>
            )}

            {/* Filter Search Bar */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Cari kelas, nama wali kelas atau email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#00685f] font-semibold"
              />
            </div>

            {/* Table of Wali Kelas */}
            <div className="overflow-x-auto rounded-xl border border-gray-200/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 font-extrabold uppercase border-b border-gray-200 tracking-wider">
                    <th className="px-4 py-3 w-1/5">Kelas</th>
                    <th className="px-4 py-3 w-1/4">Wali Kelas</th>
                    <th className="px-4 py-3 w-1/4">Email Notifikasi</th>
                    <th className="px-4 py-3 w-1/5">No. HP / WA</th>
                    <th className="px-4 py-3 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {waliKelasList
                    .filter(item => 
                      item.class.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (item.phone && item.phone.includes(searchQuery))
                    )
                    .map((item, index) => {
                      const isEditing = editingIndex === index;
                      return (
                        <tr key={index} className={`hover:bg-gray-50/50 transition-colors ${isEditing ? 'bg-amber-50/20' : ''}`}>
                          {isEditing ? (
                            <>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={editClass}
                                  onChange={(e) => setEditClass(e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white font-bold"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="email"
                                  value={editEmail}
                                  onChange={(e) => setEditEmail(e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={editPhone}
                                  onChange={(e) => setEditPhone(e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white"
                                  placeholder="Contoh: 081234567801"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(index)}
                                    className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded"
                                    title="Simpan"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingIndex(null)}
                                    className="p-1 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded"
                                    title="Batal"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-bold text-gray-900">{item.class}</td>
                              <td className="px-4 py-3 text-gray-800">{item.name}</td>
                              <td className="px-4 py-3 font-mono text-[11px] text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  <span>{item.email}</span>
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-[11px] text-gray-500">
                                <span className="flex items-center gap-1">
                                  <span className="text-emerald-600 font-bold px-1 bg-emerald-50 rounded text-[9px] mr-1">WA</span>
                                  <span>{item.phone || '-'}</span>
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(index)}
                                    className="p-1 hover:bg-gray-100 text-gray-500 hover:text-gray-800 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(index)}
                                    className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition-colors"
                                    title="Hapus"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  {waliKelasList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400 font-semibold">
                        Belum ada wali kelas terdaftar. Tekan tombol &quot;Reset Bawaan&quot; atau &quot;Tambah Wali Kelas&quot; untuk memulai.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Alert Banner */}
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/40 flex gap-3 text-xs text-emerald-800 font-semibold">
              <Info className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Alur Kerja Sistem Otomatis:</strong> Setiap kali kasus baru dicatat untuk siswa yang membuat total akumulasi bobot pembinaannya menyentuh atau melebihi batas <strong>{threshold} bobot</strong>, sistem akan secara otomatis memicu draf surat elektronik bimbingan konseling/pendampingan karakter yang siap dikirimkan secara instan ke email Wali Kelas di atas.
              </p>
            </div>
          </div>
        </div>
      )}

      {isUserAdmin && activeTab === 'database' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Card Penjelasan Utama */}
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-6">
            <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2 pb-2 border-b border-gray-100">
              <Users className="w-4.5 h-4.5 text-[#00685f]" />
              <span>Solusi Penggunaan Bersama Rekan Sejawat (3 Guru BK)</span>
            </h3>

            <p className="text-xs text-[#3d4947] leading-relaxed">
              Sistem Informasi BK & E-Rapor SMP Negeri 2 Susukan didesain untuk mendukung fleksibilitas kolaborasi bimbingan konseling secara terintegrasi maupun mandiri. Berikut adalah pilihan konfigurasi terbaik untuk Anda dan 2 rekan sejawat BK lainnya:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card Opsi A */}
              <div className="p-4 bg-[#f8fafa] rounded-xl border border-gray-100 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-50 text-[#00685f] text-[11px] font-bold flex items-center justify-center border border-[#00685f]/20">A</span>
                  <h4 className="font-extrabold text-xs text-[#0b1c30]">Berbeda Laptop / Perangkat (Sangat Direkomendasikan)</h4>
                </div>
                <p className="text-[11px] text-[#3d4947]/85 leading-relaxed">
                  Karena aplikasi ini berjalan langsung pada browser, maka membuka aplikasi di laptop/perangkat pribadi masing-masing otomatis akan membuat database lokal yang terpisah secara alami di browser tersebut. 
                </p>
                <p className="text-[11px] text-[#3d4947]/85 leading-relaxed font-bold">
                  Setiap Guru BK hanya perlu masuk ke menu &quot;Integrasi Google&quot; dan menyinkronkan dengan akun Google & file Spreadsheet pribadinya masing-masing!
                </p>
              </div>

              {/* Card Opsi B */}
              <div className="p-4 bg-[#f8fafa] rounded-xl border border-gray-100 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-50 text-[#00685f] text-[11px] font-bold flex items-center justify-center border border-[#00685f]/20">B</span>
                  <h4 className="font-extrabold text-xs text-[#0b1c30]">Berbagi Browser / Perangkat yang Sama</h4>
                </div>
                <p className="text-[11px] text-[#3d4947]/85 leading-relaxed">
                  Jika Anda dan rekan sejawat bergantian menggunakan satu laptop/komputer yang sama, Anda dapat mengaktifkan fitur <strong>Isolasi Database (Database Mandiri per Akun)</strong> di bawah ini.
                </p>
                <p className="text-[11px] text-[#3d4947]/85 leading-relaxed font-bold">
                  Sistem akan mengisolasi ruang penyimpanan localStorage berdasarkan Akun Konselor yang sedang aktif sehingga data Anda tidak akan tercampur!
                </p>
              </div>
            </div>
          </div>

          {/* Status Database Realtime Cloud (Firebase Firestore) */}
          <div className="bg-gradient-to-r from-emerald-900 to-[#00685f] text-white rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/15">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl text-emerald-300">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                    <span>Database Cloud Realtime (Firebase Firestore)</span>
                  </h3>
                  <p className="text-[11px] text-emerald-100/80">
                    Sinkronisasi otomatis tanpa perlu ekspor/impor manual
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 rounded-full text-[10px] font-extrabold uppercase tracking-wide">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                Cloud Realtime Aktif
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-white/10 p-3.5 rounded-xl border border-white/10 space-y-1">
                <p className="font-extrabold text-emerald-200 text-[11px]">⚡ Otomatis Realtime</p>
                <p className="text-[11px] text-emerald-50/80 leading-relaxed">
                  Setiap kali menambah/mengedit siswa, pelanggaran, bimbingan, atau jurnal, data langsung tersimpan secara live.
                </p>
              </div>
              <div className="bg-white/10 p-3.5 rounded-xl border border-white/10 space-y-1">
                <p className="font-extrabold text-emerald-200 text-[11px]">🔒 Bebas Tertimpa</p>
                <p className="text-[11px] text-emerald-50/80 leading-relaxed">
                  Sistem Cloud Firestore menyimpan setiap dokumen secara mandiri sehingga risiko data terhapus atau tertimpa sangat minim.
                </p>
              </div>
              <div className="bg-white/10 p-3.5 rounded-xl border border-white/10 space-y-1">
                <p className="font-extrabold text-emerald-200 text-[11px]">📱 Multi-Perangkat</p>
                <p className="text-[11px] text-emerald-50/80 leading-relaxed">
                  Sekali login di laptop atau HP mana pun, data langsung terhubung otomatis tanpa harus ekspor/impor JSON lagi.
                </p>
              </div>
            </div>
          </div>

          {/* Pengaturan Mode Database */}
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2">
                <Database className="w-4.5 h-4.5 text-[#00685f]" />
                <span>Mode Penyimpanan Database Lokal</span>
              </h3>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                dbMode === 'isolated' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                  : 'bg-amber-50 text-amber-700 border border-amber-100'
              }`}>
                {dbMode === 'isolated' ? 'Isolasi Akun Aktif' : 'Database Bersama (Shared)'}
              </span>
            </div>

            <p className="text-xs text-[#3d4947]/80 leading-relaxed">
              Pilih mode penyimpanan yang sesuai dengan kebutuhan operasional BK di SMP Negeri 2 Susukan:
            </p>

            <div className="space-y-3">
              {/* Mode Bersama */}
              <button
                type="button"
                onClick={() => handleToggleDbMode('shared')}
                className={`w-full text-left p-4 rounded-xl border transition-all flex gap-3 cursor-pointer items-start ${
                  dbMode === 'shared'
                    ? 'bg-[#00685f]/5 border-[#00685f] ring-1 ring-[#00685f]/20'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <Layers className={`w-5 h-5 mt-0.5 shrink-0 ${dbMode === 'shared' ? 'text-[#00685f]' : 'text-gray-400'}`} />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-[#0b1c30]">Mode Database Bersama (Shared Database)</span>
                    {dbMode === 'shared' && <span className="bg-[#00685f] text-white text-[8px] font-extrabold px-1.5 py-0.2 rounded-full">AKTIF</span>}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Satu database lokal yang sama digunakan bersama-sama oleh semua akun konselor pada browser ini. Data siswa, catatan pelanggaran, dan riwayat bimbingan konseling digabungkan dalam satu wadah global.
                  </p>
                </div>
              </button>

              {/* Mode Isolasi */}
              <button
                type="button"
                onClick={() => handleToggleDbMode('isolated')}
                className={`w-full text-left p-4 rounded-xl border transition-all flex gap-3 cursor-pointer items-start ${
                  dbMode === 'isolated'
                    ? 'bg-[#00685f]/5 border-[#00685f] ring-1 ring-[#00685f]/20'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <Lock className={`w-5 h-5 mt-0.5 shrink-0 ${dbMode === 'isolated' ? 'text-[#00685f]' : 'text-gray-400'}`} />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-[#0b1c30]">Mode Database Mandiri per Akun (Isolated Database)</span>
                    {dbMode === 'isolated' && <span className="bg-[#00685f] text-white text-[8px] font-extrabold px-1.5 py-0.2 rounded-full">AKTIF</span>}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Setiap akun konselor yang masuk (misal: <strong>Aulia</strong>, <strong>Nona</strong>, atau <strong>Tri</strong>) akan memiliki database siswa, pelanggaran, bimbingan, serta pengaturan sinkronisasi Google Sheets yang <strong>100% terpisah secara lokal</strong>. Sangat aman jika bergantian menggunakan satu komputer.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Petunjuk Penyusunan & Sinkronisasi */}
          <div className="bg-[#00685f]/5 rounded-xl border border-[#00685f]/15 p-4 space-y-3">
            <h4 className="font-extrabold text-xs text-[#00685f] flex items-center gap-2">
              <Info className="w-4.5 h-4.5 shrink-0" />
              <span>Panduan Kolaborasi Multi-Konselor (Rekan Sejawat)</span>
            </h4>
            <div className="space-y-2 text-[11px] text-[#3d4947] leading-relaxed">
              <p>
                <strong>1. Pembagian Kelas Bimbingan:</strong> Secara default, aplikasi telah mengonfigurasi hak akses kelas bimbingan masing-masing Guru BK secara presisi:
              </p>
              <ul className="list-disc list-inside pl-2 space-y-1 font-semibold text-gray-700 font-sans">
                <li>Ibu Nona Muanifah, S.Pd. &rarr; Kelas Bimbingan 7</li>
                <li>Bapak Aulia Aji Sasongko, S.Pd. &rarr; Kelas Bimbingan 8</li>
                <li>Ibu Tri Juni Budiastuti, S.Pd. &rarr; Kelas Bimbingan 9</li>
              </ul>
              <p className="mt-2">
                <strong>2. Pengaturan Sinkronisasi Google Sheets:</strong> Jika Anda menggunakan <strong>Mode Database Mandiri per Akun</strong>, setiap kali akun konselor masuk, mereka dapat menautkan akun Google pribadinya di menu <strong>Integrasi Google</strong>. Spreadsheet baru bernama <em>&quot;Database BK Sekolah&quot;</em> akan otomatis dibuat di Google Drive masing-masing konselor, memastikan kedaulatan data tetap aman di akun Google Drive pribadi mereka.
              </p>
            </div>
          </div>

          {/* Pembersihan Data Dummy / Bawaan */}
          <div className="bg-amber-50/50 rounded-2xl p-6 border border-amber-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-amber-900 flex items-center gap-2 pb-2 border-b border-amber-200/60">
              <Trash2 className="w-4.5 h-4.5 text-amber-700" />
              <span>Bersihkan & Hapus Data Bawaan / Dummy</span>
            </h3>
            
            <p className="text-xs text-amber-900/80 leading-relaxed">
              Jika Anda ingin memastikan database benar-benar bersih dari data sampel/dummy bawaan (seperti siswa contoh, pelanggaran sampel, atau jurnal simulasi), tekan tombol di bawah. Sistem akan memindai dan menghapus seluruh data dummy secara permanen dari LocalStorage dan Firestore Cloud Database.
            </p>

            <div className="pt-1">
              <button
                type="button"
                onClick={handlePurgeDummyData}
                disabled={isPurging}
                className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-97"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isPurging ? 'Memproses Pembersihan...' : 'Bersihkan Data Dummy Sekarang'}</span>
              </button>
            </div>
          </div>

          {/* Fitur Backup & Restore Data Manual */}
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2 pb-2 border-b border-gray-100">
              <RefreshCw className="w-4.5 h-4.5 text-[#00685f]" />
              <span>Pencadangan & Pemulihan Data Manual (Backup & Restore)</span>
            </h3>
            
            <p className="text-xs text-[#3d4947]/80 leading-relaxed">
              Untuk mengantisipasi terhapusnya data akibat pembersihan cache browser oleh banyak pengguna, Anda dapat mengunduh seluruh isi database Anda berupa file cadangan <code className="bg-gray-100 px-1 py-0.5 rounded font-mono font-bold text-gray-700">.json</code> ke komputer Anda, serta memulihkannya kapan saja.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={handleExportDatabase}
                className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-97"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File Cadangan (Export JSON)</span>
              </button>
              
              <label className="inline-flex items-center gap-1.5 px-4.5 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-97">
                <Upload className="w-4 h-4 text-gray-500" />
                <span>Pulihkan dari File (Import JSON)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportDatabase}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Konsep Keamanan Database Anti-Penimpaan */}
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2 pb-2 border-b border-gray-100">
              <ShieldAlert className="w-4.5 h-4.5 text-[#ba1a1a]" />
              <span>Konsep Keamanan Database & Pencegahan Penimpaan Data</span>
            </h3>
            
            <p className="text-xs text-[#3d4947]/90 leading-relaxed">
              Ketika sistem digunakan oleh banyak guru secara bersamaan, risiko kehilangan data akibat penimpaan (race conditions) merupakan hal yang sangat kritis. Sistem ini dirancang dengan prinsip-prinsip berikut untuk meminimalkan risiko tersebut:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-red-50/30 rounded-xl border border-red-100 space-y-1">
                <h5 className="font-extrabold text-[#ba1a1a]">1. Isolasi Key Namespace</h5>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Dalam Mode Mandiri, database per konselor diisolasi menggunakan suffix ID unik (<code className="font-mono text-[10px] bg-white px-0.5 border">_counselorId</code>). Hal ini mencegah guru BK A menimpa data siswa guru BK B secara sengaja maupun tidak sengaja pada browser yang sama.
                </p>
              </div>
              <div className="p-3 bg-teal-50/30 rounded-xl border border-teal-100 space-y-1">
                <h5 className="font-extrabold text-[#00685f]">2. Desain Granular (Sub-Koleksi)</h5>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Jika beralih ke cloud (seperti Firestore), data disimpan per dokumen individu (misal: 1 dokumen untuk 1 laporan pelanggaran) alih-alih 1 array besar. Ini menjamin proses tulis mandiri tanpa mengganggu data lain.
                </p>
              </div>
              <div className="p-3 bg-blue-50/30 rounded-xl border border-blue-100 space-y-1">
                <h5 className="font-extrabold text-blue-700">3. Transaksi Atomik Cloud</h5>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Aplikasi ini siap diintegrasikan dengan Firebase Firestore yang mendukung Transaksi Atomik. Transaksi memastikan operasi baca-dan-tulis berjalan utuh atau gagal seluruhnya (all-or-nothing), mencegah tabrakan data.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isUserAdmin && activeTab === 'akses' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Card Penjelasan & Toggles Keamanan */}
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-6">
            <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2 pb-2 border-b border-gray-100">
              <Lock className="w-4.5 h-4.5 text-[#ba1a1a]" />
              <span>Pengaturan Akses & Keamanan Aplikasi</span>
            </h3>

            <p className="text-xs text-[#3d4947] leading-relaxed">
              Sebagai Administrator (Bapak Aulia Aji Sasongko atau pemegang akses penuh), Anda dapat membatasi siapa saja yang berhak membuka dan memasukkan data ke aplikasi ini. Aktifkan fitur keamanan di bawah ini untuk mengunci aplikasi.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Toggle 1: Require Login */}
              <div className="p-4 bg-[#f8fafa] rounded-xl border border-gray-100 flex items-start gap-3">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    id="toggle-require-login"
                    checked={requireLogin}
                    onChange={(e) => handleToggleRequireLogin(e.target.checked)}
                    className="w-4.5 h-4.5 text-[#00685f] focus:ring-[#00685f] border-gray-300 rounded cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="toggle-require-login" className="font-extrabold text-xs text-[#0b1c30] cursor-pointer block">
                    Wajibkan Autentikasi Login (Rekomendasi)
                  </label>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Setiap pengguna wajib memasukkan Username & Password yang terdaftar untuk mengakses dashboard. Jika dimatikan (Bypass Mode), siapa saja dapat langsung masuk.
                  </p>
                  <span className={`inline-block text-[9px] font-extrabold px-2 py-0.2 rounded-full ${requireLogin ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {requireLogin ? 'KEAMANAN AKTIF' : 'PINTU TERBUKA (AKSES BEBAS)'}
                  </span>
                </div>
              </div>

              {/* Toggle 2: Hide Simulation Helpers */}
              <div className="p-4 bg-[#f8fafa] rounded-xl border border-gray-100 flex items-start gap-3">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    id="toggle-hide-helpers"
                    checked={hideSimulations}
                    onChange={(e) => handleToggleHideSimulations(e.target.checked)}
                    className="w-4.5 h-4.5 text-[#00685f] focus:ring-[#00685f] border-gray-300 rounded cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="toggle-hide-helpers" className="font-extrabold text-xs text-[#0b1c30] cursor-pointer block">
                    Sembunyikan Pintasan Akun Simulasi
                  </label>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Sembunyikan kotak bantuan akun di layar login. Pengguna harus mengetikkan username & password secara manual tanpa bantuan klik otomatis.
                  </p>
                  <span className={`inline-block text-[9px] font-extrabold px-2 py-0.2 rounded-full ${hideSimulations ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700'}`}>
                    {hideSimulations ? 'PINTASAN DISEMBUNYIKAN' : 'PINTASAN DITAMPILKAN'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Tambah Pengguna Baru */}
          {isAddingC && (
            <div className="bg-white rounded-2xl p-6 border border-[#00685f]/30 shadow-md space-y-4 animate-in slide-in-from-top-4 duration-200">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <h4 className="font-extrabold text-sm text-[#00685f] flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  <span>Tambah Akun Guru Pembimbing (BK) Baru</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddingC(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Template Cepat */}
              <div className="space-y-1.5 bg-teal-50/50 p-3 rounded-xl border border-teal-100">
                <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider block">
                  ⚡ Isi Otomatis dengan Template Cepat:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyAddPreset('kelas7')}
                    className="px-2.5 py-1 bg-white hover:bg-teal-50 hover:text-[#00685f] border border-teal-200 rounded-lg text-[11px] font-bold transition-all"
                  >
                    🏫 Guru BK Kelas 7
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyAddPreset('kelas8')}
                    className="px-2.5 py-1 bg-white hover:bg-teal-50 hover:text-[#00685f] border border-teal-200 rounded-lg text-[11px] font-bold transition-all"
                  >
                    🏫 Guru BK Kelas 8
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyAddPreset('kelas9')}
                    className="px-2.5 py-1 bg-white hover:bg-teal-50 hover:text-[#00685f] border border-teal-200 rounded-lg text-[11px] font-bold transition-all"
                  >
                    🏫 Guru BK Kelas 9
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyAddPreset('admin')}
                    className="px-2.5 py-1 bg-white hover:bg-teal-50 hover:text-[#00685f] border border-teal-200 rounded-lg text-[11px] font-bold transition-all"
                  >
                    ⭐ Koordinator / Admin BK
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyAddPreset('walikelas')}
                    className="px-2.5 py-1 bg-white hover:bg-teal-50 hover:text-[#00685f] border border-teal-200 rounded-lg text-[11px] font-bold transition-all"
                  >
                    👤 Wali Kelas / Guru Piket
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Nama Lengkap & Gelar</label>
                  <input
                    type="text"
                    value={newCName}
                    onChange={(e) => setNewCName(e.target.value)}
                    placeholder="Contoh: Aulia Aji Sasongko, S.Pd."
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-[#00685f] focus:border-[#00685f]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">NIP (Nomor Induk Pegawai)</label>
                  <input
                    type="text"
                    value={newCNip}
                    onChange={(e) => setNewCNip(e.target.value)}
                    placeholder="Contoh: 19890101 201503 1 001 atau -"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-[#00685f] focus:border-[#00685f]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Jabatan / Role</label>
                  <input
                    type="text"
                    value={newCRole}
                    onChange={(e) => setNewCRole(e.target.value)}
                    placeholder="Contoh: Guru Pembimbing Kelas 8"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-[#00685f] focus:border-[#00685f]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Email Akun (Google / Belajar.id)</label>
                  <input
                    type="email"
                    value={newCEmail}
                    onChange={(e) => setNewCEmail(e.target.value)}
                    placeholder="Contoh: binasaptarina58@guru.sma.belajar.id"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-[#00685f] focus:border-[#00685f]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Hak Kelas Bimbingan (Pisahkan koma)</label>
                  <input
                    type="text"
                    value={newCClasses}
                    onChange={(e) => setNewCClasses(e.target.value)}
                    placeholder="Contoh: 8A, 8B, 8C (Kosongkan jika Administrator)"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-[#00685f] focus:border-[#00685f]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Username Login</label>
                  <input
                    type="text"
                    value={newCUsername}
                    onChange={(e) => setNewCUsername(e.target.value)}
                    placeholder="Username untuk login"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-[#00685f] focus:border-[#00685f]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Password / PIN</label>
                  <input
                    type="text"
                    value={newCPassword}
                    onChange={(e) => setNewCPassword(e.target.value)}
                    placeholder="Password atau PIN masuk"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-[#00685f] focus:border-[#00685f]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddingC(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewUser}
                  className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all"
                >
                  Simpan Akun Baru
                </button>
              </div>
            </div>
          )}

          {/* Modal Edit Pengguna */}
          {editingCounselorId && (
            <div className="bg-slate-50 rounded-2xl p-6 border border-[#bcc9c6] shadow-md space-y-4 animate-in slide-in-from-top-4 duration-200">
              <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                <h4 className="font-extrabold text-sm text-gray-800 flex items-center gap-1.5">
                  <Pencil className="w-4 h-4 text-[#00685f]" />
                  <span>Edit Data Akun & Kredensial Login</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingCounselorId(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Nama Lengkap & Gelar</label>
                  <input
                    type="text"
                    value={editCName}
                    onChange={(e) => setEditCName(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">NIP</label>
                  <input
                    type="text"
                    value={editCNip}
                    onChange={(e) => setEditCNip(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Jabatan / Role</label>
                  <input
                    type="text"
                    value={editCRole}
                    onChange={(e) => setEditCRole(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Email Akun (Google / Belajar.id)</label>
                  <input
                    type="email"
                    value={editCEmail}
                    onChange={(e) => setEditCEmail(e.target.value)}
                    placeholder="Contoh: binasaptarina58@guru.sma.belajar.id"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Hak Kelas Bimbingan</label>
                  <input
                    type="text"
                    value={editCClasses}
                    onChange={(e) => setEditCClasses(e.target.value)}
                    placeholder="Contoh: 8A, 8B (Kosongkan jika Administrator)"
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Username Login</label>
                  <input
                    type="text"
                    value={editCUsername}
                    onChange={(e) => setEditCUsername(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Password / PIN Baru</label>
                  <input
                    type="text"
                    value={editCPassword}
                    onChange={(e) => setEditCPassword(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingCounselorId(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-500 hover:bg-gray-200 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveCounselorEdit}
                  className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          )}

          {/* SECTION: Permintaan Pendaftaran Akun Guru Baru (Menunggu ACC) */}
          {isUserAdmin && allPendingCounselors.length > 0 && (
            <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-5 shadow-xs space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-2xs relative">
                    <UserCheck className="w-5 h-5" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-amber-950">Permintaan Pendaftaran Akun Guru Baru</h4>
                      <span className="px-2.5 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-black rounded-full border border-amber-300 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                        {allPendingCounselors.length} Menunggu Persetujuan (ACC)
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-md border border-emerald-200">
                        Realtime Sync Aktif
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 font-medium">
                      Pendaftaran akun baru masuk secara realtime dari Cloud. Administrator BK dapat menyetujui (ACC) atau menolak permintaan di bawah ini.
                    </p>
                  </div>
                </div>

                {allPendingCounselors.length > 1 && (
                  <button
                    type="button"
                    onClick={handleApproveAllPending}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-97"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Setujui Semua ({allPendingCounselors.length})</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {allPendingCounselors
                  .map((c) => (
                    <div key={c.id} className="bg-white rounded-xl p-4 border border-amber-200/80 shadow-2xs space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={c.avatar}
                            alt={c.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border border-amber-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-extrabold text-xs text-[#0b1c30] truncate">{c.name}</p>
                            <p className="text-[11px] text-[#00685f] font-semibold">{c.role}</p>
                            <p className="text-[10px] text-gray-400 font-mono">NIP: {c.nip || '-'}</p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black rounded-md border border-amber-200 uppercase shrink-0">
                          Pending ACC
                        </span>
                      </div>

                      {/* Display School Details if available */}
                      {((c as any).schoolName || (c as any).schoolNpsn) && (
                        <div className="p-2 bg-teal-50/70 rounded-lg border border-teal-100/80 flex items-center gap-2 text-[10px] text-[#00685f]">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            Sekolah: <strong>{(c as any).schoolName || 'Sekolah'}</strong> {(c as any).schoolNpsn ? `(NPSN: ${(c as any).schoolNpsn})` : ''}
                          </span>
                        </div>
                      )}

                      <div className="bg-slate-50 p-2.5 rounded-lg border border-gray-100 grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-gray-400 block font-semibold">Username Login:</span>
                          <span className="font-mono font-bold text-[#00685f]">{c.username || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-semibold">Password:</span>
                          <span className="font-mono font-bold text-gray-700">{c.password || '123456'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-semibold">Email:</span>
                          <span className="font-mono text-gray-600 truncate block">{c.email || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-semibold">Kelas Bimbingan:</span>
                          <span className="font-bold text-teal-700">
                            {c.allowedClasses && c.allowedClasses.length > 0 ? c.allowedClasses.join(', ') : 'Semua Kelas (Admin)'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCounselorId(c.id);
                            setEditCName(c.name);
                            setEditCNip(c.nip);
                            setEditCRole(c.role);
                            setEditCEmail(c.email || '');
                            setEditCUsername(c.username || '');
                            setEditCPassword(c.password || '');
                            setEditCClasses(c.allowedClasses.join(', '));
                            setIsAddingC(false);
                          }}
                          className="px-2.5 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-100 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                          title="Edit Data / Hak Akses Sebelum ACC"
                        >
                          <Pencil className="w-3 h-3 inline mr-1" />
                          <span>Edit Akses</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectCounselor(c)}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                        >
                          <X className="w-3 h-3 inline mr-1" />
                          <span>Tolak</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveCounselor(c)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-2xs transition-all active:scale-97 cursor-pointer"
                        >
                          <Check className="w-3 h-3 inline mr-1" />
                          <span>Setujui (ACC)</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Tabel Pengguna Terdaftar */}
          <div className="bg-white rounded-2xl border border-[#bcc9c6]/30 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
              <div>
                <h4 className="font-extrabold text-sm text-[#0b1c30]">Daftar Akun Guru BK & Pembimbing</h4>
                <p className="text-[11px] text-gray-500 font-medium mt-0.5">Kelola data guru pembimbing, kredensial login, hak akses kelas bimbingan, serta persetujuan akun.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddingC(true);
                  setEditingCounselorId(null);
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1 px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer active:scale-97"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Akun Guru BK</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-3 px-5">Nama / Jabatan / NIP</th>
                    <th className="py-3 px-5">Username</th>
                    <th className="py-3 px-5">Kata Sandi</th>
                    <th className="py-3 px-5">Hak Akses Kelas</th>
                    <th className="py-3 px-5 text-center">Status</th>
                    <th className="py-3 px-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {allCounselors.map((c) => {
                    const isSelf = activeCounselor?.id === c.id;
                    const isGlobalAdmin = c.allowedClasses.length === 0;
                    const isPending = c.approvalStatus === 'pending';
                    const isRejected = c.approvalStatus === 'rejected';

                    return (
                      <tr 
                        key={c.id} 
                        className={`hover:bg-slate-50/50 transition-colors ${
                          isPending 
                            ? 'bg-amber-50/30' 
                            : isRejected 
                              ? 'opacity-65 bg-rose-50/20' 
                              : c.isBlocked 
                                ? 'opacity-65 bg-red-50/10' 
                                : ''
                        }`}
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden border bg-gray-100 shrink-0">
                              <img referrerPolicy="no-referrer" src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <p className="font-extrabold text-[#0b1c30] flex items-center gap-1.5 flex-wrap">
                                <span>{c.name}</span>
                                {isSelf && (
                                  <span className="bg-blue-50 text-blue-700 text-[8px] font-bold px-1.5 py-0.2 rounded border border-blue-100">
                                    AKUN ANDA
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-gray-500 font-semibold">{c.role}</p>
                              {c.email && (
                                <p className="text-[9px] text-[#00685f] font-mono font-medium">{c.email}</p>
                              )}
                              <p className="text-[9px] text-gray-400 font-medium">NIP: {c.nip}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 font-mono text-[11px] font-bold text-[#00685f]">
                          {c.username || 'belum_diatur'}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-[11px] text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold">
                              {visiblePasswords[c.id] ? (c.password || 'belum_diatur') : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(c.id)}
                              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors cursor-pointer"
                              title={visiblePasswords[c.id] ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                            >
                              {visiblePasswords[c.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          {isGlobalAdmin ? (
                            <span className="bg-purple-50 text-purple-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-purple-100 uppercase">
                              Full Administrator
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <span className="bg-teal-50 text-teal-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-teal-100 uppercase">
                                Terbatas (Guru BK Kelas)
                              </span>
                              <p className="text-[10px] text-gray-500 font-bold mt-0.5 pl-1">
                                Kelas: {c.allowedClasses.join(', ')}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300 uppercase">
                              Menunggu ACC
                            </span>
                          ) : isRejected ? (
                            <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border border-rose-200 uppercase">
                              Ditolak
                            </span>
                          ) : c.isBlocked ? (
                            <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border border-red-100 uppercase">
                              <UserX className="w-3 h-3" />
                              <span>Ditangguhkan</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-100 uppercase">
                              <UserCheck className="w-3 h-3" />
                              <span>Aktif</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && isUserAdmin && (
                              <button
                                type="button"
                                onClick={() => handleApproveCounselor(c)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                                title="Setujui (ACC) Akun Ini"
                              >
                                <Check className="w-3 h-3" />
                                <span>ACC</span>
                              </button>
                            )}

                            {isRejected && isUserAdmin && (
                              <button
                                type="button"
                                onClick={() => handleApproveCounselor(c)}
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                                title="Setujui Ulang Pendaftaran Akun"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>ACC Ulang</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCopyCredentials(c)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                copiedCounselorId === c.id 
                                  ? 'text-emerald-700 bg-emerald-100' 
                                  : 'text-gray-500 hover:text-[#00685f] hover:bg-slate-100'
                              }`}
                              title="Salin Kredensial Login (Username & Password)"
                            >
                              {copiedCounselorId === c.id ? <CopyCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingCounselorId(c.id);
                                setEditCName(c.name);
                                setEditCNip(c.nip);
                                setEditCRole(c.role);
                                setEditCEmail(c.email || '');
                                setEditCUsername(c.username || '');
                                setEditCPassword(c.password || '');
                                setEditCClasses(c.allowedClasses.join(', '));
                                setIsAddingC(false);
                              }}
                              className="p-1.5 text-gray-500 hover:text-[#00685f] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit Profil & Password"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleBlockUser(c)}
                              disabled={isSelf}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isSelf 
                                  ? 'text-gray-300 cursor-not-allowed' 
                                  : c.isBlocked 
                                    ? 'text-emerald-600 hover:bg-emerald-50' 
                                    : 'text-red-600 hover:bg-red-50'
                              }`}
                              title={c.isBlocked ? 'Aktifkan Akun' : 'Nonaktifkan/Blokir Akun'}
                            >
                              {c.isBlocked ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(c)}
                              disabled={isSelf}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isSelf 
                                  ? 'text-gray-300 cursor-not-allowed' 
                                  : 'text-gray-400 hover:text-red-700 hover:bg-red-50'
                              }`}
                              title="Hapus Akun Pengguna"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'otomatisasi' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-wrap gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-[#00685f]" />
                  <span>Pengaturan Otomatisasi Jurnal Harian BK</span>
                </h3>
                <p className="text-xs text-[#3d4947] mt-1">
                  Atur jenis aktivitas mana saja yang akan otomatis dimasukkan ke Jurnal Harian BK tanpa perlu mengetik dua kali.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const defaultSettings: AutoJournalSettings = {
                    syncViolations: false,
                    syncServices: true,
                    syncSummonsAndVisits: true,
                    syncAchievements: true,
                  };
                  setAutoJournalSettings(defaultSettings);
                  saveAutoJournalSettings(defaultSettings);
                  alert('Pengaturan otomatisasi jurnal berhasil dikembalikan ke standar awal (Catatan Pelanggaran Nonaktif).');
                }}
                className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Standar</span>
              </button>
            </div>

            {/* List of 4 Categories */}
            <div className="space-y-4">
              {/* 1. Catatan Pelanggaran Siswa */}
              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/70 flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-extrabold text-[#0b1c30]">Catatan Pelanggaran Siswa</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        autoJournalSettings.syncViolations 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-200 text-amber-900 font-extrabold'
                      }`}>
                        {autoJournalSettings.syncViolations ? 'Sync Aktif' : 'TIDAK MASUK JURNAL (Standar)'}
                      </span>
                    </div>
                    <p className="text-xs text-[#3d4947] mt-1 leading-relaxed">
                      Laporan kasus & poin pelanggaran disiplin siswa. Bila dinonaktifkan (standar), pencatatan pelanggaran <strong>TIDAK akan masuk ke Jurnal Harian BK</strong> agar jurnal harian tetap rapi dan terfokus pada kegiatan pelayanan.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={autoJournalSettings.syncViolations}
                    onChange={(e) => handleToggleAutoJournal('syncViolations', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00685f]"></div>
                </label>
              </div>

              {/* 2. Layanan Konseling */}
              <div className="p-4 bg-teal-50/40 rounded-2xl border border-teal-200/60 flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-[#00685f]/10 text-[#00685f] rounded-xl shrink-0 mt-0.5">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-extrabold text-[#0b1c30]">Layanan Konseling & Bimbingan BK</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        autoJournalSettings.syncServices 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {autoJournalSettings.syncServices ? 'Otomatis Masuk Jurnal' : 'Nonaktif'}
                      </span>
                    </div>
                    <p className="text-xs text-[#3d4947] mt-1 leading-relaxed">
                      Mencakup seluruh jenis layanan BK: <strong>Orientasi, Informasi, Penempatan & Penyaluran, Penguasaan Konten, Konseling Perorangan, Bimbingan Kelompok, Konseling Kelompok, Konsultasi, Mediasi</strong>, Bimbingan Klasikal, serta Pembinaan Restitusi.
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {['Orientasi', 'Informasi', 'Penempatan/Penyaluran', 'Penguasaan Konten', 'Konseling Perorangan', 'Bimbingan Kelompok', 'Konseling Kelompok', 'Konsultasi', 'Mediasi'].map((st) => (
                        <span key={st} className="text-[9px] font-extrabold bg-[#00685f]/10 text-[#00685f] px-1.5 py-0.5 rounded border border-[#00685f]/20">
                          {st}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={autoJournalSettings.syncServices}
                    onChange={(e) => handleToggleAutoJournal('syncServices', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00685f]"></div>
                </label>
              </div>

              {/* 3. Pemanggilan Ortu / Home Visit */}
              <div className="p-4 bg-purple-50/40 rounded-2xl border border-purple-200/60 flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-purple-100 text-purple-800 rounded-xl shrink-0 mt-0.5">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-extrabold text-[#0b1c30]">Pemanggilan Orang Tua & Kunjungan Rumah (Home Visit)</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        autoJournalSettings.syncSummonsAndVisits 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {autoJournalSettings.syncSummonsAndVisits ? 'Otomatis Masuk Jurnal' : 'Nonaktif'}
                      </span>
                    </div>
                    <p className="text-xs text-[#3d4947] mt-1 leading-relaxed">
                      Penerbitan surat panggilan orang tua, notulen konfirmasi kehadiran ortu di sekolah, serta laporan pelaksanaan Home Visit.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={autoJournalSettings.syncSummonsAndVisits}
                    onChange={(e) => handleToggleAutoJournal('syncSummonsAndVisits', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00685f]"></div>
                </label>
              </div>

              {/* 4. Apresiasi & Prestasi */}
              <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-200/60 flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-extrabold text-[#0b1c30]">Apresiasi & Reward Prestasi Siswa</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        autoJournalSettings.syncAchievements 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {autoJournalSettings.syncAchievements ? 'Otomatis Masuk Jurnal' : 'Nonaktif'}
                      </span>
                    </div>
                    <p className="text-xs text-[#3d4947] mt-1 leading-relaxed">
                      Pemberian poin apresiasi, penghargaan prestasi akademik/non-akademik, dan reward karakter positif siswa.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={autoJournalSettings.syncAchievements}
                    onChange={(e) => handleToggleAutoJournal('syncAchievements', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00685f]"></div>
                </label>
              </div>
            </div>

            {/* Info Banner */}
            <div className="p-4 bg-[#f8faf9] rounded-2xl border border-[#bcc9c6]/40 flex items-start gap-3">
              <Info className="w-5 h-5 text-[#00685f] shrink-0 mt-0.5" />
              <div className="text-xs text-[#3d4947] space-y-1">
                <p className="font-bold text-[#0b1c30]">Prinsip Otomatisasi Jurnal Harian</p>
                <p className="leading-relaxed">
                  Setiap kali Guru BK menginput data Layanan Konseling, Pemanggilan Orang Tua, atau Home Visit, sistem akan otomatis mencatatnya ke <strong>Jurnal Harian BK</strong> di latar belakang. Berdasarkan preferensi Anda, <strong>Catatan Pelanggaran Siswa secara default tidak masuk jurnal</strong> agar rekap jurnal harian tetap berfokus pada aktivitas pelayanan aktif.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Choice Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-gray-100 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-[#6b38d4]/10 rounded-full flex items-center justify-center shrink-0 text-[#6b38d4]">
                <Database className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-[#0b1c30]">
                  Opsi Pemulihan Database Cerdas
                </h4>
                <p className="text-[11px] text-gray-500 font-medium">
                  Kami mendeteksi file cadangan database Anda. Silakan pilih metode pemulihan yang paling aman untuk kolaborasi multi-user:
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Option 1: Safe Merge (Recommended) */}
              <button
                type="button"
                onClick={handleApplyMergeImport}
                className="w-full text-left p-4 bg-gradient-to-r from-emerald-50/50 to-teal-50/30 hover:from-emerald-50 hover:to-teal-50 rounded-2xl border border-emerald-200 hover:border-emerald-300 transition-all flex gap-3.5 cursor-pointer items-start active:scale-99"
              >
                <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600 shrink-0" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#0b1c30]">GABUNGKAN DATA (Safe Merge)</span>
                    <span className="bg-emerald-600 text-white text-[8px] font-black px-2 py-0.2 rounded-full uppercase tracking-wider">Sangat Aman</span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed font-semibold">
                    Data siswa, pelanggaran, bimbingan, dan rekam jurnal baru dari file akan digabungkan secara cerdas berdasarkan ID unik. <strong className="text-emerald-700 font-bold">Tidak ada data Anda saat ini yang akan terhapus atau hilang!</strong>
                  </p>
                </div>
              </button>

              {/* Option 2: Full Overwrite */}
              <button
                type="button"
                onClick={handleApplyOverwriteImport}
                className="w-full text-left p-4 bg-red-50/10 hover:bg-red-50/40 rounded-2xl border border-red-200 hover:border-red-300 transition-all flex gap-3.5 cursor-pointer items-start active:scale-99"
              >
                <AlertTriangle className="w-5 h-5 mt-0.5 text-[#ba1a1a] shrink-0" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#0b1c30]">TIMPA PENUH (Full Overwrite)</span>
                    <span className="bg-red-100 text-red-700 text-[8px] font-extrabold px-2 py-0.2 rounded-full uppercase tracking-wider">Hapus Data Awal</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Menghapus seluruh database lokal Anda saat ini pada perangkat ini dan menggantinya 100% dengan isi dari berkas cadangan ini. Gunakan hanya jika Anda ingin mereset total isi data.
                  </p>
                </div>
              </button>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportingData(null);
                }}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
              >
                Batal Pemulihan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
