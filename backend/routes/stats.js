const express = require('express');
const router = express.Router();
const db = require('../db/database');

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

router.get('/overview', (req, res) => {
  const { date } = req.query;
  const targetDate = date || getTodayDate();

  const gmvSql = `
    SELECT COALESCE(SUM(total_amount), 0) as gmv, 
           COUNT(*) as order_count
    FROM orders
    WHERE DATE(created_at) = ? AND status != 'cancelled'
  `;

  const refundSql = `
    SELECT COALESCE(SUM(refund_amount), 0) as refund_amount,
           COUNT(*) as refund_order_count
    FROM orders
    WHERE DATE(created_at) = ? AND status = 'refunded'
  `;

  db.get(gmvSql, [targetDate], (err, gmvResult) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }

    db.get(refundSql, [targetDate], (err, refundResult) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      const orderCount = gmvResult.order_count;
      const gmv = gmvResult.gmv;
      const avgOrderValue = orderCount > 0 ? gmv / orderCount : 0;
      const refundRate = orderCount > 0 ? (refundResult.refund_order_count / orderCount) * 100 : 0;

      res.json({
        success: true,
        data: {
          date: targetDate,
          gmv,
          order_count: orderCount,
          avg_order_value: parseFloat(avgOrderValue.toFixed(2)),
          refund_rate: parseFloat(refundRate.toFixed(2)),
          refund_amount: refundResult.refund_amount
        }
      });
    });
  });
});

router.get('/products', (req, res) => {
  const { start_date, end_date, limit = 10 } = req.query;
  const limitNum = parseInt(limit);

  let whereClauses = [];
  let params = [];

  if (start_date) {
    whereClauses.push('DATE(o.created_at) >= ?');
    params.push(start_date);
  }

  if (end_date) {
    whereClauses.push('DATE(o.created_at) <= ?');
    params.push(end_date);
  }

  whereClauses.push("o.status != 'cancelled'");

  const whereSql = 'WHERE ' + whereClauses.join(' AND ');

  const sql = `
    SELECT oi.product_id, oi.product_name, 
           SUM(oi.quantity) as sales_quantity,
           SUM(oi.subtotal) as sales_amount
    FROM order_items oi
    LEFT JOIN orders o ON oi.order_id = o.id
    ${whereSql}
    GROUP BY oi.product_id, oi.product_name
    ORDER BY sales_quantity DESC
    LIMIT ?
  `;

  db.all(sql, [...params, limitNum], (err, products) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }

    res.json({
      success: true,
      data: products.map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        sales_quantity: p.sales_quantity,
        sales_amount: p.sales_amount
      }))
    });
  });
});

router.get('/suppliers', (req, res) => {
  const { start_date, end_date } = req.query;

  let whereClauses = [];
  let params = [];

  if (start_date) {
    whereClauses.push('DATE(o.created_at) >= ?');
    params.push(start_date);
  }

  if (end_date) {
    whereClauses.push('DATE(o.created_at) <= ?');
    params.push(end_date);
  }

  whereClauses.push("o.status != 'cancelled'");

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const sql = `
    SELECT s.id as supplier_id, s.name as supplier_name,
           COALESCE(SUM(oi.subtotal), 0) as supply_amount
    FROM suppliers s
    LEFT JOIN products p ON s.id = p.supplier_id
    LEFT JOIN order_items oi ON p.id = oi.product_id
    LEFT JOIN orders o ON oi.order_id = o.id
    ${whereSql}
    GROUP BY s.id, s.name
    ORDER BY supply_amount DESC
  `;

  db.all(sql, params, (err, suppliers) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }

    res.json({
      success: true,
      data: suppliers.map(s => ({
        supplier_id: s.supplier_id,
        supplier_name: s.supplier_name,
        supply_amount: s.supply_amount
      }))
    });
  });
});

router.get('/refund-rate', (req, res) => {
  const { start_date, end_date } = req.query;

  let whereClauses = [];
  let params = [];

  if (start_date) {
    whereClauses.push('DATE(created_at) >= ?');
    params.push(start_date);
  }

  if (end_date) {
    whereClauses.push('DATE(created_at) <= ?');
    params.push(end_date);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const totalSql = `SELECT COUNT(*) as total_count FROM orders ${whereSql}`;
  const refundSql = `
    SELECT COUNT(*) as refund_count, 
           COALESCE(SUM(refund_amount), 0) as refund_amount
    FROM orders 
    ${whereSql ? whereSql + " AND status = 'refunded'" : "WHERE status = 'refunded'"}
  `;

  db.get(totalSql, params, (err, totalResult) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }

    db.get(refundSql, params, (err, refundResult) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      const totalCount = totalResult.total_count;
      const refundCount = refundResult.refund_count;
      const refundRate = totalCount > 0 ? (refundCount / totalCount) * 100 : 0;

      res.json({
        success: true,
        data: {
          total_orders: totalCount,
          refund_orders: refundCount,
          refund_rate: parseFloat(refundRate.toFixed(2)),
          refund_amount: refundResult.refund_amount,
          start_date: start_date || null,
          end_date: end_date || null
        }
      });
    });
  });
});

router.get('/unpicked-orders', (req, res) => {
  const { pickup_date } = req.query;
  const today = getTodayDate();
  const targetDate = pickup_date || today;

  let whereClauses = ["o.status = 'pending_pickup'"];
  let params = [];

  if (pickup_date) {
    whereClauses.push('o.pickup_date = ?');
    params.push(pickup_date);
  } else {
    whereClauses.push('o.pickup_date <= ?');
    params.push(today);
  }

  const whereSql = 'WHERE ' + whereClauses.join(' AND ');

  const countSql = `SELECT COUNT(*) as total FROM orders o ${whereSql}`;
  const listSql = `
    SELECT o.*, u.username, u.nickname, u.phone as user_phone,
           pp.name as pickup_point_name, pp.address as pickup_point_address
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN pickup_points pp ON o.pickup_point_id = pp.id
    ${whereSql}
    ORDER BY o.pickup_date ASC, o.created_at DESC
  `;

  db.get(countSql, params, (err, countResult) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }

    db.all(listSql, params, (err, orders) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      if (orders.length === 0) {
        return res.json({
          success: true,
          data: {
            list: [],
            total: 0
          }
        });
      }

      const orderIds = orders.map(o => o.id);
      const placeholders = orderIds.map(() => '?').join(',');
      const itemsSql = `SELECT * FROM order_items WHERE order_id IN (${placeholders})`;

      db.all(itemsSql, orderIds, (err, items) => {
        if (err) {
          return res.json({ success: false, message: err.message });
        }

        const itemsByOrder = {};
        items.forEach(item => {
          if (!itemsByOrder[item.order_id]) {
            itemsByOrder[item.order_id] = [];
          }
          itemsByOrder[item.order_id].push(item);
        });

        const ordersWithItems = orders.map(order => ({
          ...order,
          items: itemsByOrder[order.id] || []
        }));

        res.json({
          success: true,
          data: {
            list: ordersWithItems,
            total: countResult.total
          }
        });
      });
    });
  });
});

module.exports = router;
