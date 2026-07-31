"use strict";

const EPS = 1e-8;
const MAX_FLIGHT_TIME = 3600;
const UNIT_FACTORS = {
  "mm": .001,
  "cm": .01,
  "m": 1,
  "km": 1000,
  "ms": .001,
  "s": 1,
  "min": 60,
  "cm/s": .01,
  "m/s": 1,
  "km/h": 1 / 3.6
};

const FIELD_DEFINITIONS = {
  v0: { input: "knownV0", unit: "unitV0", name: "velocidad inicial" },
  angle: { input: "knownAngle", name: "ángulo de lanzamiento" },
  x0: { input: "knownX0", unit: "unitX0", name: "posición horizontal inicial" },
  y0: { input: "knownY0", unit: "unitY0", name: "altura inicial" },
  y: { input: "knownY", unit: "unitY", name: "altura final o específica" },
  x: { input: "knownX", unit: "unitX", name: "desplazamiento horizontal" },
  t: { input: "knownT", unit: "unitT", name: "tiempo" },
  vx0: { input: "knownVx0", unit: "unitVx0", name: "velocidad horizontal inicial" },
  vy0: { input: "knownVy0", unit: "unitVy0", name: "velocidad vertical inicial" },
  vx: { input: "knownVx", unit: "unitVx", name: "velocidad horizontal final" },
  vy: { input: "knownVy", unit: "unitVy", name: "velocidad vertical final" },
  vf: { input: "knownVf", unit: "unitVf", name: "rapidez final" },
  g: { input: "knownG", name: "gravedad" }
};

const TARGET_TITLES = {
  components: "Componentes iniciales",
  timeMax: "Tiempo para alcanzar la altura máxima",
  maxHeight: "Hmax — Altura máxima desde el lanzamiento",
  flightTime: "Tiempo total de vuelo",
  range: "Rmax — Alcance desde el punto de lanzamiento",
  groundDistance: "Dmax — Distancia desde el origen del suelo",
  positionX: "Posición horizontal en un tiempo",
  positionY: "Posición vertical en un tiempo",
  velocityX: "Velocidad horizontal en un tiempo",
  velocityY: "Velocidad vertical en un tiempo",
  speed: "Rapidez en un tiempo",
  impact: "Velocidad de impacto",
  impactAngle: "Ángulo de impacto",
  timeAtHeight: "Tiempo para alcanzar una altura específica",
  heightAtX: "Altura al alcanzar una distancia horizontal",
  initialSpeed: "Velocidad inicial",
  initialAngle: "Ángulo de lanzamiento"
};

const DEPENDENCIAS = {
  components: [["v0", "angle"], ["vx0", "vy0"]],
  timeMax: [["vy0", "g"]],
  maxHeight: [["vy0", "y0", "g"]],
  flightTime: [["y0", "finalHeight", "vy0", "g"], ["y0", "finalHeight", "v0", "angle", "g"]],
  range: [["vx0", "endTime"], ["v0", "angle", "endTime"]],
  groundDistance: [["x0", "rangeSigned"]],
  positionX: [["x0", "vx0", "t"], ["x0", "v0", "angle", "t"]],
  positionY: [["y0", "vy0", "t", "g"], ["y0", "v0", "angle", "t", "g"]],
  velocityX: [["vx0", "t"], ["v0", "angle", "t"]],
  velocityY: [["vy0", "t", "g"], ["v0", "angle", "t", "g"]],
  speed: [["vx0", "vy0", "t", "g"], ["v0", "angle", "t", "g"], ["velocityX", "velocityY"]],
  impact: [["impactVx", "impactVy"], ["vx0", "vy0", "endTime", "g"], ["v0", "angle", "endTime", "g"]],
  impactAngle: [["impactVx", "impactVy"]],
  timeAtHeight: [["y0", "y", "vy0", "g"], ["y0", "y", "v0", "angle", "g"]],
  heightAtX: [["x", "vx0", "y0", "vy0", "g"], ["x", "v0", "angle", "y0", "g"]],
  initialSpeed: [["vx0", "vy0"], ["rangeInput", "angle", "g", "sameHeight"]],
  initialAngle: [["vx0", "vy0"], ["rangeInput", "v0", "g", "sameHeight"]]
};

const TARGET_OUTPUTS = {
  components: ["vx0", "vy0"],
  timeMax: ["ascentTime"],
  maxHeight: ["hmax"],
  flightTime: ["flightTime", "endTime"],
  range: ["rmax", "rangeSigned"],
  groundDistance: ["dmax", "xImpact"],
  positionX: ["positionX"],
  positionY: ["positionY"],
  velocityX: ["velocityX"],
  velocityY: ["velocityY"],
  speed: ["speed"],
  impact: ["impactVx", "impactVy", "impactSpeed"],
  impactAngle: ["impactAngle"],
  timeAtHeight: ["timeAtHeight"],
  heightAtX: ["heightAtX"],
  initialSpeed: ["v0"],
  initialAngle: ["angle"]
};

const FACT_LABELS = {
  v0: "v₀",
  angle: "θ",
  x0: "x₀",
  y0: "y₀",
  y: "altura final",
  finalHeight: "altura final definida",
  x: "desplazamiento x",
  t: "tiempo t",
  vx0: "v₀x",
  vy0: "v₀y",
  g: "gravedad",
  endTime: "tiempo de vuelo",
  rangeSigned: "Rmax",
  impactVx: "vx de impacto",
  impactVy: "vy de impacto",
  velocityX: "velocidad horizontal",
  velocityY: "velocidad vertical",
  rangeInput: "alcance",
  sameHeight: "misma altura"
};

const state = {
  solution: null,
  simulation: null,
  samples: [],
  time: 0,
  running: false,
  paused: false,
  frame: null,
  lastStamp: null,
  transform: null
};

const $ = id => document.getElementById(id);
const dom = {
  resolverTab: $("resolverTab"),
  freeTab: $("freeTab"),
  resolverMode: $("resolverMode"),
  freeMode: $("freeMode"),
  resolverForm: $("resolverForm"),
  solveButton: $("solveButton"),
  verticalDirectionGroup: $("verticalDirectionGroup"),
  verticalDirection: $("verticalDirection"),
  sameHeight: $("sameHeight"),
  heightIsFinal: $("heightIsFinal"),
  xIsRange: $("xIsRange"),
  timeIsFinal: $("timeIsFinal"),
  calculationGrid: $("calculationGrid"),
  resolverError: $("resolverError"),
  clearResolver: $("clearResolver"),
  solutionSection: $("solutionSection"),
  solutionPicker: $("solutionPicker"),
  procedureList: $("procedureList"),
  simulateResult: $("simulateResult"),
  freeForm: $("freeForm"),
  freeError: $("freeError"),
  simulationPanel: $("simulationPanel"),
  simulationSource: $("simulationSource"),
  loadedData: $("loadedData"),
  showVectors: $("showVectors"),
  playbackSpeed: $("playbackSpeed"),
  start: $("btnStart"),
  pause: $("btnPause"),
  reset: $("btnReset"),
  canvas: $("simCanvas"),
  badge: $("statusBadge"),
  overlayHmax: $("overlayHmax"),
  overlayYmax: $("overlayYmax"),
  overlayRmax: $("overlayRmax"),
  overlayDmax: $("overlayDmax"),
  overlayImpact: $("overlayImpact"),
  overlayTime: $("overlayTime"),
  overlayEquation: $("overlayEquation"),
  navToggle: $("navToggle"),
  navLinks: $("navLinks")
};

Object.values(FIELD_DEFINITIONS).forEach(definition => {
  definition.element = $(definition.input);
  definition.unitElement = definition.unit ? $(definition.unit) : null;
});
["T", "X", "Y", "Vx", "Vy", "Speed"].forEach(key => dom[`tele${key}`] = $(`tele${key}`));
["V0", "Angle", "Time", "Range", "GroundDistance", "MaxHeight", "YMax", "ImpactSpeed"].forEach(key => dom[`res${key}`] = $(`res${key}`));

const ctx = dom.canvas.getContext("2d");
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function finite(value) {
  return Number.isFinite(value);
}

