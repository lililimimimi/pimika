use std::error::Error;
use std::fs::{create_dir_all, File, OpenOptions};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

/// The backend processes, kept so they can be stopped when the app closes
struct Backends(Mutex<Vec<Child>>);

/// The bridge keeps its default port (3100), which the backend also expects
const BRIDGE_PORT: u16 = 3100;

/// A free port on this computer. Asking the system for port 0 gives one that nothing is using.
fn free_port() -> u16 {
  let listener = TcpListener::bind("127.0.0.1:0").expect("a free local port");
  let port = listener.local_addr().expect("the port number").port();
  drop(listener); // the port is free again; the backend takes it a moment later
  port
}

/// A random secret for this launch only, 32 bytes from the system's random source, as hex
fn new_token() -> String {
  let mut bytes = [0u8; 32];
  File::open("/dev/urandom")
    .and_then(|mut file| file.read_exact(&mut bytes))
    .expect("random bytes from the system");
  bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// Asks one local port for one path once. True only if it answers 200.
/// `token` is sent in the X-Pi-Token header when given (the FastAPI backend needs it).
fn healthy(port: u16, path: &str, token: Option<&str>) -> bool {
  let address = format!("127.0.0.1:{port}").parse().expect("valid address");
  let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(500)) else {
    return false;
  };
  let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
  let token_header = token.map(|t| format!("X-Pi-Token: {t}\r\n")).unwrap_or_default();
  let request = format!("GET {path} HTTP/1.1\r\nHost: localhost\r\n{token_header}Connection: close\r\n\r\n");
  if stream.write_all(request.as_bytes()).is_err() {
    return false;
  }
  let mut buffer = [0u8; 256];
  let read = stream.read(&mut buffer).unwrap_or(0);
  String::from_utf8_lossy(&buffer[..read]).starts_with("HTTP/1.1 200")
}

/// Two log files for one child process: its normal output and its errors, both kept on disk
fn open_log(dir: &Path, name: &str) -> std::io::Result<(Stdio, Stdio)> {
  create_dir_all(dir)?;
  // Append, so the output of earlier runs is kept and the two handles never overwrite each other
  let file = OpenOptions::new().create(true).append(true).open(dir.join(name))?;
  let copy = file.try_clone()?;
  Ok((Stdio::from(file), Stdio::from(copy)))
}

/// The HTTPS proxy from the macOS network settings (for example a VPN client), if one is on.
/// Apps started from Finder do not see it as an environment variable, so it is read here.
fn system_proxy() -> Option<String> {
  let output = Command::new("scutil").arg("--proxy").output().ok()?;
  let text = String::from_utf8_lossy(&output.stdout);
  let value = |key: &str| {
    text.lines().find_map(|line| {
      let (name, value) = line.split_once(':')?;
      (name.trim() == key).then(|| value.trim().to_string())
    })
  };
  if value("HTTPSEnable")? != "1" {
    return None;
  }
  Some(format!("http://{}:{}", value("HTTPSProxy")?, value("HTTPSPort")?))
}

/// Proxy settings for the bridge, so its requests to Claude and OpenAI leave through the proxy.
/// A proxy already set in the environment wins.
fn bridge_proxy_env() -> Vec<(&'static str, String)> {
  if std::env::var("HTTPS_PROXY").is_ok() || std::env::var("HTTP_PROXY").is_ok() {
    return Vec::new();
  }
  match system_proxy() {
    Some(proxy) => vec![
      ("HTTPS_PROXY", proxy.clone()),
      ("HTTP_PROXY", proxy),
      ("NO_PROXY", "127.0.0.1,localhost".to_string()),
    ],
    None => Vec::new(),
  }
}

