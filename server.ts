import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

// In-memory store for 6-digit registration verification codes
interface OtpEntry {
  code: string;
  email: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  verified: boolean;
}

const otpStore = new Map<string, OtpEntry>();

// Disposable email domains list for server-side verification enforcement
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', '10minutemail.com', '10minutemail.net', 'tempmail.com',
  'temp-mail.org', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamailblock.com', 'sharklasers.com', 'grr.la', 'yopmail.com',
  'yopmail.fr', 'yopmail.net', 'throwawaymail.com', 'getnada.com',
  'dispostable.com', 'fakeinbox.com', 'trashmail.com', 'trashmail.net',
  'trashmail.me', 'crazymailing.com', 'mohmal.com', 'generator.email',
  'emailondeck.com', 'burnermail.io', 'maildrop.cc', 'inboxkitten.com',
  'mytemp.email', 'tempr.email', 'discard.email', 'disposablemail.com',
  'tempail.com', 'nada.ltd'
]);

// Helper to determine the best valid sender address
function getSenderAddress(): string {
  const customFrom = process.env.SMTP_FROM?.trim();
  if (customFrom) {
    if (customFrom.includes('<') && customFrom.includes('>')) {
      return customFrom;
    }
    return `"CME Trading Security" <${customFrom}>`;
  }

  const host = process.env.SMTP_HOST || '';
  const user = process.env.SMTP_USER || '';

  // If using Resend SMTP, default to onboarding@resend.dev if custom from not supplied
  if (host.includes('resend.com') || user.toLowerCase() === 'resend') {
    return `"CME Trading Security" <onboarding@resend.dev>`;
  }

  // If SMTP user is a valid email, use that
  if (user.includes('@')) {
    return `"CME Trading Security" <${user}>`;
  }

  return `"CME Trading Security" <noreply@cme-trading.org>`;
}

// Helper to configure nodemailer transporter from environment variables
function getMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  return null;
}

