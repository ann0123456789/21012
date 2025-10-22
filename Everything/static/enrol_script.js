const searchInput = document.getElementById("search"); // Fixed: must match HTML
const userCardContainer = document.querySelector(
  "[data-course-cards-container]",
);
const courseCardTemplate = document.querySelector("[data-card-template]");
let courses = [];

// Render a single course card
function createCard(course) {
  const card = courseCardTemplate.content.cloneNode(true);
  card.querySelector("[data-header]").textContent = course.name;
  card.querySelector("[data-body]").textContent = course.id;
  return card;
}

// Render all courses (or filtered ones)
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

// Fetch courses from backend
function fetchCourses(query = "") {
  fetch(`/courses?q=${encodeURIComponent(query)}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.found && Array.isArray(data.results)) {
        if (query === "") courses = data.results; // store full list
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

// Initial load
document.addEventListener("DOMContentLoaded", () => fetchCourses());

// Live search
searchInput.addEventListener("input", (e) => {
  fetchCourses(e.target.value);
});
