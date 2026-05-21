import { DEFAULT_INPUTS, DESIGN_VALUE_SETS } from "./constants.js";

function optionsFor(name, formatter = String) {
  return DESIGN_VALUE_SETS[name].map((value) => ({ value, label: formatter(value) }));
}

export const INPUT_FIELDS = [
  {
    name: "RelativeCompactness",
    label: "Relative compactness",
    type: "select",
    options: optionsFor("RelativeCompactness", (value) => value.toFixed(2)),
    help: "Dimensionless simulated compactness value from the original design space."
  },
  {
    name: "SurfaceArea",
    label: "Surface area",
    type: "select",
    options: optionsFor("SurfaceArea", (value) => `${value} m²`),
    help: "Total envelope surface area. Kept discrete to avoid unrealistic combinations."
  },
  {
    name: "WallArea",
    label: "Wall area",
    type: "select",
    options: optionsFor("WallArea", (value) => `${value} m²`),
    help: "Wall area from observed simulated design values."
  },
  {
    name: "RoofArea",
    label: "Roof area",
    type: "select",
    options: optionsFor("RoofArea", (value) => `${value} m²`),
    help: "Roof area from observed simulated design values."
  },
  {
    name: "OverallHeight",
    label: "Overall height",
    type: "select",
    options: optionsFor("OverallHeight", (value) => `${value} m`),
    help: "The source data uses short and tall building-height profiles."
  },
    {
      name: "Orientation",
      label: "Orientation",
      type: "select",
      options: [
        { value: 2, label: "2 — North" },
        { value: 3, label: "3 — East" },
        { value: 4, label: "4 — South" },
        { value: 5, label: "5 — West" }
      ],
      help: "Dataset-coded building orientation. These labels describe the source dataset’s simulation categories; they are not a general-purpose building-energy input standard.",
      info: "Orientation is a categorical value from the source simulation dataset, not a free-form compass angle. The commonly documented coding is: 2 = North, 3 = East, 4 = South, and 5 = West. The model expects one of these observed values."
    },
    {
      name: "GlazingArea",
      label: "Glazing area",
      type: "select",
      options: [
        { value: 0.0, label: "0.00 — 0% glazing" },
        { value: 0.1, label: "0.10 — 10% glazing" },
        { value: 0.25, label: "0.25 — 25% glazing" },
        { value: 0.4, label: "0.40 — 40% glazing" }
      ],
      help: "Dataset-coded glazing area level. These labels describe the source dataset’s simulation categories; they are not a general-purpose building-energy input standard.",
      info: "Glazing area is the simulated window/glazed area level used by the dataset. The commonly documented levels are 0%, 10%, 25%, and 40%. In the model input these are encoded as 0.00, 0.10, 0.25, and 0.40."
    },
    {
      name: "GlazingAreaDistribution",
      label: "Glazing area distribution",
      type: "select",
      options: [
        { value: 0, label: "0 — No glazing" },
        { value: 1, label: "1 — Uniform" },
        { value: 2, label: "2 — North" },
        { value: 3, label: "3 — East" },
        { value: 4, label: "4 — South" },
        { value: 5, label: "5 — West" }
      ],
      help: "Dataset-coded glazing placement. These labels describe the source dataset’s simulation categories; they are not a general-purpose building-energy input standard.",
      info: "Glazing area distribution describes how the simulated glazing is distributed across building faces. The commonly documented coding is: 0 = no glazing, 1 = uniform distribution, 2 = north, 3 = east, 4 = south, and 5 = west. This is a categorical design setting, not a continuous percentage."
    }
];

export function coerceFormValue(field, rawValue) {
  const fallback = DEFAULT_INPUTS[field.name];
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return fallback;

  if (field.type === "select") {
    const validValues = field.options.map((option) => Number(option.value));
    return validValues.includes(parsed) ? parsed : fallback;
  }

  return parsed;
}

export function getInitialInputs() {
  return { ...DEFAULT_INPUTS };
}
