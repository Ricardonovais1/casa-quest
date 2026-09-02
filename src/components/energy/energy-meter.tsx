// ============================================================
// Casa Quest — Energy: Energy Meter
// Circular gauge showing qualitative energy state.
// NEVER shows monetary values — designed for guardian view.
// ============================================================

import { cn } from '@/lib/utils';
import type { QualitativeStateInfo } from '@/domain/energy/types';

interface EnergyMeterProps {
  percentage: number; // 0-100+ (can exceed 100 with escalada)
  qualitative: QualitativeStateInfo;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const sizeConfig = {
  sm: { diameter: 80, stroke: 6, fontSize: 'text-lg' },
  md: { diameter: 120, stroke: 8, fontSize: 'text-2xl' },
  lg: { diameter: 160, stroke: 10, fontSize: 'text-3xl' },
};

export function EnergyMeter({
  percentage,
  qualitative,
  size = 'md',
  showLabel = true,
}: EnergyMeterProps) {
  const config = sizeConfig[size];
  const radius = (config.diameter - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Clamp percentage for arc calculation (visual circle always maxes at 100%)
  const arcPercentage = Math.min(percentage, 100) / 100;
  const offset = circumference * (1 - arcPercentage);

  // Determine color class based on state
  const colorClass = {
    exceptional: 'text-purple-600',
    excellent: 'text-emerald-600',
    good: 'text-yellow-600',
    needs_attention: 'text-orange-600',
    at_risk: 'text-red-500',
    critical: 'text-red-700',
  }[qualitative.state] || 'text-gray-400';

  // Track color
  const trackColor = percentage > 100 ? 'text-purple-200' : 'text-gray-200';

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: config.diameter, height: config.diameter }}
      >
        {/* Background track */}
        <svg
          className="absolute -rotate-90"
          width={config.diameter}
          height={config.diameter}
        >
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.stroke}
            className={trackColor}
          />
        </svg>

        {/* Foreground arc */}
        <svg
          className="absolute -rotate-90"
          width={config.diameter}
          height={config.diameter}
        >
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(colorClass, 'transition-all duration-700 ease-out')}
          />
        </svg>

        {/* Center text */}
        <span
          className={cn(
            'relative font-bold',
            config.fontSize,
            colorClass
          )}
        >
          {Math.round(percentage)}%
        </span>
      </div>

      {showLabel && (
        <div className="text-center">
          <span className={cn('text-sm font-semibold', colorClass)}>
            {qualitative.emoji} {qualitative.label}
          </span>
        </div>
      )}
    </div>
  );
}
