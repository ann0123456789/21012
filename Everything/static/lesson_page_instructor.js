
(function () {
  const $ = (id) => document.getElementById(id);

  const urlParams = new URLSearchParams(window.location.search);
  const lessonId = urlParams.get("lesson_id");

  if (!lessonId) {
    console.error("Missing ?lesson_id=...");
    return;
  }

  let lesson = {
    assignments: [],
    reading_list: []
  };

  let availablePrerequisites = [];
  let currentPrerequisite = null;

  // Escape HTML for safe rendering
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Load instructors for the dropdown, and pre-select current
  async function loadInstructors(selectedId) {
    try {
      const res = await fetch("/api/instructors");
      const data = await res.json();
      if (!data.ok) return;

      const sel = $("designer");
      sel.innerHTML = "";
      data.instructors.forEach(ins => {
        const opt = document.createElement("option");
        opt.value = String(ins.id);
        opt.textContent = ins.name;
        if (selectedId != null && String(ins.id) === String(selectedId)) {
          opt.selected = true;
        }
        sel.appendChild(opt);
      });
    } catch (e) {
      console.error("Error loading instructors:", e);
    }
  }

  // Load available prerequisite lessons
  async function loadPrerequisites(lessonId) {
    try {
      const res = await fetch(`/api/lessons/${lessonId}/prerequisites`);
      const data = await res.json();
      
      if (!data.ok) {
        console.error("Failed to load prerequisites:", data.error);
        return;
      }

      availablePrerequisites = data.available_lessons || [];
      currentPrerequisite = data.current_prerequisite;
      
      populatePrerequisiteDropdown();
    } catch (e) {
      console.error("Error loading prerequisites:", e);
    }
  }

  // Populate the prerequisite dropdown
  function populatePrerequisiteDropdown() {
    const sel = $("prerequisiteSelect");
    if (!sel) return;

    sel.innerHTML = "";
  
    const noneOption = document.createElement("option");
    noneOption.value = "";
    noneOption.textContent = "None (No prerequisite)";
    sel.appendChild(noneOption);

    availablePrerequisites.forEach(lesson => {
      const option = document.createElement("option");
      option.value = String(lesson.lesson_id);
      option.textContent = `${lesson.title} (ID: ${lesson.lesson_id})`;
      sel.appendChild(option);
    });

    if (currentPrerequisite) {
      sel.value = String(currentPrerequisite);
    }
  }

  async function savePrerequisite() {
    const sel = $("prerequisiteSelect");
    if (!sel) return;

    const prerequisiteId = sel.value || null;
    
    try {
      const res = await fetch(`/api/lessons/${lessonId}/prerequisites`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prerequisite_lesson_id: prerequisiteId })
      });
      
      const data = await res.json();
      if (data.ok) {
        console.log("Prerequisite updated successfully");
        currentPrerequisite = prerequisiteId;
        updatePrerequisiteDisplay();
      } else {
        alert("Failed to update prerequisite: " + (data.error || "Unknown error"));
        // Revert selection
        sel.value = currentPrerequisite || "";
      }
    } catch (err) {
      console.error("Error saving prerequisite:", err);
      alert("Error saving prerequisite");
      sel.value = currentPrerequisite || "";
    }
  }

  function updatePrerequisiteDisplay() {
    const display = $("prerequisiteDisplay");
    if (!display) return;

    if (currentPrerequisite) {
      const prereqLesson = availablePrerequisites.find(l => 
        String(l.lesson_id) === String(currentPrerequisite)
      );
      if (prereqLesson) {
        display.textContent = `${prereqLesson.title} (ID: ${prereqLesson.lesson_id})`;
        display.style.color = "#1a3b38";
      } else {
        display.textContent = `Lesson ID: ${currentPrerequisite}`;
        display.style.color = "#666";
      }
    } else {
      display.textContent = "None";
      display.style.color = "#666";
    }
  }

  // --- Fetch lesson details ---
  async function fetchLessonDetails(lessonId) {
    try {
      const res = await fetch(`/get_lesson_details?lesson_id=${lessonId}`);
      const data = await res.json();
      if (data.status === "success" && data.lessons.length > 0) {
        const detail = data.lessons[0];
        $("lessonId").textContent     = detail.lesson_id;
        $("lessonTitle").value        = detail.title;
        $("estimatedTime").value      = detail.estimated_time;
        $("objective").value          = detail.objective;
        $("description").value        = detail.description;
        $("designer").value           = detail.instructor;
        $("dateCreated").textContent  = detail.date_created;
        $("lastUpdated").textContent  = detail.last_updated;

        // Handle prerequisite data
        currentPrerequisite = detail.prerequisite_lesson_id;
        updatePrerequisiteDisplay();

        // Populate designer dropdown
        await loadInstructors(detail.designer_id);
        
        // Load prerequisites after we have lesson details
        await loadPrerequisites(lessonId);

        setEditable(false);
      }  
    } catch (err) {
      console.error("Error fetching lesson:", err);
    }
  }

  // --- Lock/unlock fields ---
  function setEditable(enabled) {
    ["lessonTitle","objective","description","designer","estimatedTime"].forEach(id=>{
      const el = $(id);
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        el.readOnly = !enabled;
        el.disabled = !enabled;
      }
    });
    
    // Handle designer select
    const designerSel = $("designer");
    if (designerSel) designerSel.disabled = !enabled;

    // Handle prerequisite elements
    const prereqSelect = $("prerequisiteSelect");
    const prereqDisplay = $("prerequisiteDisplay");
    
    if (enabled) {
      // Edit mode: show dropdown, hide display
      if (prereqSelect) prereqSelect.style.display = "block";
      if (prereqDisplay) prereqDisplay.style.display = "none";
    } else {
      // View mode: hide dropdown, show display
      if (prereqSelect) prereqSelect.style.display = "none";
      if (prereqDisplay) prereqDisplay.style.display = "block";
    }
  }

  // --- Save lesson ---
  async function saveLesson() {
    const payload = {
      title: $("lessonTitle").value,
      objective: $("objective").value,
      description: $("description").value,
      instructor: $("designer").value,
      estimated_time: $("estimatedTime").value,
      designer_id: $("designer").value ? parseInt($("designer").value, 10) : null
    };

    try {
      // Save lesson details first
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.ok) {
        // Save prerequisite
        await savePrerequisite();
        
        alert("✅ Lesson updated!");
        setEditable(false);
        $("editLessonBtn").style.display = "inline-block";
        $("saveLessonBtn").style.display = "none";
        $("cancelLessonBtn").style.display = "none";
        await fetchLessonDetails(lessonId);
      } else {
        alert("❌ Update failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Error saving lesson.");
    }
  }

  // --- Fetch lesson materials ---
  async function fetchLessonMaterials(lessonId) {
    try {
      const assignmentsRes = await fetch(`/assignment_get?lesson_id=${lessonId}`);
      lesson.assignments = assignmentsRes.ok ? await assignmentsRes.json() : [];

      const readingsRes = await fetch(`/reading_get?lesson_id=${lessonId}`);
      lesson.reading_list = readingsRes.ok ? await readingsRes.json() : [];
    } catch (err) {
      console.error("Error fetching materials:", err);
      lesson.assignments = [];
      lesson.reading_list = [];
    }
  }

  // --- Render assignment/reading lists ---
  function renderList(containerId, list, type) {
    const container = $(containerId);
    if (!container) return;

    container.innerHTML = '';
    list.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="item-title">${escapeHtml(item.title)}</span>
        <div class="item-actions">
          <button class="edit-item" data-type="${type}" data-id="${item.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="delete-item" data-type="${type}" data-id="${item.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      container.appendChild(li);
    });

    // Add event listeners for edit/delete
    container.querySelectorAll(".edit-item").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const newTitle = prompt("Enter new title:", list.find(i => String(i.id) === String(id)).title);
        if (!newTitle) return;

        try {
          const res = await fetch("/edit_material", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, title: newTitle })
          });
          const data = await res.json();
          if (data.status === "success") {
            list.find(i => String(i.id) === String(id)).title = newTitle;
            renderList(containerId, list, type);
          } else {
            alert("Error editing item: " + data.message);
          }
        } catch (err) {
          console.error("Error editing item:", err);
        }
      });
    });

    container.querySelectorAll(".delete-item").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!confirm("Are you sure you want to delete this item?")) return;

        try {
          const res = await fetch("/delete_material", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
          });
          const data = await res.json();
          if (data.status === "success") {
            const index = list.findIndex(i => String(i.id) === String(id));
            if (index > -1) list.splice(index, 1);
            renderList(containerId, list, type);
          } else {
            alert("Error deleting item: " + data.message);
          }
        } catch (err) {
          console.error("Error deleting item:", err);
        }
      });
    });
  }

  // --- Generic add function for both assignments and readings ---
  async function addNewItem(inputId, list, type) {
    const input = $(inputId);
    if (!input) return;
    const title = input.value.trim();
    if (!title) return;

    const endpoint = type === "assignment" ? "/add_assignment" : "/add_reading";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: lessonId, title })
      });
      const data = await res.json();
      if (data.status === "success") {
        list.push(type === "assignment" ? data.assignment : data.reading);
        renderList(type === "assignment" ? "assignmentsList" : "readingList", list, type);
        input.value = '';
      } else {
        alert("Error adding item: " + data.message);
      }
    } catch (err) {
      console.error("Error adding item:", err);
    }
  }

  async function fetch_classroom() {
    try{
      const res = await fetch(`/classrooms?lesson_id=${lessonId}`);
      console.log(lessonId)
      const data = await res.json();

      if (data.found && data.results.length > 0){
        return data.results;
      }
    }catch(err){
      console.error("Failed to fetch classrooms",err);
    }
  }
  async function addLessonToClassroom(classroomName, lessonId) {
    try {
      const response = await fetch('/add_lesson_to_classroom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classroom_name: classroomName,
          lesson_id: lessonId
        })
      });

      const result = await response.json();

      if (response.ok) {
        console.log('Success:', result.message);
        if (result.status === 'success') {
          alert(result.message);
        }
        return result;
      } else {
        console.error('Error:', result.message);
        alert(`Error: ${result.message}`);
        return null;
      }
    } catch (error) {
      console.error('Network Error:', error);
      alert('Network error. Please try again.');
      return null;
    }
  }
  
  // --- Initialize page ---
  async function initPage() {
    const classroomBox = document.getElementById("classroomBox");
    const classroomDropdown = document.getElementById("classroomDropdown");
    const classrooms = await fetch_classroom();

    const classroomsList = classrooms || [];
    console.log(classroomsList)
    classroomsList.forEach(c => {
      const li = document.createElement("li");
      li.textContent = c.classroom_name;
      li.dataset.id = c.classroom_id;

      li.addEventListener("click", () => {
        classroomBox.querySelector("span").textContent = c.classroom_name;
        addLessonToClassroom(c.classroom_name, lessonId);
      });

      classroomDropdown.appendChild(li);
    });

    // Toggle dropdown
    classroomBox.addEventListener("click", () => {
      classroomDropdown.style.display = classroomDropdown.style.display === "block" ? "none" : "block";
    });

    // Close dropdown if clicked outside
    document.addEventListener("click", (e) => {
      if (!classroomBox.contains(e.target) && !classroomDropdown.contains(e.target)) {
        classroomDropdown.style.display = "none";
      }
    });

    await fetchLessonDetails(lessonId);
    await fetchLessonMaterials(lessonId);

    renderList("assignmentsList", lesson.assignments, "assignment");
    renderList("readingList", lesson.reading_list, "reading");

    const addAssignmentBtn = $("addAssignmentBtn");
    const addReadingBtn = $("addReadingBtn");

    if (addAssignmentBtn) addAssignmentBtn.addEventListener('click', () => addNewItem("newAssignmentInput", lesson.assignments, "assignment"));
    if (addReadingBtn) addReadingBtn.addEventListener('click', () => addNewItem("newReadingInput", lesson.reading_list, "reading"));

    $("editLessonBtn").addEventListener("click", () => {
      setEditable(true);
      $("editLessonBtn").style.display = "none";
      $("saveLessonBtn").style.display = "inline-block";
      $("cancelLessonBtn").style.display = "inline-block";
    });

    $("cancelLessonBtn").addEventListener("click", async () => {
      await fetchLessonDetails(lessonId);
      $("editLessonBtn").style.display = "inline-block";
      $("saveLessonBtn").style.display = "none";
      $("cancelLessonBtn").style.display = "none";
    });

    $("saveLessonBtn").addEventListener("click", saveLesson);
  }

  document.addEventListener("DOMContentLoaded", initPage);
})();