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
  beratMuatKg: number;
  beratBongkarKg: number;
  hargaPusatPerKg: number; // Harga dari Pusat (lebih tinggi)
  hargaJualVendorPerKg: number; // Harga jual ke vendor / OA vendor (lebih murah)
  uangJalan: number; // Uang Jalan / DP awal (Rp)
  docStatus: DocStatus;
  vendorPaymentStatus: VendorPaymentStatus;
  pusatPaymentStatus: PusatPaymentStatus;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotaAdjustment {
  biayaKartuGto: string;
  tarifClaimPerKg?: string;
  tarifClaimPerRitase?: Record<string, string>;
}

export interface BrokerDatabase {
  vendors: Vendor[];
  ritase: Ritase[];
  notaAdjustments?: Record<string, NotaAdjustment>;
}

export interface RitaseMetrics {
  susutKg: number;
  susutPersen: number;
  jumlahOngkosVendor: number; // Berat Bongkar x Harga Jual ke Vendor
  tagihanPusat: number; // Berat Bongkar x Harga Pusat
  uangJalan: number;
  keuntungan: number; // Tagihan Pusat - Ongkos Vendor
  sisaKewajibanVendor: number; // Ongkos Vendor - Uang Jalan (0 jika Lunas)
}
