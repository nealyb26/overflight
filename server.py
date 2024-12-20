# -*- coding: utf-8 -*-
import requests
from requests.auth import HTTPBasicAuth
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from flightData import *

app = Flask("__name__")
CORS(app)

my_lat = None #36.12063617887522
my_long = None #-86.6819769217225

@app.route('/api/location', methods=['POST'])
def handle_location():
    global my_lat, my_long
    data = request.json
    my_lat = data['latitude']
    my_long = data['longitude']

    return jsonify({"message": "Location received successfully"})

@app.route('/response', methods=['GET', 'POST'])
def departures_handler():
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



def main():
    app.run(host='0.0.0.0')


if __name__ == '__main__':
    main()


