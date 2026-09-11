export interface UserAccount {
  uid: string;
  email: string;
  displayName?: string;
  phone?: string;
  country?: string;
  balance: number; // in USD
  usdtBalance?: number;
  tradeBalance?: number;
  lockedCopyTradeCapital?: number; // Capital locked in copy trade contracts
  referralSource?: string;
  uniqueCode?: string;
  hasMadeFirstDeposit?: boolean;
  extraSignalPassUntil?: any; // Firestore Timestamp / ISO Date for referral-earned 24h bonus extra signal passes
  createdAt: any; // Firestore Timestamp
  withdrawalEnabled: boolean;
  walletPassword?: string;
  holdings?: Record<string, number>;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  bep20WithdrawalAddress?: string;
  bep20AddressBoundAt?: any;
  withdrawalAddressVerified?: boolean;
}

export type TransactionType = 
  | 'deposit_crypto' 
  | 'deposit_p2p' 
  | 'withdraw_crypto' 
  | 'withdraw_p2p' 
  | 'buy_crypto' 
  | 'sell_crypto' 
  | 'swap_crypto' 
  | 'referral_reward' 
  | 'first_deposit_commission'
  | 'welcome_bonus'
  | 'voucher_reward'
  | 'invested' 
  | 'investment_earning' 
  | 'internal_send' 
  | 'internal_receive'
  | 'copy_trade_payout'
  | 'copy_trade_upgrade';

export interface DepositBonusTier {
  id: string;
  minAmount: number;
  maxAmount: number;
  referrerPercent: number;
  refereePercent: number;
}

export interface ReferralDepositConfig {
  enabled: boolean;
  minDepositThresholdUSD: number; // e.g. 10 USD
  tiers?: DepositBonusTier[];
}

export type TransactionStatus = 'PENDING APPROVAL' | 'APPROVED' | 'DECLINED';

export interface Transaction {
  id: string;
  userId: string;
  userEmail: string;
  type: TransactionType;
  title?: string;
  amount: number; // in USD
  localAmount?: number; // in shillings/local currency
  status: TransactionStatus;
  createdAt: any; // Firestore Timestamp
  evidence?: string; // base64 string or url
  paymentMessage?: string; // payment confirmation message text
  network?: string; // TRC20, ERC20, etc.
  address?: string; // destination wallet address or merchant details
  merchantName?: string;
  coinSymbol?: string; // for MMF or specific coin transactions
  coinAmount?: number; // for MMF or specific coin transactions
  feePercent?: number; // e.g. 15 or 50
  feeAmount?: number;  // fee in USD (e.g. 15% standard or 50% early)
  netAmount?: number;  // amount user actually receives (e.g. 85% or 50%)
  isCredit?: boolean | null;
  aiAudit?: {
    isValid: boolean;
    confidence: number;
    reasons: string;
    extractedAmount: number | null;
    extractedSymbol: string | null;
    extractedTxHash: string | null;
    extractedNetwork: string | null;
  } | null;
}

export interface CryptoNetwork {
  id: string;
  tokenName: string; // e.g. "USDT", "BTC", "ETH"
  networks: string[]; // e.g. ["TRC20", "ERC20"]
  addresses: Record<string, string>; // e.g. {"TRC20": "TY...", "ERC20": "0x..."}
  minWithdrawalUSD?: number; // Minimum withdrawal amount in USD set by Admin
}

export interface P2PMerchant {
  id: string;
  name: string;
  paymentNumber: string;
  rating: number; // e.g. 4.9
  providers: string[]; // e.g. ["M-Pesa", "Airtel Money"]
  rate: number; // exchange rate (e.g. 130 shillings per USD)
  type: 'buy' | 'sell' | 'both';
  minLimit?: number; // Minimum transaction limit in Shillings
  maxLimit?: number; // Maximum transaction limit in Shillings
}

export interface CryptoPrice {
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  mode?: 'live' | 'custom';
  lastSyncedAt?: string;
  investmentRate?: number; // Daily MMF / Signal investment rate in %
  minInvestment?: number; // Minimum amount that can be invested
  winRate?: number; // Signal Win Rate in % e.g. 98.5
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  image: string;
}

export interface ArbitrageConfig {
  coin1Symbol: string;
  coin1ExternalMin: number;
  coin1ExternalMax: number;
  coin1UseLiveOffset: boolean;
  coin1OffsetPercentage: number;
  coin2Symbol: string;
  coin2ExternalMin: number;
  coin2ExternalMax: number;
  coin2UseLiveOffset: boolean;
  coin2OffsetPercentage: number;
  platformsList: string[]; // platforms like ["Binance", "Bybit", "OKX", "Coinbase"]
}

export interface BotTemplate {
  id: string;
  name: string;
  category: string;
  description?: string;
  winRatioRange: string;
  winProfitRange?: string;
  lossPercentRange?: string;
  minCapital: number;
  dailyRoi?: string;
  tradingPairs: string[];
  riskLevel: string;
  color?: string;
}

export interface UserBot {
  id: string;
  userId: string;
  userEmail: string;
  templateId: string;
  name: string;
  category: string;
  capital: number;
  coinSymbol: string;
  tradingPair: string;
  tradeDurationSec: number;
  accruedProfit: number;
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  dailyRoi: string;
  winRatioRange: string;
  winProfitRange?: string;
  lossPercentRange?: string;
  wins: number;
  totalTrades: number;
  losses: number;
  createdAt: any;
}

