const API_BASE_URL = "https://edubridge-94lr.onrender.com";


(function () {
  const $ = id => document.getElementById(id);

  const urlParams = new URLSearchParams(window.location.search);
  const lessonId = urlParams.get("lesson_id");

  let lesson = {
    assignments: [],
    reading_list: []
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderClassrooms(classrooms) {
    const grid = document.querySelector(".courses-grid");
    if (!grid) return;
    grid.innerHTML = ""; // clear old content

    classrooms.forEach(c => {
      const card = document.createElement("div");
      card.className = "course-card";

      const code = document.createElement("div");
      code.className = "course-code";
      code.textContent = c.classroom_code ?? `ID: ${c.classroom_id}`;

      const name = document.createElement("div");
      name.className = "course-name";
      name.textContent = c.classroom_name;
      card.addEventListener("click", () => onClassroomClick(c.classroom_id, c.classroom_name));

      card.appendChild(code);
      card.appendChild(name);
      grid.appendChild(card);
    });

    // Re-add the Enroll button at the end
    const enrollBtn = document.createElement("div");
    enrollBtn.id = "enrollClassroomBtn";
    enrollBtn.className = "add-course";
    enrollBtn.style.cursor = "pointer";
    enrollBtn.innerHTML = `
      <div class="add-icon"><i class="fas fa-plus-circle"></i></div>
      <div class="add-text">Enroll in Classroom</div>
    `;
    enrollBtn.addEventListener("click", () => {
      console.log(lessonId)
      const popup = window.open(
        `/classroom_enrol_popup?lesson_id=${lessonId}`,
        "ClassroomEnrollment",
        "width=800,height=600"
      );
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          refreshAllData();
        }
      }, 500);
    });
    grid.appendChild(enrollBtn);
  }

  async function fetchClassrooms() {
    try {
      const res = await fetch(`${API_BASE_URL}/get_enrolled_classrooms`);
      const data = await res.json();
      if (data.status === "success") {
        renderClassrooms(data.classrooms);
      } else {
        console.error("Error fetching classrooms:", data.message);
      }
    } catch (err) {
      console.error("Network error:", err);
    }
  }

  function onClassroomClick(id, name) {
    window.location.href = `/sidebar_classroom_std_2?classroom_id=${id}`
  }

  // Check lesson status and display appropriate UI
  async function checkLessonStatus() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/lessons/status/${lessonId}`);
      const data = await res.json();

      if (data.ok) {
        updateLessonStatus(data);
      }
    } catch (err) {
      console.error("Error checking lesson status:", err);
    }
  }

  // Update UI based on lesson status
  function updateLessonStatus(statusData) {
    const statusIndicator = document.getElementById("lessonStatusIndicator");
    const lessonContent = document.querySelector(".main-content");

    // Remove any existing status classes
    lessonContent.classList.remove("lesson-locked", "lesson-available", "lesson-completed");

    if (statusData.locked) {
      // Lesson is locked
      lessonContent.classList.add("lesson-locked");

      if (!statusIndicator) {
        createStatusIndicator();
      }

      const indicator = document.getElementById("lessonStatusIndicator");
      indicator.className = "status-indicator locked";
      indicator.innerHTML = `
        <i class="fas fa-lock"></i>
        <div class="status-content">
          <h3>Lesson Locked</h3>
          <p>You must complete "${statusData.prerequisite_lesson.title}" before accessing this lesson.</p>
          <button onclick="goToPrerequisite(${statusData.prerequisite_lesson.id})" class="btn prerequisite-btn">
            Go to Prerequisite Lesson
          </button>
        </div>
      `;

      // Disable lesson content
      disableLessonContent();

    } else if (statusData.completed) {
      // Lesson is completed
      lessonContent.classList.add("lesson-completed");

      if (!statusIndicator) {
        createStatusIndicator();
      }

      const indicator = document.getElementById("lessonStatusIndicator");
      indicator.className = "status-indicator completed";
      indicator.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <div class="status-content">
          <h3>Lesson Completed</h3>
          <p>You have successfully completed this lesson!</p>
        </div>
      `;

    } else {
      // Lesson is available
      lessonContent.classList.add("lesson-available");

      if (statusIndicator) {
        statusIndicator.remove();
      }
    }
  }

  // Create status indicator element
  function createStatusIndicator() {
    const indicator = document.createElement("div");
    indicator.id = "lessonStatusIndicator";
    indicator.className = "status-indicator";

    const mainContent = document.querySelector(".main-content");
    const header = mainContent.querySelector("header");
    header.insertAdjacentElement("afterend", indicator);
  }

  // Disable lesson content when locked
  function disableLessonContent() {
    // Disable all form elements
    const formElements = document.querySelectorAll("input, textarea, select, button");
    formElements.forEach(el => {
      if (!el.classList.contains("prerequisite-btn")) {
        el.disabled = true;
      }
    });

    // Add overlay to sections
    const sections = document.querySelectorAll(".assignments-section, .reading-list-section");
    sections.forEach(section => {
      section.style.opacity = "0.5";
      section.style.pointerEvents = "none";
    });
  }

  // Navigate to prerequisite lesson
  window.goToPrerequisite = function (prerequisiteLessonId) {
    window.location.href = `/lesson_page_student?lesson_id=${prerequisiteLessonId}`;
  };

  async function fetchLessonDetails() {
    try {
      const res = await fetch(`${API_BASE_URL}/get_lesson_details?lesson_id=${lessonId}`);
      const data = await res.json();
      if (data.status === "success" && data.lessons.length > 0) {
        lesson = data.lessons[0];

        $("lessonId").textContent = lesson.lesson_id;
        $("lessonTitle").textContent = lesson.title;
        $("estimatedTime").value = lesson.estimated_time;
        $("objective").value = lesson.objective;
        $("description").value = lesson.description;
        $("designer").value = lesson.instructor;
        $("dateCreated").textContent = lesson.date_created;
        $("lastUpdated").textContent = lesson.last_updated;

        // Disable all form fields for students
        [$("objective"), $("description"), $("designer"), $("estimatedTime")].forEach(f => f.disabled = true);

        // Display prerequisite information if exists
        displayPrerequisiteInfo(lesson);

        const enrollClassroomBtn = $("enrollClassroomBtn");
        if (enrollClassroomBtn) {
          enrollClassroomBtn.addEventListener("click", () => {
            window.open(
              `/classroom_enrol_popup?unitId=${lesson.unit_id}`,
              "ClassroomEnrollment",
              "width=800,height=600"
            );
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  function displayPrerequisiteInfo(lessonData) {
    const prerequisiteInfo = document.getElementById("prerequisiteInfo");

    if (lessonData.prerequisite_lesson) {
      if (!prerequisiteInfo) {
        createPrerequisiteInfoElement();
      }

      const info = document.getElementById("prerequisiteInfo");
      info.innerHTML = `
        <div class="prerequisite-info-content">
          <i class="fas fa-info-circle"></i>
          <span>Prerequisite: ${lessonData.prerequisite_title || lessonData.prerequisite_lesson.title}</span>
          <button onclick="goToPrerequisite(${lessonData.prerequisite_lesson.id})" class="btn-link">
            View Prerequisite
          </button>
        </div>
      `;
    } else if (prerequisiteInfo) {
      prerequisiteInfo.remove();
    }
  }

  function createPrerequisiteInfoElement() {
    const info = document.createElement("div");
    info.id = "prerequisiteInfo";
    info.className = "prerequisite-info";

    const lessonInfo = document.querySelector(".lesson-info");
    lessonInfo.insertAdjacentElement("beforebegin", info);
  }

  async function fetchLessonMaterials() {
    try {
      const assignRes = await fetch(`${API_BASE_URL}/assignment_get?lesson_id=${lessonId}`);
      lesson.assignments = assignRes.ok ? await assignRes.json() : [];

      const readRes = await fetch(`${API_BASE_URL}/reading_get?lesson_id=${lessonId}`);
      lesson.reading_list = readRes.ok ? await readRes.json() : [];
    } catch (err) {
      console.error(err);
      lesson.assignments = [];
      lesson.reading_list = [];
    }
  }

  function renderList(containerId, list) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = '';

    list.forEach(item => {
      const li = document.createElement("li");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `${containerId}-${item.id}`;
      checkbox.checked = item.completed;

      const label = document.createElement("label");
      label.htmlFor = checkbox.id;
      label.textContent = item.title ?? "Untitled";
      if (item.completed) label.classList.add("completed");

      checkbox.addEventListener("change", async e => {
        checkbox.disabled = true;
        try {
          const res = await fetch(`${API_BASE_URL}/update_material_completion`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.id, completed: e.target.checked })
          });
          if (res.ok) {
            item.completed = e.target.checked;
            label.classList.toggle("completed", item.completed);

            if (checkAllCompleted()) {
              setTimeout(() => {
                checkLessonStatus();
              }, 500);
            }
          } else {
            e.target.checked = item.completed;
          }
        } catch (err) {
          console.error(err);
          e.target.checked = item.completed;
        }
        checkbox.disabled = false;
      });

      li.appendChild(checkbox);
      li.appendChild(label);
      container.appendChild(li);
    });
  }

  function checkAllCompleted() {
    const allMaterials = [...lesson.assignments, ...lesson.reading_list];
    return allMaterials.length > 0 && allMaterials.every(item => item.completed);
  }

  function renderAssignments() {
    renderList("assignmentsList", lesson.assignments);
  }

  function renderReadingList() {
    renderList("readingList", lesson.reading_list);
  }

  async function initPage() {
    if (!lessonId) return console.error("No lesson_id in URL");

    await fetchLessonDetails();
    await fetchLessonMaterials();
    await fetchClassrooms();

    renderAssignments();
    renderReadingList();

    await checkLessonStatus();
  }
  function refreshAllData() {
    // Refresh the lesson materials and assignments
    fetchLessonMaterials()
      .then(() => {
        renderAssignments();
        renderReadingList();
      })
      .catch(err => console.error("Error refreshing lesson materials:", err));

    // Refresh the classrooms
    fetchClassrooms()
      .catch(err => console.error("Error refreshing classrooms:", err));

    // Refresh the lesson status
    checkLessonStatus()
      .catch(err => console.error("Error refreshing lesson status:", err));
  }



  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      // Page was restored from bfcache → refetch course data
      window.location.reload(true); // simplest fix (forces reload)
    }
  });
  document.addEventListener("DOMContentLoaded", initPage);
})();
