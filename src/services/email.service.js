import nodemailer from 'nodemailer'
import { getMessage } from '../locales/messages.js'

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10)
const SMTP_FROM = process.env.SMTP_FROM
const SMTP_PASS = process.env.SMTP_PASS

const hasSmtpConfig = SMTP_HOST && SMTP_FROM && SMTP_PASS

let transporter = null
if (hasSmtpConfig) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_FROM,
      pass: SMTP_PASS,
    },
  })
}

/**
 * Gửi email chứa link đặt lại mật khẩu.
 * Nếu chưa cấu hình SMTP thì chỉ log link ra console (dùng cho dev).
 * @param {string} toEmail - Email người nhận
 * @param {string} resetLink - URL đầy đủ đến trang reset (ví dụ https://.../reset-password?token=...)
 * @param {string} [lang='vi'] - Ngôn ngữ nội dung email (vi | en)
 */
export async function sendPasswordResetEmail(toEmail, resetLink, lang = 'vi') {
  const subject = getMessage(lang, 'auth.emailResetSubject')
  const textBody = getMessage(lang, 'auth.emailResetBody', { link: resetLink })

  if (!transporter) {
    // eslint-disable-next-line no-console
    console.log('[email] SMTP chưa cấu hình. Link đặt lại mật khẩu (log only):', resetLink)
    return
  }

  const intro = getMessage(lang, 'auth.emailResetBodyIntro')
  const linkLabel = getMessage(lang, 'auth.emailResetLinkLabel')
  const copyHint = getMessage(lang, 'auth.emailResetCopyHint')

  try {
    await transporter.sendMail({
      from: `"EngSocial" <${SMTP_FROM}>`,
      to: toEmail,
      subject,
      text: textBody,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 24px; color: #333; font-size: 16px; line-height: 1.6;">${intro}</p>
        <p style="margin: 0 0 24px;">
          <a href="${resetLink}" style="display: inline-block; padding: 14px 28px; background: #6366f1; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">${linkLabel}</a>
        </p>
        <p style="margin: 0 0 8px; color: #666; font-size: 13px;">${copyHint}</p>
        <p style="margin: 0; word-break: break-all; font-size: 12px; color: #888;"><a href="${resetLink}" style="color: #6366f1;">${resetLink}</a></p>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] Gửi email thất bại:', err.message)
    throw err
  }
}

const STATUS_LABEL_KEYS = {
  active: 'emailAccount.statusLabelActive',
  inactive: 'emailAccount.statusLabelInactive',
  banned: 'emailAccount.statusLabelBanned',
  pending: 'emailAccount.statusLabelPending',
}

function resolveAccountEmailLang(userDoc, adminRequestLang) {
  const pref = userDoc?.preferences?.language
  if (pref === 'vi' || pref === 'en') return pref
  if (adminRequestLang === 'vi' || adminRequestLang === 'en') return adminRequestLang
  return 'vi'
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Thông báo user khi admin đổi trạng thái tài khoản. Không throw — chỉ log nếu lỗi SMTP.
 * @param {import('mongoose').Document} userDoc - User đã save (có email, name, preferences)
 * @param {{ prevStatus: string, newStatus: string, notifyLang?: string }} opts
 */
export async function sendUserStatusChangeEmail(userDoc, { prevStatus, newStatus, notifyLang = 'vi' }) {
  const toEmail = userDoc?.email
  if (!toEmail || prevStatus === newStatus) return

  const lang = resolveAccountEmailLang(userDoc, notifyLang)
  const prevLabel = getMessage(lang, STATUS_LABEL_KEYS[prevStatus] || STATUS_LABEL_KEYS.pending)
  const newLabel = getMessage(lang, STATUS_LABEL_KEYS[newStatus] || STATUS_LABEL_KEYS.pending)
  const name = userDoc?.name || toEmail
  const subject = getMessage(lang, 'emailAccount.statusChangedSubject')
  const tagline = getMessage(lang, 'emailAccount.statusChangedEmailTagline')
  const greeting = getMessage(lang, 'emailAccount.statusChangedGreeting', { name })
  const p1 = getMessage(lang, 'emailAccount.statusChangedP1', { prevLabel, newLabel })
  const p2 = getMessage(lang, 'emailAccount.statusChangedP2')
  const p3 = getMessage(lang, 'emailAccount.statusChangedP3')
  const footer = getMessage(lang, 'emailAccount.statusChangedFooter')
  const capPrev = getMessage(lang, 'emailAccount.statusComparePrevCaption')
  const capNew = getMessage(lang, 'emailAccount.statusCompareNewCaption')
  const textBody = [greeting, p1, p2, p3, footer].join('\n\n')

  if (!transporter) {
    // eslint-disable-next-line no-console
    console.log('[email] SMTP chưa cấu hình. Trạng thái tài khoản (log only):', { toEmail, prevStatus, newStatus })
    return
  }

  const safeTagline = escapeHtml(tagline)
  const safeGreeting = escapeHtml(greeting)
  const safeP1 = escapeHtml(p1)
  const safeP2 = escapeHtml(p2)
  const safeP3 = escapeHtml(p3)
  const safePrev = escapeHtml(prevLabel)
  const safeNew = escapeHtml(newLabel)
  const safeFooter = escapeHtml(footer)
  const safeCapPrev = escapeHtml(capPrev)
  const safeCapNew = escapeHtml(capNew)

  try {
    await transporter.sendMail({
      from: `"EngSocial" <${SMTP_FROM}>`,
      to: toEmail,
      subject,
      text: textBody,
      html: `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(165deg,#eef2ff 0%,#f8fafc 42%,#faf5ff 100%);padding:36px 16px 48px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(79,70,229,0.12),0 1px 0 rgba(0,0,0,0.04);border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#6366f1 45%,#7c3aed 100%);padding:28px 32px 26px;">
              <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.2;">EngSocial</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.88);margin-top:8px;line-height:1.45;">${safeTagline}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 20px;font-size:17px;line-height:1.55;color:#0f172a;font-weight:600;">${safeGreeting}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:18px 20px;text-align:center;">
                    <span style="display:inline-block;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">${safeCapPrev}</span><br>
                    <span style="display:inline-block;padding:10px 18px;border-radius:999px;background:#ffffff;border:1px solid #cbd5e1;color:#334155;font-size:15px;font-weight:600;">${safePrev}</span>
                  </td>
                  <td style="padding:18px 8px;vertical-align:middle;width:48px;text-align:center;color:#94a3b8;font-size:20px;">→</td>
                  <td style="padding:18px 20px;text-align:center;">
                    <span style="display:inline-block;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">${safeCapNew}</span><br>
                    <span style="display:inline-block;padding:10px 18px;border-radius:999px;background:linear-gradient(135deg,#eef2ff,#ede9fe);border:1px solid #c7d2fe;color:#3730a3;font-size:15px;font-weight:700;">${safeNew}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">${safeP1}</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#475569;">${safeP2}</p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#475569;">${safeP3}</p>
              <div style="height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);margin:0 0 20px;"></div>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">${safeFooter}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">© EngSocial</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] Gửi thông báo đổi trạng thái tài khoản thất bại:', err.message)
  }
}
