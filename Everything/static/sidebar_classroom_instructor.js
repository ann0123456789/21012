const API_BASE_URL = "https://edubridge-94lr.onrender.com";

// ---------- Fetch helpers ----------
async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Server did not return JSON. Status ${res.status}. Body: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data && data.error ? data.error : `Request failed with ${res.status}`);
  }
  return data;
}

async function fetch_classroom_details(classroomId) {
  if (!classroomId) return null;
  try {
    const data = await fetchJSON(`${API_BASE_URL}/indi_classroom?classroom_id=${encodeURIComponent(classroomId)}`);
    if (data && data.found && Array.isArray(data.results) && data.results.length > 0) {
      return data.results[0];
    }
    return null;
  } catch (err) {
    console.error("Failed to fetch classroom details:", err);
    return null;
  }
}

async function fetch_lessons_in_classroom(classroomId) {
  try {
    const data = await fetchJSON(`${API_BASE_URL}/fetch_classroom_lessons?classroom_id=${encodeURIComponent(classroomId)}`);
    return (data && data.found && Array.isArray(data.results)) ? data.results : [];
  } catch (err) {
    console.error("Failed to get lessons:", err);
    return [];
  }
}

async function fetch_instructors() {
  try {
    const data = await fetchJSON(`${API_BASE_URL}/api/instructors`);
    if (data.ok && Array.isArray(data.instructors)) {
      return data.instructors.map(x => ({
        id: x.id ?? x.Ins_id,
        name: x.name ?? x.Ins_name
      }));
    }
  } catch (e) {
    console.error("Failed to fetch instructors", e);
  }
  return [];
}

async function fetch_units() {
  try {
    const data = await fetchJSON(`${API_BASE_URL}/api/units`);
    return (data && data.ok && Array.isArray(data.units)) ? data.units : [];
  } catch (e) {
    console.error("Failed to fetch units", e);
    return [];
  }
}

