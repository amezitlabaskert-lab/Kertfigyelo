(async function() {
    // 1. Font betöltése
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    // 2. Modern CSS stílusok
    const style = document.createElement('style');
    style.textContent = `
        #smart-garden-widget {
            font-family: 'Plus Jakarta Sans', sans-serif;
            max-width: 800px;
            margin: 20px auto;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .garden-card {
            padding: 20px;
            border-radius: 16px;
            color: #ffffff;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .garden-card:hover { transform: translateY(-2px); }
        .garden-card.alert { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); border-left: 8px solid #60a5fa; }
        .garden-card.info { background: linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%); border-left: 8px solid #7dd3fc; }
        .garden-card.window { background: linear-gradient(135deg, #15803d 0%, #22c55e 100%); border-left: 8px solid #86efac; }
        .garden-card strong { display: block; font-size: 1.1em; font-weight: 800; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .garden-card p { margin: 0 0 12px 0; font-size: 1em; line-height: 1.5; opacity: 0.95; }
        .plant-list { 
            font-size: 0.85em; 
            background: rgba(255,255,255,0.15); 
            padding: 8px 12px; 
            border-radius: 8px;
            font-weight: 600;
        }
    `;
    document.head.appendChild(style);

    try {
        const rulesRes = await fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/smart-events/main/blog-scripts.json');
        const rules = await rulesRes.json();
        
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=47.5136&longitude=19.3735&daily=temperature_2m_min,wind_speed_10m_max,precipitation_sum,soil_temperature_0_to_7cm&timezone=auto`);
        const weather = await weatherRes.json();

        const widgetDiv = document.getElementById('smart-garden-widget');
        let htmlContent = '';

        rules.forEach(rule => {
            let activeWindows = [];
            let currentWindow = null;

            for (let i = 0; i < 7; i++) {
                const date = new Date();
                date.setDate(date.getDate() + i);
                
                const dayMin = weather.daily.temperature_2m_min[i];
                const dayWind = weather.daily.wind_speed_10m_max[i];
                const dayRain = weather.daily.precipitation_sum[i];
                const daySoil = weather.daily.soil_temperature_0_to_7cm[i];
                
                let isDayOk = false;
                const cond = rule.conditions || {};

                // JAVÍTOTT SZEZON ELLENŐRZÉS (Évforduló kezeléssel és alapértelmezett aktivitással)
                let isS = true; 
                if (rule.seasons && rule.seasons.length > 0) {
                    isS = rule.seasons.some(s => {
                        const [sM, sD] = s.start.split('-').map(Number);
                        const [eM, eD] = s.end.split('-').map(Number);
                        let start = new Date(date.getFullYear(), sM - 1, sD);
                        let end = new Date(date.getFullYear(), eM - 1, eD);
                        
                        // Ha a vége dátum korábbi, mint a kezdő, akkor átnyúlik a következő évre
                        if (end < start) {
                            if (date < start) start.setFullYear(start.getFullYear() - 1);
                            else end.setFullYear(end.getFullYear() + 1);
                        }
                        return date >= start && date <= end;
                    });
                }

                if (isS) {
                    isDayOk = true;

                    // TALAJHŐ STABILITÁS
                    if (cond.soil_temp_above !== undefined) {
                        const nextDaySoil = weather.daily.soil_temperature_0_to_7cm[i + 1] || daySoil;
                        if (daySoil < cond.soil_temp_above || nextDaySoil < cond.soil_temp_above) isDayOk = false;
                    }

                    // METSZÉS BIZTONSÁG (3 NAP)
                    if (cond.temp_above !== undefined) {
                        const futureTemps = weather.daily.temperature_2m_min.slice(i, i + 3);
                        if (!futureTemps.every(t => t >= cond.temp_above)) isDayOk = false;
                    }

                    if (cond.temp_below !== undefined && dayMin > cond.temp_below) isDayOk = false;
                    if (cond.rain_max !== undefined && dayRain > cond.rain_max) isDayOk = false;
                    if (cond.wind_max !== undefined && dayWind > cond.wind_max) isDayOk = false;
                }

                if (isDayOk) {
                    if (!currentWindow) currentWindow = { start: new Date(date), end: new Date(date) };
                    else currentWindow.end = new Date(date);
                } else if (currentWindow) {
                    activeWindows.push(currentWindow);
                    currentWindow = null;
                }
            }
            if (currentWindow) activeWindows.push(currentWindow);

            activeWindows.forEach(win => {
                const dateStr = win.start.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}) + 
                                (win.start.getTime() !== win.end.getTime() ? ' - ' + win.end.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}) : '');
                
                htmlContent += `
                    <div class="garden-card ${rule.type}">
                        <strong>${dateStr}: ${rule.name}</strong>
                        <p>${rule.message}</p>
                        ${rule.plants ? `<div class="plant-list">Érintett: ${rule.plants.join(', ')}</div>` : ''}
                    </div>
                `;
            });
        });

        widgetDiv.innerHTML = htmlContent || '<p style="text-align:center; opacity:0.6; padding:20px;">Jelenleg nincs aktuális kerti teendő.</p>';
        
    } catch (e) {
        console.error("Widget hiba:", e);
    }
})();
