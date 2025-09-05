/**
 * Test script for BFL API garment image processing
 * This script tests the BFL API with different garment image formats
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configure logging
const logFile = path.join(__dirname, 'bfl_api_test_log.txt');
fs.writeFileSync(logFile, `BFL API Test - ${new Date().toISOString()}\n\n`);

function log(message) {
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(logFile, logMessage);
}

async function testBflApi() {
  try {
    log('Starting BFL API test');
    
    // Test the BFL playground API directly
    const playgroundUrl = 'https://playground.bfl.ai/image/generate/8ea55818-a284-4663-999b-0b4e5d9427f5';
    
    log(`\nVisiting BFL playground URL: ${playgroundUrl}`);
    try {
      const response = await axios.get(playgroundUrl);
      log(`Playground response status: ${response.status}`);
      log('Playground HTML content length: ' + response.data.length);
      
      // Extract key information from the playground page
      const htmlContent = response.data;
      const apiEndpointMatch = htmlContent.match(/\/api\/([^"']+)/);
      if (apiEndpointMatch) {
        log(`Found API endpoint: ${apiEndpointMatch[0]}`);
      } else {
        log('Could not find API endpoint in playground HTML');
      }
      
      // Look for garment application examples
      const garmentExamples = htmlContent.match(/garment[^<>]+/g);
      if (garmentExamples && garmentExamples.length > 0) {
        log('Found garment examples:');
        garmentExamples.forEach((example, index) => {
          log(`  ${index + 1}. ${example}`);
        });
      } else {
        log('No garment examples found in playground HTML');
      }
    } catch (error) {
      log(`Error accessing playground: ${error.message}`);
    }
    
    // Check BFL documentation
    const docsUrl = 'https://docs.bfl.ai/quick_start/introduction';
    log(`\nChecking BFL documentation: ${docsUrl}`);
    try {
      const response = await axios.get(docsUrl);
      log(`Documentation response status: ${response.status}`);
      log('Documentation HTML content length: ' + response.data.length);
      
      // Look for garment-related documentation
      const htmlContent = response.data;
      const garmentDocs = htmlContent.match(/garment[^<>\.,]{5,50}/g);
      if (garmentDocs && garmentDocs.length > 0) {
        log('Found garment documentation:');
        const uniqueDocs = [...new Set(garmentDocs)];
        uniqueDocs.forEach((doc, index) => {
          log(`  ${index + 1}. ${doc}`);
        });
      } else {
        log('No specific garment documentation found');
      }
    } catch (error) {
      log(`Error accessing documentation: ${error.message}`);
    }
    
    log('\nTest completed successfully');
  } catch (error) {
    log(`Test failed with error: ${error.message}`);
  }
}

// Run the test
testBflApi().then(() => {
  log('Test script execution completed');
}).catch(error => {
  log(`Test script execution failed: ${error.message}`);
});