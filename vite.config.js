import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  build: {
    rollupOptions: {
      external: [
        /\.\.\/\.\.\/dojo-ghl-connector\//
      ],
      onwarn(warning, defaultHandler) {
        if (warning.code === 'UNRESOLVED_IMPORT') return;
        defaultHandler(warning);
      },
    },
  },
});
