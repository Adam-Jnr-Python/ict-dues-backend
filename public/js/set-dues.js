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

// LOAD ALL DUES
async function loadDues() {
  try {
    const response = await fetch(`${API_BASE}/api/all-dues`, {
      headers: getAuthHeaders(),
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const data = await response.json();
    const table = document.getElementById("duesTable");

    if (!data.data || data.data.length === 0) {
      table.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">No dues set yet. Set one above!</td></tr>`;
      return;
    }

    table.innerHTML = data.data
      .map(
        (dept) => `
      <tr>
        <td>${dept.department}</td>
        <td>Level ${dept.level}</td>
        <td>GH¢${dept.amount}</td>
        <td>
          <button class="btn-edit" onclick="editDues('${dept._id}', '${dept.department}', ${dept.amount})">Edit</button>
          <button class="btn-delete" onclick="deleteDues('${dept._id}')">Delete</button>
        </td>
      </tr>
    `,
      )
      .join("");
  } catch (error) {
    console.error("Error loading dues:", error);
    showModalAlert(
      "Error loading dues. Please check your connection.",
      "error",
    );
    document.getElementById("duesTable").innerHTML =
      `<tr><td colspan="4" style="text-align:center; padding:20px; color:#ef4444;">Error loading dues</td></tr>`;
  }
}

// SET NEW DUES
document.getElementById("setDuesBtn")?.addEventListener("click", async () => {
  const department = document.getElementById("department").value.trim();
  const level = document.getElementById("level").value.trim();
  const amount = parseFloat(document.getElementById("amount").value);
  const messageDiv = document.getElementById("duesMessage");

  if (!department) {
    showModalAlert("Please select a department", "error");
    return;
  }

  if (!level) {
    showModalAlert("Please select a level", "error");
    return;
  }

  if (!amount || amount <= 0) {
    showModalAlert("Please enter a valid amount", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/set-dues`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ department, level, amount }),
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const result = await response.json();

    if (response.ok) {
      showModalAlert(
        `✅ Dues set for ${department} (${level}L): GH¢${amount}`,
        "success",
      );
      document.getElementById("department").value = "";
      document.getElementById("level").value = "";
      document.getElementById("amount").value = "";
      messageDiv.innerHTML = `<p class="success">✅ Dues set successfully!</p>`;
      loadDues();
    } else {
      showModalAlert(`❌ Error: ${result.message || result.error}`, "error");
    }
  } catch (error) {
    console.error("Error setting dues:", error);
    showModalAlert("Failed to set dues. Please try again.", "error");
  }
});

// EDIT DUES
let editId = null;

function editDues(id, department, amount) {
  editId = id;
  document.getElementById("editDepartment").value = department;
  document.getElementById("editAmount").value = amount;
  document.getElementById("editModal").style.display = "flex";
}

document.getElementById("saveEditBtn")?.addEventListener("click", async () => {
  const amount = parseFloat(document.getElementById("editAmount").value);
  const messageDiv = document.getElementById("duesMessage");

  if (!amount || amount <= 0) {
    showModalAlert("Please enter a valid amount", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/dues/${editId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ amount }),
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const result = await response.json();

    if (response.ok) {
      showModalAlert("✅ Dues updated successfully!", "success");
      document.getElementById("editModal").style.display = "none";
      messageDiv.innerHTML = `<p class="success">✅ Dues updated successfully!</p>`;
      loadDues();
    } else {
      showModalAlert(`❌ Error: ${result.message || result.error}`, "error");
    }
  } catch (error) {
    console.error("Error updating dues:", error);
    showModalAlert("Failed to update dues. Please try again.", "error");
  }
});

// DELETE DUES
async function deleteDues(id) {
  showModalAlert(
    "Are you sure you want to delete these dues?",
    "info",
    "Confirm Delete",
    async () => {
      const messageDiv = document.getElementById("duesMessage");

      try {
        const response = await fetch(`${API_BASE}/api/dues/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });

        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        const result = await response.json();

        if (response.ok) {
          showModalAlert("✅ Dues deleted successfully!", "success");
          messageDiv.innerHTML = `<p class="success">✅ Dues deleted successfully!</p>`;
          loadDues();
        } else {
          showModalAlert(
            `❌ Error: ${result.message || result.error}`,
            "error",
          );
        }
      } catch (error) {
        console.error("Error deleting dues:", error);
        showModalAlert("Failed to delete dues. Please try again.", "error");
      }
    },
  );
}

// MODAL CONTROLS
document.getElementById("closeEditModal")?.addEventListener("click", () => {
  document.getElementById("editModal").style.display = "none";
});

window.addEventListener("click", (event) => {
  const modal = document.getElementById("editModal");
  if (event.target === modal) {
    modal.style.display = "none";
  }
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
document.addEventListener("DOMContentLoaded", loadDues);
