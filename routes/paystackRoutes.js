const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");
const Student = require("../models/Students");
const Dues = require("../models/Dues");
const Ledger = require("../models/Ledger");

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC = process.env.PAYSTACK_PUBLIC_KEY;

// ============ INITIALIZE PAYMENT ============
router.post("/initialize", async (req, res) => {
  try {
    const { studentId, email, amount } = req.body;

    if (!studentId || !email || !amount) {
      return res
        .status(400)
        .json({ message: "Student ID, email, and amount are required" });
    }

    // Check if student exists
    const student = await Student.findOne({
      studentId,
      department: metadata.department,
    });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check if amount matches dues
    const dues = await Dues.findOne({
      department: student.department,
      level: student.level,
    });
    if (!dues) {
      return res
        .status(404)
        .json({ message: "Dues not set for this department" });
    }

    // Calculate remaining balance
    const paid = student.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = student.totalDues - paid;

    if (amount > balance) {
      return res.status(400).json({
        message: `Amount exceeds balance. Your balance is ₦${balance}`,
      });
    }

    // Initialize payment with Paystack
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: amount * 100, // Paystack expects amount in kobo
        callback_url: `${process.env.PAYSTACK_CALLBACK_URL}?studentId=${studentId}`,
        metadata: {
          studentId,
          department: student.department,
          level: student.level,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
      },
    );

    // Store transaction reference in student record (temporary)
    const reference = response.data.data.reference;
    student._tempPayment = {
      reference,
      amount,
      status: "pending",
    };
    await student.save();

    res.json({
      message: "Payment initialized",
      authorization_url: response.data.data.authorization_url,
      reference,
    });
  } catch (error) {
    console.error(
      "Paystack initialization error:",
      error.response?.data || error.message,
    );
    res.status(500).json({
      message: "Failed to initialize payment",
      error: error.response?.data?.message || error.message,
    });
  }
});

// ============ VERIFY PAYMENT (Callback) ============
router.get("/verify", async (req, res) => {
  try {
    const { reference, studentId } = req.query;

    if (!reference || !studentId) {
      return res.redirect(
        "/payment-failed.html?error=Missing reference or student ID",
      );
    }

    // Verify with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      },
    );

    const data = response.data.data;

    if (data.status === "success") {
      // Find the student
      const student = await Student.findOne({ studentId });
      if (!student) {
        return res.redirect("/payment-failed.html?error=Student not found");
      }

      // Record the payment
      student.payments.push({
        amount: data.amount / 100, // Convert back from kobo
        date: new Date(),
        method: "online_paystack",
        transactionId: data.reference,
        reference: data.reference,
      });

      // Update totalDues if needed (ensure it matches department dues)
      const dues = await Dues.findOne({
        department: student.department,
        level: student.level,
      });
      if (dues) {
        student.totalDues = dues.amount;
      }

      // Remove temp payment
      student._tempPayment = undefined;
      await student.save();

      // Update ledger
      await recalculateLedger();

      // Redirect to success page
      return res.redirect(
        `/payment-success.html?reference=${reference}&studentId=${studentId}`,
      );
    } else {
      return res.redirect(
        `/payment-failed.html?error=Payment verification failed`,
      );
    }
  } catch (error) {
    console.error("Paystack verification error:", error);
    return res.redirect(`/payment-failed.html?error=Verification error`);
  }
});

// ============ WEBHOOK (For real-time updates) ============
router.post("/webhook", async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers["x-paystack-signature"];
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== signature) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const data = event.data;
      const reference = data.reference;
      const amount = data.amount / 100;
      const metadata = data.metadata;

      // Find student by metadata
      const student = await Student.findOne({ studentId: metadata.studentId });
      if (student) {
        // Check if payment already recorded
        const existing = student.payments.find(
          (p) => p.reference === reference,
        );
        if (!existing) {
          student.payments.push({
            amount,
            date: new Date(),
            method: "online_paystack",
            transactionId: reference,
            reference,
          });

          const dues = await Dues.findOne({
            department: student.department,
            level: student.level,
          });
          if (dues) student.totalDues = dues.amount;

          student._tempPayment = undefined;
          await student.save();
          await recalculateLedger();
        }
      }
    }

    res.status(200).json({ message: "Webhook received" });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ GET PAYMENT STATUS ============
router.get("/status/:reference", async (req, res) => {
  try {
    const { reference } = req.params;
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      },
    );

    res.json({
      status: response.data.data.status,
      amount: response.data.data.amount / 100,
      reference: response.data.data.reference,
    });
  } catch (error) {
    console.error("Status check error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ HELPER: Recalculate Ledger ============
async function recalculateLedger() {
  const incomeAgg = await Student.aggregate([
    { $unwind: "$payments" },
    { $group: { _id: null, total: { $sum: "$payments.amount" } } },
  ]);
  const totalIncome = incomeAgg.length ? incomeAgg[0].total : 0;

  const Expense = require("../models/Expense");
  const expenseAgg = await Expense.aggregate([
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const totalExpenses = expenseAgg.length ? expenseAgg[0].total : 0;

  const balance = totalIncome - totalExpenses;

  await Ledger.findOneAndUpdate(
    {},
    { totalIncome, totalExpenses, balance, lastUpdated: new Date() },
    { upsert: true, new: true },
  );
  return { totalIncome, totalExpenses, balance };
}

module.exports = router;
