import { Ritase, RitaseMetrics, SumberUangJalan, TimbanganStatus } from '../types/transport';

/**
 * Hitung seluruh metrik keuangan & susut ritase secara konsisten.
 * - Selama beratBongkarKg === 0 (belum selesai bongkar), susut & tagihan bernilai 0 agar tidak muncul susut/claim palsu.
 * - Jika sumberUangJalan === 'Pusat', tagihan bersih ke Pusat otomatis dikurangi UJ yang sudah dibayar Pusat.
 * - Jika sumberUangJalan === 'Broker', tagihan ke Pusat utuh dan UJ memotong kewajiban ke Vendor.
 */
export function computeRitaseMetrics(r: Ritase): RitaseMetrics {
  const beratMuat = Math.max(0, Number(r.beratMuatKg) || 0);
  const beratBongkar = Math.max(0, Number(r.beratBongkarKg) || 0);
  const hargaPusat = Math.max(0, Number(r.hargaPusatPerKg) || 0);
  const hargaVendor = Math.max(0, Number(r.hargaJualVendorPerKg) || 0);
  const uangJalan = Math.max(0, Number(r.uangJalan) || 0);
  const biayaKartuGto = Math.max(0, Number(r.biayaKartuGto) || 0);
  const rawTol = r.toleransiSusutPersen;
  const toleransiSusutPersen =
    rawTol !== undefined &&
    rawTol !== null &&
    String(rawTol).trim() !== '' &&
    !Number.isNaN(Number(rawTol))
      ? Math.max(0, Number(rawTol))
      : 0.3;
  const sumberUangJalan: SumberUangJalan =
    r.sumberUangJalan === 'Pusat' ? 'Pusat' : 'Broker';

  const isSelesaiBongkar = beratBongkar > 0;
  const timbanganStatus: TimbanganStatus = isSelesaiBongkar
    ? 'Selesai Bongkar'
    : beratMuat > 0
    ? 'Dalam Perjalanan'
    : 'Menunggu Muat';

  // Susut hanya dihitung bila timbangan muat & bongkar sudah sama-sama terisi
  const susutKg = beratMuat > 0 && beratBongkar > 0 ? beratMuat - beratBongkar : 0;
  const susutPersen =
    beratMuat > 0 && beratBongkar > 0 ? (susutKg / beratMuat) * 100 : 0;

  const jumlahOngkosVendor = isSelesaiBongkar ? Math.round(beratBongkar * hargaVendor) : 0;
  const tagihanBrutoPusat = isSelesaiBongkar ? Math.round(beratBongkar * hargaPusat) : 0;
  const tagihanPusat = isSelesaiBongkar
    ? sumberUangJalan === 'Pusat'
      ? tagihanBrutoPusat - uangJalan
      : tagihanBrutoPusat
    : 0;

  const uangJalanBroker = sumberUangJalan === 'Broker' ? uangJalan : 0;
  const uangJalanPusat = sumberUangJalan === 'Pusat' ? uangJalan : 0;

  // Keuntungan tetap selisih bruto Pusat dikurangi ongkos Vendor
  const keuntungan = isSelesaiBongkar ? tagihanBrutoPusat - jumlahOngkosVendor : 0;

  const sisaKewajibanVendor =
    !isSelesaiBongkar || r.vendorPaymentStatus === 'Lunas'
      ? 0
      : jumlahOngkosVendor - uangJalan - biayaKartuGto;

  return {
    timbanganStatus,
    isSelesaiBongkar,
    sumberUangJalan,
    biayaKartuGto,
    toleransiSusutPersen,
    susutKg,
    susutPersen,
    jumlahOngkosVendor,
    tagihanBrutoPusat,
    tagihanPusat,
    uangJalan,
    uangJalanBroker,
    uangJalanPusat,
    keuntungan,
    sisaKewajibanVendor,
  };
}

export function formatRibuan(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0));
}

export function formatRp(value: number): string {
  const rounded = Math.round(value || 0);
  if (rounded < 0) {
    return `-Rp ${formatRibuan(Math.abs(rounded))}`;
  }
  return `Rp ${formatRibuan(rounded)}`;
}

export function formatUangJalanCell(value: number): string {
  const rounded = Math.round(value || 0);
  if (rounded === 0) return '-';
  return formatRp(rounded);
}

export function formatTanggalPendek(isoDate: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export function formatBulanLabel(yyyyMm: string): string {
  if (!yyyyMm || yyyyMm === 'all') return 'Semua Waktu';
  const [year, month] = yyyyMm.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return yyyyMm;
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthIso(): string {
  return getTodayIso().slice(0, 7);
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const escapeCell = (cell: string | number) => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
