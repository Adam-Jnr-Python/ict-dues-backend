// const API_BASE = "https://ict-dues-backend.onrender.com";

// GLOBALS
let currentStudentId = null;
let currentPaymentIndex = null;
let studentToDelete = null;
let searchTimeout = null;

// LOAD STUDENTS
async function loadStudents(searchTerm = "") {
  try {
    const params = new URLSearchParams();
    if (searchTerm) params.append("search", searchTerm);
    const url = `${API_BASE}/api/paid-students${params.toString() ? "?" + params.toString() : ""}`;

    const response = await fetch(url, { headers: getAuthHeaders() });
    if (response.status === 401) return handleUnauthorized();

    const data = await response.json();
    const table = document.getElementById("studentsTable");

    if (!data.data || data.data.length === 0) {
      table.innerHTML = `<tr><td colspan="9" class="no-data">No students found</td></tr>`;
      return;
    }

    table.innerHTML = data.data
      .map(
        (student) => `
      <tr>
        <td>${student.studentName || "N/A"}</td>
        <td>${student.studentId}</td>
        <td>${student.department}</td>
        <td>${student.level || "N/A"}</td>
        <td>${student.course || "N/A"}</td>
        <td>${formatCurrency(student.totalDues)}</td>
        <td>${formatCurrency(student.amountPaid)}</td>
        <td style="color: ${student.balance > 0 ? "#e74c3c" : "#27ae60"}; font-weight: bold;">
          ${formatCurrency(student.balance)}
        </td>
        <td>
          <button onclick="viewStudent('${student.studentId}')" class="btn-view">View</button>
          <button onclick="deleteStudent('${student.studentId}')" class="btn-delete">Delete</button>
        </td>
      </tr>
    `,
      )
      .join("");
  } catch (error) {
    console.error("Error loading students:", error);
    showModalAlert("Error loading students.", "error");
  }
}

// VIEW STUDENT
async function viewStudent(studentId) {
  try {
    const response = await fetch(`${API_BASE}/api/student/${studentId}`, {
      headers: getAuthHeaders(),
    });
    if (response.status === 401) return handleUnauthorized();
    const student = await response.json();

    if (!response.ok) {
      showModalAlert("Student not found", "error");
      return;
    }

    const fields = {
      viewName: student.studentName || "N/A",
      viewId: student.studentId || "N/A",
      viewDept: student.department || "N/A",
      viewLevel: student.level || "N/A",
      viewCourse: student.course || "N/A",
      viewTotalDues: formatCurrency(student.totalDues),
      viewAmountPaid: formatCurrency(student.amountPaid),
      viewBalance: formatCurrency(student.balance),
      viewPaymentCount: student.paymentCount || 0,
    };

    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });

    const paymentsDiv = document.getElementById("viewPayments");
    if (paymentsDiv) {
      if (student.payments && student.payments.length > 0) {
        paymentsDiv.innerHTML = student.payments
          .map(
            (p, index) => `
          <div class="payment-row">
            <span>#${index + 1} ${formatCurrency(p.amount)}</span>
            <span style="color:#64748b;">${new Date(p.date).toLocaleDateString()}</span>
            <span>
              <button onclick="openEditPayment('${student.studentId}', ${index})" class="btn-view" style="font-size:11px;padding:2px 8px;">Edit</button>
              <button onclick="openDeletePayment('${student.studentId}', ${index})" class="btn-delete" style="font-size:11px;padding:2px 8px;">Delete</button>
            </span>
          </div>
        `,
          )
          .join("");
      } else {
        paymentsDiv.innerHTML =
          '<p style="color:#94a3b8;">No payments recorded</p>';
      }
    }

    document.getElementById("viewModal").style.display = "flex";
  } catch (error) {
    console.error("Error viewing student:", error);
    showModalAlert("Failed to load student details", "error");
  }
}

// DELETE STUDENT
function deleteStudent(studentId) {
  studentToDelete = studentId;
  showModalAlert(
    "Are you sure you want to delete this student?",
    "info",
    "Confirm Delete",
    async () => {
      try {
        const res = await fetch(`${API_BASE}/api/student/${studentToDelete}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        if (res.status === 401) return handleUnauthorized();
        const result = await res.json();
        if (res.ok) {
          showModalAlert("✅ Student deleted successfully", "success");
          studentToDelete = null;
          loadStudents(document.getElementById("searchStudent")?.value || "");
        } else {
          showModalAlert(`❌ ${result.message}`, "error");
        }
      } catch (err) {
        console.error("Delete error:", err);
        showModalAlert("Failed to delete student", "error");
      }
    },
  );
}

// EDIT PAYMENT
function openEditPayment(studentId, paymentIndex) {
  currentStudentId = studentId;
  currentPaymentIndex = paymentIndex;

  fetch(`${API_BASE}/api/student/${studentId}`, { headers: getAuthHeaders() })
    .then((res) => res.json())
    .then((student) => {
      const payment = student.payments[paymentIndex];
      document.getElementById("editPaymentStudentId").value = studentId;
      document.getElementById("editPaymentAmount").value = payment.amount;
      document.getElementById("editPaymentDate").value = new Date(payment.date)
        .toISOString()
        .split("T")[0];
      document.getElementById("editPaymentModal").style.display = "flex";
    })
    .catch((err) => {
      console.error("Error fetching payment:", err);
      showModalAlert("Failed to load payment details", "error");
    });
}

document
  .getElementById("saveEditPayment")
  ?.addEventListener("click", async () => {
    const amount = parseFloat(
      document.getElementById("editPaymentAmount").value,
    );
    const date = document.getElementById("editPaymentDate").value;

    if (!amount || amount <= 0)
      return showModalAlert("Please enter a valid amount", "error");

    try {
      const res = await fetch(
        `${API_BASE}/api/payment/${currentStudentId}/${currentPaymentIndex}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({ amount, date }),
        },
      );
      if (res.status === 401) return handleUnauthorized();
      const result = await res.json();

      if (res.ok) {
        showModalAlert("✅ Payment updated!", "success");
        document.getElementById("editPaymentModal").style.display = "none";
        loadStudents(document.getElementById("searchStudent")?.value || "");
        if (document.getElementById("viewModal").style.display === "flex") {
          viewStudent(currentStudentId);
        }
      } else {
        showModalAlert(result.message || "Update failed", "error");
      }
    } catch (err) {
      console.error("Update payment error:", err);
      showModalAlert("Failed to update payment", "error");
    }
  });

