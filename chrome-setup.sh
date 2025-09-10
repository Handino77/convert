#!/bin/bash

# This script installs Chrome if it's not already installed
# It can be used as a pre-step in GitHub Actions or within the Docker container

echo "Starting Chrome setup..."

# Check if Chrome is already installed
if command -v google-chrome &> /dev/null || command -v google-chrome-stable &> /dev/null; then
    echo "Chrome is already installed. Version:"
    google-chrome --version || google-chrome-stable --version
    
    # Set environment variable for Puppeteer
    if command -v google-chrome &> /dev/null; then
        export PUPPETEER_EXECUTABLE_PATH=$(which google-chrome)
        echo "Set PUPPETEER_EXECUTABLE_PATH to $(which google-chrome)"
    else
        export PUPPETEER_EXECUTABLE_PATH=$(which google-chrome-stable)
        echo "Set PUPPETEER_EXECUTABLE_PATH to $(which google-chrome-stable)"
    fi
    
    exit 0
fi

echo "Chrome is not installed. Attempting to install..."

# Detect the OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME=$ID
else
    OS_NAME=$(uname -s)
fi

# Install Chrome based on the OS
if [ "$OS_NAME" = "ubuntu" ] || [ "$OS_NAME" = "debian" ]; then
    echo "Detected Debian/Ubuntu. Using apt..."
    
    # Install dependencies
    sudo apt-get update
    sudo apt-get install -y wget gnupg ca-certificates
    
    # Add Google Chrome repository
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
    
    # Install Chrome
    sudo apt-get update
    sudo apt-get install -y google-chrome-stable
    
    # Verify installation
    google-chrome-stable --version
    
    # Set environment variable for Puppeteer
    export PUPPETEER_EXECUTABLE_PATH=$(which google-chrome-stable)
    echo "Set PUPPETEER_EXECUTABLE_PATH to $(which google-chrome-stable)"
elif [ "$OS_NAME" = "alpine" ]; then
    echo "Detected Alpine Linux. Using apk..."
    
    # Install Chromium instead of Chrome on Alpine
    apk add --no-cache chromium
    
    # Verify installation
    chromium --version
    
    # Set environment variable for Puppeteer
    export PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser)
    echo "Set PUPPETEER_EXECUTABLE_PATH to $(which chromium-browser)"
else
    echo "Unsupported OS for automatic installation. Please install Chrome manually."
    exit 1
fi

echo "Chrome setup completed successfully."