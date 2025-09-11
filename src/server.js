// server.js

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');
const { URL } = require('url');
const puppeteer = require('puppeteer');
const htmlPdf = require('html-pdf-node');
const { PDFDocument } = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Enhanced logging function
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// Function to find Chrome executable
async function findChromeExecutable() {
    const commonPaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
    ];
    for (const p of commonPaths) {
        if (await fs.pathExists(p)) {
            log(`Found Chrome at: ${p}`);
            return p;
        }
    }
    try {
        const chromePath = execSync('which google-chrome || which google-chrome-stable || which chromium').toString().trim();
        if (chromePath && await fs.pathExists(chromePath)) {
            log(`Found Chrome using 'which' command: ${chromePath}`);
            return chromePath;
        }
    } catch (e) {
        // Ignore errors
    }
    log('Could not find Chrome executable', 'warning');
    return null;
}

// Function to check if string is a URL
function isUrl(str) {
    try {
        new URL(str);
        return true;
    } catch (e) {
        return false;
    }
}

// Function to parse margins
function parseMargins(marginStr) {
    const margins = marginStr.split(',').map(m => parseInt(m.trim(), 10));
    if (margins.length === 1) {
        return { top: margins[0], right: margins[0], bottom: margins[0], left: margins[0] };
    } else if (margins.length === 4) {
        return { top: margins[0], right: margins[1], bottom: margins[2], left: margins[3] };
    } else {
        throw new Error('Margins must be in format: top,right,bottom,left or a single value for all sides');
    }
}

// Conversion method 1: Puppeteer
async function convertWithPuppeteer(source, options) {
    log('Converting with Puppeteer...');
    try {
        const executablePath = await findChromeExecutable();
        const launchOptions = {
            headless: 'new',
            args: ['--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu']
        };
        if (executablePath) {
            launchOptions.executablePath = executablePath;
        }
        
        const browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        
        if (options.sourceType === 'url') {
            await page.goto(source, { waitUntil: 'networkidle0' });
        } else {
            await page.setContent(source, { waitUntil: 'networkidle0' });
        }
        
        const pdfOptions = {
            format: options.format,
            landscape: options.orientation === 'landscape',
            margin: {
                top: `${options.margin.top}mm`, right: `${options.margin.right}mm`, bottom: `${options.margin.bottom}mm`, left: `${options.margin.left}mm`
            },
            printBackground: options.printBackground
        };
        
        const pdfBuffer = await page.pdf(pdfOptions);
        await browser.close();
        return pdfBuffer;
    } catch (error) {
        log(`Puppeteer conversion error: ${error.message}`, 'error');
        throw error;
    }
}

// Conversion method 2: html-pdf-node
async function convertWithHtmlPdfNode(source, options) {
    log('Converting with html-pdf-node...');
    try {
        const executablePath = await findChromeExecutable();
        let file;
        if (options.sourceType === 'url') {
            file = { url: source };
        } else {
            file = { content: source };
        }
        const pdfOptions = {
            format: options.format, landscape: options.orientation === 'landscape', margin: options.margin,
            printBackground: options.printBackground, executablePath
        };
        const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions);
        return pdfBuffer;
    } catch (error) {
        log(`html-pdf-node conversion error: ${error.message}`, 'error');
        throw error;
    }
}

// Main conversion logic
async function performConversion(source, options) {
    const sourceType = isUrl(source) ? 'url' : 'html';
    
    const conversionOptions = {
        ...options,
        sourceType,
        margin: options.margin ? parseMargins(options.margin) : { top: 10, right: 10, bottom: 10, left: 10 },
        format: options.format || 'A4',
        orientation: options.orientation || 'portrait',
        printBackground: options.printBackground !== 'false'
    };

    let pdfBuffer;
    try {
        pdfBuffer = await convertWithPuppeteer(source, conversionOptions);
    } catch (err) {
        log('Primary method failed. Trying alternative...', 'warning');
        try {
            pdfBuffer = await convertWithHtmlPdfNode(source, conversionOptions);
        } catch (err) {
            log('Alternative method failed. Conversion aborted.', 'error');
            throw new Error('All conversion methods failed.');
        }
    }
    return pdfBuffer;
}

app.post('/convert', async (req, res) => {
    const { source, ...options } = req.body;

    if (!source) {
        return res.status(400).json({ error: "Input 'source' is required" });
    }

    log(`Received request to convert source to PDF`);

    try {
        const pdfBuffer = await performConversion(source, options);

        // Enviar PDF correctamente como binario
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="output.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        res.end(pdfBuffer, 'binary'); // 🔹 importante: usar 'binary'
    } catch (error) {
        log(`Conversion failed: ${error.message}`, 'error');
        res.status(500).json({ error: 'Conversion failed. Check the server logs for details.', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});


