// ------------------------------------------------------------------
// 공통 유틸: 게이지/차트를 그리기 위한 각도-좌표 변환 함수
// ------------------------------------------------------------------
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function ratingColor(label) {
  const l = (label || "").toLowerCase();
  if (l.includes("extreme fear")) return "#b23a30";
  if (l.includes("extreme greed")) return "#2f7f6f";
  if (l.includes("fear")) return "var(--fear)";
  if (l.includes("greed")) return "var(--greed)";
  return "var(--neutral)";
}

function scoreToRating(score) {
  if (score < 25) return "Extreme Fear";
  if (score < 45) return "Fear";
  if (score < 55) return "Neutral";
  if (score < 75) return "Greed";
  return "Extreme Greed";
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatKST(iso) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute} (KST)`;
}

// ------------------------------------------------------------------
// Fear & Greed 게이지 그리기
// ------------------------------------------------------------------
function drawFngGauge(score) {
  const svg = document.getElementById("fng-gauge");
  const cx = 150, cy = 170, r = 130, strokeWidth = 26;
  const bands = [
    { from: 0, to: 25, color: "#b23a30" },
    { from: 25, to: 45, color: "var(--fear)" },
    { from: 45, to: 55, color: "var(--neutral)" },
    { from: 55, to: 75, color: "var(--greed)" },
    { from: 75, to: 100, color: "#2f7f6f" },
  ];

  let paths = "";
  bands.forEach(b => {
    const startAngle = -90 + (b.from / 100) * 180;
    const endAngle = -90 + (b.to / 100) * 180;
    paths += `<path d="${describeArc(cx, cy, r, startAngle, endAngle)}"
                    stroke="${b.color}" stroke-width="${strokeWidth}" fill="none" opacity="0.9"/>`;
  });

  const needleAngle = -90 + (score / 100) * 180;
  const tip = polarToCartesian(cx, cy, r - 32, needleAngle);
  const needle = `<line x1="${cx}" y1="${cy}" x2="${tip.x}" y2="${tip.y}"
                     stroke="var(--text)" stroke-width="4" stroke-linecap="round"/>
                   <circle cx="${cx}" cy="${cy}" r="7" fill="var(--text)"/>`;

  // 밴드 위에 EXTREME FEAR / FEAR / NEUTRAL / GREED / EXTREME GREED 라벨 표시
  const labels = [
    { from: 0, to: 25, text: "EXTREME FEAR", size: 8.5 },
    { from: 25, to: 45, text: "FEAR", size: 11 },
    { from: 45, to: 55, text: "NEUTRAL", size: 8 },
    { from: 55, to: 75, text: "GREED", size: 11 },
    { from: 75, to: 100, text: "EXTREME GREED", size: 8.5 },
  ];
  let labelText = "";
  labels.forEach(l => {
    const mid = (l.from + l.to) / 2;
    const angle = -90 + (mid / 100) * 180;
    const pos = polarToCartesian(cx, cy, r, angle);
    labelText += `<text x="${pos.x}" y="${pos.y}"
        transform="rotate(${angle} ${pos.x} ${pos.y})"
        text-anchor="middle" dominant-baseline="middle"
        font-family="'Pretendard Variable', Pretendard, -apple-system, sans-serif" font-weight="700" letter-spacing="0.01em"
        font-size="${l.size}" fill="#ffffff" stroke="rgba(0,0,0,0.16)" stroke-width="0.5"
        paint-order="stroke fill">${l.text}</text>`;
  });

  svg.innerHTML = paths + labelText + needle;
}

// ------------------------------------------------------------------
// Fear & Greed 히스토리(오늘/1주 전/1달 전/1년 전) 그리기
// ------------------------------------------------------------------
function drawFngHistory(data) {
  const rows = [
    { label: "전일 종가", item: data.previous_close },
    { label: "1주일 전", item: data.previous_1_week },
    { label: "1개월 전", item: data.previous_1_month },
    { label: "1년 전", item: data.previous_1_year },
  ];
  const wrap = document.getElementById("fng-history");
  wrap.innerHTML = rows.map(r => `
    <div class="fng-row">
      <div>
        <div class="label">${r.label}</div>
        <div class="rating" style="color:${ratingColor(r.item.label)}">${r.item.label}</div>
      </div>
      <div class="fng-badge" style="color:${ratingColor(r.item.label)}">${r.item.value}</div>
    </div>
  `).join("");
}

// ------------------------------------------------------------------
// Fear & Greed 타임라인 라인차트
// ------------------------------------------------------------------
function drawLineChart(svgId, points, color, opts = {}) {
  const svg = document.getElementById(svgId);
  const W = svg.viewBox.baseVal.width || 900;
  const H = svg.viewBox.baseVal.height || 260;
  const padL = 40, padR = 16, padT = 16, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const values = points.map(p => p.value);
  const min = opts.min ?? Math.min(...values);
  const max = opts.max ?? Math.max(...values);
  const range = max - min || 1;

  const x = i => padL + (i / (points.length - 1)) * chartW;
  const y = v => padT + chartH - ((v - min) / range) * chartH;

  // 격자선
  let grid = "";
  const gridSteps = opts.gridSteps || [0, 25, 50, 75, 100];
  gridSteps.forEach(g => {
    if (g < min || g > max) return;
    const gy = y(g);
    grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="var(--hairline)" stroke-width="1"/>
             <text x="${padL - 10}" y="${gy + 4}" text-anchor="end" font-family="var(--mono)" font-size="11" fill="var(--text-muted)">${g}</text>`;
  });

  // 라인
  const linePoints = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");

  // x축 날짜 라벨 (처음/중간/끝)
  const labelIdx = [0, Math.floor(points.length / 2), points.length - 1];
  let xLabels = "";
  labelIdx.forEach(i => {
    xLabels += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--text-muted)">${formatDate(points[i].date)}</text>`;
  });

  const lastPoint = points[points.length - 1];

  svg.innerHTML = `
    <g class="chart-grid">${grid}</g>
    <polyline points="${linePoints}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(points.length - 1)}" cy="${y(lastPoint.value)}" r="4.5" fill="${color}"/>
    <g class="chart-hover-layer"></g>
    <g class="x-labels">${xLabels}</g>
    <rect class="hover-capture" x="${padL}" y="0" width="${chartW}" height="${H}" fill="transparent" style="cursor:crosshair"/>
  `;

  if (opts.tooltipFormat) {
    attachChartTooltip(svg, points, x, y, padT, padT + chartH, color, opts.tooltipFormat);
  }
}

