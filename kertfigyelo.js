(async function() {
    const CACHE_VERSION = 'v5.0'; 
    const RAIN_THRESHOLD = 8;

    // 1. URL PARAMÉTEREK AZONNALI KEZELÉSE
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('lat') && urlParams.has('lon')) {
        localStorage.setItem('garden-lat', urlParams.get('lat'));
        localStorage.setItem('garden-lon', urlParams.get('lon'));
        localStorage.removeItem('garden-weather-cache');
    }

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
        #kertfigyelo { width: 300px; text-align: left; margin: 0; background: white; overflow: hidden; border-radius: 0; }
        .garden-main-card { background: #ffffff !important; padding: 18px; display: flex; flex-direction: column; box-sizing: border-box; min-height: 480px; height: auto; border-radius: 0; pointer-events: none; user-select: none; }
        .garden-title { font-family: 'Dancing Script', cursive !important; font-size: 3.6em !important; font-weight: 700 !important; text-align: center !important; margin: 5px 0 12px 0 !important; line-height: 1.1; color: #1a1a1a; }
        .section-title { font-family: 'Plus Jakarta Sans', sans-serif !important; font-weight: 800 !important; font-size: 14px !important; text-transform: uppercase; letter-spacing: 1.2px; margin: 12px 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid rgba(0,0,0,0.06); color: #64748b; }
        .carousel-wrapper { position: relative; height: 140px; margin-bottom: 5px; overflow: hidden; }
        .carousel-item { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; visibility: hidden; transition: opacity 1.2s ease-in-out; display: flex; flex-direction: column; justify-content: center; }
        .carousel-item.active { opacity: 1; visibility: visible; }
        .card-container { position: relative; padding-left: 14px; width: 100%; box-sizing: border-box; }
        .card-line { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; border-radius: 0; }
        .card-type-alert { background: #b91c1c !important; }
        .card-type-window { background: #2d6a4f !important; }
        .card-type-info { background: #6691b3 !important; }
        .card-type-none { background: #94a3b8 !important; }
        .event-name { font-family: 'Plus Jakarta Sans', sans-serif !important; font-weight: 800 !important; font-size: 16px !important; margin-bottom: 2px; color: #1e293b; line-height: 1.2; }
        .event-range { font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 11px !important; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; color: #64748b; }
        .event-msg { font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 14px !important; line-height: 1.45; color: #334155; }
        .time-badge { display: inline-block; padding: 2px 6px; font-size: 10px !important; font-weight: 800; border-radius: 3px; margin-right: 5px; }
        .type-szezon { background: #1e293b; color: #fff; }
        .type-szemle { background: #0891b2; color: #fff; }
        .time-urgent { background: #b91c1c; color: #fff; }
        .time-warning { background: #ea580c; color: #fff; }
        .time-soon { background: #64748b; color: #fff; }
        .garden-footer { text-align: center; font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 10px !important; margin-top: auto; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.05); opacity: 0.6; line-height: 1.4; }
        .loc-btn { width: 100%; cursor: pointer; padding: 10px; font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 10px; margin-bottom: 5px; text-transform: uppercase; font-weight: 800; border: none; border-radius: 0; background: #475569; color: white; animation: pulse-invitation 3s infinite ease-in-out; pointer-events: auto }
    `;
    document.head.appendChild(styleSheet);

    const noon = d => new Date(d).setHours(12,0,0,0);

    function processMessage(msg, weather, dryDays) {
        if (!msg) return "";
        try {
            if (msg.includes("{temp}")) msg = msg.replace("{temp}", Math.round(Math.min(...weather.daily.temperature_2m_min.slice(7))));
            if (msg.includes("{wind}")) msg = msg.replace("{wind}", Math.round(Math.max(...weather.daily.wind_gusts_10m_max.slice(7))));
            if (msg.includes("{snow}")) msg = msg.replace("{snow}", Math.round(Math.max(...weather.daily.snowfall_sum.slice(7)) * 10) / 10);
            if (msg.includes("{days}")) msg = msg.replace("{days}", dryDays);
            if (msg.includes("{next_rain}")) {
                const idx = weather.daily.precipitation_sum.slice(7).findIndex(r => r >= 1);
                if (idx !== -1) {
                    const d = new Date(weather.daily.time[idx + 7]);
                    msg = msg.replace("{next_rain}", idx === 0 ? "Ma esik!" : `Eső: ${d.toLocaleDateString('hu-HU',{weekday:'long'})} (${Math.round(weather.daily.precipitation_sum[idx + 7])}mm).`);
                } else msg = msg.replace("{next_rain}", "Nincs eső a láthatáron.");
            }
        } catch(e) { console.warn("Msg error", e); }
        return msg.split(/([.!?])\s+/).map((s, i, a) => (i % 2 === 0 && s) ? `<span style="display:block; margin-bottom:5px;">${s}${a[i+1] || ""}</span>` : "").join('');
    }

    function checkCondition(weather, idx, key, val, dryDays) {
        const d = weather.daily;
        if (key === 'temp_max_below') return d.temperature_2m_max[idx] <= val;
        if (key === 'temp_min_below' || key === 'temp_below') return d.temperature_2m_min[idx] <= val;
        if (key === 'temp_min_above') return d.temperature_2m_min[idx] >= val;
        if (key === 'temp_above') return d.temperature_2m_max[idx] >= val;
        if (key.startsWith('rain_min')) return d.precipitation_sum[idx] >= val;
        if (key.startsWith('rain_max')) return d.precipitation_sum[idx] <= val;
        if (key.includes('wind_gusts')) return d.wind_gusts_10m_max[idx] >= val;
        if (key === 'wind_max') return d.wind_speed_10m_max[idx] <= val;
        if (key.includes('snow')) return d.snowfall_sum[idx] >= val;
        if (key === 'days_min') return dryDays >= val;
        if (key === 'days_max') return dryDays <= val;
        return true;
    }

    function checkSustained(weather, dayIdx, rule, dryDays) {
        const cond = rule.conditions || {};
        if (rule.category === 'check') {
            for (let i = 0; i <= 1; i++) {
                const cIdx = dayIdx - i;
                if (cIdx < 0) continue;
                let match = true;
                for (const key in cond) if (!checkCondition(weather, cIdx, key, cond[key], dryDays)) match = false;
                if (match) return true;
            }
            return false;
        }
        if (cond.days_min !== undefined && dryDays < cond.days_min) return false;
        const days = (cond.days_min && !cond.temp_above) ? 1 : (cond.days_min || 1);
        if (dayIdx < days - 1) return false;
        for (const key in cond) {
            if (key === 'days_min' || key === 'days_max') continue; 
            for (let j = 0; j < days; j++) if (!checkCondition(weather, dayIdx - j, key, cond[key], dryDays)) return false;
        }
        return true;
    }

    async function init() {
        const widgetDiv = document.getElementById('kertfigyelo');
        if (!widgetDiv) return;

        try {
            // KOORDINÁTÁK FRISSÍTÉSE
            let lat = Number(localStorage.getItem('garden-lat')) || 47.5136;
            let lon = Number(localStorage.getItem('garden-lon')) || 19.3735;
            let isPers = !!localStorage.getItem('garden-lat');

            let weather, lastUpdate;
            const cached = localStorage.getItem('garden-weather-cache');
            if (cached) {
                const p = JSON.parse(cached);
                if (p.version === CACHE_VERSION && Date.now() - p.ts < 1800000) { weather = p.data; lastUpdate = new Date(p.ts); }
            }

            if (!weather) {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,snowfall_sum,precipitation_probability_max&past_days=7&timezone=auto&v=${Date.now()}`;
                weather = await (await fetch(url)).json();
                lastUpdate = new Date();
                localStorage.setItem('garden-weather-cache', JSON.stringify({ version: CACHE_VERSION, ts: lastUpdate.getTime(), data: weather }));
            }

            const todayIdx = 7;
            if (weather.daily.precipitation_sum[todayIdx] >= RAIN_THRESHOLD) localStorage.setItem('last_rain_date', weather.daily.time[todayIdx]);
            const lastRain = localStorage.getItem('last_rain_date');
            const dryDays = lastRain ? Math.floor(Math.abs(new Date() - new Date(lastRain)) / 86400000) : 0;

            const rules = await (await fetch('https://raw.githack.com/amezitlabaskert-lab/kertfigyelo/main/kertfigyelo_esemenyek.json?v=' + Date.now())).json();
            const rawResults = [];

            rules.forEach(rule => {
                if (!rule.id) return;
                let range = null;
                for (let i = todayIdx; i < weather.daily.time.length; i++) {
                    const d = new Date(weather.daily.time[i]);
                    const inSeason = !rule.seasons || rule.seasons.some(s => {
                        const [sM, sD] = s.start.split('-').map(Number), [eM, eD] = s.end.split('-').map(Number);
                        const sDate = new Date(d.getFullYear(), sM-1, sD), eDate = new Date(d.getFullYear(), eM-1, eD);
                        return eDate < sDate ? (d >= sDate || d <= eDate) : (d >= sDate && d <= eDate);
                    });
                    if (inSeason && checkSustained(weather, i, rule, dryDays)) {
                        if (!range) range = { start: d, end: d }; else range.end = d;
                    } else if (range) break;
                }
                if (range) rawResults.push({ ...rule, start: range.start, end: range.end });
            });

            const groupWinners = {};
            rawResults.forEach(r => { if (r.group && (!groupWinners[r.group] || (r.priority || 0) > (groupWinners[r.group].priority || 0))) groupWinners[r.group] = r; });
            const filtered = rawResults.filter(r => !r.group || r.id === groupWinners[r.group].id);

            const mapToResult = (item) => {
                const diff = Math.round((noon(item.start) - noon(new Date())) / 86400000);
                let label = diff < 0 ? "FOLYAMATBAN" : (diff === 0 ? "MA" : diff + " NAP MÚLVA");
                if (item.category === "seasonal") label = "SZEZONÁLIS";
                if (item.category === "check") label = "VISSZATEKINTŐ";
                if (item.id.includes('aszaly') && dryDays >= 7) label = dryDays >= 14 ? `${Math.floor(dryDays/7)} HETE TART` : `${dryDays} NAPJA TART`;
                const badgeClass = item.category === "seasonal" ? 'type-szezon' : (item.category === "check" ? 'type-szemle' : (diff <= 0 ? 'time-urgent' : (diff === 1 ? 'time-warning' : 'time-soon')));
                let rangeStr = `<span class="time-badge ${badgeClass}">${label}</span>`;
                if (!["seasonal", "check"].includes(item.category) && noon(item.start) !== noon(item.end)) rangeStr += ` — ${new Date(item.end).toLocaleDateString('hu-HU',{month:'short',day:'numeric'}).toUpperCase()}`;
                return { title: item.name, range: rangeStr, msg: processMessage(item.message, weather, dryDays), type: item.type };
            };

            const alerts = filtered.filter(r => r.type === 'alert').map(mapToResult);
            let others = filtered.filter(r => r.type === 'window').map(mapToResult);
            if (!others.length) others = filtered.filter(r => ['info', 'none'].includes(r.type)).map(mapToResult);

            widgetDiv.innerHTML = `<div class="garden-main-card">
                <div class="garden-title">${isPers ? 'Kertfigyelőm' : 'Kertfigyelő'}</div>
                <button id="locBtn" class="loc-btn">${isPers ? 'Vissza az alaphoz' : 'Saját kertfigyelőt!'}</button>
                <div class="section-title">Riasztások</div>${renderZone(alerts, 'alert')}
                <div class="section-title">Teendők & Info</div>${renderZone(others, 'tasks')}
                <div class="garden-footer">Helyszín: ${isPers ? 'Az én kertem' : 'A Mezítlábas Kert bázisa'}<br>Frissítve: ${lastUpdate.toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'})} | ${CACHE_VERSION}</div>
            </div>`;

            document.getElementById('locBtn').onclick = () => {
                if (isPers) { 
                    ['garden-lat','garden-lon','garden-weather-cache','last_rain_date'].forEach(k => localStorage.removeItem(k)); 
                    window.parent.postMessage({ type: 'GARDEN_LOCATION_CHANGED', lat: 47.5136, lon: 19.3735 }, '*');
                    location.reload(); 
                } else { 
                    navigator.geolocation.getCurrentPosition(p => {
                        const {latitude: la, longitude: lo} = p.coords;
                        if (la > 45.7 && la < 48.6 && lo > 16.1 && lo < 22.9) { 
                            localStorage.setItem('garden-lat', la); localStorage.setItem('garden-lon', lo); localStorage.removeItem('garden-weather-cache');
                            window.parent.postMessage({ type: 'GARDEN_LOCATION_CHANGED', lat: la, lon: lo }, '*');
                            location.reload(); 
                        } else alert("Csak Magyarország területén működik. 🇭🇺");
                    }, (err) => alert("Hiba a helymeghatározásnál.")); 
                }
            };
            const setup = (id, len) => { if (len <= 1) return; const items = document.querySelectorAll(`#${id}-carousel .carousel-item`); let i = 0; setInterval(() => { if(items[i]) items[i].classList.remove('active'); i = (i + 1) % len; if(items[i]) items[i].classList.add('active'); }, 8000); };
            setup('alert', alerts.length); setup('tasks', others.length);
        } catch(e) { widgetDiv.innerHTML = `<div style="padding:40px 20px; text-align:center; background:white;"><button onclick="location.reload()">FRISSÍTÉS</button></div>`; }
    }

    function renderZone(items, id) {
        if (!items.length) return `<div class="carousel-wrapper" style="display:flex;align-items:center;justify-content:center;opacity:0.3;font-size:12px;">Nincs aktuális esemény</div>`;
        return `<div id="${id}-carousel" class="carousel-wrapper">${items.map((item, idx) => `<div class="carousel-item ${idx === 0 ? 'active' : ''}"><div class="card-container"><div class="card-line card-type-${item.type}"></div><div class="event-name">${item.title}</div><div class="event-range">${item.range}</div><div class="event-msg">${item.msg}</div></div></div>`).join('')}</div>`;
    }
    init();
})();


