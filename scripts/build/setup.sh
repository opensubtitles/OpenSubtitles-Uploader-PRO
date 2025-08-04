#!/bin/bash

echo "🚀 OpenSubtitles React Uploader Setup"
echo "===================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "📋 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env and add your OpenSubtitles API key!"
    echo "   Get your API key from: https://www.opensubtitles.com/en/consumers"
    echo ""
else
    echo "✅ .env file already exists"
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your OpenSubtitles API key"
echo "2. Run: npm run dev"
echo "3. Open: http://localhost:5173"
echo ""
echo "📖 Need help? Check the README.md file"