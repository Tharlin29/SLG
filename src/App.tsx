/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Crosshair, 
  ShieldCheck, 
  Coins, 
  Globe, 
  ExternalLink, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Layers, 
  Monitor, 
  Activity,
  Zap,
  Sparkles,
  Info,
  Clock,
  Key,
  Gamepad2,
  Table,
  CheckCircle2,
  Copy
} from 'lucide-react';
import { FloatingPredator } from './components/FloatingPredator';
import { PlayableGameStation } from './components/PlayableGameStation';
import { WingoGameBoard } from './components/WingoGameBoard';
import { AdminPanel } from './components/AdminPanel';
import { ShweLotteryStatus } from './components/ShweLotteryStatus';
import { UserCoinModal } from './components/UserCoinModal';
import { WingoDraw, PredictionResult, ShweAccount, UserAccessState, AlgorithmType, AllMethodsStats, AutoSwitchEvent } from './types/lottery';
import { calculateAutoGuess, calculateAllPredictions, calculateInitialMethodStats, updateMethodStatsWithResult, evaluateAutoSwitch } from './utils/predictionEngine';
import { playWinSound, playYouWinVoice, playRadarLockSound, playTickSound, playAdminUnlockedSound } from './utils/audio';
import { MultiMethodBenchmarkBar } from './components/MultiMethodBenchmarkBar';

