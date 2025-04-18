// 


const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { parse } = require('csv-parse/sync');
const mammoth = require('mammoth');  // For DOCX files
const pptx2json = require('pptx2json');  // For PPTX files

// Function to extract text from files
const extractTextFromFile = async (filePath, mimetype) => {
    const ext = path.extname(filePath).toLowerCase();

    // Handle .txt files
    if (mimetype === 'text/plain' || ext === '.txt') {
        return fs.promises.readFile(filePath, 'utf-8');  // For .txt files
    }

    // Handle .pdf files
    else if (mimetype === 'application/pdf' || ext === '.pdf') {
        const pdfData = await fs.promises.readFile(filePath);
        const pdfText = await pdfParse(pdfData);
        return pdfText.text;  // For .pdf files
    }

    // Handle .csv files
    else if (mimetype === 'application/vnd.ms-excel' || ext === '.csv') {
        const csvData = await fs.promises.readFile(filePath, 'utf-8');
        const records = parse(csvData, { columns: true });
        return records.map(record => Object.values(record).join(' ')).join('\n');  // For .csv files
    }

    // Handle .docx files
    else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
        const docxData = await fs.promises.readFile(filePath);
        const { value } = await mammoth.extractRawText({ buffer: docxData });
        return value;  // For .docx files
    }

    // Handle .pptx files
    else if (mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || ext === '.pptx') {
        const pptxData = await pptx2json(filePath);  // Converts pptx file to JSON
        let pptxText = '';
        pptxData.slides.forEach(slide => {
            pptxText += slide.texts ? slide.texts.join(' ') : '';  // Extracts text from slides
        });
        return pptxText;  // For .pptx files
    }

    // Throw error if the file type is unsupported
    throw new Error('Unsupported file type');
};

module.exports = { extractTextFromFile };