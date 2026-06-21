const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data.db');
const db = new sqlite3.Database(dbPath);

function generateOrderNo() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${timestamp}${random}`;
}

function generatePickupCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateSortingNo(pickupDate, sequence) {
  const dateStr = pickupDate.replace(/-/g, '');
  const seqStr = sequence.toString().padStart(3, '0');
  return `SORT${dateStr}${seqStr}`;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFutureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

const chineseNames = [
  '张伟', '王芳', '李娜', '刘洋', '陈静',
  '杨帆', '赵敏', '黄磊', '周杰', '吴磊',
  '徐婷', '孙浩', '马丽', '朱军', '胡静',
  '林涛', '何琳', '高远', '罗晨', '郑悦'
];

const communities = [
  '阳光花园', '绿城小区', '幸福家园', '金色年华', '锦绣家园',
  '翠湖天地', '碧水湾', '东方明珠', '星河湾', '橡树湾'
];

const suppliersData = [
  { name: '绿源蔬果', contact: '张经理', phone: '13900001001' },
  { name: '鲜达肉蛋', contact: '李经理', phone: '13900001002' },
  { name: '金龙粮油', contact: '王经理', phone: '13900001003' },
  { name: '佳居日用品', contact: '赵经理', phone: '13900001004' },
  { name: '美味零食', contact: '孙经理', phone: '13900001005' }
];

const productsData = [
  { name: '西红柿', category: '蔬果', specification: '500g/份', price: 4.5, stock: 300, supplierIdx: 0, cutoff: '18:00' },
  { name: '黄瓜', category: '蔬果', specification: '500g/份', price: 3.8, stock: 250, supplierIdx: 0, cutoff: '18:00' },
  { name: '土豆', category: '蔬果', specification: '1kg/份', price: 5.2, stock: 400, supplierIdx: 0, cutoff: '18:00' },
  { name: '苹果', category: '蔬果', specification: '1kg/份', price: 8.9, stock: 200, supplierIdx: 0, cutoff: '18:00' },
  { name: '香蕉', category: '蔬果', specification: '1kg/份', price: 6.5, stock: 180, supplierIdx: 0, cutoff: '18:00' },
  { name: '橙子', category: '蔬果', specification: '1kg/份', price: 7.8, stock: 220, supplierIdx: 0, cutoff: '18:00' },
  { name: '猪肉', category: '肉蛋', specification: '500g/份', price: 25.0, stock: 150, supplierIdx: 1, cutoff: '20:00' },
  { name: '牛肉', category: '肉蛋', specification: '500g/份', price: 45.0, stock: 100, supplierIdx: 1, cutoff: '20:00' },
  { name: '鸡肉', category: '肉蛋', specification: '1kg/份', price: 18.0, stock: 200, supplierIdx: 1, cutoff: '20:00' },
  { name: '鸡蛋', category: '肉蛋', specification: '10枚/盒', price: 12.0, stock: 500, supplierIdx: 1, cutoff: '20:00' },
  { name: '鸭肉', category: '肉蛋', specification: '1kg/份', price: 22.0, stock: 120, supplierIdx: 1, cutoff: '20:00' },
  { name: '鱼肉', category: '肉蛋', specification: '500g/份', price: 32.0, stock: 130, supplierIdx: 1, cutoff: '20:00' },
  { name: '大米', category: '粮油', specification: '5kg/袋', price: 35.0, stock: 300, supplierIdx: 2, cutoff: '22:00' },
  { name: '面粉', category: '粮油', specification: '5kg/袋', price: 28.0, stock: 250, supplierIdx: 2, cutoff: '22:00' },
  { name: '花生油', category: '粮油', specification: '5L/桶', price: 89.0, stock: 150, supplierIdx: 2, cutoff: '22:00' },
  { name: '玉米油', category: '粮油', specification: '5L/桶', price: 75.0, stock: 180, supplierIdx: 2, cutoff: '22:00' },
  { name: '酱油', category: '粮油', specification: '500ml/瓶', price: 12.5, stock: 400, supplierIdx: 2, cutoff: '22:00' },
  { name: '醋', category: '粮油', specification: '500ml/瓶', price: 8.5, stock: 350, supplierIdx: 2, cutoff: '22:00' },
  { name: '洗衣液', category: '日用品', specification: '2kg/瓶', price: 25.0, stock: 200, supplierIdx: 3, cutoff: '22:00' },
  { name: '洗洁精', category: '日用品', specification: '500ml/瓶', price: 10.0, stock: 300, supplierIdx: 3, cutoff: '22:00' },
  { name: '纸巾', category: '日用品', specification: '10包/提', price: 18.0, stock: 400, supplierIdx: 3, cutoff: '22:00' },
  { name: '牙膏', category: '日用品', specification: '120g/支', price: 15.0, stock: 350, supplierIdx: 3, cutoff: '22:00' },
  { name: '香皂', category: '日用品', specification: '100g/块', price: 6.0, stock: 500, supplierIdx: 3, cutoff: '22:00' },
  { name: '垃圾袋', category: '日用品', specification: '50只/卷', price: 8.0, stock: 450, supplierIdx: 3, cutoff: '22:00' },
  { name: '薯片', category: '零食', specification: '100g/袋', price: 8.5, stock: 300, supplierIdx: 4, cutoff: '22:00' },
  { name: '饼干', category: '零食', specification: '200g/盒', price: 12.0, stock: 250, supplierIdx: 4, cutoff: '22:00' },
  { name: '巧克力', category: '零食', specification: '100g/盒', price: 18.0, stock: 200, supplierIdx: 4, cutoff: '22:00' },
  { name: '糖果', category: '零食', specification: '200g/袋', price: 10.0, stock: 350, supplierIdx: 4, cutoff: '22:00' },
  { name: '坚果', category: '零食', specification: '200g/袋', price: 25.0, stock: 180, supplierIdx: 4, cutoff: '22:00' },
  { name: '方便面', category: '零食', specification: '5连包/袋', price: 15.0, stock: 400, supplierIdx: 4, cutoff: '22:00' }
];

const pickupPointsData = [
  { name: '阳光花园自提点', address: '阳光花园小区1号楼1单元101', contact: '刘阿姨', phone: '13800002001' },
  { name: '绿城小区自提点', address: '绿城小区物业服务中心', contact: '王大叔', phone: '13800002002' },
  { name: '幸福家园自提点', address: '幸福家园南门便利店', contact: '张姐', phone: '13800002003' }
];

const deliveryStaffData = [
  { name: '张师傅', phone: '13700003001' },
  { name: '李师傅', phone: '13700003002' },
  { name: '王师傅', phone: '13700003003' }
];

function runSeed() {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = OFF');

    console.log('清空现有数据...');
    db.run('DELETE FROM after_sales');
    db.run('DELETE FROM deliveries');
    db.run('DELETE FROM sorting_items');
    db.run('DELETE FROM sorting_orders');
    db.run('DELETE FROM order_items');
    db.run('DELETE FROM orders');
    db.run('DELETE FROM delivery_staff');
    db.run('DELETE FROM pickup_points');
    db.run('DELETE FROM users');
    db.run('DELETE FROM products');
    db.run('DELETE FROM suppliers');
    db.run("DELETE FROM sqlite_sequence WHERE name IN ('suppliers','products','users','pickup_points','delivery_staff','orders','order_items','sorting_orders','sorting_items','deliveries','after_sales')");

    console.log('开始插入供应商数据...');
    const supplierStmt = db.prepare('INSERT INTO suppliers (name, contact, phone) VALUES (?, ?, ?)');
    suppliersData.forEach((supplier) => {
      supplierStmt.run(supplier.name, supplier.contact, supplier.phone);
    });
    supplierStmt.finalize();

    console.log('开始插入商品数据...');
    const productStmt = db.prepare(
      'INSERT INTO products (name, category, specification, group_price, stock, supplier_id, cutoff_time, pickup_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    productsData.forEach((product) => {
      const pickupDays = Math.floor(Math.random() * 3) + 1;
      const pickupDate = getFutureDate(pickupDays);
      const supplierId = product.supplierIdx + 1;
      productStmt.run(
        product.name, product.category, product.specification,
        product.price, product.stock, supplierId,
        product.cutoff, pickupDate, 'on'
      );
    });
    productStmt.finalize();

    console.log('开始插入用户数据...');
    const userStmt = db.prepare('INSERT INTO users (username, nickname, phone, address) VALUES (?, ?, ?, ?)');
    for (let i = 0; i < 20; i++) {
      const username = `user${i + 1}`;
      const nickname = chineseNames[i];
      const phone = `138000000${String(i + 1).padStart(2, '0')}`;
      const community = communities[Math.floor(Math.random() * communities.length)];
      const building = Math.floor(Math.random() * 20) + 1;
      const unit = Math.floor(Math.random() * 3) + 1;
      const room = String(Math.floor(Math.random() * 20) + 1).padStart(2, '0');
      const address = `${community}${building}号楼${unit}单元${room}室`;
      userStmt.run(username, nickname, phone, address);
    }
    userStmt.finalize();

    console.log('开始插入自提点数据...');
    const pickupPointStmt = db.prepare('INSERT INTO pickup_points (name, address, contact, phone, status) VALUES (?, ?, ?, ?, ?)');
    pickupPointsData.forEach((point) => {
      pickupPointStmt.run(point.name, point.address, point.contact, point.phone, 'active');
    });
    pickupPointStmt.finalize();

    console.log('开始插入配送员数据...');
    const deliveryStaffStmt = db.prepare('INSERT INTO delivery_staff (name, phone, status) VALUES (?, ?, ?)');
    deliveryStaffData.forEach((staff) => {
      deliveryStaffStmt.run(staff.name, staff.phone, 'active');
    });
    deliveryStaffStmt.finalize();

    console.log('开始插入订单数据...');
    const statusDistribution = [
      { status: 'pending_payment', count: 5 },
      { status: 'paid', count: 10 },
      { status: 'cancelled', count: 5 },
      { status: 'pending_sorting', count: 10 },
      { status: 'pending_pickup', count: 10 },
      { status: 'completed', count: 8 },
      { status: 'refunded', count: 2 }
    ];

    const stockDeductionStatuses = ['paid', 'pending_sorting', 'pending_pickup', 'completed', 'refunded'];
    const stockDeductions = {};
    const allOrders = [];

    let orderIndex = 0;
    const orderStmt = db.prepare(
      `INSERT INTO orders (order_no, user_id, total_amount, status, delivery_type, pickup_point_id, pickup_code, address, pickup_date, paid_at, refund_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const orderItemStmt = db.prepare(
      `INSERT INTO order_items (order_id, product_id, product_name, specification, price, quantity, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    statusDistribution.forEach(({ status, count }) => {
      for (let i = 0; i < count; i++) {
        const userId = (orderIndex % 20) + 1;
        const isPickup = Math.random() < 0.7;
        const deliveryType = isPickup ? 'pickup' : 'delivery';
        const pickupDateIdx = Math.floor(Math.random() * 4);
        const pickupDate = getFutureDate(pickupDateIdx);
        const pickupPointId = isPickup ? (Math.floor(Math.random() * 3) + 1) : null;
        const pickupCode = isPickup ? generatePickupCode() : null;
        const address = !isPickup ? (communities[Math.floor(Math.random() * communities.length)] + '小区' + (Math.floor(Math.random() * 20) + 1) + '号楼') : null;
        const itemCount = Math.floor(Math.random() * 4) + 2;
        let totalAmount = 0;
        const usedProducts = new Set();
        const orderItems = [];

        for (let j = 0; j < itemCount; j++) {
          let productIdx;
          do {
            productIdx = Math.floor(Math.random() * 30);
          } while (usedProducts.has(productIdx) && usedProducts.size < 30);
          usedProducts.add(productIdx);

          const quantity = Math.floor(Math.random() * 3) + 1;
          const product = productsData[productIdx];
          const subtotal = Math.round(product.price * quantity * 100) / 100;
          totalAmount += subtotal;
          orderItems.push({
            product_id: productIdx + 1,
            product_name: product.name,
            specification: product.specification,
            price: product.price,
            quantity,
            subtotal
          });

          if (stockDeductionStatuses.includes(status)) {
            if (!stockDeductions[productIdx + 1]) {
              stockDeductions[productIdx + 1] = 0;
            }
            stockDeductions[productIdx + 1] += quantity;
          }
        }

        totalAmount = Math.round(totalAmount * 100) / 100;
        const orderNo = generateOrderNo();
        const paidAt = (status !== 'pending_payment' && status !== 'cancelled') ? new Date().toISOString() : null;
        const refundAmount = status === 'refunded' ? totalAmount : 0;

        orderStmt.run(
          orderNo, userId, totalAmount, status, deliveryType,
          pickupPointId, pickupCode, address, pickupDate, paidAt, refundAmount
        );

        const orderId = orderIndex + 1;
        allOrders.push({ id: orderId, status, delivery_type: deliveryType, pickup_date: pickupDate, total_amount: totalAmount, user_id: userId, items: orderItems });

        orderItems.forEach((item) => {
          orderItemStmt.run(
            orderId, item.product_id, item.product_name, item.specification,
            item.price, item.quantity, item.subtotal
          );
        });

        orderIndex++;
      }
    });
    orderStmt.finalize();
    orderItemStmt.finalize();

    console.log('扣减已支付订单的商品库存...');
    const stockStmt = db.prepare('UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    Object.keys(stockDeductions).forEach((productId) => {
      stockStmt.run(stockDeductions[productId], productId);
    });
    stockStmt.finalize();

    console.log('开始插入分拣单数据...');
    const pickupDates = [getFutureDate(0), getFutureDate(1), getFutureDate(2), getFutureDate(3)];
    const sortingStatuses = ['pending', 'pending', 'completed', 'completed', 'completed'];
    const sortingStmt = db.prepare('INSERT INTO sorting_orders (sorting_no, pickup_date, status) VALUES (?, ?, ?)');
    const sortingItemStmt = db.prepare(
      `INSERT INTO sorting_items (sorting_order_id, product_id, product_name, specification, total_quantity, sorted_quantity, shortage_quantity)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    );

    for (let i = 0; i < 5; i++) {
      const pickupDate = pickupDates[i % pickupDates.length];
      const sortingNo = generateSortingNo(pickupDate, i + 1);
      const status = sortingStatuses[i];
      const sortingOrderId = i + 1;

      sortingStmt.run(sortingNo, pickupDate, status);

      const pickupOrders = allOrders.filter(o =>
        o.pickup_date === pickupDate &&
        o.delivery_type === 'pickup' &&
        ['pending_sorting', 'pending_pickup', 'completed'].includes(o.status)
      );

      const productMap = {};
      pickupOrders.forEach(order => {
        (order.items || []).forEach(it => {
          if (!productMap[it.product_id]) {
            productMap[it.product_id] = {
              product_id: it.product_id,
              product_name: it.product_name,
              specification: it.specification,
              total_quantity: 0
            };
          }
          productMap[it.product_id].total_quantity += it.quantity;
        });
      });

      Object.values(productMap).forEach(item => {
        const sortedQty = status === 'completed' ? item.total_quantity : 0;
        sortingItemStmt.run(sortingOrderId, item.product_id, item.product_name, item.specification, item.total_quantity, sortedQty);
      });
    }
    sortingStmt.finalize();
    sortingItemStmt.finalize();

    console.log('开始插入配送单数据...');
    const deliveryStatuses = ['pending', 'pending', 'delivering', 'delivering', 'delivering', 'completed', 'completed', 'completed', 'completed', 'failed'];
    const deliveryStmt = db.prepare(
      `INSERT INTO deliveries (order_id, delivery_staff_id, status, start_time, end_time, remark)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const deliveryOrders = allOrders.filter(o => o.delivery_type === 'delivery').slice(0, 10);
    deliveryOrders.forEach((order, idx) => {
      const status = deliveryStatuses[idx % deliveryStatuses.length];
      const staffId = (idx % 3) + 1;
      const startTime = status !== 'pending' ? new Date().toISOString() : null;
      const endTime = (status === 'completed' || status === 'failed') ? new Date().toISOString() : null;
      const remark = status === 'failed' ? '客户不在家，配送失败' : null;
      deliveryStmt.run(order.id, staffId, status, startTime, endTime, remark);
    });
    deliveryStmt.finalize();

    console.log('开始插入售后记录数据...');
    const aftersaleTypes = ['shortage', 'shortage', 'shortage', 'quality', 'quality', 'wrong', 'other', 'other'];
    const aftersaleStatuses = ['pending', 'pending', 'pending', 'approved', 'approved', 'approved', 'rejected', 'rejected'];
    const descriptions = [
      '商品缺货，未收到货',
      '部分商品缺货',
      '下单后被告知没货了',
      '商品有质量问题，不新鲜',
      '收到的商品有损坏',
      '发错商品了',
      '其他原因申请退款',
      '个人原因不想买了'
    ];

    const aftersaleStmt = db.prepare(
      `INSERT INTO after_sales (order_id, user_id, type, description, images, refund_amount, status, audit_remark, audited_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const updateOrderStmt = db.prepare('UPDATE orders SET refund_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const updateOrderItemRefundStmt = db.prepare('UPDATE order_items SET refund_quantity = ? WHERE order_id = ? AND product_id = ?');
    const restoreStockStmt = db.prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

    const aftersaleOrders = allOrders.filter(o =>
      ['completed', 'pending_pickup', 'paid', 'pending_sorting'].includes(o.status)
    ).slice(0, 8);

    for (let i = 0; i < aftersaleOrders.length; i++) {
      const order = aftersaleOrders[i];
      const isApproved = aftersaleStatuses[i] === 'approved';
      let refundAmount;
      let fullyRefunded = false;

      if (isApproved && order.items && order.items.length > 0) {
        const item = order.items[0];
        const refundQty = Math.min(1, item.quantity);
        refundAmount = Math.round(item.price * refundQty * 100) / 100;
        fullyRefunded = order.items.length === 1 && refundQty >= item.quantity;
        updateOrderItemRefundStmt.run(refundQty, order.id, item.product_id);
        restoreStockStmt.run(refundQty, item.product_id);
      } else {
        refundAmount = Math.round((order.total_amount * (0.3 + Math.random() * 0.5)) * 100) / 100;
      }

      const auditRemark = isApproved ? '审核通过，已退款' : (aftersaleStatuses[i] === 'rejected' ? '不符合退款条件' : null);
      const auditedAt = aftersaleStatuses[i] !== 'pending' ? new Date().toISOString() : null;

      aftersaleStmt.run(
        order.id, order.user_id, aftersaleTypes[i], descriptions[i],
        i < 4 ? `https://example.com/images/aftersale${i + 1}.jpg` : null,
        refundAmount, aftersaleStatuses[i], auditRemark, auditedAt
      );

      if (isApproved) {
        const newStatus = fullyRefunded ? 'refunded' : order.status;
        updateOrderStmt.run(refundAmount, newStatus, order.id);
      }
    }
    aftersaleStmt.finalize();
    updateOrderStmt.finalize();
    updateOrderItemRefundStmt.finalize();
    restoreStockStmt.finalize();

    db.run('PRAGMA foreign_keys = ON');

    console.log('========================================');
    console.log('  数据填充完成！');
    console.log('========================================');
    console.log(`  供应商: ${suppliersData.length} 个`);
    console.log(`  商品: ${productsData.length} 个`);
    console.log(`  用户: 20 个`);
    console.log(`  自提点: ${pickupPointsData.length} 个`);
    console.log(`  配送员: ${deliveryStaffData.length} 个`);
    console.log(`  订单: 50 个`);
    console.log(`  分拣单: 5 个`);
    console.log(`  配送单: ${deliveryOrders.length} 个`);
    console.log(`  售后记录: ${aftersaleOrders.length} 条`);
    console.log('========================================');

    db.close();
  });
}

runSeed();
