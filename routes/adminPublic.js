const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');

// GET all admins (public info)
router.get('/all', async (req, res) => {
  try {
    const admins = await Admin.find({}, '-password -__v'); // make sure adminId is included
    res.json({ admins }); 
  } catch (err) {
    console.error('Error fetching admins:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
