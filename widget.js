(async function() {
    const esc = str => String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
    
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    function safeLocalStorage() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return {
                getItem: (k) => localStorage.getItem(k),
                setItem: (k, v) => localStorage.setItem(k, v),
                removeItem: (k) => localStorage.removeItem(k)
            };
        } catch(e) {
            const store = {};
            return {
                getItem: (k) => store[k] || null,
                setItem: (k, v) => { store[k] = v; },
                removeItem: (k) => { delete store[k]; }
            };
        }
    }
    const storage = safeLocalStorage();

    function isInSeason(date, startStr, endStr) {
        const [sM, sD] = startStr.split('-').map(Number);
        const [eM, eD] = endStr.split('-').map(Number);
        const year = date.getFullYear();
        let start = new Date(year, sM - 1, sD);
        let end = new Date(year, eM - 1, eD);
        if (end < start) { 
            if (date >= start) return true;
            let prevYearStart = new Date(year - 1, sM - 1, sD);
            let prevYearEnd = new Date(year, eM - 1, eD);
            return date >= prevYearStart && date <= prevYearEnd;
        }
        return date >= start && date <= end;
    }

    function checkDay(rule, weather, date, i, FORECAST_DAYS) {
        if (!weather.daily || weather.daily.temperature_2m_min[i] === undefined) return false;
        const dayMin = weather.daily.temperature_2m_min[i];
        const dayWind = weather.daily.wind_speed_10m_max[i] || 0;
        const dayRain = weather.daily.precipitation_sum[i] || 0;
        const seasons = rule.seasons || (rule.season ? [rule.season] : null);
        if (seasons && !seasons.some(s => isInSeason(date, s.start, s.end))) return false;
        const cond = rule.conditions || rule.trigger || {};
        if (cond.temp_below !== undefined && dayMin > cond.temp_below) return false;
        if (cond.temp_above !== undefined && dayMin < cond.temp_above) return false;
        if (cond.temp_above_sustained !== undefined) {
            if (i > FORECAST_DAYS - 3) return false; 
            const futureTemps = weather.daily.temperature_2m_min.slice(i, i + 3);
            if (futureTemps.length < 3 || !futureTemps.every(t => t >= cond.temp_above_sustained)) return false;
        }
        if (cond.soil_temp_stable !== undefined) {
            if (i > FORECAST_DAYS - 2) return false;
            const nextDayMin = weather.daily.temperature_2m_min[i + 1];
            if (dayMin < cond.soil_temp_stable || nextDayMin < cond.soil_temp_stable) return false;
        }
        if (cond.rain_max !== undefined && dayRain > cond.rain_max) return false;
        if (cond.rain_min !== undefined && dayRain < cond.rain_min) return false;
        if (cond.wind_max !== undefined && dayWind > cond.wind_max) return false;
        return true;
    }

    window.activateLocalWeather = () => navigator.geolocation.getCurrentPosition(p => {
        storage.setItem('garden-lat', p.coords.latitude);
        storage.setItem('garden-lon', p.coords.longitude);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('lat', p.coords.latitude);
        newUrl.searchParams.set('lon', p.coords.longitude);
        window.location.href = newUrl.href;
    });

    window.resetLocation = () => { 
        storage.removeItem('garden-lat');
        storage.removeItem('garden-lon');
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('lat');
        newUrl.searchParams.delete('lon');
        window.location.href = newUrl.origin + newUrl.pathname;
    };

    try {
        let lat = 47.5136;
        let lon = 19.3735;
        let isPersonalized = false;

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('lat') && urlParams.has('lon')) {
            lat = urlParams.get('lat');
            lon = urlParams.get('lon');
            isPersonalized = true;
        } else {
            const sLat = storage.getItem('garden-lat');
            const sLon = storage.getItem('garden-lon');
            if (sLat && sLon) { lat = sLat; lon = sLon; isPersonalized = true; }
        }

        const [rulesRes, weatherRes] = await Promise.all([
            fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/smart-events/main/blog-scripts.json'),
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${Number(lat).toFixed(4)}&longitude=${Number(lon).toFixed(4)}&daily=temperature_2m_min,wind_speed_10m_max,precipitation_sum&timezone=auto`)
        ]);

        const rules = await rulesRes.json();
        const weather = await weatherRes.json();
        const widgetDiv = document.getElementById('smart-garden-widget');
        const FORECAST_DAYS = weather.daily.temperature_2m_min.length;

        let htmlBase = `
            <div style="position: fixed; left: 40px; top: 180px; width: 310px; z-index: 9999; font-family: 'Plus Jakarta Sans', sans-serif; display: none;" id="garden-floating-sidebar">
                <div style="background: white; padding: 25px; border-radius: 28px; box-shadow: 0 15px 50px rgba(0,0,0,0.15); border: 1px solid #f1f5f9;">
                    <div style="margin-bottom: 20px; border-bottom: 2px solid #f8fafc; padding-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: #64748b; letter-spacing: 1.2px; text-transform: uppercase;">
                                ${isPersonalized ? 'KERTED' : 'KÖRZET'}
                            </span>
                            <span style="font-size: 0.55rem; color: #cbd5e1; font-weight: 600;">v2.3.4</span>
                        </div>
                        <button onclick="${isPersonalized ? 'resetLocation()' : 'activateLocalWeather()'}" style="background: #f1f5f9; border: none; padding: 6px 14px; border-radius: 10px; font-size: 0.7rem; font-weight: 800; cursor: pointer; color: #1e293b; transition: 0.2s;">
                            ${isPersonalized ? 'VISSZA' : 'BEÁLLÍTÁS'}
                        </button>
                    </div>
                    <div style="max-height: 500px; overflow-y: auto; padding-right: 8px;">`;

        let htmlCards = '';
        let hasActiveCards = false;
        const today = new Date();
        today.setHours(12, 0, 0, 0); 

        rules.forEach(rule => {
            const typeClass = rule.type || 'info';
            let windows = [];
            // Alert/Window logika fut itt...
            if (typeClass === 'alert') {
                let first = null, last = null;
                for (let i = 0; i < FORECAST_DAYS; i++) {
                    const d = new Date(today); d.setDate(today.getDate() + i);
                    if (checkDay(rule, weather, d, i, FORECAST_DAYS)) {
                        if (!first) first = new Date(d);
                        last = new Date(d);
                    }
                }
                if (first) windows.push({ s: first, e: last });
            } else {
                let current = null;
                for (let i = 0; i < FORECAST_DAYS; i++) {
                    const d = new Date(today); d.setDate(today.getDate() + i);
                    if (checkDay(rule, weather, d, i, FORECAST_DAYS)) {
                        if (!current) current = { s: new Date(d), e: new Date(d) };
                        else current.e = new Date(d);
                    } else if (current) { windows.push(current); current = null; }
                }
                if (current) windows.push(current);
            }

            windows.forEach(w => {
                hasActiveCards = true;
                const dStr = w.s.toLocaleDateString('hu-HU', {month:'long', day:'numeric'});
                const accentColor = typeClass === 'alert' ? '#3b82f6' : '#22c55e';
                
                htmlCards += `
                    <div style="margin-bottom: 25px;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: ${accentColor}; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">${dStr}</div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: #1e293b; line-height: 1.3; margin-bottom: 8px;">${esc(rule.name)}</div>
                        <p style="margin:0; font-size: 0.95rem; color: #475569; line-height: 1.6;">${esc(rule.message)}</p>
                    </div>`;
            });
        });

        widgetDiv.innerHTML = htmlBase + (hasActiveCards ? htmlCards : '<p style="font-size:0.9rem; color:#94a3b8;">Nincs teendő.</p>') + `</div></div></div>`;

        if (window.innerWidth > 1250) {
            document.getElementById('garden-floating-sidebar').style.display = 'block';
        }

    } catch (e) { console.error("Widget hiba:", e); }
})();
