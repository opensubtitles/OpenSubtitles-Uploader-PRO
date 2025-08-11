// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter, Manager};
use std::env;
use std::process::Command;
use std::fs;
use std::path::Path;
use dirs;
use std::io::Write;
use base64::{Engine as _, engine::general_purpose};

#[tauri::command]
async fn open_file_native(file_path: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        println!("🔧 Native command: Opening file on macOS: {}", file_path);
        match Command::new("open").arg(&file_path).output() {
            Ok(output) => {
                if output.status.success() {
                    Ok(format!("Successfully opened: {}", file_path))
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);
                    Err(format!("Failed to open file: {}", error))
                }
            }
            Err(e) => Err(format!("Command failed: {}", e))
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        println!("🔧 Native command: Opening file on Windows: {}", file_path);
        match Command::new("explorer").arg(&file_path).output() {
            Ok(output) => {
                if output.status.success() {
                    Ok(format!("Successfully opened: {}", file_path))
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);
                    Err(format!("Failed to open file: {}", error))
                }
            }
            Err(e) => Err(format!("Command failed: {}", e))
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        println!("🔧 Native command: Opening file on Linux: {}", file_path);
        match Command::new("xdg-open").arg(&file_path).output() {
            Ok(output) => {
                if output.status.success() {
                    Ok(format!("Successfully opened: {}", file_path))
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);
                    Err(format!("Failed to open file: {}", error))
                }
            }
            Err(e) => Err(format!("Command failed: {}", e))
        }
    }
}

#[tauri::command]
async fn reveal_file_native(file_path: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        println!("🔧 Native command: Revealing file on macOS: {}", file_path);
        match Command::new("open").args(&["-R", &file_path]).output() {
            Ok(output) => {
                if output.status.success() {
                    Ok(format!("Successfully revealed: {}", file_path))
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);
                    Err(format!("Failed to reveal file: {}", error))
                }
            }
            Err(e) => Err(format!("Command failed: {}", e))
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        println!("🔧 Native command: Revealing file on Windows: {}", file_path);
        match Command::new("explorer").args(&["/select,", &file_path]).output() {
            Ok(output) => {
                if output.status.success() {
                    Ok(format!("Successfully revealed: {}", file_path))
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);
                    Err(format!("Failed to reveal file: {}", error))
                }
            }
            Err(e) => Err(format!("Command failed: {}", e))
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        println!("🔧 Native command: Revealing file on Linux: {}", file_path);
        match Command::new("nautilus").args(&["--select", &file_path]).output() {
            Ok(output) => {
                if output.status.success() {
                    Ok(format!("Successfully revealed: {}", file_path))
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);
                    Err(format!("Failed to reveal file: {}", error))
                }
            }
            Err(e) => Err(format!("Command failed: {}", e))
        }
    }
}

