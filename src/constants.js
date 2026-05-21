export const APP_TITLE = "Building Energy Design Explorer";

export const PROJECT_SUMMARY =
  "Explore heating and cooling load tradeoffs from early building-design inputs using compact neural surrogate models that run locally in the browser.";

export const PROJECT_SUMMARY2 =
  "This demo is not a definitive energy analysis tool, but it shows how production surrogate models can support fast early-stage screening, lead verification, and what-if exploration before deeper simulation or professional review.";

export const APP_BASE_URL = import.meta.env?.BASE_URL || "./";
export const ARTIFACT_ROOT = `${APP_BASE_URL}artifacts`;
export const DEPLOYMENT_ARTIFACT_DIR = `${ARTIFACT_ROOT}/deployment`;

export const HEATING_MODEL_PATH = `${DEPLOYMENT_ARTIFACT_DIR}/heating_load_model.onnx`;
export const COOLING_MODEL_PATH = `${DEPLOYMENT_ARTIFACT_DIR}/cooling_load_model.onnx`;
export const PREPROCESSING_SCHEMA_PATH = `${DEPLOYMENT_ARTIFACT_DIR}/preprocessing_schema.json`;
export const DEPLOYMENT_MANIFEST_PATH = `${DEPLOYMENT_ARTIFACT_DIR}/deployment_manifest.json`;
export const EXAMPLE_INPUTS_PATH = `${APP_BASE_URL}example_inputs.json`;

export const ORT_WASM_PATH = `${APP_BASE_URL}artifacts/ort-wasm/`;
export const ORT_WASM_FALLBACK_PATHS = [ORT_WASM_PATH];

export const EXPECTED_MODEL_MODE = "dedicated_single_target_pair";
export const TARGET_COLUMNS = ["HeatingLoad", "CoolingLoad"];
export const OUTPUT_MODE = "building_energy_multi_output_regression";
export const OUTPUT_LABEL = "Estimated load";
export const FORM_TITLE = "Building design inputs";
export const FORM_HELP = "Enter an early design profile, or load a representative example.";
export const RUN_BUTTON_LABEL = "Estimate loads";
export const EMPTY_RESULT_TITLE = "No estimate yet";
export const EMPTY_RESULT_COPY = "Run local inference to estimate heating load, cooling load, total load, and balance.";

export const NUMERIC_COLUMNS = [
  "RelativeCompactness",
  "SurfaceArea",
  "WallArea",
  "RoofArea",
  "OverallHeight",
  "Orientation",
  "GlazingArea",
  "GlazingAreaDistribution"
];

export const GEOMETRY_FIELDS = ["SurfaceArea", "WallArea", "RoofArea", "OverallHeight"];
export const CONTINUOUS_FIELDS = [
  "RelativeCompactness",
  "SurfaceArea",
  "WallArea",
  "RoofArea",
  "OverallHeight",
  "GlazingArea"
];
export const CATEGORICAL_DESIGN_FIELDS = ["Orientation", "GlazingAreaDistribution"];

export const CATEGORICAL_COLUMNS = [];
export const FALLBACK_CATEGORIES = {};

export const DEFAULT_INPUTS = {
  RelativeCompactness: 0.76,
  SurfaceArea: 661.5,
  WallArea: 416.5,
  RoofArea: 122.5,
  OverallHeight: 7.0,
  Orientation: 3,
  GlazingArea: 0.25,
  GlazingAreaDistribution: 3
};

// Observed values from the source simulation dataset. Categorical fields stay on
// these observed enumerations. Continuous fields can use these as anchors, but
// the UI and candidate generator may also probe interpolated values.
export const DESIGN_VALUE_SETS = {
  RelativeCompactness: [0.62, 0.64, 0.66, 0.69, 0.71, 0.74, 0.76, 0.79, 0.82, 0.86, 0.9, 0.98],
  SurfaceArea: [514.5, 563.5, 588.0, 612.5, 637.0, 661.5, 686.0, 710.5, 735.0, 759.5, 784.0, 808.5],
  WallArea: [245.0, 269.5, 294.0, 318.5, 343.0, 367.5, 416.5],
  RoofArea: [110.25, 122.5, 147.0, 220.5],
  OverallHeight: [3.5, 7.0],
  Orientation: [2, 3, 4, 5],
  GlazingArea: [0.0, 0.1, 0.25, 0.4],
  GlazingAreaDistribution: [0, 1, 2, 3, 4, 5]
};

