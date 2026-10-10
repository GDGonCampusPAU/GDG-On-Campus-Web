const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Her fonksiyon hata mesajı döndürür; boş string "geçerli" demektir.

export function validateFullName(value) {
  const text = value.trim()
  if (!text) return 'Ad soyad gerekli.'
  if (text.split(/\s+/).length < 2) return 'Adını ve soyadını birlikte yaz.'
  return ''
}

export function validateEmail(value) {
  const text = value.trim()
  if (!text) return 'E-posta adresi gerekli.'
  if (!EMAIL_RE.test(text)) return 'Geçerli bir e-posta adresi yaz.'
  return ''
}

export function validateNewPassword(value) {
  if (!value) return 'Şifre gerekli.'
  if (value.length < 8) return 'Şifre en az 8 karakter olmalı.'
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(value) || !/\d/.test(value)) {
    return 'Şifre en az bir harf ve bir rakam içermeli.'
  }
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
