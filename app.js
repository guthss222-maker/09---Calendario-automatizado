// PIN do modo auditor (troque aqui). Atenção: fica visível no código da página; serve para evitar edições
// acidentais, não como segurança real. Para proteção de verdade, controle quem acessa o arquivo (ex.: SharePoint).
const AUDITOR_PIN = "auditor2026";
const AUDITOR_KEY = "cal-auditorias-auditor";

const STORAGE_KEY = "cal-auditorias-v5";
const LINK_STORAGE_KEY = "cal-auditorias-link-v5";

// Para renomear as fábricas, é só editar esta lista (a ordem define a ordem do painel)
const FACTORIES = ["Fábrica I", "Fábrica III - P1", "Fábrica III - P2", "Fábrica IV", "Fábrica VI", "Fábrica VII", "Fábrica VIII"];

// Para renomear ou incluir áreas, é só editar esta lista (a ordem define a ordem do seletor)
const AREAS = [
  "Cabine Seca 1",
  "Cabine Seca 2 ",
  "Cabine Seca 3 ",
  "Cabine Seca 4 ",
  "Cabine Seca Tropicalizado ",
  "Cabine Úmida 1 ",
  "Cabine Úmida 2",
  "Cabine Úmida 3 ",
  "Cabine Úmida 5",
  "Cabine Úmida 6",
  "Sala de preparação"
];

const initialAudits = [
  { id: 1, date: "2026-11-05", realDate: "2026-11-06", title: "Auditoria interna ISO 9001", factory: "Fábrica I", area: "Cabine Seca 1 - CME", people: ["Ana", "Carlos"], status: "Concluída", link: "https://app.powerbi.com/" },
  { id: 2, date: "2026-11-12", realDate: "", title: "Auditoria de fornecedor", factory: "Fábrica III - P1", area: "Cabine Úmida 1 - Normal", people: ["Carlos"], status: "Agendada", link: "" },
  { id: 3, date: "2026-11-18", realDate: "", title: "Auditoria ambiental", factory: "Fábrica IV", area: "Sala de preparação", people: ["Juliana", "Marcos"], status: "Falta passar para planilha", link: "" }
];

let auditsData = loadFromStorage(STORAGE_KEY, initialAudits);

let isAuditor = false;
try {
  isAuditor = sessionStorage.getItem(AUDITOR_KEY) === "1" || localStorage.getItem(AUDITOR_KEY) === "1";
} catch (error) {}

function applyMode() {
  document.body.classList.toggle("readonly", !isAuditor);
  document.getElementById("btnAuditorMode").textContent = isAuditor ? "🔓 Modo auditor · Sair" : "🔒 Entrar como auditor";
}

function setAuditor(on, remember) {
  isAuditor = on;
  try {
    if (on) {
      sessionStorage.setItem(AUDITOR_KEY, "1");
      if (remember) localStorage.setItem(AUDITOR_KEY, "1");
    } else {
      sessionStorage.removeItem(AUDITOR_KEY);
      localStorage.removeItem(AUDITOR_KEY);
    }
  } catch (error) {}
  applyMode();
  updateUI();
}

// Auditorias já salvas antes de existir o campo "Fábrica": tenta descobrir pelo texto da área (ex.: "Qualidade / Fábrica IV")
function inferFactory(audit) {
  const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const text = String(audit.area || "");
  const found = FACTORIES
    .filter(f => new RegExp(escapar(f) + "(?![\\p{L}\\p{N}])", "iu").test(text))
    .sort((a, b) => b.length - a.length)[0];
  return found || "";
}
auditsData.forEach(a => { if (a.factory === undefined) a.factory = inferFactory(a); });
let powerBiLink = loadFromStorage(LINK_STORAGE_KEY, "");
const currentDate = new Date();
let viewDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
let selectedDateIso = null;
let selectedAuditId = auditsData.length > 0 ? auditsData[0].id : null;

const todayIsoString = formatDateToISO(currentDate);

function loadFromStorage(key, defaultValue) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) { return defaultValue; }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auditsData));
    localStorage.setItem(LINK_STORAGE_KEY, JSON.stringify(powerBiLink));
  } catch (error) {}
}

function formatDateToISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateToBR(isoString) {
  if (!isoString) return "-";
  const [year, month, day] = isoString.split("-");
  return `${day}/${month}/${year}`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

// Texto exibido de cada situação (o valor interno salvo continua o mesmo)
const STATUS_LABELS = { "Falta passar para planilha": "Falta passar para planilha / PowerBI" };
function statusLabel(status) { return STATUS_LABELS[status] || status; }

function getAuditStatusInfo(audit) {
  if (audit.status === "Concluída" || audit.status === "Falta passar para planilha" || audit.status === "Não concluído") {
    return { status: audit.status, label: statusLabel(audit.status) };
  }
  const auditDate = new Date(audit.date + "T00:00:00");
  const todayDate = new Date(todayIsoString + "T00:00:00");

  if (auditDate < todayDate) {
    const diffDays = Math.ceil(Math.abs(todayDate - auditDate) / (1000 * 60 * 60 * 24));
    return { status: "Atrasado", label: `Atrasado (${diffDays} ${diffDays === 1 ? 'dia' : 'dias'})` };
  }
  return { status: audit.status || "Agendada", label: statusLabel(audit.status || "Agendada") };
}

function getSafeStatusClass(status) {
  return status.replace(/\s+/g, '-');
}

function renderSummary() {
  // Última realizada: situação "Concluída" ou "Falta passar para planilha" (já foi feita),
  // usando a data realizada quando existir, senão a data planejada.
  const done = auditsData
    .filter(a => a.status === "Concluída" || a.status === "Falta passar para planilha")
    .map(a => ({ audit: a, when: a.realDate || a.date }))
    .sort((x, y) => y.when.localeCompare(x.when));

  // Próxima: ainda "Agendada" e com data de hoje em diante (a mais próxima).
  const upcoming = auditsData
    .filter(isUpcoming)
    .sort((x, y) => x.date.localeCompare(y.date));

  const last = done[0];
  document.getElementById("lastTitle").textContent = last ? last.audit.title : "Nenhuma auditoria realizada ainda";
  document.getElementById("lastDate").textContent = last ? formatDateToBR(last.when) : "-";
  if (last) {
    const lv = getValidityInfo(last.when);
    const onde = [last.audit.factory, last.audit.area].filter(Boolean).join(" · ") || "Geral";
    document.getElementById("lastMeta").textContent = `${onde} · válida até ${formatDateToBR(lv.expiry)} (${lv.text})`;
  } else {
    document.getElementById("lastMeta").textContent = "";
  }

  const next = upcoming[0];
  if (next) {
    const diff = Math.round((new Date(next.date + "T00:00:00") - new Date(todayIsoString + "T00:00:00")) / 86400000);
    const quando = diff === 0 ? "hoje" : diff === 1 ? "amanhã" : `em ${diff} dias`;
    document.getElementById("nextTitle").textContent = next.title;
    document.getElementById("nextDate").textContent = formatDateToBR(next.date);
    document.getElementById("nextMeta").textContent = `${[next.factory, next.area].filter(Boolean).join(" · ") || "Geral"} · ${quando}`;
  } else {
    document.getElementById("nextTitle").textContent = "Nenhuma auditoria agendada";
    document.getElementById("nextDate").textContent = "-";
    const atrasadas = auditsData.filter(isOverdue).length;
    document.getElementById("nextMeta").textContent = atrasadas > 0
      ? `⚠ ${atrasadas} ${atrasadas === 1 ? "auditoria atrasada" : "auditorias atrasadas"}`
      : "";
  }
}

// Validade de cada auditoria (em dias), contada a partir da data realizada (ou planejada, se não houver)
const VALIDITY_DAYS = 30;

const DONE_STATUSES = ["Concluída", "Falta passar para planilha"];

// Próxima = ainda não feita e com data de hoje em diante
function isUpcoming(a) { return !DONE_STATUSES.includes(a.status) && a.date >= todayIsoString; }
// Atrasada = ainda não feita e com data já passada
function isOverdue(a) { return getAuditStatusInfo(a).status === "Atrasado"; }

function addDaysISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return formatDateToISO(d);
}

function daysFromToday(iso) {
  return Math.round((new Date(iso + "T00:00:00") - new Date(todayIsoString + "T00:00:00")) / 86400000);
}