// ------------------------------------------------------------------
// 차트 위에 마우스를 올리면 해당 시점의 데이터를 보여주는 툴팁
// ------------------------------------------------------------------
function attachChartTooltip(svg, points, x, y, top, bottom, color, tooltipFormat) {
  const wrap = svg.parentElement;
  wrap.style.position = "relative";

  let tooltip = wrap.querySelector(".chart-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    wrap.appendChild(tooltip);
  }
  const hoverLayer = svg.querySelector(".chart-hover-layer");

  function pointerToSvgX(clientX) {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const scaleX = vb.width / rect.width;
    return { svgX: (clientX - rect.left) * scaleX, rect, scaleX };
  }

  function nearestIndex(svgX) {
    let idx = 0, minDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(x(i) - svgX);
      if (d < minDist) { minDist = d; idx = i; }
    });
    return idx;
  }

  function show(clientX) {
    const { svgX, rect, scaleX } = pointerToSvgX(clientX);
    const idx = nearestIndex(svgX);
    const p = points[idx];
    const px = x(idx), py = y(p.value);

    hoverLayer.innerHTML = `
      <line x1="${px}" y1="${top}" x2="${px}" y2="${bottom}" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>
      <circle cx="${px}" cy="${py}" r="5.5" fill="#fff" stroke="${color}" stroke-width="2.5"/>
    `;

    tooltip.innerHTML = tooltipFormat(p);
    tooltip.style.opacity = "1";

    const wrapRect = wrap.getBoundingClientRect();
    const screenX = rect.left - wrapRect.left + px / scaleX;
    const tooltipW = tooltip.offsetWidth;
    let left = screenX + 12;
    if (left + tooltipW > wrap.clientWidth) left = screenX - tooltipW - 12;
    tooltip.style.left = `${Math.max(0, left)}px`;
    tooltip.style.top = "6px";
  }

  function hide() {
    hoverLayer.innerHTML = "";
    tooltip.style.opacity = "0";
  }

  const capture = svg.querySelector(".hover-capture");
  capture.addEventListener("mousemove", e => show(e.clientX));
  capture.addEventListener("mouseleave", hide);
  capture.addEventListener("touchstart", e => show(e.touches[0].clientX), { passive: true });
  capture.addEventListener("touchmove", e => show(e.touches[0].clientX), { passive: true });
  capture.addEventListener("touchend", hide);
}

