const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Database configuration
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "Maazking1@",
  database: "hotel_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Verify connection
pool.getConnection()
  .then(connection => {
    console.log("MySQL Connected...");
    connection.release();
  })
  .catch(err => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });

// Serve static files from the "pages" directory
app.use(express.static(path.join(__dirname, "pages")));

// Routes
app.get("/pages", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Serve static HTML files from /pages
const staticPages = ["login", "register", "search", "details", "rooms", "hotel-details", "user-choice", "bookings", "history", "review"];
staticPages.forEach(page => {
  app.get(`/pages/${page}.html`, (req, res) => {
    res.sendFile(path.join(__dirname, "pages", `${page}.html`));
  });
});

// Handle room details dynamically
app.get("/pages/details.html", (req, res) => {
  const roomType = req.query.room;
  const validRooms = ["standard", "deluxe", "suite"];
  if (validRooms.includes(roomType)) {
    res.sendFile(path.join(__dirname, "pages", `${roomType}.html`));
  } else {
    res.sendFile(path.join(__dirname, "pages", "details.html"));
  }
});

// API to get all available rooms
app.get('/api/rooms', async (req, res) => {
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

// API to get all bookings with feedback status
app.get('/api/bookings', async (req, res) => {
  try {
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
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// API to get a specific booking by ID
app.get('/api/bookings/:id', async (req, res) => {
  const bookingId = req.params.id;
  try {
    const [rows] = await pool.execute(`
      SELECT 
        bookings.id,
        rooms.room_number AS room,
        bookings.check_in AS checkIn,
        bookings.check_out AS checkOut,
        bookings.status,
        bookings.user_id
      FROM bookings
      JOIN rooms ON bookings.room_id = rooms.id
      WHERE bookings.id = ?
    `, [bookingId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching booking:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
});

// API to cancel a booking
app.post('/api/bookings/:id/cancel', async (req, res) => {
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
app.post('/api/bookings/:id/checkout', async (req, res) => {
  const bookingId = req.params.id;
  try {
    const [result] = await pool.execute(
      `UPDATE bookings SET status = 'checked-out' WHERE id = ? AND status = 'checked-in'`,
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
app.post('/api/bookings/:id/checkin', async (req, res) => {
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

// API to submit feedback
app.post('/api/feedback', async (req, res) => {
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
app.get('/api/feedback/:bookingId', async (req, res) => {
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
app.get('/api/feedback/room/:roomId', async (req, res) => {
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

// Login Route with bcrypt
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) {
      return res.json({ success: false, message: "User not found" });
    }
    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.json({ success: false, message: "Invalid password" });
    }
    const token = { email: user.email, role: user.role };
    const redirectPath = user.role === "admin" ? "/admin-dashboard.html" : "/index.html";
    res.json({ success: true, redirectTo: redirectPath, user: token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Register Route with password hashing
app.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
    await pool.execute(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'guest')",
      [fullName, email, hashedPassword]
    );
    res.json({ success: true, redirectTo: "/pages/login.html" });
  } catch (err) {
    console.error("Registration error:", err);
    const message = err.code === "ER_DUP_ENTRY" ? "Email already exists" : "Registration failed";
    res.status(500).json({ success: false, message });
  }
});

// API to Book a Room
app.post("/book-room", async (req, res) => {
  const { name, email, phone, checkIn, checkOut, roomType, paymentMethod } = req.body;
  if (!name || !email || !phone || !checkIn || !checkOut || !roomType || !paymentMethod) {
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
      [roomType]
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

// Catch-all route for 404
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "404.html"));
});

// Start server on port 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});