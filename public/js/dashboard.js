const API_BASE = "https://ict-dues-backend.onrender.com";

// AUTH HELPERS
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

// MODAL ALERT SYSTEM
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

// LOAD DASHBOARD STATS
async function loadDashboardStats() {
  try {
    const response = await fetch(`${API_BASE}/api/stats`, {
      headers: getAuthHeaders(),
    });

    if (response.status === 401) {
      showModalAlert(
        "Session expired. Please login again.",
        "error",
        "Session Expired",
      );
      setTimeout(() => {
        localStorage.clear();
        window.location.href = "login.html";
      }, 1500);
      return;
    }

    const data = await response.json();

    document.getElementById("totalStudents").textContent =
      data.totalStudents || 0;
    document.getElementById("totalPaid").textContent = data.totalPaid || 0;
    document.getElementById("totalMoney").textContent =
      `GH¢${data.totalMoney || 0}`;
    document.getElementById("owing").textContent = data.owing || 0;
  } catch (error) {
    console.error("Error loading stats:", error);
    showModalAlert("Failed to load dashboard statistics.", "error");
  }
}

// LOGOUT
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  showModalAlert(
    "Are you sure you want to logout?",
    "info",
    "Confirm Logout",
    () => {
      fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: getAuthHeaders(),
      }).catch(() => {});

      localStorage.clear();
      window.location.href = "login.html";
    },
  );
});

// LOAD ON PAGE READY
document.addEventListener("DOMContentLoaded", loadDashboardStats);
