const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true, minlength: 6 },
  department: { type: String, required: true, trim: true, uppercase: true },
  logo: { type: String, default: "" }, // NEW
  role: { type: String, enum: ["admin", "superadmin"], default: "admin" },
  createdAt: { type: Date, default: Date.now },
});

// Hash password before saving - WITHOUT using next as parameter
adminSchema.pre("save", async function () {
  // Only hash the password if it has been modified
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// Compare password method
adminSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

module.exports = mongoose.model("Admin", adminSchema);
