import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, runTransaction 
} from 'firebase/firestore';
import { 
  ArrowLeft, Send, AlertCircle, Check, Lock, ShieldAlert, DollarSign, X, Key, Users, ArrowRight, Loader2 
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { UserAccount } from '../types';

interface SendWorkflowProps {
  user: any; // Firebase user or custom user
  onBack: () => void;
  onSuccess: (message: string) => void;
  onGoToProfile?: () => void;
}

export default function SendWorkflow({ user, onBack, onSuccess, onGoToProfile }: SendWorkflowProps) {
  const toast = useToast();
  const [profile, setProfile] = useState<UserAccount | null>(null);
  const [lockedUSDT, setLockedUSDT] = useState<number>(0);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  
  // Form fields
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [sendAmount, setSendAmount] = useState<string>('');
  const [walletPIN, setWalletPIN] = useState<string>('');

  // UI state
  const [step, setStep] = useState<'form' | 'pin_confirm'>('form');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [foundRecipientName, setFoundRecipientName] = useState<string | null>(null);
  const [verifyingRecipient, setVerifyingRecipient] = useState<boolean>(false);

  // Auto-clear error when user modifies inputs
  useEffect(() => {
    setErrorState(null);
  }, [recipientEmail, sendAmount, walletPIN, step]);

  // Helper to open profile directly to the PIN setting subpage
  const handleGoToPinSettings = () => {
    localStorage.setItem('profile_subpage', 'pin');
    if (onGoToProfile) {
      onGoToProfile();
    } else {
      onBack();
    }
  };

  // Fetch current user profile & locked investments
  useEffect(() => {
    async function fetchUserData() {
      if (!user?.uid) {
        setIsLoadingProfile(false);
        return;
      }
      setIsLoadingProfile(true);
      try {
        const uRef = doc(db, 'users', user.uid);
        const qSnap = await getDocs(query(collection(db, 'investments'), where('userId', '==', user.uid)));
        
        let sumLocked = 0;
        qSnap.forEach(docSnap => {
          const data = docSnap.data();
          if (data.coinSymbol === 'USDT' && data.status === 'active') {
            sumLocked += data.amount || 0;
          }
        });
        setLockedUSDT(sumLocked);

        const profileSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
        if (!profileSnap.empty) {
          setProfile(profileSnap.docs[0].data() as UserAccount);
        } else {
          // fallback query by email
          const emailSnap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
          if (!emailSnap.empty) {
            setProfile(emailSnap.docs[0].data() as UserAccount);
          }
        }
      } catch (err) {
        console.error('Error fetching user profile for send:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    }
    fetchUserData();
  }, [user]);

  const availableBalance = Math.max(0, (profile?.balance || 0) - lockedUSDT);

  // Validate recipient and amount before moving to PIN screen
  const handleProceedToPin = async () => {
    setErrorState(null);
    const cleanEmail = recipientEmail.trim().toLowerCase();
    const amountVal = parseFloat(sendAmount);

    if (!cleanEmail) {
      setErrorState('Please enter recipient email address.');
      return;
    }

    if (user?.email && cleanEmail === user.email.toLowerCase()) {
      setErrorState('You cannot send USDT to your own account.');
      return;
    }

    if (isNaN(amountVal) || amountVal <= 0) {
      setErrorState('Please enter a valid USDT amount to send.');
      return;
    }

    if (amountVal < 19) {
      setErrorState('Minimum transfer amount is 19 USDT.');
      return;
    }

    if (amountVal > availableBalance) {
      setErrorState('Insufficient funds');
      return;
    }

    // Verify recipient email exists in the database
    setVerifyingRecipient(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const qSnap = await getDocs(q);

      if (qSnap.empty) {
        setErrorState('Recipient account not found. Please verify the email address.');
        setVerifyingRecipient(false);
        return;
      }

      const recData = qSnap.docs[0].data();
      setFoundRecipientName(recData.displayName || cleanEmail.split('@')[0]);
      setVerifyingRecipient(false);

      // Check PIN configuration requirement
      if (!profile?.walletPassword) {
        setErrorState('Please configure a 4-digit Wallet Security PIN in your Profile settings before sending funds.');
        return;
      }

      setStep('pin_confirm');
    } catch (err: any) {
      console.error('Error searching for recipient:', err);
      setErrorState('Failed to verify recipient account. Please try again.');
      setVerifyingRecipient(false);
    }
  };

  // Perform transfer
  const handleConfirmSend = async () => {
    setErrorState(null);
    if (!profile?.walletPassword) {
      setErrorState('Please configure a 4-digit Wallet Security PIN in your Profile settings before sending.');
      return;
    }

    if (!walletPIN || walletPIN !== profile.walletPassword) {
      setErrorState('Incorrect Wallet Security PIN. Please verify your PIN.');
      return;
    }

    const cleanEmail = recipientEmail.trim().toLowerCase();
    const amountVal = parseFloat(sendAmount);

    if (amountVal < 19) {
      setErrorState('Minimum transfer amount is 19 USDT.');
      return;
    }

    if (amountVal > availableBalance) {
      setErrorState('Insufficient funds');
      return;
    }

    setSubmitting(true);

    try {
      // Find recipient user document
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const recipientSnap = await getDocs(q);

      if (recipientSnap.empty) {
        setErrorState('Recipient account not found. Please verify the email address.');
        setSubmitting(false);
        return;
      }

      const recipientDoc = recipientSnap.docs[0];
      const recipientData = recipientDoc.data();
      const recipientUid = recipientDoc.id; // or recipientData.uid

      // Find sender user document
      const senderQ = query(usersRef, where('email', '==', user.email));
      const senderSnap = await getDocs(senderQ);
      if (senderSnap.empty) {
        throw new Error('Sender account not found in database.');
      }
      const senderDoc = senderSnap.docs[0];

      // Use Firestore transaction for safe atomic balance update
      await runTransaction(db, async (transaction) => {
        const sDoc = await transaction.get(senderDoc.ref);
        const rDoc = await transaction.get(recipientDoc.ref);

        if (!sDoc.exists()) {
          throw new Error('Sender profile error.');
        }
        if (!rDoc.exists()) {
          throw new Error('Recipient profile error.');
        }

        const currentSenderBal = sDoc.data().balance || 0;
        const currentRecipientBal = rDoc.data().balance || 0;

        if (currentSenderBal < amountVal) {
          throw new Error('Insufficient funds');
        }

        // Deduct from sender, add to recipient
        transaction.update(senderDoc.ref, {
          balance: currentSenderBal - amountVal
        });

        transaction.update(recipientDoc.ref, {
          balance: currentRecipientBal + amountVal
        });
      });

      // Write Sender Transaction Log (type: 'internal_send')
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email,
        type: 'internal_send',
        amount: amountVal,
        status: 'APPROVED',
        createdAt: serverTimestamp(),
        address: cleanEmail,
        paymentMessage: `Sent ${amountVal.toFixed(2)} USDT to ${cleanEmail}`,
        coinSymbol: 'USDT',
        coinAmount: amountVal
      });

      // Write Recipient Transaction Log (type: 'internal_receive')
      await addDoc(collection(db, 'transactions'), {
        userId: recipientData.uid || recipientUid,
        userEmail: cleanEmail,
        type: 'internal_receive',
        amount: amountVal,
        status: 'APPROVED',
        createdAt: serverTimestamp(),
        address: user.email,
        paymentMessage: `Received ${amountVal.toFixed(2)} USDT from ${user.email}`,
        coinSymbol: 'USDT',
        coinAmount: amountVal
      });

      setSubmitting(false);
      onSuccess(`Successfully sent ${amountVal.toFixed(2)} USDT to ${cleanEmail}.`);
    } catch (err: any) {
      console.error('Send USDT Error:', err);
      setErrorState(err.message || 'Failed to complete USDT transfer. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div id="send-workflow-container" className="max-w-md mx-auto p-4 sm:p-5 bg-[#EBF9F0] text-zinc-800 min-h-screen font-sans">
      
      {/* Header matching Deposit/Withdrawal workflows */}
      <div className="flex items-center gap-3 mb-6">
        <button
          id="send-back-btn"
          type="button"
          onClick={() => {
            if (step === 'pin_confirm') {
              setStep('form');
              setWalletPIN('');
            } else {
              onBack();
            }
          }}
          className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm cursor-pointer shrink-0"
          title="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-800">
            {step === 'form' ? 'CME USDT Send' : 'Authenticate Transfer'}
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            {step === 'form' 
              ? 'Send USDT to your friends on CME at zero fees' 
              : `Confirm sending to ${foundRecipientName || recipientEmail}`}
          </p>
        </div>
      </div>

      <div className="w-full bg-white border border-amber-200/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">

        {/* Security PIN Warning if NOT configured */}
        {!isLoadingProfile && profile && !profile.walletPassword && (
          <div id="send-no-pin-banner" className="p-3.5 bg-amber-50 border border-amber-200/90 text-amber-900 rounded-2xl text-xs space-y-2">
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <h4 className="font-extrabold text-xs text-amber-950">Security PIN Required</h4>
                <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
                  You must configure a 4-digit Wallet Security PIN before sending funds.
                </p>
              </div>
            </div>
            {onGoToProfile && (
              <button
                type="button"
                onClick={handleGoToPinSettings}
                className="w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[11px] font-extrabold transition-colors cursor-pointer"
              >
                Set Up Security PIN Now
              </button>
            )}
          </div>
        )}

        {/* Error Banner */}
        {errorState && (
          <div id="send-error-banner" className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs space-y-2 relative shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 pr-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
                <span className="font-semibold text-xs leading-snug">{errorState}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorState(null)}
                className="p-1 hover:bg-red-100 rounded-lg text-red-600 transition-colors cursor-pointer shrink-0"
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>

            {(errorState.toLowerCase().includes('pin') || errorState.toLowerCase().includes('incorrect')) && onGoToProfile && (
              <button
                type="button"
                onClick={handleGoToPinSettings}
                className="w-full mt-1.5 py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-extrabold transition-colors cursor-pointer"
              >
                {!profile?.walletPassword ? 'Set Up Security PIN in Settings' : 'Change or Reset Security PIN'}
              </button>
            )}
          </div>
        )}

        {/* STEP 1: Form (Recipient Email & Amount) */}
        {step === 'form' && (
          <div className="space-y-5">
            {/* Balance Badge */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-orange-500/10 border border-amber-300/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800/70 block">Available Balance</span>
                {isLoadingProfile ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Loader2 size={16} className="animate-spin text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-zinc-500 animate-pulse">Fetching balance...</span>
                  </div>
                ) : (
                  <span className="text-lg font-black font-mono text-zinc-800">$ {availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Instant P2P
                </span>
              </div>
            </div>

            {/* Recipient Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                <Users size={14} className="text-amber-500" />
                <span>Recipient Email Address</span>
              </label>
              <input
                id="send-recipient-email-input"
                type="email"
                placeholder="friend@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 focus:border-amber-500 focus:bg-white text-xs font-semibold text-zinc-800 placeholder:text-zinc-400 outline-none transition-all"
              />
              <p className="text-[10px] text-zinc-500">Enter the exact email registered on this app by your friend.</p>
            </div>

            {/* Amount Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-amber-500" />
                  <span>Send Amount (USDT)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setSendAmount(availableBalance.toString())}
                  className="text-[10px] font-black text-amber-600 hover:text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg cursor-pointer transition-colors"
                >
                  MAX
                </button>
              </div>

              <div className="relative">
                <input
                  id="send-amount-input"
                  type="number"
                  placeholder="0.00"
                  step="any"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 focus:border-amber-500 focus:bg-white text-sm font-bold font-mono text-zinc-800 placeholder:text-zinc-400 outline-none transition-all pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-amber-600">
                  USDT
                </span>
              </div>
              <p className="text-[10px] text-zinc-500">Minimum transfer amount is 19 USDT.</p>
            </div>

            {/* Submit Button */}
            <button
              id="send-proceed-btn"
              type="button"
              disabled={verifyingRecipient || !recipientEmail || !sendAmount}
              onClick={handleProceedToPin}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white rounded-2xl text-xs font-extrabold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 mt-4"
            >
              {verifyingRecipient ? (
                <span>Verifying Account...</span>
              ) : (
                <>
                  <span>Continue to Authenticate</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 2: PIN Confirmation */}
        {step === 'pin_confirm' && (
          <div className="space-y-5 animate-fade-in">
            {/* Transaction Summary Card */}
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-medium">Recipient</span>
                <span className="font-bold text-zinc-800">{foundRecipientName || recipientEmail}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-medium">Recipient Email</span>
                <span className="font-mono font-bold text-zinc-700">{recipientEmail}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-zinc-200/60 pt-2.5">
                <span className="text-zinc-500 font-medium">Transfer Amount</span>
                <span className="font-black font-mono text-amber-600 text-sm">$ {parseFloat(sendAmount).toFixed(2)} USDT</span>
              </div>
            </div>

            {/* PIN Entry */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                <Key size={14} className="text-amber-500" />
                <span>Enter 4-Digit Security PIN</span>
              </label>
              <input
                id="send-wallet-pin-input"
                type="password"
                maxLength={4}
                placeholder="••••"
                value={walletPIN}
                onChange={(e) => setWalletPIN(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 text-center text-xl tracking-[0.5em] font-mono rounded-2xl bg-zinc-50 border border-zinc-200 focus:border-amber-500 focus:bg-white text-zinc-800 outline-none transition-all"
              />
              {onGoToProfile && (
                <button
                  type="button"
                  onClick={handleGoToPinSettings}
                  className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold cursor-pointer mt-1 block"
                >
                  Wrong or forgot PIN? Change PIN in Settings
                </button>
              )}
            </div>

            {/* Execute Send Button */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="w-1/3 py-3 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                id="confirm-send-final-btn"
                type="button"
                disabled={submitting || !walletPIN || walletPIN.length !== 4}
                onClick={handleConfirmSend}
                className="w-2/3 py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white rounded-2xl text-xs font-extrabold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span>Processing Transfer...</span>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Send USDT Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
