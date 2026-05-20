const fs = require("fs");
const path = require("path");

const src = path.join("node_modules", "onnxruntime-web", "dist");
const dst = path.join("public", "artifacts", "ort-wasm");
const legacyDst = path.join("public", "ort-wasm");

if (!fs.existsSync(src)) {
  throw new Error("onnxruntime-web/dist was not found. Run npm install first.");
}

fs.mkdirSync(dst, { recursive: true });
fs.mkdirSync(legacyDst, { recursive: true });

let copied = 0;
for (const file of fs.readdirSync(src)) {
  if (file.endsWith(".wasm") || file.endsWith(".mjs")) {
    fs.copyFileSync(path.join(src, file), path.join(dst, file));
    fs.copyFileSync(path.join(src, file), path.join(legacyDst, file));
    copied += 1;
  }
}

console.log(`Copied ${copied} ONNX Runtime Web file(s) to ${dst} and ${legacyDst}`);
