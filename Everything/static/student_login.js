document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const response = await fetch("http://127.0.0.1:5000/logins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email, password }),
      credentials: "include",  // 🔥 VERY IMPORTANT: allows Flask session cookie to be saved
    });

    const data = await response.json();

    if (data.status === "success") {
      // ✅ Apply user preferences before redirect
      if (data.theme === "dark") {
        document.documentElement.classList.add("darkmode");
        localStorage.setItem("darkmode", "active");
      } else {
        document.documentElement.classList.remove("darkmode");
        localStorage.setItem("darkmode", "inactive");
      }

      localStorage.setItem("activeStatus", data.activity);
      localStorage.setItem("fontSize", data.font);
      // ✅ Redirect to the correct dashboard
      window.location.href = data.redirect;
    } else {
      alert("Login failed. Please check your credentials.");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred during login.");
  }
});
