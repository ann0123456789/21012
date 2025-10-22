from flask import Flask, jsonify, request, render_template, g, session
from flask_cors import CORS
import mysql.connector
import os
import time
import traceback

app = Flask(__name__)
app.secret_key = "super_secret_key_change_me"  # Needed for session management
CORS(app, supports_credentials=True, origins=["http://127.0.0.1:5500", "http://localhost:5500"])

# --- Database Configuration ---
DB_CONFIG = {
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'host': os.getenv('DB_HOST'),
    'port': int(os.getenv('DB_PORT', 3306)),  # include port for Railway
    'database': os.getenv('DB_NAME'),
    'raise_on_warnings': True
}

SQL_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "c.sql")
# --- Database Setup ---
def setup_database():
    """Recreate and seed the MySQL database from c.sql automatically (only if empty)."""
    try:
        print("🔍 Checking MySQL connection...")
        conn = mysql.connector.connect(
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            host=DB_CONFIG['host']
        )
        cur = conn.cursor()
        cur.execute(f"CREATE DATABASE IF NOT EXISTS {DB_CONFIG['database']}")
        cur.close()
        conn.close()
        print(f"✅ Database '{DB_CONFIG['database']}' is ready.")

        # Connect to the database to check existing tables
        conn = mysql.connector.connect(**DB_CONFIG)
        cur = conn.cursor()
        cur.execute("SHOW TABLES;")
        tables = cur.fetchall()

        # if tables:
        #     print("✅ Tables already exist — skipping rebuild.\n")
        #     cur.close()
        #     conn.close()
        #     return

        print("⚙️  Rebuilding schema from c.sql...")
        with open(SQL_FILE, "r", encoding="utf-8") as f:
            sql_script = f.read()

        # Disable foreign key checks to allow drops
        cur.execute("SET FOREIGN_KEY_CHECKS=0;")

        for raw_stmt in sql_script.split(";"):
            stmt = raw_stmt.strip()
            if not stmt:
                continue
            try:
                cur.execute(stmt)
            except mysql.connector.Error as e:
                if e.errno in (1051, 1091):  # harmless drop errors
                    print(f"⚠️  Ignored benign drop error {e.errno}: {e.msg}")
                    continue
                else:
                    print(f"❌ SQL error {e.errno}: {e.msg}")
                    raise

        cur.execute("SET FOREIGN_KEY_CHECKS=1;")
        conn.commit()
        cur.close()
        conn.close()

        print("✅ Database schema and dummy data successfully reloaded from c.sql.\n")

    except mysql.connector.Error as e:
        print(f"❌ MySQL setup failed ({e.errno}): {e.msg}")

def get_db():
    if "db" not in g:
        g.db = mysql.connector.connect(**DB_CONFIG)
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()

class PrerequisiteManager:
    """Reusable module for managing prerequisites"""
    
    @staticmethod
    def get_available_lessons(unit_id, exclude_lesson_id=None):
        """Get lessons that can be used as prerequisites for a given unit"""
        db = get_db()
        cur = db.cursor(dictionary=True)
        
        if exclude_lesson_id:
            cur.execute("""
                SELECT lesson_id, title 
                FROM Lessons 
                WHERE unit_id = %s AND lesson_id != %s 
                ORDER BY lesson_id
            """, (unit_id, exclude_lesson_id))
        else:
            cur.execute("""
                SELECT lesson_id, title 
                FROM Lessons 
                WHERE unit_id = %s 
                ORDER BY lesson_id
            """, (unit_id,))
        
        return cur.fetchall()
    
    @staticmethod
    def check_lesson_completion(student_id, lesson_id):
        """Check if a student has completed a specific lesson"""
        db = get_db()
        cur = db.cursor(dictionary=True)
        
        cur.execute("""
            SELECT material_id
            FROM Lesson_Materials
            WHERE lesson_id = %s
        """, (lesson_id,))
        materials_in_lesson = cur.fetchall()

        if not materials_in_lesson:
            return True  

        total_materials = len(materials_in_lesson)
        completed_materials_count = 0

        for material in materials_in_lesson:
            cur.execute("""
                SELECT completed FROM Student_Material_Completion WHERE student_id = %s AND material_id = %s
            """, (student_id, material['material_id']))
            material_completion_status = cur.fetchone()
            if material_completion_status and material_completion_status['completed']:
                completed_materials_count += 1

        return completed_materials_count == total_materials
    
    @staticmethod
    def get_prerequisite_status(student_id, lesson_id):
        """Get the prerequisite status for a lesson"""
        db = get_db()
        cur = db.cursor(dictionary=True)
        
        # Get the prerequisite lesson
        cur.execute("""
            SELECT prerequisite_lesson_id 
            FROM Lessons 
            WHERE lesson_id = %s
        """, (lesson_id,))
        
        result = cur.fetchone()
        if not result or not result['prerequisite_lesson_id']:
            return {"locked": False, "prerequisite_lesson": None}
        
        prerequisite_id = result['prerequisite_lesson_id']
        is_prerequisite_complete = PrerequisiteManager.check_lesson_completion(student_id, prerequisite_id)
        
        # Get prerequisite lesson title
        cur.execute("SELECT title FROM Lessons WHERE lesson_id = %s", (prerequisite_id,))
        prereq_lesson = cur.fetchone()
        
        return {
            "locked": not is_prerequisite_complete,
            "prerequisite_lesson": {
                "id": prerequisite_id,
                "title": prereq_lesson['title'] if prereq_lesson else "Unknown"
            }
        }
    
    @staticmethod
    def get_lessons_with_status(student_id, unit_id):
        """Get all lessons for a unit with their prerequisite status"""
        db = get_db()
        cur = db.cursor(dictionary=True)
        
        cur.execute("""
            SELECT lesson_id, title, prerequisite_lesson_id
            FROM Lessons 
            WHERE unit_id = %s 
            ORDER BY lesson_id
        """, (unit_id,))
        
        lessons = cur.fetchall()
        
        for lesson in lessons:
            status = PrerequisiteManager.get_prerequisite_status(student_id, lesson['lesson_id'])
            lesson['locked'] = status['locked']
            lesson['prerequisite_lesson'] = status['prerequisite_lesson']
            
            # Also check if this lesson itself is completed
            lesson['completed'] = PrerequisiteManager.check_lesson_completion(student_id, lesson['lesson_id'])
            
        return lessons

# --- Routes ---

@app.route("/login")
def login_page():
    return render_template("student_login.html")
@app.route("/profile")
def profile():
    return render_template("student_profile.html")
@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "GET":
        return render_template("sign_up.html")

    if request.method == "POST":
        db = get_db()
        cursor = db.cursor()

        # Read form fields (allow Title to be optional/nullable)
        title = (request.form.get("title") or None)
        first_name = request.form.get("firstName")
        last_name = request.form.get("lastName")
        email = request.form.get("email")
        password = request.form.get("password")
        status = (request.form.get("status") or "active")

        try:
            # ✅ Now persists Title as well
            cursor.execute(
                "INSERT INTO Students (Title, First_name, Last_name, Activity) VALUES (%s, %s, %s, %s)",
                (title, first_name, last_name, status)
            )
            student_id = cursor.lastrowid

            cursor.execute(
                """
                INSERT INTO Logins (user_ref_id, user_type, email, password_hash, activity_status)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (student_id, 'student', email, password, status)
            )
            db.commit()

            return jsonify({"status": "success", "redirect": "/login"})

        except mysql.connector.Error as e:
            db.rollback()
            if e.errno == 1062:
                if "logins.email" in e.msg.lower():
                    return jsonify({"status": "error", "message": "An account with this email already exists."}), 409
                if "students.idx_student_name" in e.msg.lower():
                    return jsonify({"status": "error", "message": "A student with this first and last name already exists."}), 409
            return jsonify({"status": "error", "message": "A database error occurred. Please try again later."}), 500


@app.route("/")
def home():
    return render_template("student_login.html")

@app.route("/enrol_popup")
def enrol_popup():
    return render_template("enrol_popup.html")

@app.route("/classroom_enrol_popup")
def classroom_enrol_popup():
    return render_template("classroom_enrol_popup.html") 

@app.route("/student_course_management")
def student_course_management():
    return render_template("student_course_management.html")

@app.route("/instructor_course_management")
def instructor_course_management():
    return render_template("instructor_course_management.html")

@app.route("/instructor_classrooms")
def instructor_classrooms():
    return render_template("instructor_classrooms.html")

@app.route("/instructor_courses", methods=["GET"])
def instructor_courses():
    ins_id = session.get("user_id")
    print(ins_id)

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT c.Unit_id, c.Title, c.Course_director, c.Total_credit
        FROM Courses c
        JOIN Instructors i ON c.Course_made_by = i.Ins_id
        WHERE i.Ins_id = %s
    """, (ins_id,))

    rows = cursor.fetchall()
    if not rows:
        return jsonify({"found": False, "results": []})
    courses = [{"unit_id": r["Unit_id"], "name": r["Title"], "credit": r["Total_credit"]} for r in rows]
    return jsonify({"found": True, "results": courses})
@app.route("/fetch_classroom_lessons", methods = ["GET"])
def classroom_lessons():
    classroom_id = request.args.get("classroom_id", "")
    db = get_db()
    cursor = db.cursor(dictionary=True)
    print("haro")
    try:
        cursor.execute("""
            SELECT 
                l.lesson_id,
                l.title AS name,
                l.credits AS credit
            FROM Classroom_Lessons cl
            JOIN Lessons l ON cl.lesson_id = l.lesson_id
            WHERE cl.classroom_id = %s
            ORDER BY l.lesson_id
        """, (classroom_id,))
        lessons = cursor.fetchall()
        
        # Transform for frontend
        results = [{"lesson_id": l["lesson_id"], "title": l["name"], "credit": l["credit"]} for l in lessons]
        print(results)
        return jsonify({"found": True, "results": results})
    except mysql.connector.Error:
        return jsonify({"found": False, "results": []})
@app.route("/fetch_instructor_details", methods=["GET"])


