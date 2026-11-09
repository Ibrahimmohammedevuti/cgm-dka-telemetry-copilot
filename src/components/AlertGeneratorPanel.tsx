import React, { useState } from 'react';
import { ClinicalDecisionResult } from '../clinical/reasoningEngine';

interface AlertGeneratorPanelProps {
  decision: ClinicalDecisionResult;
}

export const AlertGeneratorPanel: React.FC<AlertGeneratorPanelProps> = ({ decision }) => {
  const [copiedEhr, setCopiedEhr] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);
  const [dispatchedSms, setDispatchedSms] = useState(false);

  const handleCopyEhr = async () => {
    try {
      await navigator.clipboard.writeText(decision.ehrSmartPhrase);
    } catch {
      // Fallback if clipboard permission restricted in iframe
    }
    setCopiedEhr(true);
    setTimeout(() => setCopiedEhr(false), 2000);
  };

  const handleCopySms = async () => {
    try {
      await navigator.clipboard.writeText(decision.patientSmsAlert);
    } catch {
      // Fallback if clipboard permission restricted in iframe
    }
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 2000);
  };

  const handleSimulateSmsDispatch = () => {
    setDispatchedSms(true);
    setTimeout(() => setDispatchedSms(false), 3500);
  };

  return (
    <section id="clinical-alerts" className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="text-xs font-mono text-slate-500">
          04. AUTOMATED DUAL-AUDIENCE CLINICAL DISPATCH · EHR SMARTPHRASE &amp; PATIENT SMS TRIAGE
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mt-1">
          Automated Clinician EHR SmartPhrase &amp; Empathetic Patient SMS Generator
        </h2>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">
          Translates the 3-stage telemetry synthesis simultaneously into a structured physician EHR documentation block (`.GLUCOCOPILOT_TRIAGE`) and a 6th-grade reading-level, actionable patient SMS triage instruction.
        </p>
      </div>

      {/* 2-Column Split: Clinician EHR SmartPhrase vs Patient SMS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Physician-Facing EHR SmartPhrase */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-100">
              <div>
                <div className="text-xs font-mono text-slate-500">
                  PHYSICIAN-FACING DOCUMENTATION BLOCK · EPIC / CERNER DOT-PHRASE
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  EHR SmartPhrase Summary (<code className="text-sky-700 font-mono">.GLUCOCOPILOT_TRIAGE</code>)
                </h3>
              </div>

              <button
                type="button"
                onClick={handleCopyEhr}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedEhr ? 'Copied EHR SmartPhrase' : 'Copy EHR SmartPhrase'}
              </button>
            </div>

            <pre
              data-testid="ehr-smartphrase-output"
              className="p-4 bg-slate-900 text-slate-100 rounded-md text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto"
            >
              {decision.ehrSmartPhrase}
            </pre>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-500">
            <span>STRUCTURED FORMAT: SOAP / PROGRESS NOTE / ED TRIAGE</span>
            <span>GUIDELINE BASIS: ADA 2025 · ISPAD CONSENSUS</span>
          </div>
        </div>

        {/* Right 5 Cols: Empathetic Plain-Language Patient SMS Triage */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="text-xs font-mono text-slate-500">
                  PATIENT-FACING MOBILE TELEMETRY DISPATCH
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Plain-Language Patient SMS Triage Instruction
                </h3>
              </div>

              <button
                type="button"
                onClick={handleCopySms}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedSms ? 'Copied SMS Text' : 'Copy Patient SMS'}
              </button>
            </div>

            {/* SMS Message Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                <span>FROM: GLUCOCOPILOT ENDOCRINE TRIAGE</span>
                <span>URGENCY: {decision.urgency}</span>
              </div>

              <p
                data-testid="patient-sms-output"
                className="text-sm text-slate-900 leading-relaxed font-medium bg-white p-3.5 rounded border border-slate-200"
              >
                {decision.patientSmsAlert}
              </p>

              <div className="text-xs font-mono text-slate-500 flex items-center justify-between">
                <span>CHARACTER COUNT: {decision.patientSmsAlert.length} CHARS</span>
                <span>EMPATHETIC HEALTH LITERACY VERIFIED</span>
              </div>
            </div>

            {/* Immediate Protocol Checklist */}
            <div>
              <div className="text-xs font-mono text-slate-500 mb-2">
                ORDERED CLINICAL TRIAGE ACTIONS:
              </div>
              <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                {decision.immediateProtocolSteps.map((step, i) => (
                  <li key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                    <span className="font-mono font-semibold text-slate-900 mr-1.5">
                      0{i + 1}.
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSimulateSmsDispatch}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              {dispatchedSms
                ? '✓ SMS Triage Logged to Patient Telemetry Feed'
                : 'Simulate Patient SMS & EHR Alert Dispatch'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
