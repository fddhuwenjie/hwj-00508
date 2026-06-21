const express = require('express');
const router = express.Router();
const db = require('../db/database');

const VALID_STATUSES = ['pending_payment', 'paid', 'cancelled', 'pending_sorting', 'pending_pickup', 'completed', 'refunded'];
const VALID_DELIVERY_TYPES = ['pickup', 'delivery'];

function generateOrderNo() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${timestamp}${random}`;
}

function generatePickupCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.get('/', (req, res) => {
  const { user_id, status, pickup_date, page = 1, pageSize = 10 } = req.query;
  const pageNum = parseInt(page);
  const size = parseInt(pageSize);
  const offset = (pageNum - 1) * size;

  let whereClauses = [];
  let params = [];

  if (user_id) {
    whereClauses.push('o.user_id = ?');
    params.push(user_id);
  }

  if (status && VALID_STATUSES.includes(status)) {
    whereClauses.push('o.status = ?');
    params.push(status);
  }

  if (pickup_date) {
    whereClauses.push('o.pickup_date = ?');
    params.push(pickup_date);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const countSql = `SELECT COUNT(*) as total FROM orders o ${whereSql}`;
  const listSql = `
    SELECT o.* FROM orders o 
    ${whereSql} 
    ORDER BY o.created_at DESC 
    LIMIT ? OFFSET ?
  `;

  db.get(countSql, params, (err, countResult) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }

    db.all(listSql, [...params, size, offset], (err, orders) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      if (orders.length === 0) {
        return res.json({
          success: true,
          data: {
            list: [],
            total: countResult.total,
            page: pageNum,
            pageSize: size
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
            total: countResult.total,
            page: pageNum,
            pageSize: size
          }
        });
      });
    });
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;

  const orderSql = `
    SELECT o.*, u.username, u.nickname, u.phone as user_phone 
    FROM orders o 
    LEFT JOIN users u ON o.user_id = u.id 
    WHERE o.id = ?
  `;

  db.get(orderSql, [id], (err, order) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!order) {
      return res.json({ success: false, message: '订单不存在' });
    }

    db.all('SELECT * FROM order_items WHERE order_id = ?', [id], (err, items) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      res.json({
        success: true,
        data: {
          ...order,
          items
        }
      });
    });
  });
});

router.post('/', (req, res) => {
  const { user_id, items, delivery_type, pickup_point_id, address, remark } = req.body;

  if (!user_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.json({ success: false, message: '用户ID和订单项不能为空' });
  }

  if (!delivery_type || !VALID_DELIVERY_TYPES.includes(delivery_type)) {
    return res.json({ success: false, message: '配送类型不合法' });
  }

  if (delivery_type === 'pickup' && !pickup_point_id) {
    return res.json({ success: false, message: '自提需要选择提货点' });
  }

  if (delivery_type === 'delivery' && !address) {
    return res.json({ success: false, message: '配送需要填写地址' });
  }

  const productIds = items.map(item => item.product_id);
  const placeholders = productIds.map(() => '?').join(',');
  const productsSql = `SELECT * FROM products WHERE id IN (${placeholders})`;

  db.all(productsSql, productIds, (err, products) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }

    if (products.length !== productIds.length) {
      return res.json({ success: false, message: '部分商品不存在' });
    }

    const productMap = {};
    products.forEach(p => {
      productMap[p.id] = p;
    });

    let totalAmount = 0;
    const orderItems = items.map(item => {
      const product = productMap[item.product_id];
      const quantity = parseInt(item.quantity);
      const subtotal = product.group_price * quantity;
      totalAmount += subtotal;
      return {
        product_id: product.id,
        product_name: product.name,
        specification: product.specification,
        price: product.group_price,
        quantity,
        subtotal
      };
    });

    const pickupDate = products.length > 0 ? products[0].pickup_date : null;
    const orderNo = generateOrderNo();
    const pickupCode = delivery_type === 'pickup' ? generatePickupCode() : null;

    const orderSql = `
      INSERT INTO orders (order_no, user_id, total_amount, status, delivery_type, pickup_point_id, pickup_code, address, remark, pickup_date)
      VALUES (?, ?, ?, 'pending_payment', ?, ?, ?, ?, ?, ?)
    `;
    const orderParams = [
      orderNo, user_id, totalAmount, delivery_type,
      pickup_point_id || null, pickupCode, address || null,
      remark || null, pickupDate
    ];

    db.run(orderSql, orderParams, function(err) {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      const orderId = this.lastID;
      let itemsInserted = 0;
      let insertError = null;

      orderItems.forEach(item => {
        const itemSql = `
          INSERT INTO order_items (order_id, product_id, product_name, specification, price, quantity, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const itemParams = [
          orderId, item.product_id, item.product_name,
          item.specification, item.price, item.quantity, item.subtotal
        ];

        db.run(itemSql, itemParams, function(err) {
          if (err) {
            insertError = err;
          }
          itemsInserted++;

          if (itemsInserted === orderItems.length) {
            if (insertError) {
              return res.json({ success: false, message: insertError.message });
            }

            db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, order) => {
              if (err) {
                return res.json({ success: false, message: err.message });
              }
              res.json({ success: true, data: { ...order, items: orderItems } });
            });
          }
        });
      });
    });
  });
});

