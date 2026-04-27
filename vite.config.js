import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Embedder-Policy": "unsafe-none"
    }
  },
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.ag']
  },
  plugins: [
    {
      name: 'handle-ag-files',
      transform(code, id) {
        if (id.endsWith('.ag')) {
          return {
            code,
            map: null
          };
        }
      }
    }
  ]
});
