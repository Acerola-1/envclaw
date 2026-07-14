import json, sys
d = json.load(sys.stdin)
for w in d['weather']:
    print(f"Date: {w['date']}, Max: {w['maxtempC']}°C, Min: {w['mintempC']}°C, Avg: {w['avgtempC']}°C")