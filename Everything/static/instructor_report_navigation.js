// Instructor-specific navigation functions
function navigateToStudentAnalytics() {
    console.log('Navigating to Student Analytics');
    window.location.href = '/render_ins_report_student_list';
}

function navigateToCourseMetrics() {
    window.location.href = '/render_ins_report_course';
    console.log('Navigating to Course Metrics');
}

// Instructor-specific card interactions
document.addEventListener('DOMContentLoaded', function() {
    const reportCards = document.querySelectorAll('.report-card');
    
    reportCards.forEach(card => {
        card.addEventListener('click', function(e) {
            if (!e.target.closest('.view-reports-btn')) {
                const cardId = this.id;
                if (cardId === 'studentAnalyticsCard') {
                    navigateToStudentAnalytics();
                } else if (cardId === 'courseMetricsCard') {
                    navigateToCourseMetrics();
                }
            }
        });

        card.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const cardId = this.id;
                if (cardId === 'studentAnalyticsCard') {
                    navigateToStudentAnalytics();
                } else if (cardId === 'courseMetricsCard') {
                    navigateToCourseMetrics();
                }
            }
        });

        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', card.querySelector('h2').textContent + ' - Click to view instructor reports');
    });

    // Instructor-specific loading states
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

    // Ensure instructor theme is applied
    document.body.classList.add('instructor-theme');
    console.log('Instructor report navigation initialized');
});