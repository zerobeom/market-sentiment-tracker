"""
매일 GitHub Actions가 실행하는 스크립트.
1) CNN Fear & Greed Index 최신 데이터를 가져와 data/fng.json 에 저장
2) Yahoo Finance에서 VIX(^VIX) 최근 6개월 데이터를 가져와 data/vix.json 에 저장
"""
import json
import time
import urllib.request
from datetime import datetime, timezone

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}

# CNN의 fearandgreed API는 일반 User-Agent만으로는 봇 차단(HTTP 418)이 걸려서
# 실제 브라우저에서 보내는 것과 최대한 비슷한 헤더를 추가로 넣어줘요.
CNN_HEADERS = {
    **HEADERS,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://edition.cnn.com",
    "Referer": "https://edition.cnn.com/markets/fear-and-greed",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Sec-Fetch-Dest": "empty",
}


def fetch_json(url, headers=None, retries=3, delay=5):
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=headers or HEADERS)
            with urllib.request.urlopen(req, timeout=20) as res:
                return json.loads(res.read().decode("utf-8"))
        except Exception as e:
            last_err = e
            print(f"  요청 실패 (시도 {attempt}/{retries}): {e}")
            if attempt < retries:
                time.sleep(delay)
    raise last_err


def score_to_rating(score):
    if score < 25:
        return "Extreme Fear"
    if score < 45:
        return "Fear"
    if score < 55:
        return "Neutral"
    if score < 75:
        return "Greed"
    return "Extreme Greed"


def extract_score(value):
    """CNN API가 숫자로 줄 수도, {'score': ...} 형태로 줄 수도 있어 방어적으로 처리."""
    if isinstance(value, dict):
        return value.get("score", 0)
    return value or 0


def update_fng():
    url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
    raw = fetch_json(url, headers=CNN_HEADERS)

    fg = raw["fear_and_greed"]
    hist = raw["fear_and_greed_historical"]["data"]

    timeline = [
        {
            "date": datetime.fromtimestamp(p["x"] / 1000, tz=timezone.utc).date().isoformat(),
            "value": round(p["y"], 1),
        }
        for p in hist
    ]

    def labeled(key):
        s = round(extract_score(fg.get(key, 0)), 1)
        return {"label": score_to_rating(s), "value": s}

    out = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "score": round(extract_score(fg.get("score", 0)), 1),
        "rating": fg.get("rating", score_to_rating(extract_score(fg.get("score", 0)))),
        "previous_close": labeled("previous_close"),
        "previous_1_week": labeled("previous_1_week"),
        "previous_1_month": labeled("previous_1_month"),
        "previous_1_year": labeled("previous_1_year"),
        "timeline": timeline[-200:],
        "source": {
            "name": "CNN Business - Fear & Greed Index",
            "url": "https://edition.cnn.com/markets/fear-and-greed",
        },
    }

    with open("data/fng.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print("fng.json updated:", out["score"], out["rating"])


def update_vix():
    url = "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=6mo&interval=1d"
    raw = fetch_json(url, headers=HEADERS)

    result = raw["chart"]["result"][0]
    timestamps = result["timestamp"]
    closes = result["indicators"]["quote"][0]["close"]

    timeline = []
    for t, c in zip(timestamps, closes):
        if c is None:
            continue
        timeline.append({
            "date": datetime.fromtimestamp(t, tz=timezone.utc).date().isoformat(),
            "value": round(c, 2),
        })

    current = timeline[-1]["value"]
    prev = timeline[-2]["value"] if len(timeline) > 1 else current
    change_pct = round((current - prev) / prev * 100, 2) if prev else 0

    out = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "current": current,
        "change_pct": change_pct,
        "timeline": timeline,
        "source": {
            "name": "Yahoo Finance - CBOE Volatility Index (^VIX)",
            "url": "https://finance.yahoo.com/quote/%5EVIX/",
        },
    }

    with open("data/vix.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print("vix.json updated:", out["current"], out["change_pct"])


if __name__ == "__main__":
    ok = True

    try:
        update_fng()
    except Exception as e:
        ok = False
        print("⚠️ Fear & Greed 데이터 갱신 실패:", e)

    try:
        update_vix()
    except Exception as e:
        ok = False
        print("⚠️ VIX 데이터 갱신 실패:", e)

    if not ok:
        # 둘 중 하나라도 실패하면 GitHub Actions에서 눈에 띄게 실패 표시를 하되,
        # 성공한 쪽 데이터 파일은 그대로 커밋되도록 커밋 스텝은 계속 진행시킴.
        raise SystemExit(1)
