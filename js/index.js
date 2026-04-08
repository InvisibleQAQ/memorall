document.documentElement.classList.add("js");

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (start, end, t) => start + (end - start) * t;
const mixPoint = (from, to, t) => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
});
const smoothStep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const initWorkflowStory = ({ reduceMotion }) => {
  const shell = document.querySelector("[data-workflow-story]");
  const stage = shell?.querySelector(".workflow-story-stage");
  const resourceLayerNode = shell?.querySelector(".workflow-story-resource-layer");
  const svgNode = shell?.querySelector(".workflow-story-svg");
  const stepNodes = shell ? Array.from(shell.querySelectorAll("[data-story-step]")) : [];
  const progressLabel = shell?.querySelector(".workflow-story-progress-label");
  const statsLabel = shell?.querySelector(".workflow-story-stats");

  if (!shell || !stage || !resourceLayerNode || !svgNode || !window.d3) {
    return;
  }

  const d3 = window.d3;
  const width = 820;
  const height = 520;
  const stageLabels = [
    "raw sources",
    "resource nodes",
    "relationships forming",
    "knowledge graph",
  ];

  const items = [
    {
      id: "browser",
      title: "Live Page",
      meta: "webpage",
      color: "#72e8f4",
      accent: "#24c7ef",
      layer: 1,
      resource: { x: 156, y: 140, w: 224, h: 126, r: 16 },
      graph: { x: 208, y: 138, w: 32, h: 32, r: 16 },
    },
    {
      id: "pdf",
      title: "Runner Spec",
      meta: "pdf",
      color: "#f7b15d",
      accent: "#ffd699",
      layer: 2,
      resource: { x: 556, y: 126, w: 192, h: 120, r: 16 },
      graph: { x: 520, y: 108, w: 28, h: 28, r: 14 },
    },
    {
      id: "notes",
      title: "Field Notes",
      meta: "markdown",
      color: "#7cb7ff",
      accent: "#d9ebff",
      layer: 1,
      resource: { x: 206, y: 314, w: 174, h: 108, r: 16 },
      graph: { x: 168, y: 298, w: 26, h: 26, r: 13 },
    },
    {
      id: "sheet",
      title: "Benchmarks",
      meta: "spreadsheet",
      color: "#8fe7c1",
      accent: "#dff9ed",
      layer: 1,
      resource: { x: 566, y: 308, w: 202, h: 112, r: 16 },
      graph: { x: 594, y: 302, w: 28, h: 28, r: 14 },
    },
    {
      id: "agent",
      title: "Agent Researcher",
      meta: "topic",
      color: "#f7b15d",
      accent: "#ffe0a6",
      layer: 4,
      resource: { x: 382, y: 244, w: 198, h: 116, r: 18 },
      graph: { x: 378, y: 222, w: 40, h: 40, r: 20 },
    },
    {
      id: "codegen",
      title: "Code Generation",
      meta: "concept",
      color: "#ef9d4e",
      accent: "#ffd4a2",
      layer: 3,
      resource: { x: 344, y: 92, w: 168, h: 96, r: 16 },
      graph: { x: 352, y: 96, w: 24, h: 24, r: 12 },
    },
    {
      id: "planning",
      title: "Planning",
      meta: "operation",
      color: "#ffe09a",
      accent: "#fff0c6",
      layer: 3,
      resource: { x: 458, y: 382, w: 150, h: 92, r: 16 },
      graph: { x: 454, y: 342, w: 24, h: 24, r: 12 },
    },
    {
      id: "authors",
      title: "Authors",
      meta: "people",
      color: "#5faeff",
      accent: "#d8e8ff",
      layer: 5,
      resource: { x: 652, y: 214, w: 146, h: 88, r: 16 },
      graph: { x: 608, y: 202, w: 22, h: 22, r: 11 },
    },
  ];

  const links = [
    { source: "agent", target: "browser", secondary: false },
    { source: "agent", target: "pdf", secondary: false },
    { source: "agent", target: "notes", secondary: false },
    { source: "agent", target: "sheet", secondary: false },
    { source: "agent", target: "codegen", secondary: false },
    { source: "agent", target: "planning", secondary: false },
    { source: "agent", target: "authors", secondary: false },
    { source: "browser", target: "notes", secondary: true },
    { source: "pdf", target: "sheet", secondary: true },
    { source: "codegen", target: "planning", secondary: true },
    { source: "authors", target: "pdf", secondary: true },
  ];

  const svg = d3.select(svgNode)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");
  const resourceLayer = d3.select(resourceLayerNode);
  const defs = svg.append("defs");
  const shadow = defs
    .append("filter")
    .attr("id", "workflow-story-shadow")
    .attr("x", "-40%")
    .attr("y", "-40%")
    .attr("width", "180%")
    .attr("height", "180%");

  shadow.append("feDropShadow")
    .attr("dx", 0)
    .attr("dy", 18)
    .attr("stdDeviation", 16)
    .attr("flood-color", "rgba(0,0,0,0.26)");

  const linkLayer = svg.append("g");
  const nodeLayer = svg.append("g");

  const linkSelection = linkLayer
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("class", (d) => `workflow-story-link${d.secondary ? " is-secondary" : ""}`);

  const nodeSelection = nodeLayer
    .selectAll("g")
    .data(items)
    .join("g")
    .attr("filter", "url(#workflow-story-shadow)");

  const resourceCardSelection = resourceLayer
    .selectAll(".workflow-story-resource-card")
    .data(items)
    .join((enter) => {
      const card = enter.append("article").attr("class", "workflow-story-resource-card");
      card.append("span").attr("class", "workflow-story-resource-card-icon");
      const content = card.append("div").attr("class", "workflow-story-resource-card-content");
      content.append("strong").attr("class", "workflow-story-resource-card-title");
      content.append("span").attr("class", "workflow-story-resource-card-meta");
      const lineGroup = content.append("div").attr("class", "workflow-story-resource-card-lines");
      [0, 1].forEach(() => {
        lineGroup.append("span").attr("class", "workflow-story-resource-card-line");
      });
      return card;
    })
    .style("z-index", (item) => String(item.layer))
    .style("--workflow-card-accent", (item) => item.accent);

  nodeSelection.append("circle").attr("class", "workflow-story-halo");
  nodeSelection.append("rect").attr("class", "workflow-story-card");
  nodeSelection.append("text").attr("class", "workflow-story-node-label");
  nodeSelection.append("text").attr("class", "workflow-story-node-meta");

  const getStageIndex = (progress) => {
    if (progress < 0.28) {
      return 0;
    }
    if (progress < 0.58) {
      return 1;
    }
    if (progress < 0.84) {
      return 2;
    }
    return 3;
  };

  const updateStageScale = () => {
    const scale = stage.clientWidth / width;
    stage.style.setProperty("--workflow-story-scale", String(scale));
  };

  const getNodeState = (item, progress) => {
    const morph = smoothStep(0.18, 0.5, progress);
    const pos = mixPoint(item.resource, item.graph, morph);
    const sizeBoost = item.id === "agent" ? 1.3 : 1;
    const w = lerp(item.resource.w, item.graph.w * sizeBoost, morph);
    const h = lerp(item.resource.h, item.graph.h * sizeBoost, morph);
    const r = lerp(item.resource.r, item.graph.r * sizeBoost, morph);
    return { ...pos, w, h, r };
  };

  const buildLinkPath = (source, target) => {
    const dx = (target.x - source.x) * 0.38;
    return `M ${source.x} ${source.y} C ${source.x + dx} ${source.y}, ${target.x - dx} ${target.y}, ${target.x} ${target.y}`;
  };

  const render = (progress) => {
    const clamped = clamp(progress, 0, 1);
    const stageIndex = getStageIndex(clamped);
    const linkAlpha = smoothStep(0.52, 0.82, clamped);
    const finalAlpha = smoothStep(0.74, 0.98, clamped);
    const nodeCardAlpha = smoothStep(0.24, 0.58, clamped);
    const resourceCardAlpha = 1 - smoothStep(0.2, 0.48, clamped);
    const resourceExit = smoothStep(0.16, 0.44, clamped);
    const nodeLabelAlpha = smoothStep(0.3, 0.7, clamped);
    const expansionProgress = smoothStep(0.82, 0.98, clamped);

    const states = new Map(items.map((item) => [item.id, getNodeState(item, clamped)]));

    shell.style.setProperty("--workflow-story-expand", expansionProgress.toFixed(4));
    updateStageScale();
    stage.dataset.stage = String(stageIndex);
    if (progressLabel) {
      progressLabel.textContent = stageLabels[stageIndex];
    }
    if (statsLabel) {
      statsLabel.textContent = `stage ${stageIndex + 1} of 4`;
    }

    stepNodes.forEach((node, index) => {
      node.classList.toggle("is-active", index === stageIndex);
    });

    linkSelection
      .attr("d", (d) => buildLinkPath(states.get(d.source), states.get(d.target)))
      .attr("opacity", (d) => (d.secondary ? linkAlpha * 0.65 : linkAlpha));

    resourceCardSelection.each(function updateResourceCard(item) {
      const selection = d3.select(this);
      const widthValue = lerp(item.resource.w, item.resource.w * 0.9, resourceExit);
      const heightValue = lerp(item.resource.h, item.resource.h * 0.9, resourceExit);
      const xValue = lerp(item.resource.x, item.resource.x + (item.graph.x - item.resource.x) * 0.22, resourceExit);
      const yValue = lerp(item.resource.y, item.resource.y + (item.graph.y - item.resource.y) * 0.22, resourceExit);
      const radiusValue = lerp(item.resource.r, Math.min(item.resource.r, 12), resourceExit);

      selection
        .style("width", `${widthValue}px`)
        .style("height", `${heightValue}px`)
        .style("border-radius", `${radiusValue}px`)
        .style("opacity", String(resourceCardAlpha))
        .style("transform", `translate3d(${xValue - widthValue / 2}px, ${yValue - heightValue / 2}px, 0)`);

      selection.select(".workflow-story-resource-card-title").text(item.title);
      selection.select(".workflow-story-resource-card-meta").text(item.meta);
    });

    nodeSelection.each(function updateNode(item) {
      const current = states.get(item.id);
      const selection = d3.select(this);
      const isHub = item.id === "agent";
      const haloRadius = Math.max(current.w, current.h) * (0.34 + finalAlpha * 0.18);
      const nodeFill = d3.interpolateRgb("#fffaf3", item.color)(smoothStep(0.18, 0.58, clamped));
      const strokeFill = d3.interpolateRgb("rgba(31, 26, 42, 0.08)", item.accent)(smoothStep(0.2, 0.68, clamped));

      selection.attr("transform", `translate(${current.x}, ${current.y})`);

      selection.select(".workflow-story-halo")
        .attr("r", haloRadius)
        .attr("fill", item.color)
        .attr("opacity", isHub ? 0.12 + finalAlpha * 0.18 : finalAlpha * 0.12);

      selection.select(".workflow-story-card")
        .attr("x", -current.w / 2)
        .attr("y", -current.h / 2)
        .attr("width", current.w)
        .attr("height", current.h)
        .attr("rx", current.r)
        .attr("fill", nodeFill)
        .attr("stroke", strokeFill)
        .attr("stroke-width", 1.2 + finalAlpha * 0.8)
        .attr("opacity", nodeCardAlpha);

      selection.select(".workflow-story-node-label")
        .attr("x", 0)
        .attr("y", current.h / 2 + 22)
        .attr("opacity", nodeLabelAlpha)
        .style("font-size", isHub ? "14px" : "12px")
        .text(item.title);

      selection.select(".workflow-story-node-meta")
        .attr("x", 0)
        .attr("y", current.h / 2 + 37)
        .attr("opacity", finalAlpha)
        .text(item.meta);
    });
  };

  const updateProgress = () => {
    if (reduceMotion) {
      render(1);
      return;
    }

    const rect = shell.getBoundingClientRect();
    const viewport = window.innerHeight;
    const total = Math.max(rect.height - viewport * 0.72, 1);
    const raw = (viewport * 0.18 - rect.top) / total;
    render(clamp(raw, 0, 1));
  };

  updateStageScale();
  render(reduceMotion ? 1 : 0);
  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", () => {
    updateStageScale();
    updateProgress();
  });
};

