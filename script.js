// Global State & Storage
let currentChart = null;
let currentRawData = null;
let currentCityName = 'Lucknow';
let tempUnit = localStorage.getItem('weather_unit') || 'C'; // 'C' or 'F'

let searchHistory = JSON.parse(localStorage.getItem('weather_history')) || ['Lucknow', 'Delhi', 'Mumbai'];
let favorites = JSON.parse(localStorage.getItem('weather_favorites')) || [];

// Canvas Animation State
let canvasAnimationId = null;
let particles = [];

// DOM Elements
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const geoBtn = document.getElementById('geoBtn');
const recentSearchesContainer = document.getElementById('recentSearches');

const addFavoriteBtn = document.getElementById('addFavoriteBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
const unitToggleBtn = document.getElementById('unitToggleBtn');
const clearDataBtn = document.getElementById('clearDataBtn');
const toast = document.getElementById('toast');

const bgCanvas = document.getElementById('weatherBgCanvas');
const bgCtx = bgCanvas.getContext('2d');

// Resize Background Canvas
function resizeCanvas() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Temperature Helper Converter
function convertTemp(celsius) {
  if (tempUnit === 'F') {
    return Math.round((celsius * 9) / 5 + 32);
  }
  return Math.round(celsius);
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

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
      () => showToast('Geolocation permission denied.')
    );
  }
});

// Settings & Favorite Actions
addFavoriteBtn.addEventListener('click', () => {
  const exists = favorites.some(f => f.toLowerCase() === currentCityName.toLowerCase());
  if (exists) {
    favorites = favorites.filter(f => f.toLowerCase() !== currentCityName.toLowerCase());
    addFavoriteBtn.classList.remove('active-fav');
    showToast(`Removed ${currentCityName} from Favorites`);
  } else {
    favorites.push(currentCityName);
    addFavoriteBtn.classList.add('active-fav');
    showToast(`Added ${currentCityName} to Favorites ⭐`);
  }
  localStorage.setItem('weather_favorites', JSON.stringify(favorites));
  renderHistoryTags();
});

settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsMenu.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
    settingsMenu.classList.add('hidden');
  }
});

unitToggleBtn.addEventListener('click', () => {
  tempUnit = tempUnit === 'C' ? 'F' : 'C';
  localStorage.setItem('weather_unit', tempUnit);
  unitToggleBtn.textContent = `°${tempUnit}`;
  showToast(`Switched unit to °${tempUnit}`);
  
  if (currentRawData) {
    updateUI(currentRawData.weather, currentRawData.aqi, currentCityName);
  }
});

clearDataBtn.addEventListener('click', () => {
  localStorage.removeItem('weather_history');
  localStorage.removeItem('weather_favorites');
  searchHistory = [currentCityName];
  favorites = [];
  renderHistoryTags();
  updateFavoriteIconState();
  settingsMenu.classList.add('hidden');
  showToast('Cleared all saved cities!');
});

// App Init
window.addEventListener('load', () => {
  unitToggleBtn.textContent = `°${tempUnit}`;
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
      showToast('City not found!');
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

    currentRawData = { weather: weatherRes, aqi: aqiRes };
    currentCityName = cityName;

    updateUI(weatherRes, aqiRes, cityName);
  } catch (err) {
    console.error('Error fetching weather:', err);
  }
}

// Update UI & Elements
function updateUI(weather, aqiData, cityName) {
  const current = weather.current;
  const daily = weather.daily;
  const hourly = weather.hourly;

  // Header Data & Favorites state
  document.getElementById('cityName').textContent = cityName;
  document.getElementById('weatherState').textContent = getWeatherStateText(current.weather_code);
  updateFavoriteIconState();

  // 1. UV Index
  const uv = Math.round(current.uv_index || 0);
  document.getElementById('uvVal').textContent = uv;
  document.getElementById('uvStatusText').textContent = getUVStatus(uv);
  setGaugeOffset('uvGaugePath', uv, 12);

  // 2. Humidity
  const humidity = Math.round(current.relative_humidity_2m);
  document.getElementById('humidityVal').textContent = `${humidity}%`;
  setGaugeOffset('humidityGaugePath', humidity, 100);

  // 3. Real Feel (Converts °C to °F dynamically)
  const feelsLike = convertTemp(current.apparent_temperature);
  document.getElementById('feelsLikeVal').textContent = `${feelsLike}°`;
  setGaugeOffset('feelsGaugePath', feelsLike, tempUnit === 'F' ? 120 : 50);

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

  // Render Hourly Line Chart & Cards with Unit Conversion
  renderHourlyChart(hourly);

  // Dynamic Background Engine
  startWeatherBackground(current.weather_code);
}

