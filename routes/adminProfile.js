const express = require("express");
const Admin = require("../models/Admin");
const protect = require("../middleware/adminAuth");
const router = express.Router();

// GET profile
router.get("/", protect, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin).select("-password");
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found" });
    res.json({ success: true, admin });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT update profile
router.put("/", protect, async (req, res) => {
  try {
    const {
      name, email, phone, specialty, description,
      fee, experience, famousFor, availability
    } = req.body;

    const admin = await Admin.findById(req.admin);
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found" });

    if (email && email !== admin.email) {
      const existingAdmin = await Admin.findOne({ email });
      if (existingAdmin) return res.status(400).json({ success: false, message: "Email already in use" });
      admin.email = email;
    }

    admin.name = name || admin.name;
    admin.phone = phone || admin.phone;
    admin.specialty = specialty || admin.specialty;
    admin.description = description || admin.description;
    admin.fee = fee || admin.fee;
    admin.experience = experience || admin.experience;
    admin.famousFor = famousFor || admin.famousFor;

    admin.availability = {
      workingDays: availability?.workingDays || admin.availability.workingDays,
      workingHours: availability?.workingHours || admin.availability.workingHours,
      breakTime: availability?.breakTime || admin.availability.breakTime,
    };

    await admin.save();
    const updatedAdmin = await Admin.findById(req.admin).select("-password");
    res.json({ success: true, admin: updatedAdmin, message: "Profile updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
