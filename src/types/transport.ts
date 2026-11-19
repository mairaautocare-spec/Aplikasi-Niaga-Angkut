export type MainMenuId =
  | 'dashboard'
  | 'tambah-ritase'
  | 'daftar-ritase'
  | 'nota'
  | 'vendor';

export type DashboardSubMenu = 'ringkasan' | 'per-vendor' | 'tagihan-pusat';

export type DocStatus = 'SJ & Tiket Timbang Belum Balik' | 'SJ & Tiket Timbang Lengkap';

export type VendorPaymentStatus = 'Belum Lunas' | 'Lunas';

export type PusatPaymentStatus = 'Belum Dibayar Pusat' | 'Sudah Dibayar Pusat';

export type SumberUangJalan = 'Broker' | 'Pusat';

export type TimbanganStatus = 'Menunggu Muat' | 'Dalam Perjalanan' | 'Selesai Bongkar';

export interface Vendor {
  id: string;
  name: string;
  paymentInfo: string;
  contactPerson?: string;
  notes?: string;
  createdAt: string;
}

export interface Ritase {
  id: string;
  tanggalMuat: string; // YYYY-MM-DD
  vendorId: string;
  nopol: string;
  namaSopir: string;
  jenisMuatan: string;
  lokasiMuat: string;
  lokasiBongkar: string;
  beratMuatKg: number; // 0 jika belum timbang muat
  beratBongkarKg: number; // 0 jika belum timbang bongkar
  hargaPusatPerKg: number; // Harga dari Pusat (lebih tinggi)
  hargaJualVendorPerKg: number; // Harga jual ke vendor / OA vendor (lebih murah)
  uangJalan: number; // Uang Jalan / DP awal (Rp)
  sumberUangJalan?: SumberUangJalan; // 'Broker' (default) atau 'Pusat'
  biayaKartuGto?: number; // Potongan registrasi / isi kartu GTO yang ditagihkan ke vendor (Rp)
  toleransiSusutPersen?: number; // Batas toleransi susut pabrik (%) - default 0.3
  docStatus: DocStatus;
  vendorPaymentStatus: VendorPaymentStatus;
  pusatPaymentStatus: PusatPaymentStatus;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotaAdjustment {
  biayaKartuGto?: string;
  tarifClaimPerKg?: string;
  tarifClaimPerRitase?: Record<string, string>;
}

export interface BrokerDatabase {
  vendors: Vendor[];
  ritase: Ritase[];
  notaAdjustments?: Record<string, NotaAdjustment>;
}

export interface RitaseMetrics {
  timbanganStatus: TimbanganStatus;
  isSelesaiBongkar: boolean;
  sumberUangJalan: SumberUangJalan;
  biayaKartuGto: number;
  toleransiSusutPersen: number;
  susutKg: number;
  susutPersen: number;
  jumlahOngkosVendor: number; // Berat Bongkar x Harga Jual ke Vendor (0 jika belum bongkar)
  tagihanBrutoPusat: number; // Berat Bongkar x Harga Pusat (0 jika belum bongkar)
  tagihanPusat: number; // Sisa tagihan ke Pusat (Bruto - UJ Pusat jika sumberUangJalan === 'Pusat')
  uangJalan: number;
  uangJalanBroker: number;
  uangJalanPusat: number;
  keuntungan: number; // Tagihan Bruto Pusat - Ongkos Vendor (0 jika belum bongkar)
  sisaKewajibanVendor: number; // Ongkos Vendor - Uang Jalan - Biaya GTO (0 jika Lunas atau belum bongkar)
}
