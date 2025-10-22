document.getElementById('toggleButton').addEventListener('click', function() {
  const popup = document.getElementById('warningPopup');
  popup.classList.toggle('active'); // show/hide popup
});

function removeStudentFromCourse(studentId, courseId) {}

// Close popup on OK or Cancel
document.querySelector('.ok_btn').addEventListener('click', () => {
  document.getElementById('warningPopup').classList.remove('active');
});
document.querySelector('.cancel_btn').addEventListener('click', () => {
  document.getElementById('warningPopup').classList.remove('active');
});
