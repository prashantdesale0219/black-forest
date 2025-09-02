const axios = require('axios');
require('dotenv').config();

/**
 * Service for interacting with Black Forest Labs (BFL) API
 */
class BFLService {
  constructor() {
    this.apiKey = process.env.BFL_API_KEY;
    this.baseUrl = process.env.BFL_BASE_URL || 'https://api.bfl.ai/v1';
    console.log('BFL Service initialized with:', {
      apiKey: this.apiKey ? '***' + this.apiKey.substring(this.apiKey.length - 4) : 'undefined',
      baseUrl: this.baseUrl
    });
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'x-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds timeout
    });
  }

  /**
   * Generate an image using text prompt
   * @param {Object} params - Generation parameters
   * @param {string} params.prompt - Text prompt for image generation
   * @param {number} params.width - Image width (default: 1024)
   * @param {number} params.height - Image height (default: 1024)
   * @param {boolean} params.prompt_upsampling - Whether to use prompt upsampling
   * @param {number} params.seed - Random seed for reproducibility
   * @param {number} params.safety_tolerance - Safety filter level (0-3)
   * @param {string} params.output_format - Output format (jpeg, png)
   * @param {string} endpoint - BFL endpoint to use (default: flux-pro-1.1)
   * @returns {Promise<Object>} - Job ID and polling URL
   */
  async generateImage(params, endpoint = 'flux-pro-1.1') {
    try {
      const response = await this.client.post(`/${endpoint}`, params);
      return response.data;
    } catch (error) {
      console.error(`BFL Image Generation Error: ${error.message}`);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw error;
    }
  }

  /**
   * Edit an image using inpainting (for try-on)
   * @param {Object} params - Edit parameters
   * @param {string} params.image - Base64 or URL of the image
   * @param {string} params.mask - Base64 or URL of the mask
   * @param {string} params.prompt - Text prompt for editing
   * @param {number} params.steps - Number of diffusion steps
   * @param {boolean} params.prompt_upsampling - Whether to use prompt upsampling
   * @param {number} params.seed - Random seed for reproducibility
   * @param {number} params.guidance - Guidance scale
   * @param {string} params.output_format - Output format (jpeg, png)
   * @param {number} params.safety_tolerance - Safety filter level (0-3)
   * @returns {Promise<Object>} - Job ID and polling URL
   */
  async editImage(params) {
    try {
      const response = await this.client.post('/flux-pro-1.0-fill', params);
      return response.data;
    } catch (error) {
      console.error(`BFL Image Editing Error: ${error.message}`);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw error;
    }
  }

  /**
   * Poll for results of a generation or editing job
   * @param {string} pollingUrl - URL to poll for results
   * @returns {Promise<Object>} - Job result
   */
  async getResult(pollingUrl) {
    try {
      // If full URL is provided, use it directly
      if (pollingUrl.startsWith('http')) {
        const response = await axios.get(pollingUrl, {
          headers: { 'x-key': this.apiKey }
        });
        return response.data;
      }
      
      // Otherwise use the relative path
      const response = await this.client.get(pollingUrl);
      return response.data;
    } catch (error) {
      console.error(`BFL Result Polling Error: ${error.message}`);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw error;
    }
  }

  /**
   * Poll for results with exponential backoff
   * @param {string} pollingUrl - URL to poll for results
   * @param {number} maxAttempts - Maximum number of polling attempts
   * @param {number} initialDelay - Initial delay in ms
   * @returns {Promise<Object>} - Final result or error
   */
  async pollWithBackoff(pollingUrl, maxAttempts = 30, initialDelay = 2000) {
    let attempts = 0;
    let delay = initialDelay;

    while (attempts < maxAttempts) {
      try {
        const result = await this.getResult(pollingUrl);
        
        // Check if the job is completed
        if (result.status === 'succeeded') {
          return result;
        }
        
        // If ready, treat as succeeded (BFL API sometimes returns 'Ready' instead of 'succeeded')
        if (result.status === 'Ready') {
          console.log(`Job status is 'Ready', treating as succeeded`);
          // Normalize the status to 'succeeded' for consistent handling
          result.status = 'succeeded';
          return result;
        }
        
        // If still processing or pending, wait and retry
        if (result.status === 'processing' || result.status === 'Pending' || result.status === 'pending') {
          console.log(`Job still processing. Status: ${result.status}, Progress: ${result.progress || 'unknown'}. Attempt ${attempts + 1}/${maxAttempts}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * 1.5, 30000); // Exponential backoff, max 30s
          attempts++;
          continue;
        }
        
        // If failed, throw error
        if (result.status === 'failed') {
          throw new Error(`BFL job failed: ${JSON.stringify(result.details || {})}`);
        }
        
        // Unknown status
        throw new Error(`Unknown job status: ${result.status}`);
      } catch (error) {
        if (attempts >= maxAttempts - 1) {
          throw error;
        }
        
        console.error(`Polling attempt ${attempts + 1} failed: ${error.message}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, 30000);
        attempts++;
      }
    }
    
    throw new Error(`Max polling attempts (${maxAttempts}) reached without success`);
  }
}

module.exports = new BFLService();