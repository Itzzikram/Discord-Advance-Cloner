import { spawn, ChildProcess } from 'child_process';
import { logger } from './logger';
import * as path from 'path';
import * as fs from 'fs';

// @ts-ignore - __dirname is available in CommonJS
declare const __dirname: string;

interface RustClientResponse {
  success: boolean;
  data?: any;
  error?: string;
}

let rustClientProcess: ChildProcess | null = null;
let requestId = 0;
const pendingRequests = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();

export function spawnRustClient(token: string): ChildProcess {
  if (rustClientProcess) {
    logger.warn('Rust client process already running');
    return rustClientProcess;
  }

  // __dirname is ts/dist/utils, so go up 3 levels to project root, then to rust/target/release
  const projectRoot = path.resolve(__dirname, '../../..');
  const rustBinary = path.join(projectRoot, 'rust/target/release/discord-cloner-hybrid');
  
  // On Windows, add .exe extension if not present
  const rustBinaryExe = process.platform === 'win32' && !rustBinary.endsWith('.exe') 
    ? `${rustBinary}.exe` 
    : rustBinary;
  
  // Check if the executable exists before trying to spawn it
  if (!fs.existsSync(rustBinaryExe)) {
    logger.info(`Rust client executable not found at ${rustBinaryExe}. Rust components are optional - using TypeScript fallback.`);
    logger.debug(`To build Rust components: cd rust && cargo build --release`);
    const error = new Error(`Rust client executable not found`);
    throw error;
  }
  
  logger.info(`Spawning Rust client: ${rustBinaryExe}`);
  
  rustClientProcess = spawn(rustBinaryExe, ['--token', token], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buffer = '';

  rustClientProcess.stdout?.on('data', (data: Buffer) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response: RustClientResponse = JSON.parse(line);
          if (response.success && response.data) {
            const request = pendingRequests.get(response.data.requestId);
            if (request) {
              pendingRequests.delete(response.data.requestId);
              request.resolve(response.data);
            }
          } else if (response.error) {
            const request = pendingRequests.get(parseInt(response.error));
            if (request) {
              pendingRequests.delete(parseInt(response.error));
              request.reject(new Error(response.error));
            }
          }
        } catch (error) {
          logger.debug(`[Rust Client] ${line}`);
        }
      }
    }
  });

  rustClientProcess.stderr?.on('data', (data: Buffer) => {
    logger.error(`[Rust Client Error] ${data.toString()}`);
  });

  rustClientProcess.on('exit', (code: number | null) => {
    logger.warn(`Rust client process exited with code ${code}`);
    rustClientProcess = null;
  });

  rustClientProcess.on('error', (error: Error) => {
    logger.error(`Failed to spawn Rust client: ${error.message}`);
    rustClientProcess = null;
  });

  return rustClientProcess;
}

export async function callRustClient(method: string, params: any): Promise<any> {
  if (!rustClientProcess) {
    throw new Error('Rust client not initialized');
  }

  const currentRequestId = ++requestId;
  const request = {
    id: currentRequestId,
    method,
    params,
  };

  return new Promise((resolve, reject) => {
    pendingRequests.set(currentRequestId, { resolve, reject });

    const timeout: NodeJS.Timeout = setTimeout(() => {
      pendingRequests.delete(currentRequestId);
      reject(new Error(`Request timeout: ${method}`));
    }, 30000);

    const originalResolve = pendingRequests.get(currentRequestId)?.resolve;
    const originalReject = pendingRequests.get(currentRequestId)?.reject;

    if (originalResolve && originalReject) {
      pendingRequests.set(currentRequestId, {
        resolve: (value) => {
          clearTimeout(timeout);
          originalResolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          originalReject(error);
        },
      });
    }

    rustClientProcess?.stdin?.write(JSON.stringify(request) + '\n');
  });
}

export function isRustClientAvailable(): boolean {
  // Check if process exists and hasn't exited yet
  return rustClientProcess !== null && 
         rustClientProcess !== undefined && 
         (rustClientProcess.exitCode === null || rustClientProcess.exitCode === undefined);
}

export function stopRustClient(): void {
  if (rustClientProcess) {
    logger.info('Stopping Rust client process');
    rustClientProcess.kill();
    rustClientProcess = null;
  }
}

