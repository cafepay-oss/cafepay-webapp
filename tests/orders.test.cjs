const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-source.cjs');
const { actions } = load('store/table.js', ['actions']);
const menu = load('components/cafe/menu.vue', [], { mapState: () => ({}), Swiper: {}, login: {} });

function context() {
  const commits = [];
  return { commits, state: { token: 'test', cafe: { pk: 93 } },
    rootState: { cafe: { tokenType: 'normal' } },
    rootGetters: { 'cafe/productById': id => id === 3488 ? { name: 'اسپرسو' } : null },
    commit: (...args) => commits.push(args), dispatch() {} };
}
test('mixed changes use one request and clear edits only after success', async () => {
  const ctx = context(); const calls = [];
  const result = { bill_products: [] };
  await actions.changeProductsOnTable.call({ $api: { $post: async (...args) => {
    calls.push(args); return result;
  } } }, ctx, { add: [{ product: 1, count: 2 }], del: [{ product: 2, count: 1 }] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'v1/table/test/products/change/');
  assert.equal(calls[0][1].add[0].count, 2);
  assert.equal(calls[0][1].remove[0].count, 1);
  assert.ok(ctx.commits.some(([name]) => name === 'cafe/clearPCA'));
  assert.ok(ctx.commits.some(([name, value]) => name === 'setData' && value === result));
});
test('failed change retains edits and rejects for callers', async () => {
  const ctx = context();
  await assert.rejects(actions.changeProductsOnTable.call({ $api: { $post: async () => {
    throw new Error('failure');
  } } }, ctx, { add: [], del: [] }), /failure/);
  assert.equal(ctx.commits.length, 0);
});
test('stock errors support even IDs and unknown responses', () => {
  const ctx = context();
  actions.throwBulkError(ctx, { response: { status: 400, data: { details: [{ product: 3488, remaining: 0 }] } } });
  assert.match(ctx.commits.pop()[1], /اسپرسو/);
  for (const error of [{ response: { status: 410, data: {} } }, { response: { status: 500 } }, new Error('offline')]) {
    assert.doesNotThrow(() => actions.throwBulkError(ctx, error));
    assert.equal(typeof ctx.commits.pop()[1], 'string');
  }
});
test('payment method failure rejects', async () => {
  await assert.rejects(actions.setPaymentMethod.call({ $api: { $post: async () => {
    throw new Error('failure');
  } } }, context(), []), /failure/);
});
test('menu submission settles empty changes and failures', async () => {
  assert.equal(await menu.methods.productsPayloadSeperator.call({ productChangeArray: [], $store: { commit() {} } }), true);
  const view = { productChangeArray: [{ product: 1, count: 1 }], $store: { dispatch: async () => { throw new Error('failure'); } } };
  await assert.rejects(menu.methods.productsPayloadSeperator.call(view), /failure/);
  assert.equal(view.orderSubmission, null);
});
test('repeated submit events share one in-flight operation', async () => {
  let release; let count = 0;
  const view = { productChangeArray: [{ product: 1, count: 1 }], $store: { dispatch: () => {
    count++; return new Promise(resolve => { release = resolve; });
  } } };
  const first = menu.methods.productsPayloadSeperator.call(view);
  const second = menu.methods.productsPayloadSeperator.call(view);
  assert.equal(first, second); assert.equal(count, 1);
  release(true); await first;
  assert.equal(view.orderSubmission, null);
});
