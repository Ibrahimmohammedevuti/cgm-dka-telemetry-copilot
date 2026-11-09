# GlucoKetone AI: Continuous CGM/CKM Telemetry & DKA Triage Copilot

**Author & Clinical Architect:** Dr. Ibrahim Mohammed (`MD | MDCN/R/107127`)  
**Domain:** Endocrinology, Critical Care Telemetry & Prompt-Engineered Clinical Decision Support  
**Guideline Alignment:** American Diabetes Association (ADA) Standards of Care & ISPAD Clinical Practice Consensus Guidelines

---

## 1. Executive Overview & Clinical Motivation

Continuous Glucose Monitoring (CGM) alone creates a dangerous blind spot in patients prescribed **SGLT2 inhibitors** (empagliflozin, dapagliflozin, canagliflozin) or experiencing starvation/illness ketosis. Because SGLT2 inhibitors lower the renal glucose excretion threshold and induce obligatory glycosuria ($80\text{–}100\text{ g/day}$), patients can develop life-threatening **Euglycemic Diabetic Ketoacidosis (euDKA)** with blood glucose readings below $200\text{ mg/dL}$ (often $140\text{–}170\text{ mg/dL}$).

When clinicians or patients query **naive zero-shot Large Language Models (LLMs)** with a glucose reading of $165\text{ mg/dL}$, standard models anchor on textbook hyperglycemia thresholds ($>250\text{ mg/dL}$) and output false reassurance—missing exponential rises in interstitial $\beta$-hydroxybutyrate ($\text{BHB} > 3.0\text{ mmol/L}$) and unmasked high-anion-gap metabolic acidosis.

**GlucoKetone AI** integrates dual-channel **24-hour Continuous Glucose Monitoring ($\text{mg/dL}$)** and **Continuous Interstitial Ketone Monitoring ($\text{mmol/L}$)** with a **3-Stage Constraint-Guided Clinical Reasoning Pipeline** to classify complex metabolic states and generate both **Physician EHR SmartPhrases** and **Empathetic Patient SMS Triage Instructions**.

---

## 2. Core Clinical Logic Gates & Mathematical Formulations

All physiological calculations and diagnostic logic gates are decoupled in `src/clinical/reasoningEngine.ts` and verified via deterministic unit tests (`src/clinical/reasoningEngine.test.ts`):

### A. Derived Electrolyte & Osmolar Equations
1. **Serum Anion Gap ($\text{AG}$):**
   $$\text{AG} = [\text{Na}^+] - ([\text{Cl}^-] + [\text{HCO}_3^-])$$
   *Clinical Gate:* $\text{AG} > 12\text{ mEq/L}$ flags High-Anion-Gap Metabolic Acidosis (`HAGMA_POSITIVE`).
2. **Katz / Hillier Hyperglycemia-Corrected Sodium:**
   $$\text{Na}^+_{\text{corrected}} = [\text{Na}^+_{\text{measured}}] + 0.016 \times \max(0, \text{Glucose}_{\text{mg/dL}} - 100)$$
3. **Effective Serum Osmolality (Tonicity):**
   $$\text{Osm}_{\text{eff}} = 2 \times [\text{Na}^+_{\text{measured}}] + \frac{\text{Glucose}_{\text{mg/dL}}}{18}$$
   *Clinical Gate:* $\text{Osm}_{\text{eff}} \ge 320\text{ mOsm/kg}$ with $\text{Glucose} \ge 600\text{ mg/dL}$ and $\text{BHB} < 1.5\text{ mmol/L}$ triggers the **Hyperglycemic Hyperosmolar State (HHS)** resuscitation protocol.
4. **Total Serum Osmolality:**
   $$\text{Osm}_{\text{total}} = 2 \times [\text{Na}^+_{\text{measured}}] + \frac{\text{Glucose}_{\text{mg/dL}}}{18} + \frac{\text{BUN}_{\text{mg/dL}}}{2.8}$$

### B. Diagnostic Decision Matrix (4 Core Telemetry Presets)

