'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Upload, Image as ImageIcon, Trash2, Eye, XCircle, PlusCircle, Clock, CheckCircle, Maximize2, Minimize2, X } from 'lucide-react';
import Image from 'next/image';
import { getAuthToken } from '../../lib/cookieUtils';

// Helper functions for scene status display
const getStatusIcon = (scene) => {
  // Check for any scene type
  // Prioritize status field over url field
  if (scene.status === 'pending') {
    return <Clock className="w-5 h-5 text-blue-600" />;
  } else if (scene.status === 'error') {
    return <XCircle className="w-5 h-5 text-red-600" />;
  } else if (scene.status === 'completed') {
    return <CheckCircle className="w-5 h-5 text-green-600" />;
  } 
  // Check if scene has imageUrl
  else if (scene.url) {
    return <CheckCircle className="w-5 h-5 text-green-600" />;
  }
  return <Clock className="w-5 h-5 text-blue-600" />;
};

const getStatusText = (scene) => {
  // Check for any scene type
  // Prioritize status field over url field
  if (scene.status === 'pending') {
    return 'प्रोसेसिंग';
  } else if (scene.status === 'error') {
    return 'विफल';
  } else if (scene.status === 'completed') {
    return 'पूर्ण';
  }
  // Check if scene has url
  else if (scene.url) {
    return 'पूर्ण';
  }
  return 'प्रोसेसिंग';
};

const getStatusColor = (scene) => {
  // Check for any scene type
  // Prioritize status field over url field
  if (scene.status === 'pending') {
    return 'bg-blue-100 text-blue-800';
  } else if (scene.status === 'error') {
    return 'bg-red-100 text-red-800';
  } else if (scene.status === 'completed') {
    return 'bg-green-100 text-green-800';
  }
  // Check if scene has url
  else if (scene.url) {
    return 'bg-green-100 text-green-800';
  }
  return 'text-gray-600 bg-gray-100';
};

