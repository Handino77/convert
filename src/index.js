#!/usr/bin/env node

const core = require('@actions/core');
const fs = require('fs-extra');
const path = require('path');
const { URL } = require('url');
const puppeteer = require('puppeteer');
const htmlPdf = require('html-pdf-node');
const { PDFDocument } = require('pdf-lib');
const { execSync } = require('child_process');

// Enhanced logging function
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const fullMessage = `[${timestamp}] ${message}`;
  
  if (typeof core[level] === 'function') {
    core[level](fullMessage);
  } else {
    if (level === 'warning' || level === 'error') {
      console.error(fullMessage);
    } else {
      console.log(fullMessage);
    }
  }
}

// Helper function to get input from environment or CLI arguments
function getInput(name, options = {}) {
  // Check if running in GitHub Actions
  if (process.env[`INPUT_${name.toUpperCase()}`]) {
    return core.getInput(name, options);
  }
  
  // Check for CLI arguments
  const argPrefix = `--${name}=`;
  const arg = process.argv.find(arg => arg.startsWith(argPrefix));
  if (arg) {
    return arg.substring(argPrefix.length);
  }
  
  // Check for environment variables
  if (process.env[name.toUpperCase()]) {
    return process.env[name.toUpperCase()];
  }
  
  // Return empty string or throw if required
  if (options.required) {
    throw new Error(`Input '${name}' is required`);
  }
  
  return '';
}

// Function to set output (works in both GitHub Actions and CLI)
function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    // New method using environment file
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  } else if (typeof core.setOutput === 'function') {
    // Using @actions/core method (which should use environment file if available)
    core.setOutput(name, value);
  } else {
    // Fallback for local CLI usage
    console.log(`Output ${name}: ${value}`);
  }
}

// Function to report failure (works in both GitHub Actions and CLI)
function setFailed(message) {
  if (typeof core.setFailed === 'function') {
    core.setFailed(message);
  } else {
    console.error(message);
    process.exit(1);
  }
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

// Function to check if string is a file path
async function isFilePath(str) {
  try {
    const stats = await fs.stat(str);
    return stats.isFile();
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
    return {
      top: margins[0],
      right: margins[1],
      bottom: margins[2],
      left: margins[3]
    };
  } else {
    throw new Error('Margins must be in format: top,right,bottom,left or a single value for all sides');
  }
}

// Function to log system information for diagnostics
async function logSystemInfo() {
  try {
    log('System diagnostics:');
    log(`Node.js version: ${process.version}`);
    log(`OS: ${process.platform} ${process.arch}`);
    
    // Check relevant environment variables
    const relevantVars = ['PUPPETEER_EXECUTABLE_PATH', 'CHROME_PATH', 'PUPPETEER_SKIP_CHROMIUM_DOWNLOAD'];
    log('Environment variables that might affect Chrome:');
    for (const varName of relevantVars) {
      log(`  ${varName}: ${process.env[varName] || '(not set)'}`);
    }
    
    // Check for Chrome installation
    try {
      const chromeVersionOutput = execSync('google-chrome --version 2>/dev/null || google-chrome-stable --version 2>/dev/null || chromium --version 2>/dev/null').toString().trim();
      log(`Detected Chrome/Chromium: ${chromeVersionOutput}`);
    } catch (e) {
      log('Unable to detect Chrome via command line', 'warning');
    }
    
    // Check common Chrome locations
    const commonPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser'
    ];
    
    for (const chromePath of commonPaths) {
      if (await fs.pathExists(chromePath)) {
        log(`Found Chrome at: ${chromePath}`);
      }
    }

    // List installed packages related to Chrome (on Debian/Ubuntu)
    try {
      if (process.platform === 'linux') {
        const installedPackages = execSync('dpkg -l | grep -E "chrom|puppe"').toString().trim();
        log(`Installed packages related to Chrome:\n${installedPackages}`);
      }
    } catch (e) {
      // Ignore errors here
    }
  } catch (error) {
    log(`Error during system diagnostics: ${error.message}`, 'warning');
  }
}

