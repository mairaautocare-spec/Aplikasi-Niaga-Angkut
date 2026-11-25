import writeXlsxFile from 'write-excel-file/browser';
import type {
  Cell,
  Options,
  Row,
  SheetData,
  SheetOptions,
} from 'write-excel-file/browser';
import { Ritase, Vendor } from '../types/transport';
import { computeRitaseMetrics, formatTanggalPendek, getTodayIso } from './formatters';

type BrowserFileContent = File | Blob | ArrayBuffer;
type SheetOptionsColumn = { width?: number };

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function saveWorkbookFile(
  rows: SheetData,
  sheetOptions: SheetOptions<BrowserFileContent>,
  options: Options<BrowserFileContent>,
  fileName: string
): Promise<void> {
  const blob = await writeXlsxFile(rows, sheetOptions, options).toBlob();

  const isNativeCapacitor = Boolean(
    (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  );

  if (isNativeCapacitor && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], fileName, { type: XLSX_MIME });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName,
        });
        return;
      }
    } catch {
      // Fallback to direct download below if share was cancelled or unsupported
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 150);
}

const BORDER_THIN = {
  borderColor: '#1e293b',
  borderStyle: 'thin' as const,
};

const HEADER_CELL_BASE = {
  fontWeight: 'bold' as const,
  backgroundColor: '#e2e8f0',
  textColor: '#0f172a',
  alignVertical: 'center' as const,
  wrap: true,
  ...BORDER_THIN,
};

const TOTAL_CELL_BASE = {
  fontWeight: 'bold' as const,
  backgroundColor: '#f1f5f9',
  textColor: '#0f172a',
  alignVertical: 'center' as const,
  ...BORDER_THIN,
};

const HIGHLIGHT_CELL_BASE = {
  fontWeight: 'bold' as const,
  backgroundColor: '#dbeafe',
  textColor: '#0f172a',
  alignVertical: 'center' as const,
  ...BORDER_THIN,
};

const DATA_CELL_BASE = {
  textColor: '#0f172a',
  alignVertical: 'center' as const,
  ...BORDER_THIN,
};

const FORMAT_KG = '#,##0';
const FORMAT_KG_DEC = '#,##0.##';
const FORMAT_RP = '"Rp "#,##0;-"Rp "#,##0;"Rp "0';
const FORMAT_PCT = '0.00"%"';

function slugifyFilename(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'semua-vendor'
  );
}

function makeSpannedRow(cell: Cell, totalCols: number): Row {
  const row: Row = [cell];
  for (let i = 1; i < totalCols; i += 1) {
    row.push(null);
  }
  return row;
}

function makeSpannedCellBlock(
  label: string,
  span: number,
  style: Record<string, unknown>
): Cell[] {
  const cells: Cell[] = [
    {
      value: label,
      type: String,
      columnSpan: span,
      ...style,
    } as Cell,
  ];
  for (let i = 1; i < span; i += 1) {
    cells.push(null);
  }
  return cells;
}

export interface NotaClaimDetailItem {
  r: Ritase;
  beratMuatKg: number;
  beratBongkarKg: number;
  susutAktualKg: number;
  susutPersen: number;
  toleransiPersen: number;
  toleransiKg: number;
  susutKenaClaimKg: number;
  kenaClaim: boolean;
  hargaClaimPerKg: number;
  claimSusutRp: number;
}

export interface NotaGtoDetailItem {
  nopol: string;
  tanggalMuat: string;
  biayaKartuGto: number;
}

export interface ExportNotaExcelParams {
  vendorName: string;
  paymentInfo: string;
  periodeLabel: string;
  statusLabel: string;
  isAllVendors: boolean;
  vendorMap: Map<string, Vendor>;
  items: Ritase[];
  claimItems: NotaClaimDetailItem[];
  totalTonase: number;
  totalJumlahOngkos: number;
  totalUangJalan: number;
  gtoVal: number;
  gtoItems: NotaGtoDetailItem[];
  adaClaim: boolean;
  claimCount: number;
  totalClaimSusutRp: number;
  kekuranganPembayaran: number;
}

