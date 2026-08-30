export type NasStatusState = 'ONLINE' | 'OFFLINE' | 'STARTING' | 'AUTH_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN';

export interface NasStatusResponse {
	state: NasStatusState;
	host: string;
	activeHost?: string;
	candidateHosts?: string[];
	port: number;
	model?: string;
	version?: string;
	uptime?: number;
	errorMessage?: string;
	lastChecked: string;
}

export interface NasPowerResponse {
	success: boolean;
	action: 'shutdown' | 'restart';
	message: string;
	timestamp: string;
	error?: string;
}

export interface WolResponse {
	success: boolean;
	targetMacMasked: string;
	broadcastAddress: string;
	port: number;
	timestamp: string;
	error?: string;
}

export interface PiStatusResponse {
	hostname: string;
	platform: string;
	release: string;
	arch: string;
	uptime: number;
	cpu: {
		cores: number;
		usagePercent: number;
		loadAvg: number[];
	};
	memory: {
		totalBytes: number;
		usedBytes: number;
		freeBytes: number;
		usagePercent: number;
	};
	disk: {
		totalBytes: number;
		usedBytes: number;
		freeBytes: number;
		usagePercent: number;
	};
	temperature: {
		celsius: number | null;
		status: 'ok' | 'warm' | 'hot' | 'unknown';
	};
	timestamp: string;
}

export interface DockerContainerSummary {
	id: string;
	names: string[];
	image: string;
	state: 'created' | 'restarting' | 'running' | 'removing' | 'paused' | 'exited' | 'dead' | string;
	status: string;
	created: number;
	ports: Array<{
		ip?: string;
		privatePort: number;
		publicPort?: number;
		type: string;
	}>;
}

export interface DockerStatusResponse {
	available: boolean;
	error?: string;
	total: number;
	running: number;
	stopped: number;
	containers: DockerContainerSummary[];
	timestamp: string;
}

export interface DockerActionResponse {
	success: boolean;
	action: 'start' | 'stop' | 'restart';
	containerId: string;
	message: string;
	timestamp: string;
	error?: string;
}

export interface DockerLogsResponse {
	success: boolean;
	containerId: string;
	logs: string;
	timestamp: string;
	error?: string;
}

export interface HealthResponse {
	status: 'healthy' | 'degraded';
	version: string;
	uptime: number;
	timestamp: string;
	services: {
		nas: { configured: boolean; state: NasStatusState; activeHost?: string };
		docker: { available: boolean; containerCount: number };
		system: { platform: string; loadAvg: number[] };
	};
}

export interface AuthSessionResponse {
	authenticated: boolean;
	configured: boolean;
}
