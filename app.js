const STORAGE_KEY = "organizer-weekly-tasks-v1";
const THEME_KEY = "organizer-theme";
const VIEW_KEY = "organizer-calendar-view";
const HOLIDAY_CACHE_PREFIX = "organizer-cl-holidays-";
const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const shortDayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const holidayNamesEs = {
  "New Year's Day": "Año Nuevo",
  "Good Friday": "Viernes Santo",
  "Holy Saturday": "Sábado Santo",
  "Labour Day": "Día del Trabajo",
  "Navy Day": "Día de las Glorias Navales",
  "Battle of Arica": "Asalto y Toma del Morro de Arica",
  "National Day of Indigenous Peoples": "Día Nacional de los Pueblos Indígenas",
  "Saint Peter and Saint Paul": "San Pedro y San Pablo",
  "Our Lady of Mount Carmel": "Virgen del Carmen",
  "Assumption of Mary": "Asunción de la Virgen",
  "National holiday": "Fiestas Patrias · Independencia Nacional",
  "Army Day": "Día de las Glorias del Ejército",
  "Columbus Day": "Encuentro de Dos Mundos",
  "Reformation Day": "Día Nacional de las Iglesias Evangélicas y Protestantes",
  "All Saints Day": "Día de Todos los Santos",
  "Immaculate Conception": "Inmaculada Concepción",
  "Christmas Day": "Navidad · Natividad del Señor"
};

let tasks = loadTasks();
let activeFilter = "all";
const requestedView = new URLSearchParams(location.search).get("view");
let viewMode = ["week", "month"].includes(requestedView) ? requestedView : (localStorage.getItem(VIEW_KEY) === "month" ? "month" : "week");
let anchorDate = new Date();
let selectedDate = localDateKey(new Date());
let holidays = new Map();
let loadedHolidayYears = new Set();

const $ = (selector) => document.querySelector(selector);
const form = $("#task-form");
const input = $("#task-input");
const daySelect = $("#day-select");
const grid = $("#calendar-grid");

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date = new Date()) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = result.getDay() || 7;
  result.setDate(result.getDate() - weekday + 1);
  return result;
}

function getWeekDays(date = anchorDate) {
  const monday = startOfWeek(date);
  return dayNames.map((name, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return { name, date: day, key: localDateKey(day), inPeriod: true };
  });
}

function getMonthDays(date = anchorDate) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    const weekdayIndex = (day.getDay() + 6) % 7;
    return {
      name: dayNames[weekdayIndex],
      date: day,
      key: localDateKey(day),
      inPeriod: day.getMonth() === date.getMonth()
    };
  });
}

function visibleDays() {
  return viewMode === "week" ? getWeekDays() : getMonthDays();
}

function loadTasks() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored.map(task => ({ ...task, date: task.date || null })) : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function formatShort(date) {
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(date).replace(".", "");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function matchesFilter(task) {
  return activeFilter === "all" || (activeFilter === "done" ? task.done : !task.done);
}

function render() {
  const days = visibleDays();
  renderPeriodHeader(days);
  populateDaySelect(days);
  renderBacklog(days);
  renderCalendar(days);
  updateProgress(days);
}

function renderPeriodHeader(days) {
  const today = new Date();
  const currentWeek = localDateKey(startOfWeek(today)) === localDateKey(startOfWeek(anchorDate));
  const currentMonth = today.getFullYear() === anchorDate.getFullYear() && today.getMonth() === anchorDate.getMonth();
  const monthLabel = capitalize(new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(anchorDate));

  $("#app-title").textContent = viewMode === "week" ? "Mi semana" : "Mi mes";
  $("#plan-label").textContent = viewMode === "week" ? "PLAN SEMANAL" : "PLAN MENSUAL";
  $("#period-title").textContent = viewMode === "week" ? (currentWeek ? "Esta semana" : `Semana del ${formatShort(days[0].date)}`) : (currentMonth ? `Este mes · ${monthLabel}` : monthLabel);
  $("#period-range").textContent = viewMode === "week" ? `${formatShort(days[0].date)} — ${formatShort(days[6].date)}` : `${anchorDate.getFullYear()} · ${tasks.filter(task => task.date && task.date.startsWith(`${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, "0")}`)).length} tareas`;
  $("#weekday-row").classList.toggle("visible", viewMode === "month");
  grid.className = `calendar-grid ${viewMode}-view`;
  document.querySelectorAll(".view-option").forEach(button => button.classList.toggle("active", button.dataset.view === viewMode));
}

function populateDaySelect(days) {
  const previousValue = daySelect.value;
  const unscheduled = new Option("Sin asignar · Pendientes", "");
  const options = days.map(day => new Option(`${day.name.slice(0, 3)} ${formatShort(day.date)}`, day.key));
  daySelect.replaceChildren(unscheduled, ...options);

  const preferred = selectedDate && days.some(day => day.key === selectedDate) ? selectedDate : previousValue;
  daySelect.value = days.some(day => day.key === preferred) ? preferred : "";
}

