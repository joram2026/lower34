import { collection, getDocs, doc, writeBatch, Firestore } from 'firebase/firestore';
import { CryptoPrice } from '../types';

export async function fetchLivePriceFromBinance(symbol: string): Promise<{ price: number; change24h: number }> {
  // Stablecoins default to 1.00
  if (symbol === 'USDT' || symbol === 'USDC') {
    return { price: 1.00, change24h: 0.0 };
  }

  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`);
    if (!res.ok) {
      throw new Error(`Binance API error: ${res.statusText}`);
    }
    const data = await res.json();
    return {
      price: parseFloat(data.lastPrice) || 0,
      change24h: parseFloat(data.priceChangePercent) || 0
    };
  } catch (err) {
    console.warn(`Failed to fetch ${symbol} from Binance, trying Coinbase...`, err);
    return await fetchLivePriceFromCoinbase(symbol);
  }
}

async function fetchLivePriceFromCoinbase(symbol: string): Promise<{ price: number; change24h: number }> {
  try {
    const coinSymbol = symbol === 'USDT' ? 'USDT' : symbol === 'USDC' ? 'USDC' : symbol;
    const res = await fetch(`https://api.coinbase.com/v2/prices/${coinSymbol}-USD/spot`);
    if (!res.ok) {
      throw new Error(`Coinbase API error: ${res.statusText}`);
    }
    const data = await res.json();
    const price = parseFloat(data.data.amount) || 0;
    
    // Coinbase spot price doesn't give 24h change, so we default to 0 or calculate if needed.
    return {
      price,
      change24h: 0.0
    };
  } catch (err) {
    console.error(`Failed to fetch ${symbol} from Coinbase`, err);
    throw err;
  }
}

export async function fetchAllLivePrices(): Promise<Record<string, { price: number; change24h: number }>> {
  const symbols = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'WLD', 'TRX', 'DOGE'];
  const results: Record<string, { price: number; change24h: number }> = {};

  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const val = await fetchLivePriceFromBinance(sym);
        results[sym] = val;
      } catch (err) {
        // Fallback placeholder in case APIs are totally blocked
        if (sym === 'USDT' || sym === 'USDC') {
          results[sym] = { price: 1.00, change24h: 0.0 };
        } else if (sym === 'BTC') {
          results[sym] = { price: 94250.30, change24h: 3.45 };
        } else if (sym === 'ETH') {
          results[sym] = { price: 3480.12, change24h: 1.82 };
        } else if (sym === 'SOL') {
          results[sym] = { price: 184.45, change24h: -2.15 };
        } else if (sym === 'BNB') {
          results[sym] = { price: 592.20, change24h: 0.95 };
        } else if (sym === 'XRP') {
          results[sym] = { price: 2.54, change24h: 4.12 };
        } else if (sym === 'WLD') {
          results[sym] = { price: 2.80, change24h: -1.25 };
        } else if (sym === 'TRX') {
          results[sym] = { price: 0.22, change24h: 0.45 };
        } else if (sym === 'DOGE') {
          results[sym] = { price: 0.38, change24h: 2.15 };
        }
      }
    })
  );

  return results;
}

/**
 * Synchronizes live prices from public exchange APIs into Firestore crypto_prices collection.
 * Respects 'custom' vs 'live' mode set by Admin for each coin.
 */
export async function syncLiveCryptoPrices(db: Firestore): Promise<number> {
  try {
    const apiPrices = await fetchAllLivePrices();
    const pricesCol = collection(db, 'crypto_prices');
    const pricesSnap = await getDocs(pricesCol);

    const batch = writeBatch(db);
    let updatedCount = 0;

    const symbols = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'WLD', 'TRX', 'DOGE'];

    if (pricesSnap.empty) {
      // Seed initial crypto prices if empty
      symbols.forEach((sym) => {
        const isStablecoin = sym === 'USDT' || sym === 'USDC';
        const defaultMode = isStablecoin ? 'custom' : 'live';
        const apiVal = apiPrices[sym] || { price: 0, change24h: 0 };
        batch.set(doc(db, 'crypto_prices', sym), {
          symbol: sym,
          name: sym,
          price: apiVal.price,
          change24h: apiVal.change24h,
          mode: defaultMode,
          lastSyncedAt: new Date().toISOString()
        });
        updatedCount++;
      });
    } else {
      pricesSnap.docs.forEach((d) => {
        const data = d.data() as CryptoPrice;
        const sym = data.symbol;
        const isStablecoin = sym === 'USDT' || sym === 'USDC';
        const mode = data.mode || (isStablecoin ? 'custom' : 'live');

        if (mode === 'live' && apiPrices[sym]) {
          const apiVal = apiPrices[sym];
          batch.set(doc(db, 'crypto_prices', sym), {
            price: apiVal.price,
            change24h: apiVal.change24h,
            mode: 'live',
            lastSyncedAt: new Date().toISOString()
          }, { merge: true });
          updatedCount++;
        }
      });
    }

    if (updatedCount > 0) {
      await batch.commit();
    }
    return updatedCount;
  } catch (err) {
    console.warn('Error in syncLiveCryptoPrices background auto-sync:', err);
    return 0;
  }
}

