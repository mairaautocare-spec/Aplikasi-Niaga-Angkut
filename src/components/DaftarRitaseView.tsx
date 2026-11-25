import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileCheck2,
  FileClock,
  FileSpreadsheet,
  Pencil,
  Plus,
  Scale,
  Search,
  Trash2,
} from 'lucide-react';
import { Ritase, Vendor } from '../types/transport';
import { exportDaftarRitaseExcel } from '../utils/excelExport';
import {
  computeRitaseMetrics,
  formatRibuan,
  formatRp,
  formatTanggalPendek,
} from '../utils/formatters';

interface DaftarRitaseViewProps {
  vendors: Vendor[];
  ritase: Ritase[];
  initialSjFilter?: 'all' | 'belum' | 'lengkap';
  onGoToTambah: () => void;
  onEditRitase: (r: Ritase) => void;
  onUpdateTimbangan: (id: string, beratMuatKg: number, beratBongkarKg: number) => void;
  onDeleteRitase: (id: string) => void;
  onToggleDocStatus: (id: string) => void;
  onToggleVendorPaymentStatus: (id: string) => void;
  onTogglePusatPaymentStatus: (id: string) => void;
  onNotify: (message: string) => void;
}

export function DaftarRitaseView({
  vendors,
  ritase,
  initialSjFilter = 'all',
  onGoToTambah,
  onEditRitase,
  onUpdateTimbangan,
  onDeleteRitase,
  onToggleDocStatus,
  onToggleVendorPaymentStatus,
  onTogglePusatPaymentStatus,
  onNotify,
}: DaftarRitaseViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [timbanganFilter, setTimbanganFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [sjFilter, setSjFilter] = useState<'all' | 'belum' | 'lengkap'>(initialSjFilter);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [pusatFilter, setPusatFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Modal Update Timbangan Cepat (Poin 3.1)
  const [weightModalRitase, setWeightModalRitase] = useState<Ritase | null>(null);
  const [quickMuatKg, setQuickMuatKg] = useState('');
  const [quickBongkarKg, setQuickBongkarKg] = useState('');

  const openWeightModal = (r: Ritase) => {
    setWeightModalRitase(r);
    setQuickMuatKg(r.beratMuatKg > 0 ? String(r.beratMuatKg) : '');
    setQuickBongkarKg(r.beratBongkarKg > 0 ? String(r.beratBongkarKg) : '');
  };

  useEffect(() => {
    setSjFilter(initialSjFilter);
  }, [initialSjFilter]);

  const vendorMap = useMemo(() => {
    const map = new Map<string, Vendor>();
    for (const v of vendors) map.set(v.id, v);
    return map;
  }, [vendors]);

  const filteredRitase = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ritase
      .filter((r) => {
        if (vendorFilter !== 'all' && r.vendorId !== vendorFilter) return false;
        if (timbanganFilter === 'pending' && r.beratBongkarKg > 0) return false;
        if (timbanganFilter === 'done' && r.beratBongkarKg <= 0) return false;
        if (sjFilter === 'belum' && r.docStatus !== 'SJ & Tiket Timbang Belum Balik') return false;
        if (sjFilter === 'lengkap' && r.docStatus !== 'SJ & Tiket Timbang Lengkap') return false;
        if (statusFilter === 'unpaid' && r.vendorPaymentStatus !== 'Belum Lunas') return false;
        if (statusFilter === 'paid' && r.vendorPaymentStatus !== 'Lunas') return false;
        if (pusatFilter === 'unpaid' && r.pusatPaymentStatus !== 'Belum Dibayar Pusat')
          return false;
        if (pusatFilter === 'paid' && r.pusatPaymentStatus !== 'Sudah Dibayar Pusat') return false;

        if (q) {
          const vendorName = vendorMap.get(r.vendorId)?.name || '';
          const haystack = [
            r.nopol,
            r.namaSopir,
            r.jenisMuatan,
            r.lokasiMuat,
            r.lokasiBongkar,
            vendorName,
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.tanggalMuat.localeCompare(a.tanggalMuat));
  }, [
    ritase,
    searchQuery,
    vendorFilter,
    timbanganFilter,
    sjFilter,
    statusFilter,
    pusatFilter,
    vendorMap,
  ]);

  const [exportingExcel, setExportingExcel] = useState(false);

  const handleExportExcel = async () => {
    if (filteredRitase.length === 0 || exportingExcel) return;
    setExportingExcel(true);
    try {
      const fileName = await exportDaftarRitaseExcel(filteredRitase, vendorMap);
      onNotify(`Daftar ritase berhasil diunduh ke Excel (${fileName}).`);
    } catch {
      onNotify('Gagal mengekspor Excel daftar ritase.');
    } finally {
      setExportingExcel(false);
    }
  };

  const ritaseToDelete = ritase.find((r) => r.id === confirmDeleteId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
            Daftar &amp; Kontrol Ritase ({filteredRitase.length})
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Seluruh data ritase dan angka perhitungannya tetap tersimpan utuh di arsip meskipun sudah ditandai LUNAS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={filteredRitase.length === 0 || exportingExcel}
            onClick={handleExportExcel}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-45 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {exportingExcel ? 'Menyiapkan...' : 'Download Excel (.xlsx)'}
          </button>

          <button
            type="button"
            onClick={onGoToTambah}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Tambah Ritase
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nopol, sopir, muatan..."
              className="w-full min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <select
            aria-label="Filter Vendor"
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="all">Semua Vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter Status Timbangan"
            value={timbanganFilter}
            onChange={(e) => setTimbanganFilter(e.target.value as 'all' | 'pending' | 'done')}
            className="min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="all">Semua Timbangan</option>
            <option value="pending">Belum Bongkar (Jalan)</option>
            <option value="done">Selesai Bongkar</option>
          </select>

          <select
            aria-label="Filter Surat Jalan"
            value={sjFilter}
            onChange={(e) => setSjFilter(e.target.value as 'all' | 'belum' | 'lengkap')}
            className="min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="all">Semua Status SJ</option>
            <option value="belum">SJ Belum Balik</option>
            <option value="lengkap">SJ Lengkap</option>
          </select>

          <select
            aria-label="Filter Status Pembayaran Vendor"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'unpaid' | 'paid')}
            className="min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="all">Vendor: Semua Data</option>
            <option value="unpaid">Vendor: Belum Lunas Saja</option>
            <option value="paid">Vendor: Arsip Sudah Lunas</option>
          </select>

          <select
            aria-label="Filter Status Pembayaran Pusat"
            value={pusatFilter}
            onChange={(e) => setPusatFilter(e.target.value as 'all' | 'unpaid' | 'paid')}
            className="min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="all">Pusat: Semua Status</option>
            <option value="unpaid">Pusat: Belum Dibayar</option>
            <option value="paid">Pusat: Sudah Dibayar</option>
          </select>
        </div>
      </div>

      {/* Table & Mobile Cards */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {filteredRitase.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            <p>Belum ada data ritase yang sesuai filter.</p>
            <button
              type="button"
              onClick={onGoToTambah}
              className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
            >
              <Plus className="h-4 w-4" />
              Tambah Ritase Baru
            </button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 font-semibold text-slate-400">
                    <th className="px-4 py-3">Tanggal &amp; Armada</th>
                    <th className="px-3 py-3">Muatan &amp; Rute</th>
                    <th className="px-3 py-3 text-right">Timbangan &amp; Susut</th>
                    <th className="px-3 py-3 text-right">Harga Jual Vendor &amp; UJ</th>
                    <th className="px-3 py-3 text-right">Harga Pusat &amp; Keuntungan</th>
                    <th className="px-3 py-3">Kontrol Status (1-Klik)</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredRitase.map((r) => {
                    const m = computeRitaseMetrics(r);
                    const vendorName = vendorMap.get(r.vendorId)?.name || 'Vendor Lainnya';
                    const isLunas = r.vendorPaymentStatus === 'Lunas';
                    const isSjLengkap = r.docStatus === 'SJ & Tiket Timbang Lengkap';
                    const isPusatPaid = r.pusatPaymentStatus === 'Sudah Dibayar Pusat';

                    return (
                      <tr key={r.id} className="align-top transition-colors hover:bg-slate-800/40">
                        <td className="px-4 py-3.5">
                          <div className="font-mono font-semibold text-slate-100 tabular-nums">
                            {formatTanggalPendek(r.tanggalMuat)}
                          </div>
                          <div className="mt-1 font-mono text-xs font-bold text-blue-400">
                            {r.nopol}
                          </div>
                          <div className="text-slate-300">{r.namaSopir}</div>
                          <div className="mt-0.5 text-[11px] text-slate-400">{vendorName}</div>
                        </td>

                        <td className="px-3 py-3.5 max-w-[230px]">
                          <div className="font-semibold text-slate-100">{r.jenisMuatan}</div>
                          <div className="mt-1 text-slate-300">
                            <span className="text-slate-500">Muat:</span> {r.lokasiMuat}
                          </div>
                          <div className="text-slate-300">
                            <span className="text-slate-500">Bongkar:</span> {r.lokasiBongkar}
                          </div>
                        </td>

                        <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                          {m.isSelesaiBongkar ? (
                            <>
                              <div className="text-slate-400">
                                Muat: {r.beratMuatKg > 0 ? `${formatRibuan(r.beratMuatKg)} Kg` : '-'}
                              </div>
                              <div className="mt-0.5 font-semibold text-slate-100">
                                Bongkar: {formatRibuan(r.beratBongkarKg)} Kg
                              </div>
                              {r.beratMuatKg > 0 && (
                                <div
                                  className={`mt-1 text-[11px] font-medium ${
                                    m.susutKg > 0 && m.susutPersen > m.toleransiSusutPersen
                                      ? 'text-amber-400'
                                      : 'text-emerald-400'
                                  }`}
                                >
                                  Susut: {formatRibuan(m.susutKg)} Kg ({m.susutPersen.toFixed(2)}%)
                                </div>
                              )}
                              <div className="text-[10px] text-slate-500">
                                Tol. Susut: {String(m.toleransiSusutPersen).replace('.', ',')}%
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold ${
                                  m.timbanganStatus === 'Dalam Perjalanan'
                                    ? 'border-blue-700 bg-blue-950/70 text-blue-300'
                                    : 'border-amber-700 bg-amber-950/70 text-amber-300'
                                }`}
                              >
                                {m.timbanganStatus}
                              </span>
                              <div className="text-[11px] text-slate-400">
                                Muat: {r.beratMuatKg > 0 ? `${formatRibuan(r.beratMuatKg)} Kg` : 'Belum diisi'}
                              </div>
                              <button
                                type="button"
                                onClick={() => openWeightModal(r)}
                                className="mt-0.5 inline-flex items-center gap-1 rounded border border-blue-600/80 bg-blue-600/20 px-2 py-0.5 text-[11px] font-semibold text-blue-300 hover:bg-blue-600 hover:text-white"
                              >
                                <Scale className="h-3 w-3" />
                                Isi Timbangan
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                          <div className="text-slate-400">
                            Vendor: {formatRp(r.hargaJualVendorPerKg)}/Kg
                          </div>
                          <div className="mt-0.5 font-semibold text-slate-100">
                            {m.isSelesaiBongkar ? formatRp(m.jumlahOngkosVendor) : 'Menunggu Bongkar'}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            UJ ({m.sumberUangJalan}
                            {m.sumberUangJalan === 'Pusat'
                              ? m.uangJalanHoldBroker > 0
                                ? m.uangJalanVendor > 0
                                  ? ' · Sebagian Hold'
                                  : ' · Hold Broker'
                                : ' · Tf Vendor'
                              : ''}
                            ): {formatRp(m.uangJalan)}
                          </div>
                          {m.uangJalanHoldBroker > 0 && (
                            <div className="text-[10px] text-amber-300">
                              Tf Vendor: {formatRp(m.uangJalanVendor)} · Hold: {formatRp(m.uangJalanHoldBroker)}
                            </div>
                          )}
                          {m.biayaKartuGto > 0 && (
                            <div className="mt-0.5 text-[11px] text-amber-300">
                              GTO: {formatRp(m.biayaKartuGto)}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                          <div className="text-slate-400">
                            Pusat: {formatRp(r.hargaPusatPerKg)}/Kg
                          </div>
                          <div className="mt-0.5 font-semibold text-slate-100">
                            {m.isSelesaiBongkar ? formatRp(m.tagihanPusat) : '-'}
                          </div>
                          {m.isSelesaiBongkar && m.sumberUangJalan === 'Pusat' && m.uangJalan > 0 && (
                            <div className="text-[10px] text-amber-300">
                              (Bruto {formatRp(m.tagihanBrutoPusat)} − UJ)
                            </div>
                          )}
                          <div
                            className={`mt-1 font-semibold ${
                              !m.isSelesaiBongkar
                                ? 'text-slate-500'
                                : m.keuntungan >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            Untung: {m.isSelesaiBongkar ? formatRp(m.keuntungan) : '-'}
                          </div>
                        </td>

                        <td className="px-3 py-3.5">
                          <div className="flex flex-col items-start gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onToggleVendorPaymentStatus(r.id);
                                onNotify(
                                  isLunas
                                    ? `Status vendor ${r.nopol} diubah menjadi Belum Lunas.`
                                    : `Ritase ${r.nopol} ditandai LUNAS (data arsip tetap utuh).`
                                );
                              }}
                              className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors whitespace-nowrap ${
                                isLunas
                                  ? 'border-emerald-700 bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900/70'
                                  : 'border-amber-700 bg-amber-950/70 text-amber-300 hover:bg-amber-900/60'
                              }`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              {isLunas ? 'LUNAS' : 'Belum Lunas'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onToggleDocStatus(r.id);
                                onNotify(
                                  isSjLengkap
                                    ? `SJ ${r.nopol} diubah menjadi Belum Balik.`
                                    : `SJ ${r.nopol} ditandai Lengkap.`
                                );
                              }}
                              className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                                isSjLengkap
                                  ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                                  : 'border-rose-800 bg-rose-950/60 text-rose-300 hover:bg-rose-900/60'
                              }`}
                            >
                              {isSjLengkap ? (
                                <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                              ) : (
                                <FileClock className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                              )}
                              {isSjLengkap ? 'SJ Sudah Balik' : 'SJ Belum Balik'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onTogglePusatPaymentStatus(r.id);
                                onNotify(
                                  isPusatPaid
                                    ? `Pembayaran Pusat ${r.nopol} diubah menjadi Belum Bayar.`
                                    : `Pembayaran Pusat ${r.nopol} ditandai Sudah Bayar.`
                                );
                              }}
                              className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                                isPusatPaid
                                  ? 'border-emerald-700 bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900/70'
                                  : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-blue-500 hover:bg-slate-800 hover:text-white'
                              }`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              {isPusatPaid ? 'Pusat: Sudah Bayar' : 'Pusat: Belum Bayar'}
                            </button>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openWeightModal(r)}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                                !m.isSelesaiBongkar
                                  ? 'border-amber-600 bg-amber-950/70 text-amber-300 hover:bg-amber-900'
                                  : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white'
                              }`}
                              title="Isi / Update Timbangan Cepat"
                              aria-label="Isi / Update Timbangan Cepat"
                            >
                              <Scale className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditRitase(r)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
                              title="Edit ritase"
                              aria-label="Edit ritase"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(r.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-800/70 bg-slate-950 text-rose-400 hover:bg-rose-950/60"
                              title="Hapus ritase"
                              aria-label="Hapus ritase"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="divide-y divide-slate-800 lg:hidden">
              {filteredRitase.map((r) => {
                const m = computeRitaseMetrics(r);
                const vendorName = vendorMap.get(r.vendorId)?.name || 'Vendor Lainnya';
                const isLunas = r.vendorPaymentStatus === 'Lunas';
                const isSjLengkap = r.docStatus === 'SJ & Tiket Timbang Lengkap';
                const isPusatPaid = r.pusatPaymentStatus === 'Sudah Dibayar Pusat';

                return (
                  <div key={r.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-blue-400">
                            {r.nopol}
                          </span>
                          <span className="text-xs text-slate-600">·</span>
                          <span className="font-mono text-xs text-slate-400">
                            {formatTanggalPendek(r.tanggalMuat)}
                          </span>
                          {isLunas && (
                            <span className="rounded border border-emerald-700 bg-emerald-950 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              LUNAS
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-sm font-semibold text-slate-100">
                          {r.jenisMuatan} · {r.namaSopir}
                        </div>
                        <div className="text-xs text-slate-400">{vendorName}</div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openWeightModal(r)}
                          className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold ${
                            !m.isSelesaiBongkar
                              ? 'border-amber-600 bg-amber-950/80 text-amber-300'
                              : 'border-slate-700 bg-slate-950 text-slate-200'
                          }`}
                          aria-label="Isi Timbangan"
                        >
                          <Scale className="h-3.5 w-3.5" />
                          {!m.isSelesaiBongkar && <span>Timbang</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditRitase(r)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-200"
                          aria-label="Edit ritase"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(r.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-800/70 bg-slate-950 text-rose-400"
                          aria-label="Hapus ritase"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-300">
                      {r.lokasiMuat} → {r.lokasiBongkar}
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-950 p-3 text-xs tabular-nums border border-slate-800">
                      <div>
                        <div className="text-slate-400">Timbangan / Susut</div>
                        <div className="font-mono font-semibold text-slate-100">
                          {m.isSelesaiBongkar
                            ? `${formatRibuan(r.beratBongkarKg)} Kg (${
                                r.beratMuatKg > 0 ? `${formatRibuan(m.susutKg)} Kg` : '-'
                              })`
                            : m.timbanganStatus}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-400">
                          Ongkos Vendor · UJ ({m.sumberUangJalan}
                          {m.sumberUangJalan === 'Pusat'
                            ? m.uangJalanHoldBroker > 0
                              ? m.uangJalanVendor > 0
                                ? ' · Sebagian Hold'
                                : ' · Hold Broker'
                              : ' · Tf Vendor'
                            : ''}
                          )
                        </div>
                        <div className="font-mono font-semibold text-slate-100">
                          {m.isSelesaiBongkar ? formatRp(m.jumlahOngkosVendor) : 'Menunggu Bongkar'}
                        </div>
                        {m.uangJalanHoldBroker > 0 && (
                          <div className="font-mono text-[10px] text-amber-300">
                            Tf {formatRp(m.uangJalanVendor)} · Hold {formatRp(m.uangJalanHoldBroker)}
                          </div>
                        )}
                        {m.biayaKartuGto > 0 && (
                          <div className="font-mono text-[11px] text-amber-300">
                            GTO: {formatRp(m.biayaKartuGto)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-slate-400">
                          Tagihan Pusat{m.sumberUangJalan === 'Pusat' ? ' (Net)' : ''}
                        </div>
                        <div className="font-mono text-slate-200">
                          {m.isSelesaiBongkar ? formatRp(m.tagihanPusat) : '-'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-400">Keuntungan</div>
                        <div className="font-mono font-bold text-emerald-400">
                          {m.isSelesaiBongkar ? formatRp(m.keuntungan) : '-'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleVendorPaymentStatus(r.id)}
                        className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                          isLunas
                            ? 'border-emerald-700 bg-emerald-950 text-emerald-300'
                            : 'border-amber-700 bg-amber-950 text-amber-300'
                        }`}
                      >
                        {isLunas ? 'LUNAS (Ubah)' : 'Tandai Lunas'}
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleDocStatus(r.id)}
                        className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                          isSjLengkap
                            ? 'border-slate-700 bg-slate-950 text-slate-200'
                            : 'border-rose-800 bg-rose-950/60 text-rose-300'
                        }`}
                      >
                        {isSjLengkap ? 'SJ Sudah Balik' : 'SJ Belum Balik'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onTogglePusatPaymentStatus(r.id);
                          onNotify(
                            isPusatPaid
                              ? `Pembayaran Pusat ${r.nopol} diubah menjadi Belum Bayar.`
                              : `Pembayaran Pusat ${r.nopol} ditandai Sudah Bayar.`
                          );
                        }}
                        className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                          isPusatPaid
                            ? 'border-emerald-700 bg-emerald-950 text-emerald-300'
                            : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-blue-500'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        {isPusatPaid ? 'Pusat: Sudah Bayar' : 'Pusat: Belum Bayar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal Update Timbangan Cepat */}
      {weightModalRitase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const muatVal = Math.max(0, Number(quickMuatKg) || 0);
              const bongkarVal = Math.max(0, Number(quickBongkarKg) || 0);
              onUpdateTimbangan(weightModalRitase.id, muatVal, bongkarVal);
              setWeightModalRitase(null);
              onNotify(`Timbangan ${weightModalRitase.nopol} berhasil diperbarui.`);
            }}
            className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
          >
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100">
                <Scale className="h-4 w-4 text-blue-400" />
                Isi / Update Timbangan ({weightModalRitase.nopol})
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {weightModalRitase.namaSopir} · {weightModalRitase.jenisMuatan} ({weightModalRitase.lokasiMuat} → {weightModalRitase.lokasiBongkar})
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="quick-muat" className="block text-xs font-semibold text-slate-300">
                  Berat Muat (Kg)
                </label>
                <input
                  id="quick-muat"
                  type="number"
                  min={0}
                  step="1"
                  value={quickMuatKg}
                  onChange={(e) => setQuickMuatKg(e.target.value)}
                  placeholder="Isi setelah muat"
                  className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="quick-bongkar" className="block text-xs font-semibold text-slate-300">
                  Berat Bongkar (Kg)
                </label>
                <input
                  id="quick-bongkar"
                  type="number"
                  min={0}
                  step="1"
                  value={quickBongkarKg}
                  onChange={(e) => setQuickBongkarKg(e.target.value)}
                  placeholder="Isi setelah bongkar"
                  className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>
            </div>

            {(Number(quickMuatKg) || 0) > 0 && (Number(quickBongkarKg) || 0) > 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs font-mono tabular-nums">
                {(() => {
                  const m = Number(quickMuatKg) || 0;
                  const b = Number(quickBongkarKg) || 0;
                  const s = m - b;
                  const pct = m > 0 ? (s / m) * 100 : 0;
                  const tolPct = computeRitaseMetrics(weightModalRitase).toleransiSusutPersen;
                  return (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">
                        Selisih Susut (Tol {String(tolPct).replace('.', ',')}%):
                      </span>
                      <span
                        className={
                          s > 0 && pct > tolPct ? 'font-bold text-amber-400' : 'font-bold text-emerald-400'
                        }
                      >
                        {s >= 0
                          ? `${formatRibuan(s)} Kg (${pct.toFixed(2)}%)`
                          : `+${formatRibuan(Math.abs(s))} Kg (Lebih)`}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setWeightModalRitase(null)}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="submit"
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Simpan Timbangan
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDeleteId && ritaseToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100">
              Hapus Catatan Ritase {ritaseToDelete.nopol}?
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Muatan {ritaseToDelete.jenisMuatan} tanggal{' '}
              {formatTanggalPendek(ritaseToDelete.tanggalMuat)} akan dihapus permanen.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteRitase(confirmDeleteId);
                  setConfirmDeleteId(null);
                  onNotify('Catatan ritase berhasil dihapus.');
                }}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