function renderBacklog(days) {
  const list = $("#backlog-list");
  const unassigned = tasks.filter(task => !task.date && matchesFilter(task));
  const totalPending = tasks.filter(task => !task.date && !task.done).length;
  list.replaceChildren();
  unassigned.forEach(task => list.append(createTaskElement(task, days, true)));
  $("#backlog-count").textContent = totalPending;
  $("#backlog-empty").hidden = unassigned.length > 0;
}

function renderCalendar(days) {
  const today = localDateKey(new Date());
  grid.replaceChildren();

  days.forEach(day => {
    const card = $("#day-template").content.firstElementChild.cloneNode(true);
    const dayTasks = tasks.filter(task => task.date === day.key && matchesFilter(task));
    const pendingCount = tasks.filter(task => task.date === day.key && !task.done).length;
    const holiday = holidays.get(day.key);

    card.dataset.date = day.key;
    card.setAttribute("aria-label", `Seleccionar ${day.name} ${formatShort(day.date)}`);
    card.classList.toggle("today", day.key === today);
    card.classList.toggle("selected", day.key === selectedDate);
    card.classList.toggle("outside-month", viewMode === "month" && !day.inPeriod);
    card.classList.toggle("is-holiday", Boolean(holiday));
    card.classList.toggle("empty", dayTasks.length === 0);
    card.querySelector(".day-name").textContent = day.name;
    card.querySelector(".day-date").textContent = viewMode === "month" ? day.date.getDate() : formatShort(day.date);
    card.querySelector(".day-count").textContent = pendingCount;

    if (holiday) {
      const marker = card.querySelector(".holiday-marker");
      const regional = holiday.global === false ? "Regional · " : "Feriado · ";
      marker.textContent = `${regional}${holiday.name}`;
      marker.title = holiday.global === false && holiday.counties?.length ? `Aplica en ${holiday.counties.join(", ")}` : "Feriado de Chile";
      marker.hidden = false;
    }

    const list = card.querySelector(".task-list");
    dayTasks.forEach(task => list.append(createTaskElement(task, days, false)));
    attachDayInteractions(card, day.key);
    grid.append(card);
  });
}

function createTaskElement(task, days, isBacklog) {
  const item = document.createElement("li");
  item.className = `task${task.done ? " done" : ""}${isBacklog ? " backlog-task" : ""}`;
  item.draggable = true;
  item.dataset.taskId = task.id;
  item.innerHTML = `<input class="task-check" type="checkbox" aria-label="Marcar tarea"><span class="task-text"></span><button class="delete-button" aria-label="Eliminar tarea" title="Eliminar">×</button>`;
  item.querySelector(".task-check").checked = task.done;
  item.querySelector(".task-text").textContent = task.text;
  item.querySelector(".task-check").addEventListener("change", event => {
    event.stopPropagation();
    toggleTask(task.id);
  });
  item.querySelector(".delete-button").addEventListener("click", event => {
    event.stopPropagation();
    deleteTask(task.id);
  });

  if (isBacklog) {
    const assign = document.createElement("select");
    assign.className = "quick-assign";
    assign.setAttribute("aria-label", `Asignar ${task.text} a un día`);
    assign.append(new Option("Asignar a un día…", ""), ...days.filter(day => viewMode === "week" || day.inPeriod).map(day => new Option(`${day.name.slice(0, 3)} ${formatShort(day.date)}`, day.key)));
    assign.addEventListener("change", event => {
      event.stopPropagation();
      if (assign.value) moveTask(task.id, assign.value);
    });
    item.append(assign);
  }

  item.addEventListener("dragstart", event => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    requestAnimationFrame(() => item.classList.add("dragging"));
  });
  item.addEventListener("dragend", () => {
    item.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach(element => element.classList.remove("drag-over"));
  });
  return item;
}

