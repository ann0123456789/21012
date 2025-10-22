document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");

  form.addEventListener("submit", async function (e) {
    e.preventDefault(); 

    // Get form values
    const title = form.title.value;
    const firstName = form.firstName.value.trim();
    const lastName = form.lastName.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const status = form.status.value;

    // Simple email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validation checks
    if (!title || !firstName || !lastName || !email || !password || !status) {
      alert("Please fill in all fields.");
      return;
    }

    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      alert("Password must be at least 8 characters long.");
      return;
    }

    try {
      const response = await fetch("/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(new FormData(form)),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Sign up successful! You will now be redirected to the login page.");
        window.location.href = data.redirect;
      } else {
        alert("Sign up failed: " + (data.message || "An unknown server error occurred."));
      }
    } catch (error) {
      console.error("Error during sign up:", error);
      alert("An error occurred. Please try again.");
    }
  });
});
