require("dotenv").config(); // Load environment variables
const express = require("express");
const cors = require("cors");
const morgan = require("morgan"); // HTTP request logger
const helmet = require("helmet"); // Security headers
const rateLimit = require("express-rate-limit"); // Limit requests
const connectDB = require("./config/db");

// ------------------------
// ROUTES
// ------------------------
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profile");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const adminProfileRoutes = require("./routes/adminProfile");
const adminPublicRoutes = require("./routes/adminPublic");
const appointmentRoutes = require("./routes/appointmentRoutes");
const chatRoutes = require("./routes/chatRoutes"); // OpenAI Bot
const adminChatRoutes = require("./routes/adminChat");


const app = express();
const PORT = process.env.PORT || 5000;

// ------------------------
// SECURITY & RATE LIMIT
// ------------------------
app.use(helmet());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ------------------------
// MIDDLEWARE
// ------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// ------------------------
// DEFAULT ROUTE
// ------------------------
app.get("/", (req, res) => {
  res.send("API is running... 🚀");
});

// ------------------------
// API ROUTES
// ------------------------
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/admin", adminAuthRoutes);
app.use("/api/admin/profile", adminProfileRoutes);
app.use("/api/admin/public", adminPublicRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin/chat", adminChatRoutes);
// ------------------------
// 404 HANDLER
// ------------------------
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ------------------------
// GLOBAL ERROR HANDLER
// ------------------------
app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// ------------------------
// START SERVER AFTER DB CONNECTION
// ------------------------
const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to connect to DB", err);
    process.exit(1);
  }
};

startServer();
