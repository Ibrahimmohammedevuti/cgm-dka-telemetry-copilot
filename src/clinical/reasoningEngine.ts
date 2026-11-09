import { PatientLabContext, TelemetryPoint, TelemetryPreset } from './telemetryPresets';

export interface TelemetryAnalytics {
  latestGlucoseMgDl: number;
  meanGlucoseMgDl: number;
  minGlucoseMgDl: number;
  maxGlucoseMgDl: number;
  nocturnalNadirMgDl: number;
  nocturnalNadirHour: number;
  morningPeakMgDl: number;
  glucoseCvPercent: number;
  timeInRangePercent: number; // 70 - 180 mg/dL
  timeBelowRangePercent: number; // < 70 mg/dL
  timeAboveRangePercent: number; // > 180 mg/dL
  latestKetoneMmolL: number;
  peakKetoneMmolL: number;
  maxKetoneVelocityMmolHr: number;
  sixHourKetoneDelta: number;
  anionGapMeqL: number;
  correctedSodiumMeqL: number;
  effectiveOsmolalityMosmKg: number;
  totalOsmolalityMosmKg: number;
}

export type TriageUrgency = 'CRITICAL_ED_NOW' | 'URGENT_CLINICAL_ACTION' | 'ROUTINE_OPTIMIZATION';

export interface ReasoningStageOutput {
  stageNumber: 1 | 2 | 3;
  stageTitle: string;
  promptGateIdentifier: string;
  systemConstraintUsed: string;
  extractedFindings: string[];
  clinicalSynthesis: string;
  triggeredLogicGates: string[];
}

export interface PromptComparisonAudit {
  scenarioLabel: string;
  naiveZeroShotPrompt: string;
  naiveZeroShotOutput: string;
  naiveFailureMechanism: string;
  constraintGuidedSystemPrompt: string;
  constraintGuidedOutput: string;
  clinicalSafeguardAdvantage: string;
}

export interface ClinicalDecisionResult {
  classificationCode: 'EUGLYCEMIC_DKA' | 'CLASSIC_DKA' | 'HHS_HYPEROSMOLAR' | 'SOMOGYI_REBOUND' | 'TIR_OPTIMAL' | 'KETONEMIA_WARNING';
  classificationTitle: string;
  urgency: TriageUrgency;
  urgencyLabel: string;
  confidenceRationale: string;
  analytics: TelemetryAnalytics;
  stages: [ReasoningStageOutput, ReasoningStageOutput, ReasoningStageOutput];
  promptComparison: PromptComparisonAudit;
  ehrSmartPhrase: string;
  patientSmsAlert: string;
  immediateProtocolSteps: string[];
}

export interface CustomTelemetryOverrides {
  sglt2InhibitorActive?: boolean;
  overrideLatestGlucoseMgDl?: number;
  overrideLatestKetoneMmolL?: number;
  overrideBicarbonateMeqL?: number;
  overrideVenousPh?: number;
  overrideSodiumMeqL?: number;
}

export type HourlyRiskZone = 'NOMINAL' | 'ELEVATED_WATCH' | 'CRITICAL_DIVERGENCE';

export interface DivergencePointAnalysis {
  hour: number;
  timeLabel: string;
  glucoseMgDl: number;
  ketoneMmolL: number;
  deltaGlucoseMgDlHr: number;
  deltaKetoneMmolHr: number;
  divergenceIndex: number; // 0 to 100 scale measuring decoupling between CGM and CKM
  isHighRiskDivergence: boolean;
  riskZone: HourlyRiskZone;
  divergenceReason?: string;
}

export interface DivergenceWindow {
  startHour: number;
  endHour: number;
  startLabel: string;
  endLabel: string;
  peakDivergenceIndex: number;
  mechanismLabel: string;
}

export interface TelemetryDivergenceSummary {
  points: DivergencePointAnalysis[];
  highRiskWindows: DivergenceWindow[];
  totalHighRiskHours: number;
  criticalZoneHours: number;
  elevatedWatchHours: number;
  nominalHours: number;
  peakDivergenceIndex: number;
  dominantMechanism: string;
}

export interface GlycemicQuadrantSegment {
  id: 'nocturnal' | 'morning' | 'afternoon' | 'evening';
  label: string;
  hourRangeLabel: string;
  meanMgDl: number;
  sdMgDl: number;
  cvPercent: number;
  minMgDl: number;
  maxMgDl: number;
  isHighVariability: boolean;
}

export interface GlycemicVariabilityTrend {
  overallCvPercent: number;
  standardDeviationMgDl: number;
  meanGlucoseMgDl: number;
  glycemicAmplitudeMgDl: number;
  adaTargetThresholdPercent: number; // 36.0%
  isStableVariability: boolean;
  stabilityClassification: string;
  clinicalInterpretation: string;
  quadrants: GlycemicQuadrantSegment[];
}

export interface SimulationSnapshot {
  id: string;
  timestampLabel: string;
  presetId: TelemetryPreset['id'];
  presetShortName: string;
  presetTitle: string;
  overrides: CustomTelemetryOverrides;
  overrideSummaryText: string;
  latestGlucoseMgDl: number;
  latestKetoneMmolL: number;
  bicarbonateMeqL: number;
  sglt2InhibitorActive: boolean;
  glucoseCvPercent: number;
  peakDivergenceIndex: number;
  classificationCode: ClinicalDecisionResult['classificationCode'];
  classificationTitle: string;
  urgency: TriageUrgency;
  urgencyScore: number; // 0 to 100 calibrated clinical urgency score
}

