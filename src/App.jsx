import { useEffect, useMemo, useRef, useState } from "react";
import {
  Aperture,
  Check,
  Contrast,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Sun,
  Thermometer,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { ADJUSTMENTS, createHsl, FILTERS, isHslNeutral } from "./filters.js";
import {
  getCropGeometry,
  renderFiltered,
  renderFilteredAsync,
  resolveRecipe,
} from "./image-processing.js";
import {
  fileToPersistableUrl,
  loadPresets,
  loadSession,
  savePresets,
  saveSession,
} from "./storage.js";

const DEMO_URL = import.meta.env.DEV
  ? "/tests/fixtures/demo-user-provided.webp"
  : null;
const THUMB_INTENSITY = 72;
const HISTORY_LIMIT = 40;
const INITIAL_CROP = {
  ratio: "original",
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  straighten: 0,
  flipH: false,
  flipV: false,
};
const ZERO_RECIPE = Object.fromEntries(
  Object.keys(FILTERS[0].recipe).map((key) => [key, 0]),
);
const CROP_RATIOS = [
  { value: "original", label: "Original" },
  { value: "1:1", label: "1:1" },
  { value: "3:2", label: "3:2" },
  { value: "4:5", label: "4:5" },
  { value: "9:16", label: "9:16" },
];
const QUICK_SETTINGS = [
  { key: "temp", label: "Temp", Icon: Thermometer },
  { key: "contrast", label: "Contrast", Icon: Contrast },
  { key: "grain", label: "Grain", Icon: Aperture },
];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pad = (value) => String(value).padStart(2, "0");
const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 42 42" aria-hidden="true">
      <path
        d="M21 3.5c-7.3 0-9.1 7.7-5.3 13.1C10.3 12.8 2.5 14.6 2.5 21.9c0 7.2 7.7 9.1 13.1 5.3-3.8 5.4-2 13.1 5.3 13.1s9.1-7.7 5.3-13.1c5.4 3.8 13.1 1.9 13.1-5.3s-7.7-9.1-13.1-5.3C30 11.2 28.2 3.5 21 3.5Z"
        fill="currentColor"
      />
      <circle cx="21" cy="21" r="3.2" fill="#f8f7f2" />
    </svg>
  );
}

// One slider shape for every range in the app: an "stacked" variant for the
// adjust grid (label and value above the track) and a "row" variant for
// intensity and crop controls (label, track, value in one line). Both open a
// history transaction on first input and close it on release.
function EditSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  variant = "stacked",
  disabled = false,
  ariaLabel,
  beginEdit,
  endEdit,
  hue = false,
}) {
  const fill = ((value - min) / (max - min)) * 100;
  const input = (
    <input
      type="range"
      id={id}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      onPointerDown={beginEdit}
      onKeyDown={beginEdit}
      onPointerUp={endEdit}
      onKeyUp={endEdit}
      onBlur={endEdit}
      className={hue ? "hue-range" : undefined}
      style={{ "--range-fill": `${fill}%` }}
      aria-label={ariaLabel ?? label}
      aria-valuetext={display}
    />
  );
  if (variant === "row") {
    return (
      <label className="row-slider" htmlFor={id}>
        <span>{label}</span>
        {input}
        <output>{display}</output>
      </label>
    );
  }
  return (
    <label className="adjustment-control">
      <span className="adjustment-label">{label}</span>
      <output>{display}</output>
      {input}
    </label>
  );
}

// Shared dialog behavior for both bottom sheets: focus the first control (or
// a given field), trap Tab, close on Escape, and restore focus on exit.
function useSheetDialog(open, onClose, focusSelector) {
  const sheetRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const sheet = sheetRef.current;
    const focusTimer = window.setTimeout(() => {
      const target = focusSelector
        ? sheet?.querySelector(focusSelector)
        : sheet?.querySelector("button:not(:disabled)");
      target?.focus?.();
      if (target instanceof HTMLInputElement) target.select();
    }, 30);
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab" || !sheet) return;
      const controls = [
        ...sheet.querySelectorAll(
          "button:not(:disabled), input:not(:disabled)",
        ),
      ];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, [open, focusSelector]);
  return sheetRef;
}

// Swipe-down-to-dismiss for the bottom sheets, so the grab handle finally
// does what it looks like it does. Drags that start on form controls are
// ignored; anything dragged past ~90px closes the sheet.
function useSheetDrag(onClose) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  function onPointerDown(event) {
    if (event.button > 0) return;
    if (event.target.closest("input, button, a, select, textarea")) return;
    gesture.current = { id: event.pointerId, startY: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event) {
    if (!gesture.current || gesture.current.id !== event.pointerId) return;
    const dy = Math.max(0, event.clientY - gesture.current.startY);
    setDragging(dy > 4);
    setOffset(dy);
  }
  function onPointerEnd(event) {
    if (!gesture.current || gesture.current.id !== event.pointerId) return;
    const dy = Math.max(0, event.clientY - gesture.current.startY);
    gesture.current = null;
    setDragging(false);
    setOffset(0);
    if (dy > 90) closeRef.current();
  }

  return {
    dragProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
    sheetStyle: {
      transform: offset ? `translateY(${offset}px)` : undefined,
      transition: dragging ? "none" : "transform 0.2s ease",
    },
  };
}

