import React from 'react';

export interface PairConfig {
  code: string;
  displayCode: string;
  symbol: string;
  name: string;
  assetType: string;
  lightBg: string;
  lightBorder: string;
  lightText: string;
  darkBg: string;
  darkBorder: string;
  darkText: string;
  pillAccent: string;
  gradient: string;
}

export const DEFAULT_BOT_TRADING_PAIRS = ['XAU/USD', 'BTC/USDT', 'EUR/USD'];

export function getTradingPairConfig(pairRaw?: string): PairConfig {
  const raw = (pairRaw || 'XAU/USD').trim();
  const clean = raw.replace(/[^A-Za-z]/g, '').toUpperCase();

  if (clean.includes('XAU') || clean.includes('GOLD')) {
    return {
      code: 'XAU/USD',
      displayCode: 'XAU/USD',
      symbol: '🥇',
      name: 'Gold',
      assetType: 'Commodity',
      lightBg: 'bg-yellow-100/90',
      lightBorder: 'border-yellow-400',
      lightText: 'text-yellow-950',
      darkBg: 'bg-yellow-500/20',
      darkBorder: 'border-yellow-500/40',
      darkText: 'text-yellow-300',
      pillAccent: 'bg-yellow-500 text-amber-950 font-black',
      gradient: 'from-amber-500 via-yellow-400 to-amber-500'
    };
  } else if (clean.includes('EUR')) {
    return {
      code: 'EUR/USD',
      displayCode: 'EUR/USD',
      symbol: '€',
      name: 'Euro',
      assetType: 'Forex',
      lightBg: 'bg-blue-100/90',
      lightBorder: 'border-blue-300',
      lightText: 'text-blue-950',
      darkBg: 'bg-blue-500/20',
      darkBorder: 'border-blue-500/40',
      darkText: 'text-blue-300',
      pillAccent: 'bg-blue-600 text-white font-black',
      gradient: 'from-blue-600 via-indigo-500 to-blue-500'
    };
  } else if (clean.includes('BTC') || clean.includes('BITCOIN')) {
    const disp = raw.includes('/') ? raw : (clean.includes('USDT') ? 'BTC/USDT' : 'BTC/USD');
    return {
      code: disp,
      displayCode: disp,
      symbol: '₿',
      name: 'Bitcoin',
      assetType: 'Crypto',
      lightBg: 'bg-amber-100/90',
      lightBorder: 'border-amber-300',
      lightText: 'text-amber-950',
      darkBg: 'bg-orange-500/20',
      darkBorder: 'border-orange-500/40',
      darkText: 'text-orange-300',
      pillAccent: 'bg-orange-500 text-white font-black',
      gradient: 'from-orange-500 via-amber-400 to-yellow-500'
    };
  } else if (clean.includes('ETH') || clean.includes('ETHEREUM')) {
    const disp = raw.includes('/') ? raw : (clean.includes('USDT') ? 'ETH/USDT' : 'ETH/USD');
    return {
      code: disp,
      displayCode: disp,
      symbol: 'Ξ',
      name: 'Ethereum',
      assetType: 'Crypto',
      lightBg: 'bg-purple-100/90',
      lightBorder: 'border-purple-300',
      lightText: 'text-purple-950',
      darkBg: 'bg-purple-500/20',
      darkBorder: 'border-purple-500/40',
      darkText: 'text-purple-300',
      pillAccent: 'bg-purple-600 text-white font-black',
      gradient: 'from-purple-600 via-indigo-500 to-purple-500'
    };
  } else if (clean.includes('SOL') || clean.includes('SOLANA')) {
    const disp = raw.includes('/') ? raw : (clean.includes('USDT') ? 'SOL/USDT' : 'SOL/USD');
    return {
      code: disp,
      displayCode: disp,
      symbol: '◎',
      name: 'Solana',
      assetType: 'Crypto',
      lightBg: 'bg-emerald-100/90',
      lightBorder: 'border-emerald-300',
      lightText: 'text-emerald-950',
      darkBg: 'bg-emerald-500/20',
      darkBorder: 'border-emerald-500/40',
      darkText: 'text-emerald-300',
      pillAccent: 'bg-emerald-500 text-white font-black',
      gradient: 'from-emerald-500 via-teal-400 to-cyan-500'
    };
  } else if (clean.includes('XRP') || clean.includes('RIPPLE')) {
    const disp = raw.includes('/') ? raw : (clean.includes('USDT') ? 'XRP/USDT' : 'XRP/USD');
    return {
      code: disp,
      displayCode: disp,
      symbol: '✕',
      name: 'Ripple',
      assetType: 'Crypto',
      lightBg: 'bg-cyan-100/90',
      lightBorder: 'border-cyan-300',
      lightText: 'text-cyan-950',
      darkBg: 'bg-cyan-500/20',
      darkBorder: 'border-cyan-500/40',
      darkText: 'text-cyan-300',
      pillAccent: 'bg-cyan-600 text-white font-black',
      gradient: 'from-cyan-500 to-blue-600'
    };
  } else if (clean.includes('BNB')) {
    const disp = raw.includes('/') ? raw : (clean.includes('USDT') ? 'BNB/USDT' : 'BNB/USD');
    return {
      code: disp,
      displayCode: disp,
      symbol: '❖',
      name: 'BNB',
      assetType: 'Crypto',
      lightBg: 'bg-yellow-100/90',
      lightBorder: 'border-yellow-300',
      lightText: 'text-yellow-950',
      darkBg: 'bg-yellow-500/20',
      darkBorder: 'border-yellow-500/40',
      darkText: 'text-yellow-300',
      pillAccent: 'bg-yellow-500 text-yellow-950 font-black',
      gradient: 'from-yellow-500 to-amber-500'
    };
  } else {
    // Dynamic fallback for any custom pair e.g. GBP/USD, ADA/USDT
    let disp = raw;
    if (!disp.includes('/') && disp.length >= 6) {
      if (disp.endsWith('USDT')) {
        disp = `${disp.replace('USDT', '')}/USDT`;
      } else if (disp.endsWith('USD')) {
        disp = `${disp.replace('USD', '')}/USD`;
      }
    }
    return {
      code: disp,
      displayCode: disp,
      symbol: '🪙',
      name: disp.split('/')[0] || disp,
      assetType: 'Asset',
      lightBg: 'bg-slate-100',
      lightBorder: 'border-slate-300',
      lightText: 'text-slate-900',
      darkBg: 'bg-slate-800/40',
      darkBorder: 'border-slate-700',
      darkText: 'text-slate-200',
      pillAccent: 'bg-slate-600 text-white font-black',
      gradient: 'from-slate-500 to-zinc-600'
    };
  }
}

