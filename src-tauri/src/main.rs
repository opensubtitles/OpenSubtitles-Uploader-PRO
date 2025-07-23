// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            #[cfg(debug_assertions)] // only include this code on debug builds
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            
            // Setup Tauri environment indicators
            let window = app.get_webview_window("main").unwrap();
            let _ = window.eval(r#"
                console.log('🔧 Tauri v2 setup complete');
                console.log('🔧 Drag and drop should be enabled');
                console.log('🔧 Protocol:', window.location.protocol);
            "#);
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}