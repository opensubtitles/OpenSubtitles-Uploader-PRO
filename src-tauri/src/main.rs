// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::env;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(debug_assertions)] // only include this code on debug builds
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            
            // Check for command line arguments
            let args: Vec<String> = env::args().collect();
            let test_upgrade = args.iter().any(|arg| arg == "--test-upgrade" || arg == "--force-update");
            
            // Setup Tauri environment indicators and test mode
            let window = app.get_webview_window("main").unwrap();
            let setup_script = format!(r#"
                console.log('🔧 Tauri v2 setup complete');
                console.log('🔧 Drag and drop should be enabled');
                console.log('🔧 Protocol:', window.location.protocol);
                console.log('🔧 Test upgrade mode:', {});
                
                // Set global test upgrade flag
                window.__TEST_UPGRADE_MODE__ = {};
            "#, test_upgrade, test_upgrade);
            
            let _ = window.eval(&setup_script);
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}