import {
  APP_TITLE,
  DEPLOYMENT_MANIFEST_PATH,
  EMPTY_RESULT_COPY,
  EMPTY_RESULT_TITLE,
  EXAMPLE_INPUTS_PATH,
  FALLBACK_EXAMPLES,
  FORM_HELP,
  FORM_TITLE,
  MODEL_FACTS,
  OUTPUT_MODE,
  PROJECT_LINKS,
  PROJECT_SUMMARY,
  PROJECT_SUMMARY2,
  RESPONSIBLE_USE_COPY,
  RUN_BUTTON_LABEL
} from "./constants.js";
import { INPUT_FIELDS, coerceFormValue, getInitialInputs } from "./inputs.js";
import { interpretPrediction } from "./interpretation.js";
import { getModelRuntimeInfo, loadModel, predict } from "./model.js";
import { describePreprocessing, loadPreprocessingSchema, preprocessInput } from "./preprocessing.js";

export function createApp(root) {
  const state = {
    inputs: getInitialInputs(),
    schema: null,
    session: null,
    manifest: null,
    loading: true,
    running: false,
    error: "",
    setupWarnings: [],
    examples: FALLBACK_EXAMPLES,
    selectedExampleId: "",
    result: null,
    debug: null
  };

  async function init() {
    render();
    const warnings = [];

    try {
      state.manifest = await loadDeploymentManifest().catch((error) => {
        warnings.push(`Manifest not loaded: ${error.message || String(error)}`);
        return null;
      });

      state.examples = await loadExamples().catch((error) => {
        warnings.push(`Example inputs not loaded: ${error.message || String(error)}`);
        return FALLBACK_EXAMPLES;
      });

      state.schema = await loadPreprocessingSchema();
      state.session = await loadModel();
      state.error = "";
    } catch (error) {
      state.error = error.message || String(error);
    } finally {
      state.setupWarnings = warnings;
      state.loading = false;
      updateDebug();
      render();
    }
  }

  async function loadDeploymentManifest() {
    const response = await fetch(DEPLOYMENT_MANIFEST_PATH, { cache: "no-store" });
    if (!response.ok) throw new Error(`${DEPLOYMENT_MANIFEST_PATH} returned HTTP ${response.status}`);
    return response.json();
  }

  async function loadExamples() {
    const response = await fetch(EXAMPLE_INPUTS_PATH, { cache: "no-store" });
    if (!response.ok) throw new Error(`${EXAMPLE_INPUTS_PATH} returned HTTP ${response.status}`);
    const examples = await response.json();
    if (!Array.isArray(examples)) throw new Error(`${EXAMPLE_INPUTS_PATH} must contain a JSON array.`);
    return examples
      .filter((example) => example && typeof example === "object" && example.inputs)
      .map((example, index) => ({
        id: String(example.id || `example-${index + 1}`),
        label: String(example.label || example.name || `Example ${index + 1}`),
        description: String(example.description || "Load this sample input profile."),
        inputs: normalizeExampleInputs(example.inputs)
      }));
  }

  function normalizeExampleInputs(inputs) {
    const normalized = { ...state.inputs };
    for (const field of INPUT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(inputs, field.name)) {
        normalized[field.name] = coerceFormValue(field, inputs[field.name]);
      }
    }
    return normalized;
  }

  function readInputsFromForm(form) {
    const formData = new FormData(form);
    const nextInputs = { ...state.inputs };
    for (const field of INPUT_FIELDS) {
      nextInputs[field.name] = coerceFormValue(field, formData.get(field.name));
    }
    state.inputs = nextInputs;
    return nextInputs;
  }

  function updateInput(name, value) {
    const field = INPUT_FIELDS.find((item) => item.name === name);
    state.inputs[name] = coerceFormValue(field, value);
    state.selectedExampleId = "";
    state.result = null;
    state.error = "";
    root.querySelectorAll("[data-example-id].selected").forEach((button) => button.classList.remove("selected"));
  }

  function applyExample(exampleId) {
    const example = state.examples.find((item) => item.id === exampleId);
    if (!example) return;
    state.inputs = { ...example.inputs };
    state.selectedExampleId = example.id;
    state.result = null;
    state.error = "";
    updateDebug();
    render();
  }

  async function runPrediction(event) {
    event.preventDefault();
    readInputsFromForm(event.currentTarget);
    state.running = true;
    state.error = "";
    state.result = null;
    render();

    try {
      if (!state.schema) state.schema = await loadPreprocessingSchema();
      if (!state.session) state.session = await loadModel();

      const vector = preprocessInput(state.inputs, state.schema);
      const prediction = await predict(vector, state.session);
      state.result = {
        ...interpretPrediction(prediction),
        rawPrediction: prediction
      };
      updateDebug(vector, prediction);
    } catch (error) {
      state.error = error.message || String(error);
      updateDebug();
    } finally {
      state.running = false;
      render();
    }
  }

  function resetInputs() {
    state.inputs = getInitialInputs();
    state.selectedExampleId = "";
    state.result = null;
    state.error = "";
    updateDebug();
    render();
  }

  function updateDebug(vector = null, prediction = null) {
    const preprocessing = state.schema ? describePreprocessing(state.schema) : null;
    const runtime = getModelRuntimeInfo(state.session);
    state.debug = {
      outputMode: OUTPUT_MODE,
      modelLoaded: runtime.loaded,
      activeWasmPath: runtime.activeWasmPath || "not loaded",
      onnxInputs: runtime.inputNames,
      onnxOutputs: runtime.outputNames,
      vectorLength: vector?.length || preprocessing?.inputLength || null,
      numericColumns: preprocessing?.numericColumns || [],
      categoricalColumns: preprocessing?.categoricalColumns || [],
      categories: preprocessing?.categories || null,
      scalerComplete: preprocessing?.scalerStatus?.complete ?? null,
      scalerDetails: preprocessing?.scalerStatus?.details || [],
      lastPrediction: prediction || null
    };
  }

  function render() {
    root.innerHTML = `
      <main class="page-shell">
        <section class="hero card">
          <p class="eyebrow">Lightweight browser deployment</p>
          <h1>${escapeHtml(APP_TITLE)}</h1>
          <p class="summary">${escapeHtml(PROJECT_SUMMARY)}</p>
          <p class="summary">${escapeHtml(PROJECT_SUMMARY2)}</p>
          <div class="fact-grid">${MODEL_FACTS.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div>
        </section>

        <section class="card estimate-card">
          ${renderStatus()}
          ${renderResult()}
        </section>

        <section class="layout-grid">
          <form class="card input-card" id="prediction-form">
            <div class="section-heading">
              <h2>${escapeHtml(FORM_TITLE)}</h2>
              <p>${escapeHtml(FORM_HELP)}</p>
            </div>
            <div class="field-grid">${INPUT_FIELDS.map(renderField).join("")}</div>
            <div class="button-row">
              <button type="submit" class="primary-button" ${state.loading || state.running ? "disabled" : ""}>
                ${state.running ? "Running..." : escapeHtml(RUN_BUTTON_LABEL)}
              </button>
              <button type="button" class="secondary-button" id="reset-button">Reset</button>
            </div>
          </form>

          <aside class="card result-card">
            ${renderExamples()}
            ${renderModelDetails()}
            ${renderDebug()}
          </aside>
        </section>

        <section class="card caveat-card">
          <h2>Responsible use</h2>
          <p>${escapeHtml(RESPONSIBLE_USE_COPY)}</p>
          ${renderProjectLinks()}
        </section>
      </main>
    `;

    root.querySelector("#prediction-form")?.addEventListener("submit", runPrediction);
    root.querySelector("#reset-button")?.addEventListener("click", resetInputs);
    root.querySelectorAll("[data-example-id]").forEach((button) => button.addEventListener("click", () => applyExample(button.dataset.exampleId)));
    for (const field of INPUT_FIELDS) {
      const element = root.querySelector(`[name="${field.name}"]`);
      element?.addEventListener("input", (event) => updateInput(field.name, event.target.value));
      element?.addEventListener("change", (event) => updateInput(field.name, event.target.value));
    }
  }

  function renderExamples() {
    if (!state.examples.length) return "";
    return `
      <div class="example-panel">
        <div><h3>Quick examples</h3><p>Fill the form with a representative profile, then run local inference.</p></div>
        <div class="example-grid">
          ${state.examples.map((example) => `
            <button type="button" class="example-button ${state.selectedExampleId === example.id ? "selected" : ""}" data-example-id="${escapeHtml(example.id)}">
              <strong>${escapeHtml(example.label)}</strong>
              <span>${escapeHtml(example.description)}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderField(field) {
    const value = state.inputs[field.name];
    if (field.type === "select") {
      return `
        <label class="field">
          <span>${escapeHtml(field.label)}</span>
          <select name="${escapeHtml(field.name)}">
            ${field.options.map((option) => {
              const optionValue = typeof option === "object" ? option.value : option;
              const optionLabel = typeof option === "object" ? option.label : option;
              return `<option value="${escapeHtml(optionValue)}" ${String(optionValue) === String(value) ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`;
            }).join("")}
          </select>
          <small>${escapeHtml(field.help)}</small>
        </label>
      `;
    }

    return `
      <label class="field">
        <span>${escapeHtml(field.label)}</span>
        <input name="${escapeHtml(field.name)}" type="${field.type}" min="${field.min}" max="${field.max}" step="${field.step}" value="${escapeHtml(value)}" />
        <small>${escapeHtml(field.help)}</small>
      </label>
    `;
  }

  function renderStatus() {
    if (state.loading) return `<div class="status">Loading model and preprocessing schema...</div>`;
    if (state.error) return `<div class="status error"><strong>Setup/runtime issue:</strong> ${escapeHtml(state.error)}</div>`;
    const warnings = state.setupWarnings.map((warning) => `<small>${escapeHtml(warning)}</small>`).join("");
    return `<div class="status ready">Ready: model and preprocessing schema loaded.${warnings}</div>`;
  }

  function renderResult() {
    if (!state.result) {
      return `<div class="empty-result"><h2>${escapeHtml(EMPTY_RESULT_TITLE)}</h2><p>${escapeHtml(EMPTY_RESULT_COPY)}</p></div>`;
    }
    return `
      <div class="prediction ${state.result.className}">
        <p class="prediction-label">${escapeHtml(state.result.valueLabel)}</p>
        <strong>${escapeHtml(state.result.valueText)}</strong>
        <h2>${escapeHtml(state.result.label)}</h2>
        <p>${escapeHtml(state.result.summary)}</p>
        <small>${escapeHtml(state.result.caveat)}</small>
        <small class="technical-note">Raw output: ${escapeHtml(JSON.stringify(state.result.rawPrediction))}</small>
      </div>
    `;
  }

  function renderModelDetails() {
    const preprocessing = state.schema ? describePreprocessing(state.schema) : null;
    const manifestModel = state.manifest?.model_name || state.manifest?.selected_model || "best_model.onnx";
    return `
      <details class="model-details collapsible-panel">
        <summary>Deployment details</summary>
        <dl>
          <dt>Model artifact</dt><dd>${escapeHtml(manifestModel)}</dd>
          <dt>Numeric features</dt><dd>${escapeHtml(preprocessing?.numericColumns?.join(", ") || "Waiting for schema")}</dd>
          <dt>Categorical features</dt><dd>${escapeHtml(preprocessing?.categoricalColumns?.join(", ") || "Waiting for schema")}</dd>
          <dt>Input vector length</dt><dd>${escapeHtml(preprocessing?.inputLength || "Derived from schema/model")}</dd>
        </dl>
      </details>
    `;
  }

  function renderProjectLinks() {
    return `
      <div class="project-links">
        <h3>Project links</h3>
        <div class="project-link-grid">
          <p>This is part of a minimal deployable ML portfolio: practical predictive models that can run without backend inference, API keys, or cloud-hosted AI services.</p>
          ${projectLink(PROJECT_LINKS.webRepo, "Web app source", "Static browser deployment")}
          ${projectLink(PROJECT_LINKS.trainingRepo, "Training source", "Model training and export pipeline")}
          ${projectLink(PROJECT_LINKS.githubProfile, "More projects / contact", "GitHub portfolio")}
        </div>
      </div>
    `;
  }

  function projectLink(href, label, subtitle) {
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer" class="project-link"><span class="project-link-icon" aria-hidden="true">${githubIcon()}</span><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(subtitle)}</small></span></a>`;
  }

  function githubIcon() {
    return `<svg viewBox="0 0 24 24" width="18" height="18" role="img" focusable="false"><path fill="currentColor" d="M12 .5A12 12 0 0 0 8.2 23.9c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.4-4-1.4-.5-1.3-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 .1.3 2.6 3.4 1.9.1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0C17.1 6.4 18.1 6.7 18.1 6.7c.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z"/></svg>`;
  }

  function renderDebug() {
    if (!state.debug) return "";
    return `<details class="debug-panel"><summary>Runtime diagnostics</summary><pre>${escapeHtml(JSON.stringify(state.debug, null, 2))}</pre></details>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  init();
}
