const mongoose = require("mongoose");
const ledgerSchema = new mongoose.Schema({
  department: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    unique: true,
  },
  totalIncome: {
    type: Number,
    default: 0,
  },
  totalExpenses: {
    type: Number,
    default: 0,
  },
  balance: {
    type: Number,
    default: 0,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Ledger", ledgerSchema);