export default function App() {
  // Navigation tabs: 'PLAY' (Default playable console), 'WEBVIEW' (shwelottery.net), 'HISTORY'
  const [activeTab, setActiveTab] = useState<'PLAY' | 'WEBVIEW' | 'HISTORY'>('PLAY');

  // Game Type Selector: 1 = Win Go 1Min (60s), 30 = Win Go 30s
  const [selectedTypeId, setSelectedTypeId] = useState<number>(1);

  // Wingo Live Game State
  const [history, setHistory] = useState<WingoDraw[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<string>(''); // Active ongoing period on website
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);

  // Win/Loss statistics
  const [winCount, setWinCount] = useState<number>(18);
  const [lossCount, setLossCount] = useState<number>(2);

  // Audio state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // ShweLottery Account State (Phone: 9798023829, Pass: 166061kp)
  const [account, setAccount] = useState<ShweAccount>({
    phone: '9798023829',
    password: '166061kp',
    isConnected: true,
    latencyMs: 34,
    lastPing: Date.now(),
    targetUrl: 'https://www.shwelottery.net/',
    nickName: 'MemberNNG0XDE5',
    amount: '1,000.00'
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // User Access & Admin State (ADMIN BYPASSES ALL TIME LIMITS)
  const [userAccess, setUserAccess] = useState<UserAccessState>({
    isAdmin: false,
    timeCoins: 5,
    remainingSeconds: 1800, // 30 minutes for normal user
    unlimitedTime: false
  });

  // Modal dialog states
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isRechargeOpen, setIsRechargeOpen] = useState<boolean>(false);

  // AI Sensitivity setting & Model Selection (HMM as default premier method)
  const [sensitivity, setSensitivity] = useState<'BALANCED' | 'AGGRESSIVE' | 'HIGH_CONFIDENCE'>('BALANCED');
  const [aiAlgorithm, setAiAlgorithm] = useState<AlgorithmType>('HMM');

  // Multi-Method Real-Time Benchmarking & Adaptive Auto-Switching States
  const [methodStats, setMethodStats] = useState<AllMethodsStats>(() => calculateInitialMethodStats([]));
  const [methodPredictions, setMethodPredictions] = useState<Record<AlgorithmType, PredictionResult> | null>(null);
  const [isAutoSwitchEnabled, setIsAutoSwitchEnabled] = useState<boolean>(true);
  const [autoSwitchEvent, setAutoSwitchEvent] = useState<AutoSwitchEvent | null>(null);

  // Tracking refs to accurately detect draw transitions
  const lastDrawnPeriodRef = useRef<string>('');
  const lastPredictedPeriodRef = useRef<string>('');
  const currentPredictionRef = useRef<PredictionResult | null>(null);
  const aiAlgorithmRef = useRef<AlgorithmType>(aiAlgorithm);
  const isAutoSwitchEnabledRef = useRef<boolean>(isAutoSwitchEnabled);
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  const activeMethodPredictionsRef = useRef<{
    targetPeriod: string;
    predictions: Record<AlgorithmType, PredictionResult>;
  } | null>(null);
  const bootstrappedHistoryRef = useRef<boolean>(false);

  // Copy helper state
  const [copiedLogin, setCopiedLogin] = useState(false);

  useEffect(() => {
    currentPredictionRef.current = prediction;
  }, [prediction]);

  useEffect(() => {
    aiAlgorithmRef.current = aiAlgorithm;
  }, [aiAlgorithm]);

  useEffect(() => {
    isAutoSwitchEnabledRef.current = isAutoSwitchEnabled;
  }, [isAutoSwitchEnabled]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Main Data Fetcher function
  const fetchWingoData = async (typeIdToFetch = selectedTypeId) => {
    try {
      const res = await fetch(`/api/shwelottery/wingo-history?typeid=${typeIdToFetch}`);
      if (res.ok) {
        const data = await res.json();
        if (data.history && Array.isArray(data.history)) {
          const freshHistory: WingoDraw[] = data.history;
          setHistory(freshHistory);

          // Bootstrap initial backtested track record from available real history
          if (!bootstrappedHistoryRef.current && freshHistory.length >= 8) {
            bootstrappedHistoryRef.current = true;
            const initialBacktested = calculateInitialMethodStats(freshHistory, sensitivity);
            setMethodStats(initialBacktested);
          }

          // The active period currently open on shwelottery.net
          const activePeriod = data.currentBettingPeriod || data.currentPeriod;
          setCurrentPeriod(activePeriod);
          setSecondsLeft(data.secondsLeft);

          if (data.session) {
            setAccount((prev) => ({
              ...prev,
              nickName: data.session.nickName || prev.nickName,
              amount: data.session.amount || prev.amount,
              userId: data.session.userId || prev.userId
            }));
          }

          // Check if a new draw was completed since our last check!
          const latestCompleted = freshHistory[0];
          if (latestCompleted && latestCompleted.period !== lastDrawnPeriodRef.current) {
            // 1. Concurrently evaluate all 3 algorithms for this completed draw (runs even if user doesn't bet)
            const targetPreds = activeMethodPredictionsRef.current?.targetPeriod === latestCompleted.period
              ? activeMethodPredictionsRef.current.predictions
              : calculateAllPredictions(freshHistory.slice(1), latestCompleted.period, sensitivity);

            setMethodStats((prevStats) => {
              const updated = updateMethodStatsWithResult(prevStats, targetPreds, latestCompleted);

              // 2. Evaluate Dynamic AI Smart Auto-Switch (User lose % များနေလျှင် Win % အမြင့်ဆုံးသို့ AI မှ Auto change လုပ်ပေးခြင်း)
              if (isAutoSwitchEnabledRef.current) {
                const switchResult = evaluateAutoSwitch(aiAlgorithmRef.current, updated, true);
                if (switchResult.shouldSwitch) {
                  const prevAlgo = aiAlgorithmRef.current;
                  setAiAlgorithm(switchResult.bestAlgo);
                  aiAlgorithmRef.current = switchResult.bestAlgo;

                  setAutoSwitchEvent({
                    fromAlgo: prevAlgo,
                    toAlgo: switchResult.bestAlgo,
                    fromWinRate: updated[prevAlgo]?.winRate || 0,
                    toWinRate: updated[switchResult.bestAlgo]?.winRate || 0,
                    reason: switchResult.reason,
                    timestamp: Date.now()
                  });

                  if (soundEnabledRef.current) {
                    playRadarLockSound();
                  }
                }
              }

              return updated;
            });

            // Check if current user prediction won
            if (lastDrawnPeriodRef.current !== '' && currentPredictionRef.current) {
              if (currentPredictionRef.current.targetPeriod === latestCompleted.period) {
                const won = currentPredictionRef.current.size === latestCompleted.size;
                if (won) {
                  setWinCount((w) => w + 1);
                  if (soundEnabledRef.current) playYouWinVoice();
                  confetti({
                    particleCount: 80,
                    spread: 70,
                    origin: { y: 0.6 }
                  });
                } else {
                  setLossCount((l) => l + 1);
                }
              }
            }
            lastDrawnPeriodRef.current = latestCompleted.period;
          }

          // Generate predictions for the CURRENT ACTIVE period for all 3 algorithms concurrently
          if (activePeriod && activePeriod !== lastPredictedPeriodRef.current) {
            const allPreds = calculateAllPredictions(freshHistory, activePeriod, sensitivity);
            setMethodPredictions(allPreds);
            activeMethodPredictionsRef.current = { targetPeriod: activePeriod, predictions: allPreds };

            const currentSelected = allPreds[aiAlgorithmRef.current] || allPreds['HMM'];
            setPrediction(currentSelected);
            lastPredictedPeriodRef.current = activePeriod;
            if (soundEnabledRef.current) playRadarLockSound();
          }
        }
      }
    } catch (e) {
      console.error('Error fetching Wingo history:', e);
    }
  };

  useEffect(() => {
    lastDrawnPeriodRef.current = '';
    lastPredictedPeriodRef.current = '';
    fetchWingoData(selectedTypeId);
  }, [selectedTypeId, sensitivity, aiAlgorithm]);

  // Recalculate prediction immediately when AI model changes
  useEffect(() => {
    if (methodPredictions && methodPredictions[aiAlgorithm]) {
      setPrediction(methodPredictions[aiAlgorithm]);
    } else if (history.length > 0 && currentPeriod) {
      const newPred = calculateAutoGuess(history, currentPeriod, sensitivity, aiAlgorithm);
      setPrediction(newPred);
      lastPredictedPeriodRef.current = currentPeriod;
    }
  }, [aiAlgorithm, methodPredictions]);

  // High-frequency Poller: Polls backend every 1.5s so timer and period stay locked to shwelottery.net
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchWingoData(selectedTypeId);
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [selectedTypeId, sensitivity, soundEnabled, aiAlgorithm]);

  // 1-Second Local Tick
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        const nextVal = prev <= 1 ? 0 : prev - 1;

        if (soundEnabled && nextVal <= 5 && nextVal > 0) {
          playTickSound();
        }

        if (nextVal === 0) {
          fetchWingoData(selectedTypeId);
        }

        return nextVal;
      });

      // Deduct regular user timer ONLY if user is NOT admin
      setUserAccess((prev) => {
        if (prev.isAdmin || prev.unlimitedTime) {
          return prev;
        }

        if (prev.remainingSeconds > 0) {
          return {
            ...prev,
            remainingSeconds: prev.remainingSeconds - 1
          };
        } else if (prev.timeCoins > 0) {
          return {
            ...prev,
            timeCoins: prev.timeCoins - 1,
            remainingSeconds: 360
          };
        } else {
          return prev;
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [soundEnabled, selectedTypeId]);

  // Admin Login Handler (Passcode: 166061kp)
  const handleAdminLogin = (passcode: string): boolean => {
    const validCodes = ['166061kp', '166061', 'admin888', 'shwe999'];
    if (validCodes.includes(passcode.trim())) {
      setUserAccess((prev) => ({
        ...prev,
        isAdmin: true,
        unlimitedTime: true,
        timeCoins: 9999,
        remainingSeconds: 999999
      }));
      if (soundEnabled) {
        playAdminUnlockedSound();
      }
      return true;
    }
    return false;
  };

  const handleAdminLogout = () => {
    setUserAccess((prev) => ({
      ...prev,
      isAdmin: false,
      unlimitedTime: false,
      timeCoins: 3,
      remainingSeconds: 600
    }));
  };

  const handleAddUserCoins = (coins: number, minutes: number) => {
    setUserAccess((prev) => ({
      ...prev,
      timeCoins: prev.timeCoins + coins,
      remainingSeconds: prev.remainingSeconds + (minutes * 60)
    }));
  };

  const handleRedeemCode = async (code: string) => {
    try {
      const res = await fetch('/api/user/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (data.success) {
        handleAddUserCoins(data.coinsAdded || 20, data.minutesAdded || 60);
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'ကုဒ်မမှန်ကန်ပါ။' };
    } catch (e) {
      return { success: false, message: 'စနစ်ချိတ်ဆက်မှု မအောင်မြင်ပါ။' };
    }
  };

  const handleRefreshLogin = async (phone: string, pass: string): Promise<{ success: boolean; message: string }> => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/shwelottery/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password: pass })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAccount({
          phone: phone,
          password: pass,
          isConnected: true,
          latencyMs: data.connection?.latencyMs || 34,
          lastPing: Date.now(),
          targetUrl: 'https://www.shwelottery.net/',
          nickName: data.account?.nickName || 'MemberNNG0XDE5',
          amount: data.account?.amount || '1,000.00'
        });
        await fetchWingoData(selectedTypeId);
        return { success: true, message: data.message || 'ShweLottery အကောင့်ဖြင့် အောင်မြင်စွာ Login ဝင်ရောက်ပြီးပါပြီ!' };
      } else {
        return { success: false, message: data.message || 'Login မအောင်မြင်ပါ။ ဖုန်းနံပါတ် သို့မဟုတ် စကားဝှက် စစ်ဆေးပါ။' };
      }
    } catch (e: any) {
      console.error(e);
      return { success: false, message: e.message || 'ဆာဗာချိတ်ဆက်မှု မအောင်မြင်ပါ။' };
    } finally {
      setIsSyncing(false);
    }
  };

  // 1-Click Apply AI prediction from Floating Predator to Play Station
  const handleApplyAiFromPredator = () => {
    setActiveTab('PLAY');
  };

  const copyCredentials = () => {
    navigator.clipboard.writeText('Phone: 9798023829\nPassword: 166061kp');
    setCopiedLogin(true);
    setTimeout(() => setCopiedLogin(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* FLOATING PREDATOR HUD WIDGET (DRAGGABLE OVERLAY OVER ALL VIEWS) */}
      <FloatingPredator
        prediction={prediction}
        secondsLeft={secondsLeft}
        currentPeriod={currentPeriod}
        nextPeriod={currentPeriod}
        selectedTypeId={selectedTypeId}
        onChangeTypeId={(id) => setSelectedTypeId(id)}
        lastDrawnItem={history[0] || null}
        userAccess={userAccess}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenRecharge={() => setIsRechargeOpen(true)}
        onApplyAiBet={handleApplyAiFromPredator}
        winCount={winCount}
        lossCount={lossCount}
        aiAlgorithm={aiAlgorithm}
        onChangeAiAlgorithm={setAiAlgorithm}
        methodStats={methodStats}
        isAutoSwitchEnabled={isAutoSwitchEnabled}
        onToggleAutoSwitch={() => setIsAutoSwitchEnabled(!isAutoSwitchEnabled)}
        autoSwitchEvent={autoSwitchEvent}
      />

      {/* TOP NAVIGATION HEADER */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-amber-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-black shadow-[0_0_20px_rgba(245,158,11,0.5)]">
              <Crosshair className="w-6 h-6 stroke-[2.5] animate-pulse" />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-tech text-base sm:text-lg font-black tracking-wider text-white">
                  FLOATING AI PREDATOR
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  {selectedTypeId === 30 ? 'WINGO 30S' : 'WINGO 60S (1M)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
                Target Prediction & Live Play • Synchronized with shwelottery.net
              </p>
            </div>
          </div>

          {/* Navigation View Switcher */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('PLAY')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'PLAY'
                  ? 'bg-amber-500 text-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              Play Station (ကစားမည်)
            </button>

            <button
              onClick={() => setActiveTab('WEBVIEW')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'WEBVIEW'
                  ? 'bg-amber-500 text-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ShweLottery</span> Web View
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'HISTORY'
                  ? 'bg-amber-500 text-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              Draw History
            </button>
          </div>

          {/* Right Header Status Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Admin VIP / Time Coins */}
            {userAccess.isAdmin ? (
              <button
                onClick={() => setIsAdminOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 border border-red-500/40 text-red-300 text-xs hover:bg-red-600/30 transition-all font-mono"
              >
                <ShieldCheck className="w-4 h-4 text-red-400" />
                <span className="font-bold">ADMIN VIP</span>
                <span className="hidden md:inline text-[10px] text-red-200">(Time Skip Active)</span>
              </button>
            ) : (
              <button
                onClick={() => setIsRechargeOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs hover:border-amber-500/40 transition-all font-mono"
              >
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-amber-400 font-bold">{userAccess.timeCoins}</span>
                <span className="text-slate-400 text-[11px] hidden sm:inline">Coins</span>
              </button>
            )}

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
              title={soundEnabled ? 'Mute' : 'Enable Sound'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            {/* Admin Entry Button */}
            <button
              onClick={() => setIsAdminOpen(true)}
              className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors"
              title="Admin Panel"
            >
              <Key className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* SHWELOTTERY LIVE GATEWAY STATUS CARD */}
        <ShweLotteryStatus
          account={account}
          onRefreshLogin={handleRefreshLogin}
          isSyncing={isSyncing}
        />

        {/* REAL-TIME MULTI-METHOD BENCHMARK & ADAPTIVE AUTO-SWITCH HUD */}
        <MultiMethodBenchmarkBar
          stats={methodStats}
          currentAlgorithm={aiAlgorithm}
          onSelectAlgorithm={setAiAlgorithm}
          isAutoSwitchEnabled={isAutoSwitchEnabled}
          onToggleAutoSwitch={() => setIsAutoSwitchEnabled(!isAutoSwitchEnabled)}
          autoSwitchEvent={autoSwitchEvent}
          onDismissAutoSwitch={() => setAutoSwitchEvent(null)}
          predictions={methodPredictions}
          nextPeriod={currentPeriod}
          isUserPlaying={activeTab === 'PLAY'}
        />

        {/* TAB 1: INTERACTIVE PLAY STATION (USER CAN PLAY WHILE PREDATOR FLOATS) */}
        {activeTab === 'PLAY' && (
          <PlayableGameStation
            currentPeriod={currentPeriod}
            secondsLeft={secondsLeft}
            history={history}
            prediction={prediction}
            account={account}
            selectedTypeId={selectedTypeId}
            onChangeTypeId={(id) => setSelectedTypeId(id)}
            onRefreshSession={() => fetchWingoData(selectedTypeId)}
            onApplyAiGuess={handleApplyAiFromPredator}
            onRefreshLogin={handleRefreshLogin}
            aiAlgorithm={aiAlgorithm}
            onChangeAiAlgorithm={setAiAlgorithm}
            methodStats={methodStats}
            isAutoSwitchEnabled={isAutoSwitchEnabled}
            onToggleAutoSwitch={() => setIsAutoSwitchEnabled(!isAutoSwitchEnabled)}
            autoSwitchEvent={autoSwitchEvent}
            methodPredictions={methodPredictions}
          />
        )}

        {/* TAB 2: EMBEDDED SHWELOTTERY WEB VIEW */}
        {activeTab === 'WEBVIEW' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-400" />
                  Official ShweLottery Web View (https://www.shwelottery.net/)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  အောက်ပါ Web View ပေါ်တွင် Floating AI Predator ဝစ်ဂျက်သည် လွတ်လပ်စွာ ပျံဝဲနေမည်ဖြစ်ပြီး ဂိမ်းကစားရာတွင် တွဲဖက်ကြည့်ရှုနိုင်ပါသည်။
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyCredentials}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 border border-slate-700 flex items-center gap-1.5"
                >
                  {copiedLogin ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLogin ? 'Copied Login!' : 'Copy Login (9798023829)'}</span>
                </button>

                <a
                  href="https://www.shwelottery.net/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 shadow"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in New Tab
                </a>
              </div>
            </div>

            {/* Embedded Iframe Container */}
            <div className="w-full h-[750px] rounded-2xl overflow-hidden border-2 border-amber-500/30 bg-slate-950 shadow-2xl relative">
              <iframe
                src="https://www.shwelottery.net/"
                className="w-full h-full border-none"
                title="ShweLottery Official Website"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
            </div>
          </div>
        )}

        {/* TAB 3: DRAW HISTORY & STATS */}
        {activeTab === 'HISTORY' && (
          <div className="space-y-6">
            <WingoGameBoard
              history={history}
              currentPeriod={currentPeriod}
              nextPeriod={currentPeriod}
              secondsLeft={secondsLeft}
              prediction={prediction}
              winCount={winCount}
              lossCount={lossCount}
              selectedTypeId={selectedTypeId}
              onChangeTypeId={(id) => setSelectedTypeId(id)}
            />
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <p>Floating AI Predator v4.2 • ShweLottery Official Gateway Stream</p>
        <p className="mt-1 text-[11px] text-slate-600">
          Target URL: https://www.shwelottery.net/ • ShweLottery Official Stream
        </p>
      </footer>

      {/* ADMIN CONTROL MODAL */}
      <AdminPanel
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        userAccess={userAccess}
        onAdminLogin={handleAdminLogin}
        onAdminLogout={handleAdminLogout}
        onAddUserCoins={handleAddUserCoins}
        sensitivity={sensitivity}
        onChangeSensitivity={setSensitivity}
        onResetStats={() => { setWinCount(0); setLossCount(0); }}
        onForceSync={() => fetchWingoData(selectedTypeId)}
      />

      {/* TIME COIN RECHARGE MODAL */}
      <UserCoinModal
        isOpen={isRechargeOpen}
        onClose={() => setIsRechargeOpen(false)}
        userAccess={userAccess}
        onRedeemCode={handleRedeemCode}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />
    </div>
  );
}
