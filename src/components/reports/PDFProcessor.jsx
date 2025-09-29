import React, { useState } from 'react';
import { withPDFLibraries } from '../../services/pdf';

const PDFProcessor = ({ user }) => {
    const [processing, setProcessing] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            setUploadedFile(file);
        } else {
            alert('Please select a valid PDF file.');
        }
    };

    const processPDF = withPDFLibraries(async (pdfjsLib, PDFLib, file) => {
        setProcessing(true);
        try {
            // PDF processing logic will be implemented here
            // This is a placeholder for the heavy PDF processing
            console.log('Processing PDF with libraries:', { pdfjsLib, PDFLib });

            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 2000));

            alert('PDF processed successfully! (Placeholder)');
        } catch (error) {
            console.error('PDF processing error:', error);
            alert('Error processing PDF: ' + error.message);
        } finally {
            setProcessing(false);
        }
    });

    const handleProcessPDF = async () => {
        if (!uploadedFile) {
            alert('Please select a PDF file first.');
            return;
        }

        await processPDF(uploadedFile);
    };

    return (
        <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="pdf-upload"
                />
                <label
                    htmlFor="pdf-upload"
                    className="cursor-pointer flex flex-col items-center space-y-2"
                >
                    <span className="material-icons text-4xl text-gray-400">upload_file</span>
                    <p className="text-sm text-gray-600">
                        Click to upload PDF receipt or drag and drop
                    </p>
                    {uploadedFile && (
                        <p className="text-sm text-blue-600 font-medium">
                            Selected: {uploadedFile.name}
                        </p>
                    )}
                </label>
            </div>

            {uploadedFile && (
                <button
                    onClick={handleProcessPDF}
                    disabled={processing}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                    {processing ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Processing PDF...</span>
                        </>
                    ) : (
                        <>
                            <span className="material-icons text-sm">picture_as_pdf</span>
                            <span>Process PDF</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

export default PDFProcessor;