"use strict";

/* Estado, configuración y referencias */
const CONFIG = {
  maxFlightTime: 3600,
  pathSamples: 420,
  distanceSamples: 2400,
  animationMaxSeconds: 14,
  vectorMax: 54
};

const state = {
  params: null,
  samples: [],
  t: 0,
  running: false,
  paused: false,
  frame: null,
  lastStamp: null,
  durationScale: 1,
  transform: null
};

const $ = id => document.getElementById(id);
const dom = {
  form: $("controlsForm"),
  inputType: $("inputType"),
  polar: $("polarInputs"),
  components: $("componentInputs"),
  v0: $("v0"),
  angle: $("angle"),
  vx0: $("vx0"),
  vy0: $("vy0"),
  y0: $("y0"),
  mass: $("mass"),
  gravityPreset: $("gravityPreset"),
  customGravityGroup: $("customGravityGroup"),
  gravityCustom: $("gravityCustom"),
  showVectors: $("showVectors"),
  error: $("errorMsg"),
  pause: $("btnPausar"),
  reset: $("btnReiniciar"),
  clear: $("btnLimpiar"),
  canvas: $("simCanvas"),
  badge: $("statusBadge"),
  overlayRLabel: $("overlayRLabel"),
  overlayR: $("overlayR"),
  overlayH: $("overlayH"),
  overlayD: $("overlayD"),
  overlayT: $("overlayT"),
  overlayEquation: $("overlayEquation"),
  navToggle: $("navToggle"),
  navLinks: $("navLinks")
};

["T", "X", "Y", "Vx", "Vy", "Speed"].forEach(key => dom[`tele${key}`] = $(`tele${key}`));
["V0", "Vf", "ImpactAngle", "Tiempo", "E", "Momentum"].forEach(key => dom[`res${key}`] = $(`res${key}`));

const ctx = dom.canvas.getContext("2d");
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/* Utilidades y validación */
const finite = value => Number.isFinite(value);
const clean = value => Math.abs(value) < 1e-10 ? 0 : value;
const fmt = (value, digits = 2) => finite(value) ? clean(value).toFixed(digits) : "—";

function showError(message) {
  dom.error.textContent = message;
  dom.error.classList.remove("hidden");
}

function hideError() {
  dom.error.textContent = "";
  dom.error.classList.add("hidden");
}

function readInputs() {
  const inputMode = dom.inputType.value;
  const y0 = Number(dom.y0.value);
  const mass = Number(dom.mass.value);
  const g = Number(dom.gravityPreset.value === "custom" ? dom.gravityCustom.value : dom.gravityPreset.value);

  if (!finite(y0) || y0 < 0) return { error: "La altura inicial debe ser mayor o igual que cero." };
  if (!finite(mass) || mass <= 0) return { error: "La masa debe ser mayor que cero." };
  if (!finite(g) || g <= 0) return { error: "La gravedad debe ser mayor que cero." };

  let vx0;
  let vy0;
  let speed0;
  let angleDeg;

  if (inputMode === "polar") {
    speed0 = Number(dom.v0.value);
    angleDeg = Number(dom.angle.value);
    if (!finite(speed0) || speed0 < 0) return { error: "La rapidez inicial debe ser mayor o igual que cero." };
    if (!finite(angleDeg) || angleDeg < -90 || angleDeg > 90) return { error: "El ángulo debe estar entre −90° y 90°." };
    const radians = angleDeg * Math.PI / 180;
    vx0 = clean(speed0 * Math.cos(radians));
    vy0 = clean(speed0 * Math.sin(radians));
  } else {
    vx0 = Number(dom.vx0.value);
    vy0 = Number(dom.vy0.value);
    if (!finite(vx0) || !finite(vy0)) return { error: "Las componentes de velocidad deben ser números válidos." };
    speed0 = Math.hypot(vx0, vy0);
    angleDeg = Math.atan2(vy0, vx0) * 180 / Math.PI;
  }

  if (speed0 === 0 && y0 === 0) return { error: "Con altura y velocidad inicial iguales a cero, el impacto es inmediato." };
  return { data: { inputMode, y0, mass, g, vx0, vy0, speed0, angleDeg } };
}

