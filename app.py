import os
import sqlite3
from datetime import date, datetime
from functools import wraps

from flask import Flask, g, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__, static_folder="static", static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY", "change-this-secret")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
DB = os.path.join(os.path.dirname(__file__), "gym.db")


# ---------- Database ----------

def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close(_):
    d = g.pop("db", None)
    if d:
        d.close()


def init():
    with sqlite3.connect(DB) as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS members(
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            plan TEXT DEFAULT 'Monthly',
            goal TEXT,
            joined TEXT
        );
        CREATE TABLE IF NOT EXISTS checkins(
            id INTEGER PRIMARY KEY,
            member_id INTEGER,
            day TEXT,
            at TEXT
        );
        CREATE TABLE IF NOT EXISTS progress(
            id INTEGER PRIMARY KEY,
            member_id INTEGER,
            day TEXT,
            weight REAL,
            body_fat REAL,
            note TEXT
        );
        CREATE TABLE IF NOT EXISTS settings(
            key TEXT PRIMARY KEY,
            value TEXT
        );
        """)


# ---------- Login helpers ----------

def admin(f):
    @wraps(f)
    def w(*a, **k):
        if not session.get("admin"):
            return jsonify(error="Please sign in."), 401
        return f(*a, **k)
    return w


def password_ok(pw):
    row = db().execute(
        "SELECT value FROM settings WHERE key='admin_hash'"
    ).fetchone()
    if row:
        return check_password_hash(row["value"], pw or "")
    return pw == ADMIN_PASSWORD


# ---------- Pages and login ----------

@app.get("/")
def home():
    return app.send_static_file("index.html")


@app.post("/api/login")
def login():
    if password_ok((request.json or {}).get("password")):
        session["admin"] = True
        return jsonify(ok=True)
    return jsonify(error="Wrong password."), 401


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/me")
def me():
    return jsonify(admin=bool(session.get("admin")))


@app.post("/api/password")
@admin
def change_password():
    d = request.json or {}
    new = d.get("new") or ""
    if not password_ok(d.get("current")):
        return jsonify(error="Current password is wrong."), 400
    if len(new) < 6:
        return jsonify(error="New password must be at least 6 characters."), 400
    db().execute(
        "INSERT OR REPLACE INTO settings(key, value) VALUES('admin_hash', ?)",
        (generate_password_hash(new),),
    )
    db().commit()
    return jsonify(ok=True)


# ---------- Members ----------

@app.get("/api/members")
@admin
def members():
    rows = db().execute(
        """
        SELECT m.*,
            (SELECT COUNT(*) FROM checkins c WHERE c.member_id = m.id) AS visits,
            (SELECT MAX(day) FROM checkins c WHERE c.member_id = m.id) AS last_visit,
            (SELECT COUNT(*) FROM checkins c
                WHERE c.member_id = m.id AND c.day = ?) AS in_today
        FROM members m
        ORDER BY m.name
        """,
        (date.today().isoformat(),),
    ).fetchall()
    return jsonify([dict(r, code=f"GM-{r['id']:04d}") for r in rows])


@app.post("/api/members")
@admin
def add_member():
    d = request.json or {}
    name = (d.get("name") or "").strip()
    if not name:
        return jsonify(error="Name is required."), 400
    cur = db().execute(
        "INSERT INTO members(name, phone, plan, goal, joined) VALUES(?, ?, ?, ?, ?)",
        (
            name,
            d.get("phone", ""),
            d.get("plan", "Monthly"),
            d.get("goal", ""),
            date.today().isoformat(),
        ),
    )
    db().commit()
    return jsonify(id=cur.lastrowid, code=f"GM-{cur.lastrowid:04d}"), 201


@app.delete("/api/members/<int:mid>")
@admin
def del_member(mid):
    for table, col in (
        ("progress", "member_id"),
        ("checkins", "member_id"),
        ("members", "id"),
    ):
        db().execute(f"DELETE FROM {table} WHERE {col} = ?", (mid,))
    db().commit()
    return jsonify(ok=True)


# ---------- Check-ins ----------

@app.post("/api/checkin")
@admin
def checkin():
    mid = (request.json or {}).get("member_id")
    m = db().execute("SELECT name FROM members WHERE id = ?", (mid,)).fetchone()
    if not m:
        return jsonify(error="Member not found."), 404

    today = date.today().isoformat()
    already = db().execute(
        "SELECT 1 FROM checkins WHERE member_id = ? AND day = ?", (mid, today)
    ).fetchone()
    if already:
        return jsonify(error=f"{m['name']} is already checked in today."), 409

    db().execute(
        "INSERT INTO checkins(member_id, day, at) VALUES(?, ?, ?)",
        (mid, today, datetime.now().strftime("%H:%M")),
    )
    db().commit()
    return jsonify(ok=True, name=m["name"])


@app.get("/api/checkins/today")
@admin
def today_checkins():
    rows = db().execute(
        """
        SELECT c.at, m.name, m.id
        FROM checkins c
        JOIN members m ON m.id = c.member_id
        WHERE c.day = ?
        ORDER BY c.id DESC
        """,
        (date.today().isoformat(),),
    ).fetchall()
    return jsonify([dict(r, code=f"GM-{r['id']:04d}") for r in rows])


# ---------- Progress ----------

@app.get("/api/members/<int:mid>/progress")
@admin
def get_progress(mid):
    rows = db().execute(
        "SELECT * FROM progress WHERE member_id = ? ORDER BY day, id", (mid,)
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/members/<int:mid>/progress")
@admin
def add_progress(mid):
    d = request.json or {}

    def num(key):
        try:
            return float(d.get(key))
        except (TypeError, ValueError):
            return None

    db().execute(
        "INSERT INTO progress(member_id, day, weight, body_fat, note) VALUES(?, ?, ?, ?, ?)",
        (
            mid,
            d.get("day") or date.today().isoformat(),
            num("weight"),
            num("body_fat"),
            d.get("note", ""),
        ),
    )
    db().commit()
    return jsonify(ok=True), 201


if __name__ == "__main__":
    init()
    app.run(debug=True)