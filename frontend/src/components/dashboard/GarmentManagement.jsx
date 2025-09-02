'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Upload, Shirt, Trash2, Eye, XCircle } from 'lucide-react';
import Image from 'next/image';
import { getAuthToken } from '../../lib/cookieUtils';

const GarmentManagement = () => {
  const [garments, setGarments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState(null);
  const [category, setCategory] = useState('shirt');
  const [garmentName, setGarmentName] = useState('');

  useEffect(() => {
    fetchGarments();
  }, []);

  const fetchGarments = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await axios.get('/api/garments', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setGarments(response.data.data?.garments || []);
    } catch (error) {
      console.error('Error fetching garments:', error);
      toast.error('Failed to fetch garments');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    if (!garmentName.trim()) {
      toast.error('Please enter a name for the garment');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('garment', file);
    formData.append('name', garmentName);
    formData.append('category', category);

    try {
      const token = getAuthToken();
      await axios.post('/api/garments/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      
      toast.success('Garment uploaded successfully!');
      setGarmentName('');
      fetchGarments(); // Refresh the list
    } catch (error) {
      console.error('Error uploading garment:', error);
      const message = error.response?.data?.error || 'Failed to upload garment';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }, [garmentName, category]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: false
  });

  const handleDelete = async (garmentId) => {
    if (!window.confirm('Are you sure you want to delete this garment?')) {
      return;
    }

    try {
      const token = getAuthToken();
      await axios.delete(`/api/garments/${garmentId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      toast.success('Garment deleted successfully!');
      fetchGarments();
    } catch (error) {
      console.error('Error deleting garment:', error);
      const message = error.response?.data?.error || 'Failed to delete garment';
      toast.error(message);
    }
  };

  const categoryOptions = [
    { value: 'shirt', label: 'Shirt' },
    { value: 'tshirt', label: 'T-Shirt' },
    { value: 'pants', label: 'Pants' },
    { value: 'dress', label: 'Dress' },
    { value: 'jacket', label: 'Jacket' },
    { value: 'sweater', label: 'Sweater' },
    { value: 'skirt', label: 'Skirt' },
    { value: 'other', label: 'Other' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Garment Management</h1>
        <p className="text-gray-600">
          Upload and manage your clothing items for virtual try-on.
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Upload New Garment
        </h2>

        <div className="mb-4">
          <label htmlFor="garmentName" className="block text-sm font-medium text-gray-700 mb-1">
            Garment Name
          </label>
          <input
            type="text"
            id="garmentName"
            value={garmentName}
            onChange={(e) => setGarmentName(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter garment name"
            disabled={uploading}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={uploading}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} disabled={uploading} />
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p className="text-gray-600">Uploading garment...</p>
            </div>
          ) : isDragActive ? (
            <p className="text-blue-600 font-medium">
              Drop the image here...
            </p>
          ) : (
            <div>
              <p className="text-gray-600 mb-2">
                Drag & drop a garment image here, or click to select
              </p>
              <p className="text-sm text-gray-500">
                Supports: JPG, PNG, WEBP (Max 50MB)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Garments Grid */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Your Garments ({garments.length})
          </h2>
        </div>

        {garments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {garments.map((garment) => (
              <div key={garment._id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200">
                <div className="relative aspect-square group">
                  <Image
                    src={garment.url}
                    alt={garment.name}
                    fill
                    className="object-cover"
                    onError={(e) => {
                      e.target.src = '/placeholder-model.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-2">
                    <button
                      onClick={() => setSelectedGarment(garment)}
                      className="bg-white text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(garment._id)}
                      className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 truncate">
                      {garment.name}
                    </h3>
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                      {garment.category}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(garment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => setSelectedGarment(garment)}
                    className="w-full bg-blue-600 text-white text-sm py-2 px-3 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Shirt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No garments uploaded yet
            </h3>
            <p className="text-gray-600 mb-6">
              Upload your first garment to get started with virtual try-on.
            </p>
          </div>
        )}
      </div>

      {/* Garment Preview Modal */}
      {selectedGarment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedGarment.name}
                </h3>
                <button
                  onClick={() => setSelectedGarment(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="mb-4">
                <Image
                  src={selectedGarment.url}
                  alt={selectedGarment.name}
                  width={500}
                  height={500}
                  className="w-full h-auto rounded-lg"
                  onError={(e) => {
                    e.target.src = '/placeholder-model.jpg';
                  }}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Category:</span>
                  <span className="ml-2 text-gray-600 capitalize">
                    {selectedGarment.category}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Created:</span>
                  <span className="ml-2 text-gray-600">
                    {new Date(selectedGarment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {selectedGarment.metadata?.width && selectedGarment.metadata?.height && (
                  <div>
                    <span className="font-medium text-gray-700">Dimensions:</span>
                    <span className="ml-2 text-gray-600">
                      {selectedGarment.metadata.width} x {selectedGarment.metadata.height}
                    </span>
                  </div>
                )}
                {selectedGarment.metadata?.format && (
                  <div>
                    <span className="font-medium text-gray-700">Format:</span>
                    <span className="ml-2 text-gray-600 uppercase">
                      {selectedGarment.metadata.format}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    handleDelete(selectedGarment._id);
                    setSelectedGarment(null);
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                >
                  Delete Garment
                </button>
                <button
                  onClick={() => setSelectedGarment(null)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GarmentManagement;