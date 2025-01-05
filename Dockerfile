# Stage 1: Build the Vite frontend
FROM node:16 AS frontend

# Set working directory for the frontend
WORKDIR /app

# Copy all project files to the container
COPY . ./

# Install dependencies and build the Vite app
RUN npm install && npm run build

# Stage 2: Set up the Python backend
FROM python:3.9-slim AS backend

# Set working directory for the backend
WORKDIR /app

# Copy backend files and frontend build output
COPY server.py requirements.txt flightData.py ./
COPY --from=frontend /app/dist /app/static

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose Flask port
EXPOSE 5000

# Set environment variables for Flask
ENV FLASK_APP=server.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=5000

# Start Flask
CMD ["flask", "run"]