function near(a, b, tolerance = 1e-5) {
  return finite(a) && finite(b) && Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

function clean(value) {
  return Math.abs(value) < EPS ? 0 : value;
}

function fmt(value, digits = 2) {
  if (!finite(value)) return "—";
  const cleaned = clean(value);
  return cleaned.toLocaleString("es-GT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function radians(degrees) {
  return degrees * Math.PI / 180;
}

function degrees(radiansValue) {
  return radiansValue * 180 / Math.PI;
}

function toSI(value, unit) {
  return value * (UNIT_FACTORS[unit] ?? 1);
}

function fromSI(value, unit) {
  return value / (UNIT_FACTORS[unit] ?? 1);
}

function selectedLaunchType() {
  return document.querySelector('input[name="launchType"]:checked')?.value ?? "parabolic";
}

function showMessage(element, message) {
  element.textContent = message;
  element.classList.remove("hidden");
}

function hideMessage(element) {
  element.textContent = "";
  element.classList.add("hidden");
}

function missingReason(names) {
  return `Faltan: ${names.join(", ")}.`;
}

function readKnownData(strict = false) {
  const data = {
    launchType: selectedLaunchType(),
    verticalDirection: dom.verticalDirection.value,
    sameHeight: dom.sameHeight.checked,
    heightIsFinal: dom.heightIsFinal.checked || dom.sameHeight.checked,
    xIsRange: dom.xIsRange.checked,
    timeIsFinal: dom.timeIsFinal.checked
  };

  for (const [key, definition] of Object.entries(FIELD_DEFINITIONS)) {
    const raw = definition.element.value.trim();
    if (raw === "") {
      data[key] = null;
      continue;
    }
    const numeric = Number(raw);
    if (!finite(numeric)) {
      return { error: `${definition.name[0].toUpperCase()}${definition.name.slice(1)} debe ser un número válido.` };
    }
    data[key] = definition.unitElement ? toSI(numeric, definition.unitElement.value) : numeric;
  }

  if (data.v0 !== null && data.v0 < 0) return { error: "La velocidad inicial debe ser mayor o igual que cero." };
  if (data.vf !== null && data.vf < 0) return { error: "La rapidez final debe ser mayor o igual que cero." };
  if (data.y0 !== null && data.y0 < 0) return { error: "La altura inicial respecto al suelo debe ser mayor o igual que cero." };
  if (data.y !== null && data.y < 0) return { error: "La altura final respecto al suelo debe ser mayor o igual que cero." };
  if (data.t !== null && data.t < 0) return { error: "El tiempo debe ser mayor o igual que cero." };
  if (data.g === null || data.g <= 0) return { error: "La gravedad debe ser mayor que cero." };
  if (data.angle !== null && (data.angle < -90 || data.angle > 90)) return { error: "El ángulo debe estar entre −90° y 90°." };

  if (data.sameHeight && data.y0 !== null) data.y = data.y0;
  const derived = deriveData(data);
  const compatibilityError = validateCompatibility(data, derived);
  if (compatibilityError) return { error: compatibilityError };

  if (strict && !finite(derived.g)) return { error: "Ingresa un valor válido para la gravedad." };
  return { data, derived };
}

function deriveData(raw) {
  const d = { ...raw };

  if (d.launchType === "horizontal") {
    d.angle = 0;
    d.vy0 = 0;
    if (d.vx0 === null && finite(d.v0)) d.vx0 = d.v0;
    if (d.v0 === null && finite(d.vx0)) d.v0 = Math.abs(d.vx0);
  }

  if (d.launchType === "vertical") {
    d.angle = d.verticalDirection === "up" ? 90 : -90;
    d.vx0 = 0;
    if (d.vy0 === null && finite(d.v0)) d.vy0 = (d.verticalDirection === "up" ? 1 : -1) * d.v0;
    if (d.v0 === null && finite(d.vy0)) d.v0 = Math.abs(d.vy0);
  }

  if (finite(d.v0) && finite(d.angle)) {
    const expectedVx = clean(d.v0 * Math.cos(radians(d.angle)));
    const expectedVy = clean(d.v0 * Math.sin(radians(d.angle)));
    if (!finite(d.vx0)) d.vx0 = expectedVx;
    if (!finite(d.vy0)) d.vy0 = expectedVy;
  }

  if (!finite(d.vx0) && finite(d.vx)) d.vx0 = d.vx;
  if (!finite(d.vy0) && d.timeIsFinal && finite(d.vy) && finite(d.t) && finite(d.g)) {
    d.vy0 = d.vy + d.g * d.t;
  }
  if (!finite(d.vx0) && d.xIsRange && d.timeIsFinal && finite(d.x) && finite(d.t) && d.t > EPS) {
    d.vx0 = d.x / d.t;
  }
  if (!finite(d.vy0) && d.heightIsFinal && d.timeIsFinal &&
      finite(d.y0) && finite(d.y) && finite(d.t) && d.t > EPS && finite(d.g)) {
    d.vy0 = (d.y - d.y0 + .5 * d.g * d.t * d.t) / d.t;
  }

  if (finite(d.vx0) && finite(d.vy0)) {
    if (!finite(d.v0)) d.v0 = Math.hypot(d.vx0, d.vy0);
    if (!finite(d.angle)) d.angle = degrees(Math.atan2(d.vy0, d.vx0));
  }

  if (!finite(d.vx) && finite(d.vx0)) d.vx = d.vx0;
  if (!finite(d.vy) && finite(d.vy0) && finite(d.g) && finite(d.t)) d.vy = d.vy0 - d.g * d.t;
  if (!finite(d.t) && finite(d.vy0) && finite(d.vy) && finite(d.g)) {
    const candidate = (d.vy0 - d.vy) / d.g;
    if (candidate >= -EPS) d.t = Math.max(0, candidate);
  }
  if (!finite(d.vf) && finite(d.vx) && finite(d.vy)) d.vf = Math.hypot(d.vx, d.vy);
  if (d.sameHeight && finite(d.y0)) d.y = d.y0;
  if (d.xIsRange && finite(d.x)) {
    d.rangeSigned = d.x;
    d.rmax = Math.abs(d.x);
  }
  if (finite(d.vx)) d.impactVx = d.vx;
  if (finite(d.vy)) d.impactVy = d.vy;
  if (finite(d.vf)) d.impactSpeed = d.vf;
  return d;
}

function validateCompatibility(raw, d) {
  if (raw.launchType === "horizontal" && finite(raw.vx0) && raw.vx0 < -EPS) {
    return "En el modo horizontal con θ = 0°, la velocidad horizontal inicial no puede ser negativa.";
  }
  if (raw.launchType === "vertical" && finite(raw.vy0)) {
    const expectedSign = raw.verticalDirection === "up" ? 1 : -1;
    if (raw.vy0 * expectedSign < -EPS) {
      return `La velocidad vertical inicial contradice la dirección “hacia ${raw.verticalDirection === "up" ? "arriba" : "abajo"}”.`;
    }
  }
  if (finite(raw.v0) && finite(d.angle)) {
    const expectedVx = clean(raw.v0 * Math.cos(radians(d.angle)));
    const expectedVy = clean(raw.v0 * Math.sin(radians(d.angle)));
    if (finite(raw.vx0) && !near(raw.vx0, expectedVx)) {
      return "La velocidad inicial y el ángulo son incompatibles con v₀x.";
    }
    if (finite(raw.vx) && !near(raw.vx, expectedVx)) {
      return "La velocidad horizontal final es incompatible con v₀ y θ; sin resistencia del aire, vx permanece constante.";
    }
    if (finite(raw.vy0) && !near(raw.vy0, expectedVy)) {
      return "La velocidad inicial y el ángulo son incompatibles con v₀y.";
    }
  }
  if (finite(raw.vx0) && finite(raw.vx) && !near(raw.vx0, raw.vx)) {
    return "Los datos son incompatibles: sin resistencia del aire, vx debe permanecer igual a v₀x.";
  }
  if (finite(raw.vf) && finite(raw.vx) && finite(raw.vy) && !near(raw.vf, Math.hypot(raw.vx, raw.vy))) {
    return "La rapidez final no coincide con las componentes de la velocidad final.";
  }
  if (raw.timeIsFinal && raw.heightIsFinal &&
      finite(raw.t) && finite(raw.y0) && finite(raw.y) && finite(d.vy0) && finite(raw.g)) {
    const expectedY = raw.y0 + d.vy0 * raw.t - .5 * raw.g * raw.t * raw.t;
    if (!near(raw.y, expectedY, 2e-4)) {
      return "La altura, el tiempo y la velocidad vertical ingresados son incompatibles entre sí.";
    }
  }
  if (raw.timeIsFinal && raw.xIsRange && finite(raw.t) && finite(raw.x) && finite(d.vx0)) {
    const expectedX = d.vx0 * raw.t;
    if (!near(raw.x, expectedX, 2e-4)) {
      return "El alcance, el tiempo total y la velocidad horizontal son incompatibles entre sí.";
    }
  }
  if (raw.sameHeight && finite(raw.y0) && finite(raw.y) && !near(raw.y0, raw.y)) {
    return "La altura final debe coincidir con la altura inicial cuando se marca “misma altura”.";
  }
  return "";
}

function solveHeightTimes(y0, vy0, g, targetY) {
  const discriminant = vy0 * vy0 - 2 * g * (targetY - y0);
  if (discriminant < -EPS) {
    return { error: "La altura solicitada es mayor que la altura máxima alcanzable." };
  }
  const root = Math.sqrt(Math.max(0, discriminant));
  const candidates = [(vy0 - root) / g, (vy0 + root) / g]
    .filter(value => value >= -EPS)
    .map(value => Math.max(0, value))
    .sort((a, b) => a - b);
  const times = candidates.filter((value, index) => index === 0 || !near(value, candidates[index - 1]));
  if (!times.length) return { error: "La altura solicitada no se alcanza durante el movimiento." };
  return { times, discriminant: Math.max(0, discriminant) };
}

function endTimeInfo(d) {
  if (finite(d.endTime)) {
    return { time: d.endTime, times: [d.endTime], targetY: finite(d.y) ? d.y : null, source: "calculated-time" };
  }
  if (d.timeIsFinal && finite(d.t)) {
    return { time: d.t, times: [d.t], targetY: finite(d.y) ? d.y : null, source: "time" };
  }
  if (finite(d.y0) && finite(d.y) && finite(d.vy0) && finite(d.g)) {
    const solved = solveHeightTimes(d.y0, d.vy0, d.g, d.y);
    if (solved.error) return solved;
    return { time: solved.times[solved.times.length - 1], times: solved.times, targetY: d.y, source: "height" };
  }
  return { error: "No se ha definido dónde termina el movimiento." };
}

function crearDatosIngresados(raw) {
  const datosIngresados = new Set();
  Object.keys(FIELD_DEFINITIONS).forEach(key => {
    if (finite(raw[key])) datosIngresados.add(key);
  });
  if (raw.sameHeight) datosIngresados.add("sameHeight");
  if (finite(raw.y) && (raw.heightIsFinal || raw.sameHeight)) datosIngresados.add("finalHeight");
  if (finite(raw.x) && raw.xIsRange) {
    datosIngresados.add("rangeInput");
    datosIngresados.add("rangeSigned");
    datosIngresados.add("rmax");
  }
  if (finite(raw.t) && raw.timeIsFinal) datosIngresados.add("endTime");
  if (raw.launchType === "horizontal") {
    datosIngresados.add("angle");
    datosIngresados.add("vy0");
  }
  if (raw.launchType === "vertical") {
    datosIngresados.add("angle");
    datosIngresados.add("vx0");
  }
  if (finite(raw.vx)) {
    datosIngresados.add("impactVx");
    datosIngresados.add("vx0");
  }
  if (finite(raw.vy)) datosIngresados.add("impactVy");
  if (finite(raw.vy) && raw.timeIsFinal && finite(raw.t) && finite(raw.g)) datosIngresados.add("vy0");
  if (finite(raw.vf)) datosIngresados.add("impactSpeed");
  return datosIngresados;
}

function validarObjetivoFisico(target, raw, d) {
  if (target === "timeMax" && finite(d.vy0) && d.vy0 <= EPS) {
    return { ok: false, reason: "La velocidad vertical debe apuntar hacia arriba." };
  }
  if ((target === "flightTime" || target === "timeAtHeight") &&
      [d.y0, d.y, d.vy0, d.g].every(finite)) {
    const times = solveHeightTimes(d.y0, d.vy0, d.g, d.y);
    if (times.error) return { ok: false, reason: times.error };
  }
  if (target === "heightAtX" && finite(d.vx0) && Math.abs(d.vx0) < EPS) {
    return { ok: false, reason: "v₀x debe ser distinta de cero." };
  }
  if (target === "initialSpeed") {
    if (finite(raw.v0)) return { ok: false, reason: "La velocidad inicial ya fue ingresada." };
    if (raw.sameHeight && finite(raw.x) && finite(raw.angle) && finite(raw.g)) {
      const denominator = Math.sin(2 * radians(raw.angle));
      if (Math.abs(denominator) < EPS || raw.g * raw.x / denominator < 0) {
        return { ok: false, reason: "El alcance y el ángulo no producen una velocidad inicial real." };
      }
    }
  }
  if (target === "initialAngle") {
    if (finite(raw.angle)) return { ok: false, reason: "El ángulo de lanzamiento ya fue ingresado." };
    if (raw.sameHeight && finite(raw.x) && raw.x > 0 && finite(raw.v0) && raw.v0 > 0 && finite(raw.g)) {
      const ratio = raw.g * raw.x / (raw.v0 * raw.v0);
      if (ratio > 1 + EPS) {
        return { ok: false, reason: "El alcance solicitado supera el máximo posible con esa velocidad." };
      }
    }
  }
  return { ok: true, reason: "" };
}

function rutaDisponible(target, facts) {
  return (DEPENDENCIAS[target] ?? []).find(route => route.every(fact => facts.has(fact))) ?? null;
}

function expandirObjetivos(baseFacts, targetIds, raw, d) {
  const facts = new Set(baseFacts);
  const resolved = new Set();
  const routes = new Map();
  let changed = true;
  while (changed) {
    changed = false;
    targetIds.forEach(target => {
      if (resolved.has(target)) return;
      const route = rutaDisponible(target, facts);
      const physical = validarObjetivoFisico(target, raw, d);
      if (!route || !physical.ok) return;
      resolved.add(target);
      routes.set(target, route);
      (TARGET_OUTPUTS[target] ?? []).forEach(fact => facts.add(fact));
      changed = true;
    });
  }
  return { facts, resolved, routes };
}

function resolverDisponibilidadRecursiva(raw, d) {
  const datosIngresados = crearDatosIngresados(raw);
  const allTargets = Object.keys(DEPENDENCIAS);
  const theoretical = expandirObjetivos(datosIngresados, allTargets, raw, d);
  let datosSeleccionados = new Set(
    [...dom.calculationGrid.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value)
  );
  let selectedClosure = expandirObjetivos(datosIngresados, [...datosSeleccionados], raw, d);
  const desactivados = [...datosSeleccionados].filter(target => !selectedClosure.resolved.has(target));

  if (desactivados.length) {
    desactivados.forEach(target => {
      const input = dom.calculationGrid.querySelector(`input[value="${target}"]`);
      if (input) input.checked = false;
    });
    datosSeleccionados = new Set([...datosSeleccionados].filter(target => !desactivados.includes(target)));
    selectedClosure = expandirObjetivos(datosIngresados, [...datosSeleccionados], raw, d);
  }

  return {
    datosIngresados,
    datosCalculables: theoretical.resolved,
    datosSeleccionados,
    datosDisponibles: selectedClosure.facts,
    objetivosResueltos: selectedClosure.resolved,
    rutasSeleccionadas: selectedClosure.routes,
    rutasCalculables: theoretical.routes,
    desactivados
  };
}

function productoresParaFaltantes(route, dependencyState) {
  const producers = [];
  route.forEach(fact => {
    if (dependencyState.datosDisponibles.has(fact)) return;
    const producer = Object.keys(TARGET_OUTPUTS).find(target =>
      (TARGET_OUTPUTS[target] ?? []).includes(fact) &&
      dependencyState.datosCalculables.has(target) &&
      !dependencyState.datosSeleccionados.has(target)
    );
    if (producer && !producers.includes(producer)) producers.push(producer);
  });
  return producers;
}

function mensajeBloqueo(target, dependencyState) {
  const routes = DEPENDENCIAS[target] ?? [];
  let bestRoute = routes[0] ?? [];
  routes.forEach(route => {
    const missing = route.filter(fact => !dependencyState.datosDisponibles.has(fact)).length;
    const bestMissing = bestRoute.filter(fact => !dependencyState.datosDisponibles.has(fact)).length;
    if (missing < bestMissing) bestRoute = route;
  });
  const producers = productoresParaFaltantes(bestRoute, dependencyState);
  if (producers.length) {
    return `Puede habilitarse calculando primero ${producers.map(target => TARGET_TITLES[target]).join(" y ")}.`;
  }
  const missing = bestRoute
    .filter(fact => !dependencyState.datosDisponibles.has(fact))
    .map(fact => FACT_LABELS[fact] ?? fact);
  return missingReason(missing);
}

function detectarDependenciasCirculares(dependencyState) {
  const graph = new Map();
  dependencyState.datosSeleccionados.forEach(target => {
    const route = dependencyState.rutasSeleccionadas.get(target) ?? [];
    const dependencies = route
      .map(fact => Object.keys(TARGET_OUTPUTS).find(candidate =>
        dependencyState.datosSeleccionados.has(candidate) &&
        (TARGET_OUTPUTS[candidate] ?? []).includes(fact)
      ))
      .filter(Boolean);
    graph.set(target, dependencies);
  });
  const visiting = new Set();
  const visited = new Set();
  const visit = target => {
    if (visiting.has(target)) return true;
    if (visited.has(target)) return false;
    visiting.add(target);
    if ((graph.get(target) ?? []).some(visit)) return true;
    visiting.delete(target);
    visited.add(target);
    return false;
  };
  return [...graph.keys()].some(visit);
}

function updateLaunchTypeUI() {
  const type = selectedLaunchType();
  const angle = FIELD_DEFINITIONS.angle.element;
  const fixedAngle = type === "horizontal" ? 0 : dom.verticalDirection.value === "up" ? 90 : -90;

  dom.verticalDirectionGroup.classList.toggle("hidden", type !== "vertical");
  document.querySelectorAll(".quantity-field").forEach(field => {
    field.classList.toggle("hidden", !field.dataset.types.split(" ").includes(type));
  });
  document.querySelectorAll(".calculation-option").forEach(option => {
    option.classList.toggle("context-hidden", !option.dataset.types.split(" ").includes(type));
  });

  if (type === "parabolic") {
    angle.readOnly = false;
    if (angle.dataset.automatic === "true") angle.value = "";
    angle.dataset.automatic = "false";
    $("angleHint").textContent = "Entre −90° y 90°.";
  } else {
    angle.value = String(fixedAngle);
    angle.readOnly = true;
    angle.dataset.automatic = "true";
    $("angleHint").textContent = "Se establece automáticamente según el tipo de lanzamiento.";
  }
  updateSameHeight();
  updateOptionsAvailable();
}

function updateSameHeight() {
  const y0Definition = FIELD_DEFINITIONS.y0;
  const yDefinition = FIELD_DEFINITIONS.y;
  yDefinition.element.disabled = dom.sameHeight.checked;
  yDefinition.unitElement.disabled = dom.sameHeight.checked;
  if (dom.sameHeight.checked) {
    if (!dom.heightIsFinal.checked) dom.heightIsFinal.dataset.automatic = "true";
    dom.heightIsFinal.checked = true;
    dom.heightIsFinal.disabled = true;
  } else {
    dom.heightIsFinal.disabled = false;
    if (dom.heightIsFinal.dataset.automatic === "true") dom.heightIsFinal.checked = false;
    dom.heightIsFinal.dataset.automatic = "false";
  }
  if (dom.sameHeight.checked) {
    const rawY0 = y0Definition.element.value.trim();
    if (rawY0 === "") {
      yDefinition.element.value = "";
    } else {
      const y0SI = toSI(Number(rawY0), y0Definition.unitElement.value);
      yDefinition.element.value = String(clean(fromSI(y0SI, yDefinition.unitElement.value)));
    }
  }
}

function updateOptionsAvailable(announceLoss = false) {
  const read = readKnownData(false);
  if (read.error) {
    document.querySelectorAll(".calculation-option").forEach(option => {
      const checkbox = option.querySelector("input");
      const reason = option.querySelector(".availability-reason");
      checkbox.disabled = true;
      checkbox.checked = false;
      option.classList.remove("available-direct", "available-via", "selected-result", "dependency-lost");
      option.classList.add("unavailable");
      option.title = read.error;
      reason.textContent = read.error;
    });
    dom.solveButton.disabled = true;
    state.dependencyState = null;
    return;
  }

  const dependencyState = resolverDisponibilidadRecursiva(read.data, read.derived);
  state.dependencyState = dependencyState;

  document.querySelectorAll(".calculation-option").forEach(option => {
    const checkbox = option.querySelector("input");
    const reason = option.querySelector(".availability-reason");
    const target = checkbox.value;
    const physical = validarObjetivoFisico(target, read.data, read.derived);
    const directRoute = rutaDisponible(target, dependencyState.datosIngresados);
    const selectedRoute = rutaDisponible(target, dependencyState.datosDisponibles);
    const selected = dependencyState.datosSeleccionados.has(target);
    const available = physical.ok && Boolean(selectedRoute);

    option.classList.remove("available-direct", "available-via", "selected-result", "unavailable", "dependency-lost");
    checkbox.disabled = !available;

    let message;
    if (!physical.ok) {
      message = physical.reason;
      option.classList.add("unavailable");
    } else if (selected) {
      const producers = Object.keys(TARGET_OUTPUTS).filter(candidate =>
        candidate !== target &&
        dependencyState.datosSeleccionados.has(candidate) &&
        selectedRoute.some(fact => (TARGET_OUTPUTS[candidate] ?? []).includes(fact))
      );
      message = producers.length
        ? `Se calculará usando: ${producers.map(item => TARGET_TITLES[item]).join(" → ")} → ${TARGET_TITLES[target]}.`
        : "Seleccionada; se calculará con los datos ingresados.";
      option.classList.add("selected-result");
    } else if (directRoute) {
      message = "Disponible con los datos ingresados.";
      option.classList.add("available-direct");
    } else if (selectedRoute) {
      const producers = Object.keys(TARGET_OUTPUTS).filter(candidate =>
        dependencyState.datosSeleccionados.has(candidate) &&
        selectedRoute.some(fact => (TARGET_OUTPUTS[candidate] ?? []).includes(fact))
      );
      message = producers.length
        ? `Disponible porque se calculará ${producers.map(item => TARGET_TITLES[item]).join(" y ")}.`
        : "Disponible mediante otro resultado seleccionado.";
      option.classList.add("available-via");
    } else {
      message = mensajeBloqueo(target, dependencyState);
      option.classList.add("unavailable");
    }
    if (dependencyState.desactivados.includes(target)) option.classList.add("dependency-lost");
    option.title = message;
    reason.textContent = message;
  });

  const circular = detectarDependenciasCirculares(dependencyState);
  dom.solveButton.disabled =
    dependencyState.datosSeleccionados.size === 0 ||
    dependencyState.objetivosResueltos.size !== dependencyState.datosSeleccionados.size ||
    circular;

  if (announceLoss && dependencyState.desactivados.length) {
    const names = dependencyState.desactivados.map(target => TARGET_TITLES[target]).join(", ");
    showMessage(dom.resolverError, `${names} se desmarcó porque perdió un resultado intermedio necesario.`);
  }
}

function procedure(title, data, formula, substitution, operation, result) {
  return { title, data, formula, substitution, operation, result };
}

function resolveTarget(target, raw, d) {
  const dataLine = (...items) => items.filter(Boolean).join("; ");
  switch (target) {
    case "components": {
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`v₀ = ${fmt(d.v0)} m/s`, `θ = ${fmt(d.angle)}°`),
          "v₀x = v₀ cos(θ);  v₀y = v₀ sen(θ)",
          `v₀x = ${fmt(d.v0)} cos(${fmt(d.angle)}°);  v₀y = ${fmt(d.v0)} sen(${fmt(d.angle)}°)`,
          "Se proyecta v₀ sobre los ejes x e y.",
          `v₀x = ${fmt(d.vx0)} m/s;  v₀y = ${fmt(d.vy0)} m/s`
        )
      };
    }
    case "timeMax": {
      const value = d.vy0 / d.g;
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`v₀y = ${fmt(d.vy0)} m/s`, `g = ${fmt(d.g)} m/s²`),
          "vy = v₀y − gt; en la altura máxima, vy = 0",
          `0 = ${fmt(d.vy0)} − ${fmt(d.g)}t`,
          `t = v₀y/g = ${fmt(d.vy0)}/${fmt(d.g)}`,
          `t subida = ${fmt(value)} s`
        ),
        updates: { ascentTime: value }
      };
    }
    case "maxHeight": {
      const upward = d.vy0 > 0;
      const value = upward ? d.vy0 * d.vy0 / (2 * d.g) : 0;
      const yMax = d.y0 + value;
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`y₀ = ${fmt(d.y0)} m`, `v₀y = ${fmt(d.vy0)} m/s`, `g = ${fmt(d.g)} m/s²`),
          upward ? "vy² = v₀y² − 2g(y − y₀); en la altura máxima, vy = 0" : "Si v₀y ≤ 0, el proyectil desciende desde el lanzamiento.",
          upward ? `0 = (${fmt(d.vy0)})² − 2(${fmt(d.g)})Hmax` : `v₀y = ${fmt(d.vy0)} m/s ≤ 0`,
          upward ? "Hmax = v₀y²/(2g)" : "Hmax = 0",
          `Hmax = ${fmt(value)} m desde el lanzamiento; Ymax = ${fmt(yMax)} m respecto al suelo`
        ),
        updates: { maxHeight: value, hmax: value, ymax: yMax }
      };
    }
    case "flightTime": {
      const solved = solveHeightTimes(d.y0, d.vy0, d.g, d.y);
      if (solved.error) throw new Error(solved.error);
      const value = solved.times[solved.times.length - 1];
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`y₀ = ${fmt(d.y0)} m`, `y = ${fmt(d.y)} m`, `v₀y = ${fmt(d.vy0)} m/s`, `g = ${fmt(d.g)} m/s²`),
          "y = y₀ + v₀y t − ½gt²",
          `${fmt(d.y)} = ${fmt(d.y0)} + ${fmt(d.vy0)}t − ½(${fmt(d.g)})t²`,
          "Se resuelve la ecuación cuadrática y se toma el último tiempo físico.",
          `t total = ${fmt(value)} s`
        ),
        updates: { flightTime: value, endTime: value }
      };
    }
    case "range": {
      const ending = endTimeInfo(d);
      if (ending.error) throw new Error("No se puede calcular el alcance porque no se ha definido dónde termina el movimiento.");
      const rangeSigned = d.vx0 * ending.time;
      const value = Math.abs(rangeSigned);
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`x₀ = ${fmt(d.x0)} m`, `v₀x = ${fmt(d.vx0)} m/s`, `t = ${fmt(ending.time)} s`),
          "Rmax = |x impacto − x inicial| = |v₀x t|",
          `Rmax = |(${fmt(d.vx0)})(${fmt(ending.time)})|`,
          "Se toma la magnitud del desplazamiento horizontal desde el punto de lanzamiento.",
          `Rmax = ${fmt(value)} m`
        ),
        updates: { range: value, rmax: value, rangeSigned, flightTime: ending.time, endTime: ending.time }
      };
    }
    case "groundDistance": {
      const rangeSigned = finite(d.rangeSigned) ? d.rangeSigned : 0;
      const xImpact = d.x0 + rangeSigned;
      const value = Math.abs(xImpact);
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`x₀ = ${fmt(d.x0)} m`, `R con signo = ${fmt(rangeSigned)} m`, "x origen = 0 m"),
          "x impacto = x₀ + R;  Dmax = |x impacto − x origen|",
          `Dmax = |${fmt(d.x0)} + (${fmt(rangeSigned)}) − 0|`,
          "Se mide la posición del impacto desde el origen horizontal del suelo.",
          `Dmax = ${fmt(value)} m`
        ),
        updates: { groundDistance: value, dmax: value, xImpact }
      };
    }
    case "positionX": {
      const value = d.x0 + d.vx0 * d.t;
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`x₀ = ${fmt(d.x0)} m`, `v₀x = ${fmt(d.vx0)} m/s`, `t = ${fmt(d.t)} s`),
          "x = x₀ + v₀x t",
          `x = ${fmt(d.x0)} + (${fmt(d.vx0)})(${fmt(d.t)})`,
          "Movimiento horizontal uniforme.",
          `x(${fmt(d.t)} s) = ${fmt(value)} m`
        ),
        updates: { xAtTime: value, positionX: value }
      };
    }
    case "positionY": {
      const value = d.y0 + d.vy0 * d.t - .5 * d.g * d.t * d.t;
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`y₀ = ${fmt(d.y0)} m`, `v₀y = ${fmt(d.vy0)} m/s`, `t = ${fmt(d.t)} s`, `g = ${fmt(d.g)} m/s²`),
          "y = y₀ + v₀y t − ½gt²",
          `y = ${fmt(d.y0)} + (${fmt(d.vy0)})(${fmt(d.t)}) − ½(${fmt(d.g)})(${fmt(d.t)})²`,
          "Se evalúa la ecuación vertical en el tiempo indicado.",
          `y(${fmt(d.t)} s) = ${fmt(value)} m`
        ),
        updates: { yAtTime: value }
      };
    }
    case "velocityX": {
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`v₀x = ${fmt(d.vx0)} m/s`, `t = ${fmt(d.t)} s`),
          "vx(t) = v₀x",
          `vx(${fmt(d.t)}) = ${fmt(d.vx0)}`,
          "La aceleración horizontal es cero.",
          `vx = ${fmt(d.vx0)} m/s`
        ),
        updates: { velocityX: d.vx0 }
      };
    }
    case "velocityY": {
      const value = d.vy0 - d.g * d.t;
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`v₀y = ${fmt(d.vy0)} m/s`, `t = ${fmt(d.t)} s`, `g = ${fmt(d.g)} m/s²`),
          "vy = v₀y − gt",
          `vy = ${fmt(d.vy0)} − (${fmt(d.g)})(${fmt(d.t)})`,
          "Se resta el cambio de velocidad producido por la gravedad.",
          `vy = ${fmt(value)} m/s`
        ),
        updates: { vyAtTime: value, velocityY: value }
      };
    }
    case "speed": {
      const vy = d.vy0 - d.g * d.t;
      const value = Math.hypot(d.vx0, vy);
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`vx = ${fmt(d.vx0)} m/s`, `vy = ${fmt(vy)} m/s`),
          "|v| = √(vx² + vy²)",
          `|v| = √((${fmt(d.vx0)})² + (${fmt(vy)})²)`,
          "Se calcula la magnitud del vector velocidad.",
          `|v| = ${fmt(value)} m/s`
        ),
        updates: { speedAtTime: value, speed: value }
      };
    }
    case "impact":
    case "impactAngle": {
      const finalComponentsKnown = finite(d.impactVx) && finite(d.impactVy);
      const ending = finalComponentsKnown ? null : endTimeInfo(d);
      if (!finalComponentsKnown && ending.error) {
        throw new Error("No se puede calcular el impacto porque no se ha definido el instante o punto final.");
      }
      const vx = finalComponentsKnown ? d.impactVx : d.vx0;
      const vy = finalComponentsKnown ? d.impactVy : d.vy0 - d.g * ending.time;
      const speed = Math.hypot(vx, vy);
      const angle = degrees(Math.atan2(vy, vx));
      if (target === "impact") {
        return {
          procedure: procedure(
            TARGET_TITLES[target],
            finalComponentsKnown
              ? dataLine(`vx final = ${fmt(vx)} m/s`, `vy final = ${fmt(vy)} m/s`)
              : dataLine(`v₀x = ${fmt(vx)} m/s`, `v₀y = ${fmt(d.vy0)} m/s`, `g = ${fmt(d.g)} m/s²`, `t = ${fmt(ending.time)} s`),
            finalComponentsKnown ? "|vf| = √(vx² + vy²)" : "vx = v₀x;  vy = v₀y − gt;  |vf| = √(vx² + vy²)",
            finalComponentsKnown ? `|vf| = √((${fmt(vx)})² + (${fmt(vy)})²)` : `vy = ${fmt(d.vy0)} − (${fmt(d.g)})(${fmt(ending.time)})`,
            `|vf| = √((${fmt(vx)})² + (${fmt(vy)})²)`,
            `vf = (${fmt(vx)}, ${fmt(vy)}) m/s;  |vf| = ${fmt(speed)} m/s`
          ),
          updates: {
            impactVx: vx,
            impactVy: vy,
            impactSpeed: speed,
            impactAngle: angle,
            ...(ending ? { flightTime: ending.time, endTime: ending.time } : {})
          }
        };
      }
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`vx = ${fmt(vx)} m/s`, `vy = ${fmt(vy)} m/s`),
          "θf = atan2(vy, vx)",
          `θf = atan2(${fmt(vy)}, ${fmt(vx)})`,
          "Se conserva el cuadrante correcto con atan2.",
          `θf = ${fmt(angle)}°`
        ),
        updates: { impactAngle: angle, ...(ending ? { flightTime: ending.time, endTime: ending.time } : {}) }
      };
    }
    case "timeAtHeight": {
      const solved = solveHeightTimes(d.y0, d.vy0, d.g, d.y);
      if (solved.error) throw new Error(solved.error);
      const labels = solved.times.map(time => {
        const verticalVelocity = d.vy0 - d.g * time;
        const phase = Math.abs(verticalVelocity) < 1e-6 ? "altura máxima" : verticalVelocity > 0 ? "subida" : "bajada";
        return `${fmt(time)} s (${phase})`;
      });
      const variants = solved.times.length > 1
        ? solved.times.map((time, index) => ({ label: labels[index], overrides: { flightTime: time, finalHeight: d.y } }))
        : [];
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`y₀ = ${fmt(d.y0)} m`, `y = ${fmt(d.y)} m`, `v₀y = ${fmt(d.vy0)} m/s`, `g = ${fmt(d.g)} m/s²`),
          "½gt² − v₀y t + (y − y₀) = 0",
          `½(${fmt(d.g)})t² − (${fmt(d.vy0)})t + (${fmt(d.y)} − ${fmt(d.y0)}) = 0`,
          `Δ = v₀y² − 2g(y − y₀) = ${fmt(solved.discriminant, 3)}`,
          `t = ${labels.join(";  t = ")}`
        ),
        variants,
        updates: { heightTimes: solved.times, timeAtHeight: solved.times }
      };
    }
    case "heightAtX": {
      const time = d.x / d.vx0;
      if (time < -EPS) throw new Error("La distancia horizontal indicada queda detrás de la dirección del lanzamiento.");
      const value = d.y0 + d.vy0 * time - .5 * d.g * time * time;
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`x = ${fmt(d.x)} m`, `v₀x = ${fmt(d.vx0)} m/s`, `y₀ = ${fmt(d.y0)} m`, `v₀y = ${fmt(d.vy0)} m/s`),
          "t = x/v₀x;  y = y₀ + v₀y t − ½gt²",
          `t = ${fmt(d.x)}/${fmt(d.vx0)} = ${fmt(time)} s`,
          `y = ${fmt(d.y0)} + (${fmt(d.vy0)})(${fmt(time)}) − ½(${fmt(d.g)})(${fmt(time)})²`,
          `y = ${fmt(value)} m`
        ),
        updates: { timeAtX: time, heightAtX: value }
      };
    }
    case "initialSpeed": {
      let value;
      let formula;
      let substitution;
      if (finite(raw.vx0) && finite(raw.vy0)) {
        value = Math.hypot(raw.vx0, raw.vy0);
        formula = "v₀ = √(v₀x² + v₀y²)";
        substitution = `v₀ = √((${fmt(raw.vx0)})² + (${fmt(raw.vy0)})²)`;
      } else if (raw.launchType === "vertical" && finite(raw.vy0)) {
        value = Math.abs(raw.vy0);
        formula = "v₀ = |v₀y|";
        substitution = `v₀ = |${fmt(raw.vy0)}|`;
      } else if (raw.launchType === "horizontal" && finite(raw.vx0)) {
        value = Math.abs(raw.vx0);
        formula = "v₀ = |v₀x|";
        substitution = `v₀ = |${fmt(raw.vx0)}|`;
      } else {
        const denominator = Math.sin(2 * radians(raw.angle));
        value = Math.sqrt(raw.g * raw.x / denominator);
        formula = "R = v₀² sen(2θ)/g  →  v₀ = √[Rg/sen(2θ)]";
        substitution = `v₀ = √[(${fmt(raw.x)})(${fmt(raw.g)})/sen(${fmt(2 * raw.angle)}°)]`;
      }
      const angle = finite(d.angle) ? d.angle : raw.angle;
      const updates = { v0: value };
      if (finite(angle)) {
        updates.vx0 = clean(value * Math.cos(radians(angle)));
        updates.vy0 = clean(value * Math.sin(radians(angle)));
      }
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(
            finite(raw.vx0) ? `v₀x = ${fmt(raw.vx0)} m/s` : "",
            finite(raw.vy0) ? `v₀y = ${fmt(raw.vy0)} m/s` : "",
            raw.sameHeight && finite(raw.x) ? `R = ${fmt(raw.x)} m; θ = ${fmt(raw.angle)}°` : ""
          ),
          formula,
          substitution,
          "Se despeja la magnitud de la velocidad inicial para el caso programado.",
          `v₀ = ${fmt(value)} m/s`
        ),
        updates
      };
    }
    case "initialAngle": {
      if (finite(raw.vx0) && finite(raw.vy0)) {
        const value = degrees(Math.atan2(raw.vy0, raw.vx0));
        return {
          procedure: procedure(
            TARGET_TITLES[target],
            dataLine(`v₀x = ${fmt(raw.vx0)} m/s`, `v₀y = ${fmt(raw.vy0)} m/s`),
            "θ = atan2(v₀y, v₀x)",
            `θ = atan2(${fmt(raw.vy0)}, ${fmt(raw.vx0)})`,
            "Se obtiene el ángulo a partir de las dos componentes.",
            `θ = ${fmt(value)}°`
          ),
          updates: { angle: value, v0: Math.hypot(raw.vx0, raw.vy0), vx0: raw.vx0, vy0: raw.vy0 }
        };
      }
      const ratio = Math.min(1, raw.g * raw.x / (raw.v0 * raw.v0));
      const principal = degrees(Math.asin(ratio));
      const angle1 = principal / 2;
      const angle2 = (180 - principal) / 2;
      const variants = near(angle1, angle2)
        ? []
        : [
            { label: `Trayectoria baja · θ = ${fmt(angle1)}°`, overrides: { angle: angle1 } },
            { label: `Trayectoria alta · θ = ${fmt(angle2)}°`, overrides: { angle: angle2 } }
          ];
      return {
        procedure: procedure(
          TARGET_TITLES[target],
          dataLine(`R = ${fmt(raw.x)} m`, `v₀ = ${fmt(raw.v0)} m/s`, `g = ${fmt(raw.g)} m/s²`, "y = y₀"),
          "sen(2θ) = Rg/v₀²",
          `sen(2θ) = (${fmt(raw.x)})(${fmt(raw.g)})/(${fmt(raw.v0)})² = ${fmt(ratio, 4)}`,
          "El seno produce dos ángulos complementarios para 2θ.",
          near(angle1, angle2) ? `θ = ${fmt(angle1)}°` : `θ₁ = ${fmt(angle1)}°;  θ₂ = ${fmt(angle2)}°`
        ),
        variants,
        updates: near(angle1, angle2) ? { angle: angle1 } : {}
      };
    }
    default:
      throw new Error("La opción seleccionada aún no tiene un caso programado.");
  }
}