// Clean up expired OTP entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of otpStore.entries()) {
    if (now > val.expiresAt) {
      otpStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Initialize Google Gen AI client with telemetry user agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase body size limits for base64 image uploads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // API endpoint for sending 6-digit registration OTP email
  app.post("/api/send-email-otp", async (req, res) => {
    try {
      const { email, displayName } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: "A valid email address is required." });
      }

      const cleanEmail = email.trim().toLowerCase();

      // Email format regex validation
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: "Invalid email format. Please check for typos." });
      }

      // Check disposable domains
      const domain = cleanEmail.split('@')[1];
      if (domain && DISPOSABLE_DOMAINS.has(domain)) {
        return res.status(400).json({ 
          error: "Disposable and temporary email addresses are not allowed. Please use your genuine personal or business email." 
        });
      }

      // Rate limit check: at least 30 seconds cooldown between OTP resends
      const existing = otpStore.get(cleanEmail);
      const now = Date.now();
      if (existing && now - existing.lastSentAt < 30 * 1000) {
        const remainingSec = Math.ceil((30 * 1000 - (now - existing.lastSentAt)) / 1000);
        return res.status(429).json({ 
          error: `Please wait ${remainingSec} seconds before requesting a new verification code.` 
        });
      }

      // Use provided 6-digit code or generate a secure new one
      const providedCode = req.body?.code?.toString().trim();
      const otpCode = (providedCode && /^\d{6}$/.test(providedCode))
        ? providedCode
        : Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = now + 10 * 60 * 1000; // 10 minutes expiry

      otpStore.set(cleanEmail, {
        code: otpCode,
        email: cleanEmail,
        expiresAt,
        attempts: 0,
        lastSentAt: now,
        verified: false,
      });

      console.log(`[CME Trading Security] 6-digit OTP code for ${cleanEmail}: ${otpCode}`);

      // Attempt to send real email via configured SMTP
      const transporter = getMailTransporter();
      if (transporter) {
        const fromAddress = getSenderAddress();
        const replyToAddress = process.env.SMTP_REPLY_TO?.trim() || 
          (fromAddress.includes('<') ? fromAddress.match(/<([^>]+)>/)?.[1] || fromAddress : fromAddress);
        const greetingName = displayName ? displayName.trim() : "Valued Trader";

        const htmlTemplate = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="format-detection" content="telephone=no"/>
  <title>${otpCode} is your CME Trading verification code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Anti-spam Inbox Preheader snippet -->
  <div style="display: none; font-size: 1px; color: #f8fafc; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    Your CME Trading verification code is ${otpCode}. Valid for 10 minutes.
    &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f8fafc; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.04);">
          
          <!-- Header Branding -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px 32px 16px 32px; border-bottom: 1px solid #f1f5f9;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <div style="display: inline-block; background-color: #008B47; color: #ffffff; font-weight: 900; font-size: 14px; letter-spacing: 1.2px; padding: 6px 14px; border-radius: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      CME TRADING
                    </div>
                  </td>
                  <td align="right">
                    <span style="font-size: 12px; color: #64748b; font-weight: 500;">
                      Security Verification
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; line-height: 1.3;">
                Confirm your email address
              </h1>
              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 24px 0;">
                Hello <strong>${greetingName}</strong>,<br/>
                Please use the one-time verification code below to complete your registration for CME Trading.
              </p>

              <!-- OTP Code Display Card -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0 24px 0;">
                <tr>
                  <td align="center" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px 16px;">
                    <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 40px; font-weight: 800; letter-spacing: 10px; color: #007038; line-height: 1; text-align: center;">
                      ${otpCode}
                    </div>
                    <div style="font-size: 11px; color: #166534; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 10px;">
                      Expires in 10 minutes &bull; One-time passcode
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin: 0 0 12px 0;">
                Never share this code with anyone. CME Trading staff will never ask you for your verification code.
              </p>
              <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 0;">
                If you did not request this verification code, you can safely disregard this email. No account has been created yet.
              </p>
            </td>
          </tr>

          <!-- Compliance & Trust Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
              <p style="font-size: 11px; color: #64748b; margin: 0 0 6px 0; line-height: 1.5;">
                This message was sent to <strong style="color: #334155;">${cleanEmail}</strong> regarding your registration request.
              </p>
              <p style="font-size: 10px; color: #94a3b8; margin: 0; line-height: 1.4;">
                CME Trading Services &bull; 20 S Wacker Dr, Chicago, IL 60606 &bull; Automated Security Notification
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const isResend = Boolean(
          (process.env.SMTP_HOST && process.env.SMTP_HOST.includes('resend.com')) ||
          (process.env.SMTP_USER && process.env.SMTP_USER.toLowerCase() === 'resend')
        );
        const fromRaw = process.env.SMTP_FROM || '';
        const isResendSandbox = isResend && (!fromRaw || fromRaw.includes('resend.dev'));

        try {
          await transporter.sendMail({
            from: fromAddress,
            to: cleanEmail,
            replyTo: replyToAddress,
            subject: `${otpCode} is your CME Trading verification code`,
            text: `Hello ${greetingName},\n\nYour one-time verification code is: ${otpCode}\n\nThis verification code expires in 10 minutes.\n\nNever share this code with anyone. CME Trading representatives will never ask you for this code.\n\nIf you did not request this code, you can safely ignore this email.\n\nBest regards,\nCME Trading Security\n20 S Wacker Dr, Chicago, IL 60606`,
            html: htmlTemplate,
            headers: {
              'Auto-Submitted': 'auto-generated',
              'X-Auto-Response-Suppress': 'All',
            },
          });

          console.log(`[CME Trading Security] Verification email sent to ${cleanEmail} via SMTP. (Resend: ${isResend}, Sandbox: ${isResendSandbox})`);

          return res.json({
            success: true,
            previewMode: isResendSandbox,
            previewCode: isResendSandbox ? otpCode : undefined,
            resendSandbox: isResendSandbox,
            message: isResendSandbox
              ? `Verification code dispatched via Resend sandbox. Note: Resend test domain (onboarding@resend.dev) restricts delivery to the account owner's email until you verify your domain at resend.com/domains.`
              : `Verification code sent to ${cleanEmail}. Please check your inbox and Spam/Junk folder.`,
          });
        } catch (mailErr: any) {
          console.error("[SMTP Error] Failed to send email via SMTP:", mailErr);
          // Fall back to preview response if SMTP fails
          return res.json({
            success: true,
            previewMode: true,
            previewCode: otpCode,
            message: `Verification code generated for ${cleanEmail} (SMTP unavailable: code is ${otpCode})`,
          });
        }
      }

      // Preview / development mode when no SMTP credentials are configured
      return res.json({
        success: true,
        previewMode: true,
        previewCode: otpCode,
        message: `Verification code sent to ${cleanEmail}`,
      });
    } catch (error: any) {
      console.error("Error sending email OTP:", error);
      res.status(500).json({ error: "Failed to dispatch verification code. Please try again." });
    }
  });

  // API endpoint for verifying 6-digit registration OTP
  app.post("/api/verify-email-otp", (req, res) => {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ error: "Email and verification code are required." });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = code.toString().trim();

      const entry = otpStore.get(cleanEmail);

      if (!entry) {
        return res.status(400).json({ 
          error: "No active verification code found for this email. Please request a new code." 
        });
      }

      const now = Date.now();
      if (now > entry.expiresAt) {
        otpStore.delete(cleanEmail);
        return res.status(400).json({ 
          error: "Verification code has expired. Please request a new code." 
        });
      }

      if (entry.attempts >= 5) {
        otpStore.delete(cleanEmail);
        return res.status(400).json({ 
          error: "Too many incorrect attempts. Please request a new verification code." 
        });
      }

      if (entry.code !== cleanCode) {
        entry.attempts += 1;
        const attemptsLeft = 5 - entry.attempts;
        return res.status(400).json({ 
          error: `Incorrect verification code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.` 
        });
      }

      // Verification successful
      entry.verified = true;
      res.json({
        success: true,
        verified: true,
        message: "Email address verified successfully!"
      });
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ error: "Failed to verify code. Please try again." });
    }
  });

  // API endpoint for validating payment receipt images
  app.post("/api/verify-receipt", async (req, res) => {
    try {
      const { image, type, expectedAmount, expectedSymbol } = req.body;

      if (!image) {
        return res.status(400).json({ error: "No proof image provided" });
      }

      // Extract raw base64 data and mime type from data URI (e.g. data:image/png;base64,...)
      const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      let mimeType = "image/png";
      let base64Data = image;

      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      }

      const prompt = `You are an automated risk compliance auditor. Your job is to analyze this uploaded receipt screenshot and verify if it represents a valid, legitimate transaction confirmation.
      
      Auditing Task details:
      - Transaction Category: ${type === "crypto" ? "Cryptocurrency Transfer Proof (Blockchain confirmation, TxHash, wallet success screen)" : "Fiat/P2P Mobile Money Receipt"}
      - Expected Amount to verify: ${expectedAmount || "Any"} ${expectedSymbol || ""}
      
      Look for:
      1. Legitimate platform elements (M-Pesa, MTN, standard bank notification, Binance, TrustWallet, MetaMask, TronScan, etc.).
      2. Status indicating success (e.g., "COMPLETED", "SUCCESS", "APPROVED", "DELIVERED", "TxHash verified", "Transfer Successful").
      3. Signs of fake, empty, placeholder, black, or completely unrelated screenshots (e.g., a photo of a person, animal, random meme, desktop background).
      4. Extracted transaction details (TxHash/RefID, Amount, Currency, and Network).
      
      Analyze the receipt image carefully. Be reasonably forgiving of simple compression, but strict against totally unrelated or empty images.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          {
            text: prompt
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isValid: {
                type: Type.BOOLEAN,
                description: "True if this is a genuine transaction confirmation/receipt screenshot, even if there are details missing. False if it is a completely unrelated, blank, black, fake, or corrupted image."
              },
              confidence: {
                type: Type.INTEGER,
                description: "Confidence rating of the analysis from 0 to 100."
              },
              extractedAmount: {
                type: Type.NUMBER,
                description: "The amount found on the receipt. Return null if none is found."
              },
              extractedSymbol: {
                type: Type.STRING,
                description: "The coin symbol or currency symbol (e.g. 'USDT', 'USDC', 'BTC', 'UGX', 'KES') found on the receipt. Return null if none is found."
              },
              extractedTxHash: {
                type: Type.STRING,
                description: "The transaction hash, reference ID, or transaction ID found on the receipt. Return null if none is found."
              },
              extractedNetwork: {
                type: Type.STRING,
                description: "The blockchain network (e.g., TRC20, ERC20, BEP20) or payment operator found. Return null if none."
              },
              reasons: {
                type: Type.STRING,
                description: "A short, professional single-sentence explanation of what was found or why it is marked valid/invalid."
              }
            },
            required: ["isValid", "confidence", "reasons"]
          }
        }
      });

      const responseText = response.text || "{}";
      const result = JSON.parse(responseText.trim());

      res.json(result);
    } catch (error: any) {
      console.error("Error in verify-receipt endpoint:", error);
      res.status(500).json({ 
        error: "Failed to audit the proof image.", 
        details: error.message || error 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
