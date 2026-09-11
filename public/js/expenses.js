/* ============================================================
   EXPENSES PAGE
   ============================================================ */

let editingExpenseId = null;
let currentFilters = { category: "", startDate: "", endDate: "" };

// ============ LOAD LEDGER ============
async function loadLedger() {
  try {
    const res = await fetch(`${API_BASE}/api/ledger`, {
      headers: getAuthHeaders(),
    });
    if (res.status === 401) return handleUnauthorized();
    const data = await res.json();

    document.getElementById("totalIncome").textContent = formatCurrency(
      data.totalIncome,
    );
    document.getElementById("totalExpenses").textContent = formatCurrency(
      data.totalExpenses,
    );
    const balanceEl = document.getElementById("netBalance");
    const balance = data.balance || 0;
    balanceEl.textContent = formatCurrency(balance);
    balanceEl.style.color = balance >= 0 ? "#10b981" : "#ef4444";
  } catch (error) {
    console.error("Error loading ledger:", error);
  }
}

// ============ LOAD EXPENSES ============
async function loadExpenses() {
  try {
    const params = new URLSearchParams();
    if (currentFilters.category)
      params.append("category", currentFilters.category);
    if (currentFilters.startDate)
      params.append("startDate", currentFilters.startDate);
    if (currentFilters.endDate)
      params.append("endDate", currentFilters.endDate);
    const query = params.toString();

    const res = await fetch(
      `${API_BASE}/api/expenses${query ? "?" + query : ""}`,
      { headers: getAuthHeaders() },
    );
    if (res.status === 401) return handleUnauthorized();
    const data = await res.json();

    const tbody = document.getElementById("expensesTable");

    if (!data.data || data.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="no-data">No expenses recorded</td></tr>`;
      return;
    }

    tbody.innerHTML = data.data
      .map(
        (exp) => `
      <tr>
        <td>${exp.receiptNumber || "N/A"}</td>
        <td>${exp.category}</td>
        <td>${exp.description}</td>
        <td>${formatCurrency(exp.amount)}</td>
        <td>${new Date(exp.date).toLocaleDateString()}</td>
        <td>${exp.paymentMethod || "Cash"}</td>
        <td>
          <button onclick="editExpense('${exp._id}')" class="btn-edit">Edit</button>
          <button onclick="deleteExpense('${exp._id}')" class="btn-delete">Delete</button>
        </td>
      </tr>
    `,
      )
      .join("");
  } catch (error) {
    console.error("Error loading expenses:", error);
    showModalAlert("Failed to load expenses", "error");
  }
}

// ============ ADD EXPENSE ============
document.getElementById("addExpenseBtn")?.addEventListener("click", () => {
  editingExpenseId = null;
  document.getElementById("modalTitle").textContent = "Add Expense";
  [
    "expenseCategory",
    "expenseDescription",
    "expenseAmount",
    "expenseDate",
    "expenseNotes",
  ].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("expensePaymentMethod").value = "Cash";
  document.getElementById("expenseModal").style.display = "flex";
});

// ============ EDIT EXPENSE ============
function editExpense(id) {
  editingExpenseId = id;
  fetch(`${API_BASE}/api/expenses/${id}`, { headers: getAuthHeaders() })
    .then((res) => res.json())
    .then((exp) => {
      document.getElementById("modalTitle").textContent = "Edit Expense";
      document.getElementById("expenseCategory").value = exp.category;
      document.getElementById("expenseDescription").value = exp.description;
      document.getElementById("expenseAmount").value = exp.amount;
      document.getElementById("expenseDate").value = exp.date
        ? new Date(exp.date).toISOString().split("T")[0]
        : "";
      document.getElementById("expensePaymentMethod").value =
        exp.paymentMethod || "Cash";
      document.getElementById("expenseNotes").value = exp.notes || "";
      document.getElementById("expenseModal").style.display = "flex";
    })
    .catch((err) => {
      console.error(err);
      showModalAlert("Failed to load expense details", "error");
    });
}

// ============ SAVE EXPENSE ============
document.getElementById("saveExpense")?.addEventListener("click", async () => {
  const payload = {
    category: document.getElementById("expenseCategory").value,
    description: document.getElementById("expenseDescription").value.trim(),
    amount: parseFloat(document.getElementById("expenseAmount").value),
    date: document.getElementById("expenseDate").value,
    paymentMethod: document.getElementById("expensePaymentMethod").value,
    notes: document.getElementById("expenseNotes").value.trim(),
  };

  if (!payload.category || !payload.description || !payload.amount) {
    return showModalAlert(
      "Please fill in Category, Description, and Amount",
      "error",
    );
  }

  const url = editingExpenseId
    ? `${API_BASE}/api/expenses/${editingExpenseId}`
    : `${API_BASE}/api/expenses`;
  const method = editingExpenseId ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.status === 401) return handleUnauthorized();
    const result = await res.json();

    if (res.ok) {
      showModalAlert(
        editingExpenseId ? "✅ Expense updated!" : "✅ Expense added!",
        "success",
      );
      document.getElementById("expenseModal").style.display = "none";
      loadLedger();
      loadExpenses();
    } else {
      showModalAlert(result.message || "Operation failed", "error");
    }
  } catch (err) {
    console.error("Save expense error:", err);
    showModalAlert("Failed to save expense", "error");
  }
});

// ============ DELETE EXPENSE ============
function deleteExpense(id) {
  showModalAlert("Delete this expense?", "info", "Confirm Delete", async () => {
    try {
      const res = await fetch(`${API_BASE}/api/expenses/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.status === 401) return handleUnauthorized();

      if (res.ok) {
        showModalAlert("✅ Expense deleted", "success");
        loadLedger();
        loadExpenses();
      } else {
        const data = await res.json();
        showModalAlert(data.message || "Delete failed", "error");
      }
    } catch (err) {
      console.error("Delete expense error:", err);
      showModalAlert("Failed to delete expense", "error");
    }
  });
}

// ============ FILTERS ============
document.getElementById("applyFilters")?.addEventListener("click", () => {
  currentFilters.category = document.getElementById("filterCategory").value;
  currentFilters.startDate = document.getElementById("filterStartDate").value;
  currentFilters.endDate = document.getElementById("filterEndDate").value;
  loadExpenses();
});

document.getElementById("clearFilters")?.addEventListener("click", () => {
  document.getElementById("filterCategory").value = "";
  document.getElementById("filterStartDate").value = "";
  document.getElementById("filterEndDate").value = "";
  currentFilters = { category: "", startDate: "", endDate: "" };
  loadExpenses();
});

// ============ EXPORT ============
document.getElementById("exportExpensesBtn")?.addEventListener("click", () => {
  downloadExcel(`${API_BASE}/api/export/expenses`, "expenses");
});

// ============ MODAL CLOSE ============
document.getElementById("closeExpenseModal")?.addEventListener("click", () => {
  document.getElementById("expenseModal").style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === document.getElementById("expenseModal")) {
    document.getElementById("expenseModal").style.display = "none";
  }
});

// ============ INIT ============
document.addEventListener("DOMContentLoaded", () => {
  loadLedger();
  loadExpenses();
  setSidebarBranding();
  attachLogoutHandler();
});
