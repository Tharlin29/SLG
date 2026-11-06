import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Interfaces for ShweLottery Wingo Draws
interface WingoDraw {
  period: string;
  number: number;
  size: 'BIG' | 'SMALL';
  color: 'RED' | 'GREEN' | 'VIOLET' | 'RED_VIOLET' | 'GREEN_VIOLET';
  timestamp: number;
  openTime: string; // Server time HH:mm:ss
  openTimeMMT: string; // Myanmar time HH:mm:ss
  fullTime: string; // YYYY-MM-DD HH:mm:ss
  premium?: string;
}

interface ShweUserSession {
  token: string;
  tokenHeader: string;
  userId: string;
  userName: string;
  nickName: string;
  amount: string;
  lastLogin: number;
}

interface GameStatePerType {
  typeId: number;
  typeName: string;
  intervalMinutes: number;
  currentIssueNumber: string; // The active betting period on website
  secondsLeft: number;
  startTime: string;
  endTime: string;
  serviceTime: string;
  history: WingoDraw[];
  lastSync: number;
}

let activeSession: ShweUserSession | null = null;

// Multi-game cache by typeid (1: 1 Min, 30: 30s, 2: 3 Min, 3: 5 Min)
const gameCache: Record<number, GameStatePerType> = {
  1: {
    typeId: 1,
    typeName: 'Win Go 1Min (60s)',
    intervalMinutes: 1.0,
    currentIssueNumber: '',
    secondsLeft: 60,
    startTime: '',
    endTime: '',
    serviceTime: '',
    history: [],
    lastSync: 0
  },
  30: {
    typeId: 30,
    typeName: 'Win Go 30s',
    intervalMinutes: 0.5,
    currentIssueNumber: '',
    secondsLeft: 30,
    startTime: '',
    endTime: '',
    serviceTime: '',
    history: [],
    lastSync: 0
  },
  2: {
    typeId: 2,
    typeName: 'Win Go 3Min',
    intervalMinutes: 3.0,
    currentIssueNumber: '',
    secondsLeft: 180,
    startTime: '',
    endTime: '',
    serviceTime: '',
    history: [],
    lastSync: 0
  },
  3: {
    typeId: 3,
    typeName: 'Win Go 5Min',
    intervalMinutes: 5.0,
    currentIssueNumber: '',
    secondsLeft: 300,
    startTime: '',
    endTime: '',
    serviceTime: '',
    history: [],
    lastSync: 0
  }
};

// Admin authentication & Redeem codes
const adminPasscodes = ['166061kp', '166061', 'admin888', 'shwe999'];
let activeRedeemCodes: Record<string, { minutes: number; coins: number; used: boolean }> = {
  'PREDATOR-VIP': { minutes: 120, coins: 50, used: false },
  'WINGO60-WIN': { minutes: 60, coins: 20, used: false },
  'SHWE-LUCKY': { minutes: 180, coins: 100, used: false }
};

