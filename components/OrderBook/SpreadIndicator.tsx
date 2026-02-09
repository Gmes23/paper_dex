interface SpreadIndicatorProps {
    spread: {
      value: number;
      percentage: number;
    } | null;
  }

  export function SpreadIndicator({ spread }: SpreadIndicatorProps) {
    if (!spread) return null;

    return (
      <div className="px-3 py-2 border-y border-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Spread</span>
          <span className="text-gray-300 font-mono">{spread.value.toFixed(2)}</span>
        </div>
      </div>
    );
  }
