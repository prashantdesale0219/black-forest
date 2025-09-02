'use client';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Shirt, User, Image as ImageIcon, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { getAuthToken } from '../../lib/cookieUtils';

const TryOnInterface = () => {
  const [models, setModels] = useState([]);
  const [garments, setGarments] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedGarment, setSelectedGarment] = useState(null);
  const [selectedScene, setSelectedScene] = useState(null);
  const [tryOnJobs, setTryOnJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [pollingInterval, setPollingInterval] = useState(null);

  useEffect(() => {
    fetchData();
    fetchTryOnJobs();

    // Setup polling for job status updates
    const interval = setInterval(() => {
      fetchTryOnJobs();
    }, 10000); // Poll every 10 seconds

    setPollingInterval(interval);

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const headers = {
        Authorization: `Bearer ${token}`
      };

      // Fetch models, garments, and scenes in parallel
      const [modelsRes, garmentsRes, scenesRes] = await Promise.all([
        axios.get('/api/models', { headers }),
        axios.get('/api/garments', { headers }),
        axios.get('/api/scenes', { headers })
      ]);

      setModels(modelsRes.data.data?.models || []);
      setGarments(garmentsRes.data.data?.garments || []);
      setScenes(scenesRes.data.data?.scenes || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data for try-on');
    } finally {
      setLoading(false);
    }
  };

  const fetchTryOnJobs = async () => {
    try {
      const token = getAuthToken();
      const response = await axios.get('/api/tryon', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setTryOnJobs(response.data.data?.jobs || []);
    } catch (error) {
      console.error('Error fetching try-on jobs:', error);
      // Don't show toast for background polling
    }
  };

  const handleSubmitTryOn = async () => {
    if (!selectedModel) {
      toast.error('Please select a model');
      return;
    }

    if (!selectedGarment) {
      toast.error('Please select a garment');
      return;
    }

    setSubmitting(true);
    try {
      const token = getAuthToken();
      const payload = {
        modelId: selectedModel._id,
        garmentId: selectedGarment._id,
        prompt: customPrompt.trim() || undefined
      };

      // Add scene if selected
      if (selectedScene) {
        payload.sceneId = selectedScene._id;
      }

      await axios.post('/api/tryon', payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      toast.success('Try-on job submitted successfully!');
      fetchTryOnJobs(); // Refresh the jobs list
    } catch (error) {
      console.error('Error submitting try-on job:', error);
      const message = error.response?.data?.error || 'Failed to submit try-on job';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="w-4 h-4" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Virtual Try-On</h1>
        <p className="text-gray-600">
          Try on garments with your models in different scenes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Model Selection */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-600" />
            Select Model
          </h2>
          
          {models.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
              {models.map((model) => (
                <div 
                  key={model._id} 
                  className={`border rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                    selectedModel?._id === model._id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedModel(model)}
                >
                  <div className="relative aspect-square">
                    <Image
                      src={model.url}
                      alt={`Model ${model._id}`}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        e.target.src = '/placeholder-model.jpg';
                      }}
                    />
                  </div>
                  <div className="p-2 text-center">
                    <span className="text-xs font-medium bg-gray-100 text-gray-800 px-2 py-1 rounded-full capitalize">
                      {model.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">No models available</p>
              <button
                onClick={() => window.location.href = '/app/models'}
                className="bg-blue-600 text-white text-sm py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Model
              </button>
            </div>
          )}
        </div>

        {/* Garment Selection */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Shirt className="w-5 h-5 mr-2 text-blue-600" />
            Select Garment
          </h2>
          
          {garments.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
              {garments.map((garment) => (
                <div 
                  key={garment._id} 
                  className={`border rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                    selectedGarment?._id === garment._id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedGarment(garment)}
                >
                  <div className="relative aspect-square">
                    <Image
                      src={garment.url}
                      alt={garment.name}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        e.target.src = '/placeholder-garment.jpg';
                      }}
                    />
                  </div>
                  <div className="p-2 text-center">
                    <span className="text-xs font-medium bg-gray-100 text-gray-800 px-2 py-1 rounded-full capitalize">
                      {garment.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <Shirt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">No garments available</p>
              <button
                onClick={() => window.location.href = '/app/garments'}
                className="bg-blue-600 text-white text-sm py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Upload Garment
              </button>
            </div>
          )}
        </div>

        {/* Scene Selection (Optional) */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <ImageIcon className="w-5 h-5 mr-2 text-blue-600" />
            Select Scene (Optional)
          </h2>
          
          {scenes.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
              {scenes.map((scene) => (
                <div 
                  key={scene._id} 
                  className={`border rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                    selectedScene?._id === scene._id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedScene(scene)}
                >
                  <div className="relative aspect-square">
                    <Image
                      src={scene.url}
                      alt={scene.name}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        e.target.src = '/placeholder-scene.jpg';
                      }}
                    />
                  </div>
                  <div className="p-2 text-center">
                    <span className="text-xs font-medium bg-gray-100 text-gray-800 px-2 py-1 rounded-full capitalize">
                      {scene.domain}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">No scenes available</p>
              <button
                onClick={() => window.location.href = '/app/scenes'}
                className="bg-blue-600 text-white text-sm py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Scene
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Custom Prompt and Submit */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Try-On Settings
        </h2>
        
        <div className="mb-4">
          <label htmlFor="customPrompt" className="block text-sm font-medium text-gray-700 mb-1">
            Custom Prompt (Optional)
          </label>
          <textarea
            id="customPrompt"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
            placeholder="Add any specific instructions for the try-on process..."
            disabled={submitting}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            {selectedModel && selectedGarment && (
              <p className="text-sm text-gray-600">
                Trying <span className="font-medium">{selectedGarment.name || 'selected garment'}</span> on 
                {selectedModel.name ? <span className="font-medium"> {selectedModel.name}</span> : ' your model'}
                {selectedScene ? <span> with <span className="font-medium">{selectedScene.name}</span> background</span> : ''}
              </p>
            )}
          </div>
          <button
            onClick={handleSubmitTryOn}
            disabled={!selectedModel || !selectedGarment || submitting}
            className={`bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 transition-colors flex items-center ${
              (!selectedModel || !selectedGarment || submitting) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              'Start Try-On'
            )}
          </button>
        </div>
      </div>

      {/* Try-On Results */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Try-On Results
        </h2>

        {tryOnJobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tryOnJobs.map((job) => (
              <div key={job._id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative aspect-square bg-gray-100">
                  {job.status === 'completed' && job.resultUrl ? (
                    <Image
                      src={job.resultUrl}
                      alt="Try-on result"
                      fill
                      className="object-cover"
                      onError={(e) => {
                        e.target.src = '/placeholder-result.jpg';
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      {job.status === 'processing' ? (
                        <div className="flex flex-col items-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-3"></div>
                          <p className="text-gray-600">Processing try-on...</p>
                        </div>
                      ) : job.status === 'failed' ? (
                        <div className="flex flex-col items-center text-red-600">
                          <XCircle className="w-12 h-12 mb-3" />
                          <p>Try-on failed</p>
                          {job.errorMessage && (
                            <p className="text-xs text-center mt-2 max-w-[200px] truncate" title={job.errorMessage}>
                              {job.errorMessage}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <AlertCircle className="w-12 h-12 text-yellow-500 mb-3" />
                          <p className="text-gray-600">Pending</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center ${getStatusColor(job.status)}`}>
                      {getStatusIcon(job.status)}
                      <span className="ml-1 capitalize">{job.status}</span>
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {job.status === 'completed' && job.resultUrl && (
                    <a
                      href={job.resultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-blue-600 text-white text-sm py-2 px-3 rounded-md hover:bg-blue-700 transition-colors block text-center"
                    >
                      View Full Result
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-gray-100">
              <Shirt className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No try-on jobs yet
            </h3>
            <p className="text-gray-600">
              Select a model and garment above to start your first virtual try-on.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TryOnInterface;