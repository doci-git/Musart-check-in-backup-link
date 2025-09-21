// Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCuy3Sak96soCla7b5Yb5wmkdVfMqAXmok",
  authDomain: "check-in-4e0e9.firebaseapp.com",
  databaseURL:
    "https://check-in-4e0e9-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "check-in-4e0e9",
  storageBucket: "check-in-4e0e9.firebasestorage.app",
  messagingSenderId: "723880990177",
  appId: "1:723880990177:web:f002733b2cc2e50d172ea0",
  measurementId: "G-H97GB9L4F5",
};

// Inizializza Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Variabile per tracciare la sessione token
let isTokenSession = false;
let currentTokenId = null;

const DEVICES = [
  {
    id: "e4b063f0c38c",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    storage_key: "clicks_MainDoor",
    button_id: "MainDoor",
    visible: true,
  },
  {
    id: "34945478d595",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    storage_key: "clicks_AptDoor",
    button_id: "AptDoor",
    visible: true,
  },
  {
    id: "3494547ab161",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    storage_key: "clicks_ExtraDoor1",
    button_id: "ExtraDoor1",
    visible: false,
  },
  {
    id: "placeholder_id_2",
    auth_key: "placeholder_auth_key_2",
    storage_key: "clicks_ExtraDoor2",
    button_id: "ExtraDoor2",
    visible: false,
  },
];

// Configurazioni con valori di default
let MAX_CLICKS = parseInt(localStorage.getItem("max_clicks")) || 3;
let TIME_LIMIT_MINUTES =
  parseInt(localStorage.getItem("time_limit_minutes")) || 50000;
const BASE_URL_SET =
  "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";
let CORRECT_CODE = localStorage.getItem("secret_code") || "";
const SECRET_KEY = "musart_secret_123_fixed_key";

// Variabili per l'orario di check-in (range)
let CHECKIN_START_TIME = localStorage.getItem("checkin_start_time") || "14:00";
let CHECKIN_END_TIME = localStorage.getItem("checkin_end_time") || "22:00";
let CHECKIN_TIME_ENABLED = localStorage.getItem("checkin_time_enabled");
if (CHECKIN_TIME_ENABLED === null) {
  CHECKIN_TIME_ENABLED = true;
} else {
  CHECKIN_TIME_ENABLED = CHECKIN_TIME_ENABLED === "true";
}

// Variabili di stato
let timeCheckInterval;
let codeCheckInterval;
let currentDevice = null;

// Gestione versione codice per forzare il reset alla modifica
const CODE_VERSION_KEY = "code_version";
let currentCodeVersion = parseInt(localStorage.getItem(CODE_VERSION_KEY)) || 1;

// =============================================
// FUNZIONI DI STORAGE (localStorage e cookie)
// =============================================

function setStorage(key, value, minutes) {
  try {
    localStorage.setItem(key, value);
    const expirationDate = new Date();
    expirationDate.setTime(expirationDate.getTime() + minutes * 60 * 1000);
    const expires = "expires=" + expirationDate.toUTCString();
    document.cookie = `${key}=${value}; ${expires}; path=/; SameSite=Strict`;
  } catch (error) {
    console.error("Errore nel salvataggio dei dati:", error);
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
  } catch (error) {
    console.error("Errore nel recupero dei dati:", error);
  }
  return null;
}

function clearStorage(key) {
  try {
    localStorage.removeItem(key);
    document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  } catch (error) {
    console.error("Errore nella rimozione dei dati:", error);
  }
}

// =============================================
// FUNZIONI DI SICUREZZA E CRITTOGRAFIA
// =============================================

