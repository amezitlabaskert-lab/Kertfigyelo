(async function() {
    const esc = str => String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
    
    const HU_BOUNDS = { latMin: 45.7, latMax: 48.6, lonMin: 16.1, lonMax: 22.9 };
    const isInHungary = (lat, lon) => lat >= HU_BOUNDS.latMin && lat <= HU_BOUNDS.latMax && lon >= HU_BOUNDS.lonMin && lon <= HU_BOUNDS.lonMax;

    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&family=Plus+Jakarta+Sans:wght@400;600;800&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        #smart-garden-widget { font-family: 'Plus Jakarta Sans', sans-serif; color: #334155; max-width: 320px; }
        .garden-main-card { background: #ffffff; padding: 30px; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        .garden-title { font-family: 'Dancing Script', cursive; font-size: 45px; text-align: center; margin-bottom: 25px; color: #1e293b; }
        .section-title { font-size: 13px; font-weight: 800; letter-spacing: 1.5px; margin-bottom: 15px; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; }
        .alert-header { color: #b91c1c; margin-top: 10px; }
        .info-header { color: #6691b3; margin-top: 25px; }
        .card-container { position: relative; padding-left: 20px; margin-bottom: 20px; transition: opacity 0.5s; }
        .card-line { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; border-radius: 2px; }
        .event-name { font-size: 18px; font-weight: 800; margin-bottom: 4px; color: #1e293b; display: flex; align-items: center; }
        .event-range { font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .event-msg { font-size: 13px; line-height: 1.5; color: #475569; }
        .garden-footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 25px; line-height: 1.6; border-top: 1px solid #f1f5f9; padding-top: 15px; }
        .loc-btn { border: 1px solid #346080; background: none; padding: 10px; font-size: 9px; font-weight: 800; cursor: pointer; width: 100%; margin-bottom: 20px; letter-spacing: 1px; color: #346080; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade { animation: fadeIn 0.5s ease-out forwards; }
    `;
    document.head.appendChild(styleSheet);

    function safeLocalStorage() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return { getItem: (k) => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v), removeItem: (k) => localStorage.removeItem(k) };
        } catch(e) {
            const store = {};
            return { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
        }
    }
    const storage = safeLocalStorage();

    function isInSeason(date, startStr, endStr) {
        const [sM, sD] = startStr.split('-').map(Number);
        const [eM, eD] = endStr.split('-').map(Number);
        const year = date.getFullYear();
        let start = new Date(year, sM - 1, sD), end = new Date(year, eM - 1, eD);
        if (end < start) {
            if (date >= start) return true;
            let pStart = new Date(year - 1, sM - 1, sD), pEnd = new Date(year, eM - 1, eD);
            return date >= pStart && date <= pEnd;
        }
        return date >= start && date <= end;
    }

    function checkSustained(weather, index, key, threshold, operator, days) {
        if (index < days - 1) return false;
        let anySatisfied = false;
        const ops = operator.split('-');
        const isAny = ops.includes('any');
        const baseOp = ops[0];
        for (let i = 0; i < days; i++) {
            let val = weather.daily[key][index - i];
            let currentSatisfied = false;
            if (baseOp === 'above' && val >= threshold) currentSatisfied = true;
            if (baseOp === 'below' && val <= threshold) currentSatisfied = true;
            if (baseOp === 'max' && val <= threshold) currentSatisfied = true;
            if (baseOp === 'min' && val >= threshold) currentSatisfied = true;
            if (!currentSatisfied && !isAny) return false;
            if (currentSatisfied) anySatisfied = true;
        }
        return isAny ? anySatisfied : true;
    }

    function checkDay(rule, weather, date, i) {
        const seasons = rule.seasons || (rule.season ? [rule.season] : null);
        if (seasons && !seasons.some(s => isInSeason(date, s.start, s.end))) return false;
        const c = rule.conditions || {};
        const days = c.days_min || 1;
        if (c.temp_below !== undefined && !checkSustained(weather, i, 'temperature_2m_min', c.temp_below, 'below', days)) return false;
        if (c.temp_above !== undefined && !checkSustained(weather, i, 'temperature_2m_max', c.temp_above, 'above', days)) return false;
        const windKey = rule.type === 'window' ? 'wind_speed_10m_max' : 'wind_gusts_10m_max';
        if (c.wind_min_any !== undefined) { if (!checkSustained(weather, i, windKey, c.wind_min_any, 'min-any', days)) return false; }
        else if (c.wind_min !== undefined && !checkSustained(weather, i, windKey, c.wind_min, 'min', days)) return false;
        if (c.wind_max !== undefined && !checkSustained(weather, i, windKey, c.wind_max, 'max', days)) return false;
        if (c.rain_min_any !== undefined) { if (!checkSustained(weather, i, 'precipitation_sum', c.rain_min_any, 'min-any', days)) return false; }
        else if (c.rain_min !== undefined && weather.daily.precipitation_sum[i] < c.rain_min) return false;
        if (c.rain_max !== undefined && !checkSustained(weather, i, 'precipitation_sum', c.rain_max, 'max', days)) return false;
        return true;
    }

    window.activateLocalWeather = () => navigator.geolocation.getCurrentPosition(p => {
        const uLat = p.coords.latitude, uLon = p.coords.longitude;
        if (isInHungary(uLat, uLon)) {
            storage.setItem('garden-lat', uLat); storage.setItem('garden-lon', uLon);
            storage.removeItem('garden-weather-cache'); location.reload();
        } else alert("Csak Magyarországon érhető el.");
    });

    window.resetLocation = () => { storage.removeItem('garden-lat'); storage.removeItem('garden-lon'); storage.removeItem('garden-weather-cache'); location.reload(); };

    try {
        let lat = 47.5136, lon = 19.3735, isPersonalized = false;
        const sLat = storage.getItem('garden-lat'), sLon = storage.getItem('garden-lon');
        if (sLat && sLon) { lat = Number(sLat); lon = Number(sLon); isPersonalized = true; }

        const cacheKey = 'garden-weather-cache';
        const cachedData = storage.getItem(cacheKey);
        let weather, lastUpdate;

        if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (new Date().getTime() - parsed.timestamp < 1800000 && Number(parsed.lat) === lat) {
                weather = parsed.data; lastUpdate = new Date(parsed.timestamp);
            }
        }

        const rRes = await fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/smart-events/main/blog-scripts.json');
        const rules = await rRes.json();

        if (!weather) {
            const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum&past_days=7&timezone=auto`);
            weather = await wRes.json();
            const timestamp = new Date().getTime();
            storage.setItem(cacheKey, JSON.stringify({ timestamp, data: weather, lat, lon }));
            lastUpdate = new Date(timestamp);
        }

        const widgetDiv = document.getElementById('smart-garden-widget');
        if (!widgetDiv) return;

        const results = [];
        const todayNoon = new Date().setHours(12, 0, 0, 0);

        rules.forEach(rule => {
            let activeRange = null;
            for (let i = 0; i < weather.daily.time.length; i++) {
                if (checkDay(rule, weather, new Date(weather.daily.time[i]), i)) {
                    const d = new Date(weather.daily.time[i]);
                    if (!activeRange) { activeRange = { start: d, end: d }; } 
                    else { activeRange.end = d; }
                } else if (activeRange) break;
            }

            if (activeRange) {
                const fmt = d => {
                    const diff = Math.floor((d.setHours(12,0,0,0) - todayNoon) / 86400000);
                    if (diff === 0) return "MA";
                    if (diff === 1) return "HOLNAP";
                    if (diff < 0) return "ELMÚLT NAPOK";
                    return d.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}).replace('.','').toUpperCase();
                };
                
                const rangeStr = activeRange.start.getTime() === activeRange.end.getTime() 
                    ? fmt(activeRange.start) 
                    : `${fmt(activeRange.start)} — ${fmt(activeRange.end)}`;
                
                results.push({ range: rangeStr, title: rule.name, msg: rule.message, type: rule.type, color: rule.type === 'alert' ? '#b91c1c' : '#6691b3' });
            }
        });

        const alerts = results.filter(r => r.type === 'alert');
        const infos = results.filter(r => r.type !== 'alert');

        const renderZone = (items, fallback, id) => {
            const displayItems = items.length ? items : [fallback];
            return `
                <div id="${id}-carousel" style="height: 130px; overflow: hidden;">
                    <div class="carousel-track">
                        ${displayItems.map(item => `
                            <div class="card-container animate-fade">
                                <div class="card-line" style="background: ${item.color}"></div>
                                <div class="event-name">${esc(item.title)}</div>
                                <div class="event-range">${item.range}</div>
                                <div class="event-msg">${esc(item.msg)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        };

        widgetDiv.innerHTML = `
            <div class="garden-main-card">
                <div class="garden-title">Kertfigyelő</div>
                <button onclick="${isPersonalized ? 'resetLocation()' : 'activateLocalWeather()'}" class="loc-btn">
                    ${isPersonalized ? 'VISSZA AZ ALAPHOZ' : 'A SAJÁT KERTEM KERTFIGYELŐJÉT SZERETNÉK'}
                </button>
                
                <div class="section-title alert-header">Riasztások</div>
                ${renderZone(alerts, { range: 'Jelenleg', title: 'Minden nyugi', msg: 'Nagy szerencse: a Kertfigyelő nem lát veszélyt a láthatáron.', color: '#346080' }, 'alert')}
                
                <div class="section-title info-header">Teendők</div>
                ${renderZone(infos, { range: 'MA', title: 'Pihenj!', msg: 'Élvezd a Mezítlábas Kertedet.', color: '#6691b3' }, 'info')}
                
                <div class="garden-footer">
                    v3.4.0 • Frissítve: ${lastUpdate.toLocaleTimeString('hu-HU', {hour:'2-digit', minute:'2-digit'})}<br>
                    Winter Skin Edition
                </div>
            </div>`;

        // Egyszerű carousel logika
        const setupCarousel = (id, count) => {
            if (count <= 1) return;
            const container = document.getElementById(`${id}-carousel`);
            let idx = 0;
            setInterval(() => {
                idx = (idx + 1) % count;
                const cards = container.querySelectorAll('.card-container');
                cards.forEach((c, i) => c.style.display = i === idx ? 'block' : 'none');
            }, 6000);
            container.querySelectorAll('.card-container').forEach((c, i) => i > 0 && (c.style.display = 'none'));
        };
        setupCarousel('alert', alerts.length || 1);
        setupCarousel('info', infos.length || 1);

    } catch (e) { console.error(e); }
})();
