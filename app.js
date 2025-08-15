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
const TIME_LIMIT_MINUTES = 2;
let timerInterval;

// --- DOM References ---
const timerElement = document.getElementById("session-timer");
const sessionExpiredElement = document.getElementById("session-expired");

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
function getUsageStartTime() {
  const start = getCookie("usage_start_time");
  return start ? parseInt(start, 10) : null;
}

function setUsageStartTime() {
  const now = Date.now();
  setCookie("usage_start_time", now, TIME_LIMIT_MINUTES);
  startTimer();
}

function startTimer() {
  const startTime = getUsageStartTime();
  if (!startTime) return;

  updateTimerDisplay(Date.now() - startTime);

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const start = getUsageStartTime();
    if (!start) return;

    const timePassed = Date.now() - start;
    updateTimerDisplay(timePassed);

    if (timePassed >= TIME_LIMIT_MINUTES * 60 * 1000) {
      showSessionExpired();
    }
  }, 1000);
}

function updateTimerDisplay(timePassed) {
  if (!timerElement) return;

  const timeLeftMs = TIME_LIMIT_MINUTES * 60 * 1000 - timePassed;
  if (timeLeftMs <= 0) {
    timerElement.textContent = "Session expired";
    return;
  }

  const minutesLeft = Math.floor(timeLeftMs / 60000);
  const secondsLeft = Math.floor((timeLeftMs % 60000) / 1000);

  timerElement.textContent = `Session: ${minutesLeft}m ${secondsLeft
    .toString()
    .padStart(2, "0")}s`;

  // Warning animation
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
  document.querySelector(".container").style.display = "none";
  if (sessionExpiredElement) sessionExpiredElement.style.display = "flex";
  clearInterval(timerInterval);
}

// --- Click management ---
function getClicksLeft(cookieKey) {
  const stored = getCookie(cookieKey);
  return stored === null ? MAX_CLICKS : parseInt(stored, 10);
}

function setClicksLeft(cookieKey, count) {
  setCookie(cookieKey, count, TIME_LIMIT_MINUTES);
}

function updateButtonState(device) {
  const btn = document.getElementById(device.button_id);
  const clicksLeft = getClicksLeft(device.cookie_key);

  if (btn) {
    btn.disabled = clicksLeft <= 0;
    btn.classList.toggle("pulse", clicksLeft > 0);
  }

  const counter = document.getElementById(device.counter_id);
  if (counter) counter.textContent = clicksLeft;
}

// --- Popups ---
function showDevicePopup(device, message) {
  const popup = document.getElementById(`popup-${device.button_id}`);
  const popupText = document.getElementById(`popup-text-${device.button_id}`);
  if (popup && popupText) {
    popupText.textContent = message;
    popup.style.display = "flex";
  }
}

function closePopup(buttonId) {
  const popup = document.getElementById(`popup-${buttonId}`);
  if (popup) popup.style.display = "none";
}

// --- Device control ---
async function activateShelly(device) {
  const startTime = getUsageStartTime();
  if (!startTime || Date.now() - startTime >= TIME_LIMIT_MINUTES * 60 * 1000) {
    showSessionExpired();
    return;
  }

  let clicksLeft = getClicksLeft(device.cookie_key);
  if (clicksLeft <= 0) {
    showDevicePopup(device, "No clicks remaining for this door");
    return;
  }

  const button = document.getElementById(device.button_id);
  if (!button) return;
  const originalText = button.innerHTML;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Unlocking...';
  button.disabled = true;

  try {
    const response = await fetch(BASE_URL_SET, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        channel: "0",
        turn: "on",
        id: device.id,
        auth_key: device.auth_key,
      }),
    });

    const data = await response.json();

    if (data && data.ok) {
      clicksLeft--;
      setClicksLeft(device.cookie_key, clicksLeft);
      updateButtonState(device);
      log("Success! Door unlocked", device.log_id, "success");
      showDevicePopup(device, "Door unlocked successfully!");
    } else {
      throw new Error(data.error?.message || "Device not responding");
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
    const btn = document.getElementById(device.button_id);
    if (btn) btn.onclick = () => activateShelly(device);
  });
}

// --- Code verification ---
document.getElementById("btnCheckCode").onclick = () => {
  const codeInput = document.getElementById("authCode");
  const code = codeInput.value.trim();
  const authSection = document.querySelector(".auth-section");

  if (code === CORRECT_CODE) {
    if (!getUsageStartTime()) setUsageStartTime();
    if (
      getUsageStartTime() &&
      Date.now() - getUsageStartTime() < TIME_LIMIT_MINUTES * 60 * 1000
    ) {
      document.getElementById("controlPanel").style.display = "block";
      enableControls();
      startTimer();
    }

    authSection.classList.add("success-bg");
    setTimeout(() => authSection.classList.remove("success-bg"), 1000);
    codeInput.value = "";
  } else {
    authSection.classList.add("error-bg");
    setTimeout(() => authSection.classList.remove("error-bg"), 1000);
    log("Incorrect access code", "log1", "error");
  }
};

// --- Security ---
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("selectstart", (e) => e.preventDefault());

// --- Initialize ---
(function init() {
  DEVICES.forEach((device) => log("Status: Ready", device.log_id, "success"));

  const startTime = getUsageStartTime();
  if (startTime && Date.now() - startTime < TIME_LIMIT_MINUTES * 60 * 1000) {
    document.getElementById("controlPanel").style.display = "block";
    enableControls();
    startTimer();
  }
})();
