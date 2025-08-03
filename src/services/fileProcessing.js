import { isMediaFile, isVideoFile, isSubtitleFile } from '../utils/fileUtils.js';
import { ZipProcessingService } from './zipProcessing.js';
import { mkvSubtitleExtractor } from './mkvSubtitleExtractor.js';

/**
 * File processing service for handling drag and drop files
 */
export class FileProcessingService {
  /**
   * Process a single file or directory entry
   */
  static async processFileHandle(item, output, path = '', config = {}) {
    try {
      let file;
      let entry;
      
      // Handle different item types
      if (item instanceof File) {
        file = item;
      } else if (item.webkitGetAsEntry) {
        entry = item.webkitGetAsEntry();
        
        if (entry && entry.isDirectory) {
          await this.traverseWebkitEntry(entry, path + entry.name + "/", output, config);
          return;
        } else if (entry && entry.isFile) {
          file = await new Promise((resolve, reject) => {
            entry.file(resolve, reject);
          });
        } else {
          return;
        }
      } else if (item.getAsFile) {
        file = item.getAsFile();
      } else {
        return;
      }
      
      if (!file) return;
      
      const fileName = file.name;
      const fileSize = file.size;
      const fileType = file.type;
      const fullPath = path + fileName;
      
      // Check if it's an archive file
      if (ZipProcessingService.isArchiveFile(file)) {
        try {
          // Validate archive file size before processing
          const sizeValidation = ZipProcessingService.validateArchiveSize(file);
          if (!sizeValidation.isValid) {
            console.error(`Archive file size validation failed: ${sizeValidation.error}`);
            return;
          }
          
          const extractedFiles = await ZipProcessingService.processArchiveFile(file);
          output.push(...extractedFiles);
        } catch (error) {
          console.error(`Error processing archive file ${fileName}:`, error);
        }
        return;
      }
      
      const { isVideo, isSubtitle, isMedia, fileKind } = isMediaFile(file);
      
      // Debug MKV detection
      if (file.name.toLowerCase().endsWith('.mkv')) {
        console.log(`🔍 MKV file detected: ${file.name}`);
        console.log(`🔍 File classification: isVideo=${isVideo}, isSubtitle=${isSubtitle}, isMedia=${isMedia}`);
      }
      
      if (isMedia) {
        const fileObj = {
          name: file.name,
          fullPath: fullPath,
          size: file.size,
          type: file.type,
          file: file,
          isVideo: isVideo,
          isSubtitle: isSubtitle,
          movieHash: null,
          detectedLanguage: fileKind ? { file_kind: fileKind } : null, // Set fileKind immediately for non-subtitle files
          recognized: true
        };
        
        output.push(fileObj);

        // Check if this is an MKV file and mark it for subtitle extraction (if enabled)
        if (isVideo && file.name.toLowerCase().endsWith('.mkv')) {
          // Check if MKV extraction is enabled in config (handle different boolean representations)
          const extractMkvSubtitles = config.extractMkvSubtitles === true || config.extractMkvSubtitles === 'true';
          
          console.log(`🔍 MKV Config Debug for ${file.name}:`);
          console.log(`   - config.extractMkvSubtitles: ${config.extractMkvSubtitles} (type: ${typeof config.extractMkvSubtitles})`);
          console.log(`   - extractMkvSubtitles resolved to: ${extractMkvSubtitles}`);
          
          if (extractMkvSubtitles) {
            // Mark this MKV file for subtitle extraction
            fileObj.hasMkvSubtitleExtraction = true;
            fileObj.mkvExtractionStatus = 'pending';
            
            console.log(`🎬 Detected MKV file: ${file.name}, will extract embedded subtitles using v1.8.1 API...`);
            console.log(`📺 Auto-extraction enabled - embedded subtitles will be detected and paired automatically`);
          } else {
            console.log(`⚠️ MKV file ${file.name} detected but extraction is disabled in settings`);
            console.log(`   - To enable: Go to Settings → Processing → Extract Subtitles from MKV`);
          }
        } else if (file.name.toLowerCase().endsWith('.mkv')) {
          console.log(`⚠️ MKV file ${file.name} not flagged for extraction: isVideo=${isVideo}`);
        }
      }
      
    } catch (error) {
      console.error(`Error processing file: ${error.message}`);
    }
  }

