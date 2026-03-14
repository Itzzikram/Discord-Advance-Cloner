use discord_cloner_hybrid::CloneClient;
use serde::{Deserialize, Serialize};
use std::io::{self, BufRead, BufReader};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize)]
struct Request {
    id: u64,
    method: String,
    params: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct Response {
    success: bool,
    data: Option<serde_json::Value>,
    error: Option<String>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let args: Vec<String> = std::env::args().collect();
    let token = args
        .get(1)
        .map(|s| s.as_str())
        .or_else(|| std::env::var("DISCORD_TOKEN").ok().as_deref())
        .ok_or_else(|| anyhow::anyhow!("Token required"))?;

    let client = Arc::new(Mutex::new(CloneClient::new(token.to_string())));

    let stdin = io::stdin();
    let reader = BufReader::new(stdin.lock());

    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        match serde_json::from_str::<Request>(&line) {
            Ok(request) => {
                let client_clone = client.clone();
                tokio::spawn(async move {
                    let response = handle_request(client_clone, request).await;
                    println!("{}", serde_json::to_string(&response).unwrap_or_default());
                });
            }
            Err(e) => {
                let response = Response {
                    success: false,
                    data: None,
                    error: Some(format!("Invalid request: {}", e)),
                };
                println!("{}", serde_json::to_string(&response).unwrap_or_default());
            }
        }
    }

    Ok(())
}

async fn handle_request(
    client: Arc<Mutex<CloneClient>>,
    request: Request,
) -> Response {
    let client_guard = client.lock().await;

    match request.method.as_str() {
        "create_role" => {
            // Implementation would parse params and call create_role
            Response {
                success: false,
                data: None,
                error: Some("Not implemented in binary mode".to_string()),
            }
        }
        "create_channel" => {
            Response {
                success: false,
                data: None,
                error: Some("Not implemented in binary mode".to_string()),
            }
        }
        "create_webhook" => {
            Response {
                success: false,
                data: None,
                error: Some("Not implemented in binary mode".to_string()),
            }
        }
        _ => Response {
            success: false,
            data: None,
            error: Some(format!("Unknown method: {}", request.method)),
        },
    }
}

