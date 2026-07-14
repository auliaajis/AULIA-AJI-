import React, { useState, useEffect } from 'react';
import SchoolLogo from './SchoolLogo';
import { Save, RotateCcw, Building, MapPin, User, ShieldAlert } from 'lucide-react';

interface SchoolConfig {
  schoolName: string;
  schoolAddress: string;
  principalName: string;
  principalNip: string;
  governmentName: string;
  departmentName: string;
}

export default function PengaturanView() {
  const [config, setConfig] = useState<SchoolConfig>({
    schoolName: 'SMP N 2 Susukan',
    schoolAddress: 'Desa Koripan, Kec. Susukan, Kab. Semarang, Jawa Tengah 50777',
    principalName: 'Agus Setiawan, S.Pd. Fis',
    principalNip: '19680831 199103 1 007',
    governmentName: 'PEMERINTAH KABUPATEN SEMARANG',
    departmentName: 'DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA',
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load existing config
  useEffect(() => {
    const saved = localStorage.getItem('bk_school_config');
    const defaults = {
      schoolName: 'SMP N 2 Susukan',
      schoolAddress: 'Jl. Kyai Hasan Anwar No. 16, Susukan, Kec. Susukan, Kab. Semarang, Jawa Tengah 50777',
      principalName: 'Drs. H. Suhardi, M.Pd.',
      principalNip: '19680320 199403 1 005',
      governmentName: 'PEMERINTAH KABUPATEN SEMARANG',
      departmentName: 'DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA'
    };
    if (saved) {
      try {
        setConfig({
          ...defaults,
          ...JSON.parse(saved)
        });
      } catch (e) {
        // error parsing, keep defaults
      }
    } else {
      setConfig(defaults);
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('bk_school_config', JSON.stringify(config));
    
    // Dispatch a storage event so other components (or window) know the config updated
    window.dispatchEvent(new Event('storage'));
    
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 3000);
  };

  const handleReset = () => {
    if (confirm('Apakah Anda yakin ingin mengembalikan pengaturan ke default sekolah SMP N 2 Susukan?')) {
      const defaultConfig = {
        schoolName: 'SMP N 2 Susukan',
        schoolAddress: 'Jl. Kyai Hasan Anwar No. 16, Susukan, Kec. Susukan, Kab. Semarang, Jawa Tengah 50777',
        principalName: 'Drs. H. Suhardi, M.Pd.',
        principalNip: '19680320 199403 1 005',
        governmentName: 'PEMERINTAH KABUPATEN SEMARANG',
        departmentName: 'DINAS PENDIDIKAN, KEBUDAYAAN, KEPEMUDAAN DAN OLAHRAGA'
      };
      setConfig(defaultConfig);
      localStorage.setItem('bk_school_config', JSON.stringify(defaultConfig));
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
        <h2 className="text-2xl font-extrabold text-[#0b1c30]">Pengaturan Identitas Sekolah</h2>
        <p className="text-sm text-[#3d4947]/70 font-semibold mt-0.5">
          Sesuaikan nama sekolah, alamat, kepala sekolah, dan data logo secara manual untuk kebutuhan cetak rapor & surat BK.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Logo Preview Card */}
        <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm flex flex-col items-center text-center justify-between">
          <div className="space-y-4">
            <span className="text-[10px] bg-[#00685f]/10 text-[#00685f] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider">
              Logo Sekolah Terpasang
            </span>
            <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center">
              <SchoolLogo size={180} />
            </div>
            <div>
              <h3 className="font-bold text-[#0b1c30] text-base">Logo BK Standar</h3>
              <p className="text-xs text-[#3d4947]/70 mt-1">
                Logo Bimbingan & Konseling digambar menggunakan grafik vektor (SVG) presisi tinggi untuk menjamin hasil cetak PDF yang sangat tajam tanpa pecah.
              </p>
            </div>
          </div>

          <div className="w-full pt-4 mt-4 border-t border-[#bcc9c6]/10 text-left text-xs space-y-2 bg-amber-50/50 p-3 rounded-xl border border-amber-200/30 text-amber-800">
            <div className="flex gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed font-medium">
                <strong>Informasi:</strong> Perubahan data di halaman ini akan secara otomatis diterapkan pada seluruh surat dan rapor PDF yang Anda unduh dari sistem.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Identity Form Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm">
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
    </div>
  );
}
