(async function() {
    const version = "v3.8.1 - Stable + badge";
    
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Plus+Jakarta+Sans:wght@400;700;800&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        @keyframes pulse-inv { 0% { box-shadow: 0 0 0 0 rgba(185,28,28,0.4); } 70% { box-shadow: 0 0 0 10px rgba(185,28,28,0); } 100% { box-shadow: 0 0 0 0 rgba(185,28,28,0); } }
        #smart-garden-widget { width: 300px; margin: 0 auto; font-family: 'Plus Jakarta Sans', sans-serif; }
        .garden-main-card { background: #fff!important; padding: 18px; box-shadow: 0 0 0 8px rgba(255,255,255,0.5)!important; height: 500px; display: flex; flex-direction: column; border: 1px solid #eee; }
        .garden-title { font-family: 'Dancing Script', cursive!important; font-size: 3.6em!important; text-align: center; margin: 5px 0 12px; color: #1a1a1a; line-height: 1.1; }
        .section-title { font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 1.2px; margin: 12px 0 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(0,0,0,0.06); color: #64748b; }
        .carousel-wrapper { position: relative; height: 125px; overflow: hidden; margin-bottom: 5px; }
        .carousel-item { position: absolute; width: 100%; opacity: 0; visibility: hidden; transition: opacity 1s; }
        .carousel-item.active { opacity: 1; visibility: visible; }
        .card-container { position: relative; padding-left: 14px; }
        .card-line { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
        .card-type-alert { background: #b91c1c; } .card-type-window { background: #2d6a4f; } .card-type-info { background: #6691b3; } .card-type-none { background: #94a3b8; }
        .time-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; margin-right: 5px; color: #fff; }
        .time-urgent { background: #b91c1c; animation: pulse-inv 2s infinite; }
        .time-warning { background: #ea580c; } .time-soon { background: #64748b; }
        .event-name { font-weight: 800; font-size: 16px; color: #1e293b; margin-bottom: 2px; }
        .event-range { font-size: 11px; font-weight: 700; color: #64748b; margin: 4px 0; }
        .event-msg { font-size: 13px; line-height: 1.4; color: #334155; }
        .loc-btn { width: 100%; cursor: pointer; padding: 8px; font-size: 10px; font-weight: 800; border: none; background: #475569; color: #fff; text-transform: uppercase; margin-bottom: 5px; }
        .footer { text-align: center; font-size: 9px; margin-top: auto; opacity: 0.6; padding-top: 8px; border-top: 1px solid #eee; }
    `;
    document.head.appendChild(styleSheet);

    // JAVÍTOTT checkSustained - TELJES logika
    function checkSustained(weather, dayIdx, cond, ruleType) {
        const days = cond.days_min || 1;
        if (dayIdx < days - 1) return false;

        const checkSingle = (key, idx) => {
            const d = weather.daily;
            // Hőmérséklet - JAVÍTVA
            if (key === 'temp_min_below' || key === 'temp_below') return d.temperature_2m_min[idx] <= cond[key];
            if (key === 'temp_max_below') return d.temperature_2m_max[idx] <= cond[key];
            if (key === 'temp_above') return d.temperature_2m_max[idx] >= cond[key];  // ← MAX, nem MIN!
            
            // Eső
            if (key === 'rain_min') return d.precipitation_sum[idx] >= cond[key];
            if (key === 'rain_max') return d.precipitation_sum[idx] <= cond[key];
            
            // Szél - JAVÍTVA: type alapú
            const windKey = ruleType === 'alert' ? 'wind_gusts_10m_max' : 'wind_speed_10m_max';
            if (key === 'wind_min') return d[windKey][idx] >= cond[key];
            if (key === 'wind_max') return d[windKey][idx] <= cond[key];
            
            return true;
        };

        for (const key in cond) {
            if (key === 'days_min') continue;
            const isAny = key.endsWith('_any');
            const baseKey = isAny ? key.replace('_any', '') : key;
            const results = [];
            for (let j = 0; j < days; j++) results.push(checkSingle(baseKey, dayIdx - j));
            const ok = isAny ? results.some(r => r) : results.every(r => r);
            if (!ok) return false;
        }
        return true;
    }

    async function init() {
        const container = document.getElementById('smart-garden-widget');
        if (!container) return;

        let lat = 47.5136, lon = 19.3735, isPers = false, city = "Gödöllő";
        const sLat = localStorage.getItem('garden-lat'), sLon = localStorage.getItem('garden-lon');
        if (sLat && sLon) { lat = Number(sLat); lon = Number(sLon); isPers = true; }

        // JAVÍTVA: City lekérés
        try {
            const geo = await fetch('https://ipapi.co/json/');
            const gData = await geo.json();
            city = gData.city || "Gödöllő";
        } catch(e) {}

        // CACHE JAVÍTVA - egyetlen kulcs
        const cacheKey = 'garden-weather-cache';
        const cached = localStorage.getItem(cacheKey);
        let weather, lastUpdate;
        
        if (cached) {
            try {
                const p = JSON.parse(cached);
                if (Date.now() - p.ts < 1800000 && 
                    Math.abs(p.lat - lat) < 0.01 && 
                    Math.abs(p.lon - lon) < 0.01) {
                    weather = p.data;
                    lastUpdate = new Date(p.ts);
                }
            } catch(e) {}
        }

        try {
            // JAVÍTVA: HungaroMet hibakezelés + wind_gusts hozzáadva
            const [rules, hData] = await Promise.all([
                fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/smart-events/main/blog-scripts.json').then(r => r.json()),
                fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/workflows/main/riasztasok.json').then(r => r.json()).catch(() => ({ alerts: null }))
            ]);

            if (!weather) {
                const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max&past_days=7&timezone=auto`);
                weather = await wRes.json();
                lastUpdate = new Date();
                localStorage.setItem(cacheKey, JSON.stringify({ts: lastUpdate.getTime(), data: weather, lat, lon}));
            }

            const results = [];
            const todayStr = new Date().toISOString().split('T')[0];
            const noon = d => new Date(d).setHours(12,0,0,0);
            const todayNoon = noon(todayStr);

            // 1. HungaroMet - JAVÍTVA
            if (hData && hData.alerts) {
                const search = city.toLowerCase().replace('i','');
                const myAlert = hData.alerts.find(a => a.j && a.j.some(j => j.toLowerCase().includes(search)));
                if (myAlert) {
                    results.push({ 
                        range: `<span class="time-badge time-urgent">MOST</span>`, 
                        title: `MET: ${myAlert.v}`, 
                        msg: `Hivatalos figyelmeztetés: ${myAlert.v} (${myAlert.sz}. fokozat).`, 
                        type: 'alert' 
                    });
                }
            }

            // 2. Multi-range szabályok - JAVÍTVA: Csak mától
            rules.forEach(rule => {
                let current = null;
                const todayIdx = weather.daily.time.findIndex(t => t === todayStr);
                const startIdx = todayIdx > 0 ? todayIdx : 0;
                
                for (let i = startIdx; i < weather.daily.time.length; i++) {
                    if (checkSustained(weather, i, rule.conditions || {}, rule.type)) {
                        const d = weather.daily.time[i];
                        if (!current) current = { start: d, end: d }; 
                        else current.end = d;
                    } else if (current) {
                        addResult(current, rule);
                        current = null;
                    }
                }
                if (current) addResult(current, rule);
            });

            function addResult(range, rule) {
                // JAVÍTVA: Ne mutassa a múltat
                if (noon(range.end) < todayNoon) return;
                
                const startNoon = noon(range.start);
                const endNoon = noon(range.end);
                
                // JAVÍTVA: Ha a range a múltban kezdődött, de mára átnyúlik
                const displayStart = startNoon < todayNoon ? todayStr : range.start;
                
                const diff = Math.round((noon(displayStart) - todayNoon) / 86400000);
                let badgeClass = diff <= 0 ? "time-urgent" : (diff === 1 ? "time-warning" : "time-soon");
                let badgeText = diff <= 0 ? "MA" : (diff === 1 ? "HOLNAP" : diff + " NAP MÚLVA");
                
                const fmt = d => new Date(d).toLocaleDateString('hu-HU', {month:'short', day:'numeric'}).toUpperCase().replace('.','');
                const rangeStr = `<span class="time-badge ${badgeClass}">${badgeText}</span>` + 
                                (noon(displayStart) !== endNoon ? ` — ${fmt(range.end)}` : '');
                
                results.push({ range: rangeStr, title: rule.name, msg: rule.message, type: rule.type });
            }

            // JAVÍTVA: Render fallback-kel
            const render = (items, type, fallback) => {
                const filtered = results.filter(r => 
                    type === 'alert' ? r.type === 'alert' : 
                    (type === 'window' ? r.type === 'window' : 
                     r.type !== 'alert' && r.type !== 'window'));
                
                const display = filtered.length ? filtered : (fallback ? [fallback] : []);
                if (!display.length) return '';
                
                return `<div id="${type}-carousel" class="carousel-wrapper">${display.map((it, idx) => `
                    <div class="carousel-item ${idx === 0 ? 'active' : ''}"><div class="card-container">
                        <div class="card-line card-type-${it.type}"></div>
                        <div class="event-name">${it.title}</div>
                        <div class="event-range">${it.range}</div>
                        <div class="event-msg">${it.msg}</div>
                    </div></div>`).join('')}</div>`;
            };

            const alertFallback = { range: 'Jelenleg', title: '☕ Minden nyugi', msg: 'Nincs veszély.', type: 'none' };
            const infoFallback = { range: 'MA', title: '🌿 Pihenj!', msg: 'Élvezd a kertet.', type: 'none' };

            container.innerHTML = `
                <div class="garden-main-card">
                    <div class="garden-title">${isPers ? 'Kertfigyelőd' : 'Kertfigyelő'}</div>
                    <button id="locBtn" class="loc-btn">${isPers ? 'Vissza az alaphoz' : 'Saját kertfigyelőt!'}</button>
                    <div class="section-title">Riasztások</div>
                    ${render(results, 'alert', alertFallback)}
                    ${results.some(r => r.type === 'window') ? '<div class="section-title">Lehetőségek</div>' : ''}
                    ${render(results, 'window')}
                    <div class="section-title">Teendők</div>
                    ${render(results, 'info', infoFallback)}
                    <div class="footer">Last updated: ${lastUpdate.toLocaleTimeString('hu-HU', {hour:'2-digit', minute:'2-digit'})}<br>${version}</div>
                </div>`;

            // JAVÍTVA: Geofencing + Carousel
            document.getElementById('locBtn').onclick = () => {
                if (isPers) { 
                    ['garden-lat', 'garden-lon', 'garden-weather-cache'].forEach(k => localStorage.removeItem(k)); 
                    location.reload(); 
                } else {
                    navigator.geolocation.getCurrentPosition(p => {
                        const {latitude: la, longitude: lo} = p.coords;
                        if (la > 45.7 && la < 48.6 && lo > 16.1 && lo < 22.9) {
                            localStorage.setItem('garden-lat', la); 
                            localStorage.setItem('garden-lon', lo);
                            localStorage.removeItem('garden-weather-cache');
                            location.reload();
                        } else alert("Sajnálom, ez a szolgáltatás csak Magyarország területén érhető el.");
                    }, () => alert("Helyadat szükséges."));
                }
            };

            ['alert', 'window', 'info'].forEach(id => {
                const items = container.querySelectorAll(`#${id}-carousel .carousel-item`);
                if (items.length > 1) { 
                    let idx = 0; 
                    setInterval(() => { 
                        items[idx].classList.remove('active'); 
                        idx = (idx+1)%items.length; 
                        items[idx].classList.add('active'); 
                    }, 5000); 
                }
            });

        } catch(e) { 
            console.error(version, e);
            container.innerHTML = `<div class="garden-main-card"><div class="garden-title">Kertfigyelő</div><div class="event-msg" style="text-align:center;padding:40px;">⚠️ Időjárás adatok betöltése sikertelen. Próbáld újra!</div></div>`;
        }
    }
    init();
})();
