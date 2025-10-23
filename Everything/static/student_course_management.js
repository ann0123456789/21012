const API_BASE_URL = "https://edubridge-94lr.onrender.com";

const searchInput = document.getElementById("search");
const userCardContainer = document.querySelector(
  "[data-course-cards-container]"
);
const courseCardTemplate = document.querySelector("[data-card-template]");

let courses = [];
let isListView = false;

// --- Progress Elements ---
const progressValue = document.getElementById("progressValue"); // <span>0</span>/120

// --- STUDENT STATUS (read-only display) -----------------
const statusText = document.getElementById("statusText");
let isActive = true; // whether student can enroll/unenroll

async function fetchStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/profile`, { credentials: "include" });
    const data = await res.json();
    if (res.ok && data.status === "success") {
      const status = (data.profile.status || "").toLowerCase();
      isActive = status === "active";
      updateStatusDisplay();
    } else {
      isActive = true;
      updateStatusDisplay();
    }
  } catch (err) {
    console.error("Error fetching status:", err);
    isActive = true;
    updateStatusDisplay();
  }
}

function updateStatusDisplay() {
  if (!statusText) return;
  statusText.textContent = isActive ? "Active" : "Inactive";
  statusText.style.color = isActive ? "green" : "red";
}

/**
 * Updates the progress counter based on all checked courses.
 * Saves state to localStorage.
 */
function updateProgress() {
  let total = 0;
  const checkedCourses = [];

  document.querySelectorAll(".course-checkbox:checked").forEach((checkbox) => {
    const courseEl = checkbox.closest("[data-enroll-card], .course-list-item");
    const creditsElement = courseEl.querySelector(".enroll-credits");
    const unitId = courseEl.dataset.unitId; // unique identifier for saving

    if (creditsElement) {
      const credits = parseInt(
        creditsElement.textContent.replace("Credits: ", ""),
        10
      );
      total += credits;
    }

    if (unitId) {
      checkedCourses.push(unitId);
    }
  });

  const displayTotal = Math.min(total, 120);
  progressValue.textContent = displayTotal;

  // 🔹 Save to localStorage
  localStorage.setItem("selectedCourses", JSON.stringify(checkedCourses));
  localStorage.setItem("progressValue", displayTotal);
}

// --- Course Card and Rendering Logic ---
function createCard(course) {
  const cardClone = courseCardTemplate.content.cloneNode(true);

  const header = cardClone.querySelector("[data-header]");
  const body = cardClone.querySelector("[data-body]");
  const enrollButton = cardClone.querySelector("[data-enrollbtn]");

  header.textContent = course.name;
  body.textContent = course.unit_id;

  enrollButton.textContent = course.is_enrolled ? "Unenroll" : "Enroll";

  enrollButton.addEventListener("click", () => {
    if (course.is_enrolled) {
      unenrolCourse(course.id);
    } else {
      enrolCourse(course.id);
    }
  });

  return cardClone;
}

function refreshAllCourseData() {
  fetchCourses();
  fetchEnrolledCourses();
  console.log("WTFFFFF")
}

function renderCourses(filteredCourses) {
  userCardContainer.innerHTML = "";
  if (filteredCourses.length === 0) {
    userCardContainer.innerHTML =
      '<p style="text-align: center; font-style: italic;">No courses found.</p>';
  } else {
    filteredCourses.forEach((course) => {
      const card = createCard(course);
      userCardContainer.appendChild(card);
    });
  }
}

function unenrolCourse(courseId) {
  if (!isActive) {
    alert("Your account is inactive. You cannot unenroll from courses.");
    return;
  }
  fetch(`${API_BASE_URL}/unenroll`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `course_id=${encodeURIComponent(courseId)}`,
    credentials: "include"
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.status === "success") {
        refreshAllCourseData();
      } else {
        alert("Unenrollment failed: " + (data.message || "Unknown error"));
      }
    })
    .catch((err) => console.error("Error:", err));
}

function enrolCourse(courseId) {
  if (!isActive) {
    alert("Your account is inactive. You cannot enroll in new courses.");
    return;
  }
  fetch(`${API_BASE_URL}/enrollment`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `course_id=${encodeURIComponent(courseId)}`,
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.status === "success") {
        refreshAllCourseData();
      } else {
        alert("Enrollment failed: " + (data.message || "Unknown error"));
      }
    })
    .catch((err) => console.error("Error:", err));
}

/**
 * Renders enrolled courses into either card view or list view.
 * Restores checkbox states from localStorage.
 */
function renderEnrolledCourses(courses) {
  const cardContainer = document.querySelector(
    "[data-enroll-course-cards-container]"
  );
  const listContainer = document.querySelector(
    "[data-enroll-course-list-container]"
  );

  const template = document.querySelector("[data-card-template]");
  const list = document.querySelector("[data-list-item-template]");

  cardContainer.innerHTML = "";
  listContainer.innerHTML = "";

  const activeContainer = isListView ? listContainer : cardContainer;
  const activeTemplate = isListView ? list : template;

  if (!courses || courses.length === 0) {
    activeContainer.innerHTML =
      '<p style="text-align: center; font-style: italic; color: gray;">No enrolled courses found.</p>';
    return;
  }

  courses.forEach((course) => {
    const activeClone = activeTemplate.content.cloneNode(true);
    const courseElement = activeClone.firstElementChild;

    courseElement.dataset.unitId = course.Unit_id;

    const header = activeClone.querySelector("[data-enroll-header]");
    const body = activeClone.querySelector("[data-enroll-body]");

    header.textContent = course.Title;
    body.textContent = course.Unit_id;

    activeContainer.appendChild(activeClone);
  });


  // --- Event delegation for checkboxes ---
  activeContainer.addEventListener("change", function (event) {
    if (event.target.classList.contains("course-checkbox")) {
      updateProgress();
    }
  });

  activeContainer.addEventListener("click", function (event) {
    const clickedElement = event.target.closest("[data-unit-id]");
    if (clickedElement && !event.target.classList.contains("course-checkbox")) {
      const unitId = clickedElement.dataset.unitId;
      window.location.href = `/course_page_student?unitId=${unitId}`;
    }
  });
}

// --- Fetch helpers ---
function fetchCourses(query = "") {
  fetch(`${API_BASE_URL}/courses?q=${encodeURIComponent(query)}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.found && Array.isArray(data.results)) {
        if (query === "") courses = data.results;
        renderCourses(data.results);
      } else {
        userCardContainer.innerHTML =
          '<p style="text-align: center; color: red;">No courses found.</p>';
      }
    })
    .catch((err) => {
      console.error("Fetch error:", err);
      userCardContainer.innerHTML =
        '<p style="text-align: center; color: red;">Failed to load courses.</p>';
    });
}

