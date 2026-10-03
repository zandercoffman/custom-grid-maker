"use client";

import { useEffect, useRef, useState } from "react";

type GridType = "column" | "modular" | "baseline" | "radial" | "hierarchical" | "axial";
type PanelTab = "layers" | "artboard" | "export";
type ControlMode = "simple" | "advanced";

type ColumnConfig = { columns: number; gutter: number; marginLeft: number; marginRight: number; linkedMargins: boolean; filled: boolean; color: string; opacity: number; strokeWidth: number };
type ModularConfig = { columns: number; rows: number; colGutter: number; rowGutter: number; linkedGutters: boolean; marginTop: number; marginRight: number; marginBottom: number; marginLeft: number; linkedMargins: boolean; filled: boolean; color: string; opacity: number; strokeWidth: number };
type BaselineConfig = { spacing: number; topOffset: number; emphasisEvery: number; emphasisColor: string; emphasisStroke: number; startY: number; endY: number; color: string; opacity: number; strokeWidth: number };
type RadialConfig = { centerX: number; centerY: number; rays: number; lengthMode: "edge" | "fixed"; fixedLength: number; rings: number; ringSpacing: number; startAngle: number; arcSpan: number; rayColor: string; rayOpacity: number; rayStroke: number; useRingColor: boolean; ringColor: string };
type Zone = { id: string; x: number; y: number; w: number; h: number; unit: "px" | "%"; label: string; fill: string; opacity: number };
type HierarchicalConfig = { zones: Zone[]; showLabels: boolean };
type Axis = { id: string; angle: number; spacing: number; offset: number };
type AxialConfig = { axes: Axis[]; color: string; opacity: number; strokeWidth: number };

type GridConfigMap = { column: ColumnConfig; modular: ModularConfig; baseline: BaselineConfig; radial: RadialConfig; hierarchical: HierarchicalConfig; axial: AxialConfig };
type Layer<T extends GridType = GridType> = { id: string; type: T; name: string; visible: boolean; opacity: number; config: GridConfigMap[T] };

type Artboard = { name: string; width: number; height: number; backgroundColor: string; transparent: boolean; showRulers: boolean; snap8: boolean };
type StudioState = { artboard: Artboard; layers: Layer[]; selectedLayerId: string | null; controlMode: ControlMode; panelTab: PanelTab };
type SavedSetup = { id: string; name: string; state: StudioState };

type ArtboardPreset = { name: string; width: number; height: number };

const PRESETS: ArtboardPreset[] = [
  { name: "Instagram Post", width: 1080, height: 1350 },
  { name: "Instagram Square", width: 1080, height: 1080 },
  { name: "Instagram Story", width: 1080, height: 1920 },
  { name: "16:9", width: 1920, height: 1080 },
  { name: "4:5", width: 1080, height: 1350 },
  { name: "1:1", width: 1080, height: 1080 },
  { name: "A4 Print", width: 2480, height: 3508 },
  { name: "US Letter", width: 2550, height: 3300 },
  { name: "iPhone 393×852", width: 393, height: 852 },
];

const STORAGE_KEY = "layout-grid-studio-state-v1";
const SETUPS_KEY = "layout-grid-user-setups-v1";

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const snap = (n: number, on: boolean) => (on ? Math.round(n / 8) * 8 : n);

