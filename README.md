# HTML to PDF Converter Action

This GitHub Action converts HTML files, URLs, or raw HTML content to PDF documents with full support for modern HTML features including CSS, emojis, fonts, and more.

## Features

- Convert HTML files to PDF
- Convert URLs to PDF
- Convert raw HTML content to PDF
- Full support for modern HTML, CSS, web fonts, and emojis
- Customizable page formats, margins, and orientation
- Custom headers and footers
- Wait for specific elements to load (useful for SPAs)
- Timeout control
- Scale adjustment
- Custom CSS injection
- Cookie support for authenticated pages
- User-agent customization
- Background graphics control

## Usage

### Basic Usage

```yaml
steps:
  - name: Convert HTML to PDF
    uses: narthanaj/html-to-pdf-action@v1
    with:
      source: ./path/to/file.html  # or URL or raw HTML
      output: ./output/result.pdf
```

### Advanced Usage

```yaml
steps:
  - name: Convert HTML to PDF with Advanced Options
    uses: narthanaj/html-to-pdf-action@v1
    with:
      source: https://example.com
      output: ./output/result.pdf
      wait_for: '#content-loaded'  # Wait for an element to load
      format: 'Letter'             # Paper format
      margin: '20,15,20,15'        # Margins (top,right,bottom,left) in mm
      orientation: 'landscape'     # Paper orientation
      header_template: '<div style="font-size: 10px; text-align: center; width: 100%;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
      footer_template: '<div style="font-size: 10px; text-align: center; width: 100%;">Generated on <span class="date"></span></div>'
      timeout: 60000               # Timeout in milliseconds
      scale: 0.8                   # Scale factor
      custom_css: '.hide-in-pdf { display: none !important; }'
      cookies: '[{"name": "session", "value": "abc123", "domain": "example.com"}]'
      user_agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
      print_background: 'true'     # Print background graphics
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `source` | HTML source - can be a file path, URL, or HTML content | Yes | - |
| `output` | Output PDF file path | Yes | - |
| `wait_for` | Optional selector to wait for before rendering (for SPAs) | No | - |
| `format` | Paper format (A4, Letter, etc.) | No | `A4` |
| `margin` | PDF margins in format: top,right,bottom,left (in mm) | No | `10,10,10,10` |
| `orientation` | Paper orientation (portrait or landscape) | No | `portrait` |
| `header_template` | HTML template for the PDF header | No | - |
| `footer_template` | HTML template for the PDF footer | No | - |
| `timeout` | Timeout in milliseconds | No | `30000` |
| `scale` | Scale of the webpage rendering (1 = 100%) | No | `1` |
| `custom_css` | Custom CSS to inject into the page | No | - |
| `cookies` | JSON string of cookies to set (useful for authenticated pages) | No | - |
| `user_agent` | User agent string | No | - |
| `print_background` | Print background graphics | No | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `pdf_path` | Path to the generated PDF file |

## Examples

### Convert a Local HTML File to PDF

```yaml
- name: Checkout
  uses: actions/checkout@v3

- name: Convert HTML to PDF
  uses: narthanaj/html-to-pdf-action@v1
  with:
    source: ./src/report.html
    output: ./artifacts/report.pdf
```

### Convert a URL to PDF in Landscape Mode

```yaml
- name: Convert Website to PDF
  uses: narthanaj/html-to-pdf-action@v1
  with:
    source: https://github.com
    output: ./artifacts/github.pdf
    orientation: landscape
    format: A3
    margin: 15,15,15,15
```

### Convert HTML with Custom Header and Footer

```yaml
- name: Convert HTML with Headers and Footers
  uses: narthanaj/html-to-pdf-action@v1
  with:
    source: ./src/invoice.html
    output: ./artifacts/invoice.pdf
    header_template: '<div style="font-size: 10px; text-align: center; width: 100%;">INVOICE</div>'
    footer_template: '<div style="font-size: 8px; text-align: right; width: 100%;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
```

### Convert Single-Page Application (SPA) with Wait For Element

```yaml
- name: Convert SPA to PDF
  uses: narthanaj/html-to-pdf-action@v1
  with:
    source: https://my-spa-app.com
    output: ./artifacts/spa-report.pdf
    wait_for: '#app-loaded'
    timeout: 60000
```

## Docker

This action is also available as a Docker image on Docker Hub:

```bash
docker pull narthanaj/html-to-pdf-action:latest
```

### Docker Usage

```bash
docker run --rm -v $(pwd):/workspace narthanaj/html-to-pdf-action:latest \
  --source=https://example.com \
  --output=/workspace/output.pdf
```

## Repository Structure

```
html-to-pdf-action/
├── .github/
│   └── workflows/
│       ├── test.yml
│       ├── publish-docker.yml
│       └── release.yml
├── examples/
│   └── test.html
├── src/
│   └── index.js
├── .gitignore
├── action.yml
├── LICENSE
├── package.json
├── test-local.sh
└── README.md
```

## Cross-Platform Compatibility

This action has been tested and works on:

- Ubuntu (including 24.04 Noble)
- Debian (base for Docker images)
- GitHub-hosted runners

The action automatically adapts to different environments, ensuring compatibility across various platforms.

### Testing Node.js Directly

```bash
# Install dependencies
npm install

# Run with a file
node src/index.js --source=./examples/test.html --output=./output/result.pdf

# Run with a URL
node src/index.js --source=https://github.com --output=./output/result.pdf
```

### Testing Docker Image

```bash
# Pull the Docker image
docker pull narthanaj/html-to-pdf-action:latest

# Run with a file
docker run --rm -v $(pwd):/workspace narthanaj/html-to-pdf-action:latest \
  --source=/workspace/examples/test.html \
  --output=/workspace/output/result.pdf

# Run with a URL
docker run --rm -v $(pwd):/workspace narthanaj/html-to-pdf-action:latest \
  --source=https://github.com \
  --output=/workspace/output/result.pdf
```

## Development

1. Clone the repository
2. Install dependencies with `npm install`
3. Make the script executable with `chmod +x src/index.js`
4. Make your changes
5. Test locally with `./test-local.sh`
6. Create a pull request

Note: This project requires Node.js 18 or later.

## License

MIT