import React, { useMemo } from 'react'
import type { Invoice, Currency } from './types'
import './InvoicePreview.css'

interface InvoicePreviewProps {
  invoice: Invoice
  currency: Currency
  status: 'Draft' | 'Unpaid' | 'Paid' | 'Overdue'
  logoUrl: string | null
  title?: string            // ← new (optional) edited invoice title
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

const cfmt = (value: number, currency: Currency) => {
  const formatted = new Intl.NumberFormat(currency.locale, {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
  return `${currency.symbol}${formatted}`.replace(/\u00A0/g, '')
}

const fmtDate = (iso: string) => {
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
}

const sanitizeText = (text: string | undefined): string => {
  if (!text) return ''
  return text.replace(/[^\x20-\x7E\n]/g, '')
}

const wrapText = (text: string, maxLines: number = 50): string[] => {
  if (!text) return []
  const lines = text.split('\n')
  const result: string[] = []

  lines.forEach(line => {
    if (result.length >= maxLines) return
    if (!line.trim()) {
      result.push('')
    } else {
      result.push(line)
    }
  })

  return result
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  invoice: inv,
  currency,
  status,
  logoUrl,
  title,                          // ← pick up the edited title
}) => {
  const cfmtWithCurrency = useMemo(
    () => (value: number) => cfmt(value, currency),
    [currency]
  );
  return (
    <div className="invoice-preview-container">
      <div className="invoice-preview-page">
        {/* Header Section */}
        <div className="preview-header">
          <div className="preview-header-left">
            <div className="preview-logo-section">
              {logoUrl ? (
                <img src={logoUrl} alt="Company logo" className="preview-logo" />
              ) : (
                <div className="preview-logo-placeholder">Logo</div>
              )}
            </div>
            <div className="preview-header-title-section">
              <div className="preview-header-title">{title || 'INVOICE'}</div>
            </div>
          </div>
          <div className="preview-header-right">
            <div className="preview-invoice-number-right">Invoice ID: {sanitizeText(inv.id)}</div>
            <div className="preview-status-badge-right" data-status={status.toLowerCase()}>
              {status.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Dates Section */}
        <div className="preview-dates-section">
          <div className="preview-date-item">
            <div className="preview-date-label">Issue Date</div>
            <div className="preview-date-value">{fmtDate(inv.meta.invoiceDate)}</div>
          </div>

          {(status === 'Unpaid' || status === 'Overdue') && (
            <div className="preview-date-item preview-date-item-right">
              <div className="preview-date-label">Due Date</div>
              <div className="preview-date-value">{fmtDate(inv.meta.dueDate)}</div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="preview-divider"></div>

        {/* Bill From / Bill To Section */}
        {/* ===== BILL FROM / BILL TO SECTION ===== */}
        <div className="preview-addresses">
          {/* Bill From */}
          <div className="preview-address-block">
            <div className="preview-address-label">Bill From:</div>
            <div className="preview-address-content">
              {inv.from.companyName && (
                <div className="preview-address-company">
                  {sanitizeText(inv.from.companyName)}
                </div>
              )}
              {inv.from.address && (
                <div className="preview-address-line">
                  {sanitizeText(inv.from.address)}
                </div>
              )}
              {inv.from.email && (
                <div className="preview-address-line">
                  {sanitizeText(inv.from.email)}
                </div>
              )}
              {inv.from.phone && (
                <div className="preview-address-line">
                  Phone: {sanitizeText(inv.from.phone)}
                </div>
              )}
              {inv.from.taxId && (
                <div className="preview-address-line">
                  Tax ID: {sanitizeText(inv.from.taxId)}
                </div>
              )}
            </div>
          </div>

          {/* Bill To */}
          <div className="preview-address-block preview-address-block-right">
            <div className="preview-address-label">Bill To:</div>
            <div className="preview-address-content">
              {inv.to.clientName && (
                <div className="preview-address-company">
                  {sanitizeText(inv.to.clientName)}
                </div>
              )}
              {inv.to.address && (
                <div className="preview-address-line">
                  {sanitizeText(inv.to.address)}
                </div>
              )}
              {inv.to.email && (
                <div className="preview-address-line">
                  {sanitizeText(inv.to.email)}
                </div>
              )}
              {inv.to.taxId && (
                <div className="preview-address-line">
                  Tax ID: {sanitizeText(inv.to.taxId)}
                </div>
              )}
              {inv.to.poNumber && (
                <div className="preview-address-line">
                  PO: {sanitizeText(inv.to.poNumber)}
                </div>
              )}
            </div>
          </div>
        </div>


        {/* Items Table */}
        <div className="preview-items-section">
          <div className="preview-items-title">Invoice Items</div>
          <table className="preview-items-table">
            <thead>
              <tr>
                <th className="col-sl">S.No</th>
                <th className="col-desc">Description</th>
                <th className="col-qty">Quantity</th>
                <th className="col-price">Rate</th>
                <th className="col-tax">Tax</th>
                <th className="col-amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item, idx) => {
                const itemBase = round2((item.qty ?? 0) * (item.rate ?? 0))
                const itemTax = item.taxable && (item.taxPct ?? 0) > 0
                  ? round2((itemBase * (item.taxPct ?? 0)) / 100)
                  : 0
                const rowAmount = round2(itemBase + itemTax)

                return (
                  <tr key={item.id} className={idx % 2 === 0 ? 'preview-row-even' : ''}>
                    <td className="col-sl">{idx + 1}</td>
                    <td className="col-desc">{sanitizeText(item.description)}</td>
                    <td className="col-qty">{item.qty ?? 0}</td>
                    <td className="col-price">{cfmtWithCurrency(item.rate ?? 0)}</td>
                    <td className="col-tax">
                      {item.taxable ? (
                        <span className="preview-tax-value">{(item.taxPct ?? 0).toFixed(2)}%</span>
                      ) : (
                        <span className="preview-tax-none">—</span>
                      )}
                    </td>
                    <td className="col-amount">{cfmtWithCurrency(rowAmount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Summary Card & Notes Section */}
        <div className="preview-bottom-section">
          {/* Notes & Terms (Left) */}
          <div className="preview-notes-section">
            {inv.notes && (
              <div className="preview-notes-block">
                <div className="preview-notes-title">Notes:</div>
                <div className="preview-notes-content">
                  {wrapText(sanitizeText(inv.notes)).map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              </div>
            )}
            {inv.terms && (
              <div className="preview-terms-block">
                <div className="preview-terms-title">Terms & Conditions:</div>
                <div className="preview-terms-content">
                  {wrapText(sanitizeText(inv.terms)).map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary Card (Right) */}

          <div className="preview-summary-card">
            <div className="preview-summary-title">Summary:</div>
            <div className="preview-summary-rows">
              <div className="preview-summary-row">
                <span className="preview-summary-label">Subtotal:</span>
                <span className="preview-summary-value">{cfmtWithCurrency(inv.summary.subtotal)}</span>
              </div>

              <div className="preview-summary-row">
                <span className="preview-summary-label">Tax Amount:</span>
                <span className="preview-summary-value">{cfmtWithCurrency(inv.summary.taxAmount)}</span>
              </div>

              <div className="preview-summary-row">
                <span className="preview-summary-label">Discount:</span>
                <span className="preview-summary-value">{inv.summary.discountPct.toFixed(2)}%</span>
              </div>
            </div>

            <div className="preview-summary-divider"></div>

            <div className="preview-summary-total">
              <span className="preview-total-label">Amount Due:</span>
              <span className="preview-total-value">
                {cfmtWithCurrency(inv.summary.total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InvoicePreview
