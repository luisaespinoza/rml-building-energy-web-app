# Building Energy Design Explorer web app refactor

Copy the files in `src/` into the Vite app's `src/` directory. Copy `example_inputs.json` into `public/example_inputs.json`.

Expected deployment artifacts:

```text
public/artifacts/deployment/heating_load_model.onnx
public/artifacts/deployment/cooling_load_model.onnx
public/artifacts/deployment/preprocessing_schema.json
public/artifacts/deployment/deployment_manifest.json
public/artifacts/ort-wasm/
```

This refactor replaces the generic single-model template with a dedicated Tiny pair runtime, then adds estimate, sensitivity, alternatives, and diagnostics modes.
