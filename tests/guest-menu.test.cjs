const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-source.cjs');

function rootActions(connect = () => {}) {
  return load('store/index.js', ['actions'], {
    Vue: { use() {}, prototype: { $connect: connect } }, Vuex: {}
  }).actions;
}

test('a shared link loads the anonymous menu without storing a checkout table', async () => {
  const commits = [], dispatches = [];
  const response = { data: { type: '2', token: 'shared-entry', cafe: { pk: 93 },
    table: { pk: null, uuid: null, number: '' }, has_staff_order: false, orders: null } };
  await rootActions().sendCode.call({ $axios: { get: async url => {
    assert.equal(url, 'v1/table-token/shared-entry/cafe-info/');
    return response;
  } } }, { commit: (...args) => commits.push(args), dispatch: name => dispatches.push(name) },
  { tableToken: 'shared-entry', hasToken: false });
  const entry = commits.find(([name]) => name === 'cafe/setEntryToken')[1];
  assert.equal(entry.token, 'shared-entry');
  assert.equal(entry.guest, true);
  assert.equal(commits.find(([name]) => name === 'table/setToken')[1].token, null);
  assert.ok(commits.some(([name, page]) => name === 'changeNavigation' && page === 'currentCafe'));
  assert.deepEqual(dispatches, ['cafe/retrieveMenu']);
});

function guestMenu() {
  const component = load('components/cafe/menu.vue', [], { Swiper: {}, login: {} });
  const changes = [{ product: 7, count: 2, capital: 90000 }];
  const view = { cafe: { guestBrowsing: true }, userIsloggedIn: false,
    productChangeArray: changes, checkoutLoginActive: false, orderSubmission: null };
  Object.entries(component.methods).forEach(([name, method]) => view[name] = method.bind(view));
  return { view, changes };
}

test('guest selection stays local and opens login only when checkout starts', async () => {
  const { view, changes } = guestMenu();
  view.$store = { dispatch() { throw new Error('anonymous checkout must not write'); } };
  assert.equal(await view.productsPayloadSeperator(), false);
  assert.equal(view.checkoutLoginActive, true);
  assert.equal(view.productChangeArray, changes);
  assert.equal(view.productChangeArray[0].count, 2);
});

test('login resolves the shared token before submitting the preserved basket once', async () => {
  const { view, changes } = guestMenu();
  let resolveTable;
  const calls = [];
  view.userIsloggedIn = true;
  view.checkoutLoginActive = true;
  view.$store = { dispatch: (name, payload) => {
    calls.push({ name, payload });
    if (name === 'resolveGuestTable') return new Promise(resolve => { resolveTable = resolve; });
    return Promise.resolve(true);
  } };
  const resumed = view.resumeCheckout();
  const repeated = view.productsPayloadSeperator();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'resolveGuestTable');
  assert.equal(view.checkoutLoginActive, false);
  resolveTable();
  await resumed;
  await repeated;
  assert.equal(calls.length, 2);
  assert.equal(calls[1].name, 'table/changeProductsOnTable');
  assert.equal(calls[1].payload.add[0].product, 7);
  assert.equal(calls[1].payload.add[0].count, 2);
  assert.equal(view.productChangeArray, changes);
});

test('failed authenticated table setup retains the guest basket for retry', async () => {
  const { view, changes } = guestMenu();
  view.userIsloggedIn = true;
  const calls = [];
  view.$store = { dispatch: async name => { calls.push(name); throw new Error('offline'); } };
  await assert.rejects(view.productsPayloadSeperator(), /offline/);
  assert.deepEqual(calls, ['resolveGuestTable']);
  assert.equal(view.productChangeArray, changes);
  assert.equal(view.orderSubmission, null);
});

test('authenticated resolution preserves the menu and binds the allocated preorder UUID', async () => {
  const calls = [];
  const state = { token: 'customer-auth', cafe: { pk: 93, entryToken: 'shared-entry', guestBrowsing: true } };
  const result = { cafe: { pk: 93 }, type: '2', menu_only: false, table: { uuid: 'private-table', number: 'Preorder' } };
  await rootActions(() => calls.push(['connect'])).resolveGuestTable.call({ $api: { get: async url => {
    assert.equal(url, 'v1/table-token/shared-entry/cafe-info/');
    return { data: result };
  } } }, { state, commit: (...args) => calls.push(args) });
  assert.equal(calls.find(([name]) => name === 'table/setToken')[1].token, 'private-table');
  assert.equal(calls.find(([name]) => name === 'table/setToken')[1].number, 'پیش سفارش');
  assert.ok(calls.some(([name, guest]) => name === 'cafe/setGuestBrowsing' && guest === false));
  assert.ok(calls.some(([name]) => name === 'connect'));
  assert.equal(calls.some(([name]) => name === 'cafe/setMenu' || name === 'cafe/clearPCA'), false);
});

test('a delayed login profile response cannot replace the guest checkout table', async () => {
  let finish;
  const calls = [];
  const { actions } = load('store/user.js', ['actions'], {
    Vue: { prototype: { $connect: () => calls.push(['connect']) } }
  });
  const context = { rootState: { token: 'customer-auth', cafe: { guestBrowsing: true } },
    commit: (...args) => calls.push(args) };
  const request = actions.retrieve.call({ $api: { $get: () => new Promise(resolve => { finish = resolve; }) } }, context);
  context.rootState.cafe.guestBrowsing = false;
  finish({ id: 7, active_table_uuid: 'previous-table' });
  await request;
  assert.deepEqual(calls.map(([name]) => name), ['set']);
});
