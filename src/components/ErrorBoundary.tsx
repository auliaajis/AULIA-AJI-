import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertOctagon, RotateCcw, DatabaseZap } from 'lucide-react';
import { pruneStorageQuota } from '../utils/storageQuota';

interface Props {
  children: ReactNode;
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
    // If it was a quota error, prune before reloading
    if (this.state.error?.message?.toLowerCase().includes('quota') || this.state.error?.message?.includes('setItem')) {
      pruneStorageQuota(true);
    }
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      pruneStorageQuota(true);
      localStorage.removeItem('bk_active_school_id');
      localStorage.removeItem('bk_is_logged_in');
    } catch (e) {}
    window.location.reload();
  };

  private handleFixQuotaOnly = () => {
    try {
      pruneStorageQuota(true);
      // Clean oversized logs specifically
      localStorage.removeItem('bk_logs');
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('bk_logs_')) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isQuotaError =
        this.state.error &&
        typeof this.state.error.message === 'string' &&
        (this.state.error.message.toLowerCase().includes('quota') || this.state.error.message.includes('setItem'));

      return (
        <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[#bcc9c6]/40 p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0b1c30]">
                {isQuotaError ? 'Kapasitas Memori Peramban Penuh' : 'Terjadi Gangguan pada Sistem'}
              </h2>
              <p className="text-xs text-[#3d4947] mt-1 leading-relaxed">
                {isQuotaError
                  ? 'Kapasitas penyimpanan lokal peramban (LocalStorage) mencapai batas maksimum akibat penumpukan riwayat aktivitas log. Klik tombol perbaikan di bawah untuk merapikan memori secara aman tanpa menghapus data siswa atau konseling.'
                  : 'Aplikasi mengalami kendala saat merender komponen. Anda dapat memuat ulang aplikasi atau menyetel ulang cache data lokal.'}
              </p>
              {this.state.error && (
                <div className="mt-3 p-2.5 bg-gray-50 rounded-xl text-left font-mono text-[11px] text-gray-700 max-h-24 overflow-y-auto border border-gray-200">
                  {this.state.error.message || 'Unknown Error'}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {isQuotaError ? (
                <button
                  onClick={this.handleFixQuotaOnly}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer min-h-[44px]"
                >
                  <DatabaseZap className="w-4 h-4" />
                  <span>Bersihkan Memori Log & Muat Ulang</span>
                </button>
              ) : (
                <button
                  onClick={this.handleReload}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer min-h-[44px]"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Muat Ulang Halaman</span>
                </button>
              )}

              <div className="flex gap-2">
                <button
                  onClick={this.handleReload}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[40px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Muat Ulang</span>
                </button>
                <button
                  onClick={this.handleResetCache}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[40px]"
                  title="Pulihkan Cache"
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
