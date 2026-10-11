/**
 * Brevo (Sendinblue) Transactional Email Service
 * Uses Brevo's v3 REST API with native Node.js fetch
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Send transactional email using Brevo REST API
 * Falls back to console log preview if BREVO_API_KEY is not configured
 */
const sendEmail = async ({ to, toName, subject, htmlContent, textContent }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@pau.edu.tr';
  const senderName = process.env.BREVO_SENDER_NAME || 'GDG On Campus Pamukkale University';

  // Development Fallback: If Brevo API key is not yet provided, log email preview to console
  if (!apiKey || apiKey === 'your_brevo_api_key_here') {
    console.log('\n=============================================================');
    console.log('📨 [BREVO EMAIL SIMULATOR - API Key Not Configured]');
    console.log(` To:      ${to}`);
    console.log(` Subject: ${subject}`);
    if (textContent) console.log(` Content: ${textContent}`);
    console.log(' (Gerçek e-posta gönderimi için .env dosyasına BREVO_API_KEY ekleyin)');
    console.log('=============================================================\n');
    return { success: true, simulated: true };
  }

  try {
    const payload = {
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [
        {
          email: to,
          ...(toName && { name: toName })
        }
      ],
      subject,
      htmlContent,
      ...(textContent && { textContent }),
      ...(process.env.BREVO_REPLY_TO && {
        replyTo: { email: process.env.BREVO_REPLY_TO }
      })
    };

    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Brevo Error]', response.status, errorData);
      throw new Error(errorData.message || `Brevo API e-posta gönderimi başarısız oldu (HTTP ${response.status}).`);
    }

    const data = await response.json();
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error('[Email Service Error]', error.message);
    throw error;
  }
};

/**
 * Generate a beautifully styled HTML template for OTP emails
 */
const generateOtpTemplate = ({ title, preheader, greeting, message, code, footerNote }) => {
  return `
  <!DOCTYPE html>
  <html lang="tr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8f9fa; margin: 0; padding: 20px; color: #202124; }
      .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e8eaed; }
      .header { background: #ffffff; padding: 28px 32px 20px; border-bottom: 2px solid #f1f3f4; text-align: left; }
      .brand-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; }
      .content { padding: 32px; }
      .otp-box { background: #e8f0fe; border: 1px dashed #4285f4; border-radius: 10px; padding: 20px; text-align: center; margin: 28px 0; }
      .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1a73e8; font-family: monospace; }
      .timer { font-size: 13px; color: #5f6368; margin-top: 8px; }
      .footer { background: #f8f9fa; padding: 20px 32px; font-size: 12px; color: #70757a; text-align: center; border-top: 1px solid #e8eaed; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <span style="font-size: 20px; font-weight: 700; color: #202124;">
          <span class="brand-dot" style="background:#4285F4;"></span>
          <span class="brand-dot" style="background:#EA4335;"></span>
          <span class="brand-dot" style="background:#FBBC05;"></span>
          <span class="brand-dot" style="background:#34A853;"></span>
          GDG On Campus <span style="color:#4285f4;">Pamukkale</span>
        </span>
      </div>
      <div class="content">
        <h2 style="margin-top:0; color:#202124; font-size:20px;">${title}</h2>
        <p style="font-size:15px; line-height:1.6; color:#3c4043;">Merhaba <strong>${greeting}</strong>,</p>
        <p style="font-size:15px; line-height:1.6; color:#3c4043;">${message}</p>
        
        <div class="otp-box">
          <div style="font-size:12px; color:#5f6368; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Doğrulama Kodunuz</div>
          <div class="otp-code">${code}</div>
          <div class="timer">⏱️ Bu kod <strong>10 dakika</strong> boyunca geçerlidir.</div>
        </div>

        <p style="font-size:13px; color:#5f6368; line-height:1.5;">${footerNote || 'Bu işlemi siz yapmadıysanız, lütfen bu e-postayı dikkate almayınız. Güvenliğiniz için bu kodu kimseyle paylaşmayınız.'}</p>
      </div>
      <div class="footer">
        Google Developer Groups on Campus • Pamukkale University<br>
        Denizli, Türkiye • Bu e-posta otomatik olarak gönderilmiştir.
      </div>
    </div>
  </body>
  </html>
  `;
};

/**
 * Send 2FA / Verification code for Core Team Registration
 */
const sendRegistrationOtpEmail = async ({ email, fullName, code }) => {
  const htmlContent = generateOtpTemplate({
    title: 'Core Team Kayıt Doğrulama Kodu',
    greeting: fullName || 'Ekip Arkadaşımız',
    message: 'GDG On Campus Pamukkale University Core Team üyelik başvurunuzu tamamlamak için lütfen aşağıdaki 6 haneli doğrulama kodunu giriniz.',
    code,
    footerNote: 'Kodunuz onaylandıktan sonra hesabınız Core Team yöneticisinin onayına sunulacaktır.'
  });

  return sendEmail({
    to: email,
    toName: fullName,
    subject: `🔐 ${code} - GDG Core Team Kayıt Doğrulama Kodunuz`,
    htmlContent,
    textContent: `GDG On Campus Pamukkale Core Team doğrulama kodunuz: ${code} (10 dakika geçerlidir).`
  });
};

/**
 * Send Email Verification code for Hackathon Application
 */
const sendHackathonOtpEmail = async ({ email, leaderName, teamName, code }) => {
  const htmlContent = generateOtpTemplate({
    title: 'Pamukkale Hackathon 2026 Başvuru Doğrulama Kodu',
    greeting: leaderName || 'Takım Lideri',
    message: `<strong>${teamName ? `"${teamName}"` : 'Takımınız'}</strong> adına yapılan Pamukkale Hackathon 2026 başvurusunu onaylamak için lütfen aşağıdaki doğrulama kodunu başvuru formuna giriniz.`,
    code,
    footerNote: 'Bu kod girilmeden hackathon başvurusu sisteme kaydedilmeyecektir.'
  });

  return sendEmail({
    to: email,
    toName: leaderName,
    subject: `🚀 ${code} - Pamukkale Hackathon Başvuru Doğrulama Kodunuz`,
    htmlContent,
    textContent: `Pamukkale Hackathon başvuru doğrulama kodunuz: ${code} (10 dakika geçerlidir).`
  });
};

module.exports = {
  sendEmail,
  sendRegistrationOtpEmail,
  sendHackathonOtpEmail
};

