const API_BASE_URL = "https://edubridge-94lr.onrender.com";

document.addEventListener("DOMContentLoaded", async () => {
  const smallBtn = document.querySelector(".small-button");
  const mediumBtn = document.querySelector(".medium-button");
  const largeBtn = document.querySelector(".large-button");
  const sizeButtons = [smallBtn, mediumBtn, largeBtn];

  // --- Load font preference (from DB or localStorage) ---
  const dbFont = await getUserPreferences(); // ✅ must await
  const savedSize = dbFont || localStorage.getItem("fontSize") || "medium";

  applyFontSize(savedSize);
  highlightButton(savedSize);

  // --- Apply font class ---
  function applyFontSize(size) {
    document.documentElement.classList.remove("small", "big");
    if (size === "small") document.documentElement.classList.add("small");
    if (size === "big") document.documentElement.classList.add("big");
  }

  // --- Highlight active button ---
  function highlightButton(size) {
    sizeButtons.forEach((btn) => btn?.classList.remove("active"));
    if (size === "small") smallBtn?.classList.add("active");
    if (size === "medium") mediumBtn?.classList.add("active");
    if (size === "big") largeBtn?.classList.add("active");
  }

  // --- Update local + server ---
  async function updateUserPreferences(font) {
    localStorage.setItem("fontSize", font);
    applyFontSize(font);
    highlightButton(font);

    try {
      const response = await fetch(`${API_BASE_URL}/font_change`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ font }),
        credentials: "include",
      });

      const data = await response.json();
      if (data.status === "success") {
        console.log("✅ Font preference saved:", data.message);
      } else {
        console.warn("⚠️ Failed to save font preference:", data.message);
      }
    } catch (error) {
      console.error("❌ Error updating preferences:", error);
    }
  }

  // --- Fetch DB preference ---
  async function getUserPreferences() {
    try {
      const response = await fetch(`${API_BASE_URL}/get_font`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ✅ send session cookie
      });

      if (!response.ok) {
        console.warn(`⚠️ Failed to fetch preferences: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (data.status === "success" && data.font) {
        console.log("✅ Loaded font preference:", data.font);
        return data.font;
      } else {
        console.warn("⚠️ No font preference found:", data.message);
        return null;
      }
    } catch (error) {
      console.error("❌ Error fetching preferences:", error);
      return null;
    }
  }

  // --- Event listeners ---
  if (smallBtn && mediumBtn && largeBtn) {
    smallBtn.addEventListener("click", () => updateUserPreferences("small"));
    mediumBtn.addEventListener("click", () => updateUserPreferences("medium"));
    largeBtn.addEventListener("click", () => updateUserPreferences("big"));
  } else {
    console.warn("⚠️ Font buttons not found.");
  }
});