function combineScenarios(baseScenarios, variants, title) {
  if (!variants?.length) return baseScenarios;
  const combined = [];
  baseScenarios.forEach(base => {
    variants.forEach(variant => {
      combined.push({
        label: [base.label, `${title}: ${variant.label}`].filter(Boolean).join(" · "),
        overrides: { ...base.overrides, ...variant.overrides }
      });
    });
  });
  return combined;
}

function renderProcedureCard(item) {
  const article = document.createElement("article");
  article.className = `procedure-card${item.role === "Resultado intermedio" ? " intermediate" : ""}`;
  const role = document.createElement("span");
  role.className = "procedure-role";
  role.textContent = item.role ?? "Resultado solicitado";
  const heading = document.createElement("h4");
  heading.textContent = item.title;
  article.append(role, heading);

  [
    ["Datos", item.data],
    ["Fórmula", item.formula],
    ["Sustitución", item.substitution],
    ["Operación", item.operation],
    ["Resultado", item.result]
  ].forEach(([label, content], index) => {
    const block = document.createElement("div");
    block.className = `procedure-step${index === 4 ? " procedure-result" : ""}`;
    const caption = document.createElement("span");
    caption.textContent = label;
    const code = document.createElement("code");
    code.textContent = content;
    block.append(caption, code);
    article.appendChild(block);
  });
  return article;
}