/* Modelo físico */
function pointAtTime(p, rawTime) {
  const t = Math.max(0, Math.min(rawTime, p.flightTime));
  return {
    t,
    x: p.vx0 * t,
    y: Math.max(0, p.y0 + p.vy0 * t - .5 * p.g * t * t),
    vx: p.vx0,
    vy: p.vy0 - p.g * t
  };
}

function calculatePathDistance(p, segments = CONFIG.distanceSamples) {
  if (p.flightTime === 0) return 0;
  let total = 0;
  let previous = pointAtTime(p, 0);
  for (let index = 1; index <= segments; index += 1) {
    const current = pointAtTime(p, p.flightTime * index / segments);
    total += Math.hypot(current.x - previous.x, current.y - previous.y);
    previous = current;
  }
  return total;
}

function calculatePhysics(input) {
  const { y0, mass, g, vx0, vy0, speed0 } = input;
  const immediateImpact = y0 === 0 && vy0 <= 0;
  const discriminant = Math.max(0, vy0 * vy0 + 2 * g * y0);
  const flightTime = immediateImpact ? 0 : (vy0 + Math.sqrt(discriminant)) / g;

  if (!finite(flightTime) || flightTime < 0 || flightTime > CONFIG.maxFlightTime) {
    return { error: `El tiempo de vuelo debe estar entre 0 y ${CONFIG.maxFlightTime} s. Ajusta la gravedad o las condiciones iniciales.` };
  }

  const ascentTime = vy0 > 0 ? vy0 / g : 0;
  const extraHeight = vy0 > 0 ? vy0 * vy0 / (2 * g) : 0;
  const maxHeight = y0 + extraHeight;
  const displacement = vx0 * flightTime;
  const vyImpact = vy0 - g * flightTime;
  const impactSpeed = Math.hypot(vx0, vyImpact);
  const impactAngle = Math.atan2(vyImpact, vx0) * 180 / Math.PI;
  const mechanical = .5 * mass * speed0 * speed0 + mass * g * y0;

  const physics = {
    ...input,
    immediateImpact,
    flightTime,
    ascentTime,
    maxHeight,
    displacement,
    vyImpact,
    impactSpeed,
    impactAngle,
    mechanical,
    momentum: mass * speed0
  };
  physics.pathDistance = calculatePathDistance(physics);
  return physics;
}

function generatePath(p) {
  const count = p.flightTime === 0 ? 1 : CONFIG.pathSamples;
  return Array.from({ length: count + 1 }, (_, index) => pointAtTime(p, p.flightTime * index / count));
}

/* Resultados compactos */
function trajectoryEquation(p) {
  if (Math.abs(p.vx0) < 1e-9) return "Movimiento vertical: x = constante";
  const linear = p.vy0 / p.vx0;
  const quadratic = p.g / (2 * p.vx0 * p.vx0);
  return `y(x) = ${fmt(p.y0, 2)} ${linear < 0 ? "−" : "+"} ${fmt(Math.abs(linear), 3)}x − ${fmt(quadratic, 5)}x²`;
}

function renderResults(p) {
  dom.overlayRLabel.textContent = p.vx0 < 0 ? "Rmax · izquierda" : "Rmax";
  dom.overlayR.textContent = `${fmt(p.displacement)} m`;
  dom.overlayH.textContent = `${fmt(p.maxHeight)} m`;
  dom.overlayD.textContent = `${fmt(p.pathDistance)} m`;
  dom.overlayT.textContent = `${fmt(p.flightTime)} s`;
  dom.overlayEquation.textContent = trajectoryEquation(p);

  dom.resV0.textContent = fmt(p.speed0);
  dom.resVf.textContent = fmt(p.impactSpeed);
  dom.resImpactAngle.textContent = fmt(p.impactAngle);
  dom.resTiempo.textContent = fmt(p.flightTime);
  dom.resE.textContent = fmt(p.mechanical);
  dom.resMomentum.textContent = fmt(p.momentum);
}

