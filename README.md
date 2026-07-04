# 시장 심리 트래커 (Market Sentiment Tracker)

개인적으로 매일 확인하기 위한 투자 심리/밸류에이션/변동성 대시보드예요.

## 구성

1. **Fear & Greed Index** — CNN Business, 매일 자동 갱신
2. **Yardeni MSCI 밸류에이션 (한국/미국)** — 원본 차트 이미지 실시간 embed
3. **VIX 변동성 지수** — Yahoo Finance, 매일 자동 갱신

## 폴더 구조

```
├── index.html              # 메인 페이지
├── style.css               # 디자인
├── script.js                # 데이터를 읽어와 화면에 그리는 코드
├── data/
│   ├── fng.json             # Fear & Greed 데이터 (자동 갱신됨)
│   └── vix.json             # VIX 데이터 (자동 갱신됨)
├── scripts/
│   └── fetch_data.py        # 매일 실행되어 데이터를 새로고침하는 스크립트
└── .github/workflows/
    └── update-data.yml      # 매일 자동 실행 예약 (GitHub Actions)
```

## 자동 갱신 원리

매일 한국시간 아침 6:30에 GitHub Actions가 자동으로:
1. `scripts/fetch_data.py`를 실행해서 CNN, Yahoo Finance에서 최신 데이터를 가져오고
2. `data/fng.json`, `data/vix.json` 파일을 새 값으로 덮어쓰고
3. 저장소에 자동으로 커밋 & 푸시해요.

그러면 GitHub Pages 사이트도 몇 분 안에 최신 데이터로 반영돼요.

## 비상업적 개인 프로젝트

Yardeni Research 차트는 원본 이미지 링크를 그대로 불러오는 방식이며,
저작권은 원 저작자(Yardeni Research, LSEG Datastream, MSCI)에게 있어요.
