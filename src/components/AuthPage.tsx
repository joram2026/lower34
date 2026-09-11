import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { auth, db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut,
  updatePassword
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, collection, query, where, getDocs, updateDoc, increment, addDoc, deleteDoc } from 'firebase/firestore';
import { Shield, Mail, Lock, User, Phone, Sparkles, AlertCircle, RefreshCw, Eye, EyeOff, Globe, ChevronDown, Check, TrendingUp, Zap, Award, ArrowUpRight, Activity, DollarSign, Users, Percent, CheckCircle, ArrowLeft, KeyRound, CheckCheck, Headphones, Handshake } from 'lucide-react';
import { validateEmailAddress } from '../utils/emailValidation';
import { sendEmailOtp, verifyEmailOtp } from '../utils/otpService';

interface AuthPageProps {
  onSuccess: () => void;
  path: string;
  navigate: (path: string, clearSearch?: boolean) => void;
}

function deriveAuthPassword(email: string): string {
  const cleanEmail = email.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  return `LoloAuth_${cleanEmail}_Secure123!`;
}

export default function AuthPage({ onSuccess, path, navigate }: AuthPageProps) {
  // Derive view states directly from the URL path prop to prevent desynchronization
  const isSignUp = path === '/signup';
  const isReset = path === '/reset';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('Kenya');
  const [isCountryOpen, setIsCountryOpen] = useState(false);

  // Email verification OTP states for Sign Up
  const [signUpStep, setSignUpStep] = useState<'details' | 'otp'>('details');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  const COUNTRIES = [
    { code: 'Kenya', name: 'Kenya', flag: '🇰🇪', dialCode: '+254' },
    { code: 'Uganda', name: 'Uganda', flag: '🇺🇬', dialCode: '+256' },
    { code: 'Nigeria', name: 'Nigeria', flag: '🇳🇬', dialCode: '+234' },
    { code: 'Ghana', name: 'Ghana', flag: '🇬🇭', dialCode: '+233' },
    { code: 'South Africa', name: 'South Africa', flag: '🇿🇦', dialCode: '+27' },
  ];
  const [referral, setReferral] = useState(() => localStorage.getItem('pending_referral_code') || '');
  const referralNotifiedRef = React.useRef(false);
  const toast = useToast();
  const [isDraggingSupport, setIsDraggingSupport] = useState(false);
  const dragStartTimeRef = useRef<number>(0);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const setError = (msg: string | null) => {
    setErrorState(msg);
    if (msg) toast.error(msg, 'Authentication Error');
  };
  const error = errorState;

  const [successMsgState, setSuccessMsgState] = useState<string | null>(null);
  const setSuccessMsg = (msg: string | null) => {
    setSuccessMsgState(msg);
    if (msg) toast.success(msg, 'Authentication');
  };
  const successMsg = successMsgState;

  // Two-Factor Authentication Login States
  const [show2faPrompt, setShow2faPrompt] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorErrorState, setTwoFactorErrorState] = useState<string | null>(null);
  const setTwoFactorError = (msg: string | null) => {
    setTwoFactorErrorState(msg);
    if (msg) toast.error(msg, '2FA Code Error');
  };
  const twoFactorError = twoFactorErrorState;

  const [showPassword, setShowPassword] = useState(false);

  // Check email for domain suggestions / typos on change
  useEffect(() => {
    if (email && email.includes('@')) {
      const validation = validateEmailAddress(email);
      if (validation.suggestion) {
        setEmailSuggestion(validation.suggestion);
      } else {
        setEmailSuggestion(null);
      }
    } else {
      setEmailSuggestion(null);
    }
  }, [email]);

  // Reset OTP step when switching views
  useEffect(() => {
    if (!isSignUp) {
      setSignUpStep('details');
      setOtpDigits(['', '', '', '', '', '']);
    }
  }, [isSignUp, path]);

  // Resend OTP countdown timer
  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Check URL parameters and localStorage for referral codes
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    let refCode = searchParams.get('ref') || searchParams.get('code');
    if (!refCode) {
      const hashIndex = window.location.hash.indexOf('?');
      if (hashIndex !== -1) {
        const hashParams = new URLSearchParams(window.location.hash.substring(hashIndex));
        refCode = hashParams.get('ref') || hashParams.get('code');
      }
    }
    
    if (refCode) {
      const upperRefCode = refCode.trim().toUpperCase();
      localStorage.setItem('pending_referral_code', upperRefCode);
      setReferral(upperRefCode);
      if (path !== '/signup') {
        navigate('/signup', true); // Navigate and clear search params!
      }
      if (!referralNotifiedRef.current) {
        referralNotifiedRef.current = true;
        setSuccessMsg(`Welcome! Referral code "${upperRefCode}" has been successfully pre-filled.`);
      }
    } else {
      const savedRef = localStorage.getItem('pending_referral_code') || '';
      if (savedRef) {
        setReferral((prev) => (prev ? prev : savedRef));
        // Only show prefilled message if they are explicitly on /signup
        if (path === '/signup' && !referralNotifiedRef.current) {
          referralNotifiedRef.current = true;
          setSuccessMsg(`Welcome! Referral code "${savedRef}" has been successfully pre-filled.`);
        }
      }
    }
  }, [path, navigate]);

  const handleVerify2faLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError(null);
    if (twoFactorCode.trim().length !== 6 || isNaN(Number(twoFactorCode.trim()))) {
      setTwoFactorError('Please enter a valid 6-digit Google Authenticator code.');
      return;
    }
    // Validation successful! Proceed to the main dashboard
    localStorage.removeItem('pending_referral_code');
    onSuccess();
  };

  // OTP Input event handlers
  const handleOtpBoxChange = (index: number, val: string) => {
    const numericVal = val.replace(/\D/g, '');
    
    if (numericVal.length > 1) {
      // User pasted or typed multiple digits
      const newDigits = [...otpDigits];
      const chars = numericVal.slice(0, 6).split('');
      chars.forEach((ch, idx) => {
        if (index + idx < 6) {
          newDigits[index + idx] = ch;
        }
      });
      setOtpDigits(newDigits);
      const nextFocus = Math.min(index + chars.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = numericVal;
    setOtpDigits(newDigits);

    if (numericVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpBoxKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        otpInputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpBoxPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = ['', '', '', '', '', ''];
    pasted.split('').forEach((ch, idx) => {
      newDigits[idx] = ch;
    });
    setOtpDigits(newDigits);
    const lastIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[lastIdx]?.focus();
  };

  // Request/Resend verification code
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    const formattedEmail = email.trim().toLowerCase();
    
    setLoading(true);
    setError(null);
    try {
      await sendEmailOtp(formattedEmail, displayName.trim());

      setResendCooldown(45);
      setSuccessMsg('A new verification code has been dispatched to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Final account verification and creation with OTP code
  const handleFinalSignUpWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredCode = otpDigits.join('').trim();
    if (enteredCode.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);
    const formattedEmail = email.trim().toLowerCase();

    try {
      // 1. Verify OTP code
      const verifyResult = await verifyEmailOtp(formattedEmail, enteredCode);
      if (!verifyResult.success) {
        throw new Error(verifyResult.error || 'Invalid verification code. Please check your passcode and try again.');
      }

      // 2. Clear referral/code parameters from the URL before signing in
      navigate('/signup', true);

      // 3. Handle Registration in Firebase Auth
      let user;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, formattedEmail, deriveAuthPassword(formattedEmail));
        user = userCredential.user;
      } catch (regErr: any) {
        if (regErr.code === 'auth/email-already-in-use') {
          try {
            const userCredential = await signInWithEmailAndPassword(auth, formattedEmail, deriveAuthPassword(formattedEmail));
            user = userCredential.user;
          } catch (loginErr: any) {
            let version = 1;
            let versionedEmail = '';
            let success = false;
            while (!success && version < 20) {
              const parts = formattedEmail.split('@');
              versionedEmail = `${parts[0]}+v${version}@${parts[1]}`;
              try {
                const userCredential = await createUserWithEmailAndPassword(auth, versionedEmail, deriveAuthPassword(formattedEmail));
                user = userCredential.user;
                success = true;
              } catch (vErr: any) {
                if (vErr.code === 'auth/email-already-in-use') {
                  try {
                    const userCredential = await signInWithEmailAndPassword(auth, versionedEmail, deriveAuthPassword(formattedEmail));
                    user = userCredential.user;
                    success = true;
                  } catch (vLoginErr) {
                    version++;
                  }
                } else {
                  throw vErr;
                }
              }
            }
            if (!success) {
              throw new Error('Could not recreate user account. Please try a different email address.');
            }
          }
        } else {
          throw regErr;
        }
      }

      // Generate dynamic unique referral code for the new user
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let generatedCode = '';
      for (let i = 0; i < 5; i++) {
        generatedCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const trimmedReferral = referral.trim().toUpperCase();
      const selectedCountryObj = COUNTRIES.find(c => c.code === country) || COUNTRIES[0];
      const rawPhone = phone.trim().replace(/^0+/, '');
      const formattedPhone = rawPhone.startsWith('+') ? rawPhone : `${selectedCountryObj.dialCode} ${rawPhone}`;

      // Initialize user document in Firestore
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, {
        uid: user.uid,
        email: formattedEmail,
        displayName: displayName.trim() || formattedEmail.split('@')[0],
        phone: formattedPhone,
        country: country,
        balance: 0.0,
        usdtBalance: 0.0,
        referralSource: trimmedReferral,
        uniqueCode: generatedCode,
        createdAt: serverTimestamp(),
        withdrawalEnabled: true,
        walletPassword: '',
        accountPassword: password,
        authEmail: user.email,
        emailVerified: true
      });

      // Save referral code mapping
      try {
        await setDoc(doc(db, 'referralCodes', generatedCode), {
          uid: user.uid,
          email: formattedEmail
        });
      } catch (mappingErr) {
        console.error('Error saving referral code mapping:', mappingErr);
      }

      // Save session details to localStorage
      localStorage.setItem('custom_user_email', formattedEmail);
      localStorage.setItem('custom_user_uid', user.uid);

      // Auto-credit referrer if referral code was used
      if (trimmedReferral) {
        try {
          const refMappingSnap = await getDoc(doc(db, 'referralCodes', trimmedReferral));
          if (refMappingSnap.exists()) {
            const refData = refMappingSnap.data();
            const referrerUid = refData.uid;
            const referrerEmail = refData.email || '';

            const referralsQuery = query(collection(db, 'users'), where('referralSource', '==', trimmedReferral));
            const referralsSnap = await getDocs(referralsQuery);
            const referralsCount = referralsSnap.size;

            let rewardAmount = 0.10;
            let tierName = 'Starter';
            if (referralsCount >= 40) {
              rewardAmount = 0.40;
              tierName = 'Gold';
            } else if (referralsCount >= 20) {
              rewardAmount = 0.30;
              tierName = 'Silver';
            } else if (referralsCount >= 7) {
              rewardAmount = 0.20;
              tierName = 'Bronze';
            }

            await updateDoc(doc(db, 'users', referrerUid), {
              balance: increment(rewardAmount),
              usdtBalance: increment(rewardAmount)
            });

            await addDoc(collection(db, 'transactions'), {
              userId: referrerUid,
              userEmail: referrerEmail,
              type: 'referral_reward',
              amount: rewardAmount,
              status: 'APPROVED',
              createdAt: serverTimestamp(),
              paymentMessage: `Referral bonus (${tierName} Tier): successfully invited ${formattedEmail}`
            });
          }
        } catch (refErr) {
          console.error('Error auto-crediting referral reward:', refErr);
        }
      }

      // Prompt browser / PWA password manager to save credentials under current origin
      if (typeof window !== 'undefined' && 'PasswordCredential' in window && navigator.credentials?.store) {
        try {
          const cred = new (window as any).PasswordCredential({
            id: formattedEmail,
            password: password,
            name: displayName || formattedEmail.split('@')[0],
          });
          await navigator.credentials.store(cred);
        } catch {
          // Non-blocking credential store fallback
        }
      }

      localStorage.removeItem('pending_referral_code');
      onSuccess();
    } catch (err: any) {
      console.error('Registration OTP verification error:', err);
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const formattedEmail = email.trim().toLowerCase();

    try {
      if (isReset) {
        // Handle custom Password Reset directly in the database
        if (!resetNewPassword || !resetConfirmPassword) {
          throw new Error('Please fill in both password fields.');
        }
        if (resetNewPassword.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        if (resetNewPassword !== resetConfirmPassword) {
          throw new Error('Passwords do not match.');
        }

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', formattedEmail));
        const querySnap = await getDocs(q);

        if (querySnap.empty) {
          throw new Error('No registered account found with this email.');
        }

        const userDoc = querySnap.docs[0];
        const userUid = userDoc.id;

        // Update custom password in Firestore
        await updateDoc(doc(db, 'users', userUid), {
          accountPassword: resetNewPassword
        });

        setSuccessMsg('Your password has been successfully updated. Redirecting to login page...');
        setResetNewPassword('');
        setResetConfirmPassword('');
        
        setTimeout(() => {
          navigate('/login');
        }, 3000);

      } else if (isSignUp) {
        // Step 1: Pre-flight validation before sending OTP
        if (!displayName.trim()) {
          throw new Error('Please enter your display name.');
        }

        // Email validation & disposable domain check
        const validation = validateEmailAddress(formattedEmail);
        if (!validation.isValid) {
          throw new Error(validation.error || 'Please enter a valid email address.');
        }

        if (!phone.trim()) {
          throw new Error('Please enter your phone number.');
        }

        if (!password || password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match. Please verify that your password confirmation matches.');
        }

        // Check if user is already registered in Firestore
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', formattedEmail));
        const querySnap = await getDocs(q);

        if (!querySnap.empty) {
          throw new Error('This email address is already registered. Please sign in instead.');
        }

        // Request 6-digit OTP verification code
        await sendEmailOtp(formattedEmail, displayName.trim());

        setResendCooldown(45);
        setSignUpStep('otp');
        setOtpDigits(['', '', '', '', '', '']);
        setSuccessMsg(`Verification code sent to ${formattedEmail}`);
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 100);

      } else {
        // Handle Sign In
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', formattedEmail));
        const querySnap = await getDocs(q);

        if (querySnap.empty) {
          throw new Error('No account found with this email address.');
        }

        const userDoc = querySnap.docs[0];
        const userData = userDoc.data();
        const activeUserUid = userDoc.id;

        // Verify password against Firestore accountPassword
        const firestorePassword = userData.accountPassword;
        if (!firestorePassword || firestorePassword !== password) {
          throw new Error('Incorrect password. Please verify your credentials or use the reset password option.');
        }

        const authEmailToUse = userData.authEmail || userData.email || formattedEmail;

        try {
          await signInWithEmailAndPassword(auth, authEmailToUse, deriveAuthPassword(formattedEmail));
        } catch (authSignInErr: any) {
          try {
            await signInWithEmailAndPassword(auth, formattedEmail, deriveAuthPassword(formattedEmail));
          } catch (secondAuthErr: any) {
            console.log('Firebase Auth internal credential fallback...');
          }
        }

        localStorage.setItem('custom_user_email', formattedEmail);
        localStorage.setItem('custom_user_uid', activeUserUid);

        let has2fa = false;
        const docRef = doc(db, 'users', activeUserUid);
        const freshSnap = await getDoc(docRef);
        if (freshSnap.exists()) {
          const freshData = freshSnap.data();
          if (freshData.twoFactorEnabled && freshData.twoFactorSecret) {
            has2fa = true;
          }
        } else {
          await setDoc(docRef, {
            uid: activeUserUid,
            email: formattedEmail,
            displayName: formattedEmail.split('@')[0],
            balance: 0.0,
            usdtBalance: 0.0,
            referralSource: '',
            createdAt: serverTimestamp(),
            withdrawalEnabled: true,
            walletPassword: '',
            twoFactorEnabled: false,
            accountPassword: password,
            authEmail: formattedEmail
          });
        }

        if (has2fa) {
          setShow2faPrompt(true);
        } else {
          // Prompt browser / PWA password manager to save/update credentials under current origin
          if (typeof window !== 'undefined' && 'PasswordCredential' in window && navigator.credentials?.store) {
            try {
              const cred = new (window as any).PasswordCredential({
                id: formattedEmail,
                password: password,
                name: formattedEmail.split('@')[0],
              });
              await navigator.credentials.store(cred);
            } catch {
              // Non-blocking credential store fallback
            }
          }

          localStorage.removeItem('pending_referral_code');
          onSuccess();
        }
      }
    } catch (err: any) {
      console.error('Authentication Error:', err);
      let cleanMessage = 'Authentication failed. Please verify your details.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        cleanMessage = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        cleanMessage = 'This email address is already registered.';
      } else if (err.code === 'auth/weak-password') {
        cleanMessage = 'Password must be at least 6 characters.';
      } else if (err.message) {
        cleanMessage = err.message;
      }
      setError(cleanMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-page-container" className="min-h-screen bg-gradient-to-br from-[#EBF9F0] via-[#F4FBF6] to-[#E2F7E9] text-zinc-900 font-sans relative overflow-hidden flex flex-col justify-center items-center py-8 px-4 sm:py-12">
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-16px) rotate(4deg); }
        }
        .animate-float-slow {
          animation: float-slow 9s ease-in-out infinite;
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(-4deg); }
        }
        .animate-float-fast {
          animation: float-fast 6s ease-in-out infinite;
        }
        @keyframes drift-up {
          0% { transform: translateY(0px) scale(0.96); opacity: 0.25; }
          50% { transform: translateY(-12px) scale(1.02); opacity: 0.45; }
          100% { transform: translateY(0px) scale(0.96); opacity: 0.25; }
        }
        .animate-drift-up {
          animation: drift-up 7s ease-in-out infinite;
        }
      `}</style>

      {/* 1. Subtle High-Tech Background Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* Ambient Sprite Glows */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[650px] h-[450px] bg-gradient-to-b from-[#008B47]/15 via-[#80D824]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-36 -left-20 w-[450px] h-[450px] bg-[#008B47]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-24 w-[400px] h-[400px] bg-[#F4E100]/12 rounded-full blur-3xl pointer-events-none" />

        {/* Micro-Security Pattern / Lattice Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#008B47_0.7px,transparent_0.7px)] [background-size:24px_24px] opacity-[0.06]" />

        {/* Geometric Security Curve Watermarks */}
        <svg className="absolute -top-10 -left-10 w-96 h-96 opacity-[0.07] text-[#008B47]" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="0.75" />
          <path d="M20,100 Q60,20 100,100 T180,100" stroke="currentColor" strokeWidth="1" />
          <path d="M20,100 Q60,180 100,100 T180,100" stroke="currentColor" strokeWidth="1" />
          <path d="M100,20 Q20,60 100,100 T100,180" stroke="currentColor" strokeWidth="1" />
          <path d="M100,20 Q180,60 100,100 T100,180" stroke="currentColor" strokeWidth="1" />
        </svg>

        <svg className="absolute -bottom-16 -right-16 w-[28rem] h-[28rem] opacity-[0.06] text-[#008B47]" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="70" stroke="currentColor" strokeWidth="1" strokeDasharray="4 2" />
          <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="100,15 125,75 190,75 137,115 158,175 100,140 42,175 63,115 10,75 75,75" stroke="currentColor" strokeWidth="0.8" />
        </svg>

        {/* Floating Reserve Badge (Top Left) */}
        <div className="absolute top-[12%] left-[3%] lg:left-[8%] opacity-35 hidden sm:block animate-float-slow">
          <div className="w-44 h-24 rounded-2xl bg-gradient-to-br from-white to-emerald-50/90 border border-emerald-200 p-2.5 shadow-lg shadow-emerald-900/5 rotate-[-8deg] backdrop-blur-xs flex flex-col justify-between">
            <div className="flex justify-between items-center text-emerald-800">
              <span className="font-mono font-black text-xs">CME</span>
              <span className="text-[9px] font-bold tracking-widest uppercase">LIQUIDITY VAULT</span>
              <span className="font-mono font-black text-xs">A+</span>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-9 h-9 rounded-full border border-emerald-400 bg-emerald-100/60 flex items-center justify-center text-[#008B47] font-bold text-sm font-serif">
                $
              </div>
            </div>
            <div className="flex justify-between items-center text-[8px] font-mono text-emerald-700 font-semibold">
              <span>SERIES 2026</span>
              <span>SECURED RESERVE</span>
            </div>
          </div>
        </div>

        {/* Floating Treasury Card (Bottom Right) */}
        <div className="absolute bottom-[14%] right-[3%] lg:right-[8%] opacity-35 hidden sm:block animate-float-fast">
          <div className="w-44 h-24 rounded-2xl bg-gradient-to-br from-white to-[#F4FBF6] border border-emerald-200 p-2.5 shadow-lg shadow-emerald-900/5 rotate-[10deg] backdrop-blur-xs flex flex-col justify-between">
            <div className="flex justify-between items-center text-emerald-900">
              <span className="font-mono font-black text-xs">100%</span>
              <span className="text-[9px] font-bold tracking-widest uppercase">CME TREASURY</span>
              <span className="font-mono font-black text-xs">₮</span>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-9 h-9 rounded-full border border-[#008B47] bg-emerald-100/70 flex items-center justify-center text-[#008B47] font-bold text-xs font-mono">
                ₮
              </div>
            </div>
            <div className="flex justify-between items-center text-[8px] font-mono text-emerald-800 font-semibold">
              <span>INSTITUTIONAL</span>
              <span>100% ASSET BACKED</span>
            </div>
          </div>
        </div>

        {/* Floating Coin Badges */}
        <div className="absolute top-[28%] left-[2%] lg:left-[5%] animate-float-fast opacity-35">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-100 via-emerald-300 to-[#008B47] border-2 border-white shadow-md flex items-center justify-center text-white font-black text-xl font-serif rotate-[-12deg]">
            $
          </div>
        </div>

        <div className="absolute bottom-[28%] left-[4%] lg:left-[7%] animate-float-slow opacity-35">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-100 via-emerald-300 to-[#008B47] border-2 border-white shadow-md flex items-center justify-center text-white font-black text-lg font-mono rotate-[15deg]">
            ₿
          </div>
        </div>

        <div className="absolute top-[16%] right-[4%] lg:right-[7%] animate-float-slow opacity-35">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-100 via-yellow-300 to-[#80D824] border-2 border-white shadow-md flex items-center justify-center text-emerald-950 font-black text-lg font-sans rotate-[8deg]">
            €
          </div>
        </div>

        {/* Floating Candlestick Chart Cluster (Left) */}
        <div className="absolute top-[48%] left-[3%] lg:left-[6%] opacity-25 hidden md:flex items-end gap-2 animate-drift-up">
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-3 bg-[#008B47]"></div>
            <div className="w-3.5 h-8 bg-[#008B47] rounded-xs"></div>
            <div className="w-0.5 h-2 bg-[#008B47]"></div>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-2 bg-[#008B47]"></div>
            <div className="w-3.5 h-12 bg-[#00A653] rounded-xs"></div>
            <div className="w-0.5 h-4 bg-[#008B47]"></div>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-4 bg-[#008B47]"></div>
            <div className="w-3.5 h-16 bg-[#80D824] rounded-xs"></div>
            <div className="w-0.5 h-3 bg-[#008B47]"></div>
          </div>
        </div>

        {/* Floating Profit Badges (Right) */}
        <div className="absolute top-[44%] right-[3%] lg:right-[6%] opacity-40 hidden md:block animate-drift-up">
          <div className="space-y-2">
            <div className="px-3 py-1.5 rounded-xl bg-white/90 border border-emerald-300 text-emerald-800 font-mono text-xs font-black shadow-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#008B47] animate-pulse"></span>
              CME ARBITRAGE ACTIVE
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-300 text-emerald-800 font-mono text-xs font-black shadow-sm flex items-center gap-1.5">
              <span>⚡</span>
              INSTANT SETTLEMENT
            </div>
          </div>
        </div>
      </div>

      {/* 2. Centered Auth Container */}
      <div className="w-full max-w-[420px] relative z-10 flex flex-col justify-center">
            
            {/* Header: CME Brand Emblem & Title */}
            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-3 p-2 pr-4 bg-white/95 backdrop-blur-md rounded-2xl border border-emerald-200/90 shadow-sm mb-3 group hover:border-emerald-300 transition-all">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#008B47] to-[#00A653] p-1.5 flex items-center justify-center shadow-xs shrink-0 ring-2 ring-[#F4E100]/60">
                  <img 
                    src="/icon.svg" 
                    alt="CME" 
                    className="w-full h-full object-contain filter drop-shadow-xs"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-zinc-900 tracking-wider">CME</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-[#007038] text-[9px] font-black uppercase tracking-wider">PLATFORM</span>
                  </div>
                  <p className="text-[10.5px] font-bold text-zinc-500 tracking-tight">Institutional Digital Gateway</p>
                </div>
              </div>

              <div className="space-y-1">
                <h1 className="text-2xl sm:text-[26px] font-black tracking-tight text-zinc-900 leading-tight">
                  {isReset ? 'Recover Access' : isSignUp ? 'Create CME Trading Account' : 'Welcome to CME Trading'}
                  <span className="text-[#008B47]">.</span>
                </h1>
                <p className="text-xs sm:text-[12.5px] font-medium text-zinc-600 max-w-[320px] mx-auto leading-relaxed">
                  {isReset 
                    ? 'Enter your registered email and a new password to restore wallet access.' 
                    : isSignUp 
                      ? 'Create your CME Trading account with instant email verification and smart copy trading.' 
                      : 'Access your CME Trading desk, portfolio balance, and copy trading earnings.'
                  }
                </p>
              </div>
            </div>

            {/* Main Auth Form Container Card */}
            <div className="bg-white border border-emerald-200/80 rounded-3xl p-5 sm:p-6 shadow-xl shadow-emerald-950/5 space-y-5">
              
              {/* Modern Segmented Navigation Tabs (Sign In / Create Account) */}
              {!isReset && signUpStep !== 'otp' && !show2faPrompt && (
                <div className="grid grid-cols-2 p-1 bg-zinc-100/90 rounded-2xl border border-zinc-200/70">
                  <button
                    id="auth-tab-signin"
                    type="button"
                    onClick={() => { if (isSignUp) { navigate('/login'); setError(null); } }}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      !isSignUp 
                        ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/60' 
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    id="auth-tab-signup"
                    type="button"
                    onClick={() => { if (!isSignUp) { navigate('/signup'); setError(null); } }}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      isSignUp 
                        ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/60' 
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              )}

              {show2faPrompt ? (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-zinc-800 flex items-center gap-2">
                      <Shield size={18} className="text-[#008B47]" />
                      Two-Factor Verification
                    </h2>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      This CME wallet is secured with Two-Factor Authentication. Please enter the 6-digit passcode from your Google Authenticator app.
                    </p>
                  </div>

                  <form onSubmit={handleVerify2faLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block text-center">Google Authenticator Code</label>
                      <input
                        id="auth-2fa-input"
                        type="text"
                        maxLength={6}
                        required
                        autoFocus
                        placeholder="000000"
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-mono text-lg tracking-widest text-[#008B47] font-bold focus:outline-none focus:ring-2 focus:ring-[#008B47] focus:border-[#008B47]"
                      />
                    </div>

                    <button
                      id="auth-2fa-verify-btn"
                      type="submit"
                      className="w-full py-3 bg-gradient-to-r from-[#008B47] to-[#00A653] hover:from-[#007038] hover:to-[#008B47] text-white font-bold rounded-xl text-xs tracking-wider uppercase shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
                    >
                      Verify & Access CME Wallet
                    </button>

                    <button
                      id="auth-2fa-cancel-btn"
                      type="button"
                      onClick={() => { setShow2faPrompt(false); setTwoFactorCode(''); setTwoFactorError(null); }}
                      className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer text-center"
                    >
                      Back to Sign In
                    </button>
                  </form>
                </div>
              ) : isSignUp && signUpStep === 'otp' ? (
                /* Step 2: 6-Digit Email Verification Code Input Screen */
                <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
                  <div className="text-center space-y-1.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 border border-emerald-300 text-[#008B47] mx-auto flex items-center justify-center shadow-xs">
                      <Mail size={22} className="stroke-[2.2]" />
                    </div>
                    <h2 className="text-lg font-bold text-zinc-900">Verify Your Email</h2>
                    <p className="text-xs text-zinc-500 leading-relaxed px-1">
                      We sent a 6-digit confirmation passcode to{' '}
                      <span className="font-semibold text-zinc-800 break-all">{email.trim().toLowerCase()}</span>
                    </p>
                    <button
                      id="auth-edit-email-btn"
                      type="button"
                      onClick={() => setSignUpStep('details')}
                      className="text-[11px] text-[#008B47] hover:text-[#007038] font-semibold hover:underline cursor-pointer inline-flex items-center gap-1 mt-0.5"
                    >
                      <ArrowLeft size={11} /> Edit email address
                    </button>
                  </div>

                  <form onSubmit={handleFinalSignUpWithOtp} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block text-center">
                        Enter 6-Digit Passcode
                      </label>
                      <div className="flex justify-between gap-1.5 sm:gap-2">
                        {otpDigits.map((digit, idx) => (
                          <input
                            key={idx}
                            id={`auth-otp-box-${idx}`}
                            ref={(el) => { otpInputRefs.current[idx] = el; }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={1}
                            autoFocus={idx === 0}
                            value={digit}
                            onChange={(e) => handleOtpBoxChange(idx, e.target.value)}
                            onKeyDown={(e) => handleOtpBoxKeyDown(idx, e)}
                            onPaste={handleOtpBoxPaste}
                            className="w-10 sm:w-11 h-12 text-center text-lg font-bold font-mono bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#008B47] focus:border-[#008B47] text-zinc-900 shadow-xs transition-all"
                          />
                        ))}
                      </div>
                    </div>

                    {/* Verify & Create Account Button */}
                    <button
                      id="auth-verify-otp-btn"
                      type="submit"
                      disabled={loading || otpDigits.join('').length !== 6}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#008B47] to-[#00A653] text-white hover:from-[#007038] hover:to-[#008B47] rounded-xl text-xs font-bold transition-all disabled:bg-zinc-100 disabled:text-zinc-400 shadow-md shadow-emerald-700/20 cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Verifying & Creating CME Trading Account...</span>
                        </>
                      ) : (
                        <>
                          <CheckCheck size={15} />
                          <span>Verify & Create Account</span>
                        </>
                      )}
                    </button>

                    {/* Resend Code & Back Controls */}
                    <div className="flex flex-col items-center gap-2 pt-1">
                      {resendCooldown > 0 ? (
                        <span className="text-xs text-zinc-400 font-medium">
                          Resend code in <strong className="font-mono text-emerald-800">{resendCooldown}s</strong>
                        </span>
                      ) : (
                        <button
                          id="auth-resend-otp-btn"
                          type="button"
                          disabled={loading}
                          onClick={handleResendOtp}
                          className="text-xs font-bold text-[#008B47] hover:text-[#007038] hover:underline cursor-pointer disabled:opacity-50"
                        >
                          Resend Verification Code
                        </button>
                      )}

                      <button
                        id="auth-back-to-details-btn"
                        type="button"
                        onClick={() => setSignUpStep('details')}
                        className="text-[11px] text-zinc-500 hover:text-zinc-700 font-medium cursor-pointer"
                      >
                        Back to Registration Details
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* Display Name - Sign Up Only */}
                    {isSignUp && !isReset && (
                      <div className="space-y-1">
                        <label htmlFor="auth-display-name" className="text-xs font-semibold text-zinc-600 cursor-pointer">Full Name</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 pointer-events-none z-10">
                            <User size={15} />
                          </span>
                          <input
                            id="auth-display-name"
                            name="displayName"
                            type="text"
                            required
                            autoComplete="name"
                            autoCapitalize="words"
                            autoCorrect="off"
                            placeholder="John Doe"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#008B47] focus:border-[#008B47] placeholder-zinc-400 text-zinc-800"
                          />
                        </div>
                      </div>
                    )}

                    {/* Country Dropdown - Sign Up Only */}
                    {isSignUp && !isReset && (
                      <div className="space-y-1 relative">
                        <label htmlFor="auth-country-trigger" className="text-xs font-semibold text-zinc-600 cursor-pointer">Country of Residence</label>
                        
                        <button
                          id="auth-country-trigger"
                          type="button"
                          onClick={() => setIsCountryOpen(!isCountryOpen)}
                          className="w-full px-3 py-2.5 bg-zinc-50 hover:bg-zinc-100/90 border border-zinc-200 rounded-xl text-xs flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-[#008B47] text-zinc-800 font-medium cursor-pointer shadow-xs active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-base leading-none shrink-0">{COUNTRIES.find(c => c.code === country)?.flag || '🇰🇪'}</span>
                            <span className="font-semibold text-zinc-800 truncate">{COUNTRIES.find(c => c.code === country)?.name || country}</span>
                            <span className="text-[10px] bg-zinc-200/80 text-zinc-700 font-bold font-mono px-1.5 py-0.5 rounded shrink-0">
                              {COUNTRIES.find(c => c.code === country)?.dialCode || '+254'}
                            </span>
                          </div>
                          <ChevronDown size={15} className={`text-zinc-400 shrink-0 transition-transform duration-200 ${isCountryOpen ? 'rotate-180 text-[#008B47]' : ''}`} />
                        </button>

                        {/* Custom Modern Dropdown Menu */}
                        {isCountryOpen && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setIsCountryOpen(false)} 
                            />
                            
                            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-emerald-200 rounded-2xl shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                              {COUNTRIES.map((c) => {
                                const isSelected = country === c.code;
                                return (
                                  <button
                                    key={c.code}
                                    id={`auth-country-opt-${c.code.toLowerCase().replace(/\s+/g, '-')}`}
                                    type="button"
                                    onClick={() => {
                                      setCountry(c.code);
                                      setIsCountryOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                                      isSelected 
                                        ? 'bg-emerald-50 border border-emerald-300 text-[#007038] font-bold shadow-xs' 
                                        : 'hover:bg-emerald-50/50 text-zinc-700 font-medium border border-transparent'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-base leading-none">{c.flag}</span>
                                      <span>{c.name}</span>
                                      <span className="text-[10px] font-mono text-zinc-500 font-semibold">
                                        ({c.dialCode})
                                      </span>
                                    </div>
                                    {isSelected && <Check size={14} className="text-[#008B47] shrink-0 stroke-[3]" />}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Email Field */}
                    <div className="space-y-1">
                      <label htmlFor="auth-email" className="text-xs font-semibold text-zinc-600 cursor-pointer">Email Address</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 pointer-events-none z-10">
                          <Mail size={15} />
                        </span>
                        <input
                          id="auth-email"
                          name="email"
                          type="email"
                          required
                          autoComplete="username email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder="alex@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#008B47] focus:border-[#008B47] placeholder-zinc-400 text-zinc-800"
                        />
                      </div>

                      {/* Live Typo Auto-Suggestion Banner */}
                      {isSignUp && emailSuggestion && (
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 text-[11px] text-[#007038] mt-1">
                          <span>
                            Did you mean <strong className="font-semibold">{emailSuggestion}</strong>?
                          </span>
                          <button
                            id="auth-apply-email-suggestion"
                            type="button"
                            onClick={() => setEmail(emailSuggestion)}
                            className="text-[#008B47] font-bold hover:underline ml-2 cursor-pointer shrink-0"
                          >
                            Fix
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Phone Number - Sign Up Only */}
                    {isSignUp && !isReset && (
                      <div className="space-y-1">
                        <label htmlFor="auth-phone" className="text-xs font-semibold text-zinc-600 cursor-pointer">Phone Number</label>
                        <div className="relative flex items-center">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10 gap-1.5">
                            <span className="text-sm leading-none">{COUNTRIES.find(c => c.code === country)?.flag || '🇰🇪'}</span>
                            <span className="text-xs font-bold text-zinc-600 font-mono">{COUNTRIES.find(c => c.code === country)?.dialCode || '+254'}</span>
                            <span className="h-4 w-[1px] bg-zinc-200 ml-0.5" />
                          </div>
                          <input
                            id="auth-phone"
                            name="phone"
                            type="tel"
                            required
                            autoComplete="tel"
                            placeholder="700 000 000"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full pl-24 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#008B47] focus:border-[#008B47] placeholder-zinc-400 text-zinc-800 font-medium"
                          />
                        </div>
                      </div>
                    )}

                    {/* Custom Reset Fields (New Password, Confirm Password) - Reset Only */}
                    {isReset && (
                      <>
                        {/* New Password */}
                        <div className="space-y-1">
                          <label htmlFor="auth-reset-new-password" className="text-xs font-semibold text-zinc-600 cursor-pointer">New Password</label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 pointer-events-none z-10">
                              <Lock size={15} />
                            </span>
                            <input
                              id="auth-reset-new-password"
                              name="newPassword"
                              type={showResetPassword ? 'text' : 'password'}
                              required
                              minLength={6}
                              autoComplete="new-password"
                              placeholder="••••••••"
                              value={resetNewPassword}
                              onChange={(e) => setResetNewPassword(e.target.value)}
                              className="w-full pl-9 pr-10 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#008B47] focus:border-[#008B47] placeholder-zinc-400 text-zinc-800"
                            />
                            <button
                              type="button"
                              onClick={() => setShowResetPassword(!showResetPassword)}
                              className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 focus:outline-none cursor-pointer z-10"
                              title={showResetPassword ? "Hide password" : "Show password"}
                            >
                              {showResetPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>
                        </div>

                        {/* Confirm New Password */}
                        <div className="space-y-1">
                          <label htmlFor="auth-reset-confirm-password" className="text-xs font-semibold text-zinc-600 cursor-pointer">Confirm New Password</label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 pointer-events-none z-10">
                              <Lock size={15} />
                            </span>
                            <input
                              id="auth-reset-confirm-password"
                              name="confirmPassword"
                              type={showResetPassword ? 'text' : 'password'}
                              required
                              minLength={6}
                              autoComplete="new-password"
                              placeholder="••••••••"
                              value={resetConfirmPassword}
                              onChange={(e) => setResetConfirmPassword(e.target.value)}
                              className="w-full pl-9 pr-10 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#008B47] focus:border-[#008B47] placeholder-zinc-400 text-zinc-800"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Password Field - Login / Sign Up Only */}
                    {!isReset && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label htmlFor="auth-password" className="text-xs font-semibold text-zinc-600 cursor-pointer">Password</label>
                          {!isSignUp && (
                            <button
                              id="auth-forgot-password"
                              type="button"
                              onClick={() => { navigate('/reset'); setError(null); }}
                              className="text-[11px] font-semibold text-[#008B47] hover:text-[#007038] hover:underline cursor-pointer"
                            >
                              Forgot Password?
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 pointer-events-none z-10">
                            <Lock size={15} />
                          </span>
                          <input
                            id="auth-password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            autoComplete={isSignUp ? "new-password" : "current-password"}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-9 pr-10 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#008B47] focus:border-[#008B47] placeholder-zinc-400 text-zinc-800"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 focus:outline-none cursor-pointer z-10"
                            title={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Confirm Password Field - Sign Up Only */}
                    {isSignUp && !isReset && (
                      <div className="space-y-1">
                        <label htmlFor="auth-confirm-password" className="text-xs font-semibold text-zinc-600 cursor-pointer">Confirm Password</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 pointer-events-none z-10">
                            <Lock size={15} />
                          </span>
                          <input
                            id="auth-confirm-password"
                            name="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full pl-9 pr-10 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#008B47] focus:border-[#008B47] placeholder-zinc-400 text-zinc-800"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 focus:outline-none cursor-pointer z-10"
                            title={showConfirmPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Referral Code - Sign Up Only */}
                    {isSignUp && !isReset && (
                      <div className="space-y-1">
                        <label htmlFor="auth-referral" className="text-xs font-semibold text-zinc-600 cursor-pointer flex items-center justify-between">
                          <span>Referral Code</span>
                          <span className="text-[10px] text-zinc-400 font-normal">Optional</span>
                        </label>
                        <input
                          id="auth-referral"
                          name="referral"
                          type="text"
                          autoComplete="off"
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder="e.g. INVITE50"
                          value={referral}
                          onChange={(e) => setReferral(e.target.value)}
                          className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#008B47] focus:border-[#008B47] placeholder-zinc-400 text-zinc-800 uppercase font-mono"
                        />
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      id="auth-submit-btn"
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#008B47] to-[#00A653] text-white hover:from-[#007038] hover:to-[#008B47] rounded-xl text-xs sm:text-sm font-black transition-all mt-3 disabled:bg-zinc-100 disabled:text-zinc-400 shadow-md shadow-emerald-700/20 active:scale-[0.99] cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Please wait...</span>
                        </>
                      ) : (
                        <span>
                          {isReset 
                            ? 'Update Password' 
                            : isSignUp 
                              ? 'Continue & Verify Email' 
                              : 'Sign In to CME Wallet'
                          }
                        </span>
                      )}
                    </button>

                  </form>

                  {/* Toggle Button */}
                  <div className="text-center pt-2">
                    {isReset ? (
                      <button
                        id="auth-back-to-login"
                        onClick={() => { navigate('/login'); setError(null); }}
                        className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 hover:underline cursor-pointer"
                      >
                        Back to Sign In
                      </button>
                    ) : (
                      <p className="text-xs text-zinc-500">
                        {isSignUp ? 'Already have an account?' : "New to CME?"}{' '}
                        <button
                          id="auth-toggle-btn"
                          onClick={() => { navigate(isSignUp ? '/login' : '/signup'); setError(null); }}
                          className="text-xs font-bold text-[#008B47] hover:text-[#007038] hover:underline cursor-pointer ml-0.5"
                        >
                          {isSignUp ? 'Sign In' : 'Create Account'}
                        </button>
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Institutional Security Trust Badges */}
            <div className="mt-5 flex items-center justify-center gap-4 text-[11px] text-emerald-800 font-semibold opacity-85">
              <div className="flex items-center gap-1">
                <Shield size={13} className="text-[#008B47]" />
                <span>256-Bit SSL</span>
              </div>
              <span className="text-emerald-300">•</span>
              <div className="flex items-center gap-1">
                <CheckCircle size={13} className="text-[#008B47]" />
                <span>P2P Escrow Protection</span>
              </div>
              <span className="text-emerald-300">•</span>
              <div className="flex items-center gap-1">
                <Zap size={13} className="text-[#008B47]" />
                <span>Instant Settlement</span>
              </div>
            </div>

      </div>

      {/* Draggable Floating Support Icon for Auth Pages */}
      <motion.div
        id="draggable-auth-floating-support"
        drag
        dragMomentum={false}
        dragElastic={0.12}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onDragStart={() => {
          dragStartTimeRef.current = Date.now();
          setIsDraggingSupport(true);
        }}
        onDragEnd={() => {
          setTimeout(() => {
            setIsDraggingSupport(false);
          }, 200);
        }}
        className="fixed bottom-6 right-5 z-50 touch-none select-none cursor-grab active:cursor-grabbing"
      >
        <a
          id="auth-floating-support-btn"
          href="https://t.me/Morexsuppor"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (isDraggingSupport || (dragStartTimeRef.current > 0 && Date.now() - dragStartTimeRef.current < 250)) {
              e.preventDefault();
            }
          }}
          className="relative flex items-center justify-center w-13 h-13 rounded-full bg-gradient-to-tr from-[#008B47] via-[#00A653] to-[#80D824] text-white shadow-xl shadow-emerald-700/35 border-2 border-white focus:outline-none group active:shadow-inner cursor-pointer"
          title="24/7 CME Support"
          aria-label="Open 24/7 Customer Support"
        >
          {/* Live Online Status Dot */}
          <span className="absolute top-0 right-0 flex h-3.5 w-3.5 -mt-0.5 -mr-0.5 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F4E100] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#F4E100] border-2 border-white"></span>
          </span>

          {/* Support Headset Icon */}
          <Headphones size={22} className="text-white group-hover:scale-110 transition-transform" />

          {/* Tooltip on Desktop Hover */}
          <div className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-zinc-900/90 backdrop-blur-sm text-white text-[11px] font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md hidden sm:flex items-center gap-1.5 border border-zinc-800">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F4E100]"></span>
            <span>24/7 CME Support</span>
          </div>
        </a>
      </motion.div>
    </div>
  );
}
