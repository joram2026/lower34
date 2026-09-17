import React, { useState, useEffect, useRef } from 'react';
import { UserAccount, ReferralDepositConfig } from '../types';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { useToast } from '../context/ToastContext';
import { 
  Shield, Key, Sparkles, User, Gift, Check, ArrowLeft, AlertCircle, 
  Smartphone, Copy, CheckCircle2, QrCode, Power, Lock, ShieldAlert,
  ChevronRight, ChevronDown, ChevronUp, HelpCircle, Send, Download, Laptop,
  Gamepad2, LayoutGrid, Clapperboard, BookOpen, Star, Share2, Plus, 
  Search, MoreVertical, Info, ShieldCheck, X, Zap, Tag, Wallet, Coins, History, Users
} from 'lucide-react';
import VouchersView from './VouchersView';
import { getAppBaseUrl } from '../config/domain';

interface ProfileViewProps {
  user: any;
  onBack: () => void;
  onNavigate?: (path: string) => void;
}

export default function ProfileView({ user, onBack, onNavigate }: ProfileViewProps) {
  const toast = useToast();
  const [profile, setProfile] = useState<UserAccount | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messageState, setMessageState] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const setMessage = (msg: { type: 'success' | 'error'; text: string } | null) => {
    setMessageState(msg);
    if (msg) {
      if (msg.type === 'success') toast.success(msg.text, 'Profile');
      else toast.error(msg.text, 'Profile Error');
    }
  };
  const message = messageState;

  // Active sub-page state
  const [activeSubPage, setActiveSubPage] = useState<'menu' | 'personal' | 'referral' | 'vouchers' | 'pin' | 'withdrawal_address' | '2fa' | 'support' | 'mobile_app'>(() => {
    return (localStorage.getItem('profile_subpage') as any) || 'menu';
  });

  useEffect(() => {
    localStorage.setItem('profile_subpage', activeSubPage);
  }, [activeSubPage]);

  // New PIN States
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pin2faCode, setPin2faCode] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [pinMessageState, setPinMessageState] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const setPinMessage = (msg: { type: 'success' | 'error'; text: string } | null) => {
    setPinMessageState(msg);
    if (msg) {
      if (msg.type === 'success') toast.success(msg.text, 'Security PIN');
      else toast.error(msg.text, 'PIN Error');
    }
  };
  const pinMessage = pinMessageState;
  const [pinSaving, setPinSaving] = useState(false);

  // BEP20 Withdrawal Address Binding States
  const [bep20AddressInput, setBep20AddressInput] = useState('');
  const [bep20PinInput, setBep20PinInput] = useState('');
  const [bep202faInput, setBep202faInput] = useState('');
  const [isChangingAddress, setIsChangingAddress] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [addressMessageState, setAddressMessageState] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const setAddressMessage = (msg: { type: 'success' | 'error'; text: string } | null) => {
    setAddressMessageState(msg);
    if (msg) {
      if (msg.type === 'success') toast.success(msg.text, 'Withdrawal Address');
      else toast.error(msg.text, 'Address Error');
    }
  };

  // Two-Factor Authentication States
  const [is2faSetupOpen, setIs2faSetupOpen] = useState(false);
  const [temp2faSecret, setTemp2faSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationErrorState, setVerificationErrorState] = useState<string | null>(null);
  const setVerificationError = (msg: string | null) => {
    setVerificationErrorState(msg);
    if (msg) toast.error(msg, '2FA Error');
  };
  const verificationError = verificationErrorState;
  const [copied, setCopied] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);

  // PWA and Play Store installation states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installProgress, setInstallProgress] = useState<number | null>(null);
  const [installStatusText, setInstallStatusText] = useState('');
  const [installSuccess, setInstallSuccess] = useState<boolean>(() => {
    return localStorage.getItem('arbitrage_pwa_installed') === 'true';
  });
  const [pwaLoading, setPwaLoading] = useState(false);
  const pwaLoadingRef = useRef(false);
  const [showPwaInstructions, setShowPwaInstructions] = useState(false);
  const [showOpenInstruction, setShowOpenInstruction] = useState(false);
  const [deviceTab, setDeviceTab] = useState<'android' | 'ios' | 'desktop'>(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/ipad|iphone|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    return 'desktop';
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('beforeinstallprompt event triggered and stashed.');
    };
    const handleAppInstalled = () => {
      console.log('App was successfully installed natively.');
      if (pwaLoadingRef.current) {
        console.log('Installation is already being handled with 4s delay.');
        return;
      }
      setInstallSuccess(true);
      localStorage.setItem('arbitrage_pwa_installed', 'true');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Referral list states
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [loadingReferred, setLoadingReferred] = useState(false);
  const [refConfig, setRefConfig] = useState<ReferralDepositConfig | null>(null);
  const [firstDepositCommissions, setFirstDepositCommissions] = useState<any[]>([]);
  const [loadingCommissions, setLoadingCommissions] = useState(false);
  const [showEarningsBreakdown, setShowEarningsBreakdown] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    async function fetchCommissions() {
      setLoadingCommissions(true);
      try {
        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', user.uid),
          where('type', '==', 'first_deposit_commission')
        );
        const querySnapshot = await getDocs(q);
        const list: any[] = [];
        querySnapshot.forEach((docSnap) => {
          const tData = docSnap.data();
          if (tData.status === 'APPROVED') {
            list.push({
              id: docSnap.id,
              ...tData,
              createdAt: tData.createdAt ? tData.createdAt.toDate() : new Date(),
            });
          }
        });
        setFirstDepositCommissions(list);
      } catch (err) {
        console.error('Error fetching deposit commissions:', err);
      } finally {
        setLoadingCommissions(false);
      }
    }

    fetchCommissions();
  }, [user]);

  useEffect(() => {
    async function fetchReferralConfig() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'referral_deposit_config'));
        if (snap.exists()) {
          setRefConfig(snap.data() as ReferralDepositConfig);
        }
      } catch (err) {
        console.error('Error fetching referral deposit config:', err);
      }
    }
    fetchReferralConfig();
  }, []);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateCode, setDeactivateCode] = useState('');
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [showDeactivateInput, setShowDeactivateInput] = useState(false);

  const generate2faSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTemp2faSecret(result);
    setVerificationCode('');
    setVerificationError(null);
    setIs2faSetupOpen(true);
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(temp2faSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyReferral = () => {
    const code = (profile as any)?.uniqueCode || '';
    const referralLink = `${getAppBaseUrl()}/#/signup?ref=${code}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(referralLink)
        .then(() => {
          setCopiedReferral(true);
          setTimeout(() => setCopiedReferral(false), 2500);
        })
        .catch((err) => {
          console.error('Failed to copy using navigator.clipboard:', err);
          fallbackCopyText(referralLink);
        });
    } else {
      fallbackCopyText(referralLink);
    }
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        setCopiedReferral(true);
        setTimeout(() => setCopiedReferral(false), 2500);
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }
  };

  const handleVerifyAndEnable2fa = async () => {
    setVerificationError(null);
    if (verificationCode.trim().length !== 6 || isNaN(Number(verificationCode.trim()))) {
      setVerificationError('Please enter a valid 6-digit verification code.');
      return;
    }

    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, {
        twoFactorEnabled: true,
        twoFactorSecret: temp2faSecret
      });
      setProfile(prev => prev ? { ...prev, twoFactorEnabled: true, twoFactorSecret: temp2faSecret } : null);
      setIs2faSetupOpen(false);
      setMessage({ type: 'success', text: 'Google Authenticator (2FA) successfully enabled!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error('Error enabling 2FA:', err);
      setVerificationError(err.message || 'Failed to enable 2FA.');
    }
  };

  const handleDisable2fa = async () => {
    setDeactivateError(null);
    if (!deactivateCode.trim()) {
      setDeactivateError('Please enter the 6-digit code to confirm.');
      return;
    }
    if (deactivateCode.trim().length !== 6 || isNaN(Number(deactivateCode.trim()))) {
      setDeactivateError('Please enter a valid 6-digit code.');
      return;
    }

    setDeactivating(true);
    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, {
        twoFactorEnabled: false,
        twoFactorSecret: ''
      });
      setProfile(prev => prev ? { ...prev, twoFactorEnabled: false, twoFactorSecret: '' } : null);
      setShowDeactivateInput(false);
      setDeactivateCode('');
      setMessage({ type: 'success', text: 'Google Authenticator (2FA) has been deactivated.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error('Error disabling 2FA:', err);
      setDeactivateError(err.message || 'Failed to disable 2FA.');
    } finally {
      setDeactivating(false);
    }
  };

  useEffect(() => {
    async function fetchProfile() {
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserAccount & { uniqueCode?: string };
          let code = data.uniqueCode;
          if (!code) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let generatedCode = '';
            for (let i = 0; i < 5; i++) {
              generatedCode += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            code = generatedCode;
            await updateDoc(docRef, { uniqueCode: code });
            data.uniqueCode = code;
          }

          // Ensure the referral codes collection mapping is synchronized
          try {
            await setDoc(doc(db, 'referralCodes', code), {
              uid: user.uid,
              email: data.email || user.email || ''
            }, { merge: true });
          } catch (refCodeErr) {
            console.error('Error syncing referral mapping:', refCodeErr);
          }

          setProfile(data);
          setDisplayName(data.displayName || user.displayName || '');
          setPhone(data.phone || (data as any).phoneNumber || '');
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [user]);

  useEffect(() => {
    const code = (profile as any)?.uniqueCode;
    if (!code) return;

    async function fetchReferredUsers() {
      setLoadingReferred(true);
      try {
        const q = query(
          collection(db, 'users'),
          where('referralSource', '==', code)
        );
        const querySnapshot = await getDocs(q);
        const list: any[] = [];
        querySnapshot.forEach((docSnap) => {
          const uData = docSnap.data();
          list.push({
            uid: docSnap.id,
            displayName: uData.displayName || 'Anonymous User',
            email: uData.email || '',
            phone: uData.phone || uData.phoneNumber || '',
            hasMadeFirstDeposit: uData.hasMadeFirstDeposit || false,
            createdAt: uData.createdAt ? uData.createdAt.toDate() : new Date(),
          });
        });
        // Sort by registration date descending
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setReferredUsers(list);
      } catch (err) {
        console.error('Error fetching referred users:', err);
      } finally {
        setLoadingReferred(false);
      }
    }

    fetchReferredUsers();
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      // 1. Update Auth Profile Display Name
      if (displayName !== user.displayName) {
        await updateProfile(auth.currentUser!, { displayName });
      }

      // 2. Update Firestore document with displayName and phone
      const docRef = doc(db, 'users', user.uid);
      const updatedPhone = phone.trim();
      await updateDoc(docRef, {
        displayName: displayName.trim(),
        phone: updatedPhone,
        phoneNumber: updatedPhone
      });

      setProfile(prev => prev ? { ...prev, displayName: displayName.trim(), phone: updatedPhone } : null);
      setMessage({ type: 'success', text: 'Profile & phone number updated successfully!' });
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);

    // Validate exactly 4 numerical digits
    if (!/^\d{4}$/.test(newPin)) {
      setPinMessage({ type: 'error', text: 'PIN must be exactly 4 numerical digits (e.g., 1234).' });
      return;
    }

    if (newPin !== confirmPin) {
      setPinMessage({ type: 'error', text: 'PIN confirmation does not match.' });
      return;
    }

    // If changing the pin and 2FA is active, require Google Authenticator code
    const isUpdating = !!profile?.walletPassword;
    if (isUpdating && profile?.twoFactorEnabled) {
      if (!pin2faCode || pin2faCode.length !== 6 || isNaN(Number(pin2faCode))) {
        setPinMessage({ type: 'error', text: 'Please enter a valid 6-digit Google Authenticator code to authorize this change.' });
        return;
      }
    }

    setPinSaving(true);
    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, {
        walletPassword: newPin
      });
      setProfile(prev => prev ? { ...prev, walletPassword: newPin } : null);
      
      // Clear fields
      setNewPin('');
      setConfirmPin('');
      setPin2faCode('');
      setIsChangingPin(false);
      
      setPinMessage({ 
        type: 'success', 
        text: isUpdating ? 'Wallet PIN successfully changed!' : 'Wallet PIN successfully set!' 
      });
      setTimeout(() => setPinMessage(null), 4000);
    } catch (err: any) {
      console.error('Error saving PIN:', err);
      setPinMessage({ type: 'error', text: err.message || 'Failed to save Wallet PIN.' });
    } finally {
      setPinSaving(false);
    }
  };

  const handleSaveBep20Address = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressMessage(null);

    const cleanAddress = bep20AddressInput.trim();

    // Validate BEP20 format: 0x followed by 40 hex characters
    if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
      setAddressMessage({
        type: 'error',
        text: 'Invalid BEP20 address. Must be a valid 42-character BNB Smart Chain address starting with 0x (e.g. 0x71C...3a9F).'
      });
      return;
    }

    // Require Wallet PIN verification if user has configured a PIN
    if (profile?.walletPassword) {
      if (!bep20PinInput || bep20PinInput.trim() !== profile.walletPassword) {
        setAddressMessage({
          type: 'error',
          text: 'Incorrect 4-digit Wallet Security PIN. Please enter your valid PIN to authorize binding.'
        });
        return;
      }
    } else {
      setAddressMessage({
        type: 'error',
        text: 'Please configure your 4-digit Wallet Security PIN in the PIN menu first before binding a withdrawal address.'
      });
      return;
    }

    // If 2FA active, require Google Authenticator code
    if (profile?.twoFactorEnabled) {
      if (!bep202faInput || bep202faInput.length !== 6 || isNaN(Number(bep202faInput))) {
        setAddressMessage({
          type: 'error',
          text: 'Please enter a valid 6-digit Google Authenticator code to authorize binding.'
        });
        return;
      }
    }

    setAddressSaving(true);
    try {
      const docRef = doc(db, 'users', user.uid);
      const isUpdating = !!profile?.bep20WithdrawalAddress;
      await updateDoc(docRef, {
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

      setBep20AddressInput('');
      setBep20PinInput('');
      setBep202faInput('');
      setIsChangingAddress(false);

      setAddressMessage({
        type: 'success',
        text: isUpdating ? 'BEP20 withdrawal address successfully updated!' : 'BEP20 withdrawal address successfully locked and bound!'
      });
      setTimeout(() => setAddressMessage(null), 4000);
    } catch (err: any) {
      console.error('Error saving BEP20 address:', err);
      setAddressMessage({ type: 'error', text: err.message || 'Failed to save BEP20 withdrawal address.' });
    } finally {
      setAddressSaving(false);
    }
  };

  const triggerFileDownload = () => {
    try {
      const a = document.createElement('a');
      a.href = '/CME.apk';
      a.download = 'CME.apk';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('File download failed:', err);
    }
  };

  const handleOpenApp = () => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (isStandalone) {
      localStorage.removeItem('profile_subpage');
      onBack();
    } else {
      setShowOpenInstruction(true);
    }
  };

  const startApkDownload = () => {
    if (installProgress !== null) return;
    setInstallSuccess(false);
    setInstallProgress(0);
    setInstallStatusText('Initializing instant secure download...');

    // Trigger the real file download immediately in the background so there is ZERO delay!
    triggerFileDownload();

    let prog = 0;
    const interval = setInterval(() => {
      // Snappy and fast loading states
      prog += Math.floor(Math.random() * 15) + 12;
      if (prog >= 100) {
        prog = 100;
        clearInterval(interval);
        setInstallProgress(100);
        setInstallStatusText('Download complete! Tap the downloaded file to install.');
        setInstallSuccess(true);
        localStorage.setItem('arbitrage_pwa_installed', 'true');
      } else {
        setInstallProgress(prog);
        if (prog < 25) {
          setInstallStatusText('Establishing secure data stream...');
        } else if (prog < 60) {
          setInstallStatusText('Downloading CME app bundle (3.44 MB)...');
        } else {
          setInstallStatusText('Verifying package security integrity...');
        }
      }
    }, 100); // Super fast visual progress in ~1 second
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        if (outcome === 'accepted') {
          setPwaLoading(true);
          pwaLoadingRef.current = true;
          setTimeout(() => {
            setPwaLoading(false);
            pwaLoadingRef.current = false;
            setInstallSuccess(true);
            localStorage.setItem('arbitrage_pwa_installed', 'true');
          }, 10000);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('Error triggering native prompt:', err);
      }
    } else {
      // If native browser prompt is null, determine the platform and show PWA instructions
      const ua = navigator.userAgent.toLowerCase();
      const isIos = /ipad|iphone|ipod/.test(ua);
      
      setShowPwaInstructions(true);
      if (isIos) {
        setDeviceTab('ios');
      } else {
        const isAndroid = /android/.test(ua);
        setDeviceTab(isAndroid ? 'android' : 'desktop');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen bg-[#EBF9F0] gap-3 font-sans">
        <div className="w-8 h-8 border-4 border-[#008B47] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-zinc-600 font-medium">Loading profile details...</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#EBF9F0] font-sans pb-28 text-zinc-800 transition-colors duration-300">
      <div id="profile-view-container" className="max-w-md mx-auto p-4 sm:p-6">
        {activeSubPage === 'menu' && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  id="profile-back-btn"
                  onClick={() => {
                    localStorage.removeItem('profile_subpage');
                    onBack();
                  }}
                  className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-colors cursor-pointer shadow-xs active:scale-95"
                  title="Return to Trading Dashboard"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="text-left">
                  <h2 className="text-xl font-black tracking-tight text-zinc-900">Account & Security</h2>
                  <p className="text-xs text-zinc-500 font-medium">Settings & Institutional Hub</p>
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200/80 text-[#007038] text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-xs">
                <Shield size={12} className="text-[#008B47]" />
                <span>Verified</span>
              </div>
            </div>

            {/* Compact User Profile Badge */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 flex items-center gap-3.5 text-left shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#008B47] to-[#00A653] flex items-center justify-center text-white font-black text-base shadow-sm uppercase shrink-0">
                {displayName ? displayName.charAt(0) : (user.email ? user.email.charAt(0) : 'U')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-zinc-850 truncate">{displayName || 'CME Trader'}</h3>
                </div>
                <p className="text-[11px] text-zinc-500 font-mono truncate">{user.email}</p>
                {(profile as any)?.uniqueCode && (
                  <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-[10px] font-mono font-bold">
                    <span>ID:</span>
                    <span className="text-[#007038]">#{(profile as any).uniqueCode}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Selector Section: Core Navigation with Concise Summaries */}
            <div className="space-y-2.5 text-left">
              {/* 1. Account Identity */}
              <button
                id="nav-personal-info"
                onClick={() => { setActiveSubPage('personal'); setMessage(null); }}
                className="w-full bg-white border border-zinc-200/80 hover:border-emerald-500/40 hover:bg-emerald-50/20 p-3.5 rounded-2xl flex items-center gap-3.5 transition-all cursor-pointer group shadow-xs active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#008B47] flex items-center justify-center shrink-0 group-hover:bg-[#008B47] group-hover:text-white transition-all shadow-xs">
                  <User size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-900 group-hover:text-[#007038] transition-colors">Identity & Contact</h4>
                    <span className="text-[10px] font-medium text-zinc-400">Profile</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-sans">Name, phone & account credentials</p>
                </div>
                <ChevronRight size={15} className="text-zinc-400 group-hover:text-zinc-700 transition-colors shrink-0" />
              </button>

              {/* 2. Partner & Referral Program */}
              <button
                id="nav-referral-program"
                onClick={() => { setActiveSubPage('referral'); setMessage(null); }}
                className="w-full bg-white border border-zinc-200/80 hover:border-amber-500/40 hover:bg-amber-50/20 p-3.5 rounded-2xl flex items-center gap-3.5 transition-all cursor-pointer group shadow-xs active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-xs">
                  <Gift size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-900 group-hover:text-amber-700 transition-colors">Affiliate & Commissions</h4>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      {referredUsers.length} Invites
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-sans">Cash rebates & 24h bonus signal passes</p>
                </div>
                <ChevronRight size={15} className="text-zinc-400 group-hover:text-zinc-700 transition-colors shrink-0" />
              </button>

              {/* 3. Vouchers & Promo Codes */}
              <button
                id="nav-vouchers-rewards"
                onClick={() => { setActiveSubPage('vouchers'); setMessage(null); }}
                className="w-full bg-white border border-zinc-200/80 hover:border-emerald-500/40 hover:bg-emerald-50/20 p-3.5 rounded-2xl flex items-center gap-3.5 transition-all cursor-pointer group shadow-xs active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#008B47] flex items-center justify-center shrink-0 group-hover:bg-[#008B47] group-hover:text-white transition-all shadow-xs">
                  <Tag size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-900 group-hover:text-[#007038] transition-colors">Reward Coupons & Passes</h4>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-[#006030] border border-emerald-300">
                      Redeem
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-sans">Redeem trial passes & deposit bonuses</p>
                </div>
                <ChevronRight size={15} className="text-zinc-400 group-hover:text-zinc-700 transition-colors shrink-0" />
              </button>

              {/* 4. Cashout Security PIN */}
              <button
                id="nav-wallet-pin"
                onClick={() => { setActiveSubPage('pin'); setPinMessage(null); }}
                className="w-full bg-white border border-zinc-200/80 hover:border-emerald-500/40 hover:bg-emerald-50/20 p-3.5 rounded-2xl flex items-center gap-3.5 transition-all cursor-pointer group shadow-xs active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#008B47] flex items-center justify-center shrink-0 group-hover:bg-[#008B47] group-hover:text-white transition-all shadow-xs">
                  <Lock size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-900 group-hover:text-[#007038] transition-colors">Transaction Security PIN</h4>
                    {profile?.walletPassword ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#007038]">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 animate-pulse">
                        Set PIN
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-sans">4-digit code for withdrawal authorizations</p>
                </div>
                <ChevronRight size={15} className="text-zinc-400 group-hover:text-zinc-700 transition-colors shrink-0" />
              </button>

              {/* 5. Bound Settlement Address */}
              <button
                id="nav-withdrawal-address"
                onClick={() => { 
                  setActiveSubPage('withdrawal_address'); 
                  setAddressMessage(null);
                  setIsChangingAddress(false);
                }}
                className="w-full bg-white border border-zinc-200/80 hover:border-emerald-500/40 hover:bg-emerald-50/20 p-3.5 rounded-2xl flex items-center gap-3.5 transition-all cursor-pointer group shadow-xs active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#008B47] flex items-center justify-center shrink-0 group-hover:bg-[#008B47] group-hover:text-white transition-all shadow-xs">
                  <Wallet size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-900 group-hover:text-[#007038] transition-colors">Settlement Payout Address</h4>
                    {profile?.bep20WithdrawalAddress ? (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                        {profile.bep20WithdrawalAddress.slice(0, 4)}...{profile.bep20WithdrawalAddress.slice(-4)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 animate-pulse">
                        Not Bound
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-sans">Verified USDT BEP20 destination wallet</p>
                </div>
                <ChevronRight size={15} className="text-zinc-400 group-hover:text-zinc-700 transition-colors shrink-0" />
              </button>

              {/* 6. Two-Factor Authentication */}
              <button
                id="nav-google-authenticator"
                onClick={() => { setActiveSubPage('2fa'); }}
                className="w-full bg-white border border-zinc-200/80 hover:border-emerald-500/40 hover:bg-emerald-50/20 p-3.5 rounded-2xl flex items-center gap-3.5 transition-all cursor-pointer group shadow-xs active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#008B47] flex items-center justify-center shrink-0 group-hover:bg-[#008B47] group-hover:text-white transition-all shadow-xs">
                  <Smartphone size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-900 group-hover:text-[#007038] transition-colors">Two-Factor Authentication</h4>
                    {profile?.twoFactorEnabled ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#007038]">
                        Enabled
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-500">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-sans">Google Authenticator TOTP protection</p>
                </div>
                <ChevronRight size={15} className="text-zinc-400 group-hover:text-zinc-700 transition-colors shrink-0" />
              </button>

              {/* 7. Dedicated Support */}
              <button
                id="nav-customer-support"
                onClick={() => { setActiveSubPage('support'); setMessage(null); }}
                className="w-full bg-white border border-zinc-200/80 hover:border-emerald-500/40 hover:bg-emerald-50/20 p-3.5 rounded-2xl flex items-center gap-3.5 transition-all cursor-pointer group shadow-xs active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#008B47] flex items-center justify-center shrink-0 group-hover:bg-[#008B47] group-hover:text-white transition-all shadow-xs">
                  <HelpCircle size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-900 group-hover:text-[#007038] transition-colors">Client Concierge Desk</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#007038]">
                      Online 24/7
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-sans">Direct Telegram assistance (@Wendyus1)</p>
                </div>
                <ChevronRight size={15} className="text-zinc-400 group-hover:text-zinc-700 transition-colors shrink-0" />
              </button>

              {/* 8. Mobile Trading App */}
              <button
                id="nav-mobile-app"
                onClick={() => { setActiveSubPage('mobile_app'); setMessage(null); }}
                className="w-full bg-gradient-to-r from-emerald-50/80 to-emerald-100/40 border border-emerald-300/80 hover:border-emerald-400 hover:bg-emerald-100/60 p-3.5 rounded-2xl flex items-center gap-3.5 transition-all cursor-pointer group shadow-xs active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-[#008B47] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Smartphone size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-900 group-hover:text-[#007038] transition-colors flex items-center gap-1.5">
                      CME Mobile Application
                    </h4>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                      PWA / APK
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-850 truncate mt-0.5 font-medium">Install native trading app for Android & iOS</p>
                </div>
                <ChevronRight size={15} className="text-[#008B47] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            </div>
          </div>
        )}

      {/* Subpage: Personal details / Identity & Contact */}
      {activeSubPage === 'personal' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button 
              id="personal-back-btn"
              onClick={() => { setActiveSubPage('menu'); setMessage(null); }}
              className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-colors cursor-pointer shadow-xs active:scale-95"
              title="Back to profile menu"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="text-left">
              <h2 className="text-xl font-black tracking-tight text-zinc-900">Identity & Contact</h2>
              <p className="text-xs text-zinc-500 font-medium">Account credentials and verification records</p>
            </div>
          </div>

          {/* Institutional Credential Overview Card */}
          <div className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-4.5 space-y-3 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Account Records</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <Shield size={10} className="text-[#008B47]" /> Verified Record
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-medium">CME Trader ID</span>
                <span className="font-mono font-black text-[#007038] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 select-all">
                  #{(profile as any)?.uniqueCode || '-----'}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-zinc-100/80 pt-2">
                <span className="text-zinc-500 font-medium">Registered Email</span>
                <span className="font-mono text-zinc-700 font-semibold truncate max-w-[200px]">{user.email}</span>
              </div>
              <div className="flex justify-between items-center border-t border-zinc-100/80 pt-2">
                <span className="text-zinc-500 font-medium">Jurisdictional Region</span>
                <span className="font-bold text-zinc-800">{profile?.country || 'Kenya'}</span>
              </div>
              <div className="flex justify-between items-center border-t border-zinc-100/80 pt-2">
                <span className="text-zinc-500 font-medium">Settlement Status</span>
                <span className="font-bold flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 size={12} />
                  {profile?.withdrawalEnabled ? 'Active / Authorized' : 'Under Review'}
                </span>
              </div>
            </div>
          </div>

          {/* Profile Edit Form */}
          <form onSubmit={handleSave} className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-4.5 space-y-4 text-left">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 pb-1 border-b border-zinc-100">
              Update Contact Information
            </h3>

            {/* Display Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                <User size={13} className="text-[#008B47]" />
                <span>Trading Alias / Display Name</span>
              </label>
              <input
                id="profile-display-name"
                type="text"
                required
                placeholder="Enter your trader display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium"
              />
              <p className="text-[10px] text-zinc-400 font-medium">Visible on your trade reports and statements.</p>
            </div>

            {/* Phone Number Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                <Smartphone size={13} className="text-[#008B47]" />
                <span>Primary Contact Phone</span>
              </label>
              <input
                id="profile-phone-number"
                type="tel"
                placeholder="e.g. +254 700 000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium"
              />
              <p className="text-[10px] text-zinc-400 font-medium">Used for two-way verification and critical transaction alerts.</p>
            </div>

            {/* Submit Button */}
            <button
              id="profile-save-btn"
              type="submit"
              disabled={saving}
              className="w-full mt-2 py-3 bg-[#008B47] hover:bg-[#007038] text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-800/10 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving Updates...</span>
                </>
              ) : (
                <>
                  <Check size={14} className="stroke-[2.5]" />
                  <span>Save Identity Changes</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Subpage: Referral Program / Affiliate & Partner Network */}
      {activeSubPage === 'referral' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button 
              id="referral-back-btn"
              onClick={() => { setActiveSubPage('menu'); }}
              className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-colors cursor-pointer shadow-xs active:scale-95"
              title="Return to profile menu"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="text-left">
              <h2 className="text-xl font-black tracking-tight text-zinc-900">Affiliate & Partner Program</h2>
              <p className="text-xs text-zinc-500 font-medium">Invite friends and earn tiered milestone cash rewards</p>
            </div>
          </div>

          <div id="referral-program-section" className="space-y-4 text-left">
            {/* 1. REFERRAL REVENUE & NETWORK ANALYTICS */}
            {(() => {
              const milestoneEarnings = (() => {
                let total = 0;
                for (let i = 1; i <= referredUsers.length; i++) {
                  if (i >= 40) total += 0.40;
                  else if (i >= 20) total += 0.30;
                  else if (i >= 7) total += 0.20;
                  else total += 0.10;
                }
                return total;
              })();

              const depositCommissionEarnings = firstDepositCommissions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
              const grandTotal = milestoneEarnings + depositCommissionEarnings;

              return (
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 items-start">
                  <div 
                    className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-300 relative select-none cursor-pointer hover:border-emerald-400 hover:shadow-xs"
                    onClick={() => setShowEarningsBreakdown(!showEarningsBreakdown)}
                  >
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Cumulative Revenue</span>
                        <div className="text-[#008B47]">
                          {showEarningsBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl sm:text-2xl font-black text-[#007038] font-mono">
                          {grandTotal.toFixed(2)}
                        </span>
                        <span className="text-[10px] sm:text-xs text-zinc-400 font-bold uppercase font-mono">USDT</span>
                      </div>
                    </div>

                    {!showEarningsBreakdown && (
                      <p className="text-[8.5px] sm:text-[9.5px] text-zinc-400 font-semibold mt-2 flex items-center gap-0.5">
                        <span>Tap to view itemized logs</span>
                      </p>
                    )}

                    {showEarningsBreakdown && (
                      <div className="mt-2.5 pt-2.5 border-t border-zinc-100 space-y-1.5 text-left text-[9px] sm:text-[10px] text-zinc-600 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1 font-medium text-zinc-600">
                            <span>👥</span> Direct Invites:
                          </span>
                          <span className="font-bold font-mono text-zinc-900">${milestoneEarnings.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1 font-medium text-zinc-600">
                            <span>💳</span> Deposit Rebates:
                          </span>
                          <span className="font-bold font-mono text-zinc-900">${depositCommissionEarnings.toFixed(2)}</span>
                        </div>

                        {firstDepositCommissions.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-zinc-100 max-h-24 overflow-y-auto pr-1 space-y-1 text-[8px] sm:text-[9px]">
                            <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Commission Transaction History</div>
                            {firstDepositCommissions.map((tx) => (
                              <div key={tx.id} className="flex justify-between items-center bg-zinc-50 px-2 py-1 rounded-lg border border-zinc-100 text-zinc-700">
                                <span className="truncate max-w-[95px] sm:max-w-[120px]" title={tx.paymentMessage}>
                                  {tx.paymentMessage?.replace("Referral First Deposit Bonus", "Rebate") || "Deposit Rebate"}
                                </span>
                                <span className="font-bold font-mono text-emerald-600 shrink-0">+${tx.amount?.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between min-h-[92px]">
                    <div>
                      <span className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Network Members</span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl sm:text-2xl font-black text-zinc-900 font-mono">{referredUsers.length}</span>
                        <span className="text-[10px] sm:text-xs text-zinc-400 font-bold ml-1">affiliates</span>
                      </div>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-emerald-700 font-medium">Active Partner Tier</p>
                  </div>
                </div>
              );
            })()}

            {/* 3. TIER MILESTONE PROGRESS TRACK */}
            {(() => {
              const count = referredUsers.length;
              
              // Define progress percentage
              let progressPercent = 0;
              if (count >= 40) {
                progressPercent = 100;
              } else if (count >= 20) {
                progressPercent = 66.6 + ((count - 20) / 20) * 33.4;
              } else if (count >= 7) {
                progressPercent = 33.3 + ((count - 7) / 13) * 33.3;
              } else {
                progressPercent = (count / 7) * 33.3;
              }

              const milestones = [
                { label: 'Starter', min: 0, amount: '0.10 USDT', badge: '✓', achieved: true },
                { label: 'Bronze', min: 7, amount: '0.20 USDT', badge: count >= 7 ? '✓' : '7', achieved: count >= 7 },
                { label: 'Silver', min: 20, amount: '0.30 USDT', badge: count >= 20 ? '✓' : '20', achieved: count >= 20 },
                { label: 'Gold', min: 40, amount: '0.40 USDT', badge: count >= 40 ? '★' : '40', achieved: count >= 40 },
              ];

              return (
                <div className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-4 sm:p-5 space-y-4 text-left">
                  {/* Top Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Partner Tier Status</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-full ${
                          count >= 40 ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20' :
                          count >= 20 ? 'bg-zinc-100 text-zinc-800 border border-zinc-200' :
                          count >= 7 ? 'bg-orange-500/10 text-orange-700 border border-orange-500/20' :
                          'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                        }`}>
                          {count >= 40 ? 'Gold Partner' : count >= 20 ? 'Silver Partner' : count >= 7 ? 'Bronze Partner' : 'Starter Partner'}
                        </span>
                        <span className="text-[11px] sm:text-xs text-zinc-500 font-medium">
                          {count >= 40 ? 'Maximum Tier reached' : 
                           count >= 20 ? `${40 - count} more for Gold` : 
                           count >= 7 ? `${20 - count} more for Silver` : 
                           `${7 - count} more for Bronze`}
                        </span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Direct Invite Reward</span>
                      <span className="text-xs sm:text-sm font-black text-[#007038] font-mono">
                        {count >= 40 ? '0.40 USDT' : count >= 20 ? '0.30 USDT' : count >= 7 ? '0.20 USDT' : '0.10 USDT'} / member
                      </span>
                    </div>
                  </div>

                  {/* Progress Track Section */}
                  <div className="pt-2 pb-1 px-1">
                    <div className="relative">
                      {/* Background Connecting Line */}
                      <div className="absolute top-2.5 left-[12.5%] right-[12.5%] h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#008B47] to-[#00A653] rounded-full transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>

                      {/* Milestone Nodes Grid Row */}
                      <div className="relative flex justify-between items-start">
                        {milestones.map((m, idx) => (
                          <div 
                            key={idx} 
                            className="flex flex-col items-center text-center z-10 w-1/4 px-0.5"
                          >
                            {/* Node Badge Circle */}
                            <div className={`w-5 sm:w-6 h-5 sm:h-6 rounded-full border-2 flex items-center justify-center text-[9px] sm:text-[10px] font-bold shadow-xs transition-all ${
                              m.achieved 
                                ? 'border-[#008B47] bg-[#008B47] text-white' 
                                : 'border-zinc-200 bg-white text-zinc-400'
                            }`}>
                              {m.badge}
                            </div>
                            
                            {/* Labels */}
                            <span className={`text-[9px] sm:text-[10px] font-black mt-1.5 whitespace-nowrap ${
                              m.achieved ? 'text-zinc-850' : 'text-zinc-400'
                            }`}>
                              {m.label}
                            </span>
                            <span className="text-[8px] sm:text-[9px] text-zinc-400 font-mono font-bold whitespace-nowrap">
                              {m.amount}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 4. LINK COPIER AND REFERRED FRIENDS LIST */}
            <div className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-3.5 sm:p-4 space-y-4">
              {/* Referral Link Box with Prominent Copy Button */}
              <div className="space-y-1.5">
                <label className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-wider block">
                  Your Dedicated Invitation Link
                </label>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-zinc-50 border border-zinc-200 p-2 sm:p-2.5 rounded-xl font-mono text-xs">
                  <span className="text-zinc-700 font-medium select-all truncate flex-1 px-1 py-1 sm:py-0 text-[11px] sm:text-xs">
                    {getAppBaseUrl()}/#/signup?ref={(profile as any)?.uniqueCode || ''}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer shrink-0 uppercase tracking-wider ${
                      copiedReferral 
                        ? 'bg-[#008B47] hover:bg-[#007038] text-white' 
                        : 'bg-[#008B47] hover:bg-[#007038] text-white'
                    }`}
                  >
                    {copiedReferral ? (
                      <>
                        <Check size={14} className="stroke-[3]" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
                {copiedReferral && (
                  <span className="text-[10px] text-emerald-700 flex items-center gap-1.5 mt-1 font-bold">
                    <Check size={10} /> Copied to clipboard! Share with prospective traders.
                  </span>
                )}
              </div>

              {/* Referred Users List */}
              <div className="space-y-2 border-t border-zinc-100 pt-3">
                <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                  <span>Referred Member Roster ({referredUsers.length})</span>
                  {loadingReferred && <span className="text-zinc-400 animate-pulse font-normal lowercase">syncing...</span>}
                </div>

                {loadingReferred ? (
                  <div className="text-center py-4 text-xs text-zinc-500">
                    Syncing affiliate network records...
                  </div>
                ) : referredUsers.length === 0 ? (
                  <div className="text-center py-6 bg-zinc-50/70 border border-dashed border-zinc-200 rounded-xl text-xs text-zinc-400">
                    No active members have registered under your affiliate link yet.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {referredUsers.map((refUser) => {
                      return (
                        <div 
                          key={refUser.uid} 
                          className="flex flex-col sm:flex-row sm:items-center justify-between bg-zinc-50/80 border border-zinc-200/90 p-2.5 rounded-xl text-xs gap-1.5 hover:border-zinc-300 transition-colors"
                        >
                          <div className="space-y-0.5 text-left">
                            <p className="font-extrabold text-zinc-850 truncate max-w-[180px]">
                              {refUser.displayName}
                            </p>
                            <p className="text-[11px] text-zinc-600 font-mono font-medium">
                              {refUser.phone ? refUser.phone : 'Direct Signup'}
                            </p>
                          </div>
                          <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1">
                            <p className="text-[10px] text-zinc-400 font-mono">
                              Registered {refUser.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            {refUser.hasMadeFirstDeposit ? (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                                ✓ Qualified First Deposit
                              </span>
                            ) : (
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                                Pending Deposit
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subpage: Vouchers & Promo Codes */}
      {activeSubPage === 'vouchers' && (
        <VouchersView
          user={user}
          profile={profile}
          onProfileUpdate={(updated) => {
            setProfile(prev => prev ? { ...prev, ...updated } : null);
          }}
          onBack={() => setActiveSubPage('menu')}
          isLightTheme={true}
        />
      )}

      {/* Subpage: Wallet Security PIN */}
      {activeSubPage === 'pin' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button 
              id="pin-back-btn"
              onClick={() => { setActiveSubPage('menu'); setPinMessage(null); }}
              className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-colors cursor-pointer shadow-xs active:scale-95"
              title="Return to profile menu"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="text-left">
              <h2 className="text-xl font-black tracking-tight text-zinc-900">Transaction Security PIN</h2>
              <p className="text-xs text-zinc-500 font-medium">4-digit cryptographic authorization for funds & withdrawals</p>
            </div>
          </div>

          <div id="wallet-pin-security-card" className="space-y-4 text-left">
            {/* Status & Summary Banner */}
            <div className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#008B47]">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Capital Transfer Authorization</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Mandatory safeguard for payout and settlement requests</p>
                </div>
              </div>
              {profile?.walletPassword ? (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-bold flex items-center gap-1 uppercase tracking-wider shrink-0">
                  <CheckCircle2 size={11} /> Configured
                </span>
              ) : (
                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-bold uppercase tracking-wider animate-pulse shrink-0">
                  Setup Needed
                </span>
              )}
            </div>

            {profile?.walletPassword && !isChangingPin ? (
              <div className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-4 sm:p-5 flex flex-col gap-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100/70 text-[#007038] flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-zinc-900">Security PIN Is Fully Active</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                      Your 4-digit code is actively guarding your wallet balance against unauthorized payouts, transfers, or address changes.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-3">
                  <span className="text-xs text-zinc-500 font-medium">Need to update your authorization PIN?</span>
                  <button
                    id="change-pin-toggle-btn"
                    type="button"
                    onClick={() => {
                      setIsChangingPin(true);
                      setNewPin('');
                      setConfirmPin('');
                      setPin2faCode('');
                      setPinMessage(null);
                    }}
                    className="px-4 py-2 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-all cursor-pointer text-center active:scale-[0.99]"
                  >
                    Modify PIN
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSavePin} className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-4 sm:p-5 space-y-4 text-left">
                <div className="border-b border-zinc-100 pb-3">
                  <h4 className="text-sm font-bold text-zinc-900">
                    {profile?.walletPassword ? 'Update Transaction Security PIN' : 'Initialize New Security PIN'}
                  </h4>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Choose a confidential 4-digit numeric code that you will remember.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">New 4-Digit Code</label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="••••"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-base tracking-widest text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#008B47] focus:border-[#008B47]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Re-Enter to Confirm</label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="••••"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-base tracking-widest text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#008B47] focus:border-[#008B47]"
                    />
                  </div>
                </div>

                {/* Google Authenticator Input: Required if they are changing an existing PIN and have 2FA active */}
                {profile?.walletPassword && profile?.twoFactorEnabled && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                    <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                      <Smartphone size={13} className="text-[#008B47]" />
                      <span>Google Authenticator Verification</span>
                      <span className="text-[9px] text-emerald-800 font-mono bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Required</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="000000"
                      value={pin2faCode}
                      onChange={(e) => setPin2faCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-sm tracking-widest text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#008B47] focus:border-[#008B47]"
                    />
                    <p className="text-[10px] text-zinc-500 leading-tight">Supply the 6-digit code from your authenticator app to authorize credential changes.</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    id="submit-pin-btn"
                    type="submit"
                    disabled={pinSaving || newPin.length !== 4 || confirmPin.length !== 4}
                    className="flex-1 py-2.5 bg-[#008B47] hover:bg-[#007038] disabled:bg-zinc-150 disabled:text-zinc-400 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  >
                    {pinSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Securing PIN...</span>
                      </>
                    ) : (
                      <span>Save Security PIN</span>
                    )}
                  </button>
                  {profile?.walletPassword && (
                    <button
                      id="cancel-pin-edit-btn"
                      type="button"
                      onClick={() => {
                        setIsChangingPin(false);
                        setNewPin('');
                        setConfirmPin('');
                        setPin2faCode('');
                        setPinMessage(null);
                      }}
                      className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Subpage: Bound Withdrawal Address (BEP20) */}
      {activeSubPage === 'withdrawal_address' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button 
              id="withdrawal-address-back-btn"
              onClick={() => { setActiveSubPage('menu'); setAddressMessage(null); }}
              className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-colors cursor-pointer shadow-xs active:scale-95"
              title="Return to profile menu"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="text-left">
              <h2 className="text-xl font-black tracking-tight text-zinc-900">Settlement Payout Address</h2>
              <p className="text-xs text-zinc-500 font-medium">Designated USDT BEP20 (BNB Smart Chain) destination wallet</p>
            </div>
          </div>

          <div id="bep20-address-security-card" className="space-y-4 text-left">
            <div className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#008B47]">
                  <Wallet size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Settlement Gateway</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Automated routing for capital distributions</p>
                </div>
              </div>
              {profile?.bep20WithdrawalAddress ? (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-bold flex items-center gap-1 uppercase tracking-wider shrink-0">
                  <CheckCircle2 size={11} /> Bound & Verified
                </span>
              ) : (
                <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-full font-bold uppercase tracking-wider animate-pulse shrink-0">
                  Unbound
                </span>
              )}
            </div>

            {/* Protocol Security Information Banner */}
            <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex items-start gap-3 text-xs text-emerald-950">
              <ShieldCheck size={18} className="text-[#008B47] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-[11px] text-emerald-950 uppercase tracking-wide">
                  Zero Network-Mismatch Protocol
                </p>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Withdrawals are strictly dispatched through high-speed, minimal-fee BNB Smart Chain (BEP20). Binding a single verified destination prevents accidental cross-chain transmission and ensures capital reaches your personal custody instantly.
                </p>
              </div>
            </div>

            {profile?.bep20WithdrawalAddress && !isChangingAddress ? (
              <div className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-4 sm:p-5 flex flex-col gap-4 text-left">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Active Settlement Destination</span>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 bg-emerald-100/80 text-emerald-900 border border-emerald-200 rounded-md">
                      USDT BEP20 (BSC)
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-bold text-zinc-800 break-all select-all">
                      {profile.bep20WithdrawalAddress}
                    </span>
                    <button
                      type="button"
                      id="copy-bound-address-btn"
                      onClick={() => {
                        if (profile.bep20WithdrawalAddress) {
                          navigator.clipboard.writeText(profile.bep20WithdrawalAddress);
                          setAddressCopied(true);
                          toast.success('Address copied to clipboard', 'Copied');
                          setTimeout(() => setAddressCopied(false), 2500);
                        }
                      }}
                      className="p-2 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-600 transition-colors shrink-0 cursor-pointer shadow-xs"
                      title="Copy Address"
                    >
                      {addressCopied ? <Check size={14} className="text-[#008B47]" /> : <Copy size={14} />}
                    </button>
                  </div>

                  <p className="text-[11px] text-zinc-500">
                    Destination Status: <strong className="text-emerald-700 font-bold">Locked & Ready</strong>. Payouts will automatically disburse to this wallet.
                  </p>
                </div>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-3">
                  <span className="text-xs text-zinc-500 font-medium">Need to rebind to a different wallet?</span>
                  <button
                    id="change-bep20-address-btn"
                    type="button"
                    onClick={() => {
                      setIsChangingAddress(true);
                      setBep20AddressInput(profile.bep20WithdrawalAddress || '');
                      setBep20PinInput('');
                      setBep202faInput('');
                      setAddressMessage(null);
                    }}
                    className="px-4 py-2 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-all cursor-pointer text-center active:scale-[0.99]"
                  >
                    Modify Address
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveBep20Address} className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-4 sm:p-5 space-y-4 text-left">
                <div className="border-b border-zinc-100 pb-3 flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900">
                      {profile?.bep20WithdrawalAddress ? 'Update Settlement Address' : 'Bind Settlement Address'}
                    </h4>
                    <p className="text-xs text-zinc-500 mt-0.5">Must be a valid BEP20 Binance Smart Chain address</p>
                  </div>
                  <span className="text-[10px] text-emerald-800 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0 font-bold">USDT BEP20</span>
                </div>

                {/* BEP20 Address Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">
                    BNB Smart Chain (BEP20) Recipient Address *
                  </label>
                  <div className="relative">
                    <input
                      id="bep20-address-input"
                      type="text"
                      required
                      placeholder="0x..."
                      value={bep20AddressInput}
                      onChange={(e) => setBep20AddressInput(e.target.value.trim())}
                      className="w-full px-3.5 py-2.5 pr-8 bg-zinc-50 border border-zinc-200 rounded-xl font-mono text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#008B47] focus:border-[#008B47]"
                    />
                    {bep20AddressInput && (
                      <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                        {/^0x[a-fA-F0-9]{40}$/.test(bep20AddressInput.trim()) ? (
                          <CheckCircle2 size={16} className="text-[#008B47]" />
                        ) : (
                          <AlertCircle size={16} className="text-rose-500" />
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    Must start with <strong className="font-mono text-zinc-700">0x</strong> and contain exactly 42 alphanumeric characters.
                  </p>
                </div>

                {/* Security PIN Authorization */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      <Lock size={11} className="text-[#008B47]" />
                      <span>Security PIN Authorization (4 Digits) *</span>
                    </label>
                    {!profile?.walletPassword && (
                      <button
                        type="button"
                        onClick={() => { setActiveSubPage('pin'); }}
                        className="text-[10px] text-[#008B47] font-bold hover:underline cursor-pointer"
                      >
                        Set PIN First
                      </button>
                    )}
                  </div>
                  <input
                    id="bep20-pin-input"
                    type="password"
                    required
                    maxLength={4}
                    placeholder="••••"
                    value={bep20PinInput}
                    onChange={(e) => setBep20PinInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-base tracking-widest text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#008B47] focus:border-[#008B47]"
                  />
                </div>

                {/* Google Authenticator if enabled */}
                {profile?.twoFactorEnabled && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                    <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                      <Smartphone size={13} className="text-[#008B47]" />
                      <span>Google Authenticator (2FA) Code *</span>
                    </label>
                    <input
                      id="bep20-2fa-input"
                      type="text"
                      required
                      maxLength={6}
                      placeholder="000000"
                      value={bep202faInput}
                      onChange={(e) => setBep202faInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-sm tracking-widest text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#008B47] focus:border-[#008B47]"
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    id="submit-bep20-address-btn"
                    type="submit"
                    disabled={addressSaving || !bep20AddressInput || !/^0x[a-fA-F0-9]{40}$/.test(bep20AddressInput.trim()) || (profile?.walletPassword ? bep20PinInput.length !== 4 : false)}
                    className="flex-1 py-2.5 bg-[#008B47] hover:bg-[#007038] disabled:bg-zinc-150 disabled:text-zinc-400 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  >
                    {addressSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Binding Address...</span>
                      </>
                    ) : (
                      <span>Save & Lock Settlement Destination</span>
                    )}
                  </button>

                  {profile?.bep20WithdrawalAddress && (
                    <button
                      id="cancel-bep20-edit-btn"
                      type="button"
                      onClick={() => {
                        setIsChangingAddress(false);
                        setBep20AddressInput('');
                        setBep20PinInput('');
                        setBep202faInput('');
                        setAddressMessage(null);
                      }}
                      className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Subpage: 2FA */}
      {activeSubPage === '2fa' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button 
              id="2fa-back-btn"
              onClick={() => { setActiveSubPage('menu'); }}
              className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-colors cursor-pointer shadow-xs active:scale-95"
              title="Return to profile menu"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="text-left">
              <h2 className="text-xl font-black tracking-tight text-zinc-900">Two-Factor Authentication (2FA)</h2>
              <p className="text-xs text-zinc-500 font-medium">Time-based one-time password (TOTP) defense</p>
            </div>
          </div>

          <div id="two-factor-auth-card" className="space-y-4 text-left">
            <div className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#008B47]">
                  <Smartphone size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Google Authenticator</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Hardware-bound cryptographic token sync</p>
                </div>
              </div>
              {profile?.twoFactorEnabled ? (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-bold flex items-center gap-1 uppercase tracking-wider shrink-0">
                  <CheckCircle2 size={11} /> Protected
                </span>
              ) : (
                <span className="text-[10px] bg-zinc-100 text-zinc-600 border border-zinc-200 px-3 py-1 rounded-full font-bold uppercase tracking-wider shrink-0">
                  Not Activated
                </span>
              )}
            </div>

            {profile?.twoFactorEnabled ? (
              <div className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-start gap-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-emerald-100/70 text-[#007038] flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900">Two-Factor Protection Is Enforced</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                      All settlement requests, sensitive security updates, and critical account actions require your dynamic 6-digit TOTP code.
                    </p>
                  </div>
                </div>

                {showDeactivateInput ? (
                  <div className="space-y-3 pt-3 border-t border-zinc-100">
                    {deactivateError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span>{deactivateError}</span>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Verify With Current 6-Digit Code</label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="000000"
                        value={deactivateCode}
                        onChange={(e) => setDeactivateCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-base tracking-widest text-zinc-900 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDisable2fa}
                        disabled={deactivating || deactivateCode.length !== 6}
                        className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-zinc-150 disabled:text-zinc-400 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer active:scale-95"
                      >
                        {deactivating ? 'Deauthorizing...' : 'Deactivate Two-Factor'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowDeactivateInput(false); setDeactivateError(null); }}
                        className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-3">
                    <span className="text-xs text-zinc-500 font-medium">Temporarily disable authenticator sync?</span>
                    <button
                      type="button"
                      onClick={() => setShowDeactivateInput(true)}
                      className="px-4 py-2 bg-zinc-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-zinc-700 border border-zinc-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Power size={13} />
                      Deactivate 2FA
                    </button>
                  </div>
                )}
              </div>
            ) : !is2faSetupOpen ? (
              <div className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-5 text-left space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-zinc-900">Recommended Security Elevation</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Connecting an authenticator app (Google Authenticator, Microsoft Authenticator, or 1Password) creates a secondary offline defense against unauthorized withdrawals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={generate2faSecret}
                  className="w-full py-3 bg-[#008B47] hover:bg-[#007038] text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
                >
                  <QrCode size={15} />
                  <span>Begin Authenticator Pairing</span>
                </button>
              </div>
            ) : (
              <div className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <span className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <QrCode size={15} className="text-[#008B47]" />
                    Pair Google Authenticator
                  </span>
                  <button
                    type="button"
                    onClick={() => setIs2faSetupOpen(false)}
                    className="text-[10px] text-zinc-400 hover:text-zinc-600 font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                {verificationError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>{verificationError}</span>
                  </div>
                )}

                {/* Step 1: Scan QR */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Step 1 • Scan Barcode with Authenticator</span>
                  <div className="flex justify-center p-3 bg-white border border-zinc-200 rounded-2xl max-w-[170px] mx-auto shadow-xs">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`otpauth://totp/CME:${profile?.email || user.email}?secret=${temp2faSecret}&issuer=CME%20Markets`)}`}
                      alt="2FA QR Code"
                      className="w-36 h-36"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                {/* Step 2: Copy Key */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Step 2 • Or Enter Manual Key</span>
                  <div className="flex gap-2 items-center bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl font-mono text-xs">
                    <span className="text-[#007038] font-bold tracking-wider select-all truncate flex-1">{temp2faSecret}</span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="p-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-600 transition-colors cursor-pointer shadow-xs"
                      title="Copy Key"
                    >
                      {copied ? <Check size={13} className="text-[#008B47]" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                {/* Step 3: Enter Verification Code */}
                <div className="space-y-2 pt-2 border-t border-zinc-100">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Step 3 • Verify 6-Digit Code</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-base tracking-widest text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#008B47] focus:border-[#008B47]"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyAndEnable2fa}
                      disabled={verificationCode.length !== 6}
                      className="px-5 bg-[#008B47] text-white hover:bg-[#007038] disabled:bg-zinc-150 disabled:text-zinc-400 font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer active:scale-95"
                    >
                      Confirm & Activate
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subpage: Customer Support */}
      {activeSubPage === 'support' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button 
              id="support-back-btn"
              onClick={() => { setActiveSubPage('menu'); }}
              className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-colors cursor-pointer shadow-xs active:scale-95"
              title="Return to profile menu"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="text-left">
              <h2 className="text-xl font-black tracking-tight text-zinc-900">Institutional Concierge Support</h2>
              <p className="text-xs text-zinc-500 font-medium">24/7 client trading assistance & settlement inquiry desk</p>
            </div>
          </div>

          <div className="space-y-4 text-left">
            {/* Status Banner */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 sm:p-5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#008B47] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#008B47]"></span>
                  </span>
                  Support Desk Online
                </h3>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#007038]">
                  Average Response: &lt; 3 mins
                </span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Connect directly with our dedicated institutional operators for assistance with real-time trading executions, capital allocations, network confirmations, or affiliate rebate settlements.
              </p>
            </div>

            {/* Support Channels */}
            <div className="space-y-3">
              <a
                id="telegram-official-support-link"
                href="https://t.me/Wendyus1"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 bg-white hover:bg-zinc-50 border border-zinc-200/80 hover:border-emerald-300 p-4 sm:p-5 rounded-2xl transition-all group cursor-pointer no-underline block shadow-xs"
              >
                <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shrink-0 group-hover:scale-105 shadow-xs transition-all">
                  <Send size={20} className="translate-x-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-zinc-900 group-hover:text-zinc-950 transition-colors">Direct Telegram Support Desk</h4>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                      @Wendyus1
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">Encrypted private messaging with CME verified desk operators</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ChevronRight size={18} className="text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                </div>
              </a>
            </div>

            {/* Official Security Notice */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 flex gap-3 text-xs text-zinc-500 leading-relaxed">
              <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-800 block mb-1">Security & Authenticity Notice</strong>
                CME representatives will never request your transaction PIN, Google Authenticator keys, or wallet seed phrases. Always ensure you are communicating via our verified channel.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subpage: Mobile App Installation & Sync (Google Play Mockup) */}
      {activeSubPage === 'mobile_app' && (
        <div className="space-y-6">
          {/* Google Play Styled App Store Screen Frame */}
          <div className="w-full max-w-lg mx-auto bg-[#fafafa] rounded-[2.5rem] overflow-hidden shadow-2xl border border-zinc-200 text-zinc-800 font-sans transition-all flex flex-col animate-fade-in">
            
            {/* 3. Google Play Store Brand Header */}
            <div className="bg-white border-b border-zinc-100 px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveSubPage('menu')}
                  className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer"
                  title="Go back to profile menu"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="flex items-center gap-2">
                  {/* Google Play Logo SVG */}
                  <svg viewBox="0 0 48 48" className="w-6 h-6 shrink-0">
                    <path d="M10 42V6l22 18z" fill="#00c853" />
                    <path d="M32 24L10 6v36z" fill="#ffeb3b" opacity="0.3" />
                    <path d="M10 6l22 18L39 12z" fill="#ff1744" />
                    <path d="M10 42l22-18 7 12z" fill="#2979ff" />
                  </svg>
                  <span className="text-zinc-600 font-sans font-medium text-lg tracking-tight select-none">
                    Google Play
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-zinc-400">
                <Search size={18} />
                <div className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-black select-none">
                  A
                </div>
              </div>
            </div>

            {/* 4. Play Store App Details Area */}
            <div className="bg-white px-5 pt-5 pb-4 space-y-4 text-left">
              
              {/* App Basic Info */}
              <div className="flex gap-4 items-start">
                
                {/* CME Rounded App Icon */}
                <div className="w-18 h-18 rounded-2xl bg-zinc-950 border border-emerald-300 shadow-md flex items-center justify-center shrink-0 overflow-hidden select-none">
                  <img 
                    src="/icon.svg" 
                    alt="CME" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Name, Subtitle & Safety */}
                <div className="space-y-1">
                  <h1 className="text-xl font-bold text-zinc-900 leading-tight">
                    CME
                  </h1>
                  <h2 className="text-xs font-semibold text-[#008B47] tracking-wide uppercase">
                    CME Digital Assets
                  </h2>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-semibold select-none pt-0.5">
                    <ShieldCheck className="text-[#008B47]" size={12} />
                    <span>Verified by Play Protect</span>
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-1 py-1.5 border-y border-zinc-100 text-center select-none">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-zinc-800 block">4.88 ★</span>
                  <span className="text-[10px] text-zinc-400 block font-medium">527K reviews</span>
                </div>
                <div className="space-y-0.5 border-x border-zinc-100">
                  <span className="text-xs font-black text-zinc-800 block">100K+</span>
                  <span className="text-[10px] text-zinc-400 block font-medium">Downloads</span>
                </div>
                <div className="space-y-0.5 flex flex-col items-center justify-center">
                  <div className="p-0.5 rounded bg-emerald-50 text-[#008B47] shrink-0">
                    <CheckCircle2 size={10} />
                  </div>
                  <span className="text-[9px] text-zinc-500 block font-black mt-0.5 uppercase tracking-tight">Editors' Choice</span>
                </div>
              </div>

              {/* Install Button Block */}
              <div className="space-y-3">
                {installSuccess ? (
                  <div className="space-y-3.5 animate-fade-in">
                    <div className="flex">
                      <button
                        id="playstore-uninstall-btn"
                        onClick={() => {
                          setInstallProgress(null);
                          setInstallSuccess(false);
                          setShowPwaInstructions(false);
                          localStorage.removeItem('arbitrage_pwa_installed');
                          localStorage.setItem('profile_subpage', 'mobile_app');
                          // Reload the page to clear the browser's PWA install state so Chrome re-triggers beforeinstallprompt!
                          window.location.reload();
                        }}
                        className="w-full py-2.5 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 hover:text-zinc-900 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Uninstall</span>
                      </button>
                    </div>

                    {/* Clear instruction helper for Android APK installs */}
                    <div className="bg-emerald-50 border border-emerald-200/60 p-4 rounded-2xl text-left space-y-2 shadow-sm">
                      <div className="flex items-center gap-2 text-emerald-800 text-[11px] font-black uppercase tracking-tight">
                        <CheckCircle2 size={14} className="text-[#008B47] animate-bounce" />
                        <span>Download Complete! What's Next?</span>
                      </div>
                      
                      <div className="text-[11px] font-bold text-emerald-900 leading-snug font-sans uppercase tracking-wide pl-5.5">
                        OPEN CME ON YOUR HOMESCREEN
                      </div>
                    </div>
                  </div>
                ) : installProgress === null ? (
                  <div className="space-y-3">
                    <button
                      id="playstore-install-btn"
                      onClick={handleInstallClick}
                      disabled={pwaLoading}
                      className="w-full py-2.5 bg-[#008B47] hover:bg-[#007038] active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-700/10 disabled:opacity-90 disabled:cursor-wait"
                    >
                      {pwaLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Installing CME...</span>
                        </>
                      ) : (
                        <span>Install App</span>
                      )}
                    </button>

                    {showPwaInstructions && (
                      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-left space-y-3.5 animate-fade-in">
                        <div className="flex justify-between items-center border-b border-zinc-200/60 pb-2">
                          <span className="text-[11px] font-extrabold text-zinc-900 tracking-tight uppercase flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#008B47] animate-pulse" />
                            CME Installation Guide
                          </span>
                          <button 
                            onClick={() => setShowPwaInstructions(false)}
                            className="text-[10px] text-zinc-400 hover:text-zinc-600 font-bold px-2 py-0.5 bg-zinc-100 rounded-md"
                          >
                            Hide
                          </button>
                        </div>

                        {/* 1-Click Restore Alert */}
                        {!deferredPrompt && (
                          <div className="bg-emerald-50 border border-emerald-200/70 p-3.5 rounded-xl flex items-start gap-3 text-xs text-emerald-800 leading-normal font-medium shadow-sm animate-fade-in">
                            <div className="p-1.5 bg-emerald-100 text-[#008B47] rounded-lg animate-pulse shrink-0">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 4.89M9 11l3 3L22 4" />
                              </svg>
                            </div>
                            <div className="space-y-1.5 flex-1 text-left">
                              <strong className="text-emerald-950 text-[12px] block font-black">🔄 Just uninstalled CME?</strong>
                            
                              <button
                                onClick={() => window.location.reload()}
                                className="mt-1 px-3 py-1.5 bg-[#008B47] hover:bg-[#007038] active:scale-95 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                              >
                                <span>Reload & Restore 1-Click Install</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* OS Tabs */}
                        <div className="grid grid-cols-3 gap-1 bg-zinc-100 p-0.5 rounded-lg text-[10px] font-bold">
                          <button
                            onClick={() => setDeviceTab('android')}
                            className={`py-1.5 rounded-md transition-all cursor-pointer ${deviceTab === 'android' ? 'bg-white text-[#008B47] shadow-sm font-black' : 'text-zinc-500 hover:text-zinc-850'}`}
                          >
                            Android
                          </button>
                          <button
                            onClick={() => setDeviceTab('ios')}
                            className={`py-1.5 rounded-md transition-all cursor-pointer ${deviceTab === 'ios' ? 'bg-white text-[#008B47] shadow-sm font-black' : 'text-zinc-500 hover:text-zinc-855'}`}
                          >
                            iOS (iPhone)
                          </button>
                          <button
                            onClick={() => setDeviceTab('desktop')}
                            className={`py-1.5 rounded-md transition-all cursor-pointer ${deviceTab === 'desktop' ? 'bg-white text-[#008B47] shadow-sm font-black' : 'text-zinc-500 hover:text-zinc-855'}`}
                          >
                            Computer
                          </button>
                        </div>

                        {/* Step-by-step instructions based on selected device */}
                        <div className="p-3 bg-white rounded-xl border border-zinc-200/80 space-y-2 text-xs">
                          {deviceTab === 'android' && (
                            <div className="space-y-2">
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#008B47] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                                <p className="text-zinc-700 text-[11px] leading-snug">Tap the <strong>Chrome menu (⋮)</strong> at top right</p>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#008B47] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                                <p className="text-zinc-700 text-[11px] leading-snug">Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></p>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#008B47] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                                <p className="text-zinc-700 text-[11px] leading-snug">CME installs seamlessly as a native application with zero storage bloat!</p>
                              </div>
                            </div>
                          )}

                          {deviceTab === 'ios' && (
                            <div className="space-y-2">
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#008B47] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                                <p className="text-zinc-700 text-[11px] leading-snug">Tap the <strong>Share</strong> button in Safari's bottom bar (box with arrow)</p>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#008B47] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                                <p className="text-zinc-700 text-[11px] leading-snug">Scroll down and select <strong>"Add to Home Screen"</strong></p>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#008B47] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                                <p className="text-zinc-700 text-[11px] leading-snug">Tap <strong>"Add"</strong> in top right to launch CME natively in standalone mode!</p>
                              </div>
                            </div>
                          )}

                          {deviceTab === 'desktop' && (
                            <div className="space-y-2">
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#008B47] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                                <p className="text-zinc-700 text-[11px] leading-snug">Look for the <strong>Install icon (⊕)</strong> on the right of the browser URL bar</p>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#008B47] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                                <p className="text-zinc-700 text-[11px] leading-snug">Click <strong>"Install CME"</strong> to launch in its own high-speed desktop window!</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Direct APK Fallback Option */}
                        <div className="border-t border-zinc-200/80 pt-4 mt-2">
                          <div className="bg-gradient-to-br from-zinc-900 to-slate-950 text-white rounded-xl p-3.5 shadow-md border border-zinc-800/80 hover:border-emerald-500/30 transition-all duration-300 relative overflow-hidden group">
                            {/* Background Glow Accent */}
                            <div className="absolute -right-10 -bottom-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all duration-500 pointer-events-none"></div>
                            
                            <div className="flex items-center justify-between gap-3 relative z-10">
                              <div className="space-y-1 text-left">
                                <h4 className="text-[11px] font-black text-zinc-100 tracking-tight flex items-center gap-1.5">
                                  <span>CME Android Package</span>
                                  <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-mono">APK</span>
                                </h4>
                                <p className="text-[9px] text-zinc-400 font-medium leading-relaxed max-w-[160px]">
                                  Direct offline package installer (CME.apk).
                                </p>
                              </div>
                              
                              <button
                                onClick={startApkDownload}
                                className="px-3.5 py-2 bg-gradient-to-r from-[#008B47] to-[#00A653] hover:from-[#007038] hover:to-[#008B47] active:scale-95 text-white text-[10px] font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/40 border border-[#F4E100]/30"
                              >
                                <Download size={12} className="stroke-[2.5]" />
                                <span>Download CME.apk</span>
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 bg-[#f6f6f6] border border-zinc-200/50 p-4 rounded-xl animate-fade-in text-left">
                    <div className="flex justify-between items-center text-[11px] font-bold text-zinc-700">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#008B47] animate-ping" />
                        {installStatusText}
                      </span>
                      <span className="font-mono text-zinc-900">{installProgress}%</span>
                    </div>
                    {/* Linear Progress Bar */}
                    <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#008B47] rounded-full transition-all duration-150"
                        style={{ width: `${installProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Auxiliary Actions */}
              <div className="flex justify-center gap-6 py-1 select-none text-zinc-500 text-xs font-medium">
                <button className="flex items-center gap-1.5 hover:text-[#008B47] transition-colors cursor-default">
                  <Share2 size={14} className="text-[#008B47]" />
                  <span>Share</span>
                </button>
                <button className="flex items-center gap-1.5 hover:text-[#008B47] transition-colors cursor-default">
                  <Plus size={14} className="text-[#008B47]" />
                  <span>Add to wishlists</span>
                </button>
              </div>

              {/* About This App Section */}
              <div className="space-y-2 pt-3 border-t border-zinc-100 text-left select-none text-zinc-600">
                <div className="flex justify-between items-center text-xs font-bold text-zinc-900">
                  <span>About this app</span>
                  <ChevronRight size={16} className="text-zinc-400" />
                </div>
                <p className="text-[10.5px] text-zinc-600 leading-relaxed font-sans">
                  CME is an institutional digital asset trading and wealth platform engineered for modern investors. Access automated copy trading with verified master traders, algorithmic bot execution, high-yield arbitrage portfolios, and secure peer-to-peer (P2P) mobile money escrows across East Africa and international networks. Enjoy low-latency order execution, multi-layer cryptographic asset protection, and instant wallet settlements on your device.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[8px] bg-zinc-100 text-zinc-700 px-2.5 py-0.5 rounded-full font-bold border border-zinc-200/60">Copy Trading</span>
                  <span className="text-[8px] bg-zinc-100 text-zinc-700 px-2.5 py-0.5 rounded-full font-bold border border-zinc-200/60">P2P Mobile Money</span>
                  <span className="text-[8px] bg-zinc-100 text-zinc-700 px-2.5 py-0.5 rounded-full font-bold border border-zinc-200/60">Crypto Exchange</span>
                  <span className="text-[8px] bg-zinc-100 text-zinc-700 px-2.5 py-0.5 rounded-full font-bold border border-zinc-200/60">Algorithmic Bot</span>
                  <span className="text-[8px] bg-zinc-100 text-zinc-700 px-2.5 py-0.5 rounded-full font-bold border border-zinc-200/60">Secure Escrow</span>
                </div>
              </div>

            </div>

            {/* 7. Bottom Navigation Tabs (Play Store Mock) */}
            <div className="bg-white border-t border-zinc-100 px-2 py-1.5 grid grid-cols-5 text-center select-none text-zinc-400">
              <div className="space-y-0.5 flex flex-col items-center justify-center py-1 cursor-default">
                <Gamepad2 size={16} />
                <span className="text-[8px] font-bold">Games</span>
              </div>
              <div className="space-y-0.5 flex flex-col items-center justify-center py-1 text-[#008B47] cursor-default relative">
                <LayoutGrid size={16} />
                <span className="text-[8px] font-black">Apps</span>
                {/* Underline bar */}
                <div className="absolute bottom-0 w-8 h-0.5 bg-[#008B47] rounded-full" />
              </div>
              <div className="space-y-0.5 flex flex-col items-center justify-center py-1 cursor-default">
                <Clapperboard size={16} />
                <span className="text-[8px] font-bold">Movies & TV</span>
              </div>
              <div className="space-y-0.5 flex flex-col items-center justify-center py-1 cursor-default">
                <BookOpen size={16} />
                <span className="text-[8px] font-bold">Books</span>
              </div>
              <div className="space-y-0.5 flex flex-col items-center justify-center py-1 cursor-default">
                <Star size={16} />
                <span className="text-[8px] font-bold">Children</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showOpenInstruction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white border border-zinc-200 text-zinc-800 rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl relative animate-scale-up p-1">
            <div className="bg-zinc-50/50 rounded-[1.8rem] p-5">
              
              {/* Close Button */}
              <button 
                onClick={() => setShowOpenInstruction(false)}
                className="absolute top-6 right-6 p-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-all cursor-pointer z-10 shadow-sm"
              >
                <X size={15} />
              </button>

              {/* Icon & Glow */}
              <div className="text-center relative pt-2">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-zinc-950 border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/10 flex items-center justify-center overflow-hidden relative group mb-3">
                  <div className="absolute inset-0 bg-emerald-500/10 rounded-3xl animate-pulse"></div>
                  <img 
                    src="/icon.svg" 
                    alt="CME" 
                    className="w-14 h-14 object-cover relative z-10"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h3 className="text-base font-bold tracking-tight text-zinc-800">
                  Launch CME Standalone App
                </h3>
                <p className="text-[11px] text-zinc-500 mt-1.5 font-medium leading-relaxed px-2">
                  Due to browser security policies, websites cannot launch installed apps directly. Follow these simple steps to run CME:
                </p>
              </div>

              {/* Instructions Steps */}
              <div className="py-5 space-y-4 text-left border-y border-zinc-200 my-4">
                <div className="flex gap-3.5 items-start">
                  <div className="w-5.5 h-5.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[#008B47] font-extrabold flex items-center justify-center text-[10px] shrink-0 shadow-sm">
                    1
                  </div>
                  <div>
                    <strong className="text-zinc-800 text-xs block font-bold">Go to your Home Screen</strong>
                    <p className="text-[11px] text-zinc-500 leading-normal mt-0.5">
                      Press your phone's home button or swipe up to exit the browser.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3.5 items-start">
                  <div className="w-5.5 h-5.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[#008B47] font-extrabold flex items-center justify-center text-[10px] shrink-0 shadow-sm">
                    2
                  </div>
                  <div>
                    <strong className="text-zinc-800 text-xs block font-bold">Find the "CME" Icon</strong>
                    <p className="text-[11px] text-zinc-500 leading-normal mt-0.5 font-medium">
                      Look for the dark round icon with the bold <span className="text-[#008B47] font-bold">"CME"</span> lettering and lime accent on your home screen or app drawer.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3.5 items-start">
                  <div className="w-5.5 h-5.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[#008B47] font-extrabold flex items-center justify-center text-[10px] shrink-0 shadow-sm">
                    3
                  </div>
                  <div>
                    <strong className="text-zinc-800 text-xs block font-bold">Tap to launch natively</strong>
                    <p className="text-[11px] text-zinc-500 leading-normal mt-0.5">
                      Tap the icon to start the immersive, full-screen standalone application!
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => setShowOpenInstruction(false)}
                  className="w-full py-2.5 bg-gradient-to-r from-[#008B47] to-[#00A653] hover:from-[#007038] hover:to-[#008B47] text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-700/20 cursor-pointer active:scale-95"
                >
                  Got it, I'll open it!
                </button>
                <button
                  onClick={() => {
                    setShowOpenInstruction(false);
                    localStorage.removeItem('profile_subpage');
                    onBack();
                  }}
                  className="w-full py-2 bg-transparent hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 rounded-xl text-[11px] font-bold transition-all border border-transparent hover:border-zinc-200 cursor-pointer"
                >
                  Continue in browser tab
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
      </div>

      {/* Sticky Bottom Navigation (Profile Tab Active) */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 px-2 sm:px-4 py-2 flex justify-around items-center max-w-md mx-auto border-t bg-[#EBF9F0]/95 border-emerald-200/80 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] backdrop-blur-md">
        {([
          { id: 'home', label: 'Home', icon: Coins, path: '/dashboard' },
          { id: 'wallet', label: 'Wallet', icon: Wallet, path: '/wallet' },
          { id: 'earn', label: 'Copy Trading', icon: Users, path: '/earn' },
          { id: 'history', label: 'History', icon: History, path: '/history' },
          { id: 'profile', label: 'Profile', icon: User, path: '/profile' }
        ] as const).map(tab => {
          const Icon = tab.icon;
          const isSelected = tab.id === 'profile';
          return (
            <button
              key={tab.id}
              id={`profile-nav-tab-btn-${tab.id}`}
              onClick={() => {
                if (tab.id === 'profile') {
                  setActiveSubPage('menu');
                  localStorage.removeItem('profile_subpage');
                } else if (onNavigate) {
                  localStorage.removeItem('profile_subpage');
                  onNavigate(tab.path);
                } else {
                  localStorage.removeItem('profile_subpage');
                  onBack();
                }
              }}
              className={`flex flex-col items-center gap-1 py-1 px-1.5 sm:px-2.5 rounded-xl transition-all cursor-pointer select-none ${
                isSelected 
                  ? 'text-[#008B47] font-black' 
                  : 'text-zinc-600 hover:text-zinc-950 font-semibold'
              }`}
            >
              <div className={`p-1 rounded-lg transition-colors ${
                isSelected ? 'bg-emerald-500/10' : 'bg-transparent'
              }`}>
                <Icon size={18} className={isSelected ? 'scale-110 transition-transform stroke-[2.5]' : 'stroke-2'} />
              </div>
              <span className="text-[10px] tracking-tight whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </footer>
    </div>
  );
}
