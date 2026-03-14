#!/bin/bash
# Bash run script for Discord Cloner Hybrid (Linux/Mac)

echo "Starting Discord Cloner Hybrid..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env and configure it."
    exit 1
fi

# Check if TypeScript is built
if [ ! -d "ts/dist" ]; then
    echo "TypeScript not built. Building now..."
    cd ts
    if command -v npm &> /dev/null; then
        npm install
        npm run build
    else
        echo "npm not found. Please install Node.js: https://nodejs.org/"
        cd ..
        exit 1
    fi
    cd ..
fi

# Check if Rust binary exists
if [ ! -f "rust/target/release/discord-cloner-hybrid" ]; then
    echo "Rust binary not found. Building now..."
    cd rust
    if command -v cargo &> /dev/null; then
        cargo build --release
    else
        echo "Cargo not found. Please install Rust: https://rustup.rs/"
        echo "Continuing without Rust binary (will use TypeScript fallback)..."
    fi
    cd ..
fi

# Run the TypeScript application
echo -e "\nStarting application..."
cd ts
npm start
cd ..

