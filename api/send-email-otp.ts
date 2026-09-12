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
        tls: { rejectUnauthorized: false },
      });

      let fromAddress: string;
      const customFrom = process.env.SMTP_FROM?.trim();
      if (customFrom) {
        fromAddress = (customFrom.includes('<') && customFrom.includes('>'))
          ? customFrom
          : `"CME Trading Security" <${customFrom}>`;
      } else if (smtpHost.includes('resend.com') || smtpUser.toLowerCase() === 'resend') {
        fromAddress = `"CME Trading Security" <onboarding@resend.dev>`;
      } else if (smtpUser.includes('@')) {
        fromAddress = `"CME Trading Security" <${smtpUser}>`;
      } else {
        fromAddress = `"CME Trading Security" <noreply@cme-trading.org>`;
      }

      const replyToAddress = process.env.SMTP_REPLY_TO?.trim() || 
        (fromAddress.includes('<') ? fromAddress.match(/<([^>]+)>/)?.[1] || fromAddress : fromAddress);

      const isResend = Boolean(
        smtpHost.includes('resend.com') || smtpUser.toLowerCase() === 'resend'
      );
      const isResendSandbox = isResend && (!customFrom || customFrom.includes('resend.dev'));

      const htmlTemplate = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="format-detection" content="telephone=no"/>
  <title>${code} is your CME Trading verification code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Anti-spam Inbox Preheader snippet -->
  <div style="display: none; font-size: 1px; color: #f8fafc; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    Your CME Trading verification code is ${code}. Valid for 10 minutes.
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
                Hello <strong>${displayName}</strong>,<br/>
                Please use the one-time verification code below to complete your registration for CME Trading.
              </p>

              <!-- OTP Code Display Card -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0 24px 0;">
                <tr>
                  <td align="center" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px 16px;">
                    <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 40px; font-weight: 800; letter-spacing: 10px; color: #007038; line-height: 1; text-align: center;">
                      ${code}
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
                This message was sent to <strong style="color: #334155;">${email}</strong> regarding your registration request.
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

      await transporter.sendMail({
        from: fromAddress,
        to: email,
        replyTo: replyToAddress,
        subject: `${code} is your CME Trading verification code`,
        text: `Hello ${displayName},\n\nYour one-time verification code is: ${code}\n\nThis verification code expires in 10 minutes.\n\nNever share this code with anyone. CME Trading representatives will never ask you for this code.\n\nIf you did not request this code, you can safely ignore this email.\n\nBest regards,\nCME Trading Security\n20 S Wacker Dr, Chicago, IL 60606`,
        headers: {
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'All',
        },
        html: htmlTemplate,
      });

      return res.status(200).json({ 
        success: true, 
        previewMode: isResendSandbox,
        previewCode: isResendSandbox ? code : undefined,
        resendSandbox: isResendSandbox,
        message: isResendSandbox
          ? 'Verification code dispatched via Resend sandbox (test domain delivers to account owner only).'
          : 'Verification email sent. Please check inbox and Spam/Junk folder.' 
      });
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
