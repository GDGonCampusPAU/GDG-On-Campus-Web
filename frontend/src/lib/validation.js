// Kurallar backend/src/utils/validators.js ile aynı tutulur; backend asıl doğrulamayı yine yapar.
// Her fonksiyon hata mesajı döndürür; boş string "geçerli" demektir.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAU_OR_GMAIL_RE = /^[a-zA-Z0-9._%+-]+@(gmail\.com|pau\.edu\.tr|posta\.pau\.edu\.tr)$/i

export function validateFullName(value) {
  const text = value.trim()
  if (!text) return 'Ad soyad gerekli.'
  if (text.length < 2) return 'Ad soyad en az 2 karakter olmalı.'
  return ''
}

// Giriş sayfası: yalnızca genel e-posta biçimi kontrol edilir.
export function validateEmail(value) {
  const text = value.trim()
  if (!text) return 'E-posta adresi gerekli.'
  if (!EMAIL_RE.test(text)) return 'Geçerli bir e-posta adresi yaz.'
  return ''
}

// Kayıt sayfası: backend yalnızca Gmail ve Pamukkale Üniversitesi adreslerini kabul eder.
export function validateRegisterEmail(value) {
  const text = value.trim()
  if (!text) return 'E-posta adresi gerekli.'
  if (!PAU_OR_GMAIL_RE.test(text)) {
    return 'Gmail ya da Pamukkale Üniversitesi (@pau.edu.tr, @posta.pau.edu.tr) adresi kullanmalısın.'
  }
  return ''
}

export function validateNewPassword(value) {
  if (!value) return 'Şifre gerekli.'
  if (value.length < 6) return 'Şifre en az 6 karakter olmalı.'
  return ''
}

export function validatePasswordConfirm(password, confirm) {
  if (!confirm) return 'Şifreni tekrar yaz.'
  if (password !== confirm) return 'Şifreler eşleşmiyor.'
  return ''
}

// Giriş sırasında şifre politikası uygulanmaz, sadece boş olup olmadığına bakılır.
export function validateLoginPassword(value) {
  return value ? '' : 'Şifre gerekli.'
}

export function validateOtpCode(value) {
  if (!value) return 'Doğrulama kodunu yaz.'
  if (!/^\d{6}$/.test(value)) return 'Kod 6 haneli bir sayı olmalı.'
  return ''
}
