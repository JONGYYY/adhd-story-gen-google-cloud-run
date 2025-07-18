import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Test Python availability
    const pythonPath = process.env.VERCEL ? 'python3' : 'python3';
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, ['--version']);
      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      pythonProcess.on('close', (code) => {
        resolve(NextResponse.json({
          success: code === 0,
          pythonPath,
          code,
          stdout: stdoutData,
          stderr: stderrData,
          env: {
            VERCEL: process.env.VERCEL,
            NODE_ENV: process.env.NODE_ENV,
            PYTHON_VERSION: process.env.PYTHON_VERSION
          }
        }));
      });

      pythonProcess.on('error', (err) => {
        resolve(NextResponse.json({
          success: false,
          error: err.message,
          pythonPath,
          env: {
            VERCEL: process.env.VERCEL,
            NODE_ENV: process.env.NODE_ENV,
            PYTHON_VERSION: process.env.PYTHON_VERSION
          }
        }));
      });
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      env: {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
        PYTHON_VERSION: process.env.PYTHON_VERSION
      }
    });
  }
} 