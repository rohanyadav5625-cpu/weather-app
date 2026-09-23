const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const geoBtn = document.getElementById('geoBtn');
const errorMsg = document.getElementById('errorMsg');
const recentSearchesContainer = document.getElementById('recentSearches');
let searchHistory = JSON.parse(localStorage.getItem('weather_search_history')) || [];
const celsiusBtn = document.getElementById('celsiusBtn');
const fahrenheitBtn = document.getElementById('fahrenheitBtn');

const tempEl = document.getElementById('temp');
const weatherDescEl = document.getElementById('weatherDesc');
const locationEl = document.getElementById('location');
const feelsLikeEl = document.getElementById('feelsLike');
const humidityEl = document.getElementById('humidity');
const windSpeedEl = document.getElementById('windSpeed');
const weatherIconEl = document.getElementById('weatherIcon');

const forecastSection = document.getElementById('forecastSection');
const forecastContainer = document.getElementById('forecastContainer');

let currentUnit = 'C';
let currentWeatherData = null;

// Canvas Particle Setup
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let animationId = null;
let currentEffectType = 'none';

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const weatherCodes = {
  0: { desc: "Clear Sky", icon: "fa-sun", theme: "theme-clear", effect: "none" },
  1: { desc: "Mainly Clear", icon: "fa-cloud-sun", theme: "theme-clear", effect: "none" },
  2: { desc: "Partly Cloudy", icon: "fa-cloud-sun", theme: "theme-cloudy", effect: "none" },
  3: { desc: "Overcast", icon: "fa-cloud", theme: "theme-cloudy", effect: "none" },
  45: { desc: "Foggy", icon: "fa-smog", theme: "theme-cloudy", effect: "none" },
  51: { desc: "Light Drizzle", icon: "fa-cloud-rain", theme: "theme-rainy", effect: "rain" },
  61: { desc: "Rainy", icon: "fa-cloud-showers-heavy", theme: "theme-rainy", effect: "rain" },
  71: { desc: "Snowfall", icon: "fa-snowflake", theme: "theme-snow", effect: "snow" },
  95: { desc: "Thunderstorm", icon: "fa-bolt", theme: "theme-thunder", effect: "rain" }
};

function createParticles(type) {
  particles = [];
  const count = type === 'rain' ? 120 : type === 'snow' ? 80 : 0;

  for (let i = 0; i < count; i++) {
    if (type === 'rain') {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        length: Math.random() * 20 + 10,
        speed: Math.random() * 10 + 12
      });
    } else if (type === 'snow') {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 3 + 1,
        speedY: Math.random() * 1.5 + 0.8,
        speedX: Math.random() * 1 - 0.5,
        opacity: Math.random() * 0.7 + 0.3
      });
    }
  }
}

function renderParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentEffectType === 'rain') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';

    particles.forEach(p => {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 2, p.y + p.length);
      ctx.stroke();

      p.y += p.speed;
      p.x -= 0.5;

      if (p.y > canvas.height) {
        p.y = -p.length;
        p.x = Math.random() * canvas.width;
      }
    });

  } else if (currentEffectType === 'snow') {
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
      ctx.fill();

      p.y += p.speedY;
      p.x += p.speedX;

      if (p.y > canvas.height) {
        p.y = -p.radius;
        p.x = Math.random() * canvas.width;
      }
    });
  }

  if (currentEffectType !== 'none') {
    animationId = requestAnimationFrame(renderParticles);
  }
}

