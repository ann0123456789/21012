// ---------- Fetch helpers ----------
async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const ct = res.headers.get("content-type") || "";
  const isJSON = ct.includes("application/json");
  const body = isJSON ? await res.json() : await res.text();
  if (!res.ok) throw new Error(isJSON ? (body.error || JSON.stringify(body)) : body);
  return body;
}

async function fetchClassroomDetails(classroomId) {
  if (!classroomId) return null;
  const data = await fetchJSON(`/indi_classroom?classroom_id=${encodeURIComponent(classroomId)}`);
  return (data && data.found && Array.isArray(data.results) && data.results[0]) || null;
}

async function fetchLessonsInClassroom(classroomId) {
  const data = await fetchJSON(`/fetch_classroom_lessons?classroom_id=${encodeURIComponent(classroomId)}`);
  return (data && data.found && Array.isArray(data.results)) ? data.results : [];
}

function renderLessons(lessons, cardViewEl, listContainerEl, cardTpl, listTpl) {
  cardViewEl.innerHTML = "";
  listContainerEl.innerHTML = "";

  if (!lessons.length) {
    cardViewEl.innerHTML = `<p style="grid-column:1/-1;">No lessons in this classroom.</p>`;
    listContainerEl.innerHTML = `<li>No lessons in this classroom.</li>`;
    return;
  }

  lessons.forEach(l => {
    const title = l.title ?? l.name ?? "";
    const body  = l.description ?? `Lesson ID: ${l.lesson_id}`;
    const credit = l.credit ?? l.credits ?? "";

    // Card
    const c = cardTpl.content.cloneNode(true);
    c.querySelector("[data-lesson-header]").textContent = title;
    c.querySelector("[data-lesson-body]").textContent   = body;
    c.querySelector("[data-lesson-credit]").textContent = credit;
    cardViewEl.appendChild(c);

    // List
    const r = listTpl.content.cloneNode(true);
    r.querySelector("[data-lesson-header]").textContent = title;
    r.querySelector("[data-lesson-body]").textContent   = body;
    r.querySelector("[data-lesson-credit]").textContent = credit;
    listContainerEl.appendChild(r);
  });
}

// ---------- Main ----------
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(location.search);
  const classID = params.get("classroom_id");

  const classroomNameEl = document.getElementById("classroomName");
  const classroomIdBox  = document.getElementById("classroomIdBox");
  const supervisorBox   = document.getElementById("supervisorNameBox");
  const studentListEl   = document.getElementById("studentList");
  const durationBox     = document.getElementById("durationBox");

  const cardViewEl = document.getElementById("cardView");
  const listViewEl = document.getElementById("listView");
  const lessonListContainerEl = document.getElementById("lessonListContainer");
  const lessonCardTemplate = document.getElementById("lessonCardTemplate");
  const lessonListTemplate = document.getElementById("lessonListTemplate");
  const viewToggleBtn = document.getElementById("viewToggle");

  try {
    const [cls, lessons] = await Promise.all([
      fetchClassroomDetails(classID),
      fetchLessonsInClassroom(classID)
    ]);

    if (!cls) {
      classroomNameEl.textContent = "Classroom not found";
      return;
    }

    // Basic info
    classroomNameEl.textContent = cls.classroom_name || "";
    classroomIdBox.textContent  = cls.classroom_id ?? "";
    supervisorBox.textContent   = cls.instructor_name || cls.instructor_id || ""; 
    durationBox.textContent     = cls.duration || "";

    // Students
    studentListEl.innerHTML = "";
    if (Array.isArray(cls.students) && cls.students.length) {
      cls.students.forEach(s => {
        const p = document.createElement("p");
        p.textContent = s.full_name || `${s.First_name || ""} ${s.Last_name || ""}`.trim();
        studentListEl.appendChild(p);
      });
    } else {
      studentListEl.textContent = "No students enrolled.";
    }

    // Lessons
    renderLessons(lessons, cardViewEl, lessonListContainerEl, lessonCardTemplate, lessonListTemplate);
    cardViewEl.style.display = "grid";
    listViewEl.style.display = "none";

    // Toggle
    viewToggleBtn.addEventListener("click", () => {
      if (cardViewEl.style.display !== "none") {
        cardViewEl.style.display = "none";
        listViewEl.style.display = "block";
        viewToggleBtn.innerHTML = '<i class="fas fa-th"></i> Card View';
      } else {
        cardViewEl.style.display = "grid";
        listViewEl.style.display = "none";
        viewToggleBtn.innerHTML = '<i class="fas fa-list"></i> List View';
      }
    });
  } catch (e) {
    console.error(e);
    alert("Failed to load classroom.");
  }
});
