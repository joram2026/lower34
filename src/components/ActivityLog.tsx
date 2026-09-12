import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Transaction } from '../types';
import { 
  ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Clock, CheckCircle2, XCircle, 
  ChevronDown, ChevronUp, RefreshCw, Calendar, Gift, TrendingUp, Send, Bot, 
  Sparkles, Search, Copy, Check, ArrowDown, ArrowUp, Wallet, Layers, ShieldCheck,
  ReceiptText, X
} from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error in ActivityLog: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ActivityLogProps {
  userId: string;
  isLightTheme?: boolean;
}

type FilterCategory = 'all' | 'deposits' | 'withdrawals' | 'copy' | 'bot' | 'rewards' | 'buysell' | 'transfers';

const FILTER_PILLS: { id: FilterCategory; label: string }[] = [
  { id: 'all', label: 'All History' },
  { id: 'deposits', label: 'Deposits' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'copy', label: 'Copy & Signals' },
  { id: 'bot', label: 'Bot Trades' },
  { id: 'rewards', label: 'Rewards & Bonus' },
  { id: 'buysell', label: 'Buy & Sell' },
  { id: 'transfers', label: 'Transfers' },
];

export default function ActivityLog({ userId, isLightTheme = false }: ActivityLogProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setLoading(true);
    const txCol = collection(db, 'transactions');
    const q = query(txCol, where('userId', '==', userId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const list = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        } as Transaction));

        // Sort descending by creation date
        list.sort((a, b) => {
          const aTime = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
          const bTime = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
          return bTime - aTime;
        });

        setTransactions(list);
        setLoading(false);
        setIsRefreshing(false);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'transactions');
      }
    }, (err) => {
      setError(err.message);
      setLoading(false);
      setIsRefreshing(false);
      handleFirestoreError(err, OperationType.GET, 'transactions');
    });

    return () => unsubscribe();
  }, [userId]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTxTypeInfo = (type: string, tx?: any) => {
    switch (type) {
      case 'Auto Bot trade':
      case 'bot_harvest':
      case 'bot_trade':
      case 'bot': {
        const isBotCredit = tx?.isCredit !== undefined 
          ? tx.isCredit 
          : (tx?.isWin !== undefined 
              ? tx.isWin 
              : (tx?.status === 'WIN') ||
                (tx?.paymentMessage && (
                  tx.paymentMessage.toLowerCase().includes('stopped') || 
                  tx.paymentMessage.toLowerCase().includes('returned') || 
                  tx.paymentMessage.toLowerCase().includes('profit') ||
                  tx.paymentMessage.toLowerCase().includes('harvest')
                )));
        return {
          label: tx?.title || 'Auto Bot Trade',
          isCredit: isBotCredit ? true : false,
          colorClass: isBotCredit 
            ? (isLightTheme ? 'text-emerald-700' : 'text-emerald-400')
            : (isLightTheme ? 'text-amber-700' : 'text-amber-400'),
          bgClass: isBotCredit
            ? (isLightTheme ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')
            : (isLightTheme ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'),
          icon: <Bot size={17} />
        };
      }
      case 'referral_reward':
        return {
          label: 'Referral Reward',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <Gift size={17} />
        };
      case 'voucher_reward':
      case 'voucher':
      case 'promo_voucher':
        return {
          label: tx?.title || 'Voucher Reward',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          icon: <Gift size={17} />
        };
      case 'first_deposit_commission':
        return {
          label: 'Referral Deposit Bonus',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <Gift size={17} />
        };
      case 'welcome_bonus':
        return {
          label: 'Welcome Bonus',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <Sparkles size={17} />
        };
      case 'deposit_crypto':
        return {
          label: 'Crypto Deposit',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <ArrowDownLeft size={17} />
        };
      case 'deposit_p2p':
        return {
          label: 'P2P Deposit',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <ArrowDownLeft size={17} />
        };
      case 'withdraw_crypto':
        return {
          label: 'Crypto Withdrawal',
          isCredit: false,
          colorClass: isLightTheme ? 'text-red-700' : 'text-red-400',
          bgClass: isLightTheme ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-500/10 text-red-400 border-red-500/20',
          icon: <ArrowUpRight size={17} />
        };
      case 'withdraw_p2p':
        return {
          label: 'P2P Withdrawal',
          isCredit: false,
          colorClass: isLightTheme ? 'text-red-700' : 'text-red-400',
          bgClass: isLightTheme ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-500/10 text-red-400 border-red-500/20',
          icon: <ArrowUpRight size={17} />
        };
      case 'buy_crypto':
        return {
          label: 'Buy Crypto',
          isCredit: false,
          colorClass: isLightTheme ? 'text-amber-700' : 'text-blue-400',
          bgClass: isLightTheme ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          icon: <ArrowDownLeft size={17} />
        };
      case 'sell_crypto':
        return {
          label: 'Sell Crypto',
          isCredit: true,
          colorClass: isLightTheme ? 'text-amber-700' : 'text-amber-400',
          bgClass: isLightTheme ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          icon: <ArrowUpRight size={17} />
        };
      case 'swap_crypto':
        return {
          label: 'Swap & Convert',
          isCredit: null,
          colorClass: isLightTheme ? 'text-purple-700' : 'text-purple-400',
          bgClass: isLightTheme ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          icon: <ArrowRightLeft size={17} />
        };
      case 'invested':
        return {
          label: 'Trade Signal Lock',
          isCredit: false,
          colorClass: isLightTheme ? 'text-amber-700' : 'text-amber-400',
          bgClass: isLightTheme ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          icon: <TrendingUp size={17} />
        };
      case 'investment_earning':
        return {
          label: 'Signal Profit Payout',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <TrendingUp size={17} />
        };
      case 'copy_trade_payout':
        return {
          label: 'Copy Trade Payout',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <TrendingUp size={17} />
        };
      case 'copy_trade_upgrade':
        return {
          label: tx?.title || 'Contract Upgrade',
          isCredit: null,
          colorClass: isLightTheme ? 'text-amber-700' : 'text-amber-400',
          bgClass: isLightTheme ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          icon: <Sparkles size={17} />
        };
      case 'trade_balance_transfer_in':
      case 'copy_trade_transfer_in':
        return {
          label: 'Copy Wallet Transfer IN',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <ArrowRightLeft size={17} />
        };
      case 'trade_balance_transfer_out':
      case 'copy_trade_transfer_out':
        return {
          label: 'Copy Wallet Transfer OUT',
          isCredit: false,
          colorClass: isLightTheme ? 'text-amber-700' : 'text-amber-400',
          bgClass: isLightTheme ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          icon: <ArrowRightLeft size={17} />
        };
      case 'internal_send':
        return {
          label: 'Internal Send',
          isCredit: false,
          colorClass: isLightTheme ? 'text-amber-700' : 'text-amber-400',
          bgClass: isLightTheme ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          icon: <Send size={17} />
        };
      case 'internal_receive':
        return {
          label: 'Internal Receive',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <Send size={17} />
        };
      default: {
        const isVoucherType = (type && (type.toLowerCase().includes('voucher') || type.toLowerCase().includes('promo'))) || 
                              (tx?.title && (tx.title.toLowerCase().includes('voucher') || tx.title.toLowerCase().includes('promo')));
        if (isVoucherType) {
          return {
            label: tx?.title || 'Voucher Reward',
            isCredit: true,
            colorClass: isLightTheme ? 'text-emerald-700' : 'text-emerald-400',
            bgClass: isLightTheme ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            icon: <Gift size={17} />
          };
        }

        const isBotType = (type && type.toLowerCase().includes('bot')) || (tx?.title && tx.title.toLowerCase().includes('bot'));
        if (isBotType) {
          return {
            label: tx?.title || 'Auto Bot Trade',
            isCredit: true,
            colorClass: isLightTheme ? 'text-emerald-700' : 'text-emerald-400',
            bgClass: isLightTheme ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            icon: <Bot size={17} />
          };
        }

        const isCredit = tx?.isCredit === true || type.startsWith('deposit') || type.includes('reward') || type.includes('bonus');
        const isDeposit = type.startsWith('deposit');
        return {
          label: isDeposit ? 'Deposit' : (isCredit ? 'Credit' : 'Withdrawal'),
          isCredit: isCredit,
          colorClass: isCredit 
            ? (isLightTheme ? 'text-emerald-700' : 'text-emerald-400') 
            : (isLightTheme ? 'text-red-700' : 'text-red-400'),
          bgClass: isCredit 
            ? (isLightTheme ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20') 
            : (isLightTheme ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-500/10 text-red-400 border-red-500/20'),
          icon: isCredit ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />
        };
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
            isLightTheme 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
          }`}>
            <CheckCircle2 size={10} className="text-emerald-500" />
            <span>Success</span>
          </span>
        );
      case 'DECLINED':
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
            isLightTheme 
              ? 'bg-red-50 text-red-800 border border-red-200' 
              : 'bg-red-500/15 text-red-300 border border-red-500/30'
          }`}>
            <XCircle size={10} className="text-red-400" />
            <span>Declined</span>
          </span>
        );
      default:
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
            isLightTheme 
              ? 'bg-amber-50 text-amber-800 border border-amber-200' 
              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
          }`}>
            <Clock size={10} className="text-amber-400 animate-pulse" />
            <span>Pending</span>
          </span>
        );
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    let date: Date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter and search computation
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const isVoucher = tx.type === 'voucher_reward' || tx.type === 'voucher' || tx.type === 'promo_voucher' || tx.type?.toLowerCase?.().includes('voucher') || (tx.title && tx.title.toLowerCase().includes('voucher'));
      const isDeposit = tx.type.startsWith('deposit');
      const isUpgrade = tx.type === 'copy_trade_upgrade' || 
                        (tx.title && (tx.title.toLowerCase().includes('upgrade') || tx.title.toLowerCase().includes('rollover'))) ||
                        (tx.paymentMessage && (tx.paymentMessage.toLowerCase().includes('upgraded copy') || tx.paymentMessage.toLowerCase().includes('rolled over')));
      const isWithdrawal = tx.type.startsWith('withdraw') && !isUpgrade;
      const isBuy = tx.type === 'buy_crypto';
      const isSell = tx.type === 'sell_crypto';
      const isSwap = tx.type === 'swap_crypto';
      const isReferral = tx.type === 'referral_reward' || tx.type === 'first_deposit_commission' || tx.type === 'welcome_bonus';
      const isInvestment = tx.type === 'invested' || tx.type === 'investment_earning';
      const isBot = tx.type === 'Auto Bot trade' || tx.type === 'bot_harvest' || tx.type === 'bot_trade' || tx.type === 'bot' || tx.type?.toLowerCase?.().includes('bot') || (tx.title && tx.title.toLowerCase().includes('bot'));
      const isCopyTrade = tx.type?.startsWith('copy_trade') || tx.type?.includes('copy_trade') || isUpgrade;
      const isTransfer = tx.type?.includes('transfer') || tx.type?.includes('internal');

      let matchesCategory = true;
      if (activeFilter === 'deposits') matchesCategory = isDeposit;
      else if (activeFilter === 'withdrawals') matchesCategory = isWithdrawal && !isBot && !isVoucher && !isUpgrade;
      else if (activeFilter === 'copy') matchesCategory = isCopyTrade || isInvestment;
      else if (activeFilter === 'bot') matchesCategory = isBot;
      else if (activeFilter === 'rewards') matchesCategory = isReferral || isVoucher;
      else if (activeFilter === 'buysell') matchesCategory = isBuy || isSell || isSwap;
      else if (activeFilter === 'transfers') matchesCategory = isTransfer;

      if (!matchesCategory) return false;

      // Text search
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const idMatch = tx.id.toLowerCase().includes(queryLower);
        const titleMatch = (tx.title || '').toLowerCase().includes(queryLower);
        const typeMatch = tx.type.toLowerCase().includes(queryLower);
        const merchantMatch = (tx.merchantName || '').toLowerCase().includes(queryLower);
        const networkMatch = (tx.network || '').toLowerCase().includes(queryLower);
        const msgMatch = (tx.paymentMessage || '').toLowerCase().includes(queryLower);
        const amountMatch = String(tx.amount).includes(queryLower);

        return idMatch || titleMatch || typeMatch || merchantMatch || networkMatch || msgMatch || amountMatch;
      }

      return true;
    });
  }, [transactions, activeFilter, searchQuery]);

  return (
    <div id="activity-log-page" className="space-y-3 max-w-4xl mx-auto pb-6">
      {/* Interactive Search & Category Ribbon */}
      <div className="space-y-2.5">
        {/* Search input with refresh action */}
        <div className="flex items-center gap-2">
          <div className={`relative flex-1 flex items-center rounded-xl border transition-all ${
            isLightTheme 
              ? 'bg-white border-zinc-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 shadow-2xs' 
              : 'bg-[#0d1411] border-zinc-800 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20'
          }`}>
            <Search size={15} className="absolute left-3.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Transaction ID, method, pair, or merchant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-transparent pl-10 pr-9 py-2.5 text-xs font-medium outline-none ${
                isLightTheme ? 'text-zinc-900 placeholder:text-zinc-400' : 'text-white placeholder:text-zinc-500'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsRefreshing(true)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
              isLightTheme 
                ? 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-600' 
                : 'bg-[#0d1411] hover:bg-white/[0.04] border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="Refresh history"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-emerald-500' : ''} />
          </button>
        </div>

        {/* Scrollable Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {FILTER_PILLS.map((pill) => {
            const isSelected = activeFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setActiveFilter(pill.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 select-none ${
                  isSelected
                    ? 'bg-[#008B47] text-white shadow-xs'
                    : isLightTheme
                    ? 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300'
                    : 'bg-[#0d1411] border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Transaction Ledger Stream */}
      <div className="space-y-2.5">
        {loading ? (
          <div className={`p-12 rounded-2xl border text-center select-none flex flex-col items-center justify-center gap-3 ${
            isLightTheme ? 'bg-white border-zinc-200' : 'bg-[#0d1411] border-zinc-800'
          }`}>
            <RefreshCw size={22} className="text-emerald-500 animate-spin" />
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Syncing Ledger...</span>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold text-center select-none">
            {error}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className={`p-10 rounded-2xl border text-center select-none flex flex-col items-center justify-center gap-2.5 ${
            isLightTheme ? 'bg-white border-zinc-200' : 'bg-[#0d1411] border-zinc-800'
          }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
              isLightTheme ? 'bg-zinc-50 text-zinc-400 border-zinc-200' : 'bg-white/[0.03] text-zinc-500 border-white/10'
            }`}>
              <Calendar size={20} />
            </div>
            <h4 className="text-xs font-bold text-zinc-400 mt-1 uppercase tracking-wider">No Activity Recorded</h4>
            <p className={`text-xs max-w-sm mx-auto leading-relaxed ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
              {searchQuery || activeFilter !== 'all'
                ? 'No transactions match your current search or category filter.'
                : 'Your transactions, payouts, and deposit settlements will appear here as soon as they execute.'}
            </p>
            {(searchQuery || activeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveFilter('all');
                }}
                className="mt-2 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-all cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const info = getTxTypeInfo(tx.type, tx);
            const isExpanded = expandedId === tx.id;
            const isCopied = copiedId === tx.id;

            return (
              <div
                key={tx.id}
                id={`activity-card-${tx.id}`}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isLightTheme 
                    ? 'bg-white border-zinc-200/90 hover:border-emerald-300/80 shadow-2xs' 
                    : 'bg-[#0d1411] border-zinc-800/90 hover:border-zinc-700'
                }`}
              >
                {/* Main Card Summary Click Area */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${info.bgClass}`}>
                      {info.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs sm:text-sm font-bold truncate ${isLightTheme ? 'text-zinc-900' : 'text-white'}`}>
                          {info.label}
                        </span>
                        {getStatusBadge(tx.status)}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 mt-0.5">
                        <Clock size={10} className="shrink-0" />
                        <span>{formatDate(tx.createdAt)}</span>
                        {tx.network && (
                          <>
                            <span>•</span>
                            <span className="font-bold uppercase text-zinc-500">{tx.network}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 text-right">
                    <div>
                      <div className={`text-xs sm:text-sm font-bold font-mono ${info.colorClass}`}>
                        {info.isCredit === true ? '+' : info.isCredit === false ? '-' : ''}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      {tx.localAmount && (
                        <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                          {tx.localAmount.toLocaleString()} Shs
                        </div>
                      )}
                    </div>
                    <div className="p-1 text-zinc-400">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>
                </div>

                {/* Expandable Audit Trail Drawer */}
                {isExpanded && (
                  <div className={`p-4 pt-3 border-t text-xs space-y-3 animate-fade-in ${
                    isLightTheme ? 'bg-zinc-50/70 border-zinc-100' : 'bg-black/30 border-white/5'
                  }`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Transaction ID */}
                      <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                        isLightTheme ? 'bg-white border-zinc-200' : 'bg-white/[0.02] border-white/10'
                      }`}>
                        <div className="min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block font-mono">
                            Transaction Reference
                          </span>
                          <span className={`font-mono text-xs font-semibold truncate block ${
                            isLightTheme ? 'text-zinc-800' : 'text-zinc-200'
                          }`}>
                            {tx.id}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(tx.id, tx.id);
                          }}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                            isCopied 
                              ? 'bg-emerald-500 text-white border-emerald-500' 
                              : isLightTheme ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-600' : 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300'
                          }`}
                          title="Copy Transaction ID"
                        >
                          {isCopied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>

                      {/* Method / Type */}
                      <div className={`p-2.5 rounded-xl border ${
                        isLightTheme ? 'bg-white border-zinc-200' : 'bg-white/[0.02] border-white/10'
                      }`}>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block font-mono">
                          Operation Type
                        </span>
                        <span className={`font-mono text-xs font-semibold capitalize mt-0.5 block ${
                          isLightTheme ? 'text-zinc-800' : 'text-zinc-200'
                        }`}>
                          {tx.type === 'copy_trade_upgrade' ? 'Contract Rollover' : tx.type.split('_').join(' ')}
                        </span>
                      </div>

                      {/* Blockchain Network */}
                      {tx.network && (
                        <div className={`p-2.5 rounded-xl border ${
                          isLightTheme ? 'bg-white border-zinc-200' : 'bg-white/[0.02] border-white/10'
                        }`}>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block font-mono">
                            Network / Protocol
                          </span>
                          <span className={`font-mono text-xs font-bold uppercase mt-0.5 block ${
                            isLightTheme ? 'text-zinc-800' : 'text-zinc-200'
                          }`}>
                            {tx.network}
                          </span>
                        </div>
                      )}

                      {/* Merchant or Pair */}
                      {tx.merchantName && (
                        <div className={`p-2.5 rounded-xl border ${
                          isLightTheme ? 'bg-white border-zinc-200' : 'bg-white/[0.02] border-white/10'
                        }`}>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block font-mono">
                            Counterparty / Merchant
                          </span>
                          <span className={`font-mono text-xs font-semibold mt-0.5 block ${
                            isLightTheme ? 'text-zinc-800' : 'text-zinc-200'
                          }`}>
                            {tx.merchantName}
                          </span>
                        </div>
                      )}

                      {/* Address */}
                      {tx.address && (
                        <div className={`col-span-1 sm:col-span-2 p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                          isLightTheme ? 'bg-white border-zinc-200' : 'bg-white/[0.02] border-white/10'
                        }`}>
                          <div className="min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block font-mono">
                              Settlement Address
                            </span>
                            <span className={`font-mono text-[11px] font-medium break-all block ${
                              isLightTheme ? 'text-zinc-700' : 'text-zinc-300'
                            }`}>
                              {tx.address}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(tx.address!, `${tx.id}-addr`);
                            }}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                              copiedId === `${tx.id}-addr` 
                                ? 'bg-emerald-500 text-white border-emerald-500' 
                                : isLightTheme ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-600' : 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300'
                            }`}
                            title="Copy Address"
                          >
                            {copiedId === `${tx.id}-addr` ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      )}

                      {/* Payment Message / Memo */}
                      {tx.paymentMessage && (
                        <div className={`col-span-1 sm:col-span-2 p-2.5 rounded-xl border ${
                          isLightTheme ? 'bg-white border-zinc-200' : 'bg-white/[0.02] border-white/10'
                        }`}>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block font-mono">
                            Audit Notes & System Memo
                          </span>
                          <p className={`text-[11px] leading-relaxed mt-1 ${
                            isLightTheme ? 'text-zinc-600' : 'text-zinc-300'
                          }`}>
                            {tx.paymentMessage}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