  /**
   * Recursive directory traversal for webkit entries
   */
  static traverseWebkitEntry(entry, path, output, config = {}) {
    return new Promise((resolve) => {
      if (entry.isFile && (isVideoFile(entry.name) || isSubtitleFile(entry.name) || entry.name.toLowerCase().endsWith('.zip'))) {
        entry.file(async (file) => {
          try {
            // Check if it's a ZIP file
            if (ZipProcessingService.isZipFile(file)) {
              // Validate ZIP file size before processing
              const sizeValidation = ZipProcessingService.validateZipSize(file);
              if (!sizeValidation.isValid) {
                console.error(`ZIP file size validation failed: ${sizeValidation.error}`);
                resolve();
                return;
              }
              
              const extractedFiles = await ZipProcessingService.processZipFile(file);
              output.push(...extractedFiles);
              resolve();
              return;
            }
            
            const { isVideo, isSubtitle } = isMediaFile(file);
            
            const fileObj = {
              name: file.name,
              fullPath: path + file.name,
              size: file.size,
              type: file.type,
              file: file,
              isVideo: isVideo,
              isSubtitle: isSubtitle,
              movieHash: null,
              detectedLanguage: null,
              recognized: true
            };
            
            output.push(fileObj);
            resolve();
          } catch (error) {
            console.error(`Error processing file ${entry.name}:`, error);
            resolve();
          }
        }, (error) => {
          console.error(`Error reading file ${entry.name}:`, error);
          resolve();
        });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const allEntries = [];
        
        const readEntries = () => {
          reader.readEntries((entries) => {
            if (entries.length === 0) {
              processAllEntries();
            } else {
              allEntries.push(...entries);
              readEntries();
            }
          }, (error) => {
            console.error(`Error reading directory ${entry.name}:`, error);
            processAllEntries();
          });
        };
        
        const processAllEntries = async () => {
          try {
            for (const subEntry of allEntries) {
              try {
                await this.traverseWebkitEntry(subEntry, path + entry.name + "/", output, config);
              } catch (error) {
                console.error(`Error processing entry ${subEntry.name}:`, error);
              }
            }
            resolve();
          } catch (error) {
            console.error(`Error processing directory entries:`, error);
            resolve();
          }
        };
        
        readEntries();
      } else {
        resolve();
      }
    });
  }

  /**
   * Process dropped files/folders
   */
  static async processDroppedItems(event, config = {}) {
    const collectedFiles = [];
    
    try {
      const items = Array.from(event.dataTransfer.items || []);
      const files = Array.from(event.dataTransfer.files || []);
      
      // Process items (preferred for directory support)
      if (items.length > 0) {
        for (const item of items) {
          if (item.kind === 'file') {
            await this.processFileHandle(item, collectedFiles, '', config);
          }
        }
      } else if (files.length > 0) {
        for (const file of files) {
          await this.processFileHandle(file, collectedFiles, '', config);
        }
      }
      
      return collectedFiles;
    } catch (error) {
      console.error('Error processing dropped items:', error);
      throw error;
    }
  }

  /**
   * Process file objects from Tauri (file paths only)
   */
  static async processFileObjects(fileObjects) {
    const collectedFiles = [];
    
    try {
      for (const fileObj of fileObjects) {
        // Extract file name from path
        const fileName = fileObj.name || fileObj.fullPath?.split('/').pop() || fileObj.path?.split('/').pop() || 'unknown';
        const filePath = fileObj.fullPath || fileObj.path || '';
        
        // Check if it's a media file based on file extension
        const { isVideo, isSubtitle, isMedia, fileKind } = isMediaFile({ name: fileName });
        
        if (isMedia) {
          const processedFile = {
            name: fileName,
            fullPath: filePath,
            size: fileObj.size || 0,
            type: fileObj.type || '',
            file: null, // No File object in Tauri, just the path
            isVideo: isVideo,
            isSubtitle: isSubtitle,
            movieHash: null,
            detectedLanguage: fileKind ? { file_kind: fileKind } : null,
            recognized: true,
            isTauriFile: true // Mark as Tauri file for special handling
          };
          
          collectedFiles.push(processedFile);
        }
      }
      
      return collectedFiles;
    } catch (error) {
      console.error('Error processing Tauri file objects:', error);
      throw error;
    }
  }

