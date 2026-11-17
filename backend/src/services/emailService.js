/**
 * Brevo (Sendinblue) Transactional Email Service
 * Uses Brevo's v3 REST API with native Node.js fetch
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Code-level sender & reply-to profile routing.
 * Environment variables always work as defaults; specific mail flows can override
 * sender / replyTo either here by profile name or per-call via parameters.
 */
const getEmailProfile = (profile = 'default') => {
  const baseSenderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@pau.edu.tr';
  const baseSenderName = process.env.BREVO_SENDER_NAME || 'GDG On Campus Pamukkale University';
  const baseReplyTo = process.env.BREVO_REPLY_TO || '';

  if (profile === 'applicationStatus') {
    return {
      senderEmail: process.env.BREVO_APPLICATION_SENDER_EMAIL || baseSenderEmail,
      senderName: process.env.BREVO_APPLICATION_SENDER_NAME || baseSenderName,
      replyTo: process.env.BREVO_APPLICATION_REPLY_TO || baseReplyTo
    };
  }

  return {
    senderEmail: baseSenderEmail,
    senderName: baseSenderName,
    replyTo: baseReplyTo
  };
};

/**
 * Escape dangerous HTML characters to prevent XSS / phishing injection
 */
const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Sanitize header strings (subjects, names) by stripping CRLF injection characters
 */
const sanitizeHeader = (str) => String(str || '').replace(/[\r\n]+/g, ' ').trim();

/**
 * Send transactional email using Brevo REST API
 * Falls back to console log preview if BREVO_API_KEY is not configured
 */
/**
 * @param {object} message
 * @param {string} message.to
 * @param {string} [message.toName]
 * @param {string} message.subject
 * @param {string} message.htmlContent
 * @param {string} [message.textContent]
 * @param {string} [message.profile]
 * @param {string} [message.fromEmail]
 * @param {string} [message.fromName]
 * @param {string} [message.replyTo]
 */
const sendEmail = async ({ to, toName, subject, htmlContent, textContent, profile = 'default', fromEmail, fromName, replyTo }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const resolved = getEmailProfile(profile);
  const senderEmail = sanitizeHeader(fromEmail || resolved.senderEmail);
  const senderName = sanitizeHeader(fromName || resolved.senderName);
  const resolvedReplyTo = sanitizeHeader(replyTo !== undefined ? replyTo : resolved.replyTo);
  const safeSubject = sanitizeHeader(subject);
  const safeToName = toName ? sanitizeHeader(toName) : undefined;

  // Development Fallback: If Brevo API key is not yet provided, log email preview to console
  if (!apiKey || apiKey === 'your_brevo_api_key_here') {
    if (process.env.NODE_ENV === 'production') throw Object.assign(new Error('E-posta servisi yapılandırılmamış.'), { status: 503 });
    console.log('\n=============================================================');
    console.log('📨 [BREVO EMAIL SIMULATOR - API Key Not Configured]');
    console.log(` From:     ${senderName} <${senderEmail}>`);
    if (resolvedReplyTo) console.log(` Reply-To: ${resolvedReplyTo}`);
    console.log(` To:       ${to}`);
    console.log(` Subject:  ${safeSubject}`);
    if (textContent) console.log(` Content:  ${textContent}`);
    console.log(' (Gerçek e-posta gönderimi için .env dosyasına BREVO_API_KEY ekleyin)');
    console.log('=============================================================\n');
    return { success: true, simulated: true, senderEmail, replyTo: resolvedReplyTo || null };
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
          ...(safeToName && { name: safeToName })
        }
      ],
      subject: safeSubject,
      htmlContent,
      ...(textContent && { textContent }),
      ...(resolvedReplyTo && {
        replyTo: { email: resolvedReplyTo }
      })
    };

    const response = await fetch(BREVO_API_URL, {
      signal: AbortSignal.timeout(10000),
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
      throw Object.assign(
        new Error(errorData.message || `Brevo API e-posta gönderimi başarısız oldu (HTTP ${response.status}).`),
        { status: 502 }
      );
    }

    const data = await response.json();
    return { success: true, messageId: data.messageId, senderEmail, replyTo: resolvedReplyTo || null };
  } catch (error) {
    console.error('[Email Service Error]', error.message);
    throw error;
  }
};

/**
 * Generate a beautifully styled HTML template for OTP emails
 */
