// Costanti
const ADMIN_PASSWORD = "1122";

// Elementi DOM
const loginModal = document.getElementById("loginModal");
const adminContainer = document.getElementById("adminContainer");
const adminPasswordInput = document.getElementById("adminPassword");
const loginError = document.getElementById("loginError");
const btnLogin = document.getElementById("btnLogin");

const currentCodeEl = document.getElementById("currentCode");
const currentMaxClicksEl = document.getElementById("currentMaxClicks");
const currentTimeLimitEl = document.getElementById("currentTimeLimit");
const currentCheckinTimeRangeEl = document.getElementById(
  "currentCheckinTimeRange"
);
const checkinTimeStatusEl = document.getElementById("checkinTimeStatus");
const extraDoor1VisibleEl = document.getElementById("extraDoor1Visible");
const extraDoor2VisibleEl = document.getElementById("extraDoor2Visible");

// Carica le impostazioni all'avvio
document.addEventListener("DOMContentLoaded", function () {
  // Verifica se l'utente è già autenticato
  const isAuthenticated = localStorage.getItem("adminAuthenticated") === "true";

  if (isAuthenticated) {
    // Se autenticato, nascondi il modale e mostra il contenuto
    loginModal.classList.add("hidden");
    adminContainer.style.display = "block";
    loadSettings();
  }

  // Focus sul campo password
  adminPasswordInput.focus();
});

// Gestione del login
btnLogin.addEventListener("click", function () {
  const password = adminPasswordInput.value.trim();
  if (password === ADMIN_PASSWORD) {
    // Password corretta
    localStorage.setItem("adminAuthenticated", "true");
    loginModal.classList.add("hidden");
    adminContainer.style.display = "block";
    loadSettings();
  } else {
    // Password errata
    loginError.style.display = "block";
    adminPasswordInput.value = "";
    adminPasswordInput.focus();

    // Aggiungi effetto shake al modale
    loginModal.classList.add("shake");
    setTimeout(() => {
      loginModal.classList.remove("shake");
    }, 500);
  }
});

// Permetti di premere Invio per effettuare il login
adminPasswordInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    btnLogin.click();
  }
});

// Funzione per caricare le impostazioni
function loadSettings() {
  // Carica il codice segreto
  const secretCode = localStorage.getItem("secret_code") || "2245";
  currentCodeEl.value = secretCode;

  // Carica i click massimi
  const maxClicks = localStorage.getItem("max_clicks") || "3";
  currentMaxClicksEl.value = maxClicks;
  document.getElementById("newMaxClicks").value = maxClicks;

  // Carica il tempo limite
  const timeLimit = localStorage.getItem("time_limit_minutes") || "50000";
  currentTimeLimitEl.value = timeLimit;
  document.getElementById("newTimeLimit").value = timeLimit;

  // Carica le impostazioni orario check-in
  const checkinStartTime =
    localStorage.getItem("checkin_start_time") || "14:00";
  const checkinEndTime = localStorage.getItem("checkin_end_time") || "22:00";
  document.getElementById("checkinStartTime").value = checkinStartTime;
  document.getElementById("checkinEndTime").value = checkinEndTime;
  currentCheckinTimeRangeEl.value = `${checkinStartTime} - ${checkinEndTime}`;

  // Carica lo stato del controllo orario
  const checkinTimeEnabled = localStorage.getItem("checkin_time_enabled");
  const isCheckinTimeEnabled =
    checkinTimeEnabled === null ? true : checkinTimeEnabled === "true";

  if (isCheckinTimeEnabled) {
    checkinTimeStatusEl.innerHTML =
      '<span class="status-indicator status-on"></span> Attivo';
    document
      .getElementById("btnToggleCheckinTime")
      .classList.add("btn-success");
    document.getElementById("btnToggleCheckinTime").innerHTML =
      '<i class="fas fa-toggle-on"></i> Disattiva Controllo Orario';
  } else {
    checkinTimeStatusEl.innerHTML =
      '<span class="status-indicator status-off"></span> Disattivato';
    document.getElementById("btnToggleCheckinTime").classList.add("btn-error");
    document.getElementById("btnToggleCheckinTime").innerHTML =
      '<i class="fas fa-toggle-off"></i> Attiva Controllo Orario';
  }

  // Carica la visibilità delle porte extra
  try {
    const devices = JSON.parse(localStorage.getItem("devices")) || [];
    if (devices.length >= 4) {
      extraDoor1VisibleEl.checked = devices[2].visible || false;
      extraDoor2VisibleEl.checked = devices[3].visible || false;
    }
  } catch (e) {
    console.error("Errore nel caricamento delle porte extra:", e);
  }
}

// Aggiorna il codice segreto
document.getElementById("btnCodeUpdate").addEventListener("click", function () {
  const newCode = document.getElementById("newCode").value.trim();
  if (!newCode) {
    alert("Inserisci un codice valido");
    return;
  }

  localStorage.setItem("secret_code", newCode);

  // Aggiorna la versione del codice per forzare il reset
  const currentVersion = parseInt(localStorage.getItem("code_version")) || 1;
  const newVersion = currentVersion + 1;
  localStorage.setItem("code_version", newVersion.toString());

  // Aggiungi un timestamp per forzare l'aggiornamento
  localStorage.setItem("last_code_update", Date.now().toString());

  currentCodeEl.value = newCode;
  document.getElementById("newCode").value = "";

  alert(
    "Codice aggiornato con successo! Tutti gli utenti dovranno inserire il nuovo codice."
  );
});