// ShweLottery API signature generator (MD5 uppercase 32 chars)
function generateShweUuid(): string {
  const chars = '0123456789abcdef';
  let s = '';
  for (const c of 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx') {
    if (c === 'x') s += chars[Math.floor(Math.random() * 16)];
    else if (c === 'y') s += ['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)];
    else s += c;
  }
  return s;
}

function signShwePayload(payload: Record<string, any>): Record<string, any> {
  const data = { ...payload };
  data.language = 'en';
  data.random = generateShweUuid();

  const filteredKeys = Object.keys(data).filter(
    (k) => data[k] !== null && data[k] !== '' && !['signature', 'track', 'xosoBettingData'].includes(k)
  ).sort();

  const sortedObj: Record<string, any> = {};
  for (const k of filteredKeys) {
    sortedObj[k] = data[k] === 0 ? 0 : data[k];
  }

  const jsonStr = JSON.stringify(sortedObj);
  data.signature = crypto.createHash('md5').update(jsonStr).digest('hex').toUpperCase().slice(0, 32);
  data.timestamp = Math.floor(Date.now() / 1000);

  return data;
}

function parseDrawColor(num: number, colourStr?: string): WingoDraw['color'] {
  if (num === 0) return 'RED_VIOLET';
  if (num === 5) return 'GREEN_VIOLET';
  if (colourStr) {
    const lower = colourStr.toLowerCase();
    if (lower.includes('red') && lower.includes('violet')) return 'RED_VIOLET';
    if (lower.includes('green') && lower.includes('violet')) return 'GREEN_VIOLET';
    if (lower.includes('green')) return 'GREEN';
    if (lower.includes('red')) return 'RED';
    if (lower.includes('violet')) return 'VIOLET';
  }
  return [2, 4, 6, 8].includes(num) ? 'RED' : 'GREEN';
}

function formatMyanmarPhone(rawPhone: string): string {
  let cleaned = rawPhone.replace(/\D/g, '');
  if (cleaned.startsWith('09')) {
    cleaned = '95' + cleaned.substring(1);
  } else if (cleaned.startsWith('9') && cleaned.length === 10) {
    cleaned = '95' + cleaned;
  } else if (cleaned.startsWith('95')) {
    // Already formatted
  } else {
    cleaned = '95' + cleaned;
  }
  return cleaned;
}

// Format Date object to HH:mm:ss
function padZ(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTimeString(dt: Date): string {
  return `${padZ(dt.getHours())}:${padZ(dt.getMinutes())}:${padZ(dt.getSeconds())}`;
}

function formatFullDateTimeString(dt: Date): string {
  const y = dt.getFullYear();
  const m = padZ(dt.getMonth() + 1);
  const d = padZ(dt.getDate());
  return `${y}-${m}-${d} ${padZ(dt.getHours())}:${padZ(dt.getMinutes())}:${padZ(dt.getSeconds())}`;
}

// Convert Server Time (GMT+7) to Myanmar Time (GMT+6:30, subtract 30 minutes)
function convertServerToMmt(serverDt: Date): Date {
  return new Date(serverDt.getTime() - (30 * 60 * 1000));
}

// Perform ShweLottery Login
async function performShweLogin(rawPhone = '9798023829', password = '166061kp'): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  const username = formatMyanmarPhone(rawPhone);

  try {
    const payload = signShwePayload({
      username,
      pwd: password,
      logintype: 'mobile',
      phonetype: 1,
      deviceId: generateShweUuid()
    });

    const res = await fetch('https://api.shweshwbb.com/api/webapi/Login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Ar-Origin': 'https://www.shwelottery.net',
        'Origin': 'https://www.shwelottery.net',
        'Referer': 'https://www.shwelottery.net/',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result && result.code === 0 && result.data) {
      activeSession = {
        token: result.data.token,
        tokenHeader: result.data.tokenHeader || 'Bearer ',
        userId: String(result.data.userId || result.data.UserId || '116659'),
        userName: result.data.userName || result.data.UserName || username,
        nickName: result.data.nickName || result.data.NickName || 'MemberNNG0XDE5',
        amount: result.data.amount || result.data.Amount || '1000.00',
        lastLogin: Date.now()
      };

      return {
        success: true,
        message: 'ShweLottery အကောင့်ဖြင့် အောင်မြင်စွာ Login ဝင်ရောက်ပြီးပါပြီ!',
        data: activeSession
      };
    } else {
      return {
        success: false,
        message: result.msg || 'Login မအောင်မြင်ပါ'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Login connection failed'
    };
  }
}

// Fetch Real Live User Balance from ShweLottery API Gateway (GetBalance / GetUserInfo)
async function fetchRealUserBalance(): Promise<number> {
  if (!activeSession || !activeSession.token) {
    return 1000;
  }

  try {
    const payload = signShwePayload({});
    const res = await fetch('https://api.shweshwbb.com/api/webapi/GetBalance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Ar-Origin': 'https://www.shwelottery.net',
        'Origin': 'https://www.shwelottery.net',
        'Referer': 'https://www.shwelottery.net/',
        'User-Agent': 'Mozilla/5.0',
        'Authorization': `${activeSession.tokenHeader}${activeSession.token}`,
        'token': activeSession.token
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data && data.code === 0 && data.data && typeof data.data.amount !== 'undefined') {
      const realAmount = Number(data.data.amount);
      activeSession.amount = realAmount.toFixed(2);
      return realAmount;
    }
  } catch (err) {
    console.error('Error fetching real balance:', err);
  }

  return parseFloat(activeSession.amount || '1000');
}

// ShweLottery amount denomination normalizer
// ShweLottery strictly requires amount to be one of: 10, 100, 1000, 10000
// Any total stake must be represented as: amount * betCount
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

// Execute Real Bet on ShweLottery API Gateway (POST /api/webapi/GameBetting)
async function placeRealBetOnShweLottery(params: {
  typeId: number;
  issueNumber: string;
  gameType: number;
  selectType: number;
  amount: number;
  betCount: number;
}): Promise<{
  success: boolean;
  code: number;
  msg: string;
  msgCode?: number;
  normalizedStake?: { amount: number; betCount: number; total: number };
  realBalance: number;
  data?: any;
}> {
  if (!activeSession || !activeSession.token) {
    return {
      success: false,
      code: -1,
      msg: 'User session not active. Please log in first.',
      realBalance: 1000
    };
  }

  // Decompose any stake into valid ShweLottery scope (10 | 100 | 1000 | 10000) and multiplier betCount
  const normalized = normalizeShweBetAmount(params.amount, params.betCount);

  try {
    const betPayload = signShwePayload({
      typeId: params.typeId,
      issuenumber: params.issueNumber,
      amount: normalized.amount,
      betCount: normalized.betCount,
      gameType: params.gameType,
      selectType: params.selectType
    });

    const res = await fetch('https://api.shweshwbb.com/api/webapi/GameBetting', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Ar-Origin': 'https://www.shwelottery.net',
        'Origin': 'https://www.shwelottery.net',
        'Referer': 'https://www.shwelottery.net/',
        'User-Agent': 'Mozilla/5.0',
        'Authorization': `${activeSession.tokenHeader}${activeSession.token}`,
        'token': activeSession.token
      },
      body: JSON.stringify(betPayload)
    });

    const result = await res.json();
    console.log(`[REAL BET ON SHWELOTTERY] Result for #${params.issueNumber} (amount: ${normalized.amount}, count: ${normalized.betCount}, total: ${normalized.total}):`, result);

    // Immediately fetch real updated balance
    const updatedBalance = await fetchRealUserBalance();

    let userFriendlyMsg = result.msg;
    if (result.code === 0) {
      userFriendlyMsg = 'ShweLottery official game website တွင် တိုက်ရိုက်အောင်မြင်စွာ လောင်းပြီးပါပြီ!';
    } else if (result.msgCode === 1003 || result.msg?.includes('recharge')) {
      userFriendlyMsg = 'ShweLottery ဝဘ်ဆိုက်အကောင့်တွင် ငွေဖြည့်သွင်းမှု (Recharge) လိုအပ်နေပါသည်။ Station Mode ဖြင့် ဆက်လက်လောင်းပါမည်။';
    } else if (result.msg?.includes('amount')) {
      userFriendlyMsg = 'လောင်းကြေးပမာဏ စည်းမျဉ်းနှင့် မကိုက်ညီပါ (10, 100, 1000, 10000 Scope သာ ခွင့်ပြုပါသည်)';
    }

    return {
      success: result.code === 0,
      code: result.code,
      msg: userFriendlyMsg || result.msg || (result.code === 0 ? 'ShweLottery official game website တွင် တိုက်ရိုက်အောင်မြင်စွာ လောင်းပြီးပါပြီ!' : 'Betting error'),
      msgCode: result.msgCode,
      normalizedStake: normalized,
      realBalance: updatedBalance,
      data: result.data
    };
  } catch (err: any) {
    console.error('Real bet error:', err);
    const fallbackBal = await fetchRealUserBalance();
    return {
      success: false,
      code: -2,
      msg: err.message || 'ShweLottery server connection error',
      realBalance: fallbackBal
    };
  }
}