function startParticleEffect(type) {
  if (currentEffectType === type) return;
  if (animationId) cancelAnimationFrame(animationId);
  currentEffectType = type;

  if (type === 'none') {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  createParticles(type);
  renderParticles();
}
function renderHistory() {
  recentSearchesContainer.innerHTML = '';
  if (searchHistory.length === 0) return;

  searchHistory.forEach((city) => {
    const tag = document.createElement('div');
    tag.className = 'history-tag';
    tag.innerHTML = `
      <span>${city}</span>
      <i class="fa-solid fa-xmark remove-btn"></i>
    `;

    tag.addEventListener('click', () => {
      cityInput.value = city;
      fetchWeather(city);
    });

    const removeBtn = tag.querySelector('.remove-btn');
    removeBtn.addEventListener('click', (e) => removeFromHistory(city, e));

    recentSearchesContainer.appendChild(tag);
  });
}

function saveToHistory(cityName) {
  if (!cityName) return;

  searchHistory = searchHistory.filter(
    (item) => item.toLowerCase() !== cityName.toLowerCase()
  );

  searchHistory.unshift(cityName);

  if (searchHistory.length > 5) searchHistory.pop();

  localStorage.setItem('weather_search_history', JSON.stringify(searchHistory));
  renderHistory();
}

function removeFromHistory(cityName, e) {
  e.stopPropagation();
  searchHistory = searchHistory.filter(
    (item) => item.toLowerCase() !== cityName.toLowerCase()
  );
  localStorage.setItem('weather_search_history', JSON.stringify(searchHistory));
  renderHistory();
}
function formatTemp(tempInCelsius) {
  if (currentUnit === 'F') {
    return `${Math.round((tempInCelsius * 9) / 5 + 32)}°F`;
  }
  return `${Math.round(tempInCelsius)}°C`;
}

function updateUI() {
  if (!currentWeatherData) return;

  const { current, daily, name, country } = currentWeatherData;

  locationEl.textContent = `${name}, ${country}`;
  tempEl.textContent = formatTemp(current.temperature_2m);
  feelsLikeEl.textContent = formatTemp(current.apparent_temperature);
  humidityEl.textContent = `${current.relative_humidity_2m}%`;
  windSpeedEl.textContent = `${current.wind_speed_10m} km/h`;

  const weatherInfo = weatherCodes[current.weather_code] || { desc: "Moderate", icon: "fa-cloud", theme: "theme-default", effect: "none" };
  weatherDescEl.textContent = weatherInfo.desc;
  weatherIconEl.innerHTML = `<i class="fa-solid ${weatherInfo.icon}"></i>`;

  document.body.className = weatherInfo.theme;
  startParticleEffect(weatherInfo.effect);

  forecastContainer.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const date = new Date(daily.time[i]);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayCode = daily.weather_code[i];
    const maxTemp = formatTemp(daily.temperature_2m_max[i]);
    const minTemp = formatTemp(daily.temperature_2m_min[i]);
    const dayInfo = weatherCodes[dayCode] || { icon: "fa-cloud" };

    const card = document.createElement('div');
    card.classList.add('forecast-card');
    card.innerHTML = `
      <div class="day">${dayName}</div>
      <i class="fa-solid ${dayInfo.icon}"></i>
      <div class="high-temp">${maxTemp}</div>
      <div class="low-temp">${minTemp}</div>
    `;
    forecastContainer.appendChild(card);
  }

  forecastSection.style.display = 'block';
}

// Fetch weather by City name
async function fetchWeather(city) {
  try {
    errorMsg.style.display = 'none';

    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      errorMsg.style.display = 'block';
      forecastSection.style.display = 'none';
      startParticleEffect('none');
      return;
    }

    const { latitude, longitude, name, country } = geoData.results[0];
    await fetchWeatherData(latitude, longitude, name, country);

  } catch (error) {
    errorMsg.style.display = 'block';
    errorMsg.textContent = "Error fetching weather data.";
    forecastSection.style.display = 'none';
    startParticleEffect('none');
  }
}

// Fetch weather by GPS Coordinates
async function fetchWeatherByCoords(lat, lon) {
  try {
    errorMsg.style.display = 'none';

    // Reverse Geocoding to retrieve City/Country name
    const reverseGeoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const geoRes = await fetch(reverseGeoUrl);
    const geoData = await geoRes.json();

    const name = geoData.city || geoData.locality || geoData.principalSubdivision || "Your Location";
    const country = geoData.countryCode || geoData.countryName || "";

    await fetchWeatherData(lat, lon, name, country);

  } catch (error) {
    errorMsg.style.display = 'block';
    errorMsg.textContent = "Error fetching location weather.";
    forecastSection.style.display = 'none';
    startParticleEffect('none');
  }
}

// Helper to fetch Open-Meteo forecast given coordinates
async function fetchWeatherData(latitude, longitude, name, country) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
  const weatherRes = await fetch(weatherUrl);
  const weatherData = await weatherRes.json();

  currentWeatherData = {
    current: weatherData.current,
    daily: weatherData.daily,
    name,
    country
  };
saveToHistory(name); // <-- YE LINE ADD KAREIN
  updateUI();
}

// Event Listeners
celsiusBtn.addEventListener('click', () => {
  if (currentUnit !== 'C') {
    currentUnit = 'C';
    celsiusBtn.classList.add('active');
    fahrenheitBtn.classList.remove('active');
    updateUI();
  }
});

fahrenheitBtn.addEventListener('click', () => {
  if (currentUnit !== 'F') {
    currentUnit = 'F';
    fahrenheitBtn.classList.add('active');
    celsiusBtn.classList.remove('active');
    updateUI();
  }
});

searchBtn.addEventListener('click', () => {
  if (cityInput.value.trim() !== "") fetchWeather(cityInput.value.trim());
});

cityInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && cityInput.value.trim() !== "") fetchWeather(cityInput.value.trim());
});

// Geolocation Trigger
geoBtn.addEventListener('click', () => {
  if (navigator.geolocation) {
    geoBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        geoBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
        fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        geoBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
        errorMsg.style.display = 'block';
        errorMsg.textContent = "Geolocation permission denied or unavailable.";
      }
    );
  } else {
    errorMsg.style.display = 'block';
    errorMsg.textContent = "Geolocation is not supported by your browser.";
  }
});
renderHistory();





