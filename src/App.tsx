/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  PatientLabContext,
  TELEMETRY_PRESETS,
  TelemetryPreset
} from './clinical/telemetryPresets';
import {
  appendSimulationSnapshot,
  computeCgmCkmDivergence,
  computeClinicalUrgencyScore,
  computeGlycemicVariabilityTrend,
  CustomTelemetryOverrides,
  evaluateClinicalReasoningPipeline,
  formatOverrideSummary,
  SimulationSnapshot
} from './clinical/reasoningEngine';
import { buildPatientClinicalProfilePdfBytes } from './clinical/pdfClinicalNoteBuilder';
import { TelemetryCanvasChart } from './components/TelemetryCanvasChart';
import { GlycemicVariabilityPanel } from './components/GlycemicVariabilityPanel';
import { SimulationHistoryPanel } from './components/SimulationHistoryPanel';
import { ReasoningPipelineView } from './components/ReasoningPipelineView';
import { AlertGeneratorPanel } from './components/AlertGeneratorPanel';

function createSnapshotFromPreset(
  preset: TelemetryPreset,
  overrides: CustomTelemetryOverrides,
  timestampLabel: string,
  idSuffix: string
): SimulationSnapshot {
  const decision = evaluateClinicalReasoningPipeline(preset, overrides);
  const effectiveSeries = preset.series.map((pt, idx) => {
    if (idx === preset.series.length - 1) {
      return {
        ...pt,
        glucoseMgDl: overrides.overrideLatestGlucoseMgDl ?? pt.glucoseMgDl,
        ketoneMmolL: overrides.overrideLatestKetoneMmolL ?? pt.ketoneMmolL
      };
    }
    return pt;
  });
  const divergence = computeCgmCkmDivergence(effectiveSeries);
  const urgencyScore = computeClinicalUrgencyScore(decision, divergence);

  return {
    id: `${preset.id}-${idSuffix}`,
    timestampLabel,
    presetId: preset.id,
    presetShortName: preset.shortName,
    presetTitle: preset.title,
    overrides: { ...overrides },
    overrideSummaryText: formatOverrideSummary(preset, overrides),
    latestGlucoseMgDl: decision.analytics.latestGlucoseMgDl,
    latestKetoneMmolL: decision.analytics.latestKetoneMmolL,
    bicarbonateMeqL:
      overrides.overrideBicarbonateMeqL ?? preset.patientContext.bicarbonateMeqL,
    sglt2InhibitorActive:
      overrides.sglt2InhibitorActive ?? preset.patientContext.sglt2InhibitorActive,
    glucoseCvPercent: decision.analytics.glucoseCvPercent,
    peakDivergenceIndex: divergence.peakDivergenceIndex,
    classificationCode: decision.classificationCode,
    classificationTitle: decision.classificationTitle,
    urgency: decision.urgency,
    urgencyScore
  };
}

