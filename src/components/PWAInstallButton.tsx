import React, { useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar';
  onInstalled?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  onInstalled,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    const ok = await install();
    if (ok && onInstalled) {
      onInstalled();
    }
  };

  if (isInstallable) {
    if (variant === 'sidebar') {
      return (
        <button
          type="button"
          onClick={handleInstallClick}
          className="flex w-full min-h-[40px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 whitespace-nowrap"
        >
          <Download className="h-4 w-4 shrink-0" />
          <span>Install Aplikasi ke HP/PC</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleInstallClick}
        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-emerald-600/80 bg-emerald-950/80 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-900/70 whitespace-nowrap"
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">Install Aplikasi</span>
        <span className="sm:hidden">Install</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'sidebar'
              ? 'flex w-full min-h-[40px] items-center justify-center gap-2 rounded-lg border border-emerald-700/70 bg-emerald-950/60 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/60 whitespace-nowrap'
              : 'inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-emerald-700/70 bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/60 whitespace-nowrap'
          }
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          <span>Install App</span>
        </button>

        {showIOSGuide && (
          <div
            className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <h3 className="text-base font-semibold text-slate-100">
                Install NiagaAngkut di iPhone / iPad
              </h3>
              <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-slate-300">
                <li>
                  Ketuk ikon <strong>Bagikan (Share)</strong> di bilah bawah Safari.
                </li>
                <li>
                  Gulir ke bawah lalu pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.
                </li>
                <li>
                  Ketuk <strong>Tambah (Add)</strong> di kanan atas.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[40px] rounded-lg bg-slate-800 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-700 bg-amber-950/95 px-3 py-2 text-xs font-medium text-amber-200 shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-400 shrink-0" />
      <span>Mode Offline — Data lokal tetap tersimpan &amp; siap dipakai.</span>
    </div>
  );
};