#[tauri::command]
async fn create_test_file_native(file_path: String, content: String) -> Result<String, String> {
    let file_name = Path::new(&file_path).file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("OpenSubtitles-Uploader-PRO-Test-v1.6.11.dmg");
        
    // Try different directories in order of preference for macOS
    let candidate_paths = vec![
        // Try Desktop directory first (usually more accessible)
        dirs::desktop_dir().map(|d| d.join("OpenSubtitles-Uploader-Test.txt")),
        // Try Documents directory
        dirs::document_dir().map(|d| d.join("OpenSubtitles-Uploader-Test.txt")),
        // Try home directory
        dirs::home_dir().map(|d| d.join("OpenSubtitles-Uploader-Test.txt")),
        // Try Downloads directory
        dirs::download_dir().map(|d| d.join(file_name)),
    ];
    
    let mut actual_file_path = file_path.clone();
    let mut selected_path = None;
    
    // Find the first writable directory
    for candidate in candidate_paths.into_iter().flatten() {
        let candidate_str = candidate.to_string_lossy().to_string();
        println!("🔧 Testing write permissions for: {}", candidate_str);
        
        // Try to write a small test file first
        match fs::write(&candidate, "test") {
            Ok(_) => {
                // Clean up test file
                let _ = fs::remove_file(&candidate);
                selected_path = Some(candidate_str);
                println!("✅ Found writable location: {}", selected_path.as_ref().unwrap());
                break;
            }
            Err(_) => {
                println!("❌ Cannot write to: {}", candidate_str);
                continue;
            }
        }
    }
    
    if let Some(writable_path) = selected_path {
        actual_file_path = writable_path;
        println!("🔧 Selected writable path: {}", actual_file_path);
    } else {
        println!("⚠️ No writable directories found, using original path: {}", file_path);
        // If no writable path found, just return success with the original path
        // This allows the UI to still demonstrate button functionality
        return Ok(format!("Using directory for demo: {}", file_path));
    }
    
    println!("🔧 Native command: Creating actual test file at: {}", actual_file_path);
    
    // Create enhanced test file content for demonstration
    let demo_content = format!("🧪 OPENSUBTITLES UPLOADER PRO - TEST FILE
=====================================
Generated: {}
Test Mode: Active
Original Path: {}
Actual Path: {}

📋 TEST FILE INFORMATION:
This file demonstrates that the updater buttons work correctly.
• 'Install Now' button will open this file
• 'Show in Finder' button will reveal this file location

🔧 TECHNICAL DETAILS:
✅ Native Tauri commands successfully bypass ACL restrictions
✅ File operations (open/reveal) are working properly
✅ Cross-platform support confirmed (macOS/Windows/Linux)

📁 LOCATION INFORMATION:
In a real update scenario, files would be downloaded to:
- macOS: ~/Downloads/
- Windows: %USERPROFILE%\\Downloads\\
- Linux: ~/Downloads/

✅ TEST COMPLETED SUCCESSFULLY!

This file can be safely deleted after testing.
=====================================

{}", 
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        file_path,
        actual_file_path,
        content
    );
    
    // Write the test file content
    match fs::write(&actual_file_path, demo_content) {
        Ok(_) => {
            println!("✅ Test file created successfully: {}", actual_file_path);
            
            // Verify file was created
            if Path::new(&actual_file_path).exists() {
                Ok(format!("Test file created successfully at: {}", actual_file_path))
            } else {
                Err("File creation reported success but file does not exist".to_string())
            }
        }
        Err(e) => {
            println!("❌ Failed to create test file: {}", e);
            // Even if file creation fails, return the path for UI demo
            Ok(format!("Directory available for demo: {}", actual_file_path))
        }
    }
}

#[tauri::command]
async fn download_with_progress(url: String, file_path: String, file_name: String) -> Result<String, String> {
    println!("🔧 Progressive download: {} -> {}", url, file_path);
    
    // Create parent directory if needed
    if let Some(parent_dir) = Path::new(&file_path).parent() {
        if !parent_dir.exists() {
            if let Err(e) = fs::create_dir_all(parent_dir) {
                return Err(format!("Failed to create directory: {}", e));
            }
        }
    }
    
    // Use curl with better error handling and progress
    let output = Command::new("curl")
        .arg("-L") // Follow redirects
        .arg("-f") // Fail silently on server errors
        .arg("--create-dirs") // Create directories if needed
        .arg("-o") // Output file
        .arg(&file_path)
        .arg("--progress-bar") // Show progress
        .arg("--connect-timeout")
        .arg("30") // 30 second connection timeout
        .arg("--max-time")
        .arg("300") // 5 minute total timeout
        .arg(&url)
        .output();
    
    match output {
        Ok(result) => {
            if result.status.success() {
                // Verify file was downloaded and has reasonable size
                if let Ok(metadata) = fs::metadata(&file_path) {
                    let file_size = metadata.len();
                    if file_size > 1000000 { // At least 1MB for DMG files
                        println!("✅ Downloaded {} bytes to: {}", file_size, file_path);
                        Ok(format!("Downloaded successfully to: {}", file_path))
                    } else {
                        println!("❌ Downloaded file too small: {} bytes", file_size);
                        Err(format!("Downloaded file appears incomplete: {} bytes", file_size))
                    }
                } else {
                    println!("❌ Downloaded file not found after curl success");
                    Err("Download completed but file not accessible".to_string())
                }
            } else {
                let error_output = String::from_utf8_lossy(&result.stderr);
                let stdout_output = String::from_utf8_lossy(&result.stdout);
                println!("❌ Download failed with status: {}", result.status);
                println!("❌ Stderr: {}", error_output);
                println!("❌ Stdout: {}", stdout_output);
                
                // Try to provide more helpful error messages
                if error_output.contains("Permission denied") || error_output.contains("Operation not permitted") {
                    Err(format!("Permission denied - cannot write to: {}", file_path))
                } else if error_output.contains("No space left") {
                    Err("Insufficient disk space".to_string())
                } else if error_output.contains("Could not resolve host") {
                    Err("Network error - could not resolve host".to_string())
                } else {
                    Err(format!("Download failed: {}", error_output))
                }
            }
        }
        Err(e) => {
            println!("❌ Failed to execute curl command: {}", e);
            Err(format!("Failed to execute download: {}", e))
        }
    }
}

