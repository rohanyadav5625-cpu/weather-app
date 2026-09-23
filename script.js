// Global State & Variables
let currentChart = null;
let searchHistory = JSON.parse(localStorage.getItem('weather_history')) || ['Lucknow', 'Delhi', 'Mumbai'];

// Canvas Animation State
let canvasAnimationId = null;
let particles = [];

// DOM Elements
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const geoBtn = document.getElementById('geoBtn');
const recentSearchesContainer = document.getElementById('recentSearches');
const bgCanvas = document.getElementById('weatherBgCanvas');
const bgCtx = bgCanvas.getContext('2d');

// Resize Background Canvas
function resizeCanvas() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Event Listeners
searchBtn.addEventListener('click', () => {
  const query = cityInput.value.trim();
  if (query) handleSearch(query);
});

cityInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') {
    const query = cityInput.value.trim();
    if (query) handleSearch(query);
  }
});

geoBtn.addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude, 'Your Location'),
      () => alert('Geolocation permission denied.')
    );
  }
});

// Init App
window.addEventListener('load', () => {
  renderHistoryTags();
  handleSearch(searchHistory[0] || 'Lucknow');
});

// Search Logic
async function handleSearch(cityName) {
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
    const res = await fetch(geoUrl);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      alert('City not found!');
      return;
    }

    const { latitude, longitude, name } = data.results[0];
    saveToHistory(name);
    fetchWeatherByCoords(latitude, longitude, name);
    cityInput.value = '';
  } catch (err) {
    console.error('Error fetching city:', err);
  }
}

// Fetch Weather & AQI
async function fetchWeatherByCoords(lat, lon, cityName) {
  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,uv_index&hourly=temperature_2m,weather_code,wind_speed_10m&daily=sunrise,sunset&timezone=auto`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`;

    const [weatherRes, aqiRes] = await Promise.all([
      fetch(weatherUrl).then(r => r.json()),
      fetch(aqiUrl).then(r => r.json())
    ]);

    updateUI(weatherRes, aqiRes, cityName);
  } catch (err) {
    console.error('Error fetching weather:', err);
  }
}

// Update UI & Trigger Dynamic Background Effects
function updateUI(weather, aqiData, cityName) {
  const current = weather.current;
  const daily = weather.daily;
  const hourly = weather.hourly;

  // Header Data
  document.getElementById('cityName').textContent = cityName;
  const weatherText = getWeatherStateText(current.weather_code);
  document.getElementById('weatherState').textContent = weatherText;

  // 1. UV Index
  const uv = Math.round(current.uv_index || 0);
  document.getElementById('uvVal').textContent = uv;
  document.getElementById('uvStatusText').textContent = getUVStatus(uv);
  setGaugeOffset('uvGaugePath', uv, 12);

  // 2. Humidity
  const humidity = Math.round(current.relative_humidity_2m);
  document.getElementById('humidityVal').textContent = `${humidity}%`;
  setGaugeOffset('humidityGaugePath', humidity, 100);

  // 3. Real Feel
  const feelsLike = Math.round(current.apparent_temperature);
  document.getElementById('feelsLikeVal').textContent = `${feelsLike}°`;
  setGaugeOffset('feelsGaugePath', feelsLike, 50);

  // 4. Wind & Compass Direction
  const speed = current.wind_speed_10m;
  document.getElementById('windSpeedVal').innerHTML = `${speed} <span class="unit-text">km/h</span>`;
  document.getElementById('windDirText').textContent = getWindDirectionName(current.wind_direction_10m);
  document.getElementById('compassArrow').style.transform = `rotate(${current.wind_direction_10m}deg)`;

  // 5. Sunset / Sunrise
  const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const sunsetStr = formatTime(daily.sunset[0]);
  const sunriseStr = formatTime(daily.sunrise[0]);
  document.getElementById('sunsetTime').textContent = sunsetStr;
  document.getElementById('sunriseVal').textContent = sunriseStr;
  document.getElementById('sunsetVal').textContent = sunsetStr;

  // 6. Pressure
  document.getElementById('pressureVal').textContent = Math.round(current.surface_pressure);

  // 7. AQI
  const aqi = aqiData.current ? aqiData.current.us_aqi : 50;
  document.getElementById('aqiText').textContent = `AQI ${aqi} • ${getAQIStatus(aqi)}`;

  // Render Hourly Line Chart
  renderHourlyChart(hourly);

  // Trigger Interactive Background Animation
  startWeatherBackground(current.weather_code);
}