export function computeCgmCkmDivergence(
  series: TelemetryPoint[],
  maxGlucoseScale = 350
): TelemetryDivergenceSummary {
  const points: DivergencePointAnalysis[] = series.map((pt, idx) => {
    const prev = idx > 0 ? series[idx - 1] : pt;
    const dt = idx > 0 ? Math.max(1, pt.hour - prev.hour) : 1;
    const deltaGlucoseMgDlHr = Number(((pt.glucoseMgDl - prev.glucoseMgDl) / dt).toFixed(1));
    const deltaKetoneMmolHr = Number(((pt.ketoneMmolL - prev.ketoneMmolL) / dt).toFixed(2));

    // Normalized positions [0..1]
    const normG = Math.min(1, Math.max(0, pt.glucoseMgDl / maxGlucoseScale));
    const normK = Math.min(1, Math.max(0, pt.ketoneMmolL / 5.0));

    // Evaluate clinical divergence modes:
    // Mode 1: Euglycemic Ketogenesis (CKM >= 1.5 mmol/L while Glucose < 220 mg/dL, or dK/dt >= 0.18 with flat glucose)
    const isEuDkaDivergence =
      (pt.ketoneMmolL >= 1.5 && pt.glucoseMgDl < 220) ||
      (deltaKetoneMmolHr >= 0.18 && pt.glucoseMgDl < 200);

    // Mode 2: Hyperosmolar Non-Ketotic Divergence (Glucose >= 520 mg/dL while Ketone < 1.0 mmol/L)
    const isHhsDivergence = pt.glucoseMgDl >= 520 && pt.ketoneMmolL < 1.0;

    // Mode 3: Acute Nocturnal Hypoglycemia / Counter-Regulatory Rebound Surge
    const isSomogyiDivergence =
      pt.glucoseMgDl < 70 || (Math.abs(deltaGlucoseMgDlHr) >= 40 && pt.ketoneMmolL >= 0.45);

    const isHighRiskDivergence = isEuDkaDivergence || isHhsDivergence || isSomogyiDivergence;

    // Deviation from physiological homeostasis (Glucose 70-180 mg/dL, Ketones <= 0.5 mmol/L)
    const glycemicDeviation =
      pt.glucoseMgDl < 70
        ? (70 - pt.glucoseMgDl) / 40
        : pt.glucoseMgDl > 180
          ? (pt.glucoseMgDl - 180) / Math.max(200, maxGlucoseScale - 180)
          : 0;
    const ketoneDeviation = Math.max(0, (pt.ketoneMmolL - 0.4) / 4.0);

    const decouplingSpread = Math.abs(ketoneDeviation - glycemicDeviation) * 85;
    const velocityBoost = Math.min(
      30,
      Math.max(0, deltaKetoneMmolHr - 0.05) * 90 +
        Math.max(0, Math.abs(deltaGlucoseMgDlHr) - 25) * 0.5
    );
    const clinicalDecouplingBonus = isEuDkaDivergence
      ? 22 + (pt.ketoneMmolL / 4.0) * 18
      : isHhsDivergence
        ? 25
        : isSomogyiDivergence
          ? 24
          : 0;
    const divergenceIndex = Number(
      Math.min(100, decouplingSpread + velocityBoost + clinicalDecouplingBonus).toFixed(1)
    );

    // Determine Hourly Risk Zone Tier
    let riskZone: HourlyRiskZone = 'NOMINAL';
    if (
      isHighRiskDivergence ||
      pt.ketoneMmolL >= 3.0 ||
      pt.glucoseMgDl < 54 ||
      pt.glucoseMgDl >= 520
    ) {
      riskZone = 'CRITICAL_DIVERGENCE';
    } else if (
      pt.ketoneMmolL >= 0.8 ||
      pt.glucoseMgDl < 70 ||
      pt.glucoseMgDl > 180 ||
      divergenceIndex >= 28
    ) {
      riskZone = 'ELEVATED_WATCH';
    }

    let divergenceReason: string | undefined;
    if (isEuDkaDivergence) {
      divergenceReason = `EuDKA Decoupling: Ketones ${pt.ketoneMmolL.toFixed(2)} mmol/L (Δ+${deltaKetoneMmolHr.toFixed(2)}/hr) vs euglycemic CGM ${pt.glucoseMgDl} mg/dL`;
    } else if (isHhsDivergence) {
      divergenceReason = `Hyperosmolar Decoupling: Extreme CGM ${pt.glucoseMgDl} mg/dL with suppressed CKM ${pt.ketoneMmolL.toFixed(2)} mmol/L`;
    } else if (isSomogyiDivergence) {
      divergenceReason =
        pt.glucoseMgDl < 70
          ? `Nocturnal Neuroglycopenia (${pt.glucoseMgDl} mg/dL) triggering counter-regulatory ketogenesis`
          : `Rapid Somogyi Rebound (Δ${deltaGlucoseMgDlHr > 0 ? '+' : ''}${deltaGlucoseMgDlHr} mg/dL/hr) with lag ketonemia`;
    }

    return {
      hour: pt.hour,
      timeLabel: pt.timeLabel,
      glucoseMgDl: pt.glucoseMgDl,
      ketoneMmolL: pt.ketoneMmolL,
      deltaGlucoseMgDlHr,
      deltaKetoneMmolHr,
      divergenceIndex,
      isHighRiskDivergence,
      riskZone,
      divergenceReason
    };
  });

  // Group contiguous high-risk hours into windows
  const highRiskWindows: DivergenceWindow[] = [];
  let currentStart: DivergencePointAnalysis | null = null;
  let currentPeak = 0;
  let currentMechanism = '';

  points.forEach((pt, idx) => {
    if (pt.isHighRiskDivergence) {
      if (!currentStart) {
        currentStart = pt;
        currentPeak = pt.divergenceIndex;
        currentMechanism = pt.divergenceReason ?? 'High-Risk CGM/CKM Divergence';
      } else {
        if (pt.divergenceIndex > currentPeak) {
          currentPeak = pt.divergenceIndex;
          currentMechanism = pt.divergenceReason ?? currentMechanism;
        }
      }
    }
    const isLast = idx === points.length - 1;
    if ((!pt.isHighRiskDivergence || isLast) && currentStart) {
      const endPt = pt.isHighRiskDivergence ? pt : points[idx - 1];
      highRiskWindows.push({
        startHour: currentStart.hour,
        endHour: endPt.hour,
        startLabel: currentStart.timeLabel,
        endLabel: endPt.timeLabel,
        peakDivergenceIndex: currentPeak,
        mechanismLabel: currentMechanism
      });
      currentStart = null;
      currentPeak = 0;
    }
  });

  const totalHighRiskHours = points.filter((p) => p.isHighRiskDivergence).length;
  const criticalZoneHours = points.filter((p) => p.riskZone === 'CRITICAL_DIVERGENCE').length;
  const elevatedWatchHours = points.filter((p) => p.riskZone === 'ELEVATED_WATCH').length;
  const nominalHours = points.filter((p) => p.riskZone === 'NOMINAL').length;
  const peakDivergenceIndex = Number(
    Math.max(0, ...points.map((p) => p.divergenceIndex)).toFixed(1)
  );

  const dominantMechanism =
    highRiskWindows[0]?.mechanismLabel ??
    'Physiological Concordance (CGM & CKM homeostatically coupled)';

  return {
    points,
    highRiskWindows,
    totalHighRiskHours,
    criticalZoneHours,
    elevatedWatchHours,
    nominalHours,
    peakDivergenceIndex,
    dominantMechanism
  };
}

export function computeGlycemicVariabilityTrend(
  series: TelemetryPoint[]
): GlycemicVariabilityTrend {
  const glucoses = series.map((p) => p.glucoseMgDl);
  const meanGlucoseMgDl = Number(
    (glucoses.reduce((acc, v) => acc + v, 0) / glucoses.length).toFixed(1)
  );
  const variance =
    glucoses.reduce((acc, v) => acc + Math.pow(v - meanGlucoseMgDl, 2), 0) /
    glucoses.length;
  const standardDeviationMgDl = Number(Math.sqrt(variance).toFixed(1));
  const overallCvPercent = Number(
    ((standardDeviationMgDl / meanGlucoseMgDl) * 100).toFixed(1)
  );
  const glycemicAmplitudeMgDl = Math.max(...glucoses) - Math.min(...glucoses);
  const adaTargetThresholdPercent = 36.0;
  const isStableVariability = overallCvPercent <= adaTargetThresholdPercent;

  const quadrantDefs: Array<{
    id: GlycemicQuadrantSegment['id'];
    label: string;
    hourRangeLabel: string;
    startHr: number;
    endHr: number;
  }> = [
    { id: 'nocturnal', label: 'Nocturnal Window', hourRangeLabel: '00:00–06:00', startHr: 0, endHr: 6 },
    { id: 'morning', label: 'Morning Window', hourRangeLabel: '06:00–12:00', startHr: 6, endHr: 12 },
    { id: 'afternoon', label: 'Afternoon Window', hourRangeLabel: '12:00–18:00', startHr: 12, endHr: 18 },
    { id: 'evening', label: 'Evening Window', hourRangeLabel: '18:00–24:00', startHr: 18, endHr: 24 }
  ];

  const quadrants: GlycemicQuadrantSegment[] = quadrantDefs.map((q) => {
    const pts = series.filter((p) => p.hour >= q.startHr && p.hour <= q.endHr);
    const vals = pts.map((p) => p.glucoseMgDl);
    const qMean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const qVar = vals.reduce((a, b) => a + Math.pow(b - qMean, 2), 0) / vals.length;
    const qSd = Math.sqrt(qVar);
    const qCv = Number(((qSd / qMean) * 100).toFixed(1));
    return {
      id: q.id,
      label: q.label,
      hourRangeLabel: q.hourRangeLabel,
      meanMgDl: Number(qMean.toFixed(1)),
      sdMgDl: Number(qSd.toFixed(1)),
      cvPercent: qCv,
      minMgDl: Math.min(...vals),
      maxMgDl: Math.max(...vals),
      isHighVariability: qCv > 25.0 || Math.max(...vals) - Math.min(...vals) >= 90
    };
  });

  const maxKetone = Math.max(...series.map((p) => p.ketoneMmolL));
  let clinicalInterpretation = '';
  if (!isStableVariability) {
    clinicalInterpretation = `High 24h Glycemic Variability (CV ${overallCvPercent}% > 36% ADA threshold; amplitude ${glycemicAmplitudeMgDl} mg/dL) indicates labile counter-regulatory swings and elevated hypoglycemia/rebound risk.`;
  } else if (maxKetone >= 3.0) {
    clinicalInterpretation = `Deceptive Glycemic Stability Trap: 24h CGM CV is low (${overallCvPercent}% <= 36% threshold), but SGLT2i glycosuria is clamping glucose variance while interstitial ketones surge to ${maxKetone.toFixed(2)} mmol/L.`;
  } else {
    clinicalInterpretation = `Glycemic Variability is within the international consensus target (CV ${overallCvPercent}% <= 36.0%; SD ${standardDeviationMgDl} mg/dL), reflecting stable glycemic modulation.`;
  }

  return {
    overallCvPercent,
    standardDeviationMgDl,
    meanGlucoseMgDl,
    glycemicAmplitudeMgDl,
    adaTargetThresholdPercent,
    isStableVariability,
    stabilityClassification: isStableVariability
      ? 'STABLE GV (CV <= 36%)'
      : 'LABILE / HIGH GV (CV > 36%)',
    clinicalInterpretation,
    quadrants
  };
}