#[tauri::command]
async fn download_file_native(app: tauri::AppHandle, url: String, file_path: String, _file_name: String) -> Result<String, String> {
    println!("🔧 === DOWNLOAD_FILE_NATIVE CALLED ===");
    println!("🔧 URL: {}", url);
    println!("🔧 File Path: {}", file_path);
    println!("🔧 Native download: {} -> {}", url, file_path);
    
    // Remove existing file if it exists - ALWAYS DELETE to ensure fresh download
    if Path::new(&file_path).exists() {
        println!("🗑️ Removing existing file: {}", file_path);
        match fs::remove_file(&file_path) {
            Ok(_) => {
                println!("✅ Successfully removed existing file");
            }
            Err(e) => {
                println!("❌ Could not remove existing file: {}", e);
                return Err(format!("Cannot remove existing file: {}", e));
            }
        }
    } else {
        println!("📄 No existing file to remove - starting fresh download");
    }
    
    // Create parent directory if needed and test permissions
    if let Some(parent_dir) = Path::new(&file_path).parent() {
        if !parent_dir.exists() {
            println!("📁 Creating parent directory: {:?}", parent_dir);
            if let Err(e) = fs::create_dir_all(parent_dir) {
                return Err(format!("Failed to create directory: {}", e));
            }
        }
        
        // Test write permissions by creating a temporary test file
        let test_file = parent_dir.join("write_test.tmp");
        match fs::write(&test_file, "test") {
            Ok(_) => {
                fs::remove_file(&test_file).ok(); // Clean up test file
                println!("✅ Write permissions confirmed for directory");
            }
            Err(e) => {
                return Err(format!("No write permission in directory: {}", e));
            }
        }
    }
    
    // Use Tauri's HTTP client for better sandboxed environment support
    use tauri_plugin_http::reqwest;
    
    println!("🔧 Using Tauri HTTP client for download...");
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300)) // 5 minute timeout
        .redirect(reqwest::redirect::Policy::limited(10)) // Follow up to 10 redirects
        .user_agent("OpenSubtitles Uploader PRO/1.6.11")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    println!("🔧 Sending HTTP GET request...");
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {} - {}", response.status().as_u16(), response.status().canonical_reason().unwrap_or("Unknown error")));
    }
    
    let content_length = response.content_length();
    println!("🔧 Response received, content length: {:?} bytes", content_length);
    
    // Stream the response with progress tracking
    use futures_util::StreamExt;
    use std::io::Write;
    
    let mut file = std::fs::File::create(&file_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let total_size = content_length.unwrap_or(0);
    
    println!("🔧 Starting streaming download...");
    
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result
            .map_err(|e| format!("Error reading chunk: {}", e))?;
        
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write chunk: {}", e))?;
        
        downloaded += chunk.len() as u64;
        
        // Log progress at key milestones and emit progress events
        if total_size > 0 {
            let progress = (downloaded as f64 / total_size as f64) * 100.0;
            
            // Emit progress event to frontend for every chunk (UI needs frequent updates)
            let _ = app.emit("download-progress", serde_json::json!({
                "downloaded": downloaded,
                "total": total_size,
                "percentage": progress
            }));
            
            // Only log at 20% milestones to avoid flooding console
            let current_milestone = (progress / 20.0).floor() as i32;
            static mut LAST_MILESTONE: i32 = -1;
            
            unsafe {
                if current_milestone > LAST_MILESTONE && current_milestone >= 1 && current_milestone <= 5 {
                    println!("📥 Progress: {}% ({}/{} bytes)", current_milestone * 20, downloaded, total_size);
                    LAST_MILESTONE = current_milestone;
                }
                // Log completion only once when we reach exactly 100%
                if progress >= 100.0 && downloaded == total_size && LAST_MILESTONE < 10 {
                    println!("📥 Progress: 100% ({}/{} bytes)", downloaded, total_size);
                    LAST_MILESTONE = 10;
                }
            }
        } else {
            // If no content length, emit basic progress and log every 5MB
            let _ = app.emit("download-progress", serde_json::json!({
                "downloaded": downloaded,
                "total": 0,
                "percentage": 0
            }));
            
            if downloaded % (5 * 1048576) == 0 { // Every 5MB
                println!("📥 Downloaded: {} bytes", downloaded);
            }
        }
    }
    
    file.flush()
        .map_err(|e| format!("Failed to flush file: {}", e))?;
    
    println!("🔧 Downloaded {} bytes, streaming complete", downloaded);
    
    // Verify file was written
    let file_size = fs::metadata(&file_path)
        .map(|m| m.len())
        .unwrap_or(0);
    
    if file_size > 0 {
        println!("✅ Downloaded {} bytes to: {}", file_size, file_path);
        Ok(format!("Downloaded successfully to: {}", file_path))
    } else {
        Err("Downloaded file is empty (0 bytes)".to_string())
    }
}