@app.route("/fetch_course_details", methods=["GET"])
def fetch_course_details():
    ins_id = session.get("user_id")  # Instructor ID from session
    unitId = request.args.get("unit_id", "").strip()  # Unit ID from query parameter

    if not ins_id or not unitId:
        return jsonify({"status": "error", "message": "Missing instructor or unit ID"}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT c.Title, c.Unit_id, c.Course_director, c.Activity, c.Total_credit, i.Ins_name, c.Active_Classrooms_Count
            FROM Courses c
            JOIN Instructors i ON c.Course_made_by = i.Ins_id
            WHERE c.Unit_id = %s
        """, (unitId,))
        course_row = cursor.fetchone()
    except mysql.connector.Error as e:
        print(f"Error fetching course details: {e}")
        return jsonify({"status": "error", "message": "Failed to fetch course details"}), 500

    if not course_row:
        return jsonify({"found": False, "results": []})

    active_classrooms = course_row["Active_Classrooms_Count"]
    course_details = {
        "title": course_row["Title"],
        "unitId": course_row["Unit_id"],
        "courseDirector": course_row["Course_director"],
        "status": course_row["Activity"],
        "instructorName": course_row["Ins_name"],
        "totalCredit": course_row["Total_credit"],
        "activeClassrooms": active_classrooms
    }

    return jsonify({"found": True, "results": [course_details]})

@app.route("/fetch_students", methods = ["GET"])
def fetch_students():
    unitId = request.args.get("unit_id", "").strip()
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT s.First_name, s.Last_name, s.Student_id
            FROM Students s
            JOIN Enrollment e ON s.Student_id = e.Student_id 
            WHERE e.Unit_id = %s
        """, (unitId,))
        students_rows = cursor.fetchall()
        students = [{"name": f"{row['First_name']} {row['Last_name']}", "student_id": row["Student_id"]} for row in students_rows]
    except mysql.connector.Error as e:
        print(f"Error fetching students: {e}")
        students = []

    return jsonify({
        "found": True,
        "students": students
    })

@app.route("/fetch_lessons_and_students", methods=["GET"])
def fetch_lessons_and_students():
    unitId = request.args.get("unit_id", "").strip()
    user_type = session.get("user_type")
    student_id = session.get("user_id")
    db = get_db()
    cursor = db.cursor(dictionary=True)

    if not unitId:
        return jsonify({"status": "error", "message": "Missing unit ID or student ID"}), 400

    lessons = PrerequisiteManager.get_available_lessons(unitId)
    # Convert lessons to expected format
    lessons_formatted = []
    for lesson in lessons:
        # status = "available"  # Default status
        # if lesson.get('locked'):
        #     status = "locked"
        # elif lesson.get('completed'):
        #     status = "completed"
            
        lessons_formatted.append({
            "name": lesson["title"],
            "credit": lesson.get("credits", 2),
            "lesson_id": lesson["lesson_id"],
            # "status": status,
            # "prerequisite_lesson": lesson.get('prerequisite_lesson')
        })

    return jsonify({
        "found": True,
        "lessons": lessons_formatted,
    })

@app.route("/fetch_lessons_and_students_2", methods=["GET"])
def get_lessons_2():
    unitId = request.args.get("unit_id", "").strip()
    student_id = session.get("user_id")
    db = get_db()
    cursor = db.cursor(dictionary=True)

    if not unitId or not student_id:
        return jsonify({"status": "error", "message": "Missing unit ID or student ID"}), 400

    lessons = PrerequisiteManager.get_lessons_with_status(student_id,unitId)
    # Convert lessons to expected format
    lessons_formatted = []
    for lesson in lessons:
        status = "available"  # Default status
        if lesson.get('locked'):
            status = "locked"
        elif lesson.get('completed'):
            status = "completed"
            
        lessons_formatted.append({
            "name": lesson["title"],
            "credit": lesson.get("credits", 2),
            "lesson_id": lesson["lesson_id"],
            "status": status,
            "prerequisite_lesson": lesson.get('prerequisite_lesson')
        })

    return jsonify({
        "found": True,
        "lessons": lessons_formatted,
    })
  
@app.route("/courses", methods=["GET"])
def search_course():
    student_id = session.get('user_id')
    query = request.args.get("q", "").strip()
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT Unit_id FROM Enrollment WHERE Student_id = %s", (student_id,))
    enrolled_course_unit_ids = {row["Unit_id"] for row in cursor.fetchall()}

    sql_params = []
    where_clauses = []
    where_clauses.append("Activity = 'active'")

    if enrolled_course_unit_ids:
        placeholders = ', '.join(['%s'] * len(enrolled_course_unit_ids))
        where_clauses.append(f"Unit_id IN ({placeholders})")
        sql_params.extend(list(enrolled_course_unit_ids)) 

    combined_activity_enrollment_clause = f"({' OR '.join(where_clauses)})"

    final_where_parts = [combined_activity_enrollment_clause]

    if query:
        final_where_parts.append("(LOWER(Unit_id) LIKE LOWER(%s) OR LOWER(Title) LIKE LOWER(%s))")
        sql_params.insert(0, f"%{query}%") 
        sql_params.insert(1, f"%{query}%")

    final_where_clause = " AND ".join(final_where_parts)
    
    sql_query = f"""
        SELECT Unit_id AS id, Title AS name, Unit_id
        FROM Courses
        WHERE {final_where_clause}
    """
    cursor.execute(sql_query, tuple(sql_params))

    rows = cursor.fetchall()
 
    if not rows:
        return jsonify({"found": False, "message": "No courses found"}), 404

    courses = [{"unit_id": r["Unit_id"], "name": r["name"], "id": r["id"], "is_enrolled" : r["id"] in enrolled_course_unit_ids} for r in rows]

    return jsonify({"found": True, "results": courses})

@app.route("/create_course")
def create_course_page():
    return render_template("create_course.html")

@app.route("/course_page_student")
def student_course_page():
    return render_template("course_page_student.html") # to be replaced with real file name

@app.route("/course_page_instructor")
def instructor_course_page():
    return render_template("/course_page_instructor.html") # to be replaced with real file name

@app.route("/create", methods=["POST"])
def create_course():
    ins_id = session.get("user_id")
    db = get_db()
    cursor = db.cursor(dictionary=True)

    title = request.form.get("title")
    unit_id = request.form.get("unit_id")
    description = request.form.get("description")

    if not (title and unit_id):
        return jsonify({"status": "error", "message": "Title, Unit ID, and Credits are required"}), 400

    try:
        director = request.form.get("director")
        credits = request.form.get("credits", type=int)
        status = request.form.get("status")
        active_classrooms_count = request.form.get("active_classrooms_count", 0, type=int)

        cursor.execute("""
            INSERT INTO Courses 
            (Unit_id, Title, Course_description, Course_director, Total_credit, Activity, Course_made_by, Active_Classrooms_Count, Date_created, Date_updated)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        """, (unit_id, title, description, director, credits, status, ins_id, active_classrooms_count))

        db.commit()

        cursor.execute("SELECT Date_created, Date_updated FROM Courses WHERE Unit_id = %s", (unit_id,))
        row = cursor.fetchone()

        return jsonify({
            "status": "success",
            "message": f"Course {title} created.",
            "date_created": row["Date_created"],
            "date_updated": row["Date_updated"]
        })

    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 400

    finally:
        cursor.close()
        db.close()
@app.route("/lesson_page_instructor")
def render_lesson_page_instructor():
    return render_template("lesson_page_instructor.html")

@app.route("/lesson_page_student")
def render_lesson_page_student():
    return render_template("lesson_page_student.html")

@app.route("/get_lesson_details", methods=["GET"])
def get_lesson_details():
    lesson_id = request.args.get("lesson_id")
    student_id = session.get('user_id')

    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)

        cursor.execute("""
            SELECT 
                l.lesson_id AS lesson_id,
                l.title AS title,
                l.estimated_time_hours AS estimated_time,
                l.objectives AS objective,
                l.description AS description,
                l.designer_id AS designer_id,
                l.prerequisite_lesson_id AS prerequisite_lesson_id,
                i.Ins_name AS instructor,
                l.date_created AS date_created,
                l.date_updated AS last_updated,
                l.unit_id AS unit_id,
                prereq.title AS prerequisite_title
            FROM Lessons l
            LEFT JOIN Instructors i ON l.designer_id = i.Ins_id
            LEFT JOIN Lessons prereq ON l.prerequisite_lesson_id = prereq.lesson_id
            WHERE l.lesson_id = %s
        """, (lesson_id,))

        lessons_rows = cursor.fetchall()

        lessons = []
        for row in lessons_rows:
            # Get prerequisite status for this student
            prereq_status = PrerequisiteManager.get_prerequisite_status(student_id, lesson_id)
            
            lesson_data = {
                "lesson_id": row["lesson_id"],
                "title": row["title"],
                "estimated_time": row["estimated_time"],
                "objective": row["objective"],
                "description": row["description"],
                "designer_id": row["designer_id"],
                "prerequisite_lesson_id": row["prerequisite_lesson_id"],
                "prerequisite_title": row["prerequisite_title"],
                "instructor": row["instructor"] or "Unknown",
                "date_created": row["date_created"].strftime("%Y-%m-%d %H:%M:%S") if row["date_created"] else None,
                "last_updated": row["last_updated"].strftime("%Y-%m-%d %H:%M:%S") if row["last_updated"] else None,
                "unit_id": row["unit_id"],
                "locked": prereq_status["locked"],
                "prerequisite_lesson": prereq_status["prerequisite_lesson"]
            }
            lessons.append(lesson_data)

        if lessons:
            return jsonify({"status": "success", "lessons": lessons}), 200
        else:
            return jsonify({"status": "success", "message": "No lessons found"}), 200

    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500
    



