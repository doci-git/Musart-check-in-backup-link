// --- Configurazione migliorata ---
const DEVICES = [
  {
    id: "e4b063f0c38c",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    storage_key: "clicks_MainDoor",
    button_id: "MainDoor",
  },
  {
    id: "34945478d595",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    storage_key: "clicks_AptDoor",
    button_id: "AptDoor",
  },
];

const MAX_CLICKS = 3;
const BASE_URL_SET =
  "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";
const CORRECT_CODE = "2245";
const TIME_LIMIT_MINUTES = 3;
const SECRET_KEY = "musart_secret_123";

// --- Funzioni di storage affidabili ---
function setStorage(key, value, minutes) {
  try {
    // Salva in localStorage
    localStorage.setItem(key, value);

    // Salva in cookie come fallback
    const d = new Date();
    d.setTime(d.getTime() + minutes * 60 * 1000);
    const expires = "expires=" + d.toUTCString();
    document.cookie = `${key}=${value}; ${expires}; path=/; SameSite=Lax`;
  } catch (e) {
    console.error("Storage error:", e);
  }
}

function getStorage(key) {
  try {
    // Prova prima con localStorage
    const localValue = localStorage.getItem(key);
    if (localValue !== null) return localValue;

    // Fallback ai cookie
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === key) return value;
    }
  } catch (e) {
    console.error("Storage read error:", e);
  }
  return null;
}

// --- Funzioni di sicurezza ---
async function generateHash(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Gestione tempo migliorata ---
async function setUsageStartTime() {
  const now = Date.now().toString();
  const hash = await generateHash(now + SECRET_KEY);

  setStorage("usage_start_time", now, TIME_LIMIT_MINUTES);
  setStorage("usage_hash", hash, TIME_LIMIT_MINUTES);
}

async function checkTimeLimit() {
  const startTime = getStorage("usage_start_time");
  const storedHash = getStorage("usage_hash");

  if (!startTime || !storedHash) return false;

  // Verifica integrità
  const calcHash = await generateHash(startTime + SECRET_KEY);
  if (calcHash !== storedHash) {
    showFatalError("⚠️ Security violation detected!");
    return true;
  }

  const now = Date.now();
  const minutesPassed = (now - parseInt(startTime, 10)) / (1000 * 60);

  if (minutesPassed >= TIME_LIMIT_MINUTES) {
    showFatalError("⏰ Session expired! Please request a new code.");
    return true;
  }

  return false;
}

function showFatalError(message) {
  // Rimuovi eventuali intervalli
  clearInterval(window.timeCheckInterval);

  // Mostra messaggio di errore
  document.body.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #121111;
      color: #ff6b6b;
      font-size: 24px;
      text-align: center;
      padding: 20px;
      z-index: 9999;
    ">
      ${message}
    </div>
  `;
}

// --- Gestione click affidabile ---
function getClicksLeft(key) {
  const stored = getStorage(key);
  return stored === null ? MAX_CLICKS : parseInt(stored, 10);
}

function setClicksLeft(key, count) {
  setStorage(key, count.toString(), TIME_LIMIT_MINUTES);
}

function updateButtonState(device) {
  const btn = document.getElementById(device.button_id);
  if (!btn) return;

  const clicksLeft = getClicksLeft(device.storage_key);
  btn.disabled = clicksLeft <= 0;
}

// --- Gestione popup corretta ---
function showDevicePopup(device, clicksLeft) {
  const popup = document.getElementById(`popup-${device.button_id}`);
  if (!popup) return;

  const title = document.getElementById(`popup-title-${device.button_id}`);
  const text = document.getElementById(`popup-text-${device.button_id}`);

  if (title)
    title.textContent =
      device.button_id === "MainDoor" ? "Main Door" : "Apartment Door";

  if (text)
    text.textContent =
      clicksLeft > 0
        ? `You have ${clicksLeft} remaining click${
            clicksLeft !== 1 ? "s" : ""
          }.`
        : "No clicks remaining. Please contact us.";

  popup.classList.add("active");
}

function closePopup(buttonId) {
  const popup = document.getElementById(`popup-${buttonId}`);
  if (popup) popup.classList.remove("active");
}

// --- Attivazione dispositivo con gestione errori ---
async function activateDevice(device) {
  if (await checkTimeLimit()) return;

  let clicksLeft = getClicksLeft(device.storage_key);
  if (clicksLeft <= 0) {
    showDevicePopup(device, clicksLeft);
    updateButtonState(device);
    return;
  }

  clicksLeft--;
  setClicksLeft(device.storage_key, clicksLeft);
  updateButtonState(device);
  showDevicePopup(device, clicksLeft);

  try {
    const response = await fetch(BASE_URL_SET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: device.id,
        auth_key: device.auth_key,
        channel: 0,
        on: true,
        turn: "on",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      console.error("Device API error:", data.error);
    }
  } catch (error) {
    console.error("Device activation failed:", error);
  }
}

// --- Inizializzazione migliorata ---
function init() {
  // Setup event listeners
  document
    .getElementById("btnCheckCode")
    .addEventListener("click", handleCodeSubmit);

  // Setup device buttons
  DEVICES.forEach((device) => {
    const btn = document.getElementById(device.button_id);
    if (btn) {
      btn.addEventListener("click", () => activateDevice(device));
    }
  });

  // Controllo tempo iniziale
  checkTimeLimit().then((expired) => {
    if (expired) return;

    // Aggiorna stato pulsanti se il pannello è visibile
    if (document.getElementById("controlPanel").style.display === "block") {
      DEVICES.forEach(updateButtonState);
    }
  });

  // Controllo periodico del tempo
  window.timeCheckInterval = setInterval(() => {
    checkTimeLimit().then((expired) => {
      if (expired) clearInterval(window.timeCheckInterval);
    });
  }, 10000);

  // Blocca il menu contestuale
  document.addEventListener("contextmenu", (e) => e.preventDefault());
}

// --- Gestione codice di accesso ---
async function handleCodeSubmit() {
  const insertedCode = document.getElementById("authCode").value.trim();
  if (insertedCode !== CORRECT_CODE) {
    alert("Incorrect code! Please try again.");
    return;
  }

  await setUsageStartTime();

  if (await checkTimeLimit()) return;

  // Mostra il pannello di controllo
  document.getElementById("controlPanel").style.display = "block";
  document.getElementById("authCode").style.display = "none";
  document.getElementById("authCodeh3").style.display = "none";
  document.getElementById("btnCheckCode").style.display = "none";
  document.getElementById("important").style.display = "none";

  // Aggiorna lo stato dei pulsanti
  DEVICES.forEach(updateButtonState);
}

// Avvia l'applicazione
document.addEventListener("DOMContentLoaded", init);
