import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileWarning,
  Printer,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { DashboardSubMenu, Ritase, Vendor } from '../types/transport';
import {
  computeRitaseMetrics,
  downloadCsv,
  formatBulanLabel,
  formatRibuan,
  formatRp,
  formatTanggalPendek,
  getCurrentMonthIso,
  getTodayIso,
} from '../utils/formatters';

interface DashboardTabProps {
  vendors: Vendor[];
  ritase: Ritase[];
  subMenu: DashboardSubMenu;
  onChangeSubMenu: (sub: DashboardSubMenu) => void;
  onGoToVendorNota: (vendorId: string) => void;
  onGoToUnreturnedSj: () => void;
  onMarkMultiplePusatPaid: (ids: string[]) => void;
  onTogglePusatPaymentStatus: (id: string) => void;
  onNotify: (message: string) => void;
}

export function DashboardTab({
  vendors,
  ritase,
  subMenu,
  onChangeSubMenu,
  onGoToVendorNota,
  onGoToUnreturnedSj,
  onMarkMultiplePusatPaid,
  onTogglePusatPaymentStatus,
  onNotify,
}: DashboardTabProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedVendorId, setSelectedVendorId] = useState<string>(vendors[0]?.id || '');

  // Sub-menu Tagihan ke Pusat (bisa pilih Semua Vendor atau Per Vendor)
  const [pusatVendorFilter, setPusatVendorFilter] = useState<string>('all');
  const [pusatPayFilter, setPusatPayFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const [copiedPusatWa, setCopiedPusatWa] = useState(false);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(getCurrentMonthIso());
    for (const r of ritase) {
      if (r.tanggalMuat && r.tanggalMuat.length >= 7) {
        months.add(r.tanggalMuat.slice(0, 7));
      }
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [ritase]);

  const filteredRitase = useMemo(() => {
    if (selectedMonth === 'all') return ritase;
    return ritase.filter((r) => r.tanggalMuat.startsWith(selectedMonth));
  }, [ritase, selectedMonth]);

  const vendorMap = useMemo(() => {
    const map = new Map<string, Vendor>();
    for (const v of vendors) map.set(v.id, v);
    return map;
  }, [vendors]);

  const summary = useMemo(() => {
    let tagihanPusatBelumDibayar = 0;
    let countPusatBelumDibayar = 0;
    let sisaKewajibanVendor = 0;
    let countVendorBelumLunas = 0;
    let totalTagihanPusat = 0;
    let totalOngkosVendor = 0;
    let totalKeuntungan = 0;
    let sjBelumBalikCount = 0;

    for (const r of filteredRitase) {
      const m = computeRitaseMetrics(r);
      totalTagihanPusat += m.tagihanPusat;
      totalOngkosVendor += m.jumlahOngkosVendor;
      totalKeuntungan += m.keuntungan;

      if (r.pusatPaymentStatus === 'Belum Dibayar Pusat') {
        tagihanPusatBelumDibayar += m.tagihanPusat;
        countPusatBelumDibayar += 1;
      }

      if (r.vendorPaymentStatus === 'Belum Lunas') {
        sisaKewajibanVendor += m.sisaKewajibanVendor;
        countVendorBelumLunas += 1;
      }

      if (r.docStatus === 'SJ & Tiket Timbang Belum Balik') {
        sjBelumBalikCount += 1;
      }
    }

    return {
      tagihanPusatBelumDibayar,
      countPusatBelumDibayar,
      sisaKewajibanVendor,
      countVendorBelumLunas,
      totalTagihanPusat,
      totalOngkosVendor,
      totalKeuntungan,
      sjBelumBalikCount,
      totalRitaseCount: filteredRitase.length,
    };
  }, [filteredRitase]);

  const vendorSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        vendorId: string;
        vendorName: string;
        paymentInfo: string;
        totalRitase: number;
        unpaidCount: number;
        unpaidAmount: number;
        totalTonase: number;
        totalNilaiOngkos: number;
        items: Ritase[];
      }
    >();

    for (const v of vendors) {
      map.set(v.id, {
        vendorId: v.id,
        vendorName: v.name,
        paymentInfo: v.paymentInfo,
        totalRitase: 0,
        unpaidCount: 0,
        unpaidAmount: 0,
        totalTonase: 0,
        totalNilaiOngkos: 0,
        items: [],
      });
    }

    for (const r of filteredRitase) {
      const m = computeRitaseMetrics(r);
      let row = map.get(r.vendorId);
      if (!row) {
        row = {
          vendorId: r.vendorId,
          vendorName: 'Vendor Terhapus / Lainnya',
          paymentInfo: '-',
          totalRitase: 0,
          unpaidCount: 0,
          unpaidAmount: 0,
          totalTonase: 0,
          totalNilaiOngkos: 0,
          items: [],
        };
        map.set(r.vendorId, row);
      }
      row.totalRitase += 1;
      row.totalTonase += r.beratBongkarKg || 0;
      row.totalNilaiOngkos += m.jumlahOngkosVendor;
      row.items.push(r);
      if (r.vendorPaymentStatus === 'Belum Lunas') {
        row.unpaidCount += 1;
        row.unpaidAmount += m.sisaKewajibanVendor;
      }
    }

    return Array.from(map.values());
  }, [vendors, filteredRitase]);

  const activeVendorDetail = useMemo(() => {
    return (
      vendorSummaries.find((v) => v.vendorId === selectedVendorId) ||
      vendorSummaries[0] ||
      null
    );
  }, [vendorSummaries, selectedVendorId]);

  const vendorsWithUnpaidCount = useMemo(
    () => vendorSummaries.filter((v) => v.unpaidCount > 0).length,
    [vendorSummaries]
  );

  const pusatBillingItems = useMemo(() => {
    return filteredRitase
      .filter((r) => {
        if (pusatVendorFilter !== 'all' && r.vendorId !== pusatVendorFilter) return false;
        if (pusatPayFilter === 'unpaid' && r.pusatPaymentStatus !== 'Belum Dibayar Pusat')
          return false;
        if (pusatPayFilter === 'paid' && r.pusatPaymentStatus !== 'Sudah Dibayar Pusat')
          return false;
        return true;
      })
      .sort((a, b) => a.tanggalMuat.localeCompare(b.tanggalMuat));
  }, [filteredRitase, pusatVendorFilter, pusatPayFilter]);

  const pusatBillingTotals = useMemo(() => {
    let totalTonase = 0;
    let totalTagihanPusat = 0;
    let totalOngkosVendor = 0;
    let totalKeuntungan = 0;
    let unpaidCount = 0;

    for (const r of pusatBillingItems) {
      const m = computeRitaseMetrics(r);
      totalTonase += r.beratBongkarKg || 0;
      totalTagihanPusat += m.tagihanPusat;
      totalOngkosVendor += m.jumlahOngkosVendor;
      totalKeuntungan += m.keuntungan;
      if (r.pusatPaymentStatus === 'Belum Dibayar Pusat') {
        unpaidCount += 1;
      }
    }

    return {
      totalTonase,
      totalTagihanPusat,
      totalOngkosVendor,
      totalKeuntungan,
      unpaidCount,
    };
  }, [pusatBillingItems]);

  const handleCopyPusatWa = async () => {
    const scopeLabel =
      pusatVendorFilter === 'all'
        ? 'Semua Vendor'
        : vendorMap.get(pusatVendorFilter)?.name || 'Vendor Terpilih';

    const lines: string[] = [
      '*REKAP TAGIHAN ANGKUTAN KE PUSAT*',
      `Periode: ${formatBulanLabel(selectedMonth)}`,
      `Cakupan Vendor: ${scopeLabel}`,
      '',
    ];

    pusatBillingItems.forEach((r, idx) => {
      const m = computeRitaseMetrics(r);
      const vName = vendorMap.get(r.vendorId)?.name || 'Vendor';
      lines.push(
        `${idx + 1}. ${formatTanggalPendek(r.tanggalMuat)} | ${r.nopol} (${vName}) | ${
          r.jenisMuatan
        } (${r.lokasiMuat} -> ${r.lokasiBongkar}) | ${formatRibuan(
          r.beratBongkarKg
        )} Kg x ${formatRp(r.hargaPusatPerKg)} = ${formatRp(m.tagihanPusat)}`
      );
    });

    lines.push('');
    lines.push(`Total Tonase Bongkar: ${formatRibuan(pusatBillingTotals.totalTonase)} Kg`);
    lines.push(`*Total Tagihan ke Pusat: ${formatRp(pusatBillingTotals.totalTagihanPusat)}*`);

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedPusatWa(true);
      onNotify('Ringkasan tagihan ke Pusat berhasil disalin untuk WhatsApp.');
      setTimeout(() => setCopiedPusatWa(false), 2500);
    } catch {
      onNotify('Gagal menyalin ke clipboard.');
    }
  };

  const handleExportPusatCsv = () => {
    const headers = [
      'No',
      'Tanggal Muat',
      'Vendor',
      'Nopol',
      'Sopir',
      'Jenis Muatan',
      'Muat',
      'Bongkar',
      'Berat Bongkar (Kg)',
      'Harga Pusat/Kg (Rp)',
      'Tagihan Pusat (Rp)',
      'Harga Jual Vendor/Kg (Rp)',
      'Ongkos Vendor (Rp)',
      'Keuntungan (Rp)',
      'Status Bayar Pusat',
    ];
    const rows = pusatBillingItems.map((r, i) => {
      const m = computeRitaseMetrics(r);
      return [
        i + 1,
        r.tanggalMuat,
        vendorMap.get(r.vendorId)?.name || '-',
        r.nopol,
        r.namaSopir,
        r.jenisMuatan,
        r.lokasiMuat,
        r.lokasiBongkar,
        r.beratBongkarKg,
        r.hargaPusatPerKg,
        m.tagihanPusat,
        r.hargaJualVendorPerKg,
        m.jumlahOngkosVendor,
        m.keuntungan,
        r.pusatPaymentStatus,
      ];
    });
    downloadCsv(`tagihan-pusat-${getTodayIso()}.csv`, headers, rows);
    onNotify('File CSV tagihan ke Pusat berhasil diunduh.');
  };

  const marginPersen =
    summary.totalTagihanPusat > 0
      ? ((summary.totalKeuntungan / summary.totalTagihanPusat) * 100).toFixed(1)
      : '0,0';

  const subMenuTitle =
    subMenu === 'ringkasan'
      ? 'Dashboard & Profit'
      : subMenu === 'per-vendor'
      ? 'Dashboard · Detail Per Vendor'
      : 'Dashboard · Tagihan ke Pusat';

  return (
    <div className="space-y-6">
      {/* Header & Filter Periode */}
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
            {subMenuTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Keuntungan dihitung dari sisa Harga Pusat dikurangi Harga Jual ke Vendor.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label htmlFor="dashboard-month-filter" className="text-xs font-medium text-slate-400 whitespace-nowrap">
            Periode:
          </label>
          <select
            id="dashboard-month-filter"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="all">Semua Waktu ({ritase.length} ritase)</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatBulanLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4 Kartu Ringkasan Utama — Hanya tampil di Dashboard Utama (ringkasan) */}
      {subMenu === 'ringkasan' && (
        <div className="no-print grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-400">
                Tagihan ke Pusat Belum Dibayar
              </span>
              <Receipt className="h-4 w-4 text-slate-500 shrink-0" />
            </div>
            <div className="mt-3 font-mono text-2xl font-bold tracking-tight text-slate-100 tabular-nums">
              {formatRp(summary.tagihanPusatBelumDibayar)}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {summary.countPusatBelumDibayar} ritase menunggu pembayaran dari Pusat
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-400">
                Sisa Kewajiban ke Vendor
              </span>
              <Wallet className="h-4 w-4 text-slate-500 shrink-0" />
            </div>
            <div
              className={`mt-3 font-mono text-2xl font-bold tracking-tight tabular-nums ${
                summary.sisaKewajibanVendor === 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {formatRp(summary.sisaKewajibanVendor)}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {summary.countVendorBelumLunas === 0
                ? 'Semua tagihan vendor sudah lunas'
                : `${summary.countVendorBelumLunas} ritase belum lunas (potong uang jalan)`}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-400">
                Keuntungan Bersih ({summary.totalRitaseCount} Ritase)
              </span>
              <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
            </div>
            <div
              className={`mt-3 font-mono text-2xl font-bold tracking-tight tabular-nums ${
                summary.totalKeuntungan >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatRp(summary.totalKeuntungan)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-400 tabular-nums">
              <span>Pusat {formatRp(summary.totalTagihanPusat)}</span>
              <span aria-hidden="true">·</span>
              <span>Margin {marginPersen.replace('.', ',')}%</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-400">
                SJ Balik Belum Diterima
              </span>
              {summary.sjBelumBalikCount > 0 ? (
                <FileWarning className="h-4 w-4 text-amber-400 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={`font-mono text-2xl font-bold tracking-tight tabular-nums ${
                  summary.sjBelumBalikCount > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {summary.sjBelumBalikCount}
              </span>
              <span className="text-sm text-slate-400">ritase</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">
                {summary.sjBelumBalikCount === 0 ? 'Semua SJ lengkap' : 'Menunggu dokumen balik'}
              </span>
              {summary.sjBelumBalikCount > 0 && (
                <button
                  type="button"
                  onClick={onGoToUnreturnedSj}
                  className="text-xs font-semibold text-blue-400 hover:underline whitespace-nowrap"
                >
                  Cek di Daftar Ritase
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-MENU 1: RINGKASAN UTAMA */}
      {subMenu === 'ringkasan' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Building2 className="h-4 w-4 text-blue-400" />
                Kewajiban Per Vendor
              </div>
              <p className="mt-2 text-sm text-slate-400">
                {vendorsWithUnpaidCount === 0
                  ? 'Semua vendor sudah lunas pada periode ini.'
                  : `Ada ${vendorsWithUnpaidCount} dari ${vendors.length} vendor yang memiliki tagihan belum lunas.`}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                Total belum lunas:{' '}
                <strong className="text-slate-100">{formatRp(summary.sisaKewajibanVendor)}</strong>
              </span>
              <button
                type="button"
                onClick={() => onChangeSubMenu('per-vendor')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 whitespace-nowrap"
              >
                Pilih Vendor
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Receipt className="h-4 w-4 text-emerald-400" />
                Tagihan Semua Vendor ke Pusat
              </div>
              <p className="mt-2 text-sm text-slate-400">
                {summary.countPusatBelumDibayar === 0
                  ? 'Seluruh tagihan ke Pusat pada periode ini sudah dibayar.'
                  : `Terdapat ${summary.countPusatBelumDibayar} ritase yang belum dibayar oleh Pusat.`}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                Total belum dibayar:{' '}
                <strong className="text-slate-100">{formatRp(summary.tagihanPusatBelumDibayar)}</strong>
              </span>
              <button
                type="button"
                onClick={() => onChangeSubMenu('tagihan-pusat')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 whitespace-nowrap"
              >
                Lihat Tagihan ke Pusat
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MENU 2: PILIH VENDOR */}
      {subMenu === 'per-vendor' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <label htmlFor="sub-select-vendor" className="block text-xs font-semibold text-slate-300">
                  Pilih Vendor yang Ingin Dilihat
                </label>
                <select
                  id="sub-select-vendor"
                  value={activeVendorDetail?.vendorId || ''}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  className="mt-1.5 w-full sm:w-80 min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {vendorSummaries.map((v) => (
                    <option key={v.vendorId} value={v.vendorId}>
                      {v.vendorName} — Sisa {formatRp(v.unpaidAmount)}
                    </option>
                  ))}
                </select>
              </div>

              {activeVendorDetail && (
                <button
                  type="button"
                  onClick={() => onGoToVendorNota(activeVendorDetail.vendorId)}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 whitespace-nowrap self-start sm:self-end"
                >
                  Cetak Nota Vendor Ini
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              )}
            </div>

            {vendorSummaries.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                {vendorSummaries.map((v) => {
                  const isCurrent = activeVendorDetail?.vendorId === v.vendorId;
                  return (
                    <button
                      key={v.vendorId}
                      type="button"
                      onClick={() => setSelectedVendorId(v.vendorId)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isCurrent
                          ? 'border-blue-500 bg-blue-950/70 text-blue-300 font-semibold'
                          : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {v.vendorName}{' '}
                      <span className="font-mono text-[11px] opacity-80">
                        ({v.unpaidCount} blm lunas)
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {activeVendorDetail ? (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              <div className="grid grid-cols-2 gap-4 border-b border-slate-800 bg-slate-950/60 p-5 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-400">Sisa Tagihan Belum Lunas</div>
                  <div
                    className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                      activeVendorDetail.unpaidAmount === 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {formatRp(activeVendorDetail.unpaidAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Ritase Belum Lunas</div>
                  <div className="mt-1 font-mono text-lg font-bold text-slate-100 tabular-nums">
                    {activeVendorDetail.unpaidCount} / {activeVendorDetail.totalRitase}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Total Tonase Bongkar</div>
                  <div className="mt-1 font-mono text-lg font-bold text-slate-100 tabular-nums">
                    {formatRibuan(activeVendorDetail.totalTonase)} Kg
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Total Ongkos (Arsip+Aktif)</div>
                  <div className="mt-1 font-mono text-lg font-bold text-slate-100 tabular-nums">
                    {formatRp(activeVendorDetail.totalNilaiOngkos)}
                  </div>
                </div>
              </div>

              {activeVendorDetail.items.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  Belum ada data ritase untuk vendor ini pada periode terpilih.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40 font-semibold text-slate-400">
                        <th className="px-4 py-3">Tanggal</th>
                        <th className="px-3 py-3">Nopol / Sopir</th>
                        <th className="px-3 py-3">Muatan &amp; Rute</th>
                        <th className="px-3 py-3 text-right">Bongkar (Kg)</th>
                        <th className="px-3 py-3 text-right">Ongkos Vendor</th>
                        <th className="px-3 py-3 text-right">Uang Jalan</th>
                        <th className="px-4 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {activeVendorDetail.items
                        .slice()
                        .sort((a, b) => b.tanggalMuat.localeCompare(a.tanggalMuat))
                        .map((r) => {
                          const m = computeRitaseMetrics(r);
                          return (
                            <tr key={r.id} className="hover:bg-slate-800/40">
                              <td className="px-4 py-3 font-mono text-slate-200 tabular-nums">
                                {formatTanggalPendek(r.tanggalMuat)}
                              </td>
                              <td className="px-3 py-3">
                                <span className="font-mono font-semibold text-blue-400">
                                  {r.nopol}
                                </span>
                                <span className="text-slate-600"> · </span>
                                <span className="text-slate-300">{r.namaSopir}</span>
                              </td>
                              <td className="px-3 py-3 text-slate-300">
                                {r.jenisMuatan} ({r.lokasiMuat} → {r.lokasiBongkar})
                              </td>
                              <td className="px-3 py-3 text-right font-mono text-slate-200 tabular-nums">
                                {formatRibuan(r.beratBongkarKg)}
                              </td>
                              <td className="px-3 py-3 text-right font-mono font-semibold text-slate-100 tabular-nums">
                                {formatRp(m.jumlahOngkosVendor)}
                              </td>
                              <td className="px-3 py-3 text-right font-mono text-slate-300 tabular-nums">
                                {formatRp(m.uangJalan)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold">
                                <span
                                  className={
                                    r.vendorPaymentStatus === 'Lunas'
                                      ? 'text-emerald-400'
                                      : 'text-amber-400'
                                  }
                                >
                                  {r.vendorPaymentStatus === 'Lunas' ? 'LUNAS' : 'Belum Lunas'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">
              Belum ada vendor terdaftar.
            </div>
          )}
        </div>
      )}

      {/* SUB-MENU 3: TAGIHAN SEMUA VENDOR KE PUSAT */}
      {subMenu === 'tagihan-pusat' && (
        <div className="space-y-4">
          <div className="no-print rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="pusat-vendor-filter" className="block text-xs font-semibold text-slate-300">
                  Cakupan Vendor
                </label>
                <select
                  id="pusat-vendor-filter"
                  value={pusatVendorFilter}
                  onChange={(e) => setPusatVendorFilter(e.target.value)}
                  className="mt-1.5 w-full min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="all">Semua Vendor (Gabungan)</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="pusat-pay-filter" className="block text-xs font-semibold text-slate-300">
                  Status Pembayaran Pusat
                </label>
                <select
                  id="pusat-pay-filter"
                  value={pusatPayFilter}
                  onChange={(e) =>
                    setPusatPayFilter(e.target.value as 'unpaid' | 'paid' | 'all')
                  }
                  className="mt-1.5 w-full min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="unpaid">Belum Dibayar Pusat</option>
                  <option value="paid">Sudah Dibayar Pusat</option>
                  <option value="all">Semua Status</option>
                </select>
              </div>

              <div className="flex flex-col justify-end rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5">
                <div className="text-[11px] font-medium text-slate-400">
                  Tagihan ke Pusat ({pusatBillingItems.length} Ritase · Untung{' '}
                  {formatRp(pusatBillingTotals.totalKeuntungan)})
                </div>
                <div className="font-mono text-lg font-bold text-slate-100 tabular-nums">
                  {formatRp(pusatBillingTotals.totalTagihanPusat)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                disabled={pusatBillingTotals.unpaidCount === 0}
                onClick={() => {
                  const unpaidIds = pusatBillingItems
                    .filter((r) => r.pusatPaymentStatus === 'Belum Dibayar Pusat')
                    .map((r) => r.id);
                  onMarkMultiplePusatPaid(unpaidIds);
                  onNotify(`${unpaidIds.length} tagihan ke Pusat ditandai Sudah Dibayar.`);
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-950/70 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/60 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <CheckCircle2 className="h-4 w-4" />
                Tandai Semua Sudah Dibayar Pusat ({pusatBillingTotals.unpaidCount})
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={pusatBillingItems.length === 0}
                  onClick={handleCopyPusatWa}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-45 whitespace-nowrap"
                >
                  {copiedPusatWa ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedPusatWa ? 'Tersalin' : 'Salin Tagihan WA'}
                </button>

                <button
                  type="button"
                  disabled={pusatBillingItems.length === 0}
                  onClick={handleExportPusatCsv}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-45 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV
                </button>

                <button
                  type="button"
                  disabled={pusatBillingItems.length === 0}
                  onClick={() => window.print()}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-45 whitespace-nowrap"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Cetak Tagihan Pusat
                </button>
              </div>
            </div>
          </div>

          {/* Printable White Paper Preview for Pusat Billing */}
          <div className="print-only-container rounded-xl border border-slate-700 bg-white p-5 sm:p-6 text-black">
            <h2 className="text-center text-base font-bold text-black sm:text-lg">
              Rekap Tagihan Angkutan ke Pusat
            </h2>
            <div className="mt-2 mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
              <span>
                Vendor:{' '}
                <strong className="text-black">
                  {pusatVendorFilter === 'all'
                    ? 'Semua Vendor'
                    : vendorMap.get(pusatVendorFilter)?.name || '-'}
                </strong>
              </span>
              <span>
                Periode: <strong className="text-black">{formatBulanLabel(selectedMonth)}</strong>
              </span>
            </div>

            {pusatBillingItems.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                Tidak ada data tagihan ke Pusat untuk filter saat ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="print-table w-full border-collapse border border-slate-900 text-xs text-black">
                  <thead>
                    <tr className="bg-slate-200 font-bold text-black">
                      <th className="border border-slate-900 px-2 py-2 text-center w-9">No</th>
                      <th className="border border-slate-900 px-2 py-2 text-center">Tanggal</th>
                      <th className="border border-slate-900 px-2 py-2 text-left">Vendor</th>
                      <th className="border border-slate-900 px-2 py-2 text-center">Nopol</th>
                      <th className="border border-slate-900 px-2 py-2 text-left">Muatan &amp; Rute</th>
                      <th className="border border-slate-900 px-2 py-2 text-right">Tonase (Kg)</th>
                      <th className="border border-slate-900 px-2 py-2 text-right">Harga Pusat/Kg</th>
                      <th className="border border-slate-900 px-2 py-2 text-right">Tagihan Pusat (Rp)</th>
                      <th className="no-print border border-slate-900 px-2 py-2 text-center whitespace-nowrap">
                        Status Bayar Pusat (1-Klik)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pusatBillingItems.map((r, idx) => {
                      const m = computeRitaseMetrics(r);
                      const isPusatPaid = r.pusatPaymentStatus === 'Sudah Dibayar Pusat';
                      return (
                        <tr key={r.id}>
                          <td className="border border-slate-900 px-2 py-1.5 text-center font-mono">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-900 px-2 py-1.5 text-center font-mono whitespace-nowrap">
                            {formatTanggalPendek(r.tanggalMuat)}
                          </td>
                          <td className="border border-slate-900 px-2 py-1.5">
                            {vendorMap.get(r.vendorId)?.name || '-'}
                          </td>
                          <td className="border border-slate-900 px-2 py-1.5 text-center font-mono whitespace-nowrap">
                            {r.nopol}
                          </td>
                          <td className="border border-slate-900 px-2 py-1.5">
                            {r.jenisMuatan} ({r.lokasiMuat} → {r.lokasiBongkar})
                          </td>
                          <td className="border border-slate-900 px-2 py-1.5 text-right font-mono tabular-nums">
                            {formatRibuan(r.beratBongkarKg)}
                          </td>
                          <td className="border border-slate-900 px-2 py-1.5 text-right font-mono tabular-nums">
                            {formatRp(r.hargaPusatPerKg)}
                          </td>
                          <td className="border border-slate-900 px-2 py-1.5 text-right font-mono font-semibold tabular-nums">
                            {formatRp(m.tagihanPusat)}
                          </td>
                          <td className="no-print border border-slate-900 px-2 py-1.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                onTogglePusatPaymentStatus(r.id);
                                onNotify(
                                  isPusatPaid
                                    ? `Tagihan Pusat ${r.nopol} diubah menjadi Belum Dibayar.`
                                    : `Tagihan Pusat ${r.nopol} ditandai Sudah Dibayar.`
                                );
                              }}
                              className={`inline-flex min-h-[28px] items-center gap-1 rounded border px-2 py-1 text-[11px] font-bold transition-colors ${
                                isPusatPaid
                                  ? 'border-emerald-700 bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                                  : 'border-amber-600 bg-amber-100 text-amber-950 hover:bg-amber-200'
                              }`}
                            >
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              {isPusatPaid ? 'Sudah Dibayar' : 'Belum Dibayar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="print-row-highlight bg-slate-200 font-bold text-black">
                      <td colSpan={5} className="border border-slate-900 px-3 py-2 text-right">
                        Total Tagihan ke Pusat
                      </td>
                      <td className="border border-slate-900 px-2 py-2 text-right font-mono tabular-nums">
                        {formatRibuan(pusatBillingTotals.totalTonase)}
                      </td>
                      <td className="border border-slate-900 px-2 py-2"></td>
                      <td className="border border-slate-900 px-2 py-2 text-right font-mono tabular-nums">
                        {formatRp(pusatBillingTotals.totalTagihanPusat)}
                      </td>
                      <td className="no-print border border-slate-900 px-2 py-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