/// Development: run the backend and the bridge from the source folders (see README).
fn start_from_source(api_port: u16, token: &str, log_dir: &Path) -> std::io::Result<(Child, Child)> {
  // The backend, with the venv that already exists in backend/
  let backend_dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../../backend");
  let uvicorn = concat!(env!("CARGO_MANIFEST_DIR"), "/../../backend/.venv/bin/uvicorn");
  let backend = Command::new(uvicorn)
    .args(["app.main:app", "--host", "127.0.0.1", "--port", &api_port.to_string()])
    .env("PI_APP_TOKEN", token)
    .env("CORS_ORIGINS", "tauri://localhost,http://tauri.localhost,http://localhost:5173")
    .current_dir(backend_dir)
    .stdout(open_log(log_dir, "backend.log")?.0)
    .stderr(open_log(log_dir, "backend.log")?.1)
    .spawn()?;

  // The bridge, through Node running tsx. PI_NODE can point at a specific Node.
  let node = std::env::var("PI_NODE").unwrap_or_else(|_| "node".to_string());
  let bridge_dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../../pi-bridge");
  let bridge = Command::new(node)
    .args(["--import", "tsx", "server.ts"])
    .current_dir(bridge_dir)
    .envs(bridge_proxy_env())
    .stdout(open_log(log_dir, "bridge.log")?.0)
    .stderr(open_log(log_dir, "bridge.log")?.1)
    .spawn()?;
  Ok((backend, bridge))
}

/// Installed app: run the backend and the bridge that were packed inside the app
/// (see backend/packaging and pi-bridge/packaging).
fn start_packaged(app: &AppHandle, api_port: u16, token: &str, log_dir: &Path) -> Result<(Child, Child), Box<dyn Error>> {
  let resources: PathBuf = app.path().resource_dir()?;

  let backend = Command::new(resources.join("backend").join("pi-backend"))
    .args(["--port", &api_port.to_string()])
    .env("PI_APP_TOKEN", token)
    .env("CORS_ORIGINS", "tauri://localhost,http://tauri.localhost")
    .current_dir(resources.join("backend"))
    .stdout(open_log(log_dir, "backend.log")?.0)
    .stderr(open_log(log_dir, "backend.log")?.1)
    .spawn()?;

  let bridge_dir = resources.join("bridge");
  let bridge = Command::new(bridge_dir.join("node"))
    .arg("server.mjs")
    .current_dir(&bridge_dir)
    .envs(bridge_proxy_env())
    .stdout(open_log(log_dir, "bridge.log")?.0)
    .stderr(open_log(log_dir, "bridge.log")?.1)
    .spawn()?;
  Ok((backend, bridge))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // Opens links, such as the Claude.ai login page, in the default browser
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // A new random port and a new secret for every launch
      let api_port = free_port();
      let token = new_token();

      // 1. Start the backend and the bridge: from the source folders in development,
      //    from the copies packed inside the app in a release build.
      // Logs of the backend and the bridge go here, so a failure can be read afterwards
      let log_dir = app.path().app_log_dir()?;
      let (backend, bridge) = if cfg!(debug_assertions) {
        start_from_source(api_port, &token, &log_dir)?
      } else {
        start_packaged(app.handle(), api_port, &token, &log_dir)?
      };
      app.manage(Backends(Mutex::new(vec![backend, bridge])));

      // 2. The window, created here so the page gets its startup config before it loads.
      //    It stays hidden until both backends answer.
      let config = format!(
        "window.__PI_CONFIG__ = {{ apiBase: 'http://127.0.0.1:{api_port}/api', token: '{token}' }};"
      );
      WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Pimika")
        .inner_size(1100.0, 760.0)
        .visible(false)
        .initialization_script(&config)
        .build()?;

      let handle = app.handle().clone();
      thread::spawn(move || {
        let started = Instant::now();
        while started.elapsed() < Duration::from_secs(30) {
          if healthy(api_port, "/api/health", Some(&token)) && healthy(BRIDGE_PORT, "/health", None) {
            if let Some(window) = handle.get_webview_window("main") {
              let _ = window.show();
            }
            return;
          }
          thread::sleep(Duration::from_millis(200));
        }
        eprintln!("backends did not all answer their health checks within 30 seconds; the window stays hidden");
      });
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| {
      // When the app is closing, stop both backends too
      if let RunEvent::Exit = event {
        if let Some(backends) = app.try_state::<Backends>() {
          for mut child in backends.0.lock().unwrap().drain(..) {
            let _ = child.kill();
          }
        }
      }
    });
}
