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
const TIME_LIMIT_MINUTES = 900;
const SECRET_KEY = "musart_secret_123_fixed_key";
let timeCheckInterval;

// --- Funzioni di storage affidabili ---
function setStorage(key, value, minutes) {
  try {
    localStorage.setItem(key, value);
    const d = new Date();
    d.setTime(d.getTime() + minutes * 60 * 1000);
    const expires = "expires=" + d.toUTCString();
    document.cookie = `${key}=${value}; ${expires}; path=/; SameSite=Strict`;
  } catch (e) {
    console.error("Storage error:", e);
  }
}

function getStorage(key) {
  try {
    const localValue = localStorage.getItem(key);
    if (localValue !== null) return localValue;

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

function clearStorage(key) {
  try {
    localStorage.removeItem(key);
    document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  } catch (e) {
    console.error("Storage clear error:", e);
  }
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

  updateStatusBar();
}

async function checkTimeLimit() {
  const startTime = getStorage("usage_start_time");
  const storedHash = getStorage("usage_hash");

  // Se non c'è un timestamp salvato, non c'è sessione attiva
  if (!startTime || !storedHash) return false;

  const calcHash = await generateHash(startTime + SECRET_KEY);
  if (calcHash !== storedHash) {
    showFatalError("⚠️ Violazione di sicurezza rilevata!");
    return true;
  }

  const now = Date.now();
  const minutesPassed = (now - parseInt(startTime, 10)) / (1000 * 60);

  if (minutesPassed >= TIME_LIMIT_MINUTES) {
    showSessionExpired();
    return true;
  }

  updateStatusBar();
  return false;
}

function showFatalError(message) {
  clearInterval(timeCheckInterval);
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

function showSessionExpired() {
  clearInterval(timeCheckInterval);

  // Mostra overlay a schermo intero
  document.getElementById("expiredOverlay").classList.remove("hidden");

  // Nascondi pannello di controllo e mostra messaggio di sessione scaduta
  document.getElementById("controlPanel").classList.add("hidden");
  document.getElementById("sessionExpired").classList.remove("hidden");

  // Disabilita tutti i pulsanti
  DEVICES.forEach((device) => {
    const btn = document.getElementById(device.button_id);
    if (btn) {
      btn.disabled = true;
      btn.classList.add("btn-error");
    }
  });
}

// --- Aggiorna la barra di stato ---
function updateStatusBar() {
  // Aggiorna i contatori visivi se gli elementi esistono
  const mainDoorCounter = document.getElementById("mainDoorCounter");
  const aptDoorCounter = document.getElementById("aptDoorCounter");
  const timeRemaining = document.getElementById("timeRemaining");

  if (mainDoorCounter) {
    mainDoorCounter.textContent = `${getClicksLeft(
      DEVICES[0].storage_key
    )} click left`;
  }
  if (aptDoorCounter) {
    aptDoorCounter.textContent = `${getClicksLeft(
      DEVICES[1].storage_key
    )} click left`;
  }

  const startTime = getStorage("usage_start_time");
  if (!startTime || !timeRemaining) return;

  const now = Date.now();
  const minutesPassed = (now - parseInt(startTime, 10)) / (1000 * 60);
  const minutesLeft = Math.max(
    0,
    Math.floor(TIME_LIMIT_MINUTES - minutesPassed)
  );
  const secondsLeft = Math.max(0, Math.floor(60 - (minutesPassed % 1) * 60));

  timeRemaining.textContent = `${minutesLeft
    .toString()
    .padStart(2, "0")}:${secondsLeft.toString().padStart(2, "0")}`;

  // Cambia colore in base al tempo rimanente
  if (minutesLeft < 1) {
    timeRemaining.style.color = "var(--error)";
  } else if (minutesLeft < 5) {
    timeRemaining.style.color = "var(--warning)";
  } else {
    timeRemaining.style.color = "var(--primary)";
  }
}

// --- Gestione click affidabile ---
function getClicksLeft(key) {
  const stored = getStorage(key);
  return stored === null ? MAX_CLICKS : parseInt(stored, 10);
}

function setClicksLeft(key, count) {
  setStorage(key, count.toString(), TIME_LIMIT_MINUTES);
  updateStatusBar();
}

function updateButtonState(device) {
  const btn = document.getElementById(device.button_id);
  if (!btn) return;

  const clicksLeft = getClicksLeft(device.storage_key);
  btn.disabled = clicksLeft <= 0;

  // Aggiorna stile in base allo stato
  if (clicksLeft <= 0) {
    btn.classList.add("btn-error");
    btn.classList.remove("btn-success");
  } else {
    btn.classList.add("btn-success");
    btn.classList.remove("btn-error");
  }
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
                    <div><strong>${clicksLeft}</strong> Click Left</div>
                    <div style="margin-top: 10px; font-size: 1rem;"> Door Unlocked!</div>
                  `;
    } else {
      text.innerHTML = `
                    <i class="fas fa-exclamation-triangle" style="color: #FFC107; font-size: 2.5rem; margin-bottom: 15px;"></i>
                    <div><strong> No more cliks left!</strong></div>
                    <div style="margin-top: 10px; font-size: 1rem;"> Contact for Assistance.</div>
                  `;
    }
  }

  popup.style.display = "flex";

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
  // Controlla se è il primo click e imposta il tempo iniziale
  const startTime = getStorage("usage_start_time");
  if (!startTime) {
    await setUsageStartTime();
  }

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

    if (response.ok) {
      showDevicePopup(device, clicksLeft);
    } else {
      setClicksLeft(device.storage_key, clicksLeft + 1);
      updateButtonState(device);

      const popup = document.getElementById(`popup-${device.button_id}`);
      if (popup) {
        const text = document.getElementById(`popup-text-${device.button_id}`);
        if (text) {
          text.innerHTML = `
                        <i class="fas fa-times-circle" style="color: #f44336; font-size: 2.5rem; margin-bottom: 15px;"></i>
                        <div><strong>Errore nell'attivazione!</strong></div>
                        <div style="margin-top: 10px; font-size: 1rem;">Riprova o contatta l'assistenza.</div>
                      `;
        }
        popup.style.display = "flex";
      }
    }
  } catch (error) {
    console.error("Device activation failed:", error);

    setClicksLeft(device.storage_key, clicksLeft + 1);
    updateButtonState(device);

    const popup = document.getElementById(`popup-${device.button_id}`);
    if (popup) {
      const text = document.getElementById(`popup-text-${device.button_id}`);
      if (text) {
        text.innerHTML = `
                      <i class="fas fa-times-circle" style="color: #f44336; font-size: 2.5rem; margin-bottom: 15px;"></i>
                      <div><strong>Errore di connessione!</strong></div>
                      <div style="margin-top: 10px; font-size: 1rem;">Controlla la tua connessione internet.</div>
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

  // Controllo stato iniziale - MODIFICATO per mantenere lo stato dopo refresh
  const startTime = getStorage("usage_start_time");
  const authValid = getStorage("auth_valid");

  // Se c'è una sessione attiva O l'utente era autenticato, mostra il pannello
  if (startTime || authValid === "true") {
    document.getElementById("controlPanel").style.display = "block";
    document.getElementById("authCode").style.display = "none";
    document.getElementById("auth-form").style.display = "none";
    document.getElementById("btnCheckCode").style.display = "none";
    document.getElementById("important").style.display = "none";
    document.getElementById("hh2").style.display = "none";

    DEVICES.forEach(updateButtonState);
    updateStatusBar();
  }

  // Controllo tempo iniziale
  checkTimeLimit().then((expired) => {
    if (expired) return;
  });

  // Controllo periodico del tempo
  timeCheckInterval = setInterval(() => {
    checkTimeLimit();
  }, 1000);

  // Blocca il menu contestuale
  document.addEventListener("contextmenu", (e) => e.preventDefault());
}

// --- Gestione codice di accesso ---
async function handleCodeSubmit() {
  const insertedCode = document.getElementById("authCode").value.trim();
  if (insertedCode !== CORRECT_CODE) {
    alert("Codice errato! Riprova.");
    return;
  }

  // Salva il flag di autenticazione valida
  setStorage("auth_valid", "true", TIME_LIMIT_MINUTES);

  document.getElementById("controlPanel").style.display = "block";
  document.getElementById("authCode").style.display = "none";
  document.getElementById("auth-form").style.display = "none";
  document.getElementById("btnCheckCode").style.display = "none";
  document.getElementById("important").style.display = "none";
  document.getElementById("hh2").style.display = "none";

  DEVICES.forEach(updateButtonState);
  updateStatusBar();
}

// Avvia l'applicazione
document.addEventListener("DOMContentLoaded", init);