function ordenarObjetivosSeleccionados(targets, dependencyState) {
  const selected = new Set(targets);
  const ordered = [];
  const visited = new Set();
  const visit = target => {
    if (visited.has(target)) return;
    visited.add(target);
    const route = dependencyState.rutasSeleccionadas.get(target) ?? [];
    route.forEach(fact => {
      const producer = targets.find(candidate =>
        selected.has(candidate) && (TARGET_OUTPUTS[candidate] ?? []).includes(fact)
      );
      if (producer && producer !== target) visit(producer);
    });
    ordered.push(target);
  };
  targets.forEach(visit);
  return ordered;
}

function identificarResultadosIntermedios(targets, dependencyState) {
  const selected = new Set(targets);
  const intermediate = new Set();
  targets.forEach(target => {
    const route = dependencyState.rutasSeleccionadas.get(target) ?? [];
    route.forEach(fact => {
      const producer = targets.find(candidate =>
        selected.has(candidate) &&
        candidate !== target &&
        (TARGET_OUTPUTS[candidate] ?? []).includes(fact)
      );
      if (producer) intermediate.add(producer);
    });
  });
  return intermediate;
}

function renderSolution(solution) {
  dom.procedureList.replaceChildren(...solution.procedures.map(renderProcedureCard));
  dom.solutionPicker.replaceChildren();
  if (solution.scenarios.length > 1) {
    const prompt = document.createElement("p");
    prompt.textContent = "Existen varias soluciones físicas. Selecciona cuál deseas enviar al simulador:";
    const options = document.createElement("div");
    options.className = "solution-options";
    solution.scenarios.forEach((scenario, index) => {
      const label = document.createElement("label");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "simulationScenario";
      radio.value = String(index);
      radio.checked = index === 0;
      const text = document.createElement("span");
      text.textContent = scenario.label;
      label.append(radio, text);
      options.appendChild(label);
    });
    dom.solutionPicker.append(prompt, options);
    dom.solutionPicker.classList.remove("hidden");
  } else {
    dom.solutionPicker.classList.add("hidden");
  }
  dom.solutionSection.classList.remove("hidden");
}

