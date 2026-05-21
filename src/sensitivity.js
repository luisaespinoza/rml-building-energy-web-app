import { NUMERIC_COLUMNS } from "./constants.js";
import { generateSingleFeatureVariations } from "./designSpace.js";
import { preprocessInput } from "./preprocessing.js";
import { predict } from "./model.js";

export async function runSensitivityAnalysis(baseInputs, schema, modelRuntime, options = {}) {
  const featureNames = options.featureNames || NUMERIC_COLUMNS;
  const points = options.points || 9;
  const baselinePrediction = await predict(preprocessInput(baseInputs, schema), modelRuntime);
  const baseline = predictionSummary(baselinePrediction);
  const analyses = [];

  for (const featureName of featureNames) {
    const variants = generateSingleFeatureVariations(baseInputs, featureName, schema, { points });
    const rows = [];

    for (const inputs of variants) {
      const prediction = predictionSummary(await predict(preprocessInput(inputs, schema), modelRuntime));
      rows.push({
        featureName,
        value: inputs[featureName],
        inputs,
        changedFeatures: inputs._changedFeatures || [featureName],
        validationWarnings: inputs._validationWarnings || [],
        ...prediction,
        deltaHeating: prediction.heatingLoad - baseline.heatingLoad,
        deltaCooling: prediction.coolingLoad - baseline.coolingLoad,
        deltaTotal: prediction.totalLoad - baseline.totalLoad
      });
    }

    const current = rows.find((row) => nearlyEqual(row.value, baseInputs[featureName]));
    const best = rows.slice().sort((a, b) => a.totalLoad - b.totalLoad)[0] || null;
    const worst = rows.slice().sort((a, b) => b.totalLoad - a.totalLoad)[0] || null;

    if (rows.length) {
      analyses.push({
        featureName,
        current,
        best,
        worst,
        rangeTotal: worst && best ? worst.totalLoad - best.totalLoad : 0,
        rows
      });
    }
  }

  analyses.sort((a, b) => Math.abs(b.rangeTotal) - Math.abs(a.rangeTotal));
  return { baseline, analyses, points };
}

export function predictionSummary(prediction) {
  const heatingLoad = Number(prediction.heatingLoad ?? prediction.values?.[0]);
  const coolingLoad = Number(prediction.coolingLoad ?? prediction.values?.[1]);
  const totalLoad = heatingLoad + coolingLoad;
  const balance = heatingLoad - coolingLoad;
  return { heatingLoad, coolingLoad, totalLoad, balance, balanceAbs: Math.abs(balance) };
}

function nearlyEqual(a, b) {
  return Math.abs(Number(a) - Number(b)) < 1e-9;
}
