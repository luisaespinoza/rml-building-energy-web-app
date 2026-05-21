import { DESIGN_VALUE_SETS, NUMERIC_COLUMNS } from "./constants.js";

export function getDesignValues(featureName, schema = null) {
  const manifestValues = schema?.design_space?.[featureName]?.values;
  if (Array.isArray(manifestValues) && manifestValues.length) return manifestValues.map(Number).filter(Number.isFinite);
  return DESIGN_VALUE_SETS[featureName] || [];
}

export function getSweepValues(featureName, currentInputs, schema = null) {
  const values = getDesignValues(featureName, schema);
  if (values.length) return values;
  const current = Number(currentInputs?.[featureName]);
  if (!Number.isFinite(current)) return [];
  return [current];
}

export function generateSingleFeatureVariations(baseInputs, featureName, schema = null) {
  return getSweepValues(featureName, baseInputs, schema).map((value) => ({
    ...baseInputs,
    [featureName]: value
  }));
}

export function generateNearbyCandidates(baseInputs, schema = null, maxChangedFeatures = 2, options = {}) {
  const frozenFields = new Set(options.frozenFields || []);
  const candidateMap = new Map();
  const entries = NUMERIC_COLUMNS
    .filter((name) => !frozenFields.has(name))
    .map((name) => ({
      name,
      values: getNeighborValues(name, baseInputs[name], schema)
    }))
    .filter((entry) => entry.values.length);

  function addCandidate(candidate, changedFeatures) {
    if (changedFeatures.length === 0 || changedFeatures.length > maxChangedFeatures) return;
    const key = JSON.stringify(NUMERIC_COLUMNS.map((name) => candidate[name]));
    candidateMap.set(key, { inputs: candidate, changedFeatures });
  }

  for (const entry of entries) {
    for (const value of entry.values) {
      addCandidate({ ...baseInputs, [entry.name]: value }, [entry.name]);
    }
  }

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      for (const firstValue of entries[i].values) {
        for (const secondValue of entries[j].values) {
          addCandidate(
            { ...baseInputs, [entries[i].name]: firstValue, [entries[j].name]: secondValue },
            [entries[i].name, entries[j].name]
          );
        }
      }
    }
  }

  return Array.from(candidateMap.values()).map((item) => item.inputs);
}

function getNeighborValues(featureName, currentValue, schema) {
  const values = getDesignValues(featureName, schema).slice().sort((a, b) => a - b);
  const current = Number(currentValue);
  const index = values.findIndex((value) => nearlyEqual(value, current));
  if (index < 0) return values.filter((value) => !nearlyEqual(value, current)).slice(0, 3);

  return [values[index - 1], values[index + 1]]
    .filter((value) => Number.isFinite(value) && !nearlyEqual(value, current));
}

function nearlyEqual(a, b) {
  return Math.abs(Number(a) - Number(b)) < 1e-9;
}
