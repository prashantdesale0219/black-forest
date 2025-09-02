import { NextResponse } from 'next/server';
import axios from 'axios';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { mkdir } from 'fs/promises';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
    }

    const formData = await request.formData();
    const garmentFile = formData.get('garment');
    
    if (!garmentFile) {
      return NextResponse.json({ error: 'No garment file uploaded' }, { status: 400 });
    }

    // Create a temporary file to store the uploaded image
    const bytes = await garmentFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create temp directory if it doesn't exist
    const tempDir = join(process.cwd(), 'temp');
    try {
      await mkdir(tempDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    const tempFilePath = join(tempDir, `${uuidv4()}-${garmentFile.name}`);
    await writeFile(tempFilePath, buffer);

    // Create a new FormData to send to the backend
    const backendFormData = new FormData();
    const fileBlob = new Blob([buffer], { type: garmentFile.type });
    backendFormData.append('garment', fileBlob, garmentFile.name);
    
    // Add other form fields
    for (const [key, value] of formData.entries()) {
      if (key !== 'garment') {
        backendFormData.append(key, value);
      }
    }

    // Forward the request to the backend
    const response = await axios.post(
      `${process.env.BACKEND_URL}/api/garments/upload`,
      backendFormData,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error uploading garment:', error);
    return NextResponse.json(
      { error: error.response?.data?.error || 'Failed to upload garment' },
      { status: error.response?.status || 500 }
    );
  }
}