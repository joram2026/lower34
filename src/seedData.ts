import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';
import { CryptoNetwork, P2PMerchant, CryptoPrice } from './types';

export const DEFAULT_NETWORKS: CryptoNetwork[] = [
  {
    id: 'usdt',
    tokenName: 'Tether (USDT)',
    networks: ['TRC20', 'ERC20', 'BEP20'],
    addresses: {
      'TRC20': 'TY14A7QactqWXtFRCFrQzi5p8CJw3W8Qht',
      'ERC20': '0x126f67836EEA5760D599b158faA3A4510755bafD',
      'BEP20': '0x126f67836EEA5760D599b158faA3A4510755bafD'
    },
    minWithdrawalUSD: 40
  },
  {
    id: 'usdc',
    tokenName: 'USD Coin (USDC)',
    networks: ['ERC20', 'SOLANA', 'TRC20'],
    addresses: {
      'ERC20': '0x95F7a1b8D14E5D466f2C09C726f19DE6D178e24C',
      'SOLANA': 'EPjFW3dpCY3UF296M6ac3yvLCFM3TXrSM2tmc5M96fGP',
      'TRC20': 'THP5Y2Z7vT3uQ9vM5Zg7bX99f36r3qJvU8'
    },
    minWithdrawalUSD: 10
  },
  {
    id: 'btc',
    tokenName: 'Bitcoin (BTC)',
    networks: ['BTC', 'BEP20'],
    addresses: {
      'BTC': '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      'BEP20': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
    },
    minWithdrawalUSD: 20
  },
  {
    id: 'eth',
    tokenName: 'Ethereum (ETH)',
    networks: ['ERC20', 'BEP20'],
    addresses: {
      'ERC20': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      'BEP20': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
    },
    minWithdrawalUSD: 15
  },
  {
    id: 'xrp',
    tokenName: 'XRP (XRP)',
    networks: ['XRP'],
    addresses: {
      'XRP': 'rEb8TK3gBgWvdv8KAcrBgv1vt7gBpt7A8y'
    },
    minWithdrawalUSD: 10
  },
  {
    id: 'wld',
    tokenName: 'World Coin (WLD)',
    networks: ['OPTIMISM', 'ERC20'],
    addresses: {
      'OPTIMISM': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      'ERC20': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
    },
    minWithdrawalUSD: 10
  },
  {
    id: 'trx',
    tokenName: 'Tron (TRX)',
    networks: ['TRC20'],
    addresses: {
      'TRC20': 'TX8v9nJD7uErsFm2kU9vMQ7vGzB7bY93f4'
    },
    minWithdrawalUSD: 10
  },
  {
    id: 'doge',
    tokenName: 'DOGE Coin (DOGE)',
    networks: ['DOGE'],
    addresses: {
      'DOGE': 'DJpx5LhE4W8pksYV1QW9vQYy4W8pksYV1Q'
    },
    minWithdrawalUSD: 10
  },
  {
    id: 'sol',
    tokenName: 'Solana (SOL)',
    networks: ['SOLANA', 'BEP20'],
    addresses: {
      'SOLANA': 'EPjFW3dpCY3UF296M6ac3yvLCFM3TXrSM2tmc5M96fGP',
      'BEP20': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
    },
    minWithdrawalUSD: 10
  },
  {
    id: 'bnb',
    tokenName: 'Binance Coin (BNB)',
    networks: ['BEP20', 'BSC'],
    addresses: {
      'BEP20': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      'BSC': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
    },
    minWithdrawalUSD: 10
  }
];

