const express = require("express");
const mysql = require("mysql");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
  host: "localhost",
  user: "dani",
  password: "dani",
  database: "hotel_db",
});

db.connect((err) => {
  if (err) throw err;
  console.log("MySQL Connected...");
});

// Serve static files (CSS, JS, Images, HTML)
app.use(express.static(path.join(__dirname, "pages")));

// Serve the home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "index.html"));
});
app.get("/pages/login.html", (req, res) => {
    console.log(req.url);
    res.sendFile(path.join(__dirname, "pages", "login.html"));
  });
  
// Login Route
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const query = "SELECT * FROM users WHERE username = ?";
  db.query(query, [username], async (err, results) => {
    if (err) return res.json({ success: false, message: "Database error" });

    if (results.length === 0) {
      return res.json({ success: false, message: "User not found" });
    }

    const user = results[0];

    // Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Invalid password" });
    }

    // Redirect Based on Role
    if (user.role === "admin") {
      res.json({ success: true, redirectTo: "/admin-dashboard.html" });
    } else {
      res.json({ success: true, redirectTo: "/user-dashboard.html" });
    }
  });
});

// Start Server
app.listen(5000, () => {
  console.log("Server running on port 5000");
});
