const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-source.cjs');

test('logout clears cached personal and cafe state and disconnects the socket', () => {
  const calls = [];
  const { actions } = load('store/index.js', ['actions'], { Vue: { use() {}, prototype: { $disconnect: () => calls.push('disconnect') } }, Vuex: {} });
  actions.logout({ commit: name => calls.push(name) });
  for (const action of ['disconnect', 'clearToken', 'user/clear', 'cafe/clear', 'table/clearData']) assert.ok(calls.includes(action));
  const { mutations: user } = load('store/user.js', ['mutations']);
  const state = { user: { id: 1 }, history: { data: [{ pk: 2 }] } };
  user.clear(state);
  assert.equal(state.history.data.length, 0);
  assert.equal(Object.keys(state.user).length, 0);
  const { mutations: cafe } = load('store/cafe.js', ['mutations']);
  const oldCafe = { pk: 1, productChangeArray: [{ product: 1, count: 1 }], my_credit_in_cafe: 100 };
  cafe.clear(oldCafe);
  assert.equal(oldCafe.pk, null);
  assert.equal(oldCafe.productChangeArray.length, 0);
  assert.equal(oldCafe.my_credit_in_cafe, 0);
});
test('profile response after logout cannot restore old user data', async () => {
  const { actions } = load('store/user.js', ['actions']);
  let resolve; const commits = [];
  const context = { rootState: { token: 'old' }, commit: (...args) => commits.push(args) };
  const request = actions.retrieve.call({ $api: { $get: () => new Promise(done => { resolve = done; }) } }, context);
  context.rootState.token = null;
  resolve({ pk: 1, active_table_uuid: 'old-table' });
  assert.equal(await request, null);
  assert.equal(commits.length, 0);
});

test('restoring an active preorder does not treat its table UUID as a QR token', async () => {
  const layout = load('layouts/default.vue');
  const calls = [];
  const view = { tableActive: true, tableToken: 'preorder-uuid',
    $router: { currentRoute: { path: '/user/home' } }, $store: { dispatch(name) {
      calls.push(name); return Promise.resolve({ active_table_uuid: 'preorder-uuid', first_name: 'کاربر' });
    } } };
  layout.watch.userIsloggedInRoot.handler.call(view, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['user/retrieve']);
});
