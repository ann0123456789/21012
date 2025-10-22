-- ----------------------------
-- RESET DATABASE
-- ----------------------------

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS Classroom_Lessons;
DROP TABLE IF EXISTS Classroom_Enrollment;
DROP TABLE IF EXISTS Classroom;
DROP TABLE IF EXISTS Student_Material_Completion; 
DROP TABLE IF EXISTS Lesson_Materials;
DROP TABLE IF EXISTS Lessons;
DROP TABLE IF EXISTS Enrollment;
DROP TABLE IF EXISTS Students;
DROP TABLE IF EXISTS Instructors;
DROP TABLE IF EXISTS Courses;
DROP TABLE IF EXISTS Logins;
DROP TABLE IF EXISTS Admins;
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------
-- TABLES
-- ----------------------------

CREATE TABLE IF NOT EXISTS Instructors (
    Ins_id INT PRIMARY KEY AUTO_INCREMENT,
    Ins_name VARCHAR(255) UNIQUE,
    Date_created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Students (
    Student_id INT PRIMARY KEY AUTO_INCREMENT,
    Title VARCHAR(20) DEFAULT NULL,
    First_name VARCHAR(255) NOT NULL,
    Last_name VARCHAR(255) NOT NULL,
    Activity VARCHAR(20) NOT NULL DEFAULT 'active',
    Date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_student_name` (First_name, Last_name)
);

CREATE TABLE IF NOT EXISTS Courses (
    Unit_id VARCHAR(255) PRIMARY KEY NOT NULL,
    Title VARCHAR(255) NOT NULL,
    Course_description TEXT,
    Total_credit INT DEFAULT 30,
    Course_made_by INT,
    Activity VARCHAR(20) DEFAULT 'active',
    Date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    Date_updated DATETIME,
    Course_director VARCHAR(255) DEFAULT 'Unknown',
    Active_Classrooms_Count INT DEFAULT 0,
    FOREIGN KEY (Course_made_by) REFERENCES Instructors(Ins_id)
);
 
CREATE TABLE IF NOT EXISTS Enrollment (
    Enrollment_id INT PRIMARY KEY AUTO_INCREMENT,
    Student_id INT NOT NULL,
    Unit_id VARCHAR(255) NOT NULL,
    Status VARCHAR(20) DEFAULT 'active',
    Date_enroll DATETIME DEFAULT CURRENT_TIMESTAMP,
    Date_unenroll DATETIME,
    Credit_earned INT DEFAULT 0,
    FOREIGN KEY (Student_id) REFERENCES Students(Student_id),
    FOREIGN KEY (Unit_id) REFERENCES Courses(Unit_id) ON DELETE CASCADE,
    UNIQUE KEY `idx_student_course` (Student_id, Unit_id)
);

CREATE TABLE IF NOT EXISTS Lessons (
    lesson_id INT PRIMARY KEY AUTO_INCREMENT,
    unit_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    objectives TEXT,
    estimated_time_hours INT DEFAULT 0,
    prerequisite_lesson_id INT,
    designer_id INT,
    credits INT DEFAULT 2,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,
    FOREIGN KEY (unit_id) REFERENCES Courses(Unit_id) ON DELETE CASCADE,
    FOREIGN KEY (designer_id) REFERENCES Instructors(Ins_id) ON DELETE SET NULL,
    FOREIGN KEY (prerequisite_lesson_id) REFERENCES Lessons(lesson_id)
);

CREATE TABLE IF NOT EXISTS Lesson_Materials (
    material_id INT PRIMARY KEY AUTO_INCREMENT,
    lesson_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    material_type ENUM('reading', 'video', 'file', 'link','assignment') DEFAULT 'reading',
    content_url TEXT,
    estimated_time_minutes INT DEFAULT 0,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lesson_id) REFERENCES Lessons(lesson_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Classroom (
    classroom_id INT PRIMARY KEY AUTO_INCREMENT,
    unit_id VARCHAR(255) NOT NULL,
    classroom_name VARCHAR(255) NOT NULL,
    instructor_id INT,
    duration VARCHAR(20) DEFAULT '4 weeks',      -- << added
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (unit_id) REFERENCES Courses(Unit_id) ON DELETE CASCADE,
    FOREIGN KEY (instructor_id) REFERENCES Instructors(Ins_id) ON DELETE SET NULL,
    UNIQUE KEY `idx_course_classroom_name` (unit_id, classroom_name)
);

CREATE TABLE IF NOT EXISTS Classroom_Enrollment (
    classroom_enrollment_id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    classroom_id INT NOT NULL,
    date_enrolled DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES Students(Student_id) ON DELETE CASCADE,
    FOREIGN KEY (classroom_id) REFERENCES Classroom(classroom_id) ON DELETE CASCADE,
    UNIQUE KEY `idx_student_classroom` (student_id, classroom_id)
);

CREATE TABLE IF NOT EXISTS Classroom_Lessons (
    classroom_id INT NOT NULL,
    lesson_id INT NOT NULL,
    PRIMARY KEY (classroom_id, lesson_id),
    FOREIGN KEY (classroom_id) REFERENCES Classroom(classroom_id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES Lessons(lesson_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Student_Material_Completion (
    student_id INT NOT NULL,
    material_id INT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (student_id, material_id),
    FOREIGN KEY (student_id) REFERENCES Students(Student_id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES Lesson_Materials(material_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Logins (
    login_id INT PRIMARY KEY AUTO_INCREMENT,
    user_type ENUM('student', 'instructor', 'admin') NOT NULL,
    user_ref_id INT NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    theme_preference ENUM('light', 'dark') DEFAULT 'light',
    activity_status ENUM('active', 'inactive') DEFAULT 'active',
    font_preference ENUM('small', 'medium', 'big') DEFAULT 'medium'
);

CREATE TABLE IF NOT EXISTS Admins (
    admin_id INT PRIMARY KEY AUTO_INCREMENT,
    admin_name VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL
);




-- ----------------------------
-- DUMMY DATA
-- ----------------------------

-- Admins
INSERT IGNORE INTO Logins (user_type, user_ref_id, email, password_hash, theme_preference, activity_status, font_preference) VALUES
('admin', 1, 'admin@example.com', 'GiveUsFullMarksPrettyPlease', 'dark', 'active', 'big'),

('instructor', 1, 'alice.tan@example.com', 'password123', 'light', 'active', 'medium'),
('instructor', 2, 'bob.lim@example.com', 'password123', 'light', 'active', 'small'),
('instructor', 3, 'carol.ong@example.com', 'password123', 'light', 'inactive', 'medium'),
('instructor', 4, 'david.ng@example.com', 'password123', 'dark', 'active', 'big'),
('instructor', 5, 'emma.lee@example.com', 'password123', 'dark', 'active', 'medium'),
('instructor', 6, 'frank.chen@example.com', 'password123', 'light', 'active', 'medium'),
('instructor', 7, 'grace.wong@example.com', 'password123', 'light', 'inactive', 'small'),

('student', 1, 'john.doe@example.com', 'password123', 'dark', 'active', 'medium'),
('student', 2, 'jane.smith@example.com', 'password123', 'light', 'active', 'small'),
('student', 3, 'michael.johnson@example.com', 'password123', 'dark', 'inactive', 'big'),
('student', 4, 'emily.davis@example.com', 'password123', 'dark', 'active', 'medium'),
('student', 5, 'daniel.brown@example.com', 'password123', 'light', 'active', 'big'),
('student', 6, 'sophia.wilson@example.com', 'password123', 'light', 'inactive', 'medium'),
('student', 7, 'chris.taylor@example.com', 'password123', 'dark', 'active', 'small'),
('student', 8, 'olivia.anderson@example.com', 'password123', 'light', 'active', 'medium');


INSERT IGNORE INTO Admins (admin_name, username, password_hash) VALUES
('Khamala', 'admin', 'GiveUsFullMarksPrettyPlease');

-- Instructors
INSERT IGNORE INTO Instructors (Ins_name) VALUES
('Dr. Alice Tan'),('Dr. Bob Lim'),('Dr. Carol Ong'),
('Dr. David Ng'),('Dr. Emma Lee'),('Dr. Frank Chen'),('Dr. Grace Wong');

-- Students
INSERT IGNORE INTO Students (First_name, Last_name, Activity) VALUES
('John','Doe','active'),('Jane','Smith','active'),('Michael','Johnson','inactive'),
('Emily','Davis','active'),('Daniel','Brown','active'),('Sophia','Wilson','active'),
('Chris','Taylor','inactive'),('Olivia','Anderson','active');

-- Courses (Updated with Active_Classrooms_Count)
INSERT IGNORE INTO Courses (Unit_id, Title, Course_description, Total_credit, Course_made_by, Course_director, Active_Classrooms_Count) VALUES
('FIT0001', 'Data Structures and Algorithms','Study of common data structures and algorithms in computing.',4,1,'Ms. Kamalahshunee', 2),
('FIT0002', 'Database Systems','Introduction to relational databases and SQL.',3,1,'Ms. Kamalahshunee', 2),
('FIT0003', 'Web Development','Front-end and back-end web development using HTML, CSS, JS, and Flask.',3,1,'Ms. Kamalahshunee', 0),
('FIT0004', 'Artificial Intelligence','Fundamentals of AI and machine learning techniques.',4,5,'Dr. Emma Lee', 0),
('FIT0005', 'Software Engineering','Software development lifecycle, methodologies, and project management.',3,6,'Dr. Frank Chen', 0),
('FIT0006', 'Computer Networks','Principles of computer networking, protocols, and communication.',3,7,'Dr. Grace Wong', 0);

-- Enrollment
INSERT IGNORE INTO Enrollment (Student_id, Unit_id, Status, Credit_earned) VALUES
(1, 'FIT0001', 'active', 0),  -- John Doe → Data Structures and Algorithms
(2, 'FIT0002', 'active', 0),  -- Jane Smith → Database Systems
(3, 'FIT0003', 'active', 0),  -- Michael Johnson → Web Development
(4, 'FIT0004', 'active', 0),  -- Emily Davis → Artificial Intelligence
(5, 'FIT0005', 'active', 0),  -- Daniel Brown → Software Engineering
(6, 'FIT0006', 'active', 0),  -- Sophia Wilson → Computer Networks
(7, 'FIT0001', 'active', 0),  -- Chris Taylor → Data Structures and Algorithms (shared)
(8, 'FIT0002', 'active', 0);  -- Olivia Anderson → Database Systems (shared)

-- Lessons
INSERT IGNORE INTO Lessons (unit_id, title, description, objectives, estimated_time_hours, prerequisite_lesson_id, designer_id) VALUES
('FIT0001', 'Introduction to Arrays', 'Basics of arrays.', 'Understand array indexing.', 2, NULL, 1),
('FIT0001', 'Sorting Algorithms', 'Common sorting algorithms.', 'Implement and analyze sorting.', 4, 1, 2),
('FIT0001', 'Searching Algorithms', 'Search methods.', 'Differentiate search algorithms.', 3, 2, 2),
('FIT0002', 'Relational Model', 'Relational DB model.', 'Explain tables, rows, columns.', 2, NULL, 3),
('FIT0002', 'SQL Queries', 'SQL hands-on.', 'Master SQL statements.', 5, 4, 4),
('FIT0003', 'HTML and CSS Basics', 'Build static websites.', 'Create a web page.', 4, NULL, 5),
('FIT0003', 'Introduction to JavaScript', 'Interactive JS.', 'Write functions and manipulate DOM.', 6, 6, 5),
('FIT0004', 'Machine Learning Fundamentals', 'ML core concepts.', 'Understand ML types.', 3, NULL, 6),
('FIT0004', 'Neural Networks', 'Train simple networks.', 'Implement neural networks.', 5, 8, 6),
('FIT0005', 'Agile Methodologies', 'Agile & Scrum basics.', 'Practice Scrum ceremonies.', 3, NULL, 7),
('FIT0005', 'Requirements Engineering', 'Gather & document requirements.', 'Write user stories.', 4, 10, 7);

-- Lesson Materials (removed 'completed' column from inserts as it's no longer in the table)
INSERT IGNORE INTO Lesson_Materials (lesson_id, title, material_type, content_url, estimated_time_minutes) VALUES
(1, 'Arrays Lecture Notes', 'reading', 'https://example.com/arrays-notes.pdf', 35),
(1, 'Arrays Practice Assignment', 'assignment', 'https://example.com/arrays-assignment.pdf', 80),
(2, 'Sorting Algorithms Guide', 'reading', 'https://example.com/sorting-guide.pdf', 40),
(2, 'Sorting Project Assignment', 'assignment', 'https://example.com/sorting-project.zip', 120),
(4, 'Searching Algorithms Summary', 'reading', 'https://example.com/searching-summary.pdf', 30);

-- Classrooms
INSERT IGNORE INTO Classroom (unit_id, classroom_name, instructor_id, duration) VALUES
('FIT0001', 'FIT0001 - Tutorial A', 1, '4 weeks'),
('FIT0001', 'FIT0001 - Tutorial B', 1, '4 weeks'),
('FIT0002', 'FIT0002 - Lab A', 3, '3 weeks'),
('FIT0002', 'FIT0002 - Lab B', 4, '3 weeks');

-- Classroom Enrollment
INSERT IGNORE INTO Classroom_Enrollment (student_id, classroom_id) VALUES
(1, 1),(2, 1),(3, 1),(4, 1),(5, 2),(6, 2),(7, 2),(8, 2);

-- Classroom Lessons
INSERT IGNORE INTO Classroom_Lessons (classroom_id, lesson_id) VALUES
(1, 2),(1, 3),
(2, 1),(2, 2),(2, 3),
(3, 4),(3, 5),
(4, 4),(4, 5);
