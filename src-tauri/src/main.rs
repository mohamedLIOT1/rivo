// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  #[cfg(target_os = "windows")]
  unsafe {
    std::env::set_var(
      "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
      "--enable-gpu-rasterization --disable-features=Translate,OptimizationHints,MediaRouter"
    );
  }
  app_lib::run();
}
