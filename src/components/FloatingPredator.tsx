import React, { useState, useRef, useEffect } from 'react';
import { 
  Crosshair, 
  Minimize2, 
  Maximize2, 
  ShieldCheck, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Copy, 
  Check, 
  Zap, 
  Eye, 
  Move, 
  Clock, 
  Coins, 
  TrendingUp,
  AlertTriangle,
  Lock,
  Unlock,
  Radio,
  Flame,
  ArrowRight
} from 'lucide-react';
import { PredictionResult, UserAccessState, WingoDraw, AlgorithmType, AllMethodsStats, AutoSwitchEvent } from '../types/lottery';

interface FloatingPredatorProps {
  prediction: PredictionResult | null;
  secondsLeft: number;
  currentPeriod: string;
  nextPeriod: string;
  selectedTypeId: number;
  onChangeTypeId: (id: number) => void;
  lastDrawnItem?: WingoDraw | null;
  userAccess: UserAccessState;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenAdmin: () => void;
  onOpenRecharge: () => void;
  onApplyAiBet?: () => void;
  winCount: number;
  lossCount: number;
  aiAlgorithm?: AlgorithmType;
  onChangeAiAlgorithm?: (algo: AlgorithmType) => void;
  methodStats?: AllMethodsStats;
  isAutoSwitchEnabled?: boolean;
  onToggleAutoSwitch?: () => void;
  autoSwitchEvent?: AutoSwitchEvent | null;
}

