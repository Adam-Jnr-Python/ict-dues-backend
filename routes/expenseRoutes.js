const express = require("express");
const router = express.Router();
const Expense = require("../models/Expense");
const Student = require("../models/Students");
const Ledger = require("../models/Ledger");
const auth = require("../middleware/auth");
const XLSX = require("xlsx");

//  HELPER: Recalculate Ledger
async function recalculateLedger(department) {
  const incomeAgg = await Student.aggregate([
    { $match: { department } },
    { $unwind: "$payments" },
    { $group: { _id: null, total: { $sum: "$payments.amount" } } },
  ]);
  const totalIncome = incomeAgg.length ? incomeAgg[0].total : 0;

  const expenseAgg = await Expense.aggregate([
    { $match: { department } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const totalExpenses = expenseAgg.length ? expenseAgg[0].total : 0;

  const balance = totalIncome - totalExpenses;

  await Ledger.findOneAndUpdate(
    { department },
    {
      department,
      totalIncome,
      totalExpenses,
      balance,
      lastUpdated: new Date(),
    },
    { upsert: true, new: true },
  );
  return { totalIncome, totalExpenses, balance };
}

//  EXPENSE CRUD
// Create expense
router.post("/expenses", auth, async (req, res) => {
  try {
    const { category, description, amount, date, paymentMethod, notes } =
      req.body;
    if (!category || !description || !amount) {
      return res
        .status(400)
        .json({ message: "Category, description, and amount are required" });
    }

    const expense = new Expense({
      category,
      description,
      amount,
      date: date || Date.now(),
      paymentMethod,
      notes,
      department: req.admin.department,
      createdBy: req.admin.id,
    });
    await expense.save();
    await recalculateLedger(req.admin.department);
    res.status(201).json({ message: "Expense added", data: expense });
  } catch (error) {
    console.error("Add expense error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get all expenses (with filters)
router.get("/expenses", auth, async (req, res) => {
  try {
    const { category, startDate, endDate } = req.query;
    let filter = { department: req.admin.department };
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    const expenses = await Expense.find(filter).sort({ date: -1 });
    res.json({ count: expenses.length, data: expenses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//  GET SINGLE EXPENSE
router.get("/expenses/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findOne({
      _id: id,
      department: req.admin.department,
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json(expense);
  } catch (error) {
    console.error("Get expense error:", error);
    res.status(500).json({ error: error.message });
  }
});

//  UPDATE EXPENSE
router.put("/expenses/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { category, description, amount, date, paymentMethod, notes } =
      req.body;

    if (!category || !description || !amount) {
      return res.status(400).json({
        message: "Category, description, and amount are required",
      });
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: id, department: req.admin.department },
      {
        category,
        description,
        amount: Number(amount),
        date: date || Date.now(),
        paymentMethod: paymentMethod || "Cash",
        notes: notes || "",
      },
      { new: true, runValidators: true },
    );

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    await recalculateLedger(req.admin.department);
    res.json({ message: "Expense updated successfully", data: expense });
  } catch (error) {
    console.error("Update expense error:", error);
    res.status(500).json({ error: error.message });
  }
});

//  DELETE EXPENSE
router.delete("/expenses/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findOneAndDelete({
      _id: id,
      department: req.admin.department,
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    await recalculateLedger(req.admin.department);
    res.json({ message: "Expense deleted successfully", data: expense });
  } catch (error) {
    console.error("Delete expense error:", error);
    res.status(500).json({ error: error.message });
  }
});

//  LEDGER SUMMARY (always recalculates)

router.get("/ledger", auth, async (req, res) => {
  try {
    const department = req.admin.department;
    const fresh = await recalculateLedger(department);
    res.json({
      department,
      totalIncome: fresh.totalIncome,
      totalExpenses: fresh.totalExpenses,
      balance: fresh.balance,
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error("Ledger error:", error);
    res.status(500).json({ error: error.message });
  }
});

//  EXCEL EXPORT
// Export expenses to Excel
router.get("/export/expenses", auth, async (req, res) => {
  try {
    const expenses = await Expense.find({
      department: req.admin.department,
    }).sort({ date: -1 });
    const data = expenses.map((e) => ({
      "Receipt #": e.receiptNumber,
      Category: e.category,
      Description: e.description,
      "Amount (GH¢)": e.amount,
      Date: e.date.toISOString().split("T")[0],
      "Payment Method": e.paymentMethod,
      Notes: e.notes || "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=expenses.xlsx");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(buf);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Export students payment records to Excel
router.get("/export/students", auth, async (req, res) => {
  try {
    const students = await Student.find({ department: req.admin.department });
    const data = students.map((s) => {
      const paid = s.payments.reduce((sum, p) => sum + p.amount, 0);
      return {
        "Student Name": s.studentName,
        "Student ID": s.studentId,
        Department: s.department,
        Course: s.course,
        Level: s.level,
        "Total Dues (GH¢)": s.totalDues,
        "Amount Paid (GH¢)": paid,
        "Balance (GH¢)": s.totalDues - paid,
        "Payment Count": s.payments.length,
        "Last Payment Date":
          s.payments.length > 0
            ? new Date(s.payments[s.payments.length - 1].date)
                .toISOString()
                .split("T")[0]
            : "",
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=students_payments.xlsx",
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(buf);
  } catch (error) {
    console.error("Export students error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.recalculateLedger = recalculateLedger;
