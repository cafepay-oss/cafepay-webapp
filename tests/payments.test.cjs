const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-source.cjs');
const { Table } = load('middleware/models/table.js', ['Table']);
const { mutations } = load('store/table.js', ['mutations']);

for (const paid of [0, 10000, 25000, 50000, 75000]) {
  test(`cashier allocation preserves payment ${paid} and input data`, () => {
    const input = Object.freeze({ count: 2, unit_amount: 25000, wish_to_pay: Math.max(0, 50000 - paid),
      payment_info: Object.freeze({ total_amount: 50000, total_count: 2,
        net_payed_amount: paid, payed_amount: paid + 1000, refund_amount: 1000,
        net_amount: 50000 - paid, payed_amount_online: paid + 1000 }) });
    const orders = [];
    Table.prototype.separateCashierOrders(orders, input);
    const sum = key => orders.reduce((total, order) => total + order.payment_info[key], 0);
    assert.equal(sum('total_amount'), 50000);
    assert.equal(sum('net_payed_amount'), paid);
    assert.equal(sum('payed_amount'), paid + 1000);
    assert.equal(sum('refund_amount'), 1000);
    assert.equal(sum('net_amount'), 50000 - paid);
    assert.equal(orders.reduce((total, order) => total + order.wish_to_pay, 0), Math.max(0, 50000 - paid));
    assert.equal(input.payment_info.net_payed_amount, paid);
    assert.ok(orders.every(order => order.paid === (order.payment_info.net_amount <= 0)));
  });
}
test('cashier selection charges only the remaining debt for the selected person', () => {
  const makeOrder = () => ({ payment_info: { total_amount: 25000, net_payed_amount: 10000 } });
  const state = { persons: [{ id: 1, cashier: true, orders: [makeOrder()] },
    { id: 2, cashier: true, orders: [makeOrder()] }] };
  mutations.changeChashierCount(state, { personId: 2, index: 0, cashier_count: 1 });
  assert.equal(state.persons[1].orders[0].wish_to_pay, 15000);
  assert.equal(state.persons[0].orders[0].wish_to_pay, undefined);
  mutations.changeChashierCount(state, { personId: 2, index: 0, cashier_count: 0 });
  assert.equal(state.persons[1].orders[0].wish_to_pay, 0);
});

test('excess payment on one order cannot hide debt on another order', () => {
  const { Table: Model } = load('middleware/models/table.js', ['Table'], {
    Avatars: class { create() { return ''; } }, sprites: {}
  });
  const order = (id, total, paid) => ({ pk: id, count: 1, unit_amount: total,
    user_profile: { pk: 1, full_name: 'کاربر' }, product_data: { name: 'قهوه' },
    preferred_payment_method: '0', is_staff: false,
    payment_info: { total_amount: total, net_payed_amount: paid } });
  const table = new Model({ bill_products: [order(1, 50000, 75000), order(2, 25000, 0)] }, 1);
  assert.equal(table.paid, false);
  assert.equal(table.persons[0].totalPaid, 75000);
  assert.equal(table.persons[0].orders.reduce((sum, item) => sum + item.wish_to_pay, 0), 25000);
});
