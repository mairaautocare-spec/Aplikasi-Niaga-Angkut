import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Plus, Save, Sparkles } from 'lucide-react';
import {
  DocStatus,
  PusatPaymentStatus,
  Ritase,
  SumberUangJalan,
  Vendor,
  VendorPaymentStatus,
} from '../types/transport';
import {
  computeRitaseMetrics,
  formatRibuan,
  formatRp,
  getTodayIso,
} from '../utils/formatters';

interface TambahRitaseViewProps {
  vendors: Vendor[];
  ritase: Ritase[];
  editingRitase: Ritase | null;
  onAddRitase: (payload: Omit<Ritase, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateRitase: (id: string, payload: Omit<Ritase, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancelEdit: () => void;
  onGoToDaftar: () => void;
  onGoToVendors: () => void;
  onNotify: (message: string) => void;
}

const COMMODITY_PRESETS = [
  'Gandum Curah',
  'Jagung Pipil',
  'Kedelai Impor',
  'Beras Medium',
  'Bungkil Kedelai (SBM)',
  'Dedak / Bekatul',
  'Tapioka / Gaplek',
];

interface RitaseFormState {
  tanggalMuat: string;
  vendorId: string;
  nopol: string;
  namaSopir: string;
  jenisMuatan: string;
  lokasiMuat: string;
  lokasiBongkar: string;
  beratMuatKg: string;
  beratBongkarKg: string;
  hargaPusatPerKg: string;
  hargaJualVendorPerKg: string;
  uangJalan: string;
  sumberUangJalan: SumberUangJalan;
  biayaKartuGto: string;
  toleransiSusutPersen: string;
  docStatus: DocStatus;
  vendorPaymentStatus: VendorPaymentStatus;
  pusatPaymentStatus: PusatPaymentStatus;
}

function parseToleransiValue(raw: unknown): number {
  if (raw !== undefined && raw !== null && String(raw).trim() !== '' && !Number.isNaN(Number(raw))) {
    return Math.max(0, Number(raw));
  }
  return 0.3;
}

function createInitialFormState(defaultVendorId: string): RitaseFormState {
  return {
    tanggalMuat: getTodayIso(),
    vendorId: defaultVendorId,
    nopol: '',
    namaSopir: '',
    jenisMuatan: 'Gandum Curah',
    lokasiMuat: '',
    lokasiBongkar: '',
    beratMuatKg: '',
    beratBongkarKg: '',
    hargaPusatPerKg: '',
    hargaJualVendorPerKg: '',
    uangJalan: '0',
    sumberUangJalan: 'Broker',
    biayaKartuGto: '',
    toleransiSusutPersen: '0.3',
    docStatus: 'SJ & Tiket Timbang Belum Balik',
    vendorPaymentStatus: 'Belum Lunas',
    pusatPaymentStatus: 'Belum Dibayar Pusat',
  };
}

export function TambahRitaseView({
  vendors,
  ritase,
  editingRitase,
  onAddRitase,
  onUpdateRitase,
  onCancelEdit,
  onGoToDaftar,
  onGoToVendors,
  onNotify,
}: TambahRitaseViewProps) {
  const [form, setForm] = useState<RitaseFormState>(() =>
    createInitialFormState(vendors[0]?.id || '')
  );

  useEffect(() => {
    if (editingRitase) {
      setForm({
        tanggalMuat: editingRitase.tanggalMuat,
        vendorId: editingRitase.vendorId,
        nopol: editingRitase.nopol,
        namaSopir: editingRitase.namaSopir,
        jenisMuatan: editingRitase.jenisMuatan,
        lokasiMuat: editingRitase.lokasiMuat,
        lokasiBongkar: editingRitase.lokasiBongkar,
        beratMuatKg: editingRitase.beratMuatKg > 0 ? String(editingRitase.beratMuatKg) : '',
        beratBongkarKg:
          editingRitase.beratBongkarKg > 0 ? String(editingRitase.beratBongkarKg) : '',
        hargaPusatPerKg: String(editingRitase.hargaPusatPerKg),
        hargaJualVendorPerKg: String(editingRitase.hargaJualVendorPerKg),
        uangJalan: String(editingRitase.uangJalan),
        sumberUangJalan:
          editingRitase.sumberUangJalan === 'Pusat' ? 'Pusat' : 'Broker',
        biayaKartuGto:
          (editingRitase.biayaKartuGto || 0) > 0 ? String(editingRitase.biayaKartuGto) : '',
        toleransiSusutPersen: String(parseToleransiValue(editingRitase.toleransiSusutPersen)),
        docStatus: editingRitase.docStatus,
        vendorPaymentStatus: editingRitase.vendorPaymentStatus,
        pusatPaymentStatus: editingRitase.pusatPaymentStatus,
      });
    } else {
      setForm((prev) => ({
        ...createInitialFormState(vendors[0]?.id || ''),
        vendorId: prev.vendorId || vendors[0]?.id || '',
      }));
    }
  }, [editingRitase, vendors]);

  const vendorFleetSuggestions = useMemo(() => {
    const relevant = ritase.filter((r) => !form.vendorId || r.vendorId === form.vendorId);
    const pairMap = new Map<string, { nopol: string; namaSopir: string }>();
    const nopolDriverMap = new Map<string, string>();
    const nopolSet = new Set<string>();
    const driverSet = new Set<string>();

    for (const r of relevant) {
      const n = r.nopol.trim().toUpperCase();
      const s = r.namaSopir.trim();
      if (n) nopolSet.add(n);
      if (s) driverSet.add(s);
      if (n && s && !nopolDriverMap.has(n)) nopolDriverMap.set(n, s);
      if (n || s) {
        const key = `${n}__${s.toLowerCase()}`;
        if (!pairMap.has(key)) pairMap.set(key, { nopol: n, namaSopir: s });
      }
    }

    for (const r of ritase) {
      const n = r.nopol.trim().toUpperCase();
      const s = r.namaSopir.trim();
      if (n) nopolSet.add(n);
      if (s) driverSet.add(s);
      if (n && s && !nopolDriverMap.has(n)) nopolDriverMap.set(n, s);
    }

    const lokasiMuatSet = new Set<string>();
    const lokasiBongkarSet = new Set<string>();
    for (const r of ritase) {
      if (r.lokasiMuat.trim()) lokasiMuatSet.add(r.lokasiMuat.trim());
      if (r.lokasiBongkar.trim()) lokasiBongkarSet.add(r.lokasiBongkar.trim());
    }

    return {
      pairs: Array.from(pairMap.values()).slice(0, 6),
      nopolDriverMap,
      nopols: Array.from(nopolSet),
      drivers: Array.from(driverSet),
      lokasiMuats: Array.from(lokasiMuatSet),
      lokasiBongkars: Array.from(lokasiBongkarSet),
    };
  }, [ritase, form.vendorId]);

  // Poin 3.5: Saran Tarif Harga Terakhir berdasarkan Rute & Vendor
  const suggestedRate = useMemo(() => {
    const muatQ = form.lokasiMuat.trim().toLowerCase();
    const bongkarQ = form.lokasiBongkar.trim().toLowerCase();
    const candidates = ritase
      .filter(
        (r) =>
          r.id !== editingRitase?.id &&
          (r.hargaPusatPerKg > 0 || r.hargaJualVendorPerKg > 0)
      )
      .sort((a, b) => b.tanggalMuat.localeCompare(a.tanggalMuat));

    if (candidates.length === 0) return null;

    if (muatQ && bongkarQ) {
      const exactVendorRoute = candidates.find(
        (r) =>
          r.vendorId === form.vendorId &&
          r.lokasiMuat.trim().toLowerCase() === muatQ &&
          r.lokasiBongkar.trim().toLowerCase() === bongkarQ
      );
      if (exactVendorRoute) {
        return {
          hargaPusat: exactVendorRoute.hargaPusatPerKg,
          hargaVendor: exactVendorRoute.hargaJualVendorPerKg,
          toleransiSusutPersen: parseToleransiValue(exactVendorRoute.toleransiSusutPersen),
          label: `Rute & vendor sama (${exactVendorRoute.lokasiMuat} → ${exactVendorRoute.lokasiBongkar})`,
        };
      }

      const exactRoute = candidates.find(
        (r) =>
          r.lokasiMuat.trim().toLowerCase() === muatQ &&
          r.lokasiBongkar.trim().toLowerCase() === bongkarQ
      );
      if (exactRoute) {
        return {
          hargaPusat: exactRoute.hargaPusatPerKg,
          hargaVendor: exactRoute.hargaJualVendorPerKg,
          toleransiSusutPersen: parseToleransiValue(exactRoute.toleransiSusutPersen),
          label: `Rute sama (${exactRoute.lokasiMuat} → ${exactRoute.lokasiBongkar})`,
        };
      }
    }

    if (form.vendorId) {
      const vendorLatest = candidates.find((r) => r.vendorId === form.vendorId);
      if (vendorLatest) {
        return {
          hargaPusat: vendorLatest.hargaPusatPerKg,
          hargaVendor: vendorLatest.hargaJualVendorPerKg,
          toleransiSusutPersen: parseToleransiValue(vendorLatest.toleransiSusutPersen),
          label: `Tarif terakhir vendor (${vendorLatest.lokasiMuat} → ${vendorLatest.lokasiBongkar})`,
        };
      }
    }

    return null;
  }, [ritase, editingRitase?.id, form.vendorId, form.lokasiMuat, form.lokasiBongkar]);

  const liveMetrics = useMemo(() => {
    const dummyRitase: Ritase = {
      id: 'preview',
      tanggalMuat: form.tanggalMuat,
      vendorId: form.vendorId,
      nopol: form.nopol,
      namaSopir: form.namaSopir,
      jenisMuatan: form.jenisMuatan,
      lokasiMuat: form.lokasiMuat,
      lokasiBongkar: form.lokasiBongkar,
      beratMuatKg: Number(form.beratMuatKg) || 0,
      beratBongkarKg: Number(form.beratBongkarKg) || 0,
      hargaPusatPerKg: Number(form.hargaPusatPerKg) || 0,
      hargaJualVendorPerKg: Number(form.hargaJualVendorPerKg) || 0,
      uangJalan: Number(form.uangJalan) || 0,
      sumberUangJalan: form.sumberUangJalan,
      biayaKartuGto: Math.max(0, Number(form.biayaKartuGto) || 0),
      toleransiSusutPersen: parseToleransiValue(form.toleransiSusutPersen),
      docStatus: form.docStatus,
      vendorPaymentStatus: form.vendorPaymentStatus,
      pusatPaymentStatus: form.pusatPaymentStatus,
      createdAt: '',
      updatedAt: '',
    };
    return computeRitaseMetrics(dummyRitase);
  }, [form]);

  const handleVendorChange = (nextVendorId: string) => {
    if (!editingRitase) {
      const latestForVendor = ritase.find((r) => r.vendorId === nextVendorId);
      setForm((prev) => ({
        ...prev,
        vendorId: nextVendorId,
        nopol: prev.nopol.trim() === '' && latestForVendor ? latestForVendor.nopol : prev.nopol,
        namaSopir:
          prev.namaSopir.trim() === '' && latestForVendor
            ? latestForVendor.namaSopir
            : prev.namaSopir,
      }));
    } else {
      setForm((prev) => ({ ...prev, vendorId: nextVendorId }));
    }
  };

  const handleNopolChange = (value: string) => {
    const normalized = value.trim().toUpperCase();
    const matchedDriver = vendorFleetSuggestions.nopolDriverMap.get(normalized);
    setForm((prev) => ({
      ...prev,
      nopol: value,
      namaSopir: matchedDriver || prev.namaSopir,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendorId) {
      onNotify('Silakan tambahkan Vendor terlebih dahulu di menu Master Data Vendor.');
      return;
    }
    if (
      !form.nopol.trim() ||
      !form.namaSopir.trim() ||
      !form.lokasiMuat.trim() ||
      !form.lokasiBongkar.trim()
    ) {
      onNotify('Lengkapi Nopol, Nama Sopir, Lokasi Muat, dan Lokasi Bongkar.');
      return;
    }

    const payload: Omit<Ritase, 'id' | 'createdAt' | 'updatedAt'> = {
      tanggalMuat: form.tanggalMuat || getTodayIso(),
      vendorId: form.vendorId,
      nopol: form.nopol.trim().toUpperCase(),
      namaSopir: form.namaSopir.trim(),
      jenisMuatan: form.jenisMuatan.trim() || 'Barang Curah',
      lokasiMuat: form.lokasiMuat.trim(),
      lokasiBongkar: form.lokasiBongkar.trim(),
      beratMuatKg: Math.max(0, Number(form.beratMuatKg) || 0),
      beratBongkarKg: Math.max(0, Number(form.beratBongkarKg) || 0),
      hargaPusatPerKg: Math.max(0, Number(form.hargaPusatPerKg) || 0),
      hargaJualVendorPerKg: Math.max(0, Number(form.hargaJualVendorPerKg) || 0),
      uangJalan: Math.max(0, Number(form.uangJalan) || 0),
      sumberUangJalan: form.sumberUangJalan,
      biayaKartuGto: Math.max(0, Number(form.biayaKartuGto) || 0),
      toleransiSusutPersen: parseToleransiValue(form.toleransiSusutPersen),
      docStatus: form.docStatus,
      vendorPaymentStatus: form.vendorPaymentStatus,
      pusatPaymentStatus: form.pusatPaymentStatus,
    };

    if (editingRitase) {
      onUpdateRitase(editingRitase.id, payload);
      onNotify(`Ritase ${payload.nopol} (${payload.jenisMuatan}) berhasil diperbarui.`);
      onGoToDaftar();
    } else {
      onAddRitase(payload);
      onNotify(`Ritase baru ${payload.nopol} (${payload.jenisMuatan}) berhasil disimpan.`);
      setForm(createInitialFormState(form.vendorId));
    }
  };

  const priceWarning =
    (Number(form.hargaPusatPerKg) || 0) > 0 &&
    (Number(form.hargaJualVendorPerKg) || 0) > (Number(form.hargaPusatPerKg) || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
            {editingRitase ? 'Edit Data Ritase' : 'Tambah Ritase Baru'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Fokus pengisian data ritase tanpa tercampur tabel arsip. Selisih Harga Pusat dan Harga Jual ke Vendor otomatis dihitung menjadi keuntungan.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (editingRitase) onCancelEdit();
            onGoToDaftar();
          }}
          className="inline-flex min-h-[40px] items-center gap-2 self-start rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 sm:self-auto whitespace-nowrap"
        >
          <ArrowLeft className="h-4 w-4" />
          Lihat Daftar Ritase
        </button>
      </div>

      {vendors.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-700/60 bg-amber-950/40 px-4 py-3 text-xs text-amber-200">
          <span>Anda belum memiliki data vendor. Tambahkan vendor terlebih dahulu sebelum mencatat ritase.</span>
          <button
            type="button"
            onClick={onGoToVendors}
            className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-500"
          >
            Buka Master Vendor
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6 space-y-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="rit-tgl" className="block text-xs font-semibold text-slate-300">
              Tanggal Muat <span className="text-rose-400">*</span>
            </label>
            <input
              id="rit-tgl"
              type="date"
              required
              value={form.tanggalMuat}
              onChange={(e) => setForm((p) => ({ ...p, tanggalMuat: e.target.value }))}
              className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="rit-vendor" className="block text-xs font-semibold text-slate-300">
              Vendor Armada <span className="text-rose-400">*</span>
            </label>
            <select
              id="rit-vendor"
              required
              value={form.vendorId}
              onChange={(e) => handleVendorChange(e.target.value)}
              className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {vendors.length === 0 && <option value="">-- Belum ada vendor --</option>}
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rit-muatan" className="block text-xs font-semibold text-slate-300">
              Jenis Muatan <span className="text-rose-400">*</span>
            </label>
            <input
              id="rit-muatan"
              type="text"
              list="commodity-presets"
              required
              value={form.jenisMuatan}
              onChange={(e) => setForm((p) => ({ ...p, jenisMuatan: e.target.value }))}
              placeholder="Gandum, Jagung, Kedelai..."
              className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
            <datalist id="commodity-presets">
              {COMMODITY_PRESETS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          {vendorFleetSuggestions.pairs.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3.5 py-2.5">
              <div className="text-[11px] font-medium text-slate-400">
                Isi cepat Nopol &amp; Sopir dari riwayat vendor:
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {vendorFleetSuggestions.pairs.map((pair, idx) => (
                  <button
                    key={`${pair.nopol}-${pair.namaSopir}-${idx}`}
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        nopol: pair.nopol,
                        namaSopir: pair.namaSopir,
                      }))
                    }
                    className="inline-flex min-h-[30px] items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 transition-colors hover:border-blue-500 hover:bg-blue-950/60 hover:text-blue-300"
                  >
                    <span className="font-mono font-semibold">{pair.nopol}</span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span>{pair.namaSopir}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rit-nopol" className="block text-xs font-semibold text-slate-300">
                Nopol Kendaraan <span className="text-rose-400">*</span>
              </label>
              <input
                id="rit-nopol"
                type="text"
                list="nopol-history"
                required
                value={form.nopol}
                onChange={(e) => handleNopolChange(e.target.value)}
                placeholder="Contoh: L 9421 UX"
                className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm uppercase text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <datalist id="nopol-history">
                {vendorFleetSuggestions.nopols.map((np) => (
                  <option key={np} value={np} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="rit-sopir" className="block text-xs font-semibold text-slate-300">
                Nama Sopir <span className="text-rose-400">*</span>
              </label>
              <input
                id="rit-sopir"
                type="text"
                list="driver-history"
                required
                value={form.namaSopir}
                onChange={(e) => setForm((p) => ({ ...p, namaSopir: e.target.value }))}
                placeholder="Contoh: Slamet Riyadi"
                className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <datalist id="driver-history">
                {vendorFleetSuggestions.drivers.map((drv) => (
                  <option key={drv} value={drv} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label htmlFor="rit-muat" className="block text-xs font-semibold text-slate-300">
              Lokasi Muat <span className="text-rose-400">*</span>
            </label>
            <input
              id="rit-muat"
              type="text"
              list="lokasi-muat-history"
              required
              value={form.lokasiMuat}
              onChange={(e) => setForm((p) => ({ ...p, lokasiMuat: e.target.value }))}
              placeholder="Pelabuhan / Gudang Asal"
              className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
            <datalist id="lokasi-muat-history">
              {vendorFleetSuggestions.lokasiMuats.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="rit-bongkar" className="block text-xs font-semibold text-slate-300">
              Lokasi Bongkar <span className="text-rose-400">*</span>
            </label>
            <input
              id="rit-bongkar"
              type="text"
              list="lokasi-bongkar-history"
              required
              value={form.lokasiBongkar}
              onChange={(e) => setForm((p) => ({ ...p, lokasiBongkar: e.target.value }))}
              placeholder="Pabrik / Gudang Tujuan"
              className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
            <datalist id="lokasi-bongkar-history">
              {vendorFleetSuggestions.lokasiBongkars.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rit-bmuat" className="block text-xs font-semibold text-slate-300">
                Berat Muat (Kg) <span className="text-[11px] font-normal text-slate-400">(Opsional)</span>
              </label>
              <input
                id="rit-bmuat"
                type="number"
                min={0}
                step="1"
                value={form.beratMuatKg}
                onChange={(e) => setForm((p) => ({ ...p, beratMuatKg: e.target.value }))}
                placeholder="Isi setelah muat"
                className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 tabular-nums placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="rit-bbongkar" className="block text-xs font-semibold text-slate-300">
                Berat Bongkar (Kg) <span className="text-[11px] font-normal text-slate-400">(Opsional)</span>
              </label>
              <input
                id="rit-bbongkar"
                type="number"
                min={0}
                step="1"
                value={form.beratBongkarKg}
                onChange={(e) => setForm((p) => ({ ...p, beratBongkarKg: e.target.value }))}
                placeholder="Isi setelah bongkar"
                className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 tabular-nums placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="rit-pusat" className="block text-xs font-semibold text-slate-300">
              Harga Pusat per Kg (Rp) <span className="text-rose-400">*</span>
            </label>
            <input
              id="rit-pusat"
              type="number"
              min={0}
              step="1"
              required
              value={form.hargaPusatPerKg}
              onChange={(e) => setForm((p) => ({ ...p, hargaPusatPerKg: e.target.value }))}
              placeholder="Contoh: 245 (lebih tinggi)"
              className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="rit-vendor-rate" className="block text-xs font-semibold text-slate-300">
              Harga Jual ke Vendor per Kg (Rp) <span className="text-rose-400">*</span>
            </label>
            <input
              id="rit-vendor-rate"
              type="number"
              min={0}
              step="1"
              required
              value={form.hargaJualVendorPerKg}
              onChange={(e) => setForm((p) => ({ ...p, hargaJualVendorPerKg: e.target.value }))}
              placeholder="Contoh: 210 (lebih murah)"
              className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div className="flex flex-col justify-end">
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs">
              <span className="text-slate-400">Selisih Margin / Kg: </span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  (Number(form.hargaPusatPerKg) || 0) - (Number(form.hargaJualVendorPerKg) || 0) >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {formatRp(
                  (Number(form.hargaPusatPerKg) || 0) - (Number(form.hargaJualVendorPerKg) || 0)
                )}
                /Kg
              </span>
            </div>
          </div>

          {suggestedRate && (
            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-800/60 bg-blue-950/30 px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2 text-blue-200">
                <Sparkles className="h-4 w-4 text-blue-400 shrink-0" />
                <span>
                  <strong className="text-blue-100">Tarif Terakhir ({suggestedRate.label}):</strong>{' '}
                  <span className="font-mono">
                    Pusat {formatRp(suggestedRate.hargaPusat)}/Kg · Vendor{' '}
                    {formatRp(suggestedRate.hargaVendor)}/Kg · Tol. Susut{' '}
                    {String(suggestedRate.toleransiSusutPersen).replace('.', ',')}%
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    hargaPusatPerKg: String(suggestedRate.hargaPusat),
                    hargaJualVendorPerKg: String(suggestedRate.hargaVendor),
                    toleransiSusutPersen: String(suggestedRate.toleransiSusutPersen),
                  }))
                }
                className="inline-flex min-h-[30px] items-center rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500 whitespace-nowrap"
              >
                Pakai Tarif Ini
              </button>
            </div>
          )}

          <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="rit-uangjalan" className="block text-xs font-semibold text-slate-300">
                Uang Jalan / DP Awal (Rp)
              </label>
              <input
                id="rit-uangjalan"
                type="number"
                min={0}
                step="1000"
                value={form.uangJalan}
                onChange={(e) => setForm((p) => ({ ...p, uangJalan: e.target.value }))}
                className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-1 lg:col-span-2">
              <span className="block text-xs font-semibold text-slate-300">
                Sumber Pembayaran Uang Jalan
              </span>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, sumberUangJalan: 'Broker' }))}
                  className={`min-h-[42px] rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                    form.sumberUangJalan === 'Broker'
                      ? 'border-blue-500 bg-blue-950/70 text-blue-200'
                      : 'border-slate-700 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div>Dari Broker</div>
                  <div className="text-[10px] font-normal opacity-80">Talangan kita dulu</div>
                </button>

                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, sumberUangJalan: 'Pusat' }))}
                  className={`min-h-[42px] rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                    form.sumberUangJalan === 'Pusat'
                      ? 'border-amber-500 bg-amber-950/70 text-amber-200'
                      : 'border-slate-700 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div>Dari Pusat</div>
                  <div className="text-[10px] font-normal opacity-80">Potong tagihan Pusat</div>
                </button>
              </div>
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rit-gto" className="block text-xs font-semibold text-slate-300">
                Biaya Kartu GTO (Rp){' '}
                <span className="text-[11px] font-normal text-slate-400">(Opsional)</span>
              </label>
              <input
                id="rit-gto"
                type="number"
                min={0}
                step="1000"
                value={form.biayaKartuGto}
                onChange={(e) => setForm((p) => ({ ...p, biayaKartuGto: e.target.value }))}
                placeholder="0 (kosongkan jika tidak pakai GTO)"
                className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 tabular-nums placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Jika diisi &gt; 0, otomatis ditagihkan ke vendor dan muncul di Nota. Jika 0, baris GTO dihilangkan dari Nota.
              </p>
            </div>

            <div>
              <label htmlFor="rit-toleransi" className="block text-xs font-semibold text-slate-300">
                Toleransi Susut Pabrik (%){' '}
                <span className="text-[11px] font-normal text-slate-400">(Default 0,3%)</span>
              </label>
              <input
                id="rit-toleransi"
                type="number"
                min={0}
                max={100}
                step="0.05"
                value={form.toleransiSusutPersen}
                onChange={(e) => setForm((p) => ({ ...p, toleransiSusutPersen: e.target.value }))}
                placeholder="0.3"
                className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 tabular-nums placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Sesuaikan aturan pabrik tujuan (contoh: 0,2 / 0,3 / 0,5). Isi 0 jika tanpa toleransi.
              </p>
            </div>
          </div>
        </div>

        {priceWarning && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-700/60 bg-rose-950/50 px-4 py-2.5 text-xs text-rose-200">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>
              Perhatian: Harga Jual ke Vendor saat ini lebih besar daripada Harga Pusat sehingga keuntungan bernilai minus.
            </span>
          </div>
        )}

        {/* Live Calculation Strip */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:grid-cols-4">
          <div>
            <div className="text-[11px] font-medium text-slate-400">
              {liveMetrics.isSelesaiBongkar ? 'Selisih Susut Timbang' : 'Status Timbangan'}
            </div>
            {liveMetrics.isSelesaiBongkar ? (
              <>
                <div
                  className={`mt-1 font-mono text-sm font-bold tabular-nums ${
                    liveMetrics.susutKg > 0 &&
                    (Number(form.beratMuatKg) || 0) > 0 &&
                    liveMetrics.susutPersen > liveMetrics.toleransiSusutPersen
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {(Number(form.beratMuatKg) || 0) <= 0
                    ? `Bongkar ${formatRibuan(Number(form.beratBongkarKg) || 0)} Kg`
                    : liveMetrics.susutKg > 0
                    ? `-${formatRibuan(liveMetrics.susutKg)} Kg (${liveMetrics.susutPersen.toFixed(2)}%)`
                    : liveMetrics.susutKg < 0
                    ? `+${formatRibuan(Math.abs(liveMetrics.susutKg))} Kg (Lebih)`
                    : '0 Kg (0,00%)'}
                </div>
                {(Number(form.beratMuatKg) || 0) > 0 && (
                  <div className="text-[10px] font-mono text-slate-400">
                    Tol. {String(liveMetrics.toleransiSusutPersen).replace('.', ',')}% (
                    {formatRibuan(
                      Math.round(
                        (Number(form.beratMuatKg) || 0) * (liveMetrics.toleransiSusutPersen / 100)
                      )
                    )}{' '}
                    Kg)
                  </div>
                )}
              </>
            ) : (
              <div className="mt-1 text-xs font-semibold text-amber-400">
                {liveMetrics.timbanganStatus === 'Dalam Perjalanan'
                  ? `Sudah Muat ${formatRibuan(Number(form.beratMuatKg) || 0)} Kg · Menunggu Bongkar`
                  : 'Menunggu Timbang Muat'}
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-400">
              {form.sumberUangJalan === 'Pusat'
                ? 'Sisa Tagihan Pusat (Potong UJ)'
                : 'Tagihan dari Pusat'}
            </div>
            <div className="mt-1 font-mono text-sm font-bold text-slate-100 tabular-nums">
              {liveMetrics.isSelesaiBongkar ? formatRp(liveMetrics.tagihanPusat) : 'Menunggu Bongkar'}
            </div>
            {liveMetrics.isSelesaiBongkar && form.sumberUangJalan === 'Pusat' && liveMetrics.uangJalan > 0 && (
              <div className="text-[10px] text-amber-300 font-mono">
                Bruto {formatRp(liveMetrics.tagihanBrutoPusat)} − UJ {formatRp(liveMetrics.uangJalan)}
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-400">Ongkos ke Vendor</div>
            <div className="mt-1 font-mono text-sm font-bold text-slate-100 tabular-nums">
              {liveMetrics.isSelesaiBongkar
                ? formatRp(liveMetrics.jumlahOngkosVendor)
                : 'Menunggu Bongkar'}
            </div>
            {liveMetrics.biayaKartuGto > 0 && (
              <div className="text-[10px] text-amber-300 font-mono">
                Pot. GTO: {formatRp(liveMetrics.biayaKartuGto)}
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-400">Keuntungan (Sisa Pusat)</div>
            <div
              className={`mt-1 font-mono text-sm font-bold tabular-nums ${
                !liveMetrics.isSelesaiBongkar
                  ? 'text-slate-400'
                  : liveMetrics.keuntungan >= 0
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              {liveMetrics.isSelesaiBongkar ? formatRp(liveMetrics.keuntungan) : '-'}
            </div>
          </div>
        </div>

        {/* Status Controls */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="rit-doc-status" className="block text-xs font-semibold text-slate-300">
              Status Dokumen (SJ &amp; Timbangan)
            </label>
            <select
              id="rit-doc-status"
              value={form.docStatus}
              onChange={(e) => setForm((p) => ({ ...p, docStatus: e.target.value as DocStatus }))}
              className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="SJ & Tiket Timbang Belum Balik">SJ &amp; Tiket Timbang Belum Balik</option>
              <option value="SJ & Tiket Timbang Lengkap">SJ &amp; Tiket Timbang Lengkap</option>
            </select>
          </div>

          <div>
            <label htmlFor="rit-vendor-pay" className="block text-xs font-semibold text-slate-300">
              Status Pembayaran ke Vendor
            </label>
            <select
              id="rit-vendor-pay"
              value={form.vendorPaymentStatus}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  vendorPaymentStatus: e.target.value as VendorPaymentStatus,
                }))
              }
              className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="Belum Lunas">Belum Lunas</option>
              <option value="Lunas">Lunas</option>
            </select>
          </div>

          <div>
            <label htmlFor="rit-pusat-pay" className="block text-xs font-semibold text-slate-300">
              Status Pembayaran dari Pusat
            </label>
            <select
              id="rit-pusat-pay"
              value={form.pusatPaymentStatus}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  pusatPaymentStatus: e.target.value as PusatPaymentStatus,
                }))
              }
              className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="Belum Dibayar Pusat">Belum Dibayar Pusat</option>
              <option value="Sudah Dibayar Pusat">Sudah Dibayar Pusat</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-4">
          {editingRitase ? (
            <button
              type="button"
              onClick={() => {
                onCancelEdit();
                onGoToDaftar();
              }}
              className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Batal Edit
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setForm(createInitialFormState(vendors[0]?.id || ''))}
              className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Reset Form
            </button>
          )}

          <button
            type="submit"
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {editingRitase ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingRitase ? 'Simpan Perubahan Ritase' : 'Simpan Data Ritase'}
          </button>
        </div>
      </form>
    </div>
  );
}
