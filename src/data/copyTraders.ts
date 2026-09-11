import { CopyTraderLead } from '../types';

/**
 * Formats an expert lead's daily profit rate as an attractive, encouraging rate range for user front-end displays (e.g. "2% - 6%").
 * If the lead has a custom `displayProfitRange` set by the admin, that is used directly.
 * The underlying backend rate is maintained unchanged for actual trade signal calculations.
 */
export function getLeadDailyProfitRange(leadOrRate?: CopyTraderLead | number | null, customRange?: string): string {
  if (typeof leadOrRate === 'object' && leadOrRate !== null) {
    if (leadOrRate.displayProfitRange && leadOrRate.displayProfitRange.trim()) {
      return leadOrRate.displayProfitRange.trim();
    }
    return computeDefaultDailyRange(leadOrRate.dayProfitRate);
  }
  if (customRange && customRange.trim()) {
    return customRange.trim();
  }
  return computeDefaultDailyRange(typeof leadOrRate === 'number' ? leadOrRate : undefined);
}

function computeDefaultDailyRange(rate?: number): string {
  const base = Number(rate ?? 2.0);
  
  if (base >= 1.9 && base <= 2.1) {
    return '2% - 6%';
  }
  if (base >= 2.3 && base <= 2.5) {
    return '2.5% - 6.5%';
  }
  if (base >= 1.7 && base <= 1.85) {
    return '1.8% - 5.5%';
  }
  if (base >= 2.15 && base <= 2.25) {
    return '2.2% - 6.2%';
  }
  
  // Dynamic calculation for any custom rate set by admin
  const minRate = Number(base.toFixed(1));
  const maxRate = Number(Math.max(base * 2.8, base + 3).toFixed(1));
  const minStr = Number.isInteger(minRate) ? `${minRate}%` : `${minRate}%`;
  const maxStr = Number.isInteger(maxRate) ? `${maxRate}%` : `${maxRate}%`;
  return `${minStr} - ${maxStr}`;
}

/**
 * Formats the profit range for individual regular signals based on the daily range split across regular daily signals.
 * e.g., for 2% - 6% daily across 2 signals -> "1% - 3%"
 */
export function getLeadSignalProfitRange(leadOrRate?: CopyTraderLead | number | null, signalCount: number = 2): string {
  let displayRange: string | undefined;
  let baseRate: number | undefined;

  if (typeof leadOrRate === 'object' && leadOrRate !== null) {
    displayRange = leadOrRate.displayProfitRange;
    baseRate = leadOrRate.dayProfitRate;
  } else if (typeof leadOrRate === 'number') {
    baseRate = leadOrRate;
  }

  const count = Math.max(1, signalCount);

  // If there's an explicit custom range like "2% - 6%", parse and split proportionally across regular signals
  if (displayRange && displayRange.trim()) {
    const match = displayRange.match(/([0-9]+(?:\.[0-9]+)?)\s*%\s*-\s*([0-9]+(?:\.[0-9]+)?)\s*%/);
    if (match) {
      const minVal = parseFloat(match[1]);
      const maxVal = parseFloat(match[2]);
      if (!isNaN(minVal) && !isNaN(maxVal)) {
        const minPerSig = Number((minVal / count).toFixed(1));
        const maxPerSig = Number((maxVal / count).toFixed(1));
        return `${minPerSig}% - ${maxPerSig}%`;
      }
    }
    return displayRange.trim();
  }

  const base = Number(baseRate ?? 2.0);
  
  if (base >= 1.9 && base <= 2.1 && count === 2) {
    return '1% - 3%';
  }
  if (base >= 2.3 && base <= 2.5 && count === 2) {
    return '1.2% - 3.2%';
  }
  if (base >= 1.7 && base <= 1.85 && count === 2) {
    return '0.9% - 2.8%';
  }
  if (base >= 2.15 && base <= 2.25 && count === 2) {
    return '1.1% - 3.1%';
  }
  
  // Dynamic calculation for any custom rate
  const minPerSig = Number((base / count).toFixed(1));
  const maxPerSig = Number((Math.max(base * 2.8, base + 3) / count).toFixed(1));
  return `${minPerSig}% - ${maxPerSig}%`;
}

