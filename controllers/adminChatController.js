const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");

// In-memory session store (replace with Redis/DB in production)
const sessions = {};

// Session timeout in milliseconds (e.g., 10 minutes)
const SESSION_TIMEOUT = 10 * 60 * 1000;

// Start or get session
const startSession = (adminId) => {
  if (!sessions[adminId]) {
    sessions[adminId] = { step: "start", data: {}, timestamp: Date.now() };
  } else {
    // Reset session if timed out
    if (Date.now() - sessions[adminId].timestamp > SESSION_TIMEOUT) {
      sessions[adminId] = { step: "start", data: {}, timestamp: Date.now() };
    }
  }
  return sessions[adminId];
};

// Reset session
const resetSession = (adminId) => {
  if (sessions[adminId]) delete sessions[adminId];
};

// Validate date in YYYY-MM-DD format
const isValidDate = (dateStr) => /^\d{4}-\d{2}-\d{2}$/.test(dateStr);

// Validate time in HH:MM 24-hour format
const isValidTime = (timeStr) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr);

const adminChat = async (req, res) => {
  try {
    const { adminId, message } = req.body;
    if (!adminId || !message)
      return res.status(400).json({ reply: "adminId and message are required" });

    const session = startSession(adminId);
    session.timestamp = Date.now(); // update timestamp
    const msg = message.trim();

    // ---------- STEP 0: Identify intent ----------
    if (session.step === "start") {
      if (/reschedule/i.test(msg)) {
        session.step = "collectReschedule";
        return res.json({ reply: "📝 Please provide the Appointment ID to reschedule." });
      } else if (/cancel/i.test(msg)) {
        session.step = "collectCancel";
        return res.json({ reply: "🛑 Please provide the Appointment ID to cancel." });
      } else {
        return res.json({
          reply:
            "Hello! I can help you cancel or reschedule appointments. Please type 'reschedule' or 'cancel'.",
        });
      }
    }

    // ---------- RESCHEDULE FLOW ----------
    if (session.step === "collectReschedule") {
      const appointment = await Appointment.findOne({ appointmentId: msg });
      if (!appointment) return res.json({ reply: `❌ Appointment not found: ${msg}` });

      session.data.appointment = appointment;
      session.step = "rescheduleDate";
      return res.json({ reply: "📅 Please provide the new date (YYYY-MM-DD) for your appointment." });
    }

    if (session.step === "rescheduleDate") {
      if (!isValidDate(msg)) return res.json({ reply: "❌ Invalid date format. Use YYYY-MM-DD." });

      session.data.newDate = msg;
      session.step = "rescheduleTime";
      return res.json({ reply: "⏰ Please provide the new time (HH:MM, 24-hour format)." });
    }

    if (session.step === "rescheduleTime") {
      if (!isValidTime(msg)) return res.json({ reply: "❌ Invalid time format. Use HH:MM 24-hour format." });

      const appointment = session.data.appointment;
      const startTime = new Date(`${session.data.newDate}T${msg}:00`);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 min slot

      // Check overlapping appointments
      const overlapping = await Appointment.findOne({
        admin: appointment.admin,
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
        status: "Upcoming",
        appointmentId: { $ne: appointment.appointmentId },
      });

      if (overlapping) return res.json({ reply: "❌ Time slot already booked. Choose another time." });

      appointment.startTime = startTime;
      appointment.endTime = endTime;
      appointment.status = "Rescheduled";
      await appointment.save();

      resetSession(adminId);
      return res.json({ reply: `✅ Appointment rescheduled successfully. Appointment ID: ${appointment.appointmentId}` });
    }

    // ---------- CANCEL FLOW ----------
    if (session.step === "collectCancel") {
      const appointment = await Appointment.findOne({ appointmentId: msg });
      if (!appointment) return res.json({ reply: `❌ Appointment not found: ${msg}` });

      if (appointment.status === "Cancelled") {
        resetSession(adminId);
        return res.json({ reply: `⚠️ Appointment ${msg} is already cancelled.` });
      }

      session.data.appointment = appointment;
      session.step = "collectCancelReason";
      return res.json({ reply: "✏️ Please provide a reason for cancellation." });
    }

    if (session.step === "collectCancelReason") {
      const appointment = session.data.appointment;
      const reason = msg;
      appointment.status = "Cancelled";
      appointment.cancellationReason = reason; // Make sure your Appointment schema has this field
      await appointment.save();

      resetSession(adminId);
      return res.json({
        reply: `✅ Appointment cancelled successfully. Appointment ID: ${appointment.appointmentId}\nReason: ${reason}`
      });
    }

    // ---------- Fallback ----------
    return res.json({ reply: "❌ Sorry, I didn't understand that. Type 'reschedule' or 'cancel'." });
    
  } catch (err) {
    console.error("Admin Chat Error:", err);
    return res.status(500).json({ reply: `Server error: ${err.message}` });
  }
};

module.exports = { adminChat };
