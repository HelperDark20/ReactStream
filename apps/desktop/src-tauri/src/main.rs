// Previene una consola adicional en Windows en builds release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    reactstream_desktop_lib::run();
}
