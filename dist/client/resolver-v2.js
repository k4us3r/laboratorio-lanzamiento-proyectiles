(() => {
  "use strict";

  const LENGTH_FACTORS = { m: 1, cm: .01, mm: .001, km: 1000 };
  const TIME_FACTORS = { s: 1, ms: .001, min: 60 };
  const SPEED_FACTORS = { "m/s": 1, "cm/s": .01, "km/h": 1 / 3.6 };
  const QUERY_GROUPS = [
    {
      label: "Resultados generales",
      items: [
        ["components", "Componentes iniciales v₀x y v₀y"],
        ["timeMax", "Tiempo para alcanzar la altura máxima"],
        ["maxHeight", "Hmax — Altura máxima respecto al suelo"],
        ["flightTime", "Tiempo total de vuelo"],
        ["range", "Rmax — Alcance desde el lanzamiento"],
        ["groundDistance", "Dmax — Distancia desde el origen"],
        ["finalPosition", "Posición final"],
        ["impactSpeed", "Velocidad de impacto"],
        ["impactComponents", "Componentes de velocidad de impacto"],
        ["impactAngle", "Ángulo de impacto"]
      ]
    },
    {
      label: "Consultas en un tiempo",
      items: [
        ["positionXAtTime", "Posición horizontal en un tiempo"],
        ["positionYAtTime", "Posición vertical en un tiempo"],
        ["positionAtTime", "Posición completa (x, y) en un tiempo"],
        ["velocityXAtTime", "Velocidad horizontal en un tiempo"],
        ["velocityYAtTime", "Velocidad vertical en un tiempo"],
        ["velocityAtTime", "Velocidad completa en un tiempo"],
        ["speedAtTime", "Rapidez en un tiempo"],
        ["directionAtTime", "Dirección de la velocidad en un tiempo"],
        ["stateAtTime", "Posición y velocidad en un tiempo"]
      ]
    },
    {
      label: "Consultas en una altura",
      items: [
        ["timeAtHeight", "Tiempo cuando alcanza una altura"],
        ["velocityAtHeight", "Velocidad cuando alcanza una altura"],
        ["stateAtHeight", "Posición y velocidad cuando alcanza una altura"],
        ["reachesHeight", "Determinar si alcanza una altura"]
      ]
    },
    {
      label: "Consultas horizontales",
      items: [
        ["heightAtX", "Altura al alcanzar una posición horizontal"],
        ["timeAtX", "Tiempo al alcanzar una posición horizontal"],
        ["stateAtX", "Posición y velocidad al alcanzar una posición horizontal"],
        ["reachesX", "Determinar si alcanza una coordenada horizontal"]
      ]
    },
    {
      label: "Consultas de velocidad",
      items: [
        ["timeAtVy", "Cuándo tiene determinada velocidad vertical"],
        ["timeAtSpeed", "Cuándo tiene determinada rapidez"],
        ["timeVyZero", "Cuándo su velocidad vertical es cero"]
      ]
    }
  ];
  const QUERY_META = Object.fromEntries(QUERY_GROUPS.flatMap(group =>
    group.items.map(([type, title]) => [type, {
      type,
      title,
      group: group.label,
      parameter: type.includes("AtTime") ? "time"
        : ["timeAtHeight", "velocityAtHeight", "stateAtHeight", "reachesHeight"].includes(type) ? "height"
          : ["heightAtX", "timeAtX", "stateAtX", "reachesX"].includes(type) ? "horizontal"
            : type === "timeAtVy" ? "verticalSpeed"
              : type === "timeAtSpeed" ? "speed"
                : null
    }])
  ));

  const ui = {
    form: document.getElementById("resolverForm"),
    solve: document.getElementById("solveButton"),
    clear: document.getElementById("clearResolver"),
    error: document.getElementById("resolverError"),
    finalCondition: document.getElementById("finalCondition"),
    finalHeightField: document.getElementById("finalHeightField"),
    finalTimeField: document.getElementById("finalTimeField"),
    finalHorizontalField: document.getElementById("finalHorizontalField"),
    finalNote: document.getElementById("finalConditionNote"),
    questionType: document.getElementById("questionType"),
    addQuestion: document.getElementById("addQuestion"),
    addTimeQuestion: document.getElementById("addTimeQuestion"),
    questionList: document.getElementById("questionList"),
    questionEmpty: document.getElementById("questionEmpty"),
    requestSummary: document.getElementById("exerciseRequestSummary"),
    summaryGrid: document.getElementById("exerciseSummaryGrid"),
    events: document.getElementById("exerciseEvents"),
    eventSelect: document.getElementById("exerciseEventSelect"),
    eventDescription: document.getElementById("exerciseEventDescription")
  };

  let consultas = [];
  let queryCounter = 0;
  let movimientoActual = null;

  function numberFrom(id) {
    const value = document.getElementById(id)?.value.trim();
    return value === "" || value === undefined ? null : Number(value);
  }

  function convert(value, unit, factors) {
    return value === null ? null : value * (factors[unit] ?? 1);
  }

  function unitValue(inputId, unitId, factors) {
    return convert(numberFrom(inputId), document.getElementById(unitId)?.value, factors);
  }

  function showV2Error(message) {
    ui.error.textContent = message;
    ui.error.classList.remove("hidden");
  }

  function clearV2Error() {
    ui.error.textContent = "";
    ui.error.classList.add("hidden");
  }

  function queryNeedsFinal(type) {
    return ["flightTime", "range", "groundDistance", "finalPosition", "impactSpeed", "impactComponents", "impactAngle"].includes(type);
  }

  function populateQuestionTypes() {
    const groups = QUERY_GROUPS.map(group => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;
      group.items.forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        optgroup.append(option);
      });
      return optgroup;
    });
    ui.questionType.replaceChildren(...groups);
    ui.questionType.value = "maxHeight";
  }

  function parameterMarkup(query) {
    const meta = QUERY_META[query.tipo];
    if (!meta.parameter) return "";
    const commonInput = (label, unitOptions, value = "") => `
      <label>${label}
        <input class="query-value" type="number" step="any" value="${value}" inputmode="decimal" placeholder="Valor">
      </label>
      <select class="query-unit" aria-label="Unidad de la consulta">${unitOptions}</select>`;
    if (meta.parameter === "time") {
      return commonInput("Tiempo de consulta", '<option value="s">s</option><option value="ms">ms</option><option value="min">min</option>', query.parametros.valor ?? "");
    }
    if (meta.parameter === "height") {
      return commonInput("Altura de consulta", '<option value="m">m</option><option value="cm">cm</option><option value="mm">mm</option><option value="km">km</option>', query.parametros.valor ?? "");
    }
    if (meta.parameter === "horizontal") {
      return `${commonInput("Dato horizontal de consulta", '<option value="m">m</option><option value="cm">cm</option><option value="mm">mm</option><option value="km">km</option>', query.parametros.valor ?? "")}
        <select class="parameter-mode" aria-label="Interpretación horizontal">
          <option value="coordinate">Coordenada x respecto al origen</option>
          <option value="displacement">Desplazamiento desde el lanzamiento</option>
        </select>`;
    }
    if (meta.parameter === "verticalSpeed") {
      return commonInput("Velocidad vertical", '<option value="m/s">m/s</option><option value="cm/s">cm/s</option><option value="km/h">km/h</option>', query.parametros.valor ?? "");
    }
    return `${commonInput("Rapidez solicitada", '<option value="m/s">m/s</option><option value="cm/s">cm/s</option><option value="km/h">km/h</option>', query.parametros.valor ?? "")}
      <select class="parameter-mode" aria-label="Fase del movimiento">
        <option value="any">Subiendo o bajando</option>
        <option value="up">Solamente subiendo</option>
        <option value="down">Solamente bajando</option>
      </select>`;
  }

  function renderQuestions() {
    ui.questionList.replaceChildren(...consultas.map((query, index) => {
      const meta = QUERY_META[query.tipo];
      const card = document.createElement("article");
      card.className = "question-card";
      card.dataset.queryId = query.id;
      card.innerHTML = `
        <span class="question-letter">${String.fromCharCode(97 + index)})</span>
        <div class="question-main">
          <h4>${meta.title}</h4>
          <p>${meta.group}</p>
          ${meta.parameter ? `<div class="question-parameter">${parameterMarkup(query)}</div>` : ""}
        </div>
        <button class="question-remove" type="button" aria-label="Eliminar ${meta.title}">Eliminar</button>
        <p class="question-status"></p>`;
      const unit = card.querySelector(".query-unit");
      const mode = card.querySelector(".parameter-mode");
      if (unit && query.parametros.unidad) unit.value = query.parametros.unidad;
      if (mode && query.parametros.modo) mode.value = query.parametros.modo;
      return card;
    }));
    ui.questionEmpty.classList.toggle("hidden", consultas.length > 0);
    updateReadyState();
  }

  function addQuery(type, preset = {}) {
    consultas.push({
      id: `consulta-${++queryCounter}`,
      tipo: type,
      parametros: { ...preset }
    });
    renderQuestions();
    ui.questionList.lastElementChild?.querySelector("input")?.focus();
  }

  function syncQueryCard(card) {
    const query = consultas.find(item => item.id === card.dataset.queryId);
    if (!query) return;
    query.parametros.valor = card.querySelector(".query-value")?.value ?? "";
    query.parametros.unidad = card.querySelector(".query-unit")?.value ?? null;
    query.parametros.modo = card.querySelector(".parameter-mode")?.value ?? null;
  }

  function updateFinalUI() {
    const type = ui.finalCondition.value;
    ui.finalHeightField.classList.toggle("hidden", type !== "height");
    ui.finalTimeField.classList.toggle("hidden", type !== "time");
    ui.finalHorizontalField.classList.toggle("hidden", type !== "horizontal");
    const notes = {
      ground: "El movimiento finalizará cuando el proyectil alcance el suelo (y = 0).",
      height: "La altura escrita aquí será exclusivamente la altura de impacto.",
      sameHeight: "El punto final tendrá la misma altura y₀ del lanzamiento.",
      time: "La animación y los resultados de impacto terminarán en el tiempo final indicado.",
      horizontal: "El punto final se obtiene con el dato horizontal de impacto, no con una consulta.",
      none: "Se permiten consultas instantáneas. Los resultados no se tratarán como impacto."
    };
    ui.finalNote.textContent = notes[type];
    updateReadyState();
  }

  function leerDatosIniciales() {
    const launchType = document.querySelector('input[name="launchType"]:checked')?.value;
    const v0 = unitValue("knownV0", "unitV0", SPEED_FACTORS);
    const angleInput = numberFrom("knownAngle");
    const vxInput = unitValue("knownVx0", "unitVx0", SPEED_FACTORS);
    const vyInput = unitValue("knownVy0", "unitVy0", SPEED_FACTORS);
    const x0 = unitValue("knownX0", "unitX0", LENGTH_FACTORS) ?? 0;
    const y0 = unitValue("knownY0", "unitY0", LENGTH_FACTORS) ?? 0;
    const g = numberFrom("knownG");
    if (!launchType) throw new Error("Selecciona el tipo de lanzamiento.");
    if (!Number.isFinite(g) || g <= 0) throw new Error("La gravedad debe ser mayor que cero.");
    if (y0 < 0) throw new Error("La altura inicial no puede ser negativa.");

    let angle = angleInput;
    let vx0 = vxInput;
    let vy0 = vyInput;
    let initialSpeed = v0;
    if (launchType === "vertical") {
      const up = document.getElementById("verticalDirection").value === "up";
      angle = up ? 90 : -90;
      vx0 = 0;
      if (!Number.isFinite(vy0) && Number.isFinite(v0)) vy0 = (up ? 1 : -1) * v0;
      if (!Number.isFinite(initialSpeed) && Number.isFinite(vy0)) initialSpeed = Math.abs(vy0);
    } else if (launchType === "horizontal") {
      angle = 0;
      vy0 = 0;
      if (!Number.isFinite(vx0) && Number.isFinite(v0)) vx0 = v0;
      if (!Number.isFinite(initialSpeed) && Number.isFinite(vx0)) initialSpeed = Math.abs(vx0);
    } else if (Number.isFinite(v0) && Number.isFinite(angle)) {
      const rad = angle * Math.PI / 180;
      if (!Number.isFinite(vx0)) vx0 = v0 * Math.cos(rad);
      if (!Number.isFinite(vy0)) vy0 = v0 * Math.sin(rad);
    } else if (Number.isFinite(vx0) && Number.isFinite(vy0)) {
      initialSpeed = Math.hypot(vx0, vy0);
      angle = Math.atan2(vy0, vx0) * 180 / Math.PI;
    }
    if (![initialSpeed, angle, vx0, vy0].every(Number.isFinite)) {
      throw new Error("Completa v₀ y θ, o proporciona directamente v₀x y v₀y.");
    }
    if (initialSpeed < 0 || angle < -90 || angle > 90) {
      throw new Error("La velocidad y el ángulo iniciales no forman un lanzamiento válido.");
    }
    return { launchType, x0, y0, v0: initialSpeed, angle, vx0: Math.abs(vx0) < 1e-12 ? 0 : vx0, vy0, g };
  }

  function rootsAtHeight(initial, targetY) {
    const { y0, vy0, g } = initial;
    const discriminant = vy0 * vy0 - 2 * g * (targetY - y0);
    if (discriminant < -1e-9) return { discriminant, times: [] };
    const root = Math.sqrt(Math.max(0, discriminant));
    const values = [(vy0 - root) / g, (vy0 + root) / g]
      .filter(time => time >= -1e-9)
      .map(time => Math.abs(time) < 1e-9 ? 0 : time)
      .sort((a, b) => a - b);
    return {
      discriminant: Math.max(0, discriminant),
      times: values.filter((time, index) => index === 0 || Math.abs(time - values[index - 1]) > 1e-8)
    };
  }

  function estadoEnTiempo(initial, time) {
    return {
      t: time,
      x: initial.x0 + initial.vx0 * time,
      y: initial.y0 + initial.vy0 * time - .5 * initial.g * time * time,
      vx: initial.vx0,
      vy: initial.vy0 - initial.g * time,
      speed: Math.hypot(initial.vx0, initial.vy0 - initial.g * time),
      direction: Math.atan2(initial.vy0 - initial.g * time, initial.vx0) * 180 / Math.PI
    };
  }

  function leerCondicionFinal(initial) {
    const type = ui.finalCondition.value;
    if (type === "none") return { type, defined: false, time: null, yFinal: null, xImpact: null };
    let time;
    let yFinal;
    if (type === "ground" || type === "sameHeight" || type === "height") {
      yFinal = type === "ground" ? 0
        : type === "sameHeight" ? initial.y0
          : unitValue("impactHeight", "impactHeightUnit", LENGTH_FACTORS);
      if (!Number.isFinite(yFinal) || yFinal < 0) throw new Error("Completa una altura de impacto válida.");
      const roots = rootsAtHeight(initial, yFinal).times;
      if (!roots.length) throw new Error("El proyectil no alcanza la altura definida como punto final.");
      time = roots[roots.length - 1];
    } else if (type === "time") {
      time = unitValue("impactTime", "impactTimeUnit", TIME_FACTORS);
      if (!Number.isFinite(time) || time < 0) throw new Error("Completa un tiempo final válido.");
      yFinal = estadoEnTiempo(initial, time).y;
    } else {
      const horizontal = unitValue("impactHorizontal", "impactHorizontalUnit", LENGTH_FACTORS);
      if (!Number.isFinite(horizontal)) throw new Error("Completa el dato horizontal de impacto.");
      if (Math.abs(initial.vx0) < 1e-12) throw new Error("Un lanzamiento vertical no puede terminar en otra posición horizontal.");
      const mode = document.querySelector('input[name="impactHorizontalMode"]:checked')?.value;
      const xTarget = mode === "coordinate" ? horizontal : initial.x0 + horizontal;
      time = (xTarget - initial.x0) / initial.vx0;
      if (time < 0) throw new Error("La posición horizontal de impacto queda detrás de la dirección del lanzamiento.");
      yFinal = estadoEnTiempo(initial, time).y;
    }
    if (time > 3600) throw new Error("El tiempo final calculado supera el límite físico del simulador.");
    const impact = estadoEnTiempo(initial, time);
    return { type, defined: true, time, yFinal, xImpact: impact.x, impact };
  }

  function resolverEstadoBase(initial, final) {
    const ascentTime = initial.vy0 > 0 ? initial.vy0 / initial.g : 0;
    const hmax = initial.vy0 > 0 ? initial.y0 + initial.vy0 ** 2 / (2 * initial.g) : initial.y0;
    const rangeSigned = final.defined ? final.xImpact - initial.x0 : null;
    return {
      ascentTime,
      hmax,
      rangeSigned,
      rmax: final.defined ? Math.abs(rangeSigned) : null,
      dmax: final.defined ? Math.abs(final.xImpact) : null
    };
  }

  function queryParameter(query) {
    const meta = QUERY_META[query.tipo];
    if (!meta.parameter) return { value: null, mode: null };
    const raw = Number(query.parametros.valor);
    if (!Number.isFinite(raw)) throw new Error(`Completa el parámetro de “${meta.title}”.`);
    const factors = meta.parameter === "time" ? TIME_FACTORS
      : ["height", "horizontal"].includes(meta.parameter) ? LENGTH_FACTORS
        : SPEED_FACTORS;
    return { value: raw * (factors[query.parametros.unidad] ?? 1), mode: query.parametros.modo };
  }

  function filtrarSolucionesFisicas(times, final) {
    const nonnegative = times.filter(time => Number.isFinite(time) && time >= -1e-9).map(time => Math.max(0, time));
    const physical = final.defined ? nonnegative.filter(time => time <= final.time + 1e-8) : nonnegative;
    return { physical, discarded: nonnegative.filter(time => !physical.includes(time)) };
  }

  function timeValidation(time, final) {
    if (time < 0) throw new Error("El tiempo de consulta no puede ser negativo.");
    if (final.defined && time > final.time + 1e-8) {
      throw new Error(`El proyectil ya impactó antes del tiempo solicitado. Tiempo de impacto: ${fmt(final.time)} s; tiempo consultado: ${fmt(time)} s.`);
    }
  }

  function lineState(s) {
    return `x = ${fmt(s.x)} m; y = ${fmt(s.y)} m; vx = ${fmt(s.vx)} m/s; vy = ${fmt(s.vy)} m/s; |v| = ${fmt(s.speed)} m/s; dirección = ${fmt(s.direction)}°`;
  }

  function createProcedure(title, data, formula, substitution, operation, result) {
    const item = procedure(title, data, formula, substitution, operation, result);
    item.role = "Resultado solicitado";
    return item;
  }

  function resolverConsulta(query, movement) {
    const { initial, final, base } = movement;
    const meta = QUERY_META[query.tipo];
    const param = queryParameter(query);
    const events = [];
    const impactState = final.defined ? final.impact : null;
    const commonFinalError = () => {
      if (!final.defined) throw new Error(`“${meta.title}” necesita una condición final o de impacto.`);
    };

    if (query.tipo === "components") {
      return { procedure: createProcedure(meta.title, `v₀ = ${fmt(initial.v0)} m/s; θ = ${fmt(initial.angle)}°`, "v₀x = v₀ cos θ; v₀y = v₀ sen θ", `v₀x = ${fmt(initial.v0)} cos(${fmt(initial.angle)}°); v₀y = ${fmt(initial.v0)} sen(${fmt(initial.angle)}°)`, "Se descompone la velocidad sobre los ejes cartesianos.", `v₀x = ${fmt(initial.vx0)} m/s; v₀y = ${fmt(initial.vy0)} m/s`), events };
    }
    if (query.tipo === "timeMax") {
      const time = base.ascentTime;
      events.push({ time, label: "Altura máxima", description: meta.title, queryId: query.id });
      return { procedure: createProcedure(meta.title, `v₀y = ${fmt(initial.vy0)} m/s; g = ${fmt(initial.g)} m/s²`, "vy = v₀y − gt; en Hmax, vy = 0", `t = ${fmt(initial.vy0)} / ${fmt(initial.g)}`, "Se anula la componente vertical de la velocidad.", `t subida = ${fmt(time)} s`), events };
    }
    if (query.tipo === "maxHeight") {
      events.push({ time: base.ascentTime, label: "Altura máxima", description: meta.title, queryId: query.id });
      return { procedure: createProcedure(meta.title, `y₀ = ${fmt(initial.y0)} m; v₀y = ${fmt(initial.vy0)} m/s; g = ${fmt(initial.g)} m/s²`, "Hmax = y₀ + v₀y²/(2g)", `Hmax = ${fmt(initial.y0)} + (${fmt(initial.vy0)})²/(2·${fmt(initial.g)})`, "La altura se mide respecto al suelo.", `Hmax = ${fmt(base.hmax)} m`), events };
    }
    if (queryNeedsFinal(query.tipo)) commonFinalError();
    if (query.tipo === "flightTime") {
      return { procedure: createProcedure(meta.title, `y₀ = ${fmt(initial.y0)} m; y final = ${fmt(final.yFinal)} m`, "y final = y₀ + v₀y t − ½gt²", `${fmt(final.yFinal)} = ${fmt(initial.y0)} + (${fmt(initial.vy0)})t − ½(${fmt(initial.g)})t²`, "Se toma la última raíz física de la condición de impacto.", `t vuelo = ${fmt(final.time)} s`), events };
    }
    if (query.tipo === "range") {
      return { procedure: createProcedure(meta.title, `v₀x = ${fmt(initial.vx0)} m/s; t final = ${fmt(final.time)} s`, "Rmax = |x impacto − x inicial| = |v₀x·t final|", `Rmax = |(${fmt(initial.vx0)})(${fmt(final.time)})|`, "Se mide desde el punto de lanzamiento.", `Rmax = ${fmt(base.rmax)} m`), events };
    }
    if (query.tipo === "groundDistance") {
      return { procedure: createProcedure(meta.title, `x₀ = ${fmt(initial.x0)} m; x impacto = ${fmt(final.xImpact)} m`, "Dmax = |x impacto − x origen del suelo|", `Dmax = |${fmt(final.xImpact)} − 0|`, "El origen horizontal del suelo se toma como x = 0.", `Dmax = ${fmt(base.dmax)} m`), events };
    }
    if (query.tipo === "finalPosition") {
      return { procedure: createProcedure(meta.title, `t final = ${fmt(final.time)} s`, "x = x₀ + v₀x t; y = y₀ + v₀y t − ½gt²", `t = ${fmt(final.time)} s`, "Se evalúan ambas coordenadas en el instante final.", `(x, y) = (${fmt(impactState.x)}, ${fmt(impactState.y)}) m`), events };
    }
    if (query.tipo === "impactSpeed" || query.tipo === "impactComponents" || query.tipo === "impactAngle") {
      const result = query.tipo === "impactSpeed" ? `|vf| = ${fmt(impactState.speed)} m/s`
        : query.tipo === "impactComponents" ? `vfx = ${fmt(impactState.vx)} m/s; vfy = ${fmt(impactState.vy)} m/s`
          : `θ final = ${fmt(impactState.direction)}°`;
      return { procedure: createProcedure(meta.title, `t final = ${fmt(final.time)} s; v₀x = ${fmt(initial.vx0)} m/s; v₀y = ${fmt(initial.vy0)} m/s`, "vfx = v₀x; vfy = v₀y − gt; |vf| = √(vfx² + vfy²)", `vfy = ${fmt(initial.vy0)} − (${fmt(initial.g)})(${fmt(final.time)})`, `vfx = ${fmt(impactState.vx)} m/s; vfy = ${fmt(impactState.vy)} m/s; |vf| = ${fmt(impactState.speed)} m/s`, result), events };
    }

    if (QUERY_META[query.tipo].parameter === "time") {
      timeValidation(param.value, final);
      const s = estadoEnTiempo(initial, param.value);
      events.push({ time: param.value, label: `Consulta en t = ${fmt(param.value)} s`, description: meta.title, queryId: query.id });
      let result = lineState(s);
      if (query.tipo === "positionXAtTime") result = `x = ${fmt(s.x)} m`;
      if (query.tipo === "positionYAtTime") result = `y = ${fmt(s.y)} m`;
      if (query.tipo === "positionAtTime") result = `(x, y) = (${fmt(s.x)}, ${fmt(s.y)}) m`;
      if (query.tipo === "velocityXAtTime") result = `vx = ${fmt(s.vx)} m/s`;
      if (query.tipo === "velocityYAtTime") result = `vy = ${fmt(s.vy)} m/s`;
      if (query.tipo === "velocityAtTime") result = `v = (${fmt(s.vx)}, ${fmt(s.vy)}) m/s`;
      if (query.tipo === "speedAtTime") result = `|v| = ${fmt(s.speed)} m/s`;
      if (query.tipo === "directionAtTime") result = `Dirección = ${fmt(s.direction)}°`;
      const continuation = final.defined ? "" : " No se ha definido un punto de impacto; representa la continuación matemática.";
      return { procedure: createProcedure(`${meta.title}: t = ${fmt(param.value)} s`, `x₀ = ${fmt(initial.x0)} m; y₀ = ${fmt(initial.y0)} m; v₀x = ${fmt(initial.vx0)} m/s; v₀y = ${fmt(initial.vy0)} m/s`, "x(t)=x₀+v₀x t; y(t)=y₀+v₀y t−½gt²; vx=v₀x; vy=v₀y−gt; |v|=√(vx²+vy²)", `t = ${fmt(param.value)} s`, lineState(s), result + continuation), events };
    }

    if (["timeAtHeight", "velocityAtHeight", "stateAtHeight", "reachesHeight"].includes(query.tipo)) {
      const solved = rootsAtHeight(initial, param.value);
      const filtered = filtrarSolucionesFisicas(solved.times, final);
      if (!filtered.physical.length) {
        const why = solved.discriminant < 0 || param.value > base.hmax + 1e-8
          ? `La altura solicitada (${fmt(param.value)} m) supera Hmax (${fmt(base.hmax)} m).`
          : filtered.discarded.length ? "Las soluciones matemáticas ocurren después del impacto."
            : "La altura no pertenece a la trayectoria física.";
        if (query.tipo === "reachesHeight") {
          return { procedure: createProcedure(meta.title, `y consulta = ${fmt(param.value)} m`, "Δ = v₀y² − 2g(y consulta − y₀)", `Δ = ${fmt(solved.discriminant)}`, why, "No, el proyectil no alcanza la altura solicitada."), events };
        }
        throw new Error(why);
      }
      const states = filtered.physical.map(time => estadoEnTiempo(initial, time));
      states.forEach((s, index) => events.push({
        time: s.t,
        label: `y = ${fmt(param.value)} m · ${s.t === 0 ? "lanzamiento" : s.vy > 0 ? "subiendo" : s.vy < 0 ? "bajando" : "altura máxima"}`,
        description: `${meta.title} · solución ${index + 1}`,
        queryId: query.id
      }));
      const rootsText = states.map((s, index) => `t${index + 1} = ${fmt(s.t)} s — ${s.t === 0 ? "instante de lanzamiento" : s.vy > 0 ? "subiendo" : s.vy < 0 ? "bajando" : "altura máxima"}`).join("; ");
      const result = query.tipo === "timeAtHeight" ? rootsText
        : query.tipo === "velocityAtHeight" ? states.map((s, i) => `En t${i + 1}: vx=${fmt(s.vx)}, vy=${fmt(s.vy)}, |v|=${fmt(s.speed)} m/s`).join("; ")
          : query.tipo === "reachesHeight" ? `Sí. ${rootsText}`
            : states.map((s, i) => `Solución ${i + 1}: ${lineState(s)}`).join("; ");
      const discarded = filtered.discarded.length ? ` Se descartó una raíz posterior al impacto: ${filtered.discarded.map(fmt).join(", ")} s.` : "";
      return { procedure: createProcedure(`${meta.title}: y = ${fmt(param.value)} m`, `y₀=${fmt(initial.y0)} m; v₀y=${fmt(initial.vy0)} m/s; g=${fmt(initial.g)} m/s²`, "½gt² − v₀y t + (y consulta − y₀) = 0", `½(${fmt(initial.g)})t² − (${fmt(initial.vy0)})t + (${fmt(param.value)} − ${fmt(initial.y0)}) = 0; Δ = ${fmt(solved.discriminant)}`, rootsText + discarded, result), events };
    }

    if (["heightAtX", "timeAtX", "stateAtX", "reachesX"].includes(query.tipo)) {
      const targetX = param.mode === "displacement" ? initial.x0 + param.value : param.value;
      if (Math.abs(initial.vx0) < 1e-12) {
        const same = Math.abs(targetX - initial.x0) < 1e-9;
        if (query.tipo === "reachesX") {
          return { procedure: createProcedure(meta.title, `x₀ = ${fmt(initial.x0)} m; v₀x = 0`, "x(t) = x₀ + v₀x t", `x(t) = ${fmt(initial.x0)} m`, "En un lanzamiento vertical la coordenada horizontal no cambia.", same ? "Sí, permanece siempre en esa coordenada." : "No alcanza otra coordenada horizontal."), events };
        }
        throw new Error("Como v₀x = 0, el proyectil no alcanza otra posición horizontal diferente de x₀.");
      }
      const time = (targetX - initial.x0) / initial.vx0;
      const valid = time >= -1e-9 && (!final.defined || time <= final.time + 1e-8);
      if (!valid) {
        if (query.tipo === "reachesX") return { procedure: createProcedure(meta.title, `x consulta = ${fmt(targetX)} m`, "t = (x consulta − x₀)/v₀x", `t = (${fmt(targetX)} − ${fmt(initial.x0)})/${fmt(initial.vx0)} = ${fmt(time)} s`, "El instante queda fuera del movimiento físico.", "No alcanza esa coordenada antes del impacto."), events };
        throw new Error("La posición horizontal solicitada no se alcanza durante el movimiento físico.");
      }
      const s = estadoEnTiempo(initial, Math.max(0, time));
      events.push({ time: s.t, label: `x = ${fmt(targetX)} m`, description: meta.title, queryId: query.id });
      const result = query.tipo === "heightAtX" ? `y = ${fmt(s.y)} m`
        : query.tipo === "timeAtX" ? `t = ${fmt(s.t)} s`
          : query.tipo === "reachesX" ? `Sí, la alcanza en t = ${fmt(s.t)} s.`
            : lineState(s);
      return { procedure: createProcedure(`${meta.title}: x = ${fmt(targetX)} m`, `x₀=${fmt(initial.x0)} m; v₀x=${fmt(initial.vx0)} m/s`, "t=(x−x₀)/v₀x; después se evalúan y(t), vx(t) y vy(t)", `t=(${fmt(targetX)}−${fmt(initial.x0)})/${fmt(initial.vx0)}=${fmt(s.t)} s`, lineState(s), result), events };
    }

    if (query.tipo === "timeAtVy" || query.tipo === "timeVyZero") {
      const targetVy = query.tipo === "timeVyZero" ? 0 : param.value;
      const time = (initial.vy0 - targetVy) / initial.g;
      const filtered = filtrarSolucionesFisicas([time], final);
      if (!filtered.physical.length) throw new Error("La velocidad vertical solicitada no ocurre durante el movimiento físico.");
      const s = estadoEnTiempo(initial, filtered.physical[0]);
      events.push({ time: s.t, label: `vy = ${fmt(targetVy)} m/s`, description: meta.title, queryId: query.id });
      return { procedure: createProcedure(meta.title, `v₀y=${fmt(initial.vy0)} m/s; vy=${fmt(targetVy)} m/s`, "vy = v₀y − gt; t = (v₀y − vy)/g", `t=(${fmt(initial.vy0)}−${fmt(targetVy)})/${fmt(initial.g)}`, s.vy > 0 ? "El proyectil está subiendo." : s.vy < 0 ? "El proyectil está bajando." : "Corresponde a la altura máxima.", `t = ${fmt(s.t)} s`), events };
    }

    if (query.tipo === "timeAtSpeed") {
      const speed = param.value;
      if (speed < 0) throw new Error("La rapidez solicitada no puede ser negativa.");
      const verticalSquared = speed * speed - initial.vx0 * initial.vx0;
      if (verticalSquared < -1e-9) throw new Error("La rapidez solicitada es menor que |v₀x| y no puede alcanzarse.");
      const vertical = Math.sqrt(Math.max(0, verticalSquared));
      let candidates = [vertical, -vertical];
      if (param.mode === "up") candidates = candidates.filter(value => value >= 0);
      if (param.mode === "down") candidates = candidates.filter(value => value <= 0);
      const times = candidates.map(value => (initial.vy0 - value) / initial.g);
      const filtered = filtrarSolucionesFisicas(times, final);
      if (!filtered.physical.length) throw new Error("La rapidez solicitada no ocurre durante el movimiento físico.");
      const uniqueTimes = filtered.physical.sort((a, b) => a - b)
        .filter((time, index, list) => index === 0 || Math.abs(time - list[index - 1]) > 1e-8);
      const states = uniqueTimes.map(time => estadoEnTiempo(initial, time));
      states.forEach(s => events.push({ time: s.t, label: `|v| = ${fmt(speed)} m/s · ${s.vy >= 0 ? "subiendo" : "bajando"}`, description: meta.title, queryId: query.id }));
      return { procedure: createProcedure(meta.title, `|v|=${fmt(speed)} m/s; vx=${fmt(initial.vx0)} m/s`, "|v|² = vx² + vy²; vy = ±√(|v|²−vx²); t=(v₀y−vy)/g", `vy = ±√((${fmt(speed)})²−(${fmt(initial.vx0)})²)`, states.map(s => `t=${fmt(s.t)} s (${s.vy >= 0 ? "subiendo" : "bajando"})`).join("; "), states.map(s => `${fmt(s.t)} s — ${s.vy >= 0 ? "subiendo" : "bajando"}`).join("; ")), events };
    }
    throw new Error(`La consulta “${meta.title}” todavía no tiene una ruta de cálculo válida.`);
  }

  function commonComponentsProcedure(initial) {
    const item = createProcedure(
      "Cálculo común — Componentes iniciales",
      `v₀ = ${fmt(initial.v0)} m/s; θ = ${fmt(initial.angle)}°`,
      "v₀x = v₀ cos θ; v₀y = v₀ sen θ",
      `v₀x = ${fmt(initial.v0)} cos(${fmt(initial.angle)}°); v₀y = ${fmt(initial.v0)} sen(${fmt(initial.angle)}°)`,
      "Estas componentes se calculan una sola vez y se reutilizan en todos los incisos.",
      `v₀x = ${fmt(initial.vx0)} m/s; v₀y = ${fmt(initial.vy0)} m/s`
    );
    item.role = "Resultado intermedio";
    return item;
  }

  function summaryDefinition(title, rows) {
    const section = document.createElement("section");
    section.className = "exercise-summary-block";
    const heading = document.createElement("h4");
    heading.textContent = title;
    const list = document.createElement("dl");
    rows.forEach(([term, value]) => {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = term;
      dd.textContent = value;
      row.append(dt, dd);
      list.append(row);
    });
    section.append(heading, list);
    return section;
  }

  function finalConditionSummary(final, initial) {
    if (!final.defined) return [["Condición", "Punto final no definido"]];
    const names = {
      ground: "Impacta en el suelo",
      height: "Impacta a una altura determinada",
      sameHeight: "Termina a la altura inicial",
      time: "Termina en un tiempo determinado",
      horizontal: "Impacta en una posición horizontal"
    };
    return [
      ["Condición", names[final.type] ?? "Punto final definido"],
      ["t final", `${fmt(final.time)} s`],
      ["x impacto", `${fmt(final.xImpact)} m`],
      ["y impacto", `${fmt(final.yFinal)} m`],
      ["Altura inicial", `${fmt(initial.y0)} m`]
    ];
  }

  function renderExerciseSummary(movement) {
    const { initial, final, resultados } = movement;
    const initialBlock = summaryDefinition("Datos del lanzamiento", [
      ["Tipo", initial.launchType === "vertical" ? "Vertical" : initial.launchType === "horizontal" ? "Horizontal" : "Parabólico"],
      ["v₀", `${fmt(initial.v0)} m/s`],
      ["θ", `${fmt(initial.angle)}°`],
      ["x₀", `${fmt(initial.x0)} m`],
      ["y₀", `${fmt(initial.y0)} m`],
      ["g", `${fmt(initial.g)} m/s²`]
    ]);
    const finalBlock = summaryDefinition("Condición final", finalConditionSummary(final, initial));
    const requestedBlock = document.createElement("section");
    requestedBlock.className = "exercise-summary-block";
    const heading = document.createElement("h4");
    heading.textContent = "Resultados solicitados";
    const list = document.createElement("ol");
    list.className = "requested-results-list";
    resultados.forEach((item, index) => {
      const li = document.createElement("li");
      const letter = document.createElement("span");
      letter.className = "result-letter";
      letter.textContent = String.fromCharCode(97 + index);
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      const result = document.createElement("span");
      title.textContent = item.title;
      result.textContent = item.result;
      copy.append(title, result);
      li.append(letter, copy);
      list.append(li);
    });
    requestedBlock.append(heading, list);
    ui.summaryGrid.replaceChildren(initialBlock, finalBlock, requestedBlock);
    ui.requestSummary.classList.remove("hidden");
  }

  function ordenarEventos(events, initial, final, base) {
    const all = [{ time: 0, label: "Lanzamiento", description: "Instante inicial" }, ...events];
    if (initial.vy0 > 0 && (!final.defined || base.ascentTime <= final.time + 1e-8)) {
      all.push({ time: base.ascentTime, label: "Altura máxima", description: `Hmax = ${fmt(base.hmax)} m` });
    }
    if (final.defined) all.push({ time: final.time, label: "Impacto", description: `Punto final en (${fmt(final.xImpact)}, ${fmt(final.yFinal)}) m` });
    return all
      .filter(event => Number.isFinite(event.time))
      .sort((a, b) => a.time - b.time)
      .filter((event, index, list) => index === 0 || Math.abs(event.time - list[index - 1].time) > 1e-8 || event.label !== list[index - 1].label);
  }

  function solveV2(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    clearV2Error();
    if (!consultas.length) {
      showV2Error("Agrega al menos una pregunta del ejercicio.");
      return;
    }
    try {
      ui.questionList.querySelectorAll(".question-card").forEach(syncQueryCard);
      const initial = leerDatosIniciales();
      const final = leerCondicionFinal(initial);
      const base = resolverEstadoBase(initial, final);
      const movement = { initial, final, base, consultas: structuredClone(consultas), resultados: [], eventos: [] };
      const procedures = consultas.some(query => query.tipo === "components") ? [] : [commonComponentsProcedure(initial)];
      const events = [];
      consultas.forEach((query, index) => {
        if (queryNeedsFinal(query.tipo) && !final.defined) {
          throw new Error(`El inciso ${String.fromCharCode(97 + index)}) necesita una condición final válida.`);
        }
        const resolved = resolverConsulta(query, movement);
        resolved.procedure.title = `${String.fromCharCode(97 + index)}) ${resolved.procedure.title}`;
        procedures.push(resolved.procedure);
        movement.resultados.push({
          title: QUERY_META[query.tipo].title,
          result: resolved.procedure.result
        });
        events.push(...resolved.events);
      });
      movement.eventos = ordenarEventos(events, initial, final, base);
      movimientoActual = movement;
      state.solution = { v2: true, movement, procedures };
      dom.procedureList.replaceChildren(...procedures.map(renderProcedureCard));
      renderExerciseSummary(movement);
      dom.solutionPicker.classList.add("hidden");
      dom.solutionSection.classList.remove("hidden");
      dom.solutionSection.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    } catch (error) {
      showV2Error(error.message);
    }
  }

  function updateReadyState() {
    if (!ui.solve) return;
    const launchType = document.querySelector('input[name="launchType"]:checked')?.value;
    const hasV0 = Number.isFinite(numberFrom("knownV0"));
    const hasAngle = Number.isFinite(numberFrom("knownAngle"));
    const hasVx0 = Number.isFinite(numberFrom("knownVx0"));
    const hasVy0 = Number.isFinite(numberFrom("knownVy0"));
    const hasGravity = Number.isFinite(numberFrom("knownG")) && numberFrom("knownG") > 0;
    const baseReady = hasGravity && (
      launchType === "vertical" ? hasV0 || hasVy0
        : launchType === "horizontal" ? hasV0 || hasVx0
          : (hasV0 && hasAngle) || (hasVx0 && hasVy0)
    );
    const incomplete = consultas.some(query => QUERY_META[query.tipo].parameter && String(query.parametros.valor ?? "").trim() === "");
    const finalType = ui.finalCondition.value;
    const finalParameterReady = finalType === "height" ? Number.isFinite(numberFrom("impactHeight"))
      : finalType === "time" ? Number.isFinite(numberFrom("impactTime"))
        : finalType === "horizontal" ? Number.isFinite(numberFrom("impactHorizontal"))
          : true;
    const blockedByFinal = consultas.some(query => queryNeedsFinal(query.tipo)) && (finalType === "none" || !finalParameterReady);
    ui.solve.disabled = consultas.length === 0 || incomplete || !baseReady || blockedByFinal;
    ui.questionList.querySelectorAll(".question-card").forEach(card => {
      syncQueryCard(card);
      const query = consultas.find(item => item.id === card.dataset.queryId);
      const status = card.querySelector(".question-status");
      const needsParameter = QUERY_META[query.tipo].parameter;
      const missing = needsParameter && String(query.parametros.valor ?? "").trim() === "";
      const needsFinal = queryNeedsFinal(query.tipo) && ui.finalCondition.value === "none";
      status.classList.toggle("invalid", missing || needsFinal || !baseReady);
      status.textContent = missing ? "Completa el valor propio de esta consulta."
        : !baseReady ? "Completa los datos iniciales necesarios para habilitarla."
        : needsFinal ? "Esta pregunta necesita definir dónde termina el movimiento."
          : "Lista para resolver con los datos iniciales.";
    });
  }

  function prepareV2Simulation(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!movimientoActual) return;
    clearV2Error();
    const { initial, final, eventos } = movimientoActual;
    const latestEvent = eventos.reduce((maximum, item) => Math.max(maximum, item.time), 0);
    const horizon = final.defined ? final.time : Math.max(1, latestEvent);
    state.exerciseEvents = eventos.filter(item => item.time <= horizon + 1e-8);
    const simulation = calculateSimulation({
      v0: initial.v0,
      angle: initial.angle,
      x0: initial.x0,
      y0: initial.y0,
      g: initial.g,
      flightTime: horizon
    });
    if (simulation.error) {
      showV2Error(simulation.error);
      return;
    }
    simulation.hasDefinedFinal = final.defined;
    simulation.finalHeight = final.defined ? final.yFinal : simulation.finalHeight;
    prepareSimulation(simulation, final.defined ? "Ejercicio completo hasta el impacto" : "Consultas del ejercicio · sin impacto definido");
    renderEventSelector();
    drawFrame();
    if (!final.defined) {
      dom.overlayTime.textContent = "No definido";
      const totalRow = [...dom.loadedData.querySelectorAll("div")].find(row => row.querySelector("dt")?.textContent === "t total");
      if (totalRow) totalRow.querySelector("dd").textContent = "No definido";
    }
  }

  function renderEventSelector() {
    const events = state.exerciseEvents ?? [];
    ui.events.classList.toggle("hidden", events.length === 0);
    ui.eventSelect.replaceChildren(...events.map((event, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${event.label} — t = ${fmt(event.time)} s`;
      return option;
    }));
    if (events.length) {
      ui.eventSelect.value = "0";
      ui.eventDescription.textContent = events[0].description;
    }
  }

  function clearV2(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    ui.form.reset();
    document.getElementById("knownG").value = "9.81";
    document.getElementById("knownX0").value = "0";
    document.getElementById("knownY0").value = "0";
    consultas = [];
    movimientoActual = null;
    state.solution = null;
    state.exerciseEvents = [];
    dom.solutionSection.classList.add("hidden");
    dom.simulationPanel.classList.add("hidden");
    dom.procedureList.replaceChildren();
    ui.summaryGrid.replaceChildren();
    ui.requestSummary.classList.add("hidden");
    clearV2Error();
    updateLaunchTypeUI();
    updateFinalUI();
    renderQuestions();
  }

  const originalDrawFrame = drawFrame;
  drawFrame = function drawFrameWithExerciseEvents() {
    originalDrawFrame();
    if (!state.simulation || !state.transform || !state.exerciseEvents?.length) return;
    const tr = state.transform;
    state.exerciseEvents.forEach((event, index) => {
      const point = pointAtTime(state.simulation, event.time);
      const selected = Number(ui.eventSelect?.value ?? -1) === index && Math.abs(state.time - event.time) < 1e-6;
      drawPoint(point.x, point.y, selected ? "#7b3f92" : "#2b6cb0", tr, selected ? 7 : 4);
    });
  };

  ui.form.addEventListener("submit", solveV2, true);
  ui.clear.addEventListener("click", clearV2, true);
  dom.simulateResult.addEventListener("click", prepareV2Simulation, true);
  ui.addQuestion.addEventListener("click", () => addQuery(ui.questionType.value));
  ui.addTimeQuestion.addEventListener("click", () => addQuery("stateAtTime"));
  ui.finalCondition.addEventListener("change", updateFinalUI);
  ui.questionList.addEventListener("input", event => {
    const card = event.target.closest(".question-card");
    if (card) {
      syncQueryCard(card);
      updateReadyState();
    }
  });
  ui.questionList.addEventListener("change", event => {
    const card = event.target.closest(".question-card");
    if (card) {
      syncQueryCard(card);
      updateReadyState();
    }
  });
  ui.questionList.addEventListener("click", event => {
    const button = event.target.closest(".question-remove");
    if (!button) return;
    consultas = consultas.filter(query => query.id !== button.closest(".question-card").dataset.queryId);
    renderQuestions();
  });
  ui.form.addEventListener("input", updateReadyState);
  ui.form.addEventListener("change", updateReadyState);
  ui.eventSelect.addEventListener("change", () => {
    const event = state.exerciseEvents?.[Number(ui.eventSelect.value)];
    if (!event || !state.simulation) return;
    stopAnimation();
    state.time = event.time;
    state.running = false;
    state.paused = true;
    dom.pause.textContent = "Reanudar";
    dom.pause.disabled = false;
    setBadge("paused");
    ui.eventDescription.textContent = event.description;
    drawFrame();
  });

  populateQuestionTypes();
  updateFinalUI();
  renderQuestions();
})();
