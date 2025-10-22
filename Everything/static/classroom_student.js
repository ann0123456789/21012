document.addEventListener("DOMContentLoaded", async () => {
  const cardContainer = document.querySelector("[data-ins-classroom-cards-container]");
  const cardTemplate = document.querySelector("[data-ins-classroom-card-template]");

  const listContainer = document.querySelector("[data-ins-classroom-list-container]");
  const listTemplate = document.querySelector("[data-classroom-list-item-template]");

  const viewToggleBtn = document.getElementById("viewToggle");
  const cardView = document.getElementById("cardView");
  const listView = document.getElementById("listView");

  // Hide add buttons for students
  const addCardBtn = document.getElementById("addClassroomCard");
  const addListBtn = document.getElementById("addClassroomList");
  if (addCardBtn) addCardBtn.style.display = "none";
  if (addListBtn) addListBtn.style.display = "none";

  // Toggle views
  viewToggleBtn.addEventListener("click", () => {
    if (cardView.style.display === "none") {
      cardView.style.display = "grid";
      listView.style.display = "none";
      viewToggleBtn.innerHTML = '<i class="fas fa-list"></i> List View';
    } else {
      cardView.style.display = "none";
      listView.style.display = "flex";
      viewToggleBtn.innerHTML = '<i class="fas fa-th-large"></i> Card View';
    }
  });

  // Function to handle classroom click
  function onClassroomClick(id, name) {
    window.location.href = `/sidebar_classroom_std_2?classroom_id=${id}`
    // Replace this with navigation or modal to view classroom details
  }

  // Function to create a classroom card/list
  function createClassroom(name, id, unit_id) {
    // Grid card
    const cardClone = cardTemplate.content.cloneNode(true);
    const cardHeader = cardClone.querySelector("[data-ins-header]");
    const cardBody = cardClone.querySelector("[data-ins-body]");
    const deleteBtn = cardClone.querySelector("[data-deleteBtn]");

    cardHeader.textContent = name;
    cardBody.textContent = unit_id;
    if (deleteBtn) deleteBtn.remove();
    const cardElement = cardClone.querySelector(".ins-card").children[0];
    cardElement.style.cursor = "pointer";
    cardElement.addEventListener("click", () => onClassroomClick(id, name));
    cardContainer.appendChild(cardClone);

    // List item
    const listClone = listTemplate.content.cloneNode(true);
    const listHeader = listClone.querySelector("[data-ins-header]");
    const listBody = listClone.querySelector("[data-ins-body]");
    const listDeleteBtn = listClone.querySelector("[data-deleteBtn]");

    listHeader.textContent = name;
    listBody.textContent = unit_id;
    if (listDeleteBtn) listDeleteBtn.remove();
    const listItem = listClone.querySelector("li");
    listItem.style.cursor = "pointer";
    listItem.addEventListener("click", () => onClassroomClick(id, name));
    listContainer.appendChild(listClone);
  }

  // Dummy classroom data (replace with database fetch later)
  async function student_classrooms() {
    try{
      const res = await fetch(`/student_classroom`)
      const data = await res.json()

      if (data.found && data.results.length > 0){
        return data.results;
      } 
    }catch(err){
      console.error("Failed to fetch classrooms",err);
    } 
  }
  const dummyClassrooms = await student_classrooms();

  // Populate classrooms
  dummyClassrooms.forEach(c => createClassroom(c.classroom_name, c.classroom_id, c.unit_id));
});
