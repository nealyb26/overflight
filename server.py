# -*- coding: utf-8 -*-
import os
from requests.auth import HTTPBasicAuth
import pandas as pd
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flightData import *

# Initialize Flask app
app = Flask("__name__", static_folder="static")
CORS(app)

# Global variables to store user location
my_lat = None
my_long = None

@app.route('/api/location', methods=['POST'])
def handle_location():
    """
    Handle user location sent from the frontend.
    """
    global my_lat, my_long
    data = request.json
    my_lat = data['latitude']
    my_long = data['longitude']

    return jsonify({"message": "Location received successfully"})

@app.route('/response', methods=['GET', 'POST'])
def departures_handler():
    """
    Handle requests for nearby flights and return processed flight data.
    """
    global my_long, my_lat
    try:
        user_long, user_lat = my_long, my_lat
        flights = returnCloseByFlights(user_long, user_lat)
        responseList = []

        for flight in flights:
            details = getFlightDetails(flight)
            selectedData = selectDataFromDetails(details)
            responseList.append(selectedData)

        return {"response": responseList}
    except Exception as e:
        print(e)
        return jsonify({"error: ": str(e)}), 500

# Route to serve static files (frontend)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static_files(path):
    """
    Serve static files for the frontend, including JavaScript, CSS, and other assets.
    """
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

def main():
    """
    Main function to run the Flask app.
    """
    app.run(host='0.0.0.0', port=5000)

if __name__ == '__main__':
    main()