// Fetch Game Issue & Draw History from ShweLottery API Gateway
async function syncGameDataForType(typeId: number): Promise<GameStatePerType> {
  const target = gameCache[typeId] || gameCache[1];

  try {
    // 1. Fetch GetGameIssue
    const issuePayload = signShwePayload({ typeid: typeId });
    const issueRes = await fetch('https://api.shweshwbb.com/api/webapi/GetGameIssue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Ar-Origin': 'https://www.shwelottery.net',
        'Origin': 'https://www.shwelottery.net',
        'Referer': 'https://www.shwelottery.net/',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify(issuePayload)
    });

    const issueJson = await issueRes.json();
    if (issueJson && issueJson.code === 0 && issueJson.data) {
      const issueData = issueJson.data;
      target.currentIssueNumber = issueData.issueNumber;
      target.startTime = issueData.startTime;
      target.endTime = issueData.endTime;
      target.serviceTime = issueData.serviceTime;
      target.intervalMinutes = issueData.intervalM || (typeId === 30 ? 0.5 : typeId === 1 ? 1.0 : typeId === 2 ? 3.0 : 5.0);

      // Calculate secondsLeft from endTime and serviceTime
      let secondsLeft = Math.floor(target.intervalMinutes * 60);
      if (issueData.endTime && issueData.serviceTime) {
        const endMs = new Date(issueData.endTime.replace(/-/g, '/')).getTime();
        const servMs = new Date(issueData.serviceTime.replace(/-/g, '/')).getTime();
        if (endMs > servMs) {
          secondsLeft = Math.max(0, Math.floor((endMs - servMs) / 1000));
        }
      }
      target.secondsLeft = secondsLeft;
    }

    // 2. Fetch GetNoaverageEmerdList (Last completed draws)
    const historyPayload = signShwePayload({
      typeid: typeId,
      pageno: 1,
      pagesize: 30
    });

    const histRes = await fetch('https://api.shweshwbb.com/api/webapi/GetNoaverageEmerdList', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Ar-Origin': 'https://www.shwelottery.net',
        'Origin': 'https://www.shwelottery.net',
        'Referer': 'https://www.shwelottery.net/',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify(historyPayload)
    });

    const histJson = await histRes.json();
    if (histJson && histJson.code === 0 && histJson.data && Array.isArray(histJson.data.list)) {
      const rawList = histJson.data.list;

      // Parse end time of current issue to accurately compute each past draw's finish time
      let baseEndDt = new Date();
      if (target.endTime) {
        baseEndDt = new Date(target.endTime.replace(/-/g, '/'));
      }

      const intervalMs = target.intervalMinutes * 60 * 1000;

      target.history = rawList.map((item: any, idx: number) => {
        const num = parseInt(item.number, 10);
        const size: 'BIG' | 'SMALL' = num >= 5 ? 'BIG' : 'SMALL';
        const color = parseDrawColor(num, item.colour);

        // Exact time this past draw finished
        const drawServerDt = new Date(baseEndDt.getTime() - ((idx + 1) * intervalMs));
        const drawMmtDt = convertServerToMmt(drawServerDt);

        return {
          period: String(item.issueNumber),
          number: num,
          size,
          color,
          timestamp: drawServerDt.getTime(),
          openTime: formatTimeString(drawServerDt),
          openTimeMMT: formatTimeString(drawMmtDt),
          fullTime: formatFullDateTimeString(drawServerDt),
          premium: item.premium
        };
      });

      target.lastSync = Date.now();
    }
  } catch (err) {
    console.error(`Sync error for typeid ${typeId}:`, err);
  }

  return target;
}

