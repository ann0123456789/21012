const courseIdInput = document.getElementById("courseId");
const courseNameInput = document.getElementById("courseName");
const courseDescInput = document.getElementById("courseDesc");
const courseDirectorInput = document.getElementById("courseDirector");
const courseCreditsInput = document.getElementById("courseCredits");
const courseStatusInput = document.getElementById("courseStatus");

const createBtn = document.getElementById("createBtn");
const cancelBtn = document.getElementById("cancelBtn");

// Create button click
createBtn.onclick = async () => {
  const course = {
    unit_id: courseIdInput.value.trim(),
    title: courseNameInput.value.trim(),
    description: courseDescInput.value.trim(),
    director: courseDirectorInput.value.trim(),
    status: courseStatusInput.value.trim(),
  };

  if (!course.unit_id || !course.title) {
    alert("Please enter course ID and name!");
    return;
  }

  try {
    const response = await fetch("/create", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(course),
    });

    const result = await response.json();

    if (result.status !== "success") {
      alert("Error: " + (result.message || "Failed to create course"));
      return;
    } else {
      // Reset form
      courseIdInput.value = "";
      courseNameInput.value = "";
      courseDescInput.value = "";
      courseDirectorInput.value = "";
      courseCreditsInput.value = "";
      courseStatusInput.value = "";

      window.location.href = "/instructor_course_management";
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred while creating the course.");
  }
};

// Cancel button click
cancelBtn.onclick = () => {
  window.location.href = "/instructor_course_management";
};