  /**
   * Process MKV files to extract embedded subtitles
   * @param {Array} files - Array of file objects 
   * @param {Function} onFileUpdate - Callback to update file status
   * @param {Function} onSubtitleExtracted - Callback when subtitle is extracted
   * @param {Function} addDebugInfo - Callback to add debug messages to UI
   * @param {Object} config - Configuration object with extractMkvSubtitles setting
   */
  static async processMkvExtractions(files, onFileUpdate, onSubtitleExtracted, addDebugInfo = null, config = {}) {
    // Check if MKV extraction is enabled in configuration
    if (!config.extractMkvSubtitles) {
      console.log(`⚠️ MKV subtitle extraction is disabled in configuration - skipping MKV processing`);
      if (addDebugInfo) {
        addDebugInfo(`⚠️ MKV subtitle extraction disabled in settings - skipping MKV files`);
      }
      return;
    }
    
    const mkvFiles = files.filter(file => file.hasMkvSubtitleExtraction);
    
    if (mkvFiles.length === 0) {
      console.log(`📝 No MKV files found for extraction`);
      return;
    }
    
    console.log(`🎬 Processing ${mkvFiles.length} MKV file(s) for subtitle extraction (enabled in config)`);
    
    for (const mkvFile of mkvFiles) {
      try {
        // Update status to detecting and notify UI immediately
        onFileUpdate(mkvFile.fullPath, { mkvExtractionStatus: 'detecting' });
        
        console.log(`🎯 Starting MKV subtitle extraction for: ${mkvFile.name} using v1.8.1 native API`);
        console.log(`🚀 Using direct extractAllSubtitles() - no separate metadata detection to avoid double file read`);
        
        // Use direct extractAllSubtitles to avoid reading the file twice
        // This function handles both detection and extraction in a single pass
        let extractionResult;
        try {
          const startTime = performance.now();
          console.log(`🔄 Calling v1.8.1 native extractAllSubtitles() function (single file read)...`);
          
          // Direct call - this reads the file once and extracts everything
          extractionResult = await mkvSubtitleExtractor.extractAllSubtitles(mkvFile.file);
          
          const duration = performance.now() - startTime;
          console.log(`⏱️ v1.8.1 native extraction completed in ${duration.toFixed(2)}ms`);
          
        } catch (error) {
          console.error(`❌ v1.8.1 native extraction failed for ${mkvFile.name}:`, error.message);
          onFileUpdate(mkvFile.fullPath, { 
            mkvExtractionStatus: 'extraction_failed',
            mkvExtractionError: error.message
          });
          if (addDebugInfo) {
            addDebugInfo(`❌ Extraction failed: ${mkvFile.name} - ${error.message}`);
          }
          continue;
        }
        
        // Check if we got results
        if (!extractionResult || !extractionResult.extractedFiles || extractionResult.extractedFiles.length === 0) {
          console.log(`📝 No subtitle streams found or extracted`);
          onFileUpdate(mkvFile.fullPath, { mkvExtractionStatus: 'no_streams' });
          if (addDebugInfo) {
            addDebugInfo(`📝 No subtitles found in ${mkvFile.name}`);
          }
          continue;
        }

        console.log(`🎉 Found and extracted ${extractionResult.extractedFiles.length} subtitle files`);
        
        // Also add to debug panel
        if (addDebugInfo) {
          addDebugInfo(`🎉 Extracted ${extractionResult.extractedFiles.length} subtitle files from ${mkvFile.name}`);
        }

        // Update status to extracting
        onFileUpdate(mkvFile.fullPath, { 
          mkvExtractionStatus: 'extracting_all',
          streamCount: extractionResult.extractedFiles.length,
          extractedCount: 0
        });

        console.log(`🎯 Processing ${extractionResult.extractedFiles.length} extracted subtitle files...`);
        if (addDebugInfo) {
          addDebugInfo(`🎯 Processing extracted files and pairing with ${mkvFile.name}...`);
        }
        
        let extractedCount = 0; // Define extractedCount in broader scope
        
        try {
          // Process the extracted files from the native API result
          const languageCounts = {}; // Track how many subtitles per language to avoid duplicates
          
          console.log(`🎯 Processing ${extractionResult.extractedFiles.length} extracted files...`);
          if (addDebugInfo) {
            addDebugInfo(`🎯 Processing ${extractionResult.extractedFiles.length} extracted files...`);
          }
          
          
          extractedCount = 0; // Reset counter (already declared above)
          
          for (const extractedFileData of extractionResult.extractedFiles) {

            // Handle different v1.8.1 API structures - file might be nested or direct
            let subtitleFile = null;
            
            if (extractedFileData && extractedFileData.file) {
              // Legacy structure: { file: File, name: string, language: string, ... }
              subtitleFile = extractedFileData.file;
            } else if (extractedFileData && extractedFileData instanceof File) {
              // Direct File structure: File object with properties
              subtitleFile = extractedFileData;
            } else if (extractedFileData && (extractedFileData.name || extractedFileData.filename) && extractedFileData.size !== undefined) {
              // Object structure: { filename: string, size: number, language: string, data: ArrayBuffer/Blob, ... }
              if (extractedFileData.data) {
                const fileName = extractedFileData.filename || extractedFileData.name;
                subtitleFile = new File([extractedFileData.data], fileName, { 
                  type: 'text/plain' 
                });
              }
            }
            
            if (subtitleFile) {
              
              // Check for empty subtitle files (0 bytes) - double check in case MKV extractor didn't catch it
              if (subtitleFile.size === 0 || extractedFileData.size === 0) {
                console.warn(`⚠️ Extracted subtitle has 0 bytes: ${extractedFileData.name}`);
                if (addDebugInfo) {
                  addDebugInfo(`⚠️ Skipped empty subtitle: ${extractedFileData.name} (0 bytes)`);
                }
                // Skip this empty subtitle and continue with next stream
                continue;
              }
              
              // Create subtitle file path in the same directory as the MKV file
              // Use MKV base name + language + extension for proper pairing
              const mkvBaseName = mkvFile.name.replace(/\.[^/.]+$/, ''); // Remove .mkv extension
              
              // Extract language from different API structures
              let langCode = 'und';
              if (extractedFileData.language && extractedFileData.language !== 'unknown') {
                langCode = extractedFileData.language;
              } else if (subtitleFile.language && subtitleFile.language !== 'unknown') {
                langCode = subtitleFile.language;
              }
              
              // Extract filename from different API structures
              let originalName = extractedFileData.filename || extractedFileData.name || subtitleFile.name || `stream_${extractedCount}.srt`;
              
              // Get stream index for better naming
              const streamIndex = extractedFileData.streamIndex || subtitleFile.streamIndex || extractedCount;
              
              // Handle multiple subtitles with same language by using track/stream index
              if (!languageCounts[langCode]) {
                languageCounts[langCode] = 0;
              }
              languageCounts[langCode]++;
              
              // Use stream index for disambiguation instead of simple numbering
              let subtitleName;
              if (languageCounts[langCode] === 1) {
                // First subtitle with this language - no suffix needed
                subtitleName = `${mkvBaseName}.${langCode}.srt`;
              } else {
                // Multiple subtitles with same language - use track index for clarity
                subtitleName = `${mkvBaseName}.track${streamIndex}.${langCode}.srt`;
              }
              
              console.log(`📝 Generated subtitle name: ${subtitleName} (stream ${streamIndex}, language ${langCode})`);
              
              const basePath = mkvFile.fullPath.includes('/') ? 
                mkvFile.fullPath.substring(0, mkvFile.fullPath.lastIndexOf('/') + 1) : '';
              const subtitlePath = basePath + subtitleName;

              // Create subtitle file object that will pair with the MKV file
              const subtitleObj = {
                name: subtitleName,
                fullPath: subtitlePath,
                size: subtitleFile.size,
                type: subtitleFile.type,
                file: new File([subtitleFile], subtitleName, { type: subtitleFile.type }), // Rename the file
                isVideo: false,
                isSubtitle: true,
                movieHash: null,
                detectedLanguage: null, // Will be detected later
                recognized: true,
                extractedFromMkv: true, // Mark as extracted from MKV
                originalMkvFile: mkvFile.name,
                streamIndex: extractedFileData.streamIndex || subtitleFile.streamIndex || extractedCount,
                language: langCode,
                pairedWithMkv: true // Mark as auto-paired with MKV
              };

              // Add the extracted subtitle to the file list
              onSubtitleExtracted(subtitleObj);
              extractedCount++;
              
              console.log(`✅ Extracted and paired: ${subtitleName} (${langCode})`);
              if (addDebugInfo) {
                addDebugInfo(`✅ Extracted: ${subtitleName} (${langCode})`);
              }
              
              // Update progress
              onFileUpdate(mkvFile.fullPath, { 
                mkvExtractionStatus: 'extracting_all',
                extractedCount: extractedCount,
                streamCount: extractionResult.extractedFiles.length
              });
            } else {
              // extractedFileData is null, missing file, or has unsupported structure
              console.warn(`⚠️ Skipping invalid subtitle data:`, {
                name: extractedFileData?.filename || extractedFileData?.name || 'unknown',
                hasFile: !!extractedFileData?.file,
                isFile: extractedFileData instanceof File,
                hasData: !!extractedFileData?.data,
                hasSize: extractedFileData?.size !== undefined,
                keys: Object.keys(extractedFileData || {})
              });
              if (addDebugInfo) {
                addDebugInfo(`⚠️ Skipped invalid subtitle data: ${extractedFileData?.filename || extractedFileData?.name || 'unknown'} (unsupported structure)`);
              }
            }
          }
          
        } catch (batchError) {
          console.error(`❌ Batch extraction failed for ${mkvFile.name}:`, batchError.message);
          if (addDebugInfo) {
            addDebugInfo(`❌ Batch extraction failed: ${batchError.message}`);
          }
          
          // Mark extraction as failed
          onFileUpdate(mkvFile.fullPath, { 
            mkvExtractionStatus: 'extraction_failed',
            extractedCount: 0,
            streamCount: detectedStreams.length
          });
          
          continue; // Skip to next MKV file
        }

        // Update final status
        onFileUpdate(mkvFile.fullPath, { 
          mkvExtractionStatus: 'completed',
          streamCount: extractionResult.extractedFiles.length,
          extractedCount: extractedCount
        });

        console.log(`🎉 v1.8.1 native extraction completed: ${extractedCount}/${extractionResult.extractedFiles.length} subtitles extracted and paired`);
        if (addDebugInfo) {
          addDebugInfo(`🎉 v1.8.1 extraction completed: ${extractedCount}/${extractionResult.extractedFiles.length} subtitles extracted and paired`);
        }

        // Cleanup notification (batch extraction handles its own cleanup automatically)
        console.log(`🧹 Batch extraction completed with automatic cleanup`);

      } catch (error) {
        console.error(`❌ Failed to extract subtitles from MKV file ${mkvFile.name}:`, error);
        onFileUpdate(mkvFile.fullPath, { mkvExtractionStatus: 'error', mkvExtractionError: error.message });
      }
    }
  }

