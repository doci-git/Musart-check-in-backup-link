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

     initDoorControls();
  }

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
// Salva i dati del link sicuro
// Salva i dati del link sicuro
function saveSecureLink(linkId, expirationTime, maxUsage, expirationHours) {
  const customCodeInput = document.getElementById('linkCustomCode');
  const customCode = customCodeInput ? customCodeInput.value.trim() : '';
  
  const linkData = {
    id: linkId,
    created: Date.now(),
    expiration: expirationTime,
    maxUsage: maxUsage,
    usedCount: 0,
    expirationHours: expirationHours,
    status: "active",
    customCode: customCode || null  // Aggiungi il codice personalizzato
  };

  console.log("Salvando link con dati:", linkData);

  // Salva su Firebase
  database
    .ref("secure_links/" + linkId)
    .set(linkData)
    .then(() => {
      console.log("Link salvato su Firebase con successo");
      updateActiveLinksList();
      updateLinkStatistics();
      
      // Pulisci il campo del codice personalizzato
      if (customCodeInput) {
        customCodeInput.value = '';
      }
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
          if (link.customCode) {
            linkElement.innerHTML += `<div style="font-size: 11px; color: var(--primary); margin-top: 5px;">
      <i class="fas fa-key"></i> Codice dedicato: ${link.customCode}
    </div>`;
          }

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

// Aggiungi dopo le altre funzioni

// Funzione per ripristinare la sessione locale
document.getElementById("btnResetLocalSession").addEventListener("click", function() {
    if (confirm("Sei sicuro di voler ripristinare la sessione locale? Questo cancellerà tutti i dati di sessione sul dispositivo corrente.")) {
        resetLocalSession();
    }
});

function resetLocalSession() {
    try {
        // Salva le impostazioni importanti prima del reset
        const secretCode = localStorage.getItem("secret_code");
        const maxClicks = localStorage.getItem("max_clicks");
        const timeLimit = localStorage.getItem("time_limit_minutes");
        const codeVersion = localStorage.getItem("code_version");
        
        // Pulisci tutti i dati di sessione
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Mantieni le impostazioni di sistema, rimuovi solo i dati di sessione
            if (!key.startsWith("secret_code") && 
                !key.startsWith("max_clicks") && 
                !key.startsWith("time_limit_minutes") &&
                !key.startsWith("code_version") &&
                !key.startsWith("checkin_") &&
                !key.startsWith("devices") &&
                !key.startsWith("secure_links") &&
                key !== "adminAuthenticated") {
                keysToRemove.push(key);
            }
        }
        
        // Rimuovi le chiavi di sessione
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        // Pulisci anche i cookie correlati
        clearSessionCookies();
        
        // Mostra risultato
        const resultDiv = document.getElementById("localResetResult");
        resultDiv.innerHTML = `
            <div class="success-message">
                <i class="fas fa-check-circle"></i>
                Sessione locale ripristinata con successo!
            </div>
            <div class="reset-info">
                <p><strong>Azioni eseguite:</strong></p>
                <ul>
                    <li>Puliti dati di sessione</li>
                    <li>Puliti cookie di sessione</li>
                    <li>Mantenute impostazioni di sistema</li>
                    <li>Fai refresh alla pagina</li
                </ul>
                <p>Ora puoi tornare alla schermata principale e inserire nuovamente il codice.</p>
            </div>
        `;
        
        // Nascondi il risultato dopo 5 secondi
        setTimeout(() => {
            resultDiv.innerHTML = '';
        }, 5000);
        
        console.log("Sessione locale ripristinata");
        
    } catch (error) {
        console.error("Errore nel ripristino della sessione locale:", error);
        const resultDiv = document.getElementById("localResetResult");
        resultDiv.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                Errore nel ripristino: ${error.message}
            </div>
        `;
    }
}

// Funzione per pulire i cookie di sessione
function clearSessionCookies() {
    try {
        const cookies = document.cookie.split(";");
        for (let cookie of cookies) {
            const [name] = cookie.trim().split("=");
            // Rimuovi i cookie di sessione (escludendo quelli importanti)
            if (name && !name.startsWith("adminAuthenticated")) {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            }
        }
    } catch (error) {
        console.error("Errore nella pulizia dei cookie:", error);
    }
}

// Funzione per verificare lo stato della sessione locale
function checkLocalSessionStatus() {
    try {
        const sessionData = {
            authVerified: localStorage.getItem("auth_verified"),
            authTimestamp: localStorage.getItem("auth_timestamp"),
            usageStartTime: localStorage.getItem("usage_start_time"),
            usageHash: localStorage.getItem("usage_hash"),
            devices: {}
        };
        
        // Controlla lo stato dei click per ogni dispositivo
        DEVICES.forEach(device => {
            sessionData.devices[device.storage_key] = localStorage.getItem(device.storage_key);
        });
        
        console.log("Stato sessione locale:", sessionData);
        return sessionData;
    } catch (error) {
        console.error("Errore nel controllo stato sessione:", error);
        return null;
    }
}


// Aggiungi dopo le altre funzioni

// Configurazione dispositivi per l'admin panel
const ADMIN_DEVICES = [
    {
        id: "e4b063f0c38c",
        auth_key: "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
        button_id: "btnOpenMainDoor",
        status_id: "mainDoorStatus",
        status_text_id: "mainDoorStatusText",
        result_id: "mainDoorResult",
        name: "Porta Principale"
    },
    {
        id: "34945478d595",
        auth_key: "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
        button_id: "btnOpenAptDoor",
        status_id: "aptDoorStatus",
        status_text_id: "aptDoorStatusText",
        result_id: "aptDoorResult",
        name: "Porta Appartamento"
    },
    {
        id: "3494547ab161",
        auth_key: "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
        button_id: "btnOpenExtraDoor1",
        status_id: "extraDoor1Status",
        status_text_id: "extraDoor1StatusText",
        result_id: "extraDoor1Result",
        name: "Porta Extra 1",
        container_id: "extraDoor1Admin"
    },
    {
        id: "placeholder_id_2",
        auth_key: "placeholder_auth_key_2",
        button_id: "btnOpenExtraDoor2",
        status_id: "extraDoor2Status",
        status_text_id: "extraDoor2StatusText",
        result_id: "extraDoor2Result",
        name: "Porta Extra 2",
        container_id: "extraDoor2Admin"
    }
];

// URL base per le API Shelly
const SHELLY_API_URL = "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";

// Inizializzazione controlli porte
function initDoorControls() {
    // Aggiorna visibilità porte extra
    updateExtraDoorsVisibility();
    
    // Aggiungi event listener per ogni porta
    ADMIN_DEVICES.forEach(device => {
        const button = document.getElementById(device.button_id);
        if (button) {
            button.addEventListener("click", () => {
                openDoor(device);
            });
        }
    });
    
    // Apertura multipla
    document.getElementById("btnOpenAllDoors").addEventListener("click", openAllDoors);
    document.getElementById("btnCheckAllDoors").addEventListener("click", checkAllDoorsStatus);
    
    // Verifica stato iniziale
    checkAllDoorsStatus();
}

// Aggiorna visibilità porte extra
function updateExtraDoorsVisibility() {
    try {
        const devices = JSON.parse(localStorage.getItem("devices")) || [];
        ADMIN_DEVICES.forEach((device, index) => {
            if (device.container_id) {
                const container = document.getElementById(device.container_id);
                if (container) {
                    if (devices.length > index && devices[index] && devices[index].visible) {
                        container.style.display = "block";
                    } else {
                        container.style.display = "none";
                    }
                }
            }
        });
    } catch (error) {
        console.error("Errore nell'aggiornamento visibilità porte:", error);
    }
}

// Funzione per aprire una porta
// Funzione per aprire una porta
async function openDoor(device) {
    const button = document.getElementById(device.button_id);
    const resultDiv = document.getElementById(device.result_id);
    
    // Disabilita il pulsante durante l'operazione
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Apertura in corso...';
    
    // Aggiorna stato
    updateDoorStatus(device, "working", "Apertura in corso...");
    
    try {
        const response = await fetch(SHELLY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: device.id,
                auth_key: device.auth_key,
                channel: 0,
                on: true,
                turn: "on",
            }),
        });

        console.log(`Risposta API ${device.name}:`, response);

        if (response.ok) {
            // Prova a parsare come JSON, ma gestisci il caso di risposta vuota
            let data;
            const responseText = await response.text();
            
            if (responseText.trim() === "") {
                // Risposta vuota - consideriamo successo
                data = { ok: true };
                console.log(`${device.name}: Risposta vuota, considerata successo`);
            } else {
                try {
                    data = JSON.parse(responseText);
                } catch (parseError) {
                    console.warn(`${device.name}: Risposta non JSON valida:`, responseText);
                    // Se non è JSON valido ma la risposta HTTP è ok, consideriamo successo
                    data = { ok: true };
                }
            }
            
            if (data && data.ok) {
                // Successo
                updateDoorStatus(device, "success", "Porta aperta con successo");
                resultDiv.innerHTML = `
                    <div class="success-message">
                        <i class="fas fa-check-circle"></i>
                        ${device.name} aperta con successo alle ${new Date().toLocaleTimeString()}
                    </div>
                `;
                
                // Registra l'apertura nel log
                logDoorAction(device.name, "success");
            } else {
                // La porta si è aperta ma la risposta non è standard
                updateDoorStatus(device, "success", "Porta aperta (risposta non standard)");
                resultDiv.innerHTML = `
                    <div class="success-message">
                        <i class="fas fa-check-circle"></i>
                        ${device.name} aperta con successo alle ${new Date().toLocaleTimeString()}
                        <br><small>Risposta API: ${responseText.substring(0, 100)}</small>
                    </div>
                `;
                
                logDoorAction(device.name, "success", "Risposta API non standard");
            }
        } else {
            throw new Error(`Errore HTTP: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error(`Errore apertura ${device.name}:`, error);
        updateDoorStatus(device, "error", "Errore nell'apertura");
        resultDiv.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                Errore nell'apertura di ${device.name}: ${error.message}
            </div>
        `;
        
        // Registra l'errore nel log
        logDoorAction(device.name, "error", error.message);
    } finally {
        // Riabilita il pulsante dopo 3 secondi
        setTimeout(() => {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-key"></i> Apri ' + device.name.split(' ')[0];
            
            // Pulisci il messaggio dopo 5 secondi
            setTimeout(() => {
                resultDiv.innerHTML = '';
            }, 5000);
        }, 3000);
    }
}
// Funzione per aprire tutte le porte
async function openAllDoors() {
    const results = [];
    
    for (const device of ADMIN_DEVICES) {
        // Salta le porte extra non visibili
        if (device.container_id) {
            const container = document.getElementById(device.container_id);
            if (container && container.style.display === "none") {
                continue;
            }
        }
        
        try {
            await openDoor(device);
            results.push({ device: device.name, status: "success" });
        } catch (error) {
            results.push({ device: device.name, status: "error", error: error.message });
        }
        
        // Aspetta 1 secondo tra un'apertura e l'altra
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Mostra riepilogo
    showBulkOperationResult("Apertura multipla completata", results);
}

// Funzione per verificare lo stato di tutte le porte
async function checkAllDoorsStatus() {
    ADMIN_DEVICES.forEach(device => {
        // Salta le porte extra non visibili
        if (device.container_id) {
            const container = document.getElementById(device.container_id);
            if (container && container.style.display === "none") {
                return;
            }
        }
        
        checkDoorStatus(device);
    });
}

// Funzione per verificare lo stato di una porta
async function checkDoorStatus(device) {
    try {
        // Simula una verifica di stato (puoi implementare una vera verifica API qui)
        // Per ora impostiamo uno stato "disponibile" di default
        updateDoorStatus(device, "success", "Porta disponibile");
    } catch (error) {
        updateDoorStatus(device, "error", "Stato non disponibile");
    }
}

// Aggiorna lo stato visivo della porta
function updateDoorStatus(device, status, message) {
    const statusIndicator = document.getElementById(device.status_id);
    const statusText = document.getElementById(device.status_text_id);
    
    // Rimuovi tutte le classi esistenti
    statusIndicator.className = "status-indicator";
    statusText.textContent = `Stato: ${message}`;
    
    switch (status) {
        case "success":
            statusIndicator.classList.add("status-on");
            break;
        case "error":
            statusIndicator.classList.add("status-off");
            break;
        case "working":
            statusIndicator.classList.add("status-working");
            break;
        default:
            statusIndicator.classList.add("status-unknown");
    }
}

// Mostra risultato operazioni multiple
function showBulkOperationResult(title, results) {
    const successCount = results.filter(r => r.status === "success").length;
    const errorCount = results.filter(r => r.status === "error").length;
    
    // Crea un popup o notifica con i risultati
    alert(`
${title}
\nSuccessi: ${successCount}
Errori: ${errorCount}
\nControlla i log per i dettagli.
    `);
}

// Registra le azioni delle porte per il logging
function logDoorAction(doorName, status, error = null) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        door: doorName,
        status: status,
        error: error,
        admin: true
    };
    
    // Salva nel localStorage per tracciamento
    try {
        const doorLogs = JSON.parse(localStorage.getItem("doorActionLogs")) || [];
        doorLogs.unshift(logEntry);
        // Mantieni solo gli ultimi 100 log
        if (doorLogs.length > 100) {
            doorLogs.splice(100);
        }
        localStorage.setItem("doorActionLogs", JSON.stringify(doorLogs));
    } catch (error) {
        console.error("Errore nel salvataggio log:", error);
    }
}

// Inizializza i controlli quando il DOM è pronto
document.addEventListener("DOMContentLoaded", function() {
    // ... codice esistente ...
    
    // Inizializza i controlli delle porte dopo il login
    if (localStorage.getItem("adminAuthenticated") === "true") {
        initDoorControls();
    }
});

// Aggiorna i controlli quando si caricano le impostazioni
async function loadSettings() {
    // ... codice esistente ...
    
    // Aggiorna visibilità porte extra
    updateExtraDoorsVisibility();
}