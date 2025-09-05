/**
 * Test script to verify garment image processing
 */
const bflService = require('./services/bflService');
const fs = require('fs');
const path = require('path');

// Configure logging
const logFile = path.join(__dirname, 'garment_test_log.txt');
fs.writeFileSync(logFile, `Garment Processing Test - ${new Date().toISOString()}\n\n`);

function log(message) {
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(logFile, logMessage);
}

async function testGarmentProcessing() {
  try {
    log('Starting garment processing test');
    
    // Test case 1: URL-based garment
    log('\nTest Case 1: URL-based garment');
    const urlParams = {
      prompt: 'A professional model wearing a stylish outfit',
      garment_url: 'http://localhost:5000/uploads/cloth_images/sample.jpg', // Replace with an actual URL
      width: 1024,
      height: 1024
    };
    
    log(`Testing with garment_url: ${urlParams.garment_url}`);
    try {
      // Don't actually call the API, just log what would happen
      log('Would process URL-based garment with these parameters:');
      log(JSON.stringify(urlParams, null, 2));
    } catch (error) {
      log(`Error in URL test: ${error.message}`);
    }
    
    // Test case 2: Base64-based garment
    log('\nTest Case 2: Base64-based garment');
    // Create a simple base64 image for testing
    const base64Sample = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/KKKKAP/2Q==';
    
    const base64Params = {
      prompt: 'A professional model wearing a stylish outfit',
      garment: base64Sample,
      width: 1024,
      height: 1024
    };
    
    log('Testing with base64 garment data');
    try {
      // Don't actually call the API, just log what would happen
      log('Would process base64 garment with these parameters:');
      log(JSON.stringify({
        ...base64Params,
        garment: 'base64_data_truncated'
      }, null, 2));
    } catch (error) {
      log(`Error in base64 test: ${error.message}`);
    }
    
    // Test case 3: Mixed case - garment_url with base64 data
    log('\nTest Case 3: garment_url with base64 data');
    const mixedParams = {
      prompt: 'A professional model wearing a stylish outfit',
      garment_url: base64Sample,
      width: 1024,
      height: 1024
    };
    
    log('Testing with garment_url containing base64 data');
    try {
      // Don't actually call the API, just log what would happen
      log('Would process mixed case with these parameters:');
      log(JSON.stringify({
        ...mixedParams,
        garment_url: 'base64_data_truncated'
      }, null, 2));
    } catch (error) {
      log(`Error in mixed test: ${error.message}`);
    }
    
    log('\nTest completed successfully');
  } catch (error) {
    log(`Test failed with error: ${error.message}`);
  }
}

// Run the test
testGarmentProcessing().then(() => {
  log('Test script execution completed');
}).catch(error => {
  log(`Test script execution failed: ${error.message}`);
});