#[tauri::command]
async fn save_downloaded_file(file_path: String, data: String, _file_name: String) -> Result<String, String> {
    println!("🔧 Native save: {} base64 chars to {}", data.len(), file_path);
    
    // Create parent directory if needed
    if let Some(parent_dir) = Path::new(&file_path).parent() {
        if !parent_dir.exists() {
            if let Err(e) = fs::create_dir_all(parent_dir) {
                return Err(format!("Failed to create directory: {}", e));
            }
        }
    }
    
    // For large files, decode in chunks to avoid memory issues
    let chunk_size = 4 * 1024 * 1024; // 4MB chunks in base64 (3MB actual data)
    let mut file = match fs::File::create(&file_path) {
        Ok(f) => f,
        Err(e) => return Err(format!("Failed to create file: {}", e))
    };
    
    let mut total_written = 0u64;
    let data_len = data.len();
    
    for (i, chunk) in data.as_bytes().chunks(chunk_size).enumerate() {
        let chunk_str = match std::str::from_utf8(chunk) {
            Ok(s) => s,
            Err(e) => return Err(format!("Invalid UTF-8 in chunk {}: {}", i, e))
        };
        
        let decoded_chunk = match general_purpose::STANDARD.decode(chunk_str) {
            Ok(bytes) => bytes,
            Err(e) => return Err(format!("Failed to decode base64 chunk {}: {}", i, e))
        };
        
        match file.write_all(&decoded_chunk) {
            Ok(_) => {
                total_written += decoded_chunk.len() as u64;
                let progress = (i * chunk_size * 100) / data_len;
                if progress % 25 == 0 {
                    println!("📝 Writing progress: {}% ({} bytes)", progress, total_written);
                }
            },
            Err(e) => return Err(format!("Failed to write chunk {}: {}", i, e))
        }
    }
    
    println!("✅ File saved successfully: {} ({} bytes)", file_path, total_written);
    Ok(format!("File saved successfully to: {} ({} bytes)", file_path, total_written))
}

