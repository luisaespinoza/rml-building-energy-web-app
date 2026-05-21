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
  OBJECTIVES,
  PROJECT_LINKS,
  PROJECT_SUMMARY,
  PROJECT_SUMMARY2,
  RESPONSIBLE_USE_COPY,
  RUN_BUTTON_LABEL
} from "./constants.js";
import { INPUT_FIELDS, coerceFormValue, getInitialInputs } from "./inputs.js";
import { interpretPrediction, formatLoad, formatSignedLoad, describeChangedFeatures } from "./interpretation.js";
import { getModelRuntimeInfo, loadDeploymentManifest, loadModel, predict } from "./model.js";
import { describePreprocessing, loadPreprocessingSchema, preprocessInput } from "./preprocessing.js";
import { runSensitivityAnalysis } from "./sensitivity.js";
import { findNearbyAlternatives } from "./alternatives.js";
import { validateDesignInputs } from "./designSpace.js";

const MODES = [
  { id: "estimate", label: "Estimate" },
  { id: "sensitivity", label: "Sensitivity" },
  { id: "alternatives", label: "Alternatives" },
  { id: "diagnostics", label: "Diagnostics" }
];

export function createApp(root) {
  const state = {
    mode: "estimate",
    inputs: getInitialInputs(),
    schema: null,
    runtime: null,
    manifest: null,
    loading: true,
    running: false,
    error: "",
    setupWarnings: [],
    examples: FALLBACK_EXAMPLES,
    selectedExampleId: "",
    result: null,
    sensitivity: null,
    alternatives: null,
    objective: OBJECTIVES[0].value,
    sensitivityGranularity: 9,
    debug: null,
    activeInfo: null,
    frozenAlternativeFields: {}
  };

  function openInfoModal(fieldName) {
    const field = INPUT_FIELDS.find((item) => item.name === fieldName);
    if (!field?.info) return;

    state.activeInfo = {
      title: field.label,
      body: field.info,
      help: field.help || ""
    };

    render();
  }

  function closeInfoModal() {
    state.activeInfo = null;
    render();
  }

  function toggleFrozenAlternativeField(name, checked) {
    state.frozenAlternativeFields = {
      ...state.frozenAlternativeFields,
      [name]: checked
    };
    state.alternatives = null;
    state.error = "";
    render();
  }

  function getFrozenAlternativeFields() {
    return Object.entries(state.frozenAlternativeFields)
      .filter(([, isFrozen]) => Boolean(isFrozen))
      .map(([name]) => name);
  }

  async function init() {
    render();
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.activeInfo) closeInfoModal();
    });

    const warnings = [];
    try {
      state.manifest = await loadDeploymentManifest(DEPLOYMENT_MANIFEST_PATH).catch((error) => {
        warnings.push(`Manifest not loaded: ${error.message || String(error)}`);
        return null;
      });
      state.examples = await loadExamples().catch((error) => {
        warnings.push(`Example inputs not loaded: ${error.message || String(error)}`);
        return FALLBACK_EXAMPLES;
      });
      state.schema = await loadPreprocessingSchema();
      state.runtime = await loadModel();
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

  function validateCurrentDesign() {
    const validation = validateDesignInputs(state.inputs);
    if (!validation.valid) {
      throw new Error(`Current design is not geometrically plausible: ${validation.errors.join(" ")}`);
    }
    return validation;
  }

  function setMode(mode) {
    state.mode = mode;
    render();
  }

  function updateInput(name, value) {
    const field = INPUT_FIELDS.find((item) => item.name === name);
    state.inputs[name] = coerceFormValue(field, value);
    state.selectedExampleId = "";
    state.result = null;
    state.sensitivity = null;
    state.alternatives = null;
    state.error = "";
  }

  function applyExample(exampleId) {
    const example = state.examples.find((item) => item.id === exampleId);
    if (!example) return;
    state.inputs = { ...example.inputs };
    state.selectedExampleId = example.id;
    state.result = null;
    state.sensitivity = null;
    state.alternatives = null;
    state.error = "";
    updateDebug();
    render();
  }

  async function ensureRuntime() {
    if (!state.schema) state.schema = await loadPreprocessingSchema();
    if (!state.runtime) state.runtime = await loadModel();
    return { schema: state.schema, runtime: state.runtime };
  }

  async function runPrediction(event) {
    event.preventDefault();
    readInputsFromForm(event.currentTarget);
    await withRun(async () => {
      validateCurrentDesign();
      const { schema, runtime } = await ensureRuntime();
      const vector = preprocessInput(state.inputs, schema);
      const prediction = await predict(vector, runtime);
      state.result = { ...interpretPrediction(prediction), rawPrediction: prediction };
      updateDebug(vector, prediction);
    });
  }

  async function runSensitivity() {
    await withRun(async () => {
      validateCurrentDesign();
      const { schema, runtime } = await ensureRuntime();
      state.sensitivity = await runSensitivityAnalysis(state.inputs, schema, runtime, {
        points: state.sensitivityGranularity
      });
      updateDebug();
    });
  }

  async function runAlternatives() {
    await withRun(async () => {
      const { schema, runtime } = await ensureRuntime();
      const frozenFields = getFrozenAlternativeFields();
      state.alternatives = await findNearbyAlternatives(state.inputs, schema, runtime, {
        objective: state.objective,
        frozenFields
      });
      updateDebug();
    });
  }

  async function withRun(action) {
    state.running = true;
    state.error = "";
    render();
    try {
      await action();
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
    state.sensitivity = null;
    state.alternatives = null;
    state.error = "";
    updateDebug();
    render();
  }

  function updateDebug(vector = null, prediction = null) {
    const preprocessing = state.schema ? describePreprocessing(state.schema) : null;
    const runtime = getModelRuntimeInfo(state.runtime);
    state.debug = {
      modelLoaded: runtime.loaded,
      modelMode: runtime.mode,
      modelPaths: runtime.modelPaths,
      activeWasmPath: runtime.activeWasmPath || "not loaded",
      heatingInputNames: runtime.heatingInputNames,
      heatingOutputNames: runtime.heatingOutputNames,
      coolingInputNames: runtime.coolingInputNames,
      coolingOutputNames: runtime.coolingOutputNames,
      vectorLength: vector?.length || preprocessing?.inputLength || null,
      numericColumns: preprocessing?.numericColumns || [],
      categoricalColumns: preprocessing?.categoricalColumns || [],
      scalerComplete: preprocessing?.scalerStatus?.complete ?? null,
      scalerDetails: preprocessing?.scalerStatus?.details || [],
      manifest: state.manifest || state.runtime?.manifest || null,
      designValidation: validateDesignInputs(state.inputs),
      frozenAlternativeFields: getFrozenAlternativeFields(),
      sensitivityGranularity: state.sensitivityGranularity,
      lastPrediction: prediction || null
    };
  }

  function render() {
    root.innerHTML = `
      <main class="page-shell">
        <section class="hero card">
          <p class="eyebrow">Local browser design exploration</p>
          <h1>${escapeHtml(APP_TITLE)}</h1>
          <p class="summary">${escapeHtml(PROJECT_SUMMARY)}</p>
          <p class="summary">${escapeHtml(PROJECT_SUMMARY2)}</p>
          <div class="fact-grid">${MODEL_FACTS.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div>
        </section>

        <section class="card estimate-card">
          ${renderStatus()}
          ${renderTabs()}
          ${renderActiveMode()}
        </section>

        <section class="layout-grid">
          <form class="card input-card" id="prediction-form">
            <div class="section-heading">
              <h2>${escapeHtml(FORM_TITLE)}</h2>
              <p>${escapeHtml(FORM_HELP)}</p>
            </div>
            <div class="field-grid">${INPUT_FIELDS.map(renderField).join("")}</div>
            ${renderDesignValidation()}
            <div class="button-row">
              <button type="submit" class="primary-button" ${state.loading || state.running ? "disabled" : ""}>${state.running ? "Running..." : escapeHtml(RUN_BUTTON_LABEL)}</button>
              <button type="button" class="secondary-button" id="sensitivity-button" ${state.loading || state.running ? "disabled" : ""}>Run sensitivity</button>
              <button type="button" class="secondary-button" id="alternatives-button" ${state.loading || state.running ? "disabled" : ""}>Find alternatives</button>
              <button type="button" class="secondary-button" id="reset-button">Reset</button>
            </div>
          </form>

          <aside class="card result-card">
            ${renderExamples()}
            ${renderSensitivityControl()}
            ${renderObjectiveControl()}
            ${renderModelDetails()}
          </aside>
        </section>

        <section class="card caveat-card">
          <h2>Responsible use</h2>
          <p>${escapeHtml(RESPONSIBLE_USE_COPY)}</p>
          ${renderProjectLinks()}
        </section>
        ${renderInfoModal()}
      </main>
    `;

    root.querySelector("#prediction-form")?.addEventListener("submit", runPrediction);
    root.querySelector("#reset-button")?.addEventListener("click", resetInputs);
    root.querySelector("#sensitivity-button")?.addEventListener("click", () => { state.mode = "sensitivity"; runSensitivity(); });
    root.querySelector("#alternatives-button")?.addEventListener("click", () => { state.mode = "alternatives"; runAlternatives(); });
    root.querySelector("#objective-select")?.addEventListener("change", (event) => { state.objective = event.target.value; state.alternatives = null; render(); });
    root.querySelector("#sensitivity-granularity")?.addEventListener("input", (event) => {
      const nextValue = Number(event.target.value);
      state.sensitivityGranularity = Number.isFinite(nextValue) ? nextValue : 9;
      state.sensitivity = null;
      render();
    });
    root.querySelectorAll("[data-freeze-field]").forEach((input) => {
      input.addEventListener("change", (event) => {
        toggleFrozenAlternativeField(event.target.dataset.freezeField, event.target.checked);
      });
    });
    root.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
    root.querySelectorAll("[data-example-id]").forEach((button) => button.addEventListener("click", () => applyExample(button.dataset.exampleId)));
    root.querySelectorAll("[data-info-field]").forEach((button) => {
      button.addEventListener("click", () => openInfoModal(button.dataset.infoField));
    });
    root.querySelector("[data-close-info]")?.addEventListener("click", closeInfoModal);
    root.querySelector("[data-modal-backdrop]")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeInfoModal();
    });

    for (const field of INPUT_FIELDS) {
      const element = root.querySelector(`[name="${field.name}"]`);
      element?.addEventListener("input", (event) => updateInput(field.name, event.target.value));
      element?.addEventListener("change", (event) => updateInput(field.name, event.target.value));
    }
  }

  function renderTabs() {
    return `<nav class="mode-tabs" aria-label="Analysis modes">${MODES.map((mode) => `<button type="button" class="tab-button ${state.mode === mode.id ? "selected" : ""}" data-mode="${mode.id}">${escapeHtml(mode.label)}</button>`).join("")}</nav>`;
  }

  function renderActiveMode() {
    if (state.mode === "sensitivity") return renderSensitivity();
    if (state.mode === "alternatives") return renderAlternatives();
    if (state.mode === "diagnostics") return renderDebug();
    return renderResult();
  }

  function renderExamples() {
    if (!state.examples.length) return "";
    return `
      <div class="example-panel">
        <div><h3>Quick examples</h3><p>Fill the form with a representative profile, then run a local analysis.</p></div>
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
    const inputId = `input-${field.name}`;
    const freezeControl = `
      <label class="freeze-inline">
        <input
          type="checkbox"
          data-freeze-field="${escapeHtml(field.name)}"
          ${state.frozenAlternativeFields[field.name] ? "checked" : ""}
        />
        <span>Freeze for alternatives</span>
      </label>
    `;

    const control = field.type === "select"
      ? `
        <select id="${escapeHtml(inputId)}" name="${escapeHtml(field.name)}">
          ${field.options.map((option) => `<option value="${escapeHtml(option.value)}" ${Number(option.value) === Number(value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      `
      : `
        <input
          id="${escapeHtml(inputId)}"
          name="${escapeHtml(field.name)}"
          type="${escapeHtml(field.type || "number")}"
          min="${escapeHtml(field.min)}"
          max="${escapeHtml(field.max)}"
          step="${escapeHtml(field.step)}"
          value="${escapeHtml(value)}"
        />
      `;

    return `
      <div class="field">
        ${renderFieldLabel(field, inputId)}
        ${control}
        <small>${escapeHtml(field.help)}</small>
        ${freezeControl}
      </div>
    `;
  }

  function renderFieldLabel(field, inputId) {
    return `
      <div class="field-label-row">
        <label for="${escapeHtml(inputId)}">${escapeHtml(field.label)}</label>
        ${field.info ? `
          <button
            type="button"
            class="info-button"
            aria-label="About ${escapeHtml(field.label)}"
            data-info-field="${escapeHtml(field.name)}"
          >
            i
          </button>
        ` : ""}
      </div>
    `;
  }

  function renderDesignValidation() {
    const validation = validateDesignInputs(state.inputs);
    if (validation.valid && !validation.warnings.length) return "";

    const errors = validation.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("");
    const warnings = validation.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");

    return `
      <div class="design-validation ${validation.valid ? "warning" : "error"}">
        ${errors ? `<strong>Geometry check</strong><ul>${errors}</ul>` : ""}
        ${warnings ? `<strong>Model-range note</strong><ul>${warnings}</ul>` : ""}
      </div>
    `;
  }

  function renderStatus() {
    if (state.loading) return `<div class="status">Loading model pair and preprocessing schema...</div>`;
    if (state.error) return `<div class="status error"><strong>Setup/runtime issue:</strong> ${escapeHtml(state.error)}</div>`;
    const warnings = state.setupWarnings.map((warning) => `<small>${escapeHtml(warning)}</small>`).join("");
    return `<div class="status ready">Ready: dedicated model pair and preprocessing schema loaded.${warnings}</div>`;
  }

  function renderResult() {
    if (!state.result) return `<div class="empty-result"><h2>${escapeHtml(EMPTY_RESULT_TITLE)}</h2><p>${escapeHtml(EMPTY_RESULT_COPY)}</p></div>`;
    return `
      <div class="prediction ${state.result.className}">
        <p class="prediction-label">${escapeHtml(state.result.valueLabel)}</p>
        <strong>${escapeHtml(state.result.valueText)}</strong>
        <h2>${escapeHtml(state.result.label)}</h2>
        <div class="metric-grid">
          ${metric("Heating load", state.result.heatingLoad)}
          ${metric("Cooling load", state.result.coolingLoad)}
          ${metric("Total load", state.result.totalLoad)}
          ${metric("Heating minus cooling", state.result.balance, true)}
        </div>
        <p>${escapeHtml(state.result.summary)}</p>
        <small>${escapeHtml(state.result.caveat)}</small>
      </div>
    `;
  }

  function renderSensitivity() {
    if (!state.sensitivity) {
      return `<div class="empty-result"><h2>Sensitivity analysis</h2><p>Run a one-feature-at-a-time sweep to see which inputs move total load near the current profile. Continuous fields use ${escapeHtml(state.sensitivityGranularity)} incremental sweep points; categorical fields use their valid encoded categories. Geometry constraints are enforced before inference.</p></div>`;
    }
    return `
      <div class="analysis-panel">
        <h2>Sensitivity analysis</h2>
        <p>Features are sorted by total-load spread across bounded sweep values. Continuous fields used ${escapeHtml(state.sensitivity.points || state.sensitivityGranularity)} incremental sweep points; categorical fields used their valid encoded categories. Deltas are relative to the current input profile.</p>
        <div class="analysis-list">
          ${state.sensitivity.analyses.map((item) => `
            <article class="analysis-item">
              <div>
                <h3>${escapeHtml(labelize(item.featureName))}</h3>
                <p>Total-load range across sweep: <strong>${formatLoad(item.rangeTotal)}</strong></p>
              </div>
              <table>
                <thead><tr><th>Value</th><th>Heating</th><th>Cooling</th><th>Total Δ</th></tr></thead>
                <tbody>${item.rows.map((row) => `<tr class="${Number(row.value) === Number(state.inputs[item.featureName]) ? "current-row" : ""}"><td>${escapeHtml(row.value)}</td><td>${formatLoad(row.heatingLoad)}</td><td>${formatLoad(row.coolingLoad)}</td><td>${formatSignedLoad(row.deltaTotal)}</td></tr>`).join("")}</tbody>
              </table>
              <small>${escapeHtml(item.rows.length)} feasible sweep point(s) evaluated after geometry filtering.</small>
            </article>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderAlternatives() {
    if (!state.alternatives) {
      return `<div class="empty-result"><h2>Nearby alternatives</h2><p>Generate nearby profiles by changing one or two inputs, repairing and rejecting implausible geometry, then rank them by the selected objective.</p></div>`;
    }

    const frozenCopy = getFrozenAlternativeFields().length
      ? `Frozen during search: ${getFrozenAlternativeFields().map(labelize).join(", ")}`
      : "No parameters frozen during this search.";

    const alternativesMarkup = state.alternatives.alternatives.length
      ? `<div class="alternative-grid">
          ${state.alternatives.alternatives.map((item, index) => `
            <article class="alternative-card">
              <h3>#${index + 1} · Total ${formatLoad(item.totalLoad)}</h3>
              <div class="metric-grid compact">
                ${metric("Heating", item.heatingLoad)}
                ${metric("Cooling", item.coolingLoad)}
                ${metric("Total Δ", item.deltaTotal, true)}
              </div>
              <p>${escapeHtml(describeChangedFeatures(item.inputs, state.inputs) || "No input changes")}</p>
              ${item.validationWarnings?.length ? `<small>${escapeHtml(item.validationWarnings.join(" "))}</small>` : ""}
            </article>
          `).join("")}
        </div>`
      : `<p class="analysis-note">No plausible nearby alternatives were found under the current freeze settings and geometry constraints.</p>`;

    return `
      <div class="analysis-panel">
        <h2>Nearby alternatives</h2>
        <p>Objective: <strong>${escapeHtml(state.alternatives.objectiveLabel)}</strong>. Negative deltas indicate lower estimated load than the current profile.</p>
        <p class="analysis-note">${escapeHtml(frozenCopy)}</p>
        ${alternativesMarkup}
      </div>
    `;
  }


  function renderSensitivityControl() {
    return `
      <div class="objective-panel">
        <label class="field">
          <span>Sensitivity sweep granularity</span>
          <input
            id="sensitivity-granularity"
            type="range"
            min="5"
            max="31"
            step="2"
            value="${escapeHtml(state.sensitivityGranularity)}"
          />
          <small>${escapeHtml(state.sensitivityGranularity)} points per continuous feature. Higher values produce denser sweeps while staying local and fast.</small>
        </label>
      </div>
    `;
  }

  function renderObjectiveControl() {
    return `
      <div class="objective-panel">
        <label class="field">
          <span>Alternative-search objective</span>
          <select id="objective-select">
            ${OBJECTIVES.map((objective) => `<option value="${objective.value}" ${objective.value === state.objective ? "selected" : ""}>${escapeHtml(objective.label)}</option>`).join("")}
          </select>
          <small>Used when ranking nearby candidate designs.</small>
        </label>
      </div>
    `;
  }

  function metric(label, value, signed = false) {
    return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${signed ? formatSignedLoad(value) : formatLoad(value)}</strong></div>`;
  }

  function renderModelDetails() {
    const preprocessing = state.schema ? describePreprocessing(state.schema) : null;
    return `
      <details class="model-details collapsible-panel">
        <summary>Deployment details</summary>
        <dl>
          <dt>Model mode</dt><dd>${escapeHtml(state.manifest?.model_mode || state.runtime?.mode || "dedicated_single_target_pair")}</dd>
          <dt>Targets</dt><dd>HeatingLoad, CoolingLoad</dd>
          <dt>Numeric features</dt><dd>${escapeHtml(preprocessing?.numericColumns?.join(", ") || "Waiting for schema")}</dd>
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
          ${projectLink(PROJECT_LINKS.githubProfile, "More projects", "GitHub portfolio")}
        </div>
      </div>
    `;
  }

  function renderInfoModal() {
    if (!state.activeInfo) return "";

    return `
      <div class="modal-backdrop" data-modal-backdrop>
        <section
          class="info-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="info-modal-title"
        >
          <button type="button" class="modal-close-button" data-close-info aria-label="Close information dialog">
            ×
          </button>
          <p class="eyebrow">Input field guide</p>
          <h2 id="info-modal-title">${escapeHtml(state.activeInfo.title)}</h2>
          <p>${escapeHtml(state.activeInfo.body)}</p>
          ${state.activeInfo.help ? `<small>${escapeHtml(state.activeInfo.help)}</small>` : ""}
        </section>
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
    return `<details class="debug-panel" open><summary>Runtime diagnostics</summary><pre>${escapeHtml(JSON.stringify(state.debug, null, 2))}</pre></details>`;
  }

  function labelize(name) {
    return name.replace(/([a-z])([A-Z])/g, "$1 $2");
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
