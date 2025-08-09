# OpenSubtitles Uploader PRO

[![Tests](https://github.com/opensubtitles/opensubtitles-uploader-pro/workflows/Tests/badge.svg)](https://github.com/opensubtitles/opensubtitles-uploader-pro/actions)
[![Version](https://img.shields.io/badge/version-1.6.2-blue.svg)](https://github.com/opensubtitles/opensubtitles-uploader-pro/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-uploader.opensubtitles.org-brightgreen.svg)](https://uploader.opensubtitles.org)

A professional subtitle uploader application that integrates with OpenSubtitles APIs for seamless subtitle management and upload.

**🚀 [Try it live at uploader.opensubtitles.org](https://uploader.opensubtitles.org)**

## 📦 Downloads

### Desktop Application
**📦 [Download Latest Release](https://github.com/opensubtitles/opensubtitles-uploader-pro/releases/latest)**

- **Windows x64**: `OpenSubtitles Uploader PRO_x.x.x_x64-setup.exe` - Windows installer
- **macOS (Universal)**: `OpenSubtitles Uploader PRO_x.x.x_universal.dmg` - Intel & Apple Silicon Macs
- **Linux x64**: `opensubtitles-uploader-pro_x.x.x_amd64.AppImage` - Universal Linux binary
- **Linux x64**: `opensubtitles-uploader-pro_x.x.x_amd64.deb` - Debian/Ubuntu package

## ✨ Features

### 🎬 Smart Upload Experience
- **Drag & Drop Interface** - Drop video and subtitle files directly into the browser
- **Automatic File Pairing** - Smart matching of video and subtitle files
- **Language Detection** - AI-powered subtitle language identification
- **Movie Recognition** - Intelligent movie/episode detection with IMDb integration
- **Batch Processing** - Handle multiple video/subtitle pairs simultaneously

### 🤖 Intelligent Automation
- **Video Metadata Extraction** - Automatic detection of resolution, codec, bitrate, duration
- **Episode Detection** - Smart TV show episode identification with season/episode numbering
- **Movie Hash Calculation** - Generates OpenSubtitles-compatible hashes for precise matching
- **Automatic Tagging** - Detects HD quality, hearing impaired, foreign parts from filenames
- **Subtitle Statistics** - Shows existing subtitle counts and language availability

### 🎨 User Experience
- **Modern UI** - Clean, responsive interface with automatic dark/light theme detection
- **Performance Optimized** - Intelligent caching, retry logic, and parallel processing
- **Upload Validation** - Comprehensive pre-upload checks to ensure successful submissions
- **Ad Blocker Detection** - Automatic detection and guidance for browser compatibility

## 🚀 How to Use

### Basic Upload Process

1. **🎯 Open the App** - Visit [uploader.opensubtitles.org](https://uploader.opensubtitles.org) or launch desktop app
2. **📁 Drop Files** - Drag video and subtitle files (or entire directories) into the interface
3. **⚙️ Automatic Processing** - The app automatically:
   - Pairs videos with subtitles based on filename similarity
   - Extracts video metadata (resolution, codec, duration)
   - Calculates movie hashes for precise matching
   - Detects subtitle languages using AI
   - Identifies movies/episodes with IMDb integration
4. **✅ Review & Upload** - Check detected information, customize if needed, and upload

### Supported File Formats

**Video Files**: `.mp4`, `.mkv`, `.avi`, `.mov`, `.webm`, `.flv`, `.wmv`, etc.

**Subtitle Files**: `.srt`, `.vtt`, `.ass`, `.ssa`, `.sub`, `.txt`, etc.

### Browser Compatibility

Works with all modern browsers including Chrome, Firefox, Safari, Edge, and Brave (with Shield disabled for this site).

**🛡️ Ad Blocker Issues?** - The app includes automatic detection and guidance for ad blocker compatibility. Visit the connectivity test page via the footer link if you experience issues.

## 🏗️ Development Setup

### Prerequisites

- Node.js 16+ and npm
- OpenSubtitles.com API account ([register here](https://www.opensubtitles.com/en/consumers))

### Quick Start

1. **Clone and install**
   ```bash
   git clone https://github.com/opensubtitles/opensubtitles-uploader-pro.git
   cd opensubtitles-uploader-pro
   npm install
   ```

2. **Configure API credentials**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenSubtitles API key
   ```

3. **Start development server**
   ```bash
   npm run dev
   # Open http://localhost:5173
   ```

### Build Commands

```bash
npm run dev       # Development server
npm run build     # Production build
npm run preview   # Preview production build
npm test          # Run test suite
```

## 🖥️ Desktop App Development

### Prerequisites for Desktop Builds

1. **Install Rust** (required for Tauri):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source ~/.cargo/env
   ```

2. **Install system dependencies**:
   
   **macOS**: No additional dependencies needed
   
   **Windows**: Install [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   
   **Linux**: Install system dependencies:
   ```bash
   # Ubuntu/Debian
   sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
   ```

### Building Desktop Apps

```bash
# Development build (with console output)
npm run tauri:dev

# Production build (optimized)
npm run tauri:build
```

### Desktop App Features

The desktop version includes all web features plus:
- Native file system access without browser limitations
- System integration with native dialogs and notifications
- Offline capability for local file processing
- Enhanced performance for large file operations

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```bash
# Required: OpenSubtitles.com REST API Key
VITE_OPENSUBTITLES_API_KEY=your_api_key_here
```

### Authentication

The app supports multiple authentication methods:

1. **URL Parameter**: `?sid=your_session_id` (highest priority)
2. **Browser Cookie**: `PHPSESSID` cookie
3. **Anonymous**: Falls back to anonymous access

## 🏗️ Technical Details

### Architecture

- **React 18** with hooks-based architecture
- **Vite** for development and build tooling
- **Tailwind CSS** for styling with automatic theme detection
- **Tauri** for desktop application framework

### API Integration

**OpenSubtitles Legacy XML-RPC API** (`api.opensubtitles.org/xml-rpc`):
- Movie identification and subtitle upload operations

**OpenSubtitles Modern REST API** (`api.opensubtitles.com/api/v1`):
- AI-powered language detection and metadata extraction

### Performance & Caching

- Intelligent caching system with 72-hour retention
- Parallel processing for multiple files
- Retry logic for network operations
- Smart request throttling and rate limiting

### Project Structure

```
src/
├── components/          # React components
│   ├── FileList/       # File listing components
│   └── ...
├── hooks/              # Custom React hooks
├── services/           # API and business logic
│   ├── api/           # API integrations
│   └── ...
├── utils/              # Utility functions
└── contexts/           # React contexts
```

## 🚀 CI/CD & Releases

### Automated Builds

The project includes automated CI/CD workflows:

**Workflow Triggers**:
- **CI Build**: Runs on every push/PR
- **Release Build**: Triggered by git tags (`v*`)
- **Multi-platform**: Builds for Windows, macOS, and Linux simultaneously

**Creating a Release**:
```bash
git tag v1.5.4
git push origin v1.5.4
```

## 🧪 Testing

Comprehensive test suite with 42+ test cases covering:
- File detection and movie title extraction
- Multilingual subtitle directory handling  
- Complex filename processing
- Edge cases and real-world scenarios

Tests run automatically on every push and pull request.

## 🔒 Security

- 🔒 **No Hardcoded Secrets** - All API keys via environment variables
- 🛡️ **Session-Based Auth** - Secure authentication flow
- 🔐 **Environment Isolation** - Development/production separation
- 📝 **Input Validation** - Comprehensive file and data validation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 **Documentation**: [OpenSubtitles API Docs](https://api.opensubtitles.com)
- 🐛 **Issues**: [GitHub Issues](https://github.com/opensubtitles/opensubtitles-uploader-pro/issues)

## 🙏 Acknowledgments

- [OpenSubtitles.org](https://www.opensubtitles.org/) for the comprehensive subtitle database and APIs
- [OpenSubtitles.com](https://www.opensubtitles.com/) for the modern API platform and developer resources
- [React](https://reactjs.org/) for the excellent frontend framework
- [Vite](https://vitejs.dev/) for the fast development experience
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first styling approach
- [Claude Code AI](https://claude.ai/code) for development assistance and code architecture