export const DESIGN_BOUNDS = {
  RelativeCompactness: { min: 0.62, max: 0.98, step: 0.02, sweepStep: 0.04, alternativeStep: 0.02 },
  SurfaceArea: { min: 514.5, max: 808.5, step: 0.5, sweepStep: 24.5, alternativeStep: 24.5 },
  WallArea: { min: 245.0, max: 416.5, step: 0.5, sweepStep: 24.5, alternativeStep: 24.5 },
  RoofArea: { min: 110.25, max: 220.5, step: 0.25, sweepStep: 12.25, alternativeStep: 12.25 },
  OverallHeight: { min: 3.5, max: 7.0, step: 0.1, sweepStep: 0.5, alternativeStep: 0.5 },
  // The original dataset used 0.00, 0.10, 0.25, and 0.40. This wider
  // 0-1 range is intentionally available as an extrapolative what-if probe.
  GlazingArea: { min: 0, max: 1, step: 0.01, sweepStep: 0.1, alternativeStep: 0.05 }
};

export const GEOMETRY_VALIDATION = {
  surfaceAreaTolerance: 2.0,
  wallLowerBoundTolerance: 2.0
};

export const PROJECT_LINKS = {
  webRepo: "https://github.com/YOUR_USERNAME/rml-building-energy-design-explorer",
  trainingRepo: "https://github.com/YOUR_USERNAME/rml-building-energy-training",
  githubProfile: "https://github.com/YOUR_USERNAME"
};

export const REQUIRED_DEPLOYMENT_FILES = [
  { label: "Heating load ONNX model", path: HEATING_MODEL_PATH, required: true, source: "Exported dedicated Tiny HeatingLoad model." },
  { label: "Cooling load ONNX model", path: COOLING_MODEL_PATH, required: true, source: "Exported dedicated Tiny CoolingLoad model." },
  { label: "Preprocessing schema", path: PREPROCESSING_SCHEMA_PATH, required: true, source: "Exported from the fitted training preprocessor." },
  { label: "Deployment manifest", path: DEPLOYMENT_MANIFEST_PATH, required: true, source: "Metadata exported by the training repository." },
  { label: "ONNX Runtime Web wasm files", path: ORT_WASM_PATH, required: true, source: "Created by npm run copy:ort." }
];

export const FALLBACK_EXAMPLES = [
  {
    id: "reference-baseline",
    label: "Reference baseline",
    description: "A mid-range simulated design profile for first-load checks.",
    inputs: DEFAULT_INPUTS
  },
  {
    id: "compact-low-glazing",
    label: "Compact low-glazing",
    description: "Compact, tall profile with limited glazing.",
    inputs: {
      RelativeCompactness: 0.9,
      SurfaceArea: 563.5,
      WallArea: 318.5,
      RoofArea: 122.5,
      OverallHeight: 7.0,
      Orientation: 2,
      GlazingArea: 0.1,
      GlazingAreaDistribution: 2
    }
  },
  {
    id: "high-glazing",
    label: "High-glazing design",
    description: "Higher glazing fraction for exploring thermal tradeoffs.",
    inputs: {
      RelativeCompactness: 0.76,
      SurfaceArea: 661.5,
      WallArea: 416.5,
      RoofArea: 122.5,
      OverallHeight: 7.0,
      Orientation: 5,
      GlazingArea: 0.4,
      GlazingAreaDistribution: 5
    }
  },
  {
    id: "low-rise-wide",
    label: "Low-rise wider shell",
    description: "Shorter profile with larger surface and roof area.",
    inputs: {
      RelativeCompactness: 0.64,
      SurfaceArea: 784.0,
      WallArea: 343.0,
      RoofArea: 220.5,
      OverallHeight: 3.5,
      Orientation: 3,
      GlazingArea: 0.25,
      GlazingAreaDistribution: 3
    }
  }
];

export const RESPONSIBLE_USE_COPY =
  "This app is a surrogate-model decision-support demo for rapid screening, comparison, and early design exploration. The estimates can help prioritize designs for deeper review, but they should be verified with appropriate engineering analysis and qualified human judgment before being used for certification, HVAC sizing, code compliance, permitting, or other final decisions. User-entered values stay in the browser for local inference; this app does not collect, store, or transmit user input.";

export const MODEL_FACTS = [
  "Dedicated Tiny neural nets for heating and cooling load",
  "Runs local ONNX inference in the browser",
  "Runs instantaneous local sensitivity sweeps and design what-if checks",
  "Uses constrained candidate search for plausible geometric combinations",
  "No user-entered data is collected, stored, or transmitted"
];

export const OBJECTIVES = [
  { value: "totalLoad", label: "Minimize total load" },
  { value: "heatingLoad", label: "Minimize heating load" },
  { value: "coolingLoad", label: "Minimize cooling load" },
  { value: "balanceAbs", label: "Balance heating/cooling" }
];
