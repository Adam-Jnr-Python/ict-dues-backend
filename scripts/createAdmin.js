const mongoose = require("mongoose");
const Admin = require("../models/Admin");
require("dotenv").config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const existingAdmin = await Admin.findOne({ email: "admin@maisa.com" });
    if (existingAdmin) {
      console.log("✅ Admin already exists!");
      console.log("Email: admin@maisa.com");
      console.log("Password: admin123");
      console.log(`Department: ${existingAdmin.department}`);
      process.exit(0);
    }

    const admin = new Admin({
      name: "Super Admin",
      email: "admin@maisa.com",
      password: "admin123",
      department: "MAISA", // NEW
      role: "superadmin",
    });

    await admin.save();
    console.log("✅ Admin created successfully!");
    console.log("📧 Email: admin@maisa.com");
    console.log("🔑 Password: admin123");
    console.log("🏛️  Department: MAISA");

    process.exit(0);
  } catch (error) {
    console.error("Error creating admin:", error);
    process.exit(1);
  }
};

createAdmin();
