const express = require('express');
const router = express.Router();
const db = require('../db/database');

const VALID_STATUSES = ['pending', 'delivering', 'completed', 'failed'];

router.get('/', (req, res) => {
  const { status, page = 1, pageSize = 10 } = req.query;
  const pageNum = parseInt(page);
  const size = parseInt(pageSize);
  const offset = (pageNum - 1) * size;

  let whereClauses = [];
  let params = [];

  if (status && VALID_STATUSES.includes(status)) {
    whereClauses.push('d.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const countSql = `SELECT COUNT(*) as total FROM deliveries d ${whereSql}`;
  const listSql = `
    SELECT d.*, ds.name as delivery_staff_name, ds.phone as delivery_staff_phone
    FROM deliveries d
    LEFT JOIN delivery_staff ds ON d.delivery_staff_id = ds.id
    ${whereSql}
    ORDER BY d.created_at DESC
    LIMIT ? OFFSET ?
  `;

  db.get(countSql, params, (err, countResult) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }

    db.all(listSql, [...params, size, offset], (err, rows) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      res.json({
        success: true,
        data: {
          list: rows,
          total: countResult.total,
          page: pageNum,
          pageSize: size
        }
      });
    });
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;

  const deliverySql = `
    SELECT d.*, ds.name as delivery_staff_name, ds.phone as delivery_staff_phone,
           o.order_no, o.total_amount, o.user_id, o.address
    FROM deliveries d
    LEFT JOIN delivery_staff ds ON d.delivery_staff_id = ds.id
    LEFT JOIN orders o ON d.order_id = o.id
    WHERE d.id = ?
  `;

  db.get(deliverySql, [id], (err, delivery) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!delivery) {
      return res.json({ success: false, message: '配送单不存在' });
    }

    db.all('SELECT * FROM order_items WHERE order_id = ?', [delivery.order_id], (err, items) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      res.json({
        success: true,
        data: {
          ...delivery,
          items
        }
      });
    });
  });
});

router.post('/', (req, res) => {
  const { order_id, delivery_staff_id } = req.body;

  if (!order_id) {
    return res.json({ success: false, message: '订单ID不能为空' });
  }

  if (!delivery_staff_id) {
    return res.json({ success: false, message: '配送员ID不能为空' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      db.get('SELECT * FROM orders WHERE id = ?', [order_id], (err, order) => {
        if (err) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: err.message });
        }
        if (!order) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '订单不存在' });
        }
        if (order.delivery_type !== 'delivery') {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '该订单不是配送订单' });
        }
        if (order.status !== 'paid' && order.status !== 'pending_delivery') {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '订单状态不支持创建配送单' });
        }

        db.get('SELECT * FROM delivery_staff WHERE id = ?', [delivery_staff_id], (err, staff) => {
          if (err) {
            db.run('ROLLBACK');
            return res.json({ success: false, message: err.message });
          }
          if (!staff) {
            db.run('ROLLBACK');
            return res.json({ success: false, message: '配送员不存在' });
          }
          if (staff.status !== 'active') {
            db.run('ROLLBACK');
            return res.json({ success: false, message: '配送员已停用' });
          }

          const insertSql = `
            INSERT INTO deliveries (order_id, delivery_staff_id, status)
            VALUES (?, ?, 'pending')
          `;

          db.run(insertSql, [order_id, delivery_staff_id], function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.json({ success: false, message: err.message });
            }

            const deliveryId = this.lastID;

            db.run(
              'UPDATE orders SET delivery_staff_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [delivery_staff_id, 'pending_delivery', order_id],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  return res.json({ success: false, message: err.message });
                }

                db.run('COMMIT', (err) => {
                  if (err) {
                    return res.json({ success: false, message: err.message });
                  }

                  db.get('SELECT * FROM deliveries WHERE id = ?', [deliveryId], (err, delivery) => {
                    if (err) {
                      return res.json({ success: false, message: err.message });
                    }
                    res.json({ success: true, data: delivery });
                  });
                });
              }
            );
          });
        });
      });
    });
  });
});

router.put('/:id/start', (req, res) => {
  const { id } = req.params;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      db.get('SELECT * FROM deliveries WHERE id = ?', [id], (err, delivery) => {
        if (err) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: err.message });
        }
        if (!delivery) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '配送单不存在' });
        }
        if (delivery.status !== 'pending') {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '配送单状态不支持开始配送' });
        }

        db.run(
          "UPDATE deliveries SET status = 'delivering', start_time = CURRENT_TIMESTAMP WHERE id = ?",
          [id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.json({ success: false, message: err.message });
            }

            db.run(
              "UPDATE orders SET status = 'delivering', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
              [delivery.order_id],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  return res.json({ success: false, message: err.message });
                }

                db.run('COMMIT', (err) => {
                  if (err) {
                    return res.json({ success: false, message: err.message });
                  }

                  db.get('SELECT * FROM deliveries WHERE id = ?', [id], (err, updatedDelivery) => {
                    if (err) {
                      return res.json({ success: false, message: err.message });
                    }
                    res.json({ success: true, data: updatedDelivery });
                  });
                });
              }
            );
          }
        );
      });
    });
  });
});

router.put('/:id/complete', (req, res) => {
  const { id } = req.params;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      db.get('SELECT * FROM deliveries WHERE id = ?', [id], (err, delivery) => {
        if (err) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: err.message });
        }
        if (!delivery) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '配送单不存在' });
        }
        if (delivery.status !== 'delivering') {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '配送单状态不支持完成配送' });
        }

        db.run(
          "UPDATE deliveries SET status = 'completed', end_time = CURRENT_TIMESTAMP WHERE id = ?",
          [id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.json({ success: false, message: err.message });
            }

            db.run(
              "UPDATE orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
              [delivery.order_id],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  return res.json({ success: false, message: err.message });
                }

                db.run('COMMIT', (err) => {
                  if (err) {
                    return res.json({ success: false, message: err.message });
                  }

                  db.get('SELECT * FROM deliveries WHERE id = ?', [id], (err, updatedDelivery) => {
                    if (err) {
                      return res.json({ success: false, message: err.message });
                    }
                    res.json({ success: true, data: updatedDelivery });
                  });
                });
              }
            );
          }
        );
      });
    });
  });
});

router.put('/:id/fail', (req, res) => {
  const { id } = req.params;
  const { remark } = req.body;

  db.get('SELECT * FROM deliveries WHERE id = ?', [id], (err, delivery) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!delivery) {
      return res.json({ success: false, message: '配送单不存在' });
    }
    if (delivery.status === 'completed') {
      return res.json({ success: false, message: '已完成的配送单不能标记为失败' });
    }

    db.run(
      'UPDATE deliveries SET status = ?, remark = ? WHERE id = ?',
      ['failed', remark || null, id],
      function(err) {
        if (err) {
          return res.json({ success: false, message: err.message });
        }

        db.get('SELECT * FROM deliveries WHERE id = ?', [id], (err, updatedDelivery) => {
          if (err) {
            return res.json({ success: false, message: err.message });
          }
          res.json({ success: true, data: updatedDelivery });
        });
      }
    );
  });
});

module.exports = router;