async function generateHash(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// =============================================
// GESTIONE TEMPO E SESSIONE
// =============================================

async function setUsageStartTime() {
  const now = Date.now().toString();
  const hash = await generateHash(now + SECRET_KEY);
  setStorage("usage_start_time", now, TIME_LIMIT_MINUTES);
  setStorage("usage_hash", hash, TIME_LIMIT_MINUTES);
  updateStatusBar();
}

async function checkTimeLimit() {
  // Se è una sessione token, non controllare il limite di tempo globale
  if (isTokenSession) {
    return false;
  }

  const startTime = getStorage("usage_start_time");
  const storedHash = getStorage("usage_hash");

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
  clearInterval(codeCheckInterval);
  document.body.innerHTML = `
        <div style="
          position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
          display: flex; justify-content: center; align-items: center;
          background: #121111; color: #ff6b6b; font-size: 24px; text-align: center;
          padding: 20px; z-index: 9999;">
          ${message}
        </div>`;
}

function showSessionExpired() {
  // Se è una sessione token, usa la gestione specifica già implementata
  if (isTokenSession) {
    return;
  }

  // Altrimenti, usa la gestione tradizionale per sessioni normali
  clearInterval(timeCheckInterval);
  clearInterval(codeCheckInterval);

  document.getElementById("expiredOverlay").classList.remove("hidden");
  document.getElementById("controlPanel").classList.add("hidden");
  document.getElementById("sessionExpired").classList.remove("hidden");
  document.getElementById("test2").style.display = "none";

  DEVICES.forEach((device) => {
    const btn = document.getElementById(device.button_id);
    if (btn) {
      btn.disabled = true;
      btn.classList.add("btn-error");
    }
  });

  const securityStatus = document.getElementById("securityStatus");
  if (securityStatus) {
    securityStatus.textContent = "Scaduta";
    securityStatus.style.color = "var(--error)";
  }
}

// =============================================
// GESTIONE ORARIO DI CHECK-IN (RANGE)
// =============================================

function isCheckinTime() {
  if (!CHECKIN_TIME_ENABLED) return true;

  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeInMinutes = currentHours * 60 + currentMinutes;

  const [startHours, startMinutes] = CHECKIN_START_TIME.split(":").map(Number);
  const [endHours, endMinutes] = CHECKIN_END_TIME.split(":").map(Number);

  const startTimeInMinutes = startHours * 60 + startMinutes;
  const endTimeInMinutes = endHours * 60 + endMinutes;

  return (
    currentTimeInMinutes >= startTimeInMinutes &&
    currentTimeInMinutes <= endTimeInMinutes
  );
}

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(":");
  return `${hours}:${minutes}`;
}

function updateCheckinTimeDisplay() {
  const startEl = document.getElementById("checkinStartDisplay");
  const endEl = document.getElementById("checkinEndDisplay");
  const startPopup = document.getElementById("checkinStartPopup");
  const endPopup = document.getElementById("checkinEndPopup");
  const currentStart = document.getElementById("currentCheckinStartTime");
  const currentEnd = document.getElementById("currentCheckinEndTime");

  if (startEl) startEl.textContent = formatTime(CHECKIN_START_TIME);
  if (endEl) endEl.textContent = formatTime(CHECKIN_END_TIME);
  if (startPopup) startPopup.textContent = formatTime(CHECKIN_START_TIME);
  if (endPopup) endPopup.textContent = formatTime(CHECKIN_END_TIME);
  if (currentStart) currentStart.textContent = formatTime(CHECKIN_START_TIME);
  if (currentEnd) currentEnd.textContent = formatTime(CHECKIN_END_TIME);

  const statusElement = document.getElementById("currentTimeStatus");
  if (statusElement) {
    if (!CHECKIN_TIME_ENABLED) {
      statusElement.innerHTML =
        '<i class="fas fa-power-off" style="color:orange;"></i> Time control disabled — check-in allowed at any time';
    } else if (isCheckinTime()) {
      statusElement.innerHTML =
        '<i class="fas fa-check-circle" style="color:green;"></i> Check-in now available';
    } else {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeInMinutes = currentHours * 60 + currentMinutes;

      const [startHours, startMinutes] =
        CHECKIN_START_TIME.split(":").map(Number);
      const [endHours, endMinutes] = CHECKIN_END_TIME.split(":").map(Number);

      const startTimeInMinutes = startHours * 60 + startMinutes;
      const endTimeInMinutes = endHours * 60 + endMinutes;

      if (currentTimeInMinutes < startTimeInMinutes) {
        const timeDiff = startTimeInMinutes - currentTimeInMinutes;
        const hoursLeft = Math.floor(timeDiff / 60);
        const minutesLeft = timeDiff % 60;

        statusElement.innerHTML = `<i class="fas fa-clock" style="color:orange;"></i> Check-in will be available in ${hoursLeft}h ${minutesLeft}m`;
      } else {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(startHours, startMinutes, 0, 0);

        const timeDiff = tomorrow - now;
        const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesLeft = Math.floor(
          (timeDiff % (1000 * 60 * 60)) / (1000 * 60)
        );

        statusElement.innerHTML = `<i class="fas fa-clock" style="color:orange;"></i> Check-in will be available tomorrow in ${hoursLeft}h ${minutesLeft}m`;
      }
    }
  }
}

