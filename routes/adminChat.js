const express = require("express");
const router = express.Router();
const { adminChat } = require("../controllers/adminChatController");

// Chat interaction
router.post("/", adminChat);

module.exports = router;
