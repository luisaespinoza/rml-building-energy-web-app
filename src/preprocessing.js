import { CATEGORICAL_COLUMNS, DEFAULT_INPUTS, FALLBACK_CATEGORIES, NUMERIC_COLUMNS, PREPROCESSING_SCHEMA_PATH } from "./constants.js";

let cachedSchema = null;

export async function loadPreprocessingSchema(path = PREPROCESSING_SCHEMA_PATH) {
  if (cachedSchema) return cachedSchema;

  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load preprocessing schema at ${path}. Place preprocessing_schema.json in public/artifacts/deployment/.`);
  }

  cachedSchema = await response.json();
  validatePreprocessingSchema(cachedSchema);
  return cachedSchema;
}

export function clearPreprocessingSchemaCache() {
  cachedSchema = null;
}

export function validatePreprocessingSchema(schema) {
  if (!schema || typeof schema !== "object") throw new Error("preprocessing_schema.json must be a JSON object.");

  const numericColumns = getNumericColumns(schema);
  if (!numericColumns.length) throw new Error("preprocessing_schema.json must include numeric_features or numeric_columns.");

  for (const expected of NUMERIC_COLUMNS) {
    if (!numericColumns.includes(expected)) {
      throw new Error(`preprocessing_schema.json numeric feature order is missing '${expected}'.`);
    }
  }

  const scalerStatus = getScalerStatus(schema);
  if (!scalerStatus.complete) {
    const missing = scalerStatus.details
      .filter((item) => !item.hasMean || !item.hasScale)
      .map((item) => `${item.column} mean=${item.hasMean} scale=${item.hasScale}`)
      .join("; ");
    throw new Error(`Incomplete train-fitted StandardScaler metadata in preprocessing_schema.json: ${missing}`);
  }

  const expectedLength = getExpectedInputLength(schema);
  if (expectedLength && expectedLength !== numericColumns.length + encodedCategoricalLength(schema)) {
    throw new Error(`Schema input_dim=${expectedLength} does not match derived preprocessing length ${numericColumns.length + encodedCategoricalLength(schema)}.`);
  }
}

export function preprocessInput(rawInput, schema) {
  if (!schema) throw new Error("Preprocessing schema has not loaded yet.");

  const normalizedInput = normalizeRawInput(rawInput);
  const numericColumns = getNumericColumns(schema);
  const categoricalColumns = getCategoricalColumns(schema);

  const numericVector = numericColumns.map((column) => standardize(column, normalizedInput[column], schema));
  const categoricalVector = categoricalColumns.flatMap((column) => oneHotEncode(column, normalizedInput[column], schema));
  const vector = [...numericVector, ...categoricalVector];

  const expectedLength = getExpectedInputLength(schema);
  if (expectedLength && vector.length !== expectedLength) {
    throw new Error(
      `Preprocessed feature vector has length ${vector.length}, but schema/model expected ${expectedLength}. ` +
        `Numeric columns: ${numericColumns.join(", ")}. Categorical columns: ${categoricalColumns.join(", ")}.`
    );
  }

  for (const value of vector) {
    if (!Number.isFinite(value)) throw new Error("Preprocessing produced a non-finite value. Check scaler means/scales.");
  }

  return Float32Array.from(vector);
}

export function normalizeRawInput(rawInput) {
  const normalized = {};

  for (const [key, fallback] of Object.entries(DEFAULT_INPUTS)) {
    const parsed = Number(rawInput?.[key]);
    normalized[key] = Number.isFinite(parsed) ? parsed : fallback;
  }

  return normalized;
}

export function getNumericColumns(schema) {
  return firstArray([
    schema?.numeric_columns,
    schema?.numeric_features,
    schema?.num_cols,
    schema?.continuous_features,
    schema?.preprocessing?.numeric_columns,
    schema?.preprocessing?.numeric_features,
    schema?.columns?.numeric,
    schema?.feature_columns?.numeric
  ]) || NUMERIC_COLUMNS;
}

export function getCategoricalColumns(schema) {
  return firstArray([
    schema?.categorical_columns,
    schema?.categorical_features,
    schema?.cat_cols,
    schema?.preprocessing?.categorical_columns,
    schema?.preprocessing?.categorical_features,
    schema?.columns?.categorical,
    schema?.feature_columns?.categorical
  ]) || CATEGORICAL_COLUMNS;
}

function firstArray(values) {
  return values.find((value) => Array.isArray(value)) || null;
}

export function getExpectedInputLength(schema) {
  const direct = firstNumber([
    schema?.input_dim,
    schema?.n_features,
    schema?.num_features_after_preprocessing,
    schema?.transformed_feature_count,
    schema?.preprocessing?.input_dim
  ]);
  if (direct) return direct;

  const names = firstArray([
    schema?.feature_names_out,
    schema?.transformed_feature_names,
    schema?.encoded_feature_names,
    schema?.output_features,
    schema?.input_features,
    schema?.preprocessing?.feature_names_out
  ]);
  return names?.length || null;
}

function firstNumber(values) {
  return values.find((value) => Number.isInteger(value) && value > 0) || null;
}

const MEAN_KEYS = ["mean", "means", "mean_", "numeric_means", "center", "centers"];
const SCALE_KEYS = ["scale", "scales", "scale_", "numeric_scales", "std", "stds", "standard_deviation", "standard_deviations"];

function standardize(column, value, schema) {
  const mean = getStat(schema, column, MEAN_KEYS);
  const scale = getStat(schema, column, SCALE_KEYS);

  if (mean === undefined || scale === undefined) {
    throw new Error(
      `Missing StandardScaler metadata for ${column}. Browser inference must use train-fitted numeric means/scales.`
    );
  }

  const numericScale = Number(scale);
  if (!Number.isFinite(numericScale) || numericScale === 0) {
    throw new Error(`Invalid StandardScaler scale for ${column}: ${scale}`);
  }
  return (Number(value) - Number(mean)) / numericScale;
}

function getStat(schema, column, keys) {
  const containers = [
    schema,
    schema?.standard_scaler,
    schema?.scaler,
    schema?.numeric_scaler,
    schema?.numeric_transformer,
    schema?.preprocessing,
    schema?.preprocessing?.standard_scaler,
    schema?.preprocessing?.scaler
  ];

  for (const container of containers) {
    for (const key of keys) {
      const value = readNamedOrIndexedStat(container?.[key], column, schema);
      if (value !== undefined) return value;
    }
  }

  return undefined;
}

function readNamedOrIndexedStat(source, column, schema) {
  if (source === undefined || source === null) return undefined;
  if (typeof source === "object" && !Array.isArray(source) && source[column] !== undefined) return source[column];
  if (Array.isArray(source)) {
    const index = getNumericColumns(schema).indexOf(column);
    if (index >= 0 && source[index] !== undefined) return source[index];
  }
  return undefined;
}

function oneHotEncode(column, value, schema) {
  const categories = getCategories(schema, column);
  const stringValue = String(value);
  return categories.map((category) => (String(category) === stringValue ? 1 : 0));
}

export function getCategories(schema, column) {
  const categoricalColumns = getCategoricalColumns(schema);
  const index = categoricalColumns.indexOf(column);

  const categoryContainers = [
    schema?.categories,
    schema?.categories_,
    schema?.categorical_categories,
    schema?.one_hot_categories,
    schema?.one_hot_encoder?.categories,
    schema?.one_hot_encoder?.categories_,
    schema?.encoder?.categories,
    schema?.encoder?.categories_,
    schema?.preprocessing?.categories,
    schema?.preprocessing?.categories_,
    schema?.preprocessing?.one_hot_encoder?.categories,
    schema?.preprocessing?.one_hot_encoder?.categories_
  ];

  for (const container of categoryContainers) {
    const categories = readCategories(container, column, index);
    if (categories) return categories;
  }

  return FALLBACK_CATEGORIES[column] || [];
}

function readCategories(container, column, index) {
  if (!container) return null;
  if (Array.isArray(container?.[column])) return container[column];
  if (Array.isArray(container) && index >= 0 && Array.isArray(container[index])) return container[index];
  if (typeof container === "object" && Array.isArray(container[String(index)])) return container[String(index)];
  return null;
}

function encodedCategoricalLength(schema) {
  return getCategoricalColumns(schema).reduce((sum, column) => sum + getCategories(schema, column).length, 0);
}

export function getScalerStatus(schema) {
  const numericColumns = schema ? getNumericColumns(schema) : [];
  const details = numericColumns.map((column) => ({
    column,
    hasMean: getStat(schema, column, MEAN_KEYS) !== undefined,
    hasScale: getStat(schema, column, SCALE_KEYS) !== undefined
  }));

  return { complete: details.every((item) => item.hasMean && item.hasScale), details };
}

export function describePreprocessing(schema) {
  const numericColumns = schema ? getNumericColumns(schema) : [];
  const categoricalColumns = schema ? getCategoricalColumns(schema) : [];
  return {
    numericColumns,
    categoricalColumns,
    categories: Object.fromEntries(categoricalColumns.map((column) => [column, getCategories(schema, column)])),
    scalerStatus: schema ? getScalerStatus(schema) : null,
    inputLength: schema ? getExpectedInputLength(schema) : null
  };
}
