// This is the function from the first code block, it is required for the new code to work.
// You should ensure it is included in your script.
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// This function also comes from the first code block.
async function fetchCourseDetailWithStatus(insId = 1, unitId) {
  if (!unitId) return null;
  const studentId = 1; 

  try {
    const response = await fetch(
      `/fetch_instructor_details?insId=${insId}&unit_id=${unitId}&student_id=${studentId}`
    );
    const data = await response.json();

    if (!data.found || data.results.length === 0) return null;
    return data.results[0]; // single course
  } catch (err) {
    console.error("Failed to fetch course details:", err);
    return null;
  }
}

async function fetchCourseDetail( unitId) {
  if (!unitId) return null;

  try {
    const response = await fetch(`http://127.0.0.1:5000/fetch_course_details?unit_id=${unitId}`);
    console.log(response)
    const data = await response.json();

    if (!data.found || data.results.length === 0) return null;
    return data.results[0]; // single course
  } catch (err) {
    console.error("Failed to fetch course details:", err);
    return null;
  }
}
async function fetch_student_details(unitId){
  if (!unitId) return null;

  try{
    const response = await fetch(`http://127.0.0.1:5000/fetch_students?unit_id=${unitId}`)
    const data = await response.json();
    console.log(data)
    if (!data.found||data.students.length ===0) return null;
    return data.students
  }catch(err){
    console.error("ERRRROORRR",err)
    return null
  }
}

async function get_lessons(unitId){
  try{
    const response = await fetch(`http://127.0.0.1:5000/fetch_lessons_and_students_2?unit_id=${unitId}`)
    const data = await response.json();
    console.log(data.lessons)
    if (!data.found) return null
    return data.lessons
  }catch (err){
    console.log(err)
    return null
  }
}
// The main script for the student-facing course page.
document.addEventListener("DOMContentLoaded", async () => {
  const unitId = getQueryParam("unitId");
  const insId = 1; // or dynamically from session

  const course = await fetchCourseDetail(unitId);
  if (!course) {
    alert("Course not found!");
    return;
  }

  // Populate course info
  document.getElementById("courseTitle").textContent = course.title;
  document.getElementById("unitId").textContent = course.unitId;
  document.getElementById("courseDirector").textContent = course.courseDirector;
  document.getElementById("instructorName").textContent = course.instructorName;

  const statusElem = document.getElementById("courseStatus");
  statusElem.textContent = course.status === "active" ? "Active" : "Not Active";
  statusElem.classList.add(course.status);

  document.getElementById("totalCredit").textContent = 30;
  document.getElementById("activeClassrooms").textContent = course.activeClassrooms || 0;

  // Populate students if available
  const studentListElem = document.getElementById("studentList");
  studentListElem.innerHTML = "";
  student_list = await fetch_student_details(unitId);
  if (student_list && student_list.length > 0) {
    student_list.forEach((student) => {
      const li = document.createElement("li");
      li.textContent = student.name;
      studentListElem.appendChild(li);
    });
  }

  // Populate lessons with status
  const cardContainer = document.getElementById("cardView");
  const listContainer = document.getElementById("lessonListContainer");
  const cardTemplate = document.getElementById("lessonCardTemplate");
  const listTemplate = document.getElementById("lessonListTemplate");

  cardContainer.innerHTML = "";
  listContainer.innerHTML = "";
  const lesson_list = await get_lessons(unitId);
  if (lesson_list &&lesson_list.length > 0) {
    lesson_list.forEach((lesson, index) => {
      const num = lesson_list.length;
      
      // --- Card view ---
      const cardFragment = cardTemplate.content.cloneNode(true);
      const card = cardFragment.children[0];
      
      card.querySelector("[data-lesson-header]").textContent = lesson.name;
      card.querySelector("[data-lesson-body]").textContent = `Lesson ${index + 1}`;
      card.querySelector("[data-lesson-credit]").textContent = 30/num;

      // Add status badge
      const statusBadge = card.querySelector("[data-lesson-status]");
      if (statusBadge) {
        statusBadge.textContent = getStatusText(lesson.status);
        statusBadge.classList.add(lesson.status);
      }

      // Handle lesson click based on status
      if (lesson.status === "locked") {
        card.classList.add("locked");
        card.addEventListener("click", (e) => {
          e.preventDefault();
          showLockedLessonMessage(lesson);
        });
      } else {
        card.addEventListener("click", () => {
          window.location.href = `/lesson_page_student?lesson_id=${lesson.lesson_id}`;
        });
      }

      cardContainer.appendChild(card);

      // --- List view ---
      const listFragment = listTemplate.content.cloneNode(true);
      const listItem = listFragment.children[0];
      
      listItem.querySelector("[data-lesson-header]").textContent = lesson.name;
      listItem.querySelector("[data-lesson-body]").textContent = `Lesson ${index + 1}`;
      listItem.querySelector("[data-lesson-credit]").textContent = 30/num;

      const listStatusBadge = listItem.querySelector("[data-lesson-status]");
      if (listStatusBadge) {
        listStatusBadge.textContent = getStatusText(lesson.status);
        listStatusBadge.classList.add(lesson.status);
      }

      // Handle lesson click based on status
      if (lesson.status === "locked") {
        listItem.classList.add("locked");
        listItem.addEventListener("click", (e) => {
          e.preventDefault();
          showLockedLessonMessage(lesson);
        });
      } else {
        listItem.addEventListener("click", () => {
          window.location.href = `/lesson_page_student?lesson_id=${lesson.lesson_id}`;
        });
      }

      listContainer.appendChild(listItem);
    });
  }

  // Toggle between grid and list view
  const toggleBtn = document.getElementById("viewToggle");
  const cardView = document.getElementById("cardView");
  const listView = document.getElementById("listView");

  toggleBtn.addEventListener("click", () => {
    if (cardView.style.display === "none") {
      cardView.style.display = "grid";
      listView.style.display = "none";
      toggleBtn.innerHTML = `<i class="fas fa-list"></i> List View`;
    } else {
      cardView.style.display = "none";
      listView.style.display = "block";
      toggleBtn.innerHTML = `<i class="fas fa-th"></i> Card View`;
    }
  });
});

function getStatusText(status) {
  switch (status) {
    case "locked":
      return "Locked";
    case "available":
      return "Available";
    case "completed":
      return "Completed";
    default:
      return "Unknown";
  }
}

function showLockedLessonMessage(lesson) {
  const prerequisiteName = lesson.prerequisite_lesson ? lesson.prerequisite_lesson.title : "a prerequisite lesson";
  alert(`This lesson is locked. You must complete "${prerequisiteName}" before accessing this lesson.`);
}
window.addEventListener("pageshow", function(event) { 
if (event.persisted) {
  // Page was restored from bfcache → refetch course data
  window.location.reload(true); // simplest fix (forces reload)
}
});