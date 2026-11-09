const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-source.cjs');
const { mutations } = load('store/cafe.js', ['mutations']);

function menuState() {
  return { categories: [{ localType: 'CURRENT_ORDER', products: [] },
    { localType: 'ALL', products: [{ pk: 1, count: 7 }, { pk: 2, count: 0 }] },
    { localType: 'CATEGORY', products: [{ pk: 1, count: 7 }, { pk: 2, count: 0 }] }],
    productChangeArray: [], totalCount: 7 };
}
test('empty table clears stale counts without an undefined variable or missing-category crash', () => {
  const state = menuState();
  assert.doesNotThrow(() => mutations.bindProductCount(state, null));
  assert.equal(state.totalCount, 0);
  assert.equal(state.categories[1].products[0].count, 0);
  assert.doesNotThrow(() => mutations.bindProductCount({ categories: [] }, false));
  assert.doesNotThrow(() => mutations.clearBasket({ categories: [] }));
});
test('socket refresh preserves pending menu edits and counts each product once', () => {
  const state = menuState();
  state.productChangeArray = [{ product: 1, count: 2 }, { product: 2, count: 1 }];
  mutations.bindProductCount(state, { orders: [{ product: 1, count: 1, unit_amount: 25000,
    payment_info: { net_payed_amount: 10000 } }] });
  assert.equal(state.categories[1].products[0].count, 3);
  assert.equal(state.categories[2].products[0].reduceLimit, 1);
  assert.equal(state.categories[0].products.length, 2);
  assert.equal(state.totalCount, 4);
  assert.equal(state.productChangeArray[0].count, 2);
});

test('menu keeps category order and unique product lookup without mutating API data', () => {
  const { mutations, getters } = load('store/cafe.js', ['mutations', 'getters'], {
    Category: class { constructor(data) { Object.assign(this, data); } }
  });
  const response = { categories: [
    { pk: 2, order: 2, products: [{ pk: 9 }] },
    { pk: 1, order: 1, products: [{ pk: 9 }, { pk: 10 }] }
  ] };
  const state = {};
  mutations.setMenu.call({ app: { i18n: { t: value => value } } }, state, response);
  assert.equal(state.categories[2].pk, 1);
  assert.equal(state.categories[3].pk, 2);
  assert.equal(getters.productsFlatten(state).length, 2);
  assert.equal(response.categories[0].pk, 2);
});
