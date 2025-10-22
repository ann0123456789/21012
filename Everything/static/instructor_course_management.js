const userCardContainer = document.querySelector(
  "[data-ins-course-cards-container]"
);
const insCourseCardTemplate = document.querySelector(
  "[data-ins-card-template]"
);

let courses = [];
let isListView = false;

/**
 * Creates a single course card element.
 * @param {object} course - The course data object.
 * @returns {Node} The created course card element.
 */
function createCard(course) {
  const card = insCourseCardTemplate.content.cloneNode(true);
  const cardDiv = card.querySelector(".ins-card");
  const deleteButton = card.querySelector("[data-deletebtn]");

  deleteButton.addEventListener("click", () => {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete course ${course.name}?`)) {
      deleCourse(course.unit_id, 1); // Assuming insId is 1 for now
    }
  });
  card.querySelector("[data-ins-header]").textContent = course.name;
  card.querySelector("[data-ins-body]").textContent = course.unit_id;

}

function deleCourse(unitId, insId = 1) {
  fetch("/delete_course", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded", // Use form encoding for request.form in Flask
    },
    body: `unit_id=${encodeURIComponent(unitId)}&ins_id=${encodeURIComponent(insId)}`,

  })
    .then((response) => response.json())
    .then((data) => {
      if (data.status === "success") {
        courses = courses.filter(
          (c) => c.unit_id !== unitId
        );
        renderCourses(courses); // Re-render the available courses

      } else {
        alert("Deletion failed: " + (data.message || "Unknown error"));
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

/**
 * Renders a list of courses in the main container.
 * @param {Array<object>} filteredCourses - The list of courses to render.
 */
  function renderCourses(filteredCourses) {
    const cardContainer = document.querySelector("[data-ins-course-cards-container]");
    const listContainer = document.querySelector("[data-ins-course-list-container]");

    cardContainer.innerHTML = "";
    listContainer.innerHTML = "";

    const cardTemplate = document.querySelector("[data-ins-card-template]");
    const listTemplate = document.querySelector("[data-list-item-template]");

    const activeContainer = isListView ? listContainer : cardContainer;
    const activeTemplate = isListView ? listTemplate : cardTemplate;

    if (filteredCourses.length === 0) {
      activeContainer.innerHTML =
        '<p style="text-align: center; font-style: italic;">No courses found.</p>';
    } else {
      filteredCourses.forEach((course) => {
        const activeClone = activeTemplate.content.cloneNode(true);
        const courseElement = activeClone.firstElementChild; // Assuming the first child is the main element

        // Set the unit_id on the element using a data attribute
        courseElement.dataset.unitId = course.unit_id;

        const header = activeClone.querySelector('[data-ins-header]');
        const body = activeClone.querySelector('[data-ins-body]');
        const deleteButton = activeClone.querySelector("[data-deletebtn]");

        deleteButton.addEventListener("click", (event) => {
          event.stopPropagation();
          if (confirm(`Are you sure you want to delete course ${course.name}?`)) {
            deleCourse(course.unit_id, 1);
          }
        });

        header.textContent = course.name;
        body.textContent = course.unit_id;

        activeContainer.appendChild(activeClone);
      });

      // 🚨 THE FIX: Use event delegation on the parent container
      activeContainer.addEventListener("click", function(event) {
        const clickedElement = event.target.closest('[data-unit-id]');
        if (clickedElement) {
          const unitId = clickedElement.dataset.unitId;
          window.location.href = `/course_page_instructor?unitId=${unitId}`;
        }
      });
    }
  }
/**
 * Fetches all instructor courses from the backend.
 */
function fetchCourses() {
  fetch(`/instructor_courses`)
    .then((res) => res.json())
    .then((data) => {
      if (data.found && Array.isArray(data.results)) {
        courses = data.results;
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

// --- Combined Event Listeners ---
document.addEventListener("DOMContentLoaded", function () {
  // Initial load of courses
  fetchCourses();

  // View toggle functionality
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

      fetchCourses();
    });
  }

  if (addCourseCard) {
    addCourseCard.addEventListener("click", () => {
      window.location.href = "/create_course";
    });
  }
  if (addCourseList) {
    addCourseList.addEventListener("click", () => {
      window.location.href = "/create_course";
    });
  }

  // Dashboard menu functionality
  const menuItems = document.querySelectorAll(".dashboard-menu a");
  menuItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      const href = this.getAttribute("href")
      if (href === '#'){
        e.preventDefault()
      }
      menuItems.forEach((i) => i.classList.remove("active"));
      this.classList.add("active");
    });
  });
});
