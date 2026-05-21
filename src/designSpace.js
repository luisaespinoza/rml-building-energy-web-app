import {
  CATEGORICAL_DESIGN_FIELDS,
  CONTINUOUS_FIELDS,
  DESIGN_BOUNDS,
  DESIGN_VALUE_SETS,
  GEOMETRY_VALIDATION,
  NUMERIC_COLUMNS
} from "./constants.js";

const DEFAULT_SWEEP_POINTS = 9;
const MIN_SWEEP_POINTS = 3;
const MAX_SWEEP_POINTS = 51;

export function getDesignValues(featureName, schema = null) {
  const manifestValues = schema?.design_space?.[featureName]?.values;
  if (Array.isArray(manifestValues) && manifestValues.length) {
    return uniqueSortedNumbers(manifestValues);
  }
  return DESIGN_VALUE_SETS[featureName] || [];
}

export function isContinuousFeature(featureName) {
  return CONTINUOUS_FIELDS.includes(featureName);
}

export function isCategoricalDesignFeature(featureName) {
  return CATEGORICAL_DESIGN_FIELDS.includes(featureName);
}

export function getSweepValues(featureName, currentInputs, schema = null, options = {}) {
  if (isContinuousFeature(featureName)) {
    const bounds = getBounds(featureName, schema);
    if (!bounds) return currentOnly(currentInputs, featureName);
    return continuousRange(
      bounds.min,
      bounds.max,
      bounds.step,
      options.points ?? DEFAULT_SWEEP_POINTS,
      currentInputs?.[featureName]
    );
  }

  const values = getDesignValues(featureName, schema);
  if (values.length) return values;
  return currentOnly(currentInputs, featureName);
}

export function generateSingleFeatureVariations(baseInputs, featureName, schema = null, options = {}) {
  const values = getSweepValues(featureName, baseInputs, schema, options);
  const variants = [];
  const seen = new Set();

  for (const value of values) {
    const candidate = {
      ...baseInputs,
      [featureName]: value
    };

    const repaired = repairGeometry(candidate, [featureName], new Set());
    if (!repaired) continue;
    const validation = validateDesignInputs(repaired.inputs);
    if (!validation.valid) continue;

    const key = JSON.stringify(NUMERIC_COLUMNS.map((name) => roundForKey(repaired.inputs[name])));
    if (seen.has(key)) continue;
    seen.add(key);

    variants.push({
      ...repaired.inputs,
      _changedFeatures: repaired.changedFeatures,
      _validationWarnings: validation.warnings
    });
  }

  return variants;
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
    const normalizedChanged = Array.from(new Set(changedFeatures));
    if (normalizedChanged.length === 0 || normalizedChanged.length > maxChangedFeatures) return;
    if (!validateDesignInputs(candidate).valid) return;

    const key = JSON.stringify(NUMERIC_COLUMNS.map((name) => roundForKey(candidate[name])));
    candidateMap.set(key, { inputs: candidate, changedFeatures: normalizedChanged });
  }

  function buildCandidate(changes) {
    const changedNames = Object.keys(changes);
    const candidate = { ...baseInputs, ...changes };
    const repaired = repairGeometry(candidate, changedNames, frozenFields);
    if (!repaired) return null;
    return repaired;
  }

  for (const entry of entries) {
    const changes = {};
    for (const value of entry.values) {
      changes[entry.name] = value;
      const repaired = buildCandidate(changes);
      if (repaired) addCandidate(repaired.inputs, repaired.changedFeatures);
    }
  }

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      for (const firstValue of entries[i].values) {
        for (const secondValue of entries[j].values) {
          const repaired = buildCandidate({
            [entries[i].name]: firstValue,
            [entries[j].name]: secondValue
          });
          if (repaired) addCandidate(repaired.inputs, repaired.changedFeatures);
        }
      }
    }
  }

  return Array.from(candidateMap.values()).map((item) => item.inputs);
}

