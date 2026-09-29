(() => {
  "use strict";

  const data = window.RAG_RESULTS || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const strategyMeta = {
    "Fixed-size": { key: "fixed", label: "Por tamaño", color: "#725d87" },
    "Semantic breakpoint": { key: "breakpoint", label: "Cambio de tema", color: "#b77722" },
    "Structure-aware": { key: "structure", label: "Estructura", color: "#3f7765" },
  };

  const demoSentences = [
    { text: "La atención influye en cómo recordamos una experiencia.", topic: "mind", paragraph: 1 },
    { text: "La memoria también cambia con el contexto de aprendizaje.", topic: "mind", paragraph: 1 },
    { text: "Python permite automatizar tareas repetitivas con pocas líneas.", topic: "code", paragraph: 2 },
    { text: "Los programas organizan instrucciones para resolver un problema.", topic: "code", paragraph: 2 },
    { text: "La fermentación transforma ingredientes y modifica su sabor.", topic: "food", paragraph: 3 },
    { text: "El vinagre de manzana aparece en distintas preparaciones.", topic: "food", paragraph: 3 },
    { text: "La cocina italiana combina técnicas simples con productos frescos.", topic: "food", paragraph: 3 },
  ];

  const methodConfig = {
    fixed: {
      title: "Fixed-size",
      signal: "Posición y longitud",
      copy: "Agrupa una cantidad fija de oraciones y conserva un pequeño solapamiento entre chunks.",
      groups: [[0, 1, 2], [3, 4, 5], [6]],
    },
    breakpoint: {
      title: "Semantic breakpoint",
      signal: "Embeddings y distancia semántica",
      copy: "Representa las oraciones, calcula el cambio entre vecinas y abre un corte cuando la distancia supera el umbral.",
      groups: [[0, 1], [2, 3], [4, 5, 6]],
      distances: [0.12, 0.73, 0.10, 0.68, 0.16, 0.11],
      threshold: 0.45,
    },
    structure: {
      title: "Structure-aware",
      signal: "Párrafos y tamaño máximo",
      copy: "Toma los límites de párrafo que ya existen en el documento y solo divide internamente cuando el bloque supera el máximo.",
      groups: [[0, 1], [2, 3], [4, 5, 6]],
    },
  };

  const state = { method: "fixed", metric: "f1", cost: "tokens", tradeoffK: 5 };
  const hasRun = Array.isArray(data.metrics) && data.metrics.length > 0 && Array.isArray(data.strategies) && data.strategies.length > 0;
  const tooltip = $("#chart-tooltip");

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmt(value, digits = 2) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return number.toLocaleString("es-CO", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function integer(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return Math.round(number).toLocaleString("es-CO");
  }

  function seconds(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return `${fmt(number, 1)} s`;
  }

  function signedPct(value, digits = 1) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return `${number >= 0 ? "+" : ""}${fmt(number, digits)}%`;
  }

  function metricLabel(metric) {
    return { f1: "F1", precision: "Precisión", recall: "Recall" }[metric] || metric;
  }

  function meta(name) {
    return strategyMeta[name] || { key: "fixed", label: name, color: "#173f68" };
  }

  function strategyRow(name) {
    return (data.strategies || []).find((row) => row.strategy === name);
  }

  function strategyRows() {
    return Object.keys(strategyMeta).map(strategyRow).filter(Boolean);
  }

  function metricRow(name, k) {
    return (data.metrics || []).find((row) => row.strategy === name && Number(row.k) === Number(k));
  }

  function metricValue(name, k, metric = "f1") {
    const row = metricRow(name, k);
    return row ? Number(row[metric]) : NaN;
  }

  function deltaPercent(current, baseline) {
    const a = Number(current);
    const b = Number(baseline);
    return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a / b - 1) * 100 : NaN;
  }

  function showTooltip(event, title, lines) {
    if (!tooltip) return;
    tooltip.innerHTML = `<strong>${escapeHtml(title)}</strong>${lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("<br>")}`;
    tooltip.classList.add("visible");
    moveTooltip(event);
  }

  function moveTooltip(event) {
    if (!tooltip) return;
    const x = Math.min(event.clientX + 14, window.innerWidth - tooltip.offsetWidth - 12);
    const y = Math.min(event.clientY + 14, window.innerHeight - tooltip.offsetHeight - 12);
    tooltip.style.left = `${Math.max(8, x)}px`;
    tooltip.style.top = `${Math.max(8, y)}px`;
  }

  function hideTooltip() {
    tooltip?.classList.remove("visible");
  }

  function bindTooltip(element, title, lines) {
    element.addEventListener("pointerenter", (event) => showTooltip(event, title, lines));
    element.addEventListener("pointermove", moveTooltip);
    element.addEventListener("pointerleave", hideTooltip);
    element.addEventListener("focus", (event) => showTooltip(event, title, lines));
    element.addEventListener("blur", hideTooltip);
  }

  function renderSentences() {
    $("#demo-sentences").innerHTML = demoSentences.map((sentence, index) => `
      <div class="demo-sentence topic-${sentence.topic}" style="animation-delay:${index * 85}ms">
        <span class="snum">S${index + 1}</span>${escapeHtml(sentence.text)}
      </div>
    `).join("");
  }

  function renderFixedDecision() {
    const groups = [[1, 2, 3], [4, 5, 6], [7]];
    return `
      <div class="decision-title">Cuenta posiciones</div>
      <p class="decision-subtitle">La regla de corte no depende del significado.</p>
      <div class="fixed-counter">
        ${groups.map((group, groupIndex) => `
          <div class="fixed-counter-row" style="animation-delay:${550 + groupIndex * 240}ms">
            <strong>C${groupIndex + 1}</strong>
            <div class="counter-track">
              ${group.map((value, itemIndex) => `<i style="animation-delay:${720 + groupIndex * 240 + itemIndex * 90}ms" title="S${value}"></i>`).join("")}
            </div>
            <span>${group.length}/3</span>
          </div>`).join("")}
      </div>
      <div class="fixed-cut">corte cada 3 oraciones</div>`;
  }

  function vectorBars(index) {
    const patterns = [
      [38, 72, 44, 86, 58, 30], [52, 80, 36, 74, 48, 61], [86, 35, 70, 42, 78, 56],
      [74, 42, 82, 35, 68, 50], [32, 88, 56, 74, 44, 81], [40, 76, 61, 84, 52, 68], [46, 82, 54, 79, 62, 72],
    ];
    return patterns[index].map((height, barIndex) => `<i style="height:${height}%;animation-delay:${700 + index * 95 + barIndex * 20}ms"></i>`).join("");
  }

  function renderBreakpointDecision() {
    const config = methodConfig.breakpoint;
    return `
      <div class="decision-title">Embeddings → distancia → corte</div>
      <div class="embedding-stack">
        ${demoSentences.map((sentence, index) => `
          <div class="embedding-row" style="animation-delay:${420 + index * 95}ms">
            <strong>S${index + 1}</strong>
            <div class="vector">${vectorBars(index)}</div>
            ${index < config.distances.length ? `
              <div class="distance-mini"><i style="--distance:${Math.round(config.distances[index] * 100)}%;animation-delay:${1120 + index * 110}ms"></i></div>
            ` : `<span></span>`}
          </div>`).join("")}
      </div>
      <div class="threshold-box">
        <span>umbral 0.45</span>
        <div class="threshold-line"></div>
        <div class="breakpoint-pips">
          ${config.distances.map((distance, index) => `<i style="--height:${Math.max(10, Math.round(distance * 72))}px;animation-delay:${1450 + index * 90}ms" title="${distance >= config.threshold ? "corte" : "continúa"}"></i>`).join("")}
        </div>
      </div>`;
  }

  function renderStructureDecision() {
    const paragraphSizes = [2, 2, 3];
    return `
      <div class="decision-title">Detecta límites de párrafo</div>
      <p class="decision-subtitle">La estructura del documento ya aporta la señal de corte.</p>
      <div class="paragraph-stage">
        ${paragraphSizes.map((size, index) => `
          <div class="paragraph-block" style="animation-delay:${520 + index * 260}ms">
            <div class="paragraph-label">Párrafo ${index + 1} · ${size} or.</div>
            <div class="paragraph-lines">
              ${Array.from({ length: size }, (_, line) => `<i style="width:${line % 2 ? 72 : 94}%;animation-delay:${720 + index * 260 + line * 80}ms"></i>`).join("")}
            </div>
          </div>
          ${index < paragraphSizes.length - 1 ? `<div class="structure-boundary" style="animation-delay:${900 + index * 300}ms"></div>` : ""}
        `).join("")}
      </div>`;
  }

  function renderChunks(method) {
    const config = methodConfig[method];
    $("#demo-chunks").innerHTML = config.groups.map((indices, groupIndex) => {
      const excerpt = indices.map((index) => demoSentences[index].text).join(" ");
      return `
        <div class="demo-chunk ${method}" style="animation-delay:${2050 + groupIndex * 190}ms">
          <strong><span>Chunk ${groupIndex + 1}</span><span>${indices.length} or.</span></strong>
          <div class="demo-chip-row">${indices.map((index) => `<span class="demo-chip">S${index + 1}</span>`).join("")}</div>
          <small>${escapeHtml(excerpt.length > 110 ? `${excerpt.slice(0, 110)}…` : excerpt)}</small>
        </div>`;
    }).join("");
  }

  function renderMethod(method, animate = true) {
    state.method = method;
    $$(".method-tab").forEach((button) => {
      const active = button.dataset.method === method;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    const flow = $("#method-flow");
    const config = methodConfig[method];
    flow.classList.remove("is-running");
    flow.style.setProperty("--active-method", method === "fixed" ? "#725d87" : method === "breakpoint" ? "#b77722" : "#3f7765");
    renderSentences();
    $("#demo-decision").innerHTML = method === "fixed" ? renderFixedDecision() : method === "breakpoint" ? renderBreakpointDecision() : renderStructureDecision();
    renderChunks(method);
    $("#method-caption").innerHTML = `
      <div><strong>${escapeHtml(config.title)}</strong><p>${escapeHtml(config.copy)}</p></div>
      <span class="signal-tag">${escapeHtml(config.signal)}</span>`;

    if (animate) requestAnimationFrame(() => requestAnimationFrame(() => flow.classList.add("is-running")));
  }

  function svgEl(tag, attrs = {}, text = "") {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
    if (text !== "") element.textContent = text;
    return element;
  }

  function renderRunMeta() {
    const run = data.run || {};
    const model = String(run.embedding_model || "").replace("sentence-transformers/", "");
    $("#run-meta").innerHTML = `
      <strong>${integer(run.n_docs)} documentos · ${integer(run.n_questions)} preguntas</strong>
      <span>${escapeHtml(model)} · split ${escapeHtml(run.split || "—")} · semilla ${escapeHtml(run.seed ?? "—")}</span>`;
  }

  function renderScoreStrip() {
    const names = Object.keys(strategyMeta);
    const values = names.map((name) => metricValue(name, 5, "f1")).filter(Number.isFinite);
    const max = Math.max(...values, .001);
    $("#score-strip").innerHTML = names.map((name) => {
      const value = metricValue(name, 5, "f1");
      const width = Number.isFinite(value) ? Math.max(3, value / max * 100) : 0;
      return `
        <article class="score-card ${meta(name).key}">
          <span class="score-name">${escapeHtml(meta(name).label)}${name === "Structure-aware" ? " · propuesta" : ""}</span>
          <strong>${fmt(value, 4)}</strong>
          <small>F1@5</small>
          <div class="score-meter"><i style="width:${width}%"></i></div>
        </article>`;
    }).join("");
  }

  function renderHighlights() {
    const structure = strategyRow("Structure-aware");
    const fixed = strategyRow("Fixed-size");
    const semantic = strategyRow("Semantic breakpoint");
    if (!structure || !fixed || !semantic) return;
    const structureF5 = metricValue("Structure-aware", 5);
    const fixedF5 = metricValue("Fixed-size", 5);
    const structureF10 = metricValue("Structure-aware", 10);
    const tokenDelta = deltaPercent(structure.total_embedding_effective_tokens, fixed.total_embedding_effective_tokens);
    const timeDelta = deltaPercent(structure.total_preprocess_seconds, fixed.total_preprocess_seconds);
    const f5Abs = structureF5 - fixedF5;
    $("#highlight-grid").innerHTML = `
      <article class="highlight-card structure-accent"><span>F1@5 · Structure-aware</span><strong>${fmt(structureF5, 4)}</strong><small>${f5Abs >= 0 ? "+" : ""}${fmt(f5Abs, 4)} frente a Fixed-size</small></article>
      <article class="highlight-card structure-accent"><span>F1@10 · Structure-aware</span><strong>${fmt(structureF10, 4)}</strong><small>mayor valor observado en k=10</small></article>
      <article class="highlight-card structure-accent"><span>Tokens · Structure-aware</span><strong>${integer(structure.total_embedding_effective_tokens)}</strong><small>${signedPct(tokenDelta)} frente a Fixed-size</small></article>
      <article class="highlight-card structure-accent"><span>Tiempo · Structure-aware</span><strong>${seconds(structure.total_preprocess_seconds)}</strong><small>${signedPct(timeDelta)} frente a Fixed-size</small></article>`;
  }

  function renderQualityChart() {
    const target = $("#quality-chart");
    const rows = data.metrics || [];
    const ks = [...new Set(rows.map((row) => Number(row.k)))].filter(Number.isFinite).sort((a, b) => a - b);
    const names = Object.keys(strategyMeta).filter((name) => rows.some((row) => row.strategy === name));
    const values = rows.map((row) => Number(row[state.metric])).filter(Number.isFinite);
    if (!ks.length || !values.length) return;

    const width = 760, height = 360;
    const pad = { left: 62, right: 32, top: 24, bottom: 64 };
    const maxData = Math.max(...values, .05);
    const step = maxData <= .12 ? .025 : .05;
    const maxY = Math.ceil((maxData * 1.13) / step) * step;
    const x = (k) => pad.left + (ks.indexOf(k) / Math.max(ks.length - 1, 1)) * (width - pad.left - pad.right);
    const y = (value) => height - pad.bottom - value / maxY * (height - pad.top - pad.bottom);
    const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${metricLabel(state.metric)} según k` });

    for (let i = 0; i <= 5; i += 1) {
      const value = maxY * i / 5;
      const yy = y(value);
      svg.appendChild(svgEl("line", { x1: pad.left, y1: yy, x2: width - pad.right, y2: yy, class: "chart-gridline" }));
      svg.appendChild(svgEl("text", { x: pad.left - 10, y: yy + 4, class: "chart-label", "text-anchor": "end" }, value.toFixed(3)));
    }

    ks.forEach((k) => {
      const xx = x(k);
      svg.appendChild(svgEl("line", { x1: xx, y1: height - pad.bottom, x2: xx, y2: height - pad.bottom + 5, class: "chart-axis" }));
      svg.appendChild(svgEl("text", { x: xx, y: height - pad.bottom + 20, class: "chart-label", "text-anchor": "middle" }, String(k)));
    });

    names.forEach((name, seriesIndex) => {
      const series = ks.map((k) => rows.find((row) => row.strategy === name && Number(row.k) === k)).filter(Boolean);
      const path = series.map((row, index) => `${index === 0 ? "M" : "L"} ${x(Number(row.k))} ${y(Number(row[state.metric]))}`).join(" ");
      const isProposed = name === "Structure-aware";
      svg.appendChild(svgEl("path", { d: path, fill: "none", stroke: meta(name).color, "stroke-width": isProposed ? 5 : 2.5, opacity: isProposed ? 1 : .72, class: "chart-series", style: `animation-delay:${seriesIndex * 120}ms` }));
      series.forEach((row, index) => {
        const circle = svgEl("circle", { cx: x(Number(row.k)), cy: y(Number(row[state.metric])), r: isProposed ? 7 : 5, fill: "#fff", stroke: meta(name).color, "stroke-width": isProposed ? 3.5 : 2.2, opacity: isProposed ? 1 : .82, class: "chart-dot", tabindex: "0", style: `animation-delay:${220 + index * 80}ms` });
        bindTooltip(circle, meta(name).label, [`k = ${row.k}`, `${metricLabel(state.metric)} = ${fmt(row[state.metric], 4)}`, `Precisión = ${fmt(row.precision, 4)}`, `Recall = ${fmt(row.recall, 4)}`]);
        svg.appendChild(circle);
      });
      const last = series[series.length - 1];
      if (last) svg.appendChild(svgEl("text", { x: x(Number(last.k)) - 5, y: y(Number(last[state.metric])) - 11, fill: meta(name).color, class: "chart-point-label", "text-anchor": "end" }, meta(name).label));
    });

    svg.appendChild(svgEl("line", { x1: pad.left, y1: height - pad.bottom, x2: width - pad.right, y2: height - pad.bottom, class: "chart-axis" }));
    svg.appendChild(svgEl("line", { x1: pad.left, y1: pad.top, x2: pad.left, y2: height - pad.bottom, class: "chart-axis" }));
    svg.appendChild(svgEl("text", { x: (pad.left + width - pad.right) / 2, y: height - 12, class: "chart-axis-title", "text-anchor": "middle" }, "k · chunks recuperados"));
    svg.appendChild(svgEl("text", { x: 14, y: (pad.top + height - pad.bottom) / 2, class: "chart-axis-title", transform: `rotate(-90 14 ${(pad.top + height - pad.bottom) / 2})`, "text-anchor": "middle" }, metricLabel(state.metric)));
    target.innerHTML = "";
    target.appendChild(svg);
  }

  function renderStackedBarChart(targetSelector, parts, axisTitle, formatter, tooltipFormatter) {
    const target = $(targetSelector);
    const rows = strategyRows();
    const totals = rows.map((row) => parts.reduce((sum, part) => sum + Number(row[part.field] || 0), 0));
    const maxTotal = Math.max(...totals, 1);
    const width = 760, height = 360;
    const pad = { left: 128, right: 96, top: 28, bottom: 64 };
    const plotW = width - pad.left - pad.right;
    const rowGap = 74;
    const barH = 32;
    const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": axisTitle });

    for (let i = 0; i <= 4; i += 1) {
      const value = maxTotal * i / 4;
      const xx = pad.left + plotW * i / 4;
      svg.appendChild(svgEl("line", { x1: xx, y1: pad.top, x2: xx, y2: height - pad.bottom, class: "chart-gridline" }));
      svg.appendChild(svgEl("text", { x: xx, y: height - pad.bottom + 20, class: "chart-label", "text-anchor": "middle" }, formatter(value, true)));
    }

    rows.forEach((row, rowIndex) => {
      const y = pad.top + 30 + rowIndex * rowGap;
      svg.appendChild(svgEl("text", { x: pad.left - 12, y: y + barH / 2 + 4, class: "chart-point-label", "text-anchor": "end" }, meta(row.strategy).label));
      let cursor = pad.left;
      parts.forEach((part, partIndex) => {
        const value = Number(row[part.field] || 0);
        const w = value / maxTotal * plotW;
        if (w <= 0) return;
        const rect = svgEl("rect", { x: cursor, y, width: Math.max(1, w), height: barH, rx: 4, fill: part.color, class: "chart-bar", tabindex: "0", style: `animation-delay:${rowIndex * 120 + partIndex * 70}ms` });
        bindTooltip(rect, meta(row.strategy).label, [`${part.label}: ${tooltipFormatter(value)}`, `Total: ${tooltipFormatter(totals[rowIndex])}`]);
        svg.appendChild(rect);
        cursor += w;
      });
      svg.appendChild(svgEl("text", { x: pad.left + totals[rowIndex] / maxTotal * plotW + 8, y: y + barH / 2 + 4, class: "chart-point-label" }, tooltipFormatter(totals[rowIndex])));
    });

    svg.appendChild(svgEl("line", { x1: pad.left, y1: height - pad.bottom, x2: width - pad.right, y2: height - pad.bottom, class: "chart-axis" }));
    svg.appendChild(svgEl("text", { x: (pad.left + width - pad.right) / 2, y: height - 12, class: "chart-axis-title", "text-anchor": "middle" }, axisTitle));
    target.innerHTML = "";
    target.appendChild(svg);
  }

  function renderTokenChart() {
    renderStackedBarChart(
      "#token-chart",
      [
        { field: "chunk_index_effective_tokens", label: "Indexación", color: "#173f68" },
        { field: "semantic_decision_effective_tokens", label: "Decisión semántica", color: "#98a8b6" },
      ],
      "Tokens efectivos procesados",
      (value, axis = false) => axis ? `${Math.round(value / 1000)}k` : integer(value),
      integer,
    );
  }

  function renderTimeChart() {
    renderStackedBarChart(
      "#time-chart",
      [
        { field: "chunking_seconds", label: "Segmentación", color: "#c2ccd5" },
        { field: "indexing_seconds", label: "Indexación", color: "#173f68" },
      ],
      "Tiempo de preprocesamiento (segundos)",
      (value, axis = false) => axis ? `${Math.round(value)} s` : seconds(value),
      (value) => `${seconds(value)} · ${fmt(value / 60, 1)} min`,
    );
  }

  function renderTradeoff() {
    const target = $("#tradeoff-chart");
    const points = strategyRows().map((row) => ({
      name: row.strategy,
      x: state.cost === "tokens" ? Number(row.total_embedding_effective_tokens) : Number(row.total_preprocess_seconds),
      y: metricValue(row.strategy, state.tradeoffK, "f1"),
    })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!points.length) return;

    const width = 760, height = 360;
    const pad = { left: 70, right: 52, top: 30, bottom: 66 };
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const xSpread = Math.max(maxX - minX, maxX * .08, 1);
    const ySpread = Math.max(maxY - minY, .015);
    const x0 = Math.max(0, minX - xSpread * .18);
    const x1 = maxX + xSpread * .18;
    const y0 = Math.max(0, minY - ySpread * .45);
    const y1 = Math.min(1, maxY + ySpread * .45);
    const x = (value) => pad.left + (value - x0) / (x1 - x0) * (width - pad.left - pad.right);
    const y = (value) => height - pad.bottom - (value - y0) / (y1 - y0) * (height - pad.top - pad.bottom);
    const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `F1@${state.tradeoffK} frente a costo` });

    for (let i = 0; i <= 4; i += 1) {
      const xxValue = x0 + (x1 - x0) * i / 4;
      const xx = x(xxValue);
      svg.appendChild(svgEl("line", { x1: xx, y1: pad.top, x2: xx, y2: height - pad.bottom, class: "chart-gridline" }));
      svg.appendChild(svgEl("text", { x: xx, y: height - pad.bottom + 20, class: "chart-label", "text-anchor": "middle" }, state.cost === "tokens" ? `${Math.round(xxValue / 1000)}k` : `${Math.round(xxValue)} s`));
      const yyValue = y0 + (y1 - y0) * i / 4;
      const yy = y(yyValue);
      svg.appendChild(svgEl("line", { x1: pad.left, y1: yy, x2: width - pad.right, y2: yy, class: "chart-gridline" }));
      svg.appendChild(svgEl("text", { x: pad.left - 10, y: yy + 4, class: "chart-label", "text-anchor": "end" }, yyValue.toFixed(3)));
    }

    svg.appendChild(svgEl("line", { x1: pad.left, y1: height - pad.bottom, x2: width - pad.right, y2: height - pad.bottom, class: "chart-axis" }));
    svg.appendChild(svgEl("line", { x1: pad.left, y1: pad.top, x2: pad.left, y2: height - pad.bottom, class: "chart-axis" }));

    points.forEach((point, index) => {
      const isProposed = point.name === "Structure-aware";
      if (isProposed) {
        svg.appendChild(svgEl("circle", { cx: x(point.x), cy: y(point.y), r: 16, fill: "none", stroke: meta(point.name).color, "stroke-width": 2, opacity: .28 }));
      }
      const circle = svgEl("circle", { cx: x(point.x), cy: y(point.y), r: isProposed ? 11 : 8, fill: meta(point.name).color, opacity: isProposed ? 1 : .72, class: "chart-dot", tabindex: "0", style: `animation-delay:${index * 120}ms` });
      bindTooltip(circle, meta(point.name).label, [`F1@${state.tradeoffK}: ${fmt(point.y, 4)}`, state.cost === "tokens" ? `Tokens: ${integer(point.x)}` : `Tiempo: ${seconds(point.x)}`]);
      svg.appendChild(circle);
      const labelX = point.name === "Semantic breakpoint" ? x(point.x) - 12 : x(point.x) + 12;
      const anchor = point.name === "Semantic breakpoint" ? "end" : "start";
      svg.appendChild(svgEl("text", { x: labelX, y: y(point.y) - 12, class: "chart-point-label", "text-anchor": anchor }, meta(point.name).label));
    });

    svg.appendChild(svgEl("text", { x: (pad.left + width - pad.right) / 2, y: height - 12, class: "chart-axis-title", "text-anchor": "middle" }, state.cost === "tokens" ? "Tokens efectivos procesados" : "Tiempo de preprocesamiento (s)"));
    svg.appendChild(svgEl("text", { x: 14, y: (pad.top + height - pad.bottom) / 2, class: "chart-axis-title", transform: `rotate(-90 14 ${(pad.top + height - pad.bottom) / 2})`, "text-anchor": "middle" }, `F1@${state.tradeoffK}`));
    target.innerHTML = "";
    target.appendChild(svg);
  }

  function renderSemanticCost() {
    $("#semantic-cost-grid").innerHTML = Object.keys(strategyMeta).map((name) => {
      const row = strategyRow(name);
      const value = Number(row?.semantic_decision_effective_tokens || 0);
      return `
        <div class="semantic-cost-card ${meta(name).key}">
          <span>${escapeHtml(meta(name).label)}</span>
          <strong>${integer(value)}</strong>
          <span>tokens para decidir cortes</span>
        </div>`;
    }).join("");
  }

  function renderResultsTable() {
    const names = Object.keys(strategyMeta);
    const rows = [
      ["F1@5", (name) => fmt(metricValue(name, 5, "f1"), 4)],
      ["F1@10", (name) => fmt(metricValue(name, 10, "f1"), 4)],
      ["Precisión@5", (name) => fmt(metricValue(name, 5, "precision"), 4)],
      ["Recall@5", (name) => fmt(metricValue(name, 5, "recall"), 4)],
      ["Tokens efectivos", (name) => integer(strategyRow(name)?.total_embedding_effective_tokens)],
      ["Tiempo total", (name) => seconds(strategyRow(name)?.total_preprocess_seconds)],
      ["Chunks", (name) => integer(strategyRow(name)?.n_chunks)],
      ["Tokens / chunk", (name) => fmt(strategyRow(name)?.avg_raw_tokens_per_chunk, 1)],
      ["P95 tokens / chunk", (name) => fmt(strategyRow(name)?.p95_raw_tokens_per_chunk, 1)],
      ["Chunks truncados", (name) => integer(strategyRow(name)?.truncated_chunks)],
      ["Contexto top-5", (name) => `${fmt(strategyRow(name)?.avg_retrieved_context_tokens_at_5, 1)} tok.`],
    ];
    $("#results-table").innerHTML = `
      <thead><tr><th>Métrica</th>${names.map((name) => `<th class="${name === "Structure-aware" ? "structure-col" : ""}">${escapeHtml(meta(name).label)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(([label, getter]) => `<tr><td>${escapeHtml(label)}</td>${names.map((name) => `<td class="${name === "Structure-aware" ? "structure-col" : ""}">${escapeHtml(getter(name))}</td>`).join("")}</tr>`).join("")}</tbody>`;
  }

  function renderSegmentation() {
    const example = data.example || {};
    $("#example-document-title").textContent = example.title || "Documento de ejemplo";
    const board = $("#segmentation-board");
    const all = example.strategies || {};
    board.innerHTML = Object.keys(strategyMeta).map((name, rowIndex) => {
      const chunks = Array.isArray(all[name]) ? all[name] : [];
      const total = chunks.reduce((sum, chunk) => sum + Number(chunk.sentence_count || 0), 0) || 1;
      return `
        <div class="segment-row" data-row="${rowIndex}" data-strategy="${escapeHtml(name)}">
          <div class="segment-row-head"><strong>${escapeHtml(meta(name).label)}</strong><span>${escapeHtml(name)}</span></div>
          <div class="segment-track">
            ${chunks.map((chunk, index) => `
              <button type="button" class="segment-block" data-strategy="${escapeHtml(name)}" data-index="${index}" style="--segment-color:${meta(name).color};--segment-width:${Math.max(8, Number(chunk.sentence_count || 1) / total * 100)}%;animation-delay:${index * 70}ms">
                <strong>C${escapeHtml(chunk.chunk ?? index + 1)}</strong><span>${escapeHtml(chunk.sentence_count ?? "—")} or.</span>
              </button>`).join("")}
          </div>
        </div>`;
    }).join("");

    $$(".segment-block", board).forEach((button) => {
      const activate = () => {
        $$(".segment-block", board).forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        const name = button.dataset.strategy;
        const chunk = all[name]?.[Number(button.dataset.index)];
        $("#segment-preview").innerHTML = `<strong>${escapeHtml(meta(name).label)} · Chunk ${escapeHtml(chunk?.chunk ?? Number(button.dataset.index) + 1)} · ${escapeHtml(chunk?.sentence_count ?? "—")} oraciones</strong><p>${escapeHtml(chunk?.text || "")}</p>`;
      };
      button.addEventListener("pointerenter", activate);
      button.addEventListener("focus", activate);
      button.addEventListener("click", activate);
    });

    const firstStructure = $(".segment-block[data-strategy='Structure-aware']", board) || $(".segment-block", board);
    firstStructure?.click();
  }

  function renderConclusion() {
    const structure = strategyRow("Structure-aware");
    const fixed = strategyRow("Fixed-size");
    const semantic = strategyRow("Semantic breakpoint");
    if (!structure || !fixed || !semantic) return;
    const f5DeltaAbs = metricValue("Structure-aware", 5) - metricValue("Fixed-size", 5);
    const f10 = metricValue("Structure-aware", 10);
    const tokenVsFixed = deltaPercent(structure.total_embedding_effective_tokens, fixed.total_embedding_effective_tokens);
    const timeVsFixed = deltaPercent(structure.total_preprocess_seconds, fixed.total_preprocess_seconds);
    const tokenVsSemantic = deltaPercent(structure.total_embedding_effective_tokens, semantic.total_embedding_effective_tokens);
    const timeVsSemantic = deltaPercent(structure.total_preprocess_seconds, semantic.total_preprocess_seconds);
    $("#conclusion-title").textContent = `Structure-aware conserva un F1@5 muy cercano a Fixed-size, reduce el costo y alcanza el mayor F1@10.`;
    $("#conclusion-stats").innerHTML = `
      <div class="conclusion-stat"><span>F1@10</span><strong>${fmt(f10, 4)}</strong></div>
      <div class="conclusion-stat"><span>Tokens vs. Fixed-size</span><strong>${signedPct(tokenVsFixed)}</strong></div>
      <div class="conclusion-stat"><span>Tiempo vs. Fixed-size</span><strong>${signedPct(timeVsFixed)}</strong></div>
      <div class="conclusion-stat"><span>Tokens vs. Breakpoint</span><strong>${signedPct(tokenVsSemantic)}</strong></div>
      <div class="conclusion-stat"><span>Tiempo vs. Breakpoint</span><strong>${signedPct(timeVsSemantic)}</strong></div>
      <div class="conclusion-stat"><span>Chunks truncados</span><strong>${integer(structure.truncated_chunks)}</strong></div>`;
  }

  function renderTechnical() {
    const run = data.run || {};
    const model = String(run.embedding_model || "").replace("sentence-transformers/", "");
    const values = [
      ["Dataset", "QASPER"], ["Split", run.split || "—"], ["Documentos", run.n_docs ?? "—"], ["Preguntas", run.n_questions ?? "—"],
      ["Modelo", model || "—"], ["Semilla", run.seed ?? "—"], ["Top-k", (run.top_k_values || []).join(" · ") || "—"], ["Máx. tokens", run.max_sequence_length ?? "—"],
      ["Fixed-size", `${run.fixed_chunk_size ?? "—"} or. · overlap ${run.fixed_overlap ?? "—"}`], ["Breakpoint", `${run.semantic_target_chunks ?? "—"} chunks objetivo`], ["Structure-aware", `máx. ${run.structure_max_sentences ?? "—"} or. · overlap ${run.structure_overlap ?? "—"}`], ["Métrica principal", "F1@5"],
    ];
    $("#technical-content").innerHTML = values.map(([label, value]) => `<div class="tech-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  }

  function renderCharts() {
    renderQualityChart();
    renderTokenChart();
    renderTimeChart();
    renderTradeoff();
  }

  function initInteractions() {
    $$(".method-tab").forEach((button) => button.addEventListener("click", () => renderMethod(button.dataset.method, true)));
    $("#quality-metric").addEventListener("change", (event) => { state.metric = event.target.value; renderQualityChart(); });
    $$('[data-cost]').forEach((button) => button.addEventListener("click", () => {
      state.cost = button.dataset.cost;
      $$('[data-cost]').forEach((item) => { const active = item.dataset.cost === state.cost; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); });
      renderTradeoff();
    }));
    $$('[data-tradeoff-k]').forEach((button) => button.addEventListener("click", () => {
      state.tradeoffK = Number(button.dataset.tradeoffK);
      $$('[data-tradeoff-k]').forEach((item) => { const active = Number(item.dataset.tradeoffK) === state.tradeoffK; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); });
      renderTradeoff();
    }));
  }

  function initReveal() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      $$(".reveal").forEach((element) => element.classList.add("visible"));
      $$(".segment-row").forEach((element) => element.classList.add("visible"));
      renderMethod("fixed", false);
      renderCharts();
      return;
    }

    let methodStarted = false;
    let chartsStarted = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        if (!methodStarted && entry.target.id === "method-flow") {
          methodStarted = true;
          renderMethod("fixed", true);
        }
        if (!chartsStarted && entry.target.id === "resultados") {
          chartsStarted = true;
          renderCharts();
        }
        observer.unobserve(entry.target);
      });
    }, { threshold: .12 });

    $$(".reveal").forEach((element) => observer.observe(element));
    observer.observe($("#resultados"));

    const segmentObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        $$(".segment-row").forEach((row, index) => setTimeout(() => row.classList.add("visible"), index * 150));
        segmentObserver.disconnect();
      });
    }, { threshold: .18 });
    segmentObserver.observe($("#segmentation-board"));
  }

  if (!hasRun) return;
  renderMethod("fixed", false);
  renderRunMeta();
  renderScoreStrip();
  renderHighlights();
  renderSemanticCost();
  renderResultsTable();
  renderSegmentation();
  renderConclusion();
  renderTechnical();
  initInteractions();
  initReveal();
})();
