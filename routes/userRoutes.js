const express = require('express');
const app = express.Router();
const pool = require('../db/pool');
const dbConfig = require("../db/dbConfig");


// Get all users
app.get('/users', async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT id, name, email, created_at, role FROM users');
      console.log('Fetched users:', rows);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('Error fetching users:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
  });
  
  // Update user
  app.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email } = req.body;
    try {
      const [result] = await pool.execute(
        'UPDATE users SET name = ?, email = ? WHERE id = ?',
        [name, email, id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Error updating user:', err);
      res.status(500).json({ success: false, message: 'Failed to update user' });
    }
  });
  
  // Delete user
  app.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
      // Delete associated staff record first (if any)
      await pool.execute('DELETE FROM staff WHERE user_id = ?', [id]);
      const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting user:', err);
      res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
  });

module.exports = app;