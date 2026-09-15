/*   SHARED UTILITIES – used across all pages
   Change CONFIG values here to update the entire app.
*/

//  GLOBAL CONFIG
const CONFIG = {
  CURRENCY_SYMBOL: "GH¢",
  CURRENCY_POSITION: "prefix", // "prefix" | "suffix"
  API_BASE: "https://ict-dues-backend.onrender.com",
};

const API_BASE = CONFIG.API_BASE;

//  CURRENCY FORMATTER
function formatCurrency(amount, withDecimals = false) {
  const num = Number(amount) || 0;
  const formatted = withDecimals
    ? num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : num.toLocaleString();

  return CONFIG.CURRENCY_POSITION === "suffix"
    ? `${formatted} ${CONFIG.CURRENCY_SYMBOL}`
    : `${CONFIG.CURRENCY_SYMBOL}${formatted}`;
}

//  AUTH HELPERS
function getAuthToken() {
  return localStorage.getItem("token");
}

function getAuthHeaders(isJson = true) {
  const token = getAuthToken();
  const headers = { Authorization: token ? `Bearer ${token}` : "" };
  if (isJson) headers["Content-Type"] = "application/json";
  return headers;
}

function isAuthenticated() {
  return !!getAuthToken();
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
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
  const existing = document.getElementById("customAlertModal");
  if (existing) existing.remove();

  const defaultTitle =
    type === "success"
      ? "✅ Success"
      : type === "error"
        ? "❌ Error"
        : "ℹ️ Information";

  const modalHTML = `
    <div id="customAlertModal" class="custom-alert-overlay">
      <div class="custom-alert-box ${type}">
        <div class="custom-alert-header">
          <h3>${title || defaultTitle}</h3>
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
  if (callback) window._alertCallback = callback;
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
  if (modal && e.target === modal) closeModalAlert();
});

//  SIDEBAR BRANDING (dept name + logo)
function setSidebarBranding() {
  try {
    const user = getCurrentUser();
    const deptEl = document.getElementById("deptName");
    const logoBox = document.getElementById("logoBox");
    const logoImg = document.getElementById("deptLogo");

    if (deptEl && user.department) {
      deptEl.textContent = user.department;
      const parts = document.title.split("|");
      if (parts.length > 1)
        document.title = `${user.department} | ${parts.pop().trim()}`;
    }

    if (logoImg && user.logo) {
      logoImg.src = `${API_BASE}${user.logo}`;
      logoBox?.classList.add("has-logo");
    } else {
      logoBox?.classList.remove("has-logo");
    }

    if (logoBox && !logoBox.dataset.bound) {
      logoBox.dataset.bound = "1";
      logoBox.addEventListener("click", () => {
        document.getElementById("logoInput")?.click();
      });

      const fileInput = document.getElementById("logoInput");
      fileInput?.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) await uploadLogo(file);
      });
    }
  } catch (err) {
    console.error("Error setting branding:", err);
  }
}

async function uploadLogo(file) {
  if (file.size > 2 * 1024 * 1024) {
    showModalAlert("Image must be under 2MB", "error");
    return;
  }

  const formData = new FormData();
  formData.append("logo", file);

  try {
    const res = await fetch(`${API_BASE}/api/auth/upload-logo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getAuthToken()}` },
      body: formData,
    });
    const data = await res.json();

    if (res.ok) {
      const user = getCurrentUser();
      user.logo = data.logo;
      localStorage.setItem("user", JSON.stringify(user));

      const logoImg = document.getElementById("deptLogo");
      const logoBox = document.getElementById("logoBox");
      if (logoImg) {
        logoImg.src = `${API_BASE}${data.logo}?t=${Date.now()}`;
        logoBox?.classList.add("has-logo");
      }
      showModalAlert("✅ Logo updated successfully!", "success");
    } else {
      showModalAlert(data.message || "Upload failed", "error");
    }
  } catch (err) {
    console.error("Upload error:", err);
    showModalAlert("Failed to upload logo", "error");
  }
}

//  GLOBAL LOGOUT
function attachLogoutHandler() {
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
}

//  EXCEL DOWNLOAD HELPER
async function downloadExcel(url, filenamePrefix) {
  showModalAlert("Exporting... please wait.", "info", "Processing...");
  try {
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (res.status === 401) return handleUnauthorized();
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    closeModalAlert();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filenamePrefix}_${new Date().toISOString().split("T")[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
    showModalAlert("Export downloaded!", "success");
  } catch (err) {
    console.error("Export error:", err);
    closeModalAlert();
    showModalAlert("Failed to export", "error");
  }
}

//  MOBILE SIDEBAR TOGGLE
function initMobileSidebar() {
  const menuBtn = document.getElementById("mobileMenuBtn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const closeBtn = document.getElementById("sidebarCloseBtn");

  if (!menuBtn || !sidebar || !overlay) return;

  const openSidebar = () => {
    sidebar.classList.add("open");
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  };

  const closeSidebar = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  };

  menuBtn.addEventListener("click", openSidebar);
  overlay.addEventListener("click", closeSidebar);
  closeBtn?.addEventListener("click", closeSidebar);

  // Auto-close when a nav item is clicked
  sidebar.querySelectorAll("ul li").forEach((item) => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  // Close if user resizes back to desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) closeSidebar();
  });
}

// Auto-init on page load
document.addEventListener("DOMContentLoaded", initMobileSidebar);
