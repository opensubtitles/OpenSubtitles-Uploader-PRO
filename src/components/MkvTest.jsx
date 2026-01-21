import React, { useState } from 'react';
import { useOptimizedVideoMetadata } from '@opensubtitles/video-metadata-extractor';

/**
 * MKV Extraction Test Component
 * Uses the same hook as the working demo
 */
export function MkvTest() {
  const [file, setFile] = useState(null);
  const [logs, setLogs] = useState([]);

  // Use the same hook as the working demo
  const {
    metadata,
    progress,
    error,
    handleFileSelect,
    extractAllSubtitles,
    isLoaded,
  } = useOptimizedVideoMetadata();

  const log = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, type };
    setLogs(prev => [...prev, logEntry]);
    console.log(`${timestamp} - ${message}`);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    log('📥 File dropped', 'info');
    const droppedFile = e.dataTransfer.files[0];

    if (droppedFile) {
      log(`✅ Got file: ${droppedFile.name}`, 'success');
      log(`📊 Size: ${(droppedFile.size / 1024 / 1024).toFixed(2)} MB`, 'info');
      setFile(droppedFile);

      // Use the hook's handleFileSelect to process metadata first
      log('📦 Loading metadata...', 'info');
      handleFileSelect(droppedFile);
    }
  };

  const extractSubtitles = async () => {
    if (!file) {
      log('❌ No file selected', 'error');
      return;
    }

    try {
      log('🚀 Starting subtitle extraction using hook...', 'info');
      await extractAllSubtitles(file);
      log('✅ Extraction completed!', 'success');
    } catch (err) {
      log(`❌ Extraction failed: ${err.message}`, 'error');
      console.error('Full error:', err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileInput = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      log(`✅ Got file from input: ${selectedFile.name}`, 'success');
      setFile(selectedFile);
      handleFileSelect(selectedFile);
    }
  };

  const clearFile = () => {
    setFile(null);
    log('🗑️ Cleared file', 'info');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🎬 MKV Subtitle Extraction Test</h1>
      <p>Using useOptimizedVideoMetadata hook from npm package</p>
      <p>FFmpeg loaded: {isLoaded ? '✅ Yes' : '❌ No'}</p>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          border: '3px dashed #ccc',
          borderRadius: '10px',
          padding: '50px',
          textAlign: 'center',
          margin: '20px 0',
          background: '#f9f9f9',
        }}
      >
        <h2>📁 Drop MKV file here</h2>
        <p>or</p>
        <input
          type="file"
          accept=".mkv,.mp4,.avi"
          onChange={handleFileInput}
          style={{ display: 'none' }}
          id="fileInput"
        />
        <button
          onClick={() => document.getElementById('fileInput').click()}
          style={{
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Choose File
        </button>
      </div>

      {/* File Info */}
      {file && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: '5px',
            padding: '15px',
            margin: '20px 0',
          }}
        >
          <h3>File Information</h3>
          <p><strong>Name:</strong> {file.name}</p>
          <p><strong>Size:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB</p>
          <p><strong>Type:</strong> {file.type || 'unknown'}</p>

          {metadata && (
            <div style={{ marginTop: '15px', padding: '10px', background: '#e8f5e9', borderRadius: '5px' }}>
              <h4>Metadata Loaded:</h4>
              <p>Subtitle streams: {metadata.streams?.filter(s => s.codec_type === 'subtitle').length || 0}</p>
            </div>
          )}

          <div style={{ marginTop: '10px' }}>
            <button
              onClick={extractSubtitles}
              disabled={!isLoaded}
              style={{
                background: isLoaded ? '#4CAF50' : '#ccc',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: isLoaded ? 'pointer' : 'not-allowed',
                margin: '5px',
              }}
            >
              Extract Subtitles
            </button>
            <button
              onClick={clearFile}
              style={{
                background: '#f44336',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                margin: '5px',
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Progress */}
      {progress.isVisible && (
        <div style={{ margin: '20px 0', padding: '15px', background: '#e3f2fd', borderRadius: '5px' }}>
          <p>{progress.text}</p>
          <div style={{ background: '#ccc', borderRadius: '5px', overflow: 'hidden' }}>
            <div style={{
              background: '#2196F3',
              width: `${progress.progress}%`,
              height: '20px',
              transition: 'width 0.3s',
            }}></div>
          </div>
        </div>
      )}

      {/* Error */}
      {error.isVisible && (
        <div
          style={{
            background: '#ffebee',
            border: '1px solid #f44336',
            color: '#c62828',
            padding: '15px',
            borderRadius: '5px',
            margin: '20px 0',
          }}
        >
          <h3>❌ Error</h3>
          <p>{error.message}</p>
        </div>
      )}

      {/* Console Log */}
      <div
        style={{
          background: '#000',
          color: '#0f0',
          padding: '15px',
          borderRadius: '5px',
          fontFamily: 'monospace',
          fontSize: '12px',
          maxHeight: '400px',
          overflowY: 'auto',
          margin: '20px 0',
        }}
      >
        {logs.map((entry, idx) => (
          <div
            key={idx}
            style={{
              color:
                entry.type === 'error'
                  ? '#f44336'
                  : entry.type === 'success'
                    ? '#4CAF50'
                    : '#0f0',
            }}
          >
            {entry.timestamp} - {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MkvTest;
