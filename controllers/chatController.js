const mongoose = require("mongoose");
const Appointment = require("../models/appointment");
const Admin = require("../models/admin");
const User = require("../models/user");

// In-memory session store (replace with Redis/DB in production)
const sessions = {};

// Start or get session
const startSession = (clientId) => {
  if (!sessions[clientId]) sessions[clientId] = { step: "start", data: {} };
  return sessions[clientId];
};

// Reset session
const resetSession = (clientId) => {
  if (sessions[clientId]) delete sessions[clientId];
};

const chat = async (req, res) => {
  try {
    const { clientId, message } = req.body;
    if (!clientId || !message)
      return res.status(400).json({ error: "clientId and message are required" });

    const session = startSession(clientId);
    const msg = message.trim();

    // ---------- STEP 0: Auto-fill user ----------
    if (!session.data.user) {
      const user = await User.findOne({ clientId });
      if (!user) return res.json({ reply: "User not found." });
      session.data.user = user;
    }

    // ---------- STEP 1: Identify intent ----------
    if (session.step === "start") {
      if (/book/i.test(msg)) {
        session.step = "collectAdmin";
        return res.json({
          reply: "Great! Let's book an appointment. Please provide the admin ID of the person you want to book with.",
        });
      } else if (/reschedule/i.test(msg)) {
        session.step = "collectReschedule";
        return res.json({ reply: "Sure! Please provide your appointment ID to reschedule." });
      } else if (/cancel/i.test(msg)) {
        session.step = "collectCancel";
        return res.json({ reply: "Okay! Please provide your appointment ID to cancel." });
      } else if (/vip/i.test(msg)) {
        session.step = "collectVIP";
        return res.json({ reply: "Sure! Please provide the admin ID to check VIP availability." });
      } else {
        return res.json({
          reply:
            "Hello! I can help you book, reschedule, cancel appointments, and check VIP availability. What would you like to do?",
        });
      }
    }

    // ---------- STEP 2: Collect Admin ----------
    if (session.step === "collectAdmin") {
      const admin = await Admin.findOne({ adminId: msg });
      if (!admin) return res.json({ reply: "Invalid admin ID. Please provide a valid admin ID." });
      session.data.admin = admin;
      session.step = "collectDate";
      return res.json({ reply: "Got it. Now please provide the date for the appointment (YYYY-MM-DD)." });
    }

    // ---------- STEP 3: Collect Date ----------
    if (session.step === "collectDate") {
      const [year, month, day] = msg.split("-").map(Number);
      if (!year || !month || !day) return res.json({ reply: "Invalid date format. Please provide in YYYY-MM-DD format." });
      session.data.date = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
      session.step = "collectTime";
      return res.json({ reply: "Thanks. Please provide the time for the appointment (HH:MM, 24-hour format)." });
    }

    // ---------- STEP 4: Collect Time ----------
    if (session.step === "collectTime") {
      if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(msg)) return res.json({ reply: "Invalid time format. Please provide in HH:MM, 24-hour format." });
      session.data.time = msg;
      session.step = "collectPurpose";
      return res.json({ reply: "Almost done! Please provide the purpose of the appointment." });
    }

    // ---------- STEP 5: Collect Purpose and Book ----------
    if (session.step === "collectPurpose") {
      session.data.purpose = msg;
      const { user, admin } = session.data;

      const startTime = new Date(`${session.data.date}T${session.data.time}:00`);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 min slot

      // Check for existing appointment
      const existing = await Appointment.findOne({
        admin: admin._id,
        startTime,
        status: "Upcoming",
      });
      if (existing) return res.json({ reply: "This time slot is already booked. Please choose another." });

      // Let Mongoose pre-save hook generate sequential appointmentId
      const appointment = new Appointment({
        user: user._id,
        admin: admin._id,
        startTime,
        endTime,
        purpose: session.data.purpose,
        status: "Upcoming",
      });

      await appointment.save(); // sequential ID is generated here
      resetSession(clientId);

      return res.json({
        reply: `✅ Appointment booked successfully with ${admin.name} on ${session.data.date} at ${session.data.time}. Appointment ID: ${appointment.appointmentId}`,
      });
    }

    // ---------- Reschedule ----------
    if (session.step === "collectReschedule") {
      const appointment = await Appointment.findOne({ appointmentId: msg });
      if (!appointment) return res.json({ reply: "Appointment not found." });
      session.data.appointment = appointment;
      session.step = "rescheduleDate";
      return res.json({ reply: "Please provide the new date (YYYY-MM-DD) for your appointment." });
    }

    if (session.step === "rescheduleDate") {
      const [year, month, day] = msg.split("-").map(Number);
      if (!year || !month || !day) return res.json({ reply: "Invalid date format." });
      session.data.date = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
      session.step = "rescheduleTime";
      return res.json({ reply: "Please provide the new time (HH:MM, 24-hour format) for your appointment." });
    }

    if (session.step === "rescheduleTime") {
      if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(msg)) return res.json({ reply: "Invalid time format." });

      const startTime = new Date(`${session.data.date}T${msg}:00`);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      const appointment = session.data.appointment;

      // Check overlapping appointments
      const overlapping = await Appointment.findOne({
        admin: appointment.admin,
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
        status: "Upcoming",
        appointmentId: { $ne: appointment.appointmentId },
      });
      if (overlapping) return res.json({ reply: "Time slot already booked. Choose another time." });

      appointment.startTime = startTime;
      appointment.endTime = endTime;
      appointment.status = "Rescheduled";
      await appointment.save();
      resetSession(clientId);

      return res.json({ reply: `✅ Appointment rescheduled successfully. Appointment ID: ${appointment.appointmentId}` });
    }

    // ---------- Cancel ----------
    if (session.step === "collectCancel") {
      const appointment = await Appointment.findOne({ appointmentId: msg });
      if (!appointment) return res.json({ reply: "Appointment not found." });
      appointment.status = "Cancelled";
      await appointment.save();
      resetSession(clientId);
      return res.json({ reply: `✅ Appointment cancelled successfully. Appointment ID: ${appointment.appointmentId}` });
    }

    // ---------- VIP Availability ----------
    if (session.step === "collectVIP") {
      const admin = await Admin.findOne({ adminId: msg });
      if (!admin) return res.json({ reply: "Admin not found." });

      const upcomingAppointments = await Appointment.find({ admin: admin._id, status: "Upcoming" }).sort("startTime");

      let reply = `VIP ${admin.name} has upcoming appointments:\n`;
      if (!upcomingAppointments.length) reply += "No appointments booked yet. Fully available!";
      else
        upcomingAppointments.forEach(
          (a) =>
            (reply += `• ${a.startTime.toLocaleDateString()} ${a.startTime.toLocaleTimeString()} - ${a.endTime.toLocaleTimeString()}\n`)
        );

      resetSession(clientId);
      return res.json({ reply });
    }

    return res.json({ reply: "Sorry, I didn't understand that. Please type 'book', 'reschedule', 'cancel', or 'VIP'." });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { chat };
