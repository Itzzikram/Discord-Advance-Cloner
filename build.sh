#!/bin/bash
# Bash build script for Discord Cloner Hybrid (Linux/Mac)

echo "Building Discord Cloner Hybrid..."

# Build Rust components
echo -e "\n[1/2] Building Rust components..."
cd rust
if command -v cargo &> /dev/null; then
    cargo build --release
    if [ $? -ne 0 ]; then
        echo "Rust build failed!"
        cd ..
        exit 1
    fi
    echo "Rust build completed successfully!"
else
    echo "Cargo not found. Please install Rust: https://rustup.rs/"
    cd ..
    exit 1
fi
cd ..

# Build TypeScript components
echo -e "\n[2/2] Building TypeScript components..."
cd ts
if command -v npm &> /dev/null; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "npm install failed!"
        cd ..
        exit 1
    fi
    
    echo "Building TypeScript..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "TypeScript build failed!"
        cd ..
        exit 1
    fi
    echo "TypeScript build completed successfully!"
else
    echo "npm not found. Please install Node.js: https://nodejs.org/"
    cd ..
    exit 1
fi
cd ..

echo -e "\nBuild completed successfully!"
echo "Next steps:"
echo "1. Copy .env.example to .env and configure it"
echo "2. Run: cd ts && npm start"

