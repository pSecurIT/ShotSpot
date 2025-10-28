/// <reference types="vite/client" />
/// <reference types="node" />

// Global variable declarations
declare global {
  var process: NodeJS.Process;
  var global: typeof globalThis;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}