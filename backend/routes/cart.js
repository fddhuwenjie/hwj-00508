const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/:userId', (req, res) => {
  const { userId } = req.params;

  const sql = `
    SELECT 
      carts.id as cart_id,
      carts.user_id,
      carts.product_id,
      carts.quantity,
      carts.created_at,
      products.name,
      products.category,
      products.specification,
      products.group_price,
      products.stock,
      products.status,
      products.image
    FROM carts
    INNER JOIN products ON carts.product_id = products.id
    WHERE carts.user_id = ?
    ORDER BY carts.created_at DESC
  `;

  db.all(sql, [userId], (err, rows) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    res.json({ success: true, data: rows });
  });
});

router.post('/', (req, res) => {
  const { user_id, product_id, quantity = 1 } = req.body;

  if (!user_id || !product_id) {
    return res.json({ success: false, message: '用户ID和商品ID不能为空' });
  }

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.json({ success: false, message: '商品数量必须大于0' });
  }

  db.get('SELECT * FROM products WHERE id = ?', [product_id], (err, product) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!product) {
      return res.json({ success: false, message: '商品不存在' });
    }

    db.get('SELECT * FROM carts WHERE user_id = ? AND product_id = ?', [user_id, product_id], (err, cartItem) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      if (cartItem) {
        const newQty = cartItem.quantity + qty;
        db.run('UPDATE carts SET quantity = ? WHERE id = ?', [newQty, cartItem.id], function(err) {
          if (err) {
            return res.json({ success: false, message: err.message });
          }
          db.get('SELECT * FROM carts WHERE id = ?', [cartItem.id], (err, row) => {
            if (err) {
              return res.json({ success: false, message: err.message });
            }
            res.json({ success: true, data: row });
          });
        });
      } else {
        const sql = 'INSERT INTO carts (user_id, product_id, quantity) VALUES (?, ?, ?)';
        const params = [user_id, product_id, qty];

        db.run(sql, params, function(err) {
          if (err) {
            return res.json({ success: false, message: err.message });
          }
          db.get('SELECT * FROM carts WHERE id = ?', [this.lastID], (err, row) => {
            if (err) {
              return res.json({ success: false, message: err.message });
            }
            res.json({ success: true, data: row });
          });
        });
      }
    });
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.json({ success: false, message: '商品数量必须大于0' });
  }

  db.get('SELECT * FROM carts WHERE id = ?', [id], (err, cartItem) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!cartItem) {
      return res.json({ success: false, message: '购物车商品不存在' });
    }

    db.run('UPDATE carts SET quantity = ? WHERE id = ?', [qty, id], function(err) {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      db.get('SELECT * FROM carts WHERE id = ?', [id], (err, row) => {
        if (err) {
          return res.json({ success: false, message: err.message });
        }
        res.json({ success: true, data: row });
      });
    });
  });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM carts WHERE id = ?', [id], function(err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (this.changes === 0) {
      return res.json({ success: false, message: '购物车商品不存在' });
    }
    res.json({ success: true, data: { id: parseInt(id) } });
  });
});

router.delete('/user/:userId/clear', (req, res) => {
  const { userId } = req.params;
  db.run('DELETE FROM carts WHERE user_id = ?', [userId], function(err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    res.json({ success: true, data: { deleted_count: this.changes } });
  });
});

module.exports = router;