function getValidityInfo(baseIso) {
  const expiry = addDaysISO(baseIso, VALIDITY_DAYS);
  const left = daysFromToday(expiry);
  let cls = "ok";
  let text;
  if (left < 0) { cls = "bad"; text = `vencida há ${-left} ${-left === 1 ? "dia" : "dias"}`; }
  else if (left === 0) { cls = "warn"; text = "vence hoje"; }
  else { cls = left <= 7 ? "warn" : "ok"; text = `restam ${left} ${left === 1 ? "dia" : "dias"}`; }
  return { expiry, left, cls, text };
}

function renderFactories() {
  const grid = document.getElementById("factoryGrid");

  let html = FACTORIES.map((name) => {
    const list = auditsData.filter(a => a.factory === name);

    const last = list
      .filter(a => a.status === "Concluída" || a.status === "Falta passar para planilha")
      .map(a => ({ audit: a, when: a.realDate || a.date }))
      .sort((x, y) => y.when.localeCompare(x.when))[0];

    const next = list
      .filter(isUpcoming)
      .sort((x, y) => x.date.localeCompare(y.date))[0];

    const overdue = list
      .filter(isOverdue)
      .sort((x, y) => x.date.localeCompare(y.date))[0];

    const v = last ? getValidityInfo(last.when) : null;
    let lastHtml = `<div class="factory-row none"><span class="box-label">ÚLTIMA</span><b>Nenhuma ainda</b></div>`;
    if (last) {
      lastHtml = `<div class="factory-row last"><span class="box-label">ÚLTIMA</span><b>${formatDateToBR(last.when)}</b><span class="fm">${escapeHtml(last.audit.title)}</span><span class="validity ${v.cls}">Válida até ${formatDateToBR(v.expiry)} · ${v.text}</span></div>`;
    }

    let nextHtml = `<div class="factory-row warn"><span class="box-label">PRÓXIMA</span><b>Sem agendamento</b></div>`;
    if (next) {
      const diff = Math.round((new Date(next.date + "T00:00:00") - new Date(todayIsoString + "T00:00:00")) / 86400000);
      const quando = diff === 0 ? "hoje" : diff === 1 ? "amanhã" : `em ${diff} dias`;
      nextHtml = `<div class="factory-row next"><span class="box-label">PRÓXIMA</span><b>${formatDateToBR(next.date)}</b><span class="fm">${escapeHtml(next.title)} · ${quando}</span>${v && next.date > v.expiry ? '<span class="validity bad">⚠ Depois do vencimento da última</span>' : ""}</div>`;
    }

    if (overdue) {
      const dias = -daysFromToday(overdue.date);
      const aviso = `<span class="validity bad">⚠ Atrasada: ${formatDateToBR(overdue.date)} (${dias} ${dias === 1 ? "dia" : "dias"}) · ${escapeHtml(overdue.title)}</span>`;
      nextHtml = nextHtml.replace(/<\/div>$/, aviso + "</div>");
    }

    const cardCls = v ? (v.left < 0 ? " vencida" : v.left <= 7 ? " a-vencer" : "") : "";
    return `<div class="factory-card${cardCls}"><div class="factory-name">${escapeHtml(name)}</div>${lastHtml}${nextHtml}</div>`;
  }).join("");

  const semFabrica = auditsData.filter(a => !FACTORIES.includes(a.factory)).length;
  if (semFabrica > 0) {
    html += `<p class="factory-note">${semFabrica} ${semFabrica === 1 ? "auditoria sem fábrica definida" : "auditorias sem fábrica definida"} (não aparece${semFabrica === 1 ? "" : "m"} neste painel).</p>`;
  }

  grid.innerHTML = html;
}

// Tema: "" = segue o sistema (claro/escuro), "light" = sempre claro, "dark" = sempre escuro
const THEME_KEY = "cal-auditorias-theme";
const THEMES = [
  { value: "", label: "🌓 Auto" },
  { value: "light", label: "☀️ Claro" },
  { value: "dark", label: "🌙 Escuro" }
];
let themeValue = loadFromStorage(THEME_KEY, "");

function applyTheme() {
  const root = document.documentElement;
  if (themeValue) root.setAttribute("data-theme", themeValue);
  else root.removeAttribute("data-theme");
  const current = THEMES.find(t => t.value === themeValue) || THEMES[0];
  document.getElementById("btnTheme").textContent = current.label;
}

function closeAllMenus() {
  document.querySelectorAll(".status-menu-popup").forEach(m => m.classList.add("hidden"));
}

