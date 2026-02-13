import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
// Syncfusion CSS theme imports (material theme)
import '@syncfusion/ej2-base/styles/material.css'
import '@syncfusion/ej2-buttons/styles/material.css'
import '@syncfusion/ej2-inputs/styles/material.css'
import '@syncfusion/ej2-calendars/styles/material.css'
import '@syncfusion/ej2-dropdowns/styles/material.css'
import '@syncfusion/ej2-popups/styles/material.css'
import '@syncfusion/ej2-notifications/styles/material.css'
import '@syncfusion/ej2-grids/styles/material.css'
import '@syncfusion/ej2-icons/styles/material.css'
// Custom styles LAST so they override theme
import './index.css'
import './App.css'

// Note: license/culture APIs available if needed
import { ButtonComponent } from '@syncfusion/ej2-react-buttons'
import { TextBoxComponent, NumericTextBoxComponent, UploaderComponent } from '@syncfusion/ej2-react-inputs'
import { DatePickerComponent } from '@syncfusion/ej2-react-calendars'
import { DropDownListComponent } from '@syncfusion/ej2-react-dropdowns'
import { ToastComponent } from '@syncfusion/ej2-react-notifications'
import { GridComponent, ColumnsDirective, ColumnDirective, Edit, Inject, ExcelExport, Toolbar } from '@syncfusion/ej2-react-grids'
import { PdfBitmap, PdfColor, PdfDocument, PdfFontFamily, PdfFontStyle, PdfGrid, PdfGridCell, PdfMargins, PdfPageOrientation, PdfPageSize, PdfPen, PdfSolidBrush, PdfStandardFont, PdfStringFormat } from '@syncfusion/ej2-pdf-export'
import type { ChangeEventArgs as DropDownChangeArgs } from '@syncfusion/ej2-react-dropdowns'
import type { ChangedEventArgs as DateChangedArgs } from '@syncfusion/ej2-react-calendars'
import type { Invoice, InvoiceItem, Currency, PaymentTerm } from './types'
import InvoicePreview from './InvoicePreview'


const currencies: Currency[] = [
  { code: 'USD', symbol: '$', locale: 'en-US', label: 'USD ($)' },
]

const terms: PaymentTerm[] = [
  { key: 'NET_7', label: 'Net 7', days: 7 },
  { key: 'NET_15', label: 'Net 15', days: 15 },
  { key: 'NET_30', label: 'Net 30', days: 30 },
  { key: 'NET_45', label: 'Net 45', days: 45 },
  { key: 'NET_60', label: 'Net 60', days: 60 },
]

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

