# Template Cleanup Checklist

Use this when converting a completed web app back into a reusable template.

## Remove project-specific content

- [ ] Domain-specific title, summary, and responsible-use language
- [ ] Dataset-specific feature names and examples
- [ ] Live project links
- [ ] Model-specific output labels and interpretation language
- [ ] Actual deployed ONNX model unless intentionally publishing as an example
- [ ] Actual preprocessing schema unless intentionally publishing as an example
- [ ] Reports, screenshots, or generated build outputs

## Keep reusable structure

- [ ] Static Vite setup
- [ ] ONNX Runtime Web import and wasm copy script
- [ ] Artifact check script
- [ ] `public/artifacts/deployment/` layout
- [ ] `public/artifacts/ort-wasm/` layout
- [ ] Schema-driven preprocessing loader
- [ ] Collapsed runtime diagnostics
- [ ] Responsible-use placeholder
- [ ] GitHub Pages workflow

## Verify template usability

- [ ] `npm install` works
- [ ] `npm run copy:ort` works
- [ ] `npm run build` works before artifacts are added
- [ ] `npm run check:artifacts` fails clearly before artifacts are added
- [ ] README explains exactly what to replace
