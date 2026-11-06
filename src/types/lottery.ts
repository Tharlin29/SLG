export type DrawSize = 'BIG' | 'SMALL';
export type DrawColor = 'RED' | 'GREEN' | 'VIOLET' | 'RED_VIOLET' | 'GREEN_VIOLET';

export interface WingoDraw {
  period: string;
  number: number;
  size: DrawSize;
  color: DrawColor;
  timestamp: number;
  openTime: string;
  openTimeMMT?: string;
  fullTime?: string;
  premium?: string;
}

export type AlgorithmType = 'HMM' | 'MARKOV' | 'ENSEMBLE';

export interface MethodPerformanceStats {
  algorithm: AlgorithmType;
  label: string;
  burmeseLabel: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number; // percentage, e.g. 78.4
  streak: number; // positive for win streak, negative for loss streak
  last10: boolean[]; // history of last 10 outcomes (true = win, false = loss)
}

export type AllMethodsStats = Record<AlgorithmType, MethodPerformanceStats>;

export interface AutoSwitchEvent {
  fromAlgo: AlgorithmType;
  toAlgo: AlgorithmType;
  fromWinRate: number;
  toWinRate: number;
  reason: string;
  timestamp: number;
}

export interface HmmDetails {
  stateIndex: number;
  stateLabel: string;
  stateBurmese: string;
  pBig: number; // percentage, e.g. 78.4
  pSmall: number; // percentage, e.g. 21.6
  transitionLikelihood: number; // percentage, e.g. 84.2
  stateProbabilities: {
    state: string;
    label: string;
    prob: number;
  }[];
}

export interface PredictionResult {
  targetPeriod: string;
  size: DrawSize;
  sizeBurmese: string;
  color: 'RED' | 'GREEN' | 'VIOLET';
  colorBurmese: string;
  numbers: number[];
  confidence: number;
  pattern: string;
  algorithm: string;
  algorithmMode?: AlgorithmType;
  hmmDetails?: HmmDetails;
  riskLevel: string;
  suggestedMultipliers: string[];
  actualResult?: {
    number: number;
    size: DrawSize;
    color: DrawColor;
    isWin: boolean;
  };
}

export interface ShweAccount {
  phone: string;
  password?: string;
  isConnected: boolean;
  latencyMs: number;
  lastPing: number;
  targetUrl: string;
  userId?: string;
  nickName?: string;
  amount?: string;
}

export interface UserAccessState {
  isAdmin: boolean;
  timeCoins: number;
  remainingSeconds: number;
  unlimitedTime: boolean; // True for admin (bypasses all time limit)
}

export interface AutoMonitoringState {
  isActive: boolean;
  autoProfit: number;
  autoWins: number;
  autoLosses: number;
  currentAutoStake: number;
  autoBaseAmount: number;
  consecutiveLosses: number;
  autoMultiplierMode: number;
  winStopEnabled: boolean;
  winStopAmount: number;
  loseStopEnabled: boolean;
  loseStopAmount: number;
  stopReason: 'WIN_STOP' | 'LOSE_STOP' | 'INSUFFICIENT_BALANCE' | null;
  autoStrategy: 'AI_GUESS' | 'MANUAL_CHOICE' | 'WAIT_BOT';
  startTime: number | null;
  elapsedSeconds: number;
  targetReachedDuration: number | null; // Exact seconds taken to achieve target profit
}