function updateTelemetry(point) {
  const speed = Math.hypot(point.vx, point.vy);
  const values = { T: point.t, X: point.x, Y: point.y, Vx: point.vx, Vy: point.vy, Speed: speed };
  Object.entries(values).forEach(([key, value]) => {
    dom[`tele${key}`].textContent = fmt(value);
  });
}

/* Escala real y plano cartesiano */
function niceStep(rawStep) {
  if (!finite(rawStep) || rawStep <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / power;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * power;
}

function calculateTransform(p, width, height) {
  const margins = { left: 60, right: 28, top: 26, bottom: 50 };
  const drawWidth = Math.max(120, width - margins.left - margins.right);
  const drawHeight = Math.max(120, height - margins.top - margins.bottom);
  const minPathX = Math.min(0, p.displacement);
  const maxPathX = Math.max(0, p.displacement);
  const pathSpanX = Math.max(1, maxPathX - minPathX);
  const pathSpanY = Math.max(1, p.maxHeight);
  const paddedSpanX = pathSpanX * 1.18;
  const paddedSpanY = pathSpanY * 1.18;
  const scale = Math.max(.0001, Math.min(drawWidth / paddedSpanX, drawHeight / paddedSpanY));

  const centerX = (minPathX + maxPathX) / 2;
  const visibleSpanX = drawWidth / scale;
  const xMin = centerX - visibleSpanX / 2;
  const xMax = centerX + visibleSpanX / 2;
  const yMin = -Math.max(pathSpanY * .07, 10 / scale);
  const yMax = yMin + drawHeight / scale;
  const gridStep = niceStep(76 / scale);

  return {
    width,
    height,
    scale,
    gridStep,
    xMin,
    xMax,
    yMin,
    yMax,
    x: value => margins.left + (value - xMin) * scale,
    y: value => margins.top + (yMax - value) * scale
  };
}

function resizeCanvas() {
  const rect = dom.canvas.parentElement.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(300, rect.width);
  const height = Math.max(320, rect.height);

  dom.canvas.width = Math.floor(width * ratio);
  dom.canvas.height = Math.floor(height * ratio);
  dom.canvas.style.width = `${width}px`;
  dom.canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  if (state.params) {
    state.transform = calculateTransform(state.params, width, height);
    drawFrame();
  } else {
    drawEmpty(width, height);
  }
}

function drawEmpty(width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfcf8";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#607068";
  ctx.font = "13px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Configura las condiciones y presiona Lanzar", width / 2, height / 2);
  ctx.textAlign = "left";
}

function tickLabel(value, step) {
  const digits = step < 1 ? Math.min(3, Math.ceil(-Math.log10(step))) : 0;
  return clean(value).toFixed(digits);
}

function drawAxisArrow(x1, y1, x2, y2, color) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 8 * Math.cos(angle - .42), y2 - 8 * Math.sin(angle - .42));
  ctx.lineTo(x2 - 8 * Math.cos(angle + .42), y2 - 8 * Math.sin(angle + .42));
  ctx.closePath();
  ctx.fill();
}

