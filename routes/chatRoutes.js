const express = require("express");
const router = express.Router();
const { chat } = require("../controllers/chatController");

// Single unified endpoint
router.post("/", chat);

module.exports = router;
