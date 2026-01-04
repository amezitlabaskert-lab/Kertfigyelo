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

    function checkSustained(weather, index, key, threshold, operator, days) {
        if (index < days - 1) return false;
        let anySatisfied = false;
        for (let i = 0; i < days; i++) {
            let val = weather.daily[key][index - i];
            let currentSatisfied = false;
            
            if (operator.includes('above') && val >= threshold) currentSatisfied = true;
            if (operator.includes('below') && val <= threshold) currentSatisfied = true;
            if (operator.includes('max') && val <= threshold) currentSatisfied = true;
            if (operator.includes('min') && val >= threshold) currentSatisfied = true;

            if (!currentSatisfied && !operator.includes('-any')) return false;
            if (currentSatisfied) anySatisfied = true;
        }
        return operator.includes('-any') ? anySatisfied : true;
    }

    function checkDay(rule, weather, date, i) {
        const seasons = rule.seasons || (rule.season ? [rule.season] : null);
        if (seasons && !seasons.some(s => isInSeason(date, s.start, s.end))) return false;

        const c = rule.conditions || {};
        const days = c.days_min || 1;

        if (c.temp_above !== undefined && !checkSustained(weather, i, 'temperature_2m_max', c.temp_above, 'above', days)) return false;
        if (c.temp_below !== undefined && !checkSustained(weather, i, 'temperature_2m_max', c.temp_below, 'below', days)) return false;
        
        if (c.wind_min_any !== undefined) {
            if (!checkSustained(weather, i, 'wind_gusts_10m_max', c.wind_min_any, 'min-any', days)) return false;
        } else if (c.wind_min !== undefined) {
            if (!checkSustained(weather, i, 'wind_gusts_10m_max', c.wind_min, 'min', days)) return false;
        }
        
        if (c.wind_max !== undefined && !checkSustained(weather, i, 'wind_gusts_10m_max', c.wind_max, 'max', days)) return false;
        if (c.rain_min !== undefined && weather.daily.precipitation_sum[i] < c.rain_min) return false;
        if (c.rain_max !== undefined && !checkSustained(weather, i, 'precipitation_sum', c.rain_max, 'max', days)) return false;

        return true;
    }

    window.activateLocalWeather = () => navigator.geolocation.getCurrentPosition(p => {
        storage.setItem('garden-lat', p.coords.latitude);
        storage.setItem('garden-lon', p.coords.longitude);
        location.reload();
    });

    window.resetLocation = () => { 
        storage.removeItem('garden-lat'); storage.removeItem('garden-lon');
        window.location.href = window.location.origin + window.location.pathname;
    };

    try {
        let lat = 47.5136, lon = 19.3735, isPersonalized = false;
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('lat')) { lat = urlParams.get('lat'); lon = urlParams.get('lon'); isPersonalized = true; }
        else { const sLat = storage.getItem('garden-lat'), sLon = storage.getItem('garden-lon'); if (sLat) { lat = sLat; lon = sLon; isPersonalized = true; } }

        const [rRes, wRes] = await Promise.all([
            fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/smart-events/main/blog-scripts.json'),
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${Number(lat).toFixed(4)}&longitude=${Number(lon).toFixed(4)}&daily=temperature_2m_max,wind_gusts_10m_max,precipitation_sum&past_days=7&timezone=auto`)
        ]);
        const rules = await rRes.json(), weather = await wRes.json();
        const widgetDiv = document.getElementById('smart-garden-widget');
        if (!widgetDiv) return;

        const alerts = [];
        const pastOffset = 7; 

        rules.forEach(rule => {
            for (let i = pastOffset; i < weather.daily.time.length; i++) {
                const d = new Date(weather.daily.time[i]);
                if (checkDay(rule, weather, d, i)) {
                    const label = rule.type === 'alert' ? 'RIASZTÁSOK' : 'TEENDŐK';
                    const color = rule.type === 'alert' ? '#2563eb' : (rule.type === 'window' ? '#16a34a' : '#64748b');
                    alerts.push({ dStr: label, title: rule.name, msg: rule.message, color, type: rule.type });
                    break;
                }
            }
        });

        const finalAlerts = alerts.filter(a => a.type === 'alert');
        const finalInfos = alerts.filter(a => a.type !== 'alert');

        const alertFallback = [{ dStr: "RIASZTÁSOK", title: "☕ Most minden nyugi", msg: "A Kertfigyelő nem lát veszélyt a láthatáron. Főzz egy kávét!", color: "#2563eb" }];
        const infoFallback = [{ dStr: "TEENDŐK", title: "🌿 Pihenj!", msg: "Nincs sürgős kerti munka, élvezd a Mezítlábas Kertedet.", color: "#16a34a" }];

        widgetDiv.innerHTML = `
            <div style="position: fixed; left: 0px; top: 220px; width: 300px; z-index: 9999; font-family: 'Plus Jakarta Sans', sans-serif; display: none;" id="garden-floating-sidebar">
                <div style="background: #ffffff; padding: 25px; box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.5); border-radius: 0px;">
                    <div style="text-align: center; border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 15px; margin-bottom: 20px;">
                        <div class="garden-widget-title" style="font-family: 'Dancing Script', cursive; font-size: 3.6em; font-weight: 700; margin: 15px 0; line-height: 1;">
                            ${isPersonalized ? 'Kertfigyelőd' : 'Kertfigyelő'}
                        </div>
                        <button onclick="${isPersonalized ? 'resetLocation()' : 'activateLocalWeather()'}" style="background: transparent; border: 1px solid #e2e8f0; padding: 5px 15px; font-size: 10px; font-weight: bold; cursor: pointer; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">
                            ${isPersonalized ? 'ALAPHELYZET' : 'SAJÁT KERT'}
                        </button>
                    </div>
                    <div id="alert-zone" style="height: 135px; overflow: hidden;"></div>
                    <div style="height: 25px;"></div>
                    <div id="info-zone" style="height: 135px; overflow: hidden;"></div>
                    <div style="font-size: 8px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 2px; margin-top: 15px; text-align: center;">
                        v3.1.5 • Smooth Flow Engine
                    </div>
                </div>
            </div>`;

        if (window.innerWidth > 1250) document.getElementById('garden-floating-sidebar').style.display = 'block';

        const startCarousel = (id, items) => {
            const container = document.getElementById(id);
            let idx = 0;
            const update = () => {
                const item = items[idx];
                
                // Animáció kezdete: elhalványul és kicsit lejjebb úszik
                container.style.opacity = 0;
                container.style.transform = "translateY(8px)";
                
                setTimeout(() => {
                    container.innerHTML = `
                        <div style="border-left: 4px solid ${item.color}; padding-left: 15px; height: 100%; display: flex; flex-direction: column; justify-content: flex-start;">
                            <div style="font-size: 11px; font-weight: bold; color: ${item.color}; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 0.5px;">${item.dStr}</div>
                            <div style="font-size: 17px; font-weight: 800; color: #1e293b; line-height: 1.2; margin-bottom: 8px;">${esc(item.title)}</div>
                            <p style="margin:0; font-size: 13px; line-height: 1.4; color: #475569;">${esc(item.msg)}</p>
                        </div>`;
                    
                    // Visszaúszik a helyére és megjelenik
                    container.style.opacity = 1;
                    container.style.transform = "translateY(0px)";
                    
                    idx = (idx + 1) % items.length;
                }, 500);
            };
            
            // Beállítjuk a transition-t az egész containerre
            container.style.transition = "opacity 0.6s ease-in-out, transform 0.6s ease-out";
            
            update();
            if (items.length > 1) setInterval(update, 6000);
        };

        startCarousel('alert-zone', finalAlerts.length ? finalAlerts : alertFallback);
        startCarousel('info-zone', finalInfos.length ? finalInfos : infoFallback);

    } catch (e) { console.error("Kertfigyelő hiba:", e); }
})();
