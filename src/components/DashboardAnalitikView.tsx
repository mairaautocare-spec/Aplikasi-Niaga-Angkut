import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  RotateCcw,
  Scale,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { NotaAdjustment, Ritase, Vendor } from '../types/transport';
import {
  computeRitaseClaimInfo,
  computeRitaseMetrics,
  formatRibuan,
  formatRp,
  formatTanggalPendek,
} from '../utils/formatters';

interface DashboardAnalitikViewProps {
  vendors: Vendor[];
  ritase: Ritase[];
  notaAdjustments: Record<string, NotaAdjustment>;
  onGoToTambahRitase?: () => void;
}

type Granularity = 'weekly' | 'monthly' | 'yearly';
type SortMetric =
  | 'time-asc'
  | 'time-desc'
  | 'profit-desc'
  | 'ritase-desc'
  | 'tonase-desc'
  | 'claim-desc';
type StatusScope = 'selesai' | 'all';
type FinanceChartMode = 'profit' | 'comparison';
type ClaimChartMode = 'kg' | 'rp';
type VendorRankSort = 'profit' | 'tonase' | 'claim';

interface PeriodBucket {
  key: string;
  label: string;
  fullLabel: string;
  totalRitase: number;
  selesaiRitase: number;
  belumSelesaiRitase: number;
  sjBelumBalik: number;
  totalTonaseKg: number;
  totalTonaseTon: number;
  tagihanBrutoPusat: number;
  tagihanNetPusat: number;
  ongkosVendor: number;
  profit: number;
  susutAktualKg: number;
  susutDalamToleransiKg: number;
  susutKenaClaimKg: number;
  claimSusutRp: number;
  ritaseKenaClaim: number;
  ujBroker: number;
  ujPusatTransfer: number;
  ujHoldBroker: number;
  belumBayarPusatRp: number;
  belumLunasVendorRp: number;
}

function parseIsoParts(iso: string): { y: number; m: number; d: number } | null {
  const parts = iso.split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const LONG_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function getBucketMeta(isoDate: string, granularity: Granularity): {
  key: string;
  label: string;
  fullLabel: string;
} {
  const parsed = parseIsoParts(isoDate);
  if (!parsed) {
    return { key: 'unknown', label: 'Tanpa Tgl', fullLabel: 'Tanpa Tanggal' };
  }

  if (granularity === 'yearly') {
    const key = String(parsed.y);
    return { key, label: key, fullLabel: `Tahun ${key}` };
  }

  if (granularity === 'monthly') {
    const key = `${parsed.y}-${String(parsed.m).padStart(2, '0')}`;
    const shortM = SHORT_MONTHS[parsed.m - 1] || String(parsed.m);
    const longM = LONG_MONTHS[parsed.m - 1] || String(parsed.m);
    const shortY = String(parsed.y).slice(-2);
    return {
      key,
      label: `${shortM} '${shortY}`,
      fullLabel: `${longM} ${parsed.y}`,
    };
  }

  // Weekly (Senin - Minggu)
  const dateObj = new Date(parsed.y, parsed.m - 1, parsed.d);
  const dayFromMonday = (dateObj.getDay() + 6) % 7;
  const monday = new Date(parsed.y, parsed.m - 1, parsed.d - dayFromMonday);
  const sunday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + 6
  );

  const key = toIsoDate(monday);
  const mDay = monday.getDate();
  const mMon = SHORT_MONTHS[monday.getMonth()] || '';
  const sDay = sunday.getDate();
  const sMon = SHORT_MONTHS[sunday.getMonth()] || '';
  const sYearShort = String(sunday.getFullYear()).slice(-2);

  const shortRange =
    monday.getMonth() === sunday.getMonth()
      ? `${mDay}–${sDay} ${sMon} '${sYearShort}`
      : `${mDay} ${mMon}–${sDay} ${sMon} '${sYearShort}`;

  return {
    key,
    label: shortRange,
    fullLabel: `Minggu ${formatTanggalPendek(toIsoDate(monday))} s/d ${formatTanggalPendek(
      toIsoDate(sunday)
    )}`,
  };
}

function formatAxisRp(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace('.0', '')} M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace('.0', '')} jt`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)} rb`;
  }
  return `${sign}${Math.round(abs)}`;
}