function fetchEnrolledCourses() {

  fetch(`${API_BASE_URL}/find_enrollment?studentId=${encodeURIComponent(studentId = 1)}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.found) {
        renderEnrolledCourses(data.results);
      } else {
        renderEnrolledCourses([]);
      }
    })
    .catch((err) => console.error("Fetch error:", err));
}



// --- Init ---
document.addEventListener("DOMContentLoaded", function () {
  fetchStatus(); // 🔹 Load current student status (Active/Inactive)
  refreshAllCourseData();

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      fetchCourses(e.target.value);
    });
  }

  const viewToggle = document.getElementById("viewToggle");
  const cardView = document.getElementById("cardView");
  const listView = document.getElementById("listView");
  const addCourseCard = document.getElementById("addCourseCard");
  const addCourseList = document.getElementById("addCourseList");

  if (viewToggle) {
    viewToggle.addEventListener("click", function () {
      isListView = !isListView;
      if (isListView) {
        if (cardView) cardView.style.display = "none";
        if (listView) listView.style.display = "flex";
        viewToggle.innerHTML = '<i class="fas fa-th-large"></i> Card View';
      } else {
        if (cardView) cardView.style.display = "grid";
        if (listView) listView.style.display = "none";
        viewToggle.innerHTML = '<i class="fas fa-list"></i> List View';
      }
      fetchEnrolledCourses();
    });
  }

  const handleEnrollClick = () => {
    if (!isActive) {
      alert("Your account is inactive. Activate your profile to enroll/unenroll.");
      return;
    }
    const popup = window.open(`/enrol_popup`, "Enrollment", "width=500,height=400");

    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        refreshAllCourseData();
      }
    }, 500);
  };

  if (addCourseCard) addCourseCard.addEventListener("click", handleEnrollClick);
  if (addCourseList) addCourseList.addEventListener("click", handleEnrollClick);

  const menuItems = document.querySelectorAll(".dashboard-menu a");
  menuItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      if (this.getAttribute("href") === "#") {
        e.preventDefault();
      }
      menuItems.forEach((i) => i.classList.remove("active"));
      this.classList.add("active");
    });
  });
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      // Page was restored from bfcache → refetch course data
      window.location.reload(true); // simplest fix (forces reload)
    }
  });
});
