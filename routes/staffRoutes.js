const express = require('express');
const app = express.Router();
const pool = require('../db/pool');
const dbConfig = require("../db/dbConfig");


// Get all staff (join with users for name and email)
app.get('/staff', async (req, res) => {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          staff.id AS staff_id,
          staff.user_id,
          users.name,
          users.email,
          staff.position,
          staff.salary,
          staff.hire_date
        FROM staff
        JOIN users ON staff.user_id = users.id
      `);
      console.log('Fetched staff:', rows);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('Error fetching staff:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch staff' });
    }
  });
  
  // Add staff (create user with role 'staff' and staff record)
  app.post('/staff', async (req, res) => {
    const { name, email, position, salary, hire_date } = req.body;
  
    // Validate required fields
    if (!name || !email || !position || salary == null || !hire_date) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
  
    // Ensure salary is a valid number
    const parsedSalary = parseFloat(salary);
    if (isNaN(parsedSalary) || parsedSalary < 0) {
      return res.status(400).json({ success: false, message: 'Invalid salary' });
    }
  
    const password_hash = 'default_hashed_password'; // Replace with actual password hashing
    try {
      // Insert into users table
      const [userResult] = await pool.execute(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [name, email, password_hash, 'staff']
      );
      const userId = userResult.insertId;
  
      // Insert into staff table
      await pool.execute(
        'INSERT INTO staff (user_id, position, salary, hire_date) VALUES (?, ?, ?, ?)',
        [userId, position, parsedSalary, hire_date]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('Error adding staff:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ success: false, message: 'Email already exists' });
      } else {
        res.status(500).json({ success: false, message: 'Failed to add staff: ' + err.message });
      }
    }
  });
  
  // Update staff
  app.put('/staff/:id', async (req, res) => {
    const { id } = req.params;
    const { user_id, name, email, position, salary, hire_date } = req.body;
    try {
      // Update users table
      const [userResult] = await pool.execute(
        'UPDATE users SET name = ?, email = ? WHERE id = ?',
        [name, email, user_id]
      );
      if (userResult.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      // Update staff table
      const [staffResult] = await pool.execute(
        'UPDATE staff SET position = ?, salary = ?, hire_date = ? WHERE id = ?',
        [position, salary, hire_date, id]
      );
      if (staffResult.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Error updating staff:', err);
      res.status(500).json({ success: false, message: 'Failed to update staff' });
    }
  });
  
  // Delete staff
  app.delete('/staff/:id', async (req, res) => {
    const { id } = req.params;
    try {
      // Get user_id from staff table
      const [staffRows] = await pool.execute('SELECT user_id FROM staff WHERE id = ?', [id]);
      if (staffRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }
      const userId = staffRows[0].user_id;
  
      // Delete staff record
      const [staffResult] = await pool.execute('DELETE FROM staff WHERE id = ?', [id]);
      if (staffResult.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }
  
      // Delete associated user
      await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting staff:', err);
      res.status(500).json({ success: false, message: 'Failed to delete staff' });
    }
});

module.exports = app;