function formatTon(kg: number): string {
  const ton = kg / 1000;
  return ton.toLocaleString('id-ID', {
    minimumFractionDigits: ton % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
  payload?: PeriodBucket;
}

function ChartTooltipCard({
  active,
  payload,
  formatter,
}: {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  formatter: (item: CustomTooltipPayloadItem) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const bucket = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2.5 text-xs shadow-xl">
      <div className="font-semibold text-slate-100">{bucket?.fullLabel || ''}</div>
      {bucket && (
        <div className="mt-0.5 text-[11px] text-slate-400 font-mono tabular-nums">
          {bucket.totalRitase} ritase · {formatRibuan(bucket.totalTonaseKg)} Kg
        </div>
      )}
      <div className="mt-2 space-y-1 border-t border-slate-800 pt-1.5">
        {payload.map((entry, idx) => (
          <div key={`${entry.dataKey}-${idx}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span
                className="inline-block h-2 w-2 rounded-xs shrink-0"
                style={{ backgroundColor: entry.color || '#3b82f6' }}
              />
              {entry.name}
            </span>
            <span className="font-mono font-semibold text-slate-100 tabular-nums">
              {formatter(entry)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardAnalitikView({
  vendors,
  ritase,
  notaAdjustments,
  onGoToTambahRitase,
}: DashboardAnalitikViewProps) {
  const [granularity, setGranularity] = useState<Granularity>('monthly');
  const [sortMetric, setSortMetric] = useState<SortMetric>('time-asc');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [commodityFilter, setCommodityFilter] = useState<string>('all');
  const [statusScope, setStatusScope] = useState<StatusScope>('selesai');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [financeMode, setFinanceMode] = useState<FinanceChartMode>('profit');
  const [claimMode, setClaimMode] = useState<ClaimChartMode>('kg');
  const [vendorRankSort, setVendorRankSort] = useState<VendorRankSort>('profit');

  const vendorMap = useMemo(() => {
    const map = new Map<string, Vendor>();
    for (const v of vendors) map.set(v.id, v);
    return map;
  }, [vendors]);

  const commodities = useMemo(() => {
    const set = new Set<string>();
    for (const r of ritase) {
      if (r.jenisMuatan.trim()) set.add(r.jenisMuatan.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [ritase]);

  const filteredRitase = useMemo(() => {
    return ritase.filter((r) => {
      if (vendorFilter !== 'all' && r.vendorId !== vendorFilter) return false;
      if (commodityFilter !== 'all' && r.jenisMuatan.trim() !== commodityFilter) return false;
      if (dateFrom && r.tanggalMuat < dateFrom) return false;
      if (dateTo && r.tanggalMuat > dateTo) return false;
      if (statusScope === 'selesai' && !computeRitaseMetrics(r).isSelesaiBongkar) {
        return false;
      }
      return true;
    });
  }, [ritase, vendorFilter, commodityFilter, dateFrom, dateTo, statusScope]);

  const { buckets, totals, vendorStats, commodityStats, routeStats } = useMemo(() => {
    const bucketMap = new Map<string, PeriodBucket>();
    const vMap = new Map<
      string,
      {
        vendorId: string;
        vendorName: string;
        ritaseCount: number;
        tonaseKg: number;
        profit: number;
        susutKenaClaimKg: number;
        claimSusutRp: number;
        unpaidVendorRp: number;
      }
    >();
    const cMap = new Map<
      string,
      { name: string; ritaseCount: number; tonaseKg: number; profit: number }
    >();
    const rMap = new Map<
      string,
      { route: string; ritaseCount: number; tonaseKg: number; profit: number }
    >();

    let totalRitase = 0;
    let selesaiRitase = 0;
    let belumSelesaiRitase = 0;
    let sjBelumBalik = 0;
    let totalTonaseKg = 0;
    let tagihanBrutoPusat = 0;
    let tagihanNetPusat = 0;
    let ongkosVendor = 0;
    let profit = 0;
    let susutAktualKg = 0;
    let susutKenaClaimKg = 0;
    let claimSusutRp = 0;
    let ritaseKenaClaim = 0;
    let ujBroker = 0;
    let ujPusatTransfer = 0;
    let ujHoldBroker = 0;
    let belumBayarPusatRp = 0;
    let belumLunasVendorRp = 0;

    for (const r of filteredRitase) {
      const m = computeRitaseMetrics(r);
      const claim = computeRitaseClaimInfo(r, notaAdjustments);
      const meta = getBucketMeta(r.tanggalMuat, granularity);

      let b = bucketMap.get(meta.key);
      if (!b) {
        b = {
          key: meta.key,
          label: meta.label,
          fullLabel: meta.fullLabel,
          totalRitase: 0,
          selesaiRitase: 0,
          belumSelesaiRitase: 0,
          sjBelumBalik: 0,
          totalTonaseKg: 0,
          totalTonaseTon: 0,
          tagihanBrutoPusat: 0,
          tagihanNetPusat: 0,
          ongkosVendor: 0,
          profit: 0,
          susutAktualKg: 0,
          susutDalamToleransiKg: 0,
          susutKenaClaimKg: 0,
          claimSusutRp: 0,
          ritaseKenaClaim: 0,
          ujBroker: 0,
          ujPusatTransfer: 0,
          ujHoldBroker: 0,
          belumBayarPusatRp: 0,
          belumLunasVendorRp: 0,
        };
        bucketMap.set(meta.key, b);
      }

      const bKg = r.beratBongkarKg || 0;
      const inToleranceKg = Math.max(0, claim.susutAktualKg - claim.susutKenaClaimKg);
      const pusatTf = m.sumberUangJalan === 'Pusat' ? m.uangJalanVendor : 0;

      b.totalRitase += 1;
      if (m.isSelesaiBongkar) b.selesaiRitase += 1;
      else b.belumSelesaiRitase += 1;
      if (r.docStatus === 'SJ & Tiket Timbang Belum Balik') b.sjBelumBalik += 1;

      b.totalTonaseKg += bKg;
      b.totalTonaseTon = Number((b.totalTonaseKg / 1000).toFixed(2));
      b.tagihanBrutoPusat += m.tagihanBrutoPusat;
      b.tagihanNetPusat += m.tagihanPusat;
      b.ongkosVendor += m.jumlahOngkosVendor;
      b.profit += m.keuntungan;

      b.susutAktualKg += claim.susutAktualKg;
      b.susutDalamToleransiKg += Math.round(inToleranceKg);
      b.susutKenaClaimKg += Math.round(claim.susutKenaClaimKg * 10) / 10;
      b.claimSusutRp += claim.claimSusutRp;
      if (claim.kenaClaim) b.ritaseKenaClaim += 1;

      b.ujBroker += m.uangJalanBroker;
      b.ujPusatTransfer += pusatTf;
      b.ujHoldBroker += m.uangJalanHoldBroker;

      if (m.isSelesaiBongkar && r.pusatPaymentStatus === 'Belum Dibayar Pusat') {
        b.belumBayarPusatRp += m.tagihanPusat;
        belumBayarPusatRp += m.tagihanPusat;
      }
      if (m.isSelesaiBongkar && r.vendorPaymentStatus === 'Belum Lunas') {
        b.belumLunasVendorRp += m.sisaKewajibanVendor;
        belumLunasVendorRp += m.sisaKewajibanVendor;
      }

      totalRitase += 1;
      if (m.isSelesaiBongkar) selesaiRitase += 1;
      else belumSelesaiRitase += 1;
      if (r.docStatus === 'SJ & Tiket Timbang Belum Balik') sjBelumBalik += 1;
      totalTonaseKg += bKg;
      tagihanBrutoPusat += m.tagihanBrutoPusat;
      tagihanNetPusat += m.tagihanPusat;
      ongkosVendor += m.jumlahOngkosVendor;
      profit += m.keuntungan;
      susutAktualKg += claim.susutAktualKg;
      susutKenaClaimKg += claim.susutKenaClaimKg;
      claimSusutRp += claim.claimSusutRp;
      if (claim.kenaClaim) ritaseKenaClaim += 1;
      ujBroker += m.uangJalanBroker;
      ujPusatTransfer += pusatTf;
      ujHoldBroker += m.uangJalanHoldBroker;

      // Vendor aggregation
      const vName = vendorMap.get(r.vendorId)?.name || 'Vendor Lainnya';
      const vRow = vMap.get(r.vendorId) || {
        vendorId: r.vendorId,
        vendorName: vName,
        ritaseCount: 0,
        tonaseKg: 0,
        profit: 0,
        susutKenaClaimKg: 0,
        claimSusutRp: 0,
        unpaidVendorRp: 0,
      };
      vRow.ritaseCount += 1;
      vRow.tonaseKg += bKg;
      vRow.profit += m.keuntungan;
      vRow.susutKenaClaimKg += claim.susutKenaClaimKg;
      vRow.claimSusutRp += claim.claimSusutRp;
      if (m.isSelesaiBongkar && r.vendorPaymentStatus === 'Belum Lunas') {
        vRow.unpaidVendorRp += m.sisaKewajibanVendor;
      }
      vMap.set(r.vendorId, vRow);

      // Commodity aggregation
      const cName = r.jenisMuatan.trim() || 'Lainnya';
      const cRow = cMap.get(cName) || {
        name: cName,
        ritaseCount: 0,
        tonaseKg: 0,
        profit: 0,
      };
      cRow.ritaseCount += 1;
      cRow.tonaseKg += bKg;
      cRow.profit += m.keuntungan;
      cMap.set(cName, cRow);

      // Route aggregation
      const routeName = `${r.lokasiMuat.trim() || '-'} → ${r.lokasiBongkar.trim() || '-'}`;
      const rRow = rMap.get(routeName) || {
        route: routeName,
        ritaseCount: 0,
        tonaseKg: 0,
        profit: 0,
      };
      rRow.ritaseCount += 1;
      rRow.tonaseKg += bKg;
      rRow.profit += m.keuntungan;
      rMap.set(routeName, rRow);
    }

    const sortedBuckets = Array.from(bucketMap.values()).sort((a, b) => {
      switch (sortMetric) {
        case 'time-desc':
          return b.key.localeCompare(a.key);
        case 'profit-desc':
          return b.profit - a.profit || b.key.localeCompare(a.key);
        case 'ritase-desc':
          return b.totalRitase - a.totalRitase || b.key.localeCompare(a.key);
        case 'tonase-desc':
          return b.totalTonaseKg - a.totalTonaseKg || b.key.localeCompare(a.key);
        case 'claim-desc':
          return (
            b.claimSusutRp - a.claimSusutRp ||
            b.susutKenaClaimKg - a.susutKenaClaimKg ||
            b.key.localeCompare(a.key)
          );
        case 'time-asc':
        default:
          return a.key.localeCompare(b.key);
      }
    });

    const sortedVendors = Array.from(vMap.values()).sort((a, b) => {
      if (vendorRankSort === 'tonase') return b.tonaseKg - a.tonaseKg;
      if (vendorRankSort === 'claim') {
        return b.claimSusutRp - a.claimSusutRp || b.susutKenaClaimKg - a.susutKenaClaimKg;
      }
      return b.profit - a.profit;
    });

    const sortedCommodities = Array.from(cMap.values()).sort(
      (a, b) => b.tonaseKg - a.tonaseKg || b.ritaseCount - a.ritaseCount
    );
    const sortedRoutes = Array.from(rMap.values())
      .sort((a, b) => b.ritaseCount - a.ritaseCount || b.tonaseKg - a.tonaseKg)
      .slice(0, 6);

    const marginPersen =
      tagihanBrutoPusat > 0 ? (profit / tagihanBrutoPusat) * 100 : 0;
    const avgProfitPerRitase = selesaiRitase > 0 ? profit / selesaiRitase : 0;
    const avgTonasePerRitase = selesaiRitase > 0 ? totalTonaseKg / selesaiRitase : 0;

    return {
      buckets: sortedBuckets,
      totals: {
        totalRitase,
        selesaiRitase,
        belumSelesaiRitase,
        sjBelumBalik,
        totalTonaseKg,
        tagihanBrutoPusat,
        tagihanNetPusat,
        ongkosVendor,
        profit,
        marginPersen,
        avgProfitPerRitase,
        avgTonasePerRitase,
        susutAktualKg,
        susutKenaClaimKg,
        claimSusutRp,
        ritaseKenaClaim,
        ujBroker,
        ujPusatTransfer,
        ujHoldBroker,
        totalUj: ujBroker + ujPusatTransfer + ujHoldBroker,
        belumBayarPusatRp,
        belumLunasVendorRp,
      },
      vendorStats: sortedVendors,
      commodityStats: sortedCommodities,
      routeStats: sortedRoutes,
    };
  }, [filteredRitase, notaAdjustments, granularity, sortMetric, vendorMap, vendorRankSort]);

  const hasActiveFilter =
    vendorFilter !== 'all' ||
    commodityFilter !== 'all' ||
    statusScope !== 'selesai' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    sortMetric !== 'time-asc';

  const resetFilters = () => {
    setVendorFilter('all');
    setCommodityFilter('all');
    setStatusScope('selesai');
    setDateFrom('');
    setDateTo('');
    setSortMetric('time-asc');
  };

  return (
    <div className="space-y-6">
      {/* Control Toolbar: Granularitas Mingguan / Bulanan / Tahunan + Sortir + Filter */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              Filter Periode &amp; Pengurutan Grafik
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Kelompokkan grafik berdasarkan minggu, bulan, atau tahun lalu urutkan sesuai kebutuhan evaluasi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Rentang pengelompokan grafik"
              className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-1"
            >
              {(
                [
                  { id: 'weekly', label: 'Mingguan' },
                  { id: 'monthly', label: 'Bulanan' },
                  { id: 'yearly', label: 'Tahunan' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setGranularity(item.id)}
                  className={`min-h-[34px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    granularity === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filter
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-slate-800 pt-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="an-sort" className="block text-[11px] font-semibold text-slate-400">
              Urutkan Grafik (Sortir)
            </label>
            <select
              id="an-sort"
              value={sortMetric}
              onChange={(e) => setSortMetric(e.target.value as SortMetric)}
              className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="time-asc">Kronologis (Terlama → Terbaru)</option>
              <option value="time-desc">Terbaru → Terlama</option>
              <option value="profit-desc">Profit Tertinggi</option>
              <option value="ritase-desc">Total Ritase Terbanyak</option>
              <option value="tonase-desc">Total Tonase Terbesar</option>
              <option value="claim-desc">Claim Susut Tertinggi</option>
            </select>
          </div>

          <div>
            <label htmlFor="an-vendor" className="block text-[11px] font-semibold text-slate-400">
              Vendor Armada
            </label>
            <select
              id="an-vendor"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="all">Semua Vendor ({vendors.length})</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="an-muatan" className="block text-[11px] font-semibold text-slate-400">
              Jenis Muatan
            </label>
            <select
              id="an-muatan"
              value={commodityFilter}
              onChange={(e) => setCommodityFilter(e.target.value)}
              className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="all">Semua Muatan</option>
              {commodities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="an-status" className="block text-[11px] font-semibold text-slate-400">
              Cakupan Status Ritase
            </label>
            <select
              id="an-status"
              value={statusScope}
              onChange={(e) => setStatusScope(e.target.value as StatusScope)}
              className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="selesai">Selesai Bongkar Saja</option>
              <option value="all">Semua Status (Termasuk Jalan)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="an-from" className="block text-[11px] font-semibold text-slate-400">
                Dari Tgl
              </label>
              <input
                id="an-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="an-to" className="block text-[11px] font-semibold text-slate-400">
                Sampai Tgl
              </label>
              <input
                id="an-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {buckets.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-slate-600" />
          <h3 className="mt-3 text-base font-semibold text-slate-200">
            Belum Ada Data untuk Ditampilkan di Grafik
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            {ritase.length === 0
              ? 'Tambahkan data ritase terlebih dahulu agar grafik profit, tonase, dan susut otomatis terbentuk.'
              : 'Tidak ada ritase yang cocok dengan kombinasi filter saat ini.'}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filter
              </button>
            )}
            {onGoToTambahRitase && (
              <button
                type="button"
                onClick={onGoToTambahRitase}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Input Ritase Baru
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* 5 KPI Ringkas */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">Total Profit Bersih</span>
                <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
              </div>
              <div
                className={`mt-2.5 font-mono text-xl font-bold tabular-nums ${
                  totals.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatRp(totals.profit)}
              </div>
              <div className="mt-1.5 text-[11px] text-slate-400 font-mono tabular-nums">
                Margin {totals.marginPersen.toFixed(1).replace('.', ',')}% · Rata{' '}
                {formatRp(totals.avgProfitPerRitase)}/rit
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">Total Ritase</span>
                <Truck className="h-4 w-4 text-blue-400 shrink-0" />
              </div>
              <div className="mt-2.5 font-mono text-xl font-bold text-slate-100 tabular-nums">
                {formatRibuan(totals.totalRitase)} ritase
              </div>
              <div className="mt-1.5 text-[11px] text-slate-400 font-mono tabular-nums">
                {totals.selesaiRitase} selesai
                {totals.belumSelesaiRitase > 0 ? ` · ${totals.belumSelesaiRitase} proses` : ''} ·{' '}
                {totals.sjBelumBalik} SJ blm balik
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">Total Tonase Bongkar</span>
                <Scale className="h-4 w-4 text-sky-400 shrink-0" />
              </div>
              <div className="mt-2.5 font-mono text-xl font-bold text-slate-100 tabular-nums">
                {formatTon(totals.totalTonaseKg)} Ton
              </div>
              <div className="mt-1.5 text-[11px] text-slate-400 font-mono tabular-nums">
                {formatRibuan(totals.totalTonaseKg)} Kg · Rata {formatTon(totals.avgTonasePerRitase)} T/rit
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">Claim Susut</span>
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              </div>
              <div className="mt-2.5 font-mono text-xl font-bold text-rose-400 tabular-nums">
                {formatRp(totals.claimSusutRp)}
              </div>
              <div className="mt-1.5 text-[11px] text-slate-400 font-mono tabular-nums">
                Kena claim {formatRibuan(totals.susutKenaClaimKg)} Kg ({totals.ritaseKenaClaim} rit) · Susut{' '}
                {formatRibuan(totals.susutAktualKg)} Kg
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">Arus Uang Jalan</span>
                <Wallet className="h-4 w-4 text-amber-400 shrink-0" />
              </div>
              <div className="mt-2.5 font-mono text-xl font-bold text-slate-100 tabular-nums">
                {formatRp(totals.totalUj)}
              </div>
              <div className="mt-1.5 text-[11px] text-slate-400 font-mono tabular-nums">
                Broker {formatAxisRp(totals.ujBroker)} · Pusat Tf {formatAxisRp(totals.ujPusatTransfer)} · Hold{' '}
                {formatAxisRp(totals.ujHoldBroker)}
              </div>
            </div>
          </div>

          {/* Chart 1: Profit & Omzet Comparison */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  {financeMode === 'profit'
                    ? 'Grafik Profit Bersih per Periode'
                    : 'Perbandingan Omzet Pusat, Ongkos Vendor & Profit'}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Menampilkan {buckets.length} periode (
                  {granularity === 'weekly'
                    ? 'Mingguan'
                    : granularity === 'monthly'
                    ? 'Bulanan'
                    : 'Tahunan'}
                  ).
                </p>
              </div>
              <div className="inline-flex self-start rounded-lg border border-slate-700 bg-slate-950 p-1 sm:self-auto">
                <button
                  type="button"
                  onClick={() => setFinanceMode('profit')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                    financeMode === 'profit'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  Profit Bersih
                </button>
                <button
                  type="button"
                  onClick={() => setFinanceMode('comparison')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                    financeMode === 'comparison'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  Omzet vs Ongkos Vendor
                </button>
              </div>
            </div>

            <div className="mt-4 h-[290px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {financeMode === 'profit' ? (
                  <AreaChart data={buckets} margin={{ top: 10, right: 16, left: 4, bottom: 8 }}>
                    <defs>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatAxisRp}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip
                      content={
                        <ChartTooltipCard
                          formatter={(item) => formatRp(Number(item.value || 0))}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      name="Profit Bersih"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#profitGradient)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={buckets} margin={{ top: 10, right: 16, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatAxisRp}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip
                      content={
                        <ChartTooltipCard
                          formatter={(item) => formatRp(Number(item.value || 0))}
                        />
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }} />
                    <Bar
                      dataKey="tagihanBrutoPusat"
                      name="Tagihan Bruto Pusat"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="ongkosVendor"
                      name="Ongkos Vendor"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="profit"
                      name="Profit Bersih"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2 & Chart 3: Ritase + Tonase | Claim Susut */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  Total Tonase (Ton) &amp; Jumlah Ritase
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Batang biru menunjukkan total tonase bongkar (Ton), garis oranye menunjukkan jumlah ritase.
                </p>
              </div>
              <div className="mt-4 h-[270px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={buckets} margin={{ top: 10, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="ton"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={46}
                    />
                    <YAxis
                      yAxisId="rit"
                      orientation="right"
                      allowDecimals={false}
                      tick={{ fill: '#f59e0b', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={34}
                    />
                    <Tooltip
                      content={
                        <ChartTooltipCard
                          formatter={(item) =>
                            item.dataKey === 'totalTonaseTon'
                              ? `${formatTon((item.payload?.totalTonaseKg || 0))} Ton (${formatRibuan(
                                  item.payload?.totalTonaseKg || 0
                                )} Kg)`
                              : `${formatRibuan(Number(item.value || 0))} ritase`
                          }
                        />
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar
                      yAxisId="ton"
                      dataKey="totalTonaseTon"
                      name="Total Tonase (Ton)"
                      fill="#0ea5e9"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="rit"
                      type="monotone"
                      dataKey="totalRitase"
                      name="Jumlah Ritase"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: '#f59e0b' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Grafik Susut &amp; Claim Susut
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Memisahkan susut dalam toleransi dan susut kena claim pabrik.
                  </p>
                </div>
                <div className="inline-flex self-start rounded-lg border border-slate-700 bg-slate-950 p-1 sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setClaimMode('kg')}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                      claimMode === 'kg'
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    Berat (Kg)
                  </button>
                  <button
                    type="button"
                    onClick={() => setClaimMode('rp')}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                      claimMode === 'rp'
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    Nominal Claim (Rp)
                  </button>
                </div>
              </div>

              <div className="mt-4 h-[270px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {claimMode === 'kg' ? (
                    <BarChart data={buckets} margin={{ top: 10, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={{ stroke: '#334155' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={46}
                      />
                      <Tooltip
                        content={
                          <ChartTooltipCard
                            formatter={(item) => `${formatRibuan(Number(item.value || 0))} Kg`}
                          />
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar
                        dataKey="susutDalamToleransiKg"
                        name="Susut Toleransi (Kg)"
                        stackId="susut"
                        fill="#475569"
                      />
                      <Bar
                        dataKey="susutKenaClaimKg"
                        name="Susut Kena Claim (Kg)"
                        stackId="susut"
                        fill="#f43f5e"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  ) : (
                    <BarChart data={buckets} margin={{ top: 10, right: 12, left: 4, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={{ stroke: '#334155' }}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={formatAxisRp}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={56}
                      />
                      <Tooltip
                        content={
                          <ChartTooltipCard
                            formatter={(item) => formatRp(Number(item.value || 0))}
                          />
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar
                        dataKey="claimSusutRp"
                        name="Nilai Claim Susut (Rp)"
                        fill="#f43f5e"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Chart 4: Cashflow Uang Jalan */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Posisi &amp; Arus Uang Jalan (Broker vs Pusat Transfer vs Hold Broker)
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Memantau modal talangan Broker, UJ dari Pusat yang langsung ditransfer ke Vendor, serta UJ Pusat yang di-Hold Broker.
              </p>
            </div>
            <div className="mt-4 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets} margin={{ top: 10, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatAxisRp}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    content={
                      <ChartTooltipCard
                        formatter={(item) => formatRp(Number(item.value || 0))}
                      />
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="ujBroker"
                    name="Talangan Broker"
                    stackId="uj"
                    fill="#3b82f6"
                  />
                  <Bar
                    dataKey="ujPusatTransfer"
                    name="Pusat Tf ke Vendor"
                    stackId="uj"
                    fill="#10b981"
                  />
                  <Bar
                    dataKey="ujHoldBroker"
                    name="Pusat Di Hold Broker"
                    stackId="uj"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Panel 5: Peringkat Vendor & Distribusi Muatan/Rute + Status Piutang */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Peringkat Performa &amp; Susut Per Vendor
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Evaluasi kontribusi profit, tonase, dan tingkat claim susut tiap vendor.
                  </p>
                </div>
                <div className="inline-flex self-start rounded-lg border border-slate-700 bg-slate-950 p-1 sm:self-auto">
                  {(
                    [
                      { id: 'profit', label: 'Profit' },
                      { id: 'tonase', label: 'Tonase' },
                      { id: 'claim', label: 'Claim Susut' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setVendorRankSort(item.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                        vendorRankSort === item.id
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 font-semibold text-slate-400">
                      <th className="px-4 py-2.5">Vendor</th>
                      <th className="px-3 py-2.5 text-right">Ritase</th>
                      <th className="px-3 py-2.5 text-right">Tonase</th>
                      <th className="px-3 py-2.5 text-right">Profit</th>
                      <th className="px-3 py-2.5 text-right">Susut Claim</th>
                      <th className="px-4 py-2.5 text-right">Belum Lunas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {vendorStats.map((v) => (
                      <tr key={v.vendorId} className="hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 font-semibold text-slate-100">
                          {v.vendorName}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-300 tabular-nums">
                          {v.ritaseCount}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-200 tabular-nums whitespace-nowrap">
                          {formatTon(v.tonaseKg)} T
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-400 tabular-nums whitespace-nowrap">
                          {formatRp(v.profit)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                          {v.susutKenaClaimKg > 0 ? (
                            <span className="text-rose-400">
                              {formatRibuan(v.susutKenaClaimKg)} Kg · {formatRp(v.claimSusutRp)}
                            </span>
                          ) : (
                            <span className="text-slate-500">0 Kg</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-amber-300 tabular-nums whitespace-nowrap">
                          {v.unpaidVendorRp > 0 ? formatRp(v.unpaidVendorRp) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  Komoditas &amp; Rute Terbanyak
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Ringkasan jenis muatan dan jalur pengiriman paling aktif.
                </p>
              </div>

              <div className="space-y-2.5">
                {commodityStats.slice(0, 5).map((c) => {
                  const pct =
                    totals.totalTonaseKg > 0
                      ? Math.round((c.tonaseKg / totals.totalTonaseKg) * 100)
                      : 0;
                  return (
                    <div key={c.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-200 truncate">{c.name}</span>
                        <span className="font-mono text-slate-400 tabular-nums whitespace-nowrap">
                          {c.ritaseCount} rit · {formatTon(c.tonaseKg)} T ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-2">
                <div className="text-xs font-semibold text-slate-300">Rute Paling Aktif</div>
                {routeStats.map((rt) => (
                  <div
                    key={rt.route}
                    className="flex items-center justify-between gap-2 text-xs text-slate-400"
                  >
                    <span className="truncate text-slate-300">{rt.route}</span>
                    <span className="font-mono tabular-nums whitespace-nowrap">
                      {rt.ritaseCount} rit · {formatTon(rt.tonaseKg)} T
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Piutang Pusat Belum Dibayar</span>
                  <span className="font-mono font-semibold text-amber-300 tabular-nums">
                    {formatRp(totals.belumBayarPusatRp)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Hutang Vendor Belum Lunas</span>
                  <span className="font-mono font-semibold text-slate-200 tabular-nums">
                    {formatRp(totals.belumLunasVendorRp)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">SJ / Tiket Timbang Belum Balik</span>
                  <span className="font-mono font-semibold text-amber-400 tabular-nums">
                    {totals.sjBelumBalik} ritase
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabel Rekapitulasi Periode */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-100">
                Tabel Rekapitulasi{' '}
                {granularity === 'weekly'
                  ? 'Mingguan'
                  : granularity === 'monthly'
                  ? 'Bulanan'
                  : 'Tahunan'}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Rincian angka per periode sesuai pengurutan aktif.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 font-semibold text-slate-400">
                    <th className="px-4 py-2.5 whitespace-nowrap">Periode</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Ritase</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Tonase (Kg)</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Tagihan Bruto</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Ongkos Vendor</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Profit</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Claim Susut</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">UJ Broker</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">UJ Pusat Tf</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">UJ Hold Broker</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {buckets.map((b) => (
                    <tr key={b.key} className="hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-medium text-slate-100 whitespace-nowrap">
                        {b.fullLabel}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-200 tabular-nums">
                        {b.totalRitase}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-200 tabular-nums whitespace-nowrap">
                        {formatRibuan(b.totalTonaseKg)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-300 tabular-nums whitespace-nowrap">
                        {formatRp(b.tagihanBrutoPusat)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-300 tabular-nums whitespace-nowrap">
                        {formatRp(b.ongkosVendor)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                          b.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatRp(b.profit)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {b.susutKenaClaimKg > 0 ? (
                          <span className="text-rose-400">
                            {formatRibuan(b.susutKenaClaimKg)} Kg · {formatRp(b.claimSusutRp)}
                          </span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-300 tabular-nums whitespace-nowrap">
                        {b.ujBroker > 0 ? formatRp(b.ujBroker) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-300 tabular-nums whitespace-nowrap">
                        {b.ujPusatTransfer > 0 ? formatRp(b.ujPusatTransfer) : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-amber-300 tabular-nums whitespace-nowrap">
                        {b.ujHoldBroker > 0 ? formatRp(b.ujHoldBroker) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
