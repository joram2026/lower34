import React, { useState, useEffect, useRef } from 'react';
import { getTradingPairConfig, TradingPairBadge } from '../utils/pairUtils';
import { HourglassProgress } from './HourglassProgress';
import { 
  ArrowLeft, 
  Bot, 
  Pause, 
  Play, 
  Square, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Terminal, 
  CheckCircle2, 
  XCircle, 
  Zap,
  Activity,
  Target,
  Trophy,
  ShieldCheck,
  AlertCircle,
  X,
  History,
  RotateCcw,
  WifiOff
} from 'lucide-react';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { motivationalAudio } from '../utils/motivationalAudio';

interface LogEntry {
  id: string;
  time: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface TradeOutcomeModalData {
  isWin: boolean;
  profitDelta: number;
  profitPercent: number;
  capital: number;
  durationSeconds: number;
  tradingPair: string;
  botName: string;
}

interface RunningBotViewProps {
  bot: any;
  user: any;
  userBalance: number;
  isLightTheme: boolean;
  isOffline?: boolean;
  onBack: () => void;
  onTradeAgain?: (bot: any) => void;
  onGoToHistory?: () => void;
}

export const RunningBotView: React.FC<RunningBotViewProps> = ({
  bot,
  user,
  userBalance,
  isLightTheme,
  isOffline,
  onBack,
  onTradeAgain,
  onGoToHistory
}) => {
  const toast = useToast();
  
  const [browserOffline, setBrowserOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setBrowserOffline(false);
    const handleOffline = () => setBrowserOffline(true);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  const isBotOffline = Boolean(isOffline || browserOffline);
  
  const durationSeconds = bot?.durationSeconds || (bot?.durationMinutes ? Math.round(bot.durationMinutes * 60) : 60);
  const tradingPair = bot?.tradingPair || 'BTC/USDT';
  const botName = bot?.name || 'Trading Bot';
  
  const [remainingSeconds, setRemainingSeconds] = useState<number>(durationSeconds);
  const [status, setStatus] = useState<'RUNNING' | 'PAUSED' | 'STOPPED'>(bot?.status || 'RUNNING');
  const [wins, setWins] = useState<number>(bot?.wins || 0);
  const [losses, setLosses] = useState<number>(bot?.losses || 0);
  const [totalTrades, setTotalTrades] = useState<number>(bot?.totalTrades || 0);
  const [accruedProfit, setAccruedProfit] = useState<number>(bot?.accruedProfit || 0);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [outcomeModal, setOutcomeModal] = useState<TradeOutcomeModalData | null>(null);
  const [showStopConfirmModal, setShowStopConfirmModal] = useState<boolean>(false);

  // Auto-play / Stop High-Energy Motivational Audio when bot is running/paused
  useEffect(() => {
    if (status === 'RUNNING' && !isBotOffline) {
      motivationalAudio.start();
    } else {
      motivationalAudio.stop();
    }

    return () => {
      motivationalAudio.stop();
    };
  }, [status, isBotOffline]);

  const formatTime = () => {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  };

  const [logs, setLogs] = useState<LogEntry[]>(() => [
    {
      id: '1',
      time: formatTime(),
      message: `'${botName}' initialized on ${tradingPair} with $${bot?.capital || 0} capital (${durationSeconds}s cycle).`,
      type: 'info'
    },
    {
      id: '2',
      time: formatTime(),
      message: `Analyzing market depth & technical indicators on ${tradingPair}...`,
      type: 'info'
    }
  ]);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const isExecutingRef = useRef<boolean>(false);

  // Auto-scroll console log
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Main Trade Cycle & Countdown Timer Effect
  useEffect(() => {
    if (isBotOffline || status !== 'RUNNING' || outcomeModal !== null) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // Trade round completed! Trigger execution once outside of state updater
          if (!isExecutingRef.current) {
            isExecutingRef.current = true;
            setTimeout(() => {
              executeTradeRound().finally(() => {
                isExecutingRef.current = false;
              });
            }, 0);
          }
          return durationSeconds;
        }

        // Add periodic analytical logs
        if (prev === Math.floor(durationSeconds * 0.75)) {
          addLog(`Scanning order book depth & RSI momentum on ${tradingPair}...`, 'info');
        } else if (prev === Math.floor(durationSeconds * 0.50)) {
          addLog(`Signal detected: Technical indicator confirmation on ${tradingPair}.`, 'info');
        } else if (prev === Math.floor(durationSeconds * 0.25)) {
          addLog(`Executing smart order placement on liquidity node...`, 'info');
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status, durationSeconds, tradingPair, outcomeModal, isBotOffline]);

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setLogs((prevLogs) => [
      ...prevLogs.slice(-49), // Keep last 50 logs
      {
        id: Math.random().toString(36).substring(2, 9),
        time: formatTime(),
        message,
        type
      }
    ]);
  };

  const parseWinProbability = (val?: string): number => {
    if (!val) return 0.75;
    const clean = val.trim();
    if (clean.includes('-')) {
      const parts = clean.replace(/%/g, '').split('-').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
      if (parts.length >= 2) {
        return Math.max(0.01, Math.min(0.99, ((parts[0] + parts[1]) / 2) / 100));
      } else if (parts.length === 1) {
        return Math.max(0.01, Math.min(0.99, parts[0] / 100));
      }
    }
    const num = parseFloat(clean.replace(/%/g, ''));
    if (!isNaN(num)) {
      return Math.max(0.01, Math.min(0.99, num / 100));
    }
    return 0.75;
  };

  const parseRangeToDecimals = (val?: string, defaultMinPercent = 1.5, defaultMaxPercent = 2.5): { min: number; max: number } => {
    if (!val) return { min: defaultMinPercent / 100, max: defaultMaxPercent / 100 };
    const clean = val.trim().replace(/%/g, '');
    if (clean.includes('-')) {
      const parts = clean.split('-').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
      if (parts.length >= 2) {
        const minVal = Math.min(parts[0], parts[1]);
        const maxVal = Math.max(parts[0], parts[1]);
        return { min: minVal / 100, max: maxVal / 100 };
      } else if (parts.length === 1) {
        return { min: parts[0] / 100, max: parts[0] / 100 };
      }
    }
    const num = parseFloat(clean);
    if (!isNaN(num)) {
      return { min: num / 100, max: num / 100 };
    }
    return { min: defaultMinPercent / 100, max: defaultMaxPercent / 100 };
  };

  const executeTradeRound = async () => {
    // Win probability based on admin configured win ratio percentage (e.g. 60% win / 40% loss)
    const winProb = parseWinProbability(bot?.winRatioRange);
    const isWin = Math.random() < winProb;
    const capital = bot?.capital || 50;
    
    // Profit / loss percentage range configured by admin
    const winRange = parseRangeToDecimals(bot?.winProfitRange, 1.5, 2.5);
    const lossRange = parseRangeToDecimals(bot?.lossPercentRange, 0.4, 1.4);

    const profitRate = isWin 
      ? (winRange.min + Math.random() * (winRange.max - winRange.min)) 
      : -(lossRange.min + Math.random() * (lossRange.max - lossRange.min));
    const profitDelta = parseFloat((capital * profitRate).toFixed(2));
    const profitPercent = parseFloat((profitRate * 100).toFixed(2));

    let newTotal = totalTrades + 1;
    let newWins = isWin ? wins + 1 : wins;
    let newLosses = isWin ? losses : losses + 1;
    let newProfit = parseFloat((accruedProfit + profitDelta).toFixed(2));

    setTotalTrades(newTotal);
    setWins(newWins);
    setLosses(newLosses);
    setAccruedProfit(newProfit);

    if (isWin) {
      addLog(`Trade #${newTotal} closed! Result: WIN (+${profitDelta.toFixed(2)} USDT) on ${tradingPair}.`, 'success');
    } else {
      addLog(`Trade #${newTotal} closed! Result: LOSS (${profitDelta.toFixed(2)} USDT) on ${tradingPair}.`, 'warning');
    }

    // Trigger Profit / Loss Outcome Modal
    setOutcomeModal({
      isWin,
      profitDelta,
      profitPercent,
      capital,
      durationSeconds,
      tradingPair,
      botName
    });

    // Persist bot stats to Firestore
    if (bot?.id) {
      try {
        const botRef = doc(db, 'user_bots', bot.id);
        await updateDoc(botRef, {
          accruedProfit: newProfit,
          wins: newWins,
          losses: newLosses,
          totalTrades: newTotal,
          lastTradeAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Error updating bot stats in Firestore:", err);
      }
    }

    if (user?.uid) {
      try {
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userEmail: user.email || '',
          type: 'bot_trade',
          title: `${botName}`,
          tradingPair: tradingPair,
          botName: botName,
          amount: profitDelta,
          profitDelta: profitDelta,
          profitPercent: profitPercent,
          isWin: isWin,
          isCredit: isWin,
          status: isWin ? 'WIN' : 'LOSS',
          paymentMessage: `Bot trade on ${tradingPair}: ${isWin ? 'WIN' : 'LOSS'} (${profitDelta >= 0 ? '+' : ''}$${profitDelta.toFixed(2)})`,
          createdAt: serverTimestamp()
        });
      } catch (txErr) {
        console.error("Error creating bot_trade transaction record:", txErr);
      }
    }
  };

  // Toggle Pause/Resume
  const handleTogglePause = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    const newStatus = status === 'RUNNING' ? 'PAUSED' : 'RUNNING';
    try {
      if (bot?.id) {
        const botRef = doc(db, 'user_bots', bot.id);
        await updateDoc(botRef, { status: newStatus });
      }
      setStatus(newStatus);
      if (newStatus === 'PAUSED') {
        addLog(`Bot trading paused by user.`, 'warning');
        toast.info(`'${botName}' trading paused`, 'Bot Paused');
      } else {
        addLog(`Bot trading resumed.`, 'info');
        toast.success(`'${botName}' trading resumed`, 'Bot Running');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update bot status', 'Status Error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Stop Confirmation Modal
  const handleStopBotClick = () => {
    if (actionLoading) return;
    setShowStopConfirmModal(true);
  };

  // Confirm Stop Bot and Return Capital + Profit/Loss
  const confirmStopBot = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const botCapital = bot?.capital || 0;
      const totalReturnAmount = Math.max(0, parseFloat((botCapital + accruedProfit).toFixed(2)));
      const userRef = doc(db, 'users', user.uid);
      const newBalance = userBalance + totalReturnAmount;
      await updateDoc(userRef, { balance: newBalance });

      if (bot?.id) {
        const botRef = doc(db, 'user_bots', bot.id);
        await updateDoc(botRef, { 
          status: 'STOPPED', 
          accruedProfit: 0,
          stoppedAt: serverTimestamp() 
        });
      }

      if (accruedProfit !== 0) {
        const isProfit = accruedProfit > 0;
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userEmail: user.email,
          type: 'bot_harvest',
          title: `${botName} ${isProfit ? 'Profit Harvest' : 'Loss Deduction'}`,
          tradingPair: bot?.tradingPair || 'BTC/USDT',
          botName: botName,
          amount: Math.abs(accruedProfit),
          profitDelta: accruedProfit,
          isWin: isProfit,
          status: isProfit ? 'WIN' : 'LOSS',
          paymentMessage: `Bot ${botName} stopped: ${isProfit ? `Harvested +$${accruedProfit.toFixed(2)} USDT profit` : `Net loss -$${Math.abs(accruedProfit).toFixed(2)} USDT`}`,
          createdAt: serverTimestamp()
        });
      }

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email,
        type: 'bot_capital_return',
        title: 'Bot Capital Return',
        amount: botCapital,
        status: 'APPROVED',
        coinSymbol: bot?.coinSymbol || 'USDT',
        paymentMessage: `Auto Bot trade: Stopped ${botName} & returned $${botCapital.toFixed(2)} capital`,
        createdAt: serverTimestamp()
      });

      addLog(`Bot '${botName}' stopped. Credited $${totalReturnAmount.toFixed(2)} USDT to wallet balance.`, 'warning');
      toast.success(`Stopped '${botName}'. Credited $${totalReturnAmount.toFixed(2)} to your balance!`, 'Auto Bot Trade');
      setShowStopConfirmModal(false);
      onBack();
    } catch (err: any) {
      console.error("Error stopping bot:", err);
      toast.error(err.message || 'Failed to stop bot', 'Stop Error');
      setActionLoading(false);
    }
  };

  const elapsedSeconds = Math.max(0, durationSeconds - remainingSeconds);
  const progressPercent = Math.min(100, Math.max(0, (elapsedSeconds / durationSeconds) * 100));
  const winRatio = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '100.0';

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl mx-auto pb-10">
      {/* SYSTEM OFFLINE BANNER */}
      {isBotOffline && (
        <div className={`p-4.5 sm:p-5 rounded-3xl border flex items-center gap-3.5 shadow-xs ${
          isLightTheme ? 'bg-rose-50/90 border-rose-200 text-rose-950' : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
        }`}>
          <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
            <WifiOff size={20} className="text-rose-500 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <span>System State: OFFLINE</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-500 font-mono">Offline Rate</span>
            </h4>
            <p className="text-xs font-medium mt-0.5 leading-relaxed opacity-90">
              Network latency or offline market rate detected. Bot status is <strong>OFFLINE</strong> and every bot detail (Capital, Wins, Losses, Trades, Profit, Win Ratio) is set to <strong>0</strong> until live rate syncing resumes.
            </p>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className={`p-5 sm:p-6 rounded-3xl border shadow-xs transition-all ${
        isLightTheme ? 'bg-white border-zinc-200/90' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className={`w-10 h-10 rounded-2xl border transition-all cursor-pointer flex items-center justify-center shadow-xs active:scale-95 ${
                isLightTheme 
                  ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700' 
                  : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-zinc-200'
              }`}
              title="Back to Dashboard"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${
                  isLightTheme ? 'text-zinc-900' : 'text-white'
                }`}>
                  Running Bot
                </h2>
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-3 py-1 rounded-full font-black uppercase tracking-wider border shadow-xs ${
                  isBotOffline
                    ? isLightTheme ? 'bg-rose-100/90 text-rose-900 border-rose-300' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : status === 'RUNNING'
                      ? isLightTheme ? 'bg-emerald-100/90 text-emerald-900 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isLightTheme ? 'bg-amber-100/90 text-amber-900 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isBotOffline ? 'bg-rose-500' : status === 'RUNNING' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                  {isBotOffline ? 'OFFLINE' : status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Badges row right below Running Bot title */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3.5 border-t border-zinc-100 dark:border-slate-800/80">
          <div className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 ${
            isLightTheme 
              ? 'bg-amber-100/80 border-amber-300 text-amber-900 shadow-xs' 
              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
          }`}>
            <Bot size={14} className={isLightTheme ? 'text-amber-700' : 'text-emerald-400'} />
            <span>{botName}</span>
          </div>
          <div className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border flex items-center gap-1.5 ${
            isLightTheme 
              ? 'bg-zinc-100/90 border-zinc-200 text-zinc-700' 
              : 'bg-slate-800 border-slate-700 text-zinc-300'
          }`}>
            <Clock size={14} className="text-amber-500" />
            <span>Cycle duration: <strong className="font-mono">{durationSeconds}s</strong></span>
          </div>
        </div>

        {/* Text line */}
        <p className={`text-xs font-medium mt-3 leading-relaxed flex items-center gap-1.5 flex-wrap ${
          isLightTheme ? 'text-zinc-600' : 'text-zinc-400'
        }`}>
          <span><strong className={isLightTheme ? 'text-amber-700 font-bold' : 'text-emerald-400 font-bold'}>'{botName}'</strong> is automatically analyzing trade entries on</span>
          <TradingPairBadge pair={tradingPair} isLightTheme={isLightTheme} size="sm" showName />
        </p>
      </div>


      {/* CARD 1: Trade Closes In & Trading Pair + Hourglass Timer - EXACT BLUEPRINT DESIGN */}
      <HourglassProgress
        tradingPair={tradingPair}
        progressPercent={isBotOffline ? 0 : progressPercent}
        remainingSeconds={isBotOffline ? 0 : remainingSeconds}
        durationSeconds={durationSeconds}
        status={isBotOffline ? 'OFFLINE' : status}
        isOffline={isBotOffline}
        isLightTheme={isLightTheme}
      />

      {/* CARD 2: PERFORMANCE STATS - COMPACT MODERN HIGH-DENSITY */}
      <div className={`p-4 sm:p-5 rounded-2xl border shadow-sm space-y-3.5 transition-all ${
        isLightTheme ? 'bg-white border-slate-200/90' : 'bg-slate-900 border-slate-800'
      }`}>
        {/* Header Strip */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isBotOffline ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
            <h3 className={`text-xs font-black uppercase tracking-wider ${
              isLightTheme ? 'text-slate-700' : 'text-slate-300'
            }`}>
              Performance Stats
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
              isLightTheme 
                ? 'bg-slate-100 border-slate-200 text-slate-600' 
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}>
              Capital: ${bot?.capital || 50} USDT
            </span>
          </div>
        </div>

        {/* Top Metric Grid: Wins, Total Trades, Losses (3 Columns, compact padding) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {/* Wins */}
          <div className={`px-3 py-2.5 rounded-xl border transition-all ${
            isLightTheme 
              ? 'bg-emerald-50/60 border-emerald-200/70' 
              : 'bg-emerald-950/30 border-emerald-500/25'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-wider ${
                isLightTheme ? 'text-emerald-800' : 'text-emerald-400'
              }`}>
                Wins
              </span>
              <CheckCircle2 size={12} className={isLightTheme ? 'text-emerald-600' : 'text-emerald-400'} strokeWidth={2.5} />
            </div>
            <span className={`text-xl sm:text-2xl font-black font-mono mt-0.5 block tracking-tight ${
              isLightTheme ? 'text-emerald-900' : 'text-emerald-300'
            }`}>
              {isBotOffline ? 0 : wins}
            </span>
          </div>

          {/* Total Trades */}
          <div className={`px-3 py-2.5 rounded-xl border transition-all ${
            isLightTheme 
              ? 'bg-slate-50 border-slate-200/80' 
              : 'bg-slate-800/60 border-slate-700/70'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-wider ${
                isLightTheme ? 'text-slate-600' : 'text-slate-400'
              }`}>
                Total Trades
              </span>
              <Activity size={12} className={isLightTheme ? 'text-slate-500' : 'text-slate-400'} strokeWidth={2.5} />
            </div>
            <span className={`text-xl sm:text-2xl font-black font-mono mt-0.5 block tracking-tight ${
              isLightTheme ? 'text-slate-900' : 'text-white'
            }`}>
              {isBotOffline ? 0 : totalTrades}
            </span>
          </div>

          {/* Losses */}
          <div className={`px-3 py-2.5 rounded-xl border transition-all ${
            isLightTheme 
              ? 'bg-rose-50/60 border-rose-200/70' 
              : 'bg-rose-950/30 border-rose-500/25'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-wider ${
                isLightTheme ? 'text-rose-800' : 'text-rose-400'
              }`}>
                Losses
              </span>
              <XCircle size={12} className={isLightTheme ? 'text-rose-600' : 'text-rose-400'} strokeWidth={2.5} />
            </div>
            <span className={`text-xl sm:text-2xl font-black font-mono mt-0.5 block tracking-tight ${
              isLightTheme ? 'text-rose-900' : 'text-rose-300'
            }`}>
              {isBotOffline ? 0 : losses}
            </span>
          </div>
        </div>

        {/* Middle Row: Win Ratio & Accrued Profit (2 columns, sleek compact styling) */}
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          {/* Win Ratio */}
          <div className={`px-3.5 py-3 rounded-xl border transition-all ${
            isLightTheme 
              ? 'bg-amber-50/40 border-amber-200/80' 
              : 'bg-slate-800/40 border-amber-500/20'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Target size={12} className={isLightTheme ? 'text-amber-600' : 'text-amber-400'} />
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  isLightTheme ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  Win Ratio
                </span>
              </div>
              <span className="text-[9px] font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded">
                Target {bot?.winRatioRange || '95%'}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                isLightTheme ? 'text-amber-800' : 'text-amber-300'
              }`}>
                {isBotOffline ? '0.0' : winRatio}<span className="text-sm">%</span>
              </span>
            </div>
            {/* Sleek slim progress bar */}
            <div className="mt-2 w-full bg-slate-200/70 dark:bg-slate-700/70 rounded-full h-1 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, parseFloat(isBotOffline ? '0' : winRatio)))}%` }}
              />
            </div>
          </div>

          {/* Accrued Profit */}
          <div className={`px-3.5 py-3 rounded-xl border transition-all ${
            isLightTheme 
              ? (isBotOffline ? 0 : accruedProfit) >= 0 
                ? 'bg-emerald-50/70 border-emerald-300/80' 
                : 'bg-rose-50/70 border-rose-300/80'
              : (isBotOffline ? 0 : accruedProfit) >= 0 
                ? 'bg-emerald-950/30 border-emerald-500/30' 
                : 'bg-rose-950/30 border-rose-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {(isBotOffline ? 0 : accruedProfit) >= 0 ? (
                  <TrendingUp size={12} className={isLightTheme ? 'text-emerald-700' : 'text-emerald-400'} />
                ) : (
                  <TrendingDown size={12} className={isLightTheme ? 'text-rose-700' : 'text-rose-400'} />
                )}
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  isLightTheme 
                    ? (isBotOffline ? 0 : accruedProfit) >= 0 ? 'text-emerald-900' : 'text-rose-900'
                    : (isBotOffline ? 0 : accruedProfit) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}>
                  {(isBotOffline ? 0 : accruedProfit) >= 0 ? 'Accrued Profit' : 'Accrued Loss'}
                </span>
              </div>
              <span className={`text-[8px] font-mono font-extrabold uppercase px-1.5 py-0.2 rounded ${
                (isBotOffline ? 0 : accruedProfit) >= 0
                  ? isLightTheme ? 'bg-emerald-200/80 text-emerald-900' : 'bg-emerald-500/20 text-emerald-300'
                  : isLightTheme ? 'bg-rose-200/80 text-rose-900' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {(isBotOffline ? 0 : accruedProfit) >= 0 ? '+PROFIT' : '-LOSS'}
              </span>
            </div>
            <span className={`text-xl sm:text-2xl font-black font-mono mt-1 block tracking-tight ${
              isLightTheme 
                ? (isBotOffline ? 0 : accruedProfit) >= 0 ? 'text-emerald-800' : 'text-rose-800'
                : (isBotOffline ? 0 : accruedProfit) >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}>
              {isBotOffline ? '+$0.00' : `${accruedProfit >= 0 ? '+' : ''}$${accruedProfit.toFixed(2)}`}
            </span>
          </div>
        </div>

        {/* Action Buttons: Stop & Pause */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleStopBotClick}
            disabled={actionLoading}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all duration-150 flex items-center justify-center gap-2 shadow-xs hover:shadow-sm bg-rose-600 hover:bg-rose-700 text-white active:scale-[0.98] border-none disabled:opacity-50"
          >
            <Square size={13} fill="currentColor" />
            <span>Stop Bot</span>
          </button>

          <button
            type="button"
            onClick={handleTogglePause}
            disabled={actionLoading}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all duration-150 flex items-center justify-center gap-2 shadow-xs hover:shadow-sm active:scale-[0.98] border-none disabled:opacity-50 ${
              status === 'RUNNING'
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white font-black'
            }`}
          >
            {status === 'RUNNING' ? <Pause size={14} strokeWidth={2.5} /> : <Play size={14} strokeWidth={2.5} />}
            <span>{status === 'RUNNING' ? 'Pause Bot' : 'Resume Bot'}</span>
          </button>
        </div>
      </div>

      {/* CARD 3: Bot Console Log */}
      <div className={`p-5 sm:p-6 rounded-3xl border shadow-lg space-y-3 ${
        isLightTheme ? 'bg-white border-zinc-200' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-black tracking-tight flex items-center gap-2 ${
            isLightTheme ? 'text-zinc-900' : 'text-white'
          }`}>
            <Terminal size={17} className={isLightTheme ? 'text-amber-500' : 'text-emerald-400'} />
            <span>Bot Console log</span>
          </h3>
          <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
            Live Output
          </span>
        </div>

        {/* Log Window */}
        <div 
          ref={logContainerRef}
          className={`h-52 overflow-y-auto p-3.5 rounded-2xl font-mono text-xs space-y-2 border ${
            isLightTheme 
              ? 'bg-zinc-900 border-zinc-800 text-zinc-200' 
              : 'bg-slate-950 border-slate-800 text-slate-200'
          }`}
        >
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 leading-relaxed text-[11px] sm:text-xs">
              <span className="text-zinc-500 shrink-0 select-none">[{log.time}]</span>
              <span className={
                log.type === 'success' 
                  ? 'text-emerald-400 font-bold' 
                  : log.type === 'warning' 
                  ? 'text-amber-400 font-bold' 
                  : log.type === 'error'
                  ? 'text-rose-400 font-bold'
                  : 'text-zinc-300'
              }>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* TRADE OUTCOME MODAL (PROFIT / LOSS) BASED ON BLUEPRINT */}
      {outcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className={`relative max-w-sm w-full p-6 rounded-3xl border shadow-2xl text-center space-y-4 ${
            isLightTheme ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            {/* Close X Button */}
            <button
              type="button"
              onClick={() => setOutcomeModal(null)}
              className={`absolute top-4 right-4 p-1.5 rounded-full border transition-all cursor-pointer ${
                isLightTheme 
                  ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-500' 
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-zinc-400'
              }`}
            >
              <X size={16} />
            </button>

            {/* Top Badge: Profit or Loss */}
            <div className="flex justify-center pt-1">
              <span className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm ${
                outcomeModal.isWin
                  ? isLightTheme
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : isLightTheme
                    ? 'bg-rose-100 border-rose-300 text-rose-800'
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              }`}>
                {outcomeModal.isWin ? 'Profit' : 'Loss'}
              </span>
            </div>

            {/* Message Headings */}
            <div className="space-y-1">
              <h3 className={`text-base font-black tracking-tight ${
                outcomeModal.isWin
                  ? isLightTheme ? 'text-emerald-700' : 'text-emerald-400'
                  : isLightTheme ? 'text-rose-700' : 'text-rose-400'
              }`}>
                {outcomeModal.isWin ? 'Profitable trade closed.' : 'Loss trade closed.'}
              </h3>
              <p className={`text-xs font-semibold ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {outcomeModal.isWin ? 'Trade again for more Profit' : 'Trade again to recover'}
              </p>
            </div>

            {/* Outcome Pill Box: (+XX.XX (X%)) */}
            <div className={`py-3 px-4 rounded-2xl border font-mono font-black text-xl sm:text-2xl tracking-wide flex items-center justify-center gap-2 ${
              outcomeModal.isWin
                ? isLightTheme
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-inner'
                  : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 shadow-inner'
                : isLightTheme
                  ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-inner'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300 shadow-inner'
            }`}>
              {outcomeModal.isWin ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
              <span>
                {outcomeModal.isWin ? '+' : ''}{outcomeModal.profitDelta.toFixed(2)} USDT ({outcomeModal.profitPercent > 0 ? '+' : ''}{outcomeModal.profitPercent.toFixed(1)}%)
              </span>
            </div>

            {/* Details Grid */}
            <div className={`p-3.5 rounded-2xl border text-left text-xs space-y-2 font-medium ${
              isLightTheme ? 'bg-zinc-50 border-zinc-200 text-zinc-700' : 'bg-slate-800/60 border-slate-700/60 text-zinc-300'
            }`}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-zinc-400 text-[10px] uppercase font-bold block">Invested amount</span>
                  <span className="font-mono font-bold">${outcomeModal.capital} USDT</span>
                </div>
                <div>
                  <span className="text-zinc-400 text-[10px] uppercase font-bold block">Duration</span>
                  <span className="font-mono font-bold">{outcomeModal.durationSeconds}s</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-zinc-200 dark:border-slate-700/60">
                <div>
                  <span className="text-zinc-400 text-[10px] uppercase font-bold block">Trading pair</span>
                  <span className="font-mono font-bold">{outcomeModal.tradingPair}</span>
                </div>
                <div>
                  <span className="text-zinc-400 text-[10px] uppercase font-bold block">Trade type</span>
                  <span className="font-mono font-bold capitalize">bot</span>
                </div>
              </div>
            </div>

            {/* Action Buttons: Trade again & History */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOutcomeModal(null);
                  setRemainingSeconds(durationSeconds);
                  setStatus('RUNNING');
                  addLog(`Initiated next trade round on ${tradingPair} (${durationSeconds}s cycle).`, 'info');
                  toast.success(`Continuing auto trade on ${tradingPair}`, 'Trade Restarted');
                }}
                className={`py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer border transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
                  isLightTheme
                    ? 'bg-amber-500 hover:bg-amber-600 border-amber-600 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-400 border-emerald-400 text-slate-950 font-black'
                }`}
              >
                <RotateCcw size={14} />
                <span>Trade again</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOutcomeModal(null);
                  handleStopBotClick();
                }}
                className="py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer border transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 bg-rose-500 hover:bg-rose-600 border-rose-600 text-white"
              >
                <Square size={13} fill="currentColor" />
                <span>STOP</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STOP CONFIRMATION MODAL */}
      {showStopConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className={`relative max-w-sm w-full p-6 rounded-3xl border shadow-2xl space-y-4 ${
            isLightTheme ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <button
              type="button"
              onClick={() => setShowStopConfirmModal(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-full border transition-all cursor-pointer ${
                isLightTheme 
                  ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-500' 
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-zinc-400'
              }`}
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 pt-1">
              <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-500 border border-rose-500/30 shrink-0">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">Stop Trading Bot?</h3>
                <p className={`text-xs font-medium ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Confirm bot termination
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-2.5 ${
              isLightTheme ? 'bg-zinc-50 border-zinc-200 text-zinc-700' : 'bg-slate-800/60 border-slate-700/60 text-zinc-300'
            }`}>
              <p>
                Are you sure you want to stop <strong className={isLightTheme ? 'text-zinc-900' : 'text-white'}>'{botName}'</strong>?
              </p>
              <div className="pt-2 border-t border-zinc-200 dark:border-slate-700/60 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Capital:</span>
                  <span className="font-bold">${bot?.capital || 0} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Accrued Profit/Loss:</span>
                  <span className={`font-bold ${accruedProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {accruedProfit >= 0 ? '+' : ''}${accruedProfit.toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-dashed border-zinc-200 dark:border-slate-700/60 text-sm font-black">
                  <span>Total Return:</span>
                  <span className="text-amber-500 dark:text-emerald-400">${((bot?.capital || 0) + accruedProfit).toFixed(2)} USDT</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowStopConfirmModal(false)}
                disabled={actionLoading}
                className={`py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer border transition-all ${
                  isLightTheme
                    ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-800'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                }`}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmStopBot}
                disabled={actionLoading}
                className="py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer border transition-all bg-rose-500 hover:bg-rose-600 border-rose-600 text-white shadow-md active:scale-95 flex items-center justify-center gap-1.5"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Square size={13} fill="currentColor" />
                    <span>Yes, Stop Bot</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
