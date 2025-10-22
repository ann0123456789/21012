const searchInput = document.getElementById("search");
const classroomCardContainer = document.querySelector(
  "[data-classroom-cards-container]",
);
const classroomCardTemplate = document.querySelector("[data-card-template]");
let classrooms = [];

function fetchClassrooms() {
  const urlParams = new URLSearchParams(window.location.search);
  const lessonId = urlParams.get("lesson_id");
  fetch(`/available_classrooms?lesson_id=${lessonId}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.found && Array.isArray(data.results)) {
        classrooms = data.results; 
        renderClassrooms(classrooms); 
      } else {
        classroomCardContainer.innerHTML =
          '<p style="text-align: center; color: red;">No classrooms found.</p>';
      }
    })
    .catch((err) => {
      console.error("Fetch error:", err);
      classroomCardContainer.innerHTML =
        '<p style="text-align: center; color: red;">Failed to load classrooms.</p>';
    });
}

function renderClassrooms(classroomsToRender) {
  classroomCardContainer.innerHTML = "";
  if (classroomsToRender.length === 0) {
    classroomCardContainer.innerHTML =
      '<p style="text-align: center; font-style: italic;">No classrooms found.</p>';
    return;
  }

  classroomsToRender.forEach((classroom) => {
    const cardClone = classroomCardTemplate.content.cloneNode(true);
    const header = cardClone.querySelector("[data-header]");
    const body = cardClone.querySelector("[data-body]");
    const enrollBtn = cardClone.querySelector("[data-enroll-btn]");

    header.textContent = classroom.classroom_name;
    body.textContent = classroom.classroom_id;

    if (classroom.is_active === false){
      enrollBtn.textContent = "Inactive";
      enrollBtn.disabled = true;
    }
    if (classroom.is_enrolled) {
      enrollBtn.textContent = "Unenroll";
      enrollBtn.disabled = false;
      enrollBtn.addEventListener("click", () => handleUnenrollment(classroom.classroom_id, enrollBtn));
    } else {
      enrollBtn.textContent = "Enroll";
      enrollBtn.disabled = false;
      enrollBtn.addEventListener("click", () => handleEnrollment(classroom.classroom_id, enrollBtn));
    }

    classroomCardContainer.appendChild(cardClone);
  });
}

function handleEnrollment(classroomId, button) {
    fetch("/enroll_classroom", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `classroom_id=${encodeURIComponent(classroomId)}`,
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.status === "success") {
        button.textContent = "Enrolled";
        button.disabled = true;
        alert("Successfully enrolled!");
      } else {
        alert(`Enrollment failed: ${data.message}`);
      }
    });
}
function handleUnenrollment(classroomId, button) {
  fetch("/unenroll_classroom", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `classroom_id=${encodeURIComponent(classroomId)}`,
  })
  .then((response) => response.json())
  .then((data) => {
    if (data.status === "success") {
      button.textContent = "Enroll";
      button.onclick = () => handleEnrollment(classroomId, button);
      alert("Successfully unenrolled!");
    } else {
      alert(`Unenrollment failed: ${data.message}`);
    }
  });
}
document.addEventListener("DOMContentLoaded", fetchClassrooms);

searchInput.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filteredClassrooms = classrooms.filter(
    (c) =>
      c.classroom_name.toLowerCase().includes(query) ||
      String(c.classroom_id).includes(query),
  );
  renderClassrooms(filteredClassrooms);
});
