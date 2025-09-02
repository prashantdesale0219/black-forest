'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Upload, Image as ImageIcon, Trash2, Eye, XCircle, PlusCircle } from 'lucide-react';
import Image from 'next/image';
import { getAuthToken } from '../../lib/cookieUtils';

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

  useEffect(() => {
    fetchScenes();
  }, []);

  const fetchScenes = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await axios.get('/api/scenes', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setScenes(response.data.data?.scenes || []);
    } catch (error) {
      console.error('Error fetching scenes:', error);
      toast.error('Failed to fetch scenes');
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
      await axios.post('/api/scenes/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
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
      await axios.post('/api/scenes/generate', {
        name: sceneName,
        domain,
        prompt: generationPrompt
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
      await axios.delete(`/api/scenes/${sceneId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
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
                  <Image
                    src={scene.url}
                    alt={scene.name}
                    fill
                    className="object-cover"
                    onError={(e) => {
                      e.target.src = '/placeholder-scene.jpg';
                    }}
                  />
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
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                      {scene.type}
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
      {selectedScene && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedScene.name}
                </h3>
                <button
                  onClick={() => setSelectedScene(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="mb-4">
                <Image
                  src={selectedScene.url}
                  alt={selectedScene.name}
                  width={500}
                  height={500}
                  className="w-full h-auto rounded-lg"
                  onError={(e) => {
                    e.target.src = '/placeholder-scene.jpg';
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
    </div>
  );
};

export default SceneManagement;