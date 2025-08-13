const https = require('http');

const data = JSON.stringify({
  "prompt": "What video references do I have available to work with?",
  "selectedReferences": [],
  "script": null,
  "chatHistory": [],
  "workspaceNodes": [
    {
      "id": "node1",
      "type": "ad",
      "data": {
        "content": "Sample TikTok ad for skincare product with fast cuts and music",
        "uploadedFiles": [{"id": "f1", "name": "skincare_ad.mp4", "type": "video/mp4"}]
      }
    },
    {
      "id": "node2", 
      "type": "productSpec",
      "data": {
        "content": "Moisturizing cream with SPF 30, for all skin types",
        "uploadedFiles": [{"id": "f2", "name": "product_specs.pdf", "type": "application/pdf"}]
      }
    }
  ]
});

const options = {
  hostname: 'localhost',
  port: 5174,
  path: '/api/chat/responses',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`statusCode: ${res.statusCode}`);
  
  res.on('data', (chunk) => {
    process.stdout.write(chunk);
  });
  
  res.on('end', () => {
    console.log('\n[End of response]');
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();