router.put('/:id/pay', (req, res) => {
  const { id } = req.params;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
        if (err) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: err.message });
        }
        if (!order) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '订单不存在' });
        }
        if (order.status !== 'pending_payment') {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '订单状态不支持支付' });
        }

        db.all('SELECT * FROM order_items WHERE order_id = ?', [id], (err, orderItems) => {
          if (err) {
            db.run('ROLLBACK');
            return res.json({ success: false, message: err.message });
          }

          let updateCount = 0;
          let hasShortage = false;
          let shortageProduct = null;

          orderItems.forEach(item => {
            db.run(
              'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?',
              [item.quantity, item.product_id, item.quantity],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  return res.json({ success: false, message: err.message });
                }

                if (this.changes === 0) {
                  hasShortage = true;
                  shortageProduct = item.product_name;
                }

                updateCount++;
                if (updateCount === orderItems.length) {
                  if (hasShortage) {
                    db.run('ROLLBACK');
                    return res.json({ success: false, message: `商品 ${shortageProduct} 库存不足` });
                  }

                  db.run(
                    'UPDATE orders SET status = ?, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    ['paid', id],
                    function(err) {
                      if (err) {
                        db.run('ROLLBACK');
                        return res.json({ success: false, message: err.message });
                      }

                      db.run('COMMIT', (err) => {
                        if (err) {
                          return res.json({ success: false, message: err.message });
                        }

                        db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
                          if (err) {
                            return res.json({ success: false, message: err.message });
                          }
                          res.json({ success: true, data: order });
                        });
                      });
                    }
                  );
                }
              }
            );
          });
        });
      });
    });
  });
});

router.put('/:id/cancel', (req, res) => {
  const { id } = req.params;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
        if (err) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: err.message });
        }
        if (!order) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '订单不存在' });
        }
        if (order.status === 'cancelled' || order.status === 'completed' || order.status === 'refunded') {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '订单状态不支持取消' });
        }

        const needRestoreStock = order.status === 'paid' || order.status === 'pending_sorting' || order.status === 'pending_pickup';

        if (needRestoreStock) {
          db.all('SELECT * FROM order_items WHERE order_id = ?', [id], (err, orderItems) => {
            if (err) {
              db.run('ROLLBACK');
              return res.json({ success: false, message: err.message });
            }

            let restoreCount = 0;
            let restoreError = null;

            orderItems.forEach(item => {
              db.run(
                'UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [item.quantity, item.product_id],
                function(err) {
                  if (err) {
                    restoreError = err;
                  }
                  restoreCount++;

                  if (restoreCount === orderItems.length) {
                    if (restoreError) {
                      db.run('ROLLBACK');
                      return res.json({ success: false, message: restoreError.message });
                    }

                    db.run(
                      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                      ['cancelled', id],
                      function(err) {
                        if (err) {
                          db.run('ROLLBACK');
                          return res.json({ success: false, message: err.message });
                        }

                        db.run('COMMIT', (err) => {
                          if (err) {
                            return res.json({ success: false, message: err.message });
                          }

                          db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
                            if (err) {
                              return res.json({ success: false, message: err.message });
                            }
                            res.json({ success: true, data: order });
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
            'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['cancelled', id],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.json({ success: false, message: err.message });
              }

              db.run('COMMIT', (err) => {
                if (err) {
                  return res.json({ success: false, message: err.message });
                }

                db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
                  if (err) {
                    return res.json({ success: false, message: err.message });
                  }
                  res.json({ success: true, data: order });
                });
              });
            }
          );
        }
      });
    });
  });
});

router.put('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.json({ success: false, message: '状态不合法' });
  }

  db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!order) {
      return res.json({ success: false, message: '订单不存在' });
    }

    db.run(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id],
      function(err) {
        if (err) {
          return res.json({ success: false, message: err.message });
        }

        db.get('SELECT * FROM orders WHERE id = ?', [id], (err, updatedOrder) => {
          if (err) {
            return res.json({ success: false, message: err.message });
          }
          res.json({ success: true, data: updatedOrder });
        });
      }
    );
  });
});

router.get('/:id/pickup-verify', (req, res) => {
  const { id } = req.params;
  const { pickup_code } = req.query;

  if (!pickup_code) {
    return res.json({ success: false, message: '核销码不能为空' });
  }

  db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!order) {
      return res.json({ success: false, message: '订单不存在' });
    }
    if (order.delivery_type !== 'pickup') {
      return res.json({ success: false, message: '该订单不是自提订单' });
    }
    if (order.status !== 'pending_pickup') {
      return res.json({ success: false, message: '订单状态不支持核销' });
    }
    if (order.pickup_code !== pickup_code) {
      return res.json({ success: false, message: '核销码错误' });
    }

    db.run(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['completed', id],
      function(err) {
        if (err) {
          return res.json({ success: false, message: err.message });
        }

        db.get('SELECT * FROM orders WHERE id = ?', [id], (err, updatedOrder) => {
          if (err) {
            return res.json({ success: false, message: err.message });
          }
          res.json({ success: true, data: updatedOrder });
        });
      }
    );
  });
});

module.exports = router;