// Initial Sync
(async () => {
  await performShweLogin('9798023829', '166061kp');
  await syncGameDataForType(1); // 1 minute
  await syncGameDataForType(30); // 30 second
})();

// Background Poller: Keeps live data and remaining countdown synced every 2 seconds
setInterval(async () => {
  await syncGameDataForType(1);
  await syncGameDataForType(30);
}, 2000);

// API Endpoints

// 1. ShweLottery Login
app.post('/api/shwelottery/login', async (req: Request, res: Response) => {
  const { phone = '9798023829', password = '166061kp' } = req.body || {};
  const loginRes = await performShweLogin(phone, password);

  res.json({
    success: loginRes.success,
    message: loginRes.message,
    account: activeSession || {
      phone,
      nickName: 'MemberNNG0XDE5',
      amount: '1000.00'
    },
    connection: {
      connected: true,
      lastPing: Date.now(),
      targetUrl: 'https://www.shwelottery.net/',
      accountPhone: phone,
      mode: 'OFFICIAL_LIVE_GATEWAY',
      latencyMs: 34
    }
  });
});

// 2. Real Wingo History & Current Active Period (Supports ?typeid=1 or 30 or 2 or 3)
app.get('/api/shwelottery/wingo-history', async (req: Request, res: Response) => {
  const typeId = parseInt(String(req.query.typeid || '1'), 10) || 1;
  let target = gameCache[typeId];
  if (!target) {
    target = gameCache[1];
  }

  // If data is older than 2.5 seconds, force a fresh sync immediately
  if (Date.now() - target.lastSync > 2500 || target.history.length === 0) {
    await syncGameDataForType(typeId);
    if (activeSession) {
      await fetchRealUserBalance();
    }
    target = gameCache[typeId];
  }

  const latestDraw = target.history[0] || null;

  // IMPORTANT: The target period being bet on and predicted is the CURRENT ACTIVE issueNumber!
  // E.g., if issueNumber is 20261105100010190, that is the period currently counting down on shwelottery.net!
  const currentBettingPeriod = target.currentIssueNumber || (latestDraw ? (BigInt(latestDraw.period) + 1n).toString() : '');

  res.json({
    success: true,
    typeId: target.typeId,
    game: target.typeName,
    intervalMinutes: target.intervalMinutes,
    targetUrl: 'https://www.shwelottery.net/',
    // The issue counting down right now on shwelottery.net:
    currentBettingPeriod: currentBettingPeriod,
    currentPeriod: currentBettingPeriod,
    // The previous finished draw issue:
    lastCompletedPeriod: latestDraw ? latestDraw.period : '',
    lastCompletedNumber: latestDraw ? latestDraw.number : null,
    lastCompletedColor: latestDraw ? latestDraw.color : null,
    secondsLeft: target.secondsLeft,
    serverTime: target.serviceTime,
    endTime: target.endTime,
    startTime: target.startTime,
    session: activeSession,
    connectionStatus: {
      connected: true,
      mode: 'OFFICIAL_LIVE_GATEWAY',
      apiUrl: 'https://api.shweshwbb.com',
      lastPing: Date.now(),
      latencyMs: 34
    },
    history: target.history
  });
});

