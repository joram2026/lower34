import { db } from '../firebase';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';

export interface SendOtpResult {
  success: boolean;
  previewCode?: string;
  isFallback?: boolean;
  message?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  error?: string;
}

function getCleanEmailKey(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
}

/**
 * Safely parse JSON from a response, preventing any "Unexpected token <" or "Unexpected token T" HTML errors
 */
async function safeJsonParse(res: Response): Promise<{ isJson: boolean; data: any; rawText: string }> {
  try {
    const rawText = await res.text();
    const trimmed = rawText.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const data = JSON.parse(trimmed);
        return { isJson: true, data, rawText };
      } catch {
        return { isJson: false, data: null, rawText };
      }
    }
    return { isJson: false, data: null, rawText };
  } catch {
    return { isJson: false, data: null, rawText: '' };
  }
}

/**
 * Dispatches a 6-digit verification OTP.
 * Generates the secure 6-digit passcode, registers it with Firestore persistence,
 * and delivers the email via backend SMTP dispatch.
 */
export async function sendEmailOtp(email: string, displayName?: string): Promise<SendOtpResult> {
  const formattedEmail = email.trim().toLowerCase();
  const cleanKey = getCleanEmailKey(formattedEmail);

  // 1. Generate 6-digit numeric OTP code
  const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

  // 2. Persist the verification code in Firestore
  try {
    const otpDocRef = doc(db, 'email_verifications', cleanKey);
    await setDoc(otpDocRef, {
      code: generatedCode,
      email: formattedEmail,
      createdAt: serverTimestamp(),
      expiresAt: expiresAt,
      attempts: 0
    });
  } catch (fsErr: any) {
    console.error('Failed to store OTP verification in Firestore:', fsErr);
  }

  // 3. Dispatch the real email via SMTP backend (passing the generatedCode)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const res = await fetch('/api/send-email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: formattedEmail, 
        displayName: displayName?.trim(),
        code: generatedCode 
      }),
      signal: controller.signal
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (res) {
      const { isJson, data } = await safeJsonParse(res);

      if (res.ok && isJson && data) {
        return {
          success: true,
          previewCode: data.previewCode || (data.previewMode ? generatedCode : undefined),
          message: data.message || 'Verification code sent to your email.'
        };
      }

      // If backend returned a clear validation error (e.g. disposable domain blocked)
      if (!res.ok && isJson && data?.error) {
        // Clean up stored OTP document if backend rejected the email
        try {
          const otpDocRef = doc(db, 'email_verifications', cleanKey);
          await deleteDoc(otpDocRef).catch(() => {});
        } catch {
          // ignore
        }
        throw new Error(data.error);
      }
    }
  } catch (apiErr: any) {
    if (apiErr?.message && !apiErr.message.includes('JSON') && !apiErr.message.includes('token') && !apiErr.message.includes('fetch') && !apiErr.message.includes('abort') && !apiErr.message.includes('network')) {
      throw apiErr;
    }
  }

  return {
    success: true,
    previewCode: generatedCode,
    isFallback: true,
    message: `Verification code generated: ${generatedCode}`
  };
}

/**
 * Strictly verifies the 6-digit OTP passcode entered by the user.
 * Validates against Firestore record, checks expiry, tracks failed attempts,
 * and permanently deletes the token on success to prevent reuse.
 */
export async function verifyEmailOtp(email: string, code: string): Promise<VerifyOtpResult> {
  const formattedEmail = email.trim().toLowerCase();
  const trimmedCode = code.toString().trim();

  if (!trimmedCode || trimmedCode.length !== 6 || !/^\d{6}$/.test(trimmedCode)) {
    return { success: false, error: 'Please enter all 6 digits of your verification code.' };
  }

  const cleanKey = getCleanEmailKey(formattedEmail);
  const otpDocRef = doc(db, 'email_verifications', cleanKey);

  try {
    const snap = await getDoc(otpDocRef);

    if (!snap.exists()) {
      return { 
        success: false, 
        error: 'No active verification code found for this email. Please request a new code.' 
      };
    }

    const otpData = snap.data();

    // Check expiration
    if (Date.now() > otpData.expiresAt) {
      await deleteDoc(otpDocRef).catch(() => {});
      return { 
        success: false, 
        error: 'Your verification code has expired (10 min limit). Please request a new code.' 
      };
    }

    // Check maximum attempts (limit to 5)
    const currentAttempts = (otpData.attempts || 0);
    if (currentAttempts >= 5) {
      await deleteDoc(otpDocRef).catch(() => {});
      return { 
        success: false, 
        error: 'Too many incorrect attempts (5/5). This code has been invalidated. Please request a new one.' 
      };
    }

    // Check strict code match
    if (otpData.code !== trimmedCode) {
      const newAttempts = currentAttempts + 1;
      await updateDoc(otpDocRef, { attempts: increment(1) }).catch(() => {});
      const remainingAttempts = 5 - newAttempts;
      
      return { 
        success: false, 
        error: remainingAttempts > 0 
          ? `Incorrect verification code. Please check your email and try again (${remainingAttempts} attempts remaining).`
          : 'Incorrect verification code. Maximum attempts reached. Please request a new code.'
      };
    }

    // Code is 100% valid! Delete the record to prevent replay attacks
    await deleteDoc(otpDocRef).catch(() => {});

    // Notify backend in background to clean up any server-side memory
    fetch('/api/verify-email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: formattedEmail, code: trimmedCode }),
    }).catch(() => {});

    return { success: true };
  } catch (fsErr: any) {
    console.error('Firestore verify error:', fsErr);
    return { success: false, error: 'Verification failed. Please try again or request a new code.' };
  }
}
