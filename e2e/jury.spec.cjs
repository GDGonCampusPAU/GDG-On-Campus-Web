// The acceptance criteria of docs/JURI_PUANLAMA_SPEC.md §11 in a real browser.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

const site = 'http://127.0.0.1:4173';
const api = 'http://127.0.0.1:5010';
const PHONE = { width: 360, height: 740 };
const NO_LINKS = 'Bağlantısız Takım';
const LONG_NAME = 'Pamukkaleninüretkenyapayzekâgeliştiricisi';

/** No sideways scrolling, and nothing sticks out (body hides overflow, so scrollWidth alone could lie). */
async function checkLayout(page, name) {
  for (const width of [320, 360, 414]) {
    await page.setViewportSize({ width, height: PHONE.height });
    const problems = await page.evaluate(() => {
      const outside = [...document.querySelectorAll('main *')].filter((element) => {
        if (element.closest('.jury-admin__scroll, .visually-hidden')) return false;
        const box = element.getBoundingClientRect();
        return box.width > 0 && (box.right > document.documentElement.clientWidth + 1 || box.left < -1);
      });
      return outside.map((element) => `${element.tagName}.${element.className}`).slice(0, 8);
    });
    expect(problems, `${name} ${width}px`).toEqual([]);
  }
  await page.setViewportSize(PHONE);
}

