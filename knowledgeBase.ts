
export const MEDALLION_PRACTICES = {
  BRONZE: {
    purpose: "Raw Ingestion Layer",
    rules: [
      "Keep original column names as metadata",
      "Add _ingested_at and _source_file audit columns",
      "Schema-on-read or permissive data types",
      "Immutable: Do not update raw data"
    ]
  },
  SILVER: {
    purpose: "Cleansed & Conformed Layer",
    rules: [
      "Standardize naming (snake_case)",
      "Uniform data types (TIMESTAMPS, NUMERIC)",
      "Standardize units (e.g., all weight to LBS or KG)",
      "Deduplication and basic null handling",
      "Lookup table joins (e.g., mapping source codes to descriptions)"
    ]
  },
  GOLD: {
    purpose: "Business Ready / Presentation Layer",
    rules: [
      "Star schema or OBT (One Big Table) for BigQuery",
      "Aggregations and calculated KPIs (e.g., TCO, Utilization)",
      "Business-friendly labels",
      "Optimized for partitioning and clustering"
    ]
  }
};

export const AUTOMOTIVE_COMMERCIAL_CONTEXT = {
  IDENTIFIERS: ["VIN (17 chars)", "Unit Number", "License Plate"],
  WEIGHT_CLASSES: "GVWR determines Class 1-8. Class 8 is Heavy Duty (>33,000 lbs).",
  FUEL_TYPES: {
    DIESEL: "Standard heavy duty",
    GAS: "Light/Medium duty",
    BEV: "Battery Electric. Needs associated charging data: Charger Type (J1772, CCS1), Max KW, Charge State.",
    HYDROGEN: "Fuel Cell Electric. Pressure requirements.",
    HYBRID: "Combined ICE and Electric parameters."
  },
  EQUIPMENT_EXTENSIONS: [
    "Liftgates",
    "Reefer Units (Refrigeration)",
    "Telematics Devices",
    "EV Chargers (Level 2 vs DC Fast)"
  ]
};
