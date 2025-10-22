document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const unitId = params.get("unit_id");

    if (unitId) {
        fetchStudentProgress(unitId);
    } else {
        document.getElementById("studentProgressList").innerHTML = 
            '<p class="error-text">Error: No course specified.</p>';
    }
});

async function fetchStudentProgress(unitId) {
    const listContainer = document.getElementById("studentProgressList");
    try {
        const response = await fetch(`/api/instructor/course/${unitId}/students_progress`, { credentials: "include" });
        const data = await response.json();

        if (response.ok && data.status === "success") {
            renderStudentProgress(data.students);
        } else {
            listContainer.innerHTML = `<p class="error-text">Error: ${data.message}</p>`;
        }
    } catch (error) {
        console.error("Failed to fetch student progress:", error);
        listContainer.innerHTML = `<p class="error-text">An error occurred while fetching data.</p>`;
    }
}

function renderStudentProgress(students) {
    const listContainer = document.getElementById("studentProgressList");
    const template = document.getElementById("studentProgressTemplate");
    listContainer.innerHTML = "";

    if (!students || students.length === 0) {
        listContainer.innerHTML = `<p>No students are enrolled in this course.</p>`;
        return;
    }

    students.forEach(student => {
        const clone = template.content.cloneNode(true);
        const percentage = student.progress;

        clone.querySelector("[data-student-name]").textContent = student.full_name;
        clone.querySelector("[data-progress-bar]").style.width = `${percentage}%`;
        clone.querySelector("[data-progress-text]").textContent = `${percentage}%`;

        listContainer.appendChild(clone);
    });
}