@app.route("/create_lesson_ins", methods=["POST"])
def create_lesson_instructors():
    ins_id = 1
    db = get_db()
    cur = db.cursor(dictionary=True)

    # Accept JSON or form
    if request.is_json:
        body = request.get_json(force=True) or {}
        unit_id = (body.get("unit_id") or "").strip()
        title = (body.get("title") or "New Lesson").strip()
        description = (body.get("description") or "").strip()
        objectives = (body.get("objectives") or "").strip()
        estimated_time_hours = body.get("estimated_time_hours")
    else:
        unit_id = (request.form.get("unit_id") or "").strip()
        title = (request.form.get("title") or "New Lesson").strip()
        description = (request.form.get("description") or "").strip()
        objectives = (request.form.get("objectives") or "").strip()
        estimated_time_hours = request.form.get("estimated_time_hours")

    if not unit_id:
        return jsonify({"status": "error", "message": "unit_id is required"}), 400

    # Ensure course exists
    cur.execute("SELECT 1 FROM Courses WHERE Unit_id=%s", (unit_id,))
    if not cur.fetchone():
        cur.close()
        return jsonify({"status": "error", "message": f"Course '{unit_id}' does not exist."}), 409

    # Coerce time
    try:
        estimated_time_hours = int(estimated_time_hours) if estimated_time_hours not in (None, "",) else None
    except ValueError:
        return jsonify({"status": "error", "message": "estimated_time_hours must be an integer"}), 400

    try:
        # prerequisite = latest lesson in the same unit (optional)
        cur.execute("SELECT MAX(lesson_id) AS max_id FROM Lessons WHERE unit_id=%s", (unit_id,))
        prev = cur.fetchone()
        prerequisite_lesson_id = prev["max_id"] if prev and prev["max_id"] else None

        cur.execute("""
            INSERT INTO Lessons (
                unit_id, title, description, objectives, estimated_time_hours, prerequisite_lesson_id, designer_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (unit_id, title, description, objectives, estimated_time_hours, prerequisite_lesson_id, ins_id))

        new_id = cur.lastrowid
        db.commit()
        return jsonify({"status": "success", "message": "Lesson created successfully.", "lesson_id": new_id}), 201

    except mysql.connector.Error as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cur.close()

@app.route("/api/lessons/<int:lesson_id>", methods=["DELETE"])
def delete_lesson(lesson_id):
    
    db = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT title FROM Lessons WHERE prerequisite_lesson_id = %s", 
            (lesson_id,)
        )
        dependent_lessons = cur.fetchall()
        
        if dependent_lessons:
            lesson_titles = [lesson['title'] for lesson in dependent_lessons]
            error_message = f"Cannot delete. This lesson is a prerequisite for: {', '.join(lesson_titles)}."
            return jsonify({"ok": False, "error": error_message}), 409 # 409 Conflict

        cur.execute("DELETE FROM Lessons WHERE lesson_id = %s", (lesson_id,))
        db.commit()
        if cur.rowcount == 0:
            return jsonify({"ok": False, "error": "Lesson not found"}), 404
        return jsonify({"ok": True, "message": "Lesson deleted successfully"})
    
    except mysql.connector.Error as e:
        db.rollback()
        return jsonify({"ok": False, "error": str(e)}), 500



@app.route("/delete_course", methods=["POST"])
def delete_course():
    unit_id = request.form.get("unit_id")
    ins_id = request.form.get("ins_id", 1)
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("DELETE FROM Courses WHERE Unit_id = %s AND Course_made_by = %s", (unit_id, ins_id))
        db.commit()
        return jsonify({"status": "success", "message": "Course Deleted"}), 200
    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/unenroll", methods=["POST"])
def unenroll_course():
    course_id = request.form.get("course_id")
    student_id = session.get('user_id')
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("DELETE FROM Enrollment WHERE Student_id = %s AND Unit_id = %s", (student_id, course_id))
        db.commit() # <--- Make sure this is called!
        return jsonify({"status": "success", "message": f"Unenrolled from course {course_id}."})
    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/enrollment", methods=["POST","GET"])
def enroll_in_course():
    # get inputs
    course_id = request.form.get("course_id") or request.args.get("course_id")
    student_id = session.get('user_id')

    if not course_id:
        return jsonify({"status": "error", "message": "course_id is required."}), 400

    db = get_db()
    cursor = db.cursor()  # dictionary=True not needed here

    try:
        # ✅ FIXED: select something (existence check) and USE the result
        cursor.execute(
            "SELECT 1 FROM Students WHERE Student_id = %s AND Activity = 'active' LIMIT 1",
            (student_id,)
        )
        is_active = cursor.fetchone() is not None
        if not is_active:
            return jsonify({"status": "error", "message": "Student is not active."}), 400

        cursor.execute("""
            DELETE smc
            FROM Student_Material_Completion smc
            JOIN Lesson_Materials lm ON smc.material_id = lm.material_id
            JOIN Lessons l ON lm.lesson_id = l.lesson_id
            WHERE smc.student_id = %s AND l.unit_id = %s
        """, (student_id, course_id))
        print(f"Reset progress for student {student_id} in course {course_id}. Deleted {cursor.rowcount} material completion records.")
        
        # proceed only if active
        cursor.execute(
            "INSERT INTO Enrollment (Student_id, Unit_id) VALUES (%s, %s)",
            (student_id, course_id)
        )
        db.commit()
        return jsonify({"status": "success", "message": f"Enrolled in course {course_id}."}), 200

    except mysql.connector.IntegrityError:
        db.rollback()
        return jsonify({"status": "error", "message": "Already enrolled in this course."}), 409
    except mysql.connector.Error as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        try:
            cursor.close()
        except:
            pass



@app.route("/find_enrollment", methods=["GET"])
def search_enrollment():
    student_id = session.get('user_id')

    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT c.Unit_id, c.Title, c.Course_director
        FROM Enrollment e
        JOIN Courses c ON e.Unit_id = c.Unit_id
        WHERE e.Student_id = %s
    """, (student_id,))
    
    rows = cursor.fetchall()

    if not rows:
        return jsonify({"found": False, "results": []})
    
    courses = [{"Unit_id": r["Unit_id"], "Title": r["Title"]} for r in rows]

    return jsonify({"found": True, "results": courses})

# --- MySQL version of /courses/update (edit course title, unit id, director, status, credit) ---

