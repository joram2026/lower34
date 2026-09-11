import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, getDoc, doc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { CryptoNetwork, P2PMerchant, Transaction, UserAccount, CryptoPrice, ReferralDepositConfig } from '../types';
import { DEFAULT_NETWORKS, DEFAULT_MERCHANTS } from '../seedData';

const FALLBACK_PRICES: Record<string, number> = {
  USDT: 1.00,
  USDC: 1.00,
  BTC: 94250.30,
  ETH: 3480.12,
  SOL: 184.45,
  BNB: 592.20,
  XRP: 2.54,
  WLD: 2.80,
  TRX: 0.22,
  DOGE: 0.38
};
import { 
  ArrowLeft, Coins, Users, CreditCard, ChevronRight, Copy, Check, 
  Upload, Sparkles, MessageSquare, AlertCircle, RefreshCw, Star,
  Clock, AlertTriangle
} from 'lucide-react';
import { CoinIcon } from './StandardUserDashboard';
import { useToast } from '../context/ToastContext';

const getNetworkMetadata = (networkName: string) => {
  const norm = (networkName || '').toUpperCase().trim();
  if (norm.includes('TRC20') || norm.includes('TRON') || norm === 'TRX') {
    return { fullName: 'Tron', badge: 'TRC-20' };
  }
  if (norm.includes('ERC20') || norm.includes('ETH') || norm.includes('ETHEREUM')) {
    return { fullName: 'Ethereum', badge: 'ERC-20' };
  }
  if (norm.includes('BEP20') || norm.includes('BSC') || norm.includes('BINANCE')) {
    return { fullName: 'BNB Chain', badge: 'BEP-20' };
  }
  if (norm.includes('SOL') || norm.includes('SPL') || norm.includes('SOLANA')) {
    return { fullName: 'Solana', badge: 'SPL' };
  }
  if (norm.includes('BTC') || norm.includes('BITCOIN')) {
    return { fullName: 'Bitcoin', badge: 'Native' };
  }
  if (norm.includes('POLYGON') || norm.includes('MATIC')) {
    return { fullName: 'Polygon', badge: 'MATIC' };
  }
  if (norm.includes('ARBITRUM') || norm.includes('ARB')) {
    return { fullName: 'Arbitrum', badge: 'ARB' };
  }
  if (norm.includes('OPTIMISM') || norm.includes('OP')) {
    return { fullName: 'Optimism', badge: 'OP' };
  }
  if (norm.includes('AVAX') || norm.includes('AVALANCHE')) {
    return { fullName: 'Avalanche', badge: 'C-Chain' };
  }
  return { fullName: networkName, badge: '' };
};

interface DepositWorkflowProps {
  user: any;
  onBack: () => void;
  onSuccess: () => void;
  initialCoinSymbol?: string;
}