function base64urlEncode(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(value: string) {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function defaultArtboard(): Artboard {
  return { name: "Instagram Post", width: 1080, height: 1350, backgroundColor: "#1a1a1a", transparent: true, showRulers: true, snap8: false };
}

function defaultConfig(type: GridType, artboard: Artboard): GridConfigMap[GridType] {
  if (type === "column") return { columns: 12, gutter: 24, marginLeft: 48, marginRight: 48, linkedMargins: true, filled: true, color: "#ff5a5a", opacity: 35, strokeWidth: 1 };
  if (type === "modular") return { columns: 4, rows: 4, colGutter: 16, rowGutter: 16, linkedGutters: true, marginTop: 32, marginRight: 32, marginBottom: 32, marginLeft: 32, linkedMargins: true, filled: false, color: "#84cc16", opacity: 35, strokeWidth: 1 };
  if (type === "baseline") return { spacing: 8, topOffset: 0, emphasisEvery: 4, emphasisColor: "#ff5a5a", emphasisStroke: 2, startY: 0, endY: artboard.height, color: "#60a5fa", opacity: 35, strokeWidth: 1 };
  if (type === "radial") return { centerX: artboard.width / 2, centerY: artboard.height / 2, rays: 12, lengthMode: "edge", fixedLength: Math.min(artboard.width, artboard.height) * 0.4, rings: 2, ringSpacing: 80, startAngle: 0, arcSpan: 360, rayColor: "#f97316", rayOpacity: 45, rayStroke: 1, useRingColor: false, ringColor: "#f97316" };
  if (type === "hierarchical") return { zones: [{ id: uid("zone"), x: 80, y: 80, w: Math.max(240, artboard.width * 0.4), h: Math.max(200, artboard.height * 0.3), unit: "px", label: "Zone 1", fill: "#ff5a5a", opacity: 25 }], showLabels: true };
  return { axes: [{ id: uid("axis"), angle: 45, spacing: 48, offset: 0 }, { id: uid("axis"), angle: 135, spacing: 48, offset: 0 }], color: "#a78bfa", opacity: 40, strokeWidth: 1 };
}

function createLayer(type: GridType, artboard: Artboard): Layer {
  return { id: uid("layer"), type, name: `${type[0].toUpperCase()}${type.slice(1)} Grid`, visible: true, opacity: 100, config: defaultConfig(type, artboard) as never };
}

function initialState(): StudioState {
  const artboard = defaultArtboard();
  const layer = createLayer("column", artboard);
  return { artboard, layers: [layer], selectedLayerId: layer.id, controlMode: "simple", panelTab: "layers" };
}

function loadInitialState(): StudioState {
  if (typeof window === "undefined") return initialState();
  const fromHash = window.location.hash.startsWith("#s=") ? window.location.hash.slice(3) : "";
  if (fromHash) {
    try {
      return JSON.parse(base64urlDecode(fromHash)) as StudioState;
    } catch {
      return initialState();
    }
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialState();
  try {
    return JSON.parse(raw) as StudioState;
  } catch {
    return initialState();
  }
}

function loadSetups(): SavedSetup[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(SETUPS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedSetup[];
  } catch {
    return [];
  }
}

function renderLayer(layer: Layer, artboard: Artboard, selectedZoneId: string | null) {
  if (!layer.visible) return null;
  const gOpacity = layer.opacity / 100;

  if (layer.type === "column") {
    const c = layer.config as ColumnConfig;
    const inner = artboard.width - c.marginLeft - c.marginRight;
    const w = (inner - (c.columns - 1) * c.gutter) / c.columns;
    return (
      <g key={layer.id} opacity={gOpacity}>
        {Array.from({ length: c.columns }).map((_, i) => {
          const x = c.marginLeft + i * (w + c.gutter);
          return <rect key={i} x={x} y={0} width={Math.max(0, w)} height={artboard.height} fill={c.filled ? c.color : "none"} fillOpacity={c.filled ? c.opacity / 100 : 0} stroke={c.color} strokeOpacity={c.opacity / 100} strokeWidth={c.strokeWidth} />;
        })}
      </g>
    );
  }

  if (layer.type === "modular") {
    const c = layer.config as ModularConfig;
    const innerW = artboard.width - c.marginLeft - c.marginRight;
    const innerH = artboard.height - c.marginTop - c.marginBottom;
    const w = (innerW - (c.columns - 1) * c.colGutter) / c.columns;
    const h = (innerH - (c.rows - 1) * c.rowGutter) / c.rows;
    return (
      <g key={layer.id} opacity={gOpacity}>
        {Array.from({ length: c.rows }).map((_, r) =>
          Array.from({ length: c.columns }).map((__, col) => {
            const x = c.marginLeft + col * (w + c.colGutter);
            const y = c.marginTop + r * (h + c.rowGutter);
            return <rect key={`${r}-${col}`} x={x} y={y} width={Math.max(0, w)} height={Math.max(0, h)} fill={c.filled ? c.color : "none"} fillOpacity={c.filled ? c.opacity / 100 : 0} stroke={c.color} strokeOpacity={c.opacity / 100} strokeWidth={c.strokeWidth} />;
          })
        )}
      </g>
    );
  }

  if (layer.type === "baseline") {
    const c = layer.config as BaselineConfig;
    const lines: React.ReactNode[] = [];
    let i = 0;
    for (let y = c.topOffset; y <= c.endY; y += Math.max(1, c.spacing)) {
      if (y < c.startY) {
        i += 1;
        continue;
      }
      const em = i % c.emphasisEvery === 0;
      lines.push(<line key={y} x1={0} y1={y} x2={artboard.width} y2={y} stroke={em ? c.emphasisColor : c.color} strokeOpacity={c.opacity / 100} strokeWidth={em ? c.emphasisStroke : c.strokeWidth} />);
      i += 1;
    }
    return <g key={layer.id} opacity={gOpacity}>{lines}</g>;
  }

  if (layer.type === "radial") {
    const c = layer.config as RadialConfig;
    const max = Math.max(artboard.width, artboard.height) * 2;
    const len = c.lengthMode === "edge" ? max : c.fixedLength;
    return (
      <g key={layer.id} opacity={gOpacity}>
        {Array.from({ length: c.rays }).map((_, i) => {
          const a = (c.startAngle + (c.arcSpan / Math.max(1, c.rays - (c.arcSpan < 360 ? 1 : 0))) * i) * (Math.PI / 180);
          return <line key={i} x1={c.centerX} y1={c.centerY} x2={c.centerX + Math.cos(a) * len} y2={c.centerY + Math.sin(a) * len} stroke={c.rayColor} strokeOpacity={c.rayOpacity / 100} strokeWidth={c.rayStroke} />;
        })}
        {Array.from({ length: c.rings }).map((_, i) => <circle key={i} cx={c.centerX} cy={c.centerY} r={(i + 1) * c.ringSpacing} fill="none" stroke={c.useRingColor ? c.ringColor : c.rayColor} strokeOpacity={c.rayOpacity / 100} strokeWidth={c.rayStroke} />)}
        <circle cx={c.centerX} cy={c.centerY} r={6} fill="#fff" fillOpacity={0.8} />
      </g>
    );
  }

  if (layer.type === "hierarchical") {
    const c = layer.config as HierarchicalConfig;
    return (
      <g key={layer.id} opacity={gOpacity}>
        {c.zones.map((z) => {
          const x = z.unit === "px" ? z.x : (z.x / 100) * artboard.width;
          const y = z.unit === "px" ? z.y : (z.y / 100) * artboard.height;
          const w = z.unit === "px" ? z.w : (z.w / 100) * artboard.width;
          const h = z.unit === "px" ? z.h : (z.h / 100) * artboard.height;
          return (
            <g key={z.id} data-zone-id={z.id}>
              <rect x={x} y={y} width={w} height={h} fill={z.fill} fillOpacity={z.opacity / 100} stroke={selectedZoneId === z.id ? "#fff" : z.fill} strokeWidth={selectedZoneId === z.id ? 2 : 1} />
              {c.showLabels && <text x={x + 8} y={y + 18} fill="#fff" fontSize={14}>{z.label}</text>}
              {selectedZoneId === z.id && <rect x={x + w - 10} y={y + h - 10} width={10} height={10} fill="#fff" data-zone-handle={z.id} />}
            </g>
          );
        })}
      </g>
    );
  }

  const c = layer.config as AxialConfig;
  const lines: React.ReactNode[] = [];
  const max = Math.hypot(artboard.width, artboard.height);
  c.axes.forEach((axis, idx) => {
    const r = (axis.angle * Math.PI) / 180;
    const nx = -Math.sin(r);
    const ny = Math.cos(r);
    for (let d = -max; d <= max; d += axis.spacing) {
      const dd = d + axis.offset;
      const cx = artboard.width / 2 + nx * dd;
      const cy = artboard.height / 2 + ny * dd;
      lines.push(<line key={`${idx}-${d}`} x1={cx - Math.cos(r) * max} y1={cy - Math.sin(r) * max} x2={cx + Math.cos(r) * max} y2={cy + Math.sin(r) * max} stroke={c.color} strokeOpacity={c.opacity / 100} strokeWidth={c.strokeWidth} />);
    }
  });
  return <g key={layer.id} opacity={gOpacity}>{lines}</g>;
}

function toSvg(state: StudioState, includeBackground: boolean, gridOnly: boolean) {
  const { artboard, layers } = state;
  const bg = !artboard.transparent && includeBackground && !gridOnly ? `<rect width="100%" height="100%" fill="${artboard.backgroundColor}"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${artboard.width}" height="${artboard.height}" viewBox="0 0 ${artboard.width} ${artboard.height}">${bg}${layers.filter((l) => l.visible).map((l) => {
    if (l.type === "column") {
      const c = l.config as ColumnConfig;
      const inner = artboard.width - c.marginLeft - c.marginRight;
      const w = (inner - (c.columns - 1) * c.gutter) / c.columns;
      return `<g opacity="${l.opacity / 100}">${Array.from({ length: c.columns }).map((_, i) => {
        const x = c.marginLeft + i * (w + c.gutter);
        return `<rect x="${x}" y="0" width="${Math.max(0, w)}" height="${artboard.height}" ${c.filled ? `fill="${c.color}" fill-opacity="${c.opacity / 100}"` : `fill="none"`} stroke="${c.color}" stroke-opacity="${c.opacity / 100}" stroke-width="${c.strokeWidth}"/>`;
      }).join("")}</g>`;
    }
    if (l.type === "modular") {
      const c = l.config as ModularConfig;
      const innerW = artboard.width - c.marginLeft - c.marginRight;
      const innerH = artboard.height - c.marginTop - c.marginBottom;
      const w = (innerW - (c.columns - 1) * c.colGutter) / c.columns;
      const h = (innerH - (c.rows - 1) * c.rowGutter) / c.rows;
      return `<g opacity="${l.opacity / 100}">${Array.from({ length: c.rows }).flatMap((_, r) => Array.from({ length: c.columns }).map((__, col) => {
        const x = c.marginLeft + col * (w + c.colGutter);
        const y = c.marginTop + r * (h + c.rowGutter);
        return `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" ${c.filled ? `fill="${c.color}" fill-opacity="${c.opacity / 100}"` : `fill="none"`} stroke="${c.color}" stroke-opacity="${c.opacity / 100}" stroke-width="${c.strokeWidth}"/>`;
      })).join("")}</g>`;
    }
    if (l.type === "baseline") {
      const c = l.config as BaselineConfig;
      const lines: string[] = [];
      let i = 0;
      for (let y = c.topOffset; y <= c.endY; y += Math.max(1, c.spacing)) {
        if (y < c.startY) {
          i += 1;
          continue;
        }
        const em = i % c.emphasisEvery === 0;
        lines.push(`<line x1="0" y1="${y}" x2="${artboard.width}" y2="${y}" stroke="${em ? c.emphasisColor : c.color}" stroke-opacity="${c.opacity / 100}" stroke-width="${em ? c.emphasisStroke : c.strokeWidth}"/>`);
        i += 1;
      }
      return `<g opacity="${l.opacity / 100}">${lines.join("")}</g>`;
    }
    if (l.type === "radial") {
      const c = l.config as RadialConfig;
      const max = Math.max(artboard.width, artboard.height) * 2;
      const len = c.lengthMode === "edge" ? max : c.fixedLength;
      return `<g opacity="${l.opacity / 100}">${Array.from({ length: c.rays }).map((_, i) => {
        const a = (c.startAngle + (c.arcSpan / Math.max(1, c.rays - (c.arcSpan < 360 ? 1 : 0))) * i) * (Math.PI / 180);
        return `<line x1="${c.centerX}" y1="${c.centerY}" x2="${c.centerX + Math.cos(a) * len}" y2="${c.centerY + Math.sin(a) * len}" stroke="${c.rayColor}" stroke-opacity="${c.rayOpacity / 100}" stroke-width="${c.rayStroke}"/>`;
      }).join("")}${Array.from({ length: c.rings }).map((_, i) => `<circle cx="${c.centerX}" cy="${c.centerY}" r="${(i + 1) * c.ringSpacing}" fill="none" stroke="${c.useRingColor ? c.ringColor : c.rayColor}" stroke-opacity="${c.rayOpacity / 100}" stroke-width="${c.rayStroke}"/>`).join("")}</g>`;
    }
    if (l.type === "hierarchical") {
      const c = l.config as HierarchicalConfig;
      return `<g opacity="${l.opacity / 100}">${c.zones.map((z) => {
        const x = z.unit === "px" ? z.x : (z.x / 100) * artboard.width;
        const y = z.unit === "px" ? z.y : (z.y / 100) * artboard.height;
        const w = z.unit === "px" ? z.w : (z.w / 100) * artboard.width;
        const h = z.unit === "px" ? z.h : (z.h / 100) * artboard.height;
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${z.fill}" fill-opacity="${z.opacity / 100}" stroke="${z.fill}"/>`;
      }).join("")}</g>`;
    }
    const c = l.config as AxialConfig;
    const max = Math.hypot(artboard.width, artboard.height);
    return `<g opacity="${l.opacity / 100}">${c.axes.flatMap((axis) => {
      const r = (axis.angle * Math.PI) / 180;
      const nx = -Math.sin(r);
      const ny = Math.cos(r);
      const arr: string[] = [];
      for (let d = -max; d <= max; d += axis.spacing) {
        const dd = d + axis.offset;
        const cx = artboard.width / 2 + nx * dd;
        const cy = artboard.height / 2 + ny * dd;
        arr.push(`<line x1="${cx - Math.cos(r) * max}" y1="${cy - Math.sin(r) * max}" x2="${cx + Math.cos(r) * max}" y2="${cy + Math.sin(r) * max}" stroke="${c.color}" stroke-opacity="${c.opacity / 100}" stroke-width="${c.strokeWidth}"/>`);
      }
      return arr;
    }).join("")}</g>`;
  }).join("")}</svg>`;
  return svg;
}

export default function Home() {
  const [history, setHistory] = useState<{ past: StudioState[]; present: StudioState; future: StudioState[] }>(() => ({ past: [], present: loadInitialState(), future: [] }));
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [userSetups, setUserSetups] = useState<SavedSetup[]>(() => loadSetups());
  const [setupName, setSetupName] = useState("");
  const [exportScale, setExportScale] = useState(1);
  const [exportTransparent, setExportTransparent] = useState(true);
  const [exportGridOnly, setExportGridOnly] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ kind: "none" | "pan" | "radial" | "zone-move" | "zone-resize"; layerId?: string; zoneId?: string; startX: number; startY: number; startPanX?: number; startPanY?: number; startZone?: Zone }>({ kind: "none", startX: 0, startY: 0 });

  const state = history.present;
  const selectedLayer = state.layers.find((l) => l.id === state.selectedLayerId) ?? null;

  const commit = (updater: (prev: StudioState) => StudioState) => {
    setHistory((prev) => {
      const next = updater(copy(prev.present));
      if (JSON.stringify(next) === JSON.stringify(prev.present)) return prev;
      return { past: [...prev.past, prev.present].slice(-200), present: next, future: [] };
    });
  };

  const undo = () => setHistory((prev) => (prev.past.length ? { past: prev.past.slice(0, -1), present: prev.past[prev.past.length - 1], future: [prev.present, ...prev.future].slice(0, 200) } : prev));
  const redo = () => setHistory((prev) => (prev.future.length ? { past: [...prev.past, prev.present].slice(-200), present: prev.future[0], future: prev.future.slice(1) } : prev));

  const addLayer = (type: GridType) => commit((d) => {
    const layer = createLayer(type, d.artboard);
    d.layers = [layer, ...d.layers];
    d.selectedLayerId = layer.id;
    return d;
  });

  const deleteLayer = (id: string) => commit((d) => {
    d.layers = d.layers.filter((l) => l.id !== id);
    if (d.selectedLayerId === id) d.selectedLayerId = d.layers[0]?.id ?? null;
    return d;
  });

  const duplicateLayer = (id: string) => commit((d) => {
    const source = d.layers.find((l) => l.id === id);
    if (!source) return d;
    const layer = copy(source);
    layer.id = uid("layer");
    layer.name = `${layer.name} Copy`;
    d.layers.unshift(layer);
    d.selectedLayerId = layer.id;
    return d;
  });

  const fitToScreen = () => {
    const host = canvasRef.current;
    if (!host) return;
    const margin = 80;
    const z = Math.floor(Math.min((host.clientWidth - margin) / state.artboard.width, (host.clientHeight - margin) / state.artboard.height) * 100);
    setZoom(clamp(z, 25, 400));
    setPan({ x: 0, y: 0 });
  };

  const moveLayer = (index: number, direction: -1 | 1) => commit((d) => {
    const next = index + direction;
    if (next < 0 || next >= d.layers.length) return d;
    const arr = [...d.layers];
    const [item] = arr.splice(index, 1);
    arr.splice(next, 0, item);
    d.layers = arr;
    return d;
  });

  const exportSvgMarkup = () => toSvg(state, !exportTransparent, exportGridOnly);

  const downloadSvg = () => {
    const blob = new Blob([exportSvgMarkup()], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.artboard.name.replace(/\s+/g, "-").toLowerCase()}-${selectedLayer?.type ?? "grid"}-1x.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  async function renderPngBlob() {
    const svg = exportSvgMarkup();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg render failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(state.artboard.width * exportScale);
    canvas.height = Math.round(state.artboard.height * exportScale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d ctx missing");
    ctx.scale(exportScale, exportScale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function downloadPng() {
    const blob = await renderPngBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.artboard.name.replace(/\s+/g, "-").toLowerCase()}-${selectedLayer?.type ?? "grid"}-${exportScale}x.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyPng() {
    const blob = await renderPngBlob();
    if (!blob) return;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }

  const applyPreset = (kind: "column" | "modular" | "baseline" | "radial" | "hierarchical" | "axial" | "web" | "editorial" | "poster") => commit((d) => {
    if (kind === "web") d.layers = [createLayer("column", d.artboard), createLayer("baseline", d.artboard)];
    else if (kind === "editorial") {
      const c = createLayer("column", d.artboard);
      (c.config as ColumnConfig).columns = 6;
      d.layers = [c, createLayer("baseline", d.artboard)];
    } else if (kind === "poster") d.layers = [createLayer("radial", d.artboard), createLayer("hierarchical", d.artboard)];
    else d.layers = [createLayer(kind, d.artboard)];
    d.selectedLayerId = d.layers[0]?.id ?? null;
    return d;
  });

  const randomize = () => commit((d) => {
    const types: GridType[] = ["column", "modular", "baseline", "radial", "hierarchical", "axial"];
    const count = 1 + Math.floor(Math.random() * 3);
    d.layers = Array.from({ length: count }).map(() => createLayer(types[Math.floor(Math.random() * types.length)], d.artboard));
    d.selectedLayerId = d.layers[0]?.id ?? null;
    return d;
  });

  const copyGridSpec = () => {
    const col = state.layers.find((l) => l.type === "column")?.config as ColumnConfig | undefined;
    const base = state.layers.find((l) => l.type === "baseline")?.config as BaselineConfig | undefined;
    const payload = { columns: col?.columns, gutters: col?.gutter, margins: col ? { left: col.marginLeft, right: col.marginRight } : undefined, baseline: base?.spacing };
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.location.hash = `s=${base64urlEncode(JSON.stringify(state))}`;
  }, [state]);

  useEffect(() => {
    localStorage.setItem(SETUPS_KEY, JSON.stringify(userSetups));
  }, [userSetups]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceDown(true);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        void downloadPng();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && selectedLayer) {
        e.preventDefault();
        duplicateLayer(selectedLayer.id);
      }
      if (e.key === "Delete" && selectedLayer) {
        e.preventDefault();
        deleteLayer(selectedLayer.id);
      }
      if (e.key === "+") setZoom((z) => clamp(z + 10, 25, 400));
      if (e.key === "-") setZoom((z) => clamp(z - 10, 25, 400));
      if (e.key === "0") fitToScreen();
      if (selectedLayer?.type === "radial" && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        commit((d) => {
          const l = d.layers.find((x) => x.id === selectedLayer.id);
          if (!l || l.type !== "radial") return d;
          const c = l.config as RadialConfig;
          if (e.key === "ArrowLeft") c.centerX -= step;
          if (e.key === "ArrowRight") c.centerX += step;
          if (e.key === "ArrowUp") c.centerY -= step;
          if (e.key === "ArrowDown") c.centerY += step;
          return d;
        });
      }
      if (selectedLayer?.type === "hierarchical" && selectedZoneId && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        commit((d) => {
          const l = d.layers.find((x) => x.id === selectedLayer.id);
          if (!l || l.type !== "hierarchical") return d;
          const z = (l.config as HierarchicalConfig).zones.find((x) => x.id === selectedZoneId);
          if (!z) return d;
          if (e.key === "ArrowLeft") z.x -= step;
          if (e.key === "ArrowRight") z.x += step;
          if (e.key === "ArrowUp") z.y -= step;
          if (e.key === "ArrowDown") z.y += step;
          return d;
        });
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectedLayer, selectedZoneId]);

  return (
    <div className="h-screen bg-[#0f0f10] text-zinc-100 flex flex-col">
      <div className="h-12 border-b border-zinc-800 px-3 flex items-center gap-2 text-sm bg-[#171719]">
        <select className="bg-zinc-900 border border-zinc-700 px-2 py-1 rounded" onChange={(e) => addLayer(e.target.value as GridType)} value="">
          <option value="" disabled>Add grid</option>
          <option value="column">Column</option><option value="modular">Modular</option><option value="baseline">Baseline</option><option value="radial">Radial</option><option value="hierarchical">Hierarchical</option><option value="axial">Axial</option>
        </select>
        <button className="btn" onClick={undo}>Undo</button><button className="btn" onClick={redo}>Redo</button>
        <button className="btn" onClick={() => setZoom((z) => clamp(z - 10, 25, 400))}>-</button><button className="btn" onClick={() => setZoom(100)}>100%</button><button className="btn" onClick={fitToScreen}>Fit</button><button className="btn" onClick={() => setZoom((z) => clamp(z + 10, 25, 400))}>+</button>
        <button className={`btn ${state.artboard.snap8 ? "bg-[#ff5a5a]/20" : ""}`} onClick={() => commit((d) => ((d.artboard.snap8 = !d.artboard.snap8), d))}>Snap 8px</button>
        <button className={`btn ${state.artboard.transparent ? "bg-[#ff5a5a]/20" : ""}`} onClick={() => commit((d) => ((d.artboard.transparent = !d.artboard.transparent), d))}>Transparent BG</button>
        <button className="ml-auto btn bg-[#ff5a5a] text-black" onClick={() => void downloadPng()}>Export PNG</button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[320px_1fr_340px]">
        <aside className="border-r border-zinc-800 p-3 overflow-auto bg-[#171719]">
          <div className="flex gap-2 mb-3"><button className={`btn ${state.controlMode === "simple" ? "bg-zinc-700" : ""}`} onClick={() => commit((d) => ((d.controlMode = "simple"), d))}>Simple</button><button className={`btn ${state.controlMode === "advanced" ? "bg-zinc-700" : ""}`} onClick={() => commit((d) => ((d.controlMode = "advanced"), d))}>Advanced</button></div>
          {selectedLayer ? <LayerControls mode={state.controlMode} layer={selectedLayer} commit={commit} snapEnabled={state.artboard.snap8} artboard={state.artboard} /> : <div className="text-zinc-400">Select a layer</div>}
        </aside>

        <main
          ref={canvasRef}
          className="relative overflow-hidden bg-[#121214]"
          onWheel={(e) => {
            e.preventDefault();
            setZoom((z) => clamp(z + (e.deltaY > 0 ? -10 : 10), 25, 400));
          }}
          onMouseDown={(e) => {
            if (spaceDown) dragRef.current = { kind: "pan", startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
          }}
          onMouseMove={(e) => {
            const svg = svgRef.current;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * state.artboard.width;
            const y = ((e.clientY - rect.top) / rect.height) * state.artboard.height;
            setCursor({ x, y });
            if (dragRef.current.kind === "pan") setPan({ x: (dragRef.current.startPanX ?? 0) + (e.clientX - dragRef.current.startX), y: (dragRef.current.startPanY ?? 0) + (e.clientY - dragRef.current.startY) });
            if (dragRef.current.kind === "radial" && dragRef.current.layerId) {
              const layerId = dragRef.current.layerId;
              commit((d) => {
                const l = d.layers.find((x2) => x2.id === layerId);
                if (!l || l.type !== "radial") return d;
                const c = l.config as RadialConfig;
                c.centerX = snap(clamp(x, 0, d.artboard.width), d.artboard.snap8);
                c.centerY = snap(clamp(y, 0, d.artboard.height), d.artboard.snap8);
                return d;
              });
            }
            if ((dragRef.current.kind === "zone-move" || dragRef.current.kind === "zone-resize") && dragRef.current.layerId && dragRef.current.zoneId && dragRef.current.startZone) {
              const layerId = dragRef.current.layerId;
              const zoneId = dragRef.current.zoneId;
              const dx = ((e.clientX - dragRef.current.startX) / rect.width) * state.artboard.width;
              const dy = ((e.clientY - dragRef.current.startY) / rect.height) * state.artboard.height;
              commit((d) => {
                const l = d.layers.find((x2) => x2.id === layerId);
                if (!l || l.type !== "hierarchical") return d;
                const z = (l.config as HierarchicalConfig).zones.find((x2) => x2.id === zoneId);
                if (!z || !dragRef.current.startZone) return d;
                if (dragRef.current.kind === "zone-move") {
                  z.x = snap(dragRef.current.startZone.x + dx, d.artboard.snap8);
                  z.y = snap(dragRef.current.startZone.y + dy, d.artboard.snap8);
                } else {
                  z.w = Math.max(8, snap(dragRef.current.startZone.w + dx, d.artboard.snap8));
                  z.h = Math.max(8, snap(dragRef.current.startZone.h + dy, d.artboard.snap8));
                }
                return d;
              });
            }
          }}
          onMouseUp={() => (dragRef.current = { kind: "none", startX: 0, startY: 0 })}
        >
          {state.artboard.showRulers && (
            <>
              <div className="absolute top-0 left-8 right-0 h-8 bg-zinc-900/90 border-b border-zinc-700 text-[10px] text-zinc-400">{Array.from({ length: Math.floor(state.artboard.width / 100) + 1 }).map((_, i) => <span key={i} className="absolute" style={{ left: `${(i * 100 * zoom) / 100 + pan.x}px` }}>{i * 100}</span>)}</div>
              <div className="absolute top-8 left-0 bottom-0 w-8 bg-zinc-900/90 border-r border-zinc-700 text-[10px] text-zinc-400">{Array.from({ length: Math.floor(state.artboard.height / 100) + 1 }).map((_, i) => <span key={i} className="absolute" style={{ top: `${(i * 100 * zoom) / 100 + pan.y}px` }}>{i * 100}</span>)}</div>
            </>
          )}

          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${state.artboard.width} ${state.artboard.height}`}
              width={state.artboard.width}
              height={state.artboard.height}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`, transformOrigin: "center center", background: state.artboard.transparent ? "transparent" : state.artboard.backgroundColor, boxShadow: "0 0 0 1px #333" }}
              onMouseDown={(e) => {
                const target = e.target as SVGElement;
                if (selectedLayer?.type === "radial" && target.tagName.toLowerCase() === "circle") dragRef.current = { kind: "radial", layerId: selectedLayer.id, startX: e.clientX, startY: e.clientY };
                if (selectedLayer?.type === "hierarchical") {
                  const zoneId = target.getAttribute("data-zone-id");
                  const handleId = target.getAttribute("data-zone-handle");
                  if (zoneId || handleId) {
                    const id = zoneId ?? handleId;
                    const z = (selectedLayer.config as HierarchicalConfig).zones.find((x) => x.id === id);
                    setSelectedZoneId(id);
                    dragRef.current = { kind: handleId ? "zone-resize" : "zone-move", layerId: selectedLayer.id, zoneId: id ?? undefined, startX: e.clientX, startY: e.clientY, startZone: z ? copy(z) : undefined };
                  }
                }
              }}
            >
              {state.layers.slice().reverse().map((l) => renderLayer(l, state.artboard, selectedZoneId))}
            </svg>
          </div>
        </main>

        <aside className="border-l border-zinc-800 p-3 overflow-auto bg-[#171719]">
          <div className="flex gap-2 mb-3">{(["layers", "artboard", "export"] as PanelTab[]).map((tab) => <button key={tab} className={`btn capitalize ${state.panelTab === tab ? "bg-zinc-700" : ""}`} onClick={() => commit((d) => ((d.panelTab = tab), d))}>{tab}</button>)}</div>

          {state.panelTab === "layers" && (
            <div className="space-y-3">
              {state.layers.map((layer, index) => (
                <div key={layer.id} className={`p-2 rounded border ${state.selectedLayerId === layer.id ? "border-[#ff5a5a]" : "border-zinc-700"}`}>
                  <div className="flex items-center gap-2"><button className="btn text-xs" onClick={() => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l) l.visible = !l.visible; return d; })}>{layer.visible ? "👁" : "🚫"}</button><input className="bg-transparent border border-zinc-700 rounded px-1 py-0.5 flex-1" value={layer.name} onFocus={() => commit((d) => ((d.selectedLayerId = layer.id), d))} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l) l.name = e.target.value; return d; })} /><button className="btn" onClick={() => duplicateLayer(layer.id)}>⎘</button><button className="btn" onClick={() => deleteLayer(layer.id)}>🗑</button></div>
                  <div className="mt-2 flex items-center gap-2 text-xs"><label>Opacity</label><input type="range" min={0} max={100} value={layer.opacity} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l) l.opacity = Number(e.target.value); return d; })} /><button className="btn" onClick={() => moveLayer(index, -1)}>↑</button><button className="btn" onClick={() => moveLayer(index, 1)}>↓</button></div>
                </div>
              ))}
              <div className="pt-3 border-t border-zinc-700"><div className="text-xs text-zinc-400 mb-2">Presets</div><div className="flex flex-wrap gap-2">{["column", "modular", "baseline", "radial", "hierarchical", "axial"].map((k) => <button key={k} className="btn text-xs" onClick={() => applyPreset(k as never)}>{k}</button>)}<button className="btn text-xs" onClick={() => applyPreset("web")}>Web starter</button><button className="btn text-xs" onClick={() => applyPreset("editorial")}>Editorial</button><button className="btn text-xs" onClick={() => applyPreset("poster")}>Poster</button><button className="btn text-xs" onClick={randomize}>Surprise me</button></div></div>
            </div>
          )}

          {state.panelTab === "artboard" && (
            <div className="space-y-3 text-sm">
              <select className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" value={state.artboard.name} onChange={(e) => {
                const p = PRESETS.find((x) => x.name === e.target.value);
                if (!p) return;
                commit((d) => {
                  d.artboard.name = p.name;
                  d.artboard.width = p.width;
                  d.artboard.height = p.height;
                  d.layers = d.layers.map((l) => (l.type === "radial" ? { ...l, config: { ...(l.config as RadialConfig), centerX: p.width / 2, centerY: p.height / 2 } } : l));
                  return d;
                });
              }}>{PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select>
              <div className="grid grid-cols-2 gap-2"><label>Width<input className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" type="number" value={state.artboard.width} onChange={(e) => commit((d) => ((d.artboard.width = Number(e.target.value)), d))} /></label><label>Height<input className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" type="number" value={state.artboard.height} onChange={(e) => commit((d) => ((d.artboard.height = Number(e.target.value)), d))} /></label></div>
              <label>Background<input className="w-full" type="color" value={state.artboard.backgroundColor} onChange={(e) => commit((d) => ((d.artboard.backgroundColor = e.target.value), d))} /></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={state.artboard.transparent} onChange={(e) => commit((d) => ((d.artboard.transparent = e.target.checked), d))} />Transparent</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={state.artboard.showRulers} onChange={(e) => commit((d) => ((d.artboard.showRulers = e.target.checked), d))} />Rulers</label>
            </div>
          )}

          {state.panelTab === "export" && (
            <div className="space-y-3 text-sm">
              <label>Scale<select className="ml-2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1" value={exportScale} onChange={(e) => setExportScale(Number(e.target.value))}>{[1, 2, 3, 4].map((s) => <option key={s} value={s}>{s}x</option>)}</select></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={exportTransparent} onChange={(e) => setExportTransparent(e.target.checked)} />transparent background</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!exportTransparent} onChange={(e) => setExportTransparent(!e.target.checked)} />include artboard background</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={exportGridOnly} onChange={(e) => setExportGridOnly(e.target.checked)} />grid-only export</label>
              <button className="btn w-full" onClick={downloadSvg}>Download SVG</button>
              <button className="btn w-full" onClick={() => void downloadPng()}>Download PNG</button>
              <button className="btn w-full" onClick={() => void copyPng()}>Copy PNG to clipboard</button>
              <button className="btn w-full" onClick={copyGridSpec}>Copy grid spec JSON</button>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-zinc-700 space-y-2"><div className="text-xs text-zinc-400">Saved setups</div><div className="flex gap-2"><input className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1" placeholder="Setup name" value={setupName} onChange={(e) => setSetupName(e.target.value)} /><button className="btn" onClick={() => { if (!setupName.trim()) return; setUserSetups((prev) => [...prev, { id: uid("setup"), name: setupName.trim(), state: copy(state) }]); setSetupName(""); }}>Save</button></div>{userSetups.map((s) => <div key={s.id} className="flex gap-2"><button className="btn flex-1 text-left" onClick={() => setHistory({ past: [], present: copy(s.state), future: [] })}>{s.name}</button><button className="btn" onClick={() => setUserSetups((prev) => prev.filter((x) => x.id !== s.id))}>✕</button></div>)}</div>
        </aside>
      </div>

      <div className="h-8 border-t border-zinc-800 px-3 flex items-center text-xs text-zinc-400 bg-[#171719]"><span>{state.artboard.width} × {state.artboard.height}px</span><span className="ml-3">Zoom {zoom}%</span><span className="ml-3">Cursor {Math.round(cursor.x)}, {Math.round(cursor.y)}</span></div>
    </div>
  );
}

