const express = require("express");
const mysql = require("mysql2/promise"); // Using promise-based API
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
  password: "dani",
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
const staticPages = ["login", "register", "search", "details", "rooms", "hotel-details", "user-choice", "bookings"];
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

// Catch-all route for 404
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "404.html"));
});


// 🔹 Login Route with bcrypt
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: "User not found" });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.json({ success: false, message: "Invalid password" });
    }

    const token = { email: user.email, role: user.role };
    const redirectPath =
      user.role === "admin" ? "/admin-dashboard.html" : "/index.html";

    res.json({ success: true, redirectTo: redirectPath, user: token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 🔹 Register Route with password hashing
app.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log (fullName, email, password)
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

    const message =
      err.code === "ER_DUP_ENTRY" ? "Email already exists" : "Registration failed";

    res.status(500).json({ success: false, message });
  }
});

// 🔹 API to Book a Room
app.post("/book-room", async (req, res) => {
  const { name, email, phone, checkIn, checkOut, room, paymentMethod } = req.body;

  if (!name || !email || !phone || !checkIn || !checkOut || !room || !paymentMethod) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 🔸 Check if user exists or create a new user
    let [userResult] = await connection.execute("SELECT id FROM users WHERE email = ?", [email]);

    let userId;
    if (userResult.length === 0) {
      return res.status(400).json({ success: false, message: "Account not registered!" });
    } else {
      userId = userResult[0].id;
    }

    console.log("Requested Room Type: ", room);

    // 🔸 Get an available room of the requested type & price
    const [roomResult] = await connection.execute(
      "SELECT id, price FROM rooms WHERE type = ? AND status = 'available' LIMIT 1",
      [room]
    );

    if (roomResult.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Room not available!" });
    }

    const { id: roomId, price: roomPrice } = roomResult[0];

    // 🔸 Check if the room is already booked for the requested dates
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

    // 🔸 Calculate total price (days * room price)
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const stayDuration = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)); // Convert ms to days
    const totalPrice = stayDuration * roomPrice;

    // 🔸 Insert Booking Record
    await connection.execute(
      `INSERT INTO bookings (user_id, room_id, check_in, check_out, status, payment_method, total_price) 
       VALUES (?, ?, ?, ?, 'confirmed', ?, ?)`,

      [userId, roomId, checkIn, checkOut, paymentMethod, totalPrice]
    );

    await connection.commit();

    res.json({ success: true, message: "Booking successful!", totalPrice });
  } catch (err) {
    await connection.rollback();
    console.error("Booking error:", err);
    res.status(500).json({ success: false, message: "Booking failed!" });
  } finally {
    connection.release();
  }
});

// Start server on port 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});