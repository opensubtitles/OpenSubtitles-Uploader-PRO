/**
 * Script to clear corrupted FFmpeg cache that's causing loading issues
 * Run this in the browser console to fix the 0MB cached files problem
 */

async function clearFFmpegCache() {
    console.log('🧹 Starting FFmpeg cache cleanup...');
    
    try {
        // Clear IndexedDB cache
        const dbName = 'ffmpeg-wasm-cache';
        
        // Delete the entire cache database
        const deleteRequest = indexedDB.deleteDatabase(dbName);
        
        deleteRequest.onsuccess = function() {
            console.log('✅ FFmpeg cache database deleted successfully');
        };
        
        deleteRequest.onerror = function(event) {
            console.error('❌ Error deleting FFmpeg cache database:', event);
        };
        
        deleteRequest.onblocked = function() {
            console.warn('⚠️ Database deletion blocked - close other tabs and try again');
        };
        
        // Also clear localStorage cache if any
        const localStorageKeys = Object.keys(localStorage);
        const ffmpegKeys = localStorageKeys.filter(key => 
            key.includes('ffmpeg') || 
            key.includes('wasm') || 
            key.includes('video-metadata')
        );
        
        ffmpegKeys.forEach(key => {
            localStorage.removeItem(key);
            console.log(`🗑️ Removed localStorage key: ${key}`);
        });
        
        // Clear sessionStorage cache if any
        const sessionStorageKeys = Object.keys(sessionStorage);
        const ffmpegSessionKeys = sessionStorageKeys.filter(key => 
            key.includes('ffmpeg') || 
            key.includes('wasm') || 
            key.includes('video-metadata')
        );
        
        ffmpegSessionKeys.forEach(key => {
            sessionStorage.removeItem(key);
            console.log(`🗑️ Removed sessionStorage key: ${key}`);
        });
        
        console.log('🎉 FFmpeg cache cleanup completed!');
        console.log('💡 Please refresh the page to download fresh FFmpeg files');
        
    } catch (error) {
        console.error('❌ Error during cache cleanup:', error);
    }
}

// Auto-run the cleanup
clearFFmpegCache();