@app.route("/courses/update", methods=["POST"])
def courses_update():
    data = request.get_json(force=True) or {}

    unit_id = (data.get("unit_id") or "").strip()
    if not unit_id:
        return jsonify({"ok": False, "error": "unit_id is required"}), 400

    set_clauses, params = [], []

    if "title" in data and data["title"] not in (None, ""):
        set_clauses.append("Title=%s"); params.append(data["title"])
    if "unit_id_new" in data and data["unit_id_new"] not in (None, ""):
        set_clauses.append("Unit_id=%s"); params.append(data["unit_id_new"])
    if "course_description" in data and data["course_description"] not in (None, ""):
        set_clauses.append("Course_description=%s"); params.append(data["course_description"])
    if "course_director" in data and data["course_director"] not in (None, ""):
        set_clauses.append("Course_director=%s"); params.append(data["course_director"])
    if "activity" in data and data["activity"] not in (None, ""):
        set_clauses.append("Activity=%s"); params.append(str(data["activity"]).lower())
    if "total_credit" in data and data["total_credit"] not in (None, ""):
        try:
            set_clauses.append("Total_credit=%s"); params.append(int(data["total_credit"]))
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "total_credit must be a number"}), 400
    if "active_classrooms_count" in data and data["active_classrooms_count"] not in (None, ""):
        try:
            set_clauses.append("Active_Classrooms_Count=%s"); params.append(int(data["active_classrooms_count"]))
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "active_classrooms_count must be a number"}), 400


    if not set_clauses:
        # nothing to change, but still return the current row if it exists
        db = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute("SELECT * FROM Courses WHERE Unit_id=%s", (unit_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Course not found"}), 404
        return jsonify({"ok": True, "course": row})

    db = get_db()
    cur = db.cursor(dictionary=True)

    try:
        # 1) Make sure the course exists
        cur.execute("SELECT 1 FROM Courses WHERE Unit_id=%s", (unit_id,))
        exists = cur.fetchone()
        if not exists:
            return jsonify({"ok": False, "error": "Course not found"}), 404

        # 2) Update (may affect 0 rows if values are identical — that’s OK)
        sql_update = f"UPDATE Courses SET {', '.join(set_clauses)} WHERE Unit_id=%s"
        cur.execute(sql_update, params + [unit_id])
        db.commit()

        # If Unit_id was renamed, use the new one to fetch
        unit_id_to_fetch = data.get("unit_id_new") or unit_id

        # 3) Return the full current row
        cur.execute(
            """
            SELECT
              Unit_id,
              Title,
              Course_description,
              Course_director,
              Total_credit,
              Activity,
              Course_made_by,
              Date_created, 
              Active_Classrooms_Count,
              Date_updated
            FROM Courses
            WHERE Unit_id=%s
            """,
            (unit_id_to_fetch,)
        )
        row = cur.fetchone()
        return jsonify({"ok": True, "course": row})

    except mysql.connector.IntegrityError as e:
        db.rollback()
        return jsonify({"ok": False, "error": str(e)}), 409
    except mysql.connector.Error as e:
        db.rollback()
        return jsonify({"ok": False, "error": f"MySQL error: {e}"}), 400
    
@app.route("/assignment_get", methods=["GET"])
def fetch_assignments():
    lesson_id = request.args.get("lesson_id")

    if not lesson_id:
        return jsonify({"error": "lesson_id is required"}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    query = """
        SELECT lm.material_id, lm.title, lm.material_type, lm.content_url,
               COALESCE(smc.completed, FALSE) AS completed
        FROM Lesson_Materials lm
        LEFT JOIN Student_Material_Completion smc
               ON lm.material_id = smc.material_id AND smc.student_id = %s
        WHERE lm.lesson_id = %s AND lm.material_type = 'assignment'
    """
    cursor.execute(query, (session.get('user_id'), lesson_id,))
    lesson_mat = cursor.fetchall()

    mat = [
        {
            "id": r["material_id"],
            "title": r["title"],
            "content_url": r["content_url"],
            "completed": bool(r["completed"])
        }
        for r in lesson_mat
    ]

    return jsonify(mat), 200


@app.route("/reading_get", methods=["GET"])
def fetch_reading():
    lesson_id = request.args.get("lesson_id")

    if not lesson_id:
        return jsonify({"error": "lesson_id is required"}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    query = """
        SELECT lm.material_id, lm.title, lm.material_type, lm.content_url,
               COALESCE(smc.completed, FALSE) AS completed
        FROM Lesson_Materials lm
        LEFT JOIN Student_Material_Completion smc
               ON lm.material_id = smc.material_id AND smc.student_id = %s
        WHERE lm.lesson_id = %s AND lm.material_type = 'reading'
    """
    cursor.execute(query, (session.get('user_id'), lesson_id,))
    lesson_mat = cursor.fetchall()

    mat = [
        {
            "id": r["material_id"],
            "title": r["title"],
            "content_url": r["content_url"],
            "completed": bool(r["completed"])
        }
        for r in lesson_mat
    ]

    return jsonify(mat), 200

@app.route("/update_material_completion", methods=["POST"])
def update_material_completion():
    data = request.get_json()
    material_id = data.get("id")
    completed = data.get("completed")
    student_id = session.get('user_id') 

    if material_id is None or completed is None or student_id is None:
        return jsonify({"status": "error", "message": "id, completed, and student_id are required"}), 400

    db = get_db()
    cursor = db.cursor()
    try:
        query = """
            INSERT INTO Student_Material_Completion (student_id, material_id, completed)
            VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE completed = %s"""
        cursor.execute(query, (student_id, material_id, int(bool(completed)), int(bool(completed))))
        db.commit()
        return jsonify({"status": "success"})  # <<--- MUST return a response
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/add_assignment", methods=["POST"])
def add_assignment():
    data = request.get_json()
    lesson_id = data.get("lesson_id")
    title = data.get("title")
    db = get_db()  # your MySQL connection
    cursor = db.cursor(dictionary=True)

    if not lesson_id or not title:
        return jsonify({"status": "error", "message": "Missing lesson_id or title"}), 400

    try:
        cursor.execute(
            """
            INSERT INTO Lesson_Materials (lesson_id, title, material_type)
            VALUES (%s, %s, %s)
            """,
            (lesson_id, title, "assignment")
        )
        db.commit()

        new_id = cursor.lastrowid
        cursor.execute(
            "SELECT material_id, title FROM Lesson_Materials WHERE material_id = %s",
            (new_id,)
        )
        new_assignment = cursor.fetchone()

        return jsonify({
            "status": "success",
            "assignment": new_assignment
        })

    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    
@app.route("/edit_material", methods=["POST"])
def edit_material():
    data = request.get_json()
    material_id = data.get("id")
    title = data.get("title")

    if not material_id or not title:
        return jsonify({"status": "error", "message": "id and title required"}), 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute("UPDATE Lesson_Materials SET title = %s WHERE material_id = %s", (title, material_id))
    db.commit()
    return jsonify({"status": "success"})


@app.route("/delete_material", methods=["POST"])
def delete_material():
    data = request.get_json()
    material_id = data.get("id")

    if not material_id:
        return jsonify({"status": "error", "message": "id required"}), 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute("DELETE FROM Lesson_Materials WHERE material_id = %s", (material_id,))
    db.commit()
    return jsonify({"status": "success"})
@app.route("/add_reading", methods=["POST"])
def add_reading():
    data = request.get_json()
    lesson_id = data.get("lesson_id")
    title = data.get("title")
    db = get_db()
    cursor = db.cursor(dictionary=True)

    if not lesson_id or not title:
        return jsonify({"status": "error", "message": "Missing lesson_id or title"}), 400

    try:
        cursor.execute(
            """
            INSERT INTO Lesson_Materials (lesson_id, title, material_type)
            VALUES (%s, %s, %s)
            """,
            (lesson_id, title, "reading")
        )
        db.commit()

        new_id = cursor.lastrowid
        cursor.execute(
            "SELECT material_id, title FROM Lesson_Materials WHERE material_id = %s",
            (new_id,)
        )
        new_reading = cursor.fetchone()

        return jsonify({
            "status": "success",
            "reading": new_reading
        })

    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
@app.route("/classrooms", methods=["GET"])
def get_classrooms():
    db = get_db()
    cursor = db.cursor(dictionary=True)

    instructor_id = request.args.get("instructorId", type=int)
    lesson_id = request.args.get("lesson_id", type=int)  # New optional filter

    try:
        if instructor_id is None and lesson_id is None:
            query = """
                SELECT classroom_id, classroom_name, instructor_id, unit_id
                FROM Classroom
                ORDER BY classroom_id
            """
            cursor.execute(query)
        elif lesson_id is None:
            # Filter by instructor only
            query = """
                SELECT classroom_id, classroom_name, instructor_id, unit_id
                FROM Classroom
                WHERE instructor_id = %s
                ORDER BY classroom_id
            """
            cursor.execute(query, (instructor_id,))
        elif instructor_id is None:
            # Filter by lesson only (exclude classrooms that already have the lesson)
            query = """
                SELECT c.classroom_id, c.classroom_name, c.instructor_id, c.unit_id
                FROM Classroom c
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM Classroom_Lessons cl
                    WHERE cl.classroom_id = c.classroom_id
                      AND cl.lesson_id = %s
                )
                ORDER BY c.classroom_id
            """
            cursor.execute(query, (lesson_id,))
        else:
            # Filter by both instructor and lesson
            query = """
                SELECT c.classroom_id, c.classroom_name, c.instructor_id, c.unit_id
                FROM Classroom c
                WHERE c.instructor_id = %s
                  AND NOT EXISTS (
                    SELECT 1
                    FROM Classroom_Lessons cl
                    WHERE cl.classroom_id = c.classroom_id
                      AND cl.lesson_id = %s
                  )
                ORDER BY c.classroom_id
            """
            cursor.execute(query, (instructor_id, lesson_id))

        rows = cursor.fetchall()
        classrooms = [{
            "classroom_id": r["classroom_id"],
            "classroom_name": r["classroom_name"],
            "instructor_id": r["instructor_id"],
            "unit_id": r["unit_id"]
        } for r in rows]

        return jsonify({"found": True, "results": classrooms})
    except mysql.connector.Error as e:
        return jsonify({"found": False, "error": str(e)}), 500




@app.route("/create_classrooms", methods=["POST"])
def create_classroom():
    unit_id = "FIT0001"
    classroom_name = f"New {int(time.time())}"
    instructor_id = 1 
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            "INSERT INTO Classroom (unit_id, classroom_name, instructor_id) VALUES (%s, %s, %s)",
            (unit_id, classroom_name, instructor_id,)
        )
        db.commit()
        new_id = cursor.lastrowid

        details = {"classroom_name" : classroom_name, "classroom_id":new_id, "unit_id" : unit_id}
        return jsonify({"status": "success", "message": "Classroom created", "details": details}), 201
    except mysql.connector.IntegrityError:
        db.rollback()
        return jsonify({"status": "error", "message": "A classroom with this name already exists for this course."}), 409
    except mysql.connector.Error as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/del_classrooms/<int:classroom_id>", methods=["DELETE"])
def delete_classroom(classroom_id):
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM Classroom WHERE classroom_id = %s", (classroom_id,))
        db.commit()
        if cursor.rowcount == 0:
            return jsonify({"status": "error", "message": "Classroom not found"}), 404
        return jsonify({"status": "success", "message": "Classroom deleted"})
    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
@app.route("/available_classrooms", methods=["GET"])
def get_available_classrooms():
    student_id = session.get('user_id')
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        # Step 1: Get the list of courses the student is enrolled in
        cursor.execute("""
            SELECT e.Unit_id
            FROM Enrollment e
            WHERE e.Student_id = %s
        """, (student_id,))
        enrolled_courses = [row['Unit_id'] for row in cursor.fetchall()]

        # Debugging output
        print(f"Student enrolled in the following courses: {enrolled_courses}")

        if not enrolled_courses:
            return jsonify({"status": "error", "message": "Student is not enrolled in any courses."}), 400

        # Step 2: Fetch classrooms linked to the student's enrolled courses
        # Use the IN clause to fetch classrooms for all enrolled courses
        cursor.execute("""
            SELECT c.classroom_id, c.classroom_name, i.Ins_name
            FROM Classroom c
            LEFT JOIN Instructors i ON c.instructor_id = i.Ins_id
            WHERE c.unit_id IN (%s)
        """ % ','.join(['%s'] * len(enrolled_courses)), tuple(enrolled_courses))

        all_classrooms = cursor.fetchall()
        print(f"Fetched classrooms: {all_classrooms}")

        if not all_classrooms:
            return jsonify({"status": "error", "message": "No classrooms found for the enrolled courses."}), 404

        # Step 3: Return the classrooms that the student can enroll in
        return jsonify({"found": True, "results": all_classrooms})

    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/enroll_classroom", methods=["POST"])
def enroll_in_classroom():
    classroom_id = request.form.get("classroom_id")
    student_id = session.get('user_id')
    db = get_db()
    cursor = db.cursor()

    if not classroom_id:
        return jsonify({"status": "error", "message": "Classroom ID is required."}), 400

    try:
        cursor.execute("INSERT INTO Classroom_Enrollment (student_id, classroom_id) VALUES (%s, %s)", (student_id, classroom_id))
        db.commit()
        return jsonify({"status": "success", "message": f"Successfully enrolled in classroom {classroom_id}."})
    except mysql.connector.IntegrityError:
        return jsonify({"status": "error", "message": "Already enrolled in this classroom."}), 409
@app.route("/get_enrolled_classrooms", methods=["GET"])
def get_enrolled_classrooms():
    student_id = session.get('user_id')
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT c.classroom_id, c.classroom_name
            FROM Classroom c
            JOIN Classroom_Enrollment ce ON ce.classroom_id = c.classroom_id
            WHERE ce.student_id = %s
        """, (student_id,))
        rows = cursor.fetchall()
        print(rows)

        return jsonify({"status": "success", "classrooms": rows})
    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500
# --- Update lesson info ---
@app.route("/api/lessons/<int:lesson_id>", methods=["PUT"])
def update_lesson(lesson_id):
    data = request.get_json(force=True)

    title         = data.get("title")
    objective     = data.get("objective")
    description   = data.get("description")
    estimated_time = data.get("estimated_time")
    designer_id     = data.get("designer_id")  # 👈 NEW: numeric id from dropdown
    unit_id = (data.get("unit_id") or "").strip() or None

    db = get_db()
    cur = db.cursor(dictionary=True)

    # Make sure lesson exists
    cur.execute("SELECT 1 FROM Lessons WHERE lesson_id=%s", (lesson_id,))
    if not cur.fetchone():
        return jsonify({"ok": False, "error": "Lesson not found"}), 404

    # Build dynamic SQL
    updates, params = [], []
    if title is not None:
        updates.append("title=%s"); params.append(title)
    if objective is not None:
        updates.append("objectives=%s"); params.append(objective)
    if description is not None:
        updates.append("description=%s"); params.append(description)
    if estimated_time is not None:
        updates.append("estimated_time_hours=%s"); params.append(estimated_time)
    if designer_id is not None:
        try:
            updates.append("designer_id=%s"); params.append(int(designer_id))
        except ValueError:
            return jsonify({"ok": False, "error": "designer_id must be an integer"}), 400
    if unit_id is not None:
        # make sure the course exists
        cur.execute("SELECT 1 FROM Courses WHERE Unit_id=%s", (unit_id,))
        if not cur.fetchone():
            return jsonify({"ok": False, "error": "Unit (course) not found"}), 400
        updates.append("unit_id=%s"); params.append(unit_id)
        

    if updates:
        sql = f"UPDATE Lessons SET {', '.join(updates)}, date_updated=NOW() WHERE lesson_id=%s"
        params.append(lesson_id)
        cur.execute(sql, tuple(params))
        db.commit()

    # Return updated row (including instructor name)
    cur.execute("""
        SELECT l.lesson_id, l.title, l.objectives, l.description,
               l.estimated_time_hours, l.designer_id, i.Ins_name AS instructor,
               l.date_created, l.date_updated
        FROM Lessons l
        LEFT JOIN Instructors i ON l.designer_id = i.Ins_id
        WHERE l.lesson_id=%s
    """, (lesson_id,))
    updated = cur.fetchone()
    return jsonify({"ok": True, "lesson": updated})

@app.route("/sidebar_classroom_ins")
def render_sidebar_classroom():
    return render_template("classroom_instructor.html")

@app.route("/sidebar_classroom_std")
def render_sidebar_classroom_2():
    return render_template("classroom_student.html")

@app.route("/sidebar_classroom_ins_2")
def render_sidebar_classroom_3():
    return render_template("sidebar_classroom_instructor.html")

@app.route("/sidebar_classroom_std_2")
def render_sidebar_classroom_4():
    return render_template("sidebar_classroom_student.html")
@app.route("/drop_down_class", methods = ["GET"])
def get_classrooms_lessons_add():
    ins_id = 1
    db = get_db()
    cursor = db.cursor()

    try:
        cursor.execute("SELECT classroom_id,classroom_name, instructor_id FROM Classroom WHERE instructor_id = %s",(ins_id,))
        classrooms_row = cursor.fetchall()
        classrooms = [
    {
        "classroom_id": r[0],
        "classroom_name": r[1],
        "instructor_id": r[2]
    }
    for r in classrooms_row
]
        print(classrooms)
        return jsonify({"found": True, "results": classrooms})
    except mysql.connector.Error as e:
        print(f"Error details students: {e}")
     
@app.route("/student_classroom", methods=["GET"])
def fetch_student_classroom():
    db = get_db()
    student_id = session.get("user_id")
    cursor = db.cursor()

    try:
        cursor.execute("SELECT classroom_id FROM Classroom_Enrollment WHERE student_id=%s",(student_id,))
        classrooms_to_fetch = cursor.fetchall()
        if not classrooms_to_fetch:
            return jsonify({"found": False, "results": []})

        ids = [r[0] for r in classrooms_to_fetch]
        format_strings = ','.join(['%s'] * len(ids))
        cursor.execute(
            f"SELECT classroom_id, classroom_name, unit_id FROM Classroom WHERE classroom_id IN ({format_strings})",
            tuple(ids)
        )
        class_row = cursor.fetchall()
        classrooms = [{"classroom_name":r[1],"classroom_id":r[0], "unit_id" : r[2]} for r in class_row]
        print(classrooms)
        return jsonify({"found": True, "results": classrooms})
    except mysql.connector.Error as e:
        print(f"Error details students: {e}")

@app.route("/unenroll_classroom", methods=["POST"])
def unenroll_from_classroom():
    classroom_id = request.form.get("classroom_id")
    student_id = session.get('user_id')
    db = get_db()
    cursor = db.cursor()

    if not classroom_id:
        return jsonify({"status": "error", "message": "Classroom ID is required."}), 400

    try:
        cursor.execute("DELETE FROM Classroom_Enrollment WHERE student_id = %s AND classroom_id = %s", (student_id, classroom_id))
        db.commit()
        return jsonify({"status": "success", "message": f"Successfully unenrolled from classroom {classroom_id}."})
    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500
@app.route("/add_lesson_to_classroom", methods = ["POST", "GET"])
def add_lesson_to_classroom():
    data = request.json  # since frontend sends JSON
    classroom_name = data.get("classroom_name")
    lesson_id = data.get("lesson_id")
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("SELECT classroom_id FROM Classroom WHERE classroom_name = %s",(classroom_name,))
        class_id = cursor.fetchone()

        cursor.execute("INSERT INTO Classroom_Lessons (lesson_id,classroom_id) VALUES (%s,%s)",(lesson_id,class_id[0],))
        db.commit()
               
        return jsonify({
            "status": "success", 
            "message": f"Lesson {lesson_id} added to classroom {classroom_name}"
        }), 201

    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
@app.route("/api/lessons/<int:lesson_id>/prerequisites", methods=["GET"])
def get_lesson_prerequisites(lesson_id):
    db = get_db()
    cur = db.cursor(dictionary=True)

    # Get the lesson's unit_id first
    cur.execute("SELECT unit_id, prerequisite_lesson_id FROM Lessons WHERE lesson_id = %s", (lesson_id,))
    lesson = cur.fetchone()

    if not lesson:
        return jsonify({"ok": False, "error": "Lesson not found"}), 404

    # Use the correct column name ("title")
    cur.execute(
        "SELECT lesson_id, title FROM Lessons WHERE unit_id = %s AND lesson_id != %s ORDER BY lesson_id",
        (lesson['unit_id'], lesson_id) 
    )
    available_lessons = cur.fetchall()

    print("Available lessons for prerequisites:", available_lessons)  # debug

    return jsonify({
        "ok": True,
        "current_prerequisite": lesson['prerequisite_lesson_id'],
        "available_lessons": available_lessons
    })



@app.route("/api/lessons/<int:lesson_id>/prerequisites", methods=["PUT"])
def update_lesson_prerequisite(lesson_id):
    """Update prerequisite for a lesson"""
    data = request.get_json(force=True) or {}
    prerequisite_id = data.get("prerequisite_lesson_id")
    
    # Allow None to remove prerequisite
    if prerequisite_id == "":
        prerequisite_id = None
    elif prerequisite_id is not None:
        try:
            prerequisite_id = int(prerequisite_id)
        except (ValueError, TypeError):
            return jsonify({"ok": False, "error": "Invalid prerequisite lesson ID"}), 400
    
    db = get_db()
    cur = db.cursor(dictionary=True)
    
    # Verify lesson exists
    cur.execute("SELECT unit_id FROM Lessons WHERE lesson_id = %s", (lesson_id,))
    lesson = cur.fetchone()
    if not lesson:
        return jsonify({"ok": False, "error": "Lesson not found"}), 404
    
    # If setting a prerequisite, verify it exists and is in the same unit
    if prerequisite_id is not None:
        cur.execute("SELECT unit_id FROM Lessons WHERE lesson_id = %s", (prerequisite_id,))
        prereq_lesson = cur.fetchone()
        
        if not prereq_lesson:
            return jsonify({"ok": False, "error": "Prerequisite lesson not found"}), 404
        
        if prereq_lesson['unit_id'] != lesson['unit_id']:
            return jsonify({"ok": False, "error": "Prerequisite must be from the same course"}), 400
        
        # Prevent circular dependencies
        if prerequisite_id == lesson_id:
            return jsonify({"ok": False, "error": "A lesson cannot be a prerequisite of itself"}), 400
    
    try:
        cur.execute("""
            UPDATE Lessons 
            SET prerequisite_lesson_id = %s, date_updated = NOW() 
            WHERE lesson_id = %s
        """, (prerequisite_id, lesson_id))
        db.commit()
        
        return jsonify({"ok": True, "message": "Prerequisite updated successfully"})
    
    except mysql.connector.Error as e:
        db.rollback()
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/lessons/status/<int:student_id>/<int:lesson_id>", methods=["GET"])
def get_lesson_status(lesson_id):
    """Get lesson status for a specific student"""
    student_id = session.get('user_id') 
    if not student_id: return jsonify({"ok": False, "error": "Student not logged in"}), 401
    status = PrerequisiteManager.get_prerequisite_status(student_id, lesson_id) 
    completed = PrerequisiteManager.check_lesson_completion(student_id, lesson_id) 
    
    return jsonify({
        "ok": True,
        "lesson_id": lesson_id,
        "locked": status["locked"],
        "completed": completed,
        "prerequisite_lesson": status["prerequisite_lesson"]
    })

@app.route("/api/courses/<unit_id>/lessons/status/<int:student_id>", methods=["GET"])
def get_course_lessons_status(unit_id):
    """Get all lessons for a course with their status for a specific student"""
    student_id = session.get('user_id') 
    if not student_id: return jsonify({"ok": False, "error": "Student not logged in"}), 401
    lessons = PrerequisiteManager.get_lessons_with_status(student_id, unit_id) 
    return jsonify({
        "ok": True,
        "unit_id": unit_id,
        "student_id": student_id,
        "lessons": lessons
    })

@app.route("/api/lessons/<int:lesson_id>/completion-stats", methods=["GET"])
def get_lesson_completion_stats(lesson_id):
    try:
        db = get_db()
        cur = db.cursor(dictionary=True)
        
        # Get students enrolled in the course this lesson belongs to
        cur.execute("""
            SELECT COUNT(DISTINCT s.Student_id) as total_students
            FROM Students s
            JOIN Enrollment e ON s.Student_id = e.Student_id
            JOIN Lessons l ON e.Unit_id = l.unit_id
            WHERE l.lesson_id = %s AND e.Status = 'active'
        """, (lesson_id,))
        
        total_result = cur.fetchone()
        total_students = total_result['total_students'] if total_result else 0
        
        # Count students who have completed this lesson
        completed_students = 0
        if total_students > 0:
            cur.execute("""
                SELECT s.Student_id
                FROM Students s
                JOIN Enrollment e ON s.Student_id = e.Student_id
                JOIN Lessons l ON e.Unit_id = l.unit_id
                WHERE l.lesson_id = %s AND e.Status = 'active'
            """, (lesson_id,))
            
            students = cur.fetchall()
            for student in students:
                if PrerequisiteManager.check_lesson_completion(student['Student_id'], lesson_id):
                    completed_students += 1
        
        completion_rate = (completed_students / total_students * 100) if total_students > 0 else 0
        
        return jsonify({
            "ok": True,
            "stats": {
                "total_students": total_students,
                "completed_students": completed_students,
                "completion_rate": round(completion_rate, 1)
            }
        })
        
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500




# ================== CLASSROOM API (CLEAN) ==================
def _to_int_or_none(v):
    try:
        if v is None or str(v).strip() == "":
            return None
        return int(v)
    except (TypeError, ValueError):
        return None

@app.route("/api/instructors", methods=["GET"])
def api_get_instructors():
    """Return list of instructors for dropdown."""
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute("SELECT Ins_id AS id, Ins_name AS name FROM Instructors ORDER BY Ins_name")
    rows = cur.fetchall()
    return jsonify({"ok": True, "instructors": rows})

@app.route("/indi_classroom", methods=["GET"])
def indi_classroom():
    """
    Returns one classroom with instructor name, duration, students, and lessons.
    Expects ?classroom_id=...
    """
    classroom_id = request.args.get("classroom_id")
    try:
        cid = int(classroom_id)
    except (TypeError, ValueError):
        return jsonify({"found": False, "results": []}), 400

    db = get_db()
    cur = db.cursor(dictionary=True)

    # Base classroom row (add duration)
    cur.execute("""
        SELECT c.classroom_id,
               c.classroom_name,
               c.unit_id,
               c.instructor_id,
               c.duration,
               COALESCE(i.Ins_name, '') AS instructor_name
        FROM Classroom c
        LEFT JOIN Instructors i ON c.instructor_id = i.Ins_id
        WHERE c.classroom_id=%s
    """, (cid,))
    row = cur.fetchone()
    if not row:
        return jsonify({"found": False, "results": []}), 404

    # Students in this classroom
    cur.execute("""
        SELECT s.Student_id, s.First_name, s.Last_name
        FROM Classroom_Enrollment ce
        JOIN Students s ON s.Student_id = ce.student_id
        WHERE ce.classroom_id = %s
        ORDER BY s.Last_name, s.First_name
    """, (cid,))
    studs = cur.fetchall()
    students = [
        {"student_id": r["Student_id"], "full_name": f'{r["First_name"]} {r["Last_name"]}'}
        for r in studs
    ]

    # Lessons linked to this classroom
    cur.execute("""
        SELECT l.lesson_id, l.title, l.credits
        FROM Classroom_Lessons cl
        JOIN Lessons l ON l.lesson_id = cl.lesson_id
        WHERE cl.classroom_id = %s
        ORDER BY l.lesson_id
    """, (cid,))
    less = cur.fetchall()
    lessons = [
        {"lesson_id": r["lesson_id"], "title": r["title"], "credit": r["credits"]}
        for r in less
    ]

    result = {
        "classroom_id": row["classroom_id"],
        "classroom_name": row["classroom_name"],
        "unit_id": row["unit_id"],
        "instructor_id": row["instructor_id"],
        "instructor_name": row["instructor_name"],
        "duration": row["duration"],           # ← now included
        "students": students,                   # ← now included
        "lessons": lessons                      # ← included too (optional)
    }
    return jsonify({"found": True, "results": [result]})
@app.route("/durations", methods=["GET"])
def get_durations():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT label FROM DurationOptions")
        rows = cursor.fetchall()
        durations = [row["label"] for row in rows]
        return jsonify({"status": "success", "durations": durations}), 200
    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/classrooms/<int:classroom_id>", methods=["PUT"])
def api_update_classroom(classroom_id):
    data = request.get_json(force=True) or {}
    classroom_id_new = _to_int_or_none(data.get("classroom_id_new"))
    instructor_id    = _to_int_or_none(data.get("instructor_id"))
    classroom_name   = (data.get("classroom_name") or "").strip() or None
    duration         = (data.get("duration") or "").strip() or None   # <-- add
    unit_id          = (data.get("unit_id") or "").strip() or None      # <-- add

    db = get_db()
    cur = db.cursor(dictionary=True)

    cur.execute("""
        SELECT classroom_id, unit_id, instructor_id, classroom_name, duration
        FROM Classroom
        WHERE classroom_id=%s
    """, (classroom_id,))
    row = cur.fetchone()

    if not row:
        return jsonify({"ok": False, "error": "Classroom not found"}), 404

    sets, params = [], []

    if instructor_id is not None:
        cur.execute("SELECT 1 FROM Instructors WHERE Ins_id=%s", (instructor_id,))
        if not cur.fetchone():
            return jsonify({"ok": False, "error": "Instructor not found"}), 400
        sets.append("instructor_id=%s"); params.append(instructor_id)

    if classroom_name is not None:
        sets.append("classroom_name=%s"); params.append(classroom_name)

    if duration is not None:                     # <-- add
        sets.append("duration=%s"); params.append(duration)

    if unit_id is not None:                                          # <-- add
        cur.execute("SELECT 1 FROM Courses WHERE Unit_id=%s", (unit_id,))
        if not cur.fetchone():
            return jsonify({"ok": False, "error": "Unit (course) not found"}), 400
        sets.append("unit_id=%s"); params.append(unit_id)

    if sets:
        try:
            sql = f"UPDATE Classroom SET {', '.join(sets)} WHERE classroom_id=%s"
            params.append(classroom_id)
            cur.execute(sql, tuple(params))
            db.commit()
        except mysql.connector.IntegrityError as e:
            if e.errno == 1062:
                return jsonify({"ok": False, "error": "A classroom with that name already exists for this course."}), 409
            raise

    if classroom_id_new is not None and classroom_id_new != classroom_id:
        cur.execute("SELECT 1 FROM Classroom WHERE classroom_id=%s", (classroom_id_new,))
        if cur.fetchone():
            return jsonify({"ok": False, "error": "Target classroom_id already exists"}), 409
        cur.execute("UPDATE Classroom SET classroom_id=%s WHERE classroom_id=%s",
                    (classroom_id_new, classroom_id))
        db.commit()
        classroom_id = classroom_id_new

    cur.execute("""
        SELECT c.classroom_id,
               c.classroom_name,
               c.unit_id,
               c.instructor_id,
               c.duration,                          -- <-- add
               COALESCE(i.Ins_name, '') AS instructor_name
        FROM Classroom c
        LEFT JOIN Instructors i ON c.instructor_id = i.Ins_id
        WHERE c.classroom_id=%s
    """, (classroom_id,))
    row = cur.fetchone()
    return jsonify({"ok": True, "classroom": row})

@app.route("/api/units", methods=["GET"])
def api_units():
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute("SELECT Unit_id AS unit_id, Title AS title FROM Courses ORDER BY Unit_id")
    rows = cur.fetchall()
    return jsonify({"ok": True, "units": rows})

@app.route("/remove_from_all_classes", methods=["DELETE", "POST"])
def remove_from_all_classes():
    student_id = session.get('user_id')
    db = get_db()
    cursor = db.cursor()

    try:
        cursor.execute("DELETE FROM Classroom_Enrollment WHERE student_id = %s", (student_id,))
        cursor.execute("DELETE FROM Enrollment WHERE student_id = %s",(student_id,))
        cursor.execute("UPDATE Students SET Activity =%s WHERE Student_id = %s",("inactive",student_id,))
        cursor.execute("UPDATE Logins SET activity_status = %s WHERE user_ref_id = %s", ("inactive", student_id))
        db.commit()


        return jsonify({"status": "success", "message": "Successfully removed from all classrooms."})
    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500 
@app.route("/set_active", methods=["POST"])
def set_active():
    body = request.get_json(silent=True) or {}
    student_id = body.get("studentId") or session.get('user_id')

    db = get_db()
    cursor = db.cursor()
    try:
        # Update Students table
        cursor.execute(
            "UPDATE Students SET Activity = %s WHERE Student_id = %s",
            ("active", student_id)
        )

        # Update Logins table (use user_ref_id instead of student_id)
        cursor.execute(
            "UPDATE Logins SET activity_status = %s WHERE user_ref_id = %s",
            ("active", student_id)
        )

        db.commit()
        return jsonify({
            "status": "success",
            "message": f"Student {student_id} set to active successfully."
        }), 200

    except mysql.connector.Error as e:
        db.rollback()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

    finally:
        cursor.close()


@app.route("/admin")
def admin():
    return render_template("admin_management.html")

@app.route("/logins", methods = ["POST"])
def logins():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    email = request.form.get("email")
    password = request.form.get("password")

    try:
        cursor.execute("SELECT user_ref_id,user_type, theme_preference,activity_status, font_preference FROM Logins WHERE email = %s AND password_hash = %s",(email,password,))
        user_ref = cursor.fetchone()

        if not user_ref:
            return jsonify({"status": "error", "message": "Invalid email or password"}), 401
        session['user_id'] = user_ref['user_ref_id']
        session['user_type'] = user_ref['user_type']
        session.permanent = True
        session.modified = True
        if user_ref["user_type"] == "admin":
           return jsonify({"status": "success", "redirect": "/admin","theme": user_ref["theme_preference"], "activity": user_ref["activity_status"], "font": user_ref["font_preference"]})
        elif user_ref["user_type"] == "instructor":
            return jsonify({"status": "success", "redirect": "/instructor_course_management", "theme": user_ref["theme_preference"], "activity": user_ref["activity_status"], "font": user_ref["font_preference"]})
        elif user_ref["user_type"] == "student":
            return jsonify({"status": "success", "redirect": "/student_course_management","theme": user_ref["theme_preference"], "activity": user_ref["activity_status"], "font": user_ref["font_preference"]})
        else:
            return jsonify({"status": "error", "message": "Unkn own user type"}), 400    

    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
@app.route("/theme_change", methods = ["POST"])
def theme_change():
    db = get_db()
    cursor = db.cursor()
    theme = request.form.get("theme")
    student_id = session.get('user_id')

    try:
        cursor.execute("UPDATE Logins SET theme_preference = %s WHERE user_ref_id = %s",(theme,student_id,))
        db.commit()
        return jsonify({"status": "success", "message": "Theme updated successfully."}), 200
    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
@app.route("/font_change", methods=["POST"])
def font_change():
    db = get_db()
    cursor = db.cursor()
    font = request.form.get("font")
    student_id = session.get("user_id")  # ✅ Matches login session key

    # --- Validation checks ---
    if not student_id:
        return jsonify({"status": "error", "message": "User not logged in"}), 401
    if not font:
        return jsonify({"status": "error", "message": "Missing 'font' value"}), 400

    try:
        # --- Update the user's font preference ---
        cursor.execute(
            "UPDATE Logins SET font_preference = %s WHERE user_ref_id = %s",
            (font, student_id)
        )
        db.commit()

        # --- Optional debug log ---
        print(f"✅ Updated font for user {student_id} → {font}")

        return jsonify({
            "status": "success",
            "message": "Font preference updated successfully."
        }), 200

    except mysql.connector.Error as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        cursor.close()
@app.route("/get_font", methods=["GET"])
def get_font():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    student_id = session.get("user_id")

    if not student_id:
        return jsonify({"status": "error", "message": "User not logged in"}), 401

    try:
        cursor.execute(
            "SELECT font_preference FROM Logins WHERE user_ref_id = %s", (student_id,)
        )
        font = cursor.fetchone()
        if not font or not font["font_preference"]:
            return jsonify({"status": "success", "font": None}), 200

        print("🎨 Loaded font preference:", font["font_preference"])
        return jsonify({"status": "success", "font": font["font_preference"]}), 200

    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    

@app.route("/create_ins", methods=["POST"])
def create_ins():
    db = get_db()
    cursor = db.cursor()
    data = request.get_json()
    ins_name = data.get("ins_name")
    email = data.get("email")
    password = data.get("password")

    if not (ins_name and email and password):
        return jsonify({"status": "error", "message": "Missing required fields."}), 400
    
    try:
        # Step 1: Insert the new instructor's name.
        cursor.execute("INSERT INTO Instructors (Ins_name) VALUES (%s)", (ins_name,))
        
        # Get the ID of the instructor we JUST created.
        new_instructor_id = cursor.lastrowid

        # Step 2: Insert the login details with the plain-text password and new ID.
        cursor.execute(
            "INSERT INTO Logins (email, password_hash, user_type, user_ref_id) VALUES (%s, %s, %s, %s)",
            (email, password, "instructor", new_instructor_id)
        )

        db.commit()
        return jsonify({
            "status": "success", 
            "message": "Instructor created successfully."
        }), 201 # 201 Created is a more appropriate status code here.

    except mysql.connector.Error as e:
        db.rollback()
        # ✅ Step 3: Specifically check for the "duplicate entry" error.
        if e.errno == 1062: # MySQL error number for a duplicate entry.
            if 'email' in e.msg:
                return jsonify({"status": "error", "message": f"An account with the email '{email}' already exists."}), 409 # 409 Conflict
            else:
                return jsonify({"status": "error", "message": f"An instructor with the name '{ins_name}' already exists."}), 409
        
        # For all other database errors, return a generic 500.
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/delete_ins", methods = ["DELETE"])
def delete_ins():
    db = get_db()
    cursor = db.cursor()
    data = request.get_json()
    ins_id = data.get("ins_id")

    try:
        cursor.execute("UPDATE Courses SET Course_made_by = NULL WHERE Course_made_by = %s", (ins_id,))
        cursor.execute("DELETE FROM Logins WHERE user_ref_id = %s",(ins_id,))
        cursor.execute("DELETE FROM Instructors WHERE Ins_id = %s",(ins_id,))
        db.commit()
        return jsonify({"status": "success", "message": "Instructor deleted successfully."}), 200
    except mysql.connector.Error as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    
@app.route("/render_ins", methods=["GET"])
def render_ins():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT Instructors.Ins_id AS id,
                   Instructors.Ins_name AS name,
                   Logins.email AS email,
                   Logins.password_hash AS password
            FROM Instructors
            INNER JOIN Logins
              ON Instructors.Ins_id = Logins.user_ref_id
             AND Logins.user_type = 'instructor'
            ORDER BY Instructors.Ins_name
        """)
        rows = cursor.fetchall()
        return jsonify({"status": "success", "results": rows}), 200
    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()



@app.route("/update_ins", methods=["PUT", "POST"])
def update_ins():
    db = get_db()
    cur = db.cursor(dictionary=True)

    data = request.get_json(silent=True) or {}
    ins_id   = data.get("ins_id")
    ins_name = (data.get("ins_name") or "").strip() or None
    email    = (data.get("email") or "").strip() or None
    password = data.get("password")  # if "", we won't change it

    if not ins_id:
        return jsonify({"status": "error", "message": "ins_id is required"}), 400

    try:
        # 1) Make sure instructor exists
        cur.execute("SELECT 1 FROM Instructors WHERE Ins_id=%s", (ins_id,))
        if not cur.fetchone():
            return jsonify({"status": "error", "message": "Instructor not found"}), 404

        # 2) Update Instructors (name)
        if ins_name is not None:
            cur.execute("UPDATE Instructors SET Ins_name=%s WHERE Ins_id=%s", (ins_name, ins_id))

        # 3) Update Logins (email + optional password)
        sets, params = [], []
        if email is not None:
            sets.append("email=%s"); params.append(email)
        if password is not None and password.strip() != "":
            sets.append("password_hash=%s"); params.append(password)

        if sets:
            cur.execute(
                f"UPDATE Logins SET {', '.join(sets)} WHERE user_ref_id=%s AND user_type='instructor'",
                (*params, ins_id)
            )

        db.commit()
        return jsonify({"status": "success", "message": "Instructor updated successfully."}), 200

    except mysql.connector.IntegrityError as e:
        db.rollback()
        m = str(e).lower()
        if e.errno == 1062:
            if "email" in m:
                return jsonify({"status": "error", "message": "Email is already in use."}), 409
            if "instructors" in m or "ins_name" in m:
                return jsonify({"status": "error", "message": "Instructor name already exists."}), 409
        return jsonify({"status": "error", "message": str(e)}), 400
    except mysql.connector.Error as e:
        db.rollback()
        return jsonify({"status": "error", "message": f"MySQL error: {e}"}), 500
    finally:
        cur.close()

@app.route("/student_report_navigation")
def student_report_navigation():
    return render_template("student_report.html")

@app.route("/student_report_data", methods=["GET"])
def student_report_data():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    student_id = session.get("user_id")

    if not student_id:
        return jsonify({
            "status": "error",
            "message": "User not logged in or session expired"
        }), 401

    try:
        # ✅ Optional unit filter
        unit_id = request.args.get("unit_id")

        # ✅ Main query (filter if unit_id provided)
        if unit_id:
            cursor.execute("""
                SELECT 
                u.Unit_id, u.Title, u.Course_description, u.Total_credit 
                FROM Courses u
                JOIN Enrollment e ON u.Unit_id = e.Unit_id
                WHERE e.Student_id = %s AND u.Unit_id = %s
            """, (student_id, unit_id))
        else:
            cursor.execute("""
                SELECT 
                u.Unit_id, u.Title, u.Course_description, u.Total_credit 
                FROM Courses u
                JOIN Enrollment e ON u.Unit_id = e.Unit_id
                WHERE e.Student_id = %s
            """, (student_id,))

        units_enrolled = cursor.fetchall()

        if unit_id and not units_enrolled:
            return jsonify({
                "status": "error",
                "message": "Unit not found or not enrolled"
            }), 404

        # ✅ For each enrolled unit, collect detailed progress
        for unit in units_enrolled:
            uid = unit["Unit_id"]

            cursor.execute("""
                SELECT lesson_id FROM Lessons
                WHERE Lessons.Unit_id = %s
            """, (uid,))
            lessons_in_unit = cursor.fetchall()
            
            total_lessons = len(lessons_in_unit)
            completed_lessons_count = 0

            if total_lessons > 0:
                for lesson in lessons_in_unit:
                    if PrerequisiteManager.check_lesson_completion(student_id, lesson['lesson_id']):
                        completed_lessons_count += 1
            
            unit["total_lessons"] = total_lessons
            unit["completed_lessons"] = completed_lessons_count

            # ---- ASSIGNMENTS ----
            cursor.execute("""
                SELECT COUNT(lm.material_id) AS total_assignments,
                       SUM(CASE WHEN smc.completed = TRUE THEN 1 ELSE 0 END) AS completed_assignments
                FROM Lesson_Materials lm
                JOIN Lessons l ON lm.lesson_id = l.lesson_id
                LEFT JOIN Student_Material_Completion smc
                       ON lm.material_id = smc.material_id AND smc.student_id = %s
                WHERE lm.material_type = 'assignment' AND l.Unit_id = %s
            """, (student_id, uid,))
            result = cursor.fetchone()
            unit["total_assignments"] = int(result["total_assignments"] or 0) if result else 0
            unit["completed_assignments"] = int(result["completed_assignments"] or 0) if result else 0

            # ---- READINGS ----
            cursor.execute("""
                SELECT COUNT(lm.material_id) AS total_reading,
                       SUM(CASE WHEN smc.completed = TRUE THEN 1 ELSE 0 END) AS completed_reading
                FROM Lesson_Materials lm
                JOIN Lessons l ON lm.lesson_id = l.lesson_id
                LEFT JOIN Student_Material_Completion smc
                       ON lm.material_id = smc.material_id AND smc.student_id = %s
                WHERE lm.material_type = 'reading' AND l.Unit_id = %s
            """, (student_id, uid,))
            result = cursor.fetchone()
            unit["total_reading"] = int(result["total_reading"] or 0) if result else 0
            unit["completed_reading"] = int(result["completed_reading"] or 0) if result else 0

        # ✅ Response format: `data` always holds the relevant info
        if unit_id:
            return jsonify({
                "status": "success",
                "data": units_enrolled[0]  # single object (with Unit_id inside)
            }), 200
        else:
            return jsonify({
                "status": "success",
                "data": units_enrolled     # list of objects (each has Unit_id)
            }), 200

    except Exception as e:
        import traceback
        print("ERROR in /student_report_data:", traceback.format_exc())
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
    finally:
        cursor.close()

@app.route("/student_name", methods=["GET"])
def student_name():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    student_id = session.get("user_id")

    if not student_id:
        return jsonify({"status": "error", "message": "User not logged in"}), 401

    try:
        cursor.execute(
            "SELECT COALESCE(Title,'') AS Title, First_name, Last_name "
            "FROM Students WHERE Student_id = %s",
            (student_id,)
        )
        student = cursor.fetchone()
        if not student:
            return jsonify({"status": "error", "message": "Student not found"}), 404

        # Build readable full name with title if present
        title = student["Title"] or ""
        full_name = f"{title + ' ' if title else ''}{student['First_name']} {student['Last_name']}"

        return jsonify({
            "status": "success",
            "student_name": full_name,
            "title": title,
            "first_name": student["First_name"],
            "last_name": student["Last_name"]
        }), 200

    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        cursor.close()

    
# ===== PROFILE API =====

def _require_login():
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"status": "error", "message": "User not logged in"}), 401)
    return uid, None