export const DEFAULT_MERCHANTS: P2PMerchant[] = [
  {
    id: 'alpha-trades',
    name: 'Alpha P2P (M-Pesa)',
    paymentNumber: '+254 712 345 678',
    rating: 4.9,
    providers: ['M-Pesa', 'Airtel Money'],
    rate: 135.0, // 1 USD = 135 KES
    type: 'both',
    minLimit: 500,
    maxLimit: 500000
  },
  {
    id: 'uganda-escrow',
    name: 'Elgon Swift P2P',
    paymentNumber: '+256 782 111 222',
    rating: 4.8,
    providers: ['MTN Mobile Money', 'Airtel Money'],
    rate: 3750.0, // 1 USD = 3750 UGX
    type: 'both',
    minLimit: 10000,
    maxLimit: 10000000
  },
  {
    id: 'safaricom-pro',
    name: 'Safaricom Direct Merchant',
    paymentNumber: '+254 798 765 432',
    rating: 4.95,
    providers: ['M-Pesa'],
    rate: 134.50,
    type: 'both',
    minLimit: 1000,
    maxLimit: 300000
  }
];

const DEFAULT_CRYPTO_PRICES: CryptoPrice[] = [
  { name: 'Tether', symbol: 'USDT', price: 1.00, change24h: 0.01, investmentRate: 2.5, winRate: 99.2 },
  { name: 'USD Coin', symbol: 'USDC', price: 1.00, change24h: -0.02, investmentRate: 2.5, winRate: 99.1 },
  { name: 'Bitcoin', symbol: 'BTC', price: 94250.30, change24h: 3.45, investmentRate: 3.5, winRate: 97.8 },
  { name: 'Ethereum', symbol: 'ETH', price: 3480.12, change24h: 1.82, investmentRate: 4.0, winRate: 96.5 },
  { name: 'XRP', symbol: 'XRP', price: 2.54, change24h: 4.12, investmentRate: 3.0, winRate: 94.5 },
  { name: 'World Coin', symbol: 'WLD', price: 2.80, change24h: -1.25, investmentRate: 5.0, winRate: 93.8 },
  { name: 'Tron', symbol: 'TRX', price: 0.22, change24h: 0.45, investmentRate: 3.5, winRate: 95.2 },
  { name: 'DOGE Coin', symbol: 'DOGE', price: 0.38, change24h: 2.15, investmentRate: 7.0, winRate: 92.4 },
  { name: 'Solana', symbol: 'SOL', price: 184.45, change24h: -2.15, investmentRate: 6.0, winRate: 95.8 },
  { name: 'Binance Coin', symbol: 'BNB', price: 592.20, change24h: 0.95, investmentRate: 4.5, winRate: 96.2 }
];

export async function seedFirestoreIfNeeded() {
  try {
    // Seed Networks
    const networksCol = collection(db, 'crypto_networks');
    const networksSnap = await getDocs(networksCol);
    if (networksSnap.empty) {
      const batch = writeBatch(db);
      DEFAULT_NETWORKS.forEach((net) => {
        const docRef = doc(db, 'crypto_networks', net.id.toLowerCase());
        batch.set(docRef, {
          ...net,
          id: net.id.toLowerCase(),
          minWithdrawalUSD: typeof net.minWithdrawalUSD === 'number' ? net.minWithdrawalUSD : 10
        });
      });
      await batch.commit();
      console.log('Successfully seeded crypto_networks');
    }

    // Seed Merchants
    const merchantsCol = collection(db, 'p2p_merchants');
    const merchantsSnap = await getDocs(merchantsCol);
    if (merchantsSnap.empty) {
      const batch = writeBatch(db);
      DEFAULT_MERCHANTS.forEach((merch) => {
        const docRef = doc(db, 'p2p_merchants', merch.id);
        batch.set(docRef, merch);
      });
      await batch.commit();
      console.log('Successfully seeded p2p_merchants');
    }

    // Seed Crypto Prices
    const pricesCol = collection(db, 'crypto_prices');
    const pricesSnap = await getDocs(pricesCol);
    if (pricesSnap.empty) {
      const batch = writeBatch(db);
      DEFAULT_CRYPTO_PRICES.forEach((cp) => {
        const docRef = doc(db, 'crypto_prices', cp.symbol);
        batch.set(docRef, cp);
      });
      await batch.commit();
      console.log('Successfully seeded crypto_prices');
    }
  } catch (error) {
    console.error('Error seeding Firestore starter data:', error);
  }
}
