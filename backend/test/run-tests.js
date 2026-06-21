const http = require('http');
const fs = require('fs');
const path = require('path');

const TEST_DB = path.join(__dirname, 'test.db');
process.env.DB_PATH = TEST_DB;

for (const suffix of ['', '-wal', '-shm']) {
  const f = TEST_DB + suffix;
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
  }
}

const db = require('../db/database');
const { createTables } = require('../db/init');
const { app } = require('../server');

const VALID_ORDER_STATUSES = ['pending_payment', 'paid', 'cancelled', 'pending_sorting', 'pending_pickup', 'completed', 'refunded'];

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function request(method, pathStr, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api' + pathStr,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch (e) { resolve({ success: false, message: '非JSON响应: ' + buf }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const get = (p) => request('GET', p);
const post = (p, b) => request('POST', p, b);
const put = (p, b) => request('PUT', p, b);
const del = (p) => request('DELETE', p);

const results = [];
function assert(cond, msg) {
  if (cond) {
    results.push({ name: msg, pass: true });
    console.log('  ✅ ' + msg);
  } else {
    results.push({ name: msg, pass: false });
    console.log('  ❌ ' + msg);
  }
}

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

let PORT;
let server;

async function setupSeed() {
  await new Promise((resolve) => {
    db.serialize(() => {
      createTables(db);
      db.run('SELECT 1', () => resolve());
    });
  });

  const PD1 = futureDate(5);
  const PD2 = futureDate(6);

  await dbRun("INSERT INTO suppliers (name, contact, phone) VALUES (?, ?, ?)", ['测试供应商', '联系人', '13800000000']);
  await dbRun("INSERT INTO products (name, category, specification, group_price, stock, supplier_id, pickup_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'on')",
    ['测试苹果', '水果', '500g', 10, 2, 1, PD1]);
  await dbRun("INSERT INTO products (name, category, specification, group_price, stock, supplier_id, pickup_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'on')",
    ['测试香蕉', '水果', '1kg', 5, 1000, 1, PD2]);
  await dbRun("INSERT INTO products (name, category, specification, group_price, stock, supplier_id, pickup_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'on')",
    ['测试橙子', '水果', '500g', 8, 1000, 1, PD2]);
  const products = await dbAll('SELECT * FROM products');
  const P1 = products.find(p => p.name === '测试苹果');
  const P2 = products.find(p => p.name === '测试香蕉');
  const P3 = products.find(p => p.name === '测试橙子');

  await dbRun("INSERT INTO users (username, nickname, phone) VALUES (?, ?, ?)", ['u1', '用户一', '13900000001']);
  await dbRun("INSERT INTO users (username, nickname, phone) VALUES (?, ?, ?)", ['u2', '用户二', '13900000002']);
  const users = await dbAll('SELECT * FROM users');

  await dbRun("INSERT INTO pickup_points (name, address, status) VALUES (?, ?, 'active')", ['测试自提点', '测试地址']);
  await dbRun("INSERT INTO delivery_staff (name, phone, status) VALUES (?, ?, 'active')", ['测试配送员', '13900000003']);

  return { PD1, PD2, P1, P2, P3, U1: users[0], U2: users[1] };
}

async function testCartToOrder(ctx) {
  console.log('\n[1] 购物车下单流程');
  const { U1, P2 } = ctx;

  const addRes = await post('/cart', { user_id: U1.id, product_id: P2.id, quantity: 3 });
  assert(addRes.success, '加入购物车成功');

  const cartRes = await get('/cart/' + U1.id);
  assert(cartRes.success && cartRes.data.length === 1 && cartRes.data[0].quantity === 3, '购物车数量为3');
  const cartId = cartRes.data[0].cart_id;

  const updRes = await put('/cart/' + cartId, { quantity: 2 });
  assert(updRes.success && updRes.data.quantity === 2, '购物车数量调整为2');

  const orderRes = await post('/orders', {
    user_id: U1.id,
    items: [{ product_id: P2.id, quantity: 2 }],
    delivery_type: 'pickup',
    pickup_point_id: 1
  });
  assert(orderRes.success, '提交订单成功');
  assert(orderRes.data.status === 'pending_payment', '订单初始状态为待支付');
  assert(Math.abs(orderRes.data.total_amount - 10) < 0.001, '订单金额正确(2*5=10)');

  await del('/cart/user/' + U1.id + '/clear');
  const cartAfter = await get('/cart/' + U1.id);
  assert(cartAfter.success && cartAfter.data.length === 0, '下单后购物车已清空');
}

async function testPayAntiOversell(ctx) {
  console.log('\n[2] 支付防超卖');
  const { U1, U2, P1 } = ctx;

  const orderA = await post('/orders', {
    user_id: U1.id,
    items: [{ product_id: P1.id, quantity: 2 }],
    delivery_type: 'pickup',
    pickup_point_id: 1
  });
  assert(orderA.success, '订单A创建成功');

  const payA = await put('/orders/' + orderA.data.id + '/pay', {});
  assert(payA.success, '订单A支付成功(库存=2够用)');

  const stockA = await dbGet('SELECT stock FROM products WHERE id = ?', [P1.id]);
  assert(stockA.stock === 0, '支付后库存归零');

  const orderB = await post('/orders', {
    user_id: U2.id,
    items: [{ product_id: P1.id, quantity: 1 }],
    delivery_type: 'pickup',
    pickup_point_id: 1
  });
  assert(orderB.success, '订单B创建成功');

  const payB = await put('/orders/' + orderB.data.id + '/pay', {});
  assert(!payB.success, '订单B支付失败(库存不足防超卖)');

  const orderBCheck = await get('/orders/' + orderB.data.id);
  assert(orderBCheck.data.status === 'pending_payment', '订单B仍为待支付状态');

  const stockB = await dbGet('SELECT stock FROM products WHERE id = ?', [P1.id]);
  assert(stockB.stock === 0, '失败支付不改变库存');

  ctx.orderA = orderA.data;
}

async function testSortingSummary(ctx) {
  console.log('\n[3] 分拣汇总与订单明细一致');
  const { U1, U2, P2, P3, PD2 } = ctx;

  const orderC = await post('/orders', {
    user_id: U1.id,
    items: [{ product_id: P2.id, quantity: 3 }],
    delivery_type: 'pickup',
    pickup_point_id: 1
  });
  await put('/orders/' + orderC.data.id + '/pay', {});

  const orderD = await post('/orders', {
    user_id: U2.id,
    items: [{ product_id: P2.id, quantity: 2 }, { product_id: P3.id, quantity: 4 }],
    delivery_type: 'pickup',
    pickup_point_id: 1
  });
  await put('/orders/' + orderD.data.id + '/pay', {});

  const genRes = await post('/sorting/generate', { pickup_date: PD2 });
  assert(genRes.success, '生成分拣单成功');

  const detailRes = await get('/sorting/' + genRes.data.id);
  assert(detailRes.success, '获取分拣单详情成功');

  const items = detailRes.data.items || [];
  const p2Item = items.find(i => i.product_id === P2.id);
  const p3Item = items.find(i => i.product_id === P3.id);
  assert(p2Item && p2Item.total_quantity === 5, '香蕉汇总数量=3+2=5');
  assert(p3Item && p3Item.total_quantity === 4, '橙子汇总数量=4');

  const orderItems = await dbAll('SELECT * FROM order_items WHERE order_id IN (?, ?)', [orderC.data.id, orderD.data.id]);
  const aggP2 = orderItems.filter(i => i.product_id === P2.id).reduce((s, i) => s + i.quantity, 0);
  const aggP3 = orderItems.filter(i => i.product_id === P3.id).reduce((s, i) => s + i.quantity, 0);
  assert(aggP2 === p2Item.total_quantity, '分拣项与订单明细聚合一致(香蕉)');
  assert(aggP3 === p3Item.total_quantity, '分拣项与订单明细聚合一致(橙子)');

  ctx.sortingId = genRes.data.id;
  ctx.p2SortItemId = p2Item.id;
  ctx.orderC = orderC.data;
  ctx.orderD = orderD.data;
}

async function testShortageRefund(ctx) {
  console.log('\n[4] 缺货退款(分拣标记缺货)');
  const { P2 } = ctx;

  const before = await dbAll('SELECT id, quantity, refund_quantity FROM order_items WHERE product_id = ?', [P2.id]);
  const beforeRefundSum = before.reduce((s, i) => s + (i.refund_quantity || 0), 0);

  const shortageRes = await put('/sorting/item/' + ctx.p2SortItemId + '/shortage', { shortage_quantity: 2 });
  assert(shortageRes.success, '标记缺货2件成功');

  const si = await dbGet('SELECT * FROM sorting_items WHERE id = ?', [ctx.p2SortItemId]);
  assert(si.shortage_quantity === 2, '分拣项缺货数量=2');

  const after = await dbAll('SELECT id, order_id, quantity, refund_quantity FROM order_items WHERE product_id = ?', [P2.id]);
  const afterRefundSum = after.reduce((s, i) => s + (i.refund_quantity || 0), 0);
  assert(afterRefundSum - beforeRefundSum === 2, '订单明细退款数量合计增加2(按实际缺货)');

  const refundedItems = after.filter(i => (i.refund_quantity || 0) > 0);
  for (const ri of refundedItems) {
    assert(ri.refund_quantity <= ri.quantity, '退款数量不超过购买数量(非整单恢复)');
  }

  const orderRows = await dbAll('SELECT id, refund_amount, status FROM orders WHERE id IN (?, ?)', [ctx.orderC.id, ctx.orderD.id]);
  const totalRefundAmount = orderRows.reduce((s, o) => s + (o.refund_amount || 0), 0);
  assert(Math.abs(totalRefundAmount - 2 * P2.group_price) < 0.001, '退款金额=缺货数量*单价(2*5=10)');

  const allStillPendingOrRefunded = orderRows.every(o => ['pending_sorting', 'refunded'].includes(o.status));
  assert(allStillPendingOrRefunded, '缺货后订单状态仍为合法状态(未写入非法状态)');
}

async function testDeliveryFlow(ctx) {
  console.log('\n[5] 配送状态流转');
  const { U1, P2 } = ctx;

  const order = await post('/orders', {
    user_id: U1.id,
    items: [{ product_id: P2.id, quantity: 1 }],
    delivery_type: 'delivery',
    address: '测试配送地址'
  });
  assert(order.success, '配送订单创建成功');
  const pay = await put('/orders/' + order.data.id + '/pay', {});
  assert(pay.success, '配送订单支付成功');

  const createRes = await post('/delivery', { order_id: order.data.id, delivery_staff_id: 1 });
  assert(createRes.success, '创建配送单成功');
  assert(createRes.data.status === 'pending', '配送单初始状态为pending');

  const orderAfterCreate = await get('/orders/' + order.data.id);
  assert(orderAfterCreate.data.status === 'paid', '创建配送单后订单仍为paid(未写入pending_delivery)');

  const startRes = await put('/delivery/' + createRes.data.id + '/start', {});
  assert(startRes.success && startRes.data.status === 'delivering', '开始配送成功');
  const orderAfterStart = await get('/orders/' + order.data.id);
  assert(orderAfterStart.data.status === 'paid', '配送中订单仍为paid(未写入delivering)');

  const completeRes = await put('/delivery/' + createRes.data.id + '/complete', {});
  assert(completeRes.success && completeRes.data.status === 'completed', '完成配送成功');
  const orderAfterComplete = await get('/orders/' + order.data.id);
  assert(orderAfterComplete.data.status === 'completed', '配送完成后订单为completed');

  const dupRes = await post('/delivery', { order_id: order.data.id, delivery_staff_id: 1 });
  assert(!dupRes.success, '重复创建配送单被拦截');

  assert(VALID_ORDER_STATUSES.includes(orderAfterComplete.data.status), '订单状态属于合法枚举');
}

async function testPickupVerify(ctx) {
  console.log('\n[6] 自提核销');
  const completeRes = await put('/sorting/' + ctx.sortingId + '/complete', {});
  assert(completeRes.success, '完成分拣成功');

  const orderC = await get('/orders/' + ctx.orderC.id);
  assert(orderC.data.status === 'pending_pickup', '分拣完成后订单变为待提货');
  assert(!!orderC.data.pickup_code, '自提订单有核销码');

  const wrongRes = await get('/orders/' + ctx.orderC.id + '/pickup-verify?pickup_code=000000');
  assert(!wrongRes.success, '错误核销码被拒绝');

  const verifyRes = await get('/orders/' + ctx.orderC.id + '/pickup-verify?pickup_code=' + orderC.data.pickup_code);
  assert(verifyRes.success && verifyRes.data.status === 'completed', '正确核销码核销成功，订单完成');
}

async function testStatsNonRegression() {
  console.log('\n[7] 统计报表不回归');
  const overview = await get('/stats/overview');
  assert(overview.success && typeof overview.data.gmv !== 'undefined', '统计总览接口正常');

  const products = await get('/stats/products');
  assert(products.success && Array.isArray(products.data), '商品销量统计接口正常');

  const refundRate = await get('/stats/refund-rate');
  assert(refundRate.success && typeof refundRate.data.refund_rate !== 'undefined', '退款率统计接口正常');

  const unpicked = await get('/stats/unpicked-orders');
  assert(unpicked.success, '待提货统计接口正常');
}

async function main() {
  const ctx = await setupSeed();

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      PORT = server.address().port;
      resolve();
    });
  });
  console.log('测试服务器启动于端口 ' + PORT);

  try {
    await testCartToOrder(ctx);
    await testPayAntiOversell(ctx);
    await testSortingSummary(ctx);
    await testShortageRefund(ctx);
    await testDeliveryFlow(ctx);
    await testPickupVerify(ctx);
    await testStatsNonRegression();
  } catch (e) {
    console.error('\n测试执行异常:', e);
    results.push({ name: '测试执行异常', pass: false });
  }

  const failed = results.filter(r => !r.pass).length;
  const total = results.length;
  console.log('\n========================================');
  console.log(`  测试结果: ${total - failed}/${total} 通过`);
  console.log('========================================');

  await new Promise((r) => server.close(r));
  db.close();
  process.exit(failed > 0 ? 1 : 0);
}

main();
