// LOAD DASHBOARD STATS
async function loadDashboardStats() {
  try {
    const response = await fetch(`${API_BASE}/api/stats`, {
      headers: getAuthHeaders(),
    });
    if (response.status === 401) return handleUnauthorized();
    const data = await response.json();
    console.log(data);

    document.getElementById("totalStudents").textContent =
      data.totalStudents || 0;
    document.getElementById("totalPaid").textContent = data.totalPaid || 0;
    document.getElementById("totalMoney").textContent = formatCurrency(
      data.totalMoney,
    );
    document.getElementById("owing").textContent = data.owing || 0;
  } catch (error) {
    console.error("Error loading stats:", error);
    showModalAlert("Failed to load dashboard statistics.", "error");
  }
}

// LOAD LEDGER
async function loadLedger() {
  try {
    const res = await fetch(`${API_BASE}/api/ledger`, {
      headers: getAuthHeaders(),
    });
    if (res.status === 401) return handleUnauthorized();
    const data = await res.json();

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

// EXPORTS
document.getElementById("exportStudentsBtn")?.addEventListener("click", () => {
  downloadExcel(`${API_BASE}/api/export/students`, "students_payments");
});

document.getElementById("exportExpensesBtn")?.addEventListener("click", () => {
  downloadExcel(`${API_BASE}/api/export/expenses`, "expenses");
});

// INIT
document.addEventListener("DOMContentLoaded", () => {
  loadDashboardStats();
  loadLedger();
  setSidebarBranding();
  attachLogoutHandler();
});
