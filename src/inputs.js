import { DEFAULT_INPUTS, FALLBACK_CATEGORIES } from "./constants.js";

// Project customization point:
// Replace these fields with the raw inputs expected by your trained model.
// Keep names exactly aligned with preprocessing_schema.json and example_inputs.json.
export const INPUT_FIELDS = [
  {
    name: "FeatureA",
    label: "Feature A",
    type: "number",
    min: -1000000,
    max: 1000000,
    step: 0.1,
    help: "Numeric feature placeholder."
  },
  {
    name: "FeatureB",
    label: "Feature B",
    type: "number",
    min: -1000000,
    max: 1000000,
    step: 0.1,
    help: "Numeric feature placeholder."
  },
  {
    name: "Category",
    label: "Category",
    type: "select",
    options: FALLBACK_CATEGORIES.Category,
    help: "Categorical feature placeholder."
  }
];

export function coerceFormValue(field, rawValue) {
  if (field.type === "number") {
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : DEFAULT_INPUTS[field.name];
  }

  if (field.type === "select") {
    const optionValues = field.options.map((option) => String(typeof option === "object" ? option.value : option));
    const fallback = DEFAULT_INPUTS[field.name];
    return optionValues.includes(String(rawValue)) ? rawValue : fallback;
  }

  return rawValue;
}

export function getInitialInputs() {
  return { ...DEFAULT_INPUTS };
}