function invalidateSolution() {
  state.solution = null;
  dom.solutionSection.classList.add("hidden");
  dom.procedureList.replaceChildren();
  dom.solutionPicker.replaceChildren();
  if (dom.simulationSource.textContent === "Ejercicio resuelto") {
    stopAnimation();
    state.simulation = null;
    state.samples = [];
    dom.simulationPanel.classList.add("hidden");
  }
}

function solveExercise(event) {
  event.preventDefault();
  hideMessage(dom.resolverError);
  const read = readKnownData(true);
  if (read.error) {
    showMessage(dom.resolverError, read.error);
    return;
  }
  const dependencyState = resolverDisponibilidadRecursiva(read.data, read.derived);
  const selectedIds = [...dependencyState.datosSeleccionados];
  if (!selectedIds.length) {
    showMessage(dom.resolverError, "Selecciona al menos una cantidad para calcular.");
    return;
  }
  if (dependencyState.objetivosResueltos.size !== dependencyState.datosSeleccionados.size) {
    showMessage(dom.resolverError, "Una de las incógnitas seleccionadas perdió la ruta de cálculo que la habilitaba.");
    updateOptionsAvailable(true);
    return;
  }
  if (detectarDependenciasCirculares(dependencyState)) {
    showMessage(dom.resolverError, "La selección contiene una dependencia circular y no puede resolverse.");
    return;
  }

  const procedures = [];
  const solved = { ...read.derived };
  let scenarios = [{ label: "", overrides: {} }];
  const orderedTargets = ordenarObjetivosSeleccionados(selectedIds, dependencyState);
  const intermediateTargets = identificarResultadosIntermedios(orderedTargets, dependencyState);
  const needsImplicitComponents = orderedTargets.some(target => {
    const route = dependencyState.rutasSeleccionadas.get(target) ?? [];
    return target !== "components" &&
      route.includes("v0") &&
      route.includes("angle") &&
      (!dependencyState.datosIngresados.has("vx0") || !dependencyState.datosIngresados.has("vy0"));
  });

  try {
    if (needsImplicitComponents && !orderedTargets.includes("components")) {
      const implicit = resolveTarget("components", read.data, solved);
      implicit.procedure.role = "Resultado intermedio";
      procedures.push(implicit.procedure);
      Object.assign(solved, implicit.updates ?? {});
    }

    for (const target of orderedTargets) {
      const physical = validarObjetivoFisico(target, read.data, solved);
      if (!physical.ok) throw new Error(physical.reason);
      const result = resolveTarget(target, read.data, solved);
      result.procedure.role = intermediateTargets.has(target) ? "Resultado intermedio" : "Resultado solicitado";
      procedures.push(result.procedure);
      Object.assign(solved, result.updates ?? {});
      scenarios = combineScenarios(scenarios, result.variants, TARGET_TITLES[target]);
    }
  } catch (error) {
    showMessage(dom.resolverError, error.message);
    return;
  }

  state.solution = {
    raw: read.data,
    solved,
    procedures,
    scenarios,
    dependencyState
  };
  renderSolution(state.solution);
  dom.solutionSection.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
}

