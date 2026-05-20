import * as ort from "onnxruntime-web/wasm";
import { MODEL_PATH, ORT_WASM_FALLBACK_PATHS, ORT_WASM_PATH, OUTPUT_MODE } from "./constants.js";

let cachedSession = null;
let activeWasmPath = null;

ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;
ort.env.wasm.proxy = false;

function toAbsoluteUrl(path) {
  return new URL(path, window.location.href).href;
}

function normalizeWasmPath(path) {
  const absolute = toAbsoluteUrl(path);
  return absolute.endsWith("/") ? absolute : `${absolute}/`;
}

export async function loadModel(path = MODEL_PATH) {
  if (cachedSession) return cachedSession;

  const modelUrl = toAbsoluteUrl(path);
  const errors = [];

  for (const wasmPath of ORT_WASM_FALLBACK_PATHS) {
    const normalizedWasmPath = normalizeWasmPath(wasmPath);
    try {
      ort.env.wasm.wasmPaths = normalizedWasmPath;

      const session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all"
      });

      cachedSession = session;
      activeWasmPath = normalizedWasmPath;
      return cachedSession;
    } catch (error) {
      errors.push(`${normalizedWasmPath}: ${error?.message || String(error)}`);
    }
  }

  throw new Error(
    [
      `Could not load ONNX model at ${modelUrl}.`,
      `Expected wasm files at ${ORT_WASM_PATH}.`,
      "Run npm run copy:ort after npm install, then fully reload the browser.",
      "Confirm public/artifacts/deployment/best_model.onnx exists and is not a placeholder.",
      `Loader attempts: ${errors.join(" | ")}`
    ].join(" ")
  );
}

export function getModelRuntimeInfo(session = cachedSession) {
  return {
    loaded: Boolean(session),
    activeWasmPath,
    inputNames: session?.inputNames || [],
    outputNames: session?.outputNames || []
  };
}

export function clearModelCache() {
  cachedSession = null;
  activeWasmPath = null;
}

export async function predict(preprocessedVector, session) {
  const activeSession = session || (await loadModel());
  const inputName = activeSession.inputNames[0];
  const outputName = activeSession.outputNames[0];

  if (!inputName || !outputName) {
    throw new Error("ONNX session did not expose input/output names.");
  }

  const vector = preprocessedVector instanceof Float32Array
    ? preprocessedVector
    : Float32Array.from(preprocessedVector);

  const inputTensor = new ort.Tensor("float32", vector, [1, vector.length]);
  const outputs = await activeSession.run({ [inputName]: inputTensor });
  const output = outputs[outputName] || Object.values(outputs)[0];
  const values = Array.from(output?.data || []);

  if (!values.length || values.some((value) => !Number.isFinite(value))) {
    throw new Error("Model inference did not return finite output values.");
  }

  if (OUTPUT_MODE === "binary_classification") {
    const logit = values[0];
    return { values, logit, probability: sigmoid(logit) };
  }

  return { values };
}

export function sigmoid(logit) {
  if (logit >= 0) {
    const z = Math.exp(-logit);
    return 1 / (1 + z);
  }
  const z = Math.exp(logit);
  return z / (1 + z);
}
