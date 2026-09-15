/*
   PUBLIC STUDENT PAYMENT PORTAL
*/

const lookupSection = document.getElementById("lookupSection");
const studentInfo = document.getElementById("studentInfo");
const lookupBtn = document.getElementById("lookupBtn");
const lookupStudentId = document.getElementById("lookupStudentId");
const payBtn = document.getElementById("payBtn");
const fullPayBtn = document.getElementById("fullPayBtn");
const backBtn = document.getElementById("backBtn");

let currentStudent = null;
let currentBalance = 0;

// LOOKUP STUDENT
lookupBtn?.addEventListener("click", async () => {
  const studentId = lookupStudentId.value.trim();
  if (!studentId)
    return showModalAlert("Please enter your Student ID", "error");

  try {
    lookupBtn.disabled = true;
    lookupBtn.textContent = "Searching...";

    const response = await fetch(`${API_BASE}/api/public/student/${studentId}`);

    if (!response.ok) {
      showModalAlert(
        response.status === 404
          ? "Student not found. Please check your ID."
          : "Server error. Try again.",
        "error",
      );
      lookupBtn.disabled = false;
      lookupBtn.textContent = "Check Balance";
      return;
    }

    const student = await response.json();
    currentStudent = student;
    currentBalance = student.balance;

    document.getElementById("studentName").textContent =
      student.studentName || "N/A";
    document.getElementById("studentIdDisplay").textContent =
      student.studentId || "N/A";
    document.getElementById("studentDept").textContent =
      student.department || "N/A";
    document.getElementById("studentLevel").textContent =
      student.level || "N/A";
    document.getElementById("totalDues").textContent = formatCurrency(
      student.totalDues,
    );
    document.getElementById("amountPaid").textContent = formatCurrency(
      student.amountPaid,
    );

    const balanceEl = document.getElementById("balanceDisplay");
    balanceEl.textContent = formatCurrency(student.balance);
    balanceEl.className =
      "amount balance" + (student.balance <= 0 ? " zero" : "");

    const badge = document.getElementById("statusBadge");
    const statusText = document.getElementById("statusText");
    if (student.balance <= 0) {
      badge.className = "status-badge fully-paid";
      statusText.textContent = "✅ Fully Paid";
      payBtn.disabled = true;
      fullPayBtn.disabled = true;
    } else {
      badge.className = "status-badge";
      statusText.textContent = "Balance Due";
      payBtn.disabled = false;
      fullPayBtn.disabled = false;
    }

    const amountInput = document.getElementById("paymentAmount");
    amountInput.max = student.balance;
    amountInput.placeholder = `Max ${formatCurrency(student.balance)}`;
    amountInput.value = "";

    lookupSection.style.display = "none";
    studentInfo.classList.remove("hidden");
    lookupBtn.disabled = false;
    lookupBtn.textContent = "Check Balance";
  } catch (error) {
    console.error("Lookup error:", error);
    showModalAlert("Network error. Please try again.", "error");
    lookupBtn.disabled = false;
    lookupBtn.textContent = "Check Balance";
  }
});

// FULL PAY
fullPayBtn?.addEventListener("click", () => {
  if (currentStudent) {
    document.getElementById("paymentAmount").value = currentStudent.balance;
  }
});

// BACK
backBtn?.addEventListener("click", () => {
  studentInfo.classList.add("hidden");
  lookupSection.style.display = "block";
  lookupStudentId.value = "";
  currentStudent = null;
});

// PAY
payBtn?.addEventListener("click", async () => {
  const amount = parseFloat(document.getElementById("paymentAmount").value);
  const email = document.getElementById("studentEmail").value.trim();

  if (!amount || amount <= 0)
    return showModalAlert("Please enter a valid amount", "error");
  if (amount > currentBalance)
    return showModalAlert(
      `Amount cannot exceed ${formatCurrency(currentBalance)}`,
      "error",
    );
  if (!email) return showModalAlert("Please enter your email address", "error");
  if (!currentStudent)
    return showModalAlert("Please look up your student ID first", "error");

  try {
    payBtn.disabled = true;
    payBtn.textContent = "Processing...";

    const response = await fetch(`${API_BASE}/api/paystack/initialize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: currentStudent.studentId,
        email,
        amount,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      window.location.href = data.authorization_url;
    } else {
      showModalAlert(data.message || "Payment initialization failed", "error");
      payBtn.disabled = false;
      payBtn.textContent = "Pay Now with Paystack";
    }
  } catch (error) {
    console.error("Payment init error:", error);
    showModalAlert("Failed to initialize payment", "error");
    payBtn.disabled = false;
    payBtn.textContent = "Pay Now with Paystack";
  }
});

// ENTER KEY SUPPORT
lookupStudentId?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") lookupBtn.click();
});

document.getElementById("paymentAmount")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") payBtn.click();
});

document.getElementById("studentEmail")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") payBtn.click();
});

// AUTO-LOOKUP FROM URL
window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const studentId = params.get("studentId");
  if (studentId) {
    lookupStudentId.value = studentId;
    setTimeout(() => lookupBtn.click(), 500);
  }
});
