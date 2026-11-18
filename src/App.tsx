import React, { useRef, useState } from 'react';
import {
  Building2,
  ClipboardList,
  Download,
  Eraser,
  LayoutDashboard,
  MoreVertical,
  PlusCircle,
  Printer,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { DaftarRitaseView } from './components/DaftarRitaseView';
import { DashboardTab } from './components/DashboardTab';
import { NotaVendorTab } from './components/NotaVendorTab';
import { TambahRitaseView } from './components/TambahRitaseView';
import { VendorTab } from './components/VendorTab';
import { useTransportStore } from './hooks/useTransportStore';
import {
  BrokerDatabase,
  DashboardSubMenu,
  MainMenuId,
  Ritase,
} from './types/transport';
import { getTodayIso } from './utils/formatters';

export default function App() {
  const {
    db,
    addVendor,
    updateVendor,
    deleteVendor,
    addRitase,
    updateRitase,
    deleteRitase,
    toggleDocStatus,
    toggleVendorPaymentStatus,
    togglePusatPaymentStatus,
    markMultipleRitaseLunas,
    markMultiplePusatPaid,
    updateNotaAdjustment,
    restoreDatabase,
    clearAllData,
    resetSampleData,
  } = useTransportStore();

  const [activeMenu, setActiveMenu] = useState<MainMenuId>('dashboard');
  const [dashboardSubMenu, setDashboardSubMenu] = useState<DashboardSubMenu>('ringkasan');
  const [sidebarOpenDesktop, setSidebarOpenDesktop] = useState<boolean>(true);
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState<boolean>(false);

  const [editingRitase, setEditingRitase] = useState<Ritase | null>(null);
  const [notaVendorId, setNotaVendorId] = useState<string>('');
  const [ritaseSjFilter, setRitaseSjFilter] = useState<'all' | 'belum' | 'lengkap'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3800);
  };

  const handleToggleMenuDrawer = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpenMobile((o) => !o);
    } else {
      setSidebarOpenDesktop((o) => !o);
    }
  };

  const navigateTo = (menu: MainMenuId, sub?: DashboardSubMenu) => {
    if (menu !== 'tambah-ritase') {
      setEditingRitase(null);
    }
    if (menu !== 'daftar-ritase') {
      setRitaseSjFilter('all');
    }
    if (menu === 'dashboard' && sub) {
      setDashboardSubMenu(sub);
    }
    setActiveMenu(menu);
    setSidebarOpenMobile(false);
  };

  const handleBackupJson = () => {
    const payload = {
      app: 'NiagaAngkut',
      version: 2,
      exportedAt: new Date().toISOString(),
      data: db,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-niagaangkut-${getTodayIso()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('File backup JSON berhasil diunduh ke perangkat Anda.');
  };

  const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const candidate: Partial<BrokerDatabase> =
        parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;

      if (!Array.isArray(candidate.vendors) || !Array.isArray(candidate.ritase)) {
        showToast(
          'Format file JSON tidak valid. Pastikan file berasal dari Backup Data NiagaAngkut.'
        );
        return;
      }

      restoreDatabase({
        vendors: candidate.vendors,
        ritase: candidate.ritase,
        notaAdjustments: candidate.notaAdjustments || {},
      });
      showToast(
        `Restore berhasil: ${candidate.vendors.length} vendor dan ${candidate.ritase.length} ritase dipulihkan.`
      );
    } catch {
      showToast('Gagal membaca file JSON. Periksa kembali file backup yang dipilih.');
    }
  };

  const isEmptyDb = db.vendors.length === 0 && db.ritase.length === 0;

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-slate-900 text-slate-100">
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 lg:hidden">
          <span className="font-display text-base font-bold text-slate-100">
            Menu Navigasi
          </span>
          <button
            type="button"
            onClick={() => setSidebarOpenMobile(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
            aria-label="Tutup menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Menu Sidebar" className="space-y-1.5">
          {/* 1. Dashboard & Sub-menu disamping kiri */}
          <div>
            <button
              type="button"
              onClick={() => navigateTo('dashboard', 'ringkasan')}
              className={`flex w-full min-h-[42px] items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
                activeMenu === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>Dashboard &amp; Profit</span>
            </button>

            {/* Sub-menu Dashboard di samping kiri */}
            <div className="mt-1 ml-4 space-y-1 border-l border-slate-800 pl-3">
              <button
                type="button"
                onClick={() => navigateTo('dashboard', 'ringkasan')}
                className={`flex w-full min-h-[34px] items-center rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                  activeMenu === 'dashboard' && dashboardSubMenu === 'ringkasan'
                    ? 'bg-slate-800 text-blue-400 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                Ringkasan Utama
              </button>
              <button
                type="button"
                onClick={() => navigateTo('dashboard', 'per-vendor')}
                className={`flex w-full min-h-[34px] items-center rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                  activeMenu === 'dashboard' && dashboardSubMenu === 'per-vendor'
                    ? 'bg-slate-800 text-blue-400 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                Pilih Vendor ({db.vendors.length})
              </button>
              <button
                type="button"
                onClick={() => navigateTo('dashboard', 'tagihan-pusat')}
                className={`flex w-full min-h-[34px] items-center rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                  activeMenu === 'dashboard' && dashboardSubMenu === 'tagihan-pusat'
                    ? 'bg-slate-800 text-blue-400 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                Tagihan ke Pusat
              </button>
            </div>
          </div>

          {/* 2. Menu Terpisah: Tambah Ritase */}
          <button
            type="button"
            onClick={() => {
              setEditingRitase(null);
              navigateTo('tambah-ritase');
            }}
            className={`flex w-full min-h-[42px] items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
              activeMenu === 'tambah-ritase'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span>Tambah Ritase</span>
          </button>

          {/* 3. Menu Terpisah: Daftar & Kontrol Ritase */}
          <button
            type="button"
            onClick={() => navigateTo('daftar-ritase')}
            className={`flex w-full min-h-[42px] items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
              activeMenu === 'daftar-ritase'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-3">
              <ClipboardList className="h-4 w-4 shrink-0" />
              <span>Daftar Ritase</span>
            </span>
            <span className="font-mono text-xs opacity-80">{db.ritase.length}</span>
          </button>

          {/* 4. Cetak Rincian Pembayaran Vendor */}
          <button
            type="button"
            onClick={() => navigateTo('nota')}
            className={`flex w-full min-h-[42px] items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
              activeMenu === 'nota'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Printer className="h-4 w-4 shrink-0" />
            <span>Cetak Nota Vendor</span>
          </button>

          {/* 5. Master Data Vendor */}
          <button
            type="button"
            onClick={() => navigateTo('vendor')}
            className={`flex w-full min-h-[42px] items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
              activeMenu === 'vendor'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-3">
              <Building2 className="h-4 w-4 shrink-0" />
              <span>Master Data Vendor</span>
            </span>
            <span className="font-mono text-xs opacity-80">{db.vendors.length}</span>
          </button>
        </nav>
      </div>

      {/* Arsip & Pengelolaan Data di bawah Sidebar */}
      <div className="border-t border-slate-800 p-4 space-y-2">
        <button
          type="button"
          onClick={handleBackupJson}
          className="flex w-full min-h-[38px] items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
        >
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span>Backup Data (JSON)</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full min-h-[38px] items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
        >
          <Upload className="h-3.5 w-3.5 shrink-0" />
          <span>Restore Data</span>
        </button>

        {isEmptyDb ? (
          <button
            type="button"
            onClick={() => {
              resetSampleData();
              showToast('Data contoh berhasil dimuat kembali.');
            }}
            className="flex w-full min-h-[38px] items-center gap-2.5 rounded-lg border border-blue-700/60 bg-blue-950/60 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-900/60"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span>Muat Data Contoh</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="flex w-full min-h-[38px] items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-400 hover:border-rose-800 hover:bg-rose-950/50 hover:text-rose-300"
          >
            <Eraser className="h-3.5 w-3.5 shrink-0" />
            <span>Kosongkan Data</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleRestoreFileChange}
        className="hidden"
        aria-label="Pilih file JSON untuk Restore Data"
      />

      {/* Top Header Bar dengan Tombol Titik Tiga di Kiri Atas */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-800 bg-slate-900/95 backdrop-blur-xs">
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Tombol Titik Tiga di Kiri Atas untuk buka/tutup menu */}
            <button
              type="button"
              onClick={handleToggleMenuDrawer}
              aria-label="Buka atau tutup menu navigasi"
              title="Pilih menu & sub-menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            <span className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap">
              NiagaAngkut
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingRitase(null);
                navigateTo('tambah-ritase');
              }}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500 whitespace-nowrap"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Tambah Ritase</span>
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Body: Left Sidebar + Main Viewport */}
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Desktop Sidebar */}
        {sidebarOpenDesktop && (
          <aside className="no-print hidden lg:block w-64 shrink-0 border-r border-slate-800 bg-slate-900">
            <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
              {sidebarContent}
            </div>
          </aside>
        )}

        {/* Mobile Drawer Sidebar (triggered by top-left 3 dots button) */}
        {sidebarOpenMobile && (
          <div className="no-print fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-[1px]"
              onClick={() => setSidebarOpenMobile(false)}
              aria-hidden="true"
            />
            <aside className="relative z-10 h-full w-72 max-w-[85vw] border-r border-slate-800 bg-slate-900 shadow-2xl">
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            {activeMenu === 'dashboard' && (
              <DashboardTab
                vendors={db.vendors}
                ritase={db.ritase}
                subMenu={dashboardSubMenu}
                onChangeSubMenu={(sub) => setDashboardSubMenu(sub)}
                onGoToVendorNota={(vId) => {
                  setNotaVendorId(vId);
                  navigateTo('nota');
                }}
                onGoToUnreturnedSj={() => {
                  setRitaseSjFilter('belum');
                  navigateTo('daftar-ritase');
                }}
                onMarkMultiplePusatPaid={markMultiplePusatPaid}
                onTogglePusatPaymentStatus={togglePusatPaymentStatus}
                onNotify={showToast}
              />
            )}

            {activeMenu === 'tambah-ritase' && (
              <TambahRitaseView
                vendors={db.vendors}
                ritase={db.ritase}
                editingRitase={editingRitase}
                onAddRitase={addRitase}
                onUpdateRitase={updateRitase}
                onCancelEdit={() => setEditingRitase(null)}
                onGoToDaftar={() => navigateTo('daftar-ritase')}
                onGoToVendors={() => navigateTo('vendor')}
                onNotify={showToast}
              />
            )}

            {activeMenu === 'daftar-ritase' && (
              <DaftarRitaseView
                vendors={db.vendors}
                ritase={db.ritase}
                initialSjFilter={ritaseSjFilter}
                onGoToTambah={() => {
                  setEditingRitase(null);
                  navigateTo('tambah-ritase');
                }}
                onEditRitase={(r) => {
                  setEditingRitase(r);
                  setActiveMenu('tambah-ritase');
                }}
                onDeleteRitase={deleteRitase}
                onToggleDocStatus={toggleDocStatus}
                onToggleVendorPaymentStatus={toggleVendorPaymentStatus}
                onTogglePusatPaymentStatus={togglePusatPaymentStatus}
                onNotify={showToast}
              />
            )}

            {activeMenu === 'nota' && (
              <NotaVendorTab
                vendors={db.vendors}
                ritase={db.ritase}
                notaAdjustments={db.notaAdjustments || {}}
                selectedVendorIdProp={notaVendorId}
                onUpdateNotaAdjustment={updateNotaAdjustment}
                onMarkMultipleLunas={markMultipleRitaseLunas}
                onNotify={showToast}
              />
            )}

            {activeMenu === 'vendor' && (
              <VendorTab
                vendors={db.vendors}
                ritase={db.ritase}
                onAddVendor={addVendor}
                onUpdateVendor={updateVendor}
                onDeleteVendor={deleteVendor}
                onNotify={showToast}
              />
            )}
          </div>
        </main>
      </div>

      {/* Confirm Clear All Data */}
      {confirmClearOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100">
              Kosongkan Semua Data &amp; Mulai dari Nol?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Semua data vendor dan ritase yang tersimpan di browser saat ini akan dikosongkan
              agar Anda bisa mulai memasukkan data operasional asli. Pastikan Anda sudah menekan{' '}
              <strong className="text-slate-100">Backup Data (JSON)</strong> jika masih ada data penting.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllData();
                  setConfirmClearOpen(false);
                  showToast('Semua data telah dikosongkan. Anda siap memulai dari nol.');
                }}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
              >
                Ya, Kosongkan Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-medium text-slate-100 shadow-2xl"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
