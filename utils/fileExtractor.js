const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { parse } = require('csv-parse/sync');


const extractTextFromFile = async (filePath, mimetype) => {
    const ext = path.extname(filePath).toLowerCase();

    if (mimetype === 'text/plain' || ext === '.txt') {
        return fs.promises.readFile(filePath, 'utf-8'); // For .txt files
    }
    else if (mimetype === 'application/pdf' || ext === '.pdf') {
        const pdfData = await fs.promises.readFile(filePath);
        const pdfText = await pdfParse(pdfData);
        return pdfText.text; // For .pdf files
    }
    else if (mimetype === 'application/vnd.ms-excel' || ext === '.csv') {
        const csvData = await fs.promises.readFile(filePath, 'utf-8');
        const records = parse(csvData, { columns: true });
        return records.map(record => Object.values(record).join(' ')).join('\n'); // For .csv files
    }

    throw new Error('Unsupported file type');
};

module.exports = { extractTextFromFile };