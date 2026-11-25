import readXlsxFile, { type CellValue, type Row } from 'read-excel-file/browser';
import {
  BrokerDatabase,
  DocStatus,
  PusatPaymentStatus,
  Ritase,
  SumberUangJalan,
  UjPusatMode,
  Vendor,
  VendorPaymentStatus,
} from '../types/transport';
import { generateId, getTodayIso } from './formatters';

type AnyCell = CellValue | null | undefined;

function normalizeHeader(cell: AnyCell): string {
  return String(cell ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function parseCellDateToIso(cell: AnyCell): string {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    const y = cell.getUTCFullYear();
    const m = String(cell.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cell.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const raw = String(cell ?? '').trim();
  if (!raw || raw === '-') return getTodayIso();

  // YYYY-MM-DD
  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY (exported formatTanggalPendek)
  const dmyMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return getTodayIso();
}

function parseNumericCell(cell: AnyCell): number {
  if (typeof cell === 'number') {
    return Number.isFinite(cell) ? cell : 0;
  }
  const raw = String(cell ?? '').trim();
  if (!raw || raw === '-') return 0;

  let cleaned = raw.replace(/rp/gi, '').replace(/%/g, '').replace(/\s+/g, '');

  // Handle formatted numbers like "24.500" (ID thousands) vs "0.3" (decimal) vs "24,500" (EN thousands)
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
  }

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function parseToleranceCell(cell: AnyCell): number {
  if (cell === null || cell === undefined || String(cell).trim() === '') {
    return 0.3;
  }
  const num = parseNumericCell(cell);
  return Math.max(0, num);
}

function isSummaryOrEmptyRow(row: Row, colIdx: Record<string, number>): boolean {
  const joined = row.map((c) => String(c ?? '').trim().toLowerCase()).join(' ');
  if (!joined.trim()) return true;
  if (joined.includes('total rekapitulasi')) return true;

  const nopol = colIdx.nopol !== undefined ? String(row[colIdx.nopol] ?? '').trim() : '';
  const vendor = colIdx.vendor !== undefined ? String(row[colIdx.vendor] ?? '').trim() : '';
  const sopir = colIdx.sopir !== undefined ? String(row[colIdx.sopir] ?? '').trim() : '';
  if (!nopol && !vendor && !sopir) return true;

  return false;
}

function findDaftarHeader(rows: Row[]): {
  headerRowIndex: number;
  colMap: Record<string, number>;
} | null {
  for (let rIdx = 0; rIdx < Math.min(rows.length, 20); rIdx += 1) {
    const row = rows[rIdx];
    if (!row || row.length < 6) continue;

    const found: Record<string, number> = {};
    row.forEach((cell, cIdx) => {
      const h = normalizeHeader(cell);
      if (!h) return;
      if (h === 'tanggal muat' || h === 'tanggal') found.tanggal = cIdx;
      else if (h === 'vendor') found.vendor = cIdx;
      else if (h === 'nopol') found.nopol = cIdx;
      else if (h === 'sopir' || h === 'nama sopir') found.sopir = cIdx;
      else if (h === 'jenis muatan') found.jenisMuatan = cIdx;
      else if (h === 'lokasi muat' || h === 'muat') found.lokasiMuat = cIdx;
      else if (h === 'lokasi bongkar' || h === 'bongkar') found.lokasiBongkar = cIdx;
      else if (h.startsWith('berat muat')) found.beratMuat = cIdx;
      else if (h.startsWith('berat bongkar') || h.startsWith('tonase bongkar')) found.beratBongkar = cIdx;
      else if (h.startsWith('tol. susut')) found.toleransiSusut = cIdx;
      else if (h.startsWith('harga claim')) found.hargaClaim = cIdx;
      else if (h.startsWith('harga pusat')) found.hargaPusat = cIdx;
      else if (h.startsWith('harga vendor')) found.hargaVendor = cIdx;
      else if (h.startsWith('uang jalan')) found.uangJalan = cIdx;
      else if (h === 'sumber uj') found.sumberUj = cIdx;
      else if (h.startsWith('kartu gto')) found.kartuGto = cIdx;
      else if (h.startsWith('status dokumen')) found.docStatus = cIdx;
      else if (h.startsWith('status bayar vendor')) found.vendorPayStatus = cIdx;
      else if (h.startsWith('status bayar pusat')) found.pusatPayStatus = cIdx;
    });

    if (
      found.tanggal !== undefined &&
      found.nopol !== undefined &&
      found.hargaVendor !== undefined
    ) {
      return { headerRowIndex: rIdx, colMap: found };
    }
  }
  return null;
}

function extractNotaVendorMeta(rows: Row[]): { vendorName: string; paymentInfo: string } | null {
  let vendorName = '';
  let paymentInfo = '';
  let isNota = false;

  for (let rIdx = 0; rIdx < Math.min(rows.length, 10); rIdx += 1) {
    const row = rows[rIdx];
    if (!row) continue;
    for (const cell of row) {
      const txt = String(cell ?? '').trim();
      if (!txt) continue;
      if (txt.toUpperCase().includes('RINCIAN ONGKOS PEMBAYARAN')) {
        isNota = true;
      } else if (/^vendor\s*:/i.test(txt)) {
        vendorName = txt.replace(/^vendor\s*:/i, '').trim();
      } else if (/^pembayaran\s*:/i.test(txt)) {
        paymentInfo = txt.replace(/^pembayaran\s*:/i, '').trim();
      }
    }
  }

  if (!isNota || !vendorName || vendorName.toLowerCase().includes('semua vendor')) {
    return null;
  }

  return { vendorName, paymentInfo };
}

export interface ExcelImportSummary {
  database: BrokerDatabase;
  importedRitaseCount: number;
  newVendorCount: number;
  updatedVendorInfoCount: number;
  totalVendorCount: number;
}

export async function importDaftarRitaseFromExcel(
  files: File[],
  currentDb: BrokerDatabase,
  replaceExisting: boolean
): Promise<ExcelImportSummary> {
  if (!files || files.length === 0) {
    throw new Error('Tidak ada file Excel yang dipilih.');
  }

  type ParsedDaftar = {
    kind: 'daftar';
    fileName: string;
    rows: Row[];
    headerRowIndex: number;
    colMap: Record<string, number>;
  };
  type ParsedNotaMeta = {
    kind: 'nota';
    fileName: string;
    vendorName: string;
    paymentInfo: string;
  };

  const parsedDaftarFiles: ParsedDaftar[] = [];
  const parsedNotaFiles: ParsedNotaMeta[] = [];

  for (const file of files) {
    const sheets = await readXlsxFile(file);
    if (!sheets || sheets.length === 0) continue;

    let matched = false;
    for (const sheet of sheets) {
      const rows = sheet.data || [];
      const daftar = findDaftarHeader(rows);
      if (daftar) {
        parsedDaftarFiles.push({
          kind: 'daftar',
          fileName: file.name,
          rows,
          headerRowIndex: daftar.headerRowIndex,
          colMap: daftar.colMap,
        });
        matched = true;
        break;
      }

      const notaMeta = extractNotaVendorMeta(rows);
      if (notaMeta) {
        parsedNotaFiles.push({
          kind: 'nota',
          fileName: file.name,
          vendorName: notaMeta.vendorName,
          paymentInfo: notaMeta.paymentInfo,
        });
        matched = true;
        break;
      }
    }

    if (!matched) {
      throw new Error(
        `File "${file.name}" bukan format Daftar-Ritase-*.xlsx atau Nota-Pembayaran-*.xlsx dari NiagaAngkut.`
      );
    }
  }

  const shouldReplace = replaceExisting && parsedDaftarFiles.length > 0;
  const baseVendors: Vendor[] = shouldReplace
    ? []
    : currentDb.vendors.map((v) => ({ ...v }));
  const vendorByLowerName = new Map<string, Vendor>();
  baseVendors.forEach((v) => {
    vendorByLowerName.set(v.name.trim().toLowerCase(), v);
  });

  const today = getTodayIso();
  const importedRitase: Ritase[] = [];
  let newVendorCount = 0;
  let updatedVendorInfoCount = 0;

  for (const parsed of parsedDaftarFiles) {
    const { rows, headerRowIndex, colMap } = parsed;
    for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row || isSummaryOrEmptyRow(row, colMap)) continue;

      const rawVendorName =
        colMap.vendor !== undefined ? String(row[colMap.vendor] ?? '').trim() : '';
      const vendorName = rawVendorName && rawVendorName !== '-' ? rawVendorName : 'Vendor Umum';
      const vendorKey = vendorName.toLowerCase();

      let vendor = vendorByLowerName.get(vendorKey);
      if (!vendor) {
        vendor = {
          id: generateId('vnd'),
          name: vendorName,
          paymentInfo: 'Belum diisi (edit di Master Data Vendor)',
          createdAt: today,
        };
        baseVendors.push(vendor);
        vendorByLowerName.set(vendorKey, vendor);
        newVendorCount += 1;
      }

      const tanggalMuat = parseCellDateToIso(row[colMap.tanggal]);
      const nopol = String(row[colMap.nopol] ?? '').trim().toUpperCase();
      const namaSopir =
        colMap.sopir !== undefined ? String(row[colMap.sopir] ?? '').trim() : '';
      const jenisMuatan =
        colMap.jenisMuatan !== undefined ? String(row[colMap.jenisMuatan] ?? '').trim() : '';
      const lokasiMuat =
        colMap.lokasiMuat !== undefined ? String(row[colMap.lokasiMuat] ?? '').trim() : '';
      const lokasiBongkar =
        colMap.lokasiBongkar !== undefined ? String(row[colMap.lokasiBongkar] ?? '').trim() : '';

      const beratMuatKg =
        colMap.beratMuat !== undefined ? Math.max(0, parseNumericCell(row[colMap.beratMuat])) : 0;
      const beratBongkarKg =
        colMap.beratBongkar !== undefined
          ? Math.max(0, parseNumericCell(row[colMap.beratBongkar]))
          : 0;
      const toleransiSusutPersen =
        colMap.toleransiSusut !== undefined
          ? parseToleranceCell(row[colMap.toleransiSusut])
          : 0.3;
      const hargaClaimSusutPerKg =
        colMap.hargaClaim !== undefined
          ? Math.max(0, parseNumericCell(row[colMap.hargaClaim]))
          : 0;
      const hargaPusatPerKg =
        colMap.hargaPusat !== undefined ? Math.max(0, parseNumericCell(row[colMap.hargaPusat])) : 0;
      const hargaJualVendorPerKg =
        colMap.hargaVendor !== undefined
          ? Math.max(0, parseNumericCell(row[colMap.hargaVendor]))
          : 0;
      const uangJalan =
        colMap.uangJalan !== undefined ? Math.max(0, parseNumericCell(row[colMap.uangJalan])) : 0;
      const biayaKartuGto =
        colMap.kartuGto !== undefined ? Math.max(0, parseNumericCell(row[colMap.kartuGto])) : 0;

      const rawSumberUj =
        colMap.sumberUj !== undefined
          ? String(row[colMap.sumberUj] ?? '').trim().toLowerCase()
          : '';
      const sumberUangJalan: SumberUangJalan = rawSumberUj.includes('pusat') ? 'Pusat' : 'Broker';
      const ujPusatMode: UjPusatMode =
        sumberUangJalan === 'Pusat' && rawSumberUj.includes('hold')
          ? 'Di Hold Broker'
          : 'Transfer ke Vendor';

      const rawDoc =
        colMap.docStatus !== undefined
          ? String(row[colMap.docStatus] ?? '').trim().toLowerCase()
          : '';
      const docStatus: DocStatus = rawDoc.includes('lengkap')
        ? 'SJ & Tiket Timbang Lengkap'
        : 'SJ & Tiket Timbang Belum Balik';

      const rawVendorPay =
        colMap.vendorPayStatus !== undefined
          ? String(row[colMap.vendorPayStatus] ?? '').trim().toLowerCase()
          : '';
      const vendorPaymentStatus: VendorPaymentStatus =
        rawVendorPay === 'lunas' ? 'Lunas' : 'Belum Lunas';

      const rawPusatPay =
        colMap.pusatPayStatus !== undefined
          ? String(row[colMap.pusatPayStatus] ?? '').trim().toLowerCase()
          : '';
      const pusatPaymentStatus: PusatPaymentStatus = rawPusatPay.includes('sudah')
        ? 'Sudah Dibayar Pusat'
        : 'Belum Dibayar Pusat';

      importedRitase.push({
        id: `${generateId('rit')}-${importedRitase.length + 1}`,
        tanggalMuat,
        vendorId: vendor.id,
        nopol,
        namaSopir,
        jenisMuatan,
        lokasiMuat,
        lokasiBongkar,
        beratMuatKg,
        beratBongkarKg,
        hargaPusatPerKg,
        hargaJualVendorPerKg,
        uangJalan,
        sumberUangJalan,
        ujPusatMode,
        biayaKartuGto,
        toleransiSusutPersen,
        hargaClaimSusutPerKg,
        docStatus,
        vendorPaymentStatus,
        pusatPaymentStatus,
        paidAt: vendorPaymentStatus === 'Lunas' ? today : undefined,
        createdAt: today,
        updatedAt: today,
      });
    }
  }

  for (const nota of parsedNotaFiles) {
    const key = nota.vendorName.trim().toLowerCase();
    const existing = vendorByLowerName.get(key);
    if (existing) {
      if (nota.paymentInfo && nota.paymentInfo !== '-') {
        existing.paymentInfo = nota.paymentInfo;
        updatedVendorInfoCount += 1;
      }
    } else {
      const created: Vendor = {
        id: generateId('vnd'),
        name: nota.vendorName.trim(),
        paymentInfo: nota.paymentInfo || 'Belum diisi (edit di Master Data Vendor)',
        createdAt: today,
      };
      baseVendors.push(created);
      vendorByLowerName.set(key, created);
      newVendorCount += 1;
    }
  }

  if (importedRitase.length === 0 && parsedNotaFiles.length === 0) {
    throw new Error('Tidak ditemukan data ritase atau vendor di dalam file Excel tersebut.');
  }

  const nextRitase = shouldReplace
    ? importedRitase
    : [...importedRitase, ...currentDb.ritase];

  return {
    database: {
      vendors: baseVendors,
      ritase: nextRitase,
      notaAdjustments: shouldReplace ? {} : currentDb.notaAdjustments || {},
    },
    importedRitaseCount: importedRitase.length,
    newVendorCount,
    updatedVendorInfoCount,
    totalVendorCount: baseVendors.length,
  };
}
