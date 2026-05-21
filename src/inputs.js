import { DEFAULT_INPUTS, DESIGN_BOUNDS, DESIGN_VALUE_SETS } from "./constants.js";

function optionsFor(name, formatter = String) {
  return DESIGN_VALUE_SETS[name].map((value) => ({ value, label: formatter(value) }));
}

export const INPUT_FIELDS = [
  {
    name: "RelativeCompactness",
    label: "Relative compactness",
    type: "number",
    min: DESIGN_BOUNDS.RelativeCompactness.min,
    max: DESIGN_BOUNDS.RelativeCompactness.max,
    step: DESIGN_BOUNDS.RelativeCompactness.step,
    help: "Dimensionless compactness value. Continuous values inside the training envelope are allowed.",
    info: "Relative compactness describes how compact the simulated building form is. The source dataset used a finite set of values, but this app allows interpolation inside the observed range to demonstrate surrogate-model inference. Lower or higher values should still be treated as early-stage what-if probes, not definitive geometry."
  },
  {
    name: "SurfaceArea",
    label: "Surface area",
    type: "number",
    min: DESIGN_BOUNDS.SurfaceArea.min,
    max: DESIGN_BOUNDS.SurfaceArea.max,
    step: DESIGN_BOUNDS.SurfaceArea.step,
    help: "Total envelope surface area in square meters. Must be consistent with wall and roof area.",
    info: "Surface area is the total envelope surface area. For plausible profiles, the app checks that Surface Area is approximately Wall Area + 2 × Roof Area. This allows novel interpolated values while rejecting obviously inconsistent area combinations."
  },
  {
    name: "WallArea",
    label: "Wall area",
    type: "number",
    min: DESIGN_BOUNDS.WallArea.min,
    max: DESIGN_BOUNDS.WallArea.max,
    step: DESIGN_BOUNDS.WallArea.step,
    help: "Wall area in square meters. Checked against roof area and height for plausibility.",
    info: "Wall area is allowed to vary continuously inside the observed envelope. The app rejects combinations where wall area is too small to be physically plausible for the selected roof area and building height."
  },
  {
    name: "RoofArea",
    label: "Roof area",
    type: "number",
    min: DESIGN_BOUNDS.RoofArea.min,
    max: DESIGN_BOUNDS.RoofArea.max,
    step: DESIGN_BOUNDS.RoofArea.step,
    help: "Roof area in square meters. Used with wall area and height for plausibility checks.",
    info: "Roof area is treated as the horizontal footprint-like area from the simulation dataset. The app allows interpolated roof areas, but rejects combinations that violate the envelope relationship with surface and wall area."
  },
  {
    name: "OverallHeight",
    label: "Overall height",
    type: "number",
    min: DESIGN_BOUNDS.OverallHeight.min,
    max: DESIGN_BOUNDS.OverallHeight.max,
    step: DESIGN_BOUNDS.OverallHeight.step,
    help: "Building height in meters. Freeze this field if height should not change during alternative search.",
    info: "The source data used short and tall height profiles. This app allows interpolation between those heights for what-if inference, but alternative search can be constrained with the freeze checkbox when changing height would not be a realistic design option."
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
    help: "Dataset-coded rotation/orientation setting.",
    info: "This field represents the simulated building orientation category used in the source dataset. The values are commonly documented as 2 = North, 3 = East, 4 = South, and 5 = West, but the public dataset description does not specify a detailed architectural convention such as which wall is the reference face. Treat this as a categorical rotation setting for the surrogate model, not as a complete geometric orientation standard."
  },
  {
    name: "GlazingArea",
    label: "Glazing area fraction",
    type: "number",
    min: DESIGN_BOUNDS.GlazingArea.min,
    max: DESIGN_BOUNDS.GlazingArea.max,
    step: DESIGN_BOUNDS.GlazingArea.step,
    help: "Window/glazing fraction. 0.25 means 25%; values above 0.40 are extrapolative.",
    info: "Glazing area is the simulated fraction of building envelope assigned to windows/glazing. The source dataset used 0%, 10%, 25%, and 40%. This app allows 0–100% to demonstrate surrogate-model inference, but values above 40% should be treated as extrapolative what-if probes."
  },
  {
    name: "GlazingAreaDistribution",
    label: "Glazing distribution",
    type: "select",
    options: [
      { value: 0, label: "0 — No glazing" },
      { value: 1, label: "1 — Uniform" },
      { value: 2, label: "2 — North" },
      { value: 3, label: "3 — East" },
      { value: 4, label: "4 — South" },
      { value: 5, label: "5 — West" }
    ],
    help: "Dataset-coded placement of glazing across building faces.",
    info: "This field describes where the simulated glazing is distributed. The values are commonly documented as 0 = no glazing, 1 = uniform, 2 = north-facing concentration, 3 = east-facing concentration, 4 = south-facing concentration, and 5 = west-facing concentration. Unlike building orientation, this field is more directly about which side receives glazing."
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
