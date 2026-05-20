export const APP_TITLE = "Minimal Deployable ML Demo";

export const PROJECT_SUMMARY =
  "A static browser app that runs a compact machine-learning model locally from exported deployment artifacts.";

export const PROJECT_SUMMARY2 =
  "Use this template for portfolio demos where the training repository owns modeling/export and this web app consumes ONNX plus preprocessing metadata.";

export const APP_BASE_URL = import.meta.env.BASE_URL || "./";
export const ARTIFACT_ROOT = `${APP_BASE_URL}artifacts`;
export const DEPLOYMENT_ARTIFACT_DIR = `${ARTIFACT_ROOT}/deployment`;

export const MODEL_PATH = `${DEPLOYMENT_ARTIFACT_DIR}/best_model.onnx`;
export const PREPROCESSING_SCHEMA_PATH = `${DEPLOYMENT_ARTIFACT_DIR}/preprocessing_schema.json`;
export const DEPLOYMENT_MANIFEST_PATH = `${DEPLOYMENT_ARTIFACT_DIR}/deployment_manifest.json`;
export const EXAMPLE_INPUTS_PATH = `${APP_BASE_URL}example_inputs.json`;

export const ORT_WASM_PATH = `${APP_BASE_URL}artifacts/ort-wasm/`;
export const ORT_WASM_FALLBACK_PATHS = [ORT_WASM_PATH];

export const PROJECT_LINKS = {
  webRepo: "https://github.com/YOUR_USERNAME/YOUR_WEB_APP_REPO",
  trainingRepo: "https://github.com/YOUR_USERNAME/YOUR_TRAINING_REPO",
  githubProfile: "https://github.com/YOUR_USERNAME"
};

export const REQUIRED_DEPLOYMENT_FILES = [
  {
    label: "ONNX model",
    path: MODEL_PATH,
    required: true,
    source: "Exported by the training repository."
  },
  {
    label: "Preprocessing schema",
    path: PREPROCESSING_SCHEMA_PATH,
    required: true,
    source: "Exported from the fitted training preprocessing pipeline."
  },
  {
    label: "Deployment manifest",
    path: DEPLOYMENT_MANIFEST_PATH,
    required: false,
    source: "Metadata exported by the training repository."
  },
  {
    label: "ONNX Runtime Web wasm files",
    path: ORT_WASM_PATH,
    required: true,
    source: "Created by npm run copy:ort."
  }
];

// Template defaults. Replace these for each project, and keep them aligned with
// public/artifacts/deployment/preprocessing_schema.json.
export const TARGET_NAME = "prediction";
export const OUTPUT_MODE = "binary_classification"; // binary_classification | regression | multi_output_regression
export const OUTPUT_LABEL = "Estimated probability";
export const FORM_TITLE = "Input features";
export const FORM_HELP = "Enter feature values, or load a quick example.";
export const RUN_BUTTON_LABEL = "Run local inference";
export const EMPTY_RESULT_TITLE = "No prediction yet";
export const EMPTY_RESULT_COPY = "Run the model to see an estimate and plain-language interpretation.";

export const NUMERIC_COLUMNS = ["FeatureA", "FeatureB"];
export const CATEGORICAL_COLUMNS = ["Category"];
export const FALLBACK_CATEGORIES = {
  Category: ["A", "B"]
};

export const DEFAULT_INPUTS = {
  FeatureA: 0,
  FeatureB: 0,
  Category: "A"
};

export const FALLBACK_EXAMPLES = [
  {
    id: "baseline",
    label: "Baseline example",
    description: "A neutral placeholder profile for checking that the app loads.",
    inputs: {
      FeatureA: 0,
      FeatureB: 0,
      Category: "A"
    }
  }
];

export const RESPONSIBLE_USE_COPY =
  "Educational portfolio demo only. User-entered values stay in the browser for local inference; this app does not collect, store, or transmit user input. Do not use this app for production decisions without independent validation, monitoring, privacy review, security review, and domain-specific approval.";

export const MODEL_FACTS = [
  "Local browser inference: no backend and no API keys",
  "No user-entered data is collected, stored, or transmitted",
  "Consumes ONNX + preprocessing schema from the training repo",
  "Runs entirely from static files after artifacts are copied",
  "Diagnostics are available but collapsed by default"
];
