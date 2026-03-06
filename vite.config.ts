import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt"],
      manifest: {
        name: "EZHA",
        short_name: "EZHA",
        description: "Smarter meal logging with AI estimates you can edit.",
        theme_color: "#cc3399",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/logo.svg",
            sizes: "512x512",
            type: "image/svg+xml"
          },
          {
            src: "/logo.svg",
            sizes: "512x512",
            type: "image/svg+xml"
          },
          {
            src: "/logo.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.+\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-runtime",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: "module"
      }
    })
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
