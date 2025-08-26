export type EnqueueVideoPayload = {
	videoId: string;
	options: any;
	requestedAt: number;
};

export type WorkerResult = {
	success: true;
	videoId: string;
	videoUrl: string;
} | {
	success: false;
	videoId: string;
	error: string;
}; 