function updateFavoriteIconState() {
  const isFav = favorites.some(f => f.toLowerCase() === currentCityName.toLowerCase());
  if (isFav) {
    addFavoriteBtn.classList.add('active-fav');
  } else {
    addFavoriteBtn.classList.remove('active-fav');
  }
}

// Render Hourly Chart
function renderHourlyChart(hourly) {
  const ctx = document.getElementById('hourlyCanvas').getContext('2d');
  const nowHour = new Date().getHours();

  const next6Hours = hourly.time.slice(nowHour, nowHour + 6);
  const temps = hourly.temperature_2m.slice(nowHour, nowHour + 6).map(t => convertTemp(t));
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

// Background Animation Engine
function startWeatherBackground(code) {
  if (canvasAnimationId) {
    cancelAnimationFrame(canvasAnimationId);
  }
  particles = [];

  if (code === 0) {
    document.body.style.background = 'linear-gradient(180deg, #1b3a6b 0%, #2f65a3 100%)';
  } else if (code <= 3) {
    document.body.style.background = 'linear-gradient(180deg, #2c3e50 0%, #4ca1af 100%)';
  } else if (code <= 67 || (code >= 80 && code <= 82)) {
    document.body.style.background = 'linear-gradient(180deg, #1f1c2c 0%, #928dab 100%)';
  } else if (code >= 95) {
    document.body.style.background = 'linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)';
  } else if (code <= 77) {
    document.body.style.background = 'linear-gradient(180deg, #83a4d4 0%, #b6fbff 100%)';
  }

  if (code === 0 || code <= 3) {
    for (let i = 0; i < 7; i++) {
      particles.push({
        x: Math.random() * bgCanvas.width,
        y: Math.random() * (bgCanvas.height * 0.45) + 30,
        scale: Math.random() * 0.8 + 0.5,
        speedX: Math.random() * 0.4 + 0.2,
        opacity: code === 0 ? Math.random() * 0.25 + 0.15 : Math.random() * 0.45 + 0.25
      });
    }
  } else {
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

    if (code === 0) {
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

      particles.forEach(p => {
        p.x += p.speedX;
        if (p.x > bgCanvas.width + 160) {
          p.x = -160;
          p.y = Math.random() * (bgCanvas.height * 0.4) + 30;
        }
        drawCloud(bgCtx, p.x, p.y, p.scale, p.opacity);
      });
    } else if (code <= 3 || code === 45 || code === 48) {
      particles.forEach(p => {
        p.x += p.speedX;
        if (p.x > bgCanvas.width + 160) {
          p.x = -160;
          p.y = Math.random() * (bgCanvas.height * 0.45) + 30;
        }
        drawCloud(bgCtx, p.x, p.y, p.scale, p.opacity);
      });
    } else if (code <= 67 || (code >= 80 && code <= 82)) {
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
    } else if (code >= 95) {
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
    } else if (code <= 77) {
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

function setGaugeOffset(elementId, value, maxVal) {
  const path = document.getElementById(elementId);
  if (!path) return;
  const maxDash = 126;
  const percentage = Math.min(Math.max(value / maxVal, 0), 1);
  const offset = maxDash - (maxDash * percentage);
  path.style.strokeDashoffset = offset;
}

// Search History & Favorites Helper
function saveToHistory(city) {
  searchHistory = searchHistory.filter(c => c.toLowerCase() !== city.toLowerCase());
  searchHistory.unshift(city);
  if (searchHistory.length > 5) searchHistory.pop();
  localStorage.setItem('weather_history', JSON.stringify(searchHistory));
  renderHistoryTags();
}

function renderHistoryTags() {
  recentSearchesContainer.innerHTML = '';

  // Favorites tags (Gold Bordered)
  favorites.forEach(city => {
    const tag = document.createElement('div');
    tag.className = 'history-tag fav-tag';
    tag.innerHTML = `
      <span>⭐ ${city}</span>
      <span class="remove-btn">&times;</span>
    `;
    tag.querySelector('span').addEventListener('click', () => handleSearch(city));
    tag.querySelector('.remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      favorites = favorites.filter(c => c !== city);
      localStorage.setItem('weather_favorites', JSON.stringify(favorites));
      updateFavoriteIconState();
      renderHistoryTags();
    });
    recentSearchesContainer.appendChild(tag);
  });

  // Recent searches
  searchHistory.forEach(city => {
    if (favorites.some(f => f.toLowerCase() === city.toLowerCase())) return;
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