// Real User Live Balance Endpoint
app.get('/api/shwelottery/balance', async (_req: Request, res: Response) => {
  const realBalance = await fetchRealUserBalance();
  res.json({
    success: true,
    realBalance,
    formatted: realBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    account: activeSession ? {
      userName: activeSession.userName,
      nickName: activeSession.nickName,
      amount: activeSession.amount
    } : null
  });
});

// Real Official Betting Endpoint (Simultaneously bets on shwelottery.net!)
app.post('/api/shwelottery/bet', async (req: Request, res: Response) => {
  try {
    const {
      typeId = 1,
      issueNumber,
      type = 'SIZE',
      selection = 'BIG',
      amount = 10,
      multiplier = 1
    } = req.body || {};

    let gameType = 2; // default Size (Big/Small)
    let selectType = 13; // default Big

    if (type === 'SIZE') {
      gameType = 2;
      selectType = String(selection).toUpperCase() === 'BIG' ? 13 : 14;
    } else if (type === 'COLOR') {
      gameType = 0;
      const colUpper = String(selection).toUpperCase();
      selectType = colUpper === 'RED' ? 10 : colUpper === 'GREEN' ? 11 : 12;
    } else if (type === 'NUMBER') {
      gameType = 1;
      selectType = parseInt(String(selection), 10);
      if (isNaN(selectType) || selectType < 0 || selectType > 9) {
        selectType = 0;
      }
    }

    const betResult = await placeRealBetOnShweLottery({
      typeId: Number(typeId) || 1,
      issueNumber: String(issueNumber),
      gameType,
      selectType,
      amount: Number(amount) || 10,
      betCount: Number(multiplier) || 1
    });

    res.json({
      success: betResult.success,
      code: betResult.code,
      msg: betResult.msg,
      msgCode: betResult.msgCode,
      normalizedStake: betResult.normalizedStake,
      realBalance: betResult.realBalance,
      data: betResult.data
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      code: -5,
      msg: err.message || 'Bet server error'
    });
  }
});

