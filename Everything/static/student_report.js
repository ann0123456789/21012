// =====================
// STUDENT REPORT DASHBOARD (Course list + Detail page)
// =====================

// Helper: safely set text
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// =====================
// FETCH FUNCTIONS
// =====================

// Fetch all enrolled courses
async function fetchAllCourses() {
  try {
    const res = await fetch(`http://127.0.0.1:5000/student_report_data`, {
      credentials: "include",
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.status !== "success") throw new Error(json.message || "Bad status");

    const rows = Array.isArray(json.data) ? json.data : [];

    return rows.map((r) => ({
      unit_id: r.Unit_id,
      name: r.Title,
      desc: r.Course_description,
      credit: Number(r.Total_credit) || 0,
      total_lessons: r.total_lessons || 0,
      completed_lessons: r.completed_lessons || 0,
      status: String(r.status || "ongoing"),
    }));
  } catch (err) {
    console.error("Failed to fetch all courses:", err);
    return [];
  }
}

// Update a progress bar element by percentage
function updateProgress(barId, percent) {
  const bar = document.getElementById(barId);
  if (bar) bar.style.width = `${percent}%`;
}

// =====================
// VIEW TOGGLE FUNCTIONALITY
// =====================

function initializeViewToggle() {
  const toggleBtn = document.getElementById("viewToggle");
  const cardView = document.getElementById("cardView");
  const listView = document.getElementById("listView");

  if (!toggleBtn || !cardView || !listView) {
    console.error("Toggle elements not found");
    return;
  }

  toggleBtn.addEventListener("click", () => {
    const isListViewVisible = listView.style.display !== "none";
    
    if (isListViewVisible) {
      // Switch to Grid View
      cardView.style.display = "grid";
      listView.style.display = "none";
      toggleBtn.innerHTML = `<i class="fas fa-list"></i> List View`;
    } else {
      // Switch to List View
      cardView.style.display = "none";
      listView.style.display = "block";
      toggleBtn.innerHTML = `<i class="fas fa-th"></i> Card View`;
    }
  });
}

// =====================
// COURSE RENDERING FUNCTIONS
// =====================

function renderCourseCard(course, template) {
  const clone = template.content.cloneNode(true);
  const card = clone.querySelector(".lesson-card");

  clone.querySelector("[data-course-name]").textContent = course.name;
  clone.querySelector("[data-course-desc]").textContent = course.desc;
  clone.querySelector("[data-course-credit]").textContent = 30;
  
  // Set status badge
  const statusBadge = clone.querySelector("[data-course-status]");
  if (statusBadge) {
    statusBadge.textContent = course.status;
    statusBadge.className = `lesson-status-badge ${course.status}`;
  }

  if (card) {
    card.addEventListener("click", () => {
      if (course.unit_id) {
        window.location.href = `/render_student_report_course?unit_id=${encodeURIComponent(course.unit_id)}`;
      } else {
        console.error("❌ Missing unit_id for course:", course);
      }
    });
  }

  return clone;
}

function renderCourseListItem(course, template) {
  const clone = template.content.cloneNode(true);
  const listItem = clone.querySelector(".lesson-list-item");

  clone.querySelector("[data-course-name]").textContent = course.name;
  clone.querySelector("[data-course-desc]").textContent = course.desc;
  clone.querySelector("[data-course-credit]").textContent = 30;
  
  // Set status badge
  const statusBadge = clone.querySelector("[data-course-status]");
  if (statusBadge) {
    statusBadge.textContent = course.status;
    statusBadge.className = `lesson-status-badge ${course.status}`;
  }

  if (listItem) {
    listItem.addEventListener("click", () => {
      if (course.unit_id) {
        window.location.href = `/render_student_report_course?unit_id=${encodeURIComponent(course.unit_id)}`;
      } else {
        console.error("❌ Missing unit_id for course:", course);
      }
    });
  }

  return clone;
}

// =====================
// 🟩 DASHBOARD RENDER FUNCTION
// =====================
async function renderDashboard() {
  const courses = await fetchAllCourses();
  const cardView = document.getElementById("cardView");
  const listView = document.getElementById("listView");
  const listContainer = document.getElementById("lessonListContainer");
  const cardTemplate = document.getElementById("courseCardTemplate");
  const listTemplate = document.getElementById("courseListTemplate");
  
  if (!cardView || !listView || !listContainer || !cardTemplate || !listTemplate) {
    console.error("Required DOM elements not found");
    return;
  }

  // Clear existing content
  cardView.innerHTML = "";
  listContainer.innerHTML = "";

  // 🟩 --- CREDIT + PROGRESS SUMMARY SECTION ---
  console.log("Courses:", courses);
  const totalRequired = 120;
  let totalLessonsInAllCourses = 0;
  let completedLessonsInAllCourses = 0;

  for (const course of courses) {
    totalLessonsInAllCourses += course.total_lessons;
    completedLessonsInAllCourses += course.completed_lessons;
  }

  const courseCount = courses.length;
  const courseCountEl = document.getElementById("courseCount");
  if (courseCountEl) courseCountEl.textContent = String(courseCount);

  const progressFill = document.getElementById("creditProgress");
  const progressText = document.getElementById("creditText");

  const percent = totalLessonsInAllCourses > 0 ? 
    Math.min((completedLessonsInAllCourses / totalLessonsInAllCourses) * 100, 100) : 0;
  
  if (progressFill) progressFill.style.width = `${percent}%`;
  if (progressText) {
    progressText.textContent = `${completedLessonsInAllCourses} / ${totalLessonsInAllCourses} Lessons (${percent.toFixed(1)}%)`;
  }

  if (progressFill) {
    if (percent < 50) {
      progressFill.style.background = "linear-gradient(90deg, #f44336, #e57373)";
    } else if (percent < 80) {
      progressFill.style.background = "linear-gradient(90deg, #ff9800, #ffb74d)";
    } else {
      progressFill.style.background = "linear-gradient(90deg, #4caf50, #81c784)";
    }
  }

  // 🟩 --- RENDER COURSES IN BOTH VIEWS ---
  courses.forEach((course) => {
    // Render card view
    const cardClone = renderCourseCard(course, cardTemplate);
    cardView.appendChild(cardClone);

    // Render list view
    const listClone = renderCourseListItem(course, listTemplate);
    listContainer.appendChild(listClone);
  });

  // Initialize view toggle after content is rendered
  initializeViewToggle();
}

// =====================
// PAGE INITIALIZATION
// =====================
document.addEventListener("DOMContentLoaded", async () => {
  const path = window.location.pathname;

  if (path.includes("student_report_course")) {
    // You can later hook course detail rendering here
    console.log("📄 Course detail page detected");
  } else if (path.includes("student_report")) {
    // 🟩 Render the dashboard summary + cards
    await renderDashboard();
  }
});