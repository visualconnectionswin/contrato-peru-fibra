/***************************************
 * ESTADO
 ***************************************/
const STORAGE_KEY = "perufibra_planes_v1";

let state = {
  documentType: "dni",
  vInicial: "",
  mInicial: "",
  vPosterior: "",
  mPosterior: "",
  precioMensual: "",
  precioInstalacion: ""
};

let savedPlans = [];
let selectedPlanId = null;
let currentUbigeoValue = "";
let ubigeoDisplayText = "";

/***************************************
 * UBIGEO
 ***************************************/
function updateUbigeoDisplay() {
  const input = document.getElementById("ubigeoInput");
  if (!input) return;
  currentUbigeoValue = input.value.trim();
  const parts = [];

  if (currentUbigeoValue.length >= 2) {
    const deptData = ubigeoData[currentUbigeoValue.substr(0, 2)];
    if (deptData) {
      parts.push(`Departamento: ${deptData.departamento}`);
      if (currentUbigeoValue.length >= 4) {
        const provData = deptData.provincias[currentUbigeoValue.substr(2, 2)];
        if (provData) {
          parts.push(`Provincia: ${provData.provincia}`);
          if (currentUbigeoValue.length >= 6) {
            const distName = provData.distritos[currentUbigeoValue.substr(4, 2)];
            if (distName) parts.push(`Distrito: ${distName}`);
          }
        }
      }
    }
  }
  ubigeoDisplayText = parts.join(", ");
  const display = document.getElementById("ubigeoDisplay");
  if (display) display.innerText = ubigeoDisplayText;
}

/***************************************
 * HELPERS
 ***************************************/
const isFilled = (v) => v !== "" && v !== null && !isNaN(parseFloat(v));

function fmtNum(v) {
  const n = parseFloat(v);
  return Number.isInteger(n) ? String(n) : String(n);
}

// Velocidad / mínimo -> "500 Mbps" o placeholder resaltado
function mbps(v) {
  return isFilled(v)
    ? `<strong class="bold-keyword"><span style="font-size:1.2em;">${fmtNum(v)} Mbps</span></strong>`
    : `<span class="pending">[---] Mbps</span>`;
}

// Soles -> "S/ 99.90" o placeholder resaltado
function soles(v, placeholder) {
  return isFilled(v)
    ? `<strong class="bold-keyword"><span style="font-size:1.2em;">S/ ${parseFloat(v).toFixed(2)}</span></strong>`
    : `<span class="pending">${placeholder}</span>`;
}

function plainSoles(v) {
  return isFilled(v) ? `S/ ${parseFloat(v).toFixed(2)}` : "S/ --";
}

/***************************************
 * PLANES GUARDADOS (localStorage)
 ***************************************/
function loadPlans() {
  try {
    savedPlans = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    savedPlans = [];
  }
}

function persistPlans() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPlans));
  } catch (e) {
    console.error("No se pudo guardar:", e);
  }
}

function renderSavedPlans() {
  const box = document.getElementById("savedPlans");
  if (!savedPlans.length) {
    box.innerHTML = `<div class="saved-empty">Aún no hay planes. Llena los campos y pulsa "Guardar como plan".</div>`;
    return;
  }
  box.innerHTML = savedPlans.map((p) => `
    <div class="plan-card ${p.id === selectedPlanId ? "selected" : ""}" data-id="${p.id}">
      <button class="plan-del" data-del="${p.id}" title="Eliminar">✕</button>
      <div class="plan-name">${fmtNum(p.vInicial)} Mbps</div>
      <div class="plan-price">${plainSoles(p.precioMensual)}</div>
      <div class="plan-sub">luego ${fmtNum(p.vPosterior)} Mbps</div>
    </div>
  `).join("");

  box.querySelectorAll(".plan-card").forEach((card) => {
    card.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-del")) return;
      applyPlan(this.getAttribute("data-id"));
    });
  });
  box.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      const id = this.getAttribute("data-del");
      savedPlans = savedPlans.filter((p) => p.id !== id);
      if (selectedPlanId === id) selectedPlanId = null;
      persistPlans();
      renderSavedPlans();
    });
  });
}

function syncInputsFromState() {
  ["vInicial", "mInicial", "vPosterior", "mPosterior", "precioMensual", "precioInstalacion"].forEach((k) => {
    document.getElementById(k).value = state[k];
  });
}

