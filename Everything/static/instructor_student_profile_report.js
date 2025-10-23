const API_BASE_URL = "https://edubridge-94lr.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const studentId = params.get("student_id");

    if (studentId) {
        fetchStudentProfile(studentId);
    } else {
        alert("No student ID provided.");
        document.querySelector('.main-content').innerHTML = '<h1>Error: No student specified.</h1>';
    }
});

async function fetchStudentProfile(studentId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/student/profile/${studentId}`, { credentials: "include" });
        const data = await response.json();

        if (response.ok && data.status === "success") {
            populateForm(data.profile);
        } else {
            alert("Error fetching profile: " + data.message);
        }
    } catch (error) {
        console.error("Failed to fetch profile:", error);
        alert("An error occurred while fetching the student's profile.");
    }
}

function populateForm(student) {
    document.getElementById("firstName").value = student.firstName;
    document.getElementById("lastName").value = student.lastName;
    document.getElementById("email").value = student.email;

    const statusBtn = document.getElementById("statusBtn");
    if (student.status === "active") {
        statusBtn.classList.add("active");
        statusBtn.classList.remove("inactive");
        statusBtn.textContent = "Active";
    } else {
        statusBtn.classList.add("inactive");
        statusBtn.classList.remove("active");
        statusBtn.textContent = "Inactive";
    }
}