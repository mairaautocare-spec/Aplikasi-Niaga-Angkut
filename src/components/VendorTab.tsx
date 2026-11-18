import React, { useMemo, useState } from 'react';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Ritase, Vendor } from '../types/transport';
import { computeRitaseMetrics, formatRp } from '../utils/formatters';

interface VendorTabProps {
  vendors: Vendor[];
  ritase: Ritase[];
  onAddVendor: (payload: Omit<Vendor, 'id' | 'createdAt'>) => void;
  onUpdateVendor: (id: string, payload: Omit<Vendor, 'id' | 'createdAt'>) => void;
  onDeleteVendor: (id: string) => void;
  onNotify: (message: string) => void;
}

export function VendorTab({
  vendors,
  ritase,
  onAddVendor,
  onUpdateVendor,
  onDeleteVendor,
  onNotify,
}: VendorTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [paymentInfo, setPaymentInfo] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const vendorStats = useMemo(() => {
    const map = new Map<string, { total: number; unpaid: number; unpaidAmount: number }>();
    for (const r of ritase) {
      const m = computeRitaseMetrics(r);
      const curr = map.get(r.vendorId) || { total: 0, unpaid: 0, unpaidAmount: 0 };
      curr.total += 1;
      if (r.vendorPaymentStatus === 'Belum Lunas') {
        curr.unpaid += 1;
        curr.unpaidAmount += m.sisaKewajibanVendor;
      }
      map.set(r.vendorId, curr);
    }
    return map;
  }, [ritase]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPaymentInfo('');
    setContactPerson('');
    setNotes('');
  };

  const handleEdit = (v: Vendor) => {
    setEditingId(v.id);
    setName(v.name);
    setPaymentInfo(v.paymentInfo);
    setContactPerson(v.contactPerson || '');
    setNotes(v.notes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !paymentInfo.trim()) {
      onNotify('Nama Vendor dan Info Rekening Pembayaran wajib diisi.');
      return;
    }

    const payload = {
      name: name.trim(),
      paymentInfo: paymentInfo.trim(),
      contactPerson: contactPerson.trim(),
      notes: notes.trim(),
    };

    if (editingId) {
      onUpdateVendor(editingId, payload);
      onNotify(`Data vendor "${payload.name}" berhasil diperbarui.`);
    } else {
      onAddVendor(payload);
      onNotify(`Vendor baru "${payload.name}" berhasil ditambahkan.`);
    }
    resetForm();
  };

  const vendorToDelete = vendors.find((v) => v.id === confirmDeleteId);
  const deleteLinkedCount = confirmDeleteId
    ? vendorStats.get(confirmDeleteId)?.total || 0
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
          Master Data Vendor Armada
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Kelola daftar pemilik armada angkutan beserta nomor rekening resmi untuk cetak rincian pembayaran.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-5"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-semibold text-slate-100">
              {editingId ? 'Edit Data Vendor' : 'Tambah Vendor Baru'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                Batal Edit
              </button>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="vendor-name" className="block text-xs font-semibold text-slate-300">
                Nama Vendor <span className="text-rose-400">*</span>
              </label>
              <input
                id="vendor-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: PT Jhynan Trans Logistik"
                className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="vendor-rekening" className="block text-xs font-semibold text-slate-300">
                Info Rekening Pembayaran <span className="text-rose-400">*</span>
              </label>
              <textarea
                id="vendor-rekening"
                required
                rows={2}
                value={paymentInfo}
                onChange={(e) => setPaymentInfo(e.target.value)}
                placeholder="Contoh: Transfer Mandiri : 2288 0100 050 568 PT. Jhynan Trans Logistik"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Teks ini tampil otomatis di bagian "Pembayaran :" pada cetak nota dan ringkasan WhatsApp.
              </p>
            </div>

            <div>
              <label htmlFor="vendor-contact" className="block text-xs font-semibold text-slate-300">
                Kontak / PIC (Opsional)
              </label>
              <input
                id="vendor-contact"
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Contoh: Pak Hendro (0812-9044-1182)"
                className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="vendor-notes" className="block text-xs font-semibold text-slate-300">
                Catatan Armada (Opsional)
              </label>
              <input
                id="vendor-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Jenis truk atau rute biasa"
                className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                {editingId ? 'Simpan Perubahan' : 'Simpan Vendor'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                >
                  Batal
                </button>
              )}
            </div>
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-100">
              Daftar Vendor Terdaftar ({vendors.length})
            </h2>
          </div>

          {vendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <Building2 className="h-9 w-9 text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-300">Belum ada data vendor</p>
              <p className="mt-1 text-xs text-slate-500">
                Tambahkan vendor pertama Anda melalui formulir di samping.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {vendors.map((vendor) => {
                const stat = vendorStats.get(vendor.id) || {
                  total: 0,
                  unpaid: 0,
                  unpaidAmount: 0,
                };
                return (
                  <div key={vendor.id} className="p-5 transition-colors hover:bg-slate-800/40">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <h3 className="text-base font-semibold text-slate-100">{vendor.name}</h3>
                        <p className="font-mono text-xs text-slate-300 break-words">
                          {vendor.paymentInfo}
                        </p>
                        {(vendor.contactPerson || vendor.notes) && (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-slate-400">
                            {vendor.contactPerson && <span>PIC: {vendor.contactPerson}</span>}
                            {vendor.contactPerson && vendor.notes && (
                              <span aria-hidden="true">·</span>
                            )}
                            {vendor.notes && <span>{vendor.notes}</span>}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-xs tabular-nums">
                          <span className="text-slate-400">
                            Total Ritase: <strong className="text-slate-100">{stat.total}</strong>
                          </span>
                          <span aria-hidden="true" className="text-slate-700">
                            ·
                          </span>
                          <span className="text-slate-400">
                            Belum Lunas:{' '}
                            <strong
                              className={
                                stat.unpaid > 0 ? 'text-amber-400' : 'text-emerald-400'
                              }
                            >
                              {stat.unpaid} ({formatRp(stat.unpaidAmount)})
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEdit(vendor)}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 whitespace-nowrap"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(vendor.id)}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-rose-800/70 bg-slate-950 px-3 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-950/60 whitespace-nowrap"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {confirmDeleteId && vendorToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100">
              Hapus Vendor "{vendorToDelete.name}"?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {deleteLinkedCount > 0
                ? `Vendor ini terhubung dengan ${deleteLinkedCount} catatan ritase. Data ritase tidak akan terhapus, namun nama vendornya akan tampil sebagai "Vendor Terhapus / Lainnya".`
                : 'Vendor ini akan dihapus dari Master Data Vendor.'}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteVendor(confirmDeleteId);
                  if (editingId === confirmDeleteId) resetForm();
                  setConfirmDeleteId(null);
                  onNotify(`Vendor "${vendorToDelete.name}" telah dihapus.`);
                }}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
