import {
  ClinicalDecisionResult,
  TelemetryDivergenceSummary
} from './reasoningEngine';
import { PatientLabContext, TelemetryPreset } from './telemetryPresets';

export interface ClinicalProfileNoteInput {
  preset: TelemetryPreset;
  effectiveContext: PatientLabContext;
  decision: ClinicalDecisionResult;
  divergence: TelemetryDivergenceSummary;
  generatedAtIso?: string;
}

function escapePdfText(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, (ch) => {
      if (ch === '·' || ch === '•') return '-';
      if (ch === '–' || ch === '—') return '-';
      if (ch === 'Δ') return 'Delta ';
      if (ch === 'β') return 'beta-';
      if (ch === '≥') return '>=';
      if (ch === '≤') return '<=';
      return ' ';
    });
}

function wrapTextLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

/**
 * Generates a complete, self-contained, standards-compliant PDF 1.4 document
 * representing the formatted "Patient Clinical Profile & Lab Matrix" Clinical Note,
 * distinct from the EHR SmartPhrase export.
 */
export function buildPatientClinicalProfilePdfBytes(
  input: ClinicalProfileNoteInput
): Uint8Array {
  const { preset, effectiveContext, decision, divergence } = input;
  const timestamp = input.generatedAtIso ?? new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  const { analytics } = decision;

  const ops: string[] = [];

  // Page geometry: US Letter 612 x 792 pt
  // Top header banner background
  ops.push('0.06 0.09 0.16 rg'); // Deep clinical slate #0F172A
  ops.push('36 716 540 48 re f');

  // Header text in white
  ops.push('BT /F2 13 Tf 1 1 1 rg 48 744 Td (PATIENT CLINICAL PROFILE & ENDOCRINE TELEMETRY NOTE) Tj ET');
  ops.push(
    `BT /F1 8.5 Tf 0.75 0.85 0.95 rg 48 728 Td (${escapePdfText(
      `GlucoKetone AI Clinical Decision Support | Architect: Dr. Ibrahim Mohammed (MD | MDCN/R/107127) | Generated: ${timestamp}`
    )}) Tj ET`
  );

  let y = 696;

  const drawSectionHeader = (title: string) => {
    y -= 6;
    ops.push('0.94 0.96 0.98 rg');
    ops.push(`36 ${y - 4} 540 18 re f`);
    ops.push('0.01 0.35 0.55 rg');
    ops.push(`36 ${y - 4} 3 18 re f`);
    ops.push(`BT /F2 9.5 Tf 0.06 0.09 0.16 rg 45 ${y + 1} Td (${escapePdfText(title)}) Tj ET`);
    y -= 18;
  };

  const drawKeyValueRow = (label: string, value: string, boldValue = false) => {
    ops.push(`BT /F2 9 Tf 0.25 0.32 0.42 rg 44 ${y} Td (${escapePdfText(label)}) Tj ET`);
    const wrapped = wrapTextLines(value, 68);
    wrapped.forEach((line, idx) => {
      const font = boldValue ? '/F2' : '/F1';
      ops.push(`BT ${font} 9 Tf 0.06 0.09 0.16 rg 185 ${y} Td (${escapePdfText(line)}) Tj ET`);
      if (idx < wrapped.length - 1) {
        y -= 12;
      }
    });
    y -= 14;
  };

  const drawParagraph = (text: string, font = '/F1', size = 9, indent = 44, maxChars = 88) => {
    const lines = wrapTextLines(text, maxChars);
    for (const line of lines) {
      ops.push(`BT ${font} ${size} Tf 0.12 0.16 0.23 rg ${indent} ${y} Td (${escapePdfText(line)}) Tj ET`);
      y -= 12.5;
    }
  };

  // SECTION 1: PATIENT DEMOGRAPHICS & CLINICAL PRESENTATION PROFILE
  drawSectionHeader('1. PATIENT CLINICAL PROFILE & MEDICATION REGIMEN');
  drawKeyValueRow('Clinical Scenario Preset:', `${preset.title} (${preset.id})`, true);
  drawKeyValueRow('Diagnostic Risk Flag:', preset.clinicalTrapBadge, true);
  drawKeyValueRow(
    'Patient Demographics:',
    `${effectiveContext.age}-year-old ${effectiveContext.sex === 'F' ? 'Female' : 'Male'} | Primary Dx: ${effectiveContext.diagnosis}`
  );
  drawKeyValueRow('Active Medication Regimen:', effectiveContext.regimen);
  drawKeyValueRow(
    'SGLT2 Inhibitor Exposure:',
    effectiveContext.sglt2InhibitorActive
      ? `ACTIVE (${effectiveContext.sglt2MedicationName ?? 'SGLT2 Inhibitor'} — Obligatory Renal Glycosuria Present)`
      : 'INACTIVE (No SGLT2 Inhibitor Exposure)'
  );
  drawKeyValueRow('Clinical Presentation HPI:', effectiveContext.clinicalHistorySummary);

  // SECTION 2: BIOCHEMICAL & ACID-BASE LABORATORY MATRIX
  drawSectionHeader('2. BIOCHEMICAL, ELECTROLYTE & ACID-BASE LABORATORY MATRIX');
  const labLines = [
    `Venous pH: ${effectiveContext.venousPh.toFixed(2)} (Ref: 7.35-7.45)      |   Serum Bicarbonate (HCO3-): ${effectiveContext.bicarbonateMeqL} mEq/L (Ref: 22-28)`,
    `Anion Gap: ${analytics.anionGapMeqL} mEq/L (Ref: 8-12 mEq/L)       |   Serum Chloride (Cl-): ${effectiveContext.chlorideMeqL} mEq/L`,
    `Measured Na+: ${effectiveContext.sodiumMeqL} mEq/L                   |   Katz Corrected Na+: ${analytics.correctedSodiumMeqL} mEq/L`,
    `Serum Potassium (K+): ${effectiveContext.potassiumMeqL.toFixed(1)} mEq/L           |   Renal Function: BUN ${effectiveContext.bunMgDl} mg/dL, Cr ${effectiveContext.creatinineMgDl} mg/dL`,
    `Effective Osmolality: ${analytics.effectiveOsmolalityMosmKg} mOsm/kg        |   Total Serum Osmolality: ${analytics.totalOsmolalityMosmKg} mOsm/kg`
  ];
  for (const row of labLines) {
    ops.push(`BT /F3 8.5 Tf 0.06 0.09 0.16 rg 44 ${y} Td (${escapePdfText(row)}) Tj ET`);
    y -= 13;
  }

  // SECTION 3: 24-HOUR CGM / CKM TELEMETRY & DELTA DIVERGENCE ANALYSIS
  drawSectionHeader('3. 24-HOUR DUAL-CHANNEL BIOSENSOR TELEMETRY & DIVERGENCE SUMMARY');
  drawKeyValueRow(
    'CGM Glycemic Summary:',
    `Latest: ${analytics.latestGlucoseMgDl} mg/dL | 24h Mean: ${analytics.meanGlucoseMgDl} mg/dL | Range: ${analytics.minGlucoseMgDl}-${analytics.maxGlucoseMgDl} mg/dL | CV: ${analytics.glucoseCvPercent}%`
  );
  drawKeyValueRow(
    'ADA Glycemic Ranges:',
    `Time-in-Range (70-180): ${analytics.timeInRangePercent}% | Below Range (<70): ${analytics.timeBelowRangePercent}% | Above Range (>180): ${analytics.timeAboveRangePercent}%`
  );
  drawKeyValueRow(
    'Nocturnal & Morning:',
    `Nocturnal Nadir (00:00-06:00): ${analytics.nocturnalNadirMgDl} mg/dL at 0${analytics.nocturnalNadirHour}:00 | Morning Peak: ${analytics.morningPeakMgDl} mg/dL`
  );
  drawKeyValueRow(
    'CKM Ketone Kinetics:',
    `Latest BHB: ${analytics.latestKetoneMmolL.toFixed(2)} mmol/L | 24h Peak: ${analytics.peakKetoneMmolL.toFixed(2)} mmol/L | Max Velocity: +${analytics.maxKetoneVelocityMmolHr.toFixed(2)} mmol/L/hr | 6h Delta: +${analytics.sixHourKetoneDelta.toFixed(2)} mmol/L`
  );
  drawKeyValueRow(
    'CGM-CKM Delta Divergence:',
    divergence.highRiskWindows.length > 0
      ? `${divergence.totalHighRiskHours} High-Risk Hours (${divergence.highRiskWindows
          .map((w) => `${w.startLabel}-${w.endLabel}`)
          .join(', ')}) | Peak Divergence Index: ${divergence.peakDivergenceIndex}/100`
      : `0 High-Risk Divergence Hours | Peak Divergence Index: ${divergence.peakDivergenceIndex}/100 (Physiological Concordance)`,
    true
  );
  drawKeyValueRow('Divergence Mechanism:', divergence.dominantMechanism);

  // SECTION 4: DIAGNOSTIC PHENOTYPE & CLINICAL TRIAGE ORDERS
  drawSectionHeader('4. VALIDATED PHENOTYPE & ADA / ISPAD CLINICAL MANAGEMENT PLAN');
  drawKeyValueRow('Primary Phenotype:', decision.classificationTitle, true);
  drawKeyValueRow('Triage Disposition:', `${decision.urgencyLabel} [${decision.urgency}]`, true);
  drawParagraph(`Pathophysiological Synthesis: ${decision.confidenceRationale}`, '/F1', 8.8, 44, 90);
  y -= 3;
  decision.immediateProtocolSteps.forEach((step, index) => {
    drawParagraph(`${index + 1}. ${step}`, '/F1', 8.5, 48, 88);
  });

  // Footer signature line
  ops.push('0.82 0.85 0.90 RG 0.8 w 36 52 m 576 52 l S');
  ops.push(
    'BT /F2 8 Tf 0.25 0.32 0.42 rg 36 38 Td (Authenticated Clinical Decision Support Note | Dr. Ibrahim Mohammed (MD | MDCN/R/107127) | GlucoKetone AI Copilot) Tj ET'
  );

  const contentStream = ops.join('\n');
  const streamBytesLength = new TextEncoder().encode(contentStream).length;

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n',
    `7 0 obj\n<< /Length ${streamBytesLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += obj;
  }

  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}