function clearResolver() {
  dom.resolverForm.reset();
  FIELD_DEFINITIONS.g.element.value = "9.81";
  FIELD_DEFINITIONS.x0.element.value = "0";
  FIELD_DEFINITIONS.y0.element.value = "0";
  FIELD_DEFINITIONS.angle.element.dataset.automatic = "false";
  state.solution = null;
  dom.solutionSection.classList.add("hidden");
  dom.procedureList.replaceChildren();
  dom.solutionPicker.replaceChildren();
  hideMessage(dom.resolverError);
  updateLaunchTypeUI();
}

function chosenScenario() {
  if (!state.solution) return { overrides: {} };
  const selected = document.querySelector('input[name="simulationScenario"]:checked');
  return state.solution.scenarios[Number(selected?.value ?? 0)] ?? state.solution.scenarios[0];
}

function calculateSimulation(parameters) {
  const { v0, angle, y0, g } = parameters;
  const x0 = finite(parameters.x0) ? parameters.x0 : 0;
  if (![v0, angle, x0, y0, g].every(finite)) {
    return { error: "No fue posible completar v₀, θ, x₀, y₀ y g para la simulación." };
  }
  if (v0 < 0 || g <= 0 || angle < -90 || angle > 90) {
    return { error: "Los datos calculados no forman una simulación física válida." };
  }
  if (y0 < 0 || (finite(parameters.finalHeight) && parameters.finalHeight < 0)) {
    return { error: "Las alturas respecto al suelo deben ser mayores o iguales que cero." };
  }

  const vx0 = clean(v0 * Math.cos(radians(angle)));
  const vy0 = clean(v0 * Math.sin(radians(angle)));
  let flightTime = parameters.flightTime;
  let finalHeight = parameters.finalHeight;

  if (finite(flightTime)) {
    if (flightTime < 0) return { error: "El tiempo final de la simulación no puede ser negativo." };
    finalHeight = y0 + vy0 * flightTime - .5 * g * flightTime * flightTime;
  } else {
    if (!finite(finalHeight)) finalHeight = y0 >= 0 ? 0 : y0;
    const solved = solveHeightTimes(y0, vy0, g, finalHeight);
    if (solved.error) return { error: solved.error };
    flightTime = solved.times[solved.times.length - 1];
  }

  if (!finite(flightTime) || flightTime > MAX_FLIGHT_TIME) {
    return { error: `El tiempo de simulación debe ser menor o igual que ${MAX_FLIGHT_TIME} s.` };
  }

  const ascentTime = vy0 > 0 ? Math.min(flightTime, vy0 / g) : 0;
  const maxHeight = vy0 > 0 && vy0 / g <= flightTime
    ? y0 + vy0 * vy0 / (2 * g)
    : Math.max(y0, finalHeight);
  const hmax = Math.max(0, maxHeight - y0);
  const rangeSigned = vx0 * flightTime;
  const rmax = Math.abs(rangeSigned);
  const xImpact = x0 + rangeSigned;
  const dmax = Math.abs(xImpact);
  const impactVy = vy0 - g * flightTime;
  const impactSpeed = Math.hypot(vx0, impactVy);
  const impactAngle = degrees(Math.atan2(impactVy, vx0));

  return {
    v0,
    angle,
    x0,
    y0,
    finalHeight,
    g,
    vx0,
    vy0,
    flightTime,
    ascentTime,
    maxHeight,
    hmax,
    ymax: maxHeight,
    range: rmax,
    rmax,
    rangeSigned,
    xImpact,
    dmax,
    impactVy,
    impactSpeed,
    impactAngle
  };
}

