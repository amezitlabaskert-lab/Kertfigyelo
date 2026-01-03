(async function() {
    // 1. Plus Jakarta Sans font betöltése
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    // 2. Modern, letisztult CSS
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
        
        /* Színkódok */
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
        
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=47.5136&longitude=19.3735&daily=temperature_2m_min,wind_speed_10m_max,precipitation_sum&timezone=auto`);
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
                
                let isDayOk = false;

                if ((rule.type === 'alert' || rule.type === 'info') && dayMin <= rule.trigger.temp_min) {
                    if (rule.type === 'info') {
                        const isS = rule.seasons.some(s => {
                            const [sM, sD] = s.start.split('-').map(Number);
                            const [eM, eD] = s.end.split('-').map(Number);
                            const start = new Date(date.getFullYear(), sM-1, sD);
                            const end = new Date(date.getFullYear(), eM-1, eD);
                            return date >= start && date <= end;
                        });
                        if (isS && dayMin > -12) isDayOk = true;
                    } else { isDayOk = true; }
                }

                if (rule.type === 'window') {
                    const [sM, sD] = rule.season.start.split('-').map(Number);
                    const [eM, eD] = rule.season.end.split('-').map(Number);
                    const start = new Date(date.getFullYear(), sM-1, sD);
                    const end = new Date(date.getFullYear(), eM-1, eD);
                    if (date >= start && date <= end && dayMin >= rule.conditions.temp_min && dayWind <= rule.conditions.wind_max && dayRain <= rule.conditions.rain_max) {
                        isDayOk = true;
                    }
                }

                if (isDayOk) {
                    if (!currentWindow) { currentWindow = { start: date, end: date, minTemp: dayMin }; }
                    else { currentWindow.end = date; currentWindow.minTemp = Math.min(currentWindow.minTemp, dayMin); }
                } else if (currentWindow) { activeWindows.push(currentWindow); currentWindow = null; }
            }
            if (currentWindow) activeWindows.push(currentWindow);

            activeWindows.forEach(win => {
                const dateStr = win.start.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}) + 
                                (win.start.getTime() !== win.end.getTime() ? ' - ' + win.end.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}) : '');
                
                const fagyInfo = (rule.type === 'alert') ? (${rule.trigger.temp_min}°C) : '';

                htmlContent += `
                    <div class="garden-card ${rule.type}">
                        <strong>${dateStr}: ${rule.name}${fagyInfo}</strong>
                        <p>${rule.message}</p>
                        <div class="plant-list">Érintett: ${rule.plants.join(', ')}</div>
                    </div>
                `;
            });
        });

        widgetDiv.innerHTML = htmlContent;
    } catch (e) { console.error(e); }
})();


