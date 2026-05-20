import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths keep the production build portable for GitHub Pages,
  // Netlify, local file serving, and nested static hosting.
  base: "./",
  server: {
    port: 5173,
    strictPort: false
  },
  optimizeDeps: {
    // ONNX Runtime Web loads wasm/helper .mjs files dynamically. Vite's dep
    // optimizer can rewrite those dynamic paths into node_modules/.vite/deps,
    // which is what causes missing paths like:
    // node_modules/.vite/deps/artifacts/ort-wasm/ort-wasm-simd-threaded.jsep.mjs
    exclude: ["onnxruntime-web"]
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
    commonjsOptions: {
      transformMixedEsModules: true
    }
  }
});