const initLandingPage = () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const progressBar = document.querySelector(".scroll-progress");
  const hero = document.querySelector(".hero");
  const revealTargets = document.querySelectorAll(".reveal:not(.is-visible)");

  if (!reduceMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );

    revealTargets.forEach((element, index) => {
      element.style.setProperty("--reveal-delay", `${Math.min(index * 45, 220)}ms`);
      observer.observe(element);
    });
  } else {
    revealTargets.forEach((element) => element.classList.add("is-visible"));
  }

  const updateScrollProgress = () => {
    if (!progressBar) {
      return;
    }

    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
    progressBar.style.setProperty("--scroll-scale", ratio.toFixed(3));
  };

  updateScrollProgress();
  window.addEventListener("scroll", updateScrollProgress, { passive: true });
  window.addEventListener("resize", updateScrollProgress);

  if (!reduceMotion && hero) {
    const resetPointer = () => {
      document.documentElement.style.setProperty("--pointer-x", "0");
      document.documentElement.style.setProperty("--pointer-y", "0");
    };

    hero.addEventListener("pointermove", (event) => {
      const rect = hero.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

      document.documentElement.style.setProperty("--pointer-x", x.toFixed(3));
      document.documentElement.style.setProperty("--pointer-y", y.toFixed(3));
    });

    hero.addEventListener("pointerleave", resetPointer);
  }

  initWorkflowStory({ reduceMotion });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLandingPage, { once: true });
} else {
  initLandingPage();
}
