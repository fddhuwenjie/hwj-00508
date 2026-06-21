const express = require('express');
const router = express.Router();
const db = require('../db/database');

const VALID_STATUSES = ['pending', 'completed'];

function generateSortingNo(pickupDate, sequence) {
  const dateStr = pickupDate.replace(/-/g, '');
  const seqStr = sequence.toString().padStart(3, '0');
  return `SORT${dateStr}${seqStr}`;
}

router.get('/', (req, res) => {
  const { pickup_date, status, page = 1, pageSize = 10 } = req.query;
  const pageNum = parseInt(page);
  const size = parseInt(pageSize);
  const offset = (pageNum - 1) * size;

  let whereClauses = [];
  let params = [];

  if (pickup_date) {
    whereClauses.push('pickup_date = ?');
    params.push(pickup_date);
  }

  if (status && VALID_STATUSES.includes(status)) {
    whereClauses.push('status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const countSql = `SELECT COUNT(*) as total FROM sorting_orders ${whereSql}`;
  const listSql = `
    SELECT * FROM sorting_orders
    ${whereSql}
    ORDER BY created_at DESC
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

  db.get('SELECT * FROM sorting_orders WHERE id = ?', [id], (err, sortingOrder) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!sortingOrder) {
      return res.json({ success: false, message: '分拣单不存在' });
    }

    db.all('SELECT * FROM sorting_items WHERE sorting_order_id = ?', [id], (err, items) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      const ordersSql = `
        SELECT o.*, u.nickname, u.phone as user_phone
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.pickup_date = ? AND o.delivery_type = 'pickup' 
          AND o.status IN ('pending_sorting','pending_pickup','completed','refunded')
        ORDER BY o.created_at DESC
      `;

      db.all(ordersSql, [sortingOrder.pickup_date], (err, orders) => {
        if (err) {
          return res.json({ success: false, message: err.message });
        }

        if (orders.length === 0) {
          return res.json({
            success: true,
            data: {
              ...sortingOrder,
              items,
              orders: []
            }
          });
        }

        const orderIds = orders.map(o => o.id);
        const placeholders = orderIds.map(() => '?').join(',');
        const orderItemsSql = `SELECT * FROM order_items WHERE order_id IN (${placeholders})`;

        db.all(orderItemsSql, orderIds, (err, orderItems) => {
          if (err) {
            return res.json({ success: false, message: err.message });
          }

          const itemsByOrder = {};
          orderItems.forEach(item => {
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
              ...sortingOrder,
              items,
              orders: ordersWithItems
            }
          });
        });
      });
    });
  });
});

router.post('/generate', (req, res) => {
  const { pickup_date } = req.body;

  if (!pickup_date) {
    return res.json({ success: false, message: '提货日期不能为空' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      const checkSql = `
        SELECT * FROM orders 
        WHERE pickup_date = ? AND status = 'paid' AND delivery_type = 'pickup'
      `;

      db.all(checkSql, [pickup_date], (err, orders) => {
        if (err) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: err.message });
        }

        if (orders.length === 0) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '该提货日期下没有待分拣的订单' });
        }

        const orderIds = orders.map(o => o.id);
        const placeholders = orderIds.map(() => '?').join(',');
        const itemsSql = `
          SELECT product_id, product_name, specification, price, SUM(quantity) as total_quantity
          FROM order_items
          WHERE order_id IN (${placeholders})
          GROUP BY product_id, product_name, specification, price
        `;

        db.all(itemsSql, orderIds, (err, productSummary) => {
          if (err) {
            db.run('ROLLBACK');
            return res.json({ success: false, message: err.message });
          }

          const countSql = `
            SELECT COUNT(*) as count FROM sorting_orders WHERE pickup_date = ?
          `;

          db.get(countSql, [pickup_date], (err, countResult) => {
            if (err) {
              db.run('ROLLBACK');
              return res.json({ success: false, message: err.message });
            }

            const sequence = countResult.count + 1;
            const sortingNo = generateSortingNo(pickup_date, sequence);

            const insertSortingSql = `
              INSERT INTO sorting_orders (sorting_no, pickup_date, status)
              VALUES (?, ?, 'pending')
            `;

            db.run(insertSortingSql, [sortingNo, pickup_date], function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.json({ success: false, message: err.message });
              }

              const sortingOrderId = this.lastID;
              let itemsInserted = 0;
              let insertError = null;

              productSummary.forEach(item => {
                const insertItemSql = `
                  INSERT INTO sorting_items 
                  (sorting_order_id, product_id, product_name, specification, total_quantity, sorted_quantity, shortage_quantity)
                  VALUES (?, ?, ?, ?, ?, 0, 0)
                `;
                const itemParams = [
                  sortingOrderId, item.product_id, item.product_name,
                  item.specification, item.total_quantity
                ];

                db.run(insertItemSql, itemParams, function(err) {
                  if (err) {
                    insertError = err;
                  }
                  itemsInserted++;

                  if (itemsInserted === productSummary.length) {
                    if (insertError) {
                      db.run('ROLLBACK');
                      return res.json({ success: false, message: insertError.message });
                    }

                    let ordersUpdated = 0;
                    let updateError = null;

                    orders.forEach(order => {
                      db.run(
                        "UPDATE orders SET status = 'pending_sorting', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        [order.id],
                        function(err) {
                          if (err) {
                            updateError = err;
                          }
                          ordersUpdated++;

                          if (ordersUpdated === orders.length) {
                            if (updateError) {
                              db.run('ROLLBACK');
                              return res.json({ success: false, message: updateError.message });
                            }

                            db.run('COMMIT', (err) => {
                              if (err) {
                                return res.json({ success: false, message: err.message });
                              }

                              db.get('SELECT * FROM sorting_orders WHERE id = ?', [sortingOrderId], (err, newSortingOrder) => {
                                if (err) {
                                  return res.json({ success: false, message: err.message });
                                }

                                db.all('SELECT * FROM sorting_items WHERE sorting_order_id = ?', [sortingOrderId], (err, items) => {
                                  if (err) {
                                    return res.json({ success: false, message: err.message });
                                  }

                                  res.json({
                                    success: true,
                                    data: {
                                      ...newSortingOrder,
                                      items
                                    }
                                  });
                                });
                              });
                            });
                          }
                        }
                      );
                    });
                  }
                });
              });
            });
          });
        });
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

      db.get('SELECT * FROM sorting_orders WHERE id = ?', [id], (err, sortingOrder) => {
        if (err) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: err.message });
        }
        if (!sortingOrder) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '分拣单不存在' });
        }
        if (sortingOrder.status !== 'pending') {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '分拣单状态不支持完成' });
        }

        db.run(
          "UPDATE sorting_orders SET status = 'completed' WHERE id = ?",
          [id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.json({ success: false, message: err.message });
            }

            db.run(
              "UPDATE orders SET status = 'pending_pickup', updated_at = CURRENT_TIMESTAMP WHERE pickup_date = ? AND delivery_type = 'pickup' AND status = 'pending_sorting'",
              [sortingOrder.pickup_date],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  return res.json({ success: false, message: err.message });
                }

                db.run('COMMIT', (err) => {
                  if (err) {
                    return res.json({ success: false, message: err.message });
                  }

                  db.get('SELECT * FROM sorting_orders WHERE id = ?', [id], (err, updatedOrder) => {
                    if (err) {
                      return res.json({ success: false, message: err.message });
                    }
                    res.json({ success: true, data: updatedOrder });
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

router.put('/item/:itemId/shortage', (req, res) => {
  const { itemId } = req.params;
  const { shortage_quantity } = req.body;

  if (!shortage_quantity || parseInt(shortage_quantity) <= 0) {
    return res.json({ success: false, message: '缺货数量必须大于0' });
  }

  const shortageQty = parseInt(shortage_quantity);

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      db.get('SELECT * FROM sorting_items WHERE id = ?', [itemId], (err, sortingItem) => {
        if (err) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: err.message });
        }
        if (!sortingItem) {
          db.run('ROLLBACK');
          return res.json({ success: false, message: '分拣项不存在' });
        }

        db.get('SELECT * FROM sorting_orders WHERE id = ?', [sortingItem.sorting_order_id], (err, sortingOrder) => {
          if (err) {
            db.run('ROLLBACK');
            return res.json({ success: false, message: err.message });
          }

          if (sortingOrder.status !== 'pending') {
            db.run('ROLLBACK');
            return res.json({ success: false, message: '分拣单已完成，不能标记缺货' });
          }

          const availableQty = sortingItem.total_quantity - sortingItem.shortage_quantity;
          if (shortageQty > availableQty) {
            db.run('ROLLBACK');
            return res.json({ success: false, message: '缺货数量超过可用数量' });
          }

          const newShortageQty = sortingItem.shortage_quantity + shortageQty;

          db.run(
            'UPDATE sorting_items SET shortage_quantity = ? WHERE id = ?',
            [newShortageQty, itemId],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.json({ success: false, message: err.message });
              }

              const ordersSql = `
                SELECT o.id, oi.id as item_id, oi.price, oi.quantity, oi.refund_quantity
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE o.pickup_date = ? 
                  AND o.delivery_type = 'pickup' 
                  AND o.status = 'pending_sorting'
                  AND oi.product_id = ?
              `;

              db.all(ordersSql, [sortingOrder.pickup_date, sortingItem.product_id], (err, orderItems) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.json({ success: false, message: err.message });
                }

                if (orderItems.length === 0) {
                  db.run('COMMIT', (err) => {
                    if (err) {
                      return res.json({ success: false, message: err.message });
                    }
                    db.get('SELECT * FROM sorting_items WHERE id = ?', [itemId], (err, updatedItem) => {
                      if (err) {
                        return res.json({ success: false, message: err.message });
                      }
                      res.json({ success: true, data: updatedItem });
                    });
                  });
                  return;
                }

                let remainingShortage = shortageQty;
                let itemsProcessed = 0;
                let processError = null;
                const orderIdsToUpdate = new Set();

                orderItems.forEach(orderItem => {
                  const availableRefund = orderItem.quantity - (orderItem.refund_quantity || 0);
                  const refundQty = Math.min(remainingShortage, availableRefund);
                  remainingShortage -= refundQty;

                  if (refundQty <= 0) {
                    itemsProcessed++;
                    if (itemsProcessed === orderItems.length) {
                      finalizeUpdate();
                    }
                    return;
                  }

                  const newRefundQty = (orderItem.refund_quantity || 0) + refundQty;

                  db.run(
                    'UPDATE order_items SET refund_quantity = ? WHERE id = ?',
                    [newRefundQty, orderItem.item_id],
                    function(err) {
                      if (err) {
                        processError = err;
                      }

                      orderIdsToUpdate.add(orderItem.id);
                      itemsProcessed++;

                      if (itemsProcessed === orderItems.length) {
                        finalizeUpdate();
                      }
                    }
                  );
                });

                function finalizeUpdate() {
                  if (processError) {
                    db.run('ROLLBACK');
                    return res.json({ success: false, message: processError.message });
                  }

                  const orderIdArray = Array.from(orderIdsToUpdate);
                  if (orderIdArray.length === 0) {
                    db.run('COMMIT', (err) => {
                      if (err) {
                        return res.json({ success: false, message: err.message });
                      }
                      db.get('SELECT * FROM sorting_items WHERE id = ?', [itemId], (err, updatedItem) => {
                        if (err) {
                          return res.json({ success: false, message: err.message });
                        }
                        res.json({ success: true, data: updatedItem });
                      });
                    });
                    return;
                  }

                  let ordersUpdated = 0;
                  let orderUpdateError = null;

                  orderIdArray.forEach(orderId => {
                    db.get(
                      'SELECT SUM(refund_quantity * price) as total_refund FROM order_items WHERE order_id = ?',
                      [orderId],
                      (err, result) => {
                        if (err) {
                          orderUpdateError = err;
                          ordersUpdated++;
                          checkDone();
                          return;
                        }

                        const totalRefund = result.total_refund || 0;

                        db.run(
                          'UPDATE orders SET refund_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                          [totalRefund, orderId],
                          function(err) {
                            if (err) {
                              orderUpdateError = err;
                            }
                            ordersUpdated++;
                            checkDone();
                          }
                        );
                      }
                    );
                  });

                  function checkDone() {
                    if (ordersUpdated === orderIdArray.length) {
                      if (orderUpdateError) {
                        db.run('ROLLBACK');
                        return res.json({ success: false, message: orderUpdateError.message });
                      }

                      db.run('COMMIT', (err) => {
                        if (err) {
                          return res.json({ success: false, message: err.message });
                        }

                        db.get('SELECT * FROM sorting_items WHERE id = ?', [itemId], (err, updatedItem) => {
                          if (err) {
                            return res.json({ success: false, message: err.message });
                          }
                          res.json({ success: true, data: updatedItem });
                        });
                      });
                    }
                  }
                }
              });
            }
          );
        });
      });
    });
  });
});

module.exports = router;
