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

  const countSql = `SELECT COUNT(*) as total FROM delivery_staff ${whereSql}`;
  const listSql = `SELECT * FROM delivery_staff ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;

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
  db.get('SELECT * FROM delivery_staff WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!row) {
      return res.json({ success: false, message: '配送员不存在' });
    }
    res.json({ success: true, data: row });
  });
});

router.post('/', (req, res) => {
  const { name, phone } = req.body;

  if (!name) {
    return res.json({ success: false, message: '配送员姓名不能为空' });
  }

  const sql = 'INSERT INTO delivery_staff (name, phone) VALUES (?, ?)';
  const params = [name, phone || null];

  db.run(sql, params, function(err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    db.get('SELECT * FROM delivery_staff WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      res.json({ success: true, data: row });
    });
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone } = req.body;

  db.get('SELECT * FROM delivery_staff WHERE id = ?', [id], (err, staff) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!staff) {
      return res.json({ success: false, message: '配送员不存在' });
    }

    const updatedName = name !== undefined ? name : staff.name;
    const updatedPhone = phone !== undefined ? phone : staff.phone;

    const sql = 'UPDATE delivery_staff SET name = ?, phone = ? WHERE id = ?';
    const params = [updatedName, updatedPhone, id];

    db.run(sql, params, function(err) {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      db.get('SELECT * FROM delivery_staff WHERE id = ?', [id], (err, row) => {
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
  db.run('DELETE FROM delivery_staff WHERE id = ?', [id], function(err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (this.changes === 0) {
      return res.json({ success: false, message: '配送员不存在' });
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

  db.get('SELECT * FROM delivery_staff WHERE id = ?', [id], (err, staff) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!staff) {
      return res.json({ success: false, message: '配送员不存在' });
    }

    db.run('UPDATE delivery_staff SET status = ? WHERE id = ?', [status, id], function(err) {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      db.get('SELECT * FROM delivery_staff WHERE id = ?', [id], (err, row) => {
        if (err) {
          return res.json({ success: false, message: err.message });
        }
        res.json({ success: true, data: row });
      });
    });
  });
});

module.exports = router;
