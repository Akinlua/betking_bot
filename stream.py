import json
from sys import stderr

import requests

with open("credentials.json", "r") as fd:
    credentials = json.load(fd)

client = requests.Session()
headers = {"x-api-key": credentials["key"], "Accept": "text/event-stream"}
BASE_URL = credentials["base_url"]
client.headers.update(headers)
BET_API_URL = "http://72.60.89.248:3001/bet"


def send_to_api(data: dict):
    try:
        response = requests.post(BET_API_URL, json=data)
        print(f"Sent to API: {response.status_code}")
    except Exception as e:
        print(f"Error sending to API: {e}", file=stderr)


def poll(session):
    response = session.get(f"{BASE_URL}/raw-tips", stream=True)
    yield response


def convert(tip: dict, cache: set):
    alerted = (tip["alerted"] * 100) / 100
    id = f"{tip['id']}-{tip['league_id']}-{tip['market']}-{tip['outcome']}-{tip['period']}-{tip['point']}-{alerted}"

    if not cache.__contains__(id):
        ## Markets are moneyline,spread,total
        market = tip["market"].lower()
        market = "team_totals" if market == "teamtotal" else market

        outcome: str = tip["outcome"].lower()
        team = None
        if outcome == "awayover":
            outcome = "over"
            team = "away"
        elif outcome == "awayunder":
            outcome = "under"
            team = "away"
        elif outcome == "homeunder":
            outcome = "under"
            team = "home"
        elif outcome == "homeover":
            outcome = "over"
            team = "home"

        half = False if tip["period"] == 0 else True
        cache.add(id)
        return {
            "home": tip["home"],
            "away": tip["away"],
            "points": tip["point"],
            "is_first_half": half,
            "team": team,
            "market_type": market,
            "odds": tip["nvp"],
            "outcome": outcome,
        }


def stream(session, cache: set[str]):
    index = slice(6, None, None)

    while True:
        try:
            for response in poll(session=client):
                for tips in response.iter_lines():
                    if tips:
                        tips = tips.decode("utf-8")

                        if tips.startswith("data: "):
                            tips = tips[index]
                            fixtures = json.loads(tips)

                            for tip in list(fixtures):
                                parsed_tip = convert(tip, cache)
                                if parsed_tip:
                                    yield parsed_tip

        except Exception as error:
            print(
                f"Exception occurred in an attempt to stream data from the server\ncause: {error}",
                file=stderr,
            )


if __name__ == "__main__":
    cache = set()
    for alert in stream(client, cache):
        print(f"{alert}")
        send_to_api(alert)
