import { createRoot } from 'react-dom/client'
import './index.css'
import InvoicePreview from './InvoicePreview.tsx'

const container = document.getElementById('preview-root') as HTMLElement
const root = createRoot(container)
root.render(<InvoicePreview invoice={{} as any} currency={{} as any} status="Draft" logoUrl={null} />)