// Render Hourly Chart
function renderHourlyChart(hourly) {
  const ctx = document.getElementById('hourlyCanvas').getContext('2d');
  const nowHour = new Date().getHours();

  const next6Hours = hourly.time.slice(nowHour, nowHour + 6);
  const temps = hourly.temperature_2m.slice(nowHour, nowHour + 6).map(t => Math.round(t));
  const codes = hourly.weather_code.slice(nowHour, nowHour + 6);
  const winds = hourly.wind_speed_10m.slice(nowHour, nowHour + 6);

  const labels = next6Hours.map((t, index) => {
    if (index === 0) return 'Now';
    return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  });

  if (currentChart) {
    currentChart.destroy();
  }

  currentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: temps,
        borderColor: '#ffa726',
        borderWidth: 2,
        tension: 0.4,
        pointBackgroundColor: '#ffffff',
        pointRadius: 4,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    }
  });

  // Render Hourly Items Strip
  const itemsContainer = document.getElementById('hourlyItemsContainer');
  itemsContainer.innerHTML = '';

  labels.forEach((label, i) => {
    const iconClass = getWeatherIconClass(codes[i]);
    const div = document.createElement('div');
    div.className = 'hourly-item';
    div.innerHTML = `
      <span>${temps[i]}°</span>
      <i class="${iconClass}"></i>
      <span class="hourly-wind">${winds[i]}km/h</span>
      <span>${label}</span>
    `;
    itemsContainer.appendChild(div);
  });
}

// ======================================================
// DYNAMIC INTERACTIVE BACKGROUND ENGINE (CANVAS ANIMATIONS)
// ======================================================

function startWeatherBackground(code) {
  if (canvasAnimationId) {
    cancelAnimationFrame(canvasAnimationId);
  }
  particles = [];

  // Update Body Theme Gradient
  if (code === 0) {
    document.body.style.background = 'linear-gradient(180deg, #1b3a6b 0%, #2f65a3 100%)'; // Clear Blue Sky
  } else if (code <= 3) {
    document.body.style.background = 'linear-gradient(180deg, #2c3e50 0%, #4ca1af 100%)'; // Cloudy
  } else if (code <= 67 || (code >= 80 && code <= 82)) {
    document.body.style.background = 'linear-gradient(180deg, #1f1c2c 0%, #928dab 100%)'; // Rain
  } else if (code >= 95) {
    document.body.style.background = 'linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)'; // Thunderstorm
  } else if (code <= 77) {
    document.body.style.background = 'linear-gradient(180deg, #83a4d4 0%, #b6fbff 100%)'; // Snow
  }

  // Initialize Particles / Cloud Objects based on weather
  if (code === 0 || code <= 3) {
    // Generate Soft Fluffy Clouds for Clear / Partly Cloudy Weather
    for (let i = 0; i < 7; i++) {
      particles.push({
        x: Math.random() * bgCanvas.width,
        y: Math.random() * (bgCanvas.height * 0.45) + 30,
        scale: Math.random() * 0.8 + 0.5,
        speedX: Math.random() * 0.4 + 0.2, // Slow horizontal drift
        opacity: code === 0 ? Math.random() * 0.25 + 0.15 : Math.random() * 0.45 + 0.25
      });
    }
  } else {
    // Drops / Flakes for Rain, Thunderstorm & Snow
    const count = code <= 67 ? 120 : 50;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * bgCanvas.width,
        y: Math.random() * bgCanvas.height,
        radius: Math.random() * 3 + 1,
        speedY: Math.random() * 5 + 3,
        speedX: Math.random() * 1.5 - 0.75,
        opacity: Math.random() * 0.7 + 0.3
      });
    }
  }

  function render() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

    // 1. CLEAR / SUNNY SKY (Sun Glow + Floating Clouds)
    if (code === 0) {
      // Golden Sun Glow in Top Right
      const sunGlow = bgCtx.createRadialGradient(
        bgCanvas.width - 100, 100, 20,
        bgCanvas.width - 100, 100, 220
      );
      sunGlow.addColorStop(0, 'rgba(255, 235, 59, 0.35)');
      sunGlow.addColorStop(0.5, 'rgba(255, 193, 7, 0.15)');
      sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');

      bgCtx.fillStyle = sunGlow;
      bgCtx.beginPath();
      bgCtx.arc(bgCanvas.width - 100, 100, 220, 0, Math.PI * 2);
      bgCtx.fill();

      // Render Floating Soft Clouds
      particles.forEach(p => {
        p.x += p.speedX;
        if (p.x > bgCanvas.width + 160) {
          p.x = -160;
          p.y = Math.random() * (bgCanvas.height * 0.4) + 30;
        }
        drawCloud(bgCtx, p.x, p.y, p.scale, p.opacity);
      });
    }

    // 2. CLOUDY / OVERCAST (Drifting Clouds)
    else if (code <= 3 || code === 45 || code === 48) {
      particles.forEach(p => {
        p.x += p.speedX;
        if (p.x > bgCanvas.width + 160) {
          p.x = -160;
          p.y = Math.random() * (bgCanvas.height * 0.45) + 30;
        }
        drawCloud(bgCtx, p.x, p.y, p.scale, p.opacity);
      });
    }

    // 3. RAIN / SHOWERS
    else if (code <= 67 || (code >= 80 && code <= 82)) {
      bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      bgCtx.lineWidth = 1.5;
      particles.forEach(p => {
        p.y += p.speedY * 2;
        if (p.y > bgCanvas.height) {
          p.y = 0;
          p.x = Math.random() * bgCanvas.width;
        }
        bgCtx.beginPath();
        bgCtx.moveTo(p.x, p.y);
        bgCtx.lineTo(p.x + p.speedX, p.y + 12);
        bgCtx.stroke();
      });
    }

    // 4. THUNDERSTORM
    else if (code >= 95) {
      bgCtx.strokeStyle = 'rgba(200, 220, 255, 0.8)';
      bgCtx.lineWidth = 2;
      particles.forEach(p => {
        p.y += p.speedY * 2.5;
        if (p.y > bgCanvas.height) {
          p.y = 0;
          p.x = Math.random() * bgCanvas.width;
        }
        bgCtx.beginPath();
        bgCtx.moveTo(p.x, p.y);
        bgCtx.lineTo(p.x, p.y + 15);
        bgCtx.stroke();
      });

      if (Math.random() < 0.015) {
        bgCtx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
      }
    }

    // 5. SNOW
    else if (code <= 77) {
      bgCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      particles.forEach(p => {
        p.y += p.speedY * 0.5;
        p.x += Math.sin(p.y * 0.02);
        if (p.y > bgCanvas.height) p.y = 0;
        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        bgCtx.fill();
      });
    }

    canvasAnimationId = requestAnimationFrame(render);
  }

  render();
}

