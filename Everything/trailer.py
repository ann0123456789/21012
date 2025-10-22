import sqlite3
conn = sqlite3.connect('c.db')
cursor = conn.cursor()

with open('c.sql', 'r') as f:
    sql_script = f.read()

cursor.executescript(sql_script)
conn.commit()

"""
To do:
    Check if all the fields for each table is correct against the requirements
    Figure our admin
"""

# Instrutors
def add_instructor():
    ins_name = input("Enter the instructor name: ")
    cursor.execute("INSERT INTO Instructors (Ins_name) VALUES (?)", (ins_name,))
    conn.commit()

def remove_instructor():
    result = int(input("Enter the id of the instructor you want to remove: "))
    cursor.execute("DELETE FROM Instructors WHERE Ins_id = (?)", (result,))
    conn.commit()

def view_all_instructors():
    cursor.execute("SELECT * FROM Instructors")
    instructors_table = cursor.fetchall()  
    for instructor in instructors_table:
        print("\nInstructor's ID: ", instructor[0])
        print("Instructor's name: ", instructor[1])
        print("Date created: ", instructor[2])

# Students
def add_student():
    first_name = input("Enter student's first name: ")
    last_name = input("Enter student's last name: ")
    cursor.execute("INSERT INTO Students (First_name, Last_name) VALUES (?, ?)", (first_name,last_name))
    conn.commit()

def remove_student():
    result = int(input("Enter the id of the student you want to remove: "))
    cursor.execute("DELETE FROM Students WHERE Student_id = (?)", (result,))
    conn.commit()

def view_all_students():
    cursor.execute("SELECT * FROM Students")
    students_table = cursor.fetchall()  
    for student in students_table:
        print("\nStudent's ID: ", student[0])
        print("Student's name: ", student[1], student[2])
        print("Activity: ", student[3])
        print("Date created: ", student[4]) 

# Courses
def check_if_can_change_course():
    instructor_id = int(input("Enter your instructor id: "))
    cursor.execute("SELECT 1 FROM Instructors WHERE Ins_id = ?", (instructor_id,))
    access = cursor.fetchone() is not None
    return access, instructor_id

def add_course():
    access, ins_id_here = check_if_can_change_course()
    if access == True:
        title = input("Enter the course title: ")
        course_description = input("Enter the course description: ")
        unit_id = input("Enter the course unit id: ")     
        total_credit = input("Enter the total credit: ")         
        cursor.execute("SELECT Ins_name FROM Instructors WHERE Ins_id = (?)", (ins_id_here,))
        course_made_by = cursor.fetchone()[0] 
        cursor.execute("INSERT INTO Courses (Title, Unit_id, Course_description, Total_credit, Course_made_by) VALUES (?, ?, ?, ?, ?)",(title, unit_id, course_description, total_credit, course_made_by))
    else:
        print("Instructor id not valid. please register first!")
    conn.commit()

def remove_course():
    access = check_if_can_change_course()[0]
    if access == True:
        result = int(input("Enter the id of the course you want to remove: "))
        cursor.execute("DELETE FROM Courses WHERE Course_id = (?)", (result,))
    else:
        print("Instructor id not valid. please register first!")
    conn.commit()

def view_all_courses():
    cursor.execute("SELECT * FROM Courses")
    courses_table = cursor.fetchall()  
    for course in courses_table:
        print("\nCourse's ID: ", course[0])
        print("Title: ", course[1])
        print("Unit id: ", course[2])
        print("Course description: ", course[3])
        print("Total credit: ", course[4])
        print("Course made by: ", course[5])
        print("Activity: ", course[6])
        print("Date created: ", course[7])
        print("Date updated: ", course[8])

def edit_course():
    access, ins_id_here = check_if_can_change_course()
    if access == True:
        course_id = int(input("Enter the course ID you want to edit: "))
        cursor.execute("SELECT * FROM Courses WHERE Course_id = ?", (course_id,))
        course = cursor.fetchone()
        print("\nCourse's ID: ", course[0])
        print("Title: ", course[1])
        print("Unit id: ", course[2])
        print("Course description: ", course[3])
        print("Total credit: ", course[4])
        print("Course made by: ", course[5])
        print("Activity: ", course[6])
        print("Date created: ", course[7])
        print("Date updated: ", course[8])

        new_title = input("Enter new title (press enter for no change): ")
        new_description = input("Enter new description (press enter for no change): ")
        new_credit = input("Enter new total credit (press enter for no change): ")
        new_activity = input("Enter activity status (active or inactive, type it out pls): ")
        
        if new_title.strip() == "":
            new_title = course[1]
        if new_description.strip() == "":
            new_description = course[3]
        if new_activity.strip() == "":
            new_activity = course[6]
        if new_credit.strip() == "":
            new_credit = course[4]
        else:
            new_credit = int(new_credit)

        cursor.execute("UPDATE Courses SET Title = ?, Course_description = ?, Total_credit = ?, Activity = ?, Date_updated = CURRENT_TIMESTAMP WHERE Course_id = ?", (new_title, new_description, new_credit, new_activity, course_id))
        conn.commit()
        print("Course updated successfully!")
        
    else:
        print("Instructor id not valid. please register first!")
    