// Function to find Chrome executable
async function findChromeExecutable() {
  // If explicitly defined in environment, use that
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    if (await fs.pathExists(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      log(`Using Chrome from PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      log(`PUPPETEER_EXECUTABLE_PATH is set but file doesn't exist: ${process.env.PUPPETEER_EXECUTABLE_PATH}`, 'warning');
    }
  }
  
  // Check common locations
  const commonPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  
  for (const path of commonPaths) {
    if (await fs.pathExists(path)) {
      log(`Found Chrome at: ${path}`);
      return path;
    }
  }
  
  // Try to find using `which`
  try {
    const chromePath = execSync('which google-chrome || which google-chrome-stable || which chromium').toString().trim();
    if (chromePath && await fs.pathExists(chromePath)) {
      log(`Found Chrome using 'which' command: ${chromePath}`);
      return chromePath;
    }
  } catch (e) {
    // Ignore error if 'which' command fails
  }
  
  log('Could not find Chrome executable', 'warning');
  return null;
}

// Method 1: Convert HTML to PDF using Puppeteer
async function convertWithPuppeteer(source, options) {
  log('Converting with Puppeteer...');
  
  try {
    // Find Chrome
    const executablePath = await findChromeExecutable();
    
    // Launch options
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--font-render-hinting=none'
      ]
    };
    
    // Use explicit Chrome path if found
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }
    
    log(`Launching browser with options: ${JSON.stringify(launchOptions)}`);
    const browser = await puppeteer.launch(launchOptions);
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({
      width: 1200,
      height: 800
    });
    
    // Set user agent if provided
    if (options.userAgent) {
      await page.setUserAgent(options.userAgent);
    }
    
    // Navigate to URL or set content
    if (options.sourceType === 'url') {
      log(`Loading URL: ${source}`);
      await page.goto(source, { 
        waitUntil: 'networkidle0',
        timeout: options.timeout 
      });
    } else {
      log('Setting HTML content');
      await page.setContent(source, { 
        waitUntil: 'networkidle0',
        timeout: options.timeout 
      });
    }
    
    // Wait for selector if provided
    if (options.waitForSelector) {
      log(`Waiting for selector: ${options.waitForSelector}`);
      await page.waitForSelector(options.waitForSelector, { 
        timeout: options.timeout 
      });
    }
    
    // Inject custom CSS if provided
    if (options.customCss) {
      log('Injecting custom CSS');
      await page.addStyleTag({ content: options.customCss });
    }
    
    // Configure PDF options
    const pdfOptions = {
      path: options.output,
      format: options.format,
      landscape: options.orientation === 'landscape',
      margin: {
        top: `${options.margin.top}mm`,
        right: `${options.margin.right}mm`,
        bottom: `${options.margin.bottom}mm`,
        left: `${options.margin.left}mm`,
      },
      printBackground: options.printBackground,
      displayHeaderFooter: !!(options.headerTemplate || options.footerTemplate),
      headerTemplate: options.headerTemplate || '',
      footerTemplate: options.footerTemplate || '',
      scale: options.scale
    };
    
    log(`Generating PDF with options: ${JSON.stringify(pdfOptions)}`);
    await page.pdf(pdfOptions);
    
    await browser.close();
    log('Puppeteer conversion completed successfully');
    return true;
  } catch (error) {
    log(`Puppeteer conversion error: ${error.message}`, 'warning');
    log(`Error stack: ${error.stack}`, 'warning');
    return false;
  }
}

// Method 2: Convert HTML to PDF using html-pdf-node
async function convertWithHtmlPdfNode(source, options) {
  log('Converting with html-pdf-node...');
  
  try {
    // Find Chrome
    const executablePath = await findChromeExecutable();
    
    // Create file object based on source type
    let file;
    if (options.sourceType === 'url') {
      file = { url: source };
      log(`Using URL source: ${source}`);
    } else {
      file = { content: source };
      log('Using HTML content source');
    }
    
    // Convert html-pdf-node options format
    const pdfOptions = {
      format: options.format,
      landscape: options.orientation === 'landscape',
      margin: {
        top: `${options.margin.top}mm`,
        right: `${options.margin.right}mm`,
        bottom: `${options.margin.bottom}mm`,
        left: `${options.margin.left}mm`,
      },
      printBackground: options.printBackground,
      scale: options.scale,
      path: options.output,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    };
    
    // Use explicit Chrome path if found
    if (executablePath) {
      pdfOptions.executablePath = executablePath;
    }
    
    log(`Generating PDF with html-pdf-node using options: ${JSON.stringify(pdfOptions)}`);
    await htmlPdf.generatePdf(file, pdfOptions);
    log('html-pdf-node conversion completed successfully');
    return true;
  } catch (error) {
    log(`html-pdf-node conversion error: ${error.message}`, 'warning');
    log(`Error stack: ${error.stack}`, 'warning');
    return false;
  }
}