@app.route("/api/student/profile", methods=["GET"])
def api_student_profile():
    uid = session.get("user_id")
    if not uid:
        return jsonify({"status": "error", "message": "User not logged in"}), 401

    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute("""
        SELECT
            COALESCE(s.Title, '')          AS title,        -- ✅ include title
            s.First_name                   AS firstName,
            s.Last_name                    AS lastName,
            l.email                        AS email,
            l.password_hash                AS password,     -- only if you want to show it
            l.activity_status              AS status,
            COALESCE(l.theme_preference,'light')  AS theme,
            COALESCE(l.font_preference,'medium')  AS font
        FROM Students s
        JOIN Logins l
          ON l.user_ref_id = s.Student_id
         AND l.user_type = 'student'
        WHERE s.Student_id = %s
    """, (uid,))
    row = cur.fetchone()
    if not row:
        return jsonify({"status": "error", "message": "Profile not found"}), 404
    return jsonify({"status": "success", "profile": row}), 200



@app.route("/api/profile", methods=["GET"])
def api_get_profile():
    uid = session.get("user_id")
    if not uid:
        return jsonify({"status": "error", "message": "User not logged in"}), 401

    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute("""
        SELECT 
            s.Student_id   AS student_id,
            COALESCE(s.Title,'')         AS title,        -- ✅ return title
            s.First_name   AS first_name,
            s.Last_name    AS last_name,
            l.email        AS email,
            l.activity_status AS status,
            COALESCE(l.theme_preference,'light')  AS theme,
            COALESCE(l.font_preference,'medium')  AS font
        FROM Students s
        JOIN Logins   l ON l.user_ref_id = s.Student_id AND l.user_type='student'
        WHERE s.Student_id=%s
    """, (uid,))
    row = cur.fetchone()
    if not row:
        return jsonify({"status": "error", "message": "Profile not found"}), 404
    return jsonify({"status": "success", "profile": row}), 200




