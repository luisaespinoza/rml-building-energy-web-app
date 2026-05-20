# Minimal Deployable ML Web App Template

Reusable static browser app template for portfolio ML projects that run local inference from exported deployment artifacts.

This repo is the deployment half of a two-repository pattern:

1. **Training repo**: loads data, trains/evaluates models, selects the deployment model, exports ONNX plus preprocessing metadata.
2. **Web app repo**: serves a static browser UI, loads exported artifacts, performs local inference, and communicates the demo clearly.

The web app does **not** train models, convert PyTorch checkpoints, call an API, require a backend, or use paid hosted inference.

## Replace these placeholders

Search the repo for:

```text
YOUR_USERNAME
YOUR_WEB_APP_REPO
YOUR_TRAINING_REPO
Minimal Deployable ML Demo
FeatureA
FeatureB
Category
```

Then update:

```text
src/constants.js
src/inputs.js
src/interpretation.js
public/example_inputs.json
README.md
```

## Required deployment artifacts

Copy these from the paired training repository:

```text
public/artifacts/deployment/best_model.onnx
public/artifacts/deployment/preprocessing_schema.json
public/artifacts/deployment/deployment_manifest.json
```

The preprocessing schema must contain the train-fitted preprocessing metadata needed to recreate the model input vector in the browser. At minimum, use explicit numeric means/scales, categorical categories, feature order, and input dimension.

## Expected schema shape

```json
{
  "input_dim": 3,
  "numeric_features": ["FeatureA", "FeatureB"],
  "categorical_features": ["Category"],
  "numeric_means": {
    "FeatureA": 0.0,
    "FeatureB": 0.0
  },
  "numeric_scales": {
    "FeatureA": 1.0,
    "FeatureB": 1.0
  },
  "categories": {
    "Category": ["A", "B"]
  },
  "feature_names_out": ["FeatureA", "FeatureB", "Category_A", "Category_B"]
}
```

The template also supports several common alternative key names, but future projects should standardize around explicit names.

## Setup

```bash
npm install
npm run copy:ort
npm run check:artifacts
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

This template includes a GitHub Actions workflow at:

```text
.github/workflows/deploy.yml
```

In the GitHub repository settings, set:

```text
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

## Customization guide

### `src/constants.js`

Project title, summary, artifact paths, links, feature names, output mode, and responsible-use copy.

Supported output modes:

```text
binary_classification
regression
multi_output_regression
```

### `src/inputs.js`

Form fields, labels, defaults, validation ranges, and coercion logic.

### `src/interpretation.js`

Plain-language interpretation of model outputs. Customize this per domain.

### `src/preprocessing.js`

Browser reconstruction of numeric standardization and one-hot encoding from `preprocessing_schema.json`.

### `src/model.js`

ONNX Runtime Web loading and inference.

### `public/example_inputs.json`

Quick examples shown in the app.

## Responsible use

This template is designed for educational/portfolio demos. User-entered values stay in the browser for local inference. The app does not collect, store, or transmit user input. Do not use a project built from this template for production decisions without independent validation, monitoring, privacy review, security review, and domain-specific approval.

## Template checklist

Before publishing a derived project:

- [ ] Replace placeholder copy and repo links.
- [ ] Update input fields and example inputs.
- [ ] Export and copy `best_model.onnx`.
- [ ] Export and copy `preprocessing_schema.json`.
- [ ] Add `deployment_manifest.json`.
- [ ] Run `npm run copy:ort`.
- [ ] Run `npm run check:artifacts`.
- [ ] Run `npm run build`.
- [ ] Confirm the app displays plausible predictions.
- [ ] Confirm diagnostics show expected input vector length.
- [ ] Add domain-specific responsible-use caveats.
