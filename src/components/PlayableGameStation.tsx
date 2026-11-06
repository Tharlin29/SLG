import React, { useState, useEffect, useRef } from 'react';
import { 
  Coins, 
  Clock, 
  Sparkles, 
  Check, 
  Flame, 
  Trophy, 
  AlertCircle, 
  Layers, 
  TrendingUp, 
  Zap, 
  User, 
  Key, 
  RefreshCw,
  ExternalLink,
  Globe,
  Sliders,
  DollarSign,
  Play,
  Pause,
  Bot,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Target,
  TrendingDown,
  X,
  Lock,
  Volume2,
  VolumeX,
  Cpu,
  Hourglass,
  Activity
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WingoDraw, PredictionResult, ShweAccount, AlgorithmType, AllMethodsStats, AutoSwitchEvent, AutoMonitoringState } from '../types/lottery';
import { playWinSound, playYouWinVoice, playTickSound, playMyanmarTargetProfitVoice } from '../utils/audio';

interface PlayableGameStationProps {
  currentPeriod: string;
  secondsLeft: number;
  history: WingoDraw[];
  prediction: PredictionResult | null;
  account: ShweAccount;
  selectedTypeId: number;
  onChangeTypeId: (id: number) => void;
  onRefreshSession: () => void;
  onApplyAiGuess?: () => void;
  onRefreshLogin?: (phone: string, pass: string) => Promise<{ success: boolean; message: string }>;
  aiAlgorithm?: AlgorithmType;
  onChangeAiAlgorithm?: (algo: AlgorithmType) => void;
  methodStats?: AllMethodsStats;
  isAutoSwitchEnabled?: boolean;
  onToggleAutoSwitch?: () => void;
  autoSwitchEvent?: AutoSwitchEvent | null;
  methodPredictions?: Record<AlgorithmType, PredictionResult> | null;
  onAutoMonitoringChange?: (state: AutoMonitoringState) => void;
}

export interface ActiveBet {
  id: string;
  period: string;
  type: 'SIZE' | 'COLOR' | 'NUMBER';
  selection: string | number;
  amount: number;
  multiplier: number;
  total: number;
  status: 'PENDING' | 'WON' | 'LOST';
  payout?: number;
  isAuto?: boolean;
}

// ShweLottery denomination normalizer: decomposes any total stake into valid base scope (10|100|1000|10000) and multiplier betCount
export function normalizeShweBetAmount(rawAmount: number, rawBetCount: number = 1): { amount: number; betCount: number; total: number } {
  const total = Math.max(10, Math.round((Number(rawAmount) || 10) * (Number(rawBetCount) || 1)));
  if (total >= 10000 && total % 10000 === 0) {
    return { amount: 10000, betCount: Math.max(1, Math.floor(total / 10000)), total };
  } else if (total >= 1000 && total % 1000 === 0) {
    return { amount: 1000, betCount: Math.max(1, Math.floor(total / 1000)), total };
  } else if (total >= 100 && total % 100 === 0) {
    return { amount: 100, betCount: Math.max(1, Math.floor(total / 100)), total };
  } else {
    const count = Math.max(1, Math.round(total / 10));
    return { amount: 10, betCount: count, total: count * 10 };
  }
}

// Calculate consecutive streak of the most recent completed draws (for Wait Bot)
export function getConsecutiveStreak(draws: WingoDraw[]): {
  count: number;
  size: 'BIG' | 'SMALL' | null;
  opposite: 'BIG' | 'SMALL' | null;
} {
  if (!draws || draws.length === 0) {
    return { count: 0, size: null, opposite: null };
  }
  const firstSize = draws[0].size;
  if (firstSize !== 'BIG' && firstSize !== 'SMALL') {
    return { count: 0, size: null, opposite: null };
  }
  let count = 0;
  for (const draw of draws) {
    if (draw.size === firstSize) {
      count++;
    } else {
      break;
    }
  }
  const opposite: 'BIG' | 'SMALL' = firstSize === 'BIG' ? 'SMALL' : 'BIG';
  return { count, size: firstSize, opposite };
}

