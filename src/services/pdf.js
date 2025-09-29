// PDF.js Configuration
let pdfjsLib;
let PDFLib;

// Dynamically import PDF libraries to enable code splitting
export const initializePDFLibraries = async () => {
    if (!pdfjsLib) {
        const pdfjs = await import('pdfjs-dist');
        pdfjsLib = pdfjs;

        // Set PDF.js worker
        const workerModule = await import('pdfjs-dist/build/pdf.worker.min.js?url');
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
    }

    if (!PDFLib) {
        PDFLib = await import('pdf-lib');
    }

    return { pdfjsLib, PDFLib };
};

// Lazy loading wrapper for PDF operations
export const withPDFLibraries = (callback) => {
    return async (...args) => {
        const { pdfjsLib: pdfjs, PDFLib: pdfLib } = await initializePDFLibraries();
        return callback(pdfjs, pdfLib, ...args);
    };
};

console.log('PDF services configured with lazy loading');