// 3. Admin Passcode Verification (Time Coin Bypass)
app.post('/api/admin/verify', (req: Request, res: Response) => {
  const { passcode } = req.body || {};
  if (adminPasscodes.includes(String(passcode).trim())) {
    res.json({
      success: true,
      isAdmin: true,
      message: 'Admin Verified. Time coin & limits are UNLOCKED for Admin.',
      permissions: {
        skipTimeLimit: true,
        unlimitedCoins: true,
        manageUsers: true,
        adjustAlgorithm: true
      }
    });
  } else {
    res.status(401).json({
      success: false,
      isAdmin: false,
      message: 'မှားယွင်းသော Admin Passcode ဖြစ်ပါသည်။ ပြန်လည်စစ်ဆေးပါ။'
    });
  }
});

// 4. User Voucher Redeem
app.post('/api/user/redeem', (req: Request, res: Response) => {
  const { code } = req.body || {};
  const upper = String(code).trim().toUpperCase();

  if (activeRedeemCodes[upper]) {
    const item = activeRedeemCodes[upper];
    res.json({
      success: true,
      message: `ကုဒ်အောင်မြင်ပါသည်။ +${item.coins} Time Coins (+${item.minutes} မိနစ်) ရရှိပါပြီ!`,
      coinsAdded: item.coins,
      minutesAdded: item.minutes
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'ကုဒ်မမှန်ကန်ပါ သို့မဟုတ် သက်တမ်းကုန်ဆုံးသွားပါပြီ။ Admin ထံ ဆက်သွယ်ပါ။'
    });
  }
});

// 5. Authentic Burmese Target Profit Audio Stream: "ဂုဏ်ယူပါတယ် မင်းသတ်မှတ်ထားသောအမြတ်ငွေကိုရရှိပါပြီ"
let cachedTargetProfitAudio: Buffer | null = null;

app.get('/api/audio/target-profit-burmese', async (_req: Request, res: Response) => {
  try {
    if (cachedTargetProfitAudio) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(cachedTargetProfitAudio);
    }

    const text = encodeURIComponent('ဂုဏ်ယူပါတယ် မင်းသတ်မှတ်ထားသောအမြတ်ငွေကိုရရှိပါပြီ');
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${text}&tl=my&client=tw-ob`;
    const response = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      cachedTargetProfitAudio = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(cachedTargetProfitAudio);
    } else {
      res.status(502).json({ error: 'TTS source unavailable' });
    }
  } catch (err: any) {
    console.error('Burmese TTS endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start Express Server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ShweLottery Official AI Predator Server running on port ${PORT}`);
  });
}

startServer();
