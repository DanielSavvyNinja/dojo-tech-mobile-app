# FR-001 Implementation — dojo-tech-mobile-app

Status: **Draft PR — do not merge.** Schema changes already landed (see [dojo-ghl-connector PR #2](https://github.com/DanielSavvyNinja/dojo-ghl-connector/pull/2)).

## What changes in this repo (field tech PWA)

### Job completion flow → Create Invoice → Collect Payment

When the tech taps "Complete job":

1. **Generate an invoice** from the job's line items (job_line_items joined with price_book on price_book_id).
   - Calls connector RPC: createInvoice(jobId).
   - Backend posts to GHL Invoices API, writes invoices row + invoice_line_items rows.
2. **Show the Collect Payment screen** with three options:
   - Card / hosted link — opens GHL hosted payment link in browser/in-app webview.
   - Cash — manual log: writes payments row with method='cash', status='paid', processor='manual', collected_by={tech_id}, collected_at=now(). No GHL roundtrip.
   - Check — manual log: same as cash with method='check'. Tech enters check number in notes.
3. **Receipt screen** with invoice + payment summary.

### Mobile UI bits
- Add CompletionFlow screen
- Add CollectPayment modal/screen
- The tech is the logged-in user, so jobs.tech_id is implicit — no TechnicianPicker needed here

## Schema reality (use these column names)
- jobs.customer_id (not contact_id), jobs.tech_id (not technician_id)
- payments.collected_at and collected_by are canonical. payments.paid_at is generated, read-only.
- payments.method must be one of: cash, check, card, ach, ghl_link, terminal, other
- payments.status must be one of: pending, paid, failed, refunded, voided

## Tax (decision #5)
Compute tax client-side per line: line_total * (price_book.tax_rate || location_settings.tax_rate) when is_taxable=true. Display total inclusive of tax on the receipt.

## Open decisions
See [dojo-ghl-connector PR #2](https://github.com/DanielSavvyNinja/dojo-ghl-connector/pull/2) for the canonical FR-001 reference and remaining decisions.
