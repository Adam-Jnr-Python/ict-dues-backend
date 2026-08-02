const API_BASE = "https://ict-dues-backend.onrender.com";

//  AUTH HELPERS
function getAuthToken() {
  return localStorage.getItem("token");
}

function getAuthHeaders() {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

function handleUnauthorized() {
  showModalAlert(
    "Session expired. Please login again.",
    "error",
    "Session Expired",
  );
  setTimeout(() => {
    localStorage.clear();
    window.location.href = "login.html";
  }, 1500);
}

//  MODAL ALERT SYSTEM
function showModalAlert(message, type = "info", title = "", callback = null) {
  const existingModal = document.getElementById("customAlertModal");
  if (existingModal) {
    existingModal.remove();
  }

  const modalHTML = `
    <div id="customAlertModal" class="custom-alert-overlay">
      <div class="custom-alert-box ${type}">
        <div class="custom-alert-header">
          <h3>${title || (type === "success" ? "✅ Success" : type === "error" ? "❌ Error" : "ℹ️ Information")}</h3>
          <button class="custom-alert-close" onclick="closeModalAlert()">&times;</button>
        </div>
        <div class="custom-alert-body">
          <p>${message}</p>
        </div>
        <div class="custom-alert-footer">
          <button class="custom-alert-btn ${type}" onclick="closeModalAlert()">OK</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);
  document.body.style.overflow = "hidden";

  if (callback) {
    window._alertCallback = callback;
  }
}

function closeModalAlert() {
  const modal = document.getElementById("customAlertModal");
  if (modal) {
    modal.remove();
    document.body.style.overflow = "auto";
    if (window._alertCallback) {
      const cb = window._alertCallback;
      window._alertCallback = null;
      cb();
    }
  }
}

document.addEventListener("click", (e) => {
  const modal = document.getElementById("customAlertModal");
  if (modal && e.target === modal) {
    closeModalAlert();
  }
});

//  GLOBAL VARIABLES
let currentStudentId = null;
let currentPaymentIndex = null;
let studentToDelete = null;

//  LOAD STUDENTS
async function loadStudents() {
  try {
    const response = await fetch(`${API_BASE}/api/paid-students`, {
      headers: getAuthHeaders(),
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const data = await response.json();
    const table = document.getElementById("studentsTable");

    if (!data.data || data.data.length === 0) {
      table.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 40px; color: #94a3b8;">No students found</td></tr>`;
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
        <td>GH¢${student.totalDues}</td>
        <td>GH¢${student.amountPaid}</td>
        <td style="color: ${student.balance > 0 ? "#e74c3c" : "#27ae60"}; font-weight: bold;">
          GH¢${student.balance}
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
    showModalAlert(
      "Error loading students. Please check your connection.",
      "error",
    );
    document.getElementById("studentsTable").innerHTML =
      `<tr><td colspan="9" style="text-align:center; color:red;">Error loading students</td></tr>`;
  }
}

// VIEW STUDENT
async function viewStudent(studentId) {
  try {
    // Check if modal elements exist
    const viewName = document.getElementById("viewName");
    if (!viewName) {
      console.error("View modal elements not found in DOM");
      showModalAlert(
        "View modal is not properly configured. Please refresh the page.",
        "error",
      );
      return;
    }

    const response = await fetch(`${API_BASE}/api/student/${studentId}`, {
      headers: getAuthHeaders(),
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const student = await response.json();

    if (response.ok) {
      // Safely set text content with null checks
      const elements = {
        viewName: student.studentName || "N/A",
        viewId: student.studentId || "N/A",
        viewDept: student.department || "N/A",
        viewLevel: student.level || "N/A",
        viewCourse: student.course || "N/A",
        viewTotalDues: student.totalDues || 0,
        viewAmountPaid: student.amountPaid || 0,
        viewBalance: student.balance || 0,
        viewPaymentCount: student.paymentCount || 0,
      };

      Object.keys(elements).forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = elements[id];
        }
      });

      const paymentsDiv = document.getElementById("viewPayments");
      if (paymentsDiv) {
        if (student.payments && student.payments.length > 0) {
          paymentsDiv.innerHTML = student.payments
            .map(
              (p, index) => `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                <span>#${index + 1} GH¢${p.amount}</span>
                <span style="color: #64748b;">${new Date(p.date).toLocaleDateString()}</span>
                <span>
                  <button onclick="openEditPayment('${student.studentId}', ${index})" class="btn-view" style="font-size: 11px; padding: 2px 8px;">Edit</button>
                  <button onclick="openDeletePayment('${student.studentId}', ${index})" class="btn-delete" style="font-size: 11px; padding: 2px 8px;">Delete</button>
                </span>
              </div>
            `,
            )
            .join("");
        } else {
          paymentsDiv.innerHTML =
            '<p style="color: #94a3b8;">No payments recorded</p>';
        }
      }

      const viewModal = document.getElementById("viewModal");
      if (viewModal) {
        viewModal.style.display = "flex";
      }
    } else {
      showModalAlert("Student not found", "error");
    }
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
        const response = await fetch(
          `${API_BASE}/api/student/${studentToDelete}`,
          {
            method: "DELETE",
            headers: getAuthHeaders(),
          },
        );

        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        const result = await response.json();

        if (response.ok) {
          showModalAlert("✅ Student deleted successfully", "success");
          document.getElementById("deleteModal").style.display = "none";
          studentToDelete = null;
          loadStudents();
        } else {
          showModalAlert(`❌ Error: ${result.message}`, "error");
        }
      } catch (error) {
        console.error("Error deleting student:", error);
        showModalAlert("Failed to delete student", "error");
      }
    },
  );
}

