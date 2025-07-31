import { useState, useCallback, useEffect, useRef } from 'react';
import { FileProcessingService } from '../services/fileProcessing.js';
import { pairVideoAndSubtitleFiles } from '../utils/fileUtils.js';

/**
 * Custom hook for file handling functionality
 */
export const useFileHandling = (addDebugInfo, config = {}) => {
  const [files, setFiles] = useState([]);
  
  const [pairedFiles, setPairedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [browserCapabilities] = useState(() => FileProcessingService.getBrowserCapabilities());
  const lastProcessedFiles = useRef('');

  // Auto-update pairs when files change
  useEffect(() => {
    // Create a unique signature for the current files to prevent duplicate processing
    // Include movieHash and detectedLanguage so pairs update when these are calculated
    const currentFilesSignature = files.map(f => 
      f.fullPath + f.size + (f.movieHash || 'null') + (f.detectedLanguage ? JSON.stringify(f.detectedLanguage) : 'null')
    ).join('|');
    
    // Skip if we've already processed these exact files
    if (lastProcessedFiles.current === currentFilesSignature) {
      return;
    }
    
    lastProcessedFiles.current = currentFilesSignature;
    
    const newPairs = pairVideoAndSubtitleFiles(files);
    setPairedFiles(newPairs);
  }, [files, addDebugInfo]);

  // Handle file drop
  const handleDrop = useCallback(async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    
    const isTauriEnv = window.location.protocol === 'tauri:';
    
    console.log('🎯 DROP EVENT TRIGGERED:', {
      isTauriEnv,
      eventType: event.type,
      dataTransfer: !!event.dataTransfer,
      items: event.dataTransfer?.items?.length || 0,
      files: event.dataTransfer?.files?.length || 0,
      dataTransferTypes: event.dataTransfer?.types || [],
      protocol: window.location.protocol
    });
    
    addDebugInfo(`Drop event triggered in ${isTauriEnv ? 'Tauri' : 'browser'} environment`);
    
    try {
      // For Tauri, ensure we have proper file data
      if (isTauriEnv) {
        console.log('🔥 TAURI DROP EVENT - Checking file data availability...');
        
        // Tauri should provide files through the standard DataTransfer API
        if (!event.dataTransfer || (!event.dataTransfer.files?.length && !event.dataTransfer.items?.length)) {
          console.error('❌ No files found in Tauri drop event');
          addDebugInfo("No files found in drop event");
          throw new Error("No files were provided in the drop event.");
        }
        
        console.log('✅ Files available in Tauri drop event');
      }
      
      console.log('🎯 Starting file processing...');
      const collectedFiles = await FileProcessingService.processDroppedItems(event, config);
      console.log('🎯 File processing completed. Collected files:', collectedFiles.length);
      
      addDebugInfo(`Collected ${collectedFiles.length} valid media files`);
      console.log('📁 Collected files:', collectedFiles.map(f => ({ name: f.name, path: f.fullPath, type: f.type })));
      
      if (collectedFiles.length > 0) {
        setFiles(collectedFiles);
        addDebugInfo(`Set ${collectedFiles.length} files`);
        
        // Process MKV files for subtitle extraction
        const mkvFiles = collectedFiles.filter(file => file.hasMkvSubtitleExtraction);
        const allMkvFiles = collectedFiles.filter(file => file.name.toLowerCase().endsWith('.mkv'));
        
        console.log(`🔍 MKV file analysis:`);
        console.log(`🔍 Total files: ${collectedFiles.length}`);
        console.log(`🔍 Files ending with .mkv: ${allMkvFiles.length}`);
        console.log(`🔍 Files flagged for MKV extraction: ${mkvFiles.length}`);
        allMkvFiles.forEach(file => {
          console.log(`🔍 MKV file: ${file.name} - hasMkvSubtitleExtraction: ${file.hasMkvSubtitleExtraction}, isVideo: ${file.isVideo}`);
        });
        
        if (mkvFiles.length > 0) {
          addDebugInfo(`Starting MKV subtitle detection and auto-extraction for ${mkvFiles.length} file(s)`);
          
          // Start MKV detection and auto-extraction process asynchronously
          setTimeout(() => {
            FileProcessingService.processMkvExtractions(
              collectedFiles,
              // onFileUpdate callback
              (filePath, updates) => {
                setFiles(prevFiles => 
                  prevFiles.map(file => 
                    file.fullPath === filePath ? { ...file, ...updates } : file
                  )
                );
                if (updates.mkvExtractionStatus === 'extracting_all' && updates.extractedCount !== undefined) {
                  addDebugInfo(`MKV extraction progress: ${updates.extractedCount}/${updates.streamCount} subtitles extracted`);
                } else {
                  addDebugInfo(`MKV status update: ${updates.mkvExtractionStatus}`);
                }
              },
              // onSubtitleExtracted callback
              (subtitleFile) => {
                setFiles(prevFiles => [...prevFiles, subtitleFile]);
                addDebugInfo(`Auto-extracted and paired: ${subtitleFile.name} (${subtitleFile.language}) from ${subtitleFile.originalMkvFile}`);
              },
              // addDebugInfo callback
              addDebugInfo,
              // config parameter
              config
            ).then(() => {
              addDebugInfo(`🎉 MKV processing completed successfully`);
            }).catch(error => {
              console.error('MKV processing failed:', error);
              addDebugInfo(`MKV processing failed: ${error.message}`);
            });
          }, 100); // Small delay to ensure UI updates first
        }
      } else {
        addDebugInfo("No valid media files found");
        throw new Error("No video or subtitle files found in the dropped items.");
      }
    } catch (error) {
      console.error('❌ Drop processing error:', error);
      addDebugInfo(`Error processing dropped items: ${error.message}`);
      throw error;
    }
  }, [addDebugInfo, config]);

  // Handle drag over
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isTauriEnv = window.location.protocol === 'tauri:';
    
    
    setIsDragOver(true);
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
    addDebugInfo("Cleared all files");
  }, [addDebugInfo]);

  // Update file data with better state management
  const updateFile = useCallback((fullPath, updates) => {
    setFiles(prevFiles => {
      return prevFiles.map(file => {
        if (file.fullPath === fullPath) {
          return { ...file, ...updates };
        }
        return file;
      });
    });
  }, []);

  // Update files in batch
  const updateFiles = useCallback((updates) => {
    setFiles(prevFiles => 
      prevFiles.map(file => {
        const update = updates.find(u => u.fullPath === file.fullPath);
        return update ? { ...file, ...update.data } : file;
      })
    );
  }, []);


  return {
    files,
    pairedFiles,
    isDragOver,
    browserCapabilities,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    clearFiles,
    updateFile,
    updateFiles,
    setFiles // Keep for edge cases, but prefer updateFile
  };
};