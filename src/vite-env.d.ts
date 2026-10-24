/// <reference types="vite/client" />

// Vite worker imports (used for the lazy-loaded pdf.js worker)
declare module '*?worker' {
  const workerConstructor: { new (): Worker }
  export default workerConstructor
}
