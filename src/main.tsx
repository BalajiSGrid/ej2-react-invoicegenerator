import { createRoot, type Root } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Ensure we don't create multiple React roots during Vite HMR (which can cause DOM removeChild errors)
const container = document.getElementById('root') as HTMLElement

// Cache the root on window to preserve a single root across HMR updates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyWindow = window as any
let root: Root = anyWindow.__appRoot
if (!root) {
  root = createRoot(container)
  anyWindow.__appRoot = root
}

root.render(<App />)

if (import.meta && import.meta.hot) {
  import.meta.hot.dispose(() => {
    // optional: cleanup on full dispose
    // root.unmount();
  })
}
