const API_BASE_URL = "https://edubridge-94lr.onrender.com";

function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

async function fetchCourseDetail(unitId) {
  if (!unitId) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/fetch_course_details?unit_id=${unitId}`);
    console.log(response)
    const data = await response.json();

    if (!data.found || data.results.length === 0) return null;
    return data.results[0]; // single course
  } catch (err) {
    console.error("Failed to fetch course details:", err);
    return null;
  }
}

async function fetch_student_details(unitId) {
  if (!unitId) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/fetch_students?unit_id=${unitId}`)
    const data = await response.json();
    console.log(data)
    if (!data.found || data.students.length === 0) return null;
    return data.students
  } catch (err) {
    console.error("ERRRROORRR", err)
    return null
  }
}

async function fetchCourseDetailWithStats(insId = 1, unitId) {
  if (!unitId) return null;

  try {
    const response = await fetch(
      `${API_BASE_URL}/fetch_instructor_details?insId=${insId}&unit_id=${unitId}`
    );
    const data = await response.json();

    if (!data.found || data.results.length === 0) return null;

    // For each lesson, get completion statistics
    const course = data.results[0];
    if (course.lessons) {
      for (let lesson of course.lessons) {
        try {
          const statsResponse = await fetch(`${API_BASE_URL}/api/lessons/${lesson.lesson_id}/completion-stats`);
          const stats = await statsResponse.json();
          if (stats.ok) {
            lesson.completionStats = stats.stats;
          }
        } catch (err) {
          console.error("Failed to fetch lesson stats:", err);
        }
      }
    }

    return course;
  } catch (err) {
    console.error("Failed to fetch course details:", err);
    return null;
  }
}

async function deleteLesson(lessonId, lessonElement) {
  if (!confirm("Are you sure you want to delete this lesson? This action cannot be undone.")) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/lessons/${lessonId}`, { method: "DELETE" });
    const data = await response.json();

    if (data.ok) {
      lessonElement.remove();
      alert("Lesson deleted successfully.");
    } else {
      alert("Failed to delete lesson: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    console.error("Error deleting lesson:", err);
    alert("An error occurred while deleting the lesson.");
  }
}

async function get_lessons(unitId) {
  try {
    const response = await fetch(`${API_BASE_URL}/fetch_lessons_and_students?unit_id=${unitId}`)
    const data = await response.json();
    console.log(data.lessons)
    if (!data.found) return null
    return data.lessons
  } catch (err) {
    console.log(err)
    return null
  }
}
document.addEventListener("DOMContentLoaded", async () => {
  const unitId = getQueryParam("unitId");

  const course = await fetchCourseDetail(unitId);
  if (!course) {
    alert("Course not found!");
    return;
  }

  // Populate course info
  document.getElementById("courseTitle").textContent = course.title;
  document.getElementById("unitId").textContent = course.unitId;
  document.getElementById("courseDirector").textContent = course.courseDirector;

  const statusElem = document.getElementById("courseStatus");
  statusElem.textContent = course.status === "active" ? "Active" : "Not Active";
  statusElem.classList.add(course.status);

  document.getElementById("totalCredit").textContent = 30;
  document.getElementById("activeClassrooms").textContent =
    course.activeClassrooms || 0;

  // Populate students if available
  const studentListElem = document.getElementById("studentList");
  studentListElem.innerHTML = ""; // clear existing
  const student_list = await fetch_student_details(unitId); // assuming this returns the students list
  console.log("HAPPENS")
  console.log("Student List:", student_list);
  // Check if there are students in the li  st
  if (student_list && student_list.length > 0) {
    student_list.forEach((student) => {
      const li = document.createElement("li");
      li.textContent = student.name; // Assuming the student object has a 'name' property
      studentListElem.appendChild(li);
    });
  }

  // Populate lessons if available
  const cardContainer = document.getElementById("cardView");
  const listContainer = document.getElementById("lessonListContainer");

  const cardTemplate = document.getElementById("lessonCardTemplate");
  const listTemplate = document.getElementById("lessonListTemplate");
  const addCardTemplate = document.getElementById("addLessonCardTemplate");
  const addListTemplate = document.getElementById("addLessonListTemplate");

  cardContainer.innerHTML = "";
  listContainer.innerHTML = "";
  const lessons_list = await get_lessons(unitId);
  console.log(lessons_list);
  if (lessons_list && lessons_list.length > 0) {
    lessons_list.forEach((lesson, index) => {
      const num = lessons_list.length;
      // --- Card view ---
      const cardFragment = cardTemplate.content.cloneNode(true);
      const card = cardFragment.children[0];
      card.querySelector("[data-lesson-header]").textContent = `Lesson ${index + 1
        }`;
      card.querySelector("[data-lesson-body]").textContent = lesson.name;
      card.querySelector("[data-lesson-credit]").textContent =
        30 / num;

      const deleteBtnCard = card.querySelector(".delete-lesson-btn");
      deleteBtnCard.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteLesson(lesson.lesson_id, card);
      });

      card.addEventListener("click", () => {
        window.location.href = `/lesson_page_instructor?lesson_id=${lesson.lesson_id}`;
      });
      cardContainer.appendChild(card);

      // --- List view --- 
      const listFragment = listTemplate.content.cloneNode(true);
      const listItem = listFragment.children[0];
      listItem.querySelector("[data-lesson-header]").textContent = `Lesson ${index + 1
        }`;
      listItem.querySelector("[data-lesson-body]").textContent = lesson.name;
      listItem.querySelector("[data-lesson-credit]").textContent =
        30 / num;

      const deleteBtnList = listItem.querySelector(".delete-lesson-btn");
      deleteBtnList.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteLesson(lesson.lesson_id, listItem);
      });

      listItem.addEventListener("click", () => {
        window.location.href = `/lesson_page_instructor?lesson_id=${lesson.lesson_id}`;
      });
      listContainer.appendChild(listItem);
    });
  }

  // Add new lesson card
  const addCardItem = addCardTemplate.content.cloneNode(true).children[0];
  addCardItem.addEventListener("click", async function () {
    try {
      const formData = new FormData();
      formData.append("unit_id", course.unitId);

      const response = await fetch(`${API_BASE_URL}/create_lesson_ins`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (response.ok && data.lesson_id) {
        // Redirect to the new lesson page
        window.location.href = `/lesson_page_instructor?lesson_id=${data.lesson_id}`;
      } else {
        alert("Failed to create lesson: " + (data.error || data.message));
      }
    } catch (err) {
      console.error("Error creating lesson:", err);
      alert("Error creating lesson");
    }
  });
  cardContainer.appendChild(addCardItem);

  // Add new lesson list
  const addListItem = addListTemplate.content.cloneNode(true).children[0];

  addListItem.addEventListener("click", async function () {
    try {
      const formData = new FormData();
      formData.append("unit_id", course.unitId);

      const response = await fetch(`${API_BASE_URL}/create_lesson_ins`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (response.ok && data.lesson_id) {
        // Redirect to the new lesson page
        window.location.href = `/lesson_page_instructor?lesson_id=${data.lesson_id}`;
      } else {
        alert("Failed to create lesson: " + (data.error || data.message));
      }
    } catch (err) {
      console.error("Error creating lesson:", err);
      alert("Error creating lesson");
    }
  });
  listContainer.appendChild(addListItem);

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

  window.addEventListener("pageshow", async (event) => {
    if (event.persisted) {
      // Page was restored from bfcache → refetch course data
      location.reload(); // simplest fix (forces reload)
    }
  });

});
