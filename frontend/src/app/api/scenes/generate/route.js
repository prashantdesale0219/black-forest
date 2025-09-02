import { NextResponse } from 'next/server';
import axios from 'axios';

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
      `${backendUrl}/api/scenes/generate`,
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
    console.error('Error generating scene:', error);
    return NextResponse.json(
      { error: error.response?.data?.error || 'Failed to generate scene' },
      { status: error.response?.status || 500 }
    );
  }
}