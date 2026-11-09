import React from 'react';
import { SimulationSnapshot } from '../clinical/reasoningEngine';

interface SimulationHistoryPanelProps {
  snapshots: SimulationSnapshot[];
  onCaptureCurrentSnapshot: () => void;
  onRestoreSnapshot: (snapshot: SimulationSnapshot) => void;
  onClearHistory: () => void;
}

export const SimulationHistoryPanel: React.FC<SimulationHistoryPanelProps> = ({
  snapshots,
  onCaptureCurrentSnapshot,
  onRestoreSnapshot,
  onClearHistory
}) => {
  return (
    <div
      data-testid="simulation-history-panel"
      className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
    >
      {/* Header & Capture Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200">
        <div>
          <div className="text-xs font-mono text-slate-500">
            WHAT-IF SCENARIO BENCHMARK · RING BUFFER (LAST 5 TRIAGE SNAPSHOTS)
          </div>
          <h3 className="text-base font-bold text-slate-900 mt-0.5">
            Simulation History &amp; Side-by-Side What-If Triage Comparison ({snapshots.length}/5)
          </h3>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            data-testid="capture-snapshot-btn"
            onClick={onCaptureCurrentSnapshot}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-700 rounded-md hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            + Capture Current What-If Snapshot
          </button>
          {snapshots.length > 1 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Reset Buffer
            </button>
          )}
        </div>
      </div>

      {/* Side-by-Side Comparison Grid (up to 5 columns on desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-stretch">
        {snapshots.map((snap, idx) => {
          const scoreColor =
            snap.urgencyScore >= 75
              ? 'text-rose-700'
              : snap.urgencyScore >= 45
                ? 'text-amber-700'
                : 'text-emerald-700';

          const urgencyTag =
            snap.urgency === 'CRITICAL_ED_NOW'
              ? '✖ CRITICAL ED'
              : snap.urgency === 'URGENT_CLINICAL_ACTION'
                ? '▲ URGENT'
                : '● ROUTINE';

          return (
            <div
              key={snap.id}
              data-testid={`history-snapshot-card-${idx}`}
              className="border border-slate-200 rounded-md p-3.5 bg-slate-50/60 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span className="font-semibold text-slate-800">
                    SNAPSHOT #{snapshots.length - idx}
                  </span>
                  <span>{snap.timestampLabel}</span>
                </div>

                <div className="text-xs font-bold text-slate-900 truncate" title={snap.presetTitle}>
                  {snap.presetShortName}
                </div>

                {/* Override Summary */}
                <div className="text-[11px] font-mono text-sky-900 bg-white border border-slate-200 rounded px-2 py-1 truncate" title={snap.overrideSummaryText}>
                  {snap.overrideSummaryText}
                </div>

                {/* Clinical Urgency Score */}
                <div className="pt-1 flex items-baseline justify-between border-t border-slate-200/80 tabular-nums">
                  <span className="text-[11px] font-mono text-slate-500">
                    URGENCY SCORE:
                  </span>
                  <span
                    data-testid={`snapshot-urgency-score-${idx}`}
                    className={`text-lg font-mono font-bold ${scoreColor}`}
                  >
                    {snap.urgencyScore}/100
                  </span>
                </div>

                {/* Telemetry Comparison Metrics */}
                <div className="space-y-1 text-[11px] font-mono text-slate-700 tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-500">CGM / CKM:</span>
                    <span className="font-semibold text-slate-900">
                      {snap.latestGlucoseMgDl} mg/dL · {snap.latestKetoneMmolL.toFixed(2)} mmol/L
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">HCO3- / SGLT2i:</span>
                    <span>
                      {snap.bicarbonateMeqL} mEq/L · {snap.sglt2InhibitorActive ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">24h %CV / Δ Peak:</span>
                    <span>
                      {snap.glucoseCvPercent}% · {snap.peakDivergenceIndex}/100
                    </span>
                  </div>
                  <div className="flex justify-between pt-0.5">
                    <span className="text-slate-500">Triage Tier:</span>
                    <span className="font-semibold text-slate-900">{urgencyTag}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-testid={`restore-snapshot-btn-${idx}`}
                onClick={() => onRestoreSnapshot(snap)}
                className="w-full py-1.5 px-2.5 text-xs font-mono font-semibold text-slate-800 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Load Scenario
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
