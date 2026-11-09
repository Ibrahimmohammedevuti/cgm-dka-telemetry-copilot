import test from 'node:test';
import assert from 'node:assert/strict';
import { TELEMETRY_PRESETS } from './telemetryPresets';
import {
  appendSimulationSnapshot,
  computeCgmCkmDivergence,
  computeClinicalUrgencyScore,
  computeGlycemicVariabilityTrend,
  evaluateClinicalReasoningPipeline,
  SimulationSnapshot
} from './reasoningEngine';
import { buildPatientClinicalProfilePdfBytes } from './pdfClinicalNoteBuilder';

test('Preset 1 (Euglycemic DKA on SGLT2i) detects EUGLYCEMIC_DKA despite glucose < 180 mg/dL', () => {
  const preset1 = TELEMETRY_PRESETS.find((p) => p.id === 'euglycemic-dka')!;
  const result = evaluateClinicalReasoningPipeline(preset1);

  assert.equal(result.analytics.latestGlucoseMgDl, 165);
  assert.equal(result.analytics.latestKetoneMmolL, 3.9);
  assert.equal(result.classificationCode, 'EUGLYCEMIC_DKA');
  assert.equal(result.urgency, 'CRITICAL_ED_NOW');
  assert.equal(result.analytics.anionGapMeqL, 23); // 136 - (102 + 11) = 23
  assert.ok(
    result.ehrSmartPhrase.includes('Suspected SGLT2i') ||
      result.ehrSmartPhrase.includes('Euglycemic Diabetic Ketoacidosis')
  );
  assert.ok(result.patientSmsAlert.includes('STOP taking your SGLT2 pill'));
});

test('Preset 2 (Nocturnal Hypoglycemia with Somogyi Rebound) detects 03:00 AM nadir and advises basal reduction', () => {
  const preset2 = TELEMETRY_PRESETS.find((p) => p.id === 'somogyi-rebound')!;
  const result = evaluateClinicalReasoningPipeline(preset2);

  assert.equal(result.analytics.nocturnalNadirMgDl, 48);
  assert.equal(result.analytics.nocturnalNadirHour, 3);
  assert.equal(result.analytics.morningPeakMgDl, 268);
  assert.equal(result.classificationCode, 'SOMOGYI_REBOUND');
  assert.equal(result.urgency, 'URGENT_CLINICAL_ACTION');
  assert.ok(result.patientSmsAlert.includes('DO NOT increase your nighttime long-acting insulin'));
});

test('Preset 3 (Classic HHS vs DKA) computes Effective Osmolality > 320 mOsm/kg and differentiates from DKA', () => {
  const preset3 = TELEMETRY_PRESETS.find((p) => p.id === 'hhs-vs-dka')!;
  const result = evaluateClinicalReasoningPipeline(preset3);

  assert.equal(result.analytics.latestGlucoseMgDl, 685);
  assert.ok(result.analytics.effectiveOsmolalityMosmKg >= 330);
  assert.ok(result.analytics.latestKetoneMmolL < 1.0);
  assert.equal(result.classificationCode, 'HHS_HYPEROSMOLAR');
  assert.equal(result.urgency, 'CRITICAL_ED_NOW');
  assert.ok(result.immediateProtocolSteps[0].includes('BEFORE initiating insulin'));
});

test('Preset 4 (Well-Controlled T1D) achieves TIR > 75% and routine optimization status', () => {
  const preset4 = TELEMETRY_PRESETS.find((p) => p.id === 'tir-controlled')!;
  const result = evaluateClinicalReasoningPipeline(preset4);

  assert.ok(result.analytics.timeInRangePercent > 75);
  assert.equal(result.classificationCode, 'TIR_OPTIMAL');
  assert.equal(result.urgency, 'ROUTINE_OPTIMIZATION');
});

test('Custom parameter overrides dynamically re-classify normal preset into Euglycemic DKA when ketones surge', () => {
  const preset4 = TELEMETRY_PRESETS.find((p) => p.id === 'tir-controlled')!;
  const overridden = evaluateClinicalReasoningPipeline(preset4, {
    sglt2InhibitorActive: true,
    overrideLatestGlucoseMgDl: 155,
    overrideLatestKetoneMmolL: 3.4,
    overrideBicarbonateMeqL: 12,
    overrideVenousPh: 7.22
  });

  assert.equal(overridden.classificationCode, 'EUGLYCEMIC_DKA');
  assert.equal(overridden.urgency, 'CRITICAL_ED_NOW');
});

