const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-source.cjs');
const menu = load('components/cafe/menu.vue', [], { Swiper: {}, login: {} });

test('menu removes exact listeners when product details destroy it', () => {
  const listeners = new Map();
  const bus = { $on(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    $off(name, fn) { listeners.get(name).delete(fn); } };
  let submissions = 0;
  function mount() { const view = { $nuxt: bus, changeActiveCategory() {}, handleSubmitOrders() { submissions++; } };
    menu.created.call(view); return view; }
  const first = mount(); menu.beforeDestroy.call(first);
  const current = mount();
  for (const handler of listeners.get('triggerSubmitOrders')) handler();
  assert.equal(submissions, 1);
  menu.beforeDestroy.call(current);
  assert.equal(listeners.get('triggerSubmitOrders').size, 0);
});
test('empty or destroyed menu does not poll and single-category menu selects its first page', () => {
  let ticks = 0, pages = [];
  const view = { menu: [], activeCategory: 5, menuTabItemCategories: [], $refs: {},
    $nextTick: fn => { ticks++; fn(); } };
  menu.methods.setActiveTab.call(view, true);
  assert.equal(ticks, 1);
  view.menu = [{ pk: 9, products: [{ pk: 2 }] }]; view.menuTabItemCategories = view.menu;
  view.$refs.menuCategoriesSwipe = { setPage: page => pages.push(page) };
  menu.methods.setActiveTab.call(view, true);
  assert.equal(pages[0], 1);
  view._isDestroyed = true;
  menu.methods.setActiveTab.call(view, true);
  assert.equal(pages.length, 1);
});

test('an asynchronously loaded menu shows all products while the current basket is empty', () => {
  const pages = [];
  const view = { menu: [], activeCategory: 1, menuTabItemCategories: [],
    $refs: { menuCategoriesSwipe: { setPage: page => pages.push(page) } }, $nextTick: fn => fn() };
  menu.methods.setActiveTab.call(view, true);
  assert.equal(view.activeCategory, 1);
  assert.deepEqual(pages, []);
  view.menu = [
    { pk: -1, localType: 'CURRENT_ORDER', products: [] },
    { pk: 0, localType: 'ALL', products: [{ pk: 2 }] },
    { pk: 9, localType: 'CATEGORY', products: [{ pk: 2 }] }
  ];
  view.menuTabItemCategories = [...view.menu].reverse();
  menu.methods.setActiveTab.call(view, true);
  assert.equal(view.activeCategory, 1);
  assert.equal(pages[0], 2);
  view.activeCategory = 0;
  menu.methods.setActiveTab.call(view, true);
  assert.equal(view.activeCategory, 1);
  assert.equal(pages[1], 2);
});

test('login resend timers cannot overlap or survive component destruction', () => {
  for (const file of ['login.vue', 'loginProfile.vue']) {
    let sequence = 0;
    const timers = new Map();
    const component = load('components/user/' + file, [], {
      setInterval: callback => { timers.set(++sequence, callback); return sequence; },
      clearInterval: id => timers.delete(id)
    });
    const view = {};
    component.methods.runTimer.call(view);
    component.methods.runTimer.call(view);
    assert.equal(timers.size, 1);
    const tick = [...timers.values()][0];
    for (let index = 0; index < 120; index++) tick();
    assert.equal(view.resendTime, 0);
    assert.equal(timers.size, 0);
    component.methods.runTimer.call(view);
    component.beforeDestroy.call(view);
    assert.equal(timers.size, 0);
  }
});
