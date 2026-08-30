import Docker from 'dockerode';
import fs from 'node:fs';
import { config } from '../config';
import { logger } from '../logger';
import type {
	DockerStatusResponse,
	DockerContainerSummary,
	DockerActionResponse,
	DockerLogsResponse
} from '$lib/types';

export class DockerService {
	private docker: Docker | null = null;
	private initialized = false;

	private getClient(): Docker | null {
		if (this.initialized) return this.docker;

		try {
			if (fs.existsSync(config.docker.socketPath)) {
				this.docker = new Docker({ socketPath: config.docker.socketPath, timeout: 5000 });
				logger.info(`Docker client initialized at ${config.docker.socketPath}`);
			} else {
				logger.warn(`Docker socket not found at ${config.docker.socketPath}`);
				this.docker = null;
			}
		} catch (err) {
			logger.warn(`Failed to initialize Docker client: ${String(err)}`);
			this.docker = null;
		}

		this.initialized = true;
		return this.docker;
	}

	/**
	 * Check if Docker daemon is accessible
	 */
	public async isAvailable(): Promise<boolean> {
		const client = this.getClient();
		if (!client) return false;

		try {
			await client.ping();
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * List all containers on the host
	 */
	public async getStatus(): Promise<DockerStatusResponse> {
		const timestamp = new Date().toISOString();
		const client = this.getClient();

		if (!client) {
			return {
				available: false,
				error: `Docker socket (${config.docker.socketPath}) is not accessible. Make sure Docker is running and socket is mounted.`,
				total: 0,
				running: 0,
				stopped: 0,
				containers: [],
				timestamp
			};
		}

		try {
			const rawContainers = await client.listContainers({ all: true });

			const containers: DockerContainerSummary[] = rawContainers.map((c) => ({
				id: c.Id.slice(0, 12),
				names: (c.Names || []).map((n) => n.replace(/^\//, '')),
				image: c.Image,
				state: c.State,
				status: c.Status,
				created: c.Created,
				ports: (c.Ports || []).map((p) => ({
					ip: p.IP,
					privatePort: p.PrivatePort,
					publicPort: p.PublicPort,
					type: p.Type
				}))
			}));

			const running = containers.filter((c) => c.state === 'running').length;
			const stopped = containers.length - running;

			return {
				available: true,
				total: containers.length,
				running,
				stopped,
				containers,
				timestamp
			};
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger.error(`Error querying Docker containers: ${errorMsg}`);

			return {
				available: false,
				error: errorMsg,
				total: 0,
				running: 0,
				stopped: 0,
				containers: [],
				timestamp
			};
		}
	}

	/**
	 * Start a container
	 */
	public async startContainer(containerId: string): Promise<DockerActionResponse> {
		const timestamp = new Date().toISOString();
		const client = this.getClient();

		if (!client) {
			return {
				success: false,
				action: 'start',
				containerId,
				message: 'Docker daemon is not accessible',
				timestamp,
				error: 'Docker client unavailable'
			};
		}

		try {
			logger.info(`Starting container: ${containerId}`);
			const container = client.getContainer(containerId);
			await container.start();

			return {
				success: true,
				action: 'start',
				containerId,
				message: `Container ${containerId} started successfully`,
				timestamp
			};
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger.error(`Failed to start container ${containerId}: ${errorMsg}`);

			return {
				success: false,
				action: 'start',
				containerId,
				message: `Failed to start container: ${errorMsg}`,
				timestamp,
				error: errorMsg
			};
		}
	}

	/**
	 * Stop a container
	 */
	public async stopContainer(containerId: string): Promise<DockerActionResponse> {
		const timestamp = new Date().toISOString();
		const client = this.getClient();

		if (!client) {
			return {
				success: false,
				action: 'stop',
				containerId,
				message: 'Docker daemon is not accessible',
				timestamp,
				error: 'Docker client unavailable'
			};
		}

		try {
			logger.info(`Stopping container: ${containerId}`);
			const container = client.getContainer(containerId);
			await container.stop({ t: 10 }); // 10 second graceful timeout before SIGKILL

			return {
				success: true,
				action: 'stop',
				containerId,
				message: `Container ${containerId} stopped successfully`,
				timestamp
			};
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger.error(`Failed to stop container ${containerId}: ${errorMsg}`);

			return {
				success: false,
				action: 'stop',
				containerId,
				message: `Failed to stop container: ${errorMsg}`,
				timestamp,
				error: errorMsg
			};
		}
	}

	/**
	 * Restart a container
	 */
	public async restartContainer(containerId: string): Promise<DockerActionResponse> {
		const timestamp = new Date().toISOString();
		const client = this.getClient();

		if (!client) {
			return {
				success: false,
				action: 'restart',
				containerId,
				message: 'Docker daemon is not accessible',
				timestamp,
				error: 'Docker client unavailable'
			};
		}

		try {
			logger.info(`Restarting container: ${containerId}`);
			const container = client.getContainer(containerId);
			await container.restart({ t: 10 });

			return {
				success: true,
				action: 'restart',
				containerId,
				message: `Container ${containerId} restarted successfully`,
				timestamp
			};
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger.error(`Failed to restart container ${containerId}: ${errorMsg}`);

			return {
				success: false,
				action: 'restart',
				containerId,
				message: `Failed to restart container: ${errorMsg}`,
				timestamp,
				error: errorMsg
			};
		}
	}

	/**
	 * Get recent container logs
	 */
	public async getContainerLogs(containerId: string, tail: number = 100): Promise<DockerLogsResponse> {
		const timestamp = new Date().toISOString();
		const client = this.getClient();

		if (!client) {
			return {
				success: false,
				containerId,
				logs: '',
				timestamp,
				error: 'Docker daemon is not accessible'
			};
		}

		try {
			const container = client.getContainer(containerId);
			const logBuffer = (await container.logs({
				stdout: true,
				stderr: true,
				tail: Math.min(500, Math.max(10, tail)),
				timestamps: true
			})) as Buffer | string;

			let logs = '';
			if (Buffer.isBuffer(logBuffer)) {
				// Parse multiplexed Docker header (8-byte header per frame) if present
				let offset = 0;
				const cleanChunks: string[] = [];

				while (offset < logBuffer.length) {
					// In multiplexed streams, byte 0 is stream type (1=stdout, 2=stderr)
					// bytes 4-7 is payload size in big endian
					if (offset + 8 <= logBuffer.length && (logBuffer[offset] === 1 || logBuffer[offset] === 2)) {
						const size = logBuffer.readUInt32BE(offset + 4);
						const chunk = logBuffer.subarray(offset + 8, offset + 8 + size).toString('utf8');
						cleanChunks.push(chunk);
						offset += 8 + size;
					} else {
						// Raw non-multiplexed text or remaining bytes
						cleanChunks.push(logBuffer.subarray(offset).toString('utf8'));
						break;
					}
				}

				logs = cleanChunks.join('');
			} else {
				logs = String(logBuffer);
			}

			return {
				success: true,
				containerId,
				logs,
				timestamp
			};
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger.error(`Failed to fetch logs for container ${containerId}: ${errorMsg}`);

			return {
				success: false,
				containerId,
				logs: '',
				timestamp,
				error: errorMsg
			};
		}
	}
}

export const dockerService = new DockerService();

