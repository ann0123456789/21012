async function fetchProfile() {
  try {
    // Use your existing profile API (from Student Profile page)
    const res = await fetch("/api/student/profile", { credentials: "include" });
    const data = await res.json();

    if (data.status !== "success") {
      alert("Error fetching profile: " + (data.message || "Unknown error"));
      return;
    }

    const p = data.profile;
    // Fill the read-only fields
    document.getElementById("title").value = p.title || "";
    document.getElementById("firstName").value = p.firstName || "";
    document.getElementById("lastName").value = p.lastName || "";
    document.getElementById("email").value = p.email || "";
    const passwordEl = document.getElementById("password");
    passwordEl.value = p.password || "";
    passwordEl.type = "text"; // ✅ makes password visible

    document.getElementById("statusBtn").textContent =
      (p.status || "active").toLowerCase() === "active" ? "Active" : "Inactive";

    // Update the button classes to reflect status
    updateStatusButton(
      document.getElementById("statusBtn"),
      (p.status || "active").toLowerCase()
    );

    // Update the header title if present
    const headerEl = document.getElementById("reportStudentTitle");
    if (headerEl) {
      const title = p.title ? p.title + " " : "";
      headerEl.textContent = `${title}${p.firstName || ""} ${p.lastName || ""}`.trim() || "Student Profile Report";
    }
  } catch (err) {
    console.error("Failed to fetch profile:", err);
    alert("An error occurred while fetching your profile.");
  }
}

function populateForm(student) {
    document.getElementById("title").value = student.title || "Ms"; 
    document.getElementById("firstName").value = student.firstName;
    document.getElementById("lastName").value = student.lastName;
    document.getElementById("email").value = student.email;
    document.getElementById("password").value = student.password;
    
    document.getElementById("password").type = "text";

    const statusBtn = document.getElementById("statusBtn");
    updateStatusButton(statusBtn, student.status);
}

document.addEventListener("DOMContentLoaded", () => {
    fetchProfile();
});

function updateStatusButton(btn, status) {
  if (!btn) return;
  if (status === "active") {
    btn.classList.add("active");
    btn.classList.remove("inactive");
    btn.textContent = "Active";
  } else {
    btn.classList.add("inactive");
    btn.classList.remove("active");
    btn.textContent = "Inactive";
  }
}

document.addEventListener("DOMContentLoaded", fetchProfile);
