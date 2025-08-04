// Quick fix for FFmpeg cache issue - paste this into browser console

console.log('🧹 Clearing FFmpeg cache...');

// Step 1: Clear IndexedDB
indexedDB.deleteDatabase('ffmpeg-wasm-cache').onsuccess = () => {
    console.log('✅ IndexedDB cache cleared');
};

// Step 2: Clear any related localStorage
Object.keys(localStorage).filter(k => k.includes('ffmpeg')).forEach(key => {
    localStorage.removeItem(key);
    console.log('🗑️ Removed:', key);
});

// Step 3: Clear any related sessionStorage  
Object.keys(sessionStorage).filter(k => k.includes('ffmpeg')).forEach(key => {
    sessionStorage.removeItem(key);
    console.log('🗑️ Removed:', key);
});

console.log('🎉 Cache cleared! Reloading page...');

// Step 4: Reload to get fresh files
setTimeout(() => location.reload(), 1000);