let editId = null;

// LOAD DUES
async function loadDues() {
  try {
    const response = await fetch(`${API_BASE}/api/all-dues`, {
      headers: getAuthHeaders(),
    });
    if (response.status === 401) return handleUnauthorized();
    const data = await response.json();

    const table = document.getElementById("duesTable");

    if (!data.data || data.data.length === 0) {
      table.innerHTML = `<tr><td colspan="4" class="no-data">No dues set yet. Set one above!</td></tr>`;
      return;
    }

    table.innerHTML = data.data
      .map(
        (dept) => `
      <tr>
        <td>${dept.department}</td>
        <td>Level ${dept.level}</td>
        <td>${formatCurrency(dept.amount)}</td>
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
    showModalAlert("Error loading dues.", "error");
    document.getElementById("duesTable").innerHTML =
      `<tr><td colspan="4" class="no-data" style="color:#ef4444;">Error loading dues</td></tr>`;
  }
}

// SET NEW DUES
document.getElementById("setDuesBtn")?.addEventListener("click", async () => {
  const department = document.getElementById("department").value.trim();
  const level = document.getElementById("level").value.trim();
  const amount = parseFloat(document.getElementById("amount").value);

  if (!department) return showModalAlert("Please select a department", "error");
  if (!level) return showModalAlert("Please select a level", "error");
  if (!amount || amount <= 0)
    return showModalAlert("Please enter a valid amount", "error");

  try {
    const response = await fetch(`${API_BASE}/api/set-dues`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ department, level, amount }),
    });
    if (response.status === 401) return handleUnauthorized();
    const result = await response.json();

    if (response.ok) {
      showModalAlert(
        `✅ Dues set for ${department} (L${level}): ${formatCurrency(amount)}`,
        "success",
      );
      document.getElementById("department").value = "";
      document.getElementById("level").value = "";
      document.getElementById("amount").value = "";
      document.getElementById("duesMessage").innerHTML =
        `<p class="success">✅ Dues set successfully!</p>`;
      loadDues();
    } else {
      showModalAlert(result.message || result.error || "Error", "error");
    }
  } catch (error) {
    console.error("Error setting dues:", error);
    showModalAlert("Failed to set dues.", "error");
  }
});

// EDIT DUES
function editDues(id, department, amount) {
  editId = id;
  document.getElementById("editDepartment").value = department;
  document.getElementById("editAmount").value = amount;
  document.getElementById("editModal").style.display = "flex";
}

document.getElementById("saveEditBtn")?.addEventListener("click", async () => {
  const amount = parseFloat(document.getElementById("editAmount").value);
  if (!amount || amount <= 0)
    return showModalAlert("Please enter a valid amount", "error");

  try {
    const response = await fetch(`${API_BASE}/api/dues/${editId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ amount }),
    });
    if (response.status === 401) return handleUnauthorized();
    const result = await response.json();

    if (response.ok) {
      showModalAlert("✅ Dues updated!", "success");
      document.getElementById("editModal").style.display = "none";
      document.getElementById("duesMessage").innerHTML =
        `<p class="success">✅ Dues updated successfully!</p>`;
      loadDues();
    } else {
      showModalAlert(result.message || result.error || "Error", "error");
    }
  } catch (error) {
    console.error("Error updating dues:", error);
    showModalAlert("Failed to update dues", "error");
  }
});

// DELETE DUES
async function deleteDues(id) {
  showModalAlert("Delete these dues?", "info", "Confirm Delete", async () => {
    try {
      const response = await fetch(`${API_BASE}/api/dues/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (response.status === 401) return handleUnauthorized();
      const result = await response.json();

      if (response.ok) {
        showModalAlert("✅ Dues deleted!", "success");
        document.getElementById("duesMessage").innerHTML =
          `<p class="success">✅ Dues deleted successfully!</p>`;
        loadDues();
      } else {
        showModalAlert(result.message || result.error || "Error", "error");
      }
    } catch (error) {
      console.error("Error deleting dues:", error);
      showModalAlert("Failed to delete dues", "error");
    }
  });
}

// MODAL CONTROLS
document.getElementById("closeEditModal")?.addEventListener("click", () => {
  document.getElementById("editModal").style.display = "none";
});

window.addEventListener("click", (event) => {
  const modal = document.getElementById("editModal");
  if (event.target === modal) modal.style.display = "none";
});

// INIT
document.addEventListener("DOMContentLoaded", () => {
  loadDues();
  setSidebarBranding();
  attachLogoutHandler();
});
