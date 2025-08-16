// --- Configurazione ---
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
const TIME_LIMIT_MINUTES = 2; // 1 ora
const SECRET_KEY = "musart_secret_123";
let timeCheckInterval;

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

  // Aggiorna l'interfaccia
  updateStatusBar();
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

  // Aggiorna l'interfaccia
  updateStatusBar();

  return false;
}

function showFatalError(message) {
  // Rimuovi eventuali intervalli
  clearInterval(timeCheckInterval);

  // Mostra messaggio di errore
  document.body.innerHTML = `
        <div style="
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
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

// --- Aggiorna la barra di stato ---
function updateStatusBar() {
  // Aggiorna i click rimanenti
  document.getElementById("mainDoorClicks").textContent = getClicksLeft(
    DEVICES[0].storage_key
  );
  document.getElementById("aptDoorClicks").textContent = getClicksLeft(
    DEVICES[1].storage_key
  );

  // Aggiorna il tempo rimanente
  const startTime = getStorage("usage_start_time");
  if (!startTime) return;

  const now = Date.now();
  const minutesPassed = (now - parseInt(startTime, 10)) / (1000 * 60);
  const minutesLeft = Math.max(
    0,
    Math.floor(TIME_LIMIT_MINUTES - minutesPassed)
  );
  const secondsLeft = Math.max(0, Math.floor(60 - (minutesPassed % 1) * 60));

 // document.getElementById("timeRemaining").textContent = `${minutesLeft
   // .toString()
   // .padStart(2, "0")}:${secondsLeft.toString().padStart(2, "0")}`;
}

// --- Gestione click affidabile ---
function getClicksLeft(key) {
  const stored = getStorage(key);
  return stored === null ? MAX_CLICKS : parseInt(stored, 10);
}

function setClicksLeft(key, count) {
  setStorage(key, count.toString(), TIME_LIMIT_MINUTES);
  updateStatusBar(); // Aggiorna l'interfaccia
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

  const text = document.getElementById(`popup-text-${device.button_id}`);

  if (text) {
    if (clicksLeft > 0) {
      text.innerHTML = `
            <i class="fas fa-check-circle" style="color: #4CAF50; font-size: 2.5rem; margin-bottom: 15px;"></i>
            <div>You have <strong>${clicksLeft}</strong> remaining click${
        clicksLeft !== 1 ? "s" : ""
      }</div>
            <div style="margin-top: 10px; font-size: 1rem;">The door has been unlocked!</div>
          `;
    } else {
      text.innerHTML = `
            <i class="fas fa-exclamation-triangle" style="color: #FFC107; font-size: 2.5rem; margin-bottom: 15px;"></i>
            <div><strong>No clicks remaining!</strong></div>
            <div style="margin-top: 10px; font-size: 1rem;">Please contact us for assistance.</div>
          `;
    }
  }

  popup.style.display = "flex";

  // Chiudi automaticamente dopo 3 secondi se ci sono ancora click disponibili
  if (clicksLeft > 0) {
    setTimeout(() => {
      closePopup(device.button_id);
    }, 3000);
  }
}

function closePopup(buttonId) {
  const popup = document.getElementById(`popup-${buttonId}`);
  if (popup) popup.style.display = "none";
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

    // Gestione della risposta
    if (response.ok) {
      showDevicePopup(device, clicksLeft);
    } else {
      // Ripristina il click in caso di errore
      setClicksLeft(device.storage_key, clicksLeft + 1);
      updateButtonState(device);

      // Mostra messaggio di errore
      const popup = document.getElementById(`popup-${device.button_id}`);
      if (popup) {
        const text = document.getElementById(`popup-text-${device.button_id}`);
        if (text) {
          text.innerHTML = `
                <i class="fas fa-times-circle" style="color: #f44336; font-size: 2.5rem; margin-bottom: 15px;"></i>
                <div><strong>Error activating device!</strong></div>
                <div style="margin-top: 10px; font-size: 1rem;">Please try again or contact support.</div>
              `;
        }
        popup.style.display = "flex";
      }
    }
  } catch (error) {
    console.error("Device activation failed:", error);

    // Ripristina il click in caso di errore
    setClicksLeft(device.storage_key, clicksLeft + 1);
    updateButtonState(device);

    // Mostra messaggio di errore
    const popup = document.getElementById(`popup-${device.button_id}`);
    if (popup) {
      const text = document.getElementById(`popup-text-${device.button_id}`);
      if (text) {
        text.innerHTML = `
              <i class="fas fa-times-circle" style="color: #f44336; font-size: 2.5rem; margin-bottom: 15px;"></i>
              <div><strong>Connection error!</strong></div>
              <div style="margin-top: 10px; font-size: 1rem;">Please check your internet connection.</div>
            `;
      }
      popup.style.display = "flex";
    }
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

  // Setup popup close buttons
  document.querySelectorAll(".popup .btn").forEach((button) => {
    button.addEventListener("click", function () {
      const popup = this.closest(".popup");
      if (popup) {
        const id = popup.id.replace("popup-", "");
        closePopup(id);
      }
    });
  });

  // Controllo tempo iniziale
  checkTimeLimit().then((expired) => {
    if (expired) return;

    // Aggiorna stato pulsanti se il pannello è visibile
    if (document.getElementById("controlPanel").style.display === "block") {
      DEVICES.forEach(updateButtonState);
      updateStatusBar();
    }
  });

  // Controllo periodico del tempo
  timeCheckInterval = setInterval(() => {
    checkTimeLimit();
  }, 10000);

  // Blocca il menu contestuale
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // Aggiorna la barra di stato iniziale
  updateStatusBar();
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
  document.getElementById("auth-form").style.display = "none";
  document.getElementById("btnCheckCode").style.display = "none";
  document.getElementById("important").style.display = "none";
  document.getElementById("hh2").style.display = "none";

  // Aggiorna lo stato dei pulsanti
  DEVICES.forEach(updateButtonState);
  updateStatusBar();
}

// Avvia l'applicazione
document.addEventListener("DOMContentLoaded", init);
