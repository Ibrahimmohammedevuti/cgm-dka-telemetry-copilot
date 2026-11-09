import React, { useState } from 'react';
import { ClinicalDecisionResult } from '../clinical/reasoningEngine';
import { TelemetryPreset } from '../clinical/telemetryPresets';

interface ReasoningPipelineViewProps {
  decision: ClinicalDecisionResult;
  activePreset: TelemetryPreset;
}

interface LiveLlmAuditResponse {
  mode: 'live_gemini' | 'deterministic_verified';
  modelUsed: string;
  stage1Summary: string;
  stage2Summary: string;
  stage3Action: string;
  euDkaTrapAnalysis: string;
  timestamp: string;
}

export const ReasoningPipelineView: React.FC<ReasoningPipelineViewProps> = ({
  decision,
  activePreset
}) => {
  const [expandedGates, setExpandedGates] = useState< boolean >(true);
  const [isRunningLlm, setIsRunningLlm] = useState(false);
  const [llmAudit, setLlmAudit] = useState<LiveLlmAuditResponse | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);

  const handleRunServerPromptChain = async () => {
    setIsRunningLlm(true);
    setLlmError(null);
    try {
      const response = await fetch('/api/clinical/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presetId: activePreset.id,
          presetTitle: activePreset.title,
          patientContext: activePreset.patientContext,
          analytics: decision.analytics,
          classificationCode: decision.classificationCode,
          classificationTitle: decision.classificationTitle
        })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned HTTP ${response.status}`);
      }
      const data: LiveLlmAuditResponse = await response.json();
      setLlmAudit(data);
    } catch (err: unknown) {
      setLlmError(
        err instanceof Error ? err.message : 'Unable to reach clinical reasoning endpoint.'
      );
    } finally {
      setIsRunningLlm(false);
    }
  };

  return (
    <section id="reasoning-pipeline" className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-mono text-slate-500">
            02. MULTI-STAGE CLINICAL REASONING ARCHITECTURE · DR. IBRAHIM MOHAMMED (MD | MDCN/R/107127)
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">
            3-Stage Prompt-Engineered Clinical Reasoning Pipeline
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Sequential constraint-guided reasoning gates decouple interstitial ketone kinetics from deceptive normoglycemia, preventing zero-shot LLM diagnostic failures in SGLT2-inhibitor Euglycemic DKA, Somogyi rebound, and Hyperosmolar states.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setExpandedGates((prev) => !prev)}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {expandedGates ? 'Hide System Prompt Gates' : 'Inspect System Prompt Gates'}
          </button>
          <button
            type="button"
            onClick={handleRunServerPromptChain}
            disabled={isRunningLlm}
            className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 rounded-md hover:bg-sky-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isRunningLlm ? 'Executing 3-Stage Chain...' : 'Execute Live 3-Stage Prompt Chain'}
          </button>
        </div>
      </div>

      {/* Live Server-Side Prompt Chain Execution Banner (when triggered) */}
      {llmError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 font-mono">
          Prompt Chain Notice: {llmError}
        </div>
      )}

      {llmAudit && (
        <div
          data-testid="live-chain-output"
          className="p-5 bg-slate-900 text-slate-100 rounded-lg border border-slate-800 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="text-xs font-mono text-sky-400">
              SERVER-SIDE 3-STAGE PROMPT EXECUTION TRACE · MODEL: {llmAudit.modelUsed}
            </div>
            <div className="text-xs font-mono text-slate-400">{llmAudit.timestamp}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed">
            <div className="p-3 bg-slate-800/70 rounded border border-slate-700">
              <div className="font-mono text-sky-300 font-semibold mb-1">
                STAGE 1 OUTPUT (TREND EXTRACTION)
              </div>
              <p className="text-slate-200">{llmAudit.stage1Summary}</p>
            </div>
            <div className="p-3 bg-slate-800/70 rounded border border-slate-700">
              <div className="font-mono text-amber-300 font-semibold mb-1">
                STAGE 2 OUTPUT (ACID-BASE INFERENCE)
              </div>
              <p className="text-slate-200">{llmAudit.stage2Summary}</p>
            </div>
            <div className="p-3 bg-slate-800/70 rounded border border-slate-700">
              <div className="font-mono text-emerald-300 font-semibold mb-1">
                STAGE 3 OUTPUT (ADA/ISPAD TRIAGE)
              </div>
              <p className="text-slate-200">{llmAudit.stage3Action}</p>
            </div>
          </div>
          <div className="pt-2 text-xs text-slate-300 font-mono">
            <span className="text-sky-400 font-semibold">SAFEGUARD VERIFICATION:</span>{' '}
            {llmAudit.euDkaTrapAnalysis}
          </div>
        </div>
      )}

      {/* 3-Stage Pipeline Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {decision.stages.map((stage) => (
          <div
            key={stage.stageNumber}
            data-testid={`reasoning-stage-${stage.stageNumber}`}
            className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between"
          >
            <div>
              {/* Stage Header */}
              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                <span className="text-xs font-mono font-semibold text-sky-800">
                  0{stage.stageNumber}. {stage.promptGateIdentifier}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  STEP {stage.stageNumber} OF 3
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900">{stage.stageTitle}</h3>

              {/* System Constraint Box */}
              {expandedGates && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-700 leading-relaxed">
                  <div className="text-slate-500 font-semibold mb-1">
                    SYSTEM PROMPT CONSTRAINT GATE:
                  </div>
                  {stage.systemConstraintUsed}
                </div>
              )}

              {/* Extracted Telemetry / Acid-Base Findings */}
              <div className="mt-4 space-y-2">
                <div className="text-xs font-mono text-slate-500">
                  EXTRACTED CLINICAL PARAMETERS:
                </div>
                <ul className="space-y-1.5 text-xs font-mono text-slate-800 tabular-nums">
                  {stage.extractedFindings.map((finding, idx) => (
                    <li
                      key={idx}
                      className="py-1 px-2.5 bg-slate-50/80 border border-slate-200/80 rounded"
                    >
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Clinical Synthesis */}
              <div className="mt-4">
                <div className="text-xs font-mono text-slate-500 mb-1">
                  STAGE SYNTHESIS:
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {stage.clinicalSynthesis}
                </p>
              </div>
            </div>

            {/* Triggered Logic Gates Footer */}
            <div className="mt-5 pt-3 border-t border-slate-100">
              <div className="text-xs font-mono text-slate-500 mb-1.5">
                TRIGGERED LOGIC GATES:
              </div>
              <div className="text-xs font-mono text-slate-800 space-y-1">
                {stage.triggeredLogicGates.map((gate, i) => (
                  <div key={i} className="truncate">
                    → {gate}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Prompt Engineering Comparison: Naive Zero-Shot vs Constraint-Guided System Prompt */}
      <div
        id="prompt-comparison"
        className="bg-white border border-slate-200 rounded-lg p-6 space-y-5"
      >
        <div className="border-b border-slate-200 pb-4">
          <div className="text-xs font-mono text-slate-500">
            03. PROMPT SAFETY BENCHMARK · ZERO-SHOT FAILURE MODE VS. CONSTRAINT-GUIDED ARCHITECTURE
          </div>
          <h3 className="text-xl font-bold text-slate-900 mt-1">
            Why Naive Zero-Shot Prompting Fails vs. Constraint-Guided Clinical Prompting
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Active Benchmark Scenario:{' '}
            <span className="font-semibold text-slate-900">
              {decision.promptComparison.scenarioLabel}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Column 1: Naive Zero-Shot Prompt Failure */}
          <div className="border border-rose-200 bg-rose-50/30 rounded-lg p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-rose-800 font-semibold">
                <span>✖ NAIVE ZERO-SHOT LLM PROMPTING (UNSAFE BASELINE)</span>
                <span>CLINICAL SAFETY AUDIT: FAILED</span>
              </div>

              <div>
                <div className="text-xs font-mono text-slate-500 mb-1">
                  USER / CLINICIAN ZERO-SHOT INPUT:
                </div>
                <pre className="p-3 bg-white border border-rose-200 rounded text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {decision.promptComparison.naiveZeroShotPrompt}
                </pre>
              </div>

              <div>
                <div className="text-xs font-mono text-rose-800 font-semibold mb-1">
                  NAIVE ZERO-SHOT MODEL OUTPUT (HALLUCINATED REASSURANCE / DOSING ERROR):
                </div>
                <div className="p-3 bg-white border border-rose-200 rounded text-xs font-mono text-rose-950 leading-relaxed">
                  {decision.promptComparison.naiveZeroShotOutput}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-rose-200/80">
              <div className="text-xs font-mono text-rose-800 font-semibold mb-1">
                PATHOPHYSIOLOGICAL FAILURE MECHANISM:
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {decision.promptComparison.naiveFailureMechanism}
              </p>
            </div>
          </div>

          {/* Column 2: Dr. Ibrahim Mohammed's Constraint-Guided System Prompt */}
          <div className="border border-emerald-300 bg-emerald-50/30 rounded-lg p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-emerald-900 font-semibold">
                <span>● DR. MOHAMMED CONSTRAINT-GUIDED SYSTEM PROMPT</span>
                <span>ADA / ISPAD COMPLIANT</span>
              </div>

              <div>
                <div className="text-xs font-mono text-slate-500 mb-1">
                  MULTI-GATE SYSTEM INSTRUCTION &amp; HARD INVARIANTS:
                </div>
                <pre className="p-3 bg-white border border-emerald-200 rounded text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {decision.promptComparison.constraintGuidedSystemPrompt}
                </pre>
              </div>

              <div>
                <div className="text-xs font-mono text-emerald-900 font-semibold mb-1">
                  CONSTRAINT-GUIDED COPILOT OUTPUT:
                </div>
                <div className="p-3 bg-white border border-emerald-200 rounded text-xs font-mono text-emerald-950 leading-relaxed">
                  {decision.promptComparison.constraintGuidedOutput}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-emerald-200/80">
              <div className="text-xs font-mono text-emerald-900 font-semibold mb-1">
                CLINICAL SAFEGUARD ADVANTAGE:
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {decision.promptComparison.clinicalSafeguardAdvantage}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