@app.route("/api/profile", methods=["PUT"])
def api_update_profile():
    uid = session.get("user_id")
    if not uid:
        return jsonify({"status": "error", "message": "User not logged in"}), 401

    data = request.get_json(force=True) or {}

    # --- Normalize inputs ---
    raw_title  = (data.get("title")      or "").strip()
    first_name = (data.get("first_name") or "").strip() or None
    last_name  = (data.get("last_name")  or "").strip() or None
    email      = (data.get("email")      or "").strip() or None
    theme      = (data.get("theme")      or "").strip() or None
    font       = (data.get("font")       or "").strip() or None
    status_in  = (data.get("status")     or "").strip().lower() or None  # active|inactive

    # Title whitelist/normalization (optional but avoids weird values)
    allowed_titles = {"mr", "ms", "mrs", "dr"}
    title = None
    if raw_title:
        t = raw_title.lower()
        if t in allowed_titles:
            # store Title with proper case: "Mr", "Ms", "Mrs", "Dr"
            title = t.capitalize() if t != "dr" else "Dr"
        else:
            # if you prefer to accept anything: title = raw_title
            # Here we ignore invalid to keep DB clean
            title = None

    # Validate theme/font (optional)
    if theme and theme not in {"light", "dark"}:
        theme = None
    if font and font not in {"small", "medium", "big"}:
        font = None

    # Validate status (optional)
    status = status_in if status_in in {"active", "inactive"} else None

    db = get_db()
    cur = db.cursor()
    try:
        # --- Build dynamic updates ---
        s_sets, s_params = [], []
        if title is not None:      s_sets.append("Title=%s");      s_params.append(title)
        if first_name is not None: s_sets.append("First_name=%s"); s_params.append(first_name)
        if last_name  is not None: s_sets.append("Last_name=%s");  s_params.append(last_name)
        if status is not None:     s_sets.append("Activity=%s");   s_params.append(status)
        if s_sets:
            cur.execute(f"UPDATE Students SET {', '.join(s_sets)} WHERE Student_id=%s", (*s_params, uid))

        l_sets, l_params = [], []
        if email is not None: l_sets.append("email=%s");            l_params.append(email)
        if theme is not None: l_sets.append("theme_preference=%s"); l_params.append(theme)
        if font  is not None: l_sets.append("font_preference=%s");  l_params.append(font)
        if status is not None:
            l_sets.append("activity_status=%s"); l_params.append(status)
        if l_sets:
            cur.execute(
                f"UPDATE Logins SET {', '.join(l_sets)} WHERE user_ref_id=%s AND user_type='student'",
                (*l_params, uid)
            )

        # Side-effects on deactivate
        if status == "inactive":
            cur.execute("DELETE FROM Classroom_Enrollment WHERE student_id=%s", (uid,))
            cur.execute("DELETE FROM Enrollment WHERE student_id=%s", (uid,))

        db.commit()

        # --- Return fresh profile so UI can reflect changes immediately ---
        cur_dict = db.cursor(dictionary=True)
        cur_dict.execute("""
            SELECT
                s.Title            AS title,
                s.First_name       AS first_name,
                s.Last_name        AS last_name,
                l.email            AS email,
                l.activity_status  AS status,
                l.theme_preference AS theme,
                l.font_preference  AS font
            FROM Students s
            JOIN Logins l
              ON l.user_ref_id = s.Student_id AND l.user_type='student'
            WHERE s.Student_id=%s
        """, (uid,))
        profile = cur_dict.fetchone() or {}

        return jsonify({"status": "success", "message": "Profile updated.", "profile": profile}), 200

    except mysql.connector.IntegrityError as e:
        db.rollback()
        m = (str(e) or "").lower()
        if e.errno == 1062 and "email" in m:
            return jsonify({"status": "error", "message": "This email is already in use."}), 409
        return jsonify({"status": "error", "message": str(e)}), 400
    except mysql.connector.Error as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cur.close()





