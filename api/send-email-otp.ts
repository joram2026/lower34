import nodemailer from 'nodemailer';

// In-memory OTP store with 10-minute expiry
interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
}
const otpStore = new Map<string, OtpRecord>();

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // use as is
      }
    }

    const email = body?.email?.toString().trim().toLowerCase();
    const displayName = body?.displayName?.toString().trim() || 'Valued Trader';
    const providedCode = body?.code?.toString().trim();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    // Use provided 6-digit code or generate a secure new one
    let code = (providedCode && /^\d{6}$/.test(providedCode)) 
      ? providedCode 
      : Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(email, { code, expiresAt, attempts: 0 });

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Morex Security" <${smtpUser}>`,
        to: email,
        subject: `Your Morex Verification Code: ${code}`,
        text: `Hello ${displayName},\n\nYour 6-digit email verification code is: ${code}\n\nThis passcode expires in 10 minutes.\n\nBest regards,\nMorex Security Team`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 20px; background-color: #fcfbf7; border: 1px solid #f0ede4; border-radius: 20px; color: #1c1917;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); padding: 12px 20px; border-radius: 14px; color: #ffffff; font-weight: 900; font-size: 18px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.25);">
                MOREX HOLDINGS
              </div>
              <p style="color: #78716c; font-size: 12px; margin-top: 8px; font-weight: 500;">Secure Arbitrage & Yield Ecosystem</p>
            </div>

            <div style="background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 16px; padding: 28px 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);">
              <h2 style="font-size: 20px; font-weight: 800; color: #0c0a09; margin-top: 0; margin-bottom: 12px;">Verify your email address</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #44403c; margin-bottom: 24px;">
                Hello <strong>${displayName}</strong>,<br>
                Thank you for joining Morex Holdings. To complete your registration and protect your account, please enter the one-time verification passcode below:
              </p>

              <div style="text-align: center; margin: 28px 0; background: #fffbeb; border: 2px dashed #f59e0b; border-radius: 14px; padding: 18px;">
                <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #b45309; display: block;">
                  ${code}
                </span>
                <span style="font-size: 11px; color: #a16207; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; display: block;">
                  Valid for 10 minutes • Do not share
                </span>
              </div>

              <p style="font-size: 12px; line-height: 1.5; color: #78716c; margin-bottom: 0;">
                If you did not request this verification code, please ignore this email. No account will be created without this passcode.
              </p>
            </div>

            <div style="text-align: center; margin-top: 24px; font-size: 11px; color: #a8a29e;">
              © ${new Date().getFullYear()} Morex Holdings Ltd. All rights reserved. Automated security notification.
            </div>
          </div>
        `,
      });

      return res.status(200).json({ success: true, message: 'Verification email sent.' });
    }

    // Preview / Development fallback
    return res.status(200).json({
      success: true,
      previewMode: true,
      previewCode: code,
      message: 'Verification code generated.'
    });
  } catch (err: any) {
    console.error('Serverless send OTP error:', err);
    return res.status(500).json({ error: 'Failed to dispatch verification code.' });
  }
}