function LayerControls({ mode, layer, commit, snapEnabled, artboard }: { mode: ControlMode; layer: Layer; commit: (updater: (prev: StudioState) => StudioState) => void; snapEnabled: boolean; artboard: Artboard }) {
  const slider = "w-full";

  if (layer.type === "column") {
    const c = layer.config as ColumnConfig;
    return <div className="space-y-2 text-sm">
      <label>Columns<input className={slider} type="range" min={1} max={24} value={c.columns} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "column") (l.config as ColumnConfig).columns = Number(e.target.value); return d; })} /></label>
      <label>Gutter<input className={slider} type="range" min={0} max={100} value={c.gutter} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "column") (l.config as ColumnConfig).gutter = Number(e.target.value); return d; })} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={c.linkedMargins} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "column") (l.config as ColumnConfig).linkedMargins = e.target.checked; return d; })} />Link margins</label>
      <div className="grid grid-cols-2 gap-2"><label>Left<input className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" type="number" value={c.marginLeft} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "column") { const cfg = l.config as ColumnConfig; cfg.marginLeft = Number(e.target.value); if (cfg.linkedMargins) cfg.marginRight = cfg.marginLeft; } return d; })} /></label><label>Right<input className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" type="number" value={c.marginRight} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "column") { const cfg = l.config as ColumnConfig; cfg.marginRight = Number(e.target.value); if (cfg.linkedMargins) cfg.marginLeft = cfg.marginRight; } return d; })} /></label></div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={c.filled} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "column") (l.config as ColumnConfig).filled = e.target.checked; return d; })} />Filled columns</label>
      <label>Color<input className="w-full" type="color" value={c.color} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "column") (l.config as ColumnConfig).color = e.target.value; return d; })} /></label>
      {mode === "advanced" && <><label>Opacity<input className={slider} type="range" min={0} max={100} value={c.opacity} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "column") (l.config as ColumnConfig).opacity = Number(e.target.value); return d; })} /></label><label>Stroke<input className={slider} type="range" min={1} max={4} value={c.strokeWidth} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "column") (l.config as ColumnConfig).strokeWidth = Number(e.target.value); return d; })} /></label></>}
    </div>;
  }

  if (layer.type === "modular") {
    const c = layer.config as ModularConfig;
    return <div className="space-y-2 text-sm">
      <label>Columns<input className={slider} type="range" min={1} max={12} value={c.columns} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "modular") (l.config as ModularConfig).columns = Number(e.target.value); return d; })} /></label>
      <label>Rows<input className={slider} type="range" min={1} max={12} value={c.rows} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "modular") (l.config as ModularConfig).rows = Number(e.target.value); return d; })} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={c.linkedGutters} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "modular") (l.config as ModularConfig).linkedGutters = e.target.checked; return d; })} />Link gutters</label>
      <label>Column gutter<input className={slider} type="range" min={0} max={100} value={c.colGutter} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "modular") { const cfg = l.config as ModularConfig; cfg.colGutter = Number(e.target.value); if (cfg.linkedGutters) cfg.rowGutter = cfg.colGutter; } return d; })} /></label>
      <label>Row gutter<input className={slider} type="range" min={0} max={100} value={c.rowGutter} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "modular") { const cfg = l.config as ModularConfig; cfg.rowGutter = Number(e.target.value); if (cfg.linkedGutters) cfg.colGutter = cfg.rowGutter; } return d; })} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={c.linkedMargins} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "modular") (l.config as ModularConfig).linkedMargins = e.target.checked; return d; })} />Link margins</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={c.filled} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "modular") (l.config as ModularConfig).filled = e.target.checked; return d; })} />Filled modules</label>
      <label>Color<input className="w-full" type="color" value={c.color} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "modular") (l.config as ModularConfig).color = e.target.value; return d; })} /></label>
      {mode === "advanced" && <><div className="grid grid-cols-2 gap-1">{(["marginTop", "marginRight", "marginBottom", "marginLeft"] as (keyof ModularConfig)[]).map((k) => <label key={k}>{k.replace("margin", "")}<input className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" type="number" value={c[k] as number} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "modular") { const cfg = l.config as ModularConfig; const v = Number(e.target.value); (cfg[k] as number) = v; if (cfg.linkedMargins) cfg.marginTop = cfg.marginRight = cfg.marginBottom = cfg.marginLeft = v; } return d; })} /></label>)}</div><label>Opacity<input className={slider} type="range" min={0} max={100} value={c.opacity} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "modular") (l.config as ModularConfig).opacity = Number(e.target.value); return d; })} /></label></>}
    </div>;
  }

  if (layer.type === "baseline") {
    const c = layer.config as BaselineConfig;
    return <div className="space-y-2 text-sm">
      <label>Line spacing<input className={slider} type="range" min={2} max={64} value={c.spacing} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "baseline") (l.config as BaselineConfig).spacing = Number(e.target.value); return d; })} /></label>
      <label>Top offset<input className={slider} type="range" min={0} max={200} value={c.topOffset} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "baseline") (l.config as BaselineConfig).topOffset = Number(e.target.value); return d; })} /></label>
      <label>Every Nth<input className={slider} type="range" min={1} max={16} value={c.emphasisEvery} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "baseline") (l.config as BaselineConfig).emphasisEvery = Number(e.target.value); return d; })} /></label>
      <label>Color<input className="w-full" type="color" value={c.color} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "baseline") (l.config as BaselineConfig).color = e.target.value; return d; })} /></label>
      <label>Start Y<input className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" type="number" value={c.startY} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "baseline") (l.config as BaselineConfig).startY = Number(e.target.value); return d; })} /></label>
      <label>End Y<input className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" type="number" value={c.endY} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "baseline") (l.config as BaselineConfig).endY = Number(e.target.value); return d; })} /></label>
      {mode === "advanced" && <><label>Emphasis color<input className="w-full" type="color" value={c.emphasisColor} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "baseline") (l.config as BaselineConfig).emphasisColor = e.target.value; return d; })} /></label><label>Emphasis stroke<input className={slider} type="range" min={1} max={4} value={c.emphasisStroke} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "baseline") (l.config as BaselineConfig).emphasisStroke = Number(e.target.value); return d; })} /></label></>}
    </div>;
  }

  if (layer.type === "radial") {
    const c = layer.config as RadialConfig;
    return <div className="space-y-2 text-sm">
      <label>Center X<input className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" type="number" value={Math.round(c.centerX)} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "radial") (l.config as RadialConfig).centerX = snap(Number(e.target.value), snapEnabled); return d; })} /></label>
      <label>Center Y<input className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" type="number" value={Math.round(c.centerY)} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "radial") (l.config as RadialConfig).centerY = snap(Number(e.target.value), snapEnabled); return d; })} /></label>
      <label>Rays<input className={slider} type="range" min={2} max={72} value={c.rays} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "radial") (l.config as RadialConfig).rays = Number(e.target.value); return d; })} /></label>
      <label>Length mode<select className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" value={c.lengthMode} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "radial") (l.config as RadialConfig).lengthMode = e.target.value as "edge" | "fixed"; return d; })}><option value="edge">to artboard edge</option><option value="fixed">fixed length</option></select></label>
      {c.lengthMode === "fixed" && <label>Fixed length<input className={slider} type="range" min={10} max={Math.round(Math.hypot(artboard.width, artboard.height))} value={c.fixedLength} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "radial") (l.config as RadialConfig).fixedLength = Number(e.target.value); return d; })} /></label>}
      <label>Rings<input className={slider} type="range" min={0} max={12} value={c.rings} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "radial") (l.config as RadialConfig).rings = Number(e.target.value); return d; })} /></label>
      <label>Ring spacing<input className={slider} type="range" min={1} max={200} value={c.ringSpacing} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "radial") (l.config as RadialConfig).ringSpacing = Number(e.target.value); return d; })} /></label>
      {mode === "advanced" && <><label>Start angle<input className={slider} type="range" min={0} max={360} value={c.startAngle} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "radial") (l.config as RadialConfig).startAngle = Number(e.target.value); return d; })} /></label><label>Arc span<input className={slider} type="range" min={10} max={360} value={c.arcSpan} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "radial") (l.config as RadialConfig).arcSpan = Number(e.target.value); return d; })} /></label><label>Ray color<input className="w-full" type="color" value={c.rayColor} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "radial") (l.config as RadialConfig).rayColor = e.target.value; return d; })} /></label><label>Opacity<input className={slider} type="range" min={0} max={100} value={c.rayOpacity} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "radial") (l.config as RadialConfig).rayOpacity = Number(e.target.value); return d; })} /></label><label>Stroke<input className={slider} type="range" min={1} max={4} value={c.rayStroke} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "radial") (l.config as RadialConfig).rayStroke = Number(e.target.value); return d; })} /></label><label className="flex items-center gap-2"><input type="checkbox" checked={c.useRingColor} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "radial") (l.config as RadialConfig).useRingColor = e.target.checked; return d; })} />Separate ring color</label>{c.useRingColor && <label>Ring color<input className="w-full" type="color" value={c.ringColor} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "radial") (l.config as RadialConfig).ringColor = e.target.value; return d; })} /></label>}</>}
    </div>;
  }

  if (layer.type === "hierarchical") {
    const c = layer.config as HierarchicalConfig;
    return <div className="space-y-2 text-sm">
      <button className="btn" onClick={() => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "hierarchical") (l.config as HierarchicalConfig).zones.push({ id: uid("zone"), x: 48, y: 48, w: 240, h: 180, unit: "px", label: `Zone ${(l.config as HierarchicalConfig).zones.length + 1}`, fill: "#60a5fa", opacity: 25 }); return d; })}>Add zone</button>
      <label className="flex items-center gap-2"><input type="checkbox" checked={c.showLabels} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "hierarchical") (l.config as HierarchicalConfig).showLabels = e.target.checked; return d; })} />Show labels</label>
      {c.zones.map((z) => <div key={z.id} className="p-2 border border-zinc-700 rounded space-y-1"><div className="flex gap-1"><input className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1" value={z.label} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "hierarchical") { const zone = (l.config as HierarchicalConfig).zones.find((x) => x.id === z.id); if (zone) zone.label = e.target.value; } return d; })} /><button className="btn" onClick={() => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "hierarchical") { const zone = (l.config as HierarchicalConfig).zones.find((x) => x.id === z.id); if (zone) { const dupe = copy(zone); dupe.id = uid("zone"); dupe.label = `${zone.label} Copy`; (l.config as HierarchicalConfig).zones.push(dupe); } } return d; })}>⎘</button><button className="btn" onClick={() => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "hierarchical") (l.config as HierarchicalConfig).zones = (l.config as HierarchicalConfig).zones.filter((x) => x.id !== z.id); return d; })}>🗑</button></div>
        <div className="grid grid-cols-2 gap-1">{(["x", "y", "w", "h"] as const).map((k) => <label key={k}>{k.toUpperCase()}<input className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" type="number" value={Math.round(z[k])} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "hierarchical") { const zone = (l.config as HierarchicalConfig).zones.find((x) => x.id === z.id); if (zone) zone[k] = snap(Number(e.target.value), snapEnabled); } return d; })} /></label>)}</div>
        <label>Unit<select className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" value={z.unit} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "hierarchical") { const zone = (l.config as HierarchicalConfig).zones.find((x) => x.id === z.id); if (zone) zone.unit = e.target.value as "px" | "%"; } return d; })}><option value="px">px</option><option value="%">%</option></select></label>
        <label>Fill<input className="w-full" type="color" value={z.fill} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "hierarchical") { const zone = (l.config as HierarchicalConfig).zones.find((x) => x.id === z.id); if (zone) zone.fill = e.target.value; } return d; })} /></label>
        <label>Opacity<input className={slider} type="range" min={0} max={100} value={z.opacity} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "hierarchical") { const zone = (l.config as HierarchicalConfig).zones.find((x) => x.id === z.id); if (zone) zone.opacity = Number(e.target.value); } return d; })} /></label></div>)}
    </div>;
  }

  const c = layer.config as AxialConfig;
  return <div className="space-y-2 text-sm"><button className="btn" onClick={() => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "axial") (l.config as AxialConfig).axes.push({ id: uid("axis"), angle: 45, spacing: 48, offset: 0 }); return d; })}>Add axis</button>{c.axes.map((a) => <div key={a.id} className="p-2 border border-zinc-700 rounded space-y-1"><label>Angle<input className={slider} type="range" min={0} max={180} value={a.angle} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "axial") { const axis = (l.config as AxialConfig).axes.find((x) => x.id === a.id); if (axis) axis.angle = Number(e.target.value); } return d; })} /></label><label>Spacing<input className={slider} type="range" min={8} max={200} value={a.spacing} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "axial") { const axis = (l.config as AxialConfig).axes.find((x) => x.id === a.id); if (axis) axis.spacing = Number(e.target.value); } return d; })} /></label><label>Offset<input className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" type="number" value={a.offset} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "axial") { const axis = (l.config as AxialConfig).axes.find((x) => x.id === a.id); if (axis) axis.offset = Number(e.target.value); } return d; })} /></label><button className="btn" onClick={() => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "axial") (l.config as AxialConfig).axes = (l.config as AxialConfig).axes.filter((x) => x.id !== a.id); return d; })}>Remove axis</button></div>)}<label>Color<input className="w-full" type="color" value={c.color} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "axial") (l.config as AxialConfig).color = e.target.value; return d; })} /></label><label>Opacity<input className={slider} type="range" min={0} max={100} value={c.opacity} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "axial") (l.config as AxialConfig).opacity = Number(e.target.value); return d; })} /></label><label>Stroke<input className={slider} type="range" min={1} max={4} value={c.strokeWidth} onChange={(e) => commit((d) => { const l = d.layers.find((x) => x.id === layer.id); if (l && l.type === "axial") (l.config as AxialConfig).strokeWidth = Number(e.target.value); return d; })} /></label></div>;
}
