import { XmlRpcService } from './api/xmlrpc.js';
import { SubtitleHashService } from './subtitleHash.js';
import { HD_DETECTION_REGEX } from '../utils/constants.js';

/**
 * Service for uploading subtitles to OpenSubtitles
 */
export class SubtitleUploadService {
  
  /**
   * Process upload for all selected subtitles
   * @param {Object} validationResult - Validation result from UploadButton
   * @param {Array} pairedFiles - Array of paired video/subtitle files
   * @param {Object} movieGuesses - Movie identification data
   * @param {Object} featuresByImdbId - Features data by IMDb ID
   * @param {Object} guessItData - GuessIt metadata
   * @param {Function} getSubtitleLanguage - Function to get subtitle language
   * @param {Function} getUploadEnabled - Function to check if upload is enabled
   * @param {Object} combinedLanguages - Combined language data
   * @param {Function} addDebugInfo - Debug callback
   * @returns {Promise<Object>} - Upload results
   */
  static async processUpload({
    validationResult,
    pairedFiles,
    orphanedSubtitles = [],
    movieGuesses,
    featuresByImdbId,
    guessItData,
    getSubtitleLanguage,
    getUploadEnabled,
    uploadOptions,
    combinedLanguages,
    addDebugInfo,
    onProgress,
    getVideoMetadata, // Add video metadata getter
    orphanedSubtitlesFps = {}, // Add FPS settings for orphaned subtitles
    config = {} // Add config object for settings
  }) {
    const results = {
      success: [],
      errors: [],
      totalSubtitles: 0,
      processedSubtitles: 0,
      successful: 0,
      alreadyExists: 0,
      failed: 0,
      detailedResults: []
    };

    addDebugInfo('🚀 Starting subtitle upload process...');

    try {
      // Group enabled subtitles by video file
      const videoGroups = new Map();
      pairedFiles.forEach(pair => {
        if (pair.video && pair.subtitles.length > 0) {
          const enabledSubtitles = pair.subtitles.filter(subtitle => getUploadEnabled(subtitle.fullPath));
          if (enabledSubtitles.length > 0) {
            videoGroups.set(pair.video.fullPath, {
              video: pair.video,
              subtitles: enabledSubtitles,
              movieData: movieGuesses[pair.video.fullPath]
            });
          }
        }
      });

      // Handle orphaned subtitles
      const enabledOrphanedSubtitles = orphanedSubtitles.filter(subtitle => getUploadEnabled(subtitle.fullPath));
      
      results.totalSubtitles = Array.from(videoGroups.values()).reduce((sum, group) => sum + group.subtitles.length, 0) + enabledOrphanedSubtitles.length;
      addDebugInfo(`📊 Found ${results.totalSubtitles} subtitles to upload across ${videoGroups.size} video files + ${enabledOrphanedSubtitles.length} orphaned subtitles`);

      // Process each video group
      for (const [videoPath, { video, subtitles, movieData }] of videoGroups) {
        addDebugInfo(`🎬 Processing video: ${video.name}`);
        
        try {
          // Process each subtitle individually (using cd1 for each)
          const subtitleResults = [];
          
          for (const subtitle of subtitles) {
            addDebugInfo(`📤 Attempting upload for subtitle: ${subtitle.name}`);
            
            const uploadData = await this.prepareUploadDataForSingleSubtitle({
              video,
              subtitle,
              movieData,
              guessItData,
              featuresByImdbId,
              getSubtitleLanguage,
              uploadOptions,
              combinedLanguages,
              addDebugInfo,
              getVideoMetadata
            });

            const tryUploadResponse = await XmlRpcService.tryUploadSubtitles(uploadData);
            
            addDebugInfo(`✅ TryUpload response received for ${subtitle.name}:`);
            addDebugInfo(JSON.stringify(tryUploadResponse, null, 2));
            
            let finalResponse = tryUploadResponse;
            let actualUploadData = null;
            let actualUploadResponse = null;
            
            // If alreadyindb=0, need to do actual upload with UploadSubtitles
            if (tryUploadResponse.alreadyindb === 0 || tryUploadResponse.alreadyindb === '0') {
              // Check if uploadMovieHashOnly is enabled
              if (config.uploadMovieHashOnly === true) {
                addDebugInfo(`⚙️ Upload MovieHash Only mode enabled - skipping UploadSubtitles for ${subtitle.name}`);
                addDebugInfo(`✅ Movie hash updated for ${subtitle.name}, subtitle file not uploaded`);
                // Use TryUpload response but mark as hash-only success
                finalResponse = {
                  ...tryUploadResponse,
                  status: '200 OK',
                  data: 'Movie hash updated (subtitle not uploaded)',
                  hashOnlyMode: true
                };
              } else {
                addDebugInfo(`📤 Subtitle not in database, proceeding with UploadSubtitles for ${subtitle.name}`);
                
                actualUploadData = await this.prepareActualUploadData({
                  video,
                  subtitle,
                  movieData,
                  guessItData,
                  featuresByImdbId,
                  getSubtitleLanguage,
                  uploadOptions,
                  combinedLanguages,
                  addDebugInfo,
                  getVideoMetadata
                });
                
                actualUploadResponse = await XmlRpcService.uploadSubtitles(actualUploadData);
                
                addDebugInfo(`✅ UploadSubtitles response received for ${subtitle.name}:`);
                addDebugInfo(JSON.stringify(actualUploadResponse, null, 2));
                
                finalResponse = actualUploadResponse;
              }
            } else {
              addDebugInfo(`✅ Subtitle already in database for ${subtitle.name} (alreadyindb=${tryUploadResponse.alreadyindb})`);
            }
            
            subtitleResults.push({
              subtitle: subtitle.name,
              subtitlePath: subtitle.fullPath,
              response: finalResponse,
              // Include the exact subcontent that was sent for debugging (only if actual upload happened)
              subcontent: actualUploadData ? actualUploadData.subcontent : null
            });
            
            results.processedSubtitles++;
            
            // Analyze result and update counters
            const response = finalResponse;
            let status = 'unknown';
            let message = 'Upload completed';
            let url = null;
            
            if (response.status && response.status !== '200 OK') {
              status = 'failed';
              message = `Upload failed - ${response.status}`;
              results.failed++;
            } else if (response.alreadyindb === 1 || response.alreadyindb === '1') {
              status = 'exists';
              message = 'Already in database';
              results.alreadyExists++;
              url = typeof response.data === 'string' && response.data.startsWith('http') ? response.data : null;
            } else if (response.status === '200 OK' && response.data && !response.alreadyindb) {
              status = 'success';
              message = 'Successfully uploaded as new subtitle';
              results.successful++;
              url = typeof response.data === 'string' && response.data.startsWith('http') ? response.data : null;
            } else {
              // Handle other cases
              results.successful++;
              status = 'success';
              message = 'Upload completed';
            }
            
            // Add to detailed results
            results.detailedResults.push({
              filename: subtitle.name,
              status,
              message,
              url
            });
            
            // Update progress with detailed information
            if (onProgress) {
              onProgress(results.processedSubtitles, results.totalSubtitles, {
                currentSubtitle: subtitle.name,
                successful: results.successful,
                alreadyExists: results.alreadyExists,
                failed: results.failed,
                results: results.detailedResults
              });
            }
          }
          
          results.success.push({
            video: video.name,
            subtitles: subtitles.length,
            results: subtitleResults
          });
          
        } catch (error) {
          // Enhanced error logging for NetworkError
          if (error.name === 'TypeError' && error.message.includes('fetch')) {
            addDebugInfo(`❌ NetworkError during upload for ${video.name}: ${error.message}`);
            addDebugInfo(`❌ This is likely a network connectivity issue, not an API error`);
            addDebugInfo(`❌ The upload may have actually succeeded - check the results`);
          } else {
            addDebugInfo(`❌ Upload failed for ${video.name}: ${error.message}`);
          }
          
          results.errors.push({
            video: video.name,
            subtitles: subtitles.length,
            error: error.message,
            stack: error.stack,
            errorType: error.name,
            isNetworkError: error.name === 'TypeError' && error.message.includes('fetch')
          });
          
          // Update progress for each failed subtitle in this video
          subtitles.forEach(subtitle => {
            results.processedSubtitles++;
            results.failed++;
            
            // Add to detailed results
            results.detailedResults.push({
              filename: subtitle.name,
              status: 'failed',
              message: error.name === 'TypeError' && error.message.includes('fetch') 
                ? `NetworkError: ${error.message} (Upload may have succeeded despite this error)`
                : `Upload failed: ${error.message}`,
              url: null,
              errorType: error.name,
              isNetworkError: error.name === 'TypeError' && error.message.includes('fetch')
            });
            
            // Update progress with detailed information
            if (onProgress) {
              onProgress(results.processedSubtitles, results.totalSubtitles, {
                currentSubtitle: subtitle.name,
                successful: results.successful,
                alreadyExists: results.alreadyExists,
                failed: results.failed,
                results: results.detailedResults
              });
            }
          });
        }
      }

      // Process orphaned subtitles
      for (const subtitle of enabledOrphanedSubtitles) {
        addDebugInfo(`📝 Processing orphaned subtitle: ${subtitle.name}`);
        
        try {
          const movieData = movieGuesses[subtitle.fullPath];
          
          if (!movieData || movieData === 'guessing' || movieData === 'error' || movieData === 'no-match') {
            throw new Error(`Subtitle movie not identified for orphaned subtitle: ${subtitle.name}`);
          }

          addDebugInfo(`📤 Attempting upload for orphaned subtitle: ${subtitle.name}`);
          
          const uploadData = await this.prepareUploadDataForOrphanedSubtitle({
            subtitle,
            movieData,
            guessItData,
            featuresByImdbId,
            getSubtitleLanguage,
            uploadOptions,
            combinedLanguages,
            addDebugInfo,
            orphanedSubtitlesFps
          });

          const tryUploadResponse = await XmlRpcService.tryUploadSubtitles(uploadData);
          
          addDebugInfo(`✅ TryUpload response received for ${subtitle.name}:`);
          addDebugInfo(JSON.stringify(tryUploadResponse, null, 2));
          
          let finalResponse = tryUploadResponse;
          let actualUploadData = null;
          let actualUploadResponse = null;
          
          // If alreadyindb=0, need to do actual upload with UploadSubtitles
          if (tryUploadResponse.alreadyindb === 0 || tryUploadResponse.alreadyindb === '0') {
            // Check if uploadMovieHashOnly is enabled
            if (config.uploadMovieHashOnly === true) {
              addDebugInfo(`⚙️ Upload MovieHash Only mode enabled - skipping UploadSubtitles for orphaned ${subtitle.name}`);
              addDebugInfo(`✅ Movie hash updated for orphaned ${subtitle.name}, subtitle file not uploaded`);
              // Use TryUpload response but mark as hash-only success
              finalResponse = {
                ...tryUploadResponse,
                status: '200 OK',
                data: 'Movie hash updated (subtitle not uploaded)',
                hashOnlyMode: true
              };
            } else {
              addDebugInfo(`📤 Orphaned subtitle not in database, proceeding with UploadSubtitles for ${subtitle.name}`);
              
              actualUploadData = await this.prepareActualUploadDataForOrphanedSubtitle({
                subtitle,
                movieData,
                guessItData,
                featuresByImdbId,
                getSubtitleLanguage,
                uploadOptions,
                combinedLanguages,
                addDebugInfo,
                orphanedSubtitlesFps
              });
              
              actualUploadResponse = await XmlRpcService.uploadSubtitles(actualUploadData);
              
              addDebugInfo(`✅ UploadSubtitles response received for ${subtitle.name}:`);
              addDebugInfo(JSON.stringify(actualUploadResponse, null, 2));
              
              finalResponse = actualUploadResponse;
            }
          } else {
            addDebugInfo(`✅ Orphaned subtitle already in database for ${subtitle.name} (alreadyindb=${tryUploadResponse.alreadyindb})`);
          }
          
          results.success.push({
            video: `Orphaned: ${subtitle.name}`,
            subtitles: 1,
            results: [{
              subtitle: subtitle.name,
              subtitlePath: subtitle.fullPath,
              response: finalResponse,
              subcontent: actualUploadData ? actualUploadData.subcontent : null
            }]
          });
          
          results.processedSubtitles++;
          
          // Analyze result and update counters
          const response = finalResponse;
          let status = 'unknown';
          let message = 'Upload completed';
          let url = null;
          
          if (response.status && response.status !== '200 OK') {
            status = 'failed';
            message = `Upload failed - ${response.status}`;
            results.failed++;
          } else if (response.alreadyindb === 1 || response.alreadyindb === '1') {
            status = 'exists';
            message = 'Already in database';
            results.alreadyExists++;
            url = typeof response.data === 'string' && response.data.startsWith('http') ? response.data : null;
          } else if (response.status === '200 OK' && response.data && !response.alreadyindb) {
            status = 'success';
            message = 'Successfully uploaded as new subtitle';
            results.successful++;
            url = typeof response.data === 'string' && response.data.startsWith('http') ? response.data : null;
          } else {
            // Handle other cases
            results.successful++;
            status = 'success';
            message = 'Upload completed';
          }
          
          // Add to detailed results
          results.detailedResults.push({
            filename: subtitle.name,
            status,
            message,
            url
          });
          
          // Update progress with detailed information
          if (onProgress) {
            onProgress(results.processedSubtitles, results.totalSubtitles, {
              currentSubtitle: subtitle.name,
              successful: results.successful,
              alreadyExists: results.alreadyExists,
              failed: results.failed,
              results: results.detailedResults
            });
          }
          
        } catch (error) {
          // Enhanced error logging for NetworkError
          if (error.name === 'TypeError' && error.message.includes('fetch')) {
            addDebugInfo(`❌ NetworkError during upload for orphaned subtitle ${subtitle.name}: ${error.message}`);
            addDebugInfo(`❌ This is likely a network connectivity issue, not an API error`);
            addDebugInfo(`❌ The upload may have actually succeeded - check the results`);
          } else {
            addDebugInfo(`❌ Upload failed for orphaned subtitle ${subtitle.name}: ${error.message}`);
          }
          
          results.errors.push({
            video: `Orphaned: ${subtitle.name}`,
            subtitles: 1,
            error: error.message,
            stack: error.stack,
            errorType: error.name,
            isNetworkError: error.name === 'TypeError' && error.message.includes('fetch')
          });
          
          results.processedSubtitles++;
          results.failed++;
          
          // Add to detailed results
          results.detailedResults.push({
            filename: subtitle.name,
            status: 'failed',
            message: error.name === 'TypeError' && error.message.includes('fetch') 
              ? `NetworkError: ${error.message} (Upload may have succeeded despite this error)`
              : `Upload failed: ${error.message}`,
            url: null,
            errorType: error.name,
            isNetworkError: error.name === 'TypeError' && error.message.includes('fetch')
          });
          
          // Update progress with detailed information
          if (onProgress) {
            onProgress(results.processedSubtitles, results.totalSubtitles, {
              currentSubtitle: subtitle.name,
              successful: results.successful,
              alreadyExists: results.alreadyExists,
              failed: results.failed,
              results: results.detailedResults
            });
          }
        }
      }

      const successRate = results.totalSubtitles > 0 ? (results.processedSubtitles / results.totalSubtitles * 100).toFixed(1) : 0;
      addDebugInfo(`🎯 Upload completed: ${results.processedSubtitles}/${results.totalSubtitles} subtitles (${successRate}% success rate)`);
      
      return results;
      
    } catch (error) {
      addDebugInfo(`💥 Upload process failed: ${error.message}`);
      results.errors.push({
        error: 'Upload process failed',
        message: error.message,
        stack: error.stack
      });
      return results;
    }
  }