// ------------------------------------------------------------------
// 데이터 로드 및 렌더링
// ------------------------------------------------------------------
async function loadFng() {
  try {
    const res = await fetch("data/fng.json", { cache: "no-store" });
    const data = await res.json();

    document.getElementById("fng-score").textContent = data.score;
    document.getElementById("fng-score").style.color = ratingColor(data.rating);
    document.getElementById("fng-rating").textContent = data.rating;

    drawFngGauge(data.score);
    drawFngHistory(data);
    drawLineChart("fng-timeline", data.timeline, ratingColor(data.rating), {
      min: 0, max: 100,
      tooltipFormat: p => `
        <div class="tt-date">${formatDate(p.date)}</div>
        <div class="tt-value" style="color:${ratingColor(scoreToRating(p.value))}">${p.value} · ${scoreToRating(p.value)}</div>
      `,
    });

    return data;
  } catch (e) {
    console.error("Fear & Greed 데이터를 불러오지 못했어요.", e);
  }
}

async function loadVix() {
  try {
    const res = await fetch("data/vix.json", { cache: "no-store" });
    const data = await res.json();

    document.getElementById("vix-number").textContent = data.current;
    const changeEl = document.getElementById("vix-change");
    const sign = data.change_pct >= 0 ? "+" : "";
    changeEl.textContent = `${sign}${data.change_pct}% (전일 대비)`;
    changeEl.style.color = data.change_pct >= 0 ? "var(--fear)" : "var(--greed)";

    drawLineChart("vix-chart", data.timeline, "var(--vix)", {
      gridSteps: [10, 20, 30, 40],
      tooltipFormat: p => `
        <div class="tt-date">${formatDate(p.date)}</div>
        <div class="tt-value" style="color:var(--vix)">${p.value}</div>
      `,
    });

    return data;
  } catch (e) {
    console.error("VIX 데이터를 불러오지 못했어요.", e);
  }
}

// ------------------------------------------------------------------
// Yardeni 차트 이미지 클릭 시 확대(라이트박스)
// ------------------------------------------------------------------
function initLightbox() {
  const lightbox = document.getElementById("img-lightbox");
  const lightboxImg = document.getElementById("lightbox-img");

  document.querySelectorAll(".yardeni-col img").forEach(img => {
    img.addEventListener("click", () => {
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.classList.add("open");
    });
  });

  lightbox.addEventListener("click", () => lightbox.classList.remove("open"));
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") lightbox.classList.remove("open");
  });
}

(async function init() {
  initLightbox();
  const [fng] = await Promise.all([loadFng(), loadVix()]);
  if (fng) {
    document.getElementById("last-updated").textContent =
      `마지막 업데이트: ${formatKST(fng.updated_at)}`;
  }
})();
