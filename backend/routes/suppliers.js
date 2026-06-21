const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  db.all('SELECT * FROM suppliers ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    res.json({ success: true, data: rows });
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM suppliers WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!row) {
      return res.json({ success: false, message: '供应商不存在' });
    }
    res.json({ success: true, data: row });
  });
});

router.post('/', (req, res) => {
  const { name, contact, phone } = req.body;

  if (!name) {
    return res.json({ success: false, message: '供应商名称不能为空' });
  }

  const sql = 'INSERT INTO suppliers (name, contact, phone) VALUES (?, ?, ?)';
  const params = [name, contact || null, phone || null];

  db.run(sql, params, function(err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    db.get('SELECT * FROM suppliers WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      res.json({ success: true, data: row });
    });
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, contact, phone } = req.body;

  db.get('SELECT * FROM suppliers WHERE id = ?', [id], (err, supplier) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!supplier) {
      return res.json({ success: false, message: '供应商不存在' });
    }

    const updatedName = name !== undefined ? name : supplier.name;
    const updatedContact = contact !== undefined ? contact : supplier.contact;
    const updatedPhone = phone !== undefined ? phone : supplier.phone;

    const sql = 'UPDATE suppliers SET name = ?, contact = ?, phone = ? WHERE id = ?';
    const params = [updatedName, updatedContact, updatedPhone, id];

    db.run(sql, params, function(err) {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      db.get('SELECT * FROM suppliers WHERE id = ?', [id], (err, row) => {
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
  db.run('DELETE FROM suppliers WHERE id = ?', [id], function(err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (this.changes === 0) {
      return res.json({ success: false, message: '供应商不存在' });
    }
    res.json({ success: true, data: { id: parseInt(id) } });
  });
});

module.exports = router;
