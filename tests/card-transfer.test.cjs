const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-source.cjs');

function setup(api = {}) {
  const revoked = [];
  const page = load('pages/user/card-transfer/_id.vue', [], {
    FormData: class { append() {} },
    URL: { createObjectURL: () => 'blob:preview', revokeObjectURL: value => revoked.push(value) }
  });
  const commits = [], routes = [];
  const view = { ...page.data(), transfer: { uuid: 'receipt-1', join: 12, status: 'draft' },
    $route: { params: { id: 'receipt-1' } }, $nonBlockingApi: api,
    $store: { commit: (...args) => commits.push(args) }, localePath: path => path,
    $router: { replace: async path => routes.push(path) } };
  Object.entries(page.methods).forEach(([key, method]) => view[key] = method.bind(view));
  return { page, view, commits, routes, revoked };
}

test('selecting a receipt uploads once and completes checkout without an approval step', async () => {
  let finish, calls = 0;
  const { view, commits, revoked } = setup({ $post: async () => {
    calls++; return new Promise(resolve => { finish = resolve; });
  } });
  view.chooseReceipt({ target: { files: [{ type: 'image/png', size: 1200 }], value: 'image.png' } });
  assert.equal(calls, 1);
  assert.equal(view.uploading, true);
  await view.uploadReceipt();
  assert.equal(calls, 1);
  finish({ uuid: 'receipt-1', join: 12, status: 'submitted' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(view.transfer.status, 'submitted');
  assert.equal(view.uploading, false);
  assert.equal(view.selectedFile, null);
  assert.deepEqual(revoked, ['blob:preview']);
  assert.equal(commits[0][0], 'table/setCardTransfer');
});

test('network failure keeps the receipt and retries the same checkout reference', async () => {
  let calls = 0; const urls = [];
  const { view } = setup({ $post: async url => {
    urls.push(url);
    if (++calls === 1) throw new Error('connection lost after upload');
    return { uuid: 'receipt-1', join: 12, status: 'submitted' };
  } });
  const file = { type: 'image/jpeg', size: 1200 };
  view.selectedFile = file;
  await view.uploadReceipt();
  assert.equal(view.selectedFile, file);
  assert.equal(view.uploading, false);
  assert.ok(view.error);
  await view.uploadReceipt();
  assert.deepEqual(urls, ['v1/card-transfers/receipt-1/receipt/', 'v1/card-transfers/receipt-1/receipt/']);
  assert.equal(view.transfer.status, 'submitted');
});

test('reload restores submitted receipt without requiring another file or payment', async () => {
  const { view } = setup({ $get: async () => ({ uuid: 'receipt-1', join: 12, status: 'submitted' }) });
  await view.load();
  assert.equal(view.transfer.status, 'submitted');
  assert.equal(view.selectedFile, null);
  assert.equal(view.loading, false);
});

test('invalid files do not start a network request', () => {
  const { view } = setup({ $post: () => { throw new Error('must not upload'); } });
  for (const file of [{ type: 'image/png', size: 8 * 1024 * 1024 + 1 }, { type: 'image/svg+xml', size: 100 }]) {
    const target = { files: [file], value: 'file' };
    view.chooseReceipt({ target });
    assert.equal(target.value, '');
    assert.equal(view.selectedFile, null);
    assert.ok(view.error);
  }
});

test('changed order allows a fresh quote without automatically submitting a stale receipt', async () => {
  const { view, routes } = setup({ $post: async () => ({ uuid: 'receipt-2', join: 12, status: 'draft', amount: 25000 }) });
  view.quoteChanged = true;
  view.selectedFile = {};
  await view.restart();
  assert.equal(view.transfer.amount, 25000);
  assert.equal(view.quoteChanged, false);
  assert.deepEqual(routes, ['/user/card-transfer/receipt-2']);
});

test('receipt responses cannot overwrite a different active order', () => {
  const { mutations } = load('store/table.js', ['mutations']);
  const state = { joinId: 12, cardTransfer: null };
  mutations.setCardTransfer(state, { join: 13, status: 'submitted' });
  assert.equal(state.cardTransfer, null);
  mutations.setCardTransfer(state, { join: 12, status: 'submitted' });
  assert.equal(state.cardTransfer.status, 'submitted');
});

test('receipt checkout bypasses gateway availability and does not use cafe wallet credit or gateway fees', () => {
  const page = load('components/user/table.vue', [], { person: {}, addressList: {} });
  const context = { paymentMethod: 'card-transfer', cafe: { fee_payer: false, cafepay_fee: 0.02 }, totalWishToPayOrder: 50000 };
  assert.equal(page.computed.cafepayFee.call(context), 0);
  assert.match(page.computed.checkoutLabel.call(context), /رسید/);
  assert.equal(page.computed.cardTransferAvailable.call({ cafe: { card_transfer_enabled: true }, tokenType: 'delivery' }), true);
  assert.equal(page.computed.cardTransferAvailable.call({ cafe: { card_transfer_enabled: true }, tokenType: 'normal' }), false);
});

test('lost upload response is recovered by reading saved status without another customer action', async () => {
  let uploads = 0;
  const { view } = setup({
    $post: async () => { uploads++; throw new Error('response lost'); },
    $get: async () => ({ uuid: 'receipt-1', join: 12, status: 'submitted' })
  });
  view.selectedFile = { type: 'image/png', size: 1000 };
  await view.uploadReceipt();
  assert.equal(uploads, 1);
  assert.equal(view.transfer.status, 'submitted');
  assert.equal(view.error, '');
  assert.equal(view.selectedFile, null);
  assert.equal(view.uploading, false);
});
