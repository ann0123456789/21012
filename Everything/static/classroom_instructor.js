async function fetchClassroom() {
  try{
    const res = await fetch('/classrooms');
    const data = await res.json();

    if (data.found && data.results.length > 0){
      return data.results;
    }
  }catch(err){
    console.error("Failed to fetch classrooms",err);
  }
}

async function createClassroom2(){
  try{
    const res = await fetch('/create_classrooms',{
      method : 'POST',
      headers : {"Content-Type" : "application/json"},
      body : JSON.stringify({})
    });
    const data = await res.json();
    console.log("Create Classroom response", data)

    if (data.status == "success"){
      return data
    }else{
      alert("Error")
    }
  }catch(err){
    console.error("Failed to fetch classrooms",err);
  }
}

document.addEventListener("DOMContentLoaded", async() => {
  const classrooms = await fetchClassroom()
  const addCardBtn = document.getElementById("addClassroomCard");
  const cardContainer = document.querySelector("[data-ins-classroom-cards-container]");
  const cardTemplate = document.querySelector("[data-ins-classroom-card-template]");

  const addListBtn = document.getElementById("addClassroomList");
  const listContainer = document.querySelector("[data-ins-classroom-list-container]");
  const listTemplate = document.querySelector("[data-classroom-list-item-template]");

  const viewToggleBtn = document.getElementById("viewToggle");
  const cardView = document.getElementById("cardView");
  const listView = document.getElementById("listView");

  let classroomCounter = 1; // global counter for consistent IDs

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

  // Function to delete classroom from both views
  async function deleteClassroom(id, cardElement, listItemElement) {
    try{
      if (cardElement) cardElement.remove();
      if (listItemElement) listItemElement.remove();
      const res = await fetch(`/del_classrooms/${id}`,{
        method : "DELETE",
        headers : {"Content-Type": "application/json"},
      })

      if (res.ok){
        console.log("Deleted")
      }else{
        console.log("Error Deleting")
        alert("Failed to delete classroom from the server. Please refresh.");
      }
    }catch(err){
      console.error("Failed to delete classroom")
    }
  }

  // Function to create a new classroom
  function createClassroom(name,id,unit_id) {
    // Grid card
    const cardFragment = cardTemplate.content.cloneNode(true);
    const cardElement = cardFragment.children[0];
    cardElement.querySelector("[data-ins-header]").textContent = name;
    cardElement.querySelector("[data-ins-body]").textContent = unit_id;

    const listFragment = listTemplate.content.cloneNode(true);
    const listItemElement = listFragment.children[0];
    listItemElement.querySelector("[data-ins-header]").textContent = name;
    listItemElement.querySelector("[data-ins-body]").textContent = unit_id;

    cardElement.querySelector("[data-deleteBtn]").addEventListener("click", async (e) => {
      e.stopPropagation();
      await deleteClassroom(id, cardElement, listItemElement);
    });
    console.log("DEBUG: id =", id, "unit_id =", unit_id);
    cardElement.addEventListener("click", () =>{
      window.location.href = `/sidebar_classroom_ins_2?classroom_id=${id}&unit_id=${unit_id}`;
    });

    listItemElement.querySelector("[data-deleteBtn]").addEventListener("click", async(e) => {
      e.stopPropagation();
      await deleteClassroom(id, cardElement, listItemElement);
    });

    listItemElement.addEventListener("click", () => {
      window.location.href = `/sidebar_classroom_ins_2?classroom_id=${id}&unit_id=${unit_id}`;
    });

    cardContainer.appendChild(cardElement);
    listContainer.appendChild(listItemElement);
  }


  if (classrooms && classrooms.length > 0) {
    classrooms.forEach((c) => {
      console.log(c.classroom_name, c.classroom_id, c.unit_id);
      createClassroom(c.classroom_name, c.classroom_id, c.unit_id);
    });
  }

  addCardBtn.addEventListener("click", async ()=>{
    const res = await createClassroom2();
    if (res && res.status == "success"){
      createClassroom(res.details.classroom_name,res.details.classroom_id,res.details.unit_id);
    }
  })

  addListBtn.addEventListener("click", async ()=>{
    const res = await createClassroom2();
    if (res && res.status == "success"){
      createClassroom(res.details.classroom_name,res.details.classroom_id,res.details.unit_id);
    }
  })

  window.addEventListener("pageshow", async (event) => {
  if (event.persisted) {
    // Page was restored from bfcache → refetch course data
    location.reload(); // simplest fix (forces reload)
  }
  })
})
