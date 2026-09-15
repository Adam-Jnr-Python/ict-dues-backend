const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  studentName: {
    type: String,
    required: true,
  },
  studentId: {
    type: String,
    required: true,
    unique: true,
  },
  department: {
    type: String,
    required: true,
    default: "MaISA",
  },
  course: {
    type: String,
    required: true,
  },
  level: {
    type: String,
    required: true,
  },
  payments: [
    {
      amount: {
        type: Number,
        required: true,
      },
      date: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  totalDues: {
    type: Number,
    default: 500,
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
});

module.exports = mongoose.model("Student", studentSchema);
