import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
    }

    // Forward the request to the backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const response = await axios.get(`${backendUrl}/api/tryon`, {
      headers: {
        Authorization: authHeader
      }
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error fetching try-on jobs:', error);
    return NextResponse.json(
      { error: error.response?.data?.error || 'Failed to fetch try-on jobs' },
      { status: error.response?.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
    }

    const requestData = await request.json();

    // Forward the request to the backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const response = await axios.post(
      `${backendUrl}/api/tryon`,
      requestData,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        }
      }
    );

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error creating try-on job:', error);
    return NextResponse.json(
      { error: error.response?.data?.error || 'Failed to create try-on job' },
      { status: error.response?.status || 500 }
    );
  }
}