function drawCartesianPlane(tr) {
  ctx.clearRect(0, 0, tr.width, tr.height);
  ctx.fillStyle = "#fbfcf8";
  ctx.fillRect(0, 0, tr.width, tr.height);

  const firstX = Math.ceil(tr.xMin / tr.gridStep) * tr.gridStep;
  const firstY = Math.max(0, Math.ceil(tr.yMin / tr.gridStep) * tr.gridStep);
  const xAxisY = tr.y(0);
  const yAxisX = tr.x(0);

  ctx.font = "10px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  for (let value = firstX; value <= tr.xMax + tr.gridStep * .01; value += tr.gridStep) {
    const px = tr.x(value);
    ctx.strokeStyle = Math.abs(value) < tr.gridStep * .01 ? "rgba(21,79,61,.32)" : "rgba(21,79,61,.10)";
    ctx.lineWidth = Math.abs(value) < tr.gridStep * .01 ? 1.3 : 1;
    ctx.beginPath();
    ctx.moveTo(px, 18);
    ctx.lineTo(px, tr.height - 38);
    ctx.stroke();
    if (xAxisY >= 18 && xAxisY <= tr.height - 38) {
      ctx.fillStyle = "#607068";
      ctx.fillText(tickLabel(value, tr.gridStep), px, Math.min(tr.height - 32, xAxisY + 7));
    }
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let value = firstY; value <= tr.yMax + tr.gridStep * .01; value += tr.gridStep) {
    const py = tr.y(value);
    ctx.strokeStyle = Math.abs(value) < tr.gridStep * .01 ? "rgba(21,79,61,.32)" : "rgba(21,79,61,.10)";
    ctx.lineWidth = Math.abs(value) < tr.gridStep * .01 ? 1.3 : 1;
    ctx.beginPath();
    ctx.moveTo(38, py);
    ctx.lineTo(tr.width - 18, py);
    ctx.stroke();
    ctx.fillStyle = "#607068";
    ctx.fillText(tickLabel(value, tr.gridStep), Math.max(34, yAxisX - 7), py);
  }

  const axisColor = "#52665d";
  drawAxisArrow(24, xAxisY, tr.width - 18, xAxisY, axisColor);
  if (yAxisX >= 24 && yAxisX <= tr.width - 18) drawAxisArrow(yAxisX, tr.height - 30, yAxisX, 16, axisColor);

  ctx.fillStyle = axisColor;
  ctx.font = "600 11px 'IBM Plex Mono', monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("x (m)", tr.width - 22, xAxisY - 7);
  if (yAxisX >= 24 && yAxisX <= tr.width - 18) {
    ctx.textAlign = "left";
    ctx.fillText("y (m)", yAxisX + 7, 25);
    ctx.beginPath();
    ctx.arc(yAxisX, xAxisY, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("O", yAxisX + 7, xAxisY - 7);
  }

  ctx.strokeStyle = "#52665d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(18, xAxisY);
  ctx.lineTo(tr.width - 18, xAxisY);
  ctx.stroke();
}

/* Trayectoria, indicadores y vectores */
function drawPath(limitTime, tr) {
  function strokePath(color, width, timeLimit, dash = []) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    let started = false;
    state.samples.forEach(point => {
      if (point.t > timeLimit + 1e-9) return;
      const px = tr.x(point.x);
      const py = tr.y(point.y);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  strokePath("rgba(35,114,89,.34)", 1.8, Infinity, [6, 6]);
  strokePath("#237259", 3, limitTime);
}

function drawPoint(x, y, color, tr) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(tr.x(x), tr.y(y), 5, 0, Math.PI * 2);
  ctx.fill();
}

function clampedLabel(text, x, y, tr, color = "#14261f") {
  ctx.font = "600 10px Inter, sans-serif";
  const width = ctx.measureText(text).width;
  const safeX = Math.max(6, Math.min(tr.width - width - 6, x));
  const safeY = Math.max(15, Math.min(tr.height - 8, y));
  ctx.fillStyle = "rgba(255,254,250,.9)";
  ctx.fillRect(safeX - 3, safeY - 11, width + 6, 15);
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, safeX, safeY);
}

function drawIndicators(p, tr) {
  const axisY = tr.y(0);
  const originX = tr.x(0);
  const impactX = tr.x(p.displacement);
  const apexXValue = p.vx0 * p.ascentTime;
  const apexX = tr.x(apexXValue);
  const apexY = tr.y(p.maxHeight);

  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1.2;

  if (p.vy0 > 0) {
    ctx.strokeStyle = "rgba(196,146,59,.82)";
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX, axisY);
    ctx.stroke();
    drawPoint(apexXValue, p.maxHeight, "#c4923b", tr);
    clampedLabel(`Hmax = ${fmt(p.maxHeight)} m`, apexX + 8, apexY - 8, tr, "#76581c");
  }

  ctx.strokeStyle = "rgba(165,58,50,.68)";
  ctx.beginPath();
  ctx.moveTo(originX, axisY);
  ctx.lineTo(impactX, axisY);
  ctx.stroke();
  ctx.setLineDash([]);
  drawPoint(p.displacement, 0, "#a53a32", tr);

  const direction = p.displacement < 0 ? "izquierda" : "derecha";
  const rText = Math.abs(p.displacement) < 1e-9
    ? "Rmax = 0.00 m"
    : `Rmax = ${fmt(p.displacement)} m · ${direction}`;
  clampedLabel(rText, (originX + impactX) / 2 - 45, axisY - 10, tr, "#7e332d");
  clampedLabel("Impacto", impactX + (p.displacement < 0 ? -48 : 8), axisY + 25, tr, "#7e332d");
  ctx.restore();
}

