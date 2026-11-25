import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Ritase } from '../types/transport';
import {
  computeRitaseMetrics,
  formatBulanLabel,
  formatRibuan,
  formatRp,
  getCurrentMonthIso,
} from '../utils/formatters';

interface ProfitTrendsChartProps {
  ritase: Ritase[];
  selectedMonth: string;
}

interface DailyProfitPoint {
  dayNum: number;
  dayShort: string;
  fullDateLabel: string;
  isoDate: string;
  dailyProfit: number;
  cumulativeProfit: number;
  ritaseCount: number;
  tonaseKg: number;
}

type ChartViewMode = 'cumulative' | 'daily';

function formatCompactRpAxis(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs === 0) return 'Rp 0';
  if (abs >= 1_000_000_000) {
    const num = (abs / 1_000_000_000).toFixed(abs % 1_000_000_000 === 0 ? 0 : 1).replace('.', ',');
    return `${sign}Rp ${num} M`;
  }
  if (abs >= 1_000_000) {
    const num = (abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1).replace('.', ',');
    return `${sign}Rp ${num} jt`;
  }
  if (abs >= 1_000) {
    const num = Math.round(abs / 1_000);
    return `${sign}Rp ${num} rb`;
  }
  return `${sign}Rp ${Math.round(abs)}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DailyProfitPoint }>;
  viewMode: ChartViewMode;
}

function ProfitTooltip({ active, payload, viewMode }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/95 px-3.5 py-2.5 text-xs shadow-lg">
      <div className="font-semibold text-slate-100">{point.fullDateLabel}</div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-5">
          <span className="text-slate-400">
            {viewMode === 'cumulative' ? 'Akumulasi Profit' : 'Profit Hari Ini'}
          </span>
          <span
            className={`font-mono font-bold tabular-nums ${
              (viewMode === 'cumulative' ? point.cumulativeProfit : point.dailyProfit) >= 0
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {formatRp(viewMode === 'cumulative' ? point.cumulativeProfit : point.dailyProfit)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-5">
          <span className="text-slate-400">
            {viewMode === 'cumulative' ? 'Profit Hari Ini' : 'Akumulasi s/d Tanggal Ini'}
          </span>
          <span className="font-mono font-medium text-slate-200 tabular-nums">
            {formatRp(viewMode === 'cumulative' ? point.dailyProfit : point.cumulativeProfit)}
          </span>
        </div>

        <div className="mt-1.5 border-t border-slate-800 pt-1.5 flex items-center justify-between gap-5 text-[11px] text-slate-400">
          <span>Ritase Selesai</span>
          <span className="font-mono text-slate-200 tabular-nums">
            {point.ritaseCount} rit ({formatRibuan(point.tonaseKg)} Kg)
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProfitTrendsChart({ ritase, selectedMonth }: ProfitTrendsChartProps) {
  const [viewMode, setViewMode] = useState<ChartViewMode>('cumulative');

  const currentMonth = getCurrentMonthIso();
  const targetMonth = selectedMonth !== 'all' ? selectedMonth : currentMonth;

  const chartStats = useMemo(() => {
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const daysInMonth =
      Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12
        ? new Date(year, month, 0).getDate()
        : 30;

    const byDate = new Map<
      string,
      { dailyProfit: number; ritaseCount: number; tonaseKg: number }
    >();

    let maxRitaseDay = 0;
    let totalCompletedRitase = 0;

    for (const r of ritase) {
      if (!r.tanggalMuat || !r.tanggalMuat.startsWith(targetMonth)) continue;
      const metrics = computeRitaseMetrics(r);
      if (!metrics.isSelesaiBongkar) continue;

      totalCompletedRitase += 1;
      const dayPart = Number(r.tanggalMuat.slice(8, 10));
      if (Number.isFinite(dayPart) && dayPart > maxRitaseDay) {
        maxRitaseDay = dayPart;
      }

      const existing = byDate.get(r.tanggalMuat) || {
        dailyProfit: 0,
        ritaseCount: 0,
        tonaseKg: 0,
      };
      existing.dailyProfit += metrics.keuntungan;
      existing.ritaseCount += 1;
      existing.tonaseKg += r.beratBongkarKg || 0;
      byDate.set(r.tanggalMuat, existing);
    }

    const todayDay = new Date().getDate();
    const lastDayToPlot =
      targetMonth === currentMonth
        ? Math.min(daysInMonth, Math.max(todayDay, maxRitaseDay))
        : daysInMonth;

    const monthShortFormatter = new Intl.DateTimeFormat('id-ID', { month: 'short' });
    const fullDateFormatter = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const points: DailyProfitPoint[] = [];
    let runningCumulative = 0;
    let activeDays = 0;
    let bestDayProfit = 0;
    let bestDayLabel = '-';
    let hasNegative = false;

    for (let day = 1; day <= lastDayToPlot; day += 1) {
      const dd = String(day).padStart(2, '0');
      const isoDate = `${targetMonth}-${dd}`;
      const bucket = byDate.get(isoDate);
      const dailyProfit = bucket?.dailyProfit ?? 0;
      const ritaseCount = bucket?.ritaseCount ?? 0;
      const tonaseKg = bucket?.tonaseKg ?? 0;

      runningCumulative += dailyProfit;
      if (dailyProfit < 0 || runningCumulative < 0) hasNegative = true;
      if (ritaseCount > 0) {
        activeDays += 1;
        if (dailyProfit > bestDayProfit || bestDayLabel === '-') {
          bestDayProfit = dailyProfit;
          bestDayLabel = `${dd} ${monthShortFormatter.format(new Date(year, month - 1, day))}`;
        }
      }

      const dateObj = new Date(year, month - 1, day);
      points.push({
        dayNum: day,
        dayShort: dd,
        fullDateLabel: Number.isNaN(dateObj.getTime())
          ? isoDate
          : fullDateFormatter.format(dateObj),
        isoDate,
        dailyProfit,
        cumulativeProfit: runningCumulative,
        ritaseCount,
        tonaseKg,
      });
    }

    const avgPerActiveDay = activeDays > 0 ? Math.round(runningCumulative / activeDays) : 0;

    return {
      points,
      totalCompletedRitase,
      totalProfit: runningCumulative,
      activeDays,
      avgPerActiveDay,
      bestDayProfit,
      bestDayLabel,
      hasNegative,
    };
  }, [ritase, targetMonth, currentMonth]);

  const dataKey = viewMode === 'cumulative' ? 'cumulativeProfit' : 'dailyProfit';

  return (
    <section
      aria-label="Profit Trends"
      className="no-print rounded-xl border border-slate-800 bg-slate-900 p-5"
    >
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
            <h2 className="text-base font-bold tracking-tight text-slate-100">
              Profit Trends
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400 tabular-nums">
            Progresi keuntungan harian · {formatBulanLabel(targetMonth)} ·{' '}
            {chartStats.totalCompletedRitase} ritase selesai ({chartStats.activeDays} hari aktif)
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <div>
              <div className="text-[11px] text-slate-400">Profit Bulan Ini</div>
              <div
                className={`font-mono text-sm font-bold tabular-nums ${
                  chartStats.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatRp(chartStats.totalProfit)}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-400">Rata-rata / Hari Aktif</div>
              <div className="font-mono text-sm font-semibold text-slate-200 tabular-nums">
                {formatRp(chartStats.avgPerActiveDay)}
              </div>
            </div>

            {chartStats.activeDays > 0 && (
              <div className="hidden sm:block">
                <div className="text-[11px] text-slate-400">Puncak ({chartStats.bestDayLabel})</div>
                <div className="font-mono text-sm font-semibold text-slate-200 tabular-nums">
                  {formatRp(chartStats.bestDayProfit)}
                </div>
              </div>
            )}
          </div>

          <div
            role="group"
            aria-label="Mode Grafik Profit"
            className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-0.5"
          >
            <button
              type="button"
              onClick={() => setViewMode('cumulative')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                viewMode === 'cumulative'
                  ? 'bg-slate-800 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Progresi Kumulatif
            </button>
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                viewMode === 'daily'
                  ? 'bg-slate-800 text-blue-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Harian
            </button>
          </div>
        </div>
      </div>

      {chartStats.totalCompletedRitase === 0 ? (
        <div className="flex h-[240px] flex-col items-center justify-center text-center px-4">
          <TrendingUp className="h-8 w-8 text-slate-600 mb-2" />
          <p className="text-sm font-medium text-slate-300">
            Belum ada ritase selesai bongkar di {formatBulanLabel(targetMonth)}
          </p>
          <p className="mt-1 max-w-md text-xs text-slate-500">
            Grafik progresi profit harian akan muncul otomatis setelah ritase pada bulan ini diisi berat bongkarnya.
          </p>
        </div>
      ) : (
        <div className="mt-4 h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartStats.points}
              margin={{ top: 10, right: 12, left: 4, bottom: 4 }}
            >
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="dayShort"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                minTickGap={16}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCompactRpAxis}
                width={76}
              />
              {chartStats.hasNegative && (
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
              )}
              <Tooltip
                content={<ProfitTooltip viewMode={viewMode} />}
                cursor={{ stroke: '#475569', strokeDasharray: '4 4' }}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                name={viewMode === 'cumulative' ? 'Akumulasi Profit' : 'Profit Harian'}
                stroke={viewMode === 'cumulative' ? '#10b981' : '#3b82f6'}
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (cx == null || cy == null) return <g key={`empty-${payload?.isoDate}`} />;
                  if (!payload || payload.ritaseCount === 0) {
                    return <g key={`nodot-${payload?.isoDate}`} />;
                  }
                  return (
                    <circle
                      key={`dot-${payload.isoDate}`}
                      cx={cx}
                      cy={cy}
                      r={3.5}
                      fill={viewMode === 'cumulative' ? '#10b981' : '#3b82f6'}
                      stroke="#0f172a"
                      strokeWidth={1.5}
                    />
                  );
                }}
                activeDot={{
                  r: 5,
                  fill: viewMode === 'cumulative' ? '#34d399' : '#60a5fa',
                  stroke: '#0f172a',
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
