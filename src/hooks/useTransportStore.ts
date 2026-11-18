import { useEffect, useState } from 'react';
import { SEED_BROKER_DATA } from '../data/seedData';
import { BrokerDatabase, NotaAdjustment, Ritase, Vendor } from '../types/transport';
import { generateId, getTodayIso } from '../utils/formatters';

const STORAGE_KEY = 'niagaangkut_broker_db_v2';

// Migrasi aman jika user masih punya data lama di v1
function migrateLegacyRitase(raw: Record<string, unknown>): Ritase {
  const hargaPusat =
    Number(raw.hargaPusatPerKg ?? raw.hargaJualPerKg ?? 0) || 0;
  const hargaVendor =
    Number(raw.hargaJualVendorPerKg ?? raw.oaVendorPerKg ?? 0) || 0;
  const uangJalan =
    Number(raw.uangJalan ?? (Number(raw.uangJalanAwal || 0) + Number(raw.tambahanUangJalan || 0))) ||
    0;
  const rawPusatStatus = String(raw.pusatPaymentStatus ?? raw.customerPaymentStatus ?? '');
  const pusatPaymentStatus =
    rawPusatStatus === 'Sudah Dibayar Pusat' || rawPusatStatus === 'Sudah Dibayar Customer'
      ? 'Sudah Dibayar Pusat'
      : 'Belum Dibayar Pusat';

  return {
    id: String(raw.id || generateId('rit')),
    tanggalMuat: String(raw.tanggalMuat || getTodayIso()),
    vendorId: String(raw.vendorId || ''),
    nopol: String(raw.nopol || ''),
    namaSopir: String(raw.namaSopir || ''),
    jenisMuatan: String(raw.jenisMuatan || ''),
    lokasiMuat: String(raw.lokasiMuat || ''),
    lokasiBongkar: String(raw.lokasiBongkar || ''),
    beratMuatKg: Number(raw.beratMuatKg) || 0,
    beratBongkarKg: Number(raw.beratBongkarKg) || 0,
    hargaPusatPerKg: hargaPusat,
    hargaJualVendorPerKg: hargaVendor,
    uangJalan,
    docStatus:
      raw.docStatus === 'SJ & Tiket Timbang Lengkap'
        ? 'SJ & Tiket Timbang Lengkap'
        : 'SJ & Tiket Timbang Belum Balik',
    vendorPaymentStatus: raw.vendorPaymentStatus === 'Lunas' ? 'Lunas' : 'Belum Lunas',
    pusatPaymentStatus,
    paidAt: raw.paidAt ? String(raw.paidAt) : undefined,
    createdAt: String(raw.createdAt || getTodayIso()),
    updatedAt: String(raw.updatedAt || getTodayIso()),
  };
}

function loadDatabase(): BrokerDatabase {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) || localStorage.getItem('niagaangkut_broker_db_v1');
    if (!raw) return SEED_BROKER_DATA;
    const parsed = JSON.parse(raw) as Partial<BrokerDatabase>;
    if (Array.isArray(parsed.vendors) && Array.isArray(parsed.ritase)) {
      return {
        vendors: parsed.vendors,
        ritase: parsed.ritase.map((item) =>
          migrateLegacyRitase(item as unknown as Record<string, unknown>)
        ),
        notaAdjustments: parsed.notaAdjustments || {},
      };
    }
    return SEED_BROKER_DATA;
  } catch {
    return SEED_BROKER_DATA;
  }
}

