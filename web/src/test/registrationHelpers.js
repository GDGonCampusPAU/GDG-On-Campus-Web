import { screen } from '@testing-library/react'

export async function fillPerson(user) {
  await user.type(screen.getByLabelText('Ad soyad'), 'Ayşe Yılmaz')
  await user.type(screen.getByLabelText('E-posta'), 'ayse@example.com')
  await user.type(screen.getByLabelText('Telefon'), '0555 123 45 67')
  await user.type(screen.getByLabelText('Bölüm'), 'Bilgisayar Mühendisliği')
  await user.selectOptions(screen.getByLabelText('Sınıf'), '2')
}

export async function fillTeam(user) {
  await user.type(screen.getByLabelText('Takım adı'), 'Kod Kurtları')
  await user.selectOptions(screen.getByLabelText('Rol'), 'founder')
}

export async function fillInterest(user) {
  await user.click(screen.getByLabelText('Web'))
  await user.selectOptions(screen.getByLabelText('Deneyim seviyesi'), 'beginner')
}

export async function acceptConsent(user) {
  await user.click(screen.getByLabelText(/katılım koşullarını/i))
}

export async function next(user) {
  await user.click(screen.getByRole('button', { name: 'İleri' }))
}

export async function fillUntilConfirm(user) {
  await fillPerson(user)
  await next(user)
  await fillTeam(user)
  await next(user)
  await fillInterest(user)
  await next(user)
}
