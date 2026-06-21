const express = require('express');
const router = express.Router();
const db = require('../db/database');

const VALID_CATEGORIES = ['蔬果', '肉蛋', '粮油', '日用品', '零食'];
const VALID_STATUSES = ['on', 'off'];

router.get('/', (req, res) => {
  const { category, status, page = 1, pageSize = 10 } = req.query;
  const pageNum = parseInt(page);
  const size = parseInt(pageSize);
  const offset = (pageNum - 1) * size;

  let whereClauses = [];
  let params = [];

  if (category && VALID_CATEGORIES.includes(category)) {
    whereClauses.push('category = ?');
    params.push(category);
  }

  if (status && VALID_STATUSES.includes(status)) {
    whereClauses.push('status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const countSql = `SELECT COUNT(*) as total FROM products ${whereSql}`;
  const listSql = `SELECT * FROM products ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;

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
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!row) {
      return res.json({ success: false, message: '商品不存在' });
    }
    res.json({ success: true, data: row });
  });
});

router.post('/', (req, res) => {
  const { name, category, specification, group_price, stock, supplier_id, cutoff_time, pickup_date, status = 'on', image } = req.body;

  if (!name || !category || group_price === undefined) {
    return res.json({ success: false, message: '商品名称、分类和团购价不能为空' });
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return res.json({ success: false, message: '分类不合法' });
  }

  const sql = `
    INSERT INTO products (name, category, specification, group_price, stock, supplier_id, cutoff_time, pickup_date, status, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [name, category, specification || null, group_price, stock || 0, supplier_id || null, cutoff_time || null, pickup_date || null, status, image || null];

  db.run(sql, params, function(err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    db.get('SELECT * FROM products WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      res.json({ success: true, data: row });
    });
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, category, specification, group_price, stock, supplier_id, cutoff_time, pickup_date, status, image } = req.body;

  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!product) {
      return res.json({ success: false, message: '商品不存在' });
    }

    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.json({ success: false, message: '分类不合法' });
    }

    const updatedName = name !== undefined ? name : product.name;
    const updatedCategory = category !== undefined ? category : product.category;
    const updatedSpecification = specification !== undefined ? specification : product.specification;
    const updatedGroupPrice = group_price !== undefined ? group_price : product.group_price;
    const updatedStock = stock !== undefined ? stock : product.stock;
    const updatedSupplierId = supplier_id !== undefined ? supplier_id : product.supplier_id;
    const updatedCutoffTime = cutoff_time !== undefined ? cutoff_time : product.cutoff_time;
    const updatedPickupDate = pickup_date !== undefined ? pickup_date : product.pickup_date;
    const updatedStatus = status !== undefined ? status : product.status;
    const updatedImage = image !== undefined ? image : product.image;

    const sql = `
      UPDATE products 
      SET name = ?, category = ?, specification = ?, group_price = ?, stock = ?, supplier_id = ?, cutoff_time = ?, pickup_date = ?, status = ?, image = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const params = [updatedName, updatedCategory, updatedSpecification, updatedGroupPrice, updatedStock, updatedSupplierId, updatedCutoffTime, updatedPickupDate, updatedStatus, updatedImage, id];

    db.run(sql, params, function(err) {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
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
  db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (this.changes === 0) {
      return res.json({ success: false, message: '商品不存在' });
    }
    res.json({ success: true, data: { id: parseInt(id) } });
  });
});

router.put('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.json({ success: false, message: '状态不合法，只能是 on 或 off' });
  }

  db.run('UPDATE products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id], function(err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (this.changes === 0) {
      return res.json({ success: false, message: '商品不存在' });
    }
    db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      res.json({ success: true, data: row });
    });
  });
});

module.exports = router;
