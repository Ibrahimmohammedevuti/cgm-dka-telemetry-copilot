export interface TelemetryPoint {
  hour: number; // 0 to 24
  timeLabel: string; // e.g. "00:00", "01:00"
  glucoseMgDl: number; // Continuous Glucose Monitoring (mg/dL)
  ketoneMmolL: number; // Continuous Interstitial Ketone Monitoring (mmol/L)
  eventAnnotation?: string;
}

export interface PatientLabContext {
  age: number;
  sex: 'F' | 'M';
  diagnosis: string;
  regimen: string;
  sglt2InhibitorActive: boolean;
  sglt2MedicationName?: string;
  sodiumMeqL: number;
  potassiumMeqL: number;
  chlorideMeqL: number;
  bicarbonateMeqL: number;
  bunMgDl: number;
  creatinineMgDl: number;
  venousPh: number;
  clinicalHistorySummary: string;
}

export interface TelemetryPreset {
  id: 'euglycemic-dka' | 'somogyi-rebound' | 'hhs-vs-dka' | 'tir-controlled';
  shortName: string;
  title: string;
  subtitle: string;
  clinicalTrapBadge: string;
  patientContext: PatientLabContext;
  series: TelemetryPoint[];
}

export const TELEMETRY_PRESETS: TelemetryPreset[] = [
  {
    id: 'euglycemic-dka',
    shortName: 'Preset 1: Euglycemic DKA (SGLT2i)',
    title: 'Euglycemic DKA on SGLT2 Inhibitor',
    subtitle:
      'Mildly elevated glucose (~165 mg/dL) masking rapidly rising interstitial ketones (> 3.0 mmol/L) — classic SGLT2i diagnostic trap.',
    clinicalTrapBadge: 'High-Risk Diagnostic Trap: Normal/Mild Glucose + Severe Ketonemia',
    patientContext: {
      age: 34,
      sex: 'F',
      diagnosis: 'Type 1 Diabetes Mellitus (off-label adjunct SGLT2i) / Post-viral gastroenteritis',
      regimen: 'Insulin Glargine 18U QHS + Lispro PRN + Empagliflozin 10mg QD (reduced insulin by 60% due to nausea)',
      sglt2InhibitorActive: true,
      sglt2MedicationName: 'Empagliflozin (Jardiance) 10 mg daily',
      sodiumMeqL: 136,
      potassiumMeqL: 4.8,
      chlorideMeqL: 102,
      bicarbonateMeqL: 11,
      bunMgDl: 26,
      creatinineMgDl: 1.15,
      venousPh: 7.21,
      clinicalHistorySummary:
        '34yo female presenting with 16 hours of nausea, tachypnea, and malaise after reducing prandial insulin during low-carbohydrate intake while continuing daily Empagliflozin 10mg.'
    },
    series: [
      { hour: 0, timeLabel: '00:00', glucoseMgDl: 138, ketoneMmolL: 0.4 },
      { hour: 1, timeLabel: '01:00', glucoseMgDl: 135, ketoneMmolL: 0.45 },
      { hour: 2, timeLabel: '02:00', glucoseMgDl: 132, ketoneMmolL: 0.5 },
      { hour: 3, timeLabel: '03:00', glucoseMgDl: 130, ketoneMmolL: 0.55 },
      { hour: 4, timeLabel: '04:00', glucoseMgDl: 129, ketoneMmolL: 0.62 },
      { hour: 5, timeLabel: '05:00', glucoseMgDl: 134, ketoneMmolL: 0.7 },
      { hour: 6, timeLabel: '06:00', glucoseMgDl: 140, ketoneMmolL: 0.82, eventAnnotation: 'Took Empagliflozin 10mg; skipped breakfast & bolus' },
      { hour: 7, timeLabel: '07:00', glucoseMgDl: 142, ketoneMmolL: 0.95 },
      { hour: 8, timeLabel: '08:00', glucoseMgDl: 145, ketoneMmolL: 1.12 },
      { hour: 9, timeLabel: '09:00', glucoseMgDl: 148, ketoneMmolL: 1.3 },
      { hour: 10, timeLabel: '10:00', glucoseMgDl: 146, ketoneMmolL: 1.52, eventAnnotation: 'CKM crosses 1.5 mmol/L ketonemia alert threshold' },
      { hour: 11, timeLabel: '11:00', glucoseMgDl: 150, ketoneMmolL: 1.75 },
      { hour: 12, timeLabel: '12:00', glucoseMgDl: 153, ketoneMmolL: 1.98 },
      { hour: 13, timeLabel: '13:00', glucoseMgDl: 151, ketoneMmolL: 2.2 },
      { hour: 14, timeLabel: '14:00', glucoseMgDl: 154, ketoneMmolL: 2.45 },
      { hour: 15, timeLabel: '15:00', glucoseMgDl: 156, ketoneMmolL: 2.72 },
      { hour: 16, timeLabel: '16:00', glucoseMgDl: 158, ketoneMmolL: 2.95 },
      { hour: 17, timeLabel: '17:00', glucoseMgDl: 160, ketoneMmolL: 3.18, eventAnnotation: 'CKM crosses 3.0 mmol/L DKA threshold despite glucose < 180 mg/dL' },
      { hour: 18, timeLabel: '18:00', glucoseMgDl: 159, ketoneMmolL: 3.35 },
      { hour: 19, timeLabel: '19:00', glucoseMgDl: 162, ketoneMmolL: 3.5 },
      { hour: 20, timeLabel: '20:00', glucoseMgDl: 164, ketoneMmolL: 3.62 },
      { hour: 21, timeLabel: '21:00', glucoseMgDl: 163, ketoneMmolL: 3.71 },
      { hour: 22, timeLabel: '22:00', glucoseMgDl: 166, ketoneMmolL: 3.79 },
      { hour: 23, timeLabel: '23:00', glucoseMgDl: 164, ketoneMmolL: 3.84 },
      { hour: 24, timeLabel: '24:00', glucoseMgDl: 165, ketoneMmolL: 3.9, eventAnnotation: 'Nausea & Kussmaul breathing onset; Glucose still 165 mg/dL' }
    ]
  },
  {
    id: 'somogyi-rebound',
    shortName: 'Preset 2: Nocturnal Hypo + Somogyi',
    title: 'Nocturnal Hypoglycemia with Somogyi Rebound',
    subtitle:
      'Unrecognized 03:00 AM hypoglycemia (48 mg/dL) triggering counter-regulatory hormone surge and morning rebound hyperglycemia.',
    clinicalTrapBadge: 'Dosing Trap: Morning Hyperglycemia Driven by Overnight Insulin Excess',
    patientContext: {
      age: 27,
      sex: 'M',
      diagnosis: 'Type 1 Diabetes Mellitus on MDI therapy',
      regimen: 'Insulin Detemir 28U QHS (recently up-titrated) + Aspart 1:8g carb ratio',
      sglt2InhibitorActive: false,
      sodiumMeqL: 139,
      potassiumMeqL: 4.2,
      chlorideMeqL: 103,
      bicarbonateMeqL: 24,
      bunMgDl: 15,
      creatinineMgDl: 0.9,
      venousPh: 7.39,
      clinicalHistorySummary:
        '27yo male reporting waking up with morning headaches, night sweats, and fasting fingerstick glucose > 250 mg/dL. Self-increased evening basal insulin twice this week, worsening morning peaks.'
    },
    series: [
      { hour: 0, timeLabel: '00:00', glucoseMgDl: 118, ketoneMmolL: 0.2 },
      { hour: 1, timeLabel: '01:00', glucoseMgDl: 92, ketoneMmolL: 0.22 },
      { hour: 2, timeLabel: '02:00', glucoseMgDl: 66, ketoneMmolL: 0.3, eventAnnotation: 'Crosses < 70 mg/dL Level 1 Hypoglycemia while asleep' },
      { hour: 3, timeLabel: '03:00', glucoseMgDl: 48, ketoneMmolL: 0.45, eventAnnotation: 'Nadir 48 mg/dL (Level 2 Hypo) -> Epinephrine/Glucagon/Cortisol surge' },
      { hour: 4, timeLabel: '04:00', glucoseMgDl: 62, ketoneMmolL: 0.62 },
      { hour: 5, timeLabel: '05:00', glucoseMgDl: 114, ketoneMmolL: 0.78 },
      { hour: 6, timeLabel: '06:00', glucoseMgDl: 178, ketoneMmolL: 0.88 },
      { hour: 7, timeLabel: '07:00', glucoseMgDl: 236, ketoneMmolL: 0.92, eventAnnotation: 'Hepatic glycogenolysis rebound surge' },
      { hour: 8, timeLabel: '08:00', glucoseMgDl: 268, ketoneMmolL: 0.85, eventAnnotation: 'Wakes with diaphoresis & fasting hyperglycemia (268 mg/dL)' },
      { hour: 9, timeLabel: '09:00', glucoseMgDl: 254, ketoneMmolL: 0.72 },
      { hour: 10, timeLabel: '10:00', glucoseMgDl: 215, ketoneMmolL: 0.55 },
      { hour: 11, timeLabel: '11:00', glucoseMgDl: 182, ketoneMmolL: 0.42 },
      { hour: 12, timeLabel: '12:00', glucoseMgDl: 158, ketoneMmolL: 0.32 },
      { hour: 13, timeLabel: '13:00', glucoseMgDl: 172, ketoneMmolL: 0.28 },
      { hour: 14, timeLabel: '14:00', glucoseMgDl: 164, ketoneMmolL: 0.25 },
      { hour: 15, timeLabel: '15:00', glucoseMgDl: 149, ketoneMmolL: 0.22 },
      { hour: 16, timeLabel: '16:00', glucoseMgDl: 138, ketoneMmolL: 0.2 },
      { hour: 17, timeLabel: '17:00', glucoseMgDl: 134, ketoneMmolL: 0.2 },
      { hour: 18, timeLabel: '18:00', glucoseMgDl: 145, ketoneMmolL: 0.21 },
      { hour: 19, timeLabel: '19:00', glucoseMgDl: 168, ketoneMmolL: 0.19 },
      { hour: 20, timeLabel: '20:00', glucoseMgDl: 156, ketoneMmolL: 0.18 },
      { hour: 21, timeLabel: '21:00', glucoseMgDl: 142, ketoneMmolL: 0.2 },
      { hour: 22, timeLabel: '22:00', glucoseMgDl: 130, ketoneMmolL: 0.22, eventAnnotation: 'Administers high evening basal dose (28U Detemir)' },
      { hour: 23, timeLabel: '23:00', glucoseMgDl: 112, ketoneMmolL: 0.24 },
      { hour: 24, timeLabel: '24:00', glucoseMgDl: 96, ketoneMmolL: 0.28 }
    ]
  },
  {
    id: 'hhs-vs-dka',
    shortName: 'Preset 3: Classic HHS vs DKA',
    title: 'Hyperglycemic Hyperosmolar State (HHS) Differentiation',
    subtitle:
      'Extreme hyperglycemia (685 mg/dL) and severe hyperosmolality (> 320 mOsm/kg) with minimal ketosis (< 1.0 mmol/L).',
    clinicalTrapBadge: 'Resuscitation Trap: Profound Osmotic Dehydration Without Ketoacidosis',
    patientContext: {
      age: 68,
      sex: 'M',
      diagnosis: 'Type 2 Diabetes Mellitus / Community-Acquired Pneumonia',
      regimen: 'Metformin 1000mg BID + Glimepiride 4mg QD (missed 4 days during febrile illness, poor oral fluid intake)',
      sglt2InhibitorActive: false,
      sodiumMeqL: 149,
      potassiumMeqL: 5.1,
      chlorideMeqL: 112,
      bicarbonateMeqL: 21,
      bunMgDl: 64,
      creatinineMgDl: 2.3,
      venousPh: 7.34,
      clinicalHistorySummary:
        '68yo male with progressive lethargy, polyuria, and profound mucosal dehydration over 4 days. Residual endogenous beta-cell insulin secretion suppresses lipolysis/ketogenesis while osmotic diuresis drives hypertonicity.'
    },
    series: [
      { hour: 0, timeLabel: '00:00', glucoseMgDl: 380, ketoneMmolL: 0.35 },
      { hour: 1, timeLabel: '01:00', glucoseMgDl: 392, ketoneMmolL: 0.36 },
      { hour: 2, timeLabel: '02:00', glucoseMgDl: 405, ketoneMmolL: 0.38 },
      { hour: 3, timeLabel: '03:00', glucoseMgDl: 418, ketoneMmolL: 0.4 },
      { hour: 4, timeLabel: '04:00', glucoseMgDl: 430, ketoneMmolL: 0.41 },
      { hour: 5, timeLabel: '05:00', glucoseMgDl: 444, ketoneMmolL: 0.42 },
      { hour: 6, timeLabel: '06:00', glucoseMgDl: 458, ketoneMmolL: 0.44 },
      { hour: 7, timeLabel: '07:00', glucoseMgDl: 472, ketoneMmolL: 0.45 },
      { hour: 8, timeLabel: '08:00', glucoseMgDl: 488, ketoneMmolL: 0.47 },
      { hour: 9, timeLabel: '09:00', glucoseMgDl: 502, ketoneMmolL: 0.49 },
      { hour: 10, timeLabel: '10:00', glucoseMgDl: 516, ketoneMmolL: 0.5 },
      { hour: 11, timeLabel: '11:00', glucoseMgDl: 530, ketoneMmolL: 0.52 },
      { hour: 12, timeLabel: '12:00', glucoseMgDl: 545, ketoneMmolL: 0.54, eventAnnotation: 'Osmotic diuresis worsens GFR contraction; glucose > 540 mg/dL' },
      { hour: 13, timeLabel: '13:00', glucoseMgDl: 558, ketoneMmolL: 0.56 },
      { hour: 14, timeLabel: '14:00', glucoseMgDl: 572, ketoneMmolL: 0.58 },
      { hour: 15, timeLabel: '15:00', glucoseMgDl: 585, ketoneMmolL: 0.6 },
      { hour: 16, timeLabel: '16:00', glucoseMgDl: 598, ketoneMmolL: 0.61 },
      { hour: 17, timeLabel: '17:00', glucoseMgDl: 612, ketoneMmolL: 0.63 },
      { hour: 18, timeLabel: '18:00', glucoseMgDl: 624, ketoneMmolL: 0.65, eventAnnotation: 'Effective serum osmolality crosses 320 mOsm/kg threshold' },
      { hour: 19, timeLabel: '19:00', glucoseMgDl: 636, ketoneMmolL: 0.66 },
      { hour: 20, timeLabel: '20:00', glucoseMgDl: 648, ketoneMmolL: 0.68 },
      { hour: 21, timeLabel: '21:00', glucoseMgDl: 658, ketoneMmolL: 0.69 },
      { hour: 22, timeLabel: '22:00', glucoseMgDl: 668, ketoneMmolL: 0.7 },
      { hour: 23, timeLabel: '23:00', glucoseMgDl: 676, ketoneMmolL: 0.71 },
      { hour: 24, timeLabel: '24:00', glucoseMgDl: 685, ketoneMmolL: 0.72, eventAnnotation: 'Severe hyperosmolar lethargy; Ketones remain < 1.0 mmol/L' }
    ]
  },
  {
    id: 'tir-controlled',
    shortName: 'Preset 4: Controlled T1D (TIR > 75%)',
    title: 'Well-Controlled Type 1 Diabetes (TIR > 75%)',
    subtitle:
      'Automated Insulin Delivery (AID) hybrid closed-loop maintaining stable euglycemia and basal ketone homeostasis (< 0.4 mmol/L).',
    clinicalTrapBadge: 'Physiological Baseline: 100% TIR & Basal Ketone Stability',
    patientContext: {
      age: 31,
      sex: 'F',
      diagnosis: 'Type 1 Diabetes Mellitus on Hybrid Closed-Loop AID Pump',
      regimen: 'Tandem Control-IQ / Dexcom G7 + Continuous Ketone Sensor',
      sglt2InhibitorActive: false,
      sodiumMeqL: 140,
      potassiumMeqL: 4.1,
      chlorideMeqL: 104,
      bicarbonateMeqL: 25,
      bunMgDl: 14,
      creatinineMgDl: 0.82,
      venousPh: 7.4,
      clinicalHistorySummary:
        '31yo female using automated insulin delivery with timely pre-meal boluses and stable basal modulation. Routine outpatient telemetry review.'
    },
    series: [
      { hour: 0, timeLabel: '00:00', glucoseMgDl: 108, ketoneMmolL: 0.15 },
      { hour: 1, timeLabel: '01:00', glucoseMgDl: 105, ketoneMmolL: 0.16 },
      { hour: 2, timeLabel: '02:00', glucoseMgDl: 102, ketoneMmolL: 0.18 },
      { hour: 3, timeLabel: '03:00', glucoseMgDl: 100, ketoneMmolL: 0.19 },
      { hour: 4, timeLabel: '04:00', glucoseMgDl: 98, ketoneMmolL: 0.2 },
      { hour: 5, timeLabel: '05:00', glucoseMgDl: 101, ketoneMmolL: 0.21 },
      { hour: 6, timeLabel: '06:00', glucoseMgDl: 106, ketoneMmolL: 0.22 },
      { hour: 7, timeLabel: '07:00', glucoseMgDl: 112, ketoneMmolL: 0.2, eventAnnotation: 'Breakfast pre-bolus (45g carbohydrates)' },
      { hour: 8, timeLabel: '08:00', glucoseMgDl: 148, ketoneMmolL: 0.15 },
      { hour: 9, timeLabel: '09:00', glucoseMgDl: 136, ketoneMmolL: 0.14 },
      { hour: 10, timeLabel: '10:00', glucoseMgDl: 121, ketoneMmolL: 0.15 },
      { hour: 11, timeLabel: '11:00', glucoseMgDl: 114, ketoneMmolL: 0.16 },
      { hour: 12, timeLabel: '12:00', glucoseMgDl: 110, ketoneMmolL: 0.18, eventAnnotation: 'Lunch pre-bolus (55g carbohydrates)' },
      { hour: 13, timeLabel: '13:00', glucoseMgDl: 156, ketoneMmolL: 0.14 },
      { hour: 14, timeLabel: '14:00', glucoseMgDl: 144, ketoneMmolL: 0.13 },
      { hour: 15, timeLabel: '15:00', glucoseMgDl: 128, ketoneMmolL: 0.15 },
      { hour: 16, timeLabel: '16:00', glucoseMgDl: 118, ketoneMmolL: 0.17 },
      { hour: 17, timeLabel: '17:00', glucoseMgDl: 115, ketoneMmolL: 0.22, eventAnnotation: '35-min aerobic exercise; temporary activity target active' },
      { hour: 18, timeLabel: '18:00', glucoseMgDl: 109, ketoneMmolL: 0.26 },
      { hour: 19, timeLabel: '19:00', glucoseMgDl: 124, ketoneMmolL: 0.2, eventAnnotation: 'Dinner pre-bolus (60g carbohydrates)' },
      { hour: 20, timeLabel: '20:00', glucoseMgDl: 162, ketoneMmolL: 0.16 },
      { hour: 21, timeLabel: '21:00', glucoseMgDl: 145, ketoneMmolL: 0.15 },
      { hour: 22, timeLabel: '22:00', glucoseMgDl: 131, ketoneMmolL: 0.15 },
      { hour: 23, timeLabel: '23:00', glucoseMgDl: 119, ketoneMmolL: 0.16 },
      { hour: 24, timeLabel: '24:00', glucoseMgDl: 112, ketoneMmolL: 0.17 }
    ]
  }
];
