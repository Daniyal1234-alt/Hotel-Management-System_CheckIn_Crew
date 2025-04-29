const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "pages")));

// Static routes
// app.get("/pages", (req, res) => {
//   res.sendFile(path.join(__dirname, "index.html"));
// });
// ["login", "register", "search", "details"].forEach(page => {
//   app.get(`/pages/${page}.html`, (req, res) => {
//     res.sendFile(path.join(__dirname, "pages", `${page}.html`));
//   });
// });

// Import modular routes
app.use("/api", require("./routes/roomRoutes"));
app.use("/api", require("./routes/bookingRoutes"));
app.use("/api", require("./routes/userRoutes"));
app.use("/api", require("./routes/staffRoutes"));
app.use("/api", require("./routes/feedbackRoutes"));
app.use("/", require("./routes/authRoutes")); // handles /login, /register
app.use("/", require("./routes/staticRoutes")); // handles /pages etc.



module.exports = app;