  /**
   * Extract subtitles from MKV file asynchronously (legacy method)
   */
  static async _extractMkvSubtitles(mkvFile, mkvPath, output) {
    try {
      console.log(`🎯 Starting MKV subtitle extraction for: ${mkvFile.name}`);
      
      // Extract subtitles using the MKV subtitle extractor
      const extractedSubtitles = await mkvSubtitleExtractor.extractSubtitles(mkvFile);
      
      if (extractedSubtitles.length === 0) {
        console.log(`📝 No subtitles found in MKV file: ${mkvFile.name}`);
        return;
      }

      // Process each extracted subtitle
      for (const subtitleData of extractedSubtitles) {
        const subtitleFile = subtitleData.file;
        const basePath = mkvPath.replace(/\/[^/]*$/, '/'); // Get directory path
        const subtitlePath = basePath + subtitleFile.name;

        // Create subtitle file object in the same format as other files
        const subtitleObj = {
          name: subtitleFile.name,
          fullPath: subtitlePath,
          size: subtitleFile.size,
          type: subtitleFile.type,
          file: subtitleFile,
          isVideo: false,
          isSubtitle: true,
          movieHash: null,
          detectedLanguage: null, // Will be detected later
          recognized: true,
          extractedFromMkv: true, // Mark as extracted from MKV
          originalMkvFile: mkvFile.name,
          streamIndex: subtitleData.streamIndex,
          language: subtitleData.language
        };

        output.push(subtitleObj);
        console.log(`✅ Extracted subtitle: ${subtitleFile.name} (${subtitleData.language})`);
      }

      console.log(`🎉 Extracted ${extractedSubtitles.length} subtitles`);

    } catch (error) {
      console.error(`❌ Failed to extract subtitles from MKV file ${mkvFile.name}:`, error);
      // Don't throw error - extraction failure shouldn't prevent file processing
    }
  }

  /**
   * Check browser capabilities for file handling
   */
  static getBrowserCapabilities() {
    const userAgent = navigator.userAgent;
    const isFirefox = userAgent.includes('Firefox');
    const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Edg');
    const isEdge = userAgent.includes('Edg');
    const isBrave = userAgent.includes('Brave') || (userAgent.includes('Chrome') && !userAgent.includes('Edg') && !window.chrome?.webstore);
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    
    let browser = 'Unknown';
    if (isFirefox) browser = 'Firefox';
    else if (isBrave) browser = 'Brave';
    else if (isEdge) browser = 'Edge';
    else if (isChrome) browser = 'Chrome';
    else if (isSafari) browser = 'Safari';
    
    const hasFileSystemAPI = 'getAsFileSystemHandle' in DataTransferItem.prototype;
    const hasWebkitGetAsEntry = 'webkitGetAsEntry' in DataTransferItem.prototype;
    
    return {
      browser,
      hasFileSystemAPI,
      hasWebkitGetAsEntry,
      supportsDirectories: hasFileSystemAPI || hasWebkitGetAsEntry
    };
  }
}

