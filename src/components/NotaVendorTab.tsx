import React, { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Copy, FileSpreadsheet, Printer } from 'lucide-react';
import { NotaAdjustment, Ritase, Vendor } from '../types/transport';
import { exportNotaVendorExcel } from '../utils/excelExport';
import {
  computeRitaseMetrics,
  formatRibuan,
  formatRp,
  formatTanggalPendek,
  formatUangJalanCell,
} from '../utils/formatters';

interface NotaVendorTabProps {
  vendors: Vendor[];
  ritase: Ritase[];
  notaAdjustments: Record<string, NotaAdjustment>;
  selectedVendorIdProp?: string;
  onUpdateNotaAdjustment: (key: string, adj: NotaAdjustment) => void;
  onMarkMultipleLunas: (ids: string[]) => void;
  onNotify: (message: string) => void;
}

type NotaStatusFilter = 'unpaid' | 'paid' | 'all';

const DEFAULT_ADJ: NotaAdjustment = {
  biayaKartuGto: '0',
  tarifClaimPerKg: '0',
  tarifClaimPerRitase: {},
};

export function NotaVendorTab({
  vendors,
  ritase,
  notaAdjustments,
  selectedVendorIdProp,
  onUpdateNotaAdjustment,
  onMarkMultipleLunas,
  onNotify,
}: NotaVendorTabProps) {
  const [vendorId, setVendorId] = useState<string>(
    selectedVendorIdProp || vendors[0]?.id || 'all'
  );
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<NotaStatusFilter>('unpaid');

  const [copiedWa, setCopiedWa] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [confirmLunasOpen, setConfirmLunasOpen] = useState(false);

  useEffect(() => {
    if (selectedVendorIdProp) {
      setVendorId(selectedVendorIdProp);
    }
  }, [selectedVendorIdProp]);

  useEffect(() => {
    if (!vendorId && vendors.length > 0) {
      setVendorId(vendors[0].id);
    }
  }, [vendors, vendorId]);

  const activeAdjKey = vendorId || 'all';
  const currentAdj: NotaAdjustment = notaAdjustments[activeAdjKey] || DEFAULT_ADJ;

  const setAdjField = (field: 'biayaKartuGto', value: string) => {
    onUpdateNotaAdjustment(activeAdjKey, {
      ...currentAdj,
      [field]: value,
    });
  };

  const setRitaseClaimTarif = (ritaseId: string, value: string) => {
    onUpdateNotaAdjustment(activeAdjKey, {
      ...currentAdj,
      tarifClaimPerRitase: {
        ...(currentAdj.tarifClaimPerRitase || {}),
        [ritaseId]: value,
      },
    });
  };

  const vendorMap = useMemo(() => {
    const map = new Map<string, Vendor>();
    for (const v of vendors) map.set(v.id, v);
    return map;
  }, [vendors]);

  const isAllVendors = vendorId === 'all';
  const selectedVendor = useMemo(
    () => (isAllVendors ? null : vendors.find((v) => v.id === vendorId) || null),
    [vendors, vendorId, isAllVendors]
  );

  const filteredItems = useMemo(() => {
    if (!vendorId) return [];
    return ritase
      .filter((r) => {
        if (!isAllVendors && r.vendorId !== vendorId) return false;
        if (dateFrom && r.tanggalMuat < dateFrom) return false;
        if (dateTo && r.tanggalMuat > dateTo) return false;
        if (statusFilter === 'unpaid' && r.vendorPaymentStatus !== 'Belum Lunas') return false;
        if (statusFilter === 'paid' && r.vendorPaymentStatus !== 'Lunas') return false;
        return true;
      })
      .sort((a, b) => a.tanggalMuat.localeCompare(b.tanggalMuat));
  }, [ritase, vendorId, isAllVendors, dateFrom, dateTo, statusFilter]);

  const totals = useMemo(() => {
    let totalTonase = 0;
    let totalJumlahOngkos = 0;
    let totalUangJalan = 0;
    let unpaidCount = 0;

    const ritaseDetails = filteredItems.map((r) => {
      const m = computeRitaseMetrics(r);
      totalTonase += r.beratBongkarKg || 0;
      totalJumlahOngkos += m.jumlahOngkosVendor;
      totalUangJalan += m.uangJalan;
      if (r.vendorPaymentStatus === 'Belum Lunas') {
        unpaidCount += 1;
      }

      const beratMuatKg = r.beratMuatKg || 0;
      const beratBongkarKg = r.beratBongkarKg || 0;
      const susutAktualKg = Math.max(0, beratMuatKg - beratBongkarKg);
      const susutPersen = beratMuatKg > 0 ? (susutAktualKg / beratMuatKg) * 100 : 0;
      // Toleransi susut 0,3% dihitung per ritase / nopol masing-masing
      const toleransi03Kg = beratMuatKg * 0.003;
      const susutKenaClaimKg = Math.max(0, susutAktualKg - toleransi03Kg);
      const kenaClaim = susutKenaClaimKg > 0;

      const tarifStr =
        currentAdj.tarifClaimPerRitase?.[r.id] ?? currentAdj.tarifClaimPerKg ?? '0';
      const hargaClaimPerKg = Math.max(0, Number(tarifStr) || 0);
      const claimSusutRp = kenaClaim ? Math.round(susutKenaClaimKg * hargaClaimPerKg) : 0;

      return {
        r,
        beratMuatKg,
        beratBongkarKg,
        susutAktualKg,
        susutPersen,
        toleransi03Kg,
        susutKenaClaimKg,
        kenaClaim,
        tarifStr,
        hargaClaimPerKg,
        claimSusutRp,
      };
    });

    const claimItems = ritaseDetails.filter((d) => d.kenaClaim);
    const adaClaim = claimItems.length > 0;
    const totalSusutKenaClaimKg = claimItems.reduce((sum, d) => sum + d.susutKenaClaimKg, 0);
    const totalClaimSusutRp = claimItems.reduce((sum, d) => sum + d.claimSusutRp, 0);

    const gtoVal = Math.max(0, Number(currentAdj.biayaKartuGto) || 0);
    const kekuranganPembayaran = totalJumlahOngkos - gtoVal - totalClaimSusutRp - totalUangJalan;

    return {
      ritaseDetails,
      claimItems,
      adaClaim,
      totalSusutKenaClaimKg,
      totalClaimSusutRp,
      totalTonase,
      totalJumlahOngkos,
      totalUangJalan,
      gtoVal,
      kekuranganPembayaran,
      unpaidCount,
    };
  }, [filteredItems, currentAdj]);

  const formatKgDesimal = (val: number) =>
    val.toLocaleString('id-ID', {
      minimumFractionDigits: val % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });

  const handleCopyWhatsApp = async () => {
    const vendorLabel = isAllVendors
      ? 'Semua Vendor (Rekap Gabungan)'
      : selectedVendor?.name || '-';
    const paymentLabel = isAllVendors
      ? 'Sesuai rekening masing-masing vendor'
      : selectedVendor?.paymentInfo || '-';

    const periodeText =
      dateFrom || dateTo
        ? `${dateFrom ? formatTanggalPendek(dateFrom) : 'Awal'} s/d ${
            dateTo ? formatTanggalPendek(dateTo) : 'Sekarang'
          }`
        : 'Semua Tanggal';

    const lines: string[] = [
      '*RINCIAN ONGKOS PEMBAYARAN*',
      `Vendor: *${vendorLabel}*`,
      `Periode: ${periodeText}`,
      `Status Data: ${
        statusFilter === 'unpaid'
          ? 'Belum Lunas'
          : statusFilter === 'paid'
          ? 'Arsip Lunas'
          : 'Semua Data'
      }`,
      '',
      '*Daftar Ritase:*',
    ];

    filteredItems.forEach((r, idx) => {
      const m = computeRitaseMetrics(r);
      const vPrefix = isAllVendors ? `[${vendorMap.get(r.vendorId)?.name || 'Vendor'}] ` : '';
      lines.push(
        `${idx + 1}. ${vPrefix}${formatTanggalPendek(r.tanggalMuat)} | ${r.nopol} (${r.namaSopir}) | ${
          r.jenisMuatan
        } | ${r.lokasiMuat} -> ${r.lokasiBongkar} | ${formatRibuan(
          r.beratBongkarKg
        )} Kg x ${formatRp(r.hargaJualVendorPerKg)} = ${formatRp(m.jumlahOngkosVendor)}${
          m.uangJalan > 0 ? ` (DP: ${formatRp(m.uangJalan)})` : ''
        }`
      );
    });

    lines.push('');
    lines.push(`Total Tonase: ${formatRibuan(totals.totalTonase)} Kg`);
    lines.push(`Total Ongkos Angkutan: ${formatRp(totals.totalJumlahOngkos)}`);
    if (totals.gtoVal > 0) {
      lines.push(`Biaya Reistrasi Kartu GTO: -${formatRp(totals.gtoVal)}`);
    }
    if (totals.adaClaim) {
      lines.push(`Total Claim Susut Timbangan (${totals.claimItems.length} Ritase): -${formatRp(totals.totalClaimSusutRp)}`);
    }
    lines.push(`DP / Uang Jalan: -${formatRp(totals.totalUangJalan)}`);
    lines.push(`*Kekurangan Pembayaran (Total Transfer): ${formatRp(totals.kekuranganPembayaran)}*`);
    lines.push('');
    lines.push('*Rincian Muatan & Claim Susut Per Ritase / Nopol (Toleransi 0,3%):*');
    totals.ritaseDetails.forEach((item, idx) => {
      const claimStatusText = item.kenaClaim
        ? `Kena Claim ${formatKgDesimal(item.susutKenaClaimKg)} Kg x ${formatRp(
            item.hargaClaimPerKg
          )} = ${formatRp(item.claimSusutRp)}`
        : 'Dalam toleransi <= 0,3% (Rp 0)';
      lines.push(
        `${idx + 1}. ${formatTanggalPendek(item.r.tanggalMuat)} | ${item.r.nopol} | ${
          item.r.jenisMuatan
        } | Muat ${formatRibuan(item.beratMuatKg)} Kg -> Bongkar ${formatRibuan(
          item.beratBongkarKg
        )} Kg | Susut ${formatRibuan(item.susutAktualKg)} Kg (${item.susutPersen.toFixed(
          2
        )}%) | Tol 0,3%: ${formatKgDesimal(item.toleransi03Kg)} Kg | ${claimStatusText}`
      );
    });
    lines.push('');
    lines.push(`*Pembayaran:* ${paymentLabel}`);

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedWa(true);
      onNotify('Teks ringkasan WhatsApp berhasil disalin.');
      setTimeout(() => setCopiedWa(false), 2500);
    } catch {
      onNotify('Gagal menyalin otomatis. Silakan periksa izin clipboard browser.');
    }
  };

  const handleConfirmMarkAllLunas = () => {
    const unpaidIds = filteredItems
      .filter((r) => r.vendorPaymentStatus === 'Belum Lunas')
      .map((r) => r.id);
    onMarkMultipleLunas(unpaidIds);
    setConfirmLunasOpen(false);
    onNotify(
      `${unpaidIds.length} item ritase pada nota ini ditandai LUNAS. Seluruh data dan angkanya tetap tersimpan utuh di arsip.`
    );
  };

  const handleExportExcel = async () => {
    if (filteredItems.length === 0 || exportingExcel) return;
    setExportingExcel(true);
    try {
      const vendorLabel = isAllVendors
        ? 'Semua Vendor (Rekap Gabungan)'
        : selectedVendor?.name || '-';
      const paymentLabel = isAllVendors
        ? 'Sesuai rekening masing-masing vendor pada Master Data'
        : selectedVendor?.paymentInfo || '-';
      const periodeLabel =
        dateFrom || dateTo
          ? `${dateFrom ? formatTanggalPendek(dateFrom) : 'Awal'} s/d ${
              dateTo ? formatTanggalPendek(dateTo) : 'Sekarang'
            }`
          : 'Semua Tanggal';
      const statusLabel =
        statusFilter === 'unpaid'
          ? 'Belum Lunas'
          : statusFilter === 'paid'
          ? 'Arsip Lunas'
          : 'Semua Data';

      const fileName = await exportNotaVendorExcel({
        vendorName: vendorLabel,
        paymentInfo: paymentLabel,
        periodeLabel,
        statusLabel,
        isAllVendors,
        vendorMap,
        items: filteredItems,
        ritaseDetails: totals.ritaseDetails,
        totalTonase: totals.totalTonase,
        totalJumlahOngkos: totals.totalJumlahOngkos,
        totalUangJalan: totals.totalUangJalan,
        gtoVal: totals.gtoVal,
        adaClaim: totals.adaClaim,
        claimCount: totals.claimItems.length,
        totalClaimSusutRp: totals.totalClaimSusutRp,
        kekuranganPembayaran: totals.kekuranganPembayaran,
      });
      onNotify(`File Excel ${fileName} berhasil dibuat.`);
    } catch {
      onNotify('Gagal membuat file Excel. Silakan coba lagi.');
    } finally {
      setExportingExcel(false);
    }
  };

  const colSpanCount = isAllVendors ? 8 : 7;

  return (
    <div className="space-y-6">
      {/* Control Panel (Dark UI, Hidden when printing) */}
      <div className="no-print space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
            Cetak Rincian Pembayaran Vendor
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Toleransi susut adalah 0,3% dari total muatan awal. Kolom Claim Susut hanya muncul otomatis jika susut melebihi batas toleransi.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Filter Laporan */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-6">
            <h2 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-2.5">
              Filter Laporan Nota
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="nota-vendor" className="block text-xs font-semibold text-slate-300">
                  Pilih Vendor
                </label>
                <select
                  id="nota-vendor"
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="all">Semua Vendor (Rekap Gabungan)</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="nota-from" className="block text-xs font-semibold text-slate-300">
                  Dari Tanggal Muat
                </label>
                <input
                  id="nota-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1.5 w-full min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="nota-to" className="block text-xs font-semibold text-slate-300">
                  Sampai Tanggal Muat
                </label>
                <input
                  id="nota-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1.5 w-full min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor="nota-status" className="block text-xs font-semibold text-slate-300">
                    Filter Status Data
                  </label>
                  <select
                    id="nota-status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as NotaStatusFilter)}
                    className="mt-1.5 w-full min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <option value="unpaid">Hanya yang Belum Lunas (Default)</option>
                    <option value="paid">Arsip yang Sudah Lunas (Cetak Ulang)</option>
                    <option value="all">Semua (Belum Lunas + Arsip Lunas)</option>
                  </select>
                </div>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 whitespace-nowrap"
                  >
                    Reset Tanggal
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Potongan Khusus Nota Ini */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h2 className="text-sm font-semibold text-slate-100">
                Potongan Khusus Nota Ini
              </h2>
              <button
                type="button"
                onClick={() => onUpdateNotaAdjustment(activeAdjKey, DEFAULT_ADJ)}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-200"
              >
                Reset Potongan
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="nota-gto" className="block text-xs font-semibold text-slate-300">
                  Biaya Reistrasi Kartu GTO (Rp)
                </label>
                <input
                  id="nota-gto"
                  type="number"
                  min={0}
                  step="1000"
                  value={currentAdj.biayaKartuGto}
                  onChange={(e) => setAdjField('biayaKartuGto', e.target.value)}
                  className="mt-1.5 w-full min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>

              {/* Status Toleransi Susut 0,3% Per Ritase / Nopol */}
              <div
                className={`rounded-lg border p-3.5 space-y-3 ${
                  totals.adaClaim
                    ? 'border-amber-700/70 bg-amber-950/30'
                    : 'border-emerald-800/60 bg-emerald-950/25'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-200">
                    Pengecekan Susut Per Nopol / Ritase (Toleransi 0,3%)
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      totals.adaClaim ? 'text-amber-300' : 'text-emerald-300'
                    }`}
                  >
                    {totals.claimItems.length} / {filteredItems.length} ritase kena claim
                  </span>
                </div>

                {totals.adaClaim ? (
                  <div className="border-t border-amber-700/40 pt-3 space-y-3">
                    {totals.claimItems.map((item) => (
                      <div
                        key={`claim-input-${item.r.id}`}
                        className="rounded-lg border border-amber-700/50 bg-slate-950/70 p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-amber-300">
                            {formatTanggalPendek(item.r.tanggalMuat)} · {item.r.nopol} ·{' '}
                            {item.r.jenisMuatan}
                          </span>
                          <span className="font-mono font-bold text-amber-200 tabular-nums">
                            {formatRp(item.claimSusutRp)}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400 font-mono tabular-nums">
                          <div>
                            Muat: <span className="text-slate-200">{formatRibuan(item.beratMuatKg)} Kg</span>
                          </div>
                          <div>
                            Susut:{' '}
                            <span className="text-amber-300">
                              {formatRibuan(item.susutAktualKg)} Kg ({item.susutPersen.toFixed(2)}%)
                            </span>
                          </div>
                          <div>
                            Tol 0,3%:{' '}
                            <span className="text-slate-200">{formatKgDesimal(item.toleransi03Kg)} Kg</span>
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor={`nota-harga-claim-${item.r.id}`}
                            className="block text-xs font-semibold text-slate-200"
                          >
                            Harga Barang per Kg untuk Claim ({item.r.nopol})
                          </label>
                          <input
                            id={`nota-harga-claim-${item.r.id}`}
                            type="number"
                            min={0}
                            step="100"
                            value={item.tarifStr}
                            onChange={(e) => setRitaseClaimTarif(item.r.id, e.target.value)}
                            placeholder="Masukkan harga barang per kg..."
                            className="mt-1 w-full min-h-[38px] rounded-lg border border-amber-600/60 bg-slate-950 px-3 py-1.5 font-mono text-sm text-slate-100 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                          />
                          <p className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums">
                            ({formatRibuan(item.susutAktualKg)} − {formatKgDesimal(item.toleransi03Kg)}) Kg ={' '}
                            {formatKgDesimal(item.susutKenaClaimKg)} Kg × {formatRp(item.hargaClaimPerKg)} ={' '}
                            {formatRp(item.claimSusutRp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-t border-emerald-800/40 pt-2.5 text-xs font-medium text-emerald-300">
                    Semua ritase memiliki susut ≤ 0,3% pada masing-masing muatan. Tidak ada claim susut (kolom harga &amp; baris Claim Susut tidak ditampilkan di nota).
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
          <div className="text-xs text-slate-400">
            Menampilkan <strong className="text-slate-100">{filteredItems.length}</strong> ritase
            {totals.unpaidCount > 0 && (
              <span>
                {' '}
                (<strong className="text-amber-400">{totals.unpaidCount}</strong> belum lunas)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={totals.unpaidCount === 0}
              onClick={() => setConfirmLunasOpen(true)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-950/70 px-4 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
            >
              <CheckCircle2 className="h-4 w-4" />
              Tandai Semua Item di Nota Ini LUNAS
            </button>

            <button
              type="button"
              disabled={filteredItems.length === 0}
              onClick={handleCopyWhatsApp}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
            >
              {copiedWa ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copiedWa ? 'Teks WA Tersalin' : 'Salin Teks Ringkasan WA'}
            </button>

            <button
              type="button"
              disabled={filteredItems.length === 0 || exportingExcel}
              onClick={handleExportExcel}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {exportingExcel ? 'Menyiapkan Excel...' : 'Cetak / Download Excel (.xlsx)'}
            </button>

            <button
              type="button"
              disabled={filteredItems.length === 0}
              onClick={() => window.print()}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
            >
              <Printer className="h-4 w-4" />
              Cetak / Simpan PDF
            </button>
          </div>
        </div>
      </div>

      {/* PREVIEW KERTAS NOTA PUTIH (A4 Landscape 1:1) */}
      <div className="print-only-container rounded-xl border border-slate-700 bg-white p-5 sm:p-8 text-black">
        <h2 className="text-center text-lg font-bold tracking-tight text-black sm:text-xl">
          Rincian Ongkos Pembayaran
        </h2>

        <div className="mt-5 mb-4 grid grid-cols-[105px_12px_1fr] gap-y-1 text-xs text-black sm:text-sm">
          <div className="font-semibold">Vendor</div>
          <div className="font-semibold">:</div>
          <div className="font-semibold">
            {isAllVendors ? 'Semua Vendor (Rekap Gabungan)' : selectedVendor?.name || '-'}
          </div>

          <div className="font-semibold">Pembayaran</div>
          <div className="font-semibold">:</div>
          <div>
            {isAllVendors
              ? 'Sesuai rekening masing-masing vendor pada Master Data'
              : selectedVendor?.paymentInfo || '-'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="print-table w-full border-collapse border border-slate-900 text-xs text-black">
            <thead>
              <tr className="bg-slate-200 font-bold text-black">
                <th className="border border-slate-900 px-2 py-2 text-center w-9">No</th>
                <th className="border border-slate-900 px-2 py-2 text-center whitespace-nowrap">
                  Tanggal
                </th>
                {isAllVendors && (
                  <th className="border border-slate-900 px-2 py-2 text-left">Vendor</th>
                )}
                <th className="border border-slate-900 px-2 py-2 text-center whitespace-nowrap">
                  Nopol
                </th>
                <th className="border border-slate-900 px-2 py-2 text-left">Sopir</th>
                <th className="border border-slate-900 px-2 py-2 text-left">Jenis Muatan</th>
                <th className="border border-slate-900 px-2 py-2 text-left">Muat</th>
                <th className="border border-slate-900 px-2 py-2 text-left">Bongkar</th>
                <th className="border border-slate-900 px-2 py-2 text-right whitespace-nowrap">
                  Tonase (Kg)
                </th>
                <th className="border border-slate-900 px-2 py-2 text-right whitespace-nowrap">
                  OA/Kg (Rp)
                </th>
                <th className="border border-slate-900 px-2 py-2 text-right whitespace-nowrap">
                  Jumlah Ongkos (Rp)
                </th>
                <th className="border border-slate-900 px-2 py-2 text-right whitespace-nowrap">
                  Uang Jalan (Rp)
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAllVendors ? 12 : 11}
                    className="border border-slate-900 px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Tidak ada ritase untuk vendor dan filter yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredItems.map((r, idx) => {
                  const m = computeRitaseMetrics(r);
                  return (
                    <tr key={r.id}>
                      <td className="border border-slate-900 px-2 py-1.5 text-center font-mono tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-900 px-2 py-1.5 text-center font-mono whitespace-nowrap tabular-nums">
                        {formatTanggalPendek(r.tanggalMuat)}
                      </td>
                      {isAllVendors && (
                        <td className="border border-slate-900 px-2 py-1.5">
                          {vendorMap.get(r.vendorId)?.name || '-'}
                        </td>
                      )}
                      <td className="border border-slate-900 px-2 py-1.5 text-center font-mono font-semibold whitespace-nowrap">
                        {r.nopol}
                      </td>
                      <td className="border border-slate-900 px-2 py-1.5">{r.namaSopir}</td>
                      <td className="border border-slate-900 px-2 py-1.5">{r.jenisMuatan}</td>
                      <td className="border border-slate-900 px-2 py-1.5">{r.lokasiMuat}</td>
                      <td className="border border-slate-900 px-2 py-1.5">{r.lokasiBongkar}</td>
                      <td className="border border-slate-900 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatRibuan(r.beratBongkarKg)}
                      </td>
                      <td className="border border-slate-900 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatRp(r.hargaJualVendorPerKg)}
                      </td>
                      <td className="border border-slate-900 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatRp(m.jumlahOngkosVendor)}
                      </td>
                      <td className="border border-slate-900 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatUangJalanCell(m.uangJalan)}
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Baris Total 1: Total Ongkos Angkutan */}
              <tr className="font-bold">
                <td colSpan={colSpanCount} className="border border-slate-900 px-2.5 py-1.5 text-right">
                  Total Ongkos Angkutan
                </td>
                <td className="border border-slate-900 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                  {formatRibuan(totals.totalTonase)}
                </td>
                <td className="border border-slate-900 px-2 py-1.5"></td>
                <td className="border border-slate-900 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                  {formatRp(totals.totalJumlahOngkos)}
                </td>
                <td className="border border-slate-900 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                  {formatUangJalanCell(totals.totalUangJalan)}
                </td>
              </tr>

              {/* Baris Total 2: Biaya Reistrasi Kartu GTO */}
              <tr>
                <td colSpan={colSpanCount} className="border border-slate-900 px-2.5 py-1.5 text-right font-bold">
                  Biaya Reistrasi Kartu GTO
                </td>
                <td className="border border-slate-900 px-2 py-1.5"></td>
                <td className="border border-slate-900 px-2 py-1.5"></td>
                <td className="border border-slate-900 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                  {formatRp(totals.gtoVal)}
                </td>
                <td className="border border-slate-900 px-2 py-1.5"></td>
              </tr>

              {/* Baris Total 3: Claim Susut Timbangan (HANYA muncul jika ada ritase yang susutnya > toleransi 0,3%) */}
              {totals.adaClaim && (
                <tr>
                  <td colSpan={colSpanCount} className="border border-slate-900 px-2.5 py-1.5 text-right font-bold">
                    {totals.claimItems.length === 1
                      ? `Claim Susut Timbangan (${totals.claimItems[0].r.nopol} · ${formatKgDesimal(
                          totals.claimItems[0].susutKenaClaimKg
                        )} Kg × ${formatRp(totals.claimItems[0].hargaClaimPerKg)})`
                      : `Total Claim Susut Timbangan (${totals.claimItems.length} Ritase Melebihi 0,3%)`}
                  </td>
                  <td className="border border-slate-900 px-2 py-1.5"></td>
                  <td className="border border-slate-900 px-2 py-1.5"></td>
                  <td className="border border-slate-900 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                    {formatRp(totals.totalClaimSusutRp)}
                  </td>
                  <td className="border border-slate-900 px-2 py-1.5"></td>
                </tr>
              )}

              {/* Baris Total 4: DP/Uang Jalan */}
              <tr>
                <td colSpan={colSpanCount} className="border border-slate-900 px-2.5 py-1.5 text-right font-bold">
                  DP/Uang Jalan
                </td>
                <td className="border border-slate-900 px-2 py-1.5"></td>
                <td className="border border-slate-900 px-2 py-1.5"></td>
                <td className="border border-slate-900 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                  {formatRp(totals.totalUangJalan)}
                </td>
                <td className="border border-slate-900 px-2 py-1.5"></td>
              </tr>

              {/* Baris Total 5: Kekurangan Pembayaran */}
              <tr className="print-row-highlight bg-slate-200 font-bold text-black">
                <td colSpan={colSpanCount} className="border border-slate-900 px-2.5 py-2 text-right">
                  Kekurangan Pembayaran
                </td>
                <td className="border border-slate-900 px-2 py-2"></td>
                <td className="border border-slate-900 px-2 py-2"></td>
                <td className="border border-slate-900 px-2 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                  {formatRp(totals.kekuranganPembayaran)}
                </td>
                <td className="border border-slate-900 px-2 py-2"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Rincian Nopol, Tanggal, Muatan & Perhitungan Claim Susut Per Ritase / Nopol di bawah tabel sisa pembayaran */}
        {filteredItems.length > 0 && (
          <div className="mt-5 border-t border-slate-400 pt-4 text-xs text-black space-y-3">
            <div className="font-bold uppercase tracking-wide text-black">
              Rincian Muatan &amp; Perhitungan Claim Susut Per Nopol / Ritase (Toleransi 0,3%)
            </div>

            <div className="overflow-x-auto">
              <table className="print-table w-full border-collapse border border-slate-900 text-xs text-black">
                <thead>
                  <tr className="bg-slate-200 font-bold text-black">
                    <th className="border border-slate-900 px-2 py-1.5 text-center w-9">No</th>
                    <th className="border border-slate-900 px-2 py-1.5 text-center whitespace-nowrap">
                      Tanggal Muat
                    </th>
                    <th className="border border-slate-900 px-2 py-1.5 text-center whitespace-nowrap">
                      Nopol
                    </th>
                    <th className="border border-slate-900 px-2 py-1.5 text-left">Jenis Muatan</th>
                    <th className="border border-slate-900 px-2 py-1.5 text-right whitespace-nowrap">
                      Muat Awal (Kg)
                    </th>
                    <th className="border border-slate-900 px-2 py-1.5 text-right whitespace-nowrap">
                      Bongkar (Kg)
                    </th>
                    <th className="border border-slate-900 px-2 py-1.5 text-right whitespace-nowrap">
                      Susut (Kg / %)
                    </th>
                    <th className="border border-slate-900 px-2 py-1.5 text-right whitespace-nowrap">
                      Toleransi 0,3% (Kg)
                    </th>
                    <th className="border border-slate-900 px-2 py-1.5 text-right whitespace-nowrap">
                      Kena Claim (Kg)
                    </th>
                    <th className="border border-slate-900 px-2 py-1.5 text-right whitespace-nowrap">
                      Perhitungan Claim (Rp)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {totals.ritaseDetails.map((item, idx) => (
                    <tr key={`susut-${item.r.id}`}>
                      <td className="border border-slate-900 px-2 py-1 text-center font-mono tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-900 px-2 py-1 text-center font-mono whitespace-nowrap tabular-nums">
                        {formatTanggalPendek(item.r.tanggalMuat)}
                      </td>
                      <td className="border border-slate-900 px-2 py-1 text-center font-mono font-semibold whitespace-nowrap">
                        {item.r.nopol}
                      </td>
                      <td className="border border-slate-900 px-2 py-1">{item.r.jenisMuatan}</td>
                      <td className="border border-slate-900 px-2 py-1 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatRibuan(item.beratMuatKg)}
                      </td>
                      <td className="border border-slate-900 px-2 py-1 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatRibuan(item.beratBongkarKg)}
                      </td>
                      <td className="border border-slate-900 px-2 py-1 text-right font-mono tabular-nums whitespace-nowrap">
                        {item.susutAktualKg > 0
                          ? `${formatRibuan(item.susutAktualKg)} Kg (${item.susutPersen.toFixed(2)}%)`
                          : '0 Kg (0,00%)'}
                      </td>
                      <td className="border border-slate-900 px-2 py-1 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatKgDesimal(item.toleransi03Kg)} Kg
                      </td>
                      <td className="border border-slate-900 px-2 py-1 text-right font-mono tabular-nums whitespace-nowrap">
                        {item.kenaClaim ? (
                          <span className="font-bold">{formatKgDesimal(item.susutKenaClaimKg)} Kg</span>
                        ) : (
                          <span>- (Aman)</span>
                        )}
                      </td>
                      <td className="border border-slate-900 px-2 py-1 text-right font-mono tabular-nums whitespace-nowrap">
                        {item.kenaClaim ? (
                          <span>
                            {formatKgDesimal(item.susutKenaClaimKg)} × {formatRp(item.hargaClaimPerKg)} ={' '}
                            <strong>{formatRp(item.claimSusutRp)}</strong>
                          </span>
                        ) : (
                          <span>Rp 0 (≤ 0,3%)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-slate-100">
                    <td colSpan={9} className="border border-slate-900 px-2 py-1.5 text-right">
                      Total Claim Susut Timbangan (Akumulasi Per Ritase)
                    </td>
                    <td className="border border-slate-900 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatRp(totals.totalClaimSusutRp)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded border border-slate-900 px-3.5 py-2.5 text-xs text-black space-y-1">
              {totals.adaClaim ? (
                <>
                  <div className="font-bold">Ringkasan Ritase Kena Claim Susut (&gt; 0,3%):</div>
                  {totals.claimItems.map((item) => (
                    <div key={`summary-claim-${item.r.id}`} className="flex flex-wrap justify-between gap-2">
                      <span>
                        {formatTanggalPendek(item.r.tanggalMuat)} · {item.r.nopol} ({item.r.jenisMuatan}):{' '}
                        ({formatKgDesimal(item.susutAktualKg)} − {formatKgDesimal(item.toleransi03Kg)}) Kg ={' '}
                        {formatKgDesimal(item.susutKenaClaimKg)} Kg × {formatRp(item.hargaClaimPerKg)}/Kg
                      </span>
                      <span className="font-mono font-bold tabular-nums">
                        {formatRp(item.claimSusutRp)}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="flex flex-wrap justify-between gap-2 font-semibold">
                  <span>Status Claim Susut</span>
                  <span>Semua nopol / ritase dalam batas toleransi ≤ 0,3% (Rp 0)</span>
                </div>
              )}

              <div className="flex flex-wrap justify-between gap-2 border-t border-slate-400 pt-1.5 font-bold">
                <span>Total Sisa Pembayaran (Transfer)</span>
                <span className="font-mono tabular-nums">
                  {formatRp(totals.kekuranganPembayaran)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {confirmLunasOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100">
              Tandai {totals.unpaidCount} Ritase Sebagai LUNAS?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Semua item ritase belum lunas pada nota ini akan diubah statusnya menjadi{' '}
              <strong className="text-slate-100">LUNAS</strong>. Seluruh data tonase, OA/Kg, DP,
              ongkos, dan keuntungan akan tetap tersimpan utuh sebagai arsip dan bisa dicetak
              ulang kapan saja lewat filter &ldquo;Arsip yang Sudah Lunas&rdquo;.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmLunasOpen(false)}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmMarkAllLunas}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Ya, Tandai Lunas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
