import * as ort from "onnxruntime-web/wasm";
import {
  COOLING_MODEL_PATH,
  DEPLOYMENT_MANIFEST_PATH,
  EXPECTED_MODEL_MODE,
  HEATING_MODEL_PATH,
  ORT_WASM_FALLBACK_PATHS,
  ORT_WASM_PATH,
  TARGET_COLUMNS
} from "./constants.js";

let cachedRuntime = null;
let cachedManifest = null;
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

export async function loadDeploymentManifest(path = DEPLOYMENT_MANIFEST_PATH) {
  if (cachedManifest) return cachedManifest;
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  cachedManifest = await response.json();
  validateManifest(cachedManifest);
  return cachedManifest;
}

function validateManifest(manifest) {
  const mode = manifest?.model_mode || manifest?.mode;
  if (mode && mode !== EXPECTED_MODEL_MODE) {
    throw new Error(`Unsupported deployment manifest model_mode '${mode}'. Expected '${EXPECTED_MODEL_MODE}'.`);
  }

  const targets = manifest?.target_columns || TARGET_COLUMNS;
  if (!Array.isArray(targets) || targets[0] !== TARGET_COLUMNS[0] || targets[1] !== TARGET_COLUMNS[1]) {
    throw new Error(`Deployment manifest target_columns must be [${TARGET_COLUMNS.join(", ")}].`);
  }
}

export async function loadModel() {
  if (cachedRuntime) return cachedRuntime;
  const manifest = await loadDeploymentManifest().catch(() => null);

  const paths = resolveModelPaths(manifest);
  const errors = [];

  for (const wasmPath of ORT_WASM_FALLBACK_PATHS) {
    const normalizedWasmPath = normalizeWasmPath(wasmPath);
    try {
      ort.env.wasm.wasmPaths = normalizedWasmPath;
      const [heatingSession, coolingSession] = await Promise.all([
        createSession(paths.heating),
        createSession(paths.cooling)
      ]);
      activeWasmPath = normalizedWasmPath;
      cachedRuntime = { mode: EXPECTED_MODEL_MODE, paths, heatingSession, coolingSession, manifest };
      return cachedRuntime;
    } catch (error) {
      errors.push(`${normalizedWasmPath}: ${error?.message || String(error)}`);
    }
  }

  throw new Error(
    [
      "Could not load dedicated ONNX model pair.",
      `Expected models at ${HEATING_MODEL_PATH} and ${COOLING_MODEL_PATH}.`,
      `Expected wasm files at ${ORT_WASM_PATH}.`,
      "Run npm run copy:ort after npm install, then fully reload the browser.",
      `Loader attempts: ${errors.join(" | ")}`
    ].join(" ")
  );
}

function resolveModelPaths(manifest) {
  const artifactMap = manifest?.artifacts || manifest?.model_artifacts || {};
  return {
    heating: artifactMap.HeatingLoad || artifactMap.heating || artifactMap.heating_load_model || HEATING_MODEL_PATH,
    cooling: artifactMap.CoolingLoad || artifactMap.cooling || artifactMap.cooling_load_model || COOLING_MODEL_PATH
  };
}

async function createSession(path) {
  return ort.InferenceSession.create(toAbsoluteUrl(path), {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all"
  });
}

export function getModelRuntimeInfo(runtime = cachedRuntime) {
  return {
    loaded: Boolean(runtime?.heatingSession && runtime?.coolingSession),
    mode: runtime?.mode || EXPECTED_MODEL_MODE,
    activeWasmPath,
    modelPaths: runtime?.paths || { heating: HEATING_MODEL_PATH, cooling: COOLING_MODEL_PATH },
    heatingInputNames: runtime?.heatingSession?.inputNames || [],
    heatingOutputNames: runtime?.heatingSession?.outputNames || [],
    coolingInputNames: runtime?.coolingSession?.inputNames || [],
    coolingOutputNames: runtime?.coolingSession?.outputNames || []
  };
}

export function clearModelCache() {
  cachedRuntime = null;
  cachedManifest = null;
  activeWasmPath = null;
}

export async function predict(preprocessedVector, runtime) {
  const activeRuntime = runtime || (await loadModel());
  const [heatingLoad, coolingLoad] = await Promise.all([
    runSingleTarget(activeRuntime.heatingSession, preprocessedVector),
    runSingleTarget(activeRuntime.coolingSession, preprocessedVector)
  ]);

  if (![heatingLoad, coolingLoad].every(Number.isFinite)) {
    throw new Error("Model inference did not return finite heating/cooling load values.");
  }

  return {
    heatingLoad,
    coolingLoad,
    totalLoad: heatingLoad + coolingLoad,
    balance: heatingLoad - coolingLoad,
    values: [heatingLoad, coolingLoad]
  };
}

async function runSingleTarget(session, preprocessedVector) {
  const inputName = session?.inputNames?.[0];
  const outputName = session?.outputNames?.[0];
  if (!inputName || !outputName) throw new Error("ONNX session did not expose input/output names.");

  const vector = preprocessedVector instanceof Float32Array ? preprocessedVector : Float32Array.from(preprocessedVector);
  const inputTensor = new ort.Tensor("float32", vector, [1, vector.length]);
  const outputs = await session.run({ [inputName]: inputTensor });
  const output = outputs[outputName] || Object.values(outputs)[0];
  const value = Number(output?.data?.[0]);
  if (!Number.isFinite(value)) throw new Error("Single-target ONNX model returned a non-finite value.");
  return value;
}
