import { Ritase, RitaseMetrics } from '../types/transport';

/**
 * Hitung seluruh metrik keuangan & susut ritase secara konsisten.
 * Harga Pusat > Harga Jual ke Vendor; sisa selisihnya menjadi Keuntungan.
 * Angka ritase yang sudah Lunas TIDAK pernah diubah jadi nol.
 */
export function computeRitaseMetrics(r: Ritase): RitaseMetrics {
  const beratMuat = Math.max(0, Number(r.beratMuatKg) || 0);
  const beratBongkar = Math.max(0, Number(r.beratBongkarKg) || 0);
  const hargaPusat = Math.max(0, Number(r.hargaPusatPerKg) || 0);
  const hargaVendor = Math.max(0, Number(r.hargaJualVendorPerKg) || 0);
  const uangJalan = Math.max(0, Number(r.uangJalan) || 0);

  const susutKg = beratMuat - beratBongkar;
  const susutPersen = beratMuat > 0 ? (susutKg / beratMuat) * 100 : 0;

  const jumlahOngkosVendor = Math.round(beratBongkar * hargaVendor);
  const tagihanPusat = Math.round(beratBongkar * hargaPusat);

  // Sisa harga dari Pusat dikurangi harga jual ke Vendor = Keuntungan
  const keuntungan = tagihanPusat - jumlahOngkosVendor;

  const sisaKewajibanVendor =
    r.vendorPaymentStatus === 'Lunas' ? 0 : jumlahOngkosVendor - uangJalan;

  return {
    susutKg,
    susutPersen,
    jumlahOngkosVendor,
    tagihanPusat,
    uangJalan,
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
