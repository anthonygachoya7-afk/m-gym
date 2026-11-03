# MUST Gym

MUST Gym is a lightweight gym member management system built with Python and Flask. It helps staff track members, log daily check-ins, and monitor workout progress in a simple browser-based dashboard.

## Features

- Staff login with password protection
- Add and remove members
- Search members by name, code, or phone number
- Daily check-in tracking
- Progress logging for weight, body fat, and notes
- Simple public landing page plus private staff dashboard
- SQLite-backed persistence with automatic database creation

## Project structure

- `app.py` — Flask app and database logic
- `serve.py` — production-style launcher using Waitress
- `static/` — HTML, CSS, and JavaScript front end
- `gym.db` — SQLite database created on first run
- `requirements.txt` — Python dependencies

## Requirements

- Python 3.9+
- pip

Install dependencies:

```bash
pip install -r requirements.txt
```

## Run the app

Start the app in development mode:

```bash
python app.py
```

Or run the production-style server launcher:

```bash
python serve.py
```

The app serves the public page at:

- `http://127.0.0.1:5000/`

The staff dashboard is available at:

- `http://127.0.0.1:5000/admin.html`

## Default login

The default admin password is:

```text
admin123
```

You can override this by setting environment variables before starting the app:

```bash
export ADMIN_PASSWORD="your_secure_password"
export SECRET_KEY="your_secret_key"
```

On Windows PowerShell:

```powershell
$env:ADMIN_PASSWORD = "your_secure_password"
$env:SECRET_KEY = "your_secret_key"
python app.py
```

## Notes

- The database file `gym.db` is created automatically when the app starts.
- The app stores members, check-ins, progress entries, and settings in SQLite.
- The password is checked against the stored hash when available; otherwise it falls back to the default admin password.

## License

This project is provided as-is for local gym management use.