function applyPlan(id) {
  const p = savedPlans.find((x) => x.id === id);
  if (!p) return;
  selectedPlanId = id;
  ["vInicial", "mInicial", "vPosterior", "mPosterior", "precioMensual", "precioInstalacion"].forEach((k) => {
    state[k] = p[k];
  });
  syncInputsFromState();
  renderSavedPlans();
  updateContract();
}

/***************************************
 * SPEECH
 ***************************************/
function generateSpeech() {
  const { vInicial, precioMensual, precioInstalacion } = state;
  const vel = isFilled(vInicial) ? `${fmtNum(vInicial)} Mbps` : "[---] Mbps";
  const precio = isFilled(precioMensual) ? `S/ ${parseFloat(precioMensual).toFixed(2)}` : "S/ [--]";
  const inst = isFilled(precioInstalacion) ? `S/ ${parseFloat(precioInstalacion).toFixed(2)}` : "S/ [--]";

  let t = `<strong>(Nombre del cliente)</strong>, queremos asegurarnos de que tengas toda la información clara desde el inicio. Antes de la lectura del contrato, voy a confirmarte el plan y servicios contratados:<br><br>`;
  t += `Es un plan de <strong class="bold-keyword">${vel}</strong>, por un precio mensual de <strong class="bold-keyword">${precio}</strong> y el precio de instalación es de <strong class="bold-keyword">${inst}</strong>, ambos incluyen IGV.<br><br>`;
  t += `¿Es correcto?<br><strong class="bold-keyword">(CLIENTE RESPONDE).</strong><br><br>Ahora procederé con la lectura de contrato.`;
  return t;
}

/***************************************
 * CONTRATO
 ***************************************/
function updateContract() {
  moment.locale("es");
  const currentDate = moment();

  const isRuc = state.documentType === "ruc";
  const vi = isFilled(state.vInicial) ? fmtNum(state.vInicial) : "---";
  let summary = `LIMA - ${isRuc ? "RUC 20" : "DNI/CE/RUC 10"} - ${vi} Mbps`;
  if (isFilled(state.precioMensual)) summary += ` - ${plainSoles(state.precioMensual)}`;
  document.getElementById("planSummary").innerHTML = summary;

  let datosText;
  if (isRuc) {
    datosText = `<p>
        Nombre de la empresa (Razón social)<br>
        Datos del representante legal (Nombre completo, DNI)<br>
        Número de RUC (20…)<br>
        Correo electrónico para el envío de recibos<br>
        Su número de contacto<br>
        Dirección en la que se instalará el servicio
    </p>`;
  } else {
    datosText = `<p>
      Su nombre completo es<br>
      Su número de documento de identidad / CE / RUC (10…)<br>
      <div style="display: flex; align-items: center; margin: 4px 0;">
        <span style="margin-right: 8px;">Lugar y Fecha de Nacimiento</span>
        <input type="text" id="ubigeoInput" placeholder="Ubigeo" oninput="updateUbigeoDisplay()" style="width: 120px; padding: 4px; border: 1px solid #ccc; border-radius: 4px;" value="${currentUbigeoValue}">
        <span id="ubigeoDisplay" style="margin-left: 4px; font-size: 0.875rem; color: #4a5568;">${ubigeoDisplayText}</span>
      </div>
      Correo electrónico para el envío de recibos<br>
      Su número telefónico es<br>
      Dirección en la que se instalará el servicio
    </p>`;
  }

  const html = `
    <div>
      <div class="contract-section speech-section">
        <p class="font-bold text-base mb-2">SPEECH:</p>
        <p>${generateSpeech()}</p>
      </div>

      <p class="text-sm">
        Hoy ${currentDate.format("DD")} de ${currentDate.format("MMMM")} del ${currentDate.format("YYYY")}, en la ciudad de LIMA, usted contrata con PERÚ FIBRA, para ello me brinda los siguientes datos:
      </p>
      ${datosText}

      <div class="contract-section">
        <h3 class="font-bold text-base">FIBRA</h3>
        <p>
          El servicio de internet fijo postpago de PERÚ FIBRA, es ilimitado, 100% fibra óptica. Con velocidad simétrica de ${mbps(state.vInicial)} de carga y descarga, y aseguramos un mínimo de ${mbps(state.mInicial)} de carga y descarga por los próximos <strong class="bold-keyword">6 meses</strong>.
        </p>
        <br>
        <p>
          Posterior a este tiempo navegará a velocidad simétrica de ${mbps(state.vPosterior)} de carga y descarga, y aseguramos un mínimo de ${mbps(state.mPosterior)} de carga y descarga.
        </p>
        <br>
        <p>
          El servicio incluye un equipo terminal ONT (router) y cargador en comodato, los cuales deberá devolverlos en buenas condiciones al culminar el servicio o pagará el valor total de este equipamiento. El contrato tendrá plazo indeterminado y podrá ser resuelto de acuerdo a la normativa de condiciones de uso.
        </p>
        <br>
        <p>
          El precio mensual del plan es de ${soles(state.precioMensual, "[--]")} incluye I.G.V y el precio de instalación es de ${soles(state.precioInstalacion, "[Precio de Instalación]")} incluido IGV. La tarifa de reconexión es de <strong class="bold-keyword">S/ 10.00</strong>, incluye IGV.
        </p>
        <br>
        <p>
          La fecha de facturación es el <strong class="bold-keyword">04</strong> de cada mes y la fecha de vencimiento es el <strong class="bold-keyword">28</strong> del mismo mes. En caso de que el cierre de ciclo esté próximo, los días proporcionales del servicio serán facturados en el siguiente recibo.
        </p>
        <br>
        <p>
          El upgrade y tarifa promocional se aplicará mientras el servicio permanezca activo, se mantenga el mismo plan contratado y no sea suspendido a solicitud del cliente.
        </p>
      </div>

      <div class="contract-section">
        <p>
          Le agradeceré que diga fuerte y claramente que <strong class="bold-keyword">SÍ ACEPTA</strong> los términos de la presente contratación. <strong class="bold-keyword">CLIENTE RESPONDE SI</strong>.
        </p>
        <br>
        <p>
          PERÚ FIBRA realizará el tratamiento de datos personales para gestiones relacionadas con el servicio, se almacenarán sus datos en nuestro Banco de Datos de clientes de acuerdo a la normativa vigente. Podrás ejercer tus derechos ARCO escribiendo al correo protecciondedatos@perufibra.pe. Para más información visita www.perúfibra.pe.
        </p>
        <br>
        <p>
          ¿Declaras conocer la Política de Privacidad y autorizas de forma previa, expresa, informada e inequívoca el tratamiento de datos personales? <strong class="bold-keyword">(CLIENTE RESPONDE SÍ)</strong>.
        </p>
        <br>
        <p>
          ¿Aceptas el envío de comunicaciones comerciales, publicitarias y encuestas? <strong class="bold-keyword">(CLIENTE RESPONDE SÍ/NO)</strong>.
        </p>
      </div>

      <div class="contract-section">
        <p class="welcome">BIENVENIDO A PERÚ FIBRA.</p>
      </div>
    </div>
  `;

  document.getElementById("contractContent").innerHTML = html;
}

