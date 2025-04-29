const express = require("express");
const app = express.Router();
const pool = require("../db/pool");
const dbConfig = require("../db/dbConfig");


// API to get all available rooms
app.get('/rooms', async (req, res) => {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          id,
          room_number,
          type,
          price,
          status,
          description
        FROM rooms
        WHERE status = 'available'
      `);
      res.json(rows);
    } catch (err) {
      console.error('Error fetching rooms:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch rooms' });
    }
  });

// API to get all rooms
app.get('/all-rooms', async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT id, room_number, type, status FROM rooms');
      res.json(rows);
    } catch (err) {
      console.error('Error fetching all rooms:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch rooms' });
    }
  });

// Retrieve all rooms
app.get('/rooms-list', async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT id, room_number, type, price, status, description FROM rooms');
      res.json(rows);
    } catch (err) {
      console.error('Error fetching rooms:', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve rooms' });
    }
  });

// Retrieve a specific room by ID
app.get('/room-details/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await pool.execute('SELECT id, room_number, type, price, status, description FROM rooms WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Room not found' });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error('Error fetching room:', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve room' });
    }
  });
  
  // Add a new room
  app.post('/create-room', async (req, res) => {
    const { room_number, type, price, description } = req.body;
    if (!room_number || !type || !price || !description) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    try {
      const [existing] = await pool.execute('SELECT id FROM rooms WHERE room_number = ?', [room_number]);
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'Room number already exists' });
      }
      const [result] = await pool.execute(
        'INSERT INTO rooms (room_number, type, price, status, description) VALUES (?, ?, ?, ?, ?)',
        [room_number, type, price, 'available', description]
      );
      res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
      console.error('Error adding room:', err);
      res.status(500).json({ success: false, message: 'Failed to create room' });
    }
  });
  
  // Update an existing room
  app.put('/update-room/:id', async (req, res) => {
    const { id } = req.params;
    const { type, price, description } = req.body;
    if (!type || !price || !description) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    try {
      const [result] = await pool.execute(
        'UPDATE rooms SET type = ?, price = ?, description = ? WHERE id = ?',
        [type, price, description, id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Room not found' });
      }
      res.json({ success: true, message: 'Room updated successfully' });
    } catch (err) {
      console.error('Error updating room:', err);
      res.status(500).json({ success: false, message: 'Failed to update room' });
    }
  });
  
  // Delete a room
  app.delete('/remove-room/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const [result] = await pool.execute('DELETE FROM rooms WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Room not found' });
      }
      res.json({ success: true, message: 'Room removed successfully' });
    } catch (err) {
      console.error('Error deleting room:', err);
      res.status(500).json({ success: false, message: 'Failed to remove room' });
    }
  });

// API to update room status
app.patch('/rooms/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['available', 'occupied'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    try {
      const [result] = await pool.execute('UPDATE rooms SET status = ? WHERE id = ?', [status, id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Room not found' });
      }
      res.json({ success: true, message: 'Room status updated' });
    } catch (err) {
      console.error('Error updating room status:', err);
      res.status(500).json({ success: false, message: 'Failed to update room status' });
    }
  });

//Get room id from room number 
app.get("/roomidbyroomnumber/:roomNumber", async (req, res) => {
    const { roomNumber } = req.params;
    try {
      const [rows] = await pool.execute("SELECT id FROM rooms WHERE room_number = ?", [roomNumber]);
      if (rows.length === 0) return res.status(404).json({ message: "Room not found" });
      res.json({ room_id: rows[0].id });
    } catch (err) {
      console.error("Error fetching room ID:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
module.exports = app;