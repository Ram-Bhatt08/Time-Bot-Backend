// Helper to format bot messages
const formatBotMessage = (text) => {
  return {
    sender: "bot",
    text,
    timestamp: new Date(),
  };
};

// Helper to validate email
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Helper to validate phone number
const isValidPhone = (phone) => /^[0-9]{10}$/.test(phone);

module.exports = {
  formatBotMessage,
  isValidEmail,
  isValidPhone,
};