export function computeClinicalUrgencyScore(
  decision: ClinicalDecisionResult,
  divergence: TelemetryDivergenceSummary
): number {
  const { analytics } = decision;
  let score = 12;

  // Ketone contribution (up to 45 pts)
  if (analytics.latestKetoneMmolL >= 3.0) {
    score += 45 + Math.min(10, (analytics.latestKetoneMmolL - 3.0) * 8);
  } else if (analytics.latestKetoneMmolL >= 1.5) {
    score += 28 + (analytics.latestKetoneMmolL - 1.5) * 10;
  } else if (analytics.latestKetoneMmolL >= 0.8) {
    score += 12;
  }

  // Acid-base / Anion Gap contribution (up to 25 pts)
  if (analytics.anionGapMeqL > 16) {
    score += 24;
  } else if (analytics.anionGapMeqL > 12) {
    score += 14;
  }

  // Hyperosmolality contribution (up to 45 pts)
  if (analytics.effectiveOsmolalityMosmKg >= 320) {
    score += 48;
  } else if (analytics.effectiveOsmolalityMosmKg >= 305) {
    score += 22;
  }

  // Nocturnal neuroglycopenia / Somogyi contribution (up to 35 pts)
  if (analytics.nocturnalNadirMgDl < 54) {
    score += 36;
  } else if (analytics.nocturnalNadirMgDl < 70) {
    score += 24;
  }

  // Divergence & CV contribution
  score += Math.min(14, divergence.peakDivergenceIndex * 0.16);
  if (analytics.glucoseCvPercent > 36) {
    score += 8;
  }

  if (decision.classificationCode === 'TIR_OPTIMAL') {
    return Math.min(22, Math.max(8, Math.round(score * 0.45)));
  }

  return Math.min(99, Math.max(10, Math.round(score)));
}

