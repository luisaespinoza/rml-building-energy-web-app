export function formatLoad(value) {
  if (!Number.isFinite(value)) return "Unavailable";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatSignedLoad(value) {
  if (!Number.isFinite(value)) return "Unavailable";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatLoad(value)}`;
}

export function interpretPrediction(prediction) {
  const heatingLoad = Number(prediction.heatingLoad ?? prediction.values?.[0]);
  const coolingLoad = Number(prediction.coolingLoad ?? prediction.values?.[1]);
  const totalLoad = heatingLoad + coolingLoad;
  const balance = heatingLoad - coolingLoad;
  const dominant = Math.abs(balance) < 1 ? "balanced" : balance > 0 ? "heating-heavy" : "cooling-heavy";

  return {
    heatingLoad,
    coolingLoad,
    totalLoad,
    balance,
    dominant,
    valueText: formatLoad(totalLoad),
    valueLabel: "Estimated total load",
    label: labelForDominance(dominant),
    className: classForDominance(dominant),
    summary: summaryForDominance(dominant, heatingLoad, coolingLoad),
    caveat: "Exploratory surrogate-model estimate only. Do not use for engineering certification, HVAC sizing, code compliance, or permitting decisions."
  };
}

function labelForDominance(dominant) {
  if (dominant === "heating-heavy") return "Heating load dominates";
  if (dominant === "cooling-heavy") return "Cooling load dominates";
  return "Heating and cooling are relatively balanced";
}

function classForDominance(dominant) {
  if (dominant === "heating-heavy") return "risk-high";
  if (dominant === "cooling-heavy") return "risk-medium";
  return "risk-low";
}

function summaryForDominance(dominant, heatingLoad, coolingLoad) {
  const heating = formatLoad(heatingLoad);
  const cooling = formatLoad(coolingLoad);
  if (dominant === "heating-heavy") return `Estimated heating load (${heating}) is higher than cooling load (${cooling}) for this design profile.`;
  if (dominant === "cooling-heavy") return `Estimated cooling load (${cooling}) is higher than heating load (${heating}) for this design profile.`;
  return `Estimated heating load (${heating}) and cooling load (${cooling}) are close for this design profile.`;
}

export function describeChangedFeatures(inputs, baseInputs) {
  return Object.keys(inputs)
    .filter((name) => Math.abs(Number(inputs[name]) - Number(baseInputs[name])) > 1e-9)
    .map((name) => `${labelize(name)}: ${baseInputs[name]} → ${inputs[name]}`)
    .join("; ");
}

function labelize(name) {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}