function prepareResolvedSimulation() {
  if (!state.solution) return;
  const scenario = chosenScenario();
  const data = { ...state.solution.solved, ...scenario.overrides };
  let angle = data.angle;
  let v0 = data.v0;

  if (finite(scenario.overrides.angle)) {
    angle = scenario.overrides.angle;
    v0 = data.v0;
  }
  if (!finite(v0) && finite(data.vx0) && finite(data.vy0)) v0 = Math.hypot(data.vx0, data.vy0);
  if (!finite(angle) && finite(data.vx0) && finite(data.vy0)) angle = degrees(Math.atan2(data.vy0, data.vx0));

  const finalHeight = finite(scenario.overrides.finalHeight)
    ? scenario.overrides.finalHeight
    : finite(data.y) ? data.y : data.sameHeight ? data.y0 : null;
  const flightTime = finite(scenario.overrides.flightTime)
    ? scenario.overrides.flightTime
    : finite(data.endTime) ? data.endTime
      : finite(data.flightTime) ? data.flightTime
        : finite(data.t) ? data.t : null;

  const simulation = calculateSimulation({
    v0,
    angle,
    x0: data.x0 ?? 0,
    y0: data.y0 ?? 0,
    g: data.g,
    finalHeight,
    flightTime
  });
  if (simulation.error) {
    showMessage(dom.resolverError, simulation.error);
    dom.resolverError.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  prepareSimulation(simulation, "Ejercicio resuelto");
}

function prepareFreeSimulation(event) {
  event.preventDefault();
  hideMessage(dom.freeError);
  const parameters = {
    v0: Number($("freeV0").value),
    angle: Number($("freeAngle").value),
    x0: Number($("freeX0").value),
    y0: Number($("freeY0").value),
    finalHeight: Number($("freeY").value),
    g: Number($("freeG").value)
  };
  const simulation = calculateSimulation(parameters);
  if (simulation.error) {
    showMessage(dom.freeError, simulation.error);
    return;
  }
  prepareSimulation(simulation, "Simulación libre");
}

function pointAtTime(p, rawTime) {
  const t = Math.max(0, Math.min(rawTime, p.flightTime));
  return {
    t,
    x: p.x0 + p.vx0 * t,
    y: p.y0 + p.vy0 * t - .5 * p.g * t * t,
    vx: p.vx0,
    vy: p.vy0 - p.g * t
  };
}

function generatePath(p, count = 420) {
  if (p.flightTime <= EPS) return [pointAtTime(p, 0)];
  return Array.from({ length: count + 1 }, (_, index) => pointAtTime(p, p.flightTime * index / count));
}

function trajectoryEquation(p) {
  if (Math.abs(p.vx0) < EPS) return `Movimiento vertical: x = ${fmt(p.x0)} m`;
  const linear = p.vy0 / p.vx0;
  const quadratic = p.g / (2 * p.vx0 * p.vx0);
  const shiftedX = Math.abs(p.x0) < EPS
    ? "x"
    : p.x0 > 0 ? `(x − ${fmt(p.x0)})` : `(x + ${fmt(Math.abs(p.x0))})`;
  return `y(x) = ${fmt(p.y0)} ${linear < 0 ? "−" : "+"} ${fmt(Math.abs(linear), 3)}${shiftedX} − ${fmt(quadratic, 5)}${shiftedX}²`;
}

function prepareSimulation(simulation, source) {
  stopAnimation();
  state.simulation = simulation;
  state.samples = generatePath(simulation);
  state.time = 0;
  state.running = false;
  state.paused = false;
  dom.simulationPanel.classList.remove("hidden");
  dom.simulationSource.textContent = source;
  dom.start.textContent = "Iniciar";
  dom.pause.textContent = "Pausar";
  dom.pause.disabled = true;
  setBadge("ready");
  renderSimulationSummary(simulation);
  resizeCanvas();
  drawFrame();
  dom.simulationPanel.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
}

function renderSimulationSummary(p) {
  const values = [
    ["v₀", `${fmt(p.v0)} m/s`],
    ["θ", `${fmt(p.angle)}°`],
    ["x₀", `${fmt(p.x0)} m`],
    ["y₀ → y final", `${fmt(p.y0)} → ${fmt(p.finalHeight)} m`],
    ["g", `${fmt(p.g)} m/s²`],
    ["t total", `${fmt(p.flightTime)} s`]
  ];
  dom.loadedData.replaceChildren(...values.map(([term, value]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = value;
    row.append(dt, dd);
    return row;
  }));
  dom.overlayHmax.textContent = `${fmt(p.hmax)} m`;
  dom.overlayYmax.textContent = `${fmt(p.ymax)} m`;
  dom.overlayRmax.textContent = `${fmt(p.rmax)} m`;
  dom.overlayDmax.textContent = `${fmt(p.dmax)} m`;
  dom.overlayImpact.textContent = `${fmt(p.impactSpeed)} m/s`;
  dom.overlayTime.textContent = `${fmt(p.flightTime)} s`;
  dom.overlayEquation.textContent = trajectoryEquation(p);
  dom.resV0.textContent = fmt(p.v0);
  dom.resAngle.textContent = fmt(p.angle);
  dom.resTime.textContent = fmt(p.flightTime);
  dom.resRange.textContent = fmt(p.rmax);
  dom.resGroundDistance.textContent = fmt(p.dmax);
  dom.resMaxHeight.textContent = fmt(p.hmax);
  dom.resYMax.textContent = fmt(p.ymax);
  dom.resImpactSpeed.textContent = fmt(p.impactSpeed);
  updateTelemetry(pointAtTime(p, 0));
}

function updateTelemetry(point) {
  const values = {
    T: point.t,
    X: point.x,
    Y: point.y,
    Vx: point.vx,
    Vy: point.vy,
    Speed: Math.hypot(point.vx, point.vy)
  };
  Object.entries(values).forEach(([key, value]) => {
    dom[`tele${key}`].textContent = fmt(value);
  });
}

function niceStep(rawStep) {
  if (!finite(rawStep) || rawStep <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / power;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * power;
}

function calculateTransform(p, width, height) {
  const margins = { left: 62, right: 30, top: 28, bottom: 50 };
  const drawWidth = Math.max(120, width - margins.left - margins.right);
  const drawHeight = Math.max(120, height - margins.top - margins.bottom);
  const xValues = state.samples.map(point => point.x);
  const yValues = state.samples.map(point => point.y);
  const minX = Math.min(0, ...xValues);
  const maxX = Math.max(0, ...xValues);
  const minY = Math.min(0, ...yValues);
  const maxY = Math.max(0, ...yValues);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const paddedX = spanX * 1.18;
  const paddedY = spanY * 1.2;
  const scale = Math.max(.0001, Math.min(drawWidth / paddedX, drawHeight / paddedY));
  const visibleX = drawWidth / scale;
  const visibleY = drawHeight / scale;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const xMin = centerX - visibleX / 2;
  const xMax = centerX + visibleX / 2;
  const yMin = centerY - visibleY / 2;
  const yMax = centerY + visibleY / 2;
  return {
    width,
    height,
    scale,
    xMin,
    xMax,
    yMin,
    yMax,
    gridStep: niceStep(76 / scale),
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
  if (state.simulation) {
    state.transform = calculateTransform(state.simulation, width, height);
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
  ctx.fillText("Resuelve o prepara una simulación para comenzar", width / 2, height / 2);
}

function tickLabel(value, step) {
  const digits = step < 1 ? Math.min(3, Math.ceil(-Math.log10(step))) : 0;
  return clean(value).toFixed(digits);
}

function drawArrowLine(x1, y1, x2, y2, color, width = 1.5) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 7 * Math.cos(angle - .42), y2 - 7 * Math.sin(angle - .42));
  ctx.lineTo(x2 - 7 * Math.cos(angle + .42), y2 - 7 * Math.sin(angle + .42));
  ctx.closePath();
  ctx.fill();
}

function drawCartesianPlane(tr) {
  ctx.clearRect(0, 0, tr.width, tr.height);
  ctx.fillStyle = "#fbfcf8";
  ctx.fillRect(0, 0, tr.width, tr.height);
  const firstX = Math.ceil(tr.xMin / tr.gridStep) * tr.gridStep;
  const firstY = Math.ceil(tr.yMin / tr.gridStep) * tr.gridStep;
  const axisY = tr.y(0);
  const axisX = tr.x(0);
  ctx.font = "10px 'IBM Plex Mono', monospace";

  for (let value = firstX; value <= tr.xMax + EPS; value += tr.gridStep) {
    const px = tr.x(value);
    ctx.strokeStyle = Math.abs(value) < EPS ? "rgba(21,79,61,.32)" : "rgba(21,79,61,.10)";
    ctx.lineWidth = Math.abs(value) < EPS ? 1.3 : 1;
    ctx.beginPath();
    ctx.moveTo(px, 18);
    ctx.lineTo(px, tr.height - 38);
    ctx.stroke();
    if (axisY >= 18 && axisY <= tr.height - 38) {
      ctx.fillStyle = "#607068";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(tickLabel(value, tr.gridStep), px, axisY + 7);
    }
  }

  for (let value = firstY; value <= tr.yMax + EPS; value += tr.gridStep) {
    const py = tr.y(value);
    ctx.strokeStyle = Math.abs(value) < EPS ? "rgba(21,79,61,.32)" : "rgba(21,79,61,.10)";
    ctx.lineWidth = Math.abs(value) < EPS ? 1.3 : 1;
    ctx.beginPath();
    ctx.moveTo(38, py);
    ctx.lineTo(tr.width - 18, py);
    ctx.stroke();
    if (axisX >= 38 && axisX <= tr.width - 18) {
      ctx.fillStyle = "#607068";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(tickLabel(value, tr.gridStep), axisX - 7, py);
    }
  }

  const axisColor = "#52665d";
  if (axisY >= 18 && axisY <= tr.height - 30) drawArrowLine(24, axisY, tr.width - 18, axisY, axisColor);
  if (axisX >= 24 && axisX <= tr.width - 18) drawArrowLine(axisX, tr.height - 30, axisX, 16, axisColor);
  ctx.fillStyle = axisColor;
  ctx.font = "600 11px 'IBM Plex Mono', monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  if (axisY >= 18 && axisY <= tr.height - 30) ctx.fillText("x (m)", tr.width - 22, axisY - 7);
  if (axisX >= 24 && axisX <= tr.width - 18) {
    ctx.textAlign = "left";
    ctx.fillText("y (m)", axisX + 7, 25);
  }
}

function drawPath(timeLimit, tr) {
  const stroke = (color, width, limit, dash) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    let started = false;
    state.samples.forEach(point => {
      if (point.t > limit + EPS) return;
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
  };
  stroke("rgba(35,114,89,.34)", 1.8, Infinity, [6, 6]);
  stroke("#237259", 3, timeLimit, []);
}

function drawPoint(x, y, color, tr, radius = 5) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(tr.x(x), tr.y(y), radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawLabel(text, x, y, tr, color = "#14261f") {
  ctx.font = "600 10px Inter, sans-serif";
  const width = ctx.measureText(text).width;
  const safeX = Math.max(6, Math.min(tr.width - width - 6, x));
  const safeY = Math.max(15, Math.min(tr.height - 8, y));
  ctx.fillStyle = "rgba(255,254,250,.92)";
  ctx.fillRect(safeX - 3, safeY - 11, width + 6, 15);
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, safeX, safeY);
}

function drawIndicators(p, tr) {
  if (p.vy0 > EPS && p.ascentTime <= p.flightTime + EPS) {
    const apexX = p.x0 + p.vx0 * p.ascentTime;
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(196,146,59,.82)";
    ctx.beginPath();
    ctx.moveTo(tr.x(apexX), tr.y(p.maxHeight));
    ctx.lineTo(tr.x(apexX), tr.y(0));
    ctx.stroke();
    ctx.restore();
    drawPoint(apexX, p.maxHeight, "#c4923b", tr);
    drawLabel(`y máx. = ${fmt(p.maxHeight)} m`, tr.x(apexX) + 8, tr.y(p.maxHeight) - 8, tr, "#76581c");
  }
  drawPoint(p.xImpact, p.finalHeight, "#a53a32", tr);
  drawLabel("Punto final", tr.x(p.xImpact) + (p.rangeSigned < 0 ? -58 : 8), tr.y(p.finalHeight) + 24, tr, "#7e332d");
}

function drawVector(px, py, dx, dy, color, label) {
  if (Math.hypot(dx, dy) < 2) return;
  drawArrowLine(px, py, px + dx, py + dy, color, 2);
  ctx.fillStyle = color;
  ctx.font = "600 10px 'IBM Plex Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(label, px + dx + 4, py + dy - 4);
}

function drawVectors(point, px, py) {
  const componentLength = value => Math.sign(value || 1) * Math.min(54, 12 + Math.abs(value) * 1.2);
  const speed = Math.hypot(point.vx, point.vy);
  const total = Math.min(54, 14 + speed);
  const angle = Math.atan2(-point.vy, point.vx);
  drawVector(px, py, componentLength(point.vx), 0, "#2b6cb0", "vx");
  drawVector(px, py, 0, -componentLength(point.vy), "#c46a2d", "vy");
  drawVector(px, py, Math.cos(angle) * total, Math.sin(angle) * total, "#7b3f92", "v");
  drawVector(px, py, 0, 40, "#a53a32", "g");
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
  if (!state.simulation || !state.transform) return;
  const p = state.simulation;
  const tr = state.transform;
  const point = pointAtTime(p, state.time);
  drawCartesianPlane(tr);
  drawPath(state.time, tr);
  drawIndicators(p, tr);
  const px = tr.x(point.x);
  const py = tr.y(point.y);
  drawProjectile(px, py);
  if (dom.showVectors.checked) drawVectors(point, px, py);
  updateTelemetry(point);
}

function setBadge(status) {
  const labels = { ready: "Preparado", running: "Simulando", paused: "En pausa", done: "Punto final" };
  dom.badge.className = `status-badge ${status === "ready" ? "" : status}`;
  dom.badge.textContent = labels[status];
}

function stopAnimation() {
  if (state.frame !== null) cancelAnimationFrame(state.frame);
  state.frame = null;
  state.lastStamp = null;
}

function animationStep(stamp) {
  if (!state.running || state.paused || !state.simulation) return;
  if (state.lastStamp === null) state.lastStamp = stamp;
  const delta = Math.min(.05, (stamp - state.lastStamp) / 1000);
  state.lastStamp = stamp;
  const baseScale = state.simulation.flightTime > 12 ? state.simulation.flightTime / 12 : 1;
  const playback = Number(dom.playbackSpeed.value);
  state.time = Math.min(state.simulation.flightTime, state.time + delta * baseScale * playback);
  drawFrame();
  if (state.time >= state.simulation.flightTime) {
    state.running = false;
    dom.pause.disabled = true;
    dom.start.textContent = "Repetir";
    setBadge("done");
    stopAnimation();
  } else {
    state.frame = requestAnimationFrame(animationStep);
  }
}

function startSimulation() {
  if (!state.simulation) return;
  stopAnimation();
  if (state.time >= state.simulation.flightTime - EPS) state.time = 0;
  state.running = true;
  state.paused = false;
  dom.start.textContent = "En curso";
  dom.pause.disabled = state.simulation.flightTime <= EPS;
  dom.pause.textContent = "Pausar";
  if (state.simulation.flightTime <= EPS || reducedMotion) {
    state.time = state.simulation.flightTime;
    state.running = false;
    dom.pause.disabled = true;
    dom.start.textContent = "Repetir";
    setBadge("done");
    drawFrame();
    return;
  }
  setBadge("running");
  state.frame = requestAnimationFrame(animationStep);
}

function togglePause() {
  if (!state.simulation || (!state.running && !state.paused)) return;
  if (state.paused) {
    state.paused = false;
    state.running = true;
    dom.pause.textContent = "Pausar";
    setBadge("running");
    state.frame = requestAnimationFrame(animationStep);
  } else {
    state.paused = true;
    state.running = false;
    stopAnimation();
    dom.pause.textContent = "Reanudar";
    setBadge("paused");
  }
}

function resetSimulation() {
  if (!state.simulation) return;
  stopAnimation();
  state.time = 0;
  state.running = false;
  state.paused = false;
  dom.start.textContent = "Iniciar";
  dom.pause.textContent = "Pausar";
  dom.pause.disabled = true;
  setBadge("ready");
  drawFrame();
}

function switchMode(mode) {
  const resolverActive = mode === "resolver";
  dom.resolverTab.classList.toggle("active", resolverActive);
  dom.freeTab.classList.toggle("active", !resolverActive);
  dom.resolverTab.setAttribute("aria-selected", String(resolverActive));
  dom.freeTab.setAttribute("aria-selected", String(!resolverActive));
  dom.resolverMode.classList.toggle("hidden", !resolverActive);
  dom.freeMode.classList.toggle("hidden", resolverActive);
  if (!resolverActive) dom.simulationPanel.classList.add("hidden");
  if (resolverActive && state.solution === null) dom.simulationPanel.classList.add("hidden");
}

dom.resolverForm.addEventListener("submit", solveExercise);
dom.clearResolver.addEventListener("click", clearResolver);
dom.simulateResult.addEventListener("click", prepareResolvedSimulation);
dom.freeForm.addEventListener("submit", prepareFreeSimulation);
dom.start.addEventListener("click", startSimulation);
dom.pause.addEventListener("click", togglePause);
dom.reset.addEventListener("click", resetSimulation);
dom.showVectors.addEventListener("change", drawFrame);
dom.resolverTab.addEventListener("click", () => switchMode("resolver"));
dom.freeTab.addEventListener("click", () => switchMode("free"));

document.querySelectorAll('input[name="launchType"]').forEach(input => {
  input.addEventListener("change", () => {
    invalidateSolution();
    updateLaunchTypeUI();
  });
});
dom.verticalDirection.addEventListener("change", () => {
  invalidateSolution();
  updateLaunchTypeUI();
});
dom.sameHeight.addEventListener("change", () => {
  invalidateSolution();
  updateSameHeight();
  updateOptionsAvailable();
});

[dom.heightIsFinal, dom.xIsRange, dom.timeIsFinal].forEach(control => {
  control.addEventListener("change", () => {
    invalidateSolution();
    updateOptionsAvailable(true);
  });
});

Object.values(FIELD_DEFINITIONS).forEach(definition => {
  definition.element.addEventListener("input", () => {
    if (definition === FIELD_DEFINITIONS.y0 && dom.sameHeight.checked) updateSameHeight();
    invalidateSolution();
    updateOptionsAvailable();
  });
  definition.unitElement?.addEventListener("change", () => {
    if (definition === FIELD_DEFINITIONS.y0 && dom.sameHeight.checked) updateSameHeight();
    invalidateSolution();
    updateOptionsAvailable();
  });
});

dom.calculationGrid.addEventListener("change", () => {
  invalidateSolution();
  updateOptionsAvailable(true);
});
dom.calculationGrid.addEventListener("click", event => {
  const unavailable = event.target.closest(".calculation-option.unavailable");
  if (unavailable) {
    showMessage(dom.resolverError, unavailable.title);
  }
});

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
  updateLaunchTypeUI();
  resizeCanvas();
});