@app.route("/api/profile/password", methods=["POST"])
def api_change_password():
    uid = session.get("user_id")
    if not uid:
        return jsonify({"status": "error", "message": "User not logged in"}), 401

    body = request.get_json(force=True) or {}
    current_password = body.get("current_password")
    new_password     = body.get("new_password")
    if not current_password or not new_password:
        return jsonify({"status": "error", "message": "current_password and new_password required"}), 400

    db = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute("SELECT password_hash FROM Logins WHERE user_ref_id=%s AND user_type='student'", (uid,))
        row = cur.fetchone()
        if not row:
            return jsonify({"status": "error", "message": "Login not found"}), 404

        if row["password_hash"] != current_password:
            return jsonify({"status": "error", "message": "Current password is incorrect"}), 403

        cur.execute(
            "UPDATE Logins SET password_hash=%s WHERE user_ref_id=%s AND user_type='student'",
            (new_password, uid)
        )
        db.commit()
        return jsonify({"status": "success", "message": "Password changed."}), 200
    except mysql.connector.Error as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cur.close()




@app.route("/render_student_report_course")
def render_student_report():
    return render_template("student_report_course.html")
@app.route("/render_student_report_navigation")
def render_student_navigation():
    return render_template("student_report_navigation.html")
@app.route("/render_ins_report_navigation")
def render_ins_navigation():
    return render_template("instructor_report_dashboard.html")