// Aggiorna le impostazioni di sistema
document
  .getElementById("btnSettingsUpdate")
  .addEventListener("click", function () {
    const newMaxClicks = document.getElementById("newMaxClicks").value.trim();
    const newTimeLimit = document.getElementById("newTimeLimit").value.trim();

    if (!newMaxClicks || isNaN(newMaxClicks) || parseInt(newMaxClicks) <= 0) {
      alert("Inserisci un numero valido per i click massimi");
      return;
    }

    if (!newTimeLimit || isNaN(newTimeLimit) || parseInt(newTimeLimit) <= 0) {
      alert("Inserisci un numero valido per il tempo limite");
      return;
    }

    localStorage.setItem("max_clicks", newMaxClicks);
    localStorage.setItem("time_limit_minutes", newTimeLimit);

    currentMaxClicksEl.value = newMaxClicks;
    currentTimeLimitEl.value = newTimeLimit;

    alert("Impostazioni aggiornate con successo!");
  });

// Aggiorna l'orario de check-in
document
  .getElementById("btnUpdateCheckinTime")
  .addEventListener("click", function () {
    const newCheckinStartTime =
      document.getElementById("checkinStartTime").value;
    const newCheckinEndTime = document.getElementById("checkinEndTime").value;

    if (!newCheckinStartTime || !newCheckinEndTime) {
      alert("Inserisci orari validi");
      return;
    }

    // Converti in minuti per il confronto
    const [startHours, startMinutes] = newCheckinStartTime
      .split(":")
      .map(Number);
    const [endHours, endMinutes] = newCheckinEndTime.split(":").map(Number);

    const startTimeInMinutes = startHours * 60 + startMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;

    // Verifica che l'orario di fine sia dopo l'orario di inizio
    if (endTimeInMinutes <= startTimeInMinutes) {
      document.getElementById("timeRangeError").style.display = "block";
      return;
    }

    document.getElementById("timeRangeError").style.display = "none";

    localStorage.setItem("checkin_start_time", newCheckinStartTime);
    localStorage.setItem("checkin_end_time", newCheckinEndTime);

    currentCheckinTimeRangeEl.value = `${newCheckinStartTime} - ${newCheckinEndTime}`;
    alert("Orario di check-in aggiornato con successo!");
  });

// Attiva/disattiva il controllo orario
document
  .getElementById("btnToggleCheckinTime")
  .addEventListener("click", function () {
    const currentStatus = localStorage.getItem("checkin_time_enabled");
    let newStatus;

    if (currentStatus === null) {
      newStatus = false;
    } else {
      newStatus = currentStatus !== "true";
    }

    localStorage.setItem("checkin_time_enabled", newStatus.toString());

    if (newStatus) {
      checkinTimeStatusEl.innerHTML =
        '<span class="status-indicator status-on"></span> Attivo';
      this.classList.remove("btn-error");
      this.classList.add("btn-success");
      this.innerHTML =
        '<i class="fas fa-toggle-on"></i> Disattiva Controllo Orario';
    } else {
      checkinTimeStatusEl.innerHTML =
        '<span class="status-indicator status-off"></span> Disattivato';
      this.classList.remove("btn-success");
      this.classList.add("btn-error");
      this.innerHTML =
        '<i class="fas fa-toggle-off"></i> Attiva Controllo Orario';
    }

    alert(
      `Controllo orario ${newStatus ? "attivato" : "disattivato"} con successo!`
    );
  });

// Gestione visibilità porte extra
document
  .getElementById("btnExtraDoorsVisibility")
  .addEventListener("click", function () {
    try {
      // Carica i dispositivi esistenti o crea un array vuoto
      let devices = JSON.parse(localStorage.getItem("devices")) || [];

      // Se non ci sono dispositivi, crea la struttura base
      if (devices.length === 0) {
        devices = [
          { button_id: "MainDoor", visible: true },
          { button_id: "AptDoor", visible: true },
          { button_id: "ExtraDoor1", visible: extraDoor1VisibleEl.checked },
          { button_id: "ExtraDoor2", visible: extraDoor2VisibleEl.checked },
        ];
      } else {
        // Aggiorna solo le porte extra
        if (devices.length > 2)
          devices[2].visible = extraDoor1VisibleEl.checked;
        if (devices.length > 3)
          devices[3].visible = extraDoor2VisibleEl.checked;
      }

      // Salva nel localStorage
      localStorage.setItem("devices", JSON.stringify(devices));

      alert("Visibilità porte extra aggiornata con successo!");
    } catch (e) {
      console.error("Errore nel salvataggio delle porte extra:", e);
      alert("Si è verificato un errore durante il salvataggio.");
    }
  });
