import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertOctagon, RotateCcw, DatabaseZap, Home, EyeOff } from 'lucide-react';
import { pruneStorageQuota } from '../utils/storageQuota';

interface Props {
  children: ReactNode;
  moduleName?: string;
  onHideModule?: () => void;
  onNavigateHome?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
    if (error && typeof error.message === 'string' && (error.message.toLowerCase().includes('quota') || error.message.includes('setItem'))) {
      pruneStorageQuota(true);
    }
  }

  private handleReload = () => {
    if (this.state.error?.message?.toLowerCase().includes('quota') || this.state.error?.message?.includes('setItem')) {
      pruneStorageQuota(true);
    }
    window.location.reload();
  };

  private handleGoHome = () => {
    if (this.props.onNavigateHome) {
      this.setState({ hasError: false, error: null }, () => {
        this.props.onNavigateHome?.();
      });
      return;
    }
    try {
      sessionStorage.removeItem('bk_last_view');
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleHideModule = () => {
    this.setState({ hasError: false, error: null }, () => {
      this.props.onHideModule?.();
    });
  };

  private handleResetCache = () => {
    try {
      pruneStorageQuota(true);
      // Bersihkan hanya kunci cache UI & versi identitas agar data siswa/layanan tetap aman
      localStorage.removeItem('bk_identity_cache_version');
      localStorage.removeItem('bk_active_school_id');
      localStorage.removeItem('bk_school_config');
      localStorage.removeItem('bk_is_logged_in');
    } catch {}
    window.location.reload();
  };

  private handleFixQuotaOnly = () => {
    try {
      pruneStorageQuota(true);
      localStorage.removeItem('bk_logs');
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('bk_logs_')) {
          localStorage.removeItem(k);
        }
      }
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const { moduleName, onHideModule } = this.props;
      const errMsg = typeof this.state.error?.message === 'string' ? this.state.error.message : '';
      const isQuotaError = errMsg.toLowerCase().includes('quota') || errMsg.includes('setItem');

      if (moduleName) {
        return (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-xs p-6 max-w-lg mx-auto my-6 text-center space-y-4 font-['Plus_Jakarta_Sans',sans-serif]">
            <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-[#0b1c30]">
                Modul {moduleName} gagal dimuat
              </h3>
              <p className="text-xs text-[#3d4947] leading-relaxed">
                Modul {moduleName} gagal dimuat, klik <strong>[Sembunyikan Modul Ini]</strong> untuk buka Menu Siswa atau kembali ke Beranda. Data Anda di Firestore tetap aman.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {onHideModule && (
                <button
                  type="button"
                  onClick={this.handleHideModule}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold cursor-pointer shadow-2xs"
                >
                  <EyeOff className="w-4 h-4" />
                  <span>Sembunyikan Modul Ini</span>
                </button>
              )}
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#0b1c30] rounded-xl text-xs font-bold cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Kembali ke Beranda</span>
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[#bcc9c6]/40 p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0b1c30]">
                {isQuotaError ? 'Kapasitas Memori Peramban Penuh' : 'Tampilan Memerlukan Penyesuaian'}
              </h2>
              <p className="text-xs text-[#3d4947] mt-1 leading-relaxed">
                {isQuotaError
                  ? 'Kapasitas penyimpanan lokal peramban (LocalStorage) mencapai batas maksimum akibat penumpukan riwayat aktivitas log. Klik tombol perbaikan di bawah untuk merapikan memori secara aman tanpa menghapus data siswa atau konseling.'
                  : 'Terjadi ketidaksesuaian sementara saat merender tampilan. Seluruh data siswa, layanan, dan kasus di Firestore tetap aman.'}
              </p>
              {errMsg && (
                <details className="mt-3 text-left">
                  <summary className="text-[11px] font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-700">
                    Info Teknis (Opsional)
                  </summary>
                  <div className="mt-1.5 p-2.5 bg-gray-50 rounded-xl font-mono text-[10px] text-gray-600 max-h-20 overflow-y-auto border border-gray-200">
                    {errMsg}
                  </div>
                </details>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {isQuotaError ? (
                <button
                  type="button"
                  onClick={this.handleFixQuotaOnly}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer min-h-[44px]"
                >
                  <DatabaseZap className="w-4 h-4" />
                  <span>Bersihkan Memori Log &amp; Muat Ulang</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={this.handleGoHome}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer min-h-[44px]"
                >
                  <Home className="w-4 h-4" />
                  <span>Kembali ke Beranda</span>
                </button>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[40px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Muat Ulang</span>
                </button>
                <button
                  type="button"
                  onClick={this.handleResetCache}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[40px]"
                  title="Pulihkan Cache Tampilan & Identitas"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Pulihkan Cache</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
