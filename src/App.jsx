import { useEffect, useMemo, useRef, useState } from "react";
import {
  Aperture,
  Check,
  ChevronLeft,
  ClipboardPaste,
  Contrast,
  Copy,
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
import {
  ADJUSTMENTS,
  ADJUSTMENT_GROUPS,
  createHsl,
  FILTERS,
  HSL_CHANNELS,
  HSL_CONTROLS,
  isHslNeutral,
  SPLIT_TONE_CONTROLS,
} from "./filters.js";
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
const ADJUST_TABS = [
  ...ADJUSTMENT_GROUPS,
  { id: "grade", label: "Grade" },
  { id: "hsl", label: "HSL" },
];
const pad = (value) => String(value).padStart(2, "0");
const tierLabel = (tier) =>
  tier === "pro" ? "Pro" : tier === "custom" ? "Saved" : "Free";

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

function App() {
  const [image, setImage] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(DEMO_URL);
  const [photoName, setPhotoName] = useState(
    DEMO_URL ? "User-provided demo sample" : "",
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
  const [adjustGroup, setAdjustGroup] = useState("light");
  const [hslChannel, setHslChannel] = useState(HSL_CHANNELS[0].id);
  const [compare, setCompare] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("jpg");
  const [exportSize, setExportSize] = useState("original");
  const [exporting, setExporting] = useState(false);
  const [largeExportEdge] = useState(() =>
    window.matchMedia("(max-width: 768px)").matches ? 3200 : 5000,
  );
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [thumbnails, setThumbnails] = useState({});
  const [clipboard, setClipboard] = useState(null);
  const [presetDialog, setPresetDialog] = useState(null);
  const canvasRef = useRef(null);
  const originalCanvasRef = useRef(null);
  const inputRef = useRef(null);
  const exportSheetRef = useRef(null);
  const presetNameRef = useRef(null);
  const loadSequence = useRef(0);
  const currentObjectUrl = useRef(null);
  const persistedPhoto = useRef(null);
  const historyRef = useRef({ past: [], future: [] });
  const historyTransaction = useRef(false);
  const cropDrag = useRef(null);
  const thumbToken = useRef(0);
  const keyHandlerRef = useRef(() => {});
  const keyUpHandlerRef = useRef(() => {});
  const notifiedStorage = useRef(false);

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
          past: session.history.past.slice(-40),
          future: Array.isArray(session.history.future)
            ? session.history.future.slice(-40)
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
        past: historyRef.current.past.slice(-40),
        future: historyRef.current.future.slice(-40),
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

  // ── Preview render.
  useEffect(() => {
    if (!image || !canvasRef.current || !originalCanvasRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        renderFiltered(
          image,
          originalCanvasRef.current,
          ZERO_RECIPE,
          1500,
          crop,
        );
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

  // ── Thumbnails are generated one at a time so a large library never blocks.
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
    timer = window.setTimeout(pump, 40);
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

  useEffect(() => {
    if (!exportOpen) return undefined;
    const previousFocus = document.activeElement;
    const sheet = exportSheetRef.current;
    sheet?.querySelector("button")?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setExportOpen(false);
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
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, [exportOpen]);

  useEffect(() => {
    if (!presetDialog) return undefined;
    const previousFocus = document.activeElement;
    window.setTimeout(() => {
      presetNameRef.current?.focus();
      presetNameRef.current?.select();
    }, 30);
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPresetDialog(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, [presetDialog]);

  // ── Keyboard shortcuts. Handlers live in refs so the listener stays attached.
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
      if (image && !exporting) setExportOpen(true);
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
    historyRef.current.past = [...historyRef.current.past, captureEdit()].slice(
      -40,
    );
    historyRef.current.future = [];
    historyTransaction.current = false;
    syncHistoryFlags();
  }

  function beginHistoryTransaction() {
    if (!historyTransaction.current) {
      historyRef.current.past = [
        ...historyRef.current.past,
        captureEdit(),
      ].slice(-40);
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
    historyRef.current.past = [...historyRef.current.past, captureEdit()].slice(
      -40,
    );
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

  function beginCropPan(event) {
    if (tab !== "crop" || event.button > 0 || !cropGeometry) return;
    event.preventDefault();
    beginHistoryTransaction();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const horizontalRange = cropGeometry.orientedWidth - cropGeometry.width;
    const verticalRange = cropGeometry.orientedHeight - cropGeometry.height;
    cropDrag.current = {
      x: event.clientX,
      y: event.clientY,
      offsetXPerPixel:
        horizontalRange > 0
          ? (2 * cropGeometry.width) / (rect.width * horizontalRange)
          : 0,
      offsetYPerPixel:
        verticalRange > 0
          ? (2 * cropGeometry.height) / (rect.height * verticalRange)
          : 0,
    };
  }

  function moveCropPan(event) {
    if (!cropDrag.current) return;
    const dx = event.clientX - cropDrag.current.x;
    const dy = event.clientY - cropDrag.current.y;
    cropDrag.current.x = event.clientX;
    cropDrag.current.y = event.clientY;
    setCrop((previous) => ({
      ...previous,
      offsetX: Math.max(
        -1,
        Math.min(
          1,
          previous.offsetX - dx * cropDrag.current.offsetXPerPixel,
        ),
      ),
      offsetY: Math.max(
        -1,
        Math.min(
          1,
          previous.offsetY - dy * cropDrag.current.offsetYPerPixel,
        ),
      ),
    }));
  }

  function finishCropPan() {
    cropDrag.current = null;
    endHistoryTransaction();
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
    setRecipe((previous) => ({ ...previous, [key]: Number(value) }));
  }

  function updateSplit(key, value) {
    beginHistoryTransaction();
    setRecipe((previous) => ({ ...previous, [key]: Number(value) }));
  }

  function updateHsl(channel, key, value) {
    beginHistoryTransaction();
    setHsl((previous) => ({
      ...previous,
      [channel]: { ...previous[channel], [key]: Number(value) },
    }));
  }

  function resetRecipe() {
    recordEdit();
    setRecipe({ ...activeFilter.recipe });
    setIntensity(activeFilter.tier === "custom" ? 100 : THUMB_INTENSITY);
    setHsl(activeFilter.hsl ? { ...createHsl(), ...activeFilter.hsl } : createHsl());
    notify("Back to the original recipe.");
  }

  function openAdjust(key) {
    const adjustment = ADJUSTMENTS.find((item) => item.key === key);
    setTab("adjust");
    setAdjustGroup(adjustment?.group ?? "light");
    window.setTimeout(
      () =>
        document
          .getElementById(`adjust-${key}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      80,
    );
  }

  function copyEdits() {
    setClipboard({
      recipe: { ...recipe },
      hsl: { ...hsl },
      crop: { ...crop },
      intensity,
    });
    notify("Edit copied — paste it onto another photo.");
  }

  function pasteEdits() {
    if (!clipboard) return;
    recordEdit();
    setRecipe({ ...clipboard.recipe });
    setHsl({ ...createHsl(), ...clipboard.hsl });
    setCrop({ ...clipboard.crop });
    setIntensity(clipboard.intensity);
    notify("Edit pasted.");
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

  async function exportImage() {
    if (!image || exporting) return;
    setExporting(true);
    setExportOpen(false);
    notify("Preparing your photo…");
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    const maxEdge = exportSize === "web" ? 2500 : largeExportEdge;
    const exportCanvas = document.createElement("canvas");
    try {
      await renderFilteredAsync(
        image,
        exportCanvas,
        effectiveRecipe,
        maxEdge,
        (progress) => notify(`Processing locally… ${progress}%`),
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
      anchor.download = `${photoName || "stillroom-edit"}-${activeFilter.id}.${exportFormat}`;
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

  const aspectLabel = cropGeometry    ? `${cropGeometry.ratio > 1.04 ? "Landscape" : cropGeometry.ratio < 0.96 ? "Portrait" : "Square"} · ${crop.ratio === "original" ? `Original · ${simplifyRatio(cropGeometry.width, cropGeometry.height)}` : crop.ratio}`
    : "Portrait · Original";
  const presetIndex = allFilters.findIndex((filter) => filter.id === selectedId);
  const activeHsl = hsl[hslChannel];

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
            <ChevronLeft size={20} strokeWidth={1.8} />
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
          onClick={() => setExportOpen(true)}
          disabled={!image || exporting}
        >
          {exporting ? "Saving…" : "Export"}
        </button>
      </header>

      <main id="top" className="editor">
        <div className="image-meta">
          <span>{aspectLabel}</span>
        </div>
        <section
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
              className={`photo-stage ${tab === "crop" ? "is-cropping" : ""}`}
              style={{
                aspectRatio: `${cropGeometry.ratio}`,
                "--photo-ratio": cropGeometry.ratio,
              }}
              onPointerDown={beginCropPan}
              onPointerMove={moveCropPan}
              onPointerUp={finishCropPan}
              onPointerCancel={finishCropPan}
            >
              <img
                className="original-photo source-only"
                src={photoUrl}
                alt={photoName}
                draggable="false"
                aria-hidden="true"
              />
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
              {tab !== "crop" && (
                <button
                  className={`compare-button ${compare ? "compare-active" : ""}`}
                  type="button"
                  aria-label={
                    compare
                      ? "Showing original; release to see the edit"
                      : "Hold to compare with original"
                  }
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    setCompare(true);
                  }}
                  onPointerUp={() => setCompare(false)}
                  onPointerCancel={() => setCompare(false)}
                  onPointerLeave={() => setCompare(false)}
                  onContextMenu={(event) => event.preventDefault()}
                  onKeyDown={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      setCompare(true);
                    }
                  }}
                  onKeyUp={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      setCompare(false);
                    }
                  }}
                  onBlur={() => setCompare(false)}
                  aria-pressed={compare}
                >
                  <span className="compare-symbol">
                    <span />
                  </span>
                </button>
              )}
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
        </section>
        <div className="compare-caption">
          {tab === "crop" ? "Drag to reposition" : "Hold to compare"}
        </div>

        <section className="filter-intro" aria-live="polite">
          <div className="filter-heading">
            <div>
              <div className="eyebrow">
                <span
                  className={`tier-chip tier-${activeFilter.tier}`}
                  title={
                    activeFilter.tier === "pro"
                      ? "A subscription look in VSCO — free here"
                      : activeFilter.tier === "custom"
                        ? "Your saved look"
                        : "A free VSCO look"
                  }
                >
                  {tierLabel(activeFilter.tier)}
                </span>
                PRESET&nbsp; {pad(Math.max(presetIndex + 1, 1))} /{" "}
                {pad(allFilters.length)}
              </div>
              <h1>{activeFilter.name}</h1>
              <p>{activeFilter.mood}</p>
            </div>
            <div className="intensity-number">{intensity}</div>
          </div>
          <label className="intensity-control" htmlFor="intensity-range">
            <span>Intensity</span>
            <input
              id="intensity-range"
              type="range"
              min="0"
              max="100"
              value={intensity}
              onChange={(event) => {
                beginHistoryTransaction();
                setIntensity(Number(event.target.value));
              }}
              onPointerDown={beginHistoryTransaction}
              onKeyDown={beginHistoryTransaction}
              onPointerUp={endHistoryTransaction}
              onKeyUp={endHistoryTransaction}
              onBlur={endHistoryTransaction}
              style={{ "--range-fill": `${intensity}%` }}
              aria-valuetext={`${intensity}%`}
            />
            <output>{intensity}%</output>
          </label>
        </section>

        <section
          className="quick-controls"
          aria-label="Quick adjustment controls"
        >
          {QUICK_SETTINGS.map(({ key, label, Icon }, index) => (
            <button
              className="quick-control"
              type="button"
              key={key}
              onClick={() => openAdjust(key)}
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
          </div>

          <div className="edit-actions">
            <button
              type="button"
              className="edit-action"
              onClick={copyEdits}
              disabled={!image}
            >
              <Copy size={14} /> Copy edit
            </button>
            <button
              type="button"
              className="edit-action"
              onClick={pasteEdits}
              disabled={!clipboard}
            >
              <ClipboardPaste size={14} /> Paste
            </button>
            <button
              type="button"
              className="edit-action"
              onClick={() => setPresetDialog({ mode: "save" })}
              disabled={!image}
            >
              <Plus size={14} /> Save look
            </button>
            {tab === "adjust" && (
              <button
                className="reset-button"
                type="button"
                onClick={resetRecipe}
              >
                <RotateCcw size={14} /> Reset
              </button>
            )}
          </div>

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
                      <img
                        src={thumbnails[filter.id] || photoUrl}
                        alt=""
                        draggable="false"
                      />
                      <span
                        className={`tier-badge tier-${filter.tier}`}
                        aria-hidden="true"
                      >
                        {tierLabel(filter.tier)}
                      </span>
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
              <div
                className="subtabs"
                role="group"
                aria-label="Adjustment groups"
              >
                {ADJUST_TABS.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    className={`subtab ${adjustGroup === group.id ? "active" : ""}`}
                    aria-pressed={adjustGroup === group.id}
                    onClick={() => setAdjustGroup(group.id)}
                  >
                    {group.label}
                  </button>
                ))}
              </div>

              {adjustGroup === "hsl" ? (
                <div className="hsl-panel">
                  <div
                    className="hsl-channels"
                    role="group"
                    aria-label="HSL color channel"
                  >
                    {HSL_CHANNELS.map((channel) => (
                      <button
                        key={channel.id}
                        type="button"
                        className={`hsl-channel ${hslChannel === channel.id ? "active" : ""}`}
                        aria-pressed={hslChannel === channel.id}
                        onClick={() => setHslChannel(channel.id)}
                      >
                        <span
                          className="hsl-swatch"
                          style={{ background: channel.swatch }}
                        />
                        {channel.label}
                      </button>
                    ))}
                  </div>
                  <div className="adjustment-grid">
                    {HSL_CONTROLS.map((control) => {
                      const value = activeHsl[control.key];
                      const progress =
                        ((value - control.min) /
                          (control.max - control.min)) *
                        100;
                      return (
                        <label
                          className="adjustment-control"
                          id={`hsl-${hslChannel}-${control.key}`}
                          key={control.key}
                        >
                          <span className="adjustment-label">
                            {control.label}
                          </span>
                          <output>
                            {value > 0 ? "+" : ""}
                            {value}
                          </output>
                          <input
                            type="range"
                            min={control.min}
                            max={control.max}
                            step={control.step}
                            value={value}
                            onChange={(event) =>
                              updateHsl(
                                hslChannel,
                                control.key,
                                event.target.value,
                              )
                            }
                            onPointerDown={beginHistoryTransaction}
                            onKeyDown={beginHistoryTransaction}
                            onPointerUp={endHistoryTransaction}
                            onKeyUp={endHistoryTransaction}
                            onBlur={endHistoryTransaction}
                            style={{ "--range-fill": `${progress}%` }}
                            aria-label={`${hslChannel} ${control.label}`}
                            aria-valuetext={`${value > 0 ? "+" : ""}${value}`}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : adjustGroup === "grade" ? (
                <div className="adjustment-grid grade-grid">
                  {SPLIT_TONE_CONTROLS.map((control) => {
                    const strength = recipe[control.key];
                    const hue = recipe[control.hueKey];
                    return (
                      <div className="split-control" key={control.key}>
                        <label className="adjustment-control">
                          <span className="adjustment-label">
                            {control.label}
                          </span>
                          <output>{strength}</output>
                          <input
                            type="range"
                            min={control.min}
                            max={control.max}
                            step={control.step}
                            value={strength}
                            onChange={(event) =>
                              updateSplit(control.key, event.target.value)
                            }
                            onPointerDown={beginHistoryTransaction}
                            onKeyDown={beginHistoryTransaction}
                            onPointerUp={endHistoryTransaction}
                            onKeyUp={endHistoryTransaction}
                            onBlur={endHistoryTransaction}
                            style={{
                              "--range-fill": `${(strength / 100) * 100}%`,
                            }}
                            aria-label={control.label}
                            aria-valuetext={`${strength}`}
                          />
                        </label>
                        <label className="adjustment-control hue-control">
                          <span className="adjustment-label">Hue</span>
                          <output>{hue}&deg;</output>
                          <input
                            type="range"
                            min="0"
                            max="359"
                            step="1"
                            value={hue}
                            onChange={(event) =>
                              updateSplit(control.hueKey, event.target.value)
                            }
                            onPointerDown={beginHistoryTransaction}
                            onKeyDown={beginHistoryTransaction}
                            onPointerUp={endHistoryTransaction}
                            onKeyUp={endHistoryTransaction}
                            onBlur={endHistoryTransaction}
                            className="hue-range"
                            style={{ "--range-fill": `${(hue / 359) * 100}%` }}
                            aria-label={`${control.label} hue`}
                            aria-valuetext={`${hue} degrees`}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="adjustment-grid">
                  {ADJUSTMENTS.filter(
                    (adjustment) => adjustment.group === adjustGroup,
                  ).map((adjustment) => {
                    const value = recipe[adjustment.key];
                    const progress =
                      ((value - adjustment.min) /
                        (adjustment.max - adjustment.min)) *
                      100;
                    return (
                      <label
                        className="adjustment-control"
                        id={`adjust-${adjustment.key}`}
                        key={adjustment.key}
                      >
                        <span className="adjustment-label">
                          {adjustment.label}
                        </span>
                        <output>{adjustment.display(value)}</output>
                        <input
                          type="range"
                          min={adjustment.min}
                          max={adjustment.max}
                          step={adjustment.step}
                          value={value}
                          onChange={(event) =>
                            updateAdjustment(
                              adjustment.key,
                              event.target.value,
                            )
                          }
                          onPointerDown={beginHistoryTransaction}
                          onKeyDown={beginHistoryTransaction}
                          onPointerUp={endHistoryTransaction}
                          onKeyUp={endHistoryTransaction}
                          onBlur={endHistoryTransaction}
                          style={{ "--range-fill": `${progress}%` }}
                          aria-label={adjustment.label}
                          aria-valuetext={adjustment.display(value)}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
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
              <label className="crop-zoom" htmlFor="crop-straighten-range">
                <span>Straighten</span>
                <input
                  id="crop-straighten-range"
                  type="range"
                  min="-45"
                  max="45"
                  step="0.5"
                  value={crop.straighten}
                  aria-label="Straighten"
                  aria-valuetext={`${crop.straighten} degrees`}
                  onChange={(event) =>
                    updateCrop("straighten", Number(event.target.value))
                  }
                  onPointerDown={beginHistoryTransaction}
                  onKeyDown={beginHistoryTransaction}
                  onPointerUp={endHistoryTransaction}
                  onKeyUp={endHistoryTransaction}
                  onBlur={endHistoryTransaction}
                  style={{
                    "--range-fill": `${((crop.straighten + 45) / 90) * 100}%`,
                  }}
                />
                <output>{crop.straighten.toFixed(1)}&deg;</output>
              </label>
              <label className="crop-zoom" htmlFor="crop-zoom-range">
                <span>Zoom</span>
                <input
                  id="crop-zoom-range"
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={crop.zoom}
                  aria-label="Crop zoom"
                  aria-valuetext={`${crop.zoom.toFixed(2)} times`}
                  onChange={(event) =>
                    updateCrop("zoom", Number(event.target.value))
                  }
                  onPointerDown={beginHistoryTransaction}
                  onKeyDown={beginHistoryTransaction}
                  onPointerUp={endHistoryTransaction}
                  onKeyUp={endHistoryTransaction}
                  onBlur={endHistoryTransaction}
                  style={{ "--range-fill": `${((crop.zoom - 1) / 2) * 100}%` }}
                />
                <output>{crop.zoom.toFixed(2)}×</output>
              </label>
              <p className="crop-hint">
                Drag the photo to reposition it. All edits stay on this device.
              </p>
            </div>
          )}
        </section>

        <footer className="action-bar">
          <button className="add-photo" type="button" onClick={openPicker}>
            <ImagePlus size={27} strokeWidth={1.7} />
            <span>Add photo</span>
          </button>
          <button
            className="export-image"
            type="button"
            onClick={() => setExportOpen(true)}
            disabled={!image || exporting}
          >
            <Download size={19} />
            <span>{exporting ? "Processing…" : "Export image"}</span>
          </button>
        </footer>
        <div className="privacy-note">
          <span className="privacy-dot" />
          Your photo stays in this browser
        </div>
        {DEMO_URL && (
          <p className="photo-credit">
            Demo sample: user-provided image. Rights for public reuse have not
            been verified; this asset is included only in this local review
            build.
          </p>
        )}
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
            className="export-sheet preset-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preset-title"
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
              onClick={(event) => {
                const input = event.currentTarget.parentElement.querySelector(
                  ".preset-name-field input",
                );
                if (presetDialog.mode === "rename") {
                  renamePreset(presetDialog.id, input?.value ?? "");
                } else {
                  saveCurrentAsPreset(input?.value ?? "");
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
            <div className="size-row">
              <button
                type="button"
                className={exportSize === "original" ? "chosen" : ""}
                onClick={() => setExportSize("original")}
              >
                <span>Large</span>
                <small>Up to {largeExportEdge} px</small>
              </button>
              <button
                type="button"
                className={exportSize === "web" ? "chosen" : ""}
                onClick={() => setExportSize("web")}
              >
                <span>Web</span>
                <small>Up to 2500 px</small>
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
  if (!width || !height) return "4:5";
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