export function validateDesignInputs(inputs) {
  const errors = [];
  const warnings = [];

  for (const name of NUMERIC_COLUMNS) {
    const value = Number(inputs?.[name]);
    if (!Number.isFinite(value)) {
      errors.push(`${labelize(name)} must be a finite number.`);
      continue;
    }

    const bounds = DESIGN_BOUNDS[name];
    if (bounds && (value < bounds.min || value > bounds.max)) {
      errors.push(`${labelize(name)} must be between ${bounds.min} and ${bounds.max}.`);
    }
  }

  for (const name of CATEGORICAL_DESIGN_FIELDS) {
    const value = Number(inputs?.[name]);
    const allowed = DESIGN_VALUE_SETS[name] || [];
    if (!allowed.includes(value)) {
      errors.push(`${labelize(name)} must be one of: ${allowed.join(", ")}.`);
    }
  }

  const surfaceArea = Number(inputs?.SurfaceArea);
  const wallArea = Number(inputs?.WallArea);
  const roofArea = Number(inputs?.RoofArea);
  const height = Number(inputs?.OverallHeight);

  if ([surfaceArea, wallArea, roofArea].every(Number.isFinite)) {
    const expectedSurfaceArea = wallArea + 2 * roofArea;
    const tolerance = GEOMETRY_VALIDATION.surfaceAreaTolerance;
    if (Math.abs(surfaceArea - expectedSurfaceArea) > tolerance) {
      errors.push(
        `Surface area should be approximately wall area + 2 × roof area. Current values imply ${formatNumber(expectedSurfaceArea)} m², not ${formatNumber(surfaceArea)} m².`
      );
    }
  }

  if ([wallArea, roofArea, height].every(Number.isFinite) && roofArea > 0 && height > 0) {
    const minimumWallArea = 4 * Math.sqrt(roofArea) * height;
    const tolerance = GEOMETRY_VALIDATION.wallLowerBoundTolerance;
    if (wallArea + tolerance < minimumWallArea) {
      errors.push(
        `Wall area is too small for the selected roof area and height. A rectangular footprint lower bound is about ${formatNumber(minimumWallArea)} m².`
      );
    }
  }

  const glazingArea = Number(inputs?.GlazingArea);
  if (Number.isFinite(glazingArea) && glazingArea > 0.4) {
    warnings.push("Glazing area is above the original dataset maximum of 40%, so this is an extrapolative what-if probe.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

function repairGeometry(candidate, changedFeatures, frozenFields) {
  const changed = new Set(changedFeatures);
  const wallChanged = changed.has("WallArea");
  const roofChanged = changed.has("RoofArea");
  const surfaceChanged = changed.has("SurfaceArea");

  if ((wallChanged || roofChanged) && !surfaceChanged && !frozenFields.has("SurfaceArea")) {
    candidate.SurfaceArea = roundToStep(Number(candidate.WallArea) + 2 * Number(candidate.RoofArea), DESIGN_BOUNDS.SurfaceArea.step);
    changed.add("SurfaceArea");
  }

  if (surfaceChanged && !wallChanged && !roofChanged) {
    if (!frozenFields.has("RoofArea")) {
      candidate.RoofArea = roundToStep((Number(candidate.SurfaceArea) - Number(candidate.WallArea)) / 2, DESIGN_BOUNDS.RoofArea.step);
      changed.add("RoofArea");
    } else if (!frozenFields.has("WallArea")) {
      candidate.WallArea = roundToStep(Number(candidate.SurfaceArea) - 2 * Number(candidate.RoofArea), DESIGN_BOUNDS.WallArea.step);
      changed.add("WallArea");
    }
  }

  if ((surfaceChanged || wallChanged || roofChanged) && changed.has("SurfaceArea")) {
    const surfaceBounds = DESIGN_BOUNDS.SurfaceArea;
    if (candidate.SurfaceArea < surfaceBounds.min || candidate.SurfaceArea > surfaceBounds.max) return null;
  }

  for (const name of ["WallArea", "RoofArea"]) {
    const bounds = DESIGN_BOUNDS[name];
    if (candidate[name] < bounds.min || candidate[name] > bounds.max) return null;
  }

  return { inputs: candidate, changedFeatures: Array.from(changed) };
}

function getNeighborValues(featureName, currentValue, schema) {
  if (isContinuousFeature(featureName)) {
    const bounds = getBounds(featureName, schema);
    if (!bounds) return [];
    const current = Number(currentValue);
    const step = bounds.alternativeStep || bounds.step;
    return [-2, -1, 1, 2]
      .map((multiplier) => roundToStep(current + multiplier * step, bounds.step))
      .filter((value) => Number.isFinite(value) && value >= bounds.min && value <= bounds.max && !nearlyEqual(value, current));
  }

  const values = getDesignValues(featureName, schema).slice().sort((a, b) => a - b);
  const current = Number(currentValue);
  const index = values.findIndex((value) => nearlyEqual(value, current));
  if (index < 0) return values.filter((value) => !nearlyEqual(value, current)).slice(0, 3);

  return [values[index - 1], values[index + 1]]
    .filter((value) => Number.isFinite(value) && !nearlyEqual(value, current));
}

function getBounds(featureName, schema = null) {
  const manifestBounds = schema?.design_space?.[featureName];
  const fallback = DESIGN_BOUNDS[featureName];
  if (!fallback && !manifestBounds) return null;

  const min = Number(manifestBounds?.min ?? fallback?.min);
  const max = Number(manifestBounds?.max ?? fallback?.max);
  const step = Number(manifestBounds?.step ?? fallback?.step ?? 1);
  const sweepStep = Number(manifestBounds?.sweepStep ?? fallback?.sweepStep ?? step);
  const alternativeStep = Number(manifestBounds?.alternativeStep ?? fallback?.alternativeStep ?? step);

  if (![min, max, step, sweepStep, alternativeStep].every(Number.isFinite)) return null;
  return { min, max, step, sweepStep, alternativeStep };
}

function continuousRange(min, max, step, requestedPoints, includeValue = null) {
  const pointCount = clampInteger(requestedPoints, MIN_SWEEP_POINTS, MAX_SWEEP_POINTS);
  const values = [];

  if (pointCount === 1 || nearlyEqual(min, max)) {
    values.push(roundToStep(min, step));
  } else {
    const interval = (max - min) / (pointCount - 1);
    for (let index = 0; index < pointCount; index += 1) {
      values.push(roundToStep(min + index * interval, step));
    }
  }

  const current = Number(includeValue);
  if (Number.isFinite(current) && current >= min && current <= max) values.push(roundToStep(current, step));

  values.push(roundToStep(min, step), roundToStep(max, step));
  return uniqueSortedNumbers(values);
}

function clampInteger(value, min, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return DEFAULT_SWEEP_POINTS;
  return Math.min(max, Math.max(min, number));
}

function currentOnly(currentInputs, featureName) {
  const current = Number(currentInputs?.[featureName]);
  return Number.isFinite(current) ? [current] : [];
}

function uniqueSortedNumbers(values) {
  return Array.from(new Set(values.map(Number).filter(Number.isFinite).map((value) => Number(value.toFixed(6))))).sort((a, b) => a - b);
}

function roundToStep(value, step = 1) {
  if (!Number.isFinite(value)) return value;
  if (!Number.isFinite(step) || step <= 0) return Number(value.toFixed(6));
  const decimals = Math.max(0, String(step).split(".")[1]?.length || 0);
  return Number((Math.round(value / step) * step).toFixed(Math.max(decimals, 6)));
}

function roundForKey(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : value;
}

function nearlyEqual(a, b) {
  return Math.abs(Number(a) - Number(b)) < 1e-9;
}

function labelize(name) {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
