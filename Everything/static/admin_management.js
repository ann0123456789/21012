const API_BASE_URL = "https://edubridge-94lr.onrender.com";

// ===== Sidebar Navigation Highlight =====
document.querySelectorAll(".dashboard-menu a").forEach((link) => {
    link.addEventListener("click", function () {
        document.querySelectorAll(".dashboard-menu a").forEach((el) =>
            el.classList.remove("active")
        );
        this.classList.add("active");
    });
});

// ===== View Toggle (Grid / List) =====
const gridView = document.getElementById("cardView");
const listView = document.getElementById("listView");
const toggleBtn = document.getElementById("viewToggle");

// ===== Modal Elements =====
const modal = document.getElementById("instructorModal");
const closeModal = document.getElementById("closeModal");
const form = document.getElementById("instructorForm");
const modalTitle = document.getElementById("modalTitle");

const addInstructorCard = document.getElementById("addInstructorCard");
const addInstructorList = document.getElementById("addInstructorList");

const cardContainer = document.querySelector("[data-admin-instructor-cards-container]");
const listContainer = document.querySelector("[data-admin-instructor-list-container]");

const cardTemplate = document.querySelector("[data-admin-card-template]");
const listTemplate = document.querySelector("[data-admin-list-item-template]");

let editingInstructor = null;    // keep if you use it elsewhere
let editingId = null;            // <— add: the instructor’s numeric id

let isListView = false;

// ===== Modal Handlers =====
function openModal(isEdit = false, instructorData = null) {
    modal.style.display = "block";
    modalTitle.textContent = isEdit ? "Edit Instructor" : "Add Instructor";

    if (isEdit && instructorData) {
        editingId = instructorData.id;  // remember numeric id
        document.getElementById("name").value = instructorData.name || "";
        document.getElementById("email").value = instructorData.email || "";
        // Prefill password with the current password (since it's stored plaintext)
        document.getElementById("password").value = instructorData.password || "";
    } else {
        editingId = null;
        form.reset();
    }
}



function closeModalFunc() {
    modal.style.display = "none";
    editingInstructor = null;
    editingId = null;     // <— add
}

closeModal.addEventListener("click", closeModalFunc);
window.addEventListener("click", (e) => {
    if (e.target === modal) closeModalFunc();
});

addInstructorCard.addEventListener("click", () => openModal(false));
addInstructorList.addEventListener("click", () => openModal(false));

// ===== Form Submit Handler =====
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value; // prefilled (plain text)

    if (!name || !email) {
        alert("Name and Email are required.");
        return;
    }

    try {
        const isEdit = !!editingId;
        const url = isEdit ? `${API_BASE_URL}/update_ins` : `${API_BASE_URL}/create_ins`;
        const method = isEdit ? "PUT" : "POST";
        const body = isEdit
            ? { ins_id: editingId, ins_name: name, email, password }
            : { ins_name: name, email, password };

        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
        });

        // Try to parse JSON; if it fails, show raw text
        let data;
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
            data = await res.json();
        } else {
            const text = await res.text();
            throw new Error(`Unexpected response (${res.status}): ${text}`);
        }

        if (!res.ok || data.status !== "success") {
            alert(data.message || `Failed (${res.status}).`);
            return;
        }

        await renderInstructors();
        closeModalFunc();

    } catch (err) {
        console.error("Failed to save instructor:", err);
        alert(err.message || "An unexpected error occurred. Please try again.");
    }
});



async function fetch_ins() {
    try {
        const res = await fetch(`${API_BASE_URL}/render_ins`, { credentials: "include" });
        const data = await res.json();
        console.log(data.results)
        if (data.status === "success" && data.results.length > 0) {
            return data.results;
        }
    } catch (err) {
        console.error("Failed to fetch classrooms", err);
    }
}
// ===== Create Instructor Elements =====
function createInstructorElement(instructor, isList) {
    const template = isList ? listTemplate : cardTemplate;
    const clone = template.content.cloneNode(true);
    const element = clone.querySelector(isList ? ".instructor-list-item" : "[data-admin-card]");

    // header = name
    element.querySelector("[data-admin-header]").textContent = `${instructor.name}`;

    // body now shows email and the current password (plain text) — only do this if DB is plain-text
    element.querySelector("[data-admin-body]").textContent = `Email: ${instructor.email}    Password: ${instructor.password || ""}`;

    // Store data (including numeric id) for later editing
    element.dataset.name = instructor.name;
    element.dataset.email = instructor.email;
    element.dataset.password = instructor.password || "";
    element.dataset.id = instructor.id; // <-- important: ensure fetch_ins returns id

    const editBtn = element.querySelector("[data-editBtn]");
    const deleteBtn = element.querySelector("[data-deleteBtn]");

    editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        editingInstructor = element;
        // create an object to pass to modal so it has id, name, email, password
        openModal(true, {
            id: instructor.id,
            name: instructor.name,
            email: instructor.email,
            password: instructor.password || ""
        });
    });

    deleteBtn.addEventListener("click", async () => delete_ins(instructor));

    return element;
}

async function delete_ins(instructor) {
    try {
        fetch(`${API_BASE_URL}/delete_ins`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ins_id: instructor.id }),
            credentials: "include"
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.status === "success") {
                    console.log("it worked")
                    renderInstructors();
                }
            })
    } catch (err) {
        console.error("Failed to fetch classrooms", err);
    }
}
// ===== Render Instructors (show only active view) =====
async function renderInstructors() {
    cardContainer.innerHTML = "";
    listContainer.innerHTML = "";
    instructors = await fetch_ins();

    const activeContainer = isListView ? listContainer : cardContainer;

    if (instructors.length === 0) {
        activeContainer.innerHTML = `<p style="text-align:center;font-style:italic;">No instructors yet.</p>`;
        return;
    }

    instructors.forEach((instructor) => {
        const element = createInstructorElement(instructor, isListView);
        activeContainer.appendChild(element);
    });
}

// ===== Toggle View (syncs grid/list + render) =====
toggleBtn.addEventListener("click", () => {
    isListView = !isListView;

    if (isListView) {
        gridView.style.display = "none";
        listView.style.display = "flex";
        toggleBtn.innerHTML = '<i class="fas fa-th"></i> Card View';
    } else {
        listView.style.display = "none";
        gridView.style.display = "grid";
        toggleBtn.innerHTML = '<i class="fas fa-list"></i> List View';
    }

    renderInstructors(); // Refresh content based on view
});

// ===== Scroll-To-Top Button (Optional) =====
const scrollTopBtn = document.createElement("button");
scrollTopBtn.innerHTML = "↑";
scrollTopBtn.classList.add("scroll-top-btn");
document.body.appendChild(scrollTopBtn);

scrollTopBtn.style.cssText = `
  position: fixed;
  bottom: 30px;
  right: 30px;
  background: var(--primary-light-accent);
  color: white;
  border: none;
  padding: 10px 14px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  box-shadow: var(--shadow-main);
  display: none;
  transition: opacity 0.3s ease;
`;

window.addEventListener("scroll", () => {
    scrollTopBtn.style.display = window.scrollY > 300 ? "block" : "none";
});

scrollTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
});

// ===== Initialize =====
function initializeView() {
    isListView = false;
    gridView.style.display = "grid";   // show grid view first
    listView.style.display = "none";   // hide list view initially
    toggleBtn.innerHTML = '<i class="fas fa-list"></i> List View';
    renderInstructors();
}

document.addEventListener("DOMContentLoaded", initializeView);