function showEarlyCheckinPopup() {
  document.getElementById("earlyCheckinPopup").style.display = "flex";
}

function closeEarlyCheckinPopup() {
  document.getElementById("earlyCheckinPopup").style.display = "none";
}

// =============================================
// GESTIONE INTERFACCIA E STATO
// =============================================

function updateStatusBar() {
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

  if (minutesLeft < 1) {
    timeRemaining.style.color = "var(--error)";
  } else if (minutesLeft < 5) {
    timeRemaining.style.color = "var(--warning)";
  } else {
    timeRemaining.style.color = "var(--primary)";
  }
}

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
  btn.disabled = clicksLeft <= 0 || !isCheckinTime();

  if (clicksLeft <= 0) {
    btn.classList.add("btn-error");
    btn.classList.remove("btn-success");
  } else if (!isCheckinTime()) {
    btn.classList.remove("btn-error", "btn-success");
  } else {
    btn.classList.add("btn-success");
    btn.classList.remove("btn-error");
  }
}

function updateDoorVisibility() {
  DEVICES.forEach((device) => {
    const container = document.getElementById(`${device.button_id}Container`);
    if (container) {
      container.style.display = device.visible ? "block" : "none";
    }
  });
}

// =============================================
// GESTIONE CAMBIAMENTO CODICE
// =============================================

function setupCodeChangeListener() {
  // Controlla periodicamente se il codice è cambiato
  codeCheckInterval = setInterval(() => {
    checkCodeVersion();
  }, 2000);

  // Ascolta anche gli eventi di storage (per cambiamenti tra tab)
  window.addEventListener("storage", function (e) {
    if (e.key === "code_version" || e.key === "last_code_update") {
      checkCodeVersion();
    }
  });
}

function checkCodeVersion() {
  const savedVersion = parseInt(localStorage.getItem("code_version")) || 1;
  if (savedVersion > currentCodeVersion) {
    // Il codice è cambiato, resetta tutto
    currentCodeVersion = savedVersion;
    CORRECT_CODE = localStorage.getItem("secret_code") || "2245";

    clearStorage("usage_start_time");
    clearStorage("usage_hash");
    DEVICES.forEach((device) => {
      clearStorage(device.storage_key);
    });

    document.getElementById("controlPanel").style.display = "none";
    document.getElementById("authCode").style.display = "block";
    document.getElementById("auth-form").style.display = "block";
    document.getElementById("btnCheckCode").style.display = "block";
    document.getElementById("important").style.display = "block";

    // Mostra una notifica
    showNotification(
      "Il codice di accesso è stato aggiornato. Inserisci il nuovo codice."
    );
  }
}

