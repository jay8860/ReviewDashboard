import fontUrl from '../assets/fonts/AnekDevanagari.ttf';

const PDF_FONT_FAMILY = 'AnekDevanagari';
const PDF_FONT_FILE = 'AnekDevanagari.ttf';

let pdfFontBinaryPromise = null;

const arrayBufferToBinaryString = (buffer) => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';

    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return binary;
};

const loadPdfFontBinary = async () => {
    if (!pdfFontBinaryPromise) {
        pdfFontBinaryPromise = fetch(fontUrl)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load PDF font: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(arrayBufferToBinaryString);
    }

    return pdfFontBinaryPromise;
};

export const ensurePdfUnicodeFont = async (doc) => {
    const fontList = typeof doc.getFontList === 'function' ? doc.getFontList() : {};
    if (!fontList?.[PDF_FONT_FAMILY]) {
        const binary = await loadPdfFontBinary();
        doc.addFileToVFS(PDF_FONT_FILE, binary);
        doc.addFont(PDF_FONT_FILE, PDF_FONT_FAMILY, 'normal');
    }

    doc.setFont(PDF_FONT_FAMILY, 'normal');
    return PDF_FONT_FAMILY;
};
