// --- Configuration ---
const DEVICES = [
  {
    id: "e4b063f0c38c",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    cookie_key: "clicks_MainDoor",
    button_id: "MainDoor",
    log_id: "log1",
    counter_id: "MainDoor-counter",
    name: "Main Entrance",
  },
  {
    id: "34945478d595",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    cookie_key: "clicks_AptDoor",
    button_id: "AptDoor",
    log_id: "log2",
    counter_id: "AptDoor-counter",
    name: "Apartment Door",
  },
];

const MAX_CLICKS = 3;
const BASE_URL_SET = "https://shelly-73-eu.shelly.cloud/device/relay/control";
const CORRECT_CODE = "2245";
const TIME_LIMIT_MINUTES = 2; // 2 minutes for testing
const SECRET_KEY = "secureKey123";

// --- DOM References ---
const timerElement = document.getElementById("session-timer");
const sessionExpiredElement = document.getElementById("session-expired");
let timerInterval;

// --- Cookie utilities ---
function setCookie(name, value, minutes) {
  const d = new Date();
  d.setTime(d.getTime() + minutes * 60 * 1000);
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;SameSite=Strict`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

// --- Session management ---
function checkTimeLimit() {
  const startTime = getCookie("usage_start_time");
  if (!startTime) return false;

  const now = Date.now();
  const timePassed = now - parseInt(startTime, 10);
  const minutesPassed = timePassed / (1000 * 60);

  updateTimerDisplay(timePassed);

  if (minutesPassed >= TIME_LIMIT_MINUTES) {
    showSessionExpired();
    return true;
  }
  return false;
}

function updateTimerDisplay(timePassed) {
  if (!timerElement) return;

  const timeLeftMs = TIME_LIMIT_MINUTES * 60 * 1000 - timePassed;
  const minutesLeft = Math.floor(timeLeftMs / 60000);
  const secondsLeft = Math.floor((timeLeftMs % 60000) / 1000);

  timerElement.textContent = `Session: ${minutesLeft}m ${secondsLeft
    .toString()
    .padStart(2, "0")}s`;

  // Change color when time is running out
  if (minutesLeft === 0 && secondsLeft < 30) {
    timerElement.style.color = "#ff6b6b";
    timerElement.style.fontWeight = "bold";
    timerElement.style.animation = "pulse 0.5s infinite";
  } else {
    timerElement.style.color = "";
    timerElement.style.fontWeight = "";
    timerElement.style.animation = "";
  }
}

function showSessionExpired() {
  // Hide main content
  document.querySelector(".container").style.display = "none";
  // Show expired message
  sessionExpiredElement.style.display = "flex";

  // Clear any existing timers
  clearInterval(timerInterval);
}

// --- Set usage start time ---
function setUsageStartTime() {
  const now = Date.now();
  setCookie("usage_start_time", now, TIME_LIMIT_MINUTES);
  startTimer();
}

function startTimer() {
  // Initialize timer display
  updateTimerDisplay(0);

  if (timerElement) {
    // Clear any existing interval
    clearInterval(timerInterval);

    // Start new timer
    timerInterval = setInterval(() => {
      const startTime = parseInt(getCookie("usage_start_time"), 10);
      if (!startTime) return;

      const timePassed = Date.now() - startTime;
      updateTimerDisplay(timePassed);

      // Check if session has expired
      if (timePassed >= TIME_LIMIT_MINUTES * 60 * 1000) {
        showSessionExpired();
      }
    }, 1000);
  }
}

// --- Click management ---
function getClicksLeft(cookieKey) {
  const stored = getCookie(cookieKey);
  return stored === null ? MAX_CLICKS : parseInt(stored, 10);
}

function setClicksLeft(cookieKey, count) {
  setCookie(cookieKey, count, TIME_LIMIT_MINUTES);
}

function updateClickCounter(device) {
  const counterElement = document.getElementById(device.counter_id);
  if (counterElement) {
    const clicksLeft = getClicksLeft(device.cookie_key);
    counterElement.textContent = clicksLeft;

    // Update button animation based on clicks
    const button = document.getElementById(device.button_id);
    if (clicksLeft > 0) {
      button.classList.add("pulse");
    } else {
      button.classList.remove("pulse");
    }
  }
}

function updateButtonState(device) {
  const btn = document.getElementById(device.button_id);
  const clicksLeft = getClicksLeft(device.cookie_key);
  btn.disabled = clicksLeft <= 0;
  updateClickCounter(device);
}

// --- Popups ---
function showDevicePopup(device, message) {
  const popup = document.getElementById(`popup-${device.button_id}`);
  const popupText = document.getElementById(`popup-text-${device.button_id}`);

  popupText.textContent = message;
  popup.style.display = "flex";
}

function closePopup(buttonId) {
  document.getElementById(`popup-${buttonId}`).style.display = "none";
}

// --- Device control ---
async function activateShelly(device) {
  if (checkTimeLimit()) return;

  let clicksLeft = getClicksLeft(device.cookie_key);
  if (clicksLeft <= 0) {
    showDevicePopup(device, "No clicks remaining for this door");
    return;
  }

  // Show loading state
  const button = document.getElementById(device.button_id);
  const originalText = button.innerHTML;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Unlocking...';
  button.disabled = true;

  try {
    // Make API call to Shelly device
    const response = await fetch(BASE_URL_SET, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        channel: "0",
        turn: "on",
        id: device.id,
        auth_key: device.auth_key,
      }),
    });

    const data = await response.json();

    if (data && data.ok) {
      // Success - door unlocked
      clicksLeft--;
      setClicksLeft(device.cookie_key, clicksLeft);
      updateButtonState(device);

      log("Success! Door unlocked", device.log_id, "success");
      showDevicePopup(device, "Door unlocked successfully!");
    } else {
      throw new Error(
        data.error ? data.error.message : "Device not responding"
      );
    }
  } catch (err) {
    log(`Error: ${err.message}`, device.log_id, "error");
    showDevicePopup(device, `Error: ${err.message}`);
  } finally {
    button.innerHTML = originalText;
    button.disabled = clicksLeft <= 0;
  }
}

// --- Logging ---
function log(msg, logElementId, type = "info") {
  const logElement = document.getElementById(logElementId);
  if (logElement) {
    logElement.textContent = msg;
    logElement.className = `log ${type}`;
  }
}

// --- Enable controls ---
function enableControls() {
  DEVICES.forEach((device) => {
    updateButtonState(device);
    document.getElementById(device.button_id).onclick = () =>
      activateShelly(device);
  });
}

// --- Code verification ---
document.getElementById("btnCheckCode").onclick = async () => {
  const insertedCode = document.getElementById("authCode").value.trim();
  if (insertedCode === CORRECT_CODE) {
    // Set start time only if not already set
    if (!getCookie("usage_start_time")) {
      setUsageStartTime();
    }

    // Immediately check if session is valid
    if (checkTimeLimit()) return;

    // Show control panel
    document.getElementById("controlPanel").style.display = "block";
    document.getElementById("authCode").value = "";
    enableControls();

    // Show success animation
    const authSection = document.querySelector(".auth-section");
    authSection.classList.add("success-bg");
    setTimeout(() => {
      authSection.classList.remove("success-bg");
    }, 1000);
  } else {
    // Show error animation
    const authSection = document.querySelector(".auth-section");
    authSection.classList.add("error-bg");
    setTimeout(() => {
      authSection.classList.remove("error-bg");
    }, 1000);

    log("Incorrect access code", "log1", "error");
  }
};

// --- Security ---
document.addEventListener("contextmenu", (e) => e.preventDefault(), false);
document.addEventListener("selectstart", (e) => e.preventDefault());

// --- Session Monitoring ---
setInterval(checkTimeLimit, 1000);

// Initialize on load
(function init() {
  // Initialize logs
  DEVICES.forEach((device) => {
    log("Status: Ready", device.log_id, "success");
  });

  // Check if session is already active
  if (getCookie("usage_start_time")) {
    if (checkTimeLimit()) return;

    document.getElementById("controlPanel").style.display = "block";
    enableControls();
    startTimer();
  }
})();
