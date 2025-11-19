# OpenSubtitles Uploader PRO - Tests

This directory contains test utilities and debugging tools for the OpenSubtitles Uploader PRO application.

## Test Suites

### 🔍 Drag & Drop Debug (`drag-drop-debug/`)

**Purpose**: Debug and test multi-directory drag-and-drop functionality across different browsers.

**Key Features**:
- Visual drag-and-drop zone
- Real-time debug logging
- Browser compatibility testing
- Chrome invalidation bug fix demonstration

**Status**: ✅ Fixed - Chrome multi-directory bug resolved

**Usage**:
```bash
open tests/drag-drop-debug/drag-drop-test.html
```

**Related Files**:
- `drag-drop-test.html` - Interactive test page
- `README.md` - Detailed documentation

**What It Tests**:
- Multi-directory drag-and-drop
- Chrome DataTransferItemList invalidation
- Recursive directory traversal
- File collection accuracy

## Running Tests

### Manual Testing

1. **Drag-Drop Test**:
   ```bash
   open tests/drag-drop-debug/drag-drop-test.html
   ```
   Drag multiple directories to test browser compatibility.

### Automated Testing

```bash
npm test
```

## Adding New Tests

When adding new test utilities:

1. Create a new directory under `tests/`
2. Add a descriptive `README.md` explaining the test
3. Update this main `tests/README.md`
4. Include usage instructions and examples

## Test Organization

```
tests/
├── README.md                    # This file
├── drag-drop-debug/            # Browser drag-drop testing
│   ├── drag-drop-test.html    # Interactive test page
│   └── README.md              # Test documentation
└── [future-tests]/            # Additional test suites
```

## Browser Compatibility Testing

Current browser support testing includes:
- ✅ Chrome 141+ (with multi-directory fix)
- ✅ Firefox 145+
- ✅ Safari (webkit-based)
- ✅ Edge (Chromium-based)

## Known Issues & Fixes

### Chrome Multi-Directory Drag-Drop ✅ FIXED

**Issue**: Chrome invalidated `DataTransferItemList` after async operations, causing only the first directory to be processed when dropping multiple directories.

**Fix**: Two-phase processing - capture all entries synchronously, then process asynchronously.

**Location**: `src/services/fileProcessing.js:235-283`

**Test**: `tests/drag-drop-debug/drag-drop-test.html`

## Contributing

When fixing browser-specific issues:

1. Create a test case in `tests/`
2. Document the bug and fix
3. Update relevant READMEs
4. Ensure fix works across all supported browsers