test('jury scoring from setup to locked results', async ({ browser, request }) => {
  test.setTimeout(120000);
  for (const [name, code] of [[LONG_NAME.slice(0, 40), 'JURYAA'], [NO_LINKS, 'JURYBB']]) {
    expect((await request.post(`${api}/__test__/team`, { data: { name, code } })).status()).toBe(204);
  }

  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const admin = await adminContext.newPage();
  admin.on('dialog', (dialog) => dialog.accept());
  await admin.goto(`${site}/admin/juri`);
  await admin.getByLabel('E-posta', { exact: true }).fill('admin@pau.edu.tr');
  await admin.getByLabel('Şifre', { exact: true }).fill('e2e-admin-password');
  await admin.getByRole('button', { name: 'Giriş', exact: true }).click();

  // Three jurors with their one-time links
  await admin.getByRole('button', { name: 'Jüriler', exact: true }).click();
  const links = [];
  for (const name of ['Ayşe Yılmaz', 'Burak Şahin', 'İpek Çağlar']) {
    await admin.getByLabel('Jüri adı', { exact: true }).fill(name);
    await admin.getByRole('button', { name: 'Jüri ekle' }).click();
    const input = admin.getByRole('textbox', { name: `${name} linki` });
    await expect(input).toHaveValue(/\/juri\/[A-Za-z0-9_-]{32}$/);
    links.push(await input.inputValue());
  }
  await checkLayout(admin, 'admin jurors');
  await admin.setViewportSize({ width: 1280, height: 900 });

  // Teams: one with project and link, one left completely empty
  await admin.getByRole('button', { name: 'Yarışan takımlar' }).click();
  const select = admin.getByLabel('Takım', { exact: true });
  for (const code of ['JURYAA', 'JURYBB']) {
    const option = select.locator('option', { hasText: code });
    await expect(option).toBeAttached();
    await select.selectOption(await option.getAttribute('value'));
    await admin.getByRole('button', { name: 'Takım ekle' }).click();
  }
  await admin.getByLabel('Proje adı').first().fill('Kampüs Asistanı');
  await admin.getByLabel('Repo linki').first().fill('https://example.com/kampus-asistani');
  await admin.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(admin.getByText('Kaydedildi.', { exact: true })).toBeVisible();
  await checkLayout(admin, 'admin entries');

  // A juror on a phone
  const phoneContext = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true });
  const phone = await phoneContext.newPage();
  phone.on('dialog', (dialog) => dialog.accept());
  const eventRequests = [];
  phone.on('request', (req) => { if (req.url().includes('/event-page/')) eventRequests.push(req.url()); });
  await phone.goto(links[0]);
  await expect(phone.getByRole('heading', { level: 1, name: 'Ayşe Yılmaz' })).toBeVisible();
  await expect(phone.getByText('0 / 2 takım puanlandı')).toBeVisible();
  await expect(phone.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  expect(eventRequests, 'the juror page must not wait for event content').toEqual([]);
  await checkLayout(phone, 'juror list');

  await phone.getByRole('button', { name: /Kampüs Asistanı/ }).tap();
  await expect(phone.getByRole('link', { name: /Repo/ })).toBeVisible();
  const criteria = phone.locator('fieldset.jury__criterion').filter({ has: phone.locator('.jury__scale') });
  await expect(criteria).toHaveCount(7);
  const choose = (index, value) => criteria.nth(index).locator('.jury__score', { hasText: String(value) }).tap();

  await choose(0, 4);
  await criteria.nth(0).getByText('Neden? (isteğe bağlı)').tap();
  await criteria.nth(0).locator('textarea').fill('Canlı demoda çalıştı');
  await expect(phone.getByText('Kaydedildi', { exact: true })).toBeVisible();

  // The connection drops while scoring and comes back
  await phoneContext.setOffline(true);
  await choose(1, 5);
  await expect(phone.getByText('Kaydedilemedi, bu cihazda saklandı')).toBeVisible();
  await phoneContext.setOffline(false);
  await expect(phone.getByText('Kaydedildi', { exact: true })).toBeVisible();

  // Reload before the autosave delay has passed
  await choose(2, 3);
  await phone.reload();
  await expect(criteria.nth(2).getByRole('radio', { name: '3' })).toBeChecked();
  await expect(criteria.nth(0).locator('textarea')).toHaveValue('Canlı demoda çalıştı');

  await phone.getByRole('button', { name: 'Puanları Gönder' }).tap();
  await expect(phone.getByRole('alert')).toContainText('Göndermeden önce');
  await checkLayout(phone, 'missing criteria');
  for (let index = 3; index < 7; index += 1) await choose(index, 4);
  await phone.getByRole('checkbox', { name: 'Vay Be' }).tap();
  await phone.getByRole('button', { name: 'Puanları Gönder' }).tap();
  await expect(phone.getByRole('button', { name: 'Gönderildi' })).toBeDisabled();

  // Editing a submitted card warns until it is sent again, also after a reload
  await choose(2, 5);
  await expect(phone.getByRole('alert')).toContainText('Gönderilmemiş değişiklik var');
  await expect(phone.locator('.jury__unsent')).toBeInViewport();
  await checkLayout(phone, 'unsent change');
  await phone.reload();
  await expect(phone.getByRole('alert')).toContainText('Gönderilmemiş değişiklik var');
  await phone.getByRole('button', { name: 'Yeniden gönder' }).tap();
  await expect(phone.getByRole('alert')).toHaveCount(0);

  // A team without any link can be scored
  await phone.getByRole('button', { name: 'Sonraki →' }).tap();
  await expect(phone.getByRole('heading', { level: 1, name: NO_LINKS })).toBeVisible();
  await expect(phone.getByText(/bağlantısı eklenmemiş/)).toBeVisible();
  for (let index = 0; index < 7; index += 1) await choose(index, 3);
  await checkLayout(phone, 'team without links');
  await phone.getByRole('button', { name: 'Puanları Gönder' }).tap();
  await expect(phone.getByRole('button', { name: 'Gönderildi' })).toBeDisabled();
  await phone.getByRole('button', { name: '← Takımlar' }).tap();
  await expect(phone.getByText('2 / 2 takım puanlandı')).toBeVisible();

  // Results, suggestions and CSV
  await admin.getByRole('button', { name: 'Sonuçlar', exact: true }).click();
  const table = admin.getByRole('table');
  await expect(table.getByRole('row').nth(1)).toContainText('Kampüs Asistanı');
  await table.getByRole('row').nth(1).getByRole('button').click();
  await expect(admin.getByText('Canlı demoda çalıştı')).toBeVisible();
  await expect(admin.getByText('Aday yok, jüri karar versin')).toBeVisible();
  await checkLayout(admin, 'admin results');
  await admin.setViewportSize({ width: 1280, height: 900 });
  const pending = admin.waitForEvent('download');
  await admin.getByRole('button', { name: 'CSV indir' }).click();
  const csv = await fs.readFile(await (await pending).path(), 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain('"Ayşe Yılmaz"');
  expect(csv).toContain('Canlı demoda çalıştı');

  // Locking makes the juror's screen read-only
  await admin.getByRole('button', { name: 'Puanlamayı kilitle' }).click();
  await expect(admin.getByText('🔒 Puanlama kilitli')).toBeVisible();
  await phone.reload();
  await expect(phone.getByText('Puanlama kapatıldı.')).toBeVisible();
  await phone.getByRole('button', { name: /Kampüs Asistanı/ }).tap();
  await expect(criteria.nth(0).getByRole('radio', { name: '1' })).toBeDisabled();
  await expect(phone.getByRole('button', { name: /gönder/i })).toHaveCount(0);
  await checkLayout(phone, 'locked');

  // A lock also freezes settings and the reset
  await expect(admin.getByRole('button', { name: 'Puan kartlarını sıfırla' })).toBeDisabled();
  await admin.getByRole('button', { name: 'Kriterler', exact: true }).click();
  await expect(admin.getByLabel('Ağırlık', { exact: true }).first()).toBeDisabled();
  await admin.getByRole('button', { name: 'Sonuçlar', exact: true }).click();
  await admin.getByRole('button', { name: 'Puanlamayı aç' }).click();

  // ADMIN voids a single card with a reason
  await table.getByRole('row').nth(1).getByRole('button').click();
  const voidButton = admin.getByRole('button', { name: 'Ayşe Yılmaz kartını iptal et' });
  await voidButton.click();
  await admin.getByLabel('İptal gerekçesi').fill('Yanlış takım puanlandı');
  await admin.getByRole('button', { name: 'Kartı iptal et' }).click();
  await expect(admin.getByText('Puan kartı iptal edildi.', { exact: true })).toBeVisible();
  await phone.reload();
  await expect(phone.getByText('Puan kartın yönetim tarafından iptal edildi.')).toBeVisible();
  await checkLayout(phone, 'voided card');
  await admin.getByRole('button', { name: 'İşlem kaydı', exact: true }).click();
  await expect(admin.getByText('Gerekçe: Yanlış takım puanlandı')).toBeVisible();
  await checkLayout(admin, 'admin log');
  await admin.setViewportSize({ width: 1280, height: 900 });

  // ADMIN reset after the rehearsal
  await admin.getByRole('button', { name: 'Sonuçlar', exact: true }).click();
  await admin.getByRole('button', { name: 'Puan kartlarını sıfırla' }).click();
  await admin.getByLabel('Onaylamak için SIFIRLA yaz').fill('SIFIRLA');
  await admin.getByRole('button', { name: 'Kalıcı olarak sil' }).click();
  await expect(admin.getByText('2 puan kartı silindi.')).toBeVisible();
  await phone.reload();
  await expect(criteria.nth(0).getByRole('radio', { name: '4' })).not.toBeChecked();

  const invalid = await phoneContext.newPage();
  await invalid.goto(`${site}/juri/${'x'.repeat(32)}`);
  await expect(invalid.getByRole('alert')).toContainText('Bu jüri linki geçersiz');

  await Promise.all([adminContext.close(), phoneContext.close()]);
});
