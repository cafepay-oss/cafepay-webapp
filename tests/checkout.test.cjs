const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-source.cjs');
const helpers = load('utils/checkout-context.js', ['saveCheckoutContext', 'readCheckoutContext']);

test('checkout context matches its invoice and tolerates unavailable storage', () => {
  let value;
  const storage = { getItem: () => value, setItem: (key, data) => { value = data; } };
  helpers.saveCheckoutContext(storage, { invoice: 'one', token: '123' });
  assert.equal(helpers.readCheckoutContext(storage, 'one').token, '123');
  assert.equal(helpers.readCheckoutContext(storage, 'two'), null);
  value = 'invalid'; assert.equal(helpers.readCheckoutContext(storage, 'one'), null);
  assert.doesNotThrow(() => helpers.saveCheckoutContext({ setItem() { throw new Error(); } }, {}));
});
test('receipt restores normal table before navigation after a reload', async () => {
  const events = [];
  const page = load('pages/paymentResult.vue', [], { readCheckoutContext: () => ({ token: '980723029850', kind: 'table' }), window: { sessionStorage: {} } });
  const view = { info: { uuid: 'one', table_type: 0, table_uuid: 'table-uuid' },
    localePath: value => value, $router: { push: async path => events.push(['route', path]) },
    $store: { state: { token: 'auth' }, commit: (...args) => events.push(args),
      dispatch: async (...args) => events.push(args) } };
  await page.methods.backtoapp.call(view);
  assert.equal(events[1][0], 'sendCode');
  assert.equal(events[1][1].tableToken, '980723029850');
  assert.equal(events.at(-1)[1], '/user/home');
  assert.equal(view.returning, false);
});
test('wallet receipt returns to wallet without a table', async () => {
  let route;
  const page = load('pages/paymentResult.vue', [], { readCheckoutContext: () => null, window: { sessionStorage: {} } });
  await page.methods.backtoapp.call({ info: { uuid: 'wallet' }, localePath: value => value,
    $store: { commit() {} }, $router: { push: async value => { route = value; } } });
  assert.equal(route, '/user/profile/wallet');
});