function showNotification(message) {
  // Rimuovi notifiche precedenti
  const existingNotification = document.getElementById(
    "codeChangeNotification"
  );
  if (existingNotification) {
    existingNotification.remove();
  }

  // Crea una nuova notifica
  const notification = document.createElement("div");
  notification.id = "codeChangeNotification";
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #FF5A5F;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  notification.innerHTML = `
    <i class="fas fa-info-circle"></i>
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none; border:none; color:white; margin-left:10px; cursor:pointer;">
      <i class="fas fa-times"></i>
    </button>
  `;

  document.body.appendChild(notification);

  // Rimuovi automaticamente dopo 5 secondi
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// =============================================
// GESTIONE POPUP E INTERAZIONI
// =============================================

function showConfirmationPopup(device) {
  if (!isCheckinTime()) {
    showEarlyCheckinPopup();
    return;
  }

  currentDevice = device;
  const doorName = device.button_id
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());

  document.getElementById(
    "confirmationMessage"
  ).textContent = `Are you sure you want to unlock the ${doorName}?`;
  document.getElementById("confirmationPopup").style.display = "flex";
}

function closeConfirmationPopup() {
  document.getElementById("confirmationPopup").style.display = "none";
  currentDevice = null;
}

function showDevicePopup(device, clicksLeft) {
  const popup = document.getElementById(`popup-${device.button_id}`);
  if (!popup) {
    console.error(`Popup per ${device.button_id} non trovato`);
    return;
  }

  const text = document.getElementById(`popup-text-${device.button_id}`);
  if (text) {
    if (clicksLeft > 0) {
      text.innerHTML = `
                    <i class="fas fa-check-circle" style="color:#4CAF50;font-size:2.5rem;margin-bottom:15px;"></i>
                    <div><strong>${clicksLeft}</strong> Click Left</div>
                    <div style="margin-top:10px;font-size:1rem;">Door Unlocked!</div>`;
    } else {
      text.innerHTML = `
                    <i class="fas fa-exclamation-triangle" style="color:#FFC107;font-size:2.5rem;margin-bottom:15px;"></i>
                    <div><strong>No more clicks left!</strong></div>
                    <div style="margin-top:10px;font-size:1rem;">Contact for Assistance.</div>`;
    }
  }

  popup.style.display = "flex";
  if (clicksLeft > 0) setTimeout(() => closePopup(device.button_id), 3000);
}

function closePopup(buttonId) {
  const popup = document.getElementById(`popup-${buttonId}`);
  if (popup) popup.style.display = "none";
}

// =============================================
// COMUNICAZIONE CON DISPOSITIVI SHELLY
// =============================================

async function activateDevice(device) {
  if (await checkTimeLimit()) return;

  if (!isCheckinTime()) {
    showEarlyCheckinPopup();
    return;
  }

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
      console.error(
        "Errore nell'attivazione del dispositivo:",
        response.statusText
      );
    }
  } catch (error) {
    console.error("Attivazione dispositivo fallita:", error);
    setClicksLeft(device.storage_key, clicksLeft + 1);
    updateButtonState(device);
  }
}

async function updateGlobalCodeVersion() {
  const savedVersion = parseInt(localStorage.getItem(CODE_VERSION_KEY)) || 1;
  if (savedVersion < currentCodeVersion) {
    localStorage.setItem(CODE_VERSION_KEY, currentCodeVersion.toString());

    clearStorage("usage_start_time");
    clearStorage("usage_hash");
    DEVICES.forEach((device) => {
      clearStorage(device.storage_key);
    });

    document.getElementById("controlPanel").style.display = "none";
    document.getElementById("authCode").style.display = "block";
    document.getElementById("auth-form").style.display = "block";
    document.getElementById("btnCheckCode").style.display = "block";
    document.getElementById("important").style.display = "block";

    return true;
  }
  return false;
}

// =============================================
// AUTENTICAZIONE UTENTE
// =============================================

async function handleCodeSubmit() {
  const insertedCode = document.getElementById("authCode").value.trim();
  if (insertedCode !== CORRECT_CODE) {
    alert("Codice errato! Riprova.");
    return;
  }

  await setUsageStartTime();
  if (await checkTimeLimit()) return;

  document.getElementById("controlPanel").style.display = "block";
  document.getElementById("authCode").style.display = "none";
  document.getElementById("auth-form").style.display = "none";
  document.getElementById("btnCheckCode").style.display = "none";
  document.getElementById("important").style.display = "none";

  document.getElementById("checkinTimeInfo").style.display = "block";
  updateCheckinTimeDisplay();

  DEVICES.forEach(updateButtonState);
  updateStatusBar();
}

// Funzione per verificare e gestire i token
async function handleSecureToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  if (!token) {
    // Sessione normale - nessun token
    isTokenSession = false;
    return false;
  }

  try {
    // Verifica il token su Firebase
    const snapshot = await database.ref("secure_links/" + token).once("value");

    if (!snapshot.exists()) {
      showTokenError("Token non valido");
      cleanUrl();
      return false;
    }

    const linkData = snapshot.val();
    const isValid = validateSecureToken(linkData);

    if (!isValid.valid) {
      showTokenError(isValid.reason);
      cleanUrl();
      return false;
    }

    // Token valido - imposta sessione token
    isTokenSession = true;
    currentTokenId = token;

    // Compila automaticamente il codice
    const authCodeInput = document.getElementById("authCode");
    if (authCodeInput) {
      const codeSnapshot = await database
        .ref("settings/secret_code")
        .once("value");
      const currentCode = codeSnapshot.val() || "2245";
      authCodeInput.value = currentCode;

      // Mostra notifica
      showTokenNotification(isValid.remainingUses);

      // Incrementa il contatore di utilizzi
      await incrementTokenUsage(token, linkData);

      // Pulisci l'URL
      cleanUrl();

      // Avvia il controllo di scadenza per il token
      startTokenExpirationCheck(linkData.expiration);

      return true;
    }
  } catch (error) {
    console.error("Errore nella verifica del token:", error);
    showTokenError("Errore di verifica");
    cleanUrl();
  }

  return false;
}

// Verifica la validità del token
function validateSecureToken(linkData) {
  try {
    if (!linkData) {
      return { valid: false, reason: "Token non valido" };
    }

    if (linkData.status !== "active") {
      return { valid: false, reason: "Token revocato" };
    }

    if (linkData.expiration < Date.now()) {
      return { valid: false, reason: "Token scaduto" };
    }

    if (linkData.usedCount >= linkData.maxUsage) {
      return { valid: false, reason: "Utilizzi esauriti" };
    }

    const remainingUses = linkData.maxUsage - linkData.usedCount;
    return { valid: true, remainingUses: remainingUses };
  } catch (error) {
    return { valid: false, reason: "Errore di verifica" };
  }
}

// Incrementa il contatore di utilizzi
async function incrementTokenUsage(token, linkData) {
  const newUsedCount = linkData.usedCount + 1;
  let newStatus = "active";

  // Se raggiunge il massimo, marca come utilizzato
  if (newUsedCount >= linkData.maxUsage) {
    newStatus = "used";
  }

  try {
    // Aggiorna su Firebase
    await database.ref("secure_links/" + token).update({
      usedCount: newUsedCount,
      status: newStatus,
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento del token:", error);
  }
}

// Mostra notifica di token valido
function showTokenNotification(remainingUses) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--success);
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 300px;
  `;

  notification.innerHTML = `
    <i class="fas fa-check-circle"></i>
    <div>
      <div>Accesso autorizzato tramite link sicuro</div>
      <div style="font-size: 12px; opacity: 0.9;">Utilizzi rimanenti: ${remainingUses}</div>
    </div>
    <button onclick="this.parentElement.remove()" style="
      background: none;
      border: none;
      color: white;
      margin-left: 10px;
      cursor: pointer;
    ">
      <i class="fas fa-times"></i>
    </button>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// Mostra errore token
function showTokenError(reason) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--error);
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 300px;
  `;

  notification.innerHTML = `
    <i class="fas fa-exclamation-triangle"></i>
    <div>
      <div>Link non valido</div>
      <div style="font-size: 12px; opacity: 0.9;">Motivo: ${reason}</div>
    </div>
    <button onclick="this.parentElement.remove()" style="
      background: none;
      border: none;
      color: white;
      margin-left: 10px;
      cursor: pointer;
    ">
      <i class="fas fa-times"></i>
    </button>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

function cleanUrl() {
  if (window.history.replaceState) {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}

// Avvia il controllo di scadenza per il token
function startTokenExpirationCheck(expirationTime) {
  const checkTokenExpiration = setInterval(() => {
    if (Date.now() > expirationTime) {
      clearInterval(checkTokenExpiration);
      if (isTokenSession) {
        showSessionExpired();
      }
    }
  }, 1000); // Controlla ogni secondo
}

// Funzione per caricare le impostazioni da Firebase
async function loadSettingsFromFirebase() {
  try {
    const snapshot = await database.ref("settings").once("value");
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (error) {
    console.error(
      "Errore nel caricamento delle impostazioni da Firebase:",
      error
    );
    return null;
  }
}

// Funzione per verificare aggiornamenti delle impostazioni
function setupSettingsListener() {
  database.ref("settings").on("value", (snapshot) => {
    if (snapshot.exists()) {
      const settings = snapshot.val();

      // Aggiorna le variabili globali
      if (settings.secret_code) {
        CORRECT_CODE = settings.secret_code;
        localStorage.setItem("secret_code", settings.secret_code);
      }

      if (settings.max_clicks) {
        MAX_CLICKS = parseInt(settings.max_clicks);
        localStorage.setItem("max_clicks", settings.max_clicks);
      }

      if (settings.time_limit_minutes) {
        TIME_LIMIT_MINUTES = parseInt(settings.time_limit_minutes);
        localStorage.setItem("time_limit_minutes", settings.time_limit_minutes);
      }

      if (settings.code_version) {
        const savedVersion = parseInt(settings.code_version);
        if (savedVersion > currentCodeVersion) {
          checkCodeVersion();
        }
      }

      updateStatusBar();
      DEVICES.forEach(updateButtonState);
    }
  });
}

// Verifica lo stato della connessione Firebase
function monitorFirebaseConnection() {
  const connectedRef = database.ref(".info/connected");
  connectedRef.on("value", (snap) => {
    if (snap.val() === true) {
      console.log("Connesso a Firebase");
      document.body.classList.remove("firebase-offline");
    } else {
      console.log("Non connesso a Firebase");
      document.body.classList.add("firebase-offline");
      showNotification(
        "Connessione a Firebase persa. Le modifiche potrebbero non essere sincronizzate.",
        "warning"
      );
    }
  });
}

// =============================================
// INIZIALIZZAZIONE DELL'APPLICAZIONE
// =============================================

async function init() {
  const savedCodeVersion =
    parseInt(localStorage.getItem(CODE_VERSION_KEY)) || 1;
  if (savedCodeVersion < currentCodeVersion) {
    clearStorage("usage_start_time");
    clearStorage("usage_hash");
    DEVICES.forEach((device) => {
      clearStorage(device.storage_key);
    });
    localStorage.setItem(CODE_VERSION_KEY, currentCodeVersion.toString());

    document.getElementById("controlPanel").style.display = "none";
    document.getElementById("authCode").style.display = "block";
    document.getElementById("auth-form").style.display = "block";
    document.getElementById("btnCheckCode").style.display = "block";
    document.getElementById("important").style.display = "block";
  }

  const btnCheck = document.getElementById("btnCheckCode");
  if (btnCheck) btnCheck.addEventListener("click", handleCodeSubmit);

  DEVICES.forEach((device) => {
    const btn = document.getElementById(device.button_id);
    if (btn) {
      btn.addEventListener("click", () => {
        showConfirmationPopup(device);
      });
    }
  });

  document.getElementById("confirmYes").addEventListener("click", () => {
    if (currentDevice) {
      activateDevice(currentDevice);
      closeConfirmationPopup();
    }
  });

  document
    .getElementById("confirmNo")
    .addEventListener("click", closeConfirmationPopup);

  document.querySelectorAll(".popup .btn").forEach((button) => {
    button.addEventListener("click", function () {
      const popup = this.closest(".popup");
      if (popup) {
        const id = popup.id.replace("popup-", "");
        closePopup(id);
      }
    });
  });

  const expired = await checkTimeLimit();
  if (!expired) {
    const startTime = getStorage("usage_start_time");
    if (startTime) {
      document.getElementById("controlPanel").style.display = "block";
      document.getElementById("authCode").style.display = "none";
      document.getElementById("auth-form").style.display = "none";
      document.getElementById("btnCheckCode").style.display = "none";
      document.getElementById("important").style.display = "none";

      document.getElementById("checkinTimeInfo").style.display = "block";
      updateCheckinTimeDisplay();

      DEVICES.forEach(updateButtonState);
      updateStatusBar();
    }
  }

  updateDoorVisibility();

  // Carica le impostazioni da Firebase
  const firebaseSettings = await loadSettingsFromFirebase();

  if (firebaseSettings) {
    // Usa le impostazioni da Firebase
    CORRECT_CODE = firebaseSettings.secret_code || "2245";
    MAX_CLICKS = parseInt(firebaseSettings.max_clicks) || 3;
    TIME_LIMIT_MINUTES = parseInt(firebaseSettings.time_limit_minutes) || 50000;

    // Aggiorna localStorage
    localStorage.setItem("secret_code", CORRECT_CODE);
    localStorage.setItem("max_clicks", MAX_CLICKS.toString());
    localStorage.setItem("time_limit_minutes", TIME_LIMIT_MINUTES.toString());

    // Aggiorna la versione del codice se presente
    if (firebaseSettings.code_version) {
      currentCodeVersion = parseInt(firebaseSettings.code_version);
      localStorage.setItem("code_version", currentCodeVersion.toString());
    }
  }

  // Controlla se è una sessione token
  const hasToken = await handleSecureToken();

  // Se è una sessione token, modifica il comportamento
  if (isTokenSession) {
    // Nascondi il link all'amministrazione
    const adminLink = document.querySelector('a[href="admin.html"]');
    if (adminLink) {
      adminLink.style.display = "none";
    }

    // Modifica il messaggio di scadenza
    const expiredMessage = document.querySelector("#sessionExpired p");
    if (expiredMessage) {
      expiredMessage.textContent =
        "Il link di accesso è scaduto. Per accedere di nuovo, richiedi un nuovo link.";
    }

    // Modifica il pulsante di assistenza
    const assistanceBtn = document.querySelector(
      "#sessionExpired .btn-whatsapp"
    );
    if (assistanceBtn) {
      assistanceBtn.href =
        "https://api.whatsapp.com/send?phone=+393898883634&text=Hi, I need a new access link";
      assistanceBtn.innerHTML =
        '<i class="fab fa-whatsapp"></i> Richiedi nuovo link';
    }
  }

  // Configura l'ascolto per i cambiamenti del codice
  setupCodeChangeListener();

  // Configura l'ascolto per i cambiamenti delle impostazioni
  setupSettingsListener();

  // Per sessioni normali, mantieni il controllo tradizionale
  if (!isTokenSession) {
    timeCheckInterval = setInterval(async () => {
      const expired = await checkTimeLimit();
      if (!expired) {
        await updateGlobalCodeVersion();
        updateCheckinTimeDisplay();
      }
    }, 1000);
  }

  setInterval(updateCheckinTimeDisplay, 60000);
  monitorFirebaseConnection();

  document.addEventListener("contextmenu", (e) => e.preventDefault());
  updateCheckinTimeDisplay();
}

// =============================================
// AVVIO DELL'APPLICAZIONE
// =============================================

document.addEventListener("DOMContentLoaded", init);

// Pulisci gli intervalli quando la pagina viene chiusa
window.addEventListener("beforeunload", function () {
  if (timeCheckInterval) {
    clearInterval(timeCheckInterval);
  }
  if (codeCheckInterval) {
    clearInterval(codeCheckInterval);
  }
});
