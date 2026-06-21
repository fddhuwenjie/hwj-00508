const express = require('express');
const router = express.Router();
const db = require('../db/database');

const VALID_TYPES = ['shortage', 'quality', 'wrong', 'other'];
const VALID_STATUSES = ['pending', 'approved', 'rejected'];

router.get('/', (req, res) => {
  const { status, user_id, page = 1, pageSize = 10 } = req.query;
  const pageNum = parseInt(page);
  const size = parseInt(pageSize);
  const offset = (pageNum - 1) * size;

  let whereClauses = [];
  let params = [];

  if (status && VALID_STATUSES.includes(status)) {
    whereClauses.push('a.status = ?');
    params.push(status);
  }

  if (user_id) {
    whereClauses.push('a.user_id = ?');
    params.push(user_id);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const countSql = `SELECT COUNT(*) as total FROM after_sales a ${whereSql}`;
  const listSql = `
    SELECT a.*, o.order_no, o.total_amount, u.username, u.nickname
    FROM after_sales a
    LEFT JOIN orders o ON a.order_id = o.id
    LEFT JOIN users u ON a.user_id = u.id
    ${whereSql}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `;

  db.get(countSql, params, (err, countResult) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }

    db.all(listSql, [...params, size, offset], (err, list) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      res.json({
        success: true,
        data: {
          list,
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

  const aftersaleSql = `
    SELECT a.*, o.order_no, o.total_amount, o.status as order_status, 
           u.username, u.nickname, u.phone as user_phone
    FROM after_sales a
    LEFT JOIN orders o ON a.order_id = o.id
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.id = ?
  `;

  db.get(aftersaleSql, [id], (err, aftersale) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!aftersale) {
      return res.json({ success: false, message: '售后记录不存在' });
    }

    db.all('SELECT * FROM order_items WHERE order_id = ?', [aftersale.order_id], (err, items) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      res.json({
        success: true,
        data: {
          ...aftersale,
          items
        }
      });
    });
  });
});

router.post('/', (req, res) => {
  const { order_id, user_id, type, description, images, refund_amount } = req.body;

  if (!order_id || !user_id || !type || !refund_amount) {
    return res.json({ success: false, message: '订单ID、用户ID、售后类型和退款金额不能为空' });
  }

  if (!VALID_TYPES.includes(type)) {
    return res.json({ success: false, message: '售后类型不合法' });
  }

  db.get('SELECT * FROM orders WHERE id = ?', [order_id], (err, order) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!order) {
      return res.json({ success: false, message: '订单不存在' });
    }

    const insertSql = `
      INSERT INTO after_sales (order_id, user_id, type, description, images, refund_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;
    const insertParams = [
      order_id, user_id, type,
      description || null,
      images || null,
      parseFloat(refund_amount)
    ];

    db.run(insertSql, insertParams, function(err) {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      db.get('SELECT * FROM after_sales WHERE id = ?', [this.lastID], (err, aftersale) => {
        if (err) {
          return res.json({ success: false, message: err.message });
        }
        res.json({ success: true, data: aftersale });
      });
    });
  });
});

router.put('/:id/audit', (req, res) => {
  const { id } = req.params;
  const { status, audit_remark } = req.body;

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.json({ success: false, message: '审核状态不合法' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      db.get('SELECT * FROM after_sales WHERE id = ?', [id], (err, aftersale) => {
        if (err) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: err.message });
        }
        if (!aftersale) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '售后记录不存在' });
        }
        if (aftersale.status !== 'pending') {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '该售后已审核' });
        }

        if (status === 'approved') {
          db.get('SELECT * FROM orders WHERE id = ?', [aftersale.order_id], (err, order) => {
            if (err) {
              db.run('ROLLBACK');
              return res.json({ success: false, message: err.message });
            }
            if (!order) {
              db.run('ROLLBACK');
              return res.json({ success: false, message: '订单不存在' });
            }

            db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id], (err, orderItems) => {
              if (err) {
                db.run('ROLLBACK');
                return res.json({ success: false, message: err.message });
              }

              const refundItems = Array.isArray(req.body.refund_items) ? req.body.refund_items : [];
              const itemMap = {};
              orderItems.forEach(item => { itemMap[item.id] = item; });

              let actualRefund = 0;
              const validated = [];
              for (const ri of refundItems) {
                const oi = itemMap[ri.order_item_id];
                if (!oi) {
                  db.run('ROLLBACK');
                  return res.json({ success: false, message: '退款商品不存在或不属于该订单' });
                }
                const rq = parseInt(ri.refund_quantity);
                if (isNaN(rq) || rq <= 0) {
                  db.run('ROLLBACK');
                  return res.json({ success: false, message: '退款数量必须大于0' });
                }
                const existingRefund = oi.refund_quantity || 0;
                if (existingRefund + rq > oi.quantity) {
                  db.run('ROLLBACK');
                  return res.json({ success: false, message: `商品 ${oi.product_name} 退款数量超过购买数量` });
                }
                actualRefund += rq * oi.price;
                validated.push({ item: oi, refundQty: rq });
              }

              const refundAmountToApply = validated.length > 0 ? actualRefund : aftersale.refund_amount;
              const newRefundAmount = (order.refund_amount || 0) + refundAmountToApply;

              let fullyRefunded;
              if (validated.length > 0) {
                const qtyByItem = {};
                orderItems.forEach(it => { qtyByItem[it.id] = it.refund_quantity || 0; });
                validated.forEach(v => { qtyByItem[v.item.id] += v.refundQty; });
                fullyRefunded = orderItems.every(it => (qtyByItem[it.id] || 0) >= it.quantity);
              } else {
                fullyRefunded = newRefundAmount >= order.total_amount;
              }
              const orderStatus = fullyRefunded ? 'refunded' : order.status;

              db.run(
                'UPDATE orders SET refund_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newRefundAmount, orderStatus, order.id],
                function(err) {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.json({ success: false, message: err.message });
                  }

                  if (validated.length === 0) {
                    completeAudit();
                    return;
                  }

                  let processed = 0;
                  let processError = null;

                  validated.forEach(v => {
                    const newRefundQty = (v.item.refund_quantity || 0) + v.refundQty;
                    db.run(
                      'UPDATE order_items SET refund_quantity = ? WHERE id = ?',
                      [newRefundQty, v.item.id],
                      function(err) {
                        if (err) {
                          processError = err;
                          processed++;
                          checkDone();
                          return;
                        }
                        db.run(
                          'UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                          [v.refundQty, v.item.product_id],
                          function(err) {
                            if (err) {
                              processError = err;
                            }
                            processed++;
                            checkDone();
                          }
                        );
                      }
                    );
                  });

                  function checkDone() {
                    if (processed === validated.length) {
                      if (processError) {
                        db.run('ROLLBACK');
                        return res.json({ success: false, message: processError.message });
                      }
                      completeAudit();
                    }
                  }

                  function completeAudit() {
                    db.run(
                      'UPDATE after_sales SET status = ?, audit_remark = ?, audited_at = CURRENT_TIMESTAMP WHERE id = ?',
                      [status, audit_remark || null, id],
                      function(err) {
                        if (err) {
                          db.run('ROLLBACK');
                          return res.json({ success: false, message: err.message });
                        }

                        db.run('COMMIT', (err) => {
                          if (err) {
                            return res.json({ success: false, message: err.message });
                          }

                          db.get('SELECT * FROM after_sales WHERE id = ?', [id], (err, updatedAftersale) => {
                            if (err) {
                              return res.json({ success: false, message: err.message });
                            }
                            res.json({ success: true, data: updatedAftersale });
                          });
                        });
                      }
                    );
                  }
                }
              );
            });
          });
        } else {
          db.run(
            'UPDATE after_sales SET status = ?, audit_remark = ?, audited_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, audit_remark || null, id],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.json({ success: false, message: err.message });
              }

              db.run('COMMIT', (err) => {
                if (err) {
                  return res.json({ success: false, message: err.message });
                }

                db.get('SELECT * FROM after_sales WHERE id = ?', [id], (err, updatedAftersale) => {
                  if (err) {
                    return res.json({ success: false, message: err.message });
                  }
                  res.json({ success: true, data: updatedAftersale });
                });
              });
            }
          );
        }
      });
    });
  });
});

module.exports = router;