# Manage
def manage_instructors():
    print("\n###########################################3")
    print("Enter -1 to end the program.")
    print("1. Add instructor")
    print("2. Remove instructor")
    print("3. View all instructors with their id.")
    print("###########################################3")
    answer = int(input("Enter the option number: "))

    if answer == -1:
        conn.close()
        quit()
        
    elif answer == 1:
        add_instructor()
        
    elif answer == 2:
        remove_instructor()
        
    elif answer == 3:
        view_all_instructors()
    
    conn.commit()

def manage_students():
    print("\n###########################################3")
    print("Enter -1 to end the program.")
    print("1. Add student")
    print("2. Remove student")
    print("3. View all students with their id.")
    print("###########################################3")
    answer = int(input("Enter the option number: "))

    if answer == -1:
        conn.close()
        quit()

    elif answer == 1:
        add_student()
        
    elif answer == 2:
        remove_student()
        
    elif answer == 3:
        view_all_students()
    
    conn.commit()

def manage_courses():
    print("\n###########################################3")
    print("Enter -1 to end the program.")
    print("1. Add course")
    print("2. Remove course")
    print("3. View all courses")
    print("4. Edit course")
    print("###########################################3")
    answer = int(input("Enter the option number: "))

    if answer == -1:
        conn.close()
        quit()
        
    elif answer == 1:
        add_course()
        
    elif answer == 2:
        remove_course()
        
    elif answer == 3:
        view_all_courses()
    
    elif answer == 4:
        edit_course()
    
    conn.commit()

def manage_enrollment():
    print("\n###########################################3")
    print("1. Enroll")
    print("2. Unenroll")
    print("3. View all enrolled")
    print("###########################################3")
    answer = int(input("Enter the option number: "))

    if answer == -1:
        conn.close()
        quit()
        
    elif answer == 1:
        enroll()
        
    elif answer == 2:
        unenroll()
        
    elif answer == 3:
        view_enrolled_courses()
    
    conn.commit()

# Reset everything
def reset_all_tables():
    cursor.execute("DELETE FROM Students")
    cursor.execute("DELETE FROM Instructors")
    cursor.execute("DELETE FROM Courses")
    cursor.execute("DELETE FROM Enrollment")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('Students', 'Instructors', 'Courses', 'Enrollment')")
    conn.commit()

# Enrollment
def check_if_can_enroll():
    student_id = int(input("Enter your student id: "))
    cursor.execute("SELECT 1 FROM Students WHERE Student_id = ?", (student_id,))
    access = cursor.fetchone() is not None
    course_id = int(input("Enter the course id you want to enroll in: "))
    cursor.execute("SELECT 1 FROM Courses WHERE Course_id = ?", (course_id,))
    
    if not access:
        print("Invalid student id.")
        return False, None, None

    if not cursor.fetchone():
        print("Invalid course id.")
        return False, student_id, None
    
    return access, student_id, course_id
    
def enroll():
    access, stu_id_here, course_id = check_if_can_enroll()
    if access == True:
        cursor.execute("INSERT INTO Enrollment (Student_id, Course_id) VALUES (?, ?)", (stu_id_here, course_id))
        conn.commit()
        last_enrollment_id = cursor.lastrowid
        print("Successfully enrolled! Please save your enrollment id for future issues. Enrollment id: ", last_enrollment_id)
    else:
        print("Student id not valid. Please register first!")

def unenroll():
    student_id = int(input("Enter your student id: "))
    enrollment_id = int(input("Enter your enrollment id: "))

    cursor.execute("SELECT 1 FROM Enrollment WHERE Enrollment_id = ? AND Student_id = ?", (enrollment_id, student_id))
    if cursor.fetchone():
        cursor.execute("UPDATE Enrollment SET Status = 'inactive', Date_unenroll = CURRENT_TIMESTAMP WHERE Enrollment_id = ?", (enrollment_id,))
        conn.commit()
        print("Successfully unenrolled.")
    else:
        print("Invalid enrollment id for this student.")

def view_enrolled_courses():
    stu_id = int(input("Please enter your student id to check all your enrollments: "))
    cursor.execute("SELECT * FROM Enrollment WHERE Student_id = (?)", (stu_id,))
    enrollment_table = cursor.fetchall()  
    for enrollment in enrollment_table:
        print("\nEnrollment ID: ", enrollment[0])
        print("Course id: ", enrollment[2])
        cursor.execute("SELECT * FROM Courses WHERE Course_id = (?)", (enrollment[2],))
        courses_table = cursor.fetchall()  
        for course in courses_table:
            print("Title: ", course[1])
            print("Course description: ", course[3])
            print("Total credit: ", course[4])
            print("Instructor: ", course[5])
            print("Status: ", enrollment[3])
            print("Date enrolled: ", enrollment[4])
            print("Date unenrolled: ", enrollment[5])
            print("Credit earned: ", enrollment[6])
        
# Main running thing            
while True:
    print("\n###########################################3")
    print("Enter -1 to end the program.")
    print("1. Manage Instructors")
    print("2. Manage Students")
    print("3. Reset everything")
    print("4. Manage Courses")
    print("5. Manage Enrollement")
    print("###########################################3")
    selection = int(input("Enter the option number: "))
    if selection == 1:
        manage_instructors()
        
    elif selection == 2:
        manage_students()
        
    elif selection == 3:
        reset_all_tables()

    elif selection == 4:
        manage_courses()
    
    elif selection == 5:
        manage_enrollment()
    
    elif selection == -1:
        conn.commit()
        conn.close()
        quit()