export interface SignalSchedule {
  id: string;
  time: string; // e.g. "13:00" or "1:00 PM"
  code: string; // e.g. "SIG1300"
  isExtra?: boolean;
  profitRate?: number; // standalone profit rate for extra signal (e.g. 3.5%)
  label?: string; // optional label e.g. "VIP Bonus Signal"
}

export interface CopyTraderLead {
  id: string;
  name: string;
  photoUrl: string;
  description: string;
  signalsPerDay: string; // e.g. "2 signals/day"
  winRate?: string; // e.g. "98.4%"
  copiersCount?: number;
  minCapital?: number; // e.g. 50
  maxCapital?: number; // e.g. 10000
  analysisCommission?: number; // % e.g. 10
  dayProfitRate?: number; // % e.g. 2.0 (split equally across regular daily signals)
  displayProfitRange?: string; // e.g. "2% - 6%" (custom editable display range shown to users on front-end)
  contractDurationDays?: number; // e.g. 30 (excluding Sundays)
  tradingPairs?: string[]; // e.g. ["BTC/USDT", "ETH/USDT", "SOL/USDT"]
  signals?: SignalSchedule[]; // list of regular signals per day with time and code
  extraSignals?: SignalSchedule[]; // standalone extra signals with their own profit rates
  riskLevel?: string; // e.g. "Low Risk", "Moderate", "High"
  createdAt?: any;
  updatedAt?: any;
}

export interface UserCopyTrade {
  id: string;
  userId: string;
  userEmail: string;
  leadId: string;
  leadName: string;
  leadPhotoUrl?: string;
  tradingPair: string;
  amount: number;
  signalCode: string;
  signalTime: string;
  grossProfit: number;
  commissionDeducted: number;
  netProfit: number;
  status: 'COMPLETED' | 'ACTIVE' | 'EXPIRED' | 'UPGRADED';
  contractCapital?: number;
  contractStartDate?: any;
  originalContractStartDate?: any;
  welcomeBoostInitialDate?: any;
  contractDurationDays?: number;
  upgradedToLeadId?: string;
  upgradedToLeadName?: string;
  upgradedFromTradeId?: string;
  rolledOverCapital?: number;
  executedSignals?: { 
    code: string; 
    time: string; 
    netProfit?: number; 
    grossProfit?: number;
    commissionCut?: number;
    amount?: number;
    tradingPair?: string;
    entryPrice?: string;
    exitPrice?: string;
    executedAt: any 
  }[];
  createdAt: any;
  updatedAt?: any;
}

export type PromoCodeRewardType = 'CASH_BONUS' | 'TRADE_CAPITAL' | 'EXTRA_SIGNAL_PASS' | 'PERCENT_DEPOSIT_BOOST';

export interface PromoCode {
  id: string;
  code: string; // e.g. "WELCOME20", uppercase
  title: string; // e.g. "Welcome $20 Cash Voucher"
  description?: string;
  type: PromoCodeRewardType;
  rewardValue: number; // USD amount for CASH_BONUS/TRADE_CAPITAL, or Hours for EXTRA_SIGNAL_PASS (e.g. 24, 48)
  minDepositRequirement?: number; // USD requirement before claiming, e.g. 0 or 10
  maxRedemptions?: number; // total max global claims (0 or undefined = unlimited)
  redemptionCount: number; // total times redeemed so far
  currentRedemptions?: number;
  claimedBy?: string[]; // array of user uids who have claimed this voucher
  expiresAt?: any; // Firestore Timestamp or ISO string
  isActive: boolean;
  createdAt: any;
  updatedAt?: any;
}

export interface VoucherClaim {
  id: string;
  userId: string;
  userEmail: string;
  promoCodeId: string;
  code: string;
  title: string;
  type: PromoCodeRewardType;
  rewardValue: number;
  rewardText: string;
  claimedAt: any;
}

export type AdPlacement = 'CAROUSEL' | 'POPUP' | 'BANNER';
export type AdActionType = 'DEPOSIT' | 'EARN' | 'REFERRALS' | 'VOUCHERS' | 'LEADERBOARD' | 'BOT_TRADING' | 'EXTERNAL_LINK';

export interface InAppAd {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  badgeText?: string; // e.g. "HOT 🔥", "BONUS 💰", "VIP 🚀"
  badgeColor?: string; // e.g. "amber", "emerald", "purple", "blue"
  bgGradient?: string; // e.g. "from-amber-600 via-amber-700 to-yellow-800"
  imageUrl?: string;
  iconName?: string; // Lucide icon key
  actionType: AdActionType;
  actionUrl?: string; // Used when actionType is EXTERNAL_LINK
  ctaText: string; // e.g. "Deposit Now", "Explore VIP Traders", "Invite Friends"
  placement: AdPlacement; // CAROUSEL | POPUP | BANNER
  priority: number; // 1 = top priority
  isActive: boolean;
  startDate?: any;
  endDate?: any;
  targetAudience?: 'ALL' | 'NEW_USERS' | 'NO_ACTIVE_CONTRACT';
  clickCount?: number;
  viewCount?: number;
  createdAt?: any;
  updatedAt?: any;
}