export const DEFAULT_COPY_LEADS: CopyTraderLead[] = [
  {
    id: 'lead-alex-rivers',
    name: 'Alex "Apex" Rivers',
    photoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&crop=face&w=160&h=160&q=75&fm=webp',
    description: 'Senior Quantitative Forex & Crypto Trader with 12+ years of market experience. Specializes in BTC/ETH algorithmic momentum and risk-managed break-outs.',
    signalsPerDay: '2 signals/day',
    winRate: '98.4%',
    copiersCount: 1420,
    minCapital: 50,
    maxCapital: 10000,
    analysisCommission: 10,
    dayProfitRate: 2.0,
    displayProfitRange: '2% - 6%',
    contractDurationDays: 30,
    tradingPairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT'],
    signals: [
      { id: 'sig-1', time: '13:00', code: 'SIG1300' },
      { id: 'sig-2', time: '20:00', code: 'SIG2000' }
    ],
    riskLevel: 'Low Risk'
  },
  {
    id: 'lead-elena-rostova',
    name: 'Elena Rostova',
    photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&crop=face&w=160&h=160&q=75&fm=webp',
    description: 'Former Wall Street Macro Strategist focusing on swing trading and multi-asset arbitrage across top cryptocurrencies.',
    signalsPerDay: '2 signals/day',
    winRate: '96.8%',
    copiersCount: 980,
    minCapital: 100,
    maxCapital: 15000,
    analysisCommission: 12,
    dayProfitRate: 2.4,
    displayProfitRange: '2.5% - 6.5%',
    contractDurationDays: 30,
    tradingPairs: ['ETH/USDT', 'BTC/USDT', 'BNB/USDT', 'SOL/USDT'],
    signals: [
      { id: 'sig-1', time: '12:00', code: 'ELENA12' },
      { id: 'sig-2', time: '18:00', code: 'ELENA18' }
    ],
    riskLevel: 'Moderate'
  },
  {
    id: 'lead-david-chen',
    name: 'David Chen (Quantum Trading)',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&crop=face&w=160&h=160&q=75&fm=webp',
    description: 'High-frequency intraday scalper leveraging custom proprietary indicators for rapid intraday profit capture.',
    signalsPerDay: '2 signals/day',
    winRate: '94.5%',
    copiersCount: 2150,
    minCapital: 50,
    maxCapital: 8000,
    analysisCommission: 8,
    dayProfitRate: 1.8,
    displayProfitRange: '1.8% - 5.5%',
    contractDurationDays: 30,
    tradingPairs: ['BTC/USDT', 'SOL/USDT', 'DOGE/USDT', 'XRP/USDT'],
    signals: [
      { id: 'sig-1', time: '11:00', code: 'CHEN1100' },
      { id: 'sig-2', time: '19:00', code: 'CHEN1900' }
    ],
    riskLevel: 'Low Risk'
  },
  {
    id: 'lead-sarah-jenkins',
    name: 'Sarah Jenkins',
    photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&crop=face&w=160&h=160&q=75&fm=webp',
    description: 'Risk-first DeFi and Spot position trader with a disciplined 1:3 risk-reward ratio strategy.',
    signalsPerDay: '2 signals/day',
    winRate: '97.2%',
    copiersCount: 860,
    minCapital: 100,
    maxCapital: 12000,
    analysisCommission: 10,
    dayProfitRate: 2.2,
    displayProfitRange: '2.2% - 6.2%',
    contractDurationDays: 30,
    tradingPairs: ['BTC/USDT', 'ETH/USDT', 'USDC/USDT', 'SOL/USDT'],
    signals: [
      { id: 'sig-1', time: '14:00', code: 'SARAH14' },
      { id: 'sig-2', time: '21:00', code: 'SARAH21' }
    ],
    riskLevel: 'Low Risk'
  }
];
