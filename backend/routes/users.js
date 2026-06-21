const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10 } = req.query;
  const pageNum = parseInt(page);
  const size = parseInt(pageSize);
  const offset = (pageNum - 1) * size;

  const countSql = 'SELECT COUNT(*) as total FROM users';
  const listSql = 'SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?';

  db.get(countSql, [], (err, countResult) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }

    db.all(listSql, [size, offset], (err, rows) => {
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
  db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!row) {
      return res.json({ success: false, message: '用户不存在' });
    }
    res.json({ success: true, data: row });
  });
});

router.post('/', (req, res) => {
  const { username, nickname, phone, address, avatar } = req.body;

  if (!username) {
    return res.json({ success: false, message: '用户名不能为空' });
  }

  const sql = `
    INSERT INTO users (username, nickname, phone, address, avatar)
    VALUES (?, ?, ?, ?, ?)
  `;
  const params = [username, nickname || null, phone || null, address || null, avatar || null];

  db.run(sql, params, function(err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      res.json({ success: true, data: row });
    });
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { username, nickname, phone, address, avatar } = req.body;

  db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (!user) {
      return res.json({ success: false, message: '用户不存在' });
    }

    const updatedUsername = username !== undefined ? username : user.username;
    const updatedNickname = nickname !== undefined ? nickname : user.nickname;
    const updatedPhone = phone !== undefined ? phone : user.phone;
    const updatedAddress = address !== undefined ? address : user.address;
    const updatedAvatar = avatar !== undefined ? avatar : user.avatar;

    const sql = `
      UPDATE users 
      SET username = ?, nickname = ?, phone = ?, address = ?, avatar = ?
      WHERE id = ?
    `;
    const params = [updatedUsername, updatedNickname, updatedPhone, updatedAddress, updatedAvatar, id];

    db.run(sql, params, function(err) {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
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
  db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (this.changes === 0) {
      return res.json({ success: false, message: '用户不存在' });
    }
    res.json({ success: true, data: { id: parseInt(id) } });
  });
});

module.exports = router;
