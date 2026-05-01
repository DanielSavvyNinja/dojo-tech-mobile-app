/**
 * CollectPaymentDialog — field tech payment collection modal (FR-001 #4).
 *
 * Three modes:
 *   1. Send link    — copy/text/email the GHL hosted payment URL
 *   2. Card on file — charge a saved card via GHL (online only)
 *   3. Cash / Check — log a manual payment with no processor
 *
 * Offline behavior: cash/check mode queues to IndexedDB if offline,
 * syncs when network returns. Send-link and card-on-file require online.
 *
 * Usage:
 *   <CollectPaymentDialog
 *     invoice={invoice}
 *     techId={currentTech.id}
 *     paymentLinkUrl={invoice.payment_link_url}
 *     onClose={() => setOpen(false)}
 *     onPaid={(payment) => { ... }}
 *   />
 */

import React, { useState } from 'react';
import {
  CreditCard,
  DollarSign,
  Send,
  WifiOff,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  recordManualPayment,
  queueOfflinePayment,
  syncQueuedPayments,
} from '../lib/dojoData';

const MODES = [
  { id: 'link', label: 'Send link', Icon: Send, requiresOnline: true },
  { id: 'card', label: 'Card on file', Icon: CreditCard, requiresOnline: true },
  { id: 'cash', label: 'Cash / Check', Icon: DollarSign, requiresOnline: false },
];

export function CollectPaymentDialog({
  invoice,
  techId,
  paymentLinkUrl,
  onClose,
  onPaid,
}) {
  const [mode, setMode] = useState(null);
  const [amount, setAmount] = useState(invoice?.total ?? '');
  const [method, setMethod] = useState('cash'); // cash | check
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const handleManualSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const numericAmount = Number(amount);
      if (!numericAmount || numericAmount <= 0) {
        throw new Error('Enter a valid amount');
      }

      if (online) {
        const payment = await recordManualPayment({
          invoiceId: invoice.id,
          amount: numericAmount,
          method,
          notes,
          techId,
        });
        setSuccess({ payment, queued: false });
        onPaid?.(payment);
      } else {
        await queueOfflinePayment({
          invoiceId: invoice.id,
          amount: numericAmount,
          method,
          notes,
          techId,
        });
        setSuccess({ queued: true });
      }
    } catch (err) {
      setError(err?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendLink = async (channel) => {
    if (!paymentLinkUrl) {
      setError('No payment link available — create the invoice first');
      return;
    }
    if (channel === 'copy') {
      try {
        await navigator.clipboard.writeText(paymentLinkUrl);
        setSuccess({ message: 'Payment link copied to clipboard' });
      } catch (err) {
        setError('Could not copy to clipboard');
      }
    } else if (channel === 'sms') {
      // tel:/sms: deep link works on mobile to compose a text
      const body = encodeURIComponent(`Pay your invoice: ${paymentLinkUrl}`);
      window.location.href = `sms:?body=${body}`;
    } else if (channel === 'email') {
      const body = encodeURIComponent(`You can pay your invoice here: ${paymentLinkUrl}`);
      window.location.href = `mailto:?subject=Invoice%20payment&body=${body}`;
    }
  };

  // Periodically retry queued sync when this dialog mounts (online recovery)
  React.useEffect(() => {
    if (online) syncQueuedPayments().catch(() => {});
  }, [online]);

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
        <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 text-center">
          <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
          <h3 className="font-bold text-lg mb-1">
            {success.queued ? 'Saved offline' : success.message || 'Payment recorded'}
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            {success.queued
              ? "We'll sync this to the server when you're back online."
              : success.payment
                ? `$${Number(success.payment.amount).toFixed(2)} via ${success.payment.method}`
                : ''}
          </p>
          <button
            type="button"
            className="w-full bg-dojo-600 text-white rounded-lg py-3 font-semibold"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-lg">Collect Payment</h3>
          <button type="button" className="p-2 -m-2 text-gray-400" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-3 bg-gray-50 border-b text-sm text-gray-600">
          Invoice <strong>#{invoice?.invoice_number || invoice?.id?.slice(0, 8)}</strong>{' '}
          · <strong>${Number(invoice?.total || 0).toFixed(2)}</strong>
        </div>

        {!online && (
          <div className="px-4 py-2 bg-amber-50 text-amber-800 text-xs flex items-center gap-2">
            <WifiOff size={14} /> You're offline — only cash/check can be saved now.
          </div>
        )}

        {!mode && (
          <div className="p-4 grid grid-cols-3 gap-2">
            {MODES.map(m => (
              <button
                key={m.id}
                type="button"
                disabled={m.requiresOnline && !online}
                onClick={() => setMode(m.id)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-dojo-500 hover:bg-dojo-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <m.Icon size={22} className="text-dojo-600" />
                <span className="text-xs font-semibold text-center">{m.label}</span>
              </button>
            ))}
          </div>
        )}

        {mode === 'link' && (
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-600">Send the customer a link to pay:</p>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" className="btn-secondary" onClick={() => handleSendLink('copy')}>Copy</button>
              <button type="button" className="btn-secondary" onClick={() => handleSendLink('sms')}>Text</button>
              <button type="button" className="btn-secondary" onClick={() => handleSendLink('email')}>Email</button>
            </div>
            <button type="button" className="text-xs text-gray-500 underline" onClick={() => setMode(null)}>Back</button>
          </div>
        )}

        {mode === 'card' && (
          <div className="p-4 space-y-3 text-sm">
            <p>
              Charging the card on file will trigger the GHL Payments API.
              Please confirm with the customer first.
            </p>
            <button
              type="button"
              className="w-full bg-dojo-600 text-white rounded-lg py-3 font-semibold disabled:opacity-50"
              disabled
              title="Wire to your GHL Payments client method"
            >
              Charge ${Number(invoice?.total || 0).toFixed(2)}
            </button>
            <p className="text-xs text-gray-400">
              (Wire this button to your GHL Payments client method when you have the endpoint configured.)
            </p>
            <button type="button" className="text-xs text-gray-500 underline" onClick={() => setMode(null)}>Back</button>
          </div>
        )}

        {mode === 'cash' && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod('cash')}
                className={`p-3 rounded-lg border text-sm font-semibold ${method === 'cash' ? 'border-dojo-500 bg-dojo-50 text-dojo-700' : 'border-gray-200 text-gray-600'}`}
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => setMethod('check')}
                className={`p-3 rounded-lg border text-sm font-semibold ${method === 'check' ? 'border-dojo-500 bg-dojo-50 text-dojo-700' : 'border-gray-200 text-gray-600'}`}
              >
                Check
              </button>
            </div>

            <label className="block text-sm">
              <span className="block font-medium mb-1">Amount</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base"
              />
            </label>

            <label className="block text-sm">
              <span className="block font-medium mb-1">Notes (optional)</span>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder={method === 'check' ? 'Check #, bank' : 'Anything to note'}
              />
            </label>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={submitting}
              className="w-full bg-green-600 text-white rounded-lg py-3 font-semibold disabled:opacity-50"
            >
              {submitting ? 'Saving...' : online ? `Mark Paid (${method})` : `Queue offline (${method})`}
            </button>

            <button type="button" className="text-xs text-gray-500 underline" onClick={() => setMode(null)}>Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CollectPaymentDialog;
