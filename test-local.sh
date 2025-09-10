#!/bin/bash

# Test local script execution and Docker image execution
# Make sure you have Node.js and Docker installed

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create directories
mkdir -p examples output

# Create a test HTML file if it doesn't exist
if [ ! -f "examples/test.html" ]; then
  echo -e "${BLUE}Creating test HTML file...${NC}"
  cat > examples/test.html << EOF
<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 50px; }
    h1 { color: #2c3e50; }
    .emoji { font-size: 24px; }
  </style>
</head>
<body>
  <h1>HTML to PDF Test</h1>
  <p>This is a test page for the HTML to PDF converter.</p>
  <p class="emoji">Emojis support: 😀 🚀 🌈 👍</p>
</body>
</html>
EOF
fi

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Test local execution with Node.js
test_nodejs() {
  echo -e "${BLUE}Testing with Node.js...${NC}"
  
  # Check if Node.js is installed
  if ! command_exists node; then
    echo -e "${RED}Node.js is not installed. Skipping Node.js test.${NC}"
    return
  fi
  
  # Check if dependencies are installed
  if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing dependencies...${NC}"
    npm install
  fi
  
  # Test with file
  echo "Testing with HTML file..."
  node src/index.js --source=examples/test.html --output=output/nodejs_test_file.pdf
  
  # Test with URL
  echo "Testing with URL..."
  node src/index.js --source=https://github.com --output=output/nodejs_test_url.pdf
  
  # Verify files
  if [ -f "output/nodejs_test_file.pdf" ] && [ -f "output/nodejs_test_url.pdf" ]; then
    echo -e "${GREEN}Node.js tests passed!${NC}"
  else
    echo -e "${RED}Node.js tests failed!${NC}"
    if [ ! -f "output/nodejs_test_file.pdf" ]; then
      echo -e "${RED}Missing: output/nodejs_test_file.pdf${NC}"
    fi
    if [ ! -f "output/nodejs_test_url.pdf" ]; then
      echo -e "${RED}Missing: output/nodejs_test_url.pdf${NC}"
    fi
  fi
}

# Test Docker image
test_docker() {
  echo -e "${BLUE}Testing with Docker...${NC}"
  
  # Check if Docker is installed
  if ! command_exists docker; then
    echo -e "${RED}Docker is not installed. Skipping Docker test.${NC}"
    return
  fi
  
  # Pull the Docker image if needed
  echo "Pulling the Docker image..."
  docker pull narthanaj/html-to-pdf-action:latest
  
  # Test with file
  echo "Testing with HTML file..."
  docker run --rm -v "$(pwd)":/workspace narthanaj/html-to-pdf-action:latest \
    --source=/workspace/examples/test.html \
    --output=/workspace/output/docker_test_file.pdf
  
  # Test with URL
  echo "Testing with URL..."
  docker run --rm -v "$(pwd)":/workspace narthanaj/html-to-pdf-action:latest \
    --source=https://github.com \
    --output=/workspace/output/docker_test_url.pdf
  
  # Verify files
  if [ -f "output/docker_test_file.pdf" ] && [ -f "output/docker_test_url.pdf" ]; then
    echo -e "${GREEN}Docker tests passed!${NC}"
  else
    echo -e "${RED}Docker tests failed!${NC}"
    if [ ! -f "output/docker_test_file.pdf" ]; then
      echo -e "${RED}Missing: output/docker_test_file.pdf${NC}"
    fi
    if [ ! -f "output/docker_test_url.pdf" ]; then
      echo -e "${RED}Missing: output/docker_test_url.pdf${NC}"
    fi
  fi
}

# Run tests
echo -e "${BLUE}Starting local tests...${NC}"
test_nodejs
echo ""
test_docker
echo ""
echo -e "${GREEN}Tests completed!${NC}"
ls -l output/