const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const { status, page = 1, pageSize = 10 } = req.query;
  const pageNum = parseInt(page);
  const size = parseInt(pageSize);
  const offset = (pageNum - 1) * size;

  let whereClauses = [];
  let params = [];

  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const countSql = `SELECT COUNT(*) as total FROM pickup_points ${whereSql}`;
  const listSql = `SELECT * FROM pickup_points ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;

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
  db.get('SELECT * FROM pickup_points WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!row) {
      return res.json({ success: false, message: '自提点不存在' });
    }
    res.json({ success: true, data: row });
  });
});

router.post('/', (req, res) => {
  const { name, address, contact, phone } = req.body;

  if (!name) {
    return res.json({ success: false, message: '自提点名称不能为空' });
  }

  const sql = 'INSERT INTO pickup_points (name, address, contact, phone) VALUES (?, ?, ?, ?)';
  const params = [name, address || null, contact || null, phone || null];

  db.run(sql, params, function(err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    db.get('SELECT * FROM pickup_points WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      res.json({ success: true, data: row });
    });
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, address, contact, phone } = req.body;

  db.get('SELECT * FROM pickup_points WHERE id = ?', [id], (err, point) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!point) {
      return res.json({ success: false, message: '自提点不存在' });
    }

    const updatedName = name !== undefined ? name : point.name;
    const updatedAddress = address !== undefined ? address : point.address;
    const updatedContact = contact !== undefined ? contact : point.contact;
    const updatedPhone = phone !== undefined ? phone : point.phone;

    const sql = 'UPDATE pickup_points SET name = ?, address = ?, contact = ?, phone = ? WHERE id = ?';
    const params = [updatedName, updatedAddress, updatedContact, updatedPhone, id];

    db.run(sql, params, function(err) {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      db.get('SELECT * FROM pickup_points WHERE id = ?', [id], (err, row) => {
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
  db.run('DELETE FROM pickup_points WHERE id = ?', [id], function(err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (this.changes === 0) {
      return res.json({ success: false, message: '自提点不存在' });
    }
    res.json({ success: true, data: { id: parseInt(id) } });
  });
});

router.put('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || (status !== 'active' && status !== 'inactive')) {
    return res.json({ success: false, message: '状态不合法' });
  }

  db.get('SELECT * FROM pickup_points WHERE id = ?', [id], (err, point) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!point) {
      return res.json({ success: false, message: '自提点不存在' });
    }

    db.run('UPDATE pickup_points SET status = ? WHERE id = ?', [status, id], function(err) {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      db.get('SELECT * FROM pickup_points WHERE id = ?', [id], (err, row) => {
        if (err) {
          return res.json({ success: false, message: err.message });
        }
        res.json({ success: true, data: row });
      });
    });
  });
});

module.exports = router;