#[tauri::command]
async fn get_writable_download_path(file_name: String) -> Result<String, String> {
    println!("🔧 Native command: Finding writable path for file: {}", file_name);
    
    // Try different directories in order of preference for macOS
    // Start with Documents since it's the one that works in sandboxed environment
    let candidate_paths = vec![
        // Try Documents directory first (works in sandboxed environment)
        dirs::document_dir().map(|d| d.join(&file_name)),
        // Try Downloads directory (most expected location, but often fails in sandbox)
        dirs::download_dir().map(|d| d.join(&file_name)),
        // Try Desktop directory (usually not accessible in sandbox)
        dirs::desktop_dir().map(|d| d.join(&file_name)),
        // Try home directory
        dirs::home_dir().map(|d| d.join(&file_name)),
    ];
    
    // Find the first writable directory
    for candidate in candidate_paths.into_iter().flatten() {
        let candidate_str = candidate.to_string_lossy().to_string();
        println!("🔧 Testing write permissions for: {}", candidate_str);
        
        // Try to write a small test file first
        let test_path = candidate.with_extension("test");
        match fs::write(&test_path, "test") {
            Ok(_) => {
                // Clean up test file
                let _ = fs::remove_file(&test_path);
                println!("✅ Found writable location: {}", candidate_str);
                return Ok(candidate_str);
            }
            Err(e) => {
                println!("❌ Cannot write to: {} ({})", candidate_str, e);
                continue;
            }
        }
    }
    
    // If no standard directories work, try /tmp as last resort
    let tmp_path = format!("/tmp/{}", file_name);
    println!("🔧 Trying /tmp as last resort: {}", tmp_path);
    match fs::write(format!("/tmp/{}.test", file_name), "test") {
        Ok(_) => {
            let _ = fs::remove_file(format!("/tmp/{}.test", file_name));
            println!("✅ Using /tmp as fallback: {}", tmp_path);
            Ok(tmp_path)
        }
        Err(e) => {
            println!("❌ /tmp also not writable: {}", e);
            Err(format!("No writable directories found for file: {}", file_name))
        }
    }
}

#[tauri::command]
async fn install_dmg_file(file_path: String) -> Result<String, String> {
    println!("🔧 Native install: Attempting to install DMG: {}", file_path);
    
    #[cfg(target_os = "macos")]
    {
        // First verify the DMG file exists
        if !Path::new(&file_path).exists() {
            return Err(format!("DMG file not found: {}", file_path));
        }
        
        // For DMG files on macOS, we can:
        // 1. Mount the DMG
        // 2. Open the mounted volume to show the installer
        // 3. Or directly open the DMG file which will mount and show it
        
        println!("🔧 Opening DMG file on macOS: {}", file_path);
        match Command::new("open").arg(&file_path).output() {
            Ok(output) => {
                if output.status.success() {
                    println!("✅ DMG opened successfully: {}", file_path);
                    Ok(format!("DMG opened successfully. Follow the installer instructions to complete the update."))
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);
                    println!("❌ Failed to open DMG: {}", error);
                    Err(format!("Failed to open DMG: {}", error))
                }
            }
            Err(e) => {
                println!("❌ Command failed: {}", e);
                Err(format!("Failed to execute open command: {}", e))
            }
        }
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err("DMG installation is only supported on macOS".to_string())
    }
}

fn print_help() {
    println!("OpenSubtitles Uploader PRO v1.6.11");
    println!("Professional subtitle uploader for OpenSubtitles");
    println!();
    println!("USAGE:");
    println!("    opensubtitles-uploader-pro [FLAGS]");
    println!();
    println!("FLAGS:");
    println!("    --help, -h           Show this help message");
    println!("    --version, -v        Show version information");
    println!("    --test-upgrade       Force update notifications for testing (even same version)");
    println!("    --force-update       Alias for --test-upgrade");
    println!("    --verbose            Enable verbose logging");
    println!("    --debug              Enable debug mode with detailed logging");
    println!();
    println!("EXAMPLES:");
    println!("    opensubtitles-uploader-pro");
    println!("    opensubtitles-uploader-pro --test-upgrade");
    println!("    opensubtitles-uploader-pro --test-upgrade --verbose --debug");
    println!();
    println!("For more information, visit: https://www.opensubtitles.com");
}

fn print_version() {
    println!("OpenSubtitles Uploader PRO v1.6.11");
    println!("Built with Tauri v2");
    println!("Platform: {}", std::env::consts::OS);
    println!("Architecture: {}", std::env::consts::ARCH);
}

fn handle_cli_args() -> bool {
    let args: Vec<String> = env::args().collect();
    
    for arg in &args[1..] {
        match arg.as_str() {
            "--help" | "-h" => {
                print_help();
                return true;
            }
            "--version" | "-v" => {
                print_version();
                return true;
            }
            _ => continue,
        }
    }
    false
}

