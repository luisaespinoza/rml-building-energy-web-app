import { OBJECTIVES } from "./constants.js";
import { generateNearbyCandidates, validateDesignInputs } from "./designSpace.js";
import { preprocessInput } from "./preprocessing.js";
import { predict } from "./model.js";
import { predictionSummary } from "./sensitivity.js";

export async function findNearbyAlternatives(baseInputs, schema, modelRuntime, options = {}) {
  const objective = options.objective || OBJECTIVES[0].value;
  const limit = options.limit || 8;
  const frozenFields = Array.isArray(options.frozenFields) ? options.frozenFields : [];
  const maxChangedFeatures = options.maxChangedFeatures || 2;
  const baseValidation = validateDesignInputs(baseInputs);

  if (!baseValidation.valid) {
    throw new Error(`Cannot search alternatives until the current design is plausible: ${baseValidation.errors.join(" ")}`);
  }

  const candidates = generateNearbyCandidates(baseInputs, schema, maxChangedFeatures, {
    frozenFields
  });
  const baseline = predictionSummary(await predict(preprocessInput(baseInputs, schema), modelRuntime));
  const rows = [];

  for (const inputs of candidates) {
    const validation = validateDesignInputs(inputs);
    if (!validation.valid) continue;

    const prediction = predictionSummary(await predict(preprocessInput(inputs, schema), modelRuntime));
    rows.push({
      inputs,
      validationWarnings: validation.warnings,
      changedFeatures: diffFeatures(baseInputs, inputs),
      ...prediction,
      deltaHeating: prediction.heatingLoad - baseline.heatingLoad,
      deltaCooling: prediction.coolingLoad - baseline.coolingLoad,
      deltaTotal: prediction.totalLoad - baseline.totalLoad,
      objectiveScore: scorePrediction(prediction, objective)
    });
  }

  rows.sort((a, b) => a.objectiveScore - b.objectiveScore || a.changedFeatures.length - b.changedFeatures.length);

  return {
    objective,
    objectiveLabel: OBJECTIVES.find((item) => item.value === objective)?.label || objective,
    frozenFields,
    maxChangedFeatures,
    baseline,
    candidateCount: candidates.length,
    alternatives: rows.slice(0, limit)
  };
}

function scorePrediction(prediction, objective) {
  if (objective === "heatingLoad") return prediction.heatingLoad;
  if (objective === "coolingLoad") return prediction.coolingLoad;
  if (objective === "balanceAbs") return prediction.balanceAbs;
  return prediction.totalLoad;
}

function diffFeatures(a, b) {
  return Object.keys(b).filter((key) => Math.abs(Number(a[key]) - Number(b[key])) > 1e-9);
}
