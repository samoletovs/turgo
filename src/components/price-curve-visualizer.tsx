'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PricingCurvePoint } from '@/types';

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

interface PriceCurveVisualizerProps {
  /** Pricing curve data points */
  curve: PricingCurvePoint[];
  /** Current day since listing start (0 = today) */
  currentDay: number;
  /** Starting price */
  startPrice: number;
  /** Minimum price floor */
  minPrice: number;
  /** Urgency level */
  urgency: string;
  /** Optional: actual sale events / price changes to overlay */
  priceEvents?: { day: number; price: number; type: 'adjustment' | 'offer' | 'sale' }[];
  /** Compact mode for dashboard cards */
  compact?: boolean;
}

const URGENCY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  ONE_DAY: { label: 'Sell today', color: '#ef4444', bgColor: 'bg-red-500/10' },
  THREE_DAYS: { label: '3-day sale', color: '#f97316', bgColor: 'bg-orange-500/10' },
  ONE_WEEK: { label: '1-week plan', color: '#eab308', bgColor: 'bg-yellow-500/10' },
  TWO_WEEKS: { label: '2-week plan', color: '#3b82f6', bgColor: 'bg-blue-500/10' },
  ONE_MONTH: { label: '1-month plan', color: '#22c55e', bgColor: 'bg-green-500/10' },
  NO_RUSH: { label: 'No rush', color: '#6b7280', bgColor: 'bg-gray-500/10' },
};

