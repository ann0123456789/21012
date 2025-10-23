const API_BASE_URL = "https://edubridge-94lr.onrender.com";

// elements
const form = document.getElementById("studentProfileForm");
const titleEl = document.getElementById("title");
const firstNameEl = document.getElementById("firstName");
const lastNameEl = document.getElementById("lastName");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const statusBtn = document.getElementById("statusBtn");

let currentProfile = null;

function updateStatusButton(btn, status) {
  const s = (status || "").toLowerCase();
  btn.classList.toggle("active", s === "active");
  btn.classList.toggle("inactive", s !== "active");
  btn.textContent = s === "active" ? "Active" : "Inactive";
}
document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch(`${API_BASE_URL}/api/profile`, { credentials: "include" });
  const data = await res.json();
  if (!res.ok || data.status !== "success") {
    alert(data.message || "Failed to load profile.");
    return;
  }

  currentProfile = data.profile;
  titleEl.value = currentProfile.title || "Mr";  // ✅ load title
  firstNameEl.value = currentProfile.first_name;
  lastNameEl.value = currentProfile.last_name;
  emailEl.value = currentProfile.email;

  // Don't show the real password; leave the password field empty or use a placeholder
  passwordEl.value = ""; // Show placeholder for password (or leave it empty)

  // Updating status button
  updateStatusButton(statusBtn, currentProfile.status);
});

// toggle status
document.addEventListener("click", async (e) => {
  if (e.target && e.target.id === "statusBtn") {
    const active = statusBtn.classList.contains("active");
    if (active) {
      if (!confirm("Set your status to INACTIVE?\n\nThis will unenroll you from all courses/classrooms.")) return;
      await saveProfile({ status: "inactive" }, true);
    } else {
      if (!confirm("Set your status to ACTIVE?")) return;
      await saveProfile({ status: "active" }, true);
    }
  }
});

// submit
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    title: document.getElementById("title").value.trim(), // ✅
    first_name: firstNameEl.value.trim(),
    last_name: lastNameEl.value.trim(),
    email: emailEl.value.trim(),
  };

  // password change (optional)
  const newPwd = passwordEl.value.trim();
  if (newPwd) {
    const curPwd = prompt("Enter your CURRENT password:");
    if (!curPwd) { alert("Password change cancelled."); }
    else {
      const ok = await changePassword(curPwd, newPwd);
      if (!ok) return;
      passwordEl.value = "";
    }
  }

  await saveProfile(payload);
});

async function saveProfile(patch, silent = false) {
  const res = await fetch(`${API_BASE_URL}/api/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok || data.status !== "success") {
    alert(data.message || "Failed to update profile.");
    return false;
  }
  if (patch.status) updateStatusButton(statusBtn, patch.status);
  if (!silent) alert("Profile saved.");
  return true;
}

async function changePassword(current_password, new_password) {
  const res = await fetch(`${API_BASE_URL}/api/profile/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ current_password, new_password })
  });
  const data = await res.json();
  if (!res.ok || data.status !== "success") {
    alert(data.message || "Password change failed.");
    return false;
  }
  alert("Password changed successfully.");
  return true;
}
