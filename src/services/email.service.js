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