function attachDayInteractions(card, dateKey) {
  const select = () => {
    selectedDate = dateKey;
    daySelect.value = dateKey;
    render();
    $("#selection-hint").textContent = `Día seleccionado: ${capitalize(new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${dateKey}T00:00:00`)))}.`;
  };

  card.addEventListener("click", event => {
    if (!event.target.closest(".task")) select();
  });
  card.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target === card) {
      event.preventDefault();
      select();
    }
  });
  attachDropTarget(card, dateKey);
}

function attachDropTarget(element, destination) {
  element.addEventListener("dragover", event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    element.classList.add("drag-over");
  });
  element.addEventListener("dragleave", event => {
    if (!element.contains(event.relatedTarget)) element.classList.remove("drag-over");
  });
  element.addEventListener("drop", event => {
    event.preventDefault();
    element.classList.remove("drag-over");
    const id = event.dataTransfer.getData("text/plain");
    if (id) moveTask(id, destination);
  });
}

function updateProgress(days) {
  const periodKeys = new Set(days.filter(day => viewMode === "week" || day.inPeriod).map(day => day.key));
  const current = tasks.filter(task => task.date && periodKeys.has(task.date));
  const completed = current.filter(task => task.done).length;
  const percent = current.length ? Math.round(completed / current.length * 100) : 0;
  $("#progress-text").textContent = `${completed} de ${current.length} listas`;
  $("#progress-percent").textContent = `${percent}%`;
  $("#progress-bar").style.width = `${percent}%`;
}

function toggleTask(id) {
  tasks = tasks.map(task => task.id === id ? { ...task, done: !task.done } : task);
  saveTasks();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  saveTasks();
  render();
}

function moveTask(id, date) {
  tasks = tasks.map(task => task.id === id ? { ...task, date: date || null } : task);
  saveTasks();
  render();
}

function changePeriod(direction) {
  if (viewMode === "week") {
    anchorDate.setDate(anchorDate.getDate() + direction * 7);
  } else {
    anchorDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + direction, 1);
  }
  const days = visibleDays();
  selectedDate = viewMode === "week" ? days[0].key : localDateKey(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1));
  render();
  ensureVisibleHolidays();
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  tasks.push({ id: createId(), text, date: daySelect.value || null, done: false, createdAt: Date.now() });
  saveTasks();
  input.value = "";
  render();
  input.focus();
});

daySelect.addEventListener("change", () => {
  selectedDate = daySelect.value || null;
  render();
});

document.querySelectorAll(".filter").forEach(button => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter").forEach(item => item.classList.toggle("active", item === button));
  render();
}));

document.querySelectorAll(".view-option").forEach(button => button.addEventListener("click", () => {
  viewMode = button.dataset.view;
  localStorage.setItem(VIEW_KEY, viewMode);
  render();
  ensureVisibleHolidays();
}));

$("#previous-period").addEventListener("click", () => changePeriod(-1));
$("#next-period").addEventListener("click", () => changePeriod(1));
$("#go-today").addEventListener("click", () => {
  anchorDate = new Date();
  selectedDate = localDateKey(anchorDate);
  render();
  ensureVisibleHolidays();
});

$("#clear-completed").addEventListener("click", () => {
  tasks = tasks.filter(task => !task.done);
  saveTasks();
  render();
});

function setTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  $("#theme-toggle").textContent = theme === "dark" ? "☀" : "☾";
  localStorage.setItem(THEME_KEY, theme);
}

$("#theme-toggle").addEventListener("click", () => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark"));

function readHolidayCache(year) {
  try {
    const cached = JSON.parse(localStorage.getItem(`${HOLIDAY_CACHE_PREFIX}${year}`));
    return Array.isArray(cached?.items) ? cached.items : null;
  } catch {
    return null;
  }
}

function storeHolidays(items) {
  items.forEach(holiday => holidays.set(holiday.date, holiday));
}

async function loadHolidayYear(year) {
  if (loadedHolidayYears.has(year)) return;
  loadedHolidayYears.add(year);
  const cached = readHolidayCache(year);
  if (cached) storeHolidays(cached);

  try {
    let response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/CL`);
    let data;
    let items;
    if (response.ok) {
      data = await response.json();
      items = data.map(item => ({ date: item.date, name: item.localName || item.name, global: item.global, counties: item.counties }));
    } else {
      response = await fetch(`https://nagerholidays.com/api/v4/Holidays/CL/${year}`);
      if (!response.ok) throw new Error("No fue posible consultar los feriados");
      data = await response.json();
      items = data.map(item => ({ date: item.date, name: holidayNamesEs[item.name] || item.name, global: item.nationalHoliday, counties: item.subdivisionCodes }));
    }
    storeHolidays(items);
    localStorage.setItem(`${HOLIDAY_CACHE_PREFIX}${year}`, JSON.stringify({ updatedAt: Date.now(), items }));
  } catch {
    if (!cached) {
      loadedHolidayYears.delete(year);
      $("#holiday-status").textContent = "Feriados no disponibles · revisa tu conexión";
    }
  }
}

async function ensureVisibleHolidays() {
  const years = [...new Set(visibleDays().map(day => day.date.getFullYear()))];
  $("#holiday-status").textContent = "Actualizando feriados de Chile…";
  await Promise.all(years.map(loadHolidayYear));
  if (years.every(year => readHolidayCache(year))) $("#holiday-status").textContent = "Feriados públicos de Chile · guardados localmente";
  render();
}

attachDropTarget($("#backlog-panel"), null);
$("#weekday-row").replaceChildren(...shortDayNames.map(name => Object.assign(document.createElement("span"), { textContent: name })));
const longDate = capitalize(new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(new Date()));
$("#today-label").textContent = longDate;
setTheme(localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
render();
ensureVisibleHolidays();
