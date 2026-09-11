import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  writeBatch, 
  serverTimestamp,
  arrayUnion,
  increment,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { PromoCode, PromoCodeRewardType, UserAccount, VoucherClaim, Transaction } from '../types';

export interface RedemptionResult {
  success: boolean;
  message: string;
  promoCode?: PromoCode;
  rewardType?: PromoCodeRewardType;
  rewardValue?: number;
  newBalance?: number;
  newTradeBalance?: number;
  newExtraPassUntil?: string;
}

/**
 * Seed initial starter promo codes if collection is empty
 */
export async function seedDefaultPromoCodesIfEmpty(): Promise<void> {
  try {
    const promoCol = collection(db, 'promo_codes');
    const snap = await getDocs(promoCol);
    if (snap.empty) {
      const defaults: Omit<PromoCode, 'id'>[] = [
        {
          code: 'WELCOME10',
          title: 'Welcome $10 Bonus Voucher',
          description: 'Instant $10 cash bonus credited to your main USD wallet balance.',
          type: 'CASH_BONUS',
          rewardValue: 10,
          minDepositRequirement: 0,
          maxRedemptions: 500,
          redemptionCount: 0,
          claimedBy: [],
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          code: 'EXTRAVIP',
          title: '48h VIP Extra Signal Pass',
          description: 'Unlocks 48 continuous hours of high-yield Extra Signals on all expert copy traders.',
          type: 'EXTRA_SIGNAL_PASS',
          rewardValue: 48,
          minDepositRequirement: 0,
          maxRedemptions: 1000,
          redemptionCount: 0,
          claimedBy: [],
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          code: 'TRADEBOOST25',
          title: '$25 Copy & Bot Trading Capital',
          description: 'Instant $25 trading capital credited to your Copy Trading and Bot balance.',
          type: 'TRADE_CAPITAL',
          rewardValue: 25,
          minDepositRequirement: 0,
          maxRedemptions: 500,
          redemptionCount: 0,
          claimedBy: [],
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      ];

      for (const item of defaults) {
        const newDocRef = doc(promoCol);
        await setDoc(newDocRef, { ...item, id: newDocRef.id });
      }
    }
  } catch (err) {
    console.error('Error seeding default promo codes:', err);
  }
}

/**
 * Validates and redeems a promo code for a given user
 */
export async function redeemPromoCode(
  rawCode: string, 
  user: UserAccount
): Promise<RedemptionResult> {
  const cleanCode = (rawCode || '').trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, message: 'Please enter a valid promo code.' };
  }

  try {
    // 1. Fetch promo code by code string
    const promoCol = collection(db, 'promo_codes');
    const q = query(promoCol, where('code', '==', cleanCode));
    const snap = await getDocs(q);

    if (snap.empty) {
      return { success: false, message: `Promo code "${cleanCode}" is invalid or does not exist.` };
    }

    const promoDoc = snap.docs[0];
    const promo = { id: promoDoc.id, ...promoDoc.data() } as PromoCode;

    // 2. Validate status
    if (!promo.isActive) {
      return { success: false, message: `Promo code "${cleanCode}" is no longer active.` };
    }

    // 3. Validate expiration
    if (promo.expiresAt) {
      const expDate = promo.expiresAt?.toDate ? promo.expiresAt.toDate() : new Date(promo.expiresAt);
      if (expDate && !isNaN(expDate.getTime()) && expDate < new Date()) {
        return { success: false, message: `Promo code "${cleanCode}" expired on ${expDate.toLocaleDateString()}.` };
      }
    }

    // 4. Validate max redemptions
    if (promo.maxRedemptions && promo.maxRedemptions > 0 && promo.redemptionCount >= promo.maxRedemptions) {
      return { success: false, message: `Promo code "${cleanCode}" has reached its maximum global claim limit.` };
    }

    // 5. Validate user has not already claimed this code
    const claimedList = promo.claimedBy || [];
    if (claimedList.includes(user.uid)) {
      return { success: false, message: `You have already claimed promo code "${cleanCode}". Each user can only redeem once.` };
    }

    // 6. Check min deposit requirement if configured
    if (promo.minDepositRequirement && promo.minDepositRequirement > 0) {
      if (!user.hasMadeFirstDeposit) {
        return { 
          success: false, 
          message: `This promo code requires a minimum deposit of $${promo.minDepositRequirement}. Please make a deposit first to unlock.` 
        };
      }
    }

    // 7. Execute redemption updates
    const batch = writeBatch(db);

    // Update promo code doc: increment count and add user.uid to claimedBy
    const promoRef = doc(db, 'promo_codes', promo.id);
    batch.update(promoRef, {
      redemptionCount: increment(1),
      claimedBy: arrayUnion(user.uid),
      updatedAt: serverTimestamp()
    });

    // Record voucher claim log
    const claimCol = collection(db, 'user_voucher_claims');
    const newClaimRef = doc(claimCol);
    let rewardText = '';
    const userRef = doc(db, 'users', user.uid);
    const userUpdates: Record<string, any> = {};

    let newBalance = user.balance || 0;
    let newTradeBalance = user.tradeBalance || 0;
    let newExtraPassUntil: string | undefined;

    if (promo.type === 'CASH_BONUS') {
      const amount = Number(promo.rewardValue) || 0;
      newBalance = (user.balance || 0) + amount;
      userUpdates.balance = increment(amount);
      userUpdates.usdtBalance = increment(amount);
      rewardText = `$${amount.toFixed(2)} USD added to Main Balance`;

      // Log transaction record for user history
      const txCol = collection(db, 'transactions');
      const newTxRef = doc(txCol);
      batch.set(newTxRef, {
        id: newTxRef.id,
        userId: user.uid,
        userEmail: user.email,
        title: 'Voucher Reward',
        type: 'voucher_reward',
        amount: amount,
        isCredit: true,
        status: 'APPROVED',
        network: 'SYSTEM VOUCHER',
        paymentMessage: `Promo Code Reward: ${promo.code} (${promo.title})`,
        evidence: `Voucher Code: ${promo.code}`,
        createdAt: serverTimestamp()
      });
    } else if (promo.type === 'TRADE_CAPITAL') {
      const amount = Number(promo.rewardValue) || 0;
      newTradeBalance = (user.tradeBalance || 0) + amount;
      userUpdates.tradeBalance = increment(amount);
      rewardText = `$${amount.toFixed(2)} USD added to Copy & Bot Trade Balance`;

      // Log transaction record
      const txCol = collection(db, 'transactions');
      const newTxRef = doc(txCol);
      batch.set(newTxRef, {
        id: newTxRef.id,
        userId: user.uid,
        userEmail: user.email,
        title: 'Trade Capital Voucher',
        type: 'voucher_reward',
        amount: amount,
        isCredit: true,
        status: 'APPROVED',
        network: 'TRADE WALLET',
        paymentMessage: `Trade Capital Voucher: ${promo.code} (${promo.title})`,
        evidence: `Voucher Code: ${promo.code}`,
        createdAt: serverTimestamp()
      });
    } else if (promo.type === 'EXTRA_SIGNAL_PASS') {
      const hours = Number(promo.rewardValue) || 24;
      const now = new Date();
      let currentPassEnd: Date | null = null;
      if (user.extraSignalPassUntil) {
        const parsed = user.extraSignalPassUntil?.toDate ? user.extraSignalPassUntil.toDate() : new Date(user.extraSignalPassUntil);
        if (parsed && !isNaN(parsed.getTime()) && parsed > now) {
          currentPassEnd = parsed;
        }
      }

      const baseDate = currentPassEnd || now;
      const newExpiry = new Date(baseDate.getTime() + hours * 60 * 60 * 1000);
      newExtraPassUntil = newExpiry.toISOString();
      userUpdates.extraSignalPassUntil = newExtraPassUntil;
      rewardText = `Unlocked ${hours}h of Extra Signals (Valid until ${newExpiry.toLocaleDateString()} ${newExpiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    } else {
      // General or percent deposit boost
      rewardText = `${promo.title} activated successfully`;
    }

    batch.update(userRef, userUpdates);

    batch.set(newClaimRef, {
      id: newClaimRef.id,
      userId: user.uid,
      userEmail: user.email,
      promoCodeId: promo.id,
      code: promo.code,
      title: promo.title,
      type: promo.type,
      rewardValue: promo.rewardValue,
      rewardText: rewardText,
      claimedAt: serverTimestamp()
    });

    await batch.commit();

    return {
      success: true,
      message: `Congratulations! Successfully redeemed "${promo.code}": ${rewardText}.`,
      promoCode: promo,
      rewardType: promo.type,
      rewardValue: promo.rewardValue,
      newBalance,
      newTradeBalance,
      newExtraPassUntil
    };
  } catch (err: any) {
    console.error('Error redeeming promo code:', err);
    return {
      success: false,
      message: 'Failed to redeem promo code: ' + (err.message || 'Unknown error occurred.')
    };
  }
}
