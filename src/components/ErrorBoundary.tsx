import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertOctagon, RotateCcw } from 'lucide-react';

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
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      localStorage.removeItem('bk_active_school_id');
      localStorage.removeItem('bk_is_logged_in');
    } catch (e) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[#bcc9c6]/40 p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0b1c30]">Terjadi Gangguan pada Sistem</h2>
              <p className="text-xs text-[#3d4947] mt-1 leading-relaxed">
                Aplikasi mengalami kendala saat merender komponen. Anda dapat memuat ulang aplikasi atau menyetel ulang cache data lokal.
              </p>
              {this.state.error && (
                <div className="mt-3 p-2.5 bg-gray-50 rounded-xl text-left font-mono text-[11px] text-gray-700 max-h-24 overflow-y-auto border border-gray-200">
                  {this.state.error.message || 'Unknown Error'}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer min-h-[44px]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Muat Ulang Halaman</span>
              </button>
              <button
                onClick={this.handleResetCache}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[44px]"
                title="Pulihkan Cache"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Pulihkan Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