document
  .getElementById("closeEditPaymentModal")
  ?.addEventListener("click", () => {
    document.getElementById("editPaymentModal").style.display = "none";
  });

// DELETE PAYMENT
function openDeletePayment(studentId, paymentIndex) {
  currentStudentId = studentId;
  currentPaymentIndex = paymentIndex;

  showModalAlert("Delete this payment?", "info", "Confirm Delete", async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/payment/${currentStudentId}/${currentPaymentIndex}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        },
      );
      if (res.status === 401) return handleUnauthorized();
      const result = await res.json();

      if (res.ok) {
        showModalAlert("✅ Payment deleted!", "success");
        loadStudents(document.getElementById("searchStudent")?.value || "");
        if (document.getElementById("viewModal").style.display === "flex") {
          viewStudent(currentStudentId);
        }
        currentStudentId = null;
        currentPaymentIndex = null;
      } else {
        showModalAlert(result.message || "Delete failed", "error");
      }
    } catch (err) {
      console.error("Delete payment error:", err);
      showModalAlert("Failed to delete payment", "error");
    }
  });
}

// ADD STUDENT
document.getElementById("saveStudent")?.addEventListener("click", async () => {
  const studentData = {
    studentName: document.getElementById("studentName")?.value.trim(),
    studentId: document.getElementById("studentId")?.value.trim(),
    department: document.getElementById("department")?.value.trim(),
    level: document.getElementById("level")?.value.trim(),
    course: document.getElementById("course")?.value.trim() || "ICT",
    amount: parseFloat(document.getElementById("amount")?.value),
  };

  if (
    !studentData.studentId ||
    !studentData.studentName ||
    !studentData.department ||
    !studentData.level ||
    !studentData.amount
  ) {
    return showModalAlert("Please fill in all required fields (*)", "error");
  }

  try {
    const res = await fetch(`${API_BASE}/api/pay`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(studentData),
    });
    if (res.status === 401) return handleUnauthorized();
    const result = await res.json();

    if (res.ok) {
      showModalAlert("✅ Student added and payment recorded!", "success");
      document.getElementById("studentModal").style.display = "none";
      [
        "studentName",
        "studentId",
        "department",
        "level",
        "course",
        "amount",
      ].forEach((id) => {
        document.getElementById(id).value = "";
      });
      loadStudents(document.getElementById("searchStudent")?.value || "");
    } else {
      showModalAlert(result.message || "Failed to save", "error");
    }
  } catch (err) {
    console.error("Save student error:", err);
    showModalAlert("Failed to save student", "error");
  }
});

// MODAL CONTROLS
document.getElementById("addStudentBtn")?.addEventListener("click", () => {
  // Auto-fill department from logged-in admin
  const user = getCurrentUser();
  const deptInput = document.getElementById("department");
  if (deptInput && user.department) {
    deptInput.value = user.department;
  }
  document.getElementById("studentModal").style.display = "block";
});

document.getElementById("closeModal")?.addEventListener("click", () => {
  document.getElementById("studentModal").style.display = "none";
});

document.getElementById("closeViewModal")?.addEventListener("click", () => {
  document.getElementById("viewModal").style.display = "none";
});

document.getElementById("cancelDelete")?.addEventListener("click", () => {
  document.getElementById("deleteModal").style.display = "none";
  studentToDelete = null;
});

document
  .getElementById("cancelDeletePayment")
  ?.addEventListener("click", () => {
    document.getElementById("deletePaymentModal").style.display = "none";
  });

window.addEventListener("click", (event) => {
  [
    "studentModal",
    "deleteModal",
    "viewModal",
    "editPaymentModal",
    "deletePaymentModal",
  ].forEach((id) => {
    const modal = document.getElementById(id);
    if (modal && event.target === modal) modal.style.display = "none";
  });
});

// SEARCH (debounced)
document
  .getElementById("searchStudent")
  ?.addEventListener("input", function () {
    clearTimeout(searchTimeout);
    const term = this.value.trim();
    searchTimeout = setTimeout(() => loadStudents(term), 400);
  });

// EXPORT
document.getElementById("exportStudentsBtn")?.addEventListener("click", () => {
  downloadExcel(`${API_BASE}/api/export/students`, "students_payments");
});

// INIT
document.addEventListener("DOMContentLoaded", () => {
  loadStudents();
  setSidebarBranding();
  attachLogoutHandler();
});
