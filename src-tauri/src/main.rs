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
            
            // Collect and analyze command line arguments
            let args: Vec<String> = env::args().collect();
            let test_upgrade = args.iter().any(|arg| arg == "--test-upgrade" || arg == "--force-update");
            
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
            }
            
            // Setup Tauri environment indicators and command line info
            let window = app.get_webview_window("main").unwrap();
            
            // Create JSON-safe command line args for browser console
            let args_json: Vec<String> = args.iter().map(|arg| {
                // Escape quotes and backslashes for JSON safety
                arg.replace("\\", "\\\\").replace("\"", "\\\"")
            }).collect();
            
            let setup_script = format!(r#"
                console.log('🔧 Tauri v2 setup complete');
                console.log('🔧 Drag and drop should be enabled');
                console.log('🔧 Protocol:', window.location.protocol);
                console.log('🔧 Command line arguments ({}):');
                {}
                console.log('🔧 Test upgrade mode:', {});
                
                // Set global variables
                window.__TEST_UPGRADE_MODE__ = {};
                window.__COMMAND_LINE_ARGS__ = {};
                window.__LAUNCH_ARGUMENTS_COUNT__ = {};
                
                // Add debug helper function
                window.getDebugInfo = function() {{
                    return {{
                        commandLineArgs: window.__COMMAND_LINE_ARGS__ || [],
                        argumentCount: window.__LAUNCH_ARGUMENTS_COUNT__ || 0,
                        testUpgradeMode: window.__TEST_UPGRADE_MODE__ || false,
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
                test_upgrade,
                format!("[{}]", args_json.iter().map(|arg| format!("\"{}\"", arg)).collect::<Vec<_>>().join(", ")),
                args.len()
            );
            
            let _ = window.eval(&setup_script);
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}