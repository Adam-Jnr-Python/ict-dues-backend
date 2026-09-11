/* ============================================================
   LOGIN / SIGNUP / LANDING
   ============================================================ */

// ============ LOGIN ============
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.querySelector('input[name="email"]').value.trim();
  const password = document
    .querySelector('input[name="password"]')
    .value.trim();

  if (!email || !password)
    return showModalAlert("Please fill in all fields", "error");

  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.admin));
      showModalAlert("Login successful! Redirecting...", "success", "Welcome!");
      setTimeout(() => (window.location.href = "dashboard.html"), 1000);
    } else {
      showModalAlert(data.message || "Login failed", "error");
    }
  } catch (error) {
    console.error("Login error:", error);
    showModalAlert("Failed to connect to server.", "error");
  }
});

// ============ SIGNUP ============
document.getElementById("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.querySelector('input[name="name"]').value.trim();
  const email = document.querySelector('input[name="email"]').value.trim();
  const department = document
    .querySelector('input[name="department"]')
    ?.value.trim();
  const password = document
    .querySelector('input[name="password"]')
    .value.trim();

  if (!name || !email || !department || !password) {
    return showModalAlert("Please fill in all fields", "error");
  }
  if (password.length < 6) {
    return showModalAlert(
      "Password must be at least 6 characters long",
      "error",
    );
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, department }),
    });
    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.admin));
      showModalAlert(
        `Welcome ${department}! Redirecting...`,
        "success",
        "🎉 Account Created",
      );
      setTimeout(() => (window.location.href = "dashboard.html"), 1500);
    } else {
      showModalAlert(data.message || "Registration failed", "error");
    }
  } catch (error) {
    console.error("Registration error:", error);
    showModalAlert("Failed to connect to server.", "error");
  }
});

// ============ AUTH GUARD ============
const currentPage = window.location.pathname.split("/").pop();
const protectedPages = [
  "dashboard.html",
  "students.html",
  "set-dues.html",
  "expenses.html",
];
if (protectedPages.includes(currentPage) && !isAuthenticated()) {
  showModalAlert("Please login to access this page", "error", "Access Denied");
  setTimeout(() => (window.location.href = "login.html"), 1000);
}