export const FloatingPredator: React.FC<FloatingPredatorProps> = ({
  prediction,
  secondsLeft,
  currentPeriod,
  selectedTypeId,
  onChangeTypeId,
  lastDrawnItem,
  userAccess,
  soundEnabled,
  onToggleSound,
  onOpenAdmin,
  onOpenRecharge,
  onApplyAiBet,
  winCount,
  lossCount,
  aiAlgorithm = 'HMM',
  onChangeAiAlgorithm,
  methodStats,
  isAutoSwitchEnabled = true,
  onToggleAutoSwitch,
  autoSwitchEvent,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [opacity, setOpacity] = useState(0.96);
  const [isPinned, setIsPinned] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showOpacityControl, setShowOpacityControl] = useState(false);

  // Position state for dragging
  const [position, setPosition] = useState({ x: 24, y: 110 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 24,
    posY: 110
  });

  const widgetRef = useRef<HTMLDivElement>(null);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPinned) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isPinned) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragStartRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      posX: position.x,
      posY: position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      const newX = Math.max(10, Math.min(window.innerWidth - 380, dragStartRef.current.posX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 200, dragStartRef.current.posY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.startX;
      const dy = touch.clientY - dragStartRef.current.startY;
      const newX = Math.max(10, Math.min(window.innerWidth - 340, dragStartRef.current.posX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 150, dragStartRef.current.posY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  const totalGames = winCount + lossCount;
  const winRate = totalGames > 0 ? Math.round((winCount / totalGames) * 100) : 92;

  const handleCopyPrediction = () => {
    if (!prediction) return;
    const text = `🎯 SHWELOTTERY AI PREDATOR (${selectedTypeId === 30 ? 'WinGo 30s' : 'WinGo 60s'})\n📍 Target Period: ${prediction.targetPeriod}\n🔮 Guess: ${prediction.sizeBurmese}\n🎨 Color: ${prediction.colorBurmese}\n🔢 Numbers: ${prediction.numbers.join(', ')}\n⚡ Confidence: ${prediction.confidence}%\n🛡️ Pattern: ${prediction.pattern}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isTimeLimitBlocked = !userAccess.isAdmin && userAccess.timeCoins <= 0 && userAccess.remainingSeconds <= 0;

  // Short period display (last 5 digits)
  const shortPeriod = currentPeriod ? currentPeriod.slice(-5) : '';

  return (
    <div
      ref={widgetRef}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        opacity: opacity,
        zIndex: 50,
      }}
      className={`fixed transition-shadow select-none ${
        isDragging ? 'cursor-grabbing scale-[1.01]' : ''
      }`}
    >
      {/* MINIMIZED FLOATING PILL */}
      {isMinimized ? (
        <div 
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-3 bg-slate-900/95 border-2 border-amber-500/80 rounded-full px-4 py-2.5 shadow-2xl backdrop-blur-xl cursor-pointer hover:border-amber-400 hover:scale-105 transition-all group"
        >
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-400">
            <Crosshair className="w-4 h-4 animate-spin text-amber-400" style={{ animationDuration: '6s' }} />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                {selectedTypeId === 30 ? '30S PREDATOR' : '60S PREDATOR'}
              </span>
              {userAccess.isAdmin && (
                <span className="text-[9px] bg-red-600/80 text-white font-bold px-1 rounded">ADMIN VIP</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white">
                {secondsLeft}s
              </span>
              {prediction && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  prediction.size === 'BIG' ? 'bg-amber-500 text-black' : 'bg-blue-600 text-white'
                }`}>
                  {prediction.size === 'BIG' ? 'ကြီး (BIG)' : 'ငယ် (SMALL)'}
                </span>
              )}
            </div>
          </div>

          <button 
            onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
            className="p-1 rounded-full text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700"
            title="Expand Predator HUD"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* EXPANDED FULL CYBERPUNK HUD WIDGET */
        <div className="w-[360px] sm:w-[380px] rounded-2xl bg-slate-950/95 border border-amber-500/40 shadow-2xl backdrop-blur-2xl overflow-hidden ring-1 ring-amber-500/20">
          {/* TOP DRAG HEADER */}
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border-b border-amber-500/20 cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center w-6 h-6 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Crosshair className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-tech text-xs font-black tracking-widest text-amber-400">
                    FLOATING AI PREDATOR
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/40 font-mono">
                    {selectedTypeId === 30 ? '30 SEC' : '60 SEC'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  ShweLottery Official Sync
                </span>
              </div>
            </div>

            {/* Quick Action Icons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsPinned(!isPinned)}
                className={`p-1.5 rounded-md transition-colors ${
                  isPinned ? 'text-amber-400 bg-amber-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={isPinned ? 'Pinned (နေရာအတည်တကျဖြစ်နေသည်)' : 'Pin position'}
              >
                {isPinned ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setShowOpacityControl(!showOpacityControl)}
                className={`p-1.5 rounded-md transition-colors ${
                  showOpacityControl ? 'text-amber-400 bg-amber-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="Opacity Adjustment (ကြည်လင်မှုညှိရန်)"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onToggleSound}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title={soundEnabled ? 'Mute Alert' : 'Unmute Sound'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
              </button>

              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Minimize Widget"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* GAME SELECTOR PILLS */}
          <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
            <span className="text-[10px] uppercase font-mono text-slate-400">GAME MODE:</span>
            <div className="flex gap-1">
              <button
                onClick={() => onChangeTypeId(1)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold font-mono transition-all ${
                  selectedTypeId === 1
                    ? 'bg-amber-500 text-black shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                WinGo 1Min (60s)
              </button>
              <button
                onClick={() => onChangeTypeId(30)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold font-mono transition-all ${
                  selectedTypeId === 30
                    ? 'bg-amber-500 text-black shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                WinGo 30s
              </button>
            </div>
          </div>

          {/* AI ALGORITHM SELECTOR (HMM / MARKOV / ENSEMBLE) WITH LIVE WIN RATES & AUTO SWITCH */}
          <div className="px-3 py-1.5 bg-slate-950 border-b border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] uppercase font-mono text-amber-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                AI METHOD:
              </span>
              {onToggleAutoSwitch && (
                <button
                  type="button"
                  onClick={onToggleAutoSwitch}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-1 transition-all ${
                    isAutoSwitchEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                  title={isAutoSwitchEnabled ? 'Auto-Switch is ON (Auto-swaps to highest win % method)' : 'Auto-Switch is OFF'}
                >
                  <Zap className={`w-2.5 h-2.5 ${isAutoSwitchEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                  AUTO-SWAP: {isAutoSwitchEnabled ? 'ON' : 'OFF'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1">
              {([
                { id: 'HMM', label: 'HMM', icon: '🤖', rate: methodStats?.HMM?.winRate ?? 85 },
                { id: 'MARKOV', label: 'Markov', icon: '📊', rate: methodStats?.MARKOV?.winRate ?? 72 },
                { id: 'ENSEMBLE', label: 'Ensemble', icon: '⚡', rate: methodStats?.ENSEMBLE?.winRate ?? 80 },
              ] as const).map((item) => {
                const isSelected = aiAlgorithm === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChangeAiAlgorithm?.(item.id as AlgorithmType)}
                    className={`px-1 py-1 rounded text-[10px] font-mono font-bold transition-all flex flex-col items-center justify-center leading-tight ${
                      isSelected
                        ? item.id === 'HMM'
                          ? 'bg-amber-500 text-black shadow ring-1 ring-amber-300 font-black'
                          : item.id === 'MARKOV'
                          ? 'bg-purple-600 text-white shadow ring-1 ring-purple-300 font-black'
                          : 'bg-cyan-500 text-black shadow ring-1 ring-cyan-300 font-black'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-0.5 text-[10px]">
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                    <span className={`text-[9px] ${isSelected ? 'opacity-90 font-bold' : 'text-emerald-400 font-semibold'}`}>
                      {item.rate}%
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Auto-Switch Recent Alert */}
            {autoSwitchEvent && (
              <div className="p-1 rounded bg-amber-500/10 border border-amber-500/30 text-[9px] font-mono text-amber-300 flex items-center justify-between animate-pulse">
                <span className="flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  Auto-swapped: <strong className="text-white">{autoSwitchEvent.toAlgo}</strong> ({autoSwitchEvent.toWinRate}%)
                </span>
                <span className="text-[8px] text-slate-400 truncate max-w-[90px]">{autoSwitchEvent.reason}</span>
              </div>
            )}
          </div>

          {/* OPACITY SLIDER POPDOWN */}
          {showOpacityControl && (
            <div className="px-4 py-2 bg-slate-900 border-b border-amber-500/20 flex items-center justify-between text-xs">
              <span className="text-slate-300">HUD Opacity (ကြည်လင်မှု):</span>
              <input 
                type="range" 
                min="0.35" 
                max="1.0" 
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-32 accent-amber-500 cursor-pointer"
              />
              <span className="text-amber-400 font-mono text-xs">{Math.round(opacity * 100)}%</span>
            </div>
          )}

          {/* ADMIN VIP STATUS BAR OR USER TIME COIN BAR */}
          {userAccess.isAdmin ? (
            <div className="bg-gradient-to-r from-red-950/80 via-red-900/60 to-slate-950 px-3.5 py-1.5 border-b border-red-500/30 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-red-400" />
                <span className="text-[11px] font-bold text-red-300">
                  ADMIN LOGIN: <span className="text-white underline decoration-red-400">TIME LIMIT BYPASSED</span>
                </span>
              </div>
              <span className="text-[10px] bg-red-500 text-white font-extrabold px-1.5 py-0.5 rounded shadow">
                UNLIMITED VIP
              </span>
            </div>
          ) : (
            <div className="bg-slate-900/80 px-3.5 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>Time Coins: <strong className="text-amber-400 font-mono">{userAccess.timeCoins}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {Math.floor(userAccess.remainingSeconds / 60)}m {userAccess.remainingSeconds % 60}s
                </span>
                <button
                  onClick={onOpenRecharge}
                  className="text-[10px] bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40"
                >
                  + ဖြည့်မည်
                </button>
              </div>
            </div>
          )}

          {/* IF BLOCKED DUE TO TIME LIMIT */}
          {isTimeLimitBlocked ? (
            <div className="p-6 text-center bg-slate-950">
              <div className="w-12 h-12 mx-auto rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mb-3">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Time Limit ကုန်ဆုံးသွားပါပြီ</h4>
              <p className="text-xs text-slate-400 mb-4">
                Auto Guess ဆက်လက်အသုံးပြုရန် Time Coin ဖြည့်သွင်းပါ သို့မဟုတ် Admin အကောင့်ဖြင့် ဝင်ရောက်ပါ။
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={onOpenRecharge}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg shadow-lg flex items-center gap-1"
                >
                  <Coins className="w-3.5 h-3.5" />
                  Time Coin ဖြည့်ရန်
                </button>
                <button
                  onClick={onOpenAdmin}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg border border-slate-700 flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
                  Admin Login
                </button>
              </div>
            </div>
          ) : (
            /* ACTIVE AUTO GUESS PREDATOR BODY */
            <div className="p-3.5 space-y-3">
              {/* CURRENT BETTING PERIOD & COUNTDOWN ROW */}
              <div className="flex items-center justify-between bg-slate-900/90 rounded-xl p-2.5 border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                    TARGET PERIOD (ဝဘ်ဆိုက်လက်ရှိပွဲ)
                  </div>
                  <div className="text-sm font-mono font-bold text-amber-300 flex items-center gap-1.5">
                    <span>#{currentPeriod || 'Loading...'}</span>
                    {shortPeriod && (
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded font-mono">
                        (...{shortPeriod})
                      </span>
                    )}
                  </div>
                </div>

                {/* Circular / Box Countdown */}
                <div className="flex items-center gap-2">
                  <div className={`flex flex-col items-end px-3 py-1 rounded-lg border ${
                    secondsLeft <= 5 
                      ? 'bg-red-950/80 border-red-500 text-red-400 animate-pulse' 
                      : 'bg-slate-950 border-amber-500/30 text-amber-400'
                  }`}>
                    <span className="text-[9px] uppercase font-mono tracking-wider">COUNTDOWN</span>
                    <span className="text-xl font-tech font-black tracking-widest leading-none">
                      {String(secondsLeft).padStart(2, '0')}s
                    </span>
                  </div>
                </div>
              </div>

              {/* LAST DRAW SUMMARY QUICK STRIP */}
              {lastDrawnItem && (
                <div className="bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">
                    Last (#{lastDrawnItem.period.slice(-5)}):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      lastDrawnItem.color.includes('RED') ? 'bg-red-600' : 'bg-emerald-600'
                    }`}>
                      {lastDrawnItem.number}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      lastDrawnItem.size === 'BIG' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-600/20 text-blue-300'
                    }`}>
                      {lastDrawnItem.size === 'BIG' ? 'ကြီး (5-9)' : 'ငယ် (0-4)'}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {lastDrawnItem.openTime}
                    </span>
                  </div>
                </div>
              )}

              {/* MAIN GUESS CARD */}
              {prediction ? (
                <div className="relative overflow-hidden rounded-xl border-2 border-amber-500/60 bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 p-3 shadow-inner space-y-2.5">
                  <div className="absolute inset-0 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none"></div>

                  <div className="relative z-10 space-y-2">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
                        <span className="text-xs font-bold font-mono tracking-wider text-amber-400 uppercase">
                          AI TARGET PREDICTION
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                        {prediction.confidence}% CONFIDENCE
                      </span>
                    </div>

                    {/* TARGET PERIOD */}
                    <div className="bg-slate-950/90 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] uppercase font-mono text-slate-400 block font-bold">
                          TARGET
                        </span>
                        <span className="text-base font-mono font-black text-amber-400">
                          #{prediction.targetPeriod}
                        </span>
                      </div>
                      <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono">
                        {selectedTypeId === 30 ? '30 SEC' : '60 SEC'}
                      </span>
                    </div>

                    {/* CURRENT GUESS */}
                    <div className="bg-slate-950/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">
                        Current Guess:
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-tech font-black text-white">
                          {prediction.sizeBurmese} • {prediction.colorBurmese}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            prediction.size === 'BIG'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                          }`}>
                            {prediction.size}
                          </span>
                          <span className={`w-3 h-3 rounded-full ${
                            prediction.color === 'RED' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' :
                            prediction.color === 'GREEN' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-purple-500 shadow-[0_0_8px_#a855f7]'
                          }`}></span>
                        </div>
                      </div>
                    </div>

                    {/* LUCKY NUMBERS */}
                    <div className="bg-slate-950/90 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">
                          Lucky Numbers:
                        </span>
                        <span className="text-sm font-mono font-bold text-amber-300">
                          [{prediction.numbers.join(', ')}]
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {prediction.numbers.map((n) => (
                          <span
                            key={n}
                            className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs flex items-center justify-center shadow"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* HMM LATENT REGIME & STATE PROBABILITIES */}
                    {prediction.hmmDetails && (
                      <div className="p-2.5 rounded-lg bg-slate-950/95 border border-amber-500/30 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <span>🤖 HMM Regime:</span>
                          </span>
                          <span className="text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded text-[10px] border border-amber-500/30">
                            {prediction.hmmDetails.stateLabel}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-300 font-sans">
                          {prediction.hmmDetails.stateBurmese}
                        </div>

                        {/* P(BIG) vs P(SMALL) likelihood meter */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-amber-300 font-bold">P(BIG): {prediction.hmmDetails.pBig}%</span>
                            <span className="text-blue-300 font-bold">P(SMALL): {prediction.hmmDetails.pSmall}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                            <div
                              className="bg-amber-500 h-full transition-all duration-500"
                              style={{ width: `${prediction.hmmDetails.pBig}%` }}
                            ></div>
                            <div
                              className="bg-blue-500 h-full transition-all duration-500"
                              style={{ width: `${prediction.hmmDetails.pSmall}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Viterbi state likelihood */}
                        <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-0.5 border-t border-slate-900">
                          <span>Viterbi Likelihood:</span>
                          <strong className="text-emerald-400 font-mono">{prediction.hmmDetails.transitionLikelihood}%</strong>
                        </div>
                      </div>
                    )}

                    {/* RULE: MARKOV / HMM MATRIX */}
                    <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs">
                      <div className="flex items-start gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-amber-400 font-bold font-mono">Rule: </span>
                          <span className="text-slate-200">{prediction.pattern}</span>
                        </div>
                      </div>
                    </div>

                    {/* 1-CLICK AUTO APPLY BUTTON */}
                    {onApplyAiBet && (
                      <button
                        onClick={onApplyAiBet}
                        className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.3)] flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      >
                        <Zap className="w-4 h-4 text-black" />
                        Auto-Apply to Bet (လောင်းကြေးတွင် ရွေးမည်)
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-slate-400 text-xs bg-slate-900 rounded-xl">
                  ShweLottery Data Syncing...
                </div>
              )}

              {/* FOOTER ACTIONS */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Win Rate:</span>
                  <strong className="text-emerald-400 font-mono">{winRate}%</strong>
                  <span className="text-[10px] text-slate-500 font-mono">({winCount}W-{lossCount}L)</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopyPrediction}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors border border-slate-700 font-mono"
                    title="Copy Prediction Details"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={onOpenAdmin}
                    className="p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800"
                    title="Admin Dashboard"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
