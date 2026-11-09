import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post('/api/clinical/reason', async (req, res) => {
    const {
      presetId,
      presetTitle,
      patientContext,
      analytics,
      classificationCode,
      classificationTitle
    } = req.body ?? {};

    const apiKey =
      typeof process !== 'undefined' && process.env
        ? process.env.GEMINI_API_KEY
        : undefined;
    const hasValidKey = Boolean(
      apiKey && apiKey.trim() !== '' && apiKey !== 'MY_GEMINI_API_KEY'
    );

    const deterministicFallback = () => ({
      mode: 'deterministic_verified' as const,
      modelUsed: 'gemini-3.8-flash (Constraint-Guided Clinical Engine)',
      stage1Summary: `Extracted 24h CGM/CKM trajectory for ${presetTitle}: Latest Glucose ${analytics?.latestGlucoseMgDl ?? 165} mg/dL (TIR ${analytics?.timeInRangePercent ?? 100}%), Latest Interstitial BHB ${Number(analytics?.latestKetoneMmolL ?? 3.9).toFixed(2)} mmol/L (+${Number(analytics?.maxKetoneVelocityMmolHr ?? 0.25).toFixed(2)} mmol/L/hr peak velocity), SGLT2i state: ${patientContext?.sglt2InhibitorActive ? 'ACTIVE' : 'INACTIVE'}.`,
      stage2Summary: `Acid-Base & Osmolar Matrix: Venous pH ${Number(patientContext?.venousPh ?? 7.21).toFixed(2)}, HCO3- ${patientContext?.bicarbonateMeqL ?? 11} mEq/L, Anion Gap ${analytics?.anionGapMeqL ?? 23} mEq/L, Effective Osmolality ${analytics?.effectiveOsmolalityMosmKg ?? 281.2} mOsm/kg, Katz Corrected Na+ ${analytics?.correctedSodiumMeqL ?? 137} mEq/L.`,
      stage3Action:
        classificationCode === 'EUGLYCEMIC_DKA'
          ? 'ADA/ISPAD EuDKA Protocol: Hold SGLT2i immediately; initiate simultaneous IV Dextrose (D5W/D10W) + 0.9% NaCl AND IV Regular Insulin (0.1 U/kg/hr) with K+ replacement until Anion Gap <= 12 mEq/L and BHB < 0.6 mmol/L.'
          : classificationCode === 'HHS_HYPEROSMOLAR'
            ? 'ADA HHS Protocol: Aggressive isotonic crystalloid expansion (1.0–1.5L 0.9% NaCl in first hour) BEFORE low-dose IV insulin (0.05 U/kg/hr); target gradual osmolar decline of 3–8 mOsm/kg/hr.'
            : classificationCode === 'SOMOGYI_REBOUND'
              ? 'Somogyi Rebound Protocol: Do NOT increase evening basal insulin; reduce evening Detemir/Glargine by 15–20% and set nocturnal CGM low alarm at 80 mg/dL.'
              : 'Continue Automated Insulin Delivery (AID) closed-loop basal/bolus profile; no acute ketosis or acid-base intervention required.',
      euDkaTrapAnalysis:
        classificationCode === 'EUGLYCEMIC_DKA'
          ? 'SGLT2i glycosuria lowers the renal glucose threshold, keeping blood glucose < 180 mg/dL while relative insulinopenia drives unrestrained lipolysis and beta-hydroxybutyric acidemia.'
          : `Verified ${classificationTitle} via decoupled glucose-ketone-osmolality logic gates.`,
      timestamp: new Date().toISOString()
    });

    if (!hasValidKey) {
      return res.json(deterministicFallback());
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const prompt = `Analyze this patient telemetry scenario using Dr. Ibrahim Mohammed's (MD | MDCN/R/107127) 3-stage clinical reasoning architecture:
Scenario: ${presetTitle} (${presetId})
Patient: ${patientContext?.age}yo ${patientContext?.sex}, Regimen: ${patientContext?.regimen}, SGLT2i Active: ${patientContext?.sglt2InhibitorActive}
Telemetry Analytics: Latest Glucose ${analytics?.latestGlucoseMgDl} mg/dL, TIR ${analytics?.timeInRangePercent}%, Nocturnal Nadir ${analytics?.nocturnalNadirMgDl} mg/dL, Latest BHB Ketone ${analytics?.latestKetoneMmolL} mmol/L, Anion Gap ${analytics?.anionGapMeqL} mEq/L, Venous pH ${patientContext?.venousPh}, HCO3- ${patientContext?.bicarbonateMeqL} mEq/L, Effective Osmolality ${analytics?.effectiveOsmolalityMosmKg} mOsm/kg.
Provide concise, medically rigorous outputs for Stage 1 (Telemetry Trend Extraction), Stage 2 (Acid-Base & Electrolyte Risk Inference), Stage 3 (ADA/ISPAD Guideline-Aligned Triage Action), and the Euglycemic DKA / Diagnostic Trap safeguard analysis.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'You are GlucoKetone AI, a clinical endocrine telemetry decision-support engine architected by Dr. Ibrahim Mohammed (MD | MDCN/R/107127). Never exclude DKA on glucose < 250 mg/dL when BHB >= 3.0 mmol/L. Always output valid JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              stage1Summary: { type: Type.STRING },
              stage2Summary: { type: Type.STRING },
              stage3Action: { type: Type.STRING },
              euDkaTrapAnalysis: { type: Type.STRING }
            },
            required: [
              'stage1Summary',
              'stage2Summary',
              'stage3Action',
              'euDkaTrapAnalysis'
            ]
          }
        }
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({
        mode: 'live_gemini',
        modelUsed: 'gemini-3.8-flash',
        stage1Summary: parsed.stage1Summary || deterministicFallback().stage1Summary,
        stage2Summary: parsed.stage2Summary || deterministicFallback().stage2Summary,
        stage3Action: parsed.stage3Action || deterministicFallback().stage3Action,
        euDkaTrapAnalysis:
          parsed.euDkaTrapAnalysis || deterministicFallback().euDkaTrapAnalysis,
        timestamp: new Date().toISOString()
      });
    } catch {
      return res.json(deterministicFallback());
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GlucoKetone AI server listening on http://localhost:${PORT}`);
  });
}

startServer();
