// Student-specific navigation functions
function navigateToPerformanceReports() {
    window.location.href = '/student_report_profile'; 
    console.log('Navigating to Student Performance Reports');
}

function navigateToProgressReports() {
    window.location.href = '/student_report_navigation';
    console.log('Navigating to Student Performance Reports');
}

// Student-specific card interactions
document.addEventListener('DOMContentLoaded', function() {
    const reportCards = document.querySelectorAll('.report-card');
    
    reportCards.forEach(card => {
        card.addEventListener('click', function(e) {
            if (!e.target.closest('.view-reports-btn')) {
                const cardId = this.id;
                if (cardId === 'performanceCard') {
                    navigateToPerformanceReports();
                } else if (cardId === 'progressCard') {
                    navigateToProgressReports();
                }
            }
        });

        card.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const cardId = this.id;
                if (cardId === 'performanceCard') {
                    navigateToPerformanceReports();
                } else if (cardId === 'progressCard') {
                    navigateToProgressReports();
                }
            }
        });

        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', card.querySelector('h2').textContent + ' - Click to view student reports');
    });

    // Student-specific loading states
    const viewButtons = document.querySelectorAll('.view-reports-btn');
    viewButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            this.disabled = true;

            setTimeout(() => {
                this.innerHTML = originalText;
                this.disabled = false;
            }, 1500);
        });
    });

    // Ensure student theme is applied
    document.body.classList.add('student-theme');
    console.log('Student report navigation initialized');
});