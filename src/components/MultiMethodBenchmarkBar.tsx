import React from 'react';
import { 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  Crown, 
  Bot, 
  Cpu, 
  Layers, 
  ArrowRight, 
  Bell, 
  X,
  Flame,
  Snowflake,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { AlgorithmType, AllMethodsStats, AutoSwitchEvent, PredictionResult } from '../types/lottery';

interface MultiMethodBenchmarkBarProps {
  stats: AllMethodsStats;
  currentAlgorithm: AlgorithmType;
  onSelectAlgorithm: (algo: AlgorithmType) => void;
  isAutoSwitchEnabled: boolean;
  onToggleAutoSwitch: () => void;
  autoSwitchEvent: AutoSwitchEvent | null;
  onDismissAutoSwitch?: () => void;
  predictions?: Record<AlgorithmType, PredictionResult> | null;
  nextPeriod?: string;
  isUserPlaying?: boolean;
}

export const MultiMethodBenchmarkBar: React.FC<MultiMethodBenchmarkBarProps> = ({
  stats,
  currentAlgorithm,
  onSelectAlgorithm,
  isAutoSwitchEnabled,
  onToggleAutoSwitch,
  autoSwitchEvent,
  onDismissAutoSwitch,
  predictions,
  nextPeriod,
  isUserPlaying = false,
}) => {
  const algorithms: AlgorithmType[] = ['HMM', 'MARKOV', 'ENSEMBLE'];

  // Identify highest win rate algorithm
  const ranked = [...algorithms].sort((a, b) => {
    const rateA = stats[a]?.winRate || 0;
    const rateB = stats[b]?.winRate || 0;
    if (rateB !== rateA) return rateB - rateA;
    return (stats[b]?.streak || 0) - (stats[a]?.streak || 0);
  });
  const leaderAlgo = ranked[0];

  const getMethodTheme = (algo: AlgorithmType) => {
    switch (algo) {
      case 'HMM':
        return {
          name: 'HMM Model (v3.0)',
          tagline: 'Hidden Markov Model (Regime)',
          accentColor: 'amber',
          borderActive: 'border-amber-400 ring-2 ring-amber-400/50',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          gradient: 'from-amber-500/10 via-amber-950/20 to-slate-900',
          barGradient: 'from-amber-500 to-amber-300',
          icon: Bot,
        };
      case 'MARKOV':
        return {
          name: 'Markov Chain',
          tagline: 'Markov Matrix (Pattern)',
          accentColor: 'purple',
          borderActive: 'border-purple-400 ring-2 ring-purple-400/50',
          badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          gradient: 'from-purple-500/10 via-purple-950/20 to-slate-900',
          barGradient: 'from-purple-500 to-indigo-400',
          icon: Cpu,
        };
      case 'ENSEMBLE':
        return {
          name: 'Ensemble Consensus',
          tagline: 'HMM + Markov Consensus Voting',
          accentColor: 'cyan',
          borderActive: 'border-cyan-400 ring-2 ring-cyan-400/50',
          badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          gradient: 'from-cyan-500/10 via-cyan-950/20 to-slate-900',
          barGradient: 'from-cyan-500 to-emerald-400',
          icon: Layers,
        };
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. AUTO-SWITCH LIVE ALERT BANNER (WHEN AI AUTO-SWITCHES) */}
      {autoSwitchEvent && (
        <div className="relative p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/90 via-slate-900/90 to-purple-950/90 border-2 border-amber-400 text-amber-200 shadow-[0_0_25px_rgba(245,158,11,0.25)] animate-pulse flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
              <Zap className="w-5 h-5 text-amber-400 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-tech text-xs sm:text-sm font-black text-white tracking-wider">
                  ⚡ AI DYNAMIC AUTO-SWITCH ACTIVATED
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  AUTONOMOUS ADAPTATION
                </span>
              </div>
              <p className="text-xs text-amber-300/90 mt-0.5 font-sans">
                {autoSwitchEvent.reason} (
                <strong className="text-white">{autoSwitchEvent.fromAlgo}</strong> ➡️{' '}
                <strong className="text-emerald-300 font-tech">{autoSwitchEvent.toAlgo} {autoSwitchEvent.toWinRate}% Win Rate</strong>)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={onDismissAutoSwitch}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="ပိတ်မည်"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. REAL-TIME MULTI-AI BENCHMARK HUD CONTAINER */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 shadow-2xl space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="font-tech text-sm sm:text-base font-black text-white tracking-wider flex items-center gap-2">
                REAL-TIME MULTI-AI BENCHMARK & ADAPTIVE AUTO-SWITCH
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                LIVE CONCURRENT RUNNING
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              User ကစားသည်ဖြစ်စေ၊ မကစားသည်ဖြစ်စေ HMM, Markov, Ensemble နည်းပညာ (၃) မျိုးလုံးကို နောက်ကွယ်တွင် တပြိုင်နက် Live Run ထားပြီး စွမ်းဆောင်ရည် အကောင်းဆုံးသို့ အလိုအလျောက် ရွေးချယ်ပေးပါသည်
            </p>
          </div>

          {/* AI Auto-Switch Master Toggle */}
          <div className="flex items-center gap-2 bg-slate-950/80 p-2 rounded-xl border border-slate-800 shrink-0">
            <div className="text-left">
              <span className="text-[10px] font-mono text-slate-400 block font-bold uppercase">
                AI SMART AUTO-SWITCH
              </span>
              <span className="text-[11px] text-slate-300 font-sans">
                {isAutoSwitchEnabled ? 'ဖွင့်ထားသည် (Lose များလျှင် အလိုအလျောက်ပြောင်း)' : 'ပိတ်ထားသည် (Manual သာ)'}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleAutoSwitch}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-black transition-all flex items-center gap-1.5 ${
                isAutoSwitchEnabled
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/20 ring-1 ring-amber-400'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${isAutoSwitchEnabled ? 'fill-current animate-pulse' : ''}`} />
              <span>{isAutoSwitchEnabled ? 'AUTO-SWITCH: ON' : 'AUTO-SWITCH: OFF'}</span>
            </button>
          </div>
        </div>

        {/* 3 METHOD COMPARATIVE PERFORMANCE CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {algorithms.map((algo) => {
            const mStats = stats[algo];
            const theme = getMethodTheme(algo);
            const Icon = theme.icon;
            const isActive = currentAlgorithm === algo;
            const isLeader = leaderAlgo === algo;
            const pred = predictions ? predictions[algo] : null;

            // Determine win rate color
            const winRate = mStats?.winRate ?? 75;
            const rateColor = winRate >= 80 ? 'text-emerald-400' : winRate >= 70 ? 'text-amber-400' : 'text-rose-400';

            return (
              <div
                key={algo}
                onClick={() => onSelectAlgorithm(algo)}
                className={`relative p-3.5 rounded-xl border-2 transition-all cursor-pointer bg-gradient-to-br ${theme.gradient} ${
                  isActive
                    ? theme.borderActive + ' shadow-xl'
                    : 'border-slate-800/80 hover:border-slate-700 opacity-90 hover:opacity-100'
                }`}
              >
                {/* Top Badges */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-slate-300" />
                    <span className="font-tech text-xs font-black text-white tracking-wide">
                      {theme.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isLeader && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold bg-amber-500 text-black flex items-center gap-0.5 shadow">
                        <Crown className="w-2.5 h-2.5 fill-current" />
                        <span>LEADER</span>
                      </span>
                    )}
                    {isActive && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold bg-emerald-500 text-black flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping"></span>
                        <span>ACTIVE</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Subtitle / Method Logic Description */}
                <span className="text-[10px] text-slate-400 block line-clamp-1 mb-2.5 font-sans">
                  {theme.tagline}
                </span>

                {/* Win Rate & Score Section */}
                <div className="flex items-baseline justify-between mb-1.5">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">
                      WIN RATE (အနိုင်နှုန်း)
                    </span>
                    <span className={`text-2xl font-tech font-black tracking-tight ${rateColor}`}>
                      {winRate}%
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">
                      SCORE (ပွဲရလဒ်)
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-200">
                      <strong className="text-emerald-400">{mStats?.wins ?? 0}W</strong> -{' '}
                      <strong className="text-rose-400">{mStats?.losses ?? 0}L</strong>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      ({mStats?.total ?? 0} Rounds)
                    </span>
                  </div>
                </div>

                {/* Win Rate Visual Progress Meter */}
                <div className="space-y-1 mb-3">
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full bg-gradient-to-r ${theme.barGradient} transition-all duration-500`}
                      style={{ width: `${Math.min(100, Math.max(5, winRate))}%` }}
                    />
                  </div>
                </div>

                {/* Streak & Last 10 Rounds Micro-Dots */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">Streak:</span>
                    {(mStats?.streak ?? 0) >= 0 ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                        <Flame className="w-3 h-3 text-amber-400 fill-current" />
                        <span>+{mStats?.streak ?? 0}W</span>
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-0.5">
                        <Snowflake className="w-3 h-3 text-blue-400" />
                        <span>{mStats?.streak ?? 0}L</span>
                      </span>
                    )}
                  </div>

                  {/* Last 8 Mini Outcome Dots */}
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[9px]">Last:</span>
                    <div className="flex items-center gap-0.5">
                      {(mStats?.last10 || [true, true, false, true, true]).slice(0, 8).map((won, idx) => (
                        <span
                          key={idx}
                          className={`w-2 h-2 rounded-full ${
                            won
                              ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]'
                              : 'bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.8)]'
                          }`}
                          title={won ? 'Win' : 'Loss'}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Prediction for Current/Upcoming Draw */}
                {pred && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400 text-[10px]">
                      Next #{nextPeriod ? nextPeriod.slice(-4) : 'Guess'}:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                          pred.size === 'BIG'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {pred.sizeBurmese}
                      </span>
                      <span className="text-[10px] text-slate-400">({pred.confidence}%)</span>
                    </div>
                  </div>
                )}

                {/* Select button if not active */}
                {!isActive && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAlgorithm(algo);
                    }}
                    className="mt-2.5 w-full py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition-colors border border-slate-700"
                  >
                    <span>ဤ Method ကို သုံးမည်</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Helper Note */}
        <div className="pt-2 border-t border-slate-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              <strong>Smart Auto-Switch</strong> ဖွင့်ထားပါက လက်ရှိ Method ရှုံးမှုများလာလျှင် Win % အမြင့်ဆုံးခေါင်းဆောင် Method သို့ အလိုအလျောက် ပြောင်းလဲကူးပြောင်းပေးပါမည်။
            </span>
          </div>
          <div className="font-mono text-[10px] text-amber-400/90 shrink-0">
            Active: <strong className="text-white">{currentAlgorithm}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
