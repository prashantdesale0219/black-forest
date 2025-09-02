import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
    }

    // Get job ID from the URL
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Forward the request to the backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const response = await axios.get(`${backendUrl}/api/tryon/status/${jobId}`, {
      headers: {
        Authorization: authHeader
      }
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error checking try-on job status:', error);
    return NextResponse.json(
      { error: error.response?.data?.error || 'Failed to check try-on job status' },
      { status: error.response?.status || 500 }
    );
  }
}