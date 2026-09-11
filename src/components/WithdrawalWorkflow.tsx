import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDoc, getDocs, doc, updateDoc, runTransaction, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { CryptoNetwork, P2PMerchant, UserAccount, Transaction, CryptoPrice, UserCopyTrade } from '../types';
import { DEFAULT_MERCHANTS, DEFAULT_NETWORKS } from '../seedData';
import { 
  ArrowLeft, Send, Users, ShieldAlert, ChevronRight, Check, 
  HelpCircle, AlertCircle, RefreshCw, Star, ArrowUpRight, DollarSign, Lock,
  Key, ArrowRight, X, AlertTriangle, ShieldCheck, Eye, Wallet, ExternalLink, Copy, CheckCircle2,
  TrendingUp, Sparkles, Layers
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

interface WithdrawalWorkflowProps {
  user: any;
  onBack: () => void;
  onSuccess: () => void;
  onGoToProfile?: () => void;
  onViewContract?: (contractId?: string) => void;
}

export default function WithdrawalWorkflow({ user, onBack, onSuccess, onGoToProfile, onViewContract }: WithdrawalWorkflowProps) {
  const [method, setMethod] = useState<'selection' | 'crypto_coin_select' | 'crypto' | 'p2p' | 'p2p_calc' | 'p2p_instructions' | 'p2p_pin_confirm' | 'crypto_pin_confirm' | 'bind_address'>('crypto_coin_select');

  const handleGoToPinSettings = () => {
    localStorage.setItem('profile_subpage', 'pin');
    if (onGoToProfile) {
      onGoToProfile();
    } else {
      onBack();
    }
  };

  const handleGoToAddressBinding = () => {
    localStorage.setItem('profile_subpage', 'withdrawal_address');
    if (onGoToProfile) {
      onGoToProfile();
    } else {
      onBack();
    }
  };

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
  const [lockedUSDT, setLockedUSDT] = useState<number>(0);
  const [activeInvestments, setActiveInvestments] = useState<any[]>([]);
  const [activeCopyContracts, setActiveCopyContracts] = useState<UserCopyTrade[]>([]);
  const [totalCopyContractsCount, setTotalCopyContractsCount] = useState<number>(0);
  const [copyTradesLoaded, setCopyTradesLoaded] = useState<boolean>(false);
  const [hasCopyTradeTx, setHasCopyTradeTx] = useState<boolean>(false);
  const [showActiveContractWarningModal, setShowActiveContractWarningModal] = useState<boolean>(false);
  const [pendingWithdrawType, setPendingWithdrawType] = useState<'crypto' | 'p2p' | null>(null);
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, CryptoPrice>>({});

  // Account eligibility check: User must have participated in at least one copy trading contract
  const hasHadCopyContract = totalCopyContractsCount > 0 || ((profile?.lockedCopyTradeCapital || 0) > 0) || hasCopyTradeTx;

  // In-flow Address Binding States
  const [bindAddressInput, setBindAddressInput] = useState<string>('');
  const [bindPinInput, setBindPinInput] = useState<string>('');
  const [bind2faInput, setBind2faInput] = useState<string>('');
  const [bindSaving, setBindSaving] = useState<boolean>(false);
  const [copiedBoundAddr, setCopiedBoundAddr] = useState<boolean>(false);
  
  // Asset holding helpers
  const getCoinHolding = (symbol: string): number => {
    const symUpper = symbol.toUpperCase();
    if (symUpper === 'USDT') {
      return profile?.balance || 0;
    }
    if (profile?.holdings && profile.holdings[symUpper] !== undefined) {
      return profile.holdings[symUpper];
    }
    return 0;
  };

  const getLockedAmount = (symbol: string): number => {
    const symUpper = symbol.toUpperCase();
    if (symUpper === 'USDT') {
      return lockedUSDT;
    }
    return activeInvestments
      .filter((inv: any) => inv.coinSymbol === symUpper && inv.status === 'active')
      .reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
  };

  const getUnlockedCoinHolding = (symbol: string): number => {
    const symUpper = symbol.toUpperCase();
    const rawHolding = getCoinHolding(symUpper);
    const locked = getLockedAmount(symUpper);
    return Math.max(0, rawHolding - locked);
  };

  const getCoinPrice = (symbol: string): number => {
    const symUpper = symbol.toUpperCase();
    if (symUpper === 'USDT' || symUpper === 'USDC') return 1;
    return cryptoPrices[symUpper]?.price || 0;
  };
  
  // Crypto States
  const [networks, setNetworks] = useState<CryptoNetwork[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<CryptoNetwork | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [destAddress, setDestAddress] = useState<string>('');
  const [amountUSD, setAmountUSD] = useState<string>('');
  const [walletPIN, setWalletPIN] = useState<string>('');
  
  // P2P States
  const [merchants, setMerchants] = useState<P2PMerchant[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<P2PMerchant | null>(null);
  const [p2pUSDAmount, setP2pUSDAmount] = useState<string>('');
  const [p2pTxId] = useState<string>(() => 'CME-SELL-' + Math.floor(1000000 + Math.random() * 9000000));

  const toast = useToast();
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  const setError = (msg: string | null) => {
    setErrorState(msg);
    if (msg) {
      toast.error(msg, 'Withdrawal Error');
    }
  };
  const error = errorState;
  const [twoFactorCode, setTwoFactorCode] = useState<string>('');

  // Auto-clear error when user switches navigation step, merchant, coin, or input amounts
  useEffect(() => {
    setErrorState(null);
  }, [method, selectedMerchant?.id, selectedCoin?.id, p2pUSDAmount, amountUSD]);

  // Fetch latest balance, networks, merchants & real-time active copy trades
  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);

    // 1. User Account Real-time Listener
    const userRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userRef, (userSnap) => {
      if (userSnap.exists()) {
        setProfile(userSnap.data() as UserAccount);
      }
    }, (err) => {
      console.error('Error fetching user profile:', err);
    });

    // 2. Investments Real-time Listener (Locked USDT)
    const invCol = collection(db, 'investments');
    const invQuery = query(invCol, where('userId', '==', user.uid));
    const unsubscribeInvestments = onSnapshot(invQuery, (invSnap) => {
      const invList = invSnap.docs.map(d => d.data());
      const userActiveInvs = invList.filter((inv: any) => inv.status === 'active');
      setActiveInvestments(userActiveInvs);
      const lockedSum = userActiveInvs
        .filter((inv: any) => inv.coinSymbol === 'USDT')
        .reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
      setLockedUSDT(lockedSum);
    }, (err) => {
      console.error('Error fetching investments:', err);
    });

    // 3. User Copy Trades Real-time Listener (Matches both 'ACTIVE' and case-insensitive 'active')
    const copyCol = collection(db, 'user_copy_trades');
    const copyQuery = query(copyCol, where('userId', '==', user.uid));
    const unsubscribeCopyTrades = onSnapshot(copyQuery, (copySnap) => {
      const allTrades = copySnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as UserCopyTrade));
      const activeContracts = allTrades.filter(t => {
        const stat = (t.status || '').toString().trim().toUpperCase();
        return stat === 'ACTIVE';
      });
      setActiveCopyContracts(activeContracts);
      setTotalCopyContractsCount(allTrades.length);
      setCopyTradesLoaded(true);
    }, (err) => {
      console.error('Error listening to copy trades:', err);
      setCopyTradesLoaded(true);
    });

    // 4. One-time check for historical copy trade transactions as an extra fallback
    const txCol = collection(db, 'transactions');
    const txQuery = query(txCol, where('userId', '==', user.uid));
    getDocs(txQuery).then((snap) => {
      const found = snap.docs.some(d => {
        const data = d.data();
        const t = (data.type || '').toLowerCase();
        const title = (data.title || '').toLowerCase();
        const msg = (data.paymentMessage || '').toLowerCase();
        return t.includes('copy_trade') || title.includes('copy trade') || msg.includes('copy trade');
      });
      if (found) setHasCopyTradeTx(true);
    }).catch((err) => {
      console.error('Error checking copy trade transactions:', err);
    });

    // 4. One-time fetch for static networks, prices, and merchants
    async function fetchStaticData() {
      try {
        const pricesCol = collection(db, 'crypto_prices');
        const pricesSnap = await getDocs(pricesCol);
        const pricesMap: Record<string, CryptoPrice> = {};
        pricesSnap.docs.forEach(docSnap => {
          const data = docSnap.data() as CryptoPrice;
          if (data && data.symbol) {
            pricesMap[data.symbol.toUpperCase()] = data;
          }
        });
        setCryptoPrices(pricesMap);

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

        if (netList.length === 0) {
          netList = [...DEFAULT_NETWORKS];
        }

        const order = ['usdt', 'usdc', 'btc', 'eth', 'sol', 'bnb', 'xrp', 'wld', 'trx', 'doge'];
        netList.sort((a, b) => {
          const indexA = order.indexOf(a.id);
          const indexB = order.indexOf(b.id);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.id.localeCompare(b.id);
        });
        setNetworks(netList);
        if (netList.length > 0) {
          setSelectedCoin(netList[0]);
          if (netList[0].networks.length > 0) {
            setSelectedNetwork(netList[0].networks[0]);
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
        console.error('Error fetching static details:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStaticData();

    return () => {
      unsubscribeUser();
      unsubscribeInvestments();
      unsubscribeCopyTrades();
    };
  }, [user?.uid]);

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

  // Auto-sync bound BEP20 address
  useEffect(() => {
    if (profile?.bep20WithdrawalAddress) {
      setDestAddress(profile.bep20WithdrawalAddress);
    }
  }, [profile?.bep20WithdrawalAddress]);

  const handleSaveInflowBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanAddress = bindAddressInput.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
      setError('Invalid BEP20 address. Must be a valid 42-character BNB Smart Chain address starting with 0x (e.g. 0x71C...3a9F).');
      return;
    }

    if (!profile?.walletPassword) {
      setError('Please configure your 4-digit Wallet Security PIN in Settings first before binding a withdrawal address.');
      return;
    }

    if (bindPinInput !== profile.walletPassword) {
      setError('Incorrect 4-digit Wallet Security PIN. Please verify your PIN.');
      return;
    }

    if (profile?.twoFactorEnabled) {
      if (!bind2faInput || bind2faInput.length !== 6 || isNaN(Number(bind2faInput))) {
        setError('Please enter a valid 6-digit Google Authenticator code.');
        return;
      }
    }

    setBindSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        bep20WithdrawalAddress: cleanAddress,
        bep20AddressBoundAt: new Date().toISOString(),
        withdrawalAddressVerified: true
      });

      setProfile(prev => prev ? {
        ...prev,
        bep20WithdrawalAddress: cleanAddress,
        bep20AddressBoundAt: new Date().toISOString(),
        withdrawalAddressVerified: true
      } : null);

      setDestAddress(cleanAddress);
      setBindAddressInput('');
      setBindPinInput('');
      setBind2faInput('');
      toast.success('BEP20 withdrawal address locked and bound successfully!', 'Address Bound');

      if (selectedCoin) {
        setMethod('crypto');
      } else {
        setMethod('crypto_coin_select');
      }
    } catch (err: any) {
      console.error('Error binding BEP20 address in workflow:', err);
      setError(err.message || 'Failed to bind BEP20 address.');
    } finally {
      setBindSaving(false);
    }
  };

  // Helper regex validator for destination crypto addresses based on selected network
  const validateCryptoAddress = (address: string, networkName: string): boolean => {
    const trimmed = address.trim();
    if (!trimmed) return false;

    const upperNet = networkName.toUpperCase();
    if (upperNet.includes('TRC20') || upperNet.includes('TRON')) {
      return /^T[a-zA-HJ-NP-Z0-9]{33}$/.test(trimmed);
    }
    if (upperNet.includes('ERC20') || upperNet.includes('BEP20') || upperNet.includes('POLYGON') || upperNet.includes('BASE') || upperNet.includes('ARBITRUM') || upperNet.includes('OPTIMISM') || upperNet.includes('AVALANCHE') || upperNet.includes('BNB')) {
      return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
    }
    if (upperNet.includes('BTC') || upperNet.includes('BITCOIN')) {
      return /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed);
    }
    if (upperNet.includes('SOL') || upperNet.includes('SOLANA')) {
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
    }
    // Generic check for other blockchains (at least 20 non-whitespace chars)
    return trimmed.length >= 10;
  };

  // Pre-flight check and modal prompt for Crypto Withdrawal
  const handleInitiateCryptoWithdrawal = async () => {
    if (copyTradesLoaded && !hasHadCopyContract) {
      setError('Withdrawal restricted: You must activate at least one Copy Trading contract before you can withdraw funds.');
      return;
    }

    const coinSym = selectedCoin ? selectedCoin.id.toUpperCase() : 'USDT';
    const isUSDT = coinSym === 'USDT';

    if (isUSDT && !profile?.bep20WithdrawalAddress) {
      setMethod('bind_address');
      setError('Please bind your USDT BEP20 withdrawal address before requesting a withdrawal.');
      return;
    }

    if (!amountUSD || parseFloat(amountUSD) <= 0) {
      setError('Please enter a valid amount to withdraw.');
      return;
    }
    const usdVal = parseFloat(amountUSD);
    const unlockedHolding = getUnlockedCoinHolding(coinSym);
    const price = getCoinPrice(coinSym);
    const availableUSD = isUSDT ? Math.max(0, (profile?.balance || 0) - lockedUSDT) : unlockedHolding * price;
    const minLimitUSD = selectedCoin?.minWithdrawalUSD ?? 10;

    if (usdVal < minLimitUSD) {
      setError(`Minimum withdrawal amount for ${formatCoinName(selectedCoin?.tokenName || '')} is $${minLimitUSD.toFixed(2)} USD.`);
      return;
    }

    if (usdVal > availableUSD + 0.0001) {
      if (isUSDT) {
        setError(`Insufficient available balance. You have $${availableUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} available ($${lockedUSDT.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT is locked in MMF).`);
      } else {
        setError(`Insufficient ${coinSym} balance. You have ${unlockedHolding.toFixed(6)} ${coinSym} (≈ $${availableUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD) available.`);
      }
      return;
    }

    const targetAddress = isUSDT ? (profile?.bep20WithdrawalAddress || destAddress) : destAddress;
    if (!targetAddress || !targetAddress.trim()) {
      setError(`Please enter a valid destination ${coinSym} withdrawal address.`);
      return;
    }

    if (!validateCryptoAddress(targetAddress, selectedNetwork)) {
      if (isUSDT) {
        setError('Invalid bound BEP20 destination address. Must be a valid 42-character BNB Smart Chain address starting with 0x.');
      } else {
        setError(`Invalid destination address format for ${selectedNetwork}. Please verify the address.`);
      }
      return;
    }
    if (!profile?.walletPassword) {
      setError('Please configure a 4-digit Wallet Security PIN in your Profile settings before withdrawing.');
      return;
    }
    if (walletPIN !== profile.walletPassword) {
      setError('Incorrect Wallet Security PIN. Please verify your PIN.');
      return;
    }
    if (profile && !profile.withdrawalEnabled) {
      setError('Your withdrawal permission is currently suspended.');
      return;
    }

    // Check if user has active copy trading contracts with any expert (both state and live check)
    try {
      const copyTradesCol = collection(db, 'user_copy_trades');
      const copyTradesSnap = await getDocs(query(copyTradesCol, where('userId', '==', user.uid)));
      const activeContracts = copyTradesSnap.docs
        .map(d => ({ ...d.data(), id: d.id } as UserCopyTrade))
        .filter(t => (t.status || '').toString().trim().toUpperCase() === 'ACTIVE');

      if (activeContracts.length > 0 || activeCopyContracts.length > 0) {
        setActiveCopyContracts(activeContracts.length > 0 ? activeContracts : activeCopyContracts);
        setPendingWithdrawType('crypto');
        setShowActiveContractWarningModal(true);
        return;
      }
    } catch (e) {
      console.error('Error verifying active contracts:', e);
      if (activeCopyContracts.length > 0) {
        setPendingWithdrawType('crypto');
        setShowActiveContractWarningModal(true);
        return;
      }
    }

    // Direct execution with standard 15% fee
    executeCryptoWithdrawSubmit(15);
  };

  // Submit Crypto Withdrawal Execution
  const executeCryptoWithdrawSubmit = async (feePercentToApply: number) => {
    if (copyTradesLoaded && !hasHadCopyContract) {
      setError('Withdrawal restricted: You must activate at least one Copy Trading contract before you can withdraw funds.');
      return;
    }

    const usdVal = parseFloat(amountUSD);
    const coinSym = selectedCoin ? selectedCoin.id.toUpperCase() : 'USDT';
    const price = getCoinPrice(coinSym);

    setSubmitting(true);
    setError(null);

    try {
      const feePercent = feePercentToApply;
      const feeAmount = parseFloat((usdVal * (feePercent / 100)).toFixed(2));
      const netAmount = parseFloat((usdVal - feeAmount).toFixed(2));
      const coinAmt = price > 0 ? parseFloat((usdVal / price).toFixed(8)) : usdVal;

      // Run transaction to immediately deduct balance and record withdrawal request
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) {
          throw new Error('User record does not exist.');
        }

        const userData = userSnap.data();

        if (coinSym === 'USDT') {
          const currentBal = userData.balance || 0;
          const currentAvailable = Math.max(0, currentBal - lockedUSDT);
          if (usdVal > currentAvailable + 0.0001) {
            throw new Error(`Insufficient available balance during execution. You have $${currentAvailable.toFixed(2)} available.`);
          }
          transaction.update(userRef, {
            balance: parseFloat((currentBal - usdVal).toFixed(2))
          });
        } else {
          const currentHoldings = userData.holdings || {};
          const currentCoinBal = currentHoldings[coinSym] || 0;
          if (coinAmt > currentCoinBal + 0.000001) {
            throw new Error(`Insufficient ${coinSym} balance. You have ${currentCoinBal.toFixed(6)} ${coinSym}.`);
          }
          transaction.update(userRef, {
            holdings: {
              ...currentHoldings,
              [coinSym]: Math.max(0, currentCoinBal - coinAmt)
            }
          });
        }

        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          id: txRef.id,
          userId: user.uid,
          userEmail: user.email,
          type: 'withdraw_crypto',
          amount: usdVal,
          feePercent: feePercent,
          feeAmount: feeAmount,
          netAmount: netAmount,
          coinSymbol: coinSym,
          coinAmount: coinAmt,
          earlyContractWithdrawal: feePercent === 50,
          status: 'PENDING APPROVAL',
          createdAt: serverTimestamp(),
          network: selectedNetwork,
          address: destAddress,
          merchantName: selectedCoin ? formatCoinName(selectedCoin.tokenName) : ''
        });
      });

      setShowActiveContractWarningModal(false);
      onSuccess();
    } catch (err: any) {
      console.error('Crypto withdrawal error:', err);
      setError(err.message || 'Failed to initialize crypto withdrawal.');
    } finally {
      setSubmitting(false);
    }
  };

  // Pre-flight check and modal prompt for P2P Withdrawal
  const handleInitiateP2PWithdrawal = async () => {
    if (copyTradesLoaded && !hasHadCopyContract) {
      setError('Withdrawal restricted: You must activate at least one Copy Trading contract before you can withdraw funds.');
      return;
    }

    if (profile && !profile.withdrawalEnabled) {
      setError('Your withdrawal permission is currently suspended.');
      return;
    }
    if (!profile?.walletPassword) {
      setError('Please configure a 4-digit Wallet Security PIN in your Profile settings before withdrawing.');
      return;
    }
    if (walletPIN !== profile.walletPassword) {
      setError('Incorrect Wallet Security PIN. Please verify your PIN.');
      return;
    }

    // Check if user has active copy trading contracts with any expert (both state and live check)
    try {
      const copyTradesCol = collection(db, 'user_copy_trades');
      const copyTradesSnap = await getDocs(query(copyTradesCol, where('userId', '==', user.uid)));
      const activeContracts = copyTradesSnap.docs
        .map(d => ({ ...d.data(), id: d.id } as UserCopyTrade))
        .filter(t => (t.status || '').toString().trim().toUpperCase() === 'ACTIVE');

      if (activeContracts.length > 0 || activeCopyContracts.length > 0) {
        setActiveCopyContracts(activeContracts.length > 0 ? activeContracts : activeCopyContracts);
        setPendingWithdrawType('p2p');
        setShowActiveContractWarningModal(true);
        return;
      }
    } catch (e) {
      console.error('Error verifying active contracts:', e);
      if (activeCopyContracts.length > 0) {
        setPendingWithdrawType('p2p');
        setShowActiveContractWarningModal(true);
        return;
      }
    }

    // Direct execution with standard 15% fee
    executeP2PSellRelease(15);
  };

  // Submit P2P Withdrawal Execution (User releases Escrow upon receiving payment)
  const executeP2PSellRelease = async (feePercentToApply: number) => {
    if (copyTradesLoaded && !hasHadCopyContract) {
      setError('Withdrawal restricted: You must activate at least one Copy Trading contract before you can withdraw funds.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const usdVal = parseFloat(p2pUSDAmount);
      const localShillings = usdVal * (selectedMerchant?.rate || 0);
      const feePercent = feePercentToApply;
      const feeAmount = parseFloat((usdVal * (feePercent / 100)).toFixed(2));
      const netAmount = parseFloat((usdVal - feeAmount).toFixed(2));

      // Perform transaction to safely deduct balance and create transaction
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error("User record doesn't exist!");
        }

        const currentBalance = userDoc.data().balance || 0;
        const availableBalance = Math.max(0, currentBalance - lockedUSDT);
        if (usdVal > availableBalance) {
          throw new Error(`Insufficient available balance during transaction execution. You have $${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} available ($${lockedUSDT.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT is locked in MMF).`);
        }

        // Deduct balance instantly
        transaction.update(userRef, {
          balance: parseFloat((currentBalance - usdVal).toFixed(2))
        });

        // Add transaction marked as APPROVED
        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          id: txRef.id,
          userId: user.uid,
          userEmail: user.email,
          type: 'withdraw_p2p',
          amount: usdVal,
          feePercent: feePercent,
          feeAmount: feeAmount,
          netAmount: netAmount,
          localAmount: localShillings,
          earlyContractWithdrawal: feePercent === 50,
          status: 'APPROVED', // Marked approved instantly because client released it!
          createdAt: serverTimestamp(),
          merchantName: selectedMerchant?.name || '',
          address: selectedMerchant?.paymentNumber || '',
          paymentMessage: `Released by Client: Received local payment of ${localShillings.toLocaleString()} Shs.`
        });
      });

      setShowActiveContractWarningModal(false);
      onSuccess();
    } catch (err: any) {
      console.error('P2P release error:', err);
      setError(err.message || 'Failed to release P2P payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="withdraw-workflow-container" className="max-w-md mx-auto p-4 sm:p-5 bg-[#EBF9F0] text-zinc-800 min-h-[calc(100vh-140px)]">
      {/* Dynamic Header */}
      <div className="flex items-center gap-3 mb-6">
        <button 
          id="withdraw-back-btn"
          onClick={() => {
            if (!hasHadCopyContract) {
              onBack();
              return;
            }
            if (method === 'selection' || method === 'crypto_coin_select') onBack();
            else if (method === 'bind_address') {
              if (selectedCoin) setMethod('crypto_coin_select');
              else onBack();
            }
            else if (method === 'crypto') setMethod('crypto_coin_select');
            else if (method === 'crypto_pin_confirm') setMethod('crypto');
            else onBack();
          }}
          className="p-2 rounded-full bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-800">
            {!hasHadCopyContract ? 'Withdrawal Verification' : (
              <>
                {(method === 'selection' || method === 'crypto_coin_select') && 'Select Coin to Withdraw'}
                {method === 'bind_address' && 'Bind USDT BEP20 Address'}
                {method === 'crypto' && 'Crypto Withdrawal Details'}
                {method === 'crypto_pin_confirm' && 'Verify Security PIN'}
              </>
            )}
          </h2>
          <p className="text-xs text-zinc-500">
            {!hasHadCopyContract ? 'Copy Trading contract activation required' : (
              <>
                {(method === 'selection' || method === 'crypto_coin_select') && 'Select a coin from your available asset holdings to withdraw'}
                {method === 'bind_address' && 'USDT BEP20 (BNB Smart Chain) verified destination wallet'}
                {method === 'crypto' && `Configure network and destination for ${selectedCoin ? formatCoinName(selectedCoin.tokenName) : ''}`}
                {method === 'crypto_pin_confirm' && 'Enter your 4-digit PIN to authorize withdrawal'}
              </>
            )}
          </p>
        </div>
      </div>

      {hasHadCopyContract && profile && !profile.withdrawalEnabled && (
        <div id="withdrawal-disabled-alert" className="p-3.5 mb-5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start gap-2.5">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" strokeWidth={2.5} />
          <span>
            <strong>Withdrawal Restricted:</strong> Withdrawal permissions are currently suspended for your account. Please contact support.
          </span>
        </div>
      )}

      {/* Alert banner if user has NOT configured a Wallet Security PIN */}
      {hasHadCopyContract && profile && !profile.walletPassword && (
        <div id="missing-pin-top-banner" className="p-4 mb-5 bg-amber-50 border border-amber-200 text-zinc-800 rounded-2xl text-xs space-y-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 shrink-0">
              <Key size={18} />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-zinc-900">Security PIN Not Set</h4>
              <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">
                You must set up a 4-digit Wallet Security PIN before you can perform any withdrawals.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="setup-pin-top-btn"
            onClick={handleGoToPinSettings}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/10 hover:from-amber-600 hover:to-orange-600 cursor-pointer"
          >
            <Key size={14} />
            <span>Set Up Security PIN Now</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Alert banner if user has NOT bound their BEP20 withdrawal address */}
      {hasHadCopyContract && profile && profile.walletPassword && !profile.bep20WithdrawalAddress && method !== 'bind_address' && (
        <div id="missing-bep20-address-banner" className="p-4 mb-5 bg-amber-50/90 border border-amber-300 text-zinc-800 rounded-2xl text-xs space-y-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 shrink-0">
              <Wallet size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm text-zinc-900">BEP20 Address Binding Required</h4>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-amber-200/80 text-amber-900 rounded">BEP20</span>
              </div>
              <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                To prevent blockchain mismatch and fund loss, bind your verified BEP20 destination address before proceeding with crypto cashouts.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="bind-bep20-address-top-btn"
            onClick={() => setMethod('bind_address')}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/10 hover:from-amber-600 hover:to-amber-700 cursor-pointer"
          >
            <Wallet size={14} />
            <span>Bind BEP20 Withdrawal Address</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Inline error callout with direct PIN action buttons */}
      {error && (
        <div id="withdrawal-error-banner" className="p-3.5 mb-5 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs space-y-2.5 shadow-sm relative">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5 pr-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
              <span className="font-semibold text-xs leading-snug">{error}</span>
            </div>
            <button
              type="button"
              id="dismiss-withdrawal-error-btn"
              onClick={() => setErrorState(null)}
              className="p-1 hover:bg-red-100 rounded-lg text-red-600 transition-colors cursor-pointer shrink-0"
              title="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>

          {!profile?.walletPassword && (
            <button
              type="button"
              id="error-setup-pin-redirect-btn"
              onClick={handleGoToPinSettings}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all cursor-pointer shadow-sm"
            >
              <Key size={13} />
              <span>Set Up Security PIN in Settings</span>
              <ArrowRight size={13} />
            </button>
          )}

          {profile?.walletPassword && (error.toLowerCase().includes('pin') || error.toLowerCase().includes('incorrect')) && (
            <button
              type="button"
              id="error-change-pin-redirect-btn"
              onClick={handleGoToPinSettings}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all cursor-pointer shadow-sm"
            >
              <Key size={13} />
              <span>Change or Reset Your Security PIN</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}



      {(loading || !copyTradesLoaded) && (
        <div className="flex flex-col items-center justify-center min-h-[250px] gap-3">
          <RefreshCw size={24} className="text-amber-500 animate-spin" />
          <span className="text-xs text-zinc-500 font-medium">Checking withdrawal eligibility...</span>
        </div>
      )}

      {!loading && copyTradesLoaded && !hasHadCopyContract && (
        <div id="copy-trade-required-card" className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white border border-amber-200/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 text-left relative overflow-hidden">
            {/* Top decorative accent */}
            <div className="flex items-center gap-3.5 pb-4 border-b border-zinc-100">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
                <Lock size={22} className="text-white" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300/70 inline-block mb-1">
                  SECURITY POLICY ENFORCEMENT
                </span>
                <h3 className="text-base font-black text-zinc-900 leading-snug">Copy Trading Contract Required</h3>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">Turnover activation required to withdraw</p>
              </div>
            </div>

            {/* Explanation callout */}
            <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl space-y-2">
              <p className="text-xs font-semibold text-amber-950 leading-relaxed">
                To prevent pass-through wash transactions and protect ecosystem liquidity, <strong>withdrawals are restricted for newly deposited funds</strong> until you have activated at least one Copy Trading contract.
              </p>
            </div>

            {/* Account Status Card */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200/60">
                <span className="text-zinc-500 font-medium">Wallet Balance</span>
                <span className="font-mono font-black text-zinc-900 text-sm">
                  ${(profile?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200/60">
                <span className="text-zinc-500 font-medium">Copy Trading Contracts</span>
                <span className="font-bold text-amber-600 bg-amber-100/70 px-2 py-0.5 rounded-md text-[11px]">
                  0 Contracts Executed
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-medium">Withdrawal Status</span>
                <span className="font-bold text-red-600 bg-red-100/70 px-2 py-0.5 rounded-md text-[11px] flex items-center gap-1">
                  <Lock size={11} /> Locked
                </span>
              </div>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="space-y-2.5 pt-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-zinc-600">How to Unlock Withdrawals</h4>
              
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2.5 p-2.5 bg-zinc-50/70 border border-zinc-200/60 rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <div>
                    <span className="font-bold text-zinc-900 block">Select a Verified Expert Trader</span>
                    <span className="text-[11px] text-zinc-500 leading-snug">Explore vetted copy trading leads with verified performance and win rates.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 bg-zinc-50/70 border border-zinc-200/60 rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <div>
                    <span className="font-bold text-zinc-900 block">Allocate Trade Capital</span>
                    <span className="text-[11px] text-zinc-500 leading-snug">Transfer wallet funds to your Trade Balance and start copying daily market signals.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 bg-zinc-50/70 border border-zinc-200/60 rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <div>
                    <span className="font-bold text-zinc-900 block">Instant Withdrawal Access</span>
                    <span className="text-[11px] text-zinc-500 leading-snug">Once you have participated in copy trading, your account is permanently unlocked for withdrawals.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                id="copy-trade-required-explore-btn"
                onClick={() => {
                  if (onViewContract) {
                    onViewContract();
                  } else {
                    onBack();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl text-xs font-black transition-all shadow-md shadow-amber-500/20 cursor-pointer uppercase tracking-wider active:scale-[0.99]"
              >
                <TrendingUp size={16} />
                <span>Explore Copy Traders</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                id="copy-trade-required-back-btn"
                onClick={onBack}
                className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-2xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && copyTradesLoaded && hasHadCopyContract && (
        <>
          {/* Crypto Coin Select Panel (Default Withdrawal Screen - filtered by user asset holdings) */}
          {(method === 'selection' || method === 'crypto_coin_select') && (() => {
            const userNetworks = networks.filter(net => {
              const sym = net.id.toUpperCase();
              return getUnlockedCoinHolding(sym) > 0;
            });

            if (userNetworks.length === 0) {
              return (
                <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                    <AlertCircle size={24} />
                  </div>
                  <h3 className="font-extrabold text-sm text-zinc-800">No Crypto Holdings Available</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed max-w-xs mx-auto">
                    You currently do not have any unlocked crypto holdings available for withdrawal. Please deposit or trade to acquire assets.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {userNetworks.map(net => {
                  const formattedName = formatCoinName(net.tokenName);
                  const sym = net.id.toUpperCase();
                  const unlocked = getUnlockedCoinHolding(sym);
                  const price = getCoinPrice(sym);
                  const estUSD = sym === 'USDT' ? unlocked : unlocked * price;

                  return (
                    <button
                      key={net.id}
                      id={`crypto-withdraw-select-asset-${net.id}`}
                      onClick={() => {
                        setSelectedCoin(net);
                        const isUSDT = sym === 'USDT';

                        if (isUSDT) {
                          const bepNet = net.networks.find(n => n.toUpperCase().includes('BEP20') || n.toUpperCase().includes('BSC') || n.toUpperCase().includes('BNB')) || (net.networks.length > 0 ? net.networks[0] : 'BEP20');
                          setSelectedNetwork(bepNet);

                          if (!profile?.bep20WithdrawalAddress) {
                            setMethod('bind_address');
                          } else {
                            setDestAddress(profile.bep20WithdrawalAddress);
                            setMethod('crypto');
                          }
                        } else {
                          const defaultNet = net.networks && net.networks.length > 0 ? net.networks[0] : 'Standard';
                          setSelectedNetwork(defaultNet);
                          setDestAddress('');
                          setMethod('crypto');
                        }
                      }}
                      className="w-full flex items-center justify-between p-4 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-2xl transition-all text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5">
                        <CoinIcon symbol={sym} className="w-10 h-10 shrink-0" />
                        <div>
                          <h4 className="font-bold text-sm text-zinc-800 group-hover:text-amber-600 transition-colors">
                            {formattedName}
                          </h4>
                          <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">
                            Available: {unlocked < 1 && sym !== 'USDT' && sym !== 'USDC' ? unlocked.toFixed(6) : unlocked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {sym}
                            {sym !== 'USDT' && sym !== 'USDC' && estUSD > 0 && ` (≈ $${estUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
                          </p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            Supported Networks: {net.networks.join(', ')}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-600 transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* BEP20 Address Binding Interceptor Screen */}
          {method === 'bind_address' && (
            <div className="space-y-4">
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4 text-left">
                <div className="flex items-start gap-3.5 pb-3 border-b border-zinc-100">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
                    <Wallet size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-zinc-900">Bind BEP20 Withdrawal Address</h3>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded uppercase">BEP20 Required</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Prevent network mismatch loss with a verified BNB Smart Chain address
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950">
                    <ShieldCheck size={15} className="text-amber-600 shrink-0" />
                    <span>One-Time Address Binding</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    To guarantee that withdrawals are never sent on the wrong network, your payout destination is securely locked to your verified BEP20 (BNB Smart Chain) address.
                  </p>
                </div>

                <form onSubmit={handleSaveInflowBinding} className="space-y-4 pt-1">
                  {/* Address Input */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-zinc-700">BEP20 (BSC) Wallet Address</label>
                      {bindAddressInput.trim() && /^0x[a-fA-F0-9]{40}$/.test(bindAddressInput.trim()) && (
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Valid BEP20 Format
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="inflow-bind-bep20-address"
                        type="text"
                        required
                        placeholder="0x... (42-character BEP20 BNB Smart Chain address)"
                        value={bindAddressInput}
                        onChange={(e) => setBindAddressInput(e.target.value)}
                        className="w-full px-3.5 py-3 bg-zinc-50 border border-zinc-250 rounded-xl text-xs font-mono text-zinc-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400">
                      Must start with <strong className="font-mono text-zinc-600">0x</strong> and be 42 characters long.
                    </p>
                  </div>

                  {/* 4-digit PIN */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-zinc-700">Enter 4-Digit Wallet Security PIN</label>
                      <button
                        type="button"
                        onClick={handleGoToPinSettings}
                        className="text-[11px] text-amber-600 hover:text-amber-700 font-bold cursor-pointer"
                      >
                        Change PIN
                      </button>
                    </div>
                    <input
                      id="inflow-bind-pin"
                      type="password"
                      maxLength={4}
                      required
                      placeholder="••••"
                      value={bindPinInput}
                      onChange={(e) => setBindPinInput(e.target.value.replace(/\D/g, ''))}
                      className="w-32 px-3.5 py-2.5 bg-zinc-50 border border-zinc-250 rounded-xl text-center text-base font-mono tracking-widest text-zinc-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>

                  {/* 2FA Code if enabled */}
                  {profile?.twoFactorEnabled && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700">Google Authenticator (2FA) Code</label>
                      <input
                        id="inflow-bind-2fa"
                        type="text"
                        maxLength={6}
                        required
                        placeholder="6-digit 2FA code"
                        value={bind2faInput}
                        onChange={(e) => setBind2faInput(e.target.value.replace(/\D/g, ''))}
                        className="w-40 px-3.5 py-2.5 bg-zinc-50 border border-zinc-250 rounded-xl text-center text-base font-mono tracking-widest text-zinc-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                  )}

                  <button
                    id="save-inflow-bind-bep20-btn"
                    type="submit"
                    disabled={bindSaving || !bindAddressInput || !bindPinInput || bindPinInput.length !== 4}
                    className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    {bindSaving ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Binding BEP20 Address...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={15} />
                        <span>Lock & Bind BEP20 Address</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="pt-2 border-t border-zinc-100 text-center">
                  <button
                    type="button"
                    onClick={handleGoToAddressBinding}
                    className="text-xs text-amber-600 hover:text-amber-700 font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Or manage bound withdrawal address in Profile Settings</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Crypto Withdrawal Panel */}
          {method === 'crypto' && selectedCoin && (() => {
            const sym = selectedCoin.id.toUpperCase();
            const isUSDT = sym === 'USDT';
            const unlocked = getUnlockedCoinHolding(sym);
            const price = getCoinPrice(sym);
            const availableUSD = isUSDT ? Math.max(0, (profile?.balance || 0) - lockedUSDT) : unlocked * price;
            const currentNumVal = parseFloat(amountUSD || '0');
            const coinEquivalent = price > 0 ? (currentNumVal / price) : 0;
            const boundAddress = profile?.bep20WithdrawalAddress || destAddress;

            return (
              <div className="space-y-4 text-left">
                {/* Selected Coin Banner */}
                <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-between gap-3.5 mb-2">
                  <div className="flex items-center gap-3.5">
                    <CoinIcon symbol={sym} className="w-11 h-11 rounded-xl shrink-0" />
                    <div>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Selected Asset</span>
                      <span className="text-sm font-black text-zinc-800">{formatCoinName(selectedCoin.tokenName)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Asset Holding</span>
                    <span className="text-xs font-black text-emerald-600">
                      {unlocked < 1 && sym !== 'USDT' && sym !== 'USDC' ? unlocked.toFixed(6) : unlocked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {sym}
                    </span>
                    {sym !== 'USDT' && sym !== 'USDC' && (
                      <span className="text-[10px] text-zinc-500 block">≈ ${availableUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</span>
                    )}
                  </div>
                </div>

                {/* Network Indicator / Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                      Withdrawal Network
                    </label>
                    {isUSDT ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                        <ShieldCheck size={12} className="text-amber-600" />
                        Locked to BEP20
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                        {selectedCoin.networks.length} Supported {selectedCoin.networks.length === 1 ? 'Network' : 'Networks'}
                      </span>
                    )}
                  </div>

                  {isUSDT ? (
                    <div className="p-3 bg-white border border-zinc-200 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center font-black text-xs text-amber-600 font-mono">
                          BSC
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-zinc-900">BEP20</span>
                            <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-zinc-100 text-zinc-600">BNB Chain</span>
                          </div>
                          <p className="text-[10px] text-zinc-500">BNB Smart Chain (BEP-20 Standard)</p>
                        </div>
                      </div>
                      <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedCoin.networks.map((netName) => {
                        const isSelected = selectedNetwork === netName;
                        return (
                          <button
                            key={netName}
                            type="button"
                            onClick={() => setSelectedNetwork(netName)}
                            className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-50/80 border-amber-500 text-amber-950 font-bold shadow-sm'
                                : 'bg-white border-zinc-200 hover:border-zinc-300 text-zinc-700'
                            }`}
                          >
                            <span className="font-mono text-xs">{netName}</span>
                            {isSelected && (
                              <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                                <Check size={10} strokeWidth={3} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Destination Address: Bound for USDT vs Editable for non-USDT */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                      {isUSDT ? 'Bound Destination Address' : 'Destination Wallet Address'}
                    </label>
                    {isUSDT && (
                      <button
                        type="button"
                        id="change-bound-address-link"
                        onClick={handleGoToAddressBinding}
                        className="text-[11px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>Change Address</span>
                        <ExternalLink size={11} />
                      </button>
                    )}
                  </div>

                  {isUSDT ? (
                    boundAddress ? (
                      <div className="bg-white border border-zinc-200 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                            <ShieldCheck size={11} className="text-emerald-600" />
                            BEP20 Verified Payout Wallet
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(boundAddress);
                              setCopiedBoundAddr(true);
                              setTimeout(() => setCopiedBoundAddr(false), 2000);
                            }}
                            className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            {copiedBoundAddr ? (
                              <>
                                <Check size={11} className="text-emerald-600" />
                                <span className="text-emerald-600">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="font-mono text-xs text-zinc-900 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/80 break-all select-all font-semibold">
                          {boundAddress}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-center justify-between">
                        <div className="text-xs text-red-800 font-semibold">
                          No bound BEP20 withdrawal address found.
                        </div>
                        <button
                          type="button"
                          onClick={() => setMethod('bind_address')}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 cursor-pointer"
                        >
                          Bind Now
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="space-y-1">
                      <input
                        id="withdraw-crypto-dest-address"
                        type="text"
                        required
                        placeholder={`Enter your ${selectedNetwork} address`}
                        value={destAddress}
                        onChange={(e) => setDestAddress(e.target.value)}
                        className="w-full px-3.5 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 placeholder-zinc-400"
                      />
                      <p className="text-[10px] text-zinc-400">
                        Please make sure your destination address matches the selected network ({selectedNetwork}).
                      </p>
                    </div>
                  )}
                </div>

                {/* Amount USD */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-zinc-500">Amount (USD)</label>
                    <span className="text-[10px] text-zinc-500 font-semibold">
                      Available: {isUSDT ? `$${availableUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `${unlocked.toFixed(6)} ${sym} ($${availableUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })})`}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 font-bold text-sm">$</span>
                    <input
                      id="withdraw-crypto-amount"
                      type="number"
                      required
                      placeholder="0.00"
                      value={amountUSD}
                      onChange={(e) => setAmountUSD(e.target.value)}
                      className="w-full pl-8 pr-16 py-3 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-zinc-800 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setAmountUSD(availableUSD.toFixed(2))}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <span className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 font-black text-[10px] px-2.5 py-1 rounded-md border border-amber-500/30 transition-all cursor-pointer">
                        MAX
                      </span>
                    </button>
                  </div>
                  {(() => {
                    const minLimitUSD = selectedCoin.minWithdrawalUSD ?? 10;
                    const minCoinEquivalent = price > 0 ? (minLimitUSD / price) : 0;
                    return (
                      <div className="flex justify-between items-center text-[11px] font-semibold text-zinc-500 pt-1 px-1">
                        <span>Min. Withdrawal:</span>
                        <span className="text-amber-700 font-bold font-mono">
                          ${minLimitUSD.toFixed(2)} USD
                          {sym !== 'USDT' && sym !== 'USDC' && price > 0 && ` (≈ ${minCoinEquivalent.toFixed(6)} ${sym})`}
                        </span>
                      </div>
                    );
                  })()}
                  {currentNumVal > 0 && price > 0 && sym !== 'USDT' && (
                    <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 p-2 rounded-lg">
                      Withdrawal Asset Value: <span className="font-bold text-zinc-900">{coinEquivalent.toFixed(6)} {sym}</span>
                    </p>
                  )}
                </div>

                {/* Proceed Button */}
                <button
                  id="withdraw-crypto-proceed"
                  onClick={() => {
                    setError(null);
                    if (isUSDT && !profile?.bep20WithdrawalAddress) {
                      setMethod('bind_address');
                      setError('Please bind your USDT BEP20 withdrawal address before requesting a withdrawal.');
                      return;
                    }
                    const activeDest = isUSDT ? (profile?.bep20WithdrawalAddress || destAddress) : destAddress;
                    if (!activeDest || !activeDest.trim()) {
                      setError(`Please enter your destination ${sym} wallet address.`);
                      return;
                    }
                    if (!validateCryptoAddress(activeDest, selectedNetwork)) {
                      if (isUSDT) {
                        setError('Invalid bound BEP20 destination address. Must be a valid 42-character BNB Smart Chain address starting with 0x.');
                      } else {
                        setError(`Invalid destination address format for ${selectedNetwork}. Please verify the address.`);
                      }
                      return;
                    }
                    const usdVal = parseFloat(amountUSD);
                    const minLimitUSD = selectedCoin.minWithdrawalUSD ?? 10;
                    if (!amountUSD || isNaN(usdVal) || usdVal <= 0) {
                      setError('Please enter a valid withdrawal amount.');
                      return;
                    }
                    if (usdVal < minLimitUSD) {
                      setError(`Minimum withdrawal amount for ${formatCoinName(selectedCoin.tokenName)} is $${minLimitUSD.toFixed(2)} USD.`);
                      return;
                    }
                    if (usdVal > availableUSD + 0.0001) {
                      if (sym === 'USDT') {
                        setError(`Insufficient available balance. You have $${availableUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} available.`);
                      } else {
                        setError(`Insufficient ${sym} balance. You have ${unlocked.toFixed(6)} ${sym} (≈ $${availableUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD) available.`);
                      }
                      return;
                    }
                    if (!profile?.walletPassword) {
                      setError('Please configure a 4-digit Wallet Security PIN in your Profile settings before withdrawing.');
                      return;
                    }
                    setMethod('crypto_pin_confirm');
                  }}
                  className="w-full flex items-center justify-between py-3 px-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:bg-zinc-200 disabled:text-zinc-400 rounded-xl text-sm font-bold transition-all shadow-md mt-6 cursor-pointer"
                >
                  <span>Proceed to Secure Confirmation</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            );
          })()}

          {/* Crypto Enter PIN Final Confirm Screen */}
          {method === 'crypto_pin_confirm' && selectedCoin && (() => {
            const grossVal = parseFloat(amountUSD) || 0;
            const hasActiveContract = activeCopyContracts.length > 0;
            const feeVal = grossVal * 0.15;
            const netVal = grossVal * 0.85;
            const coinSym = selectedCoin.id.toUpperCase();
            const price = getCoinPrice(coinSym);
            const netCoinVal = price > 0 ? (netVal / price) : netVal;

            return (
              <div className="space-y-5 text-left">
                <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col items-center justify-center text-center gap-2.5 pb-2 border-b border-zinc-200/60">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Lock size={22} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-zinc-800">Confirm Crypto Withdrawal</h3>
                      <p className="text-[11px] text-zinc-500">Authorize transfer of assets to your destination address</p>
                    </div>
                  </div>

                  {hasActiveContract && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                      <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-extrabold text-[11px] block text-amber-800 uppercase tracking-wide">Active Trading Contract Detected</span>
                        <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                          Withdrawing now applies a 50% early fee. Standard fee is 15% upon contract completion.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center pb-1 border-b border-zinc-100">
                      <span className="text-zinc-500">Asset</span>
                      <span className="font-mono font-bold text-zinc-800">{formatCoinName(selectedCoin.tokenName)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-zinc-100">
                      <span className="text-zinc-500">Network</span>
                      <span className="font-mono font-bold text-amber-600">{selectedNetwork}</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-zinc-100">
                      <span className="text-zinc-500">Destination Address</span>
                      <span className="font-mono font-bold text-zinc-600 break-all max-w-[180px] text-right">{destAddress}</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-zinc-100">
                      <span className="text-zinc-500">Withdrawal Amount (Gross)</span>
                      <span className="font-mono font-bold text-zinc-800">${grossVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-zinc-100">
                      <span className="text-zinc-500">{hasActiveContract ? 'Standard Fee (15%)' : '15% Withdrawal Fee'}</span>
                      <span className="font-mono font-bold text-red-500">-${feeVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/80">
                      <span className="text-emerald-900 font-bold">Standard Net Payout</span>
                      <div className="text-right">
                        <span className="font-mono font-black text-emerald-700 text-sm block">${netVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                        {coinSym !== 'USDT' && (
                          <span className="font-mono font-semibold text-emerald-600 text-[10px] block">≈ {netCoinVal.toFixed(6)} {coinSym}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-50 border border-zinc-200 text-zinc-600 text-[10px] rounded-xl leading-relaxed text-center">
                    <strong>Caution:</strong> Ensure the wallet address is correct. Crypto transfers are irreversible.
                  </div>
                </div>

                {/* Wallet PIN Form */}
              <div className="space-y-4 bg-white border border-zinc-200 rounded-2xl p-4">
                <div className="space-y-1.5 text-center">
                  <label className="text-xs font-semibold text-zinc-500 block">
                    Enter 4-Digit Wallet Security PIN
                  </label>
                  <input
                    id="withdraw-final-crypto-pin"
                    type="password"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={walletPIN}
                    onChange={(e) => setWalletPIN(e.target.value.replace(/\D/g, ''))}
                    className="w-32 mx-auto px-4 py-3 bg-zinc-50 border border-zinc-250 rounded-xl text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-zinc-800 block"
                  />
                  <button
                    type="button"
                    id="crypto-forgot-pin-btn"
                    onClick={handleGoToPinSettings}
                    className="mt-2 text-amber-600 hover:text-amber-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer mx-auto"
                  >
                    <Key size={13} />
                    <span>Wrong or forgot PIN? Change PIN in Settings</span>
                  </button>
                </div>

                <button
                  id="confirm-crypto-release-btn"
                  onClick={handleInitiateCryptoWithdrawal}
                  disabled={submitting || !walletPIN || walletPIN.length !== 4}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:bg-zinc-200 disabled:text-zinc-400 rounded-xl text-sm font-black transition-all shadow-md cursor-pointer uppercase tracking-wider"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>CONFIRM & SUBMIT WITHDRAWAL</span>
                  )}
                </button>

                <button
                  id="cancel-crypto-pin-confirm-btn"
                  onClick={() => {
                    setError(null);
                    setMethod('crypto');
                  }}
                  className="w-full py-2.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Cancel & Go Back
                </button>
              </div>
            </div>
          );
        })()}

          {/* P2P Sell Board (Merchants) */}
          {method === 'p2p' && (() => {
            const sellMerchants = merchants.filter(m => !m.type || m.type === 'sell' || m.type === 'both');
            return (
              <div className="space-y-4">
                {sellMerchants.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-zinc-500 text-xs">No active sell merchants found. Please try another withdrawal method or check back later.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sellMerchants.map(merch => (
                      <div
                         key={merch.id}
                         id={`p2p-sell-merchant-${merch.id}`}
                         className="bg-white border border-zinc-200 rounded-2xl p-4 hover:border-amber-400 transition-all flex flex-col justify-between gap-4"
                      >
                        <div className="flex justify-between items-start">
                          {/* Rating top-left */}
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 font-bold text-[10px]">
                            <Star size={10} className="fill-amber-500 text-amber-500" />
                            <span>{(merch.rating || 0).toFixed(2)} Rating</span>
                          </div>
                          {/* Merchant Name top-right */}
                          <span className="text-xs font-black text-zinc-700 tracking-tight">{merch.name}</span>
                        </div>

                        <div className="flex justify-between items-end">
                          <div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Payout Rate</div>
                            <div className="text-base font-black text-amber-600 font-mono mt-0.5">
                              {(merch.rate > 1.5 ? merch.rate - 1.5 : 0).toLocaleString()} Shs <span className="text-xs text-zinc-400 font-normal">/ 1 USD</span>
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
                            id={`p2p-sell-btn-${merch.id}`}
                            onClick={() => {
                              setSelectedMerchant(merch);
                              setMethod('p2p_calc');
                            }}
                            className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 rounded-xl text-xs font-bold shadow-md shadow-amber-500/5 cursor-pointer"
                          >
                            SELL
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* P2P SELL Calculator */}
          {method === 'p2p_calc' && selectedMerchant && (
            <div className="space-y-5">
              <div className="bg-white border border-zinc-200 rounded-2xl p-4">
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-500 font-bold">{selectedMerchant.name}</span>
                  <div className="flex items-center gap-1 text-[11px] text-amber-600 font-bold">
                    <Star size={12} className="fill-amber-500 text-amber-500" />
                    <span>{selectedMerchant.rating}</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-zinc-500 flex justify-between items-center">
                  <span>Payout Rate: <strong className="font-mono text-zinc-750">{(selectedMerchant.rate > 1.5 ? selectedMerchant.rate - 1.5 : 0).toFixed(2)} Shs = 1.00 USD</strong></span>
                  <span className="text-[10px] font-mono text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Min {(selectedMerchant.minLimit || 500).toLocaleString()} - Max {(selectedMerchant.maxLimit || 500000).toLocaleString()} Shs
                  </span>
                </div>
              </div>

              {/* Amount input */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-zinc-500">Amount (USD to Sell)</label>
                    <span className="text-[10px] text-zinc-500 font-semibold">
                      Available: ${Math.max(0, (profile?.balance || 0) - lockedUSDT).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 font-bold text-sm">$</span>
                    <input
                      id="p2p-sell-usd-input"
                      type="number"
                      required
                      placeholder="100.00"
                      value={p2pUSDAmount}
                      onChange={(e) => setP2pUSDAmount(e.target.value)}
                      className="w-full pl-8 pr-16 py-3 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-zinc-800 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setP2pUSDAmount(Math.max(0, (profile?.balance || 0) - lockedUSDT).toString())}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <span className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 font-black text-[10px] px-2.5 py-1 rounded-md border border-amber-500/30 transition-all cursor-pointer">
                        MAX
                      </span>
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex justify-between items-center">
                  <span className="text-xs text-zinc-500 font-semibold">Exact Shillings you will receive</span>
                  <span className="text-lg font-black text-amber-600 font-mono">
                    {p2pUSDAmount && parseFloat(p2pUSDAmount) > 0 
                      ? (parseFloat(p2pUSDAmount) * (selectedMerchant.rate > 1.5 ? selectedMerchant.rate - 1.5 : 0)).toLocaleString(undefined, { maximumFractionDigits: 2 }) 
                      : '0.00'
                    } Shs
                  </span>
                </div>
              </div>

              {/* Proceed to Sell */}
              <button
                id="p2p-sell-proceed"
                disabled={!p2pUSDAmount || parseFloat(p2pUSDAmount) <= 0}
                onClick={() => {
                  setError(null);
                  const usdVal = parseFloat(p2pUSDAmount) || 0;
                  const availableBalance = Math.max(0, (profile?.balance || 0) - lockedUSDT);
                  if (usdVal > availableBalance) {
                    setError('Insufficient funds');
                    return;
                  }
                  const rate = selectedMerchant.rate > 1.5 ? selectedMerchant.rate - 1.5 : 0;
                  const shillings = usdVal * rate;
                  const min = selectedMerchant.minLimit || 500;
                  const max = selectedMerchant.maxLimit || 500000;
                  if (shillings < min) {
                    setError(`Minimum payout for ${selectedMerchant.name} is ${min.toLocaleString()} Shs (approx. $${(min / (rate || 1)).toFixed(2)} USD).`);
                    return;
                  }
                  if (shillings > max) {
                    setError(`Maximum payout for ${selectedMerchant.name} is ${max.toLocaleString()} Shs (approx. $${(max / (rate || 1)).toFixed(2)} USD).`);
                    return;
                  }
                  setMethod('p2p_instructions');
                }}
                className="w-full flex items-center justify-between py-3 px-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:bg-zinc-200 disabled:text-zinc-400 rounded-xl text-sm font-bold transition-all shadow-md mt-6 cursor-pointer"
              >
                <span>Proceed to Sell</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* P2P Awaiting Release Confirmation */}
          {method === 'p2p_instructions' && selectedMerchant && (
            <div className="space-y-5">
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">Payout Details</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs border-b border-zinc-100 pb-2">
                    <span className="text-zinc-500">Merchant Name</span>
                    <span className="font-bold text-zinc-850">{selectedMerchant.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-zinc-100 pb-2">
                    <span className="text-zinc-500">Expected Local Shillings</span>
                    <span className="font-mono font-bold text-amber-600">
                      {(parseFloat(p2pUSDAmount) * (selectedMerchant.rate > 1.5 ? selectedMerchant.rate - 1.5 : 0)).toLocaleString()} Shs
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-zinc-100 pb-2">
                    <span className="text-zinc-500">Merchant Payment Number</span>
                    <span className="font-mono font-bold text-zinc-800">{selectedMerchant.paymentNumber}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-zinc-100 pb-2">
                    <span className="text-zinc-500">Reference Sell ID</span>
                    <span className="font-mono font-bold text-zinc-500 text-[10px]">{p2pTxId}</span>
                  </div>
                </div>
 
                <div className="p-3 bg-amber-50 border border-amber-100 text-amber-800 text-[10px] rounded-xl leading-relaxed">
                  <strong>P2P Escrow Protection Notice:</strong> The merchant has been pinged. Once you verify that you have successfully received mobile money of <strong>{(parseFloat(p2pUSDAmount) * (selectedMerchant.rate > 1.5 ? selectedMerchant.rate - 1.5 : 0)).toLocaleString()} Shs</strong>, click the confirmation button below to proceed to the secure release screen.
                </div>
              </div>
 
              {/* Proceed Button */}
              <div className="space-y-3 pt-2">
                <p className="text-xs text-zinc-500 text-center font-bold flex items-center justify-center gap-1">
                  <HelpCircle size={14} className="text-amber-500" />
                  Have you successfully received the payout?
                </p>
                <button
                  id="p2p-received-funds-btn"
                  onClick={() => {
                    if (!profile?.walletPassword) {
                      setError('Please configure a 4-digit Wallet Security PIN in your Profile settings before withdrawing.');
                      return;
                    }
                    setError(null);
                    setMethod('p2p_pin_confirm');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 rounded-xl text-sm font-black transition-all shadow-md cursor-pointer uppercase tracking-wider"
                >
                  <span>YES, I HAVE RECEIVED THE FUNDS</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* P2P Enter PIN Final Release Screen */}
          {method === 'p2p_pin_confirm' && selectedMerchant && (() => {
            const grossVal = parseFloat(p2pUSDAmount) || 0;
            const hasActiveContract = activeCopyContracts.length > 0;
            const rate = selectedMerchant.rate > 1.5 ? selectedMerchant.rate - 1.5 : 0;
            const localGross = grossVal * rate;

            return (
              <div className="space-y-5">
                <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col items-center justify-center text-center gap-2.5 pb-2 border-b border-zinc-200/60">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Lock size={22} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-zinc-800">Release Escrow USD</h3>
                      <p className="text-[11px] text-zinc-500">Authorize final transfer to {selectedMerchant.name}</p>
                    </div>
                  </div>

                  {hasActiveContract && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 text-left">
                      <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-extrabold text-[11px] block text-amber-800 uppercase tracking-wide">Active Trading Contract Detected</span>
                        <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                          Withdrawing now applies a 50% early fee. Standard fee is 15% upon contract completion.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs pb-1">
                      <span className="text-zinc-500">Releasing Escrow</span>
                      <span className="font-mono font-bold text-zinc-800">${grossVal.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-1">
                      <span className="text-zinc-500">Amount Received</span>
                      <span className="font-mono font-bold text-amber-600">
                        {localGross.toLocaleString()} Shs
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-red-50 border border-red-100 text-red-800 text-[10px] rounded-xl leading-relaxed text-center">
                    <strong>Caution:</strong> Releasing escrow is final and cannot be reversed. Only input your PIN if you have verified the funds are in your mobile wallet.
                  </div>
                </div>

                {/* Wallet PIN Form */}
                <div className="space-y-4 bg-white border border-zinc-200 rounded-2xl p-4">
                  <div className="space-y-1.5 text-center">
                    <label className="text-xs font-semibold text-zinc-500 block">
                      Enter 4-Digit Wallet Security PIN
                    </label>
                    <input
                      id="withdraw-final-p2p-pin"
                      type="password"
                      maxLength={4}
                      required
                      placeholder="••••"
                      value={walletPIN}
                      onChange={(e) => setWalletPIN(e.target.value.replace(/\D/g, ''))}
                      className="w-32 mx-auto px-4 py-3 bg-zinc-50 border border-zinc-250 rounded-xl text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-zinc-800 block"
                    />
                    <button
                      type="button"
                      id="p2p-forgot-pin-btn"
                      onClick={handleGoToPinSettings}
                      className="mt-2 text-amber-600 hover:text-amber-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer mx-auto"
                    >
                      <Key size={13} />
                      <span>Wrong or forgot PIN? Change PIN in Settings</span>
                    </button>
                  </div>

                  <button
                    id="confirm-release-pin-btn"
                    onClick={handleInitiateP2PWithdrawal}
                    disabled={submitting || !walletPIN || walletPIN.length !== 4}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:bg-zinc-200 disabled:text-zinc-400 rounded-xl text-sm font-black transition-all shadow-md cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Processing Withdrawal...</span>
                      </>
                    ) : (
                      <span>CONFIRM & RELEASE ESCROW</span>
                    )}
                  </button>

                  <button
                    id="cancel-pin-confirm-btn"
                    onClick={() => {
                      setError(null);
                      setMethod('p2p_instructions');
                    }}
                    className="w-full py-2.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Cancel & Go Back
                  </button>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* Active Contract Early Withdrawal Confirmation Modal */}
      {showActiveContractWarningModal && (() => {
        const withdrawGross = pendingWithdrawType === 'crypto' 
          ? (parseFloat(amountUSD) || 0) 
          : (parseFloat(p2pUSDAmount) || 0);
        const earlyFeeAmount = withdrawGross * 0.50;
        const earlyNetAmount = withdrawGross * 0.50;
        const standardFeeAmount = withdrawGross * 0.15;
        const standardNetAmount = withdrawGross * 0.85;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white border border-zinc-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-left relative overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Header Warning Badge */}
              <div className="flex items-center gap-3.5 pb-4 border-b border-zinc-100">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900 leading-snug">Active Contract Warning</h3>
                  <p className="text-xs text-amber-700 font-semibold mt-0.5">Early Withdrawal Terms</p>
                </div>
              </div>

              {/* Shortened Clear Statement */}
              <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl space-y-2">
                <p className="text-xs font-semibold text-amber-950 leading-relaxed">
                  You have an active contract. Withdrawing now incurs a <strong className="text-red-600 font-black">50% fee</strong>. Wait for the contract to end to withdraw with a <strong className="text-emerald-700 font-black">15% fee</strong>.
                </p>
              </div>

              {/* Calculation Breakdown Comparison */}
              <div className="space-y-2 bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-200/60">
                  <span className="text-zinc-500">Requested Withdrawal</span>
                  <span className="font-mono font-bold text-zinc-900">${withdrawGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                </div>

                <div className="p-2.5 bg-red-50/70 rounded-xl border border-red-200/60 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-red-800 font-bold">If Withdrawing Now (50% Fee)</span>
                    <span className="font-mono font-bold text-red-600">-${earlyFeeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                  </div>
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-red-950 text-[11px]">Net Payout Received</span>
                    <span className="font-mono font-black text-red-700 text-xs">${earlyNetAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200/60 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-800 font-bold">If Waiting Contract End (15% Fee)</span>
                    <span className="font-mono font-bold text-emerald-600">-${standardFeeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                  </div>
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-emerald-950 text-[11px]">Net Payout Received</span>
                    <span className="font-mono font-black text-emerald-700 text-xs">${standardNetAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  id="active-contract-continue-withdraw-btn"
                  onClick={() => {
                    if (pendingWithdrawType === 'crypto') {
                      executeCryptoWithdrawSubmit(50);
                    } else if (pendingWithdrawType === 'p2p') {
                      executeP2PSellRelease(50);
                    }
                  }}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer uppercase tracking-wider"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>CONTINUE WITHDRAWAL (50% FEE)</span>
                  )}
                </button>

                <button
                  id="active-contract-cancel-view-contract-btn"
                  onClick={() => {
                    setShowActiveContractWarningModal(false);
                    setPendingWithdrawType(null);
                    const chosenContract = activeCopyContracts.length > 0 ? activeCopyContracts[0] : null;
                    const contractKey = chosenContract?.id || chosenContract?.leadId || 'any';
                    localStorage.setItem('view_active_contract_id', contractKey);
                    if (onViewContract) {
                      onViewContract(contractKey);
                    } else {
                      onBack();
                    }
                  }}
                  disabled={submitting}
                  className="w-full py-3 bg-white hover:bg-amber-50/60 border border-amber-300 text-amber-950 rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Eye size={14} className="text-amber-600" />
                  <span>Cancel and View Contract</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
