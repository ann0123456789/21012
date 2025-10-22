document.addEventListener("DOMContentLoaded", () => {
    fetchEnrolledStudents();
});

async function fetchEnrolledStudents() {
    const gridContainer = document.getElementById("studentCardGrid");
    try {
        const response = await fetch("/api/instructor/enrolled_students", { credentials: "include" });
        const data = await response.json();

        if (response.ok && data.status === "success") {
            renderStudentCards(data.students);
        } else {
            gridContainer.innerHTML = `<p class="error-text">Error: ${data.message}</p>`;
        }
    } catch (error) {
        console.error("Failed to fetch students:", error);
        gridContainer.innerHTML = `<p class="error-text">An error occurred while fetching the student list.</p>`;
    }
}

function renderStudentCards(students) {
    const gridContainer = document.getElementById("studentCardGrid");
    gridContainer.innerHTML = ""; 

    if (!students || students.length === 0) {
        gridContainer.innerHTML = `<p>No students are enrolled in your courses.</p>`;
        return;
    }

    students.forEach(student => {
        const card = document.createElement("a");
        card.className = "student-card";
        card.href = `/instructor/student_profile_report?student_id=${student.Student_id}`;
        card.textContent = `${student.First_name} ${student.Last_name}`;
        gridContainer.appendChild(card);
    });
}