export async function exportNotaVendorExcel(params: ExportNotaExcelParams): Promise<string> {
  const {
    vendorName,
    paymentInfo,
    periodeLabel,
    statusLabel,
    isAllVendors,
    vendorMap,
    items,
    claimItems,
    totalTonase,
    totalJumlahOngkos,
    totalUangJalan,
    gtoVal,
    gtoItems,
    adaClaim,
    claimCount,
    totalClaimSusutRp,
    kekuranganPembayaran,
  } = params;

  const totalCols = isAllVendors ? 12 : 11;
  const labelSpan = isAllVendors ? 8 : 7;
  const claimCols = isAllVendors ? 13 : 12;

  const columns: SheetOptionsColumn[] = isAllVendors
    ? [
        { width: 6 },
        { width: 13 },
        { width: 22 },
        { width: 14 },
        { width: 16 },
        { width: 18 },
        { width: 18 },
        { width: 18 },
        { width: 15 },
        { width: 15 },
        { width: 20 },
        { width: 18 },
        { width: 18 },
      ]
    : [
        { width: 6 },
        { width: 13 },
        { width: 14 },
        { width: 16 },
        { width: 18 },
        { width: 18 },
        { width: 18 },
        { width: 15 },
        { width: 15 },
        { width: 20 },
        { width: 18 },
        { width: 18 },
      ];

  const rows: SheetData = [];

  // Title & Metadata
  rows.push(
    makeSpannedRow(
      {
        value: 'RINCIAN ONGKOS PEMBAYARAN',
        type: String,
        fontWeight: 'bold',
        fontSize: 14,
        align: 'center',
        alignVertical: 'center',
        height: 26,
        columnSpan: totalCols,
      },
      totalCols
    )
  );
  rows.push(
    makeSpannedRow(
      {
        value: `Vendor : ${vendorName}`,
        type: String,
        fontWeight: 'bold',
        columnSpan: totalCols,
      },
      totalCols
    )
  );
  rows.push(
    makeSpannedRow(
      {
        value: `Pembayaran : ${paymentInfo}`,
        type: String,
        columnSpan: totalCols,
      },
      totalCols
    )
  );
  rows.push(
    makeSpannedRow(
      {
        value: `Periode : ${periodeLabel}   |   Status Data : ${statusLabel}`,
        type: String,
        columnSpan: totalCols,
      },
      totalCols
    )
  );
  rows.push([]);

  // Table 1 Header
  const headerRow1: Row = [
    { value: 'No', type: String, align: 'center', ...HEADER_CELL_BASE },
    { value: 'Tanggal', type: String, align: 'center', ...HEADER_CELL_BASE },
  ];
  if (isAllVendors) {
    headerRow1.push({ value: 'Vendor', type: String, align: 'left', ...HEADER_CELL_BASE });
  }
  headerRow1.push(
    { value: 'Nopol', type: String, align: 'center', ...HEADER_CELL_BASE },
    { value: 'Sopir', type: String, align: 'left', ...HEADER_CELL_BASE },
    { value: 'Jenis Muatan', type: String, align: 'left', ...HEADER_CELL_BASE },
    { value: 'Muat', type: String, align: 'left', ...HEADER_CELL_BASE },
    { value: 'Bongkar', type: String, align: 'left', ...HEADER_CELL_BASE },
    { value: 'Tonase (Kg)', type: String, align: 'right', ...HEADER_CELL_BASE },
    { value: 'OA/Kg (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
    { value: 'Jumlah Ongkos (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
    { value: 'Uang Jalan (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE }
  );
  rows.push(headerRow1);

  // Table 1 Data Rows
  items.forEach((r, idx) => {
    const m = computeRitaseMetrics(r);
    const dataRow: Row = [
      { value: idx + 1, type: Number, align: 'center', ...DATA_CELL_BASE },
      { value: formatTanggalPendek(r.tanggalMuat), type: String, align: 'center', ...DATA_CELL_BASE },
    ];
    if (isAllVendors) {
      dataRow.push({
        value: vendorMap.get(r.vendorId)?.name || '-',
        type: String,
        align: 'left',
        ...DATA_CELL_BASE,
      });
    }
    dataRow.push(
      { value: r.nopol, type: String, align: 'center', fontWeight: 'bold', ...DATA_CELL_BASE },
      { value: r.namaSopir, type: String, align: 'left', ...DATA_CELL_BASE },
      { value: r.jenisMuatan, type: String, align: 'left', ...DATA_CELL_BASE },
      { value: r.lokasiMuat, type: String, align: 'left', ...DATA_CELL_BASE },
      { value: r.lokasiBongkar, type: String, align: 'left', ...DATA_CELL_BASE },
      { value: r.beratBongkarKg || 0, type: Number, format: FORMAT_KG, align: 'right', ...DATA_CELL_BASE },
      { value: r.hargaJualVendorPerKg || 0, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: m.jumlahOngkosVendor, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: m.uangJalanVendor, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE }
    );
    rows.push(dataRow);
  });

  // Summary Row 1: Total Ongkos Angkutan
  rows.push([
    ...makeSpannedCellBlock('Total Ongkos Angkutan', labelSpan, { ...TOTAL_CELL_BASE, align: 'right' }),
    { value: totalTonase, type: Number, format: FORMAT_KG, align: 'right', ...TOTAL_CELL_BASE },
    { value: '', type: String, ...TOTAL_CELL_BASE },
    { value: totalJumlahOngkos, type: Number, format: FORMAT_RP, align: 'right', ...TOTAL_CELL_BASE },
    { value: totalUangJalan, type: Number, format: FORMAT_RP, align: 'right', ...TOTAL_CELL_BASE },
  ]);

  // Summary Row 2: Biaya Kartu GTO (HANYA muncul jika ada biaya GTO > 0)
  if (gtoVal > 0) {
    const gtoDetailText = gtoItems
      .map((g) =>
        gtoItems.length > 1
          ? `${g.nopol} (${formatTanggalPendek(g.tanggalMuat)}: Rp ${g.biayaKartuGto.toLocaleString('id-ID')})`
          : `${g.nopol} · ${formatTanggalPendek(g.tanggalMuat)}`
      )
      .join(' | ');
    const gtoLabel = gtoDetailText ? `Biaya Kartu GTO\n${gtoDetailText}` : 'Biaya Kartu GTO';
    rows.push([
      ...makeSpannedCellBlock(gtoLabel, labelSpan, {
        ...DATA_CELL_BASE,
        fontWeight: 'bold',
        align: 'right',
        wrap: true,
        height: gtoDetailText ? 28 : undefined,
      }),
      { value: '', type: String, ...DATA_CELL_BASE },
      { value: '', type: String, ...DATA_CELL_BASE },
      { value: gtoVal, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: '', type: String, ...DATA_CELL_BASE },
    ]);
  }

  // Summary Row 3: Claim Susut Timbangan (HANYA muncul jika ada ritase yang melebihi toleransi)
  if (adaClaim) {
    rows.push([
      ...makeSpannedCellBlock(
        `Claim Susut Timbangan (${claimCount} Ritase Melebihi Toleransi)`,
        labelSpan,
        {
          ...DATA_CELL_BASE,
          fontWeight: 'bold',
          align: 'right',
        }
      ),
      { value: '', type: String, ...DATA_CELL_BASE },
      { value: '', type: String, ...DATA_CELL_BASE },
      { value: totalClaimSusutRp, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: '', type: String, ...DATA_CELL_BASE },
    ]);
  }

  // Summary Row 4: DP / Uang Jalan
  rows.push([
    ...makeSpannedCellBlock('DP / Uang Jalan', labelSpan, {
      ...DATA_CELL_BASE,
      fontWeight: 'bold',
      align: 'right',
    }),
    { value: '', type: String, ...DATA_CELL_BASE },
    { value: '', type: String, ...DATA_CELL_BASE },
    { value: totalUangJalan, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
    { value: '', type: String, ...DATA_CELL_BASE },
  ]);

  // Summary Row 5: Kekurangan Pembayaran
  rows.push([
    ...makeSpannedCellBlock('Kekurangan Pembayaran (Total Transfer)', labelSpan, {
      ...HIGHLIGHT_CELL_BASE,
      align: 'right',
    }),
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
    { value: kekuranganPembayaran, type: Number, format: FORMAT_RP, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
  ]);

  // Section 2: Rincian Muatan & Claim Susut (HANYA muncul jika ada yang kena claim, dan HANYA berisi ritase yang susutnya melebihi toleransi)
  if (adaClaim && claimItems.length > 0) {
    rows.push([]);
    rows.push(
      makeSpannedRow(
        {
          value: 'RINCIAN MUATAN & PERHITUNGAN CLAIM SUSUT (KHUSUS RITASE KENA CLAIM)',
          type: String,
          fontWeight: 'bold',
          fontSize: 11,
          align: 'left',
          columnSpan: claimCols,
        },
        claimCols
      )
    );

    const claimHeader: Row = [
      { value: 'No', type: String, align: 'center', ...HEADER_CELL_BASE },
      { value: 'Tanggal Muat', type: String, align: 'center', ...HEADER_CELL_BASE },
    ];
    if (isAllVendors) {
      claimHeader.push({ value: 'Vendor', type: String, align: 'left', ...HEADER_CELL_BASE });
    }
    claimHeader.push(
      { value: 'Nopol', type: String, align: 'center', ...HEADER_CELL_BASE },
      { value: 'Jenis Muatan', type: String, align: 'left', ...HEADER_CELL_BASE },
      { value: 'Muat Awal (Kg)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Bongkar (Kg)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Susut Aktual (Kg)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Susut (%)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Tol. (%)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Batas Tol. (Kg)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Kena Claim (Kg)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Claim Susut (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE }
    );
    rows.push(claimHeader);

    claimItems.forEach((item, idx) => {
      const claimRow: Row = [
        { value: idx + 1, type: Number, align: 'center', ...DATA_CELL_BASE },
        {
          value: formatTanggalPendek(item.r.tanggalMuat),
          type: String,
          align: 'center',
          ...DATA_CELL_BASE,
        },
      ];
      if (isAllVendors) {
        claimRow.push({
          value: vendorMap.get(item.r.vendorId)?.name || '-',
          type: String,
          align: 'left',
          ...DATA_CELL_BASE,
        });
      }
      claimRow.push(
        { value: item.r.nopol, type: String, align: 'center', fontWeight: 'bold', ...DATA_CELL_BASE },
        { value: item.r.jenisMuatan, type: String, align: 'left', ...DATA_CELL_BASE },
        { value: item.beratMuatKg, type: Number, format: FORMAT_KG, align: 'right', ...DATA_CELL_BASE },
        { value: item.beratBongkarKg, type: Number, format: FORMAT_KG, align: 'right', ...DATA_CELL_BASE },
        { value: item.susutAktualKg, type: Number, format: FORMAT_KG, align: 'right', ...DATA_CELL_BASE },
        { value: item.susutPersen, type: Number, format: FORMAT_PCT, align: 'right', ...DATA_CELL_BASE },
        { value: item.toleransiPersen, type: Number, format: FORMAT_PCT, align: 'right', ...DATA_CELL_BASE },
        { value: item.toleransiKg, type: Number, format: FORMAT_KG_DEC, align: 'right', ...DATA_CELL_BASE },
        {
          value: item.susutKenaClaimKg,
          type: Number,
          format: FORMAT_KG_DEC,
          align: 'right',
          fontWeight: 'bold',
          ...DATA_CELL_BASE,
        },
        {
          value: item.claimSusutRp,
          type: Number,
          format: FORMAT_RP,
          align: 'right',
          fontWeight: 'bold',
          ...DATA_CELL_BASE,
        }
      );
      rows.push(claimRow);
    });

    rows.push([
      ...makeSpannedCellBlock(
        'Total Claim Susut Timbangan',
        claimCols - 1,
        { ...TOTAL_CELL_BASE, align: 'right' }
      ),
      { value: totalClaimSusutRp, type: Number, format: FORMAT_RP, align: 'right', ...TOTAL_CELL_BASE },
    ]);
  }

  const fileName = `Nota-Pembayaran-${slugifyFilename(vendorName)}-${getTodayIso()}.xlsx`;
  await saveWorkbookFile(
    rows,
    {
      sheet: 'Nota Pembayaran',
      orientation: 'landscape',
      columns,
    },
    {
      fontFamily: 'Calibri',
      fontSize: 10,
    },
    fileName
  );

  return fileName;
}

export async function exportDaftarRitaseExcel(
  items: Ritase[],
  vendorMap: Map<string, Vendor>
): Promise<string> {
  const totalCols = 26;
  const columns: SheetOptionsColumn[] = [
    { width: 6 },
    { width: 13 },
    { width: 22 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 15 },
    { width: 15 },
    { width: 14 },
    { width: 12 },
    { width: 13 },
    { width: 17 },
    { width: 17 },
    { width: 20 },
    { width: 18 },
    { width: 20 },
    { width: 18 },
    { width: 14 },
    { width: 18 },
    { width: 20 },
    { width: 26 },
    { width: 18 },
    { width: 20 },
  ];

  const rows: SheetData = [
    makeSpannedRow(
      {
        value: 'DAFTAR & KONTROL RITASE - NIAGAANGKUT',
        type: String,
        fontWeight: 'bold',
        fontSize: 14,
        align: 'center',
        alignVertical: 'center',
        height: 26,
        columnSpan: totalCols,
      },
      totalCols
    ),
    makeSpannedRow(
      {
        value: `Tanggal Export: ${formatTanggalPendek(getTodayIso())}   |   Jumlah Data: ${items.length} Ritase`,
        type: String,
        columnSpan: totalCols,
      },
      totalCols
    ),
    [],
    [
      { value: 'No', type: String, align: 'center', ...HEADER_CELL_BASE },
      { value: 'Tanggal Muat', type: String, align: 'center', ...HEADER_CELL_BASE },
      { value: 'Vendor', type: String, align: 'left', ...HEADER_CELL_BASE },
      { value: 'Nopol', type: String, align: 'center', ...HEADER_CELL_BASE },
      { value: 'Sopir', type: String, align: 'left', ...HEADER_CELL_BASE },
      { value: 'Jenis Muatan', type: String, align: 'left', ...HEADER_CELL_BASE },
      { value: 'Lokasi Muat', type: String, align: 'left', ...HEADER_CELL_BASE },
      { value: 'Lokasi Bongkar', type: String, align: 'left', ...HEADER_CELL_BASE },
      { value: 'Status Timbangan', type: String, align: 'center', ...HEADER_CELL_BASE },
      { value: 'Berat Muat (Kg)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Berat Bongkar (Kg)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Susut (Kg)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Susut (%)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Tol. Susut (%)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Harga Claim/Kg (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Harga Pusat/Kg (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Sisa Tagihan Pusat (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Harga Vendor/Kg (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Ongkos Vendor (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Uang Jalan (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Sumber UJ', type: String, align: 'center', ...HEADER_CELL_BASE },
      { value: 'Kartu GTO (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Keuntungan (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Status Dokumen SJ', type: String, align: 'left', ...HEADER_CELL_BASE },
      { value: 'Status Bayar Vendor', type: String, align: 'center', ...HEADER_CELL_BASE },
      { value: 'Status Bayar Pusat', type: String, align: 'center', ...HEADER_CELL_BASE },
    ],
  ];

  let totalMuat = 0;
  let totalBongkar = 0;
  let totalSusut = 0;
  let totalTagihanPusat = 0;
  let totalOngkosVendor = 0;
  let totalUangJalan = 0;
  let totalGto = 0;
  let totalKeuntungan = 0;

  items.forEach((r, idx) => {
    const m = computeRitaseMetrics(r);
    totalMuat += r.beratMuatKg || 0;
    totalBongkar += r.beratBongkarKg || 0;
    totalSusut += m.susutKg;
    totalTagihanPusat += m.tagihanPusat;
    totalOngkosVendor += m.jumlahOngkosVendor;
    totalUangJalan += m.uangJalan;
    totalGto += m.biayaKartuGto;
    totalKeuntungan += m.keuntungan;

    rows.push([
      { value: idx + 1, type: Number, align: 'center', ...DATA_CELL_BASE },
      { value: formatTanggalPendek(r.tanggalMuat), type: String, align: 'center', ...DATA_CELL_BASE },
      { value: vendorMap.get(r.vendorId)?.name || 'Vendor Lainnya', type: String, align: 'left', ...DATA_CELL_BASE },
      { value: r.nopol, type: String, align: 'center', fontWeight: 'bold', ...DATA_CELL_BASE },
      { value: r.namaSopir, type: String, align: 'left', ...DATA_CELL_BASE },
      { value: r.jenisMuatan, type: String, align: 'left', ...DATA_CELL_BASE },
      { value: r.lokasiMuat, type: String, align: 'left', ...DATA_CELL_BASE },
      { value: r.lokasiBongkar, type: String, align: 'left', ...DATA_CELL_BASE },
      { value: m.timbanganStatus, type: String, align: 'center', ...DATA_CELL_BASE },
      { value: r.beratMuatKg || 0, type: Number, format: FORMAT_KG, align: 'right', ...DATA_CELL_BASE },
      { value: r.beratBongkarKg || 0, type: Number, format: FORMAT_KG, align: 'right', ...DATA_CELL_BASE },
      { value: m.susutKg, type: Number, format: FORMAT_KG, align: 'right', ...DATA_CELL_BASE },
      { value: m.susutPersen, type: Number, format: FORMAT_PCT, align: 'right', ...DATA_CELL_BASE },
      { value: m.toleransiSusutPersen, type: Number, format: FORMAT_PCT, align: 'right', ...DATA_CELL_BASE },
      { value: r.hargaClaimSusutPerKg || 0, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: r.hargaPusatPerKg || 0, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: m.tagihanPusat, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: r.hargaJualVendorPerKg || 0, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: m.jumlahOngkosVendor, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: m.uangJalan, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      {
        value:
          m.sumberUangJalan === 'Pusat'
            ? m.ujPusatMode === 'Di Hold Broker'
              ? 'Pusat (Hold Broker)'
              : 'Pusat (Transfer Vendor)'
            : 'Broker',
        type: String,
        align: 'center',
        ...DATA_CELL_BASE,
      },
      { value: m.biayaKartuGto, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: m.keuntungan, type: Number, format: FORMAT_RP, align: 'right', fontWeight: 'bold', ...DATA_CELL_BASE },
      { value: r.docStatus, type: String, align: 'left', ...DATA_CELL_BASE },
      { value: r.vendorPaymentStatus, type: String, align: 'center', ...DATA_CELL_BASE },
      { value: r.pusatPaymentStatus, type: String, align: 'center', ...DATA_CELL_BASE },
    ]);
  });

  rows.push([
    ...makeSpannedCellBlock('TOTAL REKAPITULASI', 9, { ...HIGHLIGHT_CELL_BASE, align: 'right' }),
    { value: totalMuat, type: Number, format: FORMAT_KG, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: totalBongkar, type: Number, format: FORMAT_KG, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: totalSusut, type: Number, format: FORMAT_KG, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
    { value: totalTagihanPusat, type: Number, format: FORMAT_RP, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
    { value: totalOngkosVendor, type: Number, format: FORMAT_RP, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: totalUangJalan, type: Number, format: FORMAT_RP, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
    { value: totalGto, type: Number, format: FORMAT_RP, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: totalKeuntungan, type: Number, format: FORMAT_RP, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
  ]);

  const fileName = `Daftar-Ritase-${getTodayIso()}.xlsx`;
  await saveWorkbookFile(
    rows,
    {
      sheet: 'Daftar Ritase',
      orientation: 'landscape',
      columns,
    },
    {
      fontFamily: 'Calibri',
      fontSize: 10,
    },
    fileName
  );

  return fileName;
}

export async function exportTagihanPusatExcel(params: {
  items: Ritase[];
  vendorMap: Map<string, Vendor>;
  scopeLabel: string;
  periodeLabel: string;
}): Promise<string> {
  const { items, vendorMap, scopeLabel, periodeLabel } = params;
  const totalCols = 17;
  const columns: SheetOptionsColumn[] = [
    { width: 6 },
    { width: 13 },
    { width: 22 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 15 },
    { width: 17 },
    { width: 20 },
    { width: 18 },
    { width: 20 },
    { width: 18 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
  ];

  const rows: SheetData = [
    makeSpannedRow(
      {
        value: 'REKAP TAGIHAN ANGKUTAN KE PUSAT',
        type: String,
        fontWeight: 'bold',
        fontSize: 14,
        align: 'center',
        alignVertical: 'center',
        height: 26,
        columnSpan: totalCols,
      },
      totalCols
    ),
    makeSpannedRow(
      {
        value: `Vendor : ${scopeLabel}   |   Periode : ${periodeLabel}`,
        type: String,
        columnSpan: totalCols,
      },
      totalCols
    ),
    [],
    [
      { value: 'No', type: String, align: 'center', ...HEADER_CELL_BASE },
      { value: 'Tanggal Muat', type: String, align: 'center', ...HEADER_CELL_BASE },
      { value: 'Vendor', type: String, align: 'left', ...HEADER_CELL_BASE },
      { value: 'Nopol', type: String, align: 'center', ...HEADER_CELL_BASE },
      { value: 'Sopir', type: String, align: 'left', ...HEADER_CELL_BASE },
      { value: 'Jenis Muatan', type: String, align: 'left', ...HEADER_CELL_BASE },
      { value: 'Muat', type: String, align: 'left', ...HEADER_CELL_BASE },
      { value: 'Bongkar', type: String, align: 'left', ...HEADER_CELL_BASE },
      { value: 'Tonase Bongkar (Kg)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Harga Pusat/Kg (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Tagihan Bruto (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Pot. UJ Pusat (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Sisa Tagihan Pusat (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Harga Vendor/Kg (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Ongkos Vendor (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Keuntungan (Rp)', type: String, align: 'right', ...HEADER_CELL_BASE },
      { value: 'Status Bayar Pusat', type: String, align: 'center', ...HEADER_CELL_BASE },
    ],
  ];

  let totalTonase = 0;
  let totalTagihanBruto = 0;
  let totalPotUjPusat = 0;
  let totalTagihanPusat = 0;
  let totalOngkosVendor = 0;
  let totalKeuntungan = 0;

  items.forEach((r, idx) => {
    const m = computeRitaseMetrics(r);
    totalTonase += r.beratBongkarKg || 0;
    totalTagihanBruto += m.tagihanBrutoPusat;
    totalPotUjPusat += m.uangJalanPusat;
    totalTagihanPusat += m.tagihanPusat;
    totalOngkosVendor += m.jumlahOngkosVendor;
    totalKeuntungan += m.keuntungan;

    rows.push([
      { value: idx + 1, type: Number, align: 'center', ...DATA_CELL_BASE },
      { value: formatTanggalPendek(r.tanggalMuat), type: String, align: 'center', ...DATA_CELL_BASE },
      { value: vendorMap.get(r.vendorId)?.name || '-', type: String, align: 'left', ...DATA_CELL_BASE },
      { value: r.nopol, type: String, align: 'center', fontWeight: 'bold', ...DATA_CELL_BASE },
      { value: r.namaSopir, type: String, align: 'left', ...DATA_CELL_BASE },
      { value: r.jenisMuatan, type: String, align: 'left', ...DATA_CELL_BASE },
      { value: r.lokasiMuat, type: String, align: 'left', ...DATA_CELL_BASE },
      { value: r.lokasiBongkar, type: String, align: 'left', ...DATA_CELL_BASE },
      { value: r.beratBongkarKg || 0, type: Number, format: FORMAT_KG, align: 'right', ...DATA_CELL_BASE },
      { value: r.hargaPusatPerKg || 0, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: m.tagihanBrutoPusat, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: m.uangJalanPusat, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: m.tagihanPusat, type: Number, format: FORMAT_RP, align: 'right', fontWeight: 'bold', ...DATA_CELL_BASE },
      { value: r.hargaJualVendorPerKg || 0, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: m.jumlahOngkosVendor, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: m.keuntungan, type: Number, format: FORMAT_RP, align: 'right', ...DATA_CELL_BASE },
      { value: r.pusatPaymentStatus, type: String, align: 'center', ...DATA_CELL_BASE },
    ]);
  });

  rows.push([
    ...makeSpannedCellBlock('TOTAL SISA TAGIHAN KE PUSAT', 8, { ...HIGHLIGHT_CELL_BASE, align: 'right' }),
    { value: totalTonase, type: Number, format: FORMAT_KG, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
    { value: totalTagihanBruto, type: Number, format: FORMAT_RP, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: totalPotUjPusat, type: Number, format: FORMAT_RP, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: totalTagihanPusat, type: Number, format: FORMAT_RP, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
    { value: totalOngkosVendor, type: Number, format: FORMAT_RP, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: totalKeuntungan, type: Number, format: FORMAT_RP, align: 'right', ...HIGHLIGHT_CELL_BASE },
    { value: '', type: String, ...HIGHLIGHT_CELL_BASE },
  ]);

  const fileName = `Tagihan-Pusat-${getTodayIso()}.xlsx`;
  await saveWorkbookFile(
    rows,
    {
      sheet: 'Tagihan ke Pusat',
      orientation: 'landscape',
      columns,
    },
    {
      fontFamily: 'Calibri',
      fontSize: 10,
    },
    fileName
  );

  return fileName;
}