const fmtMoney = (value: number, currency: Currency) => {
  const formatted = new Intl.NumberFormat(currency.locale, {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
  return `${currency.symbol}${formatted}`
}
const emptyInvoice = (): Invoice => ({
  id: 'INV-001',
  from: { companyName: '', address: '', email: '', phone: '', taxId: '' },
  to: { clientName: '', address: '', email: '', taxId: '', poNumber: '' } as any,
  meta: {
    invoiceDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    currencyCode: 'USD',  // Always USD
    currencySymbol: '$',   // Always $
    paymentTerm: terms[2].key,
  },
  items: [
    { id: crypto.randomUUID(), description: 'Item 1', qty: 1, rate: 0, taxable: false, taxPct: 0 }
  ],
  summary: { subtotal: 0, taxRatePct: 0, taxAmount: 0, discountPct: 0, total: 0 },
  notes: 'Thank you for your business!',
  terms: 'Late payments may incur interest at the maximum legal rate.',
  attachments: [],
})


function App() {
  const [inv, setInv] = useState<Invoice>(() => {
    const draft = localStorage.getItem('invoice.draft.current')
    return draft ? (JSON.parse(draft) as Invoice) : emptyInvoice()
  })
  // per-field errors
  const [errors, setErrors] = useState<Record<string, string>>({})
  const toastRef = useRef<ToastComponent>(null)
  const currency = useMemo(() => currencies.find(c => c.code === inv.meta.currencyCode) || currencies[0], [inv.meta.currencyCode])
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const logoNativeInputRef = useRef<HTMLInputElement>(null)
  const [headerTitle, setHeaderTitle] = useState<string>('INVOICE');
  const [status, setStatus] = useState<'Draft' | 'Unpaid' | 'Paid' | 'Overdue'>('Draft')

  // Segmented control measurement & indicator
  const statuses = ['Draft', 'Unpaid', 'Paid', 'Overdue'] as const;
  const activeIdx = statuses.indexOf(status);

  const segWrapRef = useRef<HTMLDivElement>(null);
  const segBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [segIndicator, setSegIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  // Wipes any prior severity classes from the toast element and shows a fresh toast
  const showToast = useCallback(
    (opts: { title?: string; content?: string; cssClass?: string; timeOut?: number }) => {
      const el = toastRef.current?.element as HTMLElement | undefined;

      // Remove residual severity classes that Syncfusion might keep on the element
      if (el) {
        [
          'e-toast-success', 'e-success',
          'e-toast-danger', 'e-danger',
          'e-toast-warning', 'e-warning',
          'e-toast-info', 'e-info'
        ].forEach(c => el.classList.remove(c));
      }

      // Drop any in-flight toasts (queued/active)
      toastRef.current?.hide('All');

      // Guard against blank toasts
      const title = (opts.title ?? '').trim();
      const content = (opts.content ?? '').trim();
      if (!title && !content) return;

      // Always pass a severity skin explicitly for consistency
      toastRef.current?.show(opts as any);
    },
    []
  );
  const updateSegIndicator = useCallback(() => {
    const wrap = segWrapRef.current;
    const btn = segBtnRefs.current[status];
    if (!wrap || !btn) return;
    const wrapRect = wrap.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setSegIndicator({
      left: Math.round(btnRect.left - wrapRect.left),
      width: Math.round(btnRect.width),
    });
  }, [status]);

  useLayoutEffect(() => {
    updateSegIndicator();
    const onResize = () => updateSegIndicator();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateSegIndicator]);
  // Preview Modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  // Attachments uploader
  const uploaderRef = useRef<UploaderComponent>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Open logo picker via native input for better reliability
  const openLogoPicker = useCallback(() => {
    const native = logoNativeInputRef.current
    if (native) {
      native.click()
    }
  }, [])

  // Handle logo file selection with proper validation
  const onNativeLogoChange = useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    if (!file) return

    // Validate file type
    const typeOk = /image\/(png|jpeg|jpg|svg\+xml|webp)/i.test(file.type || '') || /\.(png|jpe?g|svg|webp)$/i.test(file.name)
    // Validate file size (max 2MB)
    const sizeOk = file.size <= 2 * 1024 * 1024

    if (!typeOk) {
      toastRef.current?.show({
        title: 'Invalid image format',
        content: 'Please upload PNG, JPG, SVG, or WEBP images only',
        cssClass: 'e-danger',
        timeOut: 3000
      })
      ev.target.value = ''
      return
    }

    if (!sizeOk) {
      toastRef.current?.show({
        title: 'File too large',
        content: 'Maximum file size is 2 MB',
        cssClass: 'e-danger',
        timeOut: 3000
      })
      ev.target.value = ''
      return
    }

    // Read and set the logo
    const reader = new FileReader()
    reader.onload = () => {
      setLogoUrl(String(reader.result || ''))
      toastRef.current?.show({
        title: 'Logo uploaded',
        content: 'Company logo has been updated successfully',
        cssClass: 'e-toast-success',
        timeOut: 2000
      })
    }
    reader.onerror = () => {
      toastRef.current?.show({
        title: 'Upload failed',
        content: 'Could not read the image file. Please try again.',
        cssClass: 'e-danger',
        timeOut: 3000
      })
      ev.target.value = ''
    }
    reader.readAsDataURL(file)
  }, [])

  // Clear logo handler
  const clearLogo = useCallback((ev: React.MouseEvent) => {
    ev.stopPropagation()
    setLogoUrl(null)
    const native = logoNativeInputRef.current
    if (native) native.value = ''
    toastRef.current?.show({
      title: 'Logo removed',
      content: 'Company logo has been cleared',
      cssClass: 'e-info',
      timeOut: 2000
    })
  }, [])

  const recompute = useCallback((current: Invoice): Invoice => {
    // Step 1: Calculate each item's amount and sum to get subtotal
    let subtotal = 0;
    current.items.forEach((item) => {
      const itemBase = round2((item.qty ?? 0) * (item.rate ?? 0));
      // Add per-item tax if the item is taxable
      const itemTax = (item.taxable && (item.taxPct ?? 0) > 0)
        ? round2((itemBase * (item.taxPct ?? 0)) / 100)
        : 0;
      const itemAmount = round2(itemBase + itemTax);
      subtotal = round2(subtotal + itemAmount);
    });

    // Step 2: Calculate global tax on the ORIGINAL subtotal (before discount)
    const taxAmount = round2((current.summary.taxRatePct / 100) * subtotal);

    // Step 3: Apply global discount to subtotal
    const discountAmount = round2((current.summary.discountPct / 100) * subtotal);
    const subtotalAfterDiscount = round2(subtotal - discountAmount);

    // Step 4: Calculate final total
    const total = round2(subtotalAfterDiscount + taxAmount);

    return {
      ...current,
      summary: {
        ...current.summary,
        subtotal,
        taxAmount,
        total
      }
    };
  }, [])

  useEffect(() => {
    setInv(prev => recompute(prev))
  }, [])

  // Bind uploader drop area once mounted
  useEffect(() => {
    if (uploaderRef.current && dropZoneRef.current) {
      uploaderRef.current.dropArea = dropZoneRef.current
        ; (uploaderRef.current as any).element?.setAttribute?.('name', 'UploadFiles')
      uploaderRef.current.dataBind()
    }
  }, [])

  // validation helpers
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
  const phoneDigits = (s: string) => (s.match(/\d/g) || []).length
  const isEmpty = (s?: string) => !s || !String(s).trim()
  // Allow only digits and standard phone punctuation: + ( ) - . and spaces
  // Length check below still requires at least 10 digits.
  const phoneAllowedRx = /^[\d\s()+\-\.]{7,20}$/;

  const setFieldError = (key: string, msg: string) => setErrors(prev => ({ ...prev, [key]: msg }))
  const clearFieldError = (key: string) => setErrors(prev => { const n = { ...prev }; delete n[key]; return n })

  const validateField = useCallback((key: string, value: any) => {
    let msg = ''
    switch (key) {
      case 'id':
        msg = isEmpty(value) || !/^[A-Z0-9-]{1,20}$/i.test(String(value)) ? 'Use letters, numbers, or hyphens (max 20)' : ''
        break
      case 'from.companyName':
      case 'to.clientName':
        msg = isEmpty(value) || String(value).trim().length < 2 ? 'Required (min 2 characters)' : ''
        break
      case 'from.address':
      case 'to.address':
        msg = isEmpty(value) || String(value).trim().length < 5 ? 'Required (min 5 characters)' : ''
        break
      case 'from.email':
      case 'to.email':
        msg = isEmpty(value) || !emailRx.test(String(value)) ? 'Enter a valid email' : ''
        break
      case 'from.phone': {
        const raw = String(value ?? '').trim();
        const digits = phoneDigits(raw);

        if (isEmpty(raw)) {
          msg = 'Enter a valid phone number';
        } else if (!phoneAllowedRx.test(raw)) {
          msg = 'Use digits only with + ( ) - . and spaces';
        } else if (digits < 10) {
          msg = 'Enter a valid phone number (min 10 digits)';
        } else {
          msg = '';
        }
        break;
      }
      case 'from.taxId':
      case 'to.taxId':
        msg = value && !/^[A-Za-z0-9\-\s\/]{3,24}$/.test(String(value)) ? '3–24 chars, letters/numbers allowed' : ''
        break
      case 'to.poNumber':
        msg = value && String(value).length > 32 ? 'Max 32 characters' : ''
        break
      default:
        msg = ''
    }
    if (msg) setFieldError(key, msg); else clearFieldError(key)
    return msg
  }, [])

  const addItem = useCallback(() => {
    // Save any pending grid edits before adding new item
    const grid = (window as any).__invoiceGrid;
    if (grid && grid.isEdit) {
      grid.endEdit();
    }

    // Small delay to ensure grid state is saved
    setTimeout(() => {
      const newItem: InvoiceItem = {
        id: crypto.randomUUID(),
        description: 'New Item',
        qty: 1,
        rate: 0,
        taxable: false,
        taxPct: 0
      };

      setInv(prev => {
        const updatedInvoice = {
          ...prev,
          items: [...prev.items, newItem]
        };
        return recompute(updatedInvoice);
      });
    }, 50);
  }, [recompute]);


  const removeItem = useCallback((id: string) => {
    // Save any pending edits before removing
    const grid = (window as any).__invoiceGrid;
    if (grid && grid.isEdit) {
      grid.endEdit();
    }

    setTimeout(() => {
      setInv(prev => {
        const updatedInvoice = {
          ...prev,
          items: prev.items.filter(i => i.id !== id)
        };
        return recompute(updatedInvoice);
      });
    }, 50);
  }, [recompute]);

  const onPaymentTermChange = useCallback((args: DropDownChangeArgs) => {
    const key = args.value as string
    const term = terms.find(t => t.key === key) || terms[2]
    setInv(prev => {
      const invDate = new Date(prev.meta.invoiceDate)
      const due = new Date(invDate.getTime() + term.days * 86400000)
      return { ...prev, meta: { ...prev.meta, paymentTerm: term.key, dueDate: due.toISOString() } }
    })
  }, [])

  const onInvoiceDateChange = useCallback((args: DateChangedArgs) => {
    if (!args.value) return
    setInv(prev => {
      const term = terms.find(t => t.key === prev.meta.paymentTerm) || terms[2]
      const due = new Date(args.value!.getTime() + term.days * 86400000)
      return { ...prev, meta: { ...prev.meta, invoiceDate: args.value!.toISOString(), dueDate: due.toISOString() } }
    })
  }, [])

  // Simple validation for required pieces (blocking preview/PDF/send)
  const validate = (): string[] => {
    const errs: string[] = []
    // field-level
    errs.push(
      validateField('id', inv.id),
      validateField('from.companyName', inv.from.companyName),
      validateField('from.address', inv.from.address),
      validateField('from.email', inv.from.email),
      validateField('from.phone', inv.from.phone),
      validateField('from.taxId', inv.from.taxId),
      validateField('to.clientName', inv.to?.clientName),
      validateField('to.address', inv.to?.address),
      validateField('to.email', inv.to?.email),
      validateField('to.taxId', inv.to?.taxId),
      validateField('to.poNumber', inv.to?.poNumber),
    )
    // items
    if (!inv.items.length) errs.push('At least one item required')
    if (inv.items.some(i => isEmpty(i.description))) errs.push('Each item needs a description')
    if (inv.items.some(i => (i.qty ?? 0) <= 0)) errs.push('Item quantity must be greater than 0')

    if (inv.summary.taxRatePct < 0 || inv.summary.taxRatePct > 100) errs.push('Tax Rate must be 0–100')
    if (inv.summary.discountPct < 0 || inv.summary.discountPct > 100) errs.push('Discount must be 0–100')
    return errs.filter(Boolean)
  }

  const onPreview = useCallback(() => {
    const errs = validate()
    if (errs.length) {
      showToast({
        title: 'Fix validation errors',
        content: errs.join('\n'),
        cssClass: 'e-toast-danger',      // use Syncfusion’s built-in danger skin
        timeOut: 1500
      });
      return;
    }
    setShowPreviewModal(true)
  }, [validate])

  const cfmt = (n: number) => fmtMoney(n, currency)

  // Safe text helper to remove unsupported characters for PDF fonts
  const sanitizeText = (text: string): string => {
    if (!text) return ''
    return String(text)
      .replace(/[""]/g, '"') // Smart quotes
      .replace(/['']/g, "'") // Smart apostrophes
      .replace(/[—–]/g, '-') // Em/en dashes
      .replace(/…/g, '...') // Ellipsis
      .replace(/—/g, '-')    // Em dash to hyphen
      .replace(/[^\x00-\x7F]/g, '') // Remove any remaining non-ASCII characters
  }

  // PDF-safe currency formatting - uses currency code instead of symbols for compatibility
  const cfmtPdf = (n: number, curr: Currency): string => {
    const formatted = new Intl.NumberFormat(curr.locale, {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n)
    return `${curr.symbol}${formatted}`
  }

  // Generate PDF using Syncfusion ej2-pdf-export to precisely mirror on-screen layout
  const onGeneratePdf = async () => {

    // Clear any active/queued toasts *before* we start
    toastRef.current?.hide('All');

    // Word wrap text to fit within a maximum width
    // Returns an array of lines that fit within the specified width when measured with the given font
    const wrapText = (text: string, font: any, maxWidth: number): string[] => {
      if (!text) return []

      // First, split by explicit newlines to preserve intentional line breaks
      const paragraphs = text.split('\n')
      const wrappedLines: string[] = []

      paragraphs.forEach(paragraph => {
        if (!paragraph.trim()) {
          wrappedLines.push('')
          return
        }

        const words = paragraph.split(' ')
        let currentLine = ''

        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word
          const measuredWidth = font.measureString(testLine).width

          if (measuredWidth <= maxWidth) {
            currentLine = testLine
          } else {
            if (currentLine) {
              wrappedLines.push(currentLine)
            }
            currentLine = word
          }
        })

        if (currentLine) {
          wrappedLines.push(currentLine)
        }
      })

      return wrappedLines
    }

    const errs = validate()
    if (errs.length) {
      toastRef.current?.show({ title: 'Fix validation errors', content: errs.join('\n'), cssClass: 'e-danger', timeOut: 1000 })
      return
    }

    const doc = new PdfDocument()
    // Set professional margins for better spacing
    const margins = new PdfMargins()
    margins.left = 30; margins.top = 30; margins.right = 30; margins.bottom = 30
    doc.pageSettings.margins = margins
    doc.pageSettings.orientation = PdfPageOrientation.Portrait
    doc.pageSettings.size = PdfPageSize.letter

    let page = doc.pages.add()
    let g = page.graphics

    // Compute the usable (client) height for the current page considering margins & orientation
    const getClientHeight = (): number => {
      // Letter: 612 x 792 (portrait). Swap if landscape.
      const isLandscape = doc.pageSettings.orientation === PdfPageOrientation.Landscape
      const rawHeight = isLandscape ? 612 : 792
      // y=0 starts at the top margin for Syncfusion drawing; subtract both margins to get client area.
      return rawHeight - (margins.top + margins.bottom)
    }

    // Check if a block of height `requiredHeight` fits from `currentY` to the bottom of the client area.
    // If not, add a new page and return the fresh Y origin for that page.
    const checkPageBreak = (currentY: number, requiredHeight: number, footerReserve: number = 0): number => {
      const limit = getClientHeight() - footerReserve
      if (currentY + requiredHeight > limit) {
        page = doc.pages.add()
        g = page.graphics
        return 0 // start at top of client area for new page since our coordinates begin at margin
      }
      return currentY
    }

    // Professional color palette
    const purpleHeader = new PdfSolidBrush(new PdfColor(109, 40, 217)) // #6d28d9
    const purpleText = new PdfSolidBrush(new PdfColor(124, 58, 237)) // #7c3aed
    const textBrush = new PdfSolidBrush(new PdfColor(31, 41, 55)) // #1f2937 - darker for better readability
    const white = new PdfSolidBrush(new PdfColor(255, 255, 255))
    const borderColor = new PdfColor(229, 231, 235) // #e5e7eb
    // Font sizes maintain proportion between UI and PDF (UI base 16px → PDF base 10pt for body)
    const titleFont = new PdfStandardFont(PdfFontFamily.Helvetica, 32, PdfFontStyle.Bold)
    // const h2Bold = new PdfStandardFont(PdfFontFamily.Helvetica, 14, PdfFontStyle.Bold)
    const h3Bold = new PdfStandardFont(PdfFontFamily.Helvetica, 12, PdfFontStyle.Bold)
    const bodyFont = new PdfStandardFont(PdfFontFamily.Helvetica, 10, PdfFontStyle.Regular)
    const bodyBold = new PdfStandardFont(PdfFontFamily.Helvetica, 10, PdfFontStyle.Bold)
    const smallBold = new PdfStandardFont(PdfFontFamily.Helvetica, 9, PdfFontStyle.Bold)
    const noPen = new PdfPen(new PdfColor(0, 0, 0), 0.000)

    // Calculate page dimensions (Letter size: 612x792 points)
    const pageSize = { width: 612, height: 792 }
    const contentWidth = pageSize.width - (margins.left + margins.right)
    // const contentHeight = pageSize.height - (margins.top + margins.bottom)

    // Start position (at 0,0 since margins are automatically applied by Syncfusion)
    let x = 0
    let y = 0
    let pageWidth = contentWidth

    // ===== HEADER SECTION (Purple background with rounded corners effect) =====
    const headerHeight = 90
    g.drawRectangle(null as any, purpleHeader, x, y, pageWidth, headerHeight)

    // Logo placeholder (white rounded square)
    const logoSize = 44
    const logoX = x + 20
    const logoY = y + 17

    if (logoUrl) {
      try {
        // Convert image to JPEG format if it's not already
        const convertToJpeg = async (dataUrl: string): Promise<string> => {
          return new Promise((resolve, reject) => {
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              canvas.width = img.width
              canvas.height = img.height
              const ctx = canvas.getContext('2d')
              if (!ctx) {
                reject(new Error('Failed to get canvas context'))
                return
              }
              // Fill with white background for transparency
              ctx.fillStyle = '#FFFFFF'
              ctx.fillRect(0, 0, canvas.width, canvas.height)
              ctx.drawImage(img, 0, 0)
              resolve(canvas.toDataURL('image/jpeg', 0.95))
            }
            img.onerror = () => reject(new Error('Failed to load image'))
            img.src = dataUrl
          })
        }

        // Convert logo to JPEG base64 (Syncfusion PDF only supports JPEG)
        const jpegDataUrl = await convertToJpeg(logoUrl)
        const base64 = jpegDataUrl.split(',')[1]
        const bmp = new PdfBitmap(base64)

        // Calculate aspect ratio and maintain it within fixed dimensions
        const imgWidth = bmp.width
        const imgHeight = bmp.height
        const aspectRatio = imgWidth / imgHeight

        // Fixed professional logo size (in points)
        const maxLogoWidth = 60
        const maxLogoHeight = 60

        let renderWidth = maxLogoWidth
        let renderHeight = maxLogoHeight

        // Maintain aspect ratio while fitting within max dimensions
        if (aspectRatio > 1) {
          // Landscape image
          renderHeight = maxLogoWidth / aspectRatio
        } else {
          // Portrait or square image
          renderWidth = maxLogoHeight * aspectRatio
        }

        // Center the logo within the allocated space
        const centerX = logoX + (logoSize - renderWidth) / 2
        const centerY = logoY + (logoSize - renderHeight) / 2

        g.drawImage(bmp, centerX, centerY, renderWidth, renderHeight)
      } catch (error) {
        console.error('Failed to draw logo:', error)
        // Draw placeholder if logo fails
        g.drawRectangle(new PdfPen(new PdfColor(255, 255, 255), 1.5), white, logoX, logoY, logoSize, logoSize)
        g.drawString('Logo', bodyBold, null as any, textBrush, logoX + 14, logoY + 22, new PdfStringFormat())
      }
    } else {
      // White rounded square placeholder
      g.drawRectangle(new PdfPen(new PdfColor(255, 255, 255), 1.5), white, logoX, logoY, logoSize, logoSize)
      g.drawString('Logo', bodyBold, null as any, textBrush, logoX + 10, logoY + 22, new PdfStringFormat())
    }

    // "INVOICE" title - larger and bolder
    g.drawString(headerTitle || 'INVOICE', titleFont, null as any, white, logoX + logoSize + 15, y + 20, new PdfStringFormat())

    // Invoice number and status (right-aligned with smart sizing)
    const rightMargin = 20
    const maxRightSectionWidth = 280

    // Prepare invoice number text
    const invoicePrefix = 'Invoice ID: '
    const invoiceNumberText = sanitizeText(inv.id)
    const fullInvoiceText = `${invoicePrefix}${invoiceNumberText}`

    // Try to fit with  font first
    let invoiceFont = h3Bold
    let invoiceMeasured = 0
    try {
      invoiceMeasured = invoiceFont.measureString(fullInvoiceText).width
    } catch (e) {
      invoiceMeasured = fullInvoiceText.length * 8
    }

    // If too wide, try bodyBold
    if (invoiceMeasured > maxRightSectionWidth) {
      invoiceFont = bodyBold
      try {
        invoiceMeasured = invoiceFont.measureString(fullInvoiceText).width
      } catch (e) {
        invoiceMeasured = fullInvoiceText.length * 6
      }
    }

    // If still too wide, wrap to multiple lines
    const invoiceLines: string[] = []
    if (invoiceMeasured > maxRightSectionWidth) {
      // Split into prefix and number for wrapping
      invoiceLines.push(invoicePrefix)

      // Wrap the invoice number if needed
      const wrappedNumber = wrapText(invoiceNumberText, invoiceFont, maxRightSectionWidth)
      invoiceLines.push(...wrappedNumber)
    } else {
      invoiceLines.push(fullInvoiceText)
    }

    // Calculate starting Y position for invoice section
    const invoiceLineHeight = 18
    const totalInvoiceHeight = (invoiceLines.length * invoiceLineHeight) + 25
    const invoiceStartY = y + Math.max(17, (headerHeight - totalInvoiceHeight) / 2)

    // Draw invoice number lines (right-aligned)
    let currentInvoiceY = invoiceStartY
    invoiceLines.forEach((line, index) => {
      const lineFont = index === 0 && invoiceLines.length > 1 ? invoiceFont : invoiceFont
      try {
        const lineWidth = lineFont.measureString(line).width
        const lineX = x + pageWidth - rightMargin - lineWidth
        g.drawString(line, lineFont, null as any, white, lineX, currentInvoiceY, new PdfStringFormat())
      } catch (e) {
        // Fallback to left-aligned if measurement fails
        const lineX = x + pageWidth - maxRightSectionWidth - rightMargin
        g.drawString(line, lineFont, null as any, white, lineX, currentInvoiceY, new PdfStringFormat())
      }
      currentInvoiceY += invoiceLineHeight
    })

    // Status badge below invoice number (right-aligned)
    currentInvoiceY += 7
    const statusText = status.toUpperCase()
    try {
      const statusWidth = bodyBold.measureString(statusText).width
      const statusX = x + pageWidth - rightMargin - statusWidth
      g.drawString(statusText, bodyBold, null as any, white, statusX, currentInvoiceY, new PdfStringFormat())
    } catch (e) {
      // Fallback positioning
      const statusX = x + pageWidth - maxRightSectionWidth - rightMargin
      g.drawString(statusText, bodyBold, null as any, white, statusX, currentInvoiceY, new PdfStringFormat())
    }

    y += headerHeight + 12

    // ===== DATES SECTION =====
    const fmtDate = (iso: string) => {
      const date = new Date(iso)
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
    }

    // Issue Date (left)
    g.drawString('Issue Date', h3Bold, null as any, purpleText, x, y, new PdfStringFormat())
    g.drawString(fmtDate(inv.meta.invoiceDate), bodyBold, null as any, textBrush, x, y + 18, new PdfStringFormat())

    // Due Date (right) - only show if status is not Draft or Paid
    if (status !== 'Draft' && status !== 'Paid') {
      const rightMargin = 0;           // same behavior as Issue Date (leftmost = x)
      const dueLabel = 'Due Date';
      const dueValue = fmtDate(inv.meta.dueDate);

      const labelWidth = h3Bold.measureString(dueLabel).width;
      const valueWidth = bodyBold.measureString(dueValue).width;

      // X positions so right edges align with the right page margin
      const labelX = x + pageWidth - labelWidth - rightMargin;
      const valueX = x + pageWidth - valueWidth - rightMargin;

      g.drawString(dueLabel, h3Bold, null as any, purpleText, labelX, y, new PdfStringFormat());
      g.drawString(dueValue, bodyBold, null as any, textBrush, valueX, y + 18, new PdfStringFormat());
    }
    y += 34

    // Divider line
    g.drawLine(new PdfPen(borderColor, 1.5), x, y, x + pageWidth, y)
    y += 10

    // ===== BILL FROM / BILL TO SECTION =====
    const boxWidth = (pageWidth - 32) / 2
    const addressMaxWidth = boxWidth - 8 // Small margin for padding

    // Add aggressive word-break support for long continuous strings
    const wrapTextAggressively = (text: string, font: any, maxWidth: number): string[] => {
      if (!text) return []

      // First pass: split by explicit newlines
      const paragraphs = text.split('\n')
      const wrappedLines: string[] = []

      paragraphs.forEach(paragraph => {
        if (!paragraph.trim()) {
          wrappedLines.push('')
          return
        }

        // Split by spaces first
        let words = paragraph.split(/(\s+)/)
        let currentLine = ''

        words.forEach(word => {
          if (!word) return

          const testLine = currentLine ? `${currentLine}${word}` : word
          let measuredWidth = 0
          try {
            measuredWidth = font.measureString(testLine).width
          } catch (e) {
            measuredWidth = testLine.length * 6 // rough fallback
          }

          if (measuredWidth <= maxWidth) {
            currentLine = testLine
          } else {
            // Word doesn't fit; push current line and start new one
            if (currentLine) {
              wrappedLines.push(currentLine.trimEnd())
            }

            // If single word is too long, force-break it
            if (word.trim()) {
              let singleWordMeasured = 0
              try {
                singleWordMeasured = font.measureString(word).width
              } catch (e) {
                singleWordMeasured = word.length * 6
              }

              if (singleWordMeasured > maxWidth) {
                // Word is longer than available width; break it character by character
                let charBuffer = ''
                for (let i = 0; i < word.length; i++) {
                  const testChar = charBuffer + word[i]
                  let charMeasured = 0
                  try {
                    charMeasured = font.measureString(testChar).width
                  } catch (e) {
                    charMeasured = testChar.length * 6
                  }

                  if (charMeasured > maxWidth && charBuffer) {
                    wrappedLines.push(charBuffer)
                    charBuffer = word[i]
                  } else {
                    charBuffer += word[i]
                  }
                }
                if (charBuffer) {
                  currentLine = charBuffer
                } else {
                  currentLine = ''
                }
              } else {
                // Word fits on new line
                currentLine = word
              }
            } else {
              currentLine = ''
            }
          }
        })

        if (currentLine) {
          wrappedLines.push(currentLine.trimEnd())
        }
      })

      return wrappedLines.filter(line => line !== '')
    }
    // Helper function to render address block with proper wrapping and dynamic height
    const renderAddressBlock = (label: string, lines: string[], startX: number, startY: number): number => {
      g.drawString(label, h3Bold, null as any, purpleText, startX, startY, new PdfStringFormat())
      let currentY = startY + 24

      lines.forEach((line, idx) => {
        const font = idx === 0 ? bodyBold : bodyFont
        const textColor = idx === 0 ? textBrush : textBrush

        // Wrap long lines to fit within the address box width
        const wrappedLines = wrapTextAggressively(line, font, addressMaxWidth)

        wrappedLines.forEach(wrappedLine => {
          if (wrappedLine.trim()) {
            g.drawString(wrappedLine, font, null as any, textColor, startX, currentY, new PdfStringFormat())
            currentY += 16
          }
        })
      })

      return currentY
    }

    // Bill From (left box)
    const fromLines = [
      inv.from.companyName ?? '',
      inv.from.address ?? '',
      inv.from.email ?? '',
      inv.from.phone ? `Phone: ${inv.from.phone}` : '',
      inv.from.taxId ? `Tax ID: ${inv.from.taxId}` : ''
    ].filter(Boolean)

    const fromEndY = renderAddressBlock('Bill From:', fromLines, x, y)

    // Bill To (right box)
    const toX = x + boxWidth + 32
    const toLines = [
      inv.to.clientName || '',
      inv.to.address || '',
      inv.to.email || '',
      inv.to.taxId ? `Tax ID: ${inv.to.taxId}` : '',
      inv.to.poNumber ? `PO: ${inv.to.poNumber}` : ''
    ].filter(Boolean)

    const toEndY = renderAddressBlock('Bill To:', toLines, toX, y)

    // Move Y position below the taller of the two address blocks
    y = Math.max(fromEndY, toEndY) + 8

    // ===== INVOICE ITEMS TABLE =====
    g.drawString('Invoice Items', h3Bold, null as any, purpleText, x, y, new PdfStringFormat())
    y += 20

    // Create grid for items with better spacing (now with 6 columns including Tax)
    const grid = new PdfGrid()
    grid.columns.add(6)

    // Set row height for better spacing
    grid.style.cellPadding.all = 8

    // Header row with professional styling
    grid.headers.add(1)
    const headerRow = grid.headers.getHeader(0)
    headerRow.height = 36
    const headerCells = headerRow.cells
    const headerLabels = ['S.No', 'Description', 'Quantity', 'Rate', 'Tax', 'Amount']

    for (let i = 0; i < headerLabels.length; i++) {
      const cell = headerCells.getCell(i) as PdfGridCell
      cell.value = headerLabels[i]
      cell.style.backgroundBrush = purpleHeader
      cell.style.textBrush = white
      cell.style.font = h3Bold
      cell.style.borders.all = noPen

      // Add padding to header cells
      const format = new PdfStringFormat()
      if (i === 0) {
        format.alignment = 1 // Center for S.No
      } else if (i === 1) {
        format.alignment = 0 // Left for Description
      } else if (i === 2) {
        format.alignment = 1 // Center for Quantity
      } else if (i === 3 || i === 5) {
        format.alignment = 2 // Right for Price and Amount
      } else if (i === 4) {
        format.alignment = 1 // Center for Tax
      }
      format.lineAlignment = 1 // Vertical center
      cell.style.stringFormat = format
    }

    // Compute column widths dynamically so very large numeric values in Price/Amount
    // are fully visible. We prioritize preserving description space but will shrink
    // it to accommodate wide numbers before falling back to smaller fonts.
    const fixedSL = 55
    const fixedQty = 70
    const fixedTax = 60

    const paddingHorizontal = (grid.style.cellPadding.left || 10) + (grid.style.cellPadding.right || 10)

    // Measure max widths for Price and Amount values
    let maxPriceMeasured = 0
    let maxAmountMeasured = 0
    inv.items.forEach(item => {
      const itemBase = round2((item.qty ?? 0) * (item.rate ?? 0))
      const itemTax = (item.taxable && (item.taxPct ?? 0) > 0)
        ? round2((itemBase * (item.taxPct ?? 0)) / 100)
        : 0
      const amountVal = cfmtPdf(round2(itemBase + itemTax), currency)
      const priceVal = cfmtPdf(item.rate ?? 0, currency)
      try {
        maxPriceMeasured = Math.max(maxPriceMeasured, bodyBold.measureString(priceVal).width)
        maxAmountMeasured = Math.max(maxAmountMeasured, bodyBold.measureString(amountVal).width)
      } catch (e) {
        // ignore measurement failures and fall back to defaults
      }
    })

    const minDesc = 80
    const minPrice = 85  // Increased from 60
    const minAmount = 95

    let priceW = Math.max(minPrice, Math.ceil(maxPriceMeasured) + paddingHorizontal + 10)  // Added buffer
    let amountW = Math.max(minAmount, Math.ceil(maxAmountMeasured) + paddingHorizontal + 10)  // Added buffer

    // Compute description width as remaining space
    let descW = pageWidth - (fixedSL + fixedQty + fixedTax + priceW + amountW)

    // More aggressive reclamation of space
    if (descW < minDesc) {
      let shortage = minDesc - descW
      const reduciblePrice = Math.max(0, priceW - minPrice)
      const takeFromPrice = Math.min(reduciblePrice, Math.ceil(shortage / 2))
      priceW -= takeFromPrice
      shortage -= takeFromPrice

      const reducibleAmount = Math.max(0, amountW - minAmount)
      const takeFromAmount = Math.min(reducibleAmount, shortage)
      amountW -= takeFromAmount
      shortage -= takeFromAmount

      descW = pageWidth - (fixedSL + fixedQty + fixedTax + priceW + amountW)
    }

    // Force landscape for very large numeric values
    const combinedNumeric = priceW + amountW
    const numericShare = combinedNumeric / pageWidth
    let needLandscape = false
    if (numericShare > 0.50 || descW < minDesc) {
      needLandscape = true
    }

    if (needLandscape) {
      doc.pageSettings.orientation = PdfPageOrientation.Landscape
      page = doc.pages.add()
      g = page.graphics
      pageSize.width = 792
      pageSize.height = 612
      const newContentWidth = pageSize.width - (margins.left + margins.right)
      pageWidth = newContentWidth
      descW = newContentWidth - (fixedSL + fixedQty + fixedTax + priceW + amountW)
      if (descW < minDesc) {
        descW = minDesc
      }
      grid.columns.getColumn(0).width = fixedSL
      grid.columns.getColumn(1).width = Math.max(80, descW)
      grid.columns.getColumn(2).width = fixedQty
      grid.columns.getColumn(3).width = priceW
      grid.columns.getColumn(4).width = fixedTax
      grid.columns.getColumn(5).width = amountW
    } else {
      grid.columns.getColumn(0).width = fixedSL
      grid.columns.getColumn(1).width = Math.max(80, descW)
      grid.columns.getColumn(2).width = fixedQty
      grid.columns.getColumn(3).width = priceW
      grid.columns.getColumn(4).width = fixedTax
      grid.columns.getColumn(5).width = amountW
    }

    // Data rows with zebra striping for better readability
    inv.items.forEach((item, idx) => {
      const row = grid.rows.addRow()

      const itemBase = round2((item.qty ?? 0) * (item.rate ?? 0))
      const itemTax = (item.taxable && (item.taxPct ?? 0) > 0)
        ? round2((itemBase * (item.taxPct ?? 0)) / 100)
        : 0
      const rowAmount = round2(itemBase + itemTax)

      const descColWidth = grid.columns.getColumn(1).width || 190
      const paddingHorizontal = (grid.style.cellPadding.left || 10) + (grid.style.cellPadding.right || 10)
      const maxDescWidth = Math.max(40, descColWidth - paddingHorizontal)
      const rawDesc = String(item.description || '').replace(/[^	\x20-\x7E]/g, '')
      const wrappedDescLines = wrapText(rawDesc, bodyFont, maxDescWidth)
      const descForCell = wrappedDescLines.length ? wrappedDescLines.join('\n') : ''

      const lineHeight = 13
      row.height = Math.max(32, wrappedDescLines.length * lineHeight + 10)

      row.cells.getCell(0).value = String(idx + 1)
      row.cells.getCell(1).value = descForCell
      row.cells.getCell(2).value = String(item.qty ?? 0)
      row.cells.getCell(3).value = cfmtPdf(item.rate ?? 0, currency)
      row.cells.getCell(4).value = item.taxable ? `${(item.taxPct ?? 0).toFixed(2)}%` : '-'
      row.cells.getCell(5).value = cfmtPdf(rowAmount, currency)

      for (let i = 0; i < 6; i++) {
        const cell = row.cells.getCell(i)
        cell.style.borders.all = new PdfPen(borderColor, 0.5)

        if (idx % 2 === 0) {
          cell.style.backgroundBrush = new PdfSolidBrush(new PdfColor(249, 250, 251))
        }

        const format = new PdfStringFormat()
        format.lineAlignment = 1

        switch (i) {
          case 0:
            format.alignment = 1
            cell.style.font = bodyFont
            cell.style.textBrush = textBrush
            break

          case 1:
            format.alignment = 0
            cell.style.font = bodyFont
            cell.style.textBrush = textBrush
            break

          case 2:
            format.alignment = 1
            cell.style.font = bodyFont
            cell.style.textBrush = textBrush
            break

          case 3: // Price - improved font sizing
            format.alignment = 2
            try {
              const colW = grid.columns.getColumn(3).width || 85
              const padH = (grid.style.cellPadding.left || 10) + (grid.style.cellPadding.right || 10)
              const available = Math.max(30, colW - padH)
              const val = String(row.cells.getCell(3).value || '')
              const measured = bodyBold.measureString(val).width
              if (measured > available * 1.2) {
                cell.style.font = bodyFont
              } else {
                cell.style.font = bodyFont
              }
            } catch (e) {
              cell.style.font = bodyFont
            }
            cell.style.textBrush = textBrush
            break

          case 4:
            if (cell.value !== '-') {
              format.alignment = 2
              cell.style.font = bodyBold
              cell.style.textBrush = purpleText
            } else {
              format.alignment = 1
              cell.style.font = bodyFont
              cell.style.textBrush = textBrush
            }
            break

          case 5: // Amount - improved font sizing
            format.alignment = 2
            try {
              const colW = grid.columns.getColumn(5).width || 95
              const padH = (grid.style.cellPadding.left || 10) + (grid.style.cellPadding.right || 10)
              const available = Math.max(30, colW - padH)
              const val = String(row.cells.getCell(5).value || '')
              const measured = bodyBold.measureString(val).width
              if (measured > available * 1.2) {
                cell.style.font = bodyFont
              } else {
                cell.style.font = bodyFont
              }
            } catch (e) {
              cell.style.font = bodyFont
            }
            cell.style.textBrush = textBrush
            break
        }

        cell.style.stringFormat = format
      }
    })

    // Draw the grid with better spacing
    const gridResult = grid.draw(page, x, y)

    // CRITICAL FIX: Update page reference to the last page where grid ended
    // When grid spans multiple pages, we must work with the final page
    if (gridResult.page) {
      page = gridResult.page
      g = page.graphics
    }

    y = gridResult.bounds.y + gridResult.bounds.height + 20

    // Re-sync pageWidth in case orientation changed during grid rendering
    {
      const isLandscape = doc.pageSettings.orientation === PdfPageOrientation.Landscape
      const rawWidth = isLandscape ? 792 : 612;  // Letter: 612x792 (portrait), 792x612 (landscape)
      pageWidth = rawWidth - (margins.left + margins.right)
    }

    // ===== PRE-CALCULATE EXACT HEIGHTS (Summary + Notes/Terms) =====
    // Use calc-* names here so we don't collide with variables used later when drawing.
    const calcSummaryCardWidth = 280
    const calcSummaryCardX = x + pageWidth - calcSummaryCardWidth

    // --- Summary card height calculation (same fonts & line heights you already use) ---
    const itemLineHeight = 14
    const totalLineHeight = 16
    const availableValueWidth = calcSummaryCardWidth - 40
    let requiredContentHeight = 36 // title + top padding

    const summaryItemsCalc = [
      cfmtPdf(inv.summary.subtotal, currency),
      cfmtPdf(inv.summary.taxAmount, currency),
      `${inv.summary.discountPct.toFixed(2)}%`
    ]

    summaryItemsCalc.forEach(val => {
      let measured = 0
      try { measured = bodyBold.measureString(val).width } catch { measured = 0 }
      if (measured <= availableValueWidth) {
        requiredContentHeight += itemLineHeight
      } else {
        let smallMeasured = 0
        try { smallMeasured = smallBold.measureString(val).width } catch { smallMeasured = 0 }
        if (smallMeasured <= availableValueWidth) {
          requiredContentHeight += itemLineHeight
        } else {
          const wrapped = wrapText(val, bodyFont, availableValueWidth)
          requiredContentHeight += Math.max(1, wrapped.length) * itemLineHeight
        }
      }
      requiredContentHeight += 4
    })

    // Divider space
    requiredContentHeight += 12

    // Total value height
    const totalStr = cfmtPdf(inv.summary.total, currency)
    let totalMeasuredCalc = 0
    try { totalMeasuredCalc = h3Bold.measureString(totalStr).width } catch { totalMeasuredCalc = 0 }
    if (totalMeasuredCalc <= availableValueWidth) {
      requiredContentHeight += totalLineHeight
    } else {
      let smallMeasured = 0
      try { smallMeasured = smallBold.measureString(totalStr).width } catch { smallMeasured = 0 }
      if (smallMeasured <= availableValueWidth) {
        requiredContentHeight += totalLineHeight
      } else {
        const wrappedTotal = wrapText(totalStr, bodyFont, availableValueWidth)
        requiredContentHeight += Math.max(1, wrappedTotal.length) * totalLineHeight
      }
    }

    // This is the final height needed for the summary card
    const summaryCardHeight = Math.max(148, requiredContentHeight + 20)

    // --- Notes & Terms height calculation (exact, using your aggressive wrapper) ---
    // calc-* vars only for pre-measurement; drawing vars are defined later and won't collide.
    const calcNotesX = x
    const calcNotesMaxW = Math.max(180, calcSummaryCardX - calcNotesX - 20) // 20pt buffer before summary card
    const calcWrappedLineH = 16

    const calcNotesLines = wrapTextAggressively(inv.notes || '', bodyFont, calcNotesMaxW)
    const calcTermsLines = wrapTextAggressively(inv.terms || '', bodyFont, calcNotesMaxW)

    // Titles (Notes + Terms) + gaps: 20(title) + 20(spacing) + 20(title)
    const calcNotesTermsStatic = 20 /*Notes title*/ + 20 /*gap after notes*/ + 20 /*Terms title*/
    const calcNotesH = (calcNotesLines.length * calcWrappedLineH)
    const calcTermsH = (calcTermsLines.length * calcWrappedLineH)
    const calcNotesTermsTotalH = calcNotesTermsStatic + calcNotesH + calcTermsH

    // We render Summary and Notes/Terms side-by-side starting at same Y,
    // so the required block height is the max of the two columns.
    const requiredBlockHeight = Math.max(summaryCardHeight, calcNotesTermsTotalH)

    // Decide the page break using the true block height
    y = checkPageBreak(y, requiredBlockHeight, /*footerReserve*/ 0)

    // ---- REDECLARE the runtime vars your drawing code uses next ----
    // These names are expected below in your drawing section.
    const summaryCardWidth = 280
    const summaryCardX = x + pageWidth - summaryCardWidth
    const summaryCardY = y

    // Draw card background sized to content
    g.drawRectangle(new PdfPen(borderColor, 1.0), new PdfSolidBrush(new PdfColor(250, 250, 251)),
      summaryCardX, summaryCardY, summaryCardWidth, summaryCardHeight)

    // Summary title
    g.drawString('Summary:', h3Bold, null as any, purpleText, summaryCardX + 18, summaryCardY + 12, new PdfStringFormat())
    let summaryY = summaryCardY + 30
    const summaryItems = [
      { label: 'Subtotal:', value: cfmtPdf(inv.summary.subtotal, currency) },
      { label: 'Tax Amount:', value: cfmtPdf(inv.summary.taxAmount, currency) },
      { label: 'Discount:', value: `${inv.summary.discountPct.toFixed(2)}%` }
    ]


    summaryItems.forEach(item => {
      g.drawString(item.label, bodyFont, null as any, textBrush, summaryCardX + 20, summaryY, new PdfStringFormat())
      const availableValueWidth = summaryCardWidth - 36 // slightly tighter left/right padding

      // Choose font or wrap if necessary so value stays inside card
      let valueFont = bodyBold
      let measured = 0
      try { measured = valueFont.measureString(item.value).width } catch (e) { measured = 0 }
      if (measured > availableValueWidth) {
        try {
          const smallMeasured = smallBold.measureString(item.value).width
          if (smallMeasured <= availableValueWidth) {
            valueFont = smallBold
            measured = smallMeasured
          } else {
            // Wrap across multiple lines
            const wrapped = wrapText(item.value, bodyFont, availableValueWidth)
            wrapped.forEach((line, i) => {
              const w = bodyFont.measureString(line).width
              g.drawString(line, bodyFont, null as any, textBrush, summaryCardX + summaryCardWidth - 20 - w, summaryY + (i * 14), new PdfStringFormat())
            })
            summaryY += (wrapped.length * 14)
            summaryY += 6
            return
          }
        } catch (e) {
          // fallback to drawing with bodyBold
        }
      }

      g.drawString(item.value, valueFont, null as any, textBrush, summaryCardX + summaryCardWidth - 20 - measured, summaryY, new PdfStringFormat())
      summaryY += 20
    })

    // Divider line with better styling
    summaryY += 4
    g.drawLine(new PdfPen(new PdfColor(203, 213, 225), 1.0),
      summaryCardX + 18, summaryY, summaryCardX + summaryCardWidth - 18, summaryY)
    summaryY += 10

    // Total (emphasized with larger font)
    const totalLabel = 'Amount Due:'
    const totalValue = cfmtPdf(inv.summary.total, currency)
    const totalFont = h3Bold
    g.drawString(totalLabel, totalFont, null as any, purpleText, summaryCardX + 20, summaryY, new PdfStringFormat())
    // Ensure total value fits; try smaller fonts or wrap if needed
    const availableTotalWidth = summaryCardWidth - 40
    let totalFontToUse = totalFont
    let totalMeasured = 0
    let totalDrawnStacked = false
    try { totalMeasured = totalFontToUse.measureString(totalValue).width } catch (e) { totalMeasured = 0 }
    if (totalMeasured > availableTotalWidth) {
      try {
        const smallMeasured = smallBold.measureString(totalValue).width
        if (smallMeasured <= availableTotalWidth) {
          totalFontToUse = smallBold
          totalMeasured = smallMeasured
        } else {
          // If too wide, stack the total: label above and wrapped value left-aligned
          const wrappedTotal = wrapText(totalValue, bodyBold, availableTotalWidth)
          // draw wrapped lines left-aligned inside the card
          wrappedTotal.forEach((line, i) => {
            g.drawString(line, bodyBold, null as any, purpleText, summaryCardX + 20, summaryY + (i * 16), new PdfStringFormat())
          })
          summaryY += (wrappedTotal.length * 16)
          summaryY += 6
          totalDrawnStacked = true
          // finished drawing total (we've drawn it stacked)
          // continue to notes/terms
        }
      } catch (e) {
        // fallback
      }
    }
    if (!totalDrawnStacked && totalMeasured <= availableTotalWidth) {
      g.drawString(totalValue, totalFontToUse, null as any, purpleText, summaryCardX + summaryCardWidth - 20 - totalMeasured, summaryY, new PdfStringFormat())
    }


    // ===== NOTES & TERMS (side by side with Summary card) =====
    const notesX = x
    const notesMaxWidth = Math.max(180, summaryCardX - notesX - 20) // 20pt buffer before summary card
    const lineHeightWrapped = 16

    // Start Notes/Terms at the SAME Y position as Summary card (side by side layout)
    let notesDrawY = summaryCardY

    // Notes section with title
    g.drawString('Notes:', h3Bold, null as any, purpleText, notesX, notesDrawY, new PdfStringFormat())
    notesDrawY += 20

    const notesLines = wrapTextAggressively(inv.notes || '', bodyFont, notesMaxWidth)
    notesLines.forEach((ln) => {
      g.drawString(ln, bodyFont, null as any, textBrush, notesX, notesDrawY, new PdfStringFormat())
      notesDrawY += lineHeightWrapped
    })

    // Buffer before Terms section
    notesDrawY += 20

    // Terms & Conditions section with title
    g.drawString('Terms & Conditions:', h3Bold, null as any, purpleText, notesX, notesDrawY, new PdfStringFormat())
    notesDrawY += 20

    const termsLines = wrapTextAggressively(inv.terms || '', bodyFont, notesMaxWidth)
    termsLines.forEach((ln) => {
      g.drawString(ln, bodyFont, null as any, textBrush, notesX, notesDrawY, new PdfStringFormat())
      notesDrawY += lineHeightWrapped
    })



    // Save the PDF
    const safeFileName = sanitizeText(inv.id).replace(/[^a-zA-Z0-9-_]/g, '_')
    doc.save(`Invoice-${safeFileName}.pdf`)
    doc.destroy()

    //Ensure no previous toasts can overlap with the success toast
    toastRef.current?.hide('All');

    showToast({
      title: 'PDF Generated',
      content: `Invoice-${safeFileName}.pdf has been downloaded`,
      cssClass: 'e-toast-success'       // ensure a clean success skin
    });
  }

  // Toolbar now contains a left title, a flex spacer, then the Add button at the right
  // Left title + right-aligned Add button (no spacer needed)
  const toolbarOptions: any[] = [
    {
      id: 'itemsTitle',
      align: 'Left',
      template: () => (<span className="toolbar-title">Invoice Items</span>)
    },
    { text: '+ ADD ITEM', id: 'addItem', align: 'Right' }
  ]
  let gridInstance: GridComponent = (window as any).__invoiceGrid;
  function toolbarClick(args: any): void {
    if (!args || !args.item) return;

    // Handle custom "Add Item" button
    if (args.item.id === 'addItem') {
      addItem();                    // Calls your existing addItem() function
      return;
    }

    // Handle built-in ExcelExport button
    if (
      args.item.id?.toLowerCase().includes('excelexport') ||
      args.item.text?.toLowerCase().includes('excel') ||
      args.item.type === 'ExcelExport'
    ) {
      if (gridInstance) {
        gridInstance.excelExport(getExcelExportProperties());
      } else {
        // Fallback if gridInstance not yet ready
        const grid = (window as any).__invoiceGrid;
        if (grid) grid.excelExport(getExcelExportProperties());
      }
    }
  }

  const getExcelExportProperties = (): any => {
    const fmtDate = (iso: string) => {
      const date = new Date(iso)
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
    }
    // using any temporarily – we'll improve it later
    const issueDate = fmtDate(inv.meta.invoiceDate);
    const dueDate = (status === 'Unpaid' || status === 'Overdue') ? fmtDate(inv.meta.dueDate) : '';

    const fromLines = [
      sanitizeText(inv.from.companyName || ''),
      sanitizeText(inv.from.address || ''),
      inv.from.email || '',
      inv.from.phone ? `Phone: ${sanitizeText(inv.from.phone)}` : '',
      inv.from.taxId ? `Tax ID: ${sanitizeText(inv.from.taxId)}` : ''
    ].filter(Boolean);

    const toLines = [
      sanitizeText(inv.to.clientName || ''),
      sanitizeText(inv.to.address || ''),
      inv.to.email || '',
      inv.to.taxId ? `Tax ID: ${sanitizeText(inv.to.taxId)}` : '',
      inv.to.poNumber ? `PO: ${sanitizeText(inv.to.poNumber)}` : ''
    ].filter(Boolean);

    const maxLines = Math.max(fromLines.length, toLines.length);

    const headerRowsData = [
      {
        cells: [
          {
            colSpan: 6,
            value: headerTitle,
            style: { fontSize: 20, hAlign: 'Center', bold: true, fontColor: '#7c3aed' }
          }
        ]
      },
      {
        cells: [
          { colSpan: 6, value: '' }
        ]
      },
      // Left: Issue Date | Right: Invoice ID
      {
        cells: [
          // Left block (Issue Date)
          { index: 1, value: 'Issue Date', style: { bold: true, fontColor: '#7c3aed', fontSize: 14 } },
          { index: 2, value: issueDate, colSpan: 2, style: { fontSize: 14 } },

          // Right block (moved Invoice ID here)
          { index: 5, value: 'Invoice ID:', style: { bold: true, fontColor: '#7c3aed', fontSize: 14 } },
          {
            index: 6,
            value: sanitizeText(inv.id || 'DRAFT'),
            style: { bold: true, fontSize: 14 }
          }
        ]
      },
      // Left: Due Date (optional) | Right: Status (goes under Invoice ID)
      ...(dueDate
        ? [
          {
            cells: [
              // Left block (Due Date)
              { index: 1, value: 'Due Date', style: { bold: true, fontColor: '#7c3aed', fontSize: 14 } },
              { index: 2, value: dueDate, colSpan: 2, style: { fontSize: 14 } },

              // Right block (Status below invoice ID)
              { index: 6, value: status.toUpperCase(), style: { bold: true, fontSize: 14 } }
            ]
          }
        ]
        : [
          {
            // If there is no due date, still place Status below Invoice ID for consistent stacking
            cells: [
              { index: 6, value: status.toUpperCase(), style: { bold: true, fontSize: 14 } }
            ]
          }
        ]),

      {
        cells: [
          { colSpan: 6, value: '' }
        ]
      },
      {
        cells: [
          { index: 1, colSpan: 3, value: 'Bill From:', style: { bold: true, fontColor: '#7c3aed', fontSize: 16 } },
          { index: 4, colSpan: 3, value: 'Bill To:', style: { bold: true, fontColor: '#7c3aed', fontSize: 16 } }
        ]
      }
    ];

    for (let i = 0; i < maxLines; i++) {
      headerRowsData.push({
        cells: [
          { index: 1, colSpan: 3, value: fromLines[i] || '', style: { bold: false, fontColor: '#1f2937', fontSize: 14 } },
          { index: 4, colSpan: 3, value: toLines[i] || '', style: { bold: false, fontColor: '#1f2937', fontSize: 14 } }
        ]
      });
    }

    headerRowsData.push({ cells: [{ colSpan: 6, value: '' }] }); // space before items

    headerRowsData.push({
      cells: [{
        colSpan: 6,
        value: 'Invoice Items',
        style: { bold: true, fontColor: '#7c3aed', hAlign: 'Left', fontSize: 16 }
      }]
    });

    const itemsData = inv.items.map((item, index) => {
      const base = round2((item.qty ?? 0) * (item.rate ?? 0));
      const itemTax = (item.taxable && (item.taxPct ?? 0) > 0) ? round2(base * (item.taxPct ?? 0) / 100) : 0;
      const amount = round2(base + itemTax);
      return {
        sl_no: index + 1,
        description: sanitizeText(item.description || ''),
        quantity: item.qty ?? 0,
        rate: item.rate ?? 0,
        tax: item.taxable ? `${(item.taxPct ?? 0).toFixed(2)}%` : '-',
        amount: amount
      };
    });

    const excelColumns = [
      { field: 'sl_no', headerText: 'S.No', width: 90, textAlign: 'Center', format: 'N0' },
      { field: 'description', headerText: 'Description', width: 240 },
      { field: 'quantity', headerText: 'Quantity', width: 100, textAlign: 'Center', format: 'N0' },
      { field: 'rate', headerText: 'Rate', width: 130, textAlign: 'Right', format: 'C2' },
      { field: 'tax', headerText: 'Tax', width: 130, textAlign: 'Center' },
      { field: 'amount', headerText: 'Amount', width: 160, textAlign: 'Right', format: 'C2' }
    ];

    const footerRowsData = [
      // Empty line after items table
      { cells: [{ colSpan: 6, value: '' }] },

      // Summary Title
      {
        cells: [{
          colSpan: 6,
          value: 'Summary',
          style: { bold: true, fontColor: '#7c3aed', hAlign: 'Right', fontSize: 16 }
        }]
      },
      {
        cells: [
          { index: 5, value: 'Subtotal', style: { fontSize: 14 } },
          { index: 6, value: inv.summary.subtotal, style: { hAlign: 'Right', numberFormat: '$#,##0.00', bold: true, fontSize: 14 } }
        ]
      },
      {
        cells: [
          { index: 5, value: 'Tax Rate (%)', style: { fontSize: 14 } },
          { index: 6, value: inv.summary.taxRatePct / 100, style: { hAlign: 'Right', numberFormat: '0.00%', bold: true, fontSize: 14 } }
        ]
      },
      {
        cells: [
          { index: 5, value: 'Tax Amount', style: { fontSize: 14 } },
          { index: 6, value: inv.summary.taxAmount, style: { hAlign: 'Right', numberFormat: '$#,##0.00', bold: true, fontSize: 14 } }
        ]
      },
      {
        cells: [
          { index: 5, value: 'Discount (%)', style: { fontSize: 14 } },
          { index: 6, value: inv.summary.discountPct / 100, style: { hAlign: 'Right', numberFormat: '0.00%', bold: true, fontSize: 14 } }
        ]
      },
      {
        cells: [
          { index: 5, value: 'Amount Due', style: { bold: true, fontColor: '#7c3aed', fontSize: 16 } },
          { index: 6, value: inv.summary.total, style: { hAlign: 'Right', bold: true, fontColor: '#7c3aed', fontSize: 16, numberFormat: '$#,##0.00' } }
        ]
      },
      {
        cells: [
          { colSpan: 6, value: '' }
        ]
      },
      {
        cells: [
          { colSpan: 6, value: 'Notes:', style: { bold: true, fontColor: '#7c3aed', fontSize: 16 } }
        ]
      },
      {
        height: 80,
        cells: [
          { colSpan: 6, value: sanitizeText(inv.notes || ''), style: { wrapText: true, fontSize: 14 } }
        ]
      },
      {
        cells: [
          { colSpan: 6, value: '' }
        ]
      },
      {
        cells: [
          { colSpan: 6, value: 'Terms & Conditions:', style: { bold: true, fontColor: '#7c3aed', fontSize: 16 } }
        ]
      },
      {
        height: 80,
        cells: [
          { colSpan: 6, value: sanitizeText(inv.terms || ''), style: { wrapText: true, fontSize: 14 } }
        ]
      },
    ];

    return {
      header: {
        headerRows: headerRowsData.length,
        rows: headerRowsData
      },
      footer: {
        footerRows: footerRowsData.length,
        rows: footerRowsData
      },
      dataSource: itemsData,
      columns: excelColumns,

      theme: {
        header: {
          bold: true,
          fontSize: 14,     // <-- Table header row text size
          fontColor: '#000000'
        },
      },

      fileName: `Invoice_${sanitizeText(inv.id || 'draft')}_${new Date().toISOString().split('T')[0]}.xlsx`
    };
  };
  const onExcelExport = useCallback(() => {
    const grid = (window as any).__invoiceGrid;
    if (grid) {
      grid.excelExport(getExcelExportProperties());
    } else {
      toastRef.current?.show({
        title: 'Export unavailable',
        content: 'Grid is not ready yet. Please try again.',
        cssClass: 'e-danger',
        timeOut: 2000
      });
    }
  }, [inv, status]); // dependencies ensure fresh export data
  return (
    <div className="invoice-shell">
      <div className="app-container">
        <div className="invoice-card">
          <div className="invoice-card__left">
            <div
              className="logo-upload"
              title="Click to upload your company logo (PNG, JPG, SVG, WEBP - Max 2MB)"
              role="button"
              tabIndex={0}
              onClick={openLogoPicker}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLogoPicker(); } }}
            >
              {/* Native file input for reliable file selection */}
              <input
                ref={logoNativeInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                onChange={onNativeLogoChange}
                style={{ display: 'none' }}
                aria-label="Upload company logo"
              />

              {logoUrl ? (
                <>
                  <img src={logoUrl} alt="Company logo" className="logo-image" />
                  <button
                    className="logo-clear"
                    aria-label="Remove logo"
                    onClick={clearLogo}
                    type="button"
                  >×</button>
                </>
              ) : (
                <span className="logo-placeholder" aria-hidden>📷</span>
              )}
            </div>
            <div className="title-wrap">
              <TextBoxComponent
                cssClass="invoice-title-input"
                value={headerTitle}
                input={(a) => setHeaderTitle(String(a.value ?? ''))}
                placeholder="INVOICE"
                aria-label="Invoice Title"
              />
              <TextBoxComponent
                cssClass="invoice-subtitle-input"
                value="Professional Invoice Generator"
                placeholder="Professional Invoice Generator"
                aria-label="Invoice Subtitle"
                readonly={true}
              />
            </div>
          </div>
          <div className="invoice-card__right">
            <div className="invoice-pill">
              <span className="inv-label">Invoice ID:</span>
              <div className="inv-number-field">
                <TextBoxComponent
                  cssClass={`inv-number-input ${errors['id'] ? 'has-error' : ''}`}
                  placeholder="INV-001"
                  value={inv.id}
                  input={(a) => {
                    const raw = String(a.value ?? '')
                    setInv(p => ({ ...p, id: raw.toUpperCase() }));
                    validateField('id', raw)
                  }}
                  blur={(a: any) => validateField('id', String(a?.value ?? inv.id))}
                  aria-label="Invoice Number"
                />
              </div>
            </div>
            <div className="status-row">
              <div
                className="status-seg"
                role="tablist"
                aria-label="Invoice Status"
                ref={segWrapRef}
                data-active-idx={activeIdx}
              >
                {/* Sliding background underlay */}
                <div
                  className="seg-indicator"
                  style={{
                    width: `${segIndicator.width}px`,
                    transform: `translateX(${segIndicator.left}px)`,
                  }}
                  aria-hidden
                />
                {(['Draft', 'Unpaid', 'Paid', 'Overdue'] as const).map((s) => (
                  <button
                    key={s}
                    role="tab"
                    aria-selected={status === s}
                    className={`seg-btn ${status === s ? 'active' : ''}`}
                    ref={(el) => (segBtnRefs.current[s] = el)}
                    onClick={() => setStatus(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="form-grid">
          <div className="panel">
            <div className="panel-title">From (Your Company)</div>

            <div className="field-wrap">
              <div className="input-with-icon">
                <span className="e-input-group-icon e-icons e-lock"></span>
                <TextBoxComponent cssClass={errors['from.companyName'] ? 'has-error' : ''} placeholder="Company Name" value={inv.from.companyName} input={(a) => { const v = String(a.value ?? ''); setInv(p => ({ ...p, from: { ...p.from, companyName: v } })); validateField('from.companyName', v); }} aria-label="Company Name" />
              </div>
              {errors['from.companyName'] && <div className="field-error">{errors['from.companyName']}</div>}
            </div>

            <div className="field-wrap">
              <div className="input-with-icon icon-top">
                <span className="e-input-group-icon e-icons e-location"></span>
                <TextBoxComponent multiline={true} cssClass={errors['from.address'] ? 'has-error' : ''} placeholder="Company Address" value={inv.from.address} input={(a) => { const v = String(a.value ?? ''); setInv(p => ({ ...p, from: { ...p.from, address: v } })); validateField('from.address', v); }} aria-label="Company Address" />
              </div>
              {errors['from.address'] && <div className="field-error">{errors['from.address']}</div>}
            </div>
            <div className="grid-2">
              <div className="field-wrap">
                <div className="input-with-icon">
                  <span className="e-input-group-icon svg-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                      <path d="M22 6L12 13L2 6" />
                    </svg>
                  </span>
                  <TextBoxComponent placeholder="Email Address" cssClass={errors['from.email'] ? 'has-error' : ''} value={inv.from.email} input={(a) => { const v = String(a.value ?? ''); setInv(p => ({ ...p, from: { ...p.from, email: v } })); validateField('from.email', v); }} aria-label="Email Address" />
                </div>
                {errors['from.email'] && <div className="field-error">{errors['from.email']}</div>}
              </div>
              <div className="field-wrap">
                <div className="input-with-icon">
                  <span className="e-input-group-icon svg-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                    </svg>
                  </span>
                  <TextBoxComponent
                    placeholder="Phone Number"
                    cssClass={errors['from.phone'] ? 'has-error' : ''}
                    value={inv.from.phone}
                    input={(a) => {
                      // Strip anything that is NOT a digit, space, +, (, ), -, or .
                      const vRaw = String(a.value ?? '');
                      const v = vRaw.replace(/[^0-9()+\-.\s]/g, '');
                      setInv(p => ({ ...p, from: { ...p.from, phone: v } }));
                      validateField('from.phone', v);
                    }}
                    aria-label="Phone Number"
                  />

                </div>
                {errors['from.phone'] && <div className="field-error">{errors['from.phone']}</div>}
              </div>
            </div>


            <div className="field-wrap">
              <div className="input-with-icon">
                <span className="e-input-group-icon e-icons e-file-format"></span>
                <TextBoxComponent placeholder="Company Tax ID" cssClass={errors['from.taxId'] ? 'has-error' : ''} value={inv.from.taxId} input={(a) => { const v = String(a.value ?? ''); setInv(p => ({ ...p, from: { ...p.from, taxId: v } })); validateField('from.taxId', v); }} aria-label="Company Tax ID" />
              </div>
              {errors['from.taxId'] && <div className="field-error">{errors['from.taxId']}</div>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">To (Client)</div>

            <div className="field-wrap">
              <div className="input-with-icon">
                <span className="e-input-group-icon e-icons e-user"></span>
                <TextBoxComponent placeholder="Client Name" cssClass={errors['to.clientName'] ? 'has-error' : ''} value={inv.to.clientName || ''} input={(a) => { const v = String(a.value ?? ''); setInv(p => ({ ...p, to: { ...p.to, clientName: v } })); validateField('to.clientName', v); }} aria-label="Client Name" />
              </div>
              {errors['to.clientName'] && <div className="field-error">{errors['to.clientName']}</div>}
            </div>

            <div className="field-wrap">
              <div className="input-with-icon icon-top">
                <span className="e-input-group-icon e-icons e-location"></span>
                <TextBoxComponent multiline={true} placeholder="Client Address" cssClass={errors['to.address'] ? 'has-error' : ''} value={inv.to.address || ''} input={(a) => { const v = String(a.value ?? ''); setInv(p => ({ ...p, to: { ...p.to, address: v } })); validateField('to.address', v); }} aria-label="Client Address" />
              </div>
              {errors['to.address'] && <div className="field-error">{errors['to.address']}</div>}
            </div>

            <div className="grid-2">
              <div className="field-wrap">
                <div className="input-with-icon">
                   <span className="e-input-group-icon svg-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                      <path d="M22 6L12 13L2 6" />
                    </svg>
                  </span>
                  <TextBoxComponent placeholder="Client Email" cssClass={errors['to.email'] ? 'has-error' : ''} value={inv.to.email || ''} input={(a) => { const v = String(a.value ?? ''); setInv(p => ({ ...p, to: { ...p.to, email: v } })); validateField('to.email', v); }} aria-label="Client Email" />
                </div>
                {errors['to.email'] && <div className="field-error">{errors['to.email']}</div>}
              </div>

              <div className="field-wrap">
                <div className="input-with-icon">
                  <span className="e-input-group-icon e-icons e-file-format"></span>
                  <TextBoxComponent placeholder="Tax ID" cssClass={errors['to.taxId'] ? 'has-error' : ''} value={inv.to.taxId || ''} input={(a) => { const v = String(a.value ?? ''); setInv(p => ({ ...p, to: { ...p.to, taxId: v } })); validateField('to.taxId', v); }} aria-label="Client Tax ID" />
                </div>
                {errors['to.taxId'] && <div className="field-error">{errors['to.taxId']}</div>}
              </div>
            </div>

            <div className="field-wrap">
              <TextBoxComponent placeholder="PO Number / Reference" cssClass={errors['to.poNumber'] ? 'has-error' : ''} value={inv.to.poNumber || ''} input={(a) => { const v = String(a.value ?? ''); setInv(p => ({ ...p, to: { ...p.to, poNumber: v } })); validateField('to.poNumber', v); }} aria-label="PO Number / Reference" />
              {errors['to.poNumber'] && <div className="field-error">{errors['to.poNumber']}</div>}
            </div>
          </div>
        </div>

        <div className="meta-row">
          <div className="meta-field">
            <div className="label">Invoice Date</div>
            <DatePickerComponent placeholder="mm/dd/yyyy" value={new Date(inv.meta.invoiceDate)} change={onInvoiceDateChange} aria-label="Invoice Date" />
          </div>
          <div className="meta-field">
            <div className="label">Due Date</div>
            <DatePickerComponent placeholder="mm/dd/yyyy" value={new Date(inv.meta.dueDate)} change={(a) => a.value && setInv(p => ({ ...p, meta: { ...p.meta, dueDate: a.value!.toISOString() } }))} enabled={status !== 'Draft' && status !== 'Paid'} aria-label="Due Date" />
          </div>
          <div className="meta-field">
            <div className="label">Payment Terms</div>
            <DropDownListComponent dataSource={terms} fields={{ text: 'label', value: 'key' }} value={inv.meta.paymentTerm} change={onPaymentTermChange} aria-label="Payment Terms" />
          </div>
        </div>

        <div className="items-section">
          <GridComponent
            ref={(grid: any) => {
              // Store grid reference for programmatic access
              if (grid) {
                (window as any).__invoiceGrid = grid;
              }
            }}
            dataSource={inv.items}
            toolbar={toolbarOptions}
            allowExcelExport={true}
            toolbarClick={toolbarClick}
            rowHeight={52}
            enableHover={false}
            editSettings={{
              allowEditing: true,
              allowDeleting: false,
              mode: 'Normal',
              allowEditOnDblClick: true
            }}
            actionComplete={useCallback((args: any) => {
              if (args.requestType === 'save') {
                // Update state after grid completes save
                const data = args.data as InvoiceItem;

                setInv((prev) => {
                  const items = prev.items.map((item) =>
                    item.id === data.id
                      ? {
                        ...item,
                        description: String(data.description || ''),
                        qty: Number(data.qty) || 0,
                        rate: Number(data.rate) || 0,
                        taxable: Boolean(data.taxable),
                        taxPct: Number(data.taxPct) || 0
                      }
                      : item
                  );

                  // Recompute will recalculate all amounts and summary
                  return recompute({ ...prev, items });
                });
              }
            }, [recompute])}
            cellEdit={useCallback(() => {
              // Allow editing to proceed
              // This event fires when a cell enters edit mode
            }, [])}
          >
            <ColumnsDirective>
              <ColumnDirective
                field='id'
                headerText='ID'
                isPrimaryKey={true}
                visible={false}
                width='0'
              />
              <ColumnDirective
                field='description'
                headerText='Description'
                width='240'
                customAttributes={{ class: 'col-desc' }}
                editType='stringedit'
                validationRules={{ required: true }}
              />
              <ColumnDirective
                field='qty'
                headerText='Quantity'
                width='80'
                textAlign='Center'
                customAttributes={{ class: 'col-qty' }}
                editType='numericedit'
                edit={{
                  params: {
                    cssClass: 'num-input',
                    min: 0,
                    step: 1,
                    format: 'n0',
                    showSpinButton: false,
                    decimals: 0,
                    validateDecimalOnType: true
                  }
                }}
              />
              <ColumnDirective
                field='rate'
                headerText='Rate'
                width='120'
                textAlign='Right'
                customAttributes={{ class: 'col-rate' }}
                editType='numericedit'
                edit={{
                  params: {
                    cssClass: 'num-input',
                    min: 0,
                    format: 'n2',
                    showSpinButton: false,
                    decimals: 2,
                    validateDecimalOnType: true
                  }
                }}
                format='N2'
              />


              <ColumnDirective
                headerText='Amount'
                width='140'
                textAlign='Right'
                customAttributes={{ class: 'col-amount' }}
                allowEditing={false}
                valueAccessor={(_field: string, data: any, _column: any) => {
                  const base = round2((Number(data.qty) || 0) * (Number(data.rate) || 0));
                  const itemTax = (data.taxable && (Number(data.taxPct) || 0) > 0)
                    ? round2((base * (Number(data.taxPct) || 0)) / 100)
                    : 0;
                  const amount = round2(base + itemTax);
                  return fmtMoney(amount, currency);
                }}
                template={(props: InvoiceItem) => {
                  const base = round2((Number(props.qty) || 0) * (Number(props.rate) || 0));
                  const itemTax = (props.taxable && (Number(props.taxPct) || 0) > 0)
                    ? round2((base * (Number(props.taxPct) || 0)) / 100)
                    : 0;
                  const amount = round2(base + itemTax);
                  return (
                    <div style={{
                      textAlign: 'right',
                      color: '#1f2937',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      height: '100%',
                      fontSize: '14px'
                    }}>
                      {fmtMoney(amount, currency)}
                    </div>
                  );
                }}
              />

              <ColumnDirective
                field='taxable'
                headerText='Taxable'
                width='70'
                textAlign='Center'
                customAttributes={{ class: 'col-taxable' }}
                editType='booleanedit'
                displayAsCheckBox={true}
                type='boolean'
              />


              <ColumnDirective
                field='taxPct'
                headerText='Tax %'
                width='80'
                textAlign='Right'
                customAttributes={{ class: 'col-tax-pct' }}
                editType='numericedit'
                edit={{
                  params: {
                    cssClass: 'num-input',
                    min: 0,
                    max: 100,
                    step: 0.01,
                    format: 'n2',
                    showSpinButton: false,
                    decimals: 2,
                    validateDecimalOnType: true
                  }
                }}
                format='N2'
                template={(props: InvoiceItem) => {
                  return (
                    <div style={{
                      textAlign: 'right',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      height: '100%',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      {props.taxable ? `${(Number(props.taxPct) || 0).toFixed(2)}%` : '-'}
                    </div>
                  );
                }}
              />
              <ColumnDirective
                headerText='Action'
                width='100'
                textAlign='Center'
                customAttributes={{ class: 'col-action' }}
                allowEditing={false}
                template={(props: InvoiceItem) => (
                  <ButtonComponent
                    cssClass='e-danger e-small'
                    iconCss='e-icons e-delete'
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(props.id);
                    }}
                    aria-label={`Delete item ${props.description || 'item'}`}
                  />
                )}
              />
            </ColumnsDirective>
            <Inject services={[Toolbar, ExcelExport, Edit]} />
          </GridComponent>
        </div>

        <div className="two-col">
          <div className="panel Additional-card">
            <div className="panel-title">Additional Information</div>
            <div className="label">Notes</div>
            <TextBoxComponent multiline={true} placeholder="Thank you for your business!" value={inv.notes} input={(a) => setInv(p => ({ ...p, notes: String(a.value ?? '') }))} aria-label="Notes" cssClass="notes-textarea" />
            <div className="label">Terms & Conditions</div>
            <TextBoxComponent multiline={true} placeholder="Late payments may incur interest at the maximum legal rate." value={inv.terms} input={(a) => setInv(p => ({ ...p, terms: String(a.value ?? '') }))} aria-label="Terms and Conditions" cssClass="terms-textarea" />
          </div>
          <div className="panel summary-card">
            <div className="panel-title">Invoice Summary</div>
            <div className="summary-row"><span>Subtotal:</span><span className="amount">{cfmt(inv.summary.subtotal)}</span></div>
            <div className="summary-row">
              <span>Tax Rate (%):</span>
              <NumericTextBoxComponent
                cssClass='num-input'
                min={0}
                max={100}
                step={0.01}
                format='n2'
                showSpinButton={false}
                value={inv.summary.taxRatePct}
                change={(a) => {
                  const val = Number(a.value ?? 0);
                  const safe = isNaN(val) ? 0 : Math.max(0, Math.min(100, val));
                  setInv(p => recompute({ ...p, summary: { ...p.summary, taxRatePct: safe } }));
                }}
                aria-label="Tax Rate"
              />
            </div>
            <div className="summary-row"><span>Tax Amount:</span><span className="amount">{cfmt(inv.summary.taxAmount)}</span></div>
            <div className="summary-row">
              <span>Discount (%):</span>
              <NumericTextBoxComponent
                cssClass='num-input'
                min={0}
                max={100}
                step={0.01}
                format='n2'
                showSpinButton={false}
                value={inv.summary.discountPct}
                change={(a) => {
                  const val = Number(a.value ?? 0);
                  const safe = isNaN(val) ? 0 : Math.max(0, Math.min(100, val));
                  setInv(p => recompute({ ...p, summary: { ...p.summary, discountPct: safe } }));
                }}
                aria-label="Discount"
              />
            </div>
            <div className="summary-total">Total Amount: <span className="amount">{cfmt(inv.summary.total)}</span></div>
          </div>
        </div>
        <div className="footer-actions">
          <ButtonComponent cssClass="e-outline" iconCss="e-icons e-image" onClick={onPreview}>Preview</ButtonComponent>
          <ButtonComponent cssClass="e-outline" iconCss="e-icons e-export" onClick={onExcelExport}>Excel Export</ButtonComponent>
          <ButtonComponent cssClass="e-primary" iconCss="e-icons e-download" onClick={onGeneratePdf}>Generate PDF</ButtonComponent>
        </div>

        <ToastComponent ref={toastRef} position={{ X: 'Right', Y: 'Bottom' }} />

        {/* Preview Modal Dialog - displays InvoicePreview component */}
        {showPreviewModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowPreviewModal(false)
              }
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
                width: '95%',
                height: '95%',
                maxWidth: '1200px',
                maxHeight: '900px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with controls */}
              <div
                style={{
                  padding: '16px 20px',
                  backgroundColor: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                  Invoice Preview
                </h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      setShowPreviewModal(false)
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#e5e7eb',
                      color: '#1f2937',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#d1d5db')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e5e7eb')}
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Content area - displays InvoicePreview component */}
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <InvoicePreview
                  invoice={inv}
                  currency={currency}
                  status={status}
                  logoUrl={logoUrl}
                  title={headerTitle}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App