// Method 3: Create a simple PDF with minimal content using pdf-lib
async function createBasicPdfWithPdfLib(source, options) {
  log('Creating basic PDF with pdf-lib (fallback method)...');
  
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Add a page with the specified format
    const page = pdfDoc.addPage(options.format === 'A4' ? [595, 842] : [612, 792]);
    
    // Extract plain text from HTML (very basic)
    const plainText = source.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Draw some basic text on the page
    page.drawText('HTML to PDF Conversion', {
      x: 50,
      y: page.getHeight() - 50,
      size: 20
    });
    
    // Add a note about the fallback
    page.drawText('Note: This is a fallback PDF with minimal formatting.', {
      x: 50,
      y: page.getHeight() - 80,
      size: 12
    });
    
    // Add source info
    if (plainText.length > 0) {
      const previewText = plainText.substring(0, 300) + (plainText.length > 300 ? '...' : '');
      
      page.drawText('Content preview:', {
        x: 50,
        y: page.getHeight() - 120,
        size: 12
      });
      
      // Split preview text into multiple lines
      const lines = [];
      let currentLine = '';
      const words = previewText.split(' ');
      
      for (const word of words) {
        if ((currentLine + ' ' + word).length > 60) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + ' ' + word : word;
        }
      }
      
      if (currentLine) {
        lines.push(currentLine);
      }
      
      // Draw each line
      lines.forEach((line, index) => {
        page.drawText(line, {
          x: 50,
          y: page.getHeight() - 140 - (index * 20),
          size: 10
        });
      });
    }
    
    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(options.output, pdfBytes);
    
    log('Basic PDF created successfully with pdf-lib');
    return true;
  } catch (error) {
    log(`pdf-lib creation error: ${error.message}`, 'warning');
    return false;
  }
}

// Main function
async function run() {
  try {
    // Log system information for diagnostics
    await logSystemInfo();
    
    // Get inputs
    const source = getInput('source', { required: true });
    const output = getInput('output', { required: true });
    const waitForSelector = getInput('wait_for');
    const format = getInput('format') || 'A4';
    const marginInput = getInput('margin') || '10,10,10,10';
    const orientation = getInput('orientation') || 'portrait';
    const headerTemplate = getInput('header_template') || '';
    const footerTemplate = getInput('footer_template') || '';
    const timeout = parseInt(getInput('timeout') || '30000', 10);
    const scale = parseFloat(getInput('scale') || '1');
    const customCss = getInput('custom_css') || '';
    const cookiesStr = getInput('cookies') || '[]';
    const userAgent = getInput('user_agent');
    const printBackground = getInput('print_background') !== 'false'; // Default to true

    // Parse margins
    const margin = parseMargins(marginInput);

    // Parse cookies if provided
    let cookies = [];
    if (cookiesStr) {
      try {
        cookies = JSON.parse(cookiesStr);
      } catch (e) {
        log(`Failed to parse cookies: ${e.message}`, 'warning');
      }
    }

    // Create output directory if it doesn't exist
    await fs.ensureDir(path.dirname(output));

    // Determine how to load the source
    let sourceContent;
    let sourceType;
    
    if (await isFilePath(source)) {
      // Source is a file path
      log(`Using file: ${source}`);
      const content = await fs.readFile(source, 'utf8');
      sourceContent = content;
      sourceType = 'html';
    } else if (isUrl(source)) {
      // Source is a URL
      log(`Using URL: ${source}`);
      sourceContent = source;
      sourceType = 'url';
    } else {
      // Source is HTML content
      log('Using HTML content from input');
      sourceContent = source;
      sourceType = 'html';
    }

    // Prepare options for conversion methods
    const conversionOptions = {
      sourceType,
      output,
      format,
      margin,
      orientation,
      headerTemplate,
      footerTemplate,
      timeout,
      scale,
      customCss,
      cookies,
      userAgent,
      printBackground,
      waitForSelector
    };

    // Try multiple conversion methods in sequence
    log('Attempting PDF conversion...');
    
    // Method 1: Puppeteer
    let success = false;
    try {
      success = await convertWithPuppeteer(sourceContent, conversionOptions);
    } catch (err) {
      log(`Error during Puppeteer conversion: ${err.message}`, 'warning');
      success = false;
    }
    
    // Method 2: html-pdf-node
    if (!success) {
      log('Primary conversion method failed. Trying alternative method...', 'warning');
      try {
        success = await convertWithHtmlPdfNode(sourceContent, conversionOptions);
      } catch (err) {
        log(`Error during html-pdf-node conversion: ${err.message}`, 'warning');
        success = false;
      }
    }
    
    // Method 3: Basic PDF with pdf-lib (guaranteed to work)
    if (!success) {
      log('Alternative method failed. Creating basic PDF as fallback...', 'warning');
      try {
        success = await createBasicPdfWithPdfLib(sourceContent, conversionOptions);
      } catch (err) {
        log(`Error during pdf-lib conversion: ${err.message}`, 'warning');
        success = false;
      }
    }
    
    if (success) {
      log(`PDF generated successfully: ${output}`);
      setOutput('pdf_path', output);
    } else {
      setFailed('All conversion methods failed. This is unexpected as the final method should always work.');
    }
  } catch (error) {
    setFailed(`Action failed: ${error.message}`);
  }
}

run();
