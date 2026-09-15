const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

//  MULTER SETUP
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../public/uploads/logos");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const dept = (req.admin?.department || "dept")
      .toLowerCase()
      .replace(/\s+/g, "-");
    cb(null, `${dept}-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else
    cb(new Error("Only image files are allowed (png, jpg, jpeg, webp, svg)"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
});

//  UPLOAD LOGO
router.post("/upload-logo", auth, upload.single("logo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Delete old logo file if it exists and isn't the default
    if (admin.logo) {
      const oldPath = path.join(__dirname, "../public", admin.logo);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Save new logo path
    const logoPath = `/uploads/logos/${req.file.filename}`;
    admin.logo = logoPath;
    await admin.save();

    res.json({
      message: "Logo uploaded successfully",
      logo: logoPath,
    });
  } catch (error) {
    console.error("Upload logo error:", error);
    res.status(500).json({ message: error.message });
  }
});

//  DELETE LOGO
router.delete("/logo", auth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    if (admin.logo) {
      const oldPath = path.join(__dirname, "../public", admin.logo);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      admin.logo = "";
      await admin.save();
    }

    res.json({ message: "Logo removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//  REGISTER ADMIN
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, department } = req.body;

    if (!name || !email || !password || !department) {
      return res.status(400).json({
        message: "Please provide name, email, password, and department",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedDept = department.trim().toUpperCase();

    // Check email uniqueness
    const existingAdmin = await Admin.findOne({ email: normalizedEmail });
    if (existingAdmin) {
      return res.status(400).json({
        message: "Admin with this email already exists",
      });
    }

    // Check department uniqueness
    const existingDept = await Admin.findOne({ department: normalizedDept });
    if (existingDept) {
      return res.status(400).json({
        message: `Department "${normalizedDept}" is already registered. Please use a unique department name (e.g., add your school's abbreviation).`,
      });
    }

    // Create admin
    const admin = new Admin({
      name,
      email: normalizedEmail,
      password,
      department: normalizedDept,
    });

    await admin.save();

    // Generate token
    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        department: admin.department,
        role: admin.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(201).json({
      message: "Admin registered successfully",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        department: admin.department,
        logo: admin.logo,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Error registering admin",
      error: error.message,
    });
  }
});

// LOGIN ADMIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Please provide email and password",
      });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        department: admin.department,
        role: admin.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      message: "Login successful",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        department: admin.department,
        logo: admin.logo, // NEW
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Error logging in",
      error: error.message,
    });
  }
});

// GET CURRENT ADMIN
router.get("/me", auth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select("-password");
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    res.json(admin);
  } catch (error) {
    console.error("Error fetching admin:", error);
    res.status(500).json({
      message: "Error fetching admin data",
      error: error.message,
    });
  }
});

// LOGOUT
router.post("/logout", auth, (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// CHANGE PASSWORD
router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Please provide current and new password",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters long",
      });
    }

    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({
      message: "Error changing password",
      error: error.message,
    });
  }
});

module.exports = router;
