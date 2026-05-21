#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const requiredFiles = [
  "public/artifacts/deployment/heating_load_model.onnx",
  "public/artifacts/deployment/cooling_load_model.onnx",
  "public/artifacts/deployment/preprocessing_schema.json",
  "public/artifacts/deployment/deployment_manifest.json"
];

const requiredDirs = [
  "public/artifacts/ort-wasm"
];

let hasError = false;

for (const file of requiredFiles) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    console.error(`Missing required file: ${file}`);
    hasError = true;
  }
}

for (const dir of requiredDirs) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(`Missing required directory: ${dir}`);
    hasError = true;
  }
}

const wasmDir = "public/artifacts/ort-wasm";
const wasmFiles = fs.existsSync(wasmDir)
  ? fs.readdirSync(wasmDir).filter((file) => file.endsWith(".wasm") || file.endsWith(".mjs"))
  : [];

if (!wasmFiles.length) {
  console.error(`Missing ONNX Runtime Web files in ${wasmDir}. Run npm run copy:ort.`);
  hasError = true;
}

if (hasError) {
  console.error(`
Expected artifact layout:
public/artifacts/deployment/heating_load_model.onnx
public/artifacts/deployment/cooling_load_model.onnx
public/artifacts/deployment/preprocessing_schema.json
public/artifacts/deployment/deployment_manifest.json
public/artifacts/ort-wasm/*.wasm
public/artifacts/ort-wasm/*.mjs
`);
  process.exit(1);
}

console.log("Deployment artifacts look good:");
for (const file of requiredFiles) {
  console.log(`- ${file}`);
}
console.log(`- ${wasmDir} (${wasmFiles.length} runtime file(s))`);