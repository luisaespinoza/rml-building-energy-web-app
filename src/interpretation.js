import { OUTPUT_LABEL, OUTPUT_MODE, TARGET_NAME } from "./constants.js";

export function formatProbability(probability) {
  if (!Number.isFinite(probability)) return "Unavailable";
  if (probability > 0 && probability < 0.001) return "<0.1%";
  if (probability < 1 && probability > 0.999) return ">99.9%";
  return `${(probability * 100).toFixed(1)}%`;
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return "Unavailable";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 0.001 || abs >= 100000)) return value.toExponential(3);
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function interpretPrediction(prediction) {
  if (OUTPUT_MODE === "binary_classification") {
    const probability = prediction.probability;
    const band = getProbabilityBand(probability);
    return {
      valueText: formatProbability(probability),
      valueLabel: OUTPUT_LABEL,
      ...band,
      caveat: "This output is a local browser inference result from a compact model for a portfolio/educational demo."
    };
  }

  if (OUTPUT_MODE === "multi_output_regression") {
    const values = prediction.values || [];
    return {
      valueText: values.map(formatNumber).join(" / ") || "Unavailable",
      valueLabel: OUTPUT_LABEL,
      label: "Model estimate",
      className: "risk-medium",
      summary: `The model returned ${values.length} output value(s) for ${TARGET_NAME}. Customize interpretation.js for project-specific language.`,
      caveat: "This output is a local browser inference result from a compact model for a portfolio/educational demo."
    };
  }

  const value = prediction.values?.[0];
  return {
    valueText: formatNumber(value),
    valueLabel: OUTPUT_LABEL,
    label: "Model estimate",
    className: "risk-medium",
    summary: `The model returned an estimated value for ${TARGET_NAME}. Customize interpretation.js for project-specific language.`,
    caveat: "This output is a local browser inference result from a compact model for a portfolio/educational demo."
  };
}

function getProbabilityBand(probability) {
  if (!Number.isFinite(probability)) {
    return {
      label: "Unavailable",
      className: "risk-unknown",
      summary: "The model could not produce a valid probability for this input."
    };
  }

  if (probability < 0.2) {
    return {
      label: "Lower estimated probability",
      className: "risk-low",
      summary: "The model estimates a lower probability for this input profile in the demo setting."
    };
  }

  if (probability < 0.5) {
    return {
      label: "Moderate estimated probability",
      className: "risk-medium",
      summary: "The model estimates a non-trivial probability. Treat this as an exploratory signal, not an operational decision."
    };
  }

  return {
    label: "Higher estimated probability",
    className: "risk-high",
    summary: "The model estimates an elevated probability for this input profile. Treat this as a demo signal requiring validation."
  };
}
