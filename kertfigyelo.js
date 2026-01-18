(async function() {
    const CACHE_VERSION = 'v6.3.10'; 
    const RAIN_THRESHOLD = 8;
    const RAIN_NONE = 0.8; 

    const safeStorage = {
        getItem: (k) => { try { return localStorage.getItem(k); } catch(e) { return null; } },
        setItem: (k, v) => { try { localStorage.setItem(k, v); } catch(e) { } },
        removeItem: (k) => { try { localStorage.removeItem(k); } catch(e) { } }
    };

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('lat') && urlParams.has('lon')) {
        safeStorage.setItem('garden-lat', urlParams.get('lat'));
        safeStorage.setItem('garden-lon', urlParams.get('lon'));
        safeStorage.removeItem('garden-weather-cache');
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

    function processMessage(msg, weather, dryDays, isCheckCategory, targetIdx) {
        if (!msg || !weather || !weather.daily) return "";
        try {
            const d = weather.daily;
            const idx = (targetIdx !== undefined) ? targetIdx : 7;
            
            // Érték cserék
            if (msg.includes("{temp}")) msg = msg.replace("{temp}", Math.round(d.temperature_2m_min[idx]));
            if (msg.includes("{wind}")) msg = msg.replace("{wind}", Math.round(d.wind_gusts_10m_max[idx]));
            if (msg.includes("{rain}")) msg = msg.replace("{rain}", Math.round(d.precipitation_sum[idx] || 0));
            if (msg.includes("{soil_temp}")) msg = msg.replace("{soil_temp}", d.soil_temperature_6cm && d.soil_temperature_6cm[idx] ? Math.round(d.soil_temperature_6cm[idx]) : "--");
            if (msg.includes("{uv}")) msg = msg.replace("{uv}", d.uv_index_max && d.uv_index_max[idx] ? d.uv_index_max[idx].toFixed(1) : "--");
            if (msg.includes("{rain_prob}")) msg = msg.replace("{rain_prob}", d.precipitation_probability_max ? d.precipitation_probability_max[idx] : "--");
            
            // Trendek és speciálisak
            if (msg.includes("{temp_trend}")) {
                const diff = d.temperature_2m_min[idx] - d.temperature_2m_min[idx-1];
                const trend = diff <= -2 ? " (erősen hűl)" : (diff >= 2 ? " (enyhül)" : "");
                msg = msg.replace("{temp_trend}", trend);
            }
            if (msg.includes("{snow}")) {
                const snowVal = Math.max(...(d.snowfall_sum || [0]).slice(idx-3, idx+1));
                msg = msg.replace("{snow}", Math.round(snowVal));
            }
            if (msg.includes("{days}")) msg = msg.replace("{days}", dryDays);
            
            if (msg.includes("{next_rain}")) {
                const rIdx = d.precipitation_sum ? d.precipitation_sum.slice(7).findIndex(r => r >= 1) : -1;
                if (rIdx !== -1) {
                    const rainDate = new Date(d.time[rIdx + 7]);
                    msg = msg.replace("{next_rain}", rIdx === 0 ? "Ma esik!" : `Eső: ${rainDate.toLocaleDateString('hu-HU',{weekday:'long'})}.`);
                } else msg = msg.replace("{next_rain}", "Nincs eső a láthatáron.");
            }
        } catch(e) { console.warn("Msg error", e); }
        return msg.split(/([.!?])\s+/).map((s, i, a) => (i % 2 === 0 && s) ? `<span style="display:block; margin-bottom:5px;">${s}${a[i+1] || ""}</span>` : "").join('');
    }

    function checkCondition(weather, idx, key, val, dryDays) {
        const d = weather.daily;
        if (!d) return false;
        try {
            if (key.includes('temp_max_below')) return d.temperature_2m_max[idx] <= val;
            if (key.includes('temp_min_below') || key.includes('temp_below')) return d.temperature_2m_min[idx] <= val;
            if (key.includes('temp_min_above')) return d.temperature_2m_min[idx] >= val;
            if (key.includes('temp_above')) return d.temperature_2m_max[idx] >= val;
            if (key.includes('soil_temp_above')) return d.soil_temperature_6cm && d.soil_temperature_6cm[idx] >= val;
            if (key.includes('soil_temp_below')) return d.soil_temperature_6cm && d.soil_temperature_6cm[idx] <= val;
            if (key.includes('rain_min')) return d.precipitation_sum[idx] >= val;
            if (key.includes('rain_max')) return d.precipitation_sum[idx] <= Math.max(val, RAIN_NONE);
            if (key.includes('wind_gusts_min')) return d.wind_gusts_10m_max[idx] >= val;
            if (key.includes('snow_min')) return d.snowfall_sum[idx] >= val;
            if (key.includes('snow_max')) return d.snowfall_sum[idx] <= val;
            if (key.includes('uv_above')) return d.uv_index_max && d.uv_index_max[idx] >= val;
            if (key === 'days_min') return dryDays >= val;
            if (key === 'days_max') return dryDays <= val;
        } catch(e) { return false; }
        return true;
    }

    function checkSustained(weather, dayIdx, rule, dryDays) {
        const cond = rule.conditions || {};
        for (const key in cond) {
            if (key.endsWith('_any')) {
                const baseKey = key.replace('_any', '');
                let foundAny = false;
                for (let i = 0; i <= 7; i++) {
                    if (checkCondition(weather, i, baseKey, cond[key], dryDays)) { foundAny = true; break; }
                }
                if (!foundAny) return false;
            }
        }
        if (rule.category === 'check') {
            for (let i = 0; i <= 2; i++) {
                const cIdx = dayIdx - i;
                if (cIdx < 0) continue;
                let match = true;
                for (const key in cond) {
                    if (key.endsWith('_any')) continue;
                    if (!checkCondition(weather, cIdx, key, cond[key], dryDays)) match = false;
                }
                if (match) return true;
            }
            return false;
        }
        const days = (cond.days_min && !cond.temp_above) ? 1 : (cond.days_min || 1);
        for (const key in cond) {
            if (key === 'days_min' || key === 'days_max' || key.endsWith('_any')) continue; 
            for (let j = 0; j < days; j++) if (!checkCondition(weather, dayIdx - j, key, cond[key], dryDays)) return false;
        }
        return true;
    }

    async function init() {
        const widgetDiv = document.getElementById('kertfigyelo');
        if (!widgetDiv) return;

        try {
            let lat = Number(safeStorage.getItem('garden-lat')) || 47.5136;
            let lon = Number(safeStorage.getItem('garden-lon')) || 19.3735;
            let isPers = !!safeStorage.getItem('garden-lat');

            let weather;
            const cached = safeStorage.getItem('garden-weather-cache');
            if (cached) {
                const p = JSON.parse(cached);
                if (p.version === CACHE_VERSION && Date.now() - p.ts < 1800000) { weather = p.data; }
            }

            if (!weather) {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_gusts_10m_max,uv_index_max,precipitation_probability_max&hourly=soil_temperature_6cm&past_days=7&timezone=auto`;
                const resp = await fetch(url);
                const rawData = await resp.json();
                rawData.daily.soil_temperature_6cm = [];
                for (let i = 0; i < rawData.daily.time.length; i++) {
                    rawData.daily.soil_temperature_6cm.push(rawData.hourly.soil_temperature_6cm[i * 24 + 12] ?? null);
                }
                weather = rawData;
                safeStorage.setItem('garden-weather-cache', JSON.stringify({ version: CACHE_VERSION, ts: Date.now(), data: weather }));
            }

            const daily = weather.daily;
            const lastRain = safeStorage.getItem('last_rain_date') || daily.time[0];
            const dryDays = Math.floor(Math.abs(new Date() - new Date(lastRain)) / 86400000);

            const rules = await (await fetch('https://raw.githack.com/amezitlabaskert-lab/kertfigyelo/main/kertfigyelo_esemenyek.json?v=' + Date.now())).json();
            const rawResults = [];

            rules.forEach(rule => {
                let range = null, tIdx = null; 
                for (let i = 7; i < daily.time.length; i++) {
                    if (checkSustained(weather, i, rule, dryDays)) {
                        if (!range) { range = { start: new Date(daily.time[i]), end: new Date(daily.time[i]) }; tIdx = i; }
                        else range.end = new Date(daily.time[i]);
                    } else if (range) break;
                }
                if (range) rawResults.push({ ...rule, start: range.start, end: range.end, targetIdx: tIdx });
            });

            const groupWinners = {};
            rawResults.forEach(r => { if (r.group && (!groupWinners[r.group] || (r.priority || 0) > (groupWinners[r.group].priority || 0))) groupWinners[r.group] = r; });
            const filtered = rawResults.filter(r => !r.group || r.id === groupWinners[r.group].id);

            const mapToResult = (item) => {
                const diff = Math.round((noon(item.start) - noon(new Date())) / 86400000);
                let label = diff < 0 ? "FOLYAMATBAN" : (diff === 0 ? "MA" : diff + " NAP MÚLVA");
                if (item.category === "seasonal") label = "SZEZONÁLIS";
                if (item.category === "check") label = "VISSZATEKINTŐ";
                const badgeClass = item.category === "seasonal" ? 'type-szezon' : (item.category === "check" ? 'type-szemle' : (diff <= 0 ? 'time-urgent' : 'time-soon'));
                return { title: item.name, range: `<span class="time-badge ${badgeClass}">${label}</span>`, msg: processMessage(item.message, weather, dryDays, item.category === "check", item.targetIdx), type: item.type };
            };

            const alerts = filtered.filter(r => r.type === 'alert').map(mapToResult);
            const others = filtered.filter(r => r.type !== 'alert').map(mapToResult);

            widgetDiv.innerHTML = `<div class="garden-main-card">
                <div class="garden-title">${isPers ? 'Kertfigyelőm' : 'Kertfigyelő'}</div>
                <button id="locBtn" class="loc-btn">${isPers ? 'Vissza az alaphoz' : 'Saját kertfigyelőt!'}</button>
                <div class="section-title">Riasztások</div>${renderZone(alerts, 'alert')}
                <div class="section-title">Teendők & Info</div>${renderZone(others, 'tasks')}
                <div class="garden-footer">v${CACHE_VERSION} | ${new Date().toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'})}</div>
            </div>`;

            document.getElementById('locBtn').onclick = () => {
                if (isPers) { ['garden-lat','garden-lon','garden-weather-cache','last_rain_date'].forEach(k => safeStorage.removeItem(k)); location.reload(); }
                else { navigator.geolocation.getCurrentPosition(p => { safeStorage.setItem('garden-lat', p.coords.latitude); safeStorage.setItem('garden-lon', p.coords.longitude); safeStorage.removeItem('garden-weather-cache'); location.reload(); }); }
            };
            const setup = (id, len) => { if (len <= 1) return; const items = document.querySelectorAll(`#${id}-carousel .carousel-item`); let i = 0; setInterval(() => { if(items[i]) items[i].classList.remove('active'); i = (i + 1) % len; if(items[i]) items[i].classList.add('active'); }, 8000); };
            setup('alert', alerts.length); setup('tasks', others.length);

        } catch(e) { 
            console.error(e); 
            widgetDiv.innerHTML = `<div style="padding:20px;text-align:center;">Betöltés...<br><button onclick="localStorage.clear();location.reload();">Frissítés</button></div>`;
        }
    }

    function renderZone(items, id) {
        if (!items.length) return `<div class="carousel-wrapper" style="display:flex;align-items:center;justify-content:center;opacity:0.3;font-size:12px;">Minden rendben</div>`;
        return `<div id="${id}-carousel" class="carousel-wrapper">${items.map((item, idx) => `<div class="carousel-item ${idx === 0 ? 'active' : ''}"><div class="card-container"><div class="card-line card-type-${item.type}"></div><div class="event-name">${item.title}</div><div class="event-range">${item.range}</div><div class="event-msg">${item.msg}</div></div></div>`).join('')}</div>`;
    }
    init();
})();
