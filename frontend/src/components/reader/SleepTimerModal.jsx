import React from 'react';
import { Moon, Clock, X, Check } from 'lucide-react';

const TIMER_OPTIONS = [
  { label: 'Off', minutes: 0 },
  { label: '15 Minutes', minutes: 15 },
  { label: '30 Minutes', minutes: 30 },
  { label: '45 Minutes', minutes: 45 },
  { label: '60 Minutes', minutes: 60 },
  { label: 'End of Chapter', minutes: -1 },
];

export default function SleepTimerModal({
  isOpen,
  onClose,
  activeMinutes,
  onSelectTimer,
  theme,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border transition-all animate-scale-in"
        style={{
          backgroundColor: theme?.cardBg || '#ffffff',
          borderColor: theme?.border || 'rgba(0, 0, 0, 0.1)',
          color: theme?.text || '#1c1917',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: theme?.border || '#eee' }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold">Sleep Timer</h3>
              <p className="text-xs opacity-60">Automatically pause narration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-70 hover:opacity-100"
            aria-label="Close sleep timer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-1.5">
          {TIMER_OPTIONS.map((opt) => {
            const isSelected = activeMinutes === opt.minutes;
            return (
              <button
                key={opt.label}
                onClick={() => {
                  onSelectTimer(opt.minutes);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock className={`w-4 h-4 ${isSelected ? 'text-white' : 'opacity-50'}`} />
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-white" />}
              </button>
            );
          })}
        </div>

        <div className="pt-2 text-center text-xs opacity-50 font-mono">
          Audio gently fades when timer reaches zero
        </div>
      </div>
    </div>
  );
}
