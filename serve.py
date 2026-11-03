import os
import threading
import webbrowser

from waitress import serve

import app

app.init()
print("Serving files from:", os.path.abspath(app.app.static_folder))
print("Gym system running. Keep this window open.")
threading.Timer(
    1.5, lambda: webbrowser.open("http://127.0.0.1:5000/admin.html")
).start()
serve(app.app, host="0.0.0.0", port=5000)