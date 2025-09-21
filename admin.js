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

// Funzione per salvare le impostazioni su Firebase
async function saveSettingToFirebase(key, value) {
  try {
    await database.ref("settings/" + key).set(value);
    console.log(`Impostazione ${key} salvata su Firebase:`, value);
    return true;
  } catch (error) {
    console.error(`Errore nel salvataggio di ${key} su Firebase:`, error);
    return false;
  }
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

// Funzione per caricare le impostazioni
async function loadSettings() {
  // Prova a caricare da Firebase
  const firebaseSettings = await loadSettingsFromFirebase();

  if (firebaseSettings) {
    // Usa le impostazioni da Firebase
    currentCodeEl.value = firebaseSettings.secret_code || "2245";
    currentMaxClicksEl.value = firebaseSettings.max_clicks || "3";
    currentTimeLimitEl.value = firebaseSettings.time_limit_minutes || "50000";

    document.getElementById("newMaxClicks").value =
      firebaseSettings.max_clicks || "3";
    document.getElementById("newTimeLimit").value =
      firebaseSettings.time_limit_minutes || "50000";

    // Aggiorna anche il localStorage
    localStorage.setItem("secret_code", firebaseSettings.secret_code || "2245");
    localStorage.setItem("max_clicks", firebaseSettings.max_clicks || "3");
    localStorage.setItem(
      "time_limit_minutes",
      firebaseSettings.time_limit_minutes || "50000"
    );
  } else {
    // Fallback al localStorage
    const secretCode = localStorage.getItem("secret_code") || "2245";
    const maxClicks = localStorage.getItem("max_clicks") || "3";
    const timeLimit = localStorage.getItem("time_limit_minutes") || "50000";

    currentCodeEl.value = secretCode;
    currentMaxClicksEl.value = maxClicks;
    currentTimeLimitEl.value = timeLimit;

    document.getElementById("newMaxClicks").value = maxClicks;
    document.getElementById("newTimeLimit").value = timeLimit;

    // Salva le impostazioni su Firebase per futuri utilizzi
    saveSettingToFirebase("secret_code", secretCode);
    saveSettingToFirebase("max_clicks", maxClicks);
    saveSettingToFirebase("time_limit_minutes", timeLimit);
  }

  // Carica le impostazioni orario check-in
  const checkinStartTime =
    localStorage.getItem("checkin_start_time") || "";
  const checkinEndTime = localStorage.getItem("checkin_end_time") || "";
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

  // Carica i link attivi e statistiche
  updateActiveLinksList();
  updateLinkStatistics();
}

// Aggiorna il codice segreto
document
  .getElementById("btnCodeUpdate")
  .addEventListener("click", async function () {
    const newCode = document.getElementById("newCode").value.trim();
    if (!newCode) {
      alert("Inserisci un codice valido");
      return;
    }

    // Salva su Firebase
    const success = await saveSettingToFirebase("secret_code", newCode);

    if (success) {
      // Aggiorna localStorage
      localStorage.setItem("secret_code", newCode);

      // Aggiorna la versione del codice
      const currentVersion =
        parseInt(localStorage.getItem("code_version")) || 1;
      const newVersion = currentVersion + 1;
      localStorage.setItem("code_version", newVersion.toString());
      await saveSettingToFirebase("code_version", newVersion);

      // Aggiorna timestamp
      const timestamp = Date.now().toString();
      localStorage.setItem("last_code_update", timestamp);
      await saveSettingToFirebase("last_code_update", timestamp);

      currentCodeEl.value = newCode;
      document.getElementById("newCode").value = "";

      alert(
        "Codice aggiornato con successo! Tutti gli utenti dovranno inserire il nuovo codice."
      );
    } else {
      alert("Errore nel salvataggio del nuovo codice. Riprovare.");
    }
  });

// Aggiorna le impostazioni di sistema
document
  .getElementById("btnSettingsUpdate")
  .addEventListener("click", async function () {
    const newMaxClicks = document.getElementById("newMaxClicks").value.trim();
    const newTimeLimit = document.getElementById("newTimeLimit").value.trim();

    if (!newMaxClicks || isNaN(newMaxClicks) || parseInt(newMaxClicks) <= 0) {
      alert("Inserisci un numero valido per i click massimi");
      return;
    }

    if (!newTimeLimit || isNaN(newTimeLimit) || parseInt(newTimeLimit) <= 0) {
      alert("Inserisci a number valid for the time limit");
      return;
    }

    // Salva su Firebase
    const maxClicksSuccess = await saveSettingToFirebase(
      "max_clicks",
      newMaxClicks
    );
    const timeLimitSuccess = await saveSettingToFirebase(
      "time_limit_minutes",
      newTimeLimit
    );

    if (maxClicksSuccess && timeLimitSuccess) {
      // Aggiorna localStorage
      localStorage.setItem("max_clicks", newMaxClicks);
      localStorage.setItem("time_limit_minutes", newTimeLimit);

      currentMaxClicksEl.value = newMaxClicks;
      currentTimeLimitEl.value = newTimeLimit;

      alert("Impostazioni aggiornate con successo!");
    } else {
      alert("Errore nel salvataggio delle impostazioni. Riprovare.");
    }
  });

// Aggiorna l'orario de check-in
document
  .getElementById("btnUpdateCheckinTime")
  .addEventListener("click", async function () {
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

    // Salva su Firebase
    const startTimeSuccess = await saveSettingToFirebase(
      "checkin_start_time",
      newCheckinStartTime
    );
    const endTimeSuccess = await saveSettingToFirebase(
      "checkin_end_time",
      newCheckinEndTime
    );

    if (startTimeSuccess && endTimeSuccess) {
      // Aggiorna localStorage
      localStorage.setItem("checkin_start_time", newCheckinStartTime);
      localStorage.setItem("checkin_end_time", newCheckinEndTime);

      currentCheckinTimeRangeEl.value = `${newCheckinStartTime} - ${newCheckinEndTime}`;
      alert("Orario di check-in aggiornato con successo!");
    } else {
      alert("Errore nel salvataggio dell'orario di check-in. Riprovare.");
    }
  });

// Attiva/disattiva il controllo orario
document
  .getElementById("btnToggleCheckinTime")
  .addEventListener("click", async function () {
    const currentStatus = localStorage.getItem("checkin_time_enabled");
    let newStatus;

    if (currentStatus === null) {
      newStatus = false;
    } else {
      newStatus = currentStatus !== "true";
    }

    // Salva su Firebase
    const success = await saveSettingToFirebase(
      "checkin_time_enabled",
      newStatus.toString()
    );

    if (success) {
      // Aggiorna localStorage
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
        `Controllo orario ${
          newStatus ? "attivato" : "disattivato"
        } con successo!`
      );
    } else {
      alert("Errore nel salvataggio delle impostazioni. Riprovare.");
    }
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

// Gestione generazione link sicuri
document
  .getElementById("btnGenerateSecureLink")
  .addEventListener("click", function () {
    const expirationHours = parseInt(
      document.getElementById("linkExpiration").value
    );
    const maxUsage = parseInt(document.getElementById("linkUsage").value);

    // Genera ID unico
    const linkId = generateUniqueId();
    const expirationTime = Date.now() + expirationHours * 60 * 60 * 1000;

    // Ottieni l'URL base
    const baseUrl = window.location.origin + window.location.pathname;
    const indexUrl = baseUrl.replace("admin.html", "index.html");

    // Genera il link
    const secureLink = `${indexUrl}?token=${linkId}`;

    document.getElementById("generatedSecureLink").value = secureLink;

    // Salva i dati del link
    saveSecureLink(linkId, expirationTime, maxUsage, expirationHours);

    // Aggiorna la lista dei link attivi
    updateActiveLinksList();
    updateLinkStatistics();
  });

// Copia il link sicuro
document
  .getElementById("btnCopySecureLink")
  .addEventListener("click", function () {
    const linkInput = document.getElementById("generatedSecureLink");

    if (!linkInput.value) {
      alert("Genera prima un link");
      return;
    }

    linkInput.select();
    document.execCommand("copy");

    // Feedback visivo
    const btn = document.getElementById("btnCopySecureLink");
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Copiato!';
    btn.style.background = "var(--success)";

    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = "";
    }, 2000);
  });