export function PriceCurveVisualizer({
  curve,
  currentDay,
  startPrice,
  minPrice,
  urgency,
  priceEvents = [],
  compact = false,
}: PriceCurveVisualizerProps) {
  const config = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.ONE_WEEK;

  // SVG dimensions
  const width = compact ? 280 : 520;
  const height = compact ? 120 : 200;
  const padding = { top: 20, right: 30, bottom: 30, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Compute path + scale
  const { pathD, areaD, currentPoint, yTicks, xTicks } = useMemo(() => {
    if (curve.length === 0)
      return { pathD: '', areaD: '', currentPoint: null, yTicks: [], xTicks: [] };

    const maxDay = curve[curve.length - 1].day;
    const priceMax = startPrice * 1.05;
    const priceMin = minPrice * 0.95;

    const scaleX = (d: number) => padding.left + (d / Math.max(maxDay, 1)) * chartW;
    const scaleY = (p: number) =>
      padding.top + (1 - (p - priceMin) / (priceMax - priceMin)) * chartH;

    // Build path
    const line = curve
      .map(
        (pt, i) =>
          `${i === 0 ? 'M' : 'L'} ${scaleX(pt.day).toFixed(1)} ${scaleY(pt.price).toFixed(1)}`,
      )
      .join(' ');

    // Build area (filled under the curve)
    const area =
      line +
      ` L ${scaleX(curve[curve.length - 1].day).toFixed(1)} ${scaleY(priceMin).toFixed(1)}` +
      ` L ${scaleX(curve[0].day).toFixed(1)} ${scaleY(priceMin).toFixed(1)} Z`;

    // Current day marker
    let cp = null;
    for (let i = 0; i < curve.length; i++) {
      if (curve[i].day >= currentDay) {
        // Interpolate
        if (i === 0) {
          cp = {
            x: scaleX(curve[0].day),
            y: scaleY(curve[0].price),
            price: curve[0].price,
            reason: curve[0].reason,
          };
        } else {
          const prev = curve[i - 1];
          const next = curve[i];
          const t = (currentDay - prev.day) / (next.day - prev.day);
          const p = prev.price + t * (next.price - prev.price);
          cp = { x: scaleX(currentDay), y: scaleY(p), price: Math.round(p), reason: next.reason };
        }
        break;
      }
    }
    if (!cp && curve.length > 0) {
      const last = curve[curve.length - 1];
      cp = { x: scaleX(last.day), y: scaleY(last.price), price: last.price, reason: last.reason };
    }

    // Y axis ticks (3–5 prices)
    const yTickCount = compact ? 3 : 5;
    const yT = Array.from({ length: yTickCount }, (_, i) => {
      const p = priceMin + ((priceMax - priceMin) * i) / (yTickCount - 1);
      return { y: scaleY(p), label: `€${Math.round(p)}` };
    });

    // X axis ticks (day labels)
    const xTickCount = compact ? 3 : Math.min(curve.length, 6);
    const xT = Array.from({ length: xTickCount }, (_, i) => {
      const dayVal = Math.round((maxDay * i) / (xTickCount - 1));
      return { x: scaleX(dayVal), label: dayVal === 0 ? 'Now' : `D${dayVal}` };
    });

    return { pathD: line, areaD: area, currentPoint: cp, yTicks: yT, xTicks: xT };
  }, [curve, currentDay, startPrice, minPrice, chartW, chartH, padding.left, padding.top, compact]);

  if (curve.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8 text-muted-foreground text-sm">
          No pricing data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className={compact ? 'p-3' : 'p-5'}>
        {/* Header */}
        {!compact && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Price Strategy</h3>
            </div>
            <Badge variant="outline" className={config.bgColor}>
              {config.label}
            </Badge>
          </div>
        )}

        {/* SVG Chart */}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ maxHeight: compact ? 120 : 220 }}
        >
          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <g key={`y-${i}`}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={width - padding.right}
                y2={tick.y}
                stroke="currentColor"
                strokeOpacity={0.07}
                strokeDasharray="4 4"
              />
              {!compact && (
                <text
                  x={padding.left - 8}
                  y={tick.y + 3}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity={0.4}
                  fontSize={10}
                >
                  {tick.label}
                </text>
              )}
            </g>
          ))}

          {/* X axis labels */}
          {xTicks.map((tick, i) => (
            <text
              key={`x-${i}`}
              x={tick.x}
              y={height - 5}
              textAnchor="middle"
              fill="currentColor"
              fillOpacity={0.4}
              fontSize={10}
            >
              {tick.label}
            </text>
          ))}

          {/* Area fill gradient */}
          <defs>
            <linearGradient id={`curve-gradient-${urgency}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={config.color} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Filled area */}
          <motion.path
            d={areaD}
            fill={`url(#curve-gradient-${urgency})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          />

          {/* Min price line */}
          {!compact && (
            <>
              <line
                x1={padding.left}
                y1={
                  padding.top +
                  chartH *
                    (1 -
                      (minPrice * 0.95 - minPrice * 0.95) / (startPrice * 1.05 - minPrice * 0.95))
                }
                x2={width - padding.right}
                y2={
                  padding.top +
                  chartH *
                    (1 -
                      (minPrice * 0.95 - minPrice * 0.95) / (startPrice * 1.05 - minPrice * 0.95))
                }
                stroke="#ef4444"
                strokeOpacity={0.3}
                strokeDasharray="6 3"
              />
              <text
                x={width - padding.right + 4}
                y={padding.top + chartH + 3}
                fill="#ef4444"
                fillOpacity={0.5}
                fontSize={9}
              >
                min
              </text>
            </>
          )}

          {/* Price curve line */}
          <motion.path
            d={pathD}
            fill="none"
            stroke={config.color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          />

          {/* Curve data points */}
          {!compact &&
            curve.map((pt, i) => {
              const maxDay = curve[curve.length - 1].day;
              const priceMax = startPrice * 1.05;
              const priceMin2 = minPrice * 0.95;
              const x = padding.left + (pt.day / Math.max(maxDay, 1)) * chartW;
              const y =
                padding.top + (1 - (pt.price - priceMin2) / (priceMax - priceMin2)) * chartH;
              return (
                <motion.circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={3}
                  fill={config.color}
                  stroke="white"
                  strokeWidth={1.5}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 * i, duration: 0.3 }}
                />
              );
            })}

          {/* Price events overlay */}
          {priceEvents.map((evt, i) => {
            const maxDay = curve[curve.length - 1].day;
            const priceMax = startPrice * 1.05;
            const priceMin2 = minPrice * 0.95;
            const x = padding.left + (evt.day / Math.max(maxDay, 1)) * chartW;
            const y = padding.top + (1 - (evt.price - priceMin2) / (priceMax - priceMin2)) * chartH;
            const color =
              evt.type === 'sale' ? '#22c55e' : evt.type === 'offer' ? '#3b82f6' : '#f97316';
            return (
              <g key={`evt-${i}`}>
                <circle cx={x} cy={y} r={5} fill={color} fillOpacity={0.2} />
                <circle cx={x} cy={y} r={3} fill={color} />
              </g>
            );
          })}

          {/* Current position marker */}
          {currentPoint && (
            <g>
              {/* Vertical line to current position */}
              <line
                x1={currentPoint.x}
                y1={padding.top}
                x2={currentPoint.x}
                y2={padding.top + chartH}
                stroke={config.color}
                strokeOpacity={0.2}
                strokeDasharray="3 3"
              />
              {/* Pulsing circle */}
              <motion.circle
                cx={currentPoint.x}
                cy={currentPoint.y}
                r={8}
                fill={config.color}
                fillOpacity={0.15}
                animate={{ r: [8, 12, 8] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <circle
                cx={currentPoint.x}
                cy={currentPoint.y}
                r={5}
                fill={config.color}
                stroke="white"
                strokeWidth={2}
              />
              {/* Price label */}
              <rect
                x={currentPoint.x - 28}
                y={currentPoint.y - 28}
                width={56}
                height={18}
                rx={4}
                fill={config.color}
              />
              <text
                x={currentPoint.x}
                y={currentPoint.y - 16}
                textAnchor="middle"
                fill="white"
                fontSize={11}
                fontWeight={600}
              >
                €{currentPoint.price}
              </text>
            </g>
          )}
        </svg>

        {/* Legend / info below chart */}
        {!compact && currentPoint && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium">
                Day {currentDay}: €{currentPoint.price}
              </p>
              <p className="text-xs text-muted-foreground">{currentPoint.reason}</p>
            </div>
          </div>
        )}

        {/* Price range stats */}
        {!compact && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/30 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Start</p>
              <p className="text-sm font-bold">€{startPrice}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current</p>
              <p className="text-sm font-bold" style={{ color: config.color }}>
                €{currentPoint?.price ?? startPrice}
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Floor</p>
              <p className="text-sm font-bold text-red-500">€{minPrice}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
