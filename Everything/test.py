import json
from flask import Flask, request, jsonify
import sqlite3

# --- Flask Application and Database Connection ---

# Change this to connect to your existing database file
def get_db():
    conn = sqlite3.connect("c.db")
    conn.row_factory = sqlite3.Row
    return conn

app = Flask(__name__)

# Your original Flask function
@app.route("/fetch_instructor_details", methods = ["GET"])
def instrutor_course_details():
    ins_id = request.args.get("insId", 1, type=int)
    unitId = request.args.get("unit_id", "").strip()
    db = get_db()
    cursor = db.cursor()

    # 1. Fetch the main course details
    try:
        cursor.execute("""
            SELECT c.Title, c.Unit_id, c.Course_director, c.Activity, c.Total_credit
            FROM Courses c
            JOIN Instructors i ON c.Course_made_by = i.Ins_id
            WHERE i.Ins_id = ? AND c.Unit_id = ?
        """, (ins_id, unitId))
        course_row = cursor.fetchone()
    except sqlite3.OperationalError:
        # If the 'Courses' table doesn't exist, the course is not found.
        return jsonify({"found": False, "results": []})

    if not course_row:
        return jsonify({"found": False, "results": []})

    # 2. Safely fetch lessons or use dummy data if the table doesn't exist
    try:
        cursor.execute("SELECT name, credit FROM Lessons WHERE course_unit_id = ?", (unitId,))
        lessons_rows = cursor.fetchall()
        lessons = [{"name": r["name"], "credit": r["credit"]} for r in lessons_rows]
    except sqlite3.OperationalError:
        # Replace with dummy data if the 'Lessons' table is not found
        lessons = [{"name": "Dummy Lesson", "credit": 0}]
    
    # 3. Safely fetch students or use dummy data if the table doesn't exist
    try:
        cursor.execute("SELECT student_name FROM Students WHERE course_unit_id = ?", (unitId,))
        students_rows = cursor.fetchall()
        students = [r["student_name"] for r in students_rows]
    except sqlite3.OperationalError:
        # Replace with dummy data if the 'Students' table is not found
        students = ["Dummy Student"]

    # 4. Set the number of active classrooms
    active_classrooms = 3

    # 5. Combine all the data into a single dictionary
    fullCourseDetail = {
        "title": course_row["Title"],
        "unitId": course_row["Unit_id"],
        "courseDirector": course_row["Course_director"],
        "status": course_row["Activity"],
        "totalCredit": course_row["Total_credit"],
        "lessons": lessons,
        "students": students,
        "activeClassrooms": active_classrooms
    }

    return jsonify({"found": True, "results": [fullCourseDetail]})

# --- Main block to simulate a request and print the output ---
if __name__ == '__main__':
    # Set up the test client
    client = app.test_client()
    
    # ⚠️ You need to have data in your c.db for these tests to work!
    # These scenarios assume your database has data for 'COMP101' and 'Jane Doe'
    
    # --- Scenario 1: Successful Fetch ---
    print("--- Scenario 1: Successful Fetch ---")
    response = client.get('/fetch_instructor_details?insId=1&unit_id=FIT2101')
    print(json.dumps(response.get_json(), indent=2))
    print("\n" + "="*50 + "\n")

    # --- Scenario 2: Course Not Found ---
    print("--- Scenario 2: Course Not Found ---")
    response = client.get('/fetch_instructor_details?insId=1&unit_id=NONEXISTENT')
    print(json.dumps(response.get_json(), indent=2))
    print("\n" + "="*50 + "\n")