import { describe, expect, test } from 'vitest'
import {
  validateEmail,
  validateFullName,
  validateLoginPassword,
  validateNewPassword,
  validateOtpCode,
  validatePasswordConfirm,
  validateRegisterEmail,
} from './validation.js'

describe('panel validation rules', () => {
  test('full name requires trimmed length >= 2', () => {
    expect(validateFullName('  ')).toBe('Ad soyad gerekli.')
    expect(validateFullName(' A ')).toContain('en az 2')
    expect(validateFullName(' Ayşe Yılmaz ')).toBe('')
  })

  test('login email allows general addresses while register email requires PAU or Gmail', () => {
    expect(validateEmail('')).toBe('E-posta adresi gerekli.')
    expect(validateEmail('not-an-email')).toContain('Geçerli bir e-posta')
    expect(validateEmail('user@example.com')).toBe('')

    expect(validateRegisterEmail('')).toBe('E-posta adresi gerekli.')
    expect(validateRegisterEmail('user@outlook.com')).toContain('Pamukkale Üniversitesi')
    expect(validateRegisterEmail('student@posta.pau.edu.tr')).toBe('')
    expect(validateRegisterEmail('team@pau.edu.tr')).toBe('')
    expect(validateRegisterEmail('member@gmail.com')).toBe('')
  })

  test('passwords and confirm validate minimum length and equality', () => {
    expect(validateLoginPassword('')).toBe('Şifre gerekli.')
    expect(validateLoginPassword('1')).toBe('')

    expect(validateNewPassword('')).toBe('Şifre gerekli.')
    expect(validateNewPassword('12345')).toContain('en az 6')
    expect(validateNewPassword('123456')).toBe('')

    expect(validatePasswordConfirm('123456', '')).toBe('Şifreni tekrar yaz.')
    expect(validatePasswordConfirm('123456', '123457')).toBe('Şifreler eşleşmiyor.')
    expect(validatePasswordConfirm('123456', '123456')).toBe('')
  })

  test('OTP code requires exactly 6 digits', () => {
    expect(validateOtpCode('')).toBe('Doğrulama kodunu yaz.')
    expect(validateOtpCode('12345')).toContain('6 haneli')
    expect(validateOtpCode('12ab56')).toContain('6 haneli')
    expect(validateOtpCode('012345')).toBe('')
  })
})