export function useTransportStore() {
  const [db, setDb] = useState<BrokerDatabase>(() => loadDatabase());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Ignore storage quota issues safely
    }
  }, [db]);

  const addVendor = (payload: Omit<Vendor, 'id' | 'createdAt'>) => {
    const newVendor: Vendor = {
      ...payload,
      id: generateId('vnd'),
      createdAt: getTodayIso(),
    };
    setDb((prev) => ({
      ...prev,
      vendors: [newVendor, ...prev.vendors],
    }));
    return newVendor;
  };

  const updateVendor = (id: string, payload: Omit<Vendor, 'id' | 'createdAt'>) => {
    setDb((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) => (v.id === id ? { ...v, ...payload } : v)),
    }));
  };

  const deleteVendor = (id: string) => {
    setDb((prev) => ({
      ...prev,
      vendors: prev.vendors.filter((v) => v.id !== id),
    }));
  };

  const addRitase = (payload: Omit<Ritase, 'id' | 'createdAt' | 'updatedAt'>) => {
    const today = getTodayIso();
    const newRitase: Ritase = {
      ...payload,
      id: generateId('rit'),
      paidAt: payload.vendorPaymentStatus === 'Lunas' ? today : undefined,
      createdAt: today,
      updatedAt: today,
    };
    setDb((prev) => ({
      ...prev,
      ritase: [newRitase, ...prev.ritase],
    }));
    return newRitase;
  };

  const updateRitase = (id: string, payload: Omit<Ritase, 'id' | 'createdAt' | 'updatedAt'>) => {
    const today = getTodayIso();
    setDb((prev) => ({
      ...prev,
      ritase: prev.ritase.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          ...payload,
          paidAt: payload.vendorPaymentStatus === 'Lunas' ? r.paidAt || today : undefined,
          updatedAt: today,
        };
      }),
    }));
  };

  const deleteRitase = (id: string) => {
    setDb((prev) => ({
      ...prev,
      ritase: prev.ritase.filter((r) => r.id !== id),
    }));
  };

  const toggleDocStatus = (id: string) => {
    const today = getTodayIso();
    setDb((prev) => ({
      ...prev,
      ritase: prev.ritase.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          docStatus:
            r.docStatus === 'SJ & Tiket Timbang Lengkap'
              ? 'SJ & Tiket Timbang Belum Balik'
              : 'SJ & Tiket Timbang Lengkap',
          updatedAt: today,
        };
      }),
    }));
  };

  const toggleVendorPaymentStatus = (id: string) => {
    const today = getTodayIso();
    setDb((prev) => ({
      ...prev,
      ritase: prev.ritase.map((r) => {
        if (r.id !== id) return r;
        const nextStatus = r.vendorPaymentStatus === 'Lunas' ? 'Belum Lunas' : 'Lunas';
        return {
          ...r,
          vendorPaymentStatus: nextStatus,
          paidAt: nextStatus === 'Lunas' ? today : undefined,
          updatedAt: today,
        };
      }),
    }));
  };

  const togglePusatPaymentStatus = (id: string) => {
    const today = getTodayIso();
    setDb((prev) => ({
      ...prev,
      ritase: prev.ritase.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          pusatPaymentStatus:
            r.pusatPaymentStatus === 'Sudah Dibayar Pusat'
              ? 'Belum Dibayar Pusat'
              : 'Sudah Dibayar Pusat',
          updatedAt: today,
        };
      }),
    }));
  };

  const markMultipleRitaseLunas = (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const today = getTodayIso();
    setDb((prev) => ({
      ...prev,
      ritase: prev.ritase.map((r) => {
        if (!idSet.has(r.id)) return r;
        return {
          ...r,
          vendorPaymentStatus: 'Lunas',
          paidAt: r.paidAt || today,
          updatedAt: today,
        };
      }),
    }));
  };

  const markMultiplePusatPaid = (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const today = getTodayIso();
    setDb((prev) => ({
      ...prev,
      ritase: prev.ritase.map((r) => {
        if (!idSet.has(r.id)) return r;
        return {
          ...r,
          pusatPaymentStatus: 'Sudah Dibayar Pusat',
          updatedAt: today,
        };
      }),
    }));
  };

  const updateNotaAdjustment = (key: string, adj: NotaAdjustment) => {
    setDb((prev) => ({
      ...prev,
      notaAdjustments: {
        ...(prev.notaAdjustments || {}),
        [key]: adj,
      },
    }));
  };

  const restoreDatabase = (nextDb: BrokerDatabase) => {
    setDb({
      vendors: nextDb.vendors || [],
      ritase: (nextDb.ritase || []).map((item) =>
        migrateLegacyRitase(item as unknown as Record<string, unknown>)
      ),
      notaAdjustments: nextDb.notaAdjustments || {},
    });
  };

  const clearAllData = () => {
    setDb({
      vendors: [],
      ritase: [],
      notaAdjustments: {},
    });
  };

  const resetSampleData = () => {
    setDb(SEED_BROKER_DATA);
  };

  return {
    db,
    addVendor,
    updateVendor,
    deleteVendor,
    addRitase,
    updateRitase,
    deleteRitase,
    toggleDocStatus,
    toggleVendorPaymentStatus,
    togglePusatPaymentStatus,
    markMultipleRitaseLunas,
    markMultiplePusatPaid,
    updateNotaAdjustment,
    restoreDatabase,
    clearAllData,
    resetSampleData,
  };
}