export function formatOverrideSummary(
  preset: TelemetryPreset,
  overrides: CustomTelemetryOverrides
): string {
  const parts: string[] = [];
  if (
    overrides.sglt2InhibitorActive !== undefined &&
    overrides.sglt2InhibitorActive !== preset.patientContext.sglt2InhibitorActive
  ) {
    parts.push(`SGLT2i: ${overrides.sglt2InhibitorActive ? 'ON' : 'OFF'}`);
  }
  if (overrides.overrideLatestGlucoseMgDl !== undefined) {
    parts.push(`CGM: ${overrides.overrideLatestGlucoseMgDl} mg/dL`);
  }
  if (overrides.overrideLatestKetoneMmolL !== undefined) {
    parts.push(`CKM: ${overrides.overrideLatestKetoneMmolL.toFixed(2)} mmol/L`);
  }
  if (overrides.overrideBicarbonateMeqL !== undefined) {
    parts.push(`HCO3-: ${overrides.overrideBicarbonateMeqL} mEq/L`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Baseline Preset (No Overrides)';
}

export function appendSimulationSnapshot(
  existing: SimulationSnapshot[],
  nextSnapshot: SimulationSnapshot,
  maxSnapshots = 5
): SimulationSnapshot[] {
  const filtered = existing.filter((item) => item.id !== nextSnapshot.id);
  return [nextSnapshot, ...filtered].slice(0, maxSnapshots);
}

export function computeTelemetryAnalytics(
  series: TelemetryPoint[],
  context: PatientLabContext,
  overrides?: CustomTelemetryOverrides
): TelemetryAnalytics {
  const modifiedSeries = series.map((pt, idx) => {
    if (idx === series.length - 1) {
      return {
        ...pt,
        glucoseMgDl: overrides?.overrideLatestGlucoseMgDl ?? pt.glucoseMgDl,
        ketoneMmolL: overrides?.overrideLatestKetoneMmolL ?? pt.ketoneMmolL
      };
    }
    return pt;
  });

  const glucoses = modifiedSeries.map((p) => p.glucoseMgDl);
  const ketones = modifiedSeries.map((p) => p.ketoneMmolL);

  const latestGlucoseMgDl = glucoses[glucoses.length - 1];
  const meanGlucoseMgDl = Number(
    (glucoses.reduce((acc, v) => acc + v, 0) / glucoses.length).toFixed(1)
  );
  const minGlucoseMgDl = Math.min(...glucoses);
  const maxGlucoseMgDl = Math.max(...glucoses);

  // Nocturnal window: hours 0..6
  const nocturnalPoints = modifiedSeries.filter((p) => p.hour >= 0 && p.hour <= 6);
  let nocturnalNadirMgDl = nocturnalPoints[0]?.glucoseMgDl ?? minGlucoseMgDl;
  let nocturnalNadirHour = nocturnalPoints[0]?.hour ?? 0;
  for (const pt of nocturnalPoints) {
    if (pt.glucoseMgDl < nocturnalNadirMgDl) {
      nocturnalNadirMgDl = pt.glucoseMgDl;
      nocturnalNadirHour = pt.hour;
    }
  }

  // Morning window: hours 6..10
  const morningPoints = modifiedSeries.filter((p) => p.hour >= 6 && p.hour <= 10);
  const morningPeakMgDl = Math.max(...morningPoints.map((p) => p.glucoseMgDl));

  // Standard deviation & CV%
  const variance =
    glucoses.reduce((acc, val) => acc + Math.pow(val - meanGlucoseMgDl, 2), 0) /
    glucoses.length;
  const sd = Math.sqrt(variance);
  const glucoseCvPercent = Number(((sd / meanGlucoseMgDl) * 100).toFixed(1));

  // Time in Range (70 - 180 mg/dL inclusive)
  const inRangeCount = glucoses.filter((g) => g >= 70 && g <= 180).length;
  const belowRangeCount = glucoses.filter((g) => g < 70).length;
  const aboveRangeCount = glucoses.filter((g) => g > 180).length;

  const timeInRangePercent = Math.round((inRangeCount / glucoses.length) * 100);
  const timeBelowRangePercent = Math.round((belowRangeCount / glucoses.length) * 100);
  const timeAboveRangePercent = Math.max(
    0,
    100 - timeInRangePercent - timeBelowRangePercent
  );

  const latestKetoneMmolL = Number(ketones[ketones.length - 1].toFixed(2));
  const peakKetoneMmolL = Number(Math.max(...ketones).toFixed(2));

  let maxKetoneVelocityMmolHr = 0;
  for (let i = 1; i < modifiedSeries.length; i++) {
    const dt = modifiedSeries[i].hour - modifiedSeries[i - 1].hour || 1;
    const dK = (modifiedSeries[i].ketoneMmolL - modifiedSeries[i - 1].ketoneMmolL) / dt;
    if (dK > maxKetoneVelocityMmolHr) {
      maxKetoneVelocityMmolHr = dK;
    }
  }
  maxKetoneVelocityMmolHr = Number(maxKetoneVelocityMmolHr.toFixed(2));

  const lookbackIdx = Math.max(0, modifiedSeries.length - 7);
  const sixHourKetoneDelta = Number(
    (latestKetoneMmolL - modifiedSeries[lookbackIdx].ketoneMmolL).toFixed(2)
  );

  const sodium = overrides?.overrideSodiumMeqL ?? context.sodiumMeqL;
  const bicarb = overrides?.overrideBicarbonateMeqL ?? context.bicarbonateMeqL;
  const anionGapMeqL = Number((sodium - (context.chlorideMeqL + bicarb)).toFixed(1));

  // Katz / Hillier corrected sodium: Na + 0.016 * (Glucose - 100)
  const correctedSodiumMeqL = Number(
    (sodium + 0.016 * Math.max(0, latestGlucoseMgDl - 100)).toFixed(1)
  );

  // Effective osmolality = 2 * Na + Glucose / 18
  const effectiveOsmolalityMosmKg = Number(
    (2 * sodium + latestGlucoseMgDl / 18).toFixed(1)
  );

  // Total osmolality = 2 * Na + Glucose / 18 + BUN / 2.8
  const totalOsmolalityMosmKg = Number(
    (effectiveOsmolalityMosmKg + context.bunMgDl / 2.8).toFixed(1)
  );

  return {
    latestGlucoseMgDl,
    meanGlucoseMgDl,
    minGlucoseMgDl,
    maxGlucoseMgDl,
    nocturnalNadirMgDl,
    nocturnalNadirHour,
    morningPeakMgDl,
    glucoseCvPercent,
    timeInRangePercent,
    timeBelowRangePercent,
    timeAboveRangePercent,
    latestKetoneMmolL,
    peakKetoneMmolL,
    maxKetoneVelocityMmolHr,
    sixHourKetoneDelta,
    anionGapMeqL,
    correctedSodiumMeqL,
    effectiveOsmolalityMosmKg,
    totalOsmolalityMosmKg
  };
}

export function evaluateClinicalReasoningPipeline(
  preset: TelemetryPreset,
  overrides?: CustomTelemetryOverrides
): ClinicalDecisionResult {
  const effectiveContext: PatientLabContext = {
    ...preset.patientContext,
    sglt2InhibitorActive:
      overrides?.sglt2InhibitorActive ?? preset.patientContext.sglt2InhibitorActive,
    bicarbonateMeqL:
      overrides?.overrideBicarbonateMeqL ?? preset.patientContext.bicarbonateMeqL,
    venousPh: overrides?.overrideVenousPh ?? preset.patientContext.venousPh,
    sodiumMeqL: overrides?.overrideSodiumMeqL ?? preset.patientContext.sodiumMeqL
  };

  const analytics = computeTelemetryAnalytics(
    preset.series,
    effectiveContext,
    overrides
  );

  const isKetonemiaCritical = analytics.latestKetoneMmolL >= 3.0 || analytics.peakKetoneMmolL >= 3.0;
  const isKetonemiaElevated = analytics.latestKetoneMmolL >= 1.5;
  const isAcidotic = effectiveContext.venousPh < 7.3 || effectiveContext.bicarbonateMeqL < 18;
  const isHighAnionGap = analytics.anionGapMeqL > 12;
  const isGlucoseEuglycemicRange = analytics.latestGlucoseMgDl < 250;
  const isSevereHyperosmolar =
    analytics.latestGlucoseMgDl >= 600 &&
    analytics.effectiveOsmolalityMosmKg >= 320 &&
    analytics.latestKetoneMmolL < 1.5;
  const isSomogyiPattern =
    analytics.nocturnalNadirMgDl < 70 &&
    analytics.morningPeakMgDl >= 200 &&
    analytics.latestKetoneMmolL < 1.5 &&
    !isAcidotic;

  // Determine classification
  let classificationCode: ClinicalDecisionResult['classificationCode'] = 'TIR_OPTIMAL';
  let classificationTitle = 'Well-Controlled Glycemic & Ketone Homeostasis (ADA TIR Goal Met)';
  let urgency: TriageUrgency = 'ROUTINE_OPTIMIZATION';
  let urgencyLabel = 'Routine Outpatient Telemetry Continuation';
  let confidenceRationale = '';
  let immediateProtocolSteps: string[] = [];

  if ((isKetonemiaCritical || (isKetonemiaElevated && isAcidotic)) && isGlucoseEuglycemicRange) {
    classificationCode = 'EUGLYCEMIC_DKA';
    classificationTitle = 'Euglycemic Diabetic Ketoacidosis (euDKA — SGLT2i / Starvation-Induced)';
    urgency = 'CRITICAL_ED_NOW';
    urgencyLabel = 'Critical Emergency: Immediate ED Resuscitation Required';
    confidenceRationale = `Interstitial BHB reached ${analytics.latestKetoneMmolL.toFixed(2)} mmol/L (>= 3.0 mmol/L threshold) with Anion Gap ${analytics.anionGapMeqL} mEq/L, HCO3- ${effectiveContext.bicarbonateMeqL} mEq/L, and pH ${effectiveContext.venousPh.toFixed(2)} despite deceptive glucose of ${analytics.latestGlucoseMgDl} mg/dL (< 250 mg/dL).`;
    immediateProtocolSteps = [
      'HOLD all SGLT2 inhibitors (Empagliflozin/Dapagliflozin/Canagliflozin) immediately; do not resume until acute illness and ketosis fully resolve.',
      'Initiate simultaneous IV Regular Insulin (0.1 units/kg/hr) AND Dextrose-containing IV fluids (D5W or D10W with 0.9%/0.45% NaCl) immediately because baseline blood glucose is < 250 mg/dL — insulin is mandatory to halt hormone-sensitive lipase ketogenesis, while dextrose prevents iatrogenic hypoglycemia.',
      'Verify serum potassium prior to insulin initiation (Current K+ ' +
        effectiveContext.potassiumMeqL.toFixed(1) +
        ' mEq/L; add 20–40 mEq KCl/L to IV fluids while K+ is 3.5–5.2 mEq/L and urine output is adequate).',
      'Monitor capillary/interstitial beta-hydroxybutyrate, venous blood gas, and electrolytes q2h until Anion Gap closes (<= 12 mEq/L) and BHB < 0.6 mmol/L.'
    ];
  } else if (isKetonemiaCritical && !isGlucoseEuglycemicRange) {
    classificationCode = 'CLASSIC_DKA';
    classificationTitle = 'Hyperglycemic Diabetic Ketoacidosis (Classic DKA)';
    urgency = 'CRITICAL_ED_NOW';
    urgencyLabel = 'Critical Emergency: Immediate ED DKA Protocol';
    confidenceRationale = `Hyperglycemia (${analytics.latestGlucoseMgDl} mg/dL) coupled with severe ketonemia (${analytics.latestKetoneMmolL.toFixed(2)} mmol/L), Anion Gap ${analytics.anionGapMeqL} mEq/L, and metabolic acidosis (pH ${effectiveContext.venousPh.toFixed(2)}).`;
    immediateProtocolSteps = [
      'Initiate isotonic crystalloid resuscitation (0.9% NaCl 15–20 mL/kg over first hour) to restore intravascular volume and renal perfusion.',
      'Start continuous IV Regular Insulin infusion at 0.1 units/kg/hr after confirming serum K+ >= 3.5 mEq/L.',
      'Add IV Dextrose (D5W) once serum glucose falls below 200–250 mg/dL while continuing insulin infusion until ketonemia (< 0.6 mmol/L) and anion gap acidosis resolve.',
      'Replete potassium (20–30 mEq/L IV fluids) and monitor venous pH, HCO3-, and BHB q2h.'
    ];
  } else if (isSevereHyperosmolar) {
    classificationCode = 'HHS_HYPEROSMOLAR';
    classificationTitle = 'Hyperglycemic Hyperosmolar State (HHS — Non-Ketotic Hypertonicity)';
    urgency = 'CRITICAL_ED_NOW';
    urgencyLabel = 'Critical Emergency: Immediate ICU/ED Osmolar Resuscitation';
    confidenceRationale = `Severe hyperglycemia (${analytics.latestGlucoseMgDl} mg/dL) and elevated effective serum osmolality (${analytics.effectiveOsmolalityMosmKg} mOsm/kg > 320 mOsm/kg) without significant ketoacidosis (BHB ${analytics.latestKetoneMmolL.toFixed(2)} mmol/L, pH ${effectiveContext.venousPh.toFixed(2)}, HCO3- ${effectiveContext.bicarbonateMeqL} mEq/L).`;
    immediateProtocolSteps = [
      'Prioritize aggressive IV crystalloid volume expansion (0.9% NaCl 1000–1500 mL in first hour) BEFORE initiating insulin; premature insulin shifts glucose intracellularly with water and can precipitate hypotensive vascular collapse.',
      'Calculate Corrected Sodium (' +
        analytics.correctedSodiumMeqL +
        ' mEq/L); transition to 0.45% NaCl after hemodynamic stabilization because corrected Na+ is normal/elevated.',
      'Target gradual osmolality reduction of 3–8 mOsm/kg/hr and glucose drop of 50–75 mg/dL/hr with low-dose IV insulin (0.05 units/kg/hr) after initial fluid load to prevent cerebral edema.',
      'Investigate and treat underlying infectious precipitant (e.g., pneumonia, UTI, sepsis) and provide venous thromboembolism prophylaxis.'
    ];
  } else if (isSomogyiPattern) {
    classificationCode = 'SOMOGYI_REBOUND';
    classificationTitle = 'Nocturnal Hypoglycemia with Somogyi Counter-Regulatory Rebound';
    urgency = 'URGENT_CLINICAL_ACTION';
    urgencyLabel = 'Urgent Regimen Adjustment: Prevent Recurrent Nocturnal Neuroglycopenia';
    confidenceRationale = `CGM trajectory reveals a Level 2 nocturnal nadir of ${analytics.nocturnalNadirMgDl} mg/dL at 0${analytics.nocturnalNadirHour}:00 AM followed by a counter-regulatory morning surge to ${analytics.morningPeakMgDl} mg/dL, with normal acid-base status (pH ${effectiveContext.venousPh.toFixed(2)}, BHB ${analytics.latestKetoneMmolL.toFixed(2)} mmol/L).`;
    immediateProtocolSteps = [
      'DO NOT increase evening basal insulin despite elevated fasting morning glucose — increasing basal insulin will deepen the 03:00 AM hypoglycemic nadir.',
      'Reduce evening basal insulin (Detemir/Glargine) dose by 15–20% (e.g., from 28U to 22–24U) or shift timing/formulation to ultra-long-acting degludec.',
      'Enable predictive low-glucose suspend (PLGS) or set nocturnal CGM low alert threshold at 80 mg/dL with audible wake alarm.',
      'Advise a 15g complex carbohydrate + protein bedtime snack if pre-bed glucose is < 120 mg/dL.'
    ];
  } else if (isKetonemiaElevated) {
    classificationCode = 'KETONEMIA_WARNING';
    classificationTitle = 'Sub-Acute Ketonemia Escalation (Sick-Day Ketone Protocol Required)';
    urgency = 'URGENT_CLINICAL_ACTION';
    urgencyLabel = 'Urgent Ambulatory Sick-Day Intervention';
    confidenceRationale = `Interstitial ketones are elevated at ${analytics.latestKetoneMmolL.toFixed(2)} mmol/L (1.5–2.9 mmol/L warning zone) with 6-hour delta of +${analytics.sixHourKetoneDelta.toFixed(2)} mmol/L.`;
    immediateProtocolSteps = [
      'Hold any SGLT2 inhibitor therapy immediately and initiate oral hydration (250–500 mL/hr water or electrolyte solution).',
      'Administer supplemental rapid-acting insulin correction (typically 10–15% of Total Daily Dose) alongside 15–30g oral carbohydrates if glucose is < 180 mg/dL.',
      'Recheck interstitial/capillary blood ketones every 2 hours; escalate to Emergency Department if ketones rise >= 3.0 mmol/L or emesis prevents oral intake.'
    ];
  } else {
    classificationCode = 'TIR_OPTIMAL';
    classificationTitle = 'Well-Controlled Type 1 Diabetes (ADA Time-in-Range & Ketone Target Achieved)';
    urgency = 'ROUTINE_OPTIMIZATION';
    urgencyLabel = 'Stable Telemetry: Continue Current Closed-Loop Regimen';
    confidenceRationale = `Time-in-Range (70–180 mg/dL) is ${analytics.timeInRangePercent}% (ADA target > 70%), glycemic variability CV is ${analytics.glucoseCvPercent}% (< 36% target), and continuous interstitial ketones remain physiological (${analytics.latestKetoneMmolL.toFixed(2)} mmol/L).`;
    immediateProtocolSteps = [
      'Maintain current Automated Insulin Delivery (AID) basal profile and carbohydrate-to-insulin ratios.',
      'Continue pre-meal bolus timing 15 minutes prior to meals and exercise activity target 60 minutes prior to aerobic sessions.',
      'Routine outpatient endocrinology follow-up in 3–6 months; no acute ketosis or acid-base intervention needed.'
    ];
  }

  // Stage 1, 2, 3 structured outputs
  const stage1: ReasoningStageOutput = {
    stageNumber: 1,
    stageTitle: 'Stage 1: Telemetry Trend Extraction',
    promptGateIdentifier: 'GATE_01_MULTIMODAL_VECTOR_EXTRACTION',
    systemConstraintUsed:
      'Decouple glucose magnitude from ketone velocity; extract 24h CGM/CKM first-derivatives (dG/dt, dK/dt), nocturnal nadirs (00:00–06:00), and pharmacologic SGLT2i state.',
    extractedFindings: [
      `Latest Glucose: ${analytics.latestGlucoseMgDl} mg/dL | 24h Mean: ${analytics.meanGlucoseMgDl} mg/dL | TIR (70–180): ${analytics.timeInRangePercent}%`,
      `Latest Interstitial BHB: ${analytics.latestKetoneMmolL.toFixed(2)} mmol/L | Peak BHB: ${analytics.peakKetoneMmolL.toFixed(2)} mmol/L | Max Velocity: +${analytics.maxKetoneVelocityMmolHr.toFixed(2)} mmol/L/hr`,
      `Nocturnal Nadir (00:00–06:00): ${analytics.nocturnalNadirMgDl} mg/dL at 0${analytics.nocturnalNadirHour}:00 | Morning Peak (06:00–10:00): ${analytics.morningPeakMgDl} mg/dL`,
      `SGLT2 Inhibitor Exposure: ${effectiveContext.sglt2InhibitorActive ? `ACTIVE (${effectiveContext.sglt2MedicationName ?? 'SGLT2i'}) — Renal glycosuria clamp present` : 'INACTIVE'}`
    ],
    clinicalSynthesis:
      classificationCode === 'EUGLYCEMIC_DKA'
        ? `Critical divergence detected: CGM shows deceptive near-normoglycemia (${analytics.latestGlucoseMgDl} mg/dL) due to SGLT2i urinary glucose excretion, while CKM reveals exponential ketogenesis (+${analytics.sixHourKetoneDelta.toFixed(2)} mmol/L over 6h to ${analytics.latestKetoneMmolL.toFixed(2)} mmol/L).`
        : classificationCode === 'SOMOGYI_REBOUND'
          ? `Biphasic nocturnal-to-morning oscillation: severe overnight nadir (${analytics.nocturnalNadirMgDl} mg/dL) precedes rapid morning rebound (${analytics.morningPeakMgDl} mg/dL) with stable basal ketones.`
          : classificationCode === 'HHS_HYPEROSMOLAR'
            ? `Monotonic hyperglycemic climb to ${analytics.latestGlucoseMgDl} mg/dL with suppressed ketogenesis (peak ${analytics.peakKetoneMmolL.toFixed(2)} mmol/L), indicating preserved basal insulin inhibition of lipolysis.`
            : `Stable dual-channel trajectory: TIR ${analytics.timeInRangePercent}% with physiological ketone homeostasis (${analytics.latestKetoneMmolL.toFixed(2)} mmol/L) and low glycemic variability (CV ${analytics.glucoseCvPercent}%).`,
    triggeredLogicGates: [
      analytics.latestKetoneMmolL >= 3.0
        ? 'CKM_CRITICAL_THRESHOLD (>= 3.0 mmol/L)'
        : analytics.latestKetoneMmolL >= 1.5
          ? 'CKM_KETONEMIA_ALERT (1.5–2.9 mmol/L)'
          : 'CKM_BASAL_HOMEOSTASIS (< 1.5 mmol/L)',
      effectiveContext.sglt2InhibitorActive
        ? 'SGLT2I_GLYCOSURIA_MASK_CHECK: ENABLED'
        : 'STANDARD_RENAL_THRESHOLD_MODEL',
      analytics.nocturnalNadirMgDl < 70
        ? 'NOCTURNAL_NEUROGLYCOPENIA_DETECTED (< 70 mg/dL)'
        : 'NOCTURNAL_GLYCEMIA_SAFE'
    ]
  };

  const stage2: ReasoningStageOutput = {
    stageNumber: 2,
    stageTitle: 'Stage 2: Acid-Base & Electrolyte Risk Inference',
    promptGateIdentifier: 'GATE_02_ACID_BASE_OSMOLAR_MATRIX',
    systemConstraintUsed:
      'Compute Anion Gap = Na - (Cl + HCO3), Corrected Na = Na + 0.016*(Glu - 100), and Effective Osmolality = 2*Na + Glu/18. Never rule out DKA on glucose < 250 mg/dL if BHB >= 3.0 mmol/L or Anion Gap > 12 mEq/L.',
    extractedFindings: [
      `Anion Gap: ${analytics.anionGapMeqL} mEq/L (Ref: 8–12 mEq/L) | Serum HCO3-: ${effectiveContext.bicarbonateMeqL} mEq/L | Venous pH: ${effectiveContext.venousPh.toFixed(2)}`,
      `Measured Na+: ${effectiveContext.sodiumMeqL} mEq/L | Katz Corrected Na+: ${analytics.correctedSodiumMeqL} mEq/L | Serum K+: ${effectiveContext.potassiumMeqL.toFixed(1)} mEq/L`,
      `Effective Osmolality: ${analytics.effectiveOsmolalityMosmKg} mOsm/kg (HHS Threshold >= 320) | Total Osmolality: ${analytics.totalOsmolalityMosmKg} mOsm/kg`,
      `Renal Perfusion Markers: BUN ${effectiveContext.bunMgDl} mg/dL | Creatinine ${effectiveContext.creatinineMgDl} mg/dL`
    ],
    clinicalSynthesis:
      classificationCode === 'EUGLYCEMIC_DKA'
        ? `Unmasked High-Anion-Gap Metabolic Acidosis (AG ${analytics.anionGapMeqL} mEq/L, pH ${effectiveContext.venousPh.toFixed(2)}, HCO3- ${effectiveContext.bicarbonateMeqL} mEq/L) driven by beta-hydroxybutyric acid accumulation despite euglycemic serum glucose.`
        : classificationCode === 'HHS_HYPEROSMOLAR'
          ? `Severe hyperosmolar state (Effective Osmolality ${analytics.effectiveOsmolalityMosmKg} mOsm/kg, Corrected Na+ ${analytics.correctedSodiumMeqL} mEq/L) with prerenal azotemia (BUN/Cr ${effectiveContext.bunMgDl}/${effectiveContext.creatinineMgDl}) and preserved acid-base balance (pH ${effectiveContext.venousPh.toFixed(2)}, AG ${analytics.anionGapMeqL}).`
          : classificationCode === 'SOMOGYI_REBOUND'
            ? `Acid-base and osmolar neutrality confirmed (pH ${effectiveContext.venousPh.toFixed(2)}, HCO3- ${effectiveContext.bicarbonateMeqL} mEq/L, AG ${analytics.anionGapMeqL} mEq/L). Morning hyperglycemia is catecholamine/glucagon-mediated rather than insulin-deficient ketosis.`
            : `Normonatremic, normo-osmolar (${analytics.effectiveOsmolalityMosmKg} mOsm/kg), and normal anion gap (${analytics.anionGapMeqL} mEq/L) acid-base profile.`,
    triggeredLogicGates: [
      isHighAnionGap ? `HAGMA_POSITIVE (AG ${analytics.anionGapMeqL} > 12 mEq/L)` : 'NORMAL_ANION_GAP (<= 12 mEq/L)',
      isAcidotic ? `ACIDEMIA_CONFIRMED (pH ${effectiveContext.venousPh.toFixed(2)}, HCO3- ${effectiveContext.bicarbonateMeqL})` : 'EUBICARBONATEMIA_PRESERVED',
      analytics.effectiveOsmolalityMosmKg >= 320
        ? `SEVERE_HYPEROSMOLALITY (${analytics.effectiveOsmolalityMosmKg} >= 320 mOsm/kg)`
        : 'OSMOLALITY_WITHIN_SAFE_BOUNDS'
    ]
  };

  const stage3: ReasoningStageOutput = {
    stageNumber: 3,
    stageTitle: 'Stage 3: ADA/ISPAD Guideline-Aligned Triage Action',
    promptGateIdentifier: 'GATE_03_ADA_ISPAD_PROTOCOL_SYNTHESIS',
    systemConstraintUsed:
      'Map validated metabolic phenotype to 2024/2025 ADA/ISPAD Consensus Guidelines. Enforce Dextrose + Insulin clamp for euDKA, Fluid-First resuscitation for HHS, and Basal Reduction for Somogyi rebound.',
    extractedFindings: [
      `Primary Phenotype: ${classificationTitle}`,
      `Disposition & Urgency Tier: ${urgencyLabel}`,
      `Primary Protocol Mandate: ${immediateProtocolSteps[0]}`
    ],
    clinicalSynthesis: confidenceRationale,
    triggeredLogicGates: [
      `DISPOSITION_${urgency}`,
      classificationCode === 'EUGLYCEMIC_DKA'
        ? 'PROTOCOL_DEXTROSE_CLAMP_PLUS_IV_INSULIN'
        : classificationCode === 'HHS_HYPEROSMOLAR'
          ? 'PROTOCOL_FLUID_RESUSCITATION_BEFORE_INSULIN'
          : classificationCode === 'SOMOGYI_REBOUND'
            ? 'PROTOCOL_REDUCE_EVENING_BASAL_INSULIN'
            : 'PROTOCOL_CONTINUE_AID_THERAPY'
    ]
  };

  // Naive Zero-Shot vs Constraint-Guided Comparison
  const promptComparison: PromptComparisonAudit = buildPromptComparison(
    preset,
    effectiveContext,
    analytics,
    classificationCode
  );

  // EHR SmartPhrase & Patient SMS
  const ehrSmartPhrase = buildEhrSmartPhrase(
    preset,
    effectiveContext,
    analytics,
    classificationTitle,
    urgencyLabel,
    immediateProtocolSteps
  );

  const patientSmsAlert = buildPatientSmsAlert(
    classificationCode,
    analytics,
    effectiveContext
  );

  return {
    classificationCode,
    classificationTitle,
    urgency,
    urgencyLabel,
    confidenceRationale,
    analytics,
    stages: [stage1, stage2, stage3],
    promptComparison,
    ehrSmartPhrase,
    patientSmsAlert,
    immediateProtocolSteps
  };
}

function buildPromptComparison(
  preset: TelemetryPreset,
  context: PatientLabContext,
  analytics: TelemetryAnalytics,
  classificationCode: ClinicalDecisionResult['classificationCode']
): PromptComparisonAudit {
  if (classificationCode === 'EUGLYCEMIC_DKA') {
    return {
      scenarioLabel: 'SGLT2i Euglycemic DKA Trap (Glucose 165 mg/dL, Ketones 3.90 mmol/L)',
      naiveZeroShotPrompt: `"Patient has diabetes. Latest CGM blood glucose is ${analytics.latestGlucoseMgDl} mg/dL (24h average ${analytics.meanGlucoseMgDl} mg/dL). Feeling mildly nauseous after skipping breakfast. What should the patient do?"`,
      naiveZeroShotOutput: `"False Reassurance (DANGEROUS): Your blood sugar of ${analytics.latestGlucoseMgDl} mg/dL is safely within target range (70–180 mg/dL), so you are NOT in diabetic ketoacidosis. Drink water, rest at home, and continue your regular medications."`,
      naiveFailureMechanism:
        'Naive zero-shot LLMs anchor heavily on the textbook rule "DKA = Glucose > 250 mg/dL". Because SGLT2 inhibitors force urinary glucose excretion (~80–100g/day), blood glucose remains < 180 mg/dL even while severe insulin deficiency drives unrestrained lipolysis and life-threatening ketoacidosis.',
      constraintGuidedSystemPrompt: `[ROLE: Clinical Endocrinologist & Telemetry Safety Engine — Dr. Ibrahim Mohammed MD | MDCN/R/107127]
1. NEVER exclude DKA based on glucose < 250 mg/dL.
2. Evaluate CKM beta-hydroxybutyrate independently: IF BHB >= 3.0 mmol/L OR (BHB >= 1.5 mmol/L AND SGLT2i == true), trigger EUGLYCEMIC_DKA emergency gate.
3. Require simultaneous IV Dextrose (D5W/D10W) + IV Regular Insulin (0.1 U/kg/hr) when glucose < 250 mg/dL to clear ketonemia without inducing hypoglycemia.`,
      constraintGuidedOutput: `CRITICAL ALERT — EUGLYCEMIC DKA DETECTED: Despite near-normal glucose (${analytics.latestGlucoseMgDl} mg/dL), interstitial BHB is ${analytics.latestKetoneMmolL.toFixed(2)} mmol/L with Anion Gap ${analytics.anionGapMeqL} mEq/L and pH ${context.venousPh.toFixed(2)}. SGLT2i glycosuria is masking hyperglycemia. Immediate ED transfer for IV Dextrose + IV Regular Insulin infusion and SGLT2i cessation.`,
      clinicalSafeguardAdvantage:
        'Decouples glycemic threshold from ketogenesis velocity, preventing missed euDKA mortality and enforcing immediate IV dextrose clamping alongside insulin.'
    };
  }

  if (classificationCode === 'SOMOGYI_REBOUND') {
    return {
      scenarioLabel: 'Somogyi Rebound Trap (03:00 AM Nadir 48 mg/dL -> 08:00 AM Fasting 268 mg/dL)',
      naiveZeroShotPrompt: `"Patient wakes up every morning with fasting blood sugar around ${analytics.morningPeakMgDl} mg/dL. Currently taking 28 units of evening basal insulin. How should we adjust their insulin?"`,
      naiveZeroShotOutput: `"Dangerous Up-Titration: Since fasting morning glucose is elevated at ${analytics.morningPeakMgDl} mg/dL, increase evening basal insulin by 2 to 4 units (to 30–32U) to bring morning fasting glucose down."`,
      naiveFailureMechanism:
        'Naive prompting inspects isolated fasting morning snapshots without analyzing continuous 00:00–05:00 nocturnal nadir derivatives, mistaking counter-regulatory hormone rebound for basal insulin insufficiency.',
      constraintGuidedSystemPrompt: `[ROLE: Clinical Endocrinologist & Telemetry Safety Engine — Dr. Ibrahim Mohammed MD | MDCN/R/107127]
1. Before recommending basal up-titration for morning hyperglycemia, scan 00:00–06:00 CGM window for nadir < 70 mg/dL.
2. IF Nocturnal_Nadir < 70 mg/dL AND Morning_Peak > 200 mg/dL AND Ketones < 1.5 mmol/L -> Classify as SOMOGYI_REBOUND and REDUCE evening basal insulin by 15–20%.`,
      constraintGuidedOutput: `COUNTER-REGULATORY SOMOGYI REBOUND: Morning glucose (${analytics.morningPeakMgDl} mg/dL) was triggered by unrecognized Level 2 nocturnal hypoglycemia (${analytics.nocturnalNadirMgDl} mg/dL at 0${analytics.nocturnalNadirHour}:00 AM). DO NOT increase basal insulin. Reduce evening Detemir by 15–20% (to 22–24U).`,
      clinicalSafeguardAdvantage:
        'Prevents fatal nocturnal neuroglycopenia by recognizing adrenergic/glucagon rebound kinetics across the 24-hour CGM curve.'
    };
  }

  if (classificationCode === 'HHS_HYPEROSMOLAR') {
    return {
      scenarioLabel: 'HHS vs DKA Resuscitation Trap (Glucose 685 mg/dL, Osmolality 336 mOsm/kg, Ketones 0.72 mmol/L)',
      naiveZeroShotPrompt: `"Patient has blood sugar of ${analytics.latestGlucoseMgDl} mg/dL. Should we immediately start a high-dose IV insulin bolus and infusion to rapidly normalize blood sugar?"`,
      naiveZeroShotOutput: `"Unsafe Rapid Insulin First: Start immediate IV regular insulin bolus and infusion to rapidly bring glucose down from ${analytics.latestGlucoseMgDl} mg/dL to normal range."`,
      naiveFailureMechanism:
        'In HHS with profound osmotic dehydration, starting insulin before aggressive isotonic fluid resuscitation drives extracellular glucose and water into cells, precipitating acute intravascular collapse, shock, and cerebral edema.',
      constraintGuidedSystemPrompt: `[ROLE: Clinical Endocrinologist & Telemetry Safety Engine — Dr. Ibrahim Mohammed MD | MDCN/R/107127]
1. Differentiate HHS from DKA via Effective Osmolality (2*Na + Glu/18 >= 320 mOsm/kg) and CKM Ketones (< 1.5 mmol/L).
2. In HHS, mandate aggressive isotonic crystalloid expansion (1.0–1.5L 0.9% NaCl) BEFORE initiating low-dose insulin, and cap osmolar decline at 3–8 mOsm/kg/hr.`,
      constraintGuidedOutput: `HHS DIFFERENTIATED FROM DKA: Effective osmolality is ${analytics.effectiveOsmolalityMosmKg} mOsm/kg with minimal ketosis (${analytics.latestKetoneMmolL.toFixed(2)} mmol/L) and Corrected Na+ ${analytics.correctedSodiumMeqL} mEq/L. Administer 1–1.5L 0.9% NaCl IV fluid resuscitation FIRST before low-dose insulin (0.05 U/kg/hr).`,
      clinicalSafeguardAdvantage:
        'Protects hemodynamic stability and prevents osmotic demyelination / cerebral edema by enforcing fluid-first resuscitation.'
    };
  }

  return {
    scenarioLabel: 'Closed-Loop AID Telemetry Verification (TIR > 75%, Basal Ketones < 0.4 mmol/L)',
    naiveZeroShotPrompt: `"Patient had post-meal glucose peaks of 156–162 mg/dL and an exercise ketone reading of 0.26 mmol/L. Should they take extra correction insulin?"`,
    naiveZeroShotOutput: `"Over-Correction Risk: Take an extra correction bolus for post-meal rises and monitor ketones closely for early ketoacidosis."`,
    naiveFailureMechanism:
      'Naive prompts often over-medicalize physiological post-prandial excursions (140–165 mg/dL) and mild aerobic exercise ketogenesis (0.2–0.3 mmol/L), causing insulin stacking in closed-loop pump users.',
    constraintGuidedSystemPrompt: `[ROLE: Clinical Endocrinologist & Telemetry Safety Engine — Dr. Ibrahim Mohammed MD | MDCN/R/107127]
1. Evaluate 24h TIR (target > 70%), CV% (< 36%), and basal CKM (< 0.6 mmol/L).
2. Prohibit manual correction boluses when AID closed-loop is maintaining post-prandial peaks < 180 mg/dL and physiological exercise ketones < 0.6 mmol/L.`,
    constraintGuidedOutput: `OPTIMAL GLYCEMIC & KETONE HOMEOSTASIS: 24h TIR is ${analytics.timeInRangePercent}% with CV ${analytics.glucoseCvPercent}% and physiological exercise ketones (${analytics.latestKetoneMmolL.toFixed(2)} mmol/L). Avoid manual correction stacking; continue current AID profile.`,
    clinicalSafeguardAdvantage:
      'Prevents iatrogenic insulin stacking and validates healthy closed-loop physiological variance.'
  };
}

function buildEhrSmartPhrase(
  preset: TelemetryPreset,
  context: PatientLabContext,
  analytics: TelemetryAnalytics,
  classificationTitle: string,
  urgencyLabel: string,
  steps: string[]
): string {
  return [
    `*** GLUCOCOPILOT AI TELEMETRY & DKA TRIAGE SUMMARY (.GLUCOCOPILOT_TRIAGE) ***`,
    `Authoring Architecture: Dr. Ibrahim Mohammed (MD | MDCN/R/107127)`,
    `Patient Context: ${context.age}yo ${context.sex} | Dx: ${context.diagnosis}`,
    `Active Regimen: ${context.regimen}`,
    ``,
    `[1. 24-HOUR CONTINUOUS CGM / CKM TELEMETRY METRICS]`,
    `• Latest CGM Glucose: ${analytics.latestGlucoseMgDl} mg/dL (24h Mean: ${analytics.meanGlucoseMgDl} mg/dL | Range: ${analytics.minGlucoseMgDl}–${analytics.maxGlucoseMgDl} mg/dL)`,
    `• Time-in-Range (70–180 mg/dL): ${analytics.timeInRangePercent}% | TBR (<70): ${analytics.timeBelowRangePercent}% | TAR (>180): ${analytics.timeAboveRangePercent}% | CV: ${analytics.glucoseCvPercent}%`,
    `• Nocturnal Nadir (00:00–06:00): ${analytics.nocturnalNadirMgDl} mg/dL at 0${analytics.nocturnalNadirHour}:00 | Morning Peak: ${analytics.morningPeakMgDl} mg/dL`,
    `• Latest Interstitial Ketone (BHB): ${analytics.latestKetoneMmolL.toFixed(2)} mmol/L (24h Peak: ${analytics.peakKetoneMmolL.toFixed(2)} mmol/L | Max Velocity: +${analytics.maxKetoneVelocityMmolHr.toFixed(2)} mmol/L/hr | 6h Delta: +${analytics.sixHourKetoneDelta.toFixed(2)} mmol/L)`,
    ``,
    `[2. ACID-BASE & OSMOLAR RISK INFERENCE]`,
    `• Acid-Base: Venous pH ${context.venousPh.toFixed(2)} | Serum HCO3- ${context.bicarbonateMeqL} mEq/L | Anion Gap ${analytics.anionGapMeqL} mEq/L`,
    `• Osmolar & Electrolytes: Measured Na+ ${context.sodiumMeqL} mEq/L (Corrected Na+ ${analytics.correctedSodiumMeqL} mEq/L) | K+ ${context.potassiumMeqL.toFixed(1)} mEq/L | Effective Osmolality ${analytics.effectiveOsmolalityMosmKg} mOsm/kg (Total ${analytics.totalOsmolalityMosmKg} mOsm/kg)`,
    `• SGLT2i Pharmacologic Gate: ${context.sglt2InhibitorActive ? `POSITIVE (${context.sglt2MedicationName ?? 'Active SGLT2i'})` : 'NEGATIVE'}`,
    ``,
    `[3. CLINICAL CLASSIFICATION & ADA/ISPAD TRIAGE PLAN]`,
    `• Diagnostic Impression: ${classificationTitle}`,
    `• Triage Disposition: ${urgencyLabel}`,
    ...steps.map((s, i) => `  ${i + 1}. ${s}`)
  ].join('\n');
}

function buildPatientSmsAlert(
  classificationCode: ClinicalDecisionResult['classificationCode'],
  analytics: TelemetryAnalytics,
  context: PatientLabContext
): string {
  if (classificationCode === 'EUGLYCEMIC_DKA') {
    return `URGENT CARE TEAM ALERT: Even though your glucose sensor reads ${analytics.latestGlucoseMgDl} mg/dL, your ketone level has risen to a dangerous ${analytics.latestKetoneMmolL.toFixed(1)} mmol/L. Because you take an SGLT2 medication (${context.sglt2MedicationName ?? 'Empagliflozin'}), diabetic ketoacidosis (DKA) can happen with normal blood sugar. STOP taking your SGLT2 pill now, drink water, and have someone drive you to the nearest Emergency Department immediately. Show the ER team this message: "Suspected SGLT2i Euglycemic DKA — Ketones ${analytics.latestKetoneMmolL.toFixed(1)} mmol/L, needs IV Dextrose + IV Insulin."`;
  }
  if (classificationCode === 'CLASSIC_DKA') {
    return `URGENT CARE TEAM ALERT: Your glucose (${analytics.latestGlucoseMgDl} mg/dL) and ketones (${analytics.latestKetoneMmolL.toFixed(1)} mmol/L) are in the critical DKA danger zone. Please go to the nearest Emergency Department right away for IV fluids and insulin support. Do not drive yourself.`;
  }
  if (classificationCode === 'HHS_HYPEROSMOLAR') {
    return `URGENT CARE TEAM ALERT: Your glucose sensor is critically high (${analytics.latestGlucoseMgDl} mg/dL), which causes severe dehydration even when ketones are low (${analytics.latestKetoneMmolL.toFixed(1)} mmol/L). Please have someone take you to the nearest Emergency Department immediately for IV fluid hydration. Sip plain water on the way if you are fully awake.`;
  }
  if (classificationCode === 'SOMOGYI_REBOUND') {
    return `CARE TEAM MESSAGE: We noticed your morning blood sugar was high (${analytics.morningPeakMgDl} mg/dL) because your sugar dropped too low overnight (${analytics.nocturnalNadirMgDl} mg/dL at 3:00 AM), causing your body to rebound. Please DO NOT increase your nighttime long-acting insulin tonight. Instead, reduce your evening basal dose to 23 units as guided, set your low CGM alarm to 80 mg/dL, and have a small bedtime snack if your sugar is under 120 mg/dL.`;
  }
  if (classificationCode === 'KETONEMIA_WARNING') {
    return `CARE TEAM SICK-DAY ALERT: Your ketone sensor is elevated at ${analytics.latestKetoneMmolL.toFixed(1)} mmol/L. Pause any SGLT2 medication today, drink 1–2 glasses of water per hour, and take your sick-day rapid insulin correction with 15–30g of carbs. If your ketones reach 3.0 mmol/L or you cannot keep fluids down, go to the nearest Emergency Department.`;
  }
  return `CARE TEAM CHECK-IN: Great job today! Your glucose stayed in target range ${analytics.timeInRangePercent}% of the last 24 hours (latest ${analytics.latestGlucoseMgDl} mg/dL) and your ketone levels are completely normal (${analytics.latestKetoneMmolL.toFixed(2)} mmol/L). Keep up your current closed-loop pump routine and meal pre-boluses.`;
}
