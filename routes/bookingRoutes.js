const express = require("express");
const app = express.Router();
const pool = require("../db/pool");
const mysql = require("mysql2/promise");
const dbConfig = require("../db/dbConfig");


// API to Book a Room
app.post("/book-room", async (req, res) => {
    const { name, email, phone, checkIn, checkOut, room, paymentMethod } = req.body;
  
    if (!name || !email || !phone || !checkIn || !checkOut || !room || !paymentMethod) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
  
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      let [userResult] = await connection.execute("SELECT id FROM users WHERE email = ?", [email]);
      let userId;
      if (userResult.length === 0) {
        return res.status(400).json({ success: false, message: "Account not registered!" });
      } else {
        userId = userResult[0].id;
      }
      const [roomResult] = await connection.execute(
        "SELECT id, price FROM rooms WHERE type = ? AND status = 'available' LIMIT 1",
        [room]
      );
      if (roomResult.length === 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: "Room not available!" });
      }
      const { id: roomId, price: roomPrice } = roomResult[0];
      const [existingBookings] = await connection.execute(
        `SELECT id FROM bookings 
         WHERE room_id = ? AND 
         ((check_in <= ? AND check_out > ?) OR 
          (check_in < ? AND check_out >= ?) OR 
          (check_in >= ? AND check_out <= ?))`,
        [roomId, checkIn, checkIn, checkOut, checkOut, checkIn, checkOut]
      );
      if (existingBookings.length > 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: "Room already booked for selected dates!" });
      }
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      const stayDuration = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
      const total_price = stayDuration * roomPrice;
      await connection.execute(
        `INSERT INTO bookings (user_id, room_id, check_in, check_out, status, payment_method, total_price) 
         VALUES (?, ?, ?, ?, 'confirmed', ?, ?)`,
        [userId, roomId, checkIn, checkOut, paymentMethod, total_price]
      );
      await connection.execute(
        "UPDATE rooms SET status = 'occupied' WHERE id = ?",
        [roomId]
      );
      await connection.commit();
      res.json({ success: true, message: "Booking successful!", total_price });
    } catch (err) {
      await connection.rollback();
      console.error("Booking error:", err);
      res.status(500).json({ success: false, message: "Booking failed!" });
    } finally {
      connection.release();
    }
  });

//Get booking for updating 
app.patch('/bookings/:id', async (req, res) => {
    const bookingId = req.params.id;
    const { room_id, check_in, check_out, payment_method } = req.body;
  
    if (!room_id || !check_in || !check_out || !payment_method) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }
  
    try {
        // Get room price from rooms table
        const [room] = await pool.promise().query('SELECT price FROM rooms WHERE id = ?', [room_id]);
        if (room.length === 0) {
            return res.status(404).json({ success: false, message: "Room not found" });
        }
        const roomPrice = room[0].price;
  
        // Calculate total price based on duration
        const days = Math.ceil((new Date(check_out) - new Date(check_in)) / (1000 * 60 * 60 * 24));
        if (days <= 0) {
            return res.status(400).json({ success: false, message: "Invalid dates" });
        }
        const total_price = days * roomPrice;
  
        // Update booking in the database
        await pool.promise().query(
            'UPDATE bookings SET room_id = ?, check_in = ?, check_out = ?, payment_method = ?, total_price = ? WHERE id = ?',
            [room_id, check_in, check_out, payment_method, total_price, bookingId]
        );
  
        res.json({ success: true, message: "Booking updated successfully!", total_price });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error", error: err });
    }
  });
 