interface PairBadgeProps {
  pair: string;
  isLightTheme?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

export const TradingPairBadge: React.FC<PairBadgeProps> = ({
  pair,
  isLightTheme = false,
  size = 'md',
  showName = false
}) => {
  const cfg = getTradingPairConfig(pair);
  
  const sizeClasses = {
    sm: 'px-2.5 py-1 text-[11px] gap-1.5 rounded-full border shadow-2xs',
    md: 'px-3 py-1 text-xs gap-1.5 rounded-full border shadow-2xs',
    lg: 'px-3.5 py-1.5 text-sm gap-2 rounded-full border shadow-xs'
  }[size];

  const iconSizeClasses = {
    sm: 'text-[11px]',
    md: 'text-xs sm:text-sm',
    lg: 'text-base'
  }[size];

  return (
    <span className={`inline-flex items-center font-mono font-bold border transition-all select-none whitespace-nowrap ${sizeClasses} ${
      isLightTheme ? `${cfg.lightBg} ${cfg.lightBorder} ${cfg.lightText}` : `${cfg.darkBg} ${cfg.darkBorder} ${cfg.darkText}`
    }`}>
      <span className={`${iconSizeClasses} shrink-0`}>{cfg.symbol}</span>
      <span className="tracking-tight">{cfg.displayCode}</span>
      {showName && (
        <span className="font-sans font-medium text-[9px] opacity-75 ml-0.5 uppercase">
          ({cfg.name})
        </span>
      )}
    </span>
  );
};
