// Keep this threshold aligned with the mobile layout breakpoint in main.css.
// Without a viewport meta tag, phones commonly expose a ~980px CSS viewport.
const mobilePdfPreviewQuery = window.matchMedia('(max-width: 1024px)');
const pdfPreviewButton = document.getElementById('pdf-preview-button');
const pdfPreviewPanel = document.getElementById('pdf-preview');
const mainGrid = document.getElementById('main-grid');
const pdfPreviewStatus = document.getElementById('pdf-preview-status');
const pdfDownload = document.getElementById('pdf-download');
const pdfFrame = document.getElementById('pdfiframe0');
const pdfPages = document.getElementById('pdf-preview-pages');
let pdfPreviewUrl = null;
let pdfPreviewBlob = null;
let pdfLibraryPromise = null;
let pdfLoadingTask = null;
let pdfRenderVersion = 0;

function loadPdfLibrary() {
    if (!pdfLibraryPromise) {
        // Load matching library/worker versions only when the built-in viewer is needed.
        const baseUrl = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/legacy/build/';
        pdfLibraryPromise = import(`${baseUrl}pdf.min.mjs`).then(library => {
            library.GlobalWorkerOptions.workerSrc = `${baseUrl}pdf.worker.min.mjs`;
            return library;
        }).catch(error => {
            pdfLibraryPromise = null;
            throw error;
        });
    }
    return pdfLibraryPromise;
}

function stopPdfRendering() {
    pdfRenderVersion++;
    if (pdfLoadingTask) {
        void pdfLoadingTask.destroy().catch(() => {});
        pdfLoadingTask = null;
    }
    for (const canvas of pdfPages.querySelectorAll('canvas')) {
        canvas.width = canvas.height = 0;
    }
    pdfPages.replaceChildren();
}

async function renderPdfPages(blob, version) {
    let task;
    try {
        const library = await loadPdfLibrary();
        const data = new Uint8Array(await blob.arrayBuffer());
        if (version !== pdfRenderVersion) return;
        task = library.getDocument({ data, isEvalSupported: false });
        pdfLoadingTask = task;
        const pdf = await task.promise;
        for (let number = 1; number <= pdf.numPages; number++) {
            if (version !== pdfRenderVersion) return;
            const page = await pdf.getPage(number);
            if (version !== pdfRenderVersion) return;
            const original = page.getViewport({ scale: 1 });
            const displayWidth = Math.max(1, pdfPreviewPanel.clientWidth - 32);
            // Bound both dimensions to limit memory use on phones and custom paper sizes.
            const scale = Math.min(
                displayWidth * Math.min(window.devicePixelRatio || 1, 2) / original.width,
                1600 / Math.max(original.width, original.height)
            );
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.ceil(viewport.width));
            canvas.height = Math.max(1, Math.ceil(viewport.height));
            canvas.setAttribute('role', 'img');
            canvas.setAttribute('aria-label', `PDF page ${number} of ${pdf.numPages}`);
            pdfPages.append(canvas);
            // These pixels are rendered from the actual PDF bytes by PDF.js.
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            page.cleanup();
        }
        if (version !== pdfRenderVersion) return;
        pdfPreviewPanel.classList.remove('is-loading');
        pdfPreviewPanel.classList.add('is-ready');
    } catch (error) {
        if (version !== pdfRenderVersion) return;
        pdfPages.replaceChildren();
        pdfPreviewPanel.classList.remove('is-loading', 'is-ready');
        pdfPreviewStatus.textContent = `PDF viewer unavailable: ${error.message}. Close and reopen the preview to retry.`;
    } finally {
        if (task && pdfLoadingTask === task) {
            pdfLoadingTask = null;
            await task.destroy().catch(() => {});
        }
    }
}

function refreshPdfPreview() {
    stopPdfRendering();
    pdfFrame.removeAttribute('src');
    pdfPreviewPanel.classList.remove('is-ready', 'is-loading');
    const usePdfJs = mobilePdfPreviewQuery.matches || navigator.pdfViewerEnabled === false;
    pdfPreviewPanel.classList.toggle('uses-pdfjs', usePdfJs);
    if (!pdfPreviewBlob || pdfPreviewButton.value !== '1') return;
    if (usePdfJs) {
        pdfPreviewPanel.classList.add('is-loading');
        pdfPreviewStatus.textContent = 'Preparing PDF preview...';
        void renderPdfPages(pdfPreviewBlob, pdfRenderVersion);
    } else {
        pdfFrame.src = pdfPreviewUrl;
        pdfPreviewPanel.classList.add('is-ready');
    }
}

function setPdfPreview(blob) {
    const previousUrl = pdfPreviewUrl;
    pdfPreviewBlob = blob;
    pdfPreviewUrl = URL.createObjectURL(blob);
    pdfDownload.href = pdfPreviewUrl;
    pdfPreviewPanel.classList.add('has-pdf');
    refreshPdfPreview();
    if (previousUrl) URL.revokeObjectURL(previousUrl);
}

function setPdfPreviewError(error) {
    stopPdfRendering();
    pdfPreviewPanel.classList.remove('is-loading', 'is-ready', 'has-pdf');
    pdfPreviewStatus.textContent = `PDF preview unavailable: ${error.message}`;
    pdfDownload.removeAttribute('href');
    pdfFrame.removeAttribute('src');
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    pdfPreviewUrl = null;
    pdfPreviewBlob = null;
}

function updatePdfPreviewLayout() {
    const isOpen = pdfPreviewButton.value === '1';
    pdfPreviewPanel.style.display = isOpen ? 'block' : 'none';
    mainGrid.classList.toggle('mobile-pdf-preview-opened', isOpen && mobilePdfPreviewQuery.matches);
    mainGrid.classList.toggle('mobile-pdf-preview-closed', !isOpen);
    mainGrid.style.gridTemplateColumns = isOpen ? '1fr 1fr 1fr' : '1fr 1fr';
}

mobilePdfPreviewQuery.addEventListener('change', () => {
    updatePdfPreviewLayout();
    refreshPdfPreview();
});

function closeMobilePdfPreview() {
    pdfPreviewButton.value = '0';
    updatePdfPreviewLayout();
    refreshPdfPreview();
}

pdfPreviewButton.addEventListener('click', function(event) {
    event.preventDefault();
    if (this.value === '1') {
        closeMobilePdfPreview();
        return;
    }
    this.value = '1';
    updatePdfPreviewLayout();
    window.dispatchEvent(new Event('pdf-preview-requested'));
});

document.getElementById('pdf-preview-close').addEventListener('click', closeMobilePdfPreview);
