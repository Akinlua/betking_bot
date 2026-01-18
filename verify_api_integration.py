import requests
from sys import stderr
import json

BET_API_URL = "http://72.60.89.248:3001/bet"

def send_to_api(data: dict):
    print(f"Attempting to send data to {BET_API_URL}...")
    try:
        response = requests.post(BET_API_URL, json=data)
        print(f"Response Status Code: {response.status_code}")
        print(f"Response Content: {response.text}")
    except Exception as e:
        print(f"Error sending to API: {e}", file=stderr)

sample_data = {
    "home": "Man Utd",
    "away": "Man City",
    "market_type" : "team_totals",
    "outcome": "under",
    "points": 0.5,
    "is_first_half": False,
    "team": "away",
    "odds": 1.85
}

if __name__ == "__main__":
    send_to_api(sample_data)
