const express = require("express");
const path = require("path");

const router = express.Router();

// Serve static files (like CSS, JS, etc.)
router.use(express.static(path.join(__dirname, "../pages")));

// Serve the homepage
router.get("/pages", (req, res) => {
  res.sendFile(path.join(__dirname, "../index.html"));
});

// Serve known static HTML pages
const staticPages = [
  "login", "register", "search", "details", "rooms",
  "hotel-details", "user-choice", "update-booking", 
  "bookings", "history", "review"
];

staticPages.forEach(page => {
  router.get(`/pages/${page}.html`, (req, res) => {
    res.sendFile(path.join(__dirname, "../pages", `${page}.html`));
  });
});

// Serve room details dynamically
router.get("/pages/details.html", (req, res) => {
  const roomType = req.query.room;
  const validRooms = ["standard", "deluxe", "suite"];
  const page = validRooms.includes(roomType) ? `${roomType}.html` : "details.html";
  res.sendFile(path.join(__dirname, "../pages", page));
});

// 404 fallback
router.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "../pages", "404.html"));
});

module.exports = router;
