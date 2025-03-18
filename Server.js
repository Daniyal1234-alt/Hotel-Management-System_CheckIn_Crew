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



// Login Route with bcrypt
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE username = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: "User not found" });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.json({ success: false, message: "Invalid password" });
    }

    const redirectPath = user.role === "admin" 
      ? "/pages/admin-dashboard.html" 
      : "/pages/user-dashboard.html";

    res.json({ success: true, redirectTo: redirectPath });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Register Route with password hashing
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.execute(
      "INSERT INTO users (username, password, role) VALUES (?, ?, 'user')",
      [email, hashedPassword]
    );

    res.json({ 
      success: true, 
      redirectTo: "/pages/user-dashboard.html" 
    });

  } catch (err) {
    console.error("Registration error:", err);
    
    const message = err.code === 'ER_DUP_ENTRY' 
      ? "Email already exists" 
      : "Registration failed";

    res.status(500).json({ success: false, message });
  }
});

// Start server on port 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});