export default function App() {
  const [selectedPresetId, setSelectedPresetId] =
    useState<TelemetryPreset['id']>('euglycemic-dka');
  const [selectedHour, setSelectedHour] = useState<number>(24);
  const [overrides, setOverrides] = useState<CustomTelemetryOverrides>({});
  const [exportConfirmation, setExportConfirmation] = useState(false);
  const [pdfProfileConfirmation, setPdfProfileConfirmation] = useState(false);

  // Seed initial Simulation History with 3 comparative clinical snapshots
  const [simulationHistory, setSimulationHistory] = useState<SimulationSnapshot[]>(
    () => [
      createSnapshotFromPreset(TELEMETRY_PRESETS[0], {}, 'Baseline #1', 'seed-1'),
      createSnapshotFromPreset(TELEMETRY_PRESETS[1], {}, 'Baseline #2', 'seed-2'),
      createSnapshotFromPreset(TELEMETRY_PRESETS[3], {}, 'Baseline #3', 'seed-3')
    ]
  );

  const activePreset = useMemo(
    () =>
      TELEMETRY_PRESETS.find((p) => p.id === selectedPresetId) ?? TELEMETRY_PRESETS[0],
    [selectedPresetId]
  );

  const decision = useMemo(
    () => evaluateClinicalReasoningPipeline(activePreset, overrides),
    [activePreset, overrides]
  );

  const effectiveSeries = useMemo(
    () =>
      activePreset.series.map((pt, idx) => {
        if (idx === activePreset.series.length - 1) {
          return {
            ...pt,
            glucoseMgDl: overrides.overrideLatestGlucoseMgDl ?? pt.glucoseMgDl,
            ketoneMmolL: overrides.overrideLatestKetoneMmolL ?? pt.ketoneMmolL
          };
        }
        return pt;
      }),
    [
      activePreset.series,
      overrides.overrideLatestGlucoseMgDl,
      overrides.overrideLatestKetoneMmolL
    ]
  );

  const divergenceSummary = useMemo(
    () => computeCgmCkmDivergence(effectiveSeries),
    [effectiveSeries]
  );

  const gvTrend = useMemo(
    () => computeGlycemicVariabilityTrend(effectiveSeries),
    [effectiveSeries]
  );

  const currentUrgencyScore = useMemo(
    () => computeClinicalUrgencyScore(decision, divergenceSummary),
    [decision, divergenceSummary]
  );

  const handleCaptureSnapshot = (
    targetPreset: TelemetryPreset = activePreset,
    targetOverrides: CustomTelemetryOverrides = overrides
  ) => {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const snap = createSnapshotFromPreset(
      targetPreset,
      targetOverrides,
      timeStr,
      `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    );
    setSimulationHistory((prev) => appendSimulationSnapshot(prev, snap, 5));
  };

  const handleSelectPreset = (presetId: TelemetryPreset['id']) => {
    const nextPreset =
      TELEMETRY_PRESETS.find((p) => p.id === presetId) ?? TELEMETRY_PRESETS[0];
    setSelectedPresetId(presetId);
    setSelectedHour(24);
    setOverrides({});
    handleCaptureSnapshot(nextPreset, {});
  };

  const handleRestoreSnapshot = (snap: SimulationSnapshot) => {
    setSelectedPresetId(snap.presetId);
    setOverrides({ ...snap.overrides });
    setSelectedHour(24);
  };

  const handleResetHistory = () => {
    setSimulationHistory([
      createSnapshotFromPreset(
        activePreset,
        overrides,
        'Current State',
        `reset-${Date.now()}`
      )
    ]);
  };

  const handleResetOverrides = () => {
    setOverrides({});
    setSelectedHour(24);
  };

  const handleExportReport = () => {
    const blob = new Blob([decision.ehrSmartPhrase], {
      type: 'text/plain;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GlucoKetone_AI_${activePreset.id}_EHR_SmartPhrase.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportConfirmation(true);
    setTimeout(() => setExportConfirmation(false), 2500);
  };

  const handleDownloadClinicalProfilePdf = () => {
    const effectiveContext: PatientLabContext = {
      ...activePreset.patientContext,
      sglt2InhibitorActive:
        overrides.sglt2InhibitorActive ??
        activePreset.patientContext.sglt2InhibitorActive,
      bicarbonateMeqL:
        overrides.overrideBicarbonateMeqL ??
        activePreset.patientContext.bicarbonateMeqL,
      venousPh:
        overrides.overrideVenousPh ?? activePreset.patientContext.venousPh,
      sodiumMeqL:
        overrides.overrideSodiumMeqL ?? activePreset.patientContext.sodiumMeqL
    };

    const pdfBytes = buildPatientClinicalProfilePdfBytes({
      preset: activePreset,
      effectiveContext,
      decision,
      divergence: divergenceSummary
    });

    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
      type: 'application/pdf'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Patient_Clinical_Profile_${activePreset.id}_Note.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setPdfProfileConfirmation(true);
    setTimeout(() => setPdfProfileConfirmation(false), 2500);
  };

  const effectiveSglt2 =
    overrides.sglt2InhibitorActive ?? activePreset.patientContext.sglt2InhibitorActive;
  const effectiveGlucose =
    overrides.overrideLatestGlucoseMgDl ?? decision.analytics.latestGlucoseMgDl;
  const effectiveKetone =
    overrides.overrideLatestKetoneMmolL ?? decision.analytics.latestKetoneMmolL;
  const effectiveBicarb =
    overrides.overrideBicarbonateMeqL ?? activePreset.patientContext.bicarbonateMeqL;
  const effectivePh =
    overrides.overrideVenousPh ?? activePreset.patientContext.venousPh;

  const urgencyBannerTone =
    decision.urgency === 'CRITICAL_ED_NOW'
      ? 'bg-rose-50 border-rose-300 text-rose-950'
      : decision.urgency === 'URGENT_CLINICAL_ACTION'
        ? 'bg-amber-50 border-amber-300 text-amber-950'
        : 'bg-emerald-50 border-emerald-300 text-emerald-950';

  const urgencyGlyph =
    decision.urgency === 'CRITICAL_ED_NOW'
      ? '✖ CRITICAL EMERGENCY'
      : decision.urgency === 'URGENT_CLINICAL_ACTION'
        ? '▲ URGENT ACTION'
        : '● NOMINAL HOMEOSTASIS';

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Strict 3-Zone Top Navigation Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#telemetry-simulator"
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          GlucoKetone AI
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav
          aria-label="Primary Clinical Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <a
            href="#telemetry-simulator"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Telemetry Simulator
          </a>
          <a
            href="#reasoning-pipeline"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Reasoning Pipeline
          </a>
          <a
            href="#prompt-comparison"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Prompt Comparison
          </a>
          <a
            href="#clinical-alerts"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Clinical Alerts
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleExportReport}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {exportConfirmation ? 'Exported EHR SmartPhrase' : 'Export Triage Report'}
          </button>
        </div>
      </header>

      {/* Main Clinical Telemetry & Decision Support Workspace */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Section 1: Clinical Header & Interactive Patient Telemetry Simulator */}
        <section id="telemetry-simulator" className="space-y-6">
          {/* Author Attribution & Clinical Framing Header */}
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
              <div className="space-y-1.5">
                <div className="text-xs font-mono text-slate-600">
                  CONTINUOUS CGM / CKM TELEMETRY &amp; DKA TRIAGE COPILOT · AUTHOR: DR. IBRAHIM MOHAMMED (MD | MDCN/R/107127)
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  GlucoKetone AI: Dual-Channel Glycemic &amp; Ketone Decision Support
                </h1>
                <p className="text-sm text-slate-600 max-w-3xl">
                  Real-time 24-hour Continuous Glucose Monitoring (mg/dL) and Continuous Interstitial Ketone Monitoring (mmol/L) simulator engineered to detect SGLT2-inhibitor Euglycemic DKA, Somogyi counter-regulatory rebound, and Hyperglycemic Hyperosmolar State.
                </p>
              </div>

              {/* Active Phenotype Status Readout */}
              <div
                data-testid="active-phenotype-banner"
                className={`p-3.5 rounded-md border text-xs font-mono shrink-0 ${urgencyBannerTone}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-bold">{urgencyGlyph}</span>
                  <span className="font-bold tabular-nums">
                    URGENCY SCORE: {currentUrgencyScore}/100
                  </span>
                </div>
                <div className="mt-1 font-semibold">{decision.classificationTitle}</div>
                <div className="mt-0.5 text-[11px] opacity-85">{decision.urgencyLabel}</div>
              </div>
            </div>

            {/* 4 Selectable Patient Telemetry Presets (Segmented Interactive Controls) */}
            <div className="pt-5">
              <div className="text-xs font-mono text-slate-500 mb-2.5">
                01. SELECT PATIENT TELEMETRY PRESET (4 CLINICAL SCENARIOS):
              </div>
              <div
                role="group"
                aria-label="Patient Telemetry Presets"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5"
              >
                {TELEMETRY_PRESETS.map((preset) => {
                  const isSelected = preset.id === activePreset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      data-testid={`preset-btn-${preset.id}`}
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`text-left p-3.5 rounded-md border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-mono font-semibold truncate">
                        {preset.shortName}
                      </div>
                      <div
                        className={`text-xs mt-1 line-clamp-2 ${
                          isSelected ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        {preset.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4-Column Calibrated Telemetry KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Latest CGM Glucose */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-mono text-slate-500">
                LATEST CGM GLUCOSE · 24H %CV
              </div>
              <div className="mt-1.5 flex items-baseline">
                <span
                  data-testid="metric-glucose"
                  className="text-3xl font-mono font-bold text-slate-900 tabular-nums"
                >
                  {decision.analytics.latestGlucoseMgDl}
                </span>
                <span className="text-xs font-mono text-slate-500 ml-1.5">mg/dL</span>
              </div>
              <div className="mt-2 text-xs font-mono text-slate-600 tabular-nums">
                TIR: {decision.analytics.timeInRangePercent}% · 24h CV:{' '}
                {decision.analytics.glucoseCvPercent}%
              </div>
            </div>

            {/* Metric 2: Latest Interstitial Ketone (BHB) */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-mono text-slate-500">
                INTERSTITIAL KETONE (BHB)
              </div>
              <div className="mt-1.5 flex items-baseline">
                <span
                  data-testid="metric-ketone"
                  className={`text-3xl font-mono font-bold tabular-nums ${
                    decision.analytics.latestKetoneMmolL >= 3.0
                      ? 'text-rose-700'
                      : decision.analytics.latestKetoneMmolL >= 1.5
                        ? 'text-amber-700'
                        : 'text-slate-900'
                  }`}
                >
                  {decision.analytics.latestKetoneMmolL.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-slate-500 ml-1.5">mmol/L</span>
              </div>
              <div className="mt-2 text-xs font-mono text-slate-600 tabular-nums">
                Max Velocity: +{decision.analytics.maxKetoneVelocityMmolHr.toFixed(2)} mmol/L/hr · 6h Δ: +
                {decision.analytics.sixHourKetoneDelta.toFixed(2)}
              </div>
            </div>

            {/* Metric 3: Acid-Base & Anion Gap */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-mono text-slate-500">
                ACID-BASE · ANION GAP &amp; HCO3-
              </div>
              <div className="mt-1.5 flex items-baseline">
                <span
                  data-testid="metric-anion-gap"
                  className={`text-3xl font-mono font-bold tabular-nums ${
                    decision.analytics.anionGapMeqL > 12 ? 'text-rose-700' : 'text-slate-900'
                  }`}
                >
                  {decision.analytics.anionGapMeqL}
                </span>
                <span className="text-xs font-mono text-slate-500 ml-1.5">mEq/L AG</span>
              </div>
              <div className="mt-2 text-xs font-mono text-slate-600 tabular-nums">
                Venous pH: {effectivePh.toFixed(2)} · Serum HCO3-: {effectiveBicarb} mEq/L
              </div>
            </div>

            {/* Metric 4: Effective Osmolality & Corrected Na+ */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-mono text-slate-500">
                EFFECTIVE SERUM OSMOLALITY
              </div>
              <div className="mt-1.5 flex items-baseline">
                <span
                  data-testid="metric-osmolality"
                  className={`text-3xl font-mono font-bold tabular-nums ${
                    decision.analytics.effectiveOsmolalityMosmKg >= 320
                      ? 'text-rose-700'
                      : 'text-slate-900'
                  }`}
                >
                  {decision.analytics.effectiveOsmolalityMosmKg}
                </span>
                <span className="text-xs font-mono text-slate-500 ml-1.5">mOsm/kg</span>
              </div>
              <div className="mt-2 text-xs font-mono text-slate-600 tabular-nums">
                Corrected Na+: {decision.analytics.correctedSodiumMeqL} mEq/L · SGLT2i:{' '}
                {effectiveSglt2 ? 'ACTIVE' : 'NONE'}
              </div>
            </div>
          </div>

          {/* Asymmetric Split Console: Left Parameter & Patient Context Column + Right 24h Canvas Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Column (4 cols): Patient Clinical Context, PDF Clinical Note Export & Live Sliders */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-mono text-slate-500">
                      PATIENT CLINICAL PROFILE &amp; LAB MATRIX
                    </div>
                    <button
                      type="button"
                      data-testid="download-clinical-profile-pdf-btn"
                      onClick={handleDownloadClinicalProfilePdf}
                      className="px-2.5 py-1 text-xs font-mono font-semibold text-sky-900 bg-sky-50 border border-sky-200 rounded hover:bg-sky-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {pdfProfileConfirmation
                        ? '✓ Downloaded PDF Note'
                        : 'Download Profile PDF'}
                    </button>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-1">
                    {activePreset.title}
                  </h2>
                  <p className="text-xs font-mono text-sky-800 mt-1">
                    {activePreset.clinicalTrapBadge}
                  </p>
                </div>

                {/* Patient Presentation Summary */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 leading-relaxed space-y-1.5">
                  <div>
                    <span className="font-semibold text-slate-900">Patient:</span>{' '}
                    {activePreset.patientContext.age}yo {activePreset.patientContext.sex} ·{' '}
                    {activePreset.patientContext.diagnosis}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Regimen:</span>{' '}
                    {activePreset.patientContext.regimen}
                  </div>
                  <p className="pt-1 text-slate-600">
                    {activePreset.patientContext.clinicalHistorySummary}
                  </p>
                </div>

                {/* Interactive Telemetry & Acid-Base Parameter Scrubber Controls */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-slate-800">
                      WHAT-IF PARAMETER CALIBRATION
                    </span>
                    <button
                      type="button"
                      onClick={handleResetOverrides}
                      className="text-xs font-mono text-sky-700 hover:underline cursor-pointer"
                    >
                      Reset to Preset
                    </button>
                  </div>

                  {/* SGLT2i Toggle */}
                  <div className="flex items-center justify-between py-1.5 px-3 bg-slate-50 border border-slate-200 rounded">
                    <label
                      htmlFor="toggle-sglt2i"
                      className="text-xs font-medium text-slate-800 cursor-pointer"
                    >
                      SGLT2 Inhibitor Active (Glycosuria Clamp)
                    </label>
                    <input
                      id="toggle-sglt2i"
                      type="checkbox"
                      checked={effectiveSglt2}
                      onChange={(e) =>
                        setOverrides((prev) => ({
                          ...prev,
                          sglt2InhibitorActive: e.target.checked
                        }))
                      }
                      className="h-4 w-4 accent-sky-700 cursor-pointer"
                    />
                  </div>

                  {/* Latest Glucose Override Slider */}
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <label htmlFor="slider-glucose" className="text-slate-600">
                        Current CGM Glucose (T+24h):
                      </label>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {effectiveGlucose} mg/dL
                      </span>
                    </div>
                    <input
                      id="slider-glucose"
                      type="range"
                      min={40}
                      max={750}
                      step={5}
                      value={effectiveGlucose}
                      onChange={(e) =>
                        setOverrides((prev) => ({
                          ...prev,
                          overrideLatestGlucoseMgDl: Number(e.target.value)
                        }))
                      }
                      className="w-full accent-sky-700 cursor-pointer"
                    />
                  </div>

                  {/* Latest Ketone Override Slider */}
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <label htmlFor="slider-ketone" className="text-slate-600">
                        Current CKM Ketone (T+24h BHB):
                      </label>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {effectiveKetone.toFixed(2)} mmol/L
                      </span>
                    </div>
                    <input
                      id="slider-ketone"
                      type="range"
                      min={0.1}
                      max={5.0}
                      step={0.1}
                      value={effectiveKetone}
                      onChange={(e) =>
                        setOverrides((prev) => ({
                          ...prev,
                          overrideLatestKetoneMmolL: Number(e.target.value)
                        }))
                      }
                      className="w-full accent-rose-600 cursor-pointer"
                    />
                  </div>

                  {/* Serum Bicarbonate Override Slider */}
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <label htmlFor="slider-bicarb" className="text-slate-600">
                        Serum Bicarbonate (HCO3-):
                      </label>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {effectiveBicarb} mEq/L
                      </span>
                    </div>
                    <input
                      id="slider-bicarb"
                      type="range"
                      min={5}
                      max={28}
                      step={1}
                      value={effectiveBicarb}
                      onChange={(e) =>
                        setOverrides((prev) => ({
                          ...prev,
                          overrideBicarbonateMeqL: Number(e.target.value)
                        }))
                      }
                      className="w-full accent-slate-800 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Summary Note */}
              <div className="pt-3 border-t border-slate-100 text-xs font-mono text-slate-500">
                NOCTURNAL NADIR: {decision.analytics.nocturnalNadirMgDl} mg/dL (0
                {decision.analytics.nocturnalNadirHour}:00) · GLYCEMIC CV:{' '}
                {decision.analytics.glucoseCvPercent}%
              </div>
            </div>

            {/* Right Column (8 cols): Interactive 24-Hour Dual-Channel CGM/CKM Canvas Chart + Risk Zone Strip */}
            <div className="lg:col-span-8 flex flex-col">
              <TelemetryCanvasChart
                series={activePreset.series}
                selectedHour={selectedHour}
                onSelectHour={setSelectedHour}
                latestGlucoseOverride={overrides.overrideLatestGlucoseMgDl}
                latestKetoneOverride={overrides.overrideLatestKetoneMmolL}
              />
            </div>
          </div>

          {/* 24-Hour Glycemic Variability (GV) Trend Analysis Panel */}
          <GlycemicVariabilityPanel
            gvTrend={gvTrend}
            onSelectHourWindow={(hr) => setSelectedHour(hr)}
          />

          {/* Simulation History & Side-by-Side What-If Triage Comparison (Last 5 Snapshots) */}
          <SimulationHistoryPanel
            snapshots={simulationHistory}
            onCaptureCurrentSnapshot={() => handleCaptureSnapshot(activePreset, overrides)}
            onRestoreSnapshot={handleRestoreSnapshot}
            onClearHistory={handleResetHistory}
          />
        </section>

        {/* Section 2 & 3: 3-Stage Prompt-Engineered Clinical Reasoning Pipeline & Zero-Shot vs Constraint-Guided Comparison */}
        <ReasoningPipelineView decision={decision} activePreset={activePreset} />

        {/* Section 4: Automated Clinician EHR SmartPhrase & Patient SMS Triage Generator */}
        <AlertGeneratorPanel decision={decision} />
      </main>

      {/* Quiet Clinical Governance Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-5 mt-12">
        <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            GlucoKetone AI: Continuous CGM/CKM Telemetry &amp; DKA Triage Copilot · Engineered by Dr. Ibrahim Mohammed (MD | MDCN/R/107127)
          </div>
          <div className="font-mono">
            ADA / ISPAD Guideline-Aligned Clinical Decision Support Simulation
          </div>
        </div>
      </footer>
    </div>
  );
}