test('CGM-CKM Delta Divergence and Hourly Risk Zone indicator classify critical hours in Euglycemic DKA and nominal hours in Controlled T1D', () => {
  const preset1 = TELEMETRY_PRESETS.find((p) => p.id === 'euglycemic-dka')!;
  const div1 = computeCgmCkmDivergence(preset1.series);

  assert.ok(div1.totalHighRiskHours >= 15);
  assert.equal(div1.highRiskWindows.length, 1);
  assert.equal(div1.highRiskWindows[0].startHour, 9);
  assert.equal(div1.highRiskWindows[0].endHour, 24);
  assert.ok(div1.peakDivergenceIndex > 50);
  assert.equal(div1.criticalZoneHours, 16);
  assert.equal(div1.criticalZoneHours + div1.elevatedWatchHours + div1.nominalHours, 25);

  const preset4 = TELEMETRY_PRESETS.find((p) => p.id === 'tir-controlled')!;
  const div4 = computeCgmCkmDivergence(preset4.series);
  assert.equal(div4.totalHighRiskHours, 0);
  assert.equal(div4.criticalZoneHours, 0);
  assert.equal(div4.nominalHours, 25);
});

test('computeGlycemicVariabilityTrend computes 24h %CV, SD, and 4 diurnal quadrants accurately', () => {
  const preset2 = TELEMETRY_PRESETS.find((p) => p.id === 'somogyi-rebound')!;
  const gvSomogyi = computeGlycemicVariabilityTrend(preset2.series);

  assert.ok(gvSomogyi.overallCvPercent > 36.0);
  assert.equal(gvSomogyi.isStableVariability, false);
  assert.equal(gvSomogyi.quadrants.length, 4);
  assert.equal(gvSomogyi.glycemicAmplitudeMgDl, 220); // 268 - 48

  const preset4 = TELEMETRY_PRESETS.find((p) => p.id === 'tir-controlled')!;
  const gvControlled = computeGlycemicVariabilityTrend(preset4.series);
  assert.ok(gvControlled.overallCvPercent < 20.0);
  assert.equal(gvControlled.isStableVariability, true);
});

test('Simulation History ring buffer caps stored triage snapshots at 5 and computes calibrated urgency scores', () => {
  const preset1 = TELEMETRY_PRESETS.find((p) => p.id === 'euglycemic-dka')!;
  const decision1 = evaluateClinicalReasoningPipeline(preset1);
  const div1 = computeCgmCkmDivergence(preset1.series);
  const score1 = computeClinicalUrgencyScore(decision1, div1);

  const preset4 = TELEMETRY_PRESETS.find((p) => p.id === 'tir-controlled')!;
  const decision4 = evaluateClinicalReasoningPipeline(preset4);
  const div4 = computeCgmCkmDivergence(preset4.series);
  const score4 = computeClinicalUrgencyScore(decision4, div4);

  assert.ok(score1 >= 80);
  assert.ok(score4 <= 25);

  let history: SimulationSnapshot[] = [];
  for (let i = 1; i <= 7; i++) {
    history = appendSimulationSnapshot(
      history,
      {
        id: `snap-${i}`,
        timestampLabel: `12:0${i}`,
        presetId: 'euglycemic-dka',
        presetShortName: 'Preset 1',
        presetTitle: 'Euglycemic DKA',
        overrides: {},
        overrideSummaryText: 'Baseline',
        latestGlucoseMgDl: 165,
        latestKetoneMmolL: 3.9,
        bicarbonateMeqL: 11,
        sglt2InhibitorActive: true,
        glucoseCvPercent: 7.9,
        peakDivergenceIndex: 66.8,
        classificationCode: 'EUGLYCEMIC_DKA',
        classificationTitle: 'EuDKA',
        urgency: 'CRITICAL_ED_NOW',
        urgencyScore: score1
      },
      5
    );
  }

  assert.equal(history.length, 5);
  assert.equal(history[0].id, 'snap-7');
  assert.equal(history[4].id, 'snap-3');
});

test('buildPatientClinicalProfilePdfBytes generates a valid formatted PDF 1.4 clinical note distinct from EHR SmartPhrase', () => {
  const preset1 = TELEMETRY_PRESETS.find((p) => p.id === 'euglycemic-dka')!;
  const decision = evaluateClinicalReasoningPipeline(preset1);
  const divergence = computeCgmCkmDivergence(preset1.series);

  const pdfBytes = buildPatientClinicalProfilePdfBytes({
    preset: preset1,
    effectiveContext: preset1.patientContext,
    decision,
    divergence,
    generatedAtIso: '2026-11-08 23:16:00 UTC'
  });

  const pdfText = new TextDecoder().decode(pdfBytes);
  assert.ok(pdfText.startsWith('%PDF-1.4\n'));
  assert.ok(pdfText.includes('PATIENT CLINICAL PROFILE & ENDOCRINE TELEMETRY NOTE'));
  assert.ok(pdfText.includes('Empagliflozin'));
  assert.ok(pdfText.includes('CGM-CKM Delta Divergence:'));
  assert.ok(pdfText.trim().endsWith('%%EOF'));
});
