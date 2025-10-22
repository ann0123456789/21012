document.addEventListener("DOMContentLoaded", () => {
    fetchInstructorCourses();
    
    const toggleBtn = document.getElementById("viewToggle");
    const cardView = document.getElementById("cardView");
    const listView = document.getElementById("listView");

    // Toggle views when the button is clicked
    toggleBtn.addEventListener("click", () => {
        if (cardView.style.display === "none") {
            cardView.style.display = "grid";  // Show card view
            listView.style.display = "none";  // Hide list view
            toggleBtn.innerHTML = `<i class="fas fa-list"></i> List View`;
        } else {
            cardView.style.display = "none";  // Hide card view
            listView.style.display = "block";  // Show list view
            toggleBtn.innerHTML = `<i class="fas fa-th"></i> Card View`;
        }
    });
});

async function fetchInstructorCourses() {
    const gridContainer = document.getElementById("cardView"); 
    const listContainer = document.getElementById("listView");  // Separate list container
    if (!gridContainer || !listContainer) {
        console.error("Required elements 'cardView' or 'listView' not found.");
        return;
    }

    try {
        const response = await fetch(`/instructor_courses`, { credentials: "include" });
        const data = await response.json();

        if (response.ok && data.found) {
            renderCourseCards(data.results);
        } else {
            gridContainer.innerHTML = `<p class="error-text">Error: ${data.message || 'Could not fetch courses.'}</p>`;
            listContainer.innerHTML = `<p class="error-text">Error: ${data.message || 'Could not fetch courses.'}</p>`;
        }
    } catch (error) {
        console.error("Failed to fetch courses:", error);
        gridContainer.innerHTML = `<p class="error-text">An error occurred while fetching courses.</p>`;
        listContainer.innerHTML = `<p class="error-text">An error occurred while fetching courses.</p>`;
    }
}

function renderCourseCards(courses) {
    const gridContainer = document.getElementById("cardView"); 
    const listContainer = document.getElementById("listView");
    const cardTemplate = document.getElementById("courseCardTemplate"); 
    const listTemplate = document.getElementById("courseListTemplate");

    if (!gridContainer || !cardTemplate || !listContainer || !listTemplate) {
        console.error("Required elements 'cardView', 'courseCardTemplate', or 'courseListTemplate' not found.");
        return;
    }

    gridContainer.innerHTML = "";  // Clear existing content in the grid view
    listContainer.innerHTML = "";  // Clear existing content in the list view

    if (!courses || courses.length === 0) {
        gridContainer.innerHTML = `<p>You have not created any courses.</p>`;
        return;
    }

    const credit_per_lesson = 30;

    courses.forEach(course => {
        // --- Card View ---
        const cardClone = cardTemplate.content.cloneNode(true);
        const cardElement = cardClone.querySelector(".lesson-card");

        cardClone.querySelector("[data-course-name]").textContent = course.name;
        cardClone.querySelector("[data-course-desc]").textContent = course.unit_id;
        
        const creditEl = cardClone.querySelector("[data-course-credit]");
        if (creditEl) creditEl.textContent = credit_per_lesson;
        
        cardElement.addEventListener('click', () => {
            window.location.href = `/render_ins_report_course_students?unit_id=${course.unit_id}`;
        });

        gridContainer.appendChild(cardClone);  // Add card to the grid container

        // --- List View ---
        const listClone = listTemplate.content.cloneNode(true);
        const listElement = listClone.querySelector(".lesson-list-item");

        listElement.querySelector("[data-course-name]").textContent = course.name;
        listElement.querySelector("[data-course-desc]").textContent = course.unit_id;
        
        const listCreditEl = listElement.querySelector("[data-course-credit]");
        if (listCreditEl) listCreditEl.textContent = credit_per_lesson;

        listElement.addEventListener('click', () => {
            window.location.href = `/render_ins_report_course_students?unit_id=${course.unit_id}`;
        });

        listContainer.appendChild(listClone);  // Add list item to the list container
    });
}
