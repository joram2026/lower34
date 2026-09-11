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
  Search, MoreVertical, Info, ShieldCheck, X, Zap, Tag, Wallet
} from 'lucide-react';
import VouchersView from './VouchersView';

interface ProfileViewProps {
  user: any;
  onBack: () => void;
}

export default function ProfileView({ user, onBack }: ProfileViewProps) {
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
    const referralLink = `${window.location.origin}/#/signup?ref=${code}`;
    
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
    <div className="w-full min-h-screen bg-[#EBF9F0] font-sans pb-12 text-zinc-800 transition-colors duration-300">
      <div id="profile-view-container" className="max-w-md mx-auto p-4 sm:p-6">
        {activeSubPage === 'menu' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <button 
                id="profile-back-btn"
                onClick={() => {
                  localStorage.removeItem('profile_subpage');
                  onBack();
                }}
                className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="text-left">
                <h2 className="text-xl font-bold tracking-tight text-zinc-850">Security & Profile</h2>
                <p className="text-xs text-zinc-500">Manage security settings and credentials</p>
              </div>
            </div>

            {/* User profile banner */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 flex items-center gap-3.5 text-left shadow-sm">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#008B47] to-[#00A653] flex items-center justify-center text-white font-extrabold text-base shadow-md uppercase">
                {displayName ? displayName.charAt(0) : (user.email ? user.email.charAt(0) : 'U')}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-zinc-800 truncate">{displayName || 'Anonymous User'}</h3>
                <p className="text-[11px] text-zinc-500 font-mono truncate">{user.email}</p>
                {phone && (
                  <p className="text-[10px] text-[#007038] font-mono font-medium truncate flex items-center gap-1 mt-0.5">
                    <Smartphone size={10} />
                    {phone}
                  </p>
                )}
              </div>
              <div className="bg-emerald-50 border border-emerald-100 text-[#007038] text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shrink-0">
                <Shield size={10} />
                <span>Verified</span>
              </div>
            </div>

            {/* Navigation Links List */}
            <div className="space-y-3.5 text-left">
              {/* Personal Info */}
              <button
                id="nav-personal-info"
                onClick={() => { setActiveSubPage('personal'); setMessage(null); }}
                className="w-full bg-white border border-zinc-200/60 hover:border-emerald-400/50 hover:bg-zinc-50 p-4 rounded-2xl flex items-center gap-4 transition-all cursor-pointer group shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-[#008B47]/10 flex items-center justify-center text-[#008B47] shrink-0 group-hover:bg-[#008B47]/20 group-hover:text-[#007038] transition-all">
                  <User size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h4 className="text-sm font-bold text-zinc-700 group-hover:text-zinc-900 transition-colors">Personal Details</h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">Display name and basic account settings</p>
                </div>
                <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-600 transition-colors shrink-0" />
              </button>

              {/* Referral Program */}
              <button
                id="nav-referral-program"
                onClick={() => { setActiveSubPage('referral'); setMessage(null); }}
                className="w-full bg-white border border-zinc-200/60 hover:border-emerald-400/50 hover:bg-zinc-50 p-4 rounded-2xl flex items-center gap-4 transition-all cursor-pointer group shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-[#008B47]/10 flex items-center justify-center text-[#008B47] shrink-0 group-hover:bg-[#008B47]/20 group-hover:text-[#007038] transition-all">
                  <Gift size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h4 className="text-sm font-bold text-zinc-700 group-hover:text-zinc-900 transition-colors">Referral Program</h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">Invite friends and track your referral list</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-550">
                    {referredUsers.length}
                  </span>
                  <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-600 transition-colors shrink-0" />
                </div>
              </button>

              {/* Vouchers & Promo Codes */}
              <button
                id="nav-vouchers-rewards"
                onClick={() => { setActiveSubPage('vouchers'); setMessage(null); }}
                className="w-full bg-white border border-zinc-200/60 hover:border-emerald-400/50 hover:bg-zinc-50 p-4 rounded-2xl flex items-center gap-4 transition-all cursor-pointer group shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-[#008B47]/10 flex items-center justify-center text-[#008B47] shrink-0 group-hover:bg-[#008B47]/20 group-hover:text-[#007038] transition-all">
                  <Tag size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h4 className="text-sm font-bold text-zinc-700 group-hover:text-zinc-900 transition-colors">Vouchers & Promo Codes</h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">Redeem promotional vouchers & trial passes</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-[#006030]">
                    Redeem
                  </span>
                  <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-600 transition-colors shrink-0" />
                </div>
              </button>

              {/* Wallet PIN */}
              <button
                id="nav-wallet-pin"
                onClick={() => { setActiveSubPage('pin'); setPinMessage(null); }}
                className="w-full bg-white border border-zinc-200/60 hover:border-emerald-400/50 hover:bg-zinc-50 p-4 rounded-2xl flex items-center gap-4 transition-all cursor-pointer group shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-[#008B47]/10 flex items-center justify-center text-[#008B47] shrink-0 group-hover:bg-[#008B47]/20 group-hover:text-[#007038] transition-all">
                  <Lock size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h4 className="text-sm font-bold text-zinc-700 group-hover:text-zinc-900 transition-colors">Wallet Security PIN</h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">4-digit security PIN for secure cashouts</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {profile?.walletPassword ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[#007038]">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#007038] animate-pulse">
                      Not Set
                    </span>
                  )}
                  <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-600 transition-colors shrink-0" />
                </div>
              </button>

              {/* Bound Withdrawal Address (BEP20) */}
              <button
                id="nav-withdrawal-address"
                onClick={() => { 
                  setActiveSubPage('withdrawal_address'); 
                  setAddressMessage(null);
                  setIsChangingAddress(false);
                }}
                className="w-full bg-white border border-zinc-200/60 hover:border-emerald-400/50 hover:bg-zinc-50 p-4 rounded-2xl flex items-center gap-4 transition-all cursor-pointer group shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-[#008B47]/10 flex items-center justify-center text-[#008B47] shrink-0 group-hover:bg-[#008B47]/20 group-hover:text-[#007038] transition-all">
                  <Wallet size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-zinc-700 group-hover:text-zinc-900 transition-colors">Bound USDT Address</h4>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-emerald-100/90 text-emerald-950 border border-emerald-300/80 rounded">USDT BEP20</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">Verified destination wallet for fast automated USDT cashouts</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {profile?.bep20WithdrawalAddress ? (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 size={10} />
                      <span>{profile.bep20WithdrawalAddress.slice(0, 4)}...{profile.bep20WithdrawalAddress.slice(-4)}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 animate-pulse">
                      Not Bound
                    </span>
                  )}
                  <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-600 transition-colors shrink-0" />
                </div>
              </button>

              {/* Google Authenticator */}
              <button
                id="nav-google-authenticator"
                onClick={() => { setActiveSubPage('2fa'); }}
                className="w-full bg-white border border-zinc-200/60 hover:border-emerald-400/50 hover:bg-zinc-50 p-4 rounded-2xl flex items-center gap-4 transition-all cursor-pointer group shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-[#008B47]/10 flex items-center justify-center text-[#008B47] shrink-0 group-hover:bg-[#008B47]/20 group-hover:text-[#007038] transition-all">
                  <Smartphone size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h4 className="text-sm font-bold text-zinc-700 group-hover:text-zinc-900 transition-colors">Google Authenticator</h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">Add dynamic passcode 2FA protection</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {profile?.twoFactorEnabled ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[#007038]">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-500">
                      Disabled
                    </span>
                  )}
                  <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-600 transition-colors shrink-0" />
                </div>
              </button>

              {/* Customer Support */}
              <button
                id="nav-customer-support"
                onClick={() => { setActiveSubPage('support'); setMessage(null); }}
                className="w-full bg-white border border-zinc-200/60 hover:border-emerald-400/50 hover:bg-zinc-50 p-4 rounded-2xl flex items-center gap-4 transition-all cursor-pointer group shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-[#008B47]/10 flex items-center justify-center text-[#008B47] shrink-0 group-hover:bg-[#008B47]/20 group-hover:text-[#007038] transition-all">
                  <HelpCircle size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h4 className="text-sm font-bold text-zinc-700 group-hover:text-zinc-900 transition-colors">Customer Support</h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">Get 24/7 assistance via Telegram (@Morexsuppor)</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[#007038]">
                    Online
                  </span>
                  <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-600 transition-colors shrink-0" />
                </div>
              </button>

              {/* Mobile App & Android Sync */}
              <button
                id="nav-mobile-app"
                onClick={() => { setActiveSubPage('mobile_app'); setMessage(null); }}
                className="w-full bg-gradient-to-r from-white to-emerald-50/50 border border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50/70 p-4 rounded-2xl flex items-center gap-4 transition-all cursor-pointer group shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-[#008B47]/15 flex items-center justify-center text-[#008B47] shrink-0 group-hover:scale-105 transition-all">
                  <Smartphone size={18} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h4 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
                    CME Mobile App (PWA)
                    <span className="text-[8px] bg-[#008B47]/15 text-[#007038] border border-[#008B47]/20 px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider animate-pulse">PWA</span>
                  </h4>
                  <p className="text-[11px] text-zinc-600 mt-0.5 leading-tight font-medium">Install CME on your Android or iOS home screen in seconds</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#008B47]">
                    Ready
                  </span>
                  <ChevronRight size={16} className="text-[#008B47] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            </div>
          </div>
        )}

      {/* Subpage: Personal details */}
      {activeSubPage === 'personal' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button 
              id="personal-back-btn"
              onClick={() => { setActiveSubPage('menu'); setMessage(null); }}
              className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-colors cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="text-left">
              <h2 className="text-xl font-bold tracking-tight text-zinc-800">Personal Details</h2>
              <p className="text-xs text-zinc-500">View and edit display configuration</p>
            </div>
          </div>



          {/* Profile Form */}
          <form onSubmit={handleSave} className="space-y-5">
            
            {/* Read-Only Account Details */}
            <div className="bg-white border border-zinc-200 shadow-sm rounded-xl p-4 space-y-2.5 text-left">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Account Email</span>
                <span className="font-mono text-zinc-600 font-medium">{user.email}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-zinc-100 pt-2.5">
                <span className="text-zinc-500">Registered Phone</span>
                <span className="font-mono text-amber-600 font-bold">{phone || 'Not provided'}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-zinc-100 pt-2.5">
                <span className="text-zinc-500">Unique CODE</span>
                <span className="font-mono text-amber-600 font-bold select-all tracking-wider text-sm">{(profile as any)?.uniqueCode || '-----'}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-zinc-100 pt-2.5">
                <span className="text-zinc-500">Country</span>
                <span className="font-bold text-zinc-700">{profile?.country || 'Kenya'}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-zinc-100 pt-2.5">
                <span className="text-zinc-500">Wallet Status</span>
                <span className="font-semibold flex items-center gap-1 text-emerald-600">
                  <Shield size={12} />
                  {profile?.withdrawalEnabled ? 'Active / Approved' : 'Suspended'}
                </span>
              </div>
            </div>

            {/* Display Name Input */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-zinc-650 flex items-center gap-1.5">
                <User size={14} className="text-amber-500" />
                Display Name
              </label>
              <input
                id="profile-display-name"
                type="text"
                required
                placeholder="Enter display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 placeholder-zinc-400 text-zinc-800"
              />
            </div>

            {/* Phone Number Input */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-zinc-650 flex items-center gap-1.5">
                <Smartphone size={14} className="text-amber-500" />
                Phone Number
              </label>
              <input
                id="profile-phone-number"
                type="tel"
                placeholder="e.g. +254 700 000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 placeholder-zinc-400 text-zinc-800 font-mono"
              />
              <p className="text-[10px] text-zinc-500">Update your phone number for transaction verification and contact.</p>
            </div>

            {/* Submit Button */}
            <button
              id="profile-save-btn"
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 disabled:bg-zinc-100 disabled:text-zinc-400 rounded-xl text-sm font-bold transition-all shadow-md shadow-amber-500/10 mt-6 cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving changes...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Update Security Profile</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Subpage: Referral Program */}
      {activeSubPage === 'referral' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button 
              id="referral-back-btn"
              onClick={() => { setActiveSubPage('menu'); }}
              className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-colors cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="text-left">
              <h2 className="text-xl font-bold tracking-tight text-zinc-800">Referral Program</h2>
              <p className="text-xs text-zinc-500">Invite friends and track achievements</p>
            </div>
          </div>

          <div id="referral-program-section" className="space-y-4 text-left">
            {/* 1. FIRST DEPOSIT CASH COMMISSION BADGE (MOVED TO TOP) */}
            {(() => {
              const activeTiers = (refConfig?.tiers && refConfig.tiers.length > 0) ? refConfig.tiers : [
                { id: 'tier-1', minAmount: 10, maxAmount: 99.99, referrerPercent: 5, refereePercent: 10 },
                { id: 'tier-2', minAmount: 100, maxAmount: 499.99, referrerPercent: 7, refereePercent: 12 },
                { id: 'tier-3', minAmount: 500, maxAmount: 10000, referrerPercent: 10, refereePercent: 15 },
              ];
              const isEnabled = refConfig ? refConfig.enabled : true;
              if (!isEnabled) return null;

              const gridColsClass = activeTiers.length === 1 ? 'grid-cols-1' : activeTiers.length === 2 ? 'grid-cols-2' : activeTiers.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3';

              return (
                <div id="referee-first-deposit-commission-badge" className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950 border border-amber-500/40 text-white shadow-sm relative overflow-hidden space-y-3 text-left">
                  <div className="absolute -right-4 -bottom-4 opacity-15 pointer-events-none">
                    <Sparkles size={110} className="text-amber-400" />
                  </div>
                  <div className="relative z-10 space-y-2.5">
                    <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border border-amber-500/30 w-fit">
                        <Sparkles size={11} className="animate-pulse" /> First Deposit Cash Commission
                      </div>
                      <span className="text-[10px] sm:text-xs text-amber-200/80 font-medium">Instant Credit</span>
                    </div>
                    
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-amber-300">Earn Cash On Your Referees' First Deposit!</h3>
                      <p className="text-[10px] sm:text-[11px] text-zinc-300 leading-relaxed mt-0.5">
                        When your invited friends make their first deposit, you automatically receive a direct percentage cash bonus added to your wallet:
                      </p>
                    </div>

                    {/* Dynamic Tier Cards from Backend Config */}
                    <div className={`grid ${gridColsClass} gap-1.5 sm:gap-2 pt-1`}>
                      {activeTiers.map((tier, idx) => (
                        <div key={tier.id || idx} className="bg-zinc-950/80 border border-amber-500/30 rounded-xl p-2 sm:p-2.5 text-center">
                          <span className="block text-[8px] sm:text-[9px] text-zinc-400 font-bold uppercase tracking-wider truncate">
                            ${tier.minAmount} – {tier.maxAmount >= 9999 ? 'Above' : `$${tier.maxAmount}`}
                          </span>
                          <span className="block text-xs sm:text-sm font-black text-amber-400 font-mono mt-0.5">
                            +{tier.referrerPercent}% Cash
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Extra Signal 24-Hour Pass Reward Card */}
            {(() => {
              const passUntil = profile?.extraSignalPassUntil?.toDate ? profile.extraSignalPassUntil.toDate() : (profile?.extraSignalPassUntil ? new Date(profile.extraSignalPassUntil) : null);
              const isPassActive = passUntil && passUntil > new Date();
              const remainingHours = isPassActive ? Math.ceil((passUntil.getTime() - Date.now()) / (1000 * 60 * 60)) : 0;

              return (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950 border border-amber-500/40 text-white shadow-sm relative overflow-hidden space-y-2.5 text-left">
                  <div className="absolute -right-4 -bottom-4 opacity-15 pointer-events-none">
                    <Zap size={110} className="text-amber-400" />
                  </div>
                  <div className="relative z-10 space-y-2">
                    <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border border-amber-500/30 w-fit">
                        <Zap size={11} className="text-amber-400 fill-amber-400" />
                        <span>24h Extra Signal Bonus</span>
                      </div>
                      {isPassActive ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-fit">
                          <Sparkles size={11} className="animate-pulse text-amber-400" />
                          <span>Pass Active ({remainingHours}h left)</span>
                        </span>
                      ) : (
                        <span className="text-[10px] sm:text-xs text-amber-200/80 font-medium">
                          Per First Deposit
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-amber-300">
                        Unlock 24 Hours of Extra Trading Signals
                      </h3>
                      <p className="text-[10px] sm:text-[11px] text-zinc-300 leading-relaxed mt-0.5">
                        Whenever a friend you refer completes their first deposit, you automatically unlock <strong className="text-amber-200">24 hours of Copy Trading Extra Signals</strong> to execute standalone bonus trades on your active contract principal!
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 2. REFERRAL EARNINGS & STATS CARD */}
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
                    className="bg-white border border-zinc-200 shadow-xs rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-300 relative select-none cursor-pointer hover:border-amber-400 hover:shadow-sm"
                    onClick={() => setShowEarningsBreakdown(!showEarningsBreakdown)}
                  >
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] sm:text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">Total Earned</span>
                        <div className="text-amber-500">
                          {showEarningsBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl sm:text-2xl font-black text-amber-500 font-mono">
                          {grandTotal.toFixed(2)}
                        </span>
                        <span className="text-[10px] sm:text-xs text-zinc-400 font-bold uppercase font-mono">USDT</span>
                      </div>
                    </div>

                    {!showEarningsBreakdown && (
                      <p className="text-[8.5px] sm:text-[9.5px] text-zinc-400 font-semibold mt-2 flex items-center gap-0.5">
                        <span>Tap for breakdown</span>
                      </p>
                    )}

                    {showEarningsBreakdown && (
                      <div className="mt-2.5 pt-2.5 border-t border-zinc-100 space-y-1.5 text-left text-[9px] sm:text-[10px] text-zinc-600 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1 font-medium">
                            <span className="text-amber-500">👥</span> Sign-ups:
                          </span>
                          <span className="font-bold font-mono text-zinc-800">${milestoneEarnings.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1 font-medium">
                            <span className="text-amber-500">💳</span> Deposits:
                          </span>
                          <span className="font-bold font-mono text-zinc-800">${depositCommissionEarnings.toFixed(2)}</span>
                        </div>

                        {firstDepositCommissions.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-zinc-100 max-h-24 overflow-y-auto pr-1 space-y-1 text-[8px] sm:text-[9px]">
                            <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Commission Logs</div>
                            {firstDepositCommissions.map((tx) => (
                              <div key={tx.id} className="flex justify-between items-center bg-zinc-50 px-2 py-1 rounded-lg border border-zinc-100 text-zinc-700">
                                <span className="truncate max-w-[95px] sm:max-w-[120px]" title={tx.paymentMessage}>
                                  {tx.paymentMessage?.replace("Referral First Deposit Bonus", "Bonus") || "Deposit Bonus"}
                                </span>
                                <span className="font-bold font-mono text-emerald-600 shrink-0">+${tx.amount?.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-zinc-200 shadow-xs rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between min-h-[92px]">
                    <div>
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">Successful Invites</span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl sm:text-2xl font-black text-zinc-900 font-mono">{referredUsers.length}</span>
                        <span className="text-[10px] sm:text-xs text-zinc-400 font-bold ml-1">friends</span>
                      </div>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-zinc-400 mt-2 font-medium">Keep growing your network!</p>
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
                <div className="bg-white border border-zinc-200 shadow-xs rounded-2xl p-4 sm:p-5 space-y-4 text-left">
                  {/* Top Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">Your Referral Tier</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-full ${
                          count >= 40 ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                          count >= 20 ? 'bg-zinc-100 text-zinc-700 border border-zinc-200' :
                          count >= 7 ? 'bg-orange-500/10 text-orange-600 border border-orange-500/20' :
                          'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        }`}>
                          {count >= 40 ? 'Gold Tier' : count >= 20 ? 'Silver Tier' : count >= 7 ? 'Bronze Tier' : 'Starter Tier'}
                        </span>
                        <span className="text-[11px] sm:text-xs text-zinc-500 font-medium">
                          {count >= 40 ? 'Max Tier reached!' : 
                           count >= 20 ? `${40 - count} more for Gold` : 
                           count >= 7 ? `${20 - count} more for Silver` : 
                           `${7 - count} more for Bronze`}
                        </span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">Current Commission</span>
                      <span className="text-xs sm:text-sm font-black text-emerald-600 font-mono">
                        {count >= 40 ? '0.40 USDT' : count >= 20 ? '0.30 USDT' : count >= 7 ? '0.20 USDT' : '0.10 USDT'} / ref
                      </span>
                    </div>
                  </div>

                  {/* Progress Track Section */}
                  <div className="pt-2 pb-1 px-1">
                    <div className="relative">
                      {/* Background Connecting Line */}
                      <div className="absolute top-2.5 left-[12.5%] right-[12.5%] h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
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
                                ? 'border-amber-500 bg-amber-500 text-white' 
                                : 'border-zinc-200 bg-white text-zinc-400'
                            }`}>
                              {m.badge}
                            </div>
                            
                            {/* Labels */}
                            <span className={`text-[9px] sm:text-[10px] font-extrabold mt-1.5 whitespace-nowrap ${
                              m.achieved ? 'text-zinc-800' : 'text-zinc-400'
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
            <div className="bg-white border border-zinc-200 shadow-xs rounded-2xl p-3.5 sm:p-4 space-y-4">
              {/* Referral Link Box with Prominent Copy Button */}
              <div className="space-y-1.5">
                <label className="text-[9px] sm:text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">
                  Your Shareable Referral Link
                </label>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-zinc-50 border border-zinc-200 p-2 sm:p-2.5 rounded-xl font-mono text-xs">
                  <span className="text-zinc-700 font-medium select-all truncate flex-1 px-1 py-1 sm:py-0 text-[11px] sm:text-xs">
                    {window.location.origin}/#/signup?ref={(profile as any)?.uniqueCode || ''}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer shrink-0 uppercase tracking-wider ${
                      copiedReferral 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
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
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1.5 mt-1 font-bold">
                    <Check size={10} /> Copied to clipboard! Share it with your friends.
                  </span>
                )}
              </div>

              {/* Referred Users List */}
              <div className="space-y-2 border-t border-zinc-100 pt-3">
                <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
                  <span>Your Referred Friends ({referredUsers.length})</span>
                  {loadingReferred && <span className="text-zinc-400 animate-pulse font-normal lowercase">fetching...</span>}
                </div>

                {loadingReferred ? (
                  <div className="text-center py-4 text-xs text-zinc-500">
                    Loading referred users...
                  </div>
                ) : referredUsers.length === 0 ? (
                  <div className="text-center py-6 bg-zinc-50/70 border border-dashed border-zinc-200 rounded-xl text-xs text-zinc-400">
                    No friends have joined using your code yet.
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
                            <p className="font-extrabold text-zinc-800 truncate max-w-[180px]">
                              {refUser.displayName}
                            </p>
                            <p className="text-[11px] text-zinc-600 font-mono font-medium">
                              {refUser.phone ? refUser.phone : 'No phone provided'}
                            </p>
                          </div>
                          <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1">
                            <p className="text-[10px] text-zinc-400 font-mono">
                              Joined {refUser.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            {refUser.hasMadeFirstDeposit ? (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                                ✓ First Deposit Done
                              </span>
                            ) : (
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                                Pending 1st Deposit
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
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button 
              id="pin-back-btn"
              onClick={() => { setActiveSubPage('menu'); setPinMessage(null); }}
              className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-colors cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="text-left">
              <h2 className="text-xl font-bold tracking-tight text-zinc-800">Security PIN</h2>
              <p className="text-xs text-zinc-500">Protect your wallet transactions</p>
            </div>
          </div>

          <div id="wallet-pin-security-card" className="space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="text-amber-500" size={18} />
                <h3 className="text-sm font-bold text-zinc-800 font-sans">Wallet Security PIN</h3>
              </div>
              {profile?.walletPassword ? (
                <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 uppercase tracking-wider">
                  <CheckCircle2 size={10} /> Configured
                </span>
              ) : (
                <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
                  Not Set
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-550 leading-relaxed">
              The 4-digit security PIN is required to authorize all crypto withdrawals, token transfers, and secure cashouts.
            </p>



            {profile?.walletPassword && !isChangingPin ? (
              <div className="bg-white border border-zinc-200 shadow-sm rounded-2xl p-4 flex flex-col gap-4 text-left">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-[#008B47]">
                    <Lock size={14} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-zinc-800">Security PIN Active</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Your transaction PIN is enabled and protecting your wallet.</p>
                  </div>
                </div>
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
                  className="w-full py-2.5 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 rounded-xl text-xs font-bold transition-all cursor-pointer text-center active:scale-[0.99]"
                >
                  Change Security PIN
                </button>
              </div>
            ) : (
              <form onSubmit={handleSavePin} className="bg-white border border-zinc-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-4 text-left">
                <h4 className="text-xs font-bold text-zinc-700">
                  {profile?.walletPassword ? 'Change Security PIN' : 'Configure New Wallet PIN'}
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider block">New 4-Digit PIN</label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="••••"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-sm tracking-widest text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider block">Confirm PIN</label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="••••"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-sm tracking-widest text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Google Authenticator Input: Required if they are changing an existing PIN and have 2FA active */}
                {profile?.walletPassword && profile?.twoFactorEnabled && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                    <label className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5">
                      <Smartphone size={13} className="text-amber-500" />
                      <span>Google Authenticator (2FA) Code</span>
                      <span className="text-[9px] text-amber-600 font-mono bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Required</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="000000"
                      value={pin2faCode}
                      onChange={(e) => setPin2faCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-sm tracking-widest text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <p className="text-[10px] text-zinc-500 leading-tight">Enter the 6-digit verification code from your Google Authenticator app to authorize updating your PIN.</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    id="submit-pin-btn"
                    type="submit"
                    disabled={pinSaving}
                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:bg-zinc-100 disabled:text-zinc-400 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 active:scale-95"
                  >
                    {pinSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Saving PIN...</span>
                      </>
                    ) : (
                      <span>Save PIN Code</span>
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
                      className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
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
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button 
              id="withdrawal-address-back-btn"
              onClick={() => { setActiveSubPage('menu'); setAddressMessage(null); }}
              className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-colors cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="text-left">
              <h2 className="text-xl font-bold tracking-tight text-zinc-800">Bound USDT Withdrawal Address</h2>
              <p className="text-xs text-zinc-500">USDT BEP20 (BNB Smart Chain) destination wallet</p>
            </div>
          </div>

          <div id="bep20-address-security-card" className="space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="text-amber-500" size={18} />
                <h3 className="text-sm font-bold text-zinc-800 font-sans">USDT (BEP20) Payout Address</h3>
              </div>
              {profile?.bep20WithdrawalAddress ? (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 uppercase tracking-wider">
                  <CheckCircle2 size={10} /> Verified & Bound
                </span>
              ) : (
                <span className="text-[10px] bg-rose-50 text-rose-600 border border-rose-200 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
                  Unbound
                </span>
              )}
            </div>

            {/* Explanation / Security Banner */}
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
              <ShieldCheck size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-[11px] text-amber-950 uppercase tracking-wide">
                  USDT Zero Network Mismatch Protection
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  USDT withdrawals are securely processed via the fast, low-fee BEP20 (BNB Smart Chain) network and route automatically to your verified bound address. This prevents network mismatches or loss of funds.
                </p>
              </div>
            </div>

            {profile?.bep20WithdrawalAddress && !isChangingAddress ? (
              <div className="bg-white border border-zinc-200 shadow-sm rounded-2xl p-4 sm:p-5 flex flex-col gap-4 text-left">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Current Bound Address</span>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-md">
                      USDT BEP20 (BSC)
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-zinc-200/80 rounded-xl flex items-center justify-between gap-3">
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
                      className="p-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-600 transition-colors shrink-0 cursor-pointer"
                      title="Copy Address"
                    >
                      {addressCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>

                  <p className="text-[10px] text-zinc-500">
                    Bound status: <strong className="text-emerald-700 font-semibold">Active & Locked</strong>. USDT withdrawals will be routed to this wallet.
                  </p>
                </div>

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
                  className="w-full py-2.5 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 rounded-xl text-xs font-bold transition-all cursor-pointer text-center active:scale-[0.99]"
                >
                  Update Bound USDT BEP20 Address
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveBep20Address} className="bg-white border border-zinc-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-4 text-left">
                <h4 className="text-xs font-bold text-zinc-800 flex items-center justify-between">
                  <span>{profile?.bep20WithdrawalAddress ? 'Update Bound USDT BEP20 Address' : 'Bind New USDT BEP20 Address'}</span>
                  <span className="text-[10px] text-amber-700 font-mono bg-amber-100/70 px-2 py-0.5 rounded border border-amber-300/60">USDT BEP20 Only</span>
                </h4>

                {/* BEP20 Address Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    BNB Smart Chain (BEP20) Address *
                  </label>
                  <div className="relative">
                    <input
                      id="bep20-address-input"
                      type="text"
                      required
                      placeholder="0x..."
                      value={bep20AddressInput}
                      onChange={(e) => setBep20AddressInput(e.target.value.trim())}
                      className="w-full px-3.5 py-2.5 pr-8 bg-zinc-50 border border-zinc-200 rounded-xl font-mono text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    />
                    {bep20AddressInput && (
                      <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                        {/^0x[a-fA-F0-9]{40}$/.test(bep20AddressInput.trim()) ? (
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        ) : (
                          <AlertCircle size={16} className="text-rose-500" />
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    Must start with <strong className="font-mono text-zinc-700">0x</strong> and be 42 characters long.
                  </p>
                </div>

                {/* Security PIN Authorization */}
                <div className="space-y-1.5 pt-1 border-t border-zinc-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      <Lock size={11} className="text-amber-500" />
                      <span>Wallet Security PIN (4 Digits) *</span>
                    </label>
                    {!profile?.walletPassword && (
                      <button
                        type="button"
                        onClick={() => { setActiveSubPage('pin'); }}
                        className="text-[10px] text-amber-600 font-bold hover:underline cursor-pointer"
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
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-sm tracking-widest text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                {/* Google Authenticator if enabled */}
                {profile?.twoFactorEnabled && (
                  <div className="space-y-1.5 pt-1 border-t border-zinc-100">
                    <label className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5">
                      <Smartphone size={13} className="text-amber-500" />
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
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-sm tracking-widest text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    id="submit-bep20-address-btn"
                    type="submit"
                    disabled={addressSaving || !bep20AddressInput || !/^0x[a-fA-F0-9]{40}$/.test(bep20AddressInput.trim()) || (profile?.walletPassword ? bep20PinInput.length !== 4 : false)}
                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 active:scale-95"
                  >
                    {addressSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Saving Address...</span>
                      </>
                    ) : (
                      <span>Lock & Bind BEP20 Address</span>
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
                      className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
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
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button 
              id="2fa-back-btn"
              onClick={() => { setActiveSubPage('menu'); }}
              className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-colors cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="text-left">
              <h2 className="text-xl font-bold tracking-tight text-zinc-800">Authenticator</h2>
              <p className="text-xs text-zinc-500">Configure Two-Factor security</p>
            </div>
          </div>

          <div id="two-factor-auth-card" className="space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="text-amber-500" size={18} />
                <h3 className="text-sm font-bold text-zinc-800 font-sans">Google Authenticator (2FA)</h3>
              </div>
              {profile?.twoFactorEnabled ? (
                <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 uppercase tracking-wider">
                  <CheckCircle2 size={10} /> Active
                </span>
              ) : (
                <span className="text-[10px] bg-zinc-100 text-zinc-550 border border-zinc-200 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Disabled
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-550 leading-relaxed">
              Google Authenticator secures your funds by requiring a 6-digit dynamic passcode when making withdrawals or signing in to your wallet.
            </p>

            {profile?.twoFactorEnabled ? (
              <div className="bg-white border border-zinc-200 shadow-sm rounded-2xl p-4 space-y-4">
                <div className="flex items-start gap-3 text-left">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-zinc-800">Your wallet is secured with Two-Factor Authentication.</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Any future withdrawals or sign-in requests will verify your temporary 6-digit passcode.</p>
                  </div>
                </div>

                {showDeactivateInput ? (
                  <div className="space-y-3 pt-2 border-t border-zinc-100">
                    {deactivateError && (
                      <div className="p-2 bg-red-50 border border-red-100 text-red-600 rounded-lg text-[11px] flex items-start gap-2">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span>{deactivateError}</span>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider block">Enter 6-digit Authenticator Code</label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="000000"
                        value={deactivateCode}
                        onChange={(e) => setDeactivateCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-sm tracking-widest text-zinc-800 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDisable2fa}
                        disabled={deactivating}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-zinc-100 disabled:text-zinc-400 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer active:scale-95"
                      >
                        {deactivating ? 'Deactivating...' : 'Confirm Deactivate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowDeactivateInput(false); setDeactivateError(null); }}
                        className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeactivateInput(true)}
                    className="w-full py-2.5 bg-zinc-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-zinc-650 border border-zinc-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Power size={13} />
                    Disable Google Authenticator (2FA)
                  </button>
                )}
              </div>
            ) : !is2faSetupOpen ? (
              <button
                type="button"
                onClick={generate2faSecret}
                className="w-full py-3 bg-zinc-100 border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-150/80 text-zinc-750 hover:text-zinc-900 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
              >
                <QrCode size={15} className="text-amber-500" />
                <span>Enable Google Authenticator (2FA)</span>
              </button>
            ) : (
              <div className="bg-white border border-zinc-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                    <QrCode size={14} className="text-[#008B47]" />
                    Setup Two-Factor Security
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
                  <div className="p-2.5 bg-red-50 border border-red-100 text-red-600 rounded-lg text-[11px] flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>{verificationError}</span>
                  </div>
                )}

                {/* Step 1: Scan QR */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">1. Scan Google Authenticator QR Code</span>
                  <div className="flex justify-center p-3 bg-white border border-zinc-150 rounded-xl max-w-[170px] mx-auto shadow-inner">
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
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">2. Or copy the 16-character Secret Key</span>
                  <div className="flex gap-1.5 items-center bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl font-mono text-[11px]">
                    <span className="text-amber-600 font-bold tracking-wider select-all truncate flex-1">{temp2faSecret}</span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
                      title="Copy Key"
                    >
                      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                {/* Step 3: Enter Verification Code */}
                <div className="space-y-2 pt-2 border-t border-zinc-100">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">3. Enter verification code to enable</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-sm tracking-widest text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyAndEnable2fa}
                      className="px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer active:scale-95"
                    >
                      Verify & Activate
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
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button 
              id="support-back-btn"
              onClick={() => { setActiveSubPage('menu'); }}
              className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-colors cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="text-left">
              <h2 className="text-xl font-bold tracking-tight text-zinc-800">Customer Support</h2>
              <p className="text-xs text-zinc-500">Connect with our support team 24/7</p>
            </div>
          </div>

          <div className="space-y-4 text-left">
            {/* Promo / Intro Banner */}
            <div className="bg-gradient-to-br from-[#008B47]/10 via-white to-white border border-emerald-200/85 rounded-2xl p-4 space-y-2 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-550"></span>
                </span>
                We are online to help
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                If you have questions regarding deposits, withdrawals, referrals, or trade executions, please reach out to our team. Our typical response time is less than 5 minutes.
              </p>
            </div>

            {/* Support Channels */}
            <div className="space-y-3">
              {/* Telegram Official Support Option */}
              <a
                id="telegram-official-support-link"
                href="https://t.me/Morexsuppor"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 bg-white hover:bg-zinc-50 border-2 border-emerald-300/80 hover:border-emerald-400 p-4 sm:p-5 rounded-2xl transition-all group cursor-pointer no-underline block shadow-sm"
              >
                <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shrink-0 group-hover:scale-105 shadow-xs transition-all">
                  <Send size={22} className="translate-x-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-black text-zinc-900 group-hover:text-zinc-950 transition-colors">Telegram Support</h4>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                      @Morexsuppor
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">Direct 24/7 live assistance, transfer guides, and rapid answers</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#007038]">
                    Online
                  </span>
                  <ChevronRight size={18} className="text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                </div>
              </a>
            </div>

            {/* Quick Note Card */}
            <div className="bg-white border border-zinc-200 shadow-sm rounded-2xl p-4 flex gap-3 text-xs text-zinc-500 leading-relaxed">
              <ShieldAlert size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-700 block mb-1">Official Protection Notice</strong>
                CME Support agents will never ask for your Google Authenticator 2FA secret, account passwords, or secure wallet PINs. Never share these credentials with anyone.
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

              {/* Play Store Auxiliary Actions */}
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

              {/* 5. Screenshots Gallery (Horizontal Scroll, High Fidelity Mockups) */}
              <div className="space-y-1.5 pt-1.5 border-t border-zinc-100">
                <h3 className="text-xs font-bold text-zinc-900 tracking-tight">Screenshots</h3>
                <div className="flex overflow-x-auto gap-3.5 pb-4 pt-1 px-1 scrollbar-thin scrollbar-thumb-zinc-200 select-none">
                  
                  {/* Screenshot 1: High Yield Dashboard */}
                  <div className="w-[180px] h-[320px] shrink-0 border-[3px] border-zinc-800 rounded-[1.8rem] bg-slate-900 flex flex-col overflow-hidden relative shadow-md text-left font-sans text-zinc-300">
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-zinc-950 pointer-events-none"></div>
                    {/* Mock phone status bar */}
                    <div className="h-4 px-3 bg-slate-950 text-zinc-500 text-[7px] flex justify-between items-center select-none font-mono">
                      <span>12:45</span>
                      <div className="flex items-center gap-1">
                        <span>📶</span>
                        <span>🔋</span>
                      </div>
                    </div>
                    {/* Mock App Content */}
                    <div className="p-2.5 space-y-2.5 relative z-10 flex-1 flex flex-col">
                      <div className="flex justify-between items-center border-b border-slate-800/80 pb-1.5">
                        <span className="text-[9px] font-black tracking-wider bg-gradient-to-r from-[#80D824] to-[#F4E100] bg-clip-text text-transparent">CME</span>
                        <span className="text-[7px] text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded-full border border-emerald-500/20">LIVE</span>
                      </div>
                      
                      {/* Balance Card */}
                      <div className="bg-slate-950/80 border border-slate-800 p-2 rounded-xl space-y-1">
                        <span className="text-[7px] text-zinc-500 font-bold uppercase tracking-wider">Total Active Balance</span>
                        <div className="text-xs font-black text-white">$24,815.59</div>
                        <div className="flex items-center gap-1">
                          <span className="text-[6px] text-emerald-400 font-bold">▲ +24.8% profit</span>
                          <span className="text-[5px] text-zinc-600 font-mono">this cycle</span>
                        </div>
                      </div>

                      {/* Rates block */}
                      <div className="space-y-1">
                        <span className="text-[7px] text-zinc-500 font-bold uppercase tracking-wider block">Live Arbitrage Nodes</span>
                        <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/50 space-y-1 text-[7px]">
                          <div className="flex justify-between text-zinc-400">
                            <span>USDT/KES Spread</span>
                            <span className="text-emerald-400 font-bold">+8.4%</span>
                          </div>
                          <div className="flex justify-between text-zinc-400">
                            <span>BTC Pool Liquidity</span>
                            <span className="text-amber-400 font-bold">+5.2%</span>
                          </div>
                        </div>
                      </div>

                      {/* Quick notice */}
                      <div className="mt-auto bg-emerald-500/5 border border-emerald-500/10 p-1.5 rounded-lg text-[6px] text-emerald-300 leading-tight">
                        🔒 Safe Escrow Protection completes transaction swaps inside 2 minutes.
                      </div>
                    </div>
                  </div>

                  {/* Screenshot 2: MMF Capital Portfolios */}
                  <div className="w-[180px] h-[320px] shrink-0 border-[3px] border-zinc-800 rounded-[1.8rem] bg-slate-900 flex flex-col overflow-hidden relative shadow-md text-left font-sans text-zinc-300">
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-zinc-950 pointer-events-none"></div>
                    {/* Mock phone status bar */}
                    <div className="h-4 px-3 bg-slate-950 text-zinc-500 text-[7px] flex justify-between items-center select-none font-mono">
                      <span>12:45</span>
                      <div className="flex items-center gap-1">
                        <span>📶</span>
                        <span>🔋</span>
                      </div>
                    </div>
                    {/* Mock App Content */}
                    <div className="p-2.5 space-y-2.5 relative z-10 flex-1 flex flex-col">
                      <div className="border-b border-slate-800/80 pb-1.5">
                        <span className="text-[8px] font-black text-zinc-200 uppercase tracking-wider">MMF Portfolios</span>
                      </div>

                      <div className="space-y-1.5 flex-1">
                        <div className="bg-slate-950/80 border border-slate-800 p-2 rounded-xl text-left space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-bold text-white">USDT Alpha Fund</span>
                            <span className="text-[6px] text-emerald-400 font-black">7.5% Daily</span>
                          </div>
                          <p className="text-[6px] text-zinc-500 leading-tight">5-Day Capital Lock, compounding payouts dynamically.</p>
                        </div>

                        <div className="bg-slate-950/80 border border-slate-800 p-2 rounded-xl text-left space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-bold text-white">BTC Premium Fund</span>
                            <span className="text-[6px] text-amber-400 font-black">5.0% Daily</span>
                          </div>
                          <p className="text-[6px] text-zinc-500 leading-tight">3-Day Capital Lock, automated settlement rollover.</p>
                        </div>

                        <div className="bg-slate-950/80 border border-slate-800 p-2 rounded-xl text-left space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-bold text-white">ETH Capital Reserve</span>
                            <span className="text-[6px] text-sky-400 font-black">6.0% Daily</span>
                          </div>
                          <p className="text-[6px] text-zinc-500 leading-tight">7-Day lock-in, multi-pool hedge arbitrage spreads.</p>
                        </div>
                      </div>

                      <div className="mt-auto bg-amber-500/5 border border-amber-500/10 p-1.5 rounded-lg text-[6px] text-amber-300 leading-tight">
                        📈 Compounded automatically. Multi-node trading delivers seamless execution.
                      </div>
                    </div>
                  </div>

                  {/* Screenshot 3: P2P Secure Swaps */}
                  <div className="w-[180px] h-[320px] shrink-0 border-[3px] border-zinc-800 rounded-[1.8rem] bg-slate-900 flex flex-col overflow-hidden relative shadow-md text-left font-sans text-zinc-300">
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-zinc-950 pointer-events-none"></div>
                    {/* Mock phone status bar */}
                    <div className="h-4 px-3 bg-slate-950 text-zinc-500 text-[7px] flex justify-between items-center select-none font-mono">
                      <span>12:45</span>
                      <div className="flex items-center gap-1">
                        <span>📶</span>
                        <span>🔋</span>
                      </div>
                    </div>
                    {/* Mock App Content */}
                    <div className="p-2.5 space-y-2.5 relative z-10 flex-1 flex flex-col">
                      <div className="border-b border-slate-800/80 pb-1.5 flex justify-between items-center">
                        <span className="text-[8px] font-black text-zinc-200 uppercase tracking-wider">P2P Escrow Terminal</span>
                        <span className="text-[6px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-1 rounded font-bold uppercase">Escrow</span>
                      </div>

                      <div className="space-y-2">
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-850 space-y-1 text-left">
                          <span className="text-[8px] font-black text-white block">M-Pesa, MTN Mobile money</span>
                          <p className="text-[6px] text-zinc-400 leading-normal">
                            Direct, safe local currency deposits & withdrawals managed under automated smart escrow.
                          </p>
                        </div>

                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-2 rounded-xl space-y-1.5">
                          <span className="text-[7px] font-black text-emerald-400 uppercase tracking-wider block">Escrow Protected Node</span>
                          <p className="text-[6px] text-zinc-300 leading-normal">
                            Merchants lock equal security collateral before accepting swaps, preventing slippage or defaults.
                          </p>
                        </div>
                      </div>

                      <div className="mt-auto flex justify-around items-center bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-[8px] font-bold">
                        <span className="text-zinc-500 text-[6px]">M-Pesa ✔</span>
                        <span className="text-zinc-500 text-[6px]">MTN ✔</span>
                        <span className="text-zinc-500 text-[6px]">Airtel ✔</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* 6. About This App Section */}
              <div className="space-y-1.5 pt-3 border-t border-zinc-100 text-left select-none text-zinc-600">
                <div className="flex justify-between items-center text-xs font-bold text-zinc-900">
                  <span>About this app</span>
                  <ChevronRight size={16} className="text-zinc-400" />
                </div>
                <p className="text-[10px] text-zinc-500 leading-relaxed font-sans">
                  Welcome to CME, the institutional crypto trading and algorithmic arbitrage platform. Tap into lightning-fast compounding cycles, safe peer-to-peer (P2P) escrows, and robust portfolio management. Designed as a high-fidelity Progressive Web App (PWA), it operates directly as a standalone app on your home screen with zero storage footprint!
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[8px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-bold">Finance</span>
                  <span className="text-[8px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-bold">Trading & Arbitrage</span>
                  <span className="text-[8px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-bold">P2P Escrow</span>
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
    </div>
  );
}
