const express = require('express');
const app = express.Router();
const pool = require('../db/pool');
const dbConfig = require("../db/dbConfig");


// API to submit feedback
app.post('/feedback', async (req, res) => {
    const { bookingId, rating, comment } = req.body;
    try {
      const [bookingRows] = await pool.execute(
        'SELECT user_id FROM bookings WHERE id = ? AND status = "checked-out"',
        [bookingId]
      );
      if (bookingRows.length === 0) {
        return res.status(400).json({ success: false, message: 'Booking not found or not checked out' });
      }
      const userId = bookingRows[0].user_id;
  
      await pool.execute(
        'INSERT INTO feedback (user_id, booking_id, rating, comment) VALUES (?, ?, ?, ?)',
        [userId, bookingId, rating, comment]
      );
      res.json({ success: true, message: 'Feedback submitted successfully' });
    } catch (err) {
      console.error('Error submitting feedback:', err);
      res.status(500).json({ success: false, message: 'Failed to submit feedback' });
    }
  });
  
  // API to get feedback for a specific booking
  app.get('/feedback/:bookingId', async (req, res) => {
    const bookingId = req.params.bookingId;
    try {
      const [rows] = await pool.execute(
        'SELECT rating, comment, submitted_at FROM feedback WHERE booking_id = ? ORDER BY submitted_at DESC',
        [bookingId]
      );
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'No feedback found for this booking' });
      }
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('Error fetching feedback:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch feedback' });
    }
  });
  
  // API to get feedback for a specific room
  app.get('/feedback/room/:roomId', async (req, res) => {
    const roomId = req.params.roomId;
    try {
      const [rows] = await pool.execute(`
        SELECT 
          feedback.rating,
          feedback.comment,
          feedback.submitted_at
        FROM feedback
        JOIN bookings ON feedback.booking_id = bookings.id
        WHERE bookings.room_id = ?
        ORDER BY feedback.submitted_at DESC
      `, [roomId]);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('Error fetching room feedback:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch room feedback' });
    }
  });
/* ======================
   COMPLAINTS MODULE
   (Guest complaints handling)
======================= */

//Getting complaints
app.get('/getcomplaintrequest', async (req, res) => {
    try {
      const connection = await pool.getConnection();
      const [rows] = await connection.execute(`
        SELECT cr.id, u.name AS customer_name, b.check_in, b.check_out, cr.type, cr.message, cr.status
        FROM complaints_requests cr
        JOIN users u ON cr.user_id = u.id
        JOIN bookings b ON cr.booking_id = b.id
        WHERE cr.status != 'resolved'
        ORDER BY cr.created_at DESC
      `);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error("Database error:", err); // Improved error logging
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
  app.patch('/updatecomplaint-request/:id', async (req, res) => {
    const { id } = req.params;
  
    try {
      const connection = await pool.getConnection();
      await connection.execute(`
        UPDATE complaints_requests
        SET status = 'resolved', resolved_at = NOW()
        WHERE id = ?
      `, [id]);
  
      res.json({ success: true, message: 'Marked as resolved' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

//Handling Complaints
app.post('/complaint-request', async (req, res) => {
    const { userId, bookingId, type, comment } = req.body;
  
    if (!userId || !bookingId || !type || !comment) {
        return res.status(400).json({ success: false, message: "All fields are required " + bookingId + type + comment + userId  });
    }
    const connection = await pool.getConnection();
    try {
          const [result] = await connection.execute(
            `INSERT INTO complaints_requests (user_id, booking_id, type, message, status)
            VALUES (?, ?, ?, ?, ?)`,
            [userId, bookingId, type, comment, "pending"]
        );
    
  
        res.status(201).json({ success: true, message: "Submitted successfully", id: result.insertId });
    } catch (error) {
        console.error("Error inserting complaint/request:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
  });
module.exports = app;