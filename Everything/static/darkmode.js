const API_BASE_URL = "https://edubridge-94lr.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  /* -------------------------------
     🌙 DARK MODE LOGIC + BACKEND SYNC
  ------------------------------- */
  const themeSwitch = document.getElementById("theme-switch");
  const lightIcon = document.querySelector("#theme-switch .light-icon");
  const darkIcon = document.querySelector("#theme-switch .dark-icon");

  function enableDarkMode() {
    document.documentElement.classList.add("darkmode");
    localStorage.setItem("darkmode", "active");
    if (lightIcon && darkIcon) {
      lightIcon.style.display = "none";
      darkIcon.style.display = "block";
    }
    updateUserPreferences("dark");
  }

  function disableDarkMode() {
    document.documentElement.classList.remove("darkmode");
    localStorage.setItem("darkmode", "inactive");
    if (lightIcon && darkIcon) {
      lightIcon.style.display = "block";
      darkIcon.style.display = "none";
    }
    updateUserPreferences("light");
  }

  // Apply saved theme from localStorage
  if (localStorage.getItem("darkmode") === "active") enableDarkMode();
  else disableDarkMode();

  // Toggle theme on button click
  if (themeSwitch) {
    themeSwitch.addEventListener("click", () => {
      const current = localStorage.getItem("darkmode");
      current === "active" ? disableDarkMode() : enableDarkMode();
    });
  }

  /* -------------------------------
     ✅ ACTIVE / INACTIVE LOGIC
  ------------------------------- */
  const activeBtn = document.getElementById("active");
  const toggleOn = document.querySelector("#active .toggle-on");
  const toggleOff = document.querySelector("#active .toggle-off");
  const popup = document.getElementById("warningPopup");
  const okBtn = document.querySelector(".ok_btn");
  const cancelBtn = document.querySelector(".cancel_btn");

  async function setActive(silent = false) {
    if (!activeBtn) return;
    activeBtn.classList.remove("inactive-state");
    activeBtn.classList.add("active-state");
    if (toggleOn && toggleOff) {
      toggleOn.style.display = "inline";
      toggleOff.style.display = "none";
    }
    localStorage.setItem("activeStatus", "active");
    if (!silent) await setStudentActiveStatus(true);
  }

  function setInactive() {
    if (!activeBtn) return;
    activeBtn.classList.remove("active-state");
    activeBtn.classList.add("inactive-state");
    if (toggleOn && toggleOff) {
      toggleOn.style.display = "none";
      toggleOff.style.display = "inline";
    }
    localStorage.setItem("activeStatus", "inactive");
  }

  // Initialize status
  if (localStorage.getItem("activeStatus") === "inactive") setInactive();
  else setActive(true); // silent initialization

  // Button click logic
  if (activeBtn) {
    activeBtn.addEventListener("click", () => {
      const current = localStorage.getItem("activeStatus");
      if (current === "active") {
        if (popup) {
          popup.classList.add("active");
          popup.style.display = "block";
        }
      } else {
        setActive(); // Will notify backend
      }
    });
  }

  // Popup confirm/cancel logic
  if (okBtn) {
    okBtn.addEventListener("click", async () => {
      setInactive();
      if (popup) {
        popup.classList.remove("active");
        popup.style.display = "none";
      }
      try {
        await removeStudentFromCourse();
      } catch (e) {
        console.error("❌ Error during deletion:", e);
      } finally {
        window.location.reload();
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      if (popup) {
        popup.classList.remove("active");
        popup.style.display = "none";
      }
    });
  }

  /* -------------------------------
     ⚙️ BACKEND HOOKS
  ------------------------------- */
  async function removeStudentFromCourse(studentId) {
    try {
      const res = await fetch(`${API_BASE_URL}/remove_from_all_classes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.status === "success") {
        console.log("✅ Student removed from course");
        return true;
      } else {
        console.warn("⚠️ Failed to remove student:", data.message);
        return false;
      }
    } catch (err) {
      console.error("❌ Error removing student:", err);
      throw err;
    }
  }

  async function setStudentActiveStatus(isActive) {
    try {
      const res = await fetch(`${API_BASE_URL}/set_active?ts=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.status === "success") {
        console.log(`✅ Student status set to ${isActive ? "active" : "inactive"}`);
        return true;
      } else {
        console.warn("⚠️ Failed to update status:", data.message);
        return false;
      }
    } catch (err) {
      console.error("❌ Error setting active status:", err);
      throw err;
    }
  }

  async function updateUserPreferences(theme) {
    try {
      const response = await fetch(`${API_BASE_URL}/theme_change`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ theme }),
      });
      const data = await response.json();
      if (data.status === "success") {
        console.log("✅ Preferences saved:", data.message);
      } else {
        console.warn("⚠️ Failed to save preferences:", data.message);
      }
    } catch (error) {
      console.error("❌ Error updating preferences:", error);
    }
  }

});
