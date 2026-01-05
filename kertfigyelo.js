(async function() {
    // 1. Fontok és Stílusok (v3.6.8 - UX Time-Badges + Winter Skin)
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

        /* Ez a rész került nálad az idézőjelen kívülre, azért látod a képernyőn: */
        #kertfigyelo button, #kertfigyelo .loc-btn { 
            pointer-events: auto !important; 
            cursor: pointer !important; 
        }

        .garden-main-card { 
            background: transparent !important; 
            padding: 18px;                      
            margin: 0 !important;               
            display: flex; 
            flex-direction: column;
            box-sizing: border-box;
            height: 480px;
        }

        }
        .garden-title { font-family: 'Dancing Script', cursive !important; font-size: 3.6em !important; font-weight: 700 !important; text-align: center !important; margin: 5px 0 12px 0 !important; line-height: 1.1; color: #1a1a1a; }
        .section-title { font-family: 'Plus Jakarta Sans', sans-serif !important; font-weight: 800 !important; font-size: 14px !important; text-transform: uppercase; letter-spacing: 1.2px; margin: 12px 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid rgba(0,0,0,0.06); color: #64748b; }
        .carousel-wrapper { position: relative; height: 125px; margin-bottom: 5px; overflow: hidden; }
        .carousel-item { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; visibility: hidden; transition: opacity 1.2s ease-in-out; }
        .carousel-item.active { opacity: 1; visibility: visible; }
        .card-container { position: relative; padding-left: 14px; height: 100%; }
        .card-line { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
        .card-type-alert { background: #b91c1c !important; }
        .card-type-window { background: #2d6a4f !important; }
        .card-type-info { background: #6691b3 !important; }
        .card-type-none { background: #94a3b8 !important; }
        .event-name { font-family: 'Plus Jakarta Sans', sans-serif !important; font-weight: 800 !important; font-size: 16px !important; margin-bottom: 2px; color: #1e293b; }
        
        .event-range { display: flex; align-items: center; font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 11px !important; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; color: #64748b; }
        .time-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px !important; font-weight: 800; margin-right: 5px; vertical-align: middle; }
        .time-urgent { background: #b91c1c; color: #fff; animation: pulse-invitation 2s infinite; }
        .time-warning { background: #ea580c; color: #fff; }
        .time-soon { background: #64748b; color: #fff; }

        .event-msg { font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 14px !important; line-height: 1.45; color: #334155; }
        .garden-footer { text-align: center; font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 10px !important; margin-top: auto; padding-top: 8px; line-height: 1.4; border-top: 1px solid rgba(0,0,0,0.05); opacity: 0.6; }
        
        .loc-btn { 
            width: 100%; cursor: pointer; padding: 10px; font-family: 'Plus Jakarta Sans', sans-serif !important; 
            font-size: 10px; margin-bottom: 5px; text-transform: uppercase; font-weight: 800; border: none; 
            background: #475569; color: white; transition: background 0.3s;
            animation: pulse-invitation 3s infinite ease-in-out;
        }
        .loc-btn:hover { background: #1e293b; animation-play-state: paused; }
    `;
    document.head.appendChild(styleSheet);

    const getSeasonalFallback = (type) => {
        const month = new Date().getMonth() + 1;
        const isWinter = month === 12 || month <= 2;
        const isSpring = month >= 3 && month <= 5;
        const isSummer = month >= 6 && month <= 8;
        if (type === 'alert') {
            if (isWinter) return { range: "TÉL", title: "🛡️ Biztonságos pihenés", msg: "A kemény fagyok elkerülik a kertet.", type: "none" };
            if (isSpring) return { range: "TAVASZ", title: "🌤️ Kedvező ébredés", msg: "Nincs fagyveszély a láthatáron.", type: "none" };
            if (isSummer) return { range: "NYÁR", title: "🧊 Kellemes klíma", msg: "Nincs hőségriadó, élvezd a kertet!", type: "none" };
            return { range: "ŐSZ", title: "☁️ Szelíd ősz", msg: "Viharmentes, nyugodt időjárás.", type: "none" };
        } else {
            if (isWinter) return { range: "TÉL", title: "☕ Téli álom", msg: "Tea, takaró és tervezgetés.", type: "none" };
            if (isSpring) return { range: "TAVASZ", title: "🌱 Ébredező kert", msg: "Figyeld az első rügyeket!", type: "none" };
            if (isSummer) return { range: "NYÁR", title: "☀️ Mezítlábas idő", msg: "Élvezd a füvet a talpad alatt!", type: "none" };
            return { range: "ŐSZ", title: "🍂 Színkavalkád", msg: "Lassulj le az őszi fényekkel.", type: "none" };
        }
    };

    function checkSustained(weather, dayIdx, cond, ruleType) {
        const days = cond.days_min || 1;
        if (dayIdx < days - 1) return false;
        const checkCondition = (key, idx) => {
            let val;
            const condValue = cond[key];
            if (key === 'temp_max_below') { val = weather.daily.temperature_2m_max[idx]; return val <= condValue; } 
            else if (key === 'temp_min_below' || key === 'temp_below') { val = weather.daily.temperature_2m_min[idx]; return val <= condValue; } 
            else if (key === 'temp_above') { val = weather.daily.temperature_2m_max[idx]; return val >= condValue; }
            else if (key.startsWith('rain_min')) { val = weather.daily.precipitation_sum[idx]; return val >= condValue; }
            else if (key.startsWith('rain_max')) { val = weather.daily.precipitation_sum[idx]; return val <= condValue; }
            else if (key.startsWith('wind_min')) { val = weather.daily[ruleType === 'alert' ? 'wind_gusts_10m_max' : 'wind_speed_10m_max'][idx]; return val >= condValue; }
            else if (key.startsWith('wind_max')) { val = weather.daily[ruleType === 'alert' ? 'wind_gusts_10m_max' : 'wind_speed_10m_max'][idx]; return val <= condValue; }
            return true;
        };
        for (const key in cond) {
            if (key === 'days_min') continue;
            const isAny = key.endsWith('_any');
            const dayResults = [];
            for (let j = 0; j < days; j++) dayResults.push(checkCondition(key, dayIdx - j));
            const ok = isAny ? dayResults.some(r => r) : dayResults.every(r => r);
            if (!ok) return false;
        }
        return true;
    }

    async function init() {
        const widgetDiv = document.getElementById('kertfigyelo');
        if (!widgetDiv) return;
        
        try {
            let lat = 47.5136, lon = 19.3735, isPers = false;
            const sLat = localStorage.getItem('garden-lat'), sLon = localStorage.getItem('garden-lon');
            if (sLat && sLon) { lat = Number(sLat); lon = Number(sLon); isPers = true; }

            const cached = localStorage.getItem('garden-weather-cache');
            let weather, lastUpdate;

            if (cached) {
                const p = JSON.parse(cached);
                // Félórás (1800000ms) cache idő
                if (Date.now() - p.ts < 1800000 && Math.abs(p.lat - lat) < 0.01) {
                    weather = p.data; lastUpdate = new Date(p.ts);
                }
            }

            const rRes = await fetch('https://raw.githack.com/amezitlabaskert-lab/kertfigyelo/main/kertfigyelo_esemenyek.json');
            const rules = await rRes.json();

            if (!weather) {
                const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum&past_days=7&timezone=auto`);
                weather = await wRes.json();
                lastUpdate = new Date();
                localStorage.setItem('garden-weather-cache', JSON.stringify({ ts: lastUpdate.getTime(), data: weather, lat, lon }));
            }

            const results = [];
            const todayStr = new Date().toISOString().split('T')[0];
            const noon = d => new Date(d).setHours(12,0,0,0);

            rules.forEach(rule => {
                let range = null;
                for (let i = 0; i < weather.daily.time.length; i++) {
                    const d = new Date(weather.daily.time[i]);
                    let inSeason = true;
                    if (rule.seasons) {
                        inSeason = rule.seasons.some(s => {
                            const [sM, sD] = s.start.split('-').map(Number);
                            const [eM, eD] = s.end.split('-').map(Number);
                            const startD = new Date(d.getFullYear(), sM-1, sD), endD = new Date(d.getFullYear(), eM-1, eD);
                            return endD < startD ? (d >= startD || d <= endD) : (d >= startD && d <= endD);
                        });
                    }
                    if (inSeason && checkSustained(weather, i, rule.conditions || {}, rule.type)) {
                        if (!range) range = { start: d, end: d }; else range.end = d;
                    } else if (range) break;
                }
                
                if (range && noon(range.end) >= noon(todayStr)) {
                    const fmt = (date, isStart) => {
                        const diff = Math.round((noon(date) - noon(todayStr)) / 86400000);
                        let timeLabel = "";
                        let urgencyClass = "";

                        if (isStart) {
                            if (diff === 0) { timeLabel = "MA ESTE"; urgencyClass = "time-urgent"; }
                            else if (diff === 1) { timeLabel = "HOLNAP"; urgencyClass = "time-warning"; }
                            else if (diff > 1 && diff <= 3) { timeLabel = diff + " NAP MÚLVA"; urgencyClass = "time-soon"; }
                            else { timeLabel = date.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}).toUpperCase().replace('.',''); }
                            return `<span class="time-badge ${urgencyClass}">${timeLabel}</span>`;
                        }
                        return date.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}).toUpperCase().replace('.','');
                    };

                    const dateRangeStr = (noon(range.start) !== noon(range.end)) 
                        ? fmt(range.start, true) + ' — ' + fmt(range.end, false)
                        : fmt(range.start, true);

                    results.push({ range: dateRangeStr, title: rule.name, msg: rule.message, type: rule.type });
                }
            });

            const renderZone = (items, fallback, id) => {
                const display = items.length ? items : (fallback ? [fallback] : []);
                if (!display.length) return '';
                return `<div id="${id}-carousel" class="carousel-wrapper">${display.map((item, idx) => `
                    <div class="carousel-item ${idx === 0 ? 'active' : ''}">
                        <div class="card-container">
                            <div class="card-line card-type-${item.type}"></div>
                            <div class="event-name">${item.title}</div>
                            <div class="event-range">${item.range}</div>
                            <div class="event-msg">${item.msg}</div>
                        </div>
                    </div>`).join('')}</div>`;
            };

            widgetDiv.innerHTML = `
                <div class="garden-main-card">
                    <div class="garden-title">${isPers ? 'Kertfigyelőd' : 'Kertfigyelő'}</div>
                    <button id="locBtn" class="loc-btn">${isPers ? 'Vissza az alaphoz' : 'Saját kertfigyelőt szeretnék!'}</button>
                    <div class="section-title">Riasztások</div>
                    ${renderZone(results.filter(r => r.type === 'alert'), getSeasonalFallback('alert'), 'alert')}
                    ${results.some(r => r.type === 'window') ? '<div class="section-title">Lehetőségek</div>' : ''}
                    ${renderZone(results.filter(r => r.type === 'window'), null, 'window')}
                    <div class="section-title">Teendők</div>
                    ${renderZone(results.filter(r => r.type !== 'alert' && r.type !== 'window'), getSeasonalFallback('info'), 'info')}
                    <div class="garden-footer">Last updated: ${lastUpdate.toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'})}<br>v3.6.8 - UX Edition</div>
                </div>`;

            document.getElementById('locBtn').onclick = () => {
                if (isPers) { localStorage.removeItem('garden-lat'); localStorage.removeItem('garden-lon'); localStorage.removeItem('garden-weather-cache'); location.reload(); }
                else {
                    navigator.geolocation.getCurrentPosition(p => {
                        const {latitude: la, longitude: lo} = p.coords;
                        if (la > 45.7 && la < 48.6 && lo > 16.1 && lo < 22.9) {
                            localStorage.setItem('garden-lat', la); localStorage.setItem('garden-lon', lo);
                            localStorage.removeItem('garden-weather-cache'); location.reload();
                        } else alert("Csak Magyarországon.");
                    }, () => alert("Helyadat szükséges."));
                }
            };

            const setupCarousel = (id, count) => {
                if (count <= 1) return;
                const items = document.querySelectorAll(`#${id}-carousel .carousel-item`);
                let idx = 0;
                setInterval(() => {
                    items[idx].classList.remove('active');
                    idx = (idx + 1) % items.length;
                    items[idx].classList.add('active');
                }, 6000);
            };
            setupCarousel('alert', Math.max(1, results.filter(r => r.type === 'alert').length));
            setupCarousel('window', results.filter(r => r.type === 'window').length);
            setupCarousel('info', Math.max(1, results.filter(r => r.type !== 'alert' && r.type !== 'window').length));

        } catch(e) { console.error("Garden Widget Error:", e); }
    }
    init();
})();








