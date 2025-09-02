'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Upload, User, Trash2, Eye, CheckCircle, XCircle, Clock, Plus } from 'lucide-react';
import Image from 'next/image';
import { getAuthToken } from '../../lib/cookieUtils';

const ModelManagement = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState('');

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      // Use a try-catch block to handle potential network errors
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/models`, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          // Add timeout to prevent hanging requests
          timeout: parseInt(process.env.NEXT_PUBLIC_TIMEOUT || '10000')
        });
        console.log('Models response:', response.data);
        
        if (response.data && response.data.data) {
          // Check if models is an array
          if (Array.isArray(response.data.data.models)) {
            console.log('Setting models from response.data.data.models:', response.data.data.models);
            setModels(response.data.data.models);
          } else {
            // If models is directly in data
            console.log('Setting models from response.data.data:', response.data.data);
            setModels(response.data.data || []);
          }
        } else {
          console.error('Invalid response format:', response.data);
          setModels([]);
        }
      } catch (axiosError) {
        console.error('Axios error details:', axiosError.message);
        if (axiosError.code === 'ERR_NETWORK') {
          toast.error('Network error: Cannot connect to backend server. Please ensure the backend is running.');
        } else {
          toast.error(`Failed to fetch models: ${axiosError.message}`);
        }
      }
    } catch (error) {
      console.error('Error in fetchModels:', error);
      toast.error('Failed to fetch models');
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

    setUploading(true);
    const formData = new FormData();
    formData.append('model', file);

    try {
      const token = getAuthToken();
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/models/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      
      toast.success('Model uploaded successfully!');
      fetchModels(); // Refresh the list
    } catch (error) {
      console.error('Error uploading model:', error);
      const message = error.response?.data?.error || 'Failed to upload model';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: false
  });

  const handleDelete = async (modelId) => {
    if (!window.confirm('Are you sure you want to delete this model?')) {
      return;
    }

    try {
      const token = getAuthToken();
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/models/${modelId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      toast.success('Model deleted successfully!');
      fetchModels();
    } catch (error) {
      console.error('Error deleting model:', error);
      const message = error.response?.data?.error || 'Failed to delete model';
      toast.error(message);
    }
  };

  const handleGenerateModel = async () => {
    if (!generationPrompt.trim()) {
      toast.error('Please enter a prompt for model generation');
      return;
    }

    setGenerating(true);
    try {
      const token = getAuthToken();
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/models/generate`, {
        prompt: generationPrompt,
        width: 1024,
        height: 1024
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      toast.success('Model generation started!');
      setGenerationPrompt('');
      // After a short delay, refresh the models to show the pending generation
      setTimeout(() => fetchModels(), 2000);
    } catch (error) {
      console.error('Error generating model:', error);
      const message = error.response?.data?.error || 'Failed to generate model';
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const getStatusIcon = (model) => {
    // Check for any model type
    // Prioritize status field over url field
    if (model.status === 'pending') {
      return <Clock className="w-5 h-5 text-blue-600" />;
    } else if (model.status === 'error') {
      return <XCircle className="w-5 h-5 text-red-600" />;
    } else if (model.status === 'completed') {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    } 
    // Check if model has imageUrl
    else if (model.imageUrl) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
    // Fallback to url field for backward compatibility
    else if (model.url === 'pending') {
      return <Clock className="w-5 h-5 text-blue-600" />;
    } else if (model.url === 'error') {
      return <XCircle className="w-5 h-5 text-red-600" />;
    } else if (model.url && model.url !== 'pending' && model.url !== 'error') {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
    return null;
  };
  
  const getStatusText = (model) => {
    // Check for any model type
    // Prioritize status field over url field
    if (model.status === 'pending') {
      return 'Processing';
    } else if (model.status === 'error') {
      return 'Failed';
    } else if (model.status === 'completed') {
      return 'Completed';
    }
    // Check if model has imageUrl
    else if (model.imageUrl) {
      return 'Completed';
    }
    // Fallback to url field for backward compatibility
    else if (model.url === 'pending') {
      return 'Processing';
    } else if (model.url === 'error') {
      return 'Failed';
    } else if (model.url && model.url !== 'pending' && model.url !== 'error') {
      return 'Completed';
    }
    return 'Pending';
  };
  
  const getStatusColor = (model) => {
    // Check for any model type
    // Prioritize status field over url field
    if (model.status === 'pending') {
      return 'bg-blue-100 text-blue-800';
    } else if (model.status === 'error') {
      return 'bg-red-100 text-red-800';
    } else if (model.status === 'completed') {
      return 'bg-green-100 text-green-800';
    }
    // Check if model has imageUrl
    else if (model.imageUrl) {
      return 'bg-green-100 text-green-800';
    }
    // Fallback to url field for backward compatibility
    else if (model.url === 'pending') {
      return 'text-blue-600 bg-blue-100';
    } else if (model.url === 'error') {
      return 'text-red-600 bg-red-100';
    } else if (model.url && model.url !== 'pending' && model.url !== 'error') {
      return 'text-green-600 bg-green-100';
    }
    return 'text-gray-600 bg-gray-100';
  };

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Model Management</h1>
        <p className="text-gray-600">
          Upload or generate model photos for virtual try-on experiences.
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Upload New Model
        </h2>
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
              <p className="text-gray-600">Uploading model...</p>
            </div>
          ) : isDragActive ? (
            <p className="text-blue-600 font-medium">
              Drop the image here...
            </p>
          ) : (
            <div>
              <p className="text-gray-600 mb-2">
                Drag & drop a model image here, or click to select
              </p>
              <p className="text-sm text-gray-500">
                Supports: JPG, PNG, WEBP (Max 50MB)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Generate Model Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Generate Model with AI
        </h2>
        <div className="flex flex-col space-y-4">
          <textarea
            value={generationPrompt}
            onChange={(e) => setGenerationPrompt(e.target.value)}
            placeholder="Enter a detailed description of the model you want to generate..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={4}
            disabled={generating}
          />
          <button
            onClick={handleGenerateModel}
            disabled={generating || !generationPrompt.trim()}
            className={`flex items-center justify-center space-x-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors ${generating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                <span>Generate Model</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Models Grid */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Your Models ({models.length})
          </h2>
        </div>

        {models.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {models.map((model) => (
              <div key={model._id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200">
                <div className="relative aspect-square group">
                  {/* Prioritize status field over url field for rendering */}
                  {((model.status === 'completed' && model.url && model.url !== 'pending' && model.url !== 'error') || model.imageUrl) ? (
                    <Image
                      src={model.imageUrl || (model.url && model.url.startsWith('http') ? model.url : `${process.env.NEXT_PUBLIC_API_URL}${model.url && model.url.startsWith('/') ? model.url : `/${model.url || ''}`}`)}
                      alt={model.metadata?.prompt || 'Model'}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      priority
                      className="object-cover"
                      onError={(e) => {
                        console.error('Image load error:', e);
                        console.log('Failed image URL:', model.url);
                        console.log('Model data:', model);
                        e.target.src = '/placeholder-model.jpg';
                      }}
                    />
                  ) : model.status === 'error' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                      <XCircle className="w-12 h-12 text-red-500" />
                      <p className="text-red-500 mt-2">Generation failed</p>
                    </div>
                  ) : model.status === 'pending' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                      <Clock className="w-12 h-12 text-blue-500" />
                      <p className="text-blue-500 mt-2">Processing...</p>
                    </div>
                  ) : 
                  /* Fallback to url field for backward compatibility */
                  (!model.status && model.url && model.url !== 'pending' && model.url !== 'error') ? (
                    <Image
                      src={model.imageUrl || (model.url && model.url.startsWith('http') ? model.url : `${process.env.NEXT_PUBLIC_API_URL}${model.url && model.url.startsWith('/') ? model.url : `/${model.url || ''}`}`)}
                      alt={model.metadata?.prompt || 'Model'}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      priority
                      className="object-cover"
                      onError={(e) => {
                        console.error('Image load error:', e);
                        e.target.src = '/placeholder-model.jpg';
                      }}
                    />
                  ) : model.url === 'error' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                      <XCircle className="w-12 h-12 text-red-500" />
                      <p className="text-red-500 mt-2">Generation failed</p>
                    </div>
                  ) : model.url === 'pending' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                      <Clock className="w-12 h-12 text-blue-500" />
                      <p className="text-blue-500 mt-2">Processing...</p>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <Clock className="w-12 h-12 text-gray-400" />
                      <p className="text-gray-500 mt-2">Processing...</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-2">
                    {/* Only show view button if model is completed and has a valid URL */}
                    {((model.status === 'completed' || (!model.status && model.url && model.url !== 'pending' && model.url !== 'error'))) && (
                      <button
                        onClick={() => setSelectedModel(model)}
                        className="bg-white text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(model._id)}
                      className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 truncate">
                      {model.type === 'uploaded' ? 'Uploaded Model' : 'Generated Model'}
                    </h3>
                    {getStatusIcon(model)}
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(model)} capitalize`}>
                      {getStatusText(model)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(model.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {/* Only show View Details button if model is completed or has a valid URL or imageUrl */}
                  {((model.status === 'completed' || model.imageUrl || (!model.status && model.url && model.url !== 'pending' && model.url !== 'error'))) && (
                    <button
                      onClick={() => setSelectedModel(model)}
                      className="w-full bg-blue-600 text-white text-sm py-2 px-3 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      View Details
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No models uploaded yet
            </h3>
            <p className="text-gray-600 mb-6">
              Upload your first model to get started with virtual try-on.
            </p>
          </div>
        )}
      </div>

      {/* Model Preview Modal */}
      {selectedModel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedModel.type === 'uploaded' ? 'Uploaded Model' : 'Generated Model'}
                </h3>
                <button
                  onClick={() => setSelectedModel(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="mb-4">
                {/* Prioritize status field over url field for rendering */}
                {((selectedModel.status === 'completed' && selectedModel.url && selectedModel.url !== 'pending' && selectedModel.url !== 'error') || selectedModel.imageUrl) ? (
                  <Image
                    src={selectedModel.imageUrl || (selectedModel.url && selectedModel.url.startsWith('http') ? selectedModel.url : `${process.env.NEXT_PUBLIC_API_URL}${selectedModel.url && selectedModel.url.startsWith('/') ? selectedModel.url : `/${selectedModel.url || ''}`}`)}
                    alt={selectedModel.metadata?.prompt || 'Model'}
                    width={500}
                    height={500}
                    sizes="(max-width: 768px) 100vw, 500px"
                    priority
                    className="w-full h-auto rounded-lg"
                    onError={(e) => {
                      console.error('Image load error in modal:', e);
                      console.log('Failed image URL in modal:', selectedModel.url);
                      console.log('Model data in modal:', selectedModel);
                      e.target.src = '/placeholder-model.jpg';
                    }}
                  />
                ) : selectedModel.status === 'error' ? (
                  <div className="w-full h-64 flex flex-col items-center justify-center bg-gray-100 rounded-lg">
                    <XCircle className="w-12 h-12 text-red-500" />
                    <p className="text-red-500 mt-2">Generation failed</p>
                  </div>
                ) : selectedModel.status === 'pending' ? (
                  <div className="w-full h-64 flex flex-col items-center justify-center bg-gray-100 rounded-lg">
                    <Clock className="w-12 h-12 text-blue-500" />
                    <p className="text-blue-500 mt-2">Processing...</p>
                  </div>
                ) : 
                /* Fallback to url field for backward compatibility */
                (!selectedModel.status && selectedModel.url && selectedModel.url !== 'pending' && selectedModel.url !== 'error') ? (
                   <Image
                     src={selectedModel.imageUrl || (selectedModel.url && selectedModel.url.startsWith('http') ? selectedModel.url : `${process.env.NEXT_PUBLIC_API_URL}${selectedModel.url && selectedModel.url.startsWith('/') ? selectedModel.url : `/${selectedModel.url || ''}`}`)}
                    alt={selectedModel.metadata?.prompt || 'Model'}
                    width={500}
                    height={500}
                    sizes="(max-width: 768px) 100vw, 500px"
                    priority
                    className="w-full h-auto rounded-lg"
                    onError={(e) => {
                      console.error('Image load error:', e);
                      e.target.src = '/placeholder-model.jpg';
                    }}
                  />
                ) : selectedModel.url === 'error' ? (
                  <div className="w-full h-64 flex flex-col items-center justify-center bg-gray-100 rounded-lg">
                    <XCircle className="w-12 h-12 text-red-500" />
                    <p className="text-red-500 mt-2">Generation failed</p>
                  </div>
                ) : selectedModel.url === 'pending' ? (
                  <div className="w-full h-64 flex flex-col items-center justify-center bg-gray-100 rounded-lg">
                    <Clock className="w-12 h-12 text-blue-500" />
                    <p className="text-blue-500 mt-2">Processing...</p>
                  </div>
                ) : (
                  <div className="w-full h-64 flex flex-col items-center justify-center bg-gray-100 rounded-lg">
                    <Clock className="w-12 h-12 text-gray-400" />
                    <p className="text-gray-500 mt-2">Processing...</p>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedModel)} capitalize`}>
                    {getStatusText(selectedModel)}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Type:</span>
                  <span className="ml-2 text-gray-600 capitalize">
                    {selectedModel.type}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Created:</span>
                  <span className="ml-2 text-gray-600">
                    {new Date(selectedModel.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {selectedModel.metadata?.width && selectedModel.metadata?.height && (
                  <div>
                    <span className="font-medium text-gray-700">Dimensions:</span>
                    <span className="ml-2 text-gray-600">
                      {selectedModel.metadata.width} x {selectedModel.metadata.height}
                    </span>
                  </div>
                )}
                {selectedModel.metadata?.format && (
                  <div>
                    <span className="font-medium text-gray-700">Format:</span>
                    <span className="ml-2 text-gray-600 uppercase">
                      {selectedModel.metadata.format}
                    </span>
                  </div>
                )}
              </div>
              
              {selectedModel.metadata?.prompt && (
                <div className="mt-4">
                  <span className="font-medium text-gray-700">Generation Prompt:</span>
                  <p className="mt-1 text-gray-600 bg-gray-50 p-3 rounded-lg text-sm">
                    {selectedModel.metadata.prompt}
                  </p>
                </div>
              )}
              
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    handleDelete(selectedModel._id);
                    setSelectedModel(null);
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                >
                  Delete Model
                </button>
                <button
                  onClick={() => setSelectedModel(null)}
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

export default ModelManagement;