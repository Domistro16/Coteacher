import { defineConfig } from 'vite';
import { deliveryProxy } from '../delivery-proxy';

export default defineConfig(({ mode }) => ({
  server: { host: '127.0.0.1', port: 5174, strictPort: true, proxy: deliveryProxy(mode, true) },
  preview: { proxy: deliveryProxy(mode, true) },
}));
