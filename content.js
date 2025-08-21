const BTN_CLASS = "drb-dl-btn";
const WRAP_CLASS = "drb-dl-wrap";
const PROCESSED_ATTR = "data-drb-processed";

// Helper: pick largest candidate from srcset
function bestFromSrcset(srcset) {
  if (!srcset) return null;
  // srcset like: "https://... 400w, https://... 800w"
  const candidates = srcset
    .split(",")
    .map(s => s.trim())
    .map(s => {
      const [url, size] = s.split(/\s+/);
      const w = size?.endsWith("w") ? parseInt(size) : 0;
      return { url, w };
    })
    .filter(x => x.url)
    .sort((a,b) => b.w - a.w);
  return candidates[0]?.url || null;
}

function getImageUrl(img) {
  // Prefer highest-res from srcset, then current src
  const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset");
  const best = bestFromSrcset(srcset);
  if (best) return best;

  // Dribbble often uses <picture> with <source srcset>
  const picture = img.closest("picture");
  if (picture) {
    const sources = Array.from(picture.querySelectorAll("source[srcset]"));
    const bestFromSources = bestFromSrcset(
      sources.map(s => s.getAttribute("srcset")).filter(Boolean).join(",")
    );
    if (bestFromSources) return bestFromSources;
  }

  // Fallback to src / data-src
  return img.getAttribute("src") || img.getAttribute("data-src") || null;
}

function fileNameFromUrl(url) {
  try {
    const u = new URL(url);
    const base = u.pathname.split("/").pop() || "dribbble-image";
    // Ensure it has an extension; if not, add .jpg
    return /\.[a-z0-9]{2,4}$/i.test(base) ? base : `${base}.jpg`;
  } catch {
    return "dribbble-image.jpg";
  }
}

function createButton(img, url) {
  const wrap = document.createElement("div");
  wrap.className = WRAP_CLASS;
  wrap.style.position = "absolute";
  wrap.style.top = "8px";
  wrap.style.right = "8px";
  wrap.style.zIndex = 20;

  const btn = document.createElement("button");
  btn.className = BTN_CLASS;
  btn.title = "Download image";
  btn.setAttribute("type", "button");
  btn.innerHTML = "⬇"; // simple icon; you can replace with SVG

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    e.preventDefault();

    // Use direct URL when possible; if it 403s for some reason, you could
    // extend this to fetch as blob and use chrome.downloads.download with blob URL (MV3 makes that trickier).
    const downloadUrl = url || getImageUrl(img);
    if (!downloadUrl) return;

    chrome.runtime.sendMessage({
      action: "download",
      url: downloadUrl,
      filename: fileNameFromUrl(downloadUrl)
    }, (resp) => {
      if (resp?.ok) {
        btn.classList.add("drb-success");
        setTimeout(() => btn.classList.remove("drb-success"), 1200);
      } else {
        btn.classList.add("drb-error");
        setTimeout(() => btn.classList.remove("drb-error"), 1200);
        if (resp?.lastError) console.warn("Download error:", resp.lastError);
      }
    });
  });

  wrap.appendChild(btn);

  // Ensure the image container is positioned to anchor overlay
  const container = img.closest("a,figure,div,li,section") || img.parentElement;
  if (container && getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
  (container || img.parentElement || document.body).appendChild(wrap);
}

function processImage(img) {
  if (!img || img.hasAttribute(PROCESSED_ATTR)) return;
  // Only apply to likely shot images (skip avatars, logos, tiny icons)
  const rect = img.getBoundingClientRect();
  const minSize = 120; // ignore tiny images
  if (rect.width < minSize && rect.height < minSize) return;

  const url = getImageUrl(img);
  if (!url) return;

  createButton(img, url);
  img.setAttribute(PROCESSED_ATTR, "1");
}

// Try common selectors that appear on shot pages and grids
function scan() {
  const imgs = document.querySelectorAll([
    // Shot pages
    "article img[src], article picture img",
    // Grids / lists / popular/new pages
    "li img[src], li picture img",
    // Fallback
    "img[srcset], img[data-srcset]"
  ].join(","));
  imgs.forEach(processImage);
}

// Keep watching for dynamically loaded shots
const observer = new MutationObserver(() => scan());
observer.observe(document.documentElement, { subtree: true, childList: true });

// Initial run
scan();