document.getElementById("cancelDelete")?.addEventListener("click", () => {
  document.getElementById("deleteModal").style.display = "none";
  studentToDelete = null;
});

// EDIT PAYMENT
function openEditPayment(studentId, paymentIndex) {
  currentStudentId = studentId;
  currentPaymentIndex = paymentIndex;

  fetch(`${API_BASE}/api/student/${studentId}`, {
    headers: getAuthHeaders(),
  })
    .then((res) => res.json())
    .then((student) => {
      const payment = student.payments[paymentIndex];
      const studentIdInput = document.getElementById("editPaymentStudentId");
      const amountInput = document.getElementById("editPaymentAmount");
      const dateInput = document.getElementById("editPaymentDate");

      if (studentIdInput) studentIdInput.value = studentId;
      if (amountInput) amountInput.value = payment.amount;
      if (dateInput) {
        dateInput.value = new Date(payment.date).toISOString().split("T")[0];
      }

      const modal = document.getElementById("editPaymentModal");
      if (modal) modal.style.display = "flex";
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
      document.getElementById("editPaymentAmount")?.value,
    );
    const date = document.getElementById("editPaymentDate")?.value;

    if (!amount || amount <= 0) {
      showModalAlert("Please enter a valid amount", "error");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/payment/${currentStudentId}/${currentPaymentIndex}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({ amount, date }),
        },
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const result = await response.json();

      if (response.ok) {
        showModalAlert("✅ Payment updated successfully!", "success");
        document.getElementById("editPaymentModal").style.display = "none";
        loadStudents();
        if (document.getElementById("viewModal").style.display === "flex") {
          viewStudent(currentStudentId);
        }
      } else {
        showModalAlert(`❌ Error: ${result.message || result.error}`, "error");
      }
    } catch (error) {
      console.error("Error updating payment:", error);
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
  showModalAlert(
    "Are you sure you want to delete this payment?",
    "info",
    "Confirm Delete",
    async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/payment/${currentStudentId}/${currentPaymentIndex}`,
          {
            method: "DELETE",
            headers: getAuthHeaders(),
          },
        );

        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        const result = await response.json();

        if (response.ok) {
          showModalAlert("✅ Payment deleted successfully!", "success");
          document.getElementById("deletePaymentModal").style.display = "none";
          loadStudents();
          if (document.getElementById("viewModal").style.display === "flex") {
            viewStudent(currentStudentId);
          }
          currentStudentId = null;
          currentPaymentIndex = null;
        } else {
          showModalAlert(
            `❌ Error: ${result.message || result.error}`,
            "error",
          );
        }
      } catch (error) {
        console.error("Error deleting payment:", error);
        showModalAlert("Failed to delete payment", "error");
      }
    },
  );
}

document
  .getElementById("cancelDeletePayment")
  ?.addEventListener("click", () => {
    document.getElementById("deletePaymentModal").style.display = "none";
    currentStudentId = null;
    currentPaymentIndex = null;
  });

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
    showModalAlert("Please fill in all required fields (*)", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/pay`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(studentData),
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const result = await response.json();

    if (response.ok) {
      showModalAlert(
        "✅ Student added and payment recorded successfully!",
        "success",
      );
      document.getElementById("studentModal").style.display = "none";
      loadStudents();
      // Clear form
      document.getElementById("studentName").value = "";
      document.getElementById("studentId").value = "";
      document.getElementById("department").value = "";
      document.getElementById("level").value = "";
      document.getElementById("course").value = "";
      document.getElementById("amount").value = "";
    } else {
      showModalAlert(`❌ Error: ${result.message || result.error}`, "error");
    }
  } catch (error) {
    console.error("Error saving student:", error);
    showModalAlert("Failed to save student. Please try again.", "error");
  }
});

// MODAL CONTROLS
document.getElementById("addStudentBtn")?.addEventListener("click", () => {
  document.getElementById("studentModal").style.display = "block";
});

document.getElementById("closeModal")?.addEventListener("click", () => {
  document.getElementById("studentModal").style.display = "none";
});

document.getElementById("closeViewModal")?.addEventListener("click", () => {
  document.getElementById("viewModal").style.display = "none";
});

// Close modals on outside click
window.addEventListener("click", (event) => {
  const modals = [
    "studentModal",
    "deleteModal",
    "viewModal",
    "editPaymentModal",
    "deletePaymentModal",
  ];
  modals.forEach((id) => {
    const modal = document.getElementById(id);
    if (modal && event.target === modal) {
      modal.style.display = "none";
    }
  });
});

// LOGOUT
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  showModalAlert(
    "Are you sure you want to logout?",
    "info",
    "Confirm Logout",
    () => {
      localStorage.clear();
      window.location.href = "login.html";
    },
  );
});

// LOAD ON PAGE READY
document.addEventListener("DOMContentLoaded", loadStudents);