/***************************************
 * INICIALIZACIÓN
 ***************************************/
document.addEventListener("DOMContentLoaded", function () {
  loadPlans();
  renderSavedPlans();
  updateContract();

  // Tipo de cliente
  document.querySelectorAll("[data-doctype]").forEach((btn) => {
    btn.addEventListener("click", function () {
      document.querySelectorAll("[data-doctype]").forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      state.documentType = this.getAttribute("data-doctype");
      updateContract();
    });
  });

  // Campos manuales
  ["vInicial", "mInicial", "vPosterior", "mPosterior", "precioMensual", "precioInstalacion"].forEach((k) => {
    document.getElementById(k).addEventListener("input", function () {
      state[k] = this.value;
      selectedPlanId = null;
      renderSavedPlans();
      updateContract();
    });
  });

  // Guardar plan
  document.getElementById("btnSavePlan").addEventListener("click", function () {
    const required = ["vInicial", "mInicial", "vPosterior", "mPosterior", "precioMensual", "precioInstalacion"];
    if (!required.every((k) => isFilled(state[k]))) {
      alert("Completa todos los campos antes de guardar el plan.");
      return;
    }
    const plan = { id: "p" + Date.now() };
    required.forEach((k) => (plan[k] = state[k]));
    savedPlans.push(plan);
    selectedPlanId = plan.id;
    persistPlans();
    renderSavedPlans();
  });

  // Limpiar
  document.getElementById("btnClear").addEventListener("click", function () {
    ["vInicial", "mInicial", "vPosterior", "mPosterior", "precioMensual", "precioInstalacion"].forEach((k) => (state[k] = ""));
    selectedPlanId = null;
    currentUbigeoValue = "";
    ubigeoDisplayText = "";
    syncInputsFromState();
    renderSavedPlans();
    updateContract();
  });
});
