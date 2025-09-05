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
    
    // Check if we should use a proxy for BFL API requests
    const useProxy = process.env.BFL_USE_PROXY === 'true';
    const clientConfig = {
      baseURL: this.baseUrl,
      headers: {
        'x-key': this.apiKey,
        'Content-Type': 'application/json'
       },
      timeout: 300000 // 300 seconds (5 minutes) timeout
    };
    
    // Configure proxy if enabled
    if (useProxy) {
      console.log('BFL Service configured to use proxy for API requests');
      clientConfig.proxy = {
        host: process.env.BFL_PROXY_HOST || 'localhost',
        port: parseInt(process.env.BFL_PROXY_PORT || '8080')
      };
      console.log(`Proxy configured: ${clientConfig.proxy.host}:${clientConfig.proxy.port}`);
    }
    
    this.client = axios.create(clientConfig);
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
      // Log the presence of garment and garment_url at the beginning
      if (params.garment) {
        console.log(`Garment parameter is present with length: ${params.garment.length}`);
      }
      if (params.garment_url) {
        console.log(`Garment URL parameter is present: ${params.garment_url}`);
      }
      
      console.log('generateImage called with params:', {
        ...params,
        garment: params.garment ? `base64_data_present (length: ${params.garment.length})` : undefined,
        garment_url: params.garment_url || undefined
      });
      
      // Create a new params object for the API request
      const apiParams = { ...params };
      
      // Check if we should use a proxy for this request
      const useProxy = process.env.BFL_USE_PROXY === 'true';
      if (useProxy) {
        console.log('Using proxy for BFL API request to handle large payloads');
        this.client.defaults.proxy = {
          host: process.env.BFL_PROXY_HOST || 'localhost',
          port: parseInt(process.env.BFL_PROXY_PORT || '8080')
        };
      }
      
      // Log the prompt to understand the context of the request
      if (apiParams.prompt) {
        console.log(`Processing request with prompt: "${apiParams.prompt}"`);
      }
      
      // Handle garment URL if provided
      if (params.garment_url && !params.garment_url.startsWith('data:')) {
        console.log('Converting garment URL to base64:', params.garment_url);
        try {
          // Add timeout and retry logic for garment image with increased timeout
          let garmentResponse;
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount < maxRetries) {
            try {
              console.log(`Attempt ${retryCount + 1}/${maxRetries} to fetch garment image from URL: ${params.garment_url}`);
              // Show progress update
              console.log(`Fetching garment image... (${retryCount + 1}/${maxRetries})`);
              
              garmentResponse = await axios.get(params.garment_url, { 
                responseType: 'arraybuffer',
                timeout: 300000, // 300 seconds (5 minutes) timeout
              });
              break; // If successful, exit the retry loop
            } catch (err) {
              retryCount++;
              if (retryCount >= maxRetries) {
                throw err; // Rethrow if we've exhausted retries
              }
              console.warn(`Attempt ${retryCount} to fetch garment image failed: ${err.message}, retrying...`);
              // Exponential backoff: 3s, 6s, 9s
              const backoffTime = 3000 * retryCount;
              console.log(`Waiting ${backoffTime/1000} seconds before retrying...`);
              await new Promise(resolve => setTimeout(resolve, backoffTime));
            }
          }
          
          if (garmentResponse && garmentResponse.data) {
            console.log('Garment image fetched successfully, size:', garmentResponse.data.length, 'bytes');
            
            // Check if image is large and might cause timeout issues
            const imageSizeInMB = garmentResponse.data.length / (1024 * 1024);
            console.log(`Garment image size: ${imageSizeInMB.toFixed(2)} MB`);
            
            // If image is larger than 5MB, log a warning about potential timeout issues
            if (imageSizeInMB > 5) {
              console.warn(`Large garment image detected (${imageSizeInMB.toFixed(2)} MB). This may cause timeout issues with the BFL API.`);
              console.warn('Consider optimizing the image before uploading to prevent 504 Gateway Timeout errors.');
            }
            
            // Convert to base64
            const base64Garment = Buffer.from(garmentResponse.data, 'binary').toString('base64');
            
            // Detect image type from response headers or default to jpeg
            const contentType = garmentResponse.headers?.['content-type'] || 'image/jpeg';
            console.log(`Detected content type: ${contentType}`);
            const imageType = contentType.split('/')[1] || 'jpeg';
            
            // Create the data URL
            apiParams.garment = `data:${contentType};base64,${base64Garment}`;
            console.log(`Successfully converted garment URL to base64 with type: ${imageType}, length: ${base64Garment.length}`);
            
            // Remove the original URL to avoid confusion
            delete apiParams.garment_url;
          } else {
            console.error('Garment response was empty or invalid');
            delete apiParams.garment_url;
          }
        } catch (error) {
          console.error(`Error fetching garment image: ${error.message}`);
          if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
          }
          console.log('Continuing without garment image');
          // Remove the garment_url if we couldn't fetch it
          delete apiParams.garment_url;
        }
      } else if (params.garment_url && params.garment_url.startsWith('data:')) {
        // If garment_url is already a base64 string, use it directly as garment
        console.log('Garment URL is already in base64 format, using directly');
        apiParams.garment = params.garment_url;
        console.log(`Base64 garment length: ${apiParams.garment.length}`);
        
        // Check if base64 string is large and might cause timeout issues
        const base64SizeInMB = apiParams.garment.length / (1024 * 1024);
        console.log(`Base64 garment size: ${base64SizeInMB.toFixed(2)} MB`);
        
        // If base64 string is larger than 5MB, log a warning about potential timeout issues
        if (base64SizeInMB > 5) {
          console.warn(`Large base64 garment detected (${base64SizeInMB.toFixed(2)} MB). This may cause timeout issues with the BFL API.`);
          console.warn('Consider optimizing the image before uploading to prevent 504 Gateway Timeout errors.');
        }
        
        delete apiParams.garment_url;
      }
      
      // Validate that we have a garment parameter after processing
      if (!apiParams.garment && !apiParams.garment_url) {
        console.warn('No garment or garment_url parameter available after processing');
      } else if (apiParams.garment) {
        console.log(`Final garment parameter is present with length: ${apiParams.garment.length}`);
      } else if (apiParams.garment_url) {
        console.log(`Final garment_url parameter is present: ${apiParams.garment_url}`);
      }
      
      // Log the parameters being sent to the API (excluding large base64 data)
      const logParams = {...apiParams};
      if (logParams.garment && logParams.garment.length > 100) {
        console.log('Garment parameter is present with length:', logParams.garment.length);
        logParams.garment = logParams.garment.substring(0, 50) + '... [truncated]';
      } else if (logParams.garment) {
        console.log('Garment parameter is present but unusually short:', logParams.garment.length);
      } else {
        console.log('No garment parameter is present');
      }
      
      console.log('Sending request to BFL API with params:', {
        ...logParams,
        garment: logParams.garment ? 'base64_data_truncated' : undefined
      });
      
      // Add special log for garment application
      if (apiParams.garment) {
        console.log(`Applying garment to model with prompt: "${apiParams.prompt}"`);
        console.log('Using BFL API similar to playground.bfl.ai for garment application');
      }
      
      // Show progress update before making the API call
      console.log('Sending request to BFL API... This may take several minutes for complex garment applications.');
      
      // Make the API call with progress tracking and enhanced error handling
      const startTime = Date.now();
      let response;
      
      try {
        // Set specific timeout for this request
        const requestTimeout = 900000; // 15 minutes timeout for large garment images
        console.log(`Setting request timeout to ${requestTimeout/1000} seconds`);
        
        // Configure request with specific settings for large payloads
        const requestConfig = {
          timeout: requestTimeout,
          maxBodyLength: 150 * 1024 * 1024, // 150MB max body size
          maxContentLength: 150 * 1024 * 1024, // 150MB max content size
          decompress: true, // Handle gzipped responses
          headers: {
            'x-key': this.apiKey,
            'Content-Type': 'application/json',
            'Connection': 'keep-alive',
            'Keep-Alive': 'timeout=900', // 15 minutes keep-alive
            'Accept-Encoding': 'gzip, deflate' // Accept compressed responses
          }
        };
        
        // Log request attempt
        console.log(`Sending BFL API request to ${this.baseUrl}/${endpoint}`);
        console.log(`Request size: approximately ${JSON.stringify(apiParams).length / 1024} KB`);
        console.log('Using extended timeout and increased payload limits for large garment images');
        
        // Implement chunked transfer if request is large
        if (JSON.stringify(apiParams).length > 10 * 1024 * 1024) { // If over 10MB
          console.log('Large request detected, using chunked transfer encoding');
          requestConfig.headers['Transfer-Encoding'] = 'chunked';
          delete requestConfig.headers['Content-Length']; // Let axios handle content length
        }
        
        response = await this.client.post(`/${endpoint}`, apiParams, requestConfig);
      } catch (requestError) {
        // Handle specific error codes with detailed logging
        if (requestError.code === 'ECONNABORTED') {
          console.error('Connection timed out during BFL API request');
          console.error(`Request timeout was set to ${requestConfig.timeout/1000} seconds`);
          console.error('This is likely due to the large size of the garment image or high server load');
          throw new Error('BFL API request timed out. The server took too long to respond, possibly due to the large garment image size. Try reducing the image size or try again later.');
        }
        
        if (requestError.response && requestError.response.status === 504) {
          console.error('Received 504 Gateway Timeout from BFL API');
          console.error('This indicates the BFL API server took too long to process the request');
          console.error('Recommendations: 1) Reduce garment image size, 2) Try again later when server load may be lower');
          
          // Create a more descriptive error for 504
          const enhancedError = new Error('BFL API returned 504 Gateway Timeout. The server took too long to process the request. Try with a smaller garment image or contact BFL support.');
          enhancedError.status = 504;
          enhancedError.code = 'GATEWAY_TIMEOUT';
          throw enhancedError;
        }
        
        // Handle other specific HTTP errors
        if (requestError.response) {
          console.error(`BFL API request failed with status ${requestError.response.status}`);
          console.error('Response headers:', JSON.stringify(requestError.response.headers));
          
          // Create enhanced error with status code
          const enhancedError = new Error(`BFL API request failed with status code ${requestError.response.status}: ${requestError.message}`);
          enhancedError.status = requestError.response.status;
          enhancedError.originalError = requestError;
          throw enhancedError;
        }
        
        // For network errors without response
        console.error(`BFL API network error: ${requestError.message}`);
        const networkError = new Error(`BFL API network error: ${requestError.message}. Check your network connection and try again.`);
        networkError.code = requestError.code;
        throw networkError;
      }
      
      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000;
      
      console.log(`BFL API request completed in ${processingTime.toFixed(2)} seconds`);
      console.log('BFL API response received successfully');
      
      return response.data;
    } catch (error) {
      console.error(`BFL Image Generation Error: ${error.message}`);
      
      // Enhanced error handling with specific messages for different error types
      let errorMessage = `BFL Image Generation failed: ${error.message}`;
      let statusCode = error.status || (error.response ? error.response.status : 500);
      
      // Log detailed error information for debugging
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        status: statusCode,
        stack: error.stack?.split('\n')[0] || 'No stack trace'
      });
      
      // Handle connection timeouts
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        console.error('Connection timed out. The BFL API is taking too long to respond.');
        console.error('This may be due to high server load or complex garment processing.');
        console.error('Consider trying again later or with a simpler garment image.');
        errorMessage = 'BFL API request timed out after 15 minutes. The server took too long to respond. This is likely due to the large garment image size. Try reducing the image size or try again later.';
        statusCode = 408; // Request Timeout
      }
      
      // Handle gateway timeout (may be already handled in the request catch block)
      if (error.code === 'GATEWAY_TIMEOUT' || statusCode === 504) {
        errorMessage = 'BFL API returned 504 Gateway Timeout. The server took too long to process your request. Try with a smaller garment image or at a less busy time.';
        console.error('504 Gateway Timeout detected. This typically happens when the server takes too long to process large garment images.');
        console.error('Recommendations: 1) Resize the garment image to be smaller, 2) Try again later, 3) Contact BFL support if the issue persists.');
        statusCode = 504;
      }
      
      // Handle specific HTTP error codes
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
        
        // Handle specific status codes
        switch (error.response.status) {
          case 504:
            errorMessage = 'BFL API returned 504 Gateway Timeout. The server took too long to process your request. Try with a smaller garment image or at a less busy time.';
            console.error('504 Gateway Timeout detected. This typically happens when the server takes too long to process large garment images.');
            console.error('Recommendations: 1) Resize the garment image to be smaller, 2) Try again later, 3) Contact BFL support if the issue persists.');
            break;
          case 413:
            errorMessage = 'BFL API returned 413 Payload Too Large. Your garment image is too large. Please resize it to a smaller size (under 10MB recommended).';
            break;
          case 429:
            errorMessage = 'BFL API returned 429 Too Many Requests. You have exceeded the rate limit. Please try again later.';
            break;
          case 400:
            errorMessage = `BFL API returned 400 Bad Request: ${error.response.data?.error || 'Invalid parameters'}. Check your garment image format and other parameters.`;
            break;
          case 401:
            errorMessage = 'BFL API authentication failed. Please check your API key.';
            break;
          case 403:
            errorMessage = 'BFL API returned 403 Forbidden. You do not have permission to access this resource.';
            break;
          case 500:
            errorMessage = 'BFL API encountered an internal server error. Please try again later or contact BFL support.';
            break;
        }
      }
      
      // Create a more descriptive error
      const enhancedError = new Error(errorMessage);
      enhancedError.originalError = error;
      enhancedError.details = error.response?.data || {};
      enhancedError.status = statusCode;
      enhancedError.code = error.code;
      
      // Log the final error we're throwing
      console.error(`Throwing enhanced error: ${errorMessage} (Status: ${statusCode})`);
      
      throw enhancedError;
    }
  }

  /**
   * Edit an image using inpainting (for try-on)
   * @param {Object} params - Edit parameters
   * @param {string} params.image - Base64 or URL of the image
   * @param {string} params.mask - Base64 or URL of the mask
   * @param {string} params.model_url - URL of the model image (will be converted to base64)
   * @param {string} params.garment_url - URL of the garment image (will be converted to base64)
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
      console.log('editImage called with params:', {
        ...params,
        image: params.image ? 'base64_data_present' : undefined,
        mask: params.mask ? 'base64_data_present' : undefined,
        indian_model: params.indian_model || false
      });
      
      // If Indian model flag is set, enhance the prompt
      if (params.indian_model && params.prompt) {
        if (!params.prompt.includes('Indian')) {
          params.prompt = `Indian model ${params.prompt}`;
        }
        console.log('Enhanced prompt for Indian model:', params.prompt);
      }
      
      // Create a new params object for the API request
      const apiParams = { ...params };
      
      // Check if we need to fetch and convert URLs to base64
      if (params.model_url && (!params.image || !params.image.startsWith('data:'))) {
        console.log('Converting model URL to base64...');
        try {
          // Add timeout and retry logic for model image
          const imageResponse = await axios.get(params.model_url, { 
            responseType: 'arraybuffer',
            timeout: 30000, // 30 seconds timeout
            maxRetries: 2,
            retryDelay: 1000
          }).catch(async (err) => {
            console.warn(`First attempt to fetch model image failed: ${err.message}, retrying...`);
            // Wait 2 seconds and retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            return axios.get(params.model_url, { responseType: 'arraybuffer', timeout: 30000 });
          });
          
          const base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');
          apiParams.image = `data:image/jpeg;base64,${base64Image}`;
          console.log('Successfully converted model URL to base64');
        } catch (error) {
          console.error(`Error fetching model image: ${error.message}`);
          console.log('Falling back to original model URL');
          // Instead of throwing error, use the original URL
          apiParams.image = params.model_url;
        }
      }
      
      if (params.garment_url && (!params.garment || !params.garment.startsWith('data:'))) {
        console.log('Converting garment URL to base64...');
        try {
          // Add timeout and retry logic for garment image
          const garmentResponse = await axios.get(params.garment_url, { 
            responseType: 'arraybuffer',
            timeout: 300000, // 300 seconds (5 minutes) timeout
            maxRetries: 2,
            retryDelay: 1000
          }).catch(async (err) => {
            console.warn(`First attempt to fetch garment image failed: ${err.message}, retrying...`);
            // Wait 2 seconds and retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            return axios.get(params.garment_url, { responseType: 'arraybuffer', timeout: 300000 });
          });
          
          const base64Garment = Buffer.from(garmentResponse.data, 'binary').toString('base64');
          apiParams.garment = `data:image/jpeg;base64,${base64Garment}`;
          console.log('Successfully converted garment URL to base64');
        } catch (error) {
          console.error(`Error fetching garment image: ${error.message}`);
          console.log('Falling back to original garment URL');
          // Instead of throwing error, use the original URL
          apiParams.garment = params.garment_url;
        }
      }
      
      // Validate required parameters
      if (!apiParams.image) {
        throw new Error('Missing required parameter: image. Please provide either image or model_url.');
      }
      if (!apiParams.garment) {
        throw new Error('Missing required parameter: garment. Please provide either garment or garment_url.');
      }
      
      // Log success message
      console.log('All required parameters validated successfully for BFL API request.');

      
      // Log parameters for debugging (excluding large base64 data)
      const logParams = {...apiParams};
      if (logParams.image && logParams.image.length > 100) {
        logParams.image = logParams.image.substring(0, 50) + '... [truncated]';
      }
      if (logParams.garment && logParams.garment.length > 100) {
        logParams.garment = logParams.garment.substring(0, 50) + '... [truncated]';
      }
      console.log('BFL editImage params:', logParams);
      
      // Make API request with increased timeout
      console.log('Sending request to BFL API...');
      const response = await this.client.post('/flux-pro-1.1-edit', apiParams, {
        timeout: 300000 // Increase timeout to 300 seconds (5 minutes)
      }).catch(error => {
        console.error('BFL API request failed:', error.message);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', JSON.stringify(error.response.data));
        }
        throw error;
      });
      
      console.log('BFL API request successful with status:', response.status);
      
      // Validate response
      if (!response.data || !response.data.id) {
        console.error('Invalid BFL API response:', response.data);
        throw new Error('Invalid response from BFL API');
      }
      
      // Validate polling URL
      if (!response.data.polling_url) {
        console.error('Missing polling_url in BFL API response:', response.data);
        throw new Error('Missing polling URL in BFL API response');
      }
      
      return response.data;
    } catch (error) {
      console.error(`BFL Image Editing Error: ${error.message}`);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      // Provide more detailed error for client
      const enhancedError = new Error(error.message);
      enhancedError.details = error.response?.data || {};
      enhancedError.status = error.response?.status || 500;
      throw enhancedError;
    }
  }

  /**
   * Poll for results of a generation or editing job
   * @param {string} pollingUrl - URL to poll for results
   * @returns {Promise<Object>} - Job result
   */
  async getResult(pollingUrl) {
    try {
      console.log(`Fetching result from polling URL: ${pollingUrl}`);
      
      // If full URL is provided, use it directly
      if (pollingUrl.startsWith('http')) {
        const response = await axios.get(pollingUrl, {
          headers: { 'x-key': this.apiKey },
          timeout: 30000, // 30 second timeout for polling requests
          maxRedirects: 5, // Allow up to 5 redirects
          validateStatus: status => status < 500 // Only treat 5xx errors as errors
        });
        
        // Check for valid response
        if (!response.data) {
          console.warn('Received empty response data from polling URL');
          return { status: 'processing', message: 'Empty response data' };
        }
        
        // Log response details for debugging
        console.log(`Poll response status code: ${response.status}`);
        console.log(`Poll response data type: ${typeof response.data}`);
        
        return response.data;
      }
      
      // Otherwise use the relative path
      const response = await this.client.get(pollingUrl, {
        timeout: 30000, // 30 second timeout for polling requests
        maxRedirects: 5, // Allow up to 5 redirects
        validateStatus: status => status < 500 // Only treat 5xx errors as errors
      });
      
      // Check for valid response
      if (!response.data) {
        console.warn('Received empty response data from polling URL');
        return { status: 'processing', message: 'Empty response data' };
      }
      
      // Log response details for debugging
      console.log(`Poll response status code: ${response.status}`);
      console.log(`Poll response data type: ${typeof response.data}`);
      
      return response.data;
    } catch (error) {
      console.error(`BFL Result Polling Error: ${error.message}`);
      
      // Enhanced error handling
      if (error.code === 'ECONNABORTED') {
        console.error('Polling request timed out. Will retry with backoff.');
        // Return a processing status to allow retry
        return { status: 'processing', message: 'Request timed out' };
      }
      
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error(`Response headers: ${JSON.stringify(error.response.headers)}`);
        
        // For 4xx errors, we might want to fail immediately
        if (error.response.status >= 400 && error.response.status < 500) {
          console.error(`Client error (${error.response.status}) when polling. This may indicate an invalid polling URL.`);
          throw new Error(`Polling failed with status ${error.response.status}: ${JSON.stringify(error.response.data || {})}`);
        }
      }
      
      // For network errors or 5xx errors, return processing to allow retry
      console.error('Returning processing status to allow retry');
      return { status: 'processing', message: `Error: ${error.message}` };
    }
  }

  /**
   * Poll for results with exponential backoff
   * @param {string} pollingUrl - URL to poll for results
   * @param {number} maxAttempts - Maximum number of polling attempts
   * @param {number} initialDelay - Initial delay in ms
   * @returns {Promise<Object>} - Final result or error
   */
  async pollWithBackoff(pollingUrl, maxAttempts = 60, initialDelay = 2000) {
    let attempts = 0;
    let delay = initialDelay;
    const startTime = Date.now();
    
    console.log(`Starting polling process for URL: ${pollingUrl}`);
    console.log(`Maximum attempts: ${maxAttempts}, Initial delay: ${initialDelay}ms`);
    
    while (attempts < maxAttempts) {
      try {
        const currentTime = Date.now();
        const elapsedTime = (currentTime - startTime) / 1000;
        
        console.log(`Polling attempt ${attempts + 1}/${maxAttempts} for URL: ${pollingUrl}`);
        console.log(`Elapsed time: ${elapsedTime.toFixed(2)} seconds`);
        
        // Add a progress indicator every 5 attempts
        if (attempts % 5 === 0) {
          console.log(`Still waiting for image generation to complete... (${Math.round((attempts / maxAttempts) * 100)}% of max attempts used)`);
        }
        
        const result = await this.getResult(pollingUrl);
        
        console.log(`Poll result status: ${result.status}`);
        
        // Check if the job is completed
        if (result.status === 'succeeded') {
          const totalTime = (Date.now() - startTime) / 1000;
          console.log(`✅ Polling succeeded after ${attempts + 1} attempts and ${totalTime.toFixed(2)} seconds`);
          return result;
        }
        
        // If ready, treat as succeeded (BFL API sometimes returns 'Ready' instead of 'succeeded')
        if (result.status === 'Ready') {
          console.log(`Job status is 'Ready', treating as succeeded`);
          // Normalize the status to 'succeeded' for consistent handling
          result.status = 'succeeded';
          const totalTime = (Date.now() - startTime) / 1000;
          console.log(`✅ Polling succeeded after ${attempts + 1} attempts and ${totalTime.toFixed(2)} seconds`);
          return result;
        }
        
        // If still processing or pending, wait and retry
        if (result.status === 'processing' || result.status === 'Pending' || result.status === 'pending') {
          console.log(`Job still processing. Status: ${result.status}, Progress: ${result.progress || 'unknown'}. Attempt ${attempts + 1}/${maxAttempts}`);
          attempts++;
          
          // Log the wait time
          console.log(`Waiting ${(delay / 1000).toFixed(1)} seconds before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Exponential backoff with max of 30 seconds
          const oldDelay = delay;
          delay = Math.min(delay * 1.5, 30000);
          console.log(`Increased backoff delay from ${oldDelay}ms to ${delay}ms`);
          continue;
        }
        
        // If failed, throw error
        if (result.status === 'failed') {
          console.error(`❌ Polling failed after ${attempts + 1} attempts, job status is failed`);
          console.error('Failure details:', result);
          throw new Error(`BFL job failed: ${JSON.stringify(result.details || {})}`);
        }
        
        // Unknown status
        console.warn(`Unknown job status: ${result.status}, continuing to poll...`);
        attempts++;
        console.log(`Waiting ${(delay / 1000).toFixed(1)} seconds before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, 30000);
      } catch (error) {
        if (attempts >= maxAttempts - 1) {
          throw error;
        }
        
        // Enhanced error logging
        if (error.code === 'ECONNABORTED') {
          console.error('Polling request timed out. The server might be under heavy load.');
        }
        
        console.error(`Polling attempt ${attempts + 1} failed: ${error.message}. Retrying...`);
        console.log(`Waiting ${(delay / 1000).toFixed(1)} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, 30000);
        attempts++;
      }
    }
    
    const totalTime = (Date.now() - startTime) / 1000;
    console.error(`❌ Maximum polling attempts (${maxAttempts}) reached after ${totalTime.toFixed(2)} seconds without success`);
    throw new Error(`Maximum polling attempts (${maxAttempts}) reached without success after ${totalTime.toFixed(2)} seconds`);
  }
}

module.exports = new BFLService();