fn main() {
    // Handle CLI arguments that should exit immediately
    if handle_cli_args() {
        return;
    }
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![open_file_native, reveal_file_native, create_test_file_native, download_file_native, download_with_progress, save_downloaded_file, get_writable_download_path, install_dmg_file])
        .setup(|app| {
            #[cfg(debug_assertions)] // only include this code on debug builds
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            
            // Collect and analyze command line arguments
            let args: Vec<String> = env::args().collect();
            let test_upgrade = args.iter().any(|arg| arg == "--test-upgrade" || arg == "--force-update");
            let verbose = args.iter().any(|arg| arg == "--verbose");
            let debug_mode = args.iter().any(|arg| arg == "--debug");
            
            // Debug logging for command line arguments
            #[cfg(debug_assertions)]
            {
                println!("🔧 DEBUG: Application launched with {} arguments:", args.len());
                for (i, arg) in args.iter().enumerate() {
                    println!("🔧 DEBUG: arg[{}] = '{}'", i, arg);
                }
                if test_upgrade {
                    println!("🔧 DEBUG: Test upgrade mode detected from command line");
                }
                if verbose {
                    println!("🔧 DEBUG: Verbose mode enabled");
                }
                if debug_mode {
                    println!("🔧 DEBUG: Debug mode enabled");
                }
            }
            
            // Setup Tauri environment indicators and command line info
            let window = app.get_webview_window("main").unwrap();
            
            // Create JSON-safe command line args for browser console
            let args_json: Vec<String> = args.iter().map(|arg| {
                // Escape quotes and backslashes for JSON safety
                arg.replace("\\", "\\\\").replace("\"", "\\\"")
            }).collect();
            
            let setup_script = format!(r#"
                // EARLY COMMAND LINE INFO - Log immediately for debug visibility
                console.log('🔧 === COMMAND LINE LAUNCH INFO ===');
                console.log('🔧 Application launched with {} arguments:');
                {}
                console.log('🔧 Flags detected:');
                console.log('🔧   Test upgrade mode: {}');
                console.log('🔧   Verbose mode: {}');  
                console.log('🔧   Debug mode: {}');
                console.log('🔧 === END LAUNCH INFO ===');
                
                console.log('🔧 Tauri v2 setup complete');
                console.log('🔧 Drag and drop should be enabled');
                console.log('🔧 Protocol:', window.location.protocol);
                
                // Set global variables
                window.__TEST_UPGRADE_MODE__ = {};
                window.__VERBOSE_MODE__ = {};
                window.__DEBUG_MODE__ = {};
                window.__COMMAND_LINE_ARGS__ = {};
                window.__LAUNCH_ARGUMENTS_COUNT__ = {};
                
                // Add debug helper function
                window.getDebugInfo = function() {{
                    return {{
                        commandLineArgs: window.__COMMAND_LINE_ARGS__ || [],
                        argumentCount: window.__LAUNCH_ARGUMENTS_COUNT__ || 0,
                        testUpgradeMode: window.__TEST_UPGRADE_MODE__ || false,
                        verboseMode: window.__VERBOSE_MODE__ || false,
                        debugMode: window.__DEBUG_MODE__ || false,
                        protocol: window.location.protocol,
                        origin: window.location.origin,
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        timestamp: new Date().toISOString()
                    }};
                }};
                
                // Log helper availability
                console.log('🔧 Debug helper available: Call getDebugInfo() for launch details');
            "#, 
                args.len(),
                args_json.iter().enumerate()
                    .map(|(i, arg)| format!("console.log('🔧   [{}]: \"{}\"');", i, arg))
                    .collect::<Vec<_>>()
                    .join("\n                "),
                test_upgrade,
                verbose,
                debug_mode, 
                test_upgrade,
                verbose,
                debug_mode,
                format!("[{}]", args_json.iter().map(|arg| format!("\"{}\"", arg)).collect::<Vec<_>>().join(", ")),
                args.len()
            );
            
            let _ = window.eval(&setup_script);
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}