// Function to Render Smooth Clouds on Canvas
function drawCloud(ctx, x, y, scale, opacity) {
  ctx.save();
  ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
  ctx.beginPath();
  ctx.arc(x, y, 30 * scale, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + 35 * scale, y - 25 * scale, 35 * scale, Math.PI * 1, Math.PI * 1.85);
  ctx.arc(x + 75 * scale, y - 20 * scale, 30 * scale, Math.PI * 1.37, Math.PI * 1.91);
  ctx.arc(x + 100 * scale, y, 25 * scale, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// SVG Gauge Offset Helper
function setGaugeOffset(elementId, value, maxVal) {
  const path = document.getElementById(elementId);
  if (!path) return;
  const maxDash = 126;
  const percentage = Math.min(Math.max(value / maxVal, 0), 1);
  const offset = maxDash - (maxDash * percentage);
  path.style.strokeDashoffset = offset;
}

// Search History Helpers
function saveToHistory(city) {
  searchHistory = searchHistory.filter(c => c.toLowerCase() !== city.toLowerCase());
  searchHistory.unshift(city);
  if (searchHistory.length > 5) searchHistory.pop();
  localStorage.setItem('weather_history', JSON.stringify(searchHistory));
  renderHistoryTags();
}

function renderHistoryTags() {
  recentSearchesContainer.innerHTML = '';
  searchHistory.forEach(city => {
    const tag = document.createElement('div');
    tag.className = 'history-tag';
    tag.innerHTML = `
      <span>${city}</span>
      <span class="remove-btn">&times;</span>
    `;
    tag.querySelector('span').addEventListener('click', () => handleSearch(city));
    tag.querySelector('.remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      searchHistory = searchHistory.filter(c => c !== city);
      localStorage.setItem('weather_history', JSON.stringify(searchHistory));
      renderHistoryTags();
    });
    recentSearchesContainer.appendChild(tag);
  });
}

// Helpers for weather descriptions & icons
function getWeatherStateText(code) {
  if (code === 0) return 'Clear Sky';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Rain Showers';
  return 'Thunderstorm';
}

function getWeatherIconClass(code) {
  if (code === 0) return 'fa-solid fa-sun';
  if (code <= 3) return 'fa-solid fa-cloud-sun';
  if (code <= 48) return 'fa-solid fa-smog';
  if (code <= 67) return 'fa-solid fa-cloud-rain';
  if (code <= 77) return 'fa-solid fa-snowflake';
  if (code <= 82) return 'fa-solid fa-cloud-showers-heavy';
  return 'fa-solid fa-bolt';
}

function getUVStatus(uv) {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  return 'Strong';
}

function getAQIStatus(aqi) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy';
  return 'Hazardous';
}

function getWindDirectionName(deg) {
  const dirs = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
  return dirs[Math.round(deg / 45) % 8];
}