function renderDetailView() {
  const audit = auditsData.find(a => a.id === selectedAuditId);
  const badgeEl = document.getElementById("detailStatusBadge");

  if (!audit) {
    document.getElementById("detTitle").textContent = "Nenhuma auditoria selecionada";
    document.getElementById("detArea").textContent = "-";
    document.getElementById("detDatePlan").textContent = "-";
    document.getElementById("detDateReal").textContent = "-";
    document.getElementById("detValidity").textContent = "-";
    document.getElementById("detStatusText").textContent = "-";
    document.getElementById("detPeople").textContent = "-";
    document.getElementById("detLinkContainer").textContent = "-";
    badgeEl.textContent = "Sem seleção";
    badgeEl.style.background = "var(--mut)";
    return;
  }

  const info = getAuditStatusInfo(audit);
  document.getElementById("detTitle").textContent = audit.title;
  document.getElementById("detArea").textContent = [audit.factory, audit.area].filter(Boolean).join(" · ") || "Geral";
  document.getElementById("detDatePlan").textContent = formatDateToBR(audit.date);
  document.getElementById("detDateReal").textContent = formatDateToBR(audit.realDate);

  const validityEl = document.getElementById("detValidity");
  if (audit.status === "Concluída" || audit.status === "Falta passar para planilha") {
    const v = getValidityInfo(audit.realDate || audit.date);
    validityEl.textContent = `${formatDateToBR(v.expiry)} (${v.text})`;
    validityEl.style.color = v.cls === "bad" ? "var(--bad)" : v.cls === "warn" ? "var(--wn)" : "var(--ok)";
  } else {
    validityEl.textContent = "-";
    validityEl.style.color = "";
  }
  document.getElementById("detStatusText").innerHTML = `<b>${escapeHtml(info.label)}</b>`;
  document.getElementById("detPeople").textContent = audit.people.join(", ") || "Não atribuídos";

  badgeEl.textContent = info.label;
  if (info.status === "Concluída") badgeEl.style.background = "var(--ok)";
  else if (info.status === "Atrasado") badgeEl.style.background = "var(--bad)";
  else if (info.status === "Falta passar para planilha") badgeEl.style.background = "var(--wn)";
  else if (info.status === "Não concluído") badgeEl.style.background = "var(--mut)";
  else badgeEl.style.background = "var(--ac)";

  const linkContainer = document.getElementById("detLinkContainer");
  if (audit.link) {
    linkContainer.innerHTML = `<a href="${escapeHtml(audit.link)}" target="_blank" rel="noopener" style="color:var(--ac); font-weight:600;">Abrir Relatório ↗</a>`;
  } else {
    linkContainer.textContent = "Não associado";
  }
}

function renderCalendar() {
  const monthTitle = document.getElementById("monthTitle");
  const calendarGrid = document.getElementById("calendarGrid");

  monthTitle.textContent = viewDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  let htmlContent = "";
  ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].forEach(d => htmlContent += `<div class="dow">${d}</div>`);

  const startDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1 - viewDate.getDay());

  for (let i = 0; i < 42; i++) {
    const date = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate() + i);
    const dateIso = formatDateToISO(date);

    const isOutsideMonth = date.getMonth() !== viewDate.getMonth();
    const isToday = dateIso === todayIsoString;
    const isSelected = dateIso === selectedDateIso;

    let classNames = "day";
    if (isOutsideMonth) classNames += " out";
    if (isToday) classNames += " today";
    if (isSelected) classNames += " sel";

    const dayAudits = auditsData.filter((a) => a.date === dateIso);
    let chipsHtml = "";

    dayAudits.slice(0, 2).forEach((audit) => {
      const info = getAuditStatusInfo(audit);
      chipsHtml += `<span class="chip s-${getSafeStatusClass(info.status)}">${escapeHtml(audit.title)}</span>`;
    });
    if (dayAudits.length > 2) chipsHtml += `<span class="n">+${dayAudits.length - 2}</span>`;

    htmlContent += `<button class="${classNames}" data-date="${dateIso}"><span class="n">${date.getDate()}</span>${chipsHtml}</button>`;
  }
  calendarGrid.innerHTML = htmlContent;
}

