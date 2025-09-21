// Configurazione e inizializzazione Firebase
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

// Variabili globali
let isTokenSession = false;
let currentTokenId = null;
let currentUserSession = null;
let timeCheckInterval = null;
let codeCheckInterval = null;
let currentDevice = null;

// Configurazioni predefinite
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

// Costanti
const BASE_URL_SET =
  "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";
const SECRET_KEY = "musart_secret_123_fixed_key";

// =============================================
// FUNZIONI DI STORAGE FIREBASE
// =============================================

// Salva dati su Firebase
async function setFirebaseStorage(key, value, sessionId = null) {
  try {
    if (!sessionId && !currentUserSession) {
      console.error("Nessuna sessione utente attiva per il salvataggio");
      return false;
    }

    const targetSessionId = sessionId || currentUserSession.id;
    const path = `sessions/${targetSessionId}/${key}`;

    await database.ref(path).set({
      value: value,
      timestamp: Date.now(),
    });
    return true;
  } catch (error) {
    console.error("Errore nel salvataggio su Firebase:", error);
    return false;
  }
}

// Recupera dati da Firebase
async function getFirebaseStorage(key, sessionId = null) {
  try {
    if (!sessionId && !currentUserSession) {
      console.error("Nessuna sessione utente attiva per il recupero");
      return null;
    }

    const targetSessionId = sessionId || currentUserSession.id;
    const path = `sessions/${targetSessionId}/${key}`;

    const snapshot = await database.ref(path).once("value");
    return snapshot.exists() ? snapshot.val().value : null;
  } catch (error) {
    console.error("Errore nel recupero da Firebase:", error);
    return null;
  }
}

// Rimuovi dati da Firebase
async function clearFirebaseStorage(key, sessionId = null) {
  try {
    if (!sessionId && !currentUserSession) {
      console.error("Nessuna sessione utente attiva per la rimozione");
      return false;
    }

    const targetSessionId = sessionId || currentUserSession.id;
    const path = `sessions/${targetSessionId}/${key}`;

    await database.ref(path).remove();
    return true;
  } catch (error) {
    console.error("Errore nella rimozione da Firebase:", error);
    return false;
  }
}

// =============================================
// GESTIONE SESSIONI UTENTE
// =============================================

// Crea una nuova sessione utente
async function createUserSession(sessionData = {}) {
  const sessionId = generateSessionId();
  const sessionObject = {
    id: sessionId,
    createdAt: Date.now(),
    isTokenSession: isTokenSession,
    tokenId: currentTokenId,
    ...sessionData,
  };

  try {
    await database.ref(`sessions/${sessionId}`).set(sessionObject);
    currentUserSession = sessionObject;
    return sessionId;
  } catch (error) {
    console.error("Errore nella creazione della sessione:", error);
    return null;
  }
}

// Genera ID sessione univoco
function generateSessionId() {
  return (
    "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
  );
}