function drawArrow(x1, y1, dx, dy, color, label) {
  const length = Math.hypot(dx, dy);
  if (length < 2) return;
  const angle = Math.atan2(dy, dx);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + dx, y1 + dy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1 + dx, y1 + dy);
  ctx.lineTo(x1 + dx - 7 * Math.cos(angle - .45), y1 + dy - 7 * Math.sin(angle - .45));
  ctx.lineTo(x1 + dx - 7 * Math.cos(angle + .45), y1 + dy - 7 * Math.sin(angle + .45));
  ctx.closePath();
  ctx.fill();
  ctx.font = "600 10px 'IBM Plex Mono', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(label, x1 + dx + 4, y1 + dy - 4);
}

function drawVectors(point, px, py) {
  const cappedLength = value => Math.min(CONFIG.vectorMax, 12 + Math.abs(value) * 1.2) * Math.sign(value || 1);
  const vxLength = cappedLength(point.vx);
  const vyLength = -cappedLength(point.vy);
  const speed = Math.hypot(point.vx, point.vy);
  const totalLength = Math.min(CONFIG.vectorMax, 14 + speed);
  const angle = Math.atan2(-point.vy, point.vx);

  drawArrow(px, py, vxLength, 0, "#2b6cb0", "vₓ");
  drawArrow(px, py, 0, vyLength, "#c46a2d", "vᵧ");
  drawArrow(px, py, Math.cos(angle) * totalLength, Math.sin(angle) * totalLength, "#7b3f92", "v");
  drawArrow(px, py, 0, 40, "#a53a32", "g");
}

