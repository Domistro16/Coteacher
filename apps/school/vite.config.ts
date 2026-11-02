import { defineConfig } from "vite";
import { deliveryProxy } from "../delivery-proxy";
export default defineConfig(({ mode }) => ({
  publicDir: "../student/public",
  server: {
    host: "127.0.0.1",
    port: 5175,
    strictPort: true,
    proxy: deliveryProxy(mode),
  },
  preview: { proxy: deliveryProxy(mode) },
}));