const generateOtpTemplate = ({ title, greeting, message, code, footerNote }) => {
  const safeTitle = escapeHtml(title);
  const safeGreeting = escapeHtml(greeting);
  const safeCode = escapeHtml(code);

  return `
  <!DOCTYPE html>
  <html lang="tr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
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
        <h2 style="margin-top:0; color:#202124; font-size:20px;">${safeTitle}</h2>
        <p style="font-size:15px; line-height:1.6; color:#3c4043;">Merhaba <strong>${safeGreeting}</strong>,</p>
        <p style="font-size:15px; line-height:1.6; color:#3c4043;">${message}</p>
        
        <div class="otp-box">
          <div style="font-size:12px; color:#5f6368; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Doğrulama Kodunuz</div>
          <div class="otp-code">${safeCode}</div>
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
    toName: fullName ? sanitizeHeader(fullName) : undefined,
    subject: sanitizeHeader(`🔐 ${code} - GDG Core Team Kayıt Doğrulama Kodunuz`),
    htmlContent,
    textContent: `GDG On Campus Pamukkale Core Team doğrulama kodunuz: ${code} (10 dakika geçerlidir).`
  });
};

/**
 * Send Email Verification code for Hackathon Application
 */
const sendHackathonOtpEmail = async ({ email, leaderName, teamName, code }) => {
  const safeTeamName = teamName ? escapeHtml(teamName) : null;
  const htmlContent = generateOtpTemplate({
    title: 'Pamukkale Hackathon 2026 Başvuru Doğrulama Kodu',
    greeting: leaderName || 'Takım Lideri',
    message: `<strong>${safeTeamName ? `"${safeTeamName}"` : 'Takımınız'}</strong> adına yapılan Pamukkale Hackathon 2026 başvurusunu onaylamak için lütfen aşağıdaki doğrulama kodunu başvuru formuna giriniz.`,
    code,
    footerNote: 'Bu kod girilmeden hackathon başvurusu sisteme kaydedilmeyecektir.'
  });

  return sendEmail({
    to: email,
    toName: leaderName ? sanitizeHeader(leaderName) : undefined,
    subject: sanitizeHeader(`🚀 ${code} - Pamukkale Hackathon Başvuru Doğrulama Kodunuz`),
    htmlContent,
    textContent: `Pamukkale Hackathon başvuru doğrulama kodunuz: ${code} (10 dakika geçerlidir).`
  });
};

/**
 * Send Password Reset OTP Email
 */
const sendPasswordResetOtpEmail = async ({ email, fullName, code }) => {
  const htmlContent = generateOtpTemplate({
    title: 'Şifre Sıfırlama Doğrulama Kodu',
    greeting: fullName || 'Ekip Arkadaşımız',
    message: 'GDG On Campus Pamukkale hesabınızın şifresini sıfırlamak için lütfen aşağıdaki 6 haneli doğrulama kodunu kullanınız.',
    code,
    footerNote: 'Bu şifre sıfırlama talebini siz yapmadıysanız lütfen hesabınızı kontrol ediniz ve bu e-postayı dikkate almayınız.'
  });

  return sendEmail({
    to: email,
    toName: fullName ? sanitizeHeader(fullName) : undefined,
    subject: sanitizeHeader(`🔑 ${code} - GDG Şifre Sıfırlama Doğrulama Kodunuz`),
    htmlContent,
    textContent: `GDG On Campus Pamukkale şifre sıfırlama doğrulama kodunuz: ${code} (10 dakika geçerlidir).`
  });
};

/**
 * Send Hackathon / Form Application Approval or Rejection Email
 */
/**
 * @param {object} message
 * @param {string} message.email
 * @param {string} [message.recipientName]
 * @param {string} [message.teamName]
 * @param {string} [message.eventTitle]
 * @param {'APPROVED' | 'REJECTED'} message.status
 * @param {string} [message.note]
 * @param {string} [message.fromEmail]
 * @param {string} [message.fromName]
 * @param {string} [message.replyTo]
 */
const sendApplicationStatusEmail = async ({
  email,
  recipientName,
  teamName,
  eventTitle = 'PAU Hackathon 2026',
  status,
  note = '',
  fromEmail,
  fromName,
  replyTo
}) => {
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw Object.assign(new Error('Bildirim e-postası yalnızca APPROVED veya REJECTED durumunda gönderilebilir.'), { status: 400 });
  }

  const isApproved = status === 'APPROVED';
  const safeEvent = escapeHtml(eventTitle);
  const safeName = escapeHtml(recipientName || teamName || 'Katılımcı');
  const safeTeam = teamName ? escapeHtml(teamName) : null;
  const trimmedNote = typeof note === 'string' ? note.trim() : '';
  const safeNoteHtml = trimmedNote ? escapeHtml(trimmedNote).replace(/\r?\n/g, '<br>') : '';

  const badgeBg = isApproved ? '#e6f4ea' : '#fce8e6';
  const badgeColor = isApproved ? '#137333' : '#c5221f';
  const badgeLabel = isApproved ? 'BAŞVURUNUZ ONAYLANDI' : 'BAŞVURU SONUCU';
  const titleText = isApproved ? `${safeEvent} Başvurunuz Onaylandı` : `${safeEvent} Başvuru Değerlendirme Sonucu`;
  const leadParagraph = isApproved
    ? `${safeTeam ? `<strong>"${safeTeam}"</strong> için yaptığınız ` : ''}${safeEvent} başvurusu organizasyon ekibimiz tarafından değerlendirilmiş ve <strong>onaylanmıştır</strong>. Etkinlik detayları ve sıradaki adımlar için iletişim kanallarımızı ve e-posta kutunuzu takip etmeyi unutmayın.`
    : `${safeTeam ? `<strong>"${safeTeam}"</strong> için yaptığınız ` : ''}${safeEvent} başvurusu değerlendirme sürecimiz sonucunda bu dönem için maalesef <strong>onaylanamamıştır</strong>. İlginiz ve emeğiniz için teşekkür eder, sonraki etkinliklerimizde sizi yeniden aramızda görmeyi dileriz.`;

  const htmlContent = `
  <!DOCTYPE html>
  <html lang="tr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titleText}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8f9fa; margin: 0; padding: 20px; color: #202124; }
      .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e8eaed; }
      .header { background: #ffffff; padding: 28px 32px 20px; border-bottom: 2px solid #f1f3f4; text-align: left; }
      .brand-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; }
      .content { padding: 32px; }
      .status-badge { display: inline-block; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.6px; background: ${badgeBg}; color: ${badgeColor}; margin-bottom: 14px; }
      .note-box { background: #f8f9fa; border-left: 4px solid #4285f4; border-radius: 6px; padding: 14px 16px; margin: 20px 0; font-size: 14px; color: #3c4043; line-height: 1.5; }
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
        <div class="status-badge">${badgeLabel}</div>
        <h2 style="margin-top:0; color:#202124; font-size:20px;">${titleText}</h2>
        <p style="font-size:15px; line-height:1.6; color:#3c4043;">Merhaba <strong>${safeName}</strong>,</p>
        <p style="font-size:15px; line-height:1.6; color:#3c4043;">${leadParagraph}</p>
        ${safeNoteHtml ? `<div class="note-box"><strong>Ekip Notu:</strong><br>${safeNoteHtml}</div>` : ''}
        <p style="font-size:13px; color:#5f6368; line-height:1.5;">Sorularınız için bu e-postayı yanıtlayabilirsiniz.</p>
      </div>
      <div class="footer">
        Google Developer Groups on Campus • Pamukkale University<br>
        Denizli, Türkiye • Bu e-posta başvuru değerlendirmeniz hakkında bilgilendirme amaçlıdır.
      </div>
    </div>
  </body>
  </html>
  `;

  const subjectPrefix = isApproved ? '✅' : 'ℹ️';
  const subjectAction = isApproved ? 'Başvurunuz Onaylandı' : 'Başvuru Değerlendirme Sonucu';
  const textLead = isApproved
    ? `${eventTitle} başvurunuz onaylandı.`
    : `${eventTitle} başvurunuz değerlendirme sonucunda onaylanamadı.`;

  return sendEmail({
    profile: 'applicationStatus',
    fromEmail,
    fromName,
    replyTo,
    to: email,
    toName: recipientName ? sanitizeHeader(recipientName) : undefined,
    subject: sanitizeHeader(`${subjectPrefix} ${eventTitle} - ${subjectAction}`),
    htmlContent,
    textContent: `Merhaba ${recipientName || 'Katılımcı'}, ${textLead}${trimmedNote ? ` Ekip Notu: ${trimmedNote}` : ''}`
  });
};

module.exports = {
  getEmailProfile,
  sendEmail,
  sendRegistrationOtpEmail,
  sendHackathonOtpEmail,
  sendPasswordResetOtpEmail,
  sendApplicationStatusEmail,
  escapeHtml,
  sanitizeHeader
};


