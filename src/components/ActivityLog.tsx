import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Transaction } from '../types';
import { 
  ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Clock, CheckCircle2, XCircle, 
  ChevronDown, ChevronUp, Filter, RefreshCw, Calendar, ListFilter, Gift, TrendingUp, Send, Bot, Sparkles
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

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Transactions' },
  { value: 'vouchers', label: 'Vouchers & Promos' },
  { value: 'bot', label: 'Auto Bot Trade' },
  { value: 'deposits', label: 'Deposits' },
  { value: 'withdrawals', label: 'Withdrawals' },
  { value: 'buy', label: 'Buy Crypto' },
  { value: 'sell', label: 'Sell Crypto' },
  { value: 'swap', label: 'Swap & Convert' },
  { value: 'referral', label: 'Referral Rewards' },
  { value: 'investments', label: 'Trading Signals' },
] as const;

export default function ActivityLog({ userId, isLightTheme = false }: ActivityLogProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'vouchers' | 'deposits' | 'withdrawals' | 'buy' | 'sell' | 'swap' | 'referral' | 'investments' | 'bot'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Close dropdown when user clicks outside
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#custom-dropdown-container')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

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
          const aTime = a.createdAt?.seconds || a.createdAt?.getTime?.() / 1000 || 0;
          const bTime = b.createdAt?.seconds || b.createdAt?.getTime?.() / 1000 || 0;
          return bTime - aTime;
        });

        setTransactions(list);
        setLoading(false);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'transactions');
      }
    }, (err) => {
      setError(err.message);
      setLoading(false);
      handleFirestoreError(err, OperationType.GET, 'transactions');
    });

    return () => unsubscribe();
  }, [userId]);

  // Filter transactions based on selection
  const filteredTransactions = transactions.filter(tx => {
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

    if (filter === 'vouchers') return isVoucher;
    if (filter === 'bot') return isBot;
    if (filter === 'deposits') return isDeposit;
    if (filter === 'withdrawals') return isWithdrawal && !isBot && !isVoucher && !isUpgrade;
    if (filter === 'buy') return isBuy;
    if (filter === 'sell') return isSell;
    if (filter === 'swap') return isSwap;
    if (filter === 'referral') return isReferral;
    if (filter === 'investments') return isInvestment || isBot || isCopyTrade;
    
    // For 'all' filter, show everything
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle2 size={14} className="text-emerald-400" />;
      case 'DECLINED':
        return <XCircle size={14} className="text-red-400" />;
      default:
        return <Clock size={14} className="text-amber-400" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return isLightTheme 
          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'DECLINED':
        return isLightTheme 
          ? 'bg-red-50 text-red-800 border border-red-200' 
          : 'bg-red-500/10 text-red-400 border border-red-500/20';
      default:
        return isLightTheme 
          ? 'bg-amber-50 text-amber-800 border border-amber-200' 
          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    }
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
            ? (isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400')
            : (isLightTheme ? 'text-amber-700 font-extrabold' : 'text-amber-400'),
          bgClass: isBotCredit
            ? (isLightTheme ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400')
            : (isLightTheme ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-amber-500/10 border-amber-500/15 text-amber-400'),
          icon: <Bot size={16} />
        };
      }
      case 'referral_reward':
        return {
          label: 'Referral Reward',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400',
          icon: <Gift size={16} />
        };
      case 'voucher_reward':
      case 'voucher':
      case 'promo_voucher':
        return {
          label: tx?.title || 'Voucher Reward',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-amber-500/10 border-amber-500/15 text-amber-400',
          icon: <Gift size={16} />
        };
      case 'first_deposit_commission':
        return {
          label: 'Referral Deposit Bonus',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400',
          icon: <Gift size={16} />
        };
      case 'welcome_bonus':
        return {
          label: 'Welcome Deposit Bonus',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400',
          icon: <Sparkles size={16} />
        };
      case 'deposit_crypto':
        return {
          label: 'Crypto Deposit',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400',
          icon: <ArrowDownLeft size={16} />
        };
      case 'deposit_p2p':
        return {
          label: 'P2P Deposit',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400',
          icon: <ArrowDownLeft size={16} />
        };
      case 'withdraw_crypto':
        return {
          label: 'Crypto Withdrawal',
          isCredit: false,
          colorClass: isLightTheme ? 'text-red-700 font-extrabold' : 'text-red-400',
          bgClass: isLightTheme ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-500/10 border-red-500/15 text-red-400',
          icon: <ArrowUpRight size={16} />
        };
      case 'withdraw_p2p':
        return {
          label: 'P2P Withdrawal',
          isCredit: false,
          colorClass: isLightTheme ? 'text-red-700 font-extrabold' : 'text-red-400',
          bgClass: isLightTheme ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-500/10 border-red-500/15 text-red-400',
          icon: <ArrowUpRight size={16} />
        };
      case 'buy_crypto':
        return {
          label: 'Buy Crypto',
          isCredit: false, // spending USD to buy crypto
          colorClass: isLightTheme ? 'text-amber-700 font-extrabold' : 'text-[#60a5fa]',
          bgClass: isLightTheme ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-blue-500/10 border-blue-500/15 text-[#60a5fa]',
          icon: <ArrowDownLeft size={16} />
        };
      case 'sell_crypto':
        return {
          label: 'Sell Crypto',
          isCredit: true, // receiving USD from crypto sell
          colorClass: isLightTheme ? 'text-amber-600 font-extrabold' : 'text-amber-400',
          bgClass: isLightTheme ? 'bg-amber-50 border border-amber-200 text-amber-650' : 'bg-amber-500/10 border-amber-500/15 text-amber-400',
          icon: <ArrowUpRight size={16} />
        };
      case 'swap_crypto':
        return {
          label: 'Swap & Convert',
          isCredit: null, // neutral / structural swap
          colorClass: isLightTheme ? 'text-purple-700 font-extrabold' : 'text-[#a78bfa]', // purple-400
          bgClass: isLightTheme ? 'bg-purple-50 border border-purple-200 text-purple-750' : 'bg-purple-500/10 border-purple-500/15 text-[#a78bfa]',
          icon: <ArrowRightLeft size={16} />
        };
      case 'invested':
        return {
          label: 'Trade Signal',
          isCredit: false,
          colorClass: isLightTheme ? 'text-amber-600 font-extrabold' : 'text-amber-500',
          bgClass: isLightTheme ? 'bg-amber-50 border border-amber-200 text-amber-600' : 'bg-amber-500/10 border-amber-500/15 text-amber-500',
          icon: <TrendingUp size={16} />
        };
      case 'investment_earning':
        return {
          label: 'Signal Earning',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 border border-emerald-200 text-emerald-750' : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400',
          icon: <TrendingUp size={16} />
        };
      case 'copy_trade_payout':
        return {
          label: 'Copy Trade Payout',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400',
          icon: <TrendingUp size={16} />
        };
      case 'copy_trade_upgrade':
        return {
          label: tx?.title || 'Expert Contract Upgrade',
          isCredit: null,
          colorClass: isLightTheme ? 'text-amber-700 font-extrabold' : 'text-amber-400',
          bgClass: isLightTheme ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-amber-500/10 border-amber-500/15 text-amber-400',
          icon: <Sparkles size={16} />
        };
      case 'trade_balance_transfer_in':
      case 'copy_trade_transfer_in':
        return {
          label: 'Copy Trade Transfer In',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400',
          icon: <ArrowRightLeft size={16} />
        };
      case 'trade_balance_transfer_out':
      case 'copy_trade_transfer_out':
        return {
          label: 'Copy Trade Transfer Out',
          isCredit: false,
          colorClass: isLightTheme ? 'text-amber-700 font-extrabold' : 'text-amber-400',
          bgClass: isLightTheme ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-amber-500/10 border-amber-500/15 text-amber-400',
          icon: <ArrowRightLeft size={16} />
        };
      case 'internal_send':
        return {
          label: 'Internal Send',
          isCredit: false,
          colorClass: isLightTheme ? 'text-amber-700 font-extrabold' : 'text-amber-400',
          bgClass: isLightTheme ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-amber-500/10 border-amber-500/15 text-amber-400',
          icon: <Send size={16} />
        };
      case 'internal_receive':
        return {
          label: 'Internal Receive',
          isCredit: true,
          colorClass: isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400',
          bgClass: isLightTheme ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400',
          icon: <Send size={16} />
        };
      default: {
        const isVoucherType = (type && (type.toLowerCase().includes('voucher') || type.toLowerCase().includes('promo'))) || 
                              (tx?.title && (tx.title.toLowerCase().includes('voucher') || tx.title.toLowerCase().includes('promo')));
        if (isVoucherType) {
          return {
            label: tx?.title || 'Voucher Reward',
            isCredit: true,
            colorClass: isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400',
            bgClass: isLightTheme ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-amber-500/10 border-amber-500/15 text-amber-400',
            icon: <Gift size={16} />
          };
        }

        const isBotType = (type && type.toLowerCase().includes('bot')) || (tx?.title && tx.title.toLowerCase().includes('bot'));
        if (isBotType) {
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
              ? (isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400')
              : (isLightTheme ? 'text-amber-700 font-extrabold' : 'text-amber-400'),
            bgClass: isBotCredit
              ? (isLightTheme ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400')
              : (isLightTheme ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-amber-500/10 border-amber-500/15 text-amber-400'),
            icon: <Bot size={16} />
          };
        }

        const isUpgradeType = (type && (type.includes('upgrade') || type.includes('rollover'))) ||
                              (tx?.title && (tx.title.toLowerCase().includes('upgrade') || tx.title.toLowerCase().includes('rollover'))) ||
                              (tx?.paymentMessage && (tx.paymentMessage.toLowerCase().includes('upgraded copy') || tx.paymentMessage.toLowerCase().includes('rolled over')));
        if (isUpgradeType) {
          return {
            label: tx?.title || 'Expert Contract Upgrade',
            isCredit: null,
            colorClass: isLightTheme ? 'text-amber-700 font-extrabold' : 'text-amber-400',
            bgClass: isLightTheme ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-amber-500/10 border-amber-500/15 text-amber-400',
            icon: <Sparkles size={16} />
          };
        }

        const isCredit = tx?.isCredit === true || type.startsWith('deposit') || type.includes('reward') || type.includes('bonus');
        const isDeposit = type.startsWith('deposit');
        return {
          label: isDeposit ? 'Deposit' : (isCredit ? 'Credit' : 'Withdrawal'),
          isCredit: isCredit,
          colorClass: isCredit 
            ? (isLightTheme ? 'text-emerald-700 font-extrabold' : 'text-emerald-400') 
            : (isLightTheme ? 'text-red-700 font-extrabold' : 'text-red-400'),
          bgClass: isCredit 
            ? (isLightTheme ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400') 
            : (isLightTheme ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-500/10 border-red-500/15 text-red-400'),
          icon: isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />
        };
      }
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

  return (
    <div id="activity-log-container" className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 select-none">
        <div className="flex items-center gap-2">
          <ListFilter size={16} className={isLightTheme ? 'text-amber-500' : 'text-emerald-400'} />
          <h3 className={`text-xs font-black uppercase tracking-wider ${isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}`}>Transaction Activity Log</h3>
        </div>
        
        {/* Custom Dropdown */}
        <div id="custom-dropdown-container" className="relative shrink-0 z-50">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full sm:w-auto flex items-center justify-between gap-3 pl-8.5 pr-4 py-2 text-[10px] font-black uppercase border rounded-xl focus:outline-none transition-all min-w-[170px] cursor-pointer ${
              isLightTheme 
                ? 'bg-white border-zinc-200 text-zinc-700 hover:text-amber-650 hover:border-amber-300 focus:ring-1 focus:ring-amber-500/30' 
                : 'bg-slate-950 border-slate-850 text-zinc-300 hover:text-emerald-400 hover:border-slate-750 focus:ring-1 focus:ring-emerald-500/30'
            }`}
          >
            <Filter size={11} className="absolute left-3.5 text-zinc-400" />
            <span>
              {FILTER_OPTIONS.find(opt => opt.value === filter)?.label || 'All Transactions'}
            </span>
            <ChevronDown 
              size={11} 
              className={`text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-400' : ''}`} 
            />
          </button>

          {isOpen && (
            <div className={`absolute right-0 mt-1.5 w-full sm:w-[170px] border rounded-xl shadow-xl overflow-hidden divide-y animate-fade-in ${
              isLightTheme ? 'bg-white border-zinc-200 divide-zinc-100' : 'bg-slate-950 border-slate-850 divide-slate-900/60'
            }`}>
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setFilter(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-[10px] font-black uppercase transition-all flex items-center justify-between cursor-pointer ${
                    filter === opt.value
                      ? (isLightTheme ? 'bg-amber-50 text-amber-600 font-extrabold' : 'bg-slate-900/80 text-emerald-400 font-extrabold')
                      : (isLightTheme ? 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800' : 'text-zinc-400 hover:bg-slate-900 hover:text-zinc-200')
                  }`}
                >
                  <span>{opt.label}</span>
                  {filter === opt.value && (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLightTheme ? 'bg-amber-500' : 'bg-emerald-400'}`} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className={`border rounded-2xl overflow-hidden divide-y ${
        isLightTheme 
          ? 'bg-white border-zinc-200/80 divide-zinc-100 shadow-sm' 
          : 'bg-slate-800/60 border-slate-750 divide-slate-800'
      }`}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 select-none">
            <RefreshCw size={20} className={`${isLightTheme ? 'text-amber-500' : 'text-emerald-500'} animate-spin`} />
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Retrieving transaction logs...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-400 text-xs font-semibold select-none">
            {error}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center select-none flex flex-col items-center justify-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isLightTheme ? 'bg-zinc-50 text-zinc-400 border-zinc-200' : 'bg-slate-950 text-zinc-500 border-slate-850'
            }`}>
              <Calendar size={16} />
            </div>
            <p className="text-xs text-zinc-500 font-semibold mt-1">No transaction activity found</p>
            <p className="text-[10px] text-zinc-600 max-w-[240px] mx-auto leading-relaxed">
              Your transactions will appear here as soon as they are recorded or processed.
            </p>
          </div>
        ) : (
          filteredTransactions.map(tx => {
            const info = getTxTypeInfo(tx.type, tx);
            const isExpanded = expandedId === tx.id;

            return (
              <div 
                key={tx.id}
                id={`activity-log-item-${tx.id}`}
                className={`transition-all ${
                  isLightTheme ? 'hover:bg-zinc-50/50' : 'hover:bg-slate-800/40'
                }`}
              >
                {/* Summary Row */}
                <div 
                  onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                  className="flex justify-between items-center p-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${info.bgClass}`}>
                      {info.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-extrabold text-xs ${isLightTheme ? 'text-zinc-800' : 'text-zinc-200'}`}>
                          {info.label}
                        </span>
                        <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${getStatusBadgeClass(tx.status)}`}>
                          {tx.status}
                        </span>
                      </div>
                      <span className="text-[9px] text-zinc-500 font-semibold block mt-1 font-mono">
                        {formatDate(tx.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="text-right">
                      <span className={`text-xs font-black font-mono ${info.colorClass}`}>
                        {info.isCredit === true ? '+' : info.isCredit === false ? '-' : ''}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {tx.localAmount && (
                        <span className="block text-[9px] font-bold text-zinc-500 font-mono mt-0.5">
                          {tx.localAmount.toLocaleString()} Shs
                        </span>
                      )}
                    </div>
                    <div className="text-zinc-500">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className={`px-4 pb-4 pt-1 text-[10px] space-y-2 border-t select-all animate-fade-in ${
                    isLightTheme ? 'bg-zinc-50/50 border-zinc-100' : 'bg-slate-950/50 border-slate-900/40'
                  }`}>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 py-1.5">
                      <div>
                        <span className={`${isLightTheme ? 'text-zinc-400' : 'text-zinc-600'} font-bold block uppercase tracking-wider text-[8px]`}>Transaction ID</span>
                        <span className={`font-mono font-medium ${isLightTheme ? 'text-zinc-600' : 'text-zinc-300'}`}>{tx.id}</span>
                      </div>
                      <div>
                        <span className={`${isLightTheme ? 'text-zinc-400' : 'text-zinc-600'} font-bold block uppercase tracking-wider text-[8px]`}>Method / Type</span>
                        <span className={`font-semibold capitalize ${isLightTheme ? 'text-zinc-600' : 'text-zinc-300'}`}>
                          {tx.type === 'copy_trade_upgrade' ? 'Expert Contract Upgrade' : tx.type.split('_').join(' ')}
                        </span>
                      </div>
                      {tx.network && (
                        <div>
                          <span className={`${isLightTheme ? 'text-zinc-400' : 'text-zinc-600'} font-bold block uppercase tracking-wider text-[8px]`}>Blockchain Network</span>
                          <span className={`font-extrabold font-mono ${isLightTheme ? 'text-zinc-600' : 'text-zinc-300'}`}>{tx.network}</span>
                        </div>
                      )}
                      {tx.address && (
                        <div>
                          <span className={`${isLightTheme ? 'text-zinc-400' : 'text-zinc-600'} font-bold block uppercase tracking-wider text-[8px]`}>Destination Address</span>
                          <span className={`font-semibold font-mono break-all ${isLightTheme ? 'text-zinc-600' : 'text-zinc-300'}`}>{tx.address}</span>
                        </div>
                      )}
                      {tx.merchantName && (
                        <div>
                          <span className={`${isLightTheme ? 'text-zinc-400' : 'text-zinc-600'} font-bold block uppercase tracking-wider text-[8px]`}>
                            {tx.type === 'deposit_p2p' || tx.type === 'withdraw_p2p' ? 'P2P Merchant' : 'Crypto Asset'}
                          </span>
                          <span className={`font-bold ${isLightTheme ? 'text-zinc-700' : 'text-zinc-300'}`}>{tx.merchantName}</span>
                        </div>
                      )}
                      {tx.paymentMessage && (
                        <div className="col-span-2 mt-1">
                          <span className={`${isLightTheme ? 'text-zinc-400' : 'text-zinc-600'} font-bold block uppercase tracking-wider text-[8px]`}>Payment Information / Notes</span>
                          <p className={`font-medium leading-relaxed p-2 rounded-lg border mt-1 ${
                            isLightTheme ? 'bg-white border-zinc-200/80 text-zinc-600' : 'bg-slate-900/80 border-slate-800/40 text-zinc-300'
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
