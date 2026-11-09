const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-source.cjs');
const { parseWalletAmount } = load('utils/wallet.js', ['parseWalletAmount']);

test('wallet accepts Persian amounts and rejects invalid charges', () => {
  for (const value of ['۵۰٬۰۰۰', '٥٠٠٠٠', '50,000', 50000]) assert.equal(parseWalletAmount(value), 50000);
  for (const value of ['', null, 0, -1, '12.5', 'abc', 2147483648]) assert.equal(parseWalletAmount(value), null);
});
test('wallet retrieves actual transactions and does not create fabricated entries', async () => {
  const page = load('pages/user/profile/wallet.vue', [], { parseWalletAmount });
  const view = { $api: { $get: async () => ({ wallet: { balance: 50000, invoice: [{ pk: 9, amount: 50000 }] } }) } };
  await page.methods.loadWallet.call(view);
  assert.equal(page.computed.transactions.call(view)[0].pk, 9);
  assert.equal(page.computed.balance.call(view), 50000);
  assert.equal(view.loading, false);
  assert.equal(page.data().wallet, null);
});
test('wallet checkout sends an amount, saves context, and follows checkout redirect', async () => {
  const calls = [], contexts = [], routes = [];
  const page = load('pages/user/profile/wallet.vue', [], { parseWalletAmount,
    saveCheckoutContext: (storage, context) => contexts.push(context),
    window: { sessionStorage: {}, location: { assign: route => routes.push(route) } } });
  const view = { payAmount: '۵۰٬۰۰۰', $api: {
    $post: async (path, payload) => { calls.push([path, payload]); return { uuid: 'invoice', amount: 50000 }; },
    $get: async () => ({ redirect_to: 'http://localhost:8000/mock-checkout/' })
  } };
  await page.methods.chargeWallet.call(view);
  assert.equal(calls[0][1].amount, 50000);
  assert.equal(contexts[0].kind, 'wallet');
  assert.equal(routes.length, 1);
  assert.equal(view.charging, false);
});
test('wallet failures clear loading and reuse the same unpaid invoice on retry', async () => {
  let creates = 0;
  const page = load('pages/user/profile/wallet.vue', [], { parseWalletAmount });
  const view = { payAmount: 10000, $api: {
    $post: async () => { creates++; return { uuid: 'invoice', amount: 10000 }; },
    $get: async () => { throw new Error('offline'); }
  } };
  await page.methods.chargeWallet.call(view);
  await page.methods.chargeWallet.call(view);
  assert.equal(creates, 1);
  assert.equal(view.charging, false);
  assert.ok(view.chargeError);
});
