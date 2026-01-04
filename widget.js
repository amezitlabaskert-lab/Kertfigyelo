(async function() {
    const esc = str => String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
    
    // Betűtípusok betöltése
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&family=Plus+Jakarta+Sans:wght@400;600;800&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

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

    function checkDay(rule, weather, date, i, FORECAST_DAYS) {
        if (!weather.daily || weather.daily.temperature_2m_min[i] === undefined) return false;
        const dMin = weather.daily.temperature_2m_min[i], dWind = weather.daily.wind_speed_10m_max[i] || 0, dRain = weather.daily.precipitation_sum[i] || 0;
        const seasons = rule.seasons || (rule.season ? [rule.season] : null);
        if (seasons && !seasons.some(s => isInSeason(date, s.start, s.end))) return false;
        const c = rule.conditions || rule.trigger || {};
        if (c.temp_below !== undefined && dMin > c.temp_below) return false;
        if (c.temp_above !== undefined && dMin < c.temp_above) return false;
        if (c.temp_above_sustained !== undefined) {
            if (i > FORECAST_DAYS - 3) return false;
            const fT = weather.daily.temperature_2m_min.slice(i, i + 3);
            if (fT.length < 3 || !fT.every(t => t >= c.temp_above_sustained)) return false;
        }
        if (c.soil_temp_stable !== undefined) {
            if (i > FORECAST_DAYS - 2) return false;
            if (dMin < c.soil_temp_stable || weather.daily.temperature_2m_min[i + 1] < c.soil_temp_stable) return false;
        }
        if (c.rain_max !== undefined && dRain > c.rain_max) return false;
        if (c.rain_min !== undefined && dRain < c.rain_min) return false;
        if (c.wind_max !== undefined && dWind > c.wind_max) return false;
        return true;
    }

    window.activateLocalWeather = () => navigator.geolocation.getCurrentPosition(p => {
        storage.setItem('garden-lat', p.coords.latitude);
        storage.setItem('garden-lon', p.coords.longitude);
        location.reload();
    });

    window.resetLocation = () => { 
        storage.removeItem('garden-lat'); storage.removeItem('garden-lon');
        const u = new URL(window.location.href); u.searchParams.delete('lat'); u.searchParams.delete('lon');
        window.location.href = u.origin + u.pathname;
    };

    try {
        let lat = 47.5136, lon = 19.3735, isPersonalized = false;
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('lat')) { lat = urlParams.get('lat'); lon = urlParams.get('lon'); isPersonalized = true; }
        else { const sLat = storage.getItem('garden-lat'), sLon = storage.getItem('garden-lon'); if (sLat) { lat = sLat; lon = sLon; isPersonalized = true; } }

        const [rRes, wRes] = await Promise.all([
            fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/smart-events/main/blog-scripts.json'),
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${Number(lat).toFixed(4)}&longitude=${Number(lon).toFixed(4)}&daily=temperature_2m_min,wind_speed_10m_max,precipitation_sum&timezone=auto`)
        ]);
        const rules = await rRes.json(), weather = await wRes.json();
        const widgetDiv = document.getElementById('smart-garden-widget');
        if (!widgetDiv) return;

        const alerts = [], infos = [];
        const today = new Date(); today.setHours(12, 0, 0, 0);
        const FORECAST_DAYS = weather.daily.temperature_2m_min.length;

        rules.forEach(rule => {
            let windows = [], current = null;
            for (let i = 0; i < FORECAST_DAYS; i++) {
                const d = new Date(today); d.setDate(today.getDate() + i);
                if (checkDay(rule, weather, d, i, FORECAST_DAYS)) {
                    if (!current) current = { s: new Date(d), count: 1 }; else current.count++;
                } else if (current) { windows.push(current); current = null; }
            }
            if (current) windows.push(current);
            
            windows.forEach(w => {
                const dStr = w.s.toLocaleDateString('hu-HU', {month:'long', day:'numeric'});
                const title = rule.name.replace(/\s+várható$/i, "") + (w.count > 1 ? ` várható a következő ${w.count} napban` : "");
                const card = { dStr, title, msg: rule.message, color: (rule.type === 'alert' ? '#2563eb' : '#16a34a') };
                if (rule.type === 'alert') alerts.push(card); else infos.push(card);
            });
        });

        const alertFallback = [{ dStr: "Minden rendben", title: "☕ Most minden nyugi", msg: "A Kertfigyelő nem lát veszélyt a láthatáron. Főzz egy kávét!", color: "#2563eb" }];
        const infoFallback = [{ dStr: "Teendő", title: "🌿 Pihenj!", msg: "Nincs sürgős kerti munka, élvezd a tájat és a mezítlábas kertet.", color: "#16a34a" }];

        const finalAlerts = alerts.length > 0 ? alerts : alertFallback;
        const finalInfos = infos.length > 0 ? infos : infoFallback;

        widgetDiv.innerHTML = `
            <div style="position: fixed; left: 45px; top: 220px; width: 300px; z-index: 9999; font-family: 'Plus Jakarta Sans', sans-serif; display: none;" id="garden-floating-sidebar">
                <div style="background: #ffffff; padding: 25px; box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.5); border-radius: 0px;">
                    <div style="text-align: center; border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 15px; margin-bottom: 20px;">
                        <div class="garden-widget-title" style="font-family: 'Dancing Script', cursive; font-size: 3.6em; font-weight: 700; margin: 15px 0; line-height: 1;">
                            ${isPersonalized ? 'Kertfigyelőd' : 'Kertfigyelő'}
                        </div>
                        <button onclick="${isPersonalized ? 'resetLocation()' : 'activateLocalWeather()'}" style="background: transparent; border: 1px solid #e2e8f0; padding: 5px 15px; font-size: 10px; font-weight: bold; cursor: pointer; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">
                            ${isPersonalized ? 'ALAPHELYZET' : 'SAJÁT KERT'}
                        </button>
                    </div>
                    <div id="alert-zone" style="min-height: 110px;"></div>
                    <div style="height: 20px;"></div>
                    <div id="info-zone" style="min-height: 110px;"></div>
                    <div style="font-size: 8px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 2px; margin-top: 15px; text-align: center;">
                        v2.5.2 • Area 52
                    </div>
                </div>
            </div>`;

        if (window.innerWidth > 1250) document.getElementById('garden-floating-sidebar').style.display = 'block';

        function startCarousel(containerId, items) {
            const container = document.getElementById(containerId);
            let index = 0;
            const update = () => {
                const item = items[index];
                container.style.opacity = 0;
                setTimeout(() => {
                    container.innerHTML = `
                        <div style="border-left: 4px solid ${item.color}; padding-left: 15px;">
                            <div style="font-size: 11px; font-weight: bold; color: ${item.color}; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 0.5px;">${item.dStr}</div>
                            <div style="font-size: 17px; font-weight: 800; color: #1e293b; line-height: 1.2; margin-bottom: 8px;">${esc(item.title)}</div>
                            <p style="margin:0; font-size: 14px; line-height: 1.5;">${esc(item.msg)}</p>
                        </div>`;
                    container.style.opacity = 1;
                    index = (index + 1) % items.length;
                }, 500);
            };
            container.style.transition = "opacity 0.5s";
            update();
            if (items.length > 1) setInterval(update, 5000);
        }

        startCarousel('alert-zone', finalAlerts);
        startCarousel('info-zone', finalInfos);

    } catch (e) { console.error("Kertfigyelő hiba:", e); }
})();

