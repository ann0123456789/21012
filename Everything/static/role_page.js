const studentBtn = document.getElementById("studentBtn");
const instructorBtn = document.getElementById("instructorBtn");

studentBtn.addEventListener("click", () => {
  // Correct path since both HTML files are in the same folder
  window.location.href = "/student_course_management";
});

instructorBtn.addEventListener("click", () => {
  // Correct path since both HTML files are in the same folder
  window.location.href = "/instructor_course_management";
});
