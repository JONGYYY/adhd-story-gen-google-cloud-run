import AWS from 'aws-sdk';
import fs from 'fs/promises';
import path from 'path';

export type S3Config = {
	region: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	publicBaseUrl?: string; // e.g. https://dxxxx.cloudfront.net or https://<bucket>.s3.<region>.amazonaws.com
};

export function getS3Config(): S3Config | null {
	const region = process.env.S3_REGION;
	const bucket = process.env.S3_BUCKET;
	const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
	const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
	const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
	if (!region || !bucket || !accessKeyId || !secretAccessKey) return null;
	return { region, bucket, accessKeyId, secretAccessKey, publicBaseUrl };
}

export function isS3Configured(): boolean {
	return getS3Config() !== null;
}

function createS3Client(cfg: S3Config): AWS.S3 {
	AWS.config.update({
		accessKeyId: cfg.accessKeyId,
		secretAccessKey: cfg.secretAccessKey,
		region: cfg.region,
		signatureVersion: 'v4',
	});
	return new AWS.S3();
}

export async function uploadFileToS3(localFilePath: string, key: string, contentType?: string): Promise<string> {
	const cfg = getS3Config();
	if (!cfg) throw new Error('S3 is not configured');
	const s3 = createS3Client(cfg);
	const Body = await fs.readFile(localFilePath);
	await s3
		.putObject({
			Bucket: cfg.bucket,
			Key: key,
			Body,
			ContentType: contentType || guessContentTypeByExtension(localFilePath),
			ACL: 'public-read',
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

function buildPublicUrl(cfg: S3Config, key: string): string {
	if (cfg.publicBaseUrl) {
		return cfg.publicBaseUrl.replace(/\/$/, '') + '/' + key;
	}
	return `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${key}`;
} 