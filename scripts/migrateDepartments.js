/**
 * Migration Script: Add `department` field to all existing records
 *
 * Run this ONCE after updating your models to include the `department` field.
 *
 * Usage: npm run migrate-departments
 */

const mongoose = require("mongoose");
const readline = require("readline");
require("dotenv").config();

const Admin = require("../models/Admin");
const Student = require("../models/Students");
const Dues = require("../models/Dues");
const Expense = require("../models/Expense");
const Ledger = require("../models/Ledger");

// CONSOLE COLORS
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset}  ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  header: (msg) =>
    console.log(
      `\n${colors.bright}${colors.magenta}${msg}${colors.reset}\n${"-".repeat(50)}`,
    ),
};

// PROMPT HELPER
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );
}

// MAIN MIGRATION
async function migrate() {
  try {
    log.header("🚀 MAISA Dues - Department Migration");

    // Connect
    log.info("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    log.success("Connected to MongoDB");

    // ASK FOR DEFAULT DEPARTMENT
    console.log("");
    log.warn(
      "This script will add a 'department' field to ALL existing records.",
    );
    log.warn(
      "Records without a department will be assigned the default you provide.\n",
    );

    const defaultDept = (
      await askQuestion(
        `${colors.bright}Enter default department name (e.g. MaISA): ${colors.reset}`,
      )
    ).toUpperCase();

    if (!defaultDept) {
      log.error("Department name cannot be empty. Aborting.");
      process.exit(1);
    }

    console.log("");
    log.info(`Using "${defaultDept}" as default department.\n`);

    const confirm = await askQuestion(
      `${colors.yellow}Proceed with migration? (yes/no): ${colors.reset}`,
    );

    if (confirm.toLowerCase() !== "yes" && confirm.toLowerCase() !== "y") {
      log.warn("Migration cancelled by user.");
      process.exit(0);
    }

    console.log("");

    // MIGRATE ADMINS
    log.header("📋 Migrating Admins");
    const admins = await Admin.find({
      $or: [
        { department: { $exists: false } },
        { department: null },
        { department: "" },
      ],
    });
    if (admins.length === 0) {
      log.info("No admins need migration.");
    } else {
      let adminCount = 0;
      for (const admin of admins) {
        admin.department = defaultDept;
        await admin.save();
        adminCount++;
        log.success(`Admin "${admin.email}" → ${defaultDept}`);
      }
      log.info(`Total admins migrated: ${adminCount}`);
    }

    // MIGRATE STUDENTS
    log.header("🎓 Migrating Students");
    const students = await Student.find({
      $or: [
        { department: { $exists: false } },
        { department: null },
        { department: "" },
      ],
    });
    if (students.length === 0) {
      log.info("No students need migration.");
    } else {
      let studentCount = 0;
      for (const student of students) {
        student.department = defaultDept;
        await student.save();
        studentCount++;
      }
      log.success(
        `${studentCount} students updated with department: ${defaultDept}`,
      );
    }

    // MIGRATE DUES
    log.header("💵 Migrating Dues");
    const dues = await Dues.find({
      $or: [
        { department: { $exists: false } },
        { department: null },
        { department: "" },
      ],
    });
    if (dues.length === 0) {
      log.info("No dues need migration.");
    } else {
      let duesCount = 0;
      for (const due of dues) {
        due.department = defaultDept;
        await due.save();
        duesCount++;
      }
      log.success(
        `${duesCount} dues records updated with department: ${defaultDept}`,
      );
    }

    // MIGRATE EXPENSES
    log.header("Migrating Expenses");
    const expenses = await Expense.find({
      $or: [
        { department: { $exists: false } },
        { department: null },
        { department: "" },
      ],
    });
    if (expenses.length === 0) {
      log.info("No expenses need migration.");
    } else {
      let expCount = 0;
      for (const expense of expenses) {
        expense.department = defaultDept;
        await expense.save();
        expCount++;
      }
      log.success(
        `${expCount} expenses updated with department: ${defaultDept}`,
      );
    }

    // MIGRATE LEDGER
    log.header("📊 Migrating Ledger");
    const ledgers = await Ledger.find({
      $or: [
        { department: { $exists: false } },
        { department: null },
        { department: "" },
      ],
    });
    if (ledgers.length === 0) {
      log.info("No ledger entries need migration.");
    } else {
      let ledgerCount = 0;
      for (const ledger of ledgers) {
        ledger.department = defaultDept;
        await ledger.save();
        ledgerCount++;
      }
      log.success(
        `${ledgerCount} ledger entries updated with department: ${defaultDept}`,
      );
    }

    // RECALCULATE LEDGER
    log.header("🔄 Recalculating Ledger Balance");

    // Clear old global ledgers and recalculate per department
    const totalIncomeAgg = await Student.aggregate([
      { $match: { department: defaultDept } },
      { $unwind: "$payments" },
      { $group: { _id: null, total: { $sum: "$payments.amount" } } },
    ]);
    const totalIncome = totalIncomeAgg.length ? totalIncomeAgg[0].total : 0;

    const totalExpenseAgg = await Expense.aggregate([
      { $match: { department: defaultDept } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalExpenses = totalExpenseAgg.length ? totalExpenseAgg[0].total : 0;

    const balance = totalIncome - totalExpenses;

    await Ledger.findOneAndUpdate(
      { department: defaultDept },
      {
        department: defaultDept,
        totalIncome,
        totalExpenses,
        balance,
        lastUpdated: new Date(),
      },
      { upsert: true, new: true },
    );

    log.success(`Ledger recalculated for ${defaultDept}:`);
    console.log(`   💵 Total Income:  ₦${totalIncome.toLocaleString()}`);
    console.log(`   💸 Total Expenses: ₦${totalExpenses.toLocaleString()}`);
    console.log(`   📊 Balance:       ₦${balance.toLocaleString()}`);

    // SUMMARY
    log.header("✅ Migration Complete!");
    console.log("");
    log.success(
      `All records now belong to department: ${colors.bright}${defaultDept}${colors.reset}`,
    );
    console.log("");
    log.info("Next steps:");
    console.log("   1. Restart your server: npm run dev");
    console.log("   2. Log in and verify your data is visible");
    console.log(
      "   3. Sign up a new admin for another department to test isolation\n",
    );

    process.exit(0);
  } catch (error) {
    log.error("Migration failed!");
    console.error(error);
    process.exit(1);
  }
}

migrate();
