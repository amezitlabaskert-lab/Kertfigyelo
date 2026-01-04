(async function() {
    const esc = str => String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
    
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        #smart-garden-widget { width: 300px; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif !important; color: #000000; }
        .garden-main-card { background: #ffffff !important; padding: 25px; border: none !important; box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.5) !important; margin-bottom: 40px !important; }
        
        .garden-title { font-family: 'Dancing Script', cursive !important; font-size: 3.6em !important; text-align: center !important; color: #6691b3 !important; margin: 15px 0 !important; line-height: 1.2; }
        
        .section-title { 
            font-weight: 800 !important; 
            font-size: 16px !important; 
            text-transform: uppercase; 
            letter-spacing: 1.5px; 
            border-bottom: 1px solid #eeeeee; 
            margin-bottom: 12px; 
            padding-bottom: 5px; 
        }
        .alert-header { color: #b91c1c !important; }
        .info-header { color: #6691b3 !important; margin-top: 25px !important; }
        .window-header { color: #2d6a4f !important; margin-top: 25px !important; }
        
        .event-name { font-weight: 800 !important; font-size: 16px !important; margin-bottom: 2px; color: #000000; }
        .card-container { position: relative; padding-left: 18px; margin-bottom: 15px; min-height: 85px; }
        .card-line { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
        .event-range { font-size: 9px; font-weight: 700; opacity: 0.7; margin-bottom: 6px; text-transform: uppercase; color: #000000; }
        .event-msg { font-size: 12px; line-height: 1.5; color: #000000; }
        
        .garden-footer { text-align: center; font-size: 9px; opacity: 0.5; margin-top: 20px; padding-top: 10px; border-top: 1px solid #eeeeee; line-height: 1.6; color: #000000; }
        .loc-btn { width: 100%; cursor: pointer; padding: 10px; font-size: 10px; background: none; border: 1px solid #000000; color: #000000; margin-bottom: 20px; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade { animation: fadeIn 0.5s ease-out forwards; }
    `;
    document.head.appendChild(styleSheet);

    function createSafeStorage() {
        const memoryStore = {};
        try {
            const t = 't'; localStorage.setItem(t, t); localStorage.removeItem(t);
            return { getItem: (k) => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v), removeItem: (k) => localStorage.removeItem(k) };
        } catch(e) {
            return { getItem: (k) => memoryStore[k] || null, setItem: (k, v) => { memoryStore[k] = v; }, removeItem: (k) => { delete memoryStore[k]; } };
        }
    }
    const storage = createSafeStorage();

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
        if (!weather?.daily?.[key] || index < days - 1) return false;
        let anySatisfied = false;
        const ops = operator.split('-');
        const isAny = ops.includes('any');
        const baseOp = ops[0];
        for (let i = 0; i < days; i++) {
            let val = weather.daily[key][index - i];
            if (val === undefined) return false;
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
        const c = rule.conditions || {}, days = c.days_min || 1;
        if (c.temp_below !== undefined && !checkSustained(weather, i, 'temperature_2m_min', c.temp_below, 'below', days)) return false;
        if (c.temp_above !== undefined && !checkSustained(weather, i, 'temperature_2m_max', c.temp_above, 'above', days)) return false;
        const windKey = weather.daily.wind_gusts_10m_max !== undefined ? 'wind_gusts_10m_max' : 'wind_speed_10m_max';
        if (c.wind_min_any !== undefined) { if (!checkSustained(weather, i, windKey, c.wind_min_any, 'min-any', days)) return false; }
        else if (c.wind_min !== undefined && !checkSustained(weather, i, windKey, c.wind_min, 'min', days)) return false;
        if (c.wind_max !== undefined && !checkSustained(weather, i, windKey, c.wind_max, 'max', days)) return false;
        if (c.rain_min_any !== undefined) { if (!checkSustained(weather, i, 'precipitation_sum', c.rain_min_any, 'min-any', days)) return false; }
        else if (c.rain_min !== undefined && (weather.daily.precipitation_sum?.[i] || 0) < c.rain_min) return false;
        if (c.rain_max !== undefined && !checkSustained(weather, i, 'precipitation_sum', c.rain_max, 'max', days)) return false;
        return true;
    }

    async function init() {
        const widgetDiv = document.getElementById('smart-garden-widget');
        if (!widgetDiv) return;

        try {
            let lat = 47.5136, lon = 19.3735, isPersonalized = false;
            const sLat = storage.getItem('garden-lat'), sLon = storage.getItem('garden-lon');
            if (sLat && sLon) { lat = Number(sLat); lon = Number(sLon); isPersonalized = true; }

            const cacheKey = 'garden-weather-cache';
            const cachedData = storage.getItem(cacheKey);
            let weather, lastUpdate;

            if (cachedData) {
                try {
                    const parsed = JSON.parse(cachedData);
                    if (new Date().getTime() - parsed.timestamp < 1800000 && Number(parsed.lat) === lat) {
                        weather = parsed.data; lastUpdate = new Date(parsed.timestamp);
                    }
                } catch(e) { storage.removeItem(cacheKey); }
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

            const results = [];
            const todayNoon = new Date().setHours(12, 0, 0, 0);

            rules.forEach(rule => {
                let activeRange = null;
                for (let i = 0; i < weather.daily.time.length; i++) {
                    const d = new Date(weather.daily.time[i]);
                    if (checkDay(rule, weather, d, i)) {
                        if (!activeRange) activeRange = { start: d, end: d };
                        else activeRange.end = d;
                    } else if (activeRange) break;
                }
                if (activeRange) {
                    const fmt = d => {
                        const diff = Math.round((new Date(d).setHours(12,0,0,0) - todayNoon) / 86400000);
                        if (diff === 0) return "MA";
                        if (diff === 1) return "HOLNAP";
                        if (diff < 0) return "ELMÚLT NAPOK";
                        return d.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}).replace('.','').toUpperCase();
                    };
                    const sStr = fmt(activeRange.start);
                    const eStr = fmt(activeRange.end);
                    const rangeStr = (sStr === eStr) ? sStr : `${sStr} — ${eStr}`;
                    
                    let itemColor = '#6691b3';
                    if (rule.type === 'alert') itemColor = '#b91c1c';
                    if (rule.type === 'window') itemColor = '#2d6a4f';

                    results.push({ range: rangeStr, title: rule.name, msg: rule.message, type: rule.type, color: itemColor });
                }
            });

            const alerts = results.filter(r => r.type === 'alert');
            const windows = results.filter(r => r.type === 'window');
            const infos = results.filter(r => r.type !== 'alert' && r.type !== 'window');

            const renderZone = (items, fallback, id) => {
                if (items.length === 0 && !fallback) return '';
                const displayItems = items.length ? items : [fallback];
                return `<div id="${id}-carousel" style="min-height: 90px;">
                    ${displayItems.map((item, idx) => `
                        <div class="card-container animate-fade" style="${idx > 0 ? 'display:none;' : ''}">
                            <div class="card-line" style="background: ${item.color}"></div>
                            <div class="event-name">${esc(item.title)}</div>
                            <div class="event-range">${item.range}</div>
                            <div class="event-msg">${esc(item.msg)}</div>
                        </div>`).join('')}
                </div>`;
            };

            widgetDiv.innerHTML = `
                <div class="garden-main-card">
                    <div class="garden-title">Kertfigyelő</div>
                    <button onclick="window.gardenAction()" class="loc-btn">
                        ${isPersonalized ? 'VISSZA AZ ALAPHOZ' : 'SAJÁT KERTFIGYELŐT SZERETNÉK!'}
                    </button>
                    
                    <div class="section-title alert-header">Riasztások</div>
                    ${renderZone(alerts, { range: 'Jelenleg', title: 'Minden nyugi', msg: 'Nincs veszély a láthatáron.', color: '#000000' }, 'alert')}
                    
                    ${windows.length ? '<div class="section-title window-header">Lehetőségek</div>' : ''}
                    ${renderZone(windows, null, 'window')}

                    <div class="section-title info-header">Teendők</div>
                    ${renderZone(infos, { range: 'MA', title: 'Pihenj!', msg: 'Élvezd a Mezítlábas Kertedet.', color: '#000000' }, 'info')}
                    
                    <div class="garden-footer">
                        Last updated: ${lastUpdate.toLocaleTimeString('hu-HU', {hour:'2-digit', minute:'2-digit'})}<br>
                        Winter Skin Edition<br>
                        v3.4.25
                    </div>
                </div>`;

            window.gardenAction = () => {
                if (isPersonalized) {
                    storage.removeItem('garden-lat'); storage.removeItem('garden-lon'); storage.removeItem('garden-weather-cache'); location.reload();
                } else {
                    navigator.geolocation.getCurrentPosition(p => {
                        storage.setItem('garden-lat', p.coords.latitude); storage.setItem('garden-lon', p.coords.longitude);
                        storage.removeItem('garden-weather-cache'); location.reload();
                    }, () => alert("Hiba a helymeghatározáskor."));
                }
            };

            const setupCarousel = (id, count) => {
                if (count <= 1) return;
                const container = document.getElementById(`${id}-carousel`);
                if (!container) return;
                let idx = 0;
                setInterval(() => {
                    const cards = container.querySelectorAll('.card-container');
                    if(cards.length > 0) {
                        cards[idx].style.display = 'none';
                        idx = (idx + 1) % count;
                        cards[idx].style.display = 'block';
                    }
                }, 6000);
            };
            setupCarousel('alert', alerts.length || 1);
            setupCarousel('window', windows.length);
            setupCarousel('info', infos.length || 1);

        } catch (e) { console.error(e); }
    }
    init();
})();
