import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TelemetryPoint } from '../clinical/telemetryPresets';
import { computeCgmCkmDivergence } from '../clinical/reasoningEngine';

interface TelemetryCanvasChartProps {
  series: TelemetryPoint[];
  selectedHour: number;
  onSelectHour: (hour: number) => void;
  latestGlucoseOverride?: number;
  latestKetoneOverride?: number;
}

export const TelemetryCanvasChart: React.FC<TelemetryCanvasChartProps> = ({
  series,
  selectedHour,
  onSelectHour,
  latestGlucoseOverride,
  latestKetoneOverride
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [showDeltaDivergenceOverlay, setShowDeltaDivergenceOverlay] =
    useState<boolean>(true);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
    width: 860,
    height: 375
  });

  // Apply live overrides to hour 24 point if present
  const effectiveSeries: TelemetryPoint[] = useMemo(
    () =>
      series.map((pt, idx) => {
        if (idx === series.length - 1) {
          return {
            ...pt,
            glucoseMgDl: latestGlucoseOverride ?? pt.glucoseMgDl,
            ketoneMmolL: latestKetoneOverride ?? pt.ketoneMmolL
          };
        }
        return pt;
      }),
    [series, latestGlucoseOverride, latestKetoneOverride]
  );

  const maxGlucoseBound = useMemo(
    () =>
      Math.max(
        300,
        Math.ceil(Math.max(...effectiveSeries.map((d) => d.glucoseMgDl)) / 100) * 100 + 50
      ),
    [effectiveSeries]
  );
  const maxKetoneBound = 5.0;

  const divergenceSummary = useMemo(
    () => computeCgmCkmDivergence(effectiveSeries, maxGlucoseBound),
    [effectiveSeries, maxGlucoseBound]
  );

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width));
      const height = width < 600 ? 310 : 375;
      setCanvasSize({ width, height });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    ctx.scale(dpr, dpr);

    const W = canvasSize.width;
    const H = canvasSize.height;
    const padLeft = 58;
    const padRight = 58;
    const padTop = 30;
    const padBottom = 42;
    const plotW = W - padLeft - padRight;
    const plotH = H - padTop - padBottom;

    const xForHour = (hr: number) => padLeft + (hr / 24) * plotW;
    const yForGlucose = (g: number) =>
      padTop + plotH - (Math.min(maxGlucoseBound, Math.max(0, g)) / maxGlucoseBound) * plotH;
    const yForKetone = (k: number) =>
      padTop + plotH - (Math.min(maxKetoneBound, Math.max(0, k)) / maxKetoneBound) * plotH;

    // Clear canvas
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // 1. Shaded Time-in-Range Band (70 - 180 mg/dL)
    const yTirTop = yForGlucose(180);
    const yTirBottom = yForGlucose(70);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
    ctx.fillRect(padLeft, yTirTop, plotW, yTirBottom - yTirTop);

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padLeft, yTirTop);
    ctx.lineTo(padLeft + plotW, yTirTop);
    ctx.moveTo(padLeft, yTirBottom);
    ctx.lineTo(padLeft + plotW, yTirBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#047857';
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('TARGET TIR: 70–180 mg/dL', padLeft + 8, yTirTop + 13);

    // 2. Horizontal Grid Lines & Left Axis (Glucose mg/dL)
    const glucoseSteps = 5;
    ctx.font = '400 11px "IBM Plex Mono", monospace';
    for (let i = 0; i <= glucoseSteps; i++) {
      const gVal = Math.round((maxGlucoseBound / glucoseSteps) * i);
      const y = yForGlucose(gVal);

      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();

      ctx.fillStyle = '#0369A1';
      ctx.textAlign = 'right';
      ctx.fillText(`${gVal}`, padLeft - 8, y + 4);
    }

    // Right Axis labels (Ketone mmol/L)
    const ketoneTicks = [0, 1.0, 1.5, 3.0, 4.0, 5.0];
    for (const kVal of ketoneTicks) {
      const y = yForKetone(kVal);
      ctx.fillStyle = kVal >= 3.0 ? '#BE123C' : kVal >= 1.5 ? '#B45309' : '#64748B';
      ctx.textAlign = 'left';
      ctx.fillText(`${kVal.toFixed(1)}`, padLeft + plotW + 8, y + 4);
    }

    // 3. Vertical Hour Grid & X Axis Labels
    ctx.font = '400 11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    for (let hr = 0; hr <= 24; hr += 3) {
      const x = xForHour(hr);
      ctx.strokeStyle = '#F1F5F9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotH);
      ctx.stroke();

      ctx.fillStyle = '#475569';
      const label = `${String(hr).padStart(2, '0')}:00`;
      ctx.fillText(label, x, padTop + plotH + 20);
    }

    // 4. HIGH-RISK CGM-CKM DELTA DIVERGENCE OVERLAY (when enabled)
    if (showDeltaDivergenceOverlay && divergenceSummary.highRiskWindows.length > 0) {
      divergenceSummary.highRiskWindows.forEach((win) => {
        const xStart = xForHour(win.startHour);
        const xEnd = xForHour(win.endHour);
        const spanW = Math.max(6, xEnd - xStart);

        ctx.fillStyle = 'rgba(225, 29, 72, 0.055)';
        ctx.fillRect(xStart, padTop, spanW, plotH);

        ctx.fillStyle = 'rgba(190, 18, 60, 0.9)';
        ctx.fillRect(xStart, padTop, spanW, 3);

        const winPoints = effectiveSeries.filter(
          (p) => p.hour >= win.startHour && p.hour <= win.endHour
        );
        if (winPoints.length >= 2) {
          ctx.beginPath();
          winPoints.forEach((pt, idx) => {
            const x = xForHour(pt.hour);
            const yG = yForGlucose(pt.glucoseMgDl);
            if (idx === 0) ctx.moveTo(x, yG);
            else ctx.lineTo(x, yG);
          });
          for (let idx = winPoints.length - 1; idx >= 0; idx--) {
            const pt = winPoints[idx];
            const x = xForHour(pt.hour);
            const yK = yForKetone(pt.ketoneMmolL);
            ctx.lineTo(x, yK);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(244, 63, 94, 0.14)';
          ctx.fill();
        }

        winPoints.forEach((pt) => {
          const x = xForHour(pt.hour);
          const yG = yForGlucose(pt.glucoseMgDl);
          const yK = yForKetone(pt.ketoneMmolL);

          ctx.strokeStyle = 'rgba(225, 29, 72, 0.45)';
          ctx.lineWidth = 1.25;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(x, yG);
          ctx.lineTo(x, yK);
          ctx.stroke();
          ctx.setLineDash([]);
        });

        const badgeText = `Δ DIVERGENCE ZONE (${win.startLabel}–${win.endLabel})`;
        ctx.font = '600 9.5px "IBM Plex Mono", monospace';
        const bw = ctx.measureText(badgeText).width + 10;
        const bx = Math.min(padLeft + plotW - bw - 4, Math.max(padLeft + 4, xStart + 4));
        ctx.fillStyle = 'rgba(255, 241, 242, 0.95)';
        ctx.strokeStyle = 'rgba(225, 29, 72, 0.45)';
        ctx.lineWidth = 1;
        ctx.fillRect(bx, padTop + 6, bw, 15);
        ctx.strokeRect(bx, padTop + 6, bw, 15);
        ctx.fillStyle = '#9F1239';
        ctx.textAlign = 'left';
        ctx.fillText(badgeText, bx + 5, padTop + 16.5);
      });
    }

    // 5. Critical Ketone 3.0 mmol/L DKA Threshold Reference Line
    const yDkaThreshold = yForKetone(3.0);
    ctx.strokeStyle = 'rgba(225, 29, 72, 0.55)';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, yDkaThreshold);
    ctx.lineTo(padLeft + plotW, yDkaThreshold);
    ctx.stroke();
    ctx.setLineDash([]);

    const dkaLabelText = 'DKA THRESHOLD: 3.0 mmol/L BHB';
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    const dkaTextWidth = ctx.measureText(dkaLabelText).width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fillRect(padLeft + 6, yDkaThreshold - 15, dkaTextWidth + 8, 13);
    ctx.fillStyle = '#BE123C';
    ctx.textAlign = 'left';
    ctx.fillText(dkaLabelText, padLeft + 10, yDkaThreshold - 5);

    // 6. Ketone 1.5 mmol/L Warning Reference Line
    const yKetoneWarn = yForKetone(1.5);
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, yKetoneWarn);
    ctx.lineTo(padLeft + plotW, yKetoneWarn);
    ctx.stroke();
    ctx.setLineDash([]);

    // 7. Plot Glucose Area & Curve (Calibrated Clinical Cobalt/Cyan)
    ctx.beginPath();
    effectiveSeries.forEach((pt, i) => {
      const x = xForHour(pt.hour);
      const y = yForGlucose(pt.glucoseMgDl);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const gradG = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    gradG.addColorStop(0, 'rgba(2, 132, 199, 0.12)');
    gradG.addColorStop(1, 'rgba(2, 132, 199, 0.0)');
    ctx.lineTo(xForHour(24), padTop + plotH);
    ctx.lineTo(xForHour(0), padTop + plotH);
    ctx.closePath();
    ctx.fillStyle = gradG;
    ctx.fill();

    // 8. Plot Interstitial Ketone Curve (BHB mmol/L)
    ctx.beginPath();
    effectiveSeries.forEach((pt, i) => {
      const x = xForHour(pt.hour);
      const y = yForKetone(pt.ketoneMmolL);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    const peakK = Math.max(...effectiveSeries.map((d) => d.ketoneMmolL));
    ctx.strokeStyle = peakK >= 3.0 ? '#E11D48' : '#D97706';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 9. Draw Data Nodes & Event Markers
    effectiveSeries.forEach((pt) => {
      const x = xForHour(pt.hour);
      const yG = yForGlucose(pt.glucoseMgDl);
      const yK = yForKetone(pt.ketoneMmolL);

      ctx.fillStyle = pt.glucoseMgDl < 70 ? '#DC2626' : '#0284C7';
      ctx.beginPath();
      ctx.arc(x, yG, pt.eventAnnotation ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle =
        pt.ketoneMmolL >= 3.0 ? '#E11D48' : pt.ketoneMmolL >= 1.5 ? '#D97706' : '#F59E0B';
      ctx.beginPath();
      ctx.arc(x, yK, pt.eventAnnotation ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 10. Active / Hovered Crosshair Probe
    const activeHr = hoveredHour ?? selectedHour;
    const activePt =
      effectiveSeries.find((p) => p.hour === activeHr) ??
      effectiveSeries[effectiveSeries.length - 1];

    if (activePt) {
      const cx = xForHour(activePt.hour);
      const cyG = yForGlucose(activePt.glucoseMgDl);
      const cyK = yForKetone(activePt.ketoneMmolL);

      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(cx, padTop);
      ctx.lineTo(cx, padTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx, cyG, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = activePt.ketoneMmolL >= 3.0 ? '#E11D48' : '#D97706';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx, cyK, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Axis titles
    ctx.fillStyle = '#0369A1';
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CGM GLUCOSE (mg/dL)', 10, 16);

    ctx.fillStyle = peakK >= 3.0 ? '#BE123C' : '#B45309';
    ctx.textAlign = 'right';
    ctx.fillText('CKM KETONES (mmol/L)', W - 10, 16);
  }, [
    canvasSize,
    effectiveSeries,
    hoveredHour,
    selectedHour,
    maxGlucoseBound,
    showDeltaDivergenceOverlay,
    divergenceSummary
  ]);

  const handlePointerEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padLeft = 58;
    const padRight = 58;
    const plotW = canvasSize.width - padLeft - padRight;
    const ratio = Math.max(0, Math.min(1, (x - padLeft) / plotW));
    const hr = Math.round(ratio * 24);
    setHoveredHour(hr);
  };

  const handleClick = () => {
    if (hoveredHour !== null) {
      onSelectHour(hoveredHour);
    }
  };

  const inspectedHour = hoveredHour ?? selectedHour;
  const inspectedPoint =
    effectiveSeries.find((p) => p.hour === inspectedHour) ??
    effectiveSeries[effectiveSeries.length - 1];
  const inspectedDivergence =
    divergenceSummary.points.find((p) => p.hour === inspectedHour) ??
    divergenceSummary.points[divergenceSummary.points.length - 1];

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      {/* Top Legend, Delta Overlay Toggle & Coordinate Probe HUD */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-200">
        <div>
          <div className="text-xs font-mono text-slate-500">
            DUAL-CHANNEL INTERSTITIAL BIOSENSOR WAVEFORM · 24-HOUR WINDOW
          </div>
          <h3 className="text-base font-semibold text-slate-900 mt-0.5">
            Continuous Glucose (CGM) &amp; Continuous Ketone (CKM β-Hydroxybutyrate) Telemetry
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Interactive Delta & Divergence Overlay Toggle */}
          <button
            type="button"
            data-testid="toggle-delta-overlay"
            onClick={() => setShowDeltaDivergenceOverlay((prev) => !prev)}
            aria-pressed={showDeltaDivergenceOverlay}
            className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showDeltaDivergenceOverlay
                ? 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100'
                : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            {showDeltaDivergenceOverlay
              ? 'Δ CGM–CKM Divergence Overlay: ON'
              : 'Δ CGM–CKM Divergence Overlay: OFF'}
          </button>

          {/* Interactive Crosshair Coordinate & Hourly Delta Readout */}
          <div
            data-testid="chart-coordinate-hud"
            className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-md px-3.5 py-1.5 text-xs font-mono tabular-nums"
          >
            <div>
              <span className="text-slate-500">TIME:</span>{' '}
              <span className="font-semibold text-slate-900">{inspectedPoint.timeLabel}</span>
            </div>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <div>
              <span className="text-sky-700 font-semibold">CGM:</span>{' '}
              <span className="font-semibold text-slate-900">{inspectedPoint.glucoseMgDl}</span>{' '}
              <span className="text-slate-500">
                ({inspectedDivergence.deltaGlucoseMgDlHr >= 0 ? '+' : ''}
                {inspectedDivergence.deltaGlucoseMgDlHr}/hr)
              </span>
            </div>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <div>
              <span
                className={
                  inspectedPoint.ketoneMmolL >= 3.0
                    ? 'text-rose-700 font-semibold'
                    : 'text-amber-700 font-semibold'
                }
              >
                CKM:
              </span>{' '}
              <span className="font-semibold text-slate-900">
                {inspectedPoint.ketoneMmolL.toFixed(2)}
              </span>{' '}
              <span className="text-slate-500">
                ({inspectedDivergence.deltaKetoneMmolHr >= 0 ? '+' : ''}
                {inspectedDivergence.deltaKetoneMmolHr.toFixed(2)}/hr)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* High-Risk Divergence Summary Strip (visible when overlay is active) */}
      {showDeltaDivergenceOverlay && (
        <div
          data-testid="divergence-overlay-summary"
          className={`mb-3 px-3.5 py-2 rounded border text-xs font-mono flex flex-wrap items-center justify-between gap-2 tabular-nums ${
            divergenceSummary.totalHighRiskHours > 0
              ? 'bg-rose-50/70 border-rose-200 text-rose-950'
              : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          }`}
        >
          <div>
            <span className="font-semibold">
              {divergenceSummary.totalHighRiskHours > 0
                ? `▲ HIGH-RISK CGM–CKM DIVERGENCE DETECTED (${divergenceSummary.totalHighRiskHours} HRS: ${divergenceSummary.highRiskWindows
                    .map((w) => `${w.startLabel}–${w.endLabel}`)
                    .join(', ')})`
                : '● CGM–CKM CONCORDANCE VERIFIED (0 HIGH-RISK DIVERGENCE HOURS)'}
            </span>
            <span className="mx-2 text-slate-400">·</span>
            <span>{divergenceSummary.dominantMechanism}</span>
          </div>
          <div className="font-semibold shrink-0">
            POINT Δ INDEX @ {inspectedPoint.timeLabel}: {inspectedDivergence.divergenceIndex}/100 (PEAK:{' '}
            {divergenceSummary.peakDivergenceIndex}/100)
          </div>
        </div>
      )}

      {/* Canvas Container */}
      <div ref={containerRef} className="w-full relative">
        <canvas
          ref={canvasRef}
          data-testid="telemetry-canvas"
          onMouseMove={handlePointerEvent}
          onMouseLeave={() => setHoveredHour(null)}
          onClick={handleClick}
          className="w-full block cursor-crosshair select-none"
          aria-label="24-hour Continuous Glucose and Continuous Ketone Telemetry Canvas Chart with Delta Divergence Overlay"
        />
      </div>

      {/* COLOR-CODED 24-HOUR RISK ZONE INDICATOR BAR (Under Telemetry Chart) */}
      <div
        data-testid="hourly-risk-zone-indicator"
        className="mt-4 pt-3.5 border-t border-slate-200 space-y-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
          <div className="font-semibold text-slate-800">
            24-HOUR CGM–CKM DIVERGENCE RISK ZONE TIMELINE (CLICK ANY HOUR TO INSPECT):
          </div>
          <div className="flex flex-wrap items-center gap-3 text-slate-600">
            <span className="text-rose-800 font-semibold">
              ✖ CRITICAL THRESHOLD BREACH: {divergenceSummary.criticalZoneHours}h
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-800 font-semibold">
              ▲ ELEVATED WATCH: {divergenceSummary.elevatedWatchHours}h
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-800 font-semibold">
              ● NOMINAL SAFETY: {divergenceSummary.nominalHours}h
            </span>
          </div>
        </div>

        {/* 25-Hour Interactive Color-Coded Risk Zone Cells */}
        <div
          role="group"
          aria-label="24-Hour Risk Zone Indicator Cells"
          className="grid grid-cols-[repeat(25,minmax(0,1fr))] gap-1"
        >
          {divergenceSummary.points.map((pt) => {
            const isSelected = pt.hour === inspectedHour;
            const zoneStyles =
              pt.riskZone === 'CRITICAL_DIVERGENCE'
                ? 'bg-rose-600 text-white border-rose-700'
                : pt.riskZone === 'ELEVATED_WATCH'
                  ? 'bg-amber-400 text-slate-950 border-amber-500'
                  : 'bg-emerald-500/80 text-white border-emerald-600';

            return (
              <button
                key={pt.hour}
                type="button"
                data-testid={`risk-zone-hour-${pt.hour}`}
                onClick={() => onSelectHour(pt.hour)}
                title={`${pt.timeLabel} — ${pt.riskZone} (CGM: ${pt.glucoseMgDl} mg/dL, CKM: ${pt.ketoneMmolL.toFixed(2)} mmol/L, Δ Index: ${pt.divergenceIndex})`}
                aria-label={`Hour ${pt.timeLabel} Risk Zone ${pt.riskZone}`}
                className={`h-6 rounded-xs border text-[10px] font-mono font-semibold flex items-center justify-center transition-transform cursor-pointer tabular-nums ${zoneStyles} ${
                  isSelected ? 'ring-2 ring-slate-900 scale-105 z-10' : 'opacity-90 hover:opacity-100'
                }`}
              >
                {String(pt.hour).padStart(2, '0')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Scrubber & Event Annotation Bar */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <label
            htmlFor="telemetry-hour-scrubber"
            className="text-xs font-mono text-slate-600 whitespace-nowrap shrink-0"
          >
            SCRUB TIMELINE ({String(selectedHour).padStart(2, '0')}:00):
          </label>
          <input
            id="telemetry-hour-scrubber"
            type="range"
            min={0}
            max={24}
            step={1}
            value={selectedHour}
            onChange={(e) => onSelectHour(Number(e.target.value))}
            className="w-full max-w-xs accent-sky-700 cursor-pointer"
          />
        </div>

        <div className="text-xs font-mono text-slate-600">
          {inspectedPoint.eventAnnotation ? (
            <span className="text-slate-900 font-semibold">
              EVENT @ {inspectedPoint.timeLabel}: {inspectedPoint.eventAnnotation}
            </span>
          ) : inspectedDivergence.isHighRiskDivergence && inspectedDivergence.divergenceReason ? (
            <span className="text-rose-800 font-semibold">
              DIVERGENCE @ {inspectedPoint.timeLabel}: {inspectedDivergence.divergenceReason}
            </span>
          ) : (
            <span>
              Selected Hour Risk Tier: {inspectedDivergence.riskZone} (Δ Index{' '}
              {inspectedDivergence.divergenceIndex}/100)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
