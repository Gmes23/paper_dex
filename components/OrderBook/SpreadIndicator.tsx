interface SpreadIndicatorProps {
    spread: {
      value: number;
      percentage: number;
    } | null;
    markPrice: number | null;
  }

  export function SpreadIndicator({ spread, markPrice }: SpreadIndicatorProps) {
    if (!spread) return null;

    return (
      <div className="px-3 py-2 border-y border-white/5">
        <div className="grid grid-cols-3 items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            {/* <span className="text-gray-500">Spread</span> */}
            <span className="text-gray-300 font-mono">{spread.value.toFixed(2)}</span>
          </div>
          <div className="flex flex-1 justify-end gap-1">
            {/* <span className="text-gray-500">Mark</span> */}
            <span className="text-cyan-300 font-mono text-right">
              {markPrice != null && Number.isFinite(markPrice) ? markPrice.toFixed(1) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-end gap-1">
            {/* <span className="text-gray-500">%</span> */}
            <span className="text-gray-300 font-mono">{spread.percentage.toFixed(4)}%</span>
          </div>
        </div>
      </div>
    );
  }