function drawProjectile(px, py) {
  const glow = ctx.createRadialGradient(px - 2, py - 3, 1, px, py, 10);
  glow.addColorStop(0, "#ffffff");
  glow.addColorStop(.25, "#4f9b7f");
  glow.addColorStop(1, "#154f3d");
  ctx.fillStyle = glow;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(px, py, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawFrame() {
  if (!state.params || !state.transform) return;
  const p = state.params;
  const tr = state.transform;
  const point = pointAtTime(p, state.t);

  drawCartesianPlane(tr);
  drawPath(state.t, tr);
  drawIndicators(p, tr);

  const px = tr.x(point.x);
  const py = tr.y(point.y);
  drawProjectile(px, py);
  if (dom.showVectors.checked) drawVectors(point, px, py);
  updateTelemetry(point);
}

/* Animación y estados */
function setBadge(type) {
  const labels = { idle: "En espera", running: "Simulando", paused: "En pausa", done: "Impacto" };
  dom.badge.className = `status-badge ${type === "idle" ? "" : type}`;
  dom.badge.textContent = labels[type];
}

function stopAnimation() {
  if (state.frame !== null) cancelAnimationFrame(state.frame);
  state.frame = null;
  state.lastStamp = null;
}

function animationStep(stamp) {
  if (!state.running || state.paused) return;
  if (state.lastStamp === null) state.lastStamp = stamp;
  const delta = Math.min(.05, (stamp - state.lastStamp) / 1000);
  state.lastStamp = stamp;
  state.t = Math.min(state.params.flightTime, state.t + delta * state.durationScale);
  drawFrame();

  if (state.t >= state.params.flightTime) {
    state.running = false;
    dom.pause.disabled = true;
    setBadge("done");
    stopAnimation();
  } else {
    state.frame = requestAnimationFrame(animationStep);
  }
}

function launch(event) {
  event?.preventDefault();
  hideError();
  const input = readInputs();
  if (input.error) {
    showError(input.error);
    return;
  }

  const result = calculatePhysics(input.data);
  if (result.error) {
    showError(result.error);
    return;
  }

  stopAnimation();
  state.params = result;
  state.samples = generatePath(result);
  state.t = 0;
  state.running = true;
  state.paused = false;
  state.durationScale = result.flightTime > CONFIG.animationMaxSeconds ? result.flightTime / CONFIG.animationMaxSeconds : 1;

  renderResults(result);
  resizeCanvas();
  dom.pause.disabled = result.flightTime === 0;
  dom.pause.textContent = "Pausar";

  if (result.flightTime === 0 || reducedMotion) {
    state.t = result.flightTime;
    state.running = false;
    dom.pause.disabled = true;
    setBadge("done");
    drawFrame();
  } else {
    setBadge("running");
    state.frame = requestAnimationFrame(animationStep);
  }
}

function togglePause() {
  if (!state.params || (!state.running && !state.paused)) return;
  if (state.paused) {
    state.paused = false;
    state.running = true;
    dom.pause.textContent = "Pausar";
    setBadge("running");
    state.frame = requestAnimationFrame(animationStep);
  } else {
    state.paused = true;
    stopAnimation();
    dom.pause.textContent = "Reanudar";
    setBadge("paused");
  }
}

function resetSimulation() {
  if (!state.params) return;
  stopAnimation();
  state.t = 0;
  state.running = true;
  state.paused = false;
  dom.pause.disabled = state.params.flightTime === 0;
  dom.pause.textContent = "Pausar";
  drawFrame();

  if (state.params.flightTime === 0 || reducedMotion) {
    state.t = state.params.flightTime;
    state.running = false;
    dom.pause.disabled = true;
    setBadge("done");
    drawFrame();
  } else {
    setBadge("running");
    state.frame = requestAnimationFrame(animationStep);
  }
}

function clearAll() {
  stopAnimation();
  state.params = null;
  state.samples = [];
  state.t = 0;
  state.running = false;
  state.paused = false;
  state.transform = null;

  dom.form.reset();
  dom.v0.value = 25;
  dom.angle.value = 45;
  dom.vx0.value = 17.68;
  dom.vy0.value = 17.68;
  dom.y0.value = 0;
  dom.mass.value = 1;
  dom.gravityPreset.value = "9.81";
  dom.gravityCustom.value = 9.81;
  updateInputVisibility();
  updateGravityVisibility();
  hideError();

  ["V0", "Vf", "ImpactAngle", "Tiempo", "E", "Momentum"].forEach(key => {
    dom[`res${key}`].textContent = "—";
  });
  updateTelemetry({ t: 0, x: 0, y: 0, vx: 0, vy: 0 });
  dom.overlayRLabel.textContent = "Rmax";
  dom.overlayR.textContent = "— m";
  dom.overlayH.textContent = "— m";
  dom.overlayD.textContent = "— m";
  dom.overlayT.textContent = "— s";
  dom.overlayEquation.textContent = "Sin calcular";
  dom.pause.disabled = true;
  dom.pause.textContent = "Pausar";
  setBadge("idle");
  resizeCanvas();
}

function updateInputVisibility() {
  const polarMode = dom.inputType.value === "polar";
  dom.polar.classList.toggle("hidden", !polarMode);
  dom.components.classList.toggle("hidden", polarMode);
}

function updateGravityVisibility() {
  dom.customGravityGroup.classList.toggle("hidden", dom.gravityPreset.value !== "custom");
}

/* Eventos */
dom.form.addEventListener("submit", launch);
dom.pause.addEventListener("click", togglePause);
dom.reset.addEventListener("click", resetSimulation);
dom.clear.addEventListener("click", clearAll);
dom.inputType.addEventListener("change", updateInputVisibility);
dom.gravityPreset.addEventListener("change", updateGravityVisibility);
dom.showVectors.addEventListener("change", drawFrame);

dom.navToggle.addEventListener("click", () => {
  const open = dom.navLinks.classList.toggle("open");
  dom.navToggle.setAttribute("aria-expanded", String(open));
});

dom.navLinks.addEventListener("click", event => {
  if (event.target.matches("a")) {
    dom.navLinks.classList.remove("open");
    dom.navToggle.setAttribute("aria-expanded", "false");
  }
});

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resizeCanvas, 120);
});

window.addEventListener("DOMContentLoaded", () => {
  updateInputVisibility();
  updateGravityVisibility();
  resizeCanvas();
  launch();
});
