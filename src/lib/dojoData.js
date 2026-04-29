/**
 * Dojo data layer — Tech mobile PWA flavor.
 *
 * Hooks and mutations the field tech app needs:
 *   - useAssignedJobs(techId)   — today's jobs assigned to this tech
 *   - usePriceBook              — for the create-invoice line items
 *   - completeJob               — flips status to completed, stamps timestamps
 *   - createInvoiceForJob       — pre-fills line items from job_line_items
 *   - recordManualPayment       — cash/check entry (FR-001 #4 + decision)
 *   - queueOfflinePayment       — IndexedDB queue when offline
 *
 * Setup:
 *   npm install @supabase/supabase-js
 *
 *   .env.local:
 *     VITE_SUPABASE_URL=https://ybujjznnjfzjbjfegmdj.supabase.co
 *     VITE_SUPABASE_ANON_KEY=<anon key>
 *     VITE_GHL_LOCATION_ID=3GI7SZRZHugGLBnDevX2
 */

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const LOCATION_ID = import.meta.env.VITE_GHL_LOCATION_ID;

if (!supabase) {
  // eslint-disable-next-line no-console
  console.warn('[dojoData] Missing Supabase env vars — using in-memory mode');
}

// ─── HOOKS ───────────────────────────────────────────────────────
export function useAssignedJobs(techId, dateISO) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!supabase || !techId) { setLoading(false); return; }
    setLoading(true);
    let q = supabase.from('jobs').select('*').eq('technician_id', techId);
    if (dateISO) q = q.eq('scheduled_date', dateISO);
    const { data } = await q.order('scheduled_time', { ascending: true });
    setJobs(data || []);
    setLoading(false);
  }, [techId, dateISO]);

  useEffect(() => { refetch(); }, [refetch]);
  return { jobs, loading, refetch };
}

export function usePriceBook() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('price_book')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .then(({ data }) => setItems(data || []));
  }, []);
  return items;
}

export function useJobLineItems(jobId) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!supabase || !jobId) { setItems([]); return; }
    supabase
      .from('job_line_items')
      .select('*, price_book:price_book_id(name, tax_rate, is_taxable)')
      .eq('job_id', jobId)
      .then(({ data }) => setItems(data || []));
  }, [jobId]);
  return items;
}

// ─── MUTATIONS ───────────────────────────────────────────────────
export async function completeJob(jobId, { completedAt, notes } = {}) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('jobs')
    .update({
      stage: 'completed',
      status: 'completed',
      completed_at: completedAt || new Date().toISOString(),
      completion_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createInvoiceForJob(jobId, { adjustedLineItems } = {}) {
  if (!supabase) throw new Error('Supabase not configured');

  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, customer_id')
    .eq('id', jobId)
    .single();
  if (jobErr) throw jobErr;

  const lineItems = adjustedLineItems || (await supabase
    .from('job_line_items')
    .select('id, price_book_id, qty, price, description')
    .eq('job_id', jobId)).data || [];

  // Compute totals with per-item tax from price_book
  let subtotal = 0;
  let taxTotal = 0;
  const expanded = [];
  for (const li of lineItems) {
    const lineTotal = (li.qty || 0) * (li.price || 0);
    subtotal += lineTotal;
    let taxRate = 0;
    if (li.price_book_id) {
      const { data: pb } = await supabase
        .from('price_book')
        .select('tax_rate, is_taxable')
        .eq('id', li.price_book_id)
        .single();
      if (pb?.is_taxable) taxRate = Number(pb.tax_rate || 0);
    }
    taxTotal += lineTotal * (taxRate / 100);
    expanded.push({ ...li, lineTotal });
  }

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      job_id: job.id,
      customer_id: job.customer_id,
      location_id: LOCATION_ID,
      status: 'draft',
      amount: subtotal,
      tax: taxTotal,
      total: subtotal + taxTotal,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (invErr) throw invErr;

  if (expanded.length) {
    const rows = expanded.map((li, idx) => ({
      invoice_id: invoice.id,
      price_book_item_id: li.price_book_id,
      description: li.description,
      quantity: li.qty,
      unit_price: li.price,
      total: li.lineTotal,
      sort_order: idx,
    }));
    await supabase.from('invoice_line_items').insert(rows);
  }

  return invoice;
}

/** Record a manual cash/check payment in the field. */
export async function recordManualPayment({ invoiceId, amount, method, notes, techId }) {
  if (!supabase) throw new Error('Supabase not configured');
  if (!['cash', 'check'].includes(method)) {
    throw new Error('Manual payment method must be cash or check');
  }

  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      invoice_id: invoiceId,
      location_id: LOCATION_ID,
      amount,
      method,
      status: 'paid',
      processor: null,
      collected_by: techId || null,
      collected_at: new Date().toISOString(),
      notes: notes || null,
    })
    .select()
    .single();
  if (error) throw error;

  // Mark invoice paid if covered
  const { data: inv } = await supabase
    .from('invoices')
    .select('id, total')
    .eq('id', invoiceId)
    .single();
  const { data: payments } = await supabase
    .from('payments')
    .select('amount, status')
    .eq('invoice_id', invoiceId);
  const paidSum = (payments || [])
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  if (inv && paidSum >= Number(inv.total || 0)) {
    await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);
  }

  return payment;
}

// ─── OFFLINE QUEUE (IndexedDB) ───────────────────────────────────
const DB_NAME = 'dojo-mobile';
const DB_VERSION = 1;
const STORE = 'pendingPayments';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'localId', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Queue a manual payment for later sync when offline. */
export async function queueOfflinePayment(input) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.add({ ...input, queuedAt: new Date().toISOString() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Drain the offline payment queue when network returns. */
export async function syncQueuedPayments() {
  if (!supabase) return [];
  const db = await openDB();
  const queued = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  const synced = [];
  for (const q of queued) {
    try {
      await recordManualPayment(q);
      // delete from queue on success
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        const r = tx.objectStore(STORE).delete(q.localId);
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
      });
      synced.push(q.localId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[dojoData] queued payment sync failed', err?.message);
    }
  }
  return synced;
}
