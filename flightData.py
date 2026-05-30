from FlightRadar24 import FlightRadar24API
import pandas as pd

fr_api = FlightRadar24API()

def getManualBounds():
    user_long = input("Enter Longitude of Current Location: ")
    user_lat = input("Enter Latitude of Current Location: ")
    return float(user_long), float(user_lat)

def getAirlines():
    airlines = fr_api.get_airlines()
    return airlines

def returnCloseByFlights(user_long, user_lat):
    bounds = fr_api.get_bounds_by_point(user_lat, user_long, 20000)
    #Bounds set to user position with radius of 20 km

    #list containing Flight objects
    flights = fr_api.get_flights(bounds = bounds)
    return flights

def getFlightDetails(flight):

    details = fr_api.get_flight_details(flight)
    return details

def queryAgain():
    userInput = input("Query API again? (yes or no)")
    result = True if userInput.lower() == "yes" else False
    return result


def selectDataFromDetails(details, flight=None):
    details = details if isinstance(details, dict) else {}

    identification = details.get('identification') or {}
    aircraft = details.get('aircraft') or {}
    airport = details.get('airport') or {}
    status = details.get('status') or {}
    trail = details.get('trail') or []

    latest_position = trail[0] if trail else {}
    origin = airport.get('origin') or {}
    destination = airport.get('destination') or {}

    origin_code = origin.get('code') or {}
    destination_code = destination.get('code') or {}

    callsign = identification.get('callsign') or (getattr(flight, 'callsign', None) if flight else None)
    flight_id = identification.get('id') or (getattr(flight, 'id', None) if flight else None)
    aircraft_type = aircraft.get('model', {}).get('text')

    latitude = getattr(flight, 'latitude', None) if flight else None
    longitude = getattr(flight, 'longitude', None) if flight else None
    altitude = getattr(flight, 'altitude', None) if flight else None
    speed = getattr(flight, 'ground_speed', None) if flight else None
    heading = getattr(flight, 'heading', None) if flight else None

    if latitude is None:
        latitude = latest_position.get('lat')
    if longitude is None:
        longitude = latest_position.get('lng')
    if altitude is None:
        altitude = latest_position.get('alt')
    if speed is None:
        speed = latest_position.get('spd')
    if heading is None:
        heading = latest_position.get('hd')

    status_text = status.get('text')
    lower_status = status_text.lower() if isinstance(status_text, str) else ""
    delay_state = "Unknown"
    if "delay" in lower_status:
        delay_state = "Delayed"
    elif "on time" in lower_status or "scheduled" in lower_status:
        delay_state = "On time"

    return {
        "id": flight_id,
        "callsign": callsign,
        "aircraft_type": aircraft_type,
        "latitude": latitude,
        "longitude": longitude,
        "altitude": altitude,
        "speed": speed,
        "heading": heading,
        "origin_airport": origin.get('name'),
        "origin_iata": origin_code.get('iata'),
        "destination_airport": destination.get('name'),
        "destination_iata": destination_code.get('iata'),
        "status_text": status_text,
        "delay_state": delay_state
    }


def main():
    
    #user_long, user_lat = getManualBounds()
    user_lat, user_long = 34.1184, -118.3004
    boolInput = True

    while(boolInput):
        flights = returnCloseByFlights(user_long, user_lat)
        
        for flight in flights:
            details = getFlightDetails(flight)
            print(selectDataFromDetails(details))
            print(f"Flight Detail: {details}")
            print("")
        boolInput = queryAgain()

if __name__ == "__main__":
    main()