@app.route("/render_ins_report_student_list")
def render_ins_report_student_list():
    return render_template("instructor_report_student_list.html")

@app.route("/api/instructor/enrolled_students")
def get_instructor_enrolled_students():
    instructor_id = session.get("user_id")
    if not instructor_id or session.get("user_type") != "instructor":
        return jsonify({"status": "error", "message": "Not logged in as an instructor"}), 401

    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT DISTINCT s.Student_id, s.First_name, s.Last_name, s.Activity, l.email
            FROM Students s
            JOIN Logins l ON s.Student_id = l.user_ref_id AND l.user_type = 'student'
            JOIN Enrollment e ON s.Student_id = e.Student_id
            JOIN Courses c ON e.Unit_id = c.Unit_id
            WHERE c.Course_made_by = %s
            ORDER BY s.Last_name, s.First_name;
        """, (instructor_id,))
        students = cursor.fetchall()
        return jsonify({"status": "success", "students": students})
    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()

@app.route("/student_report_profile")
def render_student_report_profile():
    return render_template("student_report_profile.html")

@app.route("/instructor/student_profile_report")
def render_instructor_student_profile_report():
    return render_template("instructor_student_profile_report.html")

@app.route("/api/student/profile/<int:student_id>", methods=["GET"])
def get_specific_student_profile(student_id):
    if not session.get("user_id") or session.get("user_type") != "instructor":
        return jsonify({"status": "error", "message": "Unauthorized access"}), 403

    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT s.First_name, s.Last_name, s.Activity, l.email
            FROM Students s
            JOIN Logins l ON s.Student_id = l.user_ref_id
            WHERE s.Student_id = %s AND l.user_type = 'student'
        """, (student_id,))
        profile = cursor.fetchone()

        if not profile:
            return jsonify({"status": "error", "message": "Student profile not found"}), 404

        return jsonify({
            "status": "success",
            "profile": {
                "firstName": profile["First_name"],
                "lastName": profile["Last_name"],
                "email": profile["email"],
                "status": profile["Activity"]
            }
        })
    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/render_ins_report_course")
def render_ins_course():
    return render_template("instructor_report_course_list.html")


@app.route("/render_ins_report_course_students")
def render_ins_report_course_students():
    return render_template("instructor_report_course_students.html")

@app.route("/api/instructor/course/<unit_id>/students_progress")
def get_course_students_progress(unit_id):
    print(f"Session data: {session}")
    if not session.get("user_id") or session.get("user_type") != "instructor":
        print("Unauthorized access attempt!")
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT lesson_id
            FROM Lessons
            WHERE unit_id = %s
        """, (unit_id,))
        course_lessons = cursor.fetchall()
        total_lessons_in_course = len(course_lessons)

        cursor.execute("""
            SELECT s.Student_id, s.First_name, s.Last_name
            FROM Students s
            JOIN Enrollment e ON s.Student_id = e.Student_id
            WHERE e.Unit_id = %s
            ORDER BY s.Last_name, s.First_name;
        """, (unit_id,))
        students = cursor.fetchall()

        student_progress_list = []
        for student in students:
            completed_lessons_count = 0
            if total_lessons_in_course > 0:
                for lesson in course_lessons:
                    if PrerequisiteManager.check_lesson_completion(student['Student_id'], lesson['lesson_id']):
                        completed_lessons_count += 1
            
            progress_percent = (completed_lessons_count / total_lessons_in_course * 100) if total_lessons_in_course > 0 else 0

            student_progress_list.append({
                "student_id": student['Student_id'],
                "full_name": f"{student['First_name']} {student['Last_name']}",
                "progress": round(progress_percent) 
            })

        return jsonify({"status": "success", "students": student_progress_list})
    except mysql.connector.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ============================================================
# 🔚 APP ENTRY POINT
# ============================================================
if __name__ == "__main__":
    # Run setup locally to build DB schema
    setup_database()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 10000)), debug=True)
else:
    # When deployed (e.g., on Railway), this runs on import
    setup_database()
