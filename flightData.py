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
    flights = fr_api.get_flights(bounds = bounds, details = True)
    return flights

def getFlightDetails(flight):

    details = fr_api.get_flight_details(flight)
    return details

def queryAgain():
    userInput = input("Query API again? (yes or no)")
    result = True if userInput.lower() == "yes" else False
    return result


def selectDataFromDetails(details):
    callsign = details.get('identification', {}).get('callsign')
    aircraft_type = details.get('aircraft', {}).get('model', {}).get('text')

    position_long = details.get('trail', [{}])[0].get('lng')
    position_lat = details.get('trail', [{}])[0].get('lat')
    altitude = details.get('trail', [{}])[0].get('alt')
    speed = details.get('trail', [{}])[0].get('spd')
    heading = details.get('trail', [{}])[0].get('hd')

    return("Callsign: " + callsign + " Aircraft Type: " + aircraft_type + " (lat/long): " + str(position_lat) + " " + str(position_long) + " Altitude: " + str(altitude) + " Speed: " + str(speed) + " Heading: " + str(heading))


def main():
    
    #user_long, user_lat = getManualBounds()
    user_long, user_lat = -86.6819769217225, 36.12063617887522
    boolInput = True

    while(boolInput):
        flights = returnCloseByFlights(user_long, user_lat)
        
        for flight in flights:
            details = getFlightDetails(flight)
            print(selectDataFromDetails(details))
            #print(details)
            print("")
        boolInput = queryAgain()

if __name__ == "__main__":
    main()