// Genera ID unico
function generateUniqueId() {
  return "link_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

// Salva i dati del link sicuro
function saveSecureLink(linkId, expirationTime, maxUsage, expirationHours) {
  const linkData = {
    id: linkId,
    created: Date.now(),
    expiration: expirationTime,
    maxUsage: maxUsage,
    usedCount: 0,
    expirationHours: expirationHours,
    status: "active",
  };

  // Salva su Firebase
  database
    .ref("secure_links/" + linkId)
    .set(linkData)
    .then(() => {
      console.log("Link salvato su Firebase");
      updateActiveLinksList();
      updateLinkStatistics();
    })
    .catch((error) => {
      console.error("Errore nel salvataggio del link:", error);
      // Fallback al localStorage se Firebase non funziona
      const secureLinks = JSON.parse(
        localStorage.getItem("secure_links") || "{}"
      );
      secureLinks[linkId] = linkData;
      localStorage.setItem("secure_links", JSON.stringify(secureLinks));
      updateActiveLinksList();
      updateLinkStatistics();
    });
}

// Aggiorna la lista dei link attivi
function updateActiveLinksList() {
  const container = document.getElementById("activeLinksList");
  container.innerHTML =
    '<p style="color: #666; text-align: center;">Caricamento...</p>';

  // Recupera i link da Firebase
  database
    .ref("secure_links")
    .orderByChild("created")
    .once("value")
    .then((snapshot) => {
      const activeLinks = [];
      snapshot.forEach((childSnapshot) => {
        const link = childSnapshot.val();
        if (link.status === "active" && link.expiration > Date.now()) {
          activeLinks.push(link);
        }
      });

      if (activeLinks.length === 0) {
        container.innerHTML =
          '<p style="color: #666; text-align: center;">Nessun link attivo</p>';
        return;
      }

      container.innerHTML = "";
      activeLinks
        .sort((a, b) => b.created - a.created)
        .forEach((link) => {
          const linkElement = document.createElement("div");
          linkElement.style.cssText = `
          padding: 10px;
          margin: 8px 0;
          background: #f8f9fa;
          border-radius: 6px;
          border-left: 4px solid var(--success);
        `;

          const expiresIn = Math.max(
            0,
            Math.floor((link.expiration - Date.now()) / (1000 * 60 * 60))
          );
          const usageText = `${link.usedCount}/${link.maxUsage} utilizzi`;

          linkElement.innerHTML = `
          <div style="font-size: 11px; color: #666;">
            Creato: ${new Date(link.created).toLocaleString("it-IT")}
          </div>
          <div style="font-weight: bold; margin: 3px 0; color: var(--dark);">
            Scade in: ${expiresIn}h • ${usageText}
          </div>
          <div style="font-size: 12px; overflow: hidden; text-overflow: ellipsis; margin-bottom: 5px;">
            <a href="${
              window.location.origin +
              window.location.pathname.replace("admin.html", "index.html")
            }?token=${link.id}" 
               target="_blank" style="color: var(--primary);">
               ${link.id}
            </a>
          </div>
          <div style="display: flex; gap: 5px;">
            <button onclick="copySecureLink('${link.id}')" style="
                background: var(--primary);
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            ">
                <i class="fas fa-copy"></i> Copia
            </button>
            <button onclick="revokeSecureLink('${link.id}')" style="
                background: var(--error);
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            ">
                <i class="fas fa-ban"></i> Revoca
            </button>
          </div>
        `;

          container.appendChild(linkElement);
        });
    })
    .catch((error) => {
      console.error("Errore nel recupero dei link:", error);
      // Fallback al localStorage
      const secureLinks = JSON.parse(
        localStorage.getItem("secure_links") || "{}"
      );
      const activeLinks = Object.values(secureLinks).filter(
        (link) => link.status === "active" && link.expiration > Date.now()
      );

      if (activeLinks.length === 0) {
        container.innerHTML =
          '<p style="color: #666; text-align: center;">Nessun link attivo</p>';
        return;
      }

      container.innerHTML = "";
      activeLinks
        .sort((a, b) => b.created - a.created)
        .forEach((link) => {
          const linkElement = document.createElement("div");
          linkElement.style.cssText = `
          padding: 10px;
          margin: 8px 0;
          background: #f8f9fa;
          border-radius: 6px;
          border-left: 4px solid var(--success);
        `;

          const expiresIn = Math.max(
            0,
            Math.floor((link.expiration - Date.now()) / (1000 * 60 * 60))
          );
          const usageText = `${link.usedCount}/${link.maxUsage} utilizzi`;

          linkElement.innerHTML = `
          <div style="font-size: 11px; color: #666;">
            Creato: ${new Date(link.created).toLocaleString("it-IT")}
          </div>
          <div style="font-weight: bold; margin: 3px 0; color: var(--dark);">
            Scade in: ${expiresIn}h • ${usageText}
          </div>
          <div style="font-size: 12px; overflow: hidden; text-overflow: ellipsis; margin-bottom: 5px;">
            <a href="${
              window.location.origin +
              window.location.pathname.replace("admin.html", "index.html")
            }?token=${link.id}" 
               target="_blank" style="color: var(--primary);">
               ${link.id}
            </a>
          </div>
          <div style="display: flex; gap: 5px;">
            <button onclick="copySecureLink('${link.id}')" style="
                background: var(--primary);
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            ">
                <i class="fas fa-copy"></i> Copia
            </button>
            <button onclick="revokeSecureLink('${link.id}')" style="
                background: var(--error);
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            ">
                <i class="fas fa-ban"></i> Revoca
            </button>
          </div>
        `;

          container.appendChild(linkElement);
        });
    });
}

// Copia link sicuro
function copySecureLink(linkId) {
  const baseUrl = window.location.origin + window.location.pathname;
  const indexUrl = baseUrl.replace("admin.html", "index.html");
  const secureLink = `${indexUrl}?token=${linkId}`;

  const tempInput = document.createElement("input");
  tempInput.value = secureLink;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand("copy");
  document.body.removeChild(tempInput);

  alert("Link copiato negli appunti!");
}

// Revoca link
function revokeSecureLink(linkId) {
  // Prima prova a revocare su Firebase
  database
    .ref("secure_links/" + linkId)
    .update({
      status: "revoked",
      expiration: Date.now(),
    })
    .then(() => {
      updateActiveLinksList();
      updateLinkStatistics();
      alert("Link revocato con successo!");
    })
    .catch((error) => {
      console.error("Errore nella revoca del link su Firebase:", error);
      // Fallback al localStorage
      const secureLinks = JSON.parse(
        localStorage.getItem("secure_links") || "{}"
      );
      if (secureLinks[linkId]) {
        secureLinks[linkId].status = "revoked";
        secureLinks[linkId].expiration = Date.now();
        localStorage.setItem("secure_links", JSON.stringify(secureLinks));
        updateActiveLinksList();
        updateLinkStatistics();
        alert("Link revocato con successo!");
      }
    });
}

// Aggiorna le statistiche
function updateLinkStatistics() {
  // Prima prova a recuperare da Firebase
  database
    .ref("secure_links")
    .once("value")
    .then((snapshot) => {
      const links = [];
      snapshot.forEach((childSnapshot) => {
        links.push(childSnapshot.val());
      });

      document.getElementById("totalLinks").textContent = links.length;
      document.getElementById("activeLinks").textContent = links.filter(
        (l) => l.status === "active" && l.expiration > Date.now()
      ).length;
      document.getElementById("usedLinks").textContent = links.filter(
        (l) => l.status === "used"
      ).length;
      document.getElementById("expiredLinks").textContent = links.filter(
        (l) => l.status === "expired" || l.status === "revoked"
      ).length;
    })
    .catch((error) => {
      console.error("Errore nel recupero delle statistiche:", error);
      // Fallback al localStorage
      const secureLinks = JSON.parse(
        localStorage.getItem("secure_links") || "{}"
      );
      const links = Object.values(secureLinks);

      document.getElementById("totalLinks").textContent = links.length;
      document.getElementById("activeLinks").textContent = links.filter(
        (l) => l.status === "active" && l.expiration > Date.now()
      ).length;
      document.getElementById("usedLinks").textContent = links.filter(
        (l) => l.status === "used"
      ).length;
      document.getElementById("expiredLinks").textContent = links.filter(
        (l) => l.status === "expired" || l.status === "revoked"
      ).length;
    });
}

// Carica i link attivi all'avvio
document.addEventListener("DOMContentLoaded", function () {
  updateActiveLinksList();
  updateLinkStatistics();
  setInterval(updateActiveLinksList, 60000); // Controlla ogni minuto
  setInterval(updateLinkStatistics, 5000); // Aggiorna stats ogni 5 secondi
});