function App() {
  const [image, setImage] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(DEMO_URL);
  const [photoName, setPhotoName] = useState(
    DEMO_URL ? "Demo sample" : "",
  );
  const [selectedId, setSelectedId] = useState(FILTERS[0].id);
  const [recipe, setRecipe] = useState({ ...FILTERS[0].recipe });
  const [intensity, setIntensity] = useState(THUMB_INTENSITY);
  const [crop, setCrop] = useState({ ...INITIAL_CROP });
  const [hsl, setHsl] = useState(createHsl);
  const [customPresets, setCustomPresets] = useState([]);
  const [historyFlags, setHistoryFlags] = useState({
    canUndo: false,
    canRedo: false,
  });
  const [tab, setTab] = useState("filters");
  const [compare, setCompare] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("jpg");
  const [exportSize, setExportSize] = useState("original");
  const [exporting, setExporting] = useState(false);
  const [largeExportEdge, setLargeExportEdge] = useState(3200);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [thumbnails, setThumbnails] = useState({});
  const [presetDialog, setPresetDialog] = useState(null);
  const [stageBox, setStageBox] = useState({ width: 0, height: 0 });
  const canvasRef = useRef(null);
  const originalCanvasRef = useRef(null);
  const inputRef = useRef(null);
  const presetNameRef = useRef(null);
  const stageWrapRef = useRef(null);
  const loadSequence = useRef(0);
  const currentObjectUrl = useRef(null);
  const persistedPhoto = useRef(null);
  const historyRef = useRef({ past: [], future: [] });
  const historyTransaction = useRef(false);
  const panGesture = useRef(null);
  const pinchGesture = useRef(null);
  const stagePointers = useRef(new Map());
  const stageRect = useRef(null);
  const thumbToken = useRef(0);
  const keyHandlerRef = useRef(() => {});
  const keyUpHandlerRef = useRef(() => {});
  const notifiedStorage = useRef(false);
  const cropGeometryRef = useRef(null);

  const allFilters = useMemo(
    () => [...FILTERS, ...customPresets],
    [customPresets],
  );
  const activeFilter = useMemo(
    () => allFilters.find((filter) => filter.id === selectedId) ?? allFilters[0],
    [allFilters, selectedId],
  );
  const effectiveRecipe = useMemo(
    () => resolveRecipe(activeFilter.recipe, recipe, intensity),
    [activeFilter, recipe, intensity],
  );
  const effectiveHsl = useMemo(
    () => (isHslNeutral(hsl) ? null : hsl),
    [hsl],
  );
  const cropGeometry = useMemo(
    () =>
      image
        ? getCropGeometry(image.naturalWidth, image.naturalHeight, crop)
        : null,
    [image, crop],
  );
  useEffect(() => {
    cropGeometryRef.current = cropGeometry;
  });

  const exportSheetRef = useSheetDialog(exportOpen, () => setExportOpen(false));
  const presetSheetRef = useSheetDialog(
    presetDialog !== null,
    () => setPresetDialog(null),
    ".preset-name-field input",
  );
  const exportDrag = useSheetDrag(() => setExportOpen(false));
  const presetDrag = useSheetDrag(() => setPresetDialog(null));

  // The photo stage gets whatever height the dock leaves over; the photo box
  // is fitted into it in JS because a pure aspect-ratio box cannot satisfy
  // both width and height constraints at once.
  useEffect(() => {
    const element = stageWrapRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStageBox((previous) =>
        Math.abs(previous.width - width) < 1 &&
        Math.abs(previous.height - height) < 1
          ? previous
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fittedStage = useMemo(() => {
    if (!cropGeometry || !stageBox.width || !stageBox.height) return null;
    const ratio = cropGeometry.ratio;
    let width = stageBox.width;
    let height = width / ratio;
    if (height > stageBox.height) {
      height = stageBox.height;
      width = height * ratio;
    }
    return { width: Math.floor(width), height: Math.floor(height) };
  }, [cropGeometry, stageBox]);

  // ── Loading: restore a saved session first, otherwise fall back to the demo.
  useEffect(() => {
    let cancelled = false;
    const session = loadSession();
    const storedPresets = loadPresets();
    if (storedPresets.length) setCustomPresets(storedPresets);

    if (session && typeof session === "object") {
      if (session.recipe && typeof session.recipe === "object") {
        setRecipe({ ...FILTERS[0].recipe, ...session.recipe });
      }
      if (typeof session.selectedId === "string") {
        setSelectedId(session.selectedId);
      }
      if (typeof session.intensity === "number") {
        setIntensity(session.intensity);
      }
      if (session.crop && typeof session.crop === "object") {
        setCrop({ ...INITIAL_CROP, ...session.crop });
      }
      if (session.hsl && typeof session.hsl === "object") {
        setHsl({ ...createHsl(), ...session.hsl });
      }
      if (session.history && Array.isArray(session.history.past)) {
        historyRef.current = {
          past: session.history.past.slice(-HISTORY_LIMIT),
          future: Array.isArray(session.history.future)
            ? session.history.future.slice(-HISTORY_LIMIT)
            : [],
        };
      }
      if (session.photoUrl) {
        persistedPhoto.current = session.photoUrl;
        const restored = new Image();
        restored.onload = () => {
          if (cancelled) return;
          setPhotoUrl(session.photoUrl);
          setPhotoName(session.photoName || "Restored photo");
          setImage(restored);
          setLoading(false);
        };
        restored.onerror = () => {
          if (!cancelled) setLoading(false);
        };
        restored.src = session.photoUrl;
        return () => {
          cancelled = true;
        };
      }
    }

    if (!DEMO_URL) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    const requestId = ++loadSequence.current;
    const demo = new Image();
    demo.onload = () => {
      if (cancelled || requestId !== loadSequence.current) return;
      setImage(demo);
      setLoading(false);
    };
    demo.onerror = () => setLoading(false);
    demo.src = DEMO_URL;
    return () => {
      cancelled = true;
      loadSequence.current += 1;
      if (currentObjectUrl.current)
        URL.revokeObjectURL(currentObjectUrl.current);
    };
  }, []);

  // ── Autosave to localStorage (settings + small photos only).
  useEffect(() => {
    if (loading) return undefined;
    const snapshot = () => ({
      version: 1,
      photoUrl: persistedPhoto.current,
      photoName,
      selectedId,
      recipe,
      intensity,
      crop,
      hsl,
      history: {
        past: historyRef.current.past.slice(-HISTORY_LIMIT),
        future: historyRef.current.future.slice(-HISTORY_LIMIT),
      },
    });
    const flush = () => {
      if (!saveSession(snapshot()) && !notifiedStorage.current) {
        notifiedStorage.current = true;
        notify("This browser could not remember your session.");
      }
    };
    const timer = window.setTimeout(flush, 400);
    // A reload can happen inside the debounce window, so flush on the way out.
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
    };
  }, [loading, photoName, selectedId, recipe, intensity, crop, hsl, historyFlags]);

  // ── Preview renders. The unfiltered framing canvas only depends on the
  // photo and crop, so moving a slider never re-renders it.
  useEffect(() => {
    if (!image || !originalCanvasRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        renderFiltered(
          image,
          originalCanvasRef.current,
          ZERO_RECIPE,
          1500,
          crop,
        );
      } catch (error) {
        console.error("Could not draw the photo framing", error);
      }
    }, 20);
    return () => window.clearTimeout(timer);
  }, [image, crop]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        renderFiltered(
          image,
          canvasRef.current,
          effectiveRecipe,
          1500,
          crop,
          effectiveHsl,
        );
      } catch (error) {
        console.error("Could not preview this image", error);
        notify("This photo is too large to preview in this browser.");
      }
    }, 20);
    return () => window.clearTimeout(timer);
  }, [image, effectiveRecipe, effectiveHsl, crop]);

  // ── Thumbnails are generated one at a time so a large library never blocks,
  // and only after the crop settles, so pan/zoom gestures don't regenerate
  // the whole strip on every pointer move.
  useEffect(() => {
    if (!image) return undefined;
    const token = ++thumbToken.current;
    const gallery = [...FILTERS, ...customPresets];
    const cache = {};
    let index = 0;
    let timer;

    const pump = () => {
      if (token !== thumbToken.current) return;
      if (index >= gallery.length) return;
      const filter = gallery[index];
      index += 1;
      try {
        const thumbnail = document.createElement("canvas");
        renderFiltered(
          image,
          thumbnail,
          resolveRecipe(filter.recipe, filter.recipe, THUMB_INTENSITY),
          180,
          crop,
          filter.hsl ?? null,
        );
        cache[filter.id] = thumbnail.toDataURL("image/png");
      } catch {
        /* skip a thumbnail that cannot be rendered */
      }
      setThumbnails({ ...cache });
      timer = window.setTimeout(pump, 24);
    };

    setThumbnails({});
    timer = window.setTimeout(pump, 250);
    return () => {
      window.clearTimeout(timer);
      thumbToken.current += 1;
    };
  }, [image, crop, customPresets]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // ── Keyboard shortcuts. The handlers are refreshed after every render but
  // the listeners themselves are attached once.
  useEffect(() => {
    keyHandlerRef.current = (event) => {
      const target = event.target;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoEdit();
        else undoEdit();
        return;
      }
      if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoEdit();
        return;
      }
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (image && !exporting) openExport();
        return;
      }
      if (exportOpen || presetDialog || typing || mod) return;

      if (event.key === " " && tab !== "crop") {
        event.preventDefault();
        setCompare(true);
        return;
      }
      if (event.key === "1") {
        event.preventDefault();
        setTab("filters");
        return;
      }
      if (event.key === "2") {
        event.preventDefault();
        setTab("crop");
        return;
      }
      if (event.key === "3") {
        event.preventDefault();
        setTab("adjust");
      }
    };
    keyUpHandlerRef.current = (event) => {
      if (event.key === " ") setCompare(false);
    };
  });

  useEffect(() => {
    const onDown = (event) => keyHandlerRef.current(event);
    const onUp = (event) => keyUpHandlerRef.current(event);
    document.addEventListener("keydown", onDown);
    document.addEventListener("keyup", onUp);
    return () => {
      document.removeEventListener("keydown", onDown);
      document.removeEventListener("keyup", onUp);
    };
  }, []);

  function notify(message) {
    setToast(message);
  }

  function captureEdit() {
    return {
      selectedId,
      recipe: { ...recipe },
      intensity,
      crop: { ...crop },
      hsl: { ...hsl },
    };
  }

  function syncHistoryFlags() {
    setHistoryFlags({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0,
    });
  }

  function recordEdit() {
    historyRef.current.past = [
      ...historyRef.current.past,
      captureEdit(),
    ].slice(-HISTORY_LIMIT);
    historyRef.current.future = [];
    historyTransaction.current = false;
    syncHistoryFlags();
  }

  function beginHistoryTransaction() {
    if (!historyTransaction.current) {
      historyRef.current.past = [
        ...historyRef.current.past,
        captureEdit(),
      ].slice(-HISTORY_LIMIT);
      historyRef.current.future = [];
      historyTransaction.current = true;
      syncHistoryFlags();
    }
  }

  function endHistoryTransaction() {
    historyTransaction.current = false;
  }

  function clearHistory() {
    historyRef.current = { past: [], future: [] };
    historyTransaction.current = false;
    syncHistoryFlags();
  }

  function applyEdit(edit) {
    setSelectedId(edit.selectedId);
    setRecipe({ ...edit.recipe });
    setIntensity(edit.intensity);
    setCrop({ ...edit.crop });
    setHsl({ ...createHsl(), ...edit.hsl });
  }

  function undoEdit() {
    historyTransaction.current = false;
    const previous = historyRef.current.past.pop();
    if (!previous) return;
    historyRef.current.future.push(captureEdit());
    applyEdit(previous);
    syncHistoryFlags();
  }

  function redoEdit() {
    historyTransaction.current = false;
    const next = historyRef.current.future.pop();
    if (!next) return;
    historyRef.current.past = [
      ...historyRef.current.past,
      captureEdit(),
    ].slice(-HISTORY_LIMIT);
    applyEdit(next);
    syncHistoryFlags();
  }

  function chooseCropRatio(ratio) {
    recordEdit();
    setCrop((previous) => ({ ...previous, ratio, offsetX: 0, offsetY: 0 }));
  }

  function updateCrop(key, value) {
    beginHistoryTransaction();
    setCrop((previous) => ({ ...previous, [key]: value }));
  }

  function rotateCrop(direction) {
    recordEdit();
    setCrop((previous) => ({
      ...previous,
      rotation: (previous.rotation + direction + 360) % 360,
      offsetX: 0,
      offsetY: 0,
    }));
  }

  function flipCrop(axis) {
    recordEdit();
    setCrop((previous) => ({
      ...previous,
      [axis === "horizontal" ? "flipH" : "flipV"]:
        !(axis === "horizontal" ? previous.flipH : previous.flipV),
    }));
  }

  function resetCrop() {
    recordEdit();
    setCrop({ ...INITIAL_CROP });
  }

  // ── Photo stage gestures: press-and-hold to compare, one-finger pan and
  // two-finger pinch to zoom while cropping.
  function handleStagePointerDown(event) {
    if (event.button > 0) return;
    if (tab === "crop") {
      const pointers = stagePointers.current;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      if (pointers.size === 1) {
        beginPan(event);
      } else if (pointers.size === 2) {
        // A second finger turns the pan into a pinch-zoom.
        panGesture.current = null;
        const [a, b] = [...pointers.values()];
        pinchGesture.current = {
          distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          zoom: crop.zoom,
          centerX: (a.x + b.x) / 2,
          centerY: (a.y + b.y) / 2,
        };
        beginHistoryTransaction();
      }
      return;
    }
    // In every other tab, pressing and holding the photo drops the filter and
    // shows the original framing until release.
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setCompare(true);
  }

  function beginPan(event) {
    if (!cropGeometry) return;
    event.preventDefault();
    beginHistoryTransaction();
    stageRect.current = event.currentTarget.getBoundingClientRect();
    panGesture.current = { x: event.clientX, y: event.clientY };
  }

  function moveStagePointer(event) {
    const pointers = stagePointers.current;
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (pinchGesture.current && pointers.size >= 2) {
      const geometry = cropGeometryRef.current;
      if (!geometry || !stageRect.current) return;
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const centerX = (a.x + b.x) / 2;
      const centerY = (a.y + b.y) / 2;
      const start = pinchGesture.current;
      const nextZoom = clamp(
        (start.zoom * distance) / start.distance,
        1,
        3,
      );
      const horizontalRange = geometry.orientedWidth - geometry.width;
      const verticalRange = geometry.orientedHeight - geometry.height;
      const rect = stageRect.current;
      const offsetXPerPixel =
        horizontalRange > 0
          ? (2 * geometry.width) / (rect.width * horizontalRange)
          : 0;
      const offsetYPerPixel =
        verticalRange > 0
          ? (2 * geometry.height) / (rect.height * verticalRange)
          : 0;
      pinchGesture.current = { ...start, centerX, centerY };
      setCrop((previous) => ({
        ...previous,
        zoom: nextZoom,
        offsetX: clamp(
          previous.offsetX - (centerX - start.centerX) * offsetXPerPixel,
          -1,
          1,
        ),
        offsetY: clamp(
          previous.offsetY - (centerY - start.centerY) * offsetYPerPixel,
          -1,
          1,
        ),
      }));
      return;
    }

    if (!panGesture.current || !pointers.has(event.pointerId)) return;
    const gesture = panGesture.current;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    const geometry = cropGeometryRef.current;
    if (!geometry || !stageRect.current) return;
    const horizontalRange = geometry.orientedWidth - geometry.width;
    const verticalRange = geometry.orientedHeight - geometry.height;
    const rect = stageRect.current;
    setCrop((previous) => ({
      ...previous,
      offsetX: clamp(
        previous.offsetX -
          (dx *
            (horizontalRange > 0
              ? (2 * geometry.width) / (rect.width * horizontalRange)
              : 0)),
        -1,
        1,
      ),
      offsetY: clamp(
        previous.offsetY -
          (dy *
            (verticalRange > 0
              ? (2 * geometry.height) / (rect.height * verticalRange)
              : 0)),
        -1,
        1,
      ),
    }));
  }

  function handleStagePointerEnd(event) {
    if (tab === "crop") {
      stagePointers.current.delete(event.pointerId);
      if (stagePointers.current.size === 0) {
        pinchGesture.current = null;
        panGesture.current = null;
        endHistoryTransaction();
      } else if (stagePointers.current.size === 1) {
        // The pinch ended; keep panning with whichever finger remains.
        pinchGesture.current = null;
        const [remaining] = [...stagePointers.current.values()];
        panGesture.current = { x: remaining.x, y: remaining.y };
      }
      return;
    }
    setCompare(false);
  }

  function startPreset(filter) {
    recordEdit();
    setSelectedId(filter.id);
    setRecipe({ ...filter.recipe });
    setIntensity(filter.tier === "custom" ? 100 : THUMB_INTENSITY);
    setHsl(filter.hsl ? { ...createHsl(), ...filter.hsl } : createHsl());
  }

  function loadFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("Please choose an image file.");
      return;
    }
    const requestId = ++loadSequence.current;
    const nextUrl = URL.createObjectURL(file);
    persistedPhoto.current = null;
    fileToPersistableUrl(file).then((dataUrl) => {
      if (requestId === loadSequence.current) persistedPhoto.current = dataUrl;
    });
    const nextImage = new Image();
    nextImage.onload = () => {
      if (requestId !== loadSequence.current) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      if (currentObjectUrl.current)
        URL.revokeObjectURL(currentObjectUrl.current);
      currentObjectUrl.current = nextUrl;
      setPhotoUrl(nextUrl);
      setPhotoName(file.name.replace(/\.[^.]+$/, ""));
      setImage(nextImage);
      setCrop({ ...INITIAL_CROP });
      clearHistory();
      setLoading(false);
      setCompare(false);
      notify("Photo ready — it stays on your device.");
    };
    nextImage.onerror = () => {
      URL.revokeObjectURL(nextUrl);
      if (requestId !== loadSequence.current) return;
      notify("Could not open that photo. Try a JPG, PNG, or WebP.");
    };
    nextImage.src = nextUrl;
  }

  function handleFileChange(event) {
    loadFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    loadFile(event.dataTransfer.files?.[0]);
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function updateAdjustment(key, value) {
    beginHistoryTransaction();
    setRecipe((previous) => ({ ...previous, [key]: value }));
  }

  function resetRecipe() {
    recordEdit();
    setRecipe({ ...activeFilter.recipe });
    setIntensity(activeFilter.tier === "custom" ? 100 : THUMB_INTENSITY);
    setHsl(activeFilter.hsl ? { ...createHsl(), ...activeFilter.hsl } : createHsl());
    notify("Back to the original recipe.");
  }

  function openAdjust() {
    setTab("adjust");
  }

  function saveCurrentAsPreset(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const preset = {
      id: `custom-${Date.now().toString(36)}`,
      code: trimmed,
      name: trimmed,
      mood: "Your saved look",
      tier: "custom",
      swatch: "#cfc7b4",
      recipe: { ...recipe },
      hsl: { ...hsl },
    };
    const next = [...customPresets, preset];
    setCustomPresets(next);
    savePresets(next);
    setSelectedId(preset.id);
    setPresetDialog(null);
    notify(`Saved “${trimmed}”.`);
  }

  function renamePreset(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = customPresets.map((preset) =>
      preset.id === id
        ? { ...preset, code: trimmed, name: trimmed }
        : preset,
    );
    setCustomPresets(next);
    savePresets(next);
    setPresetDialog(null);
    notify("Preset renamed.");
  }

  function deletePreset(id) {
    const next = customPresets.filter((preset) => preset.id !== id);
    setCustomPresets(next);
    savePresets(next);
    if (selectedId === id) startPreset(FILTERS[0]);
    notify("Preset deleted.");
  }

  function openExport() {
    setLargeExportEdge(
      window.matchMedia("(max-width: 768px)").matches ? 3200 : 5000,
    );
    setExportOpen(true);
  }

  async function exportImage() {
    if (!image || exporting) return;
    setExporting(true);
    setExportOpen(false);
    notify("Preparing your photo…");
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    const maxEdge = exportSize === "web" ? 2500 : largeExportEdge;
    const exportCanvas = document.createElement("canvas");
    try {
      let lastReported = 0;
      await renderFilteredAsync(
        image,
        exportCanvas,
        effectiveRecipe,
        maxEdge,
        (progress) => {
          // Report in ~10% steps so the toast doesn't re-render the app for
          // every 128-pixel strip.
          if (progress - lastReported >= 10 || progress >= 100) {
            lastReported = progress;
            notify(`Processing locally… ${progress}%`);
          }
        },
        crop,
        effectiveHsl,
      );
      const mime = exportFormat === "png" ? "image/png" : "image/jpeg";
      const quality = exportFormat === "png" ? undefined : 0.94;
      if (exportFormat === "jpg") {
        const context = exportCanvas.getContext("2d");
        context.globalCompositeOperation = "destination-over";
        context.fillStyle = "#fff";
        context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      }
      const blob = await new Promise((resolve) =>
        exportCanvas.toBlob(resolve, mime, quality),
      );
      if (!blob) throw new Error("The browser could not encode this photo.");
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      const lookSlug = slugify(activeFilter.code || activeFilter.name);
      anchor.download = `${photoName || "stillroom-edit"}${lookSlug ? `-${lookSlug}` : ""}.${exportFormat}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 30000);
      notify("Export saved to your downloads.");
    } catch (error) {
      console.error("Could not export image", error);
      notify("Export failed. Try a smaller photo or web size.");
    } finally {
      setExporting(false);
      exportCanvas.width = 1;
      exportCanvas.height = 1;
    }
  }

  const aspectLabel = cropGeometry
    ? `${cropGeometry.ratio > 1.04 ? "Landscape" : cropGeometry.ratio < 0.96 ? "Portrait" : "Square"} · ${
        crop.ratio === "original"
          ? `Original · ${simplifyRatio(cropGeometry.width, cropGeometry.height)}`
          : crop.ratio
      }`
    : "";
  const presetIndex = allFilters.findIndex((filter) => filter.id === selectedId);
  const filterCount = allFilters.length;

  return (
    <div className="app-shell" onDragOver={(event) => event.preventDefault()}>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={handleFileChange}
      />

      <header className="topbar">
        <div className="top-start">
          <button
            className="top-import"
            type="button"
            onClick={openPicker}
            aria-label="Import a photo"
          >
            <ImagePlus size={19} strokeWidth={1.8} />
            <span>Import</span>
          </button>
          <div className="history-tools" aria-label="Edit history">
            <button
              className="history-button"
              type="button"
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
              disabled={!historyFlags.canUndo}
              onClick={undoEdit}
            >
              <Undo2 size={17} />
            </button>
            <button
              className="history-button"
              type="button"
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
              disabled={!historyFlags.canRedo}
              onClick={redoEdit}
            >
              <Redo2 size={17} />
            </button>
          </div>
        </div>
        <a className="brand" href="#top" aria-label="Stillroom home">
          <LogoMark />
          <span>STILLROOM</span>
        </a>
        <button
          className="top-export"
          type="button"
          onClick={openExport}
          disabled={!image || exporting}
        >
          {exporting ? "Saving…" : "Export"}
        </button>
      </header>

      <main id="top" className="editor">
        <section
          ref={stageWrapRef}
          className={`stage-wrap ${dragging ? "is-dragging" : ""}`}
          onDrop={handleDrop}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (event.target === event.currentTarget) setDragging(false);
          }}
        >
          {image ? (
            <div
              className={`photo-stage ${tab === "crop" ? "is-cropping" : ""} ${compare ? "is-comparing" : ""}`}
              style={{
                "--photo-ratio": cropGeometry ? cropGeometry.ratio : 0.8,
                ...(fittedStage ?? {}),
              }}
              onPointerDown={handleStagePointerDown}
              onPointerMove={moveStagePointer}
              onPointerUp={handleStagePointerEnd}
              onPointerCancel={handleStagePointerEnd}
              onContextMenu={(event) => event.preventDefault()}
            >
              <canvas
                ref={originalCanvasRef}
                className="original-framing"
                aria-label="Original photo framing"
              />
              <canvas
                ref={canvasRef}
                className={`processed-photo ${compare ? "is-hidden" : ""}`}
                aria-label={`${activeFilter.name} filter preview`}
              />
              {compare && <div className="compare-tag">Original</div>}
              {dragging && (
                <div className="drop-hint">
                  <ImagePlus size={28} />
                  Drop a photo to open
                </div>
              )}
            </div>
          ) : (
            <button className="empty-stage" type="button" onClick={openPicker}>
              <ImagePlus size={38} strokeWidth={1.4} />
              <span>
                {loading ? "Opening your example…" : "Add a photo to begin"}
              </span>
            </button>
          )}
          {image && tab === "crop" && cropGeometry && (
            <div className="image-meta">{aspectLabel}</div>
          )}
          {image && (
            <div className="stage-caption">
              {tab === "crop"
                ? "Drag to reposition · pinch to zoom"
                : "Hold the photo to compare"}
            </div>
          )}
        </section>

        <section className="dock">
          <section className="filter-intro" aria-live="polite">
            <div className="filter-heading">
              <div>
                <div className="eyebrow">
                  {image
                    ? `PRESET  ${pad(Math.max(presetIndex + 1, 1))} / ${pad(filterCount)}`
                    : "LOCAL PHOTO EDITOR"}
                </div>
                <h1>{image ? activeFilter.name : "Stillroom"}</h1>
                <p>
                  {image
                    ? activeFilter.mood
                    : "Import a photo to begin — everything stays on this device."}
                </p>
              </div>
              {image && (
                <div className="intensity-number">
                  {activeFilter.tier === "original" ? "—" : intensity}
                </div>
              )}
            </div>
            {image && (
              <EditSlider
                id="intensity-range"
                variant="row"
                label="Intensity"
                min={0}
                max={100}
                step={1}
                value={intensity}
                display={
                  activeFilter.tier === "original" ? "—" : `${intensity}%`
                }
                disabled={activeFilter.tier === "original"}
                onChange={(value) => {
                  if (activeFilter.tier === "original") return;
                  setIntensity(value);
                }}
                beginEdit={beginHistoryTransaction}
                endEdit={endHistoryTransaction}
              />
            )}
          </section>

          {image && tab === "filters" && (
            <section
              className="quick-controls"
              aria-label="Quick adjustment controls"
            >
              {QUICK_SETTINGS.map(({ key, label, Icon }, index) => (
                <button
                  className="quick-control"
                  type="button"
                  key={key}
                  onClick={openAdjust}
                >
                  <Icon size={24} strokeWidth={1.65} />
                  <span className="quick-copy">
                    <span>{label}</span>
                    <strong>
                      {key !== "grain" && recipe[key] > 0 ? "+" : ""}
                      {recipe[key]}
                    </strong>
                  </span>
                  {index < QUICK_SETTINGS.length - 1 && <i aria-hidden="true" />}
                </button>
              ))}
            </section>
          )}

          <section className="tool-panel">
            <div className="tabbar" role="tablist" aria-label="Editing tools">
              <button
                type="button"
                role="tab"
                id="tab-filters"
                aria-controls="panel-filters"
                aria-selected={tab === "filters"}
                className={tab === "filters" ? "active" : ""}
                onClick={() => setTab("filters")}
              >
                Presets
              </button>
              <button
                type="button"
                role="tab"
                id="tab-crop"
                aria-controls="panel-crop"
                aria-selected={tab === "crop"}
                className={tab === "crop" ? "active" : ""}
                onClick={() => setTab("crop")}
              >
                Crop
              </button>
              <button
                type="button"
                role="tab"
                id="tab-adjust"
                aria-controls="panel-adjust"
                aria-selected={tab === "adjust"}
                className={tab === "adjust" ? "active" : ""}
                onClick={() => setTab("adjust")}
              >
                Adjust
              </button>
              <button
                type="button"
                className="edit-action tabbar-save"
                onClick={() => setPresetDialog({ mode: "save" })}
                disabled={!image}
              >
                <Plus size={14} /> Save look
              </button>
            </div>

            <div className="panel-area">
              {tab === "filters" ? (
                <div
                  className="filter-strip"
                  id="panel-filters"
                  role="tabpanel"
                  aria-label="Presets"
                  aria-labelledby="tab-filters"
                >
                  {allFilters.map((filter) => (
                    <div className="filter-item" key={filter.id}>
                      <button
                        className={`filter-card ${selectedId === filter.id ? "selected" : ""}`}
                        type="button"
                        aria-label={filter.name}
                        aria-pressed={selectedId === filter.id}
                        onClick={() => startPreset(filter)}
                      >
                        <span
                          className="filter-thumb"
                          style={filter.swatch ? { background: filter.swatch } : undefined}
                        >
                          {(thumbnails[filter.id] || photoUrl) && (
                            <img
                              src={thumbnails[filter.id] || photoUrl}
                              alt=""
                              draggable="false"
                            />
                          )}
                          {selectedId === filter.id && (
                            <span className="selected-check">
                              <Check size={12} strokeWidth={2.4} />
                            </span>
                          )}
                        </span>
                        <span className="filter-card-label">{filter.name}</span>
                      </button>
                      {filter.tier === "custom" && (
                        <div className="preset-tools">
                          <button
                            type="button"
                            aria-label={`Rename ${filter.name}`}
                            onClick={() =>
                              setPresetDialog({
                                mode: "rename",
                                id: filter.id,
                                value: filter.name,
                              })
                            }
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${filter.name}`}
                            onClick={() => deletePreset(filter.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : tab === "adjust" ? (
                <div
                  className="adjust-panel"
                  role="tabpanel"
                  id="panel-adjust"
                  aria-labelledby="tab-adjust"
                >
                  <div className="panel-toolbar">
                    <span className="crop-section-label">FINE-TUNE</span>
                    <button
                      type="button"
                      className="reset-button"
                      onClick={resetRecipe}
                    >
                      <RotateCcw size={13} /> Reset
                    </button>
                  </div>
                  <div className="adjustment-grid">
                    {ADJUSTMENTS.map((adjustment) => (
                      <EditSlider
                        key={adjustment.key}
                        label={adjustment.label}
                        min={adjustment.min}
                        max={adjustment.max}
                        step={adjustment.step}
                        value={recipe[adjustment.key]}
                        display={adjustment.display(recipe[adjustment.key])}
                        onChange={(value) =>
                          updateAdjustment(adjustment.key, value)
                        }
                        beginEdit={beginHistoryTransaction}
                        endEdit={endHistoryTransaction}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className="crop-panel"
                  role="tabpanel"
                  id="panel-crop"
                  aria-labelledby="tab-crop"
                >
                  <div className="crop-section-label">FRAME</div>
                  <div
                    className="crop-ratios"
                    role="group"
                    aria-label="Crop aspect ratio"
                  >
                    {CROP_RATIOS.map((ratio) => (
                      <button
                        key={ratio.value}
                        type="button"
                        className={`ratio-button ${crop.ratio === ratio.value ? "selected" : ""}`}
                        aria-pressed={crop.ratio === ratio.value}
                        onClick={() => chooseCropRatio(ratio.value)}
                      >
                        {ratio.label}
                      </button>
                    ))}
                  </div>
                  <div className="crop-tools">
                    <button
                      type="button"
                      className="crop-tool-button"
                      aria-label="Rotate left"
                      onClick={() => rotateCrop(-90)}
                    >
                      <RotateCcw size={17} />
                      <span>Rotate left</span>
                    </button>
                    <button
                      type="button"
                      className="crop-tool-button"
                      aria-label="Rotate right"
                      onClick={() => rotateCrop(90)}
                    >
                      <RotateCw size={17} />
                      <span>Rotate right</span>
                    </button>
                    <button
                      type="button"
                      className="crop-tool-button"
                      aria-label="Flip horizontally"
                      aria-pressed={crop.flipH}
                      onClick={() => flipCrop("horizontal")}
                    >
                      <FlipHorizontal2 size={17} />
                      <span>Flip H</span>
                    </button>
                    <button
                      type="button"
                      className="crop-tool-button"
                      aria-label="Flip vertically"
                      aria-pressed={crop.flipV}
                      onClick={() => flipCrop("vertical")}
                    >
                      <FlipVertical2 size={17} />
                      <span>Flip V</span>
                    </button>
                    <button
                      type="button"
                      className="reset-button crop-reset"
                      onClick={resetCrop}
                    >
                      Reset framing
                    </button>
                  </div>
                  <EditSlider
                    id="crop-straighten-range"
                    variant="row"
                    label="Straighten"
                    min={-45}
                    max={45}
                    step={0.5}
                    value={crop.straighten}
                    display={`${crop.straighten.toFixed(1)}°`}
                    onChange={(value) => updateCrop("straighten", value)}
                    beginEdit={beginHistoryTransaction}
                    endEdit={endHistoryTransaction}
                  />
                  <EditSlider
                    id="crop-zoom-range"
                    variant="row"
                    label="Zoom"
                    min={1}
                    max={3}
                    step={0.01}
                    value={crop.zoom}
                    display={`${crop.zoom.toFixed(2)}×`}
                    onChange={(value) => updateCrop("zoom", value)}
                    beginEdit={beginHistoryTransaction}
                    endEdit={endHistoryTransaction}
                  />
                </div>
              )}
            </div>
          </section>

          <div className="privacy-note">
            <span className="privacy-dot" />
            Your photo stays in this browser
          </div>
          {DEMO_URL && (
            <p className="photo-credit">Demo sample photo provided by the author.</p>
          )}
        </section>
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {presetDialog && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setPresetDialog(null)}
        >
          <section
            ref={presetSheetRef}
            className="export-sheet preset-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preset-title"
            style={presetDrag.sheetStyle}
            {...presetDrag.dragProps}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-grab" />
            <div className="sheet-heading">
              <div>
                <span className="eyebrow">
                  {presetDialog.mode === "rename" ? "RENAME" : "KEEP THIS LOOK"}
                </span>
                <h2 id="preset-title">
                  {presetDialog.mode === "rename"
                    ? "Rename preset"
                    : "Save this look"}
                </h2>
              </div>
              <button
                type="button"
                className="close-sheet"
                onClick={() => setPresetDialog(null)}
                aria-label="Close preset dialog"
              >
                <X size={20} />
              </button>
            </div>
            <p className="sheet-description">
              Saved looks appear alongside the built-in presets and stay in this
              browser.
            </p>
            <label className="preset-name-field">
              <span>Preset name</span>
              <input
                ref={presetNameRef}
                type="text"
                defaultValue={presetDialog.value || ""}
                maxLength={28}
                placeholder="Morning window"
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (presetDialog.mode === "rename") {
                    renamePreset(presetDialog.id, event.currentTarget.value);
                  } else {
                    saveCurrentAsPreset(event.currentTarget.value);
                  }
                }}
              />
            </label>
            <button
              className="confirm-export"
              type="button"
              onClick={() => {
                const value = presetNameRef.current?.value ?? "";
                if (presetDialog.mode === "rename") {
                  renamePreset(presetDialog.id, value);
                } else {
                  saveCurrentAsPreset(value);
                }
              }}
            >
              <Check size={18} />
              {presetDialog.mode === "rename" ? "Rename preset" : "Save look"}
            </button>
          </section>
        </div>
      )}

      {exportOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setExportOpen(false)}
        >
          <section
            ref={exportSheetRef}
            className="export-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
            style={exportDrag.sheetStyle}
            {...exportDrag.dragProps}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-grab" />
            <div className="sheet-heading">
              <div>
                <span className="eyebrow">READY WHEN YOU ARE</span>
                <h2 id="export-title">Export your edit</h2>
              </div>
              <button
                type="button"
                className="close-sheet"
                onClick={() => setExportOpen(false)}
                aria-label="Close export options"
              >
                <X size={20} />
              </button>
            </div>
            <p className="sheet-description">
              A finished copy of <strong>{photoName}</strong> will be saved to
              your downloads.
            </p>
            <div className="option-label">FILE TYPE</div>
            <div className="choice-row">
              <button
                type="button"
                className={`choice-card ${exportFormat === "jpg" ? "chosen" : ""}`}
                onClick={() => setExportFormat("jpg")}
              >
                <span>JPG</span>
                <small>Smaller file · high quality</small>
                {exportFormat === "jpg" && <Check size={16} />}
              </button>
              <button
                type="button"
                className={`choice-card ${exportFormat === "png" ? "chosen" : ""}`}
                onClick={() => setExportFormat("png")}
              >
                <span>PNG</span>
                <small>Lossless · larger file</small>
                {exportFormat === "png" && <Check size={16} />}
              </button>
            </div>
            <div className="option-label">IMAGE SIZE</div>
            <div className="choice-row">
              <button
                type="button"
                className={`choice-card size-card ${exportSize === "original" ? "chosen" : ""}`}
                onClick={() => setExportSize("original")}
              >
                <span>Large</span>
                <small>Up to {largeExportEdge} px</small>
                {exportSize === "original" && <Check size={16} />}
              </button>
              <button
                type="button"
                className={`choice-card size-card ${exportSize === "web" ? "chosen" : ""}`}
                onClick={() => setExportSize("web")}
              >
                <span>Web</span>
                <small>Up to 2500 px</small>
                {exportSize === "web" && <Check size={16} />}
              </button>
            </div>
            <button
              className="confirm-export"
              type="button"
              onClick={exportImage}
            >
              <Download size={18} /> Save {exportFormat.toUpperCase()} to device
            </button>
            <p className="local-export-note">
              <Sun size={14} /> Processed locally in your browser. Nothing is
              uploaded.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function simplifyRatio(width, height) {
  if (!width || !height) return "1:1";
  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) < 0.04) return "9:16";
  if (Math.abs(ratio - 16 / 9) < 0.04) return "16:9";
  if (Math.abs(ratio - 2 / 3) < 0.04) return "2:3";
  if (Math.abs(ratio - 4 / 5) < 0.04) return "4:5";
  if (Math.abs(ratio - 3 / 2) < 0.04) return "3:2";
  if (Math.abs(ratio - 1) < 0.04) return "1:1";
  return `${Math.round(ratio * 100) / 100}:1`;
}

export default App;
