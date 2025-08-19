import AWS from 'aws-sdk';
import fs from 'fs/promises';
import path from 'path';

export type R2Config = {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	publicBaseUrl?: string; // e.g. https://cdn.example.com or https://<account-id>.r2.cloudflarestorage.com/<bucket>
};

export function getR2Config(): R2Config | null {
	const accountId = process.env.R2_ACCOUNT_ID;
	const accessKeyId = process.env.R2_ACCESS_KEY_ID;
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
	const bucket = process.env.R2_BUCKET;
	const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
	if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
	return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

export function isR2Configured(): boolean {
	return getR2Config() !== null;
}

function createS3Client(config: R2Config): AWS.S3 {
	const endpoint = new AWS.Endpoint(`https://${config.accountId}.r2.cloudflarestorage.com`);
	AWS.config.update({
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
		signatureVersion: 'v4',
		region: 'auto' as any,
	});
	return new AWS.S3({ endpoint, s3ForcePathStyle: true });
}

export async function uploadFileToR2(localFilePath: string, key: string, contentType?: string): Promise<string> {
	const cfg = getR2Config();
	if (!cfg) throw new Error('R2 is not configured');
	const s3 = createS3Client(cfg);
	const body = await fs.readFile(localFilePath);
	await s3
		.putObject({
			Bucket: cfg.bucket,
			Key: key,
			Body: body,
			ContentType: contentType || guessContentTypeByExtension(localFilePath),
			ACL: 'public-read' as any,
		})
		.promise();
	return buildPublicUrl(cfg, key);
}

function guessContentTypeByExtension(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();
	if (ext === '.mp4') return 'video/mp4';
	if (ext === '.mp3') return 'audio/mpeg';
	if (ext === '.json') return 'application/json';
	return 'application/octet-stream';
}

function buildPublicUrl(cfg: R2Config, key: string): string {
	if (cfg.publicBaseUrl) {
		return cfg.publicBaseUrl.replace(/\/$/, '') + '/' + key;
	}
	// Default public URL form for R2 without custom domain
	return `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${key}`;
} 