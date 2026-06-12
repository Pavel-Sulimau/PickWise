import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const CSP_CONNECT_SRC_PRODUCTION = "'self'";
const CSP_CONNECT_SRC_DEVELOPMENT = "'self' ws: wss:";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: './',
  plugins: [
    react(),
    {
      name: 'fortula-csp-connect-src',
      transformIndexHtml(html) {
        const connectSrc =
          command === 'serve'
            ? CSP_CONNECT_SRC_DEVELOPMENT
            : CSP_CONNECT_SRC_PRODUCTION;

        return html.replace('__CSP_CONNECT_SRC__', connectSrc);
      },
    },
  ],
}));
