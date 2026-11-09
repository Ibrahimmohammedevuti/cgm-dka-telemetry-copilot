import React from 'react';
import { GlycemicVariabilityTrend } from '../clinical/reasoningEngine';

interface GlycemicVariabilityPanelProps {
  gvTrend: GlycemicVariabilityTrend;
  onSelectHourWindow?: (hour: number) => void;
}

export const GlycemicVariabilityPanel: React.FC<GlycemicVariabilityPanelProps> = ({
  gvTrend,
  onSelectHourWindow
}) => {
  const gaugeRatio = Math.min(100, Math.round((gvTrend.overallCvPercent / 60) * 100));
  const thresholdMarkerPercent = Math.round((36 / 60) * 100);

  return (
    <div
      data-testid="glycemic-variability-panel"
      className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
    >
      {/* Header & Overall CV% Status */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3.5 border-b border-slate-200">
        <div>
          <div className="text-xs font-mono text-slate-500">
            24-HOUR GLYCEMIC VARIABILITY (GV) TREND ANALYSIS · ADA INTERNATIONAL CONSENSUS TARGET (CV &le; 36.0%)
          </div>
          <h3 className="text-base font-bold text-slate-900 mt-0.5">
            Coefficient of Variation (%CV), Standard Deviation &amp; 6-Hour Diurnal Quadrant Kinetics
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-200 rounded-md px-4 py-2 text-xs font-mono tabular-nums shrink-0">
          <div>
            <span className="text-slate-500">24H %CV:</span>{' '}
            <span
              data-testid="gv-overall-cv"
              className={`text-base font-bold ${
                gvTrend.isStableVariability ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {gvTrend.overallCvPercent.toFixed(1)}%
            </span>
          </div>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <div>
            <span className="text-slate-500">SD:</span>{' '}
            <span className="font-semibold text-slate-900">
              ±{gvTrend.standardDeviationMgDl} mg/dL
            </span>
          </div>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <div>
            <span className="text-slate-500">24H AMPLITUDE:</span>{' '}
            <span className="font-semibold text-slate-900">
              {gvTrend.glycemicAmplitudeMgDl} mg/dL
            </span>
          </div>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <div
            className={`font-semibold ${
              gvTrend.isStableVariability ? 'text-emerald-800' : 'text-rose-800'
            }`}
          >
            {gvTrend.isStableVariability
              ? '● STABLE GV (<= 36%)'
              : '▲ LABILE / HIGH GV (> 36%)'}
          </div>
        </div>
      </div>

      {/* CV% Calibration Bar & Clinical Interpretation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-600 tabular-nums">
            <span>COEFFICIENT OF VARIATION (%CV = SD / MEAN)</span>
            <span>TARGET THRESHOLD: 36.0%</span>
          </div>
          <div className="relative h-3 w-full bg-slate-100 rounded border border-slate-200 overflow-hidden">
            <div
              className={`h-full transition-all ${
                gvTrend.isStableVariability ? 'bg-sky-600' : 'bg-rose-600'
              }`}
              style={{ width: `${gaugeRatio}%` }}
            />
            <div
              title="ADA 36% CV Stability Threshold"
              className="absolute top-0 bottom-0 w-0.5 bg-slate-900"
              style={{ left: `${thresholdMarkerPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-slate-500 tabular-nums">
            <span>0% (Flat)</span>
            <span>18% (Physiological)</span>
            <span className="text-slate-900 font-semibold">36% (ADA Cutoff)</span>
            <span>60%+ (Severe Lability)</span>
          </div>
        </div>

        <div className="lg:col-span-7 p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 leading-relaxed">
          <span className="font-mono font-semibold text-slate-900 mr-1.5">
            GV CLINICAL SYNTHESIS:
          </span>
          {gvTrend.clinicalInterpretation}
        </div>
      </div>

      {/* 4 Diurnal 6-Hour Quadrant GV Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        {gvTrend.quadrants.map((quad) => {
          const targetHour =
            quad.id === 'nocturnal'
              ? 3
              : quad.id === 'morning'
                ? 8
                : quad.id === 'afternoon'
                  ? 15
                  : 21;

          return (
            <button
              key={quad.id}
              type="button"
              data-testid={`gv-quadrant-${quad.id}`}
              onClick={() => onSelectHourWindow?.(targetHour)}
              className={`text-left p-3 rounded border transition-colors cursor-pointer ${
                quad.isHighVariability
                  ? 'bg-amber-50/50 border-amber-300 hover:bg-amber-50'
                  : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-semibold text-slate-900">{quad.label}</span>
                <span className="text-slate-500">{quad.hourRangeLabel}</span>
              </div>

              <div className="mt-2 flex items-baseline justify-between tabular-nums">
                <div>
                  <span className="text-xl font-mono font-bold text-slate-900">
                    {quad.cvPercent.toFixed(1)}%
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 ml-1">CV</span>
                </div>
                <div className="text-xs font-mono text-slate-600">
                  SD: ±{quad.sdMgDl} mg/dL
                </div>
              </div>

              <div className="mt-1.5 pt-1.5 border-t border-slate-200/70 flex items-center justify-between text-[11px] font-mono text-slate-600 tabular-nums">
                <span>Mean: {quad.meanMgDl} mg/dL</span>
                <span>
                  Span: {quad.minMgDl}–{quad.maxMgDl}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