export const PlayableGameStation: React.FC<PlayableGameStationProps> = ({
  currentPeriod,
  secondsLeft,
  history,
  prediction,
  account,
  selectedTypeId,
  onChangeTypeId,
  onRefreshSession,
  onRefreshLogin,
  aiAlgorithm = 'HMM',
  onChangeAiAlgorithm,
  methodStats,
  isAutoSwitchEnabled = true,
  onToggleAutoSwitch,
  autoSwitchEvent,
  methodPredictions,
}) => {
  // Selected Bet State
  const [selectedBetType, setSelectedBetType] = useState<'SIZE' | 'COLOR' | 'NUMBER'>('SIZE');
  const [selectedChoice, setSelectedChoice] = useState<string | number>('BIG');
  const [baseAmount, setBaseAmount] = useState<number>(100);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [activeBets, setActiveBets] = useState<ActiveBet[]>([]);
  const [betFeedback, setBetFeedback] = useState<string | null>(null);

  // User Balance (synchronized with ShweLottery account)
  const initialBalance = parseFloat(account.amount?.replace(/,/g, '') || '1000') || 1000;
  const [userBalance, setUserBalance] = useState<number>(initialBalance);

  // Keep balance in sync when account changes
  useEffect(() => {
    if (account.amount) {
      const parsed = parseFloat(account.amount.replace(/,/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        setUserBalance(parsed);
      }
    }
  }, [account.amount]);

  // Fetch real live balance directly from ShweLottery API Gateway
  const fetchRealLiveBalance = async () => {
    try {
      const res = await fetch('/api/shwelottery/balance');
      if (res.ok) {
        const data = await res.json();
        if (typeof data.realBalance === 'number') {
          setUserBalance(data.realBalance);
        }
      }
    } catch (err) {
      console.error('Real balance sync error:', err);
    }
  };

  // Poll real balance from official website every 3 seconds
  useEffect(() => {
    fetchRealLiveBalance();
    const balInterval = setInterval(() => {
      fetchRealLiveBalance();
    }, 3000);
    return () => clearInterval(balInterval);
  }, []);

  // Total Bet Cost for manual bet
  const totalBetAmount = baseAmount * multiplier;

  // ==========================================
  // AUTO BET STATE & MARTINGALE PROGRESSION
  // ==========================================
  const [isAutoBetActive, setIsAutoBetActive] = useState<boolean>(false);
  const [autoMultiplierMode, setAutoMultiplierMode] = useState<number>(2); // 2X, 3X, or custom
  const [isCustomMultiplier, setIsCustomMultiplier] = useState<boolean>(false);
  const [customMultiplierInput, setCustomMultiplierInput] = useState<string>('2.5');

  const [autoBaseAmount, setAutoBaseAmount] = useState<number>(10);
  const [isCustomBaseAmount, setIsCustomBaseAmount] = useState<boolean>(false);
  const [customBaseAmountInput, setCustomBaseAmountInput] = useState<string>('10');

  const [consecutiveLosses, setConsecutiveLosses] = useState<number>(0);
  const [currentAutoStake, setCurrentAutoStake] = useState<number>(10);
  const [autoStrategy, setAutoStrategy] = useState<'AI_GUESS' | 'MANUAL_CHOICE' | 'WAIT_BOT'>('AI_GUESS');
  const [autoWins, setAutoWins] = useState<number>(0);
  const [autoLosses, setAutoLosses] = useState<number>(0);
  const [autoProfit, setAutoProfit] = useState<number>(0);
  const [autoFeedback, setAutoFeedback] = useState<string | null>(null);

  // Wait Bot Configuration & State (Streak Hunter / Dragon Cutter Method)
  const [waitStreakThreshold, setWaitStreakThreshold] = useState<number>(5);
  const [customStreakInput, setCustomStreakInput] = useState<string>('5');
  const [isCustomStreak, setIsCustomStreak] = useState<boolean>(false);
  const [waitBotStatus, setWaitBotStatus] = useState<'WAITING' | 'BETTING'>('WAITING');
  const [waitBotTarget, setWaitBotTarget] = useState<'BIG' | 'SMALL' | null>(null);

  // Win Stop (Take Profit) & Lose Stop (Stop Loss) Configuration
  const [winStopEnabled, setWinStopEnabled] = useState<boolean>(true);
  const [winStopAmount, setWinStopAmount] = useState<number>(1000);
  const [winStopInput, setWinStopInput] = useState<string>('1000');

  const [loseStopEnabled, setLoseStopEnabled] = useState<boolean>(true);
  const [loseStopAmount, setLoseStopAmount] = useState<number>(1000);
  const [loseStopInput, setLoseStopInput] = useState<string>('1000');

  const [stopReason, setStopReason] = useState<'WIN_STOP' | 'LOSE_STOP' | 'INSUFFICIENT_BALANCE' | null>(null);

  // Synchronous refs for draw evaluation listener
  const winStopEnabledRef = useRef(winStopEnabled);
  const winStopAmountRef = useRef(winStopAmount);
  const loseStopEnabledRef = useRef(loseStopEnabled);
  const loseStopAmountRef = useRef(loseStopAmount);
  const autoBaseAmountRef = useRef(autoBaseAmount);
  const autoMultiplierModeRef = useRef(autoMultiplierMode);
  const consecutiveLossesRef = useRef<number>(consecutiveLosses);
  const autoStrategyRef = useRef(autoStrategy);
  const waitStreakThresholdRef = useRef(waitStreakThreshold);
  const waitBotStatusRef = useRef(waitBotStatus);
  const waitBotTargetRef = useRef(waitBotTarget);

  useEffect(() => {
    winStopEnabledRef.current = winStopEnabled;
    winStopAmountRef.current = winStopAmount;
    loseStopEnabledRef.current = loseStopEnabled;
    loseStopAmountRef.current = loseStopAmount;
    autoBaseAmountRef.current = autoBaseAmount;
    autoMultiplierModeRef.current = autoMultiplierMode;
    consecutiveLossesRef.current = consecutiveLosses;
    autoStrategyRef.current = autoStrategy;
    waitStreakThresholdRef.current = waitStreakThreshold;
    waitBotStatusRef.current = waitBotStatus;
    waitBotTargetRef.current = waitBotTarget;
  }, [winStopEnabled, winStopAmount, loseStopEnabled, loseStopAmount, autoBaseAmount, autoMultiplierMode, consecutiveLosses, autoStrategy, waitStreakThreshold, waitBotStatus, waitBotTarget]);

  // Refs for auto-bet execution tracking
  const lastAutoBetPeriodRef = useRef<string>('');
  const prevHistoryPeriodRef = useRef<string>('');

  // Update current auto stake when base amount or multiplier mode changes while 0 losses
  useEffect(() => {
    if (consecutiveLosses === 0) {
      setCurrentAutoStake(autoBaseAmount);
    } else {
      const nextStake = Math.round(autoBaseAmount * Math.pow(autoMultiplierMode, consecutiveLosses));
      setCurrentAutoStake(nextStake);
    }
  }, [autoBaseAmount, autoMultiplierMode, consecutiveLosses]);

  // Reset Session Statistics
  const handleResetAutoSession = () => {
    setAutoWins(0);
    setAutoLosses(0);
    setAutoProfit(0);
    consecutiveLossesRef.current = 0;
    setConsecutiveLosses(0);
    setCurrentAutoStake(autoBaseAmount);
    setStopReason(null);
    setWaitBotStatus('WAITING');
    waitBotStatusRef.current = 'WAITING';
    setWaitBotTarget(null);
    waitBotTargetRef.current = null;
    setAutoFeedback('Auto Bet စာရင်းများကို အသစ်ပြန်လည်စတင်လိုက်ပါပြီ။');
  };

  // Restart Auto Bot directly after Lose Stop / Win Stop or manual stop
  const handleRestartAutoBot = () => {
    // Reset cycle profit and loss progression so the new auto betting cycle starts fresh
    setAutoProfit(0);
    consecutiveLossesRef.current = 0;
    setConsecutiveLosses(0);
    setCurrentAutoStake(autoBaseAmount);
    setStopReason(null);
    setWaitBotStatus('WAITING');
    waitBotStatusRef.current = 'WAITING';
    setWaitBotTarget(null);
    waitBotTargetRef.current = null;
    setIsAutoBetActive(true);
    if (autoStrategyRef.current === 'WAIT_BOT') {
      const streak = getConsecutiveStreak(history);
      setAutoFeedback(`🔄 Wait Bot ကို အသစ်ပြန်လည်စတင်လိုက်ပါပြီ! ကြီး သို့မဟုတ် ငယ် ဆက်တိုက် ${waitStreakThresholdRef.current} ကြိမ် (လက်ရှိ: ${streak.size === 'BIG' ? 'ကြီး' : streak.size === 'SMALL' ? 'ငယ်' : 'မရှိ'} ${streak.count} ကြိမ်) ပြည့်သည်အထိ စောင့်ဆိုင်းပြီး ဆန့်ကျင်ဘက်ကို win ဖြစ်သည်အထိ စတင်လောင်းပါမည်။`);
    } else {
      setAutoFeedback(`🔄 Auto Bot ကို အသစ်ပြန်လည်စတင်လိုက်ပါပြီ! စတင်လောင်းကြေး K ${autoBaseAmount.toLocaleString()} MMK (${autoMultiplierMode}× ဆတိုး) ဖြင့် ပြန်လည်စတင်လောင်းပါမည်။`);
    }
  };

  // ==========================================
  // LOGIN CHANGE MODAL STATE
  // ==========================================
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [inputPhone, setInputPhone] = useState<string>(account.phone || '9798023829');
  const [inputPassword, setInputPassword] = useState<string>(account.password || '166061kp');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginFeedback, setLoginFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Handle Account Change & Login
  const handleAccountLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRefreshLogin) return;

    setIsLoggingIn(true);
    setLoginFeedback(null);
    try {
      const result = await onRefreshLogin(inputPhone.trim(), inputPassword.trim());
      setLoginFeedback(result);
      if (result.success) {
        await fetchRealLiveBalance();
        setTimeout(() => {
          setIsLoginModalOpen(false);
          setLoginFeedback(null);
        }, 1500);
      }
    } catch (err: any) {
      setLoginFeedback({ success: false, message: err.message || 'Login error' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Quick reset to default account
  const handleSetDefaultAccount = () => {
    setInputPhone('9798023829');
    setInputPassword('166061kp');
  };

  // ==========================================
  // AUTO BET AUTOMATIC REAL EXECUTION CYCLE
  // ==========================================
  useEffect(() => {
    if (!isAutoBetActive) return;

    // Check if Win Stop or Lose Stop threshold is reached prior to placing bet
    if (winStopEnabled && winStopAmount > 0 && autoProfit >= winStopAmount) {
      setIsAutoBetActive(false);
      setStopReason('WIN_STOP');
      setAutoFeedback(`🏆 [Win Stop အောင်မြင်ပါပြီ!] သတ်မှတ်ထားသော အနိုင်ငွေ (+K ${autoProfit.toLocaleString()} MMK / Target: K ${winStopAmount.toLocaleString()}) ပြည့်မီသဖြင့် Auto Bet ကို ရပ်တန့်လိုက်ပါပြီ!`);
      return;
    }

    if (loseStopEnabled && loseStopAmount > 0 && autoProfit <= -loseStopAmount) {
      setIsAutoBetActive(false);
      setStopReason('LOSE_STOP');
      setAutoFeedback(`🛑 [Lose Stop သတ်မှတ်ချက်!] သတ်မှတ်ထားသော အရှုံးငွေ (-K ${Math.abs(autoProfit).toLocaleString()} MMK / Limit: K ${loseStopAmount.toLocaleString()}) သို့ ရောက်ရှိသဖြင့် Auto Bet ကို ရပ်တန့်လိုက်ပါပြီ!`);
      return;
    }

    // Betting window: between 7s and 58s, and not already bet for this period
    if (secondsLeft > 6 && currentPeriod && currentPeriod !== lastAutoBetPeriodRef.current) {
      // Check if there is an unresolved previous pending bet from an earlier period;
      // Wait for it to settle so we know whether to multiply or reset!
      const hasUnsettledPreviousAutoBet = activeBets.some(
        (b) => b.isAuto && b.status === 'PENDING' && b.period !== currentPeriod
      );
      if (hasUnsettledPreviousAutoBet && secondsLeft > 10) {
        return;
      }

      // Calculate current required stake based on synchronous consecutive losses
      const currentLosses = consecutiveLossesRef.current;
      const requiredStake = currentLosses === 0
        ? autoBaseAmountRef.current
        : Math.round(autoBaseAmountRef.current * Math.pow(autoMultiplierModeRef.current, currentLosses));

      // Check balance
      if (userBalance < requiredStake) {
        setIsAutoBetActive(false);
        setStopReason('INSUFFICIENT_BALANCE');
        setAutoFeedback(`လက်ကျန်ငွေ မလုံလောက်တော့ပါ (လက်ကျန်: K ${userBalance.toLocaleString()} MMK၊ လိုအပ်ချက်: K ${requiredStake.toLocaleString()} MMK)။ Auto Bet ရပ်တန့်ပါပြီ။`);
        return;
      }

      // Determine choice
      let betType: 'SIZE' | 'COLOR' | 'NUMBER' = 'SIZE';
      let betChoice: string | number = prediction?.size || 'BIG';

      if (autoStrategy === 'AI_GUESS') {
        betType = 'SIZE';
        betChoice = prediction?.size || 'BIG';
      } else if (autoStrategy === 'MANUAL_CHOICE') {
        betType = selectedBetType;
        betChoice = selectedChoice;
      } else if (autoStrategy === 'WAIT_BOT') {
        betType = 'SIZE';
        const streak = getConsecutiveStreak(history);

        // If currently in WAITING status, check if streak has reached threshold
        if (waitBotStatusRef.current === 'WAITING') {
          if (streak.count >= waitStreakThresholdRef.current && streak.opposite) {
            // Streak threshold reached! Switch to BETTING status and target the opposite outcome!
            const target = streak.opposite;
            setWaitBotStatus('BETTING');
            waitBotStatusRef.current = 'BETTING';
            setWaitBotTarget(target);
            waitBotTargetRef.current = target;
            betChoice = target;
            setAutoFeedback(`🔥 [Wait Bot စတင်လောင်းပါပြီ!] ${streak.size === 'BIG' ? 'ကြီး (BIG)' : 'ငယ် (SMALL)'} ${streak.count} ကြိမ် ဆက်တိုက်ထွက်ပြီးဖြစ်၍ ဆန့်ကျင်ဘက် [${target === 'BIG' ? 'ကြီး (BIG)' : 'ငယ် (SMALL)'}] ကို win ဖြစ်သည်အထိ စတင်လောင်းပါမည်!`);
          } else {
            // Streak threshold not reached yet -> DO NOT BET, KEEP WAITING!
            setAutoFeedback(`⏳ [Wait Bot စောင့်ဆိုင်းနေသည်] လက်ရှိ streak: ${streak.size === 'BIG' ? 'ကြီး (BIG)' : streak.size === 'SMALL' ? 'ငယ် (SMALL)' : 'မရှိ'} (${streak.count}/${waitStreakThresholdRef.current} ကြိမ်) • ${waitStreakThresholdRef.current} ကြိမ် ပြည့်လျှင် ဆန့်ကျင်ဘက် [${streak.opposite === 'BIG' ? 'ကြီး' : streak.opposite === 'SMALL' ? 'ငယ်' : 'ဆန့်ကျင်ဘက်'}] ကို win ဖြစ်သည်အထိ စတင်လောင်းပါမည်။`);
            return; // Skip betting for this draw
          }
        } else {
          // Already in BETTING status (chasing opposite outcome until win)
          betChoice = waitBotTargetRef.current || streak.opposite || 'BIG';
        }
      }

      // Mark this period as placed
      lastAutoBetPeriodRef.current = currentPeriod;

      // Normalize stake into valid ShweLottery scope (10|100|1000|10000) and multiplier betCount
      const normalized = normalizeShweBetAmount(requiredStake, 1);
      const effectiveStake = normalized.total;

      // Deduct balance locally for responsive station state
      setUserBalance((prev) => Math.max(0, prev - effectiveStake));

      // Register auto bet in active bets
      const newAutoBet: ActiveBet = {
        id: `AUTO-${Date.now().toString().slice(-6)}`,
        period: currentPeriod,
        type: betType,
        selection: betChoice,
        amount: normalized.amount,
        multiplier: normalized.betCount,
        total: effectiveStake,
        status: 'PENDING',
        isAuto: true,
      };

      setActiveBets((prev) => [newAutoBet, ...prev.slice(0, 19)]);
      setAutoFeedback(`⚡ [Auto Bet #${currentPeriod.slice(-5)}] ShweLottery game website သို့ K ${effectiveStake.toLocaleString()} MMK (${normalized.amount} × ${normalized.betCount}) [${currentLosses > 0 ? `${autoMultiplierModeRef.current}× အဆင့် ${currentLosses + 1}` : 'မူလစတင်ငွေ'}] လောင်းနေပါသည်...`);
      playTickSound();

      // EXECUTE REAL BET ON SHWELOTTERY OFFICIAL SERVER
      fetch('/api/shwelottery/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeId: selectedTypeId,
          issueNumber: currentPeriod,
          type: betType,
          selection: betChoice,
          amount: normalized.amount,
          multiplier: normalized.betCount
        })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && typeof data.realBalance === 'number') {
            setUserBalance(data.realBalance);
          }
          if (data.success) {
            setAutoFeedback(`✅ [Auto Bet #${currentPeriod.slice(-5)}] ShweLottery official website တွင် K ${effectiveStake.toLocaleString()} MMK [${betChoice === 'BIG' ? 'ကြီး (BIG)' : betChoice === 'SMALL' ? 'ငယ် (SMALL)' : betChoice}] အမှန်တကယ် လောင်းပြီးပါပြီ! (လက်ကျန်ငွေ: K ${data.realBalance?.toLocaleString()} MMK)`);
          } else {
            if (data.msgCode === 1003 || data.msg?.includes('recharge')) {
              setAutoFeedback(`⚡ [Auto Bet #${currentPeriod.slice(-5)}] Station Mode ဖြင့် K ${effectiveStake.toLocaleString()} MMK [${betChoice === 'BIG' ? 'ကြီး' : 'ငယ်'}] လောင်းပြီးပါပြီ (ဝဘ်ဆိုက်အကောင့်တွင် recharge လိုအပ်ပါသည်)`);
            } else {
              setAutoFeedback(`⚡ [Auto Bet #${currentPeriod.slice(-5)}] Website: ${data.msg || 'ဂိမ်းဝဘ်ဆိုက်မှ အတည်ပြုချက်'}`);
            }
          }
        })
        .catch((err) => {
          console.error('Auto bet network error:', err);
        });
    }
  }, [isAutoBetActive, secondsLeft, currentPeriod, autoBaseAmount, autoMultiplierMode, consecutiveLosses, userBalance, autoStrategy, prediction, selectedBetType, selectedChoice, selectedTypeId, winStopEnabled, winStopAmount, loseStopEnabled, loseStopAmount, autoProfit, activeBets, history, waitStreakThreshold, waitBotStatus, waitBotTarget]);

  // ==========================================
  // DRAW EVALUATION ENGINE & REAL BALANCE RE-SYNC
  // ==========================================
  useEffect(() => {
    const latestDraw = history[0];
    if (latestDraw && latestDraw.period !== prevHistoryPeriodRef.current) {
      if (prevHistoryPeriodRef.current !== '') {
        // Re-sync true live balance from the official website after round settlement
        fetchRealLiveBalance();

        // Evaluate active pending bets for this completed period
        setActiveBets((prev) =>
          prev.map((bet) => {
            if (bet.period === latestDraw.period && bet.status === 'PENDING') {
              let won = false;
              let payoutRate = 1.98;

              if (bet.type === 'SIZE') {
                won = bet.selection === latestDraw.size;
                payoutRate = 1.98;
              } else if (bet.type === 'COLOR') {
                if (bet.selection === 'RED') {
                  won = latestDraw.color === 'RED' || latestDraw.color === 'RED_VIOLET';
                  payoutRate = 1.98;
                } else if (bet.selection === 'GREEN') {
                  won = latestDraw.color === 'GREEN' || latestDraw.color === 'GREEN_VIOLET';
                  payoutRate = 1.98;
                } else if (bet.selection === 'VIOLET') {
                  won = latestDraw.color === 'RED_VIOLET' || latestDraw.color === 'GREEN_VIOLET' || latestDraw.number === 0 || latestDraw.number === 5;
                  payoutRate = 4.5;
                }
              } else if (bet.type === 'NUMBER') {
                won = Number(bet.selection) === latestDraw.number;
                payoutRate = 9.0;
              }

              if (won) {
                const payout = Math.round(bet.total * payoutRate);
                playYouWinVoice();
                setUserBalance((prev) => prev + payout);

                // Auto Bet Win Handler: Reset to base amount and check Win Stop!
                if (bet.isAuto) {
                  consecutiveLossesRef.current = 0;
                  setConsecutiveLosses(0);
                  const resetStake = autoBaseAmountRef.current;
                  setCurrentAutoStake(resetStake);
                  setAutoWins((w) => w + 1);
                  const netGain = payout - bet.total;

                  // If using WAIT_BOT, we won the chase! Reset back to WAITING mode!
                  if (autoStrategyRef.current === 'WAIT_BOT') {
                    setWaitBotStatus('WAITING');
                    waitBotStatusRef.current = 'WAITING';
                    setWaitBotTarget(null);
                    waitBotTargetRef.current = null;
                  }

                  setAutoProfit((prevProfit) => {
                    const newProfit = prevProfit + netGain;

                    // WIN STOP TARGET REACHED CHECK
                    if (winStopEnabledRef.current && winStopAmountRef.current > 0 && newProfit >= winStopAmountRef.current) {
                      setIsAutoBetActive(false);
                      setStopReason('WIN_STOP');
                      // User requirement: User Target profit ကိုရရှိသည့်အခါ "ဂုဏ်ယူပါတယ် မင်းသတ်မှတ်ထားသောအမြတ်ငွေကိုရရှိပါပြီ" လို့မြန်မာ အသံပီသစွာ ပြောစေပါ
                      playMyanmarTargetProfitVoice();
                      setAutoFeedback(`🏆 [TARGET PROFIT ပြည့်မီပါပြီ!] သတ်မှတ်ထားသော အနိုင်ငွေ (+K ${newProfit.toLocaleString()} MMK / ပစ်မှတ်: K ${winStopAmountRef.current.toLocaleString()}) ပြည့်မီသဖြင့် Auto Bet ကို အောင်မြင်စွာ ရပ်တန့်လိုက်ပါပြီ! "ဂုဏ်ယူပါတယ် မင်းသတ်မှတ်ထားသောအမြတ်ငွေကိုရရှိပါပြီ"`);
                      confetti({
                        particleCount: 120,
                        spread: 90,
                        origin: { y: 0.5 }
                      });
                    } else {
                      if (autoStrategyRef.current === 'WAIT_BOT') {
                        setAutoFeedback(`🎉 [Wait Bot Win!] ဆန့်ကျင်ဘက် [${bet.selection === 'BIG' ? 'ကြီး (BIG)' : 'ငယ် (SMALL)'}] နိုင်ပါသဖြင့် (+K ${netGain.toLocaleString()} MMK) "You Win!" အသံဖွင့်ပြီး မူလစတင်ငွေ K ${resetStake.toLocaleString()} MMK သို့ ပြန်သတ်မှတ်ကာ streak ${waitStreakThresholdRef.current} ကြိမ် ပြန်လည်စောင့်ဆိုင်းပါမည်!`);
                      } else {
                        setAutoFeedback(`🎉 [Auto Bet #${latestDraw.period.slice(-5)}] နိုင်ပါသဖြင့် (+K ${netGain.toLocaleString()} MMK) "You Win!" အသံဖွင့်ပြီး မူလစတင်ငွေ K ${resetStake.toLocaleString()} MMK သို့ ချက်ချင်း ပြန်လည်သတ်မှတ်ပြီးပါပြီ!`);
                      }
                      confetti({
                        particleCount: 80,
                        spread: 70,
                        origin: { y: 0.6 }
                      });
                    }

                    return newProfit;
                  });
                }

                return { ...bet, status: 'WON', payout };
              } else {
                // Auto Bet Loss Handler: Multiply next stake by 2X, 3X, or custom and check Lose Stop!
                if (bet.isAuto) {
                  setAutoLosses((l) => l + 1);
                  const lossAmount = bet.total;

                  setAutoProfit((prevProfit) => {
                    const newProfit = prevProfit - lossAmount;

                    // LOSE STOP LIMIT REACHED CHECK
                    if (loseStopEnabledRef.current && loseStopAmountRef.current > 0 && newProfit <= -loseStopAmountRef.current) {
                      setIsAutoBetActive(false);
                      setStopReason('LOSE_STOP');
                      setAutoFeedback(`🛑 [LOSE STOP သတ်မှတ်ချက်!] သတ်မှတ်ထားသော အရှုံးငွေ (-K ${Math.abs(newProfit).toLocaleString()} MMK / Limit: K ${loseStopAmountRef.current.toLocaleString()}) သို့ ရောက်ရှိသဖြင့် အရှုံးကာကွယ်ရန် Auto Bet ကို အလိုအလျောက် ရပ်တန့်လိုက်ပါပြီ!`);
                    } else {
                      const nextLosses = consecutiveLossesRef.current + 1;
                      consecutiveLossesRef.current = nextLosses;
                      setConsecutiveLosses(nextLosses);
                      const mult = autoMultiplierModeRef.current;
                      const nextStake = Math.round(autoBaseAmountRef.current * Math.pow(mult, nextLosses));
                      setCurrentAutoStake(nextStake);
                      if (autoStrategyRef.current === 'WAIT_BOT') {
                        setAutoFeedback(`⚠️ [Wait Bot #${latestDraw.period.slice(-5)}] ဆန့်ကျင်ဘက် [${bet.selection === 'BIG' ? 'ကြီး' : 'ငယ်'}] မထွက်သေးသဖြင့် ${mult}× ဆတိုးပြီး နောက်ပွဲအတွက် K ${nextStake.toLocaleString()} MMK ဖြင့် win ဖြစ်သည်အထိ ဆက်လက်လောင်းပါမည်! (အဆင့်: ${nextLosses + 1})`);
                      } else {
                        setAutoFeedback(`⚠️ [Auto Bet #${latestDraw.period.slice(-5)}] ရှုံးသဖြင့် ${mult}× ဆတိုးပြီး နောက်ပွဲအတွက် K ${nextStake.toLocaleString()} MMK ချက်ချင်း သတ်မှတ်လိုက်ပါပြီ! (အဆင့်: ${nextLosses + 1})`);
                      }
                    }

                    return newProfit;
                  });
                }

                return { ...bet, status: 'LOST', payout: 0 };
              }
            }
            return bet;
          })
        );
      }
      prevHistoryPeriodRef.current = latestDraw.period;
    }
  }, [history]);

  // ==========================================
  // REAL MANUAL BET EXECUTION (SHWELOTTERY API)
  // ==========================================
  const handlePlaceBet = async () => {
    const normalized = normalizeShweBetAmount(baseAmount, multiplier);
    const effectiveTotal = normalized.total;

    if (userBalance < effectiveTotal) {
      setBetFeedback('လက်ကျန်ငွေ မလုံလောက်ပါ။ ကျေးဇူးပြု၍ လောင်းကြေးပမာဏ လျှော့ချပါ။');
      setTimeout(() => setBetFeedback(null), 3500);
      return;
    }

    if (secondsLeft <= 5) {
      setBetFeedback('အချိန် ၅ စက္ကန့်သာ ကျန်တော့သဖြင့် လောင်းကြေးပိတ်ထားပါသည်။ နောက်တစ်ပွဲ စောင့်ပါ။');
      setTimeout(() => setBetFeedback(null), 3500);
      return;
    }

    setBetFeedback(`ShweLottery game website သို့ K ${effectiveTotal.toLocaleString()} MMK (${normalized.amount} × ${normalized.betCount}) လောင်းနေပါသည်...`);
    setUserBalance((prev) => Math.max(0, prev - effectiveTotal));

    const newBet: ActiveBet = {
      id: `BET-${Date.now().toString().slice(-6)}`,
      period: currentPeriod,
      type: selectedBetType,
      selection: selectedChoice,
      amount: normalized.amount,
      multiplier: normalized.betCount,
      total: effectiveTotal,
      status: 'PENDING',
      isAuto: false
    };

    setActiveBets((prev) => [newBet, ...prev.slice(0, 19)]);

    try {
      const res = await fetch('/api/shwelottery/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeId: selectedTypeId,
          issueNumber: currentPeriod,
          type: selectedBetType,
          selection: selectedChoice,
          amount: normalized.amount,
          multiplier: normalized.betCount
        })
      });

      const data = await res.json();
      if (data.success && typeof data.realBalance === 'number') {
        setUserBalance(data.realBalance);
      }

      if (data.success) {
        setBetFeedback(`✅ ShweLottery game website တွင် ပွဲစဉ် #${currentPeriod.slice(-5)} အတွက် K ${effectiveTotal.toLocaleString()} MMK တပြိုင်နက်တည်း အောင်မြင်စွာ လောင်းပြီးပါပြီ! (လက်ကျန်ငွေ: K ${data.realBalance?.toLocaleString()} MMK)`);
      } else {
        if (data.msgCode === 1003 || data.msg?.includes('recharge')) {
          setBetFeedback(`⚡ Station Mode: ပွဲစဉ် #${currentPeriod.slice(-5)} အတွက် K ${effectiveTotal.toLocaleString()} MMK လောင်းပြီးပါပြီ (ဝဘ်ဆိုက်အကောင့်တွင် recharge လိုအပ်ပါသည်)`);
        } else {
          setBetFeedback(`⚡ ShweLottery Website: ${data.msg || 'လောင်းကြေးလက်ခံပြီးပါပြီ'}`);
        }
      }
    } catch (err: any) {
      setBetFeedback(`လောင်းကြေးချိတ်ဆက်မှု မအောင်မြင်ပါ: ${err.message}`);
    }

    setTimeout(() => setBetFeedback(null), 5000);
  };

  // 1-Click Apply AI Guess
  const handleApplyAiPrediction = () => {
    if (!prediction) return;
    setSelectedBetType('SIZE');
    setSelectedChoice(prediction.size);
    setBetFeedback(`AI Guess [${prediction.sizeBurmese} • ${prediction.colorBurmese}] ကို လောင်းကြေးခလုတ်တွင် ရွေးချယ်ပြီးပါပြီ!`);
    setTimeout(() => setBetFeedback(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* ========================================== */}
      {/* TOP USER PROFILE & LOGIN CHANGE BUTTON      */}
      {/* ========================================== */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* User Account Info */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-black font-black text-lg shadow-lg">
            <User className="w-6 h-6 text-black stroke-[2.5]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">
                {account.nickName || 'MemberNNG0XDE5'}
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ONLINE
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
              <span>Ph: <strong className="text-white">{account.phone}</strong></span>
              <span>•</span>
              <span className="text-amber-400 font-bold">
                Balance: K {userBalance.toLocaleString()} MMK
              </span>
              <button
                onClick={() => {
                  setUserBalance((b) => b + 10000);
                  setBetFeedback('+10,000 MMK Station Balance ဖြည့်သွင်းပြီးပါပြီ!');
                  setTimeout(() => setBetFeedback(null), 2500);
                }}
                className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-[10px] text-amber-300 font-bold border border-amber-500/40 transition-colors cursor-pointer"
                title="Station Balance ပြန်လည်ဖြည့်သွင်းရန်"
              >
                +10,000 MMK
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons: Change Account Login & Game Mode */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* CHANGE LOGIN BUTTON */}
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>အကောင့်ပြောင်းရန် / Login</span>
          </button>

          {/* Game Mode Selector */}
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onChangeTypeId(1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                selectedTypeId === 1
                  ? 'bg-amber-500 text-black shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Win Go 60s
            </button>
            <button
              onClick={() => onChangeTypeId(30)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                selectedTypeId === 30
                  ? 'bg-amber-500 text-black shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Win Go 30s
            </button>
          </div>

          <button
            onClick={onRefreshSession}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh Account Balance"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* MAIN PLAY STATION CONSOLE                  */}
      {/* ========================================== */}
      <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 shadow-2xl p-5 md:p-6 space-y-6 relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* ACTIVE PERIOD & COUNTDOWN BANNER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div>
            <span className="text-xs uppercase font-mono text-slate-400 font-bold tracking-wider block">
              TARGET BETTING PERIOD (လောင်းကြေးဖွင့်လှစ်သည့် ပွဲစဉ်)
            </span>
            <div className="text-xl sm:text-2xl font-mono font-black text-amber-400 flex items-center gap-2 mt-0.5">
              <span>#{currentPeriod || 'Loading...'}</span>
              <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded font-tech">
                {selectedTypeId === 30 ? '30 SEC' : '60 SEC'}
              </span>
            </div>
          </div>

          {/* Large Countdown Clock */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">REMAINING TIME</span>
              <span className="text-xs text-slate-300">
                {secondsLeft <= 5 ? 'လောင်းကြေးပိတ်ပါပြီ' : 'လောင်းကြေးဖွင့်ထားပါသည်'}
              </span>
            </div>

            <div className={`flex items-center justify-center min-w-[110px] px-5 py-2.5 rounded-xl border ${
              secondsLeft <= 5
                ? 'bg-red-950/90 border-red-500 text-red-400 animate-pulse'
                : 'bg-slate-950 border-amber-500/50 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
            }`}>
              <Clock className="w-5 h-5 mr-2" />
              <span className="text-3xl font-tech font-black tracking-widest">
                {String(secondsLeft).padStart(2, '0')}s
              </span>
            </div>
          </div>
        </div>

        {/* AI AUTO-GUESS SYNC STRIP (1-CLICK FOLLOW PREDICTION) */}
        {prediction && (
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/30 border border-amber-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-inner">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                <span className="text-xs font-bold text-amber-300 font-mono uppercase tracking-wider">
                  AI TARGET PREDICTION FOR #{currentPeriod.slice(-5)}:
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.2 rounded font-mono font-bold">
                  {prediction.confidence}% Confidence
                </span>
              </div>
              <div className="text-xs text-slate-200 flex flex-wrap items-center gap-2">
                <span className="font-bold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {prediction.sizeBurmese} • {prediction.colorBurmese}
                </span>
                <span className="text-slate-400 font-mono">
                  Lucky: [{prediction.numbers.join(', ')}]
                </span>
                <span className="text-[11px] text-amber-400/90 font-mono">
                  Rule: {prediction.pattern}
                </span>
              </div>
            </div>

            <button
              onClick={handleApplyAiPrediction}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.4)] flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
            >
              <Zap className="w-4 h-4 text-black" />
              Follow AI Guess (AI အတိုင်း ထည့်မည်)
            </button>
          </div>
        )}

        {/* BETTING SELECTIONS */}
        <div className="space-y-4">
          {/* TAB 1: BIG / SMALL MAIN BUTTONS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase font-mono text-slate-300">
                1. SELECT SIZE (ကြီး / ငယ်) - Payout 1 : 1.98
              </span>
              {selectedBetType === 'SIZE' && (
                <span className="text-[10px] text-amber-400 font-mono font-bold">
                  Selected: {selectedChoice === 'BIG' ? 'ကြီး (BIG 5-9)' : 'ငယ် (SMALL 0-4)'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setSelectedBetType('SIZE'); setSelectedChoice('BIG'); }}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center relative ${
                  selectedBetType === 'SIZE' && selectedChoice === 'BIG'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.35)] scale-[1.02]'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {prediction?.size === 'BIG' && (
                  <span className="absolute -top-2.5 right-3 text-[10px] bg-amber-500 text-black font-extrabold px-2 py-0.5 rounded-full shadow">
                    AI GUESS
                  </span>
                )}
                <span className="text-2xl sm:text-3xl font-tech font-black tracking-wider">ကြီး (BIG)</span>
                <span className="text-xs text-slate-400 font-mono mt-1">Numbers: 5, 6, 7, 8, 9</span>
              </button>

              <button
                onClick={() => { setSelectedBetType('SIZE'); setSelectedChoice('SMALL'); }}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center relative ${
                  selectedBetType === 'SIZE' && selectedChoice === 'SMALL'
                    ? 'bg-blue-600/25 border-blue-400 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.35)] scale-[1.02]'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {prediction?.size === 'SMALL' && (
                  <span className="absolute -top-2.5 right-3 text-[10px] bg-blue-500 text-white font-extrabold px-2 py-0.5 rounded-full shadow">
                    AI GUESS
                  </span>
                )}
                <span className="text-2xl sm:text-3xl font-tech font-black tracking-wider">ငယ် (SMALL)</span>
                <span className="text-xs text-slate-400 font-mono mt-1">Numbers: 0, 1, 2, 3, 4</span>
              </button>
            </div>
          </div>

          {/* TAB 2: COLORS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase font-mono text-slate-300">
                2. SELECT COLOR (အရောင်)
              </span>
              {selectedBetType === 'COLOR' && (
                <span className="text-[10px] text-amber-400 font-mono font-bold">
                  Selected: {String(selectedChoice)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => { setSelectedBetType('COLOR'); setSelectedChoice('GREEN'); }}
                className={`p-3 rounded-xl border-2 transition-all text-center relative ${
                  selectedBetType === 'COLOR' && selectedChoice === 'GREEN'
                    ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.35)] scale-[1.02]'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {prediction?.color === 'GREEN' && (
                  <span className="absolute -top-2 right-2 text-[9px] bg-emerald-500 text-black font-extrabold px-1.5 rounded">
                    AI
                  </span>
                )}
                <span className="font-bold text-sm block">အစိမ်း (GREEN)</span>
                <span className="text-[10px] text-slate-400 font-mono block">1, 3, 7, 9 (1:1.98)</span>
              </button>

              <button
                onClick={() => { setSelectedBetType('COLOR'); setSelectedChoice('VIOLET'); }}
                className={`p-3 rounded-xl border-2 transition-all text-center relative ${
                  selectedBetType === 'COLOR' && selectedChoice === 'VIOLET'
                    ? 'bg-purple-600/30 border-purple-400 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.35)] scale-[1.02]'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="font-bold text-sm block">ခရမ်း (VIOLET)</span>
                <span className="text-[10px] text-slate-400 font-mono block">0, 5 (1:4.5)</span>
              </button>

              <button
                onClick={() => { setSelectedBetType('COLOR'); setSelectedChoice('RED'); }}
                className={`p-3 rounded-xl border-2 transition-all text-center relative ${
                  selectedBetType === 'COLOR' && selectedChoice === 'RED'
                    ? 'bg-red-600/30 border-red-400 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.35)] scale-[1.02]'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {prediction?.color === 'RED' && (
                  <span className="absolute -top-2 right-2 text-[9px] bg-red-500 text-white font-extrabold px-1.5 rounded">
                    AI
                  </span>
                )}
                <span className="font-bold text-sm block">အနီ (RED)</span>
                <span className="text-[10px] text-slate-400 font-mono block">2, 4, 6, 8 (1:1.98)</span>
              </button>
            </div>
          </div>

          {/* TAB 3: NUMBERS 0-9 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase font-mono text-slate-300">
                3. SELECT NUMBER (ကိန်းဂဏန်း 0 မှ 9) - Payout 1 : 9
              </span>
              {selectedBetType === 'NUMBER' && (
                <span className="text-[10px] text-amber-400 font-mono font-bold">
                  Selected Number: {String(selectedChoice)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                const isSelected = selectedBetType === 'NUMBER' && selectedChoice === num;
                const isRecommended = prediction?.numbers.includes(num);

                return (
                  <button
                    key={num}
                    onClick={() => { setSelectedBetType('NUMBER'); setSelectedChoice(num); }}
                    className={`h-12 rounded-xl flex flex-col items-center justify-center font-tech font-black text-lg border transition-all relative ${
                      isSelected
                        ? 'bg-amber-500 text-black border-amber-300 scale-105 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                        : isRecommended
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 hover:border-amber-400'
                        : 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {isRecommended && !isSelected && (
                      <span className="absolute -top-1.5 right-0.5 text-[8px] bg-amber-500 text-black font-extrabold px-1 rounded">
                        AI
                      </span>
                    )}
                    <span>{num}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AMOUNT AND MULTIPLIER BAR */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Base Amount */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-400 font-mono font-bold mr-1">AMOUNT:</span>
                {[10, 50, 100, 500, 1000, 5000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setBaseAmount(amt)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      baseAmount === amt
                        ? 'bg-amber-500 text-black shadow'
                        : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    K {amt}
                  </button>
                ))}
              </div>

              {/* Multiplier */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-mono font-bold mr-1">MULTIPLIER:</span>
                {[1, 5, 10, 20, 50].map((mul) => (
                  <button
                    key={mul}
                    onClick={() => setMultiplier(mul)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      multiplier === mul
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {mul}X
                  </button>
                ))}
              </div>
            </div>

            {/* Total Cost and CONFIRM BET Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Total Bet Cost:</span>
                <span className="text-lg font-tech font-bold text-amber-400 font-mono">
                  K {totalBetAmount.toLocaleString()} MMK
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ({baseAmount} x {multiplier}X on {String(selectedChoice)})
                </span>
              </div>

              <button
                onClick={handlePlaceBet}
                disabled={secondsLeft <= 5}
                className="w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-sm rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                CONFIRM BET (လောင်းမည်)
              </button>
            </div>

            {betFeedback && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{betFeedback}</span>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* USER GAME BALANCE & AUTO BET CONTROLLER (UNDER CONFIRM BET BUTTON)        */}
          {/* ========================================================================= */}
          <div className="space-y-4 pt-2">
            {/* 1. USER GAME BALANCE DISPLAY BANNER */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-500/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
                  <Coins className="w-6 h-6 text-amber-400 animate-pulse" />
                </div>
                <div>
                  <span className="text-[11px] uppercase font-mono text-slate-400 font-bold tracking-wider block">
                    USER GAME BALANCE (လက်ရှိ ကစားငွေစာရင်း)
                  </span>
                  <div className="text-2xl sm:text-3xl font-tech font-black text-amber-300 font-mono tracking-tight flex items-center gap-2 mt-0.5">
                    <span>K {userBalance.toLocaleString()}</span>
                    <span className="text-sm font-bold text-amber-500 font-sans">MMK</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right hidden sm:block text-xs font-mono text-slate-400">
                  <span className="block text-slate-300 font-bold">{account.nickName || 'MemberNNG0XDE5'}</span>
                  <span>Ph: {account.phone}</span>
                </div>

                <button
                  onClick={onRefreshSession}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow"
                  title="Refresh Balance from ShweLottery"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>ငွေလက်ကျန် စစ်မည်</span>
                </button>
              </div>
            </div>

            {/* 2. AUTO BET CONTROL PANEL */}
            <div className={`p-5 rounded-2xl border-2 transition-all shadow-2xl relative overflow-hidden ${
              isAutoBetActive 
                ? 'bg-slate-900/95 border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/40' 
                : 'bg-slate-950 border-slate-800'
            }`}>
              {/* Header with Auto Bet Switch */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isAutoBetActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <Bot className={`w-5 h-5 ${isAutoBetActive ? 'animate-bounce text-emerald-400' : ''}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-tech text-base font-black text-white tracking-wide">
                        AUTO BET ENGINE (အော်တိုလောင်းကြေးစနစ်)
                      </h4>
                      {isAutoBetActive && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-extrabold uppercase font-mono animate-pulse">
                          RUNNING
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      Martingale Progression (2X သို့မဟုတ် 3X) ဖြင့် အရှုံးကာကွယ် အနိုင်ရယူရေး စနစ်
                    </p>
                  </div>
                </div>

                {/* AUTO BET TOGGLE BUTTON */}
                <button
                  onClick={() => {
                    const nextState = !isAutoBetActive;
                    if (nextState) {
                      // If stopped due to lose limit or win target, restart the session cycle seamlessly
                      if (
                        stopReason === 'LOSE_STOP' || 
                        (loseStopEnabled && loseStopAmount > 0 && autoProfit <= -loseStopAmount)
                      ) {
                        setAutoProfit(0);
                        consecutiveLossesRef.current = 0;
                        setConsecutiveLosses(0);
                        setCurrentAutoStake(autoBaseAmount);
                        setStopReason(null);
                        setIsAutoBetActive(true);
                        setAutoFeedback(`🔄 Lose Stop အရှုံးကန့်သတ်ချက် ပြည့်ပြီးနောက် Auto Bot ကို အသစ်ပြန်လည်စတင်လိုက်ပါပြီ! မူလစတင်ငွေ K ${autoBaseAmount.toLocaleString()} MMK (${autoMultiplierMode}× ဆတိုး) ဖြင့် ပြန်လည်စတင်လောင်းပါမည်။`);
                        return;
                      }

                      if (
                        stopReason === 'WIN_STOP' || 
                        (winStopEnabled && winStopAmount > 0 && autoProfit >= winStopAmount)
                      ) {
                        setAutoProfit(0);
                        consecutiveLossesRef.current = 0;
                        setConsecutiveLosses(0);
                        setCurrentAutoStake(autoBaseAmount);
                        setStopReason(null);
                        setIsAutoBetActive(true);
                        setAutoFeedback(`🏆 Target Profit ပြည့်ပြီးနောက် Auto Bot session အသစ်ကို ဖွင့်လှစ်လိုက်ပါပြီ! မူလစတင်ငွေ K ${autoBaseAmount.toLocaleString()} MMK ဖြင့် စတင်လောင်းပါမည်။`);
                        return;
                      }

                      setStopReason(null);
                      setIsAutoBetActive(true);
                      if (consecutiveLosses === 0) {
                        setCurrentAutoStake(autoBaseAmount);
                      }
                      if (autoStrategy === 'WAIT_BOT') {
                        const streak = getConsecutiveStreak(history);
                        setAutoFeedback(`⏳ Wait Bot စနစ်ကို ဖွင့်လိုက်ပါပြီ! ကြီး သို့မဟုတ် ငယ် ဆက်တိုက် ${waitStreakThreshold} ကြိမ် (လက်ရှိ: ${streak.size === 'BIG' ? 'ကြီး' : streak.size === 'SMALL' ? 'ငယ်' : 'မရှိ'} ${streak.count} ကြိမ်) ပြည့်သည်အထိ စောင့်ဆိုင်းပြီး ဆန့်ကျင်ဘက်ကို win ဖြစ်သည်အထိ ${autoMultiplierMode}× ဆတိုးဖြင့် စတင်လောင်းပါမည်။`);
                      } else {
                        setAutoFeedback(`အော်တိုလောင်းကြေးစနစ်ကို ဖွင့်လိုက်ပါပြီ! စတင်ငွေ K ${autoBaseAmount.toLocaleString()} MMK၊ ${autoMultiplierMode}× ဆတိုးစနစ်၊ Win Stop: ${winStopEnabled ? `+K ${winStopAmount.toLocaleString()} MMK` : 'ပိတ်ထား'}၊ Lose Stop: ${loseStopEnabled ? `-K ${loseStopAmount.toLocaleString()} MMK` : 'ပိတ်ထား'}`);
                      }
                    } else {
                      setIsAutoBetActive(false);
                      setAutoFeedback('အော်တိုလောင်းကြေးစနစ်ကို ရပ်တန့်လိုက်ပါပြီ။');
                    }
                  }}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 shadow-lg ${
                    isAutoBetActive
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-950/50'
                      : stopReason === 'LOSE_STOP'
                      ? 'bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 hover:from-rose-400 hover:to-emerald-400 text-black shadow-rose-950/50 animate-pulse ring-2 ring-rose-400'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-amber-950/50'
                  }`}
                >
                  {isAutoBetActive ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>STOP AUTO BET (ရပ်မည်)</span>
                    </>
                  ) : stopReason === 'LOSE_STOP' ? (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>RESTART AUTO BOT (ပြန်လည်စတင်မည်)</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>START AUTO BET (စတင်မည်)</span>
                    </>
                  )}
                </button>
              </div>

              {/* AUTO BET SETTINGS & MULTIPLIER SELECTION */}
              <div className="pt-4 space-y-4">
                {/* 1. 2X / 3X / CUSTOM PROGRESSION MULTIPLIER */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-xs font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      PROGRESSION MULTIPLIER (၂ဆ / ၃ဆ ဆတိုးစနစ်)
                    </span>
                    <span className="text-[11px] text-amber-400 font-mono font-bold">
                      Current Multiplier: {autoMultiplierMode}× MULTIPLIER
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 2X BUTTON */}
                    <button
                      type="button"
                      onClick={() => {
                        setAutoMultiplierMode(2);
                        setIsCustomMultiplier(false);
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all relative ${
                        autoMultiplierMode === 2 && !isCustomMultiplier
                          ? 'bg-amber-500/20 border-amber-400 text-white shadow-lg'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-tech text-base font-black text-amber-400">2× PROGRESSION</span>
                        <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                          Double on Loss
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        ဥပမာ - K 10 bet ၍ lose ဖြစ်သည့်အခါ ချက်ချင်း <strong className="text-amber-300">20 bet (2×)</strong> ဆတိုးလောင်းမည်။
                      </p>
                      <p className="text-[11px] text-emerald-400 mt-1 font-mono">
                        ✓ Win ဖြစ်သည့်အခါ "You Win!" အသံထွက်ပြီး မူလအစ bet K {autoBaseAmount} ဖြင့် ချက်ချင်း ပြန်လည်လောင်းမည်။
                      </p>
                    </button>

                    {/* 3X BUTTON */}
                    <button
                      type="button"
                      onClick={() => {
                        setAutoMultiplierMode(3);
                        setIsCustomMultiplier(false);
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all relative ${
                        autoMultiplierMode === 3 && !isCustomMultiplier
                          ? 'bg-purple-600/20 border-purple-400 text-white shadow-lg'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-tech text-base font-black text-purple-400">3× PROGRESSION</span>
                        <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                          Triple on Loss
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        ဥပမာ - K 10 bet ၍ lose ဖြစ်သည့်အခါ ချက်ချင်း <strong className="text-purple-300">30, 90, 270 (3×)</strong> ဆတိုးလောင်းမည်။
                      </p>
                      <p className="text-[11px] text-emerald-400 mt-1 font-mono">
                        ✓ Win ဖြစ်သည့်အခါ "You Win!" အသံထွက်ပြီး မူလအစ bet K {autoBaseAmount} ဖြင့် ချက်ချင်း ပြန်လည်လောင်းမည်။
                      </p>
                    </button>

                    {/* CUSTOM MULTIPLIER BUTTON & INPUT */}
                    <div
                      className={`p-3 rounded-xl border-2 transition-all flex flex-col justify-between ${
                        isCustomMultiplier
                          ? 'bg-cyan-600/20 border-cyan-400 text-white shadow-lg'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-tech text-base font-black text-cyan-400">CUSTOM ×</span>
                        <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">
                          စိတ်ကြိုက်ဆနှုန်း
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-400 mt-1">
                        စိတ်ကြိုက်တိုးမည့် ဆနှုန်း ရိုက်ထည့်ပါ:
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="number"
                          step="0.5"
                          min="1.2"
                          max="10"
                          value={customMultiplierInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomMultiplierInput(val);
                            const parsed = parseFloat(val);
                            if (!isNaN(parsed) && parsed >= 1.1) {
                              setAutoMultiplierMode(parsed);
                              setIsCustomMultiplier(true);
                            }
                          }}
                          onFocus={() => {
                            setIsCustomMultiplier(true);
                            const parsed = parseFloat(customMultiplierInput);
                            if (!isNaN(parsed) && parsed >= 1.1) {
                              setAutoMultiplierMode(parsed);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm font-bold focus:outline-none focus:border-cyan-400"
                          placeholder="e.g. 2.5"
                        />
                        <span className="text-xs font-mono font-bold text-cyan-400">ဆတိုး</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. BASE AMOUNT & STRATEGY */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Base Amount Selector */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-300 uppercase block">
                        BASE BET (စတင်လောင်းကြေးငွေ)
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-400">
                        K {autoBaseAmount.toLocaleString()} MMK
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[10, 50, 100, 500, 1000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setAutoBaseAmount(amt);
                            setIsCustomBaseAmount(false);
                            setCustomBaseAmountInput(String(amt));
                            if (consecutiveLosses === 0) setCurrentAutoStake(amt);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                            autoBaseAmount === amt && !isCustomBaseAmount
                              ? 'bg-amber-500 text-black shadow'
                              : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          K {amt}
                        </button>
                      ))}
                    </div>

                    {/* Custom Base Amount input */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-slate-400 font-mono">စိတ်ကြိုက်:</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 20"
                        value={customBaseAmountInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomBaseAmountInput(val);
                          const parsed = parseInt(val, 10);
                          if (!isNaN(parsed) && parsed > 0) {
                            setAutoBaseAmount(parsed);
                            setIsCustomBaseAmount(true);
                            if (consecutiveLosses === 0) setCurrentAutoStake(parsed);
                          }
                        }}
                        onFocus={() => setIsCustomBaseAmount(true)}
                        className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                      />
                      <span className="text-xs font-mono text-amber-400">MMK</span>
                    </div>
                  </div>

                  {/* Strategy Selector */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-300 uppercase">
                        TARGET STRATEGY (လောင်းမည့်ပုံစံ)
                      </span>
                      {prediction?.algorithm && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                          {prediction.algorithm === 'HMM' ? '🤖 HMM REGIME' : prediction.algorithm === 'MARKOV' ? '📊 MARKOV CHAIN' : '⚡ ENSEMBLE'}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Strategy 1: AI Auto Guess */}
                      <button
                        type="button"
                        onClick={() => setAutoStrategy('AI_GUESS')}
                        className={`p-2.5 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 ${
                          autoStrategy === 'AI_GUESS'
                            ? 'bg-amber-500 text-black shadow-lg ring-1 ring-amber-400'
                            : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 font-tech text-xs uppercase">
                          <Bot className="w-3.5 h-3.5" />
                          <span>AI Guess ({prediction?.algorithm || 'HMM'})</span>
                        </span>
                        <span className="text-[10px] font-mono opacity-85">
                          {prediction?.size === 'BIG' ? 'ကြီး (BIG)' : 'ငယ် (SMALL)'} • {prediction?.confidence || 85}%
                        </span>
                      </button>

                      {/* Strategy 2: WAIT BOT (Dragon / Streak Hunter) */}
                      <button
                        type="button"
                        onClick={() => setAutoStrategy('WAIT_BOT')}
                        className={`p-2.5 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 relative overflow-hidden ${
                          autoStrategy === 'WAIT_BOT'
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg ring-2 ring-purple-400'
                            : 'bg-slate-950 text-slate-300 border border-purple-500/30 hover:border-purple-500/60'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 font-tech text-xs uppercase text-amber-300">
                          <Hourglass className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
                          <span>Wait Bot (ဆန့်ကျင်ဘက်)</span>
                        </span>
                        <span className="text-[10px] font-mono opacity-90">
                          Streak {waitStreakThreshold}x ပြီး ဆန့်ကျင်ဘက် win ထိ
                        </span>
                      </button>

                      {/* Strategy 3: Manual Fixed Choice */}
                      <button
                        type="button"
                        onClick={() => setAutoStrategy('MANUAL_CHOICE')}
                        className={`p-2.5 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 ${
                          autoStrategy === 'MANUAL_CHOICE'
                            ? 'bg-amber-500 text-black shadow-lg ring-1 ring-amber-400'
                            : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 font-tech text-xs uppercase">
                          <Target className="w-3.5 h-3.5" />
                          <span>Fixed Choice</span>
                        </span>
                        <span className="text-[10px] font-mono opacity-85">
                          [{String(selectedChoice)}] တသမတ်တည်း
                        </span>
                      </button>
                    </div>

                    {/* DEDICATED WAIT BOT CONFIGURATION PANEL */}
                    {autoStrategy === 'WAIT_BOT' && (() => {
                      const currentStreak = getConsecutiveStreak(history);
                      const isThresholdReached = currentStreak.count >= waitStreakThreshold;
                      const progressPct = Math.min(100, Math.round((currentStreak.count / waitStreakThreshold) * 100));

                      return (
                        <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/40 space-y-3 shadow-inner">
                          {/* Wait Bot Title & Mode Badge */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
                                <Hourglass className="w-4 h-4 text-purple-400 animate-spin" style={{ animationDuration: '6s' }} />
                              </div>
                              <div>
                                <span className="font-tech text-xs sm:text-sm font-black text-purple-300 block tracking-wide">
                                  WAIT BOT METHOD (OPPOSITE CHASER)
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  ကြီး / ငယ် ဆက်တိုက်ထွက်ပြီးနောက် ဆန့်ကျင်ဘက်ကို WIN ဖြစ်သည့်အထိ လောင်းမည့်စနစ်
                                </span>
                              </div>
                            </div>

                            {/* Status badge */}
                            <div className="flex items-center gap-1.5">
                              {waitBotStatus === 'BETTING' ? (
                                <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/50 text-[10px] font-mono font-bold flex items-center gap-1.5 animate-pulse">
                                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                                  <span>ATTACKING: [{waitBotTarget === 'BIG' ? 'ကြီး (BIG)' : 'ငယ် (SMALL)'}] WIN ထိလောင်းနေသည်</span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>WAITING: Streak {waitStreakThreshold}x စောင့်ဆိုင်းနေသည်</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 1. Custom Streak Threshold Selection */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-300 font-mono font-bold">
                                ဆက်တိုက်ထွက်ရမည့် အကြိမ်ရေ သတ်မှတ်ချက် (Streak Count):
                              </span>
                              <strong className="text-purple-300 font-mono text-xs">
                                {waitStreakThreshold} ကြိမ် ဆက်တိုက်ထွက်ပြီးမှ စလောင်းမည်
                              </strong>
                            </div>

                            {/* Presets: 3, 4, 5, 6, 7, 8 */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {[3, 4, 5, 6, 7, 8].map((count) => (
                                <button
                                  key={count}
                                  type="button"
                                  onClick={() => {
                                    setWaitStreakThreshold(count);
                                    setCustomStreakInput(String(count));
                                    setIsCustomStreak(false);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                                    waitStreakThreshold === count && !isCustomStreak
                                      ? 'bg-purple-500 text-white shadow-lg ring-1 ring-purple-300'
                                      : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-purple-500/50'
                                  }`}
                                >
                                  {count} ကြိမ် {count === 5 && '(အကြံပြု)'}
                                </button>
                              ))}
                            </div>

                            {/* Custom Number Input */}
                            <div className="flex items-center gap-2 pt-1 border-t border-purple-500/20">
                              <span className="text-[11px] text-slate-400 font-mono">စိတ်ကြိုက်အကြိမ်ရေ သတ်မှတ်ရန်:</span>
                              <div className="relative flex-1">
                                <input
                                  type="number"
                                  min="2"
                                  max="20"
                                  value={customStreakInput}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomStreakInput(val);
                                    const parsed = parseInt(val, 10);
                                    if (!isNaN(parsed) && parsed >= 2) {
                                      setWaitStreakThreshold(parsed);
                                      setIsCustomStreak(true);
                                    }
                                  }}
                                  onFocus={() => setIsCustomStreak(true)}
                                  placeholder="e.g. 5 သို့မဟုတ် 6"
                                  className="w-full px-2.5 py-1 bg-slate-950 border border-purple-500/40 rounded-lg text-purple-300 font-mono text-xs font-bold focus:outline-none focus:border-purple-400"
                                />
                              </div>
                              <span className="text-xs font-mono font-bold text-purple-400">ကြိမ်</span>
                            </div>
                          </div>

                          {/* 2. Live Streak Radar Box */}
                          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-purple-500/30 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 font-mono flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-purple-400" />
                                <span>လက်ရှိ Live Streak အခြေအနေ:</span>
                              </span>
                              <span className="font-mono font-bold text-xs flex items-center gap-1.5">
                                {currentStreak.size === 'BIG' ? (
                                  <span className="text-amber-400">🔴 ကြီး (BIG) {currentStreak.count} ကြိမ် ဆက်တိုက်</span>
                                ) : currentStreak.size === 'SMALL' ? (
                                  <span className="text-blue-400">🔵 ငယ် (SMALL) {currentStreak.count} ကြိမ် ဆက်တိုက်</span>
                                ) : (
                                  <span className="text-slate-400">မရှိသေးပါ</span>
                                )}
                              </span>
                            </div>

                            {/* Progress bar towards threshold */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span className="text-slate-400">Streak Progress:</span>
                                <span className={isThresholdReached ? 'text-emerald-400 font-bold' : 'text-purple-300 font-bold'}>
                                  {currentStreak.count} / {waitStreakThreshold} ကြိမ် ({progressPct}%)
                                </span>
                              </div>
                              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                <div
                                  className={`h-full transition-all duration-500 ${
                                    isThresholdReached
                                      ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                                      : 'bg-gradient-to-r from-purple-500 to-indigo-400'
                                  }`}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </div>

                            {/* Target Trigger Info */}
                            <div className="text-[11px] text-slate-300 pt-1 flex items-center justify-between">
                              <span>စလောင်းမည့် ဆန့်ကျင်ဘက်:</span>
                              <strong className="font-tech text-xs text-amber-300 font-bold">
                                {currentStreak.opposite === 'BIG'
                                  ? 'ကြီး (BIG)'
                                  : currentStreak.opposite === 'SMALL'
                                  ? 'ငယ် (SMALL)'
                                  : 'မသိရသေးပါ'}{' '}
                                {isThresholdReached ? '(စတင်လောင်းနေပါပြီ!)' : `(${waitStreakThreshold} ကြိမ်ပြည့်မှ)`}
                              </strong>
                            </div>
                          </div>

                          {/* How Wait Bot works explainer */}
                          <p className="text-[11px] text-slate-300 bg-purple-950/40 p-2.5 rounded-lg border border-purple-500/20">
                            💡 <strong>လုပ်ဆောင်ပုံ:</strong> ဥပမာ <strong>{waitStreakThreshold} ကြိမ်</strong> သတ်မှတ်ထားလျှင် ကြီး (သို့မဟုတ် ငယ်) သည် {waitStreakThreshold} ကြိမ် ဆက်တိုက်ထွက်သည်အထိ အော်တိုစောင့်ဆိုင်းပါမည်။ {waitStreakThreshold} ကြိမ်ပြည့်လျှင် ဆန့်ကျင်ဘက်ဖြစ်သော [<strong>{currentStreak.opposite === 'BIG' ? 'ကြီး' : currentStreak.opposite === 'SMALL' ? 'ငယ်' : 'ဆန့်ကျင်ဘက်'}</strong>] ကို <strong>Win ဖြစ်သည့်အထိ</strong> {autoMultiplierMode}× ဆတိုးစနစ်ဖြင့် အလိုအလျောက် ဆက်တိုက်လောင်းပေးပြီး Win ဖြစ်သည်နှင့် စတင်လောင်းကြေး K {autoBaseAmount} သို့ ပြန်လည်သတ်မှတ်ကာ စောင့်ဆိုင်းမုဒ်သို့ ပြန်သွားမည်ဖြစ်ပါသည်။
                          </p>
                        </div>
                      );
                    })()}

                    {/* AI Method Switcher (Only when AI_GUESS is active) */}
                    {autoStrategy === 'AI_GUESS' && onChangeAiAlgorithm && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 font-mono text-[11px] font-bold flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            AI PREDICTION METHOD:
                          </span>
                          {onToggleAutoSwitch && (
                            <button
                              type="button"
                              onClick={onToggleAutoSwitch}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all ${
                                isAutoSwitchEnabled
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                                  : 'bg-slate-950 text-slate-400 border border-slate-800'
                              }`}
                              title={isAutoSwitchEnabled ? 'Auto-Switch is ON: AI will auto-swap to the highest win % algorithm' : 'Auto-Switch is OFF'}
                            >
                              <Zap className={`w-3 h-3 ${isAutoSwitchEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                              <span>AUTO-SWAP:</span>
                              <span className={isAutoSwitchEnabled ? 'text-emerald-400 font-black' : 'text-slate-400'}>
                                {isAutoSwitchEnabled ? 'ON' : 'OFF'}
                              </span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          {([
                            { id: 'HMM', label: 'HMM Model', icon: '🤖', rate: methodStats?.HMM?.winRate ?? 85, color: 'amber' },
                            { id: 'MARKOV', label: 'Markov Matrix', icon: '📊', rate: methodStats?.MARKOV?.winRate ?? 72, color: 'purple' },
                            { id: 'ENSEMBLE', label: 'Ensemble Consensus', icon: '⚡', rate: methodStats?.ENSEMBLE?.winRate ?? 80, color: 'cyan' },
                          ] as const).map((item) => {
                            const isSelected = aiAlgorithm === item.id;
                            const isLeader = methodStats && (
                              (methodStats[item.id as AlgorithmType]?.winRate || 0) >= Math.max(
                                methodStats.HMM?.winRate || 0,
                                methodStats.MARKOV?.winRate || 0,
                                methodStats.ENSEMBLE?.winRate || 0
                              )
                            );

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => onChangeAiAlgorithm(item.id as AlgorithmType)}
                                className={`p-2 rounded-xl text-left transition-all relative border flex flex-col justify-between ${
                                  isSelected
                                    ? item.id === 'HMM'
                                      ? 'bg-amber-500/15 border-amber-500 text-amber-200 ring-1 ring-amber-400 shadow-md'
                                      : item.id === 'MARKOV'
                                      ? 'bg-purple-500/15 border-purple-500 text-purple-200 ring-1 ring-purple-400 shadow-md'
                                      : 'bg-cyan-500/15 border-cyan-500 text-cyan-200 ring-1 ring-cyan-400 shadow-md'
                                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                {isLeader && (
                                  <span className="absolute -top-1.5 -right-1 text-[8px] font-mono px-1 rounded-full bg-emerald-500 text-black font-black uppercase">
                                    TOP WIN
                                  </span>
                                )}
                                <div className="flex items-center gap-1 font-mono text-[11px] font-bold">
                                  <span>{item.icon}</span>
                                  <span className="truncate">{item.label}</span>
                                </div>
                                <div className="flex items-center justify-between mt-1 text-[10px] font-mono">
                                  <span className="text-slate-400">Win Rate:</span>
                                  <span className={`font-bold ${isSelected ? 'text-white' : 'text-emerald-400'}`}>
                                    {item.rate}%
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Auto-Switch Event Banner if recently swapped */}
                        {autoSwitchEvent && (
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-200 flex items-center justify-between gap-2 animate-pulse">
                            <div className="flex items-center gap-2">
                              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                              <div>
                                <span className="font-bold text-white">⚡ AI Auto-Swapped:</span>{' '}
                                <span>{autoSwitchEvent.fromAlgo} ➔ <strong className="text-amber-300">{autoSwitchEvent.toAlgo}</strong> ({autoSwitchEvent.toWinRate}%)</span>
                                <span className="text-slate-400 text-[10px] block font-sans">{autoSwitchEvent.reason}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {autoStrategy === 'AI_GUESS' && prediction?.hmmDetails && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-amber-500/20 text-[10px] font-mono text-slate-300 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-amber-400 font-bold">HMM Latent State:</span>
                          <span className="font-bold text-amber-300">
                            {prediction.hmmDetails.stateLabel} ({prediction.hmmDetails.transitionLikelihood}%)
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          {prediction.hmmDetails.stateBurmese} • P(ကြီး): {prediction.hmmDetails.pBig}% / P(ငယ်): {prediction.hmmDetails.pSmall}%
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-400 pt-0.5">
                      {autoStrategy === 'AI_GUESS'
                        ? `${prediction?.algorithm || 'HMM'} နည်းပညာဖြင့် ပွဲစဉ်တိုင်းအတွက် အလိုအလျောက် အကောင်းဆုံး ခန့်မှန်းရွေးချယ်ပေးပါမည်`
                        : autoStrategy === 'WAIT_BOT'
                        ? `Wait Bot သည် ကြီး သို့မဟုတ် ငယ် ${waitStreakThreshold} ကြိမ် ဆက်တိုက်ထွက်ပြီးမှ ဆန့်ကျင်ဘက်ကို win ဖြစ်သည်အထိ အလိုအလျောက် လောင်းပေးပါမည်`
                        : `လက်ရှိ သင်ရွေးချယ်ထားသော [${String(selectedChoice)}] အတိုင်း ပွဲစဉ်တိုင်း လောင်းမည်`}
                    </p>
                  </div>
                </div>

                {/* 3. CUSTOM WIN STOP & LOSE STOP SAFETY CONTROLS (NEW) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* WIN STOP (TAKE PROFIT) */}
                  <div className={`p-4 rounded-xl border-2 transition-all space-y-3 ${
                    winStopEnabled 
                      ? 'bg-emerald-950/20 border-emerald-500/50 shadow-inner' 
                      : 'bg-slate-900/60 border-slate-800 opacity-75'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                          <Trophy className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <span className="font-tech text-sm font-black text-emerald-400 block tracking-wide">
                            WIN STOP (အနိုင်ရငွေ ကန့်သတ်ချက်)
                          </span>
                          <span className="text-[10px] text-slate-400">
                            သတ်မှတ်အမြတ်ရလျှင် Auto Bet အလိုအလျောက် ရပ်မည်
                          </span>
                        </div>
                      </div>

                      {/* Enable/Disable Toggle */}
                      <button
                        type="button"
                        onClick={() => setWinStopEnabled(!winStopEnabled)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1 ${
                          winStopEnabled
                            ? 'bg-emerald-500 text-black'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {winStopEnabled ? 'ON (ဖွင့်)' : 'OFF (ပိတ်)'}
                      </button>
                    </div>

                    {/* Presets */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono">အမြတ်ရယူမည့် ပမာဏ:</span>
                        <strong className="text-emerald-300 font-mono">
                          {winStopEnabled ? `+K ${winStopAmount.toLocaleString()} MMK` : 'ကန့်သတ်မထားပါ'}
                        </strong>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[500, 1000, 2000, 5000, 10000].map((val) => (
                          <button
                            key={val}
                            type="button"
                            disabled={!winStopEnabled}
                            onClick={() => {
                              setWinStopAmount(val);
                              setWinStopInput(String(val));
                            }}
                            className={`px-2 py-1 rounded text-xs font-mono font-bold transition-all ${
                              winStopAmount === val && winStopEnabled
                                ? 'bg-emerald-500 text-black shadow'
                                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 disabled:opacity-40'
                            }`}
                          >
                            K {val.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Input */}
                    <div className="flex items-center gap-2 pt-1 border-t border-emerald-500/20">
                      <span className="text-xs text-slate-400 font-mono">Custom Win Stop:</span>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="10"
                          disabled={!winStopEnabled}
                          value={winStopInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWinStopInput(val);
                            const parsed = parseInt(val, 10);
                            if (!isNaN(parsed) && parsed > 0) {
                              setWinStopAmount(parsed);
                            }
                          }}
                          placeholder="e.g. 1000"
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-emerald-500/40 rounded-lg text-emerald-300 font-mono text-xs font-bold focus:outline-none focus:border-emerald-400 disabled:opacity-40"
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400">MMK</span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-300 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-500/30">
                        💡 <strong>ဥပမာ:</strong> Win Stop ကို <strong>1000</strong> သတ်မှတ်လျှင် အမြတ် <strong>K 1,000</strong> ရရှိသည်နှင့် Auto Bet ကို အလိုအလျောက် ရပ်တန့်ပေးမည်ဖြစ်ပြီး မြန်မာအသံဖြင့် <em>"ဂုဏ်ယူပါတယ် မင်းသတ်မှတ်ထားသောအမြတ်ငွေကိုရရှိပါပြီ"</em> ဟု ပီသစွာ ပြောကြားပေးပါမည်။
                      </p>
                      
                      <button
                        type="button"
                        onClick={() => playMyanmarTargetProfitVoice()}
                        className="w-full py-1.5 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm"
                        title="Target Profit အောင်မြင်သောအသံကို စမ်းသပ်နားဆင်ရန်"
                      >
                        <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                        <span>🔊 အသံစမ်းရန်: "ဂုဏ်ယူပါတယ် မင်းသတ်မှတ်ထားသောအမြတ်ငွေကိုရရှိပါပြီ"</span>
                      </button>
                    </div>
                  </div>

                  {/* LOSE STOP (STOP LOSS) */}
                  <div className={`p-4 rounded-xl border-2 transition-all space-y-3 ${
                    loseStopEnabled 
                      ? 'bg-rose-950/20 border-rose-500/50 shadow-inner' 
                      : 'bg-slate-900/60 border-slate-800 opacity-75'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                          <ShieldAlert className="w-4 h-4 text-rose-400" />
                        </div>
                        <div>
                          <span className="font-tech text-sm font-black text-rose-400 block tracking-wide">
                            LOSE STOP (အရှုံးကာကွယ် ကန့်သတ်ချက်)
                          </span>
                          <span className="text-[10px] text-slate-400">
                            သတ်မှတ်အရှုံးရောက်လျှင် Auto Bet အလိုအလျောက် ရပ်မည်
                          </span>
                        </div>
                      </div>

                      {/* Enable/Disable Toggle */}
                      <button
                        type="button"
                        onClick={() => setLoseStopEnabled(!loseStopEnabled)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1 ${
                          loseStopEnabled
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {loseStopEnabled ? 'ON (ဖွင့်)' : 'OFF (ပိတ်)'}
                      </button>
                    </div>

                    {/* Presets */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono">အရှုံးခံမည့် အများဆုံးပမာဏ:</span>
                        <strong className="text-rose-300 font-mono">
                          {loseStopEnabled ? `-K ${loseStopAmount.toLocaleString()} MMK` : 'ကန့်သတ်မထားပါ'}
                        </strong>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[500, 1000, 2000, 5000, 10000].map((val) => (
                          <button
                            key={val}
                            type="button"
                            disabled={!loseStopEnabled}
                            onClick={() => {
                              setLoseStopAmount(val);
                              setLoseStopInput(String(val));
                            }}
                            className={`px-2 py-1 rounded text-xs font-mono font-bold transition-all ${
                              loseStopAmount === val && loseStopEnabled
                                ? 'bg-rose-500 text-white shadow'
                                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 disabled:opacity-40'
                            }`}
                          >
                            K {val.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Input */}
                    <div className="flex items-center gap-2 pt-1 border-t border-rose-500/20">
                      <span className="text-xs text-slate-400 font-mono">Custom Lose Stop:</span>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="10"
                          disabled={!loseStopEnabled}
                          value={loseStopInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLoseStopInput(val);
                            const parsed = parseInt(val, 10);
                            if (!isNaN(parsed) && parsed > 0) {
                              setLoseStopAmount(parsed);
                            }
                          }}
                          placeholder="e.g. 1000"
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-rose-500/40 rounded-lg text-rose-300 font-mono text-xs font-bold focus:outline-none focus:border-rose-400 disabled:opacity-40"
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-rose-400">MMK</span>
                    </div>

                    <p className="text-[11px] text-slate-300 bg-rose-950/40 p-2 rounded-lg border border-rose-500/30">
                      🛡️ <strong>ဥပမာ:</strong> Lose Stop ကို <strong>1000</strong> သတ်မှတ်လျှင် အရှုံး <strong>K 1,000</strong> သို့ ရောက်သည်နှင့် အရင်းကာကွယ်ရန် Auto Bet ကို အလိုအလျောက် ရပ်တန့်ပေးမည်ဖြစ်ပါသည်။
                    </p>
                  </div>
                </div>

                {/* 4. LIVE AUTO BET MONITOR DASHBOARD */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 font-bold uppercase flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                        LIVE AUTO MONITORING
                      </span>
                      {isAutoBetActive && (
                        <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          ACTIVE
                        </span>
                      )}
                      {stopReason === 'LOSE_STOP' && !isAutoBetActive && (
                        <span className="flex items-center gap-1 text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/40 font-mono font-bold animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          LOSE STOPPED (ပြန်စနိုင်ပါသည်)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-slate-400">
                        Score: <strong className="text-emerald-400">{autoWins}W</strong> - <strong className="text-rose-400">{autoLosses}L</strong>
                      </span>

                      <button
                        type="button"
                        onClick={handleResetAutoSession}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 transition-colors border border-slate-700"
                        title="Reset session statistics"
                      >
                        <RotateCcw className="w-3 h-3 text-amber-400" />
                        <span>စာရင်းအသစ်စမည် (Reset)</span>
                      </button>
                    </div>
                  </div>

                  {/* 4 Key Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">Next Auto Stake</span>
                      <span className="text-base font-tech font-black text-amber-300 font-mono">
                        K {currentAutoStake.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        Base: K {autoBaseAmount}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">Progression Step</span>
                      <span className="text-sm font-tech font-bold text-white font-mono">
                        Step {consecutiveLosses + 1}
                      </span>
                      <span className="text-[10px] text-amber-400/90 font-mono block">
                        {consecutiveLosses > 0 ? `${autoMultiplierMode}× Multiplier` : 'Base Stake'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">Loss Streak</span>
                      <span className={`text-sm font-tech font-bold font-mono ${consecutiveLosses > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {consecutiveLosses} ဆက်တိုက်ရှုံး
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {consecutiveLosses === 0 ? 'Normal Stake' : `Next: ${currentAutoStake} MMK`}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">Session Profit</span>
                      <span className={`text-base font-tech font-black font-mono ${autoProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {autoProfit >= 0 ? `+K ${autoProfit.toLocaleString()}` : `-K ${Math.abs(autoProfit).toLocaleString()}`}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        Total {autoWins + autoLosses} Rounds
                      </span>
                    </div>
                  </div>

                  {/* WIN STOP & LOSE STOP PROGRESS GAUGES */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Win Stop Progress Bar */}
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-emerald-500/30 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                          Win Stop Target:
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          {winStopEnabled
                            ? `+K ${Math.max(0, autoProfit).toLocaleString()} / ${winStopAmount.toLocaleString()} MMK (${Math.min(100, Math.max(0, Math.round((autoProfit / winStopAmount) * 100)))}%)`
                            : 'OFF'}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                          style={{
                            width: winStopEnabled && winStopAmount > 0
                              ? `${Math.min(100, Math.max(0, (autoProfit / winStopAmount) * 100))}%`
                              : '0%'
                          }}
                        />
                      </div>
                    </div>

                    {/* Lose Stop Progress Bar */}
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-rose-500/30 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                          Lose Stop Limit:
                        </span>
                        <span className="font-mono font-bold text-rose-400">
                          {loseStopEnabled
                            ? `K ${Math.abs(Math.min(0, autoProfit)).toLocaleString()} / ${loseStopAmount.toLocaleString()} MMK (${Math.min(100, Math.round((Math.abs(Math.min(0, autoProfit)) / loseStopAmount) * 100))}% used)`
                            : 'OFF'}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 to-red-500 transition-all duration-500"
                          style={{
                            width: loseStopEnabled && loseStopAmount > 0
                              ? `${Math.min(100, Math.round((Math.abs(Math.min(0, autoProfit)) / loseStopAmount) * 100))}%`
                              : '0%'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SPECIAL CELEBRATION / STOP ALERT BANNER */}
                  {stopReason === 'WIN_STOP' && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/90 via-emerald-900/70 to-slate-950 border-2 border-emerald-500 text-emerald-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                      <div className="flex items-center gap-2.5">
                        <Trophy className="w-6 h-6 text-emerald-400 shrink-0" />
                        <div>
                          <strong className="text-sm font-bold text-white block">
                            🎉 WIN STOP REACHED! (သတ်မှတ်အနိုင်ငွေ ပြည့်မီပါပြီ)
                          </strong>
                          <span>
                            စုစုပေါင်းအမြတ်ငွေ +K {autoProfit.toLocaleString()} MMK ရရှိသဖြင့် Auto Bet ကို အောင်မြင်စွာ ရပ်တန့်ပေးခဲ့ပါသည်။
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={handleRestartAutoBot}
                          className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Session အသစ်စမည် (Start)</span>
                        </button>
                        <button
                          onClick={handleResetAutoSession}
                          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700"
                        >
                          Reset စာရင်း
                        </button>
                      </div>
                    </div>
                  )}

                  {stopReason === 'LOSE_STOP' && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-950/90 via-rose-900/70 to-slate-950 border-2 border-rose-500 text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                      <div className="flex items-center gap-2.5">
                        <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 animate-bounce" />
                        <div>
                          <strong className="text-sm font-bold text-white block">
                            🛑 LOSE STOP REACHED! (အရှုံးကာကွယ် ရပ်တန့်ပါပြီ)
                          </strong>
                          <span>
                            အရှုံးငွေ -K {Math.abs(autoProfit).toLocaleString()} MMK ရောက်ရှိသဖြင့် Auto Bot ကို ဘေးကင်းစွာ ရပ်တန့်လိုက်ပါသည်။ ဆက်လက်လောင်းလိုပါက အောက်ပါခလုတ်ဖြင့် ချက်ချင်း ပြန်လည်စတင်နိုင်ပါသည်။
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={handleRestartAutoBot}
                          className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-amber-500 hover:from-emerald-400 hover:to-amber-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all animate-pulse"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Auto Bot ချက်ချင်းပြန်စမည် (Restart)</span>
                        </button>
                        <button
                          onClick={handleResetAutoSession}
                          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700"
                        >
                          Reset စာရင်း
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Feedback Message */}
                  {autoFeedback && (
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-amber-300 flex items-center gap-2">
                      <Bot className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-sans">{autoFeedback}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* ACTIVE BETS HISTORY TABLE                  */}
        {/* ========================================== */}
        {activeBets.length > 0 && (
          <div className="pt-2">
            <span className="text-xs font-bold font-mono text-slate-400 block mb-2">
              YOUR RECENT BETS (လတ်တလော လောင်းထားသော စာရင်း):
            </span>
            <div className="space-y-1.5">
              {activeBets.map((bet) => (
                <div
                  key={bet.id}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">#{bet.period.slice(-5)}</span>
                    <span className="text-white font-bold">
                      {bet.type}: {String(bet.selection)}
                    </span>
                    {bet.isAuto && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-extrabold">
                        AUTO
                      </span>
                    )}
                    <span className="text-slate-500">
                      (K {bet.amount} x {bet.multiplier}X)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">Cost: K {bet.total.toLocaleString()}</span>
                    {bet.status === 'PENDING' && (
                      <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-bold">
                        PENDING
                      </span>
                    )}
                    {bet.status === 'WON' && (
                      <span className="text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded font-bold">
                        +K {bet.payout?.toLocaleString()} WON!
                      </span>
                    )}
                    {bet.status === 'LOST' && (
                      <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded font-bold">
                        LOST
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* SHWELOTTERY GAME LOGIN CHANGE MODAL        */}
      {/* ========================================== */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500/60 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-amber-500/30">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 border-b border-amber-500/30">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400">
                  <Key className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-tech text-base font-bold text-white">
                    SHWELOTTERY GAME LOGIN
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    ဖုန်းနံပါတ်နှင့် စကားဝှက် ပြောင်းလဲ၍ Login ဝင်ရောက်ပါ
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAccountLoginSubmit} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase">
                  PHONE NUMBER (ဖုန်းနံပါတ်)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9798023829 or 099798023829"
                    value={inputPhone}
                    onChange={(e) => setInputPhone(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase">
                  PASSWORD (စကားဝှက်)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="Enter password..."
                    value={inputPassword}
                    onChange={(e) => setInputPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {loginFeedback && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  loginFeedback.success 
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' 
                    : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                }`}>
                  {loginFeedback.success ? <Check className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
                  <span>{loginFeedback.message}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSetDefaultAccount}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
                >
                  Reset Default
                </button>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-black font-extrabold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>Login ဝင်နေသည်...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 text-black" />
                      <span>Login ဝင်မည်</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
