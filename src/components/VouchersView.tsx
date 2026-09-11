import React, { useState, useEffect } from 'react';
import { PromoCode, UserAccount, VoucherClaim } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { redeemPromoCode, seedDefaultPromoCodesIfEmpty } from '../utils/voucherService';
import { useToast } from '../context/ToastContext';
import { 
  Gift, Sparkles, Tag, CheckCircle2, AlertCircle, ArrowLeft, 
  Clock, ShieldCheck, Zap, Coins, Copy, Check, ChevronRight,
  TrendingUp, Award, Flame
} from 'lucide-react';

interface VouchersViewProps {
  user: any;
  profile: UserAccount | null;
  onProfileUpdate: (updated: Partial<UserAccount>) => void;
  onBack: () => void;
  isLightTheme?: boolean;
}

export default function VouchersView({
  user,
  profile,
  onProfileUpdate,
  onBack,
  isLightTheme = true
}: VouchersViewProps) {
  const toast = useToast();
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [claimedVouchers, setClaimedVouchers] = useState<VoucherClaim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Seed default demo promo codes if empty on mount
  useEffect(() => {
    seedDefaultPromoCodesIfEmpty();
  }, []);

  // Fetch claimed vouchers for this user
  useEffect(() => {
    if (!user?.uid) return;

    const claimsCol = collection(db, 'user_voucher_claims');
    const q = query(
      claimsCol, 
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const claims: VoucherClaim[] = [];
      snapshot.forEach(docSnap => {
        claims.push({ id: docSnap.id, ...docSnap.data() } as VoucherClaim);
      });
      // Sort newest first
      claims.sort((a, b) => {
        const timeA = a.claimedAt?.toDate ? a.claimedAt.toDate().getTime() : (a.claimedAt ? new Date(a.claimedAt).getTime() : 0);
        const timeB = b.claimedAt?.toDate ? b.claimedAt.toDate().getTime() : (b.claimedAt ? new Date(b.claimedAt).getTime() : 0);
        return timeB - timeA;
      });
      setClaimedVouchers(claims);
      setLoadingClaims(false);
    }, (err) => {
      console.error('Error listening to voucher claims:', err);
      setLoadingClaims(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleRedeem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profile) return;

    const code = promoCodeInput.trim().toUpperCase();
    if (!code) {
      toast.error('Please enter a voucher or promo code.', 'Redeem Voucher');
      return;
    }

    setIsRedeeming(true);
    try {
      const res = await redeemPromoCode(code, profile);
      if (res.success) {
        toast.success(res.message, 'Voucher Claimed! 🎉');
        setPromoCodeInput('');
        
        // Update parent profile state
        const updates: Partial<UserAccount> = {};
        if (res.newBalance !== undefined) updates.balance = res.newBalance;
        if (res.newTradeBalance !== undefined) updates.tradeBalance = res.newTradeBalance;
        if (res.newExtraPassUntil !== undefined) updates.extraSignalPassUntil = res.newExtraPassUntil;
        onProfileUpdate(updates);
      } else {
        toast.error(res.message, 'Redemption Failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.', 'Error');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setPromoCodeInput(text.trim().toUpperCase());
          toast.info('Pasted code from clipboard', 'Promo Code');
        }
      }
    } catch (err) {
      console.error('Failed to paste from clipboard:', err);
    }
  };

  const handleCopyCode = (code: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success(`Copied code "${code}" to clipboard!`, 'Copied');
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  // Check extra signal pass validity
  const extraPassInfo = (() => {
    if (!profile?.extraSignalPassUntil) return { active: false, text: 'No active pass' };
    const expDate = profile.extraSignalPassUntil?.toDate ? profile.extraSignalPassUntil.toDate() : new Date(profile.extraSignalPassUntil);
    if (!expDate || isNaN(expDate.getTime())) return { active: false, text: 'No active pass' };
    
    const now = new Date();
    if (expDate <= now) return { active: false, text: 'Expired' };

    const diffMs = expDate.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      active: true,
      text: `${diffHours}h ${diffMins}m remaining`,
      dateStr: expDate.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
  })();

  return (
    <div id="vouchers-view-container" className="space-y-6 max-w-md mx-auto animate-fade-in text-left">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button 
            id="vouchers-back-btn"
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-full bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-900 transition-colors cursor-pointer shadow-sm active:scale-95 shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              <Gift size={20} className="text-amber-600" />
              <span>Vouchers & Rewards</span>
            </h2>
            <p className="text-xs text-zinc-600 font-medium">
              Redeem promotional codes and view active reward passes
            </p>
          </div>
        </div>
      </div>

      {/* Main Promo Code Entry Card */}
      <div className="p-5 sm:p-6 rounded-3xl border border-amber-300/90 bg-white shadow-sm relative overflow-hidden space-y-4">
        {/* Subtle decorative accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5 font-mono">
              <Tag size={13} className="text-amber-600" />
              <span>Redeem Promo Code</span>
            </span>
            <span className="text-[9.5px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              Instant Credit
            </span>
          </div>

          <form onSubmit={handleRedeem} className="space-y-3">
            <div className="relative">
              <input
                id="promo-code-input"
                type="text"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                placeholder="ENTER PROMO CODE (e.g. WELCOME10)"
                maxLength={30}
                className="w-full py-3.5 pl-4 pr-20 rounded-2xl text-sm font-black font-mono tracking-wider transition-all outline-none border bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-inner"
              />
              <button
                type="button"
                onClick={handlePaste}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-zinc-200 hover:bg-zinc-300 text-zinc-800 border border-zinc-300 transition-all cursor-pointer shadow-2xs"
              >
                Paste
              </button>
            </div>

            <button
              id="redeem-code-submit-btn"
              type="submit"
              disabled={isRedeeming || !promoCodeInput.trim()}
              className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRedeeming ? (
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Claim Voucher Reward</span>
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-zinc-500 leading-tight">
            * Promo codes are case-insensitive and can be redeemed once per account.
          </p>
        </div>
      </div>

      {/* Active VIP Passes & Reward Status Overview */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700">
          Your Active Benefits
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {/* Extra Signal VIP Pass Card */}
          <div className={`p-4 rounded-2xl border shadow-xs transition-all ${
            extraPassInfo.active
              ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
              : 'bg-white border-zinc-200 text-zinc-800'
          }`}>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1 font-mono text-zinc-700">
                <Zap size={13} className={extraPassInfo.active ? 'text-emerald-600' : 'text-zinc-500'} />
                <span>Extra Signals</span>
              </span>
              <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded-full border ${
                extraPassInfo.active 
                  ? 'bg-emerald-200/80 text-emerald-900 border-emerald-300' 
                  : 'bg-zinc-100 text-zinc-700 border-zinc-300'
              }`}>
                {extraPassInfo.active ? 'ACTIVE' : 'LOCKED'}
              </span>
            </div>
            <p className="text-xs font-black font-mono text-zinc-900">
              {extraPassInfo.active ? extraPassInfo.text : 'No active pass'}
            </p>
            {extraPassInfo.active && (
              <p className="text-[9.5px] text-emerald-800 font-medium mt-0.5">
                Valid to: {extraPassInfo.dateStr}
              </p>
            )}
          </div>

          {/* Trade Capital Card */}
          <div className="p-4 rounded-2xl border border-amber-200/90 bg-white shadow-xs text-zinc-800">
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1 font-mono text-zinc-700">
                <Coins size={13} className="text-amber-600" />
                <span>Trade Wallet</span>
              </span>
              <span className="text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                USD
              </span>
            </div>
            <p className="text-base font-black font-mono text-zinc-900">
              $ {(profile?.tradeBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[9.5px] text-zinc-500 font-medium mt-0.5 truncate">
              Available for Copy Signals & Bots
            </p>
          </div>
        </div>
      </div>

      {/* Redemption History List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700">
            Redemption History ({claimedVouchers.length})
          </h3>
        </div>

        {loadingClaims ? (
          <div className="py-8 text-center text-xs text-zinc-600 flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading claimed vouchers...</span>
          </div>
        ) : claimedVouchers.length === 0 ? (
          <div className="p-6 rounded-2xl border border-zinc-200 bg-white text-center space-y-2 select-none shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Gift size={20} />
            </div>
            <h4 className="text-xs font-bold text-zinc-800">No vouchers redeemed yet</h4>
            <p className="text-[11px] text-zinc-600 max-w-[260px] mx-auto leading-relaxed">
              Enter a valid promotional code above or participate in community events to earn rewards.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {claimedVouchers.map((claim) => {
              const claimDate = claim.claimedAt?.toDate 
                ? claim.claimedAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : (claim.claimedAt ? new Date(claim.claimedAt).toLocaleDateString() : 'Recently');

              return (
                <div 
                  key={claim.id}
                  className="p-3.5 rounded-2xl border border-zinc-200 bg-white hover:border-amber-300 shadow-xs flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      {claim.type === 'EXTRA_SIGNAL_PASS' ? (
                        <Zap size={16} className="text-amber-600" />
                      ) : claim.type === 'TRADE_CAPITAL' ? (
                        <Coins size={16} className="text-amber-600" />
                      ) : (
                        <Award size={16} className="text-emerald-600" />
                      )}
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black font-mono tracking-wider text-zinc-900">
                          {claim.code}
                        </span>
                        <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                          Redeemed
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-zinc-700 truncate mt-0.5">
                        {claim.rewardText || claim.title}
                      </p>
                      <p className="text-[9.5px] text-zinc-500 font-mono mt-0.5">
                        {claimDate}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {claim.type === 'CASH_BONUS' && (
                      <span className="text-xs font-black font-mono text-emerald-700">
                        +${Number(claim.rewardValue).toFixed(2)}
                      </span>
                    )}
                    {claim.type === 'TRADE_CAPITAL' && (
                      <span className="text-xs font-black font-mono text-amber-800">
                        +${Number(claim.rewardValue).toFixed(2)}
                      </span>
                    )}
                    {claim.type === 'EXTRA_SIGNAL_PASS' && (
                      <span className="text-xs font-black font-mono text-purple-700">
                        +{claim.rewardValue}h VIP
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Community / Promotional Tips Card */}
      <div className="p-4 rounded-2xl border border-amber-200/90 bg-amber-50/80 text-zinc-800 text-xs space-y-2 shadow-xs">
        <div className="flex items-center gap-1.5 font-black text-amber-950 text-xs">
          <Sparkles size={14} className="text-amber-600 shrink-0" />
          <span>How to Get More Promo Codes?</span>
        </div>
        <ul className="text-[11px] space-y-1.5 text-zinc-700 list-disc list-inside leading-relaxed font-medium">
          <li>Join the official Telegram community channel for weekly flash voucher drops.</li>
          <li>Invite active traders: friends who complete deposit milestones unlock bonus passes.</li>
          <li>Participate in holiday trading events and milestone achievements.</li>
        </ul>
      </div>
    </div>
  );
}
