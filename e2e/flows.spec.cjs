const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const event = require('../shared/hackathon-event.json');
const api = 'http://127.0.0.1:5010';
async function login(page, origin = 'http://127.0.0.1:4174') {
  await page.goto(origin);
  await page.getByLabel('E-posta', { exact: true }).fill('admin@pau.edu.tr');
  await page.getByLabel('Şifre', { exact: true }).fill('e2e-admin-password');
  await page.getByRole('button', { name: /^(Giriş|Giriş Yap)$/ }).click();
}
test('verified website submission appears in staff panel and downloaded CSV', async ({ page, request }) => {
  await page.goto('http://127.0.0.1:4173/kayit');
  await page.getByLabel('Doğrulama e-postası').fill('browser@example.com');
  await page.getByRole('button', { name: 'Kod gönder', exact: true }).click();
  await expect(page.getByLabel('Doğrulama kodu', { exact: true })).toBeVisible();
  const { code } = await (await request.get(`${api}/__test__/otp?email=browser@example.com`)).json();
  await page.getByLabel('Doğrulama kodu', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Doğrula ve devam et' }).click();
  for (const step of event.register.steps) {
    for (const field of step.fields) {
      if (field.kind === 'email') continue;
      if (field.kind === 'checkbox') await page.getByLabel(field.options[0].label, { exact: true }).check();
      else if (field.kind === 'select') await page.getByLabel(field.label, { exact: true }).selectOption(field.options[0].value);
      else await page.getByLabel(field.label, { exact: true }).fill(field.kind === 'tel' ? '+905551112233' : 'Browser Participant');
    }
    await page.getByRole('button', { name: 'İleri', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Gönder', exact: true }).click();
  await expect(page.getByRole('heading', { name: event.register.successTitle })).toBeVisible();
  expect((await (await request.get(`${api}/__test__/state`)).json()).responses).toBe(1);
  await login(page);
  await expect(page.getByRole('link', { name: 'browser@example.com' })).toBeVisible();
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV indir' }).click();
  const csv = await fs.readFile(await (await pendingDownload).path(), 'utf8');
  expect(csv).toContain('browser@example.com');
});
test('team account needs ADMIN approval before it can log in', async ({ page, request }) => {
  await page.goto('http://127.0.0.1:4174/#/register');
  await page.getByLabel('Ad Soyad', { exact: true }).fill('Browser Team Member');
  await page.getByLabel('E-posta', { exact: true }).fill('browserteam@gmail.com');
  await page.getByLabel('Şifre', { exact: true }).fill('browser-team-password');
  await page.getByLabel('Şifre Tekrar', { exact: true }).fill('browser-team-password');
  await page.getByRole('button', { name: 'Devam Et' }).click();
  await expect(page.getByLabel('Doğrulama Kodu', { exact: true })).toBeVisible();
  const { code } = await (await request.get(`${api}/__test__/otp?email=browserteam@gmail.com`)).json();
  await page.getByLabel('Doğrulama Kodu', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Kaydı Tamamla' }).click();
  await expect(page.getByRole('heading', { name: 'Kaydın iletildi' })).toBeVisible();
  await login(page);
  await page.getByRole('link', { name: 'Ekip ve onaylar' }).click();
  await page.getByLabel('Rol — Browser Team Member').selectOption('ORGANIZER');
  await expect(page.getByLabel('Rol — Browser Team Member')).toHaveValue('ORGANIZER');
  await page.getByRole('button', { name: 'Çıkış Yap' }).click();
  await page.getByLabel('E-posta', { exact: true }).fill('browserteam@gmail.com');
  await page.getByLabel('Şifre', { exact: true }).fill('browser-team-password');
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await expect(page.getByRole('heading', { name: 'Hackathon Başvuruları' })).toBeVisible();
});
test('staff publishes shared content visible in a second browser tab', async ({ page, context }) => {
  await login(page, 'http://127.0.0.1:4173/admin');
  await expect(page.getByRole('button', { name: 'Yayınla', exact: true })).toBeEnabled();
  await page.getByRole('textbox', { name: 'Ad', exact: true }).fill('Browser Published Event');
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Yayınlandı');
  const second = await context.newPage();
  await second.goto('http://127.0.0.1:4173/');
  await expect(second).toHaveTitle(/Browser Published Event/);
  await second.setViewportSize({ width: 390, height: 844 });
  expect(await second.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('responsive layout has no horizontal overflow and keeps footer attached', async ({ page }) => {
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:4173/');
    await expect(page.locator('.closing')).toBeAttached();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      gap: document.querySelector('.footer').getBoundingClientRect().top - document.querySelector('.closing').getBoundingClientRect().bottom,
    }));
    expect(geometry.overflow, `${width}x${height} overflow`).toBeLessThanOrEqual(0);
    expect(Math.abs(geometry.gap), `${width}x${height} footer gap`).toBeLessThanOrEqual(2);
  }
});
