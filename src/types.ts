export type Currency = {
  code: string;
  symbol: string;
  locale: string;
  label: string; // e.g., USD ($)
};

export type PaymentTerm = {
  key: string; // e.g., NET_30
  label: string; // e.g., Net 30
  days: number;
};

export type InvoiceItem = {
  id: string;
  description: string;
  qty: number;
  rate: number;
  taxable: boolean;
  taxPct?: number; // Per-item tax percentage (0-100)
  amount?: number;
};

export type FileMeta = {
  name: string;
  size: number;
  type: string;
};

export type Party = {
  companyName?: string; // used on From
  clientName?: string;  // used on To
  address?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  poNumber?: string; // used on To - PO Number / Reference
};


export interface InvoiceSummary {
  subtotal: number
  taxRatePct: number
  taxAmount: number
  discountPct: number
  discountAmount?: number // Add discount amount
  shippingCost?: number // Add shipping
  advanceAmount?: number // Add advance payment
  total: number
}

export interface InvoiceMeta {
  invoiceDate: string
  dueDate: string
  currencyCode: string
  currencySymbol: string
  paymentTerm: string
  applyDiscount?: boolean // Add discount toggle
  includeTax?: boolean // Add tax toggle
  taxName?: string // Add tax name
  perItemTaxName?: string // Add per-item tax name
  perItemTaxPct?: number // Add default per-item tax %
  addShipping?: boolean // Add shipping toggle
  advancePayment?: boolean // Add advance payment toggle
}
// ...existing code...
export type Invoice = {
  id: string;
  from: Party;
  to: Party;
  meta: InvoiceMeta;
  items: InvoiceItem[];
  summary: InvoiceSummary;
  notes: string;
  terms: string;
  attachments: FileMeta[];
  draftSavedAt?: string;
};
