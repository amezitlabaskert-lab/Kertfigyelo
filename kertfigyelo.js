(async function() {
    // --- KONFIGURÁCIÓ ---
    const CACHE_VERSION = 'v3.9.8'; // Ha módosítod a szabályokat, ezt írd át v3.9.9-re stb.
    // ---------------------

    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Plus+Jakarta+Sans:wght@400;700;800&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        @keyframes pulse-invitation {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(71, 85, 105, 0.4); }
            70% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(71, 85, 105, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(71, 85, 105, 0); }
        }
        #kertfigyelo { width: 300px; text-align: left; margin: 0; }
        .garden-main-card { 
            background: #ffffff !important; padding: 18px; display: flex; 
            flex-direction: column; box-sizing: border-box; height: 540px; 
            border: 1px solid #000;
        }
        .garden-title { font-family: 'Dancing Script', cursive !important; font-size: 3.2em !important; font-weight: 700 !important; text-align: center !important; margin: 5px 0 12px 0 !important; line-height: 1.1; color: #1a1a1a; }
        .section-title { font-family: 'Plus Jakarta Sans', sans-serif !important; font-weight: 800 !important; font-size: 14px !important; text-transform: uppercase; letter-spacing: 1.2px; margin: 12px 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid rgba(0,0,0,0.06); color: #64748b; }
        .carousel-wrapper { position: relative; height: 165px; margin-bottom: 5px; overflow: hidden; }
        .carousel-item { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; visibility: hidden; transition: opacity 1.2s ease-in-out; display: flex; flex-direction: column; justify-content: center; }
        .carousel-item.active { opacity: 1; visibility: visible; }
        .card-container { position: relative; padding-left: 14px; width: 100%; box-sizing: border-box; }
        .card-line { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
        .card-type-alert { background: #b91c1c !important; }
        .card-type-window { background: #2d6a4f !important; }
        .card-type-info { background: #6691b3 !important; }
        .card-type-none { background: #94a3b8 !important; }
        .event-name { font-family: 'Plus Jakarta Sans', sans-serif !important; font-weight: 800 !important; font-size: 16px !important; margin-bottom: 2px; color: #1e293b; line-height: 1.2; }
        .event-range { font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 11px !important; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; color: #64748b; }
        .event-msg { font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 14px !important; line-height: 1.45; color: #334155; }
        .time-badge { display: inline-block; padding: 2px 6px; font-size: 10px !important; font-weight: 800; margin-right: 5px; }
        .time-urgent { background: #b91c1c; color: #fff; animation: pulse-invitation 2s infinite; }
        .time-warning { background: #ea580c; color: #fff; }
        .time-soon { background: #64748b; color: #fff; }
        .garden-footer { text-align: center; font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 10px !important; margin-top: auto; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.05); opacity: 0.6; }
        .loc-btn { width: 100%; cursor: pointer; padding: 10px; font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 10px; margin-bottom: 5px; text-transform: uppercase; font-weight: 800; border: none; background: #475569; color: white; animation: pulse-invitation 3s infinite ease-in-out; }
    `;
    document.head.appendChild(styleSheet);

    function checkSustained(weather, dayIdx, cond, ruleType) {
        const days = cond.days_min || 1;
        if (dayIdx < days - 1) return false;
        const checkCondition = (key, idx) => {
            let val; const condValue = cond[key];
            if (key === 'temp_max_below') return weather.daily.temperature_2m_max[idx] <= condValue;
            if (key === 'temp_min_below' || key === 'temp_below') return weather.daily.temperature_2m_min[idx] <= condValue;
            if (key === 'temp_above') return weather.daily.temperature_2m_max[idx] >= condValue;
            if (key.startsWith('rain_min')) return weather.daily.precipitation_sum[idx] >= condValue;
            if (key.startsWith('rain_max')) return weather.daily.precipitation_sum[idx] <= condValue;
            if (key.startsWith('snow_min')) return weather.daily.snowfall_sum[idx] >= condValue;
            if (key.startsWith('snow_depth')) return weather.daily.snow_depth[idx] >= condValue;
            if (key.startsWith('wind_min')) {
                val = weather.daily[ruleType === 'alert' ? 'wind_gusts_10m_max' : 'wind_speed_10m_max'][idx];
                return val >= condValue;
            }
            if (key.startsWith('wind_max')) {
                val = weather.daily[ruleType === 'alert' ? 'wind_gusts_10m_max' : 'wind_speed_10m_max'][idx];
                return val <= condValue;
            }
            return true;
        };
        for (const key in cond) {
            if (key === 'days_min') continue;
            const isAny = key.endsWith('_any');
            const res = []; for (let j=0; j<days; j++) res.push(checkCondition(key, dayIdx-j));
            if (!(isAny ? res.some(r=>r) : res.every(r=>r))) return false;
        }
        return true;
    }

    const renderZone = (items, id) => {
        if (!items.length) return `<div class="carousel-wrapper" style="display:flex; align-items:center; justify-content:center; opacity:0.3; font-size:12px;">Nincs aktuális esemény</div>`;
        return `<div id="${id}-carousel" class="carousel-wrapper">${items.map((item, idx) => {
            let stickyMsg = item.msg.replace(/ (a|az|is|s|e|de|ha|ne) /gi, ' $1\u00A0');
            const sentences = stickyMsg.split(/([.!?])\s+/);
            let msgHtml = "";
            for (let i = 0; i < sentences.length; i += 2) {
                if (sentences[i]) msgHtml += `<span style="display:block; margin-bottom:5px;">${sentences[i]}${sentences[i+1] || ""}</span>`;
            }
            return `
            <div class="carousel-item ${idx === 0 ? 'active' : ''}">
                <div class="card-container">
                    <div class="card-line card-type-${item.type}"></div>
                    <div class="event-name">${item.title}</div>
                    ${item.type !== 'none' ? `<div class="event-range">${item.range}</div>` : ''}
                    <div class="event-msg">${msgHtml}</div>
                </div>
            </div>`;
        }).join('')}</div>`;
    };

    async function init() {
        const widgetDiv = document.getElementById('kertfigyelo');
        if (!widgetDiv) return;
        try {
            let lat = 47.5136, lon = 19.3735, isPers = false;
            const sLat = localStorage.getItem('garden-lat'), sLon = localStorage.getItem('garden-lon');
            if (sLat && sLon) { lat = Number(sLat); lon = Number(sLon); isPers = true; }

            let weather, lastUpdate;
            const cached = localStorage.getItem('garden-weather-cache');
            if (cached) {
                const p = JSON.parse(cached);
                // --- CLAUDE-FÉLE VERZIÓ ELLENŐRZÉS ---
                if (p.version === CACHE_VERSION && Date.now() - p.ts < 1800000 && Math.abs(p.lat - lat) < 0.01) {
                    weather = p.data; lastUpdate = new Date(p.ts);
                }
            }

            if (!weather) {
                const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,snowfall_sum,snow_depth&past_days=7&timezone=auto`);
                weather = await wRes.json();
                lastUpdate = new Date();
                // --- VERZIÓ MENTÉSE A CACHE-BE ---
                localStorage.setItem('garden-weather-cache', JSON.stringify({ 
                    version: CACHE_VERSION,
                    ts: lastUpdate.getTime(), 
                    data: weather, 
                    lat, 
                    lon 
                }));
            }

            const rRes = await fetch('https://raw.githack.com/amezitlabaskert-lab/kertfigyelo/main/kertfigyelo_esemenyek.json?v=' + Date.now());
            const rules = await rRes.json();

            const results = [];
            const todayStr = new Date().toISOString().split('T')[0];
            const noon = d => new Date(d).setHours(12,0,0,0);

            rules.forEach(rule => {
                let range = null;
                for (let i = 0; i < weather.daily.time.length; i++) {
                    const d = new Date(weather.daily.time[i]);
                    let inSeason = rule.seasons ? rule.seasons.some(s => {
                        const [sM, sD] = s.start.split('-').map(Number);
                        const [eM, eD] = s.end.split('-').map(Number);
                        const startD = new Date(d.getFullYear(), sM-1, sD), endD = new Date(d.getFullYear(), eM-1, eD);
                        return endD < startD ? (d >= startD || d <= endD) : (d >= startD && d <= endD);
                    }) : true;
                    if (inSeason && checkSustained(weather, i, rule.conditions || {}, rule.type)) {
                        if (!range) range = { start: d, end: d }; else range.end = d;
                    } else if (range) break;
                }
                if (range && noon(range.end) >= noon(todayStr)) {
                    const fmt = (date, isStart) => {
                        const diff = Math.round((noon(date) - noon(todayStr)) / 86400000);
                        if (isStart) {
                            let label = diff === 0 ? "MA" : (diff === 1 ? "HOLNAP" : (diff <= 3 ? diff + " NAP MÚLVA" : date.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}).toUpperCase()));
                            let cls = diff === 0 ? "time-urgent" : (diff === 1 ? "time-warning" : "time-soon");
                            return `<span class="time-badge ${cls}">${label}</span>`;
                        }
                        return date.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}).toUpperCase();
                    };
                    results.push({ range: noon(range.start) !== noon(range.end) ? fmt(range.start, true) + ' — ' + fmt(range.end, false) : fmt(range.start, true), title: rule.name, msg: rule.message, type: rule.type });
                }
            });

            const alerts = results.filter(r => r.type === 'alert');
            const otherTasks = results.filter(r => r.type !== 'alert');

            widgetDiv.innerHTML = `
                <div class="garden-main-card">
                    <div class="garden-title">${isPers ? 'Kertfigyelőd' : 'Kertfigyelő'}</div>
                    <button id="locBtn" class="loc-btn">${isPers ? 'Vissza az alaphoz' : 'Saját kertfigyelőt!'}</button>
                    <div class="section-title">Riasztások</div>
                    ${renderZone(alerts, 'alert')}
                    <div class="section-title">Teendők</div>
                    ${renderZone(otherTasks, 'tasks')}
                    <div class="garden-footer">Last updated: ${lastUpdate.toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'})}<br>${CACHE_VERSION} Edition</div>
                </div>`;

            document.getElementById('locBtn').onclick = () => {
                if (isPers) {
                    localStorage.removeItem('garden-lat'); localStorage.removeItem('garden-lon');
                    localStorage.removeItem('garden-weather-cache'); location.reload();
                } else {
                    navigator.geolocation.getCurrentPosition(p => {
                        const {latitude: la, longitude: lo} = p.coords;
                        if (la > 45.7 && la < 48.6 && lo > 16.1 && lo < 22.9) {
                            localStorage.setItem('garden-lat', la); localStorage.setItem('garden-lon', lo);
                            localStorage.removeItem('garden-weather-cache'); location.reload();
                        } else alert("Ez a widget csak Magyarországon működik.");
                    }, () => alert("Helymeghatározási hiba."));
                }
            };

            const setupCarousel = (id, count) => {
                if (count <= 1) return;
                const items = document.querySelectorAll(`#${id}-carousel .carousel-item`);
                let idx = 0; setInterval(() => {
                    items[idx].classList.remove('active'); idx = (idx + 1) % items.length; items[idx].classList.add('active');
                }, 6000);
            };
            setupCarousel('alert', alerts.length);
            setupCarousel('tasks', otherTasks.length);
        } catch(e) { console.error(e); }
    }
    init();
})();