function renderAuditList() {
  const listEl = document.getElementById("auditList");
  if (!auditsData.length) {
    listEl.innerHTML = `<li class="empty">Nenhuma tarefa registada.</li>`;
    return;
  }

  listEl.innerHTML = auditsData.map((audit) => {
    const info = getAuditStatusInfo(audit);
    const safeClass = getSafeStatusClass(info.status);

    return `
      <li class="it ${safeClass}" data-select-id="${audit.id}">
        <div style="flex:1;">
          <div class="t">${escapeHtml(audit.title)}</div>
          <div class="m">${formatDateToBR(audit.date)} · ${escapeHtml([audit.factory, audit.area].filter(Boolean).join(" · ") || "Geral")}</div>
        </div>
        <div class="a">

          <!-- Botão que abre o menu flutuante -->
          <div class="status-dropdown-wrapper">
            <button class="status-pill-btn s-${safeClass}" data-open-menu="${audit.id}"${isAuditor ? "" : " disabled"}>
              <span>${escapeHtml(info.label)}</span>
              <span class="status-arrow">▼</span>
            </button>

            <div class="status-menu-popup hidden" id="status-menu-${audit.id}">
              <button class="status-option-btn" data-set-status="${audit.id}" data-value="Agendada">
                <span class="status-dot dot-Agendada"></span> Agendada
              </button>
              <button class="status-option-btn" data-set-status="${audit.id}" data-value="Não concluído">
                <span class="status-dot dot-Não-concluído"></span> Não concluído
              </button>
              <button class="status-option-btn" data-set-status="${audit.id}" data-value="Falta passar para planilha">
                <span class="status-dot dot-Falta-passar-para-planilha"></span> Planilha / PowerBI
              </button>
              <button class="status-option-btn" data-set-status="${audit.id}" data-value="Concluída">
                <span class="status-dot dot-Concluída"></span> Concluída
              </button>
            </div>
          </div>

          <button class="edit-only" data-delete-id="${audit.id}">✕ Excluir</button>
        </div>
      </li>
    `;
  }).join("");
}

function updateUI() {
  renderSummary();
  renderFactories();
  renderCalendar();
  renderAuditList();
  renderDetailView();
  saveState();
}