const SceneManagement = () => {
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedScene, setSelectedScene] = useState(null);
  const [domain, setDomain] = useState('fashion');
  const [sceneName, setSceneName] = useState('');
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [showGenerationForm, setShowGenerationForm] = useState(false);
  const [fullScreenMode, setFullScreenMode] = useState(false);

  useEffect(() => {
    fetchScenes();
  }, []);

  const fetchScenes = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      
      if (!token) {
        console.error('Authentication token not found');
        toast.error('प्रमाणीकरण त्रुटि: कृपया फिर से लॉग इन करें');
        setScenes([]);
        return;
      }
      
      // Check if API URL is configured
      if (!process.env.NEXT_PUBLIC_API_URL) {
        console.error('API URL not configured');
        toast.error('कॉन्फ़िगरेशन त्रुटि: API URL सेट नहीं है');
        setScenes([]);
        return;
      }
      
      // Use a try-catch block to handle potential network errors
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/scenes`, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          // Add timeout to prevent hanging requests
          timeout: parseInt(process.env.NEXT_PUBLIC_TIMEOUT || '10000')
        });
        console.log('Scenes response:', response.data);
        
        if (response.data && response.data.data) {
          // Check if scenes is an array
          if (Array.isArray(response.data.data.scenes)) {
            console.log('Setting scenes from response.data.data.scenes:', response.data.data.scenes);
            setScenes(response.data.data.scenes);
          } else {
            // If scenes is directly in data
            console.log('Setting scenes from response.data.data:', response.data.data);
            setScenes(response.data.data || []);
          }
        } else {
          console.error('Invalid response format:', response.data);
          toast.warning('सर्वर से अप्रत्याशित डेटा प्रारूप प्राप्त हुआ');
          setScenes([]);
        }
      } catch (axiosError) {
        console.error('Axios error details:', axiosError);
        
        // Handle different types of errors
        if (axiosError.code === 'ERR_NETWORK') {
          toast.error('नेटवर्क त्रुटि: बैकएंड सर्वर से कनेक्ट नहीं हो सका। कृपया सुनिश्चित करें कि बैकएंड चल रहा है।');
        } else if (axiosError.response) {
          // The request was made and the server responded with a status code outside of 2xx range
          if (axiosError.response.status === 401) {
            toast.error('प्रमाणीकरण त्रुटि: कृपया फिर से लॉग इन करें');
          } else if (axiosError.response.status === 403) {
            toast.error('अनुमति अस्वीकृत: आपके पास इन सीन्स तक पहुंच नहीं है');
          } else {
            toast.error(`सर्वर त्रुटि (${axiosError.response.status}): ${axiosError.response.data?.message || 'अज्ञात त्रुटि'}`);
          }
        } else if (axiosError.request) {
          // The request was made but no response was received
          toast.error('सर्वर से कोई प्रतिक्रिया नहीं मिली। कृपया अपना कनेक्शन जांचें।');
        } else {
          // Something happened in setting up the request
          toast.error(`सीन्स प्राप्त करने में विफल: ${axiosError.message}`);
        }
      }
    } catch (error) {
      console.error('Error in fetchScenes:', error);
      toast.error('सीन्स प्राप्त करने में विफल');
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

    if (!sceneName.trim()) {
      toast.error('Please enter a name for the scene');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('scene', file);
    formData.append('name', sceneName);
    formData.append('domain', domain);
    formData.append('type', 'uploaded');

    try {
      const token = getAuthToken();
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/scenes/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        timeout: parseInt(process.env.NEXT_PUBLIC_TIMEOUT || '10000')
      });
      
      toast.success('Scene uploaded successfully!');
      setSceneName('');
      fetchScenes(); // Refresh the list
    } catch (error) {
      console.error('Error uploading scene:', error);
      const message = error.response?.data?.error || 'Failed to upload scene';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }, [sceneName, domain]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: false
  });

  const handleGenerateScene = async (e) => {
    e.preventDefault();
    
    if (!sceneName.trim()) {
      toast.error('Please enter a name for the scene');
      return;
    }

    if (!generationPrompt.trim()) {
      toast.error('Please enter a prompt for scene generation');
      return;
    }

    setGenerating(true);
    try {
      const token = getAuthToken();
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/scenes/generate`, {
        name: sceneName,
        domain,
        prompt: generationPrompt
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: parseInt(process.env.NEXT_PUBLIC_TIMEOUT || '10000')
      });
      
      toast.success('Scene generation started! This may take a few minutes.');
      setSceneName('');
      setGenerationPrompt('');
      setShowGenerationForm(false);
      
      // Wait a moment before refreshing to allow backend processing
      setTimeout(() => {
        fetchScenes();
      }, 3000);
    } catch (error) {
      console.error('Error generating scene:', error);
      const message = error.response?.data?.error || 'Failed to generate scene';
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (sceneId) => {
    if (!window.confirm('Are you sure you want to delete this scene?')) {
      return;
    }

    try {
      const token = getAuthToken();
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/scenes/${sceneId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        timeout: parseInt(process.env.NEXT_PUBLIC_TIMEOUT || '10000')
      });
      toast.success('Scene deleted successfully!');
      fetchScenes();
    } catch (error) {
      console.error('Error deleting scene:', error);
      const message = error.response?.data?.error || 'Failed to delete scene';
      toast.error(message);
    }
  };

  const domainOptions = [
    { value: 'fashion', label: 'Fashion' },
    { value: 'interior', label: 'Interior' },
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Scene Management</h1>
        <p className="text-gray-600">
          Upload or generate background scenes for your virtual try-on experience.
        </p>
      </div>

      {/* Upload/Generate Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {showGenerationForm ? 'Generate New Scene' : 'Upload New Scene'}
          </h2>
          <button
            onClick={() => setShowGenerationForm(!showGenerationForm)}
            className="text-blue-600 hover:text-blue-800 flex items-center"
          >
            {showGenerationForm ? 'Switch to Upload' : 'Switch to Generate'}
          </button>
        </div>

        {showGenerationForm ? (
          <form onSubmit={handleGenerateScene}>
            <div className="mb-4">
              <label htmlFor="sceneName" className="block text-sm font-medium text-gray-700 mb-1">
                Scene Name
              </label>
              <input
                type="text"
                id="sceneName"
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter scene name"
                disabled={generating}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
                Domain
              </label>
              <select
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={generating}
              >
                {domainOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label htmlFor="generationPrompt" className="block text-sm font-medium text-gray-700 mb-1">
                Generation Prompt
              </label>
              <textarea
                id="generationPrompt"
                value={generationPrompt}
                onChange={(e) => setGenerationPrompt(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
                placeholder="Describe the scene you want to generate..."
                disabled={generating}
              />
            </div>

            <button
              type="submit"
              className={`w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center ${generating ? 'opacity-70 cursor-not-allowed' : ''}`}
              disabled={generating}
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Generating Scene...
                </>
              ) : (
                <>
                  <PlusCircle className="w-5 h-5 mr-2" />
                  Generate Scene
                </>
              )}
            </button>
          </form>
        ) : (
          <>
            <div className="mb-4">
              <label htmlFor="sceneName" className="block text-sm font-medium text-gray-700 mb-1">
                Scene Name
              </label>
              <input
                type="text"
                id="sceneName"
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter scene name"
                disabled={uploading}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
                Domain
              </label>
              <select
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={uploading}
              >
                {domainOptions.map((option) => (
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
                  <p className="text-gray-600">Uploading scene...</p>
                </div>
              ) : isDragActive ? (
                <p className="text-blue-600 font-medium">
                  Drop the image here...
                </p>
              ) : (
                <div>
                  <p className="text-gray-600 mb-2">
                    Drag & drop a scene image here, or click to select
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports: JPG, PNG, WEBP (Max 50MB)
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      

      {/* Scenes Grid */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Your Scenes ({scenes.length})
          </h2>
        </div>

        {scenes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {scenes.map((scene) => (
              <div key={scene._id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200">
                <div className="relative aspect-square group">
                  {scene.url ? (
                    <>
                      {(() => {
                        // Prepare image URL with proper error handling
                        let imageUrl;
                        try {
                          if (scene.url && scene.url.startsWith('http')) {
                            imageUrl = scene.url;
                          } else if (scene.url) {
                            // Ensure we have a valid API URL
                            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
                            // Normalize the path
                            const normalizedPath = scene.url.startsWith('/') ? scene.url : `/${scene.url}`;
                            imageUrl = `${apiUrl}${normalizedPath}`;
                          }
                        } catch (error) {
                          console.error('Error creating image URL:', error);
                          imageUrl = null;
                        }
                        
                        // Check if URL is valid before rendering
                        if (!imageUrl || imageUrl.includes('undefined') || imageUrl === '/' || imageUrl === '/undefined') {
                          return (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                              <XCircle className="w-12 h-12 text-red-500" />
                              <p className="text-red-500 mt-2">अमान्य छवि URL</p>
                            </div>
                          );
                        }
                        
                        return (
                          <Image
                            src={imageUrl}
                            alt={scene.name || 'सीन'}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            priority
                            className="object-cover"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              console.error('Image load error:', e);
                              console.log('Failed image URL:', imageUrl);
                              console.log('Scene data:', scene);
                              // Use a data URI for placeholder to avoid additional network requests
                              e.target.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22300%22%20height%3D%22300%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22300%22%20height%3D%22300%22%20fill%3D%22%23f0f0f0%22%2F%3E%3Ctext%20x%3D%22150%22%20y%3D%22150%22%20font-size%3D%2220%22%20text-anchor%3D%22middle%22%20alignment-baseline%3D%22middle%22%20fill%3D%22%23999999%22%3Eछवि उपलब्ध नहीं%3C%2Ftext%3E%3C%2Fsvg%3E';
                              toast.error(`छवि लोड करने में विफल`);
                            }}
                          />
                        );
                      })()}
                    </>
                  ) : scene.status === 'error' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                      <XCircle className="w-12 h-12 text-red-500" />
                      <p className="text-red-500 mt-2">जनरेशन विफल</p>
                    </div>
                  ) : scene.status === 'pending' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                      <Clock className="w-12 h-12 text-blue-500" />
                      <p className="text-blue-500 mt-2">प्रोसेसिंग...</p>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <Clock className="w-12 h-12 text-gray-400" />
                      <p className="text-gray-500 mt-2">प्रोसेसिंग...</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-2">
                    <button
                      onClick={() => setSelectedScene(scene)}
                      className="bg-white text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(scene._id)}
                      className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 truncate">
                      {scene.name}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(scene)}`}>
                      {getStatusText(scene)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                      {scene.domain}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(scene.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => setSelectedScene(scene)}
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
            <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No scenes created yet
            </h3>
            <p className="text-gray-600 mb-6">
              Upload or generate your first scene to get started with virtual try-on.
            </p>
          </div>
        )}
      </div>

      {/* Scene Preview Modal */}
      {selectedScene && !fullScreenMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedScene.name}
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
                    onClick={() => setSelectedScene(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                <Image
                  src={(() => {
                    try {
                      if (selectedScene.url && selectedScene.url.startsWith('http')) {
                        return selectedScene.url;
                      } else if (selectedScene.url) {
                        // Ensure we have a valid API URL
                        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
                        // Normalize the path
                        const normalizedPath = selectedScene.url.startsWith('/') ? selectedScene.url : `/${selectedScene.url}`;
                        return `${apiUrl}${normalizedPath}`;
                      }
                      return '/placeholder-scene.jpg';
                    } catch (error) {
                      console.error('Error creating image URL:', error);
                      return '/placeholder-scene.jpg';
                    }
                  })()}
                  alt={selectedScene.name}
                  width={500}
                  height={500}
                  crossOrigin="anonymous"
                  className="w-full h-auto rounded-lg"
                  onError={(e) => {
                    console.error(`Failed to load scene image: ${selectedScene.url}`);
                    const svgImage = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" fill="%23999">Image not available</text></svg>`;
                    e.target.src = svgImage;
                    toast.error(`Failed to load scene image: ${selectedScene.name}`);
                  }}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Type:</span>
                  <span className="ml-2 text-gray-600 capitalize">
                    {selectedScene.type}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Domain:</span>
                  <span className="ml-2 text-gray-600 capitalize">
                    {selectedScene.domain}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Created:</span>
                  <span className="ml-2 text-gray-600">
                    {new Date(selectedScene.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {selectedScene.metadata?.width && selectedScene.metadata?.height && (
                  <div>
                    <span className="font-medium text-gray-700">Dimensions:</span>
                    <span className="ml-2 text-gray-600">
                      {selectedScene.metadata.width} x {selectedScene.metadata.height}
                    </span>
                  </div>
                )}
                {selectedScene.metadata?.format && (
                  <div>
                    <span className="font-medium text-gray-700">Format:</span>
                    <span className="ml-2 text-gray-600 uppercase">
                      {selectedScene.metadata.format}
                    </span>
                  </div>
                )}
              </div>
              
              {selectedScene.type === 'generated' && selectedScene.metadata?.prompt && (
                <div className="mt-4">
                  <span className="font-medium text-gray-700 block mb-1">Generation Prompt:</span>
                  <p className="text-gray-600 bg-gray-50 p-3 rounded-md">
                    {selectedScene.metadata.prompt}
                  </p>
                </div>
              )}
              
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    handleDelete(selectedScene._id);
                    setSelectedScene(null);
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                >
                  Delete Scene
                </button>
                <button
                  onClick={() => setSelectedScene(null)}
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
      {selectedScene && fullScreenMode && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex justify-between items-center p-4 bg-black bg-opacity-75">
            <h3 className="text-xl font-semibold text-white">
              {selectedScene.name}
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
                  setSelectedScene(null);
                }}
                className="text-white hover:text-gray-300"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            {selectedScene.url ? (
              <div className="relative max-h-full max-w-full">
                <Image
                  src={selectedScene.url && selectedScene.url.startsWith('http') ? selectedScene.url : `${process.env.NEXT_PUBLIC_API_URL}${selectedScene.url && selectedScene.url.startsWith('/') ? selectedScene.url : `/${selectedScene.url || ''}`}`}
                  alt={selectedScene.name}
                  width={1200}
                  height={1200}
                  sizes="100vw"
                  priority
                  className="max-h-[90vh] w-auto h-auto object-contain"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    console.error('Image load error in fullscreen:', e);
                    const svgImage = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" fill="%23999">Image not available</text></svg>`;
                    e.target.src = svgImage;
                    toast.error(`Failed to load scene image: ${selectedScene.name}`);
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

export default SceneManagement;