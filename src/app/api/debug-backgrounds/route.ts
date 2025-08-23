import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
	try {
		const backgroundsDir = path.join(process.cwd(), 'public', 'backgrounds');
		console.log('Checking backgrounds directory:', backgroundsDir);
		
		const categories = await fs.readdir(backgroundsDir);
		const results: Record<string, any> = {};
		
		for (const category of categories) {
			const categoryPath = path.join(backgroundsDir, category);
			const stats = await fs.stat(categoryPath);
			
			if (stats.isDirectory()) {
				const files = await fs.readdir(categoryPath);
				const fileStats = await Promise.all(
					files.map(async (file) => {
						const filePath = path.join(categoryPath, file);
						const fileStat = await fs.stat(filePath);
						return {
							name: file,
							size: fileStat.size,
							path: filePath,
							exists: true
						};
					})
				);
				
				results[category] = {
					path: categoryPath,
					exists: true,
					files: fileStats
				};
			} else {
				results[category] = {
					path: categoryPath,
					exists: true,
					isFile: true,
					size: stats.size
				};
			}
		}
		
		return NextResponse.json({
			success: true,
			backgroundsDir,
			categories: results,
			totalCategories: Object.keys(results).length
		});
	} catch (error) {
		console.error('Error checking backgrounds:', error);
		return NextResponse.json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			backgroundsDir: path.join(process.cwd(), 'public', 'backgrounds')
		}, { status: 500 });
	}
} 