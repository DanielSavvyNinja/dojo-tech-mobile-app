# FR-001 Integration Guide — Tech Mobile App

This branch ships:
- `src/lib/dojoData.js` — Supabase data layer + IndexedDB offline payment queue
- `src/components/CollectPaymentDialog.jsx` — 3-mode payment dialog (link / card / cash-or-check)

## Prerequisites

```bash
npm install @supabase/supabase-js
```

`.env.local`:

```
VITE_SUPABASE_URL=https://ybujjznnjfzjbjfegmdj.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_GHL_LOCATION_ID=3GI7SZRZHugGLBnDevX2
```

## Step 1 — Imports

```jsx
import { useAssignedJobs, useJobLineItems, completeJob, createInvoiceForJob, syncQueuedPayments } from './lib/dojoData';
import { CollectPaymentDialog } from './components/CollectPaymentDialog';
```

## Step 2 — Replace hardcoded job list

```jsx
const techId = currentTech.id; // however you identify the logged-in tech
const today = new Date().toISOString().split('T')[0];
const { jobs, refetch } = useAssignedJobs(techId, today);
```

## Step 3 — Job completion → Invoice → Payment flow

In your CompleteJobScreen (or equivalent):

```jsx
const [showPaymentDialog, setShowPaymentDialog] = useState(false);
const [activeInvoice, setActiveInvoice] = useState(null);

const handleCompleteAndInvoice = async () => {
  await completeJob(job.id, { completedAt: new Date().toISOString(), notes: completionNotes });
  const invoice = await createInvoiceForJob(job.id);
  setActiveInvoice(invoice);
  setShowPaymentDialog(true);
};

return (
  <>
    <button onClick={handleCompleteAndInvoice}>Complete &amp; Invoice</button>

    {showPaymentDialog && activeInvoice && (
      <CollectPaymentDialog
        invoice={activeInvoice}
        techId={techId}
        paymentLinkUrl={activeInvoice.payment_link_url}
        onClose={() => setShowPaymentDialog(false)}
        onPaid={(payment) => {
          // Optionally refresh local job state
          refetch();
        }}
      />
    )}
  </>
);
```

## Step 4 — Drain offline queue on reconnect

In your root App component or service worker:

```jsx
useEffect(() => {
  const handleOnline = () => syncQueuedPayments().catch(() => {});
  window.addEventListener('online', handleOnline);
  // Also drain on app load (in case we missed an event)
  if (navigator.onLine) handleOnline();
  return () => window.removeEventListener('online', handleOnline);
}, []);
```

## Step 5 — Test

```bash
npm run dev
```

Smoke test:
1. Tech sees their jobs from Supabase `jobs` table.
2. Complete &amp; Invoice creates an invoice + line items + opens the payment dialog.
3. Cash/Check mode marks invoice paid; check Supabase `payments` and `invoices.status='paid'`.
4. Toggle DevTools "Offline" then mark a payment cash — should queue. Go online — should sync.

## Related
- DanielSavvyNinja/dojo-ghl-connector#1 (migration 002 + connector code)
- DanielSavvyNinja/dojo-field-service-command-center#1 (sibling UI PR)
