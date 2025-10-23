const API_BASE_URL = "https://edubridge-94lr.onrender.com";

// =====================
// Helper Functions
// =====================
const urlParams = new URLSearchParams(window.location.search);
const lessonId = urlParams.get("unit_id");

/**
 * Safely sets text content for an element.
 * @param {string} id - Element ID.
 * @param {string|number} text - Text content to set.
 */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Fetches student report data from the backend.
 * Returns an array of course objects.
 */
async function fetchStudentData() {
  try {
    const res = await fetch(`${API_BASE_URL}/student_report_data`, {
      credentials: "include",
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (json.status !== "success") {
      throw new Error(json.message || "Bad status");
    }

    const rows = Array.isArray(json.data) ? json.data : [];

    // ✅ Return just an array of course objects
    return rows.map((r) => ({
      unit_id: r.Unit_id, // ✅ include this field
      name: r.Title,
      completed_lessons: r.completed_lessons,
      completed_assignments: r.completed_assignments,
      completed_readings: r.completed_reading,
      total_assignments: r.total_assignments,
      total_readings: r.total_reading,
    }));
  } catch (err) {
    console.error("Failed to fetch student data:", err);
    return [];
  }
}

/**
 * Updates a progress bar element by percentage.
 * @param {string} barId - ID of the progress bar fill element.
 * @param {number} percent - Progress percentage.
 */
function updateProgress(barId, percent) {
  const bar = document.getElementById(barId);
  if (bar) bar.style.width = `${percent}%`;
}

// =====================
// Main Report Update
// =====================

/**
 * Renders the progress and statistics for a single course.
 * @param {Object} data - Course data.
 */
async function renderCourseReport(data) {
  if (!data) return console.error("No course data available.");

  // === Basic info ===
  setText("courseName", data.name);
  setText("courseId", data.unit_id || "N/A");
  setText("studentName", await student_name() || "Student");

  // === Overall Progress ===
  const overallDone = (data.completed_assignments || 0) + (data.completed_readings || 0);
  const overallTotal = (data.total_assignments || 0) + (data.total_readings || 0);
  const overallPercent = overallTotal > 0 ? ((overallDone / overallTotal) * 100).toFixed(1) : 0;

  updateProgress("overallProgress", overallPercent);
  setText("overallText", `${overallDone} / ${overallTotal} (${overallPercent}%)`);

  // === Assignments ===
  const assignmentPercent =
    data.total_assignments > 0
      ? ((data.completed_assignments / data.total_assignments) * 100).toFixed(1)
      : 0;

  updateProgress("assignmentProgress", assignmentPercent);
  setText(
    "assignmentText",
    `${data.completed_assignments} / ${data.total_assignments} (${assignmentPercent}%)`
  );
  setText("totalAssignments", data.total_assignments);
  setText("completedAssignments", data.completed_assignments);

  // === Reading List ===
  const readingPercent =
    data.total_readings > 0
      ? ((data.completed_readings / data.total_readings) * 100).toFixed(1)
      : 0;

  updateProgress("readingProgress", readingPercent);
  setText(
    "readingText",
    `${data.completed_readings} / ${data.total_readings} (${readingPercent}%)`
  );
  setText("totalReading", data.total_readings);
  setText("completedReading", data.completed_readings);
}

// =====================
// Run
// =====================
async function student_name() {
  try {
    const data = await fetch(`${API_BASE_URL}/student_name`, {
      credentials: "include"
    });

    const res = await data.json();
    if (res.status === "success") {
      console.log(data.student_name)
      return res.student_name
    }
  } catch {
    console.log("Error getting student name")
    return null
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const unitID = urlParams.get("unit_id");
  console.log("URL unit_id:", unitID);

  if (!unitID) {
    console.error("❌ No unit_id found in URL!");
    return;
  }

  data = await fetchStudentData(unitID);

  let index
  for (let i = 0; i < data.length; i++) {
    if (data[i].unit_id === unitID) {
      index = i;
      break;
    }
  }

  console.log(index)
  console.log(data)
  renderCourseReport(data[index]);
});