function openPowerBiReport() {
  if (!powerBiLink) {
    if (!isAuditor) { alert("O link do Power BI ainda não foi configurado."); return; }
    const input = document.getElementById("powerBiLink");
    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  window.open(powerBiLink, "_blank", "noopener");
}

function registerEvents() {
  document.getElementById("btnPrevMonth").onclick = () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1); renderCalendar(); };
  document.getElementById("btnNextMonth").onclick = () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1); renderCalendar(); };

  document.getElementById("calendarGrid").onclick = (e) => {
    const dayBtn = e.target.closest(".day");
    if (!dayBtn) return;
    selectedDateIso = dayBtn.dataset.date;
    document.getElementById("inputDate").value = selectedDateIso;

    const found = auditsData.find(a => a.date === selectedDateIso);
    if (found) selectedAuditId = found.id;
    renderCalendar();
    renderDetailView();
  };

  document.getElementById("btnAddAudit").onclick = () => {
    if (!isAuditor) return;
    const date = document.getElementById("inputDate").value;
    const realDate = document.getElementById("inputRealDate").value;
    const title = document.getElementById("inputTitle").value.trim();

    if (!date || !title) {
      alert("Por favor, preencha a data e o título.");
      return;
    }

    const newAudit = {
      id: Date.now(),
      date,
      realDate,
      title,
      factory: document.getElementById("inputFactory").value,
      area: document.getElementById("inputArea").value.trim(),
      people: document.getElementById("inputPeople").value.split(",").map(s => s.trim()).filter(Boolean),
      status: document.getElementById("selectStatus").value,
      link: document.getElementById("inputLink").value.trim()
    };

    auditsData.push(newAudit);
    selectedAuditId = newAudit.id;

    ["inputTitle", "inputPeople", "inputLink", "inputRealDate"].forEach(id => document.getElementById(id).value = "");
    updateUI();
  };

  // Gestão de cliques na lista (abrir menu, alterar estado, excluir ou selecionar)
  document.getElementById("auditList").onclick = (e) => {
    // Somente auditores podem abrir o menu, mudar situação ou excluir; os demais só selecionam o item
    if (!isAuditor && (e.target.closest("[data-open-menu]") || e.target.closest("[data-set-status]") || e.target.closest("[data-delete-id]"))) return;
    const openBtn = e.target.closest("[data-open-menu]");
    const setStatusBtn = e.target.closest("[data-set-status]");
    const delBtn = e.target.closest("[data-delete-id]");
    const selLi = e.target.closest(".it");

    // 1. Abrir/Fechar menu flutuante (posicionado por cima de tudo)
    if (openBtn) {
      const menu = document.getElementById(`status-menu-${openBtn.dataset.openMenu}`);

      document.querySelectorAll(".status-menu-popup").forEach(m => {
        if (m !== menu) m.classList.add("hidden");
      });
      menu.classList.toggle("hidden");

      if (!menu.classList.contains("hidden")) {
        const r = openBtn.getBoundingClientRect();
        const menuH = menu.offsetHeight;
        const menuW = menu.offsetWidth;
        const cabeAbaixo = window.innerHeight - r.bottom > menuH + 12;

        menu.style.top = (cabeAbaixo ? r.bottom + 6 : r.top - menuH - 6) + "px";
        menu.style.left = Math.max(8, r.right - menuW) + "px";
      }
      return;
    }

    // 2. Mudar o estado ao clicar numa opção do menu
    if (setStatusBtn) {
      const auditId = setStatusBtn.dataset.setStatus;
      const newStatus = setStatusBtn.dataset.value;

      const audit = auditsData.find(a => a.id == auditId);
      if (audit) {
        audit.status = newStatus;
      }
      updateUI();
      return;
    }

    // 3. Excluir item
    if (delBtn) {
      const delId = delBtn.dataset.deleteId;
      auditsData = auditsData.filter(a => a.id != delId);
      if (selectedAuditId == delId) selectedAuditId = auditsData.length ? auditsData[0].id : null;
      updateUI();
      return;
    }

    // 4. Selecionar item para ver detalhes
    if (selLi) {
      selectedAuditId = Number(selLi.dataset.selectId);
      renderDetailView();
    }
  };

  // Fechar o menu flutuante ao clicar fora dele
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".status-dropdown-wrapper")) closeAllMenus();
  });

  // Fechar o menu se a página rolar ou a janela mudar de tamanho
  window.addEventListener("scroll", closeAllMenus, true);
  window.addEventListener("resize", closeAllMenus);

  document.getElementById("btnSaveLink").onclick = () => {
    if (!isAuditor) return;
    powerBiLink = document.getElementById("powerBiLink").value.trim();
    saveState();
    const btn = document.getElementById("btnSaveLink");
    btn.textContent = "Salvo!";
    setTimeout(() => btn.textContent = "Salvar link", 1500);
  };

  document.getElementById("btnTheme").onclick = () => {
    const idx = THEMES.findIndex(t => t.value === themeValue);
    themeValue = THEMES[(idx + 1) % THEMES.length].value;
    try { localStorage.setItem(THEME_KEY, JSON.stringify(themeValue)); } catch (error) {}
    applyTheme();
  };

  // Acesso do auditor (PIN)
  const authDialog = document.getElementById("authDialog");
  const authPin = document.getElementById("authPin");
  const authError = document.getElementById("authError");

  function tryLogin() {
    if (authPin.value === AUDITOR_PIN) {
      setAuditor(true, document.getElementById("authRemember").checked);
      authDialog.close();
    } else {
      authError.textContent = "PIN incorreto.";
      authPin.select();
    }
  }

  document.getElementById("btnAuditorMode").onclick = () => {
    if (isAuditor) { setAuditor(false); return; }
    authPin.value = "";
    authError.textContent = "";
    authDialog.showModal();
    authPin.focus();
  };
  document.getElementById("authOk").onclick = tryLogin;
  document.getElementById("authCancel").onclick = () => authDialog.close();
  authPin.addEventListener("keydown", (e) => { if (e.key === "Enter") tryLogin(); });

  document.getElementById("openTop").onclick = openPowerBiReport;
  document.getElementById("openBi").onclick = openPowerBiReport;
}

function init() {
  document.getElementById("inputArea").innerHTML = AREAS.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("");
  document.getElementById("inputFactory").innerHTML = FACTORIES.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join("");
  document.getElementById("powerBiLink").value = powerBiLink;
  document.getElementById("inputDate").value = todayIsoString;
  registerEvents();
  applyTheme();
  applyMode();
  updateUI();
}

init();