const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-source.cjs');
const { parseTableLink } = load('utils/table-link.js', ['parseTableLink']);

for (const url of ['https://cafepay.app/?token=980723029850&source=qr',
  'https://www.cafepay.app/?source=qr&token=980723029850',
  'http://localhost:3000/user/home?token=980723029850',
  'https://cfpy.ir/?token=980723029850']) {
  test(`table link extracts only the token: ${url}`, () => {
    assert.equal(parseTableLink(url, 'http://localhost:3000/user/home').token, '980723029850');
  });
}
test('table links reject malformed and misleading hosts', () => {
  for (const url of ['cafepay.app', 'https://cafepay.app.evil.test/?token=1', 'https://evil.test/?cafepay.app&token=1', 'javascript:alert(1)', 'https://www.cafepay.app/']) {
    assert.equal(parseTableLink(url), null);
  }
  assert.equal(parseTableLink('https://example.cafepay.app/').token, 'example');
});
test('history pagination stays on configured API and stops at the last page', async () => {
  const { actions } = load('store/user.js', ['actions']);
  const urls = [], ctx = { state: { history: { next: 'http://localhost:8000/api/v1/user-profile/orders/history/?page=2' } }, commit() {} };
  const store = { $api: { $get: async url => { urls.push(url); return { results: [] }; } } };
  await actions.getOrderHistory.call(store, ctx, true);
  assert.equal(urls[0], '/v1/user-profile/orders/history/?page=2');
  ctx.state.history.next = null;
  await actions.getOrderHistory.call(store, ctx, true);
  assert.equal(urls.length, 1);
});
