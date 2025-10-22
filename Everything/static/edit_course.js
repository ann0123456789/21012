const courseIdInput = document.getElementById("courseId");
const courseNameInput = document.getElementById("courseName");
const courseDescInput = document.getElementById("courseDesc");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");

// Starting course number (replace with last from database)
let lastCourseNumber = 1000;

// Function to generate next ID
function generateCourseId() {
    lastCourseNumber += 1;
    return "FIT" + lastCourseNumber;
}

// Set initial ID
courseIdInput.value = generateCourseId();

// Save button click
saveBtn.onclick = () => {
    const course = {
        id: courseIdInput.value,
        name: courseNameInput.value.trim(),
        description: courseDescInput.value.trim()
    };

    if (!course.name) {
        alert("Please enter course name!");
        return;
    }

    // Save course to backend database
    alert(`Course ${course.name} editted successfully!`);

    // Reset form and generate next ID
    courseIdInput.value = generateCourseId();
    courseNameInput.value = "";
    courseDescInput.value = "";
};

// Cancel button click
cancelBtn.onclick = () => {
    window.location.href = "instructor_page.html"; // go back to instructor page
};