// API to get all bookings with feedback status
app.post('/bookings', async (req, res) => {
    try {
        const { userID } = req.body; // Extract from request body
        console.log("UserID: ", userID);
  
        if (!userID) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }
  
        const [rows] = await pool.execute(`
            SELECT 
                bookings.id,
                rooms.room_number AS room,
                bookings.check_in AS checkIn,
                bookings.check_out AS checkOut,
                bookings.status,
                EXISTS (SELECT 1 FROM feedback WHERE feedback.booking_id = bookings.id) AS hasFeedback
            FROM bookings
            JOIN rooms ON bookings.room_id = rooms.id 
            WHERE bookings.user_id = ?
        `, [userID]);
  
        res.json(rows);
    } catch (err) {
        console.error("Error fetching bookings:", err);
        res.status(500).json({ success: false, message: "Failed to fetch bookings" });
    }
  }); 
  
  // GET Booking Details
  app.get("/bookings/:id", async (req, res) => {
      const { id } = req.params;
  
      try {
          const connection = await mysql.createConnection(dbConfig);
          const [rows] = await connection.execute(
              "SELECT room_id, check_in, check_out FROM bookings WHERE id = ?",
              [id]
          );
          connection.end();
  
          if (rows.length > 0) {
              res.json(rows[0]);
          } else {
              res.status(404).json({ message: "Booking not found" });
          }
      } catch (error) {
          console.error(error);
          res.status(500).json({ message: "Internal server error" });
      }
  });
  
  // UPDATE Booking Details
  app.put("/bookings/:id", async (req, res) => {
    const { id } = req.params;
    const { room_id, check_in, check_out } = req.body;
  
    // Validate input
    if (!room_id || !check_in || !check_out) {
        return res.status(400).json({ message: "Missing required fields" });
    }
  
    const connection = await mysql.createConnection(dbConfig);
  
    try {
        await connection.beginTransaction();
  
        // Check for overlapping bookings for the same room
        const [existingBookings] = await connection.execute(
            `SELECT id FROM bookings 
             WHERE room_id = ? AND id != ? AND 
             ((check_in <= ? AND check_out > ?) OR 
              (check_in < ? AND check_out >= ?) OR 
              (check_in >= ? AND check_out <= ?))`,
            [room_id, id, check_in, check_in, check_out, check_out, check_in, check_out]
        );
  
        if (existingBookings.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: "Room already booked for selected dates!" });
        }
  
        // Update the booking
        const [result] = await connection.execute(
            "UPDATE bookings SET room_id = ?, check_in = ?, check_out = ? WHERE id = ?",
            [room_id, check_in, check_out, id]
        );
  
        if (result.affectedRows > 0) {
            await connection.commit();
            res.json({ message: "Booking updated successfully" });
        } else {
            await connection.rollback();
            res.status(404).json({ message: "Booking not found" });
        }
    } catch (error) {
        await connection.rollback();
        console.error("Error updating booking:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        connection.end();
    }
  });
  
  // API to get a specific booking by ID
  app.get('/bookings', async (req, res) => {
    const userID = req.query.userID;
  
    if (!userID) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
  
    try {
      const [rows] = await pool.execute(`
        SELECT 
          bookings.id,
          rooms.room_number AS room,
          bookings.check_in AS checkIn,
          bookings.check_out AS checkOut,
          bookings.status
        FROM bookings
        JOIN rooms ON bookings.room_id = rooms.id
        WHERE bookings.user_id = ?
      `, [userID]);
  
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: "No bookings found" });
      }
  
      res.json(rows);
    } catch (err) {
      console.error("Error fetching bookings:", err);
      res.status(500).json({ success: false, message: "Failed to fetch bookings" });
    }
  });
  
  
  // API to cancel a booking
  app.post('/bookings/:id/cancel', async (req, res) => {
    const bookingId = req.params.id;
    try {
      const [result] = await pool.execute(
        `UPDATE bookings SET status = 'cancelled' WHERE id = ? AND status = 'confirmed'`,
        [bookingId]
      );
      if (result.affectedRows === 0) {
        return res.status(400).json({ success: false, message: 'Booking not found or already cancelled' });
      }
      res.json({ success: true, message: 'Booking cancelled successfully' });
    } catch (err) {
      console.error('Error cancelling booking:', err);
      res.status(500).json({ success: false, message: 'Failed to cancel booking' });
    }
  });
  
  // API to checkout a booking
  app.post('/bookings/:id/checkout', async (req, res) => {
    const bookingId = req.params.id;
    try {
      const [result] = await pool.execute(
        `UPDATE bookings SET status = 'checked-out' WHERE id = ? AND status = 'checked-in' OR status = 'confirmed'`,
        [bookingId]
      );
      if (result.affectedRows === 0) {
        return res.status(400).json({ success: false, message: 'Booking not found or not checked-in' });
      }
      res.json({ success: true, message: 'Booking checked out successfully' });
    } catch (err) {
      console.error('Error checking out booking:', err);
      res.status(500).json({ success: false, message: 'Failed to checkout booking' });
    }
  });
  
  // API to check-in a booking (new endpoint to support 'checked-in' status)
  app.post('/bookings/:id/checkin', async (req, res) => {
    const bookingId = req.params.id;
    try {
      const [result] = await pool.execute(
        `UPDATE bookings SET status = 'checked-in' WHERE id = ? AND status = 'confirmed'`,
        [bookingId]
      );
      if (result.affectedRows === 0) {
        return res.status(400).json({ success: false, message: 'Booking not found or not confirmed' });
      }
      res.json({ success: true, message: 'Booking checked in successfully' });
    } catch (err) {
      console.error('Error checking in booking:', err);
      res.status(500).json({ success: false, message: 'Failed to check in booking' });
    }
  });
  
// API to get all bookings with feedback status
app.get('/allconfirmedbookings', async (req, res) => {
    try {
        
        const [rows] = await pool.execute(`
            SELECT 
                bookings.id,
                users.name AS customerName,
                rooms.room_number AS room,
                bookings.check_in AS checkIn,
                bookings.check_out AS checkOut,
                bookings.status,
                EXISTS (SELECT 1 FROM feedback WHERE feedback.booking_id = bookings.id) AS hasFeedback
            FROM bookings
            JOIN rooms ON bookings.room_id = rooms.id 
            JOIN users ON bookings.user_id = users.id
            WHERE bookings.status!="cancelled"
        `);
  
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error("Error fetching bookings:", err);
        res.status(500).json({ success: false, message: "Failed to fetch bookings" });
    }
  });
  // get all bookings
app.get('/booking-history', async (req, res) => {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          bookings.id,
          users.name AS customerName,
          rooms.room_number AS room,
          bookings.check_in AS checkIn,
          bookings.check_out AS checkOut,
          bookings.status
        FROM bookings
        JOIN rooms ON bookings.room_id = rooms.id 
        JOIN users ON bookings.user_id = users.id
      `);
      console.log('Fetched booking history:', rows); // Debug log
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('Error fetching booking history:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch booking history' });
    }
  });
  
// API to get booking history for reports
app.get('/bookings-report', async (req, res) => {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          bookings.id,
          users.name AS customerName,
          rooms.room_number AS room,
          bookings.check_in AS checkIn,
          bookings.check_out AS checkOut,
          bookings.status,
          bookings.payment_method,
          bookings.total_price,
          bookings.booking_date
        FROM bookings
        LEFT JOIN rooms ON bookings.room_id = rooms.id 
        LEFT JOIN users ON bookings.user_id = users.id
      `);
      console.log('Fetched booking history:', rows); // Debug log
      if (rows.length === 0) {
        console.warn('No bookings found in database');
        return res.json({ success: true, data: [], message: 'No bookings available' });
      }
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('Error fetching booking history:', err.message, err.stack);
      res.status(500).json({ success: false, message: 'Failed to fetch booking history', error: err.message });
    }
  });

module.exports = app;