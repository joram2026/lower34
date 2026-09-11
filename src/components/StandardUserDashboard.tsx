import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserAccount, Transaction, CryptoPrice, ArbitrageConfig, CopyTraderLead, UserCopyTrade, InAppAd } from '../types';
import { DEFAULT_COPY_LEADS, getLeadDailyProfitRange } from '../data/copyTraders';
import { DEFAULT_IN_APP_ADS } from '../data/defaultAds';
import { InAppAdPopupModal } from './InAppAdPopupModal';
import { useToast } from '../context/ToastContext';
import NewsCarousel from './NewsCarousel';
import ActivityLog from './ActivityLog';
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Search, 
  User, LogOut, ArrowRightLeft, ShieldCheck, Activity, Wallet, 
  HelpCircle, RefreshCw, Coins, ArrowRight, MessageSquare, AlertCircle,
  History, ArrowLeft, X, ChevronDown, ChevronRight, Check, Lock, Unlock, Eye, EyeOff, Sparkles, BookOpen, Zap, Send,
  Cpu, Play, Pause, Bot, Crown, Gift, ListFilter, CheckCircle, CheckCircle2, Users, Globe, Clock, Headphones, Share2,
  Copy, Calculator, Percent, Flame, ExternalLink, UserPlus, Tag
} from 'lucide-react';
import { RunningBotView } from './RunningBotView';
import { getTradingPairConfig, TradingPairBadge, DEFAULT_BOT_TRADING_PAIRS } from '../utils/pairUtils';
import { syncLiveCryptoPrices } from '../utils/cryptoApi';
import { getUserTimezoneInfo, formatSignalTimeForCountry } from '../utils/timezones';
import { ExpertAvatar } from './ExpertAvatar';
import { preloadTraderImages } from '../utils/imageUtils';
import { UpgradeRolloverModal } from './UpgradeRolloverModal';

interface StandardUserDashboardProps {
  user: any;
  onLogout: () => void;
  onOpenProfile: () => void;
  onOpenDeposit: (coinSymbol?: string) => void;
  onOpenSend: () => void;
  onOpenWithdraw: () => void;
  path: string;
  navigate: (path: string) => void;
}

const STATIC_CRYPTO: CryptoPrice[] = [
  { name: 'Tether', symbol: 'USDT', price: 1.00, change24h: 0.01, investmentRate: 2.5, winRate: 99.2 },
  { name: 'USD Coin', symbol: 'USDC', price: 1.00, change24h: -0.02, investmentRate: 2.5, winRate: 99.1 },
  { name: 'Bitcoin', symbol: 'BTC', price: 94250.30, change24h: 3.45, investmentRate: 3.5, winRate: 97.8 },
  { name: 'Ethereum', symbol: 'ETH', price: 3480.12, change24h: 1.82, investmentRate: 4.0, winRate: 96.5 },
  { name: 'Solana', symbol: 'SOL', price: 184.45, change24h: -2.15, investmentRate: 6.0, winRate: 95.8 },
  { name: 'Binance Coin', symbol: 'BNB', price: 592.20, change24h: 0.95, investmentRate: 4.5, winRate: 96.2 },
  { name: 'XRP', symbol: 'XRP', price: 2.54, change24h: 4.12, investmentRate: 3.0, winRate: 94.5 },
  { name: 'World Coin', symbol: 'WLD', price: 2.80, change24h: -1.25, investmentRate: 5.0, winRate: 93.8 },
  { name: 'Tron', symbol: 'TRX', price: 0.22, change24h: 0.45, investmentRate: 3.5, winRate: 95.2 },
  { name: 'DOGE Coin', symbol: 'DOGE', price: 0.38, change24h: 2.15, investmentRate: 7.0, winRate: 92.4 }
];

export const mergeWithDefaultRates = (rawPrices: CryptoPrice[]): CryptoPrice[] => {
  const defaultRates: Record<string, number> = {
    USDT: 2.5, USDC: 2.5, BTC: 3.5, ETH: 4.0, SOL: 6.0, BNB: 4.5, XRP: 3.0, WLD: 5.0, TRX: 3.5, DOGE: 7.0
  };
  const defaultWinRates: Record<string, number> = {
    USDT: 99.2, USDC: 99.1, BTC: 97.8, ETH: 96.5, SOL: 95.8, BNB: 96.2, XRP: 94.5, WLD: 93.8, TRX: 95.2, DOGE: 92.4
  };
  const order = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'WLD', 'TRX', 'DOGE'];

  const map = new Map<string, CryptoPrice>();
  STATIC_CRYPTO.forEach(item => map.set(item.symbol, { ...item }));

  if (Array.isArray(rawPrices) && rawPrices.length > 0) {
    rawPrices.forEach(item => {
      if (item && item.symbol) {
        const existing = map.get(item.symbol) || item;
        map.set(item.symbol, {
          ...existing,
          ...item,
          price: item.price !== undefined && item.price !== 0 ? item.price : (existing.price || 1.0),
          investmentRate: item.investmentRate ?? existing.investmentRate ?? defaultRates[item.symbol] ?? 5.0,
          winRate: item.winRate ?? existing.winRate ?? defaultWinRates[item.symbol] ?? 96.0,
        });
      }
    });
  }

  const result = Array.from(map.values());
  result.sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol));
  return result;
};

export const getCoinLogoUrl = (symbol: string): string => {
  const sym = symbol.toUpperCase();
  const mapping: Record<string, string> = {
    BTC: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
    ETH: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    USDT: 'https://assets.coingecko.com/coins/images/325/large/tether.png',
    USDC: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
    SOL: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
    BNB: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
    XRP: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
    WLD: 'https://assets.coingecko.com/coins/images/31075/large/worldcoin.jpeg',
    TRX: 'https://cryptologos.cc/logos/tron-trx-logo.png',
    DOGE: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png'
  };
  return mapping[sym] || `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${sym.toLowerCase()}.png`;
};

interface CoinIconProps {
  symbol: string;
  className?: string;
}

export function CoinIcon({ symbol, className = "w-9 h-9" }: CoinIconProps) {
  const [failed, setFailed] = useState(false);

  if (symbol && symbol.toUpperCase() === 'TRADED') {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white border border-emerald-400/40 shrink-0 shadow-xs`}>
        <Activity size={18} className="text-white" />
      </div>
    );
  }

  const logoUrl = getCoinLogoUrl(symbol);

  if (failed || !logoUrl) {
    return (
      <div className={`${className} rounded-xl bg-slate-950 flex items-center justify-center text-[10px] font-black text-emerald-400 border border-slate-850 uppercase font-mono shrink-0`}>
        {symbol.slice(0, 3)}
      </div>
    );
  }

  return (
    <div className={`${className} rounded-xl overflow-hidden bg-slate-950 border border-slate-850 flex items-center justify-center shrink-0`}>
      <img
        src={logoUrl}
        alt={symbol}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

interface CustomCoinSelectProps {
  value: string;
  onChange: (value: string) => void;
  coins: CryptoPrice[];
  isLightTheme?: boolean;
}

function CustomCoinSelect({ value, onChange, coins, isLightTheme = false }: CustomCoinSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedCoin = coins.find(c => c.symbol === value) || coins[0];

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = () => {
      setIsOpen(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  return (
    <div className="relative select-none" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-3.5 border rounded-2xl text-xs font-bold cursor-pointer transition-all focus:outline-none ${
          isLightTheme 
            ? 'bg-zinc-50/50 border-zinc-200 text-zinc-800 hover:border-amber-500/50 hover:bg-zinc-100/50 focus:border-amber-500'
            : 'bg-slate-950 border-slate-850 text-white hover:border-emerald-500/50 hover:bg-slate-900/40 focus:border-emerald-500'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <CoinIcon symbol={selectedCoin.symbol} className="w-5 h-5 rounded-md" />
          <div className="flex flex-col items-start leading-none gap-1">
            <span className={`font-extrabold text-xs ${isLightTheme ? 'text-zinc-800' : 'text-zinc-100'}`}>{selectedCoin.symbol}</span>
            <span className="text-[9px] text-zinc-500 font-bold">{selectedCoin.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-xs ${isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}`}>
            ${selectedCoin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </span>
          <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-200 ${isOpen ? (isLightTheme ? 'rotate-180 text-amber-500' : 'rotate-180 text-emerald-400') : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className={`absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto border rounded-2xl shadow-2xl z-50 scrollbar-thin scrollbar-track-transparent animate-fade-in ${
          isLightTheme 
            ? 'bg-white border-zinc-200 scrollbar-thumb-zinc-200' 
            : 'bg-slate-950 border-slate-850 scrollbar-thumb-slate-800'
        }`}>
          <div className="p-1.5 space-y-1">
            {coins.map((coin) => {
              const isSelected = coin.symbol === value;
              return (
                <button
                  key={coin.symbol}
                  type="button"
                  onClick={() => {
                    onChange(coin.symbol);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                    isSelected 
                      ? (isLightTheme ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20') 
                      : (isLightTheme ? 'text-zinc-700 hover:bg-zinc-100/80 hover:text-zinc-900' : 'text-zinc-300 hover:bg-slate-900/60 hover:text-white')
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <CoinIcon symbol={coin.symbol} className="w-5 h-5 rounded-md" />
                    <div className="flex flex-col leading-none gap-1">
                      <span className={isSelected ? (isLightTheme ? "text-amber-600 font-extrabold" : "text-emerald-400") : (isLightTheme ? "text-zinc-800" : "text-zinc-200")}>{coin.symbol}</span>
                      <span className="text-[9px] text-zinc-500 font-bold">{coin.name}</span>
                    </div>
                  </div>
                  <span className={`font-mono text-xs ${isLightTheme ? 'text-zinc-500 font-medium' : 'text-zinc-400'}`}>
                    ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface TradingPairSelectorProps {
  value: string;
  onChange: (value: string) => void;
  pairs: string[];
  isLightTheme?: boolean;
}

function TradingPairSelector({ value, onChange, pairs, isLightTheme = false }: TradingPairSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative select-none">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between pl-3.5 pr-4 py-3.5 rounded-xl border-2 text-xs sm:text-sm font-black font-mono cursor-pointer transition-all ${
          isLightTheme 
            ? 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-900 shadow-xs' 
            : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-white shadow-sm'
        } ${isOpen ? 'ring-4 ring-amber-500/20 border-amber-500' : ''}`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-black shrink-0 ${
            isLightTheme ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            {value.charAt(0)}
          </div>
          <span className="font-mono font-black text-xs sm:text-sm">{value}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 rounded-md ${
            isLightTheme ? 'bg-zinc-100 text-zinc-600' : 'bg-slate-900 text-zinc-400'
          }`}>
            SPOT
          </span>
          <ChevronDown size={18} className={`text-amber-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className={`absolute left-0 right-0 mt-1.5 p-1.5 rounded-xl border-2 shadow-2xl z-50 animate-in fade-in duration-150 ${
          isLightTheme 
            ? 'bg-white border-zinc-200 shadow-zinc-300/50' 
            : 'bg-slate-950 border-slate-800 shadow-black/80'
        }`}>
          <div className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 text-zinc-400 border-b border-zinc-100 dark:border-slate-850 mb-1 flex items-center justify-between">
            <span>Available Markets</span>
            <span>{pairs.length} Pairs</span>
          </div>

          <div className="space-y-1 max-h-52 overflow-y-auto">
            {pairs.map((pair) => {
              const isSelected = pair === value;
              const coinLetter = pair.charAt(0);
              return (
                <button
                  key={pair}
                  type="button"
                  onClick={() => {
                    onChange(pair);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-black font-mono transition-all text-left cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                      : isLightTheme
                        ? 'text-zinc-800 hover:bg-amber-50 hover:text-amber-950'
                        : 'text-zinc-200 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                      isSelected
                        ? 'bg-slate-950 text-amber-400'
                        : isLightTheme ? 'bg-zinc-100 text-zinc-700' : 'bg-slate-900 text-zinc-400'
                    }`}>
                      {coinLetter}
                    </div>
                    <span>{pair}</span>
                  </div>

                  {isSelected && (
                    <Check size={16} className="text-slate-950 font-black shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const generateChartPoints = (coinPrice: number, change: number, timeframe: string) => {
  const points = [];
  const isUp = change >= 0;
  const startFactor = isUp ? (1 - change / 100) : (1 + Math.abs(change) / 100);
  const startPrice = coinPrice * startFactor;
  
  let variance = 0.015;
  if (timeframe === '1H') variance = 0.003;
  if (timeframe === '1W') variance = 0.045;
  if (timeframe === '1M') variance = 0.12;

  for (let i = 0; i < 12; i++) {
    const progress = i / 11;
    const wave = Math.sin(progress * Math.PI * 1.8) * variance * startPrice * 0.4;
    const randomNoise = (Math.random() - 0.5) * variance * startPrice * 0.15;
    const priceAtPoint = (startPrice + (coinPrice - startPrice) * progress) + wave + randomNoise;
    points.push(Math.max(0.0001, priceAtPoint));
  }
  return points;
};

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
  volume?: number;
}

const TIMEFRAME_DURATIONS: Record<string, number> = {
  '1m': 60000,
  '5m': 300000,
  '1h': 3600000,
  '4h': 14400000
};

const generateCandleData = (coinPrice: number, change: number, timeframe: string): Candle[] => {
  const count = 24;
  const candles: Candle[] = [];
  const duration = TIMEFRAME_DURATIONS[timeframe] || 300000;
  const currentPeriodStart = Math.floor(Date.now() / duration) * duration;
  
  const isUp = change >= 0;
  const startFactor = isUp ? (1 - change / 100) : (1 + Math.abs(change) / 100);
  const startPrice = coinPrice * startFactor;
  
  let variance = 0.015;
  if (timeframe === '1m') variance = 0.002;
  if (timeframe === '5m') variance = 0.006;
  if (timeframe === '1h') variance = 0.02;
  if (timeframe === '4h') variance = 0.045;

  let currentPrice = startPrice;
  
  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1);
    const wave = Math.sin(progress * Math.PI * 1.5) * variance * startPrice * 0.3;
    const target = (startPrice + (coinPrice - startPrice) * progress) + wave;
    
    const open = currentPrice;
    let close = target + (Math.random() - 0.5) * variance * startPrice * 0.15;
    if (i === count - 1) {
      close = coinPrice;
    }
    
    const safeOpen = Math.max(0.0001, open);
    const safeClose = Math.max(0.0001, close);
    
    const bodyMax = Math.max(safeOpen, safeClose);
    const bodyMin = Math.min(safeOpen, safeClose);
    
    const high = bodyMax + Math.random() * variance * startPrice * 0.2;
    const low = Math.max(0.0001, bodyMin - Math.random() * variance * startPrice * 0.2);
    
    candles.push({
      open: parseFloat(safeOpen.toFixed(4)),
      high: parseFloat(high.toFixed(4)),
      low: parseFloat(low.toFixed(4)),
      close: parseFloat(safeClose.toFixed(4)),
      timestamp: currentPeriodStart - (count - 1 - i) * duration,
      volume: Math.floor(50 + Math.random() * 150)
    });
    
    currentPrice = safeClose;
  }
  
  return candles;
};

const formatCandleTime = (timestamp: number, tf: string): string => {
  const date = new Date(timestamp);
  const pad = (num: number) => num.toString().padStart(2, '0');
  if (tf === '1m' || tf === '5m') {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } else {
    return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
};

export default function StandardUserDashboard({ 
  user, 
  onLogout, 
  onOpenProfile, 
  onOpenDeposit, 
  onOpenSend,
  onOpenWithdraw,
  path,
  navigate
}: StandardUserDashboardProps) {
  
  // Toast Hook
  const toast = useToast();

  // Real-time state
  const [profile, setProfile] = useState<UserAccount | null>(null);
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);

  // Crypto MMF Investment states
  const [activeInvestments, setActiveInvestments] = useState<any[]>([]);
  const processingInvestmentsRef = useRef<Set<string>>(new Set());
  const [tradeMode, setTradeMode] = useState<'swap' | 'mmf'>('swap');
  const [tradeSubTab, setTradeSubTab] = useState<'arbitrage' | 'converter'>('arbitrage');
  const [tradeSubSection, setTradeSubSection] = useState<'bots' | 'converter'>('bots');
  const [botHubView, setBotHubView] = useState<'menu' | 'PREMIUM' | 'FREE' | 'HISTORY' | 'MY_BOTS'>('menu');
  const [userBots, setUserBots] = useState<any[]>([]);
  const [botTemplates, setBotTemplates] = useState<any[]>([]);
  const [selectedBotTemplate, setSelectedBotTemplate] = useState<any | null>(null);
  const [botCapitalInput, setBotCapitalInput] = useState<string>('');
  const [botCoinInput, setBotCoinInput] = useState<string>('USDT');
  const [botSelectedPair, setBotSelectedPair] = useState<string>('');
  const [isPairDropdownOpen, setIsPairDropdownOpen] = useState<boolean>(false);
  const [botDurationSeconds, setBotDurationSeconds] = useState<number>(60);
  const [botDeployLoading, setBotDeployLoading] = useState<boolean>(false);
  const [activeRunningBot, setActiveRunningBot] = useState<any | null>(null);
  const [mmfSubView, setMmfSubView] = useState<'main' | 'list' | 'form'>('main');
  const [selectedCoinForInvestment, setSelectedCoinForInvestment] = useState<CryptoPrice | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState<string>('');
  const [investmentDays, setInvestmentDays] = useState<string>('24');
  const [investmentLoading, setInvestmentLoading] = useState<boolean>(false);
  const [investmentErrorState, setInvestmentErrorState] = useState<string | null>(null);
  const [investmentSuccessState, setInvestmentSuccessState] = useState<string | null>(null);

  const setInvestmentError = (msg: string | null) => {
    setInvestmentErrorState(msg);
    if (msg) toast.error(msg, 'Investment Error');
  };
  const setInvestmentSuccess = (msg: string | null) => {
    setInvestmentSuccessState(msg);
    if (msg) toast.success(msg, 'Investment Success');
  };
  const investmentError = investmentErrorState;
  const investmentSuccess = investmentSuccessState;
  
  // Live fluctuating crypto prices state
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrice[]>(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return STATIC_CRYPTO.map(c => ({ ...c, price: 0, change24h: 0 }));
    }
    return STATIC_CRYPTO;
  });
  
  // Selected coin for high-fidelity interactive modal/chart details
  const [selectedCoin, setSelectedCoin] = useState<CryptoPrice | null>(null);
  const [chartTimeframe, setChartTimeframe] = useState<'1m' | '5m' | '1h' | '4h'>('5m');
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [isBalanceBlurred, setIsBalanceBlurred] = useState<boolean>(false);
  const [isEarnBalanceBlurred, setIsEarnBalanceBlurred] = useState<boolean>(false);
  const [earnDisplayMode, setEarnDisplayMode] = useState<'USD' | 'CRYPTO'>('USD');

  // Copy Trading Lead Experts & Active User Copy Trades states
  const [copyLeads, setCopyLeads] = useState<CopyTraderLead[]>([]);
  const [userCopyTrades, setUserCopyTrades] = useState<UserCopyTrade[]>([]);
  const [selectedLeadForCopy, setSelectedLeadForCopy] = useState<CopyTraderLead | null>(null);
  const [selectedContractForDetail, setSelectedContractForDetail] = useState<UserCopyTrade | null>(null);
  const [copyTradeStep, setCopyTradeStep] = useState<1 | 2 | 3>(1);
  const [copyTradePair, setCopyTradePair] = useState<string>('BTC/USDT');
  const [copyTradeAmountInput, setCopyTradeAmountInput] = useState<string>('50');
  const [copySignalCodeInput, setCopySignalCodeInput] = useState<string>('');
  const [isSubmittingCopy, setIsSubmittingCopy] = useState<boolean>(false);
  const [executionAnimStep, setExecutionAnimStep] = useState<number>(0);
  const [copyTradeViewTab, setCopyTradeViewTab] = useState<'contracts' | 'history'>('contracts');
  const [settledTradeReceipt, setSettledTradeReceipt] = useState<{
    leadName: string;
    leadPhotoUrl?: string;
    tradingPair: string;
    signalCode: string;
    tradedCapital: number;
    grossProfit: number;
    commissionCut: number;
    netProfit: number;
    commissionPct: number;
    newBalance: number;
    entryPrice: string;
    exitPrice: string;
    executedAt: string;
    leadObj?: CopyTraderLead;
  } | null>(null);

  // Trade Balance Transfer states (Transfer In / Transfer Out for Copy Signals)
  const [transferModalType, setTransferModalType] = useState<'IN' | 'OUT' | null>(null);
  const [transferAmountInput, setTransferAmountInput] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Upgrade Expert & Principal Rollover State
  const [upgradeModalData, setUpgradeModalData] = useState<{
    oldTrade: UserCopyTrade;
    targetLead: CopyTraderLead;
  } | null>(null);
  const [isSubmittingUpgrade, setIsSubmittingUpgrade] = useState<boolean>(false);

  // In-App Promotional Ads State
  const [inAppAdsList, setInAppAdsList] = useState<InAppAd[]>(DEFAULT_IN_APP_ADS);
  const [activePopupAd, setActivePopupAd] = useState<InAppAd | null>(null);

  // Helper to determine active signal window for expert (1 hour valid duration from start time)
  // Seamlessly handles both regular daily signals and standalone extra signals
  const [signalClockTick, setSignalClockTick] = useState<number>(Date.now());

  useEffect(() => {
    if (!selectedLeadForCopy) return;
    const timer = setInterval(() => {
      setSignalClockTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedLeadForCopy]);

  const getActiveSignalForLead = (lead: CopyTraderLead) => {
    const regularSignals = Array.isArray(lead.signals) ? lead.signals.map(s => ({ ...s, isExtra: false })) : [];
    const extraSignals = Array.isArray(lead.extraSignals) ? lead.extraSignals.map(es => ({ ...es, isExtra: true })) : [];
    const allSignals: { id?: string; time: string; code: string; isExtra?: boolean; profitRate?: number; label?: string }[] = [
      ...regularSignals,
      ...extraSignals
    ];
    if (allSignals.length === 0) return null;
    
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');

    // Get today's date in Kenya (Africa/Nairobi UTC+3)
    let kenyaDateParts: number[];
    try {
      kenyaDateParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Nairobi',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).format(now).split('/').map(Number);
    } catch {
      kenyaDateParts = [now.getMonth() + 1, now.getDate(), now.getFullYear()];
    }

    const m = pad(kenyaDateParts[0]);
    const d = pad(kenyaDateParts[1]);
    const y = kenyaDateParts[2];

    for (const sig of allSignals) {
      if (!sig.time) continue;
      const parts = sig.time.split(':');
      if (parts.length < 2) continue;
      const sigHour = parseInt(parts[0], 10);
      const sigMin = parseInt(parts[1], 10);
      if (isNaN(sigHour) || isNaN(sigMin)) continue;

      // ISO string representing signal start time in Kenya Time (UTC+03:00)
      const isoKenya = `${y}-${m}-${d}T${pad(sigHour)}:${pad(sigMin)}:00+03:00`;
      const sigStartMs = new Date(isoKenya).getTime();

      // 1 hour window = 3600000 ms
      if (now.getTime() >= sigStartMs && now.getTime() < sigStartMs + 3600000) {
        return sig;
      }
    }
    return null;
  };

  // Helper for live terminal status countdown & upcoming signal calculation
  const getLeadSignalWindowCountdown = (lead: CopyTraderLead) => {
    const regularSignals = Array.isArray(lead.signals) ? lead.signals.map(s => ({ ...s, isExtra: false })) : [];
    const extraSignals = Array.isArray(lead.extraSignals) ? lead.extraSignals.map(es => ({ ...es, isExtra: true })) : [];
    const allSignals: { id?: string; time: string; code: string; isExtra?: boolean; profitRate?: number; label?: string }[] = [
      ...regularSignals,
      ...extraSignals
    ];
    if (allSignals.length === 0) {
      return { isActive: false, activeSignal: null, nextSignal: null, countdownText: 'No Signals Scheduled', signalTime: '--:--', code: '' };
    }

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');

    let kenyaDateParts: number[];
    try {
      kenyaDateParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Nairobi',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).format(now).split('/').map(Number);
    } catch {
      kenyaDateParts = [now.getMonth() + 1, now.getDate(), now.getFullYear()];
    }

    const m = pad(kenyaDateParts[0]);
    const d = pad(kenyaDateParts[1]);
    const y = kenyaDateParts[2];

    // Check if active right now
    for (const sig of allSignals) {
      if (!sig.time) continue;
      const parts = sig.time.split(':');
      if (parts.length < 2) continue;
      const sigHour = parseInt(parts[0], 10);
      const sigMin = parseInt(parts[1], 10);
      if (isNaN(sigHour) || isNaN(sigMin)) continue;

      const isoKenya = `${y}-${m}-${d}T${pad(sigHour)}:${pad(sigMin)}:00+03:00`;
      const sigStartMs = new Date(isoKenya).getTime();
      const sigEndMs = sigStartMs + 3600000;

      if (now.getTime() >= sigStartMs && now.getTime() < sigEndMs) {
        const diffSecs = Math.max(0, Math.floor((sigEndMs - now.getTime()) / 1000));
        const remMins = Math.floor(diffSecs / 60);
        const remSecs = diffSecs % 60;
        return {
          isActive: true,
          activeSignal: sig,
          nextSignal: null,
          remainingMs: sigEndMs - now.getTime(),
          countdownText: `${remMins}m ${remSecs < 10 ? '0' : ''}${remSecs}s`,
          signalTime: sig.time,
          code: sig.code
        };
      }
    }

    // Find next upcoming signal
    let closestFutureMs = Infinity;
    let closestSig = allSignals[0];

    for (const sig of allSignals) {
      if (!sig.time) continue;
      const parts = sig.time.split(':');
      if (parts.length < 2) continue;
      const sigHour = parseInt(parts[0], 10);
      const sigMin = parseInt(parts[1], 10);
      if (isNaN(sigHour) || isNaN(sigMin)) continue;

      const todayIso = `${y}-${m}-${d}T${pad(sigHour)}:${pad(sigMin)}:00+03:00`;
      const todayMs = new Date(todayIso).getTime();
      if (todayMs > now.getTime() && todayMs < closestFutureMs) {
        closestFutureMs = todayMs;
        closestSig = sig;
      }
    }

    if (closestFutureMs === Infinity) {
      for (const sig of allSignals) {
        if (!sig.time) continue;
        const parts = sig.time.split(':');
        if (parts.length < 2) continue;
        const sigHour = parseInt(parts[0], 10);
        const sigMin = parseInt(parts[1], 10);
        if (isNaN(sigHour) || isNaN(sigMin)) continue;

        const tomorrow = new Date(now.getTime() + 24 * 3600000);
        let tomParts: number[];
        try {
          tomParts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Africa/Nairobi',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
          }).format(tomorrow).split('/').map(Number);
        } catch {
          tomParts = [tomorrow.getMonth() + 1, tomorrow.getDate(), tomorrow.getFullYear()];
        }
        const tomIso = `${tomParts[2]}-${pad(tomParts[0])}-${pad(tomParts[1])}T${pad(sigHour)}:${pad(sigMin)}:00+03:00`;
        const tomMs = new Date(tomIso).getTime();
        if (tomMs < closestFutureMs) {
          closestFutureMs = tomMs;
          closestSig = sig;
        }
      }
    }

    const diffSecs = Math.max(0, Math.floor((closestFutureMs - now.getTime()) / 1000));
    const hours = Math.floor(diffSecs / 3600);
    const mins = Math.floor((diffSecs % 3600) / 60);
    const secs = diffSecs % 60;

    return {
      isActive: false,
      activeSignal: null,
      nextSignal: closestSig,
      remainingMs: closestFutureMs - now.getTime(),
      countdownText: hours > 0 ? `${hours}h ${mins}m ${secs < 10 ? '0' : ''}${secs}s` : `${mins}m ${secs < 10 ? '0' : ''}${secs}s`,
      signalTime: closestSig?.time || '13:00',
      code: closestSig?.code || ''
    };
  };

  const handleCopyReferralLink = () => {
    const code = profile?.uniqueCode || profile?.referralSource || user?.uid?.substring(0, 8) || 'CME';
    const link = `${window.location.origin}/?ref=${code}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link);
    }
    toast.success('Referral link copied to clipboard! Share with friends to unlock 24h of Extra Signal access on their first deposit.', 'Referral Link Copied');
  };

  // Helper to check if a specific signal code or signal time has already been executed today by the user
  const isSignalExecutedToday = (lead: CopyTraderLead, signal: { time: string; code: string }) => {
    if (!lead || !signal || !userCopyTrades) return false;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return userCopyTrades.some((trade) => {
      const isSameLead = trade.leadId === lead.id || trade.leadName === lead.name;
      if (!isSameLead) return false;

      const targetCode = (signal.code || '').toUpperCase();

      // Check executedSignals array if available
      if (Array.isArray(trade.executedSignals) && trade.executedSignals.length > 0) {
        const found = trade.executedSignals.some((sigLog: any) => {
          const sigCode = (sigLog.code || '').toUpperCase();
          const isSameCodeOrTime = (targetCode && sigCode === targetCode) || sigLog.time === signal.time;
          if (!isSameCodeOrTime) return false;

          const sigDate = sigLog.executedAt?.seconds
            ? new Date(sigLog.executedAt.seconds * 1000)
            : new Date(sigLog.executedAt || 0);
          return sigDate >= todayStart;
        });
        if (found) return true;
      }

      // Check main trade fields (fallback)
      const tradeCode = (trade.signalCode || '').toUpperCase();
      const isSameSignal = (targetCode && tradeCode === targetCode) || trade.signalTime === signal.time;
      if (!isSameSignal) return false;

      const tradeDate = trade.createdAt?.seconds 
        ? new Date(trade.createdAt.seconds * 1000) 
        : new Date(trade.createdAt || 0);

      const updateDate = trade.updatedAt?.seconds
        ? new Date(trade.updatedAt.seconds * 1000)
        : trade.updatedAt
        ? new Date(trade.updatedAt)
        : tradeDate;

      return (tradeDate >= todayStart || updateDate >= todayStart);
    });
  };

  // Helper to merge active trades per lead expert so cards and modal show 100% identical stats
  const getMergedActiveContracts = (trades: UserCopyTrade[]): UserCopyTrade[] => {
    const activeList = (trades || []).filter(t => t.status === 'ACTIVE');
    const groupedMap: Record<string, UserCopyTrade> = {};

    activeList.forEach((trade) => {
      const key = trade.leadId || trade.leadName || trade.id;
      const sigs = Array.isArray(trade.executedSignals) && trade.executedSignals.length > 0
        ? trade.executedSignals
        : trade.signalCode ? [{ code: trade.signalCode, time: trade.signalTime, executedAt: trade.createdAt || new Date().toISOString() }] : [];

      if (!groupedMap[key]) {
        groupedMap[key] = { 
          ...trade, 
          executedSignals: [...sigs] 
        };
      } else {
        const existing = groupedMap[key];
        existing.netProfit = parseFloat(((existing.netProfit || 0) + (trade.netProfit || 0)).toFixed(2));
        existing.grossProfit = parseFloat(((existing.grossProfit || 0) + (trade.grossProfit || 0)).toFixed(2));
        existing.commissionDeducted = parseFloat(((existing.commissionDeducted || 0) + (trade.commissionDeducted || 0)).toFixed(2));
        existing.contractCapital = Math.max(existing.contractCapital || 0, trade.contractCapital || trade.amount || 0);
        existing.amount = Math.max(existing.amount || 0, trade.amount || trade.contractCapital || 0);
        existing.executedSignals = [...(existing.executedSignals || []), ...sigs];
      }
    });

    return Object.values(groupedMap);
  };

  // Check if routed to view a specific active contract (e.g. from withdrawal workflow)
  useEffect(() => {
    const contractToOpen = localStorage.getItem('view_active_contract_id');
    if (contractToOpen && userCopyTrades && userCopyTrades.length > 0) {
      const activeContracts = getMergedActiveContracts(userCopyTrades);
      let target: UserCopyTrade | undefined;
      if (contractToOpen !== 'any') {
        target = activeContracts.find(t => t.id === contractToOpen || t.leadId === contractToOpen || t.leadName === contractToOpen)
          || userCopyTrades.find(t => t.id === contractToOpen || t.leadId === contractToOpen || t.leadName === contractToOpen);
      }
      const contractToShow = target || activeContracts[0] || userCopyTrades.find(t => (t.status || '').toString().trim().toUpperCase() === 'ACTIVE') || userCopyTrades[0];
      if (contractToShow) {
        setSelectedContractForDetail(contractToShow);
        setActiveTab('earn');
      }
      localStorage.removeItem('view_active_contract_id');
    }
  }, [userCopyTrades, path]);

  // Helper to calculate locked contract capital and free transferrable amount on copy trading
  const getCopyTradeLockedAndFree = () => {
    const tradeBal = profile?.tradeBalance ?? 0;
    const activeContractCapitalByLead: Record<string, number> = {};

    const mergedTrades = getMergedActiveContracts(userCopyTrades);
    mergedTrades.forEach((trade) => {
      const leadKey = trade.leadId || trade.leadName || 'default-lead';
      const capital = trade.contractCapital || trade.amount || 0;
      if (capital > 0) {
        const contract = getContractProgressDetails(trade);
        if (!contract.isUnlocked && trade.status === 'ACTIVE') {
          activeContractCapitalByLead[leadKey] = Math.max(
            activeContractCapitalByLead[leadKey] || 0,
            capital
          );
        }
      }
    });

    const rawLockedCapital = Object.values(activeContractCapitalByLead).reduce((a, b) => a + b, 0);
    const lockedCapital = Math.min(rawLockedCapital, tradeBal);
    const freeTransferrable = Math.max(0, tradeBal - lockedCapital);

    return { lockedCapital, freeTransferrable, activeContractCapitalByLead, rawLockedCapital };
  };

  // Helper to calculate contract progress details for active copy trades
  const getContractProgressDetails = (trade: UserCopyTrade) => {
    const durationDays = trade.contractDurationDays || 30;
    const startDate = trade.contractStartDate?.seconds 
      ? new Date(trade.contractStartDate.seconds * 1000) 
      : trade.createdAt?.seconds 
      ? new Date(trade.createdAt.seconds * 1000) 
      : new Date(trade.createdAt || Date.now());

    const now = new Date();

    // Determine signals per day for this lead trader
    const lead = copyLeads.find(l => l.id === trade.leadId || l.name === trade.leadName) 
      || DEFAULT_COPY_LEADS.find(l => l.id === trade.leadId || l.name === trade.leadName);
    const numSignalsPerDay = Math.max(1, lead?.signals?.length || 2);

    // Get executed signals list
    const executedSignalsList = Array.isArray(trade.executedSignals) && trade.executedSignals.length > 0
      ? trade.executedSignals
      : trade.signalCode
      ? [{ code: trade.signalCode, time: trade.signalTime, executedAt: trade.createdAt || new Date().toISOString() }]
      : [];
    
    const executedCount = executedSignalsList.length;

    // 1 workday is complete when a user has executed the signal codes of that day (numSignalsPerDay signal codes)
    const workdaysElapsed = Math.min(
      durationDays,
      Math.floor(executedCount / numSignalsPerDay)
    );

    const workdaysRemaining = Math.max(0, durationDays - workdaysElapsed);
    const progressPct = Math.min(100, Math.round((workdaysElapsed / durationDays) * 100));
    const isUnlocked = workdaysElapsed >= durationDays;

    // Calculate target completion date (adding durationDays workdays, Monday to Saturday, skipping Sundays)
    let targetEndDate = new Date(startDate);
    let daysAdded = 0;
    while (daysAdded < durationDays) {
      targetEndDate.setDate(targetEndDate.getDate() + 1);
      if (targetEndDate.getDay() !== 0) { // Sunday is 0, Monday-Saturday are 1-6
        daysAdded++;
      }
    }

    // Time remaining calculations
    const diffMs = targetEndDate.getTime() - now.getTime();
    const hoursRemainingTotal = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
    const daysRemainingCalendar = Math.floor(hoursRemainingTotal / 24);
    const hoursRemainingModulo = hoursRemainingTotal % 24;

    return {
      durationDays,
      startDate,
      targetEndDate,
      workdaysElapsed,
      workdaysRemaining,
      progressPct,
      isUnlocked,
      daysRemainingCalendar,
      hoursRemainingModulo
    };
  };

  // Helper to determine if the user is eligible for Extra Signals:
  // 1. New User Welcome Boost: First 3 days (72h) from active contract start
  // 2. Referral First-Deposit Pass: Unlocked for 24h from a referred user's first deposit (extraSignalPassUntil > now)
  const getExtraSignalEligibility = (lead?: CopyTraderLead | null) => {
    const now = Date.now();

    // 1. Check New User Contract Boost (First 3 Days = 72 hours)
    let contractTrade: UserCopyTrade | undefined;
    if (lead) {
      contractTrade = userCopyTrades.find(
        t => (t.leadId === lead.id || t.leadName === lead.name) && t.status === 'ACTIVE'
      );
    }
    if (!contractTrade) {
      contractTrade = userCopyTrades.find(t => t.status === 'ACTIVE');
    }

    if (contractTrade) {
      // Use original welcome boost initial date if this contract was upgraded from an earlier contract
      const rawBoostDate = contractTrade.welcomeBoostInitialDate 
        || contractTrade.originalContractStartDate 
        || contractTrade.contractStartDate 
        || contractTrade.createdAt;

      const startMs = rawBoostDate?.seconds
        ? rawBoostDate.seconds * 1000
        : rawBoostDate?.toMillis
        ? rawBoostDate.toMillis()
        : new Date(rawBoostDate || Date.now()).getTime();

      const elapsedMs = now - startMs;
      const seventyTwoHoursMs = 72 * 60 * 60 * 1000;
      if (elapsedMs >= 0 && elapsedMs < seventyTwoHoursMs) {
        const remainingMs = seventyTwoHoursMs - elapsedMs;
        const hoursLeft = Math.ceil(remainingMs / (1000 * 60 * 60));
        const dayNumber = Math.min(3, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)) + 1);
        return {
          eligible: true,
          reason: 'new_user_boost' as const,
          hoursLeft,
          dayNumber,
          badgeText: `3-Day Welcome Boost (Day ${dayNumber}/3 • ${hoursLeft}h left)`,
          description: 'You are within the 3-day welcome window from your contract start. All high-yield Extra Signals are unlocked!'
        };
      }
    }

    // 2. Check Referral First-Deposit 24h Pass
    const extraPass = (profile as any)?.extraSignalPassUntil;
    if (extraPass) {
      const passExpiryMs = extraPass.seconds
        ? extraPass.seconds * 1000
        : extraPass.toMillis
        ? extraPass.toMillis()
        : new Date(extraPass).getTime();

      if (passExpiryMs > now) {
        const remainingMs = passExpiryMs - now;
        const hoursLeft = Math.ceil(remainingMs / (1000 * 60 * 60));
        return {
          eligible: true,
          reason: 'referral_boost' as const,
          hoursLeft,
          dayNumber: 0,
          badgeText: `24h Referral Boost Active (${hoursLeft}h left)`,
          description: 'Unlocked for 24 hours from your referral completing their first deposit!'
        };
      }
    }

    // 3. Locked
    return {
      eligible: false,
      reason: 'locked' as const,
      hoursLeft: 0,
      dayNumber: 0,
      badgeText: 'Extra Signal Locked',
      description: 'Unlocked for the first 3 days of your contract, or for 24h whenever someone you referred makes their first deposit.'
    };
  };

  const getWalletBalance = (prof?: UserAccount | null): number => {
    if (!prof) return 0;
    if (typeof prof.balance === 'number' && !isNaN(prof.balance)) {
      return prof.balance;
    }
    if (typeof prof.usdtBalance === 'number' && !isNaN(prof.usdtBalance)) {
      return prof.usdtBalance;
    }
    return 0;
  };

  const handleConfirmTransferIn = async () => {
    const amount = parseFloat(transferAmountInput);
    const walletBal = getWalletBalance(profile);
    if (!amount || isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid transfer amount greater than 0.', 'Invalid Amount');
      return;
    }
    if (amount > walletBal) {
      toast.error(`Insufficient wallet balance. You have $${walletBal.toFixed(2)} available in your system wallet.`, 'Insufficient Funds');
      return;
    }

    setIsTransferring(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const newWalletBal = Math.max(0, walletBal - amount);
      const currentTradeBal = profile?.tradeBalance ?? 0;
      const newTradeBal = currentTradeBal + amount;

      await updateDoc(userRef, {
        balance: parseFloat(newWalletBal.toFixed(2)),
        usdtBalance: parseFloat(newWalletBal.toFixed(2)),
        tradeBalance: parseFloat(newTradeBal.toFixed(2))
      });

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email || '',
        type: 'trade_balance_transfer_in',
        amount: amount,
        status: 'APPROVED',
        createdAt: new Date(),
        paymentMessage: `Transferred $${amount.toFixed(2)} USD from Wallet Balance to Trade Balance`
      });

      toast.success(`Successfully transferred $${amount.toFixed(2)} USD into your Trade Balance!`, 'Transfer Complete');
      setTransferModalType(null);
      setTransferAmountInput('');
    } catch (err: any) {
      console.error('Transfer in error:', err);
      toast.error(`Failed to complete transfer: ${err.message}`, 'Transfer Error');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleConfirmTransferOut = async () => {
    const amount = parseFloat(transferAmountInput);
    const tradeBal = profile?.tradeBalance ?? 0;
    if (!amount || isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid transfer amount greater than 0.', 'Invalid Amount');
      return;
    }
    if (amount > tradeBal) {
      toast.error(`Insufficient trade balance. You have $${tradeBal.toFixed(2)} in your trade balance.`, 'Insufficient Funds');
      return;
    }

    const { lockedCapital, freeTransferrable } = getCopyTradeLockedAndFree();

    if (amount > freeTransferrable) {
      toast.error(
        `Cannot transfer out locked contract capital ($${lockedCapital.toFixed(2)}) until the contract duration is complete. Maximum available to transfer out is $${freeTransferrable.toFixed(2)}.`,
        'Capital Locked'
      );
      return;
    }

    setIsTransferring(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const currentWalletBal = getWalletBalance(profile);
      const newWalletBal = currentWalletBal + amount;
      const newTradeBal = Math.max(0, tradeBal - amount);

      await updateDoc(userRef, {
        balance: parseFloat(newWalletBal.toFixed(2)),
        usdtBalance: parseFloat(newWalletBal.toFixed(2)),
        tradeBalance: parseFloat(newTradeBal.toFixed(2))
      });

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email || '',
        type: 'trade_balance_transfer_out',
        amount: amount,
        status: 'APPROVED',
        createdAt: new Date(),
        paymentMessage: `Transferred $${amount.toFixed(2)} USD from Trade Balance to Wallet Balance`
      });

      toast.success(`Successfully transferred $${amount.toFixed(2)} USD from Trade Balance back to Wallet Balance!`, 'Transfer Complete');
      setTransferModalType(null);
      setTransferAmountInput('');
    } catch (err: any) {
      console.error('Transfer out error:', err);
      toast.error(`Failed to complete transfer: ${err.message}`, 'Transfer Error');
    } finally {
      setIsTransferring(false);
    }
  };

  // Active Coin for Dedicated Quick Arbitrage Guide Page
  const [arbitrageGuideCoin, setArbitrageGuideCoin] = useState<{
    symbol: string;
    name: string;
    price: number;
    spreadPct: number;
    extMin: number;
    extMax: number;
    platforms: string[];
  } | null>(null);

  // Live Persistent Candlestick Engine
  const [candlesCache, setCandlesCache] = useState<Record<string, Candle[]>>({});

  // Initialize cache if missing
  useEffect(() => {
    if (!selectedCoin) return;
    const liveCoin = cryptoPrices.find(c => c.symbol === selectedCoin.symbol) || selectedCoin;
    const tf = chartTimeframe;
    const cacheKey = `${liveCoin.symbol}-${tf}`;

    setCandlesCache(prev => {
      if (prev[cacheKey]) return prev;
      const baseCandles = generateCandleData(liveCoin.price, liveCoin.change24h, tf);
      return {
        ...prev,
        [cacheKey]: baseCandles
      };
    });
  }, [selectedCoin?.symbol, chartTimeframe]);

  // Real-time wall-clock precision candlestick tracker and ticker
  useEffect(() => {
    const interval = setInterval(() => {
      if (!selectedCoin) return;
      const liveCoin = cryptoPrices.find(c => c.symbol === selectedCoin.symbol) || selectedCoin;
      const tf = chartTimeframe;
      const cacheKey = `${liveCoin.symbol}-${tf}`;
      const duration = TIMEFRAME_DURATIONS[tf] || 300000;
      const now = Date.now();
      const currentPeriodStart = Math.floor(now / duration) * duration;

      setCandlesCache(prev => {
        const existing = prev[cacheKey];
        if (!existing) {
          const baseCandles = generateCandleData(liveCoin.price, liveCoin.change24h, tf);
          return {
            ...prev,
            [cacheKey]: baseCandles
          };
        }

        const updated = [...existing];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0) {
          const last = updated[lastIdx];
          
          if (last.timestamp < currentPeriodStart) {
            // Timeframes rule: Once time expires, the active candle closes, and we open a new one
            const prevClose = last.close;
            const newCandle: Candle = {
              open: prevClose,
              high: Math.max(prevClose, liveCoin.price),
              low: Math.min(prevClose, liveCoin.price),
              close: liveCoin.price,
              timestamp: currentPeriodStart,
              volume: Math.floor(50 + Math.random() * 150)
            };
            updated.push(newCandle);
            if (updated.length > 24) {
              updated.shift();
            }
          } else {
            // Live feedback: update high, low, close of the active candle in real-time
            const newClose = liveCoin.price;
            const newHigh = Math.max(last.high, newClose);
            const newLow = Math.min(last.low, newClose);
            updated[lastIdx] = {
              ...last,
              high: parseFloat(newHigh.toFixed(4)),
              low: parseFloat(newLow.toFixed(4)),
              close: parseFloat(newClose.toFixed(4))
            };
          }
        }
        return {
          ...prev,
          [cacheKey]: updated
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedCoin?.symbol, chartTimeframe, cryptoPrices]);
  const [quickTradeType, setQuickTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [quickTradeAmount, setQuickTradeAmount] = useState<string>('');
  const [tradeMessageState, setTradeMessageState] = useState<{ text: string; isError: boolean } | null>(null);
  const setTradeMessage = (msg: { text: string; isError: boolean } | null) => {
    setTradeMessageState(msg);
    if (msg) {
      if (msg.isError) toast.error(msg.text, 'Trade Error');
      else toast.success(msg.text, 'Trade Executed');
    }
  };
  const tradeMessage = tradeMessageState;
  const [tradeLoading, setTradeLoading] = useState(false);

  // Bottom Sticky Nav Tab
  const [activeTab, setActiveTab] = useState<'home' | 'wallet' | 'trade' | 'history' | 'earn'>('home');
  
  // Sync bottom tab selection with current path
  useEffect(() => {
    if (path === '/wallet') {
      setActiveTab('wallet');
    } else if (path === '/trade') {
      setActiveTab('trade');
    } else if (path === '/earn') {
      setActiveTab('earn');
    } else if (path === '/history') {
      setActiveTab('history');
    } else {
      setActiveTab('home');
    }
  }, [path]);

  const handleTabChange = (tabId: 'home' | 'wallet' | 'trade' | 'history' | 'earn') => {
    setActiveTab(tabId);
    setArbitrageGuideCoin(null);
    if (tabId === 'home') {
      navigate('/dashboard');
    } else {
      navigate(`/${tabId}`);
    }
  };
  
  // UI States
  const isLightTheme = true;
  const [searchQuery, setSearchQuery] = useState('');
  const [userLoaded, setUserLoaded] = useState(false);
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [isUsingFallbackPrices, setIsUsingFallbackPrices] = useState(false);
  const [pricesLoadError, setPricesLoadError] = useState<string | null>(null);
  const [isDraggingSupport, setIsDraggingSupport] = useState(false);
  const dragStartTimeRef = useRef<number>(0);

  const loading = !userLoaded || (!pricesLoaded && !isUsingFallbackPrices);

  // Helper to re-fetch crypto prices from Firestore backend & trigger sync
  const refetchPricesFromBackend = async () => {
    try {
      const pricesCol = collection(db, 'crypto_prices');
      const snap = await getDocs(pricesCol);
      if (!snap.empty) {
        const fetched = snap.docs.map(doc => doc.data() as CryptoPrice);
        setCryptoPrices(mergeWithDefaultRates(fetched));
        setPricesLoaded(true);
        setIsUsingFallbackPrices(false);
        setPricesLoadError(null);
      }
      syncLiveCryptoPrices(db).catch(console.error);
    } catch (err) {
      console.warn("Failed to refetch prices on network recovery:", err);
    }
  };

  // Re-fetch prices when entering the SIGNALS / earn tab
  useEffect(() => {
    if (activeTab === 'earn') {
      refetchPricesFromBackend();
    }
  }, [activeTab]);

  // Safety timeout to avoid getting stuck if Firestore prices fetch is slow or blocked
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!pricesLoaded) {
        console.warn("Crypto prices fetch timed out. Falling back to default offline prices.");
        setIsUsingFallbackPrices(true);
        setPricesLoadError("Network latency detected. Displaying offline rates.");
        setCryptoPrices(mergeWithDefaultRates(STATIC_CRYPTO));
      }
    }, 10000); // 10 seconds timeout

    return () => clearTimeout(timer);
  }, [pricesLoaded]);

  // Listen to network status (online/offline)
  useEffect(() => {
    let wasOffline = false;

    const handleOnline = () => {
      refetchPricesFromBackend();
      if (wasOffline) {
        toast.success('Connection restored! Re-synced live rates from server.', 'Online');
        wasOffline = false;
      }
    };
    const handleOffline = () => {
      wasOffline = true;
      setIsUsingFallbackPrices(true);
      toast.warning('No internet connection. Offline mode activated.', 'Offline');
      setCryptoPrices(mergeWithDefaultRates(STATIC_CRYPTO));
    };
    const handleFocus = () => {
      // Quietly refresh rates on focus without spamming toasts
      refetchPricesFromBackend();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      window.addEventListener('focus', handleFocus);
      if (!navigator.onLine) {
        handleOffline();
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, []);

  // Arbitrage Config State
  const [arbitrageConfig, setArbitrageConfig] = useState<ArbitrageConfig | null>(null);

  // Arbitrage Calculator input states
  const [arbAmount1, setArbAmount1] = useState('0.5');
  const [arbAmount2, setArbAmount2] = useState('5.0');

  // Quick Trade state (simulation in trade tab)
  const [tradeFrom, setTradeFrom] = useState('BTC');
  const [tradeTo, setTradeTo] = useState('USDT');
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeResult, setTradeResult] = useState<number | null>(null);

  // Real-time listener for Firestore profile, transactions & crypto prices
  useEffect(() => {
    const userRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        setProfile(snapshot.data() as UserAccount);
      }
      setUserLoaded(true);
    }, (err) => {
      console.error("Error listening to user doc:", err);
      setUserLoaded(true);
    });

    const txCol = collection(db, 'transactions');
    const q = query(txCol, where('userId', '==', user.uid));
    const unsubscribeTx = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
      txs.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      setUserTransactions(txs);
    });

    const pricesCol = collection(db, 'crypto_prices');
    const unsubscribePrices = onSnapshot(pricesCol, (snapshot) => {
      if (!snapshot.empty) {
        const fetched = snapshot.docs.map(doc => doc.data() as CryptoPrice);
        setCryptoPrices(mergeWithDefaultRates(fetched));
        setPricesLoaded(true);
        setIsUsingFallbackPrices(false);
        setPricesLoadError(null);
      } else {
        setIsUsingFallbackPrices(true);
        setPricesLoadError("No live prices found in database. Using default rates.");
        setCryptoPrices(mergeWithDefaultRates(STATIC_CRYPTO));
      }
    }, (err) => {
      console.error("Error listening to crypto prices:", err);
      setIsUsingFallbackPrices(true);
      setPricesLoadError("Failed to fetch live prices from server. Using default rates.");
      setCryptoPrices(mergeWithDefaultRates(STATIC_CRYPTO));
    });

    const invCol = collection(db, 'investments');
    const invQuery = query(invCol, where('userId', '==', user.uid));
    const unsubscribeInvestments = onSnapshot(invQuery, (snapshot) => {
      const invs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
      // Sort MMF investments by creation date (newest/recently done first)
      invs.sort((a, b) => {
        const aTime = a.createdAt?.seconds 
          ? a.createdAt.seconds * 1000 
          : a.createdAt?.toDate 
            ? a.createdAt.toDate().getTime() 
            : new Date(a.createdAt || 0).getTime();
        const bTime = b.createdAt?.seconds 
          ? b.createdAt.seconds * 1000 
          : b.createdAt?.toDate 
            ? b.createdAt.toDate().getTime() 
            : new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setActiveInvestments(invs);
    });

    // Real-time listener for Arbitrage config
    const arbDocRef = doc(db, 'settings', 'arbitrage_config');
    const unsubscribeArbitrage = onSnapshot(arbDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setArbitrageConfig(snapshot.data() as ArbitrageConfig);
      } else {
        setArbitrageConfig({
          coin1Symbol: 'BTC',
          coin1ExternalMin: 91500,
          coin1ExternalMax: 92500,
          coin1UseLiveOffset: true,
          coin1OffsetPercentage: 2.5,
          coin2Symbol: 'ETH',
          coin2ExternalMin: 3350,
          coin2ExternalMax: 3410,
          coin2UseLiveOffset: true,
          coin2OffsetPercentage: 2.8,
          platformsList: ['Binance', 'Bybit', 'OKX', 'Coinbase']
        });
      }
    }, (err) => {
      console.error("Error listening to arbitrage config:", err);
    });

    const botsCol = collection(db, 'user_bots');
    const botsQuery = query(botsCol, where('userId', '==', user.uid));
    const unsubscribeBots = onSnapshot(botsQuery, (snapshot) => {
      const bots = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
      bots.sort((a, b) => {
        const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setUserBots(bots);
    });

    const unsubscribeTemplates = onSnapshot(collection(db, 'bot_templates'), (snapshot) => {
      const tpls = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
      tpls.sort((a, b) => {
        const capA = Number(a.minCapital ?? a.min_capital ?? a.minDeposit ?? a.capital ?? 0);
        const capB = Number(b.minCapital ?? b.min_capital ?? b.minDeposit ?? b.capital ?? 0);
        return capA - capB;
      });
      setBotTemplates(tpls);
    });

    // Real-time listener for Copy Trader Leads
    const copyLeadsCol = collection(db, 'copy_trader_leads');
    const unsubscribeCopyLeads = onSnapshot(copyLeadsCol, (snapshot) => {
      let leads = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CopyTraderLead));
      if (leads.length === 0) {
        leads = [...DEFAULT_COPY_LEADS];
      }
      setCopyLeads(leads);
      preloadTraderImages(leads.map(l => l.photoUrl));
    }, (err) => {
      console.error("Error fetching copy trader leads:", err);
      setCopyLeads([...DEFAULT_COPY_LEADS]);
      preloadTraderImages(DEFAULT_COPY_LEADS.map(l => l.photoUrl));
    });

    // Real-time listener for User Copy Trades
    const copyTradesCol = collection(db, 'user_copy_trades');
    const copyTradesQuery = query(copyTradesCol, where('userId', '==', user.uid));
    const unsubscribeCopyTrades = onSnapshot(copyTradesQuery, (snapshot) => {
      const trades = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as UserCopyTrade));
      trades.sort((a, b) => {
        const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setUserCopyTrades(trades);
    }, (err) => {
      console.error("Error fetching user copy trades:", err);
    });

    // Real-time listener for In-App Promotional Ads
    const adsCol = collection(db, 'in_app_ads');
    const unsubscribeAds = onSnapshot(adsCol, (snapshot) => {
      let fetchedAds = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as InAppAd));
      if (fetchedAds.length === 0) {
        fetchedAds = [...DEFAULT_IN_APP_ADS];
      }
      fetchedAds.sort((a, b) => (a.priority || 99) - (b.priority || 99));
      setInAppAdsList(fetchedAds);

      // Check for eligible popup ad if not dismissed today
      const todayDate = new Date().toISOString().split('T')[0];
      const dismissedDate = localStorage.getItem('in_app_ad_popup_dismissed_date');

      if (dismissedDate !== todayDate) {
        const popupCandidate = fetchedAds.find(
          a => a.isActive && a.placement === 'POPUP'
        );
        if (popupCandidate) {
          // Trigger popup with a smooth slight delay after dashboard loads
          const popupTimer = setTimeout(() => {
            setActivePopupAd(popupCandidate);
            // Track view count
            try {
              if (popupCandidate.id && !popupCandidate.id.startsWith('ad_')) {
                updateDoc(doc(db, 'in_app_ads', popupCandidate.id), {
                  viewCount: (popupCandidate.viewCount || 0) + 1
                });
              }
            } catch (err) {
              console.warn("Failed to increment ad view count:", err);
            }
          }, 1200);
          return () => clearTimeout(popupTimer);
        }
      }
    }, (err) => {
      console.error("Error fetching in-app ads:", err);
      setInAppAdsList([...DEFAULT_IN_APP_ADS]);
    });

    return () => {
      unsubscribeUser();
      unsubscribeTx();
      unsubscribePrices();
      unsubscribeInvestments();
      unsubscribeArbitrage();
      unsubscribeBots();
      unsubscribeTemplates();
      unsubscribeCopyLeads();
      unsubscribeCopyTrades();
      unsubscribeAds();
    };
  }, [user.uid]);

  // Fluctuate prices live every 4 seconds to make the app feel real
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      setCryptoPrices(prev => prev.map(coin => {
        if (coin.price === 0) return coin;
        if (coin.symbol === 'USDT' || coin.symbol === 'USDC') {
          // Keep stablecoins close to 1.00
          const change = (Math.random() - 0.5) * 0.0004;
          const newPrice = Math.max(0.999, Math.min(1.001, coin.price + change));
          return {
            ...coin,
            price: parseFloat(newPrice.toFixed(4)),
            change24h: parseFloat((change * 100).toFixed(2))
          };
        } else {
          // More active, high-fidelity fluctuations for main coins (BTC, ETH, SOL, BNB, etc.)
          const percentageChange = (Math.random() - 0.485) * 0.0035; 
          const newPrice = coin.price * (1 + percentageChange);
          const newChange24h = coin.change24h + percentageChange * 100;
          
          // Dynamically check if the previous price was defined with more than 2 decimal places, 
          // or if the coin is a low-priced asset (under $5) where 4-decimal precision is necessary.
          const priceStr = coin.price.toString();
          const hasMoreThan2Decimals = priceStr.includes('.') && priceStr.split('.')[1].length > 2;
          const decimals = (hasMoreThan2Decimals || coin.price < 5) ? 4 : 2;

          return {
            ...coin,
            price: parseFloat(newPrice.toFixed(decimals)),
            change24h: parseFloat(Math.max(-15, Math.min(15, newChange24h)).toFixed(2))
          };
        }
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, [isUsingFallbackPrices]);

  // Handle live conversion calculation inside the Trade simulation tab using dynamic cryptoPrices
  useEffect(() => {
    if (tradeAmount) {
      const amt = parseFloat(tradeAmount) || 0;
      const fromCoin = cryptoPrices.find(c => c.symbol === tradeFrom);
      const toCoin = cryptoPrices.find(c => c.symbol === tradeTo);
      if (fromCoin && toCoin) {
        const valueInUSD = amt * fromCoin.price;
        const finalValue = valueInUSD / toCoin.price;
        setTradeResult(parseFloat(finalValue.toFixed(5)));
      }
    } else {
      setTradeResult(null);
    }
  }, [tradeAmount, tradeFrom, tradeTo, cryptoPrices]);

  // Filter dynamic crypto prices based on search bar text
  const filteredCrypto = cryptoPrices.filter(coin => {
    const queryStr = searchQuery.trim().toLowerCase();
    return (
      coin.name.toLowerCase().includes(queryStr) || 
      coin.symbol.toLowerCase().includes(queryStr)
    );
  });

  const getTxTypeBadge = (type: string) => {
    switch (type) {
      case 'voucher_reward': return 'Voucher Reward';
      case 'welcome_bonus': return 'Welcome Bonus';
      case 'first_deposit_commission': return 'Referral Commission';
      case 'referral_reward': return 'Referral Reward';
      case 'deposit_crypto': return 'Crypto Deposit';
      case 'deposit_p2p': return 'P2P Purchase';
      case 'withdraw_crypto': return 'Crypto Out';
      case 'withdraw_p2p': return 'P2P Cashout';
      case 'buy_crypto': return 'Buy Crypto';
      case 'sell_crypto': return 'Sell Crypto';
      case 'swap_crypto': return 'Swap / Convert';
      case 'internal_send': return 'Internal Send';
      case 'internal_receive': return 'Internal Receive';
      case 'copy_trade_payout': return 'Copy Trade Payout';
      case 'copy_trade_upgrade': return 'Expert Contract Upgrade';
      case 'trade_balance_transfer_in': return 'Copy Trade Transfer In';
      case 'trade_balance_transfer_out': return 'Copy Trade Transfer Out';
      case 'invested': return 'Trade Signal';
      case 'investment_earning': return 'Signal Earning';
      default: return type;
    }
  };

  const totalBalance = getWalletBalance(profile);

  // Real-time helper for standard user's asset holdings
  const getCoinHolding = (symbol: string): number => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (symbol === 'USDT' || symbol === 'USDC') {
        return 0;
      }
    }
    if (symbol === 'USDT') {
      return getWalletBalance(profile);
    }
    if (profile?.holdings && profile.holdings[symbol] !== undefined) {
      return profile.holdings[symbol];
    }
    return 0;
  };

  const getLockedAmount = (symbol: string): number => {
    return activeInvestments
      .filter(inv => inv.coinSymbol === symbol && inv.status === 'active')
      .reduce((sum, inv) => sum + inv.amount, 0);
  };

  const handleInitiateInvestment = async () => {
    if (!selectedCoinForInvestment) return;
    setInvestmentError(null);
    setInvestmentSuccess(null);

    const amountVal = parseFloat(investmentAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setInvestmentError("Please enter a valid trade amount.");
      return;
    }

    const daysVal = parseInt(investmentDays);
    if (isNaN(daysVal) || daysVal < 24) {
      setInvestmentError("Minimum signal trade duration is 24 days.");
      return;
    }

    const currentHolding = getCoinHolding(selectedCoinForInvestment.symbol);
    const lockedAmount = getLockedAmount(selectedCoinForInvestment.symbol);
    const unlockedHolding = currentHolding - lockedAmount;

    const minLimit = selectedCoinForInvestment.minInvestment ?? 10.0;
    if (unlockedHolding < minLimit) {
      setInvestmentError(`Your available balance of ${unlockedHolding.toFixed(4)} ${selectedCoinForInvestment.symbol} is below the minimum required trade amount of ${minLimit} ${selectedCoinForInvestment.symbol}. Please go to the deposit page to add deposit.`);
      return;
    }

    if (amountVal < minLimit) {
      setInvestmentError(`The minimum trade amount allowed for ${selectedCoinForInvestment.symbol} is ${minLimit} ${selectedCoinForInvestment.symbol}. Please enter at least ${minLimit} ${selectedCoinForInvestment.symbol}.`);
      return;
    }

    if (unlockedHolding < amountVal) {
      setInvestmentError(`Insufficient available ${selectedCoinForInvestment.symbol} balance. You hold ${currentHolding} but ${lockedAmount} is already allocated to active trades.`);
      return;
    }

    setInvestmentLoading(true);

    try {
      const unlockTime = new Date();
      unlockTime.setDate(unlockTime.getDate() + daysVal);

      // Create investment document with totalDays and daysPaid tracking
      await addDoc(collection(db, 'investments'), {
        userId: user.uid,
        userEmail: user.email,
        coinSymbol: selectedCoinForInvestment.symbol,
        amount: amountVal,
        dailyRate: selectedCoinForInvestment.investmentRate ?? 5.0,
        status: 'active',
        totalDays: daysVal,
        daysPaid: 0,
        createdAt: new Date(),
        unlockAt: unlockTime
      });

      // Create transaction record: invested
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email,
        type: 'invested',
        amount: parseFloat((amountVal * selectedCoinForInvestment.price).toFixed(2)),
        coinSymbol: selectedCoinForInvestment.symbol,
        coinAmount: amountVal,
        status: 'APPROVED',
        createdAt: new Date(),
        paymentMessage: `Signal Trade Executed: Allocated ${amountVal} ${selectedCoinForInvestment.symbol} for ${daysVal} days at ${selectedCoinForInvestment.investmentRate ?? 5.0}% daily yield.`
      });

      setInvestmentSuccess(`Successfully executed trading signal for ${amountVal} ${selectedCoinForInvestment.symbol}!`);
      setInvestmentAmount('');
      setInvestmentDays('24');
      setMmfSubView('main');
    } catch (err: any) {
      console.error(err);
      setInvestmentError("Failed to execute trade signal: " + err.message);
    } finally {
      setInvestmentLoading(false);
    }
  };

  // Check and auto-matured active investments in real-time based on real clock passing
  useEffect(() => {
    if (!profile || activeInvestments.length === 0) return;

    const checkMaturity = async () => {
      const now = new Date();

      const getKenyanDaysSinceEpoch = (d: Date): number => {
        // Kenya is UTC+3
        const eatMs = d.getTime() + 3 * 3600 * 1000;
        return Math.floor(eatMs / (1000 * 60 * 60 * 24));
      };

      // Calculates how many weekdays (Mon-Fri) have elapsed between startEpoch and endEpoch (EAT timezone)
      const getKenyanWeekdaysElapsed = (startEpoch: number, endEpoch: number): number => {
        if (endEpoch <= startEpoch) return 0;
        let weekdays = 0;
        for (let d = startEpoch + 1; d <= endEpoch; d++) {
          const dayOfWeek = (d + 4) % 7; // Epoch day 0 was Thursday (4). 0 = Sun, 6 = Sat.
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            weekdays++;
          }
        }
        return weekdays;
      };

      const nowDayEpoch = getKenyanDaysSinceEpoch(now);

      // Filter active investments that need payments on weekdays (Mon–Fri) based on EAT calendar day boundary
      const needingPayment = activeInvestments.filter(inv => {
        if (inv.status !== 'active') return false;
        if (processingInvestmentsRef.current.has(inv.id)) return false;

        const created = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
        const createdDayEpoch = getKenyanDaysSinceEpoch(created);
        const weekdaysElapsed = getKenyanWeekdaysElapsed(createdDayEpoch, nowDayEpoch);

        const totalDays = inv.totalDays ?? 24;
        const daysPaid = inv.daysPaid ?? 0;

        // We owe payments if more weekdays have elapsed than what we have paid
        return weekdaysElapsed > daysPaid && daysPaid < totalDays;
      });

      if (needingPayment.length === 0) return;

      // Mark as processing instantly to prevent duplicate runs
      needingPayment.forEach(inv => processingInvestmentsRef.current.add(inv.id));

      try {
        let runningBalance = getWalletBalance(profile);
        const runningHoldings = { ...(profile.holdings || {}) };

        for (const inv of needingPayment) {
          const coinInfo = cryptoPrices.find(c => c.symbol === inv.coinSymbol);
          const coinPrice = coinInfo ? coinInfo.price : 0;

          const created = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
          const createdDayEpoch = getKenyanDaysSinceEpoch(created);
          const weekdaysElapsed = getKenyanWeekdaysElapsed(createdDayEpoch, nowDayEpoch);

          const totalDays = inv.totalDays ?? 24;
          const daysPaid = inv.daysPaid ?? 0;

          // Number of payouts to apply in this batch (weekdays only)
          const payoutsToApply = Math.min(weekdaysElapsed, totalDays) - daysPaid;
          if (payoutsToApply <= 0) continue;

          // Profit calculation for the payouts in this batch
          const singleDayProfit = inv.amount * (inv.dailyRate / 100);
          const totalProfitInBatch = singleDayProfit * payoutsToApply;

          if (inv.coinSymbol === 'USDT') {
            runningBalance += totalProfitInBatch;
          } else {
            runningHoldings[inv.coinSymbol] = (runningHoldings[inv.coinSymbol] || 0) + totalProfitInBatch;
          }

          const nextDaysPaid = daysPaid + payoutsToApply;
          const isCompleted = nextDaysPaid >= totalDays;

          // 1. Update the investment progress
          const oldInvRef = doc(db, 'investments', inv.id);
          await updateDoc(oldInvRef, {
            daysPaid: nextDaysPaid,
            status: isCompleted ? 'completed' : 'active'
          });

          // 2. Update the user profile with the accumulated running balance & holdings
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            balance: parseFloat(runningBalance.toFixed(2)),
            usdtBalance: parseFloat(runningBalance.toFixed(2)),
            holdings: runningHoldings
          });

          // 3. Document the earning payouts in transactions
          await addDoc(collection(db, 'transactions'), {
            userId: user.uid,
            userEmail: user.email,
            type: 'investment_earning',
            amount: parseFloat((totalProfitInBatch * coinPrice).toFixed(2)),
            coinSymbol: inv.coinSymbol,
            coinAmount: parseFloat(totalProfitInBatch.toFixed(6)),
            status: 'APPROVED',
            createdAt: new Date(),
            paymentMessage: `Trade Signal Yield: Received +${parseFloat(totalProfitInBatch.toFixed(6))} ${inv.coinSymbol} daily profit yield (Days ${daysPaid + 1} to ${nextDaysPaid}).`
          });
        }
      } catch (err) {
        console.error("Auto maturity execution error:", err);
      } finally {
        // Clean up from the ref after updates are complete
        needingPayment.forEach(inv => processingInvestmentsRef.current.delete(inv.id));
      }
    };

    checkMaturity();
  }, [activeInvestments, profile, cryptoPrices]);

  const ASSET_ALLOCATION_DEFS = [
    { symbol: 'USDT', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { symbol: 'BTC', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    { symbol: 'ETH', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    { symbol: 'SOL', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    { symbol: 'BNB', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    { symbol: 'USDC', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
    { symbol: 'XRP', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { symbol: 'WLD', color: 'bg-zinc-500/10 text-zinc-300 border-zinc-700/20' },
    { symbol: 'TRX', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    { symbol: 'DOGE', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' }
  ];

  // Calculate dynamic userAssets based on getCoinHolding and live price updates
  const userAssets = ASSET_ALLOCATION_DEFS.map(def => {
    const coinInfo = cryptoPrices.find(c => c.symbol === def.symbol);
    const price = coinInfo ? coinInfo.price : 0;
    
    let coinAmount = 0;
    let lockedAmount = 0;
    let unlockedAmount = 0;

    if (def.symbol === 'USDT') {
      const walletBal = getWalletBalance(profile);
      const tradeBal = profile?.tradeBalance ?? 0;
      const activeInvUSDT = getLockedAmount('USDT');
      
      unlockedAmount = walletBal;
      lockedAmount = tradeBal + activeInvUSDT;
      coinAmount = unlockedAmount + lockedAmount;
    } else {
      coinAmount = getCoinHolding(def.symbol);
      lockedAmount = getLockedAmount(def.symbol);
      unlockedAmount = Math.max(0, coinAmount - lockedAmount);
    }

    const usdValue = coinAmount * price; // Amount * Live Price = USDT equivalent!
    return {
      symbol: def.symbol,
      name: coinInfo?.name || def.symbol,
      colorClass: def.color,
      usdValue,
      coinAmount,
      price,
      lockedAmount,
      unlockedAmount
    };
  });

  const totalPortfolioValue = userAssets.reduce((sum, asset) => sum + asset.usdValue, 0);

  // Calculate portfolio 24-hour change (increase or decrease) based on dynamic holdings & price shifts
  const portfolioDailyChange = useMemo(() => {
    let originalValue = 0;
    let currentValue = 0;

    userAssets.forEach(asset => {
      const coinInfo = cryptoPrices.find(c => c.symbol === asset.symbol);
      const change24h = coinInfo?.change24h || 0;
      const currentPrice = coinInfo ? coinInfo.price : 0;
      
      // price_now = price_then * (1 + change24h/100) => price_then = price_now / (1 + change24h/100)
      const divider = 1 + (change24h / 100);
      const price24hAgo = divider > 0 ? (currentPrice / divider) : currentPrice;
      
      const valNow = asset.coinAmount * currentPrice;
      const valThen = asset.coinAmount * price24hAgo;
      
      currentValue += valNow;
      originalValue += valThen;
    });

    const diffUSD = currentValue - originalValue;
    const pctChange = originalValue > 0 ? (diffUSD / originalValue) * 100 : 0;
    
    return {
      diffUSD,
      pctChange,
      isPositive: diffUSD >= 0
    };
  }, [userAssets, cryptoPrices]);

  // Dynamic buy/sell real transaction execution
  const handleBuySellCrypto = async (symbol: string, type: 'BUY' | 'SELL', amountInput: string) => {
    setTradeMessage(null);
    const amount = parseFloat(amountInput);
    if (!amount || amount <= 0) {
      setTradeMessage({ text: 'Please enter a valid amount greater than 0.', isError: true });
      return;
    }

    const coin = cryptoPrices.find(c => c.symbol === symbol);
    if (!coin) {
      setTradeMessage({ text: 'Invalid token selected.', isError: true });
      return;
    }

    const price = coin.price;
    const cashBalance = getWalletBalance(profile);
    const lockedUSDT = getLockedAmount('USDT');
    const unlockedCashBalance = Math.max(0, cashBalance - lockedUSDT);
    const coinHolding = getCoinHolding(symbol);
    setTradeLoading(true);

    if (type === 'BUY') {
      const totalCost = amount * price;
      if (unlockedCashBalance < totalCost) {
        setTradeMessage({ 
          text: `Insufficient available cash balance. Buying ${amount} ${symbol} requires $${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })} but you only have $${unlockedCashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} available ($${lockedUSDT.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT is currently locked in Crypto MMF Investments).`, 
          isError: true 
        });
        setTradeLoading(false);
        return;
      }

      const newCashBalance = cashBalance - totalCost;
      const currentHoldings = profile?.holdings || {};
      const newHoldings = {
        ...currentHoldings,
        [symbol]: (currentHoldings[symbol] || 0) + amount
      };

      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          balance: parseFloat(newCashBalance.toFixed(2)),
          usdtBalance: parseFloat(newCashBalance.toFixed(2)),
          holdings: newHoldings
        });

        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userEmail: user.email,
          type: 'buy_crypto',
          amount: totalCost,
          status: 'APPROVED',
          createdAt: new Date(),
          paymentMessage: `Crypto Exchange: Purchased ${amount} ${symbol} at $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
        });

        setTradeMessage({ 
          text: `Successfully bought ${amount} ${symbol} for $${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}!`, 
          isError: false 
        });
        setQuickTradeAmount('');
      } catch (err: any) {
        console.error("Trade error:", err);
        setTradeMessage({ text: `Failed to complete transaction: ${err.message}`, isError: true });
      } finally {
        setTradeLoading(false);
      }
    } else {
      const lockedAmount = getLockedAmount(symbol);
      const unlockedHolding = coinHolding - lockedAmount;
      if (unlockedHolding < amount) {
        setTradeMessage({ 
          text: `Insufficient unlocked ${symbol} balance. You hold ${coinHolding} ${symbol} (${lockedAmount} ${symbol} is currently locked in Crypto MMF Investments) but tried to sell ${amount} ${symbol}.`, 
          isError: true 
        });
        setTradeLoading(false);
        return;
      }

      const totalEarnings = amount * price;
      const newCashBalance = cashBalance + totalEarnings;
      const currentHoldings = profile?.holdings || {};
      const newHoldings = {
        ...currentHoldings,
        [symbol]: Math.max(0, (currentHoldings[symbol] || 0) - amount)
      };

      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          balance: parseFloat(newCashBalance.toFixed(2)),
          usdtBalance: parseFloat(newCashBalance.toFixed(2)),
          holdings: newHoldings
        });

        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userEmail: user.email,
          type: 'sell_crypto',
          amount: totalEarnings,
          status: 'APPROVED',
          createdAt: new Date(),
          paymentMessage: `Crypto Exchange: Sold ${amount} ${symbol} at $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
        });

        setTradeMessage({ 
          text: `Successfully sold ${amount} ${symbol} for $${totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}!`, 
          isError: false 
        });
        setQuickTradeAmount('');
      } catch (err: any) {
        console.error("Trade error:", err);
        setTradeMessage({ text: `Failed to complete transaction: ${err.message}`, isError: true });
      } finally {
        setTradeLoading(false);
      }
    }
  };

  const [swapLoading, setSwapLoading] = useState(false);
  const [swapMessageState, setSwapMessageState] = useState<{ text: string; isError: boolean } | null>(null);
  const setSwapMessage = (msg: { text: string; isError: boolean } | null) => {
    setSwapMessageState(msg);
    if (msg) {
      if (msg.isError) toast.error(msg.text, 'Swap Error');
      else toast.success(msg.text, 'Swap Successful');
    }
  };
  const swapMessage = swapMessageState;

  // Helper to get latest contract or trade amount for a lead trader if user already has one
  const getLatestContractAmountForLead = (lead: CopyTraderLead): number => {
    const leadTrades = (userCopyTrades || []).filter(
      (t) => t.leadId === lead.id || (t.leadName && t.leadName.toLowerCase() === lead.name.toLowerCase())
    );
    if (leadTrades.length > 0) {
      // userCopyTrades is sorted newest first
      const latest = leadTrades[0];
      const cap = latest.contractCapital || latest.amount;
      if (cap && cap > 0) return cap;
    }
    return lead.minCapital ?? 50;
  };

  // Copy Trade Handlers
  const handleOpenCopyModal = (lead: CopyTraderLead) => {
    setActiveTab('earn');
    setSelectedLeadForCopy(lead);

    // Always start at Step 1 (Schedule & Parameters) so users see all the process (Time, Capital, and Execution)
    setCopyTradeStep(1);

    const existingActiveContract = userCopyTrades.find(
      t => (t.leadId === lead.id || (t.leadName && t.leadName.toLowerCase() === lead.name.toLowerCase())) && t.status === 'ACTIVE'
    );

    const defaultPair = existingActiveContract?.tradingPair || (lead.tradingPairs && lead.tradingPairs.length > 0 ? lead.tradingPairs[0] : 'BTC/USDT');
    setCopyTradePair(defaultPair);

    const initialAmount = existingActiveContract?.contractCapital || existingActiveContract?.amount || getLatestContractAmountForLead(lead);
    setCopyTradeAmountInput(initialAmount.toString());

    setCopySignalCodeInput('');
    setExecutionAnimStep(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (selectedLeadForCopy) {
      const latestAmt = getLatestContractAmountForLead(selectedLeadForCopy);
      if (latestAmt > 0) {
        setCopyTradeAmountInput(latestAmt.toString());
      }
    }
  }, [selectedLeadForCopy?.id, userCopyTrades.length]);

  const handleExecuteCopyTrade = async () => {
    if (!selectedLeadForCopy) return;

    // 1. Time & Signal Window Check
    const activeSignal = getActiveSignalForLead(selectedLeadForCopy);
    if (!activeSignal) {
      toast.error('Trade duration over', 'Signal Expired');
      return;
    }

    // 2. Signal Code Validation
    if (!copySignalCodeInput.trim()) {
      toast.error('Please enter the unique signal code provided by the expert.', 'Signal Code Required');
      return;
    }

    if (copySignalCodeInput.trim().toUpperCase() !== activeSignal.code.toUpperCase()) {
      toast.error('Invalid signal code for current signal window. Please check the active code from expert.', 'Invalid Signal Code');
      return;
    }

    // 2b. One-time Execution Check per Signal per Day
    if (isSignalExecutedToday(selectedLeadForCopy, activeSignal)) {
      toast.error(
        `You have already executed the signal code (${activeSignal.code}) for ${selectedLeadForCopy.name} today. Each signal code can only be used once per day.`,
        'Signal Already Executed'
      );
      return;
    }

    // Check for existing active contract to get locked principal
    const existingActiveContract = userCopyTrades.find(
      t => (t.leadId === selectedLeadForCopy.id || t.leadName === selectedLeadForCopy.name) && t.status === 'ACTIVE'
    );

    const isExtraSignal = Boolean(activeSignal.isExtra);

    // Validate Extra Signal Access Eligibility (First 3 Days of Contract OR 24h Referral Boost)
    if (isExtraSignal) {
      const eligibility = getExtraSignalEligibility(selectedLeadForCopy);
      if (!eligibility.eligible) {
        toast.error(
          'Extra Signals are available for the first 3 days of your contract, or for 24h whenever a user you referred makes their first deposit. Invite a friend to unlock a 24-hour pass!',
          'Extra Signal Locked'
        );
        return;
      }
    }

    const lockedPrincipalCapital = existingActiveContract?.contractCapital || existingActiveContract?.amount || parseFloat(copyTradeAmountInput) || (selectedLeadForCopy.minCapital ?? 50);

    // 3. Amount & Capital Validation
    let amount = parseFloat(copyTradeAmountInput);
    if (isExtraSignal) {
      // Extra signals trade directly on the user's locked principal capital
      amount = lockedPrincipalCapital;
    } else {
      const minCap = selectedLeadForCopy.minCapital ?? 50;
      const maxCap = selectedLeadForCopy.maxCapital ?? 10000;
      const currentContractPrincipal = existingActiveContract?.contractCapital || existingActiveContract?.amount || 0;
      const effectiveMinCap = Math.max(minCap, currentContractPrincipal);

      if (isNaN(amount) || amount < effectiveMinCap) {
        if (currentContractPrincipal > 0) {
          toast.error(
            `Trade amount cannot be lower than your current active contract principal ($${currentContractPrincipal.toFixed(2)} USD). You can trade with your principal or scale up to a higher amount.`,
            'Amount Below Principal'
          );
        } else {
          toast.error(`Trade amount must be at least $${minCap}.`, 'Invalid Trade Amount');
        }
        return;
      }

      if (amount > maxCap) {
        toast.error(`Trade amount cannot exceed $${maxCap}.`, 'Exceeds Maximum');
        return;
      }

      const tradeBal = profile?.tradeBalance ?? 0;
      const { rawLockedCapital, activeContractCapitalByLead } = getCopyTradeLockedAndFree();
      const currentLeadKey = selectedLeadForCopy.id || selectedLeadForCopy.name;
      const currentLeadLockedCap = activeContractCapitalByLead[currentLeadKey] || 0;
      const lockedInOtherExperts = Math.max(0, rawLockedCapital - currentLeadLockedCap);
      const availableForThisLead = Math.max(0, tradeBal - lockedInOtherExperts);

      if (amount > availableForThisLead) {
        if (lockedInOtherExperts > 0) {
          toast.error(
            `Insufficient available balance. You currently have ${lockedInOtherExperts.toFixed(2)} locked in active contracts with other experts. To trade with ${selectedLeadForCopy.name}, please transfer additional funds into your Copy Trade Balance.`,
            'Capital Locked In Other Contract'
          );
        } else {
          toast.error(
            `Insufficient Copy Trade Balance (${tradeBal.toFixed(2)} USD available). Please transfer funds from your Wallet into your Copy Trade Balance.`,
            'Insufficient Trade Balance'
          );
        }
        return;
      }
    }

    setIsSubmittingCopy(true);
    setExecutionAnimStep(1); // Phase 1: Cryptographic validation

    try {
      await new Promise(r => setTimeout(r, 400));
      setExecutionAnimStep(2); // Phase 2: Master node matching & order execution
      await new Promise(r => setTimeout(r, 500));
      setExecutionAnimStep(3); // Phase 3: Instant settlement & balance crediting
      await new Promise(r => setTimeout(r, 400));

      // 4. Calculate Profits and Commissions
      let signalProfitPercent = 0;
      if (isExtraSignal) {
        // Extra signal has its own profit rate, independent of 1-day profit rate and daily signals count
        signalProfitPercent = activeSignal.profitRate ?? 3.5;
      } else {
        // Regular signal: 1-day profit rate divided by regular daily signals count
        const numSignals = selectedLeadForCopy.signals?.length || 1;
        const dayRate = selectedLeadForCopy.dayProfitRate ?? 2.0;
        signalProfitPercent = dayRate / numSignals;
      }

      const grossProfit = amount * (signalProfitPercent / 100);
      const commissionPct = selectedLeadForCopy.analysisCommission ?? 10;
      const commissionDeducted = grossProfit * (commissionPct / 100);
      const netProfit = grossProfit - commissionDeducted;

      // 5. Update User's Trade Balance
      const tradeBal = profile?.tradeBalance ?? 0;
      const userRef = doc(db, 'users', user.uid);
      const newTradeBal = tradeBal + netProfit;
      await updateDoc(userRef, {
        tradeBalance: parseFloat(newTradeBal.toFixed(2))
      });

      // 6. Record or Update Copy Trade Contract
      const entryPriceVal = (67100 + Math.random() * 400).toFixed(2);
      const exitPriceVal = (67800 + Math.random() * 400).toFixed(2);

      const executedSignalEntry = {
        code: copySignalCodeInput.trim().toUpperCase(),
        time: activeSignal.time,
        tradingPair: copyTradePair,
        amount: amount,
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        commissionCut: parseFloat(commissionDeducted.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        isExtra: isExtraSignal,
        profitRate: signalProfitPercent,
        signalLabel: activeSignal.label || (isExtraSignal ? 'Extra Signal' : 'Regular Signal'),
        entryPrice: entryPriceVal,
        exitPrice: exitPriceVal,
        executedAt: new Date().toISOString()
      };

      if (existingActiveContract) {
        // Continue existing active contract instead of creating a duplicate contract
        const updatedNetProfit = (existingActiveContract.netProfit || 0) + netProfit;
        const updatedGrossProfit = (existingActiveContract.grossProfit || 0) + grossProfit;
        const updatedCommission = (existingActiveContract.commissionDeducted || 0) + commissionDeducted;
        const prevSignals = Array.isArray(existingActiveContract.executedSignals) ? existingActiveContract.executedSignals : [];

        // Dynamically update locked principal if the user traded with a higher amount or scaled up
        const updatedContractCapital = Math.max(
          existingActiveContract.contractCapital || 0,
          existingActiveContract.amount || 0,
          amount
        );

        await updateDoc(doc(db, 'user_copy_trades', existingActiveContract.id), {
          contractCapital: parseFloat(updatedContractCapital.toFixed(2)),
          amount: parseFloat(updatedContractCapital.toFixed(2)),
          netProfit: parseFloat(updatedNetProfit.toFixed(2)),
          grossProfit: parseFloat(updatedGrossProfit.toFixed(2)),
          commissionDeducted: parseFloat(updatedCommission.toFixed(2)),
          signalCode: copySignalCodeInput.trim().toUpperCase(),
          signalTime: activeSignal.time,
          executedSignals: [...prevSignals, executedSignalEntry],
          updatedAt: new Date().toISOString()
        });
      } else {
        // Create initial copy trade contract
        const newTradeId = `copy-${Date.now()}`;
        await addDoc(collection(db, 'user_copy_trades'), {
          id: newTradeId,
          userId: user.uid,
          userEmail: user.email || '',
          leadId: selectedLeadForCopy.id,
          leadName: selectedLeadForCopy.name,
          leadPhotoUrl: selectedLeadForCopy.photoUrl,
          tradingPair: copyTradePair,
          amount: amount,
          signalCode: copySignalCodeInput.trim().toUpperCase(),
          signalTime: activeSignal.time,
          executedSignals: [executedSignalEntry],
          grossProfit: parseFloat(grossProfit.toFixed(2)),
          commissionDeducted: parseFloat(commissionDeducted.toFixed(2)),
          netProfit: parseFloat(netProfit.toFixed(2)),
          status: 'ACTIVE',
          contractCapital: amount,
          contractStartDate: new Date(),
          contractDurationDays: selectedLeadForCopy.contractDurationDays || 30,
          createdAt: new Date().toISOString()
        });
      }

      // 7. Add Transaction record
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email || '',
        type: 'copy_trade_payout',
        amount: netProfit,
        status: 'APPROVED',
        createdAt: new Date(),
        paymentMessage: isExtraSignal
          ? `Copy Trade Extra Signal Executed (${copyTradePair}) with ${selectedLeadForCopy.name} [Rate: ${signalProfitPercent.toFixed(2)}% on Locked Principal ${amount.toFixed(2)}]. Profit: +${netProfit.toFixed(2)} USD (Gross ${grossProfit.toFixed(2)} - Analysis Commission ${commissionDeducted.toFixed(2)})`
          : `Copy Trade Signal Executed (${copyTradePair}) with ${selectedLeadForCopy.name}. Profit: +${netProfit.toFixed(2)} USD (Gross ${grossProfit.toFixed(2)} - Analysis Commission ${commissionDeducted.toFixed(2)})`
      });

      // Pop settlement trade ticket slip modal
      setSettledTradeReceipt({
        leadName: selectedLeadForCopy.name,
        leadPhotoUrl: selectedLeadForCopy.photoUrl,
        tradingPair: copyTradePair,
        signalCode: copySignalCodeInput.trim().toUpperCase(),
        tradedCapital: amount,
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        commissionCut: parseFloat(commissionDeducted.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        commissionPct,
        newBalance: newTradeBal,
        entryPrice: entryPriceVal,
        exitPrice: exitPriceVal,
        executedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        leadObj: selectedLeadForCopy
      });

      setSelectedLeadForCopy(null);
      setCopySignalCodeInput('');
      toast.success(
        isExtraSignal
          ? `Extra Signal executed successfully! +${netProfit.toFixed(2)} USD credited to your Trade Balance.`
          : `Signal trade executed! +${netProfit.toFixed(2)} USD credited to your Trade Balance.`,
        'Trade Executed'
      );
    } catch (err: any) {
      console.error("Copy trade error:", err);
      toast.error(`Failed to execute copy trade: ${err.message}`, 'Trade Execution Error');
    } finally {
      setIsSubmittingCopy(false);
      setExecutionAnimStep(0);
    }
  };

  const handleConfirmExpertUpgrade = async (
    oldContract: UserCopyTrade,
    targetLead: CopyTraderLead,
    newCapital: number,
    tradingPair: string
  ) => {
    if (!user?.uid) return;
    const oldPrincipal = oldContract.contractCapital || oldContract.amount || 0;
    const targetMin = targetLead.minCapital ?? 50;
    const { freeTransferrable } = getCopyTradeLockedAndFree();
    const combinedAvailable = Math.max(0, oldPrincipal + freeTransferrable);

    if (newCapital < targetMin) {
      toast.error(`Minimum capital for ${targetLead.name} is $${targetMin.toFixed(2)} USD.`, 'Invalid Capital');
      return;
    }

    if (newCapital > combinedAvailable) {
      toast.error(`Insufficient combined trade balance. Maximum available is $${combinedAvailable.toFixed(2)} USD.`, 'Insufficient Balance');
      return;
    }

    setIsSubmittingUpgrade(true);
    try {
      // 1. Mark previous active contract as UPGRADED
      if (oldContract.id) {
        await updateDoc(doc(db, 'user_copy_trades', oldContract.id), {
          status: 'UPGRADED',
          upgradedToLeadId: targetLead.id,
          upgradedToLeadName: targetLead.name,
          rolledOverCapital: oldPrincipal,
          stoppedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // 2. Create the upgraded contract for the target lead
      // Preserve original welcome boost date to prevent resetting 3-day welcome boost on upgrade
      const originalBoostDate = oldContract.welcomeBoostInitialDate 
        || oldContract.originalContractStartDate 
        || oldContract.contractStartDate 
        || oldContract.createdAt 
        || new Date();

      const newTradeId = `copy-${Date.now()}`;
      await addDoc(collection(db, 'user_copy_trades'), {
        id: newTradeId,
        userId: user.uid,
        userEmail: user.email || '',
        leadId: targetLead.id,
        leadName: targetLead.name,
        leadPhotoUrl: targetLead.photoUrl,
        tradingPair: tradingPair || 'BTC/USDT',
        amount: parseFloat(newCapital.toFixed(2)),
        signalCode: '',
        signalTime: '',
        executedSignals: [],
        grossProfit: 0,
        commissionDeducted: 0,
        netProfit: 0,
        status: 'ACTIVE',
        contractCapital: parseFloat(newCapital.toFixed(2)),
        contractStartDate: new Date(),
        originalContractStartDate: originalBoostDate,
        welcomeBoostInitialDate: originalBoostDate,
        contractDurationDays: targetLead.contractDurationDays || 30,
        upgradedFromTradeId: oldContract.id,
        rolledOverCapital: oldPrincipal,
        createdAt: new Date().toISOString()
      });

      // 3. Add an audit transaction record
      const additionalFromFree = Math.max(0, newCapital - oldPrincipal);
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email || '',
        type: 'copy_trade_upgrade',
        title: 'Expert Contract Upgrade',
        amount: parseFloat(newCapital.toFixed(2)),
        isCredit: null,
        status: 'APPROVED',
        createdAt: new Date(),
        paymentMessage: `Upgraded Copy Trading Contract from ${oldContract.leadName} to ${targetLead.name}. Rolled over $${oldPrincipal.toFixed(2)} principal${additionalFromFree > 0 ? ` + $${additionalFromFree.toFixed(2)} free trade balance` : ''} (Total Contract Capital: $${newCapital.toFixed(2)}).`
      });

      // 4. Update UI states
      setUpgradeModalData(null);
      setSelectedContractForDetail(null);
      
      toast.success(
        `Successfully upgraded to ${targetLead.name}! $${oldPrincipal.toFixed(2)} principal rolled over.`,
        'Contract Upgraded'
      );

      // Open new lead's copy modal ready for execution
      handleOpenCopyModal(targetLead);
    } catch (err: any) {
      console.error("Error executing expert upgrade:", err);
      toast.error(`Failed to upgrade expert contract: ${err.message}`, 'Upgrade Failed');
    } finally {
      setIsSubmittingUpgrade(false);
    }
  };

  const handleStopCopyTrade = async (trade: UserCopyTrade) => {
    try {
      if (trade.id) {
        await updateDoc(doc(db, 'user_copy_trades', trade.id), {
          status: 'STOPPED',
          stoppedAt: new Date().toISOString()
        });

        // Refund capital + profit
        const tradeAmount = trade.amount || trade.contractCapital || 0;
        const tradeProfit = trade.netProfit || 0;
        const refund = tradeAmount + tradeProfit;
        if (refund > 0) {
          const userRef = doc(db, 'users', user.uid);
          const currentWallet = getWalletBalance(profile);
          const newBal = parseFloat((currentWallet + refund).toFixed(2));
          await updateDoc(userRef, {
            balance: newBal,
            usdtBalance: newBal
          });
        }

        toast.success(`Copy trading for ${trade.leadName} stopped. $${refund.toFixed(2)} returned to your balance.`, 'Copy Trade Stopped');
      }
    } catch (err: any) {
      console.error("Error stopping copy trade:", err);
      toast.error(`Failed to stop copy trade: ${err.message}`, 'Error');
    }
  };

  const BOT_TEMPLATES = [
    {
      id: 'dca_accumulator',
      name: 'DCA Smart Accumulator',
      category: 'FREE',
      winRatioRange: '98%',
      winProfitRange: '1.0% - 1.8%',
      lossPercentRange: '0.3% - 0.8%',
      riskLevel: 'Very Low Risk',
      minCapital: 25,
      tradingPairs: DEFAULT_BOT_TRADING_PAIRS,
      color: 'from-blue-500 to-indigo-500'
    },
    {
      id: 'arb_sniper',
      name: 'Arbitrage Flash-Loan Sniper',
      category: 'PREMIUM',
      winRatioRange: '95%',
      winProfitRange: '1.5% - 2.5%',
      lossPercentRange: '0.4% - 1.4%',
      riskLevel: 'Low Risk',
      minCapital: 50,
      tradingPairs: DEFAULT_BOT_TRADING_PAIRS,
      color: 'from-amber-500 to-yellow-500'
    },
    {
      id: 'grid_scalper',
      name: 'AI Grid Scalper Pro',
      category: 'PREMIUM',
      winRatioRange: '90%',
      winProfitRange: '1.2% - 2.0%',
      lossPercentRange: '0.5% - 1.2%',
      riskLevel: 'Medium Risk',
      minCapital: 100,
      tradingPairs: DEFAULT_BOT_TRADING_PAIRS,
      color: 'from-emerald-500 to-teal-500'
    },
    {
      id: 'quantum_momentum',
      name: 'Quantum Momentum Scalper',
      category: 'FREE',
      winRatioRange: '85%',
      winProfitRange: '2.0% - 4.5%',
      lossPercentRange: '1.0% - 2.5%',
      riskLevel: 'High Risk',
      minCapital: 250,
      tradingPairs: DEFAULT_BOT_TRADING_PAIRS,
      color: 'from-purple-500 to-pink-500'
    }
  ];

  const getTemplateMinCapital = (tmpl: any): number => {
    if (!tmpl) return 25;
    const val = tmpl.minCapital ?? tmpl.min_capital ?? tmpl.minDeposit ?? tmpl.minimumCapital ?? tmpl.min_deposit ?? tmpl.capital ?? tmpl.minCapitalAmount;
    if (val !== undefined && val !== null && val !== '') {
      const num = Number(val);
      if (!isNaN(num) && num > 0) return num;
    }
    if ((tmpl.category || '').toUpperCase() === 'PREMIUM') return 50;
    return 25;
  };

  const handleDeployBot = async () => {
    if (!selectedBotTemplate) return;
    const capital = parseFloat(botCapitalInput);
    const minRequired = getTemplateMinCapital(selectedBotTemplate);
    if (isNaN(capital) || capital < minRequired) {
      toast.error(`Minimum capital requirement for ${selectedBotTemplate.name} is $${minRequired}`, 'Invalid Capital');
      return;
    }
    const currentBalance = getWalletBalance(profile);
    const lockedUSDT = getLockedAmount('USDT');
    const freeBalance = Math.max(0, currentBalance - lockedUSDT);
    if (capital > freeBalance) {
      toast.error(`Insufficient available USD wallet balance ($${freeBalance.toFixed(2)} free available). Please deposit funds or wait for active trades to complete.`, 'Insufficient Funds');
      return;
    }

    setBotDeployLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const newBalance = currentBalance - capital;
      await updateDoc(userRef, { balance: newBalance, usdtBalance: newBalance });

      const winRatioRange = selectedBotTemplate.winRatioRange || '95%';
      const winProfitRange = selectedBotTemplate.winProfitRange || '1.5% - 2.5%';
      const lossPercentRange = selectedBotTemplate.lossPercentRange || '0.4% - 1.4%';

      const docRef = await addDoc(collection(db, 'user_bots'), {
        userId: user.uid,
        userEmail: user.email,
        templateId: selectedBotTemplate.id,
        name: selectedBotTemplate.name,
        category: selectedBotTemplate.category || 'Trading Bot',
        tradingPair: botSelectedPair || (selectedBotTemplate.tradingPairs?.[0] || 'BTC/USDT'),
        durationSeconds: botDurationSeconds,
        durationMinutes: parseFloat((botDurationSeconds / 60).toFixed(2)),
        capital: capital,
        coinSymbol: botCoinInput || 'USDT',
        accruedProfit: 0,
        status: 'RUNNING',
        winRatioRange,
        winProfitRange,
        lossPercentRange,
        wins: 0,
        losses: 0,
        totalTrades: 0,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email,
        type: 'bot_capital_deployment',
        title: 'Bot Capital Allocation',
        amount: capital,
        status: 'APPROVED',
        coinSymbol: botCoinInput,
        paymentMessage: `Auto Bot trade: Deployed ${selectedBotTemplate.name} with $${capital}`,
        createdAt: serverTimestamp()
      });

      const newlyDeployedBot = {
        id: docRef.id,
        userId: user.uid,
        userEmail: user.email,
        templateId: selectedBotTemplate.id,
        name: selectedBotTemplate.name,
        category: selectedBotTemplate.category || 'Trading Bot',
        tradingPair: botSelectedPair || (selectedBotTemplate.tradingPairs?.[0] || 'BTC/USDT'),
        durationSeconds: botDurationSeconds,
        durationMinutes: parseFloat((botDurationSeconds / 60).toFixed(2)),
        capital: capital,
        coinSymbol: botCoinInput || 'USDT',
        accruedProfit: 0,
        status: 'RUNNING',
        winRatioRange,
        winProfitRange,
        lossPercentRange,
        wins: 0,
        losses: 0,
        totalTrades: 0,
        createdAt: new Date()
      };

      toast.success(`Successfully deployed ${selectedBotTemplate.name} with $${capital}!`, 'Bot Deployed');
      setSelectedBotTemplate(null);
      setBotCapitalInput('');
      setBotDeployLoading(false);
      setActiveRunningBot(newlyDeployedBot);
    } catch (err: any) {
      console.error("Error deploying bot:", err);
      toast.error(err.message || 'Failed to deploy bot', 'Deployment Error');
      setBotDeployLoading(false);
    }
  };

  const handleHarvestBotProfit = async (bot: any) => {
    const profitEarned = Math.max(1.5, parseFloat((bot.capital * 0.02 * (Math.random() * 0.8 + 0.6)).toFixed(2)));
    try {
      const userRef = doc(db, 'users', user.uid);
      const currentBalance = getWalletBalance(profile);
      const newBal = currentBalance + profitEarned;
      await updateDoc(userRef, { balance: newBal, usdtBalance: newBal });

      const botRef = doc(db, 'user_bots', bot.id);
      await updateDoc(botRef, { accruedProfit: (bot.accruedProfit || 0) + profitEarned });

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email,
        type: 'investment_earning',
        amount: profitEarned,
        status: 'APPROVED',
        coinSymbol: bot.coinSymbol || 'USDT',
        paymentMessage: `Harvested profit from ${bot.name}`,
        createdAt: serverTimestamp()
      });

      toast.success(`Successfully harvested $${profitEarned.toFixed(2)} profit to your wallet!`, 'Profit Harvested');
    } catch (err: any) {
      console.error("Error harvesting bot profit:", err);
      toast.error('Failed to harvest profit', 'Error');
    }
  };

  const handleToggleBotStatus = async (bot: any) => {
    try {
      const newStatus = bot.status === 'RUNNING' ? 'PAUSED' : 'RUNNING';
      const botRef = doc(db, 'user_bots', bot.id);
      await updateDoc(botRef, { status: newStatus });
      toast.success(`Bot status updated to ${newStatus}`, 'Bot Updated');
    } catch (err: any) {
      console.error("Error updating bot status:", err);
      toast.error('Failed to update bot status', 'Error');
    }
  };

  const handleStopBot = async (bot: any) => {
    const capital = bot.capital || 0;
    const accruedProfit = bot.accruedProfit || 0;
    const totalReturnAmount = capital + accruedProfit;
    try {
      const userRef = doc(db, 'users', user.uid);
      const currentBalance = getWalletBalance(profile);
      const newBal = currentBalance + totalReturnAmount;
      await updateDoc(userRef, { balance: newBal, usdtBalance: newBal });

      const botRef = doc(db, 'user_bots', bot.id);
      await updateDoc(botRef, { status: 'STOPPED', capital: 0, accruedProfit: 0 });

      if (accruedProfit !== 0) {
        const isProfit = accruedProfit > 0;
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userEmail: user.email,
          type: 'bot_harvest',
          title: `${bot.name} ${isProfit ? 'Profit Harvest' : 'Loss Deduction'}`,
          tradingPair: bot.tradingPair || 'BTC/USDT',
          botName: bot.name,
          amount: Math.abs(accruedProfit),
          profitDelta: accruedProfit,
          isWin: isProfit,
          status: isProfit ? 'WIN' : 'LOSS',
          paymentMessage: `Bot ${bot.name} stopped: ${isProfit ? `Harvested +$${accruedProfit.toFixed(2)} USDT profit` : `Net loss -$${Math.abs(accruedProfit).toFixed(2)} USDT`}`,
          createdAt: serverTimestamp()
        });
      }

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email,
        type: 'bot_capital_return',
        title: 'Bot Capital Return',
        amount: capital,
        status: 'APPROVED',
        coinSymbol: bot.coinSymbol || 'USDT',
        paymentMessage: `Auto Bot trade: Stopped ${bot.name} & returned $${capital.toFixed(2)} capital`,
        createdAt: serverTimestamp()
      });

      toast.success(`Bot stopped. $${totalReturnAmount.toFixed(2)} returned to your wallet.`, 'Bot Stopped');
    } catch (err: any) {
      console.error("Error stopping bot:", err);
      toast.error('Failed to stop bot', 'Error');
    }
  };

  const handleSwapConvert = async () => {
    setSwapMessage(null);
    const amt = parseFloat(tradeAmount);
    if (!amt || amt <= 0) {
      setSwapMessage({ text: 'Please enter a valid amount to convert.', isError: true });
      return;
    }
    if (tradeResult === null || tradeResult <= 0) {
      setSwapMessage({ text: 'Conversion result is invalid.', isError: true });
      return;
    }
    if (tradeFrom === tradeTo) {
      setSwapMessage({ text: 'Cannot exchange a token with itself.', isError: true });
      return;
    }

    setSwapLoading(true);

    const fromCoin = cryptoPrices.find(c => c.symbol === tradeFrom);
    const toCoin = cryptoPrices.find(c => c.symbol === tradeTo);

    const fromHolding = getCoinHolding(tradeFrom);
    const lockedAmount = getLockedAmount(tradeFrom);
    const unlockedHolding = fromHolding - lockedAmount;

    if (unlockedHolding < amt) {
      setSwapMessage({
        text: `Insufficient unlocked ${tradeFrom} balance. You hold ${fromHolding} ${tradeFrom} (${lockedAmount} ${tradeFrom} is currently locked in Crypto MMF Investments) but tried to swap ${amt} ${tradeFrom}.`,
        isError: true
      });
      setSwapLoading(false);
      return;
    }

    const currentHoldings = profile?.holdings || {};
    const newHoldings = { ...currentHoldings };
    let newBalance = getWalletBalance(profile);

    // Deduct from source
    if (tradeFrom === 'USDT') {
      newBalance = Math.max(0, newBalance - amt);
    } else {
      newHoldings[tradeFrom] = Math.max(0, (currentHoldings[tradeFrom] || 0) - amt);
    }

    // Add to target
    if (tradeTo === 'USDT') {
      newBalance = newBalance + tradeResult;
    } else {
      newHoldings[tradeTo] = (currentHoldings[tradeTo] || 0) + tradeResult;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        balance: parseFloat(newBalance.toFixed(2)),
        usdtBalance: parseFloat(newBalance.toFixed(2)),
        holdings: newHoldings
      });

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email,
        type: 'swap_crypto', 
        amount: amt * (fromCoin ? fromCoin.price : 0), 
        status: 'APPROVED',
        createdAt: new Date(),
        paymentMessage: `Crypto Exchange Swap: Exchanged ${amt} ${tradeFrom} to ${tradeResult} ${tradeTo}`
      });

      setSwapMessage({
        text: `Successfully swapped ${amt} ${tradeFrom} for ${tradeResult} ${tradeTo}!`,
        isError: false
      });
      setTradeAmount('');
    } catch (err: any) {
      console.error("Swap error:", err);
      setSwapMessage({ text: `Failed to execute swap: ${err.message}`, isError: true });
    } finally {
      setSwapLoading(false);
    }
  };

  // In-App Ad interaction and navigation router
  const handleAdAction = (ad: InAppAd) => {
    // Increment click count in Firestore
    try {
      if (ad.id && !ad.id.startsWith('ad_')) {
        updateDoc(doc(db, 'in_app_ads', ad.id), {
          clickCount: (ad.clickCount || 0) + 1
        });
      }
    } catch (err) {
      console.warn("Failed to increment ad click count:", err);
    }

    if (ad.actionType === 'EARN') {
      setActiveTab('earn');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (ad.actionType === 'BOT_TRADING') {
      setActiveTab('bots');
      setBotHubView('TEMPLATES');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (ad.actionType === 'DEPOSIT') {
      onOpenDeposit();
    } else if (ad.actionType === 'REFERRALS') {
      localStorage.setItem('profile_subpage', 'referrals');
      onOpenProfile();
    } else if (ad.actionType === 'VOUCHERS') {
      localStorage.setItem('profile_subpage', 'vouchers');
      onOpenProfile();
    } else if (ad.actionType === 'LEADERBOARD') {
      setActiveTab('leaderboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (ad.actionType === 'EXTERNAL_LINK' && ad.actionUrl) {
      window.open(ad.actionUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCloseAdPopup = (dontShowToday?: boolean) => {
    if (dontShowToday) {
      const todayDate = new Date().toISOString().split('T')[0];
      localStorage.setItem('in_app_ad_popup_dismissed_date', todayDate);
    }
    setActivePopupAd(null);
  };

  if (selectedCoin) {
    const liveCoin = cryptoPrices.find(c => c.symbol === selectedCoin.symbol) || selectedCoin;
    const cacheKey = `${liveCoin.symbol}-${chartTimeframe}`;
    const candles = candlesCache[cacheKey] || generateCandleData(liveCoin.price, liveCoin.change24h, chartTimeframe);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const range = max - min || 1;
    
    // We increase chart SVG height to 200 for a much more premium look and feel
    const getY = (val: number) => {
      return 200 - ((val - min) / range) * 145 - 25; // padding top 25, bottom 25
    };

    const displayedCandle = hoveredCandle || candles[candles.length - 1];
    const holding = getCoinHolding(liveCoin.symbol);
    const usdVal = holding * liveCoin.price;

    // High fidelity financial stats simulation based on the active live price
    const getSimulatedStats = (symbol: string, price: number) => {
      const sym = symbol.toUpperCase();
      let volume = "";
      let mcap = "";
      
      if (sym === 'BTC') {
        volume = "$32.48B";
        mcap = "$1.85T";
      } else if (sym === 'ETH') {
        volume = "$15.82B";
        mcap = "$417.6B";
      } else if (sym === 'SOL') {
        volume = "$4.12B";
        mcap = "$86.3B";
      } else if (sym === 'BNB') {
        volume = "$1.65B";
        mcap = "$88.1B";
      } else if (sym === 'USDT' || sym === 'USDC') {
        volume = "$52.10B";
        mcap = sym === 'USDT' ? "$114.5B" : "$32.2B";
      } else if (sym === 'XRP') {
        volume = "$2.95B";
        mcap = "$144.2B";
      } else if (sym === 'WLD') {
        volume = "$340.5M";
        mcap = "$1.12B";
      } else if (sym === 'TRX') {
        volume = "$210.8M";
        mcap = "$19.4B";
      } else if (sym === 'DOGE') {
        volume = "$1.45B";
        mcap = "$54.8B";
      } else {
        const seed = sym.charCodeAt(0) + sym.charCodeAt(sym.length - 1);
        const volVal = (price * 12000000) * (0.85 + (seed % 10) / 20);
        const mcapVal = (price * 450000000) * (0.9 + (seed % 7) / 15);
        
        if (volVal >= 1e9) volume = `$${(volVal / 1e9).toFixed(2)}B`;
        else if (volVal >= 1e6) volume = `$${(volVal / 1e6).toFixed(2)}M`;
        else volume = `$${volVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

        if (mcapVal >= 1e9) mcap = `$${(mcapVal / 1e9).toFixed(2)}B`;
        else if (mcapVal >= 1e6) mcap = `$${(mcapVal / 1e6).toFixed(2)}M`;
        else mcap = `$${mcapVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
      }
      return { volume, mcap };
    };

    const { volume: vol24h, mcap: mcap24h } = getSimulatedStats(liveCoin.symbol, liveCoin.price);

    return (
      <div 
        id="coin-detail-page-root" 
        className={`min-h-screen font-sans pb-16 animate-fade-in ${
          isLightTheme ? 'bg-[#EBF9F0] text-zinc-800' : 'bg-slate-900 text-zinc-100'
        }`}
      >
        {/* Top Header */}
        <header className={`px-4 py-4 border-b sticky top-0 backdrop-blur-md z-20 flex items-center gap-3 ${
          isLightTheme ? 'bg-[#EBF9F0]/90 border-emerald-200/80' : 'bg-slate-900/85 border-slate-800'
        }`}>
          <button 
            id="coin-detail-back-btn"
            onClick={() => {
              setSelectedCoin(null);
              setHoveredCandle(null);
            }}
            className={`p-2.5 rounded-full transition-all cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95 ${
              isLightTheme 
                ? 'bg-white border border-emerald-200 text-[#008B47] hover:text-[#007038] hover:border-emerald-300 shadow-xs' 
                : 'bg-slate-800 border border-slate-700 text-zinc-400 hover:text-white'
            }`}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center border ${
              isLightTheme ? 'bg-white border-emerald-200' : 'bg-slate-800 border border-slate-700'
            }`}>
              <CoinIcon symbol={liveCoin.symbol} className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight flex items-center gap-1.5">
                <span className={isLightTheme ? 'text-zinc-800' : 'text-zinc-100'}>{liveCoin.name}</span>
                <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                  isLightTheme 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/50'
                }`}>
                  {liveCoin.symbol}
                </span>
              </h2>
              <p className="text-[9px] text-zinc-500 font-extrabold tracking-widest uppercase mt-0.5 select-none">REAL-TIME TRADING PAIR</p>
            </div>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 mt-5 space-y-5">
          {/* Price Display */}
          <div className={`flex justify-between items-center select-none p-4 rounded-2xl border ${
            isLightTheme 
              ? 'bg-white border-emerald-200/90 shadow-sm' 
              : 'bg-slate-950/40 border-slate-850'
          }`}>
            <div>
              <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest block">LAST TRADED PRICE</span>
              <h3 className={`text-3xl font-black font-mono tracking-tight mt-1 flex items-baseline gap-1 ${
                isLightTheme ? 'text-zinc-800' : 'text-zinc-100'
              }`}>
                <span>${liveCoin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                <span className="text-xs text-zinc-500 font-bold uppercase font-mono">USDT</span>
              </h3>
            </div>
            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black ${
              liveCoin.change24h >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {liveCoin.change24h >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{liveCoin.change24h >= 0 ? '+' : ''}{liveCoin.change24h.toFixed(2)}%</span>
            </div>
          </div>

          {/* Candlestick OHLC Stat Header */}
          <div className={`grid grid-cols-4 gap-1.5 p-2.5 border rounded-xl select-none text-center ${
            isLightTheme 
              ? 'bg-white border-emerald-200/90 shadow-sm' 
              : 'bg-slate-950 border-slate-850'
          }`}>
            <div className={`p-1.5 rounded-lg border ${
              isLightTheme ? 'bg-[#F4FBF6] border-emerald-200/60' : 'bg-slate-900/40 border-slate-850/50'
            }`}>
              <span className="text-[8px] text-zinc-500 font-extrabold uppercase tracking-wider block">Open</span>
              <span className={`text-[10px] font-mono font-bold block mt-0.5 leading-none ${displayedCandle.close >= displayedCandle.open ? "text-emerald-400" : "text-red-400"}`}>
                ${displayedCandle.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
            </div>
            <div className={`p-1.5 rounded-lg border ${
              isLightTheme ? 'bg-[#F4FBF6] border-emerald-200/60' : 'bg-slate-900/40 border-slate-850/50'
            }`}>
              <span className="text-[8px] text-zinc-500 font-extrabold uppercase tracking-wider block">High</span>
              <span className={`text-[10px] font-mono font-bold block mt-0.5 leading-none ${
                isLightTheme ? 'text-zinc-800' : 'text-zinc-200'
              }`}>
                ${displayedCandle.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
            </div>
            <div className={`p-1.5 rounded-lg border ${
              isLightTheme ? 'bg-[#F4FBF6] border-emerald-200/60' : 'bg-slate-900/40 border-slate-850/50'
            }`}>
              <span className="text-[8px] text-zinc-500 font-extrabold uppercase tracking-wider block">Low</span>
              <span className={`text-[10px] font-mono font-bold block mt-0.5 leading-none ${
                isLightTheme ? 'text-zinc-800' : 'text-zinc-200'
              }`}>
                ${displayedCandle.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
            </div>
            <div className={`p-1.5 rounded-lg border ${
              isLightTheme ? 'bg-[#F4FBF6] border-emerald-200/60' : 'bg-slate-900/40 border-slate-850/50'
            }`}>
              <span className="text-[8px] text-zinc-500 font-extrabold uppercase tracking-wider block">Close</span>
              <span className={`text-[10px] font-mono font-bold block mt-0.5 leading-none ${displayedCandle.close >= displayedCandle.open ? "text-emerald-400" : "text-red-400"}`}>
                ${displayedCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
            </div>
          </div>

          {/* Vector Candlestick Chart */}
          <div className={`p-4 border rounded-2xl space-y-4 relative overflow-hidden ${
            isLightTheme 
              ? 'bg-white border-emerald-200/90 shadow-sm' 
              : 'bg-slate-950 border-slate-850'
          }`}>
            <div className="flex justify-between items-center select-none">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-wider">Live Candlestick Trend</span>
              </div>
              
              {/* Timeframe selector tabs */}
              <div className={`flex gap-1 p-0.5 rounded-lg border ${
                isLightTheme ? 'bg-zinc-100 border-zinc-200' : 'bg-slate-900 border-slate-800'
              }`}>
                {(['1m', '5m', '1h', '4h'] as const).map(tf => (
                  <button
                    key={tf}
                    onClick={() => setChartTimeframe(tf)}
                    className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md transition-all uppercase cursor-pointer ${
                      chartTimeframe === tf 
                        ? (isLightTheme ? 'bg-amber-100 text-amber-800 shadow-xs border border-amber-200' : 'bg-slate-850 text-emerald-400 shadow-sm border border-slate-700/50') 
                        : (isLightTheme ? 'text-zinc-500 hover:text-zinc-700' : 'text-zinc-500 hover:text-zinc-300')
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Chart area */}
            <div className="w-full h-[200px] relative">
              <svg viewBox="0 0 350 200" className="w-full h-full overflow-visible">
                {/* Horizontal Grid lines */}
                <line x1="0" y1="25" x2="350" y2="25" stroke={isLightTheme ? "#fcd34d" : "#1e293b"} strokeOpacity={isLightTheme ? "0.35" : "0.5"} strokeDasharray="3 3" />
                <line x1="0" y1="100" x2="350" y2="100" stroke={isLightTheme ? "#fcd34d" : "#1e293b"} strokeOpacity={isLightTheme ? "0.35" : "0.5"} strokeDasharray="3 3" />
                <line x1="0" y1="175" x2="350" y2="175" stroke={isLightTheme ? "#fcd34d" : "#1e293b"} strokeOpacity={isLightTheme ? "0.35" : "0.5"} strokeDasharray="3 3" />

                {/* SVG Definitions for Gradients & Glow Filters */}
                <defs>
                  <linearGradient id="upCandleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#047857" />
                  </linearGradient>
                  <linearGradient id="downCandleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#b91c1c" />
                  </linearGradient>
                  <filter id="activeGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Horizontal Grid lines with price labels */}
                <g opacity="0.6">
                  <line x1="0" y1="25" x2="305" y2="25" stroke={isLightTheme ? "#d97706" : "#334155"} strokeOpacity={isLightTheme ? "0.2" : "0.35"} strokeDasharray="3 3" />
                  <text x="310" y="28" fill={isLightTheme ? "#b45309" : "#64748b"} fontSize="7" fontFamily="monospace" fontWeight="bold">
                    ${(min + ((200 - 25 - 25) / 145) * range).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                  </text>

                  <line x1="0" y1="100" x2="305" y2="100" stroke={isLightTheme ? "#d97706" : "#334155"} strokeOpacity={isLightTheme ? "0.2" : "0.35"} strokeDasharray="3 3" />
                  <text x="310" y="103" fill={isLightTheme ? "#b45309" : "#64748b"} fontSize="7" fontFamily="monospace" fontWeight="bold">
                    ${(min + ((200 - 100 - 25) / 145) * range).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                  </text>

                  <line x1="0" y1="175" x2="305" y2="175" stroke={isLightTheme ? "#d97706" : "#334155"} strokeOpacity={isLightTheme ? "0.2" : "0.35"} strokeDasharray="3 3" />
                  <text x="310" y="178" fill={isLightTheme ? "#b45309" : "#64748b"} fontSize="7" fontFamily="monospace" fontWeight="bold">
                    ${(min + ((200 - 175 - 25) / 145) * range).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                  </text>
                </g>

                {/* Vertical tracking crosshair line when hovering */}
                {hoveredCandle && (
                  <line
                    x1={15 + (candles.indexOf(hoveredCandle) / (candles.length - 1)) * 290}
                    y1="10"
                    x2={15 + (candles.indexOf(hoveredCandle) / (candles.length - 1)) * 290}
                    y2="190"
                    stroke="#475569"
                    strokeOpacity="0.7"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    pointerEvents="none"
                  />
                )}

                {/* Horizontal tracking intersection line when hovering */}
                {hoveredCandle && (
                  <line
                    x1="0"
                    y1={getY(hoveredCandle.close)}
                    x2="305"
                    y2={getY(hoveredCandle.close)}
                    stroke="#475569"
                    strokeOpacity="0.5"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    pointerEvents="none"
                  />
                )}

                {/* Live Real-time Price Horizontal Indicator Line (The requested Price Line) */}
                <line
                  x1="0"
                  y1={getY(liveCoin.price)}
                  x2="305"
                  y2={getY(liveCoin.price)}
                  stroke={liveCoin.change24h >= 0 ? "rgba(16, 185, 129, 0.65)" : "rgba(239, 68, 68, 0.65)"}
                  strokeWidth="1.25"
                  strokeDasharray="3 3"
                  className="animate-pulse"
                  pointerEvents="none"
                />

                {/* Pulsing target coordinate dot on live price line */}
                <circle
                  cx="305"
                  cy={getY(liveCoin.price)}
                  r="4"
                  fill={liveCoin.change24h >= 0 ? "#10b981" : "#ef4444"}
                  className="animate-ping"
                  pointerEvents="none"
                />
                <circle
                  cx="305"
                  cy={getY(liveCoin.price)}
                  r="2"
                  fill={liveCoin.change24h >= 0 ? "#34d399" : "#f87171"}
                  pointerEvents="none"
                />

                {/* Candlesticks & Volumes */}
                {candles.map((candle, i) => {
                  const cx = 15 + (i / (candles.length - 1)) * 290;
                  const yOpen = getY(candle.open);
                  const yClose = getY(candle.close);
                  const yHigh = getY(candle.high);
                  const yLow = getY(candle.low);
                  const isUp = candle.close >= candle.open;
                  const bodyWidth = 8;
                  const isActive = i === candles.length - 1;

                  // Volume bar height simulation
                  const volHeight = 10 + (Math.sin(i * 1.5) + 1.2) * 6;
                  const volY = 198 - volHeight;

                  return (
                    <g 
                      key={i}
                      className="cursor-crosshair group/candle"
                      onMouseEnter={() => setHoveredCandle(candle)}
                      onMouseLeave={() => setHoveredCandle(null)}
                    >
                      {/* Volume block at bottom */}
                      <rect
                        x={cx - bodyWidth / 2}
                        y={volY}
                        width={bodyWidth}
                        height={volHeight}
                        fill={isUp ? "#10b981" : "#ef4444"}
                        fillOpacity={isUp ? 0.2 : 0.25}
                        className="hover:fill-opacity-40 transition-all duration-150"
                        rx="1"
                      />

                      {/* Wick / Shadow line */}
                      <line
                        x1={cx}
                        y1={yHigh}
                        x2={cx}
                        y2={yLow}
                        stroke={isUp ? "#10b981" : "#ef4444"}
                        strokeWidth="1.5"
                        className="group-hover/candle:stroke-white transition-colors"
                      />

                      {/* Candle body rect */}
                      <rect
                        x={cx - bodyWidth / 2}
                        y={Math.min(yOpen, yClose)}
                        width={bodyWidth}
                        height={Math.max(2.5, Math.abs(yOpen - yClose))}
                        fill={isUp ? "url(#upCandleGrad)" : "url(#downCandleGrad)"}
                        stroke={isUp ? "#059669" : "#b91c1c"}
                        strokeWidth="0.75"
                        rx="1.5"
                        filter={isActive ? "url(#activeGlow)" : undefined}
                        className={`transition-all duration-150 group-hover/candle:stroke-white group-hover/candle:brightness-110 ${isActive ? 'animate-pulse' : ''}`}
                      />

                      {/* Hover capture block */}
                      <rect
                        x={cx - bodyWidth}
                        y="0"
                        width={bodyWidth * 2}
                        height="200"
                        fill="transparent"
                      />
                    </g>
                  );
                })}

                {/* Interactive Tooltip showing exact OHLC values on hover */}
                {hoveredCandle && (() => {
                  const hIndex = candles.indexOf(hoveredCandle);
                  const cx = 15 + (hIndex / (candles.length - 1)) * 290;
                  const isLeftHalf = hIndex < candles.length / 2;
                  
                  // Position tooltip box horizontally. If left half, show on right; if right half, show on left.
                  const tx = isLeftHalf ? cx + 12 : cx - 127;
                  
                  // Position tooltip box vertically, bounding it within safe limits of the SVG canvas height.
                  const cy = getY(hoveredCandle.close);
                  const ty = Math.max(10, Math.min(105, cy - 42));
                  
                  const isUp = hoveredCandle.close >= hoveredCandle.open;
                  
                  return (
                    <g transform={`translate(${tx}, ${ty})`} pointerEvents="none" className="transition-all duration-75">
                      {/* Tooltip Background Card with rounded corners, backdrop feel, and color-coded indicator border */}
                      <rect 
                        width="115" 
                        height="84" 
                        rx="8" 
                        fill="#090d16" 
                        fillOpacity="0.96" 
                        stroke={isUp ? "#10b981" : "#ef4444"} 
                        strokeWidth="1.25" 
                      />
                      
                      {/* Header text */}
                      <text x="8" y="14" fill="#64748b" fontSize="7" fontWeight="900" fontFamily="monospace" letterSpacing="0.5">
                        CANDLE DETAILS
                      </text>
                      <text x="107" y="14" fill={isUp ? "#34d399" : "#f87171"} fontSize="7" fontWeight="900" fontFamily="monospace" textAnchor="end">
                        {isUp ? "▲ BULLISH" : "▼ BEARISH"}
                      </text>
                      
                      {/* Divider */}
                      <line x1="8" y1="18" x2="107" y2="18" stroke="#1e293b" strokeWidth="1" />
                      
                      {/* Open Row */}
                      <text x="8" y="28" fill="#94a3b8" fontSize="7" fontFamily="monospace" fontWeight="bold">OPEN:</text>
                      <text x="107" y="28" fill="#f1f5f9" fontSize="7" fontFamily="monospace" fontWeight="900" textAnchor="end">
                        ${hoveredCandle.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </text>

                      {/* High Row */}
                      <text x="8" y="38" fill="#94a3b8" fontSize="7" fontFamily="monospace" fontWeight="bold">HIGH:</text>
                      <text x="107" y="38" fill="#34d399" fontSize="7" fontFamily="monospace" fontWeight="900" textAnchor="end">
                        ${hoveredCandle.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </text>

                      {/* Low Row */}
                      <text x="8" y="48" fill="#94a3b8" fontSize="7" fontFamily="monospace" fontWeight="bold">LOW:</text>
                      <text x="107" y="48" fill="#f87171" fontSize="7" fontFamily="monospace" fontWeight="900" textAnchor="end">
                        ${hoveredCandle.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </text>

                      {/* Close Row */}
                      <text x="8" y="58" fill="#94a3b8" fontSize="7" fontFamily="monospace" fontWeight="bold">CLOSE:</text>
                      <text x="107" y="58" fill="#f1f5f9" fontSize="7" fontFamily="monospace" fontWeight="900" textAnchor="end">
                        ${hoveredCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </text>

                      {/* Actual Candle Time Row */}
                      <text x="8" y="68" fill="#94a3b8" fontSize="7" fontFamily="monospace" fontWeight="bold">TIME:</text>
                      <text x="107" y="68" fill="#a7f3d0" fontSize="7" fontFamily="monospace" fontWeight="900" textAnchor="end">
                        {formatCandleTime(hoveredCandle.timestamp, chartTimeframe)}
                      </text>

                      {/* Simulated Volume Row */}
                      <text x="8" y="78" fill="#64748b" fontSize="6.5" fontFamily="monospace" fontWeight="bold">VOLUME:</text>
                      <text x="107" y="78" fill="#94a3b8" fontSize="6.5" fontFamily="monospace" fontWeight="bold" textAnchor="end">
                        {(hoveredCandle.volume || 100).toFixed(0)}k USDT
                      </text>
                    </g>
                  );
                })()}
              </svg>

              {/* Dynamic Floating Price Tag Bubble on right aligned with the live price line */}
              <div 
                className="absolute text-[8px] font-mono font-bold select-none pointer-events-none transition-all duration-300 px-1.5 py-0.5 rounded shadow-lg flex items-center gap-1 border border-slate-700/50"
                style={{ 
                  right: '44px',
                  top: `${getY(liveCoin.price)}px`, 
                  transform: 'translateY(-50%)',
                  backgroundColor: liveCoin.change24h >= 0 ? 'rgba(6, 78, 59, 0.95)' : 'rgba(127, 29, 29, 0.95)',
                  borderColor: liveCoin.change24h >= 0 ? '#10b981' : '#ef4444',
                  color: '#ffffff'
                }}
              >
                <span className="relative flex h-1 w-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1 w-1 bg-white"></span>
                </span>
                <span>${liveCoin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
              </div>

              {/* Chart Labels */}
              <div className={`absolute top-1 left-2 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${
                isLightTheme 
                  ? 'text-zinc-600 bg-white border-emerald-200 shadow-2xs' 
                  : 'text-zinc-500 bg-slate-950/80 border-slate-900'
              }`}>
                High: ${max.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`absolute bottom-1 left-2 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${
                isLightTheme 
                  ? 'text-zinc-600 bg-white border-emerald-200 shadow-2xs' 
                  : 'text-zinc-500 bg-slate-950/80 border-slate-900'
              }`}>
                Low: ${min.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* High Fidelity Financial Statistics Grid Card */}
          <div className="grid grid-cols-2 gap-2.5 select-none">
            <div className={`p-3.5 rounded-2xl flex flex-col justify-between border ${
              isLightTheme 
                ? 'bg-white border-emerald-200/90 shadow-sm' 
                : 'bg-slate-950/50 border-slate-850'
            }`}>
              <span className="text-[8px] text-zinc-500 font-extrabold uppercase tracking-wider block">24h Volume</span>
              <span className={`text-sm font-mono font-bold mt-1 block ${
                isLightTheme ? 'text-zinc-800' : 'text-zinc-200'
              }`}>
                {vol24h}
              </span>
            </div>
            <div className={`p-3.5 rounded-2xl flex flex-col justify-between border ${
              isLightTheme 
                ? 'bg-white border-emerald-200/90 shadow-sm' 
                : 'bg-slate-950/50 border-slate-850'
            }`}>
              <span className="text-[8px] text-zinc-500 font-extrabold uppercase tracking-wider block">Market Capitalization</span>
              <span className={`text-sm font-mono font-bold mt-1 block ${
                isLightTheme ? 'text-zinc-800' : 'text-zinc-200'
              }`}>
                {mcap24h}
              </span>
            </div>
          </div>

          {/* Holding Information banner */}
          <div className={`p-3.5 rounded-2xl flex justify-between items-center select-none border ${
            isLightTheme 
              ? 'bg-white border-emerald-200/90 shadow-sm' 
              : 'bg-slate-850/60 border-slate-750'
          }`}>
            <div>
              <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider block">Your Holdings</span>
              <span className={`text-xs font-bold font-mono mt-0.5 block ${
                isLightTheme ? 'text-zinc-700' : 'text-zinc-300'
              }`}>
                {holding.toLocaleString(undefined, {
                  minimumFractionDigits: liveCoin.symbol === 'BTC' || liveCoin.symbol === 'ETH' ? 6 : 2,
                  maximumFractionDigits: liveCoin.symbol === 'BTC' || liveCoin.symbol === 'ETH' ? 8 : 4
                })} {liveCoin.symbol}
                {getLockedAmount(liveCoin.symbol) > 0 && (
                  <span className="text-[9px] text-[#008B47] block font-bold mt-1">
                    Available: {(holding - getLockedAmount(liveCoin.symbol)).toLocaleString(undefined, {
                      minimumFractionDigits: liveCoin.symbol === 'BTC' || liveCoin.symbol === 'ETH' ? 6 : 2,
                      maximumFractionDigits: liveCoin.symbol === 'BTC' || liveCoin.symbol === 'ETH' ? 8 : 4
                    })} {liveCoin.symbol} (Locked: {getLockedAmount(liveCoin.symbol).toLocaleString(undefined, {
                      minimumFractionDigits: liveCoin.symbol === 'BTC' || liveCoin.symbol === 'ETH' ? 6 : 2,
                      maximumFractionDigits: liveCoin.symbol === 'BTC' || liveCoin.symbol === 'ETH' ? 8 : 4
                    })})
                  </span>
                )}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider block">USDT VALUE</span>
              <span className="text-xs text-emerald-500 font-black font-mono mt-0.5 block">${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* BUY/SELL Interactive Form */}
          <div className={`space-y-4 pt-5 border-t ${
            isLightTheme ? 'border-emerald-200/80' : 'border-slate-800'
          }`}>
            <div className="flex justify-between items-center select-none">
              <span className={`text-xs font-black uppercase tracking-wider ${
                isLightTheme ? 'text-zinc-700' : 'text-zinc-300'
              }`}>Trading Desk</span>
              <span className="text-[10px] text-zinc-500 font-bold">
                Available: ${Math.max(0, getCoinHolding('USDT') - getLockedAmount('USDT')).toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
                {getLockedAmount('USDT') > 0 && ` ($${getCoinHolding('USDT').toLocaleString(undefined, { minimumFractionDigits: 2 })} total)`}
              </span>
            </div>

            {/* BUY / SELL Switch tabs */}
            <div className={`grid grid-cols-2 p-1 border rounded-xl gap-1 ${
              isLightTheme ? 'bg-white border-emerald-200/90 shadow-sm' : 'bg-slate-950 border-slate-850'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setQuickTradeType('BUY');
                  setTradeMessage(null);
                }}
                className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  quickTradeType === 'BUY'
                    ? 'bg-[#008B47] text-white shadow-md shadow-emerald-500/10'
                    : isLightTheme
                      ? 'bg-emerald-50 text-[#007038] border border-emerald-200/50 hover:bg-emerald-100'
                      : 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/10 hover:bg-emerald-900/20 hover:text-emerald-300'
                }`}
              >
                BUY {liveCoin.symbol}
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuickTradeType('SELL');
                  setTradeMessage(null);
                }}
                className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  quickTradeType === 'SELL'
                    ? 'bg-red-500 text-white shadow-md shadow-red-500/10'
                    : isLightTheme
                      ? 'bg-red-50 text-red-600 border border-red-200/50 hover:bg-red-100 hover:text-red-700'
                      : 'bg-red-950/20 text-red-400 border border-red-900/10 hover:bg-red-900/20 hover:text-red-300'
                }`}
              >
                SELL {liveCoin.symbol}
              </button>
            </div>

            {/* Input field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Order Size ({liveCoin.symbol})</label>
                
                {/* Percent shortcuts */}
                <div className="flex gap-1">
                  {([25, 50, 75, 100] as const).map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        if (quickTradeType === 'BUY') {
                          const availableSpend = Math.max(0, getCoinHolding('USDT') - getLockedAmount('USDT'));
                          const spend = availableSpend * (pct / 100);
                          setQuickTradeAmount(parseFloat((spend / liveCoin.price).toFixed(6)).toString());
                        } else {
                          const lockedCoin = getLockedAmount(liveCoin.symbol);
                          const unlockedHolding = Math.max(0, holding - lockedCoin);
                          const sellAmt = unlockedHolding * (pct / 100);
                          setQuickTradeAmount(parseFloat(sellAmt.toFixed(6)).toString());
                        }
                        setTradeMessage(null);
                      }}
                      className={`px-1.5 py-0.5 text-[8px] font-bold rounded active:scale-95 cursor-pointer border ${
                        isLightTheme 
                          ? 'text-zinc-600 bg-white border-emerald-200 hover:text-[#008B47] hover:bg-emerald-50' 
                          : 'text-zinc-400 bg-slate-950 border border-slate-850 hover:text-white'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <input
                  type="number"
                  placeholder={`0.00 ${liveCoin.symbol}`}
                  value={quickTradeAmount}
                  onChange={(e) => {
                    setQuickTradeAmount(e.target.value);
                    setTradeMessage(null);
                  }}
                  className={`w-full p-3.5 pr-20 border rounded-2xl text-xs focus:outline-none font-mono transition-all ${
                    isLightTheme ? 'bg-white text-zinc-800' : 'bg-slate-950 text-white'
                  } ${
                    quickTradeType === 'BUY'
                      ? isLightTheme
                        ? 'border-emerald-200 focus:border-[#008B47] focus:ring-1 focus:ring-emerald-500/10'
                        : 'border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20'
                      : isLightTheme
                        ? 'border-amber-300/90 focus:border-red-500 focus:ring-1 focus:ring-red-500/10'
                        : 'border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'
                  }`}
                />
                <span className="absolute right-4 top-3.5 text-xs text-zinc-500 font-bold font-mono uppercase">{liveCoin.symbol}</span>
              </div>

              {/* Calculated estimated value subtext */}
              {quickTradeAmount && parseFloat(quickTradeAmount) > 0 && (
                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono px-1">
                  <span>Estimated Value:</span>
                  <span className={`font-bold ${isLightTheme ? 'text-zinc-700' : 'text-zinc-300'}`}>
                    $ {((parseFloat(quickTradeAmount) || 0) * liveCoin.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </span>
                </div>
              )}
            </div>



            {/* Submission Button */}
            <button
              type="button"
              disabled={tradeLoading || !quickTradeAmount || parseFloat(quickTradeAmount) <= 0}
              onClick={() => handleBuySellCrypto(liveCoin.symbol, quickTradeType, quickTradeAmount)}
              className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg active:scale-[0.985] disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${
                quickTradeType === 'BUY' 
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 shadow-emerald-500/10' 
                  : 'bg-gradient-to-tr from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white shadow-rose-500/10'
              }`}
            >
              {tradeLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span>Executing Order...</span>
                </>
              ) : (
                <span>Place {quickTradeType} Order</span>
              )}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Calculate MMF Earn totals
  const activeInvs = activeInvestments.filter((inv: any) => inv.status === 'active');
  const totalInvestedUSD = activeInvs.reduce((sum: number, inv: any) => {
    const liveCoin = cryptoPrices.find((c: any) => c.symbol === inv.coinSymbol);
    return sum + inv.amount * (liveCoin ? liveCoin.price : 0);
  }, 0);

  const totalDailyProfitUSD = activeInvs.reduce((sum: number, inv: any) => {
    const liveCoin = cryptoPrices.find((c: any) => c.symbol === inv.coinSymbol);
    const dailyEarningCoin = inv.amount * (inv.dailyRate / 100);
    return sum + dailyEarningCoin * (liveCoin ? liveCoin.price : 0);
  }, 0);

  const isHideHeader = 
    Boolean(arbitrageGuideCoin) || 
    Boolean(activeRunningBot) || 
    (activeTab === 'trade' && botHubView !== 'menu') ||
    activeTab === 'earn';

  const isHideFooter = 
    Boolean(arbitrageGuideCoin) || 
    Boolean(activeRunningBot) || 
    (activeTab === 'trade' && botHubView !== 'menu') ||
    (activeTab === 'earn' && mmfSubView === 'form') ||
    Boolean(selectedLeadForCopy);

  return (
    <div 
      id="user-dashboard-root" 
      className={`min-h-screen font-sans transition-colors duration-300 ${
        isHideFooter ? 'pb-10' : 'pb-28'
      } ${
        isLightTheme ? 'bg-[#EBF9F0] text-zinc-800' : 'bg-slate-900 text-zinc-100'
      }`}
    >
      {/* Top Header */}
      {!isHideHeader && (
        <header className={`px-4 py-4 border-b sticky top-0 backdrop-blur-md z-20 flex justify-between items-center transition-colors duration-300 ${
          isLightTheme 
            ? 'bg-[#EBF9F0]/85 border-zinc-200/80' 
            : 'bg-slate-900/85 border-slate-800'
        }`}>
          <div className="flex items-center gap-2">
            <button 
              id="profile-toggle-btn"
              onClick={onOpenProfile}
              className={`w-12 h-12 rounded-full p-[1.5px] hover:scale-105 active:scale-95 transition-all duration-300 group cursor-pointer relative ${
                isLightTheme
                  ? 'bg-gradient-to-tr from-[#008B47] via-[#00A653] to-[#80D824] shadow-[0_0_12px_rgba(0,139,71,0.2)] hover:shadow-[0_0_16px_rgba(0,139,71,0.35)]'
                  : 'bg-gradient-to-tr from-emerald-400 via-teal-500 to-indigo-500 shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:shadow-[0_0_16px_rgba(16,185,129,0.3)]'
              }`}
            >
              <div className={`w-full h-full rounded-full flex items-center justify-center transition-all relative overflow-hidden ${
                isLightTheme ? 'bg-white text-[#008B47] group-hover:text-[#007038]' : 'bg-slate-900 text-emerald-400 group-hover:text-white'
              }`}>
                <div className="absolute z-10">
                  <User size={14} className="group-hover:scale-110 transition-transform duration-300" />
                </div>
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full animate-[spin_12s_linear_infinite] group-hover:animate-[spin_6s_linear_infinite] transition-all duration-500 pointer-events-none">
                  <defs>
                    <path
                      id="dashboardHeaderProfileCirclePath"
                      d="M 50,50 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0"
                    />
                  </defs>
                  <text className={`text-[9.5px] font-black uppercase tracking-[0.16em] transition-colors duration-300 ${
                    isLightTheme ? 'fill-amber-500/70 group-hover:fill-amber-600' : 'fill-emerald-400/70 group-hover:fill-emerald-300'
                  }`}>
                    <textPath href="#dashboardHeaderProfileCirclePath" startOffset="0%">
                      PROFILE • PROFILE • PROFILE 
                    </textPath>
                  </text>
                </svg>
              </div>
            </button>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLightTheme ? 'text-zinc-400' : 'text-zinc-500'}`}>Logged In</span>
              <span className={`text-xs font-black tracking-tight transition-colors duration-300 ${isLightTheme ? 'text-zinc-800' : 'text-zinc-200'}`}>
                {profile?.displayName || user.displayName || user.email.split('@')[0]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="dashboard-logout-btn"
              onClick={onLogout}
              className={`px-3 py-1.5 border text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                isLightTheme
                  ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600'
                  : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/25 text-rose-400 hover:text-rose-300'
              }`}
              title="Log Out"
            >
              <LogOut size={11} />
              <span>LOG OUT</span>
            </button>
          </div>
        </header>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
          <RefreshCw size={28} className={`${isLightTheme ? 'text-amber-500' : 'text-emerald-500'} animate-spin`} />
          <span className="text-xs text-zinc-500 font-semibold">Decrypting wallet keys...</span>
        </div>
      ) : (
        <main className={`max-w-4xl mx-auto px-4 space-y-6 ${isHideHeader ? 'pt-4' : 'mt-5'}`}>
          {activeRunningBot ? (
            <RunningBotView
              bot={activeRunningBot}
              user={user}
              userBalance={getWalletBalance(profile)}
              isLightTheme={isLightTheme}
              isOffline={isUsingFallbackPrices || Boolean(pricesLoadError) || (typeof navigator !== 'undefined' && !navigator.onLine)}
              onBack={() => setActiveRunningBot(null)}
              onTradeAgain={(botToRestart) => {
                setActiveRunningBot(null);
                const matchedTemplate = botTemplates.find((t: any) => t.id === botToRestart?.templateId) || {
                  id: botToRestart?.templateId || 'bot-template',
                  name: botToRestart?.name || 'Trading Bot',
                  category: botToRestart?.category || 'Trading Bot',
                  minCapital: botToRestart?.capital || 20,
                  tradingPairs: [botToRestart?.tradingPair || 'BTC/USDT'],
                  winRatioRange: '80% - 95%',
                  riskLevel: 'Moderate'
                };
                setSelectedBotTemplate(matchedTemplate);
                setBotCapitalInput((botToRestart?.capital || matchedTemplate.minCapital || 20).toString());
                setBotSelectedPair(botToRestart?.tradingPair || matchedTemplate.tradingPairs[0] || 'BTC/USDT');
                setBotDurationSeconds(botToRestart?.durationSeconds || 60);
              }}
              onGoToHistory={() => {
                setActiveRunningBot(null);
                setActiveTab('history');
              }}
            />
          ) : (
            <>
          {pricesLoadError && (
            <div className={`flex items-start gap-2.5 p-3.5 border rounded-2xl text-[11px] font-medium leading-relaxed shadow-lg animate-fade-in transition-colors duration-300 ${
              isLightTheme
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              <AlertCircle size={15} className={`shrink-0 mt-0.5 ${activeTab === 'home' ? 'text-amber-600' : 'text-amber-400'}`} />
              <div className="flex-1">
                <span className="font-bold">Offline Rates Active: </span>
                {pricesLoadError}
              </div>
            </div>
          )}
          
          {arbitrageGuideCoin ? (() => {
            const liveGuideCoin = cryptoPrices.find(c => c.symbol === arbitrageGuideCoin.symbol);
            const currentGuidePrice = liveGuideCoin ? liveGuideCoin.price : arbitrageGuideCoin.price;
            const guidePriceRatio = arbitrageGuideCoin.price > 0 ? currentGuidePrice / arbitrageGuideCoin.price : 1;
            const currentExtMin = arbitrageGuideCoin.extMin * guidePriceRatio;
            const currentExtMax = arbitrageGuideCoin.extMax * guidePriceRatio;
            const currentAvgExt = (currentExtMin + currentExtMax) / 2;
            const currentSpread = Math.max(0, currentGuidePrice - currentAvgExt);
            const currentSpreadPct = currentAvgExt > 0 ? (currentSpread / currentAvgExt) * 100 : arbitrageGuideCoin.spreadPct;

            return (
              <div className="space-y-6 animate-fade-in pb-10">
                {/* Top Navigation / Back Header */}
                <div className="flex items-center gap-3 border-b pb-4 border-zinc-200/80 dark:border-zinc-700/80">
                  <button
                    onClick={() => setArbitrageGuideCoin(null)}
                    className={`p-2.5 rounded-xl font-black transition-all cursor-pointer shadow-xs flex items-center justify-center ${
                      isLightTheme 
                        ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200/80' 
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    }`}
                    title="Back to Dashboard"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <h2 className={`text-sm sm:text-base font-black uppercase tracking-wider ${
                    isLightTheme ? 'text-zinc-900' : 'text-white'
                  }`}>
                    ⚡ {arbitrageGuideCoin.symbol} CME GUIDE
                  </h2>
                </div>

                {/* Coin Dedicated Header - Matches Arbitrage Card Theme */}
                <div className={`p-5 sm:p-6 rounded-3xl border space-y-4 ${
                  isLightTheme 
                    ? 'bg-white border-emerald-200/90 shadow-sm' 
                    : 'bg-slate-900/40 border-slate-850/70'
                }`}>
                  <div className="flex items-center gap-4">
                    <CoinIcon symbol={arbitrageGuideCoin.symbol} className="w-12 h-12 rounded-full shrink-0 shadow-xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className={`text-lg sm:text-xl font-black tracking-tight ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                          {arbitrageGuideCoin.name} ({arbitrageGuideCoin.symbol})
                        </h1>
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                          isLightTheme ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}>
                          +{currentSpreadPct.toFixed(2)}% Spread
                        </span>
                      </div>
                      <p className={`text-xs font-medium mt-0.5 ${isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}`}>
                        Dedicated Arbitrage Trading Tutorial & Market Rate Spread
                      </p>
                    </div>
                  </div>

                  {/* Price badges comparison row */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className={`p-3 rounded-2xl border flex flex-col justify-between ${
                      isLightTheme ? 'bg-rose-500/10 border-rose-200' : 'bg-rose-500/10 border-rose-500/20'
                    }`}>
                      <span className={`block text-[9px] font-extrabold uppercase tracking-wider mb-1 ${
                        isLightTheme ? 'text-black' : 'text-black font-extrabold bg-white/90 px-1 rounded-[3px] inline-block w-fit'
                      }`}>
                        Price in Binance, OKX, Bybit
                      </span>
                      <span className={`font-black font-mono text-xs ${isLightTheme ? 'text-rose-700' : 'text-rose-300'}`}>
                        ${currentExtMin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} - ${currentExtMax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </span>
                    </div>

                    <div className={`p-3 rounded-2xl border flex flex-col justify-between ${
                      isLightTheme ? 'bg-emerald-500/10 border-emerald-300' : 'bg-emerald-500/10 border-emerald-500/20'
                    }`}>
                      <span className={`block text-[9px] font-extrabold uppercase tracking-wider mb-1 ${
                        isLightTheme ? 'text-black' : 'text-black font-extrabold bg-white/90 px-1 rounded-[3px] inline-block w-fit'
                      }`}>
                        Price here
                      </span>
                      <span className={`font-black font-mono text-xs ${isLightTheme ? 'text-emerald-700' : 'text-emerald-300'}`}>
                        ${currentGuidePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step-by-Step Tutorial Guide */}
                <div className={`p-5 sm:p-6 rounded-3xl border space-y-4 ${
                  isLightTheme ? 'bg-white border-zinc-200/80 shadow-md' : 'bg-slate-800 border-slate-700/80'
                }`}>
                  <div className="flex items-center gap-2 border-b pb-3 border-zinc-200/60 dark:border-zinc-700/60">
                    <BookOpen className="text-amber-500 shrink-0" size={18} />
                    <div>
                      <h2 className={`text-sm sm:text-base font-black uppercase tracking-wide ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                        STEPS TO FOLLOW
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {/* Step 1 */}
                    <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
                      isLightTheme ? 'bg-zinc-50 border-zinc-200/80' : 'bg-slate-900/60 border-slate-700/60'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          isLightTheme ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-slate-950'
                        }`}>1</span>
                        <h3 className={`text-xs font-black ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                          Acquire {arbitrageGuideCoin.symbol} on External Exchanges
                        </h3>
                      </div>
                      <p className={`text-xs leading-relaxed pl-8 ${isLightTheme ? 'text-zinc-600' : 'text-zinc-300'}`}>
                        Purchase <strong className="font-bold">{arbitrageGuideCoin.name} ({arbitrageGuideCoin.symbol})</strong> on major exchanges like <strong className="font-bold">{arbitrageGuideCoin.platforms.join(', ')}</strong> where it trades lower at <strong className="font-bold">${currentExtMin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} – ${currentExtMax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</strong>.
                      </p>
                    </div>

                    {/* Step 2 */}
                    <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
                      isLightTheme ? 'bg-zinc-50 border-zinc-200/80' : 'bg-slate-900/60 border-slate-700/60'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          isLightTheme ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-slate-950'
                        }`}>2</span>
                        <h3 className={`text-xs font-black ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                          Transfer {arbitrageGuideCoin.symbol} to Platform Wallet
                        </h3>
                      </div>
                      <p className={`text-xs leading-relaxed pl-8 ${isLightTheme ? 'text-zinc-600' : 'text-zinc-300'}`}>
                        Navigate to <strong className="font-bold">Wallet &gt; Deposit</strong> on this platform, choose <strong className="font-bold">{arbitrageGuideCoin.symbol}</strong>, copy your address, and transfer your tokens from your exchange account.
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
                      isLightTheme ? 'bg-zinc-50 border-zinc-200/80' : 'bg-slate-900/60 border-slate-700/60'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          isLightTheme ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-slate-950'
                        }`}>3</span>
                        <h3 className={`text-xs font-black ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                          Sell at Premium Rate (${currentGuidePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })})
                        </h3>
                      </div>
                      <p className={`text-xs leading-relaxed pl-8 ${isLightTheme ? 'text-zinc-600' : 'text-zinc-300'}`}>
                        Once your deposit confirms, swap your <strong className="font-bold">{arbitrageGuideCoin.symbol}</strong> at our elevated platform rate of <strong className="font-bold text-emerald-600 dark:text-emerald-400">${currentGuidePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</strong> to capture your <strong className="font-bold text-amber-600 dark:text-amber-400">+{currentSpreadPct.toFixed(2)}% profit margin</strong>.
                      </p>
                    </div>

                    {/* Step 4 */}
                    <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
                      isLightTheme ? 'bg-zinc-50 border-zinc-200/80' : 'bg-slate-900/60 border-slate-700/60'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          isLightTheme ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-slate-950'
                        }`}>4</span>
                        <h3 className={`text-xs font-black ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                          Instant Profit Settlement
                        </h3>
                      </div>
                      <p className={`text-xs leading-relaxed pl-8 ${isLightTheme ? 'text-zinc-600' : 'text-zinc-300'}`}>
                        Your profits are instantly credited to your wallet balance. Withdraw anytime or repeat the arbitrage sequence.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Floating Draggable Deposit Button */}
                <motion.button
                  drag
                  dragMomentum={false}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const sym = arbitrageGuideCoin?.symbol;
                    if (sym) {
                      sessionStorage.setItem('preselected_deposit_coin', sym);
                      localStorage.setItem('preselected_deposit_coin', sym);
                    }
                    setArbitrageGuideCoin(null);
                    onOpenDeposit(sym);
                  }}
                  className={`fixed bottom-8 right-6 z-50 px-5 py-3.5 rounded-2xl font-black text-xs sm:text-sm shadow-2xl flex items-center gap-2.5 cursor-grab active:cursor-grabbing border select-none ${
                    isLightTheme 
                      ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-400/80 shadow-amber-500/30' 
                      : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 border-emerald-400/80 shadow-emerald-500/30'
                  }`}
                >
                  <Sparkles size={16} className="animate-pulse shrink-0" />
                  <span>Deposit {arbitrageGuideCoin.symbol} Now</span>
                </motion.button>
              </div>
            );
          })() : (
            <>
              {/* TAB 1: HOME */}
          {activeTab === 'home' && (
            <>
              {/* Wallet Card */}
              <div id="wallet-balance-card" className="relative overflow-hidden rounded-3xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-500 p-6 text-white shadow-xl shadow-amber-500/10">
                {/* Micro Ambient Details */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -ml-10 -mb-10" />

                <div className="flex justify-between items-start select-none">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">Wallet Balance</span>
                      <button
                        onClick={() => setIsBalanceBlurred(!isBalanceBlurred)}
                        className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
                        title={isBalanceBlurred ? "Reveal balance" : "Hide balance"}
                      >
                        {isBalanceBlurred ? <EyeOff size={13} strokeWidth={2.5} /> : <Eye size={13} strokeWidth={2.5} />}
                      </button>
                    </div>
                    <h2 className={`text-3xl font-black tracking-tight font-mono mt-1 transition-all duration-300 ${
                      isBalanceBlurred ? 'filter blur-md select-none pointer-events-none' : ''
                    }`}>
                      $ {totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h2>
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-white border border-white/20 text-[9px] font-black uppercase tracking-wider text-black shadow-sm">
                    USDT WALLET
                  </div>
                </div>

                {/* Deposit & Withdraw Prominent Buttons */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-6">
                  <button
                    id="add-funds-btn"
                    onClick={onOpenDeposit}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-extrabold text-[11px] sm:text-xs rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer min-w-0"
                  >
                    <ArrowDownLeft size={15} strokeWidth={3} className="text-white shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="whitespace-nowrap truncate">Add Funds</span>
                  </button>

                  <button
                    id="withdraw-funds-btn"
                    onClick={onOpenWithdraw}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 bg-white hover:bg-zinc-100 border border-white/20 text-slate-950 font-extrabold text-[11px] sm:text-xs rounded-2xl transition-all shadow-sm active:scale-95 cursor-pointer min-w-0"
                  >
                    <ArrowUpRight size={15} strokeWidth={3} className="text-slate-950 shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="whitespace-nowrap truncate">Withdraw</span>
                  </button>
                </div>
              </div>

              {/* News slideshow */}
              <NewsCarousel cryptoPrices={cryptoPrices} />

              {/* Live Crypto Prices container with search bar */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className={`text-xs font-black uppercase tracking-wider transition-colors duration-300 ${activeTab === 'home' ? 'text-zinc-500' : 'text-zinc-400'}`}>CRYPTO MARKET</h3>
                  <span className={`text-[10px] font-semibold transition-colors duration-300 ${activeTab === 'home' ? 'text-zinc-400' : 'text-zinc-500'}`}>Live Feed</span>
                </div>

                {/* Token grid list */}
                <div id="live-crypto-list" className="grid grid-cols-2 gap-3">
                  {filteredCrypto.map(coin => (
                    <div 
                      key={coin.symbol} 
                      onClick={() => {
                        setSelectedCoin(coin);
                        setTradeMessage(null);
                        setQuickTradeAmount('');
                        setQuickTradeType('BUY');
                      }}
                      className={`border rounded-2xl p-3.5 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 cursor-pointer group flex flex-col justify-between gap-3 min-h-[105px] ${
                        activeTab === 'home'
                          ? 'bg-white border-emerald-200/90 hover:border-emerald-400 hover:bg-[#F4FBF6] shadow-sm'
                          : 'bg-slate-800/60 border-slate-750 hover:bg-slate-800/90'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CoinIcon symbol={coin.symbol} className="w-8 h-8" />
                          <div className="min-w-0">
                            <span className={`font-bold text-xs block truncate transition-colors duration-300 ${
                              activeTab === 'home' ? 'text-zinc-800 group-hover:text-[#008B47]' : 'text-zinc-200 group-hover:text-white'
                            }`}>{coin.name}</span>
                            <span className={`text-[10px] uppercase tracking-wider font-semibold block transition-colors duration-300 ${
                              activeTab === 'home' ? 'text-zinc-400' : 'text-zinc-500'
                            }`}>{coin.symbol}</span>
                          </div>
                        </div>
                        <div className={`transition-colors duration-300 shrink-0 ${
                          activeTab === 'home' ? 'text-zinc-300 group-hover:text-[#008B47]' : 'text-zinc-600 group-hover:text-emerald-400'
                        }`}>
                          <ArrowRight size={13} className="transform group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>

                      <div className="flex items-end justify-between">
                        <div>
                          <span className={`font-bold text-xs font-mono block transition-colors duration-300 ${
                            activeTab === 'home' ? 'text-zinc-800' : 'text-zinc-200'
                          }`}>
                            ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </span>
                        </div>
                        <div className={`flex items-center gap-0.5 text-[10px] font-bold shrink-0 transition-colors duration-300 ${
                          coin.change24h >= 0 
                            ? (activeTab === 'home' ? 'text-emerald-600' : 'text-emerald-400') 
                            : (activeTab === 'home' ? 'text-rose-600' : 'text-rose-400')
                        }`}>
                          {coin.change24h >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          <span>{coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredCrypto.length === 0 && (
                    <div className="col-span-2 p-6 text-center bg-slate-800/60 border border-slate-750 rounded-2xl">
                      <p className="text-zinc-500 text-xs font-medium">No supported token matched your query.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: DETAILED WALLET TRANSACTIONS */}
          {activeTab === 'wallet' && (
            <div className="space-y-5 animate-fade-in">
              {/* Wallet Card */}
              <div id="wallet-tab-balance-card" className="relative overflow-hidden rounded-3xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-500 p-6 text-white shadow-xl shadow-amber-500/10">
                {/* Micro Ambient Details */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -ml-10 -mb-10" />

                <div className="flex justify-between items-start select-none">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">Wallet Balance</span>
                      <button
                        onClick={() => setIsBalanceBlurred(!isBalanceBlurred)}
                        className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
                        title={isBalanceBlurred ? "Reveal balance" : "Hide balance"}
                      >
                        {isBalanceBlurred ? <EyeOff size={13} strokeWidth={2.5} /> : <Eye size={13} strokeWidth={2.5} />}
                      </button>
                    </div>
                    <h2 className={`text-3xl font-black tracking-tight font-mono mt-1 transition-all duration-300 ${
                      isBalanceBlurred ? 'filter blur-md select-none pointer-events-none' : ''
                    }`}>
                      $ {totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h2>
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-white border border-white/20 text-[9px] font-black uppercase tracking-wider text-black shadow-sm">
                    USDT WALLET
                  </div>
                </div>

                {/* Deposit, SEND & Withdraw Prominent Buttons */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-3 mt-6">
                  <button
                    id="add-funds-btn-wallet-tab"
                    onClick={onOpenDeposit}
                    className="flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3 px-1.5 sm:px-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-extrabold text-[10.5px] sm:text-xs rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer min-w-0 tracking-tight"
                  >
                    <ArrowDownLeft strokeWidth={3} className="text-white shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="whitespace-nowrap truncate">Add Funds</span>
                  </button>

                  <button
                    id="send-funds-btn-wallet-tab"
                    onClick={onOpenSend}
                    className="flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3 px-1.5 sm:px-3 bg-amber-500 hover:bg-amber-600 border border-amber-400 text-white font-extrabold text-[10.5px] sm:text-xs rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer min-w-0 tracking-tight"
                  >
                    <Send strokeWidth={2.5} className="text-white shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="whitespace-nowrap truncate">SEND</span>
                  </button>

                  <button
                    id="withdraw-funds-btn-wallet-tab"
                    onClick={onOpenWithdraw}
                    className="flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3 px-1.5 sm:px-3 bg-white hover:bg-zinc-100 border border-white/20 text-slate-950 font-extrabold text-[10.5px] sm:text-xs rounded-2xl transition-all shadow-sm active:scale-95 cursor-pointer min-w-0 tracking-tight"
                  >
                    <ArrowUpRight strokeWidth={3} className="text-slate-950 shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="whitespace-nowrap truncate">Withdraw</span>
                  </button>
                </div>
              </div>

              {/* Promo Code & Voucher Banner Quick Card */}
              <div 
                id="wallet-promo-voucher-banner"
                onClick={() => {
                  localStorage.setItem('profile_subpage', 'vouchers');
                  onOpenProfile();
                }}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between gap-3 shadow-sm hover:scale-[1.01] active:scale-[0.99] ${
                  isLightTheme 
                    ? 'bg-white border-emerald-200/90 hover:border-emerald-300 shadow-sm' 
                    : 'bg-slate-800/90 border-slate-700/80 hover:border-emerald-500/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-all ${
                    isLightTheme 
                      ? 'bg-[#008B47] text-white shadow-xs' 
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    <Tag size={18} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-xs font-black truncate tracking-tight ${
                        isLightTheme ? 'text-zinc-900' : 'text-zinc-100'
                      }`}>
                        Have a Promo Code or Voucher?
                      </h4>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 tracking-wider font-mono ${
                        isLightTheme 
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        REWARDS
                      </span>
                    </div>
                    <p className={`text-[11px] font-semibold truncate mt-0.5 ${
                      isLightTheme ? 'text-zinc-600' : 'text-zinc-400'
                    }`}>
                      Redeem instant cash, trade bonuses, or VIP signals
                    </p>
                  </div>
                </div>

                <div className={`flex items-center gap-1 shrink-0 text-xs font-black px-2.5 py-1 rounded-xl transition-all ${
                  isLightTheme 
                    ? 'bg-[#008B47] hover:bg-[#007038] text-white shadow-2xs group-hover:shadow-xs' 
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                }`}>
                  <span>Redeem</span>
                  <ChevronRight size={14} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

               {/* Asset Holdings Section */}
              <div id="wallet-assets-holdings" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-zinc-400 uppercase tracking-wider">Asset Holdings</h3>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    {userAssets.filter(a => a.coinAmount > 0).length || 0} Assets
                  </span>
                </div>

                {/* Visual Distribution Bar */}
                <div id="assets-distribution-bar" className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
                  {userAssets.map(asset => {
                    const pct = totalPortfolioValue > 0 ? (asset.usdValue / totalPortfolioValue) * 100 : 0;
                    if (pct === 0) return null;
                    
                    let barColor = 'bg-emerald-400';
                    if (asset.symbol === 'BTC') barColor = 'bg-amber-500';
                    if (asset.symbol === 'ETH') barColor = 'bg-indigo-400';
                    if (asset.symbol === 'USDC') barColor = 'bg-cyan-400';
                    if (asset.symbol === 'SOL') barColor = 'bg-purple-400';
                    if (asset.symbol === 'BNB') barColor = 'bg-yellow-400';

                    return (
                      <div 
                        key={asset.symbol} 
                        style={{ width: `${pct}%` }} 
                        className={`${barColor} h-full transition-all duration-500`}
                        title={`${asset.symbol}: ${pct.toFixed(1)}%`}
                      />
                    );
                  })}
                  {totalPortfolioValue === 0 && (
                    <div className={`w-full h-full ${isLightTheme ? 'bg-zinc-200' : 'bg-slate-800'}`} />
                  )}
                </div>

                {/* Assets Grid/List */}
                <div className="grid grid-cols-1 gap-2.5">
                  {userAssets.filter(asset => asset.coinAmount > 0).map(asset => {
                    const assetPct = totalPortfolioValue > 0 ? (asset.usdValue / totalPortfolioValue) * 100 : 0;
                    return (
                      <div 
                        key={asset.symbol}
                        id={`asset-card-${asset.symbol.toLowerCase()}`}
                        onClick={() => {
                          const originalCoin = cryptoPrices.find(c => c.symbol === asset.symbol);
                          if (originalCoin) {
                            setSelectedCoin(originalCoin);
                            setTradeMessage(null);
                            setQuickTradeAmount('');
                            setQuickTradeType('BUY');
                          }
                        }}
                        className={`flex flex-col p-4 border rounded-2xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer group ${
                          isLightTheme 
                            ? 'bg-white border-emerald-200/90 hover:border-emerald-300 hover:bg-[#F4FBF6] shadow-sm' 
                            : 'bg-slate-800/80 border-slate-700/65 hover:border-slate-500 hover:bg-slate-800/95'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <CoinIcon symbol={asset.symbol} className="w-10 h-10" />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className={`font-bold text-xs transition-colors ${isLightTheme ? 'text-zinc-800 group-hover:text-[#008B47]' : 'text-zinc-200 group-hover:text-white'}`}>{asset.name}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                  isLightTheme 
                                    ? 'text-zinc-600 bg-zinc-100 border-zinc-200' 
                                    : 'text-zinc-400 bg-slate-900 border-slate-800'
                                }`}>
                                  {assetPct.toFixed(1)}%
                                </span>
                              </div>
                              <span className={`text-[10px] font-mono mt-0.5 block ${isLightTheme ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                1 {asset.symbol} ≈ ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className={`font-extrabold text-xs block font-mono ${isLightTheme ? 'text-zinc-800' : 'text-zinc-100'}`}>
                                {asset.coinAmount.toLocaleString(undefined, {
                                  minimumFractionDigits: asset.symbol === 'BTC' || asset.symbol === 'ETH' ? 6 : 2,
                                  maximumFractionDigits: asset.symbol === 'BTC' || asset.symbol === 'ETH' ? 8 : 4
                                })} {asset.symbol}
                              </span>
                              <span className="text-[10px] font-extrabold text-emerald-600 font-mono block mt-0.5">
                                $ {asset.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            <div className={`transition-colors ${isLightTheme ? 'text-zinc-300 group-hover:text-amber-500' : 'text-zinc-600 group-hover:text-emerald-400'}`}>
                              <ArrowRight size={14} className="transform group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        </div>

                        {asset.lockedAmount > 0 && (
                          <div className={`mt-3 pt-2.5 border-t flex justify-between items-center text-[10px] font-mono ${isLightTheme ? 'border-zinc-200/60' : 'border-slate-700/40'}`}>
                            <div className={`flex items-center gap-1 font-bold ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                              <Unlock size={11} className={`${isLightTheme ? 'text-emerald-600' : 'text-emerald-400'} shrink-0`} />
                              <span>Free:</span>
                              <span className={`${isLightTheme ? 'text-emerald-600' : 'text-emerald-400'} font-extrabold`}>
                                {asset.unlockedAmount.toLocaleString(undefined, {
                                  minimumFractionDigits: asset.symbol === 'BTC' || asset.symbol === 'ETH' ? 4 : 2,
                                  maximumFractionDigits: 6
                                })} {asset.symbol}
                              </span>
                            </div>
                            <div className={`flex items-center gap-1 font-bold ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                              <Activity size={11} className={`${isLightTheme ? 'text-amber-600' : 'text-amber-400'} shrink-0`} />
                              <span>Traded:</span>
                              <span className={`${isLightTheme ? 'text-amber-600' : 'text-amber-400'} font-extrabold`}>
                                {asset.lockedAmount.toLocaleString(undefined, {
                                  minimumFractionDigits: asset.symbol === 'BTC' || asset.symbol === 'ETH' ? 4 : 2,
                                  maximumFractionDigits: 6
                                })} {asset.symbol}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {userAssets.filter(asset => asset.coinAmount > 0).length === 0 && (
                    <div className={`text-center py-8 px-4 border rounded-2xl select-none ${
                      isLightTheme ? 'bg-zinc-50/50 border-zinc-200/60' : 'bg-slate-900/40 border-slate-800/80'
                    }`}>
                      <p className="text-zinc-500 text-xs font-semibold">Your asset holdings list is currently empty.</p>
                      <p className="text-zinc-400 text-[10px] mt-1.5 leading-relaxed max-w-[280px] mx-auto">
                        Please convert your available USD wallet balance, or choose a coin from the Market list on the home screen to buy it.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BOTS HUB */}
          {activeTab === 'trade' && (
            <div className="space-y-6 animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between pb-1 select-none">
                <div>
                  <h2 className={`text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 ${
                    isLightTheme ? 'text-zinc-900' : 'text-white'
                  }`}>
                    <Bot className={isLightTheme ? 'text-amber-500' : 'text-emerald-400'} size={24} />
                    BOTS
                  </h2>
                  <p className={`text-xs mt-0.5 ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Automated trading bots & yield harvesting strategies
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* MAIN HUB MENU: 4 CARDS (Matching Blueprint Layout) */}
                  {botHubView === 'menu' && (
                    <div className="space-y-6 animate-fade-in">
                      {/* 2x2 Grid of 4 Cards */}
                      <div className="grid grid-cols-2 gap-3 sm:gap-4 select-none">
                        {/* 1. PREMIUM BOTS */}
                        <button
                          type="button"
                          onClick={() => setBotHubView('PREMIUM')}
                          className={`p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between group min-h-[155px] sm:min-h-[185px] select-none ${
                            isLightTheme 
                              ? 'bg-white border-amber-200/90 shadow-xs hover:shadow-xl hover:border-amber-400 hover:-translate-y-0.5' 
                              : 'bg-slate-800/95 border-slate-700 hover:border-amber-400/60 shadow-xs hover:-translate-y-0.5'
                          }`}
                        >
                          <div className="space-y-2 sm:space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shadow-md shadow-amber-500/30 group-hover:scale-105 transition-transform duration-200">
                                <Crown size={18} className="sm:w-5 sm:h-5 drop-shadow-xs" />
                              </div>
                              <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border ${
                                isLightTheme ? 'bg-amber-100/90 text-amber-950 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}>
                                PRO
                              </span>
                            </div>

                            <div>
                              <h4 className={`text-xs sm:text-base font-black tracking-tight leading-tight group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors ${
                                isLightTheme ? 'text-zinc-900' : 'text-white'
                              }`}>
                                Premium BOTS
                              </h4>
                              <p className={`text-[10px] sm:text-xs mt-0.5 font-medium line-clamp-1 ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                High-yield automated strategies
                              </p>
                            </div>
                          </div>

                          <div className={`pt-2.5 sm:pt-3 border-t flex items-center justify-between text-[10px] sm:text-xs font-bold gap-1 ${
                            isLightTheme ? 'border-zinc-100 text-amber-700' : 'border-slate-700/80 text-amber-400'
                          }`}>
                            <span className="truncate">
                              {(botTemplates.length > 0 ? botTemplates : BOT_TEMPLATES).filter(t => (t.category || '').toUpperCase() === 'PREMIUM' || (!t.category || t.category.toUpperCase() !== 'FREE')).length} Available
                            </span>
                            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                              isLightTheme 
                                ? 'bg-amber-100/80 text-amber-800 group-hover:bg-amber-500 group-hover:text-white shadow-xs' 
                                : 'bg-amber-500/20 text-amber-300 group-hover:bg-amber-500 group-hover:text-white'
                            }`}>
                              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        </button>

                        {/* 2. FREE BOTS */}
                        <button
                          type="button"
                          onClick={() => setBotHubView('FREE')}
                          className={`p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between group min-h-[155px] sm:min-h-[185px] select-none ${
                            isLightTheme 
                              ? 'bg-white border-emerald-200/90 shadow-xs hover:shadow-xl hover:border-emerald-400 hover:-translate-y-0.5' 
                              : 'bg-slate-800/95 border-slate-700 hover:border-emerald-400/60 shadow-xs hover:-translate-y-0.5'
                          }`}
                        >
                          <div className="space-y-2 sm:space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-500 to-emerald-400 text-white flex items-center justify-center shadow-md shadow-emerald-500/30 group-hover:scale-105 transition-transform duration-200">
                                <Gift size={18} className="sm:w-5 sm:h-5 drop-shadow-xs" />
                              </div>
                              <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border ${
                                isLightTheme ? 'bg-emerald-100/90 text-emerald-950 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}>
                                FREE
                              </span>
                            </div>

                            <div>
                              <h4 className={`text-xs sm:text-base font-black tracking-tight leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors ${
                                isLightTheme ? 'text-zinc-900' : 'text-white'
                              }`}>
                                Free BOTS
                              </h4>
                              <p className={`text-[10px] sm:text-xs mt-0.5 font-medium line-clamp-1 ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                Starter trading algorithms
                              </p>
                            </div>
                          </div>

                          <div className={`pt-2.5 sm:pt-3 border-t flex items-center justify-between text-[10px] sm:text-xs font-bold gap-1 ${
                            isLightTheme ? 'border-zinc-100 text-emerald-700' : 'border-slate-700/80 text-emerald-400'
                          }`}>
                            <span className="truncate">
                              {(botTemplates.length > 0 ? botTemplates : BOT_TEMPLATES).filter(t => (t.category || '').toUpperCase() === 'FREE').length} Available
                            </span>
                            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                              isLightTheme 
                                ? 'bg-emerald-100/80 text-emerald-800 group-hover:bg-emerald-500 group-hover:text-white shadow-xs' 
                                : 'bg-emerald-500/20 text-emerald-300 group-hover:bg-emerald-500 group-hover:text-white'
                            }`}>
                              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        </button>

                        {/* 3. HISTORY */}
                        <button
                          type="button"
                          onClick={() => setBotHubView('HISTORY')}
                          className={`p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between group min-h-[155px] sm:min-h-[185px] select-none ${
                            isLightTheme 
                              ? 'bg-white border-indigo-200/90 shadow-xs hover:shadow-xl hover:border-indigo-400 hover:-translate-y-0.5' 
                              : 'bg-slate-800/95 border-slate-700 hover:border-indigo-400/60 shadow-xs hover:-translate-y-0.5'
                          }`}
                        >
                          <div className="space-y-2 sm:space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-400 text-white flex items-center justify-center shadow-md shadow-indigo-500/30 group-hover:scale-105 transition-transform duration-200">
                                <History size={18} className="sm:w-5 sm:h-5 drop-shadow-xs" />
                              </div>
                              <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border ${
                                isLightTheme ? 'bg-indigo-100/90 text-indigo-950 border-indigo-300' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                              }`}>
                                LOGS
                              </span>
                            </div>

                            <div>
                              <h4 className={`text-xs sm:text-base font-black tracking-tight leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${
                                isLightTheme ? 'text-zinc-900' : 'text-white'
                              }`}>
                                Bot History
                              </h4>
                              <p className={`text-[10px] sm:text-xs mt-0.5 font-medium line-clamp-1 ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                Profit & execution records
                              </p>
                            </div>
                          </div>

                          <div className={`pt-2.5 sm:pt-3 border-t flex items-center justify-between text-[10px] sm:text-xs font-bold gap-1 ${
                            isLightTheme ? 'border-zinc-100 text-indigo-700' : 'border-slate-700/80 text-indigo-400'
                          }`}>
                            <span className="truncate">
                              {userTransactions.filter(tx => tx.type === 'Auto Bot trade' || tx.type === 'bot_harvest' || tx.type === 'bot_trade' || (tx.type && tx.type.toLowerCase().includes('bot')) || (tx.title && tx.title.toLowerCase().includes('bot'))).length} Logs<span className="hidden sm:inline"> Recorded</span>
                            </span>
                            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                              isLightTheme 
                                ? 'bg-indigo-100/80 text-indigo-800 group-hover:bg-indigo-500 group-hover:text-white shadow-xs' 
                                : 'bg-indigo-500/20 text-indigo-300 group-hover:bg-indigo-500 group-hover:text-white'
                            }`}>
                              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        </button>

                        {/* 4. MY BOTS */}
                        <button
                          type="button"
                          onClick={() => setBotHubView('MY_BOTS')}
                          className={`p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between group min-h-[155px] sm:min-h-[185px] select-none ${
                            isLightTheme 
                              ? 'bg-white border-blue-200/90 shadow-xs hover:shadow-xl hover:border-blue-400 hover:-translate-y-0.5' 
                              : 'bg-slate-800/95 border-slate-700 hover:border-blue-400/60 shadow-xs hover:-translate-y-0.5'
                          }`}
                        >
                          <div className="space-y-2 sm:space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-500 to-blue-400 text-white flex items-center justify-center shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform duration-200">
                                <Bot size={18} className="sm:w-5 sm:h-5 drop-shadow-xs" />
                              </div>
                              <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border ${
                                isLightTheme ? 'bg-blue-100/90 text-blue-950 border-blue-300' : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              }`}>
                                ACTIVE
                              </span>
                            </div>

                            <div>
                              <h4 className={`text-xs sm:text-base font-black tracking-tight leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ${
                                isLightTheme ? 'text-zinc-900' : 'text-white'
                              }`}>
                                My Active Bots
                              </h4>
                              <p className={`text-[10px] sm:text-xs mt-0.5 font-medium line-clamp-1 ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                Running bot instances
                              </p>
                            </div>
                          </div>

                          <div className={`pt-2.5 sm:pt-3 border-t flex items-center justify-between text-[10px] sm:text-xs font-bold gap-1 ${
                            isLightTheme ? 'border-zinc-100 text-blue-700' : 'border-slate-700/80 text-blue-400'
                          }`}>
                            <span className="truncate">{userBots.filter(b => b.status !== 'STOPPED').length} Active</span>
                            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                              isLightTheme 
                                ? 'bg-blue-100/80 text-blue-800 group-hover:bg-blue-500 group-hover:text-white shadow-xs' 
                                : 'bg-blue-500/20 text-blue-300 group-hover:bg-blue-500 group-hover:text-white'
                            }`}>
                              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SUB-PAGE VIEWS */}
                  {botHubView !== 'menu' && (
                    <div className="space-y-5 animate-fade-in">
                      {/* Top Bar with Back Button & Category Badge */}
                      <div className="flex items-center justify-between select-none">
                        <button
                          type="button"
                          onClick={() => setBotHubView('menu')}
                          className={`group px-3.5 py-2 rounded-full border text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 ${
                            isLightTheme 
                              ? 'bg-white border-zinc-200/90 text-zinc-800 hover:bg-zinc-50 hover:border-amber-400/50' 
                              : 'bg-slate-900 border-slate-700/80 text-zinc-100 hover:bg-slate-850 hover:border-slate-600'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-transform group-hover:-translate-x-0.5 ${
                            isLightTheme ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/15 text-emerald-400'
                          }`}>
                            <ArrowLeft size={12} strokeWidth={2.5} />
                          </div>
                          <span>Back to Bots</span>
                        </button>

                        {botHubView === 'PREMIUM' && (
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-2xs transition-all ${
                            isLightTheme 
                              ? 'bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-amber-500/10 text-amber-900 border-amber-300/80' 
                              : 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-300 border-amber-500/30'
                          }`}>
                            <Crown size={13} className={isLightTheme ? 'text-amber-600' : 'text-amber-400'} />
                            <span>Premium Category</span>
                          </div>
                        )}

                        {botHubView === 'FREE' && (
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-2xs transition-all ${
                            isLightTheme 
                              ? 'bg-gradient-to-r from-emerald-50 to-emerald-100/80 text-emerald-900 border-emerald-300/80' 
                              : 'bg-gradient-to-r from-emerald-500/20 to-teal-600/10 text-emerald-300 border-emerald-500/30'
                          }`}>
                            <Gift size={13} className={isLightTheme ? 'text-emerald-600' : 'text-emerald-400'} />
                            <span>Free Category</span>
                          </div>
                        )}

                        {botHubView === 'HISTORY' && (
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-2xs transition-all ${
                            isLightTheme 
                              ? 'bg-gradient-to-r from-indigo-50 to-indigo-100/80 text-indigo-900 border-indigo-300/80' 
                              : 'bg-gradient-to-r from-indigo-500/20 to-violet-600/10 text-indigo-300 border-indigo-500/30'
                          }`}>
                            <History size={13} className={isLightTheme ? 'text-indigo-600' : 'text-indigo-400'} />
                            <span>Trade Logs</span>
                          </div>
                        )}

                        {botHubView === 'MY_BOTS' && (
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-2xs transition-all ${
                            isLightTheme 
                              ? 'bg-gradient-to-r from-blue-50 to-blue-100/80 text-blue-900 border-blue-300/80' 
                              : 'bg-gradient-to-r from-blue-500/20 to-cyan-600/10 text-blue-300 border-blue-500/30'
                          }`}>
                            <Bot size={13} className={isLightTheme ? 'text-blue-600' : 'text-blue-400'} />
                            <span>User Bots</span>
                          </div>
                        )}
                      </div>

                      {/* PAGE 1: PREMIUM BOTS */}
                      {botHubView === 'PREMIUM' && (
                        <div className={`border rounded-3xl p-5 space-y-4 ${
                          isLightTheme ? 'bg-white border-zinc-200/80 shadow-xs' : 'bg-slate-800 border-slate-700/80'
                        }`}>
                          <div className="flex justify-between items-center select-none">
                            <div>
                              <h3 className={`text-sm font-black tracking-tight flex items-center gap-1.5 ${isLightTheme ? 'text-zinc-800' : 'text-zinc-200'}`}>
                                <Crown size={18} className="text-amber-500" />
                                PREMIUM BOTS
                              </h3>
                              <p className={`text-xs mt-0.5 ${isLightTheme ? 'text-zinc-400' : 'text-zinc-400'}`}>
                                Exclusive high-yield algorithmic trading bots configured by admin.
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            {[...(botTemplates.length > 0 ? botTemplates : BOT_TEMPLATES)]
                              .sort((a, b) => getTemplateMinCapital(a) - getTemplateMinCapital(b))
                              .filter(tmpl => (tmpl.category || '').toUpperCase() === 'PREMIUM' || (!tmpl.category || tmpl.category.toUpperCase() !== 'FREE'))
                              .map((tmpl) => (
                                <div 
                                  key={tmpl.id}
                                  className={`p-4 sm:p-5 rounded-3xl border flex flex-col justify-between transition-all duration-300 space-y-4 relative overflow-hidden group ${
                                    isLightTheme 
                                      ? 'bg-gradient-to-br from-white via-amber-50/20 to-orange-50/30 border-amber-200/90 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/10' 
                                      : 'bg-gradient-to-br from-slate-900/90 via-slate-850 to-slate-900 border-slate-700/80 hover:border-amber-500/60 hover:shadow-xl'
                                  }`}
                                >
                                  {/* Top accent shine line */}
                                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 opacity-80" />

                                  <div className="space-y-3.5">
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between gap-3 pt-1">
                                      <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-400 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/25 group-hover:scale-105 transition-transform duration-200">
                                          <Crown size={20} className="drop-shadow-xs" />
                                        </div>
                                        <div>
                                          <h4 className={`text-sm sm:text-base font-black tracking-tight leading-tight group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors ${
                                            isLightTheme ? 'text-zinc-900' : 'text-white'
                                          }`}>
                                            {tmpl.name}
                                          </h4>
                                          <p className={`text-[10px] sm:text-xs mt-0.5 font-medium line-clamp-1 ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                            {tmpl.description || 'High-yield algorithmic flash-loan & scalp strategy'}
                                          </p>
                                        </div>
                                      </div>

                                      <span className={`px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-mono font-black uppercase tracking-wider shrink-0 border flex items-center gap-1 ${
                                        isLightTheme ? 'bg-amber-100/90 text-amber-950 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                      }`}>
                                        <Crown size={10} className="text-amber-600" />
                                        PREMIUM
                                      </span>
                                    </div>

                                    {/* 2-Column Key Metrics Grid */}
                                    <div className="grid grid-cols-2 gap-2.5">
                                      <div className={`p-3 rounded-2xl border flex flex-col justify-between ${
                                        isLightTheme ? 'bg-white/90 border-amber-100/80 shadow-2xs' : 'bg-slate-950/70 border-slate-800'
                                      }`}>
                                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400">
                                          <TrendingUp size={13} className="text-emerald-500 shrink-0" />
                                          <span>Win Ratio</span>
                                        </div>
                                        <div className="mt-1 flex items-baseline gap-1">
                                          <span className="text-sm sm:text-base font-mono font-black text-emerald-600 dark:text-emerald-400">
                                            {tmpl.winRatioRange || '92-98%'}
                                          </span>
                                        </div>
                                      </div>

                                      <div className={`p-3 rounded-2xl border flex flex-col justify-between ${
                                        isLightTheme ? 'bg-white/90 border-amber-100/80 shadow-2xs' : 'bg-slate-950/70 border-slate-800'
                                      }`}>
                                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400">
                                          <Coins size={13} className="text-amber-500 shrink-0" />
                                          <span>Min Capital</span>
                                        </div>
                                        <div className="mt-1 flex items-baseline gap-1">
                                          <span className={`text-base sm:text-lg font-mono font-black ${
                                            isLightTheme ? 'text-zinc-950' : 'text-white'
                                          }`}>
                                            {getTemplateMinCapital(tmpl)}
                                          </span>
                                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">USDT</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Risk & Execution Bar */}
                                    <div className={`px-3 py-2 rounded-xl border flex items-center justify-between text-[11px] font-bold ${
                                      isLightTheme ? 'bg-amber-50/50 border-amber-200/50 text-zinc-700' : 'bg-slate-900/50 border-slate-800 text-zinc-300'
                                    }`}>
                                      <div className="flex items-center gap-1.5">
                                        <ShieldCheck size={13} className="text-amber-500" />
                                        <span className="text-zinc-400 font-normal">Risk Profile:</span>
                                        <span className="font-mono font-black text-amber-700 dark:text-amber-300">
                                          {tmpl.riskLevel || 'Low Risk'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 font-mono text-[10px] text-zinc-400">
                                        <Zap size={11} className="text-amber-500 fill-amber-500/20" />
                                        <span>Auto Scalp</span>
                                      </div>
                                    </div>

                                    {/* Supported Trading Pairs Badges */}
                                    <div className="space-y-1.5 pt-1">
                                      <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                        Trading Pairs
                                      </span>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {(tmpl.tradingPairs && tmpl.tradingPairs.length > 0 ? tmpl.tradingPairs : DEFAULT_BOT_TRADING_PAIRS).map((pairKey: string) => (
                                          <TradingPairBadge key={pairKey} pair={pairKey} isLightTheme={isLightTheme} size="sm" />
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedBotTemplate(tmpl);
                                        setBotCapitalInput(getTemplateMinCapital(tmpl).toString());
                                        const pairs = tmpl.tradingPairs || DEFAULT_BOT_TRADING_PAIRS;
                                        const defaultPair = pairs.find((p: string) => p.includes('XAU') || p.includes('Gold')) || 'XAU/USD';
                                        setBotSelectedPair(defaultPair);
                                        setBotDurationSeconds(60);
                                      }}
                                      className="w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-amber-950 font-black shadow-amber-500/25 active:scale-[0.98]"
                                    >
                                      <Zap size={16} className="fill-current" />
                                      SET UP & RUN
                                    </button>
                                  </div>
                                </div>
                              ))}

                            {(botTemplates.length > 0 ? botTemplates : BOT_TEMPLATES)
                              .filter(tmpl => (tmpl.category || '').toUpperCase() === 'PREMIUM' || (!tmpl.category || tmpl.category.toUpperCase() !== 'FREE')).length === 0 && (
                                <div className="text-center py-12 px-4 border rounded-3xl select-none text-zinc-400 text-xs">
                                  No Premium category bots found.
                                </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* PAGE 2: FREE BOTS */}
                      {botHubView === 'FREE' && (
                        <div className={`border rounded-3xl p-5 space-y-4 ${
                          isLightTheme ? 'bg-white border-zinc-200/80 shadow-xs' : 'bg-slate-800 border-slate-700/80'
                        }`}>
                          <div className="flex justify-between items-center select-none">
                            <div>
                              <h3 className={`text-sm font-black tracking-tight flex items-center gap-1.5 ${isLightTheme ? 'text-zinc-800' : 'text-zinc-200'}`}>
                                <Gift size={18} className="text-emerald-500" />
                                FREE BOTS
                              </h3>
                              <p className={`text-xs mt-0.5 ${isLightTheme ? 'text-zinc-400' : 'text-zinc-400'}`}>
                                Free algorithmic trading bots available to all account tiers.
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            {[...(botTemplates.length > 0 ? botTemplates : BOT_TEMPLATES)]
                              .sort((a, b) => getTemplateMinCapital(a) - getTemplateMinCapital(b))
                              .filter(tmpl => (tmpl.category || '').toUpperCase() === 'FREE')
                              .map((tmpl) => (
                                <div 
                                  key={tmpl.id}
                                  className={`p-4 sm:p-5 rounded-3xl border flex flex-col justify-between transition-all duration-300 space-y-4 relative overflow-hidden group ${
                                    isLightTheme 
                                      ? 'bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/30 border-emerald-200/90 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/10' 
                                      : 'bg-gradient-to-br from-slate-900/90 via-slate-850 to-slate-900 border-slate-700/80 hover:border-emerald-500/60 hover:shadow-xl'
                                  }`}
                                >
                                  {/* Top accent shine line */}
                                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 opacity-80" />

                                  <div className="space-y-3.5">
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between gap-3 pt-1">
                                      <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-emerald-400 to-teal-400 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/25 group-hover:scale-105 transition-transform duration-200">
                                          <Gift size={20} className="drop-shadow-xs" />
                                        </div>
                                        <div>
                                          <h4 className={`text-sm sm:text-base font-black tracking-tight leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors ${
                                            isLightTheme ? 'text-zinc-900' : 'text-white'
                                          }`}>
                                            {tmpl.name}
                                          </h4>
                                          <p className={`text-[10px] sm:text-xs mt-0.5 font-medium line-clamp-1 ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                            {tmpl.description || 'Automated low-risk Dollar-Cost Averaging strategy'}
                                          </p>
                                        </div>
                                      </div>

                                      <span className={`px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-mono font-black uppercase tracking-wider shrink-0 border flex items-center gap-1 ${
                                        isLightTheme ? 'bg-emerald-100/90 text-emerald-950 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                      }`}>
                                        <Gift size={10} className="text-emerald-600" />
                                        FREE
                                      </span>
                                    </div>

                                    {/* 2-Column Key Metrics Grid */}
                                    <div className="grid grid-cols-2 gap-2.5">
                                      <div className={`p-3 rounded-2xl border flex flex-col justify-between ${
                                        isLightTheme ? 'bg-white/90 border-emerald-100/80 shadow-2xs' : 'bg-slate-950/70 border-slate-800'
                                      }`}>
                                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400">
                                          <TrendingUp size={13} className="text-emerald-500 shrink-0" />
                                          <span>Win Ratio</span>
                                        </div>
                                        <div className="mt-1 flex items-baseline gap-1">
                                          <span className="text-sm sm:text-base font-mono font-black text-emerald-600 dark:text-emerald-400">
                                            {tmpl.winRatioRange || '94-99%'}
                                          </span>
                                        </div>
                                      </div>

                                      <div className={`p-3 rounded-2xl border flex flex-col justify-between ${
                                        isLightTheme ? 'bg-white/90 border-emerald-100/80 shadow-2xs' : 'bg-slate-950/70 border-slate-800'
                                      }`}>
                                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400">
                                          <Coins size={13} className="text-amber-500 shrink-0" />
                                          <span>Min Capital</span>
                                        </div>
                                        <div className="mt-1 flex items-baseline gap-1">
                                          <span className={`text-base sm:text-lg font-mono font-black ${
                                            isLightTheme ? 'text-zinc-950' : 'text-white'
                                          }`}>
                                            {getTemplateMinCapital(tmpl)}
                                          </span>
                                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">USDT</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Risk & Execution Bar */}
                                    <div className={`px-3 py-2 rounded-xl border flex items-center justify-between text-[11px] font-bold ${
                                      isLightTheme ? 'bg-emerald-50/50 border-emerald-200/50 text-zinc-700' : 'bg-slate-900/50 border-slate-800 text-zinc-300'
                                    }`}>
                                      <div className="flex items-center gap-1.5">
                                        <ShieldCheck size={13} className="text-emerald-500" />
                                        <span className="text-zinc-400 font-normal">Risk Profile:</span>
                                        <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">
                                          {tmpl.riskLevel || 'Very Low Risk'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 font-mono text-[10px] text-zinc-400">
                                        <Zap size={11} className="text-emerald-500 fill-emerald-500/20" />
                                        <span>Auto DCA</span>
                                      </div>
                                    </div>

                                    {/* Supported Trading Pairs Badges */}
                                    <div className="space-y-1.5 pt-1">
                                      <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                        Trading Pairs
                                      </span>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {(tmpl.tradingPairs && tmpl.tradingPairs.length > 0 ? tmpl.tradingPairs : DEFAULT_BOT_TRADING_PAIRS).map((pairKey: string) => (
                                          <TradingPairBadge key={pairKey} pair={pairKey} isLightTheme={isLightTheme} size="sm" />
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedBotTemplate(tmpl);
                                        setBotCapitalInput(getTemplateMinCapital(tmpl).toString());
                                        const pairs = tmpl.tradingPairs || DEFAULT_BOT_TRADING_PAIRS;
                                        const defaultPair = pairs.find((p: string) => p.includes('XAU') || p.includes('Gold')) || 'XAU/USD';
                                        setBotSelectedPair(defaultPair);
                                        setBotDurationSeconds(60);
                                      }}
                                      className="w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black shadow-emerald-500/25 active:scale-[0.98]"
                                    >
                                      <Zap size={16} className="fill-current" />
                                      SET UP & RUN
                                    </button>
                                  </div>
                                </div>
                              ))}

                            {(botTemplates.length > 0 ? botTemplates : BOT_TEMPLATES)
                              .filter(tmpl => (tmpl.category || '').toUpperCase() === 'FREE').length === 0 && (
                                <div className="text-center py-12 px-4 border rounded-3xl select-none text-zinc-400 text-xs">
                                  No Free category bots found.
                                </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* PAGE 3: HISTORY */}
                      {botHubView === 'HISTORY' && (() => {
                        // 1. Filter transactions to only trade profit/loss & harvest records
                        const explicitBotTrades = userTransactions.filter(tx => 
                          tx.type === 'bot_trade' || 
                          tx.type === 'bot_harvest' || 
                          (tx.profitDelta !== undefined) || 
                          (tx.isWin !== undefined)
                        ).map(tx => {
                          const isWin = tx.isWin !== undefined ? tx.isWin : (tx.status === 'WIN' || tx.amount >= 0);
                          const amt = tx.profitDelta !== undefined ? tx.profitDelta : tx.amount;
                          return {
                            id: tx.id,
                            botName: tx.botName || tx.title || 'Trading Bot',
                            tradingPair: tx.tradingPair || 'BTC/USDT',
                            amount: amt,
                            isWin: isWin,
                            status: isWin ? 'WIN' : 'LOSS',
                            profitPercent: tx.profitPercent || (isWin ? 1.8 : -0.8),
                            timestamp: tx.createdAt?.seconds 
                              ? new Date(tx.createdAt.seconds * 1000).toLocaleString() 
                              : typeof tx.createdAt === 'string' 
                                ? new Date(tx.createdAt).toLocaleString() 
                                : 'Recently executed',
                            rawDate: tx.createdAt?.seconds ? tx.createdAt.seconds * 1000 : Date.now()
                          };
                        });

                        // 2. Sort and slice to only the latest 5 trade logs
                        let botHistoryItems = explicitBotTrades.sort((a, b) => b.rawDate - a.rawDate);
                        if (botHistoryItems.length === 0 && userBots.length > 0) {
                          const derivedItems: any[] = [];
                          userBots.forEach(bot => {
                            const total = bot.totalTrades || (bot.accruedProfit !== undefined && bot.accruedProfit !== 0 ? 3 : 0);
                            const winsCount = bot.wins !== undefined ? bot.wins : Math.ceil(total * 0.75);
                            const capital = bot.capital || 50;
                            
                            for (let i = 0; i < total; i++) {
                              const isWin = i < winsCount;
                              const rate = isWin ? 0.018 : -0.008;
                              const delta = parseFloat((capital * rate).toFixed(2));
                              derivedItems.push({
                                id: `derived-${bot.id}-${i}`,
                                botName: bot.name || 'Trading Bot',
                                tradingPair: bot.tradingPair || 'BTC/USDT',
                                amount: isWin ? Math.abs(delta) : -Math.abs(delta),
                                isWin: isWin,
                                status: isWin ? 'WIN' : 'LOSS',
                                profitPercent: isWin ? 1.8 : -0.8,
                                timestamp: bot.createdAt?.seconds 
                                  ? new Date((bot.createdAt.seconds + i * 60) * 1000).toLocaleString() 
                                  : 'Recently executed',
                                rawDate: bot.createdAt?.seconds ? (bot.createdAt.seconds + i * 60) * 1000 : Date.now() - (total - i) * 60000
                              });
                            }
                          });
                          botHistoryItems = derivedItems.sort((a, b) => b.rawDate - a.rawDate);
                        }

                        // Summary metrics based on all trade logs
                        const totalNetPnL = botHistoryItems.reduce((acc, item) => acc + item.amount, 0);
                        const winCount = botHistoryItems.filter(item => item.isWin).length;
                        const winRate = botHistoryItems.length > 0 ? ((winCount / botHistoryItems.length) * 100).toFixed(1) : '0.0';

                        return (
                          <div className={`border rounded-3xl p-5 sm:p-6 space-y-5 shadow-md relative overflow-hidden transition-all ${
                            isLightTheme ? 'bg-white/95 border-zinc-200/90 shadow-zinc-200/50' : 'bg-slate-800/95 border-slate-700/80 shadow-slate-950/40'
                          }`}>
                            {/* Decorative background glow */}
                            <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                            {/* Header Row */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none pb-1 relative z-10">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${
                                  isLightTheme ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/20' : 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-indigo-900/40'
                                }`}>
                                  <History size={20} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className={`text-base font-black tracking-tight ${isLightTheme ? 'text-zinc-900' : 'text-zinc-100'}`}>
                                      BOT TRADE HISTORY
                                    </h3>
                                  </div>
                                  <p className={`text-xs mt-0.5 font-medium ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                    Real-time execution log of trading bot profits & losses
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-start sm:self-auto">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                  isLightTheme ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                                }`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Live Ticker
                                </span>
                              </div>
                            </div>

                            {/* Summary Performance Cards */}
                            {botHistoryItems.length > 0 && (
                              <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 relative z-10">
                                {/* Net P&L Card */}
                                <div className={`p-3 sm:p-4 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                                  isLightTheme 
                                    ? totalNetPnL >= 0 
                                      ? 'bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white border-emerald-200/90 shadow-xs' 
                                      : 'bg-gradient-to-br from-rose-50/80 via-pink-50/40 to-white border-rose-200/90 shadow-xs'
                                    : totalNetPnL >= 0 
                                      ? 'bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-900 border-emerald-500/30 shadow-xs' 
                                      : 'bg-gradient-to-br from-rose-950/30 via-slate-900 to-slate-900 border-rose-500/30 shadow-xs'
                                }`}>
                                  <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider truncate block ${
                                    isLightTheme ? 'text-zinc-500' : 'text-zinc-400'
                                  }`}>
                                    NET P&L
                                  </span>
                                  <div className="mt-1 flex items-baseline gap-1 flex-wrap">
                                    <span className={`text-sm sm:text-lg font-black font-mono tracking-tight ${
                                      totalNetPnL >= 0 
                                        ? isLightTheme ? 'text-emerald-700' : 'text-emerald-400' 
                                        : isLightTheme ? 'text-rose-700' : 'text-rose-400'
                                    }`}>
                                      {totalNetPnL >= 0 ? '+' : ''}${totalNetPnL.toFixed(2)}
                                    </span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                      totalNetPnL >= 0
                                        ? isLightTheme ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-900/50 text-emerald-300'
                                        : isLightTheme ? 'bg-rose-100 text-rose-800' : 'bg-rose-900/50 text-rose-300'
                                    }`}>
                                      USDT
                                    </span>
                                  </div>
                                </div>

                                {/* Win Rate Card */}
                                <div className={`p-3 sm:p-4 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                                  isLightTheme 
                                    ? 'bg-gradient-to-br from-indigo-50/80 via-violet-50/40 to-white border-indigo-200/90 shadow-xs' 
                                    : 'bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-900 border-indigo-500/30 shadow-xs'
                                }`}>
                                  <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider truncate block ${
                                    isLightTheme ? 'text-zinc-500' : 'text-zinc-400'
                                  }`}>
                                    WIN RATE
                                  </span>
                                  <div className="mt-1 flex items-baseline justify-between gap-1">
                                    <span className={`text-sm sm:text-lg font-black font-mono tracking-tight ${
                                      isLightTheme ? 'text-indigo-700' : 'text-indigo-400'
                                    }`}>
                                      {winRate}%
                                    </span>
                                    <span className={`text-[9px] font-bold font-mono ${isLightTheme ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                      {winCount}/{botHistoryItems.length}
                                    </span>
                                  </div>
                                </div>

                                {/* Executions Card */}
                                <div className={`p-3 sm:p-4 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                                  isLightTheme 
                                    ? 'bg-gradient-to-br from-zinc-50 via-slate-50 to-white border-zinc-200/90 shadow-xs' 
                                    : 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border-slate-700/80 shadow-xs'
                                }`}>
                                  <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider truncate block ${
                                    isLightTheme ? 'text-zinc-500' : 'text-zinc-400'
                                  }`}>
                                    LOGS
                                  </span>
                                  <div className="mt-1 flex items-baseline gap-1">
                                    <span className={`text-sm sm:text-lg font-black font-mono tracking-tight ${
                                      isLightTheme ? 'text-zinc-900' : 'text-white'
                                    }`}>
                                      {botHistoryItems.length}
                                    </span>
                                    <span className={`text-[9px] font-bold ${isLightTheme ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                      trades
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Section Header for Executions */}
                            <div className="flex items-center justify-between pt-1 select-none relative z-10">
                              <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                isLightTheme ? 'text-zinc-500' : 'text-zinc-400'
                              }`}>
                                <Activity size={13} className="text-indigo-500" />
                                Execution History
                              </span>
                            </div>

                            {/* Trade Log Items */}
                            <div className="space-y-2.5 relative z-10">
                              {botHistoryItems.map(item => {
                                const isWin = item.isWin;
                                const amt = item.amount;

                                return (
                                  <div 
                                    key={item.id}
                                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 relative overflow-hidden group ${
                                      isLightTheme 
                                        ? 'bg-zinc-50/90 border-zinc-200/80 hover:bg-white hover:border-indigo-300 hover:shadow-md' 
                                        : 'bg-slate-900/70 border-slate-700/70 hover:bg-slate-900 hover:border-indigo-500/50 hover:shadow-lg'
                                    }`}
                                  >
                                    {/* Left Status Stripe */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                      isWin ? 'bg-emerald-500' : 'bg-rose-500'
                                    }`} />

                                    <div className="flex items-center gap-3 pl-1">
                                      {/* Icon Container */}
                                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                                        isWin 
                                          ? isLightTheme ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/80' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                          : isLightTheme ? 'bg-rose-100 text-rose-800 border border-rose-300/80' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                      }`}>
                                        {isWin ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                      </div>

                                      {/* Pair & Status Badge */}
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5">
                                        <TradingPairBadge pair={item.tradingPair} isLightTheme={isLightTheme} size="sm" showName />
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border w-fit flex items-center gap-1 ${
                                          isWin
                                            ? isLightTheme ? 'bg-emerald-100/90 text-emerald-900 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                            : isLightTheme ? 'bg-rose-100/90 text-rose-900 border-rose-300' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                        }`}>
                                          <span className={`w-1 h-1 rounded-full ${isWin ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                          {isWin ? 'WIN' : 'LOSS'}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Amount */}
                                    <div className="text-right shrink-0">
                                      <span className={`text-sm sm:text-base font-black font-mono block ${
                                        isWin 
                                          ? isLightTheme ? 'text-emerald-600' : 'text-emerald-400' 
                                          : isLightTheme ? 'text-rose-600' : 'text-rose-400'
                                      }`}>
                                        {isWin ? '+' : ''}${amt.toFixed(2)} <span className="text-[10px] font-bold text-zinc-400 font-sans">USDT</span>
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}

                              {botHistoryItems.length === 0 && (
                                <div className={`text-center py-12 px-4 border rounded-2xl select-none relative overflow-hidden ${
                                  isLightTheme ? 'bg-zinc-50/50 border-zinc-200/60' : 'bg-slate-900/40 border-slate-800/80'
                                }`}>
                                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-3">
                                    <History size={24} />
                                  </div>
                                  <p className={`text-xs font-black ${isLightTheme ? 'text-zinc-800' : 'text-zinc-200'}`}>No bot trade executions recorded yet.</p>
                                  <p className={`text-[11px] mt-1 max-w-[280px] mx-auto ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                    Run a bot strategy to track your profits and losses on each trade execution here.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* PAGE 4: MY BOTS */}
                      {botHubView === 'MY_BOTS' && (
                        <div className={`border rounded-3xl p-5 space-y-4 ${
                          isLightTheme ? 'bg-white border-zinc-200/80 shadow-xs' : 'bg-slate-800 border-slate-700/80'
                        }`}>
                          <div className="flex justify-between items-center select-none">
                            <div>
                              <h3 className={`text-sm font-black tracking-tight flex items-center gap-1.5 ${isLightTheme ? 'text-zinc-800' : 'text-zinc-200'}`}>
                                <Bot size={18} className="text-blue-500" />
                                MY BOTS ({userBots.filter(b => b.status !== 'STOPPED').length})
                              </h3>
                              <p className={`text-xs mt-0.5 ${isLightTheme ? 'text-zinc-400' : 'text-zinc-400'}`}>
                                Manage your active trading bots, monitor live profits, and harvest or withdraw anytime.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {userBots.filter(b => b.status !== 'STOPPED').map((bot) => {
                              const isOfflineActive = isUsingFallbackPrices || Boolean(pricesLoadError) || (typeof navigator !== 'undefined' && !navigator.onLine);
                              return (
                              <div 
                                key={bot.id} 
                                className={`p-4 sm:p-5 rounded-3xl border transition-all duration-300 relative overflow-hidden space-y-3.5 ${
                                  isLightTheme 
                                    ? 'bg-gradient-to-br from-white via-blue-50/15 to-indigo-50/20 border-zinc-200/90 hover:border-blue-400 hover:shadow-lg' 
                                    : 'bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-slate-700/80 hover:border-blue-500/50 hover:shadow-lg'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                                      isOfflineActive
                                        ? 'bg-gradient-to-tr from-rose-600 to-pink-600 text-white shadow-rose-500/25'
                                        : bot.status === 'RUNNING'
                                          ? 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-blue-500/25'
                                          : 'bg-gradient-to-tr from-amber-500 to-yellow-500 text-white shadow-amber-500/25'
                                    }`}>
                                      <Bot size={20} className="drop-shadow-xs" />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h4 className={`text-sm font-black tracking-tight ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                                          {bot.name}
                                        </h4>
                                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-mono font-black uppercase tracking-wider border flex items-center gap-1 ${
                                          isOfflineActive
                                            ? isLightTheme ? 'bg-rose-100/90 border-rose-300 text-rose-900' : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                            : bot.status === 'RUNNING'
                                              ? isLightTheme ? 'bg-emerald-100/90 border-emerald-300 text-emerald-900' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                              : isLightTheme ? 'bg-amber-100/90 border-amber-300 text-amber-900' : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                        }`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${isOfflineActive ? 'bg-rose-500' : bot.status === 'RUNNING' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                                          {isOfflineActive ? 'OFFLINE' : bot.status}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`text-[11px] font-mono font-bold ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                          Capital: <strong className="text-zinc-900 dark:text-white font-black">${isOfflineActive ? 0 : bot.capital.toLocaleString()}</strong> ({bot.coinSymbol || 'USDT'})
                                        </span>
                                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                        <TradingPairBadge pair={bot.tradingPair || 'XAUUSD'} isLightTheme={isLightTheme} size="sm" />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-slate-800">
                                    <div className="text-left sm:text-right">
                                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                                        {(isOfflineActive ? 0 : (bot.accruedProfit || 0)) < 0 ? 'Accrued Loss' : 'Accrued Profit'}
                                      </span>
                                      <span className={`text-base font-black font-mono ${
                                        (isOfflineActive ? 0 : (bot.accruedProfit || 0)) >= 0 
                                          ? (isLightTheme ? 'text-emerald-600' : 'text-emerald-400')
                                          : (isLightTheme ? 'text-rose-600' : 'text-rose-400')
                                      }`}>
                                        {isOfflineActive ? '+$0.00' : `${(bot.accruedProfit || 0) >= 0 ? '+' : ''}$${(bot.accruedProfit || 0).toFixed(2)}`}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className={`pt-3 border-t flex flex-wrap items-center justify-between gap-2 ${
                                  isLightTheme ? 'border-zinc-200/60' : 'border-slate-800'
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setActiveRunningBot(bot)}
                                      className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xs"
                                    >
                                      <Activity size={12} />
                                      View Live Bot
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleBotStatus(bot)}
                                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer border transition-all ${
                                        isLightTheme 
                                          ? 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100' 
                                          : 'bg-slate-800 border-slate-700 text-zinc-300 hover:bg-slate-750'
                                      }`}
                                    >
                                      {bot.status === 'RUNNING' ? <Pause size={11} /> : <Play size={11} />}
                                      {bot.status === 'RUNNING' ? 'Pause' : 'Resume'}
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleStopBot(bot)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer border transition-all ${
                                      isLightTheme 
                                        ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' 
                                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                                    }`}
                                  >
                                    Stop & Withdraw Capital
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                            {userBots.filter(b => b.status !== 'STOPPED').length === 0 && (
                              <div className={`text-center py-10 px-4 border rounded-2xl select-none ${
                                isLightTheme ? 'bg-zinc-50/50 border-zinc-200/60' : 'bg-slate-900/40 border-slate-800/80'
                              }`}>
                                <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 ${
                                  isLightTheme ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/10 text-blue-400'
                                }`}>
                                  <Bot size={22} />
                                </div>
                                <p className={`text-xs font-bold ${isLightTheme ? 'text-zinc-700' : 'text-zinc-300'}`}>You have no active automated bots.</p>
                                <p className={`text-[10px] mt-1 max-w-[280px] mx-auto ${isLightTheme ? 'text-zinc-400' : 'text-zinc-400'}`}>
                                  Explore Premium or Free bot categories to deploy your capital and start earning automated returns.
                                </p>
                                <div className="flex items-center justify-center gap-3 mt-4">
                                  <button
                                    type="button"
                                    onClick={() => setBotHubView('PREMIUM')}
                                    className="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-400 transition-all cursor-pointer flex items-center gap-1.5"
                                  >
                                    <Crown size={14} />
                                    Premium Bots
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setBotHubView('FREE')}
                                    className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 transition-all cursor-pointer flex items-center gap-1.5"
                                  >
                                    <Gift size={14} />
                                    Free Bots
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
            </div>
          )}

          {/* DEPLOY BOT MODAL */}
          {selectedBotTemplate && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
              <div className={`w-full max-w-md rounded-3xl border p-6 space-y-6 shadow-2xl ${
                isLightTheme ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-slate-900 border-slate-800 text-white'
              }`}>
                {/* Header: < Set UP & Run Bot */}
                <div className="flex justify-between items-center pb-3 border-b border-zinc-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedBotTemplate(null)}
                      className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                        isLightTheme ? 'hover:bg-zinc-100 text-zinc-700' : 'hover:bg-slate-800 text-zinc-200'
                      }`}
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <div>
                      <h3 className="text-lg font-black tracking-tight">Set UP & Run Bot</h3>
                      <p className={`text-[11px] font-bold ${isLightTheme ? 'text-amber-600' : 'text-emerald-400'}`}>
                        {selectedBotTemplate.name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedBotTemplate(null)}
                    className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                      isLightTheme ? 'hover:bg-zinc-100 text-zinc-500' : 'hover:bg-slate-800 text-zinc-400'
                    }`}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Field 1: Choose trading pair */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold block">Choose Trading Pair</label>
                      <span className={`text-[10px] font-mono font-bold ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        Selected: <strong className={isLightTheme ? 'text-amber-600 font-extrabold' : 'text-emerald-400 font-extrabold'}>{getTradingPairConfig(botSelectedPair).displayCode}</strong>
                      </span>
                    </div>

                    <div className="relative">
                      {/* Backdrop overlay to close dropdown on click outside */}
                      {isPairDropdownOpen && (
                        <div 
                          className="fixed inset-0 z-30" 
                          onClick={() => setIsPairDropdownOpen(false)} 
                        />
                      )}

                      {/* Dropdown Trigger Button */}
                      <button
                        type="button"
                        onClick={() => setIsPairDropdownOpen(!isPairDropdownOpen)}
                        className={`w-full p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex items-center justify-between relative z-30 select-none shadow-xs ${
                          isPairDropdownOpen
                            ? isLightTheme
                              ? 'bg-white border-amber-500 ring-2 ring-amber-500/30 shadow-md'
                              : 'bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
                            : isLightTheme
                              ? 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300'
                              : 'bg-slate-950 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                            isLightTheme ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'
                          }`}>
                            {getTradingPairConfig(botSelectedPair).symbol}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono font-black tracking-tight">
                                {getTradingPairConfig(botSelectedPair).displayCode}
                              </span>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md border uppercase ${
                                isLightTheme ? 'bg-zinc-100 text-zinc-600 border-zinc-200' : 'bg-slate-900 text-zinc-400 border-slate-800'
                              }`}>
                                {getTradingPairConfig(botSelectedPair).assetType}
                              </span>
                            </div>
                            <span className={`text-[11px] font-medium block ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                              {getTradingPairConfig(botSelectedPair).name}
                            </span>
                          </div>
                        </div>

                        <div className={`p-1.5 rounded-lg transition-transform duration-200 ${
                          isPairDropdownOpen ? 'rotate-180 ' + (isLightTheme ? 'text-amber-600' : 'text-emerald-400') : 'text-zinc-400'
                        }`}>
                          <ChevronDown size={18} />
                        </div>
                      </button>

                      {/* Custom Floating Popover Menu */}
                      {isPairDropdownOpen && (
                        <div className={`absolute left-0 right-0 top-full mt-2 z-50 p-1.5 rounded-2xl border shadow-2xl space-y-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
                          isLightTheme 
                            ? 'bg-white/95 border-zinc-200 text-zinc-900 shadow-amber-500/10' 
                            : 'bg-slate-900/95 border-slate-700 text-white shadow-black/60'
                        }`}>
                          {(selectedBotTemplate.tradingPairs && selectedBotTemplate.tradingPairs.length > 0 
                            ? selectedBotTemplate.tradingPairs 
                            : DEFAULT_BOT_TRADING_PAIRS
                          ).map((pairKey: string) => {
                            const cfg = getTradingPairConfig(pairKey);
                            const selectedClean = (botSelectedPair || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                            const pairClean = pairKey.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                            const cfgClean = cfg.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                            const isSelected = selectedClean === pairClean || selectedClean === cfgClean || botSelectedPair === pairKey || botSelectedPair === cfg.code;

                            return (
                              <button
                                key={pairKey}
                                type="button"
                                onClick={() => {
                                  setBotSelectedPair(pairKey);
                                  setIsPairDropdownOpen(false);
                                }}
                                className={`w-full p-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer flex items-center justify-between border ${
                                  isSelected
                                    ? isLightTheme
                                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-950 font-bold'
                                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                                    : isLightTheme
                                      ? 'border-transparent hover:bg-zinc-100/80 text-zinc-800'
                                      : 'border-transparent hover:bg-slate-800/80 text-zinc-200'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="text-lg w-6 text-center">{cfg.symbol}</span>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-mono font-extrabold tracking-tight">
                                        {cfg.displayCode}
                                      </span>
                                    </div>
                                    <span className={`text-[10px] font-medium block ${
                                      isSelected
                                        ? isLightTheme ? 'text-amber-800' : 'text-emerald-400'
                                        : isLightTheme ? 'text-zinc-500' : 'text-zinc-400'
                                    }`}>
                                      {cfg.name}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md border uppercase ${
                                    isLightTheme ? 'bg-zinc-100 text-zinc-600 border-zinc-200' : 'bg-slate-950 text-zinc-400 border-slate-800'
                                  }`}>
                                    {cfg.assetType}
                                  </span>
                                  {isSelected && (
                                    <div className={`p-0.5 rounded-full ${isLightTheme ? 'bg-amber-500 text-amber-950' : 'bg-emerald-500 text-slate-950'}`}>
                                      <CheckCircle2 size={13} className="stroke-[3]" />
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Field 2: Investment amount */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold block">Investment amount</label>
                      <span className={`text-[10px] font-mono font-bold ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        Available: ${Math.max(0, getWalletBalance(profile) - getLockedAmount('USDT')).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-zinc-400 font-bold font-mono text-xs">$</span>
                      <input
                        type="number"
                        placeholder={`Min ${getTemplateMinCapital(selectedBotTemplate)} USDT`}
                        value={botCapitalInput}
                        onChange={(e) => setBotCapitalInput(e.target.value)}
                        className={`w-full pl-8 pr-4 py-3 rounded-2xl border text-xs font-mono font-bold focus:outline-none ${
                          isLightTheme 
                            ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-amber-500' 
                            : 'bg-slate-950 border-slate-700 text-white focus:border-emerald-500'
                        }`}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono font-bold block">
                      Minimum capital: ${getTemplateMinCapital(selectedBotTemplate)} USDT
                    </span>
                  </div>

                  {/* Field 3: Trade duration */}
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold block">Trade duration :</label>
                      <span className={`px-3 py-1 rounded-xl text-xs font-mono font-black border ${
                        isLightTheme 
                          ? 'bg-amber-50 border-amber-200 text-amber-800' 
                          : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                      }`}>
                        {botDurationSeconds} seconds
                      </span>
                    </div>
                    
                    {/* Duration Slider Bar */}
                    <div className="space-y-1 pt-1">
                      <input
                        type="range"
                        min={60}
                        max={120}
                        step={1}
                        value={botDurationSeconds}
                        onChange={(e) => setBotDurationSeconds(parseInt(e.target.value) || 60)}
                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                          isLightTheme ? 'bg-zinc-200 accent-amber-500' : 'bg-slate-800 accent-emerald-500'
                        }`}
                      />
                      <div className="flex justify-between text-[11px] font-mono font-bold text-zinc-400">
                        <span>60 seconds</span>
                        <span>120 seconds</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons: CANCEL & RUN */}
                <div className="flex items-center gap-3 pt-4 border-t border-zinc-200/60 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedBotTemplate(null)}
                    className={`flex-1 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider cursor-pointer border transition-all ${
                      isLightTheme 
                        ? 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200' 
                        : 'bg-slate-800 border-slate-700 text-zinc-300 hover:bg-slate-750'
                    }`}
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    disabled={botDeployLoading || !botCapitalInput || parseFloat(botCapitalInput) < selectedBotTemplate.minCapital}
                    onClick={handleDeployBot}
                    className={`flex-1 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-sm ${
                      isLightTheme 
                        ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/20' 
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                    }`}
                  >
                    {botDeployLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin"></div>
                        <span>Deploying...</span>
                      </>
                    ) : (
                      <>
                        <Zap size={16} />
                        <span>RUN</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'earn' && (
            selectedLeadForCopy ? (
              <div id="copy-trade-execution-page" className="space-y-6 animate-fade-in">
                {/* Top Back Navigation Bar */}
                <div className="flex flex-row items-center justify-between gap-2 sm:gap-3 pb-3 border-b border-zinc-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedLeadForCopy(null)}
                    className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl font-black text-[11px] sm:text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs shrink-0 whitespace-nowrap ${
                      isLightTheme 
                        ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200' 
                        : 'bg-slate-800 hover:bg-slate-700 text-zinc-200 border border-slate-700'
                    }`}
                  >
                    <ArrowLeft size={15} className="shrink-0" />
                    <span className="hidden sm:inline">Back to Expert Traders</span>
                    <span className="sm:hidden">Back to Experts</span>
                  </button>
                  <span className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-extrabold font-mono shrink-0 whitespace-nowrap ${
                    isLightTheme ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                  }`}>
                    <span className="hidden xs:inline">Expert Trading Terminal</span>
                    <span className="xs:hidden">Trading Terminal</span>
                  </span>
                </div>

                {/* Main Page Content Card */}
                <div className={`w-full p-4 sm:p-6 rounded-2xl sm:rounded-3xl border shadow-lg space-y-4 ${
                  isLightTheme ? 'bg-white border-zinc-200 text-zinc-900 shadow-slate-900/5' : 'bg-slate-900 border-slate-800 text-white shadow-black/40'
                }`}>
                  {/* Compact Header & Live Signal Window Status */}
                  {(() => {
                    const signalInfo = getLeadSignalWindowCountdown(selectedLeadForCopy);
                    const existingActiveContract = userCopyTrades.find(
                      t => (t.leadId === selectedLeadForCopy.id || (t.leadName && t.leadName.toLowerCase() === selectedLeadForCopy.name.toLowerCase())) && t.status === 'ACTIVE'
                    );
                    const lockedPrincipal = existingActiveContract?.contractCapital || existingActiveContract?.amount || 0;

                    return (
                      <div className="space-y-2.5 pb-2.5 border-b border-zinc-200 dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <ExpertAvatar 
                                photoUrl={selectedLeadForCopy.photoUrl} 
                                name={selectedLeadForCopy.name} 
                                className="w-12 h-12" 
                                size={140} 
                                roundedClassName="rounded-xl" 
                                borderClassName="border-2 border-amber-500/80" 
                              />
                              {signalInfo.isActive ? (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
                                </span>
                              ) : (
                                <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-slate-950 text-amber-400 border border-amber-500/30">
                                  <Clock size={10} />
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className={`font-black text-base sm:text-lg tracking-tight ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                                  {selectedLeadForCopy.name}
                                </h3>
                                <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase font-mono ${
                                  isLightTheme ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}>
                                  {selectedLeadForCopy.winRate}% Win
                                </span>
                                {existingActiveContract && (
                                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                                    <Lock size={9} /> Running (${lockedPrincipal.toFixed(2)})
                                  </span>
                                )}
                              </div>
                              <p className={`text-[11px] font-medium mt-0.5 ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                Yield: <strong className="text-emerald-500 font-mono">{getLeadDailyProfitRange(selectedLeadForCopy)}/d</strong> • Fee: <strong className="text-amber-500 font-mono">{selectedLeadForCopy.analysisCommission ?? 10}%</strong> • {selectedLeadForCopy.tradingPairs?.slice(0, 2).join(', ') || 'BTC/USDT'}
                              </p>
                            </div>
                          </div>

                          {/* Compact Live Signal Window Badge */}
                          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2.5 shrink-0 ${
                            signalInfo.isActive
                              ? isLightTheme ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-2xs' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                              : isLightTheme ? 'bg-zinc-50 border-zinc-200 text-zinc-800' : 'bg-slate-950 border-slate-800 text-zinc-300'
                          }`}>
                            <div className={`p-1 rounded-lg shrink-0 ${
                              signalInfo.isActive ? 'bg-emerald-500 text-slate-950 animate-pulse' : 'bg-amber-500/10 text-amber-500'
                            }`}>
                              {signalInfo.isActive ? <Zap size={13} /> : <Clock size={13} />}
                            </div>
                            <div className="min-w-0 pr-0.5">
                              <div className="flex items-center gap-1">
                                <span className={`text-[9px] font-black uppercase tracking-wider ${
                                  signalInfo.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'
                                }`}>
                                  {signalInfo.isActive ? 'Signal Active' : 'Standby'}
                                </span>
                              </div>
                              <div className="font-mono text-xs font-black tracking-tight flex items-center gap-1">
                                <span>{signalInfo.countdownText}</span>
                                <span className="text-[9.5px] font-medium opacity-75">({signalInfo.signalTime})</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Existing Contract Quick Step 3 Jump Pill */}
                        {existingActiveContract && copyTradeStep !== 3 && (
                          <div className={`px-3 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                            isLightTheme ? 'bg-blue-50/70 border-blue-200 text-blue-950' : 'bg-blue-950/30 border-blue-800/40 text-blue-200'
                          }`}>
                            <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
                              <ShieldCheck size={13} className="text-blue-500 shrink-0" />
                              <span className="truncate">Active principal: <strong>${lockedPrincipal.toFixed(2)} USD</strong></span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCopyTradeStep(3)}
                              className="px-2 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-[9.5px] uppercase tracking-wider shrink-0 transition-all cursor-pointer flex items-center gap-1"
                            >
                              <span>Enter Signal</span>
                              <ArrowRight size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Stepper Navigation Bar */}
                  <div className={`grid grid-cols-3 gap-1.5 p-1 rounded-xl border ${
                    isLightTheme 
                      ? 'bg-zinc-100/90 border-zinc-200' 
                      : 'bg-slate-950 border-slate-800'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setCopyTradeStep(1)}
                      className={`py-2 px-2.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        copyTradeStep === 1
                          ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                          : copyTradeStep > 1
                          ? isLightTheme ? 'bg-white text-emerald-800 font-bold border border-zinc-200 shadow-2xs' : 'bg-slate-900 text-emerald-400 font-bold'
                          : isLightTheme ? 'text-zinc-600 hover:text-zinc-900 font-bold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">1. Schedule</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCopyTradeStep(2)}
                      className={`py-2 px-2.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        copyTradeStep === 2
                          ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                          : copyTradeStep > 2
                          ? isLightTheme ? 'bg-white text-emerald-800 font-bold border border-zinc-200 shadow-2xs' : 'bg-slate-900 text-emerald-400 font-bold'
                          : isLightTheme ? 'text-zinc-600 hover:text-zinc-900 font-bold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">2. Capital</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCopyTradeStep(3)}
                      className={`py-2 px-2.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        copyTradeStep === 3
                          ? 'bg-amber-500 text-slate-950 font-black shadow-xs animate-pulse'
                          : isLightTheme ? 'text-zinc-600 hover:text-zinc-900 font-bold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">3. Execute</span>
                    </button>
                  </div>

                  {/* STEP 1: Compact Parameters & Schedule */}
                  {copyTradeStep === 1 && (
                    <div className="space-y-3.5 animate-fade-in">
                      {/* Compact Stats Row */}
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className={`p-2.5 rounded-xl border ${isLightTheme ? 'bg-zinc-50/90 border-zinc-200' : 'bg-slate-950/80 border-slate-800'}`}>
                          <span className={`text-[8.5px] font-black uppercase tracking-wider block ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>Min</span>
                          <span className={`font-black font-mono text-xs sm:text-sm mt-0.5 block ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                            ${selectedLeadForCopy.minCapital ?? 50}
                          </span>
                        </div>
                        <div className={`p-2.5 rounded-xl border ${isLightTheme ? 'bg-zinc-50/90 border-zinc-200' : 'bg-slate-950/80 border-slate-800'}`}>
                          <span className={`text-[8.5px] font-black uppercase tracking-wider block ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>Max</span>
                          <span className={`font-black font-mono text-xs sm:text-sm mt-0.5 block ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                            ${selectedLeadForCopy.maxCapital ?? 10000}
                          </span>
                        </div>
                        <div className={`p-2.5 rounded-xl border ${isLightTheme ? 'bg-amber-50/90 border-amber-200' : 'bg-amber-500/10 border-amber-500/20'}`}>
                          <span className={`text-[8.5px] font-black uppercase tracking-wider block ${isLightTheme ? 'text-amber-900' : 'text-amber-400'}`}>Commission</span>
                          <span className={`font-black font-mono text-xs sm:text-sm mt-0.5 block ${isLightTheme ? 'text-amber-800' : 'text-amber-300'}`}>
                            {selectedLeadForCopy.analysisCommission ?? 10}%
                          </span>
                        </div>
                        <div className={`p-2.5 rounded-xl border ${isLightTheme ? 'bg-emerald-50/90 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                          <span className={`text-[8.5px] font-black uppercase tracking-wider block ${isLightTheme ? 'text-emerald-900' : 'text-emerald-400'}`}>Daily Yield</span>
                          <span className={`font-black font-mono text-xs sm:text-sm mt-0.5 block ${isLightTheme ? 'text-emerald-700' : 'text-emerald-300'}`}>
                            {getLeadDailyProfitRange(selectedLeadForCopy)}
                          </span>
                        </div>
                      </div>

                      {/* Daily Signal Schedule List */}
                      <div className={`p-3.5 sm:p-4 rounded-xl border space-y-2.5 ${
                        isLightTheme ? 'bg-zinc-50/80 border-zinc-200' : 'bg-slate-950 border-slate-800'
                      }`}>
                        {(() => {
                          const userCountry = profile?.country || 'Kenya';
                          const userTzInfo = getUserTimezoneInfo(userCountry);

                          return (
                            <div className="flex items-center justify-between flex-wrap gap-1.5 text-xs">
                              <span className={`text-[10.5px] font-black uppercase tracking-wider ${isLightTheme ? 'text-zinc-800' : 'text-zinc-300'}`}>
                                Today's Signals
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-bold font-mono flex items-center gap-1 ${
                                isLightTheme ? 'bg-zinc-200/90 text-zinc-800' : 'bg-slate-800 text-zinc-300'
                              }`}>
                                <Globe size={10} className="shrink-0 text-amber-500" />
                                <span>{userTzInfo.flag} {userTzInfo.code}</span>
                              </span>
                            </div>
                          );
                        })()}

                        {selectedLeadForCopy.signals && selectedLeadForCopy.signals.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedLeadForCopy.signals.map((sig, idx) => {
                              const activeSig = getActiveSignalForLead(selectedLeadForCopy);
                              const isActive = activeSig && activeSig.time === sig.time && !activeSig.isExtra;
                              const isExecuted = isSignalExecutedToday(selectedLeadForCopy, sig);
                              const fmtSig = formatSignalTimeForCountry(sig.time, profile?.country);

                              return (
                                <div 
                                  key={idx}
                                  className={`p-2.5 sm:p-3 rounded-xl border transition-all flex items-center justify-between ${
                                    isExecuted
                                      ? isLightTheme ? 'bg-zinc-100/80 border-zinc-200 text-zinc-400' : 'bg-slate-900/60 border-slate-800 text-zinc-500'
                                      : isActive
                                      ? isLightTheme ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs' : 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                                      : isLightTheme ? 'bg-white border-zinc-200/90 text-zinc-800 shadow-2xs' : 'bg-slate-900 border-slate-800 text-zinc-300'
                                  }`}
                                >
                                  <div className="min-w-0 pr-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-black font-mono">
                                        {fmtSig.localTimeStr}
                                      </span>
                                      {isExecuted ? (
                                        <span className="px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 text-[8.5px] font-black uppercase">
                                          Done
                                        </span>
                                      ) : isActive ? (
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[8.5px] font-black uppercase">
                                          Active
                                        </span>
                                      ) : null}
                                    </div>
                                    <span className={`text-[9.5px] font-medium block mt-0.5 ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                      Signal #{idx + 1}
                                    </span>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <span className={`text-[10.5px] font-black font-mono block ${
                                      isExecuted ? 'text-zinc-400' : isLightTheme ? 'text-zinc-800' : 'text-zinc-200'
                                    }`}>
                                      {selectedLeadForCopy.tradingPairs?.[idx % (selectedLeadForCopy.tradingPairs.length || 1)] || 'BTC/USDT'}
                                    </span>
                                    <span className={`text-[8.5px] font-bold uppercase tracking-wider block mt-0.5 ${
                                      isExecuted ? 'text-zinc-400' : isActive ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-zinc-500'
                                    }`}>
                                      {isExecuted ? 'Executed' : isActive ? 'In Window' : 'Scheduled'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className={`text-xs italic ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>No regular signals scheduled.</p>
                        )}

                        {/* Extra Signals (Streamlined) */}
                        {selectedLeadForCopy.extraSignals && selectedLeadForCopy.extraSignals.length > 0 && (() => {
                          const extraEligibility = getExtraSignalEligibility(selectedLeadForCopy);

                          return (
                            <div className="space-y-2.5 pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-800">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  <Zap size={13} className="text-amber-500 fill-amber-500 shrink-0" />
                                  <span className={`text-[11px] font-black uppercase tracking-wider ${isLightTheme ? 'text-zinc-950' : 'text-white'}`}>
                                    Extra Signals
                                  </span>
                                </div>
                                {extraEligibility.eligible ? (
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${
                                    isLightTheme 
                                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300' 
                                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  }`}>
                                    Unlocked ({extraEligibility.badgeText})
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={handleCopyReferralLink}
                                    className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-400 transition-all cursor-pointer shadow-2xs active:scale-95"
                                    title="Copy referral link to unlock"
                                  >
                                    <UserPlus size={10} className="shrink-0" />
                                    <span>Refer to Unlock</span>
                                  </button>
                                )}
                              </div>

                              {/* Refer to Unlock Notice Banner */}
                              {!extraEligibility.eligible && (
                                <div className={`px-3 py-2.5 rounded-2xl border text-xs flex items-center justify-between gap-2.5 shadow-2xs ${
                                  isLightTheme 
                                    ? 'bg-[#F4FBF6] border-emerald-300/80 text-zinc-900' 
                                    : 'bg-emerald-950/30 border-emerald-800/40 text-emerald-100'
                                }`}>
                                  <div className="flex items-center gap-2 min-w-0 text-[11px]">
                                    <Sparkles size={14} className="text-[#008B47] shrink-0" />
                                    <span className={`truncate ${isLightTheme ? 'text-zinc-800' : 'text-zinc-200'}`}>
                                      Unlock <strong className={isLightTheme ? 'text-zinc-950 font-black' : 'text-white font-black'}>24h</strong> of extra signals when a friend deposits!
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleCopyReferralLink}
                                    className="px-2.5 py-1 rounded-xl bg-[#008B47] hover:bg-[#007038] text-white font-black text-[9.5px] uppercase tracking-wider shrink-0 transition-all flex items-center gap-1 cursor-pointer shadow-2xs border border-[#00A653] active:scale-95"
                                  >
                                    <Copy size={10} />
                                    <span>Copy Link</span>
                                  </button>
                                </div>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {selectedLeadForCopy.extraSignals.map((es, idx) => {
                                  const activeSig = getActiveSignalForLead(selectedLeadForCopy);
                                  const isActive = activeSig && activeSig.time === es.time && activeSig.isExtra;
                                  const isExecuted = isSignalExecutedToday(selectedLeadForCopy, es);
                                  const fmtSig = formatSignalTimeForCountry(es.time, profile?.country);

                                  return (
                                    <div
                                      key={`extra-${idx}`}
                                      className={`p-3 rounded-2xl border flex items-center justify-between transition-all shadow-2xs ${
                                        isExecuted
                                          ? isLightTheme ? 'bg-zinc-100/80 border-zinc-200 text-zinc-400' : 'bg-slate-900/60 border-slate-800 text-zinc-500'
                                          : !extraEligibility.eligible
                                          ? isLightTheme ? 'bg-white border-emerald-200/80 text-zinc-800' : 'bg-slate-900/60 border-slate-800 text-zinc-300'
                                          : isActive
                                          ? isLightTheme ? 'bg-emerald-100 border-emerald-400 text-emerald-950 shadow-xs' : 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                                          : isLightTheme ? 'bg-[#F4FBF6] border-emerald-200 text-zinc-900' : 'bg-emerald-950/20 border-emerald-900/40 text-zinc-300'
                                      }`}
                                    >
                                      <div className="min-w-0 pr-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className={`text-xs font-black font-mono ${
                                            isExecuted ? 'text-zinc-400 line-through' : isLightTheme ? 'text-zinc-950' : 'text-white'
                                          }`}>
                                            {fmtSig.localTimeStr}
                                          </span>
                                          {!extraEligibility.eligible ? (
                                            <button
                                              type="button"
                                              onClick={handleCopyReferralLink}
                                              className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border flex items-center gap-1 cursor-pointer transition-all ${
                                                isLightTheme 
                                                  ? 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200' 
                                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                                              }`}
                                              title="Refer friend to unlock"
                                            >
                                              <Lock size={8} className="text-amber-700 dark:text-amber-400 shrink-0" />
                                              <span>Locked</span>
                                            </button>
                                          ) : null}
                                        </div>
                                        <span className={`text-[10px] font-semibold block mt-0.5 ${isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                          {es.label || `Extra Signal #${idx + 1}`}
                                        </span>
                                      </div>

                                      <div className="text-right shrink-0">
                                        <span className={`text-[10.5px] font-black font-mono block ${
                                          isExecuted ? 'text-zinc-400' : isLightTheme ? 'text-zinc-800' : 'text-zinc-200'
                                        }`}>
                                          {selectedLeadForCopy.tradingPairs?.[(idx + 1) % (selectedLeadForCopy.tradingPairs.length || 1)] || 'ETH/USDT'}
                                        </span>
                                        <span className={`text-[8.5px] font-bold uppercase tracking-wider block mt-0.5 ${
                                          isExecuted 
                                            ? 'text-zinc-400' 
                                            : !extraEligibility.eligible 
                                            ? 'text-amber-600 dark:text-amber-400 font-bold' 
                                            : isActive 
                                            ? 'text-emerald-600 dark:text-emerald-400 font-black' 
                                            : 'text-zinc-500'
                                        }`}>
                                          {isExecuted ? 'Executed' : !extraEligibility.eligible ? 'Locked' : isActive ? 'In Window' : 'VIP Signal'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Step 1 Actions */}
                      <div className="pt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedLeadForCopy(null)}
                          className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                            isLightTheme ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-zinc-200'
                          }`}
                        >
                          <ArrowLeft size={14} className="shrink-0" />
                          <span>Back</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCopyTradeStep(2)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-xs border border-amber-400 cursor-pointer transition-all flex items-center justify-center active:scale-[0.98]"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Configure Capital & Pair */}
                  {copyTradeStep === 2 && (
                    <div className="space-y-3.5 animate-fade-in">
                      {/* Trading Pair Selection */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <label className={`font-black uppercase tracking-wider text-[10.5px] block ${isLightTheme ? 'text-zinc-700' : 'text-zinc-300'}`}>
                            Trading Pair
                          </label>
                          <span className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            isLightTheme ? 'bg-amber-100 text-amber-900' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {copyTradePair}
                          </span>
                        </div>

                        <TradingPairSelector
                          value={copyTradePair}
                          onChange={(val) => setCopyTradePair(val)}
                          pairs={
                            selectedLeadForCopy.tradingPairs && selectedLeadForCopy.tradingPairs.length > 0
                              ? selectedLeadForCopy.tradingPairs
                              : ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT']
                          }
                          isLightTheme={isLightTheme}
                        />
                      </div>

                      {/* Capital Amount Configuration */}
                      {(() => {
                        const { rawLockedCapital, activeContractCapitalByLead } = getCopyTradeLockedAndFree();
                        const totalBal = profile?.tradeBalance ?? 0;
                        const currentLeadKey = selectedLeadForCopy.id || selectedLeadForCopy.name;
                        const currentLeadLockedCap = activeContractCapitalByLead[currentLeadKey] || 0;
                        const minLeadCap = selectedLeadForCopy.minCapital ?? 50;
                        const effectiveMinCap = Math.max(minLeadCap, currentLeadLockedCap);
                        const lockedInOtherExperts = Math.max(0, rawLockedCapital - currentLeadLockedCap);
                        const availableForThisLead = Math.max(0, totalBal - lockedInOtherExperts);

                        return (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <label className={`font-black uppercase tracking-wider text-[10.5px] ${isLightTheme ? 'text-zinc-800' : 'text-zinc-300'}`}>
                                Trade Capital Amount
                              </label>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10.5px] font-mono ${isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                  Available: <strong className={isLightTheme ? 'text-amber-800 font-bold' : 'text-amber-400'}>${availableForThisLead.toFixed(2)}</strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTransferModalType('IN');
                                    setTransferAmountInput('');
                                  }}
                                  className="text-[10.5px] font-black text-amber-800 dark:text-amber-400 hover:underline cursor-pointer ml-1"
                                >
                                  + Top up
                                </button>
                              </div>
                            </div>

                            <div className={`relative flex items-center border rounded-xl px-3.5 py-2 transition-all gap-1.5 ${
                              isLightTheme 
                                ? 'bg-zinc-50/90 border-zinc-300 focus-within:bg-white focus-within:border-amber-500 shadow-2xs' 
                                : 'bg-slate-950 border-slate-800 focus-within:border-amber-500'
                            }`}>
                              <span className={`text-base font-black font-mono mr-1 ${isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}`}>$</span>
                              <input
                                type="number"
                                step="any"
                                min={effectiveMinCap}
                                placeholder={`Min $${effectiveMinCap.toFixed(0)}`}
                                value={copyTradeAmountInput}
                                onChange={(e) => setCopyTradeAmountInput(e.target.value)}
                                className={`w-full bg-transparent font-mono text-base font-black outline-none ${
                                  isLightTheme ? 'text-zinc-950 placeholder:text-zinc-400' : 'text-white placeholder:text-zinc-600'
                                }`}
                              />
                              <span className={`text-[11px] font-black font-mono uppercase ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>USD</span>
                              {availableForThisLead > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const maxAvail = Math.min(availableForThisLead, selectedLeadForCopy.maxCapital ?? 10000);
                                    setCopyTradeAmountInput(maxAvail.toString());
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer uppercase shadow-2xs shrink-0 border border-amber-400 active:scale-95"
                                >
                                  MAX
                                </button>
                              )}
                            </div>

                            {/* Principal Quick Chip & Lock Information */}
                            {currentLeadLockedCap > 0 && (
                              <div className="space-y-1.5 pt-0.5">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setCopyTradeAmountInput(currentLeadLockedCap.toFixed(2))}
                                    className="px-3 py-1 rounded-lg text-[10.5px] font-mono font-black bg-amber-100/90 text-amber-950 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 hover:bg-amber-200 transition-all cursor-pointer shadow-2xs"
                                  >
                                    Principal (${currentLeadLockedCap.toFixed(2)})
                                  </button>
                                </div>
                                <p className={`text-[10px] font-medium flex items-center gap-1 leading-snug ${
                                  isLightTheme ? 'text-zinc-500' : 'text-zinc-400'
                                }`}>
                                  <Lock size={10} className="shrink-0 text-amber-600 dark:text-amber-400" />
                                  <span>Active principal (${currentLeadLockedCap.toFixed(2)}) is locked. You can trade with this amount or scale up to a higher amount.</span>
                                </p>
                              </div>
                            )}

                            {/* Rollover Upgrade Option Callout Banner if user has contract in another expert */}
                            {lockedInOtherExperts > 0 && (() => {
                              const activeContracts = getMergedActiveContracts(userCopyTrades);
                              const otherContract = activeContracts.find(t => (t.leadId !== selectedLeadForCopy.id && t.leadName !== selectedLeadForCopy.name));
                              if (!otherContract) return null;
                              const otherPrincipal = otherContract.contractCapital || otherContract.amount || 0;

                              return (
                                <div className={`mt-2 p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                                  isLightTheme ? 'bg-amber-100/80 border-amber-300 text-amber-950 shadow-2xs' : 'bg-amber-500/15 border-amber-500/30 text-amber-200'
                                }`}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Sparkles size={16} className="text-amber-700 dark:text-amber-400 shrink-0" />
                                    <div className="text-xs min-w-0">
                                      <p className="font-black">Principal Rollover Upgrade Available</p>
                                      <p className={`text-[10.5px] truncate ${isLightTheme ? 'text-amber-900' : 'text-amber-300'}`}>
                                        Roll over ${otherPrincipal.toFixed(2)} locked with {otherContract.leadName} + your free balance into {selectedLeadForCopy.name}.
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setUpgradeModalData({ oldTrade: otherContract, targetLead: selectedLeadForCopy })}
                                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shrink-0 transition-all shadow-2xs cursor-pointer border border-amber-400 active:scale-95"
                                  >
                                    Upgrade & Rollover
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {/* Step 2 Actions */}
                      {(() => {
                        const { activeContractCapitalByLead } = getCopyTradeLockedAndFree();
                        const currentLeadKey = selectedLeadForCopy.id || selectedLeadForCopy.name;
                        const currentLeadLockedCap = activeContractCapitalByLead[currentLeadKey] || 0;
                        const minLeadCap = selectedLeadForCopy.minCapital ?? 50;
                        const effectiveMinCap = Math.max(minLeadCap, currentLeadLockedCap);
                        const isInvalid = !copyTradeAmountInput || parseFloat(copyTradeAmountInput) < effectiveMinCap || parseFloat(copyTradeAmountInput) > (selectedLeadForCopy.maxCapital ?? 10000);

                        return (
                          <div className="pt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => setCopyTradeStep(1)}
                              className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                                isLightTheme ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-zinc-200'
                              }`}
                            >
                              <ArrowLeft size={14} className="shrink-0" />
                              <span>Previous</span>
                            </button>
                            <button
                              type="button"
                              disabled={isInvalid}
                              onClick={() => setCopyTradeStep(3)}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-xs border border-amber-400 cursor-pointer transition-all flex items-center justify-center active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* STEP 3: Signal Code & Execute */}
                  {copyTradeStep === 3 && (
                    <div className="space-y-3.5 animate-fade-in">
                      {/* Compact Trade Summary Review */}
                      {(() => {
                        const activeSig = getActiveSignalForLead(selectedLeadForCopy);
                        const isExtra = Boolean(activeSig?.isExtra) || (selectedLeadForCopy.extraSignals || []).some(es => (es.code || '').toUpperCase() === copySignalCodeInput.trim().toUpperCase());
                        const extraEligibility = isExtra ? getExtraSignalEligibility(selectedLeadForCopy) : null;
                        
                        const existingActiveContract = userCopyTrades.find(
                          t => (t.leadId === selectedLeadForCopy.id || t.leadName === selectedLeadForCopy.name) && t.status === 'ACTIVE'
                        );
                        const lockedPrincipalCapital = existingActiveContract?.contractCapital || existingActiveContract?.amount || parseFloat(copyTradeAmountInput) || (selectedLeadForCopy.minCapital ?? 50);
                        const tradeCap = isExtra ? lockedPrincipalCapital : (parseFloat(copyTradeAmountInput) || 0);

                        let rate = 0;
                        if (isExtra) {
                          const matchedExtra = (selectedLeadForCopy.extraSignals || []).find(es => (es.code || '').toUpperCase() === copySignalCodeInput.trim().toUpperCase()) || activeSig;
                          rate = matchedExtra?.profitRate ?? 3.5;
                        } else {
                          const numSigs = selectedLeadForCopy.signals?.length || 1;
                          const dayRate = selectedLeadForCopy.dayProfitRate ?? 2.0;
                          rate = dayRate / numSigs;
                        }

                        const gross = tradeCap * (rate / 100);
                        const comm = gross * ((selectedLeadForCopy.analysisCommission ?? 10) / 100);
                        const net = gross - comm;

                        return (
                          <div className={`p-3.5 rounded-xl border space-y-1.5 text-xs ${
                            isLightTheme ? 'bg-zinc-50/90 border-zinc-200' : 'bg-slate-950 border-slate-800'
                          }`}>
                            <div className="flex justify-between items-center text-[11.5px]">
                              <span className={`font-medium ${isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}`}>Pair & Trader:</span>
                              <span className="font-extrabold">{copyTradePair} • {selectedLeadForCopy.name}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11.5px]">
                              <span className={`font-medium ${isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}`}>Trade Capital:</span>
                              <span className="font-black font-mono">${tradeCap.toFixed(2)} USD</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-zinc-200/80 dark:border-slate-800 pt-1.5">
                              <span className={`font-bold ${isLightTheme ? 'text-zinc-800' : 'text-zinc-300'}`}>Est. Net Profit:</span>
                              <span className="font-black font-mono text-emerald-700 dark:text-emerald-400">
                                +${net.toFixed(2)} USD
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Signal Executed Status notice */}
                      {(() => {
                        const activeSig = getActiveSignalForLead(selectedLeadForCopy);
                        if (activeSig && isSignalExecutedToday(selectedLeadForCopy, activeSig)) {
                          return (
                            <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 font-bold ${
                              isLightTheme ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            }`}>
                              <AlertCircle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                              <span>Signal code ({activeSig.code}) was already executed today.</span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Extra Signal Locked Referral Banner */}
                      {(() => {
                        const activeSig = getActiveSignalForLead(selectedLeadForCopy);
                        const isExtra = Boolean(activeSig?.isExtra) || (selectedLeadForCopy.extraSignals || []).some(es => (es.code || '').toUpperCase() === copySignalCodeInput.trim().toUpperCase());
                        const extraEligibility = isExtra ? getExtraSignalEligibility(selectedLeadForCopy) : null;
                        const isBlockedByLock = isExtra && extraEligibility && !extraEligibility.eligible;

                        if (isBlockedByLock) {
                          return (
                            <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 font-medium ${
                              isLightTheme ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs' : 'bg-amber-950/20 border-amber-900/50 text-amber-200'
                            }`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <Lock size={13} className="text-amber-600 shrink-0" />
                                <span className="text-[11px] truncate">
                                  Extra signal locked. <strong>Refer a friend</strong> to unlock for 24h!
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={handleCopyReferralLink}
                                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shrink-0 transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                              >
                                <UserPlus size={11} />
                                <span>Refer Friend</span>
                              </button>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Signal Code Input */}
                      <div className="space-y-1">
                        <label className={`text-[10.5px] font-black uppercase tracking-wider block ${isLightTheme ? 'text-zinc-800' : 'text-zinc-300'}`}>
                          Signal Code
                        </label>
                        <input
                          type="text"
                          placeholder="Enter Signal Code (e.g. SIG1300)"
                          value={copySignalCodeInput}
                          onChange={(e) => setCopySignalCodeInput(e.target.value)}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-mono font-black tracking-wider uppercase outline-none ${
                            isLightTheme 
                              ? 'bg-zinc-50/90 border-zinc-300 focus:bg-white focus:border-amber-500 text-zinc-950 placeholder:text-zinc-400 shadow-2xs' 
                              : 'bg-slate-950 border-slate-800 focus:border-amber-500 text-white placeholder:text-zinc-600'
                          }`}
                        />
                      </div>

                      {/* Step 3 Actions */}
                      <div className="pt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCopyTradeStep(2)}
                          className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                            isLightTheme ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-zinc-200'
                          }`}
                        >
                          <ArrowLeft size={14} className="shrink-0" />
                          <span>Previous</span>
                        </button>
                        {(() => {
                          const activeSig = getActiveSignalForLead(selectedLeadForCopy);
                          const isDone = activeSig ? isSignalExecutedToday(selectedLeadForCopy, activeSig) : false;
                          const isExtra = Boolean(activeSig?.isExtra) || (selectedLeadForCopy.extraSignals || []).some(es => (es.code || '').toUpperCase() === copySignalCodeInput.trim().toUpperCase());
                          const extraEligibility = isExtra ? getExtraSignalEligibility(selectedLeadForCopy) : null;
                          const isBlockedByLock = isExtra && extraEligibility && !extraEligibility.eligible;

                          return (
                            <button
                              type="button"
                              disabled={isSubmittingCopy || isDone || Boolean(isBlockedByLock)}
                              onClick={handleExecuteCopyTrade}
                              className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs shadow-xs border cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap ${
                                isBlockedByLock
                                  ? 'bg-zinc-300 dark:bg-slate-800 border-zinc-400 dark:border-slate-700 text-zinc-600 dark:text-zinc-400'
                                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 border-amber-400'
                              }`}
                            >
                              {isSubmittingCopy ? (
                                <RefreshCw size={14} className="animate-spin" />
                              ) : isDone ? (
                                <span className="flex items-center gap-1">
                                  <CheckCircle size={13} className="shrink-0 text-slate-900" />
                                  <span>Executed Today</span>
                                </span>
                              ) : isBlockedByLock ? (
                                <span className="flex items-center gap-1">
                                  <Lock size={13} className="shrink-0" />
                                  <span>Signal Locked</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Zap size={13} className="shrink-0 text-slate-950" />
                                  <span>Execute Trade</span>
                                </span>
                              )}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-5 animate-fade-in">
              {/* Interactive Trade Wallet Card at Top (Compact Space-Saving Golden Theme) */}
              <div id="copy-signal-interactive-trade-wallet" className="-mx-1 sm:-mx-2 md:mx-0 p-3.5 sm:p-4 md:p-4.5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-500 via-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/15 relative overflow-hidden transition-all duration-300 border border-amber-400/40">
                {/* Subtle light overlay glow */}
                <div className="absolute top-0 right-0 w-44 h-44 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-600/20 rounded-full blur-xl -ml-8 -mb-8 pointer-events-none" />

                <div className="flex flex-col gap-2.5 relative z-10">
                  {/* Top Header Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Activity size={13} className="text-white shrink-0" strokeWidth={2.5} />
                      <span className="text-[10.5px] sm:text-xs font-black uppercase tracking-wider text-white font-sans">
                        COPY TRADE BALANCE
                      </span>
                    </div>

                    <span className="px-2 py-0.5 rounded-md bg-white text-slate-950 font-black text-[9px] uppercase tracking-wider shadow-2xs font-mono shrink-0">
                      TRADE WALLET
                    </span>
                  </div>

                  {/* Main Balance & Key Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <h2 className="text-2xl sm:text-3xl font-black font-sans tracking-tight text-white leading-none">
                          $ {(profile?.tradeBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h2>
                        <span className="text-[10px] font-extrabold text-white/80 font-mono uppercase">USD</span>
                      </div>

                      {/* Compact Badges Row (All on 1 clean line) */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/20 text-white text-[10px] font-medium backdrop-blur-xs">
                          <span className="text-white/75">Wallet:</span>
                          <strong className="text-white font-mono font-bold">
                            ${getWalletBalance(profile).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </strong>
                        </div>

                        {(() => {
                          const { lockedCapital, freeTransferrable } = getCopyTradeLockedAndFree();
                          return (
                            <>
                              <div id="copy-trade-free-transfer-badge" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-400/30 text-emerald-200 text-[10px] font-bold backdrop-blur-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <span className="text-emerald-100/80">Free:</span>
                                <strong className="text-emerald-300 font-mono font-black">
                                  ${freeTransferrable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </strong>
                              </div>

                              {lockedCapital > 0 && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/50 border border-amber-300/30 text-amber-200 text-[10px] font-bold backdrop-blur-xs">
                                  <span className="text-amber-200/80">Locked:</span>
                                  <strong className="text-amber-300 font-mono font-bold">
                                    ${lockedCapital.toFixed(2)}
                                  </strong>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Compact Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 pt-0.5 sm:pt-0">
                      <button
                        id="trade-wallet-transfer-in-btn"
                        type="button"
                        onClick={() => {
                          setTransferModalType('IN');
                          setTransferAmountInput('');
                        }}
                        className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 active:scale-95 text-white font-black text-xs shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-slate-800"
                      >
                        <ArrowDownLeft size={13} strokeWidth={3} className="shrink-0 text-white" />
                        <span className="whitespace-nowrap">Transfer in</span>
                      </button>

                      <button
                        id="trade-wallet-transfer-out-btn"
                        type="button"
                        onClick={() => {
                          setTransferModalType('OUT');
                          setTransferAmountInput('');
                        }}
                        className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-white hover:bg-amber-50 active:scale-95 text-slate-950 font-black text-xs shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-white"
                      >
                        <ArrowUpRight size={13} strokeWidth={3} className="shrink-0 text-slate-950" />
                        <span className="whitespace-nowrap">Transfer out</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>



              {/* Active Copy Trade Contracts Section */}
              {(() => {
                const activeContracts = getMergedActiveContracts(userCopyTrades);
                if (activeContracts.length === 0) return null;

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        isLightTheme ? 'text-zinc-900' : 'text-zinc-200'
                      }`}>
                        <Sparkles size={14} className="text-amber-500" />
                        Active Contracts ({activeContracts.length})
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {activeContracts.map(trade => {
                        const contract = getContractProgressDetails(trade);
                        const tradeCapital = trade.contractCapital || trade.amount || 0;
                        const netProfit = trade.netProfit || 0;

                        return (
                          <div 
                            key={trade.id} 
                            onClick={() => setSelectedContractForDetail(trade)}
                            className={`p-3 sm:p-3.5 rounded-2xl border relative overflow-hidden flex items-center justify-between gap-3 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md active:scale-[0.99] group ${
                              isLightTheme 
                                ? 'bg-white hover:bg-amber-50/20 border-amber-200/80 hover:border-amber-400 shadow-xs' 
                                : 'bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-amber-500/40'
                            }`}
                          >
                            {/* Left: Avatar & Contract Summary */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <ExpertAvatar 
                                photoUrl={trade.leadPhotoUrl} 
                                name={trade.leadName} 
                                className="w-10 h-10 shrink-0" 
                                size={120} 
                                roundedClassName="rounded-full" 
                                borderClassName="border-2 border-amber-400/90" 
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h5 className={`font-black text-sm truncate ${isLightTheme ? 'text-zinc-950' : 'text-white'}`}>
                                    {trade.leadName}
                                  </h5>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-mono mt-0.5 flex-wrap">
                                  <span className={`font-bold ${isLightTheme ? 'text-zinc-800' : 'text-zinc-300'}`}>
                                    ${tradeCapital.toFixed(2)}
                                  </span>
                                  <span className="text-zinc-400">•</span>
                                  <span className="font-black text-emerald-700 dark:text-emerald-400">
                                    +${netProfit.toFixed(2)}
                                  </span>
                                  <span className="text-zinc-400">•</span>
                                  <span className="text-zinc-500 font-medium text-[10.5px] font-sans">
                                    {trade.tradingPair || 'BTC/USDT'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Quick Action Chevron */}
                            <div className="flex items-center gap-1 shrink-0">
                              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-all ${
                                isLightTheme 
                                  ? 'bg-amber-50 group-hover:bg-amber-100 text-amber-900' 
                                  : 'bg-slate-800 group-hover:bg-amber-500/20 text-amber-400'
                              }`}>
                                <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Copy Trader Leads Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className={`text-xs font-black uppercase tracking-wider ${
                      isLightTheme ? 'text-zinc-900' : 'text-zinc-200'
                    }`}>
                      Copy Trading Experts ({copyLeads.length})
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {copyLeads.map((lead) => {
                    const activeContracts = getMergedActiveContracts(userCopyTrades);
                    const isAlreadyCopying = activeContracts.some(t => t.leadId === lead.id || (t.leadName && t.leadName.toLowerCase() === lead.name.toLowerCase()));

                    return (
                      <div 
                        key={lead.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between space-y-3.5 relative overflow-hidden group hover:shadow-md ${
                          isLightTheme 
                            ? 'bg-white border-amber-200/80 hover:border-amber-400' 
                            : 'bg-slate-900 border-slate-800 hover:border-amber-500/40'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <ExpertAvatar 
                              photoUrl={lead.photoUrl} 
                              name={lead.name} 
                              className="w-13 h-13" 
                              size={160} 
                              roundedClassName="rounded-full" 
                              borderClassName="border-2 border-amber-400/80" 
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <h5 className={`font-black text-sm truncate ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                                  {lead.name}
                                </h5>
                                <span className={`px-2 py-0.5 rounded-md font-mono text-[9px] font-black uppercase shrink-0 ${
                                  isLightTheme 
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}>
                                  {lead.winRate || '98.5%'} Win
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className={`text-[10.5px] font-bold font-mono ${
                                  isLightTheme ? 'text-amber-800' : 'text-amber-400'
                                }`}>
                                  ⚡ {lead.signals?.length || 2} Signals/day
                                </span>
                                {lead.extraSignals && lead.extraSignals.length > 0 && (
                                  <span className={`px-2 py-0.5 rounded-full font-black text-[9px] font-mono uppercase tracking-wide border ${
                                    isLightTheme
                                      ? 'bg-amber-100 text-amber-950 border-amber-300'
                                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                  }`}>
                                    +{lead.extraSignals.length} Extra
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md inline-block ${
                                  isLightTheme ? 'bg-zinc-100 text-zinc-800 border border-zinc-200' : 'bg-slate-800 text-zinc-300'
                                }`}>
                                  {lead.riskLevel || 'Low Risk'}
                                </span>
                                <span className={`text-[9.5px] font-mono font-black px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                                  isLightTheme 
                                    ? 'bg-emerald-50 text-emerald-850 border border-emerald-200' 
                                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                }`}>
                                  <span>Rate:</span>
                                  <span className="font-bold">{getLeadDailyProfitRange(lead)}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <p className={`text-xs line-clamp-3 leading-relaxed ${
                            isLightTheme ? 'text-zinc-600' : 'text-zinc-300'
                          }`}>
                            {lead.description}
                          </p>

                          <div className={`p-2.5 rounded-xl border flex items-center justify-between text-[10.5px] font-mono ${
                            isLightTheme ? 'bg-amber-50/60 border-amber-200/60' : 'bg-slate-950/60 border-slate-850'
                          }`}>
                            <span className="text-zinc-600 font-bold">Minimum Capital:</span>
                            <span className={`font-black text-xs ${isLightTheme ? 'text-zinc-950' : 'text-white'}`}>
                              ${lead.minCapital ?? 100}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenCopyModal(lead)}
                          className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] ${
                            isAlreadyCopying
                              ? isLightTheme
                                ? 'bg-slate-950 hover:bg-slate-900 text-amber-300 border border-slate-800 shadow-slate-950/15'
                                : 'bg-slate-950 hover:bg-slate-900 text-amber-400 border border-slate-800 shadow-emerald-500/10'
                              : isLightTheme
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                                : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/20'
                          }`}
                        >
                          {isAlreadyCopying ? (
                            <>
                              <Zap size={14} className="animate-pulse text-amber-300" />
                              <span>Execute Signal Code</span>
                            </>
                          ) : (
                            <>
                              <Users size={14} />
                              <span>Copy Trade</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            )
          )}
          {false && (
            <div className="hidden">
                <div 
                  id="earn-investment-wallet-card" 
                  className={`relative overflow-hidden rounded-3xl p-6 border transition-all duration-300 ${
                    isLightTheme 
                      ? 'bg-white border-emerald-200/90 text-zinc-800 shadow-md shadow-emerald-500/5' 
                      : 'bg-slate-900/40 border-slate-850/70 text-white shadow-md shadow-emerald-950/5'
                  }`}
                >
                  {/* Micro Ambient Details */}
                  <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 animate-pulse duration-4000 ${
                    isLightTheme ? 'bg-emerald-500/5' : 'bg-white/5'
                  }`} />
                  <div className={`absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl -ml-10 -mb-10 ${
                    isLightTheme ? 'bg-emerald-500/5' : 'bg-white/5'
                  }`} />

                  <div className="flex justify-between items-start select-none">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${
                          isLightTheme ? 'text-zinc-500' : 'text-zinc-400'
                        }`}>Total Amount Traded</span>
                        <button
                          onClick={() => setIsEarnBalanceBlurred(!isEarnBalanceBlurred)}
                          className={`p-1 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center shrink-0 ${
                            isLightTheme ? 'hover:bg-amber-500/10 text-zinc-500 hover:text-zinc-700' : 'hover:bg-white/10 text-white/80 hover:text-white'
                          }`}
                          title={isEarnBalanceBlurred ? "Reveal trading data" : "Hide trading data"}
                        >
                          {isEarnBalanceBlurred ? <EyeOff size={13} strokeWidth={2.5} /> : <Eye size={13} strokeWidth={2.5} />}
                        </button>
                      </div>
                      <h2 className={`text-3xl font-black tracking-tight font-mono mt-1 transition-all duration-300 ${
                        isEarnBalanceBlurred ? 'filter blur-md select-none pointer-events-none' : ''
                      } ${isLightTheme ? 'text-amber-900' : 'text-zinc-100'}`}>
                        $ {totalInvestedUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </h2>
                      <div className={`flex items-center gap-1.5 mt-2 transition-all duration-300 ${
                        isEarnBalanceBlurred ? 'filter blur-md select-none pointer-events-none' : ''
                      }`}>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1 border ${
                          isLightTheme 
                            ? 'bg-amber-100/60 border-amber-200 text-amber-800' 
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        }`}>
                          <Sparkles size={10} className={`animate-spin ${isLightTheme ? 'text-amber-600' : 'text-emerald-300'}`} />
                          {activeInvs.length} Active Trading {activeInvs.length === 1 ? 'Signal' : 'Signals'}
                        </span>
                      </div>
                    </div>

                    {/* Right Column: Daily Profit */}
                    <div className="text-right flex flex-col items-end">
                      <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                        isLightTheme ? 'text-zinc-500' : 'text-zinc-400'
                      }`}>Today's Profit</span>
                      <div className={`flex items-center justify-end gap-1.5 mt-1 transition-all duration-300 ${
                        isEarnBalanceBlurred ? 'filter blur-md select-none pointer-events-none' : ''
                      }`}>
                        <span className={`text-2xl font-black font-mono ${
                          isLightTheme ? 'text-emerald-600' : 'text-emerald-400'
                        }`}>
                          +$ {totalDailyProfitUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <span className={`text-[9px] font-semibold block transition-all duration-300 ${
                        isEarnBalanceBlurred ? 'filter blur-md select-none pointer-events-none' : ''
                      } ${isLightTheme ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Daily Distribution
                      </span>
                      
                      <button 
                        onClick={() => setEarnDisplayMode(earnDisplayMode === 'USD' ? 'CRYPTO' : 'USD')}
                        className={`mt-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all cursor-pointer text-[10px] font-bold select-none ${
                          isEarnBalanceBlurred ? 'filter blur-md select-none pointer-events-none' : ''
                        } ${
                          isLightTheme 
                            ? 'bg-amber-100/80 border-amber-200 hover:bg-amber-100 text-amber-800' 
                            : 'bg-white/10 hover:bg-white/15 border-white/10 text-white'
                        }`}
                      >
                        <TrendingUp size={11} className={isLightTheme ? 'text-amber-600' : 'text-teal-200'} />
                        <span>{earnDisplayMode === 'USD' ? 'Show Coins' : 'Show USD'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Interactive Expanded Coin Breakdown Drawer inside the Card */}
                  {earnDisplayMode === 'CRYPTO' && activeInvs.length > 0 && (
                    <div className={`mt-4 pt-3 border-t space-y-2 animate-fade-in select-none ${
                      isLightTheme ? 'border-amber-200' : 'border-slate-800'
                    }`}>
                      <span className={`text-[9px] font-black uppercase tracking-wider block mb-1 ${
                        isLightTheme ? 'text-amber-800' : 'text-teal-300'
                      }`}>Your Portfolio Breakdown</span>
                      <div className="grid grid-cols-2 gap-2 max-h-[100px] overflow-y-auto pr-1">
                        {cryptoPrices.map(coin => {
                          const coinInvs = activeInvs.filter((inv: any) => inv.coinSymbol === coin.symbol);
                          if (coinInvs.length === 0) return null;
                          const coinSum = coinInvs.reduce((sum: number, inv: any) => sum + inv.amount, 0);
                          const coinDailyProfitSum = coinInvs.reduce((sum: number, inv: any) => sum + (inv.amount * (inv.dailyRate / 100)), 0);
                          return (
                            <div 
                              key={coin.symbol} 
                              className={`p-2 rounded-xl border flex justify-between items-center font-mono ${
                                isLightTheme 
                                  ? 'bg-amber-50/50 border-amber-200/50' 
                                  : 'bg-black/20 border-white/5'
                              }`}
                            >
                              <div>
                                <span className={`text-[10px] font-black ${isLightTheme ? 'text-zinc-800' : 'text-white'}`}>{coin.symbol}</span>
                                <span className={`text-[9px] block ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>{coinSum.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">+{coinDailyProfitSum.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                                <span className={`text-[8px] block ${isLightTheme ? 'text-zinc-400' : 'text-zinc-500'}`}>/day</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

              {/* trading signals mode */}
              <div className={`border rounded-3xl p-5 space-y-5 animate-fade-in ${
                isLightTheme ? 'bg-white border-zinc-200/80 shadow-xs' : 'bg-slate-800 border-slate-700/80'
              }`}>
                {mmfSubView === 'main' && (
                  <div className="space-y-5">
                    <div>
                      <h3 className={`text-sm font-black tracking-tight flex items-center gap-1.5 ${isLightTheme ? 'text-zinc-800' : 'text-zinc-300'}`}>
                        <Coins size={16} className={isLightTheme ? 'text-amber-500' : 'text-emerald-400'} />
                        VERIFIED TRADING SIGNALS
                      </h3>
                      <p className={`text-[11px] mt-0.5 ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>Copy verified trading signals from experienced professionals with great win ratio</p>
                    </div>



                    {/* Coins Cards List - Single Column Layout (Blueprint Design) */}
                    <div className="flex flex-col gap-3">
                      {cryptoPrices.map(coin => {
                        const userHolding = getCoinHolding(coin.symbol);
                        const locked = getLockedAmount(coin.symbol);
                        const unlocked = Math.max(0, userHolding - locked);
                        const dailyRate = coin.investmentRate ?? 5.0;
                        const winRate = coin.winRate ?? 96.0;

                        return (
                          <div 
                            key={coin.symbol}
                            onClick={() => {
                              setSelectedCoinForInvestment(coin);
                              setInvestmentAmount('');
                              setMmfSubView('form');
                              setInvestmentError(null);
                              setInvestmentSuccess(null);
                            }}
                            className={`border p-3 sm:p-4 rounded-2xl flex items-center justify-between gap-2 sm:gap-4 transition-all duration-300 group hover:shadow-md cursor-pointer active:scale-[0.99] relative overflow-hidden ${
                              isLightTheme 
                                ? 'bg-white border-emerald-200/90 hover:border-emerald-400 hover:shadow-emerald-500/10' 
                                : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900/90 hover:border-emerald-500/30'
                            }`}
                          >
                            {/* Subtle top hover accent line */}
                            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#008B47] via-[#00A653] to-[#80D824] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            {/* Left Side: Circular Logo + (Coin Name / Symbol stacked above Badges) */}
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                              {/* Circular Logo */}
                              <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full border flex items-center justify-center p-1 sm:p-1.5 shadow-xs shrink-0 ${
                                isLightTheme ? 'bg-white border-emerald-200' : 'bg-slate-950 border-slate-800'
                              }`}>
                                <img 
                                  src={getCoinLogoUrl(coin.symbol)} 
                                  alt={coin.name} 
                                  className="w-full h-full object-contain rounded-full"
                                  referrerPolicy="no-referrer"
                                />
                              </div>

                              {/* Coin Name & Badges stacked vertically */}
                              <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className={`font-black text-xs sm:text-base tracking-tight truncate ${isLightTheme ? 'text-zinc-900' : 'text-zinc-100'}`}>
                                    {coin.name}
                                  </span>
                                  <span className={`text-[9px] sm:text-[10px] font-bold font-mono shrink-0 ${isLightTheme ? 'text-amber-900/60' : 'text-zinc-400'}`}>
                                    {coin.symbol}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md font-black text-[9px] sm:text-[10px] font-mono tracking-wide whitespace-nowrap ${
                                    isLightTheme 
                                      ? 'bg-emerald-100/90 text-emerald-800 border border-emerald-300/60' 
                                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                  }`}>
                                    {dailyRate}% daily profit
                                  </span>
                                  <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md font-black text-[9px] sm:text-[10px] font-mono tracking-wide whitespace-nowrap ${
                                    isLightTheme 
                                      ? 'bg-teal-100/90 text-teal-900 border border-teal-300/60' 
                                      : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                  }`}>
                                    <Sparkles size={10} className={isLightTheme ? 'text-teal-700' : 'text-teal-300'} />
                                    {winRate}% Win Ratio
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right Side: Available balance (top right) & TRADE button (bottom right) */}
                            <div className="flex flex-col items-end gap-1 sm:gap-1.5 text-right shrink-0">
                              <div>
                                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-tight sm:tracking-wider block whitespace-nowrap ${
                                  isLightTheme ? 'text-amber-900/60' : 'text-zinc-400'
                                }`}>
                                  Available balance
                                </span>
                                <span className={`text-xs sm:text-sm font-black font-mono tracking-tight block whitespace-nowrap ${
                                  isLightTheme ? 'text-zinc-900' : 'text-zinc-100'
                                }`}>
                                  {unlocked.toFixed(4)} <span className={`text-[9px] sm:text-[10px] font-bold ${isLightTheme ? 'text-amber-800/80' : 'text-zinc-400'}`}>{coin.symbol}</span>
                                </span>
                                {locked > 0 && (
                                  <span className={`inline-flex items-center gap-1 mt-0.5 text-[8px] sm:text-[9px] font-extrabold block whitespace-nowrap ${
                                    isLightTheme ? 'text-amber-800/90' : 'text-amber-400'
                                  }`}>
                                    ({locked.toFixed(2)} {coin.symbol} Traded)
                                  </span>
                                )}
                              </div>

                              {/* TRADE Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCoinForInvestment(coin);
                                  setInvestmentAmount('');
                                  setMmfSubView('form');
                                  setInvestmentError(null);
                                  setInvestmentSuccess(null);
                                }}
                                className={`px-3.5 sm:px-5 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-md active:scale-95 transition-all cursor-pointer text-center whitespace-nowrap ${
                                  isLightTheme 
                                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white shadow-amber-500/20' 
                                    : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 shadow-emerald-500/20'
                                }`}
                              >
                                TRADE
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Display Active/Completed Signal Trades */}
                    {activeInvestments.length > 0 && (
                      <div className={`space-y-3 pt-4 border-t ${isLightTheme ? 'border-zinc-200/60' : 'border-slate-850'}`}>
                        <div className="flex justify-between items-center select-none">
                          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                            <History size={12} className="text-zinc-400" />
                            Verified Signal History
                          </h4>
                        </div>
                        <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                          {activeInvestments.map((inv: any) => {
                            const createdDate = inv.createdAt?.toDate ? inv.createdAt.toDate().toLocaleDateString() : new Date(inv.createdAt).toLocaleDateString();
                            const unlockDate = inv.unlockAt?.toDate ? inv.unlockAt.toDate().toLocaleDateString() : new Date(inv.unlockAt).toLocaleDateString();
                            const isCompleted = inv.status === 'completed';
                            const progressPercentage = Math.min(100, (((inv.daysPaid ?? 0) / (inv.totalDays ?? 24)) * 100));
                            const dailyEarning = inv.amount * (inv.dailyRate / 100);
                            const totalEarned = (inv.daysPaid ?? 0) * dailyEarning;
                            const targetYield = dailyEarning * (inv.totalDays ?? 24);

                            return (
                              <div 
                                key={inv.id} 
                                className={`group p-4 sm:p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden select-none ${
                                  isCompleted 
                                    ? isLightTheme
                                      ? 'bg-zinc-50/70 border-zinc-200/80 hover:border-zinc-300'
                                      : 'bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-800' 
                                    : isLightTheme
                                      ? 'bg-white border-amber-300/80 shadow-[0_4px_20px_rgba(245,158,11,0.06)] hover:border-amber-400'
                                      : 'bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border-teal-500/20 hover:border-teal-500/40 hover:shadow-lg hover:shadow-teal-950/20'
                                }`}
                              >
                                {/* Active subtle glowing indicator bar on left side */}
                                <div className={`absolute top-0 left-0 w-1.5 h-full ${
                                  isCompleted 
                                    ? (isLightTheme ? 'bg-zinc-300' : 'bg-zinc-700')
                                    : 'bg-gradient-to-b from-emerald-400 via-teal-500 to-emerald-600'
                                }`} />

                                <div className="space-y-3 pl-1 sm:pl-1.5">
                                  {/* Top Row: Coin Logo & Amount + Badges */}
                                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2.5">
                                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center p-1.5 shrink-0 border ${
                                        isLightTheme 
                                          ? 'bg-zinc-100/90 border-zinc-200/80 shadow-2xs' 
                                          : 'bg-zinc-800/80 border-zinc-700/80 shadow-2xs'
                                      }`}>
                                        <img 
                                          src={getCoinLogoUrl(inv.coinSymbol)} 
                                          alt={inv.coinSymbol} 
                                          className="w-full h-full object-contain"
                                          onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <span className={`font-black text-sm sm:text-base tracking-tight font-mono ${isLightTheme ? 'text-zinc-900' : 'text-zinc-100'}`}>
                                            {inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                                          </span>
                                          <span className="text-xs font-black text-zinc-500">{inv.coinSymbol}</span>
                                        </div>
                                        <span className={`text-[10px] font-semibold block ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                          Start: {createdDate} • End: {unlockDate}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-md font-black font-mono tracking-wide border shadow-2xs ${
                                        isLightTheme 
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                          : 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300'
                                      }`}>
                                        {inv.dailyRate}% Daily Profit
                                      </span>
                                      {isCompleted ? (
                                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                          isLightTheme 
                                            ? 'bg-zinc-100 text-zinc-500 border-zinc-200' 
                                            : 'bg-zinc-800/50 text-zinc-400 border-zinc-800'
                                        }`}>
                                          Completed
                                        </span>
                                      ) : (
                                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1.5 border shadow-2xs ${
                                          isLightTheme 
                                            ? 'bg-teal-50 text-teal-800 border-teal-200' 
                                            : 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                                        }`}>
                                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                                          Active Signal
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Middle Row: Earnings Breakdown Box */}
                                  <div className={`p-2.5 sm:p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs font-mono ${
                                    isLightTheme 
                                      ? 'bg-zinc-50/90 border-zinc-200/80' 
                                      : 'bg-zinc-950/60 border-zinc-800/80'
                                  }`}>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Daily Profit:</span>
                                      <span className={`font-bold ${isLightTheme ? 'text-zinc-800' : 'text-zinc-200'}`}>
                                        +{dailyEarning.toFixed(4)} {inv.coinSymbol}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Est. Total Profit:</span>
                                      <span className={`px-2 py-0.5 rounded-md font-extrabold border ${
                                        isLightTheme 
                                          ? 'bg-amber-100/90 border-amber-300/80 text-amber-900' 
                                          : 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                                      }`}>
                                        +{targetYield.toFixed(4)} {inv.coinSymbol}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Earned:</span>
                                      <span className={`px-2 py-0.5 rounded-md font-extrabold border ${
                                        isLightTheme 
                                          ? 'bg-emerald-100/90 border-emerald-300/80 text-emerald-900' 
                                          : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                                      }`}>
                                        +{totalEarned.toFixed(4)} {inv.coinSymbol}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Bottom Row: Duration Progress Bar */}
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between items-center text-[10px] font-bold select-none font-mono">
                                      <span className={isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}>Signal Duration Progress (Mon–Fri)</span>
                                      <span className={isLightTheme ? 'text-zinc-800' : 'text-zinc-200'}>{inv.daysPaid ?? 0} / {inv.totalDays ?? 24} Days ({Math.round(progressPercentage)}%)</span>
                                    </div>
                                    <div className={`w-full h-2 rounded-full overflow-hidden p-[1px] border ${
                                      isLightTheme ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-950 border-zinc-800'
                                    }`}>
                                      <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                          isCompleted 
                                            ? 'bg-zinc-400' 
                                            : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                        }`}
                                        style={{ width: `${progressPercentage}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {mmfSubView === 'form' && selectedCoinForInvestment && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMmfSubView('main')}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer border ${
                          isLightTheme 
                            ? 'bg-amber-100/80 hover:bg-amber-200 border-amber-200/50 text-amber-800 hover:text-amber-900' 
                            : 'hover:bg-slate-900 border border-transparent hover:border-slate-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <div>
                        <h4 className={`text-xs font-black uppercase tracking-wider ${
                          isLightTheme ? 'text-zinc-800' : 'text-zinc-300'
                        }`}>Execute Trading Signal</h4>
                        <p className={`text-[10px] mt-0.5 ${
                          isLightTheme ? 'text-zinc-500' : 'text-zinc-500'
                        }`}>Allocate capital to execute verified automated trading signals</p>
                      </div>
                    </div>

                    {/* Chosen Coin Summary Card */}
                    <div className={`p-4 rounded-2xl flex justify-between items-center border ${
                      isLightTheme 
                        ? 'bg-white border-emerald-200/90 shadow-sm' 
                        : 'bg-slate-950/60 border-slate-850'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center p-1.5 border ${
                          isLightTheme ? 'bg-[#EBF9F0] border-emerald-200/80' : 'bg-slate-900 border-slate-850'
                        }`}>
                          <img 
                            src={getCoinLogoUrl(selectedCoinForInvestment.symbol)} 
                            alt={selectedCoinForInvestment.name} 
                            className="w-full h-full object-contain rounded-full"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <span className={`font-bold text-xs block ${
                            isLightTheme ? 'text-zinc-800' : 'text-zinc-200'
                          }`}>{selectedCoinForInvestment.name} Trading Signal</span>
                          <span className={`text-[10px] font-extrabold block mt-0.5 ${
                            isLightTheme ? 'text-[#008B47]' : 'text-emerald-400'
                          }`}>
                            Rate: {selectedCoinForInvestment.investmentRate ?? 5.0}% daily profit
                          </span>
                          <span className={`text-[9px] font-bold block mt-1 ${
                            isLightTheme ? 'text-zinc-500' : 'text-teal-400'
                          }`}>
                            Minimum Trade Amount: {selectedCoinForInvestment.minInvestment ?? 10.0} {selectedCoinForInvestment.symbol}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[9px] font-black uppercase tracking-wider block ${
                          isLightTheme ? 'text-zinc-400' : 'text-zinc-500'
                        }`}>Available Balance</span>
                        <span className={`text-xs font-black font-mono tracking-tight mt-0.5 block ${
                          isLightTheme ? 'text-zinc-900' : 'text-zinc-200'
                        }`}>
                          {(getCoinHolding(selectedCoinForInvestment.symbol) - getLockedAmount(selectedCoinForInvestment.symbol)).toFixed(4)} <span className={`text-[9px] font-extrabold ${isLightTheme ? 'text-[#008B47]' : 'text-zinc-400'}`}>{selectedCoinForInvestment.symbol}</span>
                        </span>
                      </div>
                    </div>

                    {/* Form Controls */}
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Trade Amount</label>
                        <div className="relative">
                          <input
                            id="investment-amount-input"
                            type="number"
                            placeholder="e.g. 50"
                            value={investmentAmount}
                            onChange={(e) => {
                                setInvestmentAmount(e.target.value);
                                setInvestmentError(null);
                                setInvestmentSuccess(null);
                            }}
                            className={`w-full p-3 border rounded-xl text-xs focus:outline-none font-mono ${
                              isLightTheme 
                                ? 'bg-white border-emerald-200 focus:border-[#008B47] text-zinc-800 placeholder-zinc-400' 
                                : 'bg-slate-950 border-slate-800 focus:border-emerald-500 text-white'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const maxVal = Math.max(0, getCoinHolding(selectedCoinForInvestment.symbol) - getLockedAmount(selectedCoinForInvestment.symbol));
                              setInvestmentAmount(maxVal.toString());
                            }}
                            className={`absolute right-2.5 top-2 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg cursor-pointer ${
                              isLightTheme 
                                ? 'text-[#008B47] bg-emerald-50 border border-emerald-200 hover:bg-emerald-100' 
                                : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20'
                            }`}
                          >
                            MAX
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Signal Duration (Days)</label>
                        <input
                          id="investment-days-input"
                          type="number"
                          min="24"
                          placeholder="Minimum 24 days"
                          value={investmentDays}
                          onChange={(e) => {
                            setInvestmentDays(e.target.value);
                            setInvestmentError(null);
                            setInvestmentSuccess(null);
                          }}
                          className={`w-full p-3 border rounded-xl text-xs focus:outline-none font-mono ${
                            isLightTheme 
                              ? 'bg-white border-emerald-200 focus:border-[#008B47] text-zinc-800 placeholder-zinc-400' 
                              : 'bg-slate-950 border-slate-800 focus:border-emerald-500 text-white'
                          }`}
                        />
                        <p className={`text-[9px] ${isLightTheme ? 'text-zinc-600' : 'text-zinc-500'}`}>Minimum duration is 24 trading days. Daily signal profits accrue on weekdays (Mon–Fri) instantly to your account balance.</p>
                      </div>

                      {/* Profit preview calculator */}
                      {parseFloat(investmentAmount) > 0 && (
                        <div className={`border p-3 rounded-xl flex flex-col gap-2 select-none ${
                          isLightTheme 
                            ? 'bg-white border-emerald-200/80 shadow-sm' 
                            : 'bg-slate-950/40 border-slate-850'
                        }`}>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-zinc-500 font-bold uppercase tracking-wider">DAILY PROFIT</span>
                            <span className={`font-bold font-mono ${isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400'}`}>
                              +{(parseFloat(investmentAmount) * ((selectedCoinForInvestment.investmentRate ?? 5.0) / 100)).toFixed(4)} {selectedCoinForInvestment.symbol}
                            </span>
                          </div>
                          <div className={`flex justify-between items-center text-[10px] border-t pt-2 ${
                            isLightTheme ? 'border-amber-200/60' : 'border-slate-850/60'
                          }`}>
                            <span className="text-zinc-500 font-bold uppercase tracking-wider">TOTAL {parseInt(investmentDays) || 24} DAYS PROFIT</span>
                            <span className={`font-bold font-mono ${isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400'}`}>
                              +{(parseFloat(investmentAmount) * ((selectedCoinForInvestment.investmentRate ?? 5.0) / 100) * (parseInt(investmentDays) || 24)).toFixed(4)} {selectedCoinForInvestment.symbol}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Feedback messages */}
                      {investmentError && (
                        <div className={`p-3.5 border rounded-xl text-xs flex flex-col gap-2 ${
                          isLightTheme ? 'bg-red-50 border-red-200 text-red-800' : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                          <div className="flex gap-2">
                            <AlertCircle size={15} className="shrink-0 mt-0.5" />
                            <span>{investmentError}</span>
                          </div>
                          {investmentError.includes("deposit") && (
                            <button
                              type="button"
                              onClick={() => {
                                const sym = selectedCoinForInvestment?.symbol;
                                if (sym) {
                                  sessionStorage.setItem('preselected_deposit_coin', sym);
                                  localStorage.setItem('preselected_deposit_coin', sym);
                                }
                                onOpenDeposit(sym);
                              }}
                              className={`mt-1 w-full py-1.5 border text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer ${
                                isLightTheme 
                                  ? 'bg-amber-550/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-850' 
                                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-200'
                              }`}
                            >
                              Go to Deposit Page
                            </button>
                          )}
                        </div>
                      )}

                      {/* Trade Submit button */}
                      <button
                        type="button"
                        disabled={investmentLoading || !investmentAmount || parseFloat(investmentAmount) <= 0}
                        onClick={handleInitiateInvestment}
                        className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider active:scale-[0.985] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5 cursor-pointer ${
                          isLightTheme 
                            ? 'bg-gradient-to-tr from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white shadow-md shadow-amber-500/10' 
                            : 'bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/10'
                        }`}
                      >
                        {investmentLoading ? (
                          <>
                            <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${isLightTheme ? 'border-white' : 'border-slate-950'}`}></div>
                            <span>Executing Signal...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={14} />
                            <span>Execute Signal Trade</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>)}
              </div>
            </div>
          )} {/* copy-trading-view-end */}

          {/* TAB 5: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-fade-in">
              <ActivityLog userId={user.uid} isLightTheme={isLightTheme} />
            </div>
          )}
            </>
          )}
        </>
      )}
        </main>
      )}

      {/* STICKY BOTTOM NAVIGATION */}
      {!isHideFooter && (
        <footer className={`fixed bottom-0 left-0 right-0 z-30 px-4 py-2 flex justify-around max-w-md mx-auto border-t ${
          isLightTheme 
            ? 'bg-[#EBF9F0]/95 border-emerald-200/80 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] backdrop-blur-md' 
            : 'bg-slate-900 border-slate-800/80'
        }`}>
          {([
            { id: 'home', label: 'Home', icon: Coins },
            { id: 'wallet', label: 'Wallet', icon: Wallet },
            { id: 'trade', label: 'Bot', icon: Bot },
            { id: 'earn', label: 'Copy Trading', icon: Users },
            { id: 'history', label: 'History', icon: History }
          ] as const).map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-btn-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
                className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                  isSelected 
                    ? (isLightTheme ? 'text-amber-700 bg-amber-500/10 font-black' : 'text-amber-400 bg-amber-500/10 font-black') 
                    : (isLightTheme ? 'text-zinc-700 hover:text-zinc-950' : 'text-white hover:text-zinc-300')
                }`}
              >
                <Icon size={18} className={isSelected ? 'scale-110 transition-transform' : ''} />
                <span className="text-[10px] font-bold tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </footer>
      )}

      {/* Draggable Floating Support Icon (Visible on Home & Wallet tabs) */}
      {(activeTab === 'home' || activeTab === 'wallet') && !isHideFooter && (
        <motion.div
          id="draggable-floating-support"
          drag
          dragMomentum={false}
          dragElastic={0.12}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onDragStart={() => {
            dragStartTimeRef.current = Date.now();
            setIsDraggingSupport(true);
          }}
          onDragEnd={() => {
            setTimeout(() => {
              setIsDraggingSupport(false);
            }, 200);
          }}
          className="fixed bottom-20 right-4 z-40 touch-none select-none cursor-grab active:cursor-grabbing"
        >
          <a
            id="floating-support-telegram-btn"
            href="https://t.me/Morexsuppor"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (isDraggingSupport || (dragStartTimeRef.current > 0 && Date.now() - dragStartTimeRef.current < 250)) {
                e.preventDefault();
              }
            }}
            className="relative flex items-center justify-center w-13 h-13 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 text-zinc-950 shadow-xl shadow-amber-500/40 border-2 border-white focus:outline-none group active:shadow-inner"
            title="24/7 Support (@Morexsuppor)"
            aria-label="Open 24/7 Customer Support"
          >
            {/* Live Online Status Dot */}
            <span className="absolute top-0 right-0 flex h-3.5 w-3.5 -mt-0.5 -mr-0.5 pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
            </span>

            {/* Support Headset Icon */}
            <Headphones size={22} className="text-zinc-950 group-hover:scale-110 transition-transform" />

            {/* Tooltip on Desktop Hover */}
            <div className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-zinc-900/90 backdrop-blur-sm text-white text-[11px] font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md hidden sm:flex items-center gap-1.5 border border-zinc-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>Customer Support</span>
            </div>
          </a>
        </motion.div>
      )}



      {/* Transfer In / Transfer Out Modal for Trade Balance */}
      {transferModalType && (
        <div id="trade-balance-transfer-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-fade-in">
          <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-5 relative overflow-hidden animate-scale-up ${
            isLightTheme ? 'bg-white border-zinc-200 text-zinc-900 shadow-slate-900/10' : 'bg-slate-900 border-slate-800 text-white shadow-black/50'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-start justify-between gap-3 pb-3.5 border-b ${
              isLightTheme ? 'border-zinc-100' : 'border-slate-800'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl shrink-0 font-black shadow-sm ${
                  transferModalType === 'IN' 
                    ? 'bg-slate-950 text-white border border-slate-800' 
                    : 'bg-amber-500 text-slate-950 border border-amber-400'
                }`}>
                  {transferModalType === 'IN' ? <ArrowDownLeft size={22} strokeWidth={2.8} /> : <ArrowUpRight size={22} strokeWidth={2.8} />}
                </div>
                <div>
                  <h3 className={`font-extrabold text-base sm:text-lg tracking-tight leading-tight ${
                    isLightTheme ? 'text-zinc-900' : 'text-white'
                  }`}>
                    {transferModalType === 'IN' ? 'Transfer In to Copy Trade' : 'Transfer Out to Wallet'}
                  </h3>
                  <p className={`text-xs font-medium mt-0.5 ${
                    isLightTheme ? 'text-zinc-500' : 'text-zinc-400'
                  }`}>
                    {transferModalType === 'IN' 
                      ? 'Move funds from your Wallet into Copy Trade Balance' 
                      : 'Move funds from Copy Trade Balance back to your Wallet'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTransferModalType(null)}
                className={`p-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                  isLightTheme 
                    ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600' 
                    : 'bg-slate-800 hover:bg-slate-700 text-zinc-300'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Account Balances Summary Card */}
            <div className={`p-4 rounded-2xl border space-y-3 text-xs ${
              isLightTheme ? 'bg-amber-500/5 border-amber-200/80' : 'bg-slate-950/80 border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}`}>Wallet Balance:</span>
                <span className={`font-extrabold font-mono text-sm ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                  ${getWalletBalance(profile).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className={`text-[10px] font-medium ${isLightTheme ? 'text-zinc-400' : 'text-zinc-500'}`}>USD</span>
                </span>
              </div>
              <div className={`flex items-center justify-between border-t pt-2.5 ${
                isLightTheme ? 'border-amber-200/60' : 'border-slate-800'
              }`}>
                <span className={`font-semibold ${isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}`}>Copy Trade Balance:</span>
                <span className={`font-extrabold font-mono text-sm ${isLightTheme ? 'text-amber-700' : 'text-amber-400'}`}>
                  ${(profile?.tradeBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className={`text-[10px] font-medium ${isLightTheme ? 'text-amber-700/70' : 'text-amber-400/70'}`}>USD</span>
                </span>
              </div>
              {transferModalType === 'OUT' && (() => {
                const { freeTransferrable } = getCopyTradeLockedAndFree();
                return (
                  <div className={`flex items-center justify-between border-t pt-2.5 ${
                    isLightTheme ? 'border-amber-200/60' : 'border-slate-800'
                  }`}>
                    <span className={`font-bold flex items-center gap-1.5 ${isLightTheme ? 'text-emerald-800' : 'text-emerald-400'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      Free to Transfer Out:
                    </span>
                    <span className={`font-extrabold font-mono text-sm ${isLightTheme ? 'text-emerald-800' : 'text-emerald-400'}`}>
                      ${freeTransferrable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Input Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={`text-xs font-extrabold uppercase tracking-wider ${
                  isLightTheme ? 'text-zinc-600' : 'text-zinc-400'
                }`}>
                  Transfer Amount
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const { freeTransferrable } = getCopyTradeLockedAndFree();
                    const maxVal = transferModalType === 'IN' 
                      ? getWalletBalance(profile)
                      : freeTransferrable;
                    setTransferAmountInput(maxVal.toString());
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-black uppercase tracking-wider font-mono transition-all cursor-pointer shadow-xs"
                >
                  Use Max
                </button>
              </div>

              <div className={`relative flex items-center border rounded-2xl transition-all px-4 py-3.5 ${
                isLightTheme 
                  ? 'bg-zinc-50 border-zinc-300 focus-within:bg-white focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20' 
                  : 'bg-slate-950 border-slate-800 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20'
              }`}>
                <span className={`text-lg font-black font-mono mr-2 ${isLightTheme ? 'text-zinc-400' : 'text-zinc-500'}`}>$</span>
                <input
                  id="trade-transfer-amount-input"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={transferAmountInput}
                  onChange={(e) => setTransferAmountInput(e.target.value)}
                  className={`w-full bg-transparent font-mono text-xl font-black outline-none ${
                    isLightTheme ? 'text-zinc-900 placeholder:text-zinc-300' : 'text-white placeholder:text-zinc-700'
                  }`}
                />
                <span className={`text-xs font-extrabold uppercase font-mono ml-2 shrink-0 ${isLightTheme ? 'text-zinc-400' : 'text-zinc-500'}`}>USD</span>
              </div>
            </div>

            {/* Preview After Transfer */}
            {parseFloat(transferAmountInput) > 0 && (
              <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                isLightTheme 
                  ? 'bg-amber-50 border-amber-200/90 text-amber-950' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
              }`}>
                <div className="flex justify-between font-mono">
                  <span className="font-sans font-medium">New Wallet Balance:</span>
                  <strong className={`font-extrabold ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                    ${Math.max(0, (profile?.usdtBalance ?? profile?.balance ?? 0) + (transferModalType === 'IN' ? -parseFloat(transferAmountInput) : parseFloat(transferAmountInput))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </strong>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="font-sans font-medium">New Copy Trade Balance:</span>
                  <strong className={`font-extrabold ${isLightTheme ? 'text-amber-700' : 'text-amber-400'}`}>
                    ${Math.max(0, (profile?.tradeBalance ?? 0) + (transferModalType === 'IN' ? parseFloat(transferAmountInput) : -parseFloat(transferAmountInput))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </strong>
                </div>
              </div>
            )}

            {/* Confirm / Cancel Buttons */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setTransferModalType(null)}
                className={`flex-1 py-3.5 rounded-2xl border text-xs font-extrabold uppercase tracking-wider cursor-pointer transition-all ${
                  isLightTheme 
                    ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700' 
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-zinc-300'
                }`}
              >
                Cancel
              </button>
              <button
                id="trade-transfer-confirm-btn"
                type="button"
                disabled={isTransferring || !transferAmountInput || parseFloat(transferAmountInput) <= 0}
                onClick={transferModalType === 'IN' ? handleConfirmTransferIn : handleConfirmTransferOut}
                className={`flex-1 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  !transferAmountInput || parseFloat(transferAmountInput) <= 0
                    ? isLightTheme 
                      ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed border border-zinc-200' 
                      : 'bg-slate-800 text-zinc-500 cursor-not-allowed border border-slate-700'
                    : transferModalType === 'IN'
                      ? 'bg-slate-950 hover:bg-slate-900 text-white shadow-lg shadow-slate-950/20 border border-slate-800 cursor-pointer active:scale-95'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 border border-amber-400 cursor-pointer active:scale-95'
                }`}
              >
                {isTransferring ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <span>Confirm {transferModalType === 'IN' ? 'Transfer In' : 'Transfer Out'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Contract Detail - Styled as a responsive, premium full-page view */}
      {selectedContractForDetail && (() => {
        const activeContracts = getMergedActiveContracts(userCopyTrades);
        const currentLeadKey = selectedContractForDetail.leadId || selectedContractForDetail.leadName || selectedContractForDetail.id;

        const freshTrade = activeContracts.find(t => (t.leadId || t.leadName || t.id) === currentLeadKey);
        const trade = freshTrade || selectedContractForDetail;

        const contract = getContractProgressDetails(trade);
        const tradeCapital = trade.contractCapital || trade.amount || 0;
        const netProfit = trade.netProfit || 0;
        const grossProfit = trade.grossProfit !== undefined ? trade.grossProfit : netProfit;
        const commissionDeducted = trade.commissionDeducted !== undefined ? trade.commissionDeducted : 0;
        const lead = copyLeads.find(l => (trade.leadId && l.id === trade.leadId) || (trade.leadName && l.name?.toLowerCase() === trade.leadName?.toLowerCase()))
          || DEFAULT_COPY_LEADS.find(l => (trade.leadId && l.id === trade.leadId) || (trade.leadName && l.name?.toLowerCase() === trade.leadName?.toLowerCase()));

        const currentMinCap = Number(lead?.minCapital ?? 0);
        const currentProfitRate = Number(lead?.dayProfitRate ?? 0);

        // Filter ONLY higher tier experts (strictly higher min capital, or higher daily yield if min capital is equal)
        const higherLeads = copyLeads
          .filter(l => {
            const isSameLead = (lead && l.id === lead.id) 
              || (l.name && trade.leadName && l.name.toLowerCase() === trade.leadName.toLowerCase()) 
              || (trade.leadId && l.id === trade.leadId);
            if (isSameLead) return false;

            const lMinCap = Number(l.minCapital ?? 0);
            const lProfit = Number(l.dayProfitRate ?? 0);

            return lMinCap > currentMinCap || (lMinCap === currentMinCap && lProfit > currentProfitRate);
          })
          .sort((a, b) => (Number(a.minCapital ?? 0) - Number(b.minCapital ?? 0)) || (Number(a.dayProfitRate ?? 0) - Number(b.dayProfitRate ?? 0)));

        return (
          <div className={`fixed inset-0 z-50 overflow-y-auto animate-fade-in ${
            isLightTheme ? 'bg-[#EBF9F0] text-zinc-900' : 'bg-slate-900 text-white'
          }`}>
            {/* Top Navigation Header Bar */}
            <div className={`sticky top-0 z-30 border-b backdrop-blur-md px-4 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-3 ${
              isLightTheme ? 'bg-[#EBF9F0]/95 border-emerald-200/80 shadow-xs' : 'bg-slate-900/95 border-slate-800 shadow-sm'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedContractForDetail(null)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border shrink-0 shadow-2xs ${
                    isLightTheme
                      ? 'bg-white hover:bg-emerald-50 text-[#008B47] border-emerald-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-zinc-200 border-slate-700'
                  }`}
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <div className="min-w-0">
                  <h2 className={`text-sm sm:text-base font-black truncate ${isLightTheme ? 'text-zinc-950' : 'text-white'}`}>
                    Contract Details
                  </h2>
                </div>
              </div>

              {/* Status Badge & Close */}
              <div className="flex items-center gap-2 shrink-0">
                {contract.isUnlocked ? (
                  <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-xl border flex items-center gap-1 shadow-2xs ${
                    isLightTheme 
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300' 
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  }`}>
                    <Unlock size={12} className="shrink-0" /> Unlocked
                  </span>
                ) : (
                  <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-xl border flex items-center gap-1 shadow-2xs ${
                    isLightTheme 
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300' 
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  }`}>
                    <Lock size={12} className="shrink-0 text-emerald-700 dark:text-emerald-400" /> Active ({contract.progressPct}%)
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedContractForDetail(null)}
                  className={`p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer shadow-2xs ${
                    isLightTheme 
                      ? 'bg-white hover:bg-emerald-50 text-[#008B47] border-emerald-300' 
                      : 'bg-slate-800 hover:bg-slate-700 text-zinc-300 border-slate-700'
                  }`}
                  title="Close Page"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Main Content Container */}
            <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-4 pb-24">
              
              {/* Unified Contract Overview Card */}
              <div className={`p-4 sm:p-5 rounded-3xl border shadow-sm space-y-4 ${
                isLightTheme ? 'bg-white border-emerald-200/90' : 'bg-slate-900 border-slate-800'
              }`}>
                {/* Expert Info & Pair */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <ExpertAvatar 
                      photoUrl={trade.leadPhotoUrl} 
                      name={trade.leadName} 
                      className="w-12 h-12 shrink-0" 
                      size={140} 
                      roundedClassName="rounded-full" 
                      borderClassName="border-2 border-[#008B47]" 
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                          isLightTheme 
                            ? 'bg-emerald-100 text-emerald-950 border-emerald-300' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {trade.tradingPair || 'BTC/USDT'}
                        </span>
                        <span className={`text-[9.5px] font-bold font-mono ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          Standard Lead
                        </span>
                      </div>
                      <h1 className={`text-lg font-black tracking-tight mt-0.5 truncate ${isLightTheme ? 'text-zinc-950' : 'text-white'}`}>
                        {trade.leadName}
                      </h1>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-[9.5px] uppercase font-black tracking-wider block ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Yield / Day
                    </span>
                    <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400">
                      {getLeadDailyProfitRange(lead)}
                    </span>
                  </div>
                </div>

                {/* Grid of Key Info: Traded Capital, Accrued Profit, Duration, Target Date */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs pt-1">
                  <div className={`p-3 rounded-2xl border shadow-2xs ${
                    isLightTheme ? 'bg-[#F4FBF6] border-emerald-200/80' : 'bg-slate-950/80 border-slate-800'
                  }`}>
                    <span className={`text-[9px] uppercase font-black tracking-wider block ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Traded Capital
                    </span>
                    <span className={`text-base font-black block mt-1 ${isLightTheme ? 'text-zinc-950' : 'text-white'}`}>
                      ${tradeCapital.toFixed(2)}
                    </span>
                  </div>

                  <div className={`p-3 rounded-2xl border shadow-2xs ${
                    isLightTheme ? 'bg-emerald-50/90 border-emerald-300' : 'bg-emerald-950/30 border-emerald-800/40'
                  }`}>
                    <span className={`text-[9px] uppercase font-black tracking-wider block ${isLightTheme ? 'text-emerald-900' : 'text-emerald-400'}`}>
                      Accrued Profit
                    </span>
                    <span className={`text-base font-black block mt-1 ${isLightTheme ? 'text-emerald-700' : 'text-emerald-400'}`}>
                      +${netProfit.toFixed(2)}
                    </span>
                  </div>

                  <div className={`p-3 rounded-2xl border shadow-2xs ${
                    isLightTheme ? 'bg-[#F4FBF6] border-emerald-200/80' : 'bg-slate-950/80 border-slate-800'
                  }`}>
                    <span className={`text-[9px] uppercase font-black tracking-wider block ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Duration
                    </span>
                    <span className={`text-base font-black block mt-1 ${isLightTheme ? 'text-zinc-950' : 'text-white'}`}>
                      {contract.durationDays} Days
                    </span>
                  </div>

                  <div className={`p-3 rounded-2xl border shadow-2xs ${
                    isLightTheme ? 'bg-[#F4FBF6] border-emerald-200/80' : 'bg-slate-950/80 border-slate-800'
                  }`}>
                    <span className={`text-[9px] uppercase font-black tracking-wider block ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Target Date
                    </span>
                    <span className={`text-xs sm:text-[13px] font-black block mt-1.5 truncate ${isLightTheme ? 'text-zinc-950' : 'text-white'}`}>
                      {contract.targetEndDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Progress Bar & Countdown */}
                <div className={`p-3 sm:p-3.5 rounded-2xl border space-y-2 ${
                  isLightTheme ? 'bg-[#F4FBF6]/70 border-emerald-200/70' : 'bg-slate-950/50 border-slate-800'
                }`}>
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className={`font-bold flex items-center gap-1.5 ${isLightTheme ? 'text-zinc-800' : 'text-zinc-300'}`}>
                      <Clock size={13} className="text-[#008B47] shrink-0" />
                      <span>Progress: <strong>{contract.workdaysElapsed} of {contract.durationDays} Days</strong></span>
                    </span>
                    <span className="font-black text-emerald-700 dark:text-emerald-400">
                      {contract.progressPct}%
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-emerald-100 dark:bg-zinc-800 overflow-hidden relative shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-[#008B47] via-[#00A653] to-[#80D824] rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(contract.progressPct, 1)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className={isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}>
                      {contract.isUnlocked ? 'Contract Complete' : `${contract.workdaysRemaining} workdays remaining`}
                    </span>
                    <span className={`font-bold ${isLightTheme ? 'text-[#008B47]' : 'text-emerald-300'}`}>
                      Release: 100% Principal
                    </span>
                  </div>
                </div>
              </div>

              {/* Executed Signals Log */}
              <div className={`p-4 sm:p-5 rounded-3xl border space-y-3.5 shadow-sm ${
                isLightTheme ? 'bg-white border-emerald-200/90' : 'bg-slate-900 border-slate-800'
              }`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className={`text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 ${
                    isLightTheme ? 'text-zinc-950' : 'text-white'
                  }`}>
                    <History size={16} className="text-[#008B47] shrink-0" />
                    <span>Execution Logs ({Array.isArray(trade.executedSignals) ? trade.executedSignals.length : 0})</span>
                  </h3>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                    isLightTheme 
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300' 
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    Settle Ledger
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-0.5">
                  {Array.isArray(trade.executedSignals) && trade.executedSignals.length > 0 ? (
                    [...trade.executedSignals].reverse().map((sig: any, idx: number) => {
                      const execTimeFormatted = sig.executedAt 
                        ? new Date(sig.executedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : 'Settled';
                      const pair = sig.tradingPair || trade.tradingPair || 'BTC/USDT';
                      const tradedAmount = sig.amount || trade.contractCapital || trade.amount || 0;
                      const entryP = sig.entryPrice || '67,240.00';
                      const exitP = sig.exitPrice || '67,910.00';
                      const netP = sig.netProfit !== undefined ? sig.netProfit : 0;

                      return (
                        <div 
                          key={idx} 
                          className={`p-3.5 rounded-2xl border space-y-2.5 text-xs font-mono transition-all shadow-2xs ${
                            isLightTheme ? 'bg-[#F4FBF6] border-emerald-200/80' : 'bg-slate-950/80 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-black text-[10px] px-2 py-0.5 rounded-md border ${
                                isLightTheme ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}>
                                {sig.code}
                              </span>
                              <span className={`font-black text-[10px] px-2 py-0.5 rounded-md border ${
                                isLightTheme ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}>
                                {pair}
                              </span>
                              <span className={`text-[10.5px] font-medium ${isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                {sig.time || 'Settled'}
                              </span>
                            </div>
                            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-1">
                              <CheckCircle2 size={12} /> Settled
                            </span>
                          </div>

                          {/* Metric breakdown */}
                          <div className={`p-2.5 rounded-xl border grid grid-cols-3 gap-2 text-[10.5px] ${
                            isLightTheme ? 'bg-white border-emerald-200/70 shadow-2xs' : 'bg-slate-900 border-slate-800'
                          }`}>
                            <div>
                              <span className={`text-[9px] uppercase font-black block ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>Capital</span>
                              <span className={`font-black ${isLightTheme ? 'text-zinc-950' : 'text-zinc-200'}`}>
                                ${tradedAmount.toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className={`text-[9px] uppercase font-black block ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>Entry &rarr; Exit</span>
                              <span className="font-bold text-zinc-400">
                                <span className={isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}>${entryP}</span> &rarr; <span className={isLightTheme ? 'text-emerald-700 font-black' : 'text-emerald-400 font-bold'}>${exitP}</span>
                              </span>
                            </div>
                            <div className="text-right">
                              <span className={`text-[9px] uppercase font-black block ${isLightTheme ? 'text-emerald-800' : 'text-emerald-400'}`}>Net Profit</span>
                              <span className="font-black text-emerald-700 dark:text-emerald-400">
                                +${netP.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className={`flex items-center justify-between text-[9.5px] border-t pt-1.5 ${
                            isLightTheme ? 'border-emerald-200/60 text-zinc-600' : 'border-slate-800/60 text-zinc-400'
                          }`}>
                            <span>Settle Timestamp</span>
                            <span className="font-medium">{execTimeFormatted}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className={`p-4 text-center text-xs font-mono rounded-2xl border border-dashed ${
                      isLightTheme ? 'bg-[#F4FBF6]/60 border-emerald-300/60 text-zinc-600' : 'border-slate-800 text-zinc-500'
                    }`}>
                      No executed signal records found yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Upgrade to Higher Tier Expert Action Banner */}
              <div className={`p-4 sm:p-5 rounded-3xl border shadow-sm space-y-3.5 ${
                isLightTheme ? 'bg-white border-emerald-200/90' : 'bg-slate-900 border-slate-800'
              }`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[#008B47] dark:text-emerald-400" />
                    <h3 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${
                      isLightTheme ? 'text-zinc-950' : 'text-white'
                    }`}>
                      Upgrade to Higher Experts
                    </h3>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                    isLightTheme ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  }`}>
                    Zero Penalty Rollover
                  </span>
                </div>

                {/* Key Points */}
                <div className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                  isLightTheme ? 'bg-[#F4FBF6] border-emerald-200/80 text-zinc-700' : 'bg-slate-950/60 border-slate-800 text-zinc-300'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-[11.5px] leading-tight">
                      <strong>100% Principal Rollover:</strong> ${tradeCapital.toFixed(2)} USD locked capital transfers instantly without forfeiture.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-[11.5px] leading-tight">
                      <strong>Instant Activation:</strong> Unlock higher daily profit yields and premium signals immediately.
                    </span>
                  </div>
                </div>

                {/* Display All Higher Experts Grid */}
                {higherLeads.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                    {higherLeads.map(target => (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() => setUpgradeModalData({ oldTrade: trade, targetLead: target })}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md active:scale-[0.99] group ${
                          isLightTheme 
                            ? 'bg-amber-50/70 hover:bg-amber-100/90 border-amber-200 text-zinc-900 shadow-2xs' 
                            : 'bg-slate-950 hover:bg-slate-850 border-slate-800 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ExpertAvatar 
                            photoUrl={target.photoUrl} 
                            name={target.name} 
                            className="w-10 h-10 shrink-0" 
                            size={100} 
                            roundedClassName="rounded-full" 
                            borderClassName="border-2 border-amber-400"
                          />
                          <div className="min-w-0">
                            <p className="font-black text-xs truncate group-hover:text-amber-600 transition-colors">{target.name}</p>
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 mt-0.5">
                              <span className="font-bold text-amber-800 dark:text-amber-300">Min: ${target.minCapital ?? 50}</span>
                              <span>•</span>
                              <span>{target.winRate || '98.5%'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-400 block">
                            {getLeadDailyProfitRange(target)}
                          </span>
                          <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 flex items-center gap-0.5 justify-end">
                            Upgrade &rarr;
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={`p-4 text-center rounded-2xl border text-xs font-medium ${
                    isLightTheme ? 'bg-amber-50/40 border-amber-200 text-amber-950' : 'bg-slate-950/40 border-slate-800 text-amber-300'
                  }`}>
                    🌟 You are currently trading with our top-tier expert lead! Maximum profit rates and premium signals are active on this contract.
                  </div>
                )}
              </div>

              {/* Contract Capital Security Badge Banner */}
              <div className={`p-4 sm:p-4.5 rounded-3xl border text-xs flex items-start gap-3.5 shadow-sm ${
                isLightTheme 
                  ? 'bg-amber-50/90 border-amber-300/80 text-amber-950' 
                  : 'bg-blue-950/40 border-blue-800/50 text-blue-200'
              }`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  isLightTheme ? 'bg-amber-500 text-slate-950 shadow-2xs' : 'bg-blue-500 text-white'
                }`}>
                  <ShieldCheck size={18} strokeWidth={2.5} />
                </div>
                <div className="space-y-1 leading-relaxed text-xs">
                  <p className="font-black text-sm">Contract Capital Security Verified</p>
                  <p className={isLightTheme ? 'text-amber-900 font-medium' : 'opacity-90'}>
                    Your traded principal of <strong>${tradeCapital.toFixed(2)} USD</strong> is securely backed under capital assurance protocols for the full <strong>{contract.durationDays} workday</strong> duration. Accumulated accrued profits of <strong>${netProfit.toFixed(2)} USD</strong> remain unlocked and ready for transfer.
                  </p>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Trade Settlement Receipt Modal Ticket */}
      {settledTradeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className={`w-full max-w-md rounded-3xl border shadow-2xl p-5 sm:p-6 space-y-5 relative my-auto ${
            isLightTheme ? 'bg-white border-emerald-300' : 'bg-slate-900 border-emerald-500/40 text-white'
          }`}>
            {/* Top Settlement Banner */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-emerald-500 shadow-inner animate-bounce-short">
                <CheckCircle2 size={32} strokeWidth={2.5} />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-mono">
                  Official Trade Settlement Slip
                </span>
                <h3 className={`text-xl font-black ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                  Trade Settled & Profit Credited!
                </h3>
                <p className="text-xs text-zinc-500 font-mono">
                  Settled at {settledTradeReceipt.executedAt}
                </p>
              </div>
            </div>

            {/* Trader & Pair Header */}
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
              isLightTheme ? 'bg-zinc-50 border-zinc-200' : 'bg-slate-950/80 border-slate-800'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <ExpertAvatar 
                  photoUrl={settledTradeReceipt.leadPhotoUrl} 
                  name={settledTradeReceipt.leadName} 
                  className="w-10 h-10" 
                  size={120} 
                  roundedClassName="rounded-full" 
                  borderClassName="border-2 border-emerald-500" 
                />
                <div className="min-w-0">
                  <h4 className={`font-black text-sm truncate ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                    {settledTradeReceipt.leadName}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                    <span>Pair: <strong className="text-amber-500 font-bold">{settledTradeReceipt.tradingPair}</strong></span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] font-mono uppercase text-zinc-400 block font-bold">Signal Code</span>
                <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  {settledTradeReceipt.signalCode}
                </span>
              </div>
            </div>

            {/* Financial Payout Slip Card */}
            <div className={`p-4 rounded-2xl border space-y-3 font-mono text-xs ${
              isLightTheme ? 'bg-zinc-50 border-zinc-200' : 'bg-slate-950/90 border-slate-800'
            }`}>
              <div className="flex justify-between items-center text-zinc-500">
                <span>Traded Principal (Locked):</span>
                <span className={`font-bold ${isLightTheme ? 'text-zinc-900' : 'text-zinc-200'}`}>
                  ${settledTradeReceipt.tradedCapital.toFixed(2)} USD
                </span>
              </div>

              <div className="flex justify-between items-center text-zinc-500">
                <span>Gross Return Yield:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  +${settledTradeReceipt.grossProfit.toFixed(2)} USD
                </span>
              </div>

              <div className="flex justify-between items-center text-zinc-500">
                <span>Expert Commission ({settledTradeReceipt.commissionPct}%):</span>
                <span className="font-bold text-rose-500">
                  -${settledTradeReceipt.commissionCut.toFixed(2)} USD
                </span>
              </div>

              <div className="pt-2 border-t border-zinc-200 dark:border-slate-800 flex justify-between items-center text-sm font-black">
                <span className="text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Net Profit Credited:</span>
                <span className="text-base font-black px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  +${settledTradeReceipt.netProfit.toFixed(2)} USD
                </span>
              </div>
            </div>

            {/* Execution Ticket Details */}
            <div className={`p-3 rounded-xl border grid grid-cols-2 gap-2 text-[11px] font-mono ${
              isLightTheme ? 'bg-amber-500/5 border-amber-500/20 text-zinc-700' : 'bg-slate-950/60 border-slate-800 text-zinc-300'
            }`}>
              <div>
                <span className="text-[9px] uppercase font-bold text-zinc-400 block">Entry Execution Price</span>
                <span className="font-bold text-amber-500">${settledTradeReceipt.entryPrice} USDT</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase font-bold text-zinc-400 block">Exit Settlement Price</span>
                <span className="font-bold text-emerald-500">${settledTradeReceipt.exitPrice} USDT</span>
              </div>
            </div>

            {/* Updated Copy Balance Counter Banner */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-mono ${
              isLightTheme ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-emerald-950/30 border-emerald-500/20 text-emerald-200'
            }`}>
              <span className="font-bold">Updated Copy Trade Balance:</span>
              <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                ${settledTradeReceipt.newBalance.toFixed(2)} USD
              </strong>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              {settledTradeReceipt.leadObj && (
                <button
                  type="button"
                  onClick={() => {
                    const matchedTrade = userCopyTrades.find(
                      t => t.leadId === settledTradeReceipt.leadObj?.id || t.leadName === settledTradeReceipt.leadObj?.name
                    );
                    if (matchedTrade) {
                      setSelectedContractForDetail(matchedTrade);
                    }
                    setSettledTradeReceipt(null);
                  }}
                  className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${
                    isLightTheme 
                      ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300' 
                      : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                  }`}
                >
                  View Contract
                </button>
              )}
              <button
                type="button"
                onClick={() => setSettledTradeReceipt(null)}
                className="flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg active:scale-[0.99]"
              >
                Close Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expert Upgrade & Principal Rollover Modal */}
      {upgradeModalData && (
        <UpgradeRolloverModal
          isOpen={true}
          onClose={() => setUpgradeModalData(null)}
          oldContract={upgradeModalData.oldTrade}
          targetLead={upgradeModalData.targetLead}
          availableLeads={copyLeads}
          onSelectTargetLead={(lead) => {
            setUpgradeModalData({
              ...upgradeModalData,
              targetLead: lead
            });
          }}
          freeTradeBalance={getCopyTradeLockedAndFree().freeTransferrable}
          isLightTheme={isLightTheme}
          onConfirmUpgrade={handleConfirmExpertUpgrade}
          isSubmitting={isSubmittingUpgrade}
        />
      )}

      {/* In-App Promotional Ad Popup Modal */}
      {activePopupAd && (
        <InAppAdPopupModal
          ad={activePopupAd}
          onClose={handleCloseAdPopup}
          onAdAction={handleAdAction}
        />
      )}

    </div>
  );
}