export default function DepositWorkflow({ user, onBack, onSuccess, initialCoinSymbol }: DepositWorkflowProps) {
  const [method, setMethod] = useState<'selection' | 'crypto_coin_select' | 'crypto' | 'crypto_address' | 'crypto_confirm' | 'p2p' | 'p2p_calc' | 'p2p_instructions' | 'p2p_confirm'>('crypto_coin_select');

  const formatCoinName = (tokenName: string) => {
    if (!tokenName) return '';
    const match = tokenName.match(/^([^(]+)\s*\(([^)]+)\)$/);
    if (match) {
      const fullName = match[1].trim();
      const symbol = match[2].trim();
      return `${symbol} (${fullName})`;
    }
    return tokenName;
  };
  
  const [profile, setProfile] = useState<UserAccount | null>(null);
  const [referralConfig, setReferralConfig] = useState<ReferralDepositConfig | null>(null);
  
  // Crypto States
  const [networks, setNetworks] = useState<CryptoNetwork[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<CryptoNetwork | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [amountCoin, setAmountCoin] = useState<string>('');
  const [evidence, setEvidence] = useState<string>('');
  const [compressing, setCompressing] = useState<boolean>(false);
  const [auditing, setAuditing] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<{
    isValid: boolean;
    confidence: number;
    extractedAmount: number | null;
    extractedSymbol: string | null;
    extractedTxHash: string | null;
    extractedNetwork: string | null;
    reasons: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrice[]>([]);

  // Trigger Gemini AI image verification
  const runImageAudit = async (base64Image: string) => {
    setAuditing(true);
    setAuditResult(null);
    try {
      const response = await fetch('/api/verify-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          type: 'crypto',
          expectedAmount: parseFloat(amountCoin) || null,
          expectedSymbol: selectedCoin ? selectedCoin.id.toUpperCase() : 'USDT'
        })
      });
      if (response.ok) {
        const text = await response.text();
        if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
          const data = JSON.parse(text);
          setAuditResult(data);
        }
      } else {
        console.warn('AI Receipt Verification API returned error status.');
      }
    } catch (err) {
      console.error('Failed to verify receipt with AI:', err);
    } finally {
      setAuditing(false);
    }
  };

  // Timer & Session Recovery states
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [timerExpired, setTimerExpired] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelModalCallback, setCancelModalCallback] = useState<(() => void) | null>(null);

  // Subscribe to crypto prices for live conversion
  useEffect(() => {
    const pricesCol = collection(db, 'crypto_prices');
    const unsubscribe = onSnapshot(pricesCol, (snap) => {
      if (!snap.empty) {
        setCryptoPrices(snap.docs.map(d => d.data() as CryptoPrice));
      }
    });
    return () => unsubscribe();
  }, []);

  // Synchronized Countdown Timer Effect
  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft('');
      setTimerExpired(false);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = expiresAt - now;
      if (diff <= 0) {
        setTimeLeft('00:00');
        setTimerExpired(true);
        localStorage.removeItem('cme_active_deposit_session');
        localStorage.removeItem('morex_active_deposit_session');
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        setTimerExpired(false);
      }
    };

    updateTimer(); // Initial calculation
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const saveSession = (newMethod: 'crypto_address' | 'crypto_confirm', customExpiresAt?: number) => {
    if (!selectedCoin || !user?.uid) return;
    const expiry = customExpiresAt || expiresAt || (Date.now() + 15 * 60 * 1000);
    if (!expiresAt && !customExpiresAt) {
      setExpiresAt(expiry);
    }
    const session = {
      userId: user.uid,
      coinId: selectedCoin.id,
      network: selectedNetwork,
      amount: amountCoin,
      method: newMethod,
      expiresAt: expiry
    };
    localStorage.setItem('cme_active_deposit_session', JSON.stringify(session));
  };

  const clearSession = () => {
    localStorage.removeItem('cme_active_deposit_session');
    localStorage.removeItem('morex_active_deposit_session');
    setExpiresAt(null);
    setTimeLeft('');
    setTimerExpired(false);
  };

  const handleCancelClick = (callback: () => void) => {
    setCancelModalCallback(() => callback);
    setShowCancelModal(true);
  };

  const currentSymbol = selectedCoin ? selectedCoin.id.toUpperCase() : 'USDT';

  const getCoinUnitPrice = (symbol: string): number => {
    const sym = symbol.toUpperCase();
    if (sym === 'USDT' || sym === 'USDC') return 1.00;
    const found = cryptoPrices.find(p => p.symbol.toUpperCase() === sym);
    if (found && found.price > 0) return found.price;
    return FALLBACK_PRICES[sym] || 1.00;
  };

  const unitPrice = getCoinUnitPrice(currentSymbol);
  const coinVal = parseFloat(amountCoin) || 0;
  const calculatedUSDVal = parseFloat((coinVal * unitPrice).toFixed(2));
  
  // P2P States
  const [merchants, setMerchants] = useState<P2PMerchant[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<P2PMerchant | null>(null);
  const [amountShillings, setAmountShillings] = useState<string>('');
  const [calculatedUSD, setCalculatedUSD] = useState<number>(0);
  const [p2pTxId] = useState<string>(() => 'CME-P2P-' + Math.floor(1000000 + Math.random() * 9000000));
  const [p2pMessage, setP2pMessage] = useState<string>('');

  const toast = useToast();
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  const setError = (msg: string | null) => {
    setErrorState(msg);
    if (msg) {
      toast.error(msg, 'Deposit Error');
    }
  };
  const error = errorState;

  // Fetch networks & P2P merchants on load
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        if (user?.uid) {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setProfile(userSnap.data() as UserAccount);
          }
        }

        const refDepConfigRef = doc(db, 'settings', 'referral_deposit_config');
        const refDepConfigSnap = await getDoc(refDepConfigRef);
        if (refDepConfigSnap.exists()) {
          setReferralConfig(refDepConfigSnap.data() as ReferralDepositConfig);
        }

        const netCol = collection(db, 'crypto_networks');
        const netSnap = await getDocs(netCol);
        let netList = netSnap.docs.map(doc => {
          const d = doc.data();
          return {
            id: (d.id || doc.id).toLowerCase(),
            tokenName: d.tokenName || doc.id.toUpperCase(),
            networks: Array.isArray(d.networks) ? d.networks : [],
            addresses: d.addresses && typeof d.addresses === 'object' ? d.addresses : {},
            minWithdrawalUSD: typeof d.minWithdrawalUSD === 'number' && !isNaN(d.minWithdrawalUSD) ? d.minWithdrawalUSD : 10
          } as CryptoNetwork;
        });

        // Only fallback to defaults if Firestore has no records at all
        if (netList.length === 0) {
          netList = [...DEFAULT_NETWORKS];
        }

        const order = ['usdt', 'usdc', 'btc', 'eth', 'sol', 'bnb', 'xrp', 'wld', 'trx', 'doge'];
        netList.sort((a, b) => {
          const indexA = order.indexOf(a.id.toLowerCase());
          const indexB = order.indexOf(b.id.toLowerCase());
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.id.localeCompare(b.id);
        });
        setNetworks(netList);

        // Check for active saved session to rehydrate
        const savedSessionStr = localStorage.getItem('cme_active_deposit_session') || localStorage.getItem('morex_active_deposit_session');
        let sessionLoaded = false;
        if (savedSessionStr) {
          try {
            const savedSession = JSON.parse(savedSessionStr);
            if (savedSession && savedSession.userId === user?.uid && savedSession.expiresAt > Date.now()) {
              const targetCoin = netList.find(n => n.id.toLowerCase() === savedSession.coinId.toLowerCase());
              if (targetCoin) {
                setSelectedCoin(targetCoin);
                setSelectedNetwork(savedSession.network);
                setAmountCoin(savedSession.amount);
                setMethod(savedSession.method || 'crypto_address');
                setExpiresAt(savedSession.expiresAt);
                sessionLoaded = true;
              }
            } else {
              localStorage.removeItem('cme_active_deposit_session');
              localStorage.removeItem('morex_active_deposit_session');
            }
          } catch (e) {
            console.error('Error parsing saved session', e);
          }
        }

        if (!sessionLoaded) {
          const rawPreselected = (typeof initialCoinSymbol === 'string' ? initialCoinSymbol : '') || sessionStorage.getItem('preselected_deposit_coin') || localStorage.getItem('preselected_deposit_coin');
          sessionStorage.removeItem('preselected_deposit_coin');
          localStorage.removeItem('preselected_deposit_coin');

          let rawString = '';
          if (typeof rawPreselected === 'string') {
            rawString = rawPreselected;
          } else if (rawPreselected && typeof rawPreselected === 'object' && 'symbol' in rawPreselected) {
            rawString = String((rawPreselected as any).symbol || '');
          }

          const preselected = rawString.trim().toLowerCase();

          if (preselected) {
            const target = netList.find(n => 
              n.id.toLowerCase() === preselected ||
              n.id.toLowerCase() === preselected.replace(/[^a-z0-9]/g, '') ||
              n.tokenName.toLowerCase() === preselected ||
              n.tokenName.toLowerCase().includes(`(${preselected})`) ||
              n.tokenName.toLowerCase().includes(preselected) ||
              preselected.includes(n.id.toLowerCase())
            );

            if (target) {
              setSelectedCoin(target);
              if (target.networks && target.networks.length > 0) {
                setSelectedNetwork(target.networks[0]);
              } else {
                setSelectedNetwork('');
              }
              setMethod('crypto');
            } else if (netList.length > 0) {
              setSelectedCoin(netList[0]);
              if (netList[0].networks && netList[0].networks.length > 0) {
                setSelectedNetwork(netList[0].networks[0]);
              }
            }
          } else if (netList.length > 0) {
            setSelectedCoin(netList[0]);
            if (netList[0].networks && netList[0].networks.length > 0) {
              setSelectedNetwork(netList[0].networks[0]);
            }
          }
        }

        const merchCol = collection(db, 'p2p_merchants');
        const merchSnap = await getDocs(merchCol);
        let merchList = merchSnap.docs.map(doc => doc.data() as P2PMerchant);
        if (merchList.length === 0) {
          merchList = DEFAULT_MERCHANTS;
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          merchList = merchList.map(m => ({
            ...m,
            rate: 0,
            completionRate: 0,
            completedOrders: 0,
            minLimit: 0,
            maxLimit: 0,
            rating: 0,
          }));
        }
        setMerchants(merchList);
      } catch (err) {
        console.error('Error fetching deposit configurations:', err);
        setError('Failed to fetch token networks or merchants.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [initialCoinSymbol]);

  // Handle offline mode for P2P merchants
  useEffect(() => {
    const applyOfflineMerchants = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setMerchants(prev => prev.map(m => ({
          ...m,
          rate: 0,
          completionRate: 0,
          completedOrders: 0,
          minLimit: 0,
          maxLimit: 0,
          rating: 0,
        })));
        setSelectedMerchant(prev => prev ? {
          ...prev,
          rate: 0,
          completionRate: 0,
          completedOrders: 0,
          minLimit: 0,
          maxLimit: 0,
          rating: 0,
        } : null);
      }
    };

    window.addEventListener('offline', applyOfflineMerchants);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      applyOfflineMerchants();
    }
    return () => {
      window.removeEventListener('offline', applyOfflineMerchants);
    };
  }, []);

  // Recalculate USD based on local currency input for P2P BUY
  useEffect(() => {
    if (selectedMerchant && amountShillings) {
      const shillings = parseFloat(amountShillings) || 0;
      if (!selectedMerchant.rate || selectedMerchant.rate <= 0) {
        setCalculatedUSD(0);
      } else {
        setCalculatedUSD(parseFloat((shillings / selectedMerchant.rate).toFixed(2)));
      }
    } else {
      setCalculatedUSD(0);
    }
  }, [amountShillings, selectedMerchant]);

  // Copy target text to clipboard
  const handleCopy = (text: string) => {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        toast.success(`Copied "${text}" to clipboard!`, 'Copied');
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => {
        fallbackCopyTextToClipboard(text);
      });
    } else {
      fallbackCopyTextToClipboard(text);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      toast.success(`Copied "${text}" to clipboard!`, 'Copied');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      toast.error('Failed to copy to clipboard', 'Error');
    }
    document.body.removeChild(textArea);
  };

  // Helper to compress uploaded image file using Canvas to stay under Firestore document size limits (< 1MB)
  const compressImageFile = (file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.75): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (error) => reject(error);
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = (error) => reject(error);
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Process uploaded image file to compressed base64
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCompressing(true);
      setError(null);
      setAuditResult(null);
      try {
        const compressedBase64 = await compressImageFile(file, 1000, 1000, 0.75);
        setEvidence(compressedBase64);
        await runImageAudit(compressedBase64);
      } catch (err) {
        console.error('Failed to compress image:', err);
        // Fallback: read directly
        const reader = new FileReader();
        reader.onloadend = async () => {
          const res = reader.result as string;
          setEvidence(res);
          await runImageAudit(res);
        };
        reader.readAsDataURL(file);
      } finally {
        setCompressing(false);
      }
    }
  };

  // Submit Crypto Deposit
  const handleCryptoSubmit = async () => {
    const numCoinAmount = parseFloat(amountCoin);
    if (!amountCoin || isNaN(numCoinAmount) || numCoinAmount <= 0) {
      setError(`Please input a valid deposit amount in ${currentSymbol}.`);
      return;
    }
    if (!evidence) {
      setError('Please upload an image as evidence of payment.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let finalEvidence = evidence;
      // Safety check: Firestore limit is 1,048,487 bytes. If evidence base64 is near limit, truncate or alert.
      if (finalEvidence.length > 950000) {
        throw new Error('Image file is too large for database storage. Please choose a smaller image or screenshot.');
      }

      const symbol = currentSymbol;
      const usdVal = calculatedUSDVal;
      
      const newTx: Omit<Transaction, 'id'> = {
        userId: user.uid,
        userEmail: user.email,
        type: 'deposit_crypto',
        amount: usdVal,
        coinSymbol: symbol,
        coinAmount: numCoinAmount,
        status: 'PENDING APPROVAL',
        createdAt: serverTimestamp(),
        evidence: finalEvidence,
        network: selectedNetwork,
        address: selectedCoin?.addresses[selectedNetwork] || '',
        merchantName: selectedCoin ? formatCoinName(selectedCoin.tokenName) : '',
        aiAudit: auditResult ? {
          isValid: auditResult.isValid,
          confidence: auditResult.confidence,
          reasons: auditResult.reasons,
          extractedAmount: auditResult.extractedAmount,
          extractedSymbol: auditResult.extractedSymbol,
          extractedTxHash: auditResult.extractedTxHash,
          extractedNetwork: auditResult.extractedNetwork
        } : null
      };

      await addDoc(collection(db, 'transactions'), newTx);
      clearSession();
      onSuccess();
    } catch (err: any) {
      console.error('Crypto deposit error:', err);
      setError(err.message || 'Failed to submit crypto deposit.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit P2P Deposit
  const handleP2PSubmit = async () => {
    if (!p2pMessage.trim()) {
      setError('Please paste your receipt or mobile money message text.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const newTx: Omit<Transaction, 'id'> = {
        userId: user.uid,
        userEmail: user.email,
        type: 'deposit_p2p',
        amount: calculatedUSD,
        localAmount: parseFloat(amountShillings),
        status: 'PENDING APPROVAL',
        createdAt: serverTimestamp(),
        paymentMessage: p2pMessage,
        merchantName: selectedMerchant?.name || '',
        address: selectedMerchant?.paymentNumber || ''
      };

      await addDoc(collection(db, 'transactions'), newTx);
      onSuccess();
    } catch (err: any) {
      console.error('P2P deposit error:', err);
      setError(err.message || 'Failed to submit P2P deposit.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="deposit-workflow-container" className="max-w-md mx-auto p-4 sm:p-5 bg-[#EBF9F0] text-zinc-800 min-h-[calc(100vh-140px)]">
      {/* Dynamic Header */}
      <div className="flex items-center gap-3 mb-6">
        <button 
          id="deposit-back-btn"
          onClick={() => {
            if (method === 'selection' || method === 'crypto_coin_select') onBack();
            else if (method === 'crypto') setMethod('crypto_coin_select');
            else if (method === 'crypto_address') {
              handleCancelClick(() => {
                clearSession();
                setMethod('crypto');
              });
            }
            else if (method === 'crypto_confirm') {
              setMethod('crypto_address');
              saveSession('crypto_address');
            }
            else onBack();
          }}
          className="p-2 rounded-full bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-800">
            {(method === 'selection' || method === 'crypto_coin_select') && 'Select Coin to Deposit'}
            {method === 'crypto' && 'Crypto Deposit Details'}
            {method === 'crypto_address' && 'Receiver Address'}
            {method === 'crypto_confirm' && 'Upload Deposit Proof'}
          </h2>
          <p className="text-xs text-zinc-500">
            {(method === 'selection' || method === 'crypto_coin_select') && 'Choose a crypto asset to deposit'}
            {method === 'crypto' && `Select network and enter deposit amount for ${selectedCoin ? formatCoinName(selectedCoin.tokenName) : ''}`}
            {method === 'crypto_address' && `Send funds to the generated ${selectedNetwork} address`}
            {method === 'crypto_confirm' && 'Provide screenshot evidence of asset transfer'}
          </p>
        </div>
      </div>



      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[250px] gap-3">
          <RefreshCw size={24} className="text-amber-500 animate-spin" />
          <span className="text-xs text-zinc-500 font-medium">Fetching active integrations...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Crypto Coin Select Page (Default Deposit Screen) */}
          {(method === 'selection' || method === 'crypto_coin_select') && (
            <div className="space-y-3">
              {/* Promotional Banner for First Deposit / Referred Users */}
              {referralConfig && referralConfig.enabled && !profile?.hasMadeFirstDeposit && (
                <div id="first-deposit-welcome-banner" className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950 border border-amber-500/40 text-white shadow-md relative overflow-hidden">
                  <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
                    <Sparkles size={130} className="text-amber-400" />
                  </div>
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <span>🎁 Welcome Bonus 🎉</span>
                      </h3>
                    </div>

                    {/* Tier brackets display */}
                    {referralConfig.tiers && referralConfig.tiers.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {referralConfig.tiers.map((tier) => (
                          <div key={tier.id} className="bg-zinc-950/80 border border-amber-500/20 rounded-xl p-3 text-center">
                            <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wide">
                              ${tier.minAmount} – ${tier.maxAmount} Deposit
                            </span>
                            <span className="block text-sm font-black text-amber-400 font-mono mt-1">
                              +{tier.refereePercent}% Welcome Cash
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {networks.map(net => {
                const formattedName = formatCoinName(net.tokenName);
                return (
                  <button
                    key={net.id}
                    id={`crypto-select-asset-${net.id}`}
                    onClick={() => {
                      setSelectedCoin(net);
                      setAmountCoin('');
                      if (net.networks.length > 0) {
                        setSelectedNetwork(net.networks[0]);
                      } else {
                        setSelectedNetwork('');
                      }
                      setMethod('crypto');
                    }}
                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-2xl transition-all text-left group"
                  >
                    <div className="flex items-center gap-3.5">
                      <CoinIcon symbol={net.id.toUpperCase()} className="w-10 h-10" />
                      <div>
                        <h4 className="font-bold text-sm text-zinc-800 group-hover:text-amber-600 transition-colors">
                          {formattedName}
                        </h4>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          Networks: {net.networks.join(', ')}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Crypto Deposit Method */}
          {method === 'crypto' && selectedCoin && (
            <div className="space-y-5">
              {/* Selected Coin Banner */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3.5">
                  <CoinIcon symbol={selectedCoin.id.toUpperCase()} className="w-11 h-11 rounded-xl" />
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Selected Asset</span>
                    <span className="text-sm font-black text-zinc-800">{formatCoinName(selectedCoin.tokenName)}</span>
                  </div>
                </div>
              </div>

              {/* Clean Noticeable Network Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Select Network
                  </label>
                  {selectedNetwork && (
                    <span className="text-xs font-black font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      {selectedNetwork}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedCoin.networks.map(net => {
                    const isSelected = selectedNetwork === net;
                    const netInfo = getNetworkMetadata(net);

                    return (
                      <button
                        key={net}
                        id={`crypto-network-btn-${net}`}
                        type="button"
                        onClick={() => setSelectedNetwork(net)}
                        className={`py-2 px-3 rounded-xl border-2 transition-all flex items-center justify-between gap-2 cursor-pointer text-left ${
                          isSelected
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-white border-zinc-200 text-zinc-800 hover:border-amber-400 hover:bg-amber-50/20 shadow-2xs'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-mono font-black text-xs tracking-tight ${
                              isSelected ? 'text-white' : 'text-zinc-900'
                            }`}>
                              {net}
                            </span>
                            {netInfo.badge && (
                              <span className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded leading-none uppercase ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'
                              }`}>
                                {netInfo.badge}
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] font-medium truncate mt-0.5 leading-tight ${
                            isSelected ? 'text-amber-100' : 'text-zinc-500'
                          }`}>
                            {netInfo.fullName}
                          </p>
                        </div>

                        <div className="shrink-0">
                          {isSelected ? (
                            <div className="w-4 h-4 rounded-full bg-white text-amber-600 flex items-center justify-center shadow-2xs">
                              <Check size={11} strokeWidth={3.5} />
                            </div>
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-300" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-zinc-600">Deposit Amount ({currentSymbol})</label>
                </div>
                <div className="relative">
                  <input
                    id="crypto-deposit-amount"
                    type="number"
                    step="any"
                    required
                    placeholder={
                      currentSymbol === 'BTC' ? '0.005' :
                      currentSymbol === 'ETH' ? '0.05' :
                      currentSymbol === 'SOL' ? '1.0' :
                      currentSymbol === 'USDT' || currentSymbol === 'USDC' ? '100.00' : '10'
                    }
                    value={amountCoin}
                    onChange={(e) => setAmountCoin(e.target.value)}
                    className="w-full pl-3.5 pr-28 py-3 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-zinc-800 font-mono shadow-xs"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
                    <span className="font-bold text-xs text-zinc-500 font-mono uppercase">{currentSymbol}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentSymbol === 'BTC') setAmountCoin('0.1');
                        else if (currentSymbol === 'ETH') setAmountCoin('1.5');
                        else if (currentSymbol === 'SOL') setAmountCoin('10');
                        else if (currentSymbol === 'USDT' || currentSymbol === 'USDC') setAmountCoin('1000');
                        else setAmountCoin('100');
                      }}
                      className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 font-black text-[10px] px-2 py-1 rounded-md border border-amber-500/30 transition-all cursor-pointer"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>

              {/* Generate Receiver Address Action */}
              <button
                id="crypto-deposit-proceed"
                onClick={() => {
                  setError(null);
                  const numVal = parseFloat(amountCoin);
                  if (!amountCoin || isNaN(numVal) || numVal <= 0) {
                    setError(`Please enter a valid deposit amount in ${currentSymbol}.`);
                    return;
                  }
                  if (!selectedNetwork) {
                    setError('Please select a network.');
                    return;
                  }
                  const expiry = Date.now() + 15 * 60 * 1000;
                  setExpiresAt(expiry);
                  setMethod('crypto_address');
                  
                  if (selectedCoin && user?.uid) {
                    const session = {
                      userId: user.uid,
                      coinId: selectedCoin.id,
                      network: selectedNetwork,
                      amount: amountCoin,
                      method: 'crypto_address',
                      expiresAt: expiry
                    };
                    localStorage.setItem('cme_active_deposit_session', JSON.stringify(session));
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:bg-zinc-200 disabled:text-zinc-400 rounded-xl text-sm font-black transition-all shadow-md mt-6 cursor-pointer uppercase tracking-wider"
              >
                <span>Generate Receiver Address</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Crypto Step 2: Receiver Address & Instructions */}
          {method === 'crypto_address' && selectedCoin && (
            <div className="space-y-5">
              {/* Expired state lock safeguard */}
              {timerExpired ? (
                <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-center space-y-4 shadow-sm animate-fadeIn">
                  <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                    <AlertTriangle size={32} />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-black text-zinc-800">Deposit Window Expired</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed max-w-xs mx-auto">
                      To protect against cryptocurrency exchange rate volatility, your deposit session rate-lock has expired.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      clearSession();
                      setMethod('crypto_coin_select');
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-xl text-sm transition-all cursor-pointer uppercase tracking-wider shadow-md"
                  >
                    Start New Deposit
                  </button>
                </div>
              ) : (
                <>
                  {/* Countdown Timer HUD */}
                  {expiresAt && (
                    <div className="bg-zinc-900 text-white rounded-2xl p-3 border border-zinc-800 shadow-sm flex items-center justify-between gap-3 animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className={`shrink-0 ${parseInt(timeLeft.split(':')[0] || '0') < 5 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`} />
                        <div className="text-left">
                          <p className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Session Expires In</p>
                          <p className="text-xs font-mono font-black">
                            Expires in <span className={parseInt(timeLeft.split(':')[0] || '0') < 5 ? 'text-red-500 font-bold' : 'text-emerald-400'}>{timeLeft}</span>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleCancelClick(() => {
                            clearSession();
                            setMethod('crypto_coin_select');
                          });
                        }}
                        className="text-[9px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded-lg border border-red-500/20 transition-all cursor-pointer"
                      >
                        Cancel Invoice
                      </button>
                    </div>
                  )}

                  {/* Transfer Summary Card */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3 shadow-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                      <span className="text-xs text-zinc-500 font-medium">Selected Asset</span>
                      <div className="flex items-center gap-1.5">
                        <CoinIcon symbol={selectedCoin.id.toUpperCase()} className="w-5 h-5 rounded" />
                        <span className="font-bold text-xs text-zinc-800">{formatCoinName(selectedCoin.tokenName)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                      <span className="text-xs text-zinc-500 font-medium">Network</span>
                      <span className="font-mono font-bold text-xs text-amber-600 px-2 py-0.5 bg-amber-50 rounded-md border border-amber-200">{selectedNetwork}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500 font-medium">Exact Deposit Amount</span>
                      <span className="font-mono font-extrabold text-sm text-amber-700">{amountCoin} {currentSymbol}</span>
                    </div>
                  </div>

                  {/* Wallet Address Card */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Receiver Address ({selectedNetwork})</span>
                      <button
                        id="crypto-copy-address"
                        type="button"
                        onClick={() => handleCopy(selectedCoin.addresses[selectedNetwork] || '')}
                        className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                      >
                        {copied ? <Check size={12} className="text-amber-600" /> : <Copy size={12} />}
                        <span>{copied ? 'Copied' : 'Copy Address'}</span>
                      </button>
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl font-mono text-xs text-amber-800 break-all select-all font-bold leading-relaxed tracking-wide">
                      {selectedCoin.addresses[selectedNetwork] || 'No Address configured'}
                    </div>
                  </div>

                  {/* QR Code Card */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-xs animate-fadeIn">
                    <div className="bg-zinc-50 border border-zinc-100 p-2.5 rounded-xl mb-2">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=27272a&data=${encodeURIComponent(selectedCoin.addresses[selectedNetwork] || '')}`}
                        alt="Deposit QR Code"
                        className="w-32 h-32 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Scan QR Code to pay</p>
                  </div>

                  {/* Instruction Banner */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs space-y-1.5 text-zinc-800">
                    <div className="flex items-center gap-1.5 font-black text-amber-800 text-xs">
                      <AlertCircle size={15} className="text-amber-600 shrink-0" />
                      <span>Deposit Instructions</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-zinc-700">
                      Please transfer exactly <strong className="font-mono text-amber-900">{amountCoin} {currentSymbol}</strong> to the address above.
                    </p>
                    <p className="text-[10px] text-amber-800 font-semibold">
                      ⚠️ Transfer strictly using the <strong className="underline">{selectedNetwork}</strong> network. Sending via any other network will result in permanent loss of funds.
                    </p>
                  </div>

                  {/* I Have Made Payment Action */}
                  <button
                    id="crypto-payment-made-btn"
                    onClick={() => {
                      setMethod('crypto_confirm');
                      saveSession('crypto_confirm');
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 rounded-xl text-sm font-black transition-all shadow-md cursor-pointer uppercase tracking-wider"
                  >
                    <span>I HAVE MADE PAYMENT</span>
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Crypto Confirm & Upload Proof Page */}
          {method === 'crypto_confirm' && selectedCoin && (
            <div className="space-y-5">
              {timerExpired ? (
                <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-center space-y-4 shadow-sm animate-fadeIn">
                  <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                    <AlertTriangle size={32} />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-black text-zinc-800">Deposit Window Expired</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed max-w-xs mx-auto">
                      To protect against cryptocurrency exchange rate volatility, your deposit session rate-lock has expired.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      clearSession();
                      setMethod('crypto_coin_select');
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-xl text-sm transition-all cursor-pointer uppercase tracking-wider shadow-md"
                  >
                    Start New Deposit
                  </button>
                </div>
              ) : (
                <>
                  {/* Countdown Timer HUD */}
                  {expiresAt && (
                    <div className="bg-zinc-900 text-white rounded-2xl p-3 border border-zinc-800 shadow-sm flex items-center justify-between gap-3 animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className={`shrink-0 ${parseInt(timeLeft.split(':')[0] || '0') < 5 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`} />
                        <div className="text-left">
                          <p className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Session Expires In</p>
                          <p className="text-xs font-mono font-black">
                            Expires in <span className={parseInt(timeLeft.split(':')[0] || '0') < 5 ? 'text-red-500 font-bold' : 'text-emerald-400'}>{timeLeft}</span>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleCancelClick(() => {
                            clearSession();
                            setMethod('crypto_coin_select');
                          });
                        }}
                        className="text-[9px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded-lg border border-red-500/20 transition-all cursor-pointer"
                      >
                        Cancel Invoice
                      </button>
                    </div>
                  )}

                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-4 animate-fadeIn">
                    <div className="flex flex-col items-center justify-center text-center gap-2 pb-2 border-b border-zinc-200/60">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <Coins size={22} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-zinc-800">Upload Deposit Proof</h3>
                        <p className="text-[11px] text-zinc-500">Provide evidence of transfer</p>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between items-center pb-1.5 border-b border-zinc-100">
                        <span className="text-zinc-500">Selected Asset</span>
                        <span className="font-bold text-zinc-800">{formatCoinName(selectedCoin.tokenName)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-1.5 border-b border-zinc-100">
                        <span className="text-zinc-500">Selected Network</span>
                        <span className="font-mono font-bold text-amber-600">{selectedNetwork}</span>
                      </div>
                      <div className="flex justify-between items-center pb-1.5 border-b border-zinc-100">
                        <span className="text-zinc-500">Recipient Address</span>
                        <span className="font-mono font-bold text-zinc-600 break-all max-w-[200px] text-right">{selectedCoin.addresses[selectedNetwork]}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Amount Sent</span>
                        <span className="font-mono font-bold text-amber-600">{amountCoin} {currentSymbol}</span>
                      </div>
                    </div>
                  </div>

                  {/* Evidence Upload */}
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="text-xs font-semibold text-zinc-500 block">
                      Evidence of Payment (Upload Screenshot)
                    </label>
                    <div className="relative border border-dashed border-zinc-300 bg-white rounded-2xl p-5 hover:bg-zinc-50 transition-all text-center flex flex-col items-center justify-center cursor-pointer">
                      <input
                        id="crypto-evidence-upload-final"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={auditing}
                      />
                      {compressing ? (
                        <div className="space-y-2 py-2">
                          <RefreshCw size={24} className="animate-spin text-amber-500 mx-auto" />
                          <p className="text-xs font-bold text-amber-600">Compressing & optimizing proof image...</p>
                        </div>
                      ) : evidence ? (
                        <div className="space-y-2">
                          <img src={evidence} alt="Proof of payment" className="max-h-24 mx-auto rounded-lg border border-zinc-200" />
                          <p className="text-[11px] text-amber-600 font-semibold">Image loaded successfully! Tap to change.</p>
                        </div>
                      ) : (
                        <>
                          <Upload size={24} className="text-zinc-400 mb-2" />
                          <p className="text-xs font-bold text-zinc-600">Drag & Drop or Click to Upload</p>
                          <p className="text-[10px] text-zinc-400 mt-1">Accepts PNG, JPG, JPEG (auto-optimized proof)</p>
                        </>
                      )}
                    </div>

                    {/* Smart Receipt Analysis Scan Feedback */}
                    {auditing && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col gap-2.5 animate-fadeIn">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                          <RefreshCw size={14} className="animate-spin text-amber-600 shrink-0" />
                          <span>Receipt analysis in progress...</span>
                        </div>
                        <div className="w-full bg-zinc-200/80 h-1.5 rounded-full overflow-hidden relative">
                          <div className="bg-amber-500 h-full w-1/2 rounded-full animate-pulse"></div>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-normal">
                          Analyzing transaction details, payment markers, and confirmation records...
                        </p>
                      </div>
                    )}

                    {!auditing && auditResult && (
                      <div className={`border rounded-2xl p-4 space-y-2.5 animate-fadeIn ${
                        auditResult.isValid ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-rose-500/10 border-rose-500/25'
                      }`}>
                        <div className="flex items-center gap-1.5 font-extrabold text-xs">
                          {auditResult.isValid ? (
                            <>
                              <Sparkles size={14} className="text-emerald-600 shrink-0" />
                              <span className="text-emerald-800">Receipt Verification: Complete</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={14} className="text-rose-600 shrink-0 animate-bounce" />
                              <span className="text-rose-800">Receipt Verification: Needs Review</span>
                            </>
                          )}
                        </div>
                        <p className={`text-[11px] leading-relaxed font-semibold ${
                          auditResult.isValid ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {auditResult.reasons}
                        </p>
                        {auditResult.isValid ? (
                          <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-emerald-500/10 text-[10px] font-mono text-emerald-800/80">
                            <div>
                              <span className="block font-bold uppercase text-[8px] text-emerald-600/70">Detected Amount</span>
                              <span className="font-bold text-xs">{auditResult.extractedAmount ? `${auditResult.extractedAmount} ${auditResult.extractedSymbol || ''}` : 'N/A'}</span>
                            </div>
                            <div>
                              <span className="block font-bold uppercase text-[8px] text-emerald-600/70">Tx Reference Hash</span>
                              <span className="truncate block font-bold text-xs">{auditResult.extractedTxHash || 'N/A'}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[9px] text-rose-700 leading-relaxed font-semibold pt-2 border-t border-rose-500/10">
                            ⚠️ Note: Please upload a valid payment proof screenshot. Unrelated or empty images will be auto-flagged and manually declined.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Submit Action */}
                  <button
                    id="crypto-deposit-submit-final"
                    onClick={handleCryptoSubmit}
                    disabled={submitting || !evidence}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:bg-zinc-200 disabled:text-zinc-400 rounded-xl text-sm font-black transition-all shadow-md cursor-pointer uppercase tracking-wider"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={15} className="animate-spin text-white" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} />
                        <span>DONE</span>
                      </>
                    )}
                  </button>

                  <button
                    id="cancel-crypto-confirm-btn"
                    onClick={() => {
                      setError(null);
                      setMethod('crypto_address');
                      saveSession('crypto_address');
                    }}
                    className="w-full py-2.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Cancel & Go Back
                  </button>
                </>
              )}
            </div>
          )}

          {/* P2P Deposit Method (Merchants) */}
          {method === 'p2p' && (() => {
            const buyMerchants = merchants.filter(m => !m.type || m.type === 'buy' || m.type === 'both');
            return (
              <div className="space-y-4">
                {buyMerchants.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-zinc-500 text-xs">No active buy merchants found. Please try another deposit method or check back later.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {buyMerchants.map(merch => (
                      <div
                        key={merch.id}
                        id={`p2p-merchant-${merch.id}`}
                        className="bg-white border border-zinc-200 rounded-2xl p-4 hover:border-amber-400 transition-all flex flex-col justify-between gap-4"
                      >
                        <div className="flex justify-between items-start">
                          {/* Rating top-left */}
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 font-bold text-[10px]">
                            <Star size={10} className="fill-amber-500 text-amber-500" />
                            <span>{merch.rating.toFixed(2)} Rating</span>
                          </div>
                          {/* Merchant Name top-right */}
                          <span className="text-xs font-black text-zinc-700 tracking-tight">{merch.name}</span>
                        </div>

                        <div className="flex justify-between items-end">
                          <div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Conversion Rate</div>
                            <div className="text-base font-black text-amber-600 font-mono mt-0.5">
                              {merch.rate.toLocaleString()} Shs <span className="text-xs text-zinc-400 font-normal">/ 1 USD</span>
                            </div>
                            <div className="text-[10px] text-zinc-500 font-medium mt-1">
                              Limits: <span className="font-mono font-bold text-zinc-700">{(merch.minLimit || 500).toLocaleString()} Shs - {(merch.maxLimit || 500000).toLocaleString()} Shs</span>
                            </div>
                            <div className="flex gap-1.5 mt-1.5">
                              {merch.providers.map(prov => (
                                <span key={prov} className="text-[9px] px-2 py-0.5 bg-zinc-50 border border-zinc-200 text-zinc-500 rounded-md font-semibold">
                                  {prov}
                                </span>
                              ))}
                            </div>
                          </div>

                          <button
                            id={`p2p-buy-btn-${merch.id}`}
                            onClick={() => {
                              setSelectedMerchant(merch);
                              setAmountShillings((merch.minLimit || 500).toString());
                              setMethod('p2p_calc');
                            }}
                            className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 rounded-xl text-xs font-bold shadow-md shadow-amber-500/10 cursor-pointer"
                          >
                            BUY
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* P2P BUY Calculator */}
          {method === 'p2p_calc' && selectedMerchant && (
            <div className="space-y-5">
              {/* Merchant Details Card */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-4">
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-500 font-bold">{selectedMerchant.name}</span>
                  <div className="flex items-center gap-1 text-[11px] text-amber-600 font-bold">
                    <Star size={12} className="fill-amber-500 text-amber-500" />
                    <span>{selectedMerchant.rating}</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-zinc-500 flex justify-between items-center">
                  <span>Merchant Rate: <strong className="font-mono text-zinc-700">{selectedMerchant.rate} Shs = 1.00 USD</strong></span>
                  <span className="text-[10px] font-mono text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Min {(selectedMerchant.minLimit || 500).toLocaleString()} - Max {(selectedMerchant.maxLimit || 500000).toLocaleString()} Shs
                  </span>
                </div>
              </div>

              {/* Calculator input */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-zinc-500">Amount (Local Currency - Shillings)</label>
                    <span className="text-[10px] text-zinc-500 font-semibold">
                      Max: {(selectedMerchant.maxLimit || 500000).toLocaleString()} Shs
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      id="p2p-input-shillings"
                      type="number"
                      required
                      placeholder="e.g. 50000"
                      value={amountShillings}
                      onChange={(e) => setAmountShillings(e.target.value)}
                      className="w-full pl-4 pr-16 py-3 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-zinc-800 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setAmountShillings((selectedMerchant.maxLimit || 500000).toString())}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <span className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 font-black text-[10px] px-2.5 py-1 rounded-md border border-amber-500/30 transition-all cursor-pointer">
                        MAX
                      </span>
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex justify-between items-center">
                  <span className="text-xs text-zinc-500 font-semibold">Live-calculated USD Equivalent</span>
                  <span className="text-lg font-black text-amber-600 font-mono">
                    $ {calculatedUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Proceed to Pay */}
              <button
                id="p2p-proceed-to-pay"
                disabled={calculatedUSD <= 0}
                onClick={() => {
                  setError(null);
                  const shillings = parseFloat(amountShillings) || 0;
                  const min = selectedMerchant.minLimit || 500;
                  const max = selectedMerchant.maxLimit || 500000;
                  if (shillings < min) {
                    setError(`Minimum order limit for ${selectedMerchant.name} is ${min.toLocaleString()} Shs.`);
                    return;
                  }
                  if (shillings > max) {
                    setError(`Maximum order limit for ${selectedMerchant.name} is ${max.toLocaleString()} Shs.`);
                    return;
                  }
                  setMethod('p2p_instructions');
                }}
                className="w-full flex items-center justify-between py-3 px-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:bg-zinc-200 disabled:text-zinc-400 rounded-xl text-sm font-bold transition-all shadow-md mt-6 cursor-pointer"
              >
                <span>Proceed to Pay</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* P2P Instructions Screen */}
          {method === 'p2p_instructions' && selectedMerchant && (
            <div className="space-y-5">
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">Payment Escrow Instructions</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs border-b border-zinc-100 pb-2">
                    <span className="text-zinc-500">Pay Merchant Name</span>
                    <span className="font-bold text-zinc-800">{selectedMerchant.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-zinc-100 pb-2">
                    <span className="text-zinc-500">Payment Number</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-amber-600">{selectedMerchant.paymentNumber}</span>
                      <button 
                        id="copy-merchant-phone"
                        type="button"
                        onClick={() => handleCopy(selectedMerchant.paymentNumber)}
                        className="text-zinc-400 hover:text-amber-600 p-1.5 rounded-lg hover:bg-amber-50 transition-colors flex items-center justify-center cursor-pointer"
                        title="Copy Payment Number"
                      >
                        {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-zinc-100 pb-2">
                    <span className="text-zinc-500">Exact Shillings to Transfer</span>
                    <span className="font-mono font-bold text-zinc-800">{parseFloat(amountShillings).toLocaleString()} Shs</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-zinc-100 pb-2">
                    <span className="text-zinc-500">Transaction ID (CME Ref)</span>
                    <span className="font-mono font-bold text-zinc-500 text-[10px]">{p2pTxId}</span>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50 border border-amber-200/80 text-amber-900 text-xs rounded-xl leading-relaxed">
                  <strong>Notice:</strong> Please send the exact amount of shillings to the payment Number above. Use Mpesa, Airtel Money or Bank Transfer to make payment. Once you have made payment, copy the payment message and click the button below to continue.
                </div>
              </div>

              {/* Proceed Action */}
              <button
                id="p2p-instructions-proceed"
                onClick={() => {
                  setError(null);
                  setMethod('p2p_confirm');
                }}
                className="w-full flex items-center justify-between py-3.5 px-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 rounded-xl text-sm font-bold transition-all shadow-md mt-4 cursor-pointer"
              >
                <span>Proceed to Receipt paste</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* P2P Paste Receipt / Confirm Page */}
          {method === 'p2p_confirm' && selectedMerchant && (
            <div className="space-y-5">
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-4">
                <div className="flex justify-between items-center text-xs border-b border-zinc-100 pb-2">
                  <span className="text-zinc-500">Merchant</span>
                  <span className="font-bold text-zinc-800">{selectedMerchant.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-zinc-100 pb-2">
                  <span className="text-zinc-500">Exact Amount Paid</span>
                  <span className="font-mono font-bold text-amber-600">{parseFloat(amountShillings).toLocaleString()} Shs</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500">Required Reference</span>
                  <span className="font-mono font-bold text-zinc-600">{p2pTxId}</span>
                </div>
              </div>

              {/* Paste Confirmation Text */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-amber-500" />
                  Paste payment receipt / Mobile Money SMS text
                </label>
                <textarea
                  id="p2p-receipt-message-final"
                  required
                  rows={4}
                  placeholder="Paste the raw M-Pesa / MTN message or reference SMS here as verification."
                  value={p2pMessage}
                  onChange={(e) => setP2pMessage(e.target.value)}
                  className="w-full p-4 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-zinc-800 font-mono placeholder-zinc-400 leading-normal"
                />
              </div>

              {/* Submit deposit button */}
              <button
                id="p2p-deposit-submit-final"
                onClick={handleP2PSubmit}
                disabled={submitting || !p2pMessage.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:bg-zinc-200 disabled:text-zinc-400 rounded-xl text-sm font-black transition-all shadow-md mt-4 cursor-pointer uppercase tracking-wider"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin text-white" />
                    <span>Submitting P2P request...</span>
                  </>
                ) : (
                  <span>DONE</span>
                )}
              </button>

              <button
                id="cancel-p2p-confirm-btn"
                onClick={() => {
                  setError(null);
                  setMethod('p2p_instructions');
                }}
                className="w-full py-2.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                Cancel & Go Back
              </button>
            </div>
          )}
        </>
      )}

      {/* Custom Confirmation Modal (Iframe-Safe & Native Styled) */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full text-center space-y-4 shadow-xl border border-zinc-100">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-zinc-800">Cancel Deposit?</h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                This will release your active rate-locked invoice and clear your session progress.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setShowCancelModal(false)}
                className="py-2.5 px-3 border border-zinc-200 hover:bg-zinc-50 rounded-xl text-xs font-bold text-zinc-500 transition-colors cursor-pointer"
              >
                No, Keep It
              </button>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  if (cancelModalCallback) cancelModalCallback();
                }}
                className="py-2.5 px-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
