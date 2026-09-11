const mongoose = require("mongoose");
const expenseSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Bank Transfer", "Mobile Money", "Other"],
      default: "Cash",
    },
    receiptNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  },
);

// Auto-generate receipt number before saving
expenseSchema.pre("save", async function (next) {
  if (!this.receiptNumber) {
    const count = await mongoose.model("Expense").countDocuments();
    this.receiptNumber = `EXP-${String(count + 1).padStart(4, "0")}`;
  }

  next();
});

module.exports = mongoose.model("Expense", expenseSchema);
