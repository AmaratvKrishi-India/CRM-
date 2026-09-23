import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export const PRODUCTION_CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests";
export const DEVELOPMENT_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:15432 ws://127.0.0.1:15432 http://localhost:54321 ws://localhost:54321; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

function cspMetaPlugin() {
  const buildPolicy = process.env.VITE_APP_ENV === 'local-test' ? DEVELOPMENT_CSP : PRODUCTION_CSP;
  return {
    name: 'html-csp-policy',
    transformIndexHtml(html: string, ctx: { server?: unknown }) {
      if (ctx.server) return html;
      const escaped = buildPolicy.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      return html.replace(
        /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*("\s*\/?>)/i,
        `$1${escaped}$2`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cspMetaPlugin()],
  server: { port: 3000, host: true, warmup: { clientFiles: ['./src/main.tsx'] } },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/read-excel-file') || id.includes('node_modules/papaparse')) return 'vendor-spreadsheet';
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
          if (id.includes('node_modules/dexie')) return 'vendor-dexie';
          if (id.includes('node_modules/lucide-react')) return 'vendor-lucide';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor-react';
        },
      },
    },
  },
});