  /**
   * Prepare upload data for a single subtitle (using cd1)
   * @param {Object} params - Parameters object
   * @returns {Promise<Object>} - Upload data structure
   */
  static async prepareUploadDataForSingleSubtitle({
    video,
    subtitle,
    movieData,
    guessItData,
    featuresByImdbId,
    getSubtitleLanguage,
    uploadOptions,
    combinedLanguages,
    addDebugInfo,
    getVideoMetadata
  }) {
    // Get the best movie data (episode-specific if available)
    const bestMovieData = this.getBestMovieData(video.fullPath, movieData, featuresByImdbId, guessItData);
    const uploadImdbId = bestMovieData?.kind === 'episode' && bestMovieData.imdbid 
      ? bestMovieData.imdbid 
      : movieData.imdbid;

    addDebugInfo(`🎭 Using IMDb ID for upload: ${uploadImdbId} (${bestMovieData?.kind || 'movie'})`);
    addDebugInfo(`📝 Processing subtitle: ${subtitle.name}`);
    
    try {
      // Calculate MD5 hash of subtitle file
      const subtitleInfo = await SubtitleHashService.readAndHashSubtitleFile(subtitle.file);
      
      // Validate required fields
      if (!video.movieHash || video.movieHash === 'error') {
        throw new Error(`Movie hash not available for video: ${video.name}`);
      }

      // Get video metadata for upload parameters
      const videoMetadata = getVideoMetadata ? getVideoMetadata(video.fullPath) : null;
      
      const subtitleEntry = {
        subhash: subtitleInfo.hash,           // MD5 hash of subtitle file content
        subfilename: subtitle.name,
        moviehash: video.movieHash,           // Movie hash from video file
        moviebytesize: video.size.toString(),
        moviefilename: video.name,
        idmovieimdb: uploadImdbId,
        
        // Add video metadata parameters for TryUploadSubtitles
        ...(videoMetadata && {
          movietimems: videoMetadata.movietimems?.toString(),
          moviefps: videoMetadata.moviefps?.toString(),
          movieframes: videoMetadata.movieframes?.toString()
        })
      };
      
      addDebugInfo(`✅ Prepared subtitle data for: ${subtitle.name}`);
      addDebugInfo(`   - Movie hash: ${video.movieHash}`);
      addDebugInfo(`   - IMDb ID: ${uploadImdbId}`);
      if (videoMetadata) {
        addDebugInfo(`   - Video metadata: FPS=${videoMetadata.moviefps}, Duration=${videoMetadata.movietimems}ms, Frames=${videoMetadata.movieframes}`);
      } else {
        addDebugInfo(`   - Video metadata: Not available`);
      }
      
      return {
        subtitles: [subtitleEntry] // Always single subtitle in cd1
      };
      
    } catch (error) {
      addDebugInfo(`❌ Failed to prepare subtitle ${subtitle.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Prepare upload data for actual UploadSubtitles (when alreadyindb=0)
   * @param {Object} params - Parameters object
   * @returns {Promise<Object>} - Upload data structure with baseinfo and cd1
   */
  static async prepareActualUploadData({
    video,
    subtitle,
    movieData,
    guessItData,
    featuresByImdbId,
    getSubtitleLanguage,
    uploadOptions,
    combinedLanguages,
    addDebugInfo,
    getVideoMetadata
  }) {
    // Get the best movie data (episode-specific if available)
    const bestMovieData = this.getBestMovieData(video.fullPath, movieData, featuresByImdbId, guessItData);
    const uploadImdbId = bestMovieData?.kind === 'episode' && bestMovieData.imdbid 
      ? bestMovieData.imdbid 
      : movieData.imdbid;

    addDebugInfo(`🎭 Using IMDb ID for actual upload: ${uploadImdbId} (${bestMovieData?.kind || 'movie'})`);
    addDebugInfo(`📝 Processing subtitle for actual upload: ${subtitle.name}`);
    
    try {
      // Read subtitle file with content for UploadSubtitles
      const subtitleInfo = await SubtitleHashService.readAndHashSubtitleFile(subtitle.file, true);
      
      // Get language ID
      const languageCode = getSubtitleLanguage(subtitle);
      const languageId = SubtitleHashService.getLanguageId(languageCode, combinedLanguages);
      
      if (!languageId) {
        throw new Error(`No valid language ID found for subtitle: ${subtitle.name}`);
      }
      
      // Validate required fields
      if (!video.movieHash || video.movieHash === 'error') {
        throw new Error(`Movie hash not available for video: ${video.name}`);
      }

      // Get subtitle-specific upload options
      const subtitleOptions = uploadOptions?.[subtitle.fullPath] || {};
      
      // Auto-detect features from video and subtitle paths
      const videoFeatures = this.detectFeaturesFromPath(video.fullPath, addDebugInfo);
      const subtitleFeatures = this.detectFeaturesFromPath(subtitle.fullPath, addDebugInfo);
      
      // Combine auto-detected features (video path has higher priority for HD)
      const autoDetectedFeatures = {
        hearingimpaired: subtitleFeatures.hearingimpaired === '1' || videoFeatures.hearingimpaired === '1' ? '1' : '0',
        highdefinition: videoFeatures.highdefinition === '1' || subtitleFeatures.highdefinition === '1' ? '1' : '0',
        foreignpartsonly: subtitleFeatures.foreignpartsonly === '1' || videoFeatures.foreignpartsonly === '1' ? '1' : '0'
      };
      
      // Consistent logic for all features: prioritize auto-detected '1' values over manual '0' values
      // This ensures consistent behavior between paired and orphaned subtitles
      const finalHigdefinition = autoDetectedFeatures.highdefinition === '1' ? '1' : (subtitleOptions.highdefinition || '0');
      const finalHearingimpaired = autoDetectedFeatures.hearingimpaired === '1' ? '1' : (subtitleOptions.hearingimpaired || '0');
      const finalForeignpartsonly = autoDetectedFeatures.foreignpartsonly === '1' ? '1' : (subtitleOptions.foreignpartsonly || '0');
      
      // Prepare baseinfo section
      const baseinfo = {
        idmovieimdb: uploadImdbId,
        moviereleasename: subtitleOptions.moviereleasename || video.name.replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm)$/i, ''), // Use custom release name or video name
        movieaka: subtitleOptions.movieaka || '', // Movie title in subtitle language
        sublanguageid: languageId,
        subauthorcomment: subtitleOptions.subauthorcomment || '',
        hearingimpaired: finalHearingimpaired,
        highdefinition: finalHigdefinition,
        automatictranslation: subtitleOptions.automatictranslation || '0',
        subtranslator: subtitleOptions.subtranslator || '',
        foreignpartsonly: finalForeignpartsonly
      };

      // Get video metadata for upload parameters
      const videoMetadata = getVideoMetadata ? getVideoMetadata(video.fullPath) : null;
      
      // Prepare cd1 section
      const cd1 = {
        subhash: subtitleInfo.hash, // Use same hash as TryUploadSubtitles (MD5 of original content)
        subfilename: subtitle.name,
        moviehash: video.movieHash,
        moviebytesize: video.size.toString(),
        moviefilename: video.name,
        subcontent: subtitleInfo.contentGzipBase64,
        
        // Add video metadata parameters for OpenSubtitles API
        ...(videoMetadata && {
          movietimems: videoMetadata.movietimems?.toString(),
          moviefps: videoMetadata.moviefps?.toString(),
          movieframes: videoMetadata.movieframes?.toString()
        })
      };
      
      addDebugInfo(`✅ Prepared actual upload data for: ${subtitle.name}`);
      addDebugInfo(`   - Language: ${languageId}`);
      addDebugInfo(`   - Movie hash: ${video.movieHash}`);
      addDebugInfo(`   - IMDb ID: ${uploadImdbId}`);
      addDebugInfo(`   - Content length: ${subtitleInfo.content.length} chars`);
      addDebugInfo(`   - Compressed content length: ${subtitleInfo.contentGzipBase64.length} chars (base64)`);
      
      // Log video metadata if available
      if (videoMetadata) {
        addDebugInfo(`   - Video metadata:`);
        addDebugInfo(`     * FPS: ${videoMetadata.moviefps}`);
        addDebugInfo(`     * Duration: ${videoMetadata.durationFormatted} (${videoMetadata.movietimems}ms)`);
        addDebugInfo(`     * Frames: ${videoMetadata.movieframes}`);
      } else {
        addDebugInfo(`   - Video metadata: not available`);
      }
      
      // DEBUG: Verify compression round-trip for this specific upload
      try {
        const debugResult = SubtitleHashService.debugCompressedContent(subtitleInfo.contentGzipBase64, subtitleInfo.content);
        addDebugInfo(`   - DEBUG Round-trip verification:`);
        addDebugInfo(`     * Content match: ${debugResult.contentMatch}`);
        addDebugInfo(`     * Hash match: ${debugResult.hashMatch}`);
        addDebugInfo(`     * Original hash: ${debugResult.originalHash}`);
        addDebugInfo(`     * Decompressed hash: ${debugResult.decompressedHash}`);
        if (debugResult.error) {
          addDebugInfo(`     * ERROR: ${debugResult.error}`);
        }
      } catch (debugError) {
        addDebugInfo(`   - DEBUG verification failed: ${debugError.message}`);
      }
      
      // Final debug logging of the complete upload object right before XML-RPC call
      const uploadObject = {
        baseinfo,
        cd1,
        // Return the exact subcontent data for debugging/download purposes
        subcontent: subtitleInfo.contentGzipBase64
      };
      
      addDebugInfo(`🔍 FINAL UPLOAD OBJECT FOR XML-RPC (${subtitle.name}):`);
      addDebugInfo(`   - Complete upload object: ${JSON.stringify(uploadObject, null, 2)}`);
      addDebugInfo(`   - uploadObject.baseinfo.highdefinition: "${uploadObject.baseinfo.highdefinition}"`);
      addDebugInfo(`   - uploadObject.baseinfo.hearingimpaired: "${uploadObject.baseinfo.hearingimpaired}"`);
      addDebugInfo(`   - uploadObject.baseinfo.foreignpartsonly: "${uploadObject.baseinfo.foreignpartsonly}"`);
      
      return uploadObject;
      
    } catch (error) {
      addDebugInfo(`❌ Failed to prepare actual upload data for ${subtitle.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Prepare upload data for orphaned subtitle (using only subtitle hash, no video)
   * @param {Object} params - Parameters object
   * @returns {Promise<Object>} - Upload data structure
   */
  static async prepareUploadDataForOrphanedSubtitle({
    subtitle,
    movieData,
    guessItData,
    featuresByImdbId,
    getSubtitleLanguage,
    uploadOptions,
    combinedLanguages,
    addDebugInfo,
    orphanedSubtitlesFps = {}
  }) {
    // Get the best movie data (episode-specific if available)
    const bestMovieData = this.getBestMovieData(subtitle.fullPath, movieData, featuresByImdbId, guessItData);
    const uploadImdbId = bestMovieData?.kind === 'episode' && bestMovieData.imdbid 
      ? bestMovieData.imdbid 
      : movieData.imdbid;

    addDebugInfo(`🎭 Using IMDb ID for orphaned subtitle upload: ${uploadImdbId} (${bestMovieData?.kind || 'movie'})`);
    addDebugInfo(`📝 Processing orphaned subtitle: ${subtitle.name}`);
    
    try {
      // Calculate MD5 hash of subtitle file
      const subtitleInfo = await SubtitleHashService.readAndHashSubtitleFile(subtitle.file);
      
      const subtitleEntry = {
        subhash: subtitleInfo.hash,           // MD5 hash of subtitle file content
        subfilename: subtitle.name
        // For orphaned subtitles, we don't include movie fields or idmovieimdb in TryUploadSubtitles
        // moviehash, moviebytesize, moviefilename, and idmovieimdb are not sent
      };
      
      // Get FPS setting for this subtitle
      const subtitleFps = orphanedSubtitlesFps[subtitle.fullPath];
      
      // Add FPS if specified (only if not empty)
      if (subtitleFps && subtitleFps !== '') {
        subtitleEntry.moviefps = subtitleFps;
        addDebugInfo(`   - FPS: ${subtitleFps}`);
      } else {
        addDebugInfo(`   - FPS: Not specified`);
      }
      
      addDebugInfo(`✅ Prepared orphaned subtitle data for: ${subtitle.name}`);
      addDebugInfo(`   - No movie fields included (orphaned subtitle for TryUploadSubtitles)`);
      addDebugInfo(`   - IMDb ID will be used later in UploadSubtitles: ${uploadImdbId}`);
      
      return {
        subtitles: [subtitleEntry] // Always single subtitle
      };
      
    } catch (error) {
      addDebugInfo(`❌ Failed to prepare orphaned subtitle ${subtitle.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Prepare upload data for actual UploadSubtitles for orphaned subtitle (when alreadyindb=0)
   * @param {Object} params - Parameters object
   * @returns {Promise<Object>} - Upload data structure with baseinfo and cd1
   */
  static async prepareActualUploadDataForOrphanedSubtitle({
    subtitle,
    movieData,
    guessItData,
    featuresByImdbId,
    getSubtitleLanguage,
    uploadOptions,
    combinedLanguages,
    addDebugInfo,
    orphanedSubtitlesFps = {}
  }) {
    // Get the best movie data (episode-specific if available)
    const bestMovieData = this.getBestMovieData(subtitle.fullPath, movieData, featuresByImdbId, guessItData);
    const uploadImdbId = bestMovieData?.kind === 'episode' && bestMovieData.imdbid 
      ? bestMovieData.imdbid 
      : movieData.imdbid;

    addDebugInfo(`🎭 Using IMDb ID for orphaned subtitle actual upload: ${uploadImdbId} (${bestMovieData?.kind || 'movie'})`);
    addDebugInfo(`📝 Processing orphaned subtitle for actual upload: ${subtitle.name}`);
    
    try {
      // Read subtitle file with content for UploadSubtitles
      const subtitleInfo = await SubtitleHashService.readAndHashSubtitleFile(subtitle.file, true);
      
      // Get language ID
      const languageCode = getSubtitleLanguage(subtitle);
      const languageId = SubtitleHashService.getLanguageId(languageCode, combinedLanguages);
      
      if (!languageId) {
        throw new Error(`No valid language ID found for orphaned subtitle: ${subtitle.name}`);
      }
      
      // Get subtitle-specific upload options
      const subtitleOptions = uploadOptions?.[subtitle.fullPath] || {};
      
      // Auto-detect features from subtitle path for orphaned subtitles
      const autoDetectedFeatures = this.detectFeaturesFromPath(subtitle.fullPath, addDebugInfo);
      
      
      // Consistent logic for all features: prioritize auto-detected '1' values over manual '0' values
      // This ensures consistent behavior between paired and orphaned subtitles
      const finalHigdefinition = autoDetectedFeatures.highdefinition === '1' ? '1' : (subtitleOptions.highdefinition || '0');
      const finalHearingimpaired = autoDetectedFeatures.hearingimpaired === '1' ? '1' : (subtitleOptions.hearingimpaired || '0');
      const finalForeignpartsonly = autoDetectedFeatures.foreignpartsonly === '1' ? '1' : (subtitleOptions.foreignpartsonly || '0');
      
      // Prepare baseinfo section (only include fields we can determine for orphaned subtitles)
      const baseinfo = {
        idmovieimdb: uploadImdbId,
        moviereleasename: subtitleOptions.moviereleasename || subtitle.name.replace(/\.(srt|sub|ass|ssa|vtt)$/i, ''), // Use custom release name or subtitle name
        movieaka: subtitleOptions.movieaka || '', // Movie title in subtitle language
        sublanguageid: languageId,
        subauthorcomment: subtitleOptions.subauthorcomment || '',
        hearingimpaired: finalHearingimpaired || '0',
        highdefinition: finalHigdefinition || '0',
        automatictranslation: subtitleOptions.automatictranslation || '0',
        subtranslator: subtitleOptions.subtranslator || '',
        foreignpartsonly: finalForeignpartsonly || '0'
      };
      
      // DEBUG: Log the final baseinfo values before they're sent to XML-RPC

      // Get FPS setting for this subtitle
      const subtitleFps = orphanedSubtitlesFps[subtitle.fullPath];
      
      // Prepare cd1 section (no movie file data for orphaned subtitles)
      const cd1 = {
        subhash: subtitleInfo.hash, // Use same hash as TryUploadSubtitles (MD5 of original content)
        subfilename: subtitle.name,
        subcontent: subtitleInfo.contentGzipBase64
        // No movie data included for orphaned subtitles (moviehash, moviebytesize, moviefilename)
      };
      
      // Add FPS if specified (only if not empty)
      if (subtitleFps && subtitleFps !== '') {
        cd1.moviefps = subtitleFps;
        addDebugInfo(`   - FPS: ${subtitleFps}`);
      } else {
        addDebugInfo(`   - FPS: Not specified`);
      }
      
      addDebugInfo(`✅ Prepared actual upload data for orphaned subtitle: ${subtitle.name}`);
      addDebugInfo(`   - Language: ${languageId}`);
      addDebugInfo(`   - IMDb ID: ${uploadImdbId}`);
      addDebugInfo(`   - Content length: ${subtitleInfo.content.length} chars`);
      addDebugInfo(`   - Compressed content length: ${subtitleInfo.contentGzipBase64.length} chars (base64)`);
      addDebugInfo(`   - No movie fields in cd1 (orphaned subtitle)`);
      
      // DEBUG: Verify compression round-trip for this specific upload
      try {
        const debugResult = SubtitleHashService.debugCompressedContent(subtitleInfo.contentGzipBase64, subtitleInfo.content);
        addDebugInfo(`   - DEBUG Round-trip verification:`);
        addDebugInfo(`     * Content match: ${debugResult.contentMatch}`);
        addDebugInfo(`     * Hash match: ${debugResult.hashMatch}`);
        addDebugInfo(`     * Original hash: ${debugResult.originalHash}`);
        addDebugInfo(`     * Decompressed hash: ${debugResult.decompressedHash}`);
        if (debugResult.error) {
          addDebugInfo(`     * ERROR: ${debugResult.error}`);
        }
      } catch (debugError) {
        addDebugInfo(`   - DEBUG verification failed: ${debugError.message}`);
      }
      
      // Final debug logging of the complete upload object right before XML-RPC call
      const uploadObject = {
        baseinfo,
        cd1,
        // Return the exact subcontent data for debugging/download purposes
        subcontent: subtitleInfo.contentGzipBase64
      };
      
      addDebugInfo(`🔍 FINAL UPLOAD OBJECT FOR XML-RPC (${subtitle.name}):`);
      addDebugInfo(`   - Complete upload object: ${JSON.stringify(uploadObject, null, 2)}`);
      addDebugInfo(`   - uploadObject.baseinfo.highdefinition: "${uploadObject.baseinfo.highdefinition}"`);
      addDebugInfo(`   - uploadObject.baseinfo.hearingimpaired: "${uploadObject.baseinfo.hearingimpaired}"`);
      addDebugInfo(`   - uploadObject.baseinfo.foreignpartsonly: "${uploadObject.baseinfo.foreignpartsonly}"`);
      
      return uploadObject;
      
    } catch (error) {
      addDebugInfo(`❌ Failed to prepare actual upload data for orphaned subtitle ${subtitle.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Auto-detect features from file path for orphaned subtitles
   * @param {string} filePath - The file path to analyze
   * @param {Function} addDebugInfo - Debug callback
   * @returns {Object} - Object with detected features
   */
  static detectFeaturesFromPath(filePath, addDebugInfo) {
    const features = {
      hearingimpaired: '0',
      highdefinition: '0',
      foreignpartsonly: '0'
    };
    
    if (!filePath) {
      return features;
    }
    
    // Split path into all components (directory parts + filename)
    const pathParts = filePath.split('/').filter(part => part.length > 0);
    
    // Check each part of the path
    for (const part of pathParts) {
      // Check for High Definition indicators
      if (this.checkHighDefinitionFromString(part)) {
        features.highdefinition = '1';
        addDebugInfo(`[AUTODETECT] HD: 1`);
      }
      
      // Check for Foreign Parts indicators
      if (this.checkForeignPartsFromString(part)) {
        features.foreignpartsonly = '1';
      }
      
      // Check for Hearing Impaired indicators
      if (this.checkHearingImpairedFromString(part)) {
        features.hearingimpaired = '1';
      }
    }
    
    // Special check for hearing impaired from filename
    if (pathParts.length > 0) {
      const filename = pathParts[pathParts.length - 1];
      if (this.checkHearingImpairedFromFilename(filename)) {
        features.hearingimpaired = '1';
      }
    }
    
    return features;
  }
  
  /**
   * Check if a string indicates High Definition
   * @param {string} str - String to check
   * @returns {boolean} - True if indicates HD
   */
  static checkHighDefinitionFromString(str) {
    if (!str) return false;
    
    // Use the shared HD detection pattern from constants
    return HD_DETECTION_REGEX.test(str);
  }
  
  /**
   * Check if a string indicates Foreign Parts Only
   * @param {string} str - String to check
   * @returns {boolean} - True if indicates foreign parts
   */
  static checkForeignPartsFromString(str) {
    if (!str) return false;
    
    const lowerStr = str.toLowerCase();
    const foreignPatterns = [
      'foreign', 'forced', 'signs', 'signs&songs', 'signs.songs', 'signs_songs'
    ];
    
    return foreignPatterns.some(pattern => lowerStr.includes(pattern));
  }
  
  /**
   * Check if a string indicates Hearing Impaired
   * @param {string} str - String to check
   * @returns {boolean} - True if indicates hearing impaired
   */
  static checkHearingImpairedFromString(str) {
    if (!str) return false;
    
    const lowerStr = str.toLowerCase();
    
    // First check for negative patterns that explicitly indicate NOT hearing impaired
    const negativePatterns = [
      'nonhi', 'non-hi', 'non_hi', 'non.hi',
      'nohi', 'no-hi', 'no_hi', 'no.hi',
      'nothi', 'not-hi', 'not_hi', 'not.hi'
    ];
    
    if (negativePatterns.some(pattern => lowerStr.includes(pattern))) {
      return false;
    }
    
    // Then check for positive HI patterns
    const hiPatterns = [
      'hi', 'sdh', 'cc', 'hearing.impaired', 'hearing_impaired', 'hearingimpaired'
    ];
    
    return hiPatterns.some(pattern => lowerStr.includes(pattern));
  }
  
  /**
   * Check if a filename specifically indicates Hearing Impaired
   * @param {string} filename - Filename to check
   * @returns {boolean} - True if indicates hearing impaired
   */
  static checkHearingImpairedFromFilename(filename) {
    if (!filename) return false;
    
    const lowerFilename = filename.toLowerCase();
    
    // First check for negative patterns that explicitly indicate NOT hearing impaired
    const negativePatterns = [
      'nonhi', 'non-hi', 'non_hi', 'non.hi',
      'nohi', 'no-hi', 'no_hi', 'no.hi',
      'nothi', 'not-hi', 'not_hi', 'not.hi'
    ];
    
    if (negativePatterns.some(pattern => lowerFilename.includes(pattern))) {
      return false;
    }
    
    // More specific filename patterns for hearing impaired
    const filenamePatterns = [
      /\.hi\./i,
      /\.sdh\./i,
      /\.cc\./i,
      /\bhi\b/i,
      /\bsdh\b/i,
      /\bcc\b/i,
      /_hi\./i,
      /_sdh\./i,
      /_cc\./i,
      /[-.]hi[-.]?/i,
      /[-.]sdh[-.]?/i,
      /[-.]cc[-.]?/i
    ];
    
    return filenamePatterns.some(pattern => pattern.test(lowerFilename));
  }

  /**
   * Get the best movie data (episode-specific if available, otherwise main show)
   * @param {string} videoPath - Path to video file
   * @param {Object} movieData - Original movie data
   * @param {Object} featuresByImdbId - Features data by IMDb ID
   * @param {Object} guessItData - GuessIt data
   * @returns {Object} - Best movie data
   */
  static getBestMovieData(videoPath, movieData, featuresByImdbId, guessItData) {
    const featuresData = movieData?.imdbid ? featuresByImdbId[movieData.imdbid] : null;
    const guessItVideoData = guessItData[videoPath];

    // Try to find episode match if we have GuessIt data
    if (movieData && featuresData && guessItVideoData && typeof guessItVideoData === 'object') {
      if (featuresData?.data?.[0]?.attributes?.seasons && guessItVideoData) {
        const attributes = featuresData.data[0].attributes;
        
        if (attributes.feature_type === 'Tvshow' && guessItVideoData.season && guessItVideoData.episode) {
          const seasonNumber = parseInt(guessItVideoData.season);
          const episodeNumber = parseInt(guessItVideoData.episode);

          if (!isNaN(seasonNumber) && !isNaN(episodeNumber)) {
            const season = attributes.seasons.find(s => s.season_number === seasonNumber);
            if (season?.episodes) {
              const episode = season.episodes.find(e => e.episode_number === episodeNumber);
              if (episode) {
                return {
                  imdbid: episode.feature_imdb_id?.toString(),
                  title: `${attributes.title} - S${seasonNumber.toString().padStart(2, '0')}E${episodeNumber.toString().padStart(2, '0')} - ${episode.title}`,
                  year: attributes.year,
                  kind: 'episode',
                  season: seasonNumber,
                  episode: episodeNumber,
                  episode_title: episode.title,
                  show_title: attributes.title,
                  feature_id: episode.feature_id,
                  reason: 'Episode matched from GuessIt data'
                };
              }
            }
          }
        }
      }
    }

    return movieData;
  }
}