# Deployment artifacts

Copy exported artifacts from the paired training repository into this folder.

Required:

```text
best_model.onnx
preprocessing_schema.json
```

Optional but recommended:

```text
deployment_manifest.json
```

Do not commit raw training checkpoints here unless the project intentionally needs them. This web app should consume browser-ready deployment artifacts only.
