'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Upload, User, Trash2, Eye, CheckCircle, XCircle, Clock, Plus, Maximize2, Minimize2, X, Shirt } from 'lucide-react';
import Image from 'next/image';
import { getAuthToken } from '../../lib/cookieUtils';

const ModelManagement = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [fullScreenMode, setFullScreenMode] = useState(false);
  const [clothImage, setClothImage] = useState(null);
  const [clothImagePreview, setClothImagePreview] = useState(null);
  const [isIndianModel, setIsIndianModel] = useState(true);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      
      if (!token) {
        console.error('Authentication token not found');
        toast.error('Authentication error: Please log in again');
        setModels([]);
        return;
      }
      
      // Check if API URL is configured
      if (!process.env.NEXT_PUBLIC_API_URL) {
        console.error('API URL not configured');
        toast.error('Configuration error: API URL not set');
        setModels([]);
        return;
      }
      
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
          toast.warning('Received unexpected data format from server');
          setModels([]);
        }
      } catch (axiosError) {
        console.error('Axios error details:', axiosError);
        
        // Handle different types of errors
        if (axiosError.code === 'ERR_NETWORK') {
          toast.error('Network error: Cannot connect to backend server. Please ensure the backend is running.');
        } else if (axiosError.response) {
          // The request was made and the server responded with a status code outside of 2xx range
          if (axiosError.response.status === 401) {
            toast.error('Authentication error: Please log in again');
          } else if (axiosError.response.status === 403) {
            toast.error('Permission denied: You do not have access to these models');
          } else {
            toast.error(`Server error (${axiosError.response.status}): ${axiosError.response.data?.message || 'Unknown error'}`);
          }
        } else if (axiosError.request) {
          // The request was made but no response was received
          toast.error('No response from server. Please check your connection.');
        } else {
          // Something happened in setting up the request
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

  const handleClothImageUpload = (file) => {
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Create a preview URL for the selected image
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result;
      console.log('Cloth image converted to base64, length:', base64Data.length);
      setClothImagePreview(base64Data);
      setClothImage(file);
      toast.success('Clothing image selected for model generation');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateModel = async () => {
    if (!generationPrompt.trim()) {
      toast.error('Please enter a prompt for model generation');
      return;
    }

    // Enhance prompt for better garment application if not already specified
    let enhancedPrompt = generationPrompt;
    
    // Add Indian model reference if selected and not already specified
    if (isIndianModel && !enhancedPrompt.toLowerCase().includes('indian') && !enhancedPrompt.toLowerCase().includes('india')) {
      enhancedPrompt = `Indian ${enhancedPrompt}`;
      console.log(`Added Indian reference to prompt: "${enhancedPrompt}"`);
    }
    
    // Add garment wearing reference if not already specified
    if (clothImage && !enhancedPrompt.toLowerCase().includes('wearing') && !enhancedPrompt.toLowerCase().includes('dress')) {
      enhancedPrompt = `${enhancedPrompt}, wearing the provided garment`;
      console.log(`Added garment reference to prompt: "${enhancedPrompt}"`);
    }
    
    console.log(`Final enhanced prompt: "${enhancedPrompt}"`);

    setGenerating(true);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append('prompt', enhancedPrompt);
      formData.append('width', 1024);
      formData.append('height', 1024);
      formData.append('indian_model', isIndianModel);
      
      // If cloth image is selected, append it to the form data
      if (clothImage) {
        console.log('Appending cloth image to form data:', clothImage.name);
        formData.append('clothImage', clothImage, clothImage.name);
        
        // Also send the base64 data as a fallback
        if (clothImagePreview) {
          console.log('Also sending cloth image as base64 data, length:', clothImagePreview.length);
          formData.append('clothImageBase64', clothImagePreview);
        }
        
        // Show toast notification for garment application
        toast.info('Applying selected garment to the model...');
      } else if (clothImagePreview) {
        // If we only have the base64 preview (e.g., from a previous selection)
        console.log('Sending only base64 cloth image data, length:', clothImagePreview.length);
        formData.append('clothImageBase64', clothImagePreview);
        
        // Show toast notification for garment application
        toast.info('Applying selected garment to the model...');
      }
      
      // Log the cloth image base64 length for debugging
      if (clothImagePreview) {
        console.log('Cloth image base64 length:', clothImagePreview.length);
      }

      console.log('Sending model generation request with form data');
      
      // Log the form data contents for debugging
      for (let pair of formData.entries()) {
        if (pair[0] === 'clothImageBase64') {
          console.log(pair[0], 'base64_data_present');
        } else {
          console.log(pair[0], pair[1]);
        }
      }
      
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/models/generate`, 
        formData, 
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      console.log('Model generation response:', response.data);

      toast.success('Model generation started!');
      setGenerationPrompt('');
      setClothImage(null);
      setClothImagePreview(null);
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
            <div className="relative">
              <textarea
                value={generationPrompt}
                onChange={(e) => setGenerationPrompt(e.target.value)}
                placeholder="Enter a detailed description of the model you want to generate..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                disabled={generating}
              />
              <div className="mt-2 flex items-center">
                <input
                  type="checkbox"
                  id="isIndianModel"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={isIndianModel}
                  onChange={(e) => setIsIndianModel(e.target.checked)}
                  disabled={generating}
                />
                <label htmlFor="isIndianModel" className="ml-2 block text-sm text-gray-700">
                  Generate Indian model (automatically enhances prompt for Indian ethnicity)
                </label>
              </div>
            <div className="absolute bottom-3 right-3 flex items-center space-x-2">
              {clothImagePreview && (
                <div className="relative">
                  <div className="w-10 h-10 rounded-md overflow-hidden border border-gray-300">
                    <img src={clothImagePreview} alt="Cloth preview" className="w-full h-full object-cover" />
                  </div>
                  <button 
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center hover:bg-red-600 transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      setClothImage(null);
                      setClothImagePreview(null);
                      toast.info('Clothing image removed');
                    }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <label htmlFor="clothImageUpload" className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-full flex items-center justify-center transition-colors" title="Upload clothing image to apply on model">
                <Shirt className="w-5 h-5" />
                <input 
                  id="clothImageUpload" 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handleClothImageUpload(file);
                    }
                  }}
                />
              </label>
            </div>
          </div>
          <div className="flex flex-col space-y-2">
            {clothImage && (
              <div className="text-sm text-green-600 flex items-center">
                <CheckCircle className="w-4 h-4 mr-1" />
                <span>Custom clothing will be applied to the generated model</span>
              </div>
            )}
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
                    <>
                      {(() => {
                        // Prepare image URL with proper error handling
                        const imageUrl = model.imageUrl || 
                          (model.url && model.url.startsWith('http') ? 
                            model.url : 
                            `${process.env.NEXT_PUBLIC_API_URL || ''}${model.url && model.url.startsWith('/') ? model.url : `/${model.url || ''}`}`);
                        
                        // Check if URL is valid before rendering
                        if (!imageUrl || imageUrl.includes('undefined') || imageUrl === '/') {
                          return (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                              <XCircle className="w-12 h-12 text-red-500" />
                              <p className="text-red-500 mt-2">Invalid image URL</p>
                            </div>
                          );
                        }
                        
                        return (
                          <Image
                            src={imageUrl}
                            alt={model.metadata?.prompt || 'Model'}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            priority
                            className="object-cover"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              console.error('Image load error:', e);
                              console.log('Failed image URL:', imageUrl);
                              console.log('Model data:', model);
                              // Use a data URI for placeholder to avoid additional network requests
                              e.target.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22300%22%20height%3D%22300%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22300%22%20height%3D%22300%22%20fill%3D%22%23f0f0f0%22%2F%3E%3Ctext%20x%3D%22150%22%20y%3D%22150%22%20font-size%3D%2220%22%20text-anchor%3D%22middle%22%20alignment-baseline%3D%22middle%22%20fill%3D%22%23999999%22%3EImage%20not%20available%3C%2Ftext%3E%3C%2Fsvg%3E';
                              toast.error(`Failed to load image`);
                            }}
                          />
                        );
                      })()} 
                    </>
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
                    <>
                      {(() => {
                        // Prepare image URL with proper error handling
                        const imageUrl = model.imageUrl || 
                          (model.url && model.url.startsWith('http') ? 
                            model.url : 
                            `${process.env.NEXT_PUBLIC_API_URL || ''}${model.url && model.url.startsWith('/') ? model.url : `/${model.url || ''}`}`);
                        
                        // Check if URL is valid before rendering
                        if (!imageUrl || imageUrl.includes('undefined') || imageUrl === '/') {
                          return (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                              <XCircle className="w-12 h-12 text-red-500" />
                              <p className="text-red-500 mt-2">Invalid image URL</p>
                            </div>
                          );
                        }
                        
                        return (
                          <Image
                            src={imageUrl}
                            alt={model.metadata?.prompt || 'Model'}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            priority
                            className="object-cover"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              console.error('Image load error:', e);
                              console.log('Failed image URL:', imageUrl);
                              console.log('Model data:', model);
                              // Use a data URI for placeholder to avoid additional network requests
                              e.target.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22300%22%20height%3D%22300%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22300%22%20height%3D%22300%22%20fill%3D%22%23f0f0f0%22%2F%3E%3Ctext%20x%3D%22150%22%20y%3D%22150%22%20font-size%3D%2220%22%20text-anchor%3D%22middle%22%20alignment-baseline%3D%22middle%22%20fill%3D%22%23999999%22%3EImage%20not%20available%3C%2Ftext%3E%3C%2Fsvg%3E';
                              toast.error(`Failed to load image`);
                            }}
                          />
                        );
                      })()} 
                    </>
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
                      <>
                        <button
                          onClick={() => {
                            setSelectedModel(model);
                            setFullScreenMode(true);
                          }}
                          className="bg-white text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                          title="View full screen"
                        >
                          <Maximize2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setSelectedModel(model)}
                          className="bg-white text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                          title="View details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </>
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
      {selectedModel && !fullScreenMode && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[95vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedModel.type === 'uploaded' ? 'Uploaded Model' : 'Generated Model'}
                </h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setFullScreenMode(true)}
                    className="text-gray-400 hover:text-gray-600"
                    title="View in full screen"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedModel(null)}
                    className="text-gray-400 hover:text-gray-600"
                    title="Close"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                {/* Prioritize status field over url field for rendering */}
                {((selectedModel.status === 'completed' && selectedModel.url && selectedModel.url !== 'pending' && selectedModel.url !== 'error') || selectedModel.imageUrl) ? (
                  <div className="relative">
                    <Image
                      src={selectedModel.imageUrl || (selectedModel.url && selectedModel.url.startsWith('http') ? selectedModel.url : `${process.env.NEXT_PUBLIC_API_URL}${selectedModel.url && selectedModel.url.startsWith('/') ? selectedModel.url : `/${selectedModel.url || ''}`}`)}
                      alt={selectedModel.metadata?.prompt || 'Model'}
                      width={800}
                      height={800}
                      sizes="(max-width: 768px) 100vw, 800px"
                      priority
                      className="w-full h-auto rounded-lg object-contain"
                      onError={(e) => {
                        console.error('Image load error in modal:', e);
                        console.log('Failed image URL in modal:', selectedModel.url);
                        console.log('Model data in modal:', selectedModel);
                        e.target.src = '/placeholder-model.jpg';
                      }}
                    />
                  </div>
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
                  <div className="relative">
                    <Image
                      src={selectedModel.imageUrl || (selectedModel.url && selectedModel.url.startsWith('http') ? selectedModel.url : `${process.env.NEXT_PUBLIC_API_URL}${selectedModel.url && selectedModel.url.startsWith('/') ? selectedModel.url : `/${selectedModel.url || ''}`}`)}                      alt={selectedModel.metadata?.prompt || 'Model'}
                      width={800}
                      height={800}
                      sizes="(max-width: 768px) 100vw, 800px"
                      priority
                      className="w-full h-auto rounded-lg object-contain"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        console.error('Image load error:', e);
                        e.target.src = '/placeholder-model.jpg';
                      }}
                    />
                  </div>
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

      {/* Full Screen Image Modal */}
      {selectedModel && fullScreenMode && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex justify-between items-center p-4 bg-black bg-opacity-75">
            <h3 className="text-xl font-semibold text-white">
              {selectedModel.type === 'uploaded' ? 'Uploaded Model' : 'Generated Model'}
            </h3>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setFullScreenMode(false)}
                className="text-white hover:text-gray-300"
                title="Exit full screen"
              >
                <Minimize2 className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setFullScreenMode(false);
                  setSelectedModel(null);
                }}
                className="text-white hover:text-gray-300"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            {((selectedModel.status === 'completed' && selectedModel.url && selectedModel.url !== 'pending' && selectedModel.url !== 'error') || selectedModel.imageUrl) ? (
              <div className="relative max-h-full max-w-full">
                <Image
                  src={selectedModel.imageUrl || (selectedModel.url && selectedModel.url.startsWith('http') ? selectedModel.url : `${process.env.NEXT_PUBLIC_API_URL}${selectedModel.url && selectedModel.url.startsWith('/') ? selectedModel.url : `/${selectedModel.url || ''}`}`)}                  alt={selectedModel.metadata?.prompt || 'Model'}
                  width={1200}
                  height={1200}
                  sizes="100vw"
                  priority
                  className="max-h-[90vh] w-auto h-auto object-contain"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    console.error('Image load error in fullscreen:', e);
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNFNUU3RUIiLz48cGF0aCBkPSJNMTAwIDcwQzEwMCA4NS40NjcgODguMzY3IDk4IDc0IDk4QzU5LjYzMyA5OCA0OCA4NS40NjcgNDggNzBDNDggNTQuNTMzIDU5LjYzMyA0MiA3NCA0MkM4OC4zNjcgNDIgMTAwIDU0LjUzMyAxMDAgNzBaIiBmaWxsPSIjOTRBM0IzIi8+PHBhdGggZD0iTTE3MyAxNjhIMjdWNzBIMzlDMzkgOTcuNjE0IDYxLjM4NiAxMjAgODkgMTIwQzExNi42MTQgMTIwIDEzOSA5Ny42MTQgMTM5IDcwSDE3M1YxNjhaIiBmaWxsPSIjOTRBM0IzIi8+PC9zdmc+Cg==';
                    toast.error('Failed to load image in fullscreen mode');
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-64 flex flex-col items-center justify-center">
                <XCircle className="w-16 h-16 text-red-500" />
                <p className="text-white text-xl mt-4">Image not available</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelManagement;