(async function() {
    // Segédfunkció a szövegek biztonságos megjelenítéséhez
    const esc = str => String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
    
    // Betűtípusok betöltése: Dancing Script a címhez, Plus Jakarta Sans a tartalomhoz
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&family=Plus+Jakarta+Sans:wght@400;600;800&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    // Biztonságos localStorage kezelő
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

    // Szezon ellenőrző logika
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

    // Szabály ellenőrző logika (hőmérséklet, szél, eső)
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
        location.reload();
    });

    window.resetLocation = () => { 
        storage.removeItem('garden-lat');
        storage.removeItem('garden-lon');
        const url = new URL(window.location.href);
        url.searchParams.delete('lat');
        url.searchParams.delete('lon');
        window.location.href = url.origin + url.pathname;
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

        // Adatok lekérése (JSON szabályok + Weather API)
        const [rulesRes, weatherRes] = await Promise.all([
            fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/smart-events/main/blog-scripts.json'),
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${Number(lat).toFixed(4)}&longitude=${Number(lon).toFixed(4)}&daily=temperature_2m_min,wind_speed_10m_max,precipitation_sum&timezone=auto`)
        ]);

        const rules = await rulesRes.json();
        const weather = await weatherRes.json();
        const widgetDiv = document.getElementById('smart-garden-widget');
        if (!widgetDiv) return;
        const FORECAST_DAYS = weather.daily.temperature_2m_min.length;

        // HTML ALAPSZERKEZET: Éles sarkok, 8px fehér glória keret, Dancing Script cím
        let htmlBase = `
            <div style="position: fixed; left: 45px; top: 180px; width: 340px; z-index: 9999; font-family: 'Plus Jakarta Sans', sans-serif; display: none;" id="garden-floating-sidebar">
                <div style="background: #ffffff; padding: 25px; border-radius: 0px; box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.5); border: none;">
                    
                    <div style="text-align: center; border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 20px; margin-bottom: 20px;">
                        <div style="font-family: 'Dancing Script', cursive; font-size: 3.6em; color: #1e293b; margin: 15px 0; line-height: 1; border: none;">
                            ${isPersonalized ? 'Kerted' : 'Körzet'}
                        </div>
                        
                        <button onclick="${isPersonalized ? 'resetLocation()' : 'activateLocalWeather()'}" style="background: transparent; border: 1px solid #e2e8f0; padding: 6px 18px; border-radius: 0px; font-size: 11px; font-weight: bold; cursor: pointer; color: #64748b; text-transform: uppercase; transition: 0.2s; letter-spacing: 1px;">
                            ${isPersonalized ? 'ALAPHELYZET' : 'SAJÁT KERTRE SZABOM'}
                        </button>
                        
                        <div style="font-size: 9px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 2px; margin-top: 15px;">
                            v2.4.1 • Area 52
                        </div>
                    </div>
                    
                    <div style="max-height: 500px; overflow-y: auto; padding-right: 5px;">`;

        let htmlCards = '';
        let hasActiveCards = false;
        const today = new Date();
        today.setHours(12, 0, 0, 0); 

        // Szabályok feldolgozása és csoportosítása (v2.4.1 logika)
        rules.forEach(rule => {
            const typeClass = rule.type || 'info';
            let windows = [];
            let current = null;

            for (let i = 0; i < FORECAST_DAYS; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() + i);
                if (checkDay(rule, weather, d, i, FORECAST_DAYS)) {
                    if (!current) current = { s: new Date(d), e: new Date(d), count: 1 };
                    else { current.e = new Date(d); current.count++; }
                } else if (current) {
                    windows.push(current);
                    current = null;
                }
            }
            if (current) windows.push(current);

            windows.forEach(w => {
                hasActiveCards = true;
                const dStr = w.s.toLocaleDateString('hu-HU', {month:'long', day:'numeric'});
                
                let baseName = esc(rule.name).replace(/\s+várható$/i, "");
                let displayTitle = baseName + (w.count > 1 ? ` várható a következő ${w.count} napban` : "");

                const accentColor = typeClass === 'alert' ? '#2563eb' : '#16a34a';
                
                htmlCards += `
                    <div style="margin-bottom: 30px;">
                        <div style="font-size: 11px; font-weight: bold; color: ${accentColor}; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">${dStr}</div>
                        <div style="font-size: 18px; font-weight: 800; color: #1e293b; line-height: 1.25; margin-bottom: 10px;">${displayTitle}</div>
                        <p style="margin:0; font-size: 15px; color: #475569; line-height: 1.6;">${esc(rule.message)}</p>
                    </div>`;
            });
        });

        const emptyMsg = `<p style="text-align:center; padding:15px; color:#94a3b8; font-size: 14px; font-style: italic;">Nincs aktuális kerti teendő.</p>`;
        
        widgetDiv.innerHTML = htmlBase + (hasActiveCards ? htmlCards : emptyMsg) + `</div></div></div>`;

        // Csak szélesebb képernyőn jelenítjük meg
        if (window.innerWidth > 1250) {
            document.getElementById('garden-floating-sidebar').style.display = 'block';
        }

    } catch (e) {
        console.error("Smart Garden Widget hiba:", e);
    }
})();
