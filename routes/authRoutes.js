const express = require("express");
const bcrypt = require("bcryptjs");
const app = express.Router();
const pool = require("../db/pool");

/* ======================
   AUTHENTICATION MODULE
   (User login/registration)
======================= */
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

// Login Route with bcrypt
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) {
      return res.json({ success: false, message: "User not found" });
    }
    const user = rows[0];
    let passwordMatch = false;

    // Check if stored password is hashed (starts with $2)
    if (user.password_hash.startsWith('$2')) {
      passwordMatch = await bcrypt.compare(password, user.password_hash);
    } else {
      // fallback: compare raw strings (NOT secure — for legacy only)
      passwordMatch = password === user.password_hash;
    }

    if (!passwordMatch) {
      return res.json({ success: false, message: "Invalid password" });
    }
    const token = { id: user.id,name: user.name, email: user.email, role: user.role };
    redirectPath = "" ;

    if (user.role === "admin") {
      redirectPath = "/admin-dashboard.html";
    }
    else if (user.role === "staff") {
      redirectPath = "/staff-dashboard.html";
    }
    else{
      redirectPath = "/index.html";
    }
    res.json({ success: true, redirectTo: redirectPath, user: token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
module.exports = app;