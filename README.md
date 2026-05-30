# overflight

Thanks for checking out *overflight*, an interactive local air-traffic visualization app built with three.js! This project started as a Google Assistant Action from a few years ago. It would tell users about the nearest plane flying overhead, a fun feature that Apple Siri used to do with Wolfram Alpha.  

Once Google Assistant Actions were sunsetted, I considered making a web application using the Flask backend but never settled on an implementation. I found three.js as a way forward, eventually leading to *overflight*. Hosted the container in winter 2024 with Google Cloud Run; so make sure to visit the site!

A dockerized Flask + Vite application

## Getting started

Prerequisites: Python 3.10+, Node.js (16+), and Docker (optional).

Backend (Flask)

```bash
# create and activate a virtualenv
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt

# run the backend directly
python server.py

# or with the flask CLI
set FLASK_APP=server.py        # Windows
export FLASK_APP=server.py     # macOS / Linux
flask run --host=0.0.0.0 --port=5000
```

Frontend (Vite)

```bash
npm install
npm run dev        # starts Vite dev server
npm run build      # build production assets
npm run preview    # preview the production build
```

The frontend is Vite-powered (see `package.json`) and static files live under `public/` with the entry `index.html`.

Run both locally: start the Flask backend (port 5000) then the Vite dev server (default port 5173). Adjust any API base URLs or proxy settings if needed.

Docker

```bash
docker build -t overflight .
docker run -p 8080:8080 overflight
```

Notes
- `server.py` is the Flask backend entrypoint.
- `package.json` contains Vite scripts: `dev`, `build`, and `preview`.

