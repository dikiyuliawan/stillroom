import { useEffect, useMemo, useRef, useState } from "react";
import {
  Aperture,
  Check,
  ChevronLeft,
  Contrast,
  Download,
  ImagePlus,
  RotateCcw,
  Sun,
  Thermometer,
  X,
} from "lucide-react";
import { ADJUSTMENTS, FILTERS } from "./filters.js";
import {
  renderFiltered,
  renderFilteredAsync,
  resolveRecipe,
} from "./image-processing.js";

const DEMO_URL = "/stillroom-demo-portrait.jpg";
const QUICK_SETTINGS = [
  { key: "temp", label: "Temp", Icon: Thermometer },
  { key: "contrast", label: "Contrast", Icon: Contrast },
  { key: "grain", label: "Grain", Icon: Aperture },
];

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
  const [photoName, setPhotoName] = useState("A moment in soft light");
  const [selectedId, setSelectedId] = useState(FILTERS[0].id);
  const [recipe, setRecipe] = useState({ ...FILTERS[0].recipe });
  const [intensity, setIntensity] = useState(72);
  const [tab, setTab] = useState("filters");
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
  const canvasRef = useRef(null);
  const inputRef = useRef(null);
  const exportSheetRef = useRef(null);
  const loadSequence = useRef(0);
  const currentObjectUrl = useRef(null);
  const activeFilter = useMemo(
    () => FILTERS.find((filter) => filter.id === selectedId) ?? FILTERS[0],
    [selectedId],
  );
  const effectiveRecipe = useMemo(
    () => resolveRecipe(activeFilter.recipe, recipe, intensity),
    [activeFilter, recipe, intensity],
  );

  useEffect(() => {
    const requestId = ++loadSequence.current;
    const demo = new Image();
    demo.onload = () => {
      if (requestId !== loadSequence.current) return;
      setImage(demo);
      setLoading(false);
    };
    demo.onerror = () => setLoading(false);
    demo.src = DEMO_URL;
    return () => {
      loadSequence.current += 1;
      if (currentObjectUrl.current)
        URL.revokeObjectURL(currentObjectUrl.current);
    };
  }, []);

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        renderFiltered(image, canvasRef.current, effectiveRecipe, 1500);
      } catch (error) {
        console.error("Could not preview this image", error);
        notify("This photo is too large to preview in this browser.");
      }
    }, 20);
    return () => window.clearTimeout(timer);
  }, [image, effectiveRecipe]);

  useEffect(() => {
    if (!image) return undefined;
    const timer = window.setTimeout(() => {
      const nextThumbnails = Object.fromEntries(
        FILTERS.map((filter) => {
          const thumbnail = document.createElement("canvas");
          renderFiltered(
            image,
            thumbnail,
            resolveRecipe(filter.recipe, filter.recipe, 72),
            180,
          );
          return [filter.id, thumbnail.toDataURL("image/png")];
        }),
      );
      setThumbnails(nextThumbnails);
    }, 30);
    return () => window.clearTimeout(timer);
  }, [image]);

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

  function notify(message) {
    setToast(message);
  }

  function chooseFilter(filter) {
    setSelectedId(filter.id);
    setRecipe({ ...filter.recipe });
    setIntensity(72);
  }

  function loadFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("Please choose an image file.");
      return;
    }
    const requestId = ++loadSequence.current;
    const nextUrl = URL.createObjectURL(file);
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
    setRecipe((previous) => ({ ...previous, [key]: Number(value) }));
  }

  function resetRecipe() {
    setRecipe({ ...activeFilter.recipe });
    setIntensity(72);
    notify("Back to the original recipe.");
  }

  function openAdjust(key) {
    setTab("adjust");
    window.setTimeout(
      () =>
        document
          .getElementById(`adjust-${key}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      80,
    );
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

  const aspectLabel = image
    ? `${image.naturalWidth > image.naturalHeight ? "Landscape" : image.naturalWidth < image.naturalHeight ? "Portrait" : "Square"} · ${simplifyRatio(image.naturalWidth, image.naturalHeight)}`
    : "Portrait · 4:5";

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
        <button
          className="top-import"
          type="button"
          onClick={openPicker}
          aria-label="Import a photo"
        >
          <ChevronLeft size={20} strokeWidth={1.8} />
          <span>Import</span>
        </button>
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
              className="photo-stage"
              role="button"
              tabIndex={0}
              aria-label={
                compare
                  ? "Showing original; release to see the edit"
                  : "Hold photo to see the original"
              }
              aria-pressed={compare}
              style={{
                aspectRatio: `${image.naturalWidth} / ${image.naturalHeight}`,
                "--photo-ratio": image.naturalWidth / image.naturalHeight,
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture?.(event.pointerId);
                setCompare(true);
              }}
              onPointerUp={() => setCompare(false)}
              onPointerCancel={() => setCompare(false)}
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
            >
              <img
                className="original-photo"
                src={photoUrl}
                alt={photoName}
                draggable="false"
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
        </section>
        <div className="compare-caption">Hold photo to see original</div>

        <section className="filter-intro" aria-live="polite">
          <div className="filter-heading">
            <div>
              <div className="eyebrow">
                SIGNATURE&nbsp;{" "}
                {String(
                  FILTERS.findIndex((filter) => filter.id === selectedId) + 1,
                ).padStart(2, "0")}{" "}
                / 08
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
              onChange={(event) => setIntensity(Number(event.target.value))}
              style={{ "--range-fill": `${intensity}%` }}
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
              aria-selected={tab === "filters"}
              className={tab === "filters" ? "active" : ""}
              onClick={() => setTab("filters")}
            >
              Filters
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "adjust"}
              className={tab === "adjust" ? "active" : ""}
              onClick={() => setTab("adjust")}
            >
              Adjust
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
              role="group"
              aria-label="Signature filters"
            >
              {FILTERS.map((filter) => (
                <button
                  className={`filter-card ${selectedId === filter.id ? "selected" : ""}`}
                  type="button"
                  key={filter.id}
                  aria-pressed={selectedId === filter.id}
                  onClick={() => chooseFilter(filter)}
                >
                  <span className={`filter-thumb ${filter.swatch}`}>
                    <img
                      src={thumbnails[filter.id] || photoUrl}
                      alt=""
                      draggable="false"
                    />
                    {selectedId === filter.id && (
                      <span className="selected-check">
                        <Check size={12} strokeWidth={2.4} />
                      </span>
                    )}
                  </span>
                  <span className="filter-card-label">{filter.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="adjustment-grid">
              {ADJUSTMENTS.map((adjustment) => {
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
                    <span className="adjustment-label">{adjustment.label}</span>
                    <output>{adjustment.display(value)}</output>
                    <input
                      type="range"
                      min={adjustment.min}
                      max={adjustment.max}
                      step={adjustment.step}
                      value={value}
                      onChange={(event) =>
                        updateAdjustment(adjustment.key, event.target.value)
                      }
                      style={{ "--range-fill": `${progress}%` }}
                      aria-label={adjustment.label}
                    />
                  </label>
                );
              })}
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
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
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
  if (Math.abs(ratio - 4 / 5) < 0.04) return "4:5";
  if (Math.abs(ratio - 3 / 2) < 0.04) return "3:2";
  if (Math.abs(ratio - 1) < 0.04) return "1:1";
  return `${Math.round(ratio * 100) / 100}:1`;
}

export default App;
