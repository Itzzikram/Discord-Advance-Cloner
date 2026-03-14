import { spawn, ChildProcess } from 'child_process';
import { logger } from './logger';
import * as path from 'path';
import * as fs from 'fs';

// @ts-ignore - __dirname is available in CommonJS
declare const __dirname: string;

let proxyProcess: ChildProcess | null = null;

export function spawnRustProxy(proxyPath?: string): ChildProcess {
  if (proxyProcess) {
    logger.warn('Proxy process already running');
    return proxyProcess;
  }

  // __dirname is ts/dist/utils, so go up 3 levels to project root, then to rust/target/release
  const projectRoot = path.resolve(__dirname, '../../..');
  const rustBinary = proxyPath || path.join(projectRoot, 'rust/target/release/discord-cloner-hybrid');
  
  // On Windows, add .exe extension if not present
  const rustBinaryExe = process.platform === 'win32' && !rustBinary.endsWith('.exe') 
    ? `${rustBinary}.exe` 
    : rustBinary;
  
  // Check if the executable exists before trying to spawn it
  if (!fs.existsSync(rustBinaryExe)) {
    logger.info(`Rust proxy executable not found at ${rustBinaryExe}. Rust components are optional - using TypeScript fallback.`);
    logger.debug(`To build Rust components: cd rust && cargo build --release`);
    const error = new Error(`Rust proxy executable not found`);
    throw error;
  }
  
  logger.info(`Spawning Rust proxy: ${rustBinaryExe}`);
  
  proxyProcess = spawn(rustBinaryExe, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  proxyProcess.stdout?.on('data', (data: Buffer) => {
    logger.debug(`[Proxy] ${data.toString()}`);
  });

  proxyProcess.stderr?.on('data', (data: Buffer) => {
    logger.error(`[Proxy Error] ${data.toString()}`);
  });

  proxyProcess.on('exit', (code: number | null) => {
    logger.warn(`Proxy process exited with code ${code}`);
    proxyProcess = null;
  });

  proxyProcess.on('error', (error: Error) => {
    logger.error(`Failed to spawn proxy: ${error.message}`);
    proxyProcess = null;
  });

  return proxyProcess;
}

export function stopProxy(): void {
  if (proxyProcess) {
    logger.info('Stopping proxy process');
    proxyProcess.kill();
    proxyProcess = null;
  }
}

