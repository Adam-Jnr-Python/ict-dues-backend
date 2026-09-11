const express = require("express");
const router = express.Router();
const Student = require("../models/Students");
const Dues = require("../models/Dues");
const auth = require("../middleware/auth");

// SET DUES
router.post("/set-dues", auth, async (req, res) => {
  try {
    const { department, level, amount } = req.body;

    const adminId = req.admin.id;

    if (!department || !level || !amount) {
      return res.status(400).json({
        message: "Department, level, and amount are required",
      });
    }

    const dues = await Dues.findOneAndUpdate(
      { department: req.admin.department, level },
      { department: req.admin.department, level, amount },
      { returnDocument: "after", upsert: true },
    );

    res.json({ message: "Dues set successfully.", data: dues });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET ALL DUES
router.get("/all-dues", auth, async (req, res) => {
  try {
    const adminId = req.admin.id;
    const allDues = await Dues.find({ department: req.admin.department }).sort({
      level: 1,
    });
    res.json({ count: allDues.length, data: allDues });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE DUES
router.put("/dues/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const adminId = req.admin.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }

    const updatedDues = await Dues.findByIdAndUpdate(
      { _id: id, adminId },
      { amount },
      { new: true, runValidators: true },
    );

    if (!updatedDues) {
      return res.status(404).json({ message: "Dues record not found" });
    }

    res.json({ message: "Dues updated successfully", data: updatedDues });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE DUES
router.delete("/dues/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;

    const deletedDues = await Dues.findByIdAndDelete({ _id: id, adminId });

    if (!deletedDues) {
      return res.status(404).json({ message: "Dues record not found" });
    }

    res.json({ message: "Dues deleted successfully", data: deletedDues });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// RECORD PAYMENT
router.post("/pay", auth, async (req, res) => {
  try {
    const { studentName, studentId, department, course, level, amount } =
      req.body;

    const adminId = req.admin.id;

    if (!studentName || !studentId || !department || !level || !amount) {
      return res.status(400).json({
        message:
          "All fields are required: studentName, studentId, department, level, amount",
      });
    }

    let existingStudent = await Student.findOne({ studentId, adminId });

    if (!existingStudent) {
      const recordedDues = await Dues.findOne({ department, level, adminId });

      if (!recordedDues) {
        return res.status(404).json({
          message:
            "Dues not set for this department and level. Please set dues first.",
        });
      }

      const newStudent = new Student({
        studentName,
        studentId,
        department: req.admin.department,
        course: course || "ICT",
        level,
        payments: [{ amount }],
        totalDues: recordedDues.amount,
        adminId,
      });

      await newStudent.save();
      res.status(201).json({
        message: "Payment recorded successfully",
        data: newStudent,
      });
    } else {
      existingStudent.payments.push({ amount });

      if (studentName) existingStudent.studentName = studentName;
      if (department) existingStudent.department = department;
      if (course) existingStudent.course = course;
      if (level) existingStudent.level = level;

      await existingStudent.save();
      res.status(200).json({
        message: "Payment updated successfully",
        data: existingStudent,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: "Error saving payment",
      error: error.message,
    });
  }
});

// GET ALL STUDENTS
router.get("/paid-students", auth, async (req, res) => {
  try {
    const { search } = req.query;
    const department = req.admin.department; // From JWT

    let filter = { department }; // Only this admin's department

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [
        { studentName: searchRegex },
        { studentId: searchRegex },
        { course: searchRegex },
      ];
    }

    const paidStudents = await Student.find(filter);
    const paidStudentsData = paidStudents.map((student) => {
      const totalDuesPaid = student.payments.reduce(
        (sum, p) => sum + p.amount,
        0,
      );
      return {
        _id: student._id,
        studentName: student.studentName,
        studentId: student.studentId,
        department: student.department,
        course: student.course,
        level: student.level,
        totalDues: student.totalDues,
        amountPaid: totalDuesPaid,
        balance: student.totalDues - totalDuesPaid,
        paymentCount: student.payments.length,
        payments: student.payments.map((p, index) => ({
          index,
          amount: p.amount,
          date: p.date,
        })),
      };
    });

    res
      .status(200)
      .json({ count: paidStudentsData.length, data: paidStudentsData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ PUBLIC STUDENT LOOKUP (no auth) ============
router.get("/public/student/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const trimmedId = studentId.trim();

    // Case-insensitive exact match
    const student = await Student.findOne({
      studentId: { $regex: `^${trimmedId}$`, $options: "i" },
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = student.totalDues - totalPaid;

    res.json({
      studentName: student.studentName,
      studentId: student.studentId,
      department: student.department,
      level: student.level,
      totalDues: student.totalDues,
      amountPaid: totalPaid,
      balance,
    });
  } catch (error) {
    console.error("Public student lookup error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET SINGLE STUDENT
router.get("/student/:studentId", auth, async (req, res) => {
  try {
    const { studentId } = req.params;

    const adminId = req.admin.id;

    const student = await Student.findOne({
      studentId,
      department: req.admin.department,
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      _id: student._id,
      studentName: student.studentName,
      studentId: student.studentId,
      department: student.department,
      course: student.course,
      level: student.level,
      totalDues: student.totalDues,
      amountPaid: totalPaid,
      balance: student.totalDues - totalPaid,
      paymentCount: student.payments.length,
      payments: student.payments.map((p, index) => ({
        index,
        amount: p.amount,
        date: p.date,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DASHBOARD STATS
router.get("/stats", auth, async (req, res) => {
  try {
    const adminId = req.admin.id;

    const allStudents = await Student.find({
      department: req.admin.department,
    });

    let totalStudents = allStudents.length;
    let totalCollected = 0;
    let fullyPaid = 0;

    allStudents.forEach((student) => {
      const paid = student.payments.reduce((sum, p) => sum + p.amount, 0);
      totalCollected += paid;
      if (paid >= student.totalDues) fullyPaid++;
    });

    res.json({
      totalStudents,
      totalPaid: fullyPaid,
      totalMoney: totalCollected,
      owing: totalStudents - fullyPaid,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE STUDENT
router.delete("/student/:studentId", auth, async (req, res) => {
  try {
    const { studentId } = req.params;

    const adminId = req.admin.id;

    const student = await Student.findOneAndDelete({
      studentId,
      department: req.admin.department,
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({
      message: "Student deleted successfully",
      data: student,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE PAYMENT
router.put("/payment/:studentId/:paymentIndex", auth, async (req, res) => {
  try {
    const { studentId, paymentIndex } = req.params;
    const { amount, date } = req.body;
    const adminId = req.admin.id;

    const student = await Student.findOne({
      studentId,
      department: req.admin.department,
    });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (!student.payments[paymentIndex]) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (amount) student.payments[paymentIndex].amount = amount;
    if (date) student.payments[paymentIndex].date = new Date(date);

    await student.save();

    const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      message: "Payment updated successfully",
      data: {
        studentId: student.studentId,
        department: student.department,
        level: student.level,
        totalDues: student.totalDues,
        amountPaid: totalPaid,
        balance: student.totalDues - totalPaid,
        payments: student.payments.map((p, index) => ({
          index,
          amount: p.amount,
          date: p.date,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE PAYMENT
router.delete("/payment/:studentId/:paymentIndex", auth, async (req, res) => {
  try {
    const { studentId, paymentIndex } = req.params;
    const adminId = req.admin.id;

    const student = await Student.findOne({
      studentId,
      department: req.admin.department,
    });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (!student.payments[paymentIndex]) {
      return res.status(404).json({ message: "Payment not found" });
    }

    student.payments.splice(paymentIndex, 1);
    await student.save();

    const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      message: "Payment deleted successfully",
      data: {
        studentId: student.studentId,
        department: student.department,
        level: student.level,
        totalDues: student.totalDues,
        amountPaid: totalPaid,
        balance: student.totalDues - totalPaid,
        payments: student.payments.map((p, index) => ({
          index,
          amount: p.amount,
          date: p.date,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
