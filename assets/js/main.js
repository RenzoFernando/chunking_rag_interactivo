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
      copy: "Corta por una cantidad fija de oraciones. Es simple y barato, pero el límite puede caer en medio de una idea.",
      cost: "Señal: posición",
      groups: [[0, 1, 2], [3, 4, 5], [6]],
    },
    breakpoint: {
      title: "Semantic breakpoint",
      copy: "Compara oraciones consecutivas y abre un nuevo chunk cuando detecta un cambio fuerte de significado.",
      cost: "Señal: embeddings",
      groups: [[0, 1], [2, 3], [4, 5, 6]],
      distances: [0.12, 0.73, 0.10, 0.68, 0.16, 0.11],
      threshold: 0.45,
    },
    structure: {
      title: "Structure-aware",
      copy: "Usa los párrafos como límites naturales y solo divide internamente cuando un bloque supera el tamaño máximo.",
      cost: "Señal: párrafos",
      groups: [[0, 1], [2, 3], [4, 5, 6]],
    },
  };

  const state = { method: "fixed", metric: "f1", cost: "tokens", exampleStrategy: "Fixed-size" };
  const hasRun = Array.isArray(data.metrics) && data.metrics.length > 0 && Array.isArray(data.strategies) && data.strategies.length > 0;

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
    return number.toLocaleString("es-CO", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  }

  function compactNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(number);
  }

  function pct(delta) {
    const number = Number(delta);
    if (!Number.isFinite(number)) return "—";
    return `${number >= 0 ? "+" : ""}${fmt(number, 0)}%`;
  }

  function meta(name) { return strategyMeta[name] || { key: "fixed", label: name, color: "#173f68" }; }
  function strategyRows() { return Object.keys(strategyMeta).map((name) => (data.strategies || []).find((row) => row.strategy === name)).filter(Boolean); }
  function metricRow(name, k = 5) { return (data.metrics || []).find((row) => row.strategy === name && Number(row.k) === Number(k)); }
  function f1At5(name) { const row = metricRow(name, 5); return row ? Number(row.f1) : NaN; }

  function renderSentences() {
    $("#demo-sentences").innerHTML = demoSentences.map((sentence, index) => `
      <div class="demo-sentence topic-${sentence.topic}" style="animation-delay:${index * 70}ms">
        <span class="snum">S${index + 1}</span>${escapeHtml(sentence.text)}
      </div>
    `).join("");
  }

  function renderDecision(method) {
    const config = methodConfig[method];
    const target = $("#demo-decision");
    if (method === "fixed") {
      target.innerHTML = `
        <div class="decision-title">Cuenta oraciones</div>
        <p class="decision-copy">El contenido no cambia la posición del corte.</p>
        <div class="fixed-rule"><span style="animation-delay:100ms">3</span><span style="animation-delay:200ms">3</span><span style="animation-delay:300ms">1</span></div>`;
      return;
    }
    if (method === "breakpoint") {
      target.innerHTML = `
        <div class="decision-title">Mide saltos de significado</div>
        <div class="distance-stack">
          ${config.distances.map((distance, index) => `
            <div class="distance-row ${distance >= config.threshold ? "is-break" : ""}">
              <span>S${index + 1}→S${index + 2}</span>
              <div class="distance-track"><i style="width:${Math.round(distance * 100)}%;animation-delay:${index * 85}ms"></i></div>
              <strong>${distance.toFixed(2)}</strong>
            </div>`).join("")}
        </div>
        <div class="threshold-rule"><i></i><span>umbral</span></div>`;
      return;
    }
    target.innerHTML = `
      <div class="decision-title">Lee la estructura</div>
      <p class="decision-copy">Los límites de párrafo ya están presentes en el documento.</p>
      <div class="paragraph-stage">
        ${[2, 2, 3].map((size, index) => `
          <div class="paragraph-block" style="animation-delay:${index * 130}ms">
            <div class="paragraph-label">Párrafo ${index + 1}</div>
            ${Array.from({ length: size }, (_, line) => `<span style="width:${line % 2 ? 72 : 94}%"></span>`).join("")}
          </div>`).join("")}
      </div>`;
  }

  function renderChunks(method) {
    const config = methodConfig[method];
    $("#demo-chunks").innerHTML = config.groups.map((indices, groupIndex) => {
      const excerpt = indices.map((index) => demoSentences[index].text).join(" ");
      return `
        <div class="demo-chunk ${method}" style="animation-delay:${330 + groupIndex * 140}ms">
          <strong><span>Chunk ${groupIndex + 1}</span><span>${indices.length} or.</span></strong>
          <div class="demo-chip-row">${indices.map((index) => `<span class="demo-chip">S${index + 1}</span>`).join("")}</div>
          <small>${escapeHtml(excerpt.length > 118 ? `${excerpt.slice(0, 118)}…` : excerpt)}</small>
        </div>`;
    }).join("");
  }

  function renderMethod(method) {
    state.method = method;
    $$(".method-tab").forEach((button) => {
      const active = button.dataset.method === method;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderSentences();
    renderDecision(method);
    renderChunks(method);
    const config = methodConfig[method];
    $("#method-caption").innerHTML = `<div><strong>${escapeHtml(config.title)}</strong><p>${escapeHtml(config.copy)}</p></div><span class="cost-tag">${escapeHtml(config.cost)}</span>`;
  }

  function svgEl(tag, attrs = {}, text = "") {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (text !== "") el.textContent = text;
    return el;
  }

  function renderScoreStrip() {
    const names = Object.keys(strategyMeta);
    const values = names.map(f1At5).filter(Number.isFinite);
    const max = Math.max(...values, .001);
    $("#score-strip").innerHTML = names.map((name) => {
      const value = f1At5(name);
      const width = Number.isFinite(value) ? Math.max(3, value / max * 100) : 0;
      return `
        <article class="score-card ${meta(name).key}">
          <span class="score-name">${escapeHtml(meta(name).label)}</span>
          <strong>${Number.isFinite(value) ? fmt(value, 3) : "—"}</strong>
          <small>F1@5 · recuperación de evidencia</small>
          <div class="score-meter"><i style="width:${width}%"></i></div>
        </article>`;
    }).join("");
  }

  function renderStory() {
    if (!hasRun) return;
    const rows = strategyRows();
    const ranked = rows.map((row) => ({ ...row, f1: f1At5(row.strategy) })).filter((row) => Number.isFinite(row.f1)).sort((a, b) => b.f1 - a.f1);
    if (!ranked.length) return;
    const best = ranked[0];
    const fixed = rows.find((row) => row.strategy === "Fixed-size");
    const semantic = rows.find((row) => row.strategy === "Semantic breakpoint");
    const structure = rows.find((row) => row.strategy === "Structure-aware");
    $("#story-title").textContent = `${meta(best.strategy).label} obtuvo el F1@5 más alto en esta ejecución.`;

    if (structure && fixed && semantic) {
      const sf = f1At5("Structure-aware");
      const ff = f1At5("Fixed-size");
      const semf = f1At5("Semantic breakpoint");
      const vsFixedF1 = (sf / ff - 1) * 100;
      const vsSemanticF1 = (sf / semf - 1) * 100;
      const vsFixedTokens = (Number(structure.total_embedding_effective_tokens) / Number(fixed.total_embedding_effective_tokens) - 1) * 100;
      const vsSemanticTokens = (Number(structure.total_embedding_effective_tokens) / Number(semantic.total_embedding_effective_tokens) - 1) * 100;
      $("#story-copy").textContent = `Structure-aware alcanzó ${fmt(sf, 3)} de F1@5. En la misma corrida procesó ${compactNumber(structure.total_embedding_effective_tokens)} tokens de embeddings, frente a ${compactNumber(fixed.total_embedding_effective_tokens)} de Fixed-size y ${compactNumber(semantic.total_embedding_effective_tokens)} de Semantic breakpoint.`;
      $("#story-deltas").innerHTML = `
        <div class="delta-card"><span class="delta-value">${pct(vsFixedF1)}</span><span>F1@5 frente a Fixed-size</span></div>
        <div class="delta-card"><span class="delta-value">${pct(vsSemanticF1)}</span><span>F1@5 frente a Semantic breakpoint</span></div>
        <div class="delta-card"><span class="delta-value">${pct(vsFixedTokens)}</span><span>tokens frente a Fixed-size</span></div>
        <div class="delta-card"><span class="delta-value">${pct(vsSemanticTokens)}</span><span>tokens frente a Semantic breakpoint</span></div>`;
    }
  }

  function renderQualityChart() {
    const target = $("#quality-chart");
    const rows = data.metrics || [];
    const ks = [...new Set(rows.map((row) => Number(row.k)))].filter(Number.isFinite).sort((a, b) => a - b);
    const names = Object.keys(strategyMeta).filter((name) => rows.some((row) => row.strategy === name));
    const values = rows.map((row) => Number(row[state.metric])).filter(Number.isFinite);
    if (!ks.length || !values.length) { target.innerHTML = ""; return; }

    const width = 720, height = 330;
    const pad = { left: 50, right: 22, top: 24, bottom: 48 };
    const maxData = Math.max(...values, .05);
    const maxY = Math.min(1, Math.max(.1, Math.ceil(maxData * 10 + .7) / 10));
    const x = (k) => pad.left + (ks.indexOf(k) / Math.max(ks.length - 1, 1)) * (width - pad.left - pad.right);
    const y = (value) => height - pad.bottom - value / maxY * (height - pad.top - pad.bottom);
    const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${state.metric} por k` });

    for (let i = 0; i <= 4; i += 1) {
      const value = maxY * i / 4, yy = y(value);
      svg.appendChild(svgEl("line", { x1: pad.left, y1: yy, x2: width - pad.right, y2: yy, class: "chart-gridline" }));
      svg.appendChild(svgEl("text", { x: pad.left - 9, y: yy + 4, class: "chart-label", "text-anchor": "end" }, value.toFixed(2)));
    }
    ks.forEach((k) => svg.appendChild(svgEl("text", { x: x(k), y: height - 14, class: "chart-label", "text-anchor": "middle" }, `k=${k}`)));

    names.forEach((name, nameIndex) => {
      const series = ks.map((k) => rows.find((row) => row.strategy === name && Number(row.k) === k));
      const path = series.map((row, index) => row ? `${index === 0 ? "M" : "L"} ${x(ks[index])} ${y(Number(row[state.metric]))}` : "").filter(Boolean).join(" ");
      svg.appendChild(svgEl("path", { d: path, fill: "none", stroke: meta(name).color, "stroke-width": 3, class: "chart-series", style: `animation-delay:${nameIndex * 120}ms` }));
      series.forEach((row, index) => {
        if (!row) return;
        const circle = svgEl("circle", { cx: x(ks[index]), cy: y(Number(row[state.metric])), r: 5, fill: "#fff", stroke: meta(name).color, "stroke-width": 2.5, class: "chart-dot", style: `animation-delay:${240 + index * 90}ms` });
        circle.appendChild(svgEl("title", {}, `${meta(name).label}: ${fmt(row[state.metric], 3)}`));
        svg.appendChild(circle);
      });
    });
    svg.appendChild(svgEl("line", { x1: pad.left, y1: height - pad.bottom, x2: width - pad.right, y2: height - pad.bottom, class: "chart-axis" }));
    target.innerHTML = "";
    target.appendChild(svg);
  }

  function renderStackedBars(targetSelector, parts, formatter) {
    const target = $(targetSelector);
    const rows = strategyRows();
    const totals = rows.map((row) => parts.reduce((sum, part) => sum + Number(row[part.field] || 0), 0));
    const maxTotal = Math.max(...totals, 1);
    target.innerHTML = `<div class="bar-chart">${rows.map((row, index) => `
      <div class="bar-row">
        <div class="bar-label">${escapeHtml(meta(row.strategy).label)}</div>
        <div class="bar-track">${parts.map((part) => {
          const value = Number(row[part.field] || 0);
          return `<span class="${part.className}" style="width:${value / maxTotal * 100}%" title="${escapeHtml(part.label)}: ${escapeHtml(formatter(value))}"></span>`;
        }).join("")}</div>
        <div class="bar-value">${escapeHtml(formatter(totals[index]))}</div>
      </div>`).join("")}</div>`;
  }

  function renderTokenChart() {
    renderStackedBars("#token-chart", [
      { field: "chunk_index_effective_tokens", className: "bar-index", label: "Indexación" },
      { field: "semantic_decision_effective_tokens", className: "bar-decision", label: "Decisión semántica" },
    ], compactNumber);
  }

  function renderTimeChart() {
    renderStackedBars("#time-chart", [
      { field: "chunking_seconds", className: "bar-chunking", label: "Segmentación" },
      { field: "indexing_seconds", className: "bar-index", label: "Indexación" },
    ], (value) => `${fmt(value, 1)} s`);
  }

  function renderTradeoff() {
    const target = $("#tradeoff-chart");
    const points = strategyRows().map((row) => ({
      name: row.strategy,
      x: state.cost === "tokens" ? Number(row.total_embedding_effective_tokens) : Number(row.total_preprocess_seconds),
      y: f1At5(row.strategy),
    })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!points.length) { target.innerHTML = ""; return; }

    const width = 720, height = 340;
    const pad = { left: 64, right: 34, top: 28, bottom: 54 };
    const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y));
    const xSpread = Math.max(maxX - minX, maxX * .08, 1), ySpread = Math.max(maxY - minY, .02);
    const x0 = Math.max(0, minX - xSpread * .18), x1 = maxX + xSpread * .22;
    const y0 = Math.max(0, minY - ySpread * .6), y1 = Math.min(1, maxY + ySpread * .6);
    const x = (value) => pad.left + (value - x0) / Math.max(x1 - x0, 1e-9) * (width - pad.left - pad.right);
    const y = (value) => height - pad.bottom - (value - y0) / Math.max(y1 - y0, 1e-9) * (height - pad.top - pad.bottom);
    const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Calidad frente a costo" });

    for (let i = 0; i <= 4; i += 1) {
      const yy = pad.top + i / 4 * (height - pad.top - pad.bottom);
      svg.appendChild(svgEl("line", { x1: pad.left, y1: yy, x2: width - pad.right, y2: yy, class: "chart-gridline" }));
    }
    svg.appendChild(svgEl("line", { x1: pad.left, y1: height - pad.bottom, x2: width - pad.right, y2: height - pad.bottom, class: "chart-axis" }));
    svg.appendChild(svgEl("line", { x1: pad.left, y1: pad.top, x2: pad.left, y2: height - pad.bottom, class: "chart-axis" }));
    points.forEach((point, index) => {
      svg.appendChild(svgEl("circle", { cx: x(point.x), cy: y(point.y), r: 9, fill: meta(point.name).color, class: "chart-dot", style: `animation-delay:${index * 130}ms` }));
      svg.appendChild(svgEl("text", { x: x(point.x) + 13, y: y(point.y) + 4, class: "chart-point-label" }, meta(point.name).label));
    });
    svg.appendChild(svgEl("text", { x: (pad.left + width - pad.right) / 2, y: height - 12, class: "chart-label", "text-anchor": "middle" }, state.cost === "tokens" ? "Tokens procesados" : "Tiempo total (s)"));
    svg.appendChild(svgEl("text", { x: 14, y: (pad.top + height - pad.bottom) / 2, class: "chart-label", transform: `rotate(-90 14 ${(pad.top + height - pad.bottom) / 2})`, "text-anchor": "middle" }, "F1@5"));
    target.innerHTML = "";
    target.appendChild(svg);
  }

  function renderFacts() {
    $("#strategy-facts").innerHTML = Object.keys(strategyMeta).map((name) => {
      const row = (data.strategies || []).find((item) => item.strategy === name);
      if (!row) return "";
      const context = Number(row.avg_retrieved_context_tokens_at_5);
      return `
        <article class="fact-card">
          <h4>${escapeHtml(meta(name).label)}</h4>
          <div class="fact-row"><span>Chunks</span><strong>${Number(row.n_chunks).toLocaleString("es-CO")}</strong></div>
          <div class="fact-row"><span>Oraciones / chunk</span><strong>${fmt(row.avg_sentences_per_chunk, 1)}</strong></div>
          <div class="fact-row"><span>Tokens / chunk</span><strong>${fmt(row.avg_raw_tokens_per_chunk, 0)}</strong></div>
          <div class="fact-row"><span>P95 tokens</span><strong>${fmt(row.p95_raw_tokens_per_chunk, 0)}</strong></div>
          <div class="fact-row"><span>Chunks truncados</span><strong>${Number(row.truncated_chunks).toLocaleString("es-CO")}</strong></div>
          ${Number.isFinite(context) ? `<div class="fact-row"><span>Contexto top-5</span><strong>${fmt(context, 0)} tok.</strong></div>` : ""}
        </article>`;
    }).join("");
  }

  const fallbackExample = {
    "Fixed-size": [{ chunk: 1, sentence_count: 3, text: "El corte avanza por longitud y puede atravesar un cambio de idea." }],
    "Semantic breakpoint": [{ chunk: 1, sentence_count: 3, text: "El corte aparece cuando aumenta la distancia semántica entre oraciones vecinas." }],
    "Structure-aware": [{ chunk: 1, sentence_count: 3, text: "El párrafo funciona como límite natural del fragmento." }],
  };

  function exampleChunks(name) {
    const real = data?.example?.strategies?.[name];
    return Array.isArray(real) && real.length ? real : fallbackExample[name];
  }

  function renderExample() {
    const names = Object.keys(strategyMeta);
    const tabs = $("#strategy-tabs");
    tabs.innerHTML = names.map((name) => `<button type="button" data-strategy="${escapeHtml(name)}" class="${state.exampleStrategy === name ? "active" : ""}" aria-pressed="${state.exampleStrategy === name}">${escapeHtml(meta(name).label)}</button>`).join("");
    $$("button", tabs).forEach((button) => button.addEventListener("click", () => { state.exampleStrategy = button.dataset.strategy; renderExample(); }));
    $("#example-document-title").textContent = data?.example?.title || "Artículo científico";
    const chunks = exampleChunks(state.exampleStrategy).slice(0, 6);
    $("#chunk-preview-grid").innerHTML = chunks.map((chunk, index) => `
      <article class="chunk-preview-card" style="--strategy-color:${meta(state.exampleStrategy).color};animation-delay:${index * 80}ms">
        <strong><span>Chunk ${escapeHtml(chunk.chunk ?? index + 1)}</span><span>${escapeHtml(chunk.sentence_count ?? "—")} or.</span></strong>
        <p>${escapeHtml(chunk.text || "")}</p>
      </article>`).join("");
  }

  function renderRunMeta() {
    const run = data.run || {};
    const mode = run.demo_mode ? "muestra" : "ejecución completa";
    $("#run-meta").innerHTML = hasRun ? `<strong>${Number(run.n_docs || 0).toLocaleString("es-CO")} documentos · ${Number(run.n_questions || 0).toLocaleString("es-CO")} preguntas</strong>${escapeHtml(mode)} · ${escapeHtml(run.embedding_model || "")}` : "";
  }

  function renderClosing() {
    const structure = (data.strategies || []).find((row) => row.strategy === "Structure-aware");
    const fixed = (data.strategies || []).find((row) => row.strategy === "Fixed-size");
    const semantic = (data.strategies || []).find((row) => row.strategy === "Semantic breakpoint");
    if (!structure || !fixed || !semantic) return;
    const sf = f1At5("Structure-aware"), ff = f1At5("Fixed-size"), semf = f1At5("Semantic breakpoint");
    const tokensVsSemantic = (Number(structure.total_embedding_effective_tokens) / Number(semantic.total_embedding_effective_tokens) - 1) * 100;
    $("#closing-copy").innerHTML = `
      <p>En la ejecución guardada, <strong>Structure-aware obtuvo F1@5 = ${fmt(sf, 3)}</strong>, frente a ${fmt(ff, 3)} de Fixed-size y ${fmt(semf, 3)} de Semantic breakpoint.</p>
      <p>Además, procesó <strong>${compactNumber(structure.total_embedding_effective_tokens)} tokens</strong>, ${Math.abs(tokensVsSemantic).toFixed(0)}% menos que Semantic breakpoint. El resultado es coherente con la hipótesis del proyecto: aprovechar estructura documental puede conservar calidad sin introducir el mismo costo semántico.</p>`;
  }

  function renderTechnical() {
    const run = data.run || {};
    const ks = [...new Set((data.metrics || []).map((row) => Number(row.k)))].filter(Number.isFinite).sort((a, b) => a - b);
    const values = [
      ["Dataset", run.dataset || "QASPER"], ["Split", run.split || "—"], ["Modelo", run.embedding_model || "—"], ["Semilla", run.seed ?? "—"],
      ["Documentos", run.n_docs ?? "—"], ["Preguntas", run.n_questions ?? "—"], ["Top-k", ks.length ? ks.join(" · ") : "—"], ["Máx. tokens", run.max_sequence_length ?? "—"],
      ["Fixed-size", `${run.fixed_chunk_size ?? "—"} or. · overlap ${run.fixed_overlap ?? "—"}`], ["Breakpoint", `${run.semantic_target_chunks ?? "—"} chunks objetivo`], ["Structure-aware", `máx. ${run.structure_max_sentences ?? "—"} or. · overlap ${run.structure_overlap ?? "—"}`], ["Métrica central", "F1@5"],
    ];
    $("#technical-content").innerHTML = values.map(([label, value]) => `<div class="tech-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  }

  function initInteractions() {
    $$(".method-tab").forEach((button) => button.addEventListener("click", () => renderMethod(button.dataset.method)));
    $("#quality-metric").addEventListener("change", (event) => { state.metric = event.target.value; renderQualityChart(); });
    $$('[data-cost]').forEach((button) => button.addEventListener("click", () => {
      state.cost = button.dataset.cost;
      $$('[data-cost]').forEach((item) => { const active = item.dataset.cost === state.cost; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); });
      renderTradeoff();
    }));
  }

  function initReveal() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      $$(".reveal").forEach((element) => element.classList.add("visible"));
      renderMethod("fixed");
      return;
    }
    let methodStarted = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        if (!methodStarted && entry.target.id === "method-demo") {
          methodStarted = true;
          renderMethod("fixed");
        }
        observer.unobserve(entry.target);
      });
    }, { threshold: .12 });
    $$(".reveal").forEach((element) => observer.observe(element));
  }

  function renderResultsSection() {
    renderScoreStrip();
    renderStory();
    renderQualityChart();
    renderTokenChart();
    renderTimeChart();
    renderTradeoff();
    renderFacts();
  }

  function initSectionAnimations() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      renderResultsSection();
      renderExample();
      return;
    }

    const sections = [
      [$("#resultados"), renderResultsSection],
      [$("#ejemplo"), renderExample],
    ];

    sections.forEach(([section, renderer]) => {
      if (!section) return;
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          renderer();
          observer.disconnect();
        }
      }, { threshold: .08, rootMargin: "0px 0px -8% 0px" });
      observer.observe(section);
    });
  }

  renderRunMeta();
  renderClosing();
  renderTechnical();
  initInteractions();
  initReveal();
  initSectionAnimations();
})();
