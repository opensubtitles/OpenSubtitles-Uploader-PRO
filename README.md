# OpenSubtitles Uploader PRO

[![Tests](https://github.com/opensubtitles/opensubtitles-uploader-pro/workflows/Tests/badge.svg)](https://github.com/opensubtitles/opensubtitles-uploader-pro/actions)
[![Version](https://img.shields.io/badge/version-1.5.3-blue.svg)](https://github.com/opensubtitles/opensubtitles-uploader-pro/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-uploader.opensubtitles.org-brightgreen.svg)](https://uploader.opensubtitles.org)
[![OpenSubtitles.org API](https://img.shields.io/badge/OpenSubtitles.org-API-orange.svg)](https://www.opensubtitles.org/)
[![OpenSubtitles.com API](https://img.shields.io/badge/OpenSubtitles.com-API-blue.svg)](https://api.opensubtitles.com/)

A professional React-based subtitle uploader application that integrates with both OpenSubtitles APIs for seamless subtitle management and upload.

**🚀 [Try it live at uploader.opensubtitles.org](https://uploader.opensubtitles.org)**

**💻 Desktop App:** OpenSubtitles Uploader PRO is now available as a standalone desktop application for macOS, Windows, and Linux using Tauri! **[📦 Download Latest Release](https://github.com/opensubtitles/opensubtitles-uploader-pro/releases/latest)**

## Features

### Core Functionality
- 🎬 **Drag & Drop Interface** - Drop video and subtitle files directly into the browser
- 🔍 **Automatic File Pairing** - Smart matching of video and subtitle files based on filename similarity
- 🌍 **Language Detection** - Automatic subtitle language identification using OpenSubtitles API
- 🎯 **Movie Recognition** - Intelligent movie/episode detection with IMDb integration
- 📤 **Subtitle Upload** - Direct upload to OpenSubtitles.org with comprehensive validation

### Advanced Features
- 📹 **Video Metadata Extraction** - Automatic detection of video properties (resolution, codec, bitrate, duration)
- 🎭 **Episode Detection** - Smart TV show episode identification with season/episode numbering
- 🔗 **Movie Hash Calculation** - Generates OpenSubtitles-compatible movie hashes for precise matching
- 🏷️ **Automatic Tagging** - Detects HD quality, hearing impaired, foreign parts, and auto-translation from filenames
- 📊 **Subtitle Statistics** - Shows existing subtitle counts and language availability per movie/episode
- 🖼️ **Movie Posters** - Automatically fetches and displays movie/episode posters

### User Experience
- 🎨 **Modern UI** - Clean, responsive interface with automatic dark/light theme detection
- ⚡ **Performance Optimized** - Intelligent caching, retry logic, and parallel processing
- 🔧 **Smart Configuration** - Automatic upload options detection with manual override capabilities
- 📋 **Batch Processing** - Handle multiple video/subtitle pairs simultaneously
- 🛡️ **Ad Blocker Detection** - Automatic detection and guidance for ad blocker compatibility
- 🎯 **Upload Validation** - Comprehensive pre-upload checks to ensure successful submissions

## Quick Start

### Web Application

The easiest way to get started is with the web version:

**🚀 [Try it live at uploader.opensubtitles.org](https://uploader.opensubtitles.org)**

### Desktop Application

Download and install the native desktop application:

**📦 [Download from Releases](https://github.com/opensubtitles/opensubtitles-uploader-pro/releases)**

- **Windows x64**: `OpenSubtitles Uploader PRO_x.x.x_x64_en-US.exe` - Windows installer
- **macOS (Universal)**: `OpenSubtitles Uploader PRO_x.x.x_universal.dmg` - Intel & Apple Silicon Macs
- **Linux x64**: `opensubtitles-uploader-pro_x.x.x_amd64.AppImage` - Universal Linux binary
- **Linux x64**: `opensubtitles-uploader-pro_x.x.x_amd64.deb` - Debian/Ubuntu package

**✅ Automated Builds**: All desktop applications are automatically built using GitHub Actions for consistent, secure releases.

### Development Setup

#### Prerequisites

- Node.js 16+ and npm
- OpenSubtitles.com API account ([register here](https://www.opensubtitles.com/en/consumers))
- For desktop builds: Rust and Cargo (see [Building Desktop Apps](#building-desktop-apps))

#### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/opensubtitles/opensubtitles-uploader-pro.git
   cd opensubtitles-uploader-pro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API credentials**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env and add your OpenSubtitles API key
   # Get your API key from: https://www.opensubtitles.com/en/consumers
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:5173
   ```

## Building Desktop Apps

The application supports native desktop builds for macOS, Windows, and Linux using Tauri.

### Prerequisites for Desktop Builds

1. **Install Rust** (required for Tauri):
   ```bash
   # Option 1: Using rustup (recommended)
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source ~/.cargo/env
   
   # Option 2: Using Homebrew (macOS)
   brew install rust
   
   # Option 3: Using package manager (Linux)
   # Ubuntu/Debian:
   sudo apt install rustc cargo
   # Fedora:
   sudo dnf install rust cargo
   # Arch Linux:
   sudo pacman -S rust
   ```

2. **Install system dependencies**:
   
   **macOS**: No additional dependencies needed
   
   **Windows**: Install [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   
   **Linux**: Install system dependencies:
   ```bash
   # Ubuntu/Debian (24.04+)
   sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
   
   # Ubuntu/Debian (20.04/22.04)
   sudo apt install libwebkit2gtk-4.0-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
   
   # Fedora
   sudo dnf install webkit2gtk3-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel
   
   # Arch Linux
   sudo pacman -S webkit2gtk gtk3 libappindicator-gtk3 librsvg
   ```

### Building for Your Platform

1. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

2. **Build the desktop application**:
   ```bash
   # Development build (with console output)
   npm run tauri:dev
   
   # Production build (optimized)
   npm run tauri:build
   ```

3. **Find your built application**:
   
   **macOS**:
   - App Bundle: `src-tauri/target/release/bundle/macos/OpenSubtitles Uploader PRO.app`
   - DMG Installer: `src-tauri/target/release/bundle/dmg/OpenSubtitles Uploader PRO_x.x.x_universal.dmg`
   
   **Windows**:
   - Executable: `src-tauri/target/release/bundle/nsis/OpenSubtitles Uploader PRO_x.x.x_x64_en-US.exe`
   - MSI Installer: `src-tauri/target/release/bundle/msi/OpenSubtitles Uploader PRO_x.x.x_x64_en-US.msi`
   
   **Linux**:
   - AppImage: `src-tauri/target/release/bundle/appimage/opensubtitles-uploader-pro_x.x.x_amd64.AppImage`
   - DEB Package: `src-tauri/target/release/bundle/deb/opensubtitles-uploader-pro_x.x.x_amd64.deb`

### Cross-Platform Building

To build for different platforms:

1. **Add target platforms**:
   ```bash
   # For Windows (from macOS/Linux)
   rustup target add x86_64-pc-windows-msvc
   
   # For Linux (from macOS/Windows)
   rustup target add x86_64-unknown-linux-gnu
   
   # For macOS (from Linux/Windows)
   rustup target add x86_64-apple-darwin
   rustup target add aarch64-apple-darwin
   ```

2. **Build for specific target**:
   ```bash
   npm run tauri:build -- --target x86_64-pc-windows-msvc
   ```

### Desktop App Features

The desktop version includes all web features plus:

- **Native File System Access**: Direct file operations without browser limitations
- **System Integration**: Native file dialogs and OS notifications
- **Offline Capability**: Works without internet for local file processing
- **Performance**: Native performance for large file operations
- **Auto-Updates**: Built-in update mechanism (when configured)

### Troubleshooting Desktop Builds

**Common Issues**:

1. **Tauri Configuration Errors**: Ensure `src-tauri/tauri.conf.json` has valid plugin configurations
2. **Missing Dependencies**: Install all required system dependencies for your platform
3. **Build Failures**: Check that both Node.js and Rust are properly installed
4. **Permission Issues**: On macOS, you may need to allow the app in System Preferences > Security & Privacy

**Debug Mode**: Run `npm run tauri:dev` to see detailed error messages and console output.

## Configuration

### Environment Variables

Create a `.env` file with your API key:

```bash
# Required: OpenSubtitles.com REST API Key
VITE_OPENSUBTITLES_API_KEY=your_api_key_here
```

### Authentication

The app supports multiple authentication methods:

1. **URL Parameter**: `?sid=your_session_id` (highest priority)
2. **Browser Cookie**: `PHPSESSID` cookie
3. **Anonymous**: Falls back to anonymous access

## Usage

### Basic Upload Process

1. **Drop Files** - Drag video and subtitle files (or entire directories) into the interface
2. **Automatic Processing** - The app automatically:
   - Pairs videos with subtitles based on filename similarity
   - Extracts video metadata (resolution, codec, duration, bitrate)
   - Calculates movie hashes for precise matching
   - Detects subtitle languages using AI
   - Identifies movies/episodes with IMDb integration
   - Fetches existing subtitle statistics and movie posters
3. **Smart Configuration** - Upload options are automatically detected:
   - HD quality from video resolution and filename
   - Hearing impaired from subtitle filename patterns
   - Foreign parts from filename indicators
   - Auto-translation from subtitle content analysis
4. **Review & Customize** - Check detected information and adjust as needed:
   - Verify movie/episode matches
   - Modify upload options (HD, HI, foreign parts, etc.)
   - Edit release names, comments, and translator credits
5. **Upload** - Select desired subtitles and upload to OpenSubtitles.org with full validation

### Supported Formats

**Video Files**: `.mp4`, `.mkv`, `.avi`, `.mov`, `.webm`, `.flv`, `.wmv`, etc.
**Subtitle Files**: `.srt`, `.vtt`, `.ass`, `.ssa`, `.sub`, `.txt`, etc.

### Ad Blocker Compatibility

The application includes automatic detection for ad blockers and browser security features that may interfere with API requests:

- **Automatic Detection** - Tests connectivity to required APIs on page load
- **Browser-Specific Guidance** - Tailored instructions for Brave Shield, uBlock Origin, Adblock Plus
- **Connectivity Test Page** - Dedicated test page accessible via footer link or error notifications
- **Smart Recommendations** - Only shows warnings when actual blocking is detected

**Supported Browsers**: Works with all modern browsers including Brave (with Shield disabled for this site), Chrome, Firefox, Safari, and Edge.

**Test Connectivity**: Visit the connectivity test page via the "🛡️ Test Connectivity" link in the footer to verify your browser configuration.

## Development

### Build Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Run test suite
npm test

# Desktop app development
npm run tauri:dev

# Desktop app production build
npm run tauri:build
```

### GitHub Actions Workflows

The project includes automated CI/CD workflows for building desktop applications:

**🚀 Automated Builds**: 
- **Priority 1**: Windows x64 (`windows-latest`)
- **Priority 2**: macOS Intel + Apple Silicon (`macos-latest`)  
- **Priority 3**: Linux x64 (`ubuntu-20.04`)

**Workflow Triggers**:
- **CI Build**: Runs on every push/PR to test builds
- **Release Build**: Triggered by git tags (`v*`) or manual dispatch
- **Multi-platform**: Builds for all platforms simultaneously

**Creating a Release**:
```bash
# Tag and push to trigger automated build
git tag v1.1.3
git push origin v1.1.3

# Or use GitHub Actions UI: Actions → Build Desktop Apps → Run workflow
```

**Workflow Configuration**: See `.github/workflows/` for detailed configuration.

### Testing

The project includes a comprehensive test suite with 42 test cases covering:
- File detection and movie title extraction
- Multilingual subtitle directory handling  
- Complex filename processing
- Edge cases and real-world scenarios

Tests are automatically run on every push and pull request via GitHub Actions.

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

### Key Technologies

- **React 18** with hooks-based architecture
- **Vite** for development and build tooling
- **Tailwind CSS** for styling with automatic theme detection
- **OpenSubtitles APIs** for subtitle operations and metadata
- **FFmpeg.js** for video metadata extraction
- **GuessIt API** for intelligent file analysis
- **Local Storage** for intelligent caching and performance optimization

## API Integration

### OpenSubtitles APIs

The app integrates with two OpenSubtitles API systems:

**Legacy XML-RPC API** (`api.opensubtitles.org/xml-rpc`):
- `GetUserInfo` - Retrieve user profile and session information
- `GuessMovieFromString` - Movie identification from filename
- `TryUploadSubtitles` - Check if subtitle already exists in database
- `UploadSubtitles` - Upload new subtitles to the database
- `GetSubLanguages` - Fetch supported subtitle languages for upload

**Modern REST API** (`api.opensubtitles.com/api/v1`):
- `GET /utilities/fasttext/language/supported` - Get supported detection languages
- `POST /utilities/fasttext/language/detect/file` - AI-powered subtitle language detection
- `GET /features` - Movie/episode subtitle statistics and availability data
- `POST /utilities/guessit` - Advanced file metadata extraction and analysis

### Video Processing

**FFmpeg Integration**:
- Video metadata extraction (codec, resolution, bitrate, duration)
- Frame rate and aspect ratio detection
- Audio track information
- Container format analysis

**File Analysis**:
- Intelligent filename parsing for episode detection
- Quality indicators (HD, 4K, BluRay, WEB-DL)
- Release group and encoder identification
- Multi-language subtitle detection

### Caching Strategy

Intelligent caching system with 72-hour retention for optimal performance:
- Language detection results and supported languages
- Movie/episode metadata and poster URLs
- GuessIt analysis results and file patterns
- Video metadata and processing results
- Features data and subtitle statistics

## Security

- 🔒 **No Hardcoded Secrets** - All API keys via environment variables
- 🛡️ **Session-Based Auth** - Secure authentication flow
- 🔐 **Environment Isolation** - Development/production separation
- 📝 **Input Validation** - Comprehensive file and data validation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 **Documentation**: [OpenSubtitles API Docs](https://api.opensubtitles.com)
- 🐛 **Issues**: [GitHub Issues](https://github.com/opensubtitles/opensubtitles-uploader-pro/issues)

## Acknowledgments

- [OpenSubtitles.org](https://www.opensubtitles.org/) for the comprehensive subtitle database and APIs
- [React](https://reactjs.org/) for the excellent frontend framework
- [Vite](https://vitejs.dev/) for the fast development experience
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first styling approach
- [Claude Code AI](https://claude.ai/code) for development assistance and code architecture