// Verifica se una sessione è valida
async function validateSession(sessionId) {
  try {
    const snapshot = await database.ref(`sessions/${sessionId}`).once("value");
    if (!snapshot.exists()) return false;

    const sessionData = snapshot.val();

    // Controlla se la sessione è scaduta
    const settingsSnapshot = await database.ref("settings").once("value");
    const settings = settingsSnapshot.exists() ? settingsSnapshot.val() : {};
    const timeLimit = settings.time_limit_minutes || 1150;

    const sessionAge = (Date.now() - sessionData.createdAt) / (1000 * 60);
    if (sessionAge > timeLimit) {
      // Sessione scaduta
      await database.ref(`sessions/${sessionId}`).update({ expired: true });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Errore nella validazione della sessione:", error);
    return false;
  }
}

// =============================================
// GESTIONE TEMPO E SESSIONE
// =============================================

// Imposta il tempo di inizio utilizzo
async function setUsageStartTime() {
  const now = Date.now();
  const hash = await generateHash(now + SECRET_KEY);

  await setFirebaseStorage("usage_start_time", now);
  await setFirebaseStorage("usage_hash", hash);

  updateStatusBar();
}

// Controlla il limite di tempo
async function checkTimeLimit() {
  if (isTokenSession) return false;
  if (!currentUserSession) return false;

  const startTime = await getFirebaseStorage("usage_start_time");
  const storedHash = await getFirebaseStorage("usage_hash");

  if (!startTime || !storedHash) return false;

  const calcHash = await generateHash(startTime + SECRET_KEY);
  if (calcHash !== storedHash) {
    showFatalError("⚠️ Violazione di sicurezza rilevata!");
    return true;
  }

  // Recupera il time limit dalle impostazioni
  const settingsSnapshot = await database.ref("settings").once("value");
  const settings = settingsSnapshot.exists() ? settingsSnapshot.val() : {};
  const timeLimit = settings.time_limit_minutes || 1150;

  const now = Date.now();
  const minutesPassed = (now - parseInt(startTime, 10)) / (1000 * 60);

  if (minutesPassed >= timeLimit) {
    showSessionExpired();
    return true;
  }

  updateStatusBar();
  return false;
}

// Mostra errore fatale
function showFatalError(message) {
  if (timeCheckInterval) clearInterval(timeCheckInterval);
  if (codeCheckInterval) clearInterval(codeCheckInterval);

  document.body.innerHTML = `
    <div style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
      display: flex; justify-content: center; align-items: center;
      background: #121111; color: #ff6b6b; font-size: 24px; text-align: center;
      padding: 20px; z-index: 9999;">
      ${message}
    </div>`;
}

// Mostra sessione scaduta
function showSessionExpired() {
  if (isTokenSession) return;

  if (timeCheckInterval) clearInterval(timeCheckInterval);
  if (codeCheckInterval) clearInterval(codeCheckInterval);

  document.getElementById("expiredOverlay").classList.remove("hidden");
  document.getElementById("controlPanel").classList.add("hidden");
  document.getElementById("sessionExpired").classList.remove("hidden");

  const test2Element = document.getElementById("test2");
  if (test2Element) test2Element.style.display = "none";

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
// FUNZIONI DI SICUREZZA E CRITTOGRAFIA
// =============================================

// Genera hash SHA-256
async function generateHash(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// =============================================
// GESTIONE ORARIO DI CHECK-IN (RANGE)
// =============================================

// Verifica se è orario di check-in
async function isCheckinTime() {
  const settingsSnapshot = await database.ref("settings").once("value");
  const settings = settingsSnapshot.exists() ? settingsSnapshot.val() : {};

  const checkinEnabled =
    settings.checkin_time_enabled !== undefined
      ? settings.checkin_time_enabled
      : true;

  if (!checkinEnabled) return true;

  const checkinStart = settings.checkin_start_time || "12:00";
  const checkinEnd = settings.checkin_end_time || "23:00";

  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeInMinutes = currentHours * 60 + currentMinutes;

  const [startHours, startMinutes] = checkinStart.split(":").map(Number);
  const [endHours, endMinutes] = checkinEnd.split(":").map(Number);

  const startTimeInMinutes = startHours * 60 + startMinutes;
  const endTimeInMinutes = endHours * 60 + endMinutes;

  return (
    currentTimeInMinutes >= startTimeInMinutes &&
    currentTimeInMinutes <= endTimeInMinutes
  );
}

// Formatta l'orario
function formatTime(timeString) {
  const [hours, minutes] = timeString.split(":");
  return `${hours}:${minutes}`;
}

// Aggiorna la visualizzazione dell'orario di check-in
async function updateCheckinTimeDisplay() {
  const settingsSnapshot = await database.ref("settings").once("value");
  const settings = settingsSnapshot.exists() ? settingsSnapshot.val() : {};

  const checkinStart = settings.checkin_start_time || "12:00";
  const checkinEnd = settings.checkin_end_time || "23:00";
  const checkinEnabled =
    settings.checkin_time_enabled !== undefined
      ? settings.checkin_time_enabled
      : true;

  const startEl = document.getElementById("checkinStartDisplay");
  const endEl = document.getElementById("checkinEndDisplay");
  const startPopup = document.getElementById("checkinStartPopup");
  const endPopup = document.getElementById("checkinEndPopup");
  const currentStart = document.getElementById("currentCheckinStartTime");
  const currentEnd = document.getElementById("currentCheckinEndTime");

  if (startEl) startEl.textContent = formatTime(checkinStart);
  if (endEl) endEl.textContent = formatTime(checkinEnd);
  if (startPopup) startPopup.textContent = formatTime(checkinStart);
  if (endPopup) endPopup.textContent = formatTime(checkinEnd);
  if (currentStart) currentStart.textContent = formatTime(checkinStart);
  if (currentEnd) currentEnd.textContent = formatTime(checkinEnd);

  const statusElement = document.getElementById("currentTimeStatus");
  if (statusElement) {
    if (!checkinEnabled) {
      statusElement.innerHTML =
        '<i class="fas fa-power-off" style="color:orange;"></i> Time control disabled — check-in allowed at any time';
    } else {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeInMinutes = currentHours * 60 + currentMinutes;

      const [startHours, startMinutes] = checkinStart.split(":").map(Number);
      const [endHours, endMinutes] = checkinEnd.split(":").map(Number);

      const startTimeInMinutes = startHours * 60 + startMinutes;
      const endTimeInMinutes = endHours * 60 + endMinutes;

      const isCheckinTimeNow =
        currentTimeInMinutes >= startTimeInMinutes &&
        currentTimeInMinutes <= endTimeInMinutes;

      if (isCheckinTimeNow) {
        statusElement.innerHTML =
          '<i class="fas fa-check-circle" style="color:green;"></i> Check-in now available';
      } else if (currentTimeInMinutes < startTimeInMinutes) {
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

// Mostra popup check-in anticipato
function showEarlyCheckinPopup() {
  const popup = document.getElementById("earlyCheckinPopup");
  if (popup) popup.style.display = "flex";
}

// Chiudi popup check-in anticipato
function closeEarlyCheckinPopup() {
  const popup = document.getElementById("earlyCheckinPopup");
  if (popup) popup.style.display = "none";
}

// =============================================
// GESTIONE INTERFACCIA E STATO
// =============================================

// Aggiorna la barra di stato
async function updateStatusBar() {
  if (!currentUserSession) return;

  const mainDoorCounter = document.getElementById("mainDoorCounter");
  const aptDoorCounter = document.getElementById("aptDoorCounter");
  const timeRemaining = document.getElementById("timeRemaining");

  if (mainDoorCounter) {
    const clicksLeft = await getClicksLeft(DEVICES[0].storage_key);
    mainDoorCounter.textContent = `${clicksLeft} click left`;
  }

  if (aptDoorCounter) {
    const clicksLeft = await getClicksLeft(DEVICES[1].storage_key);
    aptDoorCounter.textContent = `${clicksLeft} click left`;
  }

  const startTime = await getFirebaseStorage("usage_start_time");
  if (!startTime || !timeRemaining) return;

  // Recupera il time limit dalle impostazioni
  const settingsSnapshot = await database.ref("settings").once("value");
  const settings = settingsSnapshot.exists() ? settingsSnapshot.val() : {};
  const timeLimit = settings.time_limit_minutes || 1150;

  const now = Date.now();
  const minutesPassed = (now - parseInt(startTime, 10)) / (1000 * 60);
  const minutesLeft = Math.max(0, Math.floor(timeLimit - minutesPassed));
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

// Ottieni i click rimanenti
async function getClicksLeft(key) {
  if (!currentUserSession) {
    const settingsSnapshot = await database.ref("settings").once("value");
    const settings = settingsSnapshot.exists() ? settingsSnapshot.val() : {};
    return settings.max_clicks || 3;
  }

  const stored = await getFirebaseStorage(key);

  // Recupera il max_clicks dalle impostazioni
  const settingsSnapshot = await database.ref("settings").once("value");
  const settings = settingsSnapshot.exists() ? settingsSnapshot.val() : {};
  const maxClicks = settings.max_clicks || 3;

  return stored === null ? maxClicks : parseInt(stored, 10);
}

// Imposta i click rimanenti
async function setClicksLeft(key, count) {
  if (!currentUserSession) return;

  await setFirebaseStorage(key, count.toString());
  updateStatusBar();
}

// Aggiorna lo stato del pulsante
async function updateButtonState(device) {
  const btn = document.getElementById(device.button_id);
  if (!btn) return;

  const clicksLeft = await getClicksLeft(device.storage_key);
  const checkinTime = await isCheckinTime();

  btn.disabled = clicksLeft <= 0 || !checkinTime;

  if (clicksLeft <= 0) {
    btn.classList.add("btn-error");
    btn.classList.remove("btn-success");
  } else if (!checkinTime) {
    btn.classList.remove("btn-error", "btn-success");
  } else {
    btn.classList.add("btn-success");
    btn.classList.remove("btn-error");
  }
}

// Aggiorna la visibilità delle porte
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

// Configura l'ascoltatore per il cambio codice
function setupCodeChangeListener() {
  // Ascolta i cambiamenti del codice su Firebase
  database.ref("settings/secret_code").on("value", (snapshot) => {
    if (snapshot.exists()) {
      const newCode = snapshot.val();
      handleCodeChange(newCode);
    }
  });
}

// Gestisci il cambio del codice
async function handleCodeChange(newCode) {
  // Resetta tutto
  if (currentUserSession) {
    await clearFirebaseStorage("usage_start_time");
    await clearFirebaseStorage("usage_hash");

    for (const device of DEVICES) {
      await clearFirebaseStorage(device.storage_key);
    }
  }

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

// Mostra notifica
function showNotification(message, type = "info") {
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
    background: ${
      type === "info" ? "#FF5A5F" : type === "warning" ? "#FF9800" : "#4CAF50"
    };
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
    <i class="fas fa-${
      type === "info"
        ? "info-circle"
        : type === "warning"
        ? "exclamation-triangle"
        : "check-circle"
    }"></i>
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

// Mostra popup di conferma
async function showConfirmationPopup(device) {
  const checkinTime = await isCheckinTime();
  if (!checkinTime) {
    showEarlyCheckinPopup();
    return;
  }

  currentDevice = device;
  const doorName = device.button_id
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());

  const confirmationMessage = document.getElementById("confirmationMessage");
  if (confirmationMessage) {
    confirmationMessage.textContent = `Are you sure you want to unlock the ${doorName}?`;
  }

  const confirmationPopup = document.getElementById("confirmationPopup");
  if (confirmationPopup) confirmationPopup.style.display = "flex";
}

// Chiudi popup di conferma
function closeConfirmationPopup() {
  const confirmationPopup = document.getElementById("confirmationPopup");
  if (confirmationPopup) confirmationPopup.style.display = "none";
  currentDevice = null;
}

// Mostra popup del dispositivo
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

// Chiudi popup
function closePopup(buttonId) {
  const popup = document.getElementById(`popup-${buttonId}`);
  if (popup) popup.style.display = "none";
}

// =============================================
// COMUNICAZIONE CON DISPOSITIVI SHELLY
// =============================================

// Attiva dispositivo
async function activateDevice(device) {
  if (await checkTimeLimit()) return;

  const checkinTime = await isCheckinTime();
  if (!checkinTime) {
    showEarlyCheckinPopup();
    return;
  }

  let clicksLeft = await getClicksLeft(device.storage_key);
  if (clicksLeft <= 0) {
    showDevicePopup(device, clicksLeft);
    updateButtonState(device);
    return;
  }

  clicksLeft--;
  await setClicksLeft(device.storage_key, clicksLeft);
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
      await setClicksLeft(device.storage_key, clicksLeft + 1);
      updateButtonState(device);
      console.error(
        "Errore nell'attivazione del dispositivo:",
        response.statusText
      );
    }
  } catch (error) {
    console.error("Attivazione dispositivo fallita:", error);
    await setClicksLeft(device.storage_key, clicksLeft + 1);
    updateButtonState(device);
  }
}

// =============================================
// GESTIONE TOKEN SICURI
// =============================================

// Verifica e gestisci i token sicuri
async function handleSecureToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  if (!token) {
    isTokenSession = false;
    return false;
  }

  try {
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

    isTokenSession = true;
    currentTokenId = token;

    // Crea una nuova sessione per questo token
    await createUserSession({
      isTokenSession: true,
      tokenId: token,
      expiration: linkData.expiration,
    });

    const authCodeInput = document.getElementById("authCode");
    if (authCodeInput) {
      const codeSnapshot = await database
        .ref("settings/secret_code")
        .once("value");
      const currentCode = codeSnapshot.val() || "2245";
      authCodeInput.value = currentCode;

      showTokenNotification(isValid.remainingUses);
      await incrementTokenUsage(token, linkData);
      cleanUrl();
      startTokenExpirationCheck(linkData.expiration);

      // Nascondi il form e mostra il pannello di controllo
      document.getElementById("controlPanel").style.display = "block";
      document.getElementById("authCode").style.display = "none";
      document.getElementById("auth-form").style.display = "none";
      document.getElementById("btnCheckCode").style.display = "none";
      document.getElementById("important").style.display = "none";

      document.getElementById("checkinTimeInfo").style.display = "block";
      updateCheckinTimeDisplay();

      for (const device of DEVICES) {
        await updateButtonState(device);
      }
      updateStatusBar();

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

// Incrementa l'uso del token
async function incrementTokenUsage(token, linkData) {
  const newUsedCount = linkData.usedCount + 1;
  let newStatus = "active";

  if (newUsedCount >= linkData.maxUsage) {
    newStatus = "used";
  }

  try {
    await database.ref("secure_links/" + token).update({
      usedCount: newUsedCount,
      status: newStatus,
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento del token:", error);
  }
}

// Mostra notifica token
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

// Pulisci URL
function cleanUrl() {
  if (window.history.replaceState) {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}

// Avvia controllo scadenza token
function startTokenExpirationCheck(expirationTime) {
  const checkTokenExpiration = setInterval(() => {
    if (Date.now() > expirationTime) {
      clearInterval(checkTokenExpiration);
      if (isTokenSession) {
        showSessionExpired();
      }
    }
  }, 1000);
}

// =============================================
// AUTENTICAZIONE UTENTE
// =============================================

// Gestisci l'invio del codice
async function handleCodeSubmit() {
  const insertedCode = document.getElementById("authCode").value.trim();

  // Recupera il codice corretto da Firebase
  const snapshot = await database.ref("settings/secret_code").once("value");
  const correctCode = snapshot.exists() ? snapshot.val() : "2245";

  if (insertedCode !== correctCode) {
    alert("Codice errato! Riprova.");
    return;
  }

  // Crea una nuova sessione
  await createUserSession({ isTokenSession: false });
  await setUsageStartTime();

  if (await checkTimeLimit()) return;

  document.getElementById("controlPanel").style.display = "block";
  document.getElementById("authCode").style.display = "none";
  document.getElementById("auth-form").style.display = "none";
  document.getElementById("btnCheckCode").style.display = "none";
  document.getElementById("important").style.display = "none";

  document.getElementById("checkinTimeInfo").style.display = "block";
  updateCheckinTimeDisplay();

  for (const device of DEVICES) {
    await updateButtonState(device);
  }
  updateStatusBar();
}

// =============================================
// GESTIONE IMPOSTAZIONI FIREBASE
// =============================================

// Configura l'ascoltatore per le impostazioni
function setupSettingsListener() {
  database.ref("settings").on("value", (snapshot) => {
    if (snapshot.exists()) {
      const settings = snapshot.val();
      updateStatusBar();

      for (const device of DEVICES) {
        updateButtonState(device);
      }
    }
  });
}

// Monitora la connessione Firebase
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
  // Inizializza i listener degli eventi
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

  const confirmYes = document.getElementById("confirmYes");
  if (confirmYes) {
    confirmYes.addEventListener("click", () => {
      if (currentDevice) {
        activateDevice(currentDevice);
        closeConfirmationPopup();
      }
    });
  }

  const confirmNo = document.getElementById("confirmNo");
  if (confirmNo) confirmNo.addEventListener("click", closeConfirmationPopup);

  document.querySelectorAll(".popup .btn").forEach((button) => {
    button.addEventListener("click", function () {
      const popup = this.closest(".popup");
      if (popup) {
        const id = popup.id.replace("popup-", "");
        closePopup(id);
      }
    });
  });

  // Controlla se è una sessione token
  const hasToken = await handleSecureToken();

  // Se è una sessione token, modifica il comportamento
  if (isTokenSession) {
    const adminLink = document.querySelector('a[href="admin.html"]');
    if (adminLink) {
      adminLink.style.display = "none";
    }

    const expiredMessage = document.querySelector("#sessionExpired p");
    if (expiredMessage) {
      expiredMessage.textContent =
        "Il link di accesso è scaduto. Per accedere di nuovo, richiedi un nuovo link.";
    }

    const assistanceBtn = document.querySelector(
      "#sessionExpired .btn-whatsapp"
    );
    if (assistanceBtn) {
      assistanceBtn.href =
        "https://wa.me/393317561511?text=Ho%20bisogno%20di%20un%20nuovo%20link%20di%20accesso";
    }
  }

  // Se non è una sessione token, mostra il form di autenticazione
  if (!hasToken) {
    document.getElementById("authCode").style.display = "block";
    document.getElementById("auth-form").style.display = "block";
    document.getElementById("btnCheckCode").style.display = "block";
    document.getElementById("important").style.display = "block";
  }

  updateDoorVisibility();
  updateCheckinTimeDisplay();

  // Configura gli intervalli di controllo
  timeCheckInterval = setInterval(checkTimeLimit, 1000);
  codeCheckInterval = setInterval(updateCheckinTimeDisplay, 60000);

  // Configura i listener Firebase
  setupCodeChangeListener();
  setupSettingsListener();
  monitorFirebaseConnection();
}

// Avvia l'applicazione quando il DOM è pronto
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
