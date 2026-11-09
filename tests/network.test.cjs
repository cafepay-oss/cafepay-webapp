const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-source.cjs');

test('blocking requests keep loading until all requests finish', () => {
  const clients = [];
  function client() { const result = { onRequest(fn) { this.request = fn; },
    onResponse(fn) { this.response = fn; }, onError(fn) { this.error = fn; }, create: client };
    clients.push(result); return result; }
  const root = client(), commits = [];
  load('plugins/axios.js')({ $axios: root, store: { state: { token: 'test' },
    commit: (...args) => commits.push(args) }, app: { i18n: { t: () => 'خطای شبکه' } } }, () => {});
  const first = { headers: { common: {} } }, second = { headers: { common: {} } };
  clients[1].request(first); root.request(second);
  clients[1].response({ config: first });
  assert.equal(commits.at(-1)[1], true);
  assert.doesNotThrow(() => root.error({ config: second }));
  assert.equal(commits.at(-2)[1], false);
  assert.equal(commits.at(-1)[1], 'خطای شبکه');
  clients[2].request({ headers: { common: {} } });
  assert.equal(commits.filter(([name]) => name === 'toggleLoading').length, 4);
});
test('socket ignores invalid envelopes and accepts the active table update', () => {
  const { mutations } = load('store/index.js', ['mutations'], { Vue: { use() {}, prototype: {} }, Vuex: {} });
  const state = { socket: {}, table: { token: 'test' } }, commits = [];
  const store = { commit: (...args) => commits.push(args) };
  for (const data of ['invalid', 'null', '{}', '{"message":{"error":"invalid"}}', '{"message":{"source":"other"}}']) {
    assert.doesNotThrow(() => mutations.SOCKET_ONMESSAGE.call(store, state, { data }));
  }
  mutations.SOCKET_ONMESSAGE.call(store, state, { data: JSON.stringify({ message: {
    source: 'table.test.join.simple.by-token.', status_code: 200, data: { pk: 1 }
  } }) });
  assert.equal(commits.length, 1);
  assert.equal(commits[0][0], 'table/setData');
  assert.equal(commits[0][1].pk, 1);
});
