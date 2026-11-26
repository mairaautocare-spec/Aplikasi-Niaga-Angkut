import React, { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  Building2,
  Check,
  ClipboardList,
  Copy,
  Download,
  Eraser,
  FileCode2,
  FileSpreadsheet,
  LayoutDashboard,
  MoreVertical,
  PlusCircle,
  Printer,
  RotateCcw,
  Share2,
  Upload,
  X,
} from 'lucide-react';
import { DaftarRitaseView } from './components/DaftarRitaseView';
import { DashboardTab } from './components/DashboardTab';
import { NotaVendorTab } from './components/NotaVendorTab';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { TambahRitaseView } from './components/TambahRitaseView';
import { VendorTab } from './components/VendorTab';
import { useTransportStore } from './hooks/useTransportStore';
import {
  BrokerDatabase,
  DashboardSubMenu,
  MainMenuId,
  Ritase,
} from './types/transport';
import { importDaftarRitaseFromExcel } from './utils/excelImport';
import { getTodayIso } from './utils/formatters';
import { isElectronDesktop, saveTextFileDesktop } from './utils/printHelper';

export default function App() {
  const {
    db,
    addVendor,
    updateVendor,
    deleteVendor,
    addRitase,
    updateRitase,
    updateRitaseTimbangan,
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
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [showRawBackupText, setShowRawBackupText] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreText, setRestoreText] = useState('');
  const [replaceOnExcelImport, setReplaceOnExcelImport] = useState(true);
  const [importingExcel, setImportingExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const rawBackupTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  const buildBackupJsonString = () => {
    const payload = {
      app: 'NiagaAngkut',
      version: 2,
      exportedAt: new Date().toISOString(),
      data: db,
    };
    return JSON.stringify(payload, null, 2);
  };

  const makeBackupFileName = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `backup-niagaangkut-${getTodayIso()}-${hh}${mm}.json`;
  };

  const openBackupModal = () => {
    setBackupFeedback(null);
    setShowRawBackupText(false);
    setCopiedBackup(false);
    setBackupModalOpen(true);
  };

  const triggerBrowserBlobDownload = (jsonString: string, fileName: string) => {
    const blob = new Blob([jsonString], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    }, 10000);
  };

  const copyTextWithFallback = async (text: string): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fallback to textarea execCommand below
      }
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  };

  const shareNativeAndroidBackup = async (
    jsonString: string,
    fileName: string
  ): Promise<'shared' | 'canceled' | 'failed'> => {
    try {
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: jsonString,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      let fileUri = writeResult.uri;
      if (!fileUri) {
        const uriRes = await Filesystem.getUri({
          directory: Directory.Cache,
          path: fileName,
        });
        fileUri = uriRes.uri;
      }

      await Share.share({
        title: fileName,
        files: [fileUri],
        dialogTitle: 'Simpan / Bagikan File Backup JSON',
      });
      return 'shared';
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (msg.includes('cancel') || msg.includes('abort')) {
        return 'canceled';
      }

      try {
        await Share.share({
          title: fileName,
          text: jsonString,
          dialogTitle: 'Bagikan Kode Backup JSON',
        });
        return 'shared';
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message.toLowerCase() : String(err2).toLowerCase();
        if (msg2.includes('cancel') || msg2.includes('abort')) {
          return 'canceled';
        }
        return 'failed';
      }
    }
  };

  const handleShareBackupFile = async (
    providedJson?: string,
    providedFileName?: string
  ) => {
    const jsonString = providedJson ?? buildBackupJsonString();
    const fileName = providedFileName ?? makeBackupFileName();
    setBackupBusy(true);

    try {
      if (Capacitor.isNativePlatform()) {
        const res = await shareNativeAndroidBackup(jsonString, fileName);
        if (res === 'shared') {
          const msg =
            'Menu Bagikan Android terbuka. Pilih "Simpan ke File / Drive / WhatsApp" untuk menyimpan file .json.';
          setBackupFeedback({ type: 'info', text: msg });
          showToast(msg);
        } else if (res === 'canceled') {
          setBackupFeedback({
            type: 'info',
            text: 'Proses bagikan dibatalkan. Anda masih bisa menyalin kode JSON di bawah.',
          });
        } else {
          setShowRawBackupText(true);
          const msg =
            'Tidak bisa membuka menu Bagikan di perangkat ini. Gunakan tombol "Salin Kode Backup" di bawah.';
          setBackupFeedback({ type: 'error', text: msg });
          showToast(msg);
        }
        return;
      }

      const blob = new Blob([jsonString], {
        type: 'application/json;charset=utf-8;',
      });

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const jsonFile = new File([blob], fileName, { type: 'application/json' });
        const txtFile = new File([blob], fileName, { type: 'text/plain' });

        try {
          if (!navigator.canShare || navigator.canShare({ files: [jsonFile] })) {
            await navigator.share({ files: [jsonFile], title: fileName });
            const msg = 'File .json berhasil dibagikan.';
            setBackupFeedback({ type: 'success', text: msg });
            showToast(msg);
            return;
          }
          if (navigator.canShare({ files: [txtFile] })) {
            await navigator.share({ files: [txtFile], title: fileName });
            const msg = 'File .json berhasil dibagikan.';
            setBackupFeedback({ type: 'success', text: msg });
            showToast(msg);
            return;
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
        }

        try {
          await navigator.share({ title: fileName, text: jsonString });
          const msg = 'Data backup berhasil dibagikan sebagai teks.';
          setBackupFeedback({ type: 'success', text: msg });
          showToast(msg);
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
        }
      }

      if (isElectronDesktop()) {
        const res = await saveTextFileDesktop(fileName, jsonString);
        if (res.handled) {
          if (!res.canceled && res.filePath) {
            const msg = `Backup tersimpan di: ${res.filePath}`;
            setBackupFeedback({ type: 'success', text: msg });
            showToast(msg);
          }
          return;
        }
      }

      triggerBrowserBlobDownload(jsonString, fileName);
      const msg = `File ${fileName} berhasil diunduh (cek folder Download).`;
      setBackupFeedback({ type: 'success', text: msg });
      showToast(msg);
    } finally {
      setBackupBusy(false);
    }
  };

  const handleDownloadBackupFile = async () => {
    const jsonString = buildBackupJsonString();
    const fileName = makeBackupFileName();
    setBackupBusy(true);
    setBackupFeedback(null);

    try {
      if (isElectronDesktop()) {
        try {
          const res = await saveTextFileDesktop(fileName, jsonString);
          if (res.handled) {
            if (res.canceled) {
              setBackupFeedback({ type: 'info', text: 'Penyimpanan file dibatalkan.' });
            } else if (res.filePath) {
              const msg = `Backup berhasil disimpan di: ${res.filePath}`;
              setBackupFeedback({ type: 'success', text: msg });
              showToast(msg);
            }
            return;
          }
        } catch {
          // Fallback to browser download below if desktop bridge threw
        }
      }

      if (Capacitor.isNativePlatform()) {
        const attempts: Array<{
          directory: Directory;
          path: string;
          label: string;
          recursive: boolean;
        }> = [
          {
            directory: Directory.Documents,
            path: `NiagaAngkut/${fileName}`,
            label: `Documents/NiagaAngkut/${fileName}`,
            recursive: true,
          },
          {
            directory: Directory.Documents,
            path: fileName,
            label: `Documents/${fileName}`,
            recursive: false,
          },
          {
            directory: Directory.External,
            path: fileName,
            label: `Android/data/com.niagaangkut.app/files/${fileName}`,
            recursive: false,
          },
        ];

        for (const attempt of attempts) {
          try {
            await Filesystem.writeFile({
              path: attempt.path,
              data: jsonString,
              directory: attempt.directory,
              encoding: Encoding.UTF8,
              recursive: attempt.recursive,
            });
            const msg = `Backup berhasil tersimpan di HP: ${attempt.label}`;
            setBackupFeedback({ type: 'success', text: msg });
            showToast(msg);
            return;
          } catch {
            // Try next directory option
          }
        }

        // If Android Scoped Storage blocked direct file write on this device, open Native Share Sheet
        const shareStatus = await shareNativeAndroidBackup(jsonString, fileName);
        if (shareStatus === 'shared') {
          const msg =
            'Izin folder Documents dibatasi HP. Gunakan menu Bagikan yang terbuka untuk menyimpan file .json ke File Manager / Drive / WA.';
          setBackupFeedback({ type: 'info', text: msg });
          showToast(msg);
        } else if (shareStatus === 'canceled') {
          setBackupFeedback({
            type: 'info',
            text: 'Penyimpanan dibatalkan. Anda bisa tekan "Bagikan File (.json)" atau "Salin Kode Backup" di bawah.',
          });
        } else {
          setShowRawBackupText(true);
          const msg =
            'Gagal menyimpan langsung ke folder HP. Kode backup JSON sudah ditampilkan di bawah untuk disalin manual.';
          setBackupFeedback({ type: 'error', text: msg });
          showToast(msg);
        }
        return;
      }

      triggerBrowserBlobDownload(jsonString, fileName);
      const msg = `File ${fileName} berhasil diunduh ke folder Download.`;
      setBackupFeedback({ type: 'success', text: msg });
      showToast(msg);
    } finally {
      setBackupBusy(false);
    }
  };

  const handleCopyBackupJson = async () => {
    const jsonString = buildBackupJsonString();
    const ok = await copyTextWithFallback(jsonString);
    if (ok) {
      setCopiedBackup(true);
      const msg = 'Kode backup JSON tersalin! Tempel ke WhatsApp, Catatan, atau PC.';
      setBackupFeedback({ type: 'success', text: msg });
      showToast(msg);
      setTimeout(() => setCopiedBackup(false), 2500);
    } else {
      setShowRawBackupText(true);
      const msg =
        'Salin otomatis diblokir perangkat. Teks JSON sudah dibuka di bawah — tekan & tahan lalu Pilih Semua → Salin.';
      setBackupFeedback({ type: 'error', text: msg });
      showToast(msg);
    }
  };

  const applyRestoreFromText = (rawText: string) => {
    try {
      const parsed = JSON.parse(rawText.trim());
      const candidate: Partial<BrokerDatabase> =
        parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;

      if (!Array.isArray(candidate.vendors) || !Array.isArray(candidate.ritase)) {
        showToast(
          'Format JSON tidak valid. Pastikan berasal dari Backup Data NiagaAngkut.'
        );
        return false;
      }

      restoreDatabase({
        vendors: candidate.vendors,
        ritase: candidate.ritase,
        notaAdjustments: candidate.notaAdjustments || {},
      });
      showToast(
        `Restore berhasil: ${candidate.vendors.length} vendor dan ${candidate.ritase.length} ritase dipulihkan.`
      );
      return true;
    } catch {
      showToast('Gagal membaca JSON. Pastikan isi file atau teks backup lengkap & tidak terpotong.');
      return false;
    }
  };

  const processExcelImport = async (files: File[]) => {
    setImportingExcel(true);
    try {
      const result = await importDaftarRitaseFromExcel(files, db, replaceOnExcelImport);
      restoreDatabase(result.database);
      const parts: string[] = [];
      if (result.importedRitaseCount > 0) {
        parts.push(`${result.importedRitaseCount} ritase`);
      }
      parts.push(`${result.totalVendorCount} vendor`);
      if (result.updatedVendorInfoCount > 0) {
        parts.push(`${result.updatedVendorInfoCount} rekening vendor diperbarui`);
      }
      showToast(`Import Excel berhasil: ${parts.join(', ')}.`);
      setRestoreModalOpen(false);
      setRestoreText('');
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Gagal membaca file Excel. Pastikan menggunakan file Daftar-Ritase-*.xlsx atau Nota-Pembayaran-*.xlsx dari NiagaAngkut.';
      showToast(msg);
    } finally {
      setImportingExcel(false);
    }
  };

  const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.xlsx')) {
      await processExcelImport([file]);
      return;
    }

    try {
      const text = await file.text();
      if (applyRestoreFromText(text)) {
        setRestoreModalOpen(false);
        setRestoreText('');
      }
    } catch {
      showToast('Gagal membuka file backup yang dipilih.');
    }
  };

  const handleRestoreExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;
    await processExcelImport(files);
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
                onClick={() => navigateTo('dashboard', 'analitik')}
                className={`flex w-full min-h-[34px] items-center rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                  activeMenu === 'dashboard' && dashboardSubMenu === 'analitik'
                    ? 'bg-slate-800 text-blue-400 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                Grafik &amp; Analitik
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

          {/* 5. Cetak Tagihan ke Pusat */}
          <button
            type="button"
            onClick={() => navigateTo('dashboard', 'tagihan-pusat')}
            className={`flex w-full min-h-[42px] items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
              activeMenu === 'dashboard' && dashboardSubMenu === 'tagihan-pusat'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Printer className="h-4 w-4 shrink-0" />
            <span>Cetak Tagihan Pusat</span>
          </button>

          {/* 6. Master Data Vendor */}
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
        <PWAInstallButton
          variant="sidebar"
          onInstalled={() =>
            showToast('Aplikasi NiagaAngkut berhasil diinstall ke perangkat Anda!')
          }
        />

        <button
          type="button"
          onClick={openBackupModal}
          className="flex w-full min-h-[38px] items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
        >
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span>Backup Data (JSON)</span>
        </button>

        <button
          type="button"
          onClick={() => setRestoreModalOpen(true)}
          className="flex w-full min-h-[38px] items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
        >
          <Upload className="h-3.5 w-3.5 shrink-0" />
          <span>Restore / Import Data</span>
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
    <div className="app-shell-root min-h-screen bg-slate-950 text-slate-100">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.txt,.xlsx,application/json,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={handleRestoreFileChange}
        className="hidden"
        aria-label="Pilih file JSON atau Excel untuk Restore Data"
      />
      <input
        ref={excelInputRef}
        type="file"
        multiple
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={handleRestoreExcelChange}
        className="hidden"
        aria-label="Pilih file Excel Daftar Ritase atau Nota Vendor untuk Import Data"
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
            <PWAInstallButton
              variant="header"
              onInstalled={() =>
                showToast('Aplikasi NiagaAngkut berhasil diinstall ke perangkat Anda!')
              }
            />

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
                notaAdjustments={db.notaAdjustments || {}}
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
                onGoToTambahRitase={() => {
                  setEditingRitase(null);
                  navigateTo('tambah-ritase');
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
                onUpdateTimbangan={updateRitaseTimbangan}
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

      {/* Modal Backup Data (Download/Bagikan File + Salin Kode JSON) */}
      {backupModalOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Backup Data NiagaAngkut
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Saat ini tersimpan {db.vendors.length} vendor &amp; {db.ritase.length} ritase.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBackupModalOpen(false)}
                aria-label="Tutup modal backup"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {backupFeedback && (
              <div
                className={`rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${
                  backupFeedback.type === 'success'
                    ? 'border-emerald-700/80 bg-emerald-950/60 text-emerald-200'
                    : backupFeedback.type === 'error'
                      ? 'border-rose-700/80 bg-rose-950/60 text-rose-200'
                      : 'border-blue-700/80 bg-blue-950/60 text-blue-200'
                }`}
              >
                {backupFeedback.text}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={backupBusy}
                onClick={handleDownloadBackupFile}
                className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Download className="h-4 w-4 shrink-0" />
                <span>
                  {backupBusy
                    ? 'Menyiapkan File Backup...'
                    : 'Unduh / Simpan File (.json) ke HP & PC'}
                </span>
              </button>

              <button
                type="button"
                disabled={backupBusy}
                onClick={() => handleShareBackupFile()}
                className="flex w-full min-h-[40px] items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                <Share2 className="h-4 w-4 shrink-0" />
                <span>Bagikan File (.json) ke WA / Drive / File</span>
              </button>

              <button
                type="button"
                disabled={backupBusy}
                onClick={handleCopyBackupJson}
                className="flex w-full min-h-[40px] items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-950/70 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/60 disabled:opacity-50"
              >
                {copiedBackup ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0" />
                )}
                <span>
                  {copiedBackup
                    ? 'Kode Backup Tersalin!'
                    : 'Salin Kode Backup (untuk WA / Pindah ke PC)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowRawBackupText((prev) => !prev)}
                className="flex w-full min-h-[36px] items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-slate-800"
              >
                <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {showRawBackupText
                    ? 'Sembunyikan Teks Kode JSON'
                    : 'Lihat / Pilih Manual Teks Kode JSON'}
                </span>
              </button>
            </div>

            {showRawBackupText && (
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-300">
                    Kode Backup JSON (Manual):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      rawBackupTextareaRef.current?.focus();
                      rawBackupTextareaRef.current?.select();
                      handleCopyBackupJson();
                    }}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
                  >
                    Pilih Semua &amp; Salin
                  </button>
                </div>
                <textarea
                  ref={rawBackupTextareaRef}
                  readOnly
                  rows={5}
                  value={buildBackupJsonString()}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 font-mono text-[10px] text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-slate-400">
              Di HP Android, file tersimpan ke folder <strong className="text-slate-200">Documents/NiagaAngkut/</strong> atau dapat langsung dikirim ke WhatsApp / Google Drive / File Manager lewat tombol Bagikan.
            </p>
          </div>
        </div>
      )}

      {/* Modal Restore / Import Data (.xlsx dari HP, File .json, atau Tempel Kode JSON) */}
      {restoreModalOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Restore / Pindah Data
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Import dari Excel hasil export HP (<code className="text-slate-300">.xlsx</code>), file backup <code className="text-slate-300">.json</code>, atau tempel kode backup.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                aria-label="Tutup modal restore"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Pindah Data via Excel (.xlsx) */}
            <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 p-3.5 space-y-2.5">
              <div className="text-xs font-semibold text-emerald-300">
                Pindah Data dari Aplikasi HP Lama via Excel (.xlsx)
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Di aplikasi HP lama: buka <strong className="text-white">Daftar Ritase</strong> →{' '}
                <strong className="text-white">Download Excel (.xlsx)</strong> (bisa juga sertakan{' '}
                <strong className="text-white">Nota-Pembayaran-*.xlsx</strong> per vendor agar nomor rekening ikut terbaca otomatis).
              </p>

              <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={replaceOnExcelImport}
                  onChange={(e) => setReplaceOnExcelImport(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                />
                <span>
                  Hapus data contoh / lama sebelum import (centang jika memindahkan ke PC baru)
                </span>
              </label>

              <button
                type="button"
                disabled={importingExcel}
                onClick={() => excelInputRef.current?.click()}
                className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0" />
                <span>
                  {importingExcel ? 'Membaca File Excel...' : 'Import Excel (.xlsx) — Ritase & Vendor'}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full min-h-[40px] items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span>Pilih File Backup (.json)</span>
            </button>

            <div className="border-t border-slate-800 pt-3 space-y-2">
              <label htmlFor="restore-json-paste" className="block text-xs font-semibold text-slate-300">
                Atau Tempel Kode Backup JSON di Sini:
              </label>
              <textarea
                id="restore-json-paste"
                rows={3}
                value={restoreText}
                onChange={(e) => setRestoreText(e.target.value)}
                placeholder='{"app":"NiagaAngkut","version":2,...}'
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 font-mono text-[11px] text-slate-100 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <button
                type="button"
                disabled={!restoreText.trim()}
                onClick={() => {
                  if (applyRestoreFromText(restoreText)) {
                    setRestoreModalOpen(false);
                    setRestoreText('');
                  }
                }}
                className="w-full min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                Pulihkan dari Kode yang Ditempel
              </button>
            </div>
          </div>
        </div>
      )}

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

      <OfflineIndicator />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-4 right-4 z-[70] max-w-sm rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-medium text-slate-100 shadow-2xl"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