// ---------- Main ----------
document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const classID = urlParams.get("classroom_id");

  const classroomNameEl = document.getElementById("classroomName");
  const classroomNameInput = document.getElementById("classroomNameInput");
  const classroomIdEl = document.getElementById("classroomId");
  const supervisorEl = document.getElementById("supervisor");
  const studentListEl = document.getElementById("studentList");
  const durationEl = document.getElementById("duration");
  const unitIdEl = document.getElementById("unitId");

  const cardViewEl = document.getElementById("cardView");
  const listViewEl = document.getElementById("listView");
  const lessonListContainerEl = document.getElementById("lessonListContainer");
  const lessonCardTemplate = document.getElementById("lessonCardTemplate");
  const lessonListTemplate = document.getElementById("lessonListTemplate");

  const viewToggleBtn = document.getElementById("viewToggle");
  const editBtn = document.getElementById("editClassroomBtn");
  const saveBtn = document.getElementById("saveClassroomBtn");
  const cancelBtn = document.getElementById("cancelClassroomBtn");

  function populateSupervisorSelect(options, currentId) {
    if (!supervisorEl) return;
    supervisorEl.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Select Supervisor --";
    supervisorEl.appendChild(placeholder);

    (options || []).forEach(ins => {
      const opt = document.createElement("option");
      opt.value = String(ins.id);
      opt.textContent = ins.name;
      supervisorEl.appendChild(opt);
    });

    if (currentId != null) {
      supervisorEl.value = String(currentId);
    }
  }


  function populateUnitSelect(options, currentUnitId) {
    if (!unitIdEl) return;
    unitIdEl.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Select Unit --";
    unitIdEl.appendChild(placeholder);

    (options || []).forEach(u => {
      const opt = document.createElement("option");
      // API returns {unit_id, title}; show both for clarity
      opt.value = String(u.unit_id);
      opt.textContent = `${u.unit_id} — ${u.title}`;
      unitIdEl.appendChild(opt);
    });

    if (currentUnitId != null) {
      unitIdEl.value = String(currentUnitId);
    }
  }

  function loadClassroom(data) {
    const name = data.classroom_name ?? "";

    if (classroomNameEl) classroomNameEl.textContent = name;
    if (classroomNameInput) classroomNameInput.value = name;
    if (classroomIdEl) classroomIdEl.value = data.classroom_id ?? "";
    if (supervisorEl) supervisorEl.value = data.instructor_id ?? "";
    if (unitIdEl) unitIdEl.value = data.unit_id ?? "";
    if (durationEl) durationEl.value = data.duration || "4 weeks";

    // Students
    if (studentListEl) {
      studentListEl.innerHTML = "";
      if (Array.isArray(data.students) && data.students.length > 0) {
        data.students.forEach(stu => {
          const p = document.createElement("p");

          // handle both API formats: {full_name} OR {First_name, Last_name}
          if (typeof stu === "object") {
            if (stu.full_name) {
              p.textContent = stu.full_name;
            } else {
              p.textContent = `${stu.First_name || ""} ${stu.Last_name || ""}`.trim();
            }
          } else {
            p.textContent = String(stu);
          }

          studentListEl.appendChild(p);
        });
      } else {
        studentListEl.textContent = "No students enrolled.";
      }
    }
  }

  function setEditable(isEditable) {
    [classroomIdEl, supervisorEl, durationEl, unitIdEl].forEach(el => { if (el) el.disabled = !isEditable; });
    if (classroomNameEl) classroomNameEl.style.display = isEditable ? "none" : "block";
    if (classroomNameInput) classroomNameInput.style.display = isEditable ? "block" : "none";
    if (editBtn) editBtn.style.display = isEditable ? "none" : "inline-block";
    if (saveBtn) saveBtn.style.display = isEditable ? "inline-block" : "none";
    if (cancelBtn) cancelBtn.style.display = isEditable ? "inline-block" : "none";

  }

  // ✅ Moved inside so it can use the DOM elements above
  function renderLessons(lessons = []) {
    if (!Array.isArray(lessons)) lessons = [];

    if (cardViewEl) cardViewEl.innerHTML = "";
    if (lessonListContainerEl) lessonListContainerEl.innerHTML = "";

    if (lessons.length === 0) {
      if (cardViewEl) cardViewEl.innerHTML = `<p style="grid-column: 1/-1;">No lessons in this classroom.</p>`;
      if (lessonListContainerEl) lessonListContainerEl.innerHTML = `<li>No lessons in this classroom.</li>`;
      return;
    }

    lessons.forEach(l => {
      // Grid cards
      if (lessonCardTemplate && cardViewEl) {
        const node = lessonCardTemplate.content.cloneNode(true);
        node.querySelector("[data-lesson-header]").textContent = l.title ?? l.name ?? "";
        node.querySelector("[data-lesson-body]").textContent = l.description ?? l.body ?? "";
        node.querySelector("[data-lesson-credit]").textContent = l.credit ?? l.credits ?? "";
        cardViewEl.appendChild(node);
      }
      // List rows
      if (lessonListTemplate && lessonListContainerEl) {
        const row = lessonListTemplate.content.cloneNode(true);
        row.querySelector("[data-lesson-header]").textContent = l.title ?? l.name ?? "";
        row.querySelector("[data-lesson-body]").textContent = l.description ?? l.body ?? "";
        row.querySelector("[data-lesson-credit]").textContent = l.credit ?? l.credits ?? "";
        lessonListContainerEl.appendChild(row);
      }
    });
  }

  // 1) Load both datasets
  const [classroomData, instructorList, unitList] = await Promise.all([
    fetch_classroom_details(classID),
    fetch_instructors(),
    fetch_units()
  ]);

  if (!classroomData) {
    const container = document.getElementById("mainContainer") || document.body;
    const notice = document.createElement("p");
    notice.textContent = "No classroom found.";
    notice.style.color = "red";
    container.prepend(notice);
    return;
  }

  // 2) Build dropdown first, then paint values
  populateSupervisorSelect(instructorList, classroomData.instructor_id);
  populateUnitSelect(unitList, classroomData.unit_id);  // <-- fill unit dropdown
  setEditable(false);
  loadClassroom(classroomData);

  // 3) Fetch & render lessons
  const lessons = await fetch_lessons_in_classroom(classID);
  console.log("Lessons for classroom", classID, lessons); // 👈 debug
  renderLessons(lessons);

  // Default view
  if (cardViewEl) cardViewEl.style.display = "grid";
  if (listViewEl) listViewEl.style.display = "none";

  // Save handler
  if (saveBtn) saveBtn.addEventListener("click", async () => {
    const originalId = classroomData.classroom_id;
    const classroom_id_new = classroomIdEl ? classroomIdEl.value.trim() : originalId;
    const instructor_id = supervisorEl ? supervisorEl.value.trim() : "";
    const classroom_name = classroomNameInput ? classroomNameInput.value.trim() : "";
    const duration = durationEl ? durationEl.value : "";       // <-- add
    const unit_id = unitIdEl ? unitIdEl.value : "";                // <-- NEW


    if (!instructor_id) {
      alert("Please select a supervisor.");
      return;
    }
    if (!classroom_name) {
      alert("Please enter a classroom name.");
      return;
    }
    if (!duration) { alert("Please select a duration."); return; }

    if (!unit_id) { alert("Please select a unit."); return; }        // <-- NEW

    try {
      const payload = {
        classroom_id_new,
        instructor_id: Number(instructor_id),
        classroom_name,
        duration,
        unit_id,
      };

      const data = await fetchJSON(`${API_BASE_URL}/api/classrooms/${encodeURIComponent(originalId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      Object.assign(classroomData, data.classroom);
      loadClassroom(classroomData);
      setEditable(false);

      if (String(originalId) !== String(classroomData.classroom_id)) {
        const u = new URL(window.location.href);
        u.searchParams.set("classroom_id", classroomData.classroom_id);
        window.history.replaceState({}, "", u.toString());
      }

      alert("Classroom updated!");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Error saving classroom: " + err.message);
    }
  });

  if (editBtn) editBtn.addEventListener("click", () => setEditable(true));
  if (cancelBtn) cancelBtn.addEventListener("click", () => { loadClassroom(classroomData); setEditable(false); });

  if (viewToggleBtn) {
    viewToggleBtn.addEventListener("click", () => {
      const isCardVisible = cardViewEl && (cardViewEl.style.display !== "none");
      if (isCardVisible) {
        if (cardViewEl) cardViewEl.style.display = "none";
        if (listViewEl) listViewEl.style.display = "block";
        viewToggleBtn.innerHTML = `<i class="fas fa-th"></i> Card View`;
      } else {
        if (cardViewEl) cardViewEl.style.display = "grid";
        if (listViewEl) listViewEl.style.display = "none";
        viewToggleBtn.innerHTML = `<i class="fas fa-list"></i> List View`;
      }
    });
  }
});