| Preset ID | Clinical Phenotype | CGM Glucose Trajectory | CKM $\beta$-Hydroxybutyrate Trajectory | Acid-Base & Osmolality Gate | Primary ADA / ISPAD Protocol Mandate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`euglycemic-dka`** | **Euglycemic DKA on SGLT2 Inhibitor** | $129\text{–}166\text{ mg/dL}$ (Latest: $165\text{ mg/dL}$) | Surges $0.40 \rightarrow 3.90\text{ mmol/L}$ ($\Delta +0.25\text{ mmol/L/hr}$) | $\text{pH } 7.21$, $\text{HCO}_3^-\ 11\text{ mEq/L}$, $\text{AG } 23\text{ mEq/L}$ | **Hold SGLT2i**; start simultaneous **IV Dextrose ($\text{D5W}/\text{D10W}$) + IV Regular Insulin ($0.1\text{ U/kg/hr}$)** to clear ketosis without inducing hypoglycemia. |
| **`somogyi-rebound`** | **Nocturnal Hypoglycemia + Somogyi Rebound** | Nadir $48\text{ mg/dL}$ at `03:00` $\rightarrow$ Rebound $268\text{ mg/dL}$ at `08:00` | Mild counter-regulatory rise ($0.20 \rightarrow 0.92\text{ mmol/L}$) | $\text{pH } 7.39$, $\text{HCO}_3^-\ 24\text{ mEq/L}$, $\text{AG } 12\text{ mEq/L}$ | **Do NOT increase evening basal insulin**; **reduce evening basal dose by $15\text{–}20\%$** and set nocturnal CGM low alarm at $80\text{ mg/dL}$. |
| **`hhs-vs-dka`** | **Classic HHS vs. DKA Differentiation** | Progressive rise $380 \rightarrow 685\text{ mg/dL}$ | Suppressed $< 1.0\text{ mmol/L}$ ($0.35 \rightarrow 0.72\text{ mmol/L}$) | $\text{Osm}_{\text{eff}}\ 336.1\text{ mOsm/kg}$, $\text{pH } 7.34$, $\text{HCO}_3^-\ 21\text{ mEq/L}$ | **Fluid resuscitation FIRST** ($1.0\text{–}1.5\text{ L } 0.9\%\text{ NaCl}$) prior to low-dose insulin ($0.05\text{ U/kg/hr}$) to prevent vascular collapse. |
| **`tir-controlled`** | **Well-Controlled T1D ($\text{TIR} > 75\%$)** | $98\text{–}162\text{ mg/dL}$ ($\text{TIR } 100\%$, $\text{CV } 14.9\%$) | Physiological homeostasis ($0.13\text{–}0.26\text{ mmol/L}$) | $\text{pH } 7.40$, $\text{HCO}_3^-\ 25\text{ mEq/L}$, $\text{AG } 11\text{ mEq/L}$ | Maintain Hybrid Closed-Loop AID parameters; avoid manual insulin stacking. |

---

## 3. Multi-Step Prompt Chaining Architecture

Rather than relying on unconstrained single-pass generation, **GlucoKetone AI** enforces a 3-stage sequential reasoning pipeline:

```text
[24h CGM + CKM Biosensor Streams + Medication/Electrolyte Context]
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: Telemetry Trend Extraction (GATE_01_MULTIMODAL_VECTOR)         │
│ • Extracts 24h TIR%, Glycemic CV%, 00:00–06:00 Nocturnal Nadir,         │
│   Morning Rebound Peak, CKM BHB Velocity (dK/dt), & SGLT2i Exposure.    │
└─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: Acid-Base & Electrolyte Risk Inference (GATE_02_ACID_BASE)     │
│ • Computes Anion Gap, Katz Corrected Na+, and Effective Osmolality.     │
│ • Hard Invariant: NEVER exclude DKA based on Glucose < 250 mg/dL when   │
│   Interstitial/Blood BHB >= 3.0 mmol/L or Anion Gap > 12 mEq/L.         │
└─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 3: ADA/ISPAD Guideline-Aligned Triage Action (GATE_03_PROTOCOL)   │
│ • Maps phenotype to disposition tier & generates dual-audience outputs: │
│   1. Physician EHR SmartPhrase (.GLUCOCOPILOT_TRIAGE)                   │
│   2. Empathetic, 6th-grade reading-level Patient SMS Triage Alert       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Modular Repository Architecture

```text
├── server.ts                            # Express + Vite full-stack server & /api/clinical/reason Gemini route
├── src/
│   ├── App.tsx                          # Primary clinical telemetry workspace & state orchestration
│   ├── clinical/
│   │   ├── telemetryPresets.ts          # 4 physiologically calibrated 24-hour CGM/CKM patient datasets
│   │   ├── reasoningEngine.ts           # Pure 3-stage clinical logic gates, acid-base math, EHR & SMS builders
│   │   └── reasoningEngine.test.ts      # Automated node:test unit suite verifying all clinical edge cases
│   └── components/
│       ├── TelemetryCanvasChart.tsx     # High-DPI HTML5 Canvas dual-axis CGM/CKM chart & crosshair probe
│       ├── ReasoningPipelineView.tsx    # 3-stage prompt pipeline inspector & Zero-Shot vs Constraint benchmark
│       └── AlertGeneratorPanel.tsx      # Physician EHR SmartPhrase & Patient SMS dispatch generator
└── README.md                            # Clinical logic gates & prompt architecture documentation
```

---

## 5. Verification & Testing

Run the deterministic unit test suite verifying all 4 presets and custom override edge cases:

```bash
npx --yes tsx --test src/clinical/reasoningEngine.test.ts
```

Start the full-stack clinical copilot server locally on port `